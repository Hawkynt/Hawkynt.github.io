/*
 * SparkleHash (Esch256) - NIST LWC Finalist Lightweight Hash Function
 * Professional implementation following NIST LWC specification
 * (c)2006-2025 Hawkynt
 *
 * SparkleHash is based on the Sparkle permutation, a finalist in NIST's Lightweight Cryptography competition.
 * This implementation provides Esch256, producing 256-bit hash outputs.
 * Reference: https://sparkle-lwc.github.io/
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

  // Sparkle round constants
  /** @type {uint32[]} */
  const RCON = [
    0xB7E15162, 0xBF715880, 0x38B4DA56, 0x324E7738,
    0xBB1185EB, 0x4F7C7B57, 0xCFBFA1C8, 0xC2B3293D
  ];

  // Esch256 parameters
  const RATE_BYTES = 16;
  const RATE_WORDS = 4;
  const DIGEST_BYTES = 32;
  const SPARKLE_STEPS_SLIM = 7;
  const SPARKLE_STEPS_BIG = 11;
  const STATE_WORDS = 12;

  /**
   * ARXBox operation: ADD, ROTATE, XOR
   * @param {uint32} rc - Round constant
   * @param {uint32[]} branch - The two state words [s00, s01], updated in place
   * @returns {void}
   */
  function ArxBox(rc, branch) {
    let s00 = branch[0];
    let s01 = branch[1];
    s00 = OpCodes.Add32(s00, OpCodes.RotR32(s01, 31));
    s01 = OpCodes.Xor32(s01, OpCodes.RotR32(s00, 24));
    s00 = OpCodes.Xor32(s00, rc);
    s00 = OpCodes.Add32(s00, OpCodes.RotR32(s01, 17));
    s01 = OpCodes.Xor32(s01, OpCodes.RotR32(s00, 17));
    s00 = OpCodes.Xor32(s00, rc);
    s00 = OpCodes.Add32(s00, s01);
    s01 = OpCodes.Xor32(s01, OpCodes.RotR32(s00, 31));
    s00 = OpCodes.Xor32(s00, rc);
    s00 = OpCodes.Add32(s00, OpCodes.RotR32(s01, 24));
    s01 = OpCodes.Xor32(s01, OpCodes.RotR32(s00, 16));
    s00 = OpCodes.Xor32(s00, rc);
    branch[0] = s00;
    branch[1] = s01;
  }

  /**
   * ELL function: Linear layer mixing operation
   * @param {uint32} x - Input word
   * @returns {uint32} Mixed word
   */
  function ELL(x) {
    return OpCodes.Xor32(OpCodes.RotR32(x, 16), OpCodes.And32(x, 0xFFFF));
  }

  /**
   * Sparkle permutation for 384-bit state (12 words)
   * @param {uint32[]} state - 12-word state array (modified in place)
   * @param {int32} steps - Number of steps (7 or 11)
   * @returns {void}
   */
  function SparkleOpt12(state, steps) {
    let s00 = state[0];
    let s01 = state[1];
    let s02 = state[2];
    let s03 = state[3];
    let s04 = state[4];
    let s05 = state[5];
    let s06 = state[6];
    let s07 = state[7];
    let s08 = state[8];
    let s09 = state[9];
    let s10 = state[10];
    let s11 = state[11];
    /** @type {uint32[]} */
    const branch = [0, 0];

    for (let step = 0; step < steps; ++step) {
      // Add round constant
      s01 = OpCodes.Xor32(s01, RCON[step&7]);
      s03 = OpCodes.Xor32(s03, step);

      // ARXBox layer
      branch[0] = s00; branch[1] = s01;
      ArxBox(RCON[0], branch);
      s00 = branch[0];
      s01 = branch[1];

      branch[0] = s02; branch[1] = s03;
      ArxBox(RCON[1], branch);
      s02 = branch[0];
      s03 = branch[1];

      branch[0] = s04; branch[1] = s05;
      ArxBox(RCON[2], branch);
      s04 = branch[0];
      s05 = branch[1];

      branch[0] = s06; branch[1] = s07;
      ArxBox(RCON[3], branch);
      s06 = branch[0];
      s07 = branch[1];

      branch[0] = s08; branch[1] = s09;
      ArxBox(RCON[4], branch);
      s08 = branch[0];
      s09 = branch[1];

      branch[0] = s10; branch[1] = s11;
      ArxBox(RCON[5], branch);
      s10 = branch[0];
      s11 = branch[1];

      // Linear layer
      const t024 = ELL(OpCodes.Xor32(OpCodes.Xor32(s00, s02), s04));
      const t135 = ELL(OpCodes.Xor32(OpCodes.Xor32(s01, s03), s05));

      const u00 = OpCodes.Xor32(s00, s06);
      const u01 = OpCodes.Xor32(s01, s07);
      const u02 = OpCodes.Xor32(s02, s08);
      const u03 = OpCodes.Xor32(s03, s09);
      const u04 = OpCodes.Xor32(s04, s10);
      const u05 = OpCodes.Xor32(s05, s11);

      s06 = s00;
      s07 = s01;
      s08 = s02;
      s09 = s03;
      s10 = s04;
      s11 = s05;

      s00 = OpCodes.Xor32(u02, t135);
      s01 = OpCodes.Xor32(u03, t024);
      s02 = OpCodes.Xor32(u04, t135);
      s03 = OpCodes.Xor32(u05, t024);
      s04 = OpCodes.Xor32(u00, t135);
      s05 = OpCodes.Xor32(u01, t024);
    }

    state[0] = OpCodes.ToUint32(s00);
    state[1] = OpCodes.ToUint32(s01);
    state[2] = OpCodes.ToUint32(s02);
    state[3] = OpCodes.ToUint32(s03);
    state[4] = OpCodes.ToUint32(s04);
    state[5] = OpCodes.ToUint32(s05);
    state[6] = OpCodes.ToUint32(s06);
    state[7] = OpCodes.ToUint32(s07);
    state[8] = OpCodes.ToUint32(s08);
    state[9] = OpCodes.ToUint32(s09);
    state[10] = OpCodes.ToUint32(s10);
    state[11] = OpCodes.ToUint32(s11);
  }

  /**
 * SparkleHash - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class SparkleHash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "SparkleHash";
      this.description = "NIST Lightweight Cryptography finalist based on the Sparkle permutation. Provides 256-bit hash output (Esch256 variant) with efficient performance on constrained devices.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AT;

      this.SupportedOutputSizes = [new KeySize(32, 32, 1)];

      this.documentation = [
        new LinkItem(
          "NIST LWC Sparkle Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf"
        ),
        new LinkItem(
          "Sparkle Project Website",
          "https://sparkle-lwc.github.io/"
        )
      ];

      this.references = [
        new LinkItem(
          "Official Sparkle/Esch reference implementation (cryptolu/sparkle)",
          "https://github.com/cryptolu/sparkle"
        )
      ];

      // Official NIST test vectors from LWC_HASH_KAT_256.txt
      this.tests = [
        {
          text: "Esch256: Empty message (NIST LWC KAT)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("C0E815D78B875DC768C6C8B3AFA51987CD69E5C087D387368628A511CFAD5730")
        },
        {
          text: "Esch256: Single byte 0x00 (NIST LWC KAT)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("D515FD9C2852D9D6F00C9CF01D858AF467EEDF21FF68CC14C005B3EFF7A6ECD3")
        },
        {
          text: "Esch256: Two bytes 0x0001 (NIST LWC KAT)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("FBCAD7AB77FD4CC844534D2716D08C092B40B86E00647ECAA429AFDFE3B3FC43")
        },
        {
          text: "Esch256: Three bytes 0x000102 (NIST LWC KAT)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("F33561BA7DCF690E4E1C519B28712A878028417A3974873F188AE33B289FCAB6")
        },
        {
          text: "Esch256: Four bytes 0x00010203 (NIST LWC KAT)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("649D3E5258E504EF842A7176108D36A823E751D5E0EE31E3FAF111415BB9BBC2")
        },
        {
          text: "Esch256: 16 bytes (full rate) (NIST LWC KAT)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("ACFF841E2A526D83D6E94AB5564D6D64C98F5E8016BB1C2950386ED156C6C174")
        },
        {
          text: "Esch256: 32 bytes (NIST LWC KAT)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("78B905B2E2D4110B76EF8AFD2495F58AD6FFD6B9727377F3E5DFCEEBF3031E24")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {SparkleHashInstance} New hash instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new SparkleHashInstance(this);
    }
  }

  /**
 * SparkleHash cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SparkleHashInstance extends IHashFunctionInstance {
    /**
     * Initialize a SparkleHash instance
     * @param {SparkleHash} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);

      // State is 12 words (384 bits)
      /** @type {uint32[]} */
      this.state = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      /** @type {uint8[]} */
      this.buffer = OpCodes.CreateArray(RATE_BYTES, 0);
      /** @type {int32} */
      this.bufferPos = 0;
      /** @type {int32} */
      this._outputSize = DIGEST_BYTES;
    }

    /**
     * Set the digest size (only 32 bytes is supported)
     * @param {int32} size - Digest size in bytes
     */
    set outputSize(size) {
      if (size !== DIGEST_BYTES) {
        throw new Error('Invalid output size: ' + size + ' bytes (only 32 supported for Esch256)');
      }
      this._outputSize = size;
    }

    /**
     * Digest size in bytes
     * @returns {int32} Always 32
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @returns {void}
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; ++i) {
        if (this.bufferPos === RATE_BYTES) {
          this._processBlock(this.buffer, SPARKLE_STEPS_SLIM);
          this.bufferPos = 0;
        }
        this.buffer[this.bufferPos++] = data[i];
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Addition of constant M1 or M2 to the state
      const midStateIndex = OpCodes.Sub32(OpCodes.Shr32(STATE_WORDS, 1), 1); // 12/2 - 1 = 5
      if (this.bufferPos < RATE_BYTES) {
        // M1: incomplete block
        this.state[midStateIndex] = OpCodes.Xor32(this.state[midStateIndex], OpCodes.Shl32(1, 24));

        // Padding: append 0x80 followed by zeros
        this.buffer[this.bufferPos] = 0x80;
        for (let i = this.bufferPos + 1; i < RATE_BYTES; ++i) {
          this.buffer[i] = 0x00;
        }
      } else {
        // M2: complete block
        this.state[midStateIndex] = OpCodes.Xor32(this.state[midStateIndex], OpCodes.Shl32(1, 25));
      }

      // Process final block with BIG steps
      this._processBlock(this.buffer, SPARKLE_STEPS_BIG);

      // Extract first rate-sized output (16 bytes)
      /** @type {uint8[]} */
      const output = new Array(DIGEST_BYTES);
      for (let i = 0; i < RATE_WORDS; ++i) {
        const word = this.state[i];
        output[i * 4 + 0] = word&0xFF;
        output[i * 4 + 1] = OpCodes.Shr32(word, 8)&0xFF;
        output[i * 4 + 2] = OpCodes.Shr32(word, 16)&0xFF;
        output[i * 4 + 3] = OpCodes.Shr32(word, 24)&0xFF;
      }

      // Second extraction: apply slim permutation and extract next 16 bytes
      SparkleOpt12(this.state, SPARKLE_STEPS_SLIM);
      for (let i = 0; i < RATE_WORDS; ++i) {
        const word = this.state[i];
        output[16 + i * 4 + 0] = word&0xFF;
        output[16 + i * 4 + 1] = OpCodes.Shr32(word, 8)&0xFF;
        output[16 + i * 4 + 2] = OpCodes.Shr32(word, 16)&0xFF;
        output[16 + i * 4 + 3] = OpCodes.Shr32(word, 24)&0xFF;
      }

      // Reset for next operation
      this.state.fill(0);
      this.buffer.fill(0);
      this.bufferPos = 0;

      return output;
    }

    /**
     * Process a block of data
     * @param {uint8[]} block - RATE_BYTES block
     * @param {int32} steps - Number of permutation steps
     * @private
     * @returns {void}
     */
    _processBlock(block, steps) {
      // Unpack block to words (little-endian)
      const t0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      const t1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const t2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      const t3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      // Addition of buffer block to state using Feistel function
      const tx = ELL(OpCodes.Xor32(t0, t2));
      const ty = ELL(OpCodes.Xor32(t1, t3));

      this.state[0] = OpCodes.Xor32(this.state[0], OpCodes.Xor32(t0, ty));
      this.state[1] = OpCodes.Xor32(this.state[1], OpCodes.Xor32(t1, tx));
      this.state[2] = OpCodes.Xor32(this.state[2], OpCodes.Xor32(t2, ty));
      this.state[3] = OpCodes.Xor32(this.state[3], OpCodes.Xor32(t3, tx));
      this.state[4] = OpCodes.Xor32(this.state[4], ty);
      this.state[5] = OpCodes.Xor32(this.state[5], tx);

      // Apply Sparkle permutation
      SparkleOpt12(this.state, steps);
    }
  }

  RegisterAlgorithm(new SparkleHash());
  return SparkleHash;
}));
