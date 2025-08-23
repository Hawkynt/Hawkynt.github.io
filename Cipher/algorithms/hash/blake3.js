/*
 * BLAKE3 Hash Function - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

// BLAKE3 constants
const BLAKE3_OUT_LEN = 32;
const BLAKE3_KEY_LEN = 32;
const BLAKE3_BLOCK_LEN = 64;
const BLAKE3_CHUNK_LEN = 1024;
const BLAKE3_MAX_DEPTH = 54;

// BLAKE3 initialization vector (same as ChaCha20)
const BLAKE3_IV = [
  0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
  0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
];

// Domain separation flags
const CHUNK_START = 1 << 0;
const CHUNK_END = 1 << 1;
const PARENT = 1 << 2;
const ROOT = 1 << 3;
const KEYED_HASH = 1 << 4;
const DERIVE_KEY_CONTEXT = 1 << 5;
const DERIVE_KEY_MATERIAL = 1 << 6;

class BLAKE3Algorithm extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "BLAKE3";
    this.description = "Modern cryptographic hash function based on BLAKE2. Features parallel hashing, unlimited output length, and fast key derivation. Educational implementation.";
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
        text: "BLAKE3 Test Vector - Empty string",
        uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
        input: [],
        expected: OpCodes.Hex8ToBytes("af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262")
      },
      {
        text: "BLAKE3 Test Vector - 'abc'",
        uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
        input: [97, 98, 99], // "abc"
        expected: OpCodes.Hex8ToBytes("6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85")
      },
      {
        text: "BLAKE3 Test Vector - Long input",
        uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
        input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
        expected: OpCodes.Hex8ToBytes("2f1514181aadccd4c1bf1c40ce2e43fc203af9b7c5e44c0b97b0cb779de6e2b3")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new BLAKE3AlgorithmInstance(this, isInverse);
  }
}

/**
 * BLAKE3 compression function based on ChaCha20 quarter round
 */
function quarterRound(state, a, b, c, d) {
  state[a] = (state[a] + state[b]) >>> 0;
  state[d] = OpCodes.RotR32(state[d] ^ state[a], 16);
  state[c] = (state[c] + state[d]) >>> 0;
  state[b] = OpCodes.RotR32(state[b] ^ state[c], 12);
  state[a] = (state[a] + state[b]) >>> 0;
  state[d] = OpCodes.RotR32(state[d] ^ state[a], 8);
  state[c] = (state[c] + state[d]) >>> 0;
  state[b] = OpCodes.RotR32(state[b] ^ state[c], 7);
}

/**
 * BLAKE3 permutation function
 */
function permute(state) {
  // Column rounds
  quarterRound(state, 0, 4, 8, 12);
  quarterRound(state, 1, 5, 9, 13);
  quarterRound(state, 2, 6, 10, 14);
  quarterRound(state, 3, 7, 11, 15);
  
  // Diagonal rounds
  quarterRound(state, 0, 5, 10, 15);
  quarterRound(state, 1, 6, 11, 12);
  quarterRound(state, 2, 7, 8, 13);
  quarterRound(state, 3, 4, 9, 14);
}

/**
 * BLAKE3 compression function
 */
function compress(chainingValue, blockWords, counter, blockLen, flags) {
  // Convert block words from bytes to 32-bit words (little-endian)
  const messageWords = new Uint32Array(16);
  for (let i = 0; i < 16; i++) {
    messageWords[i] = OpCodes.Pack32LE(
      blockWords[i * 4],
      blockWords[i * 4 + 1],
      blockWords[i * 4 + 2],
      blockWords[i * 4 + 3]
    );
  }
  
  // Initialize state
  const state = new Uint32Array(16);
  
  // First 8 words: chaining value
  for (let i = 0; i < 8; i++) {
    state[i] = chainingValue[i];
  }
  
  // Next 4 words: initialization vector
  for (let i = 0; i < 4; i++) {
    state[8 + i] = BLAKE3_IV[i];
  }
  
  // Last 4 words: counter, block length, and flags
  state[12] = counter >>> 0;
  state[13] = (counter / 0x100000000) >>> 0; // High 32 bits of 64-bit counter
  state[14] = blockLen;
  state[15] = flags;
  
  // XOR in message words to last 16 words of state
  for (let i = 0; i < 16; i++) {
    state[i] ^= messageWords[i % 16];
  }
  
  // Run 7 rounds of permutation
  for (let round = 0; round < 7; round++) {
    permute(state);
  }
  
  // XOR first 8 and last 8 words to produce 16-word output
  const output = new Uint32Array(16);
  for (let i = 0; i < 8; i++) {
    output[i] = state[i] ^ state[i + 8];
    output[i + 8] = state[i] ^ chainingValue[i];
  }
  
  return output;
}

