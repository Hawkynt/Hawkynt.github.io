/*
 * Panama-BE Hash Function (Big Endian)
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * Belt-and-mill construction with 17-word state and 32-stage buffer
 * Reference: http://www.weidai.com/scan-mirror/md.html#Panama
 * Note: Classified as "Weak" in Crypto++ - use for legacy compatibility only
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Panama parameters
  const STAGES = 32;
  const STAGE_SIZE = 8;  // words per stage
  const BLOCK_SIZE = 32; // bytes (8 words)
  const DIGEST_SIZE = 32; // bytes (8 words)

  // Helper function: rotate left 32-bit
  function rotl32(x, n) {
    return OpCodes.RotL32(x, n);
  }

  /**
 * PanamaBEAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class PanamaBEAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "Panama-BE";
      this.description = "Panama hash function with big-endian byte order. Belt-and-mill construction combining linear and nonlinear operations. Classified as weak - use for legacy compatibility only.";
      this.inventor = "Joan Daemen, Craig Clapp";
      this.year = 1998;
      this.category = CategoryType.HASH;
      this.subCategory = "Belt-and-Mill";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedHashSizes = [new KeySize(32, 32, 1)];
      this.BlockSize = 32;

      this.documentation = [
        new LinkItem("Panama Specification", "http://www.weidai.com/scan-mirror/md.html#Panama"),
        new LinkItem("Original Paper", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      this.references = [
        new LinkItem("Crypto++ Panama", "https://github.com/weidai11/cryptopp/blob/master/panama.cpp")
      ];

      this.tests = [
        {
          text: "Panama-BE: Empty string (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: [],
          expected: OpCodes.Hex8ToBytes("e81aa04523532dd7267e5c5bc3ba0e289837a62ba032350351980e960a84b0af")
        },
        {
          text: "Panama-BE: Quick brown fox (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("8fa7dadce0110f979a0b795e76b2c25628d8bda88747758149c42e3bc13f85bc")
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
      return new PanamaBEInstance(this);
    }
  }

  /**
 * PanamaBE cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PanamaBEInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.reset();
    }

    reset() {
      // State: a[17] (mill) + b[32][8] (belt)
      this.a = new Uint32Array(17);
      this.b = new Array(STAGES);
      for (let i = 0; i < STAGES; ++i) {
        this.b[i] = new Uint32Array(STAGE_SIZE);
      }
      this.bstart = 0;
      this.buffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.buffer.push(...data);
    }

    // State indexing with reordering for optimization
    // a(i) = a[((i)*13+16) % 17] - inverse of 4 mod 17 is 13
    _aIndex(i) {
      return ((i * 13 + 16) % 17);
    }

    // Iterate one round
    _iterate(input, output) {
      const cPtr = new Uint32Array(17);

      // Output keystream first (if requested) - before state update
      if (output) {
        for (let i = 0; i < STAGE_SIZE; ++i) {
          const word = this.a[this._aIndex(i + 9)];
          const bytes = OpCodes.Unpack32BE(word);  // BIG ENDIAN
          for (let j = 0; j < 4; ++j) {
            output.push(bytes[j]);
          }
        }
      }

      // Calculate buffer pointers BEFORE advancing bstart
      const b16 = this.b[(this.bstart + 16) & (STAGES - 1)];
      const b4 = this.b[(this.bstart + (STAGES - 4)) & (STAGES - 1)];

      // Advance belt position
      this.bstart = (this.bstart + 1) & (STAGES - 1);

      // Calculate buffer pointers AFTER advancing bstart
      const b0 = this.b[this.bstart];
      const b25 = this.b[(this.bstart + (STAGES - 25)) & (STAGES - 1)];

      // Buffer update
      if (input) {
        // US: update with input
        for (let i = 0; i < STAGE_SIZE; ++i) {
          const t = b0[i];
          b0[i] = input[i] ^ t;
          b25[(i + 6) % STAGE_SIZE] ^= t;
        }
      } else {
        // UL: update without input
        for (let i = 0; i < STAGE_SIZE; ++i) {
          const t = b0[i];
          b0[i] = this.a[this._aIndex(i + 1)] ^ t;
          b25[(i + 6) % STAGE_SIZE] ^= t;
        }
      }

      // Gamma and Pi
      for (let i = 0; i < 17; ++i) {
        const ai = this.a[this._aIndex(i)];
        const ai1 = this.a[this._aIndex((i + 1) % 17)];
        const ai2 = this.a[this._aIndex((i + 2) % 17)];
        const rotation = ((5 * i % 17) * ((5 * i % 17) + 1) / 2) % 32;
        cPtr[this._aIndex(5 * i % 17)] = rotl32(ai ^ (ai1 | ~ai2), rotation);
      }

      // Theta and Sigma
      this.a[this._aIndex(0)] = cPtr[this._aIndex(0)] ^ cPtr[this._aIndex(1)] ^ cPtr[this._aIndex(4)] ^ 1;

      if (input) {
        // TS1S: theta-sigma with input
        for (let i = 0; i < STAGE_SIZE; ++i) {
          this.a[this._aIndex(i + 1)] = cPtr[this._aIndex(i + 1)] ^
                                         cPtr[this._aIndex((i + 2) % 17)] ^
                                         cPtr[this._aIndex((i + 5) % 17)] ^
                                         input[i];
        }
      } else {
        // TS1L: theta-sigma without input
        for (let i = 0; i < STAGE_SIZE; ++i) {
          this.a[this._aIndex(i + 1)] = cPtr[this._aIndex(i + 1)] ^
                                         cPtr[this._aIndex((i + 2) % 17)] ^
                                         cPtr[this._aIndex((i + 5) % 17)] ^
                                         b4[i];
        }
      }

      // TS2: theta-sigma from b[16]
      for (let i = 0; i < STAGE_SIZE; ++i) {
        this.a[this._aIndex(i + 9)] = cPtr[this._aIndex(i + 9)] ^
                                       cPtr[this._aIndex((i + 10) % 17)] ^
                                       cPtr[this._aIndex((i + 13) % 17)] ^
                                       b16[i];
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Pad to block boundary
      const blockBytes = this.buffer.length % BLOCK_SIZE;
      if (blockBytes !== 0) {
        // Add padding byte 0x01
        this.buffer.push(0x01);
        // Pad with zeros to block boundary
        while (this.buffer.length % BLOCK_SIZE !== 0) {
          this.buffer.push(0x00);
        }
      } else if (this.buffer.length === 0) {
        // Empty message: add 0x01 and pad to full block
        this.buffer.push(0x01);
        while (this.buffer.length < BLOCK_SIZE) {
          this.buffer.push(0x00);
        }
      } else {
        // Exactly on block boundary: add full padding block
        this.buffer.push(0x01);
        while (this.buffer.length % BLOCK_SIZE !== 0) {
          this.buffer.push(0x00);
        }
      }

      // Process all blocks (push phase)
      for (let offset = 0; offset < this.buffer.length; offset += BLOCK_SIZE) {
        const block = new Uint32Array(STAGE_SIZE);
        for (let i = 0; i < STAGE_SIZE; ++i) {
          block[i] = OpCodes.Pack32BE(  // BIG ENDIAN
            this.buffer[offset + i * 4] || 0,
            this.buffer[offset + i * 4 + 1] || 0,
            this.buffer[offset + i * 4 + 2] || 0,
            this.buffer[offset + i * 4 + 3] || 0
          );
        }
        this._iterate(block, null);
      }

      // Pull phase: 32 blank iterations
      for (let i = 0; i < 32; ++i) {
        this._iterate(null, null);
      }

      // Final iteration to extract output
      const output = [];
      this._iterate(null, output);

      this.reset();
      return output;
    }
  }

  const algorithmInstance = new PanamaBEAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { PanamaBEAlgorithm, PanamaBEInstance };
}));
