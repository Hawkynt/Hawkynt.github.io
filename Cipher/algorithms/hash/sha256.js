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
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize,
          BlockAbsorber, MerkleDamgardBlocks } = AlgorithmFramework;

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
    /**
     * @param {string} [variant='256'] - '224' or '256' (anything else configures SHA-256)
     */
    constructor(variant = '256') {
      super();

      // Required metadata
      this.name = 'SHA-' + variant;
      this.inventor = "NIST";
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-2 Family";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Performance and technical specifications
      this.blockSize = 64; // 512 bits = 64 bytes

      /** @type {uint32[]} Initial hash values of this variant */
      this.INITIAL_HASH = [];

      if (variant === '224') {
        this.description = "SHA-224 is a truncated version of SHA-256 producing a 224-bit digest. It is part of the SHA-2 family with identical security properties to SHA-256 but with shorter output.";
        this.year = 2004;
        this.outputSize = 28;  // 224 bits / 8
        // SHA-224 initial hash values (first 32 bits of fractional parts of square roots of 9th through 16th primes)
        // NIST FIPS 180-4 Section 5.3.2
        this.INITIAL_HASH = OpCodes.Hex32ToDWords('c1059ed8367cd5073070dd17f70e5939ffc00b316858151164f98fa7befa4fa4');
        this.tests = [
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
        ];
      } else {
        this.description = "SHA-256 (Secure Hash Algorithm 256-bit) is a cryptographic hash function from the SHA-2 family designed by NIST. Produces 256-bit (32-byte) hash values from arbitrary input data.";
        this.year = 2001;
        this.outputSize = 32;  // 256 bits / 8
        // SHA-256 initial hash values (first 32 bits of fractional parts of square roots of first 8 primes)
        // NIST FIPS 180-4 Section 5.3.3
        this.INITIAL_HASH = OpCodes.Hex32ToDWords('6a09e667bb67ae853c6ef372a54ff53a510e527f9b05688c1f83d9ab5be0cd19');
        this.tests = [
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
        ];
      }

      // Hash-specific metadata
      this.SupportedOutputSizes = [new KeySize(this.outputSize, this.outputSize, 1)];

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
     * Initialize a SHA-224/SHA-256 instance
     * @param {SHA2_256Algorithm} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = algorithm.outputSize;

      /** @type {uint32[]} Initial hash values of the variant */
      this._initialHash = algorithm.INITIAL_HASH;
      /** @type {string} Algorithm name, for messages */
      this._name = algorithm.name;

      // SHA-2-256 state variables
      /** @type {uint32[]} */
      this._h = [];
      /** @type {BlockAbsorber} */
      this._absorber = null;
      /** @type {boolean} */
      this._streamStarted = false;
    }

    /**
     * Initialize the hash state with variant-specific initial values
     * NIST FIPS 180-4 Section 5.3.2 (SHA-224) / Section 5.3.3 (SHA-256)
     */
    Init() {
      // Use initial hash values from algorithm (variant-specific)
      this._h = this._initialHash.slice();

      this._absorber = new BlockAbsorber(64, block => this._processBlock(block));
    }

    /**
     * Process a single 512-bit block
     * NIST FIPS 180-4 Section 6.2.2
     * @param {uint8[]} block - 64-byte block to process
     * @returns {void}
     */
    _processBlock(block) {
      /** @type {uint32[]} */
      const W = new Array(64);

      // Prepare message schedule W[t]
      for (let t = 0; t < 16; t++) {
        W[t] = OpCodes.Pack32BE(block[t*4], block[t*4+1], block[t*4+2], block[t*4+3]);
      }

      for (let t = 16; t < 64; t++) {
        const s0 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(W[t-15], 7), OpCodes.RotR32(W[t-15], 18)), OpCodes.Shr32(W[t-15], 3));
        const s1 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(W[t-2], 17), OpCodes.RotR32(W[t-2], 19)), OpCodes.Shr32(W[t-2], 10));
        W[t] = OpCodes.Add32(OpCodes.Add32(W[t-16], s0), OpCodes.Add32(W[t-7], s1));
      }

      // Initialize working variables
      let a = this._h[0], b = this._h[1], c = this._h[2], d = this._h[3];
      let e = this._h[4], f = this._h[5], g = this._h[6], h = this._h[7];

      // Main loop
      for (let t = 0; t < 64; t++) {
        const S1 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(e, 6), OpCodes.RotR32(e, 11)), OpCodes.RotR32(e, 25));
        const ch = OpCodes.Xor32(OpCodes.And32(e, f), OpCodes.And32(OpCodes.Not32(e), g));
        const temp1 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(h, S1), OpCodes.Add32(ch, K[t])), W[t]);
        const S0 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(a, 2), OpCodes.RotR32(a, 13)), OpCodes.RotR32(a, 22));
        const maj = OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(a, b), OpCodes.And32(a, c)), OpCodes.And32(b, c));
        const temp2 = OpCodes.Add32(S0, maj);

        h = g; g = f; f = e; e = OpCodes.Add32(d, temp1);
        d = c; c = b; b = a; a = OpCodes.Add32(temp1, temp2);
      }

      // Add working variables to hash value
      this._h[0] = OpCodes.Add32(this._h[0], a);
      this._h[1] = OpCodes.Add32(this._h[1], b);
      this._h[2] = OpCodes.Add32(this._h[2], c);
      this._h[3] = OpCodes.Add32(this._h[3], d);
      this._h[4] = OpCodes.Add32(this._h[4], e);
      this._h[5] = OpCodes.Add32(this._h[5], f);
      this._h[6] = OpCodes.Add32(this._h[6], g);
      this._h[7] = OpCodes.Add32(this._h[7], h);
    }

    /**
     * Add data to the hash calculation
     * @param {uint8[]} data - Data to hash as byte array
     */
    Update(data) {
      if (!data || data.length === 0) return;
      this._absorber.Absorb(data);
    }

    /**
     * Finalize the hash calculation and return result as byte array
     * NIST FIPS 180-4 Section 5.1.1
     * @returns {uint8[]} Hash digest as byte array (truncated for SHA-224)
     */
    Final() {
      // The pad byte, the zero fill, the 64-bit big-endian bit length and the
      // second block that is needed when the length no longer fits all come
      // from MerkleDamgardBlocks, so the boundary test is written once rather
      // than once per hash. The old inline copy also wrote the high half of the
      // length field as a hard-coded zero, which is right only below 2^29 bytes.
      this._absorber.Finish((held, pending, total) => {
        for (const block of MerkleDamgardBlocks(held, pending, total, { blockSize: 64, lengthBytes: 8 }))
          this._processBlock(block);
      });

      // Convert hash to byte array, truncated based on variant
      // SHA-224: 7 words (28 bytes), SHA-256: 8 words (32 bytes)
      /** @type {uint8[]} */
      const result = [];
      const outputWords = this.OutputSize / 4;
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
     * @param {uint8[]} message - Message to hash as byte array
     * @returns {uint8[]} Hash digest as byte array
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * Hashes take no key
     * @param {uint8[]} key - Unused
     * @returns {boolean} Always true
     */
    KeySetup(key) {
      // Hashes don't use keys
      return true;
    }

    /**
     * Hash one block (block-cipher style convenience)
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} plaintext - Bytes to hash
     * @returns {uint8[]} Hash digest as byte array
     */
    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    /**
     * Hash functions have no inverse
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} ciphertext - Unused
     * @throws {Error} Always
     */
    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error(this._name + ' is a one-way hash function - decryption not possible');
    }

    /**
     * Wipe the chaining state and any buffered bytes
     */
    ClearData() {
      if (this._h) OpCodes.ClearArray(this._h);
      if (this._absorber) this._absorber.Reset();
    }

    /**
     * Feed method required by test suite - processes input data
     * @param {uint8[]} data - Input data as byte array
     */
    Feed(data) {
      // Init() discards the state, so it belongs at the start of the message and
      // not at the start of every call. Feed is a streaming interface: a message
      // delivered in pieces has to absorb exactly the block sequence the whole
      // message would, which Update already does through its own buffer.
      if (!this._streamStarted) {
        this.Init();
        this._streamStarted = true;
      }
      this.Update(data);
    }

    /**
     * Result method required by test suite - returns final hash
     * @returns {uint8[]} Hash digest as byte array
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