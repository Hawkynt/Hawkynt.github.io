/*
 * WAGE - Welch-Gong-based Authenticated Encryption
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * WAGE is an authenticated encryption algorithm designed for lightweight applications.
 * It uses a 259-bit state divided into 37 7-bit components, implementing a complex
 * permutation with LFSR feedback, WG permutation, and parallel S-box operations.
 *
 * Features:
 * - 128-bit key and nonce
 * - 128-bit authentication tag
 * - 259-bit state (37 × 7-bit components)
 * - 111-round permutation
 * - 8-byte rate for sponge construction
 *
 * References:
 * - https://uwaterloo.ca/communications-security-lab/lwc/wage
 * - NIST Lightweight Cryptography Competition Round 2
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
    root.WAGE = factory(root.AlgorithmFramework, root.OpCodes);
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

  // ===== WAGE CONSTANTS =====

  const STATE_SIZE = 37;        // 259 bits = 37 × 7-bit components
  const NUM_ROUNDS = 111;       // Number of permutation rounds
  const RATE_SIZE = 8;          // Rate in bytes for sponge mode
  const KEY_SIZE = 16;          // 128-bit key
  const NONCE_SIZE = 16;        // 128-bit nonce
  const TAG_SIZE = 16;          // 128-bit tag

  // Round constants RC0 and RC1 (interleaved, 222 bytes total)
  const WAGE_RC = [
    0x7f, 0x3f, 0x1f, 0x0f, 0x07, 0x03, 0x01, 0x40, 0x20, 0x10, 0x08, 0x04,
    0x02, 0x41, 0x60, 0x30, 0x18, 0x0c, 0x06, 0x43, 0x21, 0x50, 0x28, 0x14,
    0x0a, 0x45, 0x62, 0x71, 0x78, 0x3c, 0x1e, 0x4f, 0x27, 0x13, 0x09, 0x44,
    0x22, 0x51, 0x68, 0x34, 0x1a, 0x4d, 0x66, 0x73, 0x39, 0x5c, 0x2e, 0x57,
    0x2b, 0x15, 0x4a, 0x65, 0x72, 0x79, 0x7c, 0x3e, 0x5f, 0x2f, 0x17, 0x0b,
    0x05, 0x42, 0x61, 0x70, 0x38, 0x1c, 0x0e, 0x47, 0x23, 0x11, 0x48, 0x24,
    0x12, 0x49, 0x64, 0x32, 0x59, 0x6c, 0x36, 0x5b, 0x2d, 0x56, 0x6b, 0x35,
    0x5a, 0x6d, 0x76, 0x7b, 0x3d, 0x5e, 0x6f, 0x37, 0x1b, 0x0d, 0x46, 0x63,
    0x31, 0x58, 0x2c, 0x16, 0x4b, 0x25, 0x52, 0x69, 0x74, 0x3a, 0x5d, 0x6e,
    0x77, 0x3b, 0x1d, 0x4e, 0x67, 0x33, 0x19, 0x4c, 0x26, 0x53, 0x29, 0x54,
    0x2a, 0x55, 0x6a, 0x75, 0x7a, 0x7d, 0x7e, 0x7f, 0x3f, 0x1f, 0x0f, 0x07,
    0x03, 0x01, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x41, 0x60, 0x30, 0x18,
    0x0c, 0x06, 0x43, 0x21, 0x50, 0x28, 0x14, 0x0a, 0x45, 0x62, 0x71, 0x78,
    0x3c, 0x1e, 0x4f, 0x27, 0x13, 0x09, 0x44, 0x22, 0x51, 0x68, 0x34, 0x1a,
    0x4d, 0x66, 0x73, 0x39, 0x5c, 0x2e, 0x57, 0x2b, 0x15, 0x4a, 0x65, 0x72,
    0x79, 0x7c, 0x3e, 0x5f, 0x2f, 0x17, 0x0b, 0x05, 0x42, 0x61, 0x70, 0x38,
    0x1c, 0x0e, 0x47, 0x23, 0x11, 0x48, 0x24, 0x12, 0x49, 0x64, 0x32, 0x59,
    0x6c, 0x36, 0x5b, 0x2d, 0x56, 0x6b, 0x35, 0x5a, 0x6d, 0x76, 0x7b, 0x3d,
    0x5e, 0x6f, 0x37, 0x1b, 0x0d, 0x46
  ];

  // WGP S-box (7-bit permutation, 128 entries)
  const WAGE_WGP = [
    0x00, 0x12, 0x0a, 0x4b, 0x66, 0x0c, 0x48, 0x73, 0x79, 0x3e, 0x61, 0x51,
    0x01, 0x15, 0x17, 0x0e, 0x7e, 0x33, 0x68, 0x36, 0x42, 0x35, 0x37, 0x5e,
    0x53, 0x4c, 0x3f, 0x54, 0x58, 0x6e, 0x56, 0x2a, 0x1d, 0x25, 0x6d, 0x65,
    0x5b, 0x71, 0x2f, 0x20, 0x06, 0x18, 0x29, 0x3a, 0x0d, 0x7a, 0x6c, 0x1b,
    0x19, 0x43, 0x70, 0x41, 0x49, 0x22, 0x77, 0x60, 0x4f, 0x45, 0x55, 0x02,
    0x63, 0x47, 0x75, 0x2d, 0x40, 0x46, 0x7d, 0x5c, 0x7c, 0x59, 0x26, 0x0b,
    0x09, 0x03, 0x57, 0x5d, 0x27, 0x78, 0x30, 0x2e, 0x44, 0x52, 0x3b, 0x08,
    0x67, 0x2c, 0x05, 0x6b, 0x2b, 0x1a, 0x21, 0x38, 0x07, 0x0f, 0x4a, 0x11,
    0x50, 0x6a, 0x28, 0x31, 0x10, 0x4d, 0x5f, 0x72, 0x39, 0x16, 0x5a, 0x13,
    0x04, 0x3c, 0x34, 0x1f, 0x76, 0x1e, 0x14, 0x23, 0x1c, 0x32, 0x4e, 0x7b,
    0x24, 0x74, 0x7f, 0x3d, 0x69, 0x64, 0x62, 0x6f
  ];

  // ===== HELPER FUNCTIONS =====

  /**
   * omega(x) function: conditional XOR based on LSB
   * If low bit is 0: x >> 1
   * If low bit is 1: (x >> 1) ^ 0x78
   */
  function omega(x) {
    return ((x >>> 1) ^ (0x78 & (-(x & 0x01)))) & 0x7F;
  }

  /**
   * Bit-sliced S-box evaluation for 3 components in parallel
   * Packs three 7-bit values into bits 0, 8, 16 of a 32-bit word
   */
  function wagesSboxParallel3(x6) {
    var x0 = x6 >>> 6;
    var x1 = x6 >>> 5;
    var x2 = x6 >>> 4;
    var x3 = x6 >>> 3;
    var x4 = x6 >>> 2;
    var x5 = x6 >>> 1;

    x0 ^= (x2 & x3); x3 = ~x3; x3 ^= (x5 & x6); x5 = ~x5; x5 ^= (x2 & x4);
    x6 ^= (x0 & x4); x4 = ~x4; x4 ^= (x5 & x1); x5 = ~x5; x5 ^= (x0 & x2);
    x1 ^= (x6 & x2); x2 = ~x2; x2 ^= (x5 & x3); x5 = ~x5; x5 ^= (x6 & x0);
    x3 ^= (x1 & x0); x0 = ~x0; x0 ^= (x5 & x4); x5 = ~x5; x5 ^= (x1 & x6);
    x4 ^= (x3 & x6); x6 = ~x6; x6 ^= (x5 & x2); x5 = ~x5; x5 ^= (x3 & x1);
    x2 ^= (x4 & x1); x1 = ~x1; x1 ^= (x5 & x0); x5 = ~x5; x5 ^= (x4 & x3);
    x2 = ~x2; x4 = ~x4;

    return (((x2 & 0x00010101) << 6) ^
            ((x6 & 0x00010101) << 5) ^
            ((x4 & 0x00010101) << 4) ^
            ((x1 & 0x00010101) << 3) ^
            ((x3 & 0x00010101) << 2) ^
            ((x5 & 0x00010101) << 1) ^
             (x0 & 0x00010101)) >>> 0;
  }

  /**
   * WAGE permutation - 111 rounds, 3 at a time (37 iterations)
   */
  function wagePermute(s) {
    var rcIndex = 0;
    var round, fb0, fb1, fb2, temp;

    // Process all rounds 3 at a time to reduce state rotation overhead
    for (round = 0; round < Math.floor(NUM_ROUNDS / 3); ++round, rcIndex += 6) {
      // Calculate feedback for 3 rounds in parallel
      // fb = omega(s[0]) ^ s[6] ^ s[8] ^ s[12] ^ s[13] ^ s[19] ^
      //      s[24] ^ s[26] ^ s[30] ^ s[31] ^ WGP(s[36]) ^ RC1[round]

      fb0 = omega(s[0]);
      fb0 ^= s[6] ^ s[8] ^ s[12] ^ s[13] ^ s[19] ^ s[24] ^ s[26] ^ s[30] ^ s[31];
      fb0 ^= WAGE_RC[rcIndex + 1];
      fb0 ^= WAGE_WGP[s[36]];

      fb1 = omega(s[1]);
      fb1 ^= s[7] ^ s[9] ^ s[13] ^ s[14] ^ s[20] ^ s[25] ^ s[27] ^ s[31] ^ s[32];
      fb1 ^= WAGE_RC[rcIndex + 3];
      fb1 ^= WAGE_WGP[fb0];

      fb2 = omega(s[2]);
      fb2 ^= s[8] ^ s[10] ^ s[14] ^ s[15] ^ s[21] ^ s[26] ^ s[28] ^ s[32] ^ s[33];
      fb2 ^= WAGE_RC[rcIndex + 5];
      fb2 ^= WAGE_WGP[fb1];

      // Apply S-box to specific components
      temp = s[8] | (s[9] << 8) | (s[10] << 16);
      temp = wagesSboxParallel3(temp);
      s[5] ^= (temp) & 0x7F;
      s[6] ^= (temp >>> 8) & 0x7F;
      s[7] ^= (temp >>> 16) & 0x7F;

      temp = s[15] | (s[16] << 8) | (s[17] << 16);
      temp = wagesSboxParallel3(temp);
      s[11] ^= (temp) & 0x7F;
      s[12] ^= (temp >>> 8) & 0x7F;
      s[13] ^= (temp >>> 16) & 0x7F;

      // Apply WGP to s[18], s[19], s[20] with RC0
      s[19] ^= WAGE_WGP[s[18]] ^ WAGE_RC[rcIndex + 0];
      s[20] ^= WAGE_WGP[s[19]] ^ WAGE_RC[rcIndex + 2];
      s[21] ^= WAGE_WGP[s[20]] ^ WAGE_RC[rcIndex + 4];

      temp = s[27] | (s[28] << 8) | (s[29] << 16);
      temp = wagesSboxParallel3(temp);
      s[24] ^= (temp) & 0x7F;
      s[25] ^= (temp >>> 8) & 0x7F;
      s[26] ^= (temp >>> 16) & 0x7F;

      temp = s[34] | (s[35] << 8) | (s[36] << 16);
      temp = wagesSboxParallel3(temp);
      s[30] ^= (temp) & 0x7F;
      s[31] ^= (temp >>> 8) & 0x7F;
      s[32] ^= (temp >>> 16) & 0x7F;

      // Rotate state by 3 positions
      for (var i = 0; i < STATE_SIZE - 3; ++i) {
        s[i] = s[i + 3];
      }
      s[STATE_SIZE - 3] = fb0;
      s[STATE_SIZE - 2] = fb1;
      s[STATE_SIZE - 1] = fb2;
    }
  }

  /**
   * Convert 128-bit value to 19 7-bit components
   * Maps 128 bits (16 bytes) to 19 components with specific bit positions
   */
  function wage128bitToComponents(input) {
    var out = new Array(19);
    var temp;

    temp = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
    out[0] = (temp >>> 25) & 0x7F;
    out[1] = (temp >>> 18) & 0x7F;
    out[2] = (temp >>> 11) & 0x7F;
    out[3] = (temp >>> 4) & 0x7F;
    out[4] = (temp << 3) & 0x7F;

    temp = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);
    out[4] ^= (temp >>> 29) & 0x7F;
    out[5] = (temp >>> 22) & 0x7F;
    out[6] = (temp >>> 15) & 0x7F;
    out[7] = (temp >>> 8) & 0x7F;
    out[8] = (temp >>> 1) & 0x7F;
    out[18] = (temp << 6) & 0x7F;

    temp = OpCodes.Pack32BE(input[8], input[9], input[10], input[11]);
    out[9] = (temp >>> 25) & 0x7F;
    out[10] = (temp >>> 18) & 0x7F;
    out[11] = (temp >>> 11) & 0x7F;
    out[12] = (temp >>> 4) & 0x7F;
    out[13] = (temp << 3) & 0x7F;

    temp = OpCodes.Pack32BE(input[12], input[13], input[14], input[15]);
    out[13] ^= (temp >>> 29) & 0x7F;
    out[14] = (temp >>> 22) & 0x7F;
    out[15] = (temp >>> 15) & 0x7F;
    out[16] = (temp >>> 8) & 0x7F;
    out[17] = (temp >>> 1) & 0x7F;
    out[18] ^= (temp << 5) & 0x20;

    return out;
  }

  /**
   * Absorb 8 bytes into WAGE state
   * Rate components: s[8], s[9], s[15], s[16], s[18], s[27], s[28], s[34], s[35], s[36]
   */
  function wageAbsorb(s, data) {
    var temp = OpCodes.Pack32BE(data[0], data[1], data[2], data[3]);
    s[8] ^= (temp >>> 25) & 0x7F;
    s[9] ^= (temp >>> 18) & 0x7F;
    s[15] ^= (temp >>> 11) & 0x7F;
    s[16] ^= (temp >>> 4) & 0x7F;
    s[18] ^= (temp << 3) & 0x7F;

    temp = OpCodes.Pack32BE(data[4], data[5], data[6], data[7]);
    s[18] ^= (temp >>> 29) & 0x7F;
    s[27] ^= (temp >>> 22) & 0x7F;
    s[28] ^= (temp >>> 15) & 0x7F;
    s[34] ^= (temp >>> 8) & 0x7F;
    s[35] ^= (temp >>> 1) & 0x7F;
    s[36] ^= (temp << 6) & 0x7F;
  }

  /**
   * Get 8 bytes from WAGE rate
   */
  function wageGetRate(s) {
    var data = new Array(8);
    var temp;

    temp = (s[8] << 25) | (s[9] << 18) | (s[15] << 11) | (s[16] << 4) | (s[18] >>> 3);
    var bytes = OpCodes.Unpack32BE(temp >>> 0);
    data[0] = bytes[0];
    data[1] = bytes[1];
    data[2] = bytes[2];
    data[3] = bytes[3];

    temp = (s[18] << 29) | (s[27] << 22) | (s[28] << 15) | (s[34] << 8) | (s[35] << 1) | (s[36] >>> 6);
    bytes = OpCodes.Unpack32BE(temp >>> 0);
    data[4] = bytes[0];
    data[5] = bytes[1];
    data[6] = bytes[2];
    data[7] = bytes[3];

    return data;
  }

  /**
   * Set 8 bytes into WAGE rate
   */
  function wageSetRate(s, data) {
    var temp = OpCodes.Pack32BE(data[0], data[1], data[2], data[3]);
    s[8] = (temp >>> 25) & 0x7F;
    s[9] = (temp >>> 18) & 0x7F;
    s[15] = (temp >>> 11) & 0x7F;
    s[16] = (temp >>> 4) & 0x7F;
    s[18] = (temp << 3) & 0x7F;

    temp = OpCodes.Pack32BE(data[4], data[5], data[6], data[7]);
    s[18] ^= (temp >>> 29) & 0x7F;
    s[27] = (temp >>> 22) & 0x7F;
    s[28] = (temp >>> 15) & 0x7F;
    s[34] = (temp >>> 8) & 0x7F;
    s[35] = (temp >>> 1) & 0x7F;
    s[36] = ((temp << 6) & 0x40) ^ (s[36] & 0x3F);
  }

  /**
   * Absorb 16-byte key into state (called twice during initialization)
   */
  function wageAbsorbKey(s, key) {
    var components = wage128bitToComponents(key);

    // First absorption
    s[8] ^= components[0];
    s[9] ^= components[1];
    s[15] ^= components[2];
    s[16] ^= components[3];
    s[18] ^= components[4];
    s[27] ^= components[5];
    s[28] ^= components[6];
    s[34] ^= components[7];
    s[35] ^= components[8];
    s[36] ^= components[18] & 0x40;
    wagePermute(s);

    // Second absorption
    s[8] ^= components[9];
    s[9] ^= components[10];
    s[15] ^= components[11];
    s[16] ^= components[12];
    s[18] ^= components[13];
    s[27] ^= components[14];
    s[28] ^= components[15];
    s[34] ^= components[16];
    s[35] ^= components[17];
    s[36] ^= (components[18] << 1) & 0x40;
    wagePermute(s);
  }

  /**
   * Initialize WAGE state with key and nonce
   */
  function wageInit(key, nonce) {
    var s = new Array(STATE_SIZE);
    var keyComponents = wage128bitToComponents(key);
    var nonceComponents = wage128bitToComponents(nonce);

    // Initialize state with key
    s[0] = keyComponents[0];
    s[1] = keyComponents[2];
    s[2] = keyComponents[4];
    s[3] = keyComponents[6];
    s[4] = keyComponents[8];
    s[5] = keyComponents[10];
    s[6] = keyComponents[12];
    s[7] = keyComponents[14];
    s[8] = keyComponents[16];
    s[18] = keyComponents[18];
    s[19] = keyComponents[1];
    s[20] = keyComponents[3];
    s[21] = keyComponents[5];
    s[22] = keyComponents[7];
    s[23] = keyComponents[9];
    s[24] = keyComponents[11];
    s[25] = keyComponents[13];
    s[26] = keyComponents[15];
    s[27] = keyComponents[17];

    // Mix in nonce
    s[9] = nonceComponents[1];
    s[10] = nonceComponents[3];
    s[11] = nonceComponents[5];
    s[12] = nonceComponents[7];
    s[13] = nonceComponents[9];
    s[14] = nonceComponents[11];
    s[15] = nonceComponents[13];
    s[16] = nonceComponents[17];
    s[17] = nonceComponents[15];
    s[18] ^= (nonceComponents[18] >>> 2) & 0x1F;
    s[28] = nonceComponents[0];
    s[29] = nonceComponents[2];
    s[30] = nonceComponents[4];
    s[31] = nonceComponents[6];
    s[32] = nonceComponents[8];
    s[33] = nonceComponents[10];
    s[34] = nonceComponents[12];
    s[35] = nonceComponents[14];
    s[36] = nonceComponents[16];

    // Initial permutation
    wagePermute(s);

    // Absorb key again
    wageAbsorbKey(s, key);

    return s;
  }

  /**
   * Extract 128-bit tag from state
   */
  function wageExtractTag(s) {
    var components = new Array(19);
    var tag = new Array(16);
    var temp;

    // Extract components for tag
    for (var i = 0; i < 9; ++i) {
      components[i * 2] = s[28 + i];
      components[i * 2 + 1] = s[9 + i];
    }
    components[18] = (s[18] << 2) & 0x60;

    // Convert components to bytes
    temp = (components[0] << 25) | (components[1] << 18) | (components[2] << 11) | (components[3] << 4) | (components[4] >>> 3);
    var bytes = OpCodes.Unpack32BE(temp >>> 0);
    tag[0] = bytes[0];
    tag[1] = bytes[1];
    tag[2] = bytes[2];
    tag[3] = bytes[3];

    temp = (components[4] << 29) | (components[5] << 22) | (components[6] << 15) | (components[7] << 8) | (components[8] << 1) | (components[9] >>> 6);
    bytes = OpCodes.Unpack32BE(temp >>> 0);
    tag[4] = bytes[0];
    tag[5] = bytes[1];
    tag[6] = bytes[2];
    tag[7] = bytes[3];

    temp = (components[9] << 26) | (components[10] << 19) | (components[11] << 12) | (components[12] << 5) | (components[13] >>> 2);
    bytes = OpCodes.Unpack32BE(temp >>> 0);
    tag[8] = bytes[0];
    tag[9] = bytes[1];
    tag[10] = bytes[2];
    tag[11] = bytes[3];

    temp = (components[13] << 30) | (components[14] << 23) | (components[15] << 16) | (components[16] << 9) | (components[17] << 2) | (components[18] >>> 5);
    bytes = OpCodes.Unpack32BE(temp >>> 0);
    tag[12] = bytes[0];
    tag[13] = bytes[1];
    tag[14] = bytes[2];
    tag[15] = bytes[3];

    return tag;
  }

  // ===== ALGORITHM CLASS =====

  class WAGEAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "WAGE";
      this.description = "WAGE authenticated encryption algorithm with 259-bit permutation, NIST LWC Round 2 finalist. Features WG permutation and parallel S-box operations for lightweight applications.";
      this.inventor = "Yalijiang Yang, Zhongming Wu, Xinxin Fan";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN;

      // Algorithm capabilities
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation
      this.documentation = [
        new LinkItem("WAGE Official Page", "https://uwaterloo.ca/communications-security-lab/lwc/wage"),
        new LinkItem("NIST LWC Round 2", "https://csrc.nist.gov/Projects/lightweight-cryptography")
      ];

      // Test vectors from NIST KAT (WAGE.txt)
      this.tests = [
        {
          text: "NIST KAT Vector #1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("0466697CC97CDB5604BC6F6B5CBA9014")
        },
        {
          text: "NIST KAT Vector #2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("AFEA3A5C7C215D819F028FC060E0B010")
        },
        {
          text: "NIST KAT Vector #9 (empty PT, 8-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("0001020304050607"),
          input: [],
          expected: OpCodes.Hex8ToBytes("4B4819C8CF89D87E90E1DC6AD863193C")
        },
        {
          text: "NIST KAT Vector #17 (empty PT, 16-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: [],
          expected: OpCodes.Hex8ToBytes("49280EFF5A89236F9B53C30B89C936EE")
        },
        {
          text: "NIST KAT Vector #34 (1-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("A4C7F41212EE54FFC71DEE47E69DCD01E5")
        },
        {
          text: "NIST KAT Vector #35 (1-byte PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("9C09707BB8EDBA95AFE9C26F607C3B6B2D")
        },
        {
          text: "NIST KAT Vector #42 (1-byte PT, 8-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("6AF94F77AE28C9BFCC719C771878689097")
        },
        {
          text: "NIST KAT Vector #50 (1-byte PT, 16-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("4893485DC4CAA674B39B9007B43D1C67E7")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new WAGEInstance(this, isInverse);
    }
  }

  // ===== INSTANCE CLASS =====

  /**
 * WAGE cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class WAGEInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._associatedData = [];
      this.inputBuffer = [];
      this.state = null;
      this.initialized = false;
    }

    // Property: key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== KEY_SIZE) {
        throw new Error("WAGE key must be 16 bytes, got " + keyBytes.length + " bytes");
      }

      this._key = keyBytes.slice();
      this.initialized = false;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? this._key.slice() : null;
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

      if (nonceBytes.length !== NONCE_SIZE) {
        throw new Error("WAGE nonce must be 16 bytes, got " + nonceBytes.length + " bytes");
      }

      this._nonce = nonceBytes.slice();
      this.initialized = false;
    }

    get nonce() {
      return this._nonce ? this._nonce.slice() : null;
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

      this._associatedData = adBytes.slice();
    }

    get associatedData() {
      return this._associatedData.slice();
    }

    // Initialize state if key and nonce are set
    _initializeIfNeeded() {
      if (!this._key || !this._nonce) {
        throw new Error("Key and nonce must be set before processing");
      }

      if (!this.initialized) {
        this.state = wageInit(this._key, this._nonce);
        if (this._associatedData.length > 0) {
          this._processAssociatedData();
        }
        this.initialized = true;
      }
    }

    // Process associated data
    _processAssociatedData() {
      var ad = this._associatedData;
      var adlen = ad.length;
      var offset = 0;
      var pad = new Array(RATE_SIZE);

      // Process full blocks
      while (adlen >= RATE_SIZE) {
        wageAbsorb(this.state, ad.slice(offset, offset + RATE_SIZE));
        this.state[0] ^= 0x40;  // Domain separation for AD
        wagePermute(this.state);
        offset += RATE_SIZE;
        adlen -= RATE_SIZE;
      }

      // Process final block with padding
      for (var i = 0; i < adlen; ++i) {
        pad[i] = ad[offset + i];
      }
      pad[adlen] = 0x80;  // Padding marker
      for (var i = adlen + 1; i < RATE_SIZE; ++i) {
        pad[i] = 0;
      }
      wageAbsorb(this.state, pad);
      this.state[0] ^= 0x40;  // Domain separation for AD
      wagePermute(this.state);
    }

    // Feed/Result pattern
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid data - must be byte array");
      }
      this.inputBuffer.push.apply(this.inputBuffer, data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      this._initializeIfNeeded();

      if (this.isInverse) {
        return this._decrypt();
      } else {
        return this._encrypt();
      }
    }

    // Encrypt plaintext
    _encrypt() {
      var output = [];
      var mlen = this.inputBuffer.length;
      var offset = 0;
      var block = new Array(RATE_SIZE);
      var rate;

      // Process full blocks
      while (mlen >= RATE_SIZE) {
        rate = wageGetRate(this.state);
        for (var i = 0; i < RATE_SIZE; ++i) {
          block[i] = rate[i] ^ this.inputBuffer[offset + i];
        }
        wageSetRate(this.state, block);
        this.state[0] ^= 0x20;  // Domain separation for message
        wagePermute(this.state);
        output.push.apply(output, block);
        offset += RATE_SIZE;
        mlen -= RATE_SIZE;
      }

      // Process final block with padding
      rate = wageGetRate(this.state);
      for (var i = 0; i < mlen; ++i) {
        block[i] = rate[i] ^ this.inputBuffer[offset + i];
      }
      for (var i = mlen; i < RATE_SIZE; ++i) {
        block[i] = rate[i];
      }
      block[mlen] ^= 0x80;  // Padding marker
      wageSetRate(this.state, block);
      this.state[0] ^= 0x20;  // Domain separation for message
      wagePermute(this.state);
      for (var i = 0; i < mlen; ++i) {
        output.push(block[i]);
      }

      // Generate tag
      wageAbsorbKey(this.state, this._key);
      var tag = wageExtractTag(this.state);
      output.push.apply(output, tag);

      // Clear buffers
      this.inputBuffer = [];
      this.initialized = false;

      return output;
    }

    // Decrypt ciphertext
    _decrypt() {
      if (this.inputBuffer.length < TAG_SIZE) {
        throw new Error("Ciphertext too short - must include 16-byte tag");
      }

      var output = [];
      var clen = this.inputBuffer.length - TAG_SIZE;
      var offset = 0;
      var block = new Array(RATE_SIZE);
      var block2 = new Array(RATE_SIZE);
      var rate;

      // Process full blocks
      while (clen >= RATE_SIZE) {
        rate = wageGetRate(this.state);
        for (var i = 0; i < RATE_SIZE; ++i) {
          block[i] = rate[i] ^ this.inputBuffer[offset + i];
        }
        wageSetRate(this.state, this.inputBuffer.slice(offset, offset + RATE_SIZE));
        this.state[0] ^= 0x20;  // Domain separation for message
        wagePermute(this.state);
        output.push.apply(output, block);
        offset += RATE_SIZE;
        clen -= RATE_SIZE;
      }

      // Process final block with padding
      rate = wageGetRate(this.state);
      for (var i = 0; i < clen; ++i) {
        block2[i] = rate[i] ^ this.inputBuffer[offset + i];
        block[i] = this.inputBuffer[offset + i];
      }
      for (var i = clen; i < RATE_SIZE; ++i) {
        block[i] = rate[i];
      }
      block[clen] ^= 0x80;  // Padding marker
      wageSetRate(this.state, block);
      this.state[0] ^= 0x20;  // Domain separation for message
      wagePermute(this.state);
      for (var i = 0; i < clen; ++i) {
        output.push(block2[i]);
      }

      // Verify tag
      wageAbsorbKey(this.state, this._key);
      var computedTag = wageExtractTag(this.state);
      var receivedTag = this.inputBuffer.slice(this.inputBuffer.length - TAG_SIZE);

      // Constant-time tag comparison
      var tagMatch = true;
      for (var i = 0; i < TAG_SIZE; ++i) {
        if (computedTag[i] !== receivedTag[i]) {
          tagMatch = false;
        }
      }

      if (!tagMatch) {
        throw new Error("Authentication tag verification failed");
      }

      // Clear buffers
      this.inputBuffer = [];
      this.initialized = false;

      return output;
    }
  }

  // ===== REGISTRATION =====

  RegisterAlgorithm(new WAGEAlgorithm());

  return WAGEAlgorithm;
}));
