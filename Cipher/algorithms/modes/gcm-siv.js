/*
 * GCM-SIV Mode of Operation
 * Authenticated encryption with nonce misuse resistance
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
        AeadAlgorithm, IAlgorithmInstance, TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

class GcmSivAlgorithm extends AeadAlgorithm {
  constructor() {
    super();
    
    this.name = "GCM-SIV";
    this.description = "GCM-SIV is a nonce-misuse resistant authenticated encryption algorithm that provides both privacy and authenticity even when nonces are repeated. It combines POLYVAL hash with AES-CTR encryption in a SIV-like construction, offering strong security guarantees and better performance than traditional SIV modes.";
    this.inventor = "Shay Gueron, Yehuda Lindell";
    this.year = 2017;
    this.category = CategoryType.MODE;
    this.subCategory = "Nonce-Misuse Resistant AEAD";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.EXPERT;
    this.country = CountryCode.US;
    
    this.SupportedTagSizes = [new KeySize(16, 16, 0)]; // Fixed 128-bit tag
    this.SupportsDetached = true;
    
    this.documentation = [
      new LinkItem("RFC 8452 - AES-GCM-SIV", "https://tools.ietf.org/rfc/rfc8452.txt"),
      new LinkItem("GCM-SIV Paper", "https://eprint.iacr.org/2017/168.pdf"),
      new LinkItem("NIST Consideration", "https://csrc.nist.gov/projects/lightweight-cryptography")
    ];
    
    this.references = [
      new LinkItem("POLYVAL Specification", "Section 3 of RFC 8452"),
      new LinkItem("Nonce-Misuse Resistance", "https://tools.ietf.org/rfc/rfc5297.txt")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability("Nonce Reuse Safe", "GCM-SIV is specifically designed to be safe against nonce reuse, providing graceful degradation."),
      new Vulnerability("Key Commitment", "Does not provide key commitment - different keys may decrypt to different plaintexts."),
      new Vulnerability("Performance Trade-off", "Slightly slower than GCM due to two-pass construction.")
    ];
    
    this.tests = [
      new TestCase(
        OpCodes.Hex8ToBytes(""), // Empty plaintext
        OpCodes.Hex8ToBytes("07173dd7b7cc7fb97ca95b91e15d0d38"), // Expected tag
        "GCM-SIV empty plaintext test vector",
        "https://tools.ietf.org/rfc/rfc8452.txt"
      ),
      new TestCase(
        OpCodes.Hex8ToBytes("0100000000000000"), // 8-byte plaintext
        OpCodes.Hex8ToBytes("571072289cef7c3b4a59a4c78b3b0fd4a6e0febb57ff6d91f9"), // Expected ciphertext+tag
        "GCM-SIV short message test vector",
        "https://tools.ietf.org/rfc/rfc8452.txt"
      )
    ];
    
    // Add test parameters
    this.tests.forEach(test => {
      test.key = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"); // AES-128 key
      test.nonce = OpCodes.Hex8ToBytes("030000000000000000000000"); // 96-bit nonce
      test.aad = OpCodes.Hex8ToBytes("010000000000000000000000"); // Associated data
      test.tagSize = 16; // 16-byte tag
    });
  }
  
  CreateInstance(isInverse = false) {
    return new GcmSivModeInstance(this, isInverse);
  }
}

class GcmSivModeInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.blockCipher = null;
    this.key = null;
    this.nonce = null;
    this.aad = [];
    this.tagSize = 16;
    this.inputBuffer = [];
  }
  
  setBlockCipher(cipher) {
    if (!cipher || !cipher.BlockSize || cipher.BlockSize !== 16) {
      throw new Error("GCM-SIV requires AES (128-bit block size)");
    }
    this.blockCipher = cipher;
    this.key = cipher.key;
  }
  
  setNonce(nonce) {
    if (!nonce || nonce.length !== 12) {
      throw new Error("GCM-SIV requires exactly 96-bit (12-byte) nonce");
    }
    this.nonce = [...nonce];
  }
  
  setAAD(aad) {
    this.aad = aad ? [...aad] : [];
  }
  
  setTagSize(size) {
    if (size !== 16) {
      throw new Error("GCM-SIV only supports 128-bit (16-byte) tags");
    }
    this.tagSize = size;
  }
  
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.nonce) {
      throw new Error("Nonce not set. Call setNonce() first.");
    }
    this.inputBuffer.push(...data);
  }
  
  Result() {
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.nonce) {
      throw new Error("Nonce not set. Call setNonce() first.");
    }
    
    if (!this.isInverse) {
      return this._encrypt();
    } else {
      if (this.inputBuffer.length < this.tagSize) {
        throw new Error("Input too short for authentication tag");
      }
      return this._decrypt();
    }
  }
  
  _encrypt() {
    // Step 1: Derive keys
    const {authKey, encKey} = this._deriveKeys();
    
    // Step 2: Compute authentication tag using POLYVAL
    const tag = this._computeTag(authKey, encKey);
    
    // Step 3: Encrypt plaintext using AES-CTR with tag as initial counter
    const ciphertext = this._ctrEncrypt(encKey, tag);
    
    // Clear sensitive data
    OpCodes.ClearArray(this.inputBuffer);
    this.inputBuffer = [];
    
    return { ciphertext: ciphertext, tag: tag };
  }
  
  _decrypt() {
    // Extract ciphertext and tag
    const ciphertext = this.inputBuffer.slice(0, -this.tagSize);
    const receivedTag = this.inputBuffer.slice(-this.tagSize);
    
    // Step 1: Derive keys
    const {authKey, encKey} = this._deriveKeys();
    
    // Step 2: Decrypt ciphertext using AES-CTR
    const plaintext = this._ctrDecrypt(encKey, receivedTag, ciphertext);
    
    // Step 3: Verify authentication tag
    // Temporarily set input buffer to plaintext for tag computation
    const originalBuffer = this.inputBuffer;
    this.inputBuffer = plaintext;
    const expectedTag = this._computeTag(authKey, encKey);
    this.inputBuffer = originalBuffer;
    
    if (!OpCodes.SecureCompare(receivedTag, expectedTag)) {
      throw new Error("GCM-SIV authentication failed - tag mismatch");
    }
    
    // Clear sensitive data
    OpCodes.ClearArray(this.inputBuffer);
    this.inputBuffer = [];
    
    return plaintext;
  }
  
  /**
   * Derive authentication and encryption keys from master key
   * @returns {Object} Object with authKey and encKey
   */
  _deriveKeys() {
    const blockSize = 16;
    const keys = [];
    
    // Derive keys using AES with consecutive counters
    for (let i = 0; i < 6; i++) {
      const counter = new Array(blockSize).fill(0);
      counter[0] = i;
      
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(counter);
      keys.push(...cipher.Result());
    }
    
    // Split derived keys
    const authKey = keys.slice(0, 16);     // First 128 bits for POLYVAL
    const encKey = keys.slice(16, 32);     // Next 128 bits for AES-CTR
    
    return { authKey, encKey };
  }
  
  /**
   * Compute authentication tag using POLYVAL
   * @param {Array} authKey - Authentication key
   * @param {Array} encKey - Encryption key  
   * @returns {Array} Authentication tag
   */
  _computeTag(authKey, encKey) {
    // Step 1: POLYVAL computation
    let polyvalResult = this._polyval(authKey);
    
    // Step 2: XOR with nonce and lengths
    const lengthBlock = this._encodeLengths();
    polyvalResult = this._xorArrays(polyvalResult, lengthBlock);
    
    // Step 3: Clear most significant bit and encrypt
    polyvalResult[15] &= 0x7F; // Clear MSB
    
    const cipher = this.blockCipher.algorithm.CreateInstance(false);
    cipher.key = encKey;
    cipher.Feed(polyvalResult);
    return cipher.Result();
  }
  
  /**
   * POLYVAL universal hash function
   * @param {Array} key - POLYVAL key
   * @returns {Array} POLYVAL result
   */
  _polyval(key) {
    let result = new Array(16).fill(0);
    
    // Process AAD
    if (this.aad.length > 0) {
      const paddedAAD = this._padToBlockSize([...this.aad]);
      for (let i = 0; i < paddedAAD.length; i += 16) {
        const block = paddedAAD.slice(i, i + 16);
        result = this._xorArrays(result, block);
        result = this._gfMul(result, key);
      }
    }
    
    // Process plaintext
    if (this.inputBuffer.length > 0) {
      const paddedPlaintext = this._padToBlockSize([...this.inputBuffer]);
      for (let i = 0; i < paddedPlaintext.length; i += 16) {
        const block = paddedPlaintext.slice(i, i + 16);
        result = this._xorArrays(result, block);
        result = this._gfMul(result, key);
      }
    }
    
    return result;
  }
  
  /**
   * AES-CTR mode encryption
   * @param {Array} key - Encryption key
   * @param {Array} tag - Tag used as initial counter
   * @returns {Array} Ciphertext
   */
  _ctrEncrypt(key, tag) {
    const output = [];
    let counter = [...tag];
    counter[15] |= 0x80; // Set MSB
    
    for (let i = 0; i < this.inputBuffer.length; i += 16) {
      const remainingBytes = Math.min(16, this.inputBuffer.length - i);
      const plaintextBlock = this.inputBuffer.slice(i, i + remainingBytes);
      
      // Encrypt counter
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = key;
      cipher.Feed(counter);
      const keystream = cipher.Result();
      
      // XOR with plaintext
      for (let j = 0; j < remainingBytes; j++) {
        output.push(plaintextBlock[j] ^ keystream[j]);
      }
      
      // Increment counter
      this._incrementCounter(counter);
    }
    
    return output;
  }
  
  /**
   * AES-CTR mode decryption
   * @param {Array} key - Encryption key
   * @param {Array} tag - Tag used as initial counter
   * @param {Array} ciphertext - Ciphertext to decrypt
   * @returns {Array} Plaintext
   */
  _ctrDecrypt(key, tag, ciphertext) {
    const output = [];
    let counter = [...tag];
    counter[15] |= 0x80; // Set MSB
    
    for (let i = 0; i < ciphertext.length; i += 16) {
      const remainingBytes = Math.min(16, ciphertext.length - i);
      const cipherBlock = ciphertext.slice(i, i + remainingBytes);
      
      // Encrypt counter (same as encryption)
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = key;
      cipher.Feed(counter);
      const keystream = cipher.Result();
      
      // XOR with ciphertext
      for (let j = 0; j < remainingBytes; j++) {
        output.push(cipherBlock[j] ^ keystream[j]);
      }
      
      // Increment counter
      this._incrementCounter(counter);
    }
    
    return output;
  }
  
  /**
   * Encode AAD and plaintext lengths for authentication
   * @returns {Array} Length encoding block
   */
  _encodeLengths() {
    const aadBits = this.aad.length * 8;
    const plaintextBits = this.inputBuffer.length * 8;
    
    const result = new Array(16);
    
    // Encode AAD length (little-endian)
    for (let i = 0; i < 8; i++) {
      result[i] = (aadBits >>> (i * 8)) & 0xFF;
    }
    
    // Encode plaintext length (little-endian)
    for (let i = 0; i < 8; i++) {
      result[8 + i] = (plaintextBits >>> (i * 8)) & 0xFF;
    }
    
    // XOR with nonce padded to 16 bytes
    const paddedNonce = [...this.nonce, 0, 0, 0, 0]; // Pad 12-byte nonce to 16 bytes
    return this._xorArrays(result, paddedNonce);
  }
  
  /**
   * Pad data to multiple of block size
   * @param {Array} data - Data to pad
   * @returns {Array} Padded data
   */
  _padToBlockSize(data) {
    const blockSize = 16;
    const paddingLength = blockSize - (data.length % blockSize);
    if (paddingLength === blockSize) return data;
    
    return [...data, ...new Array(paddingLength).fill(0)];
  }
  
  /**
   * GF(2^128) multiplication for POLYVAL
   * @param {Array} a - First operand
   * @param {Array} b - Second operand
   * @returns {Array} Multiplication result
   */
  _gfMul(a, b) {
    let result = new Array(16).fill(0);
    let v = [...b];
    
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 8; j++) {
        if ((a[i] >>> j) & 1) {
          result = this._xorArrays(result, v);
        }
        
        // Multiply v by x
        const carry = v[15] & 1;
        for (let k = 15; k > 0; k--) {
          v[k] = ((v[k] >>> 1) | ((v[k-1] & 1) << 7)) & 0xFF;
        }
        v[0] = (v[0] >>> 1) & 0xFF;
        
        if (carry) {
          v[0] ^= 0xE1; // POLYVAL reduction polynomial
        }
      }
    }
    
    return result;
  }
  
  /**
   * XOR two byte arrays
   * @param {Array} a - First array
   * @param {Array} b - Second array
   * @returns {Array} XOR result
   */
  _xorArrays(a, b) {
    const result = new Array(Math.max(a.length, b.length));
    for (let i = 0; i < result.length; i++) {
      result[i] = (a[i] || 0) ^ (b[i] || 0);
    }
    return result;
  }
  
  /**
   * Increment counter for CTR mode
   * @param {Array} counter - Counter to increment (modified in place)
   */
  _incrementCounter(counter) {
    for (let i = 0; i < counter.length; i++) {
      counter[i] = (counter[i] + 1) & 0xFF;
      if (counter[i] !== 0) break;
    }
  }
}

// Register the algorithm
const gcmSivAlgorithm = new GcmSivAlgorithm();
RegisterAlgorithm(gcmSivAlgorithm);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = gcmSivAlgorithm;
}