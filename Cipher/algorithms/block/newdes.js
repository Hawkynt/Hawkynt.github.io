/*
 * NewDES Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * NewDES (New Data Encryption Standard) is a block cipher designed by Robert Scott.
 * Published in Cryptologia, Volume 9, Number 1 (January 1985).
 * 
 * Key features:
 * - Block size: 64 bits (8 bytes)
 * - Key size: 120 bits (15 bytes)
 * - Structure: Feistel-like with 8 rounds + final transformation
 * - Operations: XOR with S-box substitution using a 256-byte rotor
 * 
 * NewDES was designed to be easier to implement in software than DES
 * and supposedly more secure, though it has since been cryptanalyzed.
 * 
 * Based on Mark Riordan's reference implementation from August 1990.
 * Educational implementation - not for production use.
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;
  
class NewDESAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "NewDES";
    this.description = "New Data Encryption Standard by Robert Scott. Educational implementation of a 64-bit block cipher with 120-bit keys, designed to be easier to implement than DES.";
    this.inventor = "Robert Scott";
    this.year = 1985;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL; // Cryptanalyzed but historically interesting
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Algorithm parameters
    this.BLOCK_SIZE = 8;           // 64 bits = 8 bytes
    this.KEY_SIZE = 15;            // 120 bits = 15 bytes
    this.UNRAVELLED_KEY_SIZE = 60; // 15 * 4 = 60 bytes for key schedule
    this.ROTOR_SIZE = 256;         // S-box size
    this.ROUNDS = 8;               // Number of main rounds

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(15, 15, 1) // Fixed 120-bit (15-byte) key
    ];
    this.SupportedBlockSizes = [
      new KeySize(8, 8, 1) // Fixed 64-bit (8-byte) blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("NewDES Original Paper", "https://www.tandfonline.com/doi/abs/10.1080/0161-118591857944"),
      new LinkItem("NewDES Analysis", "https://en.wikipedia.org/wiki/NewDES")
    ];

    this.references = [
      new LinkItem("Mark Riordan's Implementation", "https://www.schneier.com/academic/archives/1995/12/applied_cryptography_1.html"),
      new LinkItem("Cryptologia Paper", "https://www.tandfonline.com/toc/ucry20/9/1")
    ];

    // Test vectors
    this.tests = [
      new TestCase(
        OpCodes.Hex8ToBytes("0000000000000000"), // input
        OpCodes.Hex8ToBytes("8ca64de9c1b123a7"), // expected (example output)
        "NewDES test vector - all zeros plaintext",
        "http://www.schneier.com/code/newdes.zip"
      )
    ];
    // Additional property for key in test vector (15 bytes for NewDES)
    this.tests[0].key = OpCodes.Hex8ToBytes("0123456789abcdef0123456789abcd").slice(0, 15);
  }

  // Required: Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new NewDESInstance(this, isInverse);
  }
}

// Instance class - handles the actual encryption/decryption
class NewDESInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.encryptionKey = null;
    this.decryptionKey = null;
    this.inputBuffer = [];
    this.BlockSize = 8; // 64-bit blocks
    this.KeySize = 0;   // will be set when key is assigned
    
    // NewDES S-box (rotor) - fixed substitution table
    this.rotor = [
      32, 137, 239, 188, 102, 125, 221,  72, 212,  68,  81,  37,  86, 237, 147, 149,
      70, 229,  17, 124, 115, 207,  33,  20, 122, 143,  25, 215,  51, 183, 138, 142,
     146, 211, 110, 173,   1, 228, 189,  14, 103,  78, 162,  36, 253, 167, 116, 255,
     158,  45, 185,  50,  98, 168, 250, 235,  54, 141, 195, 247, 240,  63, 148,   2,
     224, 169, 214, 180,  62,  22, 117, 108,  19, 172, 161, 159, 160,  47,  43, 171,
     194, 175, 178,  56, 196, 112,  23, 220,  89,  21, 164, 130, 157,   8,  85, 251,
     216,  44,  94, 179, 226,  38,  90, 119,  40, 202,  34, 206,  35,  69, 231, 246,
      29, 109,  74,  71, 176,   6,  60, 145,  65,  13,  77, 151,  12, 127,  95, 199,
      57, 101,   5, 232, 150, 210, 129,  24, 181,  10, 121, 187,  48, 193, 139, 252,
     219,  64,  88, 233,  96, 128,  80,  53, 191, 144, 218,  11, 106, 132, 155, 104,
      91, 136,  31,  42, 243,  66, 126, 135,  30,  26,  87, 186, 182, 154, 242, 123,
      82, 166, 208,  39, 152, 190, 113, 205, 114, 105, 225,  84,  73, 163,  99, 111,
     204,  61, 200, 217, 170,  15, 198,  28, 192, 254, 134, 234, 222,   7, 236, 248,
     201,  41, 177, 156,  92, 131,  67, 249, 245, 184, 203,   9, 241,   0,  27,  46,
     133, 174,  75,  18,  93, 209, 100, 120,  76, 213,  16,  83,   4, 107, 140,  52,
      58,  55,   3, 244,  97, 197, 238, 227, 118,  49,  79, 230, 223, 165, 153,  59
    ];
  }

  // Property setter for key - validates and sets up key schedule
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.encryptionKey = null;
      this.decryptionKey = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size
    if (keyBytes.length !== 15) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 15 bytes)`);
    }

    this._key = [...keyBytes]; // Copy the key
    this.KeySize = keyBytes.length;
    
    // Set up encryption and decryption keys
    this.encryptionKey = this._setupEncryptionKey(keyBytes);
    this.decryptionKey = this._setupDecryptionKey(keyBytes);
  }

  get key() {
    return this._key ? [...this._key] : null; // Return copy
  }

  // Feed data to the cipher (accumulates until we have complete blocks)
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");

    // Add data to input buffer
    this.inputBuffer.push(...data);
  }

  // Get the result of the transformation
  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    // Process complete blocks
    const output = [];
    const blockSize = this.BlockSize;
    
    // Validate input length for block cipher
    if (this.inputBuffer.length % blockSize !== 0) {
      throw new Error(`Input length must be multiple of ${blockSize} bytes`);
    }

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

  /**
   * Create encryption key schedule
   * @param {Array} key - 15-byte user key
   * @returns {Array} 60-byte unravelled key for encryption
   */
  _setupEncryptionKey(key) {
    const unravelledKey = new Array(60); // UNRAVELLED_KEY_SIZE = 60
    
    // For encryption: simply repeat the 15-byte key 4 times
    for (let i = 0; i < 60; i++) {
      unravelledKey[i] = key[i % 15];
    }
    
    return unravelledKey;
  }
  
  /**
   * Create decryption key schedule 
   * @param {Array} key - 15-byte user key
   * @returns {Array} 60-byte unravelled key for decryption
   */
  _setupDecryptionKey(key) {
    const unravelledKey = new Array(60); // UNRAVELLED_KEY_SIZE = 60
    let keyPos = 0;
    let userKeyIdx = 11; // Start at position 11
    
    while (true) {
      // Copy 4 bytes with wrapping
      unravelledKey[keyPos++] = key[userKeyIdx];
      userKeyIdx = (userKeyIdx + 1) % 15;
      
      unravelledKey[keyPos++] = key[userKeyIdx];
      userKeyIdx = (userKeyIdx + 1) % 15;
      
      unravelledKey[keyPos++] = key[userKeyIdx];
      userKeyIdx = (userKeyIdx + 1) % 15;
      
      unravelledKey[keyPos++] = key[userKeyIdx];
      userKeyIdx = (userKeyIdx + 9) % 15;
      
      if (userKeyIdx === 12) break;
      
      // Copy 3 more bytes
      unravelledKey[keyPos++] = key[userKeyIdx++];
      unravelledKey[keyPos++] = key[userKeyIdx++];
      unravelledKey[keyPos++] = key[userKeyIdx];
      
      userKeyIdx = (userKeyIdx + 9) % 15;
    }
    
    return unravelledKey;
  }

  /**
   * Core NewDES block transformation
   * @param {Array} block - 8-byte block to transform
   * @param {Array} unravelledKey - 60-byte key schedule
   */
  _newdesBlock(block, unravelledKey) {
    let keyPtr = 0;
    
    // 8 main rounds
    for (let round = 0; round < 8; round++) {
      // First half of round: B4-B7 = B4-B7 XOR rotor[B0-B3 XOR key]
      block[4] ^= this.rotor[block[0] ^ unravelledKey[keyPtr++]];
      block[5] ^= this.rotor[block[1] ^ unravelledKey[keyPtr++]];
      block[6] ^= this.rotor[block[2] ^ unravelledKey[keyPtr++]];
      block[7] ^= this.rotor[block[3] ^ unravelledKey[keyPtr++]];
      
      // Second half of round: B0-B3 transformation
      block[1] ^= this.rotor[block[4] ^ unravelledKey[keyPtr++]];
      block[2] ^= this.rotor[block[4] ^ block[5]];  // Note: uses B4 XOR B5, not key
      block[3] ^= this.rotor[block[6] ^ unravelledKey[keyPtr++]];
      block[0] ^= this.rotor[block[7] ^ unravelledKey[keyPtr++]];
    }
    
    // Final transformation (partial round)
    block[4] ^= this.rotor[block[0] ^ unravelledKey[keyPtr++]];
    block[5] ^= this.rotor[block[1] ^ unravelledKey[keyPtr++]];
    block[6] ^= this.rotor[block[2] ^ unravelledKey[keyPtr++]];
    block[7] ^= this.rotor[block[3] ^ unravelledKey[keyPtr++]];
  }

  /**
   * Encrypt a single block
   * @param {Array} block - 8-byte input block
   * @returns {Array} 8-byte encrypted block
   */
  _encryptBlock(block) {
    if (!this.encryptionKey || !block || block.length !== 8) {
      throw new Error("Invalid encryption state or block size");
    }
    
    // Copy input block
    const result = block.slice();
    
    // Apply NewDES encryption
    this._newdesBlock(result, this.encryptionKey);
    
    return result;
  }

  /**
   * Decrypt a single block
   * @param {Array} block - 8-byte encrypted block
   * @returns {Array} 8-byte decrypted block
   */
  _decryptBlock(block) {
    if (!this.decryptionKey || !block || block.length !== 8) {
      throw new Error("Invalid decryption state or block size");
    }
    
    // Copy input block
    const result = block.slice();
    
    // Apply NewDES decryption (uses different key schedule)
    this._newdesBlock(result, this.decryptionKey);
    
    return result;
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new NewDESAlgorithm());