/*
 * GCM (Galois/Counter Mode) of Operation
 * Authenticated Encryption with Associated Data (AEAD) mode
 * Combines CTR mode encryption with GHASH authentication
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
        AeadAlgorithm, IAeadInstance, TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

class GcmAlgorithm extends AeadAlgorithm {
  constructor() {
    super();
    
    this.name = "GCM";
    this.description = "Galois/Counter Mode provides authenticated encryption by combining CTR mode encryption with GHASH authentication using GF(2^128) arithmetic. Widely used in TLS, IPsec, and other security protocols. Provides both confidentiality and authenticity but catastrophically fails if nonces are reused.";
    this.inventor = "David A. McGrew, John Viega";
    this.year = 2005;
    this.category = CategoryType.AEAD;
    this.subCategory = "Authenticated Encryption";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.US;
    
    this.SupportedTagSizes = [
      new KeySize(4, 16, 1) // GCM supports tag sizes from 32 to 128 bits
    ];
    this.SupportsDetached = true;
    
    this.documentation = [
      new LinkItem("NIST SP 800-38D", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf"),
      new LinkItem("Original GCM Paper", "https://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.58.4924"),
      new LinkItem("RFC 5288 - AES GCM for TLS", "https://tools.ietf.org/rfc/rfc5288.txt")
    ];
    
    this.references = [
      new LinkItem("OpenSSL GCM Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/gcm128.c"),
      new LinkItem("ISO/IEC 19772:2009", "GCM international standard"),
      new LinkItem("Crypto++ GCM Implementation", "https://github.com/weidai11/cryptopp/blob/master/gcm.cpp")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability("Nonce Reuse Attack", "Reusing nonce with same key completely breaks confidentiality and authenticity. Authentication key can be recovered. Always use unique nonces."),
      new Vulnerability("Forbidden Attack", "With very long messages (near 2^39 bits), confidentiality degrades. Limit message lengths in practice."),
      new Vulnerability("Authentication Forgery", "With nonce reuse, arbitrary messages can be forged after key recovery.")
    ];
    
    this.tests = [
      new TestCase(
        [], // Empty plaintext
        OpCodes.Hex8ToBytes("58e2fccefa7e3061367f1d57a4e7455a"), // Expected: empty ciphertext + tag
        "NIST SP 800-38D Test Case 1 - Empty plaintext",
        "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf"
      ),
      new TestCase(
        OpCodes.Hex8ToBytes("00000000000000000000000000000000"), // 16 zero bytes
        OpCodes.Hex8ToBytes("0388dace60b6a392f328c2b971b2fe78ab6e47d42cec13bdf53a67b21257bddf"), // Expected: ciphertext + tag
        "NIST SP 800-38D Test Case 2 - Single block",
        "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf"
      )
    ];
    
    // Add common test parameters
    this.tests.forEach(test => {
      test.key = OpCodes.Hex8ToBytes("00000000000000000000000000000000"); // AES-128 zero key
      test.iv = OpCodes.Hex8ToBytes("000000000000000000000000"); // 96-bit nonce
      test.aad = []; // No additional authenticated data
    });
  }
  
  CreateInstance(isInverse = false) {
    return new GcmModeInstance(this, isInverse);
  }
}

class GcmModeInstance extends IAeadInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.blockCipher = null;
    this.inputBuffer = [];
    this.iv = null;
    this.tagSize = 16; // Default 128-bit tag
    this.hashKey = null; // GHASH key (E_K(0^128))
  }
  
  /**
   * Set the underlying block cipher instance
   * @param {IBlockCipherInstance} cipher - The block cipher to use (must be 128-bit block size)
   */
  setBlockCipher(cipher) {
    if (!cipher || cipher.BlockSize !== 16) {
      throw new Error("GCM requires a 128-bit block cipher");
    }
    this.blockCipher = cipher;
    this._computeHashKey();
  }
  
  /**
   * Set the initialization vector (nonce)
   * @param {Array} iv - IV/nonce (recommended 96 bits, but supports arbitrary lengths)
   */
  setIV(iv) {
    if (!this.blockCipher) {
      throw new Error("Block cipher must be set before IV");
    }
    if (!iv || iv.length === 0) {
      throw new Error("IV cannot be empty for GCM");
    }
    this.iv = [...iv]; // Copy IV
  }
  
  /**
   * Set authentication tag size (in bytes)
   * @param {number} size - Tag size in bytes (4-16)
   */
  setTagSize(size) {
    if (size < 4 || size > 16) {
      throw new Error("GCM tag size must be between 4 and 16 bytes");
    }
    this.tagSize = size;
  }
  
  /**
   * Compute GHASH authentication key H = E_K(0^128)
   * @private
   */
  _computeHashKey() {
    if (!this.blockCipher) return;
    
    const zeroBlock = new Array(16).fill(0);
    const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
    encryptCipher.key = this.blockCipher.key;
    encryptCipher.Feed(zeroBlock);
    this.hashKey = encryptCipher.Result();
  }
  
  /**
   * Compute initial counter J_0 from IV
   * @private
   */
  _computeInitialCounter() {
    if (this.iv.length === 12) {
      // Standard 96-bit IV: J_0 = IV || 0^31 || 1
      return [...this.iv, 0, 0, 0, 1];
    } else {
      // Non-standard IV length: J_0 = GHASH(H, IV || padding || len(IV))
      const ivBlocks = this._padToBlocks(this.iv);
      const lenBlock = new Array(16).fill(0);
      
      // Encode IV length in bits as 64-bit big-endian
      const ivBitLen = this.iv.length * 8;
      for (let i = 0; i < 8; i++) {
        lenBlock[8 + i] = (ivBitLen >>> (56 - i * 8)) & 0xFF;
      }
      
      ivBlocks.push(...lenBlock);
      return this._ghash(ivBlocks);
    }
  }
  
  /**
   * Pad data to complete 128-bit blocks
   * @private
   */
  _padToBlocks(data) {
    const result = [...data];
    const remainder = result.length % 16;
    if (remainder > 0) {
      const padding = new Array(16 - remainder).fill(0);
      result.push(...padding);
    }
    return result;
  }
  
  /**
   * GHASH authentication function
   * @private
   */
  _ghash(data) {
    if (!this.hashKey) {
      throw new Error("Hash key not computed");
    }
    
    let y = new Array(16).fill(0); // Initialize Y_0 = 0^128
    
    // Process data in 128-bit blocks
    for (let i = 0; i < data.length; i += 16) {
      const block = data.slice(i, i + 16);
      
      // Y_i = (Y_{i-1} XOR X_i) * H
      y = OpCodes.XorArrays(y, block);
      y = OpCodes.GHashMul(y, this.hashKey);
    }
    
    return y;
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
    
    const j0 = this._computeInitialCounter();
    let counter = [...j0];
    const output = [];
    
    if (this.isInverse) {
      // GCM Decryption + Authentication
      if (this.inputBuffer.length < this.tagSize) {
        throw new Error("Input too short for tag verification");
      }
      
      const ciphertext = this.inputBuffer.slice(0, -this.tagSize);
      const receivedTag = this.inputBuffer.slice(-this.tagSize);
      
      // Decrypt ciphertext using CTR mode
      for (let i = 0; i < ciphertext.length; i += 16) {
        const remainingBytes = Math.min(16, ciphertext.length - i);
        const cipherBlock = ciphertext.slice(i, i + remainingBytes);
        
        counter = OpCodes.GCMIncrement(counter);
        const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
        encryptCipher.key = this.blockCipher.key;
        encryptCipher.Feed(counter);
        const keystream = encryptCipher.Result();
        
        const plainBlock = [];
        for (let j = 0; j < remainingBytes; j++) {
          plainBlock[j] = cipherBlock[j] ^ keystream[j];
        }
        output.push(...plainBlock);
      }
      
      // Verify authentication tag
      const computedTag = this._computeTag(ciphertext, j0);
      const truncatedTag = computedTag.slice(0, this.tagSize);
      
      if (!OpCodes.SecureCompare(receivedTag, truncatedTag)) {
        throw new Error("GCM authentication verification failed");
      }
      
    } else {
      // GCM Encryption + Authentication
      const plaintext = [...this.inputBuffer];
      
      // Encrypt plaintext using CTR mode
      for (let i = 0; i < plaintext.length; i += 16) {
        const remainingBytes = Math.min(16, plaintext.length - i);
        const plainBlock = plaintext.slice(i, i + remainingBytes);
        
        counter = OpCodes.GCMIncrement(counter);
        const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
        encryptCipher.key = this.blockCipher.key;
        encryptCipher.Feed(counter);
        const keystream = encryptCipher.Result();
        
        const cipherBlock = [];
        for (let j = 0; j < remainingBytes; j++) {
          cipherBlock[j] = plainBlock[j] ^ keystream[j];
        }
        output.push(...cipherBlock);
      }
      
      // Compute and append authentication tag
      const tag = this._computeTag(output, j0);
      const truncatedTag = tag.slice(0, this.tagSize);
      output.push(...truncatedTag);
    }
    
    // Clear sensitive data
    OpCodes.ClearArray(this.inputBuffer);
    OpCodes.ClearArray(counter);
    this.inputBuffer = [];
    
    return output;
  }
  
  /**
   * Compute GCM authentication tag
   * @private
   */
  _computeTag(ciphertext, j0) {
    // Prepare data for GHASH: AAD || pad || C || pad || len(AAD) || len(C)
    const ghashInput = [];
    
    // Add AAD (Additional Authenticated Data)
    if (this.aad && this.aad.length > 0) {
      ghashInput.push(...this._padToBlocks(this.aad));
    }
    
    // Add ciphertext
    if (ciphertext.length > 0) {
      ghashInput.push(...this._padToBlocks(ciphertext));
    }
    
    // Add length block: len(AAD) || len(C) in bits as 64-bit values
    const lenBlock = new Array(16).fill(0);
    const aadBitLen = (this.aad ? this.aad.length : 0) * 8;
    const cBitLen = ciphertext.length * 8;
    
    // Encode lengths as 64-bit big-endian
    for (let i = 0; i < 8; i++) {
      lenBlock[i] = (aadBitLen >>> (56 - i * 8)) & 0xFF;
      lenBlock[8 + i] = (cBitLen >>> (56 - i * 8)) & 0xFF;
    }
    ghashInput.push(...lenBlock);
    
    // Compute GHASH
    const s = this._ghash(ghashInput);
    
    // Encrypt S with J_0 to get authentication tag
    const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
    encryptCipher.key = this.blockCipher.key;
    encryptCipher.Feed(j0);
    const j0Encrypted = encryptCipher.Result();
    
    return OpCodes.XorArrays(s, j0Encrypted);
  }
}

// Register the algorithm
const gcmAlgorithm = new GcmAlgorithm();
RegisterAlgorithm(gcmAlgorithm);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = gcmAlgorithm;
}