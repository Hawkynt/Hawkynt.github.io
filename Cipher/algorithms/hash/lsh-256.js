/*
 * LSH-256 Hash Function - Korean Lightweight Secure Hash
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * LSH-256 produces 256-bit digests using Korean cryptographic standard
 * Reference: https://seed.kisa.or.kr/kisa/algorithm/EgovLSHInfo.do
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
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  // LSH256 Constants
  const LSH256_MSG_BLK_BYTE_LEN = 128;
  const LSH256_HASH_VAL_MAX_BYTE_LEN = 32;
  const CV_WORD_LEN = 16;
  const NUM_STEPS = 26;
  const ROT_EVEN_ALPHA = 29;
  const ROT_EVEN_BETA = 1;
  const ROT_ODD_ALPHA = 5;
  const ROT_ODD_BETA = 17;

  // LSH256 Initial Values
  const LSH256_IV256 = new Uint32Array([
    0x46a10f1f, 0xfddce486, 0xb41443a8, 0x198e6b9d,
    0x3304388d, 0xb0f5a3c7, 0xb36061c4, 0x7adbd553,
    0x105d5378, 0x2f74de54, 0x5c2f2d95, 0xf2553fbe,
    0x8051357a, 0x138668c8, 0x47aa4484, 0xe01afb41
  ]);

  // LSH256 Step Constants (208 constants for 26 steps × 8 words)
  const LSH256_StepConstants = new Uint32Array([
    0x917caf90, 0x6c1b10a2, 0x6f352943, 0xcf778243, 0x2ceb7472, 0x29e96ff2, 0x8a9ba428, 0x2eeb2642,
    0x0e2c4021, 0x872bb30e, 0xa45e6cb2, 0x46f9c612, 0x185fe69e, 0x1359621b, 0x263fccb2, 0x1a116870,
    0x3a6c612f, 0xb2dec195, 0x02cb1f56, 0x40bfd858, 0x784684b6, 0x6cbb7d2e, 0x660c7ed8, 0x2b79d88a,
    0xa6cd9069, 0x91a05747, 0xcdea7558, 0x00983098, 0xbecb3b2e, 0x2838ab9a, 0x728b573e, 0xa55262b5,
    0x745dfa0f, 0x31f79ed8, 0xb85fce25, 0x98c8c898, 0x8a0669ec, 0x60e445c2, 0xfde295b0, 0xf7b5185a,
    0xd2580983, 0x29967709, 0x182df3dd, 0x61916130, 0x90705676, 0x452a0822, 0xe07846ad, 0xaccd7351,
    0x2a618d55, 0xc00d8032, 0x4621d0f5, 0xf2f29191, 0x00c6cd06, 0x6f322a67, 0x58bef48d, 0x7a40c4fd,
    0x8beee27f, 0xcd8db2f2, 0x67f2c63b, 0xe5842383, 0xc793d306, 0xa15c91d6, 0x17b381e5, 0xbb05c277,
    0x7ad1620a, 0x5b40a5bf, 0x5ab901a2, 0x69a7a768, 0x5b66d9cd, 0xfdee6877, 0xcb3566fc, 0xc0c83a32,
    0x4c336c84, 0x9be6651a, 0x13baa3fc, 0x114f0fd1, 0xc240a728, 0xec56e074, 0x009c63c7, 0x89026cf2,
    0x7f9ff0d0, 0x824b7fb5, 0xce5ea00f, 0x605ee0e2, 0x02e7cfea, 0x43375560, 0x9d002ac7, 0x8b6f5f7b,
    0x1f90c14f, 0xcdcb3537, 0x2cfeafdd, 0xbf3fc342, 0xeab7b9ec, 0x7a8cb5a3, 0x9d2af264, 0xfacedb06,
    0xb052106e, 0x99006d04, 0x2bae8d09, 0xff030601, 0xa271a6d6, 0x0742591d, 0xc81d5701, 0xc9a9e200,
    0x02627f1e, 0x996d719d, 0xda3b9634, 0x02090800, 0x14187d78, 0x499b7624, 0xe57458c9, 0x738be2c9,
    0x64e19d20, 0x06df0f36, 0x15d1cb0e, 0x0b110802, 0x2c95f58c, 0xe5119a6d, 0x59cd22ae, 0xff6eac3c,
    0x467ebd84, 0xe5ee453c, 0xe79cd923, 0x1c190a0d, 0xc28b81b8, 0xf6ac0852, 0x26efd107, 0x6e1ae93b,
    0xc53c41ca, 0xd4338221, 0x8475fd0a, 0x35231729, 0x4e0d3a7a, 0xa2b45b48, 0x16c0d82d, 0x890424a9,
    0x017e0c8f, 0x07b5a3f5, 0xfa73078e, 0x583a405e, 0x5b47b4c8, 0x570fa3ea, 0xd7990543, 0x8d28ce32,
    0x7f8a9b90, 0xbd5998fc, 0x6d7a9688, 0x927a9eb6, 0xa2fc7d23, 0x66b38e41, 0x709e491a, 0xb5f700bf,
    0x0a262c0f, 0x16f295b9, 0xe8111ef5, 0x0d195548, 0x9f79a0c5, 0x1a41cfa7, 0x0ee7638a, 0xacf7c074,
    0x30523b19, 0x09884ecf, 0xf93014dd, 0x266e9d55, 0x191a6664, 0x5c1176c1, 0xf64aed98, 0xa4b83520,
    0x828d5449, 0x91d71dd8, 0x2944f2d6, 0x950bf27b, 0x3380ca7d, 0x6d88381d, 0x4138868e, 0x5ced55c4,
    0x0fe19dcb, 0x68f4f669, 0x6e37c8ff, 0xa0fe6e10, 0xb44b47b0, 0xf5c0558a, 0x79bf14cf, 0x4a431a20,
    0xf17f68da, 0x5deb5fd1, 0xa600c86d, 0x9f6c7eb0, 0xff92f864, 0xb615e07f, 0x38d3e448, 0x8d5d3a6a,
    0x70e843cb, 0x494b312e, 0xa6c93613, 0x0beb2f4f, 0x928b5d63, 0xcbf66035, 0x0cb82c80, 0xea97a4f7,
    0x592c0f3b, 0x947c5f77, 0x6fff49b9, 0xf71a7e5a, 0x1de8c0f5, 0xc2569600, 0xc4e4ac8c, 0x823c9ce1
  ]);

  const GAMMA256 = new Uint32Array([0, 8, 16, 24, 24, 16, 8, 0]);

  class LSH256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "LSH-256";
      this.description = "Korean Lightweight Secure Hash producing 256-bit digests. Developed by Korea Internet & Security Agency (KISA) as part of Korean cryptographic standards.";
      this.inventor = "Korea Internet & Security Agency (KISA)";
      this.year = 2014;
      this.category = CategoryType.HASH;
      this.subCategory = "Korean Hash";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.KR;

      this.SupportedHashSizes = [new KeySize(32, 32, 1)];
      this.BlockSize = 128;

      this.documentation = [
        new LinkItem("LSH Specification", "https://seed.kisa.or.kr/kisa/algorithm/EgovLSHInfo.do"),
        new LinkItem("KISA Standards", "https://seed.kisa.or.kr/")
      ];

      this.references = [
        new LinkItem("Crypto++ LSH", "https://github.com/weidai11/cryptopp/blob/master/lsh256.cpp"),
        new LinkItem("LSH Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt")
      ];

      this.tests = [
        {
          text: "LSH-256: Empty (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: [],
          expected: OpCodes.Hex8ToBytes("f3cd416a03818217726cb47f4e4d2881c9c29fd445c18b66fb19dea1a81007c1")
        },
        {
          text: "LSH-256: Single byte (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: OpCodes.Hex8ToBytes("ce"),
          expected: OpCodes.Hex8ToBytes("862f86db654094840d86df7881732fd69b7227ee4f7943868162feb733a9ca5b")
        },
        {
          text: "LSH-256: Two bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: OpCodes.Hex8ToBytes("8b6c"),
          expected: OpCodes.Hex8ToBytes("da96b21314cfd129fdbaa620dc3d0e2b5b3e087e90e6c147cc6b9950fde4b40e")
        },
        {
          text: "LSH-256: Four bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: OpCodes.Hex8ToBytes("a546a625"),
          expected: OpCodes.Hex8ToBytes("48da0960d72bab0f52f7f33f063f6b4fb9b6c73e15d08f865bb62e22fb7eaa8a")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new LSH256Instance(this);
    }
  }

  class LSH256Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.cv_l = new Uint32Array(8);
      this.cv_r = new Uint32Array(8);
      this.sub_msgs = new Uint32Array(32); // 4 submessages × 8 words
      this.last_block = new Uint8Array(LSH256_MSG_BLK_BYTE_LEN);
      this.remain_databitlen = 0;
      this._initialize();
    }

    _initialize() {
      // Load IV256
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = LSH256_IV256[i];
        this.cv_r[i] = LSH256_IV256[i + 8];
      }
      this.sub_msgs.fill(0);
      this.remain_databitlen = 0;
    }

    _load_msg_blk(msgblk) {
      // Load 128 bytes into 4 sub-messages (32 words total)
      const submsg_e_l = new Uint32Array(this.sub_msgs.buffer, 0, 8);
      const submsg_e_r = new Uint32Array(this.sub_msgs.buffer, 32, 8);
      const submsg_o_l = new Uint32Array(this.sub_msgs.buffer, 64, 8);
      const submsg_o_r = new Uint32Array(this.sub_msgs.buffer, 96, 8);

      for (let i = 0; i < 8; i++) {
        submsg_e_l[i] = OpCodes.Pack32LE(msgblk[i*4], msgblk[i*4+1], msgblk[i*4+2], msgblk[i*4+3]);
        submsg_e_r[i] = OpCodes.Pack32LE(msgblk[32+i*4], msgblk[32+i*4+1], msgblk[32+i*4+2], msgblk[32+i*4+3]);
        submsg_o_l[i] = OpCodes.Pack32LE(msgblk[64+i*4], msgblk[64+i*4+1], msgblk[64+i*4+2], msgblk[64+i*4+3]);
        submsg_o_r[i] = OpCodes.Pack32LE(msgblk[96+i*4], msgblk[96+i*4+1], msgblk[96+i*4+2], msgblk[96+i*4+3]);
      }
    }

    _msg_exp_even() {
      const submsg_e_l = new Uint32Array(this.sub_msgs.buffer, 0, 8);
      const submsg_e_r = new Uint32Array(this.sub_msgs.buffer, 32, 8);
      const submsg_o_l = new Uint32Array(this.sub_msgs.buffer, 64, 8);
      const submsg_o_r = new Uint32Array(this.sub_msgs.buffer, 96, 8);

      let temp;
      temp = submsg_e_l[0];
      // NOTE: >>> 0 is JavaScript idiom for unsigned 32-bit conversion, not a bit shift operation
      submsg_e_l[0] = (submsg_o_l[0] + submsg_e_l[3]) >>> 0;
      submsg_e_l[3] = (submsg_o_l[3] + submsg_e_l[1]) >>> 0;
      submsg_e_l[1] = (submsg_o_l[1] + submsg_e_l[2]) >>> 0;
      submsg_e_l[2] = (submsg_o_l[2] + temp) >>> 0;
      temp = submsg_e_l[4];
      submsg_e_l[4] = (submsg_o_l[4] + submsg_e_l[7]) >>> 0;
      submsg_e_l[7] = (submsg_o_l[7] + submsg_e_l[6]) >>> 0;
      submsg_e_l[6] = (submsg_o_l[6] + submsg_e_l[5]) >>> 0;
      submsg_e_l[5] = (submsg_o_l[5] + temp) >>> 0;
      temp = submsg_e_r[0];
      submsg_e_r[0] = (submsg_o_r[0] + submsg_e_r[3]) >>> 0;
      submsg_e_r[3] = (submsg_o_r[3] + submsg_e_r[1]) >>> 0;
      submsg_e_r[1] = (submsg_o_r[1] + submsg_e_r[2]) >>> 0;
      submsg_e_r[2] = (submsg_o_r[2] + temp) >>> 0;
      temp = submsg_e_r[4];
      submsg_e_r[4] = (submsg_o_r[4] + submsg_e_r[7]) >>> 0;
      submsg_e_r[7] = (submsg_o_r[7] + submsg_e_r[6]) >>> 0;
      submsg_e_r[6] = (submsg_o_r[6] + submsg_e_r[5]) >>> 0;
      submsg_e_r[5] = (submsg_o_r[5] + temp) >>> 0;
    }

    _msg_exp_odd() {
      const submsg_e_l = new Uint32Array(this.sub_msgs.buffer, 0, 8);
      const submsg_e_r = new Uint32Array(this.sub_msgs.buffer, 32, 8);
      const submsg_o_l = new Uint32Array(this.sub_msgs.buffer, 64, 8);
      const submsg_o_r = new Uint32Array(this.sub_msgs.buffer, 96, 8);

      let temp;
      temp = submsg_o_l[0];
      submsg_o_l[0] = (submsg_e_l[0] + submsg_o_l[3]) >>> 0;
      submsg_o_l[3] = (submsg_e_l[3] + submsg_o_l[1]) >>> 0;
      submsg_o_l[1] = (submsg_e_l[1] + submsg_o_l[2]) >>> 0;
      submsg_o_l[2] = (submsg_e_l[2] + temp) >>> 0;
      temp = submsg_o_l[4];
      submsg_o_l[4] = (submsg_e_l[4] + submsg_o_l[7]) >>> 0;
      submsg_o_l[7] = (submsg_e_l[7] + submsg_o_l[6]) >>> 0;
      submsg_o_l[6] = (submsg_e_l[6] + submsg_o_l[5]) >>> 0;
      submsg_o_l[5] = (submsg_e_l[5] + temp) >>> 0;
      temp = submsg_o_r[0];
      submsg_o_r[0] = (submsg_e_r[0] + submsg_o_r[3]) >>> 0;
      submsg_o_r[3] = (submsg_e_r[3] + submsg_o_r[1]) >>> 0;
      submsg_o_r[1] = (submsg_e_r[1] + submsg_o_r[2]) >>> 0;
      submsg_o_r[2] = (submsg_e_r[2] + temp) >>> 0;
      temp = submsg_o_r[4];
      submsg_o_r[4] = (submsg_e_r[4] + submsg_o_r[7]) >>> 0;
      submsg_o_r[7] = (submsg_e_r[7] + submsg_o_r[6]) >>> 0;
      submsg_o_r[6] = (submsg_e_r[6] + submsg_o_r[5]) >>> 0;
      submsg_o_r[5] = (submsg_e_r[5] + temp) >>> 0;
    }

    _msg_add_even() {
      const submsg_e_l = new Uint32Array(this.sub_msgs.buffer, 0, 8);
      const submsg_e_r = new Uint32Array(this.sub_msgs.buffer, 32, 8);
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] ^= submsg_e_l[i];
        this.cv_r[i] ^= submsg_e_r[i];
      }
    }

    _msg_add_odd() {
      const submsg_o_l = new Uint32Array(this.sub_msgs.buffer, 64, 8);
      const submsg_o_r = new Uint32Array(this.sub_msgs.buffer, 96, 8);
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] ^= submsg_o_l[i];
        this.cv_r[i] ^= submsg_o_r[i];
      }
    }

    _add_blk() {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = (this.cv_l[i] + this.cv_r[i]) >>> 0;
      }
    }

    _rotate_blk(r) {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.RotL32(this.cv_l[i], r);
      }
    }

    _xor_with_const(const_v) {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] ^= const_v[i];
      }
    }

    _rotate_msg_gamma() {
      for (let i = 1; i < 7; i++) {
        this.cv_r[i] = OpCodes.RotL32(this.cv_r[i], GAMMA256[i]);
      }
    }

    _word_perm() {
      let temp;
      temp = this.cv_l[0];
      this.cv_l[0] = this.cv_l[6];
      this.cv_l[6] = this.cv_r[6];
      this.cv_r[6] = this.cv_r[2];
      this.cv_r[2] = this.cv_l[1];
      this.cv_l[1] = this.cv_l[4];
      this.cv_l[4] = this.cv_r[4];
      this.cv_r[4] = this.cv_r[0];
      this.cv_r[0] = this.cv_l[2];
      this.cv_l[2] = this.cv_l[5];
      this.cv_l[5] = this.cv_r[7];
      this.cv_r[7] = this.cv_r[1];
      this.cv_r[1] = temp;
      temp = this.cv_l[3];
      this.cv_l[3] = this.cv_l[7];
      this.cv_l[7] = this.cv_r[5];
      this.cv_r[5] = this.cv_r[3];
      this.cv_r[3] = temp;
    }

    _mix(alpha, beta, const_v) {
      this._add_blk();
      this._rotate_blk(alpha);
      this._xor_with_const(const_v);
      for (let i = 0; i < 8; i++) {
        this.cv_r[i] = (this.cv_r[i] + this.cv_l[i]) >>> 0;
      }
      for (let i = 0; i < 8; i++) {
        this.cv_r[i] = OpCodes.RotL32(this.cv_r[i], beta);
      }
      this._add_blk();
      this._rotate_msg_gamma();
    }

    _compress(msgblk) {
      this._load_msg_blk(msgblk);

      this._msg_add_even();
      const const_v0 = LSH256_StepConstants.subarray(0, 8);
      this._mix(ROT_EVEN_ALPHA, ROT_EVEN_BETA, const_v0);
      this._word_perm();

      this._msg_add_odd();
      const const_v1 = LSH256_StepConstants.subarray(8, 16);
      this._mix(ROT_ODD_ALPHA, ROT_ODD_BETA, const_v1);
      this._word_perm();

      for (let i = 1; i < NUM_STEPS / 2; i++) {
        this._msg_exp_even();
        this._msg_add_even();
        const const_ve = LSH256_StepConstants.subarray(16 * i, 16 * i + 8);
        this._mix(ROT_EVEN_ALPHA, ROT_EVEN_BETA, const_ve);
        this._word_perm();

        this._msg_exp_odd();
        this._msg_add_odd();
        const const_vo = LSH256_StepConstants.subarray(16 * i + 8, 16 * i + 16);
        this._mix(ROT_ODD_ALPHA, ROT_ODD_BETA, const_vo);
        this._word_perm();
      }

      this._msg_exp_even();
      this._msg_add_even();
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      let databytelen = data.length;
      let dataOffset = 0;
      let remain_msg_byte = this.remain_databitlen >> 3;

      if (databytelen + remain_msg_byte < LSH256_MSG_BLK_BYTE_LEN) {
        for (let i = 0; i < databytelen; i++) {
          this.last_block[remain_msg_byte + i] = data[dataOffset + i];
        }
        this.remain_databitlen += databytelen * 8;
        return;
      }

      if (remain_msg_byte > 0) {
        const more_byte = LSH256_MSG_BLK_BYTE_LEN - remain_msg_byte;
        for (let i = 0; i < more_byte; i++) {
          this.last_block[remain_msg_byte + i] = data[dataOffset + i];
        }
        this._compress(this.last_block);
        dataOffset += more_byte;
        databytelen -= more_byte;
        remain_msg_byte = 0;
        this.remain_databitlen = 0;
      }

      while (databytelen >= LSH256_MSG_BLK_BYTE_LEN) {
        const block = data.slice(dataOffset, dataOffset + LSH256_MSG_BLK_BYTE_LEN);
        this._compress(block);
        dataOffset += LSH256_MSG_BLK_BYTE_LEN;
        databytelen -= LSH256_MSG_BLK_BYTE_LEN;
      }

      if (databytelen > 0) {
        for (let i = 0; i < databytelen; i++) {
          this.last_block[i] = data[dataOffset + i];
        }
        this.remain_databitlen = databytelen * 8;
      }
    }

    Result() {
      const remain_msg_byte = this.remain_databitlen >> 3;

      this.last_block[remain_msg_byte] = 0x80;
      for (let i = remain_msg_byte + 1; i < LSH256_MSG_BLK_BYTE_LEN; i++) {
        this.last_block[i] = 0;
      }

      this._compress(this.last_block);

      // Finalization: XOR cv_l with cv_r
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] ^= this.cv_r[i];
      }

      // Extract hash bytes directly from cv_l (already in correct byte order)
      const hash = new Uint8Array(32);
      const hashView = new DataView(hash.buffer);
      for (let i = 0; i < 8; i++) {
        hashView.setUint32(i * 4, this.cv_l[i], true); // true = little-endian
      }

      return Array.from(hash);
    }
  }

  const algorithmInstance = new LSH256Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LSH256Algorithm, LSH256Instance };
}));
