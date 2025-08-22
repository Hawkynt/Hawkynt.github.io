#!/usr/bin/env node
/*
 * Adler-32 Checksum Implementation
 * Compatible with AlgorithmFramework.js
 * Based on RFC 1950 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the Adler-32 checksum algorithm.
 * NOTE: Adler-32 is designed for error detection, not cryptographic security.
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


  class Adler32Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      
      // Basic information
      this.name = "Adler-32";
      this.description = "Fast 32-bit checksum algorithm created by Mark Adler. Used in zlib compression for error detection with good performance.";
      this.inventor = "Mark Adler";
      this.year = 1995;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Non-Cryptographic";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;
      
      // Capabilities
      this.SupportedOutputSizes = [{ minSize: 4, maxSize: 4, stepSize: 1 }];
      
      // Documentation
      this.documentation = [
        new LinkItem("RFC 1950 - ZLIB Compressed Data Format", "https://tools.ietf.org/html/rfc1950"),
        new LinkItem("Wikipedia - Adler-32", "https://en.wikipedia.org/wiki/Adler-32"),
        new LinkItem("zlib Home Page", "https://www.zlib.net/")
      ];
      
      // References
      this.references = [
        new LinkItem("zlib Source Code", "https://github.com/madler/zlib"),
        new LinkItem("Adler-32 in PNG Specification", "https://www.w3.org/TR/PNG/"),
        new LinkItem("Error Detection Performance Analysis", "https://users.ece.cmu.edu/~koopman/pubs/maxino09_crc_poly_embedded.pdf")
      ];
      
      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability("Not Cryptographically Secure", "Adler-32 is designed for error detection only, not security. Can be easily forged by attackers.", ""),
        new Vulnerability("Collision Attacks", "Intentional collisions can be easily generated due to the simple mathematical structure.", ""),
        new Vulnerability("Limited Error Detection", "Less effective than CRC-32 for certain types of burst errors.", "")
      ];
      
      // Test vectors from RFC 1950 and other sources
      this.tests = [
        {
          input: [],
          expected: [0x00, 0x00, 0x00, 0x01],
          text: "RFC 1950 Test Vector - Empty string",
          uri: "https://tools.ietf.org/html/rfc1950"
        },
        {
          input: global.OpCodes.AnsiToBytes("a"),
          expected: [0x00, 0x62, 0x00, 0x62],
          text: "Single byte 'a'",
          uri: ""
        },
        {
          input: global.OpCodes.AnsiToBytes("abc"),
          expected: [0x02, 0x4D, 0x01, 0x27],
          text: "String 'abc'",
          uri: ""
        },
        {
          input: global.OpCodes.AnsiToBytes("Wikipedia"),
          expected: [0x11, 0xE6, 0x03, 0x98],
          text: "Wikipedia example - 'Wikipedia'",
          uri: "https://en.wikipedia.org/wiki/Adler-32"
        },
        {
          input: global.OpCodes.AnsiToBytes("message digest"),
          expected: [0x29, 0x75, 0x05, 0x86],
          text: "String 'message digest'",
          uri: ""
        },
        {
          input: global.OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
          expected: [0x90, 0x86, 0x0B, 0x20],
          text: "Alphabet string",
          uri: ""
        },
        {
          input: global.OpCodes.AnsiToBytes("1234567890".repeat(8)),
          expected: [0x97, 0x3B, 0x61, 0x7E],
          text: "Numeric sequence (80 chars)",
          uri: ""
        }
      ];
    }

    CreateInstance(isInverse = false) {
      // Checksum functions don't have an inverse operation
      if (isInverse) {
        return null;
      }
      return new Adler32Instance(this);
    }
  }

  class Adler32Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 4; // 32 bits
      this._Reset();
    }

    _Reset() {
      this.a = 1;
      this.b = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      
      const input = new Uint8Array(data);
      const MOD_ADLER = 65521; // Largest prime less than 2^16
      
      for (let i = 0; i < input.length; i++) {
        this.a = (this.a + input[i]) % MOD_ADLER;
        this.b = (this.b + this.a) % MOD_ADLER;
      }
    }

    Result() {
      // Combine a and b into 32-bit checksum (big-endian)
      const checksum = ((this.b << 16) | this.a) >>> 0;
      
      return [
        (checksum >>> 24) & 0xFF,
        (checksum >>> 16) & 0xFF,
        (checksum >>> 8) & 0xFF,
        checksum & 0xFF
      ];
    }
  }

  // Register the algorithm
  if (Framework.RegisterAlgorithm) {
    Framework.RegisterAlgorithm(new Adler32Algorithm());
  }

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this)));