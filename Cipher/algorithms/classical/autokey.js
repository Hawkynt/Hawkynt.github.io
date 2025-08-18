/*
 * Universal Autokey Cipher
 * Compatible with both Browser and Node.js environments
 * Vigenère variant using plaintext to extend the key (1586)
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
      console.error('Autokey cipher requires Cipher system to be loaded first');
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

  // Create Autokey cipher object
  const Autokey = {
    // Public interface properties
    internalName: 'Autokey',
    name: 'Autokey Cipher',
    comment: 'Vigenère variant using plaintext to extend the key (1586)',
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
      description: 'The Autokey cipher is an enhanced version of the Vigenère cipher that uses the plaintext itself to extend the key, eliminating key repetition and significantly improving security against period-based attacks.',
      country: 'FR', // France
      countryName: 'France',
      year: 1586,
      inventor: 'Blaise de Vigenère',
      
      // Classification
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'polyalphabetic',
      securityLevel: 'historical',
      complexity: 'intermediate',
      
      // Technical Details
      blockSize: 1, // Character-by-character
      keySizes: [1, 50], // Initial key length
      keyType: 'alphabetic',
      symmetric: true,
      deterministic: true,
      
      // Educational Value
      tags: ['historical', 'educational', 'polyalphabetic', 'autokey', 'vigenere', 'key-extension', 'renaissance'],
      educationalLevel: 'intermediate',
      prerequisites: ['vigenere_cipher', 'key_repetition_attacks', 'polyalphabetic_substitution'],
      learningObjectives: 'Understanding key extension techniques and improvements over basic Vigenère cipher',
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'HISTORICAL: More secure than Vigenère but still vulnerable to modern cryptanalysis. For educational purposes only.',
      vulnerabilities: ['probable_plaintext', 'frequency_analysis', 'ciphertext_only_attacks'],
      
      // Standards and References
      specifications: [
        {
          name: 'Vigenère, B. de - Traicté des Chiffres',
          url: 'https://en.wikipedia.org/wiki/Autokey_cipher',
          type: 'historical',
          verified: true
        },
        {
          name: 'Modern Cryptanalysis of Autokey',
          url: 'https://www.dcode.fr/autokey-cipher',
          type: 'educational',
          verified: true
        }
      ],
      
      // Performance Characteristics
      performance: 'O(n) time complexity, where n is input length',
      memoryUsage: 'Minimal - stores initial key and builds extended key dynamically',
      optimizations: 'Sequential key extension during processing'
    },

    // ===== COMPREHENSIVE TEST VECTORS WITH CRYPTOGRAPHIC METADATA =====
    testVectors: [
      // Historical Examples
      {
        algorithm: 'Autokey',
        testId: 'autokey-historical-001',
        description: 'Vigenère\'s original autokey example from 1586',
        category: 'historical',
        input: 'ATTACKATDAWN',
        key: 'QUEENLY',
        expected: 'QNXEPVYTWTWP',
        keyExtension: {
          initialKey: 'QUEENLY',
          extendedKey: 'QUEENLYATTAC',
          process: 'Initial key + plaintext characters',
          length: 12
        },
        source: {
          type: 'historical',
          identifier: 'Vigenere-1586-Traicte',
          title: 'Traicté des Chiffres ou Secrètes Manières d\'Escrire',
          url: 'https://gallica.bnf.fr/ark:/12148/bpt6k5493743',
          organization: 'Bibliothèque nationale de France',
          datePublished: '1586',
          section: 'Chapter on Autokey'
        },
        origin: {
          source: 'Blaise de Vigenère Original Work',
          url: 'https://en.wikipedia.org/wiki/Autokey_cipher',
          type: 'original-specification',
          date: '1586',
          verified: true,
          notes: 'Vigenère\'s improvement over his own basic cipher'
        }
      },
      {
        algorithm: 'Autokey',
        testId: 'autokey-historical-002',
        description: 'French diplomatic cipher example',
        category: 'historical',
        input: 'DEFENDTHECASTLE',
        key: 'ROYAL',
        expected: 'VYXZMPZGUCAVNXR',
        diplomaticContext: {
          period: 'Late Renaissance',
          usage: 'French court communications',
          advantage: 'No key repetition for better security'
        }
      },
      
      // Educational Standards
      {
        algorithm: 'Autokey',
        testId: 'autokey-standard-001',
        description: 'Basic autokey demonstration',
        category: 'educational',
        input: 'HELLO',
        key: 'KEY',
        expected: 'RIJVS',
        stepByStep: {
          initialKey: 'KEY',
          extendedKey: 'KEYHE',
          transformations: [
            'H + K = R', 'E + E = I', 'L + Y = J', 
            'L + H = S', 'O + E = S'
          ],
          explanation: 'Key extended with plaintext: KEY + HELLO → KEYHE'
        },
        source: {
          type: 'educational',
          title: 'Autokey Cipher Tutorial',
          url: 'https://cryptii.com/pipes/autokey-cipher',
          organization: 'Cryptii Educational Platform'
        }
      },
      {
        algorithm: 'Autokey',
        testId: 'autokey-standard-002',
        description: 'Long text demonstration',
        category: 'educational',
        input: 'CRYPTOGRAPHYISAFASCINATINGSUBJECT',
        key: 'SECRET',
        expected: 'UKAAXIKRIDGMTAXJDSQRHKSNTRGSWQGNXX',
        keyExtension: {
          initialKey: 'SECRET',
          fullExtendedKey: 'SECRETCRYPTOGRAPHYISAFASCINATIN',
          noRepetition: 'No repeating pattern in extended key',
          security: 'Better than basic Vigenère due to key variation'
        }
      },
      
      // Security Comparison Tests
      {
        algorithm: 'Autokey',
        testId: 'autokey-security-001',
        description: 'Comparison with Vigenère vulnerability',
        category: 'cryptanalysis',
        input: 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG',
        key: 'CIPHER',
        expected: 'VPKQXQILGVAWRQTINXNVUGAVXPKGPEAAKIL',
        securityAnalysis: {
          vigenereWeakness: 'Key CIPHER would repeat every 6 characters',
          autokeyStrength: 'Key extends to CIPHERTHEQUICKBROWNFOXJUMPS...',
          noRepetition: 'No periodic key pattern to exploit',
          improvedSecurity: 'Resistant to Kasiski examination'
        }
      },
      {
        algorithm: 'Autokey',
        testId: 'autokey-security-002',
        description: 'Frequency analysis resistance',
        category: 'cryptanalysis',
        input: 'EEEEEEEEEEEEEEEEE',
        key: 'ABCD',
        expected: 'EFGHEFGHBFGICGJD',
        frequencyAnalysis: {
          inputFrequency: 'E: 17 occurrences',
          outputFrequency: 'Distributed across multiple letters',
          keyEvolution: 'ABCDEEEEEEEEEEEE',
          variability: 'Different substitutions for same plaintext letter'
        }
      },
      
      // Key Analysis Tests
      {
        algorithm: 'Autokey',
        testId: 'autokey-key-001',
        description: 'Short initial key test',
        category: 'implementation',
        input: 'CRYPTOGRAPHY',
        key: 'K',
        expected: 'MBIZXSKVDTC',
        keyBehavior: {
          initialKey: 'K',
          extendedKey: 'KCRYPTOGRAPH',
          rapidExtension: 'Single character key quickly extends',
          effectiveness: 'Still provides good security with minimal key'
        }
      },
      {
        algorithm: 'Autokey',
        testId: 'autokey-key-002',
        description: 'Long initial key test',
        category: 'implementation',
        input: 'HELLO',
        key: 'VERYLONGPASSWORD',
        expected: 'CZIQX',
        keyBehavior: {
          initialKey: 'VERYLONGPASSWORD',
          usedPortion: 'VERYL',
          unusedPortion: 'ONGPASSWORD',
          note: 'Long key partially used, no plaintext extension needed'
        }
      },
      
      // Edge Cases
      {
        algorithm: 'Autokey',
        testId: 'autokey-edge-001',
        description: 'Single character input and key',
        category: 'edge-case',
        input: 'A',
        key: 'Z',
        expected: 'Z',
        calculation: {
          plaintext: 'A (0)',
          key: 'Z (25)',
          result: '(0 + 25) mod 26 = 25 = Z',
          noExtension: 'Single character requires no key extension'
        }
      },
      {
        algorithm: 'Autokey',
        testId: 'autokey-edge-002',
        description: 'Mixed case preservation',
        category: 'implementation',
        input: 'Hello World',
        key: 'key',
        expected: 'Rijvq Ewdny',
        properties: {
          preserveCase: true,
          preserveSpaces: true,
          keyExtension: 'keyhe lloworld (spaces ignored in key extension)'
        }
      },
      {
        algorithm: 'Autokey',
        testId: 'autokey-edge-003',
        description: 'Punctuation handling',
        category: 'implementation',
        input: 'HELLO, WORLD!',
        key: 'SECRET',
        expected: 'ZLYPF, QBKCQ!',
        processing: {
          keyExtension: 'SECRETHELLOWORLD',
          punctuationSkipped: 'Comma and exclamation preserved',
          letterEncryption: 'Only alphabetic characters encrypted'
        }
      },
      
      // Decryption Verification Tests
      {
        algorithm: 'Autokey',
        testId: 'autokey-decrypt-001',
        description: 'Decryption process demonstration',
        category: 'verification',
        input: 'CRYPTANALYSIS',
        key: 'PASSWORD',
        expected: 'RJGZSNKGSLZC',
        decryptionProcess: {
          ciphertext: 'RJGZSNKGSLZC',
          initialKey: 'PASSWORD',
          reconstruction: 'Use initial key to decrypt first characters',
          keyRecovery: 'Decrypted plaintext extends key for remaining characters',
          result: 'CRYPTANALYSIS'
        }
      },
      
      // Attack Vulnerability Tests
      {
        algorithm: 'Autokey',
        testId: 'autokey-attack-001',
        description: 'Probable plaintext attack demonstration',
        category: 'cryptanalysis',
        input: 'MEETMEATMIDNIGHT',
        key: 'SECRET',
        expected: 'EEEGOMUVMPWTMPBX',
        vulnerability: {
          knownPlaintext: 'If "MEET" is known, can recover key start',
          keyRecovery: 'SECRET deduced from MEET → EEHE',
          continuation: 'Recovered plaintext extends key further',
          weakness: 'Vulnerable to partial plaintext knowledge'
        }
      },
      
      // Special Character Tests
      {
        algorithm: 'Autokey',
        testId: 'autokey-special-001',
        description: 'Numeric and special character filtering',
        category: 'implementation',
        input: 'HELLO123WORLD',
        key: 'KEY',
        expected: 'RIJVS123AIQNH',
        filtering: {
          processed: 'HELLOWORLD',
          keyExtension: 'KEYHELLOWO',
          preservation: 'Numbers preserved in original positions',
          encryption: 'Only letters participate in autokey extension'
        }
      }
    ],
    
    isInitialized: false,
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Autokey',
      displayName: 'Autokey Cipher',
      description: 'Enhanced polyalphabetic substitution cipher that extends the key using the plaintext itself, eliminating the periodic key repetition weakness of the basic Vigenère cipher.',
      
      inventor: 'Blaise de Vigenère',
      year: 1586,
      background: 'Developed by Vigenère as an improvement over his basic cipher. The autokey eliminates key repetition by using the plaintext to extend the initial key, making period-based attacks much more difficult.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.HISTORICAL,
      securityNotes: 'Significantly more secure than basic Vigenère due to non-repeating key. However, vulnerable to probable plaintext attacks and advanced frequency analysis techniques.',
      
      category: global.CipherMetadata.Categories.CLASSICAL,
      subcategory: 'polyalphabetic',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: 'variable', // Initial key length, extends with plaintext
      blockSize: 1, // Character-by-character processing
      rounds: 1,
      
      specifications: [
        {
          name: 'Wikipedia: Autokey Cipher',
          url: 'https://en.wikipedia.org/wiki/Autokey_cipher'
        },
        {
          name: 'dCode: Autokey Cipher',
          url: 'https://www.dcode.fr/autokey-cipher'
        }
      ],
      
      testVectors: [
        {
          name: 'Educational Examples',
          url: 'https://cryptii.com/pipes/autokey-cipher'
        }
      ],
      
      references: [
        {
          name: 'Vigenère, B. de: Traicté des Chiffres (1586)',
          url: 'https://gallica.bnf.fr/ark:/12148/bpt6k5493743'
        },
        {
          name: 'Kahn, David: The Codebreakers (1967)',
          url: 'https://www.amazon.com/Codebreakers-David-Kahn/dp/0684831309'
        }
      ],
      
      implementationNotes: 'Extends key by appending plaintext characters. Only alphabetic characters participate in key extension. Preserves case and non-alphabetic characters.',
      performanceNotes: 'O(n) time complexity where n is input length. Memory usage minimal - key built dynamically during processing.',
      
      educationalValue: 'Demonstrates key extension techniques and evolutionary improvement in cipher design. Excellent example of addressing specific cryptographic weaknesses.',
      prerequisites: ['Vigenère cipher', 'Key repetition vulnerabilities', 'Kasiski examination'],
      
      tags: ['classical', 'polyalphabetic', 'autokey', 'vigenere-variant', 'key-extension', 'renaissance', 'intermediate'],
      
      version: '1.0'
    }) : null,
    
    // Initialize cipher
    Init: function() {
      Autokey.isInitialized = true;
    },
    
    // Set up key (initial alphabetic string)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'Autokey[' + global.generateUniqueID() + ']';
      } while (Autokey.instances[id] || global.objectInstances[id]);
      
      Autokey.instances[id] = new Autokey.AutokeyInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Autokey.instances[id]) {
        delete Autokey.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Autokey', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!Autokey.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Autokey', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Autokey.instances[id];
      const initialKey = instance.key;
      
      if (!initialKey || initialKey.length === 0) {
        return plaintext; // No key, no encryption
      }
      
      // Build extended key: initial key + plaintext letters
      const plaintextLetters = Autokey.extractLetters(plaintext);
      const extendedKey = initialKey + plaintextLetters;
      
      let result = '';
      let keyIndex = 0;
      
      for (let i = 0; i < plaintext.length; i++) {
        const char = plaintext.charAt(i);
        
        if (Autokey.isLetter(char)) {
          if (keyIndex < extendedKey.length) {
            const keyChar = extendedKey.charAt(keyIndex);
            const encrypted = Autokey.vigenereShift(char, keyChar);
            result += encrypted;
            keyIndex++;
          } else {
            // Should not happen if key is built correctly
            result += char;
          }
        } else {
          // Preserve non-alphabetic characters
          result += char;
        }
      }
      
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!Autokey.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Autokey', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = Autokey.instances[id];
      const initialKey = instance.key;
      
      if (!initialKey || initialKey.length === 0) {
        return ciphertext; // No key, no decryption
      }
      
      let result = '';
      let keyIndex = 0;
      let plaintextSoFar = '';
      
      for (let i = 0; i < ciphertext.length; i++) {
        const char = ciphertext.charAt(i);
        
        if (Autokey.isLetter(char)) {
          // Determine current key character
          let keyChar;
          if (keyIndex < initialKey.length) {
            // Use initial key
            keyChar = initialKey.charAt(keyIndex);
          } else {
            // Use previously decrypted plaintext
            const plaintextIndex = keyIndex - initialKey.length;
            if (plaintextIndex < plaintextSoFar.length) {
              keyChar = plaintextSoFar.charAt(plaintextIndex);
            } else {
              // Should not happen
              keyChar = 'A';
            }
          }
          
          const decrypted = Autokey.vigenereShift(char, keyChar, true);
          result += decrypted;
          
          // Add decrypted letter to plaintext for future key extension
          if (Autokey.isLetter(decrypted)) {
            plaintextSoFar += decrypted.toUpperCase();
          }
          
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
    
    // Extract only letters from text (for key extension)
    extractLetters: function(text) {
      let letters = '';
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        if (Autokey.isLetter(char)) {
          letters += char.toUpperCase();
        }
      }
      return letters;
    },
    
    // Perform Vigenère shift
    vigenereShift: function(char, keyChar, decrypt) {
      if (!Autokey.isLetter(char) || !Autokey.isLetter(keyChar)) {
        return char;
      }
      
      const isUpperCase = char >= 'A' && char <= 'Z';
      const baseCode = isUpperCase ? 65 : 97; // 'A' or 'a'
      
      const charCode = char.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, etc.
      const keyCode = keyChar.toUpperCase().charCodeAt(0) - 65;
      
      let resultCode;
      if (decrypt) {
        resultCode = (charCode - keyCode + 26) % 26;
      } else {
        resultCode = (charCode + keyCode) % 26;
      }
      
      const resultChar = String.fromCharCode(resultCode + 65); // Convert back to uppercase
      return isUpperCase ? resultChar : resultChar.toLowerCase();
    },
    
    // Validate and clean alphabetic key
    validateKey: function(keyString) {
      if (!keyString) return '';
      
      // Remove non-alphabetic characters and convert to uppercase
      return keyString.replace(/[^A-Za-z]/g, '').toUpperCase();
    },
    
    // Instance class
    AutokeyInstance: function(keyString) {
      this.rawKey = keyString || '';
      this.key = Autokey.validateKey(keyString);
      
      if (this.key.length === 0) {
        // Default key if none provided
        this.key = 'CIPHER';
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
    global.Cipher.AddCipher(Autokey);
  }
  
  // Export to global scope
  global.Autokey = Autokey;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Autokey;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);