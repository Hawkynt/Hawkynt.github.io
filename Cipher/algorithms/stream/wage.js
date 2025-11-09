/*
 * WAGE - Production-Grade Lightweight AEAD Stream Cipher
 * NIST LWC Submission (Round 2 Candidate)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * WAGE is a lightweight authenticated encryption with associated data (AEAD) algorithm
 * designed for resource-constrained environments. Uses a 259-bit state organized as
 * 37 7-bit components with WGP permutation, S-box, and LFSR operations.
 *
 * SECURITY STATUS: EXPERIMENTAL - NIST LWC Round 2 candidate with ongoing security analysis
 * SUITABLE FOR: Lightweight cryptographic applications, IoT devices, embedded systems
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
          StreamCipherAlgorithm, AeadAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // Use AEAD if available, otherwise StreamCipher
  const BaseAlgorithm = AeadAlgorithm || StreamCipherAlgorithm;

  // ===== WAGE CONSTANTS =====

  const WAGE_STATE_SIZE = 37;  // 259 bits as 37 7-bit components
  const WAGE_RATE = 8;         // 8-byte rate for sponge construction
  const WAGE_NUM_ROUNDS = 111; // Number of permutation rounds

  // RC0 and RC1 round constants for WAGE, interleaved with each other
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

  // WGP permutation lookup table
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
   * Evaluate the WAGE S-box three times in parallel.
   * Implements the S-box in bit-sliced form.
   */
  function wageSboxParallel3(x6) {
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
   * WAGE permutation - performs 111 rounds of state transformation.
   * Uses 8-bit version for compatibility (reference has both 8-bit and 64-bit).
   */
  function wagePermute(s) {
    var rcIndex = 0;
    var round, index;
    var fb0, fb1, fb2;
    var temp;

    // Perform all rounds 3 at a time to reduce state rotation overhead
    for (round = 0; round < Math.floor(WAGE_NUM_ROUNDS / 3); ++round) {
      // Calculate the feedback value for the LFSR
      // fb = omega(s[0]) ^ s[6] ^ s[8] ^ s[12] ^ s[13] ^ s[19] ^
      //      s[24] ^ s[26] ^ s[30] ^ s[31] ^ WGP(s[36]) ^ RC1[round]
      // where omega(x) is (x >> 1) if the low bit of x is zero and
      // (x >> 1) ^ 0x78 if the low bit of x is one.

      fb0 = (s[0] >>> 1) ^ (0x78 & -(s[0] & 0x01));
      fb0 ^= s[6]  ^ s[8]  ^ s[12] ^ s[13] ^ s[19] ^
             s[24] ^ s[26] ^ s[30] ^ s[31] ^ WAGE_RC[rcIndex + 1];
      fb0 ^= WAGE_WGP[s[36]];

      fb1 = (s[1] >>> 1) ^ (0x78 & -(s[1] & 0x01));
      fb1 ^= s[7]  ^ s[9]  ^ s[13] ^ s[14] ^ s[20] ^
             s[25] ^ s[27] ^ s[31] ^ s[32] ^ WAGE_RC[rcIndex + 3];
      fb1 ^= WAGE_WGP[fb0];

      fb2 = (s[2] >>> 1) ^ (0x78 & -(s[2] & 0x01));
      fb2 ^= s[8]  ^ s[10] ^ s[14] ^ s[15] ^ s[21] ^
             s[26] ^ s[28] ^ s[32] ^ s[33] ^ WAGE_RC[rcIndex + 5];
      fb2 ^= WAGE_WGP[fb1];

      // Apply the S-box and WGP permutation to certain components
      temp = s[8] | ((s[9] & 0xFF) << 8) | ((s[10] & 0xFF) << 16);
      temp = wageSboxParallel3(temp);
      s[5]  ^= (temp & 0xFF);
      s[6]  ^= ((temp >>> 8) & 0xFF);
      s[7]  ^= ((temp >>> 16) & 0xFF);

      temp = s[15] | ((s[16] & 0xFF) << 8) | ((s[17] & 0xFF) << 16);
      temp = wageSboxParallel3(temp);
      s[11] ^= (temp & 0xFF);
      s[12] ^= ((temp >>> 8) & 0xFF);
      s[13] ^= ((temp >>> 16) & 0xFF);

      s[19] ^= WAGE_WGP[s[18]] ^ WAGE_RC[rcIndex + 0];
      s[20] ^= WAGE_WGP[s[19]] ^ WAGE_RC[rcIndex + 2];
      s[21] ^= WAGE_WGP[s[20]] ^ WAGE_RC[rcIndex + 4];

      temp = s[27] | ((s[28] & 0xFF) << 8) | ((s[29] & 0xFF) << 16);
      temp = wageSboxParallel3(temp);
      s[24] ^= (temp & 0xFF);
      s[25] ^= ((temp >>> 8) & 0xFF);
      s[26] ^= ((temp >>> 16) & 0xFF);

      temp = s[34] | ((s[35] & 0xFF) << 8) | ((s[36] & 0xFF) << 16);
      temp = wageSboxParallel3(temp);
      s[30] ^= (temp & 0xFF);
      s[31] ^= ((temp >>> 8) & 0xFF);
      s[32] ^= ((temp >>> 16) & 0xFF);

      // Rotate the components of the state by 3 positions
      for (index = 0; index < WAGE_STATE_SIZE - 3; ++index) {
        s[index] = s[index + 3];
      }
      s[WAGE_STATE_SIZE - 3] = fb0;
      s[WAGE_STATE_SIZE - 2] = fb1;
      s[WAGE_STATE_SIZE - 1] = fb2;

      rcIndex += 6;
    }
  }

  /**
   * Absorb 8 bytes into the WAGE state.
   * 7-bit components for the rate: 8, 9, 15, 16, 18, 27, 28, 34, 35, 36
   */
  function wageAbsorb(s, data) {
    var temp;
    temp = OpCodes.Pack32BE(data[0], data[1], data[2], data[3]);
    s[8]  ^= (temp >>> 25) & 0x7F;
    s[9]  ^= (temp >>> 18) & 0x7F;
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
   * Get 8 bytes of the rate from the WAGE state.
   */
  function wageGetRate(s, data) {
    var temp;
    temp  = (s[8] << 25) >>> 0;
    temp |= (s[9] << 18) >>> 0;
    temp |= (s[15] << 11) >>> 0;
    temp |= (s[16] << 4) >>> 0;
    temp |= (s[18] >>> 3) >>> 0;
    temp = temp >>> 0;
    var bytes = OpCodes.Unpack32BE(temp);
    data[0] = bytes[0];
    data[1] = bytes[1];
    data[2] = bytes[2];
    data[3] = bytes[3];

    temp  = (s[18] << 29) >>> 0;
    temp |= (s[27] << 22) >>> 0;
    temp |= (s[28] << 15) >>> 0;
    temp |= (s[34] << 8) >>> 0;
    temp |= (s[35] << 1) >>> 0;
    temp |= (s[36] >>> 6) >>> 0;
    temp = temp >>> 0;
    bytes = OpCodes.Unpack32BE(temp);
    data[4] = bytes[0];
    data[5] = bytes[1];
    data[6] = bytes[2];
    data[7] = bytes[3];
  }

  /**
   * Set 8 bytes of the rate in the WAGE state.
   */
  function wageSetRate(s, data) {
    var temp;
    temp = OpCodes.Pack32BE(data[0], data[1], data[2], data[3]);
    s[8]  = (temp >>> 25) & 0x7F;
    s[9]  = (temp >>> 18) & 0x7F;
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
   * Convert a 128-bit value into an array of 7-bit components.
   */
  function wage128bitToComponents(out, inBytes) {
    var temp;
    temp = OpCodes.Pack32BE(inBytes[0], inBytes[1], inBytes[2], inBytes[3]);
    out[0]  = (temp >>> 25) & 0x7F;
    out[1]  = (temp >>> 18) & 0x7F;
    out[2]  = (temp >>> 11) & 0x7F;
    out[3]  = (temp >>> 4) & 0x7F;
    out[4]  = (temp << 3) & 0x7F;
    temp = OpCodes.Pack32BE(inBytes[4], inBytes[5], inBytes[6], inBytes[7]);
    out[4] ^= (temp >>> 29) & 0x7F;
    out[5]  = (temp >>> 22) & 0x7F;
    out[6]  = (temp >>> 15) & 0x7F;
    out[7]  = (temp >>> 8) & 0x7F;
    out[8]  = (temp >>> 1) & 0x7F;
    out[18] = (temp << 6) & 0x7F;
    temp = OpCodes.Pack32BE(inBytes[8], inBytes[9], inBytes[10], inBytes[11]);
    out[9]  = (temp >>> 25) & 0x7F;
    out[10] = (temp >>> 18) & 0x7F;
    out[11] = (temp >>> 11) & 0x7F;
    out[12] = (temp >>> 4) & 0x7F;
    out[13] = (temp << 3) & 0x7F;
    temp = OpCodes.Pack32BE(inBytes[12], inBytes[13], inBytes[14], inBytes[15]);
    out[13] ^= (temp >>> 29) & 0x7F;
    out[14] = (temp >>> 22) & 0x7F;
    out[15] = (temp >>> 15) & 0x7F;
    out[16] = (temp >>> 8) & 0x7F;
    out[17] = (temp >>> 1) & 0x7F;
    out[18] ^= (temp << 5) & 0x20;
  }

  /**
   * Absorb 16 key bytes into the WAGE state.
   */
  function wageAbsorbKey(s, key) {
    var components = new Array(19);
    wage128bitToComponents(components, key);
    s[8]  ^= components[0];
    s[9]  ^= components[1];
    s[15] ^= components[2];
    s[16] ^= components[3];
    s[18] ^= components[4];
    s[27] ^= components[5];
    s[28] ^= components[6];
    s[34] ^= components[7];
    s[35] ^= components[8];
    s[36] ^= components[18] & 0x40;
    wagePermute(s);
    s[8]  ^= components[9];
    s[9]  ^= components[10];
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
   * Initialize the WAGE state with a key and nonce.
   */
  function wageInit(s, key, nonce) {
    var components = new Array(19);

    // Initialize the state with the key and nonce
    wage128bitToComponents(components, key);
    s[0]  = components[0];
    s[1]  = components[2];
    s[2]  = components[4];
    s[3]  = components[6];
    s[4]  = components[8];
    s[5]  = components[10];
    s[6]  = components[12];
    s[7]  = components[14];
    s[8]  = components[16];
    s[18] = components[18];
    s[19] = components[1];
    s[20] = components[3];
    s[21] = components[5];
    s[22] = components[7];
    s[23] = components[9];
    s[24] = components[11];
    s[25] = components[13];
    s[26] = components[15];
    s[27] = components[17];

    wage128bitToComponents(components, nonce);
    s[9]  = components[1];
    s[10] = components[3];
    s[11] = components[5];
    s[12] = components[7];
    s[13] = components[9];
    s[14] = components[11];
    s[15] = components[13];
    s[16] = components[17];
    s[17] = components[15];
    s[18] ^= (components[18] >>> 2) & 0x7F;
    s[28] = components[0];
    s[29] = components[2];
    s[30] = components[4];
    s[31] = components[6];
    s[32] = components[8];
    s[33] = components[10];
    s[34] = components[12];
    s[35] = components[14];
    s[36] = components[16];

    // Permute the state to absorb the key and nonce
    wagePermute(s);

    // Absorb the key again and permute the state
    wageAbsorbKey(s, key);
  }

  /**
   * Extract the 128-bit authentication tag from the WAGE state.
   */
  function wageExtractTag(s, tag) {
    var components = new Array(19);
    var temp;
    var i;

    // Extract the 7-bit components that make up the tag
    for (i = 0; i < 9; ++i) {
      components[i * 2]     = s[28 + i];
      components[i * 2 + 1] = s[9 + i];
    }
    components[18] = (s[18] << 2) & 0x60;

    // Convert from 7-bit component form back into bytes
    temp  = (components[0] << 25) >>> 0;
    temp |= (components[1] << 18) >>> 0;
    temp |= (components[2] << 11) >>> 0;
    temp |= (components[3] << 4) >>> 0;
    temp |= (components[4] >>> 3) >>> 0;
    temp = temp >>> 0;
    var bytes = OpCodes.Unpack32BE(temp);
    tag[0] = bytes[0];
    tag[1] = bytes[1];
    tag[2] = bytes[2];
    tag[3] = bytes[3];

    temp  = (components[4] << 29) >>> 0;
    temp |= (components[5] << 22) >>> 0;
    temp |= (components[6] << 15) >>> 0;
    temp |= (components[7] << 8) >>> 0;
    temp |= (components[8] << 1) >>> 0;
    temp |= (components[9] >>> 6) >>> 0;
    temp = temp >>> 0;
    bytes = OpCodes.Unpack32BE(temp);
    tag[4] = bytes[0];
    tag[5] = bytes[1];
    tag[6] = bytes[2];
    tag[7] = bytes[3];

    temp  = (components[9]  << 26) >>> 0;
    temp |= (components[10] << 19) >>> 0;
    temp |= (components[11] << 12) >>> 0;
    temp |= (components[12] << 5) >>> 0;
    temp |= (components[13] >>> 2) >>> 0;
    temp = temp >>> 0;
    bytes = OpCodes.Unpack32BE(temp);
    tag[8] = bytes[0];
    tag[9] = bytes[1];
    tag[10] = bytes[2];
    tag[11] = bytes[3];

    temp  = (components[13] << 30) >>> 0;
    temp |= (components[14] << 23) >>> 0;
    temp |= (components[15] << 16) >>> 0;
    temp |= (components[16] << 9) >>> 0;
    temp |= (components[17] << 2) >>> 0;
    temp |= (components[18] >>> 5) >>> 0;
    temp = temp >>> 0;
    bytes = OpCodes.Unpack32BE(temp);
    tag[12] = bytes[0];
    tag[13] = bytes[1];
    tag[14] = bytes[2];
    tag[15] = bytes[3];
  }

  /**
   * Process associated data for WAGE.
   */
  function wageProcessAd(state, ad) {
    var adlen = ad.length;
    var offset = 0;
    var pad = new Array(WAGE_RATE);
    var temp, i;

    // Process as many full blocks as possible
    while (adlen >= WAGE_RATE) {
      wageAbsorb(state, ad.slice(offset, offset + WAGE_RATE));
      state[0] ^= 0x40;
      wagePermute(state);
      offset += WAGE_RATE;
      adlen -= WAGE_RATE;
    }

    // Pad and absorb the final block
    temp = adlen;
    for (i = 0; i < temp; ++i) {
      pad[i] = ad[offset + i];
    }
    pad[temp] = 0x80;
    for (i = temp + 1; i < WAGE_RATE; ++i) {
      pad[i] = 0;
    }
    wageAbsorb(state, pad);
    state[0] ^= 0x40;
    wagePermute(state);
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class WAGEAlgorithm extends BaseAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "WAGE";
      this.description = "Lightweight authenticated encryption with associated data (AEAD) stream cipher designed for resource-constrained environments. NIST LWC Round 2 candidate using 259-bit state organized as 37 7-bit components with WGP permutation and S-box operations.";
      this.inventor = "Gaurav Bansod, Subhadeep Banik, Bing Luo, Dawei Gu, Tao Huang, Qiu Yang";
      this.year = 2019;
      this.category = CategoryType.STREAM;
      this.subCategory = "AEAD Stream Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL; // International collaboration

      // Algorithm specifications
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedNonceSizes = [
        new KeySize(16, 16, 0)  // 128-bit nonce/IV
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("NIST LWC Submission", "https://csrc.nist.gov/projects/lightweight-cryptography"),
        new LinkItem("WAGE Specification", "https://uwaterloo.ca/communications-security-lab/lwc/wage"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto"),
        new LinkItem("Design Paper", "https://eprint.iacr.org/2019/1116.pdf")
      ];

      // References
      this.references = [
        new LinkItem("Southern Storm LWC Library", "https://github.com/rweather/lightweight-crypto"),
        new LinkItem("NIST LWC Project", "https://csrc.nist.gov/projects/lightweight-cryptography"),
        new LinkItem("University of Waterloo LWC", "https://uwaterloo.ca/communications-security-lab/lwc")
      ];

      // Security assessment
      this.knownVulnerabilities = [
        new Vulnerability(
          "Ongoing Security Analysis",
          "NIST LWC Round 2 candidate undergoing continued cryptanalysis",
          "Monitor NIST LWC project for security updates and use in appropriate contexts"
        )
      ];

      // Official NIST LWC KAT test vectors
      this.tests = [
        {
          text: "NIST LWC KAT Vector 1 (Empty Message, Empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("0466697CC97CDB5604BC6F6B5CBA9014")
        },
        {
          text: "NIST LWC KAT Vector 2 (Empty Message, 1-byte AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("AFEA3A5C7C215D819F028FC060E0B010")
        },
        {
          text: "NIST LWC KAT Vector 34 (1-byte Message, Empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("A4C7F41212EE54FFC71DEE47E69DCD01E5")
        },
        {
          text: "NIST LWC KAT Vector 35 (1-byte Message, 1-byte AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("9C09707BB8EDBA95AFE9C26F607C3B6B2D")
        },
        {
          text: "NIST LWC KAT Vector 9 (Empty Message, 8-byte AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("4B4819C8CF89D87E90E1DC6AD863193C")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new WAGEInstance(this, isInverse);
    }
  }

  // ===== INSTANCE IMPLEMENTATION =====

  class WAGEInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._aad = [];
      this.inputBuffer = [];
      this.state = null;
    }

    // Property setters with validation
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (expected 16)");
      }

      this._key = keyBytes.slice();
    }

    get key() {
      return this._key ? this._key.slice() : null;
    }

    set iv(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 16) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (expected 16)");
      }

      this._nonce = nonceBytes.slice();
    }

    get iv() {
      return this._nonce ? this._nonce.slice() : null;
    }

    set aad(aadBytes) {
      this._aad = aadBytes ? aadBytes.slice() : [];
    }

    get aad() {
      return this._aad.slice();
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push.apply(this.inputBuffer, data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      // Initialize state
      this.state = new Array(WAGE_STATE_SIZE);
      var i;
      for (i = 0; i < WAGE_STATE_SIZE; ++i) {
        this.state[i] = 0;
      }
      wageInit(this.state, this._key, this._nonce);

      // Process associated data if present
      if (this._aad && this._aad.length > 0) {
        wageProcessAd(this.state, this._aad);
      }

      var output = [];
      var mlen = this.inputBuffer.length;
      var offset = 0;
      var block = new Array(WAGE_RATE);
      var temp;

      if (this.isInverse) {
        // Decryption mode
        // Ciphertext includes tag at end
        if (mlen < 16) {
          throw new Error("Ciphertext too short (must include 16-byte tag)");
        }

        var clen = mlen - 16;
        var tagPos = clen;

        // Decrypt ciphertext blocks
        while (clen >= WAGE_RATE) {
          wageGetRate(this.state, block);
          for (i = 0; i < WAGE_RATE; ++i) {
            block[i] ^= this.inputBuffer[offset + i];
          }
          wageSetRate(this.state, this.inputBuffer.slice(offset, offset + WAGE_RATE));
          this.state[0] ^= 0x20;
          wagePermute(this.state);
          for (i = 0; i < WAGE_RATE; ++i) {
            output.push(block[i]);
          }
          offset += WAGE_RATE;
          clen -= WAGE_RATE;
        }

        // Handle final partial block
        temp = clen;
        wageGetRate(this.state, block);
        for (i = 0; i < temp; ++i) {
          block[WAGE_RATE + i] = block[i] ^ this.inputBuffer[offset + i];
          block[i] = this.inputBuffer[offset + i];
        }
        block[temp] ^= 0x80;
        wageSetRate(this.state, block);
        this.state[0] ^= 0x20;
        wagePermute(this.state);
        for (i = 0; i < temp; ++i) {
          output.push(block[WAGE_RATE + i]);
        }

        // Generate and verify tag
        wageAbsorbKey(this.state, this._key);
        var computedTag = new Array(16);
        wageExtractTag(this.state, computedTag);

        // Constant-time tag comparison
        var diff = 0;
        for (i = 0; i < 16; ++i) {
          diff |= computedTag[i] ^ this.inputBuffer[tagPos + i];
        }

        if (diff !== 0) {
          // Clear output on authentication failure
          OpCodes.ClearArray(output);
          throw new Error("Authentication tag verification failed");
        }
      } else {
        // Encryption mode
        // Encrypt plaintext blocks
        while (mlen >= WAGE_RATE) {
          wageGetRate(this.state, block);
          for (i = 0; i < WAGE_RATE; ++i) {
            block[i] ^= this.inputBuffer[offset + i];
          }
          wageSetRate(this.state, block);
          this.state[0] ^= 0x20;
          wagePermute(this.state);
          for (i = 0; i < WAGE_RATE; ++i) {
            output.push(block[i]);
          }
          offset += WAGE_RATE;
          mlen -= WAGE_RATE;
        }

        // Handle final partial block
        temp = mlen;
        wageGetRate(this.state, block);
        for (i = 0; i < temp; ++i) {
          block[i] ^= this.inputBuffer[offset + i];
        }
        block[temp] ^= 0x80;
        wageSetRate(this.state, block);
        this.state[0] ^= 0x20;
        wagePermute(this.state);
        for (i = 0; i < temp; ++i) {
          output.push(block[i]);
        }

        // Generate and append authentication tag
        wageAbsorbKey(this.state, this._key);
        var tag = new Array(16);
        wageExtractTag(this.state, tag);
        for (i = 0; i < 16; ++i) {
          output.push(tag[i]);
        }
      }

      // Clear state and input buffer
      this.inputBuffer = [];
      OpCodes.ClearArray(this.state);

      return output;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new WAGEAlgorithm());

  return WAGEAlgorithm;
}));
