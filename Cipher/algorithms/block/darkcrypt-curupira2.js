/*
 * Curupira-2 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Curupira-2, designed by Simplicio, Barreto, Carvalho, Margi and Naslund
 * ("The Curupira-2 Block Cipher for Constrained Platforms", 2007), as
 * implemented in the DarkCrypt Total Commander plugin (Alexander Myasnikov,
 * "Zarya" project). Shares its 96-bit block round function (gamma/pi/theta/
 * sigma over a 3x4 byte state, GF(2^8) with modulus p8(x)=x^8+x^6+x^3+x^2+1)
 * with Curupira-1; only the key schedule differs.
 *
 * The key schedule treats the 6t-byte key as a circular byte buffer and
 * evolves it step by step via a Galois-LFSR-style "multiply by x^8 in
 * GF(2^(48t))" transform: at step s (0-indexed), a schedule constant
 * S[s] is XORed into the buffer at a moving position pos = s mod (6t); the
 * resulting byte then feeds two neighboring positions (pos-1 and pos-2, mod
 * 6t) via the paper's universal per-byte shift-XOR functions T1(u) =
 * (u<<3)^(u<<5) and T0(u) = u^(u>>3)^(u>>5). Round key kappa^(r) is a 12-byte
 * sliding window read from the evolved buffer (wrapping mod 6t, S-boxing
 * every 3rd byte for row 0, rows 1-2 raw), starting at offset 0 for kappa^(0)
 * and at offset r for kappa^(r), r >= 1.
 *
 * This implementation is bit-exact validated against the DarkCrypt plugin's
 * 192-bit-key (t=4) behavior. That validation resolves an ambiguity the
 * original paper leaves open (two inconsistent p192(x) moduli are given in
 * different sections): no explicit modulus is needed at all, because the
 * paper's own closed-form, modulus-independent T0/T1 shortcut can be applied
 * directly, one byte at a time. The DarkCrypt implementation uses 18 rounds
 * for a 192-bit key, not the 14 suggested by the paper's benchmark table.
 * The round count for 96/144-bit keys (R = 2t+10, t = key bytes/6) is an
 * unverified extrapolation of the paper's own linear per-t progression,
 * shifted to fit the confirmed 192-bit data point; only 192-bit test
 * vectors were available to validate against the DarkCrypt implementation.
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

  // Same S-box as the DarkCrypt Curupira-1 implementation (byte-identical).
  // Self-inverse (S[S[x]]=x) but not the published Anubis/Khazad permutation.
  const SBOX = Object.freeze([
    186,84,47,116,83,211,210,77,80,172,141,191,112,82,154,76,234,213,151,209,51,81,91,166,
    222,72,168,153,219,50,183,252,227,158,145,155,226,187,65,110,165,203,107,149,161,243,177,2,
    204,196,29,20,195,99,218,93,95,220,125,205,127,90,108,92,247,38,255,237,232,157,111,142,
    25,160,240,137,15,7,175,251,8,21,13,4,1,100,223,118,121,221,61,22,63,55,109,56,
    185,115,233,53,85,113,123,140,114,136,246,42,62,94,39,70,12,101,104,97,3,193,87,214,
    217,88,216,102,215,58,200,60,250,150,167,152,236,184,199,174,105,75,171,169,103,10,71,242,
    181,34,229,238,190,43,129,18,131,27,14,35,245,69,33,206,73,44,249,230,182,40,23,130,
    26,139,254,138,9,201,135,78,225,46,228,224,235,144,164,30,133,96,0,37,244,241,148,11,
    231,117,239,52,49,212,208,134,126,173,253,41,48,59,159,248,198,19,6,5,197,17,119,124,
    122,120,54,28,57,89,24,86,179,176,36,32,178,146,163,192,68,98,16,180,132,67,147,194,
    74,189,143,45,188,156,106,64,207,162,128,79,31,202,170,66
  ]);

  // GF(2^8) with p8(x) = x^8+x^6+x^3+x^2+1 (reduction byte 0x4D, full modulus 0x14D).
  const P8 = 0x14D;
  function gmul(a, b) { return OpCodes.GFMul(a, b, P8, 8); }
  // "Multiply by 2" (xtime) in the same field, used by the round function's fused theta+sigma.
  function gmul2(u) {
    const hi = OpCodes.And32(u, 0x80);
    let r = OpCodes.And32(OpCodes.Shl32(u, 1), 0xFF);
    if (hi) r ^= 0x4D;
    return r;
  }

  // Involutory MDS diffusion matrix D = [[3,2,2],[4,5,4],[6,6,7]] (D*D = I), applied via the
  // sum/mul2/mul4/mul6 identity: theta(b)_0 = b0^2*sum, theta(b)_1 = b1^4*sum,
  // theta(b)_2 = b2^6*sum, where sum = b0^b1^b2 (matches the DarkCrypt implementation's
  // fused theta+sigma round function exactly).
  const D_MATRIX = [[3,2,2],[4,5,4],[6,6,7]];
  function matmul3(matrix, col) {
    const out = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      let v = 0;
      for (let j = 0; j < 3; j++) v ^= gmul(matrix[i][j], col[j]);
      out[i] = v;
    }
    return out;
  }

  const BLOCK_COLS = 4; // 96-bit block = 3 rows x 4 columns, fixed regardless of key size

  function gamma(state) {
    const out = new Array(state.length);
    for (let i = 0; i < state.length; i++) out[i] = SBOX[state[i]];
    return out;
  }

  // pi: row permutation layer, identical to Curupira-1's. Row 0 unchanged; row i in
  // {1,2}: b[i][j] = a[i][i XOR j]. Column-major state (state[col*3+row]). Self-inverse.
  function piLayer(state, cols) {
    const out = state.slice();
    for (let i = 1; i < 3; i++)
      for (let j = 0; j < cols; j++)
        out[j * 3 + i] = state[OpCodes.Xor32(i, j) * 3 + i];
    return out;
  }

  function thetaLayer(state, cols) {
    const out = new Array(cols * 3);
    for (let c = 0; c < cols; c++) {
      const col = [state[c * 3 + 0], state[c * 3 + 1], state[c * 3 + 2]];
      const nc = matmul3(D_MATRIX, col);
      out[c * 3 + 0] = nc[0]; out[c * 3 + 1] = nc[1]; out[c * 3 + 2] = nc[2];
    }
    return out;
  }

  function xorState(a, b) {
    const out = new Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = OpCodes.Xor32(a[i], b[i]);
    return out;
  }

  // Fused theta+sigma: for each of the 4 columns, theta's D-matrix multiply (expressed via
  // the sum/mul2/mul4/mul6 identity) is XORed together with the round-key column in one pass.
  function thetaSigmaFused(state, roundKey) {
    const out = state.slice();
    for (let c = 0; c < BLOCK_COLS; c++) {
      const b0 = out[c * 3 + 0], b1 = out[c * 3 + 1], b2 = out[c * 3 + 2];
      const sum = OpCodes.Xor32(OpCodes.Xor32(b0, b1), b2);
      const mul2 = gmul2(sum), mul4 = gmul2(mul2);
      out[c * 3 + 0] = OpCodes.Xor32(OpCodes.Xor32(b0, mul2), roundKey[c * 3 + 0]);
      out[c * 3 + 1] = OpCodes.Xor32(OpCodes.Xor32(b1, mul4), roundKey[c * 3 + 1]);
      out[c * 3 + 2] = OpCodes.Xor32(OpCodes.Xor32(b2, OpCodes.Xor32(mul2, mul4)), roundKey[c * 3 + 2]);
    }
    return out;
  }

  // T0/T1: the paper's "for all key sizes" universal shift-XOR functions used by the GF(2^(48t))
  // "multiply by x^8" (Ϝ) transform's byte-wise Galois-LFSR implementation.
  function T0(u) { return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(u, OpCodes.Shr32(u, 3)), OpCodes.Shr32(u, 5)), 0xFF); }
  function T1(u) { return OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(u, 3), OpCodes.Shl32(u, 5)), 0xFF); }

  // One key-schedule evolution step: XOR the schedule constant S[step] into the circular
  // buffer at position (step mod bufSize), then fan that byte's T1/T0 contributions into the
  // two preceding positions (mod bufSize).
  function evolveStep(buf, step, bufSize) {
    const out = buf.slice();
    const pos = step % bufSize;
    out[pos] ^= SBOX[OpCodes.And32(step, 0xFF)];
    const v = out[pos];
    const i1 = (pos - 1 + bufSize) % bufSize;
    const i2 = (pos - 2 + bufSize) % bufSize;
    out[i1] ^= T1(v);
    out[i2] ^= T0(v);
    return out;
  }

  // 12-byte sliding-window round-key extraction from the (evolving) circular key buffer,
  // wrapping mod bufSize; row 0 of each 3-byte group is S-boxed, rows 1-2 are raw.
  function windowKey(buf, startOffset, bufSize) {
    const out = new Array(3 * BLOCK_COLS);
    let w = startOffset % bufSize;
    for (let i = 0; i < BLOCK_COLS; i++) {
      const a = buf[w]; w = (w + 1) % bufSize;
      const b = buf[w]; w = (w + 1) % bufSize;
      const c = buf[w]; w = (w + 1) % bufSize;
      out[i * 3 + 0] = SBOX[a];
      out[i * 3 + 1] = b;
      out[i * 3 + 2] = c;
    }
    return out;
  }

  // Round count: R = 2t + 10 (t = key bytes / 6). Matches the confirmed 192-bit (t=4)
  // DarkCrypt behavior (R=18) exactly; the formula for other key sizes is an unverified
  // extrapolation of the paper's own linear per-t progression, shifted to fit that single
  // confirmed point.
  function roundCountFor(t) { return 2 * t + 10; }

  function computeRoundKeys(keyBytes, rounds, t) {
    const bufSize = 6 * t;
    let buf = keyBytes.slice();
    const kappas = [windowKey(buf, 0, bufSize)];
    for (let r = 1; r <= rounds; r++) {
      buf = evolveStep(buf, r - 1, bufSize);
      kappas.push(windowKey(buf, r, bufSize));
    }
    return kappas; // length rounds+1: kappa^(0) .. kappa^(rounds)
  }

  function encryptBlock(ptBytes, keyBytes, t) {
    const R = roundCountFor(t);
    const kappas = computeRoundKeys(keyBytes, R, t);
    let state = xorState(ptBytes, kappas[0]);
    for (let r = 1; r < R; r++) {
      state = gamma(state);
      state = piLayer(state, BLOCK_COLS);
      state = thetaSigmaFused(state, kappas[r]);
    }
    // Last Round Function: gamma, pi, sigma (no theta).
    state = gamma(state);
    state = piLayer(state, BLOCK_COLS);
    state = xorState(state, kappas[R]);
    return state;
  }

  function decryptBlock(ctBytes, keyBytes, t) {
    const R = roundCountFor(t);
    const kappas = computeRoundKeys(keyBytes, R, t);

    // Involutional decryption: round keys used in reverse order; every key except the two
    // outermost ones is pre-transformed by theta (standard Anubis/Khazad/BKSQ construction).
    const decKeys = new Array(R + 1);
    decKeys[0] = kappas[R];
    decKeys[R] = kappas[0];
    for (let r = 1; r < R; r++) decKeys[r] = thetaLayer(kappas[R - r], BLOCK_COLS);

    let state = xorState(ctBytes, decKeys[0]);
    for (let r = 1; r < R; r++) {
      state = gamma(state);
      state = piLayer(state, BLOCK_COLS);
      state = thetaLayer(state, BLOCK_COLS);
      state = xorState(state, decKeys[r]);
    }
    state = gamma(state);
    state = piLayer(state, BLOCK_COLS);
    state = xorState(state, decKeys[R]);
    return state;
  }

  class DarkCryptCurupira2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Curupira-2 (DarkCrypt)";
      this.description = "Curupira-2 block cipher (Simplicio, Barreto, Carvalho, Margi, Naslund, 2007) as implemented in the DarkCrypt Total Commander plugin: shares Curupira-1's involutional round function (S-box, row permutation, GF(2^8) MDS diffusion, key XOR) over a 3x4 byte state, but replaces the key schedule with a GF(2^(48t)) Galois-LFSR-style evolution. 96-bit block, 96/144/192-bit key. Only the 192-bit key path was vector-validated against the DarkCrypt implementation.";
      this.inventor = "Marcos A. Simplicio Jr., Paulo S. L. M. Barreto, Tereza C. M. B. Carvalho, Cintia B. Margi, Mats Naslund (base cipher); DarkCrypt port by Alexander Myasnikov";
      this.year = 2007;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BR;

      this.SupportedKeySizes = [new KeySize(12, 24, 6)];  // 96/144/192-bit in 48-bit steps
      this.SupportedBlockSizes = [new KeySize(12, 12, 0)]; // fixed 96-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("The Curupira-2 Block Cipher for Constrained Platforms: Specification and Benchmarking", "https://ceur-ws.org/Vol-397/paper8.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed variant", "Round count and key-schedule details calibrated against a single DarkCrypt build rather than the original academic specification; not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Curupira2 — zero key/plaintext (192-bit key)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d97d2c29506cb633b5aa2a43")
        },
        {
          text: "DarkCrypt Curupira2 — incrementing key/plaintext (192-bit key)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f1011121314151617"),
          expected: OpCodes.Hex8ToBytes("77ba02249f52ad21bed4794f")
        },
        {
          text: "DarkCrypt Curupira2 — shifted incrementing key/plaintext (192-bit key)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718"),
          expected: OpCodes.Hex8ToBytes("dcc0d63e13095c6187a165e3")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptCurupira2Instance(this, isInverse);
    }
  }

  class DarkCryptCurupira2Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._t = 0;
      this.inputBuffer = [];
      this.BlockSize = 12;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._t = 0; this.KeySize = 0; return; }
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
      );
      if (!isValidSize)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Curupira-2 (DarkCrypt) requires 12, 18, or 24 bytes`);
      this._key = [...keyBytes];
      this._t = keyBytes.length / 6;
      this.KeySize = keyBytes.length;
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
        output.push(...(this.isInverse
          ? decryptBlock(block, this._key, this._t)
          : encryptBlock(block, this._key, this._t)));
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptCurupira2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptCurupira2Algorithm, DarkCryptCurupira2Instance };
}));
