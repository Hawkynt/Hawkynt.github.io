/*
 * GOST Block Cipher Implementations
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * Contains both GOST 28147-89 and GOST R 34.12-2015 (Kuznyechik)
 * Reference-aligned with Crypto++ and RFC specifications.
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

  // ===== GOST 28147-89 IMPLEMENTATION =====

  const GOST28147_BLOCK_SIZE = 8;
  const GOST28147_KEY_BYTES = 32;

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
        const combined = OpCodes.OrN(lowRow[OpCodes.AndN(j, 0x0f)], OpCodes.Shl32(highRow[OpCodes.Shr32(j, 4)], 4));
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
    const b0 = OpCodes.AndN(sum, 0xFF);
    const b1 = OpCodes.AndN(OpCodes.Shr32(sum, 8), 0xFF);
    const b2 = OpCodes.AndN(OpCodes.Shr32(sum, 16), 0xFF);
    const b3 = OpCodes.AndN(OpCodes.Shr32(sum, 24), 0xFF);
    return OpCodes.ToUint32(
      OpCodes.XorN(
        OpCodes.XorN(
          OpCodes.XorN(Gost28147Tables.T0[b0], Gost28147Tables.T1[b1]),
          Gost28147Tables.T2[b2]
        ),
        Gost28147Tables.T3[b3]
      )
    );
  }

  /**
 * Gost28147Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

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
        new KeySize(GOST28147_KEY_BYTES, GOST28147_KEY_BYTES, 0)
      ];
      this.SupportedBlockSizes = [
        new KeySize(GOST28147_BLOCK_SIZE, GOST28147_BLOCK_SIZE, 0)
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

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Gost28147Instance(this, isInverse);
    }
  }

  /**
 * Gost28147 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Gost28147Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse) {
      super(algorithm);
      this.isInverse = !!isInverse;
      this._key = null;
      this.subkeys = null;
      this.inputBuffer = [];
      this.BlockSize = GOST28147_BLOCK_SIZE;
      this.KeySize = 0;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

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

      if (keyBytes.length !== GOST28147_KEY_BYTES) {
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

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? Array.from(this._key) : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) {
        return;
      }
      if (!this._key) {
        throw new Error("Key not set");
      }
      for (let i = 0; i < data.length; i++) {
        this.inputBuffer.push(OpCodes.AndN(data[i], 0xFF));
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }
      if (this.inputBuffer.length % GOST28147_BLOCK_SIZE !== 0) {
        throw new Error("Input length must be multiple of " + GOST28147_BLOCK_SIZE + " bytes");
      }

      const output = [];
      for (let offset = 0; offset < this.inputBuffer.length; offset += GOST28147_BLOCK_SIZE) {
        const block = this.inputBuffer.slice(offset, offset + GOST28147_BLOCK_SIZE);
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
      if (!block || block.length !== GOST28147_BLOCK_SIZE) {
        throw new Error("GOST 28147-89 requires exactly 8 bytes per block");
      }

      let n1 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let n2 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this.subkeys;

      const applyPair = (firstKey, secondKey) => {
        n2 = OpCodes.ToUint32(OpCodes.XorN(n2, gostRound(n1, firstKey)));
        n1 = OpCodes.ToUint32(OpCodes.XorN(n1, gostRound(n2, secondKey)));
      };

      for (let cycle = 0; cycle < 3; cycle++) {
        applyPair(k[0], k[1]);
        applyPair(k[2], k[3]);
        applyPair(k[4], k[5]);
        applyPair(k[6], k[7]);
      }

      n2 = OpCodes.ToUint32(OpCodes.XorN(n2, gostRound(n1, k[7])));
      n1 = OpCodes.ToUint32(OpCodes.XorN(n1, gostRound(n2, k[6])));
      n2 = OpCodes.ToUint32(OpCodes.XorN(n2, gostRound(n1, k[5])));
      n1 = OpCodes.ToUint32(OpCodes.XorN(n1, gostRound(n2, k[4])));
      n2 = OpCodes.ToUint32(OpCodes.XorN(n2, gostRound(n1, k[3])));
      n1 = OpCodes.ToUint32(OpCodes.XorN(n1, gostRound(n2, k[2])));
      n2 = OpCodes.ToUint32(OpCodes.XorN(n2, gostRound(n1, k[1])));
      n1 = OpCodes.ToUint32(OpCodes.XorN(n1, gostRound(n2, k[0])));

      const leftBytes = OpCodes.Unpack32LE(n2);
      const rightBytes = OpCodes.Unpack32LE(n1);
      return leftBytes.concat(rightBytes);
    }

    _decryptBlock(block) {
      if (!block || block.length !== GOST28147_BLOCK_SIZE) {
        throw new Error("GOST 28147-89 requires exactly 8 bytes per block");
      }

      let n1 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let n2 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this.subkeys;

      const applyPair = (firstKey, secondKey) => {
        n2 = OpCodes.ToUint32(OpCodes.XorN(n2, gostRound(n1, firstKey)));
        n1 = OpCodes.ToUint32(OpCodes.XorN(n1, gostRound(n2, secondKey)));
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
      const subkeys = new Uint32Array(GOST28147_KEY_BYTES / 4);
      for (let i = 0; i < subkeys.length; i++) {
        const offset = i * 4;
        subkeys[i] = OpCodes.ToUint32(OpCodes.Pack32LE(
          keyBytes[offset],
          keyBytes[offset + 1],
          keyBytes[offset + 2],
          keyBytes[offset + 3]
        ));
      }
      return subkeys;
    }
  }

  // ===== GOST R 34.12-2015 (KUZNYECHIK) IMPLEMENTATION =====

  const KUZNYECHIK_BLOCK_SIZE = 16;
  const KUZNYECHIK_KEY_BYTES = 32;

  /**
 * GostKuznyechikAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class GostKuznyechikAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "GOST R 34.12-2015 (Kuznyechik)";
      this.description = "Modern Russian Federal Standard GOST R 34.12-2015 (Kuznyechik). Substitution-permutation network with 128-bit blocks and 256-bit keys. Educational implementation of the cipher that replaced GOST 28147-89.";
      this.inventor = "Russian cryptographers";
      this.year = 2015;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [
        new KeySize(KUZNYECHIK_KEY_BYTES, KUZNYECHIK_KEY_BYTES, 0)
      ];
      this.SupportedBlockSizes = [
        new KeySize(KUZNYECHIK_BLOCK_SIZE, KUZNYECHIK_BLOCK_SIZE, 0)
      ];

      this.documentation = [
        new LinkItem("GOST R 34.12-2015 Standard", "https://www.tc26.ru/en/standard/gost/"),
        new LinkItem("Kuznyechik Specification", "https://tools.ietf.org/rfc/rfc7801.txt"),
        new LinkItem("Wikipedia - Kuznyechik", "https://en.wikipedia.org/wiki/Kuznyechik")
      ];

      this.references = [
        new LinkItem("RFC 7801 - GOST R 34.12-2015", "https://tools.ietf.org/rfc/rfc7801.txt"),
        new LinkItem("TC26 GOST Standards", "https://www.tc26.ru/en/standard/gost/"),
        new LinkItem("Cryptographic Research - Kuznyechik", "https://eprint.iacr.org/2016/071.pdf"),
        new LinkItem("NIST Post-Quantum Analysis", "https://csrc.nist.gov/projects/post-quantum-cryptography")
      ];

      this.tests = [
        {
          text: "GOST R 34.12-2015 (Kuznyechik) test vector from RFC 7801",
          uri: "https://tools.ietf.org/rfc/rfc7801.txt",
          input: OpCodes.Hex8ToBytes("1122334455667700ffeeddccbbaa9988"),
          key: OpCodes.Hex8ToBytes("8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef"),
          expected: OpCodes.Hex8ToBytes("7f679d90bebc24305a468d42b9d4edcd")
        },
        {
          text: "GOST R 34.12-2015 (Kuznyechik) test vector 2 from RFC 7801",
          uri: "https://tools.ietf.org/rfc/rfc7801.txt",
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbcceeff0a"),
          key: OpCodes.Hex8ToBytes("8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef"),
          expected: OpCodes.Hex8ToBytes("b429912c6e0032f9285452d76718d08b")
        }
      ];

      // GOST R 34.12-2015 S-box (π transformation)
      this.SBOX = [
        0xFC, 0xEE, 0xDD, 0x11, 0xCF, 0x6E, 0x31, 0x16, 0xFB, 0xC4, 0xFA, 0xDA, 0x23, 0xC5, 0x04, 0x4D,
        0xE9, 0x77, 0xF0, 0xDB, 0x93, 0x2E, 0x99, 0xBA, 0x17, 0x36, 0xF1, 0xBB, 0x14, 0xCD, 0x5F, 0xC1,
        0xF9, 0x18, 0x65, 0x5A, 0xE2, 0x5C, 0xEF, 0x21, 0x81, 0x1C, 0x3C, 0x42, 0x8B, 0x01, 0x8E, 0x4F,
        0x05, 0x84, 0x02, 0xAE, 0xE3, 0x6A, 0x8F, 0xA0, 0x06, 0x0B, 0xED, 0x98, 0x7F, 0xD4, 0xD3, 0x1F,
        0xEB, 0x34, 0x2C, 0x51, 0xEA, 0xC8, 0x48, 0xAB, 0xF2, 0x2A, 0x68, 0xA2, 0xFD, 0x3A, 0xCE, 0xCC,
        0xB5, 0x70, 0x0E, 0x56, 0x08, 0x0C, 0x76, 0x12, 0xBF, 0x72, 0x13, 0x47, 0x9C, 0xB7, 0x5D, 0x87,
        0x15, 0xA1, 0x96, 0x29, 0x10, 0x7B, 0x9A, 0xC7, 0xF3, 0x91, 0x78, 0x6F, 0x9D, 0x9E, 0xB2, 0xB1,
        0x32, 0x75, 0x19, 0x3D, 0xFF, 0x35, 0x8A, 0x7E, 0x6D, 0x54, 0xC6, 0x80, 0xC3, 0xBD, 0x0D, 0x57,
        0xDF, 0xF5, 0x24, 0xA9, 0x3E, 0xA8, 0x43, 0xC9, 0xD7, 0x79, 0xD6, 0xF6, 0x7C, 0x22, 0xB9, 0x03,
        0xE0, 0x0F, 0xEC, 0xDE, 0x7A, 0x94, 0xB0, 0xBC, 0xDC, 0xE8, 0x28, 0x50, 0x4E, 0x33, 0x0A, 0x4A,
        0xA7, 0x97, 0x60, 0x73, 0x1E, 0x00, 0x62, 0x44, 0x1A, 0xB8, 0x38, 0x82, 0x64, 0x9F, 0x26, 0x41,
        0xAD, 0x45, 0x46, 0x92, 0x27, 0x5E, 0x55, 0x2F, 0x8C, 0xA3, 0xA5, 0x7D, 0x69, 0xD5, 0x95, 0x3B,
        0x07, 0x58, 0xB3, 0x40, 0x86, 0xAC, 0x1D, 0xF7, 0x30, 0x37, 0x6B, 0xE4, 0x88, 0xD9, 0xE7, 0x89,
        0xE1, 0x1B, 0x83, 0x49, 0x4C, 0x3F, 0xF8, 0xFE, 0x8D, 0x53, 0xAA, 0x90, 0xCA, 0xD8, 0x85, 0x61,
        0x20, 0x71, 0x67, 0xA4, 0x2D, 0x2B, 0x09, 0x5B, 0xCB, 0x9B, 0x25, 0xD0, 0xBE, 0xE5, 0x6C, 0x52,
        0x59, 0xA6, 0x74, 0xD2, 0xE6, 0xF4, 0xB4, 0xC0, 0xD1, 0x66, 0xAF, 0xC2, 0x39, 0x4B, 0x63, 0xB6
      ];

      // Inverse S-box (inverse π transformation)
      this.SBOX_INV = [
        0xA5, 0x2D, 0x32, 0x8F, 0x0E, 0x30, 0x38, 0xC0, 0x54, 0xE6, 0x9E, 0x39, 0x55, 0x7E, 0x52, 0x91,
        0x64, 0x03, 0x57, 0x5A, 0x1C, 0x60, 0x07, 0x18, 0x21, 0x72, 0xA8, 0xD1, 0x29, 0xC6, 0xA4, 0x3F,
        0xE0, 0x27, 0x8D, 0x0C, 0x82, 0xEA, 0xAE, 0xB4, 0x9A, 0x63, 0x49, 0xE5, 0x42, 0xE4, 0x15, 0xB7,
        0xC8, 0x06, 0x70, 0x9D, 0x41, 0x75, 0x19, 0xC9, 0xAA, 0xFC, 0x4D, 0xBF, 0x2A, 0x73, 0x84, 0xD5,
        0xC3, 0xAF, 0x2B, 0x86, 0xA7, 0xB1, 0xB2, 0x5B, 0x46, 0xD3, 0x9F, 0xFD, 0xD4, 0x0F, 0x9C, 0x2F,
        0x9B, 0x43, 0xEF, 0xD9, 0x79, 0xB6, 0x53, 0x7F, 0xC1, 0xF0, 0x23, 0xE7, 0x25, 0x5E, 0xB5, 0x1E,
        0xA2, 0xDF, 0xA6, 0xFE, 0xAC, 0x22, 0xF9, 0xE2, 0x4A, 0xBC, 0x35, 0xCA, 0xEE, 0x78, 0x05, 0x6B,
        0x51, 0xE1, 0x59, 0xA3, 0xF2, 0x71, 0x56, 0x11, 0x6A, 0x89, 0x94, 0x65, 0x8C, 0xBB, 0x77, 0x3C,
        0x7B, 0x28, 0xAB, 0xD2, 0x31, 0xDE, 0xC4, 0x5F, 0xCC, 0xCF, 0x76, 0x2C, 0xB8, 0xD8, 0x2E, 0x36,
        0xDB, 0x69, 0xB3, 0x14, 0x95, 0xBE, 0x62, 0xA1, 0x3B, 0x16, 0x66, 0xE9, 0x5C, 0x6C, 0x6D, 0xAD,
        0x37, 0x61, 0x4B, 0xB9, 0xE3, 0xBA, 0xF1, 0xA0, 0x85, 0x83, 0xDA, 0x47, 0xC5, 0xB0, 0x33, 0xFA,
        0x96, 0x6F, 0x6E, 0xC2, 0xF6, 0x50, 0xFF, 0x5D, 0xA9, 0x8E, 0x17, 0x1B, 0x97, 0x7D, 0xEC, 0x58,
        0xF7, 0x1F, 0xFB, 0x7C, 0x09, 0x0D, 0x7A, 0x67, 0x45, 0x87, 0xDC, 0xE8, 0x4F, 0x1D, 0x4E, 0x04,
        0xEB, 0xF8, 0xF3, 0x3E, 0x3D, 0xBD, 0x8A, 0x88, 0xDD, 0xCD, 0x0B, 0x13, 0x98, 0x02, 0x93, 0x80,
        0x90, 0xD0, 0x24, 0x34, 0xCB, 0xED, 0xF4, 0xCE, 0x99, 0x10, 0x44, 0x40, 0x92, 0x3A, 0x01, 0x26,
        0x12, 0x1A, 0x48, 0x68, 0xF5, 0x81, 0x8B, 0xC7, 0xD6, 0x20, 0x0A, 0x08, 0x00, 0x4C, 0xD7, 0x74
      ];

      // Linear transformation vector for L transformation (GOST R 34.12-2015)
      this.LINEAR_VECTOR = [
        0x94, 0x20, 0x85, 0x10, 0xc2, 0xc0, 0x01, 0xfb,
        0x01, 0xc0, 0xc2, 0x10, 0x85, 0x20, 0x94, 0x01
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new GostKuznyechikInstance(this, isInverse);
    }
  }

  /**
 * GostKuznyechik cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GostKuznyechikInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = KUZNYECHIK_BLOCK_SIZE;
      this.KeySize = 0;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        return;
      }

      if (keyBytes.length !== KUZNYECHIK_KEY_BYTES) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. GOST R 34.12-2015 requires 32 bytes (256 bits)`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.roundKeys = this._expandKey(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];
      const blockSize = this.BlockSize;

      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      this.inputBuffer = [];

      return output;
    }

    _encryptBlock(block) {
      if (block.length !== KUZNYECHIK_BLOCK_SIZE) {
        throw new Error("GOST R 34.12-2015 requires exactly 16 bytes per block");
      }

      const state = [...block];

      this._addRoundKey(state, this.roundKeys[0]);

      for (let round = 1; round <= 9; round++) {
        this._sTransformation(state);
        this._lTransformation(state);
        this._addRoundKey(state, this.roundKeys[round]);
      }

      return state;
    }

    _decryptBlock(block) {
      if (block.length !== KUZNYECHIK_BLOCK_SIZE) {
        throw new Error("GOST R 34.12-2015 requires exactly 16 bytes per block");
      }

      const state = [...block];

      for (let round = 9; round >= 1; round--) {
        this._addRoundKey(state, this.roundKeys[round]);
        this._invLTransformation(state);
        this._invSTransformation(state);
      }

      this._addRoundKey(state, this.roundKeys[0]);

      return state;
    }

    _sTransformation(state) {
      for (let i = 0; i < 16; i++) {
        state[i] = this.algorithm.SBOX[state[i]];
      }
    }

    _invSTransformation(state) {
      for (let i = 0; i < 16; i++) {
        state[i] = this.algorithm.SBOX_INV[state[i]];
      }
    }

    _gfMultiply(x, y) {
      let z = 0;
      while (y !== 0) {
        if (OpCodes.AndN(y, 1)) {
          z = OpCodes.XorN(z, x);
        }
        x = OpCodes.XorN(OpCodes.Shl32(x, 1), OpCodes.AndN(x, 0x80) ? 0xC3 : 0x00);
        y = OpCodes.Shr32(y, 1);
      }
      return OpCodes.AndN(z, 0xFF);
    }

    _lTransformation(state) {
      for (let j = 0; j < 16; j++) {
        let x = state[15];

        for (let i = 14; i >= 0; i--) {
          state[i + 1] = state[i];
          x = OpCodes.XorN(x, this._gfMultiply(state[i], this.algorithm.LINEAR_VECTOR[i]));
        }

        state[0] = x;
      }
    }

    _invLTransformation(state) {
      for (let i = 0; i < 16; i++) {
        let c = state[0];

        for (let j = 0; j < 15; j++) {
          state[j] = state[j + 1];
          c = OpCodes.XorN(c, this._gfMultiply(state[j], this.algorithm.LINEAR_VECTOR[j]));
        }

        state[15] = c;
      }
    }

    _addRoundKey(state, roundKey) {
      for (let i = 0; i < 16; i++) {
        state[i] = OpCodes.XorN(state[i], roundKey[i]);
      }
    }

    _generateRoundConstants() {
      const constants = [];

      for (let i = 1; i <= 32; i++) {
        const constant = new Array(16).fill(0);
        constant[15] = i;

        this._lTransformation(constant);

        constants.push([...constant]);
      }

      return constants;
    }

    _feistelFunction(input, constant) {
      const temp = new Array(16);
      for (let i = 0; i < 16; i++) {
        temp[i] = OpCodes.XorN(input[i], constant[i]);
      }

      this._sTransformation(temp);
      this._lTransformation(temp);

      return temp;
    }

    _expandKey(keyBytes) {
      const roundKeys = [];
      const roundConstants = this._generateRoundConstants();

      const k1 = keyBytes.slice(0, 16);
      const k2 = keyBytes.slice(16, 32);

      roundKeys[0] = [...k1];
      roundKeys[1] = [...k2];

      let left = [...k1];
      let right = [...k2];

      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 8; j++) {
          const constIndex = i * 8 + j;
          const temp = this._feistelFunction(left, roundConstants[constIndex]);

          for (let k = 0; k < 16; k++) {
            temp[k] = OpCodes.XorN(temp[k], right[k]);
          }

          right = [...left];
          left = temp;
        }

        roundKeys[2 + i * 2] = [...left];
        roundKeys[3 + i * 2] = [...right];
      }

      return roundKeys;
    }
  }

  // ===== REGISTRATION =====

  const gost28147Instance = new Gost28147Algorithm();
  if (!AlgorithmFramework.Find(gost28147Instance.name)) {
    RegisterAlgorithm(gost28147Instance);
  }

  const kuznyechikInstance = new GostKuznyechikAlgorithm();
  if (!AlgorithmFramework.Find(kuznyechikInstance.name)) {
    RegisterAlgorithm(kuznyechikInstance);
  }

  return {
    Gost28147Algorithm,
    Gost28147Instance,
    GostKuznyechikAlgorithm,
    GostKuznyechikInstance
  };
});
