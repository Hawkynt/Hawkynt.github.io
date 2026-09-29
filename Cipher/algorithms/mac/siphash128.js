/*
 * SipHash-128 - 128-bit Output Variant of SipHash MAC
 * Production implementation following BouncyCastle reference
 * (c)2006-2025 Hawkynt
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
    root.SipHash128 = factory(root.AlgorithmFramework, root.OpCodes);
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
          MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * SipHash-128 Algorithm Class
   * 128-bit output variant of SipHash-2-4
   */
  class SipHash128Algorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SipHash-128";
      this.description = "128-bit output variant of SipHash. Fast cryptographically secure PRF producing 16-byte MAC tags. Default configuration uses 2 compression rounds and 4 finalization rounds (SipHash-2-4-128).";
      this.inventor = "Jean-Philippe Aumasson, Daniel J. Bernstein";
      this.year = 2012;
      this.category = CategoryType.MAC;
      this.subCategory = "Pseudo-Random Function";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      // MAC-specific metadata
      this.SupportedKeySizes = [new KeySize(16, 16, 1)]; // Exactly 16 bytes (128 bits)
      this.SupportedOutputSizes = [new KeySize(16, 16, 1)]; // Fixed 16-byte (128-bit) output

      // Documentation and references
      this.documentation = [
        new LinkItem("SipHash Paper", "https://cr.yp.to/siphash/siphash-20120918.pdf"),
        new LinkItem("SipHash Official Repository", "https://github.com/veorq/SipHash"),
        new LinkItem("BouncyCastle SipHash128 Reference", "https://github.com/bcgit/bc-lts-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/SipHash128.java")
      ];

      this.references = [
        new LinkItem("RFC 9018 (DNS Cookie usage)", "https://www.rfc-editor.org/rfc/rfc9018.txt"),
        new LinkItem("SipHash Test Vectors", "https://github.com/veorq/SipHash/blob/master/vectors.h"),
        new LinkItem("BouncyCastle Test Suite", "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java")
      ];

      // Test vectors from BouncyCastle SipHash128Test.java
      // Using key: 00010203 04050607 08090a0b 0c0d0e0f
      // Input: sequential bytes starting from 0
      const testKey = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f");

      this.tests = [
        {
          text: "SipHash-128 Official Vector #0 (empty input)",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java",
          input: [],
          key: testKey,
          expected: OpCodes.Hex8ToBytes("a3817f04ba25a8e66df67214c7550293")
        },
        {
          text: "SipHash-128 Official Vector #1 (1 byte: 0x00)",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java",
          input: [0x00],
          key: testKey,
          expected: OpCodes.Hex8ToBytes("da87c1d86b99af44347659119b22fc45")
        },
        {
          text: "SipHash-128 Official Vector #2 (2 bytes: 0x00, 0x01)",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java",
          input: [0x00, 0x01],
          key: testKey,
          expected: OpCodes.Hex8ToBytes("8177228da4a45dc7fca38bdef60affe4")
        },
        {
          text: "SipHash-128 Official Vector #3 (3 bytes: 0x00, 0x01, 0x02)",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java",
          input: [0x00, 0x01, 0x02],
          key: testKey,
          expected: OpCodes.Hex8ToBytes("9c70b60c5267a94e5f33b6b02985ed51")
        },
        {
          text: "SipHash-128 Official Vector #7 (7 bytes)",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java",
          input: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06],
          key: testKey,
          expected: OpCodes.Hex8ToBytes("a1f1ebbed8dbc153c0b84aa61ff08239")
        },
        {
          text: "SipHash-128 Official Vector #15 (15 bytes)",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java",
          input: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e],
          key: testKey,
          expected: OpCodes.Hex8ToBytes("5493e99933b0a8117e08ec0f97cfc3d9")
        },
        {
          text: "SipHash-128 Official Vector #31 (31 bytes)",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java",
          input: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
                  0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e],
          key: testKey,
          expected: OpCodes.Hex8ToBytes("2939b0183223fafc1723de4f52c43d35")
        }
      ];
    }

    /**
   * Create new MAC instance
   * @param {boolean} [isInverse=false] - Unused: a MAC has no inverse
   * @returns {SipHash128Instance} New MAC instance
   */

    CreateInstance(isInverse = false) {
      return new SipHash128Instance(this, isInverse);
    }
  }

  /**
   * SipHash-128 Instance Implementation
   * Implements Feed/Result pattern for MAC computation
   */
  class SipHash128Instance extends IMacInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {SipHash128Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Unused: a MAC has no inverse
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;

      // SipHash parameters (c compression rounds, d finalization rounds)
      /** @type {int32} */
      this._cRounds = 2; // Default: 2 compression rounds
      /** @type {int32} */
      this._dRounds = 4; // Default: 4 finalization rounds

      // Internal state
      /** @type {uint8[]} */
      this._key = null;
      this.inputBuffer = [];

      // State variables (64-bit values represented as [low32, high32])
      /** @type {uint32[]} */
      this.v0 = [0, 0];
      /** @type {uint32[]} */
      this.v1 = [0, 0];
      /** @type {uint32[]} */
      this.v2 = [0, 0];
      /** @type {uint32[]} */
      this.v3 = [0, 0];

      // Message word accumulator
      /** @type {uint32[]} */
      this.m = [0, 0];
      /** @type {int32} */
      this.wordPos = 0;
      /** @type {int32} */
      this.wordCount = 0;
    }

    // Property: key (128-bit / 16 bytes)
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

      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. SipHash-128 requires exactly 16 bytes.");
      }

      this._key = [...keyBytes];
      this._initializeState();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property: cRounds (compression rounds)
    /**
     * Set the number of compression rounds
     * @param {int32} rounds - 1..16
     * @throws {Error} If out of range
     */
    set cRounds(rounds) {
      if (rounds < 1 || rounds > 16) {
        throw new Error("Invalid cRounds: " + rounds + ". Must be between 1 and 16.");
      }
      this._cRounds = rounds;
    }

    /**
     * Number of compression rounds
     * @returns {int32} Compression rounds
     */
    get cRounds() {
      return this._cRounds;
    }

    // Property: dRounds (finalization rounds)
    /**
     * Set the number of finalization rounds
     * @param {int32} rounds - 1..16
     * @throws {Error} If out of range
     */
    set dRounds(rounds) {
      if (rounds < 1 || rounds > 16) {
        throw new Error("Invalid dRounds: " + rounds + ". Must be between 1 and 16.");
      }
      this._dRounds = rounds;
    }

    /**
     * Number of finalization rounds
     * @returns {int32} Finalization rounds
     */
    get dRounds() {
      return this._dRounds;
    }

    /**
     * Initialize SipHash state with key
     * State initialized with key XOR'd with constants
     * @returns {void}
     */
    _initializeState() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Extract two 64-bit keys from 16-byte key (little-endian)
      const k0 = this._bytesToWord64LE(this._key, 0);
      const k1 = this._bytesToWord64LE(this._key, 8);

      // Initialize state: v0 = k0 XOR 0x736f6d6570736575
      this.v0 = this._xor64(k0, this._word64(0x70736575, 0x736f6d65));
      // v1 = k1 XOR 0x646f72616e646f6d
      this.v1 = this._xor64(k1, this._word64(0x6e646f6d, 0x646f7261));
      // v2 = k0 XOR 0x6c7967656e657261
      this.v2 = this._xor64(k0, this._word64(0x6e657261, 0x6c796765));
      // v3 = k1 XOR 0x7465646279746573
      this.v3 = this._xor64(k1, this._word64(0x79746573, 0x74656462));

      // For SipHash-128, XOR v1 with 0xee during initialization
      this.v1 = this._xor64(this.v1, this._word64(0xee, 0));

      // Reset message processing state
      this.m = this._word64(0, 0);
      this.wordPos = 0;
      this.wordCount = 0;
    }


    /**
     * Compute final MAC result
     * Returns 128-bit (16-byte) MAC tag
     * @returns {uint8[]} 16-byte tag
     */
    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Process accumulated input using BouncyCastle byte-by-byte logic
      const message = this.inputBuffer;
      const messageLen = message.length;
      let i = 0;
      /** @type {int32} */
      const fullWords = OpCodes.And32(messageLen, OpCodes.Not32(7)); // Round down to multiple of 8

      // Process complete 8-byte blocks
      if (this.wordPos === 0) {
        // Fast path: no partial word pending
        for (; i < fullWords; i += 8) {
          this.m = this._bytesToWord64LE(message, i);
          this._processMessageWord();
        }
        // Process remaining bytes into m (shift register style, MSB first)
        for (; i < messageLen; i++) {
          this.m = this._shr64(this.m, 8);
          // Place byte at position 56 (bits 56-63): high32[24-31]
          this.m = this._or64(this.m, this._word64(0, OpCodes.Shl32(OpCodes.And32(message[i], 0xFF), 24)));
        }
        this.wordPos = messageLen - fullWords;
      } else {
        // Slow path: partial word pending
        const bits = OpCodes.Shl32(this.wordPos, 3);
        for (; i < fullWords; i += 8) {
          const n = this._bytesToWord64LE(message, i);
          this.m = this._or64(this._shl64(n, bits), this._shr64(this.m, -bits));
          this._processMessageWord();
          this.m = n;
        }
        // Process remaining bytes
        for (; i < messageLen; i++) {
          this.m = this._shr64(this.m, 8);
          this.m = this._or64(this.m, this._word64(0, OpCodes.Shl32(OpCodes.And32(message[i], 0xFF), 24)));

          if (++this.wordPos === 8) {
            this._processMessageWord();
            this.wordPos = 0;
          }
        }
      }

      // Finalization padding (BouncyCastle doFinal logic)
      // Shift m to align partial word
      this.m = this._shr64(this.m, OpCodes.Shl32((7 - this.wordPos), 3));
      this.m = this._shr64(this.m, 8);
      // Add message length byte at position 7 (bits 56-63): high32[24-31]
      const lenByte = OpCodes.And32(OpCodes.Add32(OpCodes.Shl32(this.wordCount, 3), this.wordPos), 0xFF);
      this.m = this._or64(this.m, this._word64(0, OpCodes.Shl32(lenByte, 24)));

      this._processMessageWord();

      // Compute first 64-bit half of MAC
      this.v2 = this._xor64(this.v2, this._word64(0xee, 0)); // First finalization XOR (0xee)
      this._applySipRounds(this._dRounds);
      const r0 = this._xor64(this._xor64(this.v0, this.v1), this._xor64(this.v2, this.v3));

      // Compute second 64-bit half of MAC
      this.v1 = this._xor64(this.v1, this._word64(0xdd, 0)); // Second finalization XOR (0xdd)
      this._applySipRounds(this._dRounds);
      const r1 = this._xor64(this._xor64(this.v0, this.v1), this._xor64(this.v2, this.v3));

      // Convert to bytes (little-endian) and concatenate
      /** @type {uint8[]} */
      const result = new Array(16);
      const r0Bytes = this._word64ToBytes(r0);
      const r1Bytes = this._word64ToBytes(r1);

      for (let i = 0; i < 8; i++) {
        result[i] = r0Bytes[i];
        result[i + 8] = r1Bytes[i];
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      // Re-initialize state for next MAC computation
      this._initializeState();

      return result;
    }

    /**
     * Process single 64-bit message word
     * Applies c rounds of SipRound with message mixing
     * @returns {void}
     */
    _processMessageWord() {
      this.wordCount++;

      // v3 ^= m
      this.v3 = this._xor64(this.v3, this.m);

      // Apply c rounds
      this._applySipRounds(this._cRounds);

      // v0 ^= m
      this.v0 = this._xor64(this.v0, this.m);
    }

    /**
     * Apply n rounds of SipRound function
     * SipRound is the core permutation of SipHash
     * @param {int32} n - Number of rounds
     * @returns {void}
     */
    _applySipRounds(n) {
      for (let i = 0; i < n; i++) {
        this._sipRound();
      }
    }

    /**
     * Single SipRound permutation
     * Based on ARX (Add-Rotate-XOR) operations
     * @returns {void}
     */
    _sipRound() {
      // v0 += v1; v1 = ROTL(v1, 13); v1 ^= v0; v0 = ROTL(v0, 32)
      this.v0 = this._add64(this.v0, this.v1);
      this.v1 = this._rotl64(this.v1, 13);
      this.v1 = this._xor64(this.v1, this.v0);
      this.v0 = this._rotl64(this.v0, 32);

      // v2 += v3; v3 = ROTL(v3, 16); v3 ^= v2
      this.v2 = this._add64(this.v2, this.v3);
      this.v3 = this._rotl64(this.v3, 16);
      this.v3 = this._xor64(this.v3, this.v2);

      // v0 += v3; v3 = ROTL(v3, 21); v3 ^= v0
      this.v0 = this._add64(this.v0, this.v3);
      this.v3 = this._rotl64(this.v3, 21);
      this.v3 = this._xor64(this.v3, this.v0);

      // v2 += v1; v1 = ROTL(v1, 17); v1 ^= v2; v2 = ROTL(v2, 32)
      this.v2 = this._add64(this.v2, this.v1);
      this.v1 = this._rotl64(this.v1, 17);
      this.v1 = this._xor64(this.v1, this.v2);
      this.v2 = this._rotl64(this.v2, 32);
    }

    /**
     * 64-bit addition using 32-bit arithmetic
     * @param {uint32[]} a - [low32, high32]
     * @param {uint32[]} b - [low32, high32]
     * @returns {uint32[]} (a + b) mod 2^64 as [low32, high32]
     */
    _add64(a, b) {
      const low = OpCodes.Add32(a[0], b[0]);
      const carry = (low < a[0]) ? 1 : 0;
      const high = OpCodes.Add32(OpCodes.Add32(a[1], b[1]), carry);
      return this._word64(low, high);
    }

    /**
     * A 64-bit word from its halves
     * @param {uint32} low - Bits 0..31
     * @param {uint32} high - Bits 32..63
     * @returns {uint32[]} [low32, high32]
     */
    _word64(low, high) {
      /** @type {uint32[]} */
      const word = [low, high];
      return word;
    }

    /**
     * 64-bit XOR operation
     * @param {uint32[]} a - [low32, high32]
     * @param {uint32[]} b - [low32, high32]
     * @returns {uint32[]} a xor b as [low32, high32]
     */
    _xor64(a, b) {
      return this._word64(OpCodes.Xor32(a[0], b[0]), OpCodes.Xor32(a[1], b[1]));
    }

    /**
     * 64-bit OR operation
     * @param {uint32[]} a - [low32, high32]
     * @param {uint32[]} b - [low32, high32]
     * @returns {uint32[]} a or b as [low32, high32]
     */
    _or64(a, b) {
      return this._word64(OpCodes.Or32(a[0], b[0]), OpCodes.Or32(a[1], b[1]));
    }

    /**
     * 64-bit right shift (logical)
     * @param {uint32[]} val - [low32, high32]
     * @param {int32} positions - Shift (negative shifts left)
     * @returns {uint32[]} Shifted value (val itself for a zero shift)
     */
    _shr64(val, positions) {
      if (positions === 0) return val;

      // Handle negative positions as left shift (for -bits in Java)
      if (positions < 0) return this._shl64(val, -positions);

      const low = val[0];
      const high = val[1];
      positions = positions % 64;

      if (positions === 0) return this._word64(low, high);
      if (positions >= 32) {
        const newLow = OpCodes.Shr32(high, (positions - 32));
        return this._word64(newLow, 0);
      } else {
        const newLow = OpCodes.Or32(OpCodes.Shr32(low, positions), OpCodes.Shl32(high, (32 - positions)));
        const newHigh = OpCodes.Shr32(high, positions);
        return this._word64(newLow, newHigh);
      }
    }

    /**
     * 64-bit left shift
     * @param {uint32[]} val - [low32, high32]
     * @param {int32} positions - Shift
     * @returns {uint32[]} Shifted value (val itself for a zero shift)
     */
    _shl64(val, positions) {
      if (positions === 0) return val;

      const low = val[0];
      const high = val[1];
      positions = positions % 64;

      if (positions === 0) return this._word64(low, high);
      if (positions >= 32) {
        const newHigh = OpCodes.Shl32(low, (positions - 32));
        return this._word64(0, newHigh);
      } else {
        const newHigh = OpCodes.Or32(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, (32 - positions)));
        const newLow = OpCodes.Shl32(low, positions);
        return this._word64(newLow, newHigh);
      }
    }

    /**
     * 64-bit left rotation
     * Uses 32-bit operations for cross-platform compatibility
     * Value is stored as [low32, high32] representing bits 0-31 and 32-63
     * @param {uint32[]} val - [low32, high32]
     * @param {int32} positions - Rotation
     * @returns {uint32[]} Rotated value
     */
    _rotl64(val, positions) {
      const low = val[0];
      const high = val[1];
      positions = positions % 64;

      if (positions === 0) return this._word64(low, high);
      if (positions === 32) return this._word64(high, low);

      if (positions < 32) {
        // Rotate left within 64-bit word
        // New low bits = old low << n|old high >> (32-n)
        // New high bits = old high << n|old low >> (32-n)
        const newLow = OpCodes.Or32(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, (32 - positions)));
        const newHigh = OpCodes.Or32(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, (32 - positions)));
        return this._word64(newLow, newHigh);
      } else {
        // Rotate more than 32 bits = swap + rotate remainder
        positions -= 32;
        const newLow = OpCodes.Or32(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, (32 - positions)));
        const newHigh = OpCodes.Or32(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, (32 - positions)));
        return this._word64(newLow, newHigh);
      }
    }

    /**
     * Convert bytes to 64-bit little-endian word
     * @param {uint8[]} bytes - Source bytes
     * @param {int32} offset - Index of the first byte
     * @returns {uint32[]} [low32, high32]; bytes past the end count as 0
     */
    _bytesToWord64LE(bytes, offset) {
      const low = OpCodes.Pack32LE(
        this._byteAt(bytes, offset), this._byteAt(bytes, offset + 1),
        this._byteAt(bytes, offset + 2), this._byteAt(bytes, offset + 3)
      );
      const high = OpCodes.Pack32LE(
        this._byteAt(bytes, offset + 4), this._byteAt(bytes, offset + 5),
        this._byteAt(bytes, offset + 6), this._byteAt(bytes, offset + 7)
      );
      return this._word64(low, high);
    }

    /**
     * One byte, or 0 where there is none (the old bytes[i] || 0)
     * @param {uint8[]} bytes - Source bytes
     * @param {int32} index - Byte index
     * @returns {uint8} The byte, or 0
     */
    _byteAt(bytes, index) {
      const b = bytes[index];
      if (!b) return 0;
      return b;
    }

    /**
     * Convert 64-bit word to bytes (little-endian)
     * @param {uint32[]} word - [low32, high32]
     * @returns {uint8[]} 8 bytes, little-endian
     */
    _word64ToBytes(word) {
      /** @type {uint8[]} */
      const bytes = new Array(8);
      const lowBytes = OpCodes.Unpack32LE(word[0]);
      const highBytes = OpCodes.Unpack32LE(word[1]);

      for (let i = 0; i < 4; i++) {
        bytes[i] = lowBytes[i];
        bytes[i + 4] = highBytes[i];
      }

      return bytes;
    }
  }

  // Register algorithm with framework
  RegisterAlgorithm(new SipHash128Algorithm());

  return SipHash128Algorithm;
}));
