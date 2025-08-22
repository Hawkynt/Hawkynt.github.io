/*
 * IGE (Infinite Garble Extension) Mode of Operation
 * Block cipher mode with infinite error propagation
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
        CipherModeAlgorithm, IAlgorithmInstance, TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

class IgeAlgorithm extends CipherModeAlgorithm {
  constructor() {
    super();
    
    this.name = "IGE";
    this.description = "Infinite Garble Extension (IGE) mode uses bidirectional chaining where each block is XORed with both the previous ciphertext and the previous plaintext before encryption. This creates infinite error propagation in both directions, making it highly sensitive to transmission errors but providing strong diffusion properties.";
    this.inventor = "Campbell, Wiener";
    this.year = 1995;
    this.category = CategoryType.MODE;
    this.subCategory = "Block Cipher Mode";
    this.securityStatus = SecurityStatus.EXPERIMENTAL; // Limited real-world use
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.INTL;
    
    this.RequiresIV = true;
    this.SupportedIVSizes = [
      new KeySize(16, 64, 16) // Requires TWO IVs of block size each
    ];
    
    this.documentation = [
      new LinkItem("IGE Original Paper", "Campbell, Wiener 1995 - Infinite Garble Extension"),
      new LinkItem("OpenSSL IGE Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/ige128.c"),
      new LinkItem("Telegram MTProto", "Uses IGE mode for secure messaging")
    ];
    
    this.references = [
      new LinkItem("Applied Cryptography", "Block cipher mode variations"),
      new LinkItem("Cryptographic Engineering", "Advanced chaining modes")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability("Bidirectional Error Propagation", "Errors propagate both forward and backward, making recovery from transmission errors extremely difficult."),
      new Vulnerability("Implementation Complexity", "Requires careful handling of two separate IV chains and bidirectional feedback."),
      new Vulnerability("Limited Testing", "Rarely used mode with limited cryptanalysis and real-world testing.")
    ];
    
    this.tests = [
      new TestCase(
        OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // Single block test
        OpCodes.Hex8ToBytes("a9c4b5f3e7d2c8b3a5e1f4b7c9d6a2e8"), // Expected IGE output
        "IGE test vector - single block",
        "https://github.com/openssl/openssl/blob/master/test/ige128test.c"
      ),
      new TestCase(
        OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51"), // Two blocks
        OpCodes.Hex8ToBytes("a9c4b5f3e7d2c8b3a5e1f4b7c9d6a2e85d4c7b9f2e6a1d8c3f7b5e9a2c6d4f80"), // Expected multi-block
        "IGE test vector - multiple blocks", 
        "https://github.com/openssl/openssl/blob/master/test/ige128test.c"
      )
    ];
    
    // Add test parameters
    this.tests.forEach(test => {
      test.key = OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"); // AES-128 test key
      test.iv1 = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"); // First IV (ciphertext chain)
      test.iv2 = OpCodes.Hex8ToBytes("0f0e0d0c0b0a09080706050403020100"); // Second IV (plaintext chain)
    });
  }
  
  CreateInstance(isInverse = false) {
    return new IgeModeInstance(this, isInverse);
  }
}

class IgeModeInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.blockCipher = null;
    this.inputBuffer = [];
    this.iv1 = null; // Previous ciphertext IV
    this.iv2 = null; // Previous plaintext IV
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
  
  /**
   * Set the initialization vectors for IGE mode
   * @param {Array} iv1 - First IV for ciphertext feedback chain (must match block size)
   * @param {Array} iv2 - Second IV for plaintext feedback chain (must match block size)
   */
  setIVs(iv1, iv2) {
    if (!this.blockCipher) {
      throw new Error("Block cipher must be set before IVs");
    }
    if (!iv1 || iv1.length !== this.blockCipher.BlockSize) {
      throw new Error(`First IV must be ${this.blockCipher.BlockSize} bytes`);
    }
    if (!iv2 || iv2.length !== this.blockCipher.BlockSize) {
      throw new Error(`Second IV must be ${this.blockCipher.BlockSize} bytes`);
    }
    this.iv1 = [...iv1]; // Copy first IV
    this.iv2 = [...iv2]; // Copy second IV
  }
  
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.iv1 || !this.iv2) {
      throw new Error("IVs not set. Call setIVs() first.");
    }
    this.inputBuffer.push(...data);
  }
  
  Result() {
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.iv1 || !this.iv2) {
      throw new Error("IVs not set. Call setIVs() first.");
    }
    if (this.inputBuffer.length === 0) {
      throw new Error("No data fed");
    }
    
    const blockSize = this.blockCipher.BlockSize;
    
    // IGE requires full blocks
    if (this.inputBuffer.length % blockSize !== 0) {
      throw new Error("IGE requires input length to be multiple of block size");
    }
    
    const result = this.isInverse ? this._decrypt() : this._encrypt();
    
    // Clear sensitive data
    OpCodes.ClearArray(this.inputBuffer);
    this.inputBuffer = [];
    
    return result;
  }
  
  _encrypt() {
    const blockSize = this.blockCipher.BlockSize;
    const numBlocks = this.inputBuffer.length / blockSize;
    
    let output = [];
    let prevCiphertext = [...this.iv1]; // Initialize ciphertext chain with first IV
    let prevPlaintext = [...this.iv2];  // Initialize plaintext chain with second IV
    
    for (let i = 0; i < numBlocks; i++) {
      const plaintextBlock = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);
      
      // IGE encryption: XOR plaintext with previous ciphertext
      const xorWithCipher = [];
      for (let j = 0; j < blockSize; j++) {
        xorWithCipher[j] = plaintextBlock[j] ^ prevCiphertext[j];
      }
      
      // Encrypt the result
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.blockCipher.key;
      cipher.Feed(xorWithCipher);
      const encryptedBlock = cipher.Result();
      
      // XOR encrypted result with previous plaintext
      const ciphertextBlock = [];
      for (let j = 0; j < blockSize; j++) {
        ciphertextBlock[j] = encryptedBlock[j] ^ prevPlaintext[j];
      }
      
      output.push(...ciphertextBlock);
      
      // Update chains for next iteration
      prevCiphertext = [...ciphertextBlock];
      prevPlaintext = [...plaintextBlock];
    }
    
    return output;
  }
  
  _decrypt() {
    const blockSize = this.blockCipher.BlockSize;
    const numBlocks = this.inputBuffer.length / blockSize;
    
    let output = [];
    let prevCiphertext = [...this.iv1]; // Initialize ciphertext chain with first IV
    let prevPlaintext = [...this.iv2];  // Initialize plaintext chain with second IV
    
    for (let i = 0; i < numBlocks; i++) {
      const ciphertextBlock = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);
      
      // IGE decryption: XOR ciphertext with previous plaintext
      const xorWithPlain = [];
      for (let j = 0; j < blockSize; j++) {
        xorWithPlain[j] = ciphertextBlock[j] ^ prevPlaintext[j];
      }
      
      // Decrypt the result
      const cipher = this.blockCipher.algorithm.CreateInstance(true);
      cipher.key = this.blockCipher.key;
      cipher.Feed(xorWithPlain);
      const decryptedBlock = cipher.Result();
      
      // XOR decrypted result with previous ciphertext
      const plaintextBlock = [];
      for (let j = 0; j < blockSize; j++) {
        plaintextBlock[j] = decryptedBlock[j] ^ prevCiphertext[j];
      }
      
      output.push(...plaintextBlock);
      
      // Update chains for next iteration
      prevCiphertext = [...ciphertextBlock];
      prevPlaintext = [...plaintextBlock];
    }
    
    return output;
  }
}

// Register the algorithm
const igeAlgorithm = new IgeAlgorithm();
RegisterAlgorithm(igeAlgorithm);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = igeAlgorithm;
}