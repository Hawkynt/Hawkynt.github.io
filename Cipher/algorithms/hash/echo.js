
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * ECHO - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class ECHO extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ECHO";
      this.description = "ECHO is an AES-based cryptographic hash function submitted to the NIST SHA-3 competition (Round 2). It processes a 512-bit (small variants) or 1024-bit (large variants) state through 8 or 10 double-AES-round permutations, with a counter mixed into the AES round keys. It did not advance to the SHA-3 final round.";
      this.inventor = "Ryad Benadjila, Olivier Billet, Henri Gilbert, Gilles Macario-Rat, Thomas Peyrin, Matt Robshaw, Yannick Seurin";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FR;

      // Hash-specific properties
      this.SupportedOutputSizes = [
        new KeySize(28, 28, 1),  // 224 bits
        new KeySize(32, 32, 1),  // 256 bits
        new KeySize(48, 48, 1),  // 384 bits
        new KeySize(64, 64, 1)   // 512 bits
      ];

      // Documentation
      this.documentation = [
        new LinkItem("ECHO Specification v2.0 (SHA-3 Round 2 submission)", "https://crypto.orange-labs.fr/ECHO/"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("sphlib Reference Implementation (echo.c)", "https://github.com/pornin/sphlib/blob/master/c/echo.c")
      ];

      this.references = [
        new LinkItem("sphlib by Thomas Pornin (reference C implementation)", "https://github.com/pornin/sphlib"),
        new LinkItem("ECHO: A Low-Latency AEAD Mode", "https://eprint.iacr.org/2010/003")
      ];

      // Test vectors reproduced from sphlib's NIST-style short-message test data
      // (c/test_echo.c, using message index 0 = empty message and index 8 = one
      // byte 0xCC, the standard NIST ShortMsgKAT entries reused by sphlib for all
      // SHA-3 round-2 candidates).
      this.tests = [
        // ECHO-224 test vectors
        {
          text: "sphlib NIST-style test vector (0-bit / empty message) - ECHO-224",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [],
          outputSize: 28,
          expected: OpCodes.Hex8ToBytes("17da087595166f733fff7cdb0bca6438f303d0e00c48b5e7a3075905")
        },
        {
          text: "sphlib NIST-style test vector (8-bit message 0xCC) - ECHO-224",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [0xCC],
          outputSize: 28,
          expected: OpCodes.Hex8ToBytes("34d81c434b63c8fbcf023b6417af87d906942ebd7b56c1d7b08baddc")
        },

        // ECHO-256 test vectors
        {
          text: "sphlib NIST-style test vector (0-bit / empty message) - ECHO-256",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [],
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("4496cd09d425999aefa75189ee7fd3c97362aa9e4ca898328002d20a4b519788")
        },
        {
          text: "sphlib NIST-style test vector (8-bit message 0xCC) - ECHO-256",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [0xCC],
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("01c382b5b9d7d10ec36c98785c27eaccfb2f772a7e58b6b97bf62212b8584ae5")
        },

        // ECHO-384 test vectors
        {
          text: "sphlib NIST-style test vector (0-bit / empty message) - ECHO-384",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [],
          outputSize: 48,
          expected: OpCodes.Hex8ToBytes("134040763f840559b84b7a1ae5d6d64fc3659821a789cc64a7f1444c09ee7f81a54d72beee8273bae5ef18ec43aa5f34")
        },
        {
          text: "sphlib NIST-style test vector (8-bit message 0xCC) - ECHO-384",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [0xCC],
          outputSize: 48,
          expected: OpCodes.Hex8ToBytes("90875a2649cab90018ff8aecd334482c92b15d76b378574eeaacd3b7598020db11e2c7480614eea8793de3daf2093f73")
        },

        // ECHO-512 test vectors
        {
          text: "sphlib NIST-style test vector (0-bit / empty message) - ECHO-512",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [],
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("158f58cc79d300a9aa292515049275d051a28ab931726d0ec44bdd9faef4a702c36db9e7922fff077402236465833c5cc76af4efc352b4b44c7fa15aa0ef234e")
        },
        {
          text: "sphlib NIST-style test vector (8-bit message 0xCC) - ECHO-512",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [0xCC],
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("dfce37ca6f32ba4c3a72e77bca20e511a39b31a6075815f083db2ecfd5c32cfd6a4e0dd9bd51921199758edd2fe8ed0fa31e06aa821c7030653d15408e8728dd")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new ECHOInstance(this);
    }
  }

  /**
 * ECHO cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class ECHOInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.inputBuffer = [];
      this._outputSize = 32; // Default to 256-bit output
    }

    set outputSize(size) {
      if (!size) return;

      // Validate output size
      const validSizes = [28, 32, 48, 64];
      if (!validSizes.includes(size)) {
        throw new Error(`Invalid output size: ${size} bytes (valid: 28, 32, 48, 64)`);
      }

      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }


    /**
   * Get hash result
   * @returns {uint8[]} Digest bytes
   */

    Result() {
      const hasher = new ECHOHasher(this._outputSize * 8);
      hasher.update(this.inputBuffer);
      const result = hasher.finalize();

      this.inputBuffer = [];
      return result;
    }
  }

  // ===== ECHO HASHER CORE IMPLEMENTATION =====
  //
  // Faithful port of the sphlib reference implementation (c/echo.c, 32-bit /
  // "not SPH_ECHO_64" code path by Thomas Pornin), operating on a matrix of
  // sixteen 128-bit "cells" (W[0..15]), each cell made of four 32-bit words.
  // The first stateCells (4 for the 224/256-bit variants, 8 for 384/512-bit)
  // cells hold the running chaining value V; the remaining cells are loaded
  // from the message block for each compression call.

  class ECHOHasher {
    constructor(outputBits) {
      this.outputBits = outputBits;
      this.isSmall = (outputBits <= 256);
      this.stateCells = this.isSmall ? 4 : 8;     // chaining-value cells
      this.blockSize = this.isSmall ? 192 : 128;  // message bytes per block
      this.rounds = this.isSmall ? 8 : 10;
      this.outWords = outputBits / 32;

      this.V = null;   // chaining value: stateCells x 4 32-bit words
      this.C = null;   // 128-bit counter split into four 32-bit words
      this.buffer = [];

      this._resetState();
    }

    _resetState() {
      this.V = [];
      for (let i = 0; i < this.stateCells; ++i) {
        this.V.push([OpCodes.ToUint32(this.outputBits), 0, 0, 0]);
      }
      this.C = [0, 0, 0, 0];
      this.buffer = [];
    }

    // Increment an arbitrary 128-bit little-endian counter (array of four
    // 32-bit words) by the given amount, propagating carries.
    _incrWords(words, amount) {
      const newLow = OpCodes.ToUint32(words[0] + amount);
      const carried = newLow < OpCodes.ToUint32(amount);
      words[0] = newLow;
      if (carried) {
        words[1] = OpCodes.ToUint32(words[1] + 1);
        if (words[1] === 0) {
          words[2] = OpCodes.ToUint32(words[2] + 1);
          if (words[2] === 0) {
            words[3] = OpCodes.ToUint32(words[3] + 1);
          }
        }
      }
    }

    update(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) data = Array.from(data);

      let offset = 0;
      let len = data.length;

      while (len > 0) {
        const space = this.blockSize - this.buffer.length;
        const chunkLen = len < space ? len : space;
        for (let i = 0; i < chunkLen; ++i) this.buffer.push(data[offset + i]);
        offset += chunkLen;
        len -= chunkLen;

        if (this.buffer.length === this.blockSize) {
          // The counter is advanced BEFORE compressing: the AES round-key
          // counter used inside this compression call starts at the total
          // bit count including the block about to be processed.
          this._incrWords(this.C, this.blockSize * 8);
          this._compress(this.buffer);
          this.buffer = [];
        }
      }
    }

    finalize() {
      const bufSize = this.blockSize;
      const ptr = this.buffer.length;
      const elen = ptr * 8; // bits contained in the trailing partial block

      this._incrWords(this.C, elen);

      // Capture the (post-increment) total message bit-length as a 128-bit
      // little-endian counter; this is embedded into the padding block
      // regardless of what happens to the running counter afterwards.
      const lenBytes = [];
      for (let i = 0; i < 4; ++i) lenBytes.push(...OpCodes.Unpack32LE(this.C[i]));

      // If this final block carries no message bits at all (exact multiple
      // of the block size), the running counter resets to zero.
      if (elen === 0) this.C = [0, 0, 0, 0];

      let buf = this.buffer.slice();
      buf.push(0x80); // single padding bit (byte-aligned input only)
      while (buf.length < bufSize) buf.push(0);

      if (ptr > bufSize - 18) {
        // Not enough room left for the 18-byte trailer: compress this
        // padding-only block first, then start a fresh all-zero block.
        this._compress(buf);
        this.C = [0, 0, 0, 0];
        buf = new Array(bufSize).fill(0);
      }

      const sizeBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(this.outputBits));
      buf[bufSize - 18] = sizeBytes[0];
      buf[bufSize - 17] = sizeBytes[1];
      for (let i = 0; i < 16; ++i) buf[bufSize - 16 + i] = lenBytes[i];

      this._compress(buf);

      const output = [];
      for (let k = 0; k < this.outWords; ++k) {
        const cell = Math.floor(k / 4);
        const word = k % 4;
        output.push(...OpCodes.Unpack32LE(this.V[cell][word]));
      }

      this._resetState();
      return output;
    }

    _compress(block) {
      // Build the 16-cell x 4-word working matrix W.
      const W = [];
      for (let i = 0; i < 16; ++i) W.push([0, 0, 0, 0]);

      for (let i = 0; i < this.stateCells; ++i) {
        W[i][0] = this.V[i][0];
        W[i][1] = this.V[i][1];
        W[i][2] = this.V[i][2];
        W[i][3] = this.V[i][3];
      }

      const msgCells = 16 - this.stateCells;
      for (let u = 0; u < msgCells; ++u) {
        const cell = this.stateCells + u;
        const base = u * 16;
        W[cell][0] = OpCodes.Pack32LE(block[base], block[base + 1], block[base + 2], block[base + 3]);
        W[cell][1] = OpCodes.Pack32LE(block[base + 4], block[base + 5], block[base + 6], block[base + 7]);
        W[cell][2] = OpCodes.Pack32LE(block[base + 8], block[base + 9], block[base + 10], block[base + 11]);
        W[cell][3] = OpCodes.Pack32LE(block[base + 12], block[base + 13], block[base + 14], block[base + 15]);
      }

      const K = [this.C[0], this.C[1], this.C[2], this.C[3]];

      for (let round = 0; round < this.rounds; ++round) {
        // SubWords: two keyed/unkeyed AES rounds per cell, counter-derived
        // round key incremented once per cell (16 times per ECHO round).
        for (let n = 0; n < 16; ++n) {
          const Y = [0, 0, 0, 0];
          this._aesRound(W[n], K, Y);
          this._aesRoundNoKey(Y, W[n]);
          this._incrWords(K, 1);
        }

        // ShiftRows: row 0 fixed, row 1 shifted by 1, row 2 by 2, row 3 by 3
        // cells, where cell index = row + 4*column (column-major 4x4 grid).
        this._shiftRow(W, 1, 5, 9, 13);
        this._shiftRow(W, 2, 6, 10, 14);
        this._shiftRow(W, 2, 6, 10, 14);
        this._shiftRow(W, 3, 7, 11, 15);
        this._shiftRow(W, 3, 7, 11, 15);
        this._shiftRow(W, 3, 7, 11, 15);

        // MixColumns over each column of 4 cells.
        this._mixColumn(W, 0, 1, 2, 3);
        this._mixColumn(W, 4, 5, 6, 7);
        this._mixColumn(W, 8, 9, 10, 11);
        this._mixColumn(W, 12, 13, 14, 15);
      }

      // Finalization: fold the post-round matrix and message block back
      // into the chaining value.
      if (this.isSmall) {
        for (let u = 0; u < 16; ++u) {
          const c = Math.floor(u / 4);
          const w = u % 4;
          const m1 = OpCodes.Pack32LE(block[u * 4], block[u * 4 + 1], block[u * 4 + 2], block[u * 4 + 3]);
          const m2 = OpCodes.Pack32LE(block[64 + u * 4], block[64 + u * 4 + 1], block[64 + u * 4 + 2], block[64 + u * 4 + 3]);
          const m3 = OpCodes.Pack32LE(block[128 + u * 4], block[128 + u * 4 + 1], block[128 + u * 4 + 2], block[128 + u * 4 + 3]);

          let v = this.V[c][w];
          v = OpCodes.Xor32(v, m1);
          v = OpCodes.Xor32(v, m2);
          v = OpCodes.Xor32(v, m3);
          v = OpCodes.Xor32(v, W[c][w]);
          v = OpCodes.Xor32(v, W[c + 4][w]);
          v = OpCodes.Xor32(v, W[c + 8][w]);
          v = OpCodes.Xor32(v, W[c + 12][w]);
          this.V[c][w] = v;
        }
      } else {
        for (let u = 0; u < 32; ++u) {
          const c = Math.floor(u / 4);
          const w = u % 4;
          const m = OpCodes.Pack32LE(block[u * 4], block[u * 4 + 1], block[u * 4 + 2], block[u * 4 + 3]);

          let v = this.V[c][w];
          v = OpCodes.Xor32(v, m);
          v = OpCodes.Xor32(v, W[c][w]);
          v = OpCodes.Xor32(v, W[c + 8][w]);
          this.V[c][w] = v;
        }
      }
    }

    _shiftRow(W, a, b, c, d) {
      const tmp = W[a];
      W[a] = W[b];
      W[b] = W[c];
      W[c] = W[d];
      W[d] = tmp;
    }

    _aesRound(input, key, output) {
      const T0 = AES_T0, T1 = AES_T1, T2 = AES_T2, T3 = AES_T3;

      output[0] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
        T0[OpCodes.GetByte(input[0], 0)],
        T1[OpCodes.GetByte(input[1], 1)]),
        T2[OpCodes.GetByte(input[2], 2)]),
        T3[OpCodes.GetByte(input[3], 3)]),
        key[0]);

      output[1] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
        T0[OpCodes.GetByte(input[1], 0)],
        T1[OpCodes.GetByte(input[2], 1)]),
        T2[OpCodes.GetByte(input[3], 2)]),
        T3[OpCodes.GetByte(input[0], 3)]),
        key[1]);

      output[2] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
        T0[OpCodes.GetByte(input[2], 0)],
        T1[OpCodes.GetByte(input[3], 1)]),
        T2[OpCodes.GetByte(input[0], 2)]),
        T3[OpCodes.GetByte(input[1], 3)]),
        key[2]);

      output[3] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
        T0[OpCodes.GetByte(input[3], 0)],
        T1[OpCodes.GetByte(input[0], 1)]),
        T2[OpCodes.GetByte(input[1], 2)]),
        T3[OpCodes.GetByte(input[2], 3)]),
        key[3]);
    }

    _aesRoundNoKey(input, output) {
      const T0 = AES_T0, T1 = AES_T1, T2 = AES_T2, T3 = AES_T3;

      output[0] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
        T0[OpCodes.GetByte(input[0], 0)],
        T1[OpCodes.GetByte(input[1], 1)]),
        T2[OpCodes.GetByte(input[2], 2)]),
        T3[OpCodes.GetByte(input[3], 3)]);

      output[1] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
        T0[OpCodes.GetByte(input[1], 0)],
        T1[OpCodes.GetByte(input[2], 1)]),
        T2[OpCodes.GetByte(input[3], 2)]),
        T3[OpCodes.GetByte(input[0], 3)]);

      output[2] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
        T0[OpCodes.GetByte(input[2], 0)],
        T1[OpCodes.GetByte(input[3], 1)]),
        T2[OpCodes.GetByte(input[0], 2)]),
        T3[OpCodes.GetByte(input[1], 3)]);

      output[3] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
        T0[OpCodes.GetByte(input[3], 0)],
        T1[OpCodes.GetByte(input[0], 1)]),
        T2[OpCodes.GetByte(input[1], 2)]),
        T3[OpCodes.GetByte(input[2], 3)]);
    }

    // Multiply every byte lane of a 32-bit word by x (0x02) in GF(2^8),
    // in parallel - the AES-style "xtime" step used by ECHO's MixColumns.
    _gfMulX(word) {
      const b0 = OpCodes.GF256Mul(OpCodes.GetByte(word, 0), 2);
      const b1 = OpCodes.GF256Mul(OpCodes.GetByte(word, 1), 2);
      const b2 = OpCodes.GF256Mul(OpCodes.GetByte(word, 2), 2);
      const b3 = OpCodes.GF256Mul(OpCodes.GetByte(word, 3), 2);
      return OpCodes.Pack32LE(b0, b1, b2, b3);
    }

    _mixColumn(W, ia, ib, ic, id) {
      for (let n = 0; n < 4; ++n) {
        const a = W[ia][n];
        const b = W[ib][n];
        const c = W[ic][n];
        const d = W[id][n];

        const ab = OpCodes.Xor32(a, b);
        const bc = OpCodes.Xor32(b, c);
        const cd = OpCodes.Xor32(c, d);

        const abx = this._gfMulX(ab);
        const bcx = this._gfMulX(bc);
        const cdx = this._gfMulX(cd);

        W[ia][n] = OpCodes.Xor32(OpCodes.Xor32(abx, bc), d);
        W[ib][n] = OpCodes.Xor32(OpCodes.Xor32(bcx, a), cd);
        W[ic][n] = OpCodes.Xor32(OpCodes.Xor32(cdx, ab), d);
        W[id][n] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(abx, bcx), cdx), ab), c);
      }
    }
  }

  // Standard AES combined SubBytes+MixColumns table (Te0, MSB-first byte
  // convention). ECHO's AES round macros index bytes LSB-first, so the
  // table actually used for lookups (AES_T0 below) is the byte-reversed
  // form of this table.
  const AES_TE0 = new Uint32Array([
    0xc66363a5, 0xf87c7c84, 0xee777799, 0xf67b7b8d, 0xfff2f20d, 0xd66b6bbd, 0xde6f6fb1, 0x91c5c554,
    0x60303050, 0x02010103, 0xce6767a9, 0x562b2b7d, 0xe7fefe19, 0xb5d7d762, 0x4dababe6, 0xec76769a,
    0x8fcaca45, 0x1f82829d, 0x89c9c940, 0xfa7d7d87, 0xeffafa15, 0xb25959eb, 0x8e4747c9, 0xfbf0f00b,
    0x41adadec, 0xb3d4d467, 0x5fa2a2fd, 0x45afafea, 0x239c9cbf, 0x53a4a4f7, 0xe4727296, 0x9bc0c05b,
    0x75b7b7c2, 0xe1fdfd1c, 0x3d9393ae, 0x4c26266a, 0x6c36365a, 0x7e3f3f41, 0xf5f7f702, 0x83cccc4f,
    0x6834345c, 0x51a5a5f4, 0xd1e5e534, 0xf9f1f108, 0xe2717193, 0xabd8d873, 0x62313153, 0x2a15153f,
    0x0804040c, 0x95c7c752, 0x46232365, 0x9dc3c35e, 0x30181828, 0x379696a1, 0x0a05050f, 0x2f9a9ab5,
    0x0e070709, 0x24121236, 0x1b80809b, 0xdfe2e23d, 0xcdebeb26, 0x4e272769, 0x7fb2b2cd, 0xea75759f,
    0x1209091b, 0x1d83839e, 0x582c2c74, 0x341a1a2e, 0x361b1b2d, 0xdc6e6eb2, 0xb45a5aee, 0x5ba0a0fb,
    0xa45252f6, 0x763b3b4d, 0xb7d6d661, 0x7db3b3ce, 0x5229297b, 0xdde3e33e, 0x5e2f2f71, 0x13848497,
    0xa65353f5, 0xb9d1d168, 0x00000000, 0xc1eded2c, 0x40202060, 0xe3fcfc1f, 0x79b1b1c8, 0xb65b5bed,
    0xd46a6abe, 0x8dcbcb46, 0x67bebed9, 0x7239394b, 0x944a4ade, 0x984c4cd4, 0xb05858e8, 0x85cfcf4a,
    0xbbd0d06b, 0xc5efef2a, 0x4faaaae5, 0xedfbfb16, 0x864343c5, 0x9a4d4dd7, 0x66333355, 0x11858594,
    0x8a4545cf, 0xe9f9f910, 0x04020206, 0xfe7f7f81, 0xa05050f0, 0x783c3c44, 0x259f9fba, 0x4ba8a8e3,
    0xa25151f3, 0x5da3a3fe, 0x804040c0, 0x058f8f8a, 0x3f9292ad, 0x219d9dbc, 0x70383848, 0xf1f5f504,
    0x63bcbcdf, 0x77b6b6c1, 0xafdada75, 0x42212163, 0x20101030, 0xe5ffff1a, 0xfdf3f30e, 0xbfd2d26d,
    0x81cdcd4c, 0x180c0c14, 0x26131335, 0xc3ecec2f, 0xbe5f5fe1, 0x359797a2, 0x884444cc, 0x2e171739,
    0x93c4c457, 0x55a7a7f2, 0xfc7e7e82, 0x7a3d3d47, 0xc86464ac, 0xba5d5de7, 0x3219192b, 0xe6737395,
    0xc06060a0, 0x19818198, 0x9e4f4fd1, 0xa3dcdc7f, 0x44222266, 0x542a2a7e, 0x3b9090ab, 0x0b888883,
    0x8c4646ca, 0xc7eeee29, 0x6bb8b8d3, 0x2814143c, 0xa7dede79, 0xbc5e5ee2, 0x160b0b1d, 0xaddbdb76,
    0xdbe0e03b, 0x64323256, 0x743a3a4e, 0x140a0a1e, 0x924949db, 0x0c06060a, 0x4824246c, 0xb85c5ce4,
    0x9fc2c25d, 0xbdd3d36e, 0x43acacef, 0xc46262a6, 0x399191a8, 0x319595a4, 0xd3e4e437, 0xf279798b,
    0xd5e7e732, 0x8bc8c843, 0x6e373759, 0xda6d6db7, 0x018d8d8c, 0xb1d5d564, 0x9c4e4ed2, 0x49a9a9e0,
    0xd86c6cb4, 0xac5656fa, 0xf3f4f407, 0xcfeaea25, 0xca6565af, 0xf47a7a8e, 0x47aeaee9, 0x10080818,
    0x6fbabad5, 0xf0787888, 0x4a25256f, 0x5c2e2e72, 0x381c1c24, 0x57a6a6f1, 0x73b4b4c7, 0x97c6c651,
    0xcbe8e823, 0xa1dddd7c, 0xe874749c, 0x3e1f1f21, 0x964b4bdd, 0x61bdbddc, 0x0d8b8b86, 0x0f8a8a85,
    0xe0707090, 0x7c3e3e42, 0x71b5b5c4, 0xcc6666aa, 0x904848d8, 0x06030305, 0xf7f6f601, 0x1c0e0e12,
    0xc26161a3, 0x6a35355f, 0xae5757f9, 0x69b9b9d0, 0x17868691, 0x99c1c158, 0x3a1d1d27, 0x279e9eb9,
    0xd9e1e138, 0xebf8f813, 0x2b9898b3, 0x22111133, 0xd26969bb, 0xa9d9d970, 0x078e8e89, 0x339494a7,
    0x2d9b9bb6, 0x3c1e1e22, 0x15878792, 0xc9e9e920, 0x87cece49, 0xaa5555ff, 0x50282878, 0xa5dfdf7a,
    0x038c8c8f, 0x59a1a1f8, 0x09898980, 0x1a0d0d17, 0x65bfbfda, 0xd7e6e631, 0x844242c6, 0xd06868b8,
    0x824141c3, 0x299999b0, 0x5a2d2d77, 0x1e0f0f11, 0x7bb0b0cb, 0xa85454fc, 0x6dbbbbd6, 0x2c16163a
  ]);

  // AES_T0 is the byte-swapped form of AES_TE0, matching the LSB-first byte
  // indexing used by ECHO's AES round macros (sphlib's AES0_LE table).
  // AES_T1..AES_T3 are then obtained from AES_T0 by rotation, exactly as
  // sphlib's AES1_LE..AES3_LE relate to AES0_LE.
  const AES_T0 = new Uint32Array(256);
  const AES_T1 = new Uint32Array(256);
  const AES_T2 = new Uint32Array(256);
  const AES_T3 = new Uint32Array(256);

  for (let i = 0; i < 256; ++i) {
    const swapped = OpCodes.Pack32LE.apply(null, OpCodes.Unpack32BE(AES_TE0[i]));
    AES_T0[i] = swapped;
    AES_T1[i] = OpCodes.RotL32(swapped, 8);
    AES_T2[i] = OpCodes.RotL32(swapped, 16);
    AES_T3[i] = OpCodes.RotL32(swapped, 24);
  }

  // Register algorithm
  RegisterAlgorithm(new ECHO());

  return ECHO;
}));
