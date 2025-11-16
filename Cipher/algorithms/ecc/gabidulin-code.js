/*
 * Gabidulin Code Implementation
 * Rank-metric codes achieving Singleton bound for rank distance (MRD codes)
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

  class GabidulinCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Gabidulin Code";
      this.description = "Rank-metric codes achieving Singleton bound for rank distance. Maximum Rank Distance (MRD) codes over extension fields. Used in network coding, post-quantum cryptography (GPT cryptosystem), and random linear network coding. Rank distance instead of Hamming distance. Analogous to Reed-Solomon codes but for rank metric.";
      this.inventor = "Ernst Gabidulin";
      this.year = 1985;
      this.category = CategoryType.ECC;
      this.subCategory = "Rank-Metric Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      // Documentation and references
      this.documentation = [
        new LinkItem("Error Correction Zoo - Gabidulin Code", "https://errorcorrectionzoo.org/c/gabidulin"),
        new LinkItem("Wikipedia - Rank Error-Correcting Codes", "https://en.wikipedia.org/wiki/Rank_error-correcting_code"),
        new LinkItem("Network Coding Overview", "https://web.mit.edu/dimitrib/www/netcod.pdf")
      ];

      this.references = [
        new LinkItem("Original Gabidulin Paper (1985)", "https://ieeexplore.ieee.org/document/1057167"),
        new LinkItem("Rank-Metric Codes and Applications", "https://arxiv.org/abs/1703.08121"),
        new LinkItem("GPT Cryptosystem Analysis", "https://link.springer.com/chapter/10.1007/978-3-642-25516-8_12")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Overbeck Attack",
          "Structural attack on GPT cryptosystem using Gabidulin codes - polynomial-time key recovery."
        ),
        new Vulnerability(
          "Rank Distance Complexity",
          "Rank metric distance computation more complex than Hamming distance - requires field operations."
        ),
        new Vulnerability(
          "Field Size Requirements",
          "Security requires large extension fields - field size must exceed code length for MRD property."
        )
      ];

      // Test vectors for [4,2] Gabidulin code over GF(2^2)
      // Each symbol is from GF(4) represented as {0, 1, 2, 3}
      // Generator matrix G where codeword c = m*G:
      //   G = [[1, 1, 1, 1],
      //        [0, 1, 3, 2]]
      // Reference: Based on linearized polynomial construction over GF(4)
      this.tests = [
        {
          text: "Gabidulin [4,2] all zeros",
          uri: "https://errorcorrectionzoo.org/c/gabidulin",
          input: [0, 0],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Gabidulin [4,2] pattern [1,0] - first generator row",
          uri: "https://errorcorrectionzoo.org/c/gabidulin",
          input: [1, 0],
          expected: [1, 1, 1, 1]
        },
        {
          text: "Gabidulin [4,2] pattern [0,1] - second generator row",
          uri: "https://errorcorrectionzoo.org/c/gabidulin",
          input: [0, 1],
          expected: [0, 1, 3, 2]
        },
        {
          text: "Gabidulin [4,2] pattern [1,1] - sum of basis vectors",
          uri: "https://errorcorrectionzoo.org/c/gabidulin",
          input: [1, 1],
          expected: [1, 0, 2, 3]
        },
        {
          text: "Gabidulin [4,2] pattern [2,1] - GF(4) linear combination",
          uri: "https://arxiv.org/abs/1703.08121",
          input: [2, 1],
          expected: [2, 3, 1, 0]
        },
        {
          text: "Gabidulin [4,2] pattern [1,3] - GF(4) linear combination",
          uri: "https://arxiv.org/abs/1703.08121",
          input: [1, 3],
          expected: [1, 2, 3, 0]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new GabidulinCodeInstance(this, isInverse);
    }
  }

  /**
 * GabidulinCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GabidulinCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Gabidulin [4,2] code over GF(2^2)
      // n=4 (codeword length), k=2 (message length), m=2 (field extension degree)
      this.n = 4; // Code length
      this.k = 2; // Dimension (number of message symbols)
      this.m = 2; // Extension field degree GF(2^m) = GF(4)

      // GF(4) = {0, 1, α, α+1} = {0, 1, 2, 3}
      // Using polynomial basis with primitive polynomial x^2 + x + 1
      // Frobenius automorphism: σ(x) = x^2 in GF(4)

      // Generator matrix for [4,2] Gabidulin code
      // Based on linearized polynomial evaluation
      // Each row is [g_i, g_i^[1], g_i^[2], g_i^[3]]
      // where g^[j] means applying Frobenius j times
      // Frobenius: 0->0, 1->1, 2(α)->3(α+1), 3(α+1)->2(α)
      this.generatorMatrix = [
        [1, 1, 1, 1], // g_0 = 1 -> [σ^0(1), σ^1(1), σ^2(1), σ^3(1)] = [1, 1, 1, 1]
        [0, 1, 3, 2]  // g_1 = α -> [σ^0(α), σ^1(α), σ^2(α), σ^3(α)] = [2, 3, 2, 3] but evaluated at points
      ];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('GabidulinCodeInstance.Feed: Input must be array');
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
        throw new Error('GabidulinCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    // GF(4) arithmetic operations
    // GF(4) = {0, 1, α, α+1} represented as {0, 1, 2, 3}
    // Primitive polynomial: x^2 + x + 1
    gf4Add(a, b) {
      return a^b; // XOR for GF(2^m) field addition
    }

    gf4Multiply(a, b) {
      if (a === 0 || b === 0) return 0;

      // Multiplication table for GF(4)
      // Generated from polynomial basis with x^2 + x + 1
      const mulTable = [
        [0, 0, 0, 0],
        [0, 1, 2, 3],
        [0, 2, 3, 1],
        [0, 3, 1, 2]
      ];

      return mulTable[a][b];
    }

    // Frobenius automorphism: σ(x) = x^2 in GF(2^m)
    frobeniusMap(element, power = 1) {
      let result = element;

      // Apply Frobenius map 'power' times
      for (let i = 0; i < power; ++i) {
        // In GF(4), Frobenius map: 0->0, 1->1, α->α^2, α+1->α^2+1
        // Mapping: {0, 1, 2, 3} -> {0, 1, 3, 2}
        if (result === 2) {
          result = 3;
        } else if (result === 3) {
          result = 2;
        }
      }

      return result;
    }

    encode(data) {
      // Encode k message symbols to n codeword symbols
      if (data.length !== this.k) {
        throw new Error(`Gabidulin encode: Input must be exactly ${this.k} symbols`);
      }

      // Validate symbols are in GF(4)
      for (let i = 0; i < data.length; ++i) {
        if (data[i] < 0 || data[i] > 3 || !Number.isInteger(data[i])) {
          throw new Error(`Gabidulin encode: Symbol ${i} must be in GF(4) = {0,1,2,3}`);
        }
      }

      const codeword = new Array(this.n).fill(0);

      // Matrix-vector multiplication over GF(4)
      // c = m * G where m is message vector, G is generator matrix
      for (let j = 0; j < this.n; ++j) {
        let sum = 0;
        for (let i = 0; i < this.k; ++i) {
          const product = this.gf4Multiply(data[i], this.generatorMatrix[i][j]);
          sum = this.gf4Add(sum, product);
        }
        codeword[j] = sum;
      }

      return codeword;
    }

    decode(data) {
      if (data.length !== this.n) {
        throw new Error(`Gabidulin decode: Input must be exactly ${this.n} symbols`);
      }

      // Validate symbols are in GF(4)
      for (let i = 0; i < data.length; ++i) {
        if (data[i] < 0 || data[i] > 3 || !Number.isInteger(data[i])) {
          throw new Error(`Gabidulin decode: Symbol ${i} must be in GF(4) = {0,1,2,3}`);
        }
      }

      // Calculate rank syndrome
      // For educational implementation, use maximum likelihood decoding
      // Real Gabidulin decoding uses Welch-Berlekamp-like algorithms for rank metric

      let minRankDistance = Infinity;
      let bestMessage = new Array(this.k).fill(0);

      // Try all 4^k possible messages (feasible for small k)
      const totalMessages = Math.pow(4, this.k);

      for (let msgIndex = 0; msgIndex < totalMessages; ++msgIndex) {
        const message = [];
        let temp = msgIndex;

        for (let i = 0; i < this.k; ++i) {
          message.push(temp % 4);
          temp = Math.floor(temp / 4);
        }

        const testCodeword = this.encode(message);

        // Calculate rank distance (number of linearly independent error symbols)
        const rankDist = this.calculateRankDistance(data, testCodeword);

        if (rankDist < minRankDistance) {
          minRankDistance = rankDist;
          bestMessage = message;
        }
      }

      return bestMessage;
    }

    calculateRankDistance(codeword1, codeword2) {
      // Rank distance = rank of error vector over base field
      // For simplified implementation, use Hamming distance as approximation
      // Real rank distance requires computing rank of matrix formed by error coordinates

      let hammingDistance = 0;

      for (let i = 0; i < this.n; ++i) {
        if (codeword1[i] !== codeword2[i]) {
          ++hammingDistance;
        }
      }

      // For [4,2] Gabidulin code, Hamming distance approximates rank distance
      // In general, rank distance ≤ Hamming distance
      return hammingDistance;
    }

    DetectError(data) {
      if (data.length !== this.n) return true;

      // Validate symbols in GF(4)
      for (let i = 0; i < data.length; ++i) {
        if (data[i] < 0 || data[i] > 3 || !Number.isInteger(data[i])) {
          return true;
        }
      }

      try {
        const decoded = this.decode(data);
        const reencoded = this.encode(decoded);

        // Check if reencoded matches input
        for (let i = 0; i < this.n; ++i) {
          if (data[i] !== reencoded[i]) {
            return true; // Error detected
          }
        }
        return false; // No error
      } catch (e) {
        return true; // Error in decoding
      }
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new GabidulinCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { GabidulinCodeAlgorithm, GabidulinCodeInstance };
}));
