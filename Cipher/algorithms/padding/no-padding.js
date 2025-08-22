/*
 * No Padding Scheme
 * No padding applied - data must be exact block size
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

class NoPaddingAlgorithm extends PaddingAlgorithm {
  constructor() {
    super();
    
    this.name = "No Padding";
    this.description = "No padding scheme requires that input data must be an exact multiple of the block size. This approach is used when the application ensures proper data alignment or when padding would interfere with the protocol. Commonly used with stream ciphers or when data is naturally block-aligned.";
    this.inventor = "N/A";
    this.year = 1970;
    this.category = CategoryType.PADDING;
    this.subCategory = "No Padding";
    this.securityStatus = null; // No security implications
    this.complexity = ComplexityType.TRIVIAL;
    this.country = CountryCode.INTERNATIONAL;
    
    this.documentation = [
      new LinkItem("Block Cipher Modes", "https://csrc.nist.gov/publications/detail/sp/800-38a/final"),
      new LinkItem("Cryptographic Standards", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines"),
      new LinkItem("Padding in Cryptography", "https://en.wikipedia.org/wiki/Padding_(cryptography)")
    ];
    
    this.references = [
      new LinkItem("ECB Mode without Padding", "https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#ECB"),
      new LinkItem("Stream Cipher Usage", "https://en.wikipedia.org/wiki/Stream_cipher"),
      new LinkItem("Block Size Requirements", "https://tools.ietf.org/rfc/rfc3852.txt")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability("No Protection", "No padding provides no protection against data length leakage or other attacks that padding schemes might mitigate."),
      new Vulnerability("Strict Requirements", "Requires careful application design to ensure data is always properly block-aligned.")
    ];
    
    // Test vectors for no padding
    this.tests = [
      new TestCase(
        OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // 16 bytes (exact block)
        OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // Same output
        "No padding for exact block size",
        "No padding specification"
      ),
      new TestCase(
        OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a6bc1bee22e409f96e93d7e117393172a"), // 32 bytes (2 blocks)
        OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a6bc1bee22e409f96e93d7e117393172a"), // Same output
        "No padding for multiple blocks",
        "No padding specification"
      )
    ];
    
    // Add block sizes for tests
    this.tests.forEach(test => {
      test.blockSize = 16; // 16-byte blocks
    });
  }
  
  CreateInstance(isInverse = false) {
    return new NoPaddingInstance(this, isInverse);
  }
}

class NoPaddingInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this.blockSize = 16; // Default block size
  }
  
  /**
   * Set the block size for validation
   * @param {number} blockSize - Block size in bytes (1-255)
   */
  setBlockSize(blockSize) {
    if (!blockSize || blockSize < 1 || blockSize > 255) {
      throw new Error("Block size must be between 1 and 255 bytes");
    }
    this.blockSize = blockSize;
  }
  
  Feed(data) {
    if (!data || data.length === 0) return;
    this.inputBuffer.push(...data);
  }
  
  Result() {
    if (this.inputBuffer.length === 0) {
      throw new Error("No data fed");
    }
    
    // Validate that data length is multiple of block size
    if (this.inputBuffer.length % this.blockSize !== 0) {
      throw new Error(`Data length (${this.inputBuffer.length}) must be multiple of block size (${this.blockSize}) when using no padding`);
    }
    
    // No padding/unpadding needed - just return the data
    const result = [...this.inputBuffer];
    
    // Clear input buffer
    OpCodes.ClearArray(this.inputBuffer);
    this.inputBuffer = [];
    
    return result;
  }
}

// Register the algorithm
const noPaddingAlgorithm = new NoPaddingAlgorithm();
RegisterAlgorithm(noPaddingAlgorithm);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = noPaddingAlgorithm;
}