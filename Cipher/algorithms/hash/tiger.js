/*
 * Tiger Hash Function - Universal AlgorithmFramework Implementation
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

  class TigerAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Tiger";
      this.description = "Tiger is a cryptographic hash function designed by Ross Anderson and Eli Biham in 1995 for efficiency on 64-bit platforms. It produces a 192-bit hash value.";
      this.inventor = "Ross Anderson, Eli Biham";
      this.year = 1995;
      this.category = CategoryType.HASH;
      this.subCategory = "Classical Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.MULTI;

      // Hash-specific metadata
      this.SupportedOutputSizes = [24]; // 192 bits

      // Performance and technical specifications
      this.blockSize = 64; // 512 bits = 64 bytes
      this.outputSize = 24; // 192 bits = 24 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("Tiger: A Fast New Hash Function", "https://www.cl.cam.ac.uk/~rja14/Papers/tiger.pdf"),
        new LinkItem("NESSIE Project", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      this.references = [
        new LinkItem("Wikipedia: Tiger (hash function)", "https://en.wikipedia.org/wiki/Tiger_(hash_function)")
      ];

      // Test vectors from NESSIE project
      this.tests = [
        {
          text: "NESSIE Test Vector - Empty String",
          uri: "https://biham.cs.technion.ac.il/Reports/Tiger/test-vectors-nessie-format.dat",
          input: [],
          expected: OpCodes.Hex8ToBytes("3293ac630c13f0245f92bbb1766e16167a4e58492dde73f3")
        },
        {
          text: "NESSIE Test Vector - 'a'",
          uri: "https://biham.cs.technion.ac.il/Reports/Tiger/test-vectors-nessie-format.dat",
          input: [97], // "a"
          expected: OpCodes.Hex8ToBytes("77befbef2e7ef8ab2ec8f93bf587a7fc613e247f5f247809")
        },
        {
          text: "NESSIE Test Vector - 'abc'",
          uri: "https://biham.cs.technion.ac.il/Reports/Tiger/test-vectors-nessie-format.dat",
          input: [97, 98, 99], // "abc"
          expected: OpCodes.Hex8ToBytes("2aab1484e8c158f2bfb8c5ff41b57a525129131c957b5f93")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new TigerAlgorithmInstance(this, isInverse);
    }
  }

  class TigerAlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 24; // 192 bits = 24 bytes

      this.initSBoxes();
    }

    // Initialize simplified S-boxes for educational implementation
    initSBoxes() {
      this.SBOX = [];
      for (let box = 0; box < 8; box++) {
        this.SBOX[box] = new Array(256);
        for (let i = 0; i < 256; i++) {
          // Simplified S-box generation (not cryptographically secure)
          this.SBOX[box][i] = ((i * 0x9E3779B9) ^ (i << 8) ^ (i >> 3)) >>> 0;
        }
      }
    }

    /**
     * Initialize the hash state with standard Tiger initial values
     */
    Init() {
      // Initialize Tiger state (192-bit = 3 x 64-bit words)
      this.state = [
        [0x01234567, 0x89ABCDEF],  // Initial value A
        [0xFEDCBA98, 0x76543210],  // Initial value B
        [0xF096A5B4, 0xC3B2E187]   // Initial value C
      ];

      this.buffer = new Array(TIGER_BLOCKSIZE);
      this.bufferLength = 0;
      this.totalLength = 0;
    }

    /**
     * 64-bit addition using 32-bit operations
     */
    add64(a, b) {
      const low = (a[0] + b[0]) >>> 0;
      const high = (a[1] + b[1] + (low < a[0] ? 1 : 0)) >>> 0;
      return [low, high];
    }

    /**
     * 64-bit subtraction using 32-bit operations
     */
    subtract64(a, b) {
      const low = (a[0] - b[0]) >>> 0;
      const high = (a[1] - b[1] - (a[0] < b[0] ? 1 : 0)) >>> 0;
      return [low, high];
    }

    /**
     * 64-bit XOR operation
     */
    xor64(a, b) {
      return [a[0] ^ b[0], a[1] ^ b[1]];
    }

    /**
     * 64-bit left rotation using 32-bit operations
     */
    rotl64(val, positions) {
      const [low, high] = val;
      positions %= 64;

      if (positions === 0) return [low, high];

      if (positions === 32) {
        return [high, low];
      } else if (positions < 32) {
        const newHigh = ((high << positions) | (low >>> (32 - positions))) >>> 0;
        const newLow = ((low << positions) | (high >>> (32 - positions))) >>> 0;
        return [newLow, newHigh];
      } else {
        positions -= 32;
        const newHigh = ((low << positions) | (high >>> (32 - positions))) >>> 0;
        const newLow = ((high << positions) | (low >>> (32 - positions))) >>> 0;
        return [newLow, newHigh];
      }
    }

    /**
     * Convert bytes to 64-bit words (little-endian)
     */
    bytesToWords64(bytes) {
      const words = [];
      for (let i = 0; i < bytes.length; i += 8) {
        const low = OpCodes.Pack32LE(
          bytes[i] || 0, bytes[i + 1] || 0, bytes[i + 2] || 0, bytes[i + 3] || 0
        );
        const high = OpCodes.Pack32LE(
          bytes[i + 4] || 0, bytes[i + 5] || 0, bytes[i + 6] || 0, bytes[i + 7] || 0
        );
        words.push([low, high]);
      }
      return words;
    }

    /**
     * Convert 64-bit words to bytes (little-endian)
     */
    words64ToBytes(words, length) {
      const bytes = new Array(length);
      let byteIndex = 0;

      for (let i = 0; i < words.length && byteIndex < length; i++) {
        const [low, high] = words[i];
        const lowBytes = OpCodes.Unpack32LE(low);
        const highBytes = OpCodes.Unpack32LE(high);

        for (let j = 0; j < 4 && byteIndex < length; j++) {
          bytes[byteIndex++] = lowBytes[j];
        }
        for (let j = 0; j < 4 && byteIndex < length; j++) {
          bytes[byteIndex++] = highBytes[j];
        }
      }

      return bytes;
    }

    /**
     * Tiger round function (simplified)
     */
    tigerRound(state, x, pass) {
      // Simplified Tiger round (educational version)
      for (let i = 0; i < 8; i++) {
        const t = this.add64(this.add64(state[2], x[i]), [this.SBOX[0][state[0][0] & 0xFF], 0]);

        // Rotate and update state
        const newC = this.xor64(state[1], t);
        const newB = this.add64(state[0], this.rotl64(t, 19));
        const newA = this.subtract64(state[2], this.rotl64(t, 23));

        state[0] = newA;
        state[1] = newB;
        state[2] = newC;
      }

      // Key schedule for next round (simplified)
      if (pass < 2) {
        for (let i = 0; i < 8; i++) {
          x[i] = this.subtract64(x[i], x[(i + 7) % 8]);
          x[i] = this.xor64(x[i], this.rotl64(x[(i + 7) % 8], 45));
        }
      }
    }

    processBlock(block) {
      const x = this.bytesToWords64(block);
      const state = [
        [this.state[0][0], this.state[0][1]],
        [this.state[1][0], this.state[1][1]],
        [this.state[2][0], this.state[2][1]]
      ];

      // Store original state for feedforward
      const originalState = [
        [this.state[0][0], this.state[0][1]],
        [this.state[1][0], this.state[1][1]],
        [this.state[2][0], this.state[2][1]]
      ];

      // Three passes
      for (let pass = 0; pass < TIGER_ROUNDS; pass++) {
        this.tigerRound(state, x, pass);
      }

      // Feedforward
      this.state[0] = this.xor64(state[0], originalState[0]);
      this.state[1] = this.subtract64(state[1], originalState[1]);
      this.state[2] = this.add64(state[2], originalState[2]);
    }

    /**
     * Add data to the hash calculation
     * @param {Array} data - Data to hash as byte array
     */
    Update(data) {
      if (!data || data.length === 0) return;

      // Convert string to byte array if needed
      if (typeof data === 'string') {
        const bytes = [];
        for (let i = 0; i < data.length; i++) {
          bytes.push(data.charCodeAt(i) & 0xFF);
        }
        data = bytes;
      }

      this.totalLength += data.length;
      let offset = 0;

      // Fill buffer first
      while (offset < data.length && this.bufferLength < TIGER_BLOCKSIZE) {
        this.buffer[this.bufferLength++] = data[offset++];
      }

      // Process full buffer
      if (this.bufferLength === TIGER_BLOCKSIZE) {
        this.processBlock(this.buffer);
        this.bufferLength = 0;
      }

      // Process remaining full blocks
      while (offset + TIGER_BLOCKSIZE <= data.length) {
        const block = data.slice(offset, offset + TIGER_BLOCKSIZE);
        this.processBlock(block);
        offset += TIGER_BLOCKSIZE;
      }

      // Store remaining bytes in buffer
      while (offset < data.length) {
        this.buffer[this.bufferLength++] = data[offset++];
      }
    }

    /**
     * Finalize the hash calculation and return result as byte array
     * @returns {Array} Hash digest as byte array
     */
    Final() {
      // Tiger padding: append 0x01, then zeros, then length
      const paddingLength = TIGER_BLOCKSIZE - ((this.totalLength + 9) % TIGER_BLOCKSIZE);
      const padding = new Array(paddingLength + 9);

      padding[0] = 0x01; // Tiger padding byte

      // Fill with zeros
      for (let i = 1; i <= paddingLength; i++) {
        padding[i] = 0x00;
      }

      // Append length as 64-bit little-endian
      const lengthBytes = new Array(8);
      const bitLength = this.totalLength * 8;

      for (let i = 0; i < 8; i++) {
        lengthBytes[i] = (bitLength >>> (i * 8)) & 0xFF;
      }

      for (let i = 0; i < 8; i++) {
        padding[paddingLength + 1 + i] = lengthBytes[i];
      }

      this.Update(padding);

      // Convert state to bytes
      return this.words64ToBytes(this.state, TIGER_DIGESTSIZE);
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
      throw new Error('Tiger is a one-way hash function - decryption not possible');
    }

    ClearData() {
      if (this.state) {
        for (let i = 0; i < this.state.length; i++) {
          this.state[i] = [0, 0];
        }
      }
      if (this.buffer) OpCodes.ClearArray(this.buffer);
      this.totalLength = 0;
      this.bufferLength = 0;
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

    const algorithmInstance = new TigerAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TigerAlgorithm, TigerAlgorithmInstance };
}));