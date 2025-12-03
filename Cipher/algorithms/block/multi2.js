/*
 * MULTI2 Block Cipher
 * Professional implementation matching LibTomCrypt reference
 * (c)2006-2025 Hawkynt
 *
 * Used in DVB (Digital Video Broadcasting) systems
 * 64-bit block, 320-bit key, variable rounds (default 128)
 * Reference: LibTomCrypt multi2.c
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

  // MULTI2 constants
  const BLOCK_SIZE = 8;  // 64 bits
  const KEY_SIZE = 40;   // 320 bits
  const DEFAULT_ROUNDS = 128;

  // Pi functions
  function pi1(p) {
    p[1] ^= p[0];
  }

  function pi2(p, k) {
    let t = (p[1] + k[0]) >>> 0;
    t = (OpCodes.RotL32(t, 1) + t - 1) >>> 0;
    t = OpCodes.XorN(OpCodes.RotL32(t, 4), t) >>> 0;
    p[0] ^= t;
  }

  function pi3(p, k) {
    let t = (p[0] + k[1]) >>> 0;
    t = (OpCodes.RotL32(t, 2) + t + 1) >>> 0;
    t = OpCodes.XorN(OpCodes.RotL32(t, 8), t) >>> 0;
    t = (t + k[2]) >>> 0;
    t = (OpCodes.RotL32(t, 1) - t) >>> 0;
    t = OpCodes.XorN(OpCodes.RotL32(t, 16), (p[0] | t));
    p[1] ^= t;
  }

  function pi4(p, k) {
    let t = (p[1] + k[3]) >>> 0;
    t = (OpCodes.RotL32(t, 2) + t + 1) >>> 0;
    p[0] ^= t;
  }

  /**
 * MULTI2Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class MULTI2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();
      this.name = "MULTI2";
      this.description = "MULTI2 block cipher used in DVB (Digital Video Broadcasting) systems. Features 64-bit blocks with 320-bit keys and variable rounds for security flexibility.";
      this.inventor = "Hitachi";
      this.year = 1988;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Feistel Network";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.JP;

      this.SupportedKeySizes = [new KeySize(40, 40, 1)];
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)];
      this.SupportedRounds = [new KeySize(1, 255, 1)];

      this.documentation = [
        new LinkItem("DVB Specification", "https://www.dvb.org/"),
        new LinkItem("MULTI2 Overview", "https://en.wikipedia.org/wiki/MULTI2")
      ];

      this.references = [
        new LinkItem("LibTomCrypt MULTI2", "https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/multi2.c")
      ];

      this.tests = [
        {
          text: "MULTI2: Test vector 1 (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/multi2.c",
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000123456789abcdef"),
          rounds: 128,
          input: OpCodes.Hex8ToBytes("0000000000000001"),
          expected: OpCodes.Hex8ToBytes("f89440845e11cf89")
        },
        {
          text: "MULTI2: Test vector 2 (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/multi2.c",
          key: OpCodes.Hex8ToBytes("35919d960702e2ce8d0b583cc9c89d59a2ae964e878245ed3f2e62d63635d067b127b906e7562238"),
          rounds: 216,
          input: OpCodes.Hex8ToBytes("1fb46060d0b34fa5"),
          expected: OpCodes.Hex8ToBytes("ca84a93475c860e5")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MULTI2Instance(this, isInverse);
    }
  }

  /**
 * MULTI2 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MULTI2Instance extends IBlockCipherInstance {
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
      this._rounds = DEFAULT_ROUNDS;
      this.uk = new Uint32Array(8); // Scheduled key
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

      if (keyBytes.length !== KEY_SIZE) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${KEY_SIZE})`);
      }

      this._key = [...keyBytes];
      this._scheduleKey();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set rounds(value) {
      if (value < 1 || value > 255) {
        throw new Error(`Invalid rounds: ${value} (must be 1-255)`);
      }
      this._rounds = value;
    }

    get rounds() {
      return this._rounds;
    }

    _scheduleKey() {
      // Extract system key (sk) and data key (dk)
      const sk = new Uint32Array(8);
      const dk = new Uint32Array(2);

      for (let i = 0; i < 8; ++i) {
        sk[i] = OpCodes.Pack32BE(
          this._key[i * 4],
          this._key[i * 4 + 1],
          this._key[i * 4 + 2],
          this._key[i * 4 + 3]
        );
      }

      dk[0] = OpCodes.Pack32BE(this._key[32], this._key[33], this._key[34], this._key[35]);
      dk[1] = OpCodes.Pack32BE(this._key[36], this._key[37], this._key[38], this._key[39]);

      // Key schedule algorithm
      const p = [dk[0], dk[1]];
      let n = 0;

      pi1(p);
      pi2(p, [sk[0], sk[1], sk[2], sk[3]]);
      this.uk[n++] = p[0];
      pi3(p, [sk[0], sk[1], sk[2], sk[3]]);
      this.uk[n++] = p[1];
      pi4(p, [sk[0], sk[1], sk[2], sk[3]]);
      this.uk[n++] = p[0];
      pi1(p);
      this.uk[n++] = p[1];
      pi2(p, [sk[4], sk[5], sk[6], sk[7]]);
      this.uk[n++] = p[0];
      pi3(p, [sk[4], sk[5], sk[6], sk[7]]);
      this.uk[n++] = p[1];
      pi4(p, [sk[4], sk[5], sk[6], sk[7]]);
      this.uk[n++] = p[0];
      pi1(p);
      this.uk[n++] = p[1];
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
      if (this.inputBuffer.length % BLOCK_SIZE !== 0) {
        throw new Error(`Input must be multiple of ${BLOCK_SIZE} bytes`);
      }

      const output = [];

      for (let offset = 0; offset < this.inputBuffer.length; offset += BLOCK_SIZE) {
        // Load block as big-endian
        const p = [
          OpCodes.Pack32BE(
            this.inputBuffer[offset],
            this.inputBuffer[offset + 1],
            this.inputBuffer[offset + 2],
            this.inputBuffer[offset + 3]
          ),
          OpCodes.Pack32BE(
            this.inputBuffer[offset + 4],
            this.inputBuffer[offset + 5],
            this.inputBuffer[offset + 6],
            this.inputBuffer[offset + 7]
          )
        ];

        // Encrypt or decrypt
        if (this.isInverse) {
          this._decrypt(p);
        } else {
          this._encrypt(p);
        }

        // Store block as big-endian
        const bytes0 = OpCodes.Unpack32BE(p[0]);
        const bytes1 = OpCodes.Unpack32BE(p[1]);
        output.push(...bytes0, ...bytes1);
      }

      this.inputBuffer = [];
      return output;
    }

    _encrypt(p) {
      let n = 0;
      let t = 0;

      while (true) {
        pi1(p);
        if (++n === this._rounds) break;
        pi2(p, [this.uk[t], this.uk[t + 1], this.uk[t + 2], this.uk[t + 3]]);
        if (++n === this._rounds) break;
        pi3(p, [this.uk[t], this.uk[t + 1], this.uk[t + 2], this.uk[t + 3]]);
        if (++n === this._rounds) break;
        pi4(p, [this.uk[t], this.uk[t + 1], this.uk[t + 2], this.uk[t + 3]]);
        if (++n === this._rounds) break;
        t ^= 4;
      }
    }

    _decrypt(p) {
      let n = this._rounds;
      let t = 4 * OpCodes.AndN(OpCodes.Shr32((n - 1), 2), 1);

      while (true) {
        const mod = n <= 4 ? n : ((n - 1) % 4) + 1;
        switch (mod) {
          case 4:
            pi4(p, [this.uk[t], this.uk[t + 1], this.uk[t + 2], this.uk[t + 3]]);
            --n;
            /* falls through */
          case 3:
            pi3(p, [this.uk[t], this.uk[t + 1], this.uk[t + 2], this.uk[t + 3]]);
            --n;
            /* falls through */
          case 2:
            pi2(p, [this.uk[t], this.uk[t + 1], this.uk[t + 2], this.uk[t + 3]]);
            --n;
            /* falls through */
          case 1:
            pi1(p);
            --n;
            break;
          case 0:
            return;
        }
        t ^= 4;
      }
    }
  }

  const algorithmInstance = new MULTI2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MULTI2Algorithm, MULTI2Instance };
}));
