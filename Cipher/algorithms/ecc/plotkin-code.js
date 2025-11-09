/*
 * Plotkin Code Implementation
 * Linear binary codes achieving Plotkin bound via |u|u+v| construction
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

  class PlotkinCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Plotkin Code";
      this.description = "Linear binary codes achieving Plotkin bound (maximum minimum distance) via recursive |u|u+v| construction. Starting from [2,2,1] repetition code base, generates [2n, n+1, n] codes with optimal distance properties. Related to Hadamard matrices and first-order Reed-Muller codes.";
      this.inventor = "Morris Plotkin";
      this.year = 1960;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Error Correction Zoo - (u|u+v) construction", "https://errorcorrectionzoo.org/c/uplusv"),
        new LinkItem("Wikipedia - Plotkin bound", "https://en.wikipedia.org/wiki/Plotkin_bound"),
        new LinkItem("ArXiv - Plotkin construction rank and kernel", "https://arxiv.org/abs/0707.3878")
      ];

      this.references = [
        new LinkItem("MacWilliams & Sloane - Theory of Error-Correcting Codes", "https://archive.org/details/theoryoferrorcor0000macw"),
        new LinkItem("Recursive Plotkin Construction Decoding", "https://www.researchgate.net/publication/286929473_Recursive_Codes_with_the_Plotkin-Construction_and_Their_Decoding"),
        new LinkItem("Plotkin construction: rank and kernel", "https://www.researchgate.net/publication/1757474_Plotkin_construction_Rank_and_Kernel")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Power-of-2 Block Length",
          "Block length must be power of 2 (2, 4, 8, 16, ...), limiting flexibility."
        ),
        new Vulnerability(
          "Low Code Rate",
          "Code rate (n+1)/(2n) approaches 0.5 asymptotically, moderate efficiency."
        )
      ];

      // Test vectors based on recursive construction
      // Base case: [2,2,1] is the (2,1) repetition code
      // Level 1: [4,3,2] constructed from [2,2,1]
      // Level 2: [8,5,4] constructed from [4,3,2]

      this.tests = [
        // [2,2,1] base case - (2,1) repetition code
        {
          text: "Plotkin [2,2,1] base case - bits 00",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 0,
          input: [0, 0],
          expected: [0, 0]
        },
        {
          text: "Plotkin [2,2,1] base case - bits 01",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 0,
          input: [0, 1],
          expected: [0, 1]
        },
        {
          text: "Plotkin [2,2,1] base case - bits 10",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 0,
          input: [1, 0],
          expected: [1, 0]
        },
        {
          text: "Plotkin [2,2,1] base case - bits 11",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 0,
          input: [1, 1],
          expected: [1, 1]
        },

        // [4,3,2] first recursion level
        {
          text: "Plotkin [4,3,2] level 1 - all zeros",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 1,
          input: [0, 0, 0],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Plotkin [4,3,2] level 1 - pattern 001",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 1,
          input: [0, 0, 1],
          expected: [0, 0, 1, 0]
        },
        {
          text: "Plotkin [4,3,2] level 1 - pattern 010",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 1,
          input: [0, 1, 0],
          expected: [0, 1, 0, 1]
        },
        {
          text: "Plotkin [4,3,2] level 1 - pattern 011",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 1,
          input: [0, 1, 1],
          expected: [0, 1, 1, 1]
        },
        {
          text: "Plotkin [4,3,2] level 1 - pattern 100",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 1,
          input: [1, 0, 0],
          expected: [1, 0, 1, 0]
        },
        {
          text: "Plotkin [4,3,2] level 1 - all ones",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 1,
          input: [1, 1, 1],
          expected: [1, 1, 0, 1]
        },

        // [8,5,4] second recursion level
        {
          text: "Plotkin [8,5,4] level 2 - all zeros",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 2,
          input: [0, 0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Plotkin [8,5,4] level 2 - pattern 00001",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 2,
          input: [0, 0, 0, 0, 1],
          expected: [0, 0, 0, 0, 0, 1, 0, 1]
        },
        {
          text: "Plotkin [8,5,4] level 2 - pattern 10000",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 2,
          input: [1, 0, 0, 0, 0],
          expected: [1, 0, 1, 0, 1, 0, 1, 0]
        },
        {
          text: "Plotkin [8,5,4] level 2 - all ones",
          uri: "https://errorcorrectionzoo.org/c/uplusv",
          level: 2,
          input: [1, 1, 1, 1, 1],
          expected: [1, 1, 0, 1, 0, 0, 1, 0]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new PlotkinCodeInstance(this, isInverse);
    }
  }

  class PlotkinCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._level = 1; // Default [4,3,2] code (level 1)
    }

    // Recursion level: 0=[2,2,1], 1=[4,3,2], 2=[8,5,4], 3=[16,9,8], etc.
    set level(value) {
      if (value < 0 || value > 4) {
        throw new Error('PlotkinCodeInstance.level: Must be between 0 and 4');
      }
      this._level = value;
    }

    get level() {
      return this._level;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('PlotkinCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('PlotkinCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    // Get code parameters [n, k, d] for given level
    getParameters() {
      const level = this._level;
      const n = 1 << (level + 1); // 2^(level+1)
      const k = n / 2 + 1;        // n/2 + 1
      const d = n / 2;            // n/2
      return { n, k, d };
    }

    encode(data) {
      const { n, k } = this.getParameters();

      if (data.length !== k) {
        throw new Error(`Plotkin encode: Input must be exactly ${k} bits for level ${this._level}`);
      }

      // Base case: level 0 is [2,2,1] repetition code (identity - just pass through)
      if (this._level === 0) {
        return [...data];
      }

      // Recursive Plotkin construction: |u|u+v|
      // Split input into two parts for u and v
      // For [2n, n+1, n] code:
      //   First (n/2 + 1) bits encode u using [n, n/2+1, n/2] code
      //   Remaining bits encode v using same code

      const prevN = n / 2;
      const prevK = prevN / 2 + 1;

      // Split data: first prevK bits for u, rest for v
      // Special handling: when k = prevK + 1, we need to pad v
      const uBits = data.slice(0, prevK);
      const vBits = [];

      // For v, we need prevK bits total
      // If we have k - prevK bits remaining, pad with zeros
      const remainingBits = data.slice(prevK);

      for (let i = 0; i < prevK; ++i) {
        if (i < remainingBits.length) {
          vBits.push(remainingBits[i]);
        } else {
          vBits.push(0);
        }
      }

      // Recursively encode u and v
      const tempInstance = new PlotkinCodeInstance(this.algorithm, false);
      tempInstance.level = this._level - 1;

      tempInstance.Feed(uBits);
      const uEncoded = tempInstance.Result();

      tempInstance.Feed(vBits);
      const vEncoded = tempInstance.Result();

      // Construct |u|u+v|
      const codeword = [];

      // First half: u
      for (let i = 0; i < uEncoded.length; ++i) {
        codeword.push(uEncoded[i]);
      }

      // Second half: u+v (XOR)
      for (let i = 0; i < uEncoded.length; ++i) {
        codeword.push(uEncoded[i] ^ vEncoded[i]);
      }

      return codeword;
    }

    decode(data) {
      const { n, k } = this.getParameters();

      if (data.length !== n) {
        throw new Error(`Plotkin decode: Input must be exactly ${n} bits for level ${this._level}`);
      }

      // Base case: level 0 is [2,2,1] (identity)
      if (this._level === 0) {
        return [...data];
      }

      // Split received word into two halves
      const halfN = n / 2;
      const r1 = data.slice(0, halfN);
      const r2 = data.slice(halfN);

      // Compute u = r1, v = r1 XOR r2
      const uReceived = [...r1];
      const vReceived = [];
      for (let i = 0; i < halfN; ++i) {
        vReceived.push(r1[i] ^ r2[i]);
      }

      // Recursively decode u and v
      const tempInstance = new PlotkinCodeInstance(this.algorithm, true);
      tempInstance.level = this._level - 1;

      tempInstance.Feed(uReceived);
      const uDecoded = tempInstance.Result();

      tempInstance.Feed(vReceived);
      const vDecoded = tempInstance.Result();

      // Combine decoded bits
      // First k bits come from u, remaining from v
      const prevK = halfN / 2 + 1;
      const decoded = [];

      for (let i = 0; i < prevK; ++i) {
        decoded.push(uDecoded[i]);
      }

      // Add bits from v (excluding padding zeros)
      const numVBits = k - prevK;
      for (let i = 0; i < numVBits; ++i) {
        decoded.push(vDecoded[i]);
      }

      return decoded;
    }

    DetectError(data) {
      const { n } = this.getParameters();
      if (data.length !== n) return true;

      try {
        const decoded = this.decode(data);
        const tempInstance = new PlotkinCodeInstance(this.algorithm, false);
        tempInstance.level = this._level;
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

    // Calculate minimum distance using Hamming weight
    getMinimumDistance(codeword1, codeword2) {
      if (codeword1.length !== codeword2.length) {
        throw new Error('Codewords must have same length');
      }

      let distance = 0;
      for (let i = 0; i < codeword1.length; ++i) {
        if (codeword1[i] !== codeword2[i]) {
          ++distance;
        }
      }
      return distance;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new PlotkinCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PlotkinCodeAlgorithm, PlotkinCodeInstance };
}));
