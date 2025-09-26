/*
 * GOST 28147-89 Block Cipher Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * Reference-aligned with Crypto++ TestParam S-box tables.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["../../AlgorithmFramework", "../../OpCodes"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("../../AlgorithmFramework"),
      require("../../OpCodes")
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
})((function () {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof window !== "undefined") return window;
  if (typeof global !== "undefined") return global;
  if (typeof self !== "undefined") return self;
  throw new Error("Unable to locate global object");
})(), function (AlgorithmFramework, OpCodes) {
  "use strict";

  if (!AlgorithmFramework) {
    throw new Error("AlgorithmFramework dependency is required");
  }

  if (!OpCodes) {
    throw new Error("OpCodes dependency is required");
  }

  const {
    RegisterAlgorithm,
    CategoryType,
    SecurityStatus,
    ComplexityType,
    CountryCode,
    BlockCipherAlgorithm,
    IBlockCipherInstance,
    KeySize,
    LinkItem,
    Vulnerability
  } = AlgorithmFramework;

  const BLOCK_SIZE = 8;
  const KEY_BYTES = 32;

  // Precompute round tables using Crypto++ TestParam S-box rotations
  const Gost28147Tables = (() => {
    const baseSBoxes = [
      [4, 10, 9, 2, 13, 8, 0, 14, 6, 11, 1, 12, 7, 15, 5, 3],
      [14, 11, 4, 12, 6, 13, 15, 10, 2, 3, 8, 1, 0, 7, 5, 9],
      [5, 8, 1, 13, 10, 3, 4, 2, 14, 15, 12, 7, 6, 0, 9, 11],
      [7, 13, 10, 1, 0, 8, 9, 15, 14, 4, 6, 12, 11, 2, 5, 3],
      [6, 12, 7, 1, 5, 15, 13, 8, 4, 10, 9, 14, 0, 3, 11, 2],
      [4, 11, 10, 0, 7, 2, 1, 13, 3, 6, 8, 5, 9, 12, 15, 14],
      [13, 11, 4, 1, 3, 15, 5, 9, 0, 10, 14, 7, 6, 8, 2, 12],
      [1, 15, 13, 0, 5, 7, 10, 4, 9, 2, 3, 14, 6, 11, 8, 12]
    ];

    const rotation = [11, 19, 27, 3];
    const tables = [
      new Uint32Array(256),
      new Uint32Array(256),
      new Uint32Array(256),
      new Uint32Array(256)
    ];

    for (let i = 0; i < 4; i++) {
      const lowRow = baseSBoxes[2 * i];
      const highRow = baseSBoxes[(2 * i) + 1];
      const table = tables[i];
      for (let j = 0; j < 256; j++) {
        const combined = lowRow[j & 0x0f] | (highRow[j >>> 4] << 4);
        table[j] = OpCodes.RotL32(combined, rotation[i]);
      }
    }

    const exportedSBoxes = baseSBoxes.map(row => Object.freeze(row.slice()));
    return {
      sBoxes: Object.freeze(exportedSBoxes),
      T0: tables[0],
      T1: tables[1],
      T2: tables[2],
      T3: tables[3]
    };
  })();

  function gostRound(word, keyWord) {
    const sum = OpCodes.Add32(word, keyWord);
    const b0 = sum & 0xFF;
    const b1 = (sum >>> 8) & 0xFF;
    const b2 = (sum >>> 16) & 0xFF;
    const b3 = (sum >>> 24) & 0xFF;
    return (
      Gost28147Tables.T0[b0] ^
      Gost28147Tables.T1[b1] ^
      Gost28147Tables.T2[b2] ^
      Gost28147Tables.T3[b3]
    ) >>> 0;
  }

  class Gost28147Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "GOST 28147-89";
      this.description = "Educational implementation of the Soviet/Russian GOST 28147-89 block cipher (Magma). 64-bit Feistel network with 256-bit keys using the TestParam S-box set.";
      this.inventor = "Soviet Union cryptographers";
      this.year = 1989;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [
        new KeySize(KEY_BYTES, KEY_BYTES, 0)
      ];
      this.SupportedBlockSizes = [
        new KeySize(BLOCK_SIZE, BLOCK_SIZE, 0)
      ];

      this.documentation = [
        new LinkItem("GOST 28147-89 Standard (TC26)", "https://www.tc26.ru/en/standard/gost/"),
        new LinkItem("RFC 5830 - GOST 28147-89 Cipher Suites for TLS", "https://www.rfc-editor.org/rfc/rfc5830"),
        new LinkItem("Wikipedia - GOST block cipher", "https://en.wikipedia.org/wiki/GOST_(block_cipher)")
      ];

      this.references = [
        new LinkItem("RFC 4357 - Additional Cryptographic Algorithms for GOST 28147-89", "https://www.rfc-editor.org/rfc/rfc4357"),
        new LinkItem("Crypto++ GOST Implementation", "https://github.com/weidai11/cryptopp/blob/master/gost.cpp"),
        new LinkItem("Crypto++ GOST validation vectors", "https://github.com/weidai11/cryptopp/blob/master/TestData/gostval.dat"),
        new LinkItem("OpenSSL GOST Engine", "https://github.com/openssl/openssl/tree/master/engines/e_gost.c")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Weak key classes",
          "Some keys may exhibit weak differential properties and reduced cycle lengths.",
          "Use uniformly random keys and avoid structured key material."
        ),
        new Vulnerability(
          "S-box dependency",
          "Security depends heavily on the selected S-box set.",
          "Use standardized or audited S-box collections (e.g., TestParam, CryptoPro)."
        )
      ];

      this.tests = [
        {
          text: "Crypto++ validation vector 1 (TestParam S-box)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/gostval.dat",
          input: OpCodes.Hex8ToBytes("0DF82802B741A292"),
          key: OpCodes.Hex8ToBytes("BE5EC2006CFF9DCF52354959F1FF0CBFE95061B5A648C10387069C25997C0672"),
          expected: OpCodes.Hex8ToBytes("07F9027DF7F7DF89")
        },
        {
          text: "Crypto++ validation vector 4 (TestParam S-box)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/gostval.dat",
          input: OpCodes.Hex8ToBytes("D4C05323A4F7A7B5"),
          key: OpCodes.Hex8ToBytes("728FEE32F04B4C654AD7F607D71C660C2C2670D7C999713233149A1C0C17A1F0"),
          expected: OpCodes.Hex8ToBytes("4D1F2E6B0D9DE2CE")
        },
        {
          text: "Crypto++ validation vector 9 (TestParam S-box)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/gostval.dat",
          input: OpCodes.Hex8ToBytes("40140A581D78BB49"),
          key: OpCodes.Hex8ToBytes("620153EE18096E622B6BFE4FF26BD6C4A3C8F4ED705FEB5943CC3B5AB93FC11C"),
          expected: OpCodes.Hex8ToBytes("D48ADCE9AE2DF9A7")
        }
      ];

      this.GOST_SBOXES = Gost28147Tables.sBoxes;
    }

    CreateInstance(isInverse = false) {
      return new Gost28147Instance(this, isInverse);
    }
  }

  class Gost28147Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse) {
      super(algorithm);
      this.isInverse = !!isInverse;
      this._key = null;
      this.subkeys = null;
      this.inputBuffer = [];
      this.BlockSize = BLOCK_SIZE;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        if (this._key) {
          OpCodes.ClearArray(this._key);
        }
        if (this.subkeys) {
          OpCodes.ClearArray(this.subkeys);
        }
        this._key = null;
        this.subkeys = null;
        this.KeySize = 0;
        return;
      }

      if (keyBytes.length !== KEY_BYTES) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. GOST 28147-89 requires 32 bytes (256 bits).");
      }

      if (this._key) {
        OpCodes.ClearArray(this._key);
      }
      if (this.subkeys) {
        OpCodes.ClearArray(this.subkeys);
      }

      const keyCopy = Uint8Array.from(keyBytes);
      this._key = keyCopy;
      this.subkeys = this._expandKey(keyCopy);
      this.KeySize = keyCopy.length;
    }

    get key() {
      return this._key ? Array.from(this._key) : null;
    }

    Feed(data) {
      if (!data || data.length === 0) {
        return;
      }
      if (!this._key) {
        throw new Error("Key not set");
      }
      for (let i = 0; i < data.length; i++) {
        this.inputBuffer.push(data[i] & 0xFF);
      }
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }
      if (this.inputBuffer.length % BLOCK_SIZE !== 0) {
        throw new Error("Input length must be multiple of " + BLOCK_SIZE + " bytes");
      }

      const output = [];
      for (let offset = 0; offset < this.inputBuffer.length; offset += BLOCK_SIZE) {
        const block = this.inputBuffer.slice(offset, offset + BLOCK_SIZE);
        const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
        output.push.apply(output, processed);
        OpCodes.ClearArray(block);
      }

      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer.length = 0;

      return output;
    }

    Dispose() {
      this.key = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer.length = 0;
    }

    _encryptBlock(block) {
      if (!block || block.length !== BLOCK_SIZE) {
        throw new Error("GOST 28147-89 requires exactly 8 bytes per block");
      }

      let n1 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let n2 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this.subkeys;

      const applyPair = (firstKey, secondKey) => {
        n2 = (n2 ^ gostRound(n1, firstKey)) >>> 0;
        n1 = (n1 ^ gostRound(n2, secondKey)) >>> 0;
      };

      for (let cycle = 0; cycle < 3; cycle++) {
        applyPair(k[0], k[1]);
        applyPair(k[2], k[3]);
        applyPair(k[4], k[5]);
        applyPair(k[6], k[7]);
      }

      n2 = (n2 ^ gostRound(n1, k[7])) >>> 0;
      n1 = (n1 ^ gostRound(n2, k[6])) >>> 0;
      n2 = (n2 ^ gostRound(n1, k[5])) >>> 0;
      n1 = (n1 ^ gostRound(n2, k[4])) >>> 0;
      n2 = (n2 ^ gostRound(n1, k[3])) >>> 0;
      n1 = (n1 ^ gostRound(n2, k[2])) >>> 0;
      n2 = (n2 ^ gostRound(n1, k[1])) >>> 0;
      n1 = (n1 ^ gostRound(n2, k[0])) >>> 0;

      const leftBytes = OpCodes.Unpack32LE(n2);
      const rightBytes = OpCodes.Unpack32LE(n1);
      return leftBytes.concat(rightBytes);
    }

    _decryptBlock(block) {
      if (!block || block.length !== BLOCK_SIZE) {
        throw new Error("GOST 28147-89 requires exactly 8 bytes per block");
      }

      let n1 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let n2 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this.subkeys;

      const applyPair = (firstKey, secondKey) => {
        n2 = (n2 ^ gostRound(n1, firstKey)) >>> 0;
        n1 = (n1 ^ gostRound(n2, secondKey)) >>> 0;
      };

      applyPair(k[0], k[1]);
      applyPair(k[2], k[3]);
      applyPair(k[4], k[5]);
      applyPair(k[6], k[7]);

      for (let cycle = 0; cycle < 3; cycle++) {
        applyPair(k[7], k[6]);
        applyPair(k[5], k[4]);
        applyPair(k[3], k[2]);
        applyPair(k[1], k[0]);
      }

      const leftBytes = OpCodes.Unpack32LE(n2);
      const rightBytes = OpCodes.Unpack32LE(n1);
      return leftBytes.concat(rightBytes);
    }

    _expandKey(keyBytes) {
      const subkeys = new Uint32Array(KEY_BYTES / 4);
      for (let i = 0; i < subkeys.length; i++) {
        const offset = i * 4;
        subkeys[i] = OpCodes.Pack32LE(
          keyBytes[offset],
          keyBytes[offset + 1],
          keyBytes[offset + 2],
          keyBytes[offset + 3]
        ) >>> 0;
      }
      return subkeys;
    }
  }

  const algorithmInstance = new Gost28147Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Gost28147Algorithm, Gost28147Instance };
});
