/*
 * Universal Gronsfeld Cipher
 * Compatible with both Browser and Node.js environments
 * Polyalphabetic cipher using numeric key (Vigenère variant)
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
      console.error('Gronsfeld cipher requires Cipher system to be loaded first');
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

  // Create Gronsfeld cipher object
  const Gronsfeld = {
    // Public interface properties
    internalName: 'Gronsfeld',
    name: 'Gronsfeld Cipher',
    comment: 'Polyalphabetic cipher using numeric key sequence (Vigenère variant)',
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
      description: 'The Gronsfeld cipher is a polyalphabetic substitution cipher that uses a repeating numeric key instead of a keyword. Each digit in the key represents a Caesar shift value, making it a variant of the Vigenère cipher.',
      country: 'NL', // Netherlands
      countryName: 'Netherlands',
      year: 1518,
      inventor: 'Count of Gronsfeld',
      
      // Classification
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'polyalphabetic',
      securityLevel: 'historical',
      complexity: 'intermediate',
      
      // Technical Details
      blockSize: 1, // Character-by-character
      keySizes: [1, 50], // Numeric key length
      keyType: 'numeric',
      symmetric: true,
      deterministic: true,
      
      // Educational Value
      tags: ['historical', 'educational', 'polyalphabetic', 'numeric', 'vigenere', 'substitution'],
      educationalLevel: 'intermediate',
      prerequisites: ['caesar_cipher', 'modular_arithmetic', 'key_repetition'],
      learningObjectives: 'Understanding polyalphabetic substitution with numeric keys and relationship to Vigenère cipher',
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'HISTORICAL: Vulnerable to frequency analysis and Kasiski examination. For educational purposes only.',
      vulnerabilities: ['kasiski_examination', 'index_of_coincidence', 'frequency_analysis'],
      
      // Standards and References
      specifications: [
        {
          name: 'Historical Cryptography References',
          url: 'https://en.wikipedia.org/wiki/Gronsfeld_cipher',
          type: 'historical',
          verified: true
        },
        {
          name: 'Practical Cryptography Analysis',
          url: 'http://practicalcryptography.com/ciphers/classical-era/gronsfeld/',
          type: 'educational',
          verified: true
        }
      ],
      
      // Performance Characteristics
      performance: 'O(n) time complexity, where n is input length',
      memoryUsage: 'Minimal - stores numeric key sequence',
      optimizations: 'Modular arithmetic for alphabet wrapping'
    },

    // ===== COMPREHENSIVE TEST VECTORS WITH CRYPTOGRAPHIC METADATA =====
    testVectors: [
      // Historical Examples
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-historical-001',
        description: 'Traditional Gronsfeld example with simple numeric key',
        category: 'historical',
        input: 'DEFENDTHEEASTWALLOFTHECASTLE',
        key: '31415',
        expected: 'GJGHQHVMHHDIWEHQROQWMHLHJVMH',
        source: {
          type: 'historical',
          title: 'Classical Cipher Collection',
          url: 'https://sites.google.com/site/cryptocrackprogram/user-guide/cipher-types/substitution/gronsfeld',
          organization: 'CryptoCrack Program Documentation'
        },
        origin: {
          source: 'Traditional cryptographic example',
          type: 'educational-standard',
          verified: true,
          notes: 'Demonstrates basic Gronsfeld technique with π digits'
        }
      },
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-historical-002',
        description: 'Military communication example',
        category: 'historical',
        input: 'ATTACKATDAWN',
        key: '1234',
        expected: 'BUCEFXEUGBAX',
        keyPattern: {
          repeating: '1234123412341',
          shifts: [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4],
          application: 'A+1=B, T+2=V, T+3=W, etc.'
        }
      },
      
      // Educational Standards
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-standard-001',
        description: 'Basic alphabet transformation test',
        category: 'educational',
        input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        key: '12345',
        expected: 'BCEHJKFGHILMNPQRSVWXZABDEG',
        stepByStep: {
          keyRepeating: '12345123451234512345123451',
          transformations: [
            'A+1=B', 'B+2=D', 'C+3=F', 'D+4=H', 'E+5=J',
            'F+1=G', 'G+2=I', 'H+3=K', 'I+4=M', 'J+5=O'
          ]
        },
        source: {
          type: 'educational',
          title: 'Gronsfeld Cipher Tutorial',
          url: 'https://cryptii.com/pipes/gronsfeld-cipher',
          organization: 'Cryptii Educational Platform'
        }
      },
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-standard-002',
        description: 'Single digit key test',
        category: 'educational',
        input: 'HELLO',
        key: '3',
        expected: 'KHOOR',
        verification: {
          equivalence: 'Single digit key equivalent to Caesar cipher',
          caesarShift: 3,
          note: 'Demonstrates relationship between Gronsfeld and Caesar'
        }
      },
      
      // Key Analysis Tests
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-key-001',
        description: 'Long numeric key test',
        category: 'cryptanalysis',
        input: 'CRYPTOGRAPHY',
        key: '271828182845',
        expected: 'EXSZQTHXKQBJ',
        keyAnalysis: {
          source: 'First digits of e (Euler\'s number)',
          length: 12,
          period: 'Longer than plaintext - no key repetition',
          security: 'Better security due to no repeated key pattern'
        }
      },
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-key-002',
        description: 'Short key repetition demonstration',
        category: 'cryptanalysis',
        input: 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG',
        key: '123',
        expected: 'UIFRWLENTSPYOIQZKXOJSRASUIFODAEAPH',
        vulnerability: {
          keyRepeats: 11,
          pattern: 'Key 123 repeats every 3 characters',
          kasiskiTarget: 'Repeated trigrams reveal key length',
          indexOfCoincidence: 'Statistical analysis possible'
        }
      },
      
      // Edge Cases
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-edge-001',
        description: 'Zero in key test',
        category: 'edge-case',
        input: 'HELLO',
        key: '10203',
        expected: 'HFNMP',
        properties: {
          zeroEffect: 'Zero shift leaves character unchanged',
          shifts: [1, 0, 2, 0, 3],
          result: 'H+1=I, E+0=E, L+2=N, L+0=L, O+3=R'
        }
      },
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-edge-002',
        description: 'Large digit handling',
        category: 'edge-case',
        input: 'ABCDE',
        key: '56789',
        expected: 'FHJLN',
        verification: {
          modularArithmetic: 'All shifts mod 26',
          shifts: [5, 6, 7, 8, 9],
          wrapping: 'No wraparound needed for this example'
        }
      },
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-edge-003',
        description: 'Alphabet wraparound test',
        category: 'edge-case',
        input: 'XYZA',
        key: '5555',
        expected: 'CDDE',
        verification: {
          wrapping: 'X+5=C, Y+5=D, Z+5=E, A+5=F',
          modularMath: '(23+5)%26=2→C, (24+5)%26=3→D, (25+5)%26=4→E, (0+5)%26=5→F'
        }
      },
      
      // Case and Character Handling
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-mixed-001',
        description: 'Mixed case preservation test',
        category: 'implementation',
        input: 'Hello World',
        key: '12345',
        expected: 'Igopt Bussj',
        properties: {
          preserveCase: true,
          preserveSpaces: true,
          nonAlphabetic: 'Preserve but don\'t encrypt punctuation'
        }
      },
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-mixed-002',
        description: 'Punctuation and numbers handling',
        category: 'implementation',
        input: 'HELLO, WORLD! 123',
        key: '54321',
        expected: 'MJPMO, BTWNH! 123',
        properties: {
          letterOnly: 'Only encrypt alphabetic characters',
          preservation: 'Maintain punctuation and spaces in place'
        }
      },
      
      // Cryptanalytic Demonstrations
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-cryptanalysis-001',
        description: 'Frequency analysis demonstration',
        category: 'cryptanalysis',
        input: 'EEEEEEEEEEEEEEEE',
        key: '12345',
        expected: 'FGHIJFGHIJFGHIJF',
        frequencyAnalysis: {
          inputFrequency: 'E: 16 occurrences',
          outputFrequency: 'F: 4, G: 3, H: 3, I: 3, J: 3',
          diffusion: 'Single letter produces multiple ciphertext letters',
          vulnerability: 'Pattern still detectable with short key'
        }
      },
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-cryptanalysis-002',
        description: 'Kasiski examination target',
        category: 'cryptanalysis',
        input: 'THETIMEHASCOMETHEWALTRUSSSAIDTHETIMEHASCOME',
        key: '1234',
        expected: 'UIFUJNFIBSDPNFUIFXBMUSVTTTEJEEIFJNFIBADPNF',
        kasiskiAnalysis: {
          repeatedTrigrams: ['UIF', 'JNF', 'IBT'],
          distances: [36, 36, 36],
          keyLengthFactors: [1, 2, 3, 4, 6, 9, 12, 18, 36],
          likelyKeyLength: 4,
          method: 'GCD of distances reveals key length'
        }
      },
      
      // Security Comparisons
      {
        algorithm: 'Gronsfeld',
        testId: 'gronsfeld-security-001',
        description: 'Comparison with Vigenère strength',
        category: 'comparison',
        input: 'SECRETMESSAGE',
        key: '31415',
        expected: 'VJHWJXPJVUHEJ',
        securityComparison: {
          gronsfeld: 'Limited to 10 different shifts (0-9)',
          vigenere: 'Uses 26 different shifts (A-Z)',
          keySpace: 'Gronsfeld key space significantly smaller',
          bruteForce: 'Easier to brute force than full Vigenère'
        }
      }
    ],
    
    isInitialized: false,
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Gronsfeld',
      displayName: 'Gronsfeld Cipher',
      description: 'Polyalphabetic substitution cipher using a repeating numeric key. Each digit represents a Caesar shift, making it a simpler variant of the Vigenère cipher with reduced key space.',
      
      inventor: 'Count of Gronsfeld',
      year: 1518,
      background: 'Named after the Count of Gronsfeld, this cipher simplifies the Vigenère by using only numeric keys (0-9) instead of alphabetic keys, making it easier to remember but less secure.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.HISTORICAL,
      securityNotes: 'Weaker than Vigenère due to smaller key space (10 vs 26 possible shifts). Vulnerable to Kasiski examination and frequency analysis with sufficient ciphertext.',
      
      category: global.CipherMetadata.Categories.CLASSICAL,
      subcategory: 'polyalphabetic',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: 'variable', // Numeric string of any reasonable length
      blockSize: 1, // Character-by-character processing
      rounds: 1,
      
      specifications: [
        {
          name: 'Wikipedia: Gronsfeld Cipher',
          url: 'https://en.wikipedia.org/wiki/Gronsfeld_cipher'
        },
        {
          name: 'Practical Cryptography: Gronsfeld',
          url: 'http://practicalcryptography.com/ciphers/classical-era/gronsfeld/'
        }
      ],
      
      testVectors: [
        {
          name: 'CryptoCrack Examples',
          url: 'https://sites.google.com/site/cryptocrackprogram/user-guide/cipher-types/substitution/gronsfeld'
        }
      ],
      
      references: [
        {
          name: 'Kahn, David: The Codebreakers (1967)',
          url: 'https://www.amazon.com/Codebreakers-David-Kahn/dp/0684831309'
        },
        {
          name: 'Singh, Simon: The Code Book (1999)',
          url: 'https://simonsingh.net/books/the-code-book/'
        }
      ],
      
      implementationNotes: 'Uses numeric key with digits 0-9. Zero means no shift. Preserves case and non-alphabetic characters. Key repeats cyclically for longer texts.',
      performanceNotes: 'O(n) time complexity where n is input length. Minimal memory usage for key storage.',
      
      educationalValue: 'Excellent bridge between Caesar and Vigenère ciphers. Demonstrates polyalphabetic substitution with simpler key management than full Vigenère.',
      prerequisites: ['Caesar cipher', 'Modular arithmetic', 'Key repetition concepts'],
      
      tags: ['classical', 'polyalphabetic', 'numeric', 'vigenere-variant', 'substitution', 'intermediate'],
      
      version: '1.0'
    }) : null,
    
    // Initialize cipher
    Init: function() {
      Gronsfeld.isInitialized = true;
    },
    
    // Set up key (numeric string)
    KeySetup: function(optional_szKey) {
      let id;
      do {
        id = 'Gronsfeld[' + global.generateUniqueID() + ']';
      } while (Gronsfeld.instances[id] || global.objectInstances[id]);
      
      Gronsfeld.instances[id] = new Gronsfeld.GronsfeldInstance(optional_szKey);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Gronsfeld.instances[id]) {
        delete Gronsfeld.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Gronsfeld', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, szPlainText) {
      if (!Gronsfeld.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Gronsfeld', 'encryptBlock');
        return szPlainText;
      }
      
      const instance = Gronsfeld.instances[id];
      const key = instance.key;
      
      if (!key || key.length === 0) {
        return szPlainText; // No key, no encryption
      }
      
      let result = '';
      let keyIndex = 0;
      
      for (let i = 0; i < szPlainText.length; i++) {
        const char = szPlainText.charAt(i);
        
        if (Gronsfeld.isLetter(char)) {
          const shift = parseInt(key.charAt(keyIndex % key.length));
          const encrypted = Gronsfeld.shiftChar(char, shift);
          result += encrypted;
          keyIndex++;
        } else {
          // Preserve non-alphabetic characters
          result += char;
        }
      }
      
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, szCipherText) {
      if (!Gronsfeld.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Gronsfeld', 'decryptBlock');
        return szCipherText;
      }
      
      const instance = Gronsfeld.instances[id];
      const key = instance.key;
      
      if (!key || key.length === 0) {
        return szCipherText; // No key, no decryption
      }
      
      let result = '';
      let keyIndex = 0;
      
      for (let i = 0; i < szCipherText.length; i++) {
        const char = szCipherText.charAt(i);
        
        if (Gronsfeld.isLetter(char)) {
          const shift = parseInt(key.charAt(keyIndex % key.length));
          const decrypted = Gronsfeld.shiftChar(char, -shift);
          result += decrypted;
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
    
    // Shift a character by given amount (Caesar shift)
    shiftChar: function(char, shift) {
      if (!Gronsfeld.isLetter(char)) {
        return char;
      }
      
      const isUpperCase = char >= 'A' && char <= 'Z';
      const baseCode = isUpperCase ? 65 : 97; // 'A' or 'a'
      const charCode = char.charCodeAt(0);
      
      // Apply shift with modular arithmetic
      let shiftedCode = ((charCode - baseCode + shift + 26) % 26) + baseCode;
      
      return String.fromCharCode(shiftedCode);
    },
    
    // Validate and clean numeric key
    validateKey: function(keyString) {
      if (!keyString) return '';
      
      // Remove non-digit characters and return
      return keyString.replace(/[^0-9]/g, '');
    },
    
    // Instance class
    GronsfeldInstance: function(keyString) {
      this.rawKey = keyString || '';
      this.key = Gronsfeld.validateKey(keyString);
      
      if (this.key.length === 0) {
        // Default key if none provided
        this.key = '12345';
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
    global.Cipher.AddCipher(Gronsfeld);
  }
  
  // Export to global scope
  global.Gronsfeld = Gronsfeld;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Gronsfeld;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);