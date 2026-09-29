(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  // ===== HIEROCRYPT-L1 CONSTANTS (Toshiba specification, section 3.3) =====

  // Primitive polynomial for GF(2^8): z^8 + z^6 + z^5 + z + 1
  const GF_POLY = 0x163;

  // s-function (lower-level S-box)
  /** @type {uint8[]} */
  const SBOX = [
    0x07, 0xFC, 0x55, 0x70, 0x98, 0x8E, 0x84, 0x4E, 0xBC, 0x75, 0xCE, 0x18, 0x02, 0xE9, 0x5D, 0x80,
    0x1C, 0x60, 0x78, 0x42, 0x9D, 0x2E, 0xF5, 0xE8, 0xC6, 0x7A, 0x2F, 0xA4, 0xB2, 0x5F, 0x19, 0x87,
    0x0B, 0x9B, 0x9C, 0xD3, 0xC3, 0x77, 0x3D, 0x6F, 0xB9, 0x2D, 0x4D, 0xF7, 0x8C, 0xA7, 0xAC, 0x17,
    0x3C, 0x5A, 0x41, 0xC9, 0x29, 0xED, 0xDE, 0x27, 0x69, 0x30, 0x72, 0xA8, 0x95, 0x3E, 0xF9, 0xD8,
    0x21, 0x8B, 0x44, 0xD7, 0x11, 0x0D, 0x48, 0xFD, 0x6A, 0x01, 0x57, 0xE5, 0xBD, 0x85, 0xEC, 0x1E,
    0x37, 0x9F, 0xB5, 0x9A, 0x7C, 0x09, 0xF1, 0xB1, 0x94, 0x81, 0x82, 0x08, 0xFB, 0xC0, 0x51, 0x0F,
    0x61, 0x7F, 0x1A, 0x56, 0x96, 0x13, 0xC1, 0x67, 0x99, 0x03, 0x5E, 0xB6, 0xCA, 0xFA, 0x9E, 0xDF,
    0xD6, 0x83, 0xCC, 0xA2, 0x12, 0x23, 0xB7, 0x65, 0xD0, 0x39, 0x7D, 0x3B, 0xD5, 0xB0, 0xAF, 0x1F,
    0x06, 0xC8, 0x34, 0xC5, 0x1B, 0x79, 0x4B, 0x66, 0xBF, 0x88, 0x4A, 0xC4, 0xEF, 0x58, 0x3F, 0x0A,
    0x2C, 0x73, 0xD1, 0xF8, 0x6B, 0xE6, 0x20, 0xB8, 0x22, 0x43, 0xB3, 0x33, 0xE7, 0xF0, 0x71, 0x7E,
    0x52, 0x89, 0x47, 0x63, 0x0E, 0x6D, 0xE3, 0xBE, 0x59, 0x64, 0xEE, 0xF6, 0x38, 0x5C, 0xF4, 0x5B,
    0x49, 0xD4, 0xE0, 0xF3, 0xBB, 0x54, 0x26, 0x2B, 0x00, 0x86, 0x90, 0xFF, 0xFE, 0xA6, 0x7B, 0x05,
    0xAD, 0x68, 0xA1, 0x10, 0xEB, 0xC7, 0xE2, 0xF2, 0x46, 0x8A, 0x6C, 0x14, 0x6E, 0xCF, 0x35, 0x45,
    0x50, 0xD2, 0x92, 0x74, 0x93, 0xE1, 0xDA, 0xAE, 0xA9, 0x53, 0xE4, 0x40, 0xCD, 0xBA, 0x97, 0xA3,
    0x91, 0x31, 0x25, 0x76, 0x36, 0x32, 0x28, 0x3A, 0x24, 0x4C, 0xDB, 0xD9, 0x8D, 0xDC, 0x62, 0x2A,
    0xEA, 0x15, 0xDD, 0xC2, 0xA5, 0x0C, 0x04, 0x1D, 0x8F, 0xCB, 0xB4, 0x4F, 0x16, 0xAB, 0xAA, 0xA0
  ];
  Object.freeze(SBOX);

  /**
   * @returns {uint8[]} Inverse of SBOX
   */
  function buildSboxInv() {
    /** @type {uint8[]} */
    const inv = new Array(256);
    for (let i = 0; i < 256; i++) inv[SBOX[i]] = i;
    return inv;
  }
  const SBOX_INV = buildSboxInv();
  Object.freeze(SBOX_INV);

  // mdsL: circulant matrix with first row (C4 65 C8 8B) and its inverse
  /** @type {uint8[]} */
  const MDSL_ROW = [0xC4, 0x65, 0xC8, 0x8B];
  Object.freeze(MDSL_ROW);
  /** @type {uint8[]} */
  const MDSL_INV_ROW = [0x82, 0xC4, 0x34, 0xF6];
  Object.freeze(MDSL_INV_ROW);

  // MDS_H: 8x8 binary matrix (one bit-mask per output byte) and its inverse
  /** @type {uint8[]} */
  const MDSH_ROWS = [0xAE, 0xDF, 0xE7, 0x5D, 0xD5, 0xEA, 0xFD, 0xAB];
  Object.freeze(MDSH_ROWS);
  /** @type {uint8[]} */
  const MDSH_INV_ROWS = [0xBD, 0x5E, 0xAF, 0x6A, 0xA5, 0xDA, 0xED, 0x5B];
  Object.freeze(MDSH_INV_ROWS);

  // Round-dependent constants for the intermediate key generation.
  // H0..H3 are trunc(2^32 * sqrt(n)/4) for n = 2, 3, 5, 10 exactly as printed in
  // the specification. The turning-point constant used at t = 4 and t = 5 is the
  // byte-swapped form of the printed H4 (0xF7DEF58A); the value below is the one
  // that reproduces the official NESSIE test vectors and every published round key.
  /** @type {uint8[][]} */
  const ROUND_CONSTANTS = [
    [0x5A, 0x82, 0x79, 0x99], // t = 0 (pre-whitening), H0
    [0x6E, 0xD9, 0xEB, 0xA1], // t = 1, H1
    [0x8F, 0x1B, 0xBC, 0xDC], // t = 2, H2
    [0xCA, 0x62, 0xC1, 0xD6], // t = 3, H3
    [0x8A, 0xF5, 0xDE, 0xF7], // t = 4, H4 (turning point)
    [0x8A, 0xF5, 0xDE, 0xF7], // t = 5, H4 (turning point)
    [0xCA, 0x62, 0xC1, 0xD6], // t = 6, H3
    [0x8F, 0x1B, 0xBC, 0xDC]  // t = 7, H2
  ];
  for (let t = 0; t < ROUND_CONSTANTS.length; t++) Object.freeze(ROUND_CONSTANTS[t]);
  Object.freeze(ROUND_CONSTANTS);

  // ---- fundamental operations (spec section 3.3) ----
  // All values are bytes; Xor32 of two bytes equals their plain XOR.

  /**
   * @param {uint8[]} a - 4 bytes
   * @param {uint8[]} b - 4 bytes
   * @returns {uint8[]} a XOR b
   */
  function xor4(a, b) {
    /** @type {uint8[]} */
    const r = [OpCodes.Xor32(a[0], b[0]), OpCodes.Xor32(a[1], b[1]), OpCodes.Xor32(a[2], b[2]), OpCodes.Xor32(a[3], b[3])];
    return r;
  }

  /**
   * @param {uint8[]} a - 8 bytes
   * @param {uint8[]} b - 8 bytes
   * @returns {uint8[]} a XOR b
   */
  function xor8(a, b) {
    /** @type {uint8[]} */
    const r = new Array(8);
    for (let i = 0; i < 8; i++) r[i] = OpCodes.Xor32(a[i], b[i]);
    return r;
  }

  // S-function: parallel s-box over 8 bytes
  /**
   * @param {uint8[]} x - Bytes
   * @returns {uint8[]} Substituted bytes
   */
  function sLayer(x) {
    /** @type {uint8[]} */
    const r = new Array(x.length);
    for (let i = 0; i < x.length; i++) r[i] = SBOX[x[i]];
    return r;
  }

  /**
   * @param {uint8[]} x - Bytes
   * @returns {uint8[]} Inversely substituted bytes
   */
  function sInvLayer(x) {
    /** @type {uint8[]} */
    const r = new Array(x.length);
    for (let i = 0; i < x.length; i++) r[i] = SBOX_INV[x[i]];
    return r;
  }

  // mdsL: circulant 4x4 over GF(2^8), primitive polynomial z^8+z^6+z^5+z+1
  /**
   * @param {uint8[]} row - First row of the circulant matrix
   * @param {uint8[]} x - 4 bytes
   * @returns {uint8[]} Matrix times x
   */
  function circ(row, x) {
    /** @type {uint8[]} */
    const y = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      /** @type {uint8} */
      let acc = 0;
      for (let j = 0; j < 4; j++)
        acc = OpCodes.Xor32(acc, OpCodes.GFMul(x[j], row[(j - i + 4) % 4], GF_POLY, 8));
      y[i] = acc;
    }
    return y;
  }

  // MDS_L: two parallel mdsL over the 64-bit block
  /**
   * @param {uint8[]} x - 8 bytes
   * @returns {uint8[]} MDS_L(x)
   */
  function mdsL(x) {
    /** @type {uint8[]} */
    const y = [...circ(MDSL_ROW, x.slice(0, 4)), ...circ(MDSL_ROW, x.slice(4, 8))];
    return y;
  }

  /**
   * @param {uint8[]} x - 8 bytes
   * @returns {uint8[]} MDS_L^-1(x)
   */
  function mdsLInv(x) {
    /** @type {uint8[]} */
    const y = [...circ(MDSL_INV_ROW, x.slice(0, 4)), ...circ(MDSL_INV_ROW, x.slice(4, 8))];
    return y;
  }

  // MDS_H: byte-wise XOR network described by an 8x8 binary matrix
  /**
   * @param {uint8[]} rows - One bit-mask per output byte
   * @param {uint8[]} x - 8 bytes
   * @returns {uint8[]} Mixed bytes
   */
  function binMix(rows, x) {
    /** @type {uint8[]} */
    const y = new Array(8);
    for (let i = 0; i < 8; i++) {
      /** @type {uint8} */
      let acc = 0;
      for (let j = 0; j < 8; j++) {
        if (OpCodes.And32(OpCodes.Shr32(rows[i], 7 - j), 1)) acc = OpCodes.Xor32(acc, x[j]);
      }
      y[i] = acc;
    }
    return y;
  }

  /**
   * @param {uint8[]} x - 8 bytes
   * @returns {uint8[]} MDS_H(x)
   */
  function mdsH(x) { return binMix(MDSH_ROWS, x); }
  /**
   * @param {uint8[]} x - 8 bytes
   * @returns {uint8[]} MDS_H^-1(x)
   */
  function mdsHInv(x) { return binMix(MDSH_INV_ROWS, x); }

  // P(8): four bytes, rows 1010 / 0101 / 0111 / 1011
  /**
   * @param {uint8[]} x - 4 bytes
   * @returns {uint8[]} P(8)(x)
   */
  function p8(x) {
    /** @type {uint8[]} */
    const r = [OpCodes.Xor32(x[0], x[2]), OpCodes.Xor32(x[1], x[3]), OpCodes.Xor32(OpCodes.Xor32(x[1], x[2]), x[3]), OpCodes.Xor32(OpCodes.Xor32(x[0], x[2]), x[3])];
    return r;
  }

  // P(16): four 16-bit words held as eight bytes
  /**
   * @param {uint8[]} x - 8 bytes
   * @returns {uint8[]} P(16)(x)
   */
  function p16(x) {
    /** @type {uint8[]} */
    const r = [
      OpCodes.Xor32(x[0], x[4]), OpCodes.Xor32(x[1], x[5]),
      OpCodes.Xor32(x[2], x[6]), OpCodes.Xor32(x[3], x[7]),
      OpCodes.Xor32(OpCodes.Xor32(x[2], x[4]), x[6]), OpCodes.Xor32(OpCodes.Xor32(x[3], x[5]), x[7]),
      OpCodes.Xor32(OpCodes.Xor32(x[0], x[4]), x[6]), OpCodes.Xor32(OpCodes.Xor32(x[1], x[5]), x[7])
    ];
    return r;
  }

  // P(16)^-1: rows 1110 / 1101 / 0110 / 1001
  /**
   * @param {uint8[]} y - 8 bytes
   * @returns {uint8[]} P(16)^-1(y)
   */
  function p16Inv(y) {
    /** @type {uint8[]} */
    const r = [
      OpCodes.Xor32(OpCodes.Xor32(y[0], y[2]), y[4]), OpCodes.Xor32(OpCodes.Xor32(y[1], y[3]), y[5]),
      OpCodes.Xor32(OpCodes.Xor32(y[0], y[2]), y[6]), OpCodes.Xor32(OpCodes.Xor32(y[1], y[3]), y[7]),
      OpCodes.Xor32(y[2], y[4]), OpCodes.Xor32(y[3], y[5]),
      OpCodes.Xor32(y[0], y[6]), OpCodes.Xor32(y[1], y[7])
    ];
    return r;
  }

  // M5 and MB are mutually inverse byte-wise linear maps on 32-bit words
  /**
   * @param {uint8[]} x - 4 bytes
   * @returns {uint8[]} M5(x)
   */
  function m5(x) {
    /** @type {uint8[]} */
    const r = [OpCodes.Xor32(x[0], x[2]), OpCodes.Xor32(OpCodes.Xor32(x[0], x[1]), x[3]), OpCodes.Xor32(OpCodes.Xor32(x[0], x[1]), x[2]), OpCodes.Xor32(x[1], x[3])];
    return r;
  }

  /**
   * @param {uint8[]} x - 4 bytes
   * @returns {uint8[]} MB(x)
   */
  function mB(x) {
    /** @type {uint8[]} */
    const r = [OpCodes.Xor32(x[1], x[3]), OpCodes.Xor32(x[0], x[2]), OpCodes.Xor32(OpCodes.Xor32(x[0], x[1]), x[3]), OpCodes.Xor32(OpCodes.Xor32(x[0], x[2]), x[3])];
    return r;
  }

  // F-function: s-boxes followed by P(8)
  /**
   * @param {uint8[]} x - 4 bytes
   * @returns {uint8[]} F(x)
   */
  function fFunc(x) {
    /** @type {uint8[]} */
    const sx = [SBOX[x[0]], SBOX[x[1]], SBOX[x[2]], SBOX[x[3]]];
    return p8(sx);
  }

  // ---- key schedule (spec section 3.2.3 - 3.2.7) ----

  /**
   * @param {uint8[]} keyBytes - Key bytes
   * @returns {uint8[][]} K[1..7], each 16 bytes (four 4-byte words; K[0] unused)
   */
  function expandKey(keyBytes) {
    let z1 = keyBytes.slice(0, 4);
    let z2 = keyBytes.slice(4, 8);
    let z3 = keyBytes.slice(8, 12);
    let z4 = keyBytes.slice(12, 16);

    /** @type {uint8[][]} */
    const K = new Array(8);

    // Pre-whitening (sigma_0): sigma without the P(16) layer
    {
      const g = ROUND_CONSTANTS[0];
      const n3 = xor4(m5(z3), g);
      const n4 = mB(z4);
      const n1 = z2;
      const n2 = xor4(z1, fFunc(xor4(z2, n3)));
      z1 = n1; z2 = n2; z3 = n3; z4 = n4;
    }

    // Plaintext side: t = 1..4
    for (let t = 1; t <= 4; t++) {
      const g = ROUND_CONSTANTS[t];
      /** @type {uint8[]} */
      const zz = [...z3, ...z4];
      const p = p16(zz);
      const w1 = p.slice(0, 4);
      const w2 = p.slice(4, 8);
      const n3 = xor4(m5(w1), g);
      const n4 = mB(w2);
      const n1 = z2;
      const v = fFunc(xor4(z2, n3));
      const n2 = xor4(z1, v);
      /** @type {uint8[]} */
      const kt = [...xor4(z1, v), ...xor4(n3, v), ...xor4(n4, v), ...xor4(z2, n4)];
      K[t] = kt;
      z1 = n1; z2 = n2; z3 = n3; z4 = n4;
    }

    // Ciphertext side: t = 5..7 (sigma^-1)
    for (let t = 5; t <= 7; t++) {
      const g = ROUND_CONSTANTS[t];
      const v = fFunc(xor4(z1, z3));
      const n1 = xor4(z2, v);
      const n2 = z1;
      const w1 = mB(xor4(z3, g));
      const w2 = m5(z4);
      /** @type {uint8[]} */
      const ww = [...w1, ...w2];
      const pi = p16Inv(ww);
      /** @type {uint8[]} */
      const kt = [...xor4(n1, z3), ...xor4(w1, v), ...xor4(w2, v), ...xor4(z1, w2)];
      K[t] = kt;
      z1 = n1; z2 = n2; z3 = pi.slice(0, 4); z4 = pi.slice(4, 8);
    }

    return K;
  }

  /**
   * Hierocrypt-L1 - A 64-bit block cipher from Toshiba submitted to NESSIE
   *
   * Hierocrypt-L1 uses a nested substitution-permutation network (SPN) structure
   * with 6.5 rounds. Each round consists of parallel applications of the XS-box
   * transformation followed by a linear diffusion operation. The final half-round
   * replaces diffusion with post-whitening.
   *
   * Key characteristics:
   * - Block size: 64 bits (8 bytes)
   * - Key size: 128 bits (16 bytes)
   * - Rounds: 6.5 (6 full rounds + 1 half round)
   * - Structure: Nested SPN with XS-box and MDS matrices
   *
   * The XS-box is itself an SPN consisting of:
   * 1. Subkey XOR
   * 2. S-box lookup
   * 3. Linear diffusion
   * 4. Another subkey XOR
   * 5. Another S-box lookup
   *
   * Reference: NESSIE submission, Toshiba Corporation, 2000
   */
