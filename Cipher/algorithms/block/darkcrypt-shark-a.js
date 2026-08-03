/*
 * SHARK-A (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SHARK-A as implemented in the DarkCrypt Total Commander plugin.
 * This is a non-standard SHARK variant: while it reuses the classic SHARK S-box
 * and C-box tables (Rijmen/Daemen/Preneel/Bosselaers/De Win, 1996) for its
 * internal key-schedule "bootstrap" cipher, the MAIN block transform is entirely
 * different from textbook/Crypto++ SHARK:
 *   - the plaintext is first whitened with a byte-wise GF(2^8) multiplication
 *     against a dedicated "multiplier" round key (not present in standard SHARK)
 *   - every one of the 6 main rounds applies a FULL 8x8 GF(2^8) diffusion matrix
 *     (no separate "S-box only" final round as in textbook SHARK)
 *   - each round's diffusion matrix is derived from a static 8x8 GF(2^8) matrix
 *     scaled, per output byte, by a dedicated round key (rounds 0-4), while the
 *     final round instead derives its matrix from a matrix-matrix product
 *     involving the SHARK inverse-MDS matrix and a dedicated round key
 *   - round keys are produced by a CFB-style bootstrap cipher followed by
 *     rejection sampling: a candidate round key is only accepted if the
 *     bitwise AND of its 8 bytes is non-zero (this both derives the
 *     "multiplier" key and the 6 per-round diffusion keys)
 * As implemented in the DarkCrypt Total Commander plugin; test vectors verified
 * against the DarkCrypt implementation.
 * 64-bit blocks, 128-bit keys. Educational only.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes', './shark-cboxes.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./shark-cboxes.data')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes, root.SharkCBoxes);
  }
}((function () {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, SharkCBoxes) {
  'use strict';

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');
  if (!SharkCBoxes) throw new Error('SharkCBoxes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const { CBOX_ENC } = SharkCBoxes;

  // GF(2^8) multiplication with SHARK's irreducible polynomial (x^8+x^7+x^6+x^5+x^4+x^2+1, 0x1F5 in
  // the "bit 8 implied" convention used by OpCodes.GFMul).
  function gfMul(a, b) { return OpCodes.GFMul(a, b, 0x1F5, 8); }

  // ===== Encryption S-box (identical to the classic SHARK S-box) =====
  const SBOX_ENC = Object.freeze([
    177,206,195,149, 90,173,231,  2, 77, 68,251,145, 12,135,161, 80,
    203,103, 84,221, 70,143,225, 78,240,253,252,235,249,196, 26,110,
     94,245,204,141, 28, 86, 67,254,  7, 97,248,117, 89,255,  3, 34,
    138,209, 19,238,136,  0, 14, 52, 21,128,148,227,237,181, 83, 35,
     75, 71, 23,167,144, 53,171,216,184,223, 79, 87,154,146,219, 27,
     60,200,153,  4,142,224,215,125,133,187, 64, 44, 58, 69,241, 66,
    101, 32, 65, 24,114, 37,147,112, 54,  5,242, 11,163,121,236,  8,
     39, 49, 50,182,124,176, 10,115, 91,123,183,129,210, 13,106, 38,
    158, 88,156,131,116,179,172, 48,122,105,119, 15,174, 33,222,208,
     46,151, 16,164,152,168,212,104, 45, 98, 41,109, 22, 73,118,199,
    232,193,150, 55,229,202,244,233, 99, 18,194,166, 20,188,211, 40,
    175, 47,230, 36, 82,198,160,  9,189,140,207, 93, 17, 95,  1,197,
    159, 61,162,155,201, 59,190, 81, 25, 31, 63, 92,178,239, 74,205,
    191,186,111,100,217,243, 62,180,170,220,213,  6,192,126,246,102,
    108,132,113, 56,185, 29,127,157, 72,139, 42,218,165, 51,130, 57,
    214,120,134,250,228, 43,169, 30,137, 96,107,234, 85, 76,247,226
  ]);

  const SBOX_DEC = Object.freeze((function () {
    const t = new Array(256);
    for (let i = 0; i < 256; ++i) t[SBOX_ENC[i]] = i;
    return t;
  })());

  // Static 8x8 GF(2^8) matrix used by the DarkCrypt round-table generator.
  // Distinct from the classic SHARK G/iG matrices.
  const MATRIX_M = Object.freeze([
    [206,149, 87,130,138, 25,176,  1],
    [231,254,  5,210, 82,193,136,241],
    [185,218, 77,209,158, 23,131,134],
    [208,157, 38, 44, 93,159,109,117],
    [ 82,169,  7,108,185,143,112, 23],
    [135, 40, 58, 90,244, 51, 11,108],
    [116, 81, 21,207,  9,164, 98,  9],
    [ 11, 49,127,134,190,  5,131, 52]
  ].map(row => Object.freeze(row)));

  // Inverse of the classic SHARK MDS matrix G; used both to finish the key-schedule
  // bootstrap keys and to build the final round's diffusion matrix.
  const MATRIX_IG = Object.freeze([
    [231, 48,144,133,208, 75,145, 65],
    [ 83,149,155,165,150,188,161,104],
    [  2, 69,247,101, 92, 31,182, 82],
    [162,202, 34,148, 68, 99, 42,162],
    [252,103,142, 16, 41,117,133,113],
    [ 36, 69,162,207, 47, 34,193, 14],
    [161,241,113, 64,145, 39, 24,165],
    [ 86,244,175, 50,210,164,220,113]
  ].map(row => Object.freeze(row)));

  // Fixed CFB "seed" keys for the key-schedule bootstrap cipher (cbox[0][0..6] of the classic SHARK
  // C-boxes; the 7th is later transformed by MATRIX_IG).
  const INIT_KEYS_RAW = [
    [0x060d838f, 0x16f3a365],
    [0xa68857ee, 0x5cae56f6],
    [0xebf51635, 0x3c2c4d89],
    [0x652174be, 0x88e85bdc],
    [0x0d4e9a80, 0x86c17921],
    [0x27ba7d33, 0xcffa58a1],
    [0x88d9e104, 0xa237b530]
  ];

  const GF_INV = Object.freeze((function () {
    const t = new Array(256).fill(0);
    for (let a = 1; a < 256; ++a)
      for (let b = 1; b < 256; ++b)
        if (gfMul(a, b) === 1) { t[a] = b; break; }
    return t;
  })());

  function xorBytes(a, b) { return a.map((x, i) => OpCodes.Xor32(x, b[i])); }

  function packBE(bytes) {
    return [OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]),
            OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7])];
  }
  function unpackBE(word) {
    return [...OpCodes.Unpack32BE(word[0]), ...OpCodes.Unpack32BE(word[1])];
  }

  // Multiply an 8-byte (MSB-first) vector by an 8x8 GF(2^8) matrix.
  function transformWord8(bytesBE, matrix) {
    const out = new Array(8).fill(0);
    for (let i = 0; i < 8; ++i)
      for (let j = 0; j < 8; ++j)
        out[i] ^= gfMul(matrix[i][j], bytesBE[j]);
    return out;
  }
  function transformWord(word, matrix) { return packBE(transformWord8(unpackBE(word), matrix)); }

  // Classic SHARK C-box round: 8 independent table lookups XORed together (S-box substitution
  // fused with an MDS matrix multiply), used only by the key-schedule bootstrap cipher.
  function cboxRoundBE(bytesBE) {
    let hi = 0, lo = 0;
    for (let i = 0; i < 8; ++i) {
      const e = CBOX_ENC[i][bytesBE[i]];
      hi ^= e[0]; lo ^= e[1];
    }
    return [hi, lo];
  }

  // Fixed initialization keys for the bootstrap cipher (7th entry transformed by MATRIX_IG).
  const BOOTSTRAP_INIT_KEYS = (function () {
    const keys = INIT_KEYS_RAW.map(w => [w[0], w[1]]);
    keys[6] = transformWord(keys[6], MATRIX_IG);
    return keys;
  })();

  // Fixed 6-round classic-SHARK-structured cipher used purely to stretch/whiten key material
  // during the DarkCrypt key schedule (5 C-box rounds + 1 S-box-only final round).
  function bootstrapEncrypt(feedbackWord) {
    let tmp = [OpCodes.Xor32(feedbackWord[0], BOOTSTRAP_INIT_KEYS[0][0]), OpCodes.Xor32(feedbackWord[1], BOOTSTRAP_INIT_KEYS[0][1])];
    for (let round = 1; round < 6; ++round) {
      const c = cboxRoundBE(unpackBE(tmp));
      tmp = [OpCodes.Xor32(c[0], BOOTSTRAP_INIT_KEYS[round][0]), OpCodes.Xor32(c[1], BOOTSTRAP_INIT_KEYS[round][1])];
    }
    const sboxed = unpackBE(tmp).map(b => SBOX_ENC[b]);
    tmp = packBE(sboxed);
    tmp = [OpCodes.Xor32(tmp[0], BOOTSTRAP_INIT_KEYS[6][0]), OpCodes.Xor32(tmp[1], BOOTSTRAP_INIT_KEYS[6][1])];
    return tmp;
  }

  function keyBufBlock(keyBytes, blockIndex) {
    const n = keyBytes.length;
    const bytes = [];
    let idx = (blockIndex * 8) % n;
    for (let i = 0; i < 8; ++i) { bytes.push(keyBytes[idx]); idx = (idx + 1) % n; }
    return packBE(bytes);
  }

  // A candidate round key is only accepted when the bitwise AND of all 8 bytes is non-zero.
  function isValidCandidate(word) {
    const bytes = unpackBE(word);
    let and = 0xFF;
    for (let i = 0; i < 8; ++i) and &= bytes[i];
    return and !== 0;
  }

  // Full 14-entry round-key schedule: RK[0..6] via plain CFB, RK[7..13] via CFB + rejection
  // sampling (RK[7] is the plaintext "multiplier" key; RK[8..12] fold into rounds 0..4's
  // diffusion matrices; RK[13] feeds the final round's diffusion-matrix construction).
  function deriveRoundKeys(keyBytes) {
    let feedback = [0, 0];
    const RK = [];
    for (let block = 0; block < 7; ++block) {
      const enc = bootstrapEncrypt(feedback);
      const plain = keyBufBlock(keyBytes, block);
      const cipher = [OpCodes.Xor32(plain[0], enc[0]), OpCodes.Xor32(plain[1], enc[1])];
      RK.push(cipher);
      feedback = cipher;
    }

    let ch = 7, accepted = 7;
    feedback = RK[6];
    while (ch < 14) {
      const enc = bootstrapEncrypt(feedback);
      const buf = keyBufBlock(keyBytes, ch);
      const candidate = [OpCodes.Xor32(buf[0], enc[0]), OpCodes.Xor32(buf[1], enc[1])];
      feedback = candidate;
      ++ch;
      if (isValidCandidate(candidate)) { RK.push(candidate); ++accepted; }
    }
    while (accepted < 14) {
      const enc = bootstrapEncrypt(feedback);
      feedback = enc;
      if (isValidCandidate(enc)) { RK.push(enc); ++accepted; }
    }
    return RK;
  }

  // Byte-wise (MSB-first) representation of a round-key word, matching the byte
  // order the block state is processed in.
  function toStateBytes(word) { return unpackBE(word).reverse(); }

  // Round diffusion column for rounds 0-4: each output byte k of the column for state-byte
  // position `box` is MATRIX_M[7-k][7-box] scaled (GF multiplied) by round-key byte k.
  function columnSimple(roundKeyBytes, box) {
    const colIndex = 7 - box;
    const col = new Array(8);
    for (let k = 0; k < 8; ++k) col[k] = gfMul(MATRIX_M[7 - k][colIndex], roundKeyBytes[k]);
    return col;
  }

  // Round diffusion column for the final round: a genuine matrix-matrix product of MATRIX_IG
  // (scaled row-wise by RK[13]'s bytes) and MATRIX_M.
  function columnFinal(rk13Bytes, box) {
    const colIndex = 7 - box;
    const col = new Array(8);
    for (let k = 0; k < 8; ++k) {
      let acc = 0;
      for (let j = 0; j < 8; ++j)
        acc ^= gfMul(gfMul(MATRIX_IG[7 - k][j], rk13Bytes[7 - j]), MATRIX_M[j][colIndex]);
      col[k] = acc;
    }
    return col;
  }

  // Assemble the 8x8 GF(2^8) round matrix A[k][box] from a column-generating function.
  function buildRoundMatrix(colsFn) {
    const A = [];
    for (let k = 0; k < 8; ++k) A.push(new Array(8));
    for (let box = 0; box < 8; ++box) {
      const col = colsFn(box);
      for (let k = 0; k < 8; ++k) A[k][box] = col[k];
    }
    return A;
  }

  function matVec(A, v) {
    const out = new Array(8).fill(0);
    for (let k = 0; k < 8; ++k)
      for (let j = 0; j < 8; ++j)
        out[k] ^= gfMul(A[k][j], v[j]);
    return out;
  }

  // Gauss-Jordan inversion of an 8x8 matrix over GF(2^8) (used only to build the decryption path).
  function gfMatrixInverse(A) {
    const n = 8;
    const M = A.map(row => row.slice());
    const I = [];
    for (let i = 0; i < n; ++i) { I.push(new Array(n).fill(0)); I[i][i] = 1; }
    for (let col = 0; col < n; ++col) {
      let pivot = -1;
      for (let r = col; r < n; ++r) if (M[r][col] !== 0) { pivot = r; break; }
      if (pivot < 0) throw new Error('SHARK-A: singular round matrix (unexpected)');
      [M[col], M[pivot]] = [M[pivot], M[col]];
      [I[col], I[pivot]] = [I[pivot], I[col]];
      const inv = GF_INV[M[col][col]];
      for (let c = 0; c < n; ++c) { M[col][c] = gfMul(M[col][c], inv); I[col][c] = gfMul(I[col][c], inv); }
      for (let r = 0; r < n; ++r) {
        if (r === col) continue;
        const factor = M[r][col];
        if (factor === 0) continue;
        for (let c = 0; c < n; ++c) { M[r][c] ^= gfMul(factor, M[col][c]); I[r][c] ^= gfMul(factor, I[col][c]); }
      }
    }
    return I;
  }

  function roundApply(stateBytes, A, foldBytes) {
    const sv = stateBytes.map(v => SBOX_ENC[v]);
    return xorBytes(matVec(A, sv), foldBytes);
  }
  function roundApplyInverse(stateBytes, Ainv, foldBytes) {
    const xored = xorBytes(stateBytes, foldBytes);
    const sv = matVec(Ainv, xored);
    return sv.map(x => SBOX_DEC[x]);
  }

  class SharkADarkCryptAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SHARK-A (DarkCrypt)";
      this.description = "SHARK-A variant from the DarkCrypt Total Commander plugin: a non-standard SHARK derivative with a GF(2^8) plaintext-whitening multiplier, six full-diffusion rounds (no separate S-box-only final round) and a rejection-sampled round-key schedule. 64-bit block, 128-bit key.";
      this.inventor = "Vincent Rijmen, Joan Daemen, Bart Preneel, Anton Bosselaers, Erik De Win (base SHARK); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("SHARK (base algorithm)", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/shark.zip")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "Bespoke SHARK derivative with an undocumented key schedule and round structure; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Shark — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("446d7d01312bb9ce")
        },
        {
          text: "DarkCrypt Shark — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("c91316734048a0f9")
        },
        {
          text: "DarkCrypt Shark — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("081b61f75f592646")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SharkADarkCryptInstance(this, isInverse);
    }
  }

  class SharkADarkCryptInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;

      // Precomputed per-key schedule state.
      this._rk0 = null;
      this._rk7 = null;
      this._roundA = null;      // A[0..5]: 8x8 GF(2^8) diffusion matrices
      this._roundAInv = null;   // inverse matrices (built lazily, only needed for decryption)
      this._roundFold = null;   // fold[0..5]: 8-byte round-key XOR applied after diffusion
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null; this.KeySize = 0;
        this._rk0 = this._rk7 = this._roundA = this._roundAInv = this._roundFold = null;
        return;
      }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SHARK-A (DarkCrypt) requires exactly 16 bytes`);

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._setupSchedule();
    }

    get key() { return this._key ? [...this._key] : null; }

    _setupSchedule() {
      const RK = deriveRoundKeys(this._key);
      const rkBytes = RK.map(toStateBytes);

      this._rk0 = rkBytes[0];
      this._rk7 = rkBytes[7];

      this._roundA = new Array(6);
      this._roundFold = new Array(6);

      for (let r = 0; r < 5; ++r) {
        this._roundFold[r] = rkBytes[r + 1];
        this._roundA[r] = buildRoundMatrix(box => columnSimple(rkBytes[r + 8], box));
      }

      const finalFold = toStateBytes(transformWord(RK[6], MATRIX_IG));
      this._roundFold[5] = finalFold;
      this._roundA[5] = buildRoundMatrix(box => columnFinal(rkBytes[13], box));

      this._roundAInv = null; // built lazily on first decrypt
    }

    _ensureInverseMatrices() {
      if (this._roundAInv) return;
      this._roundAInv = this._roundA.map(gfMatrixInverse);
    }

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
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
      return output;
    }

    _encryptBlock(block) {
      // Initial whitening: byte-wise GF(2^8) multiplication of the plaintext with RK[7],
      // XORed with RK[0].
      const gfw = new Array(8);
      for (let i = 0; i < 8; ++i) gfw[i] = gfMul(block[i], this._rk7[i]);
      let W = xorBytes(this._rk0, gfw);

      for (let r = 0; r < 6; ++r)
        W = roundApply(W, this._roundA[r], this._roundFold[r]);

      return W;
    }

    _decryptBlock(block) {
      this._ensureInverseMatrices();

      let W = block.slice();
      for (let r = 5; r >= 0; --r)
        W = roundApplyInverse(W, this._roundAInv[r], this._roundFold[r]);

      const gfw = xorBytes(W, this._rk0);
      const pt = new Array(8);
      for (let i = 0; i < 8; ++i) {
        const rk = this._rk7[i];
        pt[i] = rk === 0 ? 0 : gfMul(gfw[i], GF_INV[rk]);
      }
      return pt;
    }
  }

  const algorithmInstance = new SharkADarkCryptAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SharkADarkCryptAlgorithm, SharkADarkCryptInstance };
}));
