/*
 * MD5 Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const MD5 = {
    name: "MD5",
    description: "128-bit cryptographic hash function. Fast but cryptographically broken.",
    inventor: "Ronald Rivest",
    year: 1991,
    country: "US",
    category: "hash",
    subCategory: "Cryptographic Hash",
    securityStatus: "insecure",
    securityNotes: "MD5 is cryptographically broken with practical collision attacks. DO NOT USE for security purposes. Educational only.",
    
    documentation: [
      {text: "RFC 1321 - MD5 Message-Digest Algorithm", uri: "https://tools.ietf.org/html/rfc1321"},
      {text: "NIST SP 800-107 - Hash Function Security", uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-107r1.pdf"},
      {text: "Wikipedia MD5", uri: "https://en.wikipedia.org/wiki/MD5"}
    ],
    
    references: [
      {text: "OpenSSL MD5 (deprecated)", uri: "https://github.com/openssl/openssl/blob/master/crypto/md5/md5_dgst.c"},
      {text: "MD5 Collision Research", uri: "https://www.win.tue.nl/hashclash/rogue-ca/"}
    ],
    
    knownVulnerabilities: [
      "Practical collision attacks (Wang et al. 2004)",
      "Chosen-prefix collision attacks",
      "Not suitable for any security application",
      "Vulnerable to rainbow table attacks"
    ],
    
    tests: [
      {
        text: "RFC 1321 Test Vector - Empty string",
        uri: "https://tools.ietf.org/html/rfc1321",
        input: OpCodes.ANSIToBytes(""),
        key: null,
        expected: OpCodes.Hex8ToBytes("d41d8cd98f00b204e9800998ecf8427e")
      },
      {
        text: "RFC 1321 Test Vector - 'a'",
        uri: "https://tools.ietf.org/html/rfc1321",
        input: OpCodes.ANSIToBytes("a"),
        key: null,
        expected: OpCodes.Hex8ToBytes("0cc175b9c0f1b6a831c399e269772661")
      },
      {
        text: "RFC 1321 Test Vector - 'abc'",
        uri: "https://tools.ietf.org/html/rfc1321",
        input: OpCodes.ANSIToBytes("abc"),
        key: null,
        expected: OpCodes.Hex8ToBytes("900150983cd24fb0d6963f7d28e17f72")
      }
    ],

    Init: function() {
      return true;
    },

    // MD5 constants
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

    // Core MD5 computation
    compute: function(data) {
      const msgBytes = Array.isArray(data) ? data : OpCodes.ANSIToBytes(data);
      
      // Pre-processing: append padding
      const paddedMsg = this.padMessage(msgBytes);
      
      // Initialize MD5 buffer
      let a = this.H0;
      let b = this.H1;
      let c = this.H2;
      let d = this.H3;
      
      // Process message in 512-bit chunks
      for (let chunkStart = 0; chunkStart < paddedMsg.length; chunkStart += 64) {
        const chunk = paddedMsg.slice(chunkStart, chunkStart + 64);
        
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
        const AA = a, BB = b, CC = c, DD = d;
        
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
          const temp = (a + F + this.K[i] + X[g]) >>> 0;
          a = d;
          d = c;
          c = b;
          b = (b + OpCodes.RotL32(temp, this.s[i])) >>> 0;
        }
        
        // Add this chunk's hash to result so far
        a = (a + AA) >>> 0;
        b = (b + BB) >>> 0;
        c = (c + CC) >>> 0;
        d = (d + DD) >>> 0;
      }
      
      // Convert to byte array (little-endian)
      const result = [];
      [a, b, c, d].forEach(word => {
        const bytes = OpCodes.Unpack32LE(word);
        result.push(...bytes);
      });
      
      return result;
    },

    padMessage: function(msgBytes) {
      const msgLength = msgBytes.length;
      const bitLength = msgLength * 8;
      
      // Create copy for padding
      const padded = msgBytes.slice();
      
      // Append the '1' bit (plus zero padding to make it a byte)
      padded.push(0x80);
      
      // Append 0 <= k < 512 bits '0', such that the resulting message length in bits
      // is congruent to 448 (mod 512)
      while ((padded.length % 64) !== 56) {
        padded.push(0x00);
      }
      
      // Append original length in bits mod 2^64 to message as 64-bit little-endian integer
      const bitLengthLow = bitLength & 0xFFFFFFFF;
      const bitLengthHigh = Math.floor(bitLength / 0x100000000);
      
      const lengthBytes = OpCodes.Unpack32LE(bitLengthLow).concat(OpCodes.Unpack32LE(bitLengthHigh));
      padded.push(...lengthBytes);
      
      return padded;
    }
  };

  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(MD5);
  

})(typeof global !== 'undefined' ? global : window);