
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

  // SHA-1 constants - RFC 3174 Section 5
  // K[0] = 0x5A827999 (rounds 0-19)
  // K[1] = 0x6ED9EBA1 (rounds 20-39)
  // K[2] = 0x8F1BBCDC (rounds 40-59)
  // K[3] = 0xCA62C1D6 (rounds 60-79)
  const K = Object.freeze([0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6]);

  /**
 * SHA1Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class SHA1Algorithm extends HashFunctionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "SHA-1";
        this.description = "Secure Hash Algorithm producing 160-bit digest. CRYPTOGRAPHICALLY BROKEN - practical collision attacks demonstrated in 2017. DO NOT USE for security purposes. Educational implementation only.";
        this.inventor = "National Security Agency (NSA)";
        this.year = 1995;
        this.category = CategoryType.HASH;
        this.subCategory = "Cryptographic Hash";
        this.securityStatus = SecurityStatus.BROKEN;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.US;

        // Hash-specific metadata
        this.SupportedOutputSizes = [
          { size: 20, description: "160-bit SHA-1 hash" }
        ];

        // Documentation and references
        this.documentation = [
          new LinkItem("RFC 3174: US Secure Hash Algorithm 1", "https://tools.ietf.org/html/rfc3174"),
          new LinkItem("NIST FIPS 180-1 (Superseded)", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-1.pdf"),
          new LinkItem("SHAttered Attack", "https://shattered.io/")
        ];

        this.references = [
          new LinkItem("OpenSSL Implementation (Deprecated)", "https://github.com/openssl/openssl/blob/master/crypto/sha/sha1dgst.c"),
          new LinkItem("RFC 3174 Specification", "https://tools.ietf.org/html/rfc3174"),
          new LinkItem("Git SHA-1DC Implementation", "https://github.com/git/git/blob/master/sha1dc/")
        ];

        // Known vulnerabilities
        this.knownVulnerabilities = [
          new Vulnerability("Collision Attack", "Practical collision attacks demonstrated in 2017. Two different PDFs can produce the same SHA-1 hash.", "Use SHA-256 or SHA-3 instead. Never use SHA-1 for digital signatures, certificates, or security purposes.")
        ];

        // Test vectors using OpCodes byte arrays
        this.tests = [
          {
            text: "Empty string test vector",
            uri: "https://tools.ietf.org/html/rfc3174",
            input: [],
            expected: OpCodes.Hex8ToBytes("da39a3ee5e6b4b0d3255bfef95601890afd80709")
          },
          {
            text: "Single character 'a' test vector",
            uri: "https://tools.ietf.org/html/rfc3174",
            input: [97], // "a"
            expected: OpCodes.Hex8ToBytes("86f7e437faa5a7fce15d1ddcb9eaeaea377667b8")
          },
          {
            text: "String 'abc' test vector",
            uri: "https://tools.ietf.org/html/rfc3174",
            input: [97, 98, 99], // "abc"
            expected: OpCodes.Hex8ToBytes("a9993e364706816aba3e25717850c26c9cd0d89d")
          },
          {
            text: "Message 'message digest' test vector",
            uri: "https://tools.ietf.org/html/rfc3174",
            input: [109, 101, 115, 115, 97, 103, 101, 32, 100, 105, 103, 101, 115, 116], // "message digest"
            expected: OpCodes.Hex8ToBytes("c12252ceda8be8994d5fa0290a47231c1d16aae3")
          },
          {
            text: "Alphabet test vector", 
            uri: "https://tools.ietf.org/html/rfc3174",
            input: [97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122], // "abcdefghijklmnopqrstuvwxyz"
            expected: OpCodes.Hex8ToBytes("32d10c7b8cf96570ca04ce37f2a19d84240d3a89")
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new SHA1Instance(this, isInverse);
      }
    }

    class SHA1Instance extends IHashFunctionInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.OutputSize = 20; // 160 bits

        // SHA-1 state variables
        this._h = null;
        this._buffer = null;
        this._length = 0;
        this._bufferLength = 0;
      }

      /**
       * Initialize the hash state with standard SHA-1 initial values
       * RFC 3174 Section 6.1
       */
      Init() {
        // Initial hash values (RFC 3174 Section 6.1)
        this._h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
        this._buffer = new Array(64);
        this._length = 0;
        this._bufferLength = 0;
      }

      _Reset() {
        this.Init();
      }

      /**
       * Add data to the hash calculation
       * @param {Array} data - Data to hash as byte array
       */
      Update(data) {
        if (!data || data.length === 0) return;

        // Convert string to byte array if needed
        if (typeof data === 'string') {
          const bytes = [];
          for (let i = 0; i < data.length; i++) {
            bytes.push(OpCodes.AndN(data.charCodeAt(i), 0xFF));
          }
          data = bytes;
        }

        for (let i = 0; i < data.length; i++) {
          this._buffer[this._bufferLength++] = data[i];

          if (this._bufferLength === 64) {
            this._processBlock(this._buffer);
            this._bufferLength = 0;
          }
        }

        this._length += data.length;
      }

      /**
       * Finalize the hash calculation and return result as byte array
       * @returns {Array} Hash digest as byte array
       */
      Final() {
        // Add padding bit
        this._buffer[this._bufferLength++] = 0x80;

        // If not enough space for length, pad and process block
        if (this._bufferLength > 56) {
          while (this._bufferLength < 64) {
            this._buffer[this._bufferLength++] = 0x00;
          }
          this._processBlock(this._buffer);
          this._bufferLength = 0;
        }

        // Pad to 56 bytes
        while (this._bufferLength < 56) {
          this._buffer[this._bufferLength++] = 0x00;
        }

        // Append length in bits as 64-bit big-endian
        const lengthBits = this._length * 8;
        // High 32 bits (for messages under 2^32 bits, this is 0)
        this._buffer[56] = 0; this._buffer[57] = 0; this._buffer[58] = 0; this._buffer[59] = 0;
        // Low 32 bits - use OpCodes for byte extraction
        const lengthBytes = OpCodes.Unpack32BE(lengthBits);
        this._buffer[60] = lengthBytes[0];
        this._buffer[61] = lengthBytes[1];
        this._buffer[62] = lengthBytes[2];
        this._buffer[63] = lengthBytes[3];

        // Process final block
        this._processBlock(this._buffer);

        // Convert hash to byte array
        const result = [];
        for (let i = 0; i < 5; i++) {
          const bytes = OpCodes.Unpack32BE(this._h[i]);
          for (let j = 0; j < 4; j++) {
            result.push(bytes[j]);
          }
        }

        return result;
      }

      /**
       * Process a single 512-bit block
       * RFC 3174 Section 6.1
       * @param {Array} block - 64-byte block to process
       */
      _processBlock(block) {
        const W = new Array(80);
        let a, b, c, d, e;

        // Prepare message schedule W[t]
        for (let t = 0; t < 16; t++) {
          W[t] = OpCodes.Pack32BE(block[t*4], block[t*4+1], block[t*4+2], block[t*4+3]);
        }

        // Extend the sixteen 32-bit words into eighty 32-bit words
        for (let t = 16; t < 80; t++) {
          W[t] = OpCodes.RotL32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(W[t-3], W[t-8]), W[t-14]), W[t-16]), 1);
        }

        // Initialize working variables
        a = this._h[0]; b = this._h[1]; c = this._h[2]; d = this._h[3]; e = this._h[4];

        // Main loop (80 rounds)
        for (let t = 0; t < 80; t++) {
          let f, k;

          if (t < 20) {
            f = OpCodes.OrN(OpCodes.AndN(b, c), OpCodes.AndN(~b, d));
            k = K[0];
          } else if (t < 40) {
            f = OpCodes.XorN(OpCodes.XorN(b, c), d);
            k = K[1];
          } else if (t < 60) {
            f = OpCodes.OrN(OpCodes.OrN(OpCodes.AndN(b, c), OpCodes.AndN(b, d)), OpCodes.AndN(c, d));
            k = K[2];
          } else {
            f = OpCodes.XorN(OpCodes.XorN(b, c), d);
            k = K[3];
          }

          const temp = OpCodes.ToUint32(OpCodes.RotL32(a, 5) + f + e + k + W[t]);
          e = d;
          d = c;
          c = OpCodes.RotL32(b, 30);
          b = a;
          a = temp;
        }

        // Add working variables to hash value
        this._h[0] = OpCodes.ToUint32(this._h[0] + a);
        this._h[1] = OpCodes.ToUint32(this._h[1] + b);
        this._h[2] = OpCodes.ToUint32(this._h[2] + c);
        this._h[3] = OpCodes.ToUint32(this._h[3] + d);
        this._h[4] = OpCodes.ToUint32(this._h[4] + e);
      }

      /**
       * Hash a complete message in one operation
       * @param {Array} message - Message to hash as byte array
       * @returns {Array} Hash digest as byte array
       */
      Hash(message) {
        this.Init();
        this.Update(message);
        return this.Final();
      }

      /**
       * Required interface methods for IAlgorithmInstance compatibility
       */
      KeySetup(key) {
        // Hashes don't use keys
        return true;
      }

      EncryptBlock(blockIndex, plaintext) {
        // Return hash of the plaintext
        return this.Hash(plaintext);
      }

      DecryptBlock(blockIndex, ciphertext) {
        // Hash functions are one-way
        throw new Error('SHA-1 is a one-way hash function - decryption not possible');
      }

      ClearData() {
        if (this._h) OpCodes.ClearArray(this._h);
        if (this._buffer) OpCodes.ClearArray(this._buffer);
        this._length = 0;
        this._bufferLength = 0;
      }

      /**
       * Feed method required by test suite - processes input data
       * @param {Array} data - Input data as byte array
       */
      Feed(data) {
        this.Init();
        this.Update(data);
      }

      /**
       * Result method required by test suite - returns final hash
       * @returns {Array} Hash digest as byte array
       */
      Result() {
        return this.Final();
      }
    }

    // ===== REGISTRATION =====

  const algorithmInstance = new SHA1Algorithm();
  RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { SHA1Algorithm, SHA1Instance };
}));