/*
 * Lexicographic Code Implementation
 * Greedy construction achieving good minimum distance
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

  class LexicographicCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Lexicographic Code";
      this.description = "Greedy construction method for error correction codes. Builds codebook by adding codewords in lexicographic order that maintain minimum distance constraint. Simple construction yields codes including Hamming and Golay codes. Demonstrates fundamental code construction principles.";
      this.inventor = "Unknown (classical technique)";
      this.year = 1960;
      this.category = CategoryType.ECC;
      this.subCategory = "Constructed Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = null;

      // Documentation and references
      this.documentation = [
        new LinkItem("Lexicographic Codes", "https://www.sciencedirect.com/topics/computer-science/lexicographic-code"),
        new LinkItem("Greedy Construction", "https://www.win.tue.nl/~aeb/codes/Andw.html"),
        new LinkItem("Code Construction Methods", "http://www.lix.polytechnique.fr/~sorger/cours/Codes/courseSlides3.pdf")
      ];

      this.references = [
        new LinkItem("Coding Theory Basics", "https://www.springer.com/gp/book/9783540641339"),
        new LinkItem("Optimal Codes", "https://ieeexplore.ieee.org/document/1055404"),
        new LinkItem("Greedy Algorithms", "https://www.cs.cmu.edu/~avrim/451f11/lectures/lect1004.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Suboptimal Parameters",
          "Greedy construction does not always yield optimal codes. May have fewer codewords than best-known codes."
        ),
        new Vulnerability(
          "Construction Complexity",
          "Building codebook requires checking all previous codewords, O(n²) complexity."
        )
      ];

      // Test vectors for Lexicographic (7,4,3) code (constructs to Hamming parameters)
      this.tests = [
        {
          text: "Lexicographic (7,3) zeros",
          uri: "https://www.sciencedirect.com/topics/computer-science/lexicographic-code",
          n: 7,
          d: 3,
          input: [0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Lexicographic (7,3) pattern 1",
          uri: "https://www.sciencedirect.com/topics/computer-science/lexicographic-code",
          n: 7,
          d: 3,
          input: [0, 0, 0, 1],
          expected: [0, 0, 0, 0, 1, 1, 1]
        },
        {
          text: "Lexicographic (7,3) pattern 2",
          uri: "https://www.sciencedirect.com/topics/computer-science/lexicographic-code",
          n: 7,
          d: 3,
          input: [0, 0, 1, 0],
          expected: [0, 0, 1, 1, 0, 0, 1]
        },
        {
          text: "Lexicographic (7,3) pattern 3",
          uri: "https://www.sciencedirect.com/topics/computer-science/lexicographic-code",
          n: 7,
          d: 3,
          input: [0, 1, 0, 0],
          expected: [0, 1, 0, 1, 0, 1, 0]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LexicographicCodeInstance(this, isInverse);
    }
  }

  /**
 * LexicographicCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LexicographicCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._n = 7; // Default: length 7
      this._d = 3; // Default: minimum distance 3
      this.codebook = null;
    }

    set n(value) {
      if (value < 3 || value > 16) {
        throw new Error('LexicographicCodeInstance.n: Must be between 3 and 16');
      }
      this._n = value;
      this.codebook = null; // Invalidate codebook
    }

    get n() {
      return this._n;
    }

    set d(value) {
      if (value < 1 || value > this._n) {
        throw new Error(`LexicographicCodeInstance.d: Must be between 1 and ${this._n}`);
      }
      this._d = value;
      this.codebook = null; // Invalidate codebook
    }

    get d() {
      return this._d;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('LexicographicCodeInstance.Feed: Input must be bit array');
      }

      // Ensure codebook is generated
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
        throw new Error('LexicographicCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    generateCodebook() {
      // Greedy lexicographic construction
      const codebook = [];
      const n = this._n;
      const d = this._d;

      // Always include all-zeros codeword
      codebook.push(new Array(n).fill(0));

      // Try adding codewords in lexicographic order
      for (let candidate = 1; candidate < (1 << n); ++candidate) {
        // Convert candidate to bit array
        const codeword = [];
        for (let i = n - 1; i >= 0; --i) {
          codeword.push((candidate >> i) & 1);
        }

        // Check if this codeword has minimum distance d from all existing codewords
        let validCodeword = true;
        for (let existing of codebook) {
          const distance = this.hammingDistance(codeword, existing);
          if (distance < d) {
            validCodeword = false;
            break;
          }
        }

        if (validCodeword) {
          codebook.push(codeword);
        }
      }

      return codebook;
    }

    hammingDistance(a, b) {
      let distance = 0;
      for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) ++distance;
      }
      return distance;
    }

    encode(data) {
      if (!this.codebook) {
        this.codebook = this.generateCodebook();
      }

      // Calculate k (number of message bits)
      const k = Math.floor(Math.log2(this.codebook.length));

      if (data.length !== k) {
        throw new Error(`Lexicographic encode: Input must be exactly ${k} bits for (${this._n}, ${this._d}) code`);
      }

      // Convert data to index
      let index = 0;
      for (let i = 0; i < k; ++i) {
        index = (index << 1) | data[i];
      }

      if (index >= this.codebook.length) {
        throw new Error(`Lexicographic encode: Index ${index} out of range (codebook size: ${this.codebook.length})`);
      }

      return [...this.codebook[index]];
    }

    decode(data) {
      if (!this.codebook) {
        this.codebook = this.generateCodebook();
      }

      if (data.length !== this._n) {
        throw new Error(`Lexicographic decode: Input must be exactly ${this._n} bits`);
      }

      // Minimum distance decoding
      let minDistance = Infinity;
      let bestIndex = 0;

      for (let i = 0; i < this.codebook.length; ++i) {
        const distance = this.hammingDistance(data, this.codebook[i]);
        if (distance < minDistance) {
          minDistance = distance;
          bestIndex = i;
        }
      }

      // Convert index back to bit array
      const k = Math.floor(Math.log2(this.codebook.length));
      const decoded = [];
      for (let i = k - 1; i >= 0; --i) {
        decoded.push((bestIndex >> i) & 1);
      }

      return decoded;
    }

    DetectError(data) {
      if (!this.codebook) {
        this.codebook = this.generateCodebook();
      }

      if (data.length !== this._n) return true;

      // Check if received word is valid codeword
      for (let codeword of this.codebook) {
        let matches = true;
        for (let i = 0; i < this._n; ++i) {
          if (data[i] !== codeword[i]) {
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

  const algorithmInstance = new LexicographicCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LexicographicCodeAlgorithm, LexicographicCodeInstance };
}));
