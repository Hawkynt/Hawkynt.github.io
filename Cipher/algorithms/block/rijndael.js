/*
 * Rijndael (AES) Block Cipher
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
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
    root.Rijndael = factory(root.AlgorithmFramework, root.OpCodes);
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

  const NB = 4;
  const BLOCK_SIZE = 16;
  const KEY_SIZES = Object.freeze([16, 24, 32]);

  const RijndaelTables = (() => {
    const SBOX = new Uint8Array([
      0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
      0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
      0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
      0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
      0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
      0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
      0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
      0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
      0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
      0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
      0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
      0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
      0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
      0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
      0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
      0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
    ]);

    const INV_SBOX = new Uint8Array([
      0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
      0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
      0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
      0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
      0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
      0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
      0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
      0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
      0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
      0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
      0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
      0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
      0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
      0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
      0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
      0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d
    ]);

    const RCON = new Uint8Array([
      0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36,
      0x6c, 0xd8, 0xab, 0x4d, 0x9a, 0x2f, 0x5e, 0xbc, 0x63, 0xc6,
      0x97, 0x35, 0x6a, 0xd4, 0xb3, 0x7d, 0xfa, 0xef, 0xc5, 0x91
    ]);

    return Object.freeze({ SBOX, INV_SBOX, RCON });
  })();

  function rotWord(word) {
    return OpCodes.RotL32(word, 8);
  }

  function subWord(word, tables) {
    const sbox = tables.SBOX;
    // Unpack word to 4 bytes (big-endian)
    const [b0, b1, b2, b3] = OpCodes.Unpack32BE(word);
    // Apply S-box to each byte and pack back
    return OpCodes.Pack32BE(sbox[b0], sbox[b1], sbox[b2], sbox[b3]);
  }

  /**
 * RijndaelAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class RijndaelAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Rijndael (AES)";
      this.description = "Educational AES implementation with 128-bit blocks and 128/192/256-bit keys, aligned with NIST FIPS 197.";
      this.inventor = "Joan Daemen, Vincent Rijmen";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = KEY_SIZES.map(length => new KeySize(length, length, 0));
      this.SupportedBlockSizes = [new KeySize(BLOCK_SIZE, BLOCK_SIZE, 0)];

      this.documentation = [
        new LinkItem("FIPS 197: Advanced Encryption Standard (AES)", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf"),
        new LinkItem("NIST SP 800-38A: Recommendation for Block Cipher Modes", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"),
        new LinkItem("AES overview (Wikipedia)", "https://en.wikipedia.org/wiki/Advanced_Encryption_Standard")
      ];

      this.references = [
        new LinkItem("Rijndael submission to the AES competition", "https://csrc.nist.gov/projects/block-cipher-techniques/aes-development"),
        new LinkItem("Crypto++ AES reference", "https://github.com/weidai11/cryptopp/blob/master/cpp/rijndael.cpp")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Side-channel leakage",
          "Table-based AES leaks key-dependent timing information on shared hardware.",
          "Use constant-time primitives or dedicated CPU instructions when side-channels matter."
        ),
        new Vulnerability(
          "Mode misuse",
          "Reusing IVs or operating without authentication enables practical attacks despite strong core primitive.",
          "Pair AES with authenticated modes (GCM, CCM) and fresh IVs for each message."
        )
      ];

      this.tests = [
        {
          text: "FIPS 197 C.1 AES-128 ECB",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf",
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("69c4e0d86a7b0430d8cdb78070b4c55a")
        },
        {
          text: "NIST SP 800-38A F.2 AES-192 ECB #1",
          uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
          key: OpCodes.Hex8ToBytes("8e73b0f7da0e6452c810f32b809079e562f8ead2522c6b7b"),
          expected: OpCodes.Hex8ToBytes("bd334f1d6e45f25ff712a214571fa5cc")
        },
        {
          text: "NIST SP 800-38A F.2 AES-256 ECB #1",
          uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
          key: OpCodes.Hex8ToBytes("603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4"),
          expected: OpCodes.Hex8ToBytes("f3eed1bdb5d2a03c064b5a7e3db181f8")
        }
      ];

      this.tables = RijndaelTables;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new RijndaelInstance(this, isInverse);
    }
  }

  /**
 * Rijndael cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RijndaelInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse) {
      super(algorithm);
      this.isInverse = !!isInverse;
      this.BlockSize = BLOCK_SIZE;
      this.KeySize = 0;
      this.rounds = 0;
      this.roundKeys = null;
      this._key = null;
      this.inputBuffer = [];
      this.tables = algorithm.tables;
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
        if (this.roundKeys) {
          OpCodes.ClearArray(this.roundKeys);
        }
        this._key = null;
        this.roundKeys = null;
        this.rounds = 0;
        this.KeySize = 0;
        return;
      }

      const length = keyBytes.length;
      if (KEY_SIZES.indexOf(length) === -1) {
        throw new Error("Invalid key size: " + length + " bytes. Rijndael supports 16, 24, or 32 byte keys.");
      }

      if (this._key) {
        OpCodes.ClearArray(this._key);
      }
      if (this.roundKeys) {
        OpCodes.ClearArray(this.roundKeys);
      }

      const expanded = this._expandKey(keyBytes);
      this._key = expanded.keyCopy;
      this.roundKeys = expanded.roundKeys;
      this.rounds = expanded.rounds;
      this.KeySize = this._key.length;
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
        this.inputBuffer.push(data[i]&0xff);
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

    EncryptBlock(block) {
      return this._encryptBlock(block);
    }

    DecryptBlock(block) {
      return this._decryptBlock(block);
    }

    Dispose() {
      this.key = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer.length = 0;
    }

    _expandKey(keyBytes) {
      const tables = this.tables;
      const keyCopy = Uint8Array.from(keyBytes, value => value&0xff);
      const nk = keyCopy.length / 4;
      const nr = nk + 6;
      const totalWords = NB * (nr + 1);
      const words = new Uint32Array(totalWords);

      for (let i = 0; i < nk; i++) {
        const offset = i * 4;
        words[i] = OpCodes.ToUint32(OpCodes.Pack32BE(
          keyCopy[offset],
          keyCopy[offset + 1],
          keyCopy[offset + 2],
          keyCopy[offset + 3]
        ));
      }

      let rconIndex = 0;
      for (let i = nk; i < totalWords; i++) {
        let temp = words[i - 1];
        if (i % nk === 0) {
          temp = OpCodes.ToUint32(OpCodes.Xor32(subWord(rotWord(temp), tables), OpCodes.Pack32BE(tables.RCON[rconIndex], 0, 0, 0)));
          rconIndex++;
        } else if (nk > 6 && (i % nk) === 4) {
          temp = subWord(temp, tables);
        }
        words[i] = OpCodes.ToUint32(OpCodes.Xor32(words[i - nk], temp));
      }

      const roundKeys = new Uint8Array(totalWords * 4);
      for (let i = 0; i < totalWords; i++) {
        const offset = i * 4;
        const unpacked = OpCodes.Unpack32BE(words[i]);
        roundKeys[offset] = unpacked[0];
        roundKeys[offset + 1] = unpacked[1];
        roundKeys[offset + 2] = unpacked[2];
        roundKeys[offset + 3] = unpacked[3];
        OpCodes.ClearArray(unpacked);
      }

      OpCodes.ClearArray(words);

      return {
        keyCopy,
        roundKeys,
        rounds: nr
      };
    }

    _encryptBlock(block) {
      if (!this.roundKeys) {
        throw new Error("Key not set");
      }
      if (!block || block.length !== BLOCK_SIZE) {
        throw new Error("Rijndael requires exactly " + BLOCK_SIZE + " bytes per block");
      }

      const state = new Uint8Array(BLOCK_SIZE);
      for (let i = 0; i < BLOCK_SIZE; i++) {
        state[i] = block[i]&0xff;
      }

      this._addRoundKey(state, 0);

      for (let round = 1; round < this.rounds; round++) {
        this._subBytes(state);
        this._shiftRows(state);
        this._mixColumns(state);
        this._addRoundKey(state, round);
      }

      this._subBytes(state);
      this._shiftRows(state);
      this._addRoundKey(state, this.rounds);

      const result = new Array(BLOCK_SIZE);
      for (let i = 0; i < BLOCK_SIZE; i++) {
        result[i] = state[i];
      }
      OpCodes.ClearArray(state);
      return result;
    }

    _decryptBlock(block) {
      if (!this.roundKeys) {
        throw new Error("Key not set");
      }
      if (!block || block.length !== BLOCK_SIZE) {
        throw new Error("Rijndael requires exactly " + BLOCK_SIZE + " bytes per block");
      }

      const state = new Uint8Array(BLOCK_SIZE);
      for (let i = 0; i < BLOCK_SIZE; i++) {
        state[i] = block[i]&0xff;
      }

      this._addRoundKey(state, this.rounds);

      for (let round = this.rounds - 1; round > 0; round--) {
        this._invShiftRows(state);
        this._invSubBytes(state);
        this._addRoundKey(state, round);
        this._invMixColumns(state);
      }

      this._invShiftRows(state);
      this._invSubBytes(state);
      this._addRoundKey(state, 0);

      const result = new Array(BLOCK_SIZE);
      for (let i = 0; i < BLOCK_SIZE; i++) {
        result[i] = state[i];
      }
      OpCodes.ClearArray(state);
      return result;
    }

    _addRoundKey(state, round) {
      const offset = round * BLOCK_SIZE;
      for (let i = 0; i < BLOCK_SIZE; i++) {
        state[i] = (state[i]^this.roundKeys[offset + i])&0xff;
      }
    }

    _subBytes(state) {
      const sbox = this.tables.SBOX;
      for (let i = 0; i < BLOCK_SIZE; i++) {
        state[i] = sbox[state[i]];
      }
    }

    _invSubBytes(state) {
      const invSbox = this.tables.INV_SBOX;
      for (let i = 0; i < BLOCK_SIZE; i++) {
        state[i] = invSbox[state[i]];
      }
    }

    _shiftRows(state) {
      let temp = state[1];
      state[1] = state[5];
      state[5] = state[9];
      state[9] = state[13];
      state[13] = temp;

      temp = state[2];
      let temp2 = state[6];
      state[2] = state[10];
      state[6] = state[14];
      state[10] = temp;
      state[14] = temp2;

      temp = state[3];
      state[3] = state[15];
      state[15] = state[11];
      state[11] = state[7];
      state[7] = temp;
    }

    _invShiftRows(state) {
      let temp = state[13];
      state[13] = state[9];
      state[9] = state[5];
      state[5] = state[1];
      state[1] = temp;

      temp = state[2];
      let temp2 = state[6];
      state[2] = state[10];
      state[6] = state[14];
      state[10] = temp;
      state[14] = temp2;

      temp = state[3];
      state[3] = state[7];
      state[7] = state[11];
      state[11] = state[15];
      state[15] = temp;
    }

    _mixColumns(state) {
      for (let col = 0; col < 4; col++) {
        const base = col * 4;
        const s0 = state[base];
        const s1 = state[base + 1];
        const s2 = state[base + 2];
        const s3 = state[base + 3];

        state[base] = (
          OpCodes.GF256Mul(s0, 2)^OpCodes.GF256Mul(s1, 3)^s2^s3
        )&0xff;
        state[base + 1] = (
          s0^OpCodes.GF256Mul(s1, 2)^OpCodes.GF256Mul(s2, 3)^s3
        )&0xff;
        state[base + 2] = (
          s0^s1^OpCodes.GF256Mul(s2, 2)^OpCodes.GF256Mul(s3, 3)
        )&0xff;
        state[base + 3] = (
          OpCodes.GF256Mul(s0, 3)^s1^s2^OpCodes.GF256Mul(s3, 2)
        )&0xff;
      }
    }

    _invMixColumns(state) {
      for (let col = 0; col < 4; col++) {
        const base = col * 4;
        const s0 = state[base];
        const s1 = state[base + 1];
        const s2 = state[base + 2];
        const s3 = state[base + 3];

        state[base] = (
          OpCodes.GF256Mul(s0, 14)^OpCodes.GF256Mul(s1, 11)^OpCodes.GF256Mul(s2, 13)^OpCodes.GF256Mul(s3, 9)
        )&0xff;
        state[base + 1] = (
          OpCodes.GF256Mul(s0, 9)^OpCodes.GF256Mul(s1, 14)^OpCodes.GF256Mul(s2, 11)^OpCodes.GF256Mul(s3, 13)
        )&0xff;
        state[base + 2] = (
          OpCodes.GF256Mul(s0, 13)^OpCodes.GF256Mul(s1, 9)^OpCodes.GF256Mul(s2, 14)^OpCodes.GF256Mul(s3, 11)
        )&0xff;
        state[base + 3] = (
          OpCodes.GF256Mul(s0, 11)^OpCodes.GF256Mul(s1, 13)^OpCodes.GF256Mul(s2, 9)^OpCodes.GF256Mul(s3, 14)
        )&0xff;
      }
    }
  }

  // Register algorithm immediately
  RegisterAlgorithm(new RijndaelAlgorithm());

  return { RijndaelAlgorithm, RijndaelInstance };
});
