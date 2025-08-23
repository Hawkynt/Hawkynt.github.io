#!/usr/bin/env node
/*
 * SHA-1 Hash Function Implementation
 * Compatible with AlgorithmFramework.js
 * Based on RFC 3174 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the SHA-1 secure hash algorithm.
 * WARNING: SHA-1 is cryptographically broken - DO NOT USE for security!
 * Practical collision attacks were demonstrated in 2017.
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

  const { HashFunctionAlgorithm, IHashFunctionInstance, CategoryType, SecurityStatus, ComplexityType, CountryCode, TestCase, LinkItem, Vulnerability, RegisterAlgorithm } = Framework;

  // SHA-1 round constants (RFC 3174)
  const K = OpCodes.Hex32ToDWords('5A827999' + '6ED9EBA1' + '8F1BBCDC' + 'CA62C1D6');

  class SHA1Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "SHA-1";
      this.description = "Secure Hash Algorithm producing 160-bit digest. CRYPTOGRAPHICALLY BROKEN - practical collision attacks demonstrated in 2017. DO NOT USE for security purposes. Educational implementation only.";
      this.inventor = "National Security Agency (NSA)";
      this.year = 1995;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Hash-specific metadata
      this.SupportedOutputSizes = [
        { size: 20, description: "160-bit SHA-1 hash" }
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 3174: US Secure Hash Algorithm 1", "https://tools.ietf.org/html/rfc3174"),
        new LinkItem("NIST FIPS 180-1 (Superseded)", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-1.pdf"),
        new LinkItem("SHAttered Attack", "https://shattered.io/")
      ];

      this.references = [
        new LinkItem("OpenSSL Implementation (Deprecated)", "https://github.com/openssl/openssl/blob/master/crypto/sha/sha1dgst.c"),
        new LinkItem("RFC 3174 Specification", "https://tools.ietf.org/html/rfc3174"),
        new LinkItem("Git SHA-1DC Implementation", "https://github.com/git/git/blob/master/sha1dc/")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability("Collision Attack", "Practical collision attacks demonstrated in 2017. Two different PDFs can produce the same SHA-1 hash.", "Use SHA-256 or SHA-3 instead. Never use SHA-1 for digital signatures, certificates, or security purposes.")
      ];

      // Test vectors using OpCodes byte arrays
      this.tests = [
        {
          text: "Empty string test vector",
          uri: "https://tools.ietf.org/html/rfc3174",
          input: [],
          expected: OpCodes.Hex8ToBytes("da39a3ee5e6b4b0d3255bfef95601890afd80709")
        },
        {
          text: "Single character 'a' test vector",
          uri: "https://tools.ietf.org/html/rfc3174",
          input: [97], // "a"
          expected: OpCodes.Hex8ToBytes("86f7e437faa5a7fce15d1ddcb9eaeaea377667b8")
        },
        {
          text: "String 'abc' test vector",
          uri: "https://tools.ietf.org/html/rfc3174",
          input: [97, 98, 99], // "abc"
          expected: OpCodes.Hex8ToBytes("a9993e364706816aba3e25717850c26c9cd0d89d")
        },
        {
          text: "Message 'message digest' test vector",
          uri: "https://tools.ietf.org/html/rfc3174",
          input: [109, 101, 115, 115, 97, 103, 101, 32, 100, 105, 103, 101, 115, 116], // "message digest"
          expected: OpCodes.Hex8ToBytes("c12252ceda8be8994d5fa0290a47231c1d16aae3")
        },
        {
          text: "Alphabet test vector", 
          uri: "https://tools.ietf.org/html/rfc3174",
          input: [97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122], // "abcdefghijklmnopqrstuvwxyz"
          expected: OpCodes.Hex8ToBytes("32d10c7b8cf96570ca04ce37f2a19d84240d3a89")
        }
      ];
    }

    CreateInstance() {
      return new SHA1Instance(this);
    }
  }

  class SHA1Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 20; // 160 bits
      this._Reset();
    }

    _Reset() {
      // SHA-1 initial hash values (RFC 3174)
      this.h = new Uint32Array(OpCodes.Hex32ToDWords('67452301EFCDAB8998BADCFE10325476C3D2E1F0'));
      this.buffer = [];
      this.totalLength = 0;
    }

    Update(data) {
      if (!data || data.length === 0) return;
      
      this.buffer.push(...data);
      this.totalLength += data.length;
      
      // Process complete 64-byte blocks
      while (this.buffer.length >= 64) {
        const block = this.buffer.splice(0, 64);
        this._ProcessBlock(block);
      }
    }

    Final() {
      // Add padding
      const msgLength = this.totalLength;
      this.buffer.push(128); // Append bit '1' followed by zeros (0x80 = 128)
      
      // Pad to 448 bits (56 bytes) mod 512 bits (64 bytes)
      while (this.buffer.length % 64 !== 56) {
        this.buffer.push(0); // Zero padding
      }
      
      // Append original length as 64-bit big-endian
      const bitLength = msgLength * 8;
      const high32 = Math.floor(bitLength / 4294967296); // 2^32
      const low32 = bitLength & 4294967295; // 0xFFFFFFFF = 4294967295
      
      // High 32 bits (always 0 for practical message sizes)
      this.buffer.push(0, 0, 0, 0);
      // Low 32 bits
      this.buffer.push(
        (low32 >>> 24) & 255, // 0xFF = 255
        (low32 >>> 16) & 255, // 0xFF = 255
        (low32 >>> 8) & 255,  // 0xFF = 255
        low32 & 255           // 0xFF = 255
      );
      
      // Process final block(s)
      while (this.buffer.length > 0) {
        const block = this.buffer.splice(0, 64);
        this._ProcessBlock(block);
      }
      
      // Produce final hash value as byte array
      const result = [];
      for (let i = 0; i < 5; i++) {
        result.push(
          (this.h[i] >>> 24) & 255, // 0xFF = 255
          (this.h[i] >>> 16) & 255, // 0xFF = 255  
          (this.h[i] >>> 8) & 255,  // 0xFF = 255
          this.h[i] & 255           // 0xFF = 255
        );
      }
      
      this._Reset();
      return result;
    }

    _ProcessBlock(block) {
      // Break chunk into sixteen 32-bit big-endian words
      const w = new Array(80);
      for (let i = 0; i < 16; i++) {
        const offset = i * 4;
        w[i] = OpCodes.Pack32BE(
          block[offset], 
          block[offset + 1], 
          block[offset + 2], 
          block[offset + 3]
        );
      }
      
      // Extend the sixteen 32-bit words into eighty 32-bit words
      for (let i = 16; i < 80; i++) {
        w[i] = OpCodes.RotL32(w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16], 1);
      }
      
      // Initialize hash value for this chunk
      let a = this.h[0];
      let b = this.h[1];
      let c = this.h[2];
      let d = this.h[3];
      let e = this.h[4];
      
      // Main loop (80 rounds)
      for (let i = 0; i < 80; i++) {
        let f, k;
        
        if (i < 20) {
          f = (b & c) | ((~b) & d);
          k = K[0];
        } else if (i < 40) {
          f = b ^ c ^ d;
          k = K[1];
        } else if (i < 60) {
          f = (b & c) | (b & d) | (c & d);
          k = K[2];
        } else {
          f = b ^ c ^ d;
          k = K[3];
        }
        
        const temp = ((OpCodes.RotL32(a, 5) + f + e + k + w[i]) >>> 0);
        e = d;
        d = c;
        c = OpCodes.RotL32(b, 30);
        b = a;
        a = temp;
      }
      
      // Add this chunk's hash to result so far
      this.h[0] = (this.h[0] + a) >>> 0;
      this.h[1] = (this.h[1] + b) >>> 0;
      this.h[2] = (this.h[2] + c) >>> 0;
      this.h[3] = (this.h[3] + d) >>> 0;
      this.h[4] = (this.h[4] + e) >>> 0;
    }

    Hash(data) {
      this._Reset();
      this.Update(data);
      return this.Final();
    }

    Feed(data) {
      this.Update(data);
    }

    Result() {
      return this.Final();
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new SHA1Algorithm());

})(typeof global !== 'undefined' ? global : window);