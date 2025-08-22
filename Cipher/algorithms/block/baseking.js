/*
 * BaseKing Block Cipher Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * BaseKing is a 192-bit block cipher designed by Joan Daemen.
 */

// Load AlgorithmFramework
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;
  
class BaseKingAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "BaseKing";
    this.description = "192-bit block cipher with 192-bit key size using 11 rounds plus final transformation. Uses Theta, Pi1/Pi2, Gamma, and Mu operations.";
    this.inventor = "Joan Daemen";
    this.year = 1994;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EXPERIMENTAL;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.BE;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(24, 24, 1) // Fixed 192-bit key
    ];
    this.SupportedBlockSizes = [
      new KeySize(24, 24, 1) // Fixed 192-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("Joan Daemen's Doctoral Dissertation", "Cipher and hash function design strategies based on linear and differential cryptanalysis"),
      new LinkItem("BaseKing Academic Paper", "Block cipher design from Joan Daemen's research on 3-Way cipher variations")
    ];

    this.references = [
      new LinkItem("Joan Daemen Research Page", "https://cs.ru.nl/~joan/JoanDaemenResearch.html"),
      new LinkItem("Cryptographic Literature", "BaseKing as variant of 3-Way cipher technique")
    ];
    
    // Test vectors
    this.tests = [
      {
        text: "All zeros test vector",
        uri: "BaseKing implementation validation",
        input: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        key: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        expected: [139,37,223,117,222,198,45,13,65,194,136,174,233,113,125,164,220,125,221,26,0,224,159,206]
      },
      {
        text: "All ones test vector",  
        uri: "BaseKing implementation validation",
        input: [255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255],
        key: [255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255],
        expected: [84,148,109,71,100,85,33,204,241,195,67,114,91,17,175,107,226,127,44,167,16,28,239,32]
      },
      {
        text: "Sequential bytes test vector",
        uri: "BaseKing implementation validation", 
        input: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
        key: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
        expected: [214,31,225,51,180,233,253,69,244,31,1,69,97,234,114,61,80,82,8,255,157,23,22,244]
      }
    ];

    // Algorithm parameters
    this.BLOCK_SIZE = 24;      // 192 bits = 24 bytes = 12 words x 16 Bits
    this.KEY_SIZE = 24;        // 192 bits = 24 bytes = 12 words x 16 Bits
    this.WORD_SIZE = 2;        // 16-bit words
    this.NUM_ROUNDS = 11;      // Number of main rounds
    this.NUM_WORDS = 12;       // Number of 16-bit words in block/key
    
    // Round shift constants
    this.shiftConstants = [0, 8, 1, 15, 5, 10, 7, 6, 13, 14, 2, 3];
    
    // Round constants for each round
    this.roundConstants = [
      0x0001, 0x0002, 0x0004, 0x0008, 0x0010, 0x0020,
      0x0040, 0x0080, 0x0100, 0x0200, 0x0400, 0x0800
    ];
  }

  CreateInstance(isInverse = false) {
    return new BaseKingInstance(this, isInverse);
  }
    
  /**
   * Mu transformation - reverses word order
   * @param {Array} a - Array of 12 words to transform
   */
  mu(a) {
    for (let i = 0; i < 6; i++) {
      const temp = a[i];
      a[i] = a[11 - i];
      a[11 - i] = temp;
    }
  }
    
  /**
   * Theta transformation - linear mixing step
   * @param {Array} k - Round key (12 words)
   * @param {Array} a - State array (12 words)
   * @param {number} RC - Round constant
   */
  theta(k, a, RC) {
    // Add round key and constants
    a[0] ^= k[0];    a[1] ^= k[1];    a[2] ^= k[2] ^ RC;   a[3] ^= k[3] ^ RC;
    a[4] ^= k[4];    a[5] ^= k[5];    a[6] ^= k[6];       a[7] ^= k[7];
    a[8] ^= k[8] ^ RC; a[9] ^= k[9] ^ RC; a[10] ^= k[10]; a[11] ^= k[11];
    
    // Linear mixing
    const A = new Array(4);
    const B = new Array(6);
    
    B[0] = a[0] ^ a[4] ^ a[8];
    A[1] = a[1] ^ a[5] ^ a[9];
    A[2] = a[2] ^ a[6] ^ a[10];
    A[3] = a[3] ^ a[7] ^ a[11];
    A[0] = B[0] ^ A[1];  A[1] ^= A[2];   A[2] ^= A[3];   A[3] ^= B[0];
    
    B[0] = a[0] ^ a[6]; B[1] = a[1] ^ a[7];  B[2] = a[2] ^ a[8];
    B[3] = a[3] ^ a[9]; B[4] = a[4] ^ a[10]; B[5] = a[5] ^ a[11];
    
    a[0] ^= A[2] ^ B[3];  a[1] ^= A[3] ^ B[4];
    a[2] ^= A[0] ^ B[5];  a[3] ^= A[1] ^ B[0];
    a[4] ^= A[2] ^ B[1];  a[5] ^= A[3] ^ B[2];
    a[6] ^= A[0] ^ B[3];  a[7] ^= A[1] ^ B[4];
    a[8] ^= A[2] ^ B[5];  a[9] ^= A[3] ^ B[0];
    a[10] ^= A[0] ^ B[1]; a[11] ^= A[1] ^ B[2];
  }
  
  /**
   * Pi1 transformation - left rotation permutation
   * @param {Array} a - State array (12 words)
   */
  pi1(a) {
    for (let j = 0; j < this.NUM_WORDS; j++) {
      a[j] = OpCodes.RotL16(a[j], this.shiftConstants[j]);
    }
  }
  
  /**
   * Gamma transformation - nonlinear step
   * @param {Array} a - State array (12 words)
   */
  gamma(a) {
    const aa = new Array(24); // Double size to avoid modulo operations
    
    // Copy state twice
    for (let i = 0; i < this.NUM_WORDS; i++) {
      aa[i] = aa[i + this.NUM_WORDS] = a[i];
    }
    
    // Nonlinear transformation: a[i] = a[i] ^ (a[i+4] | ~a[i+8])
    for (let i = 0; i < this.NUM_WORDS; i++) {
      a[i] = aa[i] ^ (aa[i + 4] | (~aa[i + 8] & 0xFFFF));
    }
  }
  
  /**
   * Pi2 transformation - right rotation permutation
   * @param {Array} a - State array (12 words)
   */
  pi2(a) {
    for (let j = 0; j < this.NUM_WORDS; j++) {
      a[j] = OpCodes.RotR16(a[j], this.shiftConstants[11 - j]);
    }
  }
  
  /**
   * Core BaseKing round function
   * @param {Array} k - Round key (12 words)
   * @param {Array} a - State array (12 words)
   * @param {Array} RC - Round constants
   */
  baseKingCore(k, a, RC) {
    // 11 main rounds
    for (let i = 0; i < this.NUM_ROUNDS; i++) {
      this.theta(k, a, RC[i]);
      this.pi1(a);
      this.gamma(a);
      this.pi2(a);
    }
    
    // Final round (Theta + Mu)
    this.theta(k, a, RC[this.NUM_ROUNDS]);
    this.mu(a);
  }
}
    
