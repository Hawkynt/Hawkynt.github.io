/*
 * ISAP AEAD - Side-Channel Resistant Authenticated Encryption
 * Professional implementation following NIST LWC specification
 * (c)2006-2025 Hawkynt
 *
 * ISAP (Initialization-Authentication-Encryption with Side-channel Protection)
 * is an AEAD scheme designed specifically for side-channel resistance through
 * limited permutation calls per key bit.
 *
 * Features:
 * - ISAP-A-128A: Ascon permutation, 12/6/1 rounds (hash/enc/key)
 * - ISAP-K-128A: Keccak-p[400] permutation, 16/8/1 rounds
 * - 128-bit key, 128-bit nonce, 128-bit tag
 * - Designed to resist power analysis and timing attacks
 *
 * References:
 * - https://isap.isec.tugraz.at/
 * - NIST LWC Finalist Specification v2.0
 * - BouncyCastle ISAPEngine.java
 *
 * This implementation is for educational purposes demonstrating the unique
 * side-channel resistant design of ISAP.
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

  // ===== ASCON PERMUTATION UTILITIES =====
  // Extracted from isap-hash.js for code reuse

  // 64-bit rotation using OpCodes principles
  function rotr64(low, high, positions) {
    positions %= 64;
    if (positions === 0) return [low, high];
    if (positions === 32) return [high, low];

    if (positions < 32) {
      return [
        OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(low, positions), OpCodes.Shl32(high, 32 - positions))),
        OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(high, positions), OpCodes.Shl32(low, 32 - positions)))
      ];
    }

    positions -= 32;
    return [
      OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(high, positions), OpCodes.Shl32(low, 32 - positions))),
      OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(low, positions), OpCodes.Shl32(high, 32 - positions)))
    ];
  }

  // Ascon state: 5 x 64-bit words stored as [low32, high32] pairs
  class AsconState {
    constructor() {
      this.S = new Array(5);
      for (let i = 0; i < 5; ++i) {
        this.S[i] = [0, 0];
      }
    }

    // Set state from key and IV
    set(x0_low, x0_high, x1_low, x1_high, x2_low, x2_high, x3_low, x3_high, x4_low, x4_high) {
      this.S[0] = [x0_low, x0_high];
      this.S[1] = [x1_low, x1_high];
      this.S[2] = [x2_low, x2_high];
      this.S[3] = [x3_low, x3_high];
      this.S[4] = [x4_low, x4_high];
    }

    // Copy from another state
    copyFrom(other) {
      for (let i = 0; i < 5; ++i) {
        this.S[i] = [other.S[i][0], other.S[i][1]];
      }
    }

    // Ascon permutation round
    round(c) {
      // Apply constant to S2
      this.S[2][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[2][0], c));

      // Pre-XOR phase
      this.S[0][0] = OpCodes.XorN(this.S[0][0], this.S[4][0]); this.S[0][1] = OpCodes.XorN(this.S[0][1], this.S[4][1]);
      this.S[4][0] = OpCodes.XorN(this.S[4][0], this.S[3][0]); this.S[4][1] = OpCodes.XorN(this.S[4][1], this.S[3][1]);
      this.S[2][0] = OpCodes.XorN(this.S[2][0], this.S[1][0]); this.S[2][1] = OpCodes.XorN(this.S[2][1], this.S[1][1]);

      // S-box: Compute ~xi&xj (Chi layer)
      const t0_l = OpCodes.ToUint32(OpCodes.AndN(~this.S[0][0], this.S[1][0]));
      const t0_h = OpCodes.ToUint32(OpCodes.AndN(~this.S[0][1], this.S[1][1]));
      const t1_l = OpCodes.ToUint32(OpCodes.AndN(~this.S[1][0], this.S[2][0]));
      const t1_h = OpCodes.ToUint32(OpCodes.AndN(~this.S[1][1], this.S[2][1]));
      const t2_l = OpCodes.ToUint32(OpCodes.AndN(~this.S[2][0], this.S[3][0]));
      const t2_h = OpCodes.ToUint32(OpCodes.AndN(~this.S[2][1], this.S[3][1]));
      const t3_l = OpCodes.ToUint32(OpCodes.AndN(~this.S[3][0], this.S[4][0]));
      const t3_h = OpCodes.ToUint32(OpCodes.AndN(~this.S[3][1], this.S[4][1]));
      const t4_l = OpCodes.ToUint32(OpCodes.AndN(~this.S[4][0], this.S[0][0]));
      const t4_h = OpCodes.ToUint32(OpCodes.AndN(~this.S[4][1], this.S[0][1]));

      this.S[0][0] = OpCodes.XorN(this.S[0][0], t1_l); this.S[0][1] = OpCodes.XorN(this.S[0][1], t1_h);
      this.S[1][0] = OpCodes.XorN(this.S[1][0], t2_l); this.S[1][1] = OpCodes.XorN(this.S[1][1], t2_h);
      this.S[2][0] = OpCodes.XorN(this.S[2][0], t3_l); this.S[2][1] = OpCodes.XorN(this.S[2][1], t3_h);
      this.S[3][0] = OpCodes.XorN(this.S[3][0], t4_l); this.S[3][1] = OpCodes.XorN(this.S[3][1], t4_h);
      this.S[4][0] = OpCodes.XorN(this.S[4][0], t0_l); this.S[4][1] = OpCodes.XorN(this.S[4][1], t0_h);

      // Post-XOR phase
      this.S[1][0] = OpCodes.XorN(this.S[1][0], this.S[0][0]); this.S[1][1] = OpCodes.XorN(this.S[1][1], this.S[0][1]);
      this.S[0][0] = OpCodes.XorN(this.S[0][0], this.S[4][0]); this.S[0][1] = OpCodes.XorN(this.S[0][1], this.S[4][1]);
      this.S[3][0] = OpCodes.XorN(this.S[3][0], this.S[2][0]); this.S[3][1] = OpCodes.XorN(this.S[3][1], this.S[2][1]);
      this.S[2][0] = OpCodes.ToUint32(~this.S[2][0]);
      this.S[2][1] = OpCodes.ToUint32(~this.S[2][1]);

      // Linear diffusion layer
      const s0_l = this.S[0][0], s0_h = this.S[0][1];
      const s1_l = this.S[1][0], s1_h = this.S[1][1];
      const s2_l = this.S[2][0], s2_h = this.S[2][1];
      const s3_l = this.S[3][0], s3_h = this.S[3][1];
      const s4_l = this.S[4][0], s4_h = this.S[4][1];

      let r0 = rotr64(s0_l, s0_h, 19);
      let r1 = rotr64(s0_l, s0_h, 28);
      this.S[0][0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(s0_l, r0[0]), r1[0]));
      this.S[0][1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(s0_h, r0[1]), r1[1]));

      r0 = rotr64(s1_l, s1_h, 61);
      r1 = rotr64(s1_l, s1_h, 39);
      this.S[1][0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(s1_l, r0[0]), r1[0]));
      this.S[1][1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(s1_h, r0[1]), r1[1]));

      r0 = rotr64(s2_l, s2_h, 1);
      r1 = rotr64(s2_l, s2_h, 6);
      this.S[2][0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(s2_l, r0[0]), r1[0]));
      this.S[2][1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(s2_h, r0[1]), r1[1]));

      r0 = rotr64(s3_l, s3_h, 10);
      r1 = rotr64(s3_l, s3_h, 17);
      this.S[3][0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(s3_l, r0[0]), r1[0]));
      this.S[3][1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(s3_h, r0[1]), r1[1]));

      r0 = rotr64(s4_l, s4_h, 7);
      r1 = rotr64(s4_l, s4_h, 41);
      this.S[4][0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(s4_l, r0[0]), r1[0]));
      this.S[4][1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(s4_h, r0[1]), r1[1]));
    }

    // Ascon-p[12] permutation
    p12() {
      this.round(0xf0);
      this.round(0xe1);
      this.round(0xd2);
      this.round(0xc3);
      this.round(0xb4);
      this.round(0xa5);
      this.round(0x96);
      this.round(0x87);
      this.round(0x78);
      this.round(0x69);
      this.round(0x5a);
      this.round(0x4b);
    }

    // Ascon-p[6] permutation (last 6 rounds)
    p6() {
      this.round(0x96);
      this.round(0x87);
      this.round(0x78);
      this.round(0x69);
      this.round(0x5a);
      this.round(0x4b);
    }
  }

  // ===== ISAP-A-128A ALGORITHM =====

  class ISAPA128AAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "ISAP-A-128A";
      this.description = "Side-channel resistant AEAD using Ascon permutation with 12/6/1 round configuration. Designed to protect against power analysis and timing attacks through limited permutation calls per key bit.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Stefan Mangard, Florian Mendel, Robert Primas";
      this.year = 2017;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.AUSTRIA;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "ISAP v2.0 Specification",
          "https://isap.isec.tugraz.at/"
        ),
        new LinkItem(
          "NIST LWC Finalist",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "ISAP Paper (ToSC 2017)",
          "https://tosc.iacr.org/index.php/ToSC/article/view/8625"
        ),
        new LinkItem(
          "BouncyCastle Reference",
          "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/ISAPEngine.java"
        )
      ];

      // Test vectors from NIST LWC official KAT file
      // Reference: isapa128av20_LWC_AEAD_KAT_128_128.txt
      this.tests = [
        {
          text: "ISAP-A-128A: Empty PT, Empty AD (NIST LWC KAT Count=1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("7B94EF35AE55AB272C9C44D6C1CF0102")
        },
        {
          text: "ISAP-A-128A: Empty PT, 1-byte AD (NIST LWC KAT Count=2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("40FEAD6FDF1C2D6D6EAE40DEDDFF9F55")
        },
        {
          text: "ISAP-A-128A: Empty PT, 8-byte AD (NIST LWC KAT Count=9)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("0001020304050607"),
          input: [],
          expected: OpCodes.Hex8ToBytes("7AE5F96BD1AE7F5B08FA85177750B6B3")
        },
        {
          text: "ISAP-A-128A: 1-byte PT, Empty AD (NIST LWC KAT Count=34)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("2CFACF138C6FDBBCC8763A7205FD66316D")
        },
        {
          text: "ISAP-A-128A: 8-byte PT, 8-byte AD (NIST LWC KAT)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("2CDE28DBBBD9131E4270DFFF9B0C36C0824E86D98DAED276")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ISAPA128AInstance(this, isInverse);
    }
  }

  /**
 * ISAPA128A cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ISAPA128AInstance extends IAeadInstance {
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
      this._associatedData = [];
      this.inputBuffer = [];
      this.initialized = false;

      // ISAP-A-128A parameters
      this.RATE = 8; // 64 bits = 8 bytes
      this.KEY_SIZE = 16;
      this.NONCE_SIZE = 16;
      this.TAG_SIZE = 16;

      // ISAP-A-128A IVs (as 64-bit big-endian values)
      // Reference: BouncyCastle ISAPEngine.java ISAPAEAD_A_128A
      // IV1 = 0x01 || keySize*8 || rate*8 || 0x01 || sH || sB || sE || sK
      //     = 0x01 80 40 01 0C 01 06 0C = 108156764297430540
      this.ISAP_IV1_64 = [0x0c01060c, 0x01804001]; // [low32, high32] of big-endian value
      // IV2 = 0x02 80 40 01 0C 01 06 0C = 180214358335358476
      this.ISAP_IV2_64 = [0x0c01060c, 0x02804001];
      // IV3 = 0x03 80 40 01 0C 01 06 0C = 252271952373286412
      this.ISAP_IV3_64 = [0x0c01060c, 0x03804001];
    }

    // Property: key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (keyBytes.length !== this.KEY_SIZE) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._initializeIfReady();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    // Property: nonce
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        this.initialized = false;
        return;
      }

      if (nonceBytes.length !== this.NONCE_SIZE) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes`);
      }

      this._nonce = [...nonceBytes];
      this._initializeIfReady();
    }

    get nonce() { return this._nonce ? [...this._nonce] : null; }

    // Property: associatedData
    set associatedData(adBytes) {
      this._associatedData = adBytes ? [...adBytes] : [];
    }

    get associatedData() { return [...this._associatedData]; }

    _initializeIfReady() {
      if (this._key && this._nonce) {
        this.initialized = true;
      }
    }

    // Feed input data (plaintext or ciphertext)
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.initialized) throw new Error("Key and nonce not set");

      this.inputBuffer.push(...data);
    }

    // Result: perform AEAD encrypt/decrypt
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.initialized) throw new Error("Key and nonce not set");

      if (this.isInverse) {
        return this._decrypt();
      } else {
        return this._encrypt();
      }
    }

    // Encryption: plaintext -> ciphertext || tag
    _encrypt() {
      const plaintext = this.inputBuffer;
      const output = [];

      // 1. Encrypt plaintext
      const encState = this._isap_rk(this.ISAP_IV3_64, this._nonce);
      // Set nonce in state[3:4]
      const nonce64_0 = OpCodes.Pack32BE(this._nonce[0], this._nonce[1], this._nonce[2], this._nonce[3]);
      const nonce64_1 = OpCodes.Pack32BE(this._nonce[4], this._nonce[5], this._nonce[6], this._nonce[7]);
      const nonce64_2 = OpCodes.Pack32BE(this._nonce[8], this._nonce[9], this._nonce[10], this._nonce[11]);
      const nonce64_3 = OpCodes.Pack32BE(this._nonce[12], this._nonce[13], this._nonce[14], this._nonce[15]);
      encState.S[3] = [nonce64_1, nonce64_0]; // x3 = nonce[0:8]
      encState.S[4] = [nonce64_3, nonce64_2]; // x4 = nonce[8:16]
      encState.p6(); // First permutation before encryption

      // Encrypt blocks
      let offset = 0;
      while (offset < plaintext.length) {
        const blockSize = Math.min(this.RATE, plaintext.length - offset);

        // XOR plaintext with state[0] to produce ciphertext
        const stateBytes = OpCodes.Unpack32BE(encState.S[0][1]).concat(OpCodes.Unpack32BE(encState.S[0][0]));

        for (let i = 0; i < blockSize; ++i) {
          output.push(OpCodes.XorN(plaintext[offset + i], stateBytes[i]));
        }

        offset += blockSize;
        if (offset < plaintext.length) {
          encState.p6(); // sE rounds between blocks
        }
      }

      // 2. Compute authentication tag
      const tag = this._isap_mac(output);
      output.push(...tag);

      // Clear buffers
      this.inputBuffer = [];
      return output;
    }

    // Decryption: ciphertext || tag -> plaintext (or error)
    _decrypt() {
      const input = this.inputBuffer;

      if (input.length < this.TAG_SIZE) {
        throw new Error("Invalid ciphertext: too short for tag");
      }

      const ciphertext = input.slice(0, input.length - this.TAG_SIZE);
      const receivedTag = input.slice(input.length - this.TAG_SIZE);

      // 1. Compute authentication tag over ciphertext
      const computedTag = this._isap_mac(ciphertext);

      // 2. Verify tag (constant-time comparison)
      let tagMatch = true;
      for (let i = 0; i < this.TAG_SIZE; ++i) {
        if (computedTag[i] !== receivedTag[i]) {
          tagMatch = false;
        }
      }

      if (!tagMatch) {
        throw new Error("Authentication tag verification failed");
      }

      // 3. Decrypt ciphertext
      const plaintext = [];
      const encState = this._isap_rk(this.ISAP_IV3_64, this._nonce);
      // Set nonce in state[3:4]
      const nonce64_0 = OpCodes.Pack32BE(this._nonce[0], this._nonce[1], this._nonce[2], this._nonce[3]);
      const nonce64_1 = OpCodes.Pack32BE(this._nonce[4], this._nonce[5], this._nonce[6], this._nonce[7]);
      const nonce64_2 = OpCodes.Pack32BE(this._nonce[8], this._nonce[9], this._nonce[10], this._nonce[11]);
      const nonce64_3 = OpCodes.Pack32BE(this._nonce[12], this._nonce[13], this._nonce[14], this._nonce[15]);
      encState.S[3] = [nonce64_1, nonce64_0];
      encState.S[4] = [nonce64_3, nonce64_2];
      encState.p6();

      // Decrypt blocks
      let offset = 0;
      while (offset < ciphertext.length) {
        const blockSize = Math.min(this.RATE, ciphertext.length - offset);

        const stateBytes = OpCodes.Unpack32BE(encState.S[0][1]).concat(OpCodes.Unpack32BE(encState.S[0][0]));

        for (let i = 0; i < blockSize; ++i) {
          plaintext.push(OpCodes.XorN(ciphertext[offset + i], stateBytes[i]));
        }

        offset += blockSize;
        if (offset < ciphertext.length) {
          encState.p6();
        }
      }

      // Clear buffers
      this.inputBuffer = [];
      return plaintext;
    }

    // ISAP re-keying function
    // Reference: BouncyCastle ISAPEngine.java isap_rk(), internal-isap.h
    _isap_rk(iv64, y) {
      const state = new AsconState();

      // Initialize state with key and IV
      // state = K[0:8] || K[8:16] || IV || 0 || 0
      const k64_0 = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
      const k64_1 = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
      const k64_2 = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
      const k64_3 = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);

      state.S[0] = [k64_1, k64_0]; // x0 = K[0:8]
      state.S[1] = [k64_3, k64_2]; // x1 = K[8:16]
      state.S[2] = [iv64[0], iv64[1]]; // x2 = IV
      state.S[3] = [0, 0];
      state.S[4] = [0, 0];

      state.p12(); // sK rounds

      // Absorb Y bit by bit with sB=1 round each
      // Reference: internal-isap.h lines 104-111
      const numBits = y.length * 8 - 1;
      for (let bit = 0; bit < numBits; ++bit) {
        const byteIndex = Math.floor(bit / 8);
        const bitIndex = 7 - (bit % 8);
        const bitValue = OpCodes.AndN(OpCodes.Shr32(y[byteIndex], bitIndex), 0x01);

        // XOR bit into state[0] MSB: x0 ^= OpCodes.Shl32((OpCodes.Shl32(bit, 7)), 56)
        state.S[0][1] = OpCodes.ToUint32(OpCodes.XorN(state.S[0][1], OpCodes.Shl32(OpCodes.Shl32(bitValue, 7), 24)));

        // Single round (sB = 1)
        state.round(0x4b); // Last round constant
      }

      // Absorb final bit
      const lastBit = OpCodes.AndN(y[y.length - 1], 0x01);
      state.S[0][1] = OpCodes.ToUint32(OpCodes.XorN(state.S[0][1], OpCodes.Shl32(OpCodes.Shl32(lastBit, 7), 24)));

      state.p12(); // Final sK rounds

      return state;
    }

    // ISAP MAC computation
    // Reference: BouncyCastle ISAPEngine.java processMACFinal(), internal-isap.h isap_mac()
    _isap_mac(ciphertext) {
      const macState = new AsconState();

      // Initialize MAC state with nonce || IV1
      // Reference: internal-isap.h lines 246-250
      const nonce64_0 = OpCodes.Pack32BE(this._nonce[0], this._nonce[1], this._nonce[2], this._nonce[3]);
      const nonce64_1 = OpCodes.Pack32BE(this._nonce[4], this._nonce[5], this._nonce[6], this._nonce[7]);
      const nonce64_2 = OpCodes.Pack32BE(this._nonce[8], this._nonce[9], this._nonce[10], this._nonce[11]);
      const nonce64_3 = OpCodes.Pack32BE(this._nonce[12], this._nonce[13], this._nonce[14], this._nonce[15]);

      macState.S[0] = [nonce64_1, nonce64_0];
      macState.S[1] = [nonce64_3, nonce64_2];
      macState.S[2] = [this.ISAP_IV1_64[0], this.ISAP_IV1_64[1]];
      macState.S[3] = [0, 0];
      macState.S[4] = [0, 0];

      macState.p12(); // sH rounds

      // Absorb associated data
      let offset = 0;
      while (offset + this.RATE <= this._associatedData.length) {
        const block64_high = OpCodes.Pack32BE(
          this._associatedData[offset], this._associatedData[offset + 1],
          this._associatedData[offset + 2], this._associatedData[offset + 3]
        );
        const block64_low = OpCodes.Pack32BE(
          this._associatedData[offset + 4], this._associatedData[offset + 5],
          this._associatedData[offset + 6], this._associatedData[offset + 7]
        );
        macState.S[0][1] = OpCodes.XorN(macState.S[0][1], block64_high);
        macState.S[0][0] = OpCodes.XorN(macState.S[0][0], block64_low);
        macState.p12();
        offset += this.RATE;
      }

      // Absorb final AD block with padding
      const adRemainder = this._associatedData.length - offset;
      for (let i = 0; i < adRemainder; ++i) {
        const shiftAmount = (7 - i) * 8;
        macState.S[0][1] = OpCodes.ToUint32(OpCodes.XorN(macState.S[0][1], OpCodes.Shl32(OpCodes.AndN(this._associatedData[offset + i], 0xFF), shiftAmount)));
      }
      macState.S[0][1] = OpCodes.ToUint32(OpCodes.XorN(macState.S[0][1], OpCodes.Shl32(0x80, (7 - adRemainder) * 8)));
      macState.p12();

      // Domain separation
      macState.S[4][0] = OpCodes.ToUint32(OpCodes.XorN(macState.S[4][0], 1));

      // Absorb ciphertext
      offset = 0;
      while (offset + this.RATE <= ciphertext.length) {
        const block64_high = OpCodes.Pack32BE(
          ciphertext[offset], ciphertext[offset + 1],
          ciphertext[offset + 2], ciphertext[offset + 3]
        );
        const block64_low = OpCodes.Pack32BE(
          ciphertext[offset + 4], ciphertext[offset + 5],
          ciphertext[offset + 6], ciphertext[offset + 7]
        );
        macState.S[0][1] = OpCodes.XorN(macState.S[0][1], block64_high);
        macState.S[0][0] = OpCodes.XorN(macState.S[0][0], block64_low);
        macState.p12();
        offset += this.RATE;
      }

      // Absorb final ciphertext block with padding
      const ctRemainder = ciphertext.length - offset;
      for (let i = 0; i < ctRemainder; ++i) {
        const shiftAmount = (7 - i) * 8;
        macState.S[0][1] = OpCodes.ToUint32(OpCodes.XorN(macState.S[0][1], OpCodes.Shl32(OpCodes.AndN(ciphertext[offset + i], 0xFF), shiftAmount)));
      }
      macState.S[0][1] = OpCodes.ToUint32(OpCodes.XorN(macState.S[0][1], OpCodes.Shl32(0x80, (7 - ctRemainder) * 8)));
      macState.p12();

      // Derive K* (re-keyed key)
      const tag = [];
      tag.push(...OpCodes.Unpack32BE(macState.S[0][1]));
      tag.push(...OpCodes.Unpack32BE(macState.S[0][0]));
      tag.push(...OpCodes.Unpack32BE(macState.S[1][1]));
      tag.push(...OpCodes.Unpack32BE(macState.S[1][0]));

      // Save state[2:4]
      const saved2 = [macState.S[2][0], macState.S[2][1]];
      const saved3 = [macState.S[3][0], macState.S[3][1]];
      const saved4 = [macState.S[4][0], macState.S[4][1]];

      // Re-key with IV2
      const rekeyState = this._isap_rk(this.ISAP_IV2_64, tag);
      macState.S[0] = [rekeyState.S[0][0], rekeyState.S[0][1]];
      macState.S[1] = [rekeyState.S[1][0], rekeyState.S[1][1]];

      // Restore state[2:4]
      macState.S[2] = saved2;
      macState.S[3] = saved3;
      macState.S[4] = saved4;

      // Squeeze tag
      macState.p12();

      const finalTag = [];
      finalTag.push(...OpCodes.Unpack32BE(macState.S[0][1]));
      finalTag.push(...OpCodes.Unpack32BE(macState.S[0][0]));
      finalTag.push(...OpCodes.Unpack32BE(macState.S[1][1]));
      finalTag.push(...OpCodes.Unpack32BE(macState.S[1][0]));

      return finalTag;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new ISAPA128AAlgorithm());
  return ISAPA128AAlgorithm;
}));
