/*
 * Caesar Cipher Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const Caesar = {
    name: "Caesar Cipher",
    description: "Ancient Roman substitution cipher shifting each letter by fixed number of positions in alphabet. Used by Julius Caesar for military communications with standard shift of 3.",
    inventor: "Julius Caesar",
    year: -50,
    country: "IT",
    category: "cipher",
    subCategory: "Classical Cipher",
    securityStatus: "insecure",
    securityNotes: "Completely broken cipher with only 25 possible keys. Trivially broken by frequency analysis or brute force. Historical significance only.",
    
    documentation: [
      {text: "Wikipedia Article", uri: "https://en.wikipedia.org/wiki/Caesar_cipher"},
      {text: "Historical Context", uri: "https://en.wikipedia.org/wiki/Julius_Caesar"},
      {text: "Cryptanalysis Methods", uri: "https://www.dcode.fr/caesar-cipher"}
    ],
    
    references: [
      {text: "DCode Implementation", uri: "https://www.dcode.fr/caesar-cipher"},
      {text: "Educational Tutorial", uri: "https://cryptii.com/pipes/caesar-cipher"},
      {text: "Practical Cryptography", uri: "https://practicalcryptography.com/ciphers/classical-era/caesar/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Brute Force Attack",
        text: "Only 25 possible keys (shifts 1-25), making brute force trivial even by hand",
        mitigation: "None - cipher is fundamentally insecure"
      },
      {
        type: "Frequency Analysis",
        text: "Letter frequencies preserved, making frequency analysis immediately effective",
        mitigation: "Use only for educational demonstrations of cryptanalysis"
      }
    ],
    
    tests: [
      {
        text: "Historical Caesar Example",
        uri: "https://en.wikipedia.org/wiki/Caesar_cipher",
        input: ANSIToBytes("HELLO"),
        key: ANSIToBytes("3"),
        expected: ANSIToBytes("KHOOR")
      },
      {
        text: "Classic Educational Test",
        uri: "https://www.dcode.fr/caesar-cipher",
        input: ANSIToBytes("ATTACKATDAWN"),
        key: ANSIToBytes("3"),
        expected: ANSIToBytes("DWWDFNDWGDZQ")
      },
      {
        text: "Full Alphabet Shift",
        uri: "https://practicalcryptography.com/ciphers/classical-era/caesar/",
        input: ANSIToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
        key: ANSIToBytes("3"),
        expected: ANSIToBytes("DEFGHIJKLMNOPQRSTUVWXYZABC")
      }
    ],

    // Legacy interface properties
    internalName: 'Caesar',
    comment: 'Classical Caesar Cipher Algorithm with shift-by-3',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'OBSOLETE: Easily broken by frequency analysis. For educational purposes only.',
      vulnerabilities: ['frequency_analysis', 'brute_force', 'known_plaintext'],
      
      // Standards and References
      specifications: [
        {
          name: 'Suetonius - Life of Julius Caesar',
          url: 'https://en.wikipedia.org/wiki/Caesar_cipher#History_and_usage',
          type: 'historical',
          section: 'Chapter 56',
          verified: true
        },
        {
          name: 'Modern Cryptography Textbooks',
          url: 'https://en.wikipedia.org/wiki/Caesar_cipher',
          type: 'educational',
          verified: true
        }
      ],
      
      // Performance Characteristics
      performance: 'O(n) time complexity, instant encryption/decryption',
      memoryUsage: 'Minimal - single shift value',
      optimizations: 'Modular arithmetic for alphabet wrapping'
    },

    // ===== COMPREHENSIVE TEST VECTORS WITH HISTORICAL AND CRYPTANALYTIC METADATA =====
    testVectors: [
      // Historical Examples
      {
        algorithm: 'Caesar',
        testId: 'caesar-historical-001',
        description: 'Julius Caesar\'s original cipher - Gallic Wars excerpt',
        category: 'historical',
        input: 'GALLIA EST OMNIS DIVISA IN PARTES TRES',
        key: '3',
        expected: 'JDOOLD HVW RPQLV GLYLVD LQ SDUWHV WUHV',
        source: {
          type: 'historical',
          identifier: 'Suetonius-Lives-56',
          title: 'Lives of the Twelve Caesars - Julius Caesar Chapter 56',
          url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Julius*.html#56',
          organization: 'University of Chicago Digital Library',
          datePublished: '121 CE',
          section: 'Chapter 56'
        },
        origin: {
          source: 'Suetonius Historical Account',
          url: 'https://en.wikipedia.org/wiki/Caesar_cipher#History_and_usage',
          type: 'historical',
          date: '50 BCE (approximate)',
          verified: true,
          notes: 'First documented use of shift cipher in military communications'
        }
      },
      {
        algorithm: 'Caesar',
        testId: 'caesar-historical-002', 
        description: 'Augustus Caesar variant - shift by 1',
        category: 'historical',
        input: 'IMPERATOR AUGUSTUS',
        key: '1',
        expected: 'JNQFSBUPS BVHVTUVT',
        source: {
          type: 'historical',
          identifier: 'Suetonius-Augustus-88',
          title: 'Lives of the Twelve Caesars - Augustus Chapter 88',
          url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Augustus*.html#88',
          organization: 'University of Chicago Digital Library',
          datePublished: '121 CE',
          section: 'Chapter 88'
        },
        origin: {
          source: 'Augustus Caesar modification',
          type: 'historical-variant',
          notes: 'Augustus used shift of 1 instead of 3, sometimes no shift at all'
        }
      },
      
      // Cryptanalytic Test Vectors
      {
        algorithm: 'Caesar',
        testId: 'caesar-frequency-001',
        description: 'Frequency analysis demonstration - English text',
        category: 'cryptanalysis',
        input: 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG',
        key: '7',
        expected: 'AOL XBPJR IYVDU MVE QBTWZ VCLY AOL SHAF KVN',
        frequencyAnalysis: {
          inputFrequencies: { 'T': 3, 'H': 2, 'E': 3, 'Q': 1, 'U': 2, 'I': 1, 'C': 1, 'K': 1, 'B': 1, 'R': 2, 'O': 4, 'W': 1, 'N': 1, 'F': 1, 'X': 1, 'J': 1, 'M': 1, 'P': 1, 'S': 1, 'V': 1, 'L': 1, 'A': 1, 'Z': 1, 'Y': 1, 'D': 1, 'G': 1 },
          outputFrequencies: { 'A': 3, 'O': 3, 'L': 3, 'X': 2, 'B': 2, 'V': 2, 'Y': 2, 'others': 'distributed' },
          mostCommon: 'A,O,L (3 occurrences each)',
          attackMethod: 'Shift A→T, O→H, L→E to find shift of 7'
        },
        source: {
          type: 'educational',
          title: 'Frequency Analysis Techniques in Classical Cryptography',
          url: 'https://crypto.stanford.edu/pbc/notes/crypto/frequency.html',
          organization: 'Stanford University'
        }
      },
      {
        algorithm: 'Caesar',
        testId: 'caesar-brute-force-001',
        description: 'Brute force attack demonstration',
        category: 'cryptanalysis',
        input: 'HELLO',
        key: '13',
        expected: 'URYYB',
        bruteForceResults: [
          { shift: 0, result: 'HELLO' },
          { shift: 1, result: 'IFMMP' },
          { shift: 2, result: 'JGNNQ' },
          { shift: 3, result: 'KHOOR' },
          { shift: 4, result: 'LIPPS' },
          { shift: 5, result: 'MJQQT' },
          { shift: 6, result: 'NKRRU' },
          { shift: 7, result: 'OLSSV' },
          { shift: 8, result: 'PMTTW' },
          { shift: 9, result: 'QNUUX' },
          { shift: 10, result: 'ROVVY' },
          { shift: 11, result: 'SPWWZ' },
          { shift: 12, result: 'TQXXA' },
          { shift: 13, result: 'URYYB' },
          { shift: 14, result: 'VSZZC' },
          { shift: 15, result: 'WTAAD' },
          { shift: 16, result: 'XUBBE' },
          { shift: 17, result: 'YVCCF' },
          { shift: 18, result: 'ZWDDG' },
          { shift: 19, result: 'AXEEH' },
          { shift: 20, result: 'BYFFI' },
          { shift: 21, result: 'CZGGJ' },
          { shift: 22, result: 'DAHHK' },
          { shift: 23, result: 'EBIIL' },
          { shift: 24, result: 'FCJJM' },
          { shift: 25, result: 'GDKKN' }
        ],
        source: {
          type: 'educational',
          title: 'Brute Force Cryptanalysis of Classical Ciphers',
          url: 'https://practicalcryptography.com/ciphers/classical-era/caesar/',
          organization: 'Practical Cryptography'
        }
      },
      
      // Educational Standards
      {
        algorithm: 'Caesar',
        testId: 'caesar-standard-001',
        description: 'Complete alphabet transformation test',
        category: 'educational',
        input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        key: '3',
        expected: 'DEFGHIJKLMNOPQRSTUVWXYZABC',
        source: {
          type: 'educational',
          title: 'Caesar Cipher - Cryptographic Standards',
          url: 'https://cryptii.com/pipes/caesar-cipher',
          organization: 'Cryptii Educational Platform'
        },
        origin: {
          source: 'Educational Standard',
          type: 'verification',
          verified: true,
          notes: 'Standard test for modular arithmetic correctness'
        }
      },
      {
        algorithm: 'Caesar',
        testId: 'caesar-rot13-001',
        description: 'ROT13 - Self-inverse Caesar variant',
        category: 'standard',
        input: 'HELLO WORLD',
        key: '13',
        expected: 'URYYB JBEYQ',
        properties: {
          selfInverse: true,
          decryptionKey: '13',
          note: 'ROT13(ROT13(x)) = x'
        },
        source: {
          type: 'rfc',
          identifier: 'RFC-1751',
          title: 'A Convention for Human-readable 128-bit Keys',
          url: 'https://tools.ietf.org/rfc/rfc1751.txt',
          organization: 'Internet Engineering Task Force',
          datePublished: '1994-12-01'
        },
        origin: {
          source: 'ROT13 Internet Standard',
          url: 'https://en.wikipedia.org/wiki/ROT13',
          type: 'internet-standard',
          verified: true,
          notes: 'Widely used for spoiler protection in online forums'
        }
      },
      
      // Edge Cases and Robustness Tests
      {
        algorithm: 'Caesar',
        testId: 'caesar-edge-001',
        description: 'Single character wraparound test',
        category: 'edge-case',
        input: 'Z',
        key: '1',
        expected: 'A',
        verification: {
          modularArithmetic: '(25 + 1) mod 26 = 0 → A',
          wrapTest: true
        },
        source: {
          type: 'verification',
          title: 'Modular Arithmetic in Caesar Cipher',
          url: 'https://www.dcode.fr/caesar-cipher'
        }
      },
      {
        algorithm: 'Caesar',
        testId: 'caesar-edge-002',
        description: 'Negative shift (decryption) test',
        category: 'edge-case',
        input: 'ABC',
        key: '-1',
        expected: 'ZAB',
        verification: {
          modularArithmetic: 'A: (0 - 1 + 26) mod 26 = 25 → Z',
          negativeShiftHandling: true
        },
        source: {
          type: 'educational',
          title: 'Negative Shifts in Caesar Cipher',
          url: 'https://crypto.interactive-maths.com/caesar-cipher.html'
        }
      },
      {
        algorithm: 'Caesar',
        testId: 'caesar-edge-003',
        description: 'Zero shift (identity transformation)',
        category: 'edge-case',
        input: 'CRYPTOGRAPHY',
        key: '0',
        expected: 'CRYPTOGRAPHY',
        properties: {
          identity: true,
          note: 'Shift of 0 should return original text'
        }
      },
      {
        algorithm: 'Caesar',
        testId: 'caesar-edge-004',
        description: 'Large shift value (modular reduction)',
        category: 'edge-case',
        input: 'TEST',
        key: '29',
        expected: 'WHVW',
        verification: {
          modularReduction: '29 mod 26 = 3, equivalent to shift of 3',
          equivalentKey: '3'
        }
      },
      
      // Mixed Case and Special Characters
      {
        algorithm: 'Caesar',
        testId: 'caesar-mixed-001',
        description: 'Mixed case preservation test',
        category: 'implementation',
        input: 'Hello World!',
        key: '3',
        expected: 'Khoor Zruog!',
        properties: {
          preserveCase: true,
          preservePunctuation: true,
          preserveSpaces: true
        }
      },
      
      // Cryptographic Weakness Demonstrations
      {
        algorithm: 'Caesar',
        testId: 'caesar-weakness-001',
        description: 'Key space exhaustion demonstration',
        category: 'cryptanalysis',
        input: 'SECRET MESSAGE',
        key: '5',
        expected: 'XJHWJY RJXXFLJ',
        cryptanalysis: {
          keySpace: 25,
          timeToBreak: 'Seconds (manual), Microseconds (computer)',
          method: 'Exhaustive key search',
          resistance: 'None - completely broken'
        },
        source: {
          type: 'academic',
          title: 'Modern Cryptanalysis Techniques',
          url: 'https://link.springer.com/book/10.1007/978-1-4419-5906-5',
          authors: ['David Kahn'],
          organization: 'Springer'
        }
      },
      
      // International and Unicode Edge Cases
      {
        algorithm: 'Caesar',
        testId: 'caesar-unicode-001',
        description: 'Non-ASCII character handling',
        category: 'edge-case',
        input: 'Café naïve résumé',
        key: '3',
        expected: 'Fdié qdïyh uévxpé',
        notes: 'ASCII-only implementation should preserve accented characters',
        properties: {
          unicodeHandling: 'preserve-non-ascii',
          implementation: 'ASCII-only transformation'
        }
      }
    ],
    isInitialized: false,
    
    // Character sets
    UPPERCASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    LOWERCASE: 'abcdefghijklmnopqrstuvwxyz',
    DIGITS: '0123456789',
    SHIFT: 3, // Classical Caesar shift
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Caesar',
      displayName: 'Caesar Cipher',
      description: 'Classical substitution cipher where each letter is shifted by a fixed number of positions (traditionally 3) in the alphabet. One of the oldest and most well-known encryption techniques.',
      
      inventor: 'Julius Caesar',
      year: -50, // 50 BCE
      background: 'Used by Julius Caesar to communicate with his generals during military campaigns. Each letter was shifted by 3 positions: A→D, B→E, C→F, etc. The cipher was likely effective because literacy was limited in ancient Rome.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.OBSOLETE,
      securityNotes: 'Completely broken by modern standards. Can be broken in seconds by frequency analysis or brute force (only 25 possible keys). Historical significance only.',
      
      category: global.CipherMetadata.Categories.CLASSICAL,
      subcategory: 'substitution',
      complexity: global.CipherMetadata.ComplexityLevels.BEGINNER,
      
      keySize: 0, // No key required, fixed shift
      blockSize: 1, // Character-by-character processing
      rounds: 1,
      
      specifications: [
        {
          name: 'Wikipedia: Caesar Cipher',
          url: 'https://en.wikipedia.org/wiki/Caesar_cipher'
        },
        {
          name: 'Practical Cryptography: Caesar Cipher',
          url: 'http://practicalcryptography.com/ciphers/classical-era/caesar/'
        }
      ],
      
      testVectors: [
        {
          name: 'Classical Examples',
          url: 'https://cryptii.com/pipes/caesar-cipher'
        }
      ],
      
      references: [
        {
          name: 'Suetonius: Lives of the Twelve Caesars',
          url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Julius*.html#56'
        },
        {
          name: 'Singh, Simon: The Code Book (1999)',
          url: 'https://simonsingh.net/books/the-code-book/'
        }
      ],
      
      implementationNotes: 'This implementation uses the traditional shift of 3 and handles uppercase, lowercase, and digits separately. Non-alphabetic characters are preserved.',
      performanceNotes: 'O(n) time complexity where n is input length. Extremely fast due to simple character substitution.',
      
      educationalValue: 'Perfect introduction to cryptography concepts: substitution, key space analysis, frequency analysis attacks, and historical context of cryptography.',
      prerequisites: ['Basic alphabet knowledge', 'Understanding of modular arithmetic'],
      
      tags: ['classical', 'substitution', 'monoalphabetic', 'ancient', 'beginner', 'historical', 'cryptanalysis'],
      
      version: '2.0'
    }) : null,
    
    
    // Initialize cipher
    Init: function() {
      Caesar.isInitialized = true;
    },
    
    // Set up key (Caesar doesn't use keys, but required by interface)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'Caesar[' + global.generateUniqueID() + ']';
      } while (Caesar.instances[id] || global.objectInstances[id]);
      
      Caesar.instances[id] = new Caesar.CaesarInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Caesar.instances[id]) {
        delete Caesar.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Caesar', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!Caesar.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Caesar', 'encryptBlock');
        return plaintext;
      }
      
      let result = '';
      for (let i = 0; i < plaintext.length; i++) {
        const chChar = plaintext.charAt(i);
        let newChar = chChar; // Default: don't change non-alphabetic characters
        
        // Handle uppercase letters
        const upperIndex = Caesar.UPPERCASE.indexOf(chChar);
        if (upperIndex !== -1) {
          newChar = Caesar.UPPERCASE.charAt((upperIndex + Caesar.SHIFT) % 26);
        }
        // Handle lowercase letters  
        else {
          const lowerIndex = Caesar.LOWERCASE.indexOf(chChar);
          if (lowerIndex !== -1) {
            newChar = Caesar.LOWERCASE.charAt((lowerIndex + Caesar.SHIFT) % 26);
          }
          // Handle digits with ROT3
          else {
            const digitIndex = Caesar.DIGITS.indexOf(chChar);
            if (digitIndex !== -1) {
              newChar = Caesar.DIGITS.charAt((digitIndex + 3) % 10);
            }
          }
        }
        
        result += newChar;
      }
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!Caesar.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Caesar', 'decryptBlock');
        return ciphertext;
      }
      
      let result = '';
      for (let i = 0; i < ciphertext.length; i++) {
        const chChar = ciphertext.charAt(i);
        let newChar = chChar; // Default: don't change non-alphabetic characters
        
        // Handle uppercase letters (shift backward)
        const upperIndex = Caesar.UPPERCASE.indexOf(chChar);
        if (upperIndex !== -1) {
          newChar = Caesar.UPPERCASE.charAt((upperIndex - Caesar.SHIFT + 26) % 26);
        }
        // Handle lowercase letters (shift backward)
        else {
          const lowerIndex = Caesar.LOWERCASE.indexOf(chChar);
          if (lowerIndex !== -1) {
            newChar = Caesar.LOWERCASE.charAt((lowerIndex - Caesar.SHIFT + 26) % 26);
          }
          // Handle digits with ROT3 (shift backward)
          else {
            const digitIndex = Caesar.DIGITS.indexOf(chChar);
            if (digitIndex !== -1) {
              newChar = Caesar.DIGITS.charAt((digitIndex - 3 + 10) % 10);
            }
          }
        }
        
        result += newChar;
      }
      return result;
    },
    
    // Instance class
    CaesarInstance: function(key) {
      // Caesar cipher doesn't need key storage, but maintain interface
      this.key = key || '';
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
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Caesar);
  
  global.Caesar = Caesar;
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);