class HierocryptL1 extends BlockCipherAlgorithm {
  constructor() {
    super();

    this.name = "Hierocrypt-L1";
    this.description = "Hierocrypt-L1, a 64-bit block cipher from Toshiba submitted to NESSIE and recommended by CRYPTREC. Nested SPN structure with 6.5 rounds and a round-trip Feistel key schedule.";
    this.inventor = "Toshiba Corporation";
    this.year = 2000;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.JP;

    this.SupportedKeySizes = [new KeySize(16, 16, 1)]; // 128-bit key only
    this.SupportedBlockSizes = [new KeySize(8, 8, 1)]; // 64-bit block

    this.documentation = [
      new LinkItem("NESSIE Submission (CRYPTREC)", "https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/04_02espec.pdf"),
      new LinkItem("NESSIE Submission (KU Leuven)", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/Hierocrypt-L1-revised-spec.pdf"),
      new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Hierocrypt")
    ];

    this.references = [
      new LinkItem("NESSIE Submission Archive (reference code package)", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions.html"),
      new LinkItem("embeddedsw.net libObfuscate Hierocrypt Implementation", "https://embeddedsw.net/Cipher_Reference_Home.html")
    ];

    this.tests = [
      {
        text: "NESSIE submission package, C/testvectors.txt",
        uri: "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/hierocrypt-l1.zip",
        input: OpCodes.Hex8ToBytes('85693846db4c1b34'),
        key: OpCodes.Hex8ToBytes('4703c87e817842c4ce6b167d43701b76'),
        expected: OpCodes.Hex8ToBytes('0cb19444abd24347')
      }
    ];
  }

  /**
   * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
   * @returns {HierocryptL1Instance} New instance
   */
  CreateInstance(isInverse = false) {
    return new HierocryptL1Instance(this, isInverse);
  }
}

/**
 * Instance class implementing the Hierocrypt-L1 cipher
 */
class HierocryptL1Instance extends IBlockCipherInstance {
  /**
   * @param {HierocryptL1} algorithm - Parent algorithm
   * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
   */
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    /** @type {uint8[]} */
    this.inputBuffer = [];
    /** @type {uint8[]|null} */
    this._key = null;
    /** @type {uint8[][]|null} */
    this._roundKeys = null;
    this.BlockSize = 8;
    this.KeySize = 0;
  }

  /**
   * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
   */
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this._roundKeys = null;
      this.KeySize = 0;
      return;
    }

