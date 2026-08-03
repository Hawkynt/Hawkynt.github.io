/*
 * MD6 (DarkCrypt) - AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * MD6 (Rivest et al., NIST SHA-3 round 1/2 submission) as implemented in the
 * DarkCrypt Total Commander plugin. The implementation's call shape is 1:1
 * with the public MIT reference implementation of MD6 (files md6.h /
 * md6_compress.c / md6_mode.c): it hardcodes a digest-size constant of 512
 * bits before calling md6_init(state, d), then md6_update(state, data,
 * bitlen), then md6_final(state, hashval) -- same argument counts/order as
 * the reference source. The default-rounds computation reproduces the
 * reference's exact "r = 40 + floor(d/4), clamped to >=80 only if keylen>0"
 * arithmetic. Since this implementation never supplies a key (keylen is
 * always 0), the clamp never triggers; for the hardcoded d=512 that yields
 * r=168.
 *
 * Every constant matches the published MD6 reference byte-for-byte: the Q
 * table (all 15 words), the tap positions (17/18/21/31/67/89), the full
 * 16-step (right-shift, left-shift) schedule, the control-word field
 * widths/order (r@48|L@40|z@36|p@20|keylen@12|d@0), and the node-ID packing
 * (ell@56|i). So is the little-endian byte-reversal applied to leaf message
 * data before compression. Fixed parameters: d=512 bits (ignores the
 * caller's length argument), r=168 (default_r(512, keylen=0)), L=64
 * (md6_default_L; fully hierarchical/tree mode), no key.
 *
 * This implementation differs from the current published MD6 reference in
 * one respect: it predates a fix made to the reference's md6_final() on
 * 4/15/2009, where the two final steps (trim_hashval(st) and the memcpy of
 * the hash value to the caller's output buffer) were in the wrong order, so
 * a caller reading the output-parameter hash value -- rather than
 * st->hashval -- got "the first d bits of the final root chaining value
 * rather than the last d bits". This implementation reproduces that pre-fix
 * behavior: the digest is the FIRST d bits of the 16-word (1024-bit) final
 * chaining value, not the last d bits as the corrected reference (and every
 * MD6 implementation released after April 2009) computes. Everything else
 * about this implementation is standard, unmodified MD6. Validated
 * end-to-end against the DarkCrypt implementation's output for the empty
 * string, "abc", and a 64-byte incrementing pattern.
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== MD6 CONSTANTS (standard, w=64) =====

  const MASK64 = 0xFFFFFFFFFFFFFFFFn;

  const W_BITS = 64;      // bits per md6 word
  const N_WORDS = 89;     // words in compression input
  const C_WORDS = 16;     // words in compression output ("chunk")
  const B_WORDS = 64;     // data words per compression block
  const V_WORDS = 1;      // control-word slot count
  const U_WORDS = 1;      // node-ID slot count
  const K_WORDS = 8;      // key words per compression block
  const Q_WORDS = 15;     // Q constant words per compression block
  const MAX_STACK_HEIGHT = 29;
  const DEFAULT_L = 64;   // large => fully hierarchical (tree) mode

  // "Tap positions" for the feedback shift-register (n=89 case)
  const T0 = 17, T1 = 18, T2 = 21, T3 = 31, T4 = 67, T5 = 89;

  // Round-constant recurrence seeds (w=64)
  const S0 = 0x0123456789abcdefn;
  const SMASK = 0x7311c2812425cfa0n;

  // Per-step (right-shift, left-shift) pairs for the 16-step loop unrolling (w=64)
  const SHIFTS = [
    [10, 11], [5, 24], [13, 9], [10, 16],
    [11, 15], [12, 9], [2, 27], [7, 15],
    [14, 6], [15, 2], [7, 29], [13, 8],
    [11, 15], [7, 5], [6, 31], [12, 9]
  ];

  // Q = initial 960 bits of the fractional part of sqrt(6), as 15 64-bit words
  const Q = [
    0x7311c2812425cfa0n, 0x6432286434aac8e7n, 0xb60450e9ef68b7c1n,
    0xe8fb23908d9f06f1n, 0xdd2e76cba691e5bfn, 0x0cd0d63b2c30bc41n,
    0x1f8ccf6823058f8an, 0x54e5ed5b88e3775dn, 0x4ad12aae0a6d6031n,
    0x3e7f16bb88222e0dn, 0x8af8671d3fb50c2cn, 0x995ad1178bd25c31n,
    0xc878c1dd04c4b633n, 0x3b72066c7a1552acn, 0x0d6f3522631effcbn
  ];

  function md6DefaultR(d, keylen) {
    // Default number of rounds is forty plus floor(d/4);
    // unless keylen > 0, in which case it must be >= 80 as well.
    let r = 40 + Math.floor(d / 4);
    if (keylen > 0) r = Math.max(80, r);
    return r;
  }

  // ===== byte <-> word conversion (big-endian, matches the reference's
  //       "store raw bytes, then reverse-per-word on a little-endian host"
  //       behavior net effect for input data and for the final digest) =====

  function bytesToWordBE(bytes, offset) {
    let w = 0n;
    for (let i = 0; i < 8; i++) {
      const b = offset + i < bytes.length ? bytes[offset + i] : 0;
      w = OpCodes.OrN(OpCodes.ShiftLn(w, 8), BigInt(b));
    }
    return w;
  }

  function wordToBytesBE(word) {
    const out = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
      out[i] = Number(OpCodes.AndN(word, 0xFFn));
      word = OpCodes.ShiftRn(word, 8);
    }
    return out;
  }

  // ===== "bare" compression routine: n-word input -> c-word output =====

  function md6Compress(N, r) {
    // N: array of 89 BigInt words (already packed). r: round count.
    const total = r * C_WORDS + N_WORDS;
    const A = new Array(total);
    for (let i = 0; i < N_WORDS; i++) A[i] = OpCodes.AndN(N[i], MASK64);
    for (let i = N_WORDS; i < total; i++) A[i] = 0n;

    let S = S0;
    let i = N_WORDS;
    for (let j = 0; j < r * C_WORDS; j += C_WORDS) {
      for (let step = 0; step < C_WORDS; step++) {
        const rs = SHIFTS[step][0], ls = SHIFTS[step][1];
        let x = S;
        x = OpCodes.XorN(x, A[i + step - T5]);                                   // end-around feedback
        x = OpCodes.XorN(x, A[i + step - T0]);                                   // linear feedback
        x = OpCodes.XorN(x, OpCodes.AndN(A[i + step - T1], A[i + step - T2]));   // first quadratic term
        x = OpCodes.XorN(x, OpCodes.AndN(A[i + step - T3], A[i + step - T4]));   // second quadratic term
        x = OpCodes.XorN(x, OpCodes.ShiftRn(x, rs));                             // right-shift
        A[i + step] = OpCodes.AndN(OpCodes.XorN(x, OpCodes.ShiftLn(x, ls)), MASK64); // left-shift
      }
      S = OpCodes.AndN(
        OpCodes.XorN(OpCodes.XorN(OpCodes.ShiftLn(S, 1), OpCodes.ShiftRn(S, W_BITS - 1)), OpCodes.AndN(S, SMASK)),
        MASK64
      );
      i += C_WORDS;
    }
    return A.slice(total - C_WORDS, total);
  }

  function makeControlWord(r, L, z, p, keylen, d) {
    return OpCodes.AndN(
      OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(
        OpCodes.OrN(OpCodes.OrN(
          OpCodes.ShiftLn(BigInt(r), 48),
          OpCodes.ShiftLn(BigInt(L), 40)),
          OpCodes.ShiftLn(BigInt(z), 36)),
        OpCodes.ShiftLn(BigInt(p), 20)),
        OpCodes.ShiftLn(BigInt(keylen), 12)),
      BigInt(d)),
      MASK64
    );
  }

  function makeNodeID(ell, i) {
    return OpCodes.AndN(OpCodes.OrN(OpCodes.ShiftLn(BigInt(ell), 56), BigInt(i)), MASK64);
  }

  function standardCompress(K, ell, i, r, L, z, p, keylen, d, B) {
    const N = new Array(N_WORDS);
    let ni = 0;
    for (let j = 0; j < Q_WORDS; j++) N[ni++] = Q[j];
    for (let j = 0; j < K_WORDS; j++) N[ni++] = K[j];
    N[ni++] = makeNodeID(ell, i);
    N[ni++] = makeControlWord(r, L, z, p, keylen, d);
    for (let j = 0; j < B_WORDS; j++) N[ni++] = B[j];
    return md6Compress(N, r);
  }

  // ===== MD6 mode of operation (stack-based sequential/tree hashing) =====

  class MD6State {
    constructor(d) {
      this.d = d;
      this.r = md6DefaultR(d, 0);
      this.L = DEFAULT_L;
      this.keylen = 0;
      this.K = new Array(K_WORDS).fill(0n);
      this.top = 1;
      this.bits = new Array(MAX_STACK_HEIGHT).fill(0);
      this.iForLevel = new Array(MAX_STACK_HEIGHT).fill(0);
      this.Bwords = [];
      for (let i = 0; i < MAX_STACK_HEIGHT; i++) this.Bwords.push(new Array(B_WORDS).fill(0n));
      this.level1Bytes = new Uint8Array(B_WORDS * 8); // raw message bytes for leaf level
      if (this.L === 0) this.bits[1] = C_WORDS * W_BITS; // SEQ mode IV setup
      this.finalized = false;
      this.hashval = null;
    }

    update(dataBytes) {
      let j = 0;
      while (j < dataBytes.length) {
        const bytesFree = (B_WORDS * 8) - (this.bits[1] / 8);
        const portion = Math.min(dataBytes.length - j, bytesFree);
        const destOffset = this.bits[1] / 8;
        for (let k = 0; k < portion; k++) this.level1Bytes[destOffset + k] = dataBytes[j + k];
        j += portion;
        this.bits[1] += portion * 8;

        if (this.bits[1] === B_WORDS * W_BITS && j < dataBytes.length)
          this.process(1, false);
      }
    }

    compressBlock(ell, z) {
      let B;
      if (ell === 1) {
        B = new Array(B_WORDS);
        for (let w = 0; w < B_WORDS; w++) B[w] = bytesToWordBE(this.level1Bytes, w * 8);
      } else {
        B = this.Bwords[ell];
      }

      const p = B_WORDS * W_BITS - this.bits[ell];
      const C = standardCompress(this.K, ell, this.iForLevel[ell], this.r, this.L, z, p, this.keylen, this.d, B);

      this.bits[ell] = 0;
      this.iForLevel[ell]++;
      if (ell === 1) this.level1Bytes.fill(0);
      else this.Bwords[ell] = new Array(B_WORDS).fill(0n);

      return C;
    }

    process(ell, final) {
      if (!final) {
        if (this.bits[ell] < B_WORDS * W_BITS) return;
      } else {
        if (ell === this.top) {
          if (ell === this.L + 1) {
            if (this.bits[ell] === C_WORDS * W_BITS && this.iForLevel[ell] > 0) return;
          } else {
            if (ell > 1 && this.bits[ell] === C_WORDS * W_BITS) return;
          }
        }
      }

      let z = 0;
      if (final && ell === this.top) z = 1;
      const C = this.compressBlock(ell, z);
      if (z === 1) { this.hashval = C; return; }

      const nextLevel = Math.min(ell + 1, this.L + 1);
      if (nextLevel === this.L + 1 && this.iForLevel[nextLevel] === 0 && this.bits[nextLevel] === 0)
        this.bits[nextLevel] = C_WORDS * W_BITS;

      const wordOffset = this.bits[nextLevel] / W_BITS;
      for (let k = 0; k < C_WORDS; k++) this.Bwords[nextLevel][wordOffset + k] = C[k];
      this.bits[nextLevel] += C_WORDS * W_BITS;
      if (nextLevel > this.top) this.top = nextLevel;

      return this.process(nextLevel, final);
    }

    final() {
      if (this.finalized) return this.digest;

      let ell;
      if (this.top === 1) ell = 1;
      else {
        for (ell = 1; ell <= this.top; ell++)
          if (this.bits[ell] > 0) break;
      }
      this.process(ell, true);

      // Serialize the 16-word final chaining value to bytes (big-endian per word).
      // This implementation predates the MD6 reference's 4/15/2009 fix and takes
      // the FIRST d bits of this buffer as the digest, not the last d bits (see
      // header comment) -- so no "shift from the end" step here.
      const full = new Uint8Array(C_WORDS * 8);
      for (let w = 0; w < C_WORDS; w++) full.set(wordToBytesBE(this.hashval[w]), w * 8);

      // d is always 512 here (a whole number of bytes), so no partial-byte
      // bit-trimming is needed -- this implementation only supports the
      // digest size the DarkCrypt implementation actually produces.
      const fullOrPartialBytes = Math.ceil(this.d / 8);
      const trimmed = new Uint8Array(fullOrPartialBytes);
      for (let i = 0; i < fullOrPartialBytes; i++)
        trimmed[i] = full[i];

      this.finalized = true;
      this.digest = trimmed;
      return trimmed;
    }
  }

  // ===== ALGORITHM REGISTRATION =====

  class DarkCryptMD6Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "MD6 (DarkCrypt)";
      this.description = "Standard MD6-512 hash function as used by the DarkCrypt Total Commander plugin: the unmodified MIT reference MD6 implementation, hardcoded to digest size d=512 bits, r=168 rounds, mode parameter L=64 (fully hierarchical), and no key.";
      this.inventor = "Ronald L. Rivest, Benjamin Agre, Daniel V. Bailey, Christopher Crutchfield, Yevgeniy Dodis, Kermin Fleming, Asif Khan, Jayant Krishnamurthy, Yuncheng Lin, Leo Reyzin, Emily Shen, Jim Sutherland, Eran Tromer, Yiqun Lisa Yin";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "DarkCrypt Variant";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedOutputSizes = [64]; // 512 bits (digest size hardcoded by the DarkCrypt implementation)
      this.blockSize = 512;             // 64 words * 8 bytes per compression block
      this.outputSize = 64;

      this.documentation = [
        new LinkItem("The MD6 Hash Function (NIST SHA-3 submission)", "https://groups.csail.mit.edu/cis/md6/"),
        new LinkItem("MD6 reference source (md6.h / md6_compress.c / md6_mode.c)", "https://groups.csail.mit.edu/cis/md6/docs/md6_report.pdf"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("DarkCrypt Total Commander plugin", "https://github.com/Zdimon/DarkCryptTC")
      ];

      // Vectors generated from the DarkCrypt implementation's hashnow(inPtr, outPtr,
      // lenBytes) export; empty/"abc"/incr64 (bytes 0x00..0x3F) inputs, each producing
      // a 64-byte (512-bit) digest.
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes(""),
          OpCodes.Hex8ToBytes("e3bde7f708d2006335b09d95a0e8648a87f782e7a1ef17d676d84cc91fe006331749fcf14bf2a4c80ae1aeb52ed0799c8fc9420c59344d4731690e18f7a2cef3"),
          "DarkCrypt MD6 empty string",
          "https://github.com/Zdimon/DarkCryptTC"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("abc"),
          OpCodes.Hex8ToBytes("1c6233a806832e2c711a5595cdc355b04b81a3f547fff89e40391399bb925bc845a0cce9ecc3d1b0439450e079df51a23d9fdafe99a85e72d1562bbae6a1eb46"),
          "DarkCrypt MD6 \"abc\"",
          "https://github.com/Zdimon/DarkCryptTC"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          OpCodes.Hex8ToBytes("cedddc4d2d764a430bcfa5e03ca641f3fdb7aabf9782dd0174b4669a164f5ab81b223a3dd84a6cbd84d6be2a3a31babe316ccd400d66cbc180ddfa3c17fd0ed0"),
          "DarkCrypt MD6 incremental 64-byte message",
          "https://github.com/Zdimon/DarkCryptTC"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new DarkCryptMD6Instance(this);
    }
  }

  class DarkCryptMD6Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.state = new MD6State(512);
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.state.update(data);
    }

    Result() {
      return Array.from(this.state.final());
    }

    ProcessData(input, key) {
      this.state = new MD6State(512);
      this.state.update(input);
      return Array.from(this.state.final());
    }

    Reset() {
      this.state = new MD6State(512);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DarkCryptMD6Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMD6Algorithm, DarkCryptMD6Instance };
}));
