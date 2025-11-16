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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // ===== SHARED LFSR HELPERS =====

  function parity(x) {
    return OpCodes.PopCountFast(x) & 1;
  }

  function clockone(reg, mask, taps) {
    const t = reg & taps;
    reg = (reg << 1) & mask;
    reg |= parity(t);
    return reg;
  }

  // ===== A5/1 ALGORITHM =====

  /**
 * A51 - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class A51 extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "A5/1";
      this.description = "GSM stream cipher using three irregularly clocked LFSRs with majority voting. Educational implementation demonstrating telecommunications security algorithms from cellular networks.";
      this.inventor = "ETSI SAGE";
      this.year = 1987;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTERNATIONAL;

      this.SupportedKeySizes = [new KeySize(8, 8, 1)];
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("Wikipedia: A5/1", "https://en.wikipedia.org/wiki/A5/1"),
        new LinkItem("ETSI TS 155 226 - A5/1 Encryption Algorithm", "https://www.etsi.org/deliver/etsi_ts/155200_155299/155226/"),
        new LinkItem("3GPP TS 55.216 - A5/1 Algorithm Specification", "https://www.3gpp.org/DynaReport/55216.htm")
      ];

      this.vulnerabilities = [
        new Vulnerability("Time-Memory Tradeoff Attack", "Practical real-time key recovery attacks demonstrated by Biryukov-Shamir-Wagner"),
        new Vulnerability("Correlation Attack", "Exploits linear properties of LFSRs to recover internal state")
      ];

      this.tests = [
        {
          text: "A5/1 Test Vector - Key 1",
          uri: "A5/1 reference implementation with frame=0",
          input: OpCodes.Hex8ToBytes("000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("123456789abcdef0"),
          expected: OpCodes.Hex8ToBytes("b7d37880be862cdbf6d401fae7ffa2")
        },
        {
          text: "A5/1 Test Vector - Key 2",
          uri: "A5/1 reference implementation with different key",
          input: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("fedcba9876543210"),
          expected: OpCodes.Hex8ToBytes("6a97039a899deca7df5a3f722e7bff")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new A51Instance(this, isInverse);
    }
  }

  /**
 * A51 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class A51Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._frameNumber = 0;
      this._lfsr1 = 0;
      this._lfsr2 = 0;
      this._lfsr3 = 0;
      this._initialized = false;

      // A5/1 Constants from C reference
      this.R1MASK = 0x07FFFF;  // 19 bits
      this.R2MASK = 0x3FFFFF;  // 22 bits
      this.R3MASK = 0x7FFFFF;  // 23 bits
      this.R1TAPS = 0x072000;  // bits 18,17,16,13
      this.R2TAPS = 0x300000;  // bits 21,20
      this.R3TAPS = 0x700080;  // bits 22,21,20,7
      this.R1MID = 0x000100;   // bit 8
      this.R2MID = 0x000400;   // bit 10
      this.R3MID = 0x000400;   // bit 10
      this.R1OUT = 0x040000;   // bit 18
      this.R2OUT = 0x200000;   // bit 21
      this.R3OUT = 0x400000;   // bit 22
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

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._initialize();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    set frame(frameNumber) {
      this._frameNumber = frameNumber || 0;
      if (this._key) {
        this._initialize();
      }
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

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._generateKeystreamByte();
        output.push(this.inputBuffer[i] ^ keystreamByte);
      }

      this.inputBuffer = [];
      return output;
    }

    _initialize() {
      if (!this._key) return;

      // Initialize registers to zero
      this._lfsr1 = 0;
      this._lfsr2 = 0;
      this._lfsr3 = 0;

      // Load 64-bit secret key
      for (let i = 0; i < 64; i++) {
        this._clockAllRegisters();

        const byteIdx = Math.floor(i / 8);
        const bitIdx = i % 8;
        if (this._key[byteIdx] & (1 << bitIdx)) {
          this._lfsr1 ^= 1;
          this._lfsr2 ^= 1;
          this._lfsr3 ^= 1;
        }
      }

      // Load 22-bit frame number
      for (let i = 0; i < 22; i++) {
        this._clockAllRegisters();

        if (this._frameNumber & (1 << i)) {
          this._lfsr1 ^= 1;
          this._lfsr2 ^= 1;
          this._lfsr3 ^= 1;
        }
      }

      // Mix for 100 cycles
      for (let i = 0; i < 100; i++) {
        this._clockRegisters();
      }

      this._initialized = true;
    }

    _clockAllRegisters() {
      this._lfsr1 = clockone(this._lfsr1, this.R1MASK, this.R1TAPS);
      this._lfsr2 = clockone(this._lfsr2, this.R2MASK, this.R2TAPS);
      this._lfsr3 = clockone(this._lfsr3, this.R3MASK, this.R3TAPS);
    }

    _clockRegisters() {
      const c1 = (this._lfsr1 & this.R1MID) !== 0 ? 1 : 0;
      const c2 = (this._lfsr2 & this.R2MID) !== 0 ? 1 : 0;
      const c3 = (this._lfsr3 & this.R3MID) !== 0 ? 1 : 0;

      const maj = (c1 + c2 + c3) >= 2 ? 1 : 0;

      if (c1 === maj) {
        this._lfsr1 = clockone(this._lfsr1, this.R1MASK, this.R1TAPS);
      }
      if (c2 === maj) {
        this._lfsr2 = clockone(this._lfsr2, this.R2MASK, this.R2TAPS);
      }
      if (c3 === maj) {
        this._lfsr3 = clockone(this._lfsr3, this.R3MASK, this.R3TAPS);
      }
    }

    _generateKeystreamBit() {
      this._clockRegisters();

      return ((this._lfsr1 & this.R1OUT) ? 1 : 0) ^
             ((this._lfsr2 & this.R2OUT) ? 1 : 0) ^
             ((this._lfsr3 & this.R3OUT) ? 1 : 0);
    }

    _generateKeystreamByte() {
      let byte = 0;
      for (let i = 0; i < 8; i++) {
        const bit = this._generateKeystreamBit();
        if (bit) {
          byte = OpCodes.SetBit(byte, 7 - i, 1);
        }
      }
      return byte;
    }
  }

  // ===== A5/2 ALGORITHM =====

  /**
 * A52 - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class A52 extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "A5/2";
      this.description = "Weakened GSM stream cipher using four irregularly clocked LFSRs. Intentionally weakened export version with severe cryptographic vulnerabilities. Educational implementation for demonstrating broken cipher design.";
      this.inventor = "ETSI SAGE";
      this.year = 1989;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTERNATIONAL;

      this.SupportedKeySizes = [new KeySize(8, 8, 1)];
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("Wikipedia: A5/2", "https://en.wikipedia.org/wiki/A5/2"),
        new LinkItem("ETSI TS 155 226 - A5 Encryption Algorithms", "https://www.etsi.org/deliver/etsi_ts/155200_155299/155226/"),
        new LinkItem("Instant Ciphertext-Only Cryptanalysis of GSM", "https://www.cs.technion.ac.il/users/wwwb/cgi-bin/tr-get.cgi/2003/CS/CS-2003-07.pdf")
      ];

      this.vulnerabilities = [
        new Vulnerability("Intentional Weakness", "Designed with backdoors to comply with export restrictions"),
        new Vulnerability("Instant Ciphertext-Only Attack", "Real-time break with minimal computational resources"),
        new Vulnerability("Known-Plaintext Attack", "Trivial key recovery with small amounts of known plaintext")
      ];

      this.tests = [
        {
          text: "A5/2 Test Vector - Key 1",
          uri: "A5/2 reference implementation with frame=0",
          input: OpCodes.Hex8ToBytes("000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("123456789abcdef0"),
          expected: OpCodes.Hex8ToBytes("49e165e78597a7cbec2088c3a1b7f6")
        },
        {
          text: "A5/2 Test Vector - Key 2",
          uri: "A5/2 reference implementation with different key",
          input: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("fedcba9876543210"),
          expected: OpCodes.Hex8ToBytes("54b63d92681390ff477b015555222b")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new A52Instance(this, isInverse);
    }
  }

  /**
 * A52 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class A52Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._frameNumber = 0;
      this._lfsr1 = 0;
      this._lfsr2 = 0;
      this._lfsr3 = 0;
      this._lfsr4 = 0;
      this._initialized = false;

      // A5/2 Constants
      this.R1MASK = 0x07FFFF;  // 19 bits
      this.R2MASK = 0x3FFFFF;  // 22 bits
      this.R3MASK = 0x7FFFFF;  // 23 bits
      this.R4MASK = 0x01FFFF;  // 17 bits
      this.R1TAPS = 0x072000;  // bits 18,17,16,13
      this.R2TAPS = 0x300000;  // bits 21,20
      this.R3TAPS = 0x700080;  // bits 22,21,20,7
      this.R4TAPS = 0x014000;  // bits 16,14
      this.R1OUT = 0x040000;   // bit 18
      this.R2OUT = 0x200000;   // bit 21
      this.R3OUT = 0x400000;   // bit 22
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

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._initialize();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    set frame(frameNumber) {
      this._frameNumber = frameNumber || 0;
      if (this._key) {
        this._initialize();
      }
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

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._generateKeystreamByte();
        output.push(this.inputBuffer[i] ^ keystreamByte);
      }

      this.inputBuffer = [];
      return output;
    }

    _initialize() {
      if (!this._key) return;

      // Initialize registers to zero
      this._lfsr1 = 0;
      this._lfsr2 = 0;
      this._lfsr3 = 0;
      this._lfsr4 = 0;

      // Load 64-bit secret key
      for (let i = 0; i < 64; i++) {
        this._clockAllRegisters();

        const byteIdx = Math.floor(i / 8);
        const bitIdx = i % 8;
        if (this._key[byteIdx] & (1 << bitIdx)) {
          this._lfsr1 ^= 1;
          this._lfsr2 ^= 1;
          this._lfsr3 ^= 1;
          this._lfsr4 ^= 1;
        }
      }

      // Load 22-bit frame number
      for (let i = 0; i < 22; i++) {
        this._clockAllRegisters();

        if (this._frameNumber & (1 << i)) {
          this._lfsr1 ^= 1;
          this._lfsr2 ^= 1;
          this._lfsr3 ^= 1;
          this._lfsr4 ^= 1;
        }
      }

      // Mix for 100 cycles
      for (let i = 0; i < 100; i++) {
        this._clockRegisters();
      }

      this._initialized = true;
    }

    _clockAllRegisters() {
      this._lfsr1 = clockone(this._lfsr1, this.R1MASK, this.R1TAPS);
      this._lfsr2 = clockone(this._lfsr2, this.R2MASK, this.R2TAPS);
      this._lfsr3 = clockone(this._lfsr3, this.R3MASK, this.R3TAPS);
      this._lfsr4 = clockone(this._lfsr4, this.R4MASK, this.R4TAPS);
    }

    _clockRegisters() {
      // A5/2 uses LFSR4 for clocking control
      const c4_0 = (this._lfsr4 & 0x01) !== 0 ? 1 : 0;
      const c4_1 = (this._lfsr4 & 0x02) !== 0 ? 1 : 0;

      // Clock LFSR4 first
      this._lfsr4 = clockone(this._lfsr4, this.R4MASK, this.R4TAPS);

      // Use LFSR4 bits to control clocking of other registers
      if (c4_0) {
        this._lfsr1 = clockone(this._lfsr1, this.R1MASK, this.R1TAPS);
      }
      if (c4_1) {
        this._lfsr2 = clockone(this._lfsr2, this.R2MASK, this.R2TAPS);
      }
      if (c4_0 !== c4_1) {
        this._lfsr3 = clockone(this._lfsr3, this.R3MASK, this.R3TAPS);
      }

      // Always clock at least one register
      if (!c4_0 && !c4_1) {
        this._lfsr1 = clockone(this._lfsr1, this.R1MASK, this.R1TAPS);
      }
    }

    _generateKeystreamBit() {
      this._clockRegisters();

      return ((this._lfsr1 & this.R1OUT) ? 1 : 0) ^
             ((this._lfsr2 & this.R2OUT) ? 1 : 0) ^
             ((this._lfsr3 & this.R3OUT) ? 1 : 0);
    }

    _generateKeystreamByte() {
      let byte = 0;
      for (let i = 0; i < 8; i++) {
        const bit = this._generateKeystreamBit();
        if (bit) {
          byte = OpCodes.SetBit(byte, 7 - i, 1);
        }
      }
      return byte;
    }
  }

  // ===== A5/3 ALGORITHM =====

  // KASUMI S-boxes
  const S7 = Object.freeze([
    54, 50, 62, 56, 22, 34, 94, 96, 38, 6, 63, 93, 2, 18, 123, 33,
    55, 113, 39, 114, 21, 67, 65, 12, 47, 73, 46, 27, 25, 111, 124, 81,
    53, 9, 121, 79, 52, 60, 58, 48, 101, 127, 40, 120, 104, 70, 71, 43,
    20, 122, 72, 61, 23, 109, 13, 100, 77, 1, 16, 7, 82, 10, 105, 98,
    117, 116, 76, 11, 89, 106, 0, 125, 118, 99, 86, 69, 30, 57, 126, 87,
    112, 51, 17, 5, 95, 14, 90, 84, 91, 8, 35, 103, 32, 97, 28, 66,
    102, 31, 26, 45, 75, 4, 85, 92, 37, 74, 80, 49, 68, 29, 115, 44,
    64, 107, 108, 24, 110, 83, 36, 78, 42, 19, 15, 41, 88, 119, 59, 3
  ]);

  const S9 = Object.freeze([
    167, 239, 161, 379, 391, 334, 9, 338, 38, 226, 48, 358, 452, 385, 90, 397,
    183, 253, 147, 331, 415, 340, 51, 362, 306, 500, 262, 82, 216, 159, 356, 177,
    175, 241, 489, 37, 206, 17, 0, 333, 44, 254, 378, 58, 143, 220, 81, 400,
    95, 3, 315, 245, 54, 235, 218, 405, 472, 264, 172, 494, 371, 290, 399, 76,
    165, 197, 395, 121, 257, 480, 423, 212, 240, 28, 462, 176, 406, 507, 288, 223,
    501, 407, 249, 265, 89, 186, 221, 428, 164, 74, 440, 196, 458, 421, 350, 163,
    232, 158, 134, 354, 13, 250, 491, 142, 191, 69, 193, 425, 152, 227, 366, 135,
    344, 300, 276, 242, 437, 320, 113, 278, 11, 243, 87, 317, 36, 93, 496, 27,
    487, 446, 482, 41, 68, 156, 457, 131, 326, 403, 339, 20, 39, 115, 442, 124,
    475, 384, 508, 53, 112, 170, 479, 151, 126, 169, 73, 268, 279, 321, 168, 364,
    363, 292, 46, 499, 393, 327, 324, 24, 456, 267, 157, 460, 488, 426, 309, 229,
    439, 506, 208, 271, 349, 401, 434, 236, 16, 209, 359, 52, 56, 120, 199, 277,
    465, 416, 252, 287, 246, 6, 83, 305, 420, 345, 153, 502, 65, 61, 244, 282,
    173, 222, 418, 67, 386, 368, 261, 101, 476, 291, 195, 430, 49, 79, 166, 330,
    280, 383, 373, 128, 382, 408, 155, 495, 367, 388, 274, 107, 459, 417, 62, 454,
    132, 225, 203, 316, 234, 14, 301, 91, 503, 286, 424, 469, 207, 194, 346, 124,
    18, 223, 444, 148, 410, 181, 293, 214, 471, 330, 454, 375, 99, 367, 210, 473,
    237, 255, 104, 122, 425, 486, 256, 396, 118, 465, 138, 228, 448, 198, 150, 337,
    117, 462, 319, 312, 442, 204, 162, 492, 342, 443, 464, 230, 296, 389, 295, 251,
    303, 140, 336, 398, 105, 411, 180, 298, 466, 313, 202, 445, 136, 372, 298, 394,
    187, 449, 272, 314, 428, 467, 190, 485, 141, 341, 248, 322, 289, 468, 205, 146,
    200, 392, 335, 390, 260, 233, 189, 470, 184, 474, 269, 185, 360, 477, 258, 348,
    154, 409, 355, 307, 478, 297, 263, 481, 171, 353, 270, 387, 483, 192, 357, 484,
    219, 329, 174, 144, 490, 238, 493, 231, 149, 497, 188, 498, 302, 247, 504, 109,
    284, 505, 137, 164, 160, 285, 217, 259, 133, 361, 283, 211, 308, 215, 178, 323,
    374, 145, 376, 377, 304, 139, 213, 380, 266, 102, 381, 179, 201, 129, 318, 275,
    273, 130, 402, 404, 168, 412, 413, 365, 414, 97, 311, 352, 419, 85, 310, 422,
    294, 123, 427, 328, 119, 132, 429, 94, 431, 351, 432, 433, 435, 370, 221, 436,
    369, 438, 182, 281, 103, 72, 441, 166, 447, 176, 450, 71, 451, 453, 98, 455,
    125, 343, 224, 127, 461, 100, 463, 196, 469, 347, 75, 298, 476, 477, 255, 264,
    136, 96, 346, 176, 306, 332, 80, 332, 88, 131, 10, 106, 63, 110, 114, 78,
    64, 92, 116, 34, 508, 111, 172, 207, 40, 347, 35, 1, 55, 25, 12, 19
  ]);

  /**
 * A53 - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class A53 extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "A5/3";
      this.description = "Stream cipher used in 3G/UMTS mobile communications based on KASUMI block cipher. More secure replacement for A5/1 and A5/2. Uses 128-bit keys with KASUMI operated in OFB-like mode.";
      this.inventor = "3GPP (3rd Generation Partnership Project)";
      this.year = 1999;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTERNATIONAL;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedBlockSizes = [new KeySize(1, 2500, 1)];

      this.documentation = [
        new LinkItem("Wikipedia: A5/3", "https://en.wikipedia.org/wiki/A5/3"),
        new LinkItem("3GPP TS 55.216 - A5/3 Specification", "https://www.3gpp.org/DynaReport/55216.htm"),
        new LinkItem("KASUMI Specification", "https://www.3gpp.org/ftp/Specs/archive/35_series/35.202/")
      ];

      this.vulnerabilities = [
        new Vulnerability("Related-Key Attack on KASUMI", "Theoretical attacks on KASUMI, but not practical for A5/3")
      ];

      this.tests = [
        {
          text: "A5/3 Educational Test Vector (Simplified Implementation)",
          uri: "Educational implementation test",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("029c029c0480ef93029c02bb0480ef93")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new A53Instance(this, isInverse);
    }
  }

  /**
 * A53 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class A53Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this.keystreamBuffer = [];
      this.bufferPosition = 0;
      this.count = 0;
      this.bearer = 0;
      this.direction = 0;
      this.MAX_OUTPUT_BITS = 20000;
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

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.keystreamBuffer = [];
      this.bufferPosition = 0;
      this._generateKeystreamBlock();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

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

      if (this.inputBuffer.length === 0) {
        return [];
      }

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._getKeystreamByte();
        output.push(this.inputBuffer[i] ^ keystreamByte);
      }

      this.inputBuffer = [];
      return output;
    }

    _kasumiF1(input, key) {
      let left = (input >>> 7) & 0x1FF;
      let right = input & 0x7F;

      left = S9[left % S9.length];
      right = S7[right];

      left ^= (key >>> 7) & 0x1FF;
      right ^= key & 0x7F;

      return ((left << 7) | right) & 0xFFFF;
    }

    _kasumiF0(left, right, roundKey) {
      const k1 = OpCodes.Pack32BE(roundKey[0], roundKey[1], roundKey[2], roundKey[3]);
      const k2 = OpCodes.Pack32BE(roundKey[4], roundKey[5], roundKey[6], roundKey[7]);

      let temp = left;
      let fi1_in = (temp >>> 16) & 0xFFFF;
      fi1_in = this._kasumiF1(fi1_in, k1 & 0xFFFF);

      let fi2_in = temp & 0xFFFF;
      fi2_in = this._kasumiF1(fi2_in, (k1 >>> 16) & 0xFFFF);

      temp = ((fi1_in << 16) | fi2_in) ^ k2;

      return { left: right, right: left ^ temp };
    }

    _kasumiEncrypt(plaintext) {
      let left = OpCodes.Pack32BE(plaintext[0], plaintext[1], plaintext[2], plaintext[3]);
      let right = OpCodes.Pack32BE(plaintext[4], plaintext[5], plaintext[6], plaintext[7]);

      for (let round = 0; round < 8; round++) {
        const roundKey = [];
        for (let i = 0; i < 8; i++) {
          roundKey.push(this._key[(round * 2 + i) % 16]);
        }

        const result = this._kasumiF0(left, right, roundKey);
        left = result.left;
        right = result.right;
      }

      const leftBytes = OpCodes.Unpack32BE(left);
      const rightBytes = OpCodes.Unpack32BE(right);

      return [...leftBytes, ...rightBytes];
    }

    _generateKeystreamBlock() {
      const input = new Array(8).fill(0);
      const blockCount = Math.floor(this.keystreamBuffer.length / 8);

      const fullCount = (((this.count & 0x1F) << 27) | (blockCount & 0x07FFFFFF)) >>> 0;
      input[0] = (fullCount >>> 24) & 0xFF;
      input[1] = (fullCount >>> 16) & 0xFF;
      input[2] = (fullCount >>> 8) & 0xFF;
      input[3] = fullCount & 0xFF;
      input[4] = (((this.bearer & 0x1F) << 3) | ((this.direction & 1) << 2)) & 0xFF;

      const keystreamBlock = this._kasumiEncrypt(input);
      this.keystreamBuffer.push(...keystreamBlock);
    }

    _getKeystreamByte() {
      if (this.bufferPosition >= this.keystreamBuffer.length) {
        if (this.keystreamBuffer.length >= (this.MAX_OUTPUT_BITS / 8)) {
          throw new Error('A5/3 maximum keystream length exceeded');
        }
        this._generateKeystreamBlock();
      }

      return this.keystreamBuffer[this.bufferPosition++];
    }
  }

  // ===== REGISTRATION =====

  const a51Instance = new A51();
  if (!AlgorithmFramework.Find(a51Instance.name)) {
    RegisterAlgorithm(a51Instance);
  }

  const a52Instance = new A52();
  if (!AlgorithmFramework.Find(a52Instance.name)) {
    RegisterAlgorithm(a52Instance);
  }

  const a53Instance = new A53();
  if (!AlgorithmFramework.Find(a53Instance.name)) {
    RegisterAlgorithm(a53Instance);
  }

  // ===== EXPORTS =====

  return { A51, A51Instance, A52, A52Instance, A53, A53Instance };
}));
