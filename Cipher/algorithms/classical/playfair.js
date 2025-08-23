/*
 * Playfair Cipher Implementation
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

class PlayfairCipher extends CryptoAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Playfair Cipher";
    this.description = "Classical digraph substitution cipher using 5x5 key grid. Encrypts pairs of letters according to position rules. Invented by Charles Wheatstone but popularized by Lord Playfair. More secure than simple substitution ciphers.";
    this.inventor = "Charles Wheatstone";
    this.year = 1854;
    this.category = CategoryType.CLASSICAL;
    this.subCategory = "Classical Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.GB;

    // Documentation and references
    this.documentation = [
      new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Playfair_cipher"),
      new LinkItem("Historical Background", "https://en.wikipedia.org/wiki/Charles_Wheatstone"),
      new LinkItem("Cryptanalysis Methods", "https://www.dcode.fr/playfair-cipher")
    ];
    
    this.references = [
      new LinkItem("DCode Implementation", "https://www.dcode.fr/playfair-cipher"),
      new LinkItem("Educational Tutorial", "https://cryptii.com/pipes/playfair-cipher"),
      new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/playfair/")
    ];
    
    this.knownVulnerabilities = [
      {
        type: "Digraph Frequency Analysis",
        text: "Common digraph patterns in plaintext create patterns in ciphertext, enabling cryptanalysis",
        uri: "https://en.wikipedia.org/wiki/Frequency_analysis",
        mitigation: "Educational use only - use modern ciphers for real security"
      },
      {
        type: "Known Plaintext Attack",
        text: "If plaintext-ciphertext pairs are known, key matrix can be reconstructed",
        uri: "https://en.wikipedia.org/wiki/Known-plaintext_attack",
        mitigation: "Avoid using with predictable or repeated messages"
      }
    ];

    // Test vectors using byte arrays - bit-perfect results from implementation
    this.tests = [
      {
        text: "Lord Playfair Demonstration",
        uri: "https://en.wikipedia.org/wiki/Playfair_cipher#History",
        input: OpCodes.AnsiToBytes("HIDETHEGOLDINTHETREESTUMP"),
        key: OpCodes.AnsiToBytes("PLAYFAIREXAMPLE"),
        expected: OpCodes.AnsiToBytes("BMODZBXDNABEKUDMUIXMMOUVIF")
      },
      {
        text: "Standard Educational Example", 
        uri: "https://www.dcode.fr/playfair-cipher",
        input: OpCodes.AnsiToBytes("INSTRUMENTS"),
        key: OpCodes.AnsiToBytes("MONARCHY"),
        expected: OpCodes.AnsiToBytes("GATLMZCLRQXA")
      },
      {
        text: "Hello World Test",
        uri: "https://practicalcryptography.com/ciphers/classical-era/playfair/",
        input: OpCodes.AnsiToBytes("HELLO"),
        key: OpCodes.AnsiToBytes("KEYWORD"),
        expected: OpCodes.AnsiToBytes("GYIZSC")
      }
    ];

    // For the test suite compatibility 
    this.testVectors = this.tests;
  }

  // Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new PlayfairCipherInstance(this, isInverse);
  }
}

// Instance class - handles the actual encryption/decryption
class PlayfairCipherInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = [];
    this.inputBuffer = [];
    
    // Playfair uses 5x5 grid (I=J)
    this.ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Note: no J
  }

  // Property setter for key
  set key(keyData) {
    if (!keyData || keyData.length === 0) {
      this._keyMatrix = this.createMatrix("KEYWORD"); // Default key
    } else {
      // Convert key bytes to uppercase letters only
      const keyStr = String.fromCharCode.apply(null, keyData);
      const processedKey = keyStr.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I');
      this._keyMatrix = this.createMatrix(processedKey || "KEYWORD");
    }
  }

  get key() {
    return this._keyMatrix;
  }

  // Create 5x5 Playfair key matrix
  createMatrix(key) {
    const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Note: no J
    const used = new Set();
    const matrix = [];
    
    // Add unique characters from key first
    for (const char of key) {
      if (alphabet.includes(char) && !used.has(char)) {
        matrix.push(char);
        used.add(char);
      }
    }
    
    // Fill remaining positions with unused alphabet letters
    for (const char of alphabet) {
      if (!used.has(char)) {
        matrix.push(char);
      }
    }
    
    // Convert to 5x5 grid
    const grid = [];
    for (let i = 0; i < 5; i++) {
      grid[i] = matrix.slice(i * 5, (i + 1) * 5);
    }
    
    return grid;
  }

  // Find position of character in matrix
  findPosition(char, matrix) {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (matrix[row][col] === char) {
          return {row, col};
        }
      }
    }
    return null;
  }

  // Process digraph according to Playfair rules
  processDigraph(char1, char2, matrix, encrypt = true) {
    const pos1 = this.findPosition(char1, matrix);
    const pos2 = this.findPosition(char2, matrix);
    
    if (!pos1 || !pos2) return char1 + char2; // Fallback
    
    let newPos1, newPos2;
    
    if (pos1.row === pos2.row) {
      // Same row - move horizontally
      const shift = encrypt ? 1 : -1;
      newPos1 = {row: pos1.row, col: (pos1.col + shift + 5) % 5};
      newPos2 = {row: pos2.row, col: (pos2.col + shift + 5) % 5};
    } else if (pos1.col === pos2.col) {
      // Same column - move vertically
      const shift = encrypt ? 1 : -1;
      newPos1 = {row: (pos1.row + shift + 5) % 5, col: pos1.col};
      newPos2 = {row: (pos2.row + shift + 5) % 5, col: pos2.col};
    } else {
      // Rectangle - swap columns
      newPos1 = {row: pos1.row, col: pos2.col};
      newPos2 = {row: pos2.row, col: pos1.col};
    }
    
    return matrix[newPos1.row][newPos1.col] + matrix[newPos2.row][newPos2.col];
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
    const matrix = this.key;
    const inputStr = String.fromCharCode.apply(null, this.inputBuffer);
    
    // Normalize input to uppercase letters only, replace J with I
    let normalizedInput = inputStr.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I');
    
    // Prepare text for digraph processing (handle duplicate letters)
    let processedText = '';
    let i = 0;
    while (i < normalizedInput.length) {
      let char1 = normalizedInput[i];
      let char2 = normalizedInput[i + 1];
      
      if (char2 === undefined) {
        // Odd length - pad with X
        processedText += char1 + 'X';
        break;
      } else if (char1 === char2) {
        // Same characters - insert X between them
        processedText += char1 + 'X';
        i++; // Move to next character (the duplicate will be processed in next iteration)
      } else {
        // Different characters - process normally
        processedText += char1 + char2;
        i += 2; // Move to next pair
      }
    }
    
    // Process each digraph
    for (let i = 0; i < processedText.length; i += 2) {
      const char1 = processedText[i];
      const char2 = processedText[i + 1];
      
      const result = this.processDigraph(char1, char2, matrix, !this.isInverse);
      
      for (const char of result) {
        output.push(char.charCodeAt(0));
      }
    }

    // Clear input buffer for next operation
    this.inputBuffer = [];
    
    return output;
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new PlayfairCipher());