/*
 * Bifid Cipher Implementation
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
        CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = global.AlgorithmFramework;

class BifidCipher extends CryptoAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Bifid Cipher";
    this.description = "Fractionating cipher invented by Félix Delastelle in 1901. Combines Polybius square with transposition, replacing each letter with two coordinates then rearranging them in blocks. Significantly stronger than simple substitution ciphers.";
    this.inventor = "Félix Delastelle";
    this.year = 1901;
    this.category = CategoryType.CLASSICAL;
    this.subCategory = "Classical Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.FR;

    // Standard Polybius square (5x5 grid, I/J combined)
    this.STANDARD_GRID = [
      ['A', 'B', 'C', 'D', 'E'],
      ['F', 'G', 'H', 'I', 'K'],
      ['L', 'M', 'N', 'O', 'P'],
      ['Q', 'R', 'S', 'T', 'U'],
      ['V', 'W', 'X', 'Y', 'Z']
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Bifid_cipher"),
      new LinkItem("Historical Context", "https://en.wikipedia.org/wiki/F%C3%A9lix_Delastelle"),
      new LinkItem("Educational Tutorial", "https://www.dcode.fr/bifid-cipher")
    ];
    
    this.references = [
      new LinkItem("dCode Implementation", "https://www.dcode.fr/bifid-cipher"),
      new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/bifid/"),
      new LinkItem("CrypTool Portal", "https://www.cryptool.org/en/cto/bifid")
    ];
    
    this.knownVulnerabilities = [
      {
        type: "Frequency Analysis",
        text: "While more resistant than monoalphabetic ciphers, still vulnerable to frequency analysis with sufficient text",
        uri: "https://en.wikipedia.org/wiki/Bifid_cipher#Cryptanalysis",
        mitigation: "Use variable block sizes and longer keywords"
      },
      {
        type: "Grid Recovery", 
        text: "Custom keyword grids can sometimes be recovered through cryptanalysis",
        uri: "https://practicalcryptography.com/ciphers/classical-era/bifid/",
        mitigation: "Educational use only - not suitable for actual security"
      }
    ];

    // Test vectors using byte arrays
    this.tests = [
      {
        text: "Basic Test",
        uri: "https://en.wikipedia.org/wiki/Bifid_cipher",
        input: global.OpCodes.AnsiToBytes("HELLO"),
        key: global.OpCodes.AnsiToBytes("5"), // period of 5
        expected: global.OpCodes.AnsiToBytes("FNNVD")
      },
      {
        text: "Custom Keyword Test",
        uri: "https://www.dcode.fr/bifid-cipher",
        input: global.OpCodes.AnsiToBytes("ATTACK"),
        key: global.OpCodes.AnsiToBytes("CIPHER,3"), // keyword CIPHER, period 3
        expected: global.OpCodes.AnsiToBytes("DQTRKI")
      },
      {
        text: "Edge Case",
        uri: "https://en.wikipedia.org/wiki/Bifid_cipher",
        input: global.OpCodes.AnsiToBytes("A"),
        key: global.OpCodes.AnsiToBytes("1"), // period of 1
        expected: global.OpCodes.AnsiToBytes("A")
      }
    ];

    // For the test suite compatibility 
    this.testVectors = this.tests;
  }

  // Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new BifidCipherInstance(this, isInverse);
  }
}

// Instance class - handles the actual encryption/decryption
class BifidCipherInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.keyword = "";
    this.period = 5; // Default period
    this.grid = JSON.parse(JSON.stringify(algorithm.STANDARD_GRID)); // Copy standard grid
    this.inputBuffer = [];
  }

  // Property setter for key (expects "keyword,period" format or just "period")
  set key(keyData) {
    if (!keyData || keyData.length === 0) {
      this.keyword = "";
      this.period = 5;
      this.grid = JSON.parse(JSON.stringify(this.algorithm.STANDARD_GRID));
      return;
    }
    
    // Convert byte array to string
    const keyString = String.fromCharCode(...keyData);
    
    // Parse key string (format: "keyword,period" or just "period")
    const parts = keyString.split(',');
    
    if (parts.length === 2) {
      // Has keyword and period
      this.keyword = parts[0].toUpperCase().replace(/[^A-Z]/g, '');
      this.period = parseInt(parts[1]) || 5;
    } else if (parts.length === 1) {
      // Check if it's just a number (period) or keyword
      const num = parseInt(parts[0]);
      if (!isNaN(num) && num > 0) {
        // It's just a period
        this.keyword = "";
        this.period = num;
      } else {
        // It's just a keyword
        this.keyword = parts[0].toUpperCase().replace(/[^A-Z]/g, '');
        this.period = 5; // Default period
      }
    }
    
    // Ensure period is at least 1
    if (this.period < 1) this.period = 1;
    
    // Create custom grid if keyword provided
    if (this.keyword.length > 0) {
      this.grid = this.createCustomGrid(this.keyword);
    } else {
      this.grid = JSON.parse(JSON.stringify(this.algorithm.STANDARD_GRID));
    }
  }

  get key() {
    if (this.keyword.length > 0) {
      return this.keyword + "," + this.period;
    } else {
      return this.period.toString();
    }
  }

  // Create custom Polybius grid from keyword
  createCustomGrid(keyword) {
    if (!keyword || keyword.length === 0) {
      return JSON.parse(JSON.stringify(this.algorithm.STANDARD_GRID));
    }
    
    // Start with empty grid
    const grid = [[], [], [], [], []];
    const used = new Set();
    let row = 0, col = 0;
    
    // Add keyword letters first (removing duplicates)
    for (const char of keyword) {
      if (char >= 'A' && char <= 'Z' && !used.has(char) && char !== 'J') {
        grid[row][col] = char;
        used.add(char);
        col++;
        if (col >= 5) {
          col = 0;
          row++;
        }
        if (row >= 5) break;
      }
    }
    
    // Fill remaining positions with unused letters (I/J treated as I)
    const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Note: no J
    for (const char of alphabet) {
      if (!used.has(char) && row < 5) {
        grid[row][col] = char;
        used.add(char);
        col++;
        if (col >= 5) {
          col = 0;
          row++;
        }
      }
    }
    
    return grid;
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

    // Convert input buffer to string and clean (letters only, uppercase)
    const inputString = String.fromCharCode(...this.inputBuffer);
    const cleanText = inputString.toUpperCase().replace(/[^A-Z]/g, '');
    
    // Process using Bifid algorithm
    const resultString = this.isInverse ? 
      this.decrypt(cleanText) : 
      this.encrypt(cleanText);
    
    // Clear input buffer for next operation
    this.inputBuffer = [];
    
    // Convert result string back to byte array
    return OpCodes.AnsiToBytes(resultString);
  }

  // Encrypt using Bifid cipher
  encrypt(plaintext) {
    if (plaintext.length === 0) return '';
    
    let result = '';
    
    // Process text in blocks of 'period' length
    for (let blockStart = 0; blockStart < plaintext.length; blockStart += this.period) {
      const blockEnd = Math.min(blockStart + this.period, plaintext.length);
      const block = plaintext.substring(blockStart, blockEnd);
      result += this.processBlock(block, true);
    }
    
    return result;
  }

  // Decrypt using Bifid cipher
  decrypt(ciphertext) {
    if (ciphertext.length === 0) return '';
    
    let result = '';
    
    // Process text in blocks of 'period' length
    for (let blockStart = 0; blockStart < ciphertext.length; blockStart += this.period) {
      const blockEnd = Math.min(blockStart + this.period, ciphertext.length);
      const block = ciphertext.substring(blockStart, blockEnd);
      result += this.processBlock(block, false);
    }
    
    return result;
  }

  // Process a single block (encrypt or decrypt)
  processBlock(block, encrypt) {
    if (block.length === 0) return '';
    
    const coordinates = [];
    
    // Convert characters to coordinates
    for (let i = 0; i < block.length; i++) {
      let char = block.charAt(i);
      if (char === 'J') char = 'I'; // Handle I/J equivalence
      
      // Find character in grid
      let found = false;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (this.grid[row][col] === char) {
            coordinates.push({ row: row, col: col });
            found = true;
            break;
          }
        }
        if (found) break;
      }
      
      if (!found) {
        // Character not found in grid, skip it
        continue;
      }
    }
    
    if (coordinates.length === 0) return '';
    
    // Extract rows and columns
    let rows = [];
    let cols = [];
    
    for (const coord of coordinates) {
      rows.push(coord.row);
      cols.push(coord.col);
    }
    
    let newCoords = [];
    
    if (encrypt) {
      // For encryption: concatenate rows then columns, then pair them up
      const combined = rows.concat(cols);
      for (let i = 0; i < combined.length; i += 2) {
        if (i + 1 < combined.length) {
          newCoords.push({ row: combined[i], col: combined[i + 1] });
        } else {
          // Odd number of coordinates, use same value for both
          newCoords.push({ row: combined[i], col: combined[i] });
        }
      }
    } else {
      // For decryption: extract alternating elements back into rows and columns
      const combined = [];
      for (const coord of coordinates) {
        combined.push(coord.row);
        combined.push(coord.col);
      }
      
      const halfLen = Math.floor(combined.length / 2);
      rows = combined.slice(0, halfLen);
      cols = combined.slice(halfLen);
      
      for (let i = 0; i < rows.length; i++) {
        newCoords.push({ row: rows[i], col: cols[i] });
      }
    }
    
    // Convert coordinates back to characters
    let result = '';
    for (const coord of newCoords) {
      if (coord.row >= 0 && coord.row < 5 && coord.col >= 0 && coord.col < 5) {
        result += this.grid[coord.row][coord.col];
      }
    }
    
    return result;
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new BifidCipher());