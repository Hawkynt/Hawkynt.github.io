/*
 * Panama Stream Cipher Implementation
 *
 * Designed by Joan Daemen and Craig Clapp (1998)
 * Published at FSE'98
 *
 * This implementation follows the reference C implementation (panama_x.c) for clarity.
 * The Crypto++ implementation uses SSE2 optimizations that obscure the algorithm logic.
 *
 * Algorithm Characteristics:
 * - 256-bit (32-byte) key
 * - 256-bit (32-byte) initialization vector (IV)
 * - 17 × 32-bit state words (544 bits)
 * - 32 stages × 8 words = 256 × 32-bit buffer (8192 bits)
 * - Two endianness variants: Panama-LE (little-endian) and Panama-BE (big-endian)
 *
 * Security: Hash function has known collision attacks. Stream cipher remains unbroken
 * but Panama is considered deprecated for modern cryptographic applications.
 *
 * Reference: panama_x.c reference implementation
 * Test Vectors: Crypto++ TestVectors/panama.txt
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  // Load dependencies
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }

  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  const OpCodes = global.OpCodes;

  // Panama constants (from reference implementation)
  const PAN_STAGE_SIZE = 8;      // 8 words per stage
  const PAN_STAGES = 32;          // 32 stages in LFSR buffer
  const PAN_STATE_SIZE = 17;      // 17-word state machine

  /**
   * Panama Stream Cipher - Base class for both endianness variants
   */
  class PanamaStreamCipher extends StreamCipherAlgorithm {
    constructor(isLittleEndian) {
      super();

      this.isLittleEndian = isLittleEndian;
      this.name = isLittleEndian ? "Panama-LE" : "Panama-BE";
      this.description = "Stream cipher and hash function designed by Joan Daemen and Craig Clapp using 17-word state and 32-stage LFSR buffer. " +
                        (isLittleEndian ? "Little-endian variant." : "Big-endian variant.") + " " +
                        "Hash function has known collision attacks but stream cipher remains cryptanalytically sound.";
      this.inventor = "Joan Daemen, Craig Clapp";
      this.year = 1998;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(32, 32, 1)];
      this.SupportedIVSizes = [new KeySize(32, 32, 1)];

      this.documentation = [
        new LinkItem("Panama Specification (FSE'98)", "https://link.springer.com/chapter/10.1007/3-540-69710-1_5"),
        new LinkItem("Crypto++ Panama Implementation", "https://github.com/weidai11/cryptopp/blob/master/panama.cpp")
      ];

      this.knownVulnerabilities = [
        {
          type: 'Hash Collision Attack',
          text: 'Panama hash function has known collision attacks discovered in 2001. However, the stream cipher mode remains cryptographically sound with no known practical attacks.',
          mitigation: 'Use only for educational purposes or legacy system compatibility. For production use, employ modern authenticated encryption like AES-GCM or ChaCha20-Poly1305.'
        }
      ];

      // Crypto++ test vectors from TestVectors/panama.txt (lines 65-76)
      this.tests = [];

      if (isLittleEndian) {
        this.tests.push({
          text: "Crypto++ Panama-LE Test Vector",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("F07F5FF2CCD01A0A7D44ACD6D239C2AF0DA1FF35275BAF5DFA6E09411B79D8B9")
        });
      } else {
        this.tests.push({
          text: "Crypto++ Panama-BE Test Vector",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("E12E2F6BA41AE832D888DA9FA6863BC37C0E996F190A1711330322D37BD98CA4")
        });
      }
    }

    CreateInstance(isInverse = false) {
      return new PanamaStreamCipherInstance(this, this.isLittleEndian);
    }
  }

  /**
   * Panama Stream Cipher Instance - Implements Feed/Result pattern
   * Follows reference C implementation (panama_x.c) structure
   */
  class PanamaStreamCipherInstance extends IAlgorithmInstance {
    constructor(algorithm, isLittleEndian) {
      super(algorithm);
      this.isLittleEndian = isLittleEndian;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // Panama state
      this.state = new Array(PAN_STATE_SIZE).fill(0);  // 17 words
      this.buffer = [];  // 32 stages, each with 8 words
      for (let i = 0; i < PAN_STAGES; i++) {
        this.buffer[i] = new Array(PAN_STAGE_SIZE).fill(0);
      }
      this.tap_0 = 0;  // Buffer tap position
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 32) {
        throw new Error("Panama requires exactly 32-byte (256-bit) key");
      }

      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        return;
      }

      if (ivBytes.length !== 32) {
        throw new Error("Panama requires exactly 32-byte (256-bit) IV");
      }

      this._iv = [...ivBytes];
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    /**
     * Convert bytes to 32-bit words based on endianness
     */
    _bytesToWords(bytes) {
      const words = [];
      for (let i = 0; i < bytes.length; i += 4) {
        if (this.isLittleEndian) {
          words.push(OpCodes.Pack32LE(bytes[i] || 0, bytes[i+1] || 0, bytes[i+2] || 0, bytes[i+3] || 0));
        } else {
          words.push(OpCodes.Pack32BE(bytes[i] || 0, bytes[i+1] || 0, bytes[i+2] || 0, bytes[i+3] || 0));
        }
      }
      return words;
    }

    /**
     * Convert 32-bit words to bytes based on endianness
     */
    _wordsToBytes(words) {
      const bytes = [];
      for (let i = 0; i < words.length; i++) {
        const unpacked = this.isLittleEndian ?
          OpCodes.Unpack32LE(words[i]) :
          OpCodes.Unpack32BE(words[i]);
        bytes.push(...unpacked);
      }
      return bytes;
    }

    /**
     * Reset Panama state (equivalent to pan_reset)
     */
    _pan_reset() {
      this.tap_0 = 0;

      for (let j = 0; j < PAN_STAGES; j++) {
        for (let i = 0; i < PAN_STAGE_SIZE; i++) {
          this.buffer[j][i] = 0;
        }
      }

      for (let i = 0; i < PAN_STATE_SIZE; i++) {
        this.state[i] = 0;
      }
    }

    /**
     * Panama push operation (based on pan_push from panama_x.c)
     * @param {Array} inputWords - 8 input words
     */
    _pan_push(inputWords) {
      // Ensure exactly 8 words
      while (inputWords.length < PAN_STAGE_SIZE) {
        inputWords.push(0);
      }

      // Copy state to local variables
      const s = [...this.state];

      // GAMMA transformation: gamma[i] = state[i] ^ (state[i+1] | ~state[i+2])
      const gamma = new Array(PAN_STATE_SIZE);
      for (let i = 0; i < PAN_STATE_SIZE; i++) {
        const i1 = (i + 1) % PAN_STATE_SIZE;
        const i2 = (i + 2) % PAN_STATE_SIZE;
        gamma[i] = (s[i] ^ (s[i1] | (~s[i2]))) >>> 0;
      }

      // PI transformation: Permute and rotate
      // Permutation and rotation schedule from panama_x.c lines 132-153
      const pi = new Array(PAN_STATE_SIZE);
      const perm = [0, 7, 14, 4, 11, 1, 8, 15, 5, 12, 2, 9, 16, 6, 13, 3, 10];
      const rots = [0, 1, 3, 6, 10, 15, 21, 28, 4, 13, 23, 2, 14, 27, 9, 24, 8];

      for (let i = 0; i < PAN_STATE_SIZE; i++) {
        pi[i] = OpCodes.RotL32(gamma[perm[i]], rots[i]);
      }

      // THETA transformation: theta[i] = pi[i] ^ pi[i+1] ^ pi[i+4]
      const theta = new Array(PAN_STATE_SIZE);
      for (let i = 0; i < PAN_STATE_SIZE; i++) {
        const i1 = (i + 1) % PAN_STATE_SIZE;
        const i4 = (i + 4) % PAN_STATE_SIZE;
        theta[i] = (pi[i] ^ pi[i1] ^ pi[i4]) >>> 0;
      }

      // Calculate buffer tap positions BEFORE moving tap_0
      // NOTE: In push mode, we DON'T use tap 4 (L) - we use inputWords instead!
      // See panama_x.c line 420: L = (PAN_STAGE*)In;
      const b_idx = (this.tap_0 + 16) & (PAN_STAGES - 1);

      // Move tap_0 left by one stage (LFSR shifts right)
      this.tap_0 = (this.tap_0 - 1) & (PAN_STAGES - 1);

      // Calculate lambda tap positions with NEW tap_0
      const tap_0_idx = this.tap_0;
      const tap_25_idx = (this.tap_0 + 25) & (PAN_STAGES - 1);

      // LAMBDA transformation: Update LFSR buffer
      // tap_25[i] ^= tap_0[(i+2) & 7]
      for (let i = 0; i < PAN_STAGE_SIZE; i++) {
        const j = (i + 2) & (PAN_STAGE_SIZE - 1);
        this.buffer[tap_25_idx][i] = (this.buffer[tap_25_idx][i] ^ this.buffer[tap_0_idx][j]) >>> 0;
      }

      // tap_0[i] ^= inputWords[i]
      for (let i = 0; i < PAN_STAGE_SIZE; i++) {
        this.buffer[tap_0_idx][i] = (this.buffer[tap_0_idx][i] ^ inputWords[i]) >>> 0;
      }

      // SIGMA transformation: Merge buffer with state
      // CRITICAL: In push mode, state[1..8] uses INPUT WORDS, not tap 4!
      // See panama_x.c lines 420, 254-261 (LAMBDA_0_PUSH uses L which is input)
      // state[0] ^= 1
      this.state[0] = (theta[0] ^ 1) >>> 0;

      // state[1..8] ^= inputWords[0..7] (NOT tap 4!)
      for (let i = 1; i <= 8; i++) {
        this.state[i] = (theta[i] ^ inputWords[i - 1]) >>> 0;
      }

      // state[9..16] ^= b[0..7]
      for (let i = 9; i <= 16; i++) {
        this.state[i] = (theta[i] ^ this.buffer[b_idx][i - 9]) >>> 0;
      }
    }

    /**
     * Panama pull operation (based on pan_pull from panama_x.c)
     * @param {Array|null} inputWords - 8 input words, or null for blank pull
     * @returns {Array} 8 output words
     */
    _pan_pull(inputWords) {
      // Output is state[9..16] XOR input (if provided)
      const output = new Array(PAN_STAGE_SIZE);
      if (inputWords) {
        for (let i = 0; i < PAN_STAGE_SIZE; i++) {
          output[i] = (this.state[i + 9] ^ inputWords[i]) >>> 0;
        }
      } else {
        for (let i = 0; i < PAN_STAGE_SIZE; i++) {
          output[i] = this.state[i + 9];
        }
      }

      // Copy state to local variables
      const s = [...this.state];

      // GAMMA transformation
      const gamma = new Array(PAN_STATE_SIZE);
      for (let i = 0; i < PAN_STATE_SIZE; i++) {
        const i1 = (i + 1) % PAN_STATE_SIZE;
        const i2 = (i + 2) % PAN_STATE_SIZE;
        gamma[i] = (s[i] ^ (s[i1] | (~s[i2]))) >>> 0;
      }

      // PI transformation
      const pi = new Array(PAN_STATE_SIZE);
      const perm = [0, 7, 14, 4, 11, 1, 8, 15, 5, 12, 2, 9, 16, 6, 13, 3, 10];
      const rots = [0, 1, 3, 6, 10, 15, 21, 28, 4, 13, 23, 2, 14, 27, 9, 24, 8];

      for (let i = 0; i < PAN_STATE_SIZE; i++) {
        pi[i] = OpCodes.RotL32(gamma[perm[i]], rots[i]);
      }

      // THETA transformation
      const theta = new Array(PAN_STATE_SIZE);
      for (let i = 0; i < PAN_STATE_SIZE; i++) {
        const i1 = (i + 1) % PAN_STATE_SIZE;
        const i4 = (i + 4) % PAN_STATE_SIZE;
        theta[i] = (pi[i] ^ pi[i1] ^ pi[i4]) >>> 0;
      }

      // Calculate buffer tap positions BEFORE moving tap_0
      const L_idx = (this.tap_0 + 4) & (PAN_STAGES - 1);
      const b_idx = (this.tap_0 + 16) & (PAN_STAGES - 1);

      // Move tap_0 left by one stage
      this.tap_0 = (this.tap_0 - 1) & (PAN_STAGES - 1);

      // Calculate lambda tap positions with NEW tap_0
      const tap_0_idx = this.tap_0;
      const tap_25_idx = (this.tap_0 + 25) & (PAN_STAGES - 1);

      // LAMBDA transformation
      // tap_25[i] ^= tap_0[(i+2) & 7]
      for (let i = 0; i < PAN_STAGE_SIZE; i++) {
        const j = (i + 2) & (PAN_STAGE_SIZE - 1);
        this.buffer[tap_25_idx][i] = (this.buffer[tap_25_idx][i] ^ this.buffer[tap_0_idx][j]) >>> 0;
      }

      // tap_0[i] ^= state[i+1]
      for (let i = 0; i < PAN_STAGE_SIZE; i++) {
        this.buffer[tap_0_idx][i] = (this.buffer[tap_0_idx][i] ^ s[i + 1]) >>> 0;
      }

      // SIGMA transformation
      this.state[0] = (theta[0] ^ 1) >>> 0;

      for (let i = 1; i <= 8; i++) {
        this.state[i] = (theta[i] ^ this.buffer[L_idx][i - 1]) >>> 0;
      }

      for (let i = 9; i <= 16; i++) {
        this.state[i] = (theta[i] ^ this.buffer[b_idx][i - 9]) >>> 0;
      }

      return output;
    }

    /**
     * Initialize Panama for encryption/decryption
     * Based on pan_crypt from panama.h
     */
    _initialize() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Reset state and buffer
      this._pan_reset();

      // Convert key and IV to words
      const keyWords = this._bytesToWords(this._key);
      const ivWords = this._iv ? this._bytesToWords(this._iv) : new Array(PAN_STAGE_SIZE).fill(0);

      // Push key
      this._pan_push(keyWords);

      // Push IV
      this._pan_push(ivWords);

      // 32 blank pulls
      for (let i = 0; i < 32; i++) {
        this._pan_pull(null);
      }
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      // Initialize Panama
      this._initialize();

      const inputLength = this.inputBuffer.length;
      const output = [];

      // Process in 32-byte (8-word) blocks
      let offset = 0;
      while (offset < inputLength) {
        const blockSize = Math.min(32, inputLength - offset);
        const block = this.inputBuffer.slice(offset, offset + blockSize);

        // Pad to 32 bytes if needed
        while (block.length < 32) {
          block.push(0);
        }

        const inputWords = this._bytesToWords(block);
        const outputWords = this._pan_pull(inputWords);
        const outputBytes = this._wordsToBytes(outputWords);

        // Only take the bytes we actually need
        const bytesToTake = Math.min(32, inputLength - offset);
        output.push(...outputBytes.slice(0, bytesToTake));

        offset += blockSize;
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }
  }

  // Register both variants
  RegisterAlgorithm(new PanamaStreamCipher(true));   // Panama-LE
  RegisterAlgorithm(new PanamaStreamCipher(false));  // Panama-BE

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PanamaStreamCipher, PanamaStreamCipherInstance };
  }

})(typeof global !== 'undefined' ? global : window);
