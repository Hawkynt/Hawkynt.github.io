/*
 * CLEFIA Block Cipher - RFC 6114 Compliant Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Based on RFC 6114: The 128-Bit Blockcipher CLEFIA
 * Sony Corporation specification
 * Production-ready implementation matching official test vectors
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // S-Box S0 from RFC 6114 Table 1
  const S0 = OpCodes.Hex8ToBytes(
    "5749d1c62f3374fb956d82ea0eb0a81c28d04b925cee85b1c40a763d63f917af" +
    "bfa11965f77a322006cee4839d5b4cd8425d2ee8d49b0f133c8967c071aab6f5" +
    "a4befd8c120097da78e1cf6b394355263098ccddeb54b38f4e16fa22a5770961" +
    "d62a533745c16caeef7008998b1df2b4e9c79f4a3125fe7cd3a2bd561488600b" +
    "cde234509edc11052bb7a948ff668a73037586f16aa740c2b92cdb1f58943eed" +
    "fc1ba004b88de6596293357eca21df4715f3ba7fa669c84d873b9c01e0de2452" +
    "7b0c681e80b25ae7add523f4463f91c96e8472bb0d18d996f05f41ac27c5e33a" +
    "816f07a379f62d381a445eb5d2eccb909a36e529c34fab6451f810d7bc027d8e"
  );
  Object.freeze(S0);

  // S-Box S1 from RFC 6114 Table 2
  const S1 = OpCodes.Hex8ToBytes(
    "6cdac3e94e9d0a3db836b43813340cd9bf74948fb79ce5dc9e07494f982cb093" +
    "12ebcdb392e74160e321273be619d20e9111c73f2a8ea1bc2bc8c50f5bf3878b" +
    "fbf5de20c6a784ced86551c9a4ef4353255d9b31e83e0dd780ff698aba0b735c" +
    "6e541562f6353052a316d32832faaa5ecfeaed783358097b63c0c1461edfa999" +
    "5504c486397782ec4018909759dd831f9a370624647ca556480885d06126ca6f" +
    "7e6ab671a07005d1458c231cf0ee89ad7a4bc22fdb5a4d7667172df4cbb14aa8" +
    "b522473ad5104c72cc00f9e0fde2feaef85fabf11b4281d6be4429a657b9aff2" +
    "d47566bb689f5002013c7f8d1a88bdacf7e47996a2fc6db26b03e12e7d14951d"
  );
  Object.freeze(S1);

  // CON constant generation - RFC 6114 Section 6.6
  // P(16) = 0xb7e1 (fractional part of e-2), Q(16) = 0x243f (fractional part of pi-3)
  // T_k[i] evolves in GF(2^16) defined by the primitive polynomial
  // z^16 + z^15 + z^13 + z^11 + z^5 + z^4 + 1 (0x1a831); each step multiplies
  // by the multiplicative inverse of z (division by 2 in the field).
  const CON_P16 = 0xb7e1;
  const CON_Q16 = 0x243f;

  // Divide a GF(2^16) element by z (multiply by the inverse of 2) under the
  // CLEFIA constant-generation polynomial: reduce with the low 16 bits of the
  // primitive polynomial (0xa831) whenever the constant term is set.
  /**
   * @param {uint32} t - GF(2^16) element
   * @returns {uint32} t / z
   */
  function gf16DivZ(t) {
    return OpCodes.And32(t, 1) !== 0 ? OpCodes.Or32(OpCodes.Shr16(OpCodes.Xor32(t, 0xa831), 1), 0x8000) : OpCodes.Shr16(t, 1);
  }

  // Generate `count` pairs of 32-bit CON words from the given 16-bit IV,
  // per RFC 6114 Section 6.6 (Table 4-9 lists the resulting constants).
  /**
   * @param {uint32} iv - 16-bit IV
   * @param {int32} count - Number of word pairs
   * @returns {uint32[]} CON words
   */
  function generateCON(iv, count) {
    /** @type {uint32[]} */
    const con = new Array(count * 2);
    let t = OpCodes.And32(iv, 0xFFFF);
    for (let i = 0; i < count; i++) {
      const notT = OpCodes.And32(OpCodes.Xor32(t, 0xFFFF), 0xFFFF);
      const hi0 = OpCodes.And32(OpCodes.Xor32(t, CON_P16), 0xFFFF);
      const lo0 = OpCodes.RotL16(notT, 1);
      const hi1 = OpCodes.And32(OpCodes.Xor32(notT, CON_Q16), 0xFFFF);
      const lo1 = OpCodes.RotL16(t, 8);
      con[i * 2] = OpCodes.Or32(OpCodes.Shl32(hi0, 16), lo0);
      con[i * 2 + 1] = OpCodes.Or32(OpCodes.Shl32(hi1, 16), lo1);
      t = gf16DivZ(t);
    }
    return con;
  }

  // CON_128/192/256 - RFC 6114 Appendix C (Tables 7-9), generated rather than
  // hardcoded so the constants are provably derived from the spec algorithm.
  const CON_128 = generateCON(0x428a, 30);
  Object.freeze(CON_128);
  const CON_192 = generateCON(0x7137, 42);
  Object.freeze(CON_192);
  const CON_256 = generateCON(0xb5c0, 46);
  Object.freeze(CON_256);

  // CLEFIA-specific GF(2^8) multiplication
  // Uses irreducible polynomial z^8 + z^4 + z^3 + z^2 + 1 (0x1d)
  // This is different from AES which uses 0x1b
  /**
   * @param {uint32} a - First factor (low byte used)
   * @param {uint32} b - Second factor (low byte used)
   * @returns {uint32} Product byte
   */
  function gfMul(a, b) {
    /** @type {uint32} */
    let result = 0;
    a = OpCodes.And32(a, 0xFF);
    b = OpCodes.And32(b, 0xFF);

    for (let i = 0; i < 8; i++) {
      if (OpCodes.And32(b, 1) !== 0) {
        result = OpCodes.Xor32(result, a);
      }

      const highBit = OpCodes.And32(a, 0x80);
      a = OpCodes.And32(OpCodes.Shl8(a, 1), 0xFF);
      if (highBit !== 0) {
        a = OpCodes.Xor32(a, 0x1D); // CLEFIA polynomial: z^8 + z^4 + z^3 + z^2 + 1
      }

      b = OpCodes.Shr8(b, 1);
    }

    return OpCodes.And32(result, 0xFF);
  }

  /**
 * CLEFIAAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class CLEFIAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "CLEFIA";
      this.description = "Sony's CLEFIA block cipher (RFC 6114) with 128-bit blocks and variable key lengths. Generalized Feistel Network design optimized for lightweight implementations.";
      this.inventor = "Sony Corporation";
      this.year = 2007;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.JP;

      this.SupportedKeySizes = [new KeySize(16, 32, 8)];
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];

      this.documentation = [
        new LinkItem("RFC 6114: The 128-Bit Blockcipher CLEFIA", "https://www.rfc-editor.org/rfc/rfc6114.html"),
        new LinkItem("ISO/IEC 29192-2:2012", "https://www.iso.org/standard/56552.html")
      ];

      this.references = [
        new LinkItem("Sony CLEFIA Reference Code (clefia_ref.c)", "https://www.sony.net/Products/cryptography/clefia/download/data/clefia_ref.c"),
        new LinkItem("go-clefia (port of Sony reference C code)", "https://github.com/dgryski/go-clefia")
      ];

      this.tests = [
        {
          text: "DarkCrypt CLEFIA vector 1/zero",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("c75294761d52fb97ab7955d877164213")
        },
        {
          text: "DarkCrypt CLEFIA vector 2/incr",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("3a92f62a3f938146d9ca6303f5b3d790")
        },
        {
          text: "DarkCrypt CLEFIA vector 3/incr2",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("eee2469ffc539734e5f93330cc6d8523")
        },

        {
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100"),
          expected: OpCodes.Hex8ToBytes("de2bf2fd9b74aacdf1298555459494fd"),
          text: "RFC 6114 Appendix A - CLEFIA-128 test vector",
          uri: "https://www.rfc-editor.org/rfc/rfc6114.html#appendix-A"
        },
        {
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100f0e0d0c0b0a09080"),
          expected: OpCodes.Hex8ToBytes("e2482f649f028dc480dda184fde181ad"),
          text: "RFC 6114 Appendix A - CLEFIA-192 test vector",
          uri: "https://www.rfc-editor.org/rfc/rfc6114.html#appendix-A"
        },
        {
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100f0e0d0c0b0a090807060504030201000"),
          expected: OpCodes.Hex8ToBytes("a1397814289de80c10da46d1fa48b38a"),
          text: "RFC 6114 Appendix A - CLEFIA-256 test vector",
          uri: "https://www.rfc-editor.org/rfc/rfc6114.html#appendix-A"
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {CLEFIAInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CLEFIAInstance(this, isInverse);
    }
  }

  /**
 * CLEFIA cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CLEFIAInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {CLEFIAAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[][]|null} */
      this.rk = null;
      /** @type {uint8[][]|null} */
      this.wk = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.rk = null;
        this.wk = null;
        return;
      }

      if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes");
      }

      this._key = [...keyBytes];
      this._setupKey();
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
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % 16 !== 0) {
        throw new Error("Input length must be multiple of 16 bytes");
      }

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += 16) {
        const block = this.inputBuffer.slice(i, i + 16);
        const result = this.isInverse ? this._decrypt(block) : this._encrypt(block);
        for (let _i = 0; _i < result.length; _i++) output.push(result[_i]);
      }

      this.inputBuffer = [];
      return output;
    }

    /**
     * Derive whitening and round keys from this._key
     */
    _setupKey() {
      const keyLen = this._key.length;
      if (keyLen === 16) {
        this._setupKey128();
      } else {
        this._setupKey192Or256(keyLen);
      }
    }

    // 128-bit key schedule - RFC 6114 Section 6.3
    // L <- GFN_{4,12}(CON_128[0..23], K); WK0..3 <- K; 9 iterations produce 36 round keys (18 rounds)
    /**
     * 128-bit key schedule
     */
    _setupKey128() {
      const conWords = this._genCon(16);
      const gfnRounds = 12;
      const L = this._gfn([...this._key], conWords, gfnRounds, 4);

      // Whitening keys from original key - RFC 6114 Section 6.3
      /** @type {uint8[][]} */
      const whitening = [];
      for (let i = 0; i < 4; i++) {
        whitening[i] = this._key.slice(i * 4, i * 4 + 4);
      }
      this.wk = whitening;

      // Round keys derived from L - RFC 6114 Section 6.3
      // 9 iterations generating 4 RK each = 36 round keys for 18 rounds
      /** @type {uint8[][]} */
      const roundKeys = [];
      this.rk = roundKeys;
      const r = 9;
      const conStartIdx = gfnRounds * 2;  // Start after GFN_{4,12} constants (in CON word array)

      for (let i = 0; i < r; i++) {
        // Step 1: T <- L XOR CON (4 CON words = 16 bytes)
        /** @type {uint8[]} */
        const temp = new Array(16);
        for (let j = 0; j < 4; j++) {
          const conWord = conWords[conStartIdx + i * 4 + j];
          const conBytes = OpCodes.Unpack32BE(conWord);
          for (let k = 0; k < 4; k++) {
            temp[j * 4 + k] = OpCodes.Xor32(L[j * 4 + k], conBytes[k]);
          }
        }

        // Step 2: XOR temp with key on ODD iterations (1, 3, 5, 7)
        // RFC 6114 Section 6.3: "if i is odd: T <- T XOR K"
        if ((i % 2) === 1) {
          for (let j = 0; j < 16; j++) {
            temp[j] = OpCodes.Xor32(temp[j], this._key[j]);
          }
        }

        // Step 3: Extract 4 round keys (4 bytes each) from the 16-byte temp
        // Each iteration i generates RK[4i], RK[4i+1], RK[4i+2], RK[4i+3]
        this.rk[i * 4] = temp.slice(0, 4);
        this.rk[i * 4 + 1] = temp.slice(4, 8);
        this.rk[i * 4 + 2] = temp.slice(8, 12);
        this.rk[i * 4 + 3] = temp.slice(12, 16);

        // Step 4: L <- Sigma(L) - Apply AFTER extracting keys
        // Sony reference: ClefiaDoubleSwap(lk) is called after rk assignment
        this._sigma(L);
      }
    }

    // 192/256-bit key schedule - RFC 6114 Section 6.4/6.5
    // KL|KR <- padded key (192-bit pads KR with the bitwise complement of K0|K1);
    // LL|LR <- GFN_{8,10}(CON_k[0..39], KL|KR); WK0..3 <- KL XOR KR.
    // 11 (192-bit) or 13 (256-bit) iterations alternate LL/LR, producing 44/52
    // round keys for 22/26 rounds.
    /**
     * 192/256-bit key schedule
     * @param {int32} keyLen - Key length in bytes (24 or 32)
     */
    _setupKey192Or256(keyLen) {
      const conWords = this._genCon(keyLen);

      const kl = this._key.slice(0, 16);
      /** @type {uint8[]} */
      let kr;
      if (keyLen === 24) {
        // KR <- K4 | K5 | ~K0 | ~K1 (bitwise complement of the first two key words)
        kr = this._key.slice(16, 24);
        for (let i = 0; i < 8; i++) kr.push(OpCodes.And32(OpCodes.Xor32(this._key[i], 0xFF), 0xFF));
      } else {
        kr = this._key.slice(16, 32);
      }

      const gfnRounds = 10;
      const gfnOut = this._gfn(kl.concat(kr), conWords, gfnRounds, 8);
      const LL = gfnOut.slice(0, 16);
      const LR = gfnOut.slice(16, 32);

      // Whitening keys - RFC 6114 Section 6.4/6.5: WK0|WK1|WK2|WK3 <- KL XOR KR
      /** @type {uint8[][]} */
      const whitening = [];
      for (let i = 0; i < 4; i++) {
        /** @type {uint8[]} */
        const wkRow = [];
        for (let j = 0; j < 4; j++) {
          wkRow[j] = OpCodes.Xor32(kl[i * 4 + j], kr[i * 4 + j]);
        }
        whitening[i] = wkRow;
      }
      this.wk = whitening;

      // Round keys derived from LL/LR, alternating every two iterations
      /** @type {uint8[][]} */
      const roundKeys = [];
      this.rk = roundKeys;
      const r = keyLen === 24 ? 11 : 13;
      const conStartIdx = gfnRounds * 4;  // Start after GFN_{8,10} constants (in CON word array)

      for (let i = 0; i < r; i++) {
        const useLL = (i % 4) === 0 || (i % 4) === 1;
        const L = useLL ? LL : LR;
        const otherKey = useLL ? kr : kl;

        // Step 1: T <- L XOR CON (4 CON words = 16 bytes)
        /** @type {uint8[]} */
        const temp = new Array(16);
        for (let j = 0; j < 4; j++) {
          const conWord = conWords[conStartIdx + i * 4 + j];
          const conBytes = OpCodes.Unpack32BE(conWord);
          for (let k = 0; k < 4; k++) {
            temp[j * 4 + k] = OpCodes.Xor32(L[j * 4 + k], conBytes[k]);
          }
        }

        // Step 2: XOR temp with the complementary key half on ODD iterations
        if ((i % 2) === 1) {
          for (let j = 0; j < 16; j++) {
            temp[j] = OpCodes.Xor32(temp[j], otherKey[j]);
          }
        }

        // Step 3: Extract 4 round keys (4 bytes each) from the 16-byte temp
        this.rk[i * 4] = temp.slice(0, 4);
        this.rk[i * 4 + 1] = temp.slice(4, 8);
        this.rk[i * 4 + 2] = temp.slice(8, 12);
        this.rk[i * 4 + 3] = temp.slice(12, 16);

        // Step 4: L <- Sigma(L) - mutates LL or LR in place for the next round
        this._sigma(L);
      }
    }

    /**
     * Sigma (DoubleSwap) function from Sony reference implementation
     * RFC 6114 Section 4.2: Complex bit permutation on two 64-bit halves
     * Reference: clefia_ref.c ClefiaDoubleSwap
     * @param {uint8[]} x - 16 bytes (permuted in place)
     */
    _sigma(x) {
      /** @type {uint8[]} */
      const t = new Array(16);

      // First half (bytes 0-7): 7-bit left rotation with crossover
      t[0] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl8(x[0], 7), OpCodes.Shr8(x[1], 1)), 0xFF);
      t[1] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl8(x[1], 7), OpCodes.Shr8(x[2], 1)), 0xFF);
      t[2] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl8(x[2], 7), OpCodes.Shr8(x[3], 1)), 0xFF);
      t[3] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl8(x[3], 7), OpCodes.Shr8(x[4], 1)), 0xFF);
      t[4] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl8(x[4], 7), OpCodes.Shr8(x[5], 1)), 0xFF);
      t[5] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl8(x[5], 7), OpCodes.Shr8(x[6], 1)), 0xFF);
      t[6] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl8(x[6], 7), OpCodes.Shr8(x[7], 1)), 0xFF);
      t[7] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl8(x[7], 7), OpCodes.And32(x[15], 0x7F)), 0xFF);

      // Second half (bytes 8-15): 7-bit right rotation with crossover
      t[8] = OpCodes.And32(OpCodes.Or32(OpCodes.Shr8(x[8], 7), OpCodes.And32(x[0], 0xFE)), 0xFF);
      t[9] = OpCodes.And32(OpCodes.Or32(OpCodes.Shr8(x[9], 7), OpCodes.Shl8(x[8], 1)), 0xFF);
      t[10] = OpCodes.And32(OpCodes.Or32(OpCodes.Shr8(x[10], 7), OpCodes.Shl8(x[9], 1)), 0xFF);
      t[11] = OpCodes.And32(OpCodes.Or32(OpCodes.Shr8(x[11], 7), OpCodes.Shl8(x[10], 1)), 0xFF);
      t[12] = OpCodes.And32(OpCodes.Or32(OpCodes.Shr8(x[12], 7), OpCodes.Shl8(x[11], 1)), 0xFF);
      t[13] = OpCodes.And32(OpCodes.Or32(OpCodes.Shr8(x[13], 7), OpCodes.Shl8(x[12], 1)), 0xFF);
      t[14] = OpCodes.And32(OpCodes.Or32(OpCodes.Shr8(x[14], 7), OpCodes.Shl8(x[13], 1)), 0xFF);
      t[15] = OpCodes.And32(OpCodes.Or32(OpCodes.Shr8(x[15], 7), OpCodes.Shl8(x[14], 1)), 0xFF);

      // Copy back to input array
      for (let i = 0; i < 16; i++) {
        x[i] = t[i];
      }
    }

    /**
     * Return the generated CON constants for the given key length (in bytes)
     * Returns array of 32-bit words (not bytes) - RFC 6114 Appendix C
     * @param {int32} keyLen - Key length in bytes
     * @returns {uint32[]} CON words
     */
    _genCon(keyLen) {
      if (keyLen === 16) return CON_128;
      if (keyLen === 24) return CON_192;
      return CON_256;
    }

    // GFN_{d,r} - Generalized Feistel Network with d branches (d=4 or d=8)
    // RFC 6114 Section 4.1: GFN_{4,r} is used to derive L for 128-bit keys;
    // GFN_{8,10} is used to derive LL|LR for 192/256-bit keys.
    // x: byte array (d*4 bytes)
    // conWords: array of 32-bit words to use as round keys (d/2 per round)
    // r: number of rounds
    // Output: byte array (d*4 bytes)
    /**
     * @param {uint8[]} x - d*4 input bytes
     * @param {uint32[]} conWords - CON words
     * @param {int32} r - Rounds
     * @param {int32} d - Branches (4 or 8)
     * @returns {uint8[]} d*4 output bytes
     */
    _gfn(x, conWords, r, d) {
      // Convert input bytes to 32-bit words (big-endian per RFC 6114)
      /** @type {uint32[]} */
      const t = new Array(d);
      for (let branch = 0; branch < d; branch++) {
        t[branch] = OpCodes.Pack32BE(x[branch * 4], x[branch * 4 + 1], x[branch * 4 + 2], x[branch * 4 + 3]);
      }

      const half = d / 2;  // CON words (and F-function applications) consumed per round
      for (let i = 0; i < r; i++) {
        for (let branch = 0; branch < half; branch++) {
          // Each pair of branches (T_{2b}, T_{2b+1}) is updated with F0 (even b) or F1 (odd b)
          const rk = OpCodes.Unpack32BE(conWords[i * half + branch]);
          const srcIdx = branch * 2;
          const dstIdx = branch * 2 + 1;
          const fOut = (branch % 2) === 0 ? this._f0(t[srcIdx], rk) : this._f1(t[srcIdx], rk);
          t[dstIdx] = OpCodes.Xor32(t[dstIdx], fOut);
        }

        // Rotate: T0|T1|...|T_{d-1} <- T1|...|T_{d-1}|T0
        // Skip rotation on last round (equivalent to the RFC's post-loop un-rotate)
        if (i < r - 1) {
          const tmp = t[0];
          for (let branch = 0; branch < d - 1; branch++) {
            t[branch] = t[branch + 1];
          }
          t[d - 1] = tmp;
        }
      }

      // Convert 32-bit words back to bytes (big-endian per RFC 6114)
      /** @type {uint8[]} */
      const result = [];
      for (let branch = 0; branch < d; branch++) {
        result.push(...OpCodes.Unpack32BE(t[branch]));
      }
      return result;
    }

    // F0 function - accepts 32-bit word and RK bytes, returns 32-bit word
    // RFC 6114 Section 2.1: F0(RK, X) uses S0,S1,S0,S1 S-boxes
    /**
     * @param {uint32} x32 - Input word
     * @param {uint8[]} rk - 4 round-key bytes
     * @returns {uint32} Output word
     */
    _f0(x32, rk) {
      // Unpack 32-bit word into bytes (big-endian per RFC 6114)
      const xBytes = OpCodes.Unpack32BE(x32);

      // S-box substitution: S0,S1,S0,S1
      /** @type {uint8[]} */
      const y = [
        S0[OpCodes.Xor32(xBytes[0], rk[0])],
        S1[OpCodes.Xor32(xBytes[1], rk[1])],
        S0[OpCodes.Xor32(xBytes[2], rk[2])],
        S1[OpCodes.Xor32(xBytes[3], rk[3])]
      ];

      // Diffusion matrix multiplication (GF(2^8))
      /** @type {uint8[]} */
      const z = [
        OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(y[0], gfMul(y[1], 2)), gfMul(y[2], 4)), gfMul(y[3], 6)),
        OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(gfMul(y[0], 2), y[1]), gfMul(y[2], 6)), gfMul(y[3], 4)),
        OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(gfMul(y[0], 4), gfMul(y[1], 6)), y[2]), gfMul(y[3], 2)),
        OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(gfMul(y[0], 6), gfMul(y[1], 4)), gfMul(y[2], 2)), y[3])
      ];

      // Pack result back into 32-bit word (big-endian per RFC 6114)
      return OpCodes.Pack32BE(z[0], z[1], z[2], z[3]);
    }

    // F1 function - accepts 32-bit word and RK bytes, returns 32-bit word
    // RFC 6114 Section 2.1: F1(RK, X) uses S1,S0,S1,S0 S-boxes
    /**
     * @param {uint32} x32 - Input word
     * @param {uint8[]} rk - 4 round-key bytes
     * @returns {uint32} Output word
     */
    _f1(x32, rk) {
      // Unpack 32-bit word into bytes (big-endian per RFC 6114)
      const xBytes = OpCodes.Unpack32BE(x32);

      // S-box substitution: S1,S0,S1,S0
      /** @type {uint8[]} */
      const y = [
        S1[OpCodes.Xor32(xBytes[0], rk[0])],
        S0[OpCodes.Xor32(xBytes[1], rk[1])],
        S1[OpCodes.Xor32(xBytes[2], rk[2])],
        S0[OpCodes.Xor32(xBytes[3], rk[3])]
      ];

      // Diffusion matrix multiplication (GF(2^8))
      /** @type {uint8[]} */
      const z = [
        OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(y[0], gfMul(y[1], 8)), gfMul(y[2], 2)), gfMul(y[3], 10)),
        OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(gfMul(y[0], 8), y[1]), gfMul(y[2], 10)), gfMul(y[3], 2)),
        OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(gfMul(y[0], 2), gfMul(y[1], 10)), y[2]), gfMul(y[3], 8)),
        OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(gfMul(y[0], 10), gfMul(y[1], 2)), gfMul(y[2], 8)), y[3])
      ];

      // Pack result back into 32-bit word (big-endian per RFC 6114)
      return OpCodes.Pack32BE(z[0], z[1], z[2], z[3]);
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encrypt(block) {
      // Convert input block to four 32-bit words (big-endian per RFC 6114)
      let p0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let p1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      let p2 = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      let p3 = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);

      // Convert whitening keys to 32-bit words (big-endian per RFC 6114)
      const wk0 = OpCodes.Pack32BE(this.wk[0][0], this.wk[0][1], this.wk[0][2], this.wk[0][3]);
      const wk1 = OpCodes.Pack32BE(this.wk[1][0], this.wk[1][1], this.wk[1][2], this.wk[1][3]);
      const wk2 = OpCodes.Pack32BE(this.wk[2][0], this.wk[2][1], this.wk[2][2], this.wk[2][3]);
      const wk3 = OpCodes.Pack32BE(this.wk[3][0], this.wk[3][1], this.wk[3][2], this.wk[3][3]);

      // Pre-whitening: P1 ^= WK0, P3 ^= WK1
      p1 = OpCodes.Xor32(p1, wk0);
      p3 = OpCodes.Xor32(p3, wk1);

      // Rounds (each round uses 2 round keys)
      const r = this.rk.length / 2;
      for (let round = 0; round < r; round++) {
        // P1 ^= F0(RK_{2i}, P0)
        p1 = OpCodes.Xor32(p1, this._f0(p0, this.rk[round * 2]));

        // P3 ^= F1(RK_{2i+1}, P2)
        p3 = OpCodes.Xor32(p3, this._f1(p2, this.rk[round * 2 + 1]));

        // Rotate: P0|P1|P2|P3 <- P1|P2|P3|P0
        // Skip rotation on last round (Sony reference clefia_ref.c line 197)
        if (round < r - 1) {
          const tmp = p0;
          p0 = p1;
          p1 = p2;
          p2 = p3;
          p3 = tmp;
        }
      }

      // Post-whitening: P1 ^= WK2, P3 ^= WK3
      p1 = OpCodes.Xor32(p1, wk2);
      p3 = OpCodes.Xor32(p3, wk3);

      // Convert output words back to bytes (big-endian per RFC 6114)
      /** @type {uint8[]} */
      const result = [];
      result.push(...OpCodes.Unpack32BE(p0));
      result.push(...OpCodes.Unpack32BE(p1));
      result.push(...OpCodes.Unpack32BE(p2));
      result.push(...OpCodes.Unpack32BE(p3));
      return result;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decrypt(block) {
      // Convert input block to four 32-bit words (big-endian per RFC 6114)
      let c0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let c1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      let c2 = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      let c3 = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);

      // Convert whitening keys to 32-bit words (big-endian per RFC 6114)
      const wk0 = OpCodes.Pack32BE(this.wk[0][0], this.wk[0][1], this.wk[0][2], this.wk[0][3]);
      const wk1 = OpCodes.Pack32BE(this.wk[1][0], this.wk[1][1], this.wk[1][2], this.wk[1][3]);
      const wk2 = OpCodes.Pack32BE(this.wk[2][0], this.wk[2][1], this.wk[2][2], this.wk[2][3]);
      const wk3 = OpCodes.Pack32BE(this.wk[3][0], this.wk[3][1], this.wk[3][2], this.wk[3][3]);

      // Inverse pre-whitening: C1 ^= WK2, C3 ^= WK3
      c1 = OpCodes.Xor32(c1, wk2);
      c3 = OpCodes.Xor32(c3, wk3);

      // Inverse rounds (each round uses 2 round keys)
      const r = this.rk.length / 2;
      for (let round = r - 1; round >= 0; round--) {
        // Inverse rotate: C0|C1|C2|C3 <- C3|C0|C1|C2
        // Skip rotation on first decryption round (last encryption round)
        if (round < r - 1) {
          const tmp = c3;
          c3 = c2;
          c2 = c1;
          c1 = c0;
          c0 = tmp;
        }

        // C1 ^= F0(RK_{2i}, C0)
        c1 = OpCodes.Xor32(c1, this._f0(c0, this.rk[round * 2]));

        // C3 ^= F1(RK_{2i+1}, C2)
        c3 = OpCodes.Xor32(c3, this._f1(c2, this.rk[round * 2 + 1]));
      }

      // Inverse post-whitening: C1 ^= WK0, C3 ^= WK1
      c1 = OpCodes.Xor32(c1, wk0);
      c3 = OpCodes.Xor32(c3, wk1);

      // Convert output words back to bytes (big-endian per RFC 6114)
      /** @type {uint8[]} */
      const result = [];
      result.push(...OpCodes.Unpack32BE(c0));
      result.push(...OpCodes.Unpack32BE(c1));
      result.push(...OpCodes.Unpack32BE(c2));
      result.push(...OpCodes.Unpack32BE(c3));
      return result;
    }
  }

  RegisterAlgorithm(new CLEFIAAlgorithm());
  return CLEFIAAlgorithm;
}));
