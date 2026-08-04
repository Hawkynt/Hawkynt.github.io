/*
 * DES-X (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The DES-X construction as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). A 128-bit key is split into two 8-byte
 * halves: the low half is the plain DES key (standard IP/FP/PC1/PC2/S-boxes/P,
 * bit-identical to textbook DES), the high half (K1) is used raw as an
 * input/output whitening key. This DarkCrypt implementation has two quirks
 * relative to textbook DES-X:
 *   - Before building the DES key schedule, every byte of the DES-key half has its
 *     top bit forced so the byte carries ODD parity (standard DES key-parity
 *     convention), and this parity-fixed key (not the raw one) feeds the schedule.
 *   - The output whitening key K2 is NOT simply K1; it is derived from the
 *     ORIGINAL (pre-parity-fix) DES-key half followed by K1, fed byte-by-byte
 *     through an 8-byte LFSR-style shift register driven by a dedicated 256-byte
 *     S-box (K2SBOX): out = K2SBOX[buf[0]^buf[1]] ^ srcByte, buf shifted left 1
 *     each step; 8 steps with the DES-key bytes, then 8 more with the K1 bytes.
 * crypt(): block ^= K1; block = DES_encrypt(desKeyFixed, block); block ^= K2.
 * decrypt(): block ^= K2; block = DES_decrypt(desKeyFixed, block); block ^= K1.
 * 64-bit blocks, 128-bit keys. Educational only.
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

  // ---- Standard DES tables (bit-identical to textbook DES) ----
  const IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,
              57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
  const FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,
              36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
  const PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,
               63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
  const PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,
               41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
  // Cumulative left-rotation amount (from the ORIGINAL PC1 output) used per round
  // by DarkCrypt's schedule generator: rounds are recomputed from pc1[], not
  // rotated incrementally from the previous round.
  const ROT = [1,2,4,6,8,10,12,14,15,17,19,21,23,25,27,28];
  const PTAB = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
  const SBOXES = [
    [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7, 0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,
     4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0, 15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
    [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10, 3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,
     0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15, 13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
    [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8, 13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,
     13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7, 1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
    [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15, 13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,
     10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4, 3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14],
    [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9, 14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,
     4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14, 11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
    [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11, 10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,
     9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6, 4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
    [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1, 13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,
     1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2, 6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
    [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7, 1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,
     7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8, 2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]
  ];

  // DarkCrypt-specific 256-byte S-box driving the K2 (output-whitening key) LFSR.
  const K2SBOX = [
    0xBD,0x56,0xEA,0xF2,0xA2,0xF1,0xAC,0x2A,0xB0,0x93,0xD1,0x9C,0x1B,0x33,0xFD,0xD0,
    0x30,0x04,0xB6,0xDC,0x7D,0xDF,0x32,0x4B,0xF7,0xCB,0x45,0x9B,0x31,0xBB,0x21,0x5A,
    0x41,0x9F,0xE1,0xD9,0x4A,0x4D,0x9E,0xDA,0xA0,0x68,0x2C,0xC3,0x27,0x5F,0x80,0x36,
    0x3E,0xEE,0xFB,0x95,0x1A,0xFE,0xCE,0xA8,0x34,0xA9,0x13,0xF0,0xA6,0x3F,0xD8,0x0C,
    0x78,0x24,0xAF,0x23,0x52,0xC1,0x67,0x17,0xF5,0x66,0x90,0xE7,0xE8,0x07,0xB8,0x60,
    0x48,0xE6,0x1E,0x53,0xF3,0x92,0xA4,0x72,0x8C,0x08,0x15,0x6E,0x86,0x00,0x84,0xFA,
    0xF4,0x7F,0x8A,0x42,0x19,0xF6,0xDB,0xCD,0x14,0x8D,0x50,0x12,0xBA,0x3C,0x06,0x4E,
    0xEC,0xB3,0x35,0x11,0xA1,0x88,0x8E,0x2B,0x94,0x99,0xB7,0x71,0x74,0xD3,0xE4,0xBF,
    0x3A,0xDE,0x96,0x0E,0xBC,0x0A,0xED,0x77,0xFC,0x37,0x6B,0x03,0x79,0x89,0x62,0xC6,
    0xD7,0xC0,0xD2,0x7C,0x6A,0x8B,0x22,0xA3,0x5B,0x05,0x5D,0x02,0x75,0xD5,0x61,0xE3,
    0x18,0x8F,0x55,0x51,0xAD,0x1F,0x0B,0x5E,0x85,0xE5,0xC2,0x57,0x63,0xCA,0x3D,0x6C,
    0xB4,0xC5,0xCC,0x70,0xB2,0x91,0x59,0x0D,0x47,0x20,0xC8,0x4F,0x58,0xE0,0x01,0xE2,
    0x16,0x38,0xC4,0x6F,0x3B,0x0F,0x65,0x46,0xBE,0x7E,0x2D,0x7B,0x82,0xF9,0x40,0xB5,
    0x1D,0x73,0xF8,0xEB,0x26,0xC7,0x87,0x97,0x25,0x54,0xB1,0x28,0xAA,0x98,0x9D,0xA5,
    0x64,0x6D,0x7A,0xD4,0x10,0x81,0x44,0xEF,0x49,0xD6,0xAE,0x2E,0xDD,0x76,0x5C,0x2F,
    0xA7,0x1C,0xC9,0x09,0x69,0x9A,0x83,0xCF,0x29,0x39,0xB9,0xE9,0x4C,0xFF,0x43,0xAB
  ];

  // Precompute the 8 S-box-input-nibble -> S-box-output-32-bit-permuted-word
  // tables. DarkCrypt's window extraction (see F() below) delivers the 6-bit
  // S-box index with a different bit ordering than the textbook row/col split,
  // so the raw 6-bit value is first re-mapped to a standard "row*16+col" index.
  const invP = new Array(32);
  for (let k = 0; k < 32; k++)
    for (let j = 0; j < 32; j++)
      if (PTAB[j] - 1 === k) { invP[k] = j; break; }

  const SP = [];
  for (let i = 0; i < 8; i++) {
    const box = new Array(64);
    for (let v = 0; v < 64; v++) {
      const rowCol = OpCodes.Shl32(OpCodes.And32(v, 1), 4) | OpCodes.And32(v, 0x20) | OpCodes.And32(OpCodes.Shr32(v, 1), 0xF);
      const nibble = SBOXES[i][rowCol];
      let accum = 0;
      for (let bitPos = 0; bitPos < 4; bitPos++) {
        if (OpCodes.And32(nibble, OpCodes.Shr32(8, bitPos))) {
          const outBit = 31 - invP[i * 4 + bitPos];
          accum |= OpCodes.Shl32(1, outBit);
        }
      }
      box[v] = OpCodes.ToUint32(accum);
    }
    SP.push(box);
  }

  function bytesToBits(bytes) {
    const bits = [];
    for (const b of bytes)
      for (let i = 7; i >= 0; i--)
        bits.push(OpCodes.GetBit(b, i));
    return bits;
  }

  function bitsToBytes(bits) {
    const out = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = SetHighBitFirst(v, j, bits[i + j]);
      out.push(v);
    }
    return out;
  }
  function SetHighBitFirst(value, j, bit) { return OpCodes.SetBit(value, 7 - j, bit); }

  function permute(bits, table) { return table.map(pos => bits[pos - 1]); }
  function ipBlock(block8) { return bitsToBytes(permute(bytesToBits(block8), IP)); }
  function fpBlock(block8) { return bitsToBytes(permute(bytesToBits(block8), FP)); }

  // DES round function. R is a 32-bit word built with OpCodes.Pack32LE from the
  // permuted block bytes (little-endian dword layout, matching the DarkCrypt
  // implementation); key8 holds one 6-bit S-box selector per box in its low 6 bits.
  function feistelF(R, key8) {
    const rotR = OpCodes.RotL32(R, 1);
    let accum = 0;
    accum |= SP[7][OpCodes.And32(OpCodes.Xor32(key8[7], rotR), 0x3F)];
    let tmp = OpCodes.Shr32(R, 3);
    accum |= SP[6][OpCodes.And32(OpCodes.Xor32(key8[6], tmp), 0x3F)];
    tmp = OpCodes.Shr32(tmp, 4); accum |= SP[5][OpCodes.And32(OpCodes.Xor32(key8[5], tmp), 0x3F)];
    tmp = OpCodes.Shr32(tmp, 4); accum |= SP[4][OpCodes.And32(OpCodes.Xor32(key8[4], tmp), 0x3F)];
    tmp = OpCodes.Shr32(tmp, 4); accum |= SP[3][OpCodes.And32(OpCodes.Xor32(key8[3], tmp), 0x3F)];
    tmp = OpCodes.Shr32(tmp, 4); accum |= SP[2][OpCodes.And32(OpCodes.Xor32(key8[2], tmp), 0x3F)];
    tmp = OpCodes.Shr32(tmp, 4); accum |= SP[1][OpCodes.And32(OpCodes.Xor32(key8[1], tmp), 0x3F)];
    tmp = OpCodes.Shr32(tmp, 4); tmp |= OpCodes.Shl32(OpCodes.And32(R, 1), 5);
    accum |= SP[0][OpCodes.And32(OpCodes.Xor32(key8[0], tmp), 0x3F)];
    return OpCodes.ToUint32(accum);
  }

  // Standard DES key schedule (PC1, per-round cumulative rotation, PC2), packed
  // as 16 rounds x 8 bytes (one byte per S-box holding its 6-bit selector).
  function buildSubkeys(desKey8) {
    const pc1 = permute(bytesToBits(desKey8), PC1); // 56 bits
    const subkeys = [];
    for (let r = 0; r < 16; r++) {
      const rot = ROT[r];
      const rotated = new Array(56);
      for (let j = 0; j < 56; j++) {
        const half = j < 28 ? 28 : 56;
        const base = j < 28 ? 0 : 28;
        rotated[j] = pc1[base + ((j - base + rot) % (half - base))];
      }
      const pc2bits = permute(rotated, PC2); // 48 bits
      const key8 = new Array(8).fill(0);
      for (let j = 0; j < 48; j++) {
        const box = (j / 6) | 0, bitInBox = j % 6;
        if (pc2bits[j]) key8[box] |= OpCodes.Shr32(0x20, bitInBox);
      }
      subkeys.push(key8);
    }
    return subkeys;
  }

  function desCryptCore(block8, subkeys, decrypt) {
    const ipOut = ipBlock(block8);
    let Y = OpCodes.Pack32LE(ipOut[0], ipOut[1], ipOut[2], ipOut[3]);
    let X = OpCodes.Pack32LE(ipOut[4], ipOut[5], ipOut[6], ipOut[7]);

    if (!decrypt) {
      for (let r = 0; r < 16; r++) {
        if (OpCodes.And32(r, 1) === 0) Y = OpCodes.Xor32(Y, feistelF(X, subkeys[r]));
        else X = OpCodes.Xor32(X, feistelF(Y, subkeys[r]));
      }
      return fpBlock([...OpCodes.Unpack32LE(X), ...OpCodes.Unpack32LE(Y)]);
    }

    for (let i = 0; i < 16; i++) {
      const r = 15 - i;
      if (OpCodes.And32(i, 1) === 0) Y = OpCodes.Xor32(Y, feistelF(X, subkeys[r]));
      else X = OpCodes.Xor32(X, feistelF(Y, subkeys[r]));
    }
    return fpBlock([...OpCodes.Unpack32LE(X), ...OpCodes.Unpack32LE(Y)]);
  }

  // Forces odd byte parity (standard DES key-parity convention): the low 7 bits
  // are kept as-is and bit 7 is set so the total number of 1-bits is odd.
  function oddParityFix(byte) {
    const low7 = OpCodes.And32(byte, 0x7F);
    let x = low7, parity = 0;
    for (let i = 0; i < 7; i++) { parity ^= OpCodes.And32(x, 1); x = OpCodes.Shr32(x, 1); }
    return low7 | OpCodes.Shl32(parity === 0 ? 1 : 0, 7);
  }

  // K2 (output whitening key) LFSR: 8 bytes of desKeyOrig, then 8 bytes of K1,
  // each step folding K2SBOX[buf[0]^buf[1]] ^ srcByte into the shift register.
  function deriveK2(desKeyOrig, K1) {
    const buf = [0, 0, 0, 0, 0, 0, 0, 0];
    function step(srcByte) {
      const fb = K2SBOX[OpCodes.And32(OpCodes.Xor32(buf[0], buf[1]), 0xFF)];
      for (let i = 0; i < 7; i++) buf[i] = buf[i + 1];
      buf[7] = OpCodes.And32(OpCodes.Xor32(fb, srcByte), 0xFF);
    }
    for (let i = 0; i < 8; i++) step(desKeyOrig[i]);
    for (let i = 0; i < 8; i++) step(K1[i]);
    return buf.slice();
  }

  class DarkCryptDESXAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "DES-X (DarkCrypt)";
      this.description = "DES-X construction from the DarkCrypt Total Commander plugin: a 128-bit key splits into a DES key (parity-fixed before scheduling) and a raw input-whitening key K1, with the output-whitening key K2 derived from both halves via a dedicated LFSR/S-box. 64-bit block, 128-bit key.";
      this.inventor = "Ron Rivest (DES-X construction); DES core: IBM/NSA; DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("DESX (base construction)", "https://en.wikipedia.org/wiki/DES-X")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard key/whitening derivation", "K1/K2 derivation and DES-key parity fixup are DarkCrypt-specific and unanalyzed; not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Desx — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("1d48e0c047ab576c")
        },
        {
          text: "DarkCrypt Desx — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("b47b177d71950979")
        },
        {
          text: "DarkCrypt Desx — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("52133e786523302e")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptDESXInstance(this, isInverse);
    }
  }

  class DarkCryptDESXInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null; this.KeySize = 0;
        this._K1 = null; this._K2 = null; this._subkeys = null;
        return;
      }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. DES-X (DarkCrypt) requires exactly 16 bytes`);

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      const desKeyOrig = keyBytes.slice(0, 8);
      this._K1 = keyBytes.slice(8, 16);
      this._K2 = deriveK2(desKeyOrig, this._K1);
      const desKeyFixed = desKeyOrig.map(oddParityFix);
      this._subkeys = buildSubkeys(desKeyFixed);
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
      let b = OpCodes.XorArrays(block, this._K1);
      b = desCryptCore(b, this._subkeys, false);
      return OpCodes.XorArrays(b, this._K2);
    }

    _decryptBlock(block) {
      let b = OpCodes.XorArrays(block, this._K2);
      b = desCryptCore(b, this._subkeys, true);
      return OpCodes.XorArrays(b, this._K1);
    }
  }

  const algorithmInstance = new DarkCryptDESXAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptDESXAlgorithm, DarkCryptDESXInstance };
}));
