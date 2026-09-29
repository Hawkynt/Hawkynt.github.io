/*
 * PRESENT Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * PRESENT - Lightweight block cipher for constrained environments
 * 64-bit blocks with 80-bit keys, 31 rounds
 * Substitution-Permutation Network (SPN) structure
 */

// Load AlgorithmFramework (REQUIRED)

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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  // PRESENT bit permutation table (official specification)
  /** @type {uint8[]} */
  const PRESENT_P = [
    0,16,32,48,1,17,33,49,2,18,34,50,3,19,35,51,4,
    20,36,52,5,21,37,53,6,22,38,54,7,23,39,55,8,24,
    40,56,9,25,41,57,10,26,42,58,11,27,43,59,12,28,
    44,60,13,29,45,61,14,30,46,62,15,31,47,63
  ];
  Object.freeze(PRESENT_P);

  /**
 * PresentAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class PresentAlgorithm extends BlockCipherAlgorithm {
    /**
     * @param {string} [variant='80'] - '80' or '128' (key size in bits)
     */
    constructor(variant = '80') {
      super();

      // Variant-specific configuration ('128', anything else is PRESENT-80)
      let keySize = 10;
      let variantBits = 80;
      if (variant === '128') {
        this.description = "PRESENT-128 variant of the lightweight block cipher with extended 128-bit key size. Substitution-Permutation Network with 64-bit blocks, 128-bit keys, and 31 rounds. Educational implementation extending the ISO/IEC 29192-2 specification.";
        this.SupportedKeySizes = [new KeySize(16, 16, 0)];
        this.documentation = [
          new LinkItem("PRESENT-128 Extension", "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31"),
          new LinkItem("PRESENT Specification", "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31"),
          new LinkItem("Wikipedia - PRESENT", "https://en.wikipedia.org/wiki/PRESENT")
        ];
        this.tests = [
          {
            text: "PRESENT-128 all zeros test vector - educational",
            uri: "https://crypto.stackexchange.com/questions/70906/where-can-i-find-test-vectors-for-the-present-cipher-with-a-128-bit-key",
            input: OpCodes.Hex8ToBytes("0000000000000000"),
            key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
            expected: OpCodes.Hex8ToBytes("96db702a2e6900af")
          },
          {
            text: "PRESENT-128 pattern test vector - educational",
            uri: "https://crypto.stackexchange.com/questions/70906/where-can-i-find-test-vectors-for-the-present-cipher-with-a-128-bit-key",
            input: OpCodes.Hex8ToBytes("0000000000000000"),
            key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
            expected: OpCodes.Hex8ToBytes("13238c710272a5d8")
          },
          {
            text: "PRESENT-128 all-ones plaintext, zero key",
            uri: "https://crypto.stackexchange.com/questions/70906/where-can-i-find-test-vectors-for-the-present-cipher-with-a-128-bit-key",
            input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
            key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
            expected: OpCodes.Hex8ToBytes("3c6019e5e5edd563")
          },
          {
            text: "PRESENT-128 all-ones plaintext and key",
            uri: "https://crypto.stackexchange.com/questions/70906/where-can-i-find-test-vectors-for-the-present-cipher-with-a-128-bit-key",
            input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
            key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
            expected: OpCodes.Hex8ToBytes("628d9fbd4218e5b4")
          }
        ];
        keySize = 16;      // bytes
        variantBits = 128;
      } else {
        this.description = "PRESENT-80 lightweight block cipher designed for constrained environments. Substitution-Permutation Network with 64-bit blocks, 80-bit keys, and 31 rounds. Educational implementation following ISO/IEC 29192-2 specification.";
        this.SupportedKeySizes = [new KeySize(10, 10, 0)];
        this.documentation = [
          new LinkItem("ISO/IEC 29192-2:2019 - PRESENT", "https://www.iso.org/standard/56425.html"),
          new LinkItem("PRESENT Specification", "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31"),
          new LinkItem("Wikipedia - PRESENT", "https://en.wikipedia.org/wiki/PRESENT")
        ];
        this.tests = [
          {
            text: "PRESENT-80 all zeros test vector - educational",
            uri: "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31",
            input: OpCodes.Hex8ToBytes("0000000000000000"),
            key: OpCodes.Hex8ToBytes("00000000000000000000"),
            expected: OpCodes.Hex8ToBytes("5579c1387b228445")
          },
          {
            text: "PRESENT-80 pattern test vector - educational",
            uri: "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31",
            input: OpCodes.Hex8ToBytes("0000000000000000"),
            key: OpCodes.Hex8ToBytes("ffffffffffffffffffff"),
            expected: OpCodes.Hex8ToBytes("e72c46c0f5945049")
          },
          {
            text: "PRESENT-80 all-ones plaintext, zero key",
            uri: "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31",
            input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
            key: OpCodes.Hex8ToBytes("00000000000000000000"),
            expected: OpCodes.Hex8ToBytes("a112ffc72f68417b")
          },
          {
            text: "PRESENT-80 all-ones plaintext and key",
            uri: "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31",
            input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
            key: OpCodes.Hex8ToBytes("ffffffffffffffffffff"),
            expected: OpCodes.Hex8ToBytes("3333dcd3213210d2")
          }
        ];
        keySize = 10;      // bytes
        variantBits = 80;
      }

      // Required metadata
      this.name = "PRESENT-" + variant;
      this.inventor = "Andrey Bogdanov, Lars R. Knudsen, Gregor Leander, Christof Paar, Axel Poschmann, Matthew J.B. Robshaw, Yannick Seurin, C. Vikkelsoe";
      this.year = 2007;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BASIC;
      this.country = CountryCode.DE;

      // Algorithm-specific metadata
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0)    // 64-bit blocks only
      ];

      // References
      this.references = [
        new LinkItem("Original PRESENT Paper", "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31"),
        new LinkItem("Crypto++ PRESENT Implementation", "https://github.com/weidai11/cryptopp/blob/master/present.cpp"),
        new LinkItem("PRESENT Analysis", "https://eprint.iacr.org/2007/024.pdf"),
        new LinkItem("Lightweight Cryptography", "https://csrc.nist.gov/projects/lightweight-cryptography")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Linear cryptanalysis",
          "Susceptible to linear cryptanalytic attacks",
          "Use for educational purposes only in constrained environments"
        ),
        new Vulnerability(
          "Small block size",
          "64-bit block size vulnerable to birthday attacks",
          "Avoid encrypting large amounts of data with single key"
        )
      ];

      // PRESENT Constants
      /** @type {int32} */
      this.ROUNDS = 32;      // 32 total rounds (31 full + 1 final)
      /** @type {int32} */
      this.BLOCK_SIZE = 8;   // 64 bits
      /** @type {int32} */
      this.KEY_SIZE = keySize;         // bytes
      /** @type {int32} */
      this.VARIANT_BITS = variantBits; // bits

      // PRESENT S-Box (4-bit substitution)
      /** @type {uint8[]} */
      this.SBOX = [
        0xC, 0x5, 0x6, 0xB, 0x9, 0x0, 0xA, 0xD,
        0x3, 0xE, 0xF, 0x8, 0x4, 0x7, 0x1, 0x2
      ];

      // PRESENT Inverse S-Box
      /** @type {uint8[]} */
      this.SBOX_INV = [
        0x5, 0xE, 0xF, 0x8, 0xC, 0x1, 0x2, 0xD,
        0xB, 0x4, 0x6, 0x3, 0x0, 0x7, 0x9, 0xA
      ];
    }


    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {PresentInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PresentInstance(this, isInverse);
    }
  }

  /**
 * Present cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PresentInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {PresentAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {int32} */
      this._rounds = algorithm.ROUNDS;
      /** @type {int32} */
      this._keySize = algorithm.KEY_SIZE;
      /** @type {int32} */
      this._variantBits = algorithm.VARIANT_BITS;
      /** @type {uint8[]} */
      this._sbox = algorithm.SBOX;
      /** @type {uint8[]} */
      this._sboxInv = algorithm.SBOX_INV;
      this.key = null;
      // Round keys as [high32, low32] pairs
      /** @type {uint32[][]|null} */
      this.roundKeys = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 8;     // 64-bit blocks
      this.KeySize = 0;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size (variant-specific)
      if (keyBytes.length !== this._keySize) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. PRESENT-" + this._variantBits + " requires " + this._keySize + " bytes (" + this._variantBits + " bits)");
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.roundKeys = this._generateRoundKeys(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length for block cipher
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");
      }

      /** @type {uint8[]} */
      const output = [];
      const blockSize = this.BlockSize;

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlock(block) 
          : this._encryptBlock(block);
        for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("PRESENT requires exactly 8 bytes per block");
      }

      // Convert input to 64-bit state (as two 32-bit words)
      let state = this._bytesToState(block);

      // Apply 31 full rounds + 1 final round
      for (let round = 0; round < this._rounds - 1; round++) {
        // Add round key
        state = this._addRoundKey(state, this.roundKeys[round]);

        // Apply S-box layer
        state = this._sBoxLayer(state);

        // Apply permutation layer
        state = this._permutationLayer(state);
      }

      // Final round (only add round key)
      state = this._addRoundKey(state, this.roundKeys[this._rounds - 1]);

      return this._stateToBytes(state);
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("PRESENT requires exactly 8 bytes per block");
      }

      // Convert input to 64-bit state (as two 32-bit words)
      let state = this._bytesToState(block);

      // Remove final round key
      state = this._addRoundKey(state, this.roundKeys[this._rounds - 1]);

      // Apply 31 rounds in reverse
      for (let round = this._rounds - 2; round >= 0; round--) {
        // Apply inverse permutation layer
        state = this._invPermutationLayer(state);

        // Apply inverse S-box layer
        state = this._invSBoxLayer(state);

        // Add round key
        state = this._addRoundKey(state, this.roundKeys[round]);
      }

      return this._stateToBytes(state);
    }

    // Convert 8 bytes to 64-bit state (as two 32-bit words)
    /**
     * @param {uint8[]} bytes - 8 bytes
     * @returns {uint32[]} [high32, low32]
     */
    _bytesToState(bytes) {
      const high = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
      const low = OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7]);
      /** @type {uint32[]} */
      const state = [high, low];
      return state;
    }

    // Convert 64-bit state back to 8 bytes
    /**
     * @param {uint32[]} state - [high32, low32]
     * @returns {uint8[]} 8 bytes
     */
    _stateToBytes(state) {
      const highBytes = OpCodes.Unpack32BE(state[0]);
      const lowBytes = OpCodes.Unpack32BE(state[1]);
      /** @type {uint8[]} */
      const bytes = [...highBytes, ...lowBytes];
      return bytes;
    }

    // Add round key (XOR operation)
    /**
     * @param {uint32[]} state - [high32, low32]
     * @param {uint32[]} roundKey - [high32, low32]
     * @returns {uint32[]} New state
     */
    _addRoundKey(state, roundKey) {
      /** @type {uint32[]} */
      const out = [
        OpCodes.ToUint32(OpCodes.Xor32(state[0], roundKey[0])),
        OpCodes.ToUint32(OpCodes.Xor32(state[1], roundKey[1]))
      ];
      return out;
    }

    // Apply S-box to all 4-bit nibbles
    /**
     * @param {uint32[]} state - [high32, low32]
     * @returns {uint32[]} New state
     */
    _sBoxLayer(state) {
      /** @type {uint32[]} */
      const result = [0, 0];

      // Process high 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = OpCodes.And32(OpCodes.Shr32(state[0], 28 - i * 4), 0xF);
        const sboxValue = this._sbox[nibble];
        result[0] = OpCodes.Or32(result[0], OpCodes.Shl32(sboxValue, 28 - i * 4));
      }

      // Process low 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = OpCodes.And32(OpCodes.Shr32(state[1], 28 - i * 4), 0xF);
        const sboxValue = this._sbox[nibble];
        result[1] = OpCodes.Or32(result[1], OpCodes.Shl32(sboxValue, 28 - i * 4));
      }

      /** @type {uint32[]} */
      const out = [OpCodes.ToUint32(result[0]), OpCodes.ToUint32(result[1])];
      return out;
    }

    // Apply inverse S-box to all 4-bit nibbles
    /**
     * @param {uint32[]} state - [high32, low32]
     * @returns {uint32[]} New state
     */
    _invSBoxLayer(state) {
      /** @type {uint32[]} */
      const result = [0, 0];

      // Process high 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = OpCodes.And32(OpCodes.Shr32(state[0], 28 - i * 4), 0xF);
        const sboxValue = this._sboxInv[nibble];
        result[0] = OpCodes.Or32(result[0], OpCodes.Shl32(sboxValue, 28 - i * 4));
      }

      // Process low 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = OpCodes.And32(OpCodes.Shr32(state[1], 28 - i * 4), 0xF);
        const sboxValue = this._sboxInv[nibble];
        result[1] = OpCodes.Or32(result[1], OpCodes.Shl32(sboxValue, 28 - i * 4));
      }

      /** @type {uint32[]} */
      const out = [OpCodes.ToUint32(result[0]), OpCodes.ToUint32(result[1])];
      return out;
    }

    // Apply bit permutation layer following PRESENT specification
    /**
     * @param {uint32[]} state - [high32, low32]
     * @returns {uint32[]} New state
     */
    _permutationLayer(state) {
      const P = PRESENT_P;

      /** @type {uint32[]} */
      const result = [0, 0];

      // Extract all 64 bits into array for permutation
      /** @type {uint8[]} */
      const bits = new Array(64);
      for (let i = 0; i < 32; i++) {
        bits[i] = OpCodes.And32(OpCodes.Shr32(state[0], 31 - i), 1);
        bits[i + 32] = OpCodes.And32(OpCodes.Shr32(state[1], 31 - i), 1);
      }

      // Apply PRESENT permutation using lookup table
      /** @type {uint8[]} */
      const permutedBits = new Array(64);
      for (let i = 0; i < 64; i++) {
        permutedBits[P[i]] = bits[i];
      }

      // Reconstruct the 64-bit state from permuted bits
      for (let i = 0; i < 32; i++) {
        if (permutedBits[i]) {
          result[0] = OpCodes.Or32(result[0], OpCodes.Shl32(1, 31 - i));
        }
        if (permutedBits[i + 32]) {
          result[1] = OpCodes.Or32(result[1], OpCodes.Shl32(1, 31 - i));
        }
      }

      /** @type {uint32[]} */
      const out = [OpCodes.ToUint32(result[0]), OpCodes.ToUint32(result[1])];
      return out;
    }

    // Apply inverse bit permutation layer
    /**
     * @param {uint32[]} state - [high32, low32]
     * @returns {uint32[]} New state
     */
    _invPermutationLayer(state) {
      const P = PRESENT_P;

      // Build inverse permutation table
      /** @type {uint8[]} */
      const P_inv = new Array(64);
      for (let i = 0; i < 64; i++) {
        P_inv[P[i]] = i;
      }

      /** @type {uint32[]} */
      const result = [0, 0];

      // Extract all 64 bits into array for inverse permutation
      /** @type {uint8[]} */
      const bits = new Array(64);
      for (let i = 0; i < 32; i++) {
        bits[i] = OpCodes.And32(OpCodes.Shr32(state[0], 31 - i), 1);
        bits[i + 32] = OpCodes.And32(OpCodes.Shr32(state[1], 31 - i), 1);
      }

      // Apply inverse PRESENT permutation using inverse lookup table
      /** @type {uint8[]} */
      const permutedBits = new Array(64);
      for (let i = 0; i < 64; i++) {
        permutedBits[P_inv[i]] = bits[i];
      }

      // Reconstruct the 64-bit state from inverse permuted bits
      for (let i = 0; i < 32; i++) {
        if (permutedBits[i]) {
          result[0] = OpCodes.Or32(result[0], OpCodes.Shl32(1, 31 - i));
        }
        if (permutedBits[i + 32]) {
          result[1] = OpCodes.Or32(result[1], OpCodes.Shl32(1, 31 - i));
        }
      }

      /** @type {uint32[]} */
      const out = [OpCodes.ToUint32(result[0]), OpCodes.ToUint32(result[1])];
      return out;
    }

    // Generate round keys using PRESENT key schedule (variant-specific)
    /**
     * @param {uint8[]} keyBytes - Key bytes
     * @returns {uint32[][]} Round keys as [high32, low32]
     */
    _generateRoundKeys(keyBytes) {
      if (this._variantBits === 80) {
        return this._generateRoundKeys80(keyBytes);
      } else {
        return this._generateRoundKeys128(keyBytes);
      }
    }

    // Generate round keys for PRESENT-80
    /**
     * @param {uint8[]} keyBytes - Key bytes
     * @returns {uint32[][]} Round keys as [high32, low32]
     */
    _generateRoundKeys80(keyBytes) {
      /** @type {uint32[][]} */
      const roundKeys = [];

      // Convert key to 80-bit BigInt (big-endian)
      /** @type {bigint} */
      let key = BigInt(0);
      for (let i = 0; i < this._keySize; i++) {
        const byteValue = BigInt(OpCodes.And32(keyBytes[i], 0xFF));
        key = key * BigInt(256) + byteValue; // Build big-endian integer
      }

      // Generate 32 round keys (rounds 1-32)
      for (let round = 1; round <= this._rounds; round++) {
        // Extract 64-bit round key from leftmost bits (bits 79-16)
        const roundKey64 = OpCodes.ShiftRn(key, BigInt(16)); // Shift right by 16 to get top 64 bits

        // Split into high and low 32-bit words
        /** @type {uint32} */
        const roundKeyHigh = Number(OpCodes.AndN(OpCodes.ShiftRn(roundKey64, BigInt(32)), BigInt(0xFFFFFFFF)));
        /** @type {uint32} */
        const roundKeyLow = Number(OpCodes.AndN(roundKey64, BigInt(0xFFFFFFFF)));

        /** @type {uint32[]} */
        const roundKeyPair = [OpCodes.ToUint32(roundKeyHigh), OpCodes.ToUint32(roundKeyLow)];
        roundKeys[round - 1] = roundKeyPair;

        // Update key state for next round (if not last round)
        if (round < this._rounds) {
          // Step 1: Rotate left by 61 positions
          /** @type {bigint} */
          const mask = OpCodes.ShiftLn(BigInt(1), BigInt(19)) - BigInt(1); // 2^19 - 1
          const leftPart = OpCodes.ShiftRn(key, BigInt(19));
          const rightPart = OpCodes.ShiftLn(OpCodes.AndN(key, mask), BigInt(61));
          key = rightPart + leftPart;

          // Step 2: Apply S-box to leftmost 4 bits (bits 79-76)
          /** @type {int32} */
          const topNibble = Number(OpCodes.ShiftRn(key, BigInt(76)));
          const sboxValue = BigInt(this._sbox[topNibble]);

          // Replace top 4 bits
          const bottomPart = OpCodes.AndN(key, OpCodes.ShiftLn(BigInt(1), BigInt(76)) - BigInt(1));
          key = OpCodes.ShiftLn(sboxValue, BigInt(76)) + bottomPart;

          // Step 3: XOR bits with round counter at position 15
          const counterValue = OpCodes.ShiftLn(BigInt(round), BigInt(15));
          key = OpCodes.XorN(key, counterValue);

          // Ensure key stays within 80-bit range
          key = OpCodes.AndN(key, OpCodes.ShiftLn(BigInt(1), BigInt(80)) - BigInt(1));
        }
      }

      return roundKeys;
    }

    // Generate round keys for PRESENT-128
    /**
     * @param {uint8[]} keyBytes - Key bytes
     * @returns {uint32[][]} Round keys as [high32, low32]
     */
    _generateRoundKeys128(keyBytes) {
      /** @type {uint32[][]} */
      const roundKeys = [];

      // Convert 128-bit key to BigInt for proper bit manipulation
      /** @type {bigint} */
      let keyState = 0n;
      for (let i = 0; i < 16; i++) {
        keyState = OpCodes.OrN(OpCodes.ShiftLn(keyState, 8n), BigInt(keyBytes[i]));
      }

      // Generate 32 round keys (0-indexed for consistency with encryption loop)
      for (let round = 0; round < this._rounds; round++) {
        // Extract leftmost 64 bits as round key
        const roundKey = OpCodes.ShiftRn(keyState, 64n);

        // Convert BigInt round key to high/low 32-bit words
        /** @type {uint32} */
        const high = Number(OpCodes.AndN(OpCodes.ShiftRn(roundKey, 32n), 0xFFFFFFFFn));
        /** @type {uint32} */
        const low = Number(OpCodes.AndN(roundKey, 0xFFFFFFFFn));

        /** @type {uint32[]} */
        const roundKeyPair = [OpCodes.ToUint32(high), OpCodes.ToUint32(low)];
        roundKeys[round] = roundKeyPair;

        // Update key state for next round (if not last round)
        if (round < this._rounds - 1) {
          // Step 1: Rotate key left by 61 positions
          keyState = OpCodes.RotL128n(keyState, 61);

          // Step 2: Apply S-box to bits 127-124 (leftmost 4 bits)
          const leftmost4 = OpCodes.And32(Number(OpCodes.ShiftRn(keyState, 124n)), 0xF);
          const sboxed1 = BigInt(this._sbox[leftmost4]);
          keyState = OpCodes.OrN(OpCodes.AndN(keyState, OpCodes.ShiftLn(1n, 124n) - 1n), OpCodes.ShiftLn(sboxed1, 124n));

          // Step 3: Apply S-box to bits 123-120
          /** @type {int32} */
          const bits123_120 = Number(OpCodes.AndN(OpCodes.ShiftRn(keyState, 120n), 0xFn));
          const sboxed2 = BigInt(this._sbox[bits123_120]);
          /** @type {bigint} */
          const clearMask = ~OpCodes.ShiftLn(0xFn, 120n);
          keyState = OpCodes.OrN(OpCodes.AndN(keyState, clearMask), OpCodes.ShiftLn(sboxed2, 120n));

          // Step 4: XOR round counter with bits 66-62 (use 1-indexed round counter)
          const roundCounter = BigInt(OpCodes.And32(round + 1, 0x1F));
          keyState = OpCodes.XorN(keyState, OpCodes.ShiftLn(roundCounter, 62n));
        }
      }

      return roundKeys;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  // Register both PRESENT-80 and PRESENT-128 variants
  const present80 = new PresentAlgorithm('80');
  if (!AlgorithmFramework.Find(present80.name)) {
    RegisterAlgorithm(present80);
  }

  const present128 = new PresentAlgorithm('128');
  if (!AlgorithmFramework.Find(present128.name)) {
    RegisterAlgorithm(present128);
  }

  // ===== EXPORTS =====

  return { PresentAlgorithm, PresentInstance };
}));