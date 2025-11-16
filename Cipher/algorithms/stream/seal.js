/*
 * SEAL 3.0 (Software-optimized Encryption ALgorithm) Stream Cipher
 *
 * Designed by Phil Rogaway and Don Coppersmith (1994)
 * Published at FSE'94
 *
 * Algorithm Overview:
 * - 160-bit (20-byte) key
 * - 32-bit (4-byte) IV
 * - Uses SHA-1 to generate internal tables
 * - Generates 1024 bytes (256 words) of keystream per iteration
 * - Two variants: SEAL-3.0-BE (big-endian) and SEAL-3.0-LE (little-endian)
 *
 * Security: Broken - theoretical attacks exist, not recommended for new systems
 * Use for compatibility with legacy systems only.
 *
 * Reference: Crypto++ seal.cpp by Wei Dai and Leonard Janke
 * Test Vectors: Crypto++ TestVectors/seal.txt
 * (c)2025 Hawkynt
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  const OpCodes = global.OpCodes;

  // ===== SEAL IMPLEMENTATION =====

  /**
   * SEAL Stream Cipher - Base class for both endianness variants
   */
  class SEALStreamCipher extends StreamCipherAlgorithm {
    constructor(isBigEndian) {
      super();

      this.isBigEndian = isBigEndian;
      this.name = isBigEndian ? "SEAL-3.0-BE" : "SEAL-3.0-LE";
      this.description = "Software-optimized stream cipher designed by Rogaway and Coppersmith using SHA-1-based table generation. " +
                        "Generates 1024 bytes of keystream per iteration. " +
                        (isBigEndian ? "Big-endian variant." : "Little-endian variant.") + " " +
                        "Broken - theoretical attacks exist.";
      this.inventor = "Phil Rogaway, Don Coppersmith";
      this.year = 1994;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedKeySizes = [new KeySize(20, 20, 1)]; // 160-bit key
      this.SupportedIVSizes = [new KeySize(4, 4, 1)];    // 32-bit IV

      this.documentation = [
        new LinkItem("SEAL Specification (FSE'94)", "https://web.cs.ucdavis.edu/~rogaway/papers/seal.pdf"),
        new LinkItem("Crypto++ SEAL Implementation", "https://github.com/weidai11/cryptopp/blob/master/seal.cpp")
      ];

      this.knownVulnerabilities = [
        {
          type: 'Theoretical Attack',
          text: 'SEAL has known theoretical weaknesses and is considered broken for modern cryptographic applications.',
          mitigation: 'Use modern stream ciphers like ChaCha20 or XSalsa20 for new systems.'
        }
      ];

      // Crypto++ test vector from TestVectors/seal.txt
      if (isBigEndian) {
        this.tests = [
          {
            text: "Crypto++ SEAL-3.0-BE Test Vector",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/seal.txt",
            input: new Array(1024).fill(0x00),
            key: OpCodes.Hex8ToBytes("67452301efcdab8998badcfe10325476c3d2e1f0"),
            iv: OpCodes.Hex8ToBytes("013577af"),
            expected: OpCodes.Hex8ToBytes(
              "37a005959b84c49ca4be1e050673530f5fb097fdf6a13fbd6c2cdecd81fdee7c" +
              "2abdc3e764209aff00a12283ef675085c1634b53289059e6a7ab5ed9480c01eb" +
              "4c64569a8dce2a23feed0ef58f6f5ac3f74145127dbcaec4bcb6b1a459bdc287" +
              "58ba0523f721c3e154433dc7353f02ef487b07ad309ef5e44e6cc19026f5fd57" +
              "07cc32ec12b9c01fe0c58beb2fe73ea79e24093f05911663a76b21beab18cede" +
              "17275c54d18fcd3e4cf32279347b22f8751119fb56d92f55d511e4ecc1334085" +
              "e74934455a2daec3f1821c54b4cb809053b8d837de4186600afedf8bd72dd56e" +
              "223745c19f76edba01e9b5346666d01f677fbd68fa5010fd7db8b06829a90da0" +
              "e81b84756a70946a6c05e16d225a2e11af586bb1c5b1d21f5349f8e5e3ee41f4" +
              "232d554954d1bc86064754b86c1dc92d7a9de30086d8eb4a7c86db9c380f13b9" +
              "52e11c5b89f1be0a6b52c6e7a053da7359c5fd7f50c70232d86aff08c5ff1746" +
              "d3bd074d79ad6fc657e0cbbe5d02c4fce55d3c31fef4642ed738f751430f2f1c" +
              "f6e453ef6edeb9540cec52c697d4864201e141e06c3ddf5aaa64a1a984247e96" +
              "d2cf1e7fb2bc239919369f4a0bf9d111d0d8be64afae86214d5f62e64f25e8f1" +
              "3e12680ec170ad6234cbbda938df53cc17a12afea1eb4005122a65cb42bedb76" +
              "edf029db910fc81b81f3dd28341fed4064ce37648548e5852d4aebb7923016f9" +
              "afcb07ae7bc11800e217a0062f0b53ffa8d471aa78ca6a13b7f5647189106773" +
              "0a311d6fe4ff57f05f9a58aa742696b6cbb3ec539da0c2aadd6a60d2a33c26d5" +
              "8a343448ed912aafb98568c6ae1cb1efaeafd81a6e3e7c450f8e2be4c6cc18f9" +
              "5e8a1c6c59190a2798e912a614c1e7d0f7e74b1baf8e5682f5442f998b24fa86" +
              "d1e5f673002e2c92db8ebf7abb1c9d267a9763f4bd54f7bbf07c4466dac0bf3f" +
              "faf5666a43a52f0812e76df5f9d4da8ed1bc6d4ab29b34718facb4bebc11e907" +
              "fe9b0e3937de7769fc5b0cc52b3e50d57e02b9b4022949aaf3698bc58f696073" +
              "ec972a425caee9700864d3d166130ee09d51320b9d51bc9b4aa575c789786242" +
              "0698d9e1f6426fd141a32c9f55c24e5149e274983035ac1c44833b0179aed63e" +
              "a2b2b61afa54700155e55c7c343412584f7b0fe73d63c5ad88718dde3000ac1d" +
              "b4050ae2610032e6b389eec48952a1a2ed0016e525ccd9616706caba89ed07d5" +
              "4f15ecfaabbc91b7c82c5904bc0f83d44888997faa11fe8fa7333cb8c5b16e31" +
              "52233c80fbc9f71d9ee8fefa50d67a7e45b93d3469ba4078bb1ed5859e7a8e62" +
              "b26bacf538507fa6bd43e18d67d7aaf27baaa68d233ca392ce33e257d5ddf3fa" +
              "ef6a951430d686f65ee9afaf6aee0677b41098922b41fba202ef05a27d614612" +
              "5daebeb147d617c8df42dba0b91dfbf8ab5805ee9877e495881035fbb7342c24"
            )
          }
        ];
      } else {
        // LE variant - not tested in Crypto++ TestVectors/seal.txt
        this.tests = [];
      }
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SEALStreamCipherInstance(this, this.isBigEndian);
    }
  }

  /**
   * SEAL Stream Cipher Instance - Implements Feed/Result pattern
   */
  class SEALStreamCipherInstance extends IAlgorithmInstance {
    constructor(algorithm, isBigEndian) {
      super(algorithm);
      this.isBigEndian = isBigEndian;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // SEAL tables
      this.T = new Array(512).fill(0); // 512 32-bit words
      this.S = new Array(256).fill(0); // 256 32-bit words
      this.R = [];                     // Variable size

      // Counters
      this.outsideCounter = 0;
      this.insideCounter = 0;
      this.startCount = 0;
      this.iterationsPerCount = 4; // Default: 32*1024 / 8192

      // Keystream buffer
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;

      // Gamma function state
      this.gammaZ = null;
      this.lastGammaIndex = 0xffffffff; // -1 in unsigned
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

      if (keyBytes.length !== 20) {
        throw new Error("SEAL requires exactly 20-byte (160-bit) key");
      }

      this._key = [...keyBytes];
      this._keySetup();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Set initialization vector
   * @param {uint8[]|null} ivBytes - IV bytes or null to clear
   * @throws {Error} If IV size is invalid
   */

    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        return;
      }

      if (ivBytes.length !== 4) {
        throw new Error("SEAL requires exactly 4-byte (32-bit) IV");
      }

      this._iv = [...ivBytes];
      this._resynchronize();
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    /**
     * SHA-1 based Gamma function for table generation
     * Based on Crypto++ seal.cpp SEAL_Gamma::Apply()
     * Gamma(i) returns a 32-bit word derived from SHA-1
     */
    _gamma(i, H) {
      const shaIndex = Math.floor(i / 5);

      // Check if we need to perform a new SHA-1 transform
      if (shaIndex !== this.lastGammaIndex || !this.gammaZ) {
        // Copy H to Z
        this.gammaZ = [...H];

        // Create message block D with D[0] = shaIndex, rest zeros
        const D = new Array(64).fill(0);
        const shaIndexBytes = OpCodes.Unpack32BE(shaIndex);
        D[0] = shaIndexBytes[0];
        D[1] = shaIndexBytes[1];
        D[2] = shaIndexBytes[2];
        D[3] = shaIndexBytes[3];

        // Perform SHA-1 transform: Z = Transform(Z, D)
        this._sha1Transform(this.gammaZ, D);

        this.lastGammaIndex = shaIndex;
      }

      return this.gammaZ[i % 5];
    }

    /**
     * SHA-1 Transform function - processes one 512-bit block
     * Based on RFC 3174 and our sha1.js implementation
     */
    _sha1Transform(state, block) {
      const K = [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6];
      const W = new Array(80);

      // Prepare message schedule W[t]
      for (let t = 0; t < 16; t++) {
        W[t] = OpCodes.Pack32BE(block[t*4], block[t*4+1], block[t*4+2], block[t*4+3]);
      }

      // Extend the sixteen 32-bit words into eighty 32-bit words
      for (let t = 16; t < 80; t++) {
        W[t] = OpCodes.RotL32(W[t-3] ^ W[t-8] ^ W[t-14] ^ W[t-16], 1);
      }

      // Initialize working variables
      let a = state[0], b = state[1], c = state[2], d = state[3], e = state[4];

      // Main loop (80 rounds)
      for (let t = 0; t < 80; t++) {
        let f, k;

        if (t < 20) {
          f = (b & c) | ((~b) & d);
          k = K[0];
        } else if (t < 40) {
          f = b ^ c ^ d;
          k = K[1];
        } else if (t < 60) {
          f = (b & c) | (b & d) | (c & d);
          k = K[2];
        } else {
          f = b ^ c ^ d;
          k = K[3];
        }

        const temp = (OpCodes.RotL32(a, 5) + f + e + k + W[t]) >>> 0;
        e = d;
        d = c;
        c = OpCodes.RotL32(b, 30);
        b = a;
        a = temp;
      }

      // Add working variables to state
      state[0] = (state[0] + a) >>> 0;
      state[1] = (state[1] + b) >>> 0;
      state[2] = (state[2] + c) >>> 0;
      state[3] = (state[3] + d) >>> 0;
      state[4] = (state[4] + e) >>> 0;
    }

    /**
     * SEAL key setup - generates T, S, and R tables
     */
    _keySetup() {
      if (!this._key) return;

      // Initialize H from key (5 32-bit words = 20 bytes)
      const H = [];
      for (let i = 0; i < 5; i++) {
        const offset = i * 4;
        H.push(OpCodes.Pack32BE(
          this._key[offset],
          this._key[offset + 1],
          this._key[offset + 2],
          this._key[offset + 3]
        ));
      }

      // Generate T table (512 words from Gamma(0..511))
      for (let i = 0; i < 512; i++) {
        this.T[i] = this._gamma(i, H);
      }

      // Generate S table (256 words from Gamma(0x1000..0x10FF))
      for (let i = 0; i < 256; i++) {
        this.S[i] = this._gamma(0x1000 + i, H);
      }

      // Generate R table (4 * iterationsPerCount words)
      const L = 32 * 1024; // Default bits per position
      this.iterationsPerCount = Math.floor(L / 8192);
      this.R = [];
      for (let i = 0; i < 4 * this.iterationsPerCount; i++) {
        this.R.push(this._gamma(0x2000 + i, H));
      }
    }

    /**
     * Resynchronize with IV (becomes outsideCounter)
     */
    _resynchronize() {
      if (!this._iv) {
        this.outsideCounter = 0;
      } else {
        this.outsideCounter = OpCodes.Pack32BE(
          this._iv[0],
          this._iv[1],
          this._iv[2],
          this._iv[3]
        );
      }
      this.startCount = this.outsideCounter;
      this.insideCounter = 0;

      // Reset keystream buffer
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
    }

    /**
     * Generate 1024 bytes (256 words) of keystream
     */
    _generateKeystream() {
      let a = this.outsideCounter ^ this.R[4 * this.insideCounter];
      let b = OpCodes.RotR32(this.outsideCounter, 8) ^ this.R[4 * this.insideCounter + 1];
      let c = OpCodes.RotR32(this.outsideCounter, 16) ^ this.R[4 * this.insideCounter + 2];
      let d = OpCodes.RotR32(this.outsideCounter, 24) ^ this.R[4 * this.insideCounter + 3];

      // Two rounds of Feistel-like mixing
      for (let j = 0; j < 2; j++) {
        let p = a & 0x7fc;
        b = OpCodes.Add32(b, this.T[p >>> 2]);
        a = OpCodes.RotR32(a, 9);

        p = b & 0x7fc;
        c = OpCodes.Add32(c, this.T[p >>> 2]);
        b = OpCodes.RotR32(b, 9);

        p = c & 0x7fc;
        d = OpCodes.Add32(d, this.T[p >>> 2]);
        c = OpCodes.RotR32(c, 9);

        p = d & 0x7fc;
        a = OpCodes.Add32(a, this.T[p >>> 2]);
        d = OpCodes.RotR32(d, 9);
      }

      // Save intermediate values
      const n1 = d, n2 = b, n3 = a, n4 = c;

      // One more round
      let p = a & 0x7fc;
      b = OpCodes.Add32(b, this.T[p >>> 2]);
      a = OpCodes.RotR32(a, 9);

      p = b & 0x7fc;
      c = OpCodes.Add32(c, this.T[p >>> 2]);
      b = OpCodes.RotR32(b, 9);

      p = c & 0x7fc;
      d = OpCodes.Add32(d, this.T[p >>> 2]);
      c = OpCodes.RotR32(c, 9);

      p = d & 0x7fc;
      a = OpCodes.Add32(a, this.T[p >>> 2]);
      d = OpCodes.RotR32(d, 9);

      // Generate 8192 bits (1024 bytes) of keystream
      const output = [];
      for (let i = 0; i < 64; i++) {
        p = a & 0x7fc;
        a = OpCodes.RotR32(a, 9);
        b = OpCodes.Add32(b, this.T[p >>> 2]);
        b ^= a;

        let q = b & 0x7fc;
        b = OpCodes.RotR32(b, 9);
        c ^= this.T[q >>> 2];
        c = OpCodes.Add32(c, b);

        p = (p + c) & 0x7fc;
        c = OpCodes.RotR32(c, 9);
        d = OpCodes.Add32(d, this.T[p >>> 2]);
        d ^= c;

        q = (q + d) & 0x7fc;
        d = OpCodes.RotR32(d, 9);
        a ^= this.T[q >>> 2];
        a = OpCodes.Add32(a, d);

        p = (p + a) & 0x7fc;
        b ^= this.T[p >>> 2];
        a = OpCodes.RotR32(a, 9);

        q = (q + b) & 0x7fc;
        c = OpCodes.Add32(c, this.T[q >>> 2]);
        b = OpCodes.RotR32(b, 9);

        p = (p + c) & 0x7fc;
        d ^= this.T[p >>> 2];
        c = OpCodes.RotR32(c, 9);

        q = (q + d) & 0x7fc;
        d = OpCodes.RotR32(d, 9);
        a = OpCodes.Add32(a, this.T[q >>> 2]);

        // Output 4 words with S-box mixing
        const w1 = OpCodes.Add32(b, this.S[4 * i + 0]);
        const w2 = c ^ this.S[4 * i + 1];
        const w3 = OpCodes.Add32(d, this.S[4 * i + 2]);
        const w4 = a ^ this.S[4 * i + 3];

        // Convert to bytes based on endianness
        if (this.isBigEndian) {
          output.push(...OpCodes.Unpack32BE(w1));
          output.push(...OpCodes.Unpack32BE(w2));
          output.push(...OpCodes.Unpack32BE(w3));
          output.push(...OpCodes.Unpack32BE(w4));
        } else {
          output.push(...OpCodes.Unpack32LE(w1));
          output.push(...OpCodes.Unpack32LE(w2));
          output.push(...OpCodes.Unpack32LE(w3));
          output.push(...OpCodes.Unpack32LE(w4));
        }

        // Mix in saved values (alternating pattern)
        if (i & 1) {
          a = OpCodes.Add32(a, n3);
          b = OpCodes.Add32(b, n4);
          c ^= n3;
          d ^= n4;
        } else {
          a = OpCodes.Add32(a, n1);
          b = OpCodes.Add32(b, n2);
          c ^= n1;
          d ^= n2;
        }
      }

      // Update counters
      if (++this.insideCounter === this.iterationsPerCount) {
        this.outsideCounter = (this.outsideCounter + 1) >>> 0;
        this.insideCounter = 0;
      }

      return output;
    }

    _getNextKeystreamByte() {
      if (this.keystreamPosition >= this.keystreamBuffer.length) {
        this.keystreamBuffer = this._generateKeystream();
        this.keystreamPosition = 0;
      }

      return this.keystreamBuffer[this.keystreamPosition++];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */
    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Initialize if not done
      if (this._iv === null) {
        this._resynchronize();
      }

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._getNextKeystreamByte();
        output.push(this.inputBuffer[i] ^ keystreamByte);
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // ===== REGISTRATION =====

  RegisterAlgorithm(new SEALStreamCipher(true));   // SEAL-3.0-BE
  RegisterAlgorithm(new SEALStreamCipher(false));  // SEAL-3.0-LE

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SEALStreamCipher, SEALStreamCipherInstance };
  }

})(typeof global !== 'undefined' ? global : window);
