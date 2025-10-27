/*
 * ISAP Hash - Ascon-based Hash Function for ISAP
 * Professional implementation following BouncyCastle reference
 * (c)2006-2025 Hawkynt
 *
 * ISAP Hash is the hash function used in the ISAP authenticated encryption scheme.
 * It uses the Ascon permutation in sponge mode with 256-bit output.
 * Reference: https://isap.isec.tugraz.at/
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem } = AlgorithmFramework;

  const RATE = 8; // 64 bits = 8 bytes

  // 64-bit rotation using OpCodes principles
  function rotr64(low, high, positions) {
    positions %= 64;
    if (positions === 0) return [low, high];
    if (positions === 32) return [high, low];

    if (positions < 32) {
      return [
        ((low >>> positions) | (high << (32 - positions))) >>> 0,
        ((high >>> positions) | (low << (32 - positions))) >>> 0
      ];
    }

    positions -= 32;
    return [
      ((high >>> positions) | (low << (32 - positions))) >>> 0,
      ((low >>> positions) | (high << (32 - positions))) >>> 0
    ];
  }

  class ISAPHash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "ISAP Hash";
      this.description = "Ascon-based hash function used in the ISAP authenticated encryption scheme. Uses Ascon-p permutation in sponge mode to produce 256-bit hashes with resistance to side-channel attacks.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Stefan Mangard, Florian Mendel, Robert Primas";
      this.year = 2017;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AUSTRIA;

      this.SupportedOutputSizes = [{ minSize: 32, maxSize: 32, stepSize: 1 }];

      this.documentation = [
        new LinkItem(
          "ISAP Specification",
          "https://isap.isec.tugraz.at/"
        ),
        new LinkItem(
          "NIST LWC Finalist",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "ISAP v2.0 Paper",
          "https://tosc.iacr.org/index.php/ToSC/article/view/8625"
        ),
        new LinkItem(
          "BouncyCastle Reference",
          "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/ISAPDigest.java"
        )
      ];

      // Test vectors from NIST LWC official ISAP Hash test file
      // Reference: BouncyCastle crypto/test/data/crypto/isap/LWC_HASH_KAT_256.txt
      this.tests = [
        {
          text: "ISAP Hash: Empty message (NIST LWC KAT)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("7346BC14F036E87AE03D0997913088F5F68411434B3CF8B54FA796A80D251F91")
        },
        {
          text: "ISAP Hash: Single zero byte (NIST LWC KAT)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("8DD446ADA58A7740ECF56EB638EF775F7D5C0FD5F0C2BBBDFDEC29609D3C43A2")
        },
        {
          text: "ISAP Hash: Two bytes (NIST LWC KAT)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("F77CA13BF89146D3254F1CFB7EDDBA8FA1BF162284BB29E7F645545CF9E08424")
        },
        {
          text: "ISAP Hash: Four bytes (NIST LWC KAT)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("8013EAAA1951580A7BEF7D29BAC323377E64F279EA73E6881B8AED69855EF764")
        },
        {
          text: "ISAP Hash: Eight bytes (NIST LWC KAT)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("F4C6A44B29915D3D57CF928A18EC6226BB8DD6C1136ACD24965F7E7780CD69CF")
        },
        {
          text: "ISAP Hash: Sixteen bytes (NIST LWC KAT)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("D4E56C4841E2A0069D4F07E61B2DCA94FD6D3F9C0DF78393E6E8292921BC841D")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new ISAPHashInstance(this);
    }
  }

  class ISAPHashInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // Ascon state: 5 x 64-bit words (stored as pairs of 32-bit values [low32, high32])
      this.S = new Array(5);
      for (let i = 0; i < 5; i++) {
        this.S[i] = [0, 0];
      }

      this.buffer = new Uint8Array(RATE);
      this.bufferPos = 0;

      this.Reset();
    }

    Reset() {
      // ISAP Hash IV (Ascon-Hash precomputed initial state)
      // Reference: BouncyCastle ISAPDigest.cs lines 17-21
      // These are the values after applying P12 to the raw IV
      this.S[0] = [0xdb67f03d, 0xee9398aa]; // 0xee9398aadb67f03d
      this.S[1] = [0xc60f1002, 0x8bb21831]; // 0x8bb21831c60f1002
      this.S[2] = [0x98d5da62, 0xb48a92db]; // 0xb48a92db98d5da62
      this.S[3] = [0xb8f8e3e8, 0x43189921]; // 0x43189921b8f8e3e8
      this.S[4] = [0xd525e140, 0x348fa5c9]; // 0x348fa5c9d525e140

      this.buffer.fill(0);
      this.bufferPos = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      let offset = 0;

      // Fill buffer if partially full
      while (offset < data.length && this.bufferPos < RATE) {
        this.buffer[this.bufferPos++] = data[offset++];
      }

      // Process complete blocks
      while (this.bufferPos === RATE) {
        this._absorb();
        this.bufferPos = 0;

        while (offset < data.length && this.bufferPos < RATE) {
          this.buffer[this.bufferPos++] = data[offset++];
        }
      }
    }

    Result() {
      // Finish absorbing with padding
      // Reference: BouncyCastle ISAPDigest.cs FinishAbsorbing() lines 165-169
      const finalBits = this.bufferPos * 8;

      // Set padding byte
      this.buffer[this.bufferPos] = 0x80;

      // Pack buffer as big-endian 64-bit value
      // Pack.BE_To_UInt64(m_buf, 0) reads bytes[0..7] as big-endian
      const bufHigh = OpCodes.Pack32BE(
        this.buffer[0], this.buffer[1], this.buffer[2], this.buffer[3]
      );
      const bufLow = OpCodes.Pack32BE(
        this.buffer[4], this.buffer[5], this.buffer[6], this.buffer[7]
      );

      // Create mask: ulong.MaxValue << (56 - finalBits)
      // This preserves the first finalBits and padding bit
      const shiftAmount = 56 - finalBits;
      let maskHigh, maskLow;

      if (shiftAmount >= 32) {
        // Shift is in high word only
        maskHigh = (0xFFFFFFFF << (shiftAmount - 32)) >>> 0;
        maskLow = 0;
      } else if (shiftAmount > 0) {
        // Shift spans both words
        maskHigh = 0xFFFFFFFF;
        maskLow = (0xFFFFFFFF << shiftAmount) >>> 0;
      } else {
        // No shift (56 or more bits)
        maskHigh = 0xFFFFFFFF;
        maskLow = 0xFFFFFFFF;
      }

      // XOR: x0 ^= (packed_buffer & mask)
      this.S[0][1] = (this.S[0][1] ^ (bufHigh & maskHigh)) >>> 0;
      this.S[0][0] = (this.S[0][0] ^ (bufLow & maskLow)) >>> 0;

      // Squeeze 32 bytes (4 blocks of 8 bytes)
      // Reference: BouncyCastle ISAPDigest.cs DoFinal() lines 124-128
      const output = [];

      for (let i = 0; i < 4; i++) {
        this._P12();

        // Extract x0 as big-endian bytes
        // Pack.UInt64_To_BE(x0, output, offset)
        const bytes = OpCodes.Unpack32BE(this.S[0][1]);
        const bytes2 = OpCodes.Unpack32BE(this.S[0][0]);
        output.push(...bytes, ...bytes2);
      }

      this.Reset();
      return output;
    }

    _absorb() {
      // XOR buffer into S[0] (big-endian)
      // Reference: BouncyCastle ISAPDigest.cs line 38, 67, 74
      const high = OpCodes.Pack32BE(
        this.buffer[0], this.buffer[1], this.buffer[2], this.buffer[3]
      );
      const low = OpCodes.Pack32BE(
        this.buffer[4], this.buffer[5], this.buffer[6], this.buffer[7]
      );

      this.S[0][1] ^= high;
      this.S[0][0] ^= low;

      this._P12();
    }

    _P12() {
      // 12 rounds with constants 0xf0, 0xe1, ..., 0x4b
      // Reference: BouncyCastle ISAPDigest.cs lines 172-185
      this._round(0xf0);
      this._round(0xe1);
      this._round(0xd2);
      this._round(0xc3);
      this._round(0xb4);
      this._round(0xa5);
      this._round(0x96);
      this._round(0x87);
      this._round(0x78);
      this._round(0x69);
      this._round(0x5a);
      this._round(0x4b);
    }

    _round(c) {
      // Canonical Ascon S-box from reference implementation
      // Reference: internal-ascon.c lines 56-72
      // This is the SAME round function used in AsconHash256

      // Apply constant to S2
      this.S[2][0] = (this.S[2][0] ^ c) >>> 0;

      // Pre-XOR phase
      // x0 ^= x4
      this.S[0][0] ^= this.S[4][0]; this.S[0][1] ^= this.S[4][1];
      // x4 ^= x3
      this.S[4][0] ^= this.S[3][0]; this.S[4][1] ^= this.S[3][1];
      // x2 ^= x1
      this.S[2][0] ^= this.S[1][0]; this.S[2][1] ^= this.S[1][1];

      // S-box: Compute ~xi & xj (Chi layer from Keccak)
      // t0 = ~x0 & x1
      const t0_l = ((~this.S[0][0]) & this.S[1][0]) >>> 0;
      const t0_h = ((~this.S[0][1]) & this.S[1][1]) >>> 0;
      // t1 = ~x1 & x2
      const t1_l = ((~this.S[1][0]) & this.S[2][0]) >>> 0;
      const t1_h = ((~this.S[1][1]) & this.S[2][1]) >>> 0;
      // t2 = ~x2 & x3
      const t2_l = ((~this.S[2][0]) & this.S[3][0]) >>> 0;
      const t2_h = ((~this.S[2][1]) & this.S[3][1]) >>> 0;
      // t3 = ~x3 & x4
      const t3_l = ((~this.S[3][0]) & this.S[4][0]) >>> 0;
      const t3_h = ((~this.S[3][1]) & this.S[4][1]) >>> 0;
      // t4 = ~x4 & x0
      const t4_l = ((~this.S[4][0]) & this.S[0][0]) >>> 0;
      const t4_h = ((~this.S[4][1]) & this.S[0][1]) >>> 0;

      // XOR with temps
      this.S[0][0] ^= t1_l; this.S[0][1] ^= t1_h;
      this.S[1][0] ^= t2_l; this.S[1][1] ^= t2_h;
      this.S[2][0] ^= t3_l; this.S[2][1] ^= t3_h;
      this.S[3][0] ^= t4_l; this.S[3][1] ^= t4_h;
      this.S[4][0] ^= t0_l; this.S[4][1] ^= t0_h;

      // Post-XOR phase
      // x1 ^= x0
      this.S[1][0] ^= this.S[0][0]; this.S[1][1] ^= this.S[0][1];
      // x0 ^= x4
      this.S[0][0] ^= this.S[4][0]; this.S[0][1] ^= this.S[4][1];
      // x3 ^= x2
      this.S[3][0] ^= this.S[2][0]; this.S[3][1] ^= this.S[2][1];
      // x2 = ~x2
      this.S[2][0] = (~this.S[2][0]) >>> 0;
      this.S[2][1] = (~this.S[2][1]) >>> 0;

      // Linear diffusion layer
      // Need to save state before modifications
      const s0_l = this.S[0][0], s0_h = this.S[0][1];
      const s1_l = this.S[1][0], s1_h = this.S[1][1];
      const s2_l = this.S[2][0], s2_h = this.S[2][1];
      const s3_l = this.S[3][0], s3_h = this.S[3][1];
      const s4_l = this.S[4][0], s4_h = this.S[4][1];

      // x0 ^= rightRotate19_64(x0) ^ rightRotate28_64(x0)
      let r0 = rotr64(s0_l, s0_h, 19);
      let r1 = rotr64(s0_l, s0_h, 28);
      this.S[0][0] = (s0_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[0][1] = (s0_h ^ r0[1] ^ r1[1]) >>> 0;

      // x1 ^= rightRotate61_64(x1) ^ rightRotate39_64(x1)
      r0 = rotr64(s1_l, s1_h, 61);
      r1 = rotr64(s1_l, s1_h, 39);
      this.S[1][0] = (s1_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[1][1] = (s1_h ^ r0[1] ^ r1[1]) >>> 0;

      // x2 ^= rightRotate1_64(x2) ^ rightRotate6_64(x2)
      r0 = rotr64(s2_l, s2_h, 1);
      r1 = rotr64(s2_l, s2_h, 6);
      this.S[2][0] = (s2_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[2][1] = (s2_h ^ r0[1] ^ r1[1]) >>> 0;

      // x3 ^= rightRotate10_64(x3) ^ rightRotate17_64(x3)
      r0 = rotr64(s3_l, s3_h, 10);
      r1 = rotr64(s3_l, s3_h, 17);
      this.S[3][0] = (s3_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[3][1] = (s3_h ^ r0[1] ^ r1[1]) >>> 0;

      // x4 ^= rightRotate7_64(x4) ^ rightRotate41_64(x4)
      r0 = rotr64(s4_l, s4_h, 7);
      r1 = rotr64(s4_l, s4_h, 41);
      this.S[4][0] = (s4_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[4][1] = (s4_h ^ r0[1] ^ r1[1]) >>> 0;
    }
  }

  RegisterAlgorithm(new ISAPHash());
  return ISAPHash;
}));
