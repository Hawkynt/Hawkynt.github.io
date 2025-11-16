/*
 * GASCON-128 AEAD - Bit-Interleaved Variant of Ascon
 * Professional implementation following NIST LWC submission
 * (c)2006-2025 Hawkynt
 *
 * GASCON is a lightweight AEAD cipher family based on Ascon's sponge construction
 * but using bit-interleaved representation for efficient 32-bit implementation.
 * This implementation provides GASCON-128 with:
 * - 128-bit key, 128-bit nonce, 128-bit tag
 * - 8-byte rate with 6-round intermediate permutation
 * - 40-byte state (5 x 64-bit words in bit-interleaved format)
 *
 * Reference: Southern Storm Software LWC implementations
 * Submission: https://csrc.nist.gov/projects/lightweight-cryptography
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
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Helper functions for 32-bit rotation (from OpCodes)
  function rightRotate(value, positions) {
    value = value >>> 0;
    positions &= 31;
    return ((value >>> positions) | (value << (32 - positions))) >>> 0;
  }

  function rightRotate1(value) {
    return ((value >>> 1) | (value << 31)) >>> 0;
  }

  // Bit-interleaved 64-bit rotation helpers for GASCON
  // GASCON uses bit-interleaving: 64-bit value split into even/odd bits stored in separate 32-bit words

  // Even rotation: both words rotate by same amount
  function intRightRotateEven(xl, xh, bits) {
    const yl = rightRotate(xl, bits);
    const yh = rightRotate(xh, bits);
    return [yl, yh];
  }

  // Odd rotation: words swap and rotate differently
  function intRightRotateOdd(xl, xh, bits) {
    const yl = rightRotate(xh, bits);
    const yh = rightRotate(xl, (bits + 1) % 32);
    return [yl, yh];
  }

  // Specific rotations used in GASCON diffusion layer
  function intRightRotate1_64(xl, xh) {
    return [xh, rightRotate1(xl)];
  }

  function intRightRotate6_64(xl, xh) {
    return intRightRotateEven(xl, xh, 3);
  }

  function intRightRotate7_64(xl, xh) {
    return intRightRotateOdd(xl, xh, 3);
  }

  function intRightRotate10_64(xl, xh) {
    return intRightRotateEven(xl, xh, 5);
  }

  function intRightRotate17_64(xl, xh) {
    return intRightRotateOdd(xl, xh, 8);
  }

  function intRightRotate19_64(xl, xh) {
    return intRightRotateOdd(xl, xh, 9);
  }

  function intRightRotate28_64(xl, xh) {
    return intRightRotateEven(xl, xh, 14);
  }

  function intRightRotate38_64(xl, xh) {
    return intRightRotateEven(xl, xh, 19);
  }

  function intRightRotate40_64(xl, xh) {
    return intRightRotateEven(xl, xh, 20);
  }

  function intRightRotate61_64(xl, xh) {
    return intRightRotateOdd(xl, xh, 30);
  }

  // GASCON permutation using bit-interleaved representation
  class GasconPermutation {
    constructor() {
      // State: 40 bytes (compatible with C reference)
      this.B = new Array(40).fill(0);
    }

    // Get 32-bit word at byte offset (little-endian)
    getWord32LE(offset) {
      return OpCodes.Pack32LE(
        this.B[offset],
        this.B[offset + 1],
        this.B[offset + 2],
        this.B[offset + 3]
      );
    }

    // Set 32-bit word at byte offset (little-endian)
    setWord32LE(offset, value) {
      const bytes = OpCodes.Unpack32LE(value);
      this.B[offset] = bytes[0];
      this.B[offset + 1] = bytes[1];
      this.B[offset + 2] = bytes[2];
      this.B[offset + 3] = bytes[3];
    }

    // GASCON permutation (bit-interleaved version of Ascon)
    permute(firstRound) {
      // Load state as 10 x 32-bit little-endian words
      let x0_l = this.getWord32LE(0);
      let x0_h = this.getWord32LE(4);
      let x1_l = this.getWord32LE(8);
      let x1_h = this.getWord32LE(12);
      let x2_l = this.getWord32LE(16);
      let x2_h = this.getWord32LE(20);
      let x3_l = this.getWord32LE(24);
      let x3_h = this.getWord32LE(28);
      let x4_l = this.getWord32LE(32);
      let x4_h = this.getWord32LE(36);

      for (let round = firstRound; round < 12; ++round) {
        // Add round constant to x2 low word
        x2_l ^= ((0x0F - round) << 4) | round;

        // Substitution layer (5-bit S-box applied to both low and high words)
        // x0 ^= x4; x2 ^= x1; x4 ^= x3;
        x0_l ^= x4_l; x0_h ^= x4_h;
        x2_l ^= x1_l; x2_h ^= x1_h;
        x4_l ^= x3_l; x4_h ^= x3_h;

        // t0 = ~x0 & x1; t1 = ~x1 & x2; t2 = ~x2 & x3; t3 = ~x3 & x4; t4 = ~x4 & x0;
        const t0_l = (~x0_l & x1_l) >>> 0;
        const t0_h = (~x0_h & x1_h) >>> 0;
        const t1_l = (~x1_l & x2_l) >>> 0;
        const t1_h = (~x1_h & x2_h) >>> 0;
        const t2_l = (~x2_l & x3_l) >>> 0;
        const t2_h = (~x2_h & x3_h) >>> 0;
        const t3_l = (~x3_l & x4_l) >>> 0;
        const t3_h = (~x3_h & x4_h) >>> 0;
        const t4_l = (~x4_l & x0_l) >>> 0;
        const t4_h = (~x4_h & x0_h) >>> 0;

        // x0 ^= t1; x1 ^= t2; x2 ^= t3; x3 ^= t4; x4 ^= t0;
        x0_l ^= t1_l; x0_h ^= t1_h;
        x1_l ^= t2_l; x1_h ^= t2_h;
        x2_l ^= t3_l; x2_h ^= t3_h;
        x3_l ^= t4_l; x3_h ^= t4_h;
        x4_l ^= t0_l; x4_h ^= t0_h;

        // x1 ^= x0; x3 ^= x2; x0 ^= x4; x2 = ~x2;
        x1_l ^= x0_l; x1_h ^= x0_h;
        x3_l ^= x2_l; x3_h ^= x2_h;
        x0_l ^= x4_l; x0_h ^= x4_h;
        x2_l = (~x2_l) >>> 0;
        x2_h = (~x2_h) >>> 0;

        // Linear diffusion layer (bit-interleaved rotations)
        // x0 ^= intRightRotate19_64(x0) ^ intRightRotate28_64(x0)
        let r0 = intRightRotate19_64(x0_l, x0_h);
        let r1 = intRightRotate28_64(x0_l, x0_h);
        x0_l ^= r0[0] ^ r1[0];
        x0_h ^= r0[1] ^ r1[1];

        // x1 ^= intRightRotate61_64(x1) ^ intRightRotate38_64(x1)
        r0 = intRightRotate61_64(x1_l, x1_h);
        r1 = intRightRotate38_64(x1_l, x1_h);
        x1_l ^= r0[0] ^ r1[0];
        x1_h ^= r0[1] ^ r1[1];

        // x2 ^= intRightRotate1_64(x2) ^ intRightRotate6_64(x2)
        r0 = intRightRotate1_64(x2_l, x2_h);
        r1 = intRightRotate6_64(x2_l, x2_h);
        x2_l ^= r0[0] ^ r1[0];
        x2_h ^= r0[1] ^ r1[1];

        // x3 ^= intRightRotate10_64(x3) ^ intRightRotate17_64(x3)
        r0 = intRightRotate10_64(x3_l, x3_h);
        r1 = intRightRotate17_64(x3_l, x3_h);
        x3_l ^= r0[0] ^ r1[0];
        x3_h ^= r0[1] ^ r1[1];

        // x4 ^= intRightRotate7_64(x4) ^ intRightRotate40_64(x4)
        r0 = intRightRotate7_64(x4_l, x4_h);
        r1 = intRightRotate40_64(x4_l, x4_h);
        x4_l ^= r0[0] ^ r1[0];
        x4_h ^= r0[1] ^ r1[1];
      }

      // Store back to state
      this.setWord32LE(0, x0_l);
      this.setWord32LE(4, x0_h);
      this.setWord32LE(8, x1_l);
      this.setWord32LE(12, x1_h);
      this.setWord32LE(16, x2_l);
      this.setWord32LE(20, x2_h);
      this.setWord32LE(24, x3_l);
      this.setWord32LE(28, x3_h);
      this.setWord32LE(32, x4_l);
      this.setWord32LE(36, x4_h);
    }

    // XOR data into state at given byte offset
    xorBytes(data, offset, length) {
      for (let i = 0; i < length; ++i) {
        this.B[offset + i] ^= data[i];
      }
    }

    // XOR and extract data for encryption
    xorAndExtract(data, offset, length) {
      const output = [];
      for (let i = 0; i < length; ++i) {
        this.B[offset + i] ^= data[i];
        output.push(this.B[offset + i]);
      }
      return output;
    }

    // XOR and replace for decryption
    xorAndReplace(data, offset, length) {
      const output = [];
      for (let i = 0; i < length; ++i) {
        const plainByte = this.B[offset + i] ^ data[i];
        output.push(plainByte);
        this.B[offset + i] = data[i];
      }
      return output;
    }
  }

  // GASCON-128 algorithm class
  class Gascon128 extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "GASCON-128 AEAD";
      this.description = "Bit-interleaved variant of Ascon optimized for 32-bit platforms. Provides authenticated encryption with 128-bit security level using sponge construction with efficient bit-interleaved permutation.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "NIST LWC Project",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "GASCON Specification",
          "https://ascon.iaik.tugraz.at/"
        ),
        new LinkItem(
          "Reference Implementation",
          "https://github.com/rweather/lightweight-crypto"
        )
      ];

      // Official test vectors from GASCON-128.txt
      this.tests = [
        {
          text: "GASCON-128: Empty message, empty AAD (Count 1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("16F28158685B2A85F573C62E16D61F09")
        },
        {
          text: "GASCON-128: Empty message with 8-byte AAD (Count 9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("15D0B60D1C4C3155966CBCF508EEDCD9")
        },
        {
          text: "GASCON-128: 1-byte plaintext, empty AAD (Count 34)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("1269EAF2046BE0BD81FEF44491D24A035C")
        },
        {
          text: "GASCON-128: 1-byte plaintext with 1-byte AAD (Count 35)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("32C53850FAC4F45EC3303C6618151EA75B")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Gascon128Instance(this, isInverse);
    }
  }

  // GASCON-128 instance implementing Feed/Result pattern
  /**
 * Gascon128 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Gascon128Instance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._aad = [];
      this.inputBuffer = [];

      // GASCON-128 parameters
      this.IV = 0x80400c0600000000;
      this.rate = 8; // 8-byte rate
      this.tagSize = 16; // 16-byte tag

      this.perm = new GasconPermutation();
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16)`);
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 16) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected 16)`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() { return this._nonce ? [...this._nonce] : null; }

    set aad(aadBytes) {
      if (!aadBytes) {
        this._aad = [];
        return;
      }
      this._aad = [...aadBytes];
    }

    get aad() { return [...this._aad]; }

    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    get associatedData() {
      return this.aad;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      if (this.isInverse) {
        // Decrypt mode
        if (this.inputBuffer.length < 16) {
          throw new Error("Ciphertext too short (must include tag)");
        }
        return this._decrypt();
      } else {
        // Encrypt mode
        return this._encrypt();
      }
    }

    // Initialize GASCON state following C reference
    _initialize() {
      // State layout: [IV 8 bytes][Key 16 bytes][Nonce 16 bytes]
      // Store IV as 64-bit little-endian (C reference uses le_store_word64)
      const ivLow = (this.IV & 0xFFFFFFFF) >>> 0;
      const ivHigh = Math.floor(this.IV / 0x100000000);

      // le_store_word64 stores bytes in little-endian order
      this.perm.B[0] = (ivLow) & 0xFF;
      this.perm.B[1] = (ivLow >>> 8) & 0xFF;
      this.perm.B[2] = (ivLow >>> 16) & 0xFF;
      this.perm.B[3] = (ivLow >>> 24) & 0xFF;
      this.perm.B[4] = (ivHigh) & 0xFF;
      this.perm.B[5] = (ivHigh >>> 8) & 0xFF;
      this.perm.B[6] = (ivHigh >>> 16) & 0xFF;
      this.perm.B[7] = (ivHigh >>> 24) & 0xFF;

      // Copy key and nonce (C reference uses memcpy)
      for (let i = 0; i < 16; ++i) {
        this.perm.B[8 + i] = this._key[i];
        this.perm.B[24 + i] = this._nonce[i];
      }

      // P12 (12 rounds starting from round 0)
      this.perm.permute(0);

      // XOR key into state at position 24 (bytes 24-39)
      // C reference: lw_xor_block(state.B + 24, k, GASCON128_KEY_SIZE)
      this.perm.xorBytes(this._key, 24, 16);
    }

    // Absorb AAD into state with 8-byte rate
    _absorbAAD(aad) {
      let pos = 0;
      while (pos + 8 <= aad.length) {
        this.perm.xorBytes(aad.slice(pos, pos + 8), 0, 8);
        this.perm.permute(6); // P6 (6 rounds starting from round 6)
        pos += 8;
      }

      // Process final partial block
      if (pos < aad.length) {
        this.perm.xorBytes(aad.slice(pos), 0, aad.length - pos);
      }

      // Pad with 0x80 at position after last AAD byte
      this.perm.B[aad.length % 8] ^= 0x80;

      this.perm.permute(6); // P6
    }

    // Encrypt plaintext
    _encrypt() {
      this._initialize();

      // Process AAD
      if (this._aad.length > 0) {
        this._absorbAAD(this._aad);
      }

      // Domain separation (byte 39 ^= 0x01)
      this.perm.B[39] ^= 0x01;

      // Encrypt plaintext with 8-byte rate
      const ciphertext = [];
      const plaintext = this.inputBuffer;
      let pos = 0;

      while (pos + 8 <= plaintext.length) {
        const block = this.perm.xorAndExtract(plaintext.slice(pos, pos + 8), 0, 8);
        ciphertext.push(...block);
        this.perm.permute(6); // P6
        pos += 8;
      }

      // Process final partial block
      if (pos < plaintext.length) {
        const block = this.perm.xorAndExtract(plaintext.slice(pos), 0, plaintext.length - pos);
        ciphertext.push(...block);
      }

      // Pad with 0x80 at position after last plaintext byte
      this.perm.B[plaintext.length % 8] ^= 0x80;

      // Finalize: XOR key at position 8 (bytes 8-23)
      this.perm.xorBytes(this._key, 8, 16);

      // P12 for finalization
      this.perm.permute(0);

      // Generate tag: bytes 24-39 XOR key
      // C reference: lw_xor_block_2_src(c + mlen, state.B + 24, k, 16)
      const tag = [];
      for (let i = 0; i < 16; ++i) {
        tag.push(this.perm.B[24 + i] ^ this._key[i]);
      }

      // Return ciphertext + tag
      this.inputBuffer = [];
      return [...ciphertext, ...tag];
    }

    // Decrypt ciphertext
    _decrypt() {
      const ciphertextWithTag = this.inputBuffer;
      const ciphertextLen = ciphertextWithTag.length - 16;
      const ciphertext = ciphertextWithTag.slice(0, ciphertextLen);
      const receivedTag = ciphertextWithTag.slice(ciphertextLen);

      this._initialize();

      // Process AAD
      if (this._aad.length > 0) {
        this._absorbAAD(this._aad);
      }

      // Domain separation (byte 39 ^= 0x01)
      this.perm.B[39] ^= 0x01;

      // Decrypt ciphertext with 8-byte rate
      const plaintext = [];
      let pos = 0;

      while (pos + 8 <= ciphertext.length) {
        const block = this.perm.xorAndReplace(ciphertext.slice(pos, pos + 8), 0, 8);
        plaintext.push(...block);
        this.perm.permute(6); // P6
        pos += 8;
      }

      // Process final partial block
      if (pos < ciphertext.length) {
        const block = this.perm.xorAndReplace(ciphertext.slice(pos), 0, ciphertext.length - pos);
        plaintext.push(...block);
      }

      // Pad with 0x80 at position after last ciphertext byte
      this.perm.B[ciphertext.length % 8] ^= 0x80;

      // Finalize: XOR key at position 8 (bytes 8-23)
      this.perm.xorBytes(this._key, 8, 16);

      // P12 for finalization
      this.perm.permute(0);

      // Generate expected tag: bytes 24-39 XOR key
      const expectedTag = [];
      for (let i = 0; i < 16; ++i) {
        expectedTag.push(this.perm.B[24 + i] ^ this._key[i]);
      }

      // Constant-time tag comparison
      let tagMatch = true;
      for (let i = 0; i < 16; ++i) {
        if (expectedTag[i] !== receivedTag[i]) {
          tagMatch = false;
        }
      }

      if (!tagMatch) {
        throw new Error("Authentication tag verification failed");
      }

      this.inputBuffer = [];
      return plaintext;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new Gascon128());

  return {
    Gascon128,
    Gascon128Instance
  };
}));
