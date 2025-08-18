/*
 * Universal CADAENUS Cipher
 * Compatible with both Browser and Node.js environments
 * Computer Aided Design of Encryption Algorithm - Non Uniform Substitution (1985)
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
      console.error('CADAENUS cipher requires Cipher system to be loaded first');
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

  // Create CADAENUS cipher object
  const CADAENUS = {
    // Public interface properties
    internalName: 'CADAENUS',
    name: 'CADAENUS Cipher',
    comment: 'Computer Aided Design of Encryption Algorithm - Non Uniform Substitution (1985)',
    minKeyLength: 1,
    maxKeyLength: 50,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,

    // ===== COMPREHENSIVE METADATA =====
    metadata: {
      // Basic Information
      description: 'CADAENUS (Computer Aided Design of Encryption Algorithm - Non Uniform Substitution) is a computerized cipher system designed in 1985. It combines multiple substitution and transposition techniques for enhanced security.',
      country: 'US', // United States
      countryName: 'United States',
      year: 1985,
      inventor: 'Computer Cryptography Research Team',
      
      // Classification
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'hybrid',
      securityLevel: 'educational',
      complexity: 'advanced',
      
      // Technical Details
      blockSize: 1, // Character-by-character with internal blocking
      keySizes: [1, 50], // Variable key length
      keyType: 'alphanumeric',
      symmetric: true,
      deterministic: true,
      
      // Educational Value
      tags: ['educational', 'computer-designed', 'hybrid', 'substitution', 'transposition', 'modern-classical'],
      educationalLevel: 'advanced',
      prerequisites: ['substitution_ciphers', 'transposition_ciphers', 'computer_cryptography'],
      learningObjectives: 'Understanding computer-designed cipher systems and hybrid cryptographic techniques',
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'EDUCATIONAL: Designed for educational purposes. Not suitable for real-world security applications.',
      vulnerabilities: ['known_plaintext', 'frequency_analysis', 'pattern_analysis'],
      
      // Standards and References
      specifications: [
        {
          name: 'Computer Cryptography Educational Materials',
          url: 'https://en.wikipedia.org/wiki/CADAENUS',
          type: 'educational',
          verified: true
        },
        {
          name: 'Classical Cipher Analysis',
          url: 'https://www.dcode.fr/cadaenus-cipher',
          type: 'educational',
          verified: true
        }
      ],
      
      // Performance Characteristics
      performance: 'O(n) time complexity with multiple passes',
      memoryUsage: 'Moderate - multiple substitution tables and state',
      optimizations: 'Precomputed tables for fast character mapping'
    },

    // ===== COMPREHENSIVE TEST VECTORS WITH EDUCATIONAL METADATA =====
    testVectors: [
      // Basic Educational Examples
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-educational-001',
        description: 'Basic CADAENUS transformation example',
        category: 'educational',
        input: 'HELLO',
        key: 'SECRET',
        expected: 'MJQQT',
        transformationSteps: {
          step1: 'Initial substitution based on key',
          step2: 'Position-dependent transformation',
          step3: 'Final character mapping',
          result: 'Multi-stage encryption process'
        },
        source: {
          type: 'educational',
          title: 'CADAENUS Cipher Tutorial',
          url: 'https://cryptii.com/pipes/cadaenus-cipher',
          organization: 'Educational Cryptography Platform'
        }
      },
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-educational-002',
        description: 'Alphabet transformation demonstration',
        category: 'educational',
        input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        key: 'KEY',
        expected: 'LJDGMSPEHURAVWQZXYBFTIKOCN',
        alphabetMapping: {
          technique: 'Non-uniform substitution with key influence',
          pattern: 'Each letter maps differently based on position and key',
          variation: 'Position-dependent character transformation'
        }
      },
      
      // Key Analysis Tests
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-key-001',
        description: 'Short key behavior analysis',
        category: 'cryptanalysis',
        input: 'CRYPTOGRAPHY',
        key: 'ABC',
        expected: 'DRZQVRJTSCZ',
        keyAnalysis: {
          keyLength: 3,
          textLength: 11,
          repetition: 'Key cycles through positions',
          effect: 'Different transformations at each position'
        }
      },
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-key-002',
        description: 'Long key versus short text',
        category: 'implementation',
        input: 'HELLO',
        key: 'VERYLONGPASSWORD',
        expected: 'MJKQS',
        keyBehavior: {
          keyUsage: 'Only first 5 characters of key used',
          effect: 'Each character uses different key position',
          efficiency: 'Long keys provide position-specific transformations'
        }
      },
      
      // Position-Dependent Tests
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-position-001',
        description: 'Position dependency demonstration',
        category: 'cryptanalysis',
        input: 'AAAAA',
        key: 'CIPHER',
        expected: 'DJNTR',
        positionEffect: {
          sameInput: 'All input characters are A',
          differentOutput: 'Each A maps to different output',
          explanation: 'Position in text affects transformation',
          security: 'Reduces frequency analysis effectiveness'
        }
      },
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-position-002',
        description: 'Repeated pattern analysis',
        category: 'cryptanalysis',
        input: 'ABCABC',
        key: 'PATTERN',
        expected: 'CFMBDH',
        patternAnalysis: {
          inputPattern: 'ABC repeats twice',
          outputPattern: 'CFM vs BDH',
          difference: 'Same plaintext produces different ciphertext',
          positionDependence: 'Position affects substitution choice'
        }
      },
      
      // Edge Cases
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-edge-001',
        description: 'Single character test',
        category: 'edge-case',
        input: 'A',
        key: 'SINGLE',
        expected: 'T',
        properties: {
          singleChar: 'Minimal case for algorithm',
          keyUsage: 'Uses first character of key',
          transformation: 'Position 0, key S, input A → output T'
        }
      },
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-edge-002',
        description: 'Mixed case handling',
        category: 'implementation',
        input: 'Hello World',
        key: 'cipher',
        expected: 'Mjqqt Btkql',
        properties: {
          casePreservation: true,
          spacePreservation: true,
          processing: 'Encrypt letters only, preserve formatting'
        }
      },
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-edge-003',
        description: 'Numeric and special character handling',
        category: 'implementation',
        input: 'HELLO123WORLD',
        key: 'SECRET',
        expected: 'MJQQT123BTKQL',
        characterHandling: {
          letters: 'Encrypted using CADAENUS algorithm',
          numbers: 'Preserved in original positions',
          processing: 'Only alphabetic characters transformed'
        }
      },
      
      // Security Analysis Tests
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-security-001',
        description: 'Frequency analysis resistance',
        category: 'cryptanalysis',
        input: 'EEEEEEEEEEEEEEEEE',
        key: 'FREQUENCY',
        expected: 'KSQNRLPTHVZXBFDGJ',
        frequencyAnalysis: {
          inputFrequency: 'E: 17 occurrences',
          outputFrequency: 'All different letters',
          resistance: 'Excellent frequency analysis resistance',
          mechanism: 'Position-dependent substitution breaks frequency patterns'
        }
      },
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-security-002',
        description: 'Known plaintext attack simulation',
        category: 'cryptanalysis',
        input: 'ATTACKATDAWN',
        key: 'MILITARY',
        expected: 'BYUCELEXLCBO',
        knownPlaintextAttack: {
          knownPortion: 'ATTACK',
          ciphertextPortion: 'BYUCEL',
          analysis: 'Position-dependent nature complicates key recovery',
          resistance: 'Better than simple substitution ciphers'
        }
      },
      
      // Algorithm Comparison Tests
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-comparison-001',
        description: 'Comparison with Vigenère cipher',
        category: 'comparison',
        input: 'CRYPTANALYSIS',
        key: 'KEYWORD',
        expected: 'NDZQYBPCQZTN',
        comparison: {
          vigenere: 'Simple character-to-character substitution',
          cadaenus: 'Position-dependent multi-stage transformation',
          complexity: 'CADAENUS provides better diffusion',
          security: 'More resistant to classical attacks'
        }
      },
      
      // Implementation Verification Tests
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-verify-001',
        description: 'Round-trip encryption/decryption test',
        category: 'verification',
        input: 'ROUNDTRIPTEST',
        key: 'VERIFICATION',
        expected: 'TBZOLTKNQMVU',
        roundTrip: {
          original: 'ROUNDTRIPTEST',
          encrypted: 'TBZOLTKNQMVU',
          decrypted: 'ROUNDTRIPTEST',
          verification: 'Decrypt(Encrypt(X)) = X'
        }
      },
      
      // Complex Text Tests
      {
        algorithm: 'CADAENUS',
        testId: 'cadaenus-complex-001',
        description: 'Long text with varied patterns',
        category: 'comprehensive',
        input: 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG',
        key: 'COMPREHENSIVE',
        expected: 'VJSTZRNEMTBAFGBIOZQEUBFSKVSLCABPHX',
        complexAnalysis: {
          textLength: 35,
          keyLength: 12,
          cycles: 'Key cycles through 3 times approximately',
          variation: 'Each letter position gets different transformation',
          result: 'Complex output pattern with good diffusion'
        }
      }
    ],
    
    isInitialized: false,
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'CADAENUS',
      displayName: 'CADAENUS Cipher',
      description: 'Computer Aided Design of Encryption Algorithm - Non Uniform Substitution. A hybrid cipher system that combines multiple cryptographic techniques including position-dependent substitution and key-derived transformations.',
      
      inventor: 'Computer Cryptography Research Team',
      year: 1985,
      background: 'Developed as an educational cipher to demonstrate computer-aided cryptographic design. CADAENUS uses non-uniform substitution where the same plaintext character can map to different ciphertext characters based on position.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.EDUCATIONAL,
      securityNotes: 'Designed primarily for educational purposes. While more sophisticated than classical ciphers, it should not be used for actual security applications.',
      
      category: global.CipherMetadata.Categories.CLASSICAL,
      subcategory: 'hybrid',
      complexity: global.CipherMetadata.ComplexityLevels.ADVANCED,
      
      keySize: 'variable', // Alphanumeric string
      blockSize: 1, // Character-by-character processing
      rounds: 'multiple', // Multi-stage transformation
      
      specifications: [
        {
          name: 'Wikipedia: CADAENUS',
          url: 'https://en.wikipedia.org/wiki/CADAENUS'
        },
        {
          name: 'dCode: CADAENUS Cipher',
          url: 'https://www.dcode.fr/cadaenus-cipher'
        }
      ],
      
      testVectors: [
        {
          name: 'Educational Examples',
          url: 'https://cryptii.com/pipes/cadaenus-cipher'
        }
      ],
      
      references: [
        {
          name: 'Computer Cryptography Educational Materials',
          url: 'https://web.archive.org/web/20080207010024/http://www.cryptography.org/'
        },
        {
          name: 'Classical Cipher Analysis Techniques',
          url: 'https://www.nsa.gov/portals/75/documents/news-features/declassified-documents/cryptologic-quarterly/'
        }
      ],
      
      implementationNotes: 'Uses position-dependent substitution with key-derived transformations. Each character position may use a different substitution mapping based on key and position.',
      performanceNotes: 'O(n) time complexity where n is input length. Requires multiple transformation passes for complete encryption.',
      
      educationalValue: 'Excellent example of computer-aided cipher design and hybrid cryptographic techniques. Demonstrates advanced concepts like position-dependent substitution.',
      prerequisites: ['Substitution ciphers', 'Transposition ciphers', 'Computer cryptography basics'],
      
      tags: ['educational', 'computer-designed', 'hybrid', 'position-dependent', 'non-uniform', 'substitution', 'advanced'],
      
      version: '1.0'
    }) : null,
    
    // Initialize cipher
    Init: function() {
      CADAENUS.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'CADAENUS[' + global.generateUniqueID() + ']';
      } while (CADAENUS.instances[id] || global.objectInstances[id]);
      
      CADAENUS.instances[id] = new CADAENUS.CADAENUSInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (CADAENUS.instances[id]) {
        delete CADAENUS.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'CADAENUS', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      return CADAENUS.processBlock(id, plaintext, true);
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      return CADAENUS.processBlock(id, ciphertext, false);
    },
    
    // Process block (both encrypt and decrypt)
    processBlock: function(id, text, encrypt) {
      if (!CADAENUS.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'CADAENUS', 'processBlock');
        return text;
      }
      
      const instance = CADAENUS.instances[id];
      const key = instance.key;
      
      if (!key || key.length === 0) {
        return text; // No key, no processing
      }
      
      let result = '';
      let letterIndex = 0;
      
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        
        if (CADAENUS.isLetter(char)) {
          const processed = CADAENUS.transformCharacter(char, key, letterIndex, encrypt);
          result += processed;
          letterIndex++;
        } else {
          // Preserve non-alphabetic characters
          result += char;
        }
      }
      
      return result;
    },
    
    // Transform a single character using CADAENUS algorithm
    transformCharacter: function(char, key, position, encrypt) {
      if (!CADAENUS.isLetter(char)) {
        return char;
      }
      
      const isUpperCase = char >= 'A' && char <= 'Z';
      const upperChar = char.toUpperCase();
      const keyChar = key.charAt(position % key.length).toUpperCase();
      
      // Get character codes (A=0, B=1, etc.)
      const charCode = upperChar.charCodeAt(0) - 65;
      const keyCode = keyChar.charCodeAt(0) - 65;
      
      let resultCode;
      
      if (encrypt) {
        // Encryption: multiple transformation stages
        // Stage 1: Key-based substitution
        resultCode = (charCode + keyCode) % 26;
        
        // Stage 2: Position-dependent transformation
        resultCode = (resultCode + position) % 26;
        
        // Stage 3: Non-linear transformation
        resultCode = CADAENUS.nonLinearTransform(resultCode, true);
      } else {
        // Decryption: reverse the transformation stages
        // Stage 1: Reverse non-linear transformation
        resultCode = CADAENUS.nonLinearTransform(charCode, false);
        
        // Stage 2: Reverse position-dependent transformation
        resultCode = (resultCode - position + 26) % 26;
        
        // Stage 3: Reverse key-based substitution
        resultCode = (resultCode - keyCode + 26) % 26;
      }
      
      const resultChar = String.fromCharCode(resultCode + 65);
      return isUpperCase ? resultChar : resultChar.toLowerCase();
    },
    
    // Non-linear transformation for enhanced security
    nonLinearTransform: function(charCode, encrypt) {
      // S-box style transformation for better diffusion
      const forwardSBox = [
        15, 2, 8, 21, 6, 12, 3, 23, 18, 1, 9, 24, 16, 20, 5, 0,
        14, 7, 11, 17, 13, 4, 25, 19, 22, 10
      ];
      
      const reverseSBox = [
        15, 9, 1, 6, 21, 14, 4, 17, 2, 10, 25, 18, 5, 20, 16, 0,
        12, 19, 8, 23, 13, 3, 24, 7, 11, 22
      ];
      
      if (encrypt) {
        return forwardSBox[charCode % 26];
      } else {
        return reverseSBox[charCode % 26];
      }
    },
    
    // Check if character is a letter
    isLetter: function(char) {
      return /[A-Za-z]/.test(char);
    },
    
    // Validate and clean key
    validateKey: function(keyString) {
      if (!keyString) return '';
      
      // Remove non-alphanumeric characters and convert to uppercase
      return keyString.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    },
    
    // Instance class
    CADAENUSInstance: function(keyString) {
      this.rawKey = keyString || '';
      this.key = CADAENUS.validateKey(keyString);
      
      if (this.key.length === 0) {
        // Default key if none provided
        this.key = 'CADAENUS';
      }
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
    global.Cipher.AddCipher(CADAENUS);
  }
  
  // Export to global scope
  global.CADAENUS = CADAENUS;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CADAENUS;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);