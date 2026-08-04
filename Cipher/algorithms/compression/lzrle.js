/*
 * LZRLE (LZO-RLE) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZO-RLE Version 1: Dictionary-based compression with run-length encoding for zero sequences.
 * Used in Linux kernel zram since 5.1 as default compressor.
 * Combines LZ77 sliding window with efficient RLE encoding for zero-heavy data.
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

  class LZRLECompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZRLE";
      this.description = "LZO-RLE compression combining LZ77 dictionary-based compression with run-length encoding for zero sequences. Default zram compressor in Linux kernel 5.1+, optimized for zero-heavy data common in RAM compression.";
      this.inventor = "Markus F.X.J. Oberhumer, Dave Rodgman";
      this.year = 2018;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary + RLE";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AT; // Austria (LZO origin)

      // LZO-RLE specific parameters
      this.MIN_MATCH_LENGTH = 3;    // Minimum match length
      this.MAX_MATCH_LENGTH = 264;  // Maximum match length
      this.MAX_OFFSET = 0xBFFF;     // Maximum dictionary offset
      this.MIN_ZERO_RUN = 4;        // Minimum zero run for RLE encoding

      // Documentation and references
      this.documentation = [
        new LinkItem("Linux Kernel LZO Documentation", "https://docs.kernel.org/staging/lzo.html"),
        new LinkItem("Kernel.org LZO Specification", "https://www.kernel.org/doc/Documentation/lzo.txt"),
        new LinkItem("LZO-RLE Patch Discussion", "https://lwn.net/Articles/778510/"),
        new LinkItem("LZO-RLE Kernel Patch", "https://lore.kernel.org/lkml/20181127161913.23863-7-dave.rodgman@arm.com/")
      ];

      this.references = [
        new LinkItem("Official LZO Homepage", "http://www.oberhumer.com/opensource/lzo/"),
        new LinkItem("Wikipedia - LZO", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Oberhumer"),
        new LinkItem("ZRAM Default to LZO-RLE", "https://lore.kernel.org/lkml/20181130114715.27523-9-dave.rodgman@arm.com/")
      ];

      // Test vectors demonstrating RLE benefits for zero-heavy data
      this.tests = [
        new TestCase(
          [0x00, 0x00, 0x00, 0x00], // 4 zeros - minimum RLE length
          [0x11, 0xFF, 0xBF, 0x00, 0x11, 0x00, 0x00], // Zero-run + end marker
          "Minimum zero run (4 bytes)",
          "https://docs.kernel.org/staging/lzo.html"
        ),
        new TestCase(
          [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // 12 zeros
          [0x11, 0xFF, 0xBF, 0x01, 0x11, 0x00, 0x00], // Zero-run (12) + end marker
          "Extended zero run (12 bytes)",
          "https://docs.kernel.org/staging/lzo.html"
        ),
        new TestCase(
          [0x41, 0x42, 0x43], // "ABC" - no zeros, no repetition
          [0x03, 0x41, 0x42, 0x43, 0x11, 0x00, 0x00], // Literal count + data + end marker
          "Literals only - no compression",
          "https://www.kernel.org/doc/Documentation/lzo.txt"
        ),
        new TestCase(
          [0x41, 0x00, 0x00, 0x00, 0x00, 0x42], // 'A' + 4 zeros + 'B'
          [0x01, 0x41, 0x11, 0xFF, 0xBF, 0x00, 0x01, 0x42, 0x11, 0x00, 0x00], // Literal A + zero-run(4) + literal B + end
          "Mixed literals and zero run",
          "https://docs.kernel.org/staging/lzo.html"
        ),
        new TestCase(
          [0x41, 0x41, 0x41, 0x41], // "AAAA" - repeated non-zero
          [0x01, 0x41, 0x10, 0x00, 0x01, 0x11, 0x00, 0x00], // Literal A + match(offset=1, len=3, opcode 0x10) + end
          "Non-zero repetition - dictionary match",
          "https://www.kernel.org/doc/Documentation/lzo.txt"
        ),
        new TestCase(
          [], // Empty input
          [0x11, 0x00, 0x00], // Just end marker
          "Empty input",
          "https://docs.kernel.org/staging/lzo.html"
        ),
        new TestCase(
          new Array(300).fill(0x41),
          undefined,
          "Highly repetitive non-zero run (300x 'A') - regression: match/zero-run length quantization used to silently drop bytes",
          "https://docs.kernel.org/staging/lzo.html"
        ),
        new TestCase(
          new Array(300).fill(0x00),
          undefined,
          "Long zero run (300x 0x00) not aligned to the X*8+4 quantum",
          "https://docs.kernel.org/staging/lzo.html"
        ),
        new TestCase(
          (() => { const a = []; for (let i = 0; i < 400; ++i) a.push(i % 2 ? 0x62 : 0x61); return a; })(),
          undefined,
          "Alternating pattern - 200x 'ab'",
          "https://docs.kernel.org/staging/lzo.html"
        ),
        new TestCase(
          (() => {
            let seed = 0x1234ABCD, a = [];
            for (let i = 0; i < 512; ++i) { seed = OpCodes.AndN(seed * 1103515245 + 12345, 0x7fffffff); a.push(OpCodes.AndN(seed, 0xFF)); }
            return a;
          })(),
          undefined,
          "Binary/pseudo-random sample",
          "https://docs.kernel.org/staging/lzo.html"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZRLEInstance(this, isInverse);
    }
  }

  /**
 * LZRLE cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LZRLEInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.minMatchLength = algorithm.MIN_MATCH_LENGTH;
      this.maxMatchLength = algorithm.MAX_MATCH_LENGTH;
      this.maxOffset = algorithm.MAX_OFFSET;
      this.minZeroRun = algorithm.MIN_ZERO_RUN;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        const result = this._decompress();
        this.inputBuffer = [];
        return result;
      } else {
        const result = this._compress();
        this.inputBuffer = [];
        return result;
      }
    }

    _compress() {
      // Empty input produces only end marker
      if (this.inputBuffer.length === 0) {
        return [0x11, 0x00, 0x00];
      }

      const output = [];
      const input = this.inputBuffer;
      let pos = 0;
      let literalStart = 0;

      while (pos < input.length) {
        // Check for zero runs first (RLE optimization)
        const zeroRun = this._findZeroRun(input, pos);
        if (zeroRun >= this.minZeroRun) {
          // Encode any pending literals before zero run
          if (pos > literalStart) {
            this._encodeLiterals(output, input, literalStart, pos - literalStart);
          }
          // _encodeZeroRun can only exactly represent lengths of the form
          // X*8+4; it returns how much of the run it actually encoded
          // (<= zeroRun), and pos must advance by exactly that amount -
          // any left-over zero bytes fall through to the next iteration
          // and get picked up as another run (or as literals).
          const encodedRun = this._encodeZeroRun(output, zeroRun);
          pos += encodedRun;
          literalStart = pos;
          continue;
        }

        // Check for dictionary matches (LZ77)
        const match = this._findBestMatch(input, pos);
        if (match.length >= this.minMatchLength && match.offset > 0 && match.offset <= this.maxOffset) {
          // Encode any pending literals before the match
          if (pos > literalStart) {
            this._encodeLiterals(output, input, literalStart, pos - literalStart);
          }
          this._encodeMatch(output, match.offset, match.length);
          pos += match.length;
          literalStart = pos;
        } else {
          // No good match - accumulate as literal
          pos++;
        }
      }

      // Encode any remaining literals
      if (pos > literalStart) {
        this._encodeLiterals(output, input, literalStart, pos - literalStart);
      }

      // Add end marker (opcode 0x11, offset 0x0000)
      output.push(0x11, 0x00, 0x00);

      return output;
    }

    _decompress() {
      // Empty input
      if (this.inputBuffer.length === 0) {
        return [];
      }

      const output = [];
      const input = this.inputBuffer;
      let pos = 0;

      while (pos < input.length) {
        const opcode = input[pos++];

        // Check for end marker (0x11 0x00 0x00)
        if (opcode === 0x11 && pos + 1 < input.length) {
          const byte1 = input[pos];
          const byte2 = input[pos + 1];

          // Zero-run encoding: opcode 0x11, distance 0xBFFF
          if (byte1 === 0xFF && byte2 === 0xBF) {
            pos += 2;
            if (pos >= input.length) break;

            const X = input[pos++];
            // Run length = ((OpCodes.Shl32(X, 3))|0) + 4 (opcode 0x11 has L=1, but we ignore it for zero-run)
            const runLength = OpCodes.Shl8(X, 3) + 4;

            // Emit zeros
            for (let i = 0; i < runLength; ++i) {
              output.push(0x00);
            }
            continue;
          }

          // End marker check (offset 0x0000)
          if (byte1 === 0x00 && byte2 === 0x00) {
            break; // End of compressed stream
          }

          // Regular match with 16-bit offset
          pos += 2;
          const offset = OpCodes.Pack16BE(byte1, byte2);
          const length = OpCodes.And8(opcode, 0x0F) + 3;

          // Copy from dictionary
          for (let i = 0; i < length; ++i) {
            const sourcePos = output.length - offset;
            output.push(sourcePos >= 0 ? output[sourcePos] : 0x00);
          }
          continue;
        }

        // Literal run (opcodes 0x00-0x0F)
        if (OpCodes.And8(opcode, 0xF0) === 0x00) {
          let literalCount = OpCodes.And8(opcode, 0x0F);

          // Extended length encoding: chain of 255-continuation bytes
          // (matches _encodeLiterals). A single extra byte can only
          // represent counts up to 15+255=270; runs longer than that need
          // to keep chaining, exactly like the literal/match extensions
          // used elsewhere in this codebase.
          if (literalCount === 0 && pos < input.length) {
            let total = 0;
            let b;
            do {
              if (pos >= input.length) { b = 0; break; }
              b = input[pos++];
              total += b;
            } while (b === 255);
            literalCount = total + 15;
          }

          // Copy literals
          for (let i = 0; i < literalCount && pos < input.length; ++i) {
            output.push(input[pos++]);
          }
          continue;
        }

        // Match with small offset (opcodes 0x10-0x1F)
        if (OpCodes.And8(opcode, 0xF0) === 0x10) {
          if (pos + 1 >= input.length) break;

          const byte1 = input[pos++];
          const byte2 = input[pos++];
          const offset = OpCodes.Pack16BE(byte1, byte2);

          if (offset === 0) break; // End marker alternative

          const lengthCode = OpCodes.And8(opcode, 0x0F);
          let length = lengthCode + 3;

          // Extended length encoding (see _encodeMatch)
          if (lengthCode === 15) {
            let b;
            do {
              if (pos >= input.length) { b = 0; break; }
              b = input[pos++];
              length += b;
            } while (b === 255);
          }

          // Copy match
          for (let i = 0; i < length; ++i) {
            const sourcePos = output.length - offset;
            output.push(sourcePos >= 0 ? output[sourcePos] : 0x00);
          }
          continue;
        }

        // Other opcode ranges - simplified handling
        // In production implementation, would handle all LZO opcode ranges
        break;
      }

      return output;
    }

    _findZeroRun(input, startPos) {
      let length = 0;
      while (startPos + length < input.length && input[startPos + length] === 0x00) {
        ++length;
        // Max encodable: ((255 << 3)|7) + 4 = 2043
        if (length >= OpCodes.Shl8(255, 3) + 11) break;
      }
      return length;
    }

    _findBestMatch(input, currentPos) {
      let bestOffset = 0;
      let bestLength = 0;
      let literalCount = 0;

      // Can't match if too close to end
      if (currentPos + this.minMatchLength > input.length) {
        return { offset: 0, length: 0, literalCount: 0 };
      }

      // Search backward for matches (simplified sliding window)
      const searchStart = Math.max(0, currentPos - this.maxOffset);

      for (let candidatePos = searchStart; candidatePos < currentPos; ++candidatePos) {
        let matchLength = 0;
        const maxPossible = Math.min(this.maxMatchLength, input.length - currentPos);

        // Count matching bytes
        while (matchLength < maxPossible &&
               input[candidatePos + matchLength] === input[currentPos + matchLength]) {
          ++matchLength;
        }

        // Keep best match
        if (matchLength >= this.minMatchLength && matchLength > bestLength) {
          bestOffset = currentPos - candidatePos;
          bestLength = matchLength;
        }
      }

      return { offset: bestOffset, length: bestLength, literalCount: literalCount };
    }

    _encodeZeroRun(output, runLength) {
      // LZO-RLE format: opcode 0x11, distance 0xBFFF, then X byte
      // Run length = Shl8(X, 3) + 4, so X = Shr8(runLength - 4, 3)
      //
      // This is a floor/truncating division: Shr8(runLength - 4, 3) discards
      // the remainder whenever (runLength - 4) isn't a multiple of 8, so
      // runLength values like 5, 6 or 13 cannot be represented exactly by
      // a single X byte. Previously the caller advanced pos by the full,
      // un-quantized runLength while only the floored value was actually
      // encoded, silently dropping the remainder bytes from the stream.
      // Returning the exact number of bytes represented (<= runLength)
      // lets the caller advance correctly and pick up any remainder on
      // the next iteration.
      const X = OpCodes.And8(OpCodes.Shr8(runLength - 4, 3), 0xFF);
      const encodedLength = OpCodes.Shl8(X, 3) + 4;
      output.push(0x11, 0xFF, 0xBF, X);
      return encodedLength;
    }

    _encodeLiterals(output, input, startPos, count) {
      if (count === 0) return;

      // Opcode 0x00-0x0F for literal count
      if (count <= 15) {
        output.push(count);
      } else {
        output.push(0x00);
        // Extended length: chain of 255-continuation bytes (not a single
        // byte) so runs longer than 15+255=270 bytes don't wrap silently.
        let rem = count - 15;
        while (rem >= 255) {
          output.push(255);
          rem -= 255;
        }
        output.push(OpCodes.And8(rem, 0xFF));
      }

      // Copy literal bytes
      for (let i = 0; i < count; ++i) {
        output.push(input[startPos + i]);
      }
    }

    _encodeMatch(output, offset, length) {
      // Simplified match encoding using opcode 0x10-0x1F
      // Opcode: 0x1L where L = min(length - 3, 15)
      // Followed by 16-bit big-endian offset, then (if L saturated at 15)
      // a chain of 255-continuation extension bytes for the remainder.
      //
      // Previously lengthCode was clamped to 15 (max representable) but
      // pos was advanced by the full, unclamped match length - any bytes
      // beyond what a single opcode nibble could express were matched
      // during compression but never actually written to the output at
      // all, silently truncating the compressed stream.

      const rawLenField = length - this.minMatchLength;
      const lengthCode = Math.min(rawLenField, 15);
      output.push(OpCodes.Or8(0x10, lengthCode));

      // Big-endian offset
      const [high, low] = OpCodes.Unpack16BE(offset);
      output.push(high, low);

      if (lengthCode === 15) {
        let rem = rawLenField - 15;
        while (rem >= 255) {
          output.push(255);
          rem -= 255;
        }
        output.push(OpCodes.And8(rem, 0xFF));
      }
    }

  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZRLECompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZRLECompression, LZRLEInstance };
}));
