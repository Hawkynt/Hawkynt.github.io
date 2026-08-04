/*
 * Curupira-1 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Curupira-1, designed by Paulo S. L. M. Barreto and Marcos A. Simplicio Jr.
 * (SBRC 2007), as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). 96-bit block, 3x4-byte state matrix
 * organized column-major. Involutional round function over GF(2^8) with
 * modulus p8(x) = x^8+x^6+x^3+x^2+1 (byte 0x14D): a nonlinear substitution
 * layer (gamma), a row permutation (pi) using b[i][j] = a[i][i XOR j], an MDS
 * diffusion layer (theta) via the involutory matrix D = [[3,2,2],[4,5,4],[6,6,7]],
 * and a key-addition layer (sigma). Decryption reuses the encryption round
 * function with round keys in reverse order; every round key except the two
 * outermost ones is pre-transformed by theta (the standard Anubis/Khazad/BKSQ
 * involutional-cipher trick), since gamma/pi/theta/sigma are each individually
 * self-inverse but their composed sequence is not.
 *
 * The key schedule expands a 3x2t byte matrix (2t=key bytes/3 columns) via
 * repeated application of: constant addition (XORing S-box-derived bytes into
 * row 0), a cyclic shift (row 1 left, row 2 right), and a second GF(2^8) MDS
 * diffusion using E = [[1+c,c,c],[c,1+c,c],[c,c,1+c]] with c = x^85 mod p8(x)
 * = 0x1C. Each round key is derived from the evolved key matrix by S-boxing
 * row 0 of its first 4 columns and taking rows 1-2 unchanged (function phi).
 *
 * This implementation is bit-exact validated against the DarkCrypt plugin's
 * 192-bit-key behavior: the S-box differs from the published Anubis/Khazad
 * S-box despite using the same involutional construction style, and the
 * DarkCrypt implementation uses 23 rounds for a 192-bit key rather than the
 * 18 rounds suggested by the original paper's benchmark table. The round
 * count for 96/144-bit keys (R = 4t+7, t = key bytes/6) is an unverified
 * extrapolation preserving the paper's linear per-t slope shifted to match
 * the confirmed 192-bit data point; only 192-bit test vectors were available
 * to validate against the DarkCrypt implementation. Educational only.
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

  // S-box used by the DarkCrypt implementation. Self-inverse (S[S[x]]=x for all x) but
  // NOT the same permutation as the published Anubis/Khazad S-box, despite the paper's
  // claim of using an identical construction.
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

  // Involutory MDS diffusion matrix used by the round function's theta layer (D*D = I).
  const D_MATRIX = [[3,2,2],[4,5,4],[6,6,7]];

  // Cube root of unity c(x) = x^85 mod p8(x) = 0x1C, used to build the key-schedule's E matrix.
  const CUBE_ROOT = 0x1C;
  const E_MATRIX = [
    [OpCodes.Xor32(1, CUBE_ROOT), CUBE_ROOT, CUBE_ROOT],
    [CUBE_ROOT, OpCodes.Xor32(1, CUBE_ROOT), CUBE_ROOT],
    [CUBE_ROOT, CUBE_ROOT, OpCodes.Xor32(1, CUBE_ROOT)]
  ];

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

  // gamma: nonlinear S-box substitution layer, every byte of the state.
  function gamma(state) {
    const out = new Array(state.length);
    for (let i = 0; i < state.length; i++) out[i] = SBOX[state[i]];
    return out;
  }

  // pi: row permutation layer. Block state is column-major (state[col*3+row]).
  // Row 0 unchanged; row i in {1,2}: b[i][j] = a[i][i XOR j]. Self-inverse.
  function piLayer(state, cols) {
    const out = state.slice();
    for (let i = 1; i < 3; i++)
      for (let j = 0; j < cols; j++)
        out[j * 3 + i] = state[OpCodes.Xor32(i, j) * 3 + i];
    return out;
  }

  // theta: linear MDS diffusion layer, D-matrix multiply applied per column.
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

  // Round count: R = 4t + 7 (t = key bytes / 6). Matches the confirmed 192-bit (t=4)
  // DarkCrypt behavior (R=23) exactly; the formula for other key sizes is an unverified
  // extrapolation of the paper's own linear per-t progression, shifted to fit that
  // single confirmed data point.
  function roundCountFor(t) { return 4 * t + 7; }

  // Key schedule: 3 x 2t byte matrix (column-major), evolved via constant addition
  // (sigma_q), cyclic row shift (xi), and E-matrix diffusion (mu). Round key kappa^(r)
  // is derived from K^(r) via phi: S-box row 0 of the first 4 columns, rows 1-2 raw.
  function keySchedule(keyBytes, rounds, t) {
    const cols2t = 2 * t;
    let K = keyBytes.slice(); // 3 x cols2t, column-major: K[col*3+row]

    function phi(mat) {
      const out = new Array(3 * BLOCK_COLS);
      for (let c = 0; c < BLOCK_COLS; c++) {
        out[c * 3 + 0] = SBOX[mat[c * 3 + 0]];
        out[c * 3 + 1] = mat[c * 3 + 1];
        out[c * 3 + 2] = mat[c * 3 + 2];
      }
      return out;
    }

    const roundKeys = [phi(K)]; // kappa^(0)

    for (let r = 1; r <= rounds; r++) {
      // sigma_q: constant addition into row 0 only.
      const K2 = K.slice();
      for (let j = 0; j < cols2t; j++) {
        const q = SBOX[OpCodes.And32(cols2t * (r - 1) + j, 0xFF)];
        K2[j * 3 + 0] ^= q;
      }
      // xi: cyclic shift, row 1 left by one column, row 2 right by one column.
      const K3 = K2.slice();
      for (let j = 0; j < cols2t; j++) {
        K3[j * 3 + 1] = K2[((j + 1) % cols2t) * 3 + 1];
        K3[j * 3 + 2] = K2[((j - 1 + cols2t) % cols2t) * 3 + 2];
      }
      // mu: E-matrix multiply, applied per column across all cols2t columns.
      const K4 = new Array(3 * cols2t);
      for (let c = 0; c < cols2t; c++) {
        const col = [K3[c * 3 + 0], K3[c * 3 + 1], K3[c * 3 + 2]];
        const nc = matmul3(E_MATRIX, col);
        K4[c * 3 + 0] = nc[0]; K4[c * 3 + 1] = nc[1]; K4[c * 3 + 2] = nc[2];
      }
      K = K4;
      roundKeys.push(phi(K));
    }
    return roundKeys; // length rounds+1: kappa^(0) .. kappa^(rounds)
  }

  function encryptBlock(ptBytes, keyBytes, t) {
    const R = roundCountFor(t);
    const roundKeys = keySchedule(keyBytes, R, t);
    let state = xorState(ptBytes, roundKeys[0]);
    for (let r = 1; r < R; r++) {
      state = gamma(state);
      state = piLayer(state, BLOCK_COLS);
      state = thetaLayer(state, BLOCK_COLS);
      state = xorState(state, roundKeys[r]);
    }
    // Last Round Function: gamma, pi, sigma (no theta).
    state = gamma(state);
    state = piLayer(state, BLOCK_COLS);
    state = xorState(state, roundKeys[R]);
    return state;
  }

  function decryptBlock(ctBytes, keyBytes, t) {
    const R = roundCountFor(t);
    const encKeys = keySchedule(keyBytes, R, t);

    // Involutional decryption: round keys used in reverse order; every key except
    // the two outermost ones is pre-transformed by theta.
    const decKeys = new Array(R + 1);
    decKeys[0] = encKeys[R];
    decKeys[R] = encKeys[0];
    for (let r = 1; r < R; r++) decKeys[r] = thetaLayer(encKeys[R - r], BLOCK_COLS);

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

  class DarkCryptCurupira1Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Curupira-1 (DarkCrypt)";
      this.description = "Curupira-1 block cipher (Barreto and Simplicio, SBRC 2007) as implemented in the DarkCrypt Total Commander plugin: involutional round function (S-box, row permutation, GF(2^8) MDS diffusion, key XOR) over a 3x4 byte state, with a GF(2^8) key schedule. 96-bit block, 96/144/192-bit key. Only the 192-bit key path was vector-validated against the DarkCrypt implementation.";
      this.inventor = "Paulo S. L. M. Barreto, Marcos A. Simplicio Jr. (base cipher); DarkCrypt port by Alexander Myasnikov";
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
        new Vulnerability("Unanalyzed variant", "Round count and S-box calibrated against a single DarkCrypt build rather than the original academic specification; not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Curupira1 — zero key/plaintext (192-bit key)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("f174d6feb1be8c3487f51330")
        },
        {
          text: "DarkCrypt Curupira1 — incrementing key/plaintext (192-bit key)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f1011121314151617"),
          expected: OpCodes.Hex8ToBytes("bc8d14a7abf41c2420f73ae8")
        },
        {
          text: "DarkCrypt Curupira1 — shifted incrementing key/plaintext (192-bit key)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718"),
          expected: OpCodes.Hex8ToBytes("62c69122b36105fc644ed3d6")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptCurupira1Instance(this, isInverse);
    }
  }

  class DarkCryptCurupira1Instance extends IBlockCipherInstance {
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Curupira-1 (DarkCrypt) requires 12, 18, or 24 bytes`);
      this._key = [...keyBytes];
      this._t = keyBytes.length / 6;
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
        output.push(...(this.isInverse
          ? decryptBlock(block, this._key, this._t)
          : encryptBlock(block, this._key, this._t)));
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptCurupira1Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptCurupira1Algorithm, DarkCryptCurupira1Instance };
}));
