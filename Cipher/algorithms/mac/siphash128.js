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
      this.SupportedOutputSizes = [16]; // Fixed 16-byte (128-bit) output

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

    CreateInstance(isInverse = false) {
      return new SipHash128Instance(this, isInverse);
    }
  }

  /**
   * SipHash-128 Instance Implementation
   * Implements Feed/Result pattern for MAC computation
   */
  class SipHash128Instance extends IMacInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;

      // SipHash parameters (c compression rounds, d finalization rounds)
      this._cRounds = 2; // Default: 2 compression rounds
      this._dRounds = 4; // Default: 4 finalization rounds

      // Internal state
      this._key = null;
      this.inputBuffer = [];

      // State variables (64-bit values represented as [low32, high32])
      this.v0 = [0, 0];
      this.v1 = [0, 0];
      this.v2 = [0, 0];
      this.v3 = [0, 0];

      // Message word accumulator
      this.m = [0, 0];
      this.wordPos = 0;
      this.wordCount = 0;
    }

    // Property: key (128-bit / 16 bytes)
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

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property: cRounds (compression rounds)
    set cRounds(rounds) {
      if (rounds < 1 || rounds > 16) {
        throw new Error("Invalid cRounds: " + rounds + ". Must be between 1 and 16.");
      }
      this._cRounds = rounds;
    }

    get cRounds() {
      return this._cRounds;
    }

    // Property: dRounds (finalization rounds)
    set dRounds(rounds) {
      if (rounds < 1 || rounds > 16) {
        throw new Error("Invalid dRounds: " + rounds + ". Must be between 1 and 16.");
      }
      this._dRounds = rounds;
    }

    get dRounds() {
      return this._dRounds;
    }

    /**
     * Initialize SipHash state with key
     * State initialized with key XOR'd with constants
     */
    _initializeState() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Extract two 64-bit keys from 16-byte key (little-endian)
      const k0 = this._bytesToWord64LE(this._key, 0);
      const k1 = this._bytesToWord64LE(this._key, 8);

      // Initialize state: v0 = k0 XOR 0x736f6d6570736575
      this.v0 = this._xor64(k0, [0x70736575, 0x736f6d65]);
      // v1 = k1 XOR 0x646f72616e646f6d
      this.v1 = this._xor64(k1, [0x6e646f6d, 0x646f7261]);
      // v2 = k0 XOR 0x6c7967656e657261
      this.v2 = this._xor64(k0, [0x6e657261, 0x6c796765]);
      // v3 = k1 XOR 0x7465646279746573
      this.v3 = this._xor64(k1, [0x79746573, 0x74656462]);

      // For SipHash-128, XOR v1 with 0xee during initialization
      this.v1 = this._xor64(this.v1, [0xee, 0]);

      // Reset message processing state
      this.m = [0, 0];
      this.wordPos = 0;
      this.wordCount = 0;
    }

    /**
     * Feed data to MAC computation
     * Accumulates input bytes for processing
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
     * Compute final MAC result
     * Returns 128-bit (16-byte) MAC tag
     */
    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Process accumulated input
      const message = this.inputBuffer;
      const messageLen = message.length;
      let offset = 0;

      // Process complete 8-byte blocks
      while (offset + 8 <= messageLen) {
        const m = this._bytesToWord64LE(message, offset);
        this._processMessageWord(m);
        offset += 8;
      }

      // Process final partial block with padding
      this._processFinalBlock(message, offset, messageLen);

      // Compute first 64-bit half of MAC
      this.v2 = this._xor64(this.v2, [0xee, 0]); // First finalization XOR (0xee)
      this._applySipRounds(this.dRounds);
      const r0 = this._xor64(this._xor64(this.v0, this.v1), this._xor64(this.v2, this.v3));

      // Compute second 64-bit half of MAC
      this.v1 = this._xor64(this.v1, [0xdd, 0]); // Second finalization XOR (0xdd)
      this._applySipRounds(this.dRounds);
      const r1 = this._xor64(this._xor64(this.v0, this.v1), this._xor64(this.v2, this.v3));

      // Convert to bytes (little-endian) and concatenate
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
     * Process final message block with padding
     * Following BouncyCastle implementation logic
     */
    _processFinalBlock(message, offset, messageLen) {
      const remaining = messageLen - offset;

      // Build final 64-bit word with padding
      // Start with accumulated partial word from m (if any)
      let finalWord = [...this.m];

      // Add remaining bytes to the word
      for (let i = 0; i < remaining; i++) {
        const b = message[offset + i] & 0xFF;
        const pos = this.wordPos + i;

        if (pos < 4) {
          finalWord[0] |= (b << (pos * 8));
        } else {
          finalWord[1] |= (b << ((pos - 4) * 8));
        }
      }

      // Pad with message length in byte position 7 (bits 56-63)
      // Java: m |= (((wordCount << 3) + wordPos) & 0xffL) << 56
      // This puts the total message length in bytes in the last byte
      const totalBytes = messageLen & 0xFF;
      finalWord[1] |= (totalBytes << 24); // Byte 7 is at bits 56-63 (high[24-31])

      this._processMessageWord(finalWord);
    }

    /**
     * Process single 64-bit message word
     * Applies c rounds of SipRound with message mixing
     */
    _processMessageWord(m) {
      this.wordCount++;

      // v3 ^= m
      this.v3 = this._xor64(this.v3, m);

      // Apply c rounds
      this._applySipRounds(this.cRounds);

      // v0 ^= m
      this.v0 = this._xor64(this.v0, m);
    }

    /**
     * Apply n rounds of SipRound function
     * SipRound is the core permutation of SipHash
     */
    _applySipRounds(n) {
      for (let i = 0; i < n; i++) {
        this._sipRound();
      }
    }

    /**
     * Single SipRound permutation
     * Based on ARX (Add-Rotate-XOR) operations
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
     * Returns [low32, high32]
     */
    _add64(a, b) {
      const low = (a[0] + b[0]) >>> 0;
      const carry = (low < a[0]) ? 1 : 0;
      const high = (a[1] + b[1] + carry) >>> 0;
      return [low, high];
    }

    /**
     * 64-bit XOR operation
     * Returns [low32, high32]
     */
    _xor64(a, b) {
      return [a[0] ^ b[0], a[1] ^ b[1]];
    }

    /**
     * 64-bit left rotation
     * Uses 32-bit operations for cross-platform compatibility
     */
    _rotl64(val, positions) {
      const low = val[0];
      const high = val[1];
      positions = positions % 64;

      if (positions === 0) return [low, high];
      if (positions === 32) return [high, low];

      if (positions < 32) {
        const newHigh = ((high << positions) | (low >>> (32 - positions))) >>> 0;
        const newLow = ((low << positions) | (high >>> (32 - positions))) >>> 0;
        return [newLow, newHigh];
      } else {
        positions -= 32;
        const newHigh = ((low << positions) | (high >>> (32 - positions))) >>> 0;
        const newLow = ((high << positions) | (low >>> (32 - positions))) >>> 0;
        return [newLow, newHigh];
      }
    }

    /**
     * Convert bytes to 64-bit little-endian word
     * Returns [low32, high32]
     */
    _bytesToWord64LE(bytes, offset) {
      const low = OpCodes.Pack32LE(
        bytes[offset] || 0, bytes[offset + 1] || 0,
        bytes[offset + 2] || 0, bytes[offset + 3] || 0
      );
      const high = OpCodes.Pack32LE(
        bytes[offset + 4] || 0, bytes[offset + 5] || 0,
        bytes[offset + 6] || 0, bytes[offset + 7] || 0
      );
      return [low, high];
    }

    /**
     * Convert 64-bit word to bytes (little-endian)
     * Returns 8-byte array
     */
    _word64ToBytes(word) {
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