class BLAKE3AlgorithmInstance extends IHashFunctionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.OutputSize = 32; // 256 bits = 32 bytes
    
    this.chainingValue = null;
    this.chunks = null;
    this.key = null;
    this.flags = 0;
  }

  /**
   * Initialize the hash state
   */
  Init() {
    this.chainingValue = new Uint32Array(BLAKE3_IV);
    this.chunks = [];
    this.key = null;
    this.flags = 0;
  }

  /**
   * BLAKE3 hasher initialization with optional key
   */
  initWithKey(key) {
    this.chainingValue = new Uint32Array(BLAKE3_IV);
    this.chunks = [];
    this.key = key || null;
    this.flags = key ? KEYED_HASH : 0;
    
    if (key) {
      // Use key as initial chaining value
      const keyWords = OpCodes.StringToWords32LE(key, BLAKE3_KEY_LEN);
      for (let i = 0; i < 8; i++) {
        this.chainingValue[i] = keyWords[i];
      }
    }
  }

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
    
    let offset = 0;
    while (offset < data.length) {
      const chunkLen = Math.min(BLAKE3_CHUNK_LEN, data.length - offset);
      const chunk = data.slice(offset, offset + chunkLen);
      
      const chunkOutput = this.chunkState(this.chainingValue, chunk, this.chunks.length, this.flags);
      this.chunks.push(chunkOutput);
      
      offset += chunkLen;
    }
  }

  /**
   * Process a single chunk
   */
  chunkState(chainingValue, chunk, counter, flags) {
    let localFlags = flags;
    if (chunk.length <= BLAKE3_BLOCK_LEN) {
      localFlags |= CHUNK_START | CHUNK_END;
    } else {
      localFlags |= CHUNK_START;
    }
    
    let currentChaining = new Uint32Array(chainingValue);
    let offset = 0;
    
    while (offset < chunk.length) {
      const blockLen = Math.min(BLAKE3_BLOCK_LEN, chunk.length - offset);
      const block = new Uint8Array(64);
      
      // Copy block data and pad with zeros if necessary
      for (let i = 0; i < blockLen; i++) {
        block[i] = chunk[offset + i];
      }
      
      // Update flags for last block
      if (offset + blockLen === chunk.length) {
        localFlags |= CHUNK_END;
      }
      
      const output = compress(currentChaining, block, counter, blockLen, localFlags);
      
      // Take first 8 words as new chaining value
      for (let i = 0; i < 8; i++) {
        currentChaining[i] = output[i];
      }
      
      offset += blockLen;
      localFlags &= ~CHUNK_START; // Clear CHUNK_START for subsequent blocks
    }
    
    return currentChaining;
  }

  /**
   * Finalize the hash calculation and return result as byte array
   * @param {number} outputLength - Length of output in bytes
   * @returns {Array} Hash digest as byte array
   */
  Final(outputLength) {
    outputLength = outputLength || BLAKE3_OUT_LEN;
    
    if (this.chunks.length === 0) {
      // Empty input case
      const emptyChunk = new Uint8Array(0);
      const output = this.chunkState(this.chainingValue, emptyChunk, 0, this.flags | ROOT);
      return this.extractBytes(output, outputLength);
    }
    
    if (this.chunks.length === 1) {
      // Single chunk case
      return this.extractBytes(this.chunks[0], outputLength);
    }
    
    // Multiple chunks - build Merkle tree
    let currentLevel = this.chunks.slice();
    
    while (currentLevel.length > 1) {
      const nextLevel = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : null;
        
        if (right) {
          // Parent node with two children
          const parentInput = new Uint8Array(64);
          
          // Pack left and right children
          for (let j = 0; j < 8; j++) {
            const leftBytes = OpCodes.Unpack32LE(left[j]);
            const rightBytes = OpCodes.Unpack32LE(right[j]);
            parentInput[j * 4] = leftBytes[0];
            parentInput[j * 4 + 1] = leftBytes[1];
            parentInput[j * 4 + 2] = leftBytes[2];
            parentInput[j * 4 + 3] = leftBytes[3];
            parentInput[32 + j * 4] = rightBytes[0];
            parentInput[32 + j * 4 + 1] = rightBytes[1];
            parentInput[32 + j * 4 + 2] = rightBytes[2];
            parentInput[32 + j * 4 + 3] = rightBytes[3];
          }
          
          const parentFlags = PARENT | (currentLevel.length === 2 ? ROOT : 0);
          const parentOutput = compress(this.chainingValue, parentInput, 0, 64, parentFlags);
          
          // Take first 8 words
          const parent = new Uint32Array(8);
          for (let j = 0; j < 8; j++) {
            parent[j] = parentOutput[j];
          }
          
          nextLevel.push(parent);
        } else {
          // Odd node, carry forward
          nextLevel.push(left);
        }
      }
      
      currentLevel = nextLevel;
    }
    
    return this.extractBytes(currentLevel[0], outputLength);
  }

  /**
   * Extract bytes from final chaining value
   */
  extractBytes(chainingValue, outputLength) {
    const output = new Uint8Array(outputLength);
    let outputOffset = 0;
    let counter = 0;
    
    while (outputOffset < outputLength) {
      const block = new Uint8Array(64);
      const compressed = compress(chainingValue, block, counter, 0, ROOT);
      
      // Extract 64 bytes from compressed output
      const blockOutput = new Uint8Array(64);
      for (let i = 0; i < 16; i++) {
        const bytes = OpCodes.Unpack32LE(compressed[i]);
        blockOutput[i * 4] = bytes[0];
        blockOutput[i * 4 + 1] = bytes[1];
        blockOutput[i * 4 + 2] = bytes[2];
        blockOutput[i * 4 + 3] = bytes[3];
      }
      
      const copyLen = Math.min(64, outputLength - outputOffset);
      for (let i = 0; i < copyLen; i++) {
        output[outputOffset + i] = blockOutput[i];
      }
      
      outputOffset += copyLen;
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
    if (this.chainingValue) OpCodes.ClearArray(this.chainingValue);
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
RegisterAlgorithm(new BLAKE3Algorithm());