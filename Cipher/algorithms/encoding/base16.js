/*
 * Universal BASE16 (Hex) Encoding
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
      console.error('BASE16 encoder requires Cipher system to be loaded first');
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
  
  // Create BASE16 encoder object
  const BASE16 = {
    // Public interface properties
    internalName: 'BASE16',
    name: 'BASE16 (Hex)',
    comment: 'RFC 4648 compliant hexadecimal encoding',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // BASE16 alphabet from RFC 4648
    ALPHABET: '0123456789ABCDEF',
    
    // Official test vectors from RFC 4648 Section 10
    testVectors: [
      { input: '', key: '', expected: '', description: 'RFC 4648 test vector: empty string' },
      { input: 'f', key: '', expected: '66', description: 'RFC 4648 test vector: single f' },
      { input: 'fo', key: '', expected: '666F', description: 'RFC 4648 test vector: fo' },
      { input: 'foo', key: '', expected: '666F6F', description: 'RFC 4648 test vector: foo' },
      { input: 'foob', key: '', expected: '666F6F62', description: 'RFC 4648 test vector: foob' },
      { input: 'fooba', key: '', expected: '666F6F6261', description: 'RFC 4648 test vector: fooba' },
      { input: 'foobar', key: '', expected: '666F6F626172', description: 'RFC 4648 test vector: foobar' }
    ],
    
    // Initialize encoder
    Init: function() {
      BASE16.isInitialized = true;
    },
    
    // Set up key (BASE16 doesn't use keys, but required by interface)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'BASE16[' + global.generateUniqueID() + ']';
      } while (BASE16.instances[id] || global.objectInstances[id]);
      
      BASE16.instances[id] = new BASE16.BASE16Instance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear encoder data
    ClearData: function(id) {
      if (BASE16.instances[id]) {
        delete BASE16.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'BASE16', 'ClearData');
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
      if (!BASE16.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'BASE16', 'encryptBlock');
        return plaintext;
      }
      
      const bytes = BASE16.stringToBytes(plaintext);
      let encoded = '';
      
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        const nibbles = OpCodes.SplitNibbles(byte);
        encoded += BASE16.ALPHABET[nibbles.high] + BASE16.ALPHABET[nibbles.low];
      }
      
      return encoded;
    },
    
    // Decode block (decryption)
    decryptBlock: function(id, ciphertext) {
      if (!BASE16.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'BASE16', 'decryptBlock');
        return ciphertext;
      }
      
      // Remove whitespace and convert to uppercase
      const normalized = ciphertext.replace(/\s/g, '').toUpperCase();
      
      // Check for valid length (must be even)
      if (normalized.length % 2 !== 0) {
        global.throwException('Invalid BASE16 Length Exception', normalized.length, 'BASE16', 'decryptBlock');
        return ciphertext;
      }
      
      // Check for valid characters
      for (let i = 0; i < normalized.length; i++) {
        if (BASE16.ALPHABET.indexOf(normalized[i]) === -1) {
          global.throwException('Invalid BASE16 Character Exception', normalized[i], 'BASE16', 'decryptBlock');
          return ciphertext;
        }
      }
      
      const bytes = [];
      for (let i = 0; i < normalized.length; i += 2) {
        const highChar = normalized[i];
        const lowChar = normalized[i + 1];
        const high = BASE16.ALPHABET.indexOf(highChar);
        const low = BASE16.ALPHABET.indexOf(lowChar);
        const byte = OpCodes.CombineNibbles(high, low);
        bytes.push(byte);
      }
      
      return BASE16.bytesToString(bytes);
    },
    
    // Instance class
    BASE16Instance: function(key) {
      // BASE16 doesn't need key storage, but maintain interface
      this.key = key || '';
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(BASE16);
  }
  
  // Export to global scope
  global.BASE16 = BASE16;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BASE16;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);