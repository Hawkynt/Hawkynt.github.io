/*
 * LZW (Lempel-Ziv-Welch) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Dictionary-based compression algorithm developed by Terry Welch in 1984.
 * Used in GIF images, TIFF files, and early Unix compress utility.
 * Builds dictionary dynamically during compression/decompression.
 *
 * Wire format (matches CompressionWorkbench's BB_Lzw building block): a pure
 * variable-width LZW bitstream, no length header or other framing. Codes are
 * packed LSB-first (the first bit written for a code occupies bit 0 of the
 * current output byte). Code width starts at 9 bits and grows up to 16 bits
 * as the dictionary fills. Code 256 is a clear code (dictionary/width reset),
 * code 257 is a stop code (end of stream); new dictionary entries start at
 * 258. Encoding uses the classic greedy ("first match") strategy: the
 * encoder's own lookup trie is populated eagerly on every miss, while the
 * decoder-visible next-code counter (which drives the bit-width growth) only
 * advances starting from the second emitted code after each reset - the
 * usual LZW asymmetry where the very first code after a reset adds no new
 * dictionary entry.
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

  // ===== ALGORITHM PARAMETERS (fixed to match CompressionWorkbench's BB_Lzw) =====

  const MIN_BITS = 9;
  const MAX_BITS = 16;
  const CLEAR_CODE = OpCodes.Shl32(1, MIN_BITS - 1);  // 256
  const STOP_CODE = CLEAR_CODE + 1;                    // 257
  const FIRST_USABLE_CODE = CLEAR_CODE + 2;            // 258
  const MAX_CODE = OpCodes.Shl32(1, MAX_BITS);         // 65536

  // ===== BIT STREAM HELPERS (LSB-first) =====

  class LzwBitWriter {
    constructor() {
      this.bytes = [];
      this.buf = 0;
      this.nBits = 0;
    }

    writeBits(value, width) {
      this.buf = OpCodes.ToUint32(OpCodes.OrN(this.buf, OpCodes.Shl32(value, this.nBits)));
      this.nBits += width;
      while (this.nBits >= 8) {
        this.bytes.push(OpCodes.AndN(this.buf, 0xFF));
        this.buf = OpCodes.Shr32(this.buf, 8);
        this.nBits -= 8;
      }
    }

    flush() {
      if (this.nBits > 0) {
        this.bytes.push(OpCodes.AndN(this.buf, 0xFF));
        this.buf = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class LzwBitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.pos = 0;
      this.buf = 0;
      this.nBits = 0;
    }

    readBits(width) {
      while (this.nBits < width) {
        if (this.pos >= this.bytes.length) throw new Error('LZW: unexpected end of stream');
        this.buf = OpCodes.ToUint32(OpCodes.OrN(this.buf, OpCodes.Shl32(this.bytes[this.pos++], this.nBits)));
        this.nBits += 8;
      }
      const mask = OpCodes.ToUint32(OpCodes.Shl32(1, width) - 1);
      const value = OpCodes.AndN(this.buf, mask);
      this.buf = OpCodes.Shr32(this.buf, width);
      this.nBits -= width;
      return value;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * LZWCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class LZWCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZW (Lempel-Ziv-Welch)";
        this.description = "Dictionary-based compression algorithm that builds a table of frequently occurring strings, starting from a dictionary of all single bytes and adding new patterns dynamically. Emits a pure variable-width (9-16 bit) LZW bitstream, LSB-first packed, with clear and stop codes and no length header - matching CompressionWorkbench's BB_Lzw building block. Used in GIF/TIFF formats.";
        this.inventor = "Terry Welch";
        this.year = 1984;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem("A Technique for High-Performance Data Compression", "https://ieeexplore.ieee.org/document/1659158"),
          new LinkItem("LZW - Wikipedia", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch"),
          new LinkItem("GIF Format Specification", "https://www.w3.org/Graphics/GIF/spec-gif89a.txt")
        ];

        this.references = [
          new LinkItem("Original IEEE Paper by Terry Welch", "https://ieeexplore.ieee.org/document/1659158"),
          new LinkItem("TIFF LZW Reference", "https://github.com/vadimkantorov/pytiff"),
          new LinkItem("Educational LZW Implementation", "https://rosettacode.org/wiki/LZW_compression")
        ];

        // Test vectors - byte-exact against CompressionWorkbench's BB_Lzw building
        // block (minBits=9, maxBits=16, clear+stop codes, LSB-first bit packing,
        // no length header). Expected vectors are given as hex.
        this.tests = [
          new TestCase(
            [],
            OpCodes.Hex8ToBytes("000302"),
            "Empty input - still emits clear code and stop code",
            "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch"
          ),
          new TestCase(
            OpCodes.AsciiToBytes("A"),
            OpCodes.Hex8ToBytes("00830404"),
            "Single byte - no dictionary matches possible",
            "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch"
          ),
          new TestCase(
            OpCodes.AsciiToBytes("ABABABABAB"),
            OpCodes.Hex8ToBytes("008308114870a09080"),
            "Repeated two-character pattern - Wikipedia example",
            "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch"
          ),
          new TestCase(
            OpCodes.AsciiToBytes("TOBEORNOTTOBEORTOBEORNOT"),
            OpCodes.Hex8ToBytes("00a93c1152e48914274fa80824687061c183090302"),
            "Classic Shakespeare-inspired LZW test string - Wikipedia",
            "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch"
          ),
          new TestCase(
            OpCodes.AsciiToBytes("AAAAAAAAAA"),
            OpCodes.Hex8ToBytes("0083081c483020"),
            "Maximum redundancy test (all identical characters)",
            "Edge case - maximum compression ratio"
          ),
          new TestCase(
            (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = i; return b; })(),
            OpCodes.Hex8ToBytes("00010410308040010307102450b0804103070f204490308142050b173064d0b08143070f1f40841031824409132750a450b182450b172f60c4903183460d1b3770e4d0b183470f1f3f800411328448112347902451b2844913274fa0449132854a152b57b064d1b2854b172f5fc0841133864c193367d0a451b3864d1b376fe0c49133874e1d3b77f0e4d1b3874f1f3f7f000512348850214387102552b4885123478f204592348952254b973065d2b48953274f9f408512358a542953a750a552b58a552b57af60c592358b562d5bb770e5d2b58b572f5fbf800513368c583163c7902553b68c593367cfa04593368d5a356bd7b065d3b68d5b376fdfc08513378e5c3973e7d0a553b78e5d3b77efe0c593378f5e3d7bf7f0e5d3b78f5f3f7fff0404"),
            "All 256 byte values 0..255 once each - no repetition",
            "Edge case - minimal compression benefit"
          )
        ];
      }

      CreateInstance(isInverse = false) {
        return new LZWCompressionInstance(this, isInverse);
      }
    }

    class LZWCompressionInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }


      Result() {
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) return [];
          return this._decompress();
        }

        return this._compress();
      }

      // ----- Compression: greedy ("first match") variable-width LZW -----
      //
      // Mirrors LzwEncoder.EncodeFirstMatch: a lookup trie is populated
      // eagerly on every miss (trieNextCode), while a second counter
      // (decoderNextCode) mirrors the decoder's own dictionary growth so the
      // encoder emits codes at exactly the width the decoder expects. The
      // decoder only grows its dictionary starting with the second emitted
      // code after a reset (hasPrevious) - the classic LZW asymmetry where
      // the very first code after a clear carries no new entry.

      _compress() {
        try {
          const input = this.inputBuffer.slice();
          this.inputBuffer = [];

          const writer = new LzwBitWriter();
          let currentBits = MIN_BITS;

          writer.writeBits(CLEAR_CODE, currentBits);

          if (input.length === 0) {
            writer.writeBits(STOP_CODE, currentBits);
            return writer.flush();
          }

          let trieNextCode = FIRST_USABLE_CODE;
          let decoderNextCode = FIRST_USABLE_CODE;
          let hasPrevious = false;
          let trie = new Map();

          let currentCode = input[0];
          let i = 1;

          while (i < input.length) {
            const nextByte = input[i];
            const key = currentCode + ':' + nextByte;

            if (trie.has(key)) {
              currentCode = trie.get(key);
              i++;
              continue;
            }

            writer.writeBits(currentCode, currentBits);

            // Always add a trie entry for future lookups (if room).
            if (trieNextCode < MAX_CODE) {
              trie.set(key, trieNextCode);
              trieNextCode++;
            }

            // Mirror the decoder's nextCode: it only grows starting with the
            // second emitted code after a reset.
            if (hasPrevious) {
              if (decoderNextCode < MAX_CODE) {
                decoderNextCode++;
                if (decoderNextCode >= OpCodes.Shl32(1, currentBits) && currentBits < MAX_BITS)
                  currentBits++;
              } else {
                // Dictionary is full: reset before processing the byte that
                // triggered this miss.
                writer.writeBits(CLEAR_CODE, currentBits);
                trie = new Map();
                currentBits = MIN_BITS;
                trieNextCode = FIRST_USABLE_CODE;
                decoderNextCode = FIRST_USABLE_CODE;
                hasPrevious = false;
                currentCode = nextByte;
                i++;
                continue;
              }
            }

            hasPrevious = true;
            currentCode = nextByte;
            i++;
          }

          writer.writeBits(currentCode, currentBits);

          // The decoder adds one more entry after the final data code.
          if (hasPrevious && decoderNextCode < MAX_CODE) {
            decoderNextCode++;
            if (decoderNextCode >= OpCodes.Shl32(1, currentBits) && currentBits < MAX_BITS)
              currentBits++;
          }

          writer.writeBits(STOP_CODE, currentBits);

          return writer.flush();
        } catch (e) {
          this.inputBuffer = [];
          return [];
        }
      }

      // ----- Decompression: mirrors LzwDecoder.Decode -----

      _decompress() {
        try {
          const input = this.inputBuffer.slice();
          this.inputBuffer = [];

          const reader = new LzwBitReader(input);
          let currentBits = MIN_BITS;
          let nextCode = FIRST_USABLE_CODE;
          let dictionary = this._initDictionary();
          let previousEntry = null;
          const output = [];

          for (;;) {
            let code;
            try {
              code = reader.readBits(currentBits);
            } catch (e) {
              break;
            }

            if (code === CLEAR_CODE) {
              dictionary = this._initDictionary();
              currentBits = MIN_BITS;
              nextCode = FIRST_USABLE_CODE;
              previousEntry = null;
              continue;
            }

            if (code === STOP_CODE) break;

            let entry;
            if (code < dictionary.length) {
              entry = dictionary[code];
            } else if (code === nextCode && previousEntry !== null) {
              // KwKwK case: the new entry is previousEntry + previousEntry[0].
              entry = previousEntry.concat([previousEntry[0]]);
            } else {
              throw new Error('Invalid LZW code sequence');
            }

            for (let j = 0; j < entry.length; j++) output.push(entry[j]);

            // Add new dictionary entry: previousEntry + entry[0] (not on the
            // first code after a reset, since previousEntry is null then).
            if (previousEntry !== null && nextCode < MAX_CODE) {
              const newEntry = previousEntry.concat([entry[0]]);
              dictionary.push(newEntry);
              nextCode++;

              if (nextCode >= OpCodes.Shl32(1, currentBits) && currentBits < MAX_BITS)
                currentBits++;
            }

            previousEntry = entry;
          }

          return output;
        } catch (e) {
          this.inputBuffer = [];
          return [];
        }
      }

      _initDictionary() {
        const dictionary = [];
        for (let i = 0; i < CLEAR_CODE; i++) dictionary.push([i]);
        dictionary.push([]); // clear code placeholder (index 256)
        dictionary.push([]); // stop code placeholder (index 257)
        return dictionary;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new LZWCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZWCompression, LZWCompressionInstance };
}));
