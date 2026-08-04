/*
 * WG (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * WG is a word-oriented stream cipher based on Welch-Gong (WG) transformations
 * over GF(2^29), by Yassir Nawaz and Guang Gong ("The WG Stream Cipher", an
 * eSTREAM Phase 2 candidate). The keystream generator is an 11-stage LFSR over
 * F(2^29) with feedback polynomial x^11+x^10+x^9+x^6+x^3+x+gamma, filtered by a
 * nonlinear WG transformation (a normal-basis boolean function of degree 11)
 * to output one bit per clock. Field elements are represented in a fixed
 * normal basis and stored in the top 29 bits of a 32-bit word.
 *
 * The DarkCrypt Total Commander plugin implements this with two concrete
 * deviations from the published reference algorithm:
 *   - the key/IV loading uses a compact byte-interleave pattern into the 11
 *     state words (not the published bit-block layout), always for a fixed
 *     128-bit key and 128-bit IV;
 *   - the key/IV initialization runs 44 clocks of a nonlinear-feedback LFSR
 *     update (not the published 22), and the per-clock "key init vector" that
 *     is folded into the feedback is S(11) XOR q1 XOR q2 XOR q3 XOR q4 (this
 *     implementation's accumulator is seeded with the un-negated tap value
 *     before folding in q1..q4, instead of starting from zero as the
 *     published spec's keyinitvec = NOT(q1^q2^q3^q4) does).
 * After initialization, ordinary keystream generation clocks the LFSR with
 * plain (linear) feedback and applies the WG transformation to the new S(11)
 * exactly as published (Section 4.3 of the reference paper); output bits are
 * packed MSB-first into each keystream byte.
 * 128-bit key, 128-bit IV. Educational only.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // ---- GF(2^29) normal-basis arithmetic, transliterated from the WG paper's reference
  // ---- C implementation (Appendix D/E). Elements occupy the top 29 bits of a
  // ---- 32-bit word (mask 0xFFFFFFF8); the low 3 bits are always 0.
  const FIELD_MASK = 0xFFFFFFF8;
  const GAMMA = 0x7F3FC9B0; // gamma constant used by the LFSR's tap-11 multiplier

  function rotl29(v, n) {
    v = OpCodes.ToUint32(v);
    return OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(v, n), OpCodes.Shr32(v, (29 - n))), FIELD_MASK);
  }
  function rotr29(v, n) { return rotl29(v, 29 - n); }
  function complement29(v) { return OpCodes.Xor32(v, FIELD_MASK); }

  function gfMult(a, b) {
    const A = new Array(29), B = new Array(29);
    A[0] = OpCodes.And32(a, FIELD_MASK); B[0] = OpCodes.And32(b, FIELD_MASK);
    for (let i = 1; i < 29; ++i) { A[i] = rotl29(A[0], i); B[i] = rotl29(B[0], i); }
    let c = 0;
    c ^= OpCodes.And32(A[0], B[1]);
    c ^= OpCodes.And32(A[1], OpCodes.Xor32(B[0], B[21]));
    c ^= OpCodes.And32(A[2], OpCodes.Xor32(B[6], B[21]));
    c ^= OpCodes.And32(A[3], OpCodes.Xor32(B[13], B[18]));
    c ^= OpCodes.And32(A[4], OpCodes.Xor32(B[11], B[27]));
    c ^= OpCodes.And32(A[5], OpCodes.Xor32(B[17], B[20]));
    c ^= OpCodes.And32(A[6], OpCodes.Xor32(B[2], B[22]));
    c ^= OpCodes.And32(A[7], OpCodes.Xor32(B[13], B[25]));
    c ^= OpCodes.And32(A[8], OpCodes.Xor32(B[9], B[10]));
    c ^= OpCodes.And32(A[9], OpCodes.Xor32(B[8], B[14]));
    c ^= OpCodes.And32(A[10], OpCodes.Xor32(B[8], B[26]));
    c ^= OpCodes.And32(A[11], OpCodes.Xor32(B[4], B[14]));
    c ^= OpCodes.And32(A[12], OpCodes.Xor32(B[17], B[24]));
    c ^= OpCodes.And32(A[13], OpCodes.Xor32(B[3], B[7]));
    c ^= OpCodes.And32(A[14], OpCodes.Xor32(B[9], B[11]));
    c ^= OpCodes.And32(A[15], OpCodes.Xor32(B[24], B[26]));
    c ^= OpCodes.And32(A[16], OpCodes.Xor32(B[19], B[23]));
    c ^= OpCodes.And32(A[17], OpCodes.Xor32(B[5], B[12]));
    c ^= OpCodes.And32(A[18], OpCodes.Xor32(B[3], B[22]));
    c ^= OpCodes.And32(A[19], OpCodes.Xor32(B[16], B[27]));
    c ^= OpCodes.And32(A[20], OpCodes.Xor32(B[5], B[28]));
    c ^= OpCodes.And32(A[21], OpCodes.Xor32(B[1], B[2]));
    c ^= OpCodes.And32(A[22], OpCodes.Xor32(B[6], B[18]));
    c ^= OpCodes.And32(A[23], OpCodes.Xor32(B[16], B[25]));
    c ^= OpCodes.And32(A[24], OpCodes.Xor32(B[12], B[15]));
    c ^= OpCodes.And32(A[25], OpCodes.Xor32(B[7], B[23]));
    c ^= OpCodes.And32(A[26], OpCodes.Xor32(B[10], B[15]));
    c ^= OpCodes.And32(A[27], OpCodes.Xor32(B[4], B[19]));
    c ^= OpCodes.And32(A[28], OpCodes.Xor32(B[20], B[28]));
    return OpCodes.ToUint32(c);
  }

  function gfInverse(a) {
    let b = OpCodes.ToUint32(a);
    b = rotl29(b, 16);
    b = gfMult(b, rotr29(b, 8));
    b = gfMult(b, a);
    b = rotl29(b, 8);
    b = gfMult(b, rotr29(b, 4));
    b = gfMult(b, a);
    b = rotl29(b, 4);
    b = gfMult(b, rotr29(b, 2));
    b = gfMult(b, rotr29(b, 1));
    return OpCodes.ToUint32(b);
  }

  function parity29(v) {
    let x = OpCodes.And32(v, FIELD_MASK), p = 0;
    while (x) { p ^= OpCodes.And32(x, 1); x = OpCodes.Shr32(x, 1); }
    return p;
  }

  // WG transformation F(2^29) -> F(2). Returns {bit, combined}; combined is the
  // DarkCrypt-specific pre-parity 29-bit value x ^ q1 ^ q2 ^ q3 ^ q4 (see file header).
  function wgTransform(x) {
    const I = complement29(x);
    const Iinv = gfInverse(I);
    const t1 = gfMult(rotr29(I, 19), I);
    const q1 = gfMult(t1, rotr29(I, 9));
    const q2 = gfMult(t1, rotr29(Iinv, 9));
    const t2 = gfMult(rotr29(I, 19), rotr29(I, 10));
    const q3 = gfMult(t2, Iinv);
    const q4 = gfMult(rotr29(I, 10), I);
    const combined = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x, q1), q2), q3), q4);
    return { bit: parity29(combined), combined };
  }

  const KEY_LAYOUT = [ // [stateIndex, byteIndex, shift]
    [0, 0, 24], [0, 1, 16], [1, 2, 24], [2, 3, 24], [2, 4, 16], [3, 5, 24],
    [4, 6, 24], [4, 7, 16], [5, 8, 24], [6, 9, 24], [6, 10, 16], [7, 11, 24],
    [8, 12, 24], [8, 13, 16], [9, 14, 24], [10, 15, 24]
  ];
  const IV_LAYOUT = [
    [0, 0, 8], [1, 1, 16], [1, 2, 8], [2, 3, 8], [3, 4, 16], [3, 5, 8],
    [4, 6, 8], [5, 7, 16], [5, 8, 8], [6, 9, 8], [7, 10, 16], [7, 11, 8],
    [8, 12, 8], [9, 13, 16], [9, 14, 8], [10, 15, 16]
  ];

  const INIT_ROUNDS = 44;

  class DarkCryptWGAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "WG (DarkCrypt)";
      this.description = "Welch-Gong (WG) transformation stream cipher: an 11-stage LFSR over GF(2^29) filtered by a degree-11 normal-basis nonlinear transformation. DarkCrypt's variant uses a compact byte-interleaved key/IV load, always a 128-bit key and 128-bit IV, and 44 nonlinear-feedback initialization clocks with a tap-11-inclusive key-init vector.";
      this.inventor = "Yassir Nawaz, Guang Gong (base WG design); DarkCrypt variant";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CA;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("The WG Stream Cipher (Nawaz, Gong)", "https://www.ecrypt.eu.org/stream/p2ciphers/wg/wg_p2.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "Modified WG cipher with a DarkCrypt-specific key/IV load and initialization schedule; not equivalent to the reviewed eSTREAM submission and not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv) then crypt(buf,len) in-place XOR).
      this.tests = [
        {
          text: "DarkCrypt Wg — keystream from incrementing key, zero IV, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ae0921b826d05f4df117e08fc6609be442e73d8683f6bb5d3064cfe387b40a402c54f4772c3af5503b5b7fa041c8a35cc5b90e57bc31eaa63321760a632b0fbd5920703d4cb40fd2222bdbc5bc3afeb9cd11554f199bddb7cb510acd97be0af890a58a5810afde38e6eda91632e166b5ed710656e6f9604f6466dc2a3b2a62f1")
        },
        {
          text: "DarkCrypt Wg — incrementing key, zero IV, incrementing plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ae0823bb22d5594af91eea84ca6d95eb52f62f9597e3ad4a287dd5f89ba9145f0c75d654081fd3771372558b6de58d73f5883c648804dc910b184c315f163182")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptWGInstance(this, isInverse);
    }
  }

  class DarkCryptWGInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;
      this._state = null;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. WG (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this._tryInitialize();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; return; }
      if (ivBytes.length !== 16)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. WG (DarkCrypt) requires exactly 16 bytes`);
      this._iv = [...ivBytes];
      this._tryInitialize();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._state) throw new Error("Key and IV not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._state) throw new Error("Key and IV not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.XorN(this.inputBuffer[i], this._generateKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    _tryInitialize() {
      if (!this._key || !this._iv) return;

      const S = new Array(11).fill(0);
      for (const [idx, byteIdx, shift] of KEY_LAYOUT)
        S[idx] = OpCodes.Xor32(S[idx], OpCodes.Shl32(OpCodes.And32(this._key[byteIdx], 0xFF), shift));
      for (const [idx, byteIdx, shift] of IV_LAYOUT)
        S[idx] = OpCodes.Xor32(S[idx], OpCodes.Shl32(OpCodes.And32(this._iv[byteIdx], 0xFF), shift));

      for (let round = 0; round < INIT_ROUNDS; round++) {
        const wg = wgTransform(S[10]);
        const gammaTerm = gfMult(S[10], GAMMA);
        const tapSum = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(gammaTerm, S[9]), S[7]), S[4]), S[1]), S[0]);
        const feedback = OpCodes.Xor32(tapSum, wg.combined);
        this._shiftIn(S, feedback);
      }

      this._state = S;
    }

    _shiftIn(S, feedback) {
      for (let k = 10; k >= 1; k--) S[k] = S[k - 1];
      S[0] = feedback;
    }

    _generateKeystreamBit() {
      const S = this._state;
      const gammaTerm = gfMult(S[10], GAMMA);
      const tapSum = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(gammaTerm, S[9]), S[7]), S[4]), S[1]), S[0]);
      this._shiftIn(S, tapSum); // S[10] is now the pre-clock S[9] (i.e. LFSR output tap S(11))
      return wgTransform(S[10]).bit;
    }

    _generateKeystreamByte() {
      let byte = 0;
      for (let i = 0; i < 8; i++)
        byte |= OpCodes.Shl32(this._generateKeystreamBit(), (7 - i));
      return OpCodes.And32(byte, 0xFF);
    }
  }

  const algorithmInstance = new DarkCryptWGAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptWGAlgorithm, DarkCryptWGInstance };
}));
