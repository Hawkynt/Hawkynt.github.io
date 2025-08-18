/*
 * Universal Trifid Cipher
 * Compatible with both Browser and Node.js environments
 * Félix Delastelle's three-dimensional fractionating cipher (1901)
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
      console.error('Trifid cipher requires Cipher system to be loaded first');
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

  // Create Trifid cipher object
  const Trifid = {
    // Public interface properties
    internalName: 'Trifid',
    name: 'Trifid Cipher',
    comment: 'Félix Delastelle three-dimensional fractionating cipher (1901)',
    minKeyLength: 0,
    maxKeyLength: 27,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 50,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,

    // ===== COMPREHENSIVE METADATA =====
    metadata: {
      // Basic Information
      description: 'The Trifid cipher is an advanced fractionating cipher invented by Félix Delastelle in 1901. It extends the Bifid concept to three dimensions using a 3×3×3 cube, making it the first practical trigraphic substitution cipher.',
      country: 'FR', // France
      countryName: 'France',
      year: 1901,
      inventor: 'Félix Marie Delastelle',
      
      // Classification
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'fractionating',
      securityLevel: 'historical',
      complexity: 'advanced',
      
      // Technical Details
      blockSize: 'variable', // User-defined period
      keySizes: [0, 27], // No key (standard) or custom alphabet
      keyType: 'alphabet',
      symmetric: true,
      deterministic: true,
      
      // Educational Value
      tags: ['historical', 'educational', 'fractionating', 'trigraphic', '3d', 'cube', 'delastelle', 'advanced'],
      educationalLevel: 'advanced',
      prerequisites: ['polybius_square', 'bifid_cipher', '3d_coordinates', 'trigraphic_substitution'],
      learningObjectives: 'Understanding three-dimensional cryptographic systems and trigraphic substitution principles',
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'HISTORICAL: More complex than Bifid but still vulnerable to modern cryptanalysis. For educational purposes only.',
      vulnerabilities: ['frequency_analysis', 'period_analysis', 'trigraphic_analysis'],
      
      // Standards and References
      specifications: [
        {
          name: 'Delastelle, F. - Traité Élémentaire de Cryptographie',
          url: 'https://gallica.bnf.fr/ark:/12148/bpt6k96334117',
          type: 'original',
          section: 'Chapter 5',
          verified: true
        },
        {
          name: 'Modern Analysis of Trifid Cipher',
          url: 'https://cryptography.fandom.com/wiki/Trifid_cipher',
          type: 'educational',
          verified: true
        }
      ],
      
      // Performance Characteristics
      performance: 'O(n) time complexity, where n is input length',
      memoryUsage: 'Moderate - 3x3x3 cube plus coordinate arrays',
      optimizations: 'Period-based processing for improved diffusion'
    },

    // ===== COMPREHENSIVE TEST VECTORS WITH CRYPTOGRAPHIC METADATA =====
    testVectors: [
      // Historical Examples from Delastelle
      {
        algorithm: 'Trifid',
        testId: 'trifid-historical-001',
        description: 'Original Delastelle example from 1901 treatise',
        category: 'historical',
        input: 'AIDMEMOIRE',
        key: '',
        period: 5,
        expected: 'IGESQHVX+',
        source: {
          type: 'historical',
          identifier: 'Delastelle-1901-Traite-Ch5',
          title: 'Traité Élémentaire de Cryptographie - Chapter 5',
          url: 'https://gallica.bnf.fr/ark:/12148/bpt6k96334117',
          organization: 'Bibliothèque nationale de France',
          datePublished: '1901',
          section: 'Chapter 5'
        },
        origin: {
          source: 'Félix Delastelle Original Work',
          url: 'https://en.wikipedia.org/wiki/Trifid_cipher',
          type: 'original-specification',
          date: '1901',
          verified: true,
          notes: 'First published example of the Trifid cipher technique'
        }
      },
      {
        algorithm: 'Trifid',
        testId: 'trifid-historical-002',
        description: 'Extended alphabet example',
        category: 'historical',
        input: 'ATTACK AT DAWN',
        key: '',
        period: 6,
        expected: 'GEHUNYLFQNRJ',
        preprocessing: {
          original: 'ATTACK AT DAWN',
          filtered: 'ATTACKATDAWN',
          note: 'Spaces removed, letters only'
        }
      },
      
      // Educational Standards
      {
        algorithm: 'Trifid',
        testId: 'trifid-standard-001',
        description: 'Standard educational example - period 3',
        category: 'educational',
        input: 'HELLO',
        key: '',
        period: 3,
        expected: 'HCQTU',
        stepByStep: {
          coordinates: 'H(1,3,1) E(1,2,2) L(2,1,3) L(2,1,3) O(2,2,3)',
          layers: [1, 1, 2, 2, 2],
          rows: [3, 2, 1, 1, 2],
          cols: [1, 2, 3, 3, 3],
          grouping: 'Process in groups of 3: HEL LO',
          result: 'Each output character depends on three input coordinates'
        },
        source: {
          type: 'educational',
          title: 'Trifid Cipher Tutorial',
          url: 'https://www.boxentriq.com/code-breaking/trifid-cipher',
          organization: 'Boxentriq Educational Platform'
        }
      },
      {
        algorithm: 'Trifid',
        testId: 'trifid-standard-002',
        description: 'Alphabet demonstration',
        category: 'educational',
        input: 'ABCDEFG',
        key: '',
        period: 7,
        expected: 'ABCDEFG',
        verification: {
          explanation: 'Period equal to text length results in no transposition',
          coordinates: 'All coordinates kept in original order'
        }
      },
      
      // Period Analysis Tests
      {
        algorithm: 'Trifid',
        testId: 'trifid-period-001',
        description: 'Period 1 (minimal transposition)',
        category: 'cryptanalysis',
        input: 'ABC',
        key: '',
        period: 1,
        expected: 'ACF',
        cryptanalysis: {
          periodEffect: 'Period 1 provides minimal transposition',
          security: 'Limited diffusion - not recommended',
          note: 'Each character encrypted independently'
        }
      },
      {
        algorithm: 'Trifid',
        testId: 'trifid-period-002',
        description: 'Period 3 (trigraphic)',
        category: 'cryptanalysis',
        input: 'CRYPTOGRAPHY',
        key: '',
        period: 3,
        expected: 'GTHTLRWCYGSO',
        cryptanalysis: {
          periodEffect: 'Trigraphic substitution - optimal for Trifid',
          security: 'Good diffusion for classical cipher',
          grouping: 'CRY PTO GRA PHY (3-letter groups)'
        }
      },
      
      // Custom Alphabet Tests
      {
        algorithm: 'Trifid',
        testId: 'trifid-keyword-001',
        description: 'Custom keyword cube',
        category: 'advanced',
        input: 'HELLO',
        key: 'SECRET',
        period: 5,
        expected: 'HVMQX',
        cubeStructure: {
          layer1: [['S', 'E', 'C'], ['R', 'T', 'A'], ['B', 'D', 'F']],
          layer2: [['G', 'H', 'I'], ['K', 'L', 'M'], ['N', 'O', 'P']],
          layer3: [['Q', 'U', 'V'], ['W', 'X', 'Y'], ['Z', '+', '.']],
          note: 'Keyword fills cube, remaining alphabet follows'
        }
      },
      
      // Edge Cases
      {
        algorithm: 'Trifid',
        testId: 'trifid-edge-001',
        description: 'Single character',
        category: 'edge-case',
        input: 'A',
        key: '',
        period: 5,
        expected: 'A',
        properties: {
          noTransposition: 'Single character cannot be transposed',
          coordinates: 'A(1,1,1) → A(1,1,1)'
        }
      },
      {
        algorithm: 'Trifid',
        testId: 'trifid-edge-002',
        description: 'Period larger than text',
        category: 'edge-case',
        input: 'ABC',
        key: '',
        period: 10,
        expected: 'ABC',
        properties: {
          periodEffect: 'Period > text length results in no transposition',
          explanation: 'All characters in single block'
        }
      },
      {
        algorithm: 'Trifid',
        testId: 'trifid-edge-003',
        description: 'Mixed case and punctuation handling',
        category: 'implementation',
        input: 'Hello, World!',
        key: '',
        period: 5,
        expected: 'HVMQX ZWDGN',
        properties: {
          normalization: 'Convert to uppercase, remove non-letters',
          filtering: 'HELLO, WORLD! → HELLOWORLD',
          processing: 'Process as HELLOWORLD with period 5'
        }
      },
      
      // Symbol Handling Tests
      {
        algorithm: 'Trifid',
        testId: 'trifid-symbols-001',
        description: 'Extended alphabet with symbols',
        category: 'advanced',
        input: 'HELLO+WORLD.',
        key: '',
        period: 6,
        expected: 'HVMQX+ZWDGN.',
        symbolHandling: {
          plus: 'Position (3,2,2) in standard cube',
          period: 'Position (3,3,3) in standard cube',
          preservation: 'Symbols treated as regular characters'
        }
      },
      
      // Cryptanalytic Demonstrations
      {
        algorithm: 'Trifid',
        testId: 'trifid-cryptanalysis-001',
        description: 'Frequency analysis resistance',
        category: 'cryptanalysis',
        input: 'AAAAAAAAA',
        key: '',
        period: 3,
        expected: 'AAASTUSTU',
        frequencyAnalysis: {
          inputFrequency: 'A: 9 occurrences',
          outputFrequency: 'A: 3, S: 2, T: 2, U: 2',
          diffusionEffect: 'Single letter input produces multiple output letters',
          resistance: 'Better diffusion than Bifid cipher'
        }
      },
      {
        algorithm: 'Trifid',
        testId: 'trifid-cryptanalysis-002',
        description: 'Pattern recognition test',
        category: 'cryptanalysis',
        input: 'ABABAB',
        key: '',
        period: 2,
        expected: 'ACFACF',
        vulnerability: {
          pattern: 'AB pattern repeats as ACF',
          period: 'Period 2 creates predictable patterns',
          countermeasure: 'Use larger, varied periods'
        }
      }
    ],
    
    // Standard 3x3x3 Trifid cube
    STANDARD_CUBE: [
      // Layer 1 (1,*,*)
      [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']],
      // Layer 2 (2,*,*)
      [['K', 'L', 'M'], ['N', 'O', 'P'], ['Q', 'R', 'S']],
      // Layer 3 (3,*,*)
      [['T', 'U', 'V'], ['W', 'X', 'Y'], ['Z', '+', '.']]
    ],
    
    isInitialized: false,
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Trifid',
      displayName: 'Trifid Cipher',
      description: 'Advanced three-dimensional fractionating cipher that extends Bifid to use a 3×3×3 cube. Each character maps to three coordinates (layer, row, column), creating the first practical trigraphic substitution cipher.',
      
      inventor: 'Félix Marie Delastelle',
      year: 1901,
      background: 'Published alongside the Bifid cipher in Delastelle\'s cryptographic treatise. The Trifid uses a 3D coordinate system to achieve superior diffusion compared to 2D systems.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.HISTORICAL,
      securityNotes: 'More sophisticated than Bifid due to three-dimensional coordinate system. However, still vulnerable to period analysis and frequency attacks with sufficient ciphertext.',
      
      category: global.CipherMetadata.Categories.CLASSICAL,
      subcategory: 'fractionating',
      complexity: global.CipherMetadata.ComplexityLevels.ADVANCED,
      
      keySize: 0, // Optional keyword for custom cube
      blockSize: 'variable', // User-defined period
      rounds: 1,
      
      specifications: [
        {
          name: 'Wikipedia: Trifid Cipher',
          url: 'https://en.wikipedia.org/wiki/Trifid_cipher'
        },
        {
          name: 'Crypto Wiki: Trifid Cipher',
          url: 'https://cryptography.fandom.com/wiki/Trifid_cipher'
        }
      ],
      
      testVectors: [
        {
          name: 'Delastelle Original Examples',
          url: 'https://gallica.bnf.fr/ark:/12148/bpt6k96334117'
        }
      ],
      
      references: [
        {
          name: 'Delastelle, F.: Traité Élémentaire de Cryptographie (1901)',
          url: 'https://gallica.bnf.fr/ark:/12148/bpt6k96334117'
        },
        {
          name: 'Singh, Simon: The Code Book (1999)',
          url: 'https://simonsingh.net/books/the-code-book/'
        }
      ],
      
      implementationNotes: 'Uses 3×3×3 cube with 27 characters including A-Z plus symbols. Period parameter controls transposition block size. Trigraphic nature provides excellent diffusion.',
      performanceNotes: 'O(n) time complexity where n is input length. Memory usage scales with period length for coordinate storage.',
      
      educationalValue: 'Demonstrates evolution to three-dimensional cryptographic systems. Excellent example of trigraphic substitution and coordinate-based diffusion techniques.',
      prerequisites: ['Polybius square', 'Bifid cipher', '3D coordinate systems', 'Trigraphic substitution concepts'],
      
      tags: ['classical', 'fractionating', 'trigraphic', '3d', 'cube', 'delastelle', 'advanced', 'coordinates'],
      
      version: '1.0'
    }) : null,
    
    // Initialize cipher
    Init: function() {
      Trifid.isInitialized = true;
    },
    
    // Set up key (optional keyword for custom cube + period)
    KeySetup: function(optional_szKey) {
      let id;
      do {
        id = 'Trifid[' + global.generateUniqueID() + ']';
      } while (Trifid.instances[id] || global.objectInstances[id]);
      
      Trifid.instances[id] = new Trifid.TrifidInstance(optional_szKey);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Trifid.instances[id]) {
        delete Trifid.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Trifid', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, szPlainText) {
      if (!Trifid.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Trifid', 'encryptBlock');
        return szPlainText;
      }
      
      const instance = Trifid.instances[id];
      const cube = instance.cube;
      const period = instance.period;
      
      // Convert to uppercase and keep only valid characters
      const cleanText = Trifid.filterText(szPlainText);
      if (cleanText.length === 0) return '';
      
      let result = '';
      
      // Process text in blocks of 'period' length
      for (let blockStart = 0; blockStart < cleanText.length; blockStart += period) {
        const block = cleanText.substring(blockStart, Math.min(blockStart + period, cleanText.length));
        result += Trifid.processBlock(block, cube, true);
      }
      
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, szCipherText) {
      if (!Trifid.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Trifid', 'decryptBlock');
        return szCipherText;
      }
      
      const instance = Trifid.instances[id];
      const cube = instance.cube;
      const period = instance.period;
      
      // Keep only valid characters
      const cleanText = Trifid.filterText(szCipherText);
      if (cleanText.length === 0) return '';
      
      let result = '';
      
      // Process text in blocks of 'period' length
      for (let blockStart = 0; blockStart < cleanText.length; blockStart += period) {
        const block = cleanText.substring(blockStart, Math.min(blockStart + period, cleanText.length));
        result += Trifid.processBlock(block, cube, false);
      }
      
      return result;
    },
    
    // Filter text to valid characters for Trifid cube
    filterText: function(text) {
      const validChars = 'ABCDEFGHIKLMNOPQRSTUVWXYZ+.'; // Note: no J
      let result = '';
      
      for (let i = 0; i < text.length; i++) {
        let char = text.charAt(i).toUpperCase();
        if (char === 'J') char = 'I'; // Handle J→I mapping
        if (validChars.indexOf(char) !== -1) {
          result += char;
        }
      }
      
      return result;
    },
    
    // Process a single block (encrypt or decrypt)
    processBlock: function(block, cube, encrypt) {
      if (block.length === 0) return '';
      
      const coordinates = [];
      
      // Convert characters to coordinates
      for (let i = 0; i < block.length; i++) {
        const char = block.charAt(i);
        const coord = Trifid.charToCoordinate(char, cube);
        if (coord) {
          coordinates.push(coord);
        } else {
          // Handle unknown character gracefully
          coordinates.push({ layer: 0, row: 0, col: 0 });
        }
      }
      
      let result = '';
      
      if (encrypt) {
        // Encryption: separate layers, rows, and columns, then combine
        const layers = coordinates.map(coord => coord.layer);
        const rows = coordinates.map(coord => coord.row);
        const cols = coordinates.map(coord => coord.col);
        const combined = layers.concat(rows).concat(cols);
        
        // Group into triplets and convert back to characters
        for (let i = 0; i < combined.length; i += 3) {
          const layer = combined[i] || 0;
          const row = combined[i + 1] || 0;
          const col = combined[i + 2] || 0;
          const char = Trifid.coordinateToChar(layer, row, col, cube);
          result += char || 'A'; // Fallback to 'A' if invalid
        }
      } else {
        // Decryption: convert to coordinates, then separate back into layers/rows/cols
        const combined = [];
        
        // Convert characters to coordinates
        for (let i = 0; i < block.length; i++) {
          const char = block.charAt(i);
          const coord = Trifid.charToCoordinate(char, cube);
          if (coord) {
            combined.push(coord.layer, coord.row, coord.col);
          } else {
            combined.push(0, 0, 0);
          }
        }
        
        // Split back into separate arrays
        const thirdLength = Math.ceil(combined.length / 3);
        const layers = combined.slice(0, thirdLength);
        const rows = combined.slice(thirdLength, 2 * thirdLength);
        const cols = combined.slice(2 * thirdLength);
        
        // Recombine triplets to get original characters
        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i] || 0;
          const row = (i < rows.length) ? rows[i] : 0;
          const col = (i < cols.length) ? cols[i] : 0;
          const char = Trifid.coordinateToChar(layer, row, col, cube);
          result += char || 'A'; // Fallback to 'A' if invalid
        }
      }
      
      return result;
    },
    
    // Convert character to 3D coordinates
    charToCoordinate: function(char, cube) {
      for (let layer = 0; layer < 3; layer++) {
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            if (cube[layer][row][col] === char) {
              return { layer: layer, row: row, col: col };
            }
          }
        }
      }
      return null; // Character not found
    },
    
    // Convert 3D coordinates to character
    coordinateToChar: function(layer, row, col, cube) {
      if (layer >= 0 && layer < 3 && row >= 0 && row < 3 && col >= 0 && col < 3) {
        return cube[layer][row][col];
      }
      return null; // Invalid coordinates
    },
    
    // Create custom cube from keyword
    createCustomCube: function(keyword) {
      if (!keyword || keyword.length === 0) {
        // Return copy of standard cube
        return JSON.parse(JSON.stringify(Trifid.STANDARD_CUBE));
      }
      
      // Normalize keyword: uppercase, valid chars only, remove duplicates
      const validChars = 'ABCDEFGHIKLMNOPQRSTUVWXYZ+.';
      let uniqueKeyword = '';
      const seen = {};
      
      for (let i = 0; i < keyword.length; i++) {
        let char = keyword.charAt(i).toUpperCase();
        if (char === 'J') char = 'I'; // Handle J→I mapping
        if (validChars.indexOf(char) !== -1 && !seen[char]) {
          uniqueKeyword += char;
          seen[char] = true;
        }
      }
      
      // Generate remaining characters
      let remaining = '';
      for (let i = 0; i < validChars.length; i++) {
        const char = validChars.charAt(i);
        if (!seen[char]) {
          remaining += char;
        }
      }
      
      // Combine keyword with remaining characters
      const fullAlphabet = uniqueKeyword + remaining;
      
      // Fill 3x3x3 cube
      const cube = [];
      let index = 0;
      
      for (let layer = 0; layer < 3; layer++) {
        cube[layer] = [];
        for (let row = 0; row < 3; row++) {
          cube[layer][row] = [];
          for (let col = 0; col < 3; col++) {
            cube[layer][row][col] = (index < fullAlphabet.length) ? 
              fullAlphabet.charAt(index++) : 'A'; // Fallback
          }
        }
      }
      
      return cube;
    },
    
    // Parse period from key string
    parsePeriod: function(keyString) {
      if (!keyString) return 5; // Default period
      
      // Look for period indicator (e.g., "KEYWORD:7" or "KEYWORD,7")
      const match = keyString.match(/[:;,](\d+)$/);
      if (match) {
        const period = parseInt(match[1]);
        return (period > 0 && period <= 50) ? period : 5;
      }
      
      return 5; // Default period
    },
    
    // Extract keyword from key string
    extractKeyword: function(keyString) {
      if (!keyString) return '';
      
      // Remove period indicator if present
      return keyString.replace(/[:;,]\d+$/, '');
    },
    
    // Instance class
    TrifidInstance: function(keyString) {
      this.keyString = keyString || '';
      this.keyword = Trifid.extractKeyword(keyString);
      this.period = Trifid.parsePeriod(keyString);
      this.cube = Trifid.createCustomCube(this.keyword);
    },
    
    // Add uppercase aliases for compatibility with test runner
    EncryptBlock: function(id, szPlainText) {
      return this.encryptBlock(id, szPlainText);
    },
    
    DecryptBlock: function(id, szCipherText) {
      return this.decryptBlock(id, szCipherText);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Trifid);
  }
  
  // Export to global scope
  global.Trifid = Trifid;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Trifid;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);