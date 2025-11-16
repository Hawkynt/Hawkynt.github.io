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
  const ALPHA = [0x24, 0x3F, 0x6A, 0x88, 0x85, 0xA3, 0x08, 0xD3];

  // S-box (4-bit Midori Sb0 from MANTIS specification - involutory)
  const SBOX = [0xC, 0xA, 0xD, 0x3, 0xE, 0xB, 0xF, 0x7, 0x8, 0x9, 0x1, 0x5, 0x0, 0x2, 0x4, 0x6];

  // Inverse S-box
  const INV_SBOX = new Array(16);
  for (let i = 0; i < 16; ++i) {
    INV_SBOX[SBOX[i]] = i;
  }

  // Round constants (8 constants for maximum rounds) - as byte arrays
  const RC = [
    [0x13, 0x19, 0x8A, 0x2E, 0x03, 0x70, 0x73, 0x44],
    [0xA4, 0x09, 0x38, 0x22, 0x29, 0x9F, 0x31, 0xD0],
    [0x08, 0x2E, 0xFA, 0x98, 0xEC, 0x4E, 0x6C, 0x89],
    [0x45, 0x28, 0x21, 0xE6, 0x38, 0xD0, 0x13, 0x77],
    [0xBE, 0x54, 0x66, 0xCF, 0x34, 0xE9, 0x0C, 0x6C],
    [0xC0, 0xAC, 0x29, 0xB7, 0xC9, 0x7C, 0x50, 0xDD],
    [0x3F, 0x84, 0xD5, 0xB5, 0xB5, 0x47, 0x09, 0x17],
    [0x92, 0x16, 0xD5, 0xD9, 0x89, 0x79, 0xFB, 0x1B]
  ];

  // MixColumns operation (works on byte array [8 bytes])
  function mixColumns(state) {
    // State is 8 bytes, treat as 4 rows of 16 bits each
    // Row 0: bytes 0-1, Row 1: bytes 2-3, Row 2: bytes 4-5, Row 3: bytes 6-7
    const result = new Array(8);

    // Extract rows (as 16-bit values)
    const row0 = (state[0] << 8) | state[1];
    const row1 = (state[2] << 8) | state[3];
    const row2 = (state[4] << 8) | state[5];
    const row3 = (state[6] << 8) | state[7];

    // Mix: each new row is XOR of three other rows
    const newRow0 = row1 ^ row2 ^ row3;
    const newRow1 = row0 ^ row2 ^ row3;
    const newRow2 = row0 ^ row1 ^ row3;
    const newRow3 = row0 ^ row1 ^ row2;

    result[0] = (newRow0 >>> 8) & 0xFF;
    result[1] = newRow0 & 0xFF;
    result[2] = (newRow1 >>> 8) & 0xFF;
    result[3] = newRow1 & 0xFF;
    result[4] = (newRow2 >>> 8) & 0xFF;
    result[5] = newRow2 & 0xFF;
    result[6] = (newRow3 >>> 8) & 0xFF;
    result[7] = newRow3 & 0xFF;

    return result;
  }

  // ShuffleCells permutation (works on nibble array [16 nibbles])
  function shuffleCells(nibbles) {
    const perm = [0, 11, 6, 13, 10, 1, 12, 7, 5, 14, 3, 8, 15, 4, 9, 2];
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = nibbles[perm[i]];
    }
    return result;
  }

  // h permutation for tweak schedule (works on nibble array [16 nibbles])
  function hPermutation(nibbles) {
    const perm = [6, 5, 14, 15, 0, 1, 2, 3, 7, 12, 13, 4, 8, 9, 10, 11];
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = nibbles[perm[i]];
    }
    return result;
  }

  // Inverse h permutation
  function hInversePermutation(nibbles) {
    const invPerm = [4, 5, 6, 7, 11, 1, 0, 8, 12, 13, 14, 15, 9, 10, 2, 3];
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = nibbles[invPerm[i]];
    }
    return result;
  }

  // Inverse ShuffleCells
  function invShuffleCells(nibbles) {
    const perm = [0, 11, 6, 13, 10, 1, 12, 7, 5, 14, 3, 8, 15, 4, 9, 2];
    const invPerm = new Array(16);
    for (let i = 0; i < 16; ++i) {
      invPerm[perm[i]] = i;
    }
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = nibbles[invPerm[i]];
    }
    return result;
  }

  // Apply S-box to all nibbles
  function subCells(nibbles, inverse = false) {
    const sbox = inverse ? INV_SBOX : SBOX;
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = sbox[nibbles[i]];
    }
    return result;
  }

  // Convert bytes to nibbles (16 nibbles from 8 bytes)
  function bytesToNibbles(bytes) {
    const nibbles = new Array(16);
    for (let i = 0; i < 8; ++i) {
      nibbles[2 * i] = (bytes[i] >>> 4) & 0x0F;       // High nibble
      nibbles[2 * i + 1] = bytes[i] & 0x0F;            // Low nibble
    }
    return nibbles;
  }

  // Convert nibbles to bytes (8 bytes from 16 nibbles)
  function nibblesToBytes(nibbles) {
    const bytes = new Array(8);
    for (let i = 0; i < 8; ++i) {
      bytes[i] = ((nibbles[2 * i] & 0x0F) << 4) | (nibbles[2 * i + 1] & 0x0F);
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

      // Test vectors from skinny-c reference implementation
      // User-provided test vector (b72209464676ba25 for all-zero input) has NOT been verified
      //  against official sources and is not included until verification is possible.
      this.tests = [
        {
          text: "MANTIS-7 Official Test Vector (skinny-c)",
          uri: "https://github.com/rweather/skinny-c",
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
   * @returns {Object} New cipher instance
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._tweak = null;
      this._k0 = null;
      this._k1 = null;
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16 bytes)`);
      }

      this._key = [...keyBytes];

      // Split key: k = k0 || k1 (each 64 bits = 8 bytes)
      this._k0 = keyBytes.slice(0, 8);
      this._k1 = keyBytes.slice(8, 16);

      // k' = 1-bit right rotation of k0 with XOR (from skinny-c mantis_unpack_rotated_block)
      this._kPrime = new Array(8);
      let carry = this._k0[7];
      for (let index = 0; index < 8; ++index) {
        const next = this._k0[index];
        this._kPrime[index] = ((carry << 7) | (next >> 1)) & 0xFF;
        carry = next;
      }
      this._kPrime[7] ^= (this._k0[0] >> 7);

      // For decryption (inverse), implement α-reflexivity property:
      // - Swap k0 and k' (k0 becomes rotated, k' becomes original)
      // - XOR k1 with ALPHA constant (critical for correct decryption)
      if (this.isInverse) {
        const temp = this._k0;
        this._k0 = this._kPrime;
        this._kPrime = temp;

        // XOR k1 with ALPHA for decryption mode
        for (let i = 0; i < 8; ++i) {
          this._k1[i] ^= ALPHA[i];
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

    set tweak(tweakBytes) {
      if (!tweakBytes) {
        this._tweak = null;
        return;
      }

      if (tweakBytes.length !== 8) {
        throw new Error(`Invalid tweak size: ${tweakBytes.length} bytes (expected 8 bytes)`);
      }

      this._tweak = [...tweakBytes];
    }

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
      this.inputBuffer.push(...data);
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
        throw new Error(`Invalid input length: ${this.inputBuffer.length} bytes (must be multiple of 8)`);
      }

      const output = [];
      const numBlocks = this.inputBuffer.length / 8;

      for (let b = 0; b < numBlocks; ++b) {
        const block = this.inputBuffer.slice(b * 8, (b + 1) * 8);
        const processed = this.processBlock(block);
        output.push(...processed);
      }

      this.inputBuffer = [];
      return output;
    }

    processBlock(block) {
      // State is 8 bytes
      let state = [...block];
      let tweakBytes = this._tweak || new Array(8).fill(0);

      // Initial whitening: state XOR k0 XOR k1 XOR tweak (from skinny-c)
      for (let i = 0; i < 8; ++i) {
        state[i] ^= this._k0[i];
      }
      for (let i = 0; i < 8; ++i) {
        state[i] ^= this._k1[i];
      }
      for (let i = 0; i < 8; ++i) {
        state[i] ^= tweakBytes[i];
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
          state[i] ^= RC[r][i];
        }

        // XOR k1 and tweak
        for (let i = 0; i < 8; ++i) {
          state[i] ^= this._k1[i] ^ tweakBytes[i];
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
      const k1Modified = new Array(8);
      for (let i = 0; i < 8; ++i) {
        k1Modified[i] = this._k1[i] ^ ALPHA[i];
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
          state[i] ^= k1Modified[i] ^ tweakBytes[i];
        }

        // Add round constant
        for (let i = 0; i < 8; ++i) {
          state[i] ^= RC[r][i];
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
        state[i] ^= this._kPrime[i];
      }
      for (let i = 0; i < 8; ++i) {
        state[i] ^= k1Modified[i];
      }
      for (let i = 0; i < 8; ++i) {
        state[i] ^= tweakBytes[i];
      }

      return state;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Mantis());

  return Mantis;
}));
