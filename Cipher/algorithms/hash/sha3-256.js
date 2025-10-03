/*
 * SHA-3-256 Hash Function - Universal AlgorithmFramework Implementation
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

  // SHA3-256 constants
  const SHA3_256_RATE = 136;        // Rate in bytes (1088 bits)
  const SHA3_256_OUTPUT = 32;       // Output in bytes (256 bits)
  const KECCAK_ROUNDS = 24;         // Number of Keccak-f[1600] rounds

  // Keccac round constants (24 rounds, as [low32, high32] pairs) - FIPS 202 compliant
  const RC = [
    [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
    [0x0000808b, 0x00000000], [0x80000001, 0x00000000], [0x80008081, 0x80000000], [0x00008009, 0x80000000],
    [0x0000008a, 0x00000000], [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
    [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000], [0x00008003, 0x80000000],
    [0x00008002, 0x80000000], [0x00000080, 0x80000000], [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
    [0x80008081, 0x80000000], [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000]
  ];

  // Rotation offsets for rho step
  const RHO_OFFSETS = [
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ];

  /**
   * 64-bit XOR operation
   * @param {Array} a - [low32, high32]
   * @param {Array} b - [low32, high32]
   * @returns {Array} XOR result [low32, high32]
   */
  function xor64(a, b) {
    return [a[0] ^ b[0], a[1] ^ b[1]];
  }

  /**
   * 64-bit left rotation (using 32-bit operations)
   * @param {Array} val - [low32, high32]
   * @param {number} positions - Rotation positions
   * @returns {Array} Rotated [low32, high32]
   */
  function rotl64(val, positions) {
    const [low, high] = val;
    positions %= 64;

    if (positions === 0) return [low, high];

    if (positions === 32) {
      return [high, low];
    } else if (positions < 32) {
      const newLow = ((low << positions) | (high >>> (32 - positions))) >>> 0;
      const newHigh = ((high << positions) | (low >>> (32 - positions))) >>> 0;
      return [newLow, newHigh];
    } else {
      positions -= 32;
      const newLow = ((high << positions) | (low >>> (32 - positions))) >>> 0;
      const newHigh = ((low << positions) | (high >>> (32 - positions))) >>> 0;
      return [newLow, newHigh];
    }
  }

  /**
   * Keccak-f[1600] permutation
   * @param {Array} state - 25 x [low32, high32] state array
   */
  function keccakF(state) {
    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      // Theta step
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = [0, 0];
        for (let y = 0; y < 5; y++) {
          C[x] = xor64(C[x], state[x + 5 * y]);
        }
      }

      const D = new Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = xor64(C[(x + 4) % 5], rotl64(C[(x + 1) % 5], 1));
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] = xor64(state[x + 5 * y], D[x]);
        }
      }

      // Rho step
      for (let i = 0; i < 25; i++) {
        state[i] = rotl64(state[i], RHO_OFFSETS[i]);
      }

      // Pi step
      const temp = new Array(25);
      for (let i = 0; i < 25; i++) {
        temp[i] = [state[i][0], state[i][1]];
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[y + 5 * ((2 * x + 3 * y) % 5)] = temp[x + 5 * y];
        }
      }

      // Chi step
      for (let y = 0; y < 5; y++) {
        const row = new Array(5);
        for (let x = 0; x < 5; x++) {
          row[x] = [state[x + 5 * y][0], state[x + 5 * y][1]];
        }

        for (let x = 0; x < 5; x++) {
          const notNext = [~row[(x + 1) % 5][0], ~row[(x + 1) % 5][1]];
          const andResult = [notNext[0] & row[(x + 2) % 5][0], notNext[1] & row[(x + 2) % 5][1]];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }

      // Iota step
      state[0] = xor64(state[0], RC[round]);
    }
  }

  class SHA3256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SHA-3-256";
      this.description = "SHA-3-256 is a member of the Secure Hash Algorithm 3 family, standardized by NIST. Based on the Keccak sponge construction with 256-bit output.";
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Hash-specific metadata
      this.SupportedOutputSizes = [32]; // 256 bits = 32 bytes

      // Performance and technical specifications
      this.blockSize = 136; // Rate in bytes
      this.outputSize = 32; // 256 bits = 32 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST FIPS 202", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf"),
        new LinkItem("Keccak Team Website", "https://keccak.team/"),
        new LinkItem("NIST SHA-3 Standard", "https://csrc.nist.gov/publications/detail/fips/202/final")
      ];

      this.references = [
        new LinkItem("Wikipedia: SHA-3", "https://en.wikipedia.org/wiki/SHA-3"),
        new LinkItem("Keccak Specification", "https://keccak.team/files/Keccak-reference-3.0.pdf")
      ];

      // Test vectors from NIST FIPS 202 with expected byte arrays
      this.tests = [
        {
          text: "NIST Test Vector - Empty String",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf",
          input: [],
          expected: OpCodes.Hex8ToBytes('a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a')
        },
        {
          text: "NIST Test Vector - 'abc'",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf",
          input: [0x61, 0x62, 0x63], // 'abc'
          expected: OpCodes.Hex8ToBytes('3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532')
        },
        {
          text: "NIST Test Vector - Long String",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf", 
          input: [0x61,0x62,0x63,0x64,0x62,0x63,0x64,0x65,0x63,0x64,0x65,0x66,0x64,0x65,0x66,0x67,0x65,0x66,0x67,0x68,0x66,0x67,0x68,0x69,0x67,0x68,0x69,0x6a,0x68,0x69,0x6a,0x6b,0x69,0x6a,0x6b,0x6c,0x6a,0x6b,0x6c,0x6d,0x6b,0x6c,0x6d,0x6e,0x6c,0x6d,0x6e,0x6f,0x6d,0x6e,0x6f,0x70,0x6e,0x6f,0x70,0x71], // 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'
          expected: OpCodes.Hex8ToBytes('41c0dba2a9d6240849100376a8235e2c82e1b9998a999e21db32dd97496d3376')
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SHA3256AlgorithmInstance(this, isInverse);
    }
  }

  class SHA3256AlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // 256 bits = 32 bytes

      // SHA-3-256 state
      this._state = null;
      this._buffer = null;
      this._bufferLength = 0;
    }

    /**
     * Initialize the hash state
     */
    Init() {
      // Keccak state: 25 lanes of 64 bits each (represented as pairs of 32-bit values)
      this._state = new Array(25);
      for (let i = 0; i < 25; i++) {
        this._state[i] = [0, 0]; // [low32, high32]
      }

      this._buffer = new Uint8Array(SHA3_256_RATE);
      this._bufferLength = 0;
    }

    /**
     * Add data to the hash calculation
     * @param {Array} data - Data to hash as byte array
     */
    Update(data) {
      if (!data || data.length === 0) return;

      // Convert string to byte array if needed
      if (typeof data === 'string') {
        data = OpCodes.AnsiToBytes(data);
      }

      let offset = 0;

      // Fill current buffer
      while (offset < data.length && this._bufferLength < SHA3_256_RATE) {
        this._buffer[this._bufferLength] = data[offset];
        this._bufferLength++;
        offset++;
      }

      // Process full blocks
      while (this._bufferLength === SHA3_256_RATE) {
        this._absorb();

        // Fill next block
        this._bufferLength = 0;
        while (offset < data.length && this._bufferLength < SHA3_256_RATE) {
          this._buffer[this._bufferLength] = data[offset];
          this._bufferLength++;
          offset++;
        }
      }
    }

    /**
     * Absorb current buffer into state
     */
    _absorb() {
      // XOR buffer into state (little-endian, 8 bytes per state element)
      for (let i = 0; i < SHA3_256_RATE; i += 8) {
        const stateIndex = Math.floor(i / 8);

        // Pack 8 bytes into two 32-bit words (little-endian)
        const low = OpCodes.Pack32LE(
          this._buffer[i] || 0,
          this._buffer[i + 1] || 0,
          this._buffer[i + 2] || 0,
          this._buffer[i + 3] || 0
        );
        const high = OpCodes.Pack32LE(
          this._buffer[i + 4] || 0,
          this._buffer[i + 5] || 0,
          this._buffer[i + 6] || 0,
          this._buffer[i + 7] || 0
        );

        // XOR into state
        this._state[stateIndex][0] ^= low;
        this._state[stateIndex][1] ^= high;
      }

      // Apply Keccak-f[1600] permutation
      keccakF(this._state);
    }


    /**
     * Finalize the hash calculation and return result as byte array
     * @returns {Array} Hash digest as byte array
     */
    Final() {
      // SHA-3 padding with domain separator 0x06
      this._buffer[this._bufferLength] = 0x06;

      // Fill rest with zeros except last byte
      for (let i = this._bufferLength + 1; i < SHA3_256_RATE - 1; i++) {
        this._buffer[i] = 0;
      }

      // Set last bit of last byte
      this._buffer[SHA3_256_RATE - 1] = 0x80;

      // Absorb final block
      this._absorb();

      // Squeeze exactly 256 bits (32 bytes) output
      const output = new Uint8Array(SHA3_256_OUTPUT);
      let outputOffset = 0;

      for (let i = 0; i < SHA3_256_OUTPUT && i < SHA3_256_RATE; i += 8) {
        const stateIndex = Math.floor(i / 8);
        const word = this._state[stateIndex];

        const bytes1 = OpCodes.Unpack32LE(word[0]);
        const bytes2 = OpCodes.Unpack32LE(word[1]);

        for (let j = 0; j < 4 && outputOffset < SHA3_256_OUTPUT; j++) {
          output[outputOffset++] = bytes1[j];
        }
        for (let j = 0; j < 4 && outputOffset < SHA3_256_OUTPUT; j++) {
          output[outputOffset++] = bytes2[j];
        }
      }

      return Array.from(output);
    }

    /**
     * Hash a complete message in one operation
     * @param {Array} message - Message to hash as byte array
     * @returns {Array} Hash digest as byte array
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * Required interface methods for IAlgorithmInstance compatibility
     */
    KeySetup(key) {
      // Hashes don't use keys
      return true;
    }

    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('SHA-3-256 is a one-way hash function - decryption not possible');
    }

    ClearData() {
      if (this._state) {
        for (let i = 0; i < this._state.length; i++) {
          this._state[i] = [0, 0];
        }
      }
      if (this._buffer) this._buffer.fill(0);
      this._bufferLength = 0;
    }

    /**
     * Feed method required by test suite - processes input data
     * @param {Array} data - Input data as byte array
     */
    Feed(data) {
      this.Init();
      this.Update(data);
    }

    /**
     * Result method required by test suite - returns final hash
     * @returns {Array} Hash digest as byte array
     */
    Result() {
      return this.Final();
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new SHA3256Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SHA3256Algorithm, SHA3256AlgorithmInstance };
}));