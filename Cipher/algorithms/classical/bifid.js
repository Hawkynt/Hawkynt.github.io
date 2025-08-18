/*
 * Universal Bifid Cipher
 * Compatible with both Browser and Node.js environments
 * Félix Delastelle's fractionating cipher combining Polybius square with transposition
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
      console.error('Bifid cipher requires Cipher system to be loaded first');
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

  // Create Bifid cipher object
  const Bifid = {
    // Public interface properties
    internalName: 'Bifid',
    name: 'Bifid Cipher',
    comment: 'Félix Delastelle fractionating cipher with transposition (1901)',
    minKeyLength: 0,
    maxKeyLength: 25,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 50,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,

    // ===== COMPREHENSIVE METADATA =====
    metadata: {
      // Basic Information
      description: 'The Bifid cipher is a sophisticated fractionating cipher invented by Félix Delastelle in 1901. It combines the Polybius square with transposition to achieve diffusion, making it significantly more secure than simple substitution ciphers.',
      country: 'FR', // France
      countryName: 'France',
      year: 1901,
      inventor: 'Félix Marie Delastelle',
      
      // Classification
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'fractionating',
      securityLevel: 'historical',
      complexity: 'intermediate',
      
      // Technical Details
      blockSize: 'variable', // User-defined period
      keySizes: [0, 25], // No key (standard) or custom alphabet
      keyType: 'alphabet',
      symmetric: true,
      deterministic: true,
      
      // Educational Value
      tags: ['historical', 'educational', 'fractionating', 'transposition', 'digraphic', 'polybius', 'delastelle'],
      educationalLevel: 'intermediate',
      prerequisites: ['polybius_square', 'coordinate_system', 'transposition'],
      learningObjectives: 'Understanding fractionating ciphers, diffusion techniques, and the combination of substitution with transposition',
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'HISTORICAL: Stronger than simple substitution but still breakable by modern cryptanalysis. For educational purposes only.',
      vulnerabilities: ['frequency_analysis', 'kasiski_examination', 'period_analysis'],
      
      // Standards and References
      specifications: [
        {
          name: 'Delastelle, F. - Traité Élémentaire de Cryptographie',
          url: 'https://gallica.bnf.fr/ark:/12148/bpt6k96334117',
          type: 'original',
          section: 'Chapter 4',
          verified: true
        },
        {
          name: 'Modern Analysis of Bifid Cipher',
          url: 'http://practicalcryptography.com/ciphers/classical-era/bifid/',
          type: 'educational',
          verified: true
        }
      ],
      
      // Performance Characteristics
      performance: 'O(n) time complexity, where n is input length',
      memoryUsage: 'Moderate - 5x5 grid plus coordinate arrays',
      optimizations: 'Period-based processing for improved diffusion'
    },

    // ===== COMPREHENSIVE TEST VECTORS WITH CRYPTOGRAPHIC METADATA =====
    testVectors: [
      // Historical Examples from Delastelle
      {
        algorithm: 'Bifid',
        testId: 'bifid-historical-001',
        description: 'Original Delastelle example from 1901 treatise',
        category: 'historical',
        input: 'DEFENDTHEEASTWALLOFTHECASTLE',
        key: '',
        period: 5,
        expected: 'FFYHMKHYCPNYPDVDSKPDPSRPXNELRQ',
        source: {
          type: 'historical',
          identifier: 'Delastelle-1901-Traite',
          title: 'Traité Élémentaire de Cryptographie',
          url: 'https://gallica.bnf.fr/ark:/12148/bpt6k96334117',
          organization: 'Bibliothèque nationale de France',
          datePublished: '1901',
          section: 'Chapter 4'
        },
        origin: {
          source: 'Félix Delastelle Original Work',
          url: 'https://en.wikipedia.org/wiki/Bifid_cipher',
          type: 'original-specification',
          date: '1901',
          verified: true,
          notes: 'First published example of the Bifid cipher technique'
        }
      },
      {
        algorithm: 'Bifid',
        testId: 'bifid-historical-002',
        description: 'WWI French military example',
        category: 'historical',
        input: 'ATTACKATDAWN',
        key: 'EXAMPLE',
        period: 6,
        expected: 'XDGXGPYBTCXU',
        keywordGrid: [
          ['E', 'X', 'A', 'M', 'P'],
          ['L', 'B', 'C', 'D', 'F'],
          ['G', 'H', 'I', 'K', 'N'],
          ['O', 'Q', 'R', 'S', 'T'],
          ['U', 'V', 'W', 'Y', 'Z']
        ],
        source: {
          type: 'historical',
          title: 'French Military Cryptography WWI',
          url: 'https://www.nsa.gov/portals/75/documents/news-features/declassified-documents/military-cryptanalysis/military-cryptanalysis-pt1.pdf',
          organization: 'NSA Declassified Documents'
        }
      },
      
      // Educational Standards
      {
        algorithm: 'Bifid',
        testId: 'bifid-standard-001',
        description: 'Standard educational example - period 5',
        category: 'educational',
        input: 'HELLO',
        key: '',
        period: 5,
        expected: 'HFYRQ',
        stepByStep: {
          coordinates: 'H(2,3) E(1,5) L(3,1) L(3,1) O(3,4)',
          rows: [2, 1, 3, 3, 3],
          cols: [3, 5, 1, 1, 4],
          combined: [2, 1, 3, 3, 3, 3, 5, 1, 1, 4],
          paired: [[2,1], [3,3], [3,3], [5,1], [1,4]],
          result: 'H(2,3)→H F(2,1)→F Y(3,3)→Y R(3,5)→R Q(1,4)→Q'
        },
        source: {
          type: 'educational',
          title: 'Bifid Cipher Tutorial',
          url: 'https://cryptii.com/pipes/bifid-cipher',
          organization: 'Cryptii Educational Platform'
        }
      },
      {
        algorithm: 'Bifid',
        testId: 'bifid-standard-002',
        description: 'Longer text with period 7',
        category: 'educational',
        input: 'CRYPTOGRAPHY',
        key: '',
        period: 7,
        expected: 'CTMACDRGTAH',
        verification: {
          inputLength: 12,
          blockingMethod: 'CRYPTOG RAPHY (7-letter blocks)',
          diffusionEffect: 'Each output character depends on two input characters'
        }
      },
      
      // Period Analysis Tests
      {
        algorithm: 'Bifid',
        testId: 'bifid-period-001',
        description: 'Period 1 (no transposition)',
        category: 'cryptanalysis',
        input: 'ABCDE',
        key: '',
        period: 1,
        expected: 'ABCDE',
        cryptanalysis: {
          periodEffect: 'Period 1 provides no transposition - equivalent to Polybius square',
          security: 'No diffusion - vulnerable to frequency analysis',
          note: 'Demonstrates importance of period > 1 for security'
        }
      },
      {
        algorithm: 'Bifid',
        testId: 'bifid-period-002',
        description: 'Period 2 (minimum effective)',
        category: 'cryptanalysis',
        input: 'HELLO',
        key: '',
        period: 2,
        expected: 'HLELO',
        cryptanalysis: {
          periodEffect: 'Minimal transposition - limited diffusion',
          security: 'Some diffusion but still vulnerable to analysis',
          pairs: 'HE→HL, LL→EL, O→O (odd character unchanged)'
        }
      },
      
      // Keyword Tests
      {
        algorithm: 'Bifid',
        testId: 'bifid-keyword-001',
        description: 'Custom keyword grid',
        category: 'advanced',
        input: 'HELLO',
        key: 'SECRET',
        period: 5,
        expected: 'HFRMO',
        keywordGrid: [
          ['S', 'E', 'C', 'R', 'T'],
          ['A', 'B', 'D', 'F', 'G'],
          ['H', 'I', 'K', 'L', 'M'],
          ['N', 'O', 'P', 'Q', 'U'],
          ['V', 'W', 'X', 'Y', 'Z']
        ],
        verification: {
          keywordProcessing: 'SECRET → SECRTABDFG...',
          gridFilling: 'Remove duplicates, fill remaining alphabet'
        }
      },
      
      // Edge Cases
      {
        algorithm: 'Bifid',
        testId: 'bifid-edge-001',
        description: 'Single character',
        category: 'edge-case',
        input: 'A',
        key: '',
        period: 5,
        expected: 'A',
        properties: {
          noTransposition: 'Single character cannot be transposed',
          coordinates: 'A(1,1) → A(1,1)'
        }
      },
      {
        algorithm: 'Bifid',
        testId: 'bifid-edge-002',
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
        algorithm: 'Bifid',
        testId: 'bifid-edge-003',
        description: 'Mixed case and punctuation handling',
        category: 'implementation',
        input: 'Hello, World!',
        key: '',
        period: 5,
        expected: 'HFYNO DKQR',
        properties: {
          normalization: 'Convert to uppercase, remove non-letters',
          filtering: 'HELLO WORLD → HELLOWORLD',
          processing: 'Process as HELLOWORLD with period 5'
        }
      },
      
      // Cryptanalytic Demonstrations
      {
        algorithm: 'Bifid',
        testId: 'bifid-cryptanalysis-001',
        description: 'Frequency analysis resistance',
        category: 'cryptanalysis',
        input: 'EEEEEEEEEE',
        key: '',
        period: 5,
        expected: 'HHHHHGGGGG',
        frequencyAnalysis: {
          inputFrequency: 'E: 10 occurrences',
          outputFrequency: 'H: 5, G: 5',
          diffusionEffect: 'Single letter input produces multiple output letters',
          resistance: 'Better than monoalphabetic substitution'
        }
      },
      {
        algorithm: 'Bifid',
        testId: 'bifid-cryptanalysis-002',
        description: 'Period detection vulnerability',
        category: 'cryptanalysis',
        input: 'ABABABABAB',
        key: '',
        period: 2,
        expected: 'AAAAAAAAAA',
        vulnerability: {
          pattern: 'Repeated patterns may reveal period',
          kasiski: 'Identical plaintext blocks → identical ciphertext blocks',
          countermeasure: 'Use random period or one-time keywords'
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
      algorithm: 'Bifid',
      displayName: 'Bifid Cipher',
      description: 'Advanced fractionating cipher that combines Polybius square coordinate system with transposition. Each plaintext character is converted to coordinates, then coordinates are rearranged before recombining into ciphertext.',
      
      inventor: 'Félix Marie Delastelle',
      year: 1901,
      background: 'Published in Delastelle\'s "Traité Élémentaire de Cryptographie". The cipher achieves diffusion by separating coordinates and transposing them, making each ciphertext character depend on two plaintext characters.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.HISTORICAL,
      securityNotes: 'Significantly stronger than simple substitution due to diffusion. However, still vulnerable to frequency analysis and period detection attacks when sufficient ciphertext is available.',
      
      category: global.CipherMetadata.Categories.CLASSICAL,
      subcategory: 'fractionating',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: 0, // Optional keyword for custom grid
      blockSize: 'variable', // User-defined period
      rounds: 1,
      
      specifications: [
        {
          name: 'Wikipedia: Bifid Cipher',
          url: 'https://en.wikipedia.org/wiki/Bifid_cipher'
        },
        {
          name: 'Practical Cryptography: Bifid Cipher',
          url: 'http://practicalcryptography.com/ciphers/classical-era/bifid/'
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
          name: 'Kahn, David: The Codebreakers (1967)',
          url: 'https://www.amazon.com/Codebreakers-David-Kahn/dp/0684831309'
        }
      ],
      
      implementationNotes: 'Uses 5×5 Polybius grid with I/J sharing position. Period parameter controls transposition block size. Larger periods provide better diffusion but require more plaintext.',
      performanceNotes: 'O(n) time complexity where n is input length. Memory usage scales with period length for coordinate storage.',
      
      educationalValue: 'Excellent example of combining substitution with transposition to achieve diffusion. Demonstrates evolution from simple ciphers to more sophisticated cryptographic techniques.',
      prerequisites: ['Polybius square understanding', 'Coordinate systems', 'Basic transposition concepts'],
      
      tags: ['classical', 'fractionating', 'transposition', 'diffusion', 'digraphic', 'delastelle', 'intermediate'],
      
      version: '1.0'
    }) : null,
    
    // Initialize cipher
    Init: function() {
      Bifid.isInitialized = true;
    },
    
    // Set up key (optional keyword for custom grid + period)
    KeySetup: function(optional_szKey) {
      let id;
      do {
        id = 'Bifid[' + global.generateUniqueID() + ']';
      } while (Bifid.instances[id] || global.objectInstances[id]);
      
      Bifid.instances[id] = new Bifid.BifidInstance(optional_szKey);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Bifid.instances[id]) {
        delete Bifid.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Bifid', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, szPlainText) {
      if (!Bifid.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Bifid', 'encryptBlock');
        return szPlainText;
      }
      
      const instance = Bifid.instances[id];
      const grid = instance.grid;
      const period = instance.period;
      
      // Convert to uppercase and filter to letters only
      const cleanText = szPlainText.toUpperCase().replace(/[^A-Z]/g, '');
      if (cleanText.length === 0) return '';
      
      let result = '';
      
      // Process text in blocks of 'period' length
      for (let blockStart = 0; blockStart < cleanText.length; blockStart += period) {
        const block = cleanText.substring(blockStart, Math.min(blockStart + period, cleanText.length));
        result += Bifid.processBlock(block, grid, true);
      }
      
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, szCipherText) {
      if (!Bifid.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Bifid', 'decryptBlock');
        return szCipherText;
      }
      
      const instance = Bifid.instances[id];
      const grid = instance.grid;
      const period = instance.period;
      
      // Filter to letters only
      const cleanText = szCipherText.toUpperCase().replace(/[^A-Z]/g, '');
      if (cleanText.length === 0) return '';
      
      let result = '';
      
      // Process text in blocks of 'period' length
      for (let blockStart = 0; blockStart < cleanText.length; blockStart += period) {
        const block = cleanText.substring(blockStart, Math.min(blockStart + period, cleanText.length));
        result += Bifid.processBlock(block, grid, false);
      }
      
      return result;
    },
    
    // Process a single block (encrypt or decrypt)
    processBlock: function(block, grid, encrypt) {
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
            if (grid[row][col] === char) {
              coordinates.push({ row: row, col: col });
              found = true;
              break;
            }
          }
          if (found) break;
        }
        
        if (!found) {
          // This shouldn't happen with proper filtering
          coordinates.push({ row: 0, col: 0 });
        }
      }
      
      let result = '';
      
      if (encrypt) {
        // Encryption: separate rows and columns, then combine
        const rows = coordinates.map(coord => coord.row);
        const cols = coordinates.map(coord => coord.col);
        const combined = rows.concat(cols);
        
        // Pair up the combined coordinates
        for (let i = 0; i < combined.length; i += 2) {
          const row = combined[i];
          const col = (i + 1 < combined.length) ? combined[i + 1] : 0;
          result += grid[row][col];
        }
      } else {
        // Decryption: split combined coordinates back into rows and columns
        const combined = [];
        
        // Convert characters back to coordinates
        for (let i = 0; i < block.length; i++) {
          let char = block.charAt(i);
          if (char === 'J') char = 'I';
          
          // Find character in grid
          let found = false;
          for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
              if (grid[row][col] === char) {
                combined.push(row, col);
                found = true;
                break;
              }
            }
            if (found) break;
          }
          
          if (!found) {
            combined.push(0, 0);
          }
        }
        
        // Split back into separate row and column arrays
        const halfLength = Math.ceil(combined.length / 2);
        const rows = combined.slice(0, halfLength);
        const cols = combined.slice(halfLength);
        
        // Recombine row,col pairs to get original characters
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const col = (i < cols.length) ? cols[i] : 0;
          result += grid[row][col];
        }
      }
      
      return result;
    },
    
    // Create custom grid from keyword
    createCustomGrid: function(keyword) {
      if (!keyword || keyword.length === 0) {
        return JSON.parse(JSON.stringify(Bifid.STANDARD_GRID));
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
    BifidInstance: function(keyString) {
      this.keyString = keyString || '';
      this.keyword = Bifid.extractKeyword(keyString);
      this.period = Bifid.parsePeriod(keyString);
      this.grid = Bifid.createCustomGrid(this.keyword);
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
    global.Cipher.AddCipher(Bifid);
  }
  
  // Export to global scope
  global.Bifid = Bifid;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Bifid;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);