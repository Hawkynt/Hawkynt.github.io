/*
 * PRESENT-128 Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * PRESENT-128 - Lightweight block cipher variant with 128-bit keys
 * 64-bit blocks with 128-bit keys, 31 rounds
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

  class Present128Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "PRESENT-128";
      this.description = "PRESENT-128 variant of the lightweight block cipher with extended 128-bit key size. Substitution-Permutation Network with 64-bit blocks, 128-bit keys, and 31 rounds. Educational implementation extending the ISO/IEC 29192-2 specification.";
      this.inventor = "Extended from Andrey Bogdanov, Lars R. Knudsen, Gregor Leander, Christof Paar, Axel Poschmann, Matthew J.B. Robshaw, Yannick Seurin, C. Vikkelsoe";
      this.year = 2007;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BASIC;
      this.country = CountryCode.DE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // PRESENT-128: 128-bit keys only
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0)    // 64-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("PRESENT-128 Extension", "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31"),
        new LinkItem("PRESENT Specification", "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31"),
        new LinkItem("Wikipedia - PRESENT", "https://en.wikipedia.org/wiki/PRESENT")
      ];

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

      // Test vectors using OpCodes byte arrays
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
        }
      ];

      // PRESENT Constants
      this.ROUNDS = 32;      // 32 total rounds (31 full + 1 final)
      this.BLOCK_SIZE = 8;   // 64 bits
      this.KEY_SIZE = 16;    // 128 bits

      // PRESENT S-Box (4-bit substitution)
      this.SBOX = [
        0xC, 0x5, 0x6, 0xB, 0x9, 0x0, 0xA, 0xD,
        0x3, 0xE, 0xF, 0x8, 0x4, 0x7, 0x1, 0x2
      ];

      // PRESENT Inverse S-Box
      this.SBOX_INV = [
        0x5, 0xE, 0xF, 0x8, 0xC, 0x1, 0x2, 0xD,
        0xB, 0x4, 0x6, 0x3, 0x0, 0x7, 0x9, 0xA
      ];
    }

    CreateInstance(isInverse = false) {
      return new Present128Instance(this, isInverse);
    }
  }

  class Present128Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8;     // 64-bit blocks
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size (128 bits / 16 bytes)
      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. PRESENT-128 requires 16 bytes (128 bits)`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.roundKeys = this._generateRoundKeys(keyBytes);
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length for block cipher
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];
      const blockSize = this.BlockSize;

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlock(block) 
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("PRESENT-128 requires exactly 8 bytes per block");
      }

      // Convert input to 64-bit state (as two 32-bit words)
      let state = this._bytesToState(block);

      // Apply 31 full rounds + 1 final round
      for (let round = 0; round < this.algorithm.ROUNDS - 1; round++) {
        // Add round key
        state = this._addRoundKey(state, this.roundKeys[round]);

        // Apply S-box layer
        state = this._sBoxLayer(state);

        // Apply permutation layer
        state = this._permutationLayer(state);
      }

      // Final round (only add round key)
      state = this._addRoundKey(state, this.roundKeys[this.algorithm.ROUNDS - 1]);

      return this._stateToBytes(state);
    }

    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("PRESENT-128 requires exactly 8 bytes per block");
      }

      // Convert input to 64-bit state (as two 32-bit words)
      let state = this._bytesToState(block);

      // Remove final round key
      state = this._addRoundKey(state, this.roundKeys[this.algorithm.ROUNDS - 1]);

      // Apply 31 rounds in reverse
      for (let round = this.algorithm.ROUNDS - 2; round >= 0; round--) {
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
    _bytesToState(bytes) {
      const high = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
      const low = OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7]);
      return { high: high, low: low };
    }

    // Convert 64-bit state back to 8 bytes
    _stateToBytes(state) {
      const highBytes = OpCodes.Unpack32BE(state.high);
      const lowBytes = OpCodes.Unpack32BE(state.low);
      return [...highBytes, ...lowBytes];
    }

    // Add round key (XOR operation)
    _addRoundKey(state, roundKey) {
      return {
        high: (state.high ^ roundKey.high) >>> 0,
        low: (state.low ^ roundKey.low) >>> 0
      };
    }

    // Apply S-box to all 4-bit nibbles
    _sBoxLayer(state) {
      let result = { high: 0, low: 0 };

      // Process high 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = (state.high >>> (28 - i * 4)) & 0xF;
        const sboxValue = this.algorithm.SBOX[nibble];
        result.high |= (sboxValue << (28 - i * 4));
      }

      // Process low 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = (state.low >>> (28 - i * 4)) & 0xF;
        const sboxValue = this.algorithm.SBOX[nibble];
        result.low |= (sboxValue << (28 - i * 4));
      }

      return { high: result.high >>> 0, low: result.low >>> 0 };
    }

    // Apply inverse S-box to all 4-bit nibbles
    _invSBoxLayer(state) {
      let result = { high: 0, low: 0 };

      // Process high 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = (state.high >>> (28 - i * 4)) & 0xF;
        const sboxValue = this.algorithm.SBOX_INV[nibble];
        result.high |= (sboxValue << (28 - i * 4));
      }

      // Process low 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = (state.low >>> (28 - i * 4)) & 0xF;
        const sboxValue = this.algorithm.SBOX_INV[nibble];
        result.low |= (sboxValue << (28 - i * 4));
      }

      return { high: result.high >>> 0, low: result.low >>> 0 };
    }

    // Apply bit permutation layer following PRESENT specification
    _permutationLayer(state) {
      // PRESENT permutation table (official specification)
      const P = [
        0,16,32,48,1,17,33,49,2,18,34,50,3,19,35,51,4,
        20,36,52,5,21,37,53,6,22,38,54,7,23,39,55,8,24,
        40,56,9,25,41,57,10,26,42,58,11,27,43,59,12,28,
        44,60,13,29,45,61,14,30,46,62,15,31,47,63
      ];

      let result = { high: 0, low: 0 };

      // Extract all 64 bits into array for permutation
      const bits = new Array(64);
      for (let i = 0; i < 32; i++) {
        bits[i] = (state.high >>> (31 - i)) & 1;
        bits[i + 32] = (state.low >>> (31 - i)) & 1;
      }

      // Apply PRESENT permutation using lookup table
      const permutedBits = new Array(64);
      for (let i = 0; i < 64; i++) {
        permutedBits[P[i]] = bits[i];
      }

      // Reconstruct the 64-bit state from permuted bits
      for (let i = 0; i < 32; i++) {
        if (permutedBits[i]) {
          result.high |= (1 << (31 - i));
        }
        if (permutedBits[i + 32]) {
          result.low |= (1 << (31 - i));
        }
      }

      return { high: result.high >>> 0, low: result.low >>> 0 };
    }

    // Apply inverse bit permutation layer
    _invPermutationLayer(state) {
      // PRESENT permutation table (official specification)
      const P = [
        0,16,32,48,1,17,33,49,2,18,34,50,3,19,35,51,4,
        20,36,52,5,21,37,53,6,22,38,54,7,23,39,55,8,24,
        40,56,9,25,41,57,10,26,42,58,11,27,43,59,12,28,
        44,60,13,29,45,61,14,30,46,62,15,31,47,63
      ];

      // Build inverse permutation table
      const P_inv = new Array(64);
      for (let i = 0; i < 64; i++) {
        P_inv[P[i]] = i;
      }

      let result = { high: 0, low: 0 };

      // Extract all 64 bits into array for inverse permutation
      const bits = new Array(64);
      for (let i = 0; i < 32; i++) {
        bits[i] = (state.high >>> (31 - i)) & 1;
        bits[i + 32] = (state.low >>> (31 - i)) & 1;
      }

      // Apply inverse PRESENT permutation using inverse lookup table
      const permutedBits = new Array(64);
      for (let i = 0; i < 64; i++) {
        permutedBits[P_inv[i]] = bits[i];
      }

      // Reconstruct the 64-bit state from inverse permuted bits
      for (let i = 0; i < 32; i++) {
        if (permutedBits[i]) {
          result.high |= (1 << (31 - i));
        }
        if (permutedBits[i + 32]) {
          result.low |= (1 << (31 - i));
        }
      }

      return { high: result.high >>> 0, low: result.low >>> 0 };
    }

    // Generate round keys using proper PRESENT-128 key schedule
    _generateRoundKeys(keyBytes) {
      const roundKeys = [];

      // Convert 128-bit key to BigInt for proper bit manipulation
      let keyState = 0n;
      for (let i = 0; i < 16; i++) {
        keyState = (keyState << 8n) | BigInt(keyBytes[i]);
      }

      // Generate 32 round keys (0-indexed for consistency with encryption loop)
      for (let round = 0; round < this.algorithm.ROUNDS; round++) {
        // Extract leftmost 64 bits as round key
        const roundKey = keyState >> 64n;

        // Convert BigInt round key to high/low 32-bit words
        const high = Number((roundKey >> 32n) & 0xFFFFFFFFn);
        const low = Number(roundKey & 0xFFFFFFFFn);

        roundKeys[round] = { high: high >>> 0, low: low >>> 0 };

        // Update key state for next round (if not last round)
        if (round < this.algorithm.ROUNDS - 1) {
          // Step 1: Rotate key left by 61 positions
          keyState = ((keyState << 61n) | (keyState >> 67n)) & ((1n << 128n) - 1n);

          // Step 2: Apply S-box to bits 127-124 (leftmost 4 bits)
          const leftmost4 = Number(keyState >> 124n) & 0xF;
          const sboxed1 = BigInt(this.algorithm.SBOX[leftmost4]);
          keyState = (keyState & ((1n << 124n) - 1n)) | (sboxed1 << 124n);

          // Step 3: Apply S-box to bits 123-120
          const bits123_120 = Number((keyState >> 120n) & 0xFn);
          const sboxed2 = BigInt(this.algorithm.SBOX[bits123_120]);
          keyState = (keyState & ~(0xFn << 120n)) | (sboxed2 << 120n);

          // Step 4: XOR round counter with bits 66-62 (use 1-indexed round counter)
          const roundCounter = BigInt(round + 1) & 0x1Fn;
          keyState = keyState ^ (roundCounter << 62n);
        }
      }

      return roundKeys;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Present128Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Present128Algorithm, Present128Instance };
}));