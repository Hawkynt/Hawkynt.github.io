/*
 * Shrink (ZIP Method 1) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Shrink is PKWARE's ZIP "Shrinking" method: dynamic Lempel-Ziv-Welch coding
 * with variable code width (9 to 13 bits, controlled by the encoder rather
 * than grown automatically) and "partial clearing" of the dictionary instead
 * of a full reset. Two reserved control sequences appear in the code stream:
 * code 256 followed by code 1 tells the decoder to widen subsequent codes by
 * one bit, and code 256 followed by code 2 tells the decoder to scan the
 * dictionary and free every entry that is not currently a prefix of another
 * (a "leaf"), reusing the lowest freed codes first. Codes are packed
 * LSB-first, and the stream is prefixed with a 4-byte little-endian original
 * length (matching CompressionWorkbench's ShrinkBuildingBlock framing).
 *
 * Reference:
 *   PKWARE, Inc., ".ZIP File Format Specification" (APPNOTE.TXT), section
 *   describing compression method 1 "Shrinking". See also T. A. Welch,
 *   "A Technique for High-Performance Data Compression", IEEE Computer,
 *   Vol. 17, No. 6, June 1984 (the underlying LZW algorithm).
 */


(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /** @type {int32} */
  const CODE_CONTROL = 256;
  /** @type {int32} */
  const CTRL_INCREASE_WIDTH = 1;
  /** @type {int32} */
  const CTRL_PARTIAL_CLEAR = 2;
  /** @type {int32} */
  const MIN_WIDTH = 9;
  /** @type {int32} */
  const MAX_WIDTH = 13;
  /** @type {int32} */
  const MAX_CODE = OpCodes.Shl32(1, MAX_WIDTH); // 8192

  // ----- Bit-level stream helpers (LSB-first) -----

  class BitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.buf = 0;
      /** @type {int32} */
      this.nBits = 0;
    }

    /**
     * @param {uint32} value - Code
     * @param {int32} width - Number of bits
     */
    writeBits(value, width) {
      this.buf = OpCodes.Or32(this.buf, OpCodes.Shl32(value, this.nBits));
      this.nBits += width;
      while (this.nBits >= 8) {
        this.bytes.push(OpCodes.And32(this.buf, 0xFF));
        this.buf = OpCodes.Shr32(this.buf, 8);
        this.nBits -= 8;
      }
    }

    /**
     * @returns {uint8[]} All bytes written
     */
    finish() {
      if (this.nBits > 0) {
        this.bytes.push(OpCodes.And32(this.buf, 0xFF));
        this.buf = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    /**
     * @param {uint8[]} bytes - Bytes to read
     */
    constructor(bytes) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.pos = 0;
      /** @type {uint32} */
      this.buf = 0;
      /** @type {int32} */
      this.nBits = 0;
      /** @type {boolean} */
      this.exhausted = false;
    }

    /**
     * @param {int32} width - Number of bits
     * @returns {int32} Code, or -1 (and exhausted set) when the input ran out
     */
    readBits(width) {
      while (this.nBits < width) {
        if (this.pos >= this.bytes.length) {
          this.exhausted = true;
          return -1;
        }
        this.buf = OpCodes.Or32(this.buf, OpCodes.Shl32(this.bytes[this.pos++], this.nBits));
        this.nBits += 8;
      }
      /** @type {uint32} */
      const mask = OpCodes.Sub32(OpCodes.Shl32(1, width), 1);
      /** @type {int32} */
      const value = OpCodes.And32(this.buf, mask);
      this.buf = OpCodes.Shr32(this.buf, width);
      this.nBits -= width;
      return value;
    }
  }

  /**
 * ShrinkCompression - PKZIP "Shrinking" (LZW with partial clearing) algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class ShrinkCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Shrink";
        this.description = "PKZIP method 1 (Shrinking): dynamic LZW coding with encoder-controlled variable code width (9-13 bits) and partial dictionary clearing, which frees only leaf (unreferenced) entries instead of resetting the whole table.";
        this.inventor = "PKWARE, Inc. (based on Terry Welch's LZW)";
        this.year = 1989;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary (LZW)";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem(".ZIP File Format Specification (APPNOTE.TXT)", "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"),
          new LinkItem("ZIP (file format) - Wikipedia (Shrinking method)", "https://en.wikipedia.org/wiki/ZIP_(file_format)"),
          new LinkItem("A Technique for High-Performance Data Compression (Welch, 1984)", "https://ieeexplore.ieee.org/document/1659158")
        ];

        this.references = [
          new LinkItem("Info-ZIP unshrink.c (historical decoder notes)", "https://github.com/LuaDist/zziplib"),
          new LinkItem("Lempel-Ziv-Welch - Wikipedia", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch")
        ];

        // Test vectors - the exact code stream is implementation-defined; there is
        // no publicly documented byte-exact PKZIP Shrink reference stream for
        // arbitrary short inputs, so these were cross-checked against
        // CompressionWorkbench's ShrinkEncoder/ShrinkBuildingBlock.
        this.tests = [
          {
            text: "Empty input",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: [],
            expected: [0, 0, 0, 0]
          },
          {
            text: "Single byte",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: [0x41],
            expected: [1, 0, 0, 0, 65, 0]
          },
          {
            text: "256 repeated bytes",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: new Array(256).fill(0x61),
            expected: [0, 1, 0, 0, 97, 2, 10, 28, 72, 176, 160, 193, 131, 8, 19, 42, 92, 200, 176, 161, 195, 135, 16, 35, 74, 156, 72, 177, 162, 64]
          },
          {
            text: "Text sample repeated 4x",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
            expected: [180, 0, 0, 0, 116, 208, 148, 1, 17, 167, 78, 154, 49, 107, 64, 136, 145, 243, 230, 142, 27, 16, 102, 222, 224, 1, 161, 166, 78, 27, 56, 115, 64, 188, 177, 83, 70, 14, 136, 128, 3, 217, 132, 209, 147, 7, 4, 153, 55, 103, 92, 124, 20, 72, 208, 32, 66, 133, 12, 29, 66, 148, 72, 209, 34, 70, 141, 28, 61, 130, 4, 33, 146, 164, 73, 148, 42, 119, 22, 60, 152, 112, 97, 195, 135, 17, 39, 86, 188, 152, 113, 99, 199, 149, 33, 71, 150, 60, 153, 18, 106, 75, 162, 48, 143, 206, 84, 106, 179, 105, 78, 171, 61, 167, 2, 5, 1]
          },
          {
            text: "All 256 byte values",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: Array.from({ length: 256 }, (_, i) => i),
            expected: [0, 1, 0, 0, 0, 2, 8, 24, 64, 160, 128, 129, 3, 8, 18, 40, 88, 192, 160, 129, 131, 7, 16, 34, 72, 152, 64, 161, 130, 133, 11, 24, 50, 104, 216, 192, 161, 131, 135, 15, 32, 66, 136, 24, 65, 162, 132, 137, 19, 40, 82, 168, 88, 193, 162, 133, 139, 23, 48, 98, 200, 152, 65, 163, 134, 141, 27, 56, 114, 232, 216, 193, 163, 135, 143, 31, 64, 130, 8, 25, 66, 164, 136, 145, 35, 72, 146, 40, 89, 194, 164, 137, 147, 39, 80, 162, 72, 153, 66, 165, 138, 149, 43, 88, 178, 104, 217, 194, 165, 139, 151, 47, 96, 194, 136, 25, 67, 166, 140, 153, 51, 104, 210, 168, 89, 195, 166, 141, 155, 55, 112, 226, 200, 153, 67, 167, 142, 157, 59, 120, 242, 232, 217, 195, 167, 143, 159, 63, 128, 2, 9, 26, 68, 168, 144, 161, 67, 136, 18, 41, 90, 196, 168, 145, 163, 71, 144, 34, 73, 154, 68, 169, 146, 165, 75, 152, 50, 105, 218, 196, 169, 147, 167, 79, 160, 66, 137, 26, 69, 170, 148, 169, 83, 168, 82, 169, 90, 197, 170, 149, 171, 87, 176, 98, 201, 154, 69, 171, 150, 173, 91, 184, 114, 233, 218, 197, 171, 151, 175, 95, 192, 130, 9, 27, 70, 172, 152, 177, 99, 200, 146, 41, 91, 198, 172, 153, 179, 103, 208, 162, 73, 155, 70, 173, 154, 181, 107, 216, 178, 105, 219, 198, 173, 155, 183, 111, 224, 194, 137, 27, 71, 174, 156, 185, 115, 232, 210, 169, 91, 199, 174, 157, 187, 119, 240, 226, 201, 155, 71, 175, 158, 189, 123, 248, 242, 233, 219, 199, 175, 159, 191, 127]
          }
        ];
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {ShrinkInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new ShrinkInstance(this, isInverse);
      }
    }

    /**
     * Encoder dictionary: code -> (parent code, byte) and back. Codes in use
     * are always >= 257, so 0 marks "no code" in the reverse table, which is
     * indexed by parent * 256 + byte.
     */
    class ShrinkTrie {
      constructor() {
        /** @type {int32[]} */
        this.codeOfKey = new Int32Array(MAX_CODE * 256);
        /** @type {int32[]} */
        this.keyOfCode = new Int32Array(MAX_CODE);
        /** @type {boolean[]} */
        this.used = new Array(MAX_CODE);
        for (let i = 0; i < MAX_CODE; i++) {
          this.used[i] = false;
        }
      }

      /**
       * @param {int32} parent - Parent code (or byte)
       * @param {uint8} value - Following byte
       * @returns {int32} The code, or 0 when there is none
       */
      find(parent, value) {
        /** @type {int32} */
        const key = parent * 256 + value;
        return this.codeOfKey[key];
      }

      /**
       * @param {int32} parent - Parent code (or byte)
       * @param {uint8} value - Following byte
       * @param {int32} code - Code for parent + value
       */
      add(parent, value, code) {
        /** @type {int32} */
        const key = parent * 256 + value;
        this.codeOfKey[key] = code;
        this.keyOfCode[code] = key;
        this.used[code] = true;
      }

      /**
       * Free every leaf entry (a code that is no entry's parent)
       */
      partialClear() {
        /** @type {boolean[]} */
        const referenced = new Array(MAX_CODE);
        for (let c = 0; c < MAX_CODE; c++) {
          referenced[c] = false;
        }
        for (let c = 257; c < MAX_CODE; c++) {
          if (this.used[c]) {
            referenced[Math.floor(this.keyOfCode[c] / 256)] = true;
          }
        }
        for (let c = 257; c < MAX_CODE; c++) {
          if (this.used[c] && !referenced[c]) {
            this.codeOfKey[this.keyOfCode[c]] = 0;
            this.used[c] = false;
          }
        }
      }
    }

    class ShrinkInstance extends IAlgorithmInstance {
      /**
       * @param {ShrinkCompression} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        /** @type {uint8[]} */
        const data = this.inputBuffer;
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        if (this.isInverse) {
          return this._decompress(data);
        }
        return this._compress(data);
      }

      // ----- Compression (mirrors CompressionWorkbench's ShrinkEncoder) -----
      // The dictionary maps (parent code, byte) to a code; a slot is in use
      // exactly while its code is in the dictionary.

      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} LSB-first packed codes
       */
      _encode(data) {
        /** @type {BitWriter} */
        const writer = new BitWriter();
        /** @type {ShrinkTrie} */
        const trie = new ShrinkTrie();

        /** @type {int32} */
        let currentBits = MIN_WIDTH;
        /** @type {int32} */
        let nextCode = 257;

        if (data.length === 0) {
          /** @type {uint8[]} */
          const none = writer.finish();
          return none;
        }

        /** @type {int32} */
        let currentCode = data[0];
        /** @type {int32} */
        let i = 1;

        while (i < data.length) {
          /** @type {uint8} */
          const nextByte = data[i];
          /** @type {int32} */
          const known = trie.find(currentCode, nextByte);

          if (known !== 0) {
            currentCode = known;
            ++i;
            continue;
          }

          writer.writeBits(currentCode, currentBits);

          if (nextCode < MAX_CODE) {
            if (nextCode >= OpCodes.Shl32(1, currentBits) && currentBits < MAX_WIDTH) {
              writer.writeBits(CODE_CONTROL, currentBits);
              writer.writeBits(CTRL_INCREASE_WIDTH, currentBits);
              ++currentBits;
            }
            trie.add(currentCode, nextByte, nextCode);
            while (nextCode < MAX_CODE && trie.used[nextCode]) {
              ++nextCode;
            }
          } else {
            writer.writeBits(CODE_CONTROL, currentBits);
            writer.writeBits(CTRL_PARTIAL_CLEAR, currentBits);
            trie.partialClear();
            nextCode = 257;
            while (nextCode < MAX_CODE && trie.used[nextCode]) {
              ++nextCode;
            }
          }

          currentCode = nextByte;
          ++i;
        }

        writer.writeBits(currentCode, currentBits);
        /** @type {uint8[]} */
        const packed = writer.finish();
        return packed;
      }

      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} 4-byte LE length followed by the code stream
       */
      _compress(data) {
        /** @type {uint8[]} */
        let body = [];
        if (data.length !== 0) {
          body = this._encode(data);
        }
        /** @type {uint8[]} */
        const output = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));
        for (let k = 0; k < body.length; ++k) {
          output.push(body[k]);
        }
        return output;
      }

      // ----- Decompression (mirrors CompressionWorkbench's ShrinkDecoder) -----

      /**
       * @param {int32[]} prefix - Parent of each code
       * @param {int32[]} suffix - Last byte of each code
       * @param {int32} start - Code
       * @returns {int32} First byte of the code's string
       */
      _getFirstByte(prefix, suffix, start) {
        /** @type {int32} */
        let code = start;
        while (code >= 257) {
          code = prefix[code];
        }
        return suffix[code];
      }

      /**
       * Free every leaf code (one that is no used code's prefix)
       * @param {int32[]} prefix - Parent of each code
       * @param {boolean[]} isUsed - Codes in use, updated
       */
      _partialClear(prefix, isUsed) {
        /** @type {boolean[]} */
        const isReferenced = new Array(MAX_CODE);
        for (let c = 0; c < MAX_CODE; ++c) {
          isReferenced[c] = false;
        }
        for (let c = 257; c < MAX_CODE; ++c) {
          if (isUsed[c] && prefix[c] >= 257) {
            isReferenced[prefix[c]] = true;
          }
        }
        for (let c = 257; c < MAX_CODE; ++c) {
          if (isUsed[c] && !isReferenced[c]) {
            isUsed[c] = false;
          }
        }
      }

      /**
       * @param {uint8[]} compressed - Code stream
       * @param {int32} originalSize - Number of bytes to decode
       * @returns {uint8[]} Decoded bytes
       */
      _decode(compressed, originalSize) {
        /** @type {BitReader} */
        const reader = new BitReader(compressed);
        /** @type {uint8[]} */
        const output = new Array(originalSize);
        /** @type {int32} */
        let outputPos = 0;

        /** @type {int32[]} */
        const prefix = new Array(MAX_CODE);
        /** @type {int32[]} */
        const suffix = new Array(MAX_CODE);
        /** @type {boolean[]} */
        const isUsed = new Array(MAX_CODE);
        for (let i = 0; i < MAX_CODE; ++i) {
          prefix[i] = -1;
          suffix[i] = 0;
          isUsed[i] = false;
        }

        for (let i = 0; i < 256; ++i) {
          prefix[i] = -1;
          suffix[i] = i;
          isUsed[i] = true;
        }
        isUsed[CODE_CONTROL] = true;

        /** @type {int32} */
        let currentBits = MIN_WIDTH;
        /** @type {int32} */
        let nextCode = 257;
        /** @type {int32} */
        let prevCode = -1;
        /** @type {int32[]} */
        const decodeStack = new Array(MAX_CODE);

        while (outputPos < originalSize) {
          /** @type {int32} */
          const code = reader.readBits(currentBits);
          if (reader.exhausted) {
            break;
          }

          if (code === CODE_CONTROL) {
            /** @type {int32} */
            const subCmd = reader.readBits(currentBits);
            if (reader.exhausted) {
              break;
            }
            if (subCmd === CTRL_INCREASE_WIDTH) {
              if (currentBits < MAX_WIDTH) {
                ++currentBits;
              }
            } else if (subCmd === CTRL_PARTIAL_CLEAR) {
              this._partialClear(prefix, isUsed);
              nextCode = 257;
              prevCode = -1;
            }
            continue;
          }

          /** @type {int32} */
          let stackPos = 0;
          /** @type {int32} */
          let c = code;

          if (c >= 257 && !isUsed[c]) {
            if (prevCode < 0) {
              throw new Error('Shrink: invalid KwKwK with no previous code');
            }
            decodeStack[stackPos++] = this._getFirstByte(prefix, suffix, prevCode);
            c = prevCode;
          }

          while (c >= 257) {
            decodeStack[stackPos++] = suffix[c];
            c = prefix[c];
          }
          decodeStack[stackPos++] = suffix[c];

          for (let i = stackPos - 1; i >= 0 && outputPos < originalSize; --i) {
            output[outputPos++] = decodeStack[i];
          }

          if (prevCode >= 0 && nextCode < MAX_CODE) {
            while (nextCode < MAX_CODE && isUsed[nextCode]) {
              ++nextCode;
            }
            if (nextCode < MAX_CODE) {
              prefix[nextCode] = prevCode;
              suffix[nextCode] = decodeStack[stackPos - 1];
              isUsed[nextCode] = true;
              ++nextCode;
            }
          }

          prevCode = code;
        }

        return output;
      }

      /**
       * @param {uint8[]} data - 4-byte LE length followed by the code stream
       * @returns {uint8[]} Decoded bytes
       */
      _decompress(data) {
        if (data.length < 4) {
          throw new Error('Shrink: input smaller than 4-byte header');
        }
        // A size with the top bit set is negative here, as it always was
        /** @type {int32} */
        const size = OpCodes.ToInt(OpCodes.Or32(
          OpCodes.Or32(OpCodes.Or32(data[0], OpCodes.Shl32(data[1], 8)), OpCodes.Shl32(data[2], 16)),
          OpCodes.Shl32(data[3], 24)
        ));
        if (size === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }
        return this._decode(data.slice(4), size);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ShrinkCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ShrinkCompression, ShrinkInstance };
}));
