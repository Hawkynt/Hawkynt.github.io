/*
 * Fletcher Checksum Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Fletcher checksum algorithm family providing better error detection than simple checksums.
 * Uses two running sums with different weights to detect errors.
 * Supports 8, 16, 32, and 64-bit variants for different applications.
 */

// Load AlgorithmFramework (REQUIRED)

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
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize, BlockAbsorber } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * Fletcher checksum, one registered algorithm per word width
   * @class
   * @extends {Algorithm}
   */
  class FletcherAlgorithm extends Algorithm {
    /**
     * Configure one Fletcher variant
     * @param {string} [variant='32'] - '8', '16', '32' or '64' (anything else is configured as Fletcher-32)
     */
    constructor(variant = '32') {
      super();

      /** @type {string} What the variant is used for */
      this.variantDescription = '';
      /** @type {int32} Bytes per input word (little-endian) */
      this.wordBytes = 0;
      /** @type {int32} Bits per running sum */
      this.sumBits = 0;
      /** @type {uint32} Modulus of both running sums (2^sumBits - 1) */
      this.modulo = 0;
      /** @type {int32} Bytes in the checksum */
      this.resultBytes = 0;

      switch (variant) {
        case '8':
          this.variantDescription = 'Fletcher-8 checksum for small data integrity checking in embedded systems';
          this.wordBytes = 1;
          this.sumBits = 4;
          this.modulo = 15;        // 2^4 - 1
          this.resultBytes = 1;
          this.complexity = ComplexityType.BEGINNER;
          this.tests = [
            new TestCase(
              [],
              OpCodes.Hex8ToBytes("00"),
              "Empty string",
              "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("a"),
              OpCodes.Hex8ToBytes("77"),
              "Single byte 'a'",
              "Educational test vector"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abc"),
              OpCodes.Hex8ToBytes("19"),
              "String 'abc'",
              "Educational test vector"
            )
          ];
          break;
        case '16':
          this.variantDescription = 'Fletcher-16 checksum used in network protocols and data transmission';
          this.wordBytes = 1;
          this.sumBits = 8;
          this.modulo = 255;       // 2^8 - 1
          this.resultBytes = 2;
          this.complexity = ComplexityType.BEGINNER;
          this.tests = [
            new TestCase(
              [],
              OpCodes.Hex8ToBytes("0000"),
              "Empty string",
              "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("a"),
              OpCodes.Hex8ToBytes("6161"),
              "Single byte 'a'", 
              "Educational test vector"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abcde"),
              OpCodes.Hex8ToBytes("c8f0"),
              "String 'abcde'",
              "Educational test vector"
            )
          ];
          break;
        case '64':
          this.variantDescription = 'Fletcher-64 checksum for large datasets and high-performance applications';
          this.wordBytes = 4;
          this.sumBits = 32;
          this.modulo = 4294967295; // 2^32 - 1
          this.resultBytes = 8;
          this.complexity = ComplexityType.INTERMEDIATE;
          this.tests = [
            new TestCase(
              [],
              OpCodes.Hex8ToBytes("0000000000000000"),
              "Empty string",
              "Educational test vector"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abcde"),
              OpCodes.Hex8ToBytes("c8c6c527646362c6"),
              "String 'abcde' - published test vector, last 32-bit word zero-padded",
              "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abcdef"),
              OpCodes.Hex8ToBytes("c8c72b276463c8c6"),
              "String 'abcdef' - published test vector",
              "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abcdefgh"),
              OpCodes.Hex8ToBytes("312e2b28cccac8c6"),
              "String 'abcdefgh' - published test vector, exact multiple of the 32-bit word",
              "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
            )
          ];
          break;
        default: // '32'
          this.variantDescription = 'Fletcher-32 checksum providing robust error detection for medium-sized data';
          this.wordBytes = 2;
          this.sumBits = 16;
          this.modulo = 65535;     // 2^16 - 1
          this.resultBytes = 4;
          this.complexity = ComplexityType.BEGINNER;
          this.tests = [
            new TestCase(
              [],
              OpCodes.Hex8ToBytes("00000000"),
              "Empty string",
              "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("a"),
              OpCodes.Hex8ToBytes("00610061"),
              "Single byte 'a'",
              "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abcde"),
              OpCodes.Hex8ToBytes("f04fc729"),
              "String 'abcde' - published test vector, odd length so the last word is zero-padded",
              "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abcdef"),
              OpCodes.Hex8ToBytes("56502d2a"),
              "String 'abcdef' - published test vector, exact multiple of the 16-bit word",
              "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abcdefgh"),
              OpCodes.Hex8ToBytes("ebe19591"),
              "String 'abcdefgh' - published test vector",
              "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
            )
          ];
          break;
      }

      // Required metadata
      this.name = 'Fletcher-' + variant;
      this.description = this.variantDescription + ' Uses two ' + this.sumBits + '-bit running sums with modulo ' + this.modulo + ' for enhanced error detection.';
      this.inventor = "John G. Fletcher";
      this.year = 1982;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Simple Checksum";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Fletcher's checksum", "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"),
        new LinkItem("RFC 1146 - TCP Alternative Checksum Options", "https://tools.ietf.org/rfc/rfc1146.txt"),
        new LinkItem("Original Fletcher Paper", "https://ieeexplore.ieee.org/document/1094155")
      ];

      this.references = [
        new LinkItem("Linux Kernel Fletcher Implementation", "https://github.com/torvalds/linux/blob/master/lib/checksum.c"),
        new LinkItem("BSD Socket Implementation", "https://github.com/freebsd/freebsd-src/blob/main/sys/netinet/in_cksum.c"),
        new LinkItem("Fletcher Checksum Analysis", "https://www.zlib.net/tech_report_96.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Not Cryptographically Secure", 
          "Use cryptographic hash functions (SHA-256, SHA-3) for security purposes"
        ),
        new Vulnerability(
          "Collision Vulnerability", 
          "Use for error detection only, not for data integrity in security contexts"
        )
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {FletcherInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new FletcherInstance(this);
    }
  }

  /**
 * Fletcher instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class FletcherInstance extends IAlgorithmInstance {
    /**
     * Copy the variant parameters and start with both sums at zero
     * @param {FletcherAlgorithm} algorithm - Parent algorithm (the variant)
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {int32} Bytes per input word */
      this.wordBytes = algorithm.wordBytes;
      /** @type {uint32} Modulus of both running sums */
      this.modulo = algorithm.modulo;
      /** @type {int32} Bytes in the checksum */
      this.resultBytes = algorithm.resultBytes;
      // Both running sums stay below the modulus
      /** @type {uint32} */
      this.sum1 = 0;
      /** @type {uint32} */
      this.sum2 = 0;
      // Fletcher-N consumes N/2-bit words, not bytes: Fletcher-32 reads 16-bit
      // words and Fletcher-64 reads 32-bit words, both little-endian. The
      // absorber holds a partial word back so a message whose length is not a
      // whole number of words still gets exactly one zero-padded tail word.
      /** @type {BlockAbsorber} */
      this._absorber = new BlockAbsorber(this.wordBytes, word => this._absorbWord(word));
    }

    /**
   * Fold one little-endian word of wordBytes bytes into the two sums.
   * @param {uint8[]} word - exactly wordBytes bytes
   * @returns {void}
   */
    _absorbWord(word) {
      /** @type {uint32} */
      let value = 0;
      for (let i = word.length - 1; i >= 0; i--) value = OpCodes.Or32(OpCodes.Shl32(value, 8), word[i]);
      this.sum1 = this._addMod(this.sum1, value);
      this.sum2 = this._addMod(this.sum2, this.sum1);
    }

    /**
     * (a + b) mod modulo, exact without leaving 32 bits: a plus a 32-bit word
     * (Fletcher-64) would need 33 bits before it is reduced.
     * @param {uint32} a - Running sum, below modulo
     * @param {uint32} b - Value to add
     * @returns {uint32} Sum reduced below modulo
     */
    _addMod(a, b) {
      const r = b % this.modulo;
      const room = OpCodes.Sub32(this.modulo, a);
      if (r >= room) return OpCodes.Sub32(r, room);
      return OpCodes.Add32(a, r);
    }

    /**
     * Absorb the final partial word, zero-padded
     * @param {uint8[]} held - Bytes held back by the absorber
     * @param {int32} pending - Number of valid bytes in held
     * @returns {void}
     */
    _absorbTail(held, pending) {
      if (pending === 0) return;
      const word = held.slice();
      while (word.length < this.wordBytes) word.push(0);
      this._absorbWord(word);
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If the input is not an array
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('FletcherInstance.Feed: Input must be byte array');
      }

      this._absorber.Absorb(data);
    }

    /**
   * Get the checksum of everything fed so far and reset for the next message
   * @returns {uint8[]} Checksum bytes, big-endian (sum2 before sum1)
   */

    Result() {
      // The final word, zero-padded when the message does not fill it.
      this._absorber.Finish((held, pending, total) => this._absorbTail(held, pending));

      /** @type {uint8[]} */
      let result = null;

      // Generate result based on variant bit width
      switch (this.resultBytes) {
        case 1: // Fletcher-8
          result = OpCodes.Unpack16BE(OpCodes.Or32(OpCodes.Shl32(this.sum2, 4), this.sum1)).slice(1);
          break;

        case 2: // Fletcher-16 - use OpCodes for byte extraction
          result = OpCodes.Unpack16BE(OpCodes.Or32(OpCodes.Shl32(this.sum2, 8), this.sum1));
          break;

        case 4: // Fletcher-32
          result = OpCodes.Unpack32BE(OpCodes.Or32(OpCodes.Shl32(this.sum2, 16), this.sum1));
          break;

        case 8: // Fletcher-64
          // Handle 64-bit result as two 32-bit parts - use OpCodes
          result = OpCodes.Unpack32BE(OpCodes.ToUint32(this.sum2)).concat(OpCodes.Unpack32BE(OpCodes.ToUint32(this.sum1)));
          break;

        default:
          throw new Error('Unsupported Fletcher result size: ' + this.resultBytes + ' bytes');
      }

      // Reset for next calculation
      this.sum1 = 0;
      this.sum2 = 0;
      this._absorber.Reset();

      return result;
    }
  }

  // Register all Fletcher variants
  RegisterAlgorithm(new FletcherAlgorithm('8'));
  RegisterAlgorithm(new FletcherAlgorithm('16'));
  RegisterAlgorithm(new FletcherAlgorithm('32'));
  RegisterAlgorithm(new FletcherAlgorithm('64'));

  // ===== REGISTRATION =====

    const algorithmInstance = new FletcherAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FletcherAlgorithm, FletcherInstance };
}));
