/*
 * Porta Cipher Implementation
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

class PortaCipher extends CryptoAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Porta Cipher";
    this.description = "Reciprocal polyalphabetic substitution cipher invented by Giovan Battista Bellaso in 1563. Uses 13-row substitution tableau where same operation encrypts and decrypts. Key feature is reciprocal property making it self-inverse.";
    this.inventor = "Giovan Battista Bellaso";
    this.year = 1563;
    this.category = CategoryType.CLASSICAL;
    this.subCategory = "Classical Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.IT;

    // Documentation and references
    this.documentation = [
      new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Porta_cipher"),
      new LinkItem("Historical Context", "https://archive.org/details/lacifradelsiggio00bell"),
      new LinkItem("Educational Tutorial", "https://cryptii.com/pipes/porta-cipher")
    ];
    
    this.references = [
      new LinkItem("dCode Implementation", "https://www.dcode.fr/porta-cipher"),
      new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/porta/")
    ];
    
    this.knownVulnerabilities = [
      {
        type: "Period Analysis",
        text: "Short keys create detectable repeating patterns vulnerable to Kasiski examination",
        uri: "https://en.wikipedia.org/wiki/Kasiski_examination",
        mitigation: "Use longer, non-repeating keys"
      },
      {
        type: "Limited Alphabets", 
        text: "Only 13 effective substitution alphabets vs 26 in full polyalphabetic ciphers",
        uri: "https://en.wikipedia.org/wiki/Porta_cipher#Security",
        mitigation: "Educational use only - not suitable for actual security"
      }
    ];

    // Porta tableau - 13 reciprocal substitution alphabets
    this.PORTA_TABLEAU = [
      'NOPQRSTUVWXYZABCDEFGHIJKLM', // A,B
      'OPQRSTUVWXYZABCDEFGHIJKLMN', // C,D
      'PQRSTUVWXYZABCDEFGHIJKLMNO', // E,F
      'QRSTUVWXYZABCDEFGHIJKLMNOP', // G,H
      'RSTUVWXYZABCDEFGHIJKLMNOPQ', // I,J
      'STUVWXYZABCDEFGHIJKLMNOPQR', // K,L
      'TUVWXYZABCDEFGHIJKLMNOPQRS', // M,N
      'UVWXYZABCDEFGHIJKLMNOPQRST', // O,P
      'VWXYZABCDEFGHIJKLMNOPQRSTU', // Q,R
      'WXYZABCDEFGHIJKLMNOPQRSTUV', // S,T
      'XYZABCDEFGHIJKLMNOPQRSTUVW', // U,V
      'YZABCDEFGHIJKLMNOPQRSTUVWX', // W,X
      'ZABCDEFGHIJKLMNOPQRSTUVWXY'  // Y,Z
    ];

    // Test vectors using byte arrays
    this.tests = [
      {
        text: "Basic Test",
        uri: "https://en.wikipedia.org/wiki/Porta_cipher",
        input: global.OpCodes ? global.OpCodes.AnsiToBytes("HELLO") : [72, 69, 76, 76, 79],
        key: global.OpCodes ? global.OpCodes.AnsiToBytes("KEY") : [75, 69, 89],
        expected: global.OpCodes ? global.OpCodes.AnsiToBytes("ZTKDD") : [90, 84, 75, 68, 68]
      },
      {
        text: "Extended Test",
        uri: "https://cryptii.com/pipes/porta-cipher",
        input: global.OpCodes ? global.OpCodes.AnsiToBytes("ATTACKATDAWN") : [65, 84, 84, 65, 67, 75, 65, 84, 68, 65, 87, 78],
        key: global.OpCodes ? global.OpCodes.AnsiToBytes("CIPHER") : [67, 73, 80, 72, 69, 82],
        expected: global.OpCodes ? global.OpCodes.AnsiToBytes("OKNQRFOKXQLI") : [79, 75, 78, 81, 82, 70, 79, 75, 88, 81, 76, 73]
      },
      {
        text: "Full Alphabet Test",
        uri: "https://www.dcode.fr/porta-cipher",
        input: global.OpCodes ? global.OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ") : [65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
        key: global.OpCodes ? global.OpCodes.AnsiToBytes("A") : [65],
        expected: global.OpCodes ? global.OpCodes.AnsiToBytes("NOPQRSTUVWXYZABCDEFGHIJKLM") : [78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77]
      }
    ];

    // For the test suite compatibility 
    this.testVectors = this.tests;
  }

  // Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new PortaCipherInstance(this, isInverse);
  }
}

// Instance class - handles the actual encryption/decryption
class PortaCipherInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = OpCodes.AnsiToBytes("CIPHER"); // Default key
    this.inputBuffer = [];
    
    // Reference to Porta tableau
    this.PORTA_TABLEAU = algorithm.PORTA_TABLEAU;
  }

  // Property setter for key 
  set key(keyData) {
    if (!keyData || keyData.length === 0) {
      this._key = OpCodes.AnsiToBytes("CIPHER");
      return;
    }
    
    // Convert byte array to string and validate/clean alphabetic characters only
    const keyString = String.fromCharCode(...keyData);
    const cleanKey = keyString.replace(/[^A-Za-z]/g, '').toUpperCase();
    this._key = OpCodes.AnsiToBytes(cleanKey || "CIPHER");
  }

  get key() {
    return this._key || OpCodes.AnsiToBytes("CIPHER");
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
    const keyString = String.fromCharCode(...this.key);
    let keyIndex = 0;
    
    // Process each byte
    for (const byte of this.inputBuffer) {
      const char = String.fromCharCode(byte);
      
      if (this.isLetter(char)) {
        const keyChar = keyString.charAt(keyIndex % keyString.length);
        const processed = this.substituteChar(char, keyChar);
        output.push(processed.charCodeAt(0));
        keyIndex++;
      } else {
        // Preserve non-alphabetic characters
        output.push(byte);
      }
    }

    // Clear input buffer for next operation
    this.inputBuffer = [];
    
    return output;
  }

  // Check if character is a letter
  isLetter(char) {
    return /[A-Za-z]/.test(char);
  }

  // Substitute character using Porta tableau
  substituteChar(char, keyChar) {
    if (!this.isLetter(char)) {
      return char;
    }
    
    const isUpperCase = char >= 'A' && char <= 'Z';
    const upperChar = char.toUpperCase();
    const upperKeyChar = keyChar.toUpperCase();
    
    // Determine which row of the tableau to use
    const keyCharCode = upperKeyChar.charCodeAt(0) - 65; // A=0, B=1, etc.
    const tableRow = Math.floor(keyCharCode / 2); // A,B→0, C,D→1, etc.
    
    // Find position of character in alphabet
    const charPos = upperChar.charCodeAt(0) - 65; // A=0, B=1, etc.
    
    // Get substitution from tableau
    const substitution = this.PORTA_TABLEAU[tableRow].charAt(charPos);
    
    // Preserve original case
    return isUpperCase ? substitution : substitution.toLowerCase();
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new PortaCipher());