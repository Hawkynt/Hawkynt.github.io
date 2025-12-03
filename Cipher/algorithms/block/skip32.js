/* Skip32 Block Cipher
 * 32-bit block cipher based on Skipjack
 * (c)2006-2025 Hawkynt
 *
 * Written by Greg Rose, QUALCOMM Australia, 1999/04/27
 * Not copyright, no rights reserved.
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

  /**
 * Skip32 - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class Skip32 extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Skip32";
      this.description = "32-bit block cipher based on Skipjack's F-table. Uses 24-round Feistel structure with 80-bit key. Designed for obfuscating small integers.";
      this.inventor = "Greg Rose (QUALCOMM)";
      this.year = 1999;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.AU;

      this.SupportedKeySizes = [new KeySize(10, 10, 1)];  // 80-bit key
      this.SupportedBlockSizes = [new KeySize(4, 4, 1)];  // 32-bit block

      this.documentation = [
        new LinkItem("Original Implementation", "https://github.com/dverite/cryptint/blob/master/skip32.c")
      ];

      this.references = [
        new LinkItem("Skipjack F-Table Reference", "https://github.com/weidai11/cryptopp/blob/master/skipjack.cpp")
      ];

      this.tests = [
        {
          text: "node-skip32 test vector",
          uri: "https://github.com/femto113/node-skip32",
          input: OpCodes.Hex8ToBytes("00000001"),
          key: OpCodes.Hex8ToBytes("9b21960e1acf245f1493"),
          expected: OpCodes.Hex8ToBytes("22e9ffa6")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Skip32Instance(this, isInverse);
    }
  }

  /**
 * Skip32 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Skip32Instance extends IBlockCipherInstance {
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
      this.BlockSize = 4;
      this.KeySize = 0;

      // Skipjack F-table
      this.ftable = new Uint8Array([
        0xa3,0xd7,0x09,0x83,0xf8,0x48,0xf6,0xf4,0xb3,0x21,0x15,0x78,0x99,0xb1,0xaf,0xf9,
        0xe7,0x2d,0x4d,0x8a,0xce,0x4c,0xca,0x2e,0x52,0x95,0xd9,0x1e,0x4e,0x38,0x44,0x28,
        0x0a,0xdf,0x02,0xa0,0x17,0xf1,0x60,0x68,0x12,0xb7,0x7a,0xc3,0xe9,0xfa,0x3d,0x53,
        0x96,0x84,0x6b,0xba,0xf2,0x63,0x9a,0x19,0x7c,0xae,0xe5,0xf5,0xf7,0x16,0x6a,0xa2,
        0x39,0xb6,0x7b,0x0f,0xc1,0x93,0x81,0x1b,0xee,0xb4,0x1a,0xea,0xd0,0x91,0x2f,0xb8,
        0x55,0xb9,0xda,0x85,0x3f,0x41,0xbf,0xe0,0x5a,0x58,0x80,0x5f,0x66,0x0b,0xd8,0x90,
        0x35,0xd5,0xc0,0xa7,0x33,0x06,0x65,0x69,0x45,0x00,0x94,0x56,0x6d,0x98,0x9b,0x76,
        0x97,0xfc,0xb2,0xc2,0xb0,0xfe,0xdb,0x20,0xe1,0xeb,0xd6,0xe4,0xdd,0x47,0x4a,0x1d,
        0x42,0xed,0x9e,0x6e,0x49,0x3c,0xcd,0x43,0x27,0xd2,0x07,0xd4,0xde,0xc7,0x67,0x18,
        0x89,0xcb,0x30,0x1f,0x8d,0xc6,0x8f,0xaa,0xc8,0x74,0xdc,0xc9,0x5d,0x5c,0x31,0xa4,
        0x70,0x88,0x61,0x2c,0x9f,0x0d,0x2b,0x87,0x50,0x82,0x54,0x64,0x26,0x7d,0x03,0x40,
        0x34,0x4b,0x1c,0x73,0xd1,0xc4,0xfd,0x3b,0xcc,0xfb,0x7f,0xab,0xe6,0x3e,0x5b,0xa5,
        0xad,0x04,0x23,0x9c,0x14,0x51,0x22,0xf0,0x29,0x79,0x71,0x7e,0xff,0x8c,0x0e,0xe2,
        0x0c,0xef,0xbc,0x72,0x75,0x6f,0x37,0xa1,0xec,0xd3,0x8e,0x62,0x8b,0x86,0x10,0xe8,
        0x08,0x77,0x11,0xbe,0x92,0x4f,0x24,0xc5,0x32,0x36,0x9d,0xcf,0xf3,0xa6,0xbb,0xac,
        0x5e,0x6c,0xa9,0x13,0x57,0x25,0xb5,0xe3,0xbd,0xa8,0x3a,0x01,0x05,0x59,0x2a,0x46
      ]);
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

      if (keyBytes.length !== 10) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 10)`);
      }

      this._key = [...keyBytes];
      this.KeySize = 10;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    _g(w, k) {
      // G-function: 4 rounds of Feistel using F-table
      let g1 = OpCodes.AndN(OpCodes.Shr32(w, 8), 0xFF);
      let g2 = OpCodes.AndN(w, 0xFF);

      const g3 = OpCodes.XorN(this.ftable[OpCodes.XorN(g2, this._key[(4 * k) % 10])], g1);
      const g4 = OpCodes.XorN(this.ftable[OpCodes.XorN(g3, this._key[(4 * k + 1) % 10])], g2);
      const g5 = OpCodes.XorN(this.ftable[OpCodes.XorN(g4, this._key[(4 * k + 2) % 10])], g3);
      const g6 = OpCodes.XorN(this.ftable[OpCodes.XorN(g5, this._key[(4 * k + 3) % 10])], g4);

      return OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(g5, 8), g6), 0xFFFF);
    }

    _encryptBlock(block) {
      // Load 32-bit value (big-endian)
      let wl = OpCodes.OrN(OpCodes.Shl32(block[0], 8), block[1]);  // High 16 bits
      let wr = OpCodes.OrN(OpCodes.Shl32(block[2], 8), block[3]);  // Low 16 bits

      // 24 rounds of Feistel (2 rounds per iteration)
      let k = 0;
      for (let i = 0; i < 12; ++i) {
        wr = OpCodes.XorN(wr, OpCodes.XorN(this._g(wl, k), k));
        k++;
        wl = OpCodes.XorN(wl, OpCodes.XorN(this._g(wr, k), k));
        k++;
      }

      // Output with wr and wl swapped
      return [
        OpCodes.AndN(OpCodes.Shr32(wr, 8), 0xFF),
        OpCodes.AndN(wr, 0xFF),
        OpCodes.AndN(OpCodes.Shr32(wl, 8), 0xFF),
        OpCodes.AndN(wl, 0xFF)
      ];
    }

    _decryptBlock(block) {
      // Load 32-bit value (big-endian)
      let wl = OpCodes.OrN(OpCodes.Shl32(block[0], 8), block[1]);
      let wr = OpCodes.OrN(OpCodes.Shl32(block[2], 8), block[3]);

      // 24 rounds in reverse (2 rounds per iteration, same pattern as encrypt but k goes backwards)
      let k = 23;
      for (let i = 0; i < 12; ++i) {
        wr = OpCodes.XorN(wr, OpCodes.XorN(this._g(wl, k), k));
        k--;
        wl = OpCodes.XorN(wl, OpCodes.XorN(this._g(wr, k), k));
        k--;
      }

      // Output with wr and wl swapped
      return [
        OpCodes.AndN(OpCodes.Shr32(wr, 8), 0xFF),
        OpCodes.AndN(wr, 0xFF),
        OpCodes.AndN(OpCodes.Shr32(wl, 8), 0xFF),
        OpCodes.AndN(wl, 0xFF)
      ];
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
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      this.inputBuffer = [];
      return output;
    }
  }

  RegisterAlgorithm(new Skip32());

}));
