/*
 * COMB4P Hash Function Combiner - Universal AlgorithmFramework Implementation
 * Combines two hash functions using a Feistel-like scheme for enhanced security
 * Based on "On the Security of Hash Function Combiners" by Anja Lehmann
 * Reference: Botan cryptographic library implementation
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, Find } = AlgorithmFramework;

  // ===== COMB4P IMPLEMENTATION =====

  // Helper to ensure hash algorithms are loaded
  function ensureHashLoaded(hashName) {
    let algo = Find(hashName);
    if (algo) return algo;

    // Try to load the hash algorithm file
    if (typeof require !== 'undefined') {
      try {
        if (hashName === 'MD4' || hashName === 'MD5') {
          require('./md.js');
        } else if (hashName === 'SHA-1') {
          require('./sha1.js');
        } else if (hashName === 'RIPEMD-160') {
          require('./ripemd.js');
        }
        algo = Find(hashName);
      } catch (e) {
        // Ignore require errors, will throw below if still not found
      }
    }

    if (!algo) {
      throw new Error(`COMB4P: Hash function '${hashName}' not found. Please ensure ${hashName} is loaded.`);
    }
    return algo;
  }

  /**
 * COMB4P cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class COMB4PInstance extends IHashFunctionInstance {
    constructor(algorithm, hash1Name, hash2Name) {
      super(algorithm);

      this.hash1Name = hash1Name;
      this.hash2Name = hash2Name;

      // Load the component hash algorithms (with auto-loading)
      this.hash1Algo = ensureHashLoaded(hash1Name);
      this.hash2Algo = ensureHashLoaded(hash2Name);

      if (this.hash1Algo.name === this.hash2Algo.name) {
        throw new Error('COMB4P: Must use two distinct hash functions');
      }

      // Create instances of both hash functions
      this.hash1Instance = this.hash1Algo.CreateInstance();
      this.hash2Instance = this.hash2Algo.CreateInstance();

      if (!this.hash1Instance || !this.hash2Instance) {
        throw new Error('COMB4P: Failed to create hash instances');
      }

      // Get output sizes - COMB4P requires equal-sized hashes
      const size1 = this.hash1Instance.OutputSize || this._getDefaultHashSize(hash1Name);
      const size2 = this.hash2Instance.OutputSize || this._getDefaultHashSize(hash2Name);

      if (size1 !== size2) {
        throw new Error(`COMB4P: Incompatible hashes ${hash1Name} (${size1} bytes) and ${hash2Name} (${size2} bytes) - output sizes must match`);
      }

      this.componentSize = size1;
      this.OutputSize = size1 + size2; // Combined output is h1 || h2

      this._Reset();
    }

    _getDefaultHashSize(name) {
      // Default hash sizes for common algorithms
      const sizes = {
        'MD4': 16,
        'MD5': 16,
        'SHA-1': 20,
        'RIPEMD-160': 20,
        'SHA-256': 32,
        'SHA-512': 64
      };
      return sizes[name] || 32; // Default to 32 bytes if unknown
    }

    _Reset() {
      // COMB4P starts with round number 0 fed to both hashes
      // Store it in a buffer to concatenate with actual data
      this.prefix = [0];
      this.inputBuffer = [];
    }

    Initialize() {
      this._Reset();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Accumulate input data (will be fed all at once in Result())
      const input = Array.isArray(data) ? data : Array.from(data);
      this.inputBuffer.push(...input);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Create fresh hash instances for the main hashing
      const h1Instance = this.hash1Algo.CreateInstance();
      const h2Instance = this.hash2Algo.CreateInstance();

      // Feed the complete message (0 || input) to both hashes
      const completeMessage = this.prefix.concat(this.inputBuffer);
      h1Instance.Feed(completeMessage);
      h2Instance.Feed(completeMessage);

      // Get initial hash outputs
      let h1 = Array.from(h1Instance.Result());
      let h2 = Array.from(h2Instance.Result());

      // Ensure outputs are the expected size
      if (h1.length !== this.componentSize || h2.length !== this.componentSize) {
        throw new Error(`COMB4P: Unexpected hash output sizes (${h1.length}, ${h2.length})`);
      }

      // First round: XOR h2 into h1
      h1 = OpCodes.XorArrays(h1, h2);

      // Second round: comb4p_round(out=h2, in=h1, round_no=1)
      this._comb4pRound(h2, h1, 1);

      // Third round: comb4p_round(out=h1, in=h2, round_no=2)
      this._comb4pRound(h1, h2, 2);

      // Final output is h1 || h2 (concatenation)
      const output = h1.concat(h2);

      // Reset for next use (feed 0 to both hashes)
      this._Reset();

      return output;
    }

    _comb4pRound(out, input, roundNo) {
      // Create fresh hash instances for this round
      const h1 = this.hash1Algo.CreateInstance();
      const h2 = this.hash2Algo.CreateInstance();

      // Concatenate round number and input data
      const roundData = [roundNo].concat(input);

      // Feed the complete data to both hashes
      h1.Feed(roundData);
      h2.Feed(roundData);

      // Get hash outputs
      const h1Result = Array.from(h1.Result());
      const h2Result = Array.from(h2.Result());

      // XOR both results into output
      const temp1 = OpCodes.XorArrays(out, h1Result);
      const temp2 = OpCodes.XorArrays(temp1, h2Result);

      // Copy result back to out
      for (let i = 0; i < temp2.length; ++i) {
        out[i] = temp2[i];
      }
    }
  }

  // ===== COMB4P ALGORITHM DEFINITIONS =====

  // Base class for COMB4P variants
  /**
 * COMB4PBase - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class COMB4PBase extends HashFunctionAlgorithm {
    constructor(hash1Name, hash2Name) {
      super();
      this.hash1Name = hash1Name;
      this.hash2Name = hash2Name;

      // Metadata
      this.name = `COMB4P(${hash1Name},${hash2Name})`;
      this.description = `COMB4P hash combiner using ${hash1Name} and ${hash2Name}. Combines two hash functions with a Feistel-like construction to provide security even if one component hash is broken.`;
      this.inventor = "Anja Lehmann";
      this.year = 2004;
      this.category = CategoryType.HASH;
      this.subCategory = "Hash Function Combiner";
      this.securityStatus = null; // Stronger than component hashes
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.DE;

      this.documentation = [
        new LinkItem("Paper: On the Security of Hash Function Combiners", "https://eprint.iacr.org/2004/175"),
        new LinkItem("Botan Implementation", "https://botan.randombit.net/")
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Hash functions have no inverse
      }
      return new COMB4PInstance(this, this.hash1Name, this.hash2Name);
    }
  }

  // COMB4P(MD4, MD5)
  class COMB4P_MD4_MD5 extends COMB4PBase {
    constructor() {
      super("MD4", "MD5");

      // Official test vectors from Botan
      this.tests = [
        {
          text: "Botan Test Vector: 'comb4_input'",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/comp4p.vec",
          input: OpCodes.Hex8ToBytes("636F6D62345F696E707574"), // "comb4_input"
          expected: OpCodes.Hex8ToBytes("FD1A64F7BC61608FD054303AFA2E31608AA3F3788E3034821D63A0288A70B573")
        }
      ];
    }
  }

  // COMB4P(SHA-1, RIPEMD-160)
  class COMB4P_SHA1_RIPEMD160 extends COMB4PBase {
    constructor() {
      super("SHA-1", "RIPEMD-160");

      // Official test vectors from Botan
      this.tests = [
        {
          text: "Botan Test Vector: 'comb4_input'",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/comp4p.vec",
          input: OpCodes.Hex8ToBytes("636F6D62345F696E707574"), // "comb4_input"
          expected: OpCodes.Hex8ToBytes("2B5F61CB57F94E7C7E6D7439FFF260028665853988224E0AD8C08C2FAA61963C8F761654AC529325")
        }
      ];
    }
  }

  // Register all COMB4P variants
  RegisterAlgorithm(new COMB4P_MD4_MD5());
  RegisterAlgorithm(new COMB4P_SHA1_RIPEMD160());

  // Return undefined for UMD compatibility
  return undefined;
}));
