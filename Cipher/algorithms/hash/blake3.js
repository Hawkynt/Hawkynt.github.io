/*
 * BLAKE3 Hash Function - Universal AlgorithmFramework Implementation
 * Based on the official BLAKE3 specification
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
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize,
          BlockAbsorber } = AlgorithmFramework;

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

  /**
 * BLAKE3Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class BLAKE3Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BLAKE3";
      this.description = "Modern cryptographic hash function based on BLAKE2. Educational implementation covering a single BLAKE3 chunk: it reproduces the official test vectors for inputs up to 1024 bytes, but the chunk tree BLAKE3 uses beyond that is not implemented, so inputs longer than 1024 bytes do not yield BLAKE3 digests.";
      this.inventor = "Jack O'Connor, Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn";
      this.year = 2020;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = null; // Modern hash function
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Hash-specific metadata
      this.SupportedOutputSizes = [32]; // 256 bits = 32 bytes default

      // Performance and technical specifications
      this.blockSize = 64; // 512 bits = 64 bytes
      this.outputSize = 32; // 256 bits = 32 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("BLAKE3 Specification", "https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf"),
        new LinkItem("BLAKE3 Official Website", "https://blake3.io/"),
        new LinkItem("Wikipedia BLAKE3", "https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE3")
      ];

      this.references = [
        new LinkItem("BLAKE3 Reference Implementation", "https://github.com/BLAKE3-team/BLAKE3"),
        new LinkItem("BLAKE3 Rust Implementation", "https://crates.io/crates/blake3")
      ];

      // Test vectors with expected byte arrays
      this.tests = [
        {
          text: "BLAKE3 Official Test Vector - Empty string (0 bytes)",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: [],
          expected: OpCodes.Hex8ToBytes("af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262")
        },
        {
          text: "BLAKE3 Official Test Vector - 3 bytes [0,1,2]",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: [0, 1, 2], // Official test pattern: repeating sequence
          expected: OpCodes.Hex8ToBytes('e1be4d7a8ab5560aa4199eea339849ba8e293d55ca0a81006726d184519e647f')
        },
        {
          text: "BLAKE3 Official Test Vector - 7 bytes [0,1,2,3,4,5,6]",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: [0, 1, 2, 3, 4, 5, 6], // Official test pattern: repeating sequence
          expected: OpCodes.Hex8ToBytes("3f8770f387faad08faa9d8414e9f449ac68e6ff0417f673f602a646a891419fe")
        },
        // 64 and 128 bytes are the block boundary: the final block is full, and
        // it still has to carry CHUNK_END|ROOT. 63 and 65 bracket it so that a
        // change which moves the boundary cases without moving their
        // neighbours is distinguishable from one that moves everything.
        {
          text: "BLAKE3 Official Test Vector - 63 bytes",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: OpCodes.Hex8ToBytes(
            "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F" +
            "202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E"),
          expected: OpCodes.Hex8ToBytes("e9bc37a594daad83be9470df7f7b3798297c3d834ce80ba85d6e207627b7db7b")
        },
        {
          text: "BLAKE3 Official Test Vector - 64 bytes (exact block boundary)",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: OpCodes.Hex8ToBytes(
            "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F" +
            "202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          expected: OpCodes.Hex8ToBytes("4eed7141ea4a5cd4b788606bd23f46e212af9cacebacdc7d1f4c6dc7f2511b98")
        },
        {
          text: "BLAKE3 Official Test Vector - 65 bytes",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: OpCodes.Hex8ToBytes(
            "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F" +
            "202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F" +
            "40"),
          expected: OpCodes.Hex8ToBytes("de1e5fa0be70df6d2be8fffd0e99ceaa8eb6e8c93a63f2d8d1c30ecb6b263dee")
        },
        {
          text: "BLAKE3 Official Test Vector - 128 bytes (exact block boundary)",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: OpCodes.Hex8ToBytes(
            "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F" +
            "202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F" +
            "404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F" +
            "606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F"),
          expected: OpCodes.Hex8ToBytes("f17e570564b26578c33bb7f44643f539624b05df1a76c81f30acd548c44b45ef")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BLAKE3AlgorithmInstance(this, isInverse);
    }
  }

  // BLAKE3 G function (quarter round) - BLAKE3 specification Section 2.2
  function g(state, a, b, c, d, mx, my) {
    state[a] = OpCodes.Add32(state[a], OpCodes.Add32(state[b], mx));
    state[d] = OpCodes.RotR32(OpCodes.XorN(state[d], state[a]), 16);
    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] = OpCodes.RotR32(OpCodes.XorN(state[b], state[c]), 12);
    state[a] = OpCodes.Add32(state[a], OpCodes.Add32(state[b], my));
    state[d] = OpCodes.RotR32(OpCodes.XorN(state[d], state[a]), 8);
    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] = OpCodes.RotR32(OpCodes.XorN(state[b], state[c]), 7);
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
    state[12] = OpCodes.AndN(counter, 0xFFFFFFFF);
    state[13] = OpCodes.AndN(counter / 0x100000000, 0xFFFFFFFF);
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
      output[i] = OpCodes.XorN(state[i], state[i + 8]);
      output[i + 8] = OpCodes.XorN(state[i], chaining_value[i]);
    }

    return output;
  }

  /**
 * BLAKE3Algorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BLAKE3AlgorithmInstance extends IHashFunctionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // 256 bits = 32 bytes

      this.chaining_value = null;
      this._absorber = null;
      this.blocks_compressed = 0;
      this.chunk_counter = 0;
      this.flags = 0;
    }

    /**
     * Initialize the hash state
     */
    Init() {
      this.chaining_value = new Uint32Array(IV);
      // The absorber never releases a full block until more input proves it is
      // not the last, which is the whole of the CHUNK_END|ROOT question below.
      this._absorber = new BlockAbsorber(BLAKE3_BLOCK_LEN, block => this.compressBlock(block));
      this.blocks_compressed = 0;
      this.chunk_counter = 0;
      this.flags = 0;
    }

    /** @returns {number} bytes absorbed so far */
    get total_length() { return this._absorber ? this._absorber.Length : 0; }

    /**
     * Update hash with data
     * @param {Array} data - Data to hash as byte array
     */
    Update(data) {
      if (!data || data.length === 0) return;

      // Convert string to byte array if needed
      if (typeof data === 'string') {
        data = OpCodes.AnsiToBytes(data);
      }

      this._absorber.Absorb(data);
    }

    /**
     * Compress one block that is known not to be the last of the chunk.
     * @param {byte[]} block - exactly BLAKE3_BLOCK_LEN bytes
     */
    compressBlock(block) {
      let flags = this.flags;
      if (this.blocks_compressed === 0) {
        flags |= CHUNK_START;
      }

      const output = compress(this.chaining_value, Array.from(block), this.chunk_counter, BLAKE3_BLOCK_LEN, flags);

      // Update chaining value with first 8 words of output
      for (let i = 0; i < 8; i++) {
        this.chaining_value[i] = output[i];
      }

      this.blocks_compressed++;
    }

    /**
     * Get final output state
     */
    getOutput() {
      return this._absorber.Finish((held, pending) => {
        let flags = this.flags;
        if (this.blocks_compressed === 0) {
          flags |= CHUNK_START;
        }
        flags |= CHUNK_END;

        const block_words = new Array(BLAKE3_BLOCK_LEN).fill(0);
        for (let i = 0; i < pending; i++) block_words[i] = held[i];

        return {
          input_chaining_value: Array.from(this.chaining_value),
          block_words: block_words,
          block_len: pending,
          counter: this.chunk_counter,
          flags: flags
        };
      });
    }

    /**
     * Build parent from two children
     */
    parent_output(left_child, right_child) {
      const block = new Uint8Array(BLAKE3_BLOCK_LEN);

      // Pack left child
      for (let i = 0; i < 8; i++) {
        const bytes = OpCodes.Unpack32LE(left_child[i]);
        block[i * 4] = bytes[0];
        block[i * 4 + 1] = bytes[1];
        block[i * 4 + 2] = bytes[2];
        block[i * 4 + 3] = bytes[3];
      }

      // Pack right child
      for (let i = 0; i < 8; i++) {
        const bytes = OpCodes.Unpack32LE(right_child[i]);
        block[32 + i * 4] = bytes[0];
        block[32 + i * 4 + 1] = bytes[1];
        block[32 + i * 4 + 2] = bytes[2];
        block[32 + i * 4 + 3] = bytes[3];
      }

      const chaining_value = new Uint32Array(IV);
      return compress(chaining_value, block, 0, BLAKE3_BLOCK_LEN, PARENT|this.flags);
    }

    /**
     * Finalize the hash calculation and return result as byte array
     * @param {number} outputLength - Length of output in bytes
     * @returns {Array} Hash digest as byte array
     */
    Final(outputLength) {
      outputLength = outputLength || BLAKE3_OUT_LEN;

      // The last block of a chunk carries CHUNK_END, and for a single-chunk
      // message the root node carries ROOT as well. Compressing a block the
      // moment it filled handed those flags to an empty trailing block instead
      // whenever the message length was an exact multiple of 64; the absorber
      // holds the block back so the finalizer is the one that sees it.
      const output = this._absorber.Finish((held, pending) => {
        let flags = this.flags;
        if (this.blocks_compressed === 0) {
          flags |= CHUNK_START;
        }
        flags |= CHUNK_END|ROOT;

        const block_data = new Array(BLAKE3_BLOCK_LEN).fill(0);
        for (let i = 0; i < pending; i++) block_data[i] = held[i];

        return compress(this.chaining_value, block_data, 0, pending, flags);
      });

      // Extract output bytes directly from compression result
      return this.extractOutputBytes(output, outputLength);
    }

    /**
     * Extract root output bytes - BLAKE3 specification Section 2.4
     */
    rootOutputBytes(output, length) {
      const output_bytes = [];
      let counter = 0;

      while (output_bytes.length < length) {
        // Use counter mode to generate extended output
        const words = compress(
          output.input_chaining_value,
          output.block_words,
          counter,
          output.block_len,
          output.flags|ROOT
        );

        // Extract bytes from words (little-endian)
        for (let i = 0; i < 16 && output_bytes.length < length; i++) {
          const bytes = OpCodes.Unpack32LE(words[i]);
          for (let j = 0; j < 4 && output_bytes.length < length; j++) {
            output_bytes.push(bytes[j]);
          }
        }
        counter++;
      }

      return output_bytes.slice(0, length);
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
     * Extract bytes from root node
     */
    extract_bytes(node, output_len) {
      const output = new Uint8Array(output_len);
      let output_pos = 0;
      let counter = 0;

      while (output_pos < output_len) {
        const block = new Uint8Array(BLAKE3_BLOCK_LEN);
        const compressed = compress(node, block, counter, 0, ROOT|this.flags);

        // Convert output words to bytes
        const block_output = new Uint8Array(64);
        for (let i = 0; i < 16; i++) {
          const bytes = OpCodes.Unpack32LE(compressed[i]);
          block_output[i * 4] = bytes[0];
          block_output[i * 4 + 1] = bytes[1];
          block_output[i * 4 + 2] = bytes[2];
          block_output[i * 4 + 3] = bytes[3];
        }

        const copy_len = Math.min(64, output_len - output_pos);
        for (let i = 0; i < copy_len; i++) {
          output[output_pos + i] = block_output[i];
        }

        output_pos += copy_len;
        counter++;
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
      throw new Error('BLAKE3 is a one-way hash function - decryption not possible');
    }

    ClearData() {
      if (this.chunks) {
        for (let chunk of this.chunks) {
          if (chunk) OpCodes.ClearArray(chunk);
        }
        this.chunks = null;
      }
    }

    /**
     * Feed method required by test suite - processes input data
     * @param {Array} data - Input data as byte array
     */
    Feed(data) {
      // Init() discards the state, so it belongs at the start of the message and
      // not at the start of every call: Feed(a); Feed(b) must absorb the same
      // block sequence as Feed(a || b).
      if (!this._streamStarted) {
        this.Init();
        this._streamStarted = true;
      }
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

    const algorithmInstance = new BLAKE3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BLAKE3Algorithm, BLAKE3AlgorithmInstance };
}));