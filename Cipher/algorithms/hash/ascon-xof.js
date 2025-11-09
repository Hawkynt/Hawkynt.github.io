/*
 * ASCON-XOF - NIST Lightweight Cryptography Standard Extendable Output Function
 * Professional implementation following reference C implementation
 * (c)2006-2025 Hawkynt
 *
 * ASCON-XOF is the extendable output function (XOF) mode of Ascon, selected as NIST's
 * lightweight cryptography standard. Unlike ASCON-HASH which provides fixed 256-bit output,
 * ASCON-XOF supports variable-length output making it suitable for applications requiring
 * arbitrary hash lengths.
 *
 * Reference: Southern Storm Software lightweight-crypto/src/combined/ascon-xof.c
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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  const ASCON_XOF_RATE = 8; // 64 bits (8 bytes)

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

  class AsconXof extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "ASCON-XOF";
      this.description = "Lightweight extendable output function (XOF) based on Ascon permutation, standardized by NIST. Supports variable-length output with efficient hardware and software implementations for constrained environments.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2014;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight XOF";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // XOF supports arbitrary output sizes (common range 1-1024 bytes)
      this.SupportedOutputSizes = [{ minSize: 1, maxSize: 1024, stepSize: 1 }];

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

      // Official test vectors from ASCON-XOF.txt
      // All test vectors produce 32-byte (256-bit) output by default
      this.tests = [
        {
          text: "ASCON-XOF: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes(""),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("5D4CBDE6350EA4C174BD65B5B332F8408F99740B81AA02735EAEFBCF0BA0339E")
        },
        {
          text: "ASCON-XOF: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("00"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("B2EDBB27AC8397A55BC83D137C151DE9EDE048338FE907F0D3629E717846FEDC")
        },
        {
          text: "ASCON-XOF: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("D196461C299DB714D78C267924B5786EE26FC43B3E640DAA5397E38E39D39DC6")
        },
        {
          text: "ASCON-XOF: Three bytes (Count=4)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("000102"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("1D18B9DD8FF9A1BF59751B88D32766C5E054910F497BFF4092AFC47F5885523B")
        },
        {
          text: "ASCON-XOF: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("66FB74174782AFED898478AA729058D5C30AF19AF2F5D4E1CE65CD320594EF66")
        },
        {
          text: "ASCON-XOF: Eight bytes (Count=9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("18427D2D29DF1E0202649F032F2080363FEC5DE72ECAE11B4F98CCC75843E7CC")
        },
        {
          text: "ASCON-XOF: Sixteen bytes (Count=17)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("C861A89CFB1335F278C96CF7FFC9753C290CBE1A4E186D2923B496BB4EA5E519")
        },
        {
          text: "ASCON-XOF: 32 bytes (Count=33)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("0B8E325B9BBF1BB43E77AA1EED93BEE62B4EA1E4B0C5A696B2F5C5B09C968918")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new AsconXofInstance(this);
    }
  }

  class AsconXofInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // Ascon state: 5 x 64-bit words (stored as pairs of 32-bit values: [low32, high32])
      this.S = new Array(5);
      for (let i = 0; i < 5; i++) {
        this.S[i] = [0, 0];
      }

      this.buffer = new Uint8Array(ASCON_XOF_RATE);
      this.bufferPos = 0;
      this.mode = 0; // 0 = absorbing, 1 = squeezing
      this._outputSize = null;

      this.Reset();
    }

    set outputSize(size) {
      if (size < 1 || size > 1024) {
        throw new Error(`Invalid output size: ${size} bytes`);
      }
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    Reset() {
      // Initial state for ASCON-XOF after P12 transformation
      // Reference: ascon-xof.c lines 63-69 (XOF IV after processing)
      // Format: [low32, high32] where full 64-bit value is high32:low32 in big-endian
      this.S[0] = [0x814cd416, 0xb57e273b]; // 0xb57e273b814cd416
      this.S[1] = [0x62ae2420, 0x2b510425]; // 0x2b51042562ae2420
      this.S[2] = [0x8ddf2218, 0x66a3a776]; // 0x66a3a7768ddf2218
      this.S[3] = [0x8153650c, 0x5aad0a7a]; // 0x5aad0a7a8153650c
      this.S[4] = [0x539493b6, 0x4f3e0e32]; // 0x4f3e0e32539493b6

      this.buffer.fill(0);
      this.bufferPos = 0;
      this.mode = 0; // Start in absorb mode
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      // If we were squeezing, go back to absorb phase
      // Reference: ascon-xof.c lines 79-90
      if (this.mode === 1) {
        this.mode = 0;
        this.bufferPos = 0;
        this._asconPermute();
      }

      let offset = 0;

      // Handle partial block from previous Feed
      while (offset < data.length && this.bufferPos < ASCON_XOF_RATE) {
        this.buffer[this.bufferPos++] = data[offset++];
      }

      // Process complete blocks
      while (this.bufferPos === ASCON_XOF_RATE) {
        this._absorb();
        this.bufferPos = 0;

        while (offset < data.length && this.bufferPos < ASCON_XOF_RATE) {
          this.buffer[this.bufferPos++] = data[offset++];
        }
      }
    }

    Result() {
      if (!this._outputSize) {
        throw new Error("Output size not set");
      }

      // Pad the final input block if we were still in absorb phase
      // Reference: ascon-xof.c lines 100-104
      if (this.mode === 0) {
        // XOR partial block into S[0]
        if (this.bufferPos > 0) {
          const high = OpCodes.Pack32BE(
            this.buffer[0], this.buffer[1], this.buffer[2], this.buffer[3]
          );
          const low = OpCodes.Pack32BE(
            this.buffer[4], this.buffer[5], this.buffer[6], this.buffer[7]
          );

          // Create mask for partial block (big-endian: leftmost bytes count)
          let maskHigh = 0, maskLow = 0;
          if (this.bufferPos <= 4) {
            maskHigh = (0xFFFFFFFF << (8 * (4 - this.bufferPos))) >>> 0;
            maskLow = 0;
          } else {
            maskHigh = 0xFFFFFFFF;
            maskLow = (0xFFFFFFFF << (8 * (8 - this.bufferPos))) >>> 0;
          }

          this.S[0][0] = (this.S[0][0] ^ (low & maskLow)) >>> 0;
          this.S[0][1] = (this.S[0][1] ^ (high & maskHigh)) >>> 0;
        }

        // Apply 0x80 padding byte at position bufferPos
        if (this.bufferPos < 4) {
          // Padding in high word (bytes 0-3)
          this.S[0][1] = (this.S[0][1] ^ (0x80 << (8 * (3 - this.bufferPos)))) >>> 0;
        } else {
          // Padding in low word (bytes 4-7)
          this.S[0][0] = (this.S[0][0] ^ (0x80 << (8 * (7 - this.bufferPos)))) >>> 0;
        }

        this.bufferPos = 0;
        this.mode = 1; // Switch to squeeze mode
      }

      // Squeeze phase: extract requested output bytes
      // Reference: ascon-xof.c lines 106-157
      const output = [];
      let outlen = this._outputSize;

      // Handle left-over partial blocks from last time (if Result() called multiple times)
      if (this.bufferPos > 0) {
        const temp = Math.min(ASCON_XOF_RATE - this.bufferPos, outlen);
        for (let i = 0; i < temp; i++) {
          output.push(this.buffer[this.bufferPos++]);
        }
        outlen -= temp;
        if (outlen === 0) {
          return output;
        }
        this.bufferPos = 0;
      }

      // Handle full blocks
      while (outlen >= ASCON_XOF_RATE) {
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
        outlen -= ASCON_XOF_RATE;
      }

      // Handle the left-over partial block
      if (outlen > 0) {
        this._asconPermute();

        // Extract partial block from S[0]
        const stateBytes = [
          (this.S[0][1] >>> 24) & 0xFF,
          (this.S[0][1] >>> 16) & 0xFF,
          (this.S[0][1] >>> 8) & 0xFF,
          this.S[0][1] & 0xFF,
          (this.S[0][0] >>> 24) & 0xFF,
          (this.S[0][0] >>> 16) & 0xFF,
          (this.S[0][0] >>> 8) & 0xFF,
          this.S[0][0] & 0xFF
        ];

        for (let i = 0; i < outlen; i++) {
          output.push(stateBytes[i]);
          this.buffer[i] = stateBytes[i];
        }
        this.bufferPos = outlen;
      }

      this.Reset();
      return output;
    }

    _absorb() {
      // XOR buffer into S[0] and apply permutation
      // Reference: ascon-xof.c / ascon-hash.c absorption pattern
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
      // Reference: internal-ascon.c ascon_permute() function
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

  RegisterAlgorithm(new AsconXof());
  return AsconXof;
}));
