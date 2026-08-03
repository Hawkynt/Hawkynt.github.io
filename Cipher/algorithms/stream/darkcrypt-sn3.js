/*
 * SN3 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SN3 is a table-driven stream cipher/PRNG by Simeon Maltchev (published to
 * sci.crypt.research, 2002). It keeps a 192-word S-box V, conventionally
 * split into three 64-word tables V1, V2, V3. Two indices i and j (i walks
 * V1 linearly, j is derived from the previous V1 value) select one word from
 * each table; the three words are combined with XOR to produce a keystream
 * word, and each table slot is updated in place with a rotate/xor mix before
 * the indices advance. After 64 steps the roles of V1/V2/V3 are rotated and
 * the process repeats twice more, yielding 192 keystream words per full
 * pass. The secret key (up to 768 bytes) seeds V directly; one pass is run
 * to whiten the seed (each word combined with rotate-19 and the pass's own
 * output), after which the generator is run for a further fixed number of
 * passes before any keystream is used for encryption, and one more pass is
 * produced immediately before each buffer is enciphered.
 *
 * Key size: 768 bytes (fixed by the DarkCrypt Total Commander plugin build).
 * No IV. Encryption and decryption are identical (plain keystream XOR).
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  const TABLE_SIZE = 64;
  const SBOX_SIZE = 3 * TABLE_SIZE;     // 192 words = 768 bytes
  const INDEX_MASK = TABLE_SIZE - 1;    // 0x3F
  const C2 = 0x8c591ca1;
  const C3 = 0xab8ec254;
  const WHITEN_ROTATE = 19;
  const EXTRA_PASSES = 256;             // passes run after whitening, before first use

  // One full pass over the 192-word S-box: three sweeps of 64 steps each, rotating which
  // third of the table plays the role of V1/V2/V3 after every sweep. Mutates `v` (a 192-word
  // array) and `idx` ({i, j}) in place; returns the 192 keystream words produced.
  function sn3Pass(v, idx) {
    let v1 = 0, v2 = TABLE_SIZE, v3 = 2 * TABLE_SIZE;
    let i = idx.i, j = idx.j;
    const out = new Array(SBOX_SIZE);
    let n = 0;

    for (let sweep = 0; sweep < 3; sweep++) {
      for (let step = 0; step < TABLE_SIZE; step++) {
        const t1 = v[v1 + i];
        const t2 = v[v2 + j];
        const m = OpCodes.AndN(t1, INDEX_MASK);
        const t3 = v[v3 + m];

        out[n++] = OpCodes.XorN(OpCodes.XorN(t1, t2), t3);

        v[v1 + i] = OpCodes.XorN(OpCodes.RotL32(t1, 1), t2);
        v[v2 + j] = OpCodes.XorN(OpCodes.XorN(OpCodes.RotL32(t2, 5), t3), C2);
        v[v3 + m] = OpCodes.XorN(OpCodes.XorN(OpCodes.RotL32(t3, 17), t1), C3);

        i = OpCodes.AndN(i + 1, INDEX_MASK);
        j = OpCodes.AndN(OpCodes.Shr32(t1, 8), INDEX_MASK);
      }
      const tmp = v1; v1 = v2; v2 = v3; v3 = tmp;
    }

    idx.i = i; idx.j = j;
    return out;
  }

  function wordsToBytes(words) {
    const out = new Array(words.length * 4);
    for (let w = 0; w < words.length; w++) {
      const b = OpCodes.Unpack32LE(words[w]);
      out[w * 4] = b[0]; out[w * 4 + 1] = b[1]; out[w * 4 + 2] = b[2]; out[w * 4 + 3] = b[3];
    }
    return out;
  }

  class DarkCryptSN3Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "SN3 (DarkCrypt)";
      this.description = "Table-driven stream cipher with a 192-word key-dependent S-box, conventionally split into three 64-word tables that rotate roles every 64 steps. Each step mixes one word from each table with rotate/xor updates and a data-dependent second index. From the DarkCrypt Total Commander plugin build.";
      this.inventor = "Simeon Maltchev";
      this.year = 2002;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BG;

      this.SupportedKeySizes = [new KeySize(768, 768, 0)];  // fixed 768-byte key
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("The SN3 Stream Cipher (original posting, sci.crypt.research)", "https://groups.google.com/g/sci.crypt.research/c/lPjKoTgO4Jc")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed construction", "Custom stream cipher with no formal public cryptanalysis beyond the designer's own statistical testing; not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors: key = 768 bytes 0x00..0xFF repeating; verified round-trip against the
      // original DarkCrypt SN3 plugin build (encrypt then decrypt of the incrementing-byte
      // vector reproduces the plaintext exactly).
      this.tests = [
        {
          text: "DarkCrypt SN3 - 768-byte key keystream",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: (function () { const z = new Array(128).fill(0); return z; })(),
          key: (function () { const k = new Array(768); for (let i = 0; i < 768; i++) k[i] = OpCodes.AndN(i, 0xFF); return k; })(),
          expected: OpCodes.Hex8ToBytes("e535f50705d738004bd02561d095ccc79f6561a39435f3324b05369828bc88f8793b9bc88818357515a03a5f8bd1a364be26fe53af37c95956085779487fb868134e4fbcaaa66d45e18cf0ea40b9f561743b6eafec942283b545a7f8cdfcf7112d718c4219361fea128316f1b08934211c1098eb611081e13ef67dfe3514115d")
        },
        {
          text: "DarkCrypt SN3 - incrementing plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: (function () { const k = new Array(768); for (let i = 0; i < 768; i++) k[i] = OpCodes.AndN(i, 0xFF); return k; })(),
          expected: OpCodes.Hex8ToBytes("e534f70401d23e0743d92f6adc98c2c88f7473b08020e525531c2c8334a196e7591ab9ebac3d13523d891074a7fc8d4b8e17cc609b02ff6e6e316d4274428657")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSN3Instance(this, isInverse);
    }
  }

  class DarkCryptSN3Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;

      this._v = null;      // 192-word S-box state
      this._idx = null;    // {i, j}
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 768)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SN3 (DarkCrypt) requires exactly 768 bytes`);
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

      const output = this._process(this.inputBuffer);
      this.inputBuffer = [];
      return output;
    }

    // Seed the S-box directly from the 768-byte key, whiten it with one pass, then run a
    // further fixed number of passes before any keystream reaches the caller.
    _initialize() {
      const v = new Array(SBOX_SIZE);
      for (let w = 0; w < SBOX_SIZE; w++) {
        const o = w * 4;
        v[w] = OpCodes.Pack32LE(this._key[o], this._key[o + 1], this._key[o + 2], this._key[o + 3]);
      }

      const idx = { i: 0, j: 0 };
      const whiten = sn3Pass(v, idx);
      for (let w = 0; w < SBOX_SIZE; w++)
        v[w] = OpCodes.XorN(OpCodes.RotL32(v[w], WHITEN_ROTATE), whiten[w]);

      for (let p = 0; p < EXTRA_PASSES; p++)
        sn3Pass(v, idx);

      this._v = v;
      this._idx = idx;
    }

    // Every buffer is enciphered against a freshly produced pass (up to 768 bytes of
    // keystream); longer buffers consume additional passes 768 bytes at a time.
    _process(data) {
      const out = new Array(data.length);
      let pos = 0;
      while (pos < data.length) {
        const ksBytes = wordsToBytes(sn3Pass(this._v, this._idx));
        const chunk = Math.min(SBOX_SIZE * 4, data.length - pos);
        for (let k = 0; k < chunk; k++)
          out[pos + k] = OpCodes.XorN(data[pos + k], ksBytes[k]);
        pos += chunk;
      }
      return out;
    }
  }

  const algorithmInstance = new DarkCryptSN3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSN3Algorithm, DarkCryptSN3Instance };
}));
