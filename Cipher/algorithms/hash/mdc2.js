/*
 * MDC-2 (Modification Detection Code 2) Hash Function Implementation
 * ISO/IEC 10118-2:2010 Standard
 * (c)2006-2025 Hawkynt
 *
 * Educational implementation of MDC-2 hash function based on DES encryption.
 * Produces 128-bit hash values using DES in a Davies-Meyer construction.
 *
 * SECURITY NOTE: MDC-2 is deprecated due to reliance on broken DES cipher.
 * For educational and legacy compatibility purposes only.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS - load DES dependency
    const desModule = require('../block/des.js');
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global - DES should already be loaded
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance,
          TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // Get DES algorithm from registry
  let DESAlgorithm = null;
  function getDES() {
    if (!DESAlgorithm) {
      DESAlgorithm = AlgorithmFramework.Algorithms.find(a => a.name === "DES");
      if (!DESAlgorithm) {
        throw new Error('MDC-2 requires DES algorithm to be loaded first');
      }
    }
    return DESAlgorithm;
  }

  // Helper function to set odd parity on DES keys
  // Uses OpCodes for all bit operations
  function setOddParity(keyBytes) {
    const result = [...keyBytes];
    for (let i = 0; i < 8; ++i) {
      let bitCount = 0;
      for (let j = 0; j < 8; ++j) {
        bitCount += OpCodes.GetBit(result[i], j);
      }
      // If even number of bits, flip LSB to make it odd
      if (bitCount % 2 === 0) {
        result[i] = OpCodes.SetBit(result[i], 0, 1 - OpCodes.GetBit(result[i], 0));
      }
    }
    return result;
  }

  // DES encryption using the standalone DES algorithm
  function desEncrypt(plainBytes, keyBytes) {
    // Set odd parity on key (OpenSSL DES_set_odd_parity)
    const parityKey = setOddParity(keyBytes);

    // Get DES algorithm and create instance
    const des = getDES().CreateInstance(false);
    des.key = parityKey;
    des.Feed(plainBytes);
    return des.Result();
  }

  // ===== MDC-2 ALGORITHM =====

  /**
 * MDC2Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class MDC2Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "MDC-2";
      this.description = "Modification Detection Code 2, an ISO/IEC 10118-2 standard hash function based on DES encryption. Produces 128-bit hashes using Davies-Meyer construction.";
      this.inventor = "Brachtl, Coppersmith, Hyden, Matyas, Meyer, Oseas, Pilpel, Schilling";
      this.year = 1988;
      this.category = CategoryType.HASH;
      this.subCategory = "Hash Function";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.SupportedOutputSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit (16-byte) output
      ];

      this.documentation = [
        new LinkItem("ISO/IEC 10118-2:2010 Standard", "https://www.iso.org/standard/44737.html"),
        new LinkItem("OpenSSL MDC2 Documentation", "https://www.openssl.org/docs/man1.1.1/man3/MDC2.html"),
        new LinkItem("Research Paper on MDC-2", "https://link.springer.com/chapter/10.1007/3-540-39118-5_24")
      ];

      this.references = [
        new LinkItem("MDC-2 in ISO Standards", "https://www.iso.org/standard/44737.html"),
        new LinkItem("OpenSSL Implementation", "https://github.com/openssl/openssl/blob/master/crypto/mdc2/mdc2dgst.c")
      ];

      // Test vectors from OpenSSL test suite
      this.tests = [
        {
          text: "OpenSSL Test Vector - 'Now is the time for all ' (pad_type=2)",
          uri: "https://github.com/openssl/openssl/blob/master/test/mdc2test.c",
          input: OpCodes.AnsiToBytes("Now is the time for all "),
          padType: 2,
          expected: OpCodes.Hex8ToBytes("2E4679B5ADD9CA7535D87AFEAB33BEE2")
        },
        {
          text: "OpenSSL Test Vector - 'Now is the time for all ' (pad_type=1, default)",
          uri: "https://github.com/openssl/openssl/blob/master/test/mdc2test.c",
          input: OpCodes.AnsiToBytes("Now is the time for all "),
          padType: 1,
          expected: OpCodes.Hex8ToBytes("42E50CD224BACEBA760BDD2BD409281A")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new MDC2Instance(this);
    }
  }

  /**
 * MDC2 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MDC2Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.inputBuffer = [];
      this.h = new Array(8).fill(0x52);
      this.hh = new Array(8).fill(0x25);
      this._padType = 1;  // Default pad_type is 1 (matches OpenSSL MDC2_Init)
      this._outputSize = 16;
    }

    set outputSize(size) {
      if (size !== 16) {
        throw new Error("MDC-2 only supports 128-bit (16-byte) output");
      }
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    set padType(type) {
      this._padType = type;
    }

    get padType() {
      return this._padType;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const data = [...this.inputBuffer];
      this.inputBuffer = [];

      // Process complete 8-byte blocks
      let offset = 0;
      while (offset + 8 <= data.length) {
        this._processBlock(data.slice(offset, offset + 8));
        offset += 8;
      }

      // Handle padding (matches OpenSSL logic: if ((i > 0) || (j == 2)))
      const remaining = data.length - offset;

      if (remaining > 0 || this._padType === 2) {
        const lastBlock = new Array(8).fill(0);

        // Copy remaining bytes
        for (let i = 0; i < remaining; ++i) {
          lastBlock[i] = data[offset + i];
        }

        // Add 0x80 padding byte if pad_type == 2
        if (this._padType === 2) {
          lastBlock[remaining] = 0x80;
        }

        this._processBlock(lastBlock);
      }

      // Return hash value
      return [...this.h, ...this.hh];
    }

    _processBlock(block) {
      // Prepare keys for DES encryption (using OpCodes for bit manipulation)
      const key1 = [...this.h];
      // key1[0] = (key1[0] & 0x9F) | 0x40 = clear bit 5 and bit 6, then set bit 6
      key1[0] = OpCodes.SetBit(OpCodes.SetBit(key1[0], 5, 0), 6, 1);

      const key2 = [...this.hh];
      // key2[0] = (key2[0] & 0x9F) | 0x20 = clear bit 5 and bit 6, then set bit 5
      key2[0] = OpCodes.SetBit(OpCodes.SetBit(key2[0], 6, 0), 5, 1);

      // Encrypt block with both keys
      const d = desEncrypt(block, key1);
      const dd = desEncrypt(block, key2);

      // Update state with Davies-Meyer construction
      // Note: XOR is a language primitive operation, not in OpCodes
      const newH = new Array(8);
      const newHH = new Array(8);

      // newH gets: XOR of block with d (first 4 bytes) and dd (last 4 bytes)
      for (let i = 0; i < 4; ++i) {
        newH[i] = block[i] ^ d[i];
      }
      for (let i = 4; i < 8; ++i) {
        newH[i] = block[i] ^ dd[i];
      }

      // newHH gets: XOR of block with dd (first 4 bytes) and d (last 4 bytes)
      for (let i = 0; i < 4; ++i) {
        newHH[i] = block[i] ^ dd[i];
      }
      for (let i = 4; i < 8; ++i) {
        newHH[i] = block[i] ^ d[i];
      }

      this.h = newH;
      this.hh = newHH;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new MDC2Algorithm());

  return MDC2Algorithm;
}));
