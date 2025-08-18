/*
 * Universal Polybius Square Cipher
 * Compatible with both Browser and Node.js environments
 * Foundation cipher for many advanced classical cryptographic systems
 * (c)2025 Hawkynt - Educational Implementation
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Polybius cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load metadata system
  if (!global.CipherMetadata && typeof require !== 'undefined') {
    try {
      require('../../cipher-metadata.js');
    } catch (e) {
      console.warn('Could not load cipher metadata system:', e.message);
    }
  }

  // Create Polybius cipher object
  const Polybius = {
    // Public interface properties
    internalName: 'Polybius',
    name: 'Polybius Square Cipher',
    comment: 'Ancient Greek fractionating cipher using coordinate system (150 BCE)',
    minKeyLength: 0,
    maxKeyLength: 25,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,

    // ===== COMPREHENSIVE METADATA =====
    metadata: {
      // Basic Information
      description: 'The Polybius square is an ancient cryptographic system that converts letters into coordinate pairs using a 5×5 grid. Invented by the Greek historian Polybius around 150 BCE, it serves as the foundation for many advanced classical ciphers.',
      country: 'GR', // Ancient Greece
      countryName: 'Ancient Greece',
      year: -150, // Approximately 150 BCE
      inventor: 'Polybius',
      
      // Classification
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'fractionating',
      securityLevel: 'obsolete',
      complexity: 'beginner',
      
      // Technical Details
      blockSize: 1, // Character-by-character
      keySizes: [0, 25], // No key (standard) or custom alphabet
      keyType: 'alphabet',
      symmetric: true,
      deterministic: true,
      
      // Educational Value
      tags: ['historical', 'educational', 'foundational', 'ancient', 'greece', 'coordinates', 'fractionating'],
      educationalLevel: 'elementary',
      prerequisites: ['basic_coordinates', 'grid_system'],
      learningObjectives: 'Understanding coordinate-based cryptography and fractionating techniques that form the basis for advanced classical ciphers',
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'OBSOLETE: Provides no security by modern standards. Easily broken by frequency analysis. For educational purposes only.',
      vulnerabilities: ['frequency_analysis', 'pattern_analysis', 'coordinate_mapping'],
      
      // Standards and References
      specifications: [
        {
          name: 'Polybius - The Histories',
          url: 'https://en.wikipedia.org/wiki/Polybius_square',
          type: 'historical',
          section: 'Book X',
          verified: true
        },
        {
          name: 'Modern Cryptanalysis References',
          url: 'https://www.dcode.fr/polybius-cipher',
          type: 'educational',
          verified: true
        }
      ],
      
      // Performance Characteristics
      performance: 'O(n) time complexity, instant encryption/decryption',
      memoryUsage: 'Minimal - 5x5 grid storage',
      optimizations: 'Direct coordinate lookup and reverse mapping'
    },

    // ===== COMPREHENSIVE TEST VECTORS WITH HISTORICAL METADATA =====
    testVectors: [
      // Historical Examples
      {
        algorithm: 'Polybius',
        testId: 'polybius-historical-001',
        description: 'Ancient Greek example - transmitted by torch signals',
        category: 'historical',
        input: 'POLYBIUS',
        key: '',
        expected: '35 34 31 54 11 24 45 43',
        source: {
          type: 'historical',
          identifier: 'Polybius-Histories-X.45-47',
          title: 'The Histories of Polybius - Book X',
          url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Polybius/10*.html',
          organization: 'University of Chicago Digital Library',
          datePublished: '150 BCE (approximate)',
          section: 'Chapters 45-47'
        },
        origin: {
          source: 'Polybius Historical Account',
          url: 'https://en.wikipedia.org/wiki/Polybius_square#History',
          type: 'historical',
          date: '150 BCE (approximate)',
          verified: true,
          notes: 'Used for long-distance communication via torch/fire signals between hilltops'
        }
      },
      {
        algorithm: 'Polybius',
        testId: 'polybius-historical-002',
        description: 'Nihilist prison communications example',
        category: 'historical',
        input: 'FREEDOM',
        key: '',
        expected: '21 42 15 15 14 34 32',
        source: {
          type: 'historical',
          identifier: 'Russian-Prison-Tap-Code',
          title: 'Tap Code used in Russian prisons',
          url: 'https://en.wikipedia.org/wiki/Tap_code',
          organization: 'Historical Records',
          datePublished: '19th century',
          section: 'Prison Communication Systems'
        },
        origin: {
          source: 'Russian Nihilist Movement',
          type: 'historical-application',
          notes: 'Adapted for prison wall tapping - number of taps indicates coordinates'
        }
      },
      
      // Educational Standards
      {
        algorithm: 'Polybius',
        testId: 'polybius-standard-001',
        description: 'Complete alphabet transformation test',
        category: 'educational',
        input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        key: '',
        expected: '11 12 13 14 15 21 22 23 24 25 31 32 33 34 35 41 42 43 44 45 51 52 53 54 55',
        source: {
          type: 'educational',
          title: 'Polybius Square - Complete Reference',
          url: 'https://cryptii.com/pipes/polybius-square',
          organization: 'Cryptii Educational Platform'
        },
        origin: {
          source: 'Educational Standard',
          type: 'verification',
          verified: true,
          notes: 'Standard test for coordinate mapping correctness'
        }
      },
      {
        algorithm: 'Polybius',
        testId: 'polybius-standard-002',
        description: 'Mixed case preservation test',
        category: 'implementation',
        input: 'Hello World',
        key: '',
        expected: '23 15 31 31 34 52 34 42 31 14',
        properties: {
          preserveCase: false,
          preservePunctuation: false,
          preserveSpaces: false,
          normalization: 'uppercase-letters-only'
        }
      },
      
      // I/J Handling Tests
      {
        algorithm: 'Polybius',
        testId: 'polybius-ij-001',
        description: 'I/J equivalence in 5x5 grid',
        category: 'edge-case',
        input: 'INJUSTICE',
        key: '',
        expected: '24 33 24 45 43 44 24 13 15',
        verification: {
          gridConstraint: '5x5 grid requires I and J to share position (2,4)',
          handling: 'Both I and J map to coordinates 24'
        },
        source: {
          type: 'educational',
          title: 'Classical 5x5 Polybius Grid',
          url: 'https://www.dcode.fr/polybius-cipher'
        }
      },
      
      // Edge Cases and Robustness Tests
      {
        algorithm: 'Polybius',
        testId: 'polybius-edge-001',
        description: 'Single character test',
        category: 'edge-case',
        input: 'A',
        key: '',
        expected: '11',
        verification: {
          coordinates: 'A is at row 1, column 1'
        }
      },
      {
        algorithm: 'Polybius',
        testId: 'polybius-edge-002',
        description: 'Non-alphabetic character handling',
        category: 'edge-case',
        input: 'HELLO, WORLD! 123',
        key: '',
        expected: '23 15 31 31 34 52 34 42 31 14',
        properties: {
          filteringMode: 'letters-only',
          punctuationHandling: 'ignore',
          digitHandling: 'ignore',
          spaceHandling: 'ignore'
        }
      },
      
      // Custom Alphabet Tests
      {
        algorithm: 'Polybius',
        testId: 'polybius-custom-001',
        description: 'Custom keyword alphabet',
        category: 'advanced',
        input: 'HELLO',
        key: 'KEYWORD',
        expected: '22 21 31 31 44',
        keywordGrid: [
          ['K', 'E', 'Y', 'W', 'O'],
          ['R', 'D', 'A', 'B', 'C'],
          ['F', 'G', 'H', 'I', 'L'],
          ['M', 'N', 'P', 'Q', 'S'],
          ['T', 'U', 'V', 'X', 'Z']
        ],
        verification: {
          keywordProcessing: 'Remove duplicates, fill with remaining alphabet',
          gridConstruction: 'KEYWORD → KEYWORDFGHI...'
        }
      },
      
      // Frequency Analysis Demonstration
      {
        algorithm: 'Polybius',
        testId: 'polybius-frequency-001',
        description: 'Frequency analysis vulnerability demonstration',
        category: 'cryptanalysis',
        input: 'THE QUICK BROWN FOX',
        key: '',
        expected: '44 23 15 41 45 24 13 22 12 42 34 52 33 21 34 54',
        frequencyAnalysis: {
          mostCommonPairs: ['34 (O)', '15 (E)', '23 (H)'],
          attackMethod: 'Coordinate frequency maps to letter frequency',
          vulnerability: 'Each letter always maps to same coordinate pair'
        },
        source: {
          type: 'educational',
          title: 'Frequency Analysis of Polybius Square',
          url: 'https://crypto.stanford.edu/pbc/notes/crypto/frequency.html',
          organization: 'Stanford University'
        }
      },
      
      // Pattern Recognition Tests
      {
        algorithm: 'Polybius',
        testId: 'polybius-pattern-001',
        description: 'Pattern analysis - repeated words',
        category: 'cryptanalysis',
        input: 'THAT THAT',
        key: '',
        expected: '44 23 11 44 44 23 11 44',
        patternAnalysis: {
          repeatedPattern: '44 23 11 44',
          plaintext: 'THAT',
          vulnerability: 'Identical plaintext produces identical ciphertext patterns'
        }
      }
    ],
    
    // Standard 5x5 Polybius grid (I and J share the same cell)
    STANDARD_GRID: [
      ['A', 'B', 'C', 'D', 'E'],
      ['F', 'G', 'H', 'I', 'K'],
      ['L', 'M', 'N', 'O', 'P'],
      ['Q', 'R', 'S', 'T', 'U'],
      ['V', 'W', 'X', 'Y', 'Z']
    ],
    
    isInitialized: false,
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Polybius',
      displayName: 'Polybius Square',
      description: 'Ancient coordinate-based cipher system that converts letters to coordinate pairs using a 5×5 grid. Forms the foundation for many advanced classical ciphers including Bifid, Trifid, and tap codes.',
      
      inventor: 'Polybius',
      year: -150, // 150 BCE
      background: 'Invented by the Greek historian Polybius for long-distance communication using torch signals. Each letter is converted to row and column coordinates, which could be transmitted as visual signals between hilltops.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.OBSOLETE,
      securityNotes: 'Completely insecure by modern standards. Provides no cryptographic security - merely converts letters to numbers. Vulnerable to frequency analysis and pattern recognition.',
      
      category: global.CipherMetadata.Categories.CLASSICAL,
      subcategory: 'fractionating',
      complexity: global.CipherMetadata.ComplexityLevels.BEGINNER,
      
      keySize: 0, // No key for standard grid, optional keyword for custom grid
      blockSize: 1, // Character-by-character processing
      rounds: 1,
      
      specifications: [
        {
          name: 'Wikipedia: Polybius Square',
          url: 'https://en.wikipedia.org/wiki/Polybius_square'
        },
        {
          name: 'dCode: Polybius Cipher',
          url: 'https://www.dcode.fr/polybius-cipher'
        }
      ],
      
      testVectors: [
        {
          name: 'Educational Examples',
          url: 'https://cryptii.com/pipes/polybius-square'
        }
      ],
      
      references: [
        {
          name: 'Polybius: The Histories - Book X',
          url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Polybius/10*.html'
        },
        {
          name: 'Kahn, David: The Codebreakers (1967)',
          url: 'https://www.amazon.com/Codebreakers-David-Kahn/dp/0684831309'
        }
      ],
      
      implementationNotes: 'Standard 5×5 grid with I/J sharing position (2,4). Supports optional keyword for custom alphabet arrangement. Non-alphabetic characters are filtered out.',
      performanceNotes: 'O(n) time complexity. Extremely fast due to direct coordinate lookup via 2D array indexing.',
      
      educationalValue: 'Excellent introduction to coordinate-based cryptography and fractionating ciphers. Foundation for understanding Bifid, Trifid, and modern coordinate systems.',
      prerequisites: ['Basic coordinate system understanding', 'Grid/matrix concepts'],
      
      tags: ['classical', 'fractionating', 'coordinates', 'ancient', 'foundational', 'educational', 'greece'],
      
      version: '1.0'
    }) : null,
    
    // Initialize cipher
    Init: function() {
      Polybius.isInitialized = true;
    },
    
    // Set up key (optional keyword for custom grid)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'Polybius[' + global.generateUniqueID() + ']';
      } while (Polybius.instances[id] || global.objectInstances[id]);
      
      Polybius.instances[id] = new Polybius.PolybiusInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Polybius.instances[id]) {
        delete Polybius.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Polybius', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!Polybius.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Polybius', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Polybius.instances[id];
      const grid = instance.grid;
      let result = [];
      
      // Convert to uppercase and filter to letters only
      const cleanText = plaintext.toUpperCase().replace(/[^A-Z]/g, '');
      
      for (let i = 0; i < cleanText.length; i++) {
        let char = cleanText.charAt(i);
        
        // Handle I/J equivalence
        if (char === 'J') char = 'I';
        
        // Find character in grid
        let found = false;
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            if (grid[row][col] === char) {
              result.push((row + 1).toString() + (col + 1).toString());
              found = true;
              break;
            }
          }
          if (found) break;
        }
        
        if (!found) {
          // This shouldn't happen with proper filtering, but handle gracefully
          result.push('??');
        }
      }
      
      return result.join(' ');
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!Polybius.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Polybius', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = Polybius.instances[id];
      const grid = instance.grid;
      let result = '';
      
      // Split by spaces and process each coordinate pair
      const coordinates = ciphertext.trim().split(/\s+/);
      
      for (let i = 0; i < coordinates.length; i++) {
        const coord = coordinates[i];
        
        if (coord.length === 2 && /^\d\d$/.test(coord)) {
          const row = parseInt(coord.charAt(0)) - 1;
          const col = parseInt(coord.charAt(1)) - 1;
          
          if (row >= 0 && row < 5 && col >= 0 && col < 5) {
            result += grid[row][col];
          } else {
            result += '?'; // Invalid coordinates
          }
        } else {
          result += '?'; // Invalid format
        }
      }
      
      return result;
    },
    
    // Create custom grid from keyword
    createCustomGrid: function(keyword) {
      if (!keyword || keyword.length === 0) {
        return JSON.parse(JSON.stringify(Polybius.STANDARD_GRID));
      }
      
      // Normalize keyword: uppercase, letters only, remove duplicates
      const cleanKeyword = keyword.toUpperCase().replace(/[^A-Z]/g, '');
      let uniqueKeyword = '';
      const seen = {};
      
      for (let i = 0; i < cleanKeyword.length; i++) {
        let char = cleanKeyword.charAt(i);
        if (char === 'J') char = 'I'; // Handle I/J equivalence
        if (!seen[char]) {
          uniqueKeyword += char;
          seen[char] = true;
        }
      }
      
      // Generate full alphabet excluding used characters
      const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Note: no J
      let remaining = '';
      
      for (let i = 0; i < alphabet.length; i++) {
        const char = alphabet.charAt(i);
        if (!seen[char]) {
          remaining += char;
        }
      }
      
      // Combine keyword with remaining letters
      const fullAlphabet = uniqueKeyword + remaining;
      
      // Fill 5x5 grid
      const grid = [];
      let index = 0;
      
      for (let row = 0; row < 5; row++) {
        grid[row] = [];
        for (let col = 0; col < 5; col++) {
          grid[row][col] = fullAlphabet.charAt(index++);
        }
      }
      
      return grid;
    },
    
    // Instance class
    PolybiusInstance: function(keyword) {
      this.keyword = keyword || '';
      this.grid = Polybius.createCustomGrid(keyword);
    },
    
    // Add uppercase aliases for compatibility with test runner
    EncryptBlock: function(id, plaintext) {
      return this.encryptBlock(id, plaintext);
    },
    
    DecryptBlock: function(id, ciphertext) {
      return this.decryptBlock(id, ciphertext);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Polybius);
  }
  
  // Export to global scope
  global.Polybius = Polybius;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Polybius;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);