/*
 * KNOT-AEAD Family - NIST Lightweight Cryptography Finalists
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * This file implements two KNOT-AEAD variants:
 * - KNOT-AEAD-128-256: 256-bit state, 64-bit rate (8 bytes)
 * - KNOT-AEAD-128-384: 384-bit state, 192-bit rate (24 bytes)
 *
 * KNOT-AEAD algorithms are authenticated encryption schemes based on the
 * KNOT permutation family. They use sponge construction with bit-sliced
 * S-box and linear diffusion optimized for hardware efficiency.
 *
 * Common Features:
 * - 128-bit key, 128-bit nonce
 * - 128-bit authentication tag
 * - Bit-sliced 4-bit S-box
 * - Linear diffusion with row rotations
 * - NIST LWC finalists
 *
 * References:
 * - https://csrc.nist.gov/Projects/lightweight-cryptography
 * - KNOT specification in NIST LWC Round 3 submissions
 * - Reference implementation: lightweight-crypto library by Southern Storm Software
 *
 * This implementation is for educational purposes only.
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== SHARED KNOT PERMUTATION UTILITIES =====

  // Round constants for KNOT-256 permutation (6-bit LFSR)
  const RC6 = [
    0x01, 0x02, 0x04, 0x08, 0x10, 0x21, 0x03, 0x06, 0x0c, 0x18, 0x31, 0x22,
    0x05, 0x0a, 0x14, 0x29, 0x13, 0x27, 0x0f, 0x1e, 0x3d, 0x3a, 0x34, 0x28,
    0x11, 0x23, 0x07, 0x0e, 0x1c, 0x39, 0x32, 0x24, 0x09, 0x12, 0x25, 0x0b,
    0x16, 0x2d, 0x1b, 0x37, 0x2e, 0x1d, 0x3b, 0x36, 0x2c, 0x19, 0x33, 0x26,
    0x0d, 0x1a, 0x35, 0x2a
  ];

  // Round constants for KNOT-384 permutation (7-bit LFSR)
  const RC7 = [
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x41, 0x03, 0x06, 0x0c, 0x18, 0x30,
    0x61, 0x42, 0x05, 0x0a, 0x14, 0x28, 0x51, 0x23, 0x47, 0x0f, 0x1e, 0x3c,
    0x79, 0x72, 0x64, 0x48, 0x11, 0x22, 0x45, 0x0b, 0x16, 0x2c, 0x59, 0x33,
    0x67, 0x4e, 0x1d, 0x3a, 0x75, 0x6a, 0x54, 0x29, 0x53, 0x27, 0x4f, 0x1f,
    0x3e, 0x7d, 0x7a, 0x74, 0x68, 0x50, 0x21, 0x43, 0x07, 0x0e, 0x1c, 0x38,
    0x71, 0x62, 0x44, 0x09, 0x12, 0x24, 0x49, 0x13, 0x26, 0x4d, 0x1b, 0x36,
    0x6d, 0x5a, 0x35, 0x6b, 0x56, 0x2d, 0x5b, 0x37, 0x6f, 0x5e, 0x3d, 0x7b,
    0x76, 0x6c, 0x58, 0x31, 0x63, 0x46, 0x0d, 0x1a, 0x34, 0x69, 0x52, 0x25,
    0x4b, 0x17, 0x2e, 0x5d, 0x3b, 0x77, 0x6e, 0x5c
  ];

  /**
   * KNOT S-box applied in bit-sliced mode to four 64-bit words (as byte arrays)
   * This is a 4-bit S-box applied in parallel across all bit positions
   * Working with 8-byte arrays to avoid JavaScript 64-bit limitations
   *
   * @param {Array} a0 - First input word as 8-byte array (little-endian)
   * @param {Array} a1 - Second input word as 8-byte array
   * @param {Array} a2 - Third input word as 8-byte array
   * @param {Array} a3 - Fourth input word as 8-byte array
   * @returns {Object} {a0, b1, b2, b3} - Four transformed 8-byte arrays
   */
  function knotSbox64(a0, a1, a2, a3) {
    const result = {
      a0: new Array(8),
      b1: new Array(8),
      b2: new Array(8),
      b3: new Array(8)
    };

    // Process each byte independently (bit-sliced operation)
    for (let i = 0; i < 8; ++i) {
      const a0b = a0[i] & 0xFF;
      const a1b = a1[i] & 0xFF;
      const a2b = a2[i] & 0xFF;
      const a3b = a3[i] & 0xFF;

      // Apply KNOT S-box
      let t1 = (~a0b) & 0xFF;
      let t3 = (a2b ^ (a1b & t1)) & 0xFF;
      const b3 = (a3b ^ t3) & 0xFF;
      const t6 = (a3b ^ t1) & 0xFF;
      const b2 = ((a1b | a2b) ^ t6) & 0xFF;
      t1 = (a1b ^ a3b) & 0xFF;
      const a0_out = (t1 ^ (t3 & t6)) & 0xFF;
      const b1 = (t3 ^ (b2 & t1)) & 0xFF;

      result.a0[i] = a0_out;
      result.b1[i] = b1;
      result.b2[i] = b2;
      result.b3[i] = b3;
    }

    return result;
  }

  /**
   * KNOT S-box applied in bit-sliced mode to four 32-bit words (as 4-byte arrays)
   * @param {Array} a0 - First input word as 4-byte array (little-endian)
   * @param {Array} a1 - Second input word as 4-byte array
   * @param {Array} a2 - Third input word as 4-byte array
   * @param {Array} a3 - Fourth input word as 4-byte array
   * @returns {Object} {a0, b1, b2, b3} - Four transformed 4-byte arrays
   */
  function knotSbox32(a0, a1, a2, a3) {
    const result = {
      a0: new Array(4),
      b1: new Array(4),
      b2: new Array(4),
      b3: new Array(4)
    };

    // Process each byte independently (bit-sliced operation)
    for (let i = 0; i < 4; ++i) {
      const a0b = a0[i] & 0xFF;
      const a1b = a1[i] & 0xFF;
      const a2b = a2[i] & 0xFF;
      const a3b = a3[i] & 0xFF;

      // Apply KNOT S-box
      let t1 = (~a0b) & 0xFF;
      let t3 = (a2b ^ (a1b & t1)) & 0xFF;
      const b3 = (a3b ^ t3) & 0xFF;
      const t6 = (a3b ^ t1) & 0xFF;
      const b2 = ((a1b | a2b) ^ t6) & 0xFF;
      t1 = (a1b ^ a3b) & 0xFF;
      const a0_out = (t1 ^ (t3 & t6)) & 0xFF;
      const b1 = (t3 ^ (b2 & t1)) & 0xFF;

      result.a0[i] = a0_out;
      result.b1[i] = b1;
      result.b2[i] = b2;
      result.b3[i] = b3;
    }

    return result;
  }

  /**
   * Left rotate 64-bit value (as 8-byte array, little-endian)
   * @param {Array} bytes - 8-byte array representing 64-bit value
   * @param {number} positions - Rotation amount (0-63)
   * @returns {Array} Rotated 8-byte array
   */
  function rotL64(bytes, positions) {
    if (positions === 0) return [...bytes];

    positions = positions & 63;
    const result = new Array(8);

    // Calculate byte shift and bit shift
    const byteShift = Math.floor(positions / 8);
    const bitShift = positions % 8;

    if (bitShift === 0) {
      // Simple byte rotation
      for (let i = 0; i < 8; ++i) {
        result[i] = bytes[(i - byteShift + 8) & 7];
      }
    } else {
      // Bit rotation with carry
      const rightShift = 8 - bitShift;
      for (let i = 0; i < 8; ++i) {
        const srcIdx1 = (i - byteShift + 8) & 7;
        const srcIdx2 = (i - byteShift - 1 + 8) & 7;
        result[i] = (((bytes[srcIdx1] << bitShift) | (bytes[srcIdx2] >>> rightShift)) & 0xFF);
      }
    }

    return result;
  }

  /**
   * Left rotate 32-bit value (as 4-byte array, little-endian)
   * @param {Array} bytes - 4-byte array representing 32-bit value
   * @param {number} positions - Rotation amount (0-31)
   * @returns {Array} Rotated 4-byte array
   */
  function rotL32(bytes, positions) {
    if (positions === 0) return [...bytes];

    positions = positions & 31;
    const result = new Array(4);

    // Calculate byte shift and bit shift
    const byteShift = Math.floor(positions / 8);
    const bitShift = positions % 8;

    if (bitShift === 0) {
      // Simple byte rotation
      for (let i = 0; i < 4; ++i) {
        result[i] = bytes[(i - byteShift + 4) & 3];
      }
    } else {
      // Bit rotation with carry
      const rightShift = 8 - bitShift;
      for (let i = 0; i < 4; ++i) {
        const srcIdx1 = (i - byteShift + 4) & 3;
        const srcIdx2 = (i - byteShift - 1 + 4) & 3;
        result[i] = (((bytes[srcIdx1] << bitShift) | (bytes[srcIdx2] >>> rightShift)) & 0xFF);
      }
    }

    return result;
  }

  /**
   * Left rotate 96-bit value (represented as 64-bit low + 32-bit high)
   * Used for KNOT-384 permutation
   *
   * @param {Array} low64bytes - 8-byte array (low 64 bits, little-endian)
   * @param {Array} high32bytes - 4-byte array (high 32 bits, little-endian)
   * @param {number} bits - Rotation amount (0-95)
   * @returns {Object} {low64, high32} - Rotated byte arrays
   */
  function rotL96(low64bytes, high32bytes, bits) {
    if (bits === 0) {
      return { low64: [...low64bytes], high32: [...high32bytes] };
    }

    // Use BigInt for exact 96-bit arithmetic
    let value = 0n;
    for (let i = 0; i < 8; ++i) {
      value |= BigInt(low64bytes[i] & 0xFF) << BigInt(i * 8);
    }
    for (let i = 0; i < 4; ++i) {
      value |= BigInt(high32bytes[i] & 0xFF) << BigInt(64 + i * 8);
    }

    // Rotate
    const mask96 = (1n << 96n) - 1n;
    const rotated = ((value << BigInt(bits)) | (value >> BigInt(96 - bits))) & mask96;

    // Split back
    const low64 = new Array(8);
    const high32 = new Array(4);
    for (let i = 0; i < 8; ++i) {
      low64[i] = Number((rotated >> BigInt(i * 8)) & 0xFFn);
    }
    for (let i = 0; i < 4; ++i) {
      high32[i] = Number((rotated >> BigInt(64 + i * 8)) & 0xFFn);
    }

    return { low64, high32 };
  }

  // ===== KNOT-256 PERMUTATION =====

  /**
   * KNOT-256 permutation (used by KNOT-AEAD-128-256)
   * @param {Uint8Array} state - 32-byte state (modified in place)
   * @param {number} rounds - Number of rounds to perform
   */
  function knot256Permute(state, rounds) {
    // Load state as 4 x 8-byte arrays (little-endian)
    let x0 = Array.from(state.slice(0, 8));
    let x1 = Array.from(state.slice(8, 16));
    let x2 = Array.from(state.slice(16, 24));
    let x3 = Array.from(state.slice(24, 32));

    // Perform permutation rounds
    for (let i = 0; i < rounds; ++i) {
      // Add round constant to first word (low byte)
      x0[0] = (x0[0] ^ RC6[i]) & 0xFF;

      // S-box layer
      const sboxOut = knotSbox64(x0, x1, x2, x3);
      x0 = sboxOut.a0;
      const b1 = sboxOut.b1;
      const b2 = sboxOut.b2;
      const b3 = sboxOut.b3;

      // Linear diffusion layer (row rotations)
      x1 = rotL64(b1, 1);
      x2 = rotL64(b2, 8);
      x3 = rotL64(b3, 25);
    }

    // Store state back
    for (let i = 0; i < 8; ++i) {
      state[i] = x0[i];
      state[8 + i] = x1[i];
      state[16 + i] = x2[i];
      state[24 + i] = x3[i];
    }
  }

  // ===== KNOT-384 PERMUTATION =====

  /**
   * KNOT-384 permutation (used by KNOT-AEAD-128-384)
   * State is 48 bytes: 4 rows of 96 bits each
   * - Row 0: bytes 0-11 (x0=64bit + x1=32bit)
   * - Row 1: bytes 12-23 (x2=64bit + x3=32bit)
   * - Row 2: bytes 24-35 (x4=64bit + x5=32bit)
   * - Row 3: bytes 36-47 (x6=64bit + x7=32bit)
   *
   * @param {Uint8Array} state - 48-byte state (modified in place)
   * @param {number} rounds - Number of rounds to perform
   */
  function knot384Permute(state, rounds) {
    // Load state as 4 rows of 96 bits each (8+4 bytes per row)
    let x0 = Array.from(state.slice(0, 8));    // 64-bit
    let x1 = Array.from(state.slice(8, 12));   // 32-bit
    let x2 = Array.from(state.slice(12, 20));  // 64-bit
    let x3 = Array.from(state.slice(20, 24));  // 32-bit
    let x4 = Array.from(state.slice(24, 32));  // 64-bit
    let x5 = Array.from(state.slice(32, 36));  // 32-bit
    let x6 = Array.from(state.slice(36, 44));  // 64-bit
    let x7 = Array.from(state.slice(44, 48));  // 32-bit

    // Perform permutation rounds
    for (let i = 0; i < rounds; ++i) {
      // Add round constant to first word (low byte)
      x0[0] = (x0[0] ^ RC7[i]) & 0xFF;

      // S-box layer (bit-sliced on 64-bit and 32-bit parts separately)
      const sbox64Out = knotSbox64(x0, x2, x4, x6);
      x0 = sbox64Out.a0;
      const b2 = sbox64Out.b1;
      const b4 = sbox64Out.b2;
      const b6 = sbox64Out.b3;

      const sbox32Out = knotSbox32(x1, x3, x5, x7);
      x1 = sbox32Out.a0;
      const b3 = sbox32Out.b1;
      const b5 = sbox32Out.b2;
      const b7 = sbox32Out.b3;

      // Linear diffusion layer (row rotations)
      // Row 1: rotate by 1 bit
      const rot1 = rotL96(b2, b3, 1);
      x2 = rot1.low64;
      x3 = rot1.high32;

      // Row 2: rotate by 8 bits
      const rot8 = rotL96(b4, b5, 8);
      x4 = rot8.low64;
      x5 = rot8.high32;

      // Row 3: rotate by 55 bits
      const rot55 = rotL96(b6, b7, 55);
      x6 = rot55.low64;
      x7 = rot55.high32;
    }

    // Store state back
    for (let i = 0; i < 8; ++i) state[i] = x0[i];
    for (let i = 0; i < 4; ++i) state[8 + i] = x1[i];
    for (let i = 0; i < 8; ++i) state[12 + i] = x2[i];
    for (let i = 0; i < 4; ++i) state[20 + i] = x3[i];
    for (let i = 0; i < 8; ++i) state[24 + i] = x4[i];
    for (let i = 0; i < 4; ++i) state[32 + i] = x5[i];
    for (let i = 0; i < 8; ++i) state[36 + i] = x6[i];
    for (let i = 0; i < 4; ++i) state[44 + i] = x7[i];
  }

  // ===== KNOT-AEAD-128-256 ALGORITHM =====

  class KnotAead128256Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "KNOT-AEAD-128-256";
      this.description = "NIST Lightweight Cryptography finalist using 256-bit sponge construction with bit-sliced KNOT permutation. Features hardware-efficient S-box design and simple linear diffusion for resource-constrained environments.";
      this.inventor = "Designers from Nanyang Technological University";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.SG;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST LWC Project", "https://csrc.nist.gov/Projects/lightweight-cryptography"),
        new LinkItem("KNOT Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Official test vectors from NIST LWC KAT file (KNOT-AEAD-128-256.txt)
      this.tests = [
        {
          text: "NIST LWC KAT Vector #1: Empty PT/AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("460779BA8E7AE47C69230E79D8684881")
        },
        {
          text: "NIST LWC KAT Vector #2: Empty PT with 1-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("F140DD9677E88D6594B7EB3B02FA2981")
        },
        {
          text: "NIST LWC KAT Vector #5: Empty PT with 4-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00010203"),
          input: [],
          expected: OpCodes.Hex8ToBytes("527311869AD8FA60712C1D455A6F377C")
        },
        {
          text: "NIST LWC KAT Vector #9: Empty PT with 8-byte AD (rate boundary)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("0001020304050607"),
          input: [],
          expected: OpCodes.Hex8ToBytes("373A4FD111779EA4EACCB63378F22948")
        },
        {
          text: "NIST LWC KAT Vector #17: Empty PT with 16-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: [],
          expected: OpCodes.Hex8ToBytes("19F3524ED58284638ACDF3DA761DD3D5")
        },
        {
          text: "NIST LWC KAT Vector #34: 1-byte PT with empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("E93B487DDE39FDFFE7FB011C639B307A5D")
        },
        {
          text: "NIST LWC KAT Vector #340: 10-byte PT with 8-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708"),
          input: OpCodes.Hex8ToBytes("00010203040506070809"),
          expected: OpCodes.Hex8ToBytes("34F50C813FB6679E88679B8581958DA336EA1087C243541AA8DA")
        },
        {
          text: "NIST LWC KAT Vector #347: 10-byte PT with 16-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00010203040506070809"),
          expected: OpCodes.Hex8ToBytes("B37A7263E721ACE03DAC24447F66BED7C87D5C964F19E2F3F5E7")
        }
      ];

      // Constants
      this.KEY_SIZE = 16;      // 128 bits
      this.NONCE_SIZE = 16;    // 128 bits
      this.TAG_SIZE = 16;      // 128 bits
      this.RATE = 8;           // 64 bits (8 bytes)
      this.STATE_SIZE = 32;    // 256 bits (32 bytes)
      this.INIT_ROUNDS = 52;
      this.PROCESS_ROUNDS = 28;
      this.FINAL_ROUNDS = 32;
    }

    CreateInstance(isInverse = false) {
      return new KnotAead128256Instance(this, isInverse);
    }
  }

  class KnotAead128256Instance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._associatedData = [];
      this.inputBuffer = [];
      this.initialized = false;
    }

    // Property: key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error(`KNOT-AEAD-128-256 key must be 16 bytes long, got ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property: nonce
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(nonceBytes)) {
        throw new Error("Invalid nonce - must be byte array");
      }

      if (nonceBytes.length !== 16) {
        throw new Error(`KNOT-AEAD-128-256 requires exactly 16 bytes of nonce, got ${nonceBytes.length} bytes`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Property: associatedData
    set associatedData(adBytes) {
      if (!adBytes) {
        this._associatedData = [];
        return;
      }

      if (!Array.isArray(adBytes)) {
        throw new Error("Invalid associated data - must be byte array");
      }

      this._associatedData = [...adBytes];
    }

    get associatedData() {
      return [...this._associatedData];
    }

    // Initialize state with nonce and key
    _initialize() {
      if (!this._key || !this._nonce) {
        throw new Error("Key and nonce must be set before initialization");
      }

      // Create state: nonce (16 bytes) || key (16 bytes)
      this.state = new Uint8Array(32);
      for (let i = 0; i < 16; ++i) {
        this.state[i] = this._nonce[i];
      }
      for (let i = 0; i < 16; ++i) {
        this.state[16 + i] = this._key[i];
      }

      // Initial permutation
      knot256Permute(this.state, this.algorithm.INIT_ROUNDS);

      this.initialized = true;
    }

    // Absorb associated data
    _absorbAD() {
      const ad = this._associatedData;
      const rate = this.algorithm.RATE;
      let offset = 0;

      if (ad.length === 0) {
        // Empty AD: apply domain separation only
        this.state[31] ^= 0x80;
        return;
      }

      // Process full blocks
      while (offset + rate <= ad.length) {
        for (let i = 0; i < rate; ++i) {
          this.state[i] ^= ad[offset + i];
        }
        knot256Permute(this.state, this.algorithm.PROCESS_ROUNDS);
        offset += rate;
      }

      // Process final partial block
      const remaining = ad.length - offset;
      if (remaining > 0) {
        for (let i = 0; i < remaining; ++i) {
          this.state[i] ^= ad[offset + i];
        }
      }

      // Padding: XOR 0x01 at end of data
      this.state[remaining] ^= 0x01;
      knot256Permute(this.state, this.algorithm.PROCESS_ROUNDS);

      // Domain separation
      this.state[31] ^= 0x80;
    }

    // Encrypt plaintext
    _encrypt(plaintext) {
      const ciphertext = [];
      const rate = this.algorithm.RATE;
      let offset = 0;

      // Process full blocks
      while (offset + rate <= plaintext.length) {
        for (let i = 0; i < rate; ++i) {
          ciphertext.push(this.state[i] ^ plaintext[offset + i]);
          this.state[i] = ciphertext[ciphertext.length - 1];
        }
        knot256Permute(this.state, this.algorithm.PROCESS_ROUNDS);
        offset += rate;
      }

      // Process final partial block
      const remaining = plaintext.length - offset;
      if (remaining > 0) {
        for (let i = 0; i < remaining; ++i) {
          ciphertext.push(this.state[i] ^ plaintext[offset + i]);
          this.state[i] = ciphertext[ciphertext.length - 1];
        }
        // Padding
        this.state[remaining] ^= 0x01;
      }

      return ciphertext;
    }

    // Decrypt ciphertext
    _decrypt(ciphertext) {
      const plaintext = [];
      const rate = this.algorithm.RATE;
      let offset = 0;

      // Process full blocks
      while (offset + rate <= ciphertext.length) {
        for (let i = 0; i < rate; ++i) {
          const ct = ciphertext[offset + i];
          plaintext.push(this.state[i] ^ ct);
          this.state[i] = ct;
        }
        knot256Permute(this.state, this.algorithm.PROCESS_ROUNDS);
        offset += rate;
      }

      // Process final partial block
      const remaining = ciphertext.length - offset;
      if (remaining > 0) {
        for (let i = 0; i < remaining; ++i) {
          const ct = ciphertext[offset + i];
          plaintext.push(this.state[i] ^ ct);
          this.state[i] = ct;
        }
        // Padding
        this.state[remaining] ^= 0x01;
      }

      return plaintext;
    }

    // Compute authentication tag
    _computeTag() {
      knot256Permute(this.state, this.algorithm.FINAL_ROUNDS);

      // Extract first 16 bytes as tag
      const tag = [];
      for (let i = 0; i < 16; ++i) {
        tag.push(this.state[i]);
      }
      return tag;
    }

    // Feed/Result pattern
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      // Initialize state
      this._initialize();

      // Process associated data
      this._absorbAD();

      const result = [];

      if (this.isInverse) {
        // Decryption mode: input is ciphertext + tag
        if (this.inputBuffer.length < 16) {
          throw new Error("Ciphertext must include 16-byte authentication tag");
        }

        const ctLen = this.inputBuffer.length - 16;
        const ciphertext = this.inputBuffer.slice(0, ctLen);
        const receivedTag = this.inputBuffer.slice(ctLen);

        // Decrypt
        const plaintext = ctLen > 0 ? this._decrypt(ciphertext) : [];

        // Compute tag
        const computedTag = this._computeTag();

        // Verify tag (constant-time comparison)
        if (!OpCodes.ConstantTimeCompare(computedTag, receivedTag)) {
          throw new Error("Authentication tag verification failed");
        }

        result.push(...plaintext);
      } else {
        // Encryption mode: input is plaintext
        const plaintext = this.inputBuffer;

        // Encrypt
        const ciphertext = plaintext.length > 0 ? this._encrypt(plaintext) : [];

        // Compute tag
        const tag = this._computeTag();

        // Return ciphertext || tag
        result.push(...ciphertext, ...tag);
      }

      // Clear buffers
      this.inputBuffer = [];
      OpCodes.ClearArray(this.state);
      this.initialized = false;

      return result;
    }
  }

  // ===== KNOT-AEAD-128-384 ALGORITHM =====

  class KnotAead128384Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "KNOT-AEAD-128-384";
      this.description = "NIST Lightweight Cryptography finalist using 384-bit sponge construction with bit-sliced KNOT permutation. Offers higher throughput than KNOT-128-256 with a 192-bit rate, ideal for constrained environments requiring performance.";
      this.inventor = "Designers from Nanyang Technological University";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.SG;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST LWC Project", "https://csrc.nist.gov/Projects/lightweight-cryptography"),
        new LinkItem("KNOT Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Official test vectors from NIST LWC KAT file (KNOT-AEAD-128-384.txt)
      this.tests = [
        {
          text: "NIST LWC KAT Vector #1: Empty PT/AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("DF323CE70693FAB9266458ADF3ED3D3F")
        },
        {
          text: "NIST LWC KAT Vector #2: Empty PT with 1-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("6A1315D028A57BE50A1E0106297175F9")
        },
        {
          text: "NIST LWC KAT Vector #5: Empty PT with 4-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00010203"),
          input: [],
          expected: OpCodes.Hex8ToBytes("A250D62293CC5E144170038925DCC670")
        },
        {
          text: "NIST LWC KAT Vector #9: Empty PT with 8-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("0001020304050607"),
          input: [],
          expected: OpCodes.Hex8ToBytes("7960E636225BE5906093C052C4D9D2B9")
        },
        {
          text: "NIST LWC KAT Vector #25: Empty PT with 24-byte AD (rate boundary)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          input: [],
          expected: OpCodes.Hex8ToBytes("B072E203798396F521ABEA46FE5D05EB")
        },
        {
          text: "NIST LWC KAT Vector #34: 1-byte PT with empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("902F3A8F9CC74C133BE99356BB893CDB8D")
        },
        {
          text: "NIST LWC KAT Vector #44: 1-byte PT with 10-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00010203040506070809"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("203D9C10A8E20EB23C99F37EB3D55629B2")
        },
        {
          text: "NIST LWC KAT Vector #340: 10-byte PT with 8-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708"),
          input: OpCodes.Hex8ToBytes("00010203040506070809"),
          expected: OpCodes.Hex8ToBytes("DE70DCA5E4FB0C29074E2B4F9B33B17E3F9F7AD5E9E98A44")
        }
      ];

      // Constants
      this.KEY_SIZE = 16;      // 128 bits
      this.NONCE_SIZE = 16;    // 128 bits (though state has room for more)
      this.TAG_SIZE = 16;      // 128 bits
      this.RATE = 24;          // 192 bits (24 bytes)
      this.STATE_SIZE = 48;    // 384 bits (48 bytes)
      this.INIT_ROUNDS = 76;
      this.PROCESS_ROUNDS = 28;
      this.FINAL_ROUNDS = 32;
    }

    CreateInstance(isInverse = false) {
      return new KnotAead128384Instance(this, isInverse);
    }
  }

  class KnotAead128384Instance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._associatedData = [];
      this.inputBuffer = [];
      this.initialized = false;
    }

    // Property: key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error(`KNOT-AEAD-128-384 key must be 16 bytes long, got ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property: nonce
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(nonceBytes)) {
        throw new Error("Invalid nonce - must be byte array");
      }

      if (nonceBytes.length !== 16) {
        throw new Error(`KNOT-AEAD-128-384 requires exactly 16 bytes of nonce, got ${nonceBytes.length} bytes`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Property: associatedData
    set associatedData(adBytes) {
      if (!adBytes) {
        this._associatedData = [];
        return;
      }

      if (!Array.isArray(adBytes)) {
        throw new Error("Invalid associated data - must be byte array");
      }

      this._associatedData = [...adBytes];
    }

    get associatedData() {
      return [...this._associatedData];
    }

    // Initialize state with nonce and key
    _initialize() {
      if (!this._key || !this._nonce) {
        throw new Error("Key and nonce must be set before initialization");
      }

      // Create state: nonce (16 bytes) || key (16 bytes) || zeros (15 bytes) || 0x80 (1 byte)
      this.state = new Uint8Array(48);

      // Copy nonce (16 bytes)
      for (let i = 0; i < 16; ++i) {
        this.state[i] = this._nonce[i];
      }

      // Copy key (16 bytes)
      for (let i = 0; i < 16; ++i) {
        this.state[16 + i] = this._key[i];
      }

      // Zeros for bytes 32-46
      for (let i = 32; i < 47; ++i) {
        this.state[i] = 0;
      }

      // Set byte 47 to 0x80
      this.state[47] = 0x80;

      // Initial permutation
      knot384Permute(this.state, this.algorithm.INIT_ROUNDS);

      this.initialized = true;
    }

    // Absorb associated data
    _absorbAD() {
      const ad = this._associatedData;
      const rate = this.algorithm.RATE;
      let offset = 0;

      if (ad.length === 0) {
        // Empty AD: apply domain separation only
        this.state[47] ^= 0x80;
        return;
      }

      // Process full blocks
      while (offset + rate <= ad.length) {
        for (let i = 0; i < rate; ++i) {
          this.state[i] ^= ad[offset + i];
        }
        knot384Permute(this.state, this.algorithm.PROCESS_ROUNDS);
        offset += rate;
      }

      // Process final partial block
      const remaining = ad.length - offset;
      if (remaining > 0) {
        for (let i = 0; i < remaining; ++i) {
          this.state[i] ^= ad[offset + i];
        }
      }

      // Padding: XOR 0x01 at end of data
      this.state[remaining] ^= 0x01;
      knot384Permute(this.state, this.algorithm.PROCESS_ROUNDS);

      // Domain separation
      this.state[47] ^= 0x80;
    }

    // Encrypt plaintext
    _encrypt(plaintext) {
      const ciphertext = [];
      const rate = this.algorithm.RATE;
      let offset = 0;

      // Process full blocks
      while (offset + rate <= plaintext.length) {
        for (let i = 0; i < rate; ++i) {
          ciphertext.push(this.state[i] ^ plaintext[offset + i]);
          this.state[i] = ciphertext[ciphertext.length - 1];
        }
        knot384Permute(this.state, this.algorithm.PROCESS_ROUNDS);
        offset += rate;
      }

      // Process final partial block
      const remaining = plaintext.length - offset;
      if (remaining > 0) {
        for (let i = 0; i < remaining; ++i) {
          ciphertext.push(this.state[i] ^ plaintext[offset + i]);
          this.state[i] = ciphertext[ciphertext.length - 1];
        }
        // Padding
        this.state[remaining] ^= 0x01;
      }

      return ciphertext;
    }

    // Decrypt ciphertext
    _decrypt(ciphertext) {
      const plaintext = [];
      const rate = this.algorithm.RATE;
      let offset = 0;

      // Process full blocks
      while (offset + rate <= ciphertext.length) {
        for (let i = 0; i < rate; ++i) {
          const ct = ciphertext[offset + i];
          plaintext.push(this.state[i] ^ ct);
          this.state[i] = ct;
        }
        knot384Permute(this.state, this.algorithm.PROCESS_ROUNDS);
        offset += rate;
      }

      // Process final partial block
      const remaining = ciphertext.length - offset;
      if (remaining > 0) {
        for (let i = 0; i < remaining; ++i) {
          const ct = ciphertext[offset + i];
          plaintext.push(this.state[i] ^ ct);
          this.state[i] = ct;
        }
        // Padding
        this.state[remaining] ^= 0x01;
      }

      return plaintext;
    }

    // Compute authentication tag
    _computeTag() {
      knot384Permute(this.state, this.algorithm.FINAL_ROUNDS);

      // Extract first 16 bytes as tag
      const tag = [];
      for (let i = 0; i < 16; ++i) {
        tag.push(this.state[i]);
      }
      return tag;
    }

    // Feed/Result pattern
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      // Initialize state
      this._initialize();

      // Process associated data
      this._absorbAD();

      const result = [];

      if (this.isInverse) {
        // Decryption mode: input is ciphertext + tag
        if (this.inputBuffer.length < 16) {
          throw new Error("Ciphertext must include 16-byte authentication tag");
        }

        const ctLen = this.inputBuffer.length - 16;
        const ciphertext = this.inputBuffer.slice(0, ctLen);
        const receivedTag = this.inputBuffer.slice(ctLen);

        // Decrypt
        const plaintext = ctLen > 0 ? this._decrypt(ciphertext) : [];

        // Compute tag
        const computedTag = this._computeTag();

        // Verify tag (constant-time comparison)
        if (!OpCodes.ConstantTimeCompare(computedTag, receivedTag)) {
          throw new Error("Authentication tag verification failed");
        }

        result.push(...plaintext);
      } else {
        // Encryption mode: input is plaintext
        const plaintext = this.inputBuffer;

        // Encrypt
        const ciphertext = plaintext.length > 0 ? this._encrypt(plaintext) : [];

        // Compute tag
        const tag = this._computeTag();

        // Return ciphertext || tag
        result.push(...ciphertext, ...tag);
      }

      // Clear buffers
      this.inputBuffer = [];
      OpCodes.ClearArray(this.state);
      this.initialized = false;

      return result;
    }
  }

  // Register both algorithms
  RegisterAlgorithm(new KnotAead128256Algorithm());
  RegisterAlgorithm(new KnotAead128384Algorithm());

  return {
    KnotAead128256Algorithm,
    KnotAead128384Algorithm
  };
}));
