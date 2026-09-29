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
  /** @type {uint32[]} */
  const IV = [
    0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
    0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
  ];

  // Message permutation for rounds - BLAKE3 specification
  /** @type {int32[]} */
  const MSG_PERMUTATION = [
    2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8
  ];

  // Flag constants - BLAKE3 specification Section 2.3
  /** @type {uint32} */
  const CHUNK_START = 1;
  /** @type {uint32} */
  const CHUNK_END = 2;
  /** @type {uint32} */
  const PARENT = 4;
  /** @type {uint32} */
  const ROOT = 8;
  /** @type {uint32} */
  const KEYED_HASH = 16;
  /** @type {uint32} */
  const DERIVE_KEY_CONTEXT = 32;
  /** @type {uint32} */
  const DERIVE_KEY_MATERIAL = 64;

  // Block and output lengths
  /** @type {int32} */
  const BLAKE3_BLOCK_LEN = 64;
  /** @type {int32} */
  const BLAKE3_OUT_LEN = 32;
  /** @type {int32} */
  const BLAKE3_KEY_LEN = 32;
  /** @type {int32} */
  const BLAKE3_CHUNK_LEN = 1024;

  /**
   * The official test vector input: the repeating sequence 0,1,...,249,250,0,1,...
   * @param {int32} length - Number of bytes
   * @returns {uint8[]} The input bytes
   */
  function blake3TestInput(length) {
    /** @type {uint8[]} */
    const bytes = new Array(length);
    for (let i = 0; i < length; ++i) bytes[i] = i % 251;
    return bytes;
  }

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
      this.SupportedOutputSizes = [new KeySize(32, 32, 1)]; // Default 32 bytes, but supports variable length

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
      // The official vector inputs come from blake3TestInput (0,1,...,250,0,1,...)

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
        },
        // The official inputs are the repeating sequence 0,1,...,250,0,1,...
        // These four straddle the 64 byte block and the 1024 byte chunk, which
        // are where the block-flag and Merkle-tree paths change behaviour.
        {
          text: "BLAKE3 Official Keyed Test Vector - 64 bytes, exactly one block",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: blake3TestInput(64),
          key: testKey,
          expected: OpCodes.Hex8ToBytes("ba8ced36f327700d213f120b1a207a3b8c04330528586f414d09f2f7d9ccb7e6")
        },
        {
          text: "BLAKE3 Official Keyed Test Vector - 1024 bytes, exactly one chunk",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: blake3TestInput(1024),
          key: testKey,
          expected: OpCodes.Hex8ToBytes("75c46f6f3d9eb4f55ecaaee480db732e6c2105546f1e675003687c31719c7ba4")
        },
        {
          text: "BLAKE3 Official Keyed Test Vector - 1025 bytes, first two-chunk tree",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: blake3TestInput(1025),
          key: testKey,
          expected: OpCodes.Hex8ToBytes("357dc55de0c7e382c900fd6e320acc04146be01db6a8ce7210b7189bd664ea69")
        },
        {
          text: "BLAKE3 Official Keyed Test Vector - 2049 bytes, unbalanced three-chunk tree",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: blake3TestInput(2049),
          key: testKey,
          expected: OpCodes.Hex8ToBytes("9f29700902f7c86e514ddc4df1e3049f258b2472b6dd5267f61bf13983b78dd5")
        },
        {
          text: "BLAKE3 Official Keyed Test Vector - 1025 bytes, 131 byte extended output",
          uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
          input: blake3TestInput(1025),
          key: testKey,
          outputSize: 131,
          expected: OpCodes.Hex8ToBytes("357dc55de0c7e382c900fd6e320acc04146be01db6a8ce7210b7189bd664ea69362396b77fdc0d2634a552970843722066c3c15902ae5097e00ff53f1e116f1cd5352720113a837ab2452cafbde4d54085d9cf5d21ca613071551b25d52e69d6c81123872b6f19cd3bc1333edf0c52b94de23ba772cf82636cff4542540a7738d5b930")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - Unused: a MAC has no inverse
   * @returns {BLAKE3MACAlgorithmInstance} New MAC instance
   */

    CreateInstance(isInverse = false) {
      return new BLAKE3MACAlgorithmInstance(this, isInverse);
    }
  }

  /**
   * BLAKE3 G function (quarter round) - BLAKE3 specification Section 2.2
   * @param {uint32[]} state - 16-word state (modified in place)
   * @param {int32} a - State index
   * @param {int32} b - State index
   * @param {int32} c - State index
   * @param {int32} d - State index
   * @param {uint32} mx - First message word
   * @param {uint32} my - Second message word
   * @returns {void}
   */
  function blake3G(state, a, b, c, d, mx, my) {
    state[a] = OpCodes.Add32(state[a], OpCodes.Add32(state[b], mx));
    state[d] = OpCodes.RotR32(OpCodes.Xor32(state[d], state[a]), 16);
    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] = OpCodes.RotR32(OpCodes.Xor32(state[b], state[c]), 12);
    state[a] = OpCodes.Add32(state[a], OpCodes.Add32(state[b], my));
    state[d] = OpCodes.RotR32(OpCodes.Xor32(state[d], state[a]), 8);
    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] = OpCodes.RotR32(OpCodes.Xor32(state[b], state[c]), 7);
  }

  /**
   * BLAKE3 compression function - BLAKE3 specification Section 2.2
   * @param {uint32[]} chaining_value - 8-word input chaining value
   * @param {uint8[]} block_bytes - 64-byte block
   * @param {int32} counter - Chunk or output block counter
   * @param {uint32} block_len - Valid bytes in the block
   * @param {uint32} flags - Domain flags
   * @returns {uint32[]} 16 output words
   */
  function blake3Compress(chaining_value, block_bytes, counter, block_len, flags) {
    // Initialize state
    /** @type {uint32[]} */
    const state = new Array(16);

    // Load chaining value
    for (let i = 0; i < 8; i++) {
      state[i] = chaining_value[i];
    }

    // Load IV
    for (let i = 0; i < 4; i++) {
      state[8 + i] = IV[i];
    }

    // Load counter (64-bit), block_len, flags
    state[12] = OpCodes.And32(counter, 0xFFFFFFFF);
    state[13] = OpCodes.And32(Math.floor(counter / 0x100000000), 0xFFFFFFFF);
    state[14] = block_len;
    state[15] = flags;

    // Convert block bytes to 32-bit words (little-endian)
    /** @type {uint32[]} */
    let m = new Array(16);
    for (let i = 0; i < 16; i++) {
      const base = i * 4;
      m[i] = OpCodes.Pack32LE(block_bytes[base], block_bytes[base + 1], block_bytes[base + 2], block_bytes[base + 3]);
    }

    // 7 rounds of mixing
    for (let round = 0; round < 7; round++) {
      // Column round
      blake3G(state, 0, 4, 8, 12, m[0], m[1]);
      blake3G(state, 1, 5, 9, 13, m[2], m[3]);
      blake3G(state, 2, 6, 10, 14, m[4], m[5]);
      blake3G(state, 3, 7, 11, 15, m[6], m[7]);

      // Diagonal round
      blake3G(state, 0, 5, 10, 15, m[8], m[9]);
      blake3G(state, 1, 6, 11, 12, m[10], m[11]);
      blake3G(state, 2, 7, 8, 13, m[12], m[13]);
      blake3G(state, 3, 4, 9, 14, m[14], m[15]);

      // Permute message words for next round (except last round)
      if (round < 6) {
        /** @type {uint32[]} */
        const permuted = new Array(16);
        for (let i = 0; i < 16; i++) {
          permuted[i] = m[MSG_PERMUTATION[i]];
        }
        m = permuted;
      }
    }

    // Finalize: the upper half folds in the input chaining value. The second
    // operand is the upper state word, not the lower one - getting that wrong
    // is invisible in a 32 byte tag and corrupts every extended output.
    /** @type {uint32[]} */
    const output = new Array(16);
    for (let i = 0; i < 8; i++) {
      output[i] = OpCodes.Xor32(state[i], state[i + 8]);
      output[i + 8] = OpCodes.Xor32(state[i + 8], chaining_value[i]);
    }

    return output;
  }

  /**
   * Serialize two 8-word chaining values into one 64-byte parent block
   * @param {uint32[]} leftCv - Left child chaining value
   * @param {uint32[]} rightCv - Right child chaining value
   * @returns {uint8[]} leftCv || rightCv, little-endian
   */
  function parentBlock(leftCv, rightCv) {
    /** @type {uint8[]} */
    const blockData = [];
    for (let i = 0; i < 8; i++) {
      const b = OpCodes.Unpack32LE(leftCv[i]);
      for (let j = 0; j < 4; j++) blockData.push(b[j]);
    }
    for (let i = 0; i < 8; i++) {
      const b = OpCodes.Unpack32LE(rightCv[i]);
      for (let j = 0; j < 4; j++) blockData.push(b[j]);
    }
    return blockData;
  }

  /**
   * An empty stack of 8-word subtree chaining values
   * @returns {uint32[][]} Empty stack
   */
  function newCvStack() {
    /** @type {uint32[][]} */
    const stack = [];
    return stack;
  }

  /**
 * BLAKE3-MAC instance implementing the Feed/Result pattern
 * @class
 * @extends {IMacInstance}
 */

  class BLAKE3MACAlgorithmInstance extends IMacInstance {
    /**
   * Initialize a BLAKE3-MAC instance
   * @param {BLAKE3MACAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Unused: a MAC has no inverse
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {int32} */
      this._outputSize = 32; // Default 256 bits = 32 bytes
      /** @type {uint8[]} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // BLAKE3 state variables
      /** @type {uint32[]} */
      this.key_words = null;
      /** @type {uint32[][]} */
      this.cvStack = newCvStack();  // chaining values of completed subtrees awaiting a parent
      /** @type {uint32[]} */
      this.chaining_value = null;
      /** @type {uint8[]} */
      this.block = null;
      /** @type {int32} */
      this.block_len = 0;
      /** @type {int32} */
      this.blocks_compressed = 0;
      /** @type {int32} */
      this._chunkIndex = 0;
      /** @type {uint32} */
      this.flags = 0;
      /** @type {int32} */
      this.total_length = 0;
      /** @type {boolean} */
      this._streamStarted = false;
    }

    // Property: key (required, exactly 32 bytes)
    /**
   * Set the key
   * @param {uint8[]} keyBytes - 32-byte key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      // Validate key size - must be exactly 32 bytes
      if (keyBytes.length !== 32) {
        throw new Error("BLAKE3-MAC requires exactly 32-byte key, got " + keyBytes.length + " bytes");
      }

      this._key = keyBytes.slice();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]} Copy of key bytes or null
   */

    get key() {
      if (!this._key) return null;
      return this._key.slice();
    }

    /**
     * Property: outputSize (variable, default 32 bytes)
     * @param {int32} size - MAC length in bytes; non-positive values are ignored
     */
    set outputSize(size) {
      if (size > 0) {
        this._outputSize = size;
      }
    }

    /**
     * @returns {int32} MAC length in bytes
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * Initialize the MAC state with key
     * @returns {void}
     */
    Init() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Keyed mode: the key words are the initial chaining value of every chunk
      // and of every parent node.
      /** @type {uint32[]} */
      const keyWords = new Array(8);
      for (let i = 0; i < 8; i++) {
        const base = i * 4;
        keyWords[i] = OpCodes.Pack32LE(
          this._key[base],
          this._key[base + 1],
          this._key[base + 2],
          this._key[base + 3]
        );
      }
      this.key_words = keyWords;

      this.flags = KEYED_HASH;
      this.cvStack = newCvStack();  // chaining values of completed subtrees awaiting a parent
      this.total_length = 0;
      this._startChunk(0);
    }

    /**
     * Begin a fresh 1024 byte chunk with the given chunk counter
     * @param {int32} chunkNo - Chunk counter
     * @returns {void}
     */
    _startChunk(chunkNo) {
      this.chaining_value = this.key_words.slice();
      this.block = OpCodes.CreateArray(BLAKE3_BLOCK_LEN, 0);
      this.block_len = 0;
      this.blocks_compressed = 0;
      this._chunkIndex = chunkNo;
    }

    /**
     * @returns {int32} Bytes absorbed into the current chunk
     */
    _chunkLength() {
      return this.blocks_compressed * BLAKE3_BLOCK_LEN + this.block_len;
    }

    /**
     * @returns {uint32} CHUNK_START for the first block of a chunk, else 0
     */
    _startFlag() {
      if (this.blocks_compressed === 0) return CHUNK_START;
      return 0;
    }

    /**
     * Chaining value of the chunk currently in progress, treating it as complete
     * @returns {uint32[]} 8-word chaining value
     */
    _chunkChainingValue() {
      const out = blake3Compress(
        this.chaining_value,
        this.block.slice(),
        this._chunkIndex,
        this.block_len,
        OpCodes.Or32(OpCodes.Or32(this.flags, this._startFlag()), CHUNK_END)
      );
      return out.slice(0, 8);
    }

    /**
     * Chaining value of the parent node joining two subtrees
     * @param {uint32[]} leftCv - Left child chaining value
     * @param {uint32[]} rightCv - Right child chaining value
     * @returns {uint32[]} 8-word chaining value
     */
    _parentChainingValue(leftCv, rightCv) {
      const out = blake3Compress(this.key_words, parentBlock(leftCv, rightCv), 0, BLAKE3_BLOCK_LEN, OpCodes.Or32(this.flags, PARENT));
      return out.slice(0, 8);
    }

    /**
     * Merge a completed chunk into the subtree stack. A subtree is complete
     * whenever the number of chunks finished so far is even, so the loop
     * collapses one level for each trailing zero bit of that count.
     * @param {uint32[]} cv - Chaining value of the completed chunk
     * @param {int32} totalChunks - Chunks completed so far
     * @returns {void}
     */
    _addChunkChainingValue(cv, totalChunks) {
      let remaining = totalChunks;
      let node = cv;
      while (remaining % 2 === 0) {
        /** @type {uint32[]} */
        const leftCv = this.cvStack.pop();
        node = this._parentChainingValue(leftCv, node);
        remaining = Math.floor(remaining / 2);
      }
      this.cvStack.push(node);
    }

    /**
     * Update MAC with data
     * @param {uint8[]} data - Data to authenticate as byte array
     * @returns {void}
     */
    Update(data) {
      if (!data || data.length === 0) return;

      this.total_length += data.length;
      let offset = 0;

      while (offset < data.length) {
        // A chunk is closed only once further input proves it is not the last
        // one; the same holds for a block inside a chunk. Compressing eagerly
        // is what made messages of an exact multiple of the block or chunk
        // length come out wrong.
        if (this._chunkLength() === BLAKE3_CHUNK_LEN) {
          const cv = this._chunkChainingValue();
          const nextCounter = this._chunkIndex + 1;
          this._addChunkChainingValue(cv, nextCounter);
          this._startChunk(nextCounter);
        }

        if (this.block_len === BLAKE3_BLOCK_LEN) {
          const out = blake3Compress(
            this.chaining_value,
            this.block.slice(),
            this._chunkIndex,
            BLAKE3_BLOCK_LEN,
            OpCodes.Or32(this.flags, this._startFlag())
          );
          for (let i = 0; i < 8; i++) this.chaining_value[i] = out[i];
          this.blocks_compressed++;
          this.block = OpCodes.CreateArray(BLAKE3_BLOCK_LEN, 0);
          this.block_len = 0;
          continue;
        }

        const want = Math.min(BLAKE3_BLOCK_LEN - this.block_len, data.length - offset);
        for (let i = 0; i < want; i++) this.block[this.block_len + i] = data[offset + i];
        this.block_len += want;
        offset += want;
      }
    }

    /**
     * Finalize the MAC calculation and return result as byte array
     * @param {int32} outputLength - Length of output in bytes (0 or absent: outputSize)
     * @returns {uint8[]} MAC tag as byte array
     */
    Final(outputLength) {
      /** @type {int32} */
      let outLen = this._outputSize;
      if (outputLength) outLen = outputLength;

      // The chunk still in progress is the right-most node of the tree. Fold the
      // pending subtree chaining values into it from the right, then emit the
      // root node with the ROOT flag set.
      let cv = this.chaining_value;
      let blockData = this.block.slice();
      let blockLen = this.block_len;
      let nodeIdx = this._chunkIndex;
      let flags = OpCodes.Or32(OpCodes.Or32(this.flags, this._startFlag()), CHUNK_END);

      for (let i = this.cvStack.length - 1; i >= 0; i--) {
        const rightCv = blake3Compress(cv, blockData, nodeIdx, blockLen, flags).slice(0, 8);
        blockData = parentBlock(this.cvStack[i], rightCv);
        cv = this.key_words;
        nodeIdx = 0;
        blockLen = BLAKE3_BLOCK_LEN;
        flags = OpCodes.Or32(this.flags, PARENT);
      }

      // Root output is extendable: the output block counter selects the slice.
      /** @type {uint8[]} */
      const output = [];
      let outBlockIdx = 0;
      while (output.length < outLen) {
        const outWords = blake3Compress(cv, blockData, outBlockIdx, blockLen, OpCodes.Or32(flags, ROOT));
        for (let i = 0; i < 16 && output.length < outLen; i++) {
          const b = OpCodes.Unpack32LE(outWords[i]);
          for (let j = 0; j < 4 && output.length < outLen; j++) output.push(b[j]);
        }
        outBlockIdx++;
      }
      return output;
    }

    /**
     * Feed method required by test suite - processes input data
     * @param {uint8[]} data - Input data as byte array
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
     * Result method required by test suite - returns final MAC
     * @returns {uint8[]} MAC tag as byte array
     */
    Result() {
      return this.Final(0);
    }

    /**
     * Clear sensitive data
     * @returns {void}
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
