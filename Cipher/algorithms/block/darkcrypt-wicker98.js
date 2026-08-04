/*
 * Wicker-98 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Wicker-98 as implemented in the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project). 128-bit block, 128-bit key, 35-round unbalanced
 * ARX network operating on four 32-bit words (big-endian packed from the block
 * bytes). Each round advances a rotating accumulator and folds it into one of
 * the four words (add/xor target, and/or combine, add/xor pre-rotate mix),
 * cycling the target word every four rounds; a final whitening step applies
 * four more key words, one of which itself performs an extra AND-combine.
 *
 * The encryption routine below reconstructs the round structure directly
 * (verified bit-exact against the DarkCrypt implementation). The decryption
 * routine is implemented as its own separate routine (register-for-register)
 * because its data flow fuses two rounds' worth of work at the very first
 * and last steps in a way that does not reduce to the clean per-round
 * formula used for encryption; it is kept in this more verbose form rather
 * than rewritten into an unverified "clean" form. Test vectors generated
 * from the DarkCrypt implementation (crypt/decrypt round-trip verified).
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
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const ROUNDS = 35;

  // Per-round tables for the encryption round function (indices 0..34).
  // targetOp/combineOp/opP/opS use '+'=ADD, '^'=XOR, '&'=AND, '|'=OR.
  const TARGET_OP = (function () {
    const period = ['+', '+', '+', '+', '^', '^', '^'];
    const out = [];
    for (let r = 0; r < ROUNDS; r++) out.push(period[r % 7]);
    return out;
  })();
  const COMBINE_OP = ['&','&','&','&','&','|','|','&','|','&','&','|','&','|','&','|','|','|','|','|','|','|','&','&','|','&','|','&','&','&','|','|','&','&','&'];
  const OP_P = ['^','+','^','+','^','+','+','^','+','^','+','^','+','+','^','+','^','+','^','+','+','^','+','^','+','^','+','+','^','+','^','+','^','+','+'];
  const OP_S = ['+','^','^','+','+','^','+','+','^','^','+','+','^','+','+','^','^','+','+','^','+','+','^','^','+','+','^','+','+','^','^','+','+','^','+'];
  const ROT = [2,4,8,16,21,6,12,24,16,11,10,20,8,16,25,14,28,24,16,19,22,12,24,16,27,26,20,8,16,25,18,4,8,16,1];
  // Target word cycles A,B,C,D (stored at these four "slot" indices) every 4 rounds.
  const CYCLE = [8, 4, 0, 12];

  class DarkCryptWicker98Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Wicker-98 (DarkCrypt)";
      this.description = "Wicker-98 block cipher from the DarkCrypt Total Commander plugin: 35-round unbalanced ARX network on four 32-bit words with a rotating accumulator folded into a cycling target word, plus 4-word key whitening. 128-bit block, 128-bit key.";
      this.inventor = "Unknown (DarkCrypt plugin by Alexander Myasnikov)";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];  // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed construction", "Non-standard, publicly unanalyzed cipher of unknown provenance; not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (raw primitive: setup(key)+crypt(block)).
      this.tests = [
        {
          text: "DarkCrypt Wicker98 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("00000000000000000000000000000000")
        },
        {
          text: "DarkCrypt Wicker98 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("f950ebcd2bc7f510898182915ed3d273")
        },
        {
          text: "DarkCrypt Wicker98 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("0bd3424f47983c90198664fdce5ac59b")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptWicker98Instance(this, isInverse);
    }
  }

  class DarkCryptWicker98Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Wicker-98 (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
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
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    // Key schedule: 44 round-key words, the 4 big-endian key words repeated 11 times.
    _keyWords() {
      const kw = [
        OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]),
        OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]),
        OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]),
        OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15])
      ];
      const K = [];
      for (let i = 0; i < 44; i++) K.push(kw[i % 4]);
      return K;
    }

    _encryptBlock(block) {
      const K = this._keyWords();

      const S0in = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      const S1in = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      const S2in = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      const S3in = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);

      const A0 = OpCodes.ToUint32(S0in + K[0]);
      const B0 = OpCodes.ToUint32(S1in + K[1]);
      const D0 = OpCodes.ToUint32(S3in + K[3]);
      const seed = OpCodes.ToUint32(B0 + OpCodes.ToUint32(S2in + K[2]) + K[4]);
      const acc0 = OpCodes.RotR32(seed, 1);

      const slot = { 8: A0, 4: B0, 0: acc0, 12: D0 };
      let prevResult = D0;
      let acc = acc0;

      for (let r = 0; r < ROUNDS; r++) {
        const tIdx = CYCLE[r % 4];
        const sIdx = CYCLE[(r + 3) % 4];

        const combined = COMBINE_OP[r] === '&' ? OpCodes.And32(prevResult, acc) : OpCodes.Or32(prevResult, acc);
        slot[tIdx] = TARGET_OP[r] === '+' ? OpCodes.ToUint32(slot[tIdx] + combined) : OpCodes.Xor32(slot[tIdx], combined);

        const roundKey = K[r + 5];
        const p = OP_P[r] === '^' ? OpCodes.Xor32(prevResult, roundKey) : OpCodes.ToUint32(prevResult + roundKey);
        const sum = OP_S[r] === '^' ? OpCodes.Xor32(p, acc) : OpCodes.ToUint32(p + acc);
        const accNew = OpCodes.RotR32(sum, ROT[r]);
        slot[sIdx] = accNew;

        prevResult = slot[tIdx];
        acc = accNew;
      }

      const A_ring = slot[8], D_ring = slot[12], C_ring = slot[0], acc_final = slot[4];
      const A_out = OpCodes.Xor32(A_ring, K[41]);
      const B_out = OpCodes.Xor32(acc_final, K[40]);
      const C_out = OpCodes.Xor32(C_ring, K[43]);
      const D_out = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.ToUint32(D_ring + (OpCodes.And32(C_ring, acc_final))), K[42]));

      return [].concat(
        OpCodes.Unpack32BE(A_out), OpCodes.Unpack32BE(B_out),
        OpCodes.Unpack32BE(C_out), OpCodes.Unpack32BE(D_out)
      );
    }

    // Direct port of the DarkCrypt implementation's Decrypt() routine: a byte/dword-aliased
    // 16-byte scratch buffer plus the same scratch registers, statement-for-statement.
    _decryptBlock(block) {
      const K = this._keyWords();

      const stack = new Uint8Array(16);
      const view = new DataView(stack.buffer);
      const S = off => view.getUint32(off, true);
      const Sset = (off, v) => view.setUint32(off, OpCodes.ToUint32(v), true);
      const B = off => stack[off];
      const Bset = (off, v) => { stack[off] = OpCodes.And32(v, 0xFF); };
      const out = new Uint8Array(16);
      const OUTset = (off, v) => { out[off] = OpCodes.And32(v, 0xFF); };
      const IN = off => block[off];

      let eax = 0, ebx = 0, edx = 0, edi = 0, ebp = 0, al = 0;

      al = IN(3); Bset(4, al);
      al = IN(2); Bset(5, al);
      al = IN(1); Bset(6, al);
      al = IN(0); Bset(7, al);
      al = IN(7); Bset(8, al);
      al = IN(6); Bset(9, al);
      al = IN(5); Bset(10, al);
      al = IN(4); Bset(11, al);
      al = IN(11); Bset(12, al);
      al = IN(10); Bset(13, al);
      al = IN(9); Bset(14, al);
      al = IN(8); Bset(15, al);
      al = IN(15); Bset(0, al);
      al = IN(14); Bset(1, al);
      al = IN(13); Bset(2, al);
      al = IN(12); Bset(3, al);

      eax = K[41];
      ebx = S(8);
      Sset(4, OpCodes.Xor32(S(4), eax));
      eax = K[40];
      ebx = OpCodes.Xor32(ebx, eax);
      edi = S(12);
      Sset(8, ebx);
      eax = K[43];
      edx = ebx;
      edi = OpCodes.Xor32(edi, eax);
      ebx = OpCodes.Shr32(ebx, 0x1f);
      Sset(12, edi);
      Sset(8, ebx);
      eax = K[42];
      ebp = ebx;
      Sset(0, OpCodes.Xor32(S(0), eax));
      eax = OpCodes.ToUint32(edx + edx);
      ebx = S(4);
      ebp = OpCodes.Xor32(ebp, eax);
      edx = OpCodes.And32(edx, edi);
      Sset(8, ebp);
      edi = ebp;
      Sset(0, OpCodes.ToUint32(S(0) - edx));
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[39];
      edx = edi;
      Sset(8, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.And32(edx, S(8));
      Sset(4, ebx);
      ebp = ebx;
      Sset(12, OpCodes.Xor32(S(12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(0);
      edi = ebp;
      Sset(4, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[38];
      edx = edi;
      Sset(4, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x8);
      ebx = OpCodes.Shr32(ebx, 0x18);
      edx = OpCodes.And32(edx, S(4));
      Sset(0, ebx);
      ebp = ebx;
      Sset(8, OpCodes.Xor32(S(8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(12);
      edi = ebp;
      Sset(0, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[37];
      edx = edi;
      Sset(0, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x4);
      ebx = OpCodes.Shr32(ebx, 0x1c);
      edx = OpCodes.And32(edx, S(0));
      Sset(12, ebx);
      ebp = ebx;
      Sset(4, OpCodes.Xor32(S(4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(8);
      edi = ebp;
      Sset(12, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[36];
      edx = edi;
      Sset(12, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x12);
      ebx = OpCodes.Shr32(ebx, 0xe);
      edx = OpCodes.Or32(edx, S(12));
      Sset(8, ebx);
      ebp = ebx;
      Sset(0, OpCodes.ToUint32(S(0) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(4);
      edi = ebp;
      Sset(8, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[35];
      edx = edi;
      Sset(8, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(8, edx);
      eax = ebx; edx = ebx;
      ebx = OpCodes.Shr32(ebx, 0x7);
      eax = OpCodes.Shl32(eax, 0x19);
      edx = OpCodes.Or32(edx, S(8));
      ebp = ebx;
      Sset(4, ebx);
      Sset(12, OpCodes.ToUint32(S(12) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(0);
      edi = ebp;
      Sset(4, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[34];
      edx = edi;
      Sset(4, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.And32(edx, S(4));
      Sset(0, ebx);
      ebp = ebx;
      Sset(8, OpCodes.ToUint32(S(8) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(12);
      edi = ebp;
      Sset(0, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[33];
      edx = edi;
      Sset(0, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x8);
      ebx = OpCodes.Shr32(ebx, 0x18);
      edx = OpCodes.And32(edx, S(0));
      Sset(12, ebx);
      ebp = ebx;
      Sset(4, OpCodes.ToUint32(S(4) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(8);
      edi = ebp;
      Sset(12, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[32];
      edx = edi;
      Sset(12, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x14);
      ebx = OpCodes.Shr32(ebx, 0xc);
      edx = OpCodes.And32(edx, S(12));
      Sset(8, ebx);
      ebp = ebx;
      Sset(0, OpCodes.Xor32(S(0), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(4);
      edi = ebp;
      Sset(8, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[31];
      edx = edi;
      Sset(8, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x1a);
      ebx = OpCodes.Shr32(ebx, 0x6);
      edx = OpCodes.Or32(edx, S(8));
      Sset(4, ebx);
      ebp = ebx;
      Sset(12, OpCodes.Xor32(S(12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(0);
      edi = ebp;
      Sset(4, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[30];
      edx = edi;
      Sset(4, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x1b);
      ebx = OpCodes.Shr32(ebx, 0x5);
      edx = OpCodes.And32(edx, S(4));
      Sset(0, ebx);
      ebp = ebx;
      Sset(8, OpCodes.Xor32(S(8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(12);
      edi = ebp;
      Sset(0, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[29];
      edx = edi;
      Sset(0, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.Or32(edx, S(0));
      Sset(12, ebx);
      ebp = ebx;
      Sset(4, OpCodes.ToUint32(S(4) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(8);
      edi = ebp;
      Sset(12, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[28];
      edx = edi;
      Sset(12, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x18);
      ebx = OpCodes.Shr32(ebx, 0x8);
      edx = OpCodes.And32(edx, S(12));
      ebp = ebx;
      Sset(8, ebx);
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(4);
      edi = ebp;
      Sset(8, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[27];
      Sset(8, edi);
      Sset(0, OpCodes.ToUint32(S(0) - edx));
      edx = edi;
      edx = OpCodes.ToUint32(edx - eax);
      Sset(8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0xc);
      ebx = OpCodes.Shr32(ebx, 0x14);
      edx = OpCodes.And32(edx, S(8));
      Sset(4, ebx);
      ebp = ebx;
      Sset(12, OpCodes.ToUint32(S(12) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(0);
      edi = ebp;
      Sset(4, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[26];
      edx = edi;
      Sset(4, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x16);
      ebx = OpCodes.Shr32(ebx, 0xa);
      edx = OpCodes.Or32(edx, S(4));
      Sset(0, ebx);
      ebp = ebx;
      Sset(8, OpCodes.ToUint32(S(8) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(12);
      edi = ebp;
      Sset(0, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[25];
      edx = edi;
      Sset(0, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x13);
      ebx = OpCodes.Shr32(ebx, 0xd);
      edx = OpCodes.Or32(edx, S(0));
      Sset(12, ebx);
      ebp = ebx;
      Sset(4, OpCodes.Xor32(S(4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(8);
      edi = ebp;
      Sset(12, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[24];
      edx = edi;
      Sset(12, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.Or32(edx, S(12));
      Sset(8, ebx);
      ebp = ebx;
      Sset(0, OpCodes.Xor32(S(0), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(4);
      edi = ebp;
      Sset(8, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[23];
      edx = edi;
      Sset(8, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x18);
      ebx = OpCodes.Shr32(ebx, 0x8);
      edx = OpCodes.Or32(edx, S(8));
      Sset(4, ebx);
      ebp = ebx;
      Sset(12, OpCodes.Xor32(S(12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(0);
      edi = ebp;
      Sset(4, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[22];
      edx = edi;
      Sset(4, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x1c);
      ebx = OpCodes.Shr32(ebx, 0x4);
      edx = OpCodes.Or32(edx, S(4));
      Sset(0, ebx);
      ebp = ebx;
      Sset(8, OpCodes.ToUint32(S(8) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(12);
      edi = ebp;
      Sset(0, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[21];
      edx = edi;
      Sset(0, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0xe);
      ebx = OpCodes.Shr32(ebx, 0x12);
      edx = OpCodes.Or32(edx, S(0));
      Sset(12, ebx);
      ebp = ebx;
      Sset(4, OpCodes.ToUint32(S(4) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(8);
      edi = ebp;
      Sset(12, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[20];
      edx = edi;
      Sset(12, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(12, edx);
      eax = ebx; edx = ebx;
      ebx = OpCodes.Shr32(ebx, 0x7);
      eax = OpCodes.Shl32(eax, 0x19);
      Sset(8, ebx);
      ebp = ebx;
      edx = OpCodes.Or32(edx, S(12));
      ebx = S(4);
      ebp = OpCodes.Xor32(ebp, eax);
      Sset(0, OpCodes.ToUint32(S(0) - edx));
      edi = ebp;
      Sset(8, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[19];
      edx = edi;
      Sset(8, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.And32(edx, S(8));
      Sset(4, ebx);
      ebp = ebx;
      Sset(12, OpCodes.ToUint32(S(12) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(0);
      edi = ebp;
      Sset(4, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[18];
      edx = edi;
      Sset(4, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x8);
      ebx = OpCodes.Shr32(ebx, 0x18);
      edx = OpCodes.Or32(edx, S(4));
      Sset(0, ebx);
      ebp = ebx;
      Sset(8, OpCodes.Xor32(S(8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(12);
      edi = ebp;
      Sset(0, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[17];
      edx = edi;
      Sset(0, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x14);
      ebx = OpCodes.Shr32(ebx, 0xc);
      edx = OpCodes.And32(edx, S(0));
      Sset(12, ebx);
      ebp = ebx;
      Sset(4, OpCodes.Xor32(S(4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(8);
      edi = ebp;
      Sset(12, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[16];
      edx = edi;
      Sset(12, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0xa);
      ebx = OpCodes.Shr32(ebx, 0x16);
      edx = OpCodes.Or32(edx, S(12));
      Sset(8, ebx);
      ebp = ebx;
      Sset(0, OpCodes.Xor32(S(0), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(4);
      edi = ebp;
      Sset(8, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[15];
      edx = edi;
      Sset(8, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0xb);
      ebx = OpCodes.Shr32(ebx, 0x15);
      edx = OpCodes.And32(edx, S(8));
      Sset(4, ebx);
      ebp = ebx;
      Sset(12, OpCodes.ToUint32(S(12) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(0);
      edi = ebp;
      Sset(4, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[14];
      edx = edi;
      Sset(4, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.And32(edx, S(4));
      Sset(0, ebx);
      ebp = ebx;
      Sset(8, OpCodes.ToUint32(S(8) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(12);
      edi = ebp;
      Sset(0, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[13];
      edx = edi;
      Sset(0, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x18);
      ebx = OpCodes.Shr32(ebx, 0x8);
      edx = OpCodes.Or32(edx, S(0));
      Sset(12, ebx);
      ebp = ebx;
      Sset(4, OpCodes.ToUint32(S(4) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(8);
      edi = ebp;
      Sset(12, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[12];
      edx = edi;
      Sset(12, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(12, edx);
      eax = ebx; edx = ebx;
      ebx = OpCodes.Shr32(ebx, 0x14);
      eax = OpCodes.Shl32(eax, 0xc);
      edx = OpCodes.And32(edx, S(12));
      Sset(8, ebx);
      ebp = ebx;
      Sset(0, OpCodes.ToUint32(S(0) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(4);
      edi = ebp;
      Sset(8, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[11];
      edx = edi;
      Sset(8, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x6);
      ebx = OpCodes.Shr32(ebx, 0x1a);
      edx = OpCodes.Or32(edx, S(8));
      Sset(4, ebx);
      ebp = ebx;
      Sset(12, OpCodes.Xor32(S(12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(0);
      edi = ebp;
      Sset(4, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[10];
      edx = edi;
      Sset(4, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x15);
      ebx = OpCodes.Shr32(ebx, 0xb);
      edx = OpCodes.Or32(edx, S(4));
      Sset(0, ebx);
      ebp = ebx;
      Sset(8, OpCodes.Xor32(S(8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(12);
      edi = ebp;
      Sset(0, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[9];
      edx = edi;
      Sset(0, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.And32(edx, S(0));
      Sset(12, ebx);
      ebp = ebx;
      Sset(4, OpCodes.Xor32(S(4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(8);
      edi = ebp;
      Sset(12, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[8];
      edx = edi;
      Sset(12, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x8);
      ebx = OpCodes.Shr32(ebx, 0x18);
      edx = OpCodes.And32(edx, S(12));
      Sset(8, ebx);
      ebp = ebx;
      Sset(0, OpCodes.ToUint32(S(0) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(4);
      edi = ebp;
      Sset(8, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[7];
      edx = edi;
      Sset(8, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x4);
      ebx = OpCodes.Shr32(ebx, 0x1c);
      edx = OpCodes.And32(edx, S(8));
      Sset(4, ebx);
      ebp = ebx;
      Sset(12, OpCodes.ToUint32(S(12) - edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = S(0);
      edi = ebp;
      Sset(4, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = K[6];
      edx = edi;
      Sset(4, edi);
      edx = OpCodes.ToUint32(edx - eax);
      Sset(4, edx);
      edx = ebx;
      ebx = OpCodes.Shr32(ebx, 0x1e);
      eax = OpCodes.ToUint32(edx * 4);
      Sset(0, ebx);
      edx = OpCodes.And32(edx, S(4));
      ebp = ebx;
      ebx = S(12);
      ebp = OpCodes.Xor32(ebp, eax);
      Sset(8, OpCodes.ToUint32(S(8) - edx));
      edi = ebp;
      Sset(0, ebp);
      edi = OpCodes.ToUint32(edi - ebx);
      eax = K[5];
      edx = edi;
      Sset(0, edi);
      edx = OpCodes.Xor32(edx, eax);
      Sset(0, edx);
      edx = ebx;
      ebx = OpCodes.Shr32(ebx, 0x1f);
      eax = OpCodes.ToUint32(edx + edx);
      ebp = ebx;
      Sset(12, ebx);
      ebp = OpCodes.Xor32(ebp, eax);
      edx = OpCodes.And32(edx, S(0));
      Sset(12, ebp);
      ebx = S(8);
      edi = ebp;
      eax = K[4];
      ebp = S(4);
      edi = OpCodes.ToUint32(edi - ebx);
      ebp = OpCodes.ToUint32(ebp - edx);
      edx = edi;
      ebx = ebp;
      edx = OpCodes.ToUint32(edx - eax);
      eax = K[0];
      Sset(4, ebp);
      ebx = OpCodes.ToUint32(ebx - eax);
      eax = K[1];
      ebp = edx;
      Sset(8, OpCodes.ToUint32(S(8) - eax));
      eax = K[2];
      ebp = OpCodes.ToUint32(ebp - eax);
      eax = K[3];
      Sset(4, ebx);
      Sset(0, OpCodes.ToUint32(S(0) - eax));

      al = B(7); OUTset(0, al);
      al = B(6); OUTset(1, al);
      al = B(5); OUTset(2, al);
      al = B(4); OUTset(3, al);
      al = B(11); OUTset(4, al);
      al = B(10); Sset(12, edi); OUTset(5, al);
      al = B(9); Sset(12, edx); OUTset(6, al);
      al = B(8); Sset(12, ebp); OUTset(7, al);
      al = B(15); OUTset(8, al);
      al = B(14); OUTset(9, al);
      al = B(13); OUTset(10, al);
      al = B(12); OUTset(11, al);
      al = B(3); OUTset(12, al);
      al = B(2); OUTset(13, al);
      al = B(1); OUTset(14, al);
      al = B(0); OUTset(15, al);

      return Array.from(out);
    }
  }

  const algorithmInstance = new DarkCryptWicker98Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptWicker98Algorithm, DarkCryptWicker98Instance };
}));
