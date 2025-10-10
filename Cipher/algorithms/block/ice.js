/*
 * ICE (Information Concealment Engine) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Implements the ICE cipher with configurable rounds:
 * - Thin-ICE: 8 rounds with 64-bit key
 * - ICE (Level 1): 16 rounds with 64-bit key
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

  class IceAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ICE";
      this.description = "Information Concealment Engine with configurable rounds (Thin-ICE: 8 rounds, ICE: 16 rounds). 64-bit Feistel block cipher with key-dependent S-boxes designed by Matthew Kwan.";
      this.inventor = "Matthew Kwan";
      this.year = 1997;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AU;

      // Algorithm capabilities
      this.SupportedKeySizes = [
        new KeySize(8, 8, 0) // Fixed 8-byte (64-bit) key
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
          text: "Thin-ICE (8 rounds) Official Test Vector",
          uri: "https://darkside.com.au/ice/overview.html",
          rounds: 8,
          input: OpCodes.Hex8ToBytes("fedcba9876543210"),
          key: OpCodes.Hex8ToBytes("deadbeef01234567"),
          expected: OpCodes.Hex8ToBytes("de240d83a00a9cc0")
        },
        {
          text: "ICE (16 rounds) Official Test Vector",
          uri: "https://darkside.com.au/ice/overview.html",
          rounds: 16,
          input: OpCodes.Hex8ToBytes("fedcba9876543210"),
          key: OpCodes.Hex8ToBytes("deadbeef01234567"),
          expected: OpCodes.Hex8ToBytes("7d6ef1ef30d47a96")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new IceInstance(this, isInverse);
    }
  }

  class IceInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.keySchedule = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;

      // Default to 16 rounds (standard ICE)
      this._rounds = 16;

      // Initialize static S-boxes (shared across all instances)
      if (!IceInstance.spBoxInitialized) {
        IceInstance._initSPBoxes();
        IceInstance.spBoxInitialized = true;
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
      // Validate rounds (must be 8 or 16 for ICE/Thin-ICE)
      if (value !== 8 && value !== 16) {
        throw new Error(`Invalid rounds: ${value} (must be 8 for Thin-ICE or 16 for ICE)`);
      }

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
      IceInstance.spBox = [];

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
        IceInstance.spBox[i] = new Array(1024);

        for (let j = 0; j < 1024; ++j) {
          const col = (j >>> 1) & 0xff;
          const row = (j & 0x1) | ((j & 0x200) >>> 8);

          // Apply Galois Field exponentiation and permutation
          const x = IceInstance._gfExp7(col ^ sXor[i][row], sMod[i][row]) << (24 - i * 8);
          IceInstance.spBox[i][j] = IceInstance._perm32(x, pBox);
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

      let x = IceInstance._gfMult(b, b, m);
      x = IceInstance._gfMult(b, x, m);
      x = IceInstance._gfMult(x, x, m);
      return IceInstance._gfMult(b, x, m);
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

    // Generate key schedule for ICE (8 or 16 rounds)
    _generateKeySchedule(key) {
      const schedule = new Array(this._rounds);
      for (let i = 0; i < this._rounds; ++i) {
        schedule[i] = new Array(3);
      }

      this.keySchedule = schedule;

      // Extract 4 16-bit words from key (big-endian)
      const kb = new Array(4);
      for (let j = 0; j < 4; ++j) {
        kb[3 - j] = ((key[j * 2] & 0xff) << 8) | (key[j * 2 + 1] & 0xff);
      }

      if (this._rounds === 8) {
        // Thin-ICE: Only build first 8 rounds
        this._scheduleBuild(kb, 0, 0);
      } else {
        // Standard ICE (16 rounds): Build forward and reverse
        this._scheduleBuild(kb, 0, 0);
        this._scheduleBuild(kb, 8, 8);
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
      return (IceInstance.spBox[0][al >>> 10] |
              IceInstance.spBox[1][al & 0x3ff] |
              IceInstance.spBox[2][ar >>> 10] |
              IceInstance.spBox[3][ar & 0x3ff]) >>> 0;
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

      // Feistel network - 8 or 16 rounds
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
  IceInstance.spBoxInitialized = false;
  IceInstance.spBox = null;

  // ===== REGISTRATION =====

  const algorithmInstance = new IceAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { IceAlgorithm, IceInstance };
}));
