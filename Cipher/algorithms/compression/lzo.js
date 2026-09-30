/*
 * LZO Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LZO (Lempel-Ziv-Oberhumer) compression algorithm
 * Fast compression with emphasis on decompression speed
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

    class LZOCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZO";
        this.description = "Lempel-Ziv-Oberhumer compression algorithm. A fast compression library emphasizing decompression speed over compression ratio.";
        this.inventor = "Markus F.X.J. Oberhumer";
        this.year = 1996;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary-based";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.AT; // Austria

        // Documentation and references
        this.documentation = [
          new LinkItem("Official LZO Homepage", "http://www.oberhumer.com/opensource/lzo/"),
          new LinkItem("Wikipedia - LZO", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Oberhumer")
        ];

        this.references = [
          new LinkItem("LZO Data Compression Library", "http://www.oberhumer.com/opensource/lzo/lzodoc.html"),
          new LinkItem("miniLZO Implementation", "http://www.oberhumer.com/opensource/lzo/download/")
        ];

        // Test vectors - cross-checked byte-for-byte against CompressionWorkbench's
        // Lzo1xCompressor (BB_Lzo), which is the authoritative reference for this
        // container: 4-byte little-endian original length, then an LZ4-style token
        // stream (token byte: high nibble = literal length, low nibble = match
        // extra length; MinMatch = 4; no maximum-distance-from-end guard).
        this.tests = [
          {
            text: "Empty input",
            uri: "http://www.oberhumer.com/opensource/lzo/",
            input: [],
            expected: [0x00, 0x00, 0x00, 0x00]
          },
          {
            text: "Single character literal",
            uri: "http://www.oberhumer.com/opensource/lzo/",
            input: [65],
            expected: [0x01, 0x00, 0x00, 0x00, 0x10, 65]
          },
          {
            text: "Hello World string (no match, too short)",
            uri: "http://www.oberhumer.com/opensource/lzo/lzodoc.html",
            input: [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100],
            expected: [0x0B, 0x00, 0x00, 0x00, 0xB0, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]
          },
          {
            text: "ABCDEFGH sequence (no match, too short)",
            uri: "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Oberhumer",
            input: [65, 66, 67, 68, 69, 70, 71, 72],
            expected: [0x08, 0x00, 0x00, 0x00, 0x80, 65, 66, 67, 68, 69, 70, 71, 72]
          }
        ];
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {LZOInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new LZOInstance(this, isInverse);
      }
    }

    // LZO compression instance
    class LZOInstance extends IAlgorithmInstance {
      /**
       * @param {LZOCompression} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];

        // LZO1X-1 style parameters (LZ4-style token stream; see CompressionWorkbench's
        // Lzo1xCompressor, the authoritative reference for this container/payload).
        /** @type {int32} */
        this.MIN_MATCH = 4;            // Minimum match length
        /** @type {int32} */
        this.MAX_DISTANCE = 65535;     // Maximum backward distance (fits u16 LE offset)
        /** @type {int32} */
        this.HASH_BITS = 14;           // Hash table bits
        /** @type {int32} */
        this.HASH_SIZE = OpCodes.Shl32(1, this.HASH_BITS);
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        /** @type {uint8[]} */
        const bytes = new Uint8Array(this.inputBuffer);
        /** @type {uint8[]} */
        let result;
        if (this.isInverse) {
          result = this._decompress(bytes);
        } else {
          result = this._compress(bytes);
        }
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        /** @type {uint8[]} */
        const output = [];
        for (let i = 0; i < result.length; i++) {
          output.push(result[i]);
        }
        return output;
      }

      /**
       * @param {uint8[]} input - Input bytes
       * @returns {uint8[]} 4-byte LE length followed by the LZO1X payload
       */
      _compress(input) {
        // Container: 4-byte little-endian original length, then the LZO1X payload
        /** @type {uint8[]} */
        const header = OpCodes.Unpack32LE(input.length);
        /** @type {uint8[]} */
        let payload = [];
        if (input.length !== 0) {
          payload = this._compressBlock(input);
        }
        return new Uint8Array(header.concat(payload));
      }

      /**
       * @param {uint8[]} input - Input bytes (at least one)
       * @returns {uint8[]} Token stream
       */
      _compressBlock(input) {
        /** @type {int32} */
        const srcLen = input.length;
        /** @type {uint8[]} */
        const output = [];
        /** @type {int32[]} */
        const hashTable = new Int32Array(this.HASH_SIZE);
        hashTable.fill(-1);

        /** @type {int32} */
        let anchor = 0; // Start of pending literal run
        /** @type {int32} */
        let pos = 0;

        // We need MIN_MATCH bytes ahead to form a hash key.
        /** @type {int32} */
        const limit = srcLen - this.MIN_MATCH;

        while (pos <= limit) {
          /** @type {uint32} */
          const hash = this._hash4(input, pos);
          /** @type {int32} */
          const matchPos = hashTable[hash];
          hashTable[hash] = pos;

          if (matchPos >= 0 && (pos - matchPos) <= this.MAX_DISTANCE &&
              input[pos] === input[matchPos] &&
              input[pos + 1] === input[matchPos + 1] &&
              input[pos + 2] === input[matchPos + 2] &&
              input[pos + 3] === input[matchPos + 3]) {
            // Extend match as far as possible
            /** @type {int32} */
            let matchLength = this.MIN_MATCH;
            /** @type {int32} */
            const maxMatchLength = srcLen - pos;
            while (matchLength < maxMatchLength && input[pos + matchLength] === input[matchPos + matchLength]) {
              ++matchLength;
            }

            /** @type {int32} */
            const literalLength = pos - anchor;
            /** @type {int32} */
            const distance = pos - matchPos;

            this._writeSequence(output, input, anchor, literalLength, distance, matchLength - this.MIN_MATCH);

            // Update hash for positions skipped inside the match
            for (let i = 1; i < matchLength; ++i) {
              /** @type {int32} */
              const skipped = pos + i;
              if (skipped > limit) {
                break;
              }
              hashTable[this._hash4(input, skipped)] = skipped;
            }

            pos += matchLength;
            anchor = pos;
          } else {
            ++pos;
          }
        }

        // Final literal run: low nibble = 0, no offset follows.
        this._writeFinalLiterals(output, input, anchor, srcLen - anchor);

        return output;
      }

      /**
       * @param {uint8[]} input - Bytes
       * @param {int32} pos - Position of the four hashed bytes
       * @returns {uint32} Hash bucket
       */
      _hash4(input, pos) {
        /** @type {uint32} */
        const val = OpCodes.Pack32LE(
          OpCodes.ToByte(input[pos]), OpCodes.ToByte(input[pos + 1]),
          OpCodes.ToByte(input[pos + 2]), OpCodes.ToByte(input[pos + 3])
        );
        return OpCodes.Shr32(OpCodes.Mul32(val, 2654435761), 32 - this.HASH_BITS);
      }

      /**
       * Append a length extension: 255 bytes while at least 255 remain, then the rest
       * @param {uint8[]} output - Destination
       * @param {int32} value - Remaining length
       */
      _writeExtension(output, value) {
        /** @type {int32} */
        let remaining = value;
        while (remaining >= 255) {
          output.push(255);
          remaining -= 255;
        }
        output.push(OpCodes.ToByte(remaining));
      }

      /**
       * @param {uint8[]} output - Destination
       * @param {uint8[]} input - Source
       * @param {int32} litStart - First literal
       * @param {int32} litLen - Number of literals
       * @param {int32} distance - Match distance
       * @param {int32} matchExtra - Match length minus MIN_MATCH
       */
      _writeSequence(output, input, litStart, litLen, distance, matchExtra) {
        /** @type {int32} */
        const litNibble = Math.min(litLen, 15);
        /** @type {int32} */
        const matchNibble = Math.min(matchExtra, 15);
        output.push(OpCodes.ToByte(OpCodes.Or32(OpCodes.Shl8(litNibble, 4), matchNibble)));

        if (litNibble === 15) {
          this._writeExtension(output, litLen - 15);
        }

        for (let i = 0; i < litLen; ++i) {
          output.push(OpCodes.ToByte(input[litStart + i]));
        }

        output.push(OpCodes.ToByte(distance));
        output.push(OpCodes.ToByte(OpCodes.Shr16(distance, 8)));

        if (matchNibble === 15) {
          this._writeExtension(output, matchExtra - 15);
        }
      }

      /**
       * @param {uint8[]} output - Destination
       * @param {uint8[]} input - Source
       * @param {int32} litStart - First literal
       * @param {int32} litLen - Number of literals
       */
      _writeFinalLiterals(output, input, litStart, litLen) {
        /** @type {int32} */
        const litNibble = Math.min(litLen, 15);
        output.push(OpCodes.ToByte(OpCodes.Shl8(litNibble, 4))); // low nibble = 0

        if (litNibble === 15) {
          this._writeExtension(output, litLen - 15);
        }

        for (let i = 0; i < litLen; ++i) {
          output.push(OpCodes.ToByte(input[litStart + i]));
        }
      }

      /**
       * @param {uint8[]} input - 4-byte LE length followed by the LZO1X payload
       * @returns {uint8[]} Decoded bytes
       */
      _decompress(input) {
        if (input.length < 4) {
          return new Uint8Array(0);
        }

        /** @type {uint32} */
        const originalLength = OpCodes.Pack32LE(
          OpCodes.ToByte(input[0]), OpCodes.ToByte(input[1]),
          OpCodes.ToByte(input[2]), OpCodes.ToByte(input[3])
        );
        /** @type {uint8[]} */
        const output = this._decompressBlock(input.slice(4));
        if (output.length === originalLength) {
          return output;
        }
        return output.slice(0, originalLength);
      }

      /**
       * @param {uint8[]} input - Token stream
       * @returns {uint8[]} Decoded bytes
       */
      _decompressBlock(input) {
        /** @type {int32} */
        const inputLength = input.length;
        /** @type {uint8[]} */
        const output = [];
        /** @type {int32} */
        let ip = 0;

        while (ip < inputLength) {
          /** @type {uint8} */
          const token = OpCodes.ToByte(input[ip++]);

          /** @type {int32} */
          let litLen = OpCodes.ToByte(OpCodes.Shr8(token, 4));
          if (litLen === 15) {
            /** @type {int32} */
            let ext = 0;
            do {
              if (ip >= inputLength) {
                break;
              }
              ext = OpCodes.ToByte(input[ip++]);
              litLen += ext;
            } while (ext === 255);
          }

          /** @type {uint8} */
          const matchExtra = OpCodes.And8(token, 0x0F);

          if (litLen > 0) {
            for (let i = 0; i < litLen && ip < inputLength; ++i) {
              output.push(OpCodes.ToByte(input[ip++]));
            }
          }

          // End-of-stream: the final token has low nibble 0 and nothing follows it.
          if (matchExtra === 0 && ip >= inputLength) {
            break;
          }

          if (ip + 1 >= inputLength) {
            break;
          }
          /** @type {int32} */
          const distance = OpCodes.Pack16LE(OpCodes.ToByte(input[ip]), OpCodes.ToByte(input[ip + 1]));
          ip += 2;

          /** @type {int32} */
          let matchLength = this.MIN_MATCH + matchExtra;
          if (matchExtra === 15) {
            /** @type {int32} */
            let ext = 0;
            do {
              if (ip >= inputLength) {
                break;
              }
              ext = OpCodes.ToByte(input[ip++]);
              matchLength += ext;
            } while (ext === 255);
          }

          /** @type {int32} */
          const matchStart = output.length - distance;
          for (let i = 0; i < matchLength; ++i) {
            output.push(OpCodes.ToByte(output[matchStart + i]));
          }
        }

        return new Uint8Array(output);
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new LZOCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZOCompression, LZOInstance };
}));