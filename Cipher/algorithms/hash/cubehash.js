/*
 * CubeHash Hash Function (SHA-3 Candidate)
 * Designed by Daniel J. Bernstein
 * Submitted to NIST SHA-3 competition (2008-2012)
 * Reference: https://cubehash.cr.yp.to/
 * NIST Submission notation: CubeHash-i+r/b+f-h
 *   i = initialization rounds, r = rounds per block
 *   b = block bytes, f = finalization rounds, h = hash bits
 * Standard variants use i=f=10*r (e.g., CubeHash16+16/32+16-512)
 *
 * Implementation based on sph_cubehash reference (ccminer/sph)
 * Uses pre-computed IVs from reference implementation
 * Test vectors from NIST SHA-3 competition submission
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (REQUIRED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // Pre-computed initialization vectors from sph_cubehash reference implementation
  // These are the state after Init({h/8,b,r,0,...}) and 10*r rounds
  const IV256 = new Uint32Array([
    0xEA2BD4B4, 0xCCD6F29F, 0x63117E71, 0x35481EAE,
    0x22512D5B, 0xE5D94E63, 0x7E624131, 0xF4CC12BE,
    0xC2D0B696, 0x42AF2070, 0xD0720C35, 0x3361DA8C,
    0x28CCECA4, 0x8EF8AD83, 0x4680AC00, 0x40E5FBAB,
    0xD89041C3, 0x6107FBD5, 0x6C859D41, 0xF0B26679,
    0x09392549, 0x5FA25603, 0x65C892FD, 0x93CB6285,
    0x2AF2B5AE, 0x9E4B4E60, 0x774ABFDD, 0x85254725,
    0x15815AEB, 0x4AB6AAD6, 0x9CDAF8AF, 0xD6032C0A
  ]);

  const IV512 = new Uint32Array([
    0x2AEA2A61, 0x50F494D4, 0x2D538B8B, 0x4167D83E,
    0x3FEE2313, 0xC701CF8C, 0xCC39968E, 0x50AC5695,
    0x4D42C787, 0xA647A8B3, 0x97CF0BEF, 0x825B4537,
    0xEEF864D2, 0xF22090C4, 0xD0E5CD33, 0xA23911AE,
    0xFCD398D9, 0x148FE485, 0x1B017BEF, 0xB6444532,
    0x6A536159, 0x2FF5781C, 0x91FA7934, 0x0DBADEA9,
    0xD65C8A2B, 0xA5A70E75, 0xB1C62456, 0xBC796576,
    0x1921C8F7, 0xE7989AF1, 0x7795D246, 0xD43E3B44
  ]);

  // CubeHash state transformation function
  // Following the official spec from Daniel J. Bernstein
  // The state consists of 32 32-bit words (1024 bits total)
  function cubeHashTransform(x) {
    // Step 1: Add x_0jklm into x_1jklm modulo 2^32, for each (j,k,l,m)
    for (let i = 0; i < 16; ++i) {
      x[16 + i] = (x[16 + i] + x[i]) >>> 0;
    }

    // Step 2: Rotate x_0jklm upwards by 7 bits, for each (j,k,l,m)
    for (let i = 0; i < 16; ++i) {
      x[i] = OpCodes.RotL32(x[i], 7);
    }

    // Step 3: Swap x_00klm with x_01klm, for each (k,l,m)
    for (let i = 0; i < 8; ++i) {
      const tmp = x[i];
      x[i] = x[8 + i];
      x[8 + i] = tmp;
    }

    // Step 4: XOR x_1jklm into x_0jklm, for each (j,k,l,m)
    for (let i = 0; i < 16; ++i) {
      x[i] ^= x[16 + i];
    }

    // Step 5: Swap x_1jk0m with x_1jk1m, for each (j,k,m)
    for (let i = 0; i < 16; i += 4) {
      let tmp = x[16 + i];
      x[16 + i] = x[16 + i + 2];
      x[16 + i + 2] = tmp;
      tmp = x[16 + i + 1];
      x[16 + i + 1] = x[16 + i + 3];
      x[16 + i + 3] = tmp;
    }

    // Step 6: Add x_0jklm into x_1jklm modulo 2^32, for each (j,k,l,m)
    for (let i = 0; i < 16; ++i) {
      x[16 + i] = (x[16 + i] + x[i]) >>> 0;
    }

    // Step 7: Rotate x_0jklm upwards by 11 bits, for each (j,k,l,m)
    for (let i = 0; i < 16; ++i) {
      x[i] = OpCodes.RotL32(x[i], 11);
    }

    // Step 8: Swap x_0j0lm with x_0j1lm, for each (j,l,m)
    for (let i = 0; i < 16; i += 8) {
      let tmp = x[i];
      x[i] = x[i + 4];
      x[i + 4] = tmp;
      tmp = x[i + 1];
      x[i + 1] = x[i + 5];
      x[i + 5] = tmp;
      tmp = x[i + 2];
      x[i + 2] = x[i + 6];
      x[i + 6] = tmp;
      tmp = x[i + 3];
      x[i + 3] = x[i + 7];
      x[i + 7] = tmp;
    }

    // Step 9: XOR x_1jklm into x_0jklm, for each (j,k,l,m)
    for (let i = 0; i < 16; ++i) {
      x[i] ^= x[16 + i];
    }

    // Step 10: Swap x_1jkl0 with x_1jkl1, for each (j,k,l)
    for (let i = 0; i < 16; i += 2) {
      const tmp = x[16 + i];
      x[16 + i] = x[16 + i + 1];
      x[16 + i + 1] = tmp;
    }
  }

  // CubeHash instance implementing Feed/Result pattern
  class CubeHashInstance extends IHashFunctionInstance {
    constructor(algorithm, rounds, blockBytes, hashBytes, iv) {
      super(algorithm);
      this.rounds = rounds;
      this.blockBytes = blockBytes;
      this.hashBytes = hashBytes;
      this.outputSize = hashBytes;
      this.iv = iv;

      // Initialize 1024-bit state (32 words of 32 bits each)
      this.state = new Array(32);
      this._initialize();

      // Buffer for incomplete blocks
      this.buffer = [];
      this.totalLength = 0;
    }

    _initialize() {
      // Copy pre-computed IV to state
      for (let i = 0; i < 32; ++i) {
        this.state[i] = this.iv[i];
      }
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      this.totalLength += data.length;

      // Add data to buffer
      for (let i = 0; i < data.length; ++i) {
        this.buffer.push(data[i]);

        // Process complete blocks
        if (this.buffer.length === this.blockBytes) {
          this._processBlock();
          this.buffer = [];
        }
      }
    }

    _processBlock() {
      // XOR block into state (little-endian byte order)
      for (let i = 0; i < this.blockBytes; ++i) {
        const wordIdx = i >>> 2;
        const byteIdx = i & 3;
        this.state[wordIdx] ^= (this.buffer[i] << (byteIdx * 8)) >>> 0;
      }

      // Apply r rounds
      for (let i = 0; i < this.rounds; ++i) {
        cubeHashTransform(this.state);
      }
    }

    Result() {
      // Pad with 0x80 at current position
      const padPos = this.buffer.length;
      const wordIdx = padPos >>> 2;
      const byteIdx = padPos & 3;

      // XOR any remaining buffered data
      for (let i = 0; i < this.buffer.length; ++i) {
        const wIdx = i >>> 2;
        const bIdx = i & 3;
        this.state[wIdx] ^= (this.buffer[i] << (bIdx * 8)) >>> 0;
      }

      // XOR padding byte
      this.state[wordIdx] ^= (0x80 << (byteIdx * 8)) >>> 0;

      // Apply r rounds after padding
      for (let i = 0; i < this.rounds; ++i) {
        cubeHashTransform(this.state);
      }

      // Finalization: XOR 1 into state[31]
      this.state[31] ^= 1;

      // Apply 10*r final rounds
      for (let i = 0; i < 10 * this.rounds; ++i) {
        cubeHashTransform(this.state);
      }

      // Extract hash (first h/8 bytes from state, little-endian)
      const output = [];
      for (let i = 0; i < this.hashBytes; ++i) {
        const wordIndex = i >>> 2;
        const byteIndex = i & 3;
        output.push((this.state[wordIndex] >>> (byteIndex * 8)) & 0xFF);
      }

      return output;
    }
  }

  // CubeHash-512 (recommended SHA-3 submission variant)
  class CubeHash512 extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "CubeHash-512";
      this.description = "CubeHash-16+16/32+16-512 hash function designed by Daniel J. Bernstein, submitted to NIST SHA-3 competition. Uses 16 initialization rounds, 32-byte blocks, 16 rounds per block, and produces 512-bit hashes.";
      this.inventor = "Daniel J. Bernstein";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.SupportedOutputSizes = [new KeySize(64, 64, 1)];

      this.documentation = [
        new LinkItem("CubeHash Official Website", "https://cubehash.cr.yp.to/"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("CubeHash Specification (PDF)", "https://cubehash.cr.yp.to/submission/spec.pdf")
      ];

      this.references = [
        new LinkItem("Daniel J. Bernstein's Research", "https://cr.yp.to/"),
        new LinkItem("SHA-3 Competition Archive", "https://csrc.nist.gov/projects/hash-functions/sha-3-project/sha-3-standardization")
      ];

      // Test vectors for CubeHash16+16/32+16-512
      // Verified against reference implementation
      this.tests = [
        {
          text: "Empty string (CubeHash16+16/32+16-512)",
          uri: "https://cubehash.cr.yp.to/",
          input: OpCodes.AnsiToBytes(""),
          expected: OpCodes.Hex8ToBytes("4a1d00bbcfcb5a9562fb981e7f7db3350fe2658639d948b9d57452c22328bb32f468b072208450bad5ee178271408be0b16e5633ac8a1e3cf9864cfbfc8e043a")
        },
        {
          text: "ASCII 'Hello' (CubeHash16+16/32+16-512)",
          uri: "https://cubehash.cr.yp.to/",
          input: OpCodes.AnsiToBytes("Hello"),
          expected: OpCodes.Hex8ToBytes("dcc0503aae279a3c8c95fa1181d37c418783204e2e3048a081392fd61bace883a1f7c4c96b16b4060c42104f1ce45a622f1a9abaeb994beb107fed53a78f588c")
        },
        {
          text: "ASCII 'The quick brown fox jumps over the lazy dog' (CubeHash16+16/32+16-512)",
          uri: "https://cubehash.cr.yp.to/",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("bdba44a28cd16b774bdf3c9511def1a2baf39d4ef98b92c27cf5e37beb8990b7cdb6575dae1a548330780810618b8a5c351c1368904db7ebdf8857d596083a86")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new CubeHashInstance(this, 16, 32, 64, IV512);
    }
  }

  // CubeHash-256 variant
  class CubeHash256 extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "CubeHash-256";
      this.description = "CubeHash-16+16/32+16-256 variant producing 256-bit hashes. SHA-3 competition candidate by Daniel J. Bernstein.";
      this.inventor = "Daniel J. Bernstein";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.SupportedOutputSizes = [new KeySize(32, 32, 1)];

      this.documentation = [
        new LinkItem("CubeHash Official Website", "https://cubehash.cr.yp.to/"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
      ];

      // Test vectors for CubeHash16+16/32+16-256
      // Verified against reference implementation
      this.tests = [
        {
          text: "Empty string (CubeHash16+16/32+16-256)",
          uri: "https://cubehash.cr.yp.to/",
          input: OpCodes.AnsiToBytes(""),
          expected: OpCodes.Hex8ToBytes("44c6de3ac6c73c391bf0906cb7482600ec06b216c7c54a2a8688a6a42676577d")
        },
        {
          text: "ASCII 'Hello' (CubeHash16+16/32+16-256)",
          uri: "https://cubehash.cr.yp.to/",
          input: OpCodes.AnsiToBytes("Hello"),
          expected: OpCodes.Hex8ToBytes("e712139e3b892f2f5fe52d0f30d78a0cb16b51b217da0e4acb103dd0856f2db0")
        },
        {
          text: "ASCII 'The quick brown fox jumps over the lazy dog' (CubeHash16+16/32+16-256)",
          uri: "https://cubehash.cr.yp.to/",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("5151e251e348cbbfee46538651c06b138b10eeb71cf6ea6054d7ca5fec82eb79")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new CubeHashInstance(this, 16, 32, 32, IV256);
    }
  }

  // Register both variants
  RegisterAlgorithm(new CubeHash512());
  RegisterAlgorithm(new CubeHash256());

  return {
    CubeHash512: CubeHash512,
    CubeHash256: CubeHash256
  };
}));
