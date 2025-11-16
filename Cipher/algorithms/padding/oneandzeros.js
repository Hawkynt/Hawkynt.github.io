/*
 * One and Zeros Padding Implementation
 * Compatible with AlgorithmFramework
 * (c)2025 Hawkynt
 *
 * Appends a single '1' bit (0x80 byte) followed by zero bits (0x00 bytes) to fill the block.
 * Also known as Bit Padding or ISO/IEC 9797-1 Padding Method 2.
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
          PaddingAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * One and Zeros Padding Algorithm (ISO/IEC 9797-1 Padding Method 2)
   *
   * @class OneAndZerosPaddingAlgorithm
   * @extends PaddingAlgorithm
   * @description Padding scheme that appends a single '1' bit (0x80 byte) followed by zero bits (0x00 bytes)
   * to fill the block. Provides unambiguous padding removal as the 0x80 marker is always present.
   * This method is also known as Bit Padding and is standardized in ISO/IEC 9797-1 as Padding Method 2.
   *
   * The padding always adds at least one byte (0x80), ensuring that even full blocks receive an additional
   * padded block. This guarantees that padding can always be unambiguously removed.
   *
   * @example
   * // Padding 3 bytes to 16-byte block
   * // Input:  [0xFF, 0xFF, 0xFF]
   * // Output: [0xFF, 0xFF, 0xFF, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
   *
   * @example
   * // Padding full 8-byte block requires additional block
   * // Input:  [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]
   * // Output: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
   */
  class OneAndZerosPaddingAlgorithm extends PaddingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "OneAndZeros";
      this.description = "One and Zeros padding scheme appends a single '1' bit (0x80 byte) followed by zero bits (0x00 bytes) to fill the block. Provides unambiguous padding removal. Also known as ISO/IEC 9797-1 Padding Method 2.";
      this.inventor = "ISO/IEC";
      this.year = 1999;
      this.category = CategoryType.PADDING;
      this.subCategory = "Bit Padding";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.INT;

      // Documentation links
      this.documentation = [
        new LinkItem(
          "ISO/IEC 9797-1:2011 - Padding Method 2",
          "https://www.iso.org/standard/50375.html"
        ),
        new LinkItem(
          "Botan OneAndZeros Padding",
          "https://github.com/randombit/botan/blob/master/src/lib/modes/mode_pad/mode_pad.cpp"
        )
      ];

      // Reference links
      this.references = [
        new LinkItem(
          "Botan Padding Test Vectors",
          "https://github.com/randombit/botan/blob/master/src/tests/data/pad.vec"
        )
      ];

      // Official test vectors from Botan
      this.tests = [
        {
          text: "OneAndZeros Padding - 3 bytes to 16 bytes",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/pad.vec",
          input: OpCodes.Hex8ToBytes("FFFFFF"),
          blockSize: 16,
          expected: OpCodes.Hex8ToBytes("FFFFFF80000000000000000000000000")
        },
        {
          text: "OneAndZeros Padding - 4 bytes to 32 bytes",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/pad.vec",
          input: OpCodes.Hex8ToBytes("FFFFFFFF"),
          blockSize: 32,
          expected: OpCodes.Hex8ToBytes("FFFFFFFF80000000000000000000000000000000000000000000000000000000")
        },
        {
          text: "OneAndZeros Padding - 8 bytes to 16 bytes (full block)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/pad.vec",
          input: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF"),
          blockSize: 8,
          expected: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF8000000000000000")
        }
      ];
    }

    /**
     * Creates a new instance of the One and Zeros padding algorithm for padding or unpadding operations.
     *
     * @param {boolean} [isInverse=false] - If true, creates an instance for unpadding (removing padding);
     *                                       if false, creates an instance for padding (adding padding)
     * @returns {OneAndZerosPaddingInstance} A new instance configured for the requested operation
     */
    CreateInstance(isInverse = false) {
      return new OneAndZerosPaddingInstance(this, isInverse);
    }
  }

  /**
   * Instance class for One and Zeros Padding operations using the Feed/Result pattern.
   *
   * @class OneAndZerosPaddingInstance
   * @extends IAlgorithmInstance
   * @description Handles the actual padding/unpadding computation for OneAndZeros algorithm.
   * Uses the Feed/Result pattern where data is accumulated via Feed() and processed on Result() call.
   *
   * @example
   * // Padding data
   * const algo = new OneAndZerosPaddingAlgorithm();
   * const instance = algo.CreateInstance(false);
   * instance.blockSize = 16;
   * instance.Feed([0xFF, 0xFF, 0xFF]);
   * const padded = instance.Result();
   * // padded = [0xFF, 0xFF, 0xFF, 0x80, 0x00, 0x00, ...]
   *
   * @example
   * // Unpadding data
   * const algo = new OneAndZerosPaddingAlgorithm();
   * const instance = algo.CreateInstance(true);
   * instance.blockSize = 16;
   * instance.Feed([0xFF, 0xFF, 0xFF, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
   * const unpadded = instance.Result();
   * // unpadded = [0xFF, 0xFF, 0xFF]
   */
  class OneAndZerosPaddingInstance extends IAlgorithmInstance {
    /**
     * Creates a new padding instance.
     *
     * @param {OneAndZerosPaddingAlgorithm} algorithm - The parent algorithm definition
     * @param {boolean} [isInverse=false] - If true, this instance will remove padding; if false, will add padding
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);

      /**
       * Operation mode: true for unpadding (inverse), false for padding
       * @type {boolean}
       * @public
       */
      this.isInverse = isInverse;

      /**
       * Block size in bytes for padding calculations
       * @type {uint16}
       * @private
       */
      this._blockSize = 16;  // Default block size

      /**
       * Accumulator buffer for input data
       * @type {Uint8Array}
       * @private
       */
      this.inputBuffer = [];
    }

    /**
     * Sets the block size for padding calculations.
     *
     * @param {uint16} size - The block size in bytes (must be a positive integer)
     * @throws {Error} If size is not a positive integer
     *
     * @example
     * instance.blockSize = 16;  // Set 16-byte blocks (AES)
     * instance.blockSize = 8;   // Set 8-byte blocks (DES)
     */
    set blockSize(size) {
      if (!Number.isInteger(size) || size < 1) {
        throw new Error("Block size must be a positive integer");
      }
      this._blockSize = size;
    }

    /**
     * Gets the current block size.
     *
     * @returns {uint16} The block size in bytes
     */
    get blockSize() {
      return this._blockSize;
    }

    /**
     * Feeds input data into the padding instance for accumulation.
     * Part of the Feed/Result pattern - data is accumulated until Result() is called.
     *
     * @param {Uint8Array} data - Input data bytes to accumulate. Empty or null data is ignored.
     *
     * @example
     * instance.Feed([0xFF, 0xFF, 0xFF]);
     * instance.Feed([0xAA, 0xBB]);  // Accumulates with previous data
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
     * Processes all accumulated data and returns the padded or unpadded result.
     * The operation performed depends on the isInverse flag set during construction.
     * After calling Result(), the input buffer is cleared.
     *
     * @returns {Uint8Array} The processed data (padded if isInverse=false, unpadded if isInverse=true)
     * @throws {Error} If unpadding fails due to invalid padding format
     *
     * @example
     * // Padding
     * instance.Feed([0xFF, 0xFF, 0xFF]);
     * const padded = instance.Result();
     * // Returns: [0xFF, 0xFF, 0xFF, 0x80, 0x00, ...]
     *
     * @example
     * // Unpadding
     * const inverseInstance = algo.CreateInstance(true);
     * inverseInstance.Feed([0xFF, 0xFF, 0xFF, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
     * const unpadded = inverseInstance.Result();
     * // Returns: [0xFF, 0xFF, 0xFF]
     */
    Result() {
      if (this.isInverse) {
        // Remove padding
        return this._removePadding(this.inputBuffer);
      } else {
        // Add padding
        return this._addPadding(this.inputBuffer);
      }
    }

    /**
     * Adds One and Zeros padding to the input data.
     * Appends 0x80 byte followed by 0x00 bytes to fill the block.
     *
     * @param {Uint8Array} data - Input data to be padded
     * @returns {Uint8Array} Data with One and Zeros padding appended
     * @private
     *
     * @example
     * // Input: [0xFF, 0xFF, 0xFF] with blockSize=16
     * // Returns: [0xFF, 0xFF, 0xFF, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
     *
     * @example
     * // Full block input: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF] with blockSize=8
     * // Returns: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
     */
    _addPadding(data) {
      const blockSize = this._blockSize;
      const paddingLength = blockSize - (data.length % blockSize);

      const padded = [...data];

      // Always add at least one byte: 0x80
      padded.push(0x80);

      // Add zeros to fill the block
      for (let i = 1; i < paddingLength; i++) {
        padded.push(0x00);
      }

      return padded;
    }

    /**
     * Removes One and Zeros padding from the input data.
     * Searches backward for the 0x80 marker byte and validates the padding format.
     *
     * @param {Uint8Array} data - Padded data to be unpadded
     * @returns {Uint8Array} Original data with padding removed
     * @throws {Error} If data is empty
     * @throws {Error} If no 0x80 marker byte is found
     * @throws {Error} If padding format is invalid (non-zero bytes found after 0x80 or before reaching it)
     * @private
     *
     * @example
     * // Input: [0xFF, 0xFF, 0xFF, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
     * // Returns: [0xFF, 0xFF, 0xFF]
     *
     * @example
     * // Invalid padding (no 0x80): [0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00]
     * // Throws: "Invalid OneAndZeros padding: no 0x80 byte found"
     *
     * @example
     * // Invalid padding (non-zero after 0x80): [0xFF, 0xFF, 0xFF, 0x80, 0x01, 0x00]
     * // Throws: "Invalid OneAndZeros padding"
     */
    _removePadding(data) {
      if (data.length === 0) {
        throw new Error("Cannot remove padding from empty data");
      }

      // Find the last 0x80 byte
      let paddingStart = -1;
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i] === 0x80) {
          paddingStart = i;
          break;
        } else if (data[i] !== 0x00) {
          throw new Error("Invalid OneAndZeros padding");
        }
      }

      if (paddingStart === -1) {
        throw new Error("Invalid OneAndZeros padding: no 0x80 byte found");
      }

      // Verify padding is valid (only 0x00 bytes after 0x80)
      for (let i = paddingStart + 1; i < data.length; i++) {
        if (data[i] !== 0x00) {
          throw new Error("Invalid OneAndZeros padding");
        }
      }

      return data.slice(0, paddingStart);
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new OneAndZerosPaddingAlgorithm());

  return {
    OneAndZerosPaddingAlgorithm,
    OneAndZerosPaddingInstance
  };
}));
