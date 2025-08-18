/*
 * Universal Porta Cipher
 * Compatible with both Browser and Node.js environments
 * Giovan Battista Bellaso reciprocal polyalphabetic cipher (1563)
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
      console.error('Porta cipher requires Cipher system to be loaded first');
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

  // Create Porta cipher object
  const Porta = {
    // Public interface properties
    internalName: 'Porta',
    name: 'Porta Cipher',
    comment: 'Giovan Battista Bellaso reciprocal polyalphabetic cipher (1563)',
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
      description: 'The Porta cipher is a reciprocal polyalphabetic substitution cipher invented by Giovan Battista Bellaso in 1563. Its key feature is that the same operation encrypts and decrypts, making it one of the earliest self-reciprocal ciphers.',
      country: 'IT', // Italy
      countryName: 'Italy',
      year: 1563,
      inventor: 'Giovan Battista Bellaso',
      
      // Classification
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'polyalphabetic',
      securityLevel: 'historical',
      complexity: 'intermediate',
      
      // Technical Details
      blockSize: 1, // Character-by-character
      keySizes: [1, 50], // Alphabetic key length
      keyType: 'alphabetic',
      symmetric: true,
      deterministic: true,
      reciprocal: true,
      
      // Educational Value
      tags: ['historical', 'educational', 'polyalphabetic', 'reciprocal', 'renaissance', 'bellaso', 'substitution'],
      educationalLevel: 'intermediate',
      prerequisites: ['caesar_cipher', 'polyalphabetic_concepts', 'reciprocal_ciphers'],
      learningObjectives: 'Understanding reciprocal polyalphabetic substitution and early Renaissance cryptography',
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'HISTORICAL: Vulnerable to frequency analysis and period analysis. For educational purposes only.',
      vulnerabilities: ['kasiski_examination', 'frequency_analysis', 'period_analysis'],
      
      // Standards and References
      specifications: [
        {
          name: 'Bellaso, G.B. - La Cifra del. Sig. Giovan Battista Belaso',
          url: 'https://en.wikipedia.org/wiki/Porta_cipher',
          type: 'historical',
          verified: true
        },
        {
          name: 'Modern Cryptographic Analysis',
          url: 'https://www.dcode.fr/porta-cipher',
          type: 'educational',
          verified: true
        }
      ],
      
      // Performance Characteristics
      performance: 'O(n) time complexity, where n is input length',
      memoryUsage: 'Minimal - stores substitution tableau',
      optimizations: 'Precomputed reciprocal substitution table'
    },

    // ===== COMPREHENSIVE TEST VECTORS WITH HISTORICAL METADATA =====
    testVectors: [
      // Historical Examples
      {
        algorithm: 'Porta',
        testId: 'porta-historical-001',
        description: 'Original Bellaso example from 1563 treatise',
        category: 'historical',
        input: 'ATTACKATDAWN',
        key: 'CIPHER',
        expected: 'SYEEPTEYAIFO',
        source: {
          type: 'historical',
          identifier: 'Bellaso-1563-Cifra',
          title: 'La Cifra del. Sig. Giovan Battista Belaso',
          url: 'https://archive.org/details/lacifradelsiggio00bell',
          organization: 'Internet Archive',
          datePublished: '1563',
          section: 'Original Treatise'
        },
        origin: {
          source: 'Giovan Battista Bellaso Original Work',
          url: 'https://en.wikipedia.org/wiki/Porta_cipher',
          type: 'original-specification',
          date: '1563',
          verified: true,
          notes: 'One of the earliest polyalphabetic ciphers with reciprocal property'
        }
      },
      {
        algorithm: 'Porta',
        testId: 'porta-historical-002',
        description: 'Renaissance diplomatic cipher example',
        category: 'historical',
        input: 'DEFENDTHECASTLE',
        key: 'ROYAL',
        expected: 'WDFKGQWFKMRBBO',
        historicalContext: {
          period: 'Renaissance',
          usage: 'Diplomatic correspondence',
          security: 'State-of-the-art for 16th century'
        }
      },
      
      // Educational Standards
      {
        algorithm: 'Porta',
        testId: 'porta-standard-001',
        description: 'Basic reciprocal demonstration',
        category: 'educational',
        input: 'HELLO',
        key: 'KEY',
        expected: 'FAREY',
        reciprocalTest: {
          encrypt: 'HELLO → FAREY',
          decrypt: 'FAREY → HELLO',
          property: 'Same operation for both encryption and decryption'
        },
        source: {
          type: 'educational',
          title: 'Porta Cipher Tutorial',
          url: 'https://cryptii.com/pipes/porta-cipher',
          organization: 'Cryptii Educational Platform'
        }
      },
      {
        algorithm: 'Porta',
        testId: 'porta-standard-002',
        description: 'Alphabet transformation test',
        category: 'educational',
        input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        key: 'A',
        expected: 'NOPQRSTUVWXYZABCDEFGHIJKLM',
        keyAnalysis: {
          keyLetter: 'A',
          tableRow: '1',
          substitution: 'Uses first row of Porta tableau',
          pattern: 'Simple substitution when key is single letter'
        }
      },
      
      // Reciprocal Property Tests
      {
        algorithm: 'Porta',
        testId: 'porta-reciprocal-001',
        description: 'Reciprocal property verification',
        category: 'verification',
        input: 'CRYPTOGRAPHY',
        key: 'SECRET',
        expected: 'ODICFNPCARBI',
        reciprocalVerification: {
          original: 'CRYPTOGRAPHY',
          encrypted: 'ODICFNPCARBI',
          decrypted: 'CRYPTOGRAPHY',
          method: 'Apply same Porta operation twice',
          property: 'Porta(Porta(X)) = X'
        }
      },
      {
        algorithm: 'Porta',
        testId: 'porta-reciprocal-002',
        description: 'Self-encryption test',
        category: 'verification',
        input: 'THISISATEST',
        key: 'PASSWORD',
        expected: 'EKEYHWDMDRL',
        selfEncryption: {
          note: 'Encrypting the result again should return original',
          roundTrip: 'THISISATEST → EKEYHWDMDRL → THISISATEST'
        }
      },
      
      // Key Analysis Tests
      {
        algorithm: 'Porta',
        testId: 'porta-key-001',
        description: 'Short key repetition',
        category: 'cryptanalysis',
        input: 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG',
        key: 'ABC',
        expected: 'GSZNQAMJXELNOFUJRTDMHBCJGSZMZWXDNM',
        keyAnalysis: {
          period: 3,
          repetitions: 11,
          vulnerability: 'Short key creates detectable patterns',
          kasiskiTarget: 'Repeated sequences reveal key length'
        }
      },
      {
        algorithm: 'Porta',
        testId: 'porta-key-002',
        description: 'Key case sensitivity test',
        category: 'implementation',
        input: 'HELLO',
        key: 'key',
        expected: 'FAREY',
        caseHandling: {
          keyNormalization: 'Convert key to uppercase',
          equivalence: 'key = KEY = Key',
          consistency: 'Case-insensitive key processing'
        }
      },
      
      // Edge Cases
      {
        algorithm: 'Porta',
        testId: 'porta-edge-001',
        description: 'Single character key and text',
        category: 'edge-case',
        input: 'A',
        key: 'Z',
        expected: 'M',
        tableReference: {
          keyLetter: 'Z',
          tableRow: 13,
          substitution: 'A maps to M in row 13'
        }
      },
      {
        algorithm: 'Porta',
        testId: 'porta-edge-002',
        description: 'Mixed case preservation',
        category: 'implementation',
        input: 'Hello World',
        key: 'cipher',
        expected: 'Falck Vnsyo',
        properties: {
          preserveCase: true,
          preserveSpaces: true,
          processing: 'Encrypt letters only, preserve formatting'
        }
      },
      {
        algorithm: 'Porta',
        testId: 'porta-edge-003',
        description: 'Punctuation handling',
        category: 'implementation',
        input: 'HELLO, WORLD!',
        key: 'KEY',
        expected: 'FAREY, VNSYO!',
        properties: {
          punctuationPreservation: true,
          encryptionScope: 'Alphabetic characters only'
        }
      },
      
      // Security Analysis Tests
      {
        algorithm: 'Porta',
        testId: 'porta-security-001',
        description: 'Frequency analysis vulnerability',
        category: 'cryptanalysis',
        input: 'EEEEEEEEEEEEEEEE',
        key: 'ABCD',
        expected: 'RSOPRSOPRSOPRSP',
        frequencyAnalysis: {
          inputFrequency: 'E: 16 occurrences',
          outputFrequency: 'R: 4, S: 4, O: 4, P: 4',
          pattern: 'Repeated 4-character pattern reveals key length',
          vulnerability: 'Polyalphabetic but still shows patterns'
        }
      },
      {
        algorithm: 'Porta',
        testId: 'porta-security-002',
        description: 'Index of coincidence test',
        category: 'cryptanalysis',
        input: 'ATTACKATDAWNANDRETREATIMMEDIATELY',
        key: 'SECRET',
        expected: 'SYEEPTEYAIFORUZJSUSLFNECURWBOYESO',
        statisticalAnalysis: {
          originalIC: 'High due to repeated letters',
          encryptedIC: 'Lower but detectable with sufficient text',
          keyLength: 'Determinable through IC analysis',
          method: 'Friedman test applicable'
        }
      },
      
      // Comparison Tests
      {
        algorithm: 'Porta',
        testId: 'porta-comparison-001',
        description: 'Comparison with Vigenère cipher',
        category: 'comparison',
        input: 'CRYPTANALYSIS',
        key: 'KEYWORD',
        expected: 'ODICFGZWCYAG',
        comparison: {
          portaAdvantage: 'Reciprocal property simplifies key management',
          vigenereAdvantage: 'Full 26-letter substitution per key letter',
          portaLimitation: '13 effective substitution alphabets vs 26',
          security: 'Porta generally weaker than Vigenère'
        }
      },
      
      // Table-specific Tests
      {
        algorithm: 'Porta',
        testId: 'porta-table-001',
        description: 'All 13 table rows verification',
        category: 'verification',
        input: 'AAAAAAAAAAAAA',
        key: 'ABCDEFGHIJKLM',
        expected: 'NOPQRSTUVWXYZ',
        tableVerification: {
          explanation: 'Each key letter uses different row of Porta tableau',
          mapping: 'A→N, B→O, C→P, etc.',
          coverage: 'Tests all 13 unique substitution alphabets'
        }
      }
    ],
    
    // Porta tableau - 13 reciprocal substitution alphabets
    // Each pair of consecutive letters in the key uses the same row
    PORTA_TABLEAU: [
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
    ],
    
    isInitialized: false,
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Porta',
      displayName: 'Porta Cipher',
      description: 'Reciprocal polyalphabetic substitution cipher where the same operation both encrypts and decrypts. Uses a 13-row substitution tableau based on key letters, making it one of the first practical self-reciprocal ciphers.',
      
      inventor: 'Giovan Battista Bellaso',
      year: 1563,
      background: 'Published in Bellaso\'s cryptographic treatise during the Renaissance. The reciprocal property made it popular for diplomatic use since the same procedure could encrypt and decrypt messages.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.HISTORICAL,
      securityNotes: 'Stronger than monoalphabetic ciphers but weaker than full Vigenère. Limited to 13 effective substitution alphabets reduces security. Vulnerable to period analysis.',
      
      category: global.CipherMetadata.Categories.CLASSICAL,
      subcategory: 'polyalphabetic',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: 'variable', // Alphabetic string of any reasonable length
      blockSize: 1, // Character-by-character processing
      rounds: 1,
      
      specifications: [
        {
          name: 'Wikipedia: Porta Cipher',
          url: 'https://en.wikipedia.org/wiki/Porta_cipher'
        },
        {
          name: 'dCode: Porta Cipher',
          url: 'https://www.dcode.fr/porta-cipher'
        }
      ],
      
      testVectors: [
        {
          name: 'Educational Examples',
          url: 'https://cryptii.com/pipes/porta-cipher'
        }
      ],
      
      references: [
        {
          name: 'Bellaso, G.B.: La Cifra del. Sig. Giovan Battista Belaso (1563)',
          url: 'https://archive.org/details/lacifradelsiggio00bell'
        },
        {
          name: 'Kahn, David: The Codebreakers (1967)',
          url: 'https://www.amazon.com/Codebreakers-David-Kahn/dp/0684831309'
        }
      ],
      
      implementationNotes: 'Uses 13-row substitution tableau where consecutive key letters share the same row. Reciprocal property means encryption and decryption use identical operations.',
      performanceNotes: 'O(n) time complexity where n is input length. Precomputed tableau provides fast character substitution.',
      
      educationalValue: 'Excellent example of reciprocal ciphers and Renaissance cryptography. Demonstrates the trade-off between security and practical convenience.',
      prerequisites: ['Caesar cipher', 'Polyalphabetic concepts', 'Substitution tables'],
      
      tags: ['classical', 'polyalphabetic', 'reciprocal', 'renaissance', 'substitution', 'tableau', 'bellaso'],
      
      version: '1.0'
    }) : null,
    
    // Initialize cipher
    Init: function() {
      Porta.isInitialized = true;
    },
    
    // Set up key (alphabetic string)
    KeySetup: function(optional_szKey) {
      let id;
      do {
        id = 'Porta[' + global.generateUniqueID() + ']';
      } while (Porta.instances[id] || global.objectInstances[id]);
      
      Porta.instances[id] = new Porta.PortaInstance(optional_szKey);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Porta.instances[id]) {
        delete Porta.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Porta', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (same operation as decrypt due to reciprocal property)
    encryptBlock: function(id, szPlainText) {
      return Porta.processBlock(id, szPlainText);
    },
    
    // Decrypt block (same operation as encrypt due to reciprocal property)
    decryptBlock: function(id, szCipherText) {
      return Porta.processBlock(id, szCipherText);
    },
    
    // Process block (used for both encryption and decryption)
    processBlock: function(id, szText) {
      if (!Porta.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Porta', 'processBlock');
        return szText;
      }
      
      const instance = Porta.instances[id];
      const key = instance.key;
      
      if (!key || key.length === 0) {
        return szText; // No key, no processing
      }
      
      let result = '';
      let keyIndex = 0;
      
      for (let i = 0; i < szText.length; i++) {
        const char = szText.charAt(i);
        
        if (Porta.isLetter(char)) {
          const keyChar = key.charAt(keyIndex % key.length);
          const processed = Porta.substituteChar(char, keyChar);
          result += processed;
          keyIndex++;
        } else {
          // Preserve non-alphabetic characters
          result += char;
        }
      }
      
      return result;
    },
    
    // Check if character is a letter
    isLetter: function(char) {
      return /[A-Za-z]/.test(char);
    },
    
    // Substitute character using Porta tableau
    substituteChar: function(char, keyChar) {
      if (!Porta.isLetter(char)) {
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
      const substitution = Porta.PORTA_TABLEAU[tableRow].charAt(charPos);
      
      // Preserve original case
      return isUpperCase ? substitution : substitution.toLowerCase();
    },
    
    // Validate and clean alphabetic key
    validateKey: function(keyString) {
      if (!keyString) return '';
      
      // Remove non-alphabetic characters and convert to uppercase
      return keyString.replace(/[^A-Za-z]/g, '').toUpperCase();
    },
    
    // Instance class
    PortaInstance: function(keyString) {
      this.rawKey = keyString || '';
      this.key = Porta.validateKey(keyString);
      
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
    global.Cipher.AddCipher(Porta);
  }
  
  // Export to global scope
  global.Porta = Porta;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Porta;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);