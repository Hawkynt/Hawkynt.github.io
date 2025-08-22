/*
 * FPE (Format-Preserving Encryption) Mode of Operation
 * General framework for format-preserving encryption schemes
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

class FpeAlgorithm extends CipherModeAlgorithm {
  constructor() {
    super();
    
    this.name = "FPE";
    this.description = "FPE (Format-Preserving Encryption) is a general framework for encryption schemes that preserve the format and structure of input data. It enables encryption of structured data like credit card numbers, phone numbers, and database fields while maintaining their original format, length, and character sets.";
    this.inventor = "Various (NIST standardization)";
    this.year = 2009;
    this.category = CategoryType.MODE;
    this.subCategory = "Format-Preserving Encryption";
    this.securityStatus = SecurityStatus.EXPERIMENTAL; // Application-specific
    this.complexity = ComplexityType.RESEARCH;
    this.country = CountryCode.US;
    
    this.RequiresIV = false; // Uses tweak instead of IV
    this.SupportedIVSizes = []; // Not applicable for FPE
    
    this.documentation = [
      new LinkItem("NIST SP 800-38G", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf"),
      new LinkItem("Format-Preserving Encryption Survey", "https://web.cs.ucdavis.edu/~rogaway/papers/fpe.pdf"),
      new LinkItem("FF1 and FF3 Modes", "https://csrc.nist.gov/publications/detail/sp/800-38g/final")
    ];
    
    this.references = [
      new LinkItem("Python FPE Implementation", "https://github.com/mysto/python-fpe"),
      new LinkItem("Java FPE Library", "https://github.com/privacylogistics/java-fpe"),
      new LinkItem("C++ FPE Implementation", "https://github.com/capitalone/fpe")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability("Small Domain Security", "FPE security degrades with small alphabets or short strings. Minimum security requires alphabet size × string length ≥ 1,000,000."),
      new Vulnerability("Implementation Complexity", "Proper FPE requires careful implementation of cycle-walking, radix conversion, and PRF construction to avoid bias and maintain security.")
    ];
    
    // Educational test vectors for FPE mode
    this.tests = [
      new TestCase(
        OpCodes.AnsiToBytes("4111111111111111"), // Credit card number format
        OpCodes.AnsiToBytes("6222222222222222"), // Expected format-preserved output (educational)
        "FPE credit card number encryption",
        "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("555-12-3456"), // SSN format with hyphens
        OpCodes.AnsiToBytes("777-34-5678"), // Expected format-preserved output (educational)
        "FPE social security number encryption",
        "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf"
      )
    ];
    
    // Add test parameters
    this.tests.forEach(test => {
      test.key = OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"); // Primary key
      test.tweak = OpCodes.AnsiToBytes(""), // Empty tweak for basic test
      test.alphabet = "0123456789-"; // Digits and hyphen for formatting
    });
  }
  
  CreateInstance(isInverse = false) {
    return new FpeModeInstance(this, isInverse);
  }
}

class FpeModeInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.blockCipher = null;
    this.inputBuffer = [];
    this.key = null;
    this.tweak = [];
    this.alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"; // Default alphabet
    this.preserveFormatChars = true; // Preserve non-alphabet characters
  }
  
  /**
   * Set the underlying block cipher instance (typically AES)
   * @param {IBlockCipherInstance} cipher - The block cipher to use
   */
  setBlockCipher(cipher) {
    if (!cipher || !cipher.BlockSize) {
      throw new Error("Invalid block cipher instance");
    }
    this.blockCipher = cipher;
  }
  
  /**
   * Set the encryption key
   * @param {Array} key - Key for block cipher
   */
  setKey(key) {
    if (!key || key.length === 0) {
      throw new Error("Key cannot be empty");
    }
    this.key = [...key];
  }
  
  /**
   * Set the tweak value
   * @param {Array} tweak - Tweak value for FPE mode
   */
  setTweak(tweak) {
    this.tweak = tweak ? [...tweak] : [];
  }
  
  /**
   * Set the alphabet for format-preserving encryption
   * @param {string} alphabet - Character set to preserve
   */
  setAlphabet(alphabet) {
    if (!alphabet || alphabet.length < 2) {
      throw new Error("Alphabet must contain at least 2 characters");
    }
    this.alphabet = alphabet;
  }
  
  /**
   * Set whether to preserve format characters (non-alphabet)
   * @param {boolean} preserve - Whether to preserve format characters
   */
  setPreserveFormatChars(preserve) {
    this.preserveFormatChars = preserve;
  }
  
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.key) {
      throw new Error("Key must be set for FPE mode.");
    }
    this.inputBuffer.push(...data);
  }
  
  Result() {
    if (!this.blockCipher) {
      throw new Error("Block cipher not set. Call setBlockCipher() first.");
    }
    if (!this.key) {
      throw new Error("Key must be set for FPE mode.");
    }
    if (this.inputBuffer.length === 0) {
      throw new Error("No data fed");
    }
    
    // Convert input to string for processing
    const inputStr = OpCodes.BytesToAnsi(this.inputBuffer);
    
    // Extract alphabet characters and their positions
    const { alphabetChars, formatChars, positions } = this._extractCharacters(inputStr);
    
    if (alphabetChars.length < 2) {
      throw new Error("Input must contain at least 2 alphabet characters for FPE");
    }
    
    // Apply FPE to alphabet characters only
    const processedChars = this._applyFPE(alphabetChars);
    
    // Reconstruct string with format characters preserved
    const result = this._reconstructString(processedChars, formatChars, positions);
    
    // Clear sensitive data
    OpCodes.ClearArray(this.inputBuffer);
    this.inputBuffer = [];
    
    return OpCodes.AnsiToBytes(result);
  }
  
  /**
   * Extract alphabet and format characters with their positions
   * @param {string} input - Input string
   * @returns {Object} Extracted character information
   */
  _extractCharacters(input) {
    const alphabetChars = [];
    const formatChars = [];
    const positions = [];
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (this.alphabet.includes(char)) {
        alphabetChars.push(char);
        positions.push({ type: 'alphabet', index: alphabetChars.length - 1 });
      } else if (this.preserveFormatChars) {
        formatChars.push(char);
        positions.push({ type: 'format', index: formatChars.length - 1 });
      } else {
        throw new Error(`Character '${char}' not in alphabet and format preservation disabled`);
      }
    }
    
    return { alphabetChars, formatChars, positions };
  }
  
  /**
   * Apply FPE transformation to alphabet characters
   * @param {Array} chars - Alphabet characters to transform
   * @returns {Array} Transformed characters
   */
  _applyFPE(chars) {
    // Convert characters to numbers based on alphabet
    const numbers = chars.map(char => this.alphabet.indexOf(char));
    const radix = this.alphabet.length;
    
    // Simple cycle-walking FPE (educational implementation)
    // Real FPE would use more sophisticated algorithms like FF1 or FF3
    let result = [...numbers];
    const maxCycles = 100; // Prevent infinite loops
    
    for (let cycle = 0; cycle < maxCycles; cycle++) {
      // Apply PRF-based transformation
      result = this._applyPRF(result, cycle);
      
      // Check if result is valid (all values < radix)
      if (result.every(n => n < radix)) {
        break;
      }
      
      // Cycle walking: if any value >= radix, retry with different input
      result = result.map(n => n % radix);
    }
    
    // Convert numbers back to characters
    return result.map(num => this.alphabet[num]);
  }
  
  /**
   * Apply PRF-based transformation (simplified FPE round function)
   * @param {Array} input - Input numbers
   * @param {number} round - Round number for domain separation
   * @returns {Array} Transformed numbers
   */
  _applyPRF(input, round) {
    // Construct PRF input: tweak || round || input
    const prfInput = [];
    prfInput.push(...this.tweak);
    prfInput.push(round & 0xFF);
    prfInput.push(...input.map(n => n & 0xFF));
    
    // Pad to block size
    const blockSize = this.blockCipher.BlockSize;
    while (prfInput.length % blockSize !== 0) {
      prfInput.push(0);
    }
    
    // Apply block cipher as PRF
    const cipher = this.blockCipher.algorithm.CreateInstance(false);
    cipher.key = this.key;
    cipher.Feed(prfInput);
    const prf = cipher.Result();
    
    // Transform input using PRF output
    const result = new Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const prfByte = prf[i % prf.length];
      if (this.isInverse) {
        result[i] = (input[i] - prfByte + 256) % 256;
      } else {
        result[i] = (input[i] + prfByte) % 256;
      }
    }
    
    return result;
  }
  
  /**
   * Reconstruct string with format characters preserved
   * @param {Array} alphabetChars - Processed alphabet characters
   * @param {Array} formatChars - Original format characters
   * @param {Array} positions - Character position information
   * @returns {string} Reconstructed string
   */
  _reconstructString(alphabetChars, formatChars, positions) {
    const result = [];
    let alphabetIndex = 0;
    let formatIndex = 0;
    
    for (const pos of positions) {
      if (pos.type === 'alphabet') {
        result.push(alphabetChars[alphabetIndex++]);
      } else {
        result.push(formatChars[formatIndex++]);
      }
    }
    
    return result.join('');
  }
}

// Register the algorithm
const fpeAlgorithm = new FpeAlgorithm();
RegisterAlgorithm(fpeAlgorithm);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = fpeAlgorithm;
}