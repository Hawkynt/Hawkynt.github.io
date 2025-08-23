/*
 * Vigenère Cipher Implementation
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
class VigenereCipher extends CryptoAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Vigenère Cipher";
    this.description = "Classical polyalphabetic substitution cipher using repeating keyword to shift letters. Developed by Blaise de Vigenère in 16th century, considered unbreakable for centuries until Kasiski examination was developed. Uses Caesar cipher with different shift for each position.";
    this.inventor = "Blaise de Vigenère";
    this.year = 1553;
    this.category = CategoryType.CLASSICAL;
    this.subCategory = "Classical Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.FR;

    // Documentation and references
    this.documentation = [
      new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Vigen%C3%A8re_cipher"),
      new LinkItem("Historical Context", "https://en.wikipedia.org/wiki/Blaise_de_Vigen%C3%A8re"),
      new LinkItem("Cryptanalysis Methods", "https://en.wikipedia.org/wiki/Kasiski_examination")
    ];
    
    this.references = [
      new LinkItem("Educational Implementation", "https://www.dcode.fr/vigenere-cipher"),
      new LinkItem("Interactive Tutorial", "https://cryptii.com/pipes/vigenere-cipher"),
      new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/vigenere-gronsfeld-and-autokey/")
    ];
    
    this.knownVulnerabilities = [
      {
        type: "Kasiski Examination",
        text: "Repeated patterns in ciphertext reveal keyword length, enabling frequency analysis",
        uri: "https://en.wikipedia.org/wiki/Kasiski_examination",
        mitigation: "None - fundamental weakness of polyalphabetic substitution"
      },
      {
        type: "Index of Coincidence",
        text: "Statistical analysis can determine keyword length and enable cryptanalysis",
        uri: "https://en.wikipedia.org/wiki/Index_of_coincidence",
        mitigation: "Use only for educational demonstrations"
      }
    ];

    // Test vectors using byte arrays - classical educational examples
    this.tests = [
      {
        text: "Classic Vigenère example from textbooks",
        uri: "https://www.dcode.fr/vigenere-cipher",
        input: OpCodes.AnsiToBytes("ATTACKATDAWN"),
        key: OpCodes.AnsiToBytes("LEMON"),
        expected: OpCodes.AnsiToBytes("LXFOPVEFRNHR")
      },
      {
        text: "GeeksforGeeks educational example",
        uri: "https://www.geeksforgeeks.org/vigenere-cipher/",
        input: OpCodes.AnsiToBytes("GEEKSFORGEEKS"),
        key: OpCodes.AnsiToBytes("AYUSH"),
        expected: OpCodes.AnsiToBytes("GCYCZFMLYLEIM")
      },
      {
        text: "Trinity College Computer Science example",
        uri: "https://www.cs.tcd.ie/courses/bacsf/4ba2.05/crypto/vigenere.html",
        input: OpCodes.AnsiToBytes("TOBEORNOTTOBETHATISTHEQUESTION"),
        key: OpCodes.AnsiToBytes("RELATIONS"),
        expected: OpCodes.AnsiToBytes("KSMEHZBBLKSMEMPOGAJXSEJCSFLZSY")
      },
      {
        text: "Short key pattern test",
        uri: "https://practicalcryptography.com/ciphers/classical-era/vigenere-gronsfeld-and-autokey/",
        input: OpCodes.AnsiToBytes("CRYPTOISSHORTFORCRYPTOGRAPHY"),
        key: OpCodes.AnsiToBytes("ABCD"),
        expected: OpCodes.AnsiToBytes("CSASTPKVSIQUTGQUCSASTPIUAQJB")
      },
      {
        text: "Classic pangram with simple key",
        uri: "https://www.dcode.fr/vigenere-cipher",
        input: OpCodes.AnsiToBytes("THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG"),
        key: OpCodes.AnsiToBytes("KEY"),
        expected: OpCodes.AnsiToBytes("DLCAYGMOZBSUXJMHNSWTQYZCBXFOPYJCBYK")
      }
    ];

    // For the test suite compatibility 
    this.testVectors = this.tests;
  }

  // Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new VigenereCipherInstance(this, isInverse);
  }
}

// Instance class - handles the actual encryption/decryption
class VigenereCipherInstance extends IAlgorithmInstance {
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
    
    // Process each character
    for (let i = 0; i < normalizedInput.length; i++) {
      const textChar = normalizedInput[i];
      const keyChar = processedKey[i % processedKey.length];
      
      const textIndex = this.ALPHABET.indexOf(textChar);
      const keyIndex = this.ALPHABET.indexOf(keyChar);
      
      if (textIndex !== -1 && keyIndex !== -1) {
        let resultIndex;
        if (this.isInverse) {
          // Vigenère decryption: (cipher - key + 26) mod 26
          resultIndex = (textIndex - keyIndex + 26) % 26;
        } else {
          // Vigenère encryption: (text + key) mod 26
          resultIndex = (textIndex + keyIndex) % 26;
        }
        
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
RegisterAlgorithm(new VigenereCipher());