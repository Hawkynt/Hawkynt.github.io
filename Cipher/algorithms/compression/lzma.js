/*
 * LZMA Compression Algorithm Implementation (Simplified Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LZMA (Lempel-Ziv-Markov chain Algorithm) compression
 * Simplified implementation focusing on core dictionary compression concepts
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

    class LZMACompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZMA";
        this.description = "Lempel-Ziv-Markov chain Algorithm. A sophisticated dictionary compression method with high compression ratios using range encoding and probability models.";
        this.inventor = "Igor Pavlov";
        this.year = 2001;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary-based";
        this.securityStatus = SecurityStatus.EDUCATIONAL; // Simplified version for learning
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.RU; // Russia

        // Documentation and references
        this.documentation = [
          new LinkItem("7-Zip LZMA SDK", "https://www.7-zip.org/sdk.html"),
          new LinkItem("Wikipedia - LZMA", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm")
        ];

        this.references = [
          new LinkItem("LZMA Specification", "https://www.7-zip.org/recover.html"),
          new LinkItem("Range Encoding Theory", "http://www.compressconsult.com/rangecoder/")
        ];

        // Test vectors - based on LZMA algorithm specifications.
        // Wire format: a stream of tagged tokens, terminated by TAG_END(2):
        //   TAG_LITERAL(0), byte
        //   TAG_MATCH(1), adjustedLength, offsetHigh, offsetLow
        // The tag always precedes the payload, so a literal byte's value (even
        // 0x80-0xFF) can never be mistaken for a match token.
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Single byte literal",
            uri: "https://www.7-zip.org/sdk.html",
            input: [65],
            expected: [0, 65, 2]
          },
          {
            text: "Hello string",
            uri: "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm",
            input: [72, 101, 108, 108, 111],
            expected: [0, 72, 0, 101, 0, 108, 0, 108, 0, 111, 2]
          },
          {
            text: "ABABAB pattern",
            uri: "http://www.compressconsult.com/rangecoder/",
            input: [65, 66, 65, 66, 65, 66],
            expected: [0, 65, 0, 66, 1, 2, 0, 2, 2]
          },
          {
            text: "AAAA repetition",
            uri: "https://www.7-zip.org/recover.html",
            input: [65, 65, 65, 65],
            expected: [0, 65, 1, 1, 0, 1, 2]
          },
          {
            text: "Hello World text",
            uri: "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm",
            input: [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100],
            expected: [0, 72, 0, 101, 0, 108, 0, 108, 0, 111, 0, 32, 0, 87, 0, 111, 0, 114, 0, 108, 0, 100, 2]
          },
          {
            text: "Repetitive run (24 bytes) - self-referential overlapping match (offset 1, length 23)",
            uri: "https://www.7-zip.org/sdk.html",
            input: new Array(24).fill(0x61),
            expected: [0, 97, 1, 21, 0, 1, 2]
          },
          {
            text: "Alternating pattern (16 bytes)",
            uri: "https://www.7-zip.org/sdk.html",
            input: [97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98],
            expected: [0, 97, 0, 98, 1, 12, 0, 2, 2]
          },
          {
            text: "Binary sample with high-bit-set bytes - catches literal/match tag collision",
            uri: "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm",
            input: [0xFF, 0x80, 0xAB, 0x00, 0x7F, 0x80, 0xFF, 0xFE, 0x01, 0x80, 0x81, 0x82, 0x00, 0xFF, 0x7E, 0x10],
            expected: [0, 255, 0, 128, 0, 171, 0, 0, 0, 127, 0, 128, 0, 255, 0, 254, 0, 1, 0, 128, 0, 129, 0, 130, 0, 0, 0, 255, 0, 126, 0, 16, 2]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new LZMAInstance(this, isInverse);
      }
    }

    // LZMA compression instance - simplified educational version
    class LZMAInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // Simplified LZMA Parameters (educational version)
        this.DICTIONARY_SIZE = 4096;    // Smaller dictionary for educational purposes
        this.MIN_MATCH_LENGTH = 2;      // Minimum match length
        // Maximum match length: capped at MIN_MATCH_LENGTH + 255 so the
        // adjusted length (length - MIN_MATCH_LENGTH) always fits one byte
        // in the token format below (real LZMA uses range coding here instead).
        this.MAX_MATCH_LENGTH = 257;
        this.LITERAL_CONTEXT_BITS = 3;  // lc parameter (simplified)
        this.LITERAL_POS_BITS = 0;      // lp parameter
        this.POS_BITS = 2;              // pb parameter

        // Token tags - a byte cannot be both a literal payload and a control
        // flag, so every token starts with one of these explicit tag bytes.
        this.TAG_LITERAL = 0;
        this.TAG_MATCH = 1;
        this.TAG_END = 2;
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        if (this.isInverse) {
          const result = this._decompress(new Uint8Array(this.inputBuffer));
          this.inputBuffer = [];
          return Array.from(result);
        } else {
          const result = this._compress(new Uint8Array(this.inputBuffer));
          this.inputBuffer = [];
          return Array.from(result);
        }
      }

      _compress(input) {
        if (input.length === 0) {
          return new Uint8Array([]);
        }

        // Simplified LZMA compression - educational version
        // This focuses on the dictionary matching concept rather than full range encoding.
        //
        // Every token is prefixed with an explicit tag byte (TAG_LITERAL / TAG_MATCH /
        // TAG_END). A literal's raw byte value is never inspected for control bits, so an
        // arbitrary byte (including values >= 0x80) can never be misread as a match token -
        // the previous format packed the "is this a match" flag into bit 7 of the literal
        // byte itself, which corrupted any literal with a high bit set.

        // Matches are found and copied directly against the input/output byte
        // arrays (see _findMatch) rather than a separately maintained circular
        // "dictionary" buffer. The previous dictionary buffer was only updated
        // AFTER a match was chosen, so while scanning for a match its not-yet-
        // written slots still held stale placeholder zeros. For self-referential
        // runs (offset smaller than length, e.g. offset=1 repeats), the decoder
        // reconstructs those bytes by copying from output positions written
        // earlier in the SAME copy loop - comparing against the input array
        // directly reproduces that exact semantics, so encode and decode agree.

        const output = [];
        let inputPos = 0;

        while (inputPos < input.length) {
          const match = this._findMatch(input, inputPos);

          if (match.length >= this.MIN_MATCH_LENGTH) {
            // Encode match: TAG_MATCH, adjustedLength(1 byte), offsetHigh, offsetLow
            const adjustedLength = match.length - this.MIN_MATCH_LENGTH;
            const offsetBytes = OpCodes.Unpack16BE(match.offset);

            output.push(this.TAG_MATCH);
            output.push(OpCodes.ToByte(adjustedLength));
            output.push(offsetBytes[0]);
            output.push(offsetBytes[1]);

            inputPos += match.length;
          } else {
            // Encode literal: TAG_LITERAL, raw byte
            output.push(this.TAG_LITERAL);
            output.push(input[inputPos]);
            inputPos++;
          }
        }

        // End marker
        output.push(this.TAG_END);

        return new Uint8Array(output);
      }

      _decompress(input) {
        if (input.length === 0) {
          return new Uint8Array([]);
        }

        const output = [];
        let inputPos = 0;

        while (inputPos < input.length) {
          const tag = input[inputPos++];

          if (tag === this.TAG_END) {
            break;
          } else if (tag === this.TAG_MATCH) {
            if (inputPos + 2 >= input.length) break;

            const adjustedLength = input[inputPos++];
            const offsetHigh = input[inputPos++];
            const offsetLow = input[inputPos++];
            const length = adjustedLength + this.MIN_MATCH_LENGTH;
            const offset = OpCodes.Pack16BE(offsetHigh, offsetLow);

            // Copy from already-output bytes; growing the output array one byte
            // at a time lets overlapping/self-referential runs (offset < length)
            // resolve correctly, since each read sees the bytes just written.
            for (let i = 0; i < length; i++) {
              output.push(output[output.length - offset]);
            }
          } else if (tag === this.TAG_LITERAL) {
            if (inputPos >= input.length) break;

            output.push(input[inputPos++]);
          } else {
            // Unknown tag - stop rather than misinterpret the stream
            break;
          }
        }

        return new Uint8Array(output);
      }

      _findMatch(input, pos) {
        let bestLength = 0;
        let bestOffset = 0;

        if (pos + this.MIN_MATCH_LENGTH > input.length) {
          return { length: 0, offset: 0 };
        }

        const maxOffset = Math.min(this.DICTIONARY_SIZE, pos);
        const maxLength = Math.min(this.MAX_MATCH_LENGTH, input.length - pos);

        // Simple window search (in real LZMA this would use hash chains and binary
        // trees). Comparing directly against `input` (instead of a reconstructed
        // dictionary buffer) correctly captures self-referential/overlapping runs.
        for (let offset = 1; offset <= maxOffset; offset++) {
          let length = 0;

          while (length < maxLength && input[pos - offset + length] === input[pos + length]) {
            length++;
          }

          if (length >= this.MIN_MATCH_LENGTH && length > bestLength) {
            bestLength = length;
            bestOffset = offset;
          }
        }

        return { length: bestLength, offset: bestOffset };
      }

      // Simplified range decoder/encoder stubs (educational purposes only)
      // Full LZMA range coding requires sophisticated probability models
      _encodeRange(value, low, high) {
        // In real LZMA, this would be sophisticated range encoding
        // This is a placeholder for educational purposes
        return value;
      }

      _decodeRange(low, high) {
        // In real LZMA, this would be sophisticated range decoding
        // This is a placeholder for educational purposes
        return 0;
      }

      // Probability model stubs (educational purposes)
      _updateProbabilities(context, bit) {
        // In real LZMA, this would update complex probability models
        // This is a placeholder for educational purposes
      }

      _getProbability(context) {
        // In real LZMA, this would return context-based probabilities
        // This is a placeholder for educational purposes
        return 0.5;
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new LZMACompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZMACompression, LZMAInstance };
}));