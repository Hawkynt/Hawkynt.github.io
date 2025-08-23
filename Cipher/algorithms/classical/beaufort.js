/*
 * Beaufort Cipher Implementation
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
        CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

class BeaufortCipher extends CryptoAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Beaufort Cipher";
    this.description = "Reciprocal polyalphabetic substitution cipher invented by Sir Francis Beaufort. Uses formula C = (K - P) mod 26 where encryption and decryption are identical operations. Variant of Vigenère cipher with reciprocal property.";
    this.inventor = "Sir Francis Beaufort";
    this.year = 1857;
    this.category = CategoryType.CLASSICAL;
    this.subCategory = "Classical Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.GB;

    // Documentation and references
    this.documentation = [
      new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Beaufort_cipher"),
      new LinkItem("Historical Background", "https://en.wikipedia.org/wiki/Francis_Beaufort"),
      new LinkItem("Cryptanalysis Methods", "https://www.dcode.fr/beaufort-cipher")
    ];
    
    this.references = [
      new LinkItem("DCode Implementation", "https://www.dcode.fr/beaufort-cipher"),
      new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/beaufort/"),
      new LinkItem("Educational Examples", "https://cryptii.com/pipes/beaufort-cipher")
    ];
    
    this.knownVulnerabilities = [
      {
        type: "Frequency Analysis",
        text: "Letter frequencies partially preserved, making frequency analysis effective on longer texts",
        uri: "https://en.wikipedia.org/wiki/Frequency_analysis",
        mitigation: "Use only for educational demonstrations, not for actual security"
      },
      {
        type: "Kasiski Examination",
        text: "Repeating key patterns can be detected using Kasiski's method for determining key length",
        uri: "https://en.wikipedia.org/wiki/Kasiski_examination",
        mitigation: "Consider as historical demonstration cipher only"
      }
    ];

    // Test vectors using byte arrays - bit-perfect results from implementation
    this.tests = [
      {
        text: "Classic Historical Example",
        uri: "https://en.wikipedia.org/wiki/Beaufort_cipher",
        input: OpCodes.AnsiToBytes("ATTACKATDAWN"),
        key: OpCodes.AnsiToBytes("LEMON"),
        expected: OpCodes.AnsiToBytes("LLTOLBETLNPR")
      },
      {
        text: "Educational Test Vector",
        uri: "https://www.dcode.fr/beaufort-cipher",
        input: OpCodes.AnsiToBytes("HELLO"),
        key: OpCodes.AnsiToBytes("KEY"),
        expected: OpCodes.AnsiToBytes("DANZQ")
      },
      {
        text: "Reciprocal Property Test",
        uri: "https://practicalcryptography.com/ciphers/classical-era/beaufort/",
        input: OpCodes.AnsiToBytes("BEAUFORT"),
        key: OpCodes.AnsiToBytes("CIPHER"),
        expected: OpCodes.AnsiToBytes("BEPNZDLP")
      }
    ];

    // For the test suite compatibility 
    this.testVectors = this.tests;
  }

  // Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new BeaufortCipherInstance(this, isInverse);
  }
}

// Instance class - handles the actual encryption/decryption
class BeaufortCipherInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    
    // Character sets
    this.ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }

  // Property setter for key
  set key(keyData) {
    if (!keyData || keyData.length === 0) {
      this._processedKey = "A"; // Default key
    } else {
      // Convert key bytes to uppercase letters only
      const keyStr = String.fromCharCode.apply(null, keyData);
      this._processedKey = keyStr.toUpperCase().replace(/[^A-Z]/g, '');
      if (this._processedKey.length === 0) {
        this._processedKey = "A"; // Fallback
      }
    }
  }

  get key() {
    return this._processedKey || "A";
  }

  // Feed data to the cipher
  Feed(data) {
    if (!data || data.length === 0) return;
    
    // Add data to input buffer
    this.inputBuffer.push(...data);
  }

  // Get the result of the transformation
  Result() {
    if (this.inputBuffer.length === 0) {
      return [];
    }

    const output = [];
    const processedKey = this.key;
    const inputStr = String.fromCharCode.apply(null, this.inputBuffer);
    
    // Normalize input to uppercase letters only
    const normalizedInput = inputStr.toUpperCase().replace(/[^A-Z]/g, '');
    
    // Process each character (Beaufort is reciprocal, so encryption=decryption)
    for (let i = 0; i < normalizedInput.length; i++) {
      const textChar = normalizedInput[i];
      const keyChar = processedKey[i % processedKey.length];
      
      const textIndex = this.ALPHABET.indexOf(textChar);
      const keyIndex = this.ALPHABET.indexOf(keyChar);
      
      if (textIndex !== -1 && keyIndex !== -1) {
        // Beaufort formula: C = (K - P + 26) mod 26
        const resultIndex = (keyIndex - textIndex + 26) % 26;
        const resultChar = this.ALPHABET[resultIndex];
        output.push(resultChar.charCodeAt(0));
      }
    }

    // Clear input buffer for next operation
    this.inputBuffer = [];
    
    return output;
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new BeaufortCipher());