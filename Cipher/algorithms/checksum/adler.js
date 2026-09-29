/*
 * Adler Checksum Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Adler checksum algorithm family providing fast error detection for data integrity.
 * Similar to Fletcher but with different modular arithmetic optimized for speed.
 * Widely used in compression algorithms like zlib and gzip.
 * Supports 16, 32, and 64-bit variants for different applications.
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
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * Adler checksum, one registered algorithm per sum width
   * @class
   * @extends {Algorithm}
   */
  class AdlerAlgorithm extends Algorithm {
    /**
     * Configure one Adler variant
     * @param {string} [variant='32'] - '16', '32' or '64' (anything else is configured as Adler-32)
     */
    constructor(variant = '32') {
      super();

      /** @type {string} What the variant is used for */
      this.variantDescription = '';
      /** @type {int32} Bits per running sum */
      this.sumBits = 0;
      /** @type {uint32} Modulus of both running sums (largest prime below 2^sumBits) */
      this.modulo = 0;
      /** @type {uint32} Starting value of sum1 */
      this.base = 1;
      /** @type {int32} Bytes in the checksum */
      this.resultBytes = 0;

      switch (variant) {
        case '16':
          this.variantDescription = 'Adler-16 checksum for lightweight error detection in embedded systems';
          this.sumBits = 8;
          this.modulo = 251;         // Largest prime less than 2^8
          this.base = 1;             // Starting value for sum1
          this.resultBytes = 2;
          this.complexity = ComplexityType.BEGINNER;
          this.tests = [
            new TestCase(
              [],
              [0x00, 0x01],
              "Empty string",
              "RFC 1950 style - empty gives base value"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("a"),
              [0x62, 0x62],
              "Single byte 'a'",
              "Educational test vector"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abc"),
              [0x57, 0x2C],
              "String 'abc'",
              "Educational test vector"
            )
          ];
          break;
        case '64':
          this.variantDescription = 'Adler-64 checksum for high-performance applications and large datasets';
          this.sumBits = 32;
          this.modulo = 4294967291;  // Largest prime less than 2^32
          this.base = 1;             // Starting value for sum1
          this.resultBytes = 8;
          this.complexity = ComplexityType.INTERMEDIATE;
          this.tests = [
            new TestCase(
              [],
              [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01],
              "Empty string",
              "Educational test vector"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("a"),
              [0x00, 0x00, 0x00, 0x62, 0x00, 0x00, 0x00, 0x62],
              "Single byte 'a'",
              "Educational test vector"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("large data integrity verification"),
              [0x00, 0x00, 0xD6, 0x56, 0x00, 0x00, 0x0C, 0xE8],
              "Large data sample",
              "Educational test vector"
            )
          ];
          break;
        default: // '32'
          this.variantDescription = 'Adler-32 checksum used in zlib, gzip and other compression formats';
          this.sumBits = 16;
          this.modulo = 65521;       // Largest prime less than 2^16 (65536)
          this.base = 1;             // Starting value for sum1
          this.resultBytes = 4;
          this.complexity = ComplexityType.BEGINNER;
          this.tests = [
            new TestCase(
              [],
              [0x00, 0x00, 0x00, 0x01],
              "Empty string",
              "RFC 1950 - empty string gives 1"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("a"),
              [0x00, 0x62, 0x00, 0x62],
              "Single byte 'a'",
              "RFC 1950 test vector"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abc"),
              [0x02, 0x4D, 0x01, 0x27],
              "String 'abc'",
              "RFC 1950 test vector"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("message digest"),
              [0x29, 0x75, 0x05, 0x86],
              "String 'message digest'",
              "Educational test vector"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
              [0x90, 0x86, 0x0B, 0x20],
              "Alphabet string",
              "Educational test vector"
            )
          ];
          break;
      }

      // Required metadata
      this.name = 'Adler-' + variant;
      this.description = this.variantDescription + ' Uses two ' + this.sumBits + '-bit running sums with modulo ' + this.modulo + ' for fast error detection.';
      this.inventor = "Mark Adler";
      this.year = 1995;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Simple Checksum";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 1950 - ZLIB Compressed Data Format", "https://tools.ietf.org/rfc/rfc1950.txt"),
        new LinkItem("Adler-32 Algorithm Description", "https://en.wikipedia.org/wiki/Adler-32"),
        new LinkItem("zlib Library Documentation", "https://zlib.net/manual.html")
      ];

      this.references = [
        new LinkItem("zlib Source Code", "https://github.com/madler/zlib"),
        new LinkItem("Adler-32 in Compression", "https://tools.ietf.org/rfc/rfc1951.txt"),
        new LinkItem("Performance Analysis", "https://create.stephan-brumme.com/crc32/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Not Cryptographically Secure", 
          "Use cryptographic hash functions (SHA-256, SHA-3) for security purposes"
        ),
        new Vulnerability(
          "Weak for Short Messages", 
          "Adler checksums can have poor distribution for very short inputs"
        ),
        new Vulnerability(
          "Zero Byte Weakness", 
          "Sequences of zero bytes can produce predictable patterns"
        )
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {AdlerInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new AdlerInstance(this);
    }
  }

  /**
   * Adler instance implementing the Feed/Result pattern
   * @class
   * @extends {IAlgorithmInstance}
   */
  class AdlerInstance extends IAlgorithmInstance {
    /**
     * Create a new Adler instance
     * @param {AdlerAlgorithm} algorithm - Parent algorithm (the variant)
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint32} Modulus of both running sums */
      this.modulo = algorithm.modulo;
      /** @type {uint32} Starting value of sum1 */
      this.base = algorithm.base;
      /** @type {int32} Bytes in the checksum */
      this.resultBytes = algorithm.resultBytes;
      /** @type {uint32} */
      this.a = this.base;  // sum1 - starts at base value (usually 1)
      /** @type {uint32} */
      this.b = 0;          // sum2 - starts at 0
    }

    /**
     * (x + y) mod modulo, exact without leaving 32 bits: a sum plus a
     * byte or another sum (Adler-64) would need 33 bits before it is reduced.
     * @param {uint32} x - Running sum, below modulo
     * @param {uint32} y - Value to add
     * @returns {uint32} Sum reduced below modulo
     */
    _addMod(x, y) {
      const r = y % this.modulo;
      const room = OpCodes.Sub32(this.modulo, x);
      if (r >= room) return OpCodes.Sub32(r, room);
      return OpCodes.Add32(x, r);
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If the input is not an array
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('AdlerInstance.Feed: Input must be byte array');
      }

      // Adler checksum algorithm:
      // a = 1 + D1 + D2 + ... + Dn (mod 65521)
      // b = (1 + D1) + (1 + D1 + D2) + ... + (1 + D1 + D2 + ... + Dn) (mod 65521)
      // where D1, D2, ..., Dn are the data bytes

      for (let i = 0; i < data.length; i++) {
        this.a = this._addMod(this.a, data[i]);
        this.b = this._addMod(this.b, this.a);
      }
    }

    /**
   * Get the checksum of everything fed so far and reset for the next message
   * @returns {uint8[]} Checksum bytes, big-endian (sum2 before sum1)
   */

    Result() {
      /** @type {uint8[]} */
      let result = null;

      // Generate result based on variant bit width
      switch (this.resultBytes) {
        case 2: // Adler-16
          result = OpCodes.Unpack16BE(OpCodes.Or32(OpCodes.Shl32(this.b, 8), this.a));
          break;

        case 4: // Adler-32
          result = OpCodes.Unpack32BE(OpCodes.Or32(OpCodes.Shl32(this.b, 16), this.a));
          break;

        case 8: // Adler-64
          // Handle 64-bit result as two 32-bit parts
          result = OpCodes.Unpack32BE(this.b).concat(OpCodes.Unpack32BE(this.a));
          break;

        default:
          throw new Error('Unsupported Adler result size: ' + this.resultBytes + ' bytes');
      }

      // Reset for next calculation
      this.a = this.base;
      this.b = 0;

      return result;
    }
  }

  // Register all Adler variants
  RegisterAlgorithm(new AdlerAlgorithm('16'));
  RegisterAlgorithm(new AdlerAlgorithm('32'));
  RegisterAlgorithm(new AdlerAlgorithm('64'));

  // ===== REGISTRATION =====

    const algorithmInstance = new AdlerAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AdlerAlgorithm, AdlerInstance };
}));
