/*
 * RIPEMD-256 Hash Function - Universal AlgorithmFramework Implementation
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class RIPEMD256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RIPEMD-256";
      this.description = "RIPEMD-256 is an extension of RIPEMD-160 with 256-bit output. Part of the RIPEMD family designed as European alternatives to SHA algorithms.";
      this.inventor = "Hans Dobbertin, Antoon Bosselaers, Bart Preneel";
      this.year = 1996;
      this.category = CategoryType.HASH;
      this.subCategory = "RIPEMD Family";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Documentation and references
      this.documentation = [
        new LinkItem("RIPEMD Family Specification", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/RIPEMD")
      ];

      this.references = [
        new LinkItem("Bouncy Castle Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD256Digest.java")
      ];

      // Test vectors (basic set)
      this.tests = [
        new TestCase(
          [], 
          OpCodes.Hex8ToBytes("02ba4c4e5f8ecd1877fc52d64d30e37a2d9774fb1e5d026380ae0168e3c5522d"),
          "Empty string test vector",
          "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("a"), 
          OpCodes.Hex8ToBytes("f9333e45d857f5d90a91bab70a1eba0cfb1be4b0783c9acfcd883a9134692925"),
          "Single character 'a' test vector",
          "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("abc"), 
          OpCodes.Hex8ToBytes("afbd6e228b9d8cbbcef5ca2d03e6dba10ac0bc7dcbe4680e1e42d2e975459b65"),
          "String 'abc' test vector",
          "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        )
      ];
    }

    CreateInstance() {
      return new RIPEMD256Instance(this);
    }
  }

  class RIPEMD256Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.Reset();
    }

    Reset() {
      // Initial hash values for RIPEMD-256 (8 x 32-bit words)
      this._h = [
        0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476,
        0x76543210, 0xFEDCBA98, 0x89ABCDEF, 0x01234567
      ];

      this._buffer = new Array(64);
      this._length = 0;
      this._bufferLength = 0;

      // Clear buffer
      OpCodes.ClearArray(this._buffer);
    }

    /**
     * RIPEMD-256 auxiliary functions (same as RIPEMD-128)
     */
    _f(j, x, y, z) {
      if (j < 16) return x ^ y ^ z;
      if (j < 32) return (x & y) | (~x & z);
      if (j < 48) return (x | ~y) ^ z;
      return (x & z) | (y & ~z);
    }

    _K(j) {
      if (j < 16) return 0x00000000;
      if (j < 32) return 0x5A827999;
      if (j < 48) return 0x6ED9EBA1;
      return 0x8F1BBCDC;
    }

    _Kh(j) {
      if (j < 16) return 0x50A28BE6;
      if (j < 32) return 0x5C4DD124;
      if (j < 48) return 0x6D703EF3;
      return 0x7A6D76E9;
    }

    /**
     * Process a single 512-bit (64-byte) message block
     * @param {Array} block - 64-byte message block
     */
    _processBlock(block) {
      // Convert block to 16 32-bit words (little-endian)
      const X = new Array(16);
      for (let i = 0; i < 16; i++) {
        X[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      }

      // Initialize working variables (left and right lines)
      let AL = this._h[0], BL = this._h[1], CL = this._h[2], DL = this._h[3];
      let AR = this._h[4], BR = this._h[5], CR = this._h[6], DR = this._h[7];

      // Message schedule permutations for RIPEMD-256 (64 rounds, not 80)
      const r = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2];
      const rh = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14];

      // Rotation amounts for RIPEMD-256 (64 rounds)
      const s = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12];
      const sh = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5];

      // Main computation (2 parallel lines, 64 rounds)
      for (let j = 0; j < 64; j++) {
        // Left line
        let T = (AL + this._f(j, BL, CL, DL) + X[r[j]] + this._K(j)) >>> 0;
        T = OpCodes.RotL32(T, s[j]);
        T = T >>> 0;
        AL = DL; DL = CL; CL = BL; BL = T;

        // Right line  
        T = (AR + this._f(63 - j, BR, CR, DR) + X[rh[j]] + this._Kh(j)) >>> 0;
        T = OpCodes.RotL32(T, sh[j]);
        T = T >>> 0;
        AR = DR; DR = CR; CR = BR; BR = T;

        // Exchange chaining variables between parallel lines after each round (RIPEMD-256 specific)
        if (j === 15) {
          // Swap CL and CR
          let temp = CL; CL = CR; CR = temp;
        } else if (j === 31) {
          // Swap DL and DR  
          let temp = DL; DL = DR; DR = temp;
        } else if (j === 47) {
          // Swap AL and AR
          let temp = AL; AL = AR; AR = temp;
        }
      }

      // Final addition (RIPEMD-256 specific - no combination, just separate updates)
      this._h[0] = (this._h[0] + AL) >>> 0;
      this._h[1] = (this._h[1] + BL) >>> 0;
      this._h[2] = (this._h[2] + CL) >>> 0;
      this._h[3] = (this._h[3] + DL) >>> 0;
      this._h[4] = (this._h[4] + AR) >>> 0;
      this._h[5] = (this._h[5] + BR) >>> 0;
      this._h[6] = (this._h[6] + CR) >>> 0;
      this._h[7] = (this._h[7] + DR) >>> 0;
    }

    ProcessData(data) {
      // Convert input to byte array
      const bytes = (typeof data === 'string') ? OpCodes.AnsiToBytes(data) : data;

      for (let i = 0; i < bytes.length; i++) {
        this._buffer[this._bufferLength++] = bytes[i] & 0xFF;
        this._length++;

        // Process complete 64-byte blocks
        if (this._bufferLength === 64) {
          this._processBlock(this._buffer);
          this._bufferLength = 0;
        }
      }
    }

    GetResult() {
      // Create a copy of the current state for finalization
      const tempH = [...this._h];
      const tempBuffer = [...this._buffer];
      const tempLength = this._length;
      const tempBufferLength = this._bufferLength;

      // Add padding bit
      tempBuffer[tempBufferLength] = 0x80;
      let finalBufferLength = tempBufferLength + 1;

      // Check if we need an additional block for length
      if (finalBufferLength > 56) {
        // Pad current block and process
        while (finalBufferLength < 64) {
          tempBuffer[finalBufferLength++] = 0x00;
        }
        this._processBlockTemp(tempBuffer, tempH);
        finalBufferLength = 0;
      }

      // Pad to 56 bytes
      while (finalBufferLength < 56) {
        tempBuffer[finalBufferLength++] = 0x00;
      }

      // Append length in bits as 64-bit little-endian
      const lengthBits = tempLength * 8;
      // Low 32 bits first (little-endian)
      tempBuffer[56] = lengthBits & 0xFF;
      tempBuffer[57] = (lengthBits >>> 8) & 0xFF;
      tempBuffer[58] = (lengthBits >>> 16) & 0xFF;
      tempBuffer[59] = (lengthBits >>> 24) & 0xFF;
      // High 32 bits (for messages under 2^32 bits, this is 0)
      tempBuffer[60] = 0; tempBuffer[61] = 0; tempBuffer[62] = 0; tempBuffer[63] = 0;

      // Process final block
      this._processBlockTemp(tempBuffer, tempH);

      // Convert hash to byte array (little-endian output)
      const result = new Array(32); // 256 bits = 32 bytes
      for (let i = 0; i < 8; i++) {
        const bytes = OpCodes.Unpack32LE(tempH[i]);
        for (let j = 0; j < 4; j++) {
          result[i * 4 + j] = bytes[j];
        }
      }

      return result;
    }

    _processBlockTemp(block, hashState) {
      // Convert block to 16 32-bit words (little-endian)
      const X = new Array(16);
      for (let i = 0; i < 16; i++) {
        X[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      }

      // Initialize working variables (left and right lines)
      let AL = hashState[0], BL = hashState[1], CL = hashState[2], DL = hashState[3];
      let AR = hashState[4], BR = hashState[5], CR = hashState[6], DR = hashState[7];

      // Message schedule permutations for RIPEMD-256 (64 rounds, not 80)
      const r = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2];
      const rh = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14];

      // Rotation amounts for RIPEMD-256 (64 rounds)
      const s = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12];
      const sh = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5];

      // Main computation (2 parallel lines, 64 rounds)
      for (let j = 0; j < 64; j++) {
        // Left line
        let T = (AL + this._f(j, BL, CL, DL) + X[r[j]] + this._K(j)) >>> 0;
        T = OpCodes.RotL32(T, s[j]);
        T = T >>> 0;
        AL = DL; DL = CL; CL = BL; BL = T;

        // Right line  
        T = (AR + this._f(63 - j, BR, CR, DR) + X[rh[j]] + this._Kh(j)) >>> 0;
        T = OpCodes.RotL32(T, sh[j]);
        T = T >>> 0;
        AR = DR; DR = CR; CR = BR; BR = T;

        // Exchange chaining variables between parallel lines after each round (RIPEMD-256 specific)
        if (j === 15) {
          // Swap CL and CR
          let temp = CL; CL = CR; CR = temp;
        } else if (j === 31) {
          // Swap DL and DR  
          let temp = DL; DL = DR; DR = temp;
        } else if (j === 47) {
          // Swap AL and AR
          let temp = AL; AL = AR; AR = temp;
        }
      }

      // Final addition (RIPEMD-256 specific - no combination, just separate updates)
      hashState[0] = (hashState[0] + AL) >>> 0;
      hashState[1] = (hashState[1] + BL) >>> 0;
      hashState[2] = (hashState[2] + CL) >>> 0;
      hashState[3] = (hashState[3] + DL) >>> 0;
      hashState[4] = (hashState[4] + AR) >>> 0;
      hashState[5] = (hashState[5] + BR) >>> 0;
      hashState[6] = (hashState[6] + CR) >>> 0;
      hashState[7] = (hashState[7] + DR) >>> 0;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new RIPEMD256Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RIPEMD256Algorithm, RIPEMD256Instance };
}));