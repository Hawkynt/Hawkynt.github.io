/*
 * Sfinks (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Sfinks as implemented in the DarkCrypt Total Commander plugin kernel.
 * The 256-bit Fibonacci LFSR (weight-17 feedback polynomial), the 17-tap
 * nonlinear filter built around a 16-bit field inversion in GF(2^16) modulo
 * x^16+x^5+x^3+x^2+1, and the 128-round key/IV resynchronization (with its
 * 16-position nonlinear feedback into the LFSR) are all BIT-EXACT to the
 * eSTREAM Phase-2 Sfinks specification (Braeken, Lano, Mentens, Preneel,
 * Verbauwhede) and to the authors' published ECRYPT reference C
 * implementation (sfinks.c).
 *
 * That reference implementation itself defines the filter/keystream
 * combiner through a simulated 7-stage hardware pipeline: the raw
 * 16-bit inversion output and the LFSR's own bit 0 are each pushed
 * through a 7-entry delay line (pipe[]/linmask[] in the reference code)
 * every clock, and only the OLDEST entry of each line is combined into
 * the keystream (z_t = pipe[0]-bit0 XOR linmask[0]) or fed back during
 * resynchronization (using pipe[0], read before that round's shift).
 * This detail is easy to miss from the paper's inline formula
 * z_t = (INV(x)&1) XOR x0, which describes the unpipelined/logical
 * behavior only; this port faithfully reproduces the full 7-stage
 * pipelined combiner rather than the simplified immediate formula, matching
 * the DarkCrypt implementation.
 * 80-bit key, 80-bit IV. Educational only.
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

  const LFSR_BITS = 256;
  const RESYNC_ROUNDS = 128;
  const PIPE_DEPTH = 7; // reference sfinks.c: pipe[7], linmask[7]

  // Fibonacci LFSR feedback taps (weight-17 polynomial, offset 0 counted separately in the
  // published recursion s[t+256] = s[t+212] ^ ... ^ s[t+14] ^ s[t]).
  const FEEDBACK_TAPS = [212, 194, 192, 187, 163, 151, 125, 115, 107, 85, 66, 64, 52, 48, 14, 0];

  // 17-tap nonlinear filter: 16 bits (x1..x16, LSB..MSB) feed the GF(2^16) inversion S-box;
  // the 17th tap (offset 0) is XORed directly into the filter output separately (linmask).
  const FILTER_TAPS = [1, 6, 9, 19, 21, 44, 58, 74, 98, 105, 134, 161, 193, 227, 244, 255];

  // 16 resynchronization feedback positions, in the exact bit0..bit15 extraction order used
  // by both the reference implementation and the DarkCrypt port.
  const DIFFUSION_POS = [80, 17, 66, 179, 52, 213, 118, 247, 232, 41, 154, 11, 204, 173, 142, 111];

  const GF_FIELD_SIZE = 0xFFFF;       // |GF(2^16)*|
  const GF_REDUCTION = 0x002D;        // low 16 bits of x^16+x^5+x^3+x^2+1

  // Precompute the GF(2^16) multiplicative-inverse table modulo x^16+x^5+x^3+x^2+1 once, shared
  // by every instance (matches the one-time table build performed in setup()).
  const GF_EXP = new Uint16Array(GF_FIELD_SIZE);
  const GF_LOG = new Uint16Array(0x10000);
  (function buildGfTables() {
    let x = 1;
    for (let n = 0; n < GF_FIELD_SIZE; n++) {
      GF_EXP[n] = x;
      GF_LOG[x] = n;
      x = OpCodes.Shl32(x, 1);
      if (OpCodes.AndN(x, 0x10000)) x = OpCodes.XorN(x, GF_REDUCTION);
      x &= 0xFFFF;
    }
  })();
  function gfInverse(v) {
    if (v === 0) return 0;
    const n = GF_LOG[v];
    const invN = (GF_FIELD_SIZE - n) % GF_FIELD_SIZE;
    return GF_EXP[invN];
  }

  class DarkCryptSfinksAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Sfinks (DarkCrypt)";
      this.description = "eSTREAM Phase-2 Sfinks nonlinear filter generator (256-bit LFSR, GF(2^16) inversion filter, 80-bit key, 80-bit IV, 128-round resynchronization, 7-stage pipelined output combiner) as implemented in the DarkCrypt Total Commander plugin. Cross-validated against the authors' published ECRYPT reference implementation.";
      this.inventor = "An Braeken, Joseph Lano, Nele Mentens, Bart Preneel, Ingrid Verbauwhede";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(10, 10, 0)];   // fixed 80-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("SFINKS: A Synchronous Stream Cipher for Restricted Hardware Environments (eSTREAM Phase 2)", "https://www.ecrypt.eu.org/stream/p2ciphers/sfinks/sfinks_p2.pdf"),
        new LinkItem("eSTREAM: Sfinks reference implementation and test vectors", "https://www.ecrypt.eu.org/stream/e2-sfinks.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Algebraic attack margin", "The authors' own security analysis places the algebraic attack complexity at approximately 2^108, which the paper itself describes as \"quite close to the edge\" for an 80-bit-security design; a weight-17 feedback polynomial and 16-bit inversion filter of algebraic immunity 6 leave limited security margin against fast algebraic attacks.", "Use a vetted modern stream cipher (e.g. ChaCha20) for real-world confidentiality needs."),
        new Vulnerability("Fixed 80-bit key/IV, no authentication in this port", "This port implements only the keystream generator; the paper's associated 64-bit LFSR-hash MAC construction is not reproduced. Reused (key, IV) pairs, as with any synchronous stream cipher, catastrophically break confidentiality.", "Never reuse a (key, IV) pair; use an AEAD construction if integrity protection is required.")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv) then crypt(in,out,len) XOR),
      // cross-validated bit-for-bit against the authors' ECRYPT reference implementation (sfinks.c).
      this.tests = [
        {
          text: "DarkCrypt Sfinks — keystream from incrementing key, zero IV, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00010203040506070809"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000"),
          expected: OpCodes.Hex8ToBytes("46abc6a2d7d2274c636a99ae3b093b9ca2cb1f269e4c791d7d32a5fd0fef52b1524a3d21bff9d679a535bef58224720ab2542a300dd38de025c6c512d5a42a362166054304ce4335a200d74a367ce047a0be15da8a0190d722e2fe2340ebc7ca41a9931f28e84f46618adad93c3e7a5c748a0167b2d3ed1eab61443ca3d33a65")
        },
        {
          text: "DarkCrypt Sfinks — incrementing key/plaintext, zero IV",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("00010203040506070809"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000"),
          expected: OpCodes.Hex8ToBytes("46aac4a1d3d7214b6b6393a537043593b2da0d358a596f0a652bbfe613f24cae726b1f029bdcf05e8d1c94deae095c258265180339e6bbd71dffff29e9991409")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSfinksInstance(this, isInverse);
    }
  }

  class DarkCryptSfinksInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;
      this._lfsr = null;    // 256-entry bit array (0/1)
      this._pipeY = null;   // 7-entry delay line carrying past filter (INV) outputs (16-bit words)
      this._pipeX0 = null;  // 7-entry delay line carrying past raw LFSR bit-0 values (0/1)
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 10)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Sfinks (DarkCrypt) requires exactly 10 bytes`);
      this._key = [...keyBytes];
      this._tryInit();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; return; }
      if (ivBytes.length !== 10)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. Sfinks (DarkCrypt) requires exactly 10 bytes`);
      this._iv = [...ivBytes];
      this._tryInit();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

    set nonce(nonceBytes) { this.iv = nonceBytes; }
    get nonce() { return this.iv; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._lfsr) throw new Error("Key/IV not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._lfsr) throw new Error("Key/IV not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.XorN(this.inputBuffer[i], this._nextKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    _tryInit() {
      if (!this._key || !this._iv) { this._lfsr = null; return; }

      const s = new Array(LFSR_BITS).fill(0);
      // Key occupies bits 96..175, IV occupies bits 176..255, both LSB-first per byte;
      // bit 95 is fixed to 1 (domain separator), matching the published resync setup.
      for (let b = 0; b < 80; b++) {
        s[96 + b] = OpCodes.AndN(OpCodes.Shr32(this._key[OpCodes.Shr32(b, 3)], OpCodes.And32(b, 7)), 1);
        s[176 + b] = OpCodes.AndN(OpCodes.Shr32(this._iv[OpCodes.Shr32(b, 3)], OpCodes.And32(b, 7)), 1);
      }
      s[95] = 1;

      this._lfsr = s;
      this._pipeY = new Array(PIPE_DEPTH).fill(0);
      this._pipeX0 = new Array(PIPE_DEPTH).fill(0);

      for (let t = 0; t < RESYNC_ROUNDS; t++) this._resyncRound();
    }

    // Standard Fibonacci LFSR clock: 256-bit shift with weight-17 feedback into bit 255.
    _clockLfsr() {
      const s = this._lfsr;
      let fb = 0;
      for (const p of FEEDBACK_TAPS) fb = OpCodes.XorN(fb, s[p]);
      for (let i = 0; i < LFSR_BITS - 1; i++) s[i] = s[i + 1];
      s[LFSR_BITS - 1] = fb;
    }

    // 17-tap nonlinear filter: builds the 16-bit inversion input from the LFSR taps and
    // returns the GF(2^16) inverse (the 17th tap, offset 0, is read separately as "x0").
    _computeFilterY() {
      const s = this._lfsr;
      let v = 0;
      for (let i = 0; i < 16; i++) v = OpCodes.OrN(v, OpCodes.Shl32(s[FILTER_TAPS[i]], i));
      return gfInverse(v);
    }

    // Pushes this round's fresh filter output / raw bit-0 into the two 7-stage delay lines
    // (mirrors the reference's pipe[]/linmask[] shift-and-append).
    _shiftPipes() {
      const y = this._computeFilterY();
      const x0 = this._lfsr[0];
      this._pipeY = [...this._pipeY.slice(1), y];
      this._pipeX0 = [...this._pipeX0.slice(1), x0];
    }

    // One resynchronization round: clock the LFSR, read the OLDEST pipelined filter output
    // (pre-shift) and XOR its 16 bits into the 16 fixed feedback positions, then advance
    // the delay lines with this round's freshly computed values.
    _resyncRound() {
      this._clockLfsr();
      const yFront = this._pipeY[0];
      for (let k = 0; k < 16; k++)
        this._lfsr[DIFFUSION_POS[k]] = OpCodes.XorN(this._lfsr[DIFFUSION_POS[k]], OpCodes.AndN(OpCodes.Shr32(yFront, k), 1));
      this._shiftPipes();
    }

    // One keystream-generation round: clock the LFSR, advance the delay lines FIRST, then
    // combine the (now one-step-fresher) oldest entries of both delay lines into one bit.
    _cryptRoundBit() {
      this._clockLfsr();
      this._shiftPipes();
      const yBit = OpCodes.AndN(this._pipeY[0], 1);
      const x0Bit = OpCodes.AndN(this._pipeX0[0], 1);
      return OpCodes.XorN(yBit, x0Bit);
    }

    _nextKeystreamByte() {
      let byte = 0;
      for (let i = 0; i < 8; i++)
        byte = OpCodes.XorN(OpCodes.AndN(OpCodes.Shl32(byte, 1), 0xFF), this._cryptRoundBit());
      return byte;
    }
  }

  const algorithmInstance = new DarkCryptSfinksAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSfinksAlgorithm, DarkCryptSfinksInstance };
}));
