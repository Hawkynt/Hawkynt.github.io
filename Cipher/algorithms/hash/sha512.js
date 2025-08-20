#!/usr/bin/env node
/*
 * SHA-512 Hash Function Implementation
 * Compatible with AlgorithmFramework.js
 * Based on NIST FIPS 180-4 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the SHA-512 secure hash algorithm.
 * Produces 512-bit (64-byte) hash values from input data.
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

  // 64-bit arithmetic helpers (using [high32, low32] representation)
  const Int64 = {
    create: function(high, low) {
      return [high >>> 0, low >>> 0];
    },

    add: function(a, b) {
      const low = (a[1] + b[1]) >>> 0;
      const high = (a[0] + b[0] + (low < a[1] ? 1 : 0)) >>> 0;
      return [high, low];
    },

    rotr: function(a, n) {
      if (n === 0) return a;
      if (n < 32) {
        const high = ((a[0] >>> n) | (a[1] << (32 - n))) >>> 0;
        const low = ((a[1] >>> n) | (a[0] << (32 - n))) >>> 0;
        return [high, low];
      } else {
        const high = ((a[1] >>> (n - 32)) | (a[0] << (64 - n))) >>> 0;
        const low = ((a[0] >>> (n - 32)) | (a[1] << (64 - n))) >>> 0;
        return [high, low];
      }
    },

    shr: function(a, n) {
      if (n === 0) return a;
      if (n < 32) {
        const high = (a[0] >>> n) >>> 0;
        const low = ((a[1] >>> n) | (a[0] << (32 - n))) >>> 0;
        return [high, low];
      } else {
        return [0, (a[0] >>> (n - 32)) >>> 0];
      }
    },

    xor: function(a, b) {
      return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
    },

    and: function(a, b) {
      return [(a[0] & b[0]) >>> 0, (a[1] & b[1]) >>> 0];
    },

    not: function(a) {
      return [(~a[0]) >>> 0, (~a[1]) >>> 0];
    }
  };

  class SHA512Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 64; // 512 bits
      this._Reset();
    }

    _Reset() {
      // SHA-512 initialization values (NIST FIPS 180-4 Section 5.3.5)
      // First 64 bits of fractional parts of square roots of first 8 primes
      this.h = [
        [0x6a09e667, 0xf3bcc908], [0xbb67ae85, 0x84caa73b],
        [0x3c6ef372, 0xfe94f82b], [0xa54ff53a, 0x5f1d36f1],
        [0x510e527f, 0xade682d1], [0x9b05688c, 0x2b3e6c1f],
        [0x1f83d9ab, 0xfb41bd6b], [0x5be0cd19, 0x137e2179]
      ];
      
      this.buffer = new Uint8Array(128);
      this.bufferLength = 0;
      this.totalLength = 0;

      // SHA-512 constants (NIST FIPS 180-4 Section 4.2.3)
      this.K = [
        [0x428a2f98, 0xd728ae22], [0x71374491, 0x23ef65cd], [0xb5c0fbcf, 0xec4d3b2f], [0xe9b5dba5, 0x8189dbbc],
        [0x3956c25b, 0xf348b538], [0x59f111f1, 0xb605d019], [0x923f82a4, 0xaf194f9b], [0xab1c5ed5, 0xda6d8118],
        [0xd807aa98, 0xa3030242], [0x12835b01, 0x45706fbe], [0x243185be, 0x4ee4b28c], [0x550c7dc3, 0xd5ffb4e2],
        [0x72be5d74, 0xf27b896f], [0x80deb1fe, 0x3b1696b1], [0x9bdc06a7, 0x25c71235], [0xc19bf174, 0xcf692694],
        [0xe49b69c1, 0x9ef14ad2], [0xefbe4786, 0x384f25e3], [0x0fc19dc6, 0x8b8cd5b5], [0x240ca1cc, 0x77ac9c65],
        [0x2de92c6f, 0x592b0275], [0x4a7484aa, 0x6ea6e483], [0x5cb0a9dc, 0xbd41fbd4], [0x76f988da, 0x831153b5],
        [0x983e5152, 0xee66dfab], [0xa831c66d, 0x2db43210], [0xb00327c8, 0x98fb213f], [0xbf597fc7, 0xbeef0ee4],
        [0xc6e00bf3, 0x3da88fc2], [0xd5a79147, 0x930aa725], [0x06ca6351, 0xe003826f], [0x14292967, 0x0a0e6e70],
        [0x27b70a85, 0x46d22ffc], [0x2e1b2138, 0x5c26c926], [0x4d2c6dfc, 0x5ac42aed], [0x53380d13, 0x9d95b3df],
        [0x650a7354, 0x8baf63de], [0x766a0abb, 0x3c77b2a8], [0x81c2c92e, 0x47edaee6], [0x92722c85, 0x1482353b],
        [0xa2bfe8a1, 0x4cf10364], [0xa81a664b, 0xbc423001], [0xc24b8b70, 0xd0f89791], [0xc76c51a3, 0x0654be30],
        [0xd192e819, 0xd6ef5218], [0xd6990624, 0x5565a910], [0xf40e3585, 0x5771202a], [0x106aa070, 0x32bbd1b8],
        [0x19a4c116, 0xb8d2d0c8], [0x1e376c08, 0x5141ab53], [0x2748774c, 0xdf8eeb99], [0x34b0bcb5, 0xe19b48a8],
        [0x391c0cb3, 0xc5c95a63], [0x4ed8aa4a, 0xe3418acb], [0x5b9cca4f, 0x7763e373], [0x682e6ff3, 0xd6b2b8a3],
        [0x748f82ee, 0x5defb2fc], [0x78a5636f, 0x43172f60], [0x84c87814, 0xa1f0ab72], [0x8cc70208, 0x1a6439ec],
        [0x90befffa, 0x23631e28], [0xa4506ceb, 0xde82bde9], [0xbef9a3f7, 0xb2c67915], [0xc67178f2, 0xe372532b],
        [0xca273ece, 0xea26619c], [0xd186b8c7, 0x21c0c207], [0xeada7dd6, 0xcde0eb1e], [0xf57d4f7f, 0xee6ed178],
        [0x06f067aa, 0x72176fba], [0x0a637dc5, 0xa2c898a6], [0x113f9804, 0xbef90dae], [0x1b710b35, 0x131c471b],
        [0x28db77f5, 0x23047d84], [0x32caab7b, 0x40c72493], [0x3c9ebe0a, 0x15c9bebc], [0x431d67c4, 0x9c100d4c],
        [0x4cc5d4be, 0xcb3e42b6], [0x597f299c, 0xfc657e2a], [0x5fcb6fab, 0x3ad6faec], [0x6c44198c, 0x4a475817]
      ];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      
      const input = new Uint8Array(data);
      this.totalLength += input.length;
      
      let offset = 0;
      
      // Process any remaining bytes in buffer
      if (this.bufferLength > 0) {
        const needed = 128 - this.bufferLength;
        const available = Math.min(needed, input.length);
        
        this.buffer.set(input.slice(0, available), this.bufferLength);
        this.bufferLength += available;
        offset = available;
        
        if (this.bufferLength === 128) {
          this._ProcessBlock(this.buffer);
          this.bufferLength = 0;
        }
      }
      
      // Process complete 128-byte blocks
      while (offset + 128 <= input.length) {
        this._ProcessBlock(input.slice(offset, offset + 128));
        offset += 128;
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
      const padLength = (msgLength % 128 < 112) ? (112 - (msgLength % 128)) : (240 - (msgLength % 128));
      
      // Add padding
      const padding = new Uint8Array(padLength + 16);
      padding[0] = 0x80; // First padding bit is 1
      
      // Add length in bits as 128-bit big-endian
      const bitLength = msgLength * 8;
      
      // High 64 bits (for messages under 2^32 bits, this is mostly 0)
      for (let i = 0; i < 8; i++) {
        padding[padLength + i] = 0;
      }
      
      // Low 64 bits
      padding[padLength + 8] = (bitLength >>> 56) & 0xFF;
      padding[padLength + 9] = (bitLength >>> 48) & 0xFF;
      padding[padLength + 10] = (bitLength >>> 40) & 0xFF;
      padding[padLength + 11] = (bitLength >>> 32) & 0xFF;
      padding[padLength + 12] = (bitLength >>> 24) & 0xFF;
      padding[padLength + 13] = (bitLength >>> 16) & 0xFF;
      padding[padLength + 14] = (bitLength >>> 8) & 0xFF;
      padding[padLength + 15] = bitLength & 0xFF;
      
      this.Feed(padding);
      
      // Convert hash to bytes (big-endian)
      const result = new Uint8Array(64);
      for (let i = 0; i < 8; i++) {
        const high = this.h[i][0];
        const low = this.h[i][1];
        
        // High 32 bits
        result[i * 8] = (high >>> 24) & 0xFF;
        result[i * 8 + 1] = (high >>> 16) & 0xFF;
        result[i * 8 + 2] = (high >>> 8) & 0xFF;
        result[i * 8 + 3] = high & 0xFF;
        
        // Low 32 bits
        result[i * 8 + 4] = (low >>> 24) & 0xFF;
        result[i * 8 + 5] = (low >>> 16) & 0xFF;
        result[i * 8 + 6] = (low >>> 8) & 0xFF;
        result[i * 8 + 7] = low & 0xFF;
      }
      
      return Array.from(result);
    }

    _ProcessBlock(block) {
      // Prepare message schedule (W) - 80 64-bit words
      const W = new Array(80);
      
      // Copy first 16 words from block (big-endian, 64-bit each)
      for (let i = 0; i < 16; i++) {
        const offset = i * 8;
        const high = (block[offset] << 24) | (block[offset + 1] << 16) | (block[offset + 2] << 8) | block[offset + 3];
        const low = (block[offset + 4] << 24) | (block[offset + 5] << 16) | (block[offset + 6] << 8) | block[offset + 7];
        W[i] = [high >>> 0, low >>> 0];
      }
      
      // Extend first 16 words into remaining 64 words
      for (let i = 16; i < 80; i++) {
        const s0 = Int64.xor(Int64.xor(Int64.rotr(W[i - 15], 1), Int64.rotr(W[i - 15], 8)), Int64.shr(W[i - 15], 7));
        const s1 = Int64.xor(Int64.xor(Int64.rotr(W[i - 2], 19), Int64.rotr(W[i - 2], 61)), Int64.shr(W[i - 2], 6));
        W[i] = Int64.add(Int64.add(Int64.add(W[i - 16], s0), W[i - 7]), s1);
      }
      
      // Initialize working variables
      let a = [...this.h[0]], b = [...this.h[1]], c = [...this.h[2]], d = [...this.h[3]];
      let e = [...this.h[4]], f = [...this.h[5]], g = [...this.h[6]], h = [...this.h[7]];
      
      // Main hash computation (80 rounds)
      for (let i = 0; i < 80; i++) {
        const S1 = Int64.xor(Int64.xor(Int64.rotr(e, 14), Int64.rotr(e, 18)), Int64.rotr(e, 41));
        const ch = Int64.xor(Int64.and(e, f), Int64.and(Int64.not(e), g));
        const temp1 = Int64.add(Int64.add(Int64.add(Int64.add(h, S1), ch), this.K[i]), W[i]);
        const S0 = Int64.xor(Int64.xor(Int64.rotr(a, 28), Int64.rotr(a, 34)), Int64.rotr(a, 39));
        const maj = Int64.xor(Int64.xor(Int64.and(a, b), Int64.and(a, c)), Int64.and(b, c));
        const temp2 = Int64.add(S0, maj);
        
        h = [...g];
        g = [...f];
        f = [...e];
        e = Int64.add(d, temp1);
        d = [...c];
        c = [...b];
        b = [...a];
        a = Int64.add(temp1, temp2);
      }
      
      // Add to hash values
      this.h[0] = Int64.add(this.h[0], a);
      this.h[1] = Int64.add(this.h[1], b);
      this.h[2] = Int64.add(this.h[2], c);
      this.h[3] = Int64.add(this.h[3], d);
      this.h[4] = Int64.add(this.h[4], e);
      this.h[5] = Int64.add(this.h[5], f);
      this.h[6] = Int64.add(this.h[6], g);
      this.h[7] = Int64.add(this.h[7], h);
    }
  }

  class SHA512Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      
      // Basic information
      this.name = "SHA-512";
      this.description = "Secure Hash Algorithm producing 512-bit hash values. Part of the SHA-2 family designed by NSA and standardized by NIST. Provides high security for digital signatures and certificates.";
      this.inventor = "National Security Agency (NSA)";
      this.year = 2001;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;
      
      // Capabilities
      this.SupportedOutputSizes = [{ minSize: 64, maxSize: 64, stepSize: 1 }];
      
      // Documentation
      this.documentation = [
        new LinkItem("NIST FIPS 180-4: Secure Hash Standard", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf"),
        new LinkItem("RFC 6234: US Secure Hash Algorithms", "https://tools.ietf.org/html/rfc6234"),
        new LinkItem("Wikipedia - SHA-2", "https://en.wikipedia.org/wiki/SHA-2")
      ];
      
      // References
      this.references = [
        new LinkItem("OpenSSL SHA-512 Implementation", "https://github.com/openssl/openssl/blob/master/crypto/sha/sha512.c"),
        new LinkItem("Go crypto/sha512", "https://golang.org/src/crypto/sha512/"),
        new LinkItem("NIST CAVP Test Vectors", "https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program/Secure-Hashing")
      ];
      
      // Known vulnerabilities - None currently known
      this.knownVulnerabilities = [];
      
      // Test vectors from NIST FIPS 180-4
      this.tests = [
        {
          input: [],
          expected: global.OpCodes.Hex8ToBytes("cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"),
          text: "NIST FIPS 180-4 Test Vector - Empty string",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf"
        },
        {
          input: global.OpCodes.AnsiToBytes("abc"),
          expected: global.OpCodes.Hex8ToBytes("ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"),
          text: "NIST FIPS 180-4 Test Vector - 'abc'",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf"
        },
        {
          input: global.OpCodes.AnsiToBytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
          expected: global.OpCodes.Hex8ToBytes("204a8fc6dda82f0a0ced7beb8e08a41657c16ef468b228a8279be331a703c33596fd15c13b1b07f9aa1d3bea57789ca031ad85c7a71dd70354ec631238ca3445"),
          text: "NIST FIPS 180-4 Test Vector - 448-bit message",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf"
        },
        {
          input: global.OpCodes.AnsiToBytes("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"),
          expected: global.OpCodes.Hex8ToBytes("8e959b75dae313da8cf4f72814fc143f8f7779c6eb9f7fa17299aeadb6889018501d289e4900f7e4331b99dec4b5433ac7d329eeb6dd26545e96e55b874be909"),
          text: "NIST FIPS 180-4 Test Vector - 896-bit message",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf"
        }
      ];
    }

    CreateInstance(isInverse = false) {
      // Hash functions don't have an inverse operation
      if (isInverse) {
        return null;
      }
      return new SHA512Instance(this);
    }
  }

  // Register the algorithm
  if (Framework.RegisterAlgorithm) {
    Framework.RegisterAlgorithm(new SHA512Algorithm());
  }

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this)));
