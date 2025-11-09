/*
 * ASCON-HASH - NIST Lightweight Cryptography Standard Hash Function
 * Professional implementation following reference C implementation
 * (c)2006-2025 Hawkynt
 *
 * ASCON-HASH is the hash function mode of Ascon, selected as NIST's lightweight cryptography standard.
 * It provides 256-bit hash output using the Ascon permutation in a sponge construction.
 * Reference: Southern Storm Software lightweight-crypto/src/combined/ascon-hash.c
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

  const ASCON_HASH_RATE = 8; // 64 bits (8 bytes)
  const ASCON_HASH_SIZE = 32; // 256 bits (32 bytes)

  // 64-bit rotation helper using 32-bit operations
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

  class AsconHash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "ASCON-HASH";
      this.description = "Lightweight hash function based on Ascon permutation, finalist in CAESAR competition and standardized by NIST. Provides 256-bit security with efficient hardware and software implementations.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2014;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [{ minSize: 32, maxSize: 32, stepSize: 1 }];

      this.documentation = [
        new LinkItem(
          "NIST Lightweight Cryptography",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "Ascon Official Website",
          "https://ascon.iaik.tugraz.at/"
        ),
        new LinkItem(
          "NIST SP 800-232: Ascon Standard",
          "https://csrc.nist.gov/pubs/sp/800/232/final"
        ),
        new LinkItem(
          "CAESAR Competition",
          "https://competitions.cr.yp.to/caesar.html"
        )
      ];

      // Official test vectors from ASCON-HASH.txt
      this.tests = [
        {
          text: "ASCON-HASH: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("7346BC14F036E87AE03D0997913088F5F68411434B3CF8B54FA796A80D251F91")
        },
        {
          text: "ASCON-HASH: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("8DD446ADA58A7740ECF56EB638EF775F7D5C0FD5F0C2BBBDFDEC29609D3C43A2")
        },
        {
          text: "ASCON-HASH: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("F77CA13BF89146D3254F1CFB7EDDBA8FA1BF162284BB29E7F645545CF9E08424")
        },
        {
          text: "ASCON-HASH: Three bytes (Count=4)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("15CCF3B00F73EF96FAA08C9B440660BEA52D6F6AA53C8E2DA3F8200A990A122F")
        },
        {
          text: "ASCON-HASH: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("8013EAAA1951580A7BEF7D29BAC323377E64F279EA73E6881B8AED69855EF764")
        },
        {
          text: "ASCON-HASH: Eight bytes (Count=9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("F4C6A44B29915D3D57CF928A18EC6226BB8DD6C1136ACD24965F7E7780CD69CF")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new AsconHashInstance(this);
    }
  }

  class AsconHashInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // Ascon state: 5 x 64-bit words (stored as pairs of 32-bit values: [low32, high32])
      this.S = new Array(5);
      for (let i = 0; i < 5; i++) {
        this.S[i] = [0, 0];
      }

      this.buffer = new Uint8Array(ASCON_HASH_RATE);
      this.bufferPos = 0;

      this.Reset();
    }

    Reset() {
      // Initial state for ASCON-HASH after P12 transformation
      // Reference: ascon-hash.c lines 81-87 (big-endian IV after processing)
      // Format: [low32, high32] where full 64-bit value is high32:low32 in big-endian
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

      // Handle partial block from previous Feed
      while (offset < data.length && this.bufferPos < ASCON_HASH_RATE) {
        this.buffer[this.bufferPos++] = data[offset++];
      }

      // Process complete blocks
      while (this.bufferPos === ASCON_HASH_RATE) {
        this._absorb();
        this.bufferPos = 0;

        while (offset < data.length && this.bufferPos < ASCON_HASH_RATE) {
          this.buffer[this.bufferPos++] = data[offset++];
        }
      }
    }

    Result() {
      // Finalization: pad and squeeze
      const finalBytes = this.bufferPos;

      // XOR partial block into state if present
      if (finalBytes > 0) {
        // Pack buffer data into 64-bit word (big-endian)
        const high = OpCodes.Pack32BE(
          this.buffer[0], this.buffer[1], this.buffer[2], this.buffer[3]
        );
        const low = OpCodes.Pack32BE(
          this.buffer[4], this.buffer[5], this.buffer[6], this.buffer[7]
        );

        // Create mask for partial block (big-endian: leftmost bytes count)
        let maskHigh = 0, maskLow = 0;
        if (finalBytes <= 4) {
          maskHigh = (0xFFFFFFFF << (8 * (4 - finalBytes))) >>> 0;
          maskLow = 0;
        } else {
          maskHigh = 0xFFFFFFFF;
          maskLow = (0xFFFFFFFF << (8 * (8 - finalBytes))) >>> 0;
        }

        // XOR masked data into S[0]
        this.S[0][0] = (this.S[0][0] ^ (low & maskLow)) >>> 0;
        this.S[0][1] = (this.S[0][1] ^ (high & maskHigh)) >>> 0;
      }

      // Apply 0x80 padding byte at position finalBytes (reference: ascon-hash.c line 152)
      if (finalBytes < 4) {
        // Padding in high word (bytes 0-3)
        this.S[0][1] = (this.S[0][1] ^ (0x80 << (8 * (3 - finalBytes)))) >>> 0;
      } else {
        // Padding in low word (bytes 4-7)
        this.S[0][0] = (this.S[0][0] ^ (0x80 << (8 * (7 - finalBytes)))) >>> 0;
      }

      // Squeeze phase: extract 32 bytes (4 blocks of 8 bytes)
      // Reference: ascon-hash.c lines 163-167
      const output = [];
      for (let block = 0; block < 4; block++) {
        // Apply permutation before extracting each block
        this._asconPermute();

        // Extract S[0] as big-endian bytes
        output.push(
          (this.S[0][1] >>> 24) & 0xFF,
          (this.S[0][1] >>> 16) & 0xFF,
          (this.S[0][1] >>> 8) & 0xFF,
          this.S[0][1] & 0xFF,
          (this.S[0][0] >>> 24) & 0xFF,
          (this.S[0][0] >>> 16) & 0xFF,
          (this.S[0][0] >>> 8) & 0xFF,
          this.S[0][0] & 0xFF
        );
      }

      this.Reset();
      return output;
    }

    _absorb() {
      // XOR buffer into S[0] and apply permutation
      // Reference: ascon-hash.c lines 132-137
      const high = OpCodes.Pack32BE(
        this.buffer[0], this.buffer[1], this.buffer[2], this.buffer[3]
      );
      const low = OpCodes.Pack32BE(
        this.buffer[4], this.buffer[5], this.buffer[6], this.buffer[7]
      );

      this.S[0][0] ^= low;
      this.S[0][1] ^= high;

      this._asconPermute();
    }

    _asconPermute() {
      // Ascon permutation with 12 rounds (P12)
      // Reference: ascon-hash.c line 33-34, internal-ascon.c
      // Round constants: 0xf0, 0xe1, 0xd2, 0xc3, 0xb4, 0xa5, 0x96, 0x87, 0x78, 0x69, 0x5a, 0x4b
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
      // Ascon round function
      // Reference: internal-ascon.c ascon_permute() function

      // Addition of constants (to S[2] low word)
      this.S[2][0] = (this.S[2][0] ^ c) >>> 0;

      // Substitution layer (S-box)
      // Pre-XOR phase
      this.S[0][0] ^= this.S[4][0]; this.S[0][1] ^= this.S[4][1]; // x0 ^= x4
      this.S[4][0] ^= this.S[3][0]; this.S[4][1] ^= this.S[3][1]; // x4 ^= x3
      this.S[2][0] ^= this.S[1][0]; this.S[2][1] ^= this.S[1][1]; // x2 ^= x1

      // Compute temporary values for 5-bit S-box
      const t0_l = ((~this.S[0][0]) & this.S[1][0]) >>> 0;
      const t0_h = ((~this.S[0][1]) & this.S[1][1]) >>> 0;
      const t1_l = ((~this.S[1][0]) & this.S[2][0]) >>> 0;
      const t1_h = ((~this.S[1][1]) & this.S[2][1]) >>> 0;
      const t2_l = ((~this.S[2][0]) & this.S[3][0]) >>> 0;
      const t2_h = ((~this.S[2][1]) & this.S[3][1]) >>> 0;
      const t3_l = ((~this.S[3][0]) & this.S[4][0]) >>> 0;
      const t3_h = ((~this.S[3][1]) & this.S[4][1]) >>> 0;
      const t4_l = ((~this.S[4][0]) & this.S[0][0]) >>> 0;
      const t4_h = ((~this.S[4][1]) & this.S[0][1]) >>> 0;

      // Apply S-box
      this.S[0][0] ^= t1_l; this.S[0][1] ^= t1_h;
      this.S[1][0] ^= t2_l; this.S[1][1] ^= t2_h;
      this.S[2][0] ^= t3_l; this.S[2][1] ^= t3_h;
      this.S[3][0] ^= t4_l; this.S[3][1] ^= t4_h;
      this.S[4][0] ^= t0_l; this.S[4][1] ^= t0_h;

      // Post-XOR phase
      this.S[1][0] ^= this.S[0][0]; this.S[1][1] ^= this.S[0][1]; // x1 ^= x0
      this.S[0][0] ^= this.S[4][0]; this.S[0][1] ^= this.S[4][1]; // x0 ^= x4
      this.S[3][0] ^= this.S[2][0]; this.S[3][1] ^= this.S[2][1]; // x3 ^= x2
      this.S[2][0] = (~this.S[2][0]) >>> 0;                        // x2 = ~x2
      this.S[2][1] = (~this.S[2][1]) >>> 0;

      // Linear diffusion layer
      // Save state before rotations
      const s0_l = this.S[0][0], s0_h = this.S[0][1];
      const s1_l = this.S[1][0], s1_h = this.S[1][1];
      const s2_l = this.S[2][0], s2_h = this.S[2][1];
      const s3_l = this.S[3][0], s3_h = this.S[3][1];
      const s4_l = this.S[4][0], s4_h = this.S[4][1];

      // x0 ^= rotr64(x0, 19) ^ rotr64(x0, 28)
      let r0 = rotr64(s0_l, s0_h, 19);
      let r1 = rotr64(s0_l, s0_h, 28);
      this.S[0][0] = (s0_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[0][1] = (s0_h ^ r0[1] ^ r1[1]) >>> 0;

      // x1 ^= rotr64(x1, 61) ^ rotr64(x1, 39)
      r0 = rotr64(s1_l, s1_h, 61);
      r1 = rotr64(s1_l, s1_h, 39);
      this.S[1][0] = (s1_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[1][1] = (s1_h ^ r0[1] ^ r1[1]) >>> 0;

      // x2 ^= rotr64(x2, 1) ^ rotr64(x2, 6)
      r0 = rotr64(s2_l, s2_h, 1);
      r1 = rotr64(s2_l, s2_h, 6);
      this.S[2][0] = (s2_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[2][1] = (s2_h ^ r0[1] ^ r1[1]) >>> 0;

      // x3 ^= rotr64(x3, 10) ^ rotr64(x3, 17)
      r0 = rotr64(s3_l, s3_h, 10);
      r1 = rotr64(s3_l, s3_h, 17);
      this.S[3][0] = (s3_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[3][1] = (s3_h ^ r0[1] ^ r1[1]) >>> 0;

      // x4 ^= rotr64(x4, 7) ^ rotr64(x4, 41)
      r0 = rotr64(s4_l, s4_h, 7);
      r1 = rotr64(s4_l, s4_h, 41);
      this.S[4][0] = (s4_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[4][1] = (s4_h ^ r0[1] ^ r1[1]) >>> 0;
    }
  }

  RegisterAlgorithm(new AsconHash());
  return AsconHash;
}));
