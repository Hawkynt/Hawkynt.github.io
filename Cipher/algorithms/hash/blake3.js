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
  const BLAKE3_BLOCKS_PER_CHUNK = BLAKE3_CHUNK_LEN / BLAKE3_BLOCK_LEN; // 16

  // The official test vectors fill the input with the repeating sequence
  // 0, 1, 2, ..., 249, 250, 0, 1, ... as stated in the `_comment` field of
  // test_vectors.json. Generating it beats a kilobyte-long hex literal.
  function officialVectorInput(length) {
    const data = new Array(length);
    for (let i = 0; i < length; i++) data[i] = i % 251;
    return data;
  }

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
      this.description = "Modern cryptographic hash function based on BLAKE2. Splits the message into 1024-byte chunks, hashes each to a chaining value and combines them with a binary Merkle tree of parent nodes, reproducing the official test vectors at every input length. The digest is extendable to any length.";
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
        },
        // 1024 bytes is one whole chunk and still a single tree node; 1025
        // forces the first parent node to exist; 2049 spans three chunks, so
        // the subtree stack has to hold one completed pair while a third chunk
        // is still open. An implementation that ignores the chunk tree passes
        // everything up to 1024 and fails from 1025 on.
        {
          text: "BLAKE3 Official Test Vector - 1024 bytes (exact chunk boundary)",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: officialVectorInput(1024),
          expected: OpCodes.Hex8ToBytes("42214739f095a406f3fc83deb889744ac00df831c10daa55189b5d121c855af7")
        },
        {
          text: "BLAKE3 Official Test Vector - 1025 bytes (two chunks, one parent)",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: officialVectorInput(1025),
          expected: OpCodes.Hex8ToBytes("d00278ae47eb27b34faecf67b4fe263f82d5412916c1ffd97c8cb7fb814b8444")
        },
        {
          text: "BLAKE3 Official Test Vector - 2049 bytes (three chunks, unbalanced tree)",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: officialVectorInput(2049),
          expected: OpCodes.Hex8ToBytes("5f4d72f40d7a5f82b15ca2b2e44b1de3c2ef86c426c95c1af0b6879522563030")
        },
        // The official vectors are 131 byte extended outputs whose first 32
        // bytes are the default digest. Anything past the first 64 bytes needs
        // the output block counter, and the second half of each compression
        // output is only exercised beyond byte 32.
        {
          text: "BLAKE3 Official Test Vector - 1025 bytes, 131 byte extended output",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: officialVectorInput(1025),
          outputSize: 131,
          expected: OpCodes.Hex8ToBytes(
            "d00278ae47eb27b34faecf67b4fe263f82d5412916c1ffd97c8cb7fb814b8444" +
            "f4c4a22b4b399155358a994e52bf255de60035742ec71bd08ac275a1b51cc6bf" +
            "e332b0ef84b409108cda080e6269ed4b3e2c3f7d722aa4cdc98d16deb554e562" +
            "7be8f955c98e1d5f9565a9194cad0c4285f93700062d9595adb992ae68ff1280" +
            "0ab67a")
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

    // Finalize: the upper half folds in the input chaining value. The second
    // operand is the upper state word, not the lower one - getting that wrong
    // is invisible in a 32 byte digest and corrupts every extended output.
    const output = new Uint32Array(16);
    for (let i = 0; i < 8; i++) {
      output[i] = OpCodes.XorN(state[i], state[i + 8]);
      output[i + 8] = OpCodes.XorN(state[i + 8], chaining_value[i]);
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
      this._outputSize = BLAKE3_OUT_LEN; // 256 bits = 32 bytes by default

      // Unkeyed mode: the IV is the initial chaining value of every chunk and
      // of every parent node.
      this.initial_cv = new Uint32Array(IV);
      this.chaining_value = null;
      this.cvStack = [];
      this._absorber = null;
      this.blocks_compressed = 0;
      this.chunk_counter = 0;
      this.flags = 0;
    }

    // The digest is extendable: BLAKE3 emits as many bytes as are asked for.
    // Both spellings exist because test vectors use either one.
    set OutputSize(size) { if (size && size > 0) this._outputSize = size; }
    get OutputSize() { return this._outputSize; }
    set outputSize(size) { if (size && size > 0) this._outputSize = size; }
    get outputSize() { return this._outputSize; }

    /**
     * Initialize the hash state
     */
    Init() {
      this.chaining_value = new Uint32Array(this.initial_cv);
      // The absorber never releases a full block until more input proves it is
      // not the last, which is the whole of the CHUNK_END|ROOT question below.
      this._absorber = new BlockAbsorber(BLAKE3_BLOCK_LEN, block => this.compressBlock(block));
      this.cvStack = []; // chaining values of completed subtrees awaiting a parent
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

    /** @returns {number} CHUNK_START while the chunk has compressed no block yet */
    _startFlag() {
      return this.blocks_compressed === 0 ? CHUNK_START : 0;
    }

    /**
     * Compress one block that is known not to be the last block of the message.
     *
     * A chunk is BLAKE3_BLOCKS_PER_CHUNK blocks. Its final block carries
     * CHUNK_END and its compression yields the chunk's chaining value, which
     * becomes a leaf of the tree; the chunk state then restarts under the next
     * chunk counter. Never closing a chunk is what limited this to 1024 bytes.
     *
     * @param {byte[]} block - exactly BLAKE3_BLOCK_LEN bytes
     */
    compressBlock(block) {
      const isChunkEnd = this.blocks_compressed === BLAKE3_BLOCKS_PER_CHUNK - 1;
      let flags = this.flags|this._startFlag();
      if (isChunkEnd) {
        flags |= CHUNK_END;
      }

      const output = compress(this.chaining_value, Array.from(block), this.chunk_counter, BLAKE3_BLOCK_LEN, flags);

      if (isChunkEnd) {
        const nextCounter = this.chunk_counter + 1;
        this._addChunkChainingValue(output.slice(0, 8), nextCounter);
        this.chunk_counter = nextCounter;
        this.chaining_value = new Uint32Array(this.initial_cv);
        this.blocks_compressed = 0;
        return;
      }

      // Update chaining value with first 8 words of output
      for (let i = 0; i < 8; i++) {
        this.chaining_value[i] = output[i];
      }

      this.blocks_compressed++;
    }

    /**
     * Chaining value of the parent node joining two subtrees
     * @param {Uint32Array} leftCv - chaining value of the left child
     * @param {Uint32Array} rightCv - chaining value of the right child
     * @returns {Uint32Array} the parent's 8 word chaining value
     */
    _parentChainingValue(leftCv, rightCv) {
      const blockData = this._parentBlock(leftCv, rightCv);
      const out = compress(this.initial_cv, blockData, 0, BLAKE3_BLOCK_LEN, this.flags|PARENT);
      return out.slice(0, 8);
    }

    /**
     * The 64 byte message block of a parent node: both children little-endian
     * @param {Uint32Array} leftCv - chaining value of the left child
     * @param {Uint32Array} rightCv - chaining value of the right child
     * @returns {byte[]} BLAKE3_BLOCK_LEN bytes
     */
    _parentBlock(leftCv, rightCv) {
      const blockData = new Array(BLAKE3_BLOCK_LEN);
      for (let i = 0; i < 8; i++) {
        const bytes = OpCodes.Unpack32LE(leftCv[i]);
        for (let j = 0; j < 4; j++) blockData[i * 4 + j] = bytes[j];
      }
      for (let i = 0; i < 8; i++) {
        const bytes = OpCodes.Unpack32LE(rightCv[i]);
        for (let j = 0; j < 4; j++) blockData[32 + i * 4 + j] = bytes[j];
      }
      return blockData;
    }

    /**
     * Merge a completed chunk into the subtree stack. A subtree is complete
     * whenever the number of chunks finished so far is even, so the loop
     * collapses one level for each trailing zero bit of that count.
     * @param {Uint32Array} cv - chaining value of the chunk just completed
     * @param {number} totalChunks - number of chunks completed including this one
     */
    _addChunkChainingValue(cv, totalChunks) {
      let remaining = totalChunks;
      let node = cv;
      while (remaining % 2 === 0) {
        node = this._parentChainingValue(this.cvStack.pop(), node);
        remaining = remaining / 2;
      }
      this.cvStack.push(node);
    }

    /**
     * Finalize the hash calculation and return result as byte array
     * @param {number} outputLength - Length of output in bytes
     * @returns {Array} Hash digest as byte array
     */
    Final(outputLength) {
      outputLength = outputLength || this._outputSize;

      // The last block of a chunk carries CHUNK_END. Compressing a block the
      // moment it filled handed that flag to an empty trailing block instead
      // whenever the message length was an exact multiple of 64; the absorber
      // holds the block back so the finalizer is the one that sees it.
      return this._absorber.Finish((held, pending) => {
        // The chunk still in progress is the right-most node of the tree. Fold
        // the pending subtree chaining values into it from the right, then emit
        // the surviving node with the ROOT flag set.
        let cv = this.chaining_value;
        let blockData = new Array(BLAKE3_BLOCK_LEN).fill(0);
        for (let i = 0; i < pending; i++) blockData[i] = held[i];
        let blockLen = pending;
        let counter = this.chunk_counter;
        let flags = this.flags|this._startFlag()|CHUNK_END;

        for (let i = this.cvStack.length - 1; i >= 0; i--) {
          const rightCv = compress(cv, blockData, counter, blockLen, flags).slice(0, 8);
          blockData = this._parentBlock(this.cvStack[i], rightCv);
          cv = this.initial_cv;
          counter = 0;
          blockLen = BLAKE3_BLOCK_LEN;
          flags = this.flags|PARENT;
        }

        // Root output is extendable: the output block counter selects the slice.
        const output = [];
        let outCounter = 0;
        while (output.length < outputLength) {
          const words = compress(cv, blockData, outCounter, blockLen, flags|ROOT);
          for (let i = 0; i < 16 && output.length < outputLength; i++) {
            const bytes = OpCodes.Unpack32LE(words[i]);
            for (let j = 0; j < 4 && output.length < outputLength; j++) output.push(bytes[j]);
          }
          outCounter++;
        }
        return output;
      });
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
      if (this.chaining_value) {
        OpCodes.ClearArray(this.chaining_value);
      }
      if (this.cvStack) {
        for (const cv of this.cvStack) {
          if (cv) OpCodes.ClearArray(cv);
        }
        this.cvStack = [];
      }
      if (this._absorber) {
        this._absorber.Reset();
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
      return this.Final(this._outputSize);
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