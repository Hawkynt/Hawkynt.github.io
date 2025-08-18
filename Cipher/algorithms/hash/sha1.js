#!/usr/bin/env node
/*
 * SHA-1 Implementation
 * (c)2006-2025 Hawkynt
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
  
  const SHA1 = {
    name: "SHA-1",
    description: "Secure Hash Algorithm producing 160-bit digest. First SHA standard by NIST but now cryptographically broken due to collision attacks. Should not be used for security purposes.",
    inventor: "National Security Agency (NSA)", 
    year: 1995,
    country: "US",
    category: "hash",
    subCategory: "Cryptographic Hash",
    securityStatus: "insecure",
    securityNotes: "Completely broken by practical collision attacks in 2017 (SHAttered). Should never be used for cryptographic purposes. Educational use only.",
    
    documentation: [
      {text: "RFC 3174: US Secure Hash Algorithm 1", uri: "https://tools.ietf.org/html/rfc3174"},
      {text: "NIST FIPS 180-1 (Superseded)", uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-1.pdf"},
      {text: "SHAttered Attack", uri: "https://shattered.io/"}
    ],
    
    references: [
      {text: "OpenSSL Implementation (Deprecated)", uri: "https://github.com/openssl/openssl/blob/master/crypto/sha/sha1dgst.c"},
      {text: "RFC 3174 Specification", uri: "https://tools.ietf.org/html/rfc3174"},
      {text: "Git SHA-1DC Implementation", uri: "https://github.com/git/git/blob/master/sha1dc/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Collision Attack",
        text: "Practical collision attacks demonstrated in 2017. Two different PDFs can produce the same SHA-1 hash.",
        mitigation: "Use SHA-256 or SHA-3 instead. Never use SHA-1 for digital signatures, certificates, or security purposes."
      }
    ],
    
    tests: [
      {
        text: "Empty string test vector",
        uri: "https://tools.ietf.org/html/rfc3174",
        input: [],
        expected: OpCodes.Hex8ToBytes("da39a3ee5e6b4b0d3255bfef95601890afd80709")
      },
      {
        text: "Single character 'a' test vector",
        uri: "https://tools.ietf.org/html/rfc3174",
        input: OpCodes.StringToBytes("a"),
        expected: OpCodes.Hex8ToBytes("86f7e437faa5a7fce15d1ddcb9eaeaea377667b8")
      },
      {
        text: "String 'abc' test vector",
        uri: "https://tools.ietf.org/html/rfc3174",
        input: OpCodes.StringToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("a9993e364706816aba3e25717850c26c9cd0d89d")
      },
      {
        text: "Message 'message digest' test vector",
        uri: "https://tools.ietf.org/html/rfc3174",
        input: OpCodes.StringToBytes("message digest"),
        expected: OpCodes.Hex8ToBytes("c12252ceda8be8994d5fa0290a47231c1d16aae3")
      },
      {
        text: "Alphabet test vector",
        uri: "https://tools.ietf.org/html/rfc3174",
        input: OpCodes.StringToBytes("abcdefghijklmnopqrstuvwxyz"),
        expected: OpCodes.Hex8ToBytes("32d10c7b8cf96570ca04ce37f2a19d84240d3a89")
      }
    ],

    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,
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
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(SHA1);
  
  // Export to global scope
  global.SHA1 = SHA1;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SHA1;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);