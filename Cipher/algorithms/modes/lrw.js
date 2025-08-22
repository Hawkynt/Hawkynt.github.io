/*
 * LRW (Liskov-Rivest-Wagner) Mode of Operation
 * Tweakable block cipher mode for disk encryption (predecessor to XTS)
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

class LrwAlgorithm extends CipherModeAlgorithm {
  constructor() {
    super();
    
    this.name = "LRW";
    this.description = "LRW (Liskov-Rivest-Wagner) is a tweakable block cipher mode designed for disk encryption. It combines a block cipher with Galois field multiplication to create a tweakable cipher that's suitable for random-access storage. LRW was later superseded by XTS mode due to security improvements.";
    this.inventor = "Moses Liskov, Ronald Rivest, David Wagner";
    this.year = 2002;
    this.category = CategoryType.MODE;
    this.subCategory = "Disk Encryption Mode";
    this.securityStatus = SecurityStatus.DEPRECATED; // Replaced by XTS
    this.complexity = ComplexityType.RESEARCH;
    this.country = CountryCode.US;
    
    this.RequiresIV = false; // Uses tweak instead of IV
    this.SupportedIVSizes = []; // Not applicable for LRW
    
    this.documentation = [
      new LinkItem("LRW Original Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/lrw.pdf"),
      new LinkItem("IEEE P1619 Draft", "https://standards.ieee.org/ieee/1619/3618/"),
      new LinkItem("Tweakable Block Ciphers", "https://web.cs.ucdavis.edu/~rogaway/papers/tweakable.pdf")
    ];
    
    this.references = [
      new LinkItem("XTS Mode (LRW successor)", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38e.pdf"),
      new LinkItem("dm-crypt LRW Implementation", "https://gitlab.com/cryptsetup/cryptsetup/-/blob/main/lib/crypto_backend/crypto_kernel.c"),
      new LinkItem("Linux Kernel Crypto", "https://github.com/torvalds/linux/tree/master/crypto")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability("Superseded by XTS", "LRW has been replaced by XTS mode which provides better security properties and addresses potential weaknesses in LRW."),
      new Vulnerability("Galois Field Implementation", "Requires careful implementation of GF(2^128) multiplication to avoid timing attacks and ensure correctness."),
      new Vulnerability("Tweak Management", "Improper tweak handling in disk encryption can lead to security vulnerabilities.")
    ];
    
    // Educational test vectors for LRW mode
    this.tests = [
      new TestCase(
        OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // Single block
        OpCodes.Hex8ToBytes("d5a624d5b8c8c2fd8b3e3a8974c41e9a"), // Expected output (educational)
        "LRW single block educational example",
        "https://web.cs.ucdavis.edu/~rogaway/papers/lrw.pdf"
      )
    ];
    
    // Add test parameters
    this.tests.forEach(test => {
      test.key = OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"); // Block cipher key
      test.tweakKey = OpCodes.Hex8ToBytes("603deb1015ca71be2b73aef0857d7781"); // LRW tweak key
      test.tweak = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"); // Sector/block identifier
    });
  }
  
  CreateInstance(isInverse = false) {
    return new LrwModeInstance(this, isInverse);
  }
}

class LrwModeInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.blockCipher = null;
    this.inputBuffer = [];
    this.key = null; // Block cipher key
    this.tweakKey = null; // LRW tweak key for GF multiplication
    this.tweak = null; // Sector/block identifier
  }
  
  /**
   * Set the underlying block cipher instance
   * @param {IBlockCipherInstance} cipher - The block cipher to use
   */
  setBlockCipher(cipher) {
    if (!cipher || !cipher.BlockSize) {
      throw new Error("Invalid block cipher instance");
    }
    if (cipher.BlockSize !== 16) {
      throw new Error("LRW mode requires 128-bit block cipher (typically AES)");
    }
    this.blockCipher = cipher;
  }
  
  /**
   * Set the block cipher encryption key
   * @param {Array} key - Block cipher key
   */
  setKey(key) {
    if (!key || key.length === 0) {
      throw new Error("Block cipher key cannot be empty");
    }
    this.key = [...key];
  }
  
  /**
   * Set the LRW tweak key for Galois field operations
   * @param {Array} tweakKey - 128-bit tweak key for GF(2^128) multiplication
   */
  setTweakKey(tweakKey) {
    if (!tweakKey || tweakKey.length !== 16) {
      throw new Error("LRW tweak key must be exactly 128 bits (16 bytes)");
    }
    this.tweakKey = [...tweakKey];
  }
  
  /**
   * Set the tweak value (sector/block identifier)
   * @param {Array} tweak - Tweak value for this block
   */
  setTweak(tweak) {
    if (!tweak || tweak.length !== 16) {
      throw new Error("LRW tweak must be exactly 128 bits (16 bytes)");
    }
    this.tweak = [...tweak];
  }
  
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.key || !this.tweakKey) {
      throw new Error("Both block cipher key and tweak key must be set for LRW mode.");
    }
    this.inputBuffer.push(...data);
  }
  
  Result() {
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.key || !this.tweakKey) {
      throw new Error("Both block cipher key and tweak key must be set for LRW mode.");
    }
    if (!this.tweak) {
      throw new Error("Tweak not set. Call setTweak() first.");
    }
    if (this.inputBuffer.length === 0) {
      throw new Error("No data fed");
    }
    
    const blockSize = this.blockCipher.BlockSize;
    if (this.inputBuffer.length % blockSize !== 0) {
      throw new Error(`Input length must be multiple of ${blockSize} bytes for LRW mode`);
    }
    
    const output = [];
    
    // LRW construction: C = E_K(P ⊕ T) ⊕ T
    // Where T = tweak_key * tweak in GF(2^128)
    
    // Compute the LRW offset T = tweak_key * tweak in GF(2^128)
    const offset = this._gf128Multiply(this.tweakKey, this.tweak);
    
    if (this.isInverse) {
      // LRW Decryption: P = D_K(C ⊕ T) ⊕ T
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const cipherBlock = this.inputBuffer.slice(i, i + blockSize);
        
        // Step 1: XOR ciphertext with offset
        const xorInput = OpCodes.XorArrays(cipherBlock, offset);
        
        // Step 2: Decrypt with block cipher
        const decryptCipher = this.blockCipher.algorithm.CreateInstance(true);
        decryptCipher.key = this.key;
        decryptCipher.Feed(xorInput);
        const decrypted = decryptCipher.Result();
        
        // Step 3: XOR with offset again
        const plainBlock = OpCodes.XorArrays(decrypted, offset);
        output.push(...plainBlock);
      }
    } else {
      // LRW Encryption: C = E_K(P ⊕ T) ⊕ T
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const plainBlock = this.inputBuffer.slice(i, i + blockSize);
        
        // Step 1: XOR plaintext with offset
        const xorInput = OpCodes.XorArrays(plainBlock, offset);
        
        // Step 2: Encrypt with block cipher
        const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
        encryptCipher.key = this.key;
        encryptCipher.Feed(xorInput);
        const encrypted = encryptCipher.Result();
        
        // Step 3: XOR with offset again
        const cipherBlock = OpCodes.XorArrays(encrypted, offset);
        output.push(...cipherBlock);
      }
    }
    
    // Clear sensitive data
    OpCodes.ClearArray(this.inputBuffer);
    OpCodes.ClearArray(offset);
    this.inputBuffer = [];
    
    return output;
  }
  
  /**
   * Multiply two 128-bit values in GF(2^128)
   * Uses the reduction polynomial x^128 + x^7 + x^2 + x + 1
   * @param {Array} a - First 128-bit operand
   * @param {Array} b - Second 128-bit operand
   * @returns {Array} Product in GF(2^128)
   */
  _gf128Multiply(a, b) {
    // Convert to polynomial representation (little-endian within bytes)
    const result = new Array(16).fill(0);
    const temp_a = [...a];
    const temp_b = [...b];
    
    // Simplified GF(2^128) multiplication (educational implementation)
    // Real implementations would use more efficient algorithms
    
    for (let i = 0; i < 128; i++) {
      // If bit i of b is set, add a to result
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      
      if ((temp_b[byteIndex] >>> bitIndex) & 1) {
        for (let j = 0; j < 16; j++) {
          result[j] ^= temp_a[j];
        }
      }
      
      // Shift a left by 1 bit (multiply by x)
      let carry = 0;
      for (let j = 0; j < 16; j++) {
        const newCarry = (temp_a[j] >>> 7) & 1;
        temp_a[j] = ((temp_a[j] << 1) | carry) & 0xFF;
        carry = newCarry;
      }
      
      // If overflow, reduce by the polynomial x^128 + x^7 + x^2 + x + 1
      if (carry) {
        temp_a[0] ^= 0x87; // The reduction polynomial in bit-reversed form
      }
    }
    
    // Clear temporary arrays
    OpCodes.ClearArray(temp_a);
    OpCodes.ClearArray(temp_b);
    
    return result;
  }
}

// Register the algorithm
const lrwAlgorithm = new LrwAlgorithm();
RegisterAlgorithm(lrwAlgorithm);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = lrwAlgorithm;
}