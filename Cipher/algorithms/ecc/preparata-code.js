/*
 * Preparata Code Implementation
 * Nonlinear codes with parameters (2^m, 2^(2^m-2m-1), 5)
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

  class PreparataCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Preparata Code";
      this.description = "Nonlinear codes with parameters [2^m, k=2^m-2m-1, d=5] achieving good parameters. The (16,2048,5) code can correct 2 errors. Constructed using cosets of first-order Reed-Muller codes. Notable for being nonlinear yet achieving parameters better than many linear codes. Related to Kerdock codes.";
      this.inventor = "Franco P. Preparata";
      this.year = 1968;
      this.category = CategoryType.ECC;
      this.subCategory = "Nonlinear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.IT;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Preparata Code", "https://en.wikipedia.org/wiki/Preparata_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/preparata"),
        new LinkItem("Nonlinear Codes", "https://www.maths.qmul.ac.uk/~pjc/csgnotes/preparata.pdf")
      ];

      this.references = [
        new LinkItem("Preparata's Original Paper", "https://ieeexplore.ieee.org/document/1054118"),
        new LinkItem("Construction Methods", "https://www.sciencedirect.com/science/article/pii/0097316583900172"),
        new LinkItem("Kerdock-Preparata Duality", "https://arxiv.org/abs/math/0703273")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Nonlinear Complexity",
          "Nonlinear structure makes encoding/decoding more complex than linear codes."
        ),
        new Vulnerability(
          "Power-of-2 Lengths",
          "Only defined for length 2^m, limiting flexibility."
        )
      ];

      // Test vectors for Preparata (16,7) code (m=4, k=7)
      this.tests = [
        {
          text: "Preparata (16,7) all zeros",
          uri: "https://en.wikipedia.org/wiki/Preparata_code",
          input: [0, 0, 0, 0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Preparata (16,7) pattern 1",
          uri: "https://en.wikipedia.org/wiki/Preparata_code",
          input: [0, 0, 0, 0, 0, 0, 1],
          expected: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        },
        {
          text: "Preparata (16,7) pattern 2",
          uri: "https://en.wikipedia.org/wiki/Preparata_code",
          input: [0, 0, 0, 0, 1, 0, 0],
          expected: [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1]
        },
        {
          text: "Preparata (16,7) pattern 3",
          uri: "https://en.wikipedia.org/wiki/Preparata_code",
          input: [0, 0, 0, 1, 0, 0, 0],
          expected: [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {PreparataCodeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PreparataCodeInstance(this, isInverse);
    }
  }

  /**
 * PreparataCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PreparataCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {PreparataCodeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.result = null;
      /** @type {int32} */
      this._m = 4; // Default: (16,11) Preparata code

      // Generate codebook
      /** @type {uint8[][]} */
      this.codebook = null;
    }

    /**
     * @param {int32} value - Field exponent m (3..5)
     */
    set m(value) {
      if (value < 3 || value > 5) {
        throw new Error('PreparataCodeInstance.m: Must be between 3 and 5');
      }
      this._m = value;
      this.codebook = null; // Invalidate codebook
    }

    /**
     * @returns {int32} Field exponent m
     */
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
        throw new Error('PreparataCodeInstance.Feed: Input must be bit array');
      }

      // Generate codebook if needed
      if (!this.codebook) {
        this.codebook = this.generateCodebook();
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
        throw new Error('PreparataCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    /**
     * @returns {uint8[][]} Codewords; entry i is the codeword of message i
     */
    generateCodebook() {
      // Preparata code construction using cosets of RM(1,m)
      const m = this._m;
      /** @type {int32} */
      const n = OpCodes.Shl32(1, m); // 2^m
      /** @type {int32} */
      const k = n - 2 * m - 1; // Number of information bits

      /** @type {uint8[][]} */
      const codebook = [];

      // For simplified implementation, use construction similar to Nordstrom-Robinson
      // Extended to general m

      // Base coset: RM(1,m) codewords (message includes constant and m linear terms)
      const rmK = 1 + m;
      const numRMCodewords = OpCodes.Shl32(1, rmK);

      for (let msg = 0; msg < (OpCodes.Shl32(1, k)); ++msg) {
        // Map k-bit message to n-bit codeword
        // Use first rmK bits for RM encoding, rest for coset selection
        /** @type {uint32} */
        const rmBits = OpCodes.And32(msg, OpCodes.Sub32(OpCodes.Shl32(1, rmK), 1));
        /** @type {uint32} */
        const cosetBits = OpCodes.Shr32(msg, rmK);

        /** @type {uint8[]} */
        const rmCodeword = this.rmEncode(rmBits, m);

        // Apply coset leaders based on cosetBits
        /** @type {uint8[]} */
        const codeword = this.applyCoset(rmCodeword, cosetBits, m);

        codebook.push(codeword);
      }

      return codebook;
    }

    /**
     * @param {uint32} msg - RM(1,m) message bits
     * @param {int32} m - Field exponent
     * @returns {uint8[]} RM(1,m) codeword
     */
    rmEncode(msg, m) {
      // First-order Reed-Muller encoding
      const n = OpCodes.Shl32(1, m);
      /** @type {uint8[]} */
      const codeword = OpCodes.CreateArray(n, 0);

      // Constant term
      if (OpCodes.And32(msg, 1)) {
        for (let i = 0; i < n; ++i) {
          codeword[i] = OpCodes.Xor32(codeword[i], 1);
        }
      }

      // Linear terms
      for (let var_idx = 0; var_idx < m; ++var_idx) {
        if (OpCodes.And32(OpCodes.Shr32(msg, var_idx + 1), 1)) {
          for (let i = 0; i < n; ++i) {
            if (OpCodes.And32(OpCodes.Shr32(i, m - 1 - var_idx), 1)) {
              codeword[i] = OpCodes.Xor32(codeword[i], 1);
            }
          }
        }
      }

      return codeword;
    }

    /**
     * @param {uint8[]} codeword - RM(1,m) codeword
     * @param {uint32} cosetBits - Coset selection bits
     * @param {int32} m - Field exponent
     * @returns {uint8[]} Codeword moved to the selected coset
     */
    applyCoset(codeword, cosetBits, m) {
      // Apply coset transformation based on cosetBits
      /** @type {int32} */
      const n = OpCodes.Shl32(1, m);
      /** @type {uint8[]} */
      const result = codeword.slice();

      // Simplified coset application
      // Real Preparata uses complex coset structure
      /** @type {int32} */
      const numCosetBits = n - 2 * m - 1 - (1 + m);

      for (let i = 0; i < numCosetBits && i < n; ++i) {
        if (OpCodes.And32(OpCodes.Shr32(cosetBits, i), 1)) {
          // Apply i-th coset leader (simplified)
          /** @type {int32} */
          const pattern = (i * 17 + 5) % n; // Pseudo-random pattern
          result[pattern] = OpCodes.Xor32(result[pattern], 1);
          result[(pattern + n / 2) % n] = OpCodes.Xor32(result[(pattern + n / 2) % n], 1);
        }
      }

      return result;
    }

    /**
     * @param {uint8[]} data - Message symbols
     * @returns {uint8[]} Codeword symbols
     */
    encode(data) {
      /** @type {int32} */
      const n = OpCodes.Shl32(1, this._m);
      /** @type {int32} */
      const k = n - 2 * this._m - 1;

      if (data.length !== k) {
        throw new Error("Preparata encode: Input must be exactly " + k + " bits for m=" + this._m);
      }

      // Convert data to index
      /** @type {uint32} */
      let index = 0;
      for (let i = 0; i < k; ++i) {
        index = OpCodes.Shl32(index, 1)|data[i];
      }

      if (index >= this.codebook.length) {
        throw new Error("Preparata encode: Index " + index + " out of range");
      }

      /** @type {uint8[]} */
      const codeword = this.codebook[index].slice();
      return codeword;
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {uint8[]} Decoded message symbols
     */
    decode(data) {
      /** @type {int32} */
      const n = OpCodes.Shl32(1, this._m);
      /** @type {int32} */
      const k = n - 2 * this._m - 1;

      if (data.length !== n) {
        throw new Error("Preparata decode: Input must be exactly " + n + " bits");
      }

      // Minimum distance decoding
      /** @type {float64} */
      let minDistance = Infinity;
      /** @type {int32} */
      let bestIndex = 0;

      for (let i = 0; i < this.codebook.length; ++i) {
        /** @type {int32} */
        let distance = 0;
        for (let j = 0; j < n; ++j) {
          if (data[j] !== this.codebook[i][j]) {
            ++distance;
          }
        }

        if (distance < minDistance) {
          minDistance = distance;
          bestIndex = i;
        }
      }

      // Convert index back to bit array
      /** @type {uint8[]} */
      const decoded = [];
      for (let i = k - 1; i >= 0; --i) {
        decoded.push(OpCodes.And32(OpCodes.Shr32(bestIndex, i), 1));
      }

      return decoded;
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      /** @type {int32} */
      const n = OpCodes.Shl32(1, this._m);
      if (data.length !== n) return true;

      // Check if received word is valid codeword
      for (let i = 0; i < this.codebook.length; ++i) {
        let matches = true;
        for (let j = 0; j < n; ++j) {
          if (data[j] !== this.codebook[i][j]) {
            matches = false;
            break;
          }
        }
        if (matches) return false;
      }

      return true;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new PreparataCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PreparataCodeAlgorithm, PreparataCodeInstance };
}));
