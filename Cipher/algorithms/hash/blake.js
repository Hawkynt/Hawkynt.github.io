/*
 * BLAKE Hash Function Family (SHA-3 Finalist)
 * Original BLAKE algorithm from the SHA-3 competition
 * Four variants: BLAKE-224, BLAKE-256, BLAKE-384, BLAKE-512
 * Reference: https://www.aumasson.jp/blake/blake.pdf
 * (c)2006-2025 Hawkynt
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

  // BLAKE Constants and Permutation Table
  // SIGMA permutation for rounds (extended for BLAKE1)
  /** @type {int32[]} */
  const BSIGMA = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
    11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4,
    7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
    9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
    2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9,
    12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11,
    13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10,
    6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5,
    10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0,
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
    // BLAKE1 additional rounds (14 rounds for 256-bit, 16 rounds for 512-bit)
    11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4,
    7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
    9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
    2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9
  ];

  // BLAKE constants (derived from fractional parts of pi)
  // For 32-bit BLAKE
  const B32C = OpCodes.Hex32ToDWords(
    '243f6a88' + '85a308d3' + '13198a2e' + '03707344' + 'a4093822' + '299f31d0' + '082efa98' + 'ec4e6c89' +
    '452821e6' + '38d01377' + 'be5466cf' + '34e90c6c' + 'c0ac29b7' + 'c97c50dd' + '3f84d5b5' + 'b5470917'
  );

  // For 64-bit BLAKE (stored as [HIGH, LOW] pairs matching noble-hashes B64C format)
  const B64C = OpCodes.Hex32ToDWords(
    '243f6a88' + '85a308d3' + '13198a2e' + '03707344' + 'a4093822' + '299f31d0' + '082efa98' + 'ec4e6c89' +
    '452821e6' + '38d01377' + 'be5466cf' + '34e90c6c' + 'c0ac29b7' + 'c97c50dd' + '3f84d5b5' + 'b5470917' +
    '9216d5d9' + '8979fb1b' + 'd1310ba6' + '98dfb5ac' + '2ffd72db' + 'd01adfb7' + 'b8e1afed' + '6a267e96' +
    'ba7c9045' + 'f12c7f99' + '24a19947' + 'b3916cf7' + '0801f2e2' + '858efc16' + '636920d8' + '71574e69'
  );

  // Initial values (borrowed from SHA-2)
  const SHA224_IV = OpCodes.Hex32ToDWords('c1059ed8367cd5073070dd17f70e5939ffc00b316858151164f98fa7befa4fa4');
  const SHA256_IV = OpCodes.Hex32ToDWords('6a09e667bb67ae853c6ef372a54ff53a510e527f9b05688c1f83d9ab5be0cd19');
  // SHA-2 IVs for BLAKE-384 and BLAKE-512
  // CRITICAL: Stored as [HIGH, LOW] pairs matching noble-hashes format!
  // noble-hashes uses BACKWARD variable naming: v0l=IV[0] (HIGH), v0h=IV[1] (LOW)
  const SHA384_IV = OpCodes.Hex32ToDWords(
    'cbbb9d5d' + 'c1059ed8' + '629a292a' + '367cd507' + '9159015a' + '3070dd17' + '152fecd8' + 'f70e5939' +
    '67332667' + 'ffc00b31' + '8eb44a87' + '68581511' + 'db0c2e0d' + '64f98fa7' + '47b5481d' + 'befa4fa4'
  );
  const SHA512_IV = OpCodes.Hex32ToDWords(
    '6a09e667' + 'f3bcc908' + 'bb67ae85' + '84caa73b' + '3c6ef372' + 'fe94f82b' + 'a54ff53a' + '5f1d36f1' +
    '510e527f' + 'ade682d1' + '9b05688c' + '2b3e6c1f' + '1f83d9ab' + 'fb41bd6b' + '5be0cd19' + '137e2179'
  );

  /**
   * First half of the 32-bit mixing function G, applied to v in place
   * @param {uint32[]} v - Working state (16 words)
   * @param {int32} a - Index of word a
   * @param {int32} b - Index of word b
   * @param {int32} c - Index of word c
   * @param {int32} d - Index of word d
   * @param {uint32} x - Message word XOR round constant
   * @returns {void}
   */
  function G1s_32(v, a, b, c, d, x) {
    v[a] = OpCodes.Add32(OpCodes.Add32(v[a], v[b]), x);
    v[d] = OpCodes.RotR32(OpCodes.Xor32(v[d], v[a]), 16);
    v[c] = OpCodes.Add32(v[c], v[d]);
    v[b] = OpCodes.RotR32(OpCodes.Xor32(v[b], v[c]), 12);
  }

  /**
   * Second half of the 32-bit mixing function G, applied to v in place
   * @param {uint32[]} v - Working state (16 words)
   * @param {int32} a - Index of word a
   * @param {int32} b - Index of word b
   * @param {int32} c - Index of word c
   * @param {int32} d - Index of word d
   * @param {uint32} x - Message word XOR round constant
   * @returns {void}
   */
  function G2s_32(v, a, b, c, d, x) {
    v[a] = OpCodes.Add32(OpCodes.Add32(v[a], v[b]), x);
    v[d] = OpCodes.RotR32(OpCodes.Xor32(v[d], v[a]), 8);
    v[c] = OpCodes.Add32(v[c], v[d]);
    v[b] = OpCodes.RotR32(OpCodes.Xor32(v[b], v[c]), 7);
  }

  /**
   * Round constants of the 64-bit variants in the order the rounds consume
   * them, matching the noble-hashes TBL512 layout
   * @returns {uint32[]} Flattened [HIGH, LOW] constant pairs
   */
  function generateTBL512() {
    /** @type {uint32[]} */
    const TBL = [];
    for (let r = 0, k = 0; r < 16; r++, k += 16) {
      for (let offset = 1; offset < 16; offset += 2) {
        TBL.push(B64C[BSIGMA[k + offset] * 2 + 0]);      // HIGH of odd index
        TBL.push(B64C[BSIGMA[k + offset] * 2 + 1]);      // LOW of odd index
        TBL.push(B64C[BSIGMA[k + offset - 1] * 2 + 0]);  // HIGH of even index
        TBL.push(B64C[BSIGMA[k + offset - 1] * 2 + 1]);  // LOW of even index
      }
    }
    return TBL;
  }

  /** @type {uint32[]} */
  const TBL512 = generateTBL512();

  /**
   * Round constants of the 32-bit variants in the order the rounds consume them
   * @returns {uint32[]} Constant per G application, 16 per round for 14 rounds
   */
  function generateTBL256() {
    /** @type {uint32[]} */
    const TBL = [];
    for (let r = 0; r < 14; r++) {
      for (let j = 1; j < 16; j += 2) {
        TBL.push(B32C[BSIGMA[r * 16 + j]]);
        TBL.push(B32C[BSIGMA[r * 16 + j - 1]]);
      }
    }
    return TBL;
  }

  /** @type {uint32[]} */
  const TBL256 = generateTBL256();

  /**
   * Rotate the 64-bit word i of v, stored as v[2*i] (HIGH) and v[2*i+1] (LOW),
   * right by n bits after XORing it with word j, in place
   * @param {uint32[]} v - Working state as [HIGH, LOW] pairs
   * @param {int32} i - Index of the 64-bit word to update
   * @param {int32} j - Index of the 64-bit word XORed in
   * @param {int32} n - Rotation (11, 16, 25 or 32)
   * @returns {void}
   */
  function xorRotR64(v, i, j, n) {
    const hi = OpCodes.Xor32(v[2 * i], v[2 * j]);
    const lo = OpCodes.Xor32(v[2 * i + 1], v[2 * j + 1]);
    if (n === 32) {
      v[2 * i] = lo;
      v[2 * i + 1] = hi;
    } else {
      v[2 * i] = OpCodes.Or32(OpCodes.Shr32(hi, n), OpCodes.Shl32(lo, 32 - n));
      v[2 * i + 1] = OpCodes.Or32(OpCodes.Shr32(lo, n), OpCodes.Shl32(hi, 32 - n));
    }
  }

  /**
   * One half of the 64-bit mixing function G on [HIGH, LOW] word pairs, in place.
   * v[2*i] holds the HIGH and v[2*i+1] the LOW 32 bits of 64-bit word i.
   * @param {uint32[]} v - Working state (16 64-bit words as 32 32-bit words)
   * @param {int32} a - Index of 64-bit word a
   * @param {int32} b - Index of 64-bit word b
   * @param {int32} c - Index of 64-bit word c
   * @param {int32} d - Index of 64-bit word d
   * @param {uint32[]} msg - Message block (16 64-bit words as 32 32-bit words)
   * @param {int32} k - Position in the flattened SIGMA schedule
   * @param {int32} rotD - Right rotation of d (32 for the first half, 16 for the second)
   * @param {int32} rotB - Right rotation of b (25 for the first half, 11 for the second)
   * @returns {void}
   */
  function Gb_64(v, a, b, c, d, msg, k, rotD, rotB) {
    const Xpos = 2 * BSIGMA[k];
    const Xl = OpCodes.Xor32(msg[Xpos + 1], TBL512[k * 2 + 1]);  // LOW XOR LOW
    const Xh = OpCodes.Xor32(msg[Xpos], TBL512[k * 2]);          // HIGH XOR HIGH

    // v[a] = v[a] + v[b] + x
    const ll = OpCodes.Add3L64(v[2 * a + 1], v[2 * b + 1], Xl);
    v[2 * a] = OpCodes.ToUint32(OpCodes.Add3H64(ll, v[2 * a], v[2 * b], Xh));
    v[2 * a + 1] = OpCodes.ToUint32(ll);

    // v[d] = rotr(v[d] XOR v[a], rotD)
    xorRotR64(v, d, a, rotD);

    // v[c] = v[c] + v[d]
    const cl = OpCodes.Add32(v[2 * c + 1], v[2 * d + 1]);
    const carry = cl < v[2 * d + 1] ? 1 : 0;
    v[2 * c] = OpCodes.Add32(OpCodes.Add32(v[2 * c], v[2 * d]), carry);
    v[2 * c + 1] = cl;

    // v[b] = rotr(v[b] XOR v[c], rotB)
    xorRotR64(v, b, c, rotB);
  }

  // Base BLAKE instance for all variants
  /**
 * BLAKE hash instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class BlakeInstance extends IHashFunctionInstance {
    /**
     * Initialize a BLAKE instance
     * @param {HashFunctionAlgorithm} algorithm - Parent algorithm instance
     * @param {int32} outputSize - Digest size in bytes
     * @param {int32} blockSize - Block size in bytes (64 or 128)
     * @param {uint32[]} iv - Initial chaining value (8 words, or 16 words as [HIGH, LOW] pairs)
     * @param {uint8} lengthFlag - Byte merged in front of the length field (0x00 or 0x01)
     * @param {int32} rounds - Number of rounds (14 or 16)
     * @param {boolean} [is64bit=false] - True for BLAKE-384/512
     */
    constructor(algorithm, outputSize, blockSize, iv, lengthFlag, rounds, is64bit = false) {
      super(algorithm);
      /** @type {int32} */
      this.outputSize = outputSize;
      /** @type {int32} */
      this.blockSize = blockSize;
      /** @type {uint8} */
      this.lengthFlag = lengthFlag;
      /** @type {int32} */
      this.rounds = rounds;
      /** @type {boolean} */
      this.is64bit = is64bit;
      /** @type {uint8[]} */
      this.buffer = OpCodes.CreateArray(blockSize, 0);
      /** @type {int32} */
      this.bufferLength = 0;
      // Message length counted in bits as a 64-bit [HIGH, LOW] pair
      /** @type {uint32} */
      this.lengthHigh = 0;
      /** @type {uint32} */
      this.lengthLow = 0;
      // Salt: 4 32-bit words for 32-bit, 8 32-bit words for 64-bit (representing 4 64-bit values)
      /** @type {uint32[]} */
      this.salt = [];
      for (let i = 0; i < (is64bit ? 8 : 4); i++) {
        this.salt.push(0);
      }
      /** @type {uint32[]} */
      this.constants = is64bit ? B64C.slice() : B32C.slice();

      // Initialize state with IV (16 words for 64-bit variants, 8 otherwise)
      /** @type {uint32[]} */
      this.state = iv.slice(0, is64bit ? 16 : 8);
    }

    /**
     * Add a byte count to the 64-bit message bit length
     * @param {int32} bytes - Number of bytes (at most one block)
     * @returns {void}
     */
    _addLength(bytes) {
      const bits = OpCodes.Shl32(bytes, 3);
      this.lengthLow = OpCodes.Add32(this.lengthLow, bits);
      if (this.lengthLow < bits) {
        this.lengthHigh = OpCodes.Add32(this.lengthHigh, 1);
      }
    }

    /**
     * Feed data to the hash
     * @param {uint8[]} data - Input data bytes
     * @returns {void}
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; i++) {
        this.buffer[this.bufferLength++] = data[i];
        if (this.bufferLength === this.blockSize) {
          this._addLength(this.blockSize);
          this.compress(true);
          this.bufferLength = 0;
        }
      }
    }

    /**
     * Pad, compress the last block(s) and return the digest
     * @returns {uint8[]} Hash digest
     */
    Result() {
      // Padding
      // Total length in bits, including the bytes still in the buffer
      let totalLow = OpCodes.Add32(this.lengthLow, OpCodes.Shl32(this.bufferLength, 3));
      let totalHigh = this.lengthHigh;
      if (totalLow < this.lengthLow) {
        totalHigh = OpCodes.Add32(totalHigh, 1);
      }
      // Length encoding size: 8 bytes for 32-bit variants, 16 bytes for 64-bit variants
      const lengthFieldSize = this.is64bit ? 16 : 8;
      const paddingLength = this.blockSize - lengthFieldSize - 1; // Space for length flag and length

      // Add end bit
      this.buffer[this.bufferLength] = 0x80;

      // Clear remaining buffer
      for (let i = this.bufferLength + 1; i < this.blockSize; i++) {
        this.buffer[i] = 0;
      }

      // Check if we need an extra block
      if (this.bufferLength > paddingLength) {
        this._addLength(this.bufferLength);
        this.compress(true);
        // Clear buffer for final block
        for (let i = 0; i < this.blockSize; i++) {
          this.buffer[i] = 0;
        }
        this.bufferLength = 0;
      }

      // Add length flag. It occupies the byte just before the length field, and
      // when the message ends exactly there the 0x80 end marker already sits in
      // that byte, so the two merge instead of one replacing the other: the
      // reference pads a 55-byte-remainder message with 0x81 for BLAKE-256 and
      // 0x80 for BLAKE-224, not with the flag alone. Assigning erased the end
      // marker at every length congruent to 55 mod 64, and to 111 mod 128 for
      // the 64-bit variants. At every other length the byte is still zero, so
      // merging leaves the result exactly as it was.
      this.buffer[paddingLength] = OpCodes.Or8(this.buffer[paddingLength], this.lengthFlag);

      // Add total length in bits (big-endian); the 64-bit variants use a
      // 128-bit field whose upper 64 bits stay zero
      const highBytes = OpCodes.Unpack32BE(totalHigh);
      const lowBytes = OpCodes.Unpack32BE(totalLow);
      for (let i = 0; i < 4; i++) {
        this.buffer[this.blockSize - 8 + i] = highBytes[i];
        this.buffer[this.blockSize - 4 + i] = lowBytes[i];
      }
      if (this.is64bit) {
        for (let i = 0; i < 8; i++) {
          this.buffer[this.blockSize - 16 + i] = 0;
        }
      }

      // Noble-hashes pattern: withLength is based on bufferLength BEFORE adding to length
      const withLength = this.bufferLength !== 0;
      this._addLength(this.bufferLength);
      this.compress(withLength);

      // Extract output: state words big-endian ([HIGH, LOW] pairs for 64-bit
      // variants already sit HIGH first)
      /** @type {uint8[]} */
      const output = [];
      const outputWords = this.outputSize / 4;
      for (let i = 0; i < outputWords; i++) {
        const bytes = OpCodes.Unpack32BE(this.state[i]);
        for (let j = 0; j < 4; j++) {
          output.push(bytes[j]);
        }
      }

      return output;
    }

    /**
     * Compress the buffered block
     * @param {boolean} [withLength=true] - Whether the length counter enters the state
     * @returns {void}
     */
    compress(withLength = true) {
      if (this.is64bit) {
        this.compress64(withLength);
      } else {
        this.compress32(withLength);
      }
    }

    /**
     * Compression function of BLAKE-224/256
     * @param {boolean} [withLength=true] - Whether the length counter enters the state
     * @returns {void}
     */
    compress32(withLength = true) {
      // Prepare message schedule
      /** @type {uint32[]} */
      const W = [];
      for (let i = 0; i < 16; i++) {
        W.push(OpCodes.Pack32BE(
          this.buffer[i * 4],
          this.buffer[i * 4 + 1],
          this.buffer[i * 4 + 2],
          this.buffer[i * 4 + 3]
        ));
      }

      // Initialize working variables
      /** @type {uint32[]} */
      const v = [];
      for (let i = 0; i < 8; i++) {
        v.push(this.state[i]);
      }
      for (let i = 0; i < 4; i++) {
        v.push(OpCodes.Xor32(this.constants[i], this.salt[i]));
      }

      // Add length counter to v[12..15] for BLAKE1
      /** @type {uint32} */
      let lengthLow = 0;
      /** @type {uint32} */
      let lengthHigh = 0;
      if (withLength) {
        lengthLow = this.lengthLow;
        lengthHigh = this.lengthHigh;
      }
      v.push(OpCodes.Xor32(OpCodes.Xor32(this.constants[4], lengthLow), this.salt[0]));
      v.push(OpCodes.Xor32(OpCodes.Xor32(this.constants[5], lengthLow), this.salt[1]));
      v.push(OpCodes.Xor32(OpCodes.Xor32(this.constants[6], lengthHigh), this.salt[2]));
      v.push(OpCodes.Xor32(OpCodes.Xor32(this.constants[7], lengthHigh), this.salt[3]));

      // Compression rounds
      for (let r = 0, k = 0; r < this.rounds; r++, k += 16) {
        // Column step
        G1s_32(v, 0, 4, 8, 12, OpCodes.Xor32(W[BSIGMA[k]], TBL256[k]));
        G2s_32(v, 0, 4, 8, 12, OpCodes.Xor32(W[BSIGMA[k + 1]], TBL256[k + 1]));
        G1s_32(v, 1, 5, 9, 13, OpCodes.Xor32(W[BSIGMA[k + 2]], TBL256[k + 2]));
        G2s_32(v, 1, 5, 9, 13, OpCodes.Xor32(W[BSIGMA[k + 3]], TBL256[k + 3]));
        G1s_32(v, 2, 6, 10, 14, OpCodes.Xor32(W[BSIGMA[k + 4]], TBL256[k + 4]));
        G2s_32(v, 2, 6, 10, 14, OpCodes.Xor32(W[BSIGMA[k + 5]], TBL256[k + 5]));
        G1s_32(v, 3, 7, 11, 15, OpCodes.Xor32(W[BSIGMA[k + 6]], TBL256[k + 6]));
        G2s_32(v, 3, 7, 11, 15, OpCodes.Xor32(W[BSIGMA[k + 7]], TBL256[k + 7]));

        // Diagonal step
        G1s_32(v, 0, 5, 10, 15, OpCodes.Xor32(W[BSIGMA[k + 8]], TBL256[k + 8]));
        G2s_32(v, 0, 5, 10, 15, OpCodes.Xor32(W[BSIGMA[k + 9]], TBL256[k + 9]));
        G1s_32(v, 1, 6, 11, 12, OpCodes.Xor32(W[BSIGMA[k + 10]], TBL256[k + 10]));
        G2s_32(v, 1, 6, 11, 12, OpCodes.Xor32(W[BSIGMA[k + 11]], TBL256[k + 11]));
        G1s_32(v, 2, 7, 8, 13, OpCodes.Xor32(W[BSIGMA[k + 12]], TBL256[k + 12]));
        G2s_32(v, 2, 7, 8, 13, OpCodes.Xor32(W[BSIGMA[k + 13]], TBL256[k + 13]));
        G1s_32(v, 3, 4, 9, 14, OpCodes.Xor32(W[BSIGMA[k + 14]], TBL256[k + 14]));
        G2s_32(v, 3, 4, 9, 14, OpCodes.Xor32(W[BSIGMA[k + 15]], TBL256[k + 15]));
      }

      // Finalize state (XOR with salt)
      for (let i = 0; i < 8; i++) {
        this.state[i] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(this.state[i], v[i]), v[i + 8]), this.salt[i % 4]);
      }
    }

    /**
     * Compression function of BLAKE-384/512 on [HIGH, LOW] word pairs
     * @param {boolean} [withLength=true] - Whether the length counter enters the state
     * @returns {void}
     */
    compress64(withLength = true) {
      // Prepare message schedule (16 64-bit words as 32 32-bit words)
      // CRITICAL: Storage format [HIGH, LOW] matching noble-hashes!
      // M[i*2] = HIGH word (bytes 0-3), M[i*2+1] = LOW word (bytes 4-7)
      /** @type {uint32[]} */
      const M = [];
      for (let i = 0; i < 32; i++) {
        // Big-endian reading
        M.push(OpCodes.Pack32BE(
          this.buffer[i * 4],
          this.buffer[i * 4 + 1],
          this.buffer[i * 4 + 2],
          this.buffer[i * 4 + 3]
        ));
      }

      // Initialize working variables BBUF (16 64-bit as 32 32-bit)
      // CRITICAL: BBUF[i*2] = HIGH, BBUF[i*2+1] = LOW (matching noble-hashes line 449)
      /** @type {uint32[]} */
      const v = [];
      // Copy state (first 8 64-bit values = 16 32-bit words)
      for (let i = 0; i < 16; i++) {
        v.push(this.state[i]);
      }

      // v[8..15] = first 8 constants (16 words from constants array)
      for (let i = 0; i < 16; i++) {
        v.push(this.constants[i]);
      }

      // XOR salt into v[8..11] (indices 16..23 in flat array)
      for (let i = 0; i < 8; i++) {
        v[16 + i] = OpCodes.Xor32(v[16 + i], this.salt[i]);
      }

      // XOR length counter into v[12..13] if withLength (noble-hashes line 451-457)
      // BBUF naming: v12l is stored at BBUF[24] and contains HIGH word
      //              v12h is stored at BBUF[25] and contains LOW word
      if (withLength) {
        // v[24] = v12l (contains HIGH word), v[25] = v12h (contains LOW word)
        v[24] = OpCodes.Xor32(v[24], this.lengthHigh);  // HIGH word XOR HIGH bits
        v[25] = OpCodes.Xor32(v[25], this.lengthLow);   // LOW word XOR LOW bits
        // v[26] = v13l (contains HIGH word), v[27] = v13h (contains LOW word)
        v[26] = OpCodes.Xor32(v[26], this.lengthHigh);  // HIGH word XOR HIGH bits
        v[27] = OpCodes.Xor32(v[27], this.lengthLow);   // LOW word XOR LOW bits
      }

      // 16 rounds of compression (matching noble-hashes lines 458-476)
      for (let i = 0, k = 0; i < this.rounds; i++, k += 16) {
        // Column step
        Gb_64(v, 0, 4, 8, 12, M, k, 32, 25);
        Gb_64(v, 0, 4, 8, 12, M, k + 1, 16, 11);
        Gb_64(v, 1, 5, 9, 13, M, k + 2, 32, 25);
        Gb_64(v, 1, 5, 9, 13, M, k + 3, 16, 11);
        Gb_64(v, 2, 6, 10, 14, M, k + 4, 32, 25);
        Gb_64(v, 2, 6, 10, 14, M, k + 5, 16, 11);
        Gb_64(v, 3, 7, 11, 15, M, k + 6, 32, 25);
        Gb_64(v, 3, 7, 11, 15, M, k + 7, 16, 11);

        // Diagonal step
        Gb_64(v, 0, 5, 10, 15, M, k + 8, 32, 25);
        Gb_64(v, 0, 5, 10, 15, M, k + 9, 16, 11);
        Gb_64(v, 1, 6, 11, 12, M, k + 10, 32, 25);
        Gb_64(v, 1, 6, 11, 12, M, k + 11, 16, 11);
        Gb_64(v, 2, 7, 8, 13, M, k + 12, 32, 25);
        Gb_64(v, 2, 7, 8, 13, M, k + 13, 16, 11);
        Gb_64(v, 3, 4, 9, 14, M, k + 14, 32, 25);
        Gb_64(v, 3, 4, 9, 14, M, k + 15, 16, 11);
      }

      // Finalize state (matching noble-hashes lines 477-492)
      // Pattern: this.v0l XOR BBUF[0] XOR BBUF[16] XOR this.salt[0]; the salt repeats
      for (let i = 0; i < 16; i++) {
        this.state[i] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(this.state[i], v[i]), v[i + 16]), this.salt[i % 8]);
      }
    }
  }

  // BLAKE-224 Algorithm
  /**
 * Blake224Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Blake224Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "BLAKE-224";
      this.description = "BLAKE-224 hash function from SHA-3 competition. Produces 224-bit (28-byte) hash values.";
      this.inventor = "Jean-Philippe Aumasson, Luca Henzen, Willi Meier, Raphael C.-W. Phan";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      this.documentation = [
        new LinkItem("BLAKE Paper", "https://www.aumasson.jp/blake/blake.pdf"),
        new LinkItem("SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("Noble Hashes Implementation", "https://github.com/paulmillr/noble-hashes")
      ];

      this.references = [
        new LinkItem("BLAKE reference implementation (Jean-Philippe Aumasson)", "https://github.com/veorq/BLAKE")
      ];

      this.tests = [
        {
          text: "Empty string vector",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: [],
          expected: OpCodes.Hex8ToBytes("7dc5313b1c04512a174bd6503b89607aecbee0903d40a8a569c94eed")
        },
        {
          text: "Quick brown fox",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("c8e92d7088ef87c1530aee2ad44dc720cc10589cc2ec58f95a15e51b")
        },
        {
          // 55 message bytes leave the 0x80 end marker in the very byte the
          // length flag occupies, where the two have to merge - to 0x80 here,
          // since BLAKE-224 flags with 0x00. This is the length at which the
          // flag used to overwrite the marker outright.
          text: "NIST SHA-3 Round 3 KAT, Len = 440 (padding boundary, 55 mod 64)",
          uri: "https://web.archive.org/web/20110605051750id_/http://csrc.nist.gov/groups/ST/hash/sha-3/Round3/documents/Blake_FinalRnd.zip",
          input: OpCodes.Hex8ToBytes(
            "DE286BA4206E8B005714F80FB1CDFAEBDE91D29F84603E4A3EBC04686F99A46C" +
            "9E880B96C574825582E8812A26E5A857FFC6579F63742F"),
          expected: OpCodes.Hex8ToBytes("fa083b9d06432539780b306f8869c12ebc8c893e9308a208b337182d")
        }
      ];

      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new BlakeInstance(this, 28, 64, SHA224_IV, 0x00, 14, false);
    }
  }

  // BLAKE-256 Algorithm
  /**
 * Blake256Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Blake256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "BLAKE-256";
      this.description = "BLAKE-256 hash function from SHA-3 competition. Produces 256-bit (32-byte) hash values.";
      this.inventor = "Jean-Philippe Aumasson, Luca Henzen, Willi Meier, Raphael C.-W. Phan";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      this.documentation = [
        new LinkItem("BLAKE Paper", "https://www.aumasson.jp/blake/blake.pdf"),
        new LinkItem("SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("Noble Hashes Implementation", "https://github.com/paulmillr/noble-hashes")
      ];

      this.references = [
        new LinkItem("BLAKE reference implementation (Jean-Philippe Aumasson)", "https://github.com/veorq/BLAKE")
      ];

      this.tests = [
        {
          text: "Empty string vector",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: [],
          expected: OpCodes.Hex8ToBytes("716f6e863f744b9ac22c97ec7b76ea5f5908bc5b2f67c61510bfc4751384ea7a")
        },
        {
          text: "BLAKE test vector",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: OpCodes.AnsiToBytes("BLAKE"),
          expected: OpCodes.Hex8ToBytes("07663e00cf96fbc136cf7b1ee099c95346ba3920893d18cc8851f22ee2e36aa6")
        },
        {
          text: "Quick brown fox",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("7576698ee9cad30173080678e5965916adbb11cb5245d386bf1ffda1cb26c9d7")
        },
        {
          // 55 message bytes leave the 0x80 end marker in the very byte the
          // length flag occupies, where the two have to merge into 0x81. This
          // is the length at which the flag used to overwrite the marker.
          text: "NIST SHA-3 Round 3 KAT, Len = 440 (padding boundary, 55 mod 64)",
          uri: "https://web.archive.org/web/20110605051750id_/http://csrc.nist.gov/groups/ST/hash/sha-3/Round3/documents/Blake_FinalRnd.zip",
          input: OpCodes.Hex8ToBytes(
            "DE286BA4206E8B005714F80FB1CDFAEBDE91D29F84603E4A3EBC04686F99A46C" +
            "9E880B96C574825582E8812A26E5A857FFC6579F63742F"),
          expected: OpCodes.Hex8ToBytes("ad373db6defaefbeeff69e78e220a4ca9ef510ad5f85f0c698a749e0e6dcaeb5")
        }
      ];

      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new BlakeInstance(this, 32, 64, SHA256_IV, 0x01, 14, false);
    }
  }

  // BLAKE-384 Algorithm
  /**
 * Blake384Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Blake384Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "BLAKE-384";
      this.description = "BLAKE-384 hash function from SHA-3 competition. Produces 384-bit (48-byte) hash values.";
      this.inventor = "Jean-Philippe Aumasson, Luca Henzen, Willi Meier, Raphael C.-W. Phan";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      this.documentation = [
        new LinkItem("BLAKE Paper", "https://www.aumasson.jp/blake/blake.pdf"),
        new LinkItem("SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("Noble Hashes Implementation", "https://github.com/paulmillr/noble-hashes")
      ];

      this.references = [
        new LinkItem("BLAKE reference implementation (Jean-Philippe Aumasson)", "https://github.com/veorq/BLAKE")
      ];

      this.tests = [
        {
          text: "Empty string vector",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: [],
          expected: OpCodes.Hex8ToBytes("c6cbd89c926ab525c242e6621f2f5fa73aa4afe3d9e24aed727faaadd6af38b620bdb623dd2b4788b1c8086984af8706")
        },
        {
          // 111 message bytes leave the 0x80 end marker in the very byte the
          // length flag occupies, where the two have to merge - to 0x80 here,
          // since BLAKE-384 flags with 0x00. This is the length at which the
          // flag used to overwrite the marker outright.
          text: "NIST SHA-3 Round 3 KAT, Len = 888 (padding boundary, 111 mod 128)",
          uri: "https://web.archive.org/web/20110605051750id_/http://csrc.nist.gov/groups/ST/hash/sha-3/Round3/documents/Blake_FinalRnd.zip",
          input: OpCodes.Hex8ToBytes(
            "F690A132AB46B28EDFA6479283D6444E371C6459108AFD9C35DBD235E0B6B6FF" +
            "4C4EA58E7554BD002460433B2164CA51E868F7947D7D7A0D792E4ABF0BE5F450" +
            "853CC40D85485B2B8857EA31B5EA6E4CCFA2F3A7EF3380066D7D8979FDAC618A" +
            "AD3D7E886DEA4F005AE4AD05E5065F"),
          expected: OpCodes.Hex8ToBytes("10b485a54f643131d18647ed8ddebd36f3d403ccf658d477dceab018b349814b90939ed19b5978f3e6a980e94b966b5d")
        }
      ];

      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new BlakeInstance(this, 48, 128, SHA384_IV, 0x00, 16, true);
    }
  }

  // BLAKE-512 Algorithm
  /**
 * Blake512Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Blake512Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "BLAKE-512";
      this.description = "BLAKE-512 hash function from SHA-3 competition. Produces 512-bit (64-byte) hash values.";
      this.inventor = "Jean-Philippe Aumasson, Luca Henzen, Willi Meier, Raphael C.-W. Phan";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      this.documentation = [
        new LinkItem("BLAKE Paper", "https://www.aumasson.jp/blake/blake.pdf"),
        new LinkItem("SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("Noble Hashes Implementation", "https://github.com/paulmillr/noble-hashes")
      ];

      this.references = [
        new LinkItem("BLAKE reference implementation (Jean-Philippe Aumasson)", "https://github.com/veorq/BLAKE")
      ];

      this.tests = [
        {
          text: "Empty string vector",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: [],
          expected: OpCodes.Hex8ToBytes("a8cfbbd73726062df0c6864dda65defe58ef0cc52a5625090fa17601e1eecd1b628e94f396ae402a00acc9eab77b4d4c2e852aaaa25a636d80af3fc7913ef5b8")
        },
        {
          // 111 message bytes leave the 0x80 end marker in the very byte the
          // length flag occupies, where the two have to merge into 0x81. This
          // is the length at which the flag used to overwrite the marker.
          text: "NIST SHA-3 Round 3 KAT, Len = 888 (padding boundary, 111 mod 128)",
          uri: "https://web.archive.org/web/20110605051750id_/http://csrc.nist.gov/groups/ST/hash/sha-3/Round3/documents/Blake_FinalRnd.zip",
          input: OpCodes.Hex8ToBytes(
            "F690A132AB46B28EDFA6479283D6444E371C6459108AFD9C35DBD235E0B6B6FF" +
            "4C4EA58E7554BD002460433B2164CA51E868F7947D7D7A0D792E4ABF0BE5F450" +
            "853CC40D85485B2B8857EA31B5EA6E4CCFA2F3A7EF3380066D7D8979FDAC618A" +
            "AD3D7E886DEA4F005AE4AD05E5065F"),
          expected: OpCodes.Hex8ToBytes("0043e39f7d08a1eb38a80712d6e6ce244fb1834bbf19a3e60a7bf9067de49a18cb6bcefeb3885c099eaadc8e9c8f04dad0c2a0599c61194ded218354f255badd")
        }
      ];

      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new BlakeInstance(this, 64, 128, SHA512_IV, 0x01, 16, true);
    }
  }

  // Register all BLAKE algorithms
  RegisterAlgorithm(new Blake224Algorithm());
  RegisterAlgorithm(new Blake256Algorithm());
  RegisterAlgorithm(new Blake384Algorithm());
  RegisterAlgorithm(new Blake512Algorithm());

  return {
    Blake224Algorithm,
    Blake256Algorithm,
    Blake384Algorithm,
    Blake512Algorithm,
    BlakeInstance
  };

}));