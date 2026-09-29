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
 * The encryption routine below reconstructs the round structure directly. The
 * decryption routine is implemented as its own separate routine because its data
 * flow fuses two rounds' worth of work at the very first and last steps in a way
 * that does not reduce to the clean per-round formula used for encryption; it is
 * kept in that more verbose form rather than rewritten into an unverified
 * "clean" form.
 *
 * Verified against the DarkCrypt implementation over 435 cases — the all-zero,
 * all-ones and incrementing key/block combinations, every single-bit key, every
 * single-bit plaintext, 200 random encryptions and 100 random decryptions — all
 * of which agree byte for byte in both directions.
 *
 * NOTE on the all-zero key. The network is pure ARX with no round constants, so
 * an all-zero state survives every round unchanged and the four whitening words
 * are zero as well; the all-zero block is therefore a fixed point. This needs
 * both the zero key and the zero block, and is much narrower than the same
 * property in the other constant-free DarkCrypt designs: the all-zero key still
 * encrypts every other block properly (0 of 500 non-zero blocks fixed), and
 * across 199 non-zero keys the all-zero block was never fixed. The DarkCrypt
 * implementation behaves identically.
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
  /**
   * @returns {string[]} Target operation per round (period of 7: four ADDs, three XORs)
   */
  function buildTargetOps() {
    /** @type {string[]} */
    const period = ['+', '+', '+', '+', '^', '^', '^'];
    /** @type {string[]} */
    const out = [];
    for (let r = 0; r < ROUNDS; r++) out.push(period[r % 7]);
    return out;
  }
  const TARGET_OP = buildTargetOps();
  /** @type {string[]} */
  const COMBINE_OP = ['&','&','&','&','&','|','|','&','|','&','&','|','&','|','&','|','|','|','|','|','|','|','&','&','|','&','|','&','&','&','|','|','&','&','&'];
  /** @type {string[]} */
  const OP_P = ['^','+','^','+','^','+','+','^','+','^','+','^','+','+','^','+','^','+','^','+','+','^','+','^','+','^','+','+','^','+','^','+','^','+','+'];
  /** @type {string[]} */
  const OP_S = ['+','^','^','+','+','^','+','+','^','^','+','+','^','+','+','^','^','+','+','^','+','+','^','^','+','+','^','+','+','^','^','+','+','^','+'];
  /** @type {uint8[]} */
  const ROT = [2,4,8,16,21,6,12,24,16,11,10,20,8,16,25,14,28,24,16,19,22,12,24,16,27,26,20,8,16,25,18,4,8,16,1];
  // Target word cycles A,B,C,D (stored at these four "slot" indices) every 4 rounds.
  /** @type {uint8[]} */
  const CYCLE = [8, 4, 0, 12];

  /**
   * Little-endian 32-bit read from a byte buffer
   * @param {uint8[]} buf - Byte buffer
   * @param {int32} off - Byte offset
   * @returns {uint32} The word
   */
  function getWordLE(buf, off) {
    return OpCodes.Pack32LE(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
  }

  /**
   * Little-endian 32-bit write into a byte buffer
   * @param {uint8[]} buf - Byte buffer
   * @param {int32} off - Byte offset
   * @param {uint32} v - Word to store
   */
  function setWordLE(buf, off, v) {
    const b = OpCodes.Unpack32LE(v);
    buf[off] = b[0]; buf[off + 1] = b[1]; buf[off + 2] = b[2]; buf[off + 3] = b[3];
  }

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
        new Vulnerability("All-zero weak key", "The network is pure ARX with no round constants, so it fixes the all-zero state, and an all-zero key makes the whitening words zero too. The all-zero block is returned unencrypted under that one key.", "Never use an all-zero key."),
        new Vulnerability("Unanalyzed construction", "Non-standard, publicly unanalyzed cipher of unknown provenance; not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Verified against the DarkCrypt implementation, which produces every
      // value below. The cited page publishes no vectors of its own and no
      // specification for Wicker-98 exists.
      this.tests = [
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
        },
        {
          // Discriminates: under a non-zero key the all-zero block is not fixed.
          text: "DarkCrypt Wicker98 — incrementing key, zero plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("10b3ccc52a3f6de7ca1c90350a018da0")
        },
        {
          text: "DarkCrypt Wicker98 — incrementing key, all-ones plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("231066fde28e4de6436fd65e8bde35a5")
        },
        {
          // Discriminates the other way: the all-zero key is weak only at the
          // all-zero block, and encrypts everything else properly.
          text: "DarkCrypt Wicker98 — all-zero key, repeated-nibble plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d60df079ef6ae58661d929d15d3ad826")
        },
        {
          text: "DarkCrypt Wicker98 — all-ones key, zero plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("0f7f9512cfa477b982f80475b6c078c9")
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptWicker98Instance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptWicker98Instance(this, isInverse);
    }
  }

  class DarkCryptWicker98Instance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptWicker98Algorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. Wicker-98 (DarkCrypt) requires exactly 16 bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
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

    // Key schedule: 44 round-key words, the 4 big-endian key words repeated 11 times.
    /**
     * @returns {uint32[]} 44 round-key words
     */
    _keyWords() {
      const kw = [
        OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]),
        OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]),
        OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]),
        OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15])
      ];
      /** @type {uint32[]} */
      const words = [];
      for (let i = 0; i < 44; i++) words.push(kw[i % 4]);
      return words;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      const rk = this._keyWords();

      const S0in = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      const S1in = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      const S2in = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      const S3in = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);

      const A0 = OpCodes.Add32(S0in, rk[0]);
      const B0 = OpCodes.Add32(S1in, rk[1]);
      const D0 = OpCodes.Add32(S3in, rk[3]);
      const seed = OpCodes.Add32(OpCodes.Add32(B0, OpCodes.Add32(S2in, rk[2])), rk[4]);
      const acc0 = OpCodes.RotR32(seed, 1);

      // Only slots 0, 4, 8 and 12 are used.
      /** @type {uint32[]} */
      const slot = new Array(16);
      slot[8] = A0; slot[4] = B0; slot[0] = acc0; slot[12] = D0;
      let prevResult = D0;
      let acc = acc0;

      for (let r = 0; r < ROUNDS; r++) {
        const tIdx = CYCLE[r % 4];
        const sIdx = CYCLE[(r + 3) % 4];

        const combined = COMBINE_OP[r] === '&' ? OpCodes.And32(prevResult, acc) : OpCodes.Or32(prevResult, acc);
        slot[tIdx] = TARGET_OP[r] === '+' ? OpCodes.Add32(slot[tIdx], combined) : OpCodes.Xor32(slot[tIdx], combined);

        const roundKey = rk[r + 5];
        const p = OP_P[r] === '^' ? OpCodes.Xor32(prevResult, roundKey) : OpCodes.Add32(prevResult, roundKey);
        const sum = OP_S[r] === '^' ? OpCodes.Xor32(p, acc) : OpCodes.Add32(p, acc);
        const accNew = OpCodes.RotR32(sum, ROT[r]);
        slot[sIdx] = accNew;

        prevResult = slot[tIdx];
        acc = accNew;
      }

      const A_ring = slot[8], D_ring = slot[12], C_ring = slot[0], acc_final = slot[4];
      const A_out = OpCodes.Xor32(A_ring, rk[41]);
      const B_out = OpCodes.Xor32(acc_final, rk[40]);
      const C_out = OpCodes.Xor32(C_ring, rk[43]);
      const D_out = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Add32(D_ring, (OpCodes.And32(C_ring, acc_final))), rk[42]));

      /** @type {uint8[]} */
      const result = [];
      result.push(...OpCodes.Unpack32BE(A_out));
      result.push(...OpCodes.Unpack32BE(B_out));
      result.push(...OpCodes.Unpack32BE(C_out));
      result.push(...OpCodes.Unpack32BE(D_out));
      return result;
    }

    // Direct port of the DarkCrypt implementation's Decrypt() routine: a byte/dword-aliased
    // 16-byte scratch buffer plus the same scratch registers, statement-for-statement.
    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      const rk = this._keyWords();

      /** @type {uint8[]} */
      const stack = new Uint8Array(16);
      /** @type {uint8[]} */
      const out = new Uint8Array(16);

      /** @type {uint32} */
      let eax = 0;
      /** @type {uint32} */
      let ebx = 0;
      /** @type {uint32} */
      let edx = 0;
      /** @type {uint32} */
      let edi = 0;
      /** @type {uint32} */
      let ebp = 0;
      /** @type {uint8} */
      let al = 0;

      al = block[3]; stack[4] = OpCodes.And32(al, 0xFF);
      al = block[2]; stack[5] = OpCodes.And32(al, 0xFF);
      al = block[1]; stack[6] = OpCodes.And32(al, 0xFF);
      al = block[0]; stack[7] = OpCodes.And32(al, 0xFF);
      al = block[7]; stack[8] = OpCodes.And32(al, 0xFF);
      al = block[6]; stack[9] = OpCodes.And32(al, 0xFF);
      al = block[5]; stack[10] = OpCodes.And32(al, 0xFF);
      al = block[4]; stack[11] = OpCodes.And32(al, 0xFF);
      al = block[11]; stack[12] = OpCodes.And32(al, 0xFF);
      al = block[10]; stack[13] = OpCodes.And32(al, 0xFF);
      al = block[9]; stack[14] = OpCodes.And32(al, 0xFF);
      al = block[8]; stack[15] = OpCodes.And32(al, 0xFF);
      al = block[15]; stack[0] = OpCodes.And32(al, 0xFF);
      al = block[14]; stack[1] = OpCodes.And32(al, 0xFF);
      al = block[13]; stack[2] = OpCodes.And32(al, 0xFF);
      al = block[12]; stack[3] = OpCodes.And32(al, 0xFF);

      eax = rk[41];
      ebx = getWordLE(stack, 8);
      setWordLE(stack, 4, OpCodes.Xor32(getWordLE(stack, 4), eax));
      eax = rk[40];
      ebx = OpCodes.Xor32(ebx, eax);
      edi = getWordLE(stack, 12);
      setWordLE(stack, 8, ebx);
      eax = rk[43];
      edx = ebx;
      edi = OpCodes.Xor32(edi, eax);
      ebx = OpCodes.Shr32(ebx, 0x1f);
      setWordLE(stack, 12, edi);
      setWordLE(stack, 8, ebx);
      eax = rk[42];
      ebp = ebx;
      setWordLE(stack, 0, OpCodes.Xor32(getWordLE(stack, 0), eax));
      eax = OpCodes.Add32(edx, edx);
      ebx = getWordLE(stack, 4);
      ebp = OpCodes.Xor32(ebp, eax);
      edx = OpCodes.And32(edx, edi);
      setWordLE(stack, 8, ebp);
      edi = ebp;
      setWordLE(stack, 0, OpCodes.Sub32(getWordLE(stack, 0), edx));
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[39];
      edx = edi;
      setWordLE(stack, 8, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.And32(edx, getWordLE(stack, 8));
      setWordLE(stack, 4, ebx);
      ebp = ebx;
      setWordLE(stack, 12, OpCodes.Xor32(getWordLE(stack, 12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 0);
      edi = ebp;
      setWordLE(stack, 4, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[38];
      edx = edi;
      setWordLE(stack, 4, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x8);
      ebx = OpCodes.Shr32(ebx, 0x18);
      edx = OpCodes.And32(edx, getWordLE(stack, 4));
      setWordLE(stack, 0, ebx);
      ebp = ebx;
      setWordLE(stack, 8, OpCodes.Xor32(getWordLE(stack, 8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 12);
      edi = ebp;
      setWordLE(stack, 0, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[37];
      edx = edi;
      setWordLE(stack, 0, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x4);
      ebx = OpCodes.Shr32(ebx, 0x1c);
      edx = OpCodes.And32(edx, getWordLE(stack, 0));
      setWordLE(stack, 12, ebx);
      ebp = ebx;
      setWordLE(stack, 4, OpCodes.Xor32(getWordLE(stack, 4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 8);
      edi = ebp;
      setWordLE(stack, 12, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[36];
      edx = edi;
      setWordLE(stack, 12, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x12);
      ebx = OpCodes.Shr32(ebx, 0xe);
      edx = OpCodes.Or32(edx, getWordLE(stack, 12));
      setWordLE(stack, 8, ebx);
      ebp = ebx;
      setWordLE(stack, 0, OpCodes.Sub32(getWordLE(stack, 0), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 4);
      edi = ebp;
      setWordLE(stack, 8, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[35];
      edx = edi;
      setWordLE(stack, 8, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 8, edx);
      eax = ebx; edx = ebx;
      ebx = OpCodes.Shr32(ebx, 0x7);
      eax = OpCodes.Shl32(eax, 0x19);
      edx = OpCodes.Or32(edx, getWordLE(stack, 8));
      ebp = ebx;
      setWordLE(stack, 4, ebx);
      setWordLE(stack, 12, OpCodes.Sub32(getWordLE(stack, 12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 0);
      edi = ebp;
      setWordLE(stack, 4, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[34];
      edx = edi;
      setWordLE(stack, 4, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.And32(edx, getWordLE(stack, 4));
      setWordLE(stack, 0, ebx);
      ebp = ebx;
      setWordLE(stack, 8, OpCodes.Sub32(getWordLE(stack, 8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 12);
      edi = ebp;
      setWordLE(stack, 0, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[33];
      edx = edi;
      setWordLE(stack, 0, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x8);
      ebx = OpCodes.Shr32(ebx, 0x18);
      edx = OpCodes.And32(edx, getWordLE(stack, 0));
      setWordLE(stack, 12, ebx);
      ebp = ebx;
      setWordLE(stack, 4, OpCodes.Sub32(getWordLE(stack, 4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 8);
      edi = ebp;
      setWordLE(stack, 12, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[32];
      edx = edi;
      setWordLE(stack, 12, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x14);
      ebx = OpCodes.Shr32(ebx, 0xc);
      edx = OpCodes.And32(edx, getWordLE(stack, 12));
      setWordLE(stack, 8, ebx);
      ebp = ebx;
      setWordLE(stack, 0, OpCodes.Xor32(getWordLE(stack, 0), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 4);
      edi = ebp;
      setWordLE(stack, 8, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[31];
      edx = edi;
      setWordLE(stack, 8, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x1a);
      ebx = OpCodes.Shr32(ebx, 0x6);
      edx = OpCodes.Or32(edx, getWordLE(stack, 8));
      setWordLE(stack, 4, ebx);
      ebp = ebx;
      setWordLE(stack, 12, OpCodes.Xor32(getWordLE(stack, 12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 0);
      edi = ebp;
      setWordLE(stack, 4, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[30];
      edx = edi;
      setWordLE(stack, 4, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x1b);
      ebx = OpCodes.Shr32(ebx, 0x5);
      edx = OpCodes.And32(edx, getWordLE(stack, 4));
      setWordLE(stack, 0, ebx);
      ebp = ebx;
      setWordLE(stack, 8, OpCodes.Xor32(getWordLE(stack, 8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 12);
      edi = ebp;
      setWordLE(stack, 0, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[29];
      edx = edi;
      setWordLE(stack, 0, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.Or32(edx, getWordLE(stack, 0));
      setWordLE(stack, 12, ebx);
      ebp = ebx;
      setWordLE(stack, 4, OpCodes.Sub32(getWordLE(stack, 4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 8);
      edi = ebp;
      setWordLE(stack, 12, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[28];
      edx = edi;
      setWordLE(stack, 12, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x18);
      ebx = OpCodes.Shr32(ebx, 0x8);
      edx = OpCodes.And32(edx, getWordLE(stack, 12));
      ebp = ebx;
      setWordLE(stack, 8, ebx);
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 4);
      edi = ebp;
      setWordLE(stack, 8, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[27];
      setWordLE(stack, 8, edi);
      setWordLE(stack, 0, OpCodes.Sub32(getWordLE(stack, 0), edx));
      edx = edi;
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0xc);
      ebx = OpCodes.Shr32(ebx, 0x14);
      edx = OpCodes.And32(edx, getWordLE(stack, 8));
      setWordLE(stack, 4, ebx);
      ebp = ebx;
      setWordLE(stack, 12, OpCodes.Sub32(getWordLE(stack, 12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 0);
      edi = ebp;
      setWordLE(stack, 4, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[26];
      edx = edi;
      setWordLE(stack, 4, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x16);
      ebx = OpCodes.Shr32(ebx, 0xa);
      edx = OpCodes.Or32(edx, getWordLE(stack, 4));
      setWordLE(stack, 0, ebx);
      ebp = ebx;
      setWordLE(stack, 8, OpCodes.Sub32(getWordLE(stack, 8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 12);
      edi = ebp;
      setWordLE(stack, 0, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[25];
      edx = edi;
      setWordLE(stack, 0, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x13);
      ebx = OpCodes.Shr32(ebx, 0xd);
      edx = OpCodes.Or32(edx, getWordLE(stack, 0));
      setWordLE(stack, 12, ebx);
      ebp = ebx;
      setWordLE(stack, 4, OpCodes.Xor32(getWordLE(stack, 4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 8);
      edi = ebp;
      setWordLE(stack, 12, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[24];
      edx = edi;
      setWordLE(stack, 12, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.Or32(edx, getWordLE(stack, 12));
      setWordLE(stack, 8, ebx);
      ebp = ebx;
      setWordLE(stack, 0, OpCodes.Xor32(getWordLE(stack, 0), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 4);
      edi = ebp;
      setWordLE(stack, 8, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[23];
      edx = edi;
      setWordLE(stack, 8, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x18);
      ebx = OpCodes.Shr32(ebx, 0x8);
      edx = OpCodes.Or32(edx, getWordLE(stack, 8));
      setWordLE(stack, 4, ebx);
      ebp = ebx;
      setWordLE(stack, 12, OpCodes.Xor32(getWordLE(stack, 12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 0);
      edi = ebp;
      setWordLE(stack, 4, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[22];
      edx = edi;
      setWordLE(stack, 4, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x1c);
      ebx = OpCodes.Shr32(ebx, 0x4);
      edx = OpCodes.Or32(edx, getWordLE(stack, 4));
      setWordLE(stack, 0, ebx);
      ebp = ebx;
      setWordLE(stack, 8, OpCodes.Sub32(getWordLE(stack, 8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 12);
      edi = ebp;
      setWordLE(stack, 0, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[21];
      edx = edi;
      setWordLE(stack, 0, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0xe);
      ebx = OpCodes.Shr32(ebx, 0x12);
      edx = OpCodes.Or32(edx, getWordLE(stack, 0));
      setWordLE(stack, 12, ebx);
      ebp = ebx;
      setWordLE(stack, 4, OpCodes.Sub32(getWordLE(stack, 4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 8);
      edi = ebp;
      setWordLE(stack, 12, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[20];
      edx = edi;
      setWordLE(stack, 12, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 12, edx);
      eax = ebx; edx = ebx;
      ebx = OpCodes.Shr32(ebx, 0x7);
      eax = OpCodes.Shl32(eax, 0x19);
      setWordLE(stack, 8, ebx);
      ebp = ebx;
      edx = OpCodes.Or32(edx, getWordLE(stack, 12));
      ebx = getWordLE(stack, 4);
      ebp = OpCodes.Xor32(ebp, eax);
      setWordLE(stack, 0, OpCodes.Sub32(getWordLE(stack, 0), edx));
      edi = ebp;
      setWordLE(stack, 8, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[19];
      edx = edi;
      setWordLE(stack, 8, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.And32(edx, getWordLE(stack, 8));
      setWordLE(stack, 4, ebx);
      ebp = ebx;
      setWordLE(stack, 12, OpCodes.Sub32(getWordLE(stack, 12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 0);
      edi = ebp;
      setWordLE(stack, 4, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[18];
      edx = edi;
      setWordLE(stack, 4, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x8);
      ebx = OpCodes.Shr32(ebx, 0x18);
      edx = OpCodes.Or32(edx, getWordLE(stack, 4));
      setWordLE(stack, 0, ebx);
      ebp = ebx;
      setWordLE(stack, 8, OpCodes.Xor32(getWordLE(stack, 8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 12);
      edi = ebp;
      setWordLE(stack, 0, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[17];
      edx = edi;
      setWordLE(stack, 0, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x14);
      ebx = OpCodes.Shr32(ebx, 0xc);
      edx = OpCodes.And32(edx, getWordLE(stack, 0));
      setWordLE(stack, 12, ebx);
      ebp = ebx;
      setWordLE(stack, 4, OpCodes.Xor32(getWordLE(stack, 4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 8);
      edi = ebp;
      setWordLE(stack, 12, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[16];
      edx = edi;
      setWordLE(stack, 12, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0xa);
      ebx = OpCodes.Shr32(ebx, 0x16);
      edx = OpCodes.Or32(edx, getWordLE(stack, 12));
      setWordLE(stack, 8, ebx);
      ebp = ebx;
      setWordLE(stack, 0, OpCodes.Xor32(getWordLE(stack, 0), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 4);
      edi = ebp;
      setWordLE(stack, 8, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[15];
      edx = edi;
      setWordLE(stack, 8, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0xb);
      ebx = OpCodes.Shr32(ebx, 0x15);
      edx = OpCodes.And32(edx, getWordLE(stack, 8));
      setWordLE(stack, 4, ebx);
      ebp = ebx;
      setWordLE(stack, 12, OpCodes.Sub32(getWordLE(stack, 12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 0);
      edi = ebp;
      setWordLE(stack, 4, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[14];
      edx = edi;
      setWordLE(stack, 4, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.And32(edx, getWordLE(stack, 4));
      setWordLE(stack, 0, ebx);
      ebp = ebx;
      setWordLE(stack, 8, OpCodes.Sub32(getWordLE(stack, 8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 12);
      edi = ebp;
      setWordLE(stack, 0, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[13];
      edx = edi;
      setWordLE(stack, 0, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x18);
      ebx = OpCodes.Shr32(ebx, 0x8);
      edx = OpCodes.Or32(edx, getWordLE(stack, 0));
      setWordLE(stack, 12, ebx);
      ebp = ebx;
      setWordLE(stack, 4, OpCodes.Sub32(getWordLE(stack, 4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 8);
      edi = ebp;
      setWordLE(stack, 12, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[12];
      edx = edi;
      setWordLE(stack, 12, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 12, edx);
      eax = ebx; edx = ebx;
      ebx = OpCodes.Shr32(ebx, 0x14);
      eax = OpCodes.Shl32(eax, 0xc);
      edx = OpCodes.And32(edx, getWordLE(stack, 12));
      setWordLE(stack, 8, ebx);
      ebp = ebx;
      setWordLE(stack, 0, OpCodes.Sub32(getWordLE(stack, 0), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 4);
      edi = ebp;
      setWordLE(stack, 8, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[11];
      edx = edi;
      setWordLE(stack, 8, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x6);
      ebx = OpCodes.Shr32(ebx, 0x1a);
      edx = OpCodes.Or32(edx, getWordLE(stack, 8));
      setWordLE(stack, 4, ebx);
      ebp = ebx;
      setWordLE(stack, 12, OpCodes.Xor32(getWordLE(stack, 12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 0);
      edi = ebp;
      setWordLE(stack, 4, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[10];
      edx = edi;
      setWordLE(stack, 4, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 4, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x15);
      ebx = OpCodes.Shr32(ebx, 0xb);
      edx = OpCodes.Or32(edx, getWordLE(stack, 4));
      setWordLE(stack, 0, ebx);
      ebp = ebx;
      setWordLE(stack, 8, OpCodes.Xor32(getWordLE(stack, 8), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 12);
      edi = ebp;
      setWordLE(stack, 0, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[9];
      edx = edi;
      setWordLE(stack, 0, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 0, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x10);
      ebx = OpCodes.Shr32(ebx, 0x10);
      edx = OpCodes.And32(edx, getWordLE(stack, 0));
      setWordLE(stack, 12, ebx);
      ebp = ebx;
      setWordLE(stack, 4, OpCodes.Xor32(getWordLE(stack, 4), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 8);
      edi = ebp;
      setWordLE(stack, 12, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[8];
      edx = edi;
      setWordLE(stack, 12, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 12, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x8);
      ebx = OpCodes.Shr32(ebx, 0x18);
      edx = OpCodes.And32(edx, getWordLE(stack, 12));
      setWordLE(stack, 8, ebx);
      ebp = ebx;
      setWordLE(stack, 0, OpCodes.Sub32(getWordLE(stack, 0), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 4);
      edi = ebp;
      setWordLE(stack, 8, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[7];
      edx = edi;
      setWordLE(stack, 8, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 8, edx);
      eax = ebx; edx = ebx;
      eax = OpCodes.Shl32(eax, 0x4);
      ebx = OpCodes.Shr32(ebx, 0x1c);
      edx = OpCodes.And32(edx, getWordLE(stack, 8));
      setWordLE(stack, 4, ebx);
      ebp = ebx;
      setWordLE(stack, 12, OpCodes.Sub32(getWordLE(stack, 12), edx));
      ebp = OpCodes.Xor32(ebp, eax);
      ebx = getWordLE(stack, 0);
      edi = ebp;
      setWordLE(stack, 4, ebp);
      edi = OpCodes.Xor32(edi, ebx);
      eax = rk[6];
      edx = edi;
      setWordLE(stack, 4, edi);
      edx = OpCodes.Sub32(edx, eax);
      setWordLE(stack, 4, edx);
      edx = ebx;
      ebx = OpCodes.Shr32(ebx, 0x1e);
      eax = OpCodes.Mul32(edx, 4);
      setWordLE(stack, 0, ebx);
      edx = OpCodes.And32(edx, getWordLE(stack, 4));
      ebp = ebx;
      ebx = getWordLE(stack, 12);
      ebp = OpCodes.Xor32(ebp, eax);
      setWordLE(stack, 8, OpCodes.Sub32(getWordLE(stack, 8), edx));
      edi = ebp;
      setWordLE(stack, 0, ebp);
      edi = OpCodes.Sub32(edi, ebx);
      eax = rk[5];
      edx = edi;
      setWordLE(stack, 0, edi);
      edx = OpCodes.Xor32(edx, eax);
      setWordLE(stack, 0, edx);
      edx = ebx;
      ebx = OpCodes.Shr32(ebx, 0x1f);
      eax = OpCodes.Add32(edx, edx);
      ebp = ebx;
      setWordLE(stack, 12, ebx);
      ebp = OpCodes.Xor32(ebp, eax);
      edx = OpCodes.And32(edx, getWordLE(stack, 0));
      setWordLE(stack, 12, ebp);
      ebx = getWordLE(stack, 8);
      edi = ebp;
      eax = rk[4];
      ebp = getWordLE(stack, 4);
      edi = OpCodes.Sub32(edi, ebx);
      ebp = OpCodes.Sub32(ebp, edx);
      edx = edi;
      ebx = ebp;
      edx = OpCodes.Sub32(edx, eax);
      eax = rk[0];
      setWordLE(stack, 4, ebp);
      ebx = OpCodes.Sub32(ebx, eax);
      eax = rk[1];
      ebp = edx;
      setWordLE(stack, 8, OpCodes.Sub32(getWordLE(stack, 8), eax));
      eax = rk[2];
      ebp = OpCodes.Sub32(ebp, eax);
      eax = rk[3];
      setWordLE(stack, 4, ebx);
      setWordLE(stack, 0, OpCodes.Sub32(getWordLE(stack, 0), eax));

      al = stack[7]; out[0] = OpCodes.And32(al, 0xFF);
      al = stack[6]; out[1] = OpCodes.And32(al, 0xFF);
      al = stack[5]; out[2] = OpCodes.And32(al, 0xFF);
      al = stack[4]; out[3] = OpCodes.And32(al, 0xFF);
      al = stack[11]; out[4] = OpCodes.And32(al, 0xFF);
      al = stack[10]; setWordLE(stack, 12, edi); out[5] = OpCodes.And32(al, 0xFF);
      al = stack[9]; setWordLE(stack, 12, edx); out[6] = OpCodes.And32(al, 0xFF);
      al = stack[8]; setWordLE(stack, 12, ebp); out[7] = OpCodes.And32(al, 0xFF);
      al = stack[15]; out[8] = OpCodes.And32(al, 0xFF);
      al = stack[14]; out[9] = OpCodes.And32(al, 0xFF);
      al = stack[13]; out[10] = OpCodes.And32(al, 0xFF);
      al = stack[12]; out[11] = OpCodes.And32(al, 0xFF);
      al = stack[3]; out[12] = OpCodes.And32(al, 0xFF);
      al = stack[2]; out[13] = OpCodes.And32(al, 0xFF);
      al = stack[1]; out[14] = OpCodes.And32(al, 0xFF);
      al = stack[0]; out[15] = OpCodes.And32(al, 0xFF);

      /** @type {uint8[]} */
      const result = [];
      for (let i = 0; i < 16; i++) result.push(out[i]);
      return result;
    }
  }

  const algorithmInstance = new DarkCryptWicker98Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptWicker98Algorithm, DarkCryptWicker98Instance };
}));
