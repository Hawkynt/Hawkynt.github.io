/*
 * Hadamard Code (Walsh-Hadamard Code) Implementation
 * First-order Reed-Muller code used in CDMA and space communications
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

  class HadamardCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Hadamard Code";
      this.description = "Walsh-Hadamard error correction code that encodes k bits into 2^k bits. Can correct up to (2^(k-1) - 1) / 2 errors. Used in Mariner 9 spacecraft and CDMA communication. Highly redundant but powerful for low-rate applications.";
      this.inventor = "Jacques Hadamard (matrix), Joseph L. Walsh (functions)";
      this.year = 1893;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.FR;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Hadamard Code", "https://en.wikipedia.org/wiki/Hadamard_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/hadamard"),
        new LinkItem("Hadamard Matrices Tutorial", "http://homepages.math.uic.edu/~leon/mcs425-s08/handouts/Hadamard_codes.pdf")
      ];

      this.references = [
        new LinkItem("Mariner 9 Application", "https://en.wikipedia.org/wiki/Hadamard_code"),
        new LinkItem("Walsh-Hadamard in CDMA", "https://www.gaussianwaves.com/2011/03/03/walsh-hadamard-code-matlab-simulation-2/"),
        new LinkItem("Fast Decoding Algorithm", "https://theory.epfl.ch/courses/topicstcs/Lecture6.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Very Low Code Rate",
          "Code rate is k/2^k, extremely inefficient for large k. Example: k=6 gives rate 6/64 = 9.4%."
        ),
        new Vulnerability(
          "Power-of-2 Constraint",
          "Message length must be a power of 2, limiting flexibility."
        )
      ];

      // Test vectors for Hadamard (8,3) code
      this.tests = [
        {
          text: "Hadamard (8,3) all zeros",
          uri: "https://en.wikipedia.org/wiki/Hadamard_code",
          input: [0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Hadamard (8,3) pattern 001",
          uri: "https://en.wikipedia.org/wiki/Hadamard_code",
          input: [0, 0, 1],
          expected: [0, 1, 0, 1, 0, 1, 0, 1]
        },
        {
          text: "Hadamard (8,3) pattern 010",
          uri: "https://en.wikipedia.org/wiki/Hadamard_code",
          input: [0, 1, 0],
          expected: [0, 0, 1, 1, 0, 0, 1, 1]
        },
        {
          text: "Hadamard (8,3) all ones",
          uri: "https://en.wikipedia.org/wiki/Hadamard_code",
          input: [1, 1, 1],
          expected: [0, 1, 1, 0, 1, 0, 0, 1]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new HadamardCodeInstance(this, isInverse);
    }
  }

  class HadamardCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('HadamardCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('HadamardCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      const k = data.length;
      const n = 1 << k; // 2^k

      // Convert data bits to index
      let index = 0;
      for (let i = 0; i < k; ++i) {
        index = (index << 1) | data[i];
      }

      // Generate Hadamard codeword using Walsh functions
      const codeword = new Array(n);
      for (let i = 0; i < n; ++i) {
        // Walsh function evaluation: count bits in (index & i)
        let dotProduct = 0;
        let temp = index & i;
        while (temp > 0) {
          dotProduct ^= (temp & 1);
          temp >>= 1;
        }
        codeword[i] = dotProduct;
      }

      return codeword;
    }

    decode(data) {
      const n = data.length;

      // Verify n is power of 2
      if ((n & (n - 1)) !== 0) {
        throw new Error('Hadamard decode: Input length must be power of 2');
      }

      const k = Math.log2(n);

      // Fast Hadamard Transform for decoding
      const correlations = new Array(n).fill(0);

      // Calculate correlation with all Walsh functions
      for (let index = 0; index < n; ++index) {
        let correlation = 0;
        for (let i = 0; i < n; ++i) {
          // Walsh function evaluation
          let dotProduct = 0;
          let temp = index & i;
          while (temp > 0) {
            dotProduct ^= (temp & 1);
            temp >>= 1;
          }

          // Correlate with received data
          correlation += (data[i] === dotProduct) ? 1 : -1;
        }
        correlations[index] = Math.abs(correlation);
      }

      // Find maximum correlation (most likely codeword)
      let maxCorr = correlations[0];
      let decodedIndex = 0;
      for (let i = 1; i < n; ++i) {
        if (correlations[i] > maxCorr) {
          maxCorr = correlations[i];
          decodedIndex = i;
        }
      }

      // Convert index back to bits
      const decoded = new Array(k);
      for (let i = k - 1; i >= 0; --i) {
        decoded[i] = decodedIndex & 1;
        decodedIndex >>= 1;
      }

      return decoded;
    }

    DetectError(data) {
      const n = data.length;
      if ((n & (n - 1)) !== 0) return true;

      const k = Math.log2(n);

      // Try to decode and re-encode to check if valid codeword
      try {
        const decoded = this.decode(data);
        const tempInstance = new HadamardCodeInstance(this.algorithm, false);
        tempInstance.Feed(decoded);
        const reencoded = tempInstance.Result();

        // Check if matches original
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

  const algorithmInstance = new HadamardCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HadamardCodeAlgorithm, HadamardCodeInstance };
}));
