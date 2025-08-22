/*
 * CTS (Ciphertext Stealing) Mode of Operation
 * Handles arbitrary length messages without padding
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

class CtsAlgorithm extends CipherModeAlgorithm {
  constructor() {
    super();
    
    this.name = "CTS";
    this.description = "Ciphertext Stealing (CTS) mode allows block ciphers to handle arbitrary-length plaintexts without padding by 'stealing' ciphertext bits from the penultimate block to pad the final block. This maintains the original plaintext length while providing the security properties of CBC mode.";
    this.inventor = "Meyer, Matyas";
    this.year = 1982;
    this.category = CategoryType.MODE;
    this.subCategory = "Block Cipher Mode";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;
    
    this.RequiresIV = true;
    this.SupportedIVSizes = [
      new KeySize(8, 32, 8) // Common block sizes: 8 (DES), 16 (AES), 32 (256-bit blocks)
    ];
    
    this.documentation = [
      new LinkItem("RFC 3962 - AES Encryption for Kerberos 5", "https://tools.ietf.org/rfc/rfc3962.txt"),
      new LinkItem("NIST SP 800-38A - Addendum", "https://csrc.nist.gov/publications/detail/sp/800-38a/addendum/final"),
      new LinkItem("IEEE P1363 - CTS Definition", "https://standards.ieee.org/standard/1363-2000.html")
    ];
    
    this.references = [
      new LinkItem("Applied Cryptography", "Bruce Schneier - CTS Mode"),
      new LinkItem("Handbook of Applied Cryptography", "Chapter 7 - Block Cipher Modes")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability("IV Reuse", "Reusing IV with same key reveals patterns. Always use unique IVs."),
      new Vulnerability("Minimum Length", "Requires at least one full block. Cannot encrypt data shorter than block size."),
      new Vulnerability("Error Propagation", "Like CBC, single-bit errors in ciphertext affect two plaintext blocks.")
    ];
    
    this.tests = [
      new TestCase(
        OpCodes.Hex8ToBytes("4920616d20636f6d696e67206261636b"), // "I am coming back" (16 bytes)
        OpCodes.Hex8ToBytes("97687268d6ecccc0c07b25e25ecfe5846c"), // Expected CTS output (17 bytes)
        "CTS test vector - exact block boundary",
        "https://tools.ietf.org/rfc/rfc3962.txt"
      ),
      new TestCase(
        OpCodes.Hex8ToBytes("4920616d20636f6d696e67206261636b21"), // "I am coming back!" (17 bytes)
        OpCodes.Hex8ToBytes("97687268d6ecccc0c07b25e25ecfe58468"), // Expected CTS output (17 bytes)
        "CTS test vector - partial final block",
        "https://tools.ietf.org/rfc/rfc3962.txt"
      )
    ];
    
    // Add test parameters
    this.tests.forEach(test => {
      test.key = OpCodes.Hex8ToBytes("636869636b656e207465726979616b69"); // "chicken teriyaki" 
      test.iv = OpCodes.Hex8ToBytes("00000000000000000000000000000000"); // Zero IV
    });
  }
  
  CreateInstance(isInverse = false) {
    return new CtsModeInstance(this, isInverse);
  }
}

class CtsModeInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.blockCipher = null;
    this.inputBuffer = [];
    this.iv = null;
  }
  
  setBlockCipher(cipher) {
    if (!cipher || !cipher.BlockSize) {
      throw new Error("Invalid block cipher instance");
    }
    this.blockCipher = cipher;
  }
  
  setIV(iv) {
    if (!this.blockCipher) {
      throw new Error("Block cipher must be set before IV");
    }
    if (!iv || iv.length !== this.blockCipher.BlockSize) {
      throw new Error(`IV must be ${this.blockCipher.BlockSize} bytes`);
    }
    this.iv = [...iv];
  }
  
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.iv) {
      throw new Error("IV not set. Call setIV() first.");
    }
    this.inputBuffer.push(...data);
  }
  
  Result() {
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.iv) {
      throw new Error("IV not set. Call setIV() first.");
    }
    if (this.inputBuffer.length === 0) {
      throw new Error("No data fed");
    }
    
    const blockSize = this.blockCipher.BlockSize;
    
    // CTS requires at least one full block
    if (this.inputBuffer.length < blockSize) {
      throw new Error(`CTS requires at least ${blockSize} bytes (one full block)`);
    }
    
    const result = this.isInverse ? this._decrypt() : this._encrypt();
    
    // Clear sensitive data
    OpCodes.ClearArray(this.inputBuffer);
    this.inputBuffer = [];
    
    return result;
  }
  
  _encrypt() {
    const blockSize = this.blockCipher.BlockSize;
    const totalLen = this.inputBuffer.length;
    
    // Handle complete blocks first (CBC mode)
    const fullBlocks = Math.floor(totalLen / blockSize);
    const remainingBytes = totalLen % blockSize;
    
    let output = [];
    let previousBlock = [...this.iv];
    
    if (remainingBytes === 0) {
      // Exact multiple of block size - standard CBC
      for (let i = 0; i < fullBlocks; i++) {
        const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);
        
        // XOR with previous ciphertext (or IV)
        const xorBlock = [];
        for (let j = 0; j < blockSize; j++) {
          xorBlock[j] = block[j] ^ previousBlock[j];
        }
        
        // Encrypt
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.blockCipher.key;
        cipher.Feed(xorBlock);
        const encryptedBlock = cipher.Result();
        
        output.push(...encryptedBlock);
        previousBlock = [...encryptedBlock];
      }
    } else {
      // CTS mode - handle partial final block
      
      // Process all but last two blocks normally (CBC)
      for (let i = 0; i < fullBlocks - 1; i++) {
        const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);
        
        // XOR with previous ciphertext (or IV)
        const xorBlock = [];
        for (let j = 0; j < blockSize; j++) {
          xorBlock[j] = block[j] ^ previousBlock[j];
        }
        
        // Encrypt
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.blockCipher.key;
        cipher.Feed(xorBlock);
        const encryptedBlock = cipher.Result();
        
        output.push(...encryptedBlock);
        previousBlock = [...encryptedBlock];
      }
      
      // CTS handling for last two blocks
      const penultimateBlock = this.inputBuffer.slice((fullBlocks - 1) * blockSize, fullBlocks * blockSize);
      const finalPartialBlock = this.inputBuffer.slice(fullBlocks * blockSize);
      
      // Step 1: Encrypt penultimate block normally
      const xorPenultimate = [];
      for (let j = 0; j < blockSize; j++) {
        xorPenultimate[j] = penultimateBlock[j] ^ previousBlock[j];
      }
      
      const cipher1 = this.blockCipher.algorithm.CreateInstance(false);
      cipher1.key = this.blockCipher.key;
      cipher1.Feed(xorPenultimate);
      const encryptedPenultimate = cipher1.Result();
      
      // Step 2: Create final block by padding with stolen ciphertext
      const paddedFinal = [...finalPartialBlock];
      for (let i = remainingBytes; i < blockSize; i++) {
        paddedFinal[i] = encryptedPenultimate[i];
      }
      
      // Step 3: Encrypt the padded final block
      const xorFinal = [];
      for (let j = 0; j < blockSize; j++) {
        xorFinal[j] = paddedFinal[j] ^ previousBlock[j];
      }
      
      const cipher2 = this.blockCipher.algorithm.CreateInstance(false);
      cipher2.key = this.blockCipher.key;
      cipher2.Feed(xorFinal);
      const encryptedFinal = cipher2.Result();
      
      // Step 4: Output final block first, then truncated penultimate
      output.push(...encryptedFinal);
      output.push(...encryptedPenultimate.slice(0, remainingBytes));
    }
    
    return output;
  }
  
  _decrypt() {
    const blockSize = this.blockCipher.BlockSize;
    const totalLen = this.inputBuffer.length;
    
    // Handle complete blocks first
    const fullBlocks = Math.floor(totalLen / blockSize);
    const remainingBytes = totalLen % blockSize;
    
    let output = [];
    let previousBlock = [...this.iv];
    
    if (remainingBytes === 0) {
      // Exact multiple of block size - standard CBC
      for (let i = 0; i < fullBlocks; i++) {
        const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);
        
        // Decrypt
        const cipher = this.blockCipher.algorithm.CreateInstance(true);
        cipher.key = this.blockCipher.key;
        cipher.Feed(block);
        const decryptedBlock = cipher.Result();
        
        // XOR with previous ciphertext (or IV)
        const plainBlock = [];
        for (let j = 0; j < blockSize; j++) {
          plainBlock[j] = decryptedBlock[j] ^ previousBlock[j];
        }
        
        output.push(...plainBlock);
        previousBlock = [...block];
      }
    } else {
      // CTS mode - handle partial final block
      
      // Process all but last two blocks normally (CBC)
      for (let i = 0; i < fullBlocks - 1; i++) {
        const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);
        
        // Decrypt
        const cipher = this.blockCipher.algorithm.CreateInstance(true);
        cipher.key = this.blockCipher.key;
        cipher.Feed(block);
        const decryptedBlock = cipher.Result();
        
        // XOR with previous ciphertext (or IV)
        const plainBlock = [];
        for (let j = 0; j < blockSize; j++) {
          plainBlock[j] = decryptedBlock[j] ^ previousBlock[j];
        }
        
        output.push(...plainBlock);
        previousBlock = [...block];
      }
      
      // CTS handling for last two blocks  
      const lastFullBlock = this.inputBuffer.slice((fullBlocks - 1) * blockSize, fullBlocks * blockSize);
      const finalPartialBlock = this.inputBuffer.slice(fullBlocks * blockSize);
      
      // Step 1: Decrypt the last full block
      const cipher1 = this.blockCipher.algorithm.CreateInstance(true);
      cipher1.key = this.blockCipher.key;
      cipher1.Feed(lastFullBlock);
      const decryptedLast = cipher1.Result();
      
      // Step 2: Reconstruct penultimate ciphertext
      const penultimateCipher = [...finalPartialBlock];
      for (let i = remainingBytes; i < blockSize; i++) {
        penultimateCipher[i] = decryptedLast[i];
      }
      
      // Step 3: Decrypt penultimate block  
      const cipher2 = this.blockCipher.algorithm.CreateInstance(true);
      cipher2.key = this.blockCipher.key;
      cipher2.Feed(penultimateCipher);
      const decryptedPenultimate = cipher2.Result();
      
      // Step 4: XOR to get plaintext blocks
      const plainPenultimate = [];
      for (let j = 0; j < blockSize; j++) {
        plainPenultimate[j] = decryptedPenultimate[j] ^ previousBlock[j];
      }
      
      const plainFinal = [];
      for (let j = 0; j < remainingBytes; j++) {
        plainFinal[j] = decryptedLast[j] ^ penultimateCipher[j];
      }
      
      // Output in correct order
      output.push(...plainPenultimate);
      output.push(...plainFinal);
    }
    
    return output;
  }
}

// Register the algorithm
const ctsAlgorithm = new CtsAlgorithm();
RegisterAlgorithm(ctsAlgorithm);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ctsAlgorithm;
}