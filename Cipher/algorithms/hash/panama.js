/*
 * Panama Hash Function and MAC - Comprehensive Implementation
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * Implements both Panama-LE (Little Endian) and Panama-BE (Big Endian)
 * Hash functions and MAC variants using hermetic construction.
 *
 * Belt-and-mill construction with 17-word state and 32-stage buffer
 * Reference: "Fast Hashing and Stream Encryption with PANAMA" (FSE'98)
 *
 * SECURITY WARNING: Panama is cryptographically broken (collision attacks exist)
 * Use only for legacy compatibility - DO NOT use in new applications
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
          HashFunctionAlgorithm, MacAlgorithm, IHashFunctionInstance, IMacInstance,
          LinkItem, KeySize } = AlgorithmFramework;

  // Panama constants
  const STAGES = 32;        // Number of belt stages
  const STAGE_SIZE = 8;     // Words per stage
  const BLOCK_SIZE = 32;    // Bytes (8 words)
  const DIGEST_SIZE = 32;   // Bytes (8 words)

  /**
   * Helper function to repeat a byte pattern
   * @param {Array} pattern - Pattern to repeat
   * @param {number} count - Number of times to repeat
   * @returns {Array} Repeated pattern
   */
  function repeatBytes(pattern, count) {
    const result = new Array(pattern.length * count);
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < pattern.length; j++) {
        result[i * pattern.length + j] = pattern[j];
      }
    }
    return result;
  }

  // ===== SHARED PANAMA CORE IMPLEMENTATION =====

  /**
   * Core Panama state machine implementing belt-and-mill construction
   * Supports both little-endian and big-endian variants
   */
  class PanamaCore {
    constructor(isLittleEndian) {
      this.isLE = isLittleEndian;
      this.reset();
    }

    reset() {
      // Mill state: 17 words
      this.a = new Uint32Array(17);

      // Belt buffer: 32 stages of 8 words each
      this.b = new Array(STAGES);
      for (let i = 0; i < STAGES; i++) {
        this.b[i] = new Uint32Array(STAGE_SIZE);
      }

      this.bstart = 0;
      this.buffer = [];
    }

    /**
     * State indexing with reordering for optimization
     * a(i) = a[((i)*13+16) % 17]
     * Inverse of 4 mod 17 is 13 (used for SSE2 optimization alignment)
     */
    _aIndex(i) {
      return (i * 13 + 16) % 17;
    }

    /**
     * Main iteration function - performs one round of belt-and-mill operation
     * @param {Uint32Array|null} input - 8-word input block (null for pull phase)
     * @param {Array|null} output - Output buffer for keystream (null if no output needed)
     */
    _iterate(input, output) {
      const cPtr = new Uint32Array(17);

      // Output keystream (if requested) - extract before state update
      if (output) {
        for (let i = 0; i < STAGE_SIZE; i++) {
          const word = this.a[this._aIndex(i + 9)];
          const bytes = this.isLE ? OpCodes.Unpack32LE(word) : OpCodes.Unpack32BE(word);
          for (let j = 0; j < 4; j++) {
            output.push(bytes[j]);
          }
        }
      }

      // Calculate buffer pointers BEFORE advancing bstart
      const b16 = this.b[(this.bstart + 16)&(STAGES - 1)];
      const b4 = this.b[(this.bstart + (STAGES - 4))&(STAGES - 1)];

      // Advance belt position
      this.bstart = (this.bstart + 1)&(STAGES - 1);

      // Calculate buffer pointers AFTER advancing bstart
      const b0 = this.b[this.bstart];
      const b25 = this.b[(this.bstart + (STAGES - 25))&(STAGES - 1)];

      // Buffer update
      if (input) {
        // US: update with input (PUSH phase)
        for (let i = 0; i < STAGE_SIZE; i++) {
          const t = b0[i];
          b0[i] = OpCodes.Xor32(input[i], t);
          b25[(i + 6) % STAGE_SIZE] = OpCodes.Xor32(b25[(i + 6) % STAGE_SIZE], t);
        }
      } else {
        // UL: update without input (PULL phase)
        for (let i = 0; i < STAGE_SIZE; i++) {
          const t = b0[i];
          b0[i] = OpCodes.Xor32(this.a[this._aIndex(i + 1)], t);
          b25[(i + 6) % STAGE_SIZE] = OpCodes.Xor32(b25[(i + 6) % STAGE_SIZE], t);
        }
      }

      // GAMMA and PI transformations
      for (let i = 0; i < 17; i++) {
        const ai = this.a[this._aIndex(i)];
        const ai1 = this.a[this._aIndex((i + 1) % 17)];
        const ai2 = this.a[this._aIndex((i + 2) % 17)];

        // Gamma: a[i]^(a[i+1]|~a[i+2])
        const notAi2 = OpCodes.ToUint32(~ai2);
        const orResult = ai1|notAi2;
        const gamma = OpCodes.Xor32(ai, OpCodes.ToUint32(orResult));

        // Pi: rotation based on position
        const pos = (5 * i) % 17;
        const rotation = (pos * (pos + 1) / 2) % 32;

        cPtr[this._aIndex(pos)] = OpCodes.RotL32(gamma, rotation);
      }

      // THETA transformation: a[0] = c[0]^c[1]^c[4]^1
      const theta0_1 = OpCodes.Xor32(cPtr[this._aIndex(0)], cPtr[this._aIndex(1)]);
      const theta0_2 = OpCodes.Xor32(theta0_1, cPtr[this._aIndex(4)]);
      this.a[this._aIndex(0)] = OpCodes.Xor32(theta0_2, 1);

      // THETA and SIGMA with input (TS1S) or buffer (TS1L)
      if (input) {
        for (let i = 0; i < STAGE_SIZE; i++) {
          const xor1 = OpCodes.Xor32(cPtr[this._aIndex(i + 1)], cPtr[this._aIndex((i + 2) % 17)]);
          const xor2 = OpCodes.Xor32(xor1, cPtr[this._aIndex((i + 5) % 17)]);
          this.a[this._aIndex(i + 1)] = OpCodes.Xor32(xor2, input[i]);
        }
      } else {
        for (let i = 0; i < STAGE_SIZE; i++) {
          const xor1 = OpCodes.Xor32(cPtr[this._aIndex(i + 1)], cPtr[this._aIndex((i + 2) % 17)]);
          const xor2 = OpCodes.Xor32(xor1, cPtr[this._aIndex((i + 5) % 17)]);
          this.a[this._aIndex(i + 1)] = OpCodes.Xor32(xor2, b4[i]);
        }
      }

      // TS2: theta-sigma from b[16]
      for (let i = 0; i < STAGE_SIZE; i++) {
        const xor1 = OpCodes.Xor32(cPtr[this._aIndex(i + 9)], cPtr[this._aIndex((i + 10) % 17)]);
        const xor2 = OpCodes.Xor32(xor1, cPtr[this._aIndex((i + 13) % 17)]);
        this.a[this._aIndex(i + 9)] = OpCodes.Xor32(xor2, b16[i]);
      }
    }

    /**
     * Convert buffered bytes to final hash output
     */
    finalize() {
      // Pad to block boundary (Panama uses 0x01 padding)
      const blockBytes = this.buffer.length % BLOCK_SIZE;

      if (blockBytes !== 0) {
        this.buffer.push(0x01);
        while ((this.buffer.length % BLOCK_SIZE) !== 0) {
          this.buffer.push(0x00);
        }
      } else if (this.buffer.length === 0) {
        this.buffer.push(0x01);
        while (this.buffer.length < BLOCK_SIZE) {
          this.buffer.push(0x00);
        }
      } else {
        this.buffer.push(0x01);
        while ((this.buffer.length % BLOCK_SIZE) !== 0) {
          this.buffer.push(0x00);
        }
      }

      // PUSH phase: process all blocks
      for (let offset = 0; offset < this.buffer.length; offset += BLOCK_SIZE) {
        const block = new Uint32Array(STAGE_SIZE);
        for (let i = 0; i < STAGE_SIZE; i++) {
          const byteOffset = offset + i * 4;
          if (this.isLE) {
            block[i] = OpCodes.Pack32LE(
              this.buffer[byteOffset] || 0,
              this.buffer[byteOffset + 1] || 0,
              this.buffer[byteOffset + 2] || 0,
              this.buffer[byteOffset + 3] || 0
            );
          } else {
            block[i] = OpCodes.Pack32BE(
              this.buffer[byteOffset] || 0,
              this.buffer[byteOffset + 1] || 0,
              this.buffer[byteOffset + 2] || 0,
              this.buffer[byteOffset + 3] || 0
            );
          }
        }
        this._iterate(block, null);
      }

      // PULL phase: 32 blank iterations
      for (let i = 0; i < 32; i++) {
        this._iterate(null, null);
      }

      // Final iteration to extract output
      const output = [];
      this._iterate(null, output);

      this.reset();
      return output;
    }
  }

  // ===== PANAMA-LE HASH FUNCTION =====

  /**
 * PanamaLEAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class PanamaLEAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "Panama-LE";
      this.description = "Panama hash function with little-endian byte order. Belt-and-mill construction combining linear feedback shift register (belt) and nonlinear state machine (mill). Broken by collision attacks - use for legacy compatibility only.";
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
        new LinkItem("Panama Specification (FSE'98)", "http://www.weidai.com/scan-mirror/md.html#Panama"),
        new LinkItem("Original Paper (FSE'98)", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/panama.zip"),
        new LinkItem("NESSIE Portfolio", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      this.references = [
        new LinkItem("Crypto++ Implementation", "https://github.com/weidai11/cryptopp/blob/master/panama.cpp"),
        new LinkItem("Crypto++ Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt")
      ];

      this.tests = [
        {
          text: "Panama-LE: Empty string (Crypto++ reference)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: [],
          expected: OpCodes.Hex8ToBytes("aa0cc954d757d7ac7779ca3342334ca471abd47d5952ac91ed837ecd5b16922b")
        },
        {
          text: "Panama-LE: 'The quick brown fox jumps over the lazy dog' (Crypto++ reference)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("5f5ca355b90ac622b0aa7e654ef5f27e9e75111415b48b8afe3add1c6b89cba1")
        },
        {
          text: "Panama-LE: Repeated 'a' pattern (15625 repetitions, Crypto++ generated)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: repeatBytes(OpCodes.AnsiToBytes("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), 15625),
          expected: OpCodes.Hex8ToBytes("af9c66fb6058e2232a5dfba063ee14b0f86f0e334e165812559435464dd9bb60")
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
      return new PanamaLEInstance(this);
    }
  }

  /**
 * PanamaLE cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PanamaLEInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.core = new PanamaCore(true);
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) {
        this.core.buffer.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      return this.core.finalize();
    }
  }

  // ===== PANAMA-BE HASH FUNCTION =====

  /**
 * PanamaBEAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class PanamaBEAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "Panama-BE";
      this.description = "Panama hash function with big-endian byte order. Belt-and-mill construction combining linear feedback shift register (belt) and nonlinear state machine (mill). Broken by collision attacks - use for legacy compatibility only.";
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
        new LinkItem("Panama Specification (FSE'98)", "http://www.weidai.com/scan-mirror/md.html#Panama"),
        new LinkItem("Original Paper (FSE'98)", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/panama.zip"),
        new LinkItem("NESSIE Portfolio", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      this.references = [
        new LinkItem("Crypto++ Implementation", "https://github.com/weidai11/cryptopp/blob/master/panama.cpp"),
        new LinkItem("Crypto++ Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt")
      ];

      this.tests = [
        {
          text: "Panama-BE: Empty string (Crypto++ reference)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: [],
          expected: OpCodes.Hex8ToBytes("e81aa04523532dd7267e5c5bc3ba0e289837a62ba032350351980e960a84b0af")
        },
        {
          text: "Panama-BE: 'The quick brown fox jumps over the lazy dog' (Crypto++ reference)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("8fa7dadce0110f979a0b795e76b2c25628d8bda88747758149c42e3bc13f85bc")
        },
        {
          text: "Panama-BE: Repeated 'a' pattern (15625 repetitions, Crypto++ generated)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: repeatBytes(OpCodes.AnsiToBytes("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), 15625),
          expected: OpCodes.Hex8ToBytes("cb34f0937e8d870d3bd7ff6311765f2c229a6c2154e4db119538db5159437cab")
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
      this.core = new PanamaCore(false);
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) {
        this.core.buffer.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      return this.core.finalize();
    }
  }

  // ===== PANAMA-LE MAC (HERMETIC CONSTRUCTION) =====

  class PanamaLEMACAlgorithm extends MacAlgorithm {
    constructor() {
      super();
      this.name = "Panama-LE-MAC";
      this.description = "Panama-LE MAC using hermetic hash function construction. Key is prepended to message before hashing. Broken by collision attacks on underlying hash - use for legacy compatibility only.";
      this.inventor = "Joan Daemen, Craig Clapp";
      this.year = 1998;
      this.category = CategoryType.MAC;
      this.subCategory = "Hermetic MAC";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedMacSizes = [new KeySize(32, 32, 1)];
      this.NeedsKey = true;
      this.VariableKeyLength = true;

      this.documentation = [
        new LinkItem("Panama Specification (FSE'98)", "http://www.weidai.com/scan-mirror/md.html#Panama"),
        new LinkItem("Hermetic MAC Construction", "https://github.com/weidai11/cryptopp/blob/master/panama.h#L66")
      ];

      this.references = [
        new LinkItem("Crypto++ Implementation", "https://github.com/weidai11/cryptopp/blob/master/panama.h"),
        new LinkItem("Crypto++ Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt")
      ];

      this.tests = [
        {
          text: "Panama-LE-MAC: Empty key, empty message (Crypto++ modified)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: [],
          key: [],
          expected: OpCodes.Hex8ToBytes("aa0cc954d757d7ac7779ca3342334ca471abd47d5952ac91ed837ecd5b16922b")
        },
        {
          text: "Panama-LE-MAC: Empty key, 'The quick brown fox...' (Crypto++ modified)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          key: [],
          expected: OpCodes.Hex8ToBytes("5f5ca355b90ac622b0aa7e654ef5f27e9e75111415b48b8afe3add1c6b89cba1")
        },
        {
          text: "Panama-LE-MAC: Key 'The ', message 'quick brown fox...' (Crypto++ modified)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: OpCodes.AnsiToBytes("quick brown fox jumps over the lazy dog"),
          key: OpCodes.AnsiToBytes("The "),
          expected: OpCodes.Hex8ToBytes("5f5ca355b90ac622b0aa7e654ef5f27e9e75111415b48b8afe3add1c6b89cba1")
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
      return new PanamaLEMACInstance(this);
    }
  }

  /**
 * PanamaLEMAC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PanamaLEMACInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this.core = new PanamaCore(true);
      this.keyed = false;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      this._key = [...keyBytes];
      this.keyed = false;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!this.keyed && this._key && this._key.length > 0) {
        for (let i = 0; i < this._key.length; i++) {
          this.core.buffer.push(this._key[i]);
        }
        this.keyed = true;
      }
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) {
        this.core.buffer.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.keyed && this._key && this._key.length > 0) {
        for (let i = 0; i < this._key.length; i++) {
          this.core.buffer.push(this._key[i]);
        }
        this.keyed = true;
      }
      const result = this.core.finalize();
      this.keyed = false;
      return result;
    }
  }

  // ===== PANAMA-BE MAC (HERMETIC CONSTRUCTION) =====

  class PanamaBEMACAlgorithm extends MacAlgorithm {
    constructor() {
      super();
      this.name = "Panama-BE-MAC";
      this.description = "Panama-BE MAC using hermetic hash function construction. Key is prepended to message before hashing. Broken by collision attacks on underlying hash - use for legacy compatibility only.";
      this.inventor = "Joan Daemen, Craig Clapp";
      this.year = 1998;
      this.category = CategoryType.MAC;
      this.subCategory = "Hermetic MAC";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedMacSizes = [new KeySize(32, 32, 1)];
      this.NeedsKey = true;
      this.VariableKeyLength = true;

      this.documentation = [
        new LinkItem("Panama Specification (FSE'98)", "http://www.weidai.com/scan-mirror/md.html#Panama"),
        new LinkItem("Hermetic MAC Construction", "https://github.com/weidai11/cryptopp/blob/master/panama.h#L66")
      ];

      this.references = [
        new LinkItem("Crypto++ Implementation", "https://github.com/weidai11/cryptopp/blob/master/panama.h"),
        new LinkItem("Crypto++ Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt")
      ];

      this.tests = [
        {
          text: "Panama-BE-MAC: Empty key, empty message (Crypto++ modified)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: [],
          key: [],
          expected: OpCodes.Hex8ToBytes("e81aa04523532dd7267e5c5bc3ba0e289837a62ba032350351980e960a84b0af")
        },
        {
          text: "Panama-BE-MAC: Empty key, 'The quick brown fox...' (Crypto++ modified)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          key: [],
          expected: OpCodes.Hex8ToBytes("8fa7dadce0110f979a0b795e76b2c25628d8bda88747758149c42e3bc13f85bc")
        },
        {
          text: "Panama-BE-MAC: Key 'The ', message 'quick brown fox...' (Crypto++ modified)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: OpCodes.AnsiToBytes("quick brown fox jumps over the lazy dog"),
          key: OpCodes.AnsiToBytes("The "),
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
      return new PanamaBEMACInstance(this);
    }
  }

  /**
 * PanamaBEMAC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PanamaBEMACInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this.core = new PanamaCore(false);
      this.keyed = false;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      this._key = [...keyBytes];
      this.keyed = false;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!this.keyed && this._key && this._key.length > 0) {
        for (let i = 0; i < this._key.length; i++) {
          this.core.buffer.push(this._key[i]);
        }
        this.keyed = true;
      }
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) {
        this.core.buffer.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.keyed && this._key && this._key.length > 0) {
        for (let i = 0; i < this._key.length; i++) {
          this.core.buffer.push(this._key[i]);
        }
        this.keyed = true;
      }
      const result = this.core.finalize();
      this.keyed = false;
      return result;
    }
  }

  // ===== ALGORITHM REGISTRATION =====

  const panamaLE = new PanamaLEAlgorithm();
  const panamaBE = new PanamaBEAlgorithm();
  const panamaLEMAC = new PanamaLEMACAlgorithm();
  const panamaBEMAC = new PanamaBEMACAlgorithm();

  if (!AlgorithmFramework.Find(panamaLE.name)) {
    RegisterAlgorithm(panamaLE);
  }
  if (!AlgorithmFramework.Find(panamaBE.name)) {
    RegisterAlgorithm(panamaBE);
  }
  if (!AlgorithmFramework.Find(panamaLEMAC.name)) {
    RegisterAlgorithm(panamaLEMAC);
  }
  if (!AlgorithmFramework.Find(panamaBEMAC.name)) {
    RegisterAlgorithm(panamaBEMAC);
  }

  return {
    PanamaLEAlgorithm, PanamaLEInstance,
    PanamaBEAlgorithm, PanamaBEInstance,
    PanamaLEMACAlgorithm, PanamaLEMACInstance,
    PanamaBEMACAlgorithm, PanamaBEMACInstance
  };
}));
