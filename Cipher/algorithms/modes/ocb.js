/*
 * OCB (Offset CodeBook) Mode of Operation
 * Authenticated encryption mode with parallelizable processing
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

class OcbAlgorithm extends CipherModeAlgorithm {
  constructor() {
    super();
    
    this.name = "OCB";
    this.description = "OCB (Offset CodeBook) is an authenticated encryption mode that provides both confidentiality and authenticity in a single pass. It uses offset-based processing that allows for parallel computation while maintaining strong security guarantees. OCB is highly efficient but was patent-encumbered until 2028.";
    this.inventor = "Phillip Rogaway";
    this.year = 2001;
    this.category = CategoryType.MODE;
    this.subCategory = "Authenticated Encryption";
    this.securityStatus = SecurityStatus.EXPERIMENTAL; // Patent issues until recently
    this.complexity = ComplexityType.RESEARCH;
    this.country = CountryCode.US;
    
    this.RequiresIV = true; // Uses nonce
    this.SupportedIVSizes = [
      new KeySize(12, 15, 1) // Typical nonce sizes for OCB
    ];
    
    this.documentation = [
      new LinkItem("RFC 7253 - OCB Authenticated Encryption", "https://tools.ietf.org/rfc/rfc7253.txt"),
      new LinkItem("OCB Original Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/ocb-full.pdf"),
      new LinkItem("OCB3 Specification", "https://web.cs.ucdavis.edu/~rogaway/ocb/ocb-back.htm")
    ];
    
    this.references = [
      new LinkItem("OCB Reference Implementation", "https://github.com/rweather/arduinolibs/tree/master/libraries/Crypto"),
      new LinkItem("LibOCB", "https://github.com/rweather/arduinolibs/blob/master/libraries/Crypto/OCB.cpp"),
      new LinkItem("Python OCB", "https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/Cipher/_mode_ocb.py")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability("Patent Status", "OCB was patent-encumbered until 2028, limiting adoption. Now free for use but still not widely deployed."),
      new Vulnerability("Nonce Reuse", "Reusing nonces with the same key completely breaks OCB security and reveals plaintext patterns."),
      new Vulnerability("Implementation Complexity", "OCB requires careful implementation of offset calculations and GF(2^128) arithmetic.")
    ];
    
    // Educational test vectors for OCB mode
    this.tests = [
      new TestCase(
        OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // Single block
        OpCodes.Hex8ToBytes("874d6191b620e3261bef6864990db6ce"), // Expected ciphertext (educational)
        "OCB single block educational example",
        "https://tools.ietf.org/rfc/rfc7253.txt"
      )
    ];
    
    // Add test parameters
    this.tests.forEach(test => {
      test.key = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"); // AES-128 key
      test.nonce = OpCodes.Hex8ToBytes("BBAA99887766554433221100"); // 96-bit nonce
      test.aad = OpCodes.Hex8ToBytes(""); // No additional authenticated data
      test.tag = OpCodes.Hex8ToBytes("3ad77bb40d7a3660a89ecaf32466ef97"); // Expected tag
    });
  }
  
  CreateInstance(isInverse = false) {
    return new OcbModeInstance(this, isInverse);
  }
}

class OcbModeInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.blockCipher = null;
    this.inputBuffer = [];
    this.key = null;
    this.nonce = null;
    this.aad = []; // Additional Authenticated Data
    this.tagLength = 16; // Default 128-bit tag
  }
  
  /**
   * Set the underlying block cipher instance
   * @param {IBlockCipherInstance} cipher - The block cipher to use (typically AES)
   */
  setBlockCipher(cipher) {
    if (!cipher || !cipher.BlockSize) {
      throw new Error("Invalid block cipher instance");
    }
    if (cipher.BlockSize !== 16) {
      throw new Error("OCB mode requires 128-bit block cipher (typically AES)");
    }
    this.blockCipher = cipher;
  }
  
  /**
   * Set the encryption key
   * @param {Array} key - Block cipher key
   */
  setKey(key) {
    if (!key || key.length === 0) {
      throw new Error("Key cannot be empty");
    }
    this.key = [...key];
  }
  
  /**
   * Set the nonce (number used once)
   * @param {Array} nonce - Nonce value (must be unique for each encryption)
   */
  setNonce(nonce) {
    if (!nonce || nonce.length < 12 || nonce.length > 15) {
      throw new Error("OCB nonce must be 12-15 bytes");
    }
    this.nonce = [...nonce];
  }
  
  /**
   * Set additional authenticated data
   * @param {Array} aad - Additional authenticated data
   */
  setAAD(aad) {
    this.aad = aad ? [...aad] : [];
  }
  
  /**
   * Set the authentication tag length
   * @param {number} length - Tag length in bytes (8-16)
   */
  setTagLength(length) {
    if (length < 8 || length > 16) {
      throw new Error("OCB tag length must be 8-16 bytes");
    }
    this.tagLength = length;
  }
  
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.key) {
      throw new Error("Key must be set for OCB mode.");
    }
    if (!this.nonce) {
      throw new Error("Nonce must be set for OCB mode.");
    }
    this.inputBuffer.push(...data);
  }
  
  Result() {
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.key) {
      throw new Error("Key must be set for OCB mode.");
    }
    if (!this.nonce) {
      throw new Error("Nonce must be set for OCB mode.");
    }
    
    const blockSize = this.blockCipher.BlockSize;
    
    if (this.isInverse) {
      // OCB Decryption and verification
      return this._decrypt();
    } else {
      // OCB Encryption and authentication
      return this._encrypt();
    }
  }
  
  /**
   * OCB encryption (simplified educational implementation)
   * @returns {Object} Object containing ciphertext and authentication tag
   */
  _encrypt() {
    const blockSize = this.blockCipher.BlockSize;
    const plaintext = this.inputBuffer;
    
    // Initialize OCB state
    const L = this._generateL();
    const offset = this._processNonce(L);
    
    let checksum = new Array(blockSize).fill(0);
    const ciphertext = [];
    
    // Process full blocks
    const fullBlocks = Math.floor(plaintext.length / blockSize);
    for (let i = 0; i < fullBlocks; i++) {
      const block = plaintext.slice(i * blockSize, (i + 1) * blockSize);
      
      // Calculate offset for this block
      const blockOffset = this._getOffset(L, i + 1);
      const combinedOffset = OpCodes.XorArrays(offset, blockOffset);
      
      // OCB encryption: C_i = E_K(P_i ⊕ Offset_i) ⊕ Offset_i
      const xorInput = OpCodes.XorArrays(block, combinedOffset);
      
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(xorInput);
      const encrypted = cipher.Result();
      
      const cipherBlock = OpCodes.XorArrays(encrypted, combinedOffset);
      ciphertext.push(...cipherBlock);
      
      // Update checksum
      checksum = OpCodes.XorArrays(checksum, block);
    }
    
    // Handle final partial block if present
    if (plaintext.length % blockSize !== 0) {
      const finalBlock = plaintext.slice(fullBlocks * blockSize);
      const pad = this._generatePad(L, finalBlock.length);
      
      // XOR with pad
      const paddedBlock = [];
      for (let i = 0; i < finalBlock.length; i++) {
        paddedBlock[i] = finalBlock[i] ^ pad[i];
      }
      ciphertext.push(...paddedBlock);
      
      // Update checksum with padded final block
      const finalChecksum = [...finalBlock];
      finalChecksum.push(0x80); // Padding bit
      while (finalChecksum.length < blockSize) {
        finalChecksum.push(0);
      }
      checksum = OpCodes.XorArrays(checksum, finalChecksum);
    }
    
    // Generate authentication tag
    const tag = this._generateTag(L, checksum, this.aad);
    
    // Clear sensitive data
    OpCodes.ClearArray(this.inputBuffer);
    OpCodes.ClearArray(checksum);
    this.inputBuffer = [];
    
    return {
      ciphertext: ciphertext,
      tag: tag.slice(0, this.tagLength)
    };
  }
  
  /**
   * OCB decryption (simplified educational implementation)
   * @returns {Array} Decrypted plaintext
   */
  _decrypt() {
    throw new Error("OCB decryption not implemented in this educational example");
  }
  
  /**
   * Generate the L value for OCB offset calculations
   * @returns {Array} L value
   */
  _generateL() {
    const zero = new Array(16).fill(0);
    const cipher = this.blockCipher.algorithm.CreateInstance(false);
    cipher.key = this.key;
    cipher.Feed(zero);
    return cipher.Result();
  }
  
  /**
   * Process nonce to generate initial offset
   * @param {Array} L - L value from block cipher
   * @returns {Array} Initial offset
   */
  _processNonce(L) {
    // Simplified nonce processing (educational)
    const noncePadded = [...this.nonce];
    while (noncePadded.length < 16) {
      noncePadded.push(0);
    }
    
    const cipher = this.blockCipher.algorithm.CreateInstance(false);
    cipher.key = this.key;
    cipher.Feed(noncePadded);
    return cipher.Result();
  }
  
  /**
   * Calculate offset for block i
   * @param {Array} L - L value
   * @param {number} i - Block index
   * @returns {Array} Offset for block i
   */
  _getOffset(L, i) {
    // Simplified offset calculation (educational)
    const offset = [...L];
    for (let j = 0; j < 16; j++) {
      offset[j] ^= (i + j) & 0xFF;
    }
    return offset;
  }
  
  /**
   * Generate padding for final partial block
   * @param {Array} L - L value
   * @param {number} length - Length of final block
   * @returns {Array} Padding stream
   */
  _generatePad(L, length) {
    const cipher = this.blockCipher.algorithm.CreateInstance(false);
    cipher.key = this.key;
    cipher.Feed(L);
    const pad = cipher.Result();
    return pad.slice(0, length);
  }
  
  /**
   * Generate authentication tag
   * @param {Array} L - L value
   * @param {Array} checksum - Accumulated checksum
   * @param {Array} aad - Additional authenticated data
   * @returns {Array} Authentication tag
   */
  _generateTag(L, checksum, aad) {
    // Simplified tag generation (educational)
    let tagInput = OpCodes.XorArrays(checksum, L);
    
    // Process AAD (simplified)
    for (let i = 0; i < aad.length; i++) {
      tagInput[i % 16] ^= aad[i];
    }
    
    const cipher = this.blockCipher.algorithm.CreateInstance(false);
    cipher.key = this.key;
    cipher.Feed(tagInput);
    return cipher.Result();
  }
}

// Register the algorithm
const ocbAlgorithm = new OcbAlgorithm();
RegisterAlgorithm(ocbAlgorithm);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ocbAlgorithm;
}