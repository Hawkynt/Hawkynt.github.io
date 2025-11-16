/*
 * SHA-256 Hash Function - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
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
    root.SHA2_256 = factory(root.AlgorithmFramework, root.OpCodes);
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

  // SHA-256 constants - NIST FIPS 180-4 Section 4.2.2
  // First 32 bits of the fractional parts of the cube roots of the first 64 prime numbers
  const K = OpCodes.Hex32ToDWords(
    '428a2f98' + '71374491' + 'b5c0fbcf' + 'e9b5dba5' +
    '3956c25b' + '59f111f1' + '923f82a4' + 'ab1c5ed5' +
    'd807aa98' + '12835b01' + '243185be' + '550c7dc3' +
    '72be5d74' + '80deb1fe' + '9bdc06a7' + 'c19bf174' +
    'e49b69c1' + 'efbe4786' + '0fc19dc6' + '240ca1cc' +
    '2de92c6f' + '4a7484aa' + '5cb0a9dc' + '76f988da' +
    '983e5152' + 'a831c66d' + 'b00327c8' + 'bf597fc7' +
    'c6e00bf3' + 'd5a79147' + '06ca6351' + '14292967' +
    '27b70a85' + '2e1b2138' + '4d2c6dfc' + '53380d13' +
    '650a7354' + '766a0abb' + '81c2c92e' + '92722c85' +
    'a2bfe8a1' + 'a81a664b' + 'c24b8b70' + 'c76c51a3' +
    'd192e819' + 'd6990624' + 'f40e3585' + '106aa070' +
    '19a4c116' + '1e376c08' + '2748774c' + '34b0bcb5' +
    '391c0cb3' + '4ed8aa4a' + '5b9cca4f' + '682e6ff3' +
    '748f82ee' + '78a5636f' + '84c87814' + '8cc70208' +
    '90befffa' + 'a4506ceb' + 'bef9a3f7' + 'c67178f2'
  );

  /**
 * SHA2_256Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class SHA2_256Algorithm extends HashFunctionAlgorithm {
    constructor(variant = '256') {
      super();

      // Get variant-specific configuration
      const config = this._getVariantConfig(variant);

      // Required metadata
      this.name = `SHA-${variant}`;
      this.description = config.description;
      this.inventor = "NIST";
      this.year = config.year;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-2 Family";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Hash-specific metadata
      this.SupportedOutputSizes = [config.outputSize];

      // Performance and technical specifications
      this.blockSize = 64; // 512 bits = 64 bytes
      this.outputSize = config.outputSize;

      // Store initial hash values for this variant
      this.INITIAL_HASH = config.initialHash;

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST FIPS 180-4: Secure Hash Standard", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf"),
        new LinkItem("RFC 6234: US Secure Hash Algorithms", "https://tools.ietf.org/html/rfc6234"),
        new LinkItem("Wikipedia: SHA-2", "https://en.wikipedia.org/wiki/SHA-2")
      ];

      this.references = [
        new LinkItem("OpenSSL Implementation", "https://github.com/openssl/openssl/blob/master/crypto/sha/sha256.c"),
        new LinkItem("NIST CAVP Test Vectors", "https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program/Secure-Hashing")
      ];

      // Test vectors from NIST
      this.tests = config.tests;
    }

    /**
     * Get variant-specific configuration
     * @param {string} variant - '224' or '256'
     * @returns {object} Configuration object with variant-specific settings
     */
    _getVariantConfig(variant) {
      const configs = {
        '224': {
          description: "SHA-224 is a truncated version of SHA-256 producing a 224-bit digest. It is part of the SHA-2 family with identical security properties to SHA-256 but with shorter output.",
          outputSize: 28,  // 224 bits / 8
          year: 2004,
          // SHA-224 initial hash values (first 32 bits of fractional parts of square roots of 9th through 16th primes)
          // NIST FIPS 180-4 Section 5.3.2
          initialHash: [
            0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
            0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4
          ],
          tests: [
            {
              text: "NIST Test Vector - Empty String",
              uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
              input: [],
              expected: OpCodes.Hex8ToBytes("d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f")
            },
            {
              text: "NIST Test Vector - 'abc'",
              uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
              input: OpCodes.AnsiToBytes("abc"),
              expected: OpCodes.Hex8ToBytes("23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7")
            },
            {
              text: "NIST Test Vector - Alphabet",
              uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
              input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
              expected: OpCodes.Hex8ToBytes("45a5f72c39c5cff2522eb3429799e49e5f44b356ef926bcf390dccc2")
            }
          ]
        },
        '256': {
          description: "SHA-256 (Secure Hash Algorithm 256-bit) is a cryptographic hash function from the SHA-2 family designed by NIST. Produces 256-bit (32-byte) hash values from arbitrary input data.",
          outputSize: 32,  // 256 bits / 8
          year: 2001,
          // SHA-256 initial hash values (first 32 bits of fractional parts of square roots of first 8 primes)
          // NIST FIPS 180-4 Section 5.3.3
          initialHash: OpCodes.Hex32ToDWords('6a09e667bb67ae853c6ef372a54ff53a510e527f9b05688c1f83d9ab5be0cd19'),
          tests: [
            {
              text: "NIST Test Vector - Empty String",
              uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA256.pdf",
              input: [],
              expected: OpCodes.Hex8ToBytes('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
            },
            {
              text: "NIST Test Vector - 'abc'",
              uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA256.pdf",
              input: [97, 98, 99], // "abc"
              expected: OpCodes.Hex8ToBytes('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
            },
            {
              text: "NIST Test Vector - Long String",
              uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA256.pdf",
              input: [97,98,99,100,98,99,100,101,99,100,101,102,100,101,102,103,101,102,103,104,102,103,104,105,103,104,105,106,104,105,106,107,105,106,107,108,106,107,108,109,107,108,109,110,108,109,110,111,109,110,111,112,110,111,112,113], // "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
              expected: OpCodes.Hex8ToBytes('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
            }
          ]
        }
      };

      return configs[variant] || configs['256'];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SHA2_256AlgorithmInstance(this, isInverse);
    }
  }

  /**
 * SHA2_256Algorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SHA2_256AlgorithmInstance extends IHashFunctionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = algorithm.outputSize;

      // SHA-2-256 state variables
      this._h = null;
      this._buffer = null;
      this._length = 0;
      this._bufferLength = 0;
    }

    /**
     * Initialize the hash state with variant-specific initial values
     * NIST FIPS 180-4 Section 5.3.2 (SHA-224) / Section 5.3.3 (SHA-256)
     */
    Init() {
      // Use initial hash values from algorithm (variant-specific)
      this._h = [...this.algorithm.INITIAL_HASH];

      this._buffer = new Array(64);
      this._length = 0;
      this._bufferLength = 0;
    }

    /**
     * Process a single 512-bit block
     * NIST FIPS 180-4 Section 6.2.2
     * @param {Array} block - 64-byte block to process
     */
    _processBlock(block) {
      const W = new Array(64);
      let a, b, c, d, e, f, g, h;

      // Prepare message schedule W[t]
      for (let t = 0; t < 16; t++) {
        W[t] = OpCodes.Pack32BE(block[t*4], block[t*4+1], block[t*4+2], block[t*4+3]);
      }

      for (let t = 16; t < 64; t++) {
        const s0 = OpCodes.RotR32(W[t-15], 7) ^ OpCodes.RotR32(W[t-15], 18) ^ OpCodes.Shr32(W[t-15], 3);
        const s1 = OpCodes.RotR32(W[t-2], 17) ^ OpCodes.RotR32(W[t-2], 19) ^ OpCodes.Shr32(W[t-2], 10);
        W[t] = OpCodes.ToDWord(W[t-16] + s0 + W[t-7] + s1);
      }

      // Initialize working variables
      a = this._h[0]; b = this._h[1]; c = this._h[2]; d = this._h[3];
      e = this._h[4]; f = this._h[5]; g = this._h[6]; h = this._h[7];

      // Main loop
      for (let t = 0; t < 64; t++) {
        const S1 = OpCodes.RotR32(e, 6) ^ OpCodes.RotR32(e, 11) ^ OpCodes.RotR32(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = OpCodes.ToDWord(h + S1 + ch + K[t] + W[t]);
        const S0 = OpCodes.RotR32(a, 2) ^ OpCodes.RotR32(a, 13) ^ OpCodes.RotR32(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = OpCodes.ToDWord(S0 + maj);

        h = g; g = f; f = e; e = OpCodes.ToDWord(d + temp1);
        d = c; c = b; b = a; a = OpCodes.ToDWord(temp1 + temp2);
      }

      // Add working variables to hash value
      this._h[0] = OpCodes.ToDWord(this._h[0] + a);
      this._h[1] = OpCodes.ToDWord(this._h[1] + b);
      this._h[2] = OpCodes.ToDWord(this._h[2] + c);
      this._h[3] = OpCodes.ToDWord(this._h[3] + d);
      this._h[4] = OpCodes.ToDWord(this._h[4] + e);
      this._h[5] = OpCodes.ToDWord(this._h[5] + f);
      this._h[6] = OpCodes.ToDWord(this._h[6] + g);
      this._h[7] = OpCodes.ToDWord(this._h[7] + h);
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
          bytes.push(data.charCodeAt(i) & 0xFF);
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
     * @returns {Array} Hash digest as byte array (truncated for SHA-224)
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

      // Convert hash to byte array, truncated based on variant
      // SHA-224: 7 words (28 bytes), SHA-256: 8 words (32 bytes)
      const result = [];
      const outputWords = this.algorithm.outputSize / 4;
      for (let i = 0; i < outputWords; i++) {
        const bytes = OpCodes.Unpack32BE(this._h[i]);
        for (let j = 0; j < 4; j++) {
          result.push(bytes[j]);
        }
      }

      return result;
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
      throw new Error(`${this.algorithm.name} is a one-way hash function - decryption not possible`);
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

  // Register both SHA-224 and SHA-256 variants
  RegisterAlgorithm(new SHA2_256Algorithm('224'));
  RegisterAlgorithm(new SHA2_256Algorithm('256'));

  // ===== EXPORTS =====

  return { SHA2_256Algorithm, SHA2_256AlgorithmInstance };
}));