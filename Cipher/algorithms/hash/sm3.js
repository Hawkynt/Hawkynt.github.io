/*
 * SM3 (ShangMi 3) Hash Function Implementation
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * SM3 is the Chinese national cryptographic hash standard
 * Part of the Chinese State Cryptography Administration portfolio
 * Produces 256-bit (32-byte) hash output
 *
 * Based on Crypto++ implementation by Jeffrey Walton and Han Lulu
 * Specification: https://tools.ietf.org/html/draft-shen-sm3-hash
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

  // ===== SM3 PERMUTATION FUNCTIONS =====

  // P0 permutation: X ^ ROL(X, 9) ^ ROL(X, 17)
  function P0(X) {
    return X ^ OpCodes.RotL32(X, 9) ^ OpCodes.RotL32(X, 17);
  }

  // P1 permutation: X ^ ROL(X, 15) ^ ROL(X, 23)
  function P1(X) {
    return X ^ OpCodes.RotL32(X, 15) ^ OpCodes.RotL32(X, 23);
  }

  // Message expansion function
  function EE(W0, W7, W13, W3, W10) {
    return P1(W0 ^ W7 ^ OpCodes.RotL32(W13, 15)) ^ OpCodes.RotL32(W3, 7) ^ W10;
  }

  // FF function for rounds 0-15
  function FF1(X, Y, Z) {
    return X ^ Y ^ Z;
  }

  // FF function for rounds 16-63
  function FF2(X, Y, Z) {
    return (X & Y) | ((X | Y) & Z);
  }

  // GG function for rounds 0-15
  function GG1(X, Y, Z) {
    return X ^ Y ^ Z;
  }

  // GG function for rounds 16-63
  function GG2(X, Y, Z) {
    return (Z ^ (X & (Y ^ Z)));
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class SM3Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SM3";
      this.description = "Chinese national cryptographic hash standard producing 256-bit digests. Part of the ShangMi (Commercial Cryptography) suite used in China's cryptographic infrastructure.";
      this.inventor = "Xiaoyun Wang, et al.";
      this.year = 2010;
      this.category = CategoryType.HASH;
      this.subCategory = "Merkle-Damgård Hash";
      this.securityStatus = null; // National standard, widely used in China
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CN;

      // Hash-specific configuration
      this.SupportedHashSizes = [new KeySize(32, 32, 1)]; // Fixed 256-bit output
      this.BlockSize = 64; // 512-bit blocks

      // Documentation links
      this.documentation = [
        new LinkItem("SM3 Hash Function Specification", "https://tools.ietf.org/html/draft-shen-sm3-hash"),
        new LinkItem("GmSSL Project", "http://gmssl.org/"),
        new LinkItem("Chinese Cryptography Standards", "http://www.oscca.gov.cn/")
      ];

      // Reference links
      this.references = [
        new LinkItem("Crypto++ SM3 Implementation", "https://github.com/weidai11/cryptopp/blob/master/sm3.cpp"),
        new LinkItem("GmSSL Reference Implementation", "https://github.com/guanzhi/GmSSL"),
        new LinkItem("SM3 Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sm3.txt")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new LinkItem("No known practical attacks", "SM3 is considered secure for current cryptographic use")
      ];

      // Authentic test vectors from Crypto++ TestVectors/sm3.txt
      this.tests = [
        {
          text: "SM3: Empty message (Crypto++ generated)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sm3.txt",
          input: [],
          expected: OpCodes.Hex8ToBytes("1AB21D8355CFA17F8E61194831E81A8F22BEC8C728FEFB747ED035EB5082AA2B")
        },
        {
          text: "SM3: 'abc' (draft-shen-sm3-hash Appendix B)",
          uri: "https://tools.ietf.org/html/draft-shen-sm3-hash",
          input: OpCodes.Hex8ToBytes("616263"),
          expected: OpCodes.Hex8ToBytes("66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0")
        },
        {
          text: "SM3: 16 x 'abcd' (draft-shen-sm3-hash Appendix B)",
          uri: "https://tools.ietf.org/html/draft-shen-sm3-hash",
          input: OpCodes.Hex8ToBytes("61626364".repeat(16)),
          expected: OpCodes.Hex8ToBytes("debe9ff92275b8a138604889c18e5a4d6fdb70e5387e5765293dcba39c0c5732")
        },
        {
          text: "SM3: 1 word 'abcd' (Crypto++ generated)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sm3.txt",
          input: OpCodes.Hex8ToBytes("61626364"),
          expected: OpCodes.Hex8ToBytes("82EC580FE6D36AE4F81CAE3C73F4A5B3B5A09C943172DC9053C69FD8E18DCA1E")
        },
        {
          text: "SM3: 2 words (Crypto++ generated)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sm3.txt",
          input: OpCodes.Hex8ToBytes("6162636461626364"),
          expected: OpCodes.Hex8ToBytes("B58B85B795B34879C354428F7C78CD1486C4EF25EA4C5D68E611FF41C15731EF")
        },
        {
          text: "SM3: 8 words (Crypto++ generated)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sm3.txt",
          input: OpCodes.Hex8ToBytes("61626364".repeat(8)),
          expected: OpCodes.Hex8ToBytes("73EDEF5C9D3710F14DBAF892F50CE9DFAB48E462D837D93EC0F9422C5F2A4007")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Hash functions have no inverse
      }
      return new SM3Instance(this);
    }
  }

  // ===== INSTANCE CLASS =====

  class SM3Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // SM3 state: 8 x 32-bit words (256 bits)
      this.state = new Array(8);

      // Message buffer
      this.buffer = [];

      // Total message length in bytes
      this.messageLength = 0;

      // Initialize state
      this._initializeState();
    }

    // Initialize SM3 state with IV
    _initializeState() {
      // SM3 initial values (different from SHA-256)
      this.state[0] = 0x7380166f;
      this.state[1] = 0x4914b2b9;
      this.state[2] = 0x172442d7;
      this.state[3] = 0xda8a0600;
      this.state[4] = 0xa96f30bc;
      this.state[5] = 0x163138aa;
      this.state[6] = 0xe38dee4d;
      this.state[7] = 0xb0fb0e4e;
    }

    // Feed data to the hash
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }

      // Add to buffer
      this.buffer.push(...data);
      this.messageLength += data.length;

      // Process complete 512-bit (64-byte) blocks
      while (this.buffer.length >= 64) {
        const block = this.buffer.splice(0, 64);
        this._processBlock(block);
      }
    }

    // Process a single 512-bit block
    _processBlock(block) {
      // Load block as 16 big-endian 32-bit words
      const W = new Array(68); // Extended to 68 words for SM3
      for (let i = 0; i < 16; ++i) {
        const offset = i * 4;
        W[i] = OpCodes.Pack32BE(block[offset], block[offset + 1], block[offset + 2], block[offset + 3]);
      }

      // Expand message schedule (W[16] through W[67])
      for (let i = 16; i < 68; ++i) {
        W[i] = P1(W[i - 16] ^ W[i - 9] ^ OpCodes.RotL32(W[i - 3], 15)) ^
               OpCodes.RotL32(W[i - 13], 7) ^ W[i - 6];
      }

      // Initialize working variables
      let A = this.state[0];
      let B = this.state[1];
      let C = this.state[2];
      let D = this.state[3];
      let E = this.state[4];
      let F = this.state[5];
      let G = this.state[6];
      let H = this.state[7];

      // 64 rounds
      for (let j = 0; j < 64; ++j) {
        // Compute TJ constant
        const TJ = j < 16 ? 0x79CC4519 : 0x7A879D8A;
        const TJrot = OpCodes.RotL32(TJ, j % 32);

        // Compute W'[j] = W[j] ^ W[j+4]
        const Wj = W[j];
        const Wjp = Wj ^ W[j + 4];

        // Compute SS1, SS2, TT1, TT2
        const A12 = OpCodes.RotL32(A, 12);
        const SS1 = OpCodes.RotL32(A12 + E + TJrot, 7);
        const SS2 = SS1 ^ A12;

        let TT1, TT2;
        if (j < 16) {
          TT1 = FF1(A, B, C) + D + SS2 + Wjp;
          TT2 = GG1(E, F, G) + H + SS1 + Wj;
        } else {
          TT1 = FF2(A, B, C) + D + SS2 + Wjp;
          TT2 = GG2(E, F, G) + H + SS1 + Wj;
        }

        // Update working variables
        D = C;
        C = OpCodes.RotL32(B, 9);
        B = A;
        // NOTE: >>> 0 is JavaScript idiom for unsigned 32-bit conversion, not a bit shift operation
        A = TT1 >>> 0; // Ensure 32-bit unsigned

        H = G;
        G = OpCodes.RotL32(F, 19);
        F = E;
        E = P0(TT2);
      }

      // Update state (XOR with working variables as per SM3 spec)
      this.state[0] ^= A;
      this.state[1] ^= B;
      this.state[2] ^= C;
      this.state[3] ^= D;
      this.state[4] ^= E;
      this.state[5] ^= F;
      this.state[6] ^= G;
      this.state[7] ^= H;
    }

    // Get the hash result
    Result() {
      // Create a copy of the buffer for padding
      const finalBuffer = [...this.buffer];
      const bitLength = this.messageLength * 8;

      // Append padding bit (0x80)
      finalBuffer.push(0x80);

      // Pad with zeros until length ≡ 448 (mod 512) bits = 56 (mod 64) bytes
      while (finalBuffer.length % 64 !== 56) {
        finalBuffer.push(0);
      }

      // Append 64-bit big-endian message length
      // For messages < 2^32 bits, high 32 bits are 0
      const lengthHigh = Math.floor(bitLength / 0x100000000);
      // NOTE: >>> 0 is JavaScript idiom for unsigned 32-bit conversion, not a bit shift operation
      const lengthLow = bitLength >>> 0;

      const lengthBytes = [
        ...OpCodes.Unpack32BE(lengthHigh),
        ...OpCodes.Unpack32BE(lengthLow)
      ];
      finalBuffer.push(...lengthBytes);

      // Process final block(s)
      const stateCopy = [...this.state];
      for (let i = 0; i < finalBuffer.length; i += 64) {
        const block = finalBuffer.slice(i, i + 64);
        this._processBlock(block);
      }

      // Convert state to bytes (big-endian)
      const hash = [];
      for (let i = 0; i < 8; ++i) {
        const bytes = OpCodes.Unpack32BE(this.state[i]);
        hash.push(...bytes);
      }

      // Restore state for potential reuse (though typically hash is one-shot)
      this.state = stateCopy;

      return hash;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SM3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SM3Algorithm, SM3Instance };
}));
