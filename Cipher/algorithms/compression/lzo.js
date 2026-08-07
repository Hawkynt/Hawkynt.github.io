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

      CreateInstance(isInverse = false) {
        return new LZOInstance(this, isInverse);
      }
    }

    // LZO compression instance
    class LZOInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // LZO1X-1 style parameters (LZ4-style token stream; see CompressionWorkbench's
        // Lzo1xCompressor, the authoritative reference for this container/payload).
        this.MIN_MATCH = 4;            // Minimum match length
        this.MAX_DISTANCE = 65535;     // Maximum backward distance (fits u16 LE offset)
        this.HASH_BITS = 14;           // Hash table bits
        this.HASH_SIZE = OpCodes.Shl32(1, this.HASH_BITS);
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        const result = this.isInverse ? this._decompress(new Uint8Array(this.inputBuffer)) : this._compress(new Uint8Array(this.inputBuffer));
        this.inputBuffer = [];
        return Array.from(result);
      }

      _compress(input) {
        // Container: 4-byte little-endian original length, then the LZO1X payload
        const header = OpCodes.Unpack32LE(input.length);
        const payload = input.length === 0 ? [] : this._compressBlock(input);
        return new Uint8Array(header.concat(payload));
      }

      _compressBlock(input) {
        const srcLen = input.length;
        const output = [];
        const hashTable = new Int32Array(this.HASH_SIZE);
        hashTable.fill(-1);

        let anchor = 0; // Start of pending literal run
        let pos = 0;

        // We need MIN_MATCH bytes ahead to form a hash key.
        const limit = srcLen - this.MIN_MATCH;

        while (pos <= limit) {
          const hash = this._hash4(input, pos);
          const matchPos = hashTable[hash];
          hashTable[hash] = pos;

          if (matchPos >= 0 && (pos - matchPos) <= this.MAX_DISTANCE &&
              input[pos] === input[matchPos] &&
              input[pos + 1] === input[matchPos + 1] &&
              input[pos + 2] === input[matchPos + 2] &&
              input[pos + 3] === input[matchPos + 3]) {
            // Extend match as far as possible
            let matchLength = this.MIN_MATCH;
            const maxMatchLength = srcLen - pos;
            while (matchLength < maxMatchLength && input[pos + matchLength] === input[matchPos + matchLength])
              ++matchLength;

            const literalLength = pos - anchor;
            const distance = pos - matchPos;

            this._writeSequence(output, input, anchor, literalLength, distance, matchLength - this.MIN_MATCH);

            // Update hash for positions skipped inside the match
            for (let i = 1; i < matchLength; ++i) {
              const skipped = pos + i;
              if (skipped > limit) break;
              hashTable[this._hash4(input, skipped)] = skipped;
            }

            pos += matchLength;
            anchor = pos;
          } else
            ++pos;
        }

        // Final literal run: low nibble = 0, no offset follows.
        this._writeFinalLiterals(output, input, anchor, srcLen - anchor);

        return output;
      }

      _hash4(input, pos) {
        const val = OpCodes.Pack32LE(
          OpCodes.ToByte(input[pos]), OpCodes.ToByte(input[pos + 1]),
          OpCodes.ToByte(input[pos + 2]), OpCodes.ToByte(input[pos + 3])
        );
        return OpCodes.Shr32(OpCodes.Mul32(val, 2654435761), 32 - this.HASH_BITS);
      }

      _writeSequence(output, input, litStart, litLen, distance, matchExtra) {
        const litNibble = Math.min(litLen, 15);
        const matchNibble = Math.min(matchExtra, 15);
        output.push(OpCodes.ToByte(OpCodes.Shl8(litNibble, 4)|matchNibble));

        if (litNibble === 15) {
          let remaining = litLen - 15;
          while (remaining >= 255) {
            output.push(255);
            remaining -= 255;
          }
          output.push(OpCodes.ToByte(remaining));
        }

        for (let i = 0; i < litLen; ++i)
          output.push(OpCodes.ToByte(input[litStart + i]));

        output.push(OpCodes.ToByte(distance));
        output.push(OpCodes.ToByte(OpCodes.Shr16(distance, 8)));

        if (matchNibble === 15) {
          let remaining = matchExtra - 15;
          while (remaining >= 255) {
            output.push(255);
            remaining -= 255;
          }
          output.push(OpCodes.ToByte(remaining));
        }
      }

      _writeFinalLiterals(output, input, litStart, litLen) {
        const litNibble = Math.min(litLen, 15);
        output.push(OpCodes.ToByte(OpCodes.Shl8(litNibble, 4))); // low nibble = 0

        if (litNibble === 15) {
          let remaining = litLen - 15;
          while (remaining >= 255) {
            output.push(255);
            remaining -= 255;
          }
          output.push(OpCodes.ToByte(remaining));
        }

        for (let i = 0; i < litLen; ++i)
          output.push(OpCodes.ToByte(input[litStart + i]));
      }

      _decompress(input) {
        if (input.length < 4)
          return new Uint8Array(0);

        const originalLength = OpCodes.Pack32LE(
          OpCodes.ToByte(input[0]), OpCodes.ToByte(input[1]),
          OpCodes.ToByte(input[2]), OpCodes.ToByte(input[3])
        );
        const output = this._decompressBlock(input.slice(4));
        return output.length === originalLength ? output : output.slice(0, originalLength);
      }

      _decompressBlock(input) {
        const inputLength = input.length;
        const output = [];
        let ip = 0;

        while (ip < inputLength) {
          const token = OpCodes.ToByte(input[ip++]);

          let litLen = OpCodes.ToByte(OpCodes.Shr8(token, 4));
          if (litLen === 15) {
            let ext;
            do {
              if (ip >= inputLength) break;
              ext = OpCodes.ToByte(input[ip++]);
              litLen += ext;
            } while (ext === 255);
          }

          const matchExtra = OpCodes.And8(token, 0x0F);

          if (litLen > 0) {
            for (let i = 0; i < litLen && ip < inputLength; ++i)
              output.push(OpCodes.ToByte(input[ip++]));
          }

          // End-of-stream: the final token has low nibble 0 and nothing follows it.
          if (matchExtra === 0 && ip >= inputLength)
            break;

          if (ip + 1 >= inputLength) break;
          const distance = OpCodes.Pack16LE(OpCodes.ToByte(input[ip]), OpCodes.ToByte(input[ip + 1]));
          ip += 2;

          let matchLength = this.MIN_MATCH + matchExtra;
          if (matchExtra === 15) {
            let ext;
            do {
              if (ip >= inputLength) break;
              ext = OpCodes.ToByte(input[ip++]);
              matchLength += ext;
            } while (ext === 255);
          }

          const matchStart = output.length - distance;
          for (let i = 0; i < matchLength; ++i)
            output.push(OpCodes.ToByte(output[matchStart + i]));
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