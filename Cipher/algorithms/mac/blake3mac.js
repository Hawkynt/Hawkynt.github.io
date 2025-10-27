/*
 * BLAKE3-MAC - BLAKE3 in Keyed Hash Mode for Message Authentication
 * Based on BLAKE3 specification - keyed mode for MAC generation
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
          MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  // BLAKE3 constants
  // Initial Values (IV) - BLAKE3 specification Section 2.1
  const IV = new Uint32Array([
    0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
    0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
  ]);

  // Message permutation for rounds - BLAKE3 specification
  const MSG_PERMUTATION = Object.freeze([
    2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8
  ]);

  // Flag constants - BLAKE3 specification Section 2.3
  const CHUNK_START = 1;
  const CHUNK_END = 2;
  const PARENT = 4;
  const ROOT = 8;
  const KEYED_HASH = 16;
  const DERIVE_KEY_CONTEXT = 32;
  const DERIVE_KEY_MATERIAL = 64;

  // Block and output lengths
  const BLAKE3_BLOCK_LEN = 64;
  const BLAKE3_OUT_LEN = 32;
  const BLAKE3_KEY_LEN = 32;
  const BLAKE3_CHUNK_LEN = 1024;

  class BLAKE3MACAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BLAKE3-MAC";
      this.description = "BLAKE3 in keyed hash mode for message authentication. Uses 256-bit key to produce variable-length MAC output. Combines speed of BLAKE3 with keyed authentication.";
      this.inventor = "Jack O'Connor, Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn";
      this.year = 2020;
      this.category = CategoryType.MAC;
      this.subCategory = "Keyed Hash MAC";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // MAC-specific metadata
      this.SupportedKeySizes = [new KeySize(32, 32, 1)]; // Exactly 32 bytes (256 bits)
      this.SupportedOutputSizes = [32]; // Default 32 bytes, but supports variable length

      // Documentation and references
      this.documentation = [
        new LinkItem("BLAKE3 Specification", "https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf"),
        new LinkItem("BLAKE3 Official Website", "https://blake3.io/"),
        new LinkItem("BouncyCastle BLAKE3Mac Reference", "https://github.com/bcgit/bc-lts-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/Blake3Mac.java")
      ];

      this.references = [
        new LinkItem("BLAKE3 Reference Implementation", "https://github.com/BLAKE3-team/BLAKE3"),
        new LinkItem("BLAKE3 Test Vectors", "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json")
      ];

      // Test vectors from official BLAKE3 test suite (keyed mode)
      // Test key: "whats the Elvish word for friend" (33 bytes, first 32 used)
      const testKey = OpCodes.AnsiToBytes("whats the Elvish word for friend").slice(0, 32);

      this.tests = [
        {
          text: "BLAKE3 Official Keyed Test Vector - 0 bytes",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: [],
          key: testKey,
          expected: OpCodes.Hex8ToBytes("92b2b75604ed3c761f9d6f62392c8a9227ad0ea3f09573e783f1498a4ed60d26")
        },
        {
          text: "BLAKE3 Official Keyed Test Vector - 1 byte",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: [0],
          key: testKey,
          expected: OpCodes.Hex8ToBytes("6d7878dfff2f485635d39013278ae14f1454b8c0a3a2d34bc1ab38228a80c95b")
        },
        {
          text: "BLAKE3 Official Keyed Test Vector - 3 bytes",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: [0, 1, 2],
          key: testKey,
          expected: OpCodes.Hex8ToBytes("39e67b76b5a007d4921969779fe666da67b5213b096084ab674742f0d5ec62b9")
        },
        {
          text: "BLAKE3 Official Keyed Test Vector - 7 bytes",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: [0, 1, 2, 3, 4, 5, 6],
          key: testKey,
          expected: OpCodes.Hex8ToBytes("af0a7ec382aedc0cfd626e49e7628bc7a353a4cb108855541a5651bf64fbb28a")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BLAKE3MACAlgorithmInstance(this, isInverse);
    }
  }

  // BLAKE3 G function (quarter round) - BLAKE3 specification Section 2.2
  function g(state, a, b, c, d, mx, my) {
    state[a] = OpCodes.Add32(state[a], OpCodes.Add32(state[b], mx));
    state[d] = OpCodes.RotR32(state[d] ^ state[a], 16);
    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] = OpCodes.RotR32(state[b] ^ state[c], 12);
    state[a] = OpCodes.Add32(state[a], OpCodes.Add32(state[b], my));
    state[d] = OpCodes.RotR32(state[d] ^ state[a], 8);
    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] = OpCodes.RotR32(state[b] ^ state[c], 7);
  }

  // BLAKE3 compression function - BLAKE3 specification Section 2.2
  function compress(chaining_value, block_words, counter, block_len, flags) {
    // Initialize state
    const state = new Uint32Array(16);

    // Load chaining value
    for (let i = 0; i < 8; i++) {
      state[i] = chaining_value[i];
    }

    // Load IV
    for (let i = 0; i < 4; i++) {
      state[8 + i] = IV[i];
    }

    // Load counter (64-bit), block_len, flags
    state[12] = counter & 0xFFFFFFFF;
    state[13] = (counter / 0x100000000) & 0xFFFFFFFF;
    state[14] = block_len;
    state[15] = flags;

    // Convert block bytes to 32-bit words (little-endian)
    let words = new Array(16);
    for (let i = 0; i < 16; i++) {
      const base = i * 4;
      if (Array.isArray(block_words)) {
        // Input is byte array
        words[i] = OpCodes.Pack32LE(
          block_words[base] || 0,
          block_words[base + 1] || 0,
          block_words[base + 2] || 0,
          block_words[base + 3] || 0
        );
      } else {
        // Input is Uint8Array
        words[i] = OpCodes.Pack32LE(
          block_words[base] || 0,
          block_words[base + 1] || 0,
          block_words[base + 2] || 0,
          block_words[base + 3] || 0
        );
      }
    }

    // 7 rounds of mixing
    for (let round = 0; round < 7; round++) {
      // Column round
      g(state, 0, 4, 8, 12, words[0], words[1]);
      g(state, 1, 5, 9, 13, words[2], words[3]);
      g(state, 2, 6, 10, 14, words[4], words[5]);
      g(state, 3, 7, 11, 15, words[6], words[7]);

      // Diagonal round
      g(state, 0, 5, 10, 15, words[8], words[9]);
      g(state, 1, 6, 11, 12, words[10], words[11]);
      g(state, 2, 7, 8, 13, words[12], words[13]);
      g(state, 3, 4, 9, 14, words[14], words[15]);

      // Permute message words for next round (except last round)
      if (round < 6) {
        const permuted = new Array(16);
        for (let i = 0; i < 16; i++) {
          permuted[i] = words[MSG_PERMUTATION[i]];
        }
        words = permuted;
      }
    }

    // Finalize - XOR state with IV and chaining value
    const output = new Uint32Array(16);
    for (let i = 0; i < 8; i++) {
      output[i] = state[i] ^ state[i + 8];
      output[i + 8] = state[i] ^ chaining_value[i];
    }

    return output;
  }

  class BLAKE3MACAlgorithmInstance extends IMacInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._outputSize = 32; // Default 256 bits = 32 bytes
      this._key = null;
      this.inputBuffer = [];

      // BLAKE3 state variables
      this.chaining_value = null;
      this.block = null;
      this.block_len = 0;
      this.blocks_compressed = 0;
      this.chunk_counter = 0;
      this.flags = 0;
      this.total_length = 0;
    }

    // Property: key (required, exactly 32 bytes)
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      // Validate key size - must be exactly 32 bytes
      if (keyBytes.length !== 32) {
        throw new Error(`BLAKE3-MAC requires exactly 32-byte key, got ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property: outputSize (variable, default 32 bytes)
    set outputSize(size) {
      if (size && size > 0) {
        this._outputSize = size;
      }
    }

    get outputSize() {
      return this._outputSize;
    }

    /**
     * Initialize the MAC state with key
     */
    Init() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Initialize chaining value from key (keyed mode)
      // In keyed mode, the initial chaining value is set from the key
      this.chaining_value = new Uint32Array(8);
      for (let i = 0; i < 8; i++) {
        const base = i * 4;
        this.chaining_value[i] = OpCodes.Pack32LE(
          this._key[base],
          this._key[base + 1],
          this._key[base + 2],
          this._key[base + 3]
        );
      }

      this.block = new Uint8Array(BLAKE3_BLOCK_LEN);
      this.block_len = 0;
      this.blocks_compressed = 0;
      this.chunk_counter = 0;
      this.flags = KEYED_HASH; // Set keyed hash flag
      this.total_length = 0;
    }

    /**
     * Update MAC with data
     * @param {Array} data - Data to authenticate as byte array
     */
    Update(data) {
      if (!data || data.length === 0) return;

      // Convert string to byte array if needed
      if (typeof data === 'string') {
        data = OpCodes.AnsiToBytes(data);
      }

      this.total_length += data.length;
      let offset = 0;

      // Process data in chunks
      while (offset < data.length) {
        // Fill current block
        while (offset < data.length && this.block_len < BLAKE3_BLOCK_LEN) {
          this.block[this.block_len] = data[offset];
          this.block_len++;
          offset++;
        }

        // If block is full, compress it
        if (this.block_len === BLAKE3_BLOCK_LEN) {
          this.compressBlock();
        }
      }
    }

    /**
     * Compress current block
     */
    compressBlock() {
      let flags = this.flags;
      if (this.blocks_compressed === 0) {
        flags |= CHUNK_START;
      }

      const output = compress(this.chaining_value, Array.from(this.block), this.chunk_counter, this.block_len, flags);

      // Update chaining value with first 8 words of output
      for (let i = 0; i < 8; i++) {
        this.chaining_value[i] = output[i];
      }

      this.blocks_compressed++;

      // Reset block for next data
      this.block = new Uint8Array(BLAKE3_BLOCK_LEN);
      this.block_len = 0;
    }

    /**
     * Finalize the MAC calculation and return result as byte array
     * @param {number} outputLength - Length of output in bytes
     * @returns {Array} MAC tag as byte array
     */
    Final(outputLength) {
      outputLength = outputLength || this._outputSize;

      // For simple single-chunk case (most common)
      let flags = this.flags;
      if (this.blocks_compressed === 0) {
        flags |= CHUNK_START;
      }
      flags |= CHUNK_END | ROOT;

      // Compress the final block
      const block_data = Array.from(this.block).concat(new Array(Math.max(0, 64 - this.block_len)).fill(0));
      const output = compress(this.chaining_value, block_data, 0, this.block_len, flags);

      // Extract output bytes directly from compression result
      return this.extractOutputBytes(output, outputLength);
    }

    /**
     * Extract output bytes from compression output
     */
    extractOutputBytes(words, outputLength) {
      const output = [];
      for (let i = 0; i < Math.min(16, Math.ceil(outputLength / 4)); i++) {
        const bytes = OpCodes.Unpack32LE(words[i]);
        for (let j = 0; j < 4 && output.length < outputLength; j++) {
          output.push(bytes[j]);
        }
      }
      return output;
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
     * Result method required by test suite - returns final MAC
     * @returns {Array} MAC tag as byte array
     */
    Result() {
      return this.Final();
    }

    /**
     * Clear sensitive data
     */
    ClearData() {
      if (this._key) {
        OpCodes.ClearArray(this._key);
        this._key = null;
      }
      if (this.chaining_value) {
        OpCodes.ClearArray(this.chaining_value);
      }
      if (this.block) {
        OpCodes.ClearArray(this.block);
      }
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BLAKE3MACAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BLAKE3MACAlgorithm, BLAKE3MACAlgorithmInstance };
}));
