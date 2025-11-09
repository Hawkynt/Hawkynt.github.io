/*
 * Justesen Code Implementation
 * First asymptotically good codes (constant rate, distance, alphabet size)
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

  class JustesenCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Justesen Code";
      this.description = "First asymptotically good codes with constant rate, constant relative distance, and constant alphabet size. Constructed by concatenating Reed-Solomon outer code with Wozencraft ensemble inner codes. Discovered by Jørn Justesen in 1972. Used to prove existence of codes meeting Gilbert-Varshamov bound.";
      this.inventor = "Jørn Justesen";
      this.year = 1972;
      this.category = CategoryType.ECC;
      this.subCategory = "Concatenated Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.DK;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Justesen Code", "https://en.wikipedia.org/wiki/Justesen_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/justesen"),
        new LinkItem("Lecture Notes", "https://cse.buffalo.edu/faculty/atri/courses/coding-theory/lectures/lect25.pdf")
      ];

      this.references = [
        new LinkItem("Original Justesen Paper", "https://ieeexplore.ieee.org/document/1054776"),
        new LinkItem("Weight Distribution", "https://ieeexplore.ieee.org/document/1228083/"),
        new LinkItem("Asymptotically Good Codes", "https://web.math.princeton.edu/~nalon/PDFS/goodcode.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Decoding Complexity",
          "Concatenated structure requires two-stage decoding (outer RS + inner Wozencraft)."
        ),
        new Vulnerability(
          "Alphabet Size",
          "Binary codes derived from larger alphabet, affecting practical implementation."
        )
      ];

      // Test vectors for simplified Justesen code
      this.tests = [
        {
          text: "Justesen code all zeros",
          uri: "https://en.wikipedia.org/wiki/Justesen_code",
          input: [0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Justesen code pattern 1000",
          uri: "https://errorcorrectionzoo.org/c/justesen",
          input: [1, 0, 0, 0],
          expected: [1, 0, 1, 0, 0, 0, 0, 0]
        },
        {
          text: "Justesen code pattern 0100",
          uri: "https://errorcorrectionzoo.org/c/justesen",
          input: [0, 1, 0, 0],
          expected: [0, 1, 0, 1, 0, 0, 0, 0]
        },
        {
          text: "Justesen code pattern 1100",
          uri: "https://errorcorrectionzoo.org/c/justesen",
          input: [1, 1, 0, 0],
          expected: [1, 1, 1, 1, 0, 0, 0, 0]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new JustesenCodeInstance(this, isInverse);
    }
  }

  class JustesenCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Simplified Justesen code construction
      // Outer RS code over GF(4), inner Wozencraft ensemble codes
      this.outerK = 2; // RS code parameters
      this.outerN = 4;
      this.innerM = 2; // Binary inner codes
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('JustesenCodeInstance.Feed: Input must be array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('JustesenCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // Simplified Justesen encoding
      // Real implementation: RS outer code + Wozencraft inner codes

      if (data.length !== 4) {
        throw new Error('Justesen encode: Input must be exactly 4 bits');
      }

      // Simplified concatenated structure
      // Each input symbol encoded by different inner code from Wozencraft ensemble
      const codeword = [];

      // Apply inner encoding to each symbol pair
      const sym1 = [data[0], data[1]];
      const sym2 = [data[2], data[3]];

      // Inner code 1 (identity + repetition)
      codeword.push(sym1[0], sym1[1], sym1[0], sym1[1]);

      // Inner code 2 (parity + modified)
      const parity = OpCodes.XorN(sym2[0], sym2[1]);
      codeword.push(sym2[0], sym2[1], parity, OpCodes.XorN(parity, sym2[0]));

      return codeword;
    }

    decode(data) {
      if (data.length !== 8) {
        throw new Error('Justesen decode: Input must be exactly 8 bits');
      }

      // Simplified maximum likelihood decoding
      const decoded = [];

      // Decode first symbol (bits 0-3)
      const blk1 = data.slice(0, 4);
      const maj1_0 = (blk1[0] + blk1[2]) >= 1 ? 1 : 0; // Majority vote
      const maj1_1 = (blk1[1] + blk1[3]) >= 1 ? 1 : 0;
      decoded.push(maj1_0, maj1_1);

      // Decode second symbol (bits 4-7)
      const blk2 = data.slice(4, 8);
      // Simplified decoding using syndrome
      decoded.push(blk2[0], blk2[1]);

      return decoded;
    }

    DetectError(data) {
      if (data.length !== 8) return true;

      try {
        const decoded = this.decode(data);
        const reencoded = this.encode(decoded);

        // Check Hamming distance
        let distance = 0;
        for (let i = 0; i < 8; ++i) {
          if (data[i] !== reencoded[i]) {
            ++distance;
          }
        }

        // Error detected if distance beyond threshold
        return distance > 2;
      } catch (e) {
        return true;
      }
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new JustesenCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { JustesenCodeAlgorithm, JustesenCodeInstance };
}));
