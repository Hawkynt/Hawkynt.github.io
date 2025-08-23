/*
 * Autokey Cipher Implementation  
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

class AutokeyCipher extends CryptoAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Autokey Cipher";
    this.description = "Enhanced Vigenère cipher that extends the key using plaintext itself, eliminating periodic key repetition. Uses initial keyword plus plaintext letters to create non-repeating key sequence. More secure than standard Vigenère.";
    this.inventor = "Blaise de Vigenère";
    this.year = 1586;
    this.category = CategoryType.CLASSICAL;
    this.subCategory = "Classical Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.FR;

    // Documentation and references
    this.documentation = [
      new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Autokey_cipher"),
      new LinkItem("Original Vigenère Work", "https://gallica.bnf.fr/ark:/12148/bpt6k5493743"),
      new LinkItem("Cryptanalysis Methods", "https://www.dcode.fr/autokey-cipher")
    ];
    
    this.references = [
      new LinkItem("DCode Implementation", "https://www.dcode.fr/autokey-cipher"),
      new LinkItem("Cryptii Educational Tool", "https://cryptii.com/pipes/autokey-cipher"),
      new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/autokey/")
    ];
    
    this.knownVulnerabilities = [
      {
        type: "Probable Plaintext Attack",
        text: "If portion of plaintext is known, can recover key and decrypt remainder of message",
        uri: "https://en.wikipedia.org/wiki/Known-plaintext_attack",
        mitigation: "Avoid predictable beginnings or known phrases"
      },
      {
        type: "Statistical Analysis",
        text: "While more secure than Vigenère, still vulnerable to advanced statistical attacks",
        uri: "https://en.wikipedia.org/wiki/Autokey_cipher#Cryptanalysis",
        mitigation: "Educational use only"
      }
    ];

    // Test vectors using byte arrays - bit-perfect results from implementation
    this.tests = [
      {
        text: "Classic Autokey Example",
        uri: "https://www.dcode.fr/autokey-cipher",
        input: OpCodes.AnsiToBytes("ATTACKATDAWN"),
        key: OpCodes.AnsiToBytes("LEMON"),
        expected: OpCodes.AnsiToBytes("LXFOPKTMDCGN")
      },
      {
        text: "Educational Test Vector",
        uri: "https://practicalcryptography.com/ciphers/classical-era/autokey/",
        input: OpCodes.AnsiToBytes("HELLO"),
        key: OpCodes.AnsiToBytes("KEY"),
        expected: OpCodes.AnsiToBytes("RIJSS")
      },
      {
        text: "DCode Reference",
        uri: "https://www.dcode.fr/autokey-cipher",
        input: OpCodes.AnsiToBytes("DCODE"),
        key: OpCodes.AnsiToBytes("AUTOKEY"),
        expected: OpCodes.AnsiToBytes("DWHRO")
      }
    ];

    // For the test suite compatibility 
    this.testVectors = this.tests;
  }

  // Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new AutokeyCipherInstance(this, isInverse);
  }
}

// Instance class - handles the actual encryption/decryption
class AutokeyCipherInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = [];
    this.inputBuffer = [];
    
    // Character sets
    this.ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }

  // Property setter for key
  set key(keyData) {
    if (!keyData || keyData.length === 0) {
      this._initialKey = "A"; // Default key
    } else {
      // Convert key bytes to uppercase letters only
      const keyStr = String.fromCharCode.apply(null, keyData);
      this._initialKey = keyStr.toUpperCase().replace(/[^A-Z]/g, '');
      if (this._initialKey.length === 0) {
        this._initialKey = "A"; // Fallback
      }
    }
  }

  get key() {
    return this._initialKey || "A";
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
    const initialKey = this.key;
    const inputStr = String.fromCharCode.apply(null, this.inputBuffer);
    
    // Normalize input to uppercase letters only
    const normalizedInput = inputStr.toUpperCase().replace(/[^A-Z]/g, '');
    
    if (this.isInverse) {
      // Decryption: build key as we decrypt
      let extendedKey = initialKey;
      
      for (let i = 0; i < normalizedInput.length; i++) {
        const cipherChar = normalizedInput[i];
        const keyChar = extendedKey[i % extendedKey.length];
        
        const cipherIndex = this.ALPHABET.indexOf(cipherChar);
        const keyIndex = this.ALPHABET.indexOf(keyChar);
        
        // Decrypt: (cipher - key + 26) mod 26
        const plainIndex = (cipherIndex - keyIndex + 26) % 26;
        const plainChar = this.ALPHABET[plainIndex];
        
        // Extend key with decrypted plaintext character
        if (extendedKey.length <= i + initialKey.length) {
          extendedKey += plainChar;
        }
        
        output.push(plainChar.charCodeAt(0));
      }
    } else {
      // Encryption: extend key with plaintext
      let extendedKey = initialKey + normalizedInput;
      
      for (let i = 0; i < normalizedInput.length; i++) {
        const textChar = normalizedInput[i];
        const keyChar = extendedKey[i];
        
        const textIndex = this.ALPHABET.indexOf(textChar);
        const keyIndex = this.ALPHABET.indexOf(keyChar);
        
        // Encrypt: (text + key) mod 26
        const cipherIndex = (textIndex + keyIndex) % 26;
        const cipherChar = this.ALPHABET[cipherIndex];
        
        output.push(cipherChar.charCodeAt(0));
      }
    }

    // Clear input buffer for next operation
    this.inputBuffer = [];
    
    return output;
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new AutokeyCipher());