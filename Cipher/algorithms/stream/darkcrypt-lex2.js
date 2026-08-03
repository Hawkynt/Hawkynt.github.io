/*
 * LEX2 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LEX is Alex Biryukov's eSTREAM candidate that turns AES-128 into a stream
 * cipher by "leaking" bytes out of the intermediate round states of AES
 * encryptions run in an OFB-like chain, instead of only using the final
 * ciphertext block. DarkCrypt's "LEX2" implementation is a variant of this
 * idea:
 *
 *   - setup(key,iv): standard AES-128 key schedule from a 128-bit key; the
 *     internal 128-bit state S is initialized as S0 = AES_K(IV) using an
 *     ordinary, textbook AES-128 encryption (round 10 has no MixColumns).
 *   - crypt(): keystream is produced in 40-byte bursts. Each burst runs the
 *     state S through 10 rounds of SubBytes/ShiftRows/MixColumns/AddRoundKey
 *     -- unlike textbook AES, MixColumns is applied in EVERY round including
 *     round 10, so all 10 rounds have the same shape. After each round r
 *     (1..10), 4 bytes of keystream are leaked by interleaving the round's
 *     first and third 32-bit words (word0 "A" and word2 "C", using AES'
 *     internal little-endian word packing): odd rounds output
 *     [C1,A1,C3,A3] (the odd-indexed bytes of each word) and even rounds
 *     output [C0,A0,C2,A2] (the even-indexed bytes), giving 10*4 = 40 leaked
 *     bytes per burst. The complete 10-round output (all 4 words, in order)
 *     becomes the new state S for the next burst -- i.e. this "leaking"
 *     round function's own final output replaces the plain AES chaining
 *     S_{i+1} = AES_K(S_i) that vanilla LEX would use.
 *
 * 128-bit key, 128-bit IV. Test vectors generated from the DarkCrypt
 * implementation (setup(key,iv) then crypt(in,out,len) XORs the keystream
 * into a buffer). Educational only.
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

  // ---- Standard AES-128 primitives (SBox built at load time from the GF(2^8) affine construction) ----
  const SBOX = (function () {
    const s = new Array(256);
    let p = 1, q = 1;
    do {
      p = OpCodes.XorN(OpCodes.XorN(p, OpCodes.And32(OpCodes.Shl32(p, 1), 0xFF)), OpCodes.And32(p, 0x80) ? 0x1B : 0);
      q = OpCodes.AndN(q, 0xFF);
      q = OpCodes.XorN(q, OpCodes.And32(OpCodes.Shl32(q, 1), 0xFF));
      q = OpCodes.XorN(q, OpCodes.And32(OpCodes.Shl32(q, 2), 0xFF));
      q = OpCodes.XorN(q, OpCodes.And32(OpCodes.Shl32(q, 4), 0xFF));
      if (OpCodes.And32(q, 0x80)) q = OpCodes.XorN(q, 0x09);
      q = OpCodes.AndN(q, 0xFF);
      const rot = (v, n) => OpCodes.OrN(OpCodes.AndN(OpCodes.Shl32(v, n), 0xFF), OpCodes.Shr32(v, 8 - n));
      const xf = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(q, rot(q, 1)), rot(q, 2)), rot(q, 3)), rot(q, 4));
      s[p] = OpCodes.XorN(xf, 0x63);
    } while (p !== 1);
    s[0] = 0x63;
    return s;
  })();

  const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36];

  function keyExpansion128(key) {
    const rk = key.slice();
    for (let i = 16; i < 176; i += 4) {
      let t = [rk[i - 4], rk[i - 3], rk[i - 2], rk[i - 1]];
      if (i % 16 === 0) {
        t = [t[1], t[2], t[3], t[0]].map(x => SBOX[x]);
        t[0] = OpCodes.XorN(t[0], RCON[i / 16 - 1]);
      }
      for (let j = 0; j < 4; j++) rk[i + j] = OpCodes.XorN(rk[i - 16 + j], t[j]);
    }
    return rk;
  }

  function addRoundKey(state, rk, offset) {
    for (let i = 0; i < 16; i++) state[i] = OpCodes.XorN(state[i], rk[offset + i]);
  }

  function subBytes(state) {
    for (let i = 0; i < 16; i++) state[i] = SBOX[state[i]];
  }

  function shiftRows(state) {
    const t = state.slice();
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        state[r + 4 * c] = t[r + 4 * ((c + r) % 4)];
  }

  function mixColumns(state) {
    for (let c = 0; c < 4; c++) {
      const i = 4 * c, a0 = state[i], a1 = state[i + 1], a2 = state[i + 2], a3 = state[i + 3];
      state[i] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.GF256Mul(a0, 2), OpCodes.GF256Mul(a1, 3)), a2), a3);
      state[i + 1] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(a0, OpCodes.GF256Mul(a1, 2)), OpCodes.GF256Mul(a2, 3)), a3);
      state[i + 2] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(a0, a1), OpCodes.GF256Mul(a2, 2)), OpCodes.GF256Mul(a3, 3));
      state[i + 3] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.GF256Mul(a0, 3), a1), a2), OpCodes.GF256Mul(a3, 2));
    }
  }

  // Standard, textbook AES-128 block encryption (round 10 has no MixColumns): used only to derive S0 = AES_K(IV).
  function aes128Encrypt(block, rk) {
    const s = block.slice();
    addRoundKey(s, rk, 0);
    for (let r = 1; r <= 9; r++) {
      subBytes(s); shiftRows(s); mixColumns(s); addRoundKey(s, rk, 16 * r);
    }
    subBytes(s); shiftRows(s); addRoundKey(s, rk, 160);
    return s;
  }

  // reverse the 4 bytes of a 32-bit word (AES' internal little-endian word packing vs. this byte-array convention)
  function rev4(word) { return [word[3], word[2], word[1], word[0]]; }

  // Run one 40-byte "leaking" burst: 10 rounds, EVERY round including round 10 has MixColumns.
  // Returns { leak: 40 bytes, newState: 16 bytes }.
  function generateBurst(state, rk) {
    const cur = state.slice();
    const leak = [];
    for (let r = 1; r <= 10; r++) {
      subBytes(cur); shiftRows(cur); mixColumns(cur); addRoundKey(cur, rk, 16 * r);
      const a = rev4(cur.slice(0, 4));
      const c = rev4(cur.slice(8, 12));
      const word = (r % 2 === 1) ? [c[1], a[1], c[3], a[3]] : [c[0], a[0], c[2], a[2]];
      leak.push(word[0], word[1], word[2], word[3]);
    }
    return { leak: leak, newState: cur };
  }

  class DarkCryptLex2Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "LEX2 (DarkCrypt)";
      this.description = "AES-128-based keystream leak-extraction stream cipher from the DarkCrypt Total Commander plugin, related to Alex Biryukov's eSTREAM candidate LEX. Every round of a 10-round AES-like permutation (with MixColumns applied even in round 10, unlike textbook AES) leaks 4 bytes formed by interleaving two of the round's output words; the round function's own output becomes the next state.";
      this.inventor = "Alex Biryukov (LEX design); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Biryukov, \"A New 128-bit Key Stream Cipher LEX\" (eSTREAM submission)", "https://www.ecrypt.eu.org/stream/lex.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard, unanalyzed variant", "Leaks bytes from an all-MixColumns 10-round AES-like permutation using a DarkCrypt-specific interleave rule, not the original LEX construction; unanalyzed and not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (setup(key,iv) then crypt(buf,len) in-place XOR).
      this.tests = [
        {
          text: "DarkCrypt Lex — keystream from incrementing key, zero IV, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d26a438ab2f4a578214c98cd71d1b69102228f79d01e689cd448b77b408a343ef3b095c51e2eba96efddd22162526a77f1736dfdbd7d1656e67902a734adf76c97cb739967800db31181f0c20885ea05eae040e7d9c579745ffea0dbb5c10d348c67336cc691cfb0c37bfded8b14402f377f8d91ed353c817c537b519303dbbb")
        },
        {
          text: "DarkCrypt Lex — incrementing key, zero IV, incrementing plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d26b4189b6f1a37f294592c67ddcb89e12339d6ac40b7e8bcc51ad605c972a21d391b7e63a0b9cb1c7f4f80a4e7f4458c1425fce89482061de40389c0890c953")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptLex2Instance(this, isInverse);
    }
  }

  class DarkCryptLex2Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;
      this._rk = null;
      this._state = null;
      this._keystreamBuffer = [];
      this._keystreamPos = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. LEX2 (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this._initialize();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = new Array(16).fill(0); }
      else {
        if (ivBytes.length !== 16)
          throw new Error(`Invalid IV size: ${ivBytes.length} bytes. LEX2 (DarkCrypt) requires exactly 16 bytes`);
        this._iv = [...ivBytes];
      }
      if (this._key) this._initialize();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.XorN(this.inputBuffer[i], this._nextKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    _initialize() {
      this._rk = keyExpansion128(this._key);
      const iv = this._iv || new Array(16).fill(0);
      this._state = aes128Encrypt(iv, this._rk); // S0 = AES_K(IV)
      this._keystreamBuffer = [];
      this._keystreamPos = 0;
    }

    _nextKeystreamByte() {
      if (this._keystreamPos >= this._keystreamBuffer.length) {
        const { leak, newState } = generateBurst(this._state, this._rk);
        this._state = newState;
        this._keystreamBuffer = leak;
        this._keystreamPos = 0;
      }
      return this._keystreamBuffer[this._keystreamPos++];
    }
  }

  const algorithmInstance = new DarkCryptLex2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptLex2Algorithm, DarkCryptLex2Instance };
}));
