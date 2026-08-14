/*
 * SC2000 Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SC2000, designed by Takeshi Shimoyama, Hirotaka Yanami, Kazuhiro Yokoyama,
 * Masahiko Takenaka, Kouichi Itoh, Jun Yajima, Naoya Torii and Hidema Tanaka at
 * Fujitsu Laboratories. Presented at FSE 2001, submitted to NESSIE and included
 * in the CRYPTREC recommended ciphers list. 128-bit block, 128/192/256-bit keys.
 *
 * The cipher alternates an SPN half-round with a pair of Feistel rounds. Writing
 * I for the subkey XOR, B for the bit-sliced 4x4 S-box layer and R for one
 * Feistel round, the structure is (CRYPTREC specification, section 2):
 *
 *   128-bit key, "6.5 rounds", 56 extended keys:
 *     in-I-B-I-R5xR5-I-B-I-R3xR3-I-B-I-R5xR5-I-B-I-R3xR3-I-B-I-R5xR5-I-B-I-R3xR3-I-B-I-out
 *   192/256-bit key, "7.5 rounds", 64 extended keys: the same with one more
 *     R5xR5-I-B-I appended.
 *
 * R5 and R3 are R with mask 0x55555555 and 0x33333333; there is no per-round
 * mask table, only those two values. "x" is the cross connection
 * (a,b,c,d) -> (c,d,a,b) between the two Feistel rounds of a pair.
 *
 *   I(a,b,c,d, k0..k3) = (a^k0, b^k1, c^k2, d^k3)
 *   R(a,b,c,d, mask)   = (a^s, b^t, c, d) where (s,t) = F(c,d,mask)
 *   F(a,b,mask)        = L(M(S(a)), M(S(b)), mask)
 *   L(a,b,mask)        = ((a AND mask) ^ b, (b AND NOT mask) ^ a)
 *   S splits a word MSB-first into 6/5/5/5/5/6-bit fields and runs the outer
 *     fields through S6 and the inner four through S5.
 *   M is a 32x32 GF(2) matrix multiply: bit i of the input (bit 0 being the
 *     most significant) selects row M[i] to be XORed into the accumulator.
 *   B applies the 4-bit S-box S4 bit-slice fashion across the four state words.
 *
 * Decryption reuses I and R unchanged and replaces B by its inverse. R is a
 * Feistel round, hence an involution, and an RxR pair with the cross connection
 * is self-inverse as well, so only the subkey order reverses: the extended keys
 * are consumed in reverse groups of four and the mask sequence runs backwards.
 *
 * Words are big-endian throughout, and within a word bit 0 is the most
 * significant bit.
 */

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
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== TABLES (CRYPTREC specification, section 2) =====

  // 6x6 S-box, used for the two outer 6-bit fields of S.
  const S6 = [
    47,59,25,42,15,23,28,39,26,38,36,19,60,24,29,56,
    37,63,20,61,55, 2,30,44, 9,10, 6,22,53,48,51,11,
    62,52,35,18,14,46, 0,54,17,40,27, 4,31, 8, 5,12,
     3,16,41,34,33, 7,45,49,50,58, 1,21,43,57,32,13
  ];

  // 5x5 S-box, used for the four inner 5-bit fields of S.
  const S5 = [
    20,26, 7,31,19,12,10,15,22,30,13,14, 4,24, 9,18,
    27,11, 1,21, 6,16, 2,28,23, 5, 8, 3, 0,17,29,25
  ];

  // 4x4 S-box for B, and its exact functional inverse for B^-1.
  const S4 = [2,5,10,12,7,15,1,11,13,6,0,9,4,8,3,14];
  const S4I = [10,6,0,14,12,1,9,4,13,11,2,7,3,8,15,5];

  // 32x32 GF(2) diffusion matrix for M. Row i is XORed into the accumulator
  // when bit i of the input - counting bit 0 as the most significant - is set.
  const MATRIX = [
    0xD0C19225, 0xA5A2240A, 0x1B84D250, 0xB728A4A1,
    0x6A704902, 0x85DDDBE6, 0x766FF4A4, 0xECDFE128,
    0xAFD13E94, 0xDF837D09, 0xBB27FA52, 0x695059AC,
    0x52A1BB58, 0xCC322F1D, 0x1844565B, 0xB4A8ACF6,
    0x34235438, 0x6847A851, 0xE48C0CBB, 0xCD181136,
    0x9A112A0C, 0x43EC6D0E, 0x87D8D27D, 0x487DC995,
    0x90FB9B4B, 0xA1F63697, 0xFC513ED9, 0x78A37D93,
    0x8D16C5DF, 0x9E0C8BBE, 0x3C381F7C, 0xE9FB0779
  ];

  // Extended-key selection tables. For output word n the "Order" row picks which
  // of the four intermediate branches (a,b,c,d) supplies each of the four
  // operands, and the "Index" row picks which of that branch's three words.
  const ORDER = [
    [0,1,2,3],[1,0,3,2],[2,3,0,1],[3,2,1,0],
    [0,2,3,1],[1,3,2,0],[2,0,1,3],[3,1,0,2],
    [0,3,1,2],[1,2,0,3],[2,1,3,0],[3,0,2,1]
  ];
  const INDEX = [
    [0,0,0,0],[1,1,1,1],[2,2,2,2],
    [0,1,0,1],[1,2,1,2],[2,0,2,0],
    [0,2,0,2],[1,0,1,0],[2,1,2,1]
  ];

  const MASK5 = 0x55555555;
  const MASK3 = 0x33333333;

  // ===== PRIMITIVES =====

  // S: split MSB-first into 6/5/5/5/5/6-bit fields, substitute, recombine.
  function sFunc(x) {
    let result = OpCodes.Shl32(S6[OpCodes.And32(OpCodes.Shr32(x, 26), 0x3F)], 26);
    result = OpCodes.Or32(result, OpCodes.Shl32(S5[OpCodes.And32(OpCodes.Shr32(x, 21), 0x1F)], 21));
    result = OpCodes.Or32(result, OpCodes.Shl32(S5[OpCodes.And32(OpCodes.Shr32(x, 16), 0x1F)], 16));
    result = OpCodes.Or32(result, OpCodes.Shl32(S5[OpCodes.And32(OpCodes.Shr32(x, 11), 0x1F)], 11));
    result = OpCodes.Or32(result, OpCodes.Shl32(S5[OpCodes.And32(OpCodes.Shr32(x, 6), 0x1F)], 6));
    result = OpCodes.Or32(result, S6[OpCodes.And32(x, 0x3F)]);
    return result;
  }

  // M: 32x32 GF(2) matrix multiply.
  function mFunc(x) {
    let acc = 0;
    for (let b = 0; b < 32; ++b) {
      if (OpCodes.And32(OpCodes.Shr32(x, b), 1) !== 0)
        acc = OpCodes.Xor32(acc, MATRIX[31 - b]);
    }
    return acc;
  }

  function msFunc(x) { return mFunc(sFunc(x)); }

  // B: transpose the four state words into 32 nibbles, substitute, transpose
  // back. Feeding S4I instead of S4 gives B^-1.
  function bFunc(state, table) {
    let o0 = 0, o1 = 0, o2 = 0, o3 = 0;
    for (let bit = 0; bit < 32; ++bit) {
      const a = OpCodes.And32(OpCodes.Shr32(state[0], bit), 1);
      const b = OpCodes.And32(OpCodes.Shr32(state[1], bit), 1);
      const c = OpCodes.And32(OpCodes.Shr32(state[2], bit), 1);
      const d = OpCodes.And32(OpCodes.Shr32(state[3], bit), 1);
      const nibble = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(a, 3), OpCodes.Shl32(b, 2)), OpCodes.Shl32(c, 1)), d);
      const value = table[nibble];
      if (OpCodes.And32(OpCodes.Shr32(value, 3), 1) !== 0) o0 = OpCodes.Or32(o0, OpCodes.Shl32(1, bit));
      if (OpCodes.And32(OpCodes.Shr32(value, 2), 1) !== 0) o1 = OpCodes.Or32(o1, OpCodes.Shl32(1, bit));
      if (OpCodes.And32(OpCodes.Shr32(value, 1), 1) !== 0) o2 = OpCodes.Or32(o2, OpCodes.Shl32(1, bit));
      if (OpCodes.And32(value, 1) !== 0)                   o3 = OpCodes.Or32(o3, OpCodes.Shl32(1, bit));
    }
    return [o0, o1, o2, o3];
  }

  // I: XOR four extended-key words into the state.
  function iFunc(state, rk, offset) {
    return [
      OpCodes.Xor32(state[0], rk[offset]),
      OpCodes.Xor32(state[1], rk[offset + 1]),
      OpCodes.Xor32(state[2], rk[offset + 2]),
      OpCodes.Xor32(state[3], rk[offset + 3])
    ];
  }

  // F = L(M(S(a)), M(S(b)), mask)
  function fFunc(a, b, mask) {
    const x = msFunc(a);
    const y = msFunc(b);
    return [
      OpCodes.Xor32(OpCodes.And32(mask, x), y),
      OpCodes.Xor32(OpCodes.And32(OpCodes.Not32(mask), y), x)
    ];
  }

  // One RxR pair: a Feistel round, the cross connection (a,b,c,d)->(c,d,a,b),
  // and a second Feistel round. Both R and the pair as a whole are involutions,
  // which is why decryption reuses this function unchanged.
  function rFuncPair(state, mask) {
    const [a, b, c, d] = state;
    const [s1, t1] = fFunc(c, d, mask);
    const a1 = OpCodes.Xor32(a, s1);
    const b1 = OpCodes.Xor32(b, t1);
    const [s2, t2] = fFunc(a1, b1, mask);
    return [OpCodes.Xor32(c, s2), OpCodes.Xor32(d, t2), a1, b1];
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class SC2000 extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SC2000";
      this.description = "Fujitsu Laboratories block cipher combining an SPN half-round (subkey XOR plus a bit-sliced 4-bit S-box layer) with pairs of Feistel rounds built from 6-bit and 5-bit S-boxes and a 32x32 GF(2) diffusion matrix. 128-bit block; 6.5 rounds for a 128-bit key and 7.5 for 192/256-bit keys. Submitted to NESSIE and listed by CRYPTREC.";
      this.inventor = "Takeshi Shimoyama, Hirotaka Yanami, Kazuhiro Yokoyama, Masahiko Takenaka, Kouichi Itoh, Jun Yajima, Naoya Torii, Hidema Tanaka";
      this.year = 2000;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.JP;

      this.SupportedKeySizes = [new KeySize(16, 32, 8)];
      this.SupportedBlockSizes = [new KeySize(16, 16, 1)];

      this.documentation = [
        new LinkItem("SC2000 specification (CRYPTREC)", "https://www.cryptrec.go.jp/cryptrec_03_spec_cypherlist_files/PDF/09_01jspec.pdf"),
        new LinkItem("The Block Cipher SC2000 (FSE 2001)", "https://link.springer.com/content/pdf/10.1007/3-540-45473-X_26.pdf"),
        new LinkItem("SC2000 (Fujitsu)", "https://www.fujitsu.com/global/about/research/external-activities/crypto/sc2000.html")
      ];

      this.references = [
        new LinkItem("Fujitsu NESSIE submission package (includes the official test vectors)", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/sc2000.zip"),
        new LinkItem("Security Analysis of the Block Cipher SC2000 (CRYPTREC, 2012)", "https://www.cryptrec.go.jp/exreport/cryptrec-ex-2202-2012p3.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Reduced-round differential and boomerang attacks", "Attacks are published against reduced-round variants; the full cipher is unbroken but CRYPTREC has moved it off its recommended list.", "Use AES or another currently recommended cipher.")
      ];

      // Official test vectors: the all-zero case is published in the CRYPTREC
      // specification's worked example (appendix A) and again in Fujitsu's NESSIE
      // submission; the rest are from the NESSIE submission's testvectors128.txt
      // and testvectors{192,256}.txt.
      this.tests = [
        {
          text: "CRYPTREC specification appendix A — 128-bit zero key and plaintext",
          uri: "https://www.cryptrec.go.jp/cryptrec_03_spec_cypherlist_files/PDF/09_01jspec.pdf",
          input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          expected: OpCodes.Hex8ToBytes('fae4baa3bb72c4c060b9a4a5c4b2ab32')
        },
        {
          text: "NESSIE submission testvectors128.txt — single key bit set",
          uri: "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/sc2000.zip",
          input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('80000000000000000000000000000000'),
          expected: OpCodes.Hex8ToBytes('3fcb3bc9dbe00a8bf28d69d7f67102a7')
        },
        {
          text: "NESSIE submission testvectors128.txt — single plaintext bit set",
          uri: "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/sc2000.zip",
          input: OpCodes.Hex8ToBytes('80000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          expected: OpCodes.Hex8ToBytes('b75cd863b9cb21c7cebd9e1014bf774f')
        },
        {
          text: "NESSIE submission testvectors128.txt — repeating 0x01 key and plaintext",
          uri: "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/sc2000.zip",
          input: OpCodes.Hex8ToBytes('01010101010101010101010101010101'),
          key: OpCodes.Hex8ToBytes('01010101010101010101010101010101'),
          expected: OpCodes.Hex8ToBytes('ee5c548ea5ef353b896a780e324be38d')
        },
        {
          text: "NESSIE submission testvectors128.txt — repeating 0x09 key and plaintext",
          uri: "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/sc2000.zip",
          input: OpCodes.Hex8ToBytes('09090909090909090909090909090909'),
          key: OpCodes.Hex8ToBytes('09090909090909090909090909090909'),
          expected: OpCodes.Hex8ToBytes('8839d41b099a817ef8f9ffe6b88455ce')
        },
        {
          text: "NESSIE submission testvectors192.txt — 192-bit zero key and plaintext",
          uri: "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/sc2000.zip",
          input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('000000000000000000000000000000000000000000000000'),
          expected: OpCodes.Hex8ToBytes('6c2bab231cb641ed3ac8d4b0ea69ee3b')
        },
        {
          text: "NESSIE submission testvectors256.txt — 256-bit zero key and plaintext",
          uri: "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/sc2000.zip",
          input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
          expected: OpCodes.Hex8ToBytes('6c2bab231cb641ed3ac8d4b0ea69ee3b')
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SC2000Instance(this, isInverse);
    }
  }

  class SC2000Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._roundKeys = null;
      this._rounds = 0;
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this._roundKeys = null;
        this.KeySize = 0;
        return;
      }

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
        && (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      // 6.5 rounds for a 128-bit key, 7.5 for 192 and 256.
      this._rounds = keyBytes.length === 16 ? 6 : 7;
      this._roundKeys = this._expandKey(this._key);
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
        throw new Error(`Input length must be a multiple of ${this.BlockSize} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
        for (let _i = 0; _i < processed.length; _i++) output.push(processed[_i]);
      }

      this.inputBuffer = [];
      return output;
    }

    // The mask of Feistel pair index r: R5 for even, R3 for odd.
    _maskOf(r) { return (r % 2) === 0 ? MASK5 : MASK3; }

    _expandKey(keyBytes) {
      // Step 1: read the master key big-endian and extend it to eight words.
      // A 128-bit key repeats its four words; a 192-bit key repeats its first
      // two; a 256-bit key is used as it stands.
      const words = [];
      for (let i = 0; i < keyBytes.length / 4; ++i)
        words.push(OpCodes.Pack32BE(keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3]));

      const uk = new Array(8);
      for (let i = 0; i < words.length; ++i) uk[i] = words[i];
      if (words.length === 4) {
        uk[4] = uk[0]; uk[5] = uk[1]; uk[6] = uk[2]; uk[7] = uk[3];
      } else if (words.length === 6) {
        uk[6] = uk[0]; uk[7] = uk[1];
      }

      // Step 2: twelve intermediate key words, three per branch. Branch j takes
      // uk[2j] and uk[2j+1]; the "constants" are simply 4i+j pushed through M(S(.)).
      const intermediate = new Array(12);
      for (let branch = 0; branch < 4; ++branch) {
        const u0 = msFunc(uk[branch * 2]);
        const u1 = msFunc(uk[branch * 2 + 1]);
        for (let i = 0; i < 3; ++i) {
          const constant = msFunc(4 * i + branch);
          const sum = OpCodes.Add32(u0, constant);
          const scaled = OpCodes.ToUint32((i + 1) * u1);
          intermediate[branch * 3 + i] = msFunc(OpCodes.Xor32(sum, scaled));
        }
      }

      // Step 3: the extended keys.
      //   ek[n] = ((X[x] ROTL 1) + Y[y]) XOR (((Z[z] ROTL 1) - W[w]) ROTL 1)
      const count = this._rounds === 6 ? 56 : 64;
      const rk = new Array(count);
      for (let n = 0; n < count; ++n) {
        const order = ORDER[(n + Math.floor(n / 36)) % 12];
        const index = INDEX[n % 9];
        const x = intermediate[order[0] * 3 + index[0]];
        const y = intermediate[order[1] * 3 + index[1]];
        const z = intermediate[order[2] * 3 + index[2]];
        const w = intermediate[order[3] * 3 + index[3]];
        const first = OpCodes.Add32(OpCodes.RotL32(x, 1), y);
        const second = OpCodes.RotL32(OpCodes.Sub32(OpCodes.RotL32(z, 1), w), 1);
        rk[n] = OpCodes.Xor32(first, second);
      }
      return rk;
    }

    _loadBlock(block) {
      return [
        OpCodes.Pack32BE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32BE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32BE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32BE(block[12], block[13], block[14], block[15])
      ];
    }

    _storeBlock(state) {
      const out = [];
      for (let i = 0; i < 4; ++i) {
        const bytes = OpCodes.Unpack32BE(state[i]);
        for (let j = 0; j < 4; ++j) out.push(bytes[j]);
      }
      return out;
    }

    _encryptBlock(block) {
      const rk = this._roundKeys;
      let state = this._loadBlock(block);

      for (let r = 0; r < this._rounds; ++r) {
        state = iFunc(state, rk, 8 * r);
        state = bFunc(state, S4);
        state = iFunc(state, rk, 8 * r + 4);
        state = rFuncPair(state, this._maskOf(r));
      }

      // Trailing half-round.
      state = iFunc(state, rk, 8 * this._rounds);
      state = bFunc(state, S4);
      state = iFunc(state, rk, 8 * this._rounds + 4);

      return this._storeBlock(state);
    }

    _decryptBlock(block) {
      const rk = this._roundKeys;
      let state = this._loadBlock(block);

      state = iFunc(state, rk, 8 * this._rounds + 4);
      state = bFunc(state, S4I);
      state = iFunc(state, rk, 8 * this._rounds);

      for (let r = this._rounds - 1; r >= 0; --r) {
        state = rFuncPair(state, this._maskOf(r));
        state = iFunc(state, rk, 8 * r + 4);
        state = bFunc(state, S4I);
        state = iFunc(state, rk, 8 * r);
      }

      return this._storeBlock(state);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SC2000();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SC2000, SC2000Instance };
}));
