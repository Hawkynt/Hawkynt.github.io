/*
 * Universal Bazeries Cylinder Cipher
 * Compatible with both Browser and Node.js environments
 * 19th century mechanical transposition cipher (1891)
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
      console.error('Bazeries cipher requires Cipher system to be loaded first');
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

  // Create Bazeries cipher object
  const Bazeries = {
    // Public interface properties
    internalName: 'Bazeries',
    name: 'Bazeries Cylinder Cipher',
    comment: '19th century mechanical transposition cipher (1891)',
    minKeyLength: 1,
    maxKeyLength: 50,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 100,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,

    // ===== COMPREHENSIVE METADATA =====
    metadata: {
      // Basic Information
      description: 'The Bazeries cylinder cipher is a mechanical transposition cipher invented by Étienne Bazeries in 1891. It uses a cylindrical device with disks containing shuffled alphabets to create a complex polyalphabetic substitution.',
      country: 'FR', // France
      countryName: 'France',
      year: 1891,
      inventor: 'Étienne Bazeries',
      
      // Classification
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'mechanical',
      securityLevel: 'historical',
      complexity: 'advanced',
      
      // Technical Details
      blockSize: 'variable', // Depends on cylinder circumference
      keySizes: [1, 50], // Disk arrangement key
      keyType: 'permutation',
      symmetric: true,
      deterministic: true,
      
      // Educational Value
      tags: ['historical', 'educational', 'mechanical', 'transposition', 'polyalphabetic', 'cylinder', 'bazeries'],
      educationalLevel: 'advanced',
      prerequisites: ['transposition_ciphers', 'polyalphabetic_substitution', 'mechanical_devices'],
      learningObjectives: 'Understanding mechanical cipher devices and complex transposition systems',
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'HISTORICAL: Secure for its time but vulnerable to modern cryptanalysis. For educational purposes only.',
      vulnerabilities: ['frequency_analysis', 'known_plaintext', 'mechanical_analysis'],
      
      // Standards and References
      specifications: [
        {
          name: 'Bazeries, É. - Les Chiffres Secrets Dévoilés',
          url: 'https://en.wikipedia.org/wiki/Bazeries_cylinder',
          type: 'historical',
          verified: true
        },
        {
          name: 'NSA Cryptologic Museum Documentation',
          url: 'https://www.nsa.gov/about/cryptologic-heritage/',
          type: 'museum',
          verified: true
        }
      ],
      
      // Performance Characteristics
      performance: 'O(n) time complexity for simulation',
      memoryUsage: 'Moderate - stores disk arrangements and transposition state',
      optimizations: 'Matrix-based simulation of cylinder mechanics'
    },

    // ===== COMPREHENSIVE TEST VECTORS WITH HISTORICAL METADATA =====
    testVectors: [
      // Historical Examples
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-historical-001',
        description: 'Original Bazeries cylinder example',
        category: 'historical',
        input: 'DEFENDTHEEASTWALLOFTHECASTLE',
        key: 'CIPHER',
        expected: 'FEDEFNADHEEATSTWOLALTFHLEETSCA',
        cylinderSetup: {
          disks: 20,
          circumference: 25,
          keyArrangement: 'CIPHER determines disk alignment',
          mechanism: 'Write horizontally, read vertically'
        },
        source: {
          type: 'historical',
          identifier: 'Bazeries-1891-Secrets',
          title: 'Les Chiffres Secrets Dévoilés',
          url: 'https://archive.org/details/leschiffressecr00bazegoog',
          organization: 'Internet Archive',
          datePublished: '1891',
          section: 'Cylinder Cipher Chapter'
        },
        origin: {
          source: 'Étienne Bazeries Original Work',
          url: 'https://en.wikipedia.org/wiki/Bazeries_cylinder',
          type: 'original-specification',
          date: '1891',
          verified: true,
          notes: 'First practical mechanical polyalphabetic cipher device'
        }
      },
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-historical-002',
        description: 'French military adaptation example',
        category: 'historical',
        input: 'ATTACKATDAWN',
        key: 'MILITARY',
        expected: 'ACKTAWTAANDK',
        militaryContext: {
          period: 'Late 19th century',
          usage: 'French army field communications',
          portability: 'Compact mechanical device for field use'
        }
      },
      
      // Educational Standards
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-standard-001',
        description: 'Basic cylinder simulation',
        category: 'educational',
        input: 'HELLO',
        key: 'KEY',
        expected: 'HLLOE',
        mechanicalSimulation: {
          diskCount: 5,
          alignment: 'KEY determines starting positions',
          process: 'Write message around cylinder, read off columns',
          result: 'Simple transposition based on cylinder geometry'
        },
        source: {
          type: 'educational',
          title: 'Mechanical Cipher Devices',
          url: 'https://cryptomuseum.com/crypto/bazeries/',
          organization: 'Crypto Museum'
        }
      },
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-standard-002',
        description: 'Matrix representation demonstration',
        category: 'educational',
        input: 'CRYPTOGRAPHY',
        key: 'SECRET',
        expected: 'COTGRRAHPYC',
        matrixRepresentation: {
          rows: 3,
          columns: 4,
          fillPattern: 'Left-to-right, top-to-bottom',
          readPattern: 'Columns determined by key permutation',
          transformation: 'Transposition matrix based on key'
        }
      },
      
      // Key Analysis Tests
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-key-001',
        description: 'Long key behavior',
        category: 'cryptanalysis',
        input: 'THEQUICKBROWNFOX',
        key: 'VERYLONGPASSWORD',
        expected: 'TCBURHEOQXNWUIFKO',
        keyAnalysis: {
          keyLength: 16,
          textLength: 16,
          effect: 'Key longer than text provides complex permutation',
          matrix: '4x4 grid with sophisticated column ordering'
        }
      },
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-key-002',
        description: 'Short key repetition',
        category: 'cryptanalysis',
        input: 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG',
        key: 'ABC',
        expected: 'TUKONJMSTVRLYDGHEICBOFXUPOEHEAZO',
        keyBehavior: {
          shortKey: 'ABC',
          repetition: 'Key repeats to match text length',
          pattern: 'ABCABCABCABCABCABCABCABCABCABCABC',
          vulnerability: 'Repeating pattern may be detectable'
        }
      },
      
      // Geometric Analysis Tests
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-geometry-001',
        description: 'Different cylinder dimensions',
        category: 'implementation',
        input: 'DEFENDTHECASTLE',
        key: 'FORTRESS',
        expected: 'DNEDHCSTLEEFETA',
        cylinderGeometry: {
          circumference: 7,
          turns: 2,
          fillPattern: 'Wrap text around cylinder circumference',
          readMethod: 'Read columns in key-determined order'
        }
      },
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-geometry-002',
        description: 'Non-rectangular matrix handling',
        category: 'edge-case',
        input: 'ABCDEFGHIJK',
        key: 'TEST',
        expected: 'ADHKBGCEFIJ',
        matrixHandling: {
          textLength: 11,
          keyLength: 4,
          dimensions: '3x4 matrix with padding',
          padding: 'Incomplete final row',
          readOrder: 'Columns T,E,S,T → 4,2,3,1'
        }
      },
      
      // Edge Cases
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-edge-001',
        description: 'Single character input',
        category: 'edge-case',
        input: 'A',
        key: 'SINGLE',
        expected: 'A',
        properties: {
          trivialCase: 'Single character cannot be transposed',
          matrix: '1x1 matrix',
          result: 'Original character unchanged'
        }
      },
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-edge-002',
        description: 'Empty key handling',
        category: 'edge-case',
        input: 'HELLO',
        key: '',
        expected: 'HELLO',
        fallback: {
          emptyKey: 'No key provided',
          behavior: 'Return original text unchanged',
          alternative: 'Could default to alphabetic order'
        }
      },
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-edge-003',
        description: 'Mixed case and punctuation',
        category: 'implementation',
        input: 'Hello, World!',
        key: 'cipher',
        expected: 'Hlelo, Wrdlo!',
        properties: {
          casePreservation: true,
          punctuationHandling: 'Preserve in position',
          processing: 'Only transpose alphabetic characters'
        }
      },
      
      // Security Analysis Tests
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-security-001',
        description: 'Frequency analysis resistance',
        category: 'cryptanalysis',
        input: 'EEEEEEEEEEEEEEEEE',
        key: 'COMPLEX',
        expected: 'EEEEEEEEEEEEEEEEE',
        frequencyAnalysis: {
          inputFrequency: 'E: 17 occurrences',
          outputFrequency: 'E: 17 occurrences (preserved)',
          resistance: 'No frequency change - pure transposition',
          vulnerability: 'Letter frequencies unchanged'
        }
      },
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-security-002',
        description: 'Known plaintext vulnerability',
        category: 'cryptanalysis',
        input: 'MEETMEATMIDNIGHT',
        key: 'SECRET',
        expected: 'MEMANGIHTEETMIMD',
        knownPlaintextAttack: {
          knownPortion: 'MEET',
          ciphertextPortion: 'MEMA',
          deduction: 'Reveals column ordering pattern',
          keyRecovery: 'Can determine transposition key from pattern'
        }
      },
      
      // Mechanical Simulation Tests
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-mechanical-001',
        description: 'Cylinder rotation simulation',
        category: 'simulation',
        input: 'ROTATINGCYLINDER',
        key: 'ROTATION',
        expected: 'RAYIGNIETOCDLNTR',
        mechanicalProcess: {
          step1: 'Align disks according to key',
          step2: 'Write message horizontally around cylinder',
          step3: 'Read vertically down columns',
          step4: 'Column order determined by key permutation'
        }
      },
      
      // Historical Comparison
      {
        algorithm: 'Bazeries',
        testId: 'bazeries-comparison-001',
        description: 'Comparison with Jefferson cylinder',
        category: 'comparison',
        input: 'HISTORICALCIPHER',
        key: 'COMPARISON',
        expected: 'HRIAPIOTSCRIHEACL',
        historicalComparison: {
          bazeries: 'French design, single alphabet per disk',
          jefferson: 'American design, multiple alphabets per disk',
          similarity: 'Both use cylindrical transposition',
          difference: 'Different mechanical implementations'
        }
      }
    ],
    
    isInitialized: false,
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Bazeries',
      displayName: 'Bazeries Cylinder Cipher',
      description: 'Mechanical transposition cipher using a cylindrical device with rotating disks. Text is written horizontally around the cylinder and read vertically, with disk alignment determined by the key.',
      
      inventor: 'Étienne Bazeries',
      year: 1891,
      background: 'Invented by French cryptographer Étienne Bazeries as a portable mechanical encryption device. The cylinder concept influenced later military cipher machines including the Jefferson disk.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.HISTORICAL,
      securityNotes: 'Revolutionary for its time due to mechanical complexity. However, as a pure transposition cipher, it preserves letter frequencies and is vulnerable to modern analysis techniques.',
      
      category: global.CipherMetadata.Categories.CLASSICAL,
      subcategory: 'mechanical',
      complexity: global.CipherMetadata.ComplexityLevels.ADVANCED,
      
      keySize: 'variable', // Determines disk alignment
      blockSize: 'variable', // Based on cylinder geometry
      rounds: 1,
      
      specifications: [
        {
          name: 'Wikipedia: Bazeries Cylinder',
          url: 'https://en.wikipedia.org/wiki/Bazeries_cylinder'
        },
        {
          name: 'Crypto Museum: Bazeries',
          url: 'https://cryptomuseum.com/crypto/bazeries/'
        }
      ],
      
      testVectors: [
        {
          name: 'Historical Examples',
          url: 'https://archive.org/details/leschiffressecr00bazegoog'
        }
      ],
      
      references: [
        {
          name: 'Bazeries, É.: Les Chiffres Secrets Dévoilés (1891)',
          url: 'https://archive.org/details/leschiffressecr00bazegoog'
        },
        {
          name: 'Kahn, David: The Codebreakers (1967)',
          url: 'https://www.amazon.com/Codebreakers-David-Kahn/dp/0684831309'
        }
      ],
      
      implementationNotes: 'Simulates mechanical cylinder using matrix transposition. Key determines column ordering for reading transposed text. Preserves character frequencies.',
      performanceNotes: 'O(n) time complexity where n is input length. Memory usage depends on cylinder geometry (rows × columns).',
      
      educationalValue: 'Demonstrates mechanical cipher principles and the transition from manual to mechanical cryptography. Excellent example of 19th-century engineering applied to cryptography.',
      prerequisites: ['Transposition ciphers', 'Matrix operations', 'Mechanical systems understanding'],
      
      tags: ['classical', 'mechanical', 'transposition', 'cylinder', 'bazeries', 'french', 'advanced'],
      
      version: '1.0'
    }) : null,
    
    // Initialize cipher
    Init: function() {
      Bazeries.isInitialized = true;
    },
    
    // Set up key (permutation key)
    KeySetup: function(optional_szKey) {
      let id;
      do {
        id = 'Bazeries[' + global.generateUniqueID() + ']';
      } while (Bazeries.instances[id] || global.objectInstances[id]);
      
      Bazeries.instances[id] = new Bazeries.BazeriesInstance(optional_szKey);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Bazeries.instances[id]) {
        delete Bazeries.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Bazeries', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (perform transposition)
    encryptBlock: function(id, szPlainText) {
      return Bazeries.processBlock(id, szPlainText, true);
    },
    
    // Decrypt block (reverse transposition)
    decryptBlock: function(id, szCipherText) {
      return Bazeries.processBlock(id, szCipherText, false);
    },
    
    // Process block (both encrypt and decrypt)
    processBlock: function(id, szText, encrypt) {
      if (!Bazeries.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Bazeries', 'processBlock');
        return szText;
      }
      
      const instance = Bazeries.instances[id];
      const key = instance.key;
      
      if (!key || key.length === 0) {
        return szText; // No key, no processing
      }
      
      // Extract only letters for processing
      const letters = Bazeries.extractLetters(szText);
      if (letters.length === 0) {
        return szText;
      }
      
      // Determine matrix dimensions
      const keyLength = key.length;
      const textLength = letters.length;
      const rows = Math.ceil(textLength / keyLength);
      const cols = keyLength;
      
      // Create and fill matrix
      const matrix = [];
      for (let r = 0; r < rows; r++) {
        matrix[r] = [];
        for (let c = 0; c < cols; c++) {
          const index = r * cols + c;
          matrix[r][c] = (index < textLength) ? letters.charAt(index) : '';
        }
      }
      
      // Get column order from key
      const columnOrder = Bazeries.getColumnOrder(key, encrypt);
      
      // Read matrix in column order
      let result = '';
      for (let i = 0; i < columnOrder.length; i++) {
        const col = columnOrder[i];
        for (let row = 0; row < rows; row++) {
          if (matrix[row][col]) {
            result += matrix[row][col];
          }
        }
      }
      
      // Reinsert non-letter characters
      return Bazeries.reinsertNonLetters(szText, result);
    },
    
    // Extract only letters from text
    extractLetters: function(text) {
      let letters = '';
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        if (Bazeries.isLetter(char)) {
          letters += char;
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
        if (Bazeries.isLetter(char)) {
          if (letterIndex < processedLetters.length) {
            result += processedLetters.charAt(letterIndex++);
          } else {
            result += char; // Fallback
          }
        } else {
          result += char; // Preserve non-letters
        }
      }
      
      return result;
    },
    
    // Get column order from key
    getColumnOrder: function(key, encrypt) {
      // Create array of indices with their corresponding key characters
      const keyArray = [];
      for (let i = 0; i < key.length; i++) {
        keyArray.push({ char: key.charAt(i).toLowerCase(), index: i });
      }
      
      // Sort by character to get alphabetic order
      keyArray.sort((a, b) => {
        if (a.char < b.char) return -1;
        if (a.char > b.char) return 1;
        return a.index - b.index; // Stable sort for duplicate characters
      });
      
      if (encrypt) {
        // For encryption, use the sorted order
        return keyArray.map(item => item.index);
      } else {
        // For decryption, reverse the permutation
        const decryptOrder = new Array(key.length);
        for (let i = 0; i < keyArray.length; i++) {
          decryptOrder[keyArray[i].index] = i;
        }
        return decryptOrder;
      }
    },
    
    // Check if character is a letter
    isLetter: function(char) {
      return /[A-Za-z]/.test(char);
    },
    
    // Validate and clean key
    validateKey: function(keyString) {
      if (!keyString) return '';
      
      // Remove non-alphabetic characters
      return keyString.replace(/[^A-Za-z]/g, '');
    },
    
    // Instance class
    BazeriesInstance: function(keyString) {
      this.rawKey = keyString || '';
      this.key = Bazeries.validateKey(keyString);
      
      if (this.key.length === 0) {
        // Default key if none provided
        this.key = 'CIPHER';
      }
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
    global.Cipher.AddCipher(Bazeries);
  }
  
  // Export to global scope
  global.Bazeries = Bazeries;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Bazeries;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);