    if (keyBytes.length !== 16) {
      throw new Error("Invalid key size: " + keyBytes.length + " bytes (must be 16)");
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    this._roundKeys = expandKey(keyBytes);
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
    if (this.inputBuffer.length % 8 !== 0) {
      throw new Error("Input length must be multiple of 8 bytes");
    }

    /** @type {uint8[]} */
    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i += 8) {
      const block = this.inputBuffer.slice(i, i + 8);
      const processed = this.isInverse
        ? this._decryptBlock(block)
        : this._encryptBlock(block);
      for (let _i = 0; _i < processed.length; _i++) output.push(processed[_i]);
    }

    this.inputBuffer = [];
    return output;
  }

  // ---- data randomizing part (spec section 3.2.1 - 3.2.2) ----

  // XS-function: S -> MDS_L -> key add -> S, wrapped by the leading key add
  /**
   * @param {uint8[]} x - 8 bytes
   * @param {uint8[]} k - 16-byte round key
   * @returns {uint8[]} XS(x)
   */
  _XS(x, k) {
    const k1 = k.slice(0, 8);
    const k2 = k.slice(8, 16);
    return sLayer(xor8(mdsL(sLayer(xor8(x, k1))), k2));
  }

  /**
   * @param {uint8[]} x - 8 bytes
   * @param {uint8[]} k - 16-byte round key
   * @returns {uint8[]} XS^-1(x)
   */
  _XSinv(x, k) {
    const k1 = k.slice(0, 8);
    const k2 = k.slice(8, 16);
    return xor8(sInvLayer(mdsLInv(xor8(sInvLayer(x), k2))), k1);
  }

  /**
   * @param {uint8[]} block - Input block
   * @returns {uint8[]} Output block
   */
  _encryptBlock(block) {
    const K = this._roundKeys;
    let x = block.slice();
    for (let t = 1; t <= 5; t++) x = mdsH(this._XS(x, K[t]));
    x = this._XS(x, K[6]);
    const k7 = K[7].slice(0, 8);
    return xor8(x, k7);
  }

  /**
   * @param {uint8[]} block - Input block
   * @returns {uint8[]} Output block
   */
  _decryptBlock(block) {
    const K = this._roundKeys;
    const k7 = K[7].slice(0, 8);
    let x = xor8(block, k7);
    x = this._XSinv(x, K[6]);
    for (let t = 5; t >= 1; t--) x = this._XSinv(mdsHInv(x), K[t]);
    return x;
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new HierocryptL1();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HierocryptL1, HierocryptL1Instance };
}));
