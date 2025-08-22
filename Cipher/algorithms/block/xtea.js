/*
 * XTEA (Extended TEA) Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * XTEA Algorithm by David Wheeler and Roger Needham (1997)
 * - 64-bit block cipher with 128-bit keys
 * - 64 rounds (32 cycles) using improved key schedule over TEA
 * - Magic constant: 0x9E3779B9 (derived from golden ratio)
 * - Addresses equivalent key problem and other weaknesses in TEA
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

class XTEAAlgorithm extends AlgorithmFramework.BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "XTEA";
    this.description = "Extended TEA cipher by Wheeler and Needham with improved key schedule and better security than TEA. Uses 64 rounds with 64-bit blocks and 128-bit keys. Educational cipher for understanding Feistel networks.";
    this.inventor = "David Wheeler, Roger Needham";
    this.year = 1997;
    this.category = AlgorithmFramework.CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
    this.complexity = AlgorithmFramework.ComplexityType.BEGINNER;
    this.country = AlgorithmFramework.CountryCode.GB;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new AlgorithmFramework.KeySize(16, 16, 1) // Fixed 128-bit key
    ];
    this.SupportedBlockSizes = [
      new AlgorithmFramework.KeySize(8, 8, 1) // Fixed 64-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new AlgorithmFramework.LinkItem("TEA extensions and corrections", "https://www.cix.co.uk/~klockstone/xtea.htm"),
      new AlgorithmFramework.LinkItem("Cambridge Computer Laboratory", "https://www.cl.cam.ac.uk/teaching/1415/SecurityII/"),
      new AlgorithmFramework.LinkItem("Block TEA improvements", "https://link.springer.com/chapter/10.1007/3-540-60590-8_29")
    ];

    this.references = [
      new AlgorithmFramework.LinkItem("Crypto++ XTEA Implementation", "https://github.com/weidai11/cryptopp/blob/master/xtea.cpp"),
      new AlgorithmFramework.LinkItem("Bouncy Castle XTEA Implementation", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines"),
      new AlgorithmFramework.LinkItem("Python XTEA Implementation", "https://pypi.org/project/xtea/")
    ];

    // Known vulnerabilities
    this.knownVulnerabilities = [
      new AlgorithmFramework.Vulnerability("Limited analysis", "https://www.schneier.com/academic/", "Less cryptanalysis compared to modern ciphers, potential unknown weaknesses exist", "Use modern standardized ciphers like AES for production applications"),
      new AlgorithmFramework.Vulnerability("Related-key attacks", "https://eprint.iacr.org/", "While improved over TEA, XTEA may still be vulnerable to certain related-key attacks", "Avoid key reuse and use proper key management practices")
    ];

    // Test vectors from various sources
    this.tests = [
      {
        text: "XTEA all-zeros test vector",
        uri: "Educational test vector",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("dee9d4d8f7131ed9")
      },
      {
        text: "XTEA pattern test vector",
        uri: "Educational test vector",
        input: OpCodes.Hex8ToBytes("0123456789abcdef"),
        key: OpCodes.Hex8ToBytes("0123456789abcdef0123456789abcdef"),
        expected: OpCodes.Hex8ToBytes("dd59ce6b8f15d1cd")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new XTEAInstance(this, isInverse);
  }
}

class XTEAInstance extends AlgorithmFramework.IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.keyWords = null;
    this.inputBuffer = [];
    this.BlockSize = 8;
    this.KeySize = 0;
    
    // XTEA constants
    this.CYCLES = 32;                          // XTEA uses 32 cycles (64 rounds)
    this.DELTA = 0x9E3779B9;                   // Magic constant: 2^32 / golden ratio
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.keyWords = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size
    if (keyBytes.length !== 16) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16)`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    
    // Convert 128-bit key to four 32-bit words (big-endian)
    this.keyWords = [
      (keyBytes[0] << 24) | (keyBytes[1] << 16) | (keyBytes[2] << 8) | keyBytes[3],
      (keyBytes[4] << 24) | (keyBytes[5] << 16) | (keyBytes[6] << 8) | keyBytes[7],
      (keyBytes[8] << 24) | (keyBytes[9] << 16) | (keyBytes[10] << 8) | keyBytes[11],
      (keyBytes[12] << 24) | (keyBytes[13] << 16) | (keyBytes[14] << 8) | keyBytes[15]
    ];
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
    
    // Process each 8-byte block
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

  // Encrypt 64-bit block
  _encryptBlock(block) {
    if (block.length !== 8) {
      throw new Error('XTEA block size must be exactly 8 bytes');
    }
    
    // Pack to 32-bit words (big-endian)
    let v0 = (block[0] << 24) | (block[1] << 16) | (block[2] << 8) | block[3];
    let v1 = (block[4] << 24) | (block[5] << 16) | (block[6] << 8) | block[7];
    
    let sum = 0;
    const delta = this.DELTA;
    
    // XTEA encryption using explicit unsigned arithmetic
    for (let i = 0; i < this.CYCLES; i++) {
      // First operation: v0 += ...
      const term1 = (((v1 << 4) ^ (v1 >>> 5)) + v1) >>> 0;
      const term2 = (sum + this.keyWords[sum & 3]) >>> 0;
      const xor_result = (term1 ^ term2) >>> 0;
      v0 = (v0 + xor_result) >>> 0;
      
      // Second operation: sum += delta
      sum = (sum + delta) >>> 0;
      
      // Third operation: v1 += ...
      const term3 = (((v0 << 4) ^ (v0 >>> 5)) + v0) >>> 0;
      const term4 = (sum + this.keyWords[(sum >>> 11) & 3]) >>> 0;
      const xor_result2 = (term3 ^ term4) >>> 0;
      v1 = (v1 + xor_result2) >>> 0;
    }
    
    // Unpack to bytes (big-endian)
    return [
      (v0 >>> 24) & 0xFF, (v0 >>> 16) & 0xFF, (v0 >>> 8) & 0xFF, v0 & 0xFF,
      (v1 >>> 24) & 0xFF, (v1 >>> 16) & 0xFF, (v1 >>> 8) & 0xFF, v1 & 0xFF
    ];
  }

  // Decrypt 64-bit block
  _decryptBlock(block) {
    if (block.length !== 8) {
      throw new Error('XTEA block size must be exactly 8 bytes');
    }
    
    // Pack to 32-bit words (big-endian)
    let v0 = (block[0] << 24) | (block[1] << 16) | (block[2] << 8) | block[3];
    let v1 = (block[4] << 24) | (block[5] << 16) | (block[6] << 8) | block[7];
    
    const delta = this.DELTA;
    let sum = (delta * this.CYCLES) >>> 0;
    
    // XTEA decryption using explicit unsigned arithmetic (reverse of encryption)
    for (let i = 0; i < this.CYCLES; i++) {
      // First operation: v1 -= ...
      const term1 = (((v0 << 4) ^ (v0 >>> 5)) + v0) >>> 0;
      const term2 = (sum + this.keyWords[(sum >>> 11) & 3]) >>> 0;
      const xor_result = (term1 ^ term2) >>> 0;
      v1 = (v1 - xor_result) >>> 0;
      
      // Second operation: sum -= delta
      sum = (sum - delta) >>> 0;
      
      // Third operation: v0 -= ...
      const term3 = (((v1 << 4) ^ (v1 >>> 5)) + v1) >>> 0;
      const term4 = (sum + this.keyWords[sum & 3]) >>> 0;
      const xor_result2 = (term3 ^ term4) >>> 0;
      v0 = (v0 - xor_result2) >>> 0;
    }
    
    // Unpack to bytes (big-endian)
    return [
      (v0 >>> 24) & 0xFF, (v0 >>> 16) & 0xFF, (v0 >>> 8) & 0xFF, v0 & 0xFF,
      (v1 >>> 24) & 0xFF, (v1 >>> 16) & 0xFF, (v1 >>> 8) & 0xFF, v1 & 0xFF
    ];
  }
}

// Register the algorithm
AlgorithmFramework.RegisterAlgorithm(new XTEAAlgorithm());