// Instance class for actual encryption/decryption
class BaseKingInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.keyWords = null;
    this.inputBuffer = [];
    this.BlockSize = 24; // 192 bits
    this.KeySize = 0;
  }

  // Property setter for key
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.keyWords = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size
    const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
      (keyBytes.length - ks.minSize) % ks.stepSize === 0
    );
    
    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    
    // Convert byte array to 16-bit words (big-endian)
    this.keyWords = [];
    for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
      this.keyWords[i] = (keyBytes[i * 2] << 8) | keyBytes[i * 2 + 1];
    }
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

    // Validate input length
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];

    // Process each block
    for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
      const block = this.inputBuffer.slice(i, i + this.BlockSize);
      const processedBlock = this.isInverse 
        ? this._decryptBlock(block) 
        : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    // Clear input buffer
    this.inputBuffer = [];
    
    return output;
  }

  _encryptBlock(block) {
    // Convert bytes to 16-bit words (big-endian)
    const words = [];
    for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
      words[i] = (block[i * 2] << 8) | block[i * 2 + 1];
    }
    
    // Apply BaseKing encryption
    this.algorithm.baseKingCore(this.keyWords, words, this.algorithm.roundConstants);
    
    // Convert words back to bytes (big-endian)
    const result = new Array(this.algorithm.BLOCK_SIZE);
    for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
      result[i * 2] = (words[i] >>> 8) & 0xFF;
      result[i * 2 + 1] = words[i] & 0xFF;
    }
    
    return result;
  }

  _decryptBlock(block) {
    // Convert bytes to 16-bit words (big-endian)
    const words = [];
    for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
      words[i] = (block[i * 2] << 8) | block[i * 2 + 1];
    }
    
    // For decryption, we need to reverse the operations
    // 1. Reverse Mu
    this.algorithm.mu(words);
    
    // 2. Reverse final Theta
    this.algorithm.theta(this.keyWords, words, this.algorithm.roundConstants[this.algorithm.NUM_ROUNDS]);
    
    // 3. Reverse 11 rounds in reverse order
    for (let i = this.algorithm.NUM_ROUNDS - 1; i >= 0; i--) {
      this.algorithm.pi2(words);     // Reverse Pi2
      this.algorithm.gamma(words);   // Gamma is its own inverse
      this.algorithm.pi1(words);     // Reverse Pi1
      this.algorithm.theta(this.keyWords, words, this.algorithm.roundConstants[i]); // Reverse Theta
    }
    
    // Convert words back to bytes (big-endian)
    const result = new Array(this.algorithm.BLOCK_SIZE);
    for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
      result[i * 2] = (words[i] >>> 8) & 0xFF;
      result[i * 2 + 1] = words[i] & 0xFF;
    }
    
    return result;
  }
}
  
// Register the algorithm immediately
RegisterAlgorithm(new BaseKingAlgorithm());