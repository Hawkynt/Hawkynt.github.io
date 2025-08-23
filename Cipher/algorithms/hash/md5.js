#!/usr/bin/env node
/*
 * MD5 Hash Function Implementation
 * Compatible with AlgorithmFramework.js
 * Based on RFC 1321 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the MD5 message-digest algorithm.
 * WARNING: MD5 is cryptographically broken - DO NOT USE for security!
 */

(function(global) {
  'use strict';
  
  // Load dependencies
  if (typeof require !== 'undefined') {
    try {
      const path = require('path');
      require(path.resolve(__dirname, '../../OpCodes.js'));
      require(path.resolve(__dirname, '../../AlgorithmFramework.js'));
    } catch (e) {
      console.error('Failed to load dependencies:', e.message);
      return;
    }
  }

  // Ensure framework is available
  const Framework = global.AlgorithmFramework;
  if (!Framework) {
    console.error('AlgorithmFramework not found');
    return;
  }

  const { HashFunctionAlgorithm, IHashFunctionInstance, CategoryType, SecurityStatus, ComplexityType, CountryCode, TestCase, LinkItem, Vulnerability } = Framework;

  class MD5Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 16; // 128 bits
      this._Reset();
    }

    _Reset() {
      // MD5 initialization values (RFC 1321)
      this.h = new Uint32Array([
        0x67452301,
        0xEFCDAB89,
        0x98BADCFE,
        0x10325476
      ]);
      
      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.totalLength = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      
      const input = new Uint8Array(data);
      this.totalLength += input.length;
      
      let offset = 0;
      
      // Process any remaining bytes in buffer
      if (this.bufferLength > 0) {
        const needed = 64 - this.bufferLength;
        const available = Math.min(needed, input.length);
        
        this.buffer.set(input.slice(0, available), this.bufferLength);
        this.bufferLength += available;
        offset = available;
        
        if (this.bufferLength === 64) {
          this._ProcessBlock(this.buffer);
          this.bufferLength = 0;
        }
      }
      
      // Process complete 64-byte blocks
      while (offset + 64 <= input.length) {
        this._ProcessBlock(input.slice(offset, offset + 64));
        offset += 64;
      }
      
      // Store remaining bytes in buffer
      if (offset < input.length) {
        const remaining = input.slice(offset);
        this.buffer.set(remaining, 0);
        this.bufferLength = remaining.length;
      }
    }

    Result() {
      // Create padding
      const msgLength = this.totalLength;
      const padLength = (msgLength % 64 < 56) ? (56 - (msgLength % 64)) : (120 - (msgLength % 64));
      
      // Add padding
      const padding = new Uint8Array(padLength + 8);
      padding[0] = 0x80; // First padding bit is 1
      
      // Add length in bits as 64-bit little-endian
      const bitLength = msgLength * 8;
      for (let i = 0; i < 8; i++) {
        padding[padLength + i] = (bitLength >>> (i * 8)) & 0xFF;
      }
      
      this.Feed(padding);
      
      // Convert hash to bytes (little-endian)
      const result = new Uint8Array(16);
      for (let i = 0; i < 4; i++) {
        result[i * 4] = this.h[i] & 0xFF;
        result[i * 4 + 1] = (this.h[i] >>> 8) & 0xFF;
        result[i * 4 + 2] = (this.h[i] >>> 16) & 0xFF;
        result[i * 4 + 3] = (this.h[i] >>> 24) & 0xFF;
      }
      
      return Array.from(result);
    }

    _ProcessBlock(block) {
      // Convert block to 32-bit words (little-endian)
      const w = new Uint32Array(16);
      for (let i = 0; i < 16; i++) {
        w[i] = block[i * 4] | 
               (block[i * 4 + 1] << 8) | 
               (block[i * 4 + 2] << 16) | 
               (block[i * 4 + 3] << 24);
      }
      
      // Initialize working variables
      let a = this.h[0], b = this.h[1], c = this.h[2], d = this.h[3];
      
      // MD5 round constants (RFC 1321)
      const k = [
        0xD76AA478, 0xE8C7B756, 0x242070DB, 0xC1BDCEEE, 0xF57C0FAF, 0x4787C62A, 0xA8304613, 0xFD469501,
        0x698098D8, 0x8B44F7AF, 0xFFFF5BB1, 0x895CD7BE, 0x6B901122, 0xFD987193, 0xA679438E, 0x49B40821,
        0xF61E2562, 0xC040B340, 0x265E5A51, 0xE9B6C7AA, 0xD62F105D, 0x02441453, 0xD8A1E681, 0xE7D3FBC8,
        0x21E1CDE6, 0xC33707D6, 0xF4D50D87, 0x455A14ED, 0xA9E3E905, 0xFCEFA3F8, 0x676F02D9, 0x8D2A4C8A,
        0xFFFA3942, 0x8771F681, 0x6D9D6122, 0xFDE5380C, 0xA4BEEA44, 0x4BDECFA9, 0xF6BB4B60, 0xBEBFBC70,
        0x289B7EC6, 0xEAA127FA, 0xD4EF3085, 0x04881D05, 0xD9D4D039, 0xE6DB99E5, 0x1FA27CF8, 0xC4AC5665,
        0xF4292244, 0x432AFF97, 0xAB9423A7, 0xFC93A039, 0x655B59C3, 0x8F0CCC92, 0xFFEFF47D, 0x85845DD1,
        0x6FA87E4F, 0xFE2CE6E0, 0xA3014314, 0x4E0811A1, 0xF7537E82, 0xBD3AF235, 0x2AD7D2BB, 0xEB86D391
      ];
      
      // MD5 auxiliary functions
      const F = (x, y, z) => (x & y) | (~x & z);
      const G = (x, y, z) => (x & z) | (y & ~z);
      const H = (x, y, z) => x ^ y ^ z;
      const I = (x, y, z) => y ^ (x | ~z);
      
      // Rotate left
      const rotl = (x, n) => (x << n) | (x >>> (32 - n));
      
      // MD5 shift amounts per round (RFC 1321)
      const shifts = [
        7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
        5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
        4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
        6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
      ];
      
      // MD5 rounds
      for (let i = 0; i < 64; i++) {
        let f, g;
        
        if (i < 16) {
          f = F(b, c, d);
          g = i;
        } else if (i < 32) {
          f = G(b, c, d);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          f = H(b, c, d);
          g = (3 * i + 5) % 16;
        } else {
          f = I(b, c, d);
          g = (7 * i) % 16;
        }
        
        f = (f + a + k[i] + w[g]) >>> 0;
        a = d;
        d = c;
        c = b;
        b = (b + rotl(f, shifts[i])) >>> 0;
      }
      
      // Add to hash
      this.h[0] = (this.h[0] + a) >>> 0;
      this.h[1] = (this.h[1] + b) >>> 0;
      this.h[2] = (this.h[2] + c) >>> 0;
      this.h[3] = (this.h[3] + d) >>> 0;
    }
  }

  class MD5Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      
      // Basic information
      this.name = "MD5";
      this.description = "128-bit cryptographic hash function designed by Ronald Rivest. Fast but cryptographically broken with practical collision attacks.";
      this.inventor = "Ronald Rivest";
      this.year = 1991;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;
      
      // Capabilities
      this.SupportedOutputSizes = [{ minSize: 16, maxSize: 16, stepSize: 1 }];
      
      // Documentation
      this.documentation = [
        new LinkItem("RFC 1321 - The MD5 Message-Digest Algorithm", "https://tools.ietf.org/html/rfc1321"),
        new LinkItem("NIST SP 800-107 - Recommendation for Applications Using Approved Hash Algorithms", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-107r1.pdf"),
        new LinkItem("Wikipedia - MD5", "https://en.wikipedia.org/wiki/MD5")
      ];
      
      // References
      this.references = [
        new LinkItem("OpenSSL MD5 Implementation", "https://github.com/openssl/openssl/blob/master/crypto/md5/md5_dgst.c"),
        new LinkItem("MD5 Collision Research", "https://www.win.tue.nl/hashclash/rogue-ca/"),
        new LinkItem("RFC 6151 - Updated Security Considerations for MD5", "https://tools.ietf.org/html/rfc6151")
      ];
      
      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability("Collision Attack", "Practical collision attacks demonstrated by Wang et al. in 2004. Can generate two different messages with same MD5 hash.", "https://eprint.iacr.org/2004/199.pdf"),
        new Vulnerability("Chosen-prefix Collision", "Attackers can create collisions with chosen prefixes, enabling sophisticated attacks.", "https://www.win.tue.nl/hashclash/rogue-ca/"),
        new Vulnerability("Rainbow Table Attack", "Common passwords vulnerable to precomputed rainbow table attacks.", "")
      ];
      
      // Test vectors from RFC 1321
      this.tests = [
        {
          input: [],
          expected: global.OpCodes.Hex8ToBytes("d41d8cd98f00b204e9800998ecf8427e"),
          text: "RFC 1321 Test Vector - Empty string",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: global.OpCodes.AnsiToBytes("a"),
          expected: global.OpCodes.Hex8ToBytes("0cc175b9c0f1b6a831c399e269772661"),
          text: "RFC 1321 Test Vector - 'a'",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: global.OpCodes.AnsiToBytes("abc"),
          expected: global.OpCodes.Hex8ToBytes("900150983cd24fb0d6963f7d28e17f72"),
          text: "RFC 1321 Test Vector - 'abc'",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: global.OpCodes.AnsiToBytes("message digest"),
          expected: global.OpCodes.Hex8ToBytes("f96b697d7cb7938d525a2f31aaf161d0"),
          text: "RFC 1321 Test Vector - 'message digest'",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: global.OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
          expected: global.OpCodes.Hex8ToBytes("c3fcd3d76192e4007dfb496cca67e13b"),
          text: "RFC 1321 Test Vector - alphabet",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: global.OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
          expected: global.OpCodes.Hex8ToBytes("d174ab98d277d9f5a5611c2c9f419d9f"),
          text: "RFC 1321 Test Vector - alphanumeric",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: global.OpCodes.AnsiToBytes("1234567890".repeat(8)),
          expected: global.OpCodes.Hex8ToBytes("57edf4a22be3c955ac49da2e2107b67a"),
          text: "RFC 1321 Test Vector - numeric sequence",
          uri: "https://tools.ietf.org/html/rfc1321"
        }
      ];
    }

    CreateInstance(isInverse = false) {
      // Hash functions don't have an inverse operation
      if (isInverse) {
        return null;
      }
      return new MD5Instance(this);
    }
  }

  // Register the algorithm
  if (Framework.RegisterAlgorithm) {
    Framework.RegisterAlgorithm(new MD5Algorithm());
  }

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this)));
