/*
 * Biorthogonal Code Implementation
 * Extended first-order Reed-Muller code with negations
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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance,
          TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class BiorthogonalCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Biorthogonal Code";
      this.description = "Extension of first-order Reed-Muller codes including complements of all codewords. Parameters [2^m, m+1, 2^(m-1)] where extra bit selects between codeword and its complement. Achieves twice the codebook size of Hadamard codes. Used in spread spectrum and code-division multiple access.";
      this.inventor = "Irving S. Reed, David E. Muller (extended concept)";
      this.year = 1954;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Biorthogonal Codes", "https://en.wikipedia.org/wiki/Reed%E2%80%93Muller_code#Biorthogonal_codes"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/reed_muller"),
        new LinkItem("Orthogonal Signaling", "https://www.ece.rutgers.edu/~orfanidi/ece348/codes.pdf")
      ];

      this.references = [
        new LinkItem("Reed-Muller Codes and Biorthogonal", "https://web.stanford.edu/class/ee388/handouts/08_rm_codes.pdf"),
        new LinkItem("CDMA Applications", "https://www.researchgate.net/publication/3333956_Biorthogonal_codes_for_CDMA"),
        new LinkItem("Spread Spectrum Systems", "https://ieeexplore.ieee.org/document/268588")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Moderate Code Rate",
          "Code rate (m+1)/2^m is low for large m. Example: m=4 gives (5/16) = 31.25%."
        ),
        new Vulnerability(
          "Power-of-2 Constraint",
          "Block length must be 2^m, limiting flexibility."
        )
      ];

      // Test vectors for Biorthogonal (8,4) code
      this.tests = [
        {
          text: "Biorthogonal (8,4) all zeros",
          uri: "https://en.wikipedia.org/wiki/Reed%E2%80%93Muller_code",
          input: [0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Biorthogonal (8,4) pattern 0001",
          uri: "https://en.wikipedia.org/wiki/Reed%E2%80%93Muller_code",
          input: [0, 0, 0, 1],
          expected: [0, 0, 0, 1, 1, 1, 1, 0]
        },
        {
          text: "Biorthogonal (8,4) pattern 0010",
          uri: "https://en.wikipedia.org/wiki/Reed%E2%80%93Muller_code",
          input: [0, 0, 1, 0],
          expected: [0, 1, 1, 0, 0, 1, 1, 0]
        },
        {
          text: "Biorthogonal (8,4) pattern 1000",
          uri: "https://en.wikipedia.org/wiki/Reed%E2%80%93Muller_code",
          input: [1, 0, 0, 0],
          expected: [1, 1, 1, 1, 1, 1, 1, 1]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BiorthogonalCodeInstance(this, isInverse);
    }
  }

  /**
 * BiorthogonalCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BiorthogonalCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._m = 3; // Default: (8,4) code
    }

    set m(value) {
      if (value < 2 || value > 5) {
        throw new Error('BiorthogonalCodeInstance.m: Must be between 2 and 5');
      }
      this._m = value;
    }

    get m() {
      return this._m;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BiorthogonalCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.result === null) {
        throw new Error('BiorthogonalCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      const m = this._m;
      const n = OpCodes.Shl32(1, m); // 2^m
      const k = m + 1; // m bits for RM(1,m), 1 bit for complement

      if (data.length !== k) {
        throw new Error(`Biorthogonal encode: Input must be exactly ${k} bits for (${n},${k}) code`);
      }

      // First bit determines if we use complement
      const complement = data[0];

      // Remaining m bits encode using first-order Reed-Muller
      const rmData = data.slice(1);

      // Generate RM(1,m) codeword
      const codeword = new Array(n).fill(0);

      // RM encoding: linear combination of basis vectors
      for (let i = 0; i < m; ++i) {
        if (rmData[i] === 1) {
          for (let j = 0; j < n; ++j) {
            const position = j + 1;
            if (OpCodes.AndN(OpCodes.Shr32(position, i), 1)) {
              codeword[j] ^= 1;
            }
          }
        }
      }

      // Apply complement if needed
      if (complement === 1) {
        for (let j = 0; j < n; ++j) {
          codeword[j] ^= 1;
        }
      }

      return codeword;
    }

    decode(data) {
      const m = this._m;
      const n = OpCodes.Shl32(1, m);
      const k = m + 1;

      if (data.length !== n) {
        throw new Error(`Biorthogonal decode: Input must be exactly ${n} bits for (${n},${k}) code`);
      }

      // Count ones to determine if complement was used
      const onesCount = data.reduce((sum, bit) => sum + bit, 0);
      const complement = (onesCount > n / 2) ? 1 : 0;

      // Undo complement if needed
      const received = complement ? data.map(bit => OpCodes.XorN(bit, 1)) : [...data];

      // Decode using RM correlation
      const rmData = new Array(m).fill(0);

      for (let i = 0; i < m; ++i) {
        let count0 = 0, count1 = 0;

        for (let j = 0; j < n; ++j) {
          const position = j + 1;
          if (OpCodes.AndN(OpCodes.Shr32(position, i), 1)) {
            count1 += received[j];
          } else {
            count0 += received[j];
          }
        }

        // Majority vote
        rmData[i] = (count1 > count0) ? 1 : 0;
      }

      return [complement, ...rmData];
    }

    DetectError(data) {
      const n = OpCodes.Shl32(1, this._m);
      if (data.length !== n) return true;

      try {
        const decoded = this.decode(data);
        const tempInstance = new BiorthogonalCodeInstance(this.algorithm, false);
        tempInstance.m = this._m;
        tempInstance.Feed(decoded);
        const reencoded = tempInstance.Result();

        for (let i = 0; i < n; ++i) {
          if (data[i] !== reencoded[i]) {
            return true;
          }
        }
        return false;
      } catch (e) {
        return true;
      }
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new BiorthogonalCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BiorthogonalCodeAlgorithm, BiorthogonalCodeInstance };
}));
