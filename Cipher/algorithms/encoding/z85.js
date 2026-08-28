/*
 * Z85 (ZeroMQ Base85) Encoding Implementation
 * Educational implementation of ZeroMQ's Z85 encoding
 * (c)2006-2025 Hawkynt
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

  class Z85Algorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Z85 (ZeroMQ Base85)";
      this.description = "Variant of Base85 encoding developed for ZeroMQ that provides more efficient binary-to-text encoding than Base64. Uses 85 printable ASCII characters and avoids problematic characters like quotes and backslashes. Educational implementation following ZeroMQ RFC 32. RFC 32 defines Z85 only for byte strings whose length is a multiple of 4 (its reference implementation rejects anything else); this implementation does the same rather than inventing a non-standard padding scheme, so any input whose length is not a multiple of 4 is rejected with a clear error instead of being silently padded.";
      this.inventor = "ZeroMQ Community";
      this.year = 2013;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Base Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL;

      // Z85 (RFC 32) operates on whole 4-byte blocks only; there is no
      // standard way to represent a non-multiple-of-4 length, so the round
      // trip suite should treat a clean rejection of such input as a
      // declared domain limit rather than a defect (see encode()/decode()).
      this.restrictedInputDomain = true;

      // Documentation and references
      this.documentation = [
        new LinkItem("ZeroMQ RFC 32: Z85 Encoding", "https://rfc.zeromq.org/spec/32/"),
        new LinkItem("Z85 Specification", "https://github.com/zeromq/rfc/blob/master/src/spec_32.c"),
        new LinkItem("Base85 Encoding Wikipedia", "https://en.wikipedia.org/wiki/Ascii85")
      ];

      this.references = [
        new LinkItem("ZeroMQ Protocol Documentation", "https://zeromq.org/"),
        new LinkItem("Base85 vs Base64 Comparison", "https://tools.ietf.org/html/rfc1924"),
        new LinkItem("Binary Encoding Standards", "https://www.iana.org/assignments/character-sets/character-sets.xhtml")
      ];

      this.knownVulnerabilities = [];

      // Test vectors from Z85 specification
      this.tests = [
        new TestCase(
          [],
          [],
          "Z85 empty data test",
          "https://rfc.zeromq.org/spec/32/"
        ),
        new TestCase(
          [0x00, 0x00, 0x00, 0x01], // Simple 4-byte test
          OpCodes.AnsiToBytes("00001"), // Should encode to 00001
          "Basic 4-byte encoding test - Z85",
          "ZeroMQ RFC 32"
        ),
        new TestCase(
          [0xFF, 0x00, 0x00, 0x00],
          OpCodes.AnsiToBytes("@@r30"),
          "High-bit-set leading byte regression test - signed-32-bit packing overflow",
          "ZeroMQ RFC 32"
        ),
        new TestCase(
          Array.from({length: 256}, (_, i) => i),
          OpCodes.AnsiToBytes("009c61o!#m2NH?C3>iWS5d]J*6CRx17-skh9337xar.{NbQB=+c[cR@eg&FcfFLssg=mfIi5%2YjuU>)kTv.7l}6Nnnj=ADoIFnTp/ga?r8($2sxO*itWpVyu$0IOwmYv=xLzi%y&a6dAb/]tBAI+JCZjQZE0{D[FpSr8GOteoH(41EJe-<UKDCY&L:dM3N3<zjOsMmzPRn9PQ[%@^ShV!$TGwUeU^7HuW6^uKXvGh.YUh4]Z})[9-kP:p:JqPF+*1CV^9Zp<!yAd4/Xb0k*$*&A&nJXQ<MkK!>&}x#)cTlf[Bu8v].4}L}1:^-@qDS{"),
          "All 256 byte values regression test (64 4-byte blocks) - exercises every packed value including high bit set",
          "ZeroMQ RFC 32"
        )
      ];

      // Z85 alphabet (85 characters)
      this.alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";

      this.decodeTable = null;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Z85Instance(this, isInverse);
    }

    init() {
      // Build decode lookup table
      this.decodeTable = {};
      for (let i = 0; i < this.alphabet.length; i++) {
        this.decodeTable[this.alphabet[i]] = i;
      }
    }
  }

  /**
 * Z85 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Z85Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.processedData = null;

      this.algorithm.init();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Z85Instance.Feed: Input must be byte array');
      }

      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it. A single chunk also cannot be converted on its
      // own, because the coder groups whole units of input and emits padding and
      // framing at the end of the message, so the bytes are collected here and
      // converted once, in Result().
      if (!this._feedBuffer) this._feedBuffer = [];
      for (let i = 0; i < data.length; i++) this._feedBuffer.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._feedBuffer) {
        throw new Error('Z85Instance.Result: No data processed. Call Feed() first.');
      }
      this.processedData = this.isInverse
        ? this.decode(this._feedBuffer)
        : this.encode(this._feedBuffer);
      return this.processedData;
    }

    encode(data) {
      if (data.length === 0) {
        return [];
      }

      // Z85 (ZeroMQ RFC 32) is only defined for byte strings whose length is
      // a multiple of 4 - the spec has no padding/length-prefix convention,
      // so silently zero-padding here (as this code used to do) is not a
      // safe stand-in: the padding count is lost and decode() hands back
      // more bytes than were fed in. Reject instead of mangling.
      if (data.length % 4 !== 0) {
        throw new Error(`Z85Instance.encode: input length ${data.length} is not a multiple of 4 (Z85/RFC 32 requires whole 4-byte blocks)`);
      }

      const result = [];

      for (let i = 0; i < data.length; i += 4) {
        // Pack 4 bytes into 32-bit value (big-endian). Must use the
        // unsigned Or32 (not OrN, which does signed 32-bit ToInt32
        // semantics on plain Numbers): once byte 0 is >= 0x80 the packed
        // value's top bit is set, and OrN would hand back a negative
        // Number, sending "temp % 85" into negative-index territory and
        // producing undefined alphabet lookups.
        const value = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(data[i], 24), OpCodes.Shl32(data[i + 1], 16)), OpCodes.Shl32(data[i + 2], 8)), data[i + 3]);

        // Convert to 5 base-85 characters
        let temp = value;
        const chars = [];
        for (let j = 0; j < 5; j++) {
          chars.unshift(this.algorithm.alphabet[temp % 85]);
          temp = Math.floor(temp / 85);
        }

        { const _src = chars.map(c => c.charCodeAt(0)); for (let _i = 0; _i < _src.length; _i++) result.push(_src[_i]); }
      }

      return result;
    }

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      const encoded = OpCodes.BytesToChars(data);

      // Z85 requires input length to be multiple of 5 characters
      if (encoded.length % 5 !== 0) {
        throw new Error('Z85: Invalid encoded length (must be multiple of 5)');
      }

      const result = [];

      for (let i = 0; i < encoded.length; i += 5) {
        // Convert 5 characters to 32-bit value
        let value = 0;
        for (let j = 0; j < 5; j++) {
          const char = encoded[i + j];
          const charValue = this.algorithm.decodeTable[char];
          if (charValue === undefined) {
            throw new Error(`Z85: Invalid character '${char}' in encoded data`);
          }
          value = value * 85 + charValue;
        }

        // Unpack 32-bit value to 4 bytes (big-endian)
        result.push(OpCodes.AndN(OpCodes.Shr32(value, 24), 0xFF));
        result.push(OpCodes.AndN(OpCodes.Shr32(value, 16), 0xFF));
        result.push(OpCodes.AndN(OpCodes.Shr32(value, 8), 0xFF));
        result.push(OpCodes.AndN(value, 0xFF));
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Z85Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Z85Algorithm, Z85Instance };
}));