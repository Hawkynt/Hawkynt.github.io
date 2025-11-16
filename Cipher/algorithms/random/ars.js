/*
 * ARS (AES-based Random Stream) Counter-Based Pseudo-Random Number Generator
 * From the Random123 library by D. E. Shaw Research
 *
 * ARS is a counter-based PRNG using the full AES round function (SubBytes + ShiftRows + MixColumns)
 * with a simplified Weyl-sequence key schedule instead of the complex AES key expansion.
 *
 * Key features:
 * - Counter-based (no internal state, pure function of counter+key)
 * - Trivially parallelizable (any counter can be computed independently)
 * - Period: 2^128
 * - Uses full AES round function for diffusion
 * - Non-cryptographic Weyl-sequence key schedule for performance
 *
 * Reference: "Parallel Random Numbers: As Easy as 1, 2, 3"
 * John K. Salmon, Mark A. Moraes, Ron O. Dror, David E. Shaw
 * SC11, November 2011
 *
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          RandomGenerationAlgorithm, IRandomGeneratorInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // Standard AES/Rijndael S-box (used in SubBytes transformation)
  const AES_SBOX = new Uint8Array([
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ]);

  /**
   * Apply AES SubBytes transformation to 16-byte state
   * Substitutes each byte using the AES S-box
   */
  function subBytes(state) {
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = AES_SBOX[state[i]];
    }
    return result;
  }

  /**
   * Apply AES ShiftRows transformation to 16-byte state (in-place)
   * State is viewed as 4x4 column-major matrix:
   * [0  4  8  12]
   * [1  5  9  13]
   * [2  6  10 14]
   * [3  7  11 15]
   *
   * ShiftRows rotates each row left by its row number:
   * Row 0: no shift
   * Row 1: shift left 1 position
   * Row 2: shift left 2 positions
   * Row 3: shift left 3 positions
   */
  function shiftRows(state) {
    // Row 1: shift left 1
    let temp = state[1];
    state[1] = state[5];
    state[5] = state[9];
    state[9] = state[13];
    state[13] = temp;

    // Row 2: shift left 2
    temp = state[2];
    state[2] = state[10];
    state[10] = temp;
    temp = state[6];
    state[6] = state[14];
    state[14] = temp;

    // Row 3: shift left 3 (= shift right 1)
    temp = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = state[3];
    state[3] = temp;
  }

  /**
   * Apply AES MixColumns transformation to 16-byte state (in-place)
   * Operates on columns using Galois Field multiplication
   */
  function mixColumns(state) {
    for (let col = 0; col < 4; ++col) {
      const base = col * 4;
      const s0 = state[base];
      const s1 = state[base + 1];
      const s2 = state[base + 2];
      const s3 = state[base + 3];

      state[base] = (
        OpCodes.GF256Mul(s0, 2) ^ OpCodes.GF256Mul(s1, 3) ^ s2 ^ s3
      ) & 0xFF;
      state[base + 1] = (
        s0 ^ OpCodes.GF256Mul(s1, 2) ^ OpCodes.GF256Mul(s2, 3) ^ s3
      ) & 0xFF;
      state[base + 2] = (
        s0 ^ s1 ^ OpCodes.GF256Mul(s2, 2) ^ OpCodes.GF256Mul(s3, 3)
      ) & 0xFF;
      state[base + 3] = (
        OpCodes.GF256Mul(s0, 3) ^ s1 ^ s2 ^ OpCodes.GF256Mul(s3, 2)
      ) & 0xFF;
    }
  }

  /**
   * Apply AES round function (SubBytes + ShiftRows + MixColumns + AddRoundKey)
   * This is the full AES round, not simplified
   */
  function aesRound(state, roundKey, isFinal) {
    // Apply SubBytes (S-box substitution)
    for (let i = 0; i < 16; ++i) {
      state[i] = AES_SBOX[state[i]];
    }

    // Apply ShiftRows (byte permutation)
    shiftRows(state);

    // Apply MixColumns (unless final round)
    if (!isFinal) {
      mixColumns(state);
    }

    // XOR with round key (AddRoundKey)
    for (let i = 0; i < 16; ++i) {
      state[i] ^= roundKey[i];
    }
  }

  /**
   * Weyl sequence constants for ARS key schedule
   * Based on golden ratio and sqrt(3)-1
   * These are 64-bit constants, stored as 8 bytes each in little-endian
   */
  const WEYL_CONSTANT = [
    // 0x9E3779B97F4A7C15 (golden ratio * 2^64)
    0x15, 0x7C, 0x4A, 0x7F, 0xB9, 0x79, 0x37, 0x9E,
    // 0xBB67AE8584CAA73B (sqrt(3)-1 * 2^64)
    0x3B, 0xA7, 0xCA, 0x84, 0x85, 0xAE, 0x67, 0xBB
  ];

  /**
   * Add Weyl constant to key (treat as two 64-bit integers, little-endian)
   */
  function addWeylConstant(key) {
    const result = new Array(16);

    // Add first 64-bit word (bytes 0-7)
    let carry = 0;
    for (let i = 0; i < 8; ++i) {
      const sum = key[i] + WEYL_CONSTANT[i] + carry;
      result[i] = sum & 0xFF;
      carry = sum >>> 8;
    }

    // Add second 64-bit word (bytes 8-15)
    carry = 0;
    for (let i = 8; i < 16; ++i) {
      const sum = key[i] + WEYL_CONSTANT[i] + carry;
      result[i] = sum & 0xFF;
      carry = sum >>> 8;
    }

    return result;
  }

  /**
   * ARS transformation with specified number of rounds
   *
   * @param {Array} counter - 16-byte counter value
   * @param {Array} key - 16-byte key value
   * @param {number} numRounds - Number of rounds (typically 5 or 7)
   * @returns {Array} 16-byte output
   */
  function ars(counter, key, numRounds) {
    // Initialize state with counter XOR key (initial whitening)
    const state = new Array(16);
    for (let i = 0; i < 16; ++i) {
      state[i] = counter[i] ^ key[i];
    }

    // Current round key starts with the input key
    let currentKey = [...key];

    // Apply rounds
    for (let round = 0; round < numRounds; ++round) {
      // Add Weyl constant to generate next round key
      currentKey = addWeylConstant(currentKey);

      // Apply AES round function
      // Last round omits MixColumns per AES specification
      const isFinal = (round === numRounds - 1);
      aesRound(state, currentKey, isFinal);
    }

    return state;
  }

  class ARSAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ARS (AES-based Random Stream)";
      this.description = "Counter-based PRNG using full AES round function with simplified Weyl-sequence key schedule. Designed for parallel computing with cryptographic-quality randomness. Part of the Random123 library by D. E. Shaw Research.";
      this.inventor = "John K. Salmon, Mark A. Moraes, Ron O. Dror, David E. Shaw";
      this.year = 2011;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Counter-Based PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.IsCounterBased = true; // Special property: no state, pure function
      this.SupportedKeySizes = [new KeySize(16, 16, 1)]; // 128-bit key (16 bytes)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: Parallel Random Numbers: As Easy as 1, 2, 3 (SC11, 2011)",
          "https://www.thesalmons.org/john/random123/papers/random123sc11.pdf"
        ),
        new LinkItem(
          "Random123 Library Documentation",
          "https://www.thesalmons.org/john/random123/releases/latest/docs/index.html"
        ),
        new LinkItem(
          "Random123 GitHub Repository",
          "https://github.com/DEShawResearch/random123"
        ),
        new LinkItem(
          "ARS Header Reference",
          "https://www.thesalmons.org/john/random123/releases/1.08/docs/ars_8h_source.html"
        )
      ];

      this.references = [
        new LinkItem(
          "NIST FIPS 197: AES Specification",
          "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf"
        ),
        new LinkItem(
          "AES Round Functions Explanation",
          "https://en.wikipedia.org/wiki/Advanced_Encryption_Standard#Description_of_the_cipher"
        )
      ];

      // Official test vectors from Random123 kat_vectors file
      // kat_vectors format: ars4x32 ROUNDS CTR[0] CTR[1] CTR[2] CTR[3] KEY[0] KEY[1] KEY[2] KEY[3]   OUTPUT[0] OUTPUT[1] OUTPUT[2] OUTPUT[3]
      // All values are 32-bit big-endian words
      // Source: https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors
      this.tests = [
        {
          text: "ARS4x32-10: Counter=0, Key=0 - Random123 kat_vectors",
          uri: "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
          // kat_vectors line: ars4x32 10 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000   8d73ee19 506401ef 13c2dbe4 0cbe9c0d
          // Counter (4 BE words): 00000000 00000000 00000000 00000000
          // As LE bytes: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          // Key (4 BE words): 00000000 00000000 00000000 00000000
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          rounds: 10,
          outputSize: 16,
          // Output (4 BE words): 8d73ee19 506401ef 13c2dbe4 0cbe9c0d
          // As LE bytes: 19 ee 73 8d ef 01 64 50 e4 db c2 13 0d 9c be 0c
          expected: OpCodes.Hex8ToBytes("19ee738def016450e4dbc2130d9cbe0c")
        },
        {
          text: "ARS4x32-10: Counter=π digits, Key=π digits - Random123 kat_vectors",
          uri: "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
          // kat_vectors line: ars4x32 10 243f6a88 85a308d3 13198a2e 03707344 a4093822 299f31d0 082efa98 ec4e6c89   a516e7d6 8357ad74 5b59b3ec 8763fff3
          // Counter (4 BE words): 243f6a88 85a308d3 13198a2e 03707344
          input: OpCodes.Hex8ToBytes("886a3f24d308a3852e8a191344737003"),
          // Key (4 BE words): a4093822 299f31d0 082efa98 ec4e6c89
          key: OpCodes.Hex8ToBytes("223809a4d0319f2998fa2e08896c4eec"),
          rounds: 10,
          outputSize: 16,
          // Output (4 BE words): a516e7d6 8357ad74 5b59b3ec 8763fff3
          expected: OpCodes.Hex8ToBytes("d6e716a574ad5783ecb3595bf3ff6387")
        },
        {
          text: "ARS4x32-10: Counter=0xFFFFFFFF (all), Key=mixed - Random123 kat_vectors",
          uri: "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
          // kat_vectors line: ars4x32 10 ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff 00000000 00000000   bb3743b1 9f635551 ecbc87fc a19478a9
          // Counter (4 BE words): ffffffff ffffffff ffffffff ffffffff
          input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          // Key (4 BE words): ffffffff ffffffff 00000000 00000000
          key: OpCodes.Hex8ToBytes("ffffffffffffffff0000000000000000"),
          rounds: 10,
          outputSize: 16,
          // Output (4 BE words): bb3743b1 9f635551 ecbc87fc a19478a9
          expected: OpCodes.Hex8ToBytes("b14337bb5155639ffc87bceca97894a1")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Counter-based PRNGs have no inverse operation
      }
      return new ARSInstance(this);
    }
  }

  /**
 * ARS cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ARSInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Key (16 bytes)
      this._key = new Array(16).fill(0);
      this._ready = false;

      // Counter state (16 bytes)
      this._counter = new Array(16).fill(0);

      // Number of rounds (default 7, Random123 typically uses 7 or 10)
      this._rounds = 7;

      // Buffer for partial output
      this._buffer = [];
      this._bufferPos = 0;
    }

    /**
     * Set key value (16 bytes)
     */
    set key(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        this._ready = false;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16 bytes)`);
      }

      // Copy key bytes
      this._key = [...keyBytes];
      this._ready = true;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return null; // Cannot retrieve key
    }

    /**
     * Set counter value (16 bytes)
     * For counter-based PRNGs, the "seed" is actually the initial counter value
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._counter = new Array(16).fill(0);
        return;
      }

      if (seedBytes.length !== 16) {
        throw new Error(`Invalid counter size: ${seedBytes.length} bytes (expected 16 bytes)`);
      }

      // Copy counter bytes
      this._counter = [...seedBytes];

      // Clear buffer when counter changes
      this._buffer = [];
      this._bufferPos = 0;
    }

    get seed() {
      return null; // Cannot retrieve seed/counter
    }

    /**
     * Set number of rounds (1-10, typically 7 or 10)
     */
    set rounds(numRounds) {
      if (numRounds < 1 || numRounds > 10) {
        throw new Error(`Invalid rounds: ${numRounds} (expected 1-10)`);
      }
      this._rounds = numRounds;
    }

    get rounds() {
      return this._rounds;
    }

    /**
     * Increment the counter (for sequential generation)
     */
    _incrementCounter() {
      // Increment as a 128-bit little-endian integer
      for (let i = 0; i < 16; ++i) {
        this._counter[i] = (this._counter[i] + 1) & 0xFF;
        if (this._counter[i] !== 0) {
          break; // No carry, done
        }
        // Carry to next byte
      }
    }

    /**
     * Generate one block (16 bytes) from current counter
     */
    _generateBlock() {
      if (!this._ready) {
        throw new Error('ARS not initialized: set key first');
      }

      // Apply ARS transformation to current counter
      const result = ars(this._counter, this._key, this._rounds);

      // Increment counter for next block
      this._incrementCounter();

      return result;
    }

    /**
     * Generate random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('ARS not initialized: set key first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let remaining = length;

      // Use buffered bytes first
      while (this._bufferPos < this._buffer.length && remaining > 0) {
        output.push(this._buffer[this._bufferPos++]);
        --remaining;
      }

      // Generate new blocks as needed
      while (remaining > 0) {
        this._buffer = this._generateBlock();
        this._bufferPos = 0;

        const bytesToCopy = Math.min(remaining, this._buffer.length);
        for (let i = 0; i < bytesToCopy; ++i) {
          output.push(this._buffer[this._bufferPos++]);
        }
        remaining -= bytesToCopy;
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      // For counter-based PRNG, Feed sets the counter/seed
      if (data && data.length > 0) {
        this.seed = data;
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const size = this._outputSize || 16; // Default to one block
      return this.NextBytes(size);
    }

    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize || 16;
    }
  }

  // Register algorithm
  const algorithmInstance = new ARSAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { ARSAlgorithm, ARSInstance };
}));
