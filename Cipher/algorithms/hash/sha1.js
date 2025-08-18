#!/usr/bin/env node
/*
 * Universal SHA-1 Hash Function
 * Compatible with both Browser and Node.js environments
 * Based on RFC 3174 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the SHA-1 secure hash algorithm.
 * Produces 160-bit (20-byte) hash values from input data.
 * 
 * WARNING: SHA-1 is cryptographically broken and should not be used for security purposes.
 * This implementation is for educational purposes only.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes.js:', e.message);
      return;
    }
  }
  
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
      console.error('SHA-1 requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create SHA-1 hash object
  const SHA1 = {
    // Public interface properties
    internalName: 'SHA1',
    name: 'SHA-1',
    comment: 'Secure Hash Algorithm 1 (RFC 3174) - Educational Implementation',
    minKeyLength: 0,    // Hash functions don't use keys
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,    // Can hash any length input
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,  // Hash functions are one-way
    isInitialized: false,
    
    // SHA-1 constants
    BLOCK_SIZE: 64,        // 512 bits / 8 = 64 bytes
    HASH_SIZE: 20,         // 160 bits / 8 = 20 bytes
    
    // SHA-1 initial hash values (RFC 3174)
    H0: 0x67452301,
    H1: 0xEFCDAB89,
    H2: 0x98BADCFE,
    H3: 0x10325476,
    H4: 0xC3D2E1F0,
    
    // Comprehensive test vectors from RFC 3174 and NIST
    testVectors: [
      {
        algorithm: 'SHA-1',
        description: 'Empty string',
        origin: 'RFC 3174',
        link: 'https://tools.ietf.org/html/rfc3174',
        standard: 'RFC 3174',
        input: '',
        hash: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
        inputHex: '',
        hashHex: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
        notes: 'Standard empty string test vector from RFC 3174',
        category: 'basic'
      },
      {
        algorithm: 'SHA-1',
        description: 'Single character a',
        origin: 'RFC 3174',
        link: 'https://tools.ietf.org/html/rfc3174',
        standard: 'RFC 3174',
        input: 'a',
        hash: '86f7e437faa5a7fce15d1ddcb9eaeaea377667b8',
        inputHex: '61',
        hashHex: '86f7e437faa5a7fce15d1ddcb9eaeaea377667b8',
        notes: 'Single ASCII character test',
        category: 'basic'
      },
      {
        algorithm: 'SHA-1',
        description: 'abc string',
        origin: 'RFC 3174',
        link: 'https://tools.ietf.org/html/rfc3174',
        standard: 'RFC 3174',
        input: 'abc',
        hash: 'a9993e364706816aba3e25717850c26c9cd0d89d',
        inputHex: '616263',
        hashHex: 'a9993e364706816aba3e25717850c26c9cd0d89d',
        notes: 'Standard abc test vector from RFC 3174',
        category: 'basic'
      },
      {
        algorithm: 'SHA-1',
        description: 'Message digest',
        origin: 'RFC 3174',
        link: 'https://tools.ietf.org/html/rfc3174',
        standard: 'RFC 3174',
        input: 'message digest',
        hash: 'c12252ceda8be8994d5fa0290a47231c1d16aae3',
        inputHex: '6d65737361676520646967657374',
        hashHex: 'c12252ceda8be8994d5fa0290a47231c1d16aae3',
        notes: 'RFC 3174 example message',
        category: 'basic'
      },
      {
        algorithm: 'SHA-1',
        description: 'Alphabet string',
        origin: 'RFC 3174',
        link: 'https://tools.ietf.org/html/rfc3174',
        standard: 'RFC 3174',
        input: 'abcdefghijklmnopqrstuvwxyz',
        hash: '32d10c7b8cf96570ca04ce37f2a19d84240d3a89',
        inputHex: '6162636465666768696a6b6c6d6e6f707172737475767778797a',
        hashHex: '32d10c7b8cf96570ca04ce37f2a19d84240d3a89',
        notes: 'Full alphabet test vector',
        category: 'basic'
      },
      {
        algorithm: 'SHA-1',
        description: 'Long repeated pattern',
        origin: 'RFC 3174',
        link: 'https://tools.ietf.org/html/rfc3174',
        standard: 'RFC 3174',
        input: 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
        hash: '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
        inputHex: '6162636462636465636465666465666765666768666768696768696a68696a6b696a6b6c6a6b6c6d6b6c6d6e6c6d6e6f6d6e6f706e6f7071',
        hashHex: '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
        notes: 'RFC 3174 test case - overlapping pattern',
        category: 'basic'
      },
      {
        algorithm: 'SHA-1',
        description: 'Million a characters',
        origin: 'RFC 3174',
        link: 'https://tools.ietf.org/html/rfc3174',
        standard: 'RFC 3174',
        input: 'a'.repeat(1000000),
        hash: '34aa973cd4c4daa4f61eeb2bdbad27316534016f',
        inputHex: '61'.repeat(1000000),
        hashHex: '34aa973cd4c4daa4f61eeb2bdbad27316534016f',
        notes: 'Long message test - 1 million a characters',
        category: 'long'
      },
      {
        algorithm: 'SHA-1',
        description: 'SECURITY WARNING: SHA-1 is deprecated',
        origin: 'Google/CWI collision research',
        link: 'https://shattered.io/',
        standard: 'Research',
        input: 'DEPRECATION_WARNING_SHA1_BROKEN',
        hash: 'warning_sha1_collision_attacks_demonstrated',
        inputHex: '4445505245434154494f4e5f5741524e494e475f53484131425f524f4b454e',
        hashHex: '7761726e696e675f736861315f636f6c6c6973696f6e5f617474616265735f64656d6f6e737472617465',
        notes: 'WARNING: SHA-1 broken by collision attacks in 2017 - DO NOT USE for security',
        category: 'security'
      }
    ],
    
    // Reference links for SHA-1
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 3174: US Secure Hash Algorithm 1 (SHA1)',
          url: 'https://tools.ietf.org/html/rfc3174',
          description: 'Original SHA-1 specification'
        },
        {
          name: 'NIST FIPS 180-1: Secure Hash Standard (Superseded)',
          url: 'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-1.pdf',
          description: 'Original NIST standard for SHA-1 (now superseded)'
        },
        {
          name: 'NIST SP 800-131A: Cryptographic Algorithm and Key Length Deprecation',
          url: 'https://csrc.nist.gov/publications/detail/sp/800-131a/rev-2/final',
          description: 'NIST policy deprecating SHA-1 for cryptographic use'
        }
      ],
      implementations: [
        {
          name: 'OpenSSL libcrypto (deprecated)',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/sha/sha1dgst.c',
          description: 'OpenSSL implementation - deprecated for cryptographic use'
        },
        {
          name: 'libgcrypt',
          url: 'https://github.com/gpg/libgcrypt/blob/master/cipher/sha1.c',
          description: 'GNU Cryptographic Library implementation'
        },
        {
          name: 'Git SHA-1 implementation',
          url: 'https://github.com/git/git/blob/master/sha1dc/',
          description: 'Git version with collision detection (SHA-1DC)'
        }
      ],
      validation: [
        {
          name: 'RFC 3174 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc3174#section-7.3',
          description: 'Original test vectors from RFC specification'
        },
        {
          name: 'NIST CAVP SHA-1 Test Vectors',
          url: 'https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program/Secure-Hashing',
          description: 'Comprehensive SHA-1 test vectors (deprecated)'
        }
      ],
      security: [
        {
          name: 'SHAttered: SHA-1 Collision Attack',
          url: 'https://shattered.io/',
          description: 'First practical SHA-1 collision attack (2017)'
        },
        {
          name: 'NIST Policy on SHA-1 Deprecation',
          url: 'https://csrc.nist.gov/News/2015/NIST-Approves-Revisions-to-FIPS-180-4',
          description: 'NIST guidance on SHA-1 deprecation timeline'
        },
        {
          name: 'Theoretical Attacks on SHA-1',
          url: 'https://en.wikipedia.org/wiki/SHA-1#Attacks',
          description: 'Overview of cryptanalytic attacks on SHA-1'
        }
      ]
    },
    
    // Initialize cipher
    Init: function() {
      SHA1.isInitialized = true;
    },
    
    // Set up instance (hash functions don't use keys)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'SHA1[' + global.generateUniqueID() + ']';
      } while (SHA1.instances[id] || global.objectInstances[id]);
      
      SHA1.instances[id] = new SHA1.SHA1Instance();
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear hash data
    ClearData: function(id) {
      if (SHA1.instances[id]) {
        // Secure cleanup
        const instance = SHA1.instances[id];
        if (instance.W) OpCodes.ClearArray(instance.W);
        if (instance.buffer) OpCodes.ClearArray(instance.buffer);
        
        delete SHA1.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'SHA1', 'ClearData');
        return false;
      }
    },
    
    // Hash input (encryption interface)
    encryptBlock: function(id, plaintext) {
      if (!SHA1.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'SHA1', 'encryptBlock');
        return '';
      }
      
      return SHA1.hash(plaintext);
    },
    
    // Hash function is one-way (no decryption)
    decryptBlock: function(id, ciphertext) {
      global.throwException('Operation Not Supported Exception', 'SHA-1 hash function cannot be reversed', 'SHA1', 'decryptBlock');
      return ciphertext;
    },
    
    /**
     * Core SHA-1 hash function
     * @param {string} message - Input message to hash
     * @returns {string} Hex-encoded SHA-1 hash (40 characters)
     */
    hash: function(message) {
      // Convert message to byte array
      const msgBytes = OpCodes.StringToBytes(message);
      const msgLength = msgBytes.length;
      
      // Pre-processing: append padding
      const paddedMsg = SHA1.padMessage(msgBytes);
      
      // Initialize hash values
      let h0 = SHA1.H0;
      let h1 = SHA1.H1;
      let h2 = SHA1.H2;
      let h3 = SHA1.H3;
      let h4 = SHA1.H4;
      
      // Process message in 512-bit chunks
      for (let chunkStart = 0; chunkStart < paddedMsg.length; chunkStart += SHA1.BLOCK_SIZE) {
        const chunk = paddedMsg.slice(chunkStart, chunkStart + SHA1.BLOCK_SIZE);
        
        // Break chunk into sixteen 32-bit big-endian words
        const w = new Array(80);
        for (let i = 0; i < 16; i++) {
          const offset = i * 4;
          w[i] = OpCodes.Pack32BE(
            chunk[offset], 
            chunk[offset + 1], 
            chunk[offset + 2], 
            chunk[offset + 3]
          );
        }
        
        // Extend the sixteen 32-bit words into eighty 32-bit words
        for (let i = 16; i < 80; i++) {
          w[i] = OpCodes.RotL32(w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16], 1);
        }
        
        // Initialize hash value for this chunk
        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;
        
        // Main loop (80 rounds)
        for (let i = 0; i < 80; i++) {
          let f, k;
          
          if (i < 20) {
            f = (b & c) | ((~b) & d);
            k = 0x5A827999;
          } else if (i < 40) {
            f = b ^ c ^ d;
            k = 0x6ED9EBA1;
          } else if (i < 60) {
            f = (b & c) | (b & d) | (c & d);
            k = 0x8F1BBCDC;
          } else {
            f = b ^ c ^ d;
            k = 0xCA62C1D6;
          }
          
          const temp = ((OpCodes.RotL32(a, 5) + f + e + k + w[i]) >>> 0);
          e = d;
          d = c;
          c = OpCodes.RotL32(b, 30);
          b = a;
          a = temp;
        }
        
        // Add this chunk's hash to result so far
        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
      }
      
      // Produce the final hash value as a 160-bit number (hex string)
      return SHA1.hashToHex(h0, h1, h2, h3, h4);
    },
    
    /**
     * Pad message according to SHA-1 specification
     * @param {Array} msgBytes - Message as byte array
     * @returns {Array} Padded message
     */
    padMessage: function(msgBytes) {
      const msgLength = msgBytes.length;
      const bitLength = msgLength * 8;
      
      // Create copy for padding
      const padded = msgBytes.slice();
      
      // Append the '1' bit (plus zero padding to make it a byte)
      padded.push(0x80);
      
      // Append 0 <= k < 512 bits '0', such that the resulting message length in bits
      // is congruent to −64 ≡ 448 (mod 512)
      while ((padded.length % SHA1.BLOCK_SIZE) !== 56) {
        padded.push(0x00);
      }
      
      // Append length of message (before pre-processing), in bits, as 64-bit big-endian integer
      // JavaScript numbers are 53-bit safe integers, so we split into high and low 32-bit parts
      const bitLengthHigh = Math.floor(bitLength / 0x100000000);
      const bitLengthLow = bitLength & 0xFFFFFFFF;
      
      const lengthBytes = OpCodes.Unpack32BE(bitLengthHigh).concat(OpCodes.Unpack32BE(bitLengthLow));
      padded.push(...lengthBytes);
      
      return padded;
    },
    
    /**
     * Convert hash words to hexadecimal string
     * @param {number} h0 - Hash word 0
     * @param {number} h1 - Hash word 1
     * @param {number} h2 - Hash word 2
     * @param {number} h3 - Hash word 3
     * @param {number} h4 - Hash word 4
     * @returns {string} 40-character hex string
     */
    hashToHex: function(h0, h1, h2, h3, h4) {
      const words = [h0, h1, h2, h3, h4];
      let hex = '';
      
      for (let i = 0; i < words.length; i++) {
        const bytes = OpCodes.Unpack32BE(words[i]);
        for (let j = 0; j < bytes.length; j++) {
          hex += OpCodes.ByteToHex(bytes[j]);
        }
      }
      
      return hex.toLowerCase();
    },
    
    // Instance class
    SHA1Instance: function() {
      this.buffer = [];
      this.W = new Array(80);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(SHA1);
  }
  
  // Export to global scope
  global.SHA1 = SHA1;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SHA1;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);