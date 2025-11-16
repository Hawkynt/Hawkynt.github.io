/*
 * Berger Code Implementation
 * Optimal unidirectional error detection code
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

  class BergerCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Berger Code";
      this.description = "Optimal unidirectional error detection code that detects all errors where bits flip in only one direction (all 0→1 or all 1→0). Encodes data by appending binary count of zeros in the information word. Uses ⌈log₂(k+1)⌉ check bits for k data bits. Widely used in fault-tolerant digital systems and delay-insensitive circuits.";
      this.inventor = "Jay M. Berger";
      this.year = 1961;
      this.category = CategoryType.ECC;
      this.subCategory = "Unidirectional Error Detection";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Berger Code", "https://en.wikipedia.org/wiki/Berger_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/berger"),
        new LinkItem("Unidirectional Error Detection", "https://link.springer.com/chapter/10.1007/3-540-54303-1_122")
      ];

      this.references = [
        new LinkItem("Berger's Original Paper (1961)", "https://www.sciencedirect.com/science/article/pii/S0019995861904996"),
        new LinkItem("Self Checking Register File Using Berger Code", "https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=c48d4280c718452a6849b781fbdf1ef63cd756ca"),
        new LinkItem("Modified Berger Codes - IEEE", "https://ieeexplore.ieee.org/document/1676484"),
        new LinkItem("Burst and Unidirectional Error Detecting Codes", "https://ieeexplore.ieee.org/document/146689/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Bidirectional Errors Not Detected",
          "Cannot detect errors where both 0→1 and 1→0 flips occur in the same codeword. Only detects purely unidirectional errors."
        ),
        new Vulnerability(
          "Detection Only - No Correction",
          "Berger codes can only detect unidirectional errors, not correct them. Use for detection in asymmetric channels."
        )
      ];

      // Test vectors based on Berger's B0 scheme (count of zeros)
      // For k=8 data bits, r=⌈log₂(8+1)⌉=⌈log₂(9)⌉=4 check bits
      this.tests = [
        {
          text: "Berger (12,8) all zeros - count=8",
          uri: "https://en.wikipedia.org/wiki/Berger_code",
          input: [0, 0, 0, 0, 0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
        },
        {
          text: "Berger (12,8) all ones - count=0",
          uri: "https://en.wikipedia.org/wiki/Berger_code",
          input: [1, 1, 1, 1, 1, 1, 1, 1],
          expected: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
        },
        {
          text: "Berger (12,8) pattern 11010100 - count=4",
          uri: "https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=c48d4280c718452a6849b781fbdf1ef63cd756ca",
          input: [1, 1, 0, 1, 0, 1, 0, 0],
          expected: [1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0]
        },
        {
          text: "Berger (12,8) pattern 00001111 - count=4",
          uri: "https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=c48d4280c718452a6849b781fbdf1ef63cd756ca",
          input: [0, 0, 0, 0, 1, 1, 1, 1],
          expected: [0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0, 0]
        },
        {
          text: "Berger (12,8) pattern 10101010 - count=4",
          uri: "https://en.wikipedia.org/wiki/Berger_code",
          input: [1, 0, 1, 0, 1, 0, 1, 0],
          expected: [1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0]
        },
        {
          text: "Berger (12,8) pattern 01010101 - count=4",
          uri: "https://en.wikipedia.org/wiki/Berger_code",
          input: [0, 1, 0, 1, 0, 1, 0, 1],
          expected: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0]
        },
        {
          text: "Berger (12,8) single one - count=7",
          uri: "https://en.wikipedia.org/wiki/Berger_code",
          input: [0, 0, 0, 0, 0, 0, 0, 1],
          expected: [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1]
        },
        {
          text: "Berger (12,8) single zero - count=1",
          uri: "https://en.wikipedia.org/wiki/Berger_code",
          input: [1, 1, 1, 1, 1, 1, 1, 0],
          expected: [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BergerCodeInstance(this, isInverse);
    }
  }

  /**
 * BergerCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BergerCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._dataLength = 8; // Default k=8 data bits
      this._checkLength = 4; // Default r=4 check bits (for k=8)
    }

    set dataLength(value) {
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('BergerCodeInstance.dataLength: Must be positive integer');
      }
      this._dataLength = value;
      // Calculate required check bits: r = ceil(log2(k+1))
      this._checkLength = Math.ceil(Math.log2(value + 1));
    }

    get dataLength() {
      return this._dataLength;
    }

    get checkLength() {
      return this._checkLength;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BergerCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        // Decode: verify codeword and extract data
        const decodedObj = this.decode(data);
        this.result = decodedObj.data; // Return only data bits for stability test
        this.lastDecodeInfo = decodedObj; // Store full info for diagnostic access
      } else {
        // Encode: add check bits
        this.result = this.encode(data);
        this.lastDecodeInfo = null;
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.result === null) {
        throw new Error('BergerCodeInstance.Result: Call Feed() first to process data');
      }

      const output = this.result;
      this.result = null;
      return output;
    }

    /**
     * Encode data by appending Berger check bits
     * Uses B0 scheme: binary representation of zero count
     * @param {Array} data - Binary data bits (length k)
     * @returns {Array} Encoded codeword with check bits (length k+r)
     */
    encode(data) {
      if (data.length !== this._dataLength) {
        throw new Error(`BergerCodeInstance.encode: Expected ${this._dataLength} data bits, got ${data.length}`);
      }

      // Validate binary input
      for (let i = 0; i < data.length; ++i) {
        if (data[i] !== 0 && data[i] !== 1) {
          throw new Error(`BergerCodeInstance.encode: Non-binary value at position ${i}: ${data[i]}`);
        }
      }

      // Count zeros in data word
      let zeroCount = 0;
      for (let i = 0; i < data.length; ++i) {
        if (data[i] === 0) {
          ++zeroCount;
        }
      }

      // Convert zero count to binary check bits (B0 scheme)
      const checkBits = this.intToBinary(zeroCount, this._checkLength);

      // Return codeword: data + check bits
      return data.concat(checkBits);
    }

    /**
     * Decode codeword and verify unidirectional error detection
     * @param {Array} codeword - Encoded data (length k+r)
     * @returns {Object} { data: Array, error: boolean, syndrome: number }
     */
    decode(codeword) {
      const expectedLength = this._dataLength + this._checkLength;
      if (codeword.length !== expectedLength) {
        throw new Error(`BergerCodeInstance.decode: Expected ${expectedLength} bits, got ${codeword.length}`);
      }

      // Validate binary input
      for (let i = 0; i < codeword.length; ++i) {
        if (codeword[i] !== 0 && codeword[i] !== 1) {
          throw new Error(`BergerCodeInstance.decode: Non-binary value at position ${i}: ${codeword[i]}`);
        }
      }

      // Split into data and check bits
      const dataBits = codeword.slice(0, this._dataLength);
      const receivedCheck = codeword.slice(this._dataLength);

      // Count zeros in received data
      let zeroCount = 0;
      for (let i = 0; i < dataBits.length; ++i) {
        if (dataBits[i] === 0) {
          ++zeroCount;
        }
      }

      // Convert received check bits to integer
      const receivedCheckValue = this.binaryToInt(receivedCheck);

      // Error detection: received check should equal zero count
      // If they differ, unidirectional error occurred
      const errorDetected = (receivedCheckValue !== zeroCount);
      const syndrome = Math.abs(receivedCheckValue - zeroCount);

      return {
        data: dataBits,
        error: errorDetected,
        syndrome: syndrome,
        zeroCount: zeroCount,
        checkValue: receivedCheckValue
      };
    }

    /**
     * Detect if error exists in codeword (without decoding)
     * @param {Array} codeword - Encoded data (length k+r)
     * @returns {boolean} True if unidirectional error detected
     */
    detectError(codeword) {
      const result = this.decode(codeword);
      return result.error;
    }

    /**
     * Convert integer to binary array
     * @param {number} value - Integer value
     * @param {number} length - Desired bit length
     * @returns {Array} Binary representation (MSB first)
     */
    intToBinary(value, length) {
      const bits = [];
      for (let i = length - 1; i >= 0; --i) {
        bits.push((value >>> i) & 1);
      }
      return bits;
    }

    /**
     * Convert binary array to integer
     * @param {Array} bits - Binary array (MSB first)
     * @returns {number} Integer value
     */
    binaryToInt(bits) {
      let value = 0;
      for (let i = 0; i < bits.length; ++i) {
        value = (value << 1) | bits[i];
      }
      return value;
    }
  }

  // Register algorithm immediately
  RegisterAlgorithm(new BergerCodeAlgorithm());

  return BergerCodeAlgorithm;
}));
