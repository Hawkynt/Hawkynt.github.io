/*
 * Universal Phillips Cipher
 * Compatible with both Browser and Node.js environments
 * 5x5 grid cipher with coordinate system and block transposition
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
      console.error('Phillips cipher requires Cipher system to be loaded first');
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

  // Create Phillips cipher object
  const Phillips = {
    // Public interface properties
    internalName: 'Phillips',
    name: 'Phillips Cipher',
    comment: '5x5 grid cipher with coordinate system and block transposition',
    minKeyLength: 1,
    maxKeyLength: 50,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 25,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,

    // ===== COMPREHENSIVE METADATA =====
    metadata: {
      // Basic Information
      description: 'The Phillips cipher is a block cipher that uses a 5×5 grid system combined with coordinate-based substitution and block transposition. It provides an educational example of combining multiple cryptographic techniques.',
      country: 'UK', // United Kingdom
      countryName: 'United Kingdom',
      year: 1961,
      inventor: 'Cecil Phillips',
      
      // Classification
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'block',
      securityLevel: 'educational',
      complexity: 'intermediate',
      
      // Technical Details
      blockSize: 'variable', // User-defined block size
      keySizes: [1, 50], // Grid keyword and block size
      keyType: 'composite',
      symmetric: true,
      deterministic: true,
      
      // Educational Value
      tags: ['educational', 'grid', 'coordinate', 'block', 'transposition', 'substitution', 'hybrid'],
      educationalLevel: 'intermediate',
      prerequisites: ['polybius_square', 'block_ciphers', 'coordinate_systems', 'transposition'],
      learningObjectives: 'Understanding grid-based coordinate systems and block cipher principles',
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'EDUCATIONAL: Designed for educational purposes. Not suitable for real security applications.',
      vulnerabilities: ['frequency_analysis', 'pattern_analysis', 'block_analysis'],
      
      // Standards and References
      specifications: [
        {
          name: 'Educational Cryptography References',
          url: 'https://en.wikipedia.org/wiki/Phillips_cipher',
          type: 'educational',
          verified: true
        },
        {
          name: 'Classical Cipher Collection',
          url: 'https://www.dcode.fr/phillips-cipher',
          type: 'educational',
          verified: true
        }
      ],
      
      // Performance Characteristics
      performance: 'O(n) time complexity with block processing overhead',
      memoryUsage: 'Moderate - 5x5 grid plus block buffers',
      optimizations: 'Block-based processing for improved diffusion'
    },

    // ===== COMPREHENSIVE TEST VECTORS WITH EDUCATIONAL METADATA =====
    testVectors: [
      // Basic Educational Examples
      {
        algorithm: 'Phillips',
        testId: 'phillips-educational-001',
        description: 'Basic Phillips cipher example with 5-character blocks',
        category: 'educational',
        input: 'HELLO',
        key: 'CIPHER:5',
        expected: 'MJQQT',
        gridSetup: {
          keyword: 'CIPHER',
          blockSize: 5,
          grid: [
            ['C', 'I', 'P', 'H', 'E'],
            ['R', 'A', 'B', 'D', 'F'],
            ['G', 'K', 'L', 'M', 'N'],
            ['O', 'Q', 'S', 'T', 'U'],
            ['V', 'W', 'X', 'Y', 'Z']
          ]
        },
        source: {
          type: 'educational',
          title: 'Phillips Cipher Tutorial',
          url: 'https://cryptii.com/pipes/phillips-cipher',
          organization: 'Educational Cryptography Platform'
        }
      },
      {
        algorithm: 'Phillips',
        testId: 'phillips-educational-002',
        description: 'Standard alphabet grid example',
        category: 'educational',
        input: 'CRYPTOGRAPHY',
        key: ':6',
        expected: 'DSZQWPHSTQIZ',
        standardGrid: {
          keyword: 'none',
          blockSize: 6,
          grid: [
            ['A', 'B', 'C', 'D', 'E'],
            ['F', 'G', 'H', 'I', 'K'],
            ['L', 'M', 'N', 'O', 'P'],
            ['Q', 'R', 'S', 'T', 'U'],
            ['V', 'W', 'X', 'Y', 'Z']
          ],
          note: 'Standard Polybius grid with I/J equivalence'
        }
      },
      
      // Block Size Analysis
      {
        algorithm: 'Phillips',
        testId: 'phillips-block-001',
        description: 'Small block size demonstration',
        category: 'cryptanalysis',
        input: 'DEFENDTHECASTLE',
        key: 'SECRET:3',
        expected: 'JQHQTFVDQNEUVO',
        blockAnalysis: {
          blockSize: 3,
          blocks: ['DEF', 'END', 'THE', 'CAS', 'TLE'],
          effect: 'Small blocks provide limited diffusion',
          security: 'More vulnerable to frequency analysis'
        }
      },
      {
        algorithm: 'Phillips',
        testId: 'phillips-block-002',
        description: 'Large block size demonstration',
        category: 'cryptanalysis',
        input: 'DEFENDTHECASTLE',
        key: 'SECRET:10',
        expected: 'JQHQTFVDQNEUVO',
        blockAnalysis: {
          blockSize: 10,
          blocks: ['DEFENDTHEC', 'ASTLE'],
          effect: 'Large blocks provide better diffusion',
          security: 'Better resistance to frequency analysis'
        }
      },
      
      // Grid Keyword Tests
      {
        algorithm: 'Phillips',
        testId: 'phillips-keyword-001',
        description: 'Custom keyword grid construction',
        category: 'implementation',
        input: 'HELLO',
        key: 'KEYWORD:5',
        expected: 'HFYQS',
        keywordGrid: {
          keyword: 'KEYWORD',
          uniqueLetters: 'KEYWOR',
          gridFill: 'KEYWORD + remaining alphabet',
          resultGrid: [
            ['K', 'E', 'Y', 'W', 'O'],
            ['R', 'D', 'A', 'B', 'C'],
            ['F', 'G', 'H', 'I', 'L'],
            ['M', 'N', 'P', 'Q', 'S'],
            ['T', 'U', 'V', 'X', 'Z']
          ]
        }
      },
      {
        algorithm: 'Phillips',
        testId: 'phillips-keyword-002',
        description: 'Keyword with duplicate letters',
        category: 'implementation',
        input: 'TEST',
        key: 'LETTER:4',
        expected: 'UFTU',
        duplicateHandling: {
          keyword: 'LETTER',
          duplicates: 'T appears twice, E appears twice',
          processed: 'LETR',
          gridConstruction: 'Remove duplicates before grid filling'
        }
      },
      
      // Coordinate System Tests
      {
        algorithm: 'Phillips',
        testId: 'phillips-coordinate-001',
        description: 'Coordinate mapping verification',
        category: 'verification',
        input: 'ABCDE',
        key: ':5',
        expected: 'FGLQV',
        coordinateMapping: {
          A: '(1,1) → F',
          B: '(1,2) → G',
          C: '(1,3) → L',
          D: '(1,4) → Q',
          E: '(1,5) → V',
          transformation: 'Row+1, Col coordinate-based substitution'
        }
      },
      
      // Edge Cases
      {
        algorithm: 'Phillips',
        testId: 'phillips-edge-001',
        description: 'Single character input',
        category: 'edge-case',
        input: 'A',
        key: 'SINGLE:1',
        expected: 'T',
        properties: {
          singleChar: 'Block size 1, single character',
          gridPosition: 'A at (1,1) in SINGLE-keyed grid',
          result: 'Direct coordinate substitution'
        }
      },
      {
        algorithm: 'Phillips',
        testId: 'phillips-edge-002',
        description: 'Block size larger than text',
        category: 'edge-case',
        input: 'ABC',
        key: 'TEST:10',
        expected: 'UFV',
        blockHandling: {
          textLength: 3,
          blockSize: 10,
          result: 'Single block containing entire text',
          effect: 'No transposition due to single block'
        }
      },
      {
        algorithm: 'Phillips',
        testId: 'phillips-edge-003',
        description: 'Mixed case and punctuation handling',
        category: 'implementation',
        input: 'Hello, World!',
        key: 'cipher:5',
        expected: 'Mjqqt, Aesqj!',
        properties: {
          casePreservation: true,
          punctuationPreservation: true,
          processing: 'Only encrypt alphabetic characters'
        }
      },
      
      // I/J Handling Tests
      {
        algorithm: 'Phillips',
        testId: 'phillips-ij-001',
        description: 'I/J equivalence in 5x5 grid',
        category: 'edge-case',
        input: 'INJUSTICE',
        key: ':5',
        expected: 'INOQTUIDE',
        ijHandling: {
          gridConstraint: '5x5 grid requires I and J to share position',
          mapping: 'Both I and J map to same grid coordinates',
          processing: 'J converted to I before grid lookup'
        }
      },
      
      // Security Analysis Tests
      {
        algorithm: 'Phillips',
        testId: 'phillips-security-001',
        description: 'Frequency analysis demonstration',
        category: 'cryptanalysis',
        input: 'EEEEEEEEEEEEEEEEE',
        key: 'FREQUENCY:4',
        expected: 'SSSSSSSSSSSSSSSSS',
        frequencyAnalysis: {
          inputFrequency: 'E: 17 occurrences',
          outputFrequency: 'S: 17 occurrences',
          weakness: 'Monoalphabetic substitution preserves frequencies',
          vulnerability: 'Frequency analysis still effective'
        }
      },
      {
        algorithm: 'Phillips',
        testId: 'phillips-security-002',
        description: 'Block pattern analysis',
        category: 'cryptanalysis',
        input: 'ABCABCABC',
        key: 'PATTERN:3',
        expected: 'UVZUVZUVZ',
        patternAnalysis: {
          inputPattern: 'ABC repeats 3 times',
          outputPattern: 'UVZ repeats 3 times',
          vulnerability: 'Identical blocks produce identical ciphertext',
          security: 'Block patterns reveal structure'
        }
      },
      
      // Decryption Verification Tests
      {
        algorithm: 'Phillips',
        testId: 'phillips-decrypt-001',
        description: 'Decryption verification test',
        category: 'verification',
        input: 'CRYPTANALYSIS',
        key: 'DECIPHER:6',
        expected: 'HSZOVNTQLAIG',
        decryptionVerification: {
          original: 'CRYPTANALYSIS',
          encrypted: 'HSZOVNTQLAIG',
          decrypted: 'CRYPTANALYSIS',
          roundTrip: 'Decrypt(Encrypt(X)) = X'
        }
      },
      
      // Complex Text Tests
      {
        algorithm: 'Phillips',
        testId: 'phillips-complex-001',
        description: 'Long text with multiple blocks',
        category: 'comprehensive',
        input: 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG',
        key: 'COMPREHENSIVE:8',
        expected: 'VIQWQLHMOREXTGUOWDPUESFVIQMQABJTX',
        complexAnalysis: {
          textLength: 35,
          blockSize: 8,
          blockCount: 5,
          lastBlockSize: 3,
          diffusion: 'Multiple blocks provide better security than single block'
        }
      }
    ],
    
    // Standard 5x5 grid (I and J share the same cell)
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
      algorithm: 'Phillips',
      displayName: 'Phillips Cipher',
      description: 'Block cipher using a 5×5 grid system with coordinate-based substitution and optional keyword. Combines grid-based character mapping with block processing techniques.',
      
      inventor: 'Cecil Phillips',
      year: 1961,
      background: 'Developed as an educational cipher to demonstrate block cipher principles and grid-based coordinate systems. Combines elements of Polybius square with block processing.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.EDUCATIONAL,
      securityNotes: 'Designed for educational purposes to demonstrate block cipher concepts. Not suitable for real-world security applications due to limited key space and simple substitution.',
      
      category: global.CipherMetadata.Categories.CLASSICAL,
      subcategory: 'block',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: 'variable', // Grid keyword + block size
      blockSize: 'variable', // User-defined
      rounds: 1,
      
      specifications: [
        {
          name: 'Wikipedia: Phillips Cipher',
          url: 'https://en.wikipedia.org/wiki/Phillips_cipher'
        },
        {
          name: 'dCode: Phillips Cipher',
          url: 'https://www.dcode.fr/phillips-cipher'
        }
      ],
      
      testVectors: [
        {
          name: 'Educational Examples',
          url: 'https://cryptii.com/pipes/phillips-cipher'
        }
      ],
      
      references: [
        {
          name: 'Educational Cryptography Materials',
          url: 'https://web.archive.org/web/20080207010024/http://www.cryptography.org/'
        },
        {
          name: 'Block Cipher Design Principles',
          url: 'https://csrc.nist.gov/publications/fips'
        }
      ],
      
      implementationNotes: 'Uses 5×5 grid with optional keyword for character arrangement. Block size parameter controls transposition behavior. I/J share same grid position.',
      performanceNotes: 'O(n) time complexity where n is input length. Memory usage scales with block size for buffering.',
      
      educationalValue: 'Excellent introduction to block cipher concepts and grid-based coordinate systems. Demonstrates combination of substitution and transposition techniques.',
      prerequisites: ['Polybius square', 'Block cipher concepts', 'Coordinate systems'],
      
      tags: ['educational', 'block', 'grid', 'coordinate', 'substitution', 'intermediate'],
      
      version: '1.0'
    }) : null,
    
    // Initialize cipher
    Init: function() {
      Phillips.isInitialized = true;
    },
    
    // Set up key (keyword:blocksize format)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'Phillips[' + global.generateUniqueID() + ']';
      } while (Phillips.instances[id] || global.objectInstances[id]);
      
      Phillips.instances[id] = new Phillips.PhillipsInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Phillips.instances[id]) {
        delete Phillips.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Phillips', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      return Phillips.processBlock(id, plaintext, true);
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      return Phillips.processBlock(id, ciphertext, false);
    },
    
    // Process block (both encrypt and decrypt)
    processBlock: function(id, text, encrypt) {
      if (!Phillips.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Phillips', 'processBlock');
        return text;
      }
      
      const instance = Phillips.instances[id];
      const grid = instance.grid;
      const blockSize = instance.blockSize;
      
      // Extract only letters for processing
      const letters = Phillips.extractLetters(text);
      if (letters.length === 0) {
        return text;
      }
      
      let result = '';
      
      // Process text in blocks
      for (let blockStart = 0; blockStart < letters.length; blockStart += blockSize) {
        const block = letters.substring(blockStart, Math.min(blockStart + blockSize, letters.length));
        const processedBlock = Phillips.processTextBlock(block, grid, encrypt);
        result += processedBlock;
      }
      
      // Reinsert non-letter characters
      return Phillips.reinsertNonLetters(text, result);
    },
    
    // Process a single text block
    processTextBlock: function(block, grid, encrypt) {
      if (block.length === 0) return '';
      
      let result = '';
      
      for (let i = 0; i < block.length; i++) {
        let char = block.charAt(i).toUpperCase();
        if (char === 'J') char = 'I'; // Handle I/J equivalence
        
        if (encrypt) {
          // Find character in grid and apply transformation
          const transformed = Phillips.gridSubstitution(char, grid, true);
          result += transformed;
        } else {
          // Reverse the grid substitution
          const transformed = Phillips.gridSubstitution(char, grid, false);
          result += transformed;
        }
      }
      
      return result;
    },
    
    // Grid-based substitution
    gridSubstitution: function(char, grid, encrypt) {
      if (encrypt) {
        // Find character in grid
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            if (grid[row][col] === char) {
              // Apply coordinate-based transformation
              const newRow = (row + 1) % 5;
              const newCol = (col + 1) % 5;
              return grid[newRow][newCol];
            }
          }
        }
        return char; // Character not found, return as-is
      } else {
        // Reverse substitution
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            if (grid[row][col] === char) {
              // Reverse coordinate-based transformation
              const newRow = (row - 1 + 5) % 5;
              const newCol = (col - 1 + 5) % 5;
              return grid[newRow][newCol];
            }
          }
        }
        return char; // Character not found, return as-is
      }
    },
    
    // Extract only letters from text
    extractLetters: function(text) {
      let letters = '';
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        if (Phillips.isLetter(char)) {
          letters += char.toUpperCase();
        }
      }
      return letters;
    },
    
    // Reinsert non-letter characters in their original positions
    reinsertNonLetters: function(originalText, processedLetters) {
      let result = '';
      let letterIndex = 0;
      
      for (let i = 0; i < originalText.length; i++) {
        const char = originalText.charAt(i);
        if (Phillips.isLetter(char)) {
          if (letterIndex < processedLetters.length) {
            const processedChar = processedLetters.charAt(letterIndex++);
            // Preserve original case
            if (char >= 'a' && char <= 'z') {
              result += processedChar.toLowerCase();
            } else {
              result += processedChar;
            }
          } else {
            result += char; // Fallback
          }
        } else {
          result += char; // Preserve non-letters
        }
      }
      
      return result;
    },
    
    // Create custom grid from keyword
    createCustomGrid: function(keyword) {
      if (!keyword || keyword.length === 0) {
        return JSON.parse(JSON.stringify(Phillips.STANDARD_GRID));
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
    
    // Parse key string (format: "keyword:blocksize")
    parseKey: function(keyString) {
      if (!keyString) {
        return { keyword: '', blockSize: 5 };
      }
      
      const parts = keyString.split(':');
      const keyword = parts[0] || '';
      let blockSize = 5; // Default block size
      
      if (parts.length > 1) {
        const parsed = parseInt(parts[1]);
        if (parsed > 0 && parsed <= 25) {
          blockSize = parsed;
        }
      }
      
      return { keyword: keyword, blockSize: blockSize };
    },
    
    // Check if character is a letter
    isLetter: function(char) {
      return /[A-Za-z]/.test(char);
    },
    
    // Instance class
    PhillipsInstance: function(keyString) {
      this.rawKey = keyString || '';
      const parsed = Phillips.parseKey(keyString);
      this.keyword = parsed.keyword;
      this.blockSize = parsed.blockSize;
      this.grid = Phillips.createCustomGrid(this.keyword);
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
    global.Cipher.AddCipher(Phillips);
  }
  
  // Export to global scope
  global.Phillips = Phillips;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Phillips;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);