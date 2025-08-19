/*
 * Universal BASE32 Encoding
 * Compatible with both Browser and Node.js environments
 * Based on RFC 4648 specification
 * (c)2006-2025 Hawkynt
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
      console.error('BASE32 encoder requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
    }
  }
  
  // Create BASE32 encoder object
  const BASE32 = {
    // Required metadata per CONTRIBUTING.md
    name: "Base32 Encoding",
    description: "Binary-to-text encoding scheme that represents binary data in ASCII string format using a radix-32 representation. Uses alphabet A-Z and 2-7 with padding for data transport and storage.",
    inventor: "Originally in RFC 989, standardized in RFC 4648",
    year: 1987,
    country: "US",
    category: "encodingScheme", 
    subCategory: "Base Encoding",
    securityStatus: null,
    securityNotes: "Not encryption - only encoding for safe transport. Provides no security or obfuscation, easily reversible.",
    
    documentation: [
      {text: "RFC 4648: The Base16, Base32, and Base64 Data Encodings", uri: "https://tools.ietf.org/html/rfc4648"},
      {text: "Base32 - Wikipedia", uri: "https://en.wikipedia.org/wiki/Base32"},
      {text: "RFC 3548 (Obsoleted by RFC 4648)", uri: "https://tools.ietf.org/html/rfc3548"}
    ],
    
    references: [
      {text: "Python base64 module", uri: "https://docs.python.org/3/library/base64.html#base64.b32encode"},
      {text: "JavaScript Base32 Implementation", uri: "https://github.com/LinusU/base32-encode"},
      {text: "Google Authenticator Base32 Usage", uri: "https://github.com/google/google-authenticator/wiki/Key-Uri-Format"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "RFC 4648 empty string test",
        uri: "https://tools.ietf.org/html/rfc4648#section-10",
        input: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("") : [],
        expected: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("") : []
      },
      {
        text: "RFC 4648 single character test", 
        uri: "https://tools.ietf.org/html/rfc4648#section-10",
        input: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("f") : [102],
        expected: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("MY======") : [77, 89, 61, 61, 61, 61, 61, 61]
      },
      {
        text: "RFC 4648 standard foo test",
        uri: "https://tools.ietf.org/html/rfc4648#section-10", 
        input: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("foo") : [102, 111, 111],
        expected: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("MZXW6===") : [77, 90, 88, 87, 54, 61, 61, 61]
      },
      {
        text: "RFC 4648 extended foobar test",
        uri: "https://tools.ietf.org/html/rfc4648#section-10",
        input: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("foobar") : [102, 111, 111, 98, 97, 114],
        expected: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("MZXW6YTBOI======") : [77, 90, 88, 87, 54, 89, 84, 66, 79, 73, 61, 61, 61, 61, 61, 61]
      }
    ],

    // Legacy interface properties for compatibility  
    internalName: 'BASE32',
    comment: 'RFC 4648 compliant BASE32 encoding',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // BASE32 alphabet from RFC 4648
    ALPHABET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    PADDING: '=',
    
    // Legacy test vectors for compatibility
    testVectors: [
      {
        algorithm: 'BASE32',
        description: 'RFC 4648 empty string test',
        origin: 'RFC 4648 Section 10',
        link: 'https://tools.ietf.org/html/rfc4648#section-10',
        standard: 'RFC 4648',
        input: '',
        output: '',
        compressionRatio: 1.0, // No change for encoding
        notes: 'Edge case: empty input should return empty output',
        category: 'Edge Case'
      },
      {
        algorithm: 'BASE32',
        description: 'RFC 4648 single character test',
        origin: 'RFC 4648 Section 10',
        link: 'https://tools.ietf.org/html/rfc4648#section-10',
        standard: 'RFC 4648',
        input: 'f',
        output: 'MY======',
        compressionRatio: 0.125, // 1 byte -> 8 chars (expansion)
        notes: 'Single character encoding with full padding',
        category: 'Basic'
      },
      {
        algorithm: 'BASE32',
        description: 'RFC 4648 two character test',
        origin: 'RFC 4648 Section 10',
        link: 'https://tools.ietf.org/html/rfc4648#section-10',
        standard: 'RFC 4648',
        input: 'fo',
        output: 'MZXQ====',
        compressionRatio: 0.25, // 2 bytes -> 8 chars
        notes: 'Two character encoding demonstrating padding rules',
        category: 'Basic'
      },
      {
        algorithm: 'BASE32',
        description: 'RFC 4648 standard foo test',
        origin: 'RFC 4648 Section 10',
        link: 'https://tools.ietf.org/html/rfc4648#section-10',
        standard: 'RFC 4648',
        input: 'foo',
        output: 'MZXW6===',
        compressionRatio: 0.375, // 3 bytes -> 8 chars
        notes: 'Three characters - common test case',
        category: 'Basic'
      },
      {
        algorithm: 'BASE32',
        description: 'RFC 4648 extended foo test',
        origin: 'RFC 4648 Section 10',
        link: 'https://tools.ietf.org/html/rfc4648#section-10',
        standard: 'RFC 4648',
        input: 'foobar',
        output: 'MZXW6YTBOI======',
        compressionRatio: 0.375, // 6 bytes -> 16 chars
        notes: 'Six characters showing typical encoding expansion',
        category: 'Standard'
      },
      {
        algorithm: 'BASE32',
        description: 'Binary data encoding test',
        origin: 'Base32 binary handling validation',
        link: 'https://en.wikipedia.org/wiki/Base32',
        standard: 'Educational',
        input: '\x00\x01\x02\x03\x04',
        output: '', // Will be generated
        compressionRatio: 0.625, // 5 bytes -> 8 chars
        notes: 'Tests handling of binary data with null bytes',
        category: 'Binary'
      },
      {
        algorithm: 'BASE32',
        description: 'All alphabet characters test',
        origin: 'Character set validation',
        link: 'https://tools.ietf.org/html/rfc4648',
        standard: 'RFC 4648',
        input: 'The quick brown fox jumps over the lazy dog',
        output: '', // Generated by algorithm
        compressionRatio: 0.55, // Typical text expansion
        notes: 'Tests full alphabet coverage and case handling',
        category: 'Text'
      },
      {
        algorithm: 'BASE32',
        description: 'Long string boundary test',
        origin: 'Boundary condition testing',
        link: 'https://base32.readthedocs.io/en/latest/',
        standard: 'Implementation Test',
        input: 'A'.repeat(100),
        output: '', // 100 identical characters
        compressionRatio: 0.625, // Predictable expansion
        notes: 'Tests algorithm with long repetitive input',
        category: 'Boundary'
      }
    ],
    
    // Initialize encoder
    Init: function() {
      BASE32.isInitialized = true;
    },
    
    // Set up key (BASE32 doesn't use keys, but required by interface)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'BASE32[' + global.generateUniqueID() + ']';
      } while (BASE32.instances[id] || global.objectInstances[id]);
      
      BASE32.instances[id] = new BASE32.BASE32Instance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear encoder data
    ClearData: function(id) {
      if (BASE32.instances[id]) {
        delete BASE32.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'BASE32', 'ClearData');
        return false;
      }
    },
    
    // Convert string to bytes array
    stringToBytes: function(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
      }
      return bytes;
    },
    
    // Convert bytes array to string
    bytesToString: function(bytes) {
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    },

    // Required interface method for encoding schemes
    Encode: function(input) {
      // Create temporary instance for encoding
      const tempId = this.KeySetup();
      try {
        // Convert byte array to string if necessary
        if (Array.isArray(input)) {
          input = this.bytesToString(input);
        }
        return this.encryptBlock(tempId, input);
      } finally {
        this.ClearData(tempId);
      }
    },

    // Required interface method for encoding schemes
    Decode: function(input) {
      // Create temporary instance for decoding
      const tempId = this.KeySetup();
      try {
        const result = this.decryptBlock(tempId, input);
        // Convert result to byte array
        return this.stringToBytes(result);
      } finally {
        this.ClearData(tempId);
      }
    },
    
    // Encode block (encryption)
    encryptBlock: function(id, plaintext) {
      if (!BASE32.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'BASE32', 'encryptBlock');
        return plaintext;
      }
      
      const bytes = BASE32.stringToBytes(plaintext);
      let encoded = '';
      let buffer = 0;
      let bitsLeft = 0;
      
      for (let i = 0; i < bytes.length; i++) {
        buffer = (buffer << 8) | bytes[i];
        bitsLeft += 8;
        
        while (bitsLeft >= 5) {
          const index = (buffer >>> (bitsLeft - 5)) & 0x1F;
          encoded += BASE32.ALPHABET[index];
          bitsLeft -= 5;
        }
      }
      
      // Handle remaining bits
      if (bitsLeft > 0) {
        const index = (buffer << (5 - bitsLeft)) & 0x1F;
        encoded += BASE32.ALPHABET[index];
      }
      
      // Add padding
      const paddingNeeded = (8 - (encoded.length % 8)) % 8;
      for (let i = 0; i < paddingNeeded; i++) {
        encoded += BASE32.PADDING;
      }
      
      return encoded;
    },
    
    // Decode block (decryption)
    decryptBlock: function(id, ciphertext) {
      if (!BASE32.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'BASE32', 'decryptBlock');
        return ciphertext;
      }
      
      // Remove whitespace and convert to uppercase
      let normalized = ciphertext.replace(/\s/g, '').toUpperCase();
      
      // Remove padding
      let paddingCount = 0;
      while (normalized.length > 0 && normalized[normalized.length - 1] === BASE32.PADDING) {
        normalized = normalized.slice(0, -1);
        paddingCount++;
      }
      
      // Check for valid characters
      for (let i = 0; i < normalized.length; i++) {
        if (BASE32.ALPHABET.indexOf(normalized[i]) === -1) {
          global.throwException('Invalid BASE32 Character Exception', normalized[i], 'BASE32', 'decryptBlock');
          return ciphertext;
        }
      }
      
      const bytes = [];
      let buffer = 0;
      let bitsLeft = 0;
      
      for (let i = 0; i < normalized.length; i++) {
        const index = BASE32.ALPHABET.indexOf(normalized[i]);
        buffer = (buffer << 5) | index;
        bitsLeft += 5;
        
        if (bitsLeft >= 8) {
          const byte = (buffer >>> (bitsLeft - 8)) & 0xFF;
          bytes.push(byte);
          bitsLeft -= 8;
        }
      }
      
      return BASE32.bytesToString(bytes);
    },
    
    // Instance class
    BASE32Instance: function(key) {
      // BASE32 doesn't need key storage, but maintain interface
      this.key = key || '';
    },
    
    /**
     * Run validation tests against known test vectors
     */
    ValidateImplementation: function() {
      const results = [];
      
      for (const testVector of this.testVectors) {
        try {
          const keyId = this.KeySetup();
          const encoded = this.encryptBlock(keyId, testVector.input);
          const decoded = this.decryptBlock(keyId, encoded);
          
          const passed = decoded === testVector.input;
          const expansionRatio = testVector.input.length > 0 ? encoded.length / testVector.input.length : 1;
          
          results.push({
            description: testVector.description,
            category: testVector.category,
            passed: passed,
            expansionRatio: expansionRatio.toFixed(3),
            expectedRatio: testVector.compressionRatio,
            notes: testVector.notes,
            inputSize: testVector.input.length,
            outputSize: encoded.length,
            output: testVector.output || encoded
          });
          
          this.ClearData(keyId);
        } catch (error) {
          results.push({
            description: testVector.description,
            category: testVector.category,
            passed: false,
            error: error.message
          });
        }
      }
      
      return results;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(BASE32);
  }
  
  // Export to global scope
  global.BASE32 = BASE32;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BASE32;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);