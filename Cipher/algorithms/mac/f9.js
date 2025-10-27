/*
 * F9 MAC (3GPP Integrity Algorithm)
 * Professional implementation matching LibTomCrypt reference
 * (c)2006-2025 Hawkynt
 *
 * Block cipher-based MAC for 3GPP/UMTS
 * Uses KASUMI as underlying block cipher
 * Reference: LibTomCrypt f9.c, 3GPP TS 35.201
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/kasumi'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Ensure KASUMI is loaded (F9 depends on it)
    require('../block/kasumi.js');
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    root.F9 = factory(root.AlgorithmFramework, root.OpCodes);
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
          MacAlgorithm, IMacInstance, LinkItem, KeySize } = AlgorithmFramework;

  class F9Algorithm extends MacAlgorithm {
    constructor() {
      super();
      this.name = "F9";
      this.description = "F9 is the integrity algorithm used in 3GPP/UMTS mobile communications. Uses KASUMI block cipher with dual-key MAC construction for message authentication.";
      this.inventor = "3GPP";
      this.year = 1999;
      this.category = CategoryType.MAC;
      this.subCategory = "Block Cipher MAC";
      this.securityStatus = SecurityStatus.DEPRECATED; // KASUMI has known weaknesses
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = null; // International standard

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];  // KASUMI key size
      this.SupportedTagSizes = [new KeySize(4, 8, 1)];    // Typically 4 bytes

      this.documentation = [
        new LinkItem("3GPP TS 35.201", "https://www.3gpp.org/DynaReport/35201.htm"),
        new LinkItem("3GPP Security Algorithms", "https://www.3gpp.org/technologies/security")
      ];

      this.references = [
        new LinkItem("LibTomCrypt F9", "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/f9/f9_init.c")
      ];

      this.tests = [
        {
          text: "F9: 20-byte message (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/f9/f9_test.c",
          key: OpCodes.Hex8ToBytes("2bd6459f82c5b300952c49104881ff48"),
          input: OpCodes.Hex8ToBytes("38a6f056b8aefda9333234626339386137347940"),
          expected: OpCodes.Hex8ToBytes("46e00d4b")
        },
        {
          text: "F9: 105-byte message (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/f9/f9_test.c",
          key: OpCodes.Hex8ToBytes("83fd23a244a74cf358da3019f1722635"),
          input: OpCodes.Hex8ToBytes(
            "36af61444f302ad235c68716633c66fb750c266865d53c11ea05b1e9fa49c8398d48e1efa590" +
            "9d39479028" + "37f5ae96d5a05bc8d61ca8dbef1b13a4b4abfe4fb1006045b674bb5472930" +
            "4c382be53a5af05556176f6eaa2ef1d05e4b083181ee674cda5a485f74d7ac0"
          ),
          expected: OpCodes.Hex8ToBytes("95ae41ba")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // MACs have no inverse
      return new F9Instance(this);
    }
  }

  class F9Instance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this.blockCipher = null;
      this.modifiedKey = null;
      this.IV = null;
      this.ACC = null;
      this.buflen = 0;
      this.blockSize = 8; // KASUMI block size
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.blockCipher = null;
        this.modifiedKey = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16)`);
      }

      this._key = [...keyBytes];

      // Get KASUMI cipher
      const kasumiAlgo = AlgorithmFramework.Find("KASUMI");
      if (!kasumiAlgo) {
        throw new Error("KASUMI block cipher not available");
      }

      // Initialize block cipher with original key
      this.blockCipher = kasumiAlgo.CreateInstance(false);
      this.blockCipher.key = this._key;

      // Create modified key (key XOR 0xAA)
      this.modifiedKey = new Array(16);
      for (let i = 0; i < 16; ++i) {
        this.modifiedKey[i] = this._key[i] ^ 0xAA;
      }

      // Initialize state
      this.IV = new Uint8Array(this.blockSize);
      this.ACC = new Uint8Array(this.blockSize);
      this.buflen = 0;
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");

      const kasumiAlgo = AlgorithmFramework.Find("KASUMI");

      for (let i = 0; i < data.length; ++i) {
        // XOR input byte into IV buffer
        this.IV[this.buflen++] ^= data[i];

        // When buffer is full, process the block
        if (this.buflen === this.blockSize) {
          // Create fresh cipher instance for ECB encryption
          const cipher = kasumiAlgo.CreateInstance(false);
          cipher.key = this._key;

          // Encrypt IV in place
          cipher.Feed(Array.from(this.IV));
          const encrypted = cipher.Result();

          // Replace IV with encrypted version
          for (let j = 0; j < this.blockSize; ++j) {
            this.IV[j] = encrypted[j];
          }

          // XOR encrypted IV into accumulator
          for (let j = 0; j < this.blockSize; ++j) {
            this.ACC[j] ^= this.IV[j];
          }

          this.buflen = 0;
        }
      }
    }

    Result() {
      if (!this._key) throw new Error("Key not set");

      const kasumiAlgo = AlgorithmFramework.Find("KASUMI");

      // Process final partial block if present
      if (this.buflen !== 0) {
        // Create fresh cipher for encryption
        const cipher = kasumiAlgo.CreateInstance(false);
        cipher.key = this._key;

        // Encrypt IV
        cipher.Feed(Array.from(this.IV));
        const encrypted = cipher.Result();

        for (let i = 0; i < this.blockSize; ++i) {
          this.IV[i] = encrypted[i];
        }

        // XOR into accumulator
        for (let i = 0; i < this.blockSize; ++i) {
          this.ACC[i] ^= this.IV[i];
        }
      }

      // Re-key cipher with modified key
      const finalCipher = kasumiAlgo.CreateInstance(false);
      finalCipher.key = this.modifiedKey;

      // Encrypt accumulator to get final MAC
      finalCipher.Feed(Array.from(this.ACC));
      const tag = finalCipher.Result();

      // Reset for next operation
      this.IV.fill(0);
      this.ACC.fill(0);
      this.buflen = 0;

      // Return tag (typically first 4 bytes for F9)
      return tag;
    }
  }

  const algorithmInstance = new F9Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { F9Algorithm, F9Instance };
}));
