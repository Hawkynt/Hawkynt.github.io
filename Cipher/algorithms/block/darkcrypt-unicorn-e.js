/*
 * CIPHERUNICORN-E (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CIPHERUNICORN-E as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). Structurally the DarkCrypt
 * implementation follows the ISO/IEC9979-0019 register-entry reference
 * source (NEC Corporation, 1998): a 16-round modified Feistel network over
 * two 32-bit halves with a key-dependent linear mixing step (L) inserted
 * between rounds, a round function (F) combining a "main stream" of S-box
 * substitutions with a "temporary key" stream built from additive mixing
 * (Y) and keyed XOR whitening (K), and a nested Feistel key schedule built
 * from the same S-box substitution primitive (T).
 *
 * The DarkCrypt implementation deviates from the published ISO reference in
 * exactly one place: the byte-combination step inside the S-box mixing
 * primitive T. The ISO reference source combines all four substituted/
 * whitened bytes with XOR:
 *   T(x,n,in) = x ^ (wx[0]<<24) ^ (wx[1]<<16) ^ (wx[2]<<8) ^ wx[3]
 * whereas the DarkCrypt implementation instead uses subtraction for two of
 * the four terms:
 *   T(x,n,in) = wx[3] ^ ((wx[1]<<16) - (wx[2]<<8)) ^ (x - (wx[0]<<24))
 * This single change was confirmed against three independent reference
 * vectors produced by the DarkCrypt implementation. Key/plaintext/ciphertext
 * words are packed little-endian.
 *
 * 64-bit blocks, 128-bit keys, 16 rounds. Educational only.
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

  const ROUND = 16;

  // Byte-shuffle order table, indexed by the top nibble of the "temporary key" stream.
  const SH = [
    [0,2,1,3],[0,2,3,1],[0,3,1,2],[0,3,2,1],
    [1,0,3,2],[1,2,0,3],[1,3,0,2],[3,1,0,2],
    [3,2,1,0],[2,0,1,3],[2,0,3,1],[3,0,2,1],
    [1,3,2,0],[2,1,0,3],[2,1,3,0],[3,1,2,0]
  ];

  // Four 8-bit-in/8-bit-out S-boxes, as implemented in the DarkCrypt Total Commander plugin.
  const S = [
  [149,111,237,155, 21, 85,108, 76,236, 75,193, 84, 22,138, 89, 55,
    51,145, 13,153,148,163, 86, 59,204,175, 91,117,126, 70,144, 10,
   248,146,201,  0, 97,208, 23,214,147,234, 66, 65,226, 57,210,224,
   172, 40,154, 87,178,235,135,220,110,121, 96,  8,  9, 53,241,105,
   143,169,182,139,112, 16,183, 67,233, 39,197, 74,166,218,231,242,
   161,159,192, 37,177,228, 47,119, 14, 18,244, 56,  3,195,239,219,
    33,167, 26,180, 54, 61, 58,222,  4, 30,191, 34,107,249,142,150,
    95, 42,124, 25,232,181,120, 93,  5, 68,  6, 48,129, 41,104, 73,
   188,165,212,160,250,141,123,216, 94,238, 81,202,  7,122,196, 17,
   207,102,184,189,243, 72,206, 12,200,225,164,176,247,  1,  2,254,
    71,185,229,187,251,137, 69,168, 50, 24,171,173,158,221,127, 27,
   252,114,152, 82,209, 38,203,128,215,213, 36,174,134,179, 90,118,
    80,246,253,125, 29, 44, 15,227, 98,205,255, 77,198,194,133,130,
    79,103, 78, 49, 19,140,109,211,223, 63, 64,151, 62,217,170, 83,
   136, 45,115,199, 20, 46,190,240,132, 28,162,230,131,106, 32, 88,
   157, 31, 43,156,113,186, 35,101, 52, 60, 11,100,116,245, 99, 92],
  [174,255,161,109,254, 40, 95, 67, 33,124,133,137, 57,169, 87,221,
   220,163, 84, 14,239,171,  8,250, 43,115,126, 88,212,103, 62, 82,
   143, 65,156,139,183,235,125,217,116,111,237,157,170,132, 73,  2,
     1,232, 92,249,136,106,175, 50,251, 85, 12, 27, 48, 46, 52,145,
    78,168, 26,198,244,205,178, 72,142,162, 51,246,241,144, 49, 83,
   166,247,225, 11,  7,102,242,185, 93,197, 70,151, 75,118,202,216,
   108,207, 15, 86, 61, 79,110, 13,218,149,  6,134, 29, 36, 77,193,
   164, 17,211,  3,209,105, 94,206, 44,130,195, 76,208, 54,252,219,
   203,199, 39,189,233, 64,245,182,120,231,127, 47, 22,135, 55,173,
   223, 23,253,153, 25, 45,248, 97,179,186, 58,224,238,129, 56,138,
    74,192, 66,104,  4,117,226, 28,155, 68,160,184,213,172,  5,  9,
   140, 38,191,159,100,188, 16,227,128,194,177,122, 20, 18,150,165,
   121, 98,112, 99, 35,101, 69,131,181,154,180,230, 19, 60,123, 10,
    31, 80,167, 90, 32, 30,114,234, 41, 21, 81,119,200,146,187,210,
     0,228, 24,190,141,236, 63,201, 96,113,240,147,229, 91,107,214,
    89, 59,152,215,176,204,243,148, 42,158, 71, 34,222, 37,196, 53],
  [ 37, 34,162,132,134,220, 91,143, 41, 45,229,247, 98,178, 68, 56,
   212, 97, 70, 15, 58, 72,216,208, 14, 96,214,217,133,179, 28,154,
   120,123, 83,100,235,  3,230,160,193,245,164,155,255,175, 79,148,
   227,219, 23, 95,111, 11, 87,104,163,203,189, 29,156,173,211, 64,
   157, 53,196, 89, 81,  4, 84, 16,192, 74, 13,181, 20,184, 57,183,
    90,119, 93,207, 38,131, 94, 60,116,  1,213,122,  5,101,144,117,
    75, 46,  8,172,170,152,231,210, 66, 54, 10,187,128,204, 12,102,
   243,115,137,147,159,233, 59,221,253,112,165,198,105,222,234,153,
    43,201,121,180, 86,205,225,242,182, 55, 63,232,254, 44,  9, 21,
   136, 65,114, 31, 40, 49,  0, 36,169, 22,249, 35, 62, 17,174,248,
   158,151, 24, 50,176,108, 67,127,150, 18,  2,168,194,171,195,145,
    99, 25, 80,224, 33,200,197,118,161, 61,142, 77,190,209, 48,139,
   238,206, 42,125,239,237, 52,223, 88,167, 26,130, 76,191,  7, 71,
   215, 27,126,  6,251, 51,241,129,135,246,244,146, 32,177, 73, 82,
   226,110, 78,186,240,141,166, 69,107, 85,103,149,250,109,202, 19,
   113,140,138, 39,185,228,106, 47,252,199,188, 92,218, 30,236,124],
  [ 24,252,144,121, 17, 42, 77,127,  2, 35,173, 21,129, 58,105,113,
   112,229,185,189, 76,204,209, 87,  5, 96, 82, 99,133,140, 66, 64,
   192,107,194,220, 16, 68,183,171,219, 51, 92, 13,152, 86,135,123,
    98,174,103,156,157, 59,145,155,158,  8,231,132, 83, 49, 23, 32,
    85, 69,251, 36,233,238,222,149, 37,248, 26, 18,125, 11,137,253,
    79, 52, 56, 95,241,187, 44,167,124,102,227,115,212,142,154, 93,
   247,211, 33, 28, 67, 10,147,225,215,210,246,160,131, 73, 65, 57,
     1,182,180,199,207,126,216,224, 61, 81,202,196,146,188,119,128,
    50, 30, 91,161, 89, 12,195, 74,235,223,226,172,245,  7,218,159,
   242,217,208, 38,163, 45, 39,  4, 62,136,104,179, 88,197,  6,  0,
   141,190,243,214,109,162, 60,165,198,228,221,164,106,101,203,236,
   143, 48,110, 80,176, 78,234,181, 97, 84, 20, 70, 29,168, 27, 72,
    71, 90,255, 19,254,114, 25,230, 47, 43,100,178, 40, 41,249,186,
   150,205,184,201,139, 75, 54, 22, 63,244,108,175, 46,169,240,153,
   151,116,122,232,166,117, 14, 94,111,206,237,177,200, 31,170,120,
   213, 53,148, 15, 55,239,  3,191,134,250,193,  9,130,118,138, 34]
  ];

  function u32(x) { return OpCodes.ToUint32(x); }

  // S-box mixing primitive. Builds four substituted bytes at positions
  // rotated by n, then combines them: wx[3] is XORed with two terms that
  // are themselves computed via subtraction (this last step is where the
  // DarkCrypt implementation deviates from the ISO/IEC9979-0019 reference,
  // which uses plain XOR for all four terms).
  function T(x, n, inByte) {
    const wx = [0, 0, 0, 0];
    wx[(n + 1) % 4] = S[0][inByte];
    wx[(n + 2) % 4] = S[1][inByte];
    wx[(n + 3) % 4] = S[2][inByte];
    wx[n]           = OpCodes.And32(OpCodes.Xor32(S[3][inByte], inByte), 0xFF);
    const hi  = u32(x - u32(OpCodes.Shl32(wx[0], 24)));
    const mid = u32(u32(OpCodes.Shl32(wx[1], 16)) - u32(OpCodes.Shl32(wx[2], 8)));
    return u32(OpCodes.Xor32(OpCodes.Xor32(wx[3], mid), hi));
  }

  // Additive nonlinear mixing used while deriving the "temporary key" stream.
  function Y(x, s1, s2, s3) {
    let wx = u32(x);
    wx = u32(wx + u32(OpCodes.Shl32(wx, s1)));
    wx = u32(wx + u32(OpCodes.Shl32(wx, s2)));
    wx = u32(wx + u32(OpCodes.Shl32(wx, s3)));
    return wx;
  }

  // Keyed XOR whitening at a byte position determined by the shuffle table.
  function K(x, k, s) {
    return u32(OpCodes.Xor32(x, u32(OpCodes.Shl32(k, s))));
  }

  // Round function: combines a main stream of S-box substitutions with a
  // temporary-key stream derived from the round's fk/sk subkeys.
  function F(EK, r, x) {
    let w32 = u32(x);
    let k32;
    w32 = u32(w32 + EK.fk[r][0]);
    k32 = u32(EK.sk[r][0] + w32);
    k32 = Y(k32, 3, 8, 16);
    k32 = T(k32, 0, OpCodes.And32(OpCodes.Shr32(k32, 24), 0xFF));
    k32 = u32(k32 + EK.sk[r][1]);
    k32 = Y(k32, 7, 9, 13);
    k32 = T(k32, 0, OpCodes.And32(OpCodes.Shr32(k32, 24), 0xFF));
    k32 = T(k32, 1, OpCodes.And32(OpCodes.Shr32(k32, 16), 0xFF));
    const wk1 = OpCodes.And32(OpCodes.Shr32(k32, 28), 0xFF);
    const wk2 = OpCodes.And32(k32, 0xFF);
    const wk3 = OpCodes.And32(OpCodes.Shr32(k32, 8), 0xFF);

    w32 = T(w32, 0, OpCodes.And32(OpCodes.Shr32(w32, 24), 0xFF));
    w32 = T(w32, 1, OpCodes.And32(OpCodes.Shr32(w32, 16), 0xFF));
    w32 = T(w32, 2, OpCodes.And32(OpCodes.Shr32(w32, 8), 0xFF));
    w32 = T(w32, 3, OpCodes.And32(w32, 0xFF));
    w32 = u32(w32 + EK.fk[r][1]);
    w32 = T(w32, SH[wk1][0], OpCodes.And32(OpCodes.Shr32(w32, (24 - (SH[wk1][0] * 8))), 0xFF));
    w32 = T(w32, SH[wk1][1], OpCodes.And32(OpCodes.Shr32(w32, (24 - (SH[wk1][1] * 8))), 0xFF));
    w32 = T(w32, SH[wk1][2], OpCodes.And32(OpCodes.Shr32(w32, (24 - (SH[wk1][2] * 8))), 0xFF));
    w32 = T(w32, SH[wk1][3], OpCodes.And32(OpCodes.Shr32(w32, (24 - (SH[wk1][3] * 8))), 0xFF));
    w32 = K(w32, wk2, 24 - (SH[wk1][0] * 8));
    w32 = T(w32, SH[wk1][0], OpCodes.And32(OpCodes.Shr32(w32, (24 - (SH[wk1][0] * 8))), 0xFF));
    w32 = K(w32, wk3, 24 - (SH[wk1][1] * 8));
    w32 = T(w32, SH[wk1][1], OpCodes.And32(OpCodes.Shr32(w32, (24 - (SH[wk1][1] * 8))), 0xFF));

    return w32;
  }

  // Key-dependent linear mixing applied between rounds.
  function L(state, k0, k1) {
    const w0 = state[0], w1 = state[1];
    state[0] = u32(OpCodes.Xor32(OpCodes.Xor32(w0, OpCodes.And32(w1, k1)), OpCodes.And32(OpCodes.And32(w0, k0), k1)));
    state[1] = u32(OpCodes.Xor32(OpCodes.Xor32(w1, OpCodes.And32(w0, k0)), OpCodes.And32(OpCodes.And32(w1, k1), k0)));
  }

  // Key-schedule helpers: each derives one (or one pair of) 32-bit subkey
  // words from the running 128-bit schedule state x[0..3], itself updated
  // as a small internal Feistel step built from T().
  function SetIK(EK, line, n, x) {
    let xl = x[2], xr = x[3];
    xl = u32(xl + T(xr, line % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - (line % 4) * 8)), 0xFF)));
    const ik0 = T(xl, (line + 1) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((line + 1) % 4) * 8)), 0xFF));
    xr = u32(xr + ik0);
    x[0] = u32(OpCodes.Xor32(x[0], xl)); xl = x[0];
    x[1] = u32(OpCodes.Xor32(x[1], xr)); xr = x[1];
    xl = u32(xl + T(xr, (line + 2) % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - ((line + 2) % 4) * 8)), 0xFF)));
    const ik1 = T(xl, (line + 3) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((line + 3) % 4) * 8)), 0xFF));
    xr = u32(xr + ik1);
    x[2] = u32(OpCodes.Xor32(x[2], xl));
    x[3] = u32(OpCodes.Xor32(x[3], xr));
    EK.ik[n] = [ik0, ik1];
  }

  function SetSK(EK, line, n, x) {
    let xl = x[2], xr = x[3];
    const sk_n_1 = T(xr, line % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - (line % 4) * 8)), 0xFF));
    xl = u32(xl + sk_n_1);
    const sk_n1_1 = T(xl, (line + 1) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((line + 1) % 4) * 8)), 0xFF));
    xr = u32(xr + sk_n1_1);
    x[0] = u32(OpCodes.Xor32(x[0], xl)); xl = x[0];
    x[1] = u32(OpCodes.Xor32(x[1], xr)); xr = x[1];
    const sk_n_0 = T(xr, (line + 2) % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - ((line + 2) % 4) * 8)), 0xFF));
    xl = u32(xl + sk_n_0);
    const sk_n1_0 = T(xl, (line + 3) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((line + 3) % 4) * 8)), 0xFF));
    xr = u32(xr + sk_n1_0);
    x[2] = u32(OpCodes.Xor32(x[2], xl));
    x[3] = u32(OpCodes.Xor32(x[3], xr));
    EK.sk[n]     = [sk_n_0, sk_n_1];
    EK.sk[n + 1] = [sk_n1_0, sk_n1_1];
  }

  function SetFK(EK, line, n, x) {
    let xl = x[2], xr = x[3];
    const fk_n_1 = T(xr, line % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - (line % 4) * 8)), 0xFF));
    xl = u32(xl + fk_n_1);
    const fk_n1_1 = T(xl, (line + 1) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((line + 1) % 4) * 8)), 0xFF));
    xr = u32(xr + fk_n1_1);
    x[0] = u32(OpCodes.Xor32(x[0], xl)); xl = x[0];
    x[1] = u32(OpCodes.Xor32(x[1], xr)); xr = x[1];
    const fk_n_0 = T(xr, (line + 2) % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - ((line + 2) % 4) * 8)), 0xFF));
    xl = u32(xl + fk_n_0);
    const fk_n1_0 = T(xl, (line + 3) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((line + 3) % 4) * 8)), 0xFF));
    xr = u32(xr + fk_n1_0);
    x[2] = u32(OpCodes.Xor32(x[2], xl));
    x[3] = u32(OpCodes.Xor32(x[3], xr));
    EK.fk[n]     = [fk_n_0, fk_n_1];
    EK.fk[n + 1] = [fk_n1_0, fk_n1_1];
  }

  // Expands a 128-bit master key (as four 32-bit words) into the fk/sk/ik
  // subkey tables consumed by F() and L().
  function UnicornScheduler(mkey) {
    const EK = { fk: new Array(ROUND), sk: new Array(ROUND), ik: new Array((ROUND / 2) + 1) };
    for (let i = 0; i < ROUND; i++) { EK.fk[i] = [0, 0]; EK.sk[i] = [0, 0]; }
    for (let i = 0; i <= ROUND / 2; i++) { EK.ik[i] = [0, 0]; }

    const x = [0, 0, 0, 0];
    let xl, xr;
    let num = 0, ik = 0, sk = 0, fk = 0;

    x[0] = mkey[0];
    x[1] = mkey[1];
    xl = x[2] = mkey[2];
    xr = x[3] = mkey[3];

    for (let lp = 0; lp < 4; lp++) {
      xl = u32(xl + T(xr, num % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - (num % 4) * 8)), 0xFF)));
      xr = u32(xr + T(xl, (num + 1) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((num + 1) % 4) * 8)), 0xFF)));
      x[0] = u32(OpCodes.Xor32(x[0], xl)); xl = x[0];
      x[1] = u32(OpCodes.Xor32(x[1], xr)); xr = x[1];
      xl = u32(xl + T(xr, (num + 2) % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - ((num + 2) % 4) * 8)), 0xFF)));
      xr = u32(xr + T(xl, (num + 3) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((num + 3) % 4) * 8)), 0xFF)));
      x[2] = u32(OpCodes.Xor32(x[2], xl)); xl = x[2];
      x[3] = u32(OpCodes.Xor32(x[3], xr)); xr = x[3];
      num++;
    }

    for (let lp = 0; lp < (ROUND / 4) - 1; lp++) {
      SetIK(EK, num++, ik++, x);
      SetSK(EK, num++, sk, x); sk += 2;
      SetFK(EK, num++, fk, x); fk += 2;
    }

    // Interleaved block run once between the two halves of the schedule.
    {
      SetIK(EK, num++, ik++, x);
      SetSK(EK, num++, sk, x); sk += 2;

      xl = x[2]; xr = x[3];
      let t;
      t = T(xr, num % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - (num % 4) * 8)), 0xFF));
      EK.fk[fk][0] = t; xl = u32(xl + t);
      t = T(xl, (num + 1) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((num + 1) % 4) * 8)), 0xFF));
      EK.fk[fk + 1][0] = t; xr = u32(xr + t);
      x[0] = u32(OpCodes.Xor32(x[0], xl)); EK.fk[fk][1] = x[0]; xl = x[0];
      x[1] = u32(OpCodes.Xor32(x[1], xr)); EK.fk[fk + 1][1] = x[1]; xr = x[1];
      xl = u32(xl + T(xr, (num + 2) % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - ((num + 2) % 4) * 8)), 0xFF)));
      t = T(xl, (num + 3) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((num + 3) % 4) * 8)), 0xFF));
      EK.ik[ik][0] = t; xr = u32(xr + t);
      num++;
      fk += 2;

      x[2] = u32(OpCodes.Xor32(x[2], xl)); EK.fk[fk][1] = x[2]; xl = x[2];
      x[3] = u32(OpCodes.Xor32(x[3], xr)); EK.fk[fk + 1][1] = x[3]; xr = x[3];
      xl = u32(xl + T(xr, num % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - (num % 4) * 8)), 0xFF)));
      t = T(xl, (num + 1) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((num + 1) % 4) * 8)), 0xFF));
      EK.ik[ik][1] = t; xr = u32(xr + t);
      x[0] = u32(OpCodes.Xor32(x[0], xl)); xl = x[0];
      x[1] = u32(OpCodes.Xor32(x[1], xr)); xr = x[1];
      t = T(xr, (num + 2) % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - ((num + 2) % 4) * 8)), 0xFF));
      EK.sk[sk][1] = t; xl = u32(xl + t);
      t = T(xl, (num + 3) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((num + 3) % 4) * 8)), 0xFF));
      EK.sk[sk + 1][1] = t; xr = u32(xr + t);
      x[2] = u32(OpCodes.Xor32(x[2], xl)); xl = x[2];
      x[3] = u32(OpCodes.Xor32(x[3], xr)); xr = x[3];
      num++;
      ik++;

      t = T(xr, num % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - (num % 4) * 8)), 0xFF));
      EK.sk[sk][0] = t; xl = u32(xl + t);
      t = T(xl, (num + 1) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((num + 1) % 4) * 8)), 0xFF));
      EK.sk[sk + 1][0] = t; xr = u32(xr + t);
      x[0] = u32(OpCodes.Xor32(x[0], xl)); xl = x[0];
      x[1] = u32(OpCodes.Xor32(x[1], xr)); xr = x[1];
      t = T(xr, (num + 2) % 4, OpCodes.And32(OpCodes.Shr32(xr, (24 - ((num + 2) % 4) * 8)), 0xFF));
      EK.fk[fk][0] = t; xl = u32(xl + t);
      t = T(xl, (num + 3) % 4, OpCodes.And32(OpCodes.Shr32(xl, (24 - ((num + 3) % 4) * 8)), 0xFF));
      EK.fk[fk + 1][0] = t; xr = u32(xr + t);
      x[2] = u32(OpCodes.Xor32(x[2], xl)); xl = x[2];
      x[3] = u32(OpCodes.Xor32(x[3], xr)); xr = x[3];
      num++;
      sk += 2;
      fk += 2;

      SetIK(EK, num++, ik++, x);
    }

    for (let lp = 0; lp < (ROUND / 4) - 1; lp++) {
      SetSK(EK, num++, sk, x); sk += 2;
      SetFK(EK, num++, fk, x); fk += 2;
      SetIK(EK, num++, ik++, x);
    }

    return EK;
  }

  function UnicornEncode(EK, p) {
    const state = [p[0], p[1]];
    L(state, EK.ik[0][0], EK.ik[0][1]);
    for (let r = 0; r < ROUND; r += 2) {
      state[0] = u32(OpCodes.Xor32(state[0], F(EK, r, state[1])));
      state[1] = u32(OpCodes.Xor32(state[1], F(EK, r + 1, state[0])));
      L(state, EK.ik[r / 2 + 1][0], EK.ik[r / 2 + 1][1]);
    }
    return state;
  }

  function UnicornDecode(EK, c) {
    const state = [c[0], c[1]];
    L(state, EK.ik[ROUND / 2][0], EK.ik[ROUND / 2][1]);
    for (let r = ROUND - 1; r > 0; r -= 2) {
      state[1] = u32(OpCodes.Xor32(state[1], F(EK, r, state[0])));
      state[0] = u32(OpCodes.Xor32(state[0], F(EK, r - 1, state[1])));
      L(state, EK.ik[(r / 2) | 0][0], EK.ik[(r / 2) | 0][1]);
    }
    return state;
  }

  class DarkCryptUnicornEAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "CIPHERUNICORN-E (DarkCrypt)";
      this.description = "NEC's CIPHERUNICORN-E block cipher as implemented in the DarkCrypt Total Commander plugin: 16-round modified Feistel network, 64-bit block, 128-bit key, with a key-dependent linear mixing step between rounds. Matches the ISO/IEC9979-0019 reference structure except for the byte-combination step in the S-box mixing primitive, which the DarkCrypt implementation performs with subtraction instead of the reference's plain XOR.";
      this.inventor = "NEC Corporation; DarkCrypt implementation by Alexander Myasnikov";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];  // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("ISO/IEC9979-0019 Register Entry (CIPHERUNICORN-E reference source)", "http://www.chrismitchell.net/ISO-register/0019.pdf"),
        new LinkItem("CIPHERUNICORN-E (Wikipedia)", "https://en.wikipedia.org/wiki/CIPHERUNICORN-E")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "The DarkCrypt implementation deviates from the published ISO/IEC9979-0019 reference in the S-box mixing primitive's combination step; unanalyzed as a distinct construction and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (raw primitive: setup(key)+crypt(block)).
      this.tests = [
        {
          text: "DarkCrypt Unicorn — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("3eaeb1f9f6963069")
        },
        {
          text: "DarkCrypt Unicorn — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("13d188da49e897f6")
        },
        {
          text: "DarkCrypt Unicorn — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("97a13f60a1481219")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptUnicornEInstance(this, isInverse);
    }
  }

  class DarkCryptUnicornEInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._EK = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._EK = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. CIPHERUNICORN-E (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      const mkey = [
        OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];
      this._EK = UnicornScheduler(mkey);
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

    _encryptBlock(block) {
      const p = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7])
      ];
      const c = UnicornEncode(this._EK, p);
      return [...OpCodes.Unpack32LE(c[0]), ...OpCodes.Unpack32LE(c[1])];
    }

    _decryptBlock(block) {
      const c = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7])
      ];
      const p = UnicornDecode(this._EK, c);
      return [...OpCodes.Unpack32LE(p[0]), ...OpCodes.Unpack32LE(p[1])];
    }
  }

  const algorithmInstance = new DarkCryptUnicornEAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptUnicornEAlgorithm, DarkCryptUnicornEInstance };
}));
