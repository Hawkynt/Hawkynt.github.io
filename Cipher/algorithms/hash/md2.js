/*
 * MD2 (Message-Digest Algorithm 2) - RFC 1319
 *
 * Implementation based on:
 * - RFC 1319: The MD2 Message-Digest Algorithm
 * - Crypto++ md2.cpp reference implementation
 * - NIST test vectors
 *
 * MD2 is a cryptographic hash function designed by Ronald Rivest in 1989.
 * It produces a 128-bit (16-byte) hash value and is cryptographically broken
 * with known collision and preimage attacks discovered in 2004-2009.
 *
 * This implementation is for educational purposes only.
 *
 * (c)2006-2025 Hawkynt
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== MD2 S-BOX (RFC 1319) =====
  // This is a permutation of 0-255 based on the digits of π
  const MD2_S = Object.freeze([
    0x29, 0x2E, 0x43, 0xC9, 0xA2, 0xD8, 0x7C, 0x01, 0x3D, 0x36, 0x54, 0xA1, 0xEC, 0xF0, 0x06, 0x13,
    0x62, 0xA7, 0x05, 0xF3, 0xC0, 0xC7, 0x73, 0x8C, 0x98, 0x93, 0x2B, 0xD9, 0xBC, 0x4C, 0x82, 0xCA,
    0x1E, 0x9B, 0x57, 0x3C, 0xFD, 0xD4, 0xE0, 0x16, 0x67, 0x42, 0x6F, 0x18, 0x8A, 0x17, 0xE5, 0x12,
    0xBE, 0x4E, 0xC4, 0xD6, 0xDA, 0x9E, 0xDE, 0x49, 0xA0, 0xFB, 0xF5, 0x8E, 0xBB, 0x2F, 0xEE, 0x7A,
    0xA9, 0x68, 0x79, 0x91, 0x15, 0xB2, 0x07, 0x3F, 0x94, 0xC2, 0x10, 0x89, 0x0B, 0x22, 0x5F, 0x21,
    0x80, 0x7F, 0x5D, 0x9A, 0x5A, 0x90, 0x32, 0x27, 0x35, 0x3E, 0xCC, 0xE7, 0xBF, 0xF7, 0x97, 0x03,
    0xFF, 0x19, 0x30, 0xB3, 0x48, 0xA5, 0xB5, 0xD1, 0xD7, 0x5E, 0x92, 0x2A, 0xAC, 0x56, 0xAA, 0xC6,
    0x4F, 0xB8, 0x38, 0xD2, 0x96, 0xA4, 0x7D, 0xB6, 0x76, 0xFC, 0x6B, 0xE2, 0x9C, 0x74, 0x04, 0xF1,
    0x45, 0x9D, 0x70, 0x59, 0x64, 0x71, 0x87, 0x20, 0x86, 0x5B, 0xCF, 0x65, 0xE6, 0x2D, 0xA8, 0x02,
    0x1B, 0x60, 0x25, 0xAD, 0xAE, 0xB0, 0xB9, 0xF6, 0x1C, 0x46, 0x61, 0x69, 0x34, 0x40, 0x7E, 0x0F,
    0x55, 0x47, 0xA3, 0x23, 0xDD, 0x51, 0xAF, 0x3A, 0xC3, 0x5C, 0xF9, 0xCE, 0xBA, 0xC5, 0xEA, 0x26,
    0x2C, 0x53, 0x0D, 0x6E, 0x85, 0x28, 0x84, 0x09, 0xD3, 0xDF, 0xCD, 0xF4, 0x41, 0x81, 0x4D, 0x52,
    0x6A, 0xDC, 0x37, 0xC8, 0x6C, 0xC1, 0xAB, 0xFA, 0x24, 0xE1, 0x7B, 0x08, 0x0C, 0xBD, 0xB1, 0x4A,
    0x78, 0x88, 0x95, 0x8B, 0xE3, 0x63, 0xE8, 0x6D, 0xE9, 0xCB, 0xD5, 0xFE, 0x3B, 0x00, 0x1D, 0x39,
    0xF2, 0xEF, 0xB7, 0x0E, 0x66, 0x58, 0xD0, 0xE4, 0xA6, 0x77, 0x72, 0xF8, 0xEB, 0x75, 0x4B, 0x0A,
    0x31, 0x44, 0x50, 0xB4, 0x8F, 0xED, 0x1F, 0x1A, 0xDB, 0x99, 0x8D, 0x33, 0x9F, 0x11, 0x83, 0x14
  ]);

  // ===== MD2 ALGORITHM CLASS =====

  class MD2 extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MD2";
      this.description = "MD2 is a 128-bit cryptographic hash function designed by Ronald Rivest. It uses a unique S-box based on π and processes 16-byte blocks. Cryptographically broken with known collision and preimage attacks since 2004.";
      this.inventor = "Ronald Rivest";
      this.year = 1989;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Hash-specific metadata
      this.SupportedOutputSizes = [new KeySize(16, 16, 1)]; // Fixed 128 bits

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 1319 - The MD2 Message-Digest Algorithm", "https://tools.ietf.org/html/rfc1319"),
        new LinkItem("Wikipedia - MD2 (hash function)", "https://en.wikipedia.org/wiki/MD2_(hash_function)")
      ];

      this.references = [
        new LinkItem("Crypto++ MD2 Implementation", "https://github.com/weidai11/cryptopp/blob/master/md2.cpp"),
        new LinkItem("MD2 Cryptanalysis (2004)", "https://link.springer.com/chapter/10.1007/978-3-540-45146-4_3"),
        new LinkItem("Preimage Attacks on MD2 (2009)", "https://eprint.iacr.org/2008/089.pdf")
      ];

      // Test vectors from RFC 1319 - OFFICIAL SOURCES ONLY
      this.tests = [
        {
          text: "RFC 1319 Test Vector #1 - Empty string",
          uri: "https://tools.ietf.org/html/rfc1319",
          input: [],
          expected: OpCodes.Hex8ToBytes('8350e5a3e24c153df2275c9f80692773')
        },
        {
          text: "RFC 1319 Test Vector #2 - Single byte 'a'",
          uri: "https://tools.ietf.org/html/rfc1319",
          input: OpCodes.AnsiToBytes('a'),
          expected: OpCodes.Hex8ToBytes('32ec01ec4a6dac72c0ab96fb34c0b5d1')
        },
        {
          text: "RFC 1319 Test Vector #3 - 'abc'",
          uri: "https://tools.ietf.org/html/rfc1319",
          input: OpCodes.AnsiToBytes('abc'),
          expected: OpCodes.Hex8ToBytes('da853b0d3f88d99b30283a69e6ded6bb')
        },
        {
          text: "RFC 1319 Test Vector #4 - 'message digest'",
          uri: "https://tools.ietf.org/html/rfc1319",
          input: OpCodes.AnsiToBytes('message digest'),
          expected: OpCodes.Hex8ToBytes('ab4f496bfb2a530b219ff33031fe06b0')
        },
        {
          text: "RFC 1319 Test Vector #5 - alphabet lowercase",
          uri: "https://tools.ietf.org/html/rfc1319",
          input: OpCodes.AnsiToBytes('abcdefghijklmnopqrstuvwxyz'),
          expected: OpCodes.Hex8ToBytes('4e8ddff3650292ab5a4108c3aa47940b')
        },
        {
          text: "RFC 1319 Test Vector #6 - alphanumeric",
          uri: "https://tools.ietf.org/html/rfc1319",
          input: OpCodes.AnsiToBytes('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
          expected: OpCodes.Hex8ToBytes('da33def2a42df13975352846c30338cd')
        },
        {
          text: "RFC 1319 Test Vector #7 - numeric sequence",
          uri: "https://tools.ietf.org/html/rfc1319",
          input: OpCodes.AnsiToBytes('12345678901234567890123456789012345678901234567890123456789012345678901234567890'),
          expected: OpCodes.Hex8ToBytes('d5976f79d83d3a0dc9806c3c66f3efd8')
        }
      ];
    }

    CreateInstance(isInverse = false) {
      // Hash functions have no inverse
      if (isInverse) {
        return null;
      }
      return new MD2Instance(this);
    }
  }

  // ===== MD2 INSTANCE CLASS =====

  class MD2Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.outputSize = 16; // 128 bits = 16 bytes (property with lowercase 'o')
      this.OutputSize = 16; // 128 bits = 16 bytes (property with uppercase 'O' for compatibility)
      this._buffer = [];
    }

    // Feed/Result pattern implementation
    Feed(data) {
      if (!data || data.length === 0) return;

      // Convert string to bytes if needed
      if (typeof data === 'string') {
        data = OpCodes.AnsiToBytes(data);
      }

      // Accumulate data
      this._buffer.push(...data);
    }

    Result() {
      // Compute MD2 hash and return result
      const hash = this._computeMD2(this._buffer);

      // Clear buffer for next operation
      OpCodes.ClearArray(this._buffer);
      this._buffer = [];

      return hash;
    }

    // ===== MD2 CORE ALGORITHM (RFC 1319) =====

    _computeMD2(message) {
      // Step 1: Append Padding Bytes (RFC 1319 Section 3.1)
      // Padding is always performed, even if message length is multiple of 16
      const padLength = 16 - (message.length % 16);
      const paddedMessage = message.slice(); // Copy message

      // Append padLength bytes, each with value padLength
      for (let i = 0; i < padLength; ++i) {
        paddedMessage.push(padLength);
      }

      // Step 2: Append Checksum (RFC 1319 Section 3.2)
      const checksum = new Array(16);
      for (let i = 0; i < 16; ++i) {
        checksum[i] = 0;
      }

      let L = 0;
      // Process each 16-byte block to compute checksum
      for (let i = 0; i < paddedMessage.length; i += 16) {
        for (let j = 0; j < 16; ++j) {
          const c = paddedMessage[i + j];
          const xorValue = OpCodes.ToByte(c ^ L);
          const sBoxValue = MD2_S[xorValue];
          checksum[j] = OpCodes.ToByte(checksum[j] ^ sBoxValue);
          L = checksum[j];
        }
      }

      // Append checksum to padded message
      const messageWithChecksum = paddedMessage.concat(checksum);

      // Step 3: Initialize MD Buffer (RFC 1319 Section 3.3)
      const X = new Array(48);
      for (let i = 0; i < 48; ++i) {
        X[i] = 0;
      }

      // Step 4: Process Message in 16-Byte Blocks (RFC 1319 Section 3.4)
      for (let i = 0; i < messageWithChecksum.length; i += 16) {
        // Copy block into X[16..31]
        for (let j = 0; j < 16; ++j) {
          X[16 + j] = messageWithChecksum[i + j];
          // Set X[32..47] to XOR of X[0..15] and X[16..31]
          X[32 + j] = OpCodes.ToByte(X[16 + j] ^ X[j]);
        }

        // Do 18 rounds of hashing
        let t = 0;
        for (let round = 0; round < 18; ++round) {
          for (let k = 0; k < 48; ++k) {
            const xorValue = OpCodes.ToByte(t);
            t = OpCodes.ToByte(X[k] ^ MD2_S[xorValue]);
            X[k] = t;
          }
          // Add round number to t (mod 256)
          t = OpCodes.ToByte(t + round);
        }
      }

      // Step 5: Output (RFC 1319 Section 3.5)
      // The message digest is X[0..15]
      const hash = new Array(16);
      for (let i = 0; i < 16; ++i) {
        hash[i] = X[i];
      }

      // Clear sensitive data
      OpCodes.ClearArray(X);

      return hash;
    }
  }

  // ===== REGISTRATION =====

  RegisterAlgorithm(new MD2());

  // ===== EXPORTS =====

  return {
    MD2,
    MD2Instance
  };
}));
