/*
 * SEAL2 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SEAL2 as implemented in the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project). The plugin's related SEAL variant produces
 * byte-for-byte identical output under the same 20-byte key; the only
 * difference between the two is the number of keystream bytes generated per
 * call (1024 vs 4096), which is purely an internal buffering detail that
 * does not change the underlying byte stream. setup() always reads a full
 * 20-byte (160-bit) key.
 *
 * Structurally this is Rogaway/Coppersmith's SEAL, but a variant distinct
 * from the SEAL 3.0 construction already implemented in seal.js:
 *   - the table-generation "gamma" hash omits SHA-1's message-schedule
 *     rotate-by-1 (i.e. it is SHA-0-shaped, not SHA-1), and the table-fill
 *     round function's compression state (H) is exactly the 5 big-endian
 *     32-bit words of the 20-byte key (T[512], S[256], and a 16-word R are
 *     all Gamma(i) outputs of that same construction, matching the
 *     Rogaway/Coppersmith SEAL design generally)
 *   - each 1024-byte keystream block only ever XORs in the LAST group of
 *     R (R[12..15]) into the initial a/b/c/d state, unlike the repeated
 *     4-group mixing described in the published SEAL round structure
 *   - the per-word inner loop's periodic re-mixing (normally applied to
 *     all four of a/b/c/d in published SEAL) here only touches a and c,
 *     both via addition (never XOR), alternating between the pre-second-
 *     round snapshots n1=d,n2=b (even output word index) and n3=a,n4=c
 *     (odd output word index)
 *   - output words are written little-endian (not big-endian as in SEAL
 *     3.0)
 * Test vectors verified against the DarkCrypt implementation (key = 00 01 02
 * ... 13); the related SEAL variant produces an identical keystream under
 * the same 20-byte key.
 *
 * 160-bit (20-byte) key, no IV. Educational only.
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

  const KEY_SIZE = 20;      // 160 bits
  const BLOCK_WORDS = 256;  // words of keystream generated per outsideCounter block
  const BLOCK_BYTES = BLOCK_WORDS * 4;

  const SHA_K = [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6];

  // SHA-0-shaped compression (no message-schedule rotate) used by Gamma().
  function compress(state, block) {
    const W = new Array(80);
    for (let t = 0; t < 16; t++)
      W[t] = OpCodes.Pack32BE(block[t * 4], block[t * 4 + 1], block[t * 4 + 2], block[t * 4 + 3]);
    for (let t = 16; t < 80; t++)
      W[t] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(W[t - 3], W[t - 8]), W[t - 14]), W[t - 16]);

    let a = state[0], b = state[1], c = state[2], d = state[3], e = state[4];
    for (let t = 0; t < 80; t++) {
      let f, k;
      if (t < 20) { f = OpCodes.Or32(OpCodes.And32(b, c), OpCodes.And32(OpCodes.Not32(b), d)); k = SHA_K[0]; }
      else if (t < 40) { f = OpCodes.Xor32(OpCodes.Xor32(b, c), d); k = SHA_K[1]; }
      else if (t < 60) { f = OpCodes.Or32(OpCodes.Or32(OpCodes.And32(b, c), OpCodes.And32(b, d)), OpCodes.And32(c, d)); k = SHA_K[2]; }
      else { f = OpCodes.Xor32(OpCodes.Xor32(b, c), d); k = SHA_K[3]; }

      const temp = OpCodes.ToUint32(OpCodes.RotL32(a, 5) + f + e + k + W[t]);
      e = d; d = c; c = OpCodes.RotL32(b, 30); b = a; a = temp;
    }

    state[0] = OpCodes.ToUint32(state[0] + a);
    state[1] = OpCodes.ToUint32(state[1] + b);
    state[2] = OpCodes.ToUint32(state[2] + c);
    state[3] = OpCodes.ToUint32(state[3] + d);
    state[4] = OpCodes.ToUint32(state[4] + e);
  }

  class DarkCryptSeal2Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "SEAL2 (DarkCrypt)";
      this.description = "Rogaway/Coppersmith SEAL variant from the DarkCrypt Total Commander plugin: SHA-0-shaped table generation (T[512]/S[256]/R[16]) from a 160-bit key, a table-driven round mixing a/b/c/d, and additive-only periodic re-mixing of just two of the four state words. Identical output confirmed from the plugin's related SEAL variant.";
      this.inventor = "Phil Rogaway, Don Coppersmith (DarkCrypt variant by Alexander Myasnikov)";
      this.year = 1994;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 0)]; // fixed 160-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("SEAL Specification (FSE'94)", "https://web.cs.ucdavis.edu/~rogaway/papers/seal.pdf"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard construction", "DarkCrypt's SEAL2 variant deviates from the published SEAL round structure (partial state re-mixing, non-standard table hash); not vetted, not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors generated from the original DLLs (setup(key) then crypt in-place
      // or crypt(in,out); key = 00 01 02 ... 13, no IV).
      this.tests = [
        {
          text: "DarkCrypt Seal2 — keystream from incrementing key, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"),
          expected: OpCodes.Hex8ToBytes("d95030a48b03db75c9b45cf849d659e443df9aae2e1695a0ba8ea72be7aa37c4940291d21e585a8d1aadcf142de6d0006df1cc6fae1c08778a4b033ef90a80c0ae89ad2e21c0c56936bb2004d5aff9173164ecd8b47ea23816875981ec67cd9e1d75612eab874ef2fcaa9400e4c4c1d85a1e63c80592a764cb886ddc4072ec4c")
        },
        {
          text: "DarkCrypt Seal — keystream from incrementing key, zero input (byte-identical to with the same key)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"),
          expected: OpCodes.Hex8ToBytes("d95030a48b03db75c9b45cf849d659e443df9aae2e1695a0ba8ea72be7aa37c4940291d21e585a8d1aadcf142de6d0006df1cc6fae1c08778a4b033ef90a80c0ae89ad2e21c0c56936bb2004d5aff9173164ecd8b47ea23816875981ec67cd9e1d75612eab874ef2fcaa9400e4c4c1d85a1e63c80592a764cb886ddc4072ec4c")
        },
        {
          text: "DarkCrypt Seal2 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"),
          expected: OpCodes.Hex8ToBytes("d95132a78f06dd72c1bd56f345db57eb53ce88bd3a0383b7a297bd30fbb729dbb423b3f13a7d7caa3284e53f01cbfe2f5dc0fe5c9a293e40b2723905c537beff")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSeal2Instance(this, isInverse);
    }
  }

  class DarkCryptSeal2Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;

      this.T = null;            // 512 words
      this.S = null;            // 256 words
      this.R = null;            // 16 words
      this._H = null;           // 5-word key state
      this._lastGammaIndex = -1;
      this._gammaZ = null;

      this._outsideCounter = 0;
      this._keystreamBuffer = [];
      this._keystreamPos = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== KEY_SIZE)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SEAL2 (DarkCrypt) requires exactly ${KEY_SIZE} bytes`);
      this._key = [...keyBytes];
      this._initialize();
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const out = new Array(this.inputBuffer.length);
      for (let i = 0; i < this.inputBuffer.length; i++)
        out[i] = OpCodes.And32(OpCodes.Xor32(this.inputBuffer[i], this._nextKeystreamByte()), 0xff);

      this.inputBuffer = [];
      return out;
    }

    // ---- Gamma(i): SHA-0-shaped compression of H with a message block
    // that is all zero except the first word, which carries floor(i/5).

    _gamma(i) {
      const shaIndex = Math.floor(i / 5);
      if (shaIndex !== this._lastGammaIndex || !this._gammaZ) {
        this._gammaZ = [...this._H];
        const block = new Array(64).fill(0);
        const idxBytes = OpCodes.Unpack32BE(OpCodes.ToUint32(shaIndex));
        block[0] = idxBytes[0]; block[1] = idxBytes[1]; block[2] = idxBytes[2]; block[3] = idxBytes[3];
        compress(this._gammaZ, block);
        this._lastGammaIndex = shaIndex;
      }
      return this._gammaZ[i % 5];
    }

    _initialize() {
      this._H = [];
      for (let i = 0; i < 5; i++) {
        const o = i * 4;
        this._H.push(OpCodes.Pack32BE(this._key[o], this._key[o + 1], this._key[o + 2], this._key[o + 3]));
      }
      this._lastGammaIndex = -1;
      this._gammaZ = null;

      this.T = new Array(512);
      for (let i = 0; i < 512; i++) this.T[i] = this._gamma(i);

      this.S = new Array(256);
      for (let i = 0; i < 256; i++) this.S[i] = this._gamma(0x1000 + i);

      this.R = new Array(16);
      for (let i = 0; i < 16; i++) this.R[i] = this._gamma(0x2000 + i);

      this._outsideCounter = 0;
      this._keystreamBuffer = [];
      this._keystreamPos = 0;
    }

    _round(a, b, c, d) {
      let p = OpCodes.And32(a, 0x7fc); b = OpCodes.Add32(b, this.T[OpCodes.Shr32(p, 2)]); a = OpCodes.RotR32(a, 9);
      p = OpCodes.And32(b, 0x7fc); c = OpCodes.Add32(c, this.T[OpCodes.Shr32(p, 2)]); b = OpCodes.RotR32(b, 9);
      p = OpCodes.And32(c, 0x7fc); d = OpCodes.Add32(d, this.T[OpCodes.Shr32(p, 2)]); c = OpCodes.RotR32(c, 9);
      p = OpCodes.And32(d, 0x7fc); a = OpCodes.Add32(a, this.T[OpCodes.Shr32(p, 2)]); d = OpCodes.RotR32(d, 9);
      return [a, b, c, d];
    }

    // Generates one 1024-byte (256-word) keystream block for the current
    // outsideCounter, then advances it.
    _generateBlock() {
      const oc = this._outsideCounter;
      let a = OpCodes.Xor32(oc, this.R[12]);
      let b = OpCodes.Xor32(OpCodes.RotR32(oc, 8), this.R[13]);
      let c = OpCodes.Xor32(OpCodes.RotR32(oc, 16), this.R[14]);
      let d = OpCodes.Xor32(OpCodes.RotR32(oc, 24), this.R[15]);

      [a, b, c, d] = this._round(a, b, c, d);
      const n1 = d, n2 = b, n3 = a, n4 = c;
      [a, b, c, d] = this._round(a, b, c, d);

      const output = new Array(BLOCK_BYTES);
      let pos = 0;
      for (let i = 0; i < 64; i++) {
        let p = OpCodes.And32(a, 0x7fc); a = OpCodes.RotR32(a, 9); b = OpCodes.Add32(b, this.T[OpCodes.Shr32(p, 2)]); b = OpCodes.Xor32(b, a);
        let q = OpCodes.And32(b, 0x7fc); b = OpCodes.RotR32(b, 9); c = OpCodes.Xor32(c, this.T[OpCodes.Shr32(q, 2)]); c = OpCodes.Add32(c, b);
        p = OpCodes.And32(p + c, 0x7fc); c = OpCodes.RotR32(c, 9); d = OpCodes.Add32(d, this.T[OpCodes.Shr32(p, 2)]); d = OpCodes.Xor32(d, c);
        q = OpCodes.And32(q + d, 0x7fc); d = OpCodes.RotR32(d, 9); a = OpCodes.Xor32(a, this.T[OpCodes.Shr32(q, 2)]); a = OpCodes.Add32(a, d);
        p = OpCodes.And32(p + a, 0x7fc); b = OpCodes.Xor32(b, this.T[OpCodes.Shr32(p, 2)]); a = OpCodes.RotR32(a, 9);
        q = OpCodes.And32(q + b, 0x7fc); c = OpCodes.Add32(c, this.T[OpCodes.Shr32(q, 2)]); b = OpCodes.RotR32(b, 9);
        p = OpCodes.And32(p + c, 0x7fc); d = OpCodes.Xor32(d, this.T[OpCodes.Shr32(p, 2)]); c = OpCodes.RotR32(c, 9);
        q = OpCodes.And32(q + d, 0x7fc); d = OpCodes.RotR32(d, 9); a = OpCodes.Add32(a, this.T[OpCodes.Shr32(q, 2)]);

        const w1 = OpCodes.Add32(b, this.S[4 * i + 0]);
        const w2 = OpCodes.Xor32(c, this.S[4 * i + 1]);
        const w3 = OpCodes.Add32(d, this.S[4 * i + 2]);
        const w4 = OpCodes.Xor32(a, this.S[4 * i + 3]);

        const b1 = OpCodes.Unpack32LE(w1), b2 = OpCodes.Unpack32LE(w2), b3 = OpCodes.Unpack32LE(w3), b4 = OpCodes.Unpack32LE(w4);
        output[pos++] = b1[0]; output[pos++] = b1[1]; output[pos++] = b1[2]; output[pos++] = b1[3];
        output[pos++] = b2[0]; output[pos++] = b2[1]; output[pos++] = b2[2]; output[pos++] = b2[3];
        output[pos++] = b3[0]; output[pos++] = b3[1]; output[pos++] = b3[2]; output[pos++] = b3[3];
        output[pos++] = b4[0]; output[pos++] = b4[1]; output[pos++] = b4[2]; output[pos++] = b4[3];

        // Periodic re-mixing: only a and c are touched, always by addition,
        // alternating between the pre-second-round (n1,n2) and (n3,n4) pairs.
        if (OpCodes.And32(i, 1)) { a = OpCodes.Add32(a, n3); c = OpCodes.Add32(c, n4); }
        else { a = OpCodes.Add32(a, n1); c = OpCodes.Add32(c, n2); }
      }

      this._outsideCounter = OpCodes.ToUint32(this._outsideCounter + 1);
      return output;
    }

    _nextKeystreamByte() {
      if (this._keystreamPos >= this._keystreamBuffer.length) {
        this._keystreamBuffer = this._generateBlock();
        this._keystreamPos = 0;
      }
      return this._keystreamBuffer[this._keystreamPos++];
    }
  }

  const algorithmInstance = new DarkCryptSeal2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSeal2Algorithm, DarkCryptSeal2Instance };
}));
