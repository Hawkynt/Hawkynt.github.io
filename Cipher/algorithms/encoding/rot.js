/*
 * Universal ROT13 Cipher
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('ROT13 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create ROT13 cipher object
  const ROT13 = {
    // Required metadata per CONTRIBUTING.md
    name: "ROT13",
    description: "Simple letter substitution cipher that replaces each letter with the letter 13 positions after it in the alphabet. ROT13 is its own inverse - applying ROT13 twice returns the original text.",
    inventor: "Unknown (folklore origin)",
    year: 1980,
    country: null,
    category: "encodingScheme",
    subCategory: "Text Encoding",
    securityStatus: "educational",
    securityNotes: "Provides no security - trivially broken. Used for spoiler text and simple obfuscation. Educational purposes only.",
    
    documentation: [
      {text: "ROT13 - Wikipedia", uri: "https://en.wikipedia.org/wiki/ROT13"},
      {text: "Caesar Cipher Family", uri: "https://en.wikipedia.org/wiki/Caesar_cipher"},
      {text: "Usenet ROT13 Usage", uri: "https://tools.ietf.org/html/rfc1036#section-5.2"}
    ],
    
    references: [
      {text: "UNIX tr Command Examples", uri: "https://www.gnu.org/software/coreutils/manual/html_node/tr-invocation.html"},
      {text: "Python ROT13 Codec", uri: "https://docs.python.org/3/library/codecs.html#text-encodings"},
      {text: "Educational Cryptography Examples", uri: "https://cryptomuseum.com/crypto/usa/rot13/index.htm"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Frequency Analysis",
        text: "Letter frequencies remain unchanged, making it vulnerable to basic frequency analysis attacks",
        mitigation: "Do not use for any security purposes"
      }
    ],
    
    tests: [
      {
        text: "Basic uppercase test",
        uri: "https://en.wikipedia.org/wiki/ROT13#Example",
        input: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("HELLO") : "HELLO".split('').map(c => c.charCodeAt(0)),
        expected: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("URYYB") : "URYYB".split('').map(c => c.charCodeAt(0))
      },
      {
        text: "Basic lowercase test",
        uri: "Educational standard",
        input: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("hello") : "hello".split('').map(c => c.charCodeAt(0)),
        expected: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("uryyb") : "uryyb".split('').map(c => c.charCodeAt(0))
      },
      {
        text: "Wikipedia mixed case example",
        uri: "https://en.wikipedia.org/wiki/ROT13#Example",
        input: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("To get to the other side!") : "To get to the other side!".split('').map(c => c.charCodeAt(0)),
        expected: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("Gb trg gb gur bgure fvqr!") : "Gb trg gb gur bgure fvqr!".split('').map(c => c.charCodeAt(0))
      },
      {
        text: "First half alphabet transformation",
        uri: "Educational validation",
        input: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("ABCDEFGHIJKLM") : "ABCDEFGHIJKLM".split('').map(c => c.charCodeAt(0)),
        expected: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("NOPQRSTUVWXYZ") : "NOPQRSTUVWXYZ".split('').map(c => c.charCodeAt(0))
      }
    ],

    // Legacy interface properties for compatibility
    internalName: 'ROT13',
    comment: 'ROT13 cipher - rotates letters by 13 positions',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},

    // Legacy test vectors for compatibility
    testVectors: [
      {
        "input": "HELLO",
        "key": "",
        "expected": "URYYB",
        "description": "ROT13 uppercase test"
      },
      {
        "input": "hello",
        "key": "",
        "expected": "uryyb",
        "description": "ROT13 lowercase test"
      },
      {
        "input": "To get to the other side!",
        "key": "",
        "expected": "Gb trg gb gur bgure fvqr!",
        "description": "Wikipedia ROT13 example"
      },
      {
        "input": "ABCDEFGHIJKLM",
        "key": "",
        "expected": "NOPQRSTUVWXYZ",
        "description": "First half alphabet"
      },
      {
        "input": "NOPQRSTUVWXYZ",
        "key": "",
        "expected": "ABCDEFGHIJKLM",
        "description": "Second half alphabet"
      }
    ],
    cantDecode: false,
    isInitialized: false,
    
    // Character sets
    UPPERCASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    LOWERCASE: 'abcdefghijklmnopqrstuvwxyz',
    
    // Initialize cipher
    Init: function() {
      ROT13.isInitialized = true;
    },
    
    // Set up key (ROT13 doesn't use keys)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'ROT13[' + global.generateUniqueID() + ']';
      } while (ROT13.instances[id] || global.objectInstances[id]);
      
      ROT13.instances[id] = new ROT13.Rot13Instance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (ROT13.instances[id]) {
        delete ROT13.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'ROT13', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (ROT13 is symmetric - encrypt and decrypt are the same)
    encryptBlock: function(id, plaintext) {
      if (!ROT13.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'ROT13', 'encryptBlock');
        return plaintext;
      }
      
      return ROT13.transform(plaintext);
    },
    
    // Decrypt block (same as encrypt for ROT13)
    decryptBlock: function(id, ciphertext) {
      if (!ROT13.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'ROT13', 'decryptBlock');
        return ciphertext;
      }
      
      return ROT13.transform(ciphertext);
    },
    
    // Transform text using ROT13
    transform: function(text) {
      let result = '';
      
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        
        // Handle uppercase letters
        const upperIndex = ROT13.UPPERCASE.indexOf(char);
        if (upperIndex !== -1) {
          result += ROT13.UPPERCASE.charAt((upperIndex + 13) % 26);
        }
        // Handle lowercase letters
        else {
          const lowerIndex = ROT13.LOWERCASE.indexOf(char);
          if (lowerIndex !== -1) {
            result += ROT13.LOWERCASE.charAt((lowerIndex + 13) % 26);
          }
          // Non-alphabetic characters pass through unchanged
          else {
            result += char;
          }
        }
      }
      
      return result;
    },
    
    // Instance class
    Rot13Instance: function(key) {
      this.key = key || '';
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(ROT13);
  }
  
  // Export to global scope
  global.ROT13 = ROT13;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ROT13;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);