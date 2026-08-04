/*
 * MDC (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MDC as implemented in the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project), labeled "MDC (512 bit, CFB)" by the plugin.
 *
 * setup(key,iv) and crypt(buf,len)/decrypt(buf,len) operate in place, but
 * internally MDC is a self-keying construction built on the standard MD5
 * compression function (the round function's F/G/H/I selectors and
 * per-round left-rotate amounts 7/12/17/22, 5/9/14/20, 4/11/16/23,
 * 6/10/15/21 exactly match the published MD5 specification):
 *
 *   1. setup(key[64], iv[8]) builds an initial 16-byte chaining state from
 *      the 8-byte IV, duplicated into both halves: state = iv || iv (i.e.
 *      the first 4 IV bytes seed both A and C, the last 4 seed both B and D).
 *   2. A 256-byte scratch buffer is filled with a 2-byte big-endian length
 *      header (0x0040 = 64) followed by the 64-byte key (190 zero bytes of
 *      padding fill the rest), and is then run through 100 rounds of a
 *      self-referential CFB warm-up: each round CFB-encrypts the full
 *      256-byte scratch buffer in place (16 blocks of 16 bytes, each block
 *      using -- and updating -- the running 16-byte chaining state), and
 *      after each round the ENTIRE scrambled 256-byte scratch buffer
 *      overwrites the MD5 round-constant table (the standard 64-entry K[]
 *      table used by the compression function), so both the constants and
 *      the chaining state evolve together, keyed by the original 64-byte key.
 *   3. One more CFB pass processes the first 64 bytes of the (now heavily
 *      scrambled) scratch buffer; the result becomes the fixed 64-byte
 *      "message" block fed to the compression function for the remainder of
 *      the session, and the chaining state left over from this pass becomes
 *      the cipher's working IV.
 *   4. crypt()/decrypt() then run ordinary CFB-MD5: for each 16-byte block,
 *      the state is compressed (Davies-Meyer feedback, keyed by the
 *      session's derived message and derived round-constant table) to
 *      produce a 16-byte keystream block; the block is XORed with the
 *      plaintext (or ciphertext) and the resulting CIPHERTEXT bytes become
 *      the next chaining state (true CFB feedback, not OFB).
 *
 * Test vectors verified against the DarkCrypt implementation: the derived
 * internal state immediately after setup(), and the full keystream/
 * ciphertext for both an all-zero-plaintext vector and an
 * incrementing-plaintext vector, plus a decrypt round trip. 64-byte
 * (512-bit) key, 8-byte (64-bit) IV. Educational only.
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

  const KEY_SIZE = 64;  // 512 bits
  const IV_SIZE = 8;    // 64 bits (duplicated internally to seed the 128-bit chaining state)
  const WARMUP_ROUNDS = 100;
  const SCRATCH_SIZE = 256;

  // Standard MD5 round-constant table (used as the INITIAL value of the
  // session's mutable K[] table -- MDC scrambles its own copy during setup).
  const STANDARD_MD5_K = [
    0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
    0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
    0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
    0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
    0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
    0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
    0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
    0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391
  ];

  const MD5_SHIFTS = [
    7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
    5, 9,14,20, 5, 9,14,20, 5, 9,14,20, 5, 9,14,20,
    4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
    6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21
  ];

  function packWordLE(bytes, i) {
    return OpCodes.Pack32LE(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
  }

  function unpackWordLE(word, out, i) {
    const b = OpCodes.Unpack32LE(word);
    out[i] = b[0]; out[i + 1] = b[1]; out[i + 2] = b[2]; out[i + 3] = b[3];
  }

  function stateToBytes(state) {
    const out = new Array(16);
    for (let i = 0; i < 4; i++) unpackWordLE(state[i], out, i * 4);
    return out;
  }

  // MD5 compression function with Davies-Meyer feedback. `state` (4 words) is
  // mutated in place; `msgBytes` is a fixed 64-byte block; `K` is the
  // (possibly scrambled) 64-entry round-constant table.
  function md5CompressFeedback(state, msgBytes, K) {
    const M = new Array(16);
    for (let i = 0; i < 16; i++) M[i] = packWordLE(msgBytes, i * 4);

    let A = state[0], B = state[1], C = state[2], D = state[3];
    const a0 = A, b0 = B, c0 = C, d0 = D;

    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = OpCodes.ToUint32(OpCodes.Or32(OpCodes.And32(B, C), OpCodes.And32(~B, D))); g = i; }
      else if (i < 32) { f = OpCodes.ToUint32(OpCodes.Or32(OpCodes.And32(D, B), OpCodes.And32(~D, C))); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(B, C), D)); g = (3 * i + 5) % 16; }
      else { f = OpCodes.ToUint32(OpCodes.Xor32(C, OpCodes.Or32(B, OpCodes.ToUint32(~D)))); g = (7 * i) % 16; }

      f = OpCodes.ToUint32(f + A + K[i] + M[g]);
      A = D; D = C; C = B;
      B = OpCodes.ToUint32(B + OpCodes.RotL32(f, MD5_SHIFTS[i]));
    }

    state[0] = OpCodes.ToUint32(a0 + A);
    state[1] = OpCodes.ToUint32(b0 + B);
    state[2] = OpCodes.ToUint32(c0 + C);
    state[3] = OpCodes.ToUint32(d0 + D);
  }

  // CFB encrypt `len` bytes (multiple of 16) of `buf` in place: each 16-byte
  // block is XORed with a freshly compressed keystream block, and the
  // resulting CIPHERTEXT becomes the chaining state for the next block.
  function cfbEncryptInPlace(buf, len, state, msgBytes, K) {
    for (let off = 0; off < len; off += 16) {
      md5CompressFeedback(state, msgBytes, K);
      const ks = stateToBytes(state);
      for (let i = 0; i < 16; i++) buf[off + i] = OpCodes.Xor8(buf[off + i], ks[i]);
      for (let i = 0; i < 4; i++) state[i] = packWordLE(buf, off + i * 4);
    }
  }

  // CFB decrypt: identical keystream derivation, but the chaining state for
  // the next block must come from the CIPHERTEXT (the original input bytes),
  // not the recovered plaintext.
  function cfbDecryptInPlace(buf, len, state, msgBytes, K) {
    for (let off = 0; off < len; off += 16) {
      md5CompressFeedback(state, msgBytes, K);
      const ks = stateToBytes(state);
      const ctBlock = buf.slice(off, off + 16);
      for (let i = 0; i < 16; i++) buf[off + i] = OpCodes.Xor8(buf[off + i], ks[i]);
      for (let i = 0; i < 4; i++) state[i] = packWordLE(ctBlock, i * 4);
    }
  }

  function mdcSetup(key64, iv8) {
    const K = STANDARD_MD5_K.slice();
    const ivA = packWordLE(iv8, 0), ivB = packWordLE(iv8, 4);
    const state = [ivA, ivB, ivA, ivB];

    const scratch = new Array(SCRATCH_SIZE).fill(0);
    scratch[0] = 0x00; scratch[1] = 0x40; // 16-bit big-endian length header (64)
    for (let i = 0; i < KEY_SIZE; i++) scratch[2 + i] = key64[i];

    const msg = new Array(KEY_SIZE).fill(0); // message stays all-zero through the warm-up

    for (let round = 0; round < WARMUP_ROUNDS; round++) {
      cfbEncryptInPlace(scratch, SCRATCH_SIZE, state, msg, K);
      for (let i = 0; i < 64; i++) K[i] = packWordLE(scratch, i * 4);
    }

    cfbEncryptInPlace(scratch, KEY_SIZE, state, msg, K);
    const finalMsg = scratch.slice(0, KEY_SIZE);

    return { state: state, K: K, msg: finalMsg };
  }

  class MDCAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "MDC (DarkCrypt)";
      this.description = "Self-keying CFB stream cipher built on the standard MD5 compression function, with a 100-round self-referential key schedule that scrambles both the chaining state and MD5's own round-constant table from the 512-bit key.";
      this.inventor = "DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 0)]; // fixed 512-bit
      this.SupportedIVSizes = [new KeySize(IV_SIZE, IV_SIZE, 0)];     // fixed 64-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard, unanalyzed construction", "Ad-hoc self-keying MD5-based CFB with a mutable round-constant table; no public design rationale or cryptanalysis; not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation
      // (setup(key,iv) then crypt(buf,len)/decrypt(buf,len) in place).
      this.tests = [
        {
          text: "DarkCrypt Mdc — keystream from incrementing key, zero IV, zero plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000"),
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d8723082565e48ae1ba2f1c65dc9eec76653665ec3b4baaa7e6e2f715c5b7cbd350d6b46727bac680a5d7b4057f7a99436c287dc4ea8e7ea3e92a788cb83bb36638ac1c7f59bfa4ffcf2670c9cf35aa165deec679a6634e7177dfb362a2918ddd574757fdff6d6a8af3007e0880fa164ada591fcfa93d703eda08d46e37625ef")
        },
        {
          text: "DarkCrypt Mdc — incrementing key, zero IV, incrementing plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("d8733281525b4ea913abfbcd51c4e0c8af56081da8ca49a9c4ddf02943cb2d5ce6a6614297a26457b330575f96b463e50eb5e014e1d7f0b163e66b92d1a7b61e")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new MDCInstance(this, isInverse);
    }
  }

  class MDCInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = new Array(IV_SIZE).fill(0);
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== KEY_SIZE)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. MDC (DarkCrypt) requires exactly ${KEY_SIZE} bytes`);
      this._key = [...keyBytes];
    }

    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = new Array(IV_SIZE).fill(0); return; }
      if (ivBytes.length !== IV_SIZE)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. MDC (DarkCrypt) requires exactly ${IV_SIZE} bytes`);
      this._iv = [...ivBytes];
    }

    get iv() { return this._iv ? [...this._iv] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const n = this.inputBuffer.length;
      const padded = OpCodes.CopyArray(this.inputBuffer);
      const paddedLen = Math.ceil(n / 16) * 16;
      while (padded.length < paddedLen) padded.push(0);

      const ctx = mdcSetup(this._key, this._iv);
      if (this.isInverse) cfbDecryptInPlace(padded, paddedLen, ctx.state, ctx.msg, ctx.K);
      else cfbEncryptInPlace(padded, paddedLen, ctx.state, ctx.msg, ctx.K);

      const output = padded.slice(0, n);
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new MDCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MDCAlgorithm, MDCInstance };
}));
