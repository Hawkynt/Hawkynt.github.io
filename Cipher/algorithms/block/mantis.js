/*
 * MANTIS - Low-Latency Tweakable Block Cipher
 * Professional implementation following CRYPTO 2016 specification
 * (c)2006-2025 Hawkynt
 *
 * MANTIS is a 64-bit tweakable block cipher optimized for low-latency
 * applications like memory encryption. It uses 128-bit keys, 64-bit tweaks,
 * and a reflection-based structure with 14 rounds.
 *
 * Published: CRYPTO 2016
 * Authors: Christof Beierle, Jérémy Jean, Stefan Kölbl, Gregor Leander,
 *          Amir Moradi, Thomas Peyrin, Yu Sasaki, Pascal Sasdrich, Siang Meng Sim
 *
 * Reference: https://eprint.iacr.org/2016/660
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
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Alpha constant for k' derivation (fractional part of pi, PRINCE-style)
  const ALPHA = OpCodes.Hex8ToBytes("243F6A8885A308D3");

  // S-box (4-bit Midori Sb0 from MANTIS specification - involutory)
  const SBOX = OpCodes.Hex8ToBytes("0C0A0D030E0B0F070809010500020406");

  /**
   * Invert a 16-entry permutation
   * @param {uint8[]} perm - Permutation of 0..15
   * @returns {uint8[]} Inverse permutation
   */
  function invert16(perm) {
    const inv = OpCodes.CreateArray(16, 0);
    for (let i = 0; i < 16; ++i) {
      inv[perm[i]] = i;
    }
    return inv;
  }

  // Inverse S-box
  const INV_SBOX = invert16(SBOX);

  // Round constants (8 constants for maximum rounds) - as byte arrays
  /** @type {uint8[][]} */
  const RC = [
    OpCodes.Hex8ToBytes("13198A2E03707344"),
    OpCodes.Hex8ToBytes("A4093822299F31D0"),
    OpCodes.Hex8ToBytes("082EFA98EC4E6C89"),
    OpCodes.Hex8ToBytes("452821E638D01377"),
    OpCodes.Hex8ToBytes("BE5466CF34E90C6C"),
    OpCodes.Hex8ToBytes("C0AC29B7C97C50DD"),
    OpCodes.Hex8ToBytes("3F84D5B5B5470917"),
    OpCodes.Hex8ToBytes("9216D5D98979FB1B")
  ];

  /**
   * MixColumns operation (works on byte array [8 bytes])
   * @param {uint8[]} state - 8 state bytes
   * @returns {uint8[]} Mixed state bytes
   */
  function mixColumns(state) {
    // State is 8 bytes, treat as 4 rows of 16 bits each
    // Row 0: bytes 0-1, Row 1: bytes 2-3, Row 2: bytes 4-5, Row 3: bytes 6-7
    /** @type {uint8[]} */
    const result = new Array(8);

    // Extract rows (as 16-bit values)
    const row0 = OpCodes.Or32(OpCodes.Shl32(state[0], 8), state[1]);
    const row1 = OpCodes.Or32(OpCodes.Shl32(state[2], 8), state[3]);
    const row2 = OpCodes.Or32(OpCodes.Shl32(state[4], 8), state[5]);
    const row3 = OpCodes.Or32(OpCodes.Shl32(state[6], 8), state[7]);

    // Mix: each new row is XOR of three other rows
    const newRow0 = OpCodes.Xor32(OpCodes.Xor32(row1, row2), row3);
    const newRow1 = OpCodes.Xor32(OpCodes.Xor32(row0, row2), row3);
    const newRow2 = OpCodes.Xor32(OpCodes.Xor32(row0, row1), row3);
    const newRow3 = OpCodes.Xor32(OpCodes.Xor32(row0, row1), row2);

    result[0] = OpCodes.ToByte(OpCodes.Shr32(newRow0, 8));
    result[1] = OpCodes.ToByte(newRow0);
    result[2] = OpCodes.ToByte(OpCodes.Shr32(newRow1, 8));
    result[3] = OpCodes.ToByte(newRow1);
    result[4] = OpCodes.ToByte(OpCodes.Shr32(newRow2, 8));
    result[5] = OpCodes.ToByte(newRow2);
    result[6] = OpCodes.ToByte(OpCodes.Shr32(newRow3, 8));
    result[7] = OpCodes.ToByte(newRow3);

    return result;
  }

  /**
   * ShuffleCells permutation (works on nibble array [16 nibbles])
   * @param {uint8[]} nibbles - 16 nibbles
   * @returns {uint8[]} Permuted nibbles
   */
  function shuffleCells(nibbles) {
    /** @type {uint8[]} */
    const perm = [0, 11, 6, 13, 10, 1, 12, 7, 5, 14, 3, 8, 15, 4, 9, 2];
    /** @type {uint8[]} */
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = nibbles[perm[i]];
    }
    return result;
  }

  /**
   * h permutation for tweak schedule (works on nibble array [16 nibbles])
   * @param {uint8[]} nibbles - 16 nibbles
   * @returns {uint8[]} Permuted nibbles
   */
  function hPermutation(nibbles) {
    /** @type {uint8[]} */
    const perm = [6, 5, 14, 15, 0, 1, 2, 3, 7, 12, 13, 4, 8, 9, 10, 11];
    /** @type {uint8[]} */
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = nibbles[perm[i]];
    }
    return result;
  }

  /**
   * Inverse h permutation
   * @param {uint8[]} nibbles - 16 nibbles
   * @returns {uint8[]} Permuted nibbles
   */
  function hInversePermutation(nibbles) {
    /** @type {uint8[]} */
    const invPerm = [4, 5, 6, 7, 11, 1, 0, 8, 12, 13, 14, 15, 9, 10, 2, 3];
    /** @type {uint8[]} */
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = nibbles[invPerm[i]];
    }
    return result;
  }

  /**
   * Inverse ShuffleCells
   * @param {uint8[]} nibbles - 16 nibbles
   * @returns {uint8[]} Permuted nibbles
   */
  function invShuffleCells(nibbles) {
    /** @type {uint8[]} */
    const perm = [0, 11, 6, 13, 10, 1, 12, 7, 5, 14, 3, 8, 15, 4, 9, 2];
    /** @type {uint8[]} */
    const invPerm = new Array(16);
    for (let i = 0; i < 16; ++i) {
      invPerm[perm[i]] = i;
    }
    /** @type {uint8[]} */
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = nibbles[invPerm[i]];
    }
    return result;
  }

  /**
   * Apply S-box to all nibbles
   * @param {uint8[]} nibbles - 16 nibbles
   * @param {boolean} [inverse=false] - Use the inverse S-box
   * @returns {uint8[]} Substituted nibbles
   */
  function subCells(nibbles, inverse = false) {
    const sbox = inverse ? INV_SBOX : SBOX;
    /** @type {uint8[]} */
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = sbox[nibbles[i]];
    }
    return result;
  }

  /**
   * Convert bytes to nibbles (16 nibbles from 8 bytes)
   * @param {uint8[]} bytes - 8 bytes
   * @returns {uint8[]} 16 nibbles, high nibble first
   */
  function bytesToNibbles(bytes) {
    /** @type {uint8[]} */
    const nibbles = new Array(16);
    for (let i = 0; i < 8; ++i) {
      nibbles[2 * i] = OpCodes.And32(OpCodes.Shr32(bytes[i], 4), 0x0F);       // High nibble
      nibbles[2 * i + 1] = OpCodes.And32(bytes[i], 0x0F);            // Low nibble
    }
    return nibbles;
  }

  /**
   * Convert nibbles to bytes (8 bytes from 16 nibbles)
   * @param {uint8[]} nibbles - 16 nibbles, high nibble first
   * @returns {uint8[]} 8 bytes
   */
  function nibblesToBytes(nibbles) {
    /** @type {uint8[]} */
    const bytes = new Array(8);
    for (let i = 0; i < 8; ++i) {
      bytes[i] = OpCodes.Or32(OpCodes.Shl32(OpCodes.And32(nibbles[2 * i], 0x0F), 4), OpCodes.And32(nibbles[2 * i + 1], 0x0F));
    }
    return bytes;
  }

  /**
 * Mantis - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class Mantis extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "MANTIS";
      this.description = "Low-latency tweakable block cipher designed for memory encryption. 64-bit block size with 128-bit keys and 64-bit tweaks using reflection-based structure with 14 rounds. Optimized for minimal latency in hardware implementations. Note: Decryption uses modified key derivation per reflection property.";
      this.inventor = "Christof Beierle, Jérémy Jean, Stefan Kölbl, Gregor Leander, et al.";
      this.year = 2016;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Tweakable Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.DE;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)]; // 128-bit keys only
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)]; // 64-bit blocks only

      this.documentation = [
        new LinkItem("MANTIS Specification (ePrint Archive)", "https://eprint.iacr.org/2016/660"),
        new LinkItem("CRYPTO 2016 Paper", "https://link.springer.com/chapter/10.1007/978-3-662-53008-5_5"),
        new LinkItem("Reference Implementation (Skinny-C)", "https://github.com/rweather/skinny-c")
      ];

      this.references = [
        new LinkItem("Skinny-C MANTIS Source (mantis-cipher.c)", "https://github.com/rweather/skinny-c/blob/master/src/mantis-cipher.c")
      ];

      // Test vector from the SKINNY/MANTIS specification, Appendix B.2.
      // Only the MANTIS-7 instance (7 forward plus 7 backward rounds) is
      // implemented here; the paper's MANTIS-5, MANTIS-6 and MANTIS-8 vectors
      // use a different round count and are therefore not applicable.
      this.tests = [
        {
          text: "MANTIS-7 Test Vector - specification Appendix B.2",
          uri: "https://eprint.iacr.org/2016/660.pdf",
          input: OpCodes.Hex8ToBytes("60e43457311936fd"),
          key: OpCodes.Hex8ToBytes("92f09952c625e3e9d7a060f714c0292b"),
          tweak: OpCodes.Hex8ToBytes("ba912e6f1055fed2"),
          expected: OpCodes.Hex8ToBytes("308e8a07f168f517")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {MantisInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MantisInstance(this, isInverse);
    }
  }

  /**
 * Mantis cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MantisInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Mantis} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._tweak = null;
      /** @type {uint8[]|null} */
      this._k0 = null;
      /** @type {uint8[]|null} */
      this._k1 = null;
      /** @type {uint8[]|null} */
      this._kPrime = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this._k0 = null;
        this._k1 = null;
        this._kPrime = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (expected 16 bytes)");
      }

      this._key = [...keyBytes];

      // Split key: k = k0 || k1 (each 64 bits = 8 bytes)
      this._k0 = keyBytes.slice(0, 8);
      this._k1 = keyBytes.slice(8, 16);

      // k' = 1-bit right rotation of k0 with XOR (from skinny-c mantis_unpack_rotated_block)
      /** @type {uint8[]} */
      const rotated = new Array(8);
      this._kPrime = rotated;
      let carry = this._k0[7];
      for (let index = 0; index < 8; ++index) {
        const next = this._k0[index];
        this._kPrime[index] = OpCodes.ToByte(OpCodes.Or32(OpCodes.Shl32(carry, 7), OpCodes.Shr32(next, 1)));
        carry = next;
      }
      this._kPrime[7] = OpCodes.Xor32(this._kPrime[7], OpCodes.Shr32(this._k0[0], 7));

      // For decryption (inverse), implement α-reflexivity property:
      // - Swap k0 and k' (k0 becomes rotated, k' becomes original)
      // - XOR k1 with ALPHA constant (critical for correct decryption)
      if (this.isInverse) {
        const temp = this._k0;
        this._k0 = this._kPrime;
        this._kPrime = temp;

        // XOR k1 with ALPHA for decryption mode
        for (let i = 0; i < 8; ++i) {
          this._k1[i] = OpCodes.Xor32(this._k1[i], ALPHA[i]);
        }
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * @param {uint8[]|null} tweakBytes - 8-byte tweak, or null to clear
     */
    set tweak(tweakBytes) {
      if (!tweakBytes) {
        this._tweak = null;
        return;
      }

      if (tweakBytes.length !== 8) {
        throw new Error("Invalid tweak size: " + tweakBytes.length + " bytes (expected 8 bytes)");
      }

      this._tweak = [...tweakBytes];
    }

    /**
     * @returns {uint8[]|null} Copy of the tweak, or null
     */
    get tweak() {
      return this._tweak ? [...this._tweak] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % 8 !== 0) {
        throw new Error("Invalid input length: " + this.inputBuffer.length + " bytes (must be multiple of 8)");
      }

      /** @type {uint8[]} */
      const output = [];
      const numBlocks = this.inputBuffer.length / 8;

      for (let b = 0; b < numBlocks; ++b) {
        const block = this.inputBuffer.slice(b * 8, (b + 1) * 8);
        const processed = this.processBlock(block);
        for (let _i = 0; _i < processed.length; _i++) output.push(processed[_i]);
      }

      this.inputBuffer = [];
      return output;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    processBlock(block) {
      // State is 8 bytes
      /** @type {uint8[]} */
      let state = [...block];
      let tweakBytes = this._tweak !== null ? this._tweak : OpCodes.CreateArray(8, 0);

      // Initial whitening: state XOR k0 XOR k1 XOR tweak (from skinny-c)
      for (let i = 0; i < 8; ++i) {
        state[i] = OpCodes.Xor32(state[i], this._k0[i]);
      }
      for (let i = 0; i < 8; ++i) {
        state[i] = OpCodes.Xor32(state[i], this._k1[i]);
      }
      for (let i = 0; i < 8; ++i) {
        state[i] = OpCodes.Xor32(state[i], tweakBytes[i]);
      }

      // Forward rounds (7 rounds)
      // Order from skinny-c: update_tweak, sbox, add RC, XOR k1^tweak, shift_rows, mix_columns
      for (let r = 0; r < 7; ++r) {
        // Update tweak first
        let tweakNibbles = bytesToNibbles(tweakBytes);
        tweakNibbles = hPermutation(tweakNibbles);
        tweakBytes = nibblesToBytes(tweakNibbles);

        // SubCells
        let nibbles = bytesToNibbles(state);
        nibbles = subCells(nibbles, false);
        state = nibblesToBytes(nibbles);

        // Add round constant
        for (let i = 0; i < 8; ++i) {
          state[i] = OpCodes.Xor32(state[i], RC[r][i]);
        }

        // XOR k1 and tweak
        for (let i = 0; i < 8; ++i) {
          state[i] = OpCodes.Xor32(state[i], OpCodes.Xor32(this._k1[i], tweakBytes[i]));
        }

        // ShuffleCells (Permutation)
        nibbles = bytesToNibbles(state);
        nibbles = shuffleCells(nibbles);
        state = nibblesToBytes(nibbles);

        // MixColumns
        state = mixColumns(state);
      }

      // Middle round: S → M → S
      let nibbles = bytesToNibbles(state);
      nibbles = subCells(nibbles, false);
      state = nibblesToBytes(nibbles);
      state = mixColumns(state);
      nibbles = bytesToNibbles(state);
      nibbles = subCells(nibbles, false);
      state = nibblesToBytes(nibbles);

      // After middle round: XOR ALPHA into k1 for backward rounds (from skinny-c)
      /** @type {uint8[]} */
      const k1Modified = new Array(8);
      for (let i = 0; i < 8; ++i) {
        k1Modified[i] = OpCodes.Xor32(this._k1[i], ALPHA[i]);
      }

      // Backward rounds (7 rounds in reverse)
      // Order from skinny-c: mix_columns, inv_shift_rows, XOR k1Modified^tweak, add RC, sbox, inv_update_tweak
      for (let r = 6; r >= 0; --r) {
        // InvMixColumns
        state = mixColumns(state);  // MixColumns is involutory

        // InvShuffleCells
        nibbles = bytesToNibbles(state);
        nibbles = invShuffleCells(nibbles);
        state = nibblesToBytes(nibbles);

        // XOR k1Modified and tweak
        for (let i = 0; i < 8; ++i) {
          state[i] = OpCodes.Xor32(state[i], OpCodes.Xor32(k1Modified[i], tweakBytes[i]));
        }

        // Add round constant
        for (let i = 0; i < 8; ++i) {
          state[i] = OpCodes.Xor32(state[i], RC[r][i]);
        }

        // InvSubCells
        nibbles = bytesToNibbles(state);
        nibbles = subCells(nibbles, true);  // Use inverse S-box
        state = nibblesToBytes(nibbles);

        // Inverse h permutation on tweak
        let tweakNibbles = bytesToNibbles(tweakBytes);
        tweakNibbles = hInversePermutation(tweakNibbles);
        tweakBytes = nibblesToBytes(tweakNibbles);
      }

      // Final whitening: state XOR k0' XOR k1Modified XOR tweak (from skinny-c)
      for (let i = 0; i < 8; ++i) {
        state[i] = OpCodes.Xor32(state[i], this._kPrime[i]);
      }
      for (let i = 0; i < 8; ++i) {
        state[i] = OpCodes.Xor32(state[i], k1Modified[i]);
      }
      for (let i = 0; i < 8; ++i) {
        state[i] = OpCodes.Xor32(state[i], tweakBytes[i]);
      }

      return state;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Mantis());

  return Mantis;
}));
