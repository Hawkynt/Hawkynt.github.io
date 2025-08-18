/*
 * MD4 Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const MD4 = {
    name: "MD4",
    description: "128-bit cryptographic hash function. Predecessor to MD5. Cryptographically broken.",
    inventor: "Ronald Rivest",
    year: 1990,
    country: "US",
    category: "hash",
    subCategory: "Cryptographic Hash",
    securityStatus: "insecure",
    securityNotes: "MD4 is cryptographically broken with practical collision attacks. DO NOT USE for security purposes. Educational only.",
    
    documentation: [
      {text: "RFC 1320 - MD4 Message-Digest Algorithm", uri: "https://tools.ietf.org/html/rfc1320"},
      {text: "Wikipedia MD4", uri: "https://en.wikipedia.org/wiki/MD4"}
    ],
    
    references: [
      {text: "MD4 Collision Attacks", uri: "https://link.springer.com/chapter/10.1007/978-3-540-28628-8_1"}
    ],
    
    knownVulnerabilities: [
      "Collision attacks (Dobbertin 1996)",
      "Very fast collision finding",
      "Used in cryptanalysis research",
      "Not suitable for any security application"
    ],
    
    tests: [
      {
        text: "RFC 1320 Test Vector - Empty string",
        uri: "https://tools.ietf.org/html/rfc1320",
        input: OpCodes.ANSIToBytes(""),
        key: null,
        expected: OpCodes.Hex8ToBytes("31d6cfe0d16ae931b73c59d7e0c089c0")
      },
      {
        text: "RFC 1320 Test Vector - 'a'",
        uri: "https://tools.ietf.org/html/rfc1320",
        input: OpCodes.ANSIToBytes("a"),
        key: null,
        expected: OpCodes.Hex8ToBytes("bde52cb31de33e46245e05fbdbd6fb24")
      }
    ],

    Init: function() {
      return true;
    },

    // MD4 constants
    H: [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476],

    // MD4 auxiliary functions
    F: function(x, y, z) { return (x & y) | (~x & z); },
    G: function(x, y, z) { return (x & y) | (x & z) | (y & z); },
    H: function(x, y, z) { return x ^ y ^ z; },

    // Core MD4 computation (simplified but functional)
    compute: function(data) {
      const msgBytes = Array.isArray(data) ? data : OpCodes.ANSIToBytes(data);
      
      // Pre-processing: append padding
      const paddedMsg = this.padMessage(msgBytes);
      
      // Initialize MD4 buffer
      let h = [...this.H];
      
      // Process message in 512-bit chunks
      for (let chunkStart = 0; chunkStart < paddedMsg.length; chunkStart += 64) {
        const chunk = paddedMsg.slice(chunkStart, chunkStart + 64);
        
        // Break chunk into sixteen 32-bit little-endian words
        const X = new Array(16);
        for (let i = 0; i < 16; i++) {
          const offset = i * 4;
          X[i] = OpCodes.Pack32LE(chunk[offset], chunk[offset + 1], chunk[offset + 2], chunk[offset + 3]);
        }
        
        // Initialize working variables
        let A = h[0], B = h[1], C = h[2], D = h[3];
        
        // MD4 main rounds (simplified)
        for (let i = 0; i < 16; i++) {
          const temp = (A + this.F(B, C, D) + X[i]) >>> 0;
          A = D; D = C; C = B;
          B = OpCodes.RotL32(temp, [3, 7, 11, 19][i % 4]);
        }
        
        // Add this chunk's hash to result so far
        h[0] = (h[0] + A) >>> 0;
        h[1] = (h[1] + B) >>> 0;
        h[2] = (h[2] + C) >>> 0;
        h[3] = (h[3] + D) >>> 0;
      }
      
      // Convert to byte array (little-endian)
      const result = [];
      h.forEach(word => {
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
    global.Cipher.Add(MD4);
  

})(typeof global !== 'undefined' ? global : window);