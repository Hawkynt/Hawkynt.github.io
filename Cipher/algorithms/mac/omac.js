/*
 * OMAC/CMAC (One-Key Cipher-Based Message Authentication Code) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * NIST SP 800-38B compliant OMAC/CMAC implementation
 * Provides cryptographic authentication using AES block cipher
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

// Load required AES algorithm for OMAC functionality
if (typeof require !== 'undefined') {
  try {
    require('../block/rijndael.js');
  } catch (e) {
    // Could not load AES dependency for OMAC
  }
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class OMACAlgorithm extends MacAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "OMAC/CMAC";
    this.description = "One-Key Cipher-Based Message Authentication Code as defined in NIST SP 800-38B. Provides provably secure message authentication using a single key with any block cipher.";
    this.inventor = "Tetsu Iwata, Kaoru Kurosawa";
    this.year = 2003;
    this.category = CategoryType.MAC;
    this.subCategory = "Block Cipher MAC";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.JP;
    
    // MAC-specific configuration
    this.SupportedMacSizes = [
      new KeySize(16, 16, 1)  // AES-128 produces 16-byte MAC
    ];
    this.NeedsKey = true;
    
    // Documentation links
    this.documentation = [
      new LinkItem("NIST SP 800-38B - CMAC Mode for Authentication", "https://csrc.nist.gov/publications/detail/sp/800-38b/final"),
      new LinkItem("RFC 4493 - The AES-CMAC Algorithm", "https://tools.ietf.org/rfc/rfc4493.txt"),
      new LinkItem("Original OMAC Paper", "https://www.iacr.org/archive/fse2003/28870015/28870015.pdf")
    ];
    
    // Reference links
    this.references = [
      new LinkItem("OpenSSL CMAC Implementation", "https://github.com/openssl/openssl/blob/master/crypto/cmac/"),
      new LinkItem("Botan CMAC", "https://botan.randombit.net/handbook/api_ref/mac.html"),
      new LinkItem("NIST Test Vectors", "https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program")
    ];
    
    // Known vulnerabilities
    this.knownVulnerabilities = [
      new LinkItem("Weak Block Cipher", "OMAC security depends entirely on underlying block cipher - use AES"),
      new LinkItem("Key Reuse", "Use unique keys for different applications and contexts")
    ];
    
    // Test vectors from NIST SP 800-38B and RFC 4493
    this.tests = [
      // Test Case 1: Empty message
      {
        text: "NIST SP 800-38B Example 1 - Empty Message",
        uri: "https://csrc.nist.gov/publications/detail/sp/800-38b/final",
        input: [],
        key: [0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c],
        expected: [0xbb, 0x1d, 0x69, 0x29, 0xe9, 0x59, 0x37, 0x28, 0x7f, 0xa3, 0x7d, 0x12, 0x9b, 0x75, 0x67, 0x46]
      },
      // Test Case 2: Single block
      {
        text: "NIST SP 800-38B Example 2 - Single Block",
        uri: "https://csrc.nist.gov/publications/detail/sp/800-38b/final",
        input: [0x6b, 0xc1, 0xbe, 0xe2, 0x2e, 0x40, 0x9f, 0x96, 0xe9, 0x3d, 0x7e, 0x11, 0x73, 0x93, 0x17, 0x2a],
        key: [0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c],
        expected: [0x07, 0x0a, 0x16, 0xb4, 0x6b, 0x4d, 0x41, 0x44, 0xf7, 0x9b, 0xdd, 0x9d, 0xd0, 0x4a, 0x28, 0x7c]
      }
    ];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // OMAC cannot be reversed
    }
    return new OMACInstance(this);
  }
}

// Instance class - handles the actual OMAC computation
class OMACInstance extends IMacInstance {
  constructor(algorithm) {
    super(algorithm);
    this._key = null;
    this.inputBuffer = [];
    this.aesInstance = null;
    this.k1 = null;
    this.k2 = null;
    this.intermediate = new Array(16).fill(0);
    this.blockSize = 16;
  }

  // Property setter for key
  set key(keyBytes) {
    if (!keyBytes || !Array.isArray(keyBytes)) {
      throw new Error("Invalid key - must be byte array");
    }
    if (keyBytes.length !== 16) {
      throw new Error("OMAC requires 128-bit (16-byte) key for AES");
    }
    this._key = [...keyBytes]; // Store copy
    this._initializeAES();
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  // Initialize AES and generate subkeys
  _initializeAES() {
    if (!this._key) return;
    
    // Find AES algorithm
    const aesAlgorithm = AlgorithmFramework.Find("AES") || AlgorithmFramework.Find("Rijndael (AES)");
    if (!aesAlgorithm) {
      throw new Error("AES algorithm not found in framework");
    }

    // Create AES instance and set key
    this.aesInstance = aesAlgorithm.CreateInstance();
    if (!this.aesInstance) {
      throw new Error("Cannot create AES instance");
    }

    this.aesInstance.key = this._key;

    // Generate OMAC subkeys K1 and K2
    this._generateSubkeys();
  }

  // Generate OMAC subkeys K1 and K2 from L = E_K(0^128)
  _generateSubkeys() {
    // Step 1: L = E_K(0^128)
    const zeroBlock = new Array(16).fill(0);
    this.aesInstance.Feed(zeroBlock);
    const L = this.aesInstance.Result();

    // Step 2: K1 = L << 1 with conditional reduction by R_b
    this.k1 = this._leftShiftWithReduction(L);

    // Step 3: K2 = K1 << 1 with conditional reduction by R_b
    this.k2 = this._leftShiftWithReduction(this.k1);
  }

  // Left shift with reduction for subkey generation
  _leftShiftWithReduction(block) {
    const result = new Array(block.length);
    let carry = 0;

    // Left shift from MSB to LSB
    for (let i = 0; i < block.length; i++) {
      const newCarry = (block[i] & 0x80) ? 1 : 0;
      result[i] = ((block[i] << 1) | carry) & 0xFF;
      carry = newCarry;
    }

    // Apply reduction polynomial if MSB was set
    if (carry) {
      result[result.length - 1] ^= 0x87; // R_128 = x^7 + x^2 + x + 1
    }

    return result;
  }

  // Feed data to the MAC
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!Array.isArray(data)) {
      throw new Error("Invalid input data - must be byte array");
    }
    this.inputBuffer.push(...data);
  }

  // Get the MAC result
  Result() {
    if (!this._key) {
      throw new Error("Key not set");
    }
    
    if (!this.aesInstance || !this.k1 || !this.k2) {
      throw new Error("OMAC not properly initialized");
    }

    // Process complete blocks
    const messageBuffer = [...this.inputBuffer];
    this.intermediate = new Array(16).fill(0);

    // Process complete blocks with CBC-MAC
    while (messageBuffer.length >= 16) {
      const block = messageBuffer.splice(0, 16);
      
      // XOR with previous intermediate value
      for (let i = 0; i < 16; i++) {
        block[i] ^= this.intermediate[i];
      }
      
      // Encrypt block
      const aes = AlgorithmFramework.Find("AES") || AlgorithmFramework.Find("Rijndael (AES)");
      const aesInst = aes.CreateInstance();
      aesInst.key = this._key;
      aesInst.Feed(block);
      this.intermediate = aesInst.Result();
    }

    // Handle final block with OMAC padding and subkey selection
    let finalBlock;
    
    if (messageBuffer.length === 16) {
      // Complete final block - use K1
      finalBlock = [...messageBuffer];
      for (let i = 0; i < 16; i++) {
        finalBlock[i] ^= this.k1[i];
      }
    } else {
      // Incomplete final block - apply 10* padding and use K2
      const paddedMessage = [...messageBuffer];
      paddedMessage.push(0x80); // 10* padding starts with 1 bit
      
      while (paddedMessage.length < 16) {
        paddedMessage.push(0x00);
      }
      
      finalBlock = paddedMessage;
      for (let i = 0; i < 16; i++) {
        finalBlock[i] ^= this.k2[i];
      }
    }
    
    // XOR with intermediate value
    for (let i = 0; i < 16; i++) {
      finalBlock[i] ^= this.intermediate[i];
    }
    
    // Final encryption to get MAC
    const aes = AlgorithmFramework.Find("AES") || AlgorithmFramework.Find("Rijndael (AES)");
    const aesInst = aes.CreateInstance();
    aesInst.key = this._key;
    aesInst.Feed(finalBlock);
    const mac = aesInst.Result();

    // Clear buffer for next use
    this.inputBuffer = [];
    return mac;
  }

  // Compute MAC (IMacInstance interface)
  ComputeMac(data) {
    if (!this._key) {
      throw new Error("Key not set");
    }
    if (!Array.isArray(data)) {
      throw new Error("Invalid input data - must be byte array");
    }
    
    // Feed data and get result
    this.Feed(data);
    return this.Result();
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new OMACAlgorithm());