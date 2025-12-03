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
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * HIGHT - HIGh security and light weigHT block cipher
   * Designed by Korean cryptographers for low-resource devices
   * Published in 2006
   *
   * Characteristics:
   * - 64-bit blocks
   * - 128-bit keys
   * - 32 rounds
   * - Uses ADD/XOR operations (no multiplication)
   * - Two S-boxes (F0 and F1)
   *
   * Security: EDUCATIONAL - Designed for constrained devices, not vetted for general use
   */

  // DELTA constants for key schedule (128 values)
  const DELTA = Object.freeze([
    0x5A,0x6D,0x36,0x1B,0x0D,0x06,0x03,0x41,
    0x60,0x30,0x18,0x4C,0x66,0x33,0x59,0x2C,
    0x56,0x2B,0x15,0x4A,0x65,0x72,0x39,0x1C,
    0x4E,0x67,0x73,0x79,0x3C,0x5E,0x6F,0x37,
    0x5B,0x2D,0x16,0x0B,0x05,0x42,0x21,0x50,
    0x28,0x54,0x2A,0x55,0x6A,0x75,0x7A,0x7D,
    0x3E,0x5F,0x2F,0x17,0x4B,0x25,0x52,0x29,
    0x14,0x0A,0x45,0x62,0x31,0x58,0x6C,0x76,
    0x3B,0x1D,0x0E,0x47,0x63,0x71,0x78,0x7C,
    0x7E,0x7F,0x3F,0x1F,0x0F,0x07,0x43,0x61,
    0x70,0x38,0x5C,0x6E,0x77,0x7B,0x3D,0x1E,
    0x4F,0x27,0x53,0x69,0x34,0x1A,0x4D,0x26,
    0x13,0x49,0x24,0x12,0x09,0x04,0x02,0x01,
    0x40,0x20,0x10,0x08,0x44,0x22,0x11,0x48,
    0x64,0x32,0x19,0x0C,0x46,0x23,0x51,0x68,
    0x74,0x3A,0x5D,0x2E,0x57,0x6B,0x35,0x5A
  ]);

  // F0 S-box (256 values)
  const F0 = Object.freeze([
    0x00,0x86,0x0D,0x8B,0x1A,0x9C,0x17,0x91,
    0x34,0xB2,0x39,0xBF,0x2E,0xA8,0x23,0xA5,
    0x68,0xEE,0x65,0xE3,0x72,0xF4,0x7F,0xF9,
    0x5C,0xDA,0x51,0xD7,0x46,0xC0,0x4B,0xCD,
    0xD0,0x56,0xDD,0x5B,0xCA,0x4C,0xC7,0x41,
    0xE4,0x62,0xE9,0x6F,0xFE,0x78,0xF3,0x75,
    0xB8,0x3E,0xB5,0x33,0xA2,0x24,0xAF,0x29,
    0x8C,0x0A,0x81,0x07,0x96,0x10,0x9B,0x1D,
    0xA1,0x27,0xAC,0x2A,0xBB,0x3D,0xB6,0x30,
    0x95,0x13,0x98,0x1E,0x8F,0x09,0x82,0x04,
    0xC9,0x4F,0xC4,0x42,0xD3,0x55,0xDE,0x58,
    0xFD,0x7B,0xF0,0x76,0xE7,0x61,0xEA,0x6C,
    0x71,0xF7,0x7C,0xFA,0x6B,0xED,0x66,0xE0,
    0x45,0xC3,0x48,0xCE,0x5F,0xD9,0x52,0xD4,
    0x19,0x9F,0x14,0x92,0x03,0x85,0x0E,0x88,
    0x2D,0xAB,0x20,0xA6,0x37,0xB1,0x3A,0xBC,
    0x43,0xC5,0x4E,0xC8,0x59,0xDF,0x54,0xD2,
    0x77,0xF1,0x7A,0xFC,0x6D,0xEB,0x60,0xE6,
    0x2B,0xAD,0x26,0xA0,0x31,0xB7,0x3C,0xBA,
    0x1F,0x99,0x12,0x94,0x05,0x83,0x08,0x8E,
    0x93,0x15,0x9E,0x18,0x89,0x0F,0x84,0x02,
    0xA7,0x21,0xAA,0x2C,0xBD,0x3B,0xB0,0x36,
    0xFB,0x7D,0xF6,0x70,0xE1,0x67,0xEC,0x6A,
    0xCF,0x49,0xC2,0x44,0xD5,0x53,0xD8,0x5E,
    0xE2,0x64,0xEF,0x69,0xF8,0x7E,0xF5,0x73,
    0xD6,0x50,0xDB,0x5D,0xCC,0x4A,0xC1,0x47,
    0x8A,0x0C,0x87,0x01,0x90,0x16,0x9D,0x1B,
    0xBE,0x38,0xB3,0x35,0xA4,0x22,0xA9,0x2F,
    0x32,0xB4,0x3F,0xB9,0x28,0xAE,0x25,0xA3,
    0x06,0x80,0x0B,0x8D,0x1C,0x9A,0x11,0x97,
    0x5A,0xDC,0x57,0xD1,0x40,0xC6,0x4D,0xCB,
    0x6E,0xE8,0x63,0xE5,0x74,0xF2,0x79,0xFF
  ]);

  // F1 S-box (256 values)
  const F1 = Object.freeze([
    0x00,0x58,0xB0,0xE8,0x61,0x39,0xD1,0x89,
    0xC2,0x9A,0x72,0x2A,0xA3,0xFB,0x13,0x4B,
    0x85,0xDD,0x35,0x6D,0xE4,0xBC,0x54,0x0C,
    0x47,0x1F,0xF7,0xAF,0x26,0x7E,0x96,0xCE,
    0x0B,0x53,0xBB,0xE3,0x6A,0x32,0xDA,0x82,
    0xC9,0x91,0x79,0x21,0xA8,0xF0,0x18,0x40,
    0x8E,0xD6,0x3E,0x66,0xEF,0xB7,0x5F,0x07,
    0x4C,0x14,0xFC,0xA4,0x2D,0x75,0x9D,0xC5,
    0x16,0x4E,0xA6,0xFE,0x77,0x2F,0xC7,0x9F,
    0xD4,0x8C,0x64,0x3C,0xB5,0xED,0x05,0x5D,
    0x93,0xCB,0x23,0x7B,0xF2,0xAA,0x42,0x1A,
    0x51,0x09,0xE1,0xB9,0x30,0x68,0x80,0xD8,
    0x1D,0x45,0xAD,0xF5,0x7C,0x24,0xCC,0x94,
    0xDF,0x87,0x6F,0x37,0xBE,0xE6,0x0E,0x56,
    0x98,0xC0,0x28,0x70,0xF9,0xA1,0x49,0x11,
    0x5A,0x02,0xEA,0xB2,0x3B,0x63,0x8B,0xD3,
    0x2C,0x74,0x9C,0xC4,0x4D,0x15,0xFD,0xA5,
    0xEE,0xB6,0x5E,0x06,0x8F,0xD7,0x3F,0x67,
    0xA9,0xF1,0x19,0x41,0xC8,0x90,0x78,0x20,
    0x6B,0x33,0xDB,0x83,0x0A,0x52,0xBA,0xE2,
    0x27,0x7F,0x97,0xCF,0x46,0x1E,0xF6,0xAE,
    0xE5,0xBD,0x55,0x0D,0x84,0xDC,0x34,0x6C,
    0xA2,0xFA,0x12,0x4A,0xC3,0x9B,0x73,0x2B,
    0x60,0x38,0xD0,0x88,0x01,0x59,0xB1,0xE9,
    0x3A,0x62,0x8A,0xD2,0x5B,0x03,0xEB,0xB3,
    0xF8,0xA0,0x48,0x10,0x99,0xC1,0x29,0x71,
    0xBF,0xE7,0x0F,0x57,0xDE,0x86,0x6E,0x36,
    0x7D,0x25,0xCD,0x95,0x1C,0x44,0xAC,0xF4,
    0x31,0x69,0x81,0xD9,0x50,0x08,0xE0,0xB8,
    0xF3,0xAB,0x43,0x1B,0x92,0xCA,0x22,0x7A,
    0xB4,0xEC,0x04,0x5C,0xD5,0x8D,0x65,0x3D,
    0x76,0x2E,0xC6,0x9E,0x17,0x4F,0xA7,0xFF
  ]);

  /**
 * HIGHTAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class HIGHTAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "HIGHT";
      this.description = "HIGh security and light weigHT block cipher designed for low-resource devices. Uses only ADD/XOR operations without multiplication, making it suitable for constrained environments like RFID and sensor networks.";
      this.inventor = "Deukjo Hong, Jaechul Sung, Seokhie Hong, Jongin Lim, Sangjin Lee, and others";
      this.year = 2006;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.KR;

      // HIGHT: 8-byte blocks, 16-byte keys
      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)];

      this.documentation = [
        new LinkItem("HIGHT: A New Block Cipher Suitable for Low-Resource Device", "https://www.iacr.org/archive/ches2006/04/04.pdf"),
        new LinkItem("Crypto++ HIGHT Implementation", "https://github.com/weidai11/cryptopp/blob/master/hight.cpp")
      ];

      // Crypto++ test vectors from TestVectors/hight.txt
      this.tests = [
        {
          text: "Crypto++ HIGHT Test Vector #1",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/hight.txt",
          key: OpCodes.Hex8ToBytes("88e34f8f081779f1e9f394370ad40589"),
          input: OpCodes.Hex8ToBytes("d76d0d18327ec562"),
          expected: OpCodes.Hex8ToBytes("e4bc2e312277e4dd")
        },
        {
          text: "Crypto++ HIGHT Test Vector #2",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/hight.txt",
          key: OpCodes.Hex8ToBytes("2923be84e16cd6ae529049f1f1bbe9eb"),
          input: OpCodes.Hex8ToBytes("b3a6db3c870c3e99"),
          expected: OpCodes.Hex8ToBytes("23cad1a3cddf7eab")
        },
        {
          text: "Crypto++ HIGHT Test Vector #3",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/hight.txt",
          key: OpCodes.Hex8ToBytes("245e0d1c06b747deb3124dc843bb8ba6"),
          input: OpCodes.Hex8ToBytes("1f035a7d0938251f"),
          expected: OpCodes.Hex8ToBytes("52bd91bb26f8ed99")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new HIGHTInstance(this, isInverse);
    }
  }

  /**
 * HIGHT cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class HIGHTInstance extends IBlockCipherInstance {
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
      this.roundKeys = new Array(136); // 136-byte round key schedule
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

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (HIGHT requires 16 bytes)`);
      }

      this._key = [...keyBytes];
      this._keySetup();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    /**
     * HIGHT key schedule from Crypto++ hight.cpp lines 115-134
     * Generates 136 bytes of round key material
     */
    _keySetup() {
      if (!this._key) return;

      // First 8 bytes of round keys (whitening keys)
      for (let i = 0; i < 4; i++) {
        this.roundKeys[i] = this._key[i + 12];
        this.roundKeys[i + 4] = this._key[i];
      }

      // Generate remaining 128 bytes using DELTA constants
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          this.roundKeys[8 + 16 * i + j] = OpCodes.AndN(this._key[OpCodes.AndN(j - i, 7)] + DELTA[16 * i + j], 0xFF);
        }
        for (let j = 0; j < 8; j++) {
          this.roundKeys[8 + 16 * i + j + 8] = OpCodes.AndN(this._key[OpCodes.AndN(j - i, 7) + 8] + DELTA[16 * i + j + 8], 0xFF);
        }
      }
    }

    /**
     * HIGHT round function for encryption
     * Implements the macro from hight.cpp lines 150-155
     * The macro: HIGHT_ENC(k, i0,i1,i2,i3,i4,i5,i6,i7)
     */
    _encryptRound(xx, k, i0, i1, i2, i3, i4, i5, i6, i7) {
      xx[i0] = OpCodes.AndN(OpCodes.XorN(xx[i0], F0[xx[i1]] + this.roundKeys[4 * k + 3]), 0xFF);
      xx[i2] = OpCodes.AndN(xx[i2] + OpCodes.XorN(F1[xx[i3]], this.roundKeys[4 * k + 2]), 0xFF);
      xx[i4] = OpCodes.AndN(OpCodes.XorN(xx[i4], F0[xx[i5]] + this.roundKeys[4 * k + 1]), 0xFF);
      xx[i6] = OpCodes.AndN(xx[i6] + OpCodes.XorN(F1[xx[i7]], this.roundKeys[4 * k + 0]), 0xFF);
    }

    /**
     * HIGHT round function for decryption
     * Implements the macro from hight.cpp lines 230-235
     * The macro: HIGHT_DEC(k, i0,i1,i2,i3,i4,i5,i6,i7)
     */
    _decryptRound(xx, k, i0, i1, i2, i3, i4, i5, i6, i7) {
      xx[i1] = OpCodes.AndN(xx[i1] - OpCodes.XorN(F1[xx[i2]], this.roundKeys[4 * k + 2]), 0xFF);
      xx[i3] = OpCodes.AndN(OpCodes.XorN(xx[i3], F0[xx[i4]] + this.roundKeys[4 * k + 1]), 0xFF);
      xx[i5] = OpCodes.AndN(xx[i5] - OpCodes.XorN(F1[xx[i6]], this.roundKeys[4 * k + 0]), 0xFF);
      xx[i7] = OpCodes.AndN(OpCodes.XorN(xx[i7], F0[xx[i0]] + this.roundKeys[4 * k + 3]), 0xFF);
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
      const blockSize = 8;

      // Process complete 8-byte blocks
      for (let i = 0; i + blockSize <= this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this._processBlock(block);
        output.push(...processedBlock);
      }

      this.inputBuffer = [];
      return output;
    }

    _processBlock(block) {
      const xx = new Array(8);

      if (this.isInverse) {
        // Decryption - hight.cpp lines 218-296

        // Initial transformation (lines 220-228)
        xx[2] = block[1];
        xx[4] = block[3];
        xx[6] = block[5];
        xx[0] = block[7];

        xx[1] = OpCodes.AndN(block[0] - this.roundKeys[4], 0xFF);
        xx[3] = OpCodes.XorN(block[2], this.roundKeys[5]);
        xx[5] = OpCodes.AndN(block[4] - this.roundKeys[6], 0xFF);
        xx[7] = OpCodes.XorN(block[6], this.roundKeys[7]);

        // 32 rounds in reverse (lines 237-268)
        this._decryptRound(xx, 33, 7,6,5,4,3,2,1,0);
        this._decryptRound(xx, 32, 0,7,6,5,4,3,2,1);
        this._decryptRound(xx, 31, 1,0,7,6,5,4,3,2);
        this._decryptRound(xx, 30, 2,1,0,7,6,5,4,3);
        this._decryptRound(xx, 29, 3,2,1,0,7,6,5,4);
        this._decryptRound(xx, 28, 4,3,2,1,0,7,6,5);
        this._decryptRound(xx, 27, 5,4,3,2,1,0,7,6);
        this._decryptRound(xx, 26, 6,5,4,3,2,1,0,7);
        this._decryptRound(xx, 25, 7,6,5,4,3,2,1,0);
        this._decryptRound(xx, 24, 0,7,6,5,4,3,2,1);
        this._decryptRound(xx, 23, 1,0,7,6,5,4,3,2);
        this._decryptRound(xx, 22, 2,1,0,7,6,5,4,3);
        this._decryptRound(xx, 21, 3,2,1,0,7,6,5,4);
        this._decryptRound(xx, 20, 4,3,2,1,0,7,6,5);
        this._decryptRound(xx, 19, 5,4,3,2,1,0,7,6);
        this._decryptRound(xx, 18, 6,5,4,3,2,1,0,7);
        this._decryptRound(xx, 17, 7,6,5,4,3,2,1,0);
        this._decryptRound(xx, 16, 0,7,6,5,4,3,2,1);
        this._decryptRound(xx, 15, 1,0,7,6,5,4,3,2);
        this._decryptRound(xx, 14, 2,1,0,7,6,5,4,3);
        this._decryptRound(xx, 13, 3,2,1,0,7,6,5,4);
        this._decryptRound(xx, 12, 4,3,2,1,0,7,6,5);
        this._decryptRound(xx, 11, 5,4,3,2,1,0,7,6);
        this._decryptRound(xx, 10, 6,5,4,3,2,1,0,7);
        this._decryptRound(xx, 9,  7,6,5,4,3,2,1,0);
        this._decryptRound(xx, 8,  0,7,6,5,4,3,2,1);
        this._decryptRound(xx, 7,  1,0,7,6,5,4,3,2);
        this._decryptRound(xx, 6,  2,1,0,7,6,5,4,3);
        this._decryptRound(xx, 5,  3,2,1,0,7,6,5,4);
        this._decryptRound(xx, 4,  4,3,2,1,0,7,6,5);
        this._decryptRound(xx, 3,  5,4,3,2,1,0,7,6);
        this._decryptRound(xx, 2,  6,5,4,3,2,1,0,7);

        // Final transformation (lines 285-294)
        return [
          OpCodes.AndN(xx[0] - this.roundKeys[0], 0xFF),
          xx[1],
          OpCodes.XorN(xx[2], this.roundKeys[1]),
          xx[3],
          OpCodes.AndN(xx[4] - this.roundKeys[2], 0xFF),
          xx[5],
          OpCodes.XorN(xx[6], this.roundKeys[3]),
          xx[7]
        ];
      } else {
        // Encryption - hight.cpp lines 136-216

        // Initial transformation (lines 139-147)
        xx[1] = block[1];
        xx[3] = block[3];
        xx[5] = block[5];
        xx[7] = block[7];

        xx[0] = OpCodes.AndN(block[0] + this.roundKeys[0], 0xFF);
        xx[2] = OpCodes.XorN(block[2], this.roundKeys[1]);
        xx[4] = OpCodes.AndN(block[4] + this.roundKeys[2], 0xFF);
        xx[6] = OpCodes.XorN(block[6], this.roundKeys[3]);

        // 32 rounds (lines 157-188)
        this._encryptRound(xx,  2,  7,6,5,4,3,2,1,0);
        this._encryptRound(xx,  3,  6,5,4,3,2,1,0,7);
        this._encryptRound(xx,  4,  5,4,3,2,1,0,7,6);
        this._encryptRound(xx,  5,  4,3,2,1,0,7,6,5);
        this._encryptRound(xx,  6,  3,2,1,0,7,6,5,4);
        this._encryptRound(xx,  7,  2,1,0,7,6,5,4,3);
        this._encryptRound(xx,  8,  1,0,7,6,5,4,3,2);
        this._encryptRound(xx,  9,  0,7,6,5,4,3,2,1);
        this._encryptRound(xx, 10,  7,6,5,4,3,2,1,0);
        this._encryptRound(xx, 11,  6,5,4,3,2,1,0,7);
        this._encryptRound(xx, 12,  5,4,3,2,1,0,7,6);
        this._encryptRound(xx, 13,  4,3,2,1,0,7,6,5);
        this._encryptRound(xx, 14,  3,2,1,0,7,6,5,4);
        this._encryptRound(xx, 15,  2,1,0,7,6,5,4,3);
        this._encryptRound(xx, 16,  1,0,7,6,5,4,3,2);
        this._encryptRound(xx, 17,  0,7,6,5,4,3,2,1);
        this._encryptRound(xx, 18,  7,6,5,4,3,2,1,0);
        this._encryptRound(xx, 19,  6,5,4,3,2,1,0,7);
        this._encryptRound(xx, 20,  5,4,3,2,1,0,7,6);
        this._encryptRound(xx, 21,  4,3,2,1,0,7,6,5);
        this._encryptRound(xx, 22,  3,2,1,0,7,6,5,4);
        this._encryptRound(xx, 23,  2,1,0,7,6,5,4,3);
        this._encryptRound(xx, 24,  1,0,7,6,5,4,3,2);
        this._encryptRound(xx, 25,  0,7,6,5,4,3,2,1);
        this._encryptRound(xx, 26,  7,6,5,4,3,2,1,0);
        this._encryptRound(xx, 27,  6,5,4,3,2,1,0,7);
        this._encryptRound(xx, 28,  5,4,3,2,1,0,7,6);
        this._encryptRound(xx, 29,  4,3,2,1,0,7,6,5);
        this._encryptRound(xx, 30,  3,2,1,0,7,6,5,4);
        this._encryptRound(xx, 31,  2,1,0,7,6,5,4,3);
        this._encryptRound(xx, 32,  1,0,7,6,5,4,3,2);
        this._encryptRound(xx, 33,  0,7,6,5,4,3,2,1);

        // Final transformation (lines 205-214)
        return [
          OpCodes.AndN(xx[1] + this.roundKeys[4], 0xFF),
          xx[2],
          OpCodes.XorN(xx[3], this.roundKeys[5]),
          xx[4],
          OpCodes.AndN(xx[5] + this.roundKeys[6], 0xFF),
          xx[6],
          OpCodes.XorN(xx[7], this.roundKeys[7]),
          xx[0]
        ];
      }
    }
  }

  // ===== REGISTRATION =====

  const hight = new HIGHTAlgorithm();

  if (!AlgorithmFramework.Find(hight.name)) {
    RegisterAlgorithm(hight);
  }

  // ===== EXPORTS =====

  return { HIGHTAlgorithm, HIGHTInstance };
}));
