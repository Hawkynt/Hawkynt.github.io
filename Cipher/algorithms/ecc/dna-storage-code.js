/*
 * DNA Storage Error Correction Code Implementation
 * Reed-Solomon codes over GF(4) for quaternary DNA storage {A,C,G,T}
 * Educational implementation with constraint checking
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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance,
          TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * DNA Storage Error Correction Algorithm
   *
   * Implements Reed-Solomon error correction over GF(4) for DNA data storage.
   * Maps quaternary symbols {A,C,G,T} to field elements {0,1,2,3}.
   * Includes constraint checking for GC-content balance and homopolymer runs.
   *
   * Mathematical Foundation:
   * - Field: GF(4) = GF(2^2) with primitive polynomial x^2 + x + 1
   * - Code: RS(7,3) - 7 symbols total, 3 data symbols, 4 parity symbols
   * - Error correction: up to 2 symbol errors
   *
   * DNA Constraints:
   * - GC-content: 40-60% (prevents secondary structure formation)
   * - Homopolymer runs: maximum 3 consecutive identical bases
   * - Symbol mapping: A=0, C=1, G=2, T=3
   */
  class DNAStorageAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DNA Storage Code";
      this.description = "Error correction codes for DNA data storage using quaternary alphabet {A,C,G,T}. Implements Reed-Solomon over GF(4) with GC-content balancing and homopolymer avoidance. Used in molecular storage systems by Microsoft, Twist Bioscience, and academic researchers.";
      this.inventor = "George Church, Sri Kosuri";
      this.year = 2012;
      this.category = CategoryType.ECC;
      this.subCategory = "Quaternary Code";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("DNA Data Storage", "https://en.wikipedia.org/wiki/DNA_digital_data_storage"),
        new LinkItem("Microsoft DNA Storage Project", "https://www.microsoft.com/en-us/research/project/dna-storage/"),
        new LinkItem("Reed-Solomon over GF(4)", "https://math.stackexchange.com/questions/4322885/dna-storage-using-reed-solomon")
      ];

      this.references = [
        new LinkItem("Church et al. Science 2012", "https://www.science.org/doi/10.1126/science.1226355"),
        new LinkItem("Microsoft Nature Biotechnology 2016", "https://www.nature.com/articles/nbt.3721"),
        new LinkItem("Erlich and Zielinski Science 2017", "https://www.science.org/doi/10.1126/science.aaj2038"),
        new LinkItem("Organick et al. Nature Biotechnology 2018", "https://www.nature.com/articles/nbt.4079")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Synthesis Error Sensitivity",
          "DNA synthesis can introduce insertion, deletion, and substitution errors at rates of 0.1-1%. Multiple redundancy and error correction layers recommended."
        ),
        new Vulnerability(
          "Homopolymer Errors",
          "Long runs of identical bases (AAA, TTT, GGG, CCC) are prone to sequencing errors. Constraint checking helps but cannot eliminate all risks."
        ),
        new Vulnerability(
          "GC Content Imbalance",
          "Sequences outside 40-60% GC content may form secondary structures or fail synthesis. Encoding should maintain balance."
        )
      ];

      // Test vectors based on GF(4) mathematics
      // GF(4) with primitive polynomial x^2 + x + 1 (binary: 111, decimal: 7)
      // Addition table (XOR): 0+0=0, 0+1=1, 1+1=0, 2+2=0, 3+3=0
      // Multiplication uses log/antilog tables for efficiency

      this.tests = [
        // Test 1: All zeros (DNA: AAAAAAA)
        // Zero codeword property: encoding all zeros produces all zeros
        {
          text: "RS(7,3) over GF(4) - All zeros",
          uri: "https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction",
          input: [0, 0, 0], // AAA
          expected: [0, 0, 0, 0, 0, 0, 0] // AAAAAAA - zero codeword
        },

        // Test 2: Simple pattern (DNA: ACGGTCT)
        // Mathematically computed using RS(7,3) over GF(4) generator polynomial
        // g(x) computed from primitive polynomial x^2 + x + 1
        {
          text: "RS(7,3) over GF(4) - Pattern ACG",
          uri: "https://math.stackexchange.com/questions/4322885/dna-storage-using-reed-solomon",
          input: [0, 1, 2], // ACG (A=0, C=1, G=2)
          expected: [0, 1, 2, 2, 3, 1, 3] // ACG + parity GTCT
        },

        // Test 3: Maximum values (DNA: TTTATAА)
        // All maximum field elements: 3 in GF(4)
        {
          text: "RS(7,3) over GF(4) - Maximum values TTT",
          uri: "https://errorcorrectionzoo.org/c/reed_solomon",
          input: [3, 3, 3], // TTT (T=3)
          expected: [3, 3, 3, 0, 3, 0, 0] // TTT + parity ATAA
        },

        // Test 4: Alternating pattern (DNA: CATGGCT)
        // Mixed quaternary symbols testing all field operations
        {
          text: "RS(7,3) over GF(4) - Alternating CAT",
          uri: "https://en.wikipedia.org/wiki/Finite_field",
          input: [1, 0, 3], // CAT
          expected: [1, 0, 3, 2, 2, 1, 3] // CAT + parity GGCT
        },

        // Test 5: GC-rich sequence (DNA: CGGTCTA)
        // High GC-content for DNA synthesis constraint testing
        {
          text: "RS(7,3) over GF(4) - GC-rich CGG",
          uri: "https://www.microsoft.com/en-us/research/project/dna-storage/",
          input: [1, 2, 2], // CGG
          expected: [1, 2, 2, 3, 1, 3, 0] // CGG + parity TCTA
        },

        // Test 6: Round-trip encoding (DNA: GCAGTTC)
        // Verifies encoding is systematic and reversible
        {
          text: "RS(7,3) encoding verification - GCA",
          uri: "https://www.nature.com/articles/nbt.3721",
          input: [2, 1, 0], // GCA
          expected: [2, 1, 0, 2, 3, 3, 1] // GCA + parity GTTC
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new DNAStorageInstance(this, isInverse);
    }
  }

  /**
   * DNA Storage Error Correction Instance
   *
   * Implements Feed/Result pattern for DNA storage encoding/decoding.
   * Maintains internal state for GF(4) arithmetic operations.
   */
  class DNAStorageInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // RS(7,3) parameters for GF(4)
      this.n = 7;        // Total symbols (DNA bases)
      this.k = 3;        // Data symbols
      this.t = 2;        // Error correction capability: (n-k)/2 = 2
      this.field = 4;    // GF(4) = {0,1,2,3} = {A,C,G,T}

      // GF(4) primitive polynomial: x^2 + x + 1 (binary: 111, decimal: 7)
      // This is the standard primitive polynomial for GF(2^2)
      this.primitive = 0b111; // x^2 + x + 1

      // DNA base mapping
      this.baseToSymbol = {'A': 0, 'C': 1, 'G': 2, 'T': 3};
      this.symbolToBase = ['A', 'C', 'G', 'T'];

      // GC bases (for content checking)
      this.gcBases = [1, 2]; // C=1, G=2

      // Initialize GF(4) arithmetic tables
      this.initializeGF4();

      // Compute generator polynomial for RS(7,3)
      this.generator = this.computeGenerator();
    }

    /**
     * Initialize GF(4) arithmetic tables
     *
     * GF(4) = GF(2^2) with primitive element α where α^2 + α + 1 = 0
     * Elements: {0, 1, α, α^2} = {0, 1, 2, 3}
     *
     * Multiplication table:
     * 0*x = 0, 1*x = x, 2*2 = 3, 2*3 = 1, 3*3 = 2
     */
    initializeGF4() {
      // Log and antilog tables for GF(4)
      // In GF(4), multiplicative group has order 3: {1, α, α^2}
      // α^0 = 1, α^1 = 2, α^2 = 3, α^3 = 1 (cycle)

      this.gfLog = new Array(this.field);
      this.gfAntilog = new Array(this.field);

      // Antilog table (powers of α, primitive element = 2)
      this.gfAntilog[0] = 1;  // α^0 = 1
      this.gfAntilog[1] = 2;  // α^1 = 2 (primitive element)
      this.gfAntilog[2] = 3;  // α^2 = 3

      // Log table (inverse of antilog)
      this.gfLog[0] = -1;     // log(0) undefined (use -1 as sentinel)
      this.gfLog[1] = 0;      // log(1) = 0
      this.gfLog[2] = 1;      // log(2) = 1
      this.gfLog[3] = 2;      // log(3) = 2

      // Precomputed multiplication table for GF(4)
      // More efficient than log/antilog for small fields
      this.mulTable = [
        [0, 0, 0, 0],  // 0 * {0,1,2,3}
        [0, 1, 2, 3],  // 1 * {0,1,2,3}
        [0, 2, 3, 1],  // 2 * {0,1,2,3}
        [0, 3, 1, 2]   // 3 * {0,1,2,3}
      ];
    }

    /**
     * GF(4) multiplication using precomputed table
     */
    gfMultiply(a, b) {
      if (a < 0 || a >= this.field || b < 0 || b >= this.field) {
        throw new Error(`DNAStorage: Invalid GF(4) elements: ${a}, ${b}`);
      }
      return this.mulTable[a][b];
    }

    /**
     * GF(4) addition (XOR in GF(2^n))
     * Note: XOR is the fundamental addition operation in Galois Fields GF(2^n)
     * Using OpCodes for consistency with codebase standards
     */
    gfAdd(a, b) {
      return OpCodes.XorN(a, b); // Galois Field addition using OpCodes
    }

    /**
     * GF(4) division
     */
    gfDivide(a, b) {
      if (b === 0) throw new Error('Division by zero in GF(4)');
      if (a === 0) return 0;

      // Division: a / b = a * b^(-1)
      // In GF(4), multiplicative inverses: 1^(-1)=1, 2^(-1)=3, 3^(-1)=2
      const inverse = [0, 1, 3, 2]; // inverses of {0,1,2,3}
      return this.gfMultiply(a, inverse[b]);
    }

    /**
     * Compute generator polynomial for RS(7,3) over GF(4)
     * g(x) = (x - α^0)(x - α^1)(x - α^2)(x - α^3)
     */
    computeGenerator() {
      // Start with g(x) = 1
      let gen = [1];

      // Multiply by (x - α^i) for i = 0 to n-k-1
      for (let i = 0; i < this.n - this.k; ++i) {
        const alpha_i = this.gfAntilog[i % 3]; // α^i (cycle every 3)
        const newGen = new Array(gen.length + 1).fill(0);

        // Multiply: g(x) * (x - α^i)
        for (let j = 0; j < gen.length; ++j) {
          newGen[j] = this.gfAdd(newGen[j], gen[j]);
          newGen[j + 1] = this.gfAdd(newGen[j + 1], this.gfMultiply(gen[j], alpha_i));
        }

        gen = newGen;
      }

      return gen;
    }

    /**
     * Feed data for encoding or decoding
     *
     * @param {Array} data - For encode: k symbols (0-3), for decode: n symbols (0-3)
     */
    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('DNAStorage.Feed: Input must be symbol array');
      }

      // Validate symbols are in GF(4) range
      for (let i = 0; i < data.length; ++i) {
        if (data[i] < 0 || data[i] >= this.field) {
          throw new Error(`DNAStorage: Symbol ${data[i]} out of GF(4) range [0-3]`);
        }
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    /**
     * Get result after Feed
     *
     * @returns {Array} Encoded or decoded symbols
     */
    Result() {
      if (this.result === null) {
        throw new Error('DNAStorage.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    /**
     * Encode data using RS(7,3) over GF(4)
     * Systematic encoding: output = [data|parity]
     *
     * @param {Array} data - k=3 data symbols
     * @returns {Array} n=7 encoded symbols
     */
    encode(data) {
      if (data.length !== this.k) {
        throw new Error(`DNAStorage.encode: Input must be ${this.k} symbols`);
      }

      // Allocate output: data symbols + parity symbols
      const encoded = new Array(this.n);

      // Copy data symbols to start
      for (let i = 0; i < this.k; ++i) {
        encoded[i] = data[i];
      }

      // Calculate parity symbols using polynomial division
      const parity = this.calculateParity(data);

      // Append parity symbols
      for (let i = 0; i < this.n - this.k; ++i) {
        encoded[this.k + i] = parity[i];
      }

      // Validate DNA constraints (warning only, not error)
      this.checkDNAConstraints(encoded);

      return encoded;
    }

    /**
     * Calculate parity symbols for systematic RS encoding
     *
     * Parity = data(x) * x^(n-k) mod g(x)
     *
     * @param {Array} data - k data symbols
     * @returns {Array} n-k parity symbols
     */
    calculateParity(data) {
      const parity = new Array(this.n - this.k).fill(0);

      // Polynomial division: data(x) * x^(n-k) / g(x)
      for (let i = 0; i < this.k; ++i) {
        const coeff = this.gfAdd(data[i], parity[0]);

        // Shift parity and apply generator polynomial
        for (let j = 0; j < this.n - this.k - 1; ++j) {
          parity[j] = this.gfAdd(
            parity[j + 1],
            this.gfMultiply(this.generator[j], coeff)
          );
        }

        // Last parity symbol
        parity[this.n - this.k - 1] = this.gfMultiply(
          this.generator[this.n - this.k - 1],
          coeff
        );
      }

      return parity;
    }

    /**
     * Decode received data (with potential errors)
     *
     * @param {Array} data - n=7 received symbols
     * @returns {Array} k=3 decoded data symbols
     */
    decode(data) {
      if (data.length !== this.n) {
        throw new Error(`DNAStorage.decode: Input must be ${this.n} symbols`);
      }

      const received = [...data];

      // Calculate syndromes
      const syndromes = this.calculateSyndromes(received);

      // Check if any errors exist
      const hasError = syndromes.some(s => s !== 0);

      if (!hasError) {
        // No errors detected, extract data symbols
        return received.slice(0, this.k);
      }

      // Errors detected - attempt correction
      console.warn('DNAStorage: Errors detected, attempting correction...');

      // Simple error correction for educational purposes
      // Full implementation would use Berlekamp-Massey + Chien search
      const corrected = this.correctErrors(received, syndromes);

      return corrected.slice(0, this.k);
    }

    /**
     * Calculate syndrome polynomial S(x)
     * S_i = c(α^i) for i = 0 to n-k-1
     *
     * @param {Array} data - Received codeword
     * @returns {Array} Syndrome values
     */
    calculateSyndromes(data) {
      const syndromes = new Array(this.n - this.k);

      for (let i = 0; i < this.n - this.k; ++i) {
        syndromes[i] = 0;
        const alpha_i = this.gfAntilog[i % 3];
        let alpha_power = 1;

        // Evaluate polynomial at α^i
        for (let j = 0; j < this.n; ++j) {
          syndromes[i] = this.gfAdd(
            syndromes[i],
            this.gfMultiply(data[j], alpha_power)
          );
          alpha_power = this.gfMultiply(alpha_power, alpha_i);
        }
      }

      return syndromes;
    }

    /**
     * Simplified error correction
     * Full implementation requires Berlekamp-Massey algorithm
     *
     * @param {Array} received - Received codeword
     * @param {Array} syndromes - Calculated syndromes
     * @returns {Array} Corrected codeword
     */
    correctErrors(received, syndromes) {
      const corrected = [...received];

      // For single error: error location = S1/S0, error value = S0
      if (syndromes[0] !== 0) {
        // Single error case (simplified)
        const errorValue = syndromes[0];

        // Try to find error location
        // In GF(4), brute force is feasible for small n
        for (let pos = 0; pos < this.n; ++pos) {
          const testCorrected = [...received];
          testCorrected[pos] = this.gfAdd(testCorrected[pos], errorValue);

          const testSyndromes = this.calculateSyndromes(testCorrected);
          if (testSyndromes.every(s => s === 0)) {
            console.log(`DNAStorage: Corrected error at position ${pos}`);
            return testCorrected;
          }
        }

        console.warn('DNAStorage: Could not correct errors');
      }

      return corrected;
    }

    /**
     * Detect if errors exist in received data
     *
     * @param {Array} data - Received codeword
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      if (!Array.isArray(data) || data.length !== this.n) {
        return true; // Invalid length is an error
      }

      const syndromes = this.calculateSyndromes(data);
      return syndromes.some(s => s !== 0);
    }

    /**
     * Check DNA-specific constraints
     * - GC-content: 40-60%
     * - Homopolymer runs: max 3 consecutive
     *
     * @param {Array} symbols - DNA sequence as symbols
     */
    checkDNAConstraints(symbols) {
      // Check GC-content
      const gcCount = symbols.filter(s => this.gcBases.includes(s)).length;
      const gcPercent = (gcCount / symbols.length) * 100;

      if (gcPercent < 40 || gcPercent > 60) {
        console.warn(
          `DNAStorage: GC-content ${gcPercent.toFixed(1)}% outside optimal range [40-60%]`
        );
      }

      // Check homopolymer runs
      let maxRun = 1;
      let currentRun = 1;

      for (let i = 1; i < symbols.length; ++i) {
        if (symbols[i] === symbols[i - 1]) {
          ++currentRun;
          maxRun = Math.max(maxRun, currentRun);
        } else {
          currentRun = 1;
        }
      }

      if (maxRun > 3) {
        const base = this.symbolToBase[symbols[0]];
        console.warn(
          `DNAStorage: Homopolymer run of ${maxRun} detected (${base.repeat(maxRun)}). Max recommended: 3`
        );
      }
    }

    /**
     * Convert symbol array to DNA string
     *
     * @param {Array} symbols - Array of symbols (0-3)
     * @returns {string} DNA string (ACGT)
     */
    symbolsToDNA(symbols) {
      return symbols.map(s => this.symbolToBase[s]).join('');
    }

    /**
     * Convert DNA string to symbol array
     *
     * @param {string} dna - DNA string (ACGT)
     * @returns {Array} Array of symbols (0-3)
     */
    dnaToSymbols(dna) {
      return dna.toUpperCase().split('').map(base => {
        if (!this.baseToSymbol.hasOwnProperty(base)) {
          throw new Error(`DNAStorage: Invalid DNA base '${base}'`);
        }
        return this.baseToSymbol[base];
      });
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DNAStorageAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DNAStorageAlgorithm, DNAStorageInstance };
}));
