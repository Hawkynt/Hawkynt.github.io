/*
 * Simplex Code Implementation
 * Dual of the Hamming code with parameters [2^m-1, m, 2^(m-1)]
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

  class SimplexCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Simplex Code";
      this.description = "Dual of Hamming code with parameters [2^m-1, m, 2^(m-1)]. All non-zero codewords have constant Hamming weight 2^(m-1). Maximal-length linear codes with excellent error correction properties. Used in communication systems requiring equidistant codewords.";
      this.inventor = "David E. Muller (dual concept)";
      this.year = 1954;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Simplex Code", "https://en.wikipedia.org/wiki/Simplex_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/simplex"),
        new LinkItem("Dual Codes Tutorial", "http://www.inference.org.uk/mackay/codes/dual.html")
      ];

      this.references = [
        new LinkItem("Linear Codes Theory", "https://web.stanford.edu/class/ee387/handouts/notes7.pdf"),
        new LinkItem("Simplex Code Properties", "https://www.researchgate.net/publication/220576843_On_the_Simplex_Code"),
        new LinkItem("MacWilliams Identity", "https://en.wikipedia.org/wiki/MacWilliams_identity")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Very Low Code Rate",
          "Code rate m/(2^m-1) decreases exponentially with m. Example: m=4 gives rate 4/15 = 26.7%."
        ),
        new Vulnerability(
          "Fixed Parameters",
          "Block length must be 2^m-1, limiting flexibility in practical applications."
        )
      ];

      // Test vectors for Simplex (7,3) code (dual of Hamming (7,4))
      this.tests = [
        {
          text: "Simplex (7,3) all zeros",
          uri: "https://en.wikipedia.org/wiki/Simplex_code",
          input: [0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Simplex (7,3) pattern 001",
          uri: "https://en.wikipedia.org/wiki/Simplex_code",
          input: [0, 0, 1],
          expected: [0, 0, 0, 1, 1, 1, 1]
        },
        {
          text: "Simplex (7,3) pattern 010",
          uri: "https://en.wikipedia.org/wiki/Simplex_code",
          input: [0, 1, 0],
          expected: [0, 1, 1, 0, 0, 1, 1]
        },
        {
          text: "Simplex (7,3) pattern 100",
          uri: "https://en.wikipedia.org/wiki/Simplex_code",
          input: [1, 0, 0],
          expected: [1, 0, 1, 0, 1, 0, 1]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SimplexCodeInstance(this, isInverse);
    }
  }

  class SimplexCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._m = 3; // Default: Simplex (7,3)
    }

    set m(value) {
      if (value < 2 || value > 5) {
        throw new Error('SimplexCodeInstance.m: Must be between 2 and 5');
      }
      this._m = value;
    }

    get m() {
      return this._m;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('SimplexCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('SimplexCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      const m = this._m;
      const n = (1 << m) - 1; // 2^m - 1

      if (data.length !== m) {
        throw new Error(`Simplex encode: Input must be exactly ${m} bits for Simplex(${n},${m})`);
      }

      // Simplex code generator matrix is the transpose of Hamming parity-check matrix
      // Each row corresponds to a column of the Hamming parity-check matrix
      const codeword = new Array(n).fill(0);

      // Generate codeword by linear combination of basis vectors
      for (let i = 0; i < m; ++i) {
        if (data[i] === 1) {
          // Add the i-th basis vector (column i+1 of Hamming parity check in binary)
          for (let j = 0; j < n; ++j) {
            const position = j + 1;
            // Check if bit i is set in position
            if ((position >> i) & 1) {
              codeword[j] ^= 1;
            }
          }
        }
      }

      return codeword;
    }

    decode(data) {
      const m = this._m;
      const n = (1 << m) - 1;

      if (data.length !== n) {
        throw new Error(`Simplex decode: Input must be exactly ${n} bits for Simplex(${n},${m})`);
      }

      const decoded = new Array(m).fill(0);

      // Correlate with all possible codewords (2^m total)
      let maxCorrelation = -Infinity;
      let bestMessage = 0;

      for (let msg = 0; msg < (1 << m); ++msg) {
        // Generate codeword for this message
        const testCodeword = new Array(n).fill(0);
        for (let i = 0; i < m; ++i) {
          if ((msg >> i) & 1) {
            for (let j = 0; j < n; ++j) {
              const position = j + 1;
              if ((position >> i) & 1) {
                testCodeword[j] ^= 1;
              }
            }
          }
        }

        // Calculate correlation (Hamming distance)
        let correlation = 0;
        for (let j = 0; j < n; ++j) {
          correlation += (data[j] === testCodeword[j]) ? 1 : -1;
        }

        if (correlation > maxCorrelation) {
          maxCorrelation = correlation;
          bestMessage = msg;
        }
      }

      // Convert bestMessage to bit array
      for (let i = 0; i < m; ++i) {
        decoded[i] = (bestMessage >> i) & 1;
      }

      return decoded;
    }

    DetectError(data) {
      const n = (1 << this._m) - 1;
      if (data.length !== n) return true;

      try {
        const decoded = this.decode(data);
        const tempInstance = new SimplexCodeInstance(this.algorithm, false);
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

  const algorithmInstance = new SimplexCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SimplexCodeAlgorithm, SimplexCodeInstance };
}));
