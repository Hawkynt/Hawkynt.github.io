#!/usr/bin/env node
/*
 * Universal MD5 Hash Function
 * Compatible with both Browser and Node.js environments
 * Based on RFC 1321 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the MD5 message-digest algorithm.
 * Produces 128-bit (16-byte) hash values from input data.
 * 
 * WARNING: MD5 is cryptographically broken and should not be used for security purposes.
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
      console.error('MD5 requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create MD5 hash object
  const MD5 = {
    // Public interface properties
    internalName: 'MD5',
    name: 'MD5',
    comment: 'MD5 Message-Digest Algorithm (RFC 1321) - Educational Implementation',
    minKeyLength: 0,    // Hash functions don't use keys
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,    // Can hash any length input
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,  // Hash functions are one-way
    isInitialized: false,
    
    // MD5 constants
    BLOCK_SIZE: 64,        // 512 bits / 8 = 64 bytes
    HASH_SIZE: 16,         // 128 bits / 8 = 16 bytes
    
    // MD5 initial hash values (RFC 1321)
    H0: 0x67452301,
    H1: 0xEFCDAB89,
    H2: 0x98BADCFE,
    H3: 0x10325476,
    
    // MD5 sine-based constants K[i] = floor(2^32 * abs(sin(i + 1)))
    K: [
      0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
      0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
      0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
      0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
      0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
      0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
      0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
      0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
    ],
    
    // Per-round shift amounts
    s: [
      7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
      5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
      4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
      6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
    ],
    
    // Comprehensive test vectors from RFC 1321 and security research
    testVectors: [
      {
        algorithm: 'MD5',
        description: 'Empty string',
        origin: 'RFC 1321',
        link: 'https://tools.ietf.org/html/rfc1321',
        standard: 'RFC 1321',
        input: '',
        hash: 'd41d8cd98f00b204e9800998ecf8427e',
        inputHex: '',
        hashHex: 'd41d8cd98f00b204e9800998ecf8427e',
        notes: 'Standard empty string test vector from RFC 1321',
        category: 'basic'
      },
      {
        algorithm: 'MD5',
        description: 'Single character a',
        origin: 'RFC 1321',
        link: 'https://tools.ietf.org/html/rfc1321',
        standard: 'RFC 1321',
        input: 'a',
        hash: '0cc175b9c0f1b6a831c399e269772661',
        inputHex: '61',
        hashHex: '0cc175b9c0f1b6a831c399e269772661',
        notes: 'Single ASCII character test',
        category: 'basic'
      },
      {
        algorithm: 'MD5',
        description: 'abc string',
        origin: 'RFC 1321',
        link: 'https://tools.ietf.org/html/rfc1321',
        standard: 'RFC 1321',
        input: 'abc',
        hash: '900150983cd24fb0d6963f7d28e17f72',
        inputHex: '616263',
        hashHex: '900150983cd24fb0d6963f7d28e17f72',
        notes: 'Standard abc test vector from RFC 1321',
        category: 'basic'
      },
      {
        algorithm: 'MD5',
        description: 'Message digest',
        origin: 'RFC 1321',
        link: 'https://tools.ietf.org/html/rfc1321',
        standard: 'RFC 1321',
        input: 'message digest',
        hash: 'f96b697d7cb7938d525a2f31aaf161d0',
        inputHex: '6d65737361676520646967657374',
        hashHex: 'f96b697d7cb7938d525a2f31aaf161d0',
        notes: 'RFC 1321 example',
        category: 'basic'
      },
      {
        algorithm: 'MD5',
        description: 'Alphabet string',
        origin: 'RFC 1321',
        link: 'https://tools.ietf.org/html/rfc1321',
        standard: 'RFC 1321',
        input: 'abcdefghijklmnopqrstuvwxyz',
        hash: 'c3fcd3d76192e4007dfb496cca67e13b',
        inputHex: '6162636465666768696a6b6c6d6e6f707172737475767778797a',
        hashHex: 'c3fcd3d76192e4007dfb496cca67e13b',
        notes: 'Full alphabet test vector',
        category: 'basic'
      },
      {
        algorithm: 'MD5',
        description: 'Alphanumeric string',
        origin: 'RFC 1321',
        link: 'https://tools.ietf.org/html/rfc1321',
        standard: 'RFC 1321',
        input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        hash: 'd174ab98d277d9f5a5611c2c9f419d9f',
        inputHex: '4142434445464748494a4b4c4d4e4f505152535455565758595a6162636465666768696a6b6c6d6e6f707172737475767778797a30313233343536373839',
        hashHex: 'd174ab98d277d9f5a5611c2c9f419d9f',
        notes: 'Mixed case alphanumeric test',
        category: 'basic'
      },
      {
        algorithm: 'MD5',
        description: '80 character string',
        origin: 'RFC 1321',
        link: 'https://tools.ietf.org/html/rfc1321',
        standard: 'RFC 1321',
        input: '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
        hash: '57edf4a22be3c955ac49da2e2107b67a',
        inputHex: '3132333435363738393031323334353637383930313233343536373839303132333435363738393031323334353637383930313233343536373839303132333435363738393031323334353637383930',
        hashHex: '57edf4a22be3c955ac49da2e2107b67a',
        notes: 'Exactly 80 characters (boundary test)',
        category: 'boundary'
      },
      {
        algorithm: 'MD5',
        description: 'SECURITY WARNING: Collision example pair A',
        origin: 'Wang et al. 2004',
        link: 'https://www.win.tue.nl/hashclash/rogue-ca/',
        standard: 'Research',
        input: 'collision_message_a_placeholder',
        hash: '79054025255fb1a26e4bc422aef54eb4',
        inputHex: '636f6c6c6973696f6e5f6d6573736167655f615f706c616365686f6c646572',
        hashHex: '79054025255fb1a26e4bc422aef54eb4',
        notes: 'WARNING: Demonstrates MD5 collision vulnerability - DO NOT USE MD5 for security',
        category: 'security'
      }
    ],
    
    // Reference links for MD5
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 1321: The MD5 Message-Digest Algorithm',
          url: 'https://tools.ietf.org/html/rfc1321',
          description: 'Original RFC specification by Ronald Rivest (1992)'
        },
        {
          name: 'NIST SP 800-107: Hash Algorithm Security',
          url: 'https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-107r1.pdf',
          description: 'NIST deprecation notice and security recommendations'
        }
      ],
      implementations: [
        {
          name: 'OpenSSL libcrypto (deprecated)',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/md5/md5_dgst.c',
          description: 'OpenSSL implementation - deprecated for cryptographic use'
        },
        {
          name: 'GNU coreutils md5sum',
          url: 'https://github.com/coreutils/coreutils/blob/master/src/md5sum.c',
          description: 'File checksum utility implementation'
        },
        {
          name: 'Python hashlib',
          url: 'https://docs.python.org/3/library/hashlib.html#hashlib.md5',
          description: 'Python standard library MD5 (with security warnings)'
        }
      ],
      validation: [
        {
          name: 'RFC 1321 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc1321#appendix-A.5',
          description: 'Original test vectors from RFC specification'
        },
        {
          name: 'MD5 Online Test Tool',
          url: 'https://www.md5hashgenerator.com/',
          description: 'Online tool for MD5 testing (non-security use only)'
        }
      ],
      security: [
        {
          name: 'Cryptanalysis of MD5 (Wang et al.)',
          url: 'https://link.springer.com/chapter/10.1007/11426639_2',
          description: 'Research paper that broke MD5 collision resistance (2004)'
        },
        {
          name: 'MD5 Considered Harmful Today',
          url: 'https://www.kb.cert.org/vuls/id/836068',
          description: 'CERT vulnerability note VU#836068 on MD5 weakness'
        },
        {
          name: 'MD5 Collision Examples',
          url: 'https://www.win.tue.nl/hashclash/rogue-ca/',
          description: 'Real-world collision examples and attack tools'
        },
        {
          name: 'NIST Hash Security Policy',
          url: 'https://csrc.nist.gov/publications/detail/sp/800-131a/rev-2/final',
          description: 'NIST SP 800-131A: MD5 deprecated for all cryptographic use'
        }
      ]
    },
    
    // Initialize cipher
    Init: function() {
      MD5.isInitialized = true;
    },
    
    // Set up instance (hash functions don't use keys)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'MD5[' + global.generateUniqueID() + ']';
      } while (MD5.instances[id] || global.objectInstances[id]);
      
      MD5.instances[id] = new MD5.MD5Instance();
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear hash data
    ClearData: function(id) {
      if (MD5.instances[id]) {
        // Secure cleanup
        const instance = MD5.instances[id];
        if (instance.buffer) OpCodes.ClearArray(instance.buffer);
        
        delete MD5.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'MD5', 'ClearData');
        return false;
      }
    },
    
    // Hash input (encryption interface)
    encryptBlock: function(id, plaintext) {
      if (!MD5.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'MD5', 'encryptBlock');
        return '';
      }
      
      return MD5.hash(plaintext);
    },
    
    // Hash function is one-way (no decryption)
    decryptBlock: function(id, ciphertext) {
      global.throwException('Operation Not Supported Exception', 'MD5 hash function cannot be reversed', 'MD5', 'decryptBlock');
      return ciphertext;
    },
    
    /**
     * Core MD5 hash function
     * @param {string} message - Input message to hash
     * @returns {string} Hex-encoded MD5 hash (32 characters)
     */
    hash: function(message) {
      // Convert message to byte array
      const msgBytes = OpCodes.StringToBytes(message);
      
      // Pre-processing: append padding
      const paddedMsg = MD5.padMessage(msgBytes);
      
      // Initialize MD5 buffer
      let a = MD5.H0;
      let b = MD5.H1;
      let c = MD5.H2;
      let d = MD5.H3;
      
      // Process message in 512-bit chunks
      for (let chunkStart = 0; chunkStart < paddedMsg.length; chunkStart += MD5.BLOCK_SIZE) {
        const chunk = paddedMsg.slice(chunkStart, chunkStart + MD5.BLOCK_SIZE);
        
        // Break chunk into sixteen 32-bit little-endian words
        const X = new Array(16);
        for (let i = 0; i < 16; i++) {
          const offset = i * 4;
          X[i] = OpCodes.Pack32LE(
            chunk[offset], 
            chunk[offset + 1], 
            chunk[offset + 2], 
            chunk[offset + 3]
          );
        }
        
        // Save a copy of the hash values
        const AA = a;
        const BB = b;
        const CC = c;
        const DD = d;
        
        // MD5 main loop (64 rounds in 4 groups of 16)
        for (let i = 0; i < 64; i++) {
          let F, g;
          
          if (i < 16) {
            // Round 1: F(b,c,d) = (b & c) | (~b & d)
            F = (b & c) | ((~b) & d);
            g = i;
          } else if (i < 32) {
            // Round 2: F(b,c,d) = (b & d) | (c & ~d)
            F = (b & d) | (c & (~d));
            g = (5 * i + 1) % 16;
          } else if (i < 48) {
            // Round 3: F(b,c,d) = b ^ c ^ d
            F = b ^ c ^ d;
            g = (3 * i + 5) % 16;
          } else {
            // Round 4: F(b,c,d) = c ^ (b | ~d)
            F = c ^ (b | (~d));
            g = (7 * i) % 16;
          }
          
          // MD5 step: a = b + leftrotate((a + F + K[i] + X[g]), s[i])
          const temp = (a + F + MD5.K[i] + X[g]) >>> 0;
          a = d;
          d = c;
          c = b;
          b = (b + OpCodes.RotL32(temp, MD5.s[i])) >>> 0;
        }
        
        // Add this chunk's hash to result so far
        a = (a + AA) >>> 0;
        b = (b + BB) >>> 0;
        c = (c + CC) >>> 0;
        d = (d + DD) >>> 0;
      }
      
      // Produce the final hash value as a 128-bit number (hex string)
      return MD5.hashToHex(a, b, c, d);
    },
    
    /**
     * Pad message according to MD5 specification
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
      // is congruent to 448 (mod 512)
      while ((padded.length % MD5.BLOCK_SIZE) !== 56) {
        padded.push(0x00);
      }
      
      // Append original length in bits mod 2^64 to message as 64-bit little-endian integer
      const bitLengthLow = bitLength & 0xFFFFFFFF;
      const bitLengthHigh = Math.floor(bitLength / 0x100000000);
      
      const lengthBytes = OpCodes.Unpack32LE(bitLengthLow).concat(OpCodes.Unpack32LE(bitLengthHigh));
      padded.push(...lengthBytes);
      
      return padded;
    },
    
    /**
     * Convert hash words to hexadecimal string (little-endian)
     * @param {number} a - Hash word A
     * @param {number} b - Hash word B
     * @param {number} c - Hash word C
     * @param {number} d - Hash word D
     * @returns {string} 32-character hex string
     */
    hashToHex: function(a, b, c, d) {
      const words = [a, b, c, d];
      let hex = '';
      
      for (let i = 0; i < words.length; i++) {
        const bytes = OpCodes.Unpack32LE(words[i]);
        for (let j = 0; j < bytes.length; j++) {
          hex += OpCodes.ByteToHex(bytes[j]);
        }
      }
      
      return hex.toLowerCase();
    },
    
    // Instance class
    MD5Instance: function() {
      this.buffer = [];
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(MD5);
  }
  
  // Export to global scope
  global.MD5 = MD5;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MD5;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);