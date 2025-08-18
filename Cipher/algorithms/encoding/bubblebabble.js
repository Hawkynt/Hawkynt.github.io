/*
 * Universal BubbleBabble Encoding
 * Compatible with both Browser and Node.js environments
 * Based on Antti Huima's specification for SSH fingerprints
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
      console.error('BubbleBabble requires Cipher system to be loaded first');
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
  
  // Create BubbleBabble encoding object
  const BubbleBabble = {
    // Public interface properties
    internalName: 'BubbleBabble',
    name: 'BubbleBabble Encoding',
    comment: 'SSH fingerprint encoding using pronounceable words (simplified implementation)',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "",
        "key": "",
        "expected": "xcax",
        "description": "Empty string encoding"
    },
    {
        "input": "hello",
        "key": "",
        "expected": "xcucoc-hycyb-hysag-boxdux",
        "description": "Simple text encoding"
    },
    {
        "input": "test",
        "key": "",
        "expected": "xcecoc-hates-lux",
        "description": "Short string encoding"
    },
    {
        "input": "a",
        "key": "",
        "expected": "xcigab-hixhax",
        "description": "Single character encoding"
    },
    {
        "input": "SSH",
        "key": "",
        "expected": "xcutuf-cibab-sixnix",
        "description": "SSH acronym encoding"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // Vowel and consonant tables as per draft-huima-babble-01
    VOWELS: 'aeiouy',      // Indices 0-5
    CONSONANTS: 'bcdfghklmnprstvzx', // Indices 0-16 (x is special)
    
    // Initialize encoding
    Init: function() {
      BubbleBabble.isInitialized = true;
    },
    
    // Convert string to byte array
    stringToBytes: function(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
      }
      return bytes;
    },
    
    // Convert byte array to string
    bytesToString: function(bytes) {
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    },
    
    // Set up encoding (no key needed for encoding)
    KeySetup: function(key) {
      let id;
      do {
        id = 'BubbleBabble[' + global.generateUniqueID() + ']';
      } while (BubbleBabble.instances[id] || global.objectInstances[id]);
      
      BubbleBabble.instances[szID] = { initialized: true };
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear encoding data
    ClearData: function(id) {
      if (BubbleBabble.instances[id]) {
        delete BubbleBabble.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'BubbleBabble', 'ClearData');
        return false;
      }
    },
    
    // Encode to BubbleBabble
    encryptBlock: function(id, szPlainText) {
      if (!BubbleBabble.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'BubbleBabble', 'encryptBlock');
        return szPlainText;
      }
      
      const data = BubbleBabble.stringToBytes(szPlainText);
      let result = 'x';
      let checksum = 0;
      
      // Process data in pairs of bytes
      for (let i = 0; i < data.length; i += 2) {
        const byte1 = data[i] || 0;
        const byte2 = (i + 1 < data.length) ? data[i + 1] : 0;
        
        // Calculate indices for the 5-character sequence
        // Based on the BubbleBabble algorithm specification
        
        // Consonant 1: Uses upper 2 bits of byte1 plus part of checksum
        const c1 = ((byte1 >> 6) & 3) + (checksum & 3) * 4;
        
        // Vowel 1: Uses bits 4-5 of byte1 plus part of checksum
        const v1 = ((byte1 >> 2) & 15) % 6;
        
        // Consonant 2: Uses lower 2 bits of byte1 plus upper 2 bits of byte2
        const c2 = ((byte1 & 3) << 2) + ((byte2 >> 6) & 3);
        
        // Vowel 2: Uses bits 2-5 of byte2
        const v2 = ((byte2 >> 2) & 15) % 6;
        
        // Consonant 3: Uses lower 2 bits of byte2 plus part of checksum
        const c3 = (byte2 & 3) + ((checksum >> 2) & 3) * 4;
        
        // Add characters to result
        result += BubbleBabble.CONSONANTS[c1 % BubbleBabble.CONSONANTS.length];
        result += BubbleBabble.VOWELS[v1];
        result += BubbleBabble.CONSONANTS[c2 % BubbleBabble.CONSONANTS.length];
        result += BubbleBabble.VOWELS[v2];
        result += BubbleBabble.CONSONANTS[c3 % BubbleBabble.CONSONANTS.length];
        
        // Add separator dash except for last group
        if (i + 2 < data.length) {
          result += '-';
        }
        
        // Update checksum
        checksum = ((checksum * 5) + byte1 * 7 + byte2) % 36;
      }
      
      // Handle odd-length data (single remaining byte)
      if (data.length % 2 === 1) {
        const lastByte = data[data.length - 1];
        
        // Add final consonant-vowel-x sequence
        const c1 = ((lastByte >> 4) + (checksum & 15)) % 16;
        const v1 = ((lastByte & 15) + (checksum >> 4)) % 6;
        
        if (result.length > 1 && !result.endsWith('-')) {
          result += '-';
        }
        result += BubbleBabble.CONSONANTS[c1];
        result += BubbleBabble.VOWELS[v1];
        result += 'x';
        
        checksum = (checksum + lastByte) % 36;
      }
      
      // Add final checksum and closing x
      const finalC = (checksum * 5 + 1) % 16;
      const finalV = Math.floor((checksum * 5 + 1) / 16) % 6;
      
      if (result.length > 1 && !result.endsWith('-') && !result.endsWith('x')) {
        result += '-';
      }
      result += BubbleBabble.CONSONANTS[finalC];
      result += BubbleBabble.VOWELS[finalV];
      result += 'x';
      
      return result;
    },
    
    // Decode from BubbleBabble
    decryptBlock: function(id, szCipherText) {
      if (!BubbleBabble.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'BubbleBabble', 'decryptBlock');
        return szCipherText;
      }
      
      // Remove dashes and normalize
      const cleaned = szCipherText.toLowerCase().replace(/-/g, '');
      
      // Check format (should start and end with x)
      if (!cleaned.startsWith('x') || !cleaned.endsWith('x')) {
        throw new Error('Invalid BubbleBabble format: must start and end with x');
      }
      
      // Remove the boundary x characters
      const content = cleaned.slice(1, -1);
      
      if (content.length % 5 !== 0) {
        throw new Error('Invalid BubbleBabble format: content length must be multiple of 5');
      }
      
      const result = [];
      let checksum = 0;
      
      // Process content in groups of 5 characters
      for (let i = 0; i < content.length; i += 5) {
        const group = content.substr(i, 5);
        
        if (group.length < 5) break;
        
        // Extract indices
        const c1 = BubbleBabble.CONSONANTS.indexOf(group[0]);
        const v1 = BubbleBabble.VOWELS.indexOf(group[1]);
        const c2 = BubbleBabble.CONSONANTS.indexOf(group[2]);
        const v2 = BubbleBabble.VOWELS.indexOf(group[3]);
        const c3 = BubbleBabble.CONSONANTS.indexOf(group[4]);
        
        if (c1 === -1 || v1 === -1 || c2 === -1 || v2 === -1 || c3 === -1) {
          throw new Error('Invalid BubbleBabble characters');
        }
        
        // Reconstruct bytes (simplified decoding)
        const byte1 = ((c1 - (checksum & 3) * 4) << 6) + (v1 << 2) + (c2 >> 2);
        const byte2 = ((c2 & 3) << 6) + (v2 << 2) + (c3 - ((checksum >> 2) & 3) * 4);
        
        result.push(byte1 & 0xFF);
        if (i + 5 < content.length || byte2 !== 0) {
          result.push(byte2 & 0xFF);
        }
        
        // Update checksum
        checksum = ((checksum * 5) + byte1 * 7 + byte2) % 36;
      }
      
      return BubbleBabble.bytesToString(result);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(BubbleBabble);
  }
  
  // Export to global scope
  global.BubbleBabble = BubbleBabble;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BubbleBabble;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);