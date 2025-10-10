/*
 * ICE 2 (Information Concealment Engine, Level 2) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Implements the ICE cipher with level 2 (32 rounds, 128-bit key).
 * ICE is a Feistel block cipher designed by Matthew Kwan in 1997.
 * 64-bit block size with variable rounds based on level.
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class Ice2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ICE-2";
      this.description = "Information Concealment Engine with level 2 (32 rounds, 128-bit key). 64-bit Feistel block cipher with key-dependent S-boxes designed by Matthew Kwan.";
      this.inventor = "Matthew Kwan";
      this.year = 1997;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AU;

      // Algorithm capabilities
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0) // Fixed 16-byte (128-bit) key for ICE-2
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0) // Fixed 8-byte (64-bit) blocks
      ];

      // Documentation
      this.documentation = [
        new LinkItem("ICE Algorithm Specification", "https://darkside.com.au/ice/description.html"),
        new LinkItem("ICE Home Page", "https://darkside.com.au/ice/"),
        new LinkItem("Fast Software Encryption 1997 Paper", "https://link.springer.com/chapter/10.1007/BFb0052335")
      ];

      this.references = [
        new LinkItem("Original C Implementation", "https://darkside.com.au/ice/ice-doc-C.html"),
        new LinkItem("ICE Algorithm Overview", "https://darkside.com.au/ice/overview.html")
      ];

      // Official test vectors from Matthew Kwan's ICE specification
      this.tests = [
        {
          text: "ICE-2 Official Test Vector",
          uri: "https://darkside.com.au/ice/overview.html",
          input: OpCodes.Hex8ToBytes("fedcba9876543210"),
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          expected: OpCodes.Hex8ToBytes("f94840d86972f21c")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new Ice2Instance(this, isInverse);
    }
  }

  class Ice2Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.keySchedule = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;

      // ICE-2 has level 2, meaning 32 rounds (16 * 2)
      this._rounds = 32;

      // Initialize static S-boxes (shared across all instances)
      if (!Ice2Instance.spBoxInitialized) {
        Ice2Instance._initSPBoxes();
        Ice2Instance.spBoxInitialized = true;
      }

      // Initialize constants
      this._initConstants();
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.keySchedule = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.keySchedule = this._generateKeySchedule(keyBytes);
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    get rounds() {
      return this._rounds;
    }

    set rounds(value) {
      this._rounds = value;
      // Regenerate key schedule if key is already set
      if (this._key) {
        this.keySchedule = this._generateKeySchedule(this._key);
      }
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];

      // Process each 8-byte block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];
      return output;
    }

    _initConstants() {
      // S-box moduli for Galois Field operations
      this.sMod = [
        [333, 313, 505, 369],
        [379, 375, 319, 391],
        [361, 445, 451, 397],
        [397, 425, 395, 505]
      ];

      // S-box XOR constants
      this.sXor = [
        [0x83, 0x85, 0x9b, 0xcd],
        [0xcc, 0xa7, 0xad, 0x41],
        [0x4b, 0x2e, 0xd4, 0x33],
        [0xea, 0xcb, 0x2e, 0x04]
      ];

      // P-box bit positions (for 32-bit permutation)
      this.pBox = [
        0x00000001, 0x00000080, 0x00000400, 0x00002000,
        0x00080000, 0x00200000, 0x01000000, 0x40000000,
        0x00000008, 0x00000020, 0x00000100, 0x00004000,
        0x00010000, 0x00800000, 0x04000000, 0x20000000,
        0x00000004, 0x00000010, 0x00000200, 0x00008000,
        0x00020000, 0x00400000, 0x08000000, 0x10000000,
        0x00000002, 0x00000040, 0x00000800, 0x00001000,
        0x00040000, 0x00100000, 0x02000000, 0x80000000
      ];

      // Key rotation schedule
      this.keyRot = [0, 1, 2, 3, 2, 1, 3, 0, 1, 3, 2, 0, 3, 1, 0, 2];
    }

    // Static S/P-box initialization (shared across all instances)
    static _initSPBoxes() {
      Ice2Instance.spBox = [];

      // S-box moduli and XOR constants for initialization
      const sMod = [
        [333, 313, 505, 369],
        [379, 375, 319, 391],
        [361, 445, 451, 397],
        [397, 425, 395, 505]
      ];

      const sXor = [
        [0x83, 0x85, 0x9b, 0xcd],
        [0xcc, 0xa7, 0xad, 0x41],
        [0x4b, 0x2e, 0xd4, 0x33],
        [0xea, 0xcb, 0x2e, 0x04]
      ];

      const pBox = [
        0x00000001, 0x00000080, 0x00000400, 0x00002000,
        0x00080000, 0x00200000, 0x01000000, 0x40000000,
        0x00000008, 0x00000020, 0x00000100, 0x00004000,
        0x00010000, 0x00800000, 0x04000000, 0x20000000,
        0x00000004, 0x00000010, 0x00000200, 0x00008000,
        0x00020000, 0x00400000, 0x08000000, 0x10000000,
        0x00000002, 0x00000040, 0x00000800, 0x00001000,
        0x00040000, 0x00100000, 0x02000000, 0x80000000
      ];

      // Initialize 4 S-boxes, each with 1024 entries
      for (let i = 0; i < 4; ++i) {
        Ice2Instance.spBox[i] = new Array(1024);

        for (let j = 0; j < 1024; ++j) {
          const col = (j >>> 1) & 0xff;
          const row = (j & 0x1) | ((j & 0x200) >>> 8);

          // Apply Galois Field exponentiation and permutation
          const x = Ice2Instance._gfExp7(col ^ sXor[i][row], sMod[i][row]) << (24 - i * 8);
          Ice2Instance.spBox[i][j] = Ice2Instance._perm32(x, pBox);
        }
      }
    }

    // Galois Field multiplication
    static _gfMult(a, b, m) {
      let res = 0;

      while (b !== 0) {
        if ((b & 1) !== 0) {
          res ^= a;
        }

        a <<= 1;
        b >>>= 1;

        if (a >= 256) {
          a ^= m;
        }
      }

      return res;
    }

    // Galois Field exponentiation to power of 7
    static _gfExp7(b, m) {
      if (b === 0) return 0;

      let x = Ice2Instance._gfMult(b, b, m);
      x = Ice2Instance._gfMult(b, x, m);
      x = Ice2Instance._gfMult(x, x, m);
      return Ice2Instance._gfMult(b, x, m);
    }

    // ICE 32-bit permutation
    static _perm32(x, pBox) {
      let res = 0;
      let i = 0;

      while (x !== 0) {
        if ((x & 1) !== 0) {
          res |= pBox[i];
        }
        ++i;
        x >>>= 1;
      }

      return res >>> 0;
    }

    // Build 8 rounds of key schedule
    _scheduleBuild(kb, n, krotIdx) {
      for (let i = 0; i < 8; ++i) {
        const kr = this.keyRot[krotIdx + i];
        const subkey = this.keySchedule[n + i];

        // Initialize subkey to zeros
        for (let j = 0; j < 3; ++j) {
          subkey[j] = 0;
        }

        // Build subkey from key bits
        for (let j = 0; j < 15; ++j) {
          const currSk = j % 3;

          for (let k = 0; k < 4; ++k) {
            const kbIdx = (kr + k) & 3;
            const bit = kb[kbIdx] & 1;

            subkey[currSk] = (subkey[currSk] << 1) | bit;
            kb[kbIdx] = (kb[kbIdx] >>> 1) | ((bit ^ 1) << 15);
          }
        }
      }
    }

    // Generate key schedule for ICE-2 (32 rounds)
    _generateKeySchedule(key) {
      const schedule = new Array(this._rounds);
      for (let i = 0; i < this._rounds; ++i) {
        schedule[i] = new Array(3);
      }

      this.keySchedule = schedule;

      // ICE-2 has level 2 (size = 2)
      const size = 2;
      const kb = new Array(4);

      for (let i = 0; i < size; ++i) {
        // Extract 4 16-bit words from key (big-endian)
        for (let j = 0; j < 4; ++j) {
          kb[3 - j] = ((key[i * 8 + j * 2] & 0xff) << 8) | (key[i * 8 + j * 2 + 1] & 0xff);
        }

        // Build forward rounds
        this._scheduleBuild(kb, i * 8, 0);
        // Build reverse rounds
        this._scheduleBuild(kb, this._rounds - 8 - i * 8, 8);
      }

      return schedule;
    }

    // ICE round function
    _roundFunc(p, subkey) {
      // Extract and expand right half
      let tl = ((p >>> 16) & 0x3ff) | (((p >>> 14) | (p << 18)) & 0xffc00);
      let tr = (p & 0x3ff) | ((p << 2) & 0xffc00);

      // Key-dependent bit selection
      let al = subkey[2] & (tl ^ tr);
      let ar = al ^ tr;
      al ^= tl;

      // XOR with subkey
      al ^= subkey[0];
      ar ^= subkey[1];

      // S-box substitution and P-box permutation (combined in spBox)
      return (Ice2Instance.spBox[0][al >>> 10] |
              Ice2Instance.spBox[1][al & 0x3ff] |
              Ice2Instance.spBox[2][ar >>> 10] |
              Ice2Instance.spBox[3][ar & 0x3ff]) >>> 0;
    }

    _encryptBlock(plaintext) {
      // Pack plaintext bytes into two 32-bit words (big-endian)
      let l = 0, r = 0;

      for (let i = 0; i < 4; ++i) {
        l |= (plaintext[i] & 0xff) << (24 - i * 8);
        r |= (plaintext[i + 4] & 0xff) << (24 - i * 8);
      }

      l = l >>> 0;
      r = r >>> 0;

      // Feistel network - 32 rounds for ICE-2
      for (let i = 0; i < this._rounds; i += 2) {
        l ^= this._roundFunc(r, this.keySchedule[i]);
        r ^= this._roundFunc(l, this.keySchedule[i + 1]);
      }

      // Unpack to bytes (big-endian, reversed order)
      const ciphertext = new Array(8);
      for (let i = 0; i < 4; ++i) {
        ciphertext[3 - i] = (r >>> 0) & 0xff;
        ciphertext[7 - i] = (l >>> 0) & 0xff;
        r >>>= 8;
        l >>>= 8;
      }

      return ciphertext;
    }

    _decryptBlock(ciphertext) {
      // Pack ciphertext bytes into two 32-bit words (big-endian)
      let l = 0, r = 0;

      for (let i = 0; i < 4; ++i) {
        l |= (ciphertext[i] & 0xff) << (24 - i * 8);
        r |= (ciphertext[i + 4] & 0xff) << (24 - i * 8);
      }

      l = l >>> 0;
      r = r >>> 0;

      // Feistel network - reverse order for decryption
      for (let i = this._rounds - 1; i > 0; i -= 2) {
        l ^= this._roundFunc(r, this.keySchedule[i]);
        r ^= this._roundFunc(l, this.keySchedule[i - 1]);
      }

      // Unpack to bytes (big-endian, reversed order)
      const plaintext = new Array(8);
      for (let i = 0; i < 4; ++i) {
        plaintext[3 - i] = (r >>> 0) & 0xff;
        plaintext[7 - i] = (l >>> 0) & 0xff;
        r >>>= 8;
        l >>>= 8;
      }

      return plaintext;
    }
  }

  // Static property initialization flag
  Ice2Instance.spBoxInitialized = false;
  Ice2Instance.spBox = null;

  // ===== REGISTRATION =====

  const algorithmInstance = new Ice2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Ice2Algorithm, Ice2Instance };
}));
