/*
 * Balloon Hashing Implementation
 * Memory-hard password hashing function providing provable protection against sequential attacks
 * Reference: GNU Nettle balloon.c implementation
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

  class BalloonAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Balloon Hashing";
      this.description = "Memory-hard password hashing function with provable protection against sequential attacks. Simpler design than Argon2 with similar security properties. Requires configurable space cost (s_cost), time cost (t_cost), and mixing parameter (delta).";
      this.inventor = "Dan Boneh, Henry Corrigan-Gibbs, Stuart Schechter";
      this.year = 2016;
      this.category = CategoryType.KDF;
      this.subCategory = "Password Hashing";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = true;
      this.SupportedOutputSizes = [new KeySize(20, 64, 1)]; // SHA-1 (20) to SHA-512 (64) bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("Balloon Hashing Paper (ePrint Archive)", "https://eprint.iacr.org/2016/027.pdf"),
        new LinkItem("GNU Nettle Implementation", "https://git.lysator.liu.se/nettle/nettle/-/blob/master/balloon.c"),
        new LinkItem("Wikipedia - Balloon Hashing", "https://en.wikipedia.org/wiki/Balloon_hashing")
      ];

      this.references = [
        new LinkItem("GitHub Reference - nachonavarro/balloon-hashing", "https://github.com/nachonavarro/balloon-hashing"),
        new LinkItem("RustCrypto Balloon Hash Implementation", "https://github.com/RustCrypto/password-hashes/tree/master/balloon-hash"),
        new LinkItem("CRYPTO 2016 Paper Presentation", "https://www.iacr.org/conferences/crypto2016/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Parameter Selection",
          "Use adequate s_cost (≥1024) and t_cost (≥3) for production. Insufficient parameters weaken memory-hardness."
        ),
        new Vulnerability(
          "Timing Attacks",
          "Use constant-time comparison for password verification to prevent timing side-channel attacks."
        )
      ];

      // Test vectors from GNU Nettle testsuite
      // Source: https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c
      this.tests = [
        {
          text: "GNU Nettle Test Vector 1: SHA-256, hunter42/examplesalt, s_cost=1024, t_cost=3",
          uri: "https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c",
          input: OpCodes.AnsiToBytes('hunter42'),
          salt: OpCodes.AnsiToBytes('examplesalt'),
          hashAlgorithm: 'SHA-256',
          sCost: 1024,
          tCost: 3,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("716043dff777b44aa7b88dcbab12c078abecfac9d289c5b5195967aa63440dfb")
        },
        {
          text: "GNU Nettle Test Vector 2: SHA-256, empty password/salt, s_cost=3, t_cost=3",
          uri: "https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c",
          input: OpCodes.AnsiToBytes(''),
          salt: OpCodes.AnsiToBytes('salt'),
          hashAlgorithm: 'SHA-256',
          sCost: 3,
          tCost: 3,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("5f02f8206f9cd212485c6bdf85527b698956701ad0852106f94b94ee94577378")
        },
        {
          text: "GNU Nettle Test Vector 3: SHA-256, password/empty salt, s_cost=3, t_cost=3",
          uri: "https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes(''),
          hashAlgorithm: 'SHA-256',
          sCost: 3,
          tCost: 3,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("20aa99d7fe3f4df4bd98c655c5480ec98b143107a331fd491deda885c4d6a6cc")
        },
        {
          text: "GNU Nettle Test Vector 4: SHA-256, single char password/salt, s_cost=3, t_cost=3",
          uri: "https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c",
          input: [0], // Single byte
          salt: [0],  // Single byte
          hashAlgorithm: 'SHA-256',
          sCost: 3,
          tCost: 3,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("4fc7e302ffa29ae0eac31166cee7a552d1d71135f4e0da66486fb68a749b73a4")
        },
        {
          text: "GNU Nettle Test Vector 5: SHA-256, password/salt, s_cost=1, t_cost=1 (minimal)",
          uri: "https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('salt'),
          hashAlgorithm: 'SHA-256',
          sCost: 1,
          tCost: 1,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("eefda4a8a75b461fa389c1dcfaf3e9dfacbc26f81f22e6f280d15cc18c417545")
        },
        {
          text: "GNU Nettle Test Vector 6: SHA-1, password/salt, s_cost=3, t_cost=3",
          uri: "https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('salt'),
          hashAlgorithm: 'SHA-1',
          sCost: 3,
          tCost: 3,
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes("99393c091fdd3136f85864099ec49a439dcacc21")
        },
        {
          text: "GNU Nettle Test Vector 7: SHA-256, password/salt, s_cost=3, t_cost=3",
          uri: "https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('salt'),
          hashAlgorithm: 'SHA-256',
          sCost: 3,
          tCost: 3,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("a4df347f5a312e8b2b14c32164f61a81758c807f1bdcda44f4930e2b80ab2154")
        },
        {
          text: "GNU Nettle Test Vector 8: SHA-384, password/salt, s_cost=3, t_cost=3",
          uri: "https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('salt'),
          hashAlgorithm: 'SHA-384',
          sCost: 3,
          tCost: 3,
          outputSize: 48,
          expected: OpCodes.Hex8ToBytes("78da235f7d0f84aba98b50a432fa6c8f7f3ecb7ea0858cfb316c7e5356aae6c8d7e7b3924c54c4ed71a3d0d68cb0ad68")
        },
        {
          text: "GNU Nettle Test Vector 9: SHA-512, password/salt, s_cost=3, t_cost=3",
          uri: "https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('salt'),
          hashAlgorithm: 'SHA-512',
          sCost: 3,
          tCost: 3,
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("9baf289dfa42990f4b189d96d4ede0f2610ba71fb644169427829d696f6866d87af41eb68f9e14fd4b1f1a7ce4832f1ed6117c16e8eae753f9e1d054a7c0a7eb")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {BalloonInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Balloon hashing is one-way
      }
      return new BalloonInstance(this, isInverse);
    }
  }

  /**
 * Balloon instance implementing the Feed/Result pattern
 * @class
 * @extends {IKdfInstance}
 */

  class BalloonInstance extends IKdfInstance {
    /**
   * Initialize a Balloon hashing instance with the default parameters
   * @param {BalloonAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Inverse flag (Feed refuses an inverse instance)
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;

      // Default parameters
      /** @type {int32} Space cost (memory hardness parameter) */
      this._sCost = 1024;
      /** @type {int32} Time cost (iteration count) */
      this._tCost = 3;
      /** @type {int32} Mixing parameter (default from paper) */
      this.delta = 3;
      /** @type {string} Name of the registered hash function */
      this.hashAlgorithm = 'SHA-256';
      /** @type {int32} Output size in bytes (informational: the result is one full digest) */
      this._outputSize = 32;
      /** @type {uint8[]} */
      this.salt = null;
      /** @type {uint8[]} */
      this.password = null;

      /** @type {uint8[]} */
      this._inputData = null;
    }

    // Property setters for test vector compatibility
    /** @param {int32} value - Space cost */
    set sCost(value) { this._sCost = value; }
    /** @returns {int32} Space cost */
    get sCost() { return this._sCost; }

    /** @param {int32} value - Time cost */
    set tCost(value) { this._tCost = value; }
    /** @returns {int32} Time cost */
    get tCost() { return this._tCost; }

    /** @param {int32} value - Output size in bytes */
    set OutputSize(value) { this._outputSize = value; }
    /** @returns {int32} Output size in bytes */
    get OutputSize() { return this._outputSize; }

    /** @param {int32} value - Output size in bytes */
    set outputSize(value) { this._outputSize = value; }
    /** @returns {int32} Output size in bytes */
    get outputSize() { return this._outputSize; }

    /**
   * Append password bytes
   * @param {uint8[]} data - Password bytes
   * @returns {void}
   * @throws {Error} If data is not an array or the instance is an inverse one
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BalloonInstance.Feed: Input must be byte array (password)');
      }

      if (this.isInverse) {
        throw new Error('BalloonInstance.Feed: Balloon hashing cannot be reversed (one-way function)');
      }

      // Feed is a streaming interface: successive calls extend the input rather
      // than replace it, so Feed(a); Feed(b) derives from the same octet string
      // as Feed(a || b).
      if (!this._inputData) this._inputData = [];
      for (let i = 0; i < data.length; i++) this._inputData.push(data[i]);
      this.password = this._inputData;
    }

    /**
   * Derive the Balloon hash of the password
   * @returns {uint8[]} One digest of the configured hash function
   * @throws {Error} If no password is set or the hash function is not available
   */

    Result() {
      // Balloon can work with pre-set parameters or fed data
      if (!this.password && !this._inputData) {
        throw new Error('BalloonInstance.Result: Password required - use Feed() method or set password directly');
      }

      // Parameters left unset (null, 0, empty name) take their defaults
      const pwd = this.password ? this.password : this._inputData;
      /** @type {uint8[]} */
      let slt = this.salt;
      if (!slt) slt = [];
      const sCost = this._sCost ? this._sCost : 1024;
      const tCost = this._tCost ? this._tCost : 3;
      const delta = this.delta ? this.delta : 3;

      // Get hash function
      const hashAlg = this._getHashFunction(this.hashAlgorithm ? this.hashAlgorithm : 'SHA-256');
      if (!hashAlg) {
        throw new Error('BalloonInstance.Result: Hash algorithm \'' + this.hashAlgorithm + '\' not available');
      }

      // Execute Balloon hashing algorithm
      return this._balloon(hashAlg, sCost, tCost, delta, pwd, slt);
    }

    /**
     * Source file of a hash function this KDF can load on demand
     * @param {string} algorithmName - Hash name
     * @returns {string} Path relative to this file, or null when unknown
     */
    _hashModulePath(algorithmName) {
      switch (algorithmName) {
        case 'SHA-1': return '../hash/sha1.js';
        case 'SHA-256': return '../hash/sha256.js';
        case 'SHA-384': return '../hash/sha512.js'; // SHA-384 is in sha512.js
        case 'SHA-512': return '../hash/sha512.js';
        default: return null;
      }
    }

    /**
     * Find a hash algorithm in the framework, loading it where a synchronous
     * CommonJS require exists (an AMD loader's require is asynchronous and is
     * not asked)
     * @param {string} algorithmName - Name of hash algorithm (SHA-256, SHA-512, etc.)
     * @returns {Algorithm} The hash algorithm, or null when it is not available
     */
    _getHashFunction(algorithmName) {
      // Try to find hash algorithm in framework
      /** @type {Algorithm} */
      let hashAlg = AlgorithmFramework.Find(algorithmName);

      if (!hashAlg && typeof module === 'object' && typeof require === 'function') {
        // Try to load hash algorithm dynamically
        const modulePath = this._hashModulePath(algorithmName);
        if (modulePath) {
          require(modulePath);
          hashAlg = AlgorithmFramework.Find(algorithmName);
        }
      }

      return hashAlg;
    }

    /**
     * Core Balloon hashing algorithm
     * Reference: GNU Nettle balloon.c
     * @param {Algorithm} hashAlg - Hash algorithm
     * @param {int32} sCost - Space cost (memory blocks)
     * @param {int32} tCost - Time cost (iterations)
     * @param {int32} delta - Mixing parameter
     * @param {uint8[]} password - Password bytes
     * @param {uint8[]} salt - Salt bytes
     * @returns {uint8[]} Derived key bytes
     */
    _balloon(hashAlg, sCost, tCost, delta, password, salt) {
      // Buffer of s_cost blocks, each one digest; every block is written by
      // the expansion before the mixing phase reads it
      /** @type {uint8[][]} */
      const buf = new Array(sCost);
      let cnt = 0;

      // Initial expansion: buf[0] = H(cnt || password || salt)
      buf[0] = this._hash(hashAlg, cnt++, password, salt);

      // buf[1..s_cost-1] = H(cnt || buf[i-1])
      for (let i = 1; i < sCost; ++i) {
        buf[i] = this._hash(hashAlg, cnt++, buf[i - 1], null);
      }

      // Main mixing phase
      for (let i = 0; i < tCost; ++i) {
        for (let j = 0; j < sCost; ++j) {
          // Mix with previous block
          const prevIdx = (j > 0) ? j - 1 : sCost - 1;
          buf[j] = this._hash(hashAlg, cnt++, buf[prevIdx], buf[j]);

          // Random mixing with delta other blocks
          for (let k = 0; k < delta; ++k) {
            // Compute index: block = H(i || j || k)
            const indexBlock = this._hashInts(hashAlg, i, j, k);

            // block = H(salt || block)
            const saltedBlock = this._hash(hashAlg, cnt++, salt, indexBlock);

            // Convert block to index: idx = block_to_int(block, s_cost)
            const idx = this._blockToInt(saltedBlock, sCost);

            // buf[j] = H(buf[j] || buf[idx])
            buf[j] = this._hash(hashAlg, cnt++, buf[j], buf[idx]);
          }
        }
      }

      // Return final block (last block in buffer)
      return buf[sCost - 1];
    }

    /**
     * Digest of one message with a fresh instance of the hash algorithm
     * @param {Algorithm} hashAlg - Hash algorithm
     * @param {uint8[]} data - Message bytes
     * @returns {uint8[]} Digest
     */
    _digest(hashAlg, data) {
      /** @type {IAlgorithmInstance} */
      const state = hashAlg.CreateInstance();
      state.Feed(data);
      /** @type {uint8[]} */
      const result = state.Result();
      return result;
    }

    /**
     * Hash function wrapper: H(cnt || a || b)
     * @param {Algorithm} hashAlg - Hash algorithm
     * @param {int32} cnt - Counter value
     * @param {uint8[]} a - First data array (null or empty for none)
     * @param {uint8[]} b - Second data array (null or empty for none)
     * @returns {uint8[]} Hash output
     */
    _hash(hashAlg, cnt, a, b) {
      // Concatenate all data before feeding (workaround for hash implementations
      // that don't properly support incremental updates)
      let allData = this._uint64ToLE(cnt);

      if (a && a.length > 0) {
        allData = allData.concat(a);
      }
      if (b && b.length > 0) {
        allData = allData.concat(b);
      }

      return this._digest(hashAlg, allData);
    }

    /**
     * Hash three integers: H(i || j || k)
     * @param {Algorithm} hashAlg - Hash algorithm
     * @param {int32} i - First integer
     * @param {int32} j - Second integer
     * @param {int32} k - Third integer
     * @returns {uint8[]} Hash output
     */
    _hashInts(hashAlg, i, j, k) {
      // All three integers as little-endian 64-bit, concatenated
      const iBytes = this._uint64ToLE(i);
      const jBytes = this._uint64ToLE(j);
      const kBytes = this._uint64ToLE(k);

      /** @type {uint8[]} */
      const allData = iBytes.concat(jBytes, kBytes);
      return this._digest(hashAlg, allData);
    }

    /**
     * Convert block bytes to integer modulo mod
     * Treats bytes as little-endian multi-precision integer
     * @param {uint8[]} block - Byte array
     * @param {int32} mod - Modulus value
     * @returns {uint32} Integer in range [0, mod)
     */
    _blockToInt(block, mod) {
      /** @type {uint32} */
      let r = 0;

      // Process from most significant byte to least (reversed for LE)
      for (let i = block.length - 1; i >= 0; i--) {
        // Shl32 yields a multiple of 256 below 2^32, so adding a byte never wraps
        r = OpCodes.Add32(OpCodes.Shl32(r, 8), block[i]) % mod;
      }

      return r;
    }

    /**
     * Convert a counter to a little-endian 8-byte array
     * Note: JavaScript bitwise operators only work reliably on 32-bit values
     * @param {int32} value - Counter (32-bit range; the upper four bytes are zero)
     * @returns {uint8[]} 8-byte array in little-endian format
     */
    _uint64ToLE(value) {
      // Balloon counter values are small: the low word is the value, the upper
      // 32 bits are zero
      /** @type {uint8[]} */
      const out = OpCodes.Unpack32LE(value);
      out.push(0, 0, 0, 0);
      return out;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BalloonAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BalloonAlgorithm, BalloonInstance };
}));
