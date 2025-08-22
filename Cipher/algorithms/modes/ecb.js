/*
 * ECB (Electronic Codebook) Mode of Operation
 * Educational implementation of the simplest block cipher mode
 * WARNING: ECB mode reveals patterns in plaintext - not secure for most applications
 * (c)2006-2025 Hawkynt
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
        CipherModeAlgorithm, IAlgorithmInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

class EcbAlgorithm extends CipherModeAlgorithm {
  constructor() {
    super();
    
    this.name = "ECB";
    this.description = "Electronic Codebook mode encrypts each block independently using the underlying block cipher. This is the simplest mode but reveals patterns in plaintext data, making it unsuitable for most cryptographic applications. Educational implementation for learning cipher modes.";
    this.inventor = "US National Bureau of Standards";
    this.year = 1977;
    this.category = CategoryType.MODE;
    this.subCategory = "Block Cipher Mode";
    this.securityStatus = SecurityStatus.BROKEN;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.US;
    
    this.RequiresIV = false;
    this.SupportedIVSizes = []; // ECB doesn't use IV
    
    this.documentation = [
      new LinkItem("NIST SP 800-38A", "https://csrc.nist.gov/publications/detail/sp/800-38a/final"),
      new LinkItem("FIPS 81 (Historical)", "https://csrc.nist.gov/csrc/media/publications/fips/81/archive/1980-12-02/documents/fips81.pdf")
    ];
    
    this.references = [
      new LinkItem("Cryptography Engineering", "Chapter on block cipher modes"),
      new LinkItem("Applied Cryptography", "Bruce Schneier - Chapter 9")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability("Pattern Leakage", "Identical plaintext blocks produce identical ciphertext blocks, revealing patterns"),
      new Vulnerability("Block Replay", "Individual blocks can be extracted and replayed in different positions"),
      new Vulnerability("Known Plaintext", "If attacker knows one block plaintext/ciphertext pair, identical blocks elsewhere are compromised")
    ];
    
    this.tests = [
      new TestCase(
        OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // Plain block
        OpCodes.Hex8ToBytes("3ad77bb40d7a3660a89ecaf32466ef97"), // Expected with AES-128
        "AES-128 ECB test vector",
        "NIST SP 800-38A"
      ),
      new TestCase(
        OpCodes.Hex8ToBytes("ae2d8a571e03ac9c9eb76fac45af8e51"), // Second block
        OpCodes.Hex8ToBytes("f5d3d58503b9699de785895a96fdbaaf"), // Expected with same key
        "AES-128 ECB second block",
        "NIST SP 800-38A"
      )
    ];
    
    // Add key parameter for tests
    this.tests.forEach(test => {
      test.key = OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"); // AES-128 test key
    });
  }
  
  CreateInstance(isInverse = false) {
    return new EcbModeInstance(this, isInverse);
  }
}

class EcbModeInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.blockCipher = null;
    this.inputBuffer = [];
  }
  
  /**
   * Set the underlying block cipher instance
   * @param {IBlockCipherInstance} cipher - The block cipher to use
   */
  setBlockCipher(cipher) {
    if (!cipher || !cipher.BlockSize) {
      throw new Error("Invalid block cipher instance");
    }
    this.blockCipher = cipher;
  }
  
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    this.inputBuffer.push(...data);
  }
  
  Result() {
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (this.inputBuffer.length === 0) {
      throw new Error("No data fed");
    }
    
    const blockSize = this.blockCipher.BlockSize;
    if (this.inputBuffer.length % blockSize !== 0) {
      throw new Error(`Input length must be multiple of ${blockSize} bytes for ECB mode`);
    }
    
    const output = [];
    
    // Process each block independently
    for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
      const block = this.inputBuffer.slice(i, i + blockSize);
      
      let processedBlock;
      if (this.isInverse) {
        // Decrypt: Apply block cipher decryption
        const decryptCipher = this.blockCipher.algorithm.CreateInstance(true);
        decryptCipher.key = this.blockCipher.key;
        decryptCipher.Feed(block);
        processedBlock = decryptCipher.Result();
      } else {
        // Encrypt: Apply block cipher encryption
        const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
        encryptCipher.key = this.blockCipher.key;
        encryptCipher.Feed(block);
        processedBlock = encryptCipher.Result();
      }
      
      output.push(...processedBlock);
    }
    
    // Clear input buffer for next operation
    OpCodes.ClearArray(this.inputBuffer);
    this.inputBuffer = [];
    
    return output;
  }
}

// Register the algorithm
const ecbAlgorithm = new EcbAlgorithm();
RegisterAlgorithm(ecbAlgorithm);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ecbAlgorithm;
}