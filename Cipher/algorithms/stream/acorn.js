/*
 * ACORN-128 - Production-Grade AEAD Stream Cipher
 * CAESAR Competition Winner (Lightweight Category)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ACORN-128 is a high-performance authenticated encryption with associated data (AEAD)
 * algorithm designed for lightweight applications. Selected as CAESAR competition
 * finalist with excellent security analysis and performance characteristics.
 *
 * SECURITY STATUS: SECURE - CAESAR competition winner, extensively analyzed
 * SUITABLE FOR: Production cryptographic applications, IoT devices, constrained environments
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

  // ===== ACORN-128 CONSTANTS =====

  const CA_ONE_WORD = 0xFFFFFFFF;
  const CA_ZERO_WORD = 0x00000000;
  const CB_ONE_WORD = 0xFFFFFFFF;
  const CB_ZERO_WORD = 0x00000000;
  const CA_ONE_BYTE = 0xFF;
  const CA_ZERO_BYTE = 0x00;
  const CB_ONE_BYTE = 0xFF;
  const CB_ZERO_BYTE = 0x00;

  const S1_HIGH_MASK = 0x1FFFFFFF;
  const S2_HIGH_MASK = 0x00003FFF;
  const S3_HIGH_MASK = 0x00007FFF;
  const S4_HIGH_MASK = 0x0000007F;
  const S5_HIGH_MASK = 0x0000001F;
  const S6_HIGH_MASK = 0x07FFFFFF;

  // ===== ALGORITHM IMPLEMENTATION =====

  class ACORNAlgorithm extends BaseAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ACORN-128";
      this.description = "Production-grade authenticated encryption with associated data (AEAD) stream cipher. CAESAR competition winner for lightweight cryptography with 128-bit security and efficient implementation.";
      this.inventor = "Hongjun Wu, Tao Huang, Phuong Pham, Steven Sim";
      this.year = 2016;
      this.category = CategoryType.STREAM;
      this.subCategory = "AEAD Stream Cipher";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.SG; // Singapore

      // Algorithm specifications
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedNonceSizes = [
        new KeySize(16, 16, 0)  // 128-bit nonce/IV
      ];
      this.SupportedTagSizes = [
        new KeySize(8, 16, 1)   // 64-128 bit tags (16 bytes recommended)
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("CAESAR Competition Specification v3", "https://competitions.cr.yp.to/round3/acornv3.pdf"),
        new LinkItem("CAESAR Competition Results", "https://competitions.cr.yp.to/caesar-submissions.html"),
        new LinkItem("ACORN Official Website", "https://acorn-cipher.org/"),
        new LinkItem("NIST Lightweight Cryptography", "https://csrc.nist.gov/projects/lightweight-cryptography")
      ];

      // References
      this.references = [
        new LinkItem("Reference Implementation (C)", "https://github.com/hongjun-wu/ACORN-128"),
        new LinkItem("Arduino Crypto Library", "https://rweather.github.io/arduinolibs/classAcorn128.html"),
        new LinkItem("CAESAR Benchmarks", "https://bench.cr.yp.to/results-aead.html"),
        new LinkItem("Security Analysis Papers", "https://acorn-cipher.org/security.html")
      ];

      // Security assessment (CAESAR winner)
      this.knownVulnerabilities = [
        new Vulnerability(
          "Implementation Attacks",
          "Side-channel vulnerabilities in software implementations without proper countermeasures",
          "Use constant-time implementation and appropriate side-channel protection"
        ),
        new Vulnerability(
          "Weak Key Classes",
          "Very small subset of keys may have slightly reduced security margins (theoretical)",
          "Use proper random key generation - no practical impact for random keys"
        )
      ];

      // Official CAESAR competition test vectors
      this.tests = [
        {
          text: "CAESAR ACORN-128 Test Vector 1 (Empty Message)",
          uri: "https://competitions.cr.yp.to/round3/acornv3.pdf",
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("835E5317896E86B2447143C74F6FFC1E")
        },
        {
          text: "CAESAR ACORN-128 Test Vector 2 (Single Byte)",
          uri: "https://competitions.cr.yp.to/round3/acornv3.pdf",
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("01"),
          expected: OpCodes.Hex8ToBytes("2B4B60640E26F0A99DD01F93BF634997CB")
        },
        {
          text: "CAESAR ACORN-128 Test Vector 3 (AAD Only)",
          uri: "https://competitions.cr.yp.to/round3/acornv3.pdf",
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          aad: OpCodes.Hex8ToBytes("01"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("982EF7D1BBA7F89A1575297A095CD7F2")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new ACORNInstance(this, isInverse);
    }
  }

  // Production-grade ACORN-128 instance implementation
  class ACORNInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this._aad = null;
      this.inputBuffer = [];

      // ACORN-128 state (293 bits across 6 LFSRs + 4 spare bits)
      this.state = {
        s1_l: 0, s1_h: 0,
        s2_l: 0, s2_h: 0,
        s3_l: 0, s3_h: 0,
        s4_l: 0, s4_h: 0,
        s5_l: 0, s5_h: 0,
        s6_l: 0, s6_h: 0,
        s7: 0,
        authDone: 0
      };
    }

    // Property setters for production use
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid ACORN key size: ${keyBytes.length} bytes. Requires exactly 16 bytes (128 bits)`);
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

      if (!Array.isArray(ivBytes)) {
        throw new Error("Invalid IV - must be byte array");
      }

      if (ivBytes.length !== 16) {
        throw new Error(`Invalid ACORN IV size: ${ivBytes.length} bytes. Requires exactly 16 bytes (128 bits)`);
      }

      this._iv = [...ivBytes];
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    set nonce(nonceBytes) {
      this.iv = nonceBytes;
    }

    get nonce() {
      return this.iv;
    }

    set aad(aadBytes) {
      if (!aadBytes) {
        this._aad = null;
        return;
      }

      if (!Array.isArray(aadBytes)) {
        throw new Error("Invalid AAD - must be byte array");
      }

      this._aad = [...aadBytes];
    }

    get aad() {
      return this._aad ? [...this._aad] : null;
    }

    set associatedData(aadBytes) {
      this.aad = aadBytes;
    }

    get associatedData() {
      return this.aad;
    }

    // Feed data to the cipher
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }

      this.inputBuffer.push(...data);
    }

    // Get the cipher result (AEAD: ciphertext + authentication tag)
    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._iv) {
        throw new Error("IV/nonce not set");
      }

      // Initialize ACORN state
      this._resetState();
      this._initializeState(this._key, this._iv);

      const aadBytes = this._aad || [];
      const inputBytes = this.inputBuffer || [];

      if (this.isInverse) {
        // Decryption + authentication verification
        if (inputBytes.length < 16) {
          throw new Error("Input too short for authentication tag (minimum 16 bytes)");
        }

        const ciphertext = inputBytes.slice(0, -16);
        const expectedTag = inputBytes.slice(-16);

        // Process AAD
        this._absorbAAD(aadBytes);

        // Decrypt
        const plaintext = this._decryptBytes(ciphertext);

        // Verify authentication tag
        const computedTag = this._finalizeTag();
        if (!OpCodes.SecureCompare(computedTag, expectedTag)) {
          throw new Error("Authentication tag verification failed - message integrity compromised");
        }

        this.inputBuffer = [];
        return plaintext;
      } else {
        // Encryption + authentication tag generation

        // Process AAD
        this._absorbAAD(aadBytes);

        // Encrypt
        const ciphertext = this._encryptBytes(inputBytes);

        // Generate authentication tag
        const tag = this._finalizeTag();

        // Return ciphertext + tag
        this.inputBuffer = [];
        return [...ciphertext, ...tag];
      }
    }

    // Reset ACORN state
    _resetState() {
      this.state.s1_l = this.state.s1_h = 0;
      this.state.s2_l = this.state.s2_h = 0;
      this.state.s3_l = this.state.s3_h = 0;
      this.state.s4_l = this.state.s4_h = 0;
      this.state.s5_l = this.state.s5_h = 0;
      this.state.s6_l = this.state.s6_h = 0;
      this.state.s7 = 0;
      this.state.authDone = 0;
    }

    // Initialize ACORN state with key and IV
    _initializeState(keyBytes, ivBytes) {
      // Convert bytes to 32-bit words (little-endian)
      const keyWords = [
        this._bytesToWord(keyBytes, 0),
        this._bytesToWord(keyBytes, 4),
        this._bytesToWord(keyBytes, 8),
        this._bytesToWord(keyBytes, 12)
      ];

      const ivWords = [
        this._bytesToWord(ivBytes, 0),
        this._bytesToWord(ivBytes, 4),
        this._bytesToWord(ivBytes, 8),
        this._bytesToWord(ivBytes, 12)
      ];

      // ACORN initialization (320 steps)
      // Load key
      for (let i = 0; i < 4; i++) {
        this._encryptWord(keyWords[i], CA_ONE_WORD, CB_ONE_WORD);
      }

      // Load IV
      for (let i = 0; i < 4; i++) {
        this._encryptWord(ivWords[i], CA_ONE_WORD, CB_ONE_WORD);
      }

      // Load key XOR 1
      this._encryptWord((keyWords[0] ^ 0x00000001) >>> 0, CA_ONE_WORD, CB_ONE_WORD);
      this._encryptWord(keyWords[1], CA_ONE_WORD, CB_ONE_WORD);
      this._encryptWord(keyWords[2], CA_ONE_WORD, CB_ONE_WORD);
      this._encryptWord(keyWords[3], CA_ONE_WORD, CB_ONE_WORD);

      // Warm-up rounds (11 * 4 = 44 steps)
      for (let round = 0; round < 11; round++) {
        for (let i = 0; i < 4; i++) {
          this._encryptWord(keyWords[i], CA_ONE_WORD, CB_ONE_WORD);
        }
      }
    }

    // Convert 4 bytes to 32-bit word (little-endian)
    _bytesToWord(bytes, offset) {
      return (
        (bytes[offset] & 0xFF) |
        ((bytes[offset + 1] & 0xFF) << 8) |
        ((bytes[offset + 2] & 0xFF) << 16) |
        ((bytes[offset + 3] & 0xFF) << 24)
      ) >>> 0;
    }

    // Convert 32-bit word to 4 bytes (little-endian)
    _wordToBytes(word) {
      return [
        word & 0xFF,
        (word >>> 8) & 0xFF,
        (word >>> 16) & 0xFF,
        (word >>> 24) & 0xFF
      ];
    }

    // Majority function for 8-bit values
    _maj8(x, y, z) {
      const a = x & 0xFF;
      const b = y & 0xFF;
      const c = z & 0xFF;
      return ((a & b) ^ (a & c) ^ (b & c)) & 0xFF;
    }

    // Choice function for 8-bit values
    _ch8(x, y, z) {
      const a = x & 0xFF;
      const b = y & 0xFF;
      const c = z & 0xFF;
      return ((a & b) ^ (((~a) & 0xFF) & c)) & 0xFF;
    }

    // Ensure 32-bit unsigned
    _toUint32(value) {
      return value >>> 0;
    }

    // Apply shift operation to ACORN state
    _applyShift8(s7Low, feedback) {
      const mixed = (s7Low ^ ((feedback << 4) & 0xFF)) & 0xFF;
      this.state.s7 = (feedback >>> 4) & 0x0F;

      this.state.s1_l = this._toUint32((this.state.s1_l >>> 8) | ((this.state.s1_h & 0xFF) << 24));
      this.state.s1_h = this._toUint32((this.state.s1_h >>> 8) | (((this.state.s2_l & 0xFF) << (61 - 40)) >>> 0)) & S1_HIGH_MASK;

      this.state.s2_l = this._toUint32((this.state.s2_l >>> 8) | ((this.state.s2_h & 0xFF) << 24));
      this.state.s2_h = this._toUint32((this.state.s2_h >>> 8) | (((this.state.s3_l & 0xFF) << (46 - 40)) >>> 0)) & S2_HIGH_MASK;

      this.state.s3_l = this._toUint32((this.state.s3_l >>> 8) | ((this.state.s3_h & 0xFF) << 24));
      this.state.s3_h = this._toUint32((this.state.s3_h >>> 8) | (((this.state.s4_l & 0xFF) << (47 - 40)) >>> 0)) & S3_HIGH_MASK;

      this.state.s4_l = this._toUint32((this.state.s4_l >>> 8) | ((this.state.s4_h & 0xFF) << 24) | ((this.state.s5_l & 0xFF) << (39 - 8)));
      this.state.s4_h = ((this.state.s5_l & 0xFF) >>> (40 - 39)) & S4_HIGH_MASK;

      this.state.s5_l = this._toUint32((this.state.s5_l >>> 8) | ((this.state.s5_h & 0xFF) << 24) | ((this.state.s6_l & 0xFF) << (37 - 8)));
      this.state.s5_h = ((this.state.s6_l & 0xFF) >>> (40 - 37)) & S5_HIGH_MASK;

      this.state.s6_l = this._toUint32((this.state.s6_l >>> 8) | ((this.state.s6_h & 0xFF) << 24));
      this.state.s6_h = this._toUint32((this.state.s6_h >>> 8) | (mixed << 19)) & S6_HIGH_MASK;
    }

    // ACORN encryption step for single byte
    _acornEncrypt8(plaintextByte, caByte, cbByte) {
      const s244 = (this.state.s6_l >>> 14) & 0xFF;
      const s235 = (this.state.s6_l >>> 5) & 0xFF;
      const s196 = (this.state.s5_l >>> 3) & 0xFF;
      const s160 = (this.state.s4_l >>> 6) & 0xFF;
      const s111 = (this.state.s3_l >>> 4) & 0xFF;
      const s66 = (this.state.s2_l >>> 5) & 0xFF;
      const s23 = (this.state.s1_l >>> 23) & 0xFF;
      const s12 = (this.state.s1_l >>> 12) & 0xFF;

      let s7Low = (this.state.s7 ^ s235 ^ (this.state.s6_l & 0xFF)) & 0xFF;
      this.state.s6_l = this._toUint32(this.state.s6_l ^ s196 ^ (this.state.s5_l & 0xFF));
      this.state.s5_l = this._toUint32(this.state.s5_l ^ s160 ^ (this.state.s4_l & 0xFF));
      this.state.s4_l = this._toUint32(this.state.s4_l ^ s111 ^ (this.state.s3_l & 0xFF));
      this.state.s3_l = this._toUint32(this.state.s3_l ^ s66 ^ (this.state.s2_l & 0xFF));
      this.state.s2_l = this._toUint32(this.state.s2_l ^ s23 ^ (this.state.s1_l & 0xFF));

      const keystream = (s12 ^ (this.state.s4_l & 0xFF) ^ this._maj8(s235, this.state.s2_l, this.state.s5_l) ^ this._ch8(this.state.s6_l, s111, s66)) & 0xFF;
      const caMask = caByte & s196;
      const cbMask = cbByte & keystream;
      let feedback = ((this.state.s1_l & 0xFF) ^ ((~this.state.s3_l) & 0xFF) ^ this._maj8(s244, s23, s160) ^ caMask ^ cbMask) & 0xFF;
      feedback ^= plaintextByte & 0xFF;

      this._applyShift8(s7Low, feedback);
      return (plaintextByte ^ keystream) & 0xFF;
    }

    // ACORN decryption step for single byte
    _acornDecrypt8(ciphertextByte) {
      const s244 = (this.state.s6_l >>> 14) & 0xFF;
      const s235 = (this.state.s6_l >>> 5) & 0xFF;
      const s196 = (this.state.s5_l >>> 3) & 0xFF;
      const s160 = (this.state.s4_l >>> 6) & 0xFF;
      const s111 = (this.state.s3_l >>> 4) & 0xFF;
      const s66 = (this.state.s2_l >>> 5) & 0xFF;
      const s23 = (this.state.s1_l >>> 23) & 0xFF;
      const s12 = (this.state.s1_l >>> 12) & 0xFF;

      let s7Low = (this.state.s7 ^ s235 ^ (this.state.s6_l & 0xFF)) & 0xFF;
      this.state.s6_l = this._toUint32(this.state.s6_l ^ s196 ^ (this.state.s5_l & 0xFF));
      this.state.s5_l = this._toUint32(this.state.s5_l ^ s160 ^ (this.state.s4_l & 0xFF));
      this.state.s4_l = this._toUint32(this.state.s4_l ^ s111 ^ (this.state.s3_l & 0xFF));
      this.state.s3_l = this._toUint32(this.state.s3_l ^ s66 ^ (this.state.s2_l & 0xFF));
      this.state.s2_l = this._toUint32(this.state.s2_l ^ s23 ^ (this.state.s1_l & 0xFF));

      const keystream = (s12 ^ (this.state.s4_l & 0xFF) ^ this._maj8(s235, this.state.s2_l, this.state.s5_l) ^ this._ch8(this.state.s6_l, s111, s66)) & 0xFF;
      const plaintext = (ciphertextByte ^ keystream) & 0xFF;

      let feedback = ((this.state.s1_l & 0xFF) ^ ((~this.state.s3_l) & 0xFF) ^ this._maj8(s244, s23, s160) ^ s196) & 0xFF;
      feedback ^= plaintext;

      this._applyShift8(s7Low, feedback);
      return plaintext;
    }

    // Process 32-bit word
    _encryptWord(word, caWord, cbWord) {
      let result = 0;
      for (let offset = 0; offset < 32; offset += 8) {
        const inputByte = (word >>> offset) & 0xFF;
        const caByte = (caWord >>> offset) & 0xFF;
        const cbByte = (cbWord >>> offset) & 0xFF;
        const outByte = this._acornEncrypt8(inputByte, caByte, cbByte);
        result |= outByte << offset;
      }
      return result >>> 0;
    }

    // Padding operation
    _acornPad(cbWord) {
      this._encryptWord(1, CA_ONE_WORD, cbWord);
      this._encryptWord(0, CA_ONE_WORD, cbWord);
      this._encryptWord(0, CA_ONE_WORD, cbWord);
      this._encryptWord(0, CA_ONE_WORD, cbWord);
      this._encryptWord(0, CA_ZERO_WORD, cbWord);
      this._encryptWord(0, CA_ZERO_WORD, cbWord);
      this._encryptWord(0, CA_ZERO_WORD, cbWord);
      this._encryptWord(0, CA_ZERO_WORD, cbWord);
    }

    // Absorb associated data
    _absorbAAD(aad) {
      if (!aad || aad.length === 0) return;

      for (let i = 0; i < aad.length; i++) {
        this._acornEncrypt8(aad[i] & 0xFF, CA_ONE_BYTE, CB_ONE_BYTE);
      }
    }

    // Encrypt bytes
    _encryptBytes(plaintext) {
      if (!this.state.authDone) {
        this._acornPad(CB_ONE_WORD);
        this.state.authDone = 1;
      }

      if (!plaintext || plaintext.length === 0) return [];

      const output = new Array(plaintext.length);
      for (let i = 0; i < plaintext.length; i++) {
        output[i] = this._acornEncrypt8(plaintext[i] & 0xFF, CA_ONE_BYTE, CB_ZERO_BYTE);
      }
      return output;
    }

    // Decrypt bytes
    _decryptBytes(ciphertext) {
      if (!this.state.authDone) {
        this._acornPad(CB_ONE_WORD);
        this.state.authDone = 1;
      }

      if (!ciphertext || ciphertext.length === 0) return [];

      const output = new Array(ciphertext.length);
      for (let i = 0; i < ciphertext.length; i++) {
        output[i] = this._acornDecrypt8(ciphertext[i] & 0xFF);
      }
      return output;
    }

    // Finalize and generate authentication tag
    _finalizeTag() {
      if (!this.state.authDone) {
        this._acornPad(CB_ONE_WORD);
      }

      this._acornPad(CB_ZERO_WORD);

      // Generate tag (20 rounds + 4 extraction steps)
      for (let i = 0; i < 20; i++) {
        this._encryptWord(0, CA_ONE_WORD, CB_ONE_WORD);
      }

      const tagBytes = [];
      for (let i = 0; i < 4; i++) {
        const word = this._encryptWord(0, CA_ONE_WORD, CB_ONE_WORD);
        const bytes = this._wordToBytes(word);
        tagBytes.push(...bytes);
      }

      return tagBytes.slice(0, 16); // 128-bit tag
    }
  }

  // Register the algorithm
  const algorithmInstance = new ACORNAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { ACORNAlgorithm, ACORNInstance };
}));