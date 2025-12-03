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
      this.SupportedOutputSizes = [20, 64]; // SHA-1 (20) to SHA-512 (64) bytes

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
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Balloon hashing is one-way
      }
      return new BalloonInstance(this, isInverse);
    }
  }

  /**
 * Balloon cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BalloonInstance extends IKdfInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;

      // Default parameters
      this.sCost = 1024;  // Space cost (memory hardness parameter)
      this.tCost = 3;     // Time cost (iteration count)
      this.delta = 3;     // Mixing parameter (default from paper)
      this.hashAlgorithm = 'SHA-256'; // Default hash function
      this.outputSize = 32; // Default output size
      this.salt = null;
      this.password = null;

      this._inputData = null;
    }

    // Property setters for test vector compatibility
    set sCost(value) { this._sCost = value; }
    get sCost() { return this._sCost; }

    set tCost(value) { this._tCost = value; }
    get tCost() { return this._tCost; }

    set OutputSize(value) { this._outputSize = value; }
    get OutputSize() { return this._outputSize; }

    set outputSize(value) { this._outputSize = value; }
    get outputSize() { return this._outputSize; }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BalloonInstance.Feed: Input must be byte array (password)');
      }

      if (this.isInverse) {
        throw new Error('BalloonInstance.Feed: Balloon hashing cannot be reversed (one-way function)');
      }

      // Store input data for Result() method
      this._inputData = data;
      this.password = data;
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Balloon can work with pre-set parameters or fed data
      if (!this.password && !this._inputData) {
        throw new Error('BalloonInstance.Result: Password required - use Feed() method or set password directly');
      }

      const pwd = this.password || this._inputData;
      const slt = this.salt || [];
      const sCost = this.sCost || 1024;
      const tCost = this.tCost || 3;
      const delta = this.delta || 3;

      // Get hash function
      const hashFunc = this._getHashFunction(this.hashAlgorithm || 'SHA-256');
      if (!hashFunc) {
        throw new Error(`BalloonInstance.Result: Hash algorithm '${this.hashAlgorithm}' not available`);
      }

      const digestSize = hashFunc.digestSize;
      const outputSize = this.outputSize || digestSize;

      // Execute Balloon hashing algorithm
      return this._balloon(hashFunc, digestSize, sCost, tCost, delta, pwd, slt);
    }

    /**
     * Get hash function instance from AlgorithmFramework
     * @param {string} algorithmName - Name of hash algorithm (SHA-256, SHA-512, etc.)
     * @returns {object} Hash function with init, update, digest methods
     */
    _getHashFunction(algorithmName) {
      // Try to find hash algorithm in framework
      const hashAlg = AlgorithmFramework.Find(algorithmName);

      if (!hashAlg) {
        // Try to load hash algorithm dynamically
        try {
          if (typeof require !== 'undefined') {
            const algNameMap = {
              'SHA-1': '../hash/sha1.js',
              'SHA-256': '../hash/sha256.js',
              'SHA-384': '../hash/sha512.js', // SHA-384 is in sha512.js
              'SHA-512': '../hash/sha512.js'
            };

            const modulePath = algNameMap[algorithmName];
            if (modulePath) {
              require(modulePath);
              const loadedAlg = AlgorithmFramework.Find(algorithmName);
              if (loadedAlg) {
                return this._createHashFunctionWrapper(loadedAlg);
              }
            }
          }
        } catch (e) {
          // Ignore loading errors
        }
        return null;
      }

      return this._createHashFunctionWrapper(hashAlg);
    }

    /**
     * Create wrapper for hash function to match Nettle's interface
     * @param {object} hashAlgorithm - AlgorithmFramework hash algorithm
     * @returns {object} Wrapper with init, update, digest methods
     */
    _createHashFunctionWrapper(hashAlgorithm) {
      const instance = hashAlgorithm.CreateInstance();
      let state = null;

      return {
        digestSize: hashAlgorithm.outputSize || hashAlgorithm.OutputSize || hashAlgorithm.DigestSize || 32,

        init: function() {
          state = hashAlgorithm.CreateInstance();
        },

        update: function(data) {
          if (state) {
            state.Feed(data);
          }
        },

        digest: function() {
          if (state) {
            const result = state.Result();
            state = null; // Reset state
            return result;
          }
          return [];
        }
      };
    }

    /**
     * Core Balloon hashing algorithm
     * Reference: GNU Nettle balloon.c
     * @param {object} hashFunc - Hash function wrapper
     * @param {number} digestSize - Hash output size in bytes
     * @param {number} sCost - Space cost (memory blocks)
     * @param {number} tCost - Time cost (iterations)
     * @param {number} delta - Mixing parameter
     * @param {Array} password - Password bytes
     * @param {Array} salt - Salt bytes
     * @returns {Array} Derived key bytes
     */
    _balloon(hashFunc, digestSize, sCost, tCost, delta, password, salt) {
      const BS = digestSize;

      // Allocate buffer: buf = s_cost blocks of BS bytes each
      const buf = new Array(sCost);
      for (let i = 0; i < sCost; ++i) {
        buf[i] = new Array(BS).fill(0);
      }

      const block = new Array(BS).fill(0); // Temporary block
      let cnt = 0;

      // Initial expansion: buf[0] = H(cnt || password || salt)
      buf[0] = this._hash(hashFunc, cnt++, password, salt);

      // buf[1..s_cost-1] = H(cnt || buf[i-1])
      for (let i = 1; i < sCost; ++i) {
        buf[i] = this._hash(hashFunc, cnt++, buf[i - 1], null);
      }

      // Main mixing phase
      for (let i = 0; i < tCost; ++i) {
        for (let j = 0; j < sCost; ++j) {
          // Mix with previous block
          const prevIdx = (j > 0) ? j - 1 : sCost - 1;
          buf[j] = this._hash(hashFunc, cnt++, buf[prevIdx], buf[j]);

          // Random mixing with delta other blocks
          for (let k = 0; k < delta; ++k) {
            // Compute index: block = H(i || j || k)
            const indexBlock = this._hashInts(hashFunc, i, j, k);

            // block = H(salt || block)
            const saltedBlock = this._hash(hashFunc, cnt++, salt, indexBlock);

            // Convert block to index: idx = block_to_int(block, s_cost)
            const idx = this._blockToInt(saltedBlock, sCost);

            // buf[j] = H(buf[j] || buf[idx])
            buf[j] = this._hash(hashFunc, cnt++, buf[j], buf[idx]);
          }
        }
      }

      // Return final block (last block in buffer)
      return buf[sCost - 1];
    }

    /**
     * Hash function wrapper: H(cnt || a || b)
     * @param {object} hashFunc - Hash function
     * @param {number} cnt - Counter value
     * @param {Array} a - First data array
     * @param {Array} b - Second data array (optional)
     * @returns {Array} Hash output
     */
    _hash(hashFunc, cnt, a, b) {
      hashFunc.init();

      // Concatenate all data before feeding (workaround for hash implementations
      // that don't properly support incremental updates)
      const cntBytes = this._uint64ToLE(cnt);
      let allData = [...cntBytes];

      if (a && a.length > 0) {
        allData = allData.concat(a);
      }
      if (b && b.length > 0) {
        allData = allData.concat(b);
      }

      hashFunc.update(allData);
      return hashFunc.digest();
    }

    /**
     * Hash three integers: H(i || j || k)
     * @param {object} hashFunc - Hash function
     * @param {number} i - First integer
     * @param {number} j - Second integer
     * @param {number} k - Third integer
     * @returns {Array} Hash output
     */
    _hashInts(hashFunc, i, j, k) {
      hashFunc.init();

      // All three integers as little-endian 64-bit, concatenated
      const iBytes = this._uint64ToLE(i);
      const jBytes = this._uint64ToLE(j);
      const kBytes = this._uint64ToLE(k);

      const allData = [...iBytes, ...jBytes, ...kBytes];
      hashFunc.update(allData);

      return hashFunc.digest();
    }

    /**
     * Convert block bytes to integer modulo mod
     * Treats bytes as little-endian multi-precision integer
     * @param {Array} block - Byte array
     * @param {number} mod - Modulus value
     * @returns {number} Integer in range [0, mod)
     */
    _blockToInt(block, mod) {
      let r = 0;
      let i = block.length;

      // Process from most significant byte to least (reversed for LE)
      while (i--) {
        r = OpCodes.Shl32(r, 8) + block[i];
        r %= mod;
      }

      return r;
    }

    /**
     * Convert uint64 to little-endian 8-byte array
     * Note: JavaScript bitwise operators only work reliably on 32-bit values
     * @param {number} value - 64-bit unsigned integer (limited to 32-bit range for JavaScript safety)
     * @returns {Array} 8-byte array in little-endian format
     */
    _uint64ToLE(value) {
      // JavaScript bitwise shifts only work on 32 bits reliably
      // For shifts >= 32, the result wraps around due to 5-bit mask on shift amount
      // Since Balloon counter values are typically small, explicitly handle 32-bit range
      return [
        OpCodes.AndN(OpCodes.Shr32(value, 0), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(value, 8), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(value, 16), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(value, 24), 0xFF),
        0, 0, 0, 0  // Upper 32 bits (JavaScript numbers are 53-bit safe integers, but bitwise ops are 32-bit)
      ];
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
