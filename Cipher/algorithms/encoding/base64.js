/*
 * Universal BASE64 Encoder/Decoder
 * Compatible with both Browser and Node.js environments
 * Based on original base64.js but modernized for cross-platform use
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
      console.error('BASE64 cipher requires Cipher system to be loaded first');
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
  
  // Create BASE64 cipher object
  const BASE64 = {
    // Public interface properties
    internalName: 'BASE64',
    name: 'BASE64',
    comment: 'RFC 4648 compliant BASE64 encoder/decoder',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // BASE64 character set (RFC 4648)
    CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    PAD: '=',
    
    // Character lookup table for decoding
    charLookup: {},
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'BASE64',
      displayName: 'Base64 Encoding',
      description: 'Binary-to-text encoding scheme that represents binary data in ASCII string format using a radix-64 representation. Widely used in email, web protocols, and data serialization.',
      
      inventor: 'Originally in RFC 989, standardized in RFC 4648',
      year: 1987,
      background: 'Developed for encoding binary data in email systems that could only handle 7-bit ASCII text. The algorithm transforms every 3 bytes (24 bits) into 4 printable ASCII characters.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.SECURE,
      securityNotes: 'Not encryption - only encoding for safe transport. Provides no security or obfuscation, easily reversible. Used for data integrity, not confidentiality.',
      
      category: global.CipherMetadata.Categories.ENCODING,
      subcategory: 'binary-to-text',
      complexity: global.CipherMetadata.ComplexityLevels.BEGINNER,
      
      keySize: 0, // No key required
      blockSize: 3, // 3 input bytes -> 4 output characters
      rounds: 1,
      
      specifications: [
        {
          name: 'RFC 4648: The Base16, Base32, and Base64 Data Encodings',
          url: 'https://tools.ietf.org/html/rfc4648'
        },
        {
          name: 'MIME Base64 - RFC 2045',
          url: 'https://tools.ietf.org/html/rfc2045#section-6.8'
        }
      ],
      
      testVectors: [
        {
          name: 'RFC 4648 Section 10 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc4648#section-10'
        },
        {
          name: 'IETF Base64 Test Suite',
          url: 'https://base64.guru/tests/compare'
        }
      ],
      
      references: [
        {
          name: 'Wikipedia: Base64',
          url: 'https://en.wikipedia.org/wiki/Base64'
        },
        {
          name: 'Mozilla Base64 Documentation',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/btoa'
        }
      ],
      
      implementationNotes: 'Standard implementation with RFC 4648 alphabet (A-Z, a-z, 0-9, +, /) and = padding. Handles arbitrary length input with proper padding.',
      performanceNotes: 'O(n) time and space complexity. Very fast due to simple bitwise operations. 33% size increase from input to output.',
      
      educationalValue: 'Excellent introduction to binary representations, bitwise operations, and data encoding. Shows how to safely transmit binary data over text-only channels.',
      prerequisites: ['Binary number system', 'ASCII character encoding', 'Basic bitwise operations'],
      
      tags: ['encoding', 'binary-to-text', 'rfc4648', 'mime', 'data-transport', 'beginner', 'standard'],
      
      version: '2.0'
    }) : null,
    
    // Official test vectors from RFC 4648 Section 10
    testVectors: [
      { input: '', key: '', expected: '', description: 'RFC 4648 test vector: empty string' },
      { input: 'f', key: '', expected: 'Zg==', description: 'RFC 4648 test vector: single f' },
      { input: 'fo', key: '', expected: 'Zm8=', description: 'RFC 4648 test vector: fo' },
      { input: 'foo', key: '', expected: 'Zm9v', description: 'RFC 4648 test vector: foo' },
      { input: 'foob', key: '', expected: 'Zm9vYg==', description: 'RFC 4648 test vector: foob' },
      { input: 'fooba', key: '', expected: 'Zm9vYmE=', description: 'RFC 4648 test vector: fooba' },
      { input: 'foobar', key: '', expected: 'Zm9vYmFy', description: 'RFC 4648 test vector: foobar (no padding)' }
    ],
    
    // Initialize cipher
    Init: function() {
      // Build lookup table for decoding
      BASE64.charLookup = {};
      for (let i = 0; i < BASE64.CHARS.length; i++) {
        BASE64.charLookup[BASE64.CHARS.charAt(i)] = i;
      }
      BASE64.isInitialized = true;
    },
    
    // Set up key (BASE64 doesn't use keys)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'BASE64[' + global.generateUniqueID() + ']';
      } while (BASE64.instances[id] || global.objectInstances[id]);
      
      BASE64.instances[id] = new BASE64.Base64Instance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (BASE64.instances[id]) {
        delete BASE64.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'BASE64', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (encode to BASE64)
    encryptBlock: function(id, plaintext) {
      if (!BASE64.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'BASE64', 'encryptBlock');
        return plaintext;
      }
      
      return BASE64.encode(plaintext);
    },
    
    // Decrypt block (decode from BASE64)
    decryptBlock: function(id, ciphertext) {
      if (!BASE64.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'BASE64', 'decryptBlock');
        return ciphertext;
      }
      
      return BASE64.decode(ciphertext);
    },
    
    // Encode string to BASE64
    encode: function(input) {
      if (!input) return '';
      
      let result = '';
      
      for (let i = 0; i < input.length; i += 3) {
        // Get up to 3 bytes
        const byte1 = input.charCodeAt(i);
        const byte2 = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
        const byte3 = i + 2 < input.length ? input.charCodeAt(i + 2) : 0;
        
        // Combine into 24-bit number
        const combined = (byte1 << 16) | (byte2 << 8) | byte3;
        
        // Extract 4 x 6-bit groups and encode
        result += BASE64.CHARS.charAt((combined >> 18) & 63);
        result += BASE64.CHARS.charAt((combined >> 12) & 63);
        result += (i + 1 < input.length) ? BASE64.CHARS.charAt((combined >> 6) & 63) : BASE64.PAD;
        result += (i + 2 < input.length) ? BASE64.CHARS.charAt(combined & 63) : BASE64.PAD;
      }
      
      return result;
    },
    
    // Decode BASE64 string
    decode: function(input) {
      if (!input) return '';
      
      // Remove whitespace and padding for calculation
      const cleanInput = input.replace(/\s/g, '');
      const padCount = (cleanInput.match(/=/g) || []).length;
      const dataLength = cleanInput.length - padCount;
      
      let result = '';
      let i = 0;
      
      while (i < dataLength) {
        // Get 4 characters (24 bits)
        const a = BASE64.charLookup[cleanInput.charAt(i++)] || 0;
        const b = BASE64.charLookup[cleanInput.charAt(i++)] || 0;
        const c = i < dataLength ? (BASE64.charLookup[cleanInput.charAt(i++)] || 0) : 0;
        const d = i < dataLength ? (BASE64.charLookup[cleanInput.charAt(i++)] || 0) : 0;
        
        // Combine into 24-bit number
        const bitmap = (a << 18) | (b << 12) | (c << 6) | d;
        
        // Extract 3 bytes
        result += String.fromCharCode((bitmap >> 16) & 255);
        if (i - 2 <= dataLength) result += String.fromCharCode((bitmap >> 8) & 255);
        if (i - 1 <= dataLength) result += String.fromCharCode(bitmap & 255);
      }
      
      return result;
    },
    
    // Instance class
    Base64Instance: function(key) {
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
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(BASE64);
  }
  
  // Export to global scope
  global.BASE64 = BASE64;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BASE64;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);