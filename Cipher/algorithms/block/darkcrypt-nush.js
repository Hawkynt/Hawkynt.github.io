/*
 * NUSH (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * NUSH is a block cipher family invented by Anatoly Lebedev and Alexey Volchkov for
 * LAN Crypto, Int., submitted to the NESSIE project in 2000 ("NUSH Block", NESSIE
 * submission). It supports block sizes of 64/128/256 bits (n=16/32/64-bit words) and
 * key sizes of 128/192/256 bits, with round counts 9/17/33 respectively for the three
 * block sizes. It uses no s-boxes - only XOR, modular addition, bitwise AND/OR, and
 * fixed per-round bit rotations, with per-round constants and a per-round choice of
 * AND or OR in its core mixing function R. NUSH was not selected for the NESSIE
 * portfolio (linear cryptanalysis was shown to beat brute force).
 *
 * This implementation is the 128-bit block / 256-bit key variant (n=32, l=17 rounds,
 * L=68 applications of R). The DarkCrypt Total Commander plugin (Alexander Myasnikov,
 * "Zarya" project) implements this variant with all internal 32-bit words (key and
 * block) interpreted big-endian; parameters (round constants, rotation amounts, key
 * schedule, AND/OR selection table) are cross-verified against the original NESSIE
 * submission document ("NUSH Block", LAN Crypto, 2000) and match its published
 * Appendix tables for N=128 byte-for-byte.
 *
 * 128-bit blocks, 256-bit keys. Educational only.
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

  const ROUNDS = 68; // L = 68 applications of R for the 128-bit-block variant (l=17)

  // Per-round additive constants C[0..67] (n=32 case), from the NESSIE submission
  // "NUSH Block" Appendix tables, byte-identical to the constant table used by the
  // DarkCrypt implementation.
  const C = Object.freeze([
    0x9b28a37b,0x9de5b521,0x0b8ee0d7,0x672aa715,0x0e356c9f,0xbf54692a,0xdc9e15c8,0x06d736e8,
    0x9263e8cf,0x1fcd682d,0x7368b074,0x2654f15a,0x00eb3e4d,0x18d62f6d,0x632a557a,0x1d953d21,
    0xcd4b2acd,0x49a0d3f4,0xc443f6cc,0xe84c5bcb,0xf750a732,0x2cde9942,0x370c437a,0xda8b5654,
    0x99a76750,0xa1559437,0x9ea46718,0x83e984f8,0xab5692e4,0xa6c5c46a,0x25fb110e,0x55955b2e,
    0xfa639063,0x027e4dc6,0x919e96b2,0x62e96d0c,0xaa7de138,0xa674a66c,0xb3f54983,0xae29d0db,
    0x599470cb,0x3b2e3fa0,0xa354cc6f,0x516af8c4,0xade11d33,0x860d95f2,0xbc2731a4,0xccd12baa,
    0xba518e95,0x22f7583a,0x6c0a5fe8,0x8fac2d74,0xd129e934,0x11dce4c9,0x362f2f4a,0x6ccb630d,
    0x97919d88,0x823f95ac,0x67c99a98,0x8e91d0cb,0xab796817,0x356459a7,0x668d9fa8,0x0d4dbf40,
    0x1acce5d8,0xf53b24c1,0x6db89876,0x5c965da5
  ]);

  // Per-round rotation amounts S[0..67] (n=32 case), same source as C[].
  const S = Object.freeze([
    7,5,15,14,3,30,4,23,13,12,26,16,9,28,8,18,
    23,8,26,4,29,16,2,22,23,11,26,13,20,5,28,17,
    19,22,6,25,12,24,27,10,16,24,9,13,5,10,26,30,
    9,16,28,24,27,6,7,15,1,13,15,1,23,28,12,2,
    28,14,15,12
  ]);

  // Per-round choice of AND ('&') vs OR ('|') for the R-function's combining step,
  // cyclic with period 64 (round i uses OP4[i mod 64]); from the NESSIE submission's
  // "Choice of the operation (4)" table.
  const OP4 = Object.freeze([
    '&','|','&','|','|','|','|','|', '&','|','|','&','|','&','|','|',
    '|','|','&','&','&','&','&','|', '&','|','|','|','&','|','&','&',
    '|','|','&','|','|','&','|','&', '|','&','&','|','|','&','&','&',
    '&','&','&','&','&','&','|','&', '|','|','|','&','&','&','|','|'
  ]);

  function combine(op, x, y) { return op === '&' ? OpCodes.And32(x, y) : OpCodes.Or32(x, y); }
  function add32(a, b) { return OpCodes.ToUint32(a + b); }
  function sub32(a, b) { return OpCodes.ToUint32(a - b); }

  // R-function (NESSIE submission spec, section "operations in the main body"):
  //   c1 = (c ^ k); c1 = c1 + b; c1 = ROTR(c1, s); a1 = a + combine(c1, d)
  //   b1 = b; d1 = d
  function R(a, b, c, d, k, s, op) {
    let c1 = OpCodes.Xor32(c, k);
    c1 = add32(c1, b);
    c1 = OpCodes.RotR32(c1, s);
    const a1 = add32(a, combine(op, c1, d));
    return [a1, b, c1, d];
  }

  // Inverse of R: given the R-function's output (a1,b,c1,d), recover (a,b,c,d).
  function RInverse(a1, b, c1, d, k, s, op) {
    const a = sub32(a1, combine(op, c1, d));
    let c = OpCodes.RotL32(c1, s);
    c = sub32(c, b);
    c = OpCodes.Xor32(c, k);
    return [a, b, c, d];
  }

  // Key schedule for the 256-bit key / 128-bit block variant (NESSIE spec section
  // "3.2 N=128 (n=32)"): K is 8 big-endian 32-bit words from the 32-byte key.
  //   KS[0..3] = K[4],K[5],K[6],K[7]     (initial whitening)
  //   KF[0..3] = K[5],K[4],K[7],K[6]     (final whitening)
  //   KR[i]    = K[i mod 8], i=0..67; KRC[i] = KR[i] + C[i] (precomputed)
  function generateKeys(key32) {
    const K = new Array(8);
    for (let i = 0; i < 8; i++)
      K[i] = OpCodes.Pack32BE(key32[i*4], key32[i*4+1], key32[i*4+2], key32[i*4+3]);

    const KS = [K[4], K[5], K[6], K[7]];
    const KF = [K[5], K[4], K[7], K[6]];
    const KRC = new Array(ROUNDS);
    for (let i = 0; i < ROUNDS; i++) KRC[i] = add32(K[i % 8], C[i]);
    return { KS: KS, KF: KF, KRC: KRC };
  }

  function wordsFromBlock(block16) {
    return [
      OpCodes.Pack32BE(block16[0], block16[1], block16[2], block16[3]),
      OpCodes.Pack32BE(block16[4], block16[5], block16[6], block16[7]),
      OpCodes.Pack32BE(block16[8], block16[9], block16[10], block16[11]),
      OpCodes.Pack32BE(block16[12], block16[13], block16[14], block16[15])
    ];
  }

  function blockFromWords(words) {
    const out = [];
    for (let i = 0; i < 4; i++) out.push(...OpCodes.Unpack32BE(words[i]));
    return out;
  }

  // Encryption: initial XOR-whitening (KS), 68 applications of R with the registers
  // cyclically rotated (a,b,c,d)->(b,c,d,a) each round (this is an exact multiple of
  // 4, so the roles return to (a,b,c,d) after all rounds), then final XOR-whitening (KF).
  function encryptBlock(block16, keys) {
    let w = wordsFromBlock(block16);
    for (let i = 0; i < 4; i++) w[i] = OpCodes.Xor32(w[i], keys.KS[i]);

    let regs = w;
    for (let i = 0; i < ROUNDS; i++) {
      const op = OP4[i % 64];
      const out = R(regs[0], regs[1], regs[2], regs[3], keys.KRC[i], S[i], op);
      regs = [out[1], out[2], out[3], out[0]];
    }

    for (let i = 0; i < 4; i++) regs[i] = OpCodes.Xor32(regs[i], keys.KF[i]);
    return blockFromWords(regs);
  }

  // Decryption mirrors encryption: undo final whitening (KF), invert each R
  // application in reverse round order (with the same cyclic register mapping run
  // backwards), then undo initial whitening (KS).
  function decryptBlock(block16, keys) {
    let w = wordsFromBlock(block16);
    for (let i = 0; i < 4; i++) w[i] = OpCodes.Xor32(w[i], keys.KF[i]);

    let regs = w;
    for (let i = ROUNDS - 1; i >= 0; i--) {
      const op = OP4[i % 64];
      const b1 = regs[0], c1 = regs[1], d1 = regs[2], a1 = regs[3];
      regs = RInverse(a1, b1, c1, d1, keys.KRC[i], S[i], op);
    }

    for (let i = 0; i < 4; i++) regs[i] = OpCodes.Xor32(regs[i], keys.KS[i]);
    return blockFromWords(regs);
  }

  class DarkCryptNushAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "NUSH (DarkCrypt)";
      this.description = "NUSH block cipher (128-bit block / 256-bit key variant), a NESSIE submission by LAN Crypto (Lebedev, Volchkov) using only XOR/AND/OR/modular addition/rotation - no s-boxes. 17 rounds of a 4-branch mixing function R with per-round constants and rotation amounts. Not selected for the NESSIE portfolio due to a low security margin. The DarkCrypt Total Commander plugin implements this variant with big-endian internal word interpretation.";
      this.inventor = "Anatoly N. Lebedev, Alexey A. Volchkov (LAN Crypto, Int.)";
      this.year = 2000;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("NUSH Block (NESSIE submission, LAN Crypto, 2000)", "https://web.archive.org/web/20060621194846/http://www.cosic.esat.kuleuven.ac.be:80/nessie/workshop/submissions/nush.zip"),
        new LinkItem("NUSH - Wikipedia", "https://en.wikipedia.org/wiki/NUSH"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Low security margin / linear cryptanalysis", "NESSIE's Phase I evaluation found NUSH has an extremely low security margin; linear cryptanalysis breaks it with less effort than brute force.", "Use AES or another vetted, standardized cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Nush — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("79c6fedb903b010644e23280095061d9")
        },
        {
          text: "DarkCrypt Nush — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("17bcdf28c0ee54496accadbae6e98c80")
        },
        {
          text: "DarkCrypt Nush — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("08ed2ed5860dba64fa983c15939a7538")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptNushInstance(this, isInverse);
    }
  }

  class DarkCryptNushInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._keys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._keys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. NUSH (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._keys = generateKeys(this._key);
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
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? decryptBlock(block, this._keys) : encryptBlock(block, this._keys)));
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptNushAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptNushAlgorithm, DarkCryptNushInstance };
}));
