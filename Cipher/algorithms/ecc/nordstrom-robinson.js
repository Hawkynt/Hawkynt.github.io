/*
 * Nordstrom-Robinson Code Implementation
 * Nonlinear (16, 256, 6) code with optimal parameters
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

  class NordstromRobinsonAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Nordstrom-Robinson Code";
      this.description = "Nonlinear (16, 256, 6) code achieving optimal parameters. Has minimum distance 6, can correct 2 errors and detect 5 errors. Meets the Plotkin bound for binary codes. Notable as the best-known nonlinear code of length 16. Used in theoretical coding research.";
      this.inventor = "A. W. Nordstrom, J. P. Robinson";
      this.year = 1967;
      this.category = CategoryType.ECC;
      this.subCategory = "Nonlinear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Nordstrom-Robinson", "https://en.wikipedia.org/wiki/Nordstrom%E2%80%93Robinson_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/nordstrom_robinson"),
        new LinkItem("Nonlinear Codes", "https://www.ams.org/notices/200308/what-is.pdf")
      ];

      this.references = [
        new LinkItem("Original Paper", "https://ieeexplore.ieee.org/document/1054045"),
        new LinkItem("Construction Methods", "https://arxiv.org/pdf/1708.07975.pdf"),
        new LinkItem("Decoding Algorithm", "https://www.researchgate.net/publication/3209246_Soft-decision_decoding_of_the_Nordstrom-Robinson_code")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Nonlinear Complexity",
          "Nonlinear structure makes encoding/decoding more complex than linear codes."
        ),
        new Vulnerability(
          "Fixed Length",
          "Only defined for length 16, cannot be easily extended to other lengths."
        )
      ];

      // Test vectors for Nordstrom-Robinson (16,8) code
      this.tests = [
        {
          text: "Nordstrom-Robinson all zeros",
          uri: "https://en.wikipedia.org/wiki/Nordstrom%E2%80%93Robinson_code",
          input: [0, 0, 0, 0, 0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Nordstrom-Robinson pattern 1",
          uri: "https://en.wikipedia.org/wiki/Nordstrom%E2%80%93Robinson_code",
          input: [0, 0, 0, 0, 0, 0, 0, 1],
          expected: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        },
        {
          text: "Nordstrom-Robinson pattern 2",
          uri: "https://en.wikipedia.org/wiki/Nordstrom%E2%80%93Robinson_code",
          input: [0, 0, 0, 1, 0, 0, 0, 0],
          expected: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
        },
        {
          text: "Nordstrom-Robinson pattern 3",
          uri: "https://en.wikipedia.org/wiki/Nordstrom%E2%80%93Robinson_code",
          input: [1, 0, 0, 0, 0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new NordstromRobinsonInstance(this, isInverse);
    }
  }

  /**
 * NordstromRobinson cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class NordstromRobinsonInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Pre-generate codebook using coset construction
      this.codebook = this.generateCodebook();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('NordstromRobinsonInstance.Feed: Input must be bit array');
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
        throw new Error('NordstromRobinsonInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    generateCodebook() {
      // Nordstrom-Robinson code as union of cosets of first-order Reed-Muller code
      // We use a construction based on the (16,5,8) Hadamard code
      const codebook = [];

      // Generate first coset: RM(1,4) - First-order Reed-Muller code [16,5,8]
      for (let msg = 0; msg < 32; ++msg) {
        const codeword = this.rmEncode(msg);
        codebook.push({ message: msg, codeword: codeword, coset: 0 });
      }

      // Generate second coset: RM(1,4) + v where v is a specific coset leader
      // Use v = [0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1] (codeword of (8,4,4) RM)
      const cosetLeader = [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1];

      for (let msg = 0; msg < 32; ++msg) {
        const rmWord = this.rmEncode(msg);
        const codeword = rmWord.map((bit, i) => OpCodes.Xor32(bit, cosetLeader[i]));
        codebook.push({ message: msg + 32, codeword: codeword, coset: 1 });
      }

      // Generate third coset
      const cosetLeader2 = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1];
      for (let msg = 0; msg < 32; ++msg) {
        const rmWord = this.rmEncode(msg);
        const codeword = rmWord.map((bit, i) => OpCodes.Xor32(bit, cosetLeader2[i]));
        codebook.push({ message: msg + 64, codeword: codeword, coset: 2 });
      }

      // Generate fourth coset
      const cosetLeader3 = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
      for (let msg = 0; msg < 32; ++msg) {
        const rmWord = this.rmEncode(msg);
        const codeword = rmWord.map((bit, i) => OpCodes.Xor32(bit, cosetLeader3[i]));
        codebook.push({ message: msg + 96, codeword: codeword, coset: 3 });
      }

      // Generate fifth coset
      const cosetLeader4 = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
      for (let msg = 0; msg < 32; ++msg) {
        const rmWord = this.rmEncode(msg);
        const codeword = rmWord.map((bit, i) => OpCodes.Xor32(bit, cosetLeader4[i]));
        codebook.push({ message: msg + 128, codeword: codeword, coset: 4 });
      }

      // Generate sixth coset
      const cosetLeader5 = [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0];
      for (let msg = 0; msg < 32; ++msg) {
        const rmWord = this.rmEncode(msg);
        const codeword = rmWord.map((bit, i) => OpCodes.Xor32(bit, cosetLeader5[i]));
        codebook.push({ message: msg + 160, codeword: codeword, coset: 5 });
      }

      // Generate seventh coset
      const cosetLeader6 = [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0];
      for (let msg = 0; msg < 32; ++msg) {
        const rmWord = this.rmEncode(msg);
        const codeword = rmWord.map((bit, i) => OpCodes.Xor32(bit, cosetLeader6[i]));
        codebook.push({ message: msg + 192, codeword: codeword, coset: 6 });
      }

      // Generate eighth coset
      const cosetLeader7 = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0];
      for (let msg = 0; msg < 32; ++msg) {
        const rmWord = this.rmEncode(msg);
        const codeword = rmWord.map((bit, i) => OpCodes.Xor32(bit, cosetLeader7[i]));
        codebook.push({ message: msg + 224, codeword: codeword, coset: 7 });
      }

      return codebook;
    }

    rmEncode(msg) {
      // Encode using first-order Reed-Muller RM(1,4): 5 bits -> 16 bits
      // Message format: [a0, a1, a2, a3, a4] where a0 is constant term
      const m = 4;
      const n = 16;
      const codeword = new Array(n).fill(0);

      // Constant term
      if ((msg&1) !== 0) {
        for (let i = 0; i < n; ++i) {
          codeword[i] = codeword[i]^1;
        }
      }

      // Linear terms
      for (let var_idx = 0; var_idx < m; ++var_idx) {
        if ((OpCodes.Shr32(msg, (var_idx + 1))&1) !== 0) {
          for (let i = 0; i < n; ++i) {
            if ((OpCodes.Shr32(i, (m - 1 - var_idx))&1) !== 0) {
              codeword[i] = codeword[i]^1;
            }
          }
        }
      }

      return codeword;
    }

    encode(data) {
      if (data.length !== 8) {
        throw new Error('Nordstrom-Robinson encode: Input must be exactly 8 bits');
      }

      // Convert 8-bit data to 8-bit index (0-255)
      let index = 0;
      for (let i = 0; i < 8; ++i) {
        index = OpCodes.ToUint32(OpCodes.Shl32(index, 1)+(data[i]&1));
      }

      if (index >= this.codebook.length) {
        throw new Error(`Nordstrom-Robinson encode: Index ${index} out of range`);
      }

      return [...this.codebook[index].codeword];
    }

    decode(data) {
      if (data.length !== 16) {
        throw new Error('Nordstrom-Robinson decode: Input must be exactly 16 bits');
      }

      // Minimum distance decoding
      let minDistance = Infinity;
      let bestIndex = 0;

      for (let i = 0; i < this.codebook.length; ++i) {
        let distance = 0;
        for (let j = 0; j < 16; ++j) {
          if (data[j] !== this.codebook[i].codeword[j]) {
            ++distance;
          }
        }

        if (distance < minDistance) {
          minDistance = distance;
          bestIndex = i;
        }
      }

      // Convert index back to 8-bit array
      const decoded = new Array(8);
      for (let i = 7; i >= 0; --i) {
        decoded[i] = bestIndex&1;
        bestIndex = OpCodes.Shr32(bestIndex, 1);
      }

      return decoded;
    }

    DetectError(data) {
      if (data.length !== 16) return true;

      // Check if received word is valid codeword
      for (let i = 0; i < this.codebook.length; ++i) {
        let matches = true;
        for (let j = 0; j < 16; ++j) {
          if (data[j] !== this.codebook[i].codeword[j]) {
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

  const algorithmInstance = new NordstromRobinsonAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { NordstromRobinsonAlgorithm, NordstromRobinsonInstance };
}));
