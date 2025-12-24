/*
 * Grand Cru Block Cipher
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * IMPORTANT NOTE: Grand Cru cipher specifications are extremely scarce.
 * This implementation is based on available descriptions indicating it
 * modifies Rijndael by replacing unkeyed operations with key-dependent ones.
 *
 * According to Wikipedia and NESSIE references:
 * - 128-bit block size
 * - 128-bit key size
 * - 10 rounds (same as AES-128)
 * - Same key schedule as Rijndael
 * - Key-dependent S-box generation
 * - Key-dependent ShiftRows variations
 *
 * Due to lack of official test vectors and specifications, this implementation
 * uses synthetic test vectors that verify round-trip encryption/decryption.
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

  const NB = 4;
  const BLOCK_SIZE = 16;
  const KEY_SIZE = 16;
  const ROUNDS = 10;

  // Base Rijndael S-box (used as starting point for key-dependent S-box)
  const BASE_SBOX = new Uint8Array([
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

  const RCON = new Uint8Array([
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36,
    0x6c, 0xd8, 0xab, 0x4d, 0x9a, 0x2f, 0x5e, 0xbc, 0x63, 0xc6,
    0x97, 0x35, 0x6a, 0xd4, 0xb3, 0x7d, 0xfa, 0xef, 0xc5, 0x91
  ]);

  // Generate key-dependent S-box by permuting base S-box using key material
  function generateKeyDependentSbox(keyBytes) {
    const sbox = new Uint8Array(BASE_SBOX);
    const invSbox = new Uint8Array(256);

    // Apply key-dependent permutation using a deterministic shuffle based on key
    // This is a plausible implementation of "key-dependent S-box" concept
    let seed = 0;
    for (let i = 0; i < keyBytes.length; ++i) {
      seed = (seed * 31 + keyBytes[i])&0xffffffff;
    }

    // Fisher-Yates shuffle with key-based PRNG
    for (let i = 255; i > 0; --i) {
      seed = (seed * 1103515245 + 12345)&0x7fffffff;
      const j = seed % (i + 1);
      const temp = sbox[i];
      sbox[i] = sbox[j];
      sbox[j] = temp;
    }

    // Generate inverse S-box
    for (let i = 0; i < 256; ++i) {
      invSbox[sbox[i]] = i;
    }

    return { sbox, invSbox };
  }

  // Key-dependent shift amounts (derived from key)
  function generateKeyDependentShifts(keyBytes) {
    let seed = 0;
    for (let i = 0; i < keyBytes.length; ++i) {
      seed = (seed * 37 + keyBytes[i])&0xffffffff;
    }

    // Generate shift amounts for each row (keeping row 0 at 0)
    // Extract different bytes from seed for variety using OpCodes
    const bytes = OpCodes.Unpack32BE(seed);
    const shifts = [0, (bytes[3] % 3) + 1, (bytes[2] % 3) + 1, (bytes[1] % 3) + 1];
    OpCodes.ClearArray(bytes);
    return shifts;
  }

  function rotWord(word) {
    return OpCodes.RotL32(word, 8);
  }

  function subWord(word, sbox) {
    const bytes = OpCodes.Unpack32BE(word);
    const result = OpCodes.Pack32BE(
      sbox[bytes[0]],
      sbox[bytes[1]],
      sbox[bytes[2]],
      sbox[bytes[3]]
    );
    OpCodes.ClearArray(bytes);
    return result;
  }

  /**
 * GrandCruAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class GrandCruAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Grand Cru";
      this.description = "Experimental Rijndael variant with key-dependent S-boxes and operations. 128-bit blocks, 10 rounds, designed for enhanced security through key-dependent transformations.";
      this.inventor = "Johan Borst";
      this.year = 2000;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.NL;

      this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 0)];
      this.SupportedBlockSizes = [new KeySize(BLOCK_SIZE, BLOCK_SIZE, 0)];

      this.documentation = [
        new LinkItem("Grand Cru (Wikipedia)", "https://en.wikipedia.org/wiki/Grand_Cru_(cipher)"),
        new LinkItem("NESSIE Project", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      this.references = [
        new LinkItem("Crypto Wiki: Grand Cru", "https://cryptography.fandom.com/wiki/Grand_Cru_(cipher)")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Limited cryptanalysis",
          "Grand Cru was not selected by NESSIE and has received minimal public cryptanalysis.",
          "Use well-established algorithms like AES for production systems."
        ),
        new Vulnerability(
          "Weak key-dependent operations",
          "Key-dependent S-box generation may not provide expected security benefits and could introduce weaknesses.",
          "Avoid using Grand Cru in security-critical applications."
        )
      ];

      // Synthetic test vectors (computed from implementation)
      // NOTE: Official Grand Cru test vectors are not publicly available
      this.tests = [
        {
          text: "Grand Cru synthetic test vector #1",
          uri: "Generated from implementation for consistency verification",
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("71de5e5bf5e1983cbc13f15601efe59a")
        },
        {
          text: "Grand Cru synthetic test vector #2 (all zeros)",
          uri: "Generated from implementation for consistency verification",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("6b4791315ffd4d34b9e85ae6d88829ab")
        },
        {
          text: "Grand Cru synthetic test vector #3 (all ones)",
          uri: "Generated from implementation for consistency verification",
          input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("c10a7527a61765e2606bec10a86ad75e")
        },
        {
          text: "Grand Cru synthetic test vector #4 (mixed pattern)",
          uri: "Generated from implementation for consistency verification",
          input: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
          key: OpCodes.Hex8ToBytes("fedcba98765432100123456789abcdef"),
          expected: OpCodes.Hex8ToBytes("09cc7353d442f37f3d74a663fe74338e")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new GrandCruInstance(this, isInverse);
    }
  }

  /**
 * GrandCru cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GrandCruInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse) {
      super(algorithm);
      this.isInverse = !!isInverse;
      this.BlockSize = BLOCK_SIZE;
      this.KeySize = 0;
      this._rounds = ROUNDS;
      this.roundKeys = null;
      this._key = null;
      this.inputBuffer = [];
      this.sbox = null;
      this.invSbox = null;
      this.shifts = null;
    }

    // Make rounds an own property for TestCore compatibility
    get rounds() {
      return this._rounds;
    }

    set rounds(value) {
      if (typeof value === 'number' && value > 0 && value <= 20) {
        this._rounds = value;
        // Trigger S-box regeneration if key is already set
        if (this._key) {
          const tempKey = Array.from(this._key);
          this.key = null;
          this.key = tempKey;
        }
      }
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
        this.sbox = null;
        this.invSbox = null;
        this.shifts = null;
        this.KeySize = 0;
        return;
      }

      const length = keyBytes.length;
      if (length !== KEY_SIZE) {
        throw new Error("Invalid key size: " + length + " bytes. Grand Cru requires exactly 16 bytes.");
      }

      if (this._key) {
        OpCodes.ClearArray(this._key);
      }
      if (this.roundKeys) {
        OpCodes.ClearArray(this.roundKeys);
      }

      // Generate key-dependent S-box and shift patterns
      const sboxData = generateKeyDependentSbox(keyBytes);
      this.sbox = sboxData.sbox;
      this.invSbox = sboxData.invSbox;
      this.shifts = generateKeyDependentShifts(keyBytes);

      const expanded = this._expandKey(keyBytes);
      this._key = expanded.keyCopy;
      this.roundKeys = expanded.roundKeys;
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
      for (let i = 0; i < data.length; ++i) {
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

    Dispose() {
      this.key = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer.length = 0;
    }

    _expandKey(keyBytes) {
      const keyCopy = Uint8Array.from(keyBytes, value => value&0xff);
      const nk = KEY_SIZE / 4;
      const totalWords = NB * (this._rounds + 1);
      const words = new Uint32Array(totalWords);

      // Initial key words
      for (let i = 0; i < nk; ++i) {
        const offset = i * 4;
        words[i] = OpCodes.Pack32BE(
          keyCopy[offset],
          keyCopy[offset + 1],
          keyCopy[offset + 2],
          keyCopy[offset + 3]
        );
      }

      // Key expansion using key-dependent S-box
      let rconIndex = 0;
      for (let i = nk; i < totalWords; ++i) {
        let temp = words[i - 1];
        if (i % nk === 0) {
          temp = OpCodes.Xor32(subWord(rotWord(temp), this.sbox), OpCodes.ToUint32(OpCodes.Shl32(RCON[rconIndex], 24)));
          ++rconIndex;
        }
        words[i] = OpCodes.ToUint32(OpCodes.Xor32(words[i - nk], temp));
      }

      // Convert to byte array
      const roundKeys = new Uint8Array(totalWords * 4);
      for (let i = 0; i < totalWords; ++i) {
        const offset = i * 4;
        const unpacked = OpCodes.Unpack32BE(words[i]);
        roundKeys[offset] = unpacked[0];
        roundKeys[offset + 1] = unpacked[1];
        roundKeys[offset + 2] = unpacked[2];
        roundKeys[offset + 3] = unpacked[3];
        OpCodes.ClearArray(unpacked);
      }

      OpCodes.ClearArray(words);

      return { keyCopy, roundKeys };
    }

    _encryptBlock(block) {
      if (!this.roundKeys) {
        throw new Error("Key not set");
      }
      if (!block || block.length !== BLOCK_SIZE) {
        throw new Error("Grand Cru requires exactly " + BLOCK_SIZE + " bytes per block");
      }

      const state = new Uint8Array(BLOCK_SIZE);
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        state[i] = block[i]&0xff;
      }

      this._addRoundKey(state, 0);

      for (let round = 1; round < this._rounds; ++round) {
        this._subBytes(state);
        this._shiftRows(state);
        this._mixColumns(state);
        this._addRoundKey(state, round);
      }

      this._subBytes(state);
      this._shiftRows(state);
      this._addRoundKey(state, this._rounds);

      const result = new Array(BLOCK_SIZE);
      for (let i = 0; i < BLOCK_SIZE; ++i) {
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
        throw new Error("Grand Cru requires exactly " + BLOCK_SIZE + " bytes per block");
      }

      const state = new Uint8Array(BLOCK_SIZE);
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        state[i] = block[i]&0xff;
      }

      this._addRoundKey(state, this._rounds);

      for (let round = this._rounds - 1; round > 0; --round) {
        this._invShiftRows(state);
        this._invSubBytes(state);
        this._addRoundKey(state, round);
        this._invMixColumns(state);
      }

      this._invShiftRows(state);
      this._invSubBytes(state);
      this._addRoundKey(state, 0);

      const result = new Array(BLOCK_SIZE);
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        result[i] = state[i];
      }
      OpCodes.ClearArray(state);
      return result;
    }

    _addRoundKey(state, round) {
      const offset = round * BLOCK_SIZE;
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        state[i] = (state[i]^this.roundKeys[offset + i])&0xff;
      }
    }

    _subBytes(state) {
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        state[i] = this.sbox[state[i]];
      }
    }

    _invSubBytes(state) {
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        state[i] = this.invSbox[state[i]];
      }
    }

    // Key-dependent shift rows using generated shift amounts
    _shiftRows(state) {
      // Row 0: no shift
      // Row 1: shift by shifts[1]
      const temp1 = new Array(4);
      for (let i = 0; i < 4; ++i) {
        temp1[i] = state[1 + i * 4];
      }
      for (let i = 0; i < 4; ++i) {
        state[1 + i * 4] = temp1[(i + this.shifts[1]) % 4];
      }

      // Row 2: shift by shifts[2]
      const temp2 = new Array(4);
      for (let i = 0; i < 4; ++i) {
        temp2[i] = state[2 + i * 4];
      }
      for (let i = 0; i < 4; ++i) {
        state[2 + i * 4] = temp2[(i + this.shifts[2]) % 4];
      }

      // Row 3: shift by shifts[3]
      const temp3 = new Array(4);
      for (let i = 0; i < 4; ++i) {
        temp3[i] = state[3 + i * 4];
      }
      for (let i = 0; i < 4; ++i) {
        state[3 + i * 4] = temp3[(i + this.shifts[3]) % 4];
      }
    }

    _invShiftRows(state) {
      // Inverse of key-dependent shift rows
      // Row 1: shift by (4 - shifts[1])
      const temp1 = new Array(4);
      for (let i = 0; i < 4; ++i) {
        temp1[i] = state[1 + i * 4];
      }
      for (let i = 0; i < 4; ++i) {
        state[1 + i * 4] = temp1[(i + 4 - this.shifts[1]) % 4];
      }

      // Row 2: shift by (4 - shifts[2])
      const temp2 = new Array(4);
      for (let i = 0; i < 4; ++i) {
        temp2[i] = state[2 + i * 4];
      }
      for (let i = 0; i < 4; ++i) {
        state[2 + i * 4] = temp2[(i + 4 - this.shifts[2]) % 4];
      }

      // Row 3: shift by (4 - shifts[3])
      const temp3 = new Array(4);
      for (let i = 0; i < 4; ++i) {
        temp3[i] = state[3 + i * 4];
      }
      for (let i = 0; i < 4; ++i) {
        state[3 + i * 4] = temp3[(i + 4 - this.shifts[3]) % 4];
      }
    }

    _mixColumns(state) {
      for (let col = 0; col < 4; ++col) {
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
      for (let col = 0; col < 4; ++col) {
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

  const algorithmInstance = new GrandCruAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { GrandCruAlgorithm, GrandCruInstance };
});
