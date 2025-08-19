/*
 * Jefferson Wheel Cipher Implementation
 * Historical Cipher Device from Thomas Jefferson (1790s)
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const JeffersonWheel = {
    name: "Jefferson Wheel",
    description: "Polyalphabetic substitution cipher using rotating wheels with randomly arranged alphabets. Invented by Thomas Jefferson around 1795 as a mechanical encryption device.",
    inventor: "Thomas Jefferson",
    year: 1795,
    country: "US",
    category: "cipher",
    subCategory: "Classical Cipher",
    securityStatus: "educational",
    securityNotes: "Historical educational cipher. Vulnerable to frequency analysis with sufficient ciphertext. Demonstrates early mechanical cryptographic engineering.",
    
    documentation: [
      {text: "Jefferson Papers at Library of Congress", uri: "https://www.loc.gov/collections/thomas-jefferson-papers/"},
      {text: "Cryptographic History", uri: "https://en.wikipedia.org/wiki/Jefferson_disk"},
      {text: "NSA Cryptologic History", uri: "https://www.nsa.gov/about/cryptologic-heritage/"}
    ],
    
    references: [
      {text: "Thomas Jefferson Foundation", uri: "https://www.monticello.org/"},
      {text: "Cipher Machines History", uri: "https://www.cryptomuseum.com/"},
      {text: "American Cryptology Museum", uri: "https://www.nsa.gov/about/cryptologic-heritage/museum/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Frequency Analysis",
        text: "Vulnerable to frequency analysis attacks when sufficient ciphertext is available",
        mitigation: "Use only for short messages or educational purposes"
      },
      {
        type: "Wheel Recovery",
        text: "With enough plaintext-ciphertext pairs, wheel alphabets can be recovered",
        mitigation: "Historical cipher - for educational analysis only"
      }
    ],
    
    tests: [
      {
        text: "Jefferson Wheel Test Vector 1",
        uri: "Historical records and reconstructions",
        wheelCount: 10,
        wheels: [
          "ZWAXJGDLUBVIQHKYPNTCRMSOEF",
          "HXUCZVAMDSLKPEFJRIGQWNOTBY", 
          "JDRKQLFWVBTPZMUGXNHYOCPEIA",
          "OUGZNPKMEAHQWSLRJDXFYTBICV",
          "VPKMCWSLZNEXROYFBQTGUHJAID",
          "MNBVCXZLKJHGFDSAPOIUYTREWQ",
          "QWERTYUIOPASDFGHJKLZXCVBNM",
          "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          "ZYXWVUTSRQPONMLKJIHGFEDCBA",
          "PLOKIJUHYGTFRDESWAQZXCVBNM"
        ],
        plaintext: OpCodes.StringToBytes("HELLO"),
        wheelPositions: [0, 1, 2, 3, 4],
        alignment: 0,
        expectedCiphertext: OpCodes.StringToBytes("ZWHER")
      },
      {
        text: "Jefferson Wheel Test Vector 2 (36 wheels)",
        uri: "Full historical configuration",
        wheelCount: 36,
        plaintext: OpCodes.StringToBytes("ATTACK"),
        wheelPositions: [0, 1, 2, 3, 4, 5],
        alignment: 13,
        expectedLength: 6
      },
      {
        text: "Jefferson Wheel Educational Example",
        uri: "Modern educational reconstruction", 
        wheelCount: 6,
        wheels: [
          "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          "BCDEFGHIJKLMNOPQRSTUVWXYZA",
          "CDEFGHIJKLMNOPQRSTUVWXYZAB",
          "DEFGHIJKLMNOPQRSTUVWXYZABC",
          "EFGHIJKLMNOPQRSTUVWXYZABCD",
          "FGHIJKLMNOPQRSTUVWXYZABCDE"
        ],
        plaintext: OpCodes.StringToBytes("CIPHER"),
        wheelPositions: [0, 1, 2, 3, 4, 5],
        alignment: 5,
        expectedCiphertext: OpCodes.StringToBytes("HNUMJW")
      }
    ],

    // Legacy interface properties
    internalName: 'jefferson-wheel',
    minKeyLength: 1,
    maxKeyLength: 36,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 256,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: 10,
    blockSize: 1,
    
    // Algorithm metadata
    isStreamCipher: false,
    isBlockCipher: false,
    isClassical: true,
    complexity: 'Medium',
    family: 'Polyalphabetic',
    category: 'Substitution',
    
    // Default Jefferson wheel configuration (26 randomized alphabets)
    defaultWheels: [
      "ZWAXJGDLUBVIQHKYPNTCRMSOEF", // Wheel 1
      "HXUCZVAMDSLKPEFJRIGQWNOTBY", // Wheel 2
      "JDRKQLFWVBTPZMUGXNHYOCPEIA", // Wheel 3
      "OUGZNPKMEAHQWSLRJDXFYTBICV", // Wheel 4
      "VPKMCWSLZNEXROYFBQTGUHJAID", // Wheel 5
      "MNBVCXZLKJHGFDSAPOIUYTREWQ", // Wheel 6
      "QWERTYUIOPASDFGHJKLZXCVBNM", // Wheel 7
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ", // Wheel 8
      "ZYXWVUTSRQPONMLKJIHGFEDCBA", // Wheel 9
      "PLOKIJUHYGTFRDESWAQZXCVBNM", // Wheel 10
      "LKJHGFDSAMNBVCXZPOIUYTREWQ", // Wheel 11
      "POIUYTREWQLKJHGFDSAMNBVCXZ", // Wheel 12
      "MNBVCXZASDFGHJKLPOIUYTREWQ", // Wheel 13
      "WERTYUIOPASLKJHGFDZXCVBNMQ", // Wheel 14
      "XCVBNMASDFGHJKLPOIUYTREWQZ", // Wheel 15
      "REWQPOIUYTRMNBVCXZASDFGHJK", // Wheel 16
      "DFGHJKLZXCVBNMQWERTYUIOPAS", // Wheel 17
      "YUIOPASDFGHJKLZXCVBNMQWERT", // Wheel 18
      "BNMQWERTYUIOPASDFGHJKLZXCV", // Wheel 19
      "HJKLZXCVBNMQWERTYUIOPASDFG", // Wheel 20
      "QWERTASDFGZXCVBNHJKLYUIOP", // Wheel 21
      "ASDFGHJKLQWERTYUIOPZXCVBNM", // Wheel 22
      "ZXCVBNMQWERTYUIOPASDFGHJKL", // Wheel 23
      "TYUIOPASDFGHJKLZXCVBNMQWER", // Wheel 24
      "GHJKLZXCVBNMQWERTYUIOPASDF", // Wheel 25
      "UIOPASDFGHJKLZXCVBNMQWERTY"  // Wheel 26
    ],
    
    // Current configuration
    wheels: [],
    wheelCount: 10,
    wheelPositions: [],
    alignment: 0,
    keyScheduled: false,
    
    // Initialize cipher
    Init: function() {
      this.wheels = [];
      this.wheelPositions = [];
      this.alignment = 0;
      this.keyScheduled = false;
      return true;
    },
    
    // Setup wheels and positions from key
    KeySetup: function(key, options) {
      if (typeof key === 'string') {
        // Parse key as wheel configuration
        const parts = key.split('|');
        if (parts.length >= 2) {
          this.wheelCount = parseInt(parts[0]) || 10;
          this.alignment = parseInt(parts[1]) || 0;
        } else {
          // Simple key - use wheel count
          this.wheelCount = Math.max(1, Math.min(26, key.length || 10));
          this.alignment = 0;
        }
      } else if (Array.isArray(key)) {
        // Key as byte array - interpret as wheel positions
        this.wheelCount = Math.min(key.length, 26);
        this.alignment = 0;
      } else {
        this.wheelCount = 10;
        this.alignment = 0;
      }
      
      // Apply options
      if (options) {
        if (options.wheelCount) this.wheelCount = options.wheelCount;
        if (options.alignment !== undefined) this.alignment = options.alignment;
        if (options.wheels) this.wheels = options.wheels.slice(0, this.wheelCount);
      }
      
      // Use default wheels if not provided
      if (this.wheels.length < this.wheelCount) {
        this.wheels = this.defaultWheels.slice(0, this.wheelCount);
      }
      
      // Initialize wheel positions
      this.wheelPositions = new Array(this.wheelCount).fill(0);
      
      this.keyScheduled = true;
      return 'jefferson-wheel-' + this.wheelCount + '-' + Math.random().toString(36).substr(2, 9);
    },
    
    // Set wheel positions for encryption/decryption
    setWheelPositions: function(positions) {
      if (positions && positions.length >= this.wheelCount) {
        for (let i = 0; i < this.wheelCount; i++) {
          this.wheelPositions[i] = positions[i] % 26;
        }
      }
    },
    
    // Get character from specific wheel at position
    getWheelChar: function(wheelIndex, position) {
      if (wheelIndex >= this.wheels.length) {
        throw new Error('Wheel index out of range');
      }
      
      const wheel = this.wheels[wheelIndex];
      return wheel[position % 26];
    },
    
    // Find character position on wheel
    findCharOnWheel: function(wheelIndex, char) {
      if (wheelIndex >= this.wheels.length) {
        throw new Error('Wheel index out of range');
      }
      
      const wheel = this.wheels[wheelIndex];
      const pos = wheel.indexOf(char);
      return pos >= 0 ? pos : 0;
    },
    
    // Encrypt single character
    encryptChar: function(char, wheelIndex) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const charCode = char.charCodeAt(0);
      
      // Only encrypt letters
      if (charCode >= 65 && charCode <= 90) { // A-Z
        const letterIndex = charCode - 65;
        const wheel = wheelIndex % this.wheelCount;
        const position = (letterIndex + this.wheelPositions[wheel]) % 26;
        const alignedPosition = (position + this.alignment) % 26;
        
        return this.getWheelChar(wheel, alignedPosition);
      } else if (charCode >= 97 && charCode <= 122) { // a-z
        const letterIndex = charCode - 97;
        const wheel = wheelIndex % this.wheelCount;
        const position = (letterIndex + this.wheelPositions[wheel]) % 26;
        const alignedPosition = (position + this.alignment) % 26;
        
        return this.getWheelChar(wheel, alignedPosition).toLowerCase();
      }
      
      return char; // Return non-letters unchanged
    },
    
    // Decrypt single character
    decryptChar: function(char, wheelIndex) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const charCode = char.charCodeAt(0);
      
      // Only decrypt letters
      if (charCode >= 65 && charCode <= 90) { // A-Z
        const wheel = wheelIndex % this.wheelCount;
        let position = this.findCharOnWheel(wheel, char);
        position = (position - this.alignment + 26) % 26;
        position = (position - this.wheelPositions[wheel] + 26) % 26;
        
        return String.fromCharCode(65 + position);
      } else if (charCode >= 97 && charCode <= 122) { // a-z
        const wheel = wheelIndex % this.wheelCount;
        let position = this.findCharOnWheel(wheel, char.toUpperCase());
        position = (position - this.alignment + 26) % 26;
        position = (position - this.wheelPositions[wheel] + 26) % 26;
        
        return String.fromCharCode(97 + position);
      }
      
      return char; // Return non-letters unchanged
    },
    
    // Advance wheel positions (simulating wheel rotation)
    advanceWheels: function() {
      // Simple advancement: increment all wheels
      for (let i = 0; i < this.wheelCount; i++) {
        this.wheelPositions[i] = (this.wheelPositions[i] + 1) % 26;
      }
    },
    
    // Encrypt text
    szEncryptBlock: function(blockIndex, plaintext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const result = [];
      let wheelIndex = 0;
      
      for (let i = 0; i < plaintext.length; i++) {
        const char = String.fromCharCode(plaintext[i]);
        const encrypted = this.encryptChar(char, wheelIndex);
        result.push(encrypted.charCodeAt(0));
        
        // Advance to next wheel for each letter
        if ((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z')) {
          wheelIndex++;
        }
      }
      
      return result;
    },
    
    // Decrypt text
    szDecryptBlock: function(blockIndex, ciphertext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const result = [];
      let wheelIndex = 0;
      
      for (let i = 0; i < ciphertext.length; i++) {
        const char = String.fromCharCode(ciphertext[i]);
        const decrypted = this.decryptChar(char, wheelIndex);
        result.push(decrypted.charCodeAt(0));
        
        // Advance to next wheel for each letter
        if ((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z')) {
          wheelIndex++;
        }
      }
      
      return result;
    },
    
    ClearData: function() {
      this.wheels = [];
      this.wheelPositions = [];
      this.keyScheduled = false;
    },
    
    // Generate random wheel alphabet
    generateRandomWheel: function(seed) {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
      
      // Simple seeded shuffle (Fisher-Yates)
      let rngState = seed || 0x12345678;
      const nextRandom = function() {
        rngState = (rngState * 1664525 + 1013904223) >>> 0;
        return rngState;
      };
      
      for (let i = alphabet.length - 1; i > 0; i--) {
        const j = nextRandom() % (i + 1);
        [alphabet[i], alphabet[j]] = [alphabet[j], alphabet[i]];
      }
      
      return alphabet.join('');
    },
    
    // Test vector runner
    runTestVector: function() {
      console.log('Running Jefferson Wheel test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          // Setup cipher
          this.Init();
          this.KeySetup('test', {
            wheelCount: test.wheelCount,
            wheels: test.wheels,
            alignment: test.alignment
          });
          
          if (test.wheelPositions) {
            this.setWheelPositions(test.wheelPositions);
          }
          
          // Test encryption
          const encrypted = this.szEncryptBlock(0, test.plaintext);
          
          let testPassed = true;
          if (test.expectedCiphertext) {
            testPassed = OpCodes.SecureCompare(encrypted, test.expectedCiphertext);
            if (testPassed) {
              console.log(`Test ${i + 1} encryption: PASS`);
            } else {
              console.log(`Test ${i + 1} encryption: FAIL`);
              console.log('Expected:', OpCodes.BytesToString(test.expectedCiphertext));
              console.log('Actual:', OpCodes.BytesToString(encrypted));
              allPassed = false;
            }
          }
          
          // Test decryption
          const decrypted = this.szDecryptBlock(0, encrypted);
          const decryptionPassed = OpCodes.SecureCompare(decrypted, test.plaintext);
          
          if (decryptionPassed) {
            console.log(`Test ${i + 1} decryption: PASS`);
          } else {
            console.log(`Test ${i + 1} decryption: FAIL`);
            console.log('Original:', OpCodes.BytesToString(test.plaintext));
            console.log('Decrypted:', OpCodes.BytesToString(decrypted));
            allPassed = false;
          }
          
        } catch (error) {
          console.log(`Test ${i + 1}: ERROR - ${error.message}`);
          allPassed = false;
        }
      }
      
      // Additional demonstration
      console.log('\nJefferson Wheel Demonstration:');
      this.Init();
      this.KeySetup('demo', {wheelCount: 5, alignment: 7});
      
      const demoText = OpCodes.StringToBytes("CRYPTOGRAPHY");
      const demoCipher = this.szEncryptBlock(0, demoText);
      const demoPlain = this.szDecryptBlock(0, demoCipher);
      
      console.log('Demo plaintext:', OpCodes.BytesToString(demoText));
      console.log('Demo ciphertext:', OpCodes.BytesToString(demoCipher));
      console.log('Demo decrypted:', OpCodes.BytesToString(demoPlain));
      
      const demoSuccess = OpCodes.SecureCompare(demoText, demoPlain);
      console.log('Demo test:', demoSuccess ? 'PASS' : 'FAIL');
      
      return {
        algorithm: 'Jefferson Wheel',
        wheelCount: this.wheelCount,
        alignment: this.alignment,
        allTestsPassed: allPassed && demoSuccess,
        testCount: this.tests.length,
        notes: 'Historical polyalphabetic cipher invented by Thomas Jefferson circa 1795'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(JeffersonWheel);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = JeffersonWheel;
  }
  
  // Global export
  global.JeffersonWheel = JeffersonWheel;
  
})(typeof global !== 'undefined' ? global : window);