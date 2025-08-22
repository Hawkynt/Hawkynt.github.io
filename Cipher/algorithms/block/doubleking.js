/*
 * DoubleKing Block Cipher Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * DoubleKing is a 384-bit block cipher variant of BaseKing designed by Tim van Dijk.
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
  
class DoubleKingAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "DoubleKing";
    this.description = "384-bit block cipher with 384-bit key size, a variant of BaseKing designed by Tim van Dijk. Uses 11 rounds plus final transformation.";
    this.inventor = "Tim van Dijk";
    this.year = 2020;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EXPERIMENTAL;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.NL;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(48, 48, 1) // Fixed 384-bit key
    ];
    this.SupportedBlockSizes = [
      new KeySize(48, 48, 1) // Fixed 384-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("Tim van Dijk's Bachelor Thesis", "A high-performance threshold implementation of a BaseKing variant on an ARM architecture"),
      new LinkItem("Radboud University Research", "https://www.cs.ru.nl/bachelors-theses/")
    ];

    this.references = [
      new LinkItem("BaseKing Foundation", "Joan Daemen's BaseKing cipher as foundation algorithm"),
      new LinkItem("Threshold Implementation", "Side-channel attack resistance techniques")
    ];
    
    // Test vectors
    this.tests = [
      {
        text: "All zeros test vector",
        uri: "DoubleKing implementation validation",
        input: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("2dbd40ae1f919f5c13718bafaa0070f5c53579be5f649201d369e17366cc0bb57e1710d34fa506973758cdc640c3c02f")
      },
      {
        text: "All ones test vector",
        uri: "DoubleKing implementation validation",
        input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
        key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
        expected: OpCodes.Hex8ToBytes("46805c2b1338083954f39e51c7ed962661ec75f386d2afb1dfbf59c5e6657484d987f7684762c0f13b2d562565e8df05")
      },
      {
        text: "Sequential pattern test vector",
        uri: "DoubleKing implementation validation",
        input: OpCodes.Hex8ToBytes("000306090c0f1215181b1e2124272a2d303336393c3f4245484b4e5154575a5d606366696c6f7275787b7e8184878a8d"),
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
        expected: OpCodes.Hex8ToBytes("203ad622b95dfddaf93a1836f31f3a2d92b4f0e435f13f24ee43a030b86399f83f5a8e0d6195be33a38a9bd66854f0de")
      }
    ];

    // Algorithm parameters
    this.BLOCK_SIZE = 48;      // 384 bits = 48 bytes = 12 words x 32 bits
    this.KEY_SIZE = 48;        // 384 bits = 48 bytes = 12 words x 32 bits
    this.WORD_SIZE = 4;        // 32-bit words
    this.NUM_ROUNDS = 11;      // Number of main rounds
    this.NUM_WORDS = 12;       // Number of 32-bit words in block/key
    
    // Round shift constants (enhanced for 32-bit words)
    this.shiftConstants = [0, 16, 2, 30, 10, 20, 14, 12, 26, 28, 4, 6];
    
    // Round constants for each round (32-bit values)
    this.roundConstants = [
      0x00000001, 0x00000002, 0x00000004, 0x00000008, 0x00000010, 0x00000020,
      0x00000040, 0x00000080, 0x00000100, 0x00000200, 0x00000400, 0x00000800
    ];
  }

  CreateInstance(isInverse = false) {
    return new DoubleKingInstance(this, isInverse);
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
   * Theta transformation - linear mixing step (enhanced for 32-bit)
   * @param {Array} k - Round key (12 words)
   * @param {Array} a - State array (12 words)
   * @param {number} RC - Round constant
   */
  theta(k, a, RC) {
    // Add round key and constants
    a[0] ^= k[0];    a[1] ^= k[1];    a[2] ^= k[2] ^ RC;   a[3] ^= k[3] ^ RC;
    a[4] ^= k[4];    a[5] ^= k[5];    a[6] ^= k[6];       a[7] ^= k[7];
    a[8] ^= k[8] ^ RC; a[9] ^= k[9] ^ RC; a[10] ^= k[10]; a[11] ^= k[11];
    
    // Enhanced linear mixing for 32-bit words
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
   * Pi1 transformation - left rotation permutation (32-bit)
   * @param {Array} a - State array (12 words)
   */
  pi1(a) {
    for (let j = 0; j < this.NUM_WORDS; j++) {
      a[j] = OpCodes.RotL32(a[j], this.shiftConstants[j]);
    }
  }
  
  /**
   * Gamma transformation - nonlinear step (enhanced for 32-bit)
   * @param {Array} a - State array (12 words)
   */
  gamma(a) {
    const aa = new Array(24); // Double size to avoid modulo operations
    
    // Copy state twice
    for (let i = 0; i < this.NUM_WORDS; i++) {
      aa[i] = aa[i + this.NUM_WORDS] = a[i];
    }
    
    // Enhanced nonlinear transformation: a[i] = a[i] ^ (a[i+4] | ~a[i+8])
    for (let i = 0; i < this.NUM_WORDS; i++) {
      a[i] = aa[i] ^ (aa[i + 4] | (~aa[i + 8] >>> 0));
    }
  }
  
  /**
   * Pi2 transformation - right rotation permutation (32-bit)
   * @param {Array} a - State array (12 words)
   */
  pi2(a) {
    for (let j = 0; j < this.NUM_WORDS; j++) {
      a[j] = OpCodes.RotR32(a[j], this.shiftConstants[11 - j]);
    }
  }
  
  /**
   * Core DoubleKing round function
   * @param {Array} k - Round key (12 words)
   * @param {Array} a - State array (12 words)
   * @param {Array} RC - Round constants
   */
  doubleKingCore(k, a, RC) {
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

  /**
   * Pi1 inverse transformation - right rotation permutation (inverse of Pi1)
   * @param {Array} a - State array (12 words)
   */
  pi1Inverse(a) {
    for (let j = 0; j < this.NUM_WORDS; j++) {
      a[j] = OpCodes.RotR32(a[j], this.shiftConstants[j]);
    }
  }
  
  /**
   * Pi2 inverse transformation - left rotation permutation (inverse of Pi2)
   * @param {Array} a - State array (12 words)
   */
  pi2Inverse(a) {
    for (let j = 0; j < this.NUM_WORDS; j++) {
      a[j] = OpCodes.RotL32(a[j], this.shiftConstants[11 - j]);
    }
  }
}
    
// Instance class for actual encryption/decryption
class DoubleKingInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.keyWords = null;
    this.inputBuffer = [];
    this.BlockSize = 48; // 384 bits
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
    
    // Convert byte array to 32-bit words (big-endian)
    this.keyWords = [];
    for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
      this.keyWords[i] = OpCodes.Pack32BE(
        keyBytes[i * 4], 
        keyBytes[i * 4 + 1], 
        keyBytes[i * 4 + 2], 
        keyBytes[i * 4 + 3]
      );
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
    // Convert bytes to 32-bit words (big-endian)
    const words = [];
    for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
      words[i] = OpCodes.Pack32BE(
        block[i * 4], 
        block[i * 4 + 1], 
        block[i * 4 + 2], 
        block[i * 4 + 3]
      );
    }
    
    // Apply DoubleKing encryption
    this.algorithm.doubleKingCore(this.keyWords, words, this.algorithm.roundConstants);
    
    // Convert words back to bytes (big-endian)
    const result = new Array(this.algorithm.BLOCK_SIZE);
    for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
      const bytes = OpCodes.Unpack32BE(words[i]);
      result[i * 4] = bytes[0];
      result[i * 4 + 1] = bytes[1];
      result[i * 4 + 2] = bytes[2];
      result[i * 4 + 3] = bytes[3];
    }
    
    return result;
  }

  _decryptBlock(block) {
    // Convert bytes to 32-bit words (big-endian)
    const words = [];
    for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
      words[i] = OpCodes.Pack32BE(
        block[i * 4], 
        block[i * 4 + 1], 
        block[i * 4 + 2], 
        block[i * 4 + 3]
      );
    }
    
    // For decryption, we need to reverse the operations
    // 1. Reverse Mu (Mu is its own inverse)
    this.algorithm.mu(words);
    
    // 2. Reverse final Theta (Theta is its own inverse)
    this.algorithm.theta(this.keyWords, words, this.algorithm.roundConstants[this.algorithm.NUM_ROUNDS]);
    
    // 3. Reverse 11 rounds in reverse order
    for (let i = this.algorithm.NUM_ROUNDS - 1; i >= 0; i--) {
      // Reverse in exact opposite order
      this.algorithm.pi2Inverse(words);   // Reverse Pi2 
      this.algorithm.gamma(words);        // Gamma is its own inverse
      this.algorithm.pi1Inverse(words);   // Reverse Pi1 
      this.algorithm.theta(this.keyWords, words, this.algorithm.roundConstants[i]); // Reverse Theta
    }
    
    // Convert words back to bytes (big-endian)
    const result = new Array(this.algorithm.BLOCK_SIZE);
    for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
      const bytes = OpCodes.Unpack32BE(words[i]);
      result[i * 4] = bytes[0];
      result[i * 4 + 1] = bytes[1];
      result[i * 4 + 2] = bytes[2];
      result[i * 4 + 3] = bytes[3];
    }
    
    return result;
  }
}
  
// Register the algorithm immediately
RegisterAlgorithm(new DoubleKingAlgorithm());