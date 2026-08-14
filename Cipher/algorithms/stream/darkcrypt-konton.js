/*
 * Konton (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Konton stream cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). A 512-bit-key, table-driven ARX
 * generator:
 *   - setup(key) XORs the 64-byte key into a 128-byte work buffer, packs the
 *     buffer as 32 big-endian 32-bit words into a working table, then
 *     self-encrypts the 128-byte buffer twice with the cipher's own crypt
 *     primitive (using the just-built table) before a final re-pack
 *   - the core "advance" step walks the 32-word table once per call: each
 *     word is added/subtracted a fixed 32-bit round constant (applied twice
 *     if the previous word's post-operation value was zero), two data-
 *     dependent rotate amounts are derived byte-wise from a running 5-bit
 *     rotation tracker, and a 32-bit accumulator is updated by rotating it
 *     and adding a rotated copy of the round word
 *   - crypt() calls advance() once per two plaintext bytes, uses bits
 *     16-23/24-31 of the returned accumulator as the two keystream bytes,
 *     and folds the plaintext bytes themselves back into the accumulator
 *     (self-synchronizing feedback)
 * Test vectors generated from the DarkCrypt implementation (setup(key) takes
 * a single argument; crypt(buf,len) XORs the keystream into the buffer in
 * place). 512-bit key, no IV. Educational only.
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

  // 32 round (constant, operation) pairs applied to the working table, in order.
  const ROUNDS = [
    [0x12345679, 'sub'], [0x369D036B, 'sub'], [0x5C28F5BF, 'add'], [0x147AE13D, 'add'],
    [0x3D70A3B7, 'add'], [0x47AE14DB, 'sub'], [0x28F5C16F, 'add'], [0x7AE1444D, 'add'],
    [0x70A3CCE7, 'add'], [0x51EB66B5, 'add'], [0x0A3DCBE1, 'sub'], [0x1EB963A3, 'sub'],
    [0x5C2C2AE9, 'sub'], [0x148480BB, 'sub'], [0x3D8D8231, 'sub'], [0x4757796D, 'add'],
    [0x29F993B9, 'sub'], [0x7DECBB2B, 'sub'], [0x79C63181, 'sub'], [0x6D529483, 'sub'],
    [0x47F7BD89, 'sub'], [0x2818C765, 'add'], [0x784A562F, 'add'], [0x68DF028D, 'add'],
    [0x3A9D07A7, 'add'], [0x5028E90B, 'sub'], [0x0F8544DF, 'add'], [0x2E8FCE9D, 'add'],
    [0x74509429, 'sub'], [0x5CF1BC7B, 'sub'], [0x16D53571, 'sub'], [0x447FA053, 'sub']
  ];

  function applyRoundOp(val, op, c) {
    return op === 'add' ? OpCodes.ToUint32(val + c) : OpCodes.ToUint32(val - c);
  }

  class DarkCryptKontonAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Konton (DarkCrypt)";
      this.description = "512-bit-key table-driven ARX stream cipher from the DarkCrypt Total Commander plugin. A 32-word table is derived from the key, then walked once per keystream step with data-dependent rotations and an additive accumulator carrying self-synchronizing plaintext feedback.";
      this.inventor = "Alexander Myasnikov (\"Zarya\" project)";
      this.year = 2013;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed construction", "Custom, unpublished ARX stream cipher with no public cryptanalysis; not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (setup(key) then crypt(buf,len) in-place XOR).
      this.tests = [
        {
          text: "DarkCrypt Konton — keystream from incrementing key, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("ed614f35b2ddde567d95866172815adfba2f3570e61050217724813effb578a23c29ce5c8359c7f649882b5eedfd33694fc0423bffb930c4b04484789eb203b3cd98b3492d3691d8805ddc0251bac134e1e72e98b3037aab296b8be130f1204d542073d0b80d43bafadefc6e150159e9663ed853cbf0b5e300a08ca480cc8ac7")
        },
        {
          text: "DarkCrypt Konton — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("ed604be3f76e28959ef8361a20fcbbe0ecc3d436c600f2c070620c1035ed15e26f6c4ff21a3cfd5b6039e5afa6f76fce47557730b5a8298395fe083915e8000b")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptKontonInstance(this, isInverse);
    }
  }

  class DarkCryptKontonInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;

      this._table = null;   // 32 x 32-bit working words
      this._acc = 0;        // 32-bit accumulator
      this._rot = 0;        // 5-bit rotation tracker
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Konton (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this._initialize();
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = this._process(this.inputBuffer);
      this.inputBuffer = [];
      return output;
    }

    // ---- table pack/reset ----

    _pack(work) {
      // table[i] = big-endian uint32 from work[4i..4i+3]; resets accumulator & rotation tracker.
      const table = new Array(32);
      for (let i = 0; i < 32; i++) {
        const o = i * 4;
        table[i] = OpCodes.Pack32BE(work[o], work[o + 1], work[o + 2], work[o + 3]);
      }
      this._table = table;
      this._acc = 0;
      this._rot = 0;
    }

    // ---- one advance step: walks all 32 table words, returns new accumulator ----

    _advance() {
      let acc = this._acc;
      let rot = this._rot;
      let prevVal = 0;

      for (let i = 0; i < 32; i++) {
        const [c, op] = ROUNDS[i];
        let val = applyRoundOp(this._table[i], op, c);
        if (i > 0 && prevVal === 0)
          val = applyRoundOp(val, op, c);

        rot = OpCodes.AndN(rot + OpCodes.AndN(val, 0xFF), 0x1F);
        acc = OpCodes.RotL32(acc, rot);
        rot = OpCodes.AndN(rot + OpCodes.AndN(acc, 0xFF), 0x1F);

        prevVal = val;
        this._table[i] = val;

        const rotatedVal = OpCodes.RotL32(val, rot);
        acc = OpCodes.ToUint32(acc + rotatedVal);
      }

      if (acc === 0 && rot === 0) rot = 1;
      this._acc = acc;
      this._rot = rot;
      return acc;
    }

    // ---- crypt primitive: XOR keystream into buf[0..len-1], feeding plaintext back into the accumulator ----
    //
    // The accumulator feedback is what makes this cipher self-synchronizing, and
    // it folds in the PLAINTEXT byte. Encryption reads that byte straight out of
    // the buffer; decryption is handed ciphertext, so it must fold in the byte it
    // has just recovered. Folding in the ciphertext instead desynchronizes the
    // generator from the second byte pair onwards, which is why decryption
    // returned the first byte correctly and nothing else.
    _cryptBuffer(buf, len, decrypting) {
      let i = 0;
      while (i < len) {
        const r = this._advance();
        const ks = OpCodes.AndN(OpCodes.Shr32(r, 16), 0xFFFF);

        const b0 = OpCodes.AndN(ks, 0xFF);
        const out0 = OpCodes.XorN(buf[i], b0);
        const p0 = decrypting ? out0 : buf[i];
        this._acc = OpCodes.ToUint32(this._acc + p0);
        buf[i] = out0;
        i++;
        if (i >= len) break;

        const b1 = OpCodes.AndN(OpCodes.Shr32(ks, 8), 0xFF);
        const out1 = OpCodes.XorN(buf[i], b1);
        const p1 = decrypting ? out1 : buf[i];
        this._acc = OpCodes.ToUint32(this._acc + OpCodes.Shl32(p1, 8));
        buf[i] = out1;
        i++;
      }
    }

    _initialize() {
      const work = new Array(128).fill(0);
      let remaining = this._key.length;
      let keyOff = 0;

      while (remaining > 0) {
        this._pack(work);
        const chunk = Math.min(remaining, 128);
        for (let i = 0; i < chunk; i++)
          work[i] = OpCodes.XorN(work[i], this._key[keyOff + i]);

        // Key setup always self-encrypts, whichever direction the instance serves.
        this._cryptBuffer(work, 128, false);
        this._cryptBuffer(work, 128, false);

        remaining -= chunk;
        keyOff += chunk;
      }
      this._pack(work);
    }

    _process(data) {
      const buf = [...data];
      this._cryptBuffer(buf, buf.length, this.isInverse);
      return buf;
    }
  }

  const algorithmInstance = new DarkCryptKontonAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptKontonAlgorithm, DarkCryptKontonInstance };
}));
