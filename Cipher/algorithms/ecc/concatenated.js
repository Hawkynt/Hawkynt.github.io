/*
 * Concatenated Code Implementation
 * Combines inner and outer codes for powerful error correction
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

  class ConcatenatedCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Concatenated Code";
      this.description = "Powerful error correction combining inner and outer codes. Outer code (e.g., Reed-Solomon) protects against burst errors, inner code (e.g., convolutional) handles random errors. Achieves near-capacity performance with polynomial decoding complexity.";
      this.inventor = "Dave Forney";
      this.year = 1966;
      this.category = CategoryType.ECC;
      this.subCategory = "Concatenated Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Concatenated Error Correction", "https://en.wikipedia.org/wiki/Concatenated_error_correction_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/concatenated"),
        new LinkItem("Scholarpedia Article", "http://www.scholarpedia.org/article/Concatenated_codes")
      ];

      this.references = [
        new LinkItem("Forney's Original Paper", "https://ieeexplore.ieee.org/document/1053696"),
        new LinkItem("NASA Deep Space Standard", "https://ntrs.nasa.gov/citations/19840023922"),
        new LinkItem("Rutgers Lecture Notes", "https://sites.math.rutgers.edu/~sk1233/courses/codes-S16/lec4.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Decoding Delay",
          "Two-stage decoding introduces latency. Outer decoder must wait for all inner codewords."
        ),
        new Vulnerability(
          "Error Propagation",
          "Uncorrected errors from inner decoder appear as symbol erasures to outer decoder."
        )
      ];

      // Test vectors using simplified Hamming(7,4) inner and repetition outer
      this.tests = [
        {
          text: "Concatenated code simple test",
          uri: "https://en.wikipedia.org/wiki/Concatenated_error_correction_code",
          innerType: "hamming",
          outerType: "repetition",
          input: [1, 0, 1, 1], // 4-bit message
          expected: [0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1] // Outer(Inner(data))
        },
        {
          text: "Concatenated all zeros",
          uri: "https://en.wikipedia.org/wiki/Concatenated_error_correction_code",
          innerType: "hamming",
          outerType: "repetition",
          input: [0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new ConcatenatedCodeInstance(this, isInverse);
    }
  }

  class ConcatenatedCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Code configuration
      this._innerType = 'hamming'; // Inner code: Hamming(7,4)
      this._outerType = 'repetition'; // Outer code: Repetition(3,1)
    }

    set innerType(type) {
      this._innerType = type;
    }

    get innerType() {
      return this._innerType;
    }

    set outerType(type) {
      this._outerType = type;
    }

    get outerType() {
      return this._outerType;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ConcatenatedCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('ConcatenatedCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // Concatenated encoding: apply outer code, then inner code to each symbol

      // Step 1: Apply outer code (repetition 3x for simplicity)
      const outerEncoded = this.encodeOuter(data);

      // Step 2: Apply inner code to each outer symbol
      const finalEncoded = [];
      for (let i = 0; i < outerEncoded.length; i += 4) {
        const symbol = outerEncoded.slice(i, i + 4);
        if (symbol.length === 4) {
          const innerEncoded = this.encodeInner(symbol);
          finalEncoded.push(...innerEncoded);
        }
      }

      return finalEncoded;
    }

    decode(data) {
      // Concatenated decoding: decode inner codewords, then outer code

      // Step 1: Decode inner codewords
      const innerDecoded = [];
      const symbolSize = 7; // Hamming(7,4) output
      for (let i = 0; i < data.length; i += symbolSize) {
        const innerCodeword = data.slice(i, i + symbolSize);
        if (innerCodeword.length === symbolSize) {
          const decoded = this.decodeInner(innerCodeword);
          innerDecoded.push(...decoded);
        }
      }

      // Step 2: Decode outer code
      const finalDecoded = this.decodeOuter(innerDecoded);

      return finalDecoded;
    }

    encodeOuter(data) {
      // Simplified repetition code: repeat each 4-bit block 3 times
      const repeated = [];
      for (let i = 0; i < data.length; i += 4) {
        const block = data.slice(i, i + 4);
        repeated.push(...block, ...block, ...block);
      }
      return repeated;
    }

    decodeOuter(data) {
      // Decode repetition code: majority voting on each 4-bit block
      const decoded = [];
      for (let i = 0; i < data.length; i += 12) {
        const block1 = data.slice(i, i + 4);
        const block2 = data.slice(i + 4, i + 8);
        const block3 = data.slice(i + 8, i + 12);

        // Majority vote bit by bit
        for (let j = 0; j < 4; ++j) {
          const sum = (block1[j] || 0) + (block2[j] || 0) + (block3[j] || 0);
          decoded.push(sum >= 2 ? 1 : 0);
        }
      }
      return decoded;
    }

    encodeInner(data) {
      // Simplified Hamming(7,4) encoding
      if (data.length !== 4) {
        throw new Error('Inner code: Expected 4 bits');
      }

      const [d1, d2, d3, d4] = data;
      const encoded = new Array(7);

      // Data bits at positions 3, 5, 6, 7
      encoded[2] = d1;
      encoded[4] = d2;
      encoded[5] = d3;
      encoded[6] = d4;

      // Parity bits at positions 1, 2, 4
      encoded[0] = d1 ^ d2 ^ d4;
      encoded[1] = d1 ^ d3 ^ d4;
      encoded[3] = d2 ^ d3 ^ d4;

      return encoded;
    }

    decodeInner(data) {
      // Simplified Hamming(7,4) decoding
      if (data.length !== 7) {
        throw new Error('Inner decode: Expected 7 bits');
      }

      const received = [...data];

      // Calculate syndrome
      const s1 = received[0] ^ received[2] ^ received[4] ^ received[6];
      const s2 = received[1] ^ received[2] ^ received[5] ^ received[6];
      const s4 = received[3] ^ received[4] ^ received[5] ^ received[6];
      const syndrome = s1 + (s2 << 1) + (s4 << 2);

      // Correct error if detected
      if (syndrome !== 0 && syndrome <= 7) {
        received[syndrome - 1] ^= 1;
      }

      // Extract data bits
      return [received[2], received[4], received[5], received[6]];
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new ConcatenatedCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ConcatenatedCodeAlgorithm, ConcatenatedCodeInstance };
}));
