/*
 * SCOP-384 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SCOP-384 as implemented in the DarkCrypt Total Commander plugin kernel.
 * The plugin exposes this cipher via "setup", "ncrypt" and "ndecrypt"
 * operations (rather than the generic "setup"/"crypt"/"decrypt" used by
 * most other DarkCrypt ciphers), and there is no IV/nonce parameter at all.
 *
 * Key schedule (setup(key)):
 * 1. Exactly 48 bytes (384 bits) are read from the key into a work buffer.
 * 2. Any zero byte within the FIRST 32 bytes of that buffer is replaced by
 *    a running counter starting at 1 (the last 16 bytes are left as-is,
 *    zero or not).
 * 3. The last 16 bytes of the (scrubbed) buffer become the initial 4-word
 *    (128-bit) generator state; the first 32 bytes become 32 fixed
 *    "coefficient" bytes (4 groups of 8), used unchanged by every round of
 *    the generator described below.
 * 4. A degree-4-polynomial "imul-chain" round is used both to warm up the
 *    state (8 rounds, output discarded) and to fill a 384-word (1536-byte)
 *    table 4 words at a time (12 blocks of 8 chunks, with one extra
 *    diffusion-only round per block). One more round after the table is
 *    filled yields 3 extra bytes (i0, j0, k0) used to seed the keystream
 *    engine, plus a single table slot has its low bit forced to 1.
 *    Per round and per state word S (4 words total), with x = S>>>16 and
 *    y = S&0xFFFF (16-bit lanes) and 8 key-derived coefficients k0..k7:
 *      P_hi(x) = k0*x^4 + k1*x^3 + k2*x^2 + k3*x + 1   (mod 2^32, truncating
 *                32x32 multiplies the same way as JS Math.imul)
 *      P_lo(y) = k4*y^4 + k5*y^3 + k6*y^2 + k7*y + 1
 *      new table word  = (P_hi<<16) | (P_lo & 0xFFFF)
 *      overflow word   = (P_lo>>>16) | (P_hi & 0xFFFF0000)
 *    and the 4 state words are replaced from the 4 overflow words by a
 *    rotate-and-merge: state[n] = (overflow[n-1 mod 4]<<16) | (overflow[n]>>>16).
 *
 * Keystream/combine (ncrypt(buf)/ndecrypt(buf)): every call transforms
 * EXACTLY 64 bytes (16 little-endian 32-bit words) in place. The 384-word
 * table built above is viewed as two overlapping 256-word windows
 * S(idx)=table[idx] and T(idx)=table[128+idx]. The 3 session bytes (i, j, k)
 * are reloaded from their fixed setup()-time values on every call (never
 * persisted across calls), while the table itself keeps mutating across
 * calls (its state is carried on the cipher instance). Per output word,
 * in order:
 *   jk    = (j + k) mod 256
 *   ks    = T(j) + T(jk)                     (mod 2^32)   <- combined with data
 *   k'    = S(i) + T(jk)                     (mod 2^32);  T(jk) is overwritten with k'
 *   j'    = (jk + lowByte(T(jk)_old)) mod 256
 *   i'    = (i + 1) mod 256
 *   out   = in + ks   (ncrypt)   or   in - ks   (ndecrypt)     (mod 2^32)
 * Since combination is addition/subtraction (not XOR), ncrypt(zeros) yields
 * the raw keystream directly; longer buffers are driven by DarkCrypt as
 * successive 64-byte ncrypt()/ndecrypt() calls sharing the same table state
 * (CBC-like chaining via the evolving table), matching the "SCOP-384 (384
 * bit, CBC)" entry in the plugin's own algorithm list.
 *
 * 384-bit (48-byte) key. No IV/nonce. Educational only.
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

  const KEY_BYTES = 48;     // 384-bit fixed key
  const BLOCK_BYTES = 64;   // ncrypt()/ndecrypt() always transform exactly 64 bytes per call
  const TABLE_WORDS = 384;  // 12 blocks * 8 chunks * 4 words
  const WARMUP_ROUNDS = 8;

  // One "imul-chain" round: mutates state[4] in place, returns the 4 derived table words.
  function scopRound(state, keyBuf) {
    const packed = new Array(4);
    const overflow = new Array(4);

    for (let iter = 0; iter < 4; ++iter) {
      const koff = iter * 8;
      const s = OpCodes.ToUint32(state[iter]);

      // high 16-bit lane: P_hi(x) = k0*x^4 + k1*x^3 + k2*x^2 + k3*x + 1
      const x = OpCodes.And32(OpCodes.Shr32(s, 16), 0xFFFF);
      const x2 = OpCodes.ToUint32(Math.imul(x, x));
      const x3 = OpCodes.ToUint32(Math.imul(x2, x));
      const x4 = OpCodes.ToUint32(Math.imul(x3, x));
      let sumHi = OpCodes.Add32(OpCodes.ToUint32(Math.imul(keyBuf[koff + 0], x4)), OpCodes.ToUint32(Math.imul(keyBuf[koff + 1], x3)));
      sumHi = OpCodes.Add32(sumHi, OpCodes.ToUint32(Math.imul(keyBuf[koff + 2], x2)));
      sumHi = OpCodes.Add32(sumHi, OpCodes.ToUint32(Math.imul(keyBuf[koff + 3], x)));
      const pHi = OpCodes.Add32(sumHi, 1);

      // low 16-bit lane: P_lo(y) = k4*y^4 + k5*y^3 + k6*y^2 + k7*y + 1
      const y = OpCodes.And32(s, 0xFFFF);
      const y2 = OpCodes.ToUint32(Math.imul(y, y));
      const y3 = OpCodes.ToUint32(Math.imul(y2, y));
      const y4 = OpCodes.ToUint32(Math.imul(y3, y));
      let sumLo = OpCodes.Add32(OpCodes.ToUint32(Math.imul(keyBuf[koff + 4], y4)), OpCodes.ToUint32(Math.imul(keyBuf[koff + 5], y3)));
      sumLo = OpCodes.Add32(sumLo, OpCodes.ToUint32(Math.imul(keyBuf[koff + 6], y2)));
      sumLo = OpCodes.Add32(sumLo, OpCodes.ToUint32(Math.imul(keyBuf[koff + 7], y)));
      const pLo = OpCodes.Add32(sumLo, 1);

      packed[iter] = OpCodes.OrN(OpCodes.Shl32(pHi, 16), OpCodes.And32(pLo, 0xFFFF));
      overflow[iter] = OpCodes.OrN(OpCodes.Shr32(pLo, 16), OpCodes.And32(pHi, 0xFFFF0000));
    }

    const newState = new Array(4);
    for (let n = 0; n < 4; ++n) {
      const prev = overflow[OpCodes.And32(n + 3, 3)];
      newState[n] = OpCodes.OrN(OpCodes.Shl32(prev, 16), OpCodes.Shr32(overflow[n], 16));
    }
    for (let n = 0; n < 4; ++n) state[n] = newState[n];

    return packed;
  }

  // Builds the 48-byte key work buffer: copy + zero-scrub the first 32 bytes only.
  function buildKeyBuf(keyBytes) {
    const buf = new Array(KEY_BYTES);
    for (let i = 0; i < KEY_BYTES; ++i) buf[i] = keyBytes[i];
    let counter = 1;
    for (let i = 0; i < 32; ++i) {
      if (buf[i] === 0) { buf[i] = OpCodes.And32(counter, 0xFF); ++counter; }
    }
    return buf;
  }

  class DarkCryptScopAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "SCOP-384 (DarkCrypt)";
      this.description = "384-bit table-driven stream cipher as implemented in the DarkCrypt Total Commander plugin kernel, built on an imul-chain key schedule and an RC4-like additive combiner. No public specification of DarkCrypt's own SCOP-384 variant is known.";
      this.inventor = "Unknown (DarkCrypt variant)";
      this.year = 2013;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(KEY_BYTES, KEY_BYTES, 0)]; // fixed 384-bit
      this.SupportedNonceSizes = [new KeySize(0, 0, 0)]; // no IV/nonce (setup() takes a single keyPtr argument)
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed proprietary construction", "Custom polynomial key schedule and additive (non-XOR) RC4-like combiner with no public design rationale or third-party cryptanalysis.", "Use a vetted stream cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key) then ncrypt(buf)
      // additive combine, driven as successive 64-byte in-place calls sharing the evolving table state).
      this.tests = [
        {
          text: "DarkCrypt Scop — keystream from 128 zero bytes, 48-byte incrementing key",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: new Array(128).fill(0),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          expected: OpCodes.Hex8ToBytes("e2ee660b62e416934a31c17c949a93e05692a0d5a8d4971a4a9e94929823f1e5d8ed60d1c201d50ad6af1eec1e29917a6d1ef7cf829d847504dda2f0e010f85fe98d7676c2e5d801da0288a3ee4217bbb2d747f2f5973b4a84bd36c6f291df04847310e2203cf7b8744230088c1e978cbe79febd6d08b9a8bef1356e44d92f0b")
        },
        {
          text: "DarkCrypt Scop — encryption of 64 incrementing bytes, 48-byte incrementing key",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          expected: OpCodes.Hex8ToBytes("e2ef680e66e91c9a523acb87a0a7a1ef66a3b2e8bce9ad3162b7aeadb4400f05f80e83f4e626fb31fed848174a56bfa99d4f2903b6d2baac3c16dd2b1c4e369f")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptScopInstance(this, isInverse);
    }
  }

  class DarkCryptScopInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._table = null;   // Uint32-valued Array(384), mutates across 64-byte block calls
      this._i0 = 0; this._j0 = 0; this._k0 = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._table = null; return; }
      if (keyBytes.length !== KEY_BYTES)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SCOP-384 (DarkCrypt) requires exactly ${KEY_BYTES} bytes`);
      this._key = [...keyBytes];
      this._setup();
    }
    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._table) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._table) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = [];
      const sign = this.isInverse ? -1 : 1;
      let offset = 0;
      const total = this.inputBuffer.length;

      while (offset < total) {
        const chunkLen = Math.min(BLOCK_BYTES, total - offset);
        const block = new Array(BLOCK_BYTES).fill(0);
        for (let i = 0; i < chunkLen; ++i) block[i] = this.inputBuffer[offset + i];

        this._block64(block, sign);

        for (let i = 0; i < chunkLen; ++i) output.push(block[i]);
        offset += chunkLen;
      }

      this.inputBuffer = [];
      return output;
    }

    _setup() {
      const keyBuf = buildKeyBuf(this._key);
      const state = [
        OpCodes.Pack32LE(keyBuf[32], keyBuf[33], keyBuf[34], keyBuf[35]),
        OpCodes.Pack32LE(keyBuf[36], keyBuf[37], keyBuf[38], keyBuf[39]),
        OpCodes.Pack32LE(keyBuf[40], keyBuf[41], keyBuf[42], keyBuf[43]),
        OpCodes.Pack32LE(keyBuf[44], keyBuf[45], keyBuf[46], keyBuf[47])
      ];

      for (let r = 0; r < WARMUP_ROUNDS; ++r) scopRound(state, keyBuf);

      const table = new Array(TABLE_WORDS);
      let pos = 0;
      for (let block = 0; block < 12; ++block) {
        for (let chunk = 0; chunk < 8; ++chunk) {
          const packed = scopRound(state, keyBuf);
          table[pos++] = packed[0]; table[pos++] = packed[1];
          table[pos++] = packed[2]; table[pos++] = packed[3];
        }
        scopRound(state, keyBuf); // extra diffusion-only round, output discarded
      }

      const finalPacked = scopRound(state, keyBuf);
      const w3 = finalPacked[3];
      this._i0 = OpCodes.And32(OpCodes.Shr32(w3, 24), 0xFF);
      this._j0 = OpCodes.And32(OpCodes.Shr32(w3, 16), 0xFF);
      this._k0 = OpCodes.And32(OpCodes.Shr32(w3, 8), 0xFF);
      const idx = OpCodes.And32(w3, 0x7F);
      table[idx] = OpCodes.OrN(table[idx], 1);

      this._table = table;
    }

    // Transforms exactly BLOCK_BYTES bytes in place (sign=+1 encrypt/add, sign=-1 decrypt/sub).
    _block64(block, sign) {
      const table = this._table;
      let i = this._i0, j = this._j0, k = this._k0;

      for (let w = 0; w < 16; ++w) {
        const off = w * 4;
        const dataWord = OpCodes.Pack32LE(block[off], block[off + 1], block[off + 2], block[off + 3]);

        const jk = OpCodes.And32(j + k, 0xFF);
        const Tj = table[128 + j];
        const Si = table[i];
        const TjkOld = table[128 + jk];

        const ks = OpCodes.Add32(Tj, TjkOld);
        const newK = OpCodes.Add32(Si, TjkOld);
        table[128 + jk] = newK;
        const newJ = OpCodes.And32(jk + OpCodes.And32(TjkOld, 0xFF), 0xFF);
        const newI = OpCodes.And32(i + 1, 0xFF);

        const outWord = sign > 0 ? OpCodes.Add32(dataWord, ks) : OpCodes.Sub32(dataWord, ks);
        const ob = OpCodes.Unpack32LE(outWord);
        block[off] = ob[0]; block[off + 1] = ob[1]; block[off + 2] = ob[2]; block[off + 3] = ob[3];

        i = newI; j = newJ; k = newK;
      }
    }
  }

  const algorithmInstance = new DarkCryptScopAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptScopAlgorithm, DarkCryptScopInstance };
}));
