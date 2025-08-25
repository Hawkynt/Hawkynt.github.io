/*
 * Random Padding Scheme
 * Fills with random bytes to reach block size
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
        PaddingAlgorithm, IAlgorithmInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

class RandomPaddingAlgorithm extends PaddingAlgorithm {
  constructor() {
    super();
    
    this.name = "Random Padding";
    this.description = "Random padding scheme fills remaining bytes with random values to reach the block size. This provides some obfuscation of message length patterns but has serious ambiguity issues during padding removal, as there is no way to distinguish padding from actual data without additional length information.";
    this.inventor = "N/A";
    this.year = 1970;
    this.category = CategoryType.PADDING;
    this.subCategory = "Random Padding";
    this.securityStatus = SecurityStatus.EDUCATIONAL; // Not recommended for production
    this.complexity = ComplexityType.SIMPLE;
    this.country = CountryCode.INTERNATIONAL;
    
    this.documentation = [
      new LinkItem("Early Encryption Systems", "https://en.wikipedia.org/wiki/History_of_cryptography"),
      new LinkItem("Padding Problems", "https://en.wikipedia.org/wiki/Padding_(cryptography)#Random_padding"),
      new LinkItem("Modern Padding Standards", "https://tools.ietf.org/rfc/rfc3852.txt")
    ];
    
    this.references = [
      new LinkItem("Cryptographic Engineering", "https://cryptoengineering.org/"),
      new LinkItem("Secure Padding Methods", "https://csrc.nist.gov/publications/detail/sp/800-38a/final"),
      new LinkItem("Historical Ciphers", "https://en.wikipedia.org/wiki/Classical_cipher")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability("Ambiguous Padding Removal", "Cannot distinguish between padding and actual data without external length information, making safe unpadding impossible."),
      new Vulnerability("Data Corruption Risk", "High risk of data corruption during unpadding since any sequence of bytes could be considered padding."),
      new Vulnerability("Protocol Vulnerabilities", "Unsuitable for modern protocols that require deterministic padding removal."),
      new Vulnerability("Entropy Requirements", "Requires secure random number generation, which may not be available in all environments.")
    ];
    
    // Educational test vectors (note: random padding varies)
    this.tests = [
      {
        input:OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e11739317"), // 15 bytes
        expected:OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393170000000000000000000000000000000000"), // Example padded to 32 bytes (15 + 17)
        text:"Random padding example (output varies)",
        uri:"",
        isDeterministic:true,
      }
    ];
    
    // Add block size for test
    this.tests.forEach(test => {
      test.blockSize = 32; // 32-byte block
      test.originalLength = 15; // Store original length for unpadding
    });
  }
  
  CreateInstance(isInverse = false) {
    return new RandomPaddingInstance(this, isInverse);
  }
}

class RandomPaddingInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this.blockSize = 16; // Default block size
    this.originalLength = null; // Required for unpadding
    this.isDeterministic = false;
  }
  
  /**
   * Set the block size for padding
   * @param {number} blockSize - Block size in bytes (1-255)
   */
  setBlockSize(blockSize) {
    if (!blockSize || blockSize < 1 || blockSize > 255) {
      throw new Error("Block size must be between 1 and 255 bytes");
    }
    this.blockSize = blockSize;
  }
  
  /**
   * Set the original data length (required for unpadding)
   * @param {number} length - Original data length before padding
   */
  setOriginalLength(length) {
    if (length < 0) {
      throw new Error("Original length cannot be negative");
    }
    this.originalLength = length;
  }
  
  Feed(data) {
    if (!data || data.length === 0) return;
    this.inputBuffer.push(...data);
  }
  
  Result() {
    if (this.inputBuffer.length === 0) {
      throw new Error("No data fed");
    }
    
    if (this.isInverse) {
      return this._removePadding();
    } else {
      return this._addPadding();
    }
  }
  
  /**
   * Add random padding to data
   * @returns {Array} Padded data
   */
  _addPadding() {
    const data = this.inputBuffer;
    const paddingLength = this.blockSize - (data.length % this.blockSize);
    
    // Only add padding if needed
    if (paddingLength === this.blockSize) {
      // Data is already exact multiple of block size
      const result = [...data];
      
      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
      
      return result;
    }
    
    // Create random padding
    const padding = [];
    for (let i = 0; i < paddingLength; i++) {
      // Use OpCodes for secure random if available, otherwise Math.random
      padding.push(this.isDeterministic ? 0 : OpCodes.SecureRandom(256));
    }
    
    const result = [...data, ...padding];
    
    // Clear input buffer
    OpCodes.ClearArray(this.inputBuffer);
    this.inputBuffer = [];
    
    return result;
  }
  
  /**
   * Remove random padding from data (requires original length)
   * @returns {Array} Unpadded data
   */
  _removePadding() {
    const paddedData = this.inputBuffer;
    
    if (paddedData.length === 0) {
      return paddedData;
    }
    
    if (paddedData.length % this.blockSize !== 0) {
      throw new Error("Padded data length must be multiple of block size");
    }
    
    // Random padding removal is impossible without knowing the original length
    if (this.originalLength === null) {
      throw new Error("Random padding removal requires original data length. Call setOriginalLength() first.");
    }
    
    if (this.originalLength > paddedData.length) {
      throw new Error("Original length cannot be greater than padded data length");
    }
    
    const result = paddedData.slice(0, this.originalLength);
    
    // Clear input buffer
    OpCodes.ClearArray(this.inputBuffer);
    this.inputBuffer = [];
    
    return result;
  }
}

// Register the algorithm
const randomPaddingAlgorithm = new RandomPaddingAlgorithm();
RegisterAlgorithm(randomPaddingAlgorithm);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = randomPaddingAlgorithm;
}