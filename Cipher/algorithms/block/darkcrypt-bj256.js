/*
 * BJ-256 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The BJ-256 block cipher as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). No public specification
 * exists; this implementation follows the behavior of the DarkCrypt plugin.
 *
 * Key schedule: a trivial identity copy — the 16 32-bit little-endian
 * words of the raw 512-bit key are copied verbatim into a 16-word round-key
 * table (K0..K15), with NO key-schedule mixing, expansion or round-constant
 * injection of any kind.
 *
 * The block transform operates on 8 32-bit little-endian words (w0..w7 =
 * 256-bit block):
 *   1. Initial whitening: wi ^= Ki for i = 0..7.
 *   2. A long keyless ARX mixing network (12 repetitions of an 8-word
 *      pairwise-mixing kernel: each step combines a word with its neighbor
 *      via ADD/SUB and folds in a shifted copy of a third word via XOR,
 *      cycling through fixed shift amounts 8, 11, 3, 6, 4, 13). Because it
 *      is pure ARX with no additive round constants, an all-zero state is
 *      a fixed point of this network — which is exactly why the "zero key /
 *      zero plaintext" vector produces zero ciphertext: the leading and
 *      trailing key-whitening XORs are also no-ops on an all-zero key, so
 *      the entire cipher degenerates to identity.
 *   3. Final whitening: outputs are XORed with K8..K15 (in a permuted word
 *      order relative to the input mapping) as the last mixing step's
 *      results are stored.
 * Decryption is the exact algebraic inverse (matching ADD with SUB, and
 * running the mix kernel backwards).
 *
 * This implementation was validated bit-for-bit against all three DarkCrypt
 * test vectors (zero/incr/incr2) plus their decrypt round-trips.
 * 256-bit block, 512-bit key. Educational only.
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
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  class DarkCryptBJ256Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "BJ-256 (DarkCrypt)";
      this.description = "Homegrown ARX block cipher from the DarkCrypt Total Commander plugin with no public specification: an 8x32-bit-word (256-bit) block cipher whose key schedule is a raw identity copy of the 512-bit key into 16 round-key words, sandwiching a fully-unrolled keyless ARX mixing network between leading/trailing key whitening.";
      this.inventor = "Alexander Myasnikov (\"Zarya\" project) — DarkCrypt original design, no public specification";
      this.year = 2009;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(32, 32, 0)]; // fixed 256-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed proprietary design", "No public specification, cryptanalysis or design rationale exists for BJ-256; the key schedule performs no mixing at all (round keys are the raw key words). Not recommended for any real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Bj256 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000")
        },
        {
          text: "DarkCrypt Bj256 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f")
        },
        {
          text: "DarkCrypt Bj256 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("4647490ce33a0ebb7707574d415cc6e9929ce981a37728826b815378b6ae7606")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptBJ256Instance(this, isInverse);
    }
  }

  class DarkCryptBJ256Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._K = null;
      this.inputBuffer = [];
      this.BlockSize = 32;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._K = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. BJ-256 (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      // setup(): identity copy of the 16 little-endian key words — see file header.
      const K = new Array(16);
      for (let i = 0; i < 16; i++)
        K[i] = OpCodes.Pack32LE(keyBytes[4 * i], keyBytes[4 * i + 1], keyBytes[4 * i + 2], keyBytes[4 * i + 3]);
      this._K = K;
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
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    _encryptBlock(block) {
      const K = this._K;
      const w = new Array(8);
      for (let i = 0; i < 8; i++)
        w[i] = OpCodes.Pack32LE(block[4 * i], block[4 * i + 1], block[4 * i + 2], block[4 * i + 3]);

      let a, b, c, d, e, t, m0, m1, m2, m3;
      a = w[0];  // 0040101B
      e = w[1];  // 0040101D
      d = w[4];  // 00401020
      c = w[6];  // 00401023
      b = w[7];  // 00401026
      a = OpCodes.Xor32(a, K[0]);  // 00401029
      e = OpCodes.Xor32(e, K[1]);  // 0040102F
      d = OpCodes.Xor32(d, K[4]);  // 00401035
      c = OpCodes.Xor32(c, K[6]);  // 0040103B
      b = OpCodes.Xor32(b, K[7]);  // 00401041
      m1 = d;  // 00401047
      m0 = a;  // 0040104B
      t = m1;  // 0040104E
      a = w[2];  // 00401052
      d = w[5];  // 00401055
      m0 = OpCodes.Sub32(m0, t);  // 00401058
      t = b;  // 0040105B
      a = OpCodes.Xor32(a, K[2]);  // 0040105D
      t = OpCodes.Shr32(t, 8);  // 00401063
      d = OpCodes.Xor32(d, K[5]);  // 00401066
      d = OpCodes.Xor32(d, t);  // 0040106C
      t = m0;  // 0040106E
      m2 = a;  // 00401071
      b = OpCodes.Add32(b, t);  // 00401075
      t = OpCodes.Shl32(t, 8);  // 00401077
      e = OpCodes.Sub32(e, d);  // 0040107A
      c = OpCodes.Xor32(c, t);  // 0040107C
      t = e;  // 0040107E
      a = w[3];  // 00401080
      t = OpCodes.Shr32(t, 11);  // 00401083
      m2 = OpCodes.Sub32(m2, c);  // 00401086
      b = OpCodes.Xor32(b, t);  // 0040108A
      t = m2;  // 0040108C
      m0 = OpCodes.Add32(m0, e);  // 00401090
      e = OpCodes.Add32(e, t);  // 00401093
      t = OpCodes.Shl32(t, 3);  // 00401095
      a = OpCodes.Xor32(a, K[3]);  // 00401098
      m0 = OpCodes.Xor32(m0, t);  // 0040109E
      t = m0;  // 004010A1
      a = OpCodes.Sub32(a, b);  // 004010A4
      m1 = OpCodes.Sub32(m1, t);  // 004010A6
      t = a;  // 004010AA
      t = OpCodes.Shr32(t, 6);  // 004010AC
      e = OpCodes.Xor32(e, t);  // 004010AF
      t = m1;  // 004010B1
      m2 = OpCodes.Add32(m2, a);  // 004010B5
      a = OpCodes.Add32(a, t);  // 004010B9
      t = OpCodes.Shl32(t, 4);  // 004010BB
      d = OpCodes.Sub32(d, e);  // 004010BE
      m2 = OpCodes.Xor32(m2, t);  // 004010C0
      t = d;  // 004010C4
      t = OpCodes.Shr32(t, 13);  // 004010C6
      c = OpCodes.Sub32(c, m2);  // 004010C9
      a = OpCodes.Xor32(a, t);  // 004010CD
      t = c;  // 004010CF
      m1 = OpCodes.Add32(m1, d);  // 004010D1
      t = OpCodes.Shl32(t, 13);  // 004010D5
      m1 = OpCodes.Xor32(m1, t);  // 004010D8
      t = m1;  // 004010DC
      b = OpCodes.Sub32(b, a);  // 004010E0
      m0 = OpCodes.Sub32(m0, t);  // 004010E2
      t = b;  // 004010E5
      t = OpCodes.Shr32(t, 8);  // 004010E7
      d = OpCodes.Add32(d, c);  // 004010EA
      d = OpCodes.Xor32(d, t);  // 004010EC
      t = m0;  // 004010EE
      c = OpCodes.Add32(c, b);  // 004010F1
      b = OpCodes.Add32(b, t);  // 004010F3
      t = OpCodes.Shl32(t, 8);  // 004010F5
      e = OpCodes.Sub32(e, d);  // 004010F8
      c = OpCodes.Xor32(c, t);  // 004010FA
      t = e;  // 004010FC
      t = OpCodes.Shr32(t, 11);  // 004010FE
      m2 = OpCodes.Sub32(m2, c);  // 00401101
      b = OpCodes.Xor32(b, t);  // 00401105
      t = m2;  // 00401107
      m0 = OpCodes.Add32(m0, e);  // 0040110B
      e = OpCodes.Add32(e, t);  // 0040110E
      t = OpCodes.Shl32(t, 3);  // 00401110
      m0 = OpCodes.Xor32(m0, t);  // 00401113
      t = m0;  // 00401116
      a = OpCodes.Sub32(a, b);  // 00401119
      m1 = OpCodes.Sub32(m1, t);  // 0040111B
      t = a;  // 0040111F
      t = OpCodes.Shr32(t, 6);  // 00401121
      e = OpCodes.Xor32(e, t);  // 00401124
      t = m1;  // 00401126
      m2 = OpCodes.Add32(m2, a);  // 0040112A
      a = OpCodes.Add32(a, t);  // 0040112E
      t = OpCodes.Shl32(t, 4);  // 00401130
      d = OpCodes.Sub32(d, e);  // 00401133
      m2 = OpCodes.Xor32(m2, t);  // 00401135
      t = d;  // 00401139
      t = OpCodes.Shr32(t, 13);  // 0040113B
      c = OpCodes.Sub32(c, m2);  // 0040113E
      a = OpCodes.Xor32(a, t);  // 00401142
      t = c;  // 00401144
      m1 = OpCodes.Add32(m1, d);  // 00401146
      t = OpCodes.Shl32(t, 13);  // 0040114A
      m1 = OpCodes.Xor32(m1, t);  // 0040114D
      t = m1;  // 00401151
      b = OpCodes.Sub32(b, a);  // 00401155
      m0 = OpCodes.Sub32(m0, t);  // 00401157
      t = b;  // 0040115A
      t = OpCodes.Shr32(t, 8);  // 0040115C
      d = OpCodes.Add32(d, c);  // 0040115F
      d = OpCodes.Xor32(d, t);  // 00401161
      t = m0;  // 00401163
      c = OpCodes.Add32(c, b);  // 00401166
      b = OpCodes.Add32(b, t);  // 00401168
      t = OpCodes.Shl32(t, 8);  // 0040116A
      e = OpCodes.Sub32(e, d);  // 0040116D
      c = OpCodes.Xor32(c, t);  // 0040116F
      t = e;  // 00401171
      t = OpCodes.Shr32(t, 11);  // 00401173
      m2 = OpCodes.Sub32(m2, c);  // 00401176
      b = OpCodes.Xor32(b, t);  // 0040117A
      t = m2;  // 0040117C
      m0 = OpCodes.Add32(m0, e);  // 00401180
      e = OpCodes.Add32(e, t);  // 00401183
      t = OpCodes.Shl32(t, 3);  // 00401185
      m0 = OpCodes.Xor32(m0, t);  // 00401188
      t = m0;  // 0040118B
      a = OpCodes.Sub32(a, b);  // 0040118E
      m1 = OpCodes.Sub32(m1, t);  // 00401190
      t = a;  // 00401194
      t = OpCodes.Shr32(t, 6);  // 00401196
      e = OpCodes.Xor32(e, t);  // 00401199
      t = m1;  // 0040119B
      m2 = OpCodes.Add32(m2, a);  // 0040119F
      a = OpCodes.Add32(a, t);  // 004011A3
      t = OpCodes.Shl32(t, 4);  // 004011A5
      d = OpCodes.Sub32(d, e);  // 004011A8
      m2 = OpCodes.Xor32(m2, t);  // 004011AA
      t = d;  // 004011AE
      t = OpCodes.Shr32(t, 13);  // 004011B0
      c = OpCodes.Sub32(c, m2);  // 004011B3
      a = OpCodes.Xor32(a, t);  // 004011B7
      t = c;  // 004011B9
      m1 = OpCodes.Add32(m1, d);  // 004011BB
      t = OpCodes.Shl32(t, 13);  // 004011BF
      m1 = OpCodes.Xor32(m1, t);  // 004011C2
      t = m1;  // 004011C6
      b = OpCodes.Sub32(b, a);  // 004011CA
      m0 = OpCodes.Sub32(m0, t);  // 004011CC
      t = b;  // 004011CF
      t = OpCodes.Shr32(t, 8);  // 004011D1
      d = OpCodes.Add32(d, c);  // 004011D4
      d = OpCodes.Xor32(d, t);  // 004011D6
      t = m0;  // 004011D8
      c = OpCodes.Add32(c, b);  // 004011DB
      b = OpCodes.Add32(b, t);  // 004011DD
      t = OpCodes.Shl32(t, 8);  // 004011DF
      e = OpCodes.Sub32(e, d);  // 004011E2
      c = OpCodes.Xor32(c, t);  // 004011E4
      t = e;  // 004011E6
      t = OpCodes.Shr32(t, 11);  // 004011E8
      m2 = OpCodes.Sub32(m2, c);  // 004011EB
      b = OpCodes.Xor32(b, t);  // 004011EF
      t = m2;  // 004011F1
      m0 = OpCodes.Add32(m0, e);  // 004011F5
      e = OpCodes.Add32(e, t);  // 004011F8
      t = OpCodes.Shl32(t, 3);  // 004011FA
      m0 = OpCodes.Xor32(m0, t);  // 004011FD
      t = m0;  // 00401200
      a = OpCodes.Sub32(a, b);  // 00401203
      m1 = OpCodes.Sub32(m1, t);  // 00401205
      t = a;  // 00401209
      t = OpCodes.Shr32(t, 6);  // 0040120B
      e = OpCodes.Xor32(e, t);  // 0040120E
      t = m1;  // 00401210
      m2 = OpCodes.Add32(m2, a);  // 00401214
      a = OpCodes.Add32(a, t);  // 00401218
      t = OpCodes.Shl32(t, 4);  // 0040121A
      d = OpCodes.Sub32(d, e);  // 0040121D
      m2 = OpCodes.Xor32(m2, t);  // 0040121F
      t = d;  // 00401223
      t = OpCodes.Shr32(t, 13);  // 00401225
      c = OpCodes.Sub32(c, m2);  // 00401228
      a = OpCodes.Xor32(a, t);  // 0040122C
      t = c;  // 0040122E
      m1 = OpCodes.Add32(m1, d);  // 00401230
      t = OpCodes.Shl32(t, 13);  // 00401234
      m1 = OpCodes.Xor32(m1, t);  // 00401237
      t = m1;  // 0040123B
      b = OpCodes.Sub32(b, a);  // 0040123F
      m0 = OpCodes.Sub32(m0, t);  // 00401241
      t = b;  // 00401244
      t = OpCodes.Shr32(t, 8);  // 00401246
      d = OpCodes.Add32(d, c);  // 00401249
      d = OpCodes.Xor32(d, t);  // 0040124B
      t = m0;  // 0040124D
      c = OpCodes.Add32(c, b);  // 00401250
      b = OpCodes.Add32(b, t);  // 00401252
      t = OpCodes.Shl32(t, 8);  // 00401254
      e = OpCodes.Sub32(e, d);  // 00401257
      c = OpCodes.Xor32(c, t);  // 00401259
      t = e;  // 0040125B
      m0 = OpCodes.Add32(m0, e);  // 0040125D
      t = OpCodes.Shr32(t, 11);  // 00401260
      m2 = OpCodes.Sub32(m2, c);  // 00401263
      b = OpCodes.Xor32(b, t);  // 00401267
      t = m2;  // 00401269
      a = OpCodes.Sub32(a, b);  // 0040126D
      e = OpCodes.Add32(e, t);  // 0040126F
      t = OpCodes.Shl32(t, 3);  // 00401271
      m2 = OpCodes.Add32(m2, a);  // 00401274
      m0 = OpCodes.Xor32(m0, t);  // 00401278
      t = m0;  // 0040127B
      m1 = OpCodes.Sub32(m1, t);  // 0040127E
      t = a;  // 00401282
      t = OpCodes.Shr32(t, 6);  // 00401284
      e = OpCodes.Xor32(e, t);  // 00401287
      t = m1;  // 00401289
      a = OpCodes.Add32(a, t);  // 0040128D
      t = OpCodes.Shl32(t, 4);  // 0040128F
      d = OpCodes.Sub32(d, e);  // 00401292
      m2 = OpCodes.Xor32(m2, t);  // 00401294
      t = d;  // 00401298
      t = OpCodes.Shr32(t, 13);  // 0040129A
      c = OpCodes.Sub32(c, m2);  // 0040129D
      a = OpCodes.Xor32(a, t);  // 004012A1
      t = c;  // 004012A3
      m1 = OpCodes.Add32(m1, d);  // 004012A5
      t = OpCodes.Shl32(t, 13);  // 004012A9
      m1 = OpCodes.Xor32(m1, t);  // 004012AC
      t = m1;  // 004012B0
      b = OpCodes.Sub32(b, a);  // 004012B4
      m0 = OpCodes.Sub32(m0, t);  // 004012B6
      t = b;  // 004012B9
      t = OpCodes.Shr32(t, 8);  // 004012BB
      d = OpCodes.Add32(d, c);  // 004012BE
      d = OpCodes.Xor32(d, t);  // 004012C0
      t = m0;  // 004012C2
      c = OpCodes.Add32(c, b);  // 004012C5
      b = OpCodes.Add32(b, t);  // 004012C7
      t = OpCodes.Shl32(t, 8);  // 004012C9
      e = OpCodes.Sub32(e, d);  // 004012CC
      c = OpCodes.Xor32(c, t);  // 004012CE
      t = e;  // 004012D0
      t = OpCodes.Shr32(t, 11);  // 004012D2
      m2 = OpCodes.Sub32(m2, c);  // 004012D5
      b = OpCodes.Xor32(b, t);  // 004012D9
      t = m2;  // 004012DB
      m0 = OpCodes.Add32(m0, e);  // 004012DF
      e = OpCodes.Add32(e, t);  // 004012E2
      t = OpCodes.Shl32(t, 3);  // 004012E4
      m0 = OpCodes.Xor32(m0, t);  // 004012E7
      t = m0;  // 004012EA
      a = OpCodes.Sub32(a, b);  // 004012ED
      m1 = OpCodes.Sub32(m1, t);  // 004012EF
      t = a;  // 004012F3
      t = OpCodes.Shr32(t, 6);  // 004012F5
      e = OpCodes.Xor32(e, t);  // 004012F8
      t = m1;  // 004012FA
      m2 = OpCodes.Add32(m2, a);  // 004012FE
      a = OpCodes.Add32(a, t);  // 00401302
      t = OpCodes.Shl32(t, 4);  // 00401304
      d = OpCodes.Sub32(d, e);  // 00401307
      m2 = OpCodes.Xor32(m2, t);  // 00401309
      t = d;  // 0040130D
      t = OpCodes.Shr32(t, 13);  // 0040130F
      c = OpCodes.Sub32(c, m2);  // 00401312
      a = OpCodes.Xor32(a, t);  // 00401316
      t = c;  // 00401318
      m1 = OpCodes.Add32(m1, d);  // 0040131A
      t = OpCodes.Shl32(t, 13);  // 0040131E
      m1 = OpCodes.Xor32(m1, t);  // 00401321
      t = m1;  // 00401325
      b = OpCodes.Sub32(b, a);  // 00401329
      m0 = OpCodes.Sub32(m0, t);  // 0040132B
      t = b;  // 0040132E
      t = OpCodes.Shr32(t, 8);  // 00401330
      d = OpCodes.Add32(d, c);  // 00401333
      d = OpCodes.Xor32(d, t);  // 00401335
      t = m0;  // 00401337
      c = OpCodes.Add32(c, b);  // 0040133A
      b = OpCodes.Add32(b, t);  // 0040133C
      t = OpCodes.Shl32(t, 8);  // 0040133E
      e = OpCodes.Sub32(e, d);  // 00401341
      c = OpCodes.Xor32(c, t);  // 00401343
      t = e;  // 00401345
      t = OpCodes.Shr32(t, 11);  // 00401347
      m2 = OpCodes.Sub32(m2, c);  // 0040134A
      b = OpCodes.Xor32(b, t);  // 0040134E
      t = m2;  // 00401350
      m0 = OpCodes.Add32(m0, e);  // 00401354
      e = OpCodes.Add32(e, t);  // 00401357
      t = OpCodes.Shl32(t, 3);  // 00401359
      m0 = OpCodes.Xor32(m0, t);  // 0040135C
      t = m0;  // 0040135F
      a = OpCodes.Sub32(a, b);  // 00401362
      m1 = OpCodes.Sub32(m1, t);  // 00401364
      t = a;  // 00401368
      t = OpCodes.Shr32(t, 6);  // 0040136A
      m2 = OpCodes.Add32(m2, a);  // 0040136D
      e = OpCodes.Xor32(e, t);  // 00401371
      t = m1;  // 00401373
      d = OpCodes.Sub32(d, e);  // 00401377
      a = OpCodes.Add32(a, t);  // 00401379
      t = OpCodes.Shl32(t, 4);  // 0040137B
      m1 = OpCodes.Add32(m1, d);  // 0040137E
      m2 = OpCodes.Xor32(m2, t);  // 00401382
      t = d;  // 00401386
      c = OpCodes.Sub32(c, m2);  // 00401388
      t = OpCodes.Shr32(t, 13);  // 0040138C
      d = OpCodes.Add32(d, c);  // 0040138F
      a = OpCodes.Xor32(a, t);  // 00401391
      t = c;  // 00401393
      t = OpCodes.Shl32(t, 13);  // 00401395
      m1 = OpCodes.Xor32(m1, t);  // 00401398
      t = m1;  // 0040139C
      b = OpCodes.Sub32(b, a);  // 004013A0
      m0 = OpCodes.Sub32(m0, t);  // 004013A2
      t = b;  // 004013A5
      t = OpCodes.Shr32(t, 8);  // 004013A7
      d = OpCodes.Xor32(d, t);  // 004013AA
      t = m0;  // 004013AC
      c = OpCodes.Add32(c, b);  // 004013AF
      b = OpCodes.Add32(b, t);  // 004013B1
      t = OpCodes.Shl32(t, 8);  // 004013B3
      e = OpCodes.Sub32(e, d);  // 004013B6
      c = OpCodes.Xor32(c, t);  // 004013B8
      t = e;  // 004013BA
      t = OpCodes.Shr32(t, 11);  // 004013BC
      m2 = OpCodes.Sub32(m2, c);  // 004013BF
      b = OpCodes.Xor32(b, t);  // 004013C3
      t = m2;  // 004013C5
      m0 = OpCodes.Add32(m0, e);  // 004013C9
      e = OpCodes.Add32(e, t);  // 004013CC
      t = OpCodes.Shl32(t, 3);  // 004013CE
      m0 = OpCodes.Xor32(m0, t);  // 004013D1
      t = m0;  // 004013D4
      a = OpCodes.Sub32(a, b);  // 004013D7
      m1 = OpCodes.Sub32(m1, t);  // 004013D9
      t = a;  // 004013DD
      t = OpCodes.Shr32(t, 6);  // 004013DF
      e = OpCodes.Xor32(e, t);  // 004013E2
      t = m1;  // 004013E4
      m2 = OpCodes.Add32(m2, a);  // 004013E8
      a = OpCodes.Add32(a, t);  // 004013EC
      t = OpCodes.Shl32(t, 4);  // 004013EE
      d = OpCodes.Sub32(d, e);  // 004013F1
      m2 = OpCodes.Xor32(m2, t);  // 004013F3
      t = d;  // 004013F7
      t = OpCodes.Shr32(t, 13);  // 004013F9
      c = OpCodes.Sub32(c, m2);  // 004013FC
      a = OpCodes.Xor32(a, t);  // 00401400
      t = c;  // 00401402
      m1 = OpCodes.Add32(m1, d);  // 00401404
      t = OpCodes.Shl32(t, 13);  // 00401408
      m1 = OpCodes.Xor32(m1, t);  // 0040140B
      t = m1;  // 0040140F
      b = OpCodes.Sub32(b, a);  // 00401413
      m0 = OpCodes.Sub32(m0, t);  // 00401415
      t = b;  // 00401418
      t = OpCodes.Shr32(t, 8);  // 0040141A
      d = OpCodes.Add32(d, c);  // 0040141D
      d = OpCodes.Xor32(d, t);  // 0040141F
      t = m0;  // 00401421
      c = OpCodes.Add32(c, b);  // 00401424
      b = OpCodes.Add32(b, t);  // 00401426
      t = OpCodes.Shl32(t, 8);  // 00401428
      e = OpCodes.Sub32(e, d);  // 0040142B
      c = OpCodes.Xor32(c, t);  // 0040142D
      t = e;  // 0040142F
      t = OpCodes.Shr32(t, 11);  // 00401431
      m2 = OpCodes.Sub32(m2, c);  // 00401434
      b = OpCodes.Xor32(b, t);  // 00401438
      t = m2;  // 0040143A
      m0 = OpCodes.Add32(m0, e);  // 0040143E
      e = OpCodes.Add32(e, t);  // 00401441
      t = OpCodes.Shl32(t, 3);  // 00401443
      m0 = OpCodes.Xor32(m0, t);  // 00401446
      t = m0;  // 00401449
      a = OpCodes.Sub32(a, b);  // 0040144C
      m1 = OpCodes.Sub32(m1, t);  // 0040144E
      t = a;  // 00401452
      t = OpCodes.Shr32(t, 6);  // 00401454
      e = OpCodes.Xor32(e, t);  // 00401457
      t = m1;  // 00401459
      m2 = OpCodes.Add32(m2, a);  // 0040145D
      a = OpCodes.Add32(a, t);  // 00401461
      t = OpCodes.Shl32(t, 4);  // 00401463
      d = OpCodes.Sub32(d, e);  // 00401466
      m2 = OpCodes.Xor32(m2, t);  // 00401468
      t = d;  // 0040146C
      t = OpCodes.Shr32(t, 13);  // 0040146E
      c = OpCodes.Sub32(c, m2);  // 00401471
      a = OpCodes.Xor32(a, t);  // 00401475
      t = c;  // 00401477
      m1 = OpCodes.Add32(m1, d);  // 00401479
      t = OpCodes.Shl32(t, 13);  // 0040147D
      m1 = OpCodes.Xor32(m1, t);  // 00401480
      t = m1;  // 00401484
      b = OpCodes.Sub32(b, a);  // 00401488
      m0 = OpCodes.Sub32(m0, t);  // 0040148A
      t = b;  // 0040148D
      d = OpCodes.Add32(d, c);  // 0040148F
      t = OpCodes.Shr32(t, 8);  // 00401491
      c = OpCodes.Add32(c, b);  // 00401494
      d = OpCodes.Xor32(d, t);  // 00401496
      t = m0;  // 00401498
      e = OpCodes.Sub32(e, d);  // 0040149B
      b = OpCodes.Add32(b, t);  // 0040149D
      t = OpCodes.Shl32(t, 8);  // 0040149F
      m0 = OpCodes.Add32(m0, e);  // 004014A2
      c = OpCodes.Xor32(c, t);  // 004014A5
      t = e;  // 004014A7
      t = OpCodes.Shr32(t, 11);  // 004014A9
      m2 = OpCodes.Sub32(m2, c);  // 004014AC
      b = OpCodes.Xor32(b, t);  // 004014B0
      t = m2;  // 004014B2
      e = OpCodes.Add32(e, t);  // 004014B6
      t = OpCodes.Shl32(t, 3);  // 004014B8
      m0 = OpCodes.Xor32(m0, t);  // 004014BB
      t = m0;  // 004014BE
      a = OpCodes.Sub32(a, b);  // 004014C1
      m1 = OpCodes.Sub32(m1, t);  // 004014C3
      t = a;  // 004014C7
      t = OpCodes.Shr32(t, 6);  // 004014C9
      e = OpCodes.Xor32(e, t);  // 004014CC
      t = m1;  // 004014CE
      m2 = OpCodes.Add32(m2, a);  // 004014D2
      a = OpCodes.Add32(a, t);  // 004014D6
      t = OpCodes.Shl32(t, 4);  // 004014D8
      d = OpCodes.Sub32(d, e);  // 004014DB
      m2 = OpCodes.Xor32(m2, t);  // 004014DD
      t = d;  // 004014E1
      t = OpCodes.Shr32(t, 13);  // 004014E3
      c = OpCodes.Sub32(c, m2);  // 004014E6
      a = OpCodes.Xor32(a, t);  // 004014EA
      t = c;  // 004014EC
      m1 = OpCodes.Add32(m1, d);  // 004014EE
      t = OpCodes.Shl32(t, 13);  // 004014F2
      m1 = OpCodes.Xor32(m1, t);  // 004014F5
      t = m1;  // 004014F9
      b = OpCodes.Sub32(b, a);  // 004014FD
      m0 = OpCodes.Sub32(m0, t);  // 004014FF
      t = b;  // 00401502
      t = OpCodes.Shr32(t, 8);  // 00401504
      d = OpCodes.Add32(d, c);  // 00401507
      d = OpCodes.Xor32(d, t);  // 00401509
      t = m0;  // 0040150B
      c = OpCodes.Add32(c, b);  // 0040150E
      b = OpCodes.Add32(b, t);  // 00401510
      t = OpCodes.Shl32(t, 8);  // 00401512
      e = OpCodes.Sub32(e, d);  // 00401515
      c = OpCodes.Xor32(c, t);  // 00401517
      t = e;  // 00401519
      t = OpCodes.Shr32(t, 11);  // 0040151B
      m2 = OpCodes.Sub32(m2, c);  // 0040151E
      b = OpCodes.Xor32(b, t);  // 00401522
      t = m2;  // 00401524
      m0 = OpCodes.Add32(m0, e);  // 00401528
      e = OpCodes.Add32(e, t);  // 0040152B
      t = OpCodes.Shl32(t, 3);  // 0040152D
      m0 = OpCodes.Xor32(m0, t);  // 00401530
      t = m0;  // 00401533
      a = OpCodes.Sub32(a, b);  // 00401536
      m1 = OpCodes.Sub32(m1, t);  // 00401538
      t = a;  // 0040153C
      t = OpCodes.Shr32(t, 6);  // 0040153E
      e = OpCodes.Xor32(e, t);  // 00401541
      t = m1;  // 00401543
      m2 = OpCodes.Add32(m2, a);  // 00401547
      a = OpCodes.Add32(a, t);  // 0040154B
      t = OpCodes.Shl32(t, 4);  // 0040154D
      d = OpCodes.Sub32(d, e);  // 00401550
      m2 = OpCodes.Xor32(m2, t);  // 00401552
      t = d;  // 00401556
      t = OpCodes.Shr32(t, 13);  // 00401558
      c = OpCodes.Sub32(c, m2);  // 0040155B
      a = OpCodes.Xor32(a, t);  // 0040155F
      t = c;  // 00401561
      m1 = OpCodes.Add32(m1, d);  // 00401563
      t = OpCodes.Shl32(t, 13);  // 00401567
      m1 = OpCodes.Xor32(m1, t);  // 0040156A
      t = m1;  // 0040156E
      b = OpCodes.Sub32(b, a);  // 00401572
      m0 = OpCodes.Sub32(m0, t);  // 00401574
      t = b;  // 00401577
      t = OpCodes.Shr32(t, 8);  // 00401579
      d = OpCodes.Add32(d, c);  // 0040157C
      d = OpCodes.Xor32(d, t);  // 0040157E
      t = m0;  // 00401580
      c = OpCodes.Add32(c, b);  // 00401583
      b = OpCodes.Add32(b, t);  // 00401585
      t = OpCodes.Shl32(t, 8);  // 00401587
      e = OpCodes.Sub32(e, d);  // 0040158A
      c = OpCodes.Xor32(c, t);  // 0040158C
      t = e;  // 0040158E
      t = OpCodes.Shr32(t, 11);  // 00401590
      m2 = OpCodes.Sub32(m2, c);  // 00401593
      b = OpCodes.Xor32(b, t);  // 00401597
      t = m2;  // 00401599
      m0 = OpCodes.Add32(m0, e);  // 0040159D
      e = OpCodes.Add32(e, t);  // 004015A0
      t = OpCodes.Shl32(t, 3);  // 004015A2
      m0 = OpCodes.Xor32(m0, t);  // 004015A5
      t = m0;  // 004015A8
      a = OpCodes.Sub32(a, b);  // 004015AB
      m1 = OpCodes.Sub32(m1, t);  // 004015AD
      t = a;  // 004015B1
      t = OpCodes.Shr32(t, 6);  // 004015B3
      e = OpCodes.Xor32(e, t);  // 004015B6
      t = m1;  // 004015B8
      m2 = OpCodes.Add32(m2, a);  // 004015BC
      a = OpCodes.Add32(a, t);  // 004015C0
      t = OpCodes.Shl32(t, 4);  // 004015C2
      d = OpCodes.Sub32(d, e);  // 004015C5
      m2 = OpCodes.Xor32(m2, t);  // 004015C7
      t = d;  // 004015CB
      t = OpCodes.Shr32(t, 13);  // 004015CD
      c = OpCodes.Sub32(c, m2);  // 004015D0
      a = OpCodes.Xor32(a, t);  // 004015D4
      t = c;  // 004015D6
      t = OpCodes.Shl32(t, 13);  // 004015D8
      m1 = OpCodes.Add32(m1, d);  // 004015DB
      m1 = OpCodes.Xor32(m1, t);  // 004015DF
      t = K[8];  // 004015E3
      m3 = t;  // 004015E9
      t = m0;  // 004015ED
      t = OpCodes.Xor32(t, m3);  // 004015F0
      w[0] = t;  // 004015F4
      t = K[9];  // 004015F6
      d = OpCodes.Add32(d, c);  // 004015FC
      t = OpCodes.Xor32(t, e);  // 004015FE
      e = K[10];  // 00401600
      w[1] = t;  // 00401606
      t = m2;  // 00401609
      b = OpCodes.Sub32(b, a);  // 0040160D
      t = OpCodes.Xor32(t, e);  // 0040160F
      e = K[11];  // 00401611
      c = OpCodes.Add32(c, b);  // 00401617
      a = OpCodes.Xor32(a, e);  // 00401619
      e = m1;  // 0040161B
      w[3] = a;  // 0040161F
      a = K[12];  // 00401622
      w[2] = t;  // 00401627
      e = OpCodes.Xor32(e, a);  // 0040162A
      a = K[13];  // 0040162C
      w[4] = e;  // 00401631
      d = OpCodes.Xor32(d, a);  // 00401634
      a = K[14];  // 00401636
      w[5] = d;  // 0040163B
      c = OpCodes.Xor32(c, a);  // 0040163E
      a = K[15];  // 00401640
      w[6] = c;  // 00401645
      b = OpCodes.Xor32(b, a);  // 00401648
      w[7] = b;  // 0040164A

      const out = [];
      for (let i = 0; i < 8; i++) out.push(...OpCodes.Unpack32LE(w[i]));
      return out;
    }

    _decryptBlock(block) {
      const K = this._K;
      const w = new Array(8);
      for (let i = 0; i < 8; i++)
        w[i] = OpCodes.Pack32LE(block[4 * i], block[4 * i + 1], block[4 * i + 2], block[4 * i + 3]);

      let a, b, c, d, e, t, m0, m1, m2, m3;
      a = w[0];  // 0040166B
      d = w[4];  // 0040166D
      c = w[6];  // 00401670
      b = w[7];  // 00401673
      a = OpCodes.Xor32(a, K[8]);  // 00401676
      d = OpCodes.Xor32(d, K[12]);  // 0040167C
      c = OpCodes.Xor32(c, K[14]);  // 00401682
      b = OpCodes.Xor32(b, K[15]);  // 00401688
      m0 = a;  // 0040168E
      c = OpCodes.Sub32(c, b);  // 00401691
      m1 = d;  // 00401693
      t = c;  // 00401697
      a = w[2];  // 00401699
      d = w[5];  // 0040169C
      t = OpCodes.Shl32(t, 13);  // 0040169F
      a = OpCodes.Xor32(a, K[10]);  // 004016A2
      d = OpCodes.Xor32(d, K[13]);  // 004016A8
      m2 = a;  // 004016AE
      d = OpCodes.Sub32(d, c);  // 004016B2
      m1 = OpCodes.Xor32(m1, t);  // 004016B4
      t = d;  // 004016B8
      a = w[3];  // 004016BA
      t = OpCodes.Shr32(t, 13);  // 004016BD
      a = OpCodes.Xor32(a, K[11]);  // 004016C0
      b = OpCodes.Add32(b, a);  // 004016C6
      a = OpCodes.Xor32(a, t);  // 004016C8
      t = m1;  // 004016CA
      e = w[1];  // 004016CE
      t = OpCodes.Sub32(t, d);  // 004016D1
      c = OpCodes.Add32(c, m2);  // 004016D3
      m1 = t;  // 004016D7
      t = OpCodes.Shl32(t, 4);  // 004016DB
      a = OpCodes.Sub32(a, m1);  // 004016DE
      m2 = OpCodes.Xor32(m2, t);  // 004016E2
      t = a;  // 004016E6
      e = OpCodes.Xor32(e, K[9]);  // 004016E8
      t = OpCodes.Shr32(t, 6);  // 004016EE
      d = OpCodes.Add32(d, e);  // 004016F1
      e = OpCodes.Xor32(e, t);  // 004016F3
      t = m0;  // 004016F5
      m1 = OpCodes.Add32(m1, t);  // 004016F8
      t = m2;  // 004016FC
      t = OpCodes.Sub32(t, a);  // 00401700
      m2 = t;  // 00401702
      t = OpCodes.Shl32(t, 3);  // 00401706
      e = OpCodes.Sub32(e, m2);  // 00401709
      m0 = OpCodes.Xor32(m0, t);  // 0040170D
      t = e;  // 00401710
      t = OpCodes.Shr32(t, 11);  // 00401712
      a = OpCodes.Add32(a, b);  // 00401715
      b = OpCodes.Xor32(b, t);  // 00401717
      t = m0;  // 00401719
      t = OpCodes.Sub32(t, e);  // 0040171C
      m2 = OpCodes.Add32(m2, c);  // 0040171E
      m0 = t;  // 00401722
      t = OpCodes.Shl32(t, 8);  // 00401725
      b = OpCodes.Sub32(b, m0);  // 00401728
      c = OpCodes.Xor32(c, t);  // 0040172B
      t = b;  // 0040172D
      t = OpCodes.Shr32(t, 8);  // 0040172F
      e = OpCodes.Add32(e, d);  // 00401732
      d = OpCodes.Xor32(d, t);  // 00401734
      t = m1;  // 00401736
      c = OpCodes.Sub32(c, b);  // 0040173A
      m0 = OpCodes.Add32(m0, t);  // 0040173C
      t = c;  // 0040173F
      t = OpCodes.Shl32(t, 13);  // 00401741
      d = OpCodes.Sub32(d, c);  // 00401744
      m1 = OpCodes.Xor32(m1, t);  // 00401746
      t = d;  // 0040174A
      t = OpCodes.Shr32(t, 13);  // 0040174C
      b = OpCodes.Add32(b, a);  // 0040174F
      a = OpCodes.Xor32(a, t);  // 00401751
      t = m1;  // 00401753
      t = OpCodes.Sub32(t, d);  // 00401757
      c = OpCodes.Add32(c, m2);  // 00401759
      m1 = t;  // 0040175D
      t = OpCodes.Shl32(t, 4);  // 00401761
      a = OpCodes.Sub32(a, m1);  // 00401764
      m2 = OpCodes.Xor32(m2, t);  // 00401768
      t = a;  // 0040176C
      t = OpCodes.Shr32(t, 6);  // 0040176E
      d = OpCodes.Add32(d, e);  // 00401771
      e = OpCodes.Xor32(e, t);  // 00401773
      t = m0;  // 00401775
      m1 = OpCodes.Add32(m1, t);  // 00401778
      t = m2;  // 0040177C
      t = OpCodes.Sub32(t, a);  // 00401780
      m2 = t;  // 00401782
      t = OpCodes.Shl32(t, 3);  // 00401786
      e = OpCodes.Sub32(e, m2);  // 00401789
      m0 = OpCodes.Xor32(m0, t);  // 0040178D
      t = e;  // 00401790
      t = OpCodes.Shr32(t, 11);  // 00401792
      a = OpCodes.Add32(a, b);  // 00401795
      b = OpCodes.Xor32(b, t);  // 00401797
      t = m0;  // 00401799
      t = OpCodes.Sub32(t, e);  // 0040179C
      m2 = OpCodes.Add32(m2, c);  // 0040179E
      m0 = t;  // 004017A2
      t = OpCodes.Shl32(t, 8);  // 004017A5
      b = OpCodes.Sub32(b, m0);  // 004017A8
      c = OpCodes.Xor32(c, t);  // 004017AB
      t = b;  // 004017AD
      t = OpCodes.Shr32(t, 8);  // 004017AF
      e = OpCodes.Add32(e, d);  // 004017B2
      d = OpCodes.Xor32(d, t);  // 004017B4
      t = m1;  // 004017B6
      c = OpCodes.Sub32(c, b);  // 004017BA
      m0 = OpCodes.Add32(m0, t);  // 004017BC
      t = c;  // 004017BF
      t = OpCodes.Shl32(t, 13);  // 004017C1
      b = OpCodes.Add32(b, a);  // 004017C4
      m1 = OpCodes.Xor32(m1, t);  // 004017C6
      d = OpCodes.Sub32(d, c);  // 004017CA
      t = d;  // 004017CC
      t = OpCodes.Shr32(t, 13);  // 004017CE
      a = OpCodes.Xor32(a, t);  // 004017D1
      t = m1;  // 004017D3
      t = OpCodes.Sub32(t, d);  // 004017D7
      c = OpCodes.Add32(c, m2);  // 004017D9
      m1 = t;  // 004017DD
      t = OpCodes.Shl32(t, 4);  // 004017E1
      a = OpCodes.Sub32(a, m1);  // 004017E4
      m2 = OpCodes.Xor32(m2, t);  // 004017E8
      t = a;  // 004017EC
      t = OpCodes.Shr32(t, 6);  // 004017EE
      d = OpCodes.Add32(d, e);  // 004017F1
      e = OpCodes.Xor32(e, t);  // 004017F3
      t = m0;  // 004017F5
      m1 = OpCodes.Add32(m1, t);  // 004017F8
      t = m2;  // 004017FC
      t = OpCodes.Sub32(t, a);  // 00401800
      m2 = t;  // 00401802
      t = OpCodes.Shl32(t, 3);  // 00401806
      e = OpCodes.Sub32(e, m2);  // 00401809
      m0 = OpCodes.Xor32(m0, t);  // 0040180D
      t = e;  // 00401810
      t = OpCodes.Shr32(t, 11);  // 00401812
      a = OpCodes.Add32(a, b);  // 00401815
      b = OpCodes.Xor32(b, t);  // 00401817
      t = m0;  // 00401819
      t = OpCodes.Sub32(t, e);  // 0040181C
      m2 = OpCodes.Add32(m2, c);  // 0040181E
      m0 = t;  // 00401822
      t = OpCodes.Shl32(t, 8);  // 00401825
      b = OpCodes.Sub32(b, m0);  // 00401828
      c = OpCodes.Xor32(c, t);  // 0040182B
      t = b;  // 0040182D
      t = OpCodes.Shr32(t, 8);  // 0040182F
      e = OpCodes.Add32(e, d);  // 00401832
      d = OpCodes.Xor32(d, t);  // 00401834
      t = m1;  // 00401836
      c = OpCodes.Sub32(c, b);  // 0040183A
      m0 = OpCodes.Add32(m0, t);  // 0040183C
      t = c;  // 0040183F
      t = OpCodes.Shl32(t, 13);  // 00401841
      d = OpCodes.Sub32(d, c);  // 00401844
      m1 = OpCodes.Xor32(m1, t);  // 00401846
      t = d;  // 0040184A
      t = OpCodes.Shr32(t, 13);  // 0040184C
      b = OpCodes.Add32(b, a);  // 0040184F
      a = OpCodes.Xor32(a, t);  // 00401851
      t = m1;  // 00401853
      t = OpCodes.Sub32(t, d);  // 00401857
      c = OpCodes.Add32(c, m2);  // 00401859
      m1 = t;  // 0040185D
      t = OpCodes.Shl32(t, 4);  // 00401861
      a = OpCodes.Sub32(a, m1);  // 00401864
      m2 = OpCodes.Xor32(m2, t);  // 00401868
      t = a;  // 0040186C
      t = OpCodes.Shr32(t, 6);  // 0040186E
      d = OpCodes.Add32(d, e);  // 00401871
      e = OpCodes.Xor32(e, t);  // 00401873
      t = m0;  // 00401875
      m1 = OpCodes.Add32(m1, t);  // 00401878
      t = m2;  // 0040187C
      t = OpCodes.Sub32(t, a);  // 00401880
      m2 = t;  // 00401882
      t = OpCodes.Shl32(t, 3);  // 00401886
      e = OpCodes.Sub32(e, m2);  // 00401889
      m0 = OpCodes.Xor32(m0, t);  // 0040188D
      t = e;  // 00401890
      t = OpCodes.Shr32(t, 11);  // 00401892
      a = OpCodes.Add32(a, b);  // 00401895
      b = OpCodes.Xor32(b, t);  // 00401897
      t = m0;  // 00401899
      t = OpCodes.Sub32(t, e);  // 0040189C
      m2 = OpCodes.Add32(m2, c);  // 0040189E
      m0 = t;  // 004018A2
      t = OpCodes.Shl32(t, 8);  // 004018A5
      b = OpCodes.Sub32(b, m0);  // 004018A8
      c = OpCodes.Xor32(c, t);  // 004018AB
      t = b;  // 004018AD
      t = OpCodes.Shr32(t, 8);  // 004018AF
      e = OpCodes.Add32(e, d);  // 004018B2
      d = OpCodes.Xor32(d, t);  // 004018B4
      t = m1;  // 004018B6
      c = OpCodes.Sub32(c, b);  // 004018BA
      m0 = OpCodes.Add32(m0, t);  // 004018BC
      t = c;  // 004018BF
      t = OpCodes.Shl32(t, 13);  // 004018C1
      d = OpCodes.Sub32(d, c);  // 004018C4
      m1 = OpCodes.Xor32(m1, t);  // 004018C6
      t = d;  // 004018CA
      t = OpCodes.Shr32(t, 13);  // 004018CC
      b = OpCodes.Add32(b, a);  // 004018CF
      a = OpCodes.Xor32(a, t);  // 004018D1
      t = m1;  // 004018D3
      t = OpCodes.Sub32(t, d);  // 004018D7
      c = OpCodes.Add32(c, m2);  // 004018D9
      m1 = t;  // 004018DD
      t = OpCodes.Shl32(t, 4);  // 004018E1
      a = OpCodes.Sub32(a, m1);  // 004018E4
      m2 = OpCodes.Xor32(m2, t);  // 004018E8
      t = a;  // 004018EC
      t = OpCodes.Shr32(t, 6);  // 004018EE
      d = OpCodes.Add32(d, e);  // 004018F1
      e = OpCodes.Xor32(e, t);  // 004018F3
      t = m0;  // 004018F5
      m1 = OpCodes.Add32(m1, t);  // 004018F8
      t = m2;  // 004018FC
      t = OpCodes.Sub32(t, a);  // 00401900
      m2 = t;  // 00401902
      t = OpCodes.Shl32(t, 3);  // 00401906
      e = OpCodes.Sub32(e, m2);  // 00401909
      m0 = OpCodes.Xor32(m0, t);  // 0040190D
      t = e;  // 00401910
      t = OpCodes.Shr32(t, 11);  // 00401912
      a = OpCodes.Add32(a, b);  // 00401915
      b = OpCodes.Xor32(b, t);  // 00401917
      t = m0;  // 00401919
      t = OpCodes.Sub32(t, e);  // 0040191C
      m2 = OpCodes.Add32(m2, c);  // 0040191E
      m0 = t;  // 00401922
      t = OpCodes.Shl32(t, 8);  // 00401925
      b = OpCodes.Sub32(b, m0);  // 00401928
      c = OpCodes.Xor32(c, t);  // 0040192B
      t = b;  // 0040192D
      t = OpCodes.Shr32(t, 8);  // 0040192F
      e = OpCodes.Add32(e, d);  // 00401932
      d = OpCodes.Xor32(d, t);  // 00401934
      t = m1;  // 00401936
      c = OpCodes.Sub32(c, b);  // 0040193A
      m0 = OpCodes.Add32(m0, t);  // 0040193C
      t = c;  // 0040193F
      t = OpCodes.Shl32(t, 13);  // 00401941
      d = OpCodes.Sub32(d, c);  // 00401944
      m1 = OpCodes.Xor32(m1, t);  // 00401946
      t = d;  // 0040194A
      t = OpCodes.Shr32(t, 13);  // 0040194C
      b = OpCodes.Add32(b, a);  // 0040194F
      a = OpCodes.Xor32(a, t);  // 00401951
      t = m1;  // 00401953
      t = OpCodes.Sub32(t, d);  // 00401957
      c = OpCodes.Add32(c, m2);  // 00401959
      m1 = t;  // 0040195D
      t = OpCodes.Shl32(t, 4);  // 00401961
      a = OpCodes.Sub32(a, m1);  // 00401964
      m2 = OpCodes.Xor32(m2, t);  // 00401968
      t = a;  // 0040196C
      t = OpCodes.Shr32(t, 6);  // 0040196E
      d = OpCodes.Add32(d, e);  // 00401971
      e = OpCodes.Xor32(e, t);  // 00401973
      t = m0;  // 00401975
      m1 = OpCodes.Add32(m1, t);  // 00401978
      t = m2;  // 0040197C
      t = OpCodes.Sub32(t, a);  // 00401980
      m2 = t;  // 00401982
      t = OpCodes.Shl32(t, 3);  // 00401986
      e = OpCodes.Sub32(e, m2);  // 00401989
      m0 = OpCodes.Xor32(m0, t);  // 0040198D
      t = e;  // 00401990
      t = OpCodes.Shr32(t, 11);  // 00401992
      a = OpCodes.Add32(a, b);  // 00401995
      b = OpCodes.Xor32(b, t);  // 00401997
      t = m0;  // 00401999
      t = OpCodes.Sub32(t, e);  // 0040199C
      m2 = OpCodes.Add32(m2, c);  // 0040199E
      m0 = t;  // 004019A2
      t = OpCodes.Shl32(t, 8);  // 004019A5
      b = OpCodes.Sub32(b, m0);  // 004019A8
      c = OpCodes.Xor32(c, t);  // 004019AB
      t = b;  // 004019AD
      t = OpCodes.Shr32(t, 8);  // 004019AF
      e = OpCodes.Add32(e, d);  // 004019B2
      d = OpCodes.Xor32(d, t);  // 004019B4
      t = m1;  // 004019B6
      c = OpCodes.Sub32(c, b);  // 004019BA
      m0 = OpCodes.Add32(m0, t);  // 004019BC
      t = c;  // 004019BF
      t = OpCodes.Shl32(t, 13);  // 004019C1
      d = OpCodes.Sub32(d, c);  // 004019C4
      m1 = OpCodes.Xor32(m1, t);  // 004019C6
      t = d;  // 004019CA
      t = OpCodes.Shr32(t, 13);  // 004019CC
      b = OpCodes.Add32(b, a);  // 004019CF
      a = OpCodes.Xor32(a, t);  // 004019D1
      t = m1;  // 004019D3
      t = OpCodes.Sub32(t, d);  // 004019D7
      c = OpCodes.Add32(c, m2);  // 004019D9
      m1 = t;  // 004019DD
      t = OpCodes.Shl32(t, 4);  // 004019E1
      a = OpCodes.Sub32(a, m1);  // 004019E4
      m2 = OpCodes.Xor32(m2, t);  // 004019E8
      t = a;  // 004019EC
      t = OpCodes.Shr32(t, 6);  // 004019EE
      d = OpCodes.Add32(d, e);  // 004019F1
      e = OpCodes.Xor32(e, t);  // 004019F3
      t = m0;  // 004019F5
      m1 = OpCodes.Add32(m1, t);  // 004019F8
      t = m2;  // 004019FC
      t = OpCodes.Sub32(t, a);  // 00401A00
      m2 = t;  // 00401A02
      t = OpCodes.Shl32(t, 3);  // 00401A06
      e = OpCodes.Sub32(e, m2);  // 00401A09
      m0 = OpCodes.Xor32(m0, t);  // 00401A0D
      t = e;  // 00401A10
      t = OpCodes.Shr32(t, 11);  // 00401A12
      a = OpCodes.Add32(a, b);  // 00401A15
      b = OpCodes.Xor32(b, t);  // 00401A17
      t = m0;  // 00401A19
      t = OpCodes.Sub32(t, e);  // 00401A1C
      m2 = OpCodes.Add32(m2, c);  // 00401A1E
      m0 = t;  // 00401A22
      t = OpCodes.Shl32(t, 8);  // 00401A25
      e = OpCodes.Add32(e, d);  // 00401A28
      c = OpCodes.Xor32(c, t);  // 00401A2A
      b = OpCodes.Sub32(b, m0);  // 00401A2C
      t = b;  // 00401A2F
      t = OpCodes.Shr32(t, 8);  // 00401A31
      d = OpCodes.Xor32(d, t);  // 00401A34
      t = m1;  // 00401A36
      c = OpCodes.Sub32(c, b);  // 00401A3A
      m0 = OpCodes.Add32(m0, t);  // 00401A3C
      t = c;  // 00401A3F
      t = OpCodes.Shl32(t, 13);  // 00401A41
      d = OpCodes.Sub32(d, c);  // 00401A44
      m1 = OpCodes.Xor32(m1, t);  // 00401A46
      t = d;  // 00401A4A
      t = OpCodes.Shr32(t, 13);  // 00401A4C
      b = OpCodes.Add32(b, a);  // 00401A4F
      a = OpCodes.Xor32(a, t);  // 00401A51
      t = m1;  // 00401A53
      t = OpCodes.Sub32(t, d);  // 00401A57
      c = OpCodes.Add32(c, m2);  // 00401A59
      m1 = t;  // 00401A5D
      t = OpCodes.Shl32(t, 4);  // 00401A61
      a = OpCodes.Sub32(a, m1);  // 00401A64
      m2 = OpCodes.Xor32(m2, t);  // 00401A68
      t = a;  // 00401A6C
      t = OpCodes.Shr32(t, 6);  // 00401A6E
      d = OpCodes.Add32(d, e);  // 00401A71
      e = OpCodes.Xor32(e, t);  // 00401A73
      t = m0;  // 00401A75
      m1 = OpCodes.Add32(m1, t);  // 00401A78
      t = m2;  // 00401A7C
      t = OpCodes.Sub32(t, a);  // 00401A80
      m2 = t;  // 00401A82
      t = OpCodes.Shl32(t, 3);  // 00401A86
      e = OpCodes.Sub32(e, m2);  // 00401A89
      m0 = OpCodes.Xor32(m0, t);  // 00401A8D
      t = e;  // 00401A90
      t = OpCodes.Shr32(t, 11);  // 00401A92
      a = OpCodes.Add32(a, b);  // 00401A95
      b = OpCodes.Xor32(b, t);  // 00401A97
      t = m0;  // 00401A99
      t = OpCodes.Sub32(t, e);  // 00401A9C
      m2 = OpCodes.Add32(m2, c);  // 00401A9E
      m0 = t;  // 00401AA2
      t = OpCodes.Shl32(t, 8);  // 00401AA5
      b = OpCodes.Sub32(b, m0);  // 00401AA8
      c = OpCodes.Xor32(c, t);  // 00401AAB
      t = b;  // 00401AAD
      t = OpCodes.Shr32(t, 8);  // 00401AAF
      e = OpCodes.Add32(e, d);  // 00401AB2
      d = OpCodes.Xor32(d, t);  // 00401AB4
      t = m1;  // 00401AB6
      c = OpCodes.Sub32(c, b);  // 00401ABA
      m0 = OpCodes.Add32(m0, t);  // 00401ABC
      t = c;  // 00401ABF
      t = OpCodes.Shl32(t, 13);  // 00401AC1
      d = OpCodes.Sub32(d, c);  // 00401AC4
      m1 = OpCodes.Xor32(m1, t);  // 00401AC6
      t = d;  // 00401ACA
      t = OpCodes.Shr32(t, 13);  // 00401ACC
      b = OpCodes.Add32(b, a);  // 00401ACF
      a = OpCodes.Xor32(a, t);  // 00401AD1
      t = m1;  // 00401AD3
      t = OpCodes.Sub32(t, d);  // 00401AD7
      c = OpCodes.Add32(c, m2);  // 00401AD9
      m1 = t;  // 00401ADD
      t = OpCodes.Shl32(t, 4);  // 00401AE1
      a = OpCodes.Sub32(a, m1);  // 00401AE4
      m2 = OpCodes.Xor32(m2, t);  // 00401AE8
      t = a;  // 00401AEC
      t = OpCodes.Shr32(t, 6);  // 00401AEE
      d = OpCodes.Add32(d, e);  // 00401AF1
      e = OpCodes.Xor32(e, t);  // 00401AF3
      t = m0;  // 00401AF5
      m1 = OpCodes.Add32(m1, t);  // 00401AF8
      t = m2;  // 00401AFC
      t = OpCodes.Sub32(t, a);  // 00401B00
      m2 = t;  // 00401B02
      t = OpCodes.Shl32(t, 3);  // 00401B06
      e = OpCodes.Sub32(e, m2);  // 00401B09
      m0 = OpCodes.Xor32(m0, t);  // 00401B0D
      t = e;  // 00401B10
      t = OpCodes.Shr32(t, 11);  // 00401B12
      a = OpCodes.Add32(a, b);  // 00401B15
      b = OpCodes.Xor32(b, t);  // 00401B17
      t = m0;  // 00401B19
      t = OpCodes.Sub32(t, e);  // 00401B1C
      m2 = OpCodes.Add32(m2, c);  // 00401B1E
      m0 = t;  // 00401B22
      t = OpCodes.Shl32(t, 8);  // 00401B25
      b = OpCodes.Sub32(b, m0);  // 00401B28
      c = OpCodes.Xor32(c, t);  // 00401B2B
      t = b;  // 00401B2D
      t = OpCodes.Shr32(t, 8);  // 00401B2F
      e = OpCodes.Add32(e, d);  // 00401B32
      d = OpCodes.Xor32(d, t);  // 00401B34
      t = m1;  // 00401B36
      c = OpCodes.Sub32(c, b);  // 00401B3A
      m0 = OpCodes.Add32(m0, t);  // 00401B3C
      t = c;  // 00401B3F
      t = OpCodes.Shl32(t, 13);  // 00401B41
      d = OpCodes.Sub32(d, c);  // 00401B44
      m1 = OpCodes.Xor32(m1, t);  // 00401B46
      t = d;  // 00401B4A
      b = OpCodes.Add32(b, a);  // 00401B4C
      t = OpCodes.Shr32(t, 13);  // 00401B4E
      c = OpCodes.Add32(c, m2);  // 00401B51
      a = OpCodes.Xor32(a, t);  // 00401B55
      t = m1;  // 00401B57
      t = OpCodes.Sub32(t, d);  // 00401B5B
      m1 = t;  // 00401B5D
      t = OpCodes.Shl32(t, 4);  // 00401B61
      a = OpCodes.Sub32(a, m1);  // 00401B64
      m2 = OpCodes.Xor32(m2, t);  // 00401B68
      t = a;  // 00401B6C
      t = OpCodes.Shr32(t, 6);  // 00401B6E
      d = OpCodes.Add32(d, e);  // 00401B71
      e = OpCodes.Xor32(e, t);  // 00401B73
      t = m0;  // 00401B75
      m1 = OpCodes.Add32(m1, t);  // 00401B78
      t = m2;  // 00401B7C
      t = OpCodes.Sub32(t, a);  // 00401B80
      m2 = t;  // 00401B82
      t = OpCodes.Shl32(t, 3);  // 00401B86
      e = OpCodes.Sub32(e, m2);  // 00401B89
      m0 = OpCodes.Xor32(m0, t);  // 00401B8D
      t = e;  // 00401B90
      t = OpCodes.Shr32(t, 11);  // 00401B92
      a = OpCodes.Add32(a, b);  // 00401B95
      b = OpCodes.Xor32(b, t);  // 00401B97
      t = m0;  // 00401B99
      t = OpCodes.Sub32(t, e);  // 00401B9C
      m2 = OpCodes.Add32(m2, c);  // 00401B9E
      m0 = t;  // 00401BA2
      t = OpCodes.Shl32(t, 8);  // 00401BA5
      b = OpCodes.Sub32(b, m0);  // 00401BA8
      c = OpCodes.Xor32(c, t);  // 00401BAB
      t = b;  // 00401BAD
      t = OpCodes.Shr32(t, 8);  // 00401BAF
      e = OpCodes.Add32(e, d);  // 00401BB2
      d = OpCodes.Xor32(d, t);  // 00401BB4
      t = m1;  // 00401BB6
      c = OpCodes.Sub32(c, b);  // 00401BBA
      m0 = OpCodes.Add32(m0, t);  // 00401BBC
      t = c;  // 00401BBF
      t = OpCodes.Shl32(t, 13);  // 00401BC1
      d = OpCodes.Sub32(d, c);  // 00401BC4
      m1 = OpCodes.Xor32(m1, t);  // 00401BC6
      t = d;  // 00401BCA
      t = OpCodes.Shr32(t, 13);  // 00401BCC
      b = OpCodes.Add32(b, a);  // 00401BCF
      a = OpCodes.Xor32(a, t);  // 00401BD1
      t = m1;  // 00401BD3
      t = OpCodes.Sub32(t, d);  // 00401BD7
      c = OpCodes.Add32(c, m2);  // 00401BD9
      m1 = t;  // 00401BDD
      t = OpCodes.Shl32(t, 4);  // 00401BE1
      a = OpCodes.Sub32(a, m1);  // 00401BE4
      m2 = OpCodes.Xor32(m2, t);  // 00401BE8
      t = a;  // 00401BEC
      t = OpCodes.Shr32(t, 6);  // 00401BEE
      d = OpCodes.Add32(d, e);  // 00401BF1
      e = OpCodes.Xor32(e, t);  // 00401BF3
      t = m0;  // 00401BF5
      m1 = OpCodes.Add32(m1, t);  // 00401BF8
      t = m2;  // 00401BFC
      t = OpCodes.Sub32(t, a);  // 00401C00
      m2 = t;  // 00401C02
      t = OpCodes.Shl32(t, 3);  // 00401C06
      e = OpCodes.Sub32(e, m2);  // 00401C09
      m0 = OpCodes.Xor32(m0, t);  // 00401C0D
      t = e;  // 00401C10
      t = OpCodes.Shr32(t, 11);  // 00401C12
      a = OpCodes.Add32(a, b);  // 00401C15
      b = OpCodes.Xor32(b, t);  // 00401C17
      t = m0;  // 00401C19
      t = OpCodes.Sub32(t, e);  // 00401C1C
      m2 = OpCodes.Add32(m2, c);  // 00401C1E
      m0 = t;  // 00401C22
      t = OpCodes.Shl32(t, 8);  // 00401C25
      b = OpCodes.Sub32(b, m0);  // 00401C28
      c = OpCodes.Xor32(c, t);  // 00401C2B
      t = b;  // 00401C2D
      t = OpCodes.Shr32(t, 8);  // 00401C2F
      e = OpCodes.Add32(e, d);  // 00401C32
      d = OpCodes.Xor32(d, t);  // 00401C34
      t = m1;  // 00401C36
      c = OpCodes.Sub32(c, b);  // 00401C3A
      m0 = OpCodes.Add32(m0, t);  // 00401C3C
      t = c;  // 00401C3F
      t = OpCodes.Shl32(t, 13);  // 00401C41
      d = OpCodes.Sub32(d, c);  // 00401C44
      m1 = OpCodes.Xor32(m1, t);  // 00401C46
      t = d;  // 00401C4A
      t = OpCodes.Shr32(t, 13);  // 00401C4C
      b = OpCodes.Add32(b, a);  // 00401C4F
      a = OpCodes.Xor32(a, t);  // 00401C51
      t = m1;  // 00401C53
      t = OpCodes.Sub32(t, d);  // 00401C57
      c = OpCodes.Add32(c, m2);  // 00401C59
      m1 = t;  // 00401C5D
      t = OpCodes.Shl32(t, 4);  // 00401C61
      a = OpCodes.Sub32(a, m1);  // 00401C64
      m2 = OpCodes.Xor32(m2, t);  // 00401C68
      t = a;  // 00401C6C
      t = OpCodes.Shr32(t, 6);  // 00401C6E
      d = OpCodes.Add32(d, e);  // 00401C71
      e = OpCodes.Xor32(e, t);  // 00401C73
      t = m0;  // 00401C75
      m1 = OpCodes.Add32(m1, t);  // 00401C78
      t = m2;  // 00401C7C
      t = OpCodes.Sub32(t, a);  // 00401C80
      m2 = t;  // 00401C82
      t = OpCodes.Shl32(t, 3);  // 00401C86
      a = OpCodes.Add32(a, b);  // 00401C89
      m0 = OpCodes.Xor32(m0, t);  // 00401C8B
      e = OpCodes.Sub32(e, m2);  // 00401C8E
      t = e;  // 00401C92
      t = OpCodes.Shr32(t, 11);  // 00401C94
      b = OpCodes.Xor32(b, t);  // 00401C97
      t = m0;  // 00401C99
      t = OpCodes.Sub32(t, e);  // 00401C9C
      m2 = OpCodes.Add32(m2, c);  // 00401C9E
      m0 = t;  // 00401CA2
      t = OpCodes.Shl32(t, 8);  // 00401CA5
      b = OpCodes.Sub32(b, m0);  // 00401CA8
      c = OpCodes.Xor32(c, t);  // 00401CAB
      t = b;  // 00401CAD
      t = OpCodes.Shr32(t, 8);  // 00401CAF
      e = OpCodes.Add32(e, d);  // 00401CB2
      d = OpCodes.Xor32(d, t);  // 00401CB4
      t = m1;  // 00401CB6
      m0 = OpCodes.Add32(m0, t);  // 00401CBA
      t = K[0];  // 00401CBD
      m3 = t;  // 00401CC3
      t = m0;  // 00401CC7
      t = OpCodes.Xor32(t, m3);  // 00401CCA
      w[0] = t;  // 00401CCE
      t = K[1];  // 00401CD0
      t = OpCodes.Xor32(t, e);  // 00401CD6
      e = K[2];  // 00401CD8
      w[1] = t;  // 00401CDE
      t = m2;  // 00401CE1
      t = OpCodes.Xor32(t, e);  // 00401CE5
      e = K[3];  // 00401CE7
      a = OpCodes.Xor32(a, e);  // 00401CED
      e = m1;  // 00401CEF
      w[3] = a;  // 00401CF3
      a = K[4];  // 00401CF6
      w[2] = t;  // 00401CFB
      e = OpCodes.Xor32(e, a);  // 00401CFE
      a = K[5];  // 00401D00
      w[4] = e;  // 00401D05
      d = OpCodes.Xor32(d, a);  // 00401D08
      a = K[6];  // 00401D0A
      w[5] = d;  // 00401D0F
      c = OpCodes.Xor32(c, a);  // 00401D12
      a = K[7];  // 00401D14
      w[6] = c;  // 00401D19
      b = OpCodes.Xor32(b, a);  // 00401D1C
      w[7] = b;  // 00401D1E

      const out = [];
      for (let i = 0; i < 8; i++) out.push(...OpCodes.Unpack32LE(w[i]));
      return out;
    }
  }

  const algorithmInstance = new DarkCryptBJ256Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptBJ256Algorithm, DarkCryptBJ256Instance };
}));
