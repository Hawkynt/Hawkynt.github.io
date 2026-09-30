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

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {ConcatenatedCodeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ConcatenatedCodeInstance(this, isInverse);
    }
  }

  /**
 * ConcatenatedCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ConcatenatedCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {ConcatenatedCodeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {uint8[]|null} */
      this._feedBuffer = null;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.result = null;

      // Code configuration
      /** @type {string} */
      this._innerType = 'hamming'; // Inner code: Hamming(7,4)
      /** @type {string} */
      this._outerType = 'repetition'; // Outer code: Repetition(3,1)
    }

    /**
     * @param {string} type - Inner code name
     */
    set innerType(type) {
      this._innerType = type;
    }

    /**
     * @returns {string} Inner code name
     */
    get innerType() {
      return this._innerType;
    }

    /**
     * @param {string} type - Outer code name
     */
    set outerType(type) {
      this._outerType = type;
    }

    /**
     * @returns {string} Outer code name
     */
    get outerType() {
      return this._outerType;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ConcatenatedCodeInstance.Feed: Input must be bit array');
      }

      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it. A single chunk cannot be coded on its own
      // either, because block boundaries and parity are counted from the start
      // of the message, so the symbols are collected here and coded once, in
      // Result().
      if (!this._feedBuffer) this._feedBuffer = [];
      for (let i = 0; i < data.length; i++) this._feedBuffer.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._feedBuffer) {
        throw new Error('ConcatenatedCodeInstance.Result: Call Feed() first to process data');
      }
      this.result = this.isInverse
        ? this.decode(this._feedBuffer)
        : this.encode(this._feedBuffer);
      return this.result;
    }

    /**
     * @param {uint8[]} data - Message symbols
     * @returns {uint8[]} Codeword symbols
     */
    encode(data) {
      // Concatenated encoding: apply outer code, then inner code to each symbol

      // Step 1: Apply outer code (repetition 3x for simplicity)
      /** @type {uint8[]} */
      const outerEncoded = this.encodeOuter(data);

      // Step 2: Apply inner code to each outer symbol
      /** @type {uint8[]} */
      const finalEncoded = [];
      for (let i = 0; i < outerEncoded.length; i += 4) {
        /** @type {uint8[]} */
        const symbol = outerEncoded.slice(i, i + 4);
        if (symbol.length === 4) {
          /** @type {uint8[]} */
          const innerEncoded = this.encodeInner(symbol);
          for (let _i = 0; _i < innerEncoded.length; _i++) finalEncoded.push(innerEncoded[_i]);
        }
      }

      return finalEncoded;
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {uint8[]} Decoded message symbols
     */
    decode(data) {
      // Concatenated decoding: decode inner codewords, then outer code

      // Step 1: Decode inner codewords
      /** @type {uint8[]} */
      const innerDecoded = [];
      const symbolSize = 7; // Hamming(7,4) output
      for (let i = 0; i < data.length; i += symbolSize) {
        /** @type {uint8[]} */
        const innerCodeword = data.slice(i, i + symbolSize);
        if (innerCodeword.length === symbolSize) {
          /** @type {uint8[]} */
          const decoded = this.decodeInner(innerCodeword);
          for (let _i = 0; _i < decoded.length; _i++) innerDecoded.push(decoded[_i]);
        }
      }

      // Step 2: Decode outer code
      /** @type {uint8[]} */
      const finalDecoded = this.decodeOuter(innerDecoded);

      return finalDecoded;
    }

    /**
     * @param {uint8[]} data - Message bits
     * @returns {uint8[]} Every 4-bit block repeated three times
     */
    encodeOuter(data) {
      // Simplified repetition code: repeat each 4-bit block 3 times
      /** @type {uint8[]} */
      const repeated = [];
      for (let i = 0; i < data.length; i += 4) {
        /** @type {uint8[]} */
        const block = data.slice(i, i + 4);
        for (let copy = 0; copy < 3; copy++)
          for (let j = 0; j < block.length; j++) repeated.push(block[j]);
      }
      return repeated;
    }

    /**
     * @param {uint8[]} data - Repeated blocks
     * @returns {uint8[]} Majority-voted blocks
     */
    decodeOuter(data) {
      // Decode repetition code: majority voting on each 4-bit block
      /** @type {uint8[]} */
      const decoded = [];
      for (let i = 0; i < data.length; i += 12) {
        /** @type {uint8[]} */
        const block1 = data.slice(i, i + 4);
        /** @type {uint8[]} */
        const block2 = data.slice(i + 4, i + 8);
        /** @type {uint8[]} */
        const block3 = data.slice(i + 8, i + 12);

        // Majority vote bit by bit
        for (let j = 0; j < 4; ++j) {
          const sum = ((block1[j] ? block1[j] : 0)) + ((block2[j] ? block2[j] : 0)) + ((block3[j] ? block3[j] : 0));
          decoded.push(sum >= 2 ? 1 : 0);
        }
      }
      return decoded;
    }

    /**
     * @param {uint8[]} data - Four data bits
     * @returns {uint8[]} Hamming(7,4) codeword
     */
    encodeInner(data) {
      // Simplified Hamming(7,4) encoding
      if (data.length !== 4) {
        throw new Error('Inner code: Expected 4 bits');
      }

      /** @type {uint8} */
      const d1 = data[0];
      /** @type {uint8} */
      const d2 = data[1];
      /** @type {uint8} */
      const d3 = data[2];
      /** @type {uint8} */
      const d4 = data[3];
      /** @type {uint8[]} */
      const encoded = new Array(7);

      // Data bits at positions 3, 5, 6, 7
      encoded[2] = d1;
      encoded[4] = d2;
      encoded[5] = d3;
      encoded[6] = d4;

      // Parity bits at positions 1, 2, 4
      encoded[0] = OpCodes.Xor32(OpCodes.Xor32(d1, d2), d4);
      encoded[1] = OpCodes.Xor32(OpCodes.Xor32(d1, d3), d4);
      encoded[3] = OpCodes.Xor32(OpCodes.Xor32(d2, d3), d4);

      return encoded;
    }

    /**
     * @param {uint8[]} data - Hamming(7,4) codeword
     * @returns {uint8[]} Four corrected data bits
     */
    decodeInner(data) {
      // Simplified Hamming(7,4) decoding
      if (data.length !== 7) {
        throw new Error('Inner decode: Expected 7 bits');
      }

      /** @type {uint8[]} */
      const received = data.slice();

      // Calculate syndrome
      /** @type {uint32} */
      const s1 = OpCodes.Xor32(OpCodes.Xor32(received[0], received[2]), OpCodes.Xor32(received[4], received[6]));
      /** @type {uint32} */
      const s2 = OpCodes.Xor32(OpCodes.Xor32(received[1], received[2]), OpCodes.Xor32(received[5], received[6]));
      /** @type {uint32} */
      const s4 = OpCodes.Xor32(OpCodes.Xor32(received[3], received[4]), OpCodes.Xor32(received[5], received[6]));
      /** @type {int32} */
      const syndrome = OpCodes.ToInt(OpCodes.Add32(OpCodes.Add32(s1, OpCodes.Shl32(s2, 1)), OpCodes.Shl32(s4, 2)));

      // Correct error if detected
      if (syndrome !== 0 && syndrome <= 7) {
        received[syndrome - 1] = OpCodes.ToByte(OpCodes.Xor32(received[syndrome - 1], 1));
      }

      // Extract data bits
      /** @type {uint8[]} */
      const decoded = [received[2], received[4], received[5], received[6]];
      return decoded;
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
