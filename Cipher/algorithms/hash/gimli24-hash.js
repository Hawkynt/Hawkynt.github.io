/*
 * GIMLI-24-HASH - Lightweight Cryptographic Hash Function
 * Professional implementation following reference C implementation
 * (c)2006-2025 Hawkynt
 *
 * GIMLI-24-HASH is the hash function mode of the GIMLI-24 permutation, designed for
 * lightweight cryptography applications. It uses a sponge construction with 256-bit output.
 * Reference: Southern Storm Software lightweight-crypto/src/combined/gimli24.c
 * Specification: https://gimli.cr.yp.to/
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

  const GIMLI24_BLOCK_SIZE = 16;  // 16 bytes rate for sponge
  const GIMLI24_HASH_SIZE = 32;   // 256-bit output

  /**
   * GIMLI-24 permutation implementation
   * State: 12 x 32-bit words (48 bytes total)
   * Operates on 3 columns of 4 rows each
   * @param {uint32[]} state - 12-word state (modified in place)
   * @returns {void}
   */
  function gimli24_permute(state) {
    /** @type {uint32} */
    var x;
    /** @type {uint32} */
    var y;
    /** @type {int32} */
    var round;

    // Load state (little-endian)
    var s0 = state[0];
    var s1 = state[1];
    var s2 = state[2];
    var s3 = state[3];
    var s4 = state[4];
    var s5 = state[5];
    var s6 = state[6];
    var s7 = state[7];
    var s8 = state[8];
    var s9 = state[9];
    var s10 = state[10];
    var s11 = state[11];

    // 24 rounds, processed 4 at a time
    for (round = 24; round > 0; round -= 4) {
      // Round 0: SP-box, small swap, add round constant
      // Apply SP-box to each column
      // Column 0: s0, s4, s8
      x = OpCodes.RotL32(s0, 24);
      y = OpCodes.RotL32(s4, 9);
      s4 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s8), 1));
      s0 = OpCodes.Xor32(OpCodes.Xor32(s8, y), OpCodes.Shl32((x&y), 3));
      s8 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s8, 1)), OpCodes.Shl32((y&s8), 2));

      // Column 1: s1, s5, s9
      x = OpCodes.RotL32(s1, 24);
      y = OpCodes.RotL32(s5, 9);
      s5 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s9), 1));
      s1 = OpCodes.Xor32(OpCodes.Xor32(s9, y), OpCodes.Shl32((x&y), 3));
      s9 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s9, 1)), OpCodes.Shl32((y&s9), 2));

      // Column 2: s2, s6, s10
      x = OpCodes.RotL32(s2, 24);
      y = OpCodes.RotL32(s6, 9);
      s6 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s10), 1));
      s2 = OpCodes.Xor32(OpCodes.Xor32(s10, y), OpCodes.Shl32((x&y), 3));
      s10 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s10, 1)), OpCodes.Shl32((y&s10), 2));

      // Column 3: s3, s7, s11
      x = OpCodes.RotL32(s3, 24);
      y = OpCodes.RotL32(s7, 9);
      s7 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s11), 1));
      s3 = OpCodes.Xor32(OpCodes.Xor32(s11, y), OpCodes.Shl32((x&y), 3));
      s11 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s11, 1)), OpCodes.Shl32((y&s11), 2));

      // Small swap (swap s0<->s1, s2<->s3)
      x = s0;
      y = s2;
      s0 = OpCodes.Xor32(OpCodes.Xor32(s1, 0x9e377900), round);
      s1 = x;
      s2 = s3;
      s3 = y;

      // Round 1: SP-box only
      // Column 0
      x = OpCodes.RotL32(s0, 24);
      y = OpCodes.RotL32(s4, 9);
      s4 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s8), 1));
      s0 = OpCodes.Xor32(OpCodes.Xor32(s8, y), OpCodes.Shl32((x&y), 3));
      s8 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s8, 1)), OpCodes.Shl32((y&s8), 2));

      // Column 1
      x = OpCodes.RotL32(s1, 24);
      y = OpCodes.RotL32(s5, 9);
      s5 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s9), 1));
      s1 = OpCodes.Xor32(OpCodes.Xor32(s9, y), OpCodes.Shl32((x&y), 3));
      s9 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s9, 1)), OpCodes.Shl32((y&s9), 2));

      // Column 2
      x = OpCodes.RotL32(s2, 24);
      y = OpCodes.RotL32(s6, 9);
      s6 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s10), 1));
      s2 = OpCodes.Xor32(OpCodes.Xor32(s10, y), OpCodes.Shl32((x&y), 3));
      s10 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s10, 1)), OpCodes.Shl32((y&s10), 2));

      // Column 3
      x = OpCodes.RotL32(s3, 24);
      y = OpCodes.RotL32(s7, 9);
      s7 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s11), 1));
      s3 = OpCodes.Xor32(OpCodes.Xor32(s11, y), OpCodes.Shl32((x&y), 3));
      s11 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s11, 1)), OpCodes.Shl32((y&s11), 2));

      // Round 2: SP-box, big swap
      // Column 0
      x = OpCodes.RotL32(s0, 24);
      y = OpCodes.RotL32(s4, 9);
      s4 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s8), 1));
      s0 = OpCodes.Xor32(OpCodes.Xor32(s8, y), OpCodes.Shl32((x&y), 3));
      s8 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s8, 1)), OpCodes.Shl32((y&s8), 2));

      // Column 1
      x = OpCodes.RotL32(s1, 24);
      y = OpCodes.RotL32(s5, 9);
      s5 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s9), 1));
      s1 = OpCodes.Xor32(OpCodes.Xor32(s9, y), OpCodes.Shl32((x&y), 3));
      s9 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s9, 1)), OpCodes.Shl32((y&s9), 2));

      // Column 2
      x = OpCodes.RotL32(s2, 24);
      y = OpCodes.RotL32(s6, 9);
      s6 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s10), 1));
      s2 = OpCodes.Xor32(OpCodes.Xor32(s10, y), OpCodes.Shl32((x&y), 3));
      s10 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s10, 1)), OpCodes.Shl32((y&s10), 2));

      // Column 3
      x = OpCodes.RotL32(s3, 24);
      y = OpCodes.RotL32(s7, 9);
      s7 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s11), 1));
      s3 = OpCodes.Xor32(OpCodes.Xor32(s11, y), OpCodes.Shl32((x&y), 3));
      s11 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s11, 1)), OpCodes.Shl32((y&s11), 2));

      // Big swap (swap s0<->s2, s1<->s3)
      x = s0;
      y = s1;
      s0 = s2;
      s1 = s3;
      s2 = x;
      s3 = y;

      // Round 3: SP-box only
      // Column 0
      x = OpCodes.RotL32(s0, 24);
      y = OpCodes.RotL32(s4, 9);
      s4 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s8), 1));
      s0 = OpCodes.Xor32(OpCodes.Xor32(s8, y), OpCodes.Shl32((x&y), 3));
      s8 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s8, 1)), OpCodes.Shl32((y&s8), 2));

      // Column 1
      x = OpCodes.RotL32(s1, 24);
      y = OpCodes.RotL32(s5, 9);
      s5 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s9), 1));
      s1 = OpCodes.Xor32(OpCodes.Xor32(s9, y), OpCodes.Shl32((x&y), 3));
      s9 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s9, 1)), OpCodes.Shl32((y&s9), 2));

      // Column 2
      x = OpCodes.RotL32(s2, 24);
      y = OpCodes.RotL32(s6, 9);
      s6 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s10), 1));
      s2 = OpCodes.Xor32(OpCodes.Xor32(s10, y), OpCodes.Shl32((x&y), 3));
      s10 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s10, 1)), OpCodes.Shl32((y&s10), 2));

      // Column 3
      x = OpCodes.RotL32(s3, 24);
      y = OpCodes.RotL32(s7, 9);
      s7 = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32((x|s11), 1));
      s3 = OpCodes.Xor32(OpCodes.Xor32(s11, y), OpCodes.Shl32((x&y), 3));
      s11 = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s11, 1)), OpCodes.Shl32((y&s11), 2));
    }

    // Store state back (little-endian)
    state[0] = OpCodes.ToUint32(s0);
    state[1] = OpCodes.ToUint32(s1);
    state[2] = OpCodes.ToUint32(s2);
    state[3] = OpCodes.ToUint32(s3);
    state[4] = OpCodes.ToUint32(s4);
    state[5] = OpCodes.ToUint32(s5);
    state[6] = OpCodes.ToUint32(s6);
    state[7] = OpCodes.ToUint32(s7);
    state[8] = OpCodes.ToUint32(s8);
    state[9] = OpCodes.ToUint32(s9);
    state[10] = OpCodes.ToUint32(s10);
    state[11] = OpCodes.ToUint32(s11);
  }

  /**
 * Gimli24Hash - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Gimli24Hash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "GIMLI-24-HASH";
      this.description = "Lightweight hash function based on the GIMLI-24 permutation using a sponge construction. Designed for simplicity and efficiency in constrained environments while providing 256-bit security.";
      this.inventor = "Daniel J. Bernstein, Stefan Kölbl, Stefan Lucks, Pedro Maat Costa Massolino, Florian Mendel, Kashif Nawaz, Tobias Schneider, Peter Schwabe, François-Xavier Standaert, Yosuke Todo, Benoît Viguier";
      this.year = 2017;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [new KeySize(32, 32, 1)];

      this.documentation = [
        new LinkItem(
          "GIMLI Official Website",
          "https://gimli.cr.yp.to/"
        ),
        new LinkItem(
          "GIMLI Specification",
          "https://gimli.cr.yp.to/gimli-20170627.pdf"
        ),
        new LinkItem(
          "NIST Lightweight Cryptography",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "Reference Implementation",
          "https://github.com/rweather/lightweight-crypto"
        )
      ];

      this.references = [
        new LinkItem("rweather lightweight-crypto reference implementation (GIMLI-24-HASH)", "https://github.com/rweather/lightweight-crypto"),
        new LinkItem("Official GIMLI website with reference C code", "https://gimli.cr.yp.to/")
      ];

      // Official test vectors from GIMLI-24-HASH.txt
      this.tests = [
        {
          text: "GIMLI-24-HASH: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("27AE20E95FBC2BF01E972B0015EEA431C20FC8818F25BC6DBE66232230DB352F")
        },
        {
          text: "GIMLI-24-HASH: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("FEAE3B182D3BF6FF48F63865146ABEAE85D89C13E5AA688677D0354A9E893FC4")
        },
        {
          text: "GIMLI-24-HASH: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("5FEAFD3C603B3BD7B31EE0982C5330E8348CB5B4CC9A10EDB860E1226063D047")
        },
        {
          text: "GIMLI-24-HASH: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("AC9BC82B68FE1FC51DB80C67F6751A09F432D0C7E78239C0697468F54AE3F5AA")
        },
        {
          text: "GIMLI-24-HASH: Eight bytes (Count=9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("EF1B75E245D5956B71FCD5B90DFE72BC43F95886AD18B11E1C5B0FBA44852983")
        },
        {
          text: "GIMLI-24-HASH: Sixteen bytes (Count=17)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("404C130AF1B9023A7908200919F690FFBB756D5176E056FFDE320016A37C7282")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Gimli24HashInstance} New hash instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new Gimli24HashInstance(this);
    }
  }

  /**
 * Gimli24Hash cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Gimli24HashInstance extends IHashFunctionInstance {
    /**
     * Initialize a GIMLI-24-HASH instance
     * @param {Gimli24Hash} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);

      // GIMLI-24 state: 12 x 32-bit words (48 bytes)
      /** @type {uint32[]} */
      this.state = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      // Input buffer for incomplete blocks
      /** @type {uint8[]} */
      this.buffer = [];
    }

    /**
     * Convert the state to bytes (little-endian)
     * @param {uint8[]} stateBytes - 48-byte destination
     * @returns {void}
     */
    _stateToBytes(stateBytes) {
      for (let j = 0; j < 12; j++) {
        const word = this.state[j];
        stateBytes[j * 4 + 0] = OpCodes.GetByte(word, 0);
        stateBytes[j * 4 + 1] = OpCodes.GetByte(word, 1);
        stateBytes[j * 4 + 2] = OpCodes.GetByte(word, 2);
        stateBytes[j * 4 + 3] = OpCodes.GetByte(word, 3);
      }
    }

    /**
     * Convert bytes back to the state (little-endian)
     * @param {uint8[]} stateBytes - 48-byte source
     * @returns {void}
     */
    _bytesToState(stateBytes) {
      for (let j = 0; j < 12; j++) {
        this.state[j] = OpCodes.Pack32LE(stateBytes[j * 4 + 0], stateBytes[j * 4 + 1], stateBytes[j * 4 + 2], stateBytes[j * 4 + 3]);
      }
    }

    /**
     * XOR one whole rate block from source[start..start+15] and permute
     * @param {uint8[]} stateBytes - 48-byte scratch buffer
     * @param {uint8[]} source - Message bytes
     * @param {int32} start - Offset of the block in source
     * @returns {void}
     */
    _absorbBlock(stateBytes, source, start) {
      this._stateToBytes(stateBytes);
      for (let i = 0; i < GIMLI24_BLOCK_SIZE; i++) {
        stateBytes[i] = OpCodes.Xor8(stateBytes[i], source[start + i]);
      }
      this._bytesToState(stateBytes);
      gimli24_permute(this.state);
    }

    /**
     * Absorb data into the state using sponge construction
     * Rate: 16 bytes (first 16 bytes of state)
     *
     * The sponge is fed one rate-sized block at a time, and the bytes that make
     * up a block need not arrive in a single call. Anything left over is carried
     * in this.buffer and completed by the following call, so that
     * Feed(a); Feed(b) absorbs exactly the same block sequence as Feed(a || b).
     * The buffer therefore never reaches the rate on exit, which is also what
     * keeps the padding byte written by Result() inside the rate.
     * @param {uint8[]} data - Message bytes
     * @returns {void}
     */
    _absorb(data) {
      let offset = 0;
      /** @type {uint8[]} */
      const stateBytes = new Array(48);
      const buffer = this.buffer;

      // Complete a block carried over from an earlier Feed before touching the
      // rest, otherwise the carried bytes would be absorbed out of order.
      if (buffer.length > 0) {
        while (buffer.length < GIMLI24_BLOCK_SIZE && offset < data.length) {
          buffer.push(data[offset++]);
        }
        if (buffer.length < GIMLI24_BLOCK_SIZE) return;
        this._absorbBlock(stateBytes, buffer, 0);
        buffer.length = 0;
      }

      // Process full blocks straight out of the caller's data
      while (offset + GIMLI24_BLOCK_SIZE <= data.length) {
        this._absorbBlock(stateBytes, data, offset);
        offset += GIMLI24_BLOCK_SIZE;
      }

      // Carry the ragged tail into the next Feed, or into Result
      while (offset < data.length) {
        buffer.push(data[offset++]);
      }
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @returns {void}
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this._absorb(data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   */

    Result() {
      /** @type {uint8[]} */
      const stateBytes = new Array(48);
      /** @type {uint8[]} */
      const output = new Array(GIMLI24_HASH_SIZE);

      // Process remaining buffered data with padding
      if (this.buffer.length > 0) {
        this._stateToBytes(stateBytes);
        // XOR buffered data
        for (let i = 0; i < this.buffer.length; i++) {
          stateBytes[i] = OpCodes.Xor8(stateBytes[i], this.buffer[i]);
        }
        this._bytesToState(stateBytes);
      }

      // Apply padding: byte at position of last data XOR 0x01, byte 47 XOR 0x01
      this._stateToBytes(stateBytes);
      const temp = this.buffer.length;
      stateBytes[temp] = OpCodes.Xor8(stateBytes[temp], 0x01);
      stateBytes[47] = OpCodes.Xor8(stateBytes[47], 0x01);
      this._bytesToState(stateBytes);

      // Final permutation
      gimli24_permute(this.state);

      // Extract first half of output (16 bytes)
      this._stateToBytes(stateBytes);
      for (let i = 0; i < GIMLI24_HASH_SIZE / 2; i++) {
        output[i] = stateBytes[i];
      }

      // Permute again
      gimli24_permute(this.state);

      // Extract second half of output (16 bytes)
      this._stateToBytes(stateBytes);
      for (let i = 0; i < GIMLI24_HASH_SIZE / 2; i++) {
        output[GIMLI24_HASH_SIZE / 2 + i] = stateBytes[i];
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.state);
      OpCodes.ClearArray(this.buffer);

      return output;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Gimli24Hash());

  return Gimli24Hash;
}));
