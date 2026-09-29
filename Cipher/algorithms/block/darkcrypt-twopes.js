/*
 * TWOPES (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * TWOPES is the block cipher shipped with the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). It is a "double IDEA": two consecutive
 * 8-round IDEA passes (each 8 rounds plus an output transform) over a 64-bit
 * block, using multiplication modulo 65537. The 256-bit key is split into two
 * 128-bit halves; each half drives its own IDEA key schedule (little-endian
 * 16-bit words, a bit-rotating expansion, and every derived subkey XORed with
 * the constant 0x0DAE). The first pass is keyed by key bytes 0..15, the second
 * by key bytes 16..31.
 *
 * 64-bit blocks, 256-bit keys. As implemented in the DarkCrypt Total Commander
 * plugin; test vectors verified against the DarkCrypt implementation.
 * Educational only.
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
}((function () {
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
          BlockCipherAlgorithm, IBlockCipherInstance,
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const MOD    = 0x10001;   // 65537
  const KMASK  = 0x0DAE;    // subkey whitening constant applied during expansion
  const ROUNDS = 8;         // IDEA rounds per pass
  const PASSES = 2;         // two IDEA passes (double IDEA)

  // IDEA multiplication modulo 65537, where 0 represents 65536.
  /**
   * @param {uint32} a - First factor (low 16 bits used)
   * @param {uint32} b - Second factor (low 16 bits used)
   * @returns {uint32} Product mod 65537, 16 bits
   */
  function ideaMul(a, b) {
    a = OpCodes.And32(a, 0xFFFF);
    b = OpCodes.And32(b, 0xFFFF);
    if (a === 0) return OpCodes.And32(OpCodes.Sub32(MOD, b), 0xFFFF);
    if (b === 0) return OpCodes.And32(OpCodes.Sub32(MOD, a), 0xFFFF);
    // a, b < 2^16, so the product is exact below 2^32
    const p = OpCodes.Mul32(a, b);
    const lo = OpCodes.And32(p, 0xFFFF);
    const hi = OpCodes.And32(OpCodes.Shr32(p, 16), 0xFFFF);
    // lo - hi, lifted by MOD when not positive
    const r = lo > hi ? OpCodes.Sub32(lo, hi) : OpCodes.Sub32(OpCodes.Add32(lo, MOD), hi);
    return OpCodes.And32(r, 0xFFFF);
  }

  // Multiplicative inverse modulo 65537 (extended Euclid), result masked to 16 bits.
  /**
   * @param {uint32} w - Value (low 16 bits used)
   * @returns {uint32} Inverse mod 65537, 16 bits
   */
  function ideaMulInv(w) {
    w = OpCodes.And32(w, 0xFFFF);
    if (w === 0) return 0;
    /** @type {int32} */
    let b = w;
    /** @type {int32} */
    let m = 0;
    /** @type {int32} */
    let c = 1;
    /** @type {int32} */
    let a = MOD;
    /** @type {int32} */
    let rem = 0;
    do {
      rem = a % b;
      const q = (a - rem) / b;
      if (rem !== 0) {
        const old = c;
        c = m - q * c;
        m = old;
        a = b;
        b = rem;
      } else if (c < 0) {
        c += MOD;
      }
    } while (rem !== 0);
    return OpCodes.And32(c, 0xFFFF);
  }

  // Additive inverse modulo 65536.
  /**
   * @param {uint32} w - Value (low 16 bits used)
   * @returns {uint32} Additive inverse mod 65536
   */
  function neg16(w) { return OpCodes.And32(OpCodes.Sub32(0x10000, OpCodes.And32(w, 0xFFFF)), 0xFFFF); }

  // Expand one 128-bit key half (8 little-endian words) into 54 subkeys.
  // A 55-word bit-rotating recurrence, each output XORed with 0x0DAE. Subkey
  // layout: round r (0..7) uses index 6*r+0..6*r+5, the output transform uses
  // indices 48..51.
  /**
   * @param {uint32[]} keyWords - 8 little-endian 16-bit key words
   * @returns {uint32[]} 54 subkeys
   */
  function expandHalf(keyWords) {
    /** @type {uint32[]} */
    const w = new Array(55);
    for (let i = 0; i < 8; ++i) w[i] = OpCodes.And32(keyWords[i], 0xFFFF);
    for (let e = 8; e < 55; ++e) {
      const phase = OpCodes.And32(e, 7);
      /** @type {uint32} */
      let v = 0;
      if (phase === 6) {
        v = OpCodes.Xor32(OpCodes.Shl32(w[e - 7], 9), OpCodes.Shr32(OpCodes.And32(w[e - 14], 0xFFFF), 7));
      } else if (phase === 7) {
        v = OpCodes.Xor32(OpCodes.Shl32(w[e - 15], 9), OpCodes.Shr32(OpCodes.And32(w[e - 14], 0xFFFF), 7));
      } else {
        v = OpCodes.Sub32(OpCodes.Shl32(w[e - 7], 9), OpCodes.Shr32(OpCodes.And32(w[e - 6], 0xFFFF), 7));
      }
      w[e] = OpCodes.And32(v, 0xFFFF);
    }
    /** @type {uint32[]} */
    const sub = new Array(54);
    for (let i = 0; i < 54; ++i) sub[i] = OpCodes.And32(OpCodes.Xor32(w[i], KMASK), 0xFFFF);
    return sub;
  }

  // One IDEA encryption pass (8 rounds + output transform) over state [A,B,C,D].
  /**
   * @param {uint32[]} sub - 54 subkeys of this pass
   * @param {uint32[]} state - Four 16-bit words [A, B, C, D]
   * @returns {uint32[]} Encrypted state words
   */
  function encPass(sub, state) {
    let A = state[0], B = state[1], C = state[2], D = state[3];
    for (let r = 0; r < ROUNDS; ++r) {
      const o = r * 6;
      const K0 = sub[o], K1 = sub[o + 1], K2 = sub[o + 2],
            K3 = sub[o + 3], K4 = sub[o + 4], K5 = sub[o + 5];
      const Ap = ideaMul(A, K0);
      const Bp = OpCodes.And32(OpCodes.Add32(B, K1), 0xFFFF);
      const Cp = OpCodes.And32(OpCodes.Add32(C, K2), 0xFFFF);
      const Dp = ideaMul(D, K3);
      const T1 = ideaMul(K4, OpCodes.And32(OpCodes.Xor32(Cp, Ap), 0xFFFF));
      const T2 = ideaMul(K5, OpCodes.And32(OpCodes.Add32(OpCodes.And32(OpCodes.Xor32(Dp, Bp), 0xFFFF), T1), 0xFFFF));
      const sT = OpCodes.And32(OpCodes.Add32(T1, T2), 0xFFFF);
      A = OpCodes.And32(OpCodes.Xor32(Cp, T2), 0xFFFF);
      B = OpCodes.And32(OpCodes.Xor32(Dp, sT), 0xFFFF);
      C = OpCodes.And32(OpCodes.Xor32(T2, Ap), 0xFFFF);
      D = OpCodes.And32(OpCodes.Xor32(Bp, sT), 0xFFFF);
    }
    A = ideaMul(A, sub[48]);
    B = OpCodes.And32(OpCodes.Add32(B, sub[49]), 0xFFFF);
    C = OpCodes.And32(OpCodes.Add32(C, sub[50]), 0xFFFF);
    D = ideaMul(D, sub[51]);
    /** @type {uint32[]} */
    const out = [A, B, C, D];
    return out;
  }

  // Inverse of encPass: undo the output transform, then invert the 8 rounds.
  /**
   * @param {uint32[]} sub - 54 subkeys of this pass
   * @param {uint32[]} state - Four 16-bit words [A, B, C, D]
   * @returns {uint32[]} Decrypted state words
   */
  function decPass(sub, state) {
    let A = state[0], B = state[1], C = state[2], D = state[3];
    A = ideaMul(A, ideaMulInv(sub[48]));
    B = OpCodes.And32(OpCodes.Add32(B, neg16(sub[49])), 0xFFFF);
    C = OpCodes.And32(OpCodes.Add32(C, neg16(sub[50])), 0xFFFF);
    D = ideaMul(D, ideaMulInv(sub[51]));
    for (let r = ROUNDS - 1; r >= 0; --r) {
      const o = r * 6;
      const K0 = sub[o], K1 = sub[o + 1], K2 = sub[o + 2],
            K3 = sub[o + 3], K4 = sub[o + 4], K5 = sub[o + 5];
      const T1 = ideaMul(K4, OpCodes.And32(OpCodes.Xor32(A, C), 0xFFFF));
      const T2 = ideaMul(K5, OpCodes.And32(OpCodes.Add32(OpCodes.And32(OpCodes.Xor32(B, D), 0xFFFF), T1), 0xFFFF));
      const sT = OpCodes.And32(OpCodes.Add32(T1, T2), 0xFFFF);
      const Ap = OpCodes.And32(OpCodes.Xor32(C, T2), 0xFFFF);
      const Cp = OpCodes.And32(OpCodes.Xor32(A, T2), 0xFFFF);
      const Dp = OpCodes.And32(OpCodes.Xor32(B, sT), 0xFFFF);
      const Bp = OpCodes.And32(OpCodes.Xor32(D, sT), 0xFFFF);
      A = ideaMul(Ap, ideaMulInv(K0));
      B = OpCodes.And32(OpCodes.Add32(Bp, neg16(K1)), 0xFFFF);
      C = OpCodes.And32(OpCodes.Add32(Cp, neg16(K2)), 0xFFFF);
      D = ideaMul(Dp, ideaMulInv(K3));
    }
    /** @type {uint32[]} */
    const out = [A, B, C, D];
    return out;
  }

  class DarkCryptTWOPESAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "TWOPES (DarkCrypt)";
      this.description = "Double-IDEA block cipher from the DarkCrypt Total Commander plugin: two consecutive 8-round IDEA passes over a 64-bit block using multiplication mod 65537. The 256-bit key is split into two 128-bit halves, each driving its own IDEA key schedule.";
      this.inventor = "IDEA by Xuejia Lai and James Massey; DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("IDEA (base algorithm)", "https://en.wikipedia.org/wiki/International_Data_Encryption_Algorithm")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "Undocumented double-IDEA construction with a custom key schedule and subkey whitening constant; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Twopes — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("e4118731984818f7")
        },
        {
          text: "DarkCrypt Twopes — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("94098860114ea1fd")
        },
        {
          text: "DarkCrypt Twopes — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("8ae166fe3a8d91b2")
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptTWOPESInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptTWOPESInstance(this, isInverse);
    }
  }

  class DarkCryptTWOPESInstance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptTWOPESAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint32[][]|null} */
      this._passKeys = null;  // [ pass0 subkeys, pass1 subkeys ]
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._passKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. TWOPES (DarkCrypt) requires exactly 32 bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      /** @type {uint32[]} */
      const half0 = [];
      /** @type {uint32[]} */
      const half1 = [];
      for (let i = 0; i < 8; ++i) {
        half0.push(OpCodes.Pack16LE(keyBytes[i * 2],      keyBytes[i * 2 + 1]));
        half1.push(OpCodes.Pack16LE(keyBytes[16 + i * 2], keyBytes[16 + i * 2 + 1]));
      }
      /** @type {uint32[][]} */
      const passKeys = [expandHalf(half0), expandHalf(half1)];
      this._passKeys = passKeys;
    }

    /**
     * @returns {uint8[]|null} Copy of the key, or null
     */
    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint32[]} Four little-endian 16-bit words
     */
    _blockToState(block) {
      /** @type {uint32[]} */
      const state = [
        OpCodes.Pack16LE(block[0], block[1]),
        OpCodes.Pack16LE(block[2], block[3]),
        OpCodes.Pack16LE(block[4], block[5]),
        OpCodes.Pack16LE(block[6], block[7])
      ];
      return state;
    }

    /**
     * @param {uint32[]} state - Four 16-bit words
     * @returns {uint8[]} 8 little-endian bytes
     */
    _stateToBlock(state) {
      /** @type {uint8[]} */
      const out = [
        ...OpCodes.Unpack16LE(state[0]),
        ...OpCodes.Unpack16LE(state[1]),
        ...OpCodes.Unpack16LE(state[2]),
        ...OpCodes.Unpack16LE(state[3])
      ];
      return out;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      let state = this._blockToState(block);
      for (let p = 0; p < PASSES; ++p) state = encPass(this._passKeys[p], state);
      return this._stateToBlock(state);
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      let state = this._blockToState(block);
      for (let p = PASSES - 1; p >= 0; --p) state = decPass(this._passKeys[p], state);
      return this._stateToBlock(state);
    }
  }

  const algorithmInstance = new DarkCryptTWOPESAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptTWOPESAlgorithm, DarkCryptTWOPESInstance };
}));
