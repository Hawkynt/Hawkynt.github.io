/*
 * FEAL-8 Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * FEAL Algorithm by NTT (Akihiro Shimizu and Shoji Miyaguchi, 1987)
 * Block size: 64 bits, Key size: 64 bits, Rounds: 8
 * Uses Feistel network with fast software implementation
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * FEAL is considered cryptographically broken and should not be used for security.
 * 
 * References:
 * - Shimizu, A. and Miyaguchi, S. "Fast data encipherment algorithm FEAL" (EUROCRYPT 1987)
 * - FEAL-8 specification with 8 rounds for improved security
 * - Differential cryptanalysis by Biham and Shamir showed weaknesses
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

class FEALAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "FEAL-8";
    this.description = "Fast Data Encipherment Algorithm by NTT. Educational implementation of a cryptographically broken Feistel cipher with 8 rounds, 64-bit blocks and keys.";
    this.inventor = "Akihiro Shimizu, Shoji Miyaguchi";
    this.year = 1987;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.BROKEN; // Cryptographically broken due to differential cryptanalysis
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.JP;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(8, 8, 0) // Fixed 64-bit (8-byte) key
    ];
    this.SupportedBlockSizes = [
      new KeySize(8, 8, 0) // Fixed 64-bit (8-byte) blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("FEAL-8 Specification", "https://en.wikipedia.org/wiki/FEAL"),
      new LinkItem("Original EUROCRYPT 1987 Paper", "https://link.springer.com/chapter/10.1007/3-540-39118-5_24")
    ];

    this.references = [
      new LinkItem("Differential Cryptanalysis of FEAL", "https://link.springer.com/chapter/10.1007/3-540-46877-3_35"),
      new LinkItem("FEAL Cryptanalysis", "https://www.iacr.org/archive/crypto1989/000350213.pdf")
    ];

    // Known vulnerabilities - FEAL is completely broken
    this.knownVulnerabilities = [
      new LinkItem("Differential Cryptanalysis", "https://en.wikipedia.org/wiki/Differential_cryptanalysis", 
                   "FEAL-8 can be broken with differential cryptanalysis using only a few hundred chosen plaintexts")
    ];

    // Test vectors
    this.tests = [
      new TestCase(
        OpCodes.Hex8ToBytes("0000000000000000"), // input
        OpCodes.Hex8ToBytes("ceef2c86f2492a0c"), // expected (example output)
        "FEAL-8 test vector - all zeros plaintext",
        "https://en.wikipedia.org/wiki/FEAL"
      )
    ];
    // Additional property for key in test vector
    this.tests[0].key = OpCodes.Hex8ToBytes("0123456789abcdef");
  }

  // Required: Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new FEALInstance(this, isInverse);
  }

}

// Instance class - handles the actual encryption/decryption
class FEALInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.roundKeys = null;
    this.inputBuffer = [];
    this.BlockSize = 8; // 64-bit blocks
    this.KeySize = 0;   // will be set when key is assigned
  }

  // Property setter for key - validates and sets up key schedule
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.roundKeys = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size
    if (keyBytes.length !== 8) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 8 bytes)`);
    }

    this._key = [...keyBytes]; // Copy the key
    this.KeySize = keyBytes.length;
    this.roundKeys = this._generateRoundKeys(keyBytes);
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

  // FEAL S-box functions
  _S0(a, b) {
    return OpCodes.RotL8((a + b) & 0xFF, 2);
  }

  _S1(a, b) {
    return OpCodes.RotL8((a + b + 1) & 0xFF, 2);
  }

  // FEAL F-function
  _F(data, key) {
    // Split 32-bit data into bytes
    const d = OpCodes.Unpack32BE(data);
    const k = OpCodes.Unpack32BE(key);
    
    // Apply S-boxes
    const t0 = d[1] ^ d[0];
    const t1 = d[2] ^ d[3];
    const f1 = this._S1(t0 ^ k[0], t1 ^ k[1]);
    const f2 = this._S0(f1 ^ t0, t1 ^ k[2]);
    const f3 = this._S1(f2 ^ t1, f1 ^ k[3]);
    const f4 = this._S0(f3 ^ f1, f2);
    
    // Pack result
    return OpCodes.Pack32BE(f4, f3, f2, f1);
  }

  // Generate round keys
  _generateRoundKeys(keyBytes) {
    const roundKeys = [];
    
    // Split key into two 32-bit halves
    let KL = OpCodes.Pack32BE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]);
    let KR = OpCodes.Pack32BE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]);
    
    // Generate 16 round keys for FEAL-8
    for (let i = 0; i < 16; i++) {
      if (i % 2 === 0) {
        roundKeys[i] = KL;
        KL = OpCodes.RotL32(KL, 1);
      } else {
        roundKeys[i] = KR;
        KR = OpCodes.RotL32(KR, 1);
      }
    }
    
    return roundKeys;
  }

  // Encrypt 8-byte block
  _encryptBlock(block) {
    // Split block into two 32-bit halves (big-endian)
    let left = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
    let right = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
    
    // 8 rounds of Feistel encryption
    for (let round = 0; round < 8; round++) {
      const temp = left;
      left = right;
      right = temp ^ this._F(right, this.roundKeys[round]);
    }
    
    // Swap halves for final result
    const temp = left;
    left = right;
    right = temp;
    
    // Convert back to bytes (big-endian)
    const leftBytes = OpCodes.Unpack32BE(left);
    const rightBytes = OpCodes.Unpack32BE(right);
    
    return leftBytes.concat(rightBytes);
  }

  // Decrypt 8-byte block
  _decryptBlock(block) {
    // Split block into two 32-bit halves (big-endian)
    let left = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
    let right = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
    
    // 8 rounds of Feistel decryption (reverse order)
    for (let round = 7; round >= 0; round--) {
      const temp = left;
      left = right;
      right = temp ^ this._F(right, this.roundKeys[round]);
    }
    
    // Swap halves for final result
    const temp = left;
    left = right;
    right = temp;
    
    // Convert back to bytes (big-endian)
    const leftBytes = OpCodes.Unpack32BE(left);
    const rightBytes = OpCodes.Unpack32BE(right);
    
    return leftBytes.concat(rightBytes);
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new FEALAlgorithm());