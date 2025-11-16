/*
 * GOST R 34.11-94 Hash Function Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * Reference: BouncyCastle GOST3411Digest.java
 * Standard: GOST R 34.11-94 (Russian national standard, superseded by Streebog)
 * Based on GOST 28147-89 cipher with D-A S-box
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
})((function() {
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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, Vulnerability } = AlgorithmFramework;

  // GOST 28147-89 D-A S-box (used for hash function)
  const GOST_SBOX_DA = [
    [0xA,0x4,0x5,0x6,0x8,0x1,0x3,0x7,0xD,0xC,0xE,0x0,0x9,0x2,0xB,0xF],
    [0x5,0xF,0x4,0x0,0x2,0xD,0xB,0x9,0x1,0x7,0x6,0x3,0xC,0xE,0xA,0x8],
    [0x7,0xF,0xC,0xE,0x9,0x4,0x1,0x0,0x3,0xB,0x5,0x2,0x6,0xA,0x8,0xD],
    [0x4,0xA,0x7,0xC,0x0,0xF,0x2,0x8,0xE,0x1,0x6,0x5,0xD,0xB,0x9,0x3],
    [0x7,0x6,0x4,0xB,0x9,0xC,0x2,0xA,0x1,0x8,0x0,0xE,0xF,0xD,0x3,0x5],
    [0x7,0x6,0x2,0x4,0xD,0x9,0xF,0x0,0xA,0x1,0x5,0xB,0x8,0xE,0xC,0x3],
    [0xD,0xE,0x4,0x1,0x7,0x0,0x5,0xA,0x3,0xC,0x8,0xF,0x6,0x2,0x9,0xB],
    [0x1,0x3,0xA,0x9,0x5,0xB,0x4,0xF,0x8,0x6,0x7,0xE,0xD,0x0,0x2,0xC]
  ];

  // Constant C[2] from GOST R 34.11-94 specification
  const C2 = [
    0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,
    0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00,
    0x00,0xFF,0xFF,0x00,0xFF,0x00,0x00,0xFF,
    0xFF,0x00,0x00,0x00,0xFF,0xFF,0x00,0xFF
  ];

  // GOST 28147-89 round function with D-A S-box
  function gostRound(data, key, sBox) {
    const sum = OpCodes.Add32(data, key);

    // Unpack into bytes
    const [b0, b1, b2, b3] = OpCodes.Unpack32LE(sum);

    // S-box substitution (split each byte into nibbles)
    const s0 = sBox[0][b0 & 0x0F] | (sBox[1][Math.floor(b0 / 16)] * 16);
    const s1 = sBox[2][b1 & 0x0F] | (sBox[3][Math.floor(b1 / 16)] * 16);
    const s2 = sBox[4][b2 & 0x0F] | (sBox[5][Math.floor(b2 / 16)] * 16);
    const s3 = sBox[6][b3 & 0x0F] | (sBox[7][Math.floor(b3 / 16)] * 16);

    const result = OpCodes.Pack32LE(s0, s1, s2, s3);
    return OpCodes.RotL32(result, 11);
  }

  // GOST 28147-89 encryption (ECB mode, single block)
  function gostEncrypt(key, input, sBox) {
    let n1 = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
    let n2 = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);

    // 24 rounds (3 cycles of 8 subkeys)
    for (let cycle = 0; cycle < 3; ++cycle) {
      for (let i = 0; i < 8; ++i) {
        const temp = n1;
        n1 = n2 ^ gostRound(n1, key[i], sBox);
        n2 = temp;
      }
    }

    // Final 8 rounds (reverse key order)
    for (let i = 7; i >= 0; --i) {
      const temp = n1;
      n1 = n2 ^ gostRound(n1, key[i], sBox);
      n2 = temp;
    }

    const output = new Array(8);
    const bytes1 = OpCodes.Unpack32LE(n2);
    const bytes2 = OpCodes.Unpack32LE(n1);
    output[0] = bytes1[0]; output[1] = bytes1[1]; output[2] = bytes1[2]; output[3] = bytes1[3];
    output[4] = bytes2[0]; output[5] = bytes2[1]; output[6] = bytes2[2]; output[7] = bytes2[3];

    return output;
  }

  /**
 * GOST3411Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class GOST3411Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "GOST R 34.11-94";
      this.description = "Soviet/Russian national hash standard producing 256-bit digests. Uses GOST 28147-89 cipher internally with D-A S-box. Superseded by Streebog (GOST R 34.11-2012).";
      this.inventor = "Soviet Union cryptographers";
      this.year = 1994;
      this.category = CategoryType.HASH;
      this.subCategory = "Hash Function";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedHashSizes = [32]; // 256 bits

      this.documentation = [
        new LinkItem("GOST R 34.11-94 Standard", "https://www.tc26.ru/en/standard/gost/"),
        new LinkItem("RFC 5831 - GOST R 34.11-94", "https://www.rfc-editor.org/rfc/rfc5831"),
        new LinkItem("Wikipedia - GOST hash function", "https://en.wikipedia.org/wiki/GOST_(hash_function)")
      ];

      this.references = [
        new LinkItem("BouncyCastle GOST3411Digest.java", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/GOST3411Digest.java"),
        new LinkItem("Streebog - Modern replacement", "https://www.tc26.ru/en/standard/gost/GOST_R_3411-2012_eng.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Deprecated standard",
          "GOST R 34.11-94 has been superseded by Streebog (GOST R 34.11-2012) since 2012.",
          "Use Streebog for new applications requiring Russian cryptographic standards."
        ),
        new Vulnerability(
          "Collision resistance",
          "Theoretical attacks on collision resistance exist, though no practical collisions are known.",
          "Consider this algorithm for legacy compatibility only, not for new security applications."
        )
      ];

      // Test vectors from BouncyCastle GOST3411DigestTest.java with D-A S-box
      this.tests = [
        {
          text: "BouncyCastle Test Vector 1 - Empty string",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/GOST3411DigestTest.java",
          input: OpCodes.AnsiToBytes(""),
          expected: OpCodes.Hex8ToBytes("981e5f3ca30c841487830f84fb433e13ac1101569b9c13584ac483234cd656c0")
        },
        {
          text: "BouncyCastle Test Vector 2 - 32 bytes",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/GOST3411DigestTest.java",
          input: OpCodes.AnsiToBytes("This is message, length=32 bytes"),
          expected: OpCodes.Hex8ToBytes("2cefc2f7b7bdc514e18ea57fa74ff357e7fa17d652c75f69cb1be7893ede48eb")
        },
        {
          text: "BouncyCastle Test Vector 3 - 50 bytes",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/GOST3411DigestTest.java",
          input: OpCodes.AnsiToBytes("Suppose the original message has length = 50 bytes"),
          expected: OpCodes.Hex8ToBytes("c3730c5cbccacf915ac292676f21e8bd4ef75331d9405e5f1a61dc3130a65011")
        },
        {
          text: "BouncyCastle Test Vector 4 - Alphanumeric",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/GOST3411DigestTest.java",
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
          expected: OpCodes.Hex8ToBytes("73b70a39497de53a6e08c67b6d4db853540f03e9389299d9b0156ef7e85d0f61")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      // Hash functions don't have inverse
      if (isInverse) {
        return null;
      }
      return new GOST3411Instance(this);
    }
  }

  /**
 * GOST3411 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GOST3411Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 32; // 256 bits
      this._Reset();
    }

    _Reset() {
      // State variables
      this.H = new Array(32);   // Hash state
      this.L = new Array(32);   // Length
      this.M = new Array(32);   // Message block
      this.Sum = new Array(32); // Sum of all message blocks

      // Constants C[0], C[1], C[2], C[3]
      this.C = [
        new Array(32), // C[0] - all zeros
        new Array(32), // C[1] - all zeros
        new Array(32), // C[2] - defined constant
        new Array(32)  // C[3] - all zeros
      ];

      this.xBuf = new Array(32);
      this.xBufOff = 0;
      this.byteCount = 0;

      // Initialize all arrays to zero
      for (let i = 0; i < 32; ++i) {
        this.H[i] = 0;
        this.L[i] = 0;
        this.M[i] = 0;
        this.Sum[i] = 0;
        this.C[0][i] = 0;
        this.C[1][i] = 0;
        this.C[2][i] = C2[i];
        this.C[3][i] = 0;
        this.xBuf[i] = 0;
      }
    }

    Initialize() {
      this._Reset();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; ++i) {
        this.xBuf[this.xBufOff] = data[i] & 0xFF;
        ++this.xBufOff;

        if (this.xBufOff === 32) {
          this._sumByteArray(this.xBuf);
          this._processBlock(this.xBuf, 0);
          this.xBufOff = 0;
        }
        ++this.byteCount;
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Finalize hash
      this._finish();

      // Return hash value
      const result = this.H.slice(0);

      // Reset for next hash
      this._Reset();

      return result;
    }

    // Permutation function P
    _P(input) {
      const K = new Array(32);
      for (let k = 0; k < 8; ++k) {
        K[4*k]     = input[k];
        K[1+4*k]   = input[8+k];
        K[2+4*k]   = input[16+k];
        K[3+4*k]   = input[24+k];
      }
      return K;
    }

    // Transformation function A
    _A(input) {
      const a = new Array(8);
      for (let j = 0; j < 8; ++j) {
        a[j] = (input[j] ^ input[j+8]) & 0xFF;
      }

      // Shift: x0||x1||x2||x3 -> x1||x2||x3||(x0^x1)
      for (let i = 0; i < 24; ++i) {
        input[i] = input[i+8];
      }
      for (let i = 0; i < 8; ++i) {
        input[24+i] = a[i];
      }

      return input;
    }

    // Encryption function E (GOST 28147-89 with D-A S-box)
    _E(key, s, sOff, h, hOff) {
      // Expand key to 8 subkeys (32-bit words)
      const subkeys = new Array(8);
      for (let i = 0; i < 8; ++i) {
        const offset = i * 4;
        subkeys[i] = OpCodes.Pack32LE(key[offset], key[offset+1], key[offset+2], key[offset+3]);
      }

      // Prepare input block
      const inputBlock = new Array(8);
      for (let i = 0; i < 8; ++i) {
        inputBlock[i] = h[hOff + i];
      }

      // Encrypt
      const output = gostEncrypt(subkeys, inputBlock, GOST_SBOX_DA);

      // Store result
      for (let i = 0; i < 8; ++i) {
        s[sOff + i] = output[i];
      }
    }

    // Mixing function fw (16-bit word transformation)
    _fw(input) {
      // Convert bytes to 16-bit words (little-endian)
      const wS = new Array(16);
      for (let i = 0; i < 16; ++i) {
        wS[i] = OpCodes.Pack16LE(input[i*2], input[i*2+1]);
      }

      // Apply transformation: w[15] = w[0] ^ w[1] ^ w[2] ^ w[3] ^ w[12] ^ w[15]
      const w_S = new Array(16);
      w_S[15] = (wS[0] ^ wS[1] ^ wS[2] ^ wS[3] ^ wS[12] ^ wS[15]) & 0xFFFF;

      // Shift: w[i] = w[i+1] for i=0..14
      for (let i = 0; i < 15; ++i) {
        w_S[i] = wS[i+1];
      }

      // Convert back to bytes
      for (let i = 0; i < 16; ++i) {
        const bytes = OpCodes.Unpack16LE(w_S[i]);
        input[i*2] = bytes[0];
        input[i*2+1] = bytes[1];
      }
    }

    // Block processing (core hash compression function)
    _processBlock(input, inOff) {
      // Copy message block
      for (let i = 0; i < 32; ++i) {
        this.M[i] = input[inOff + i];
      }

      // Working variables
      const U = new Array(32);
      const V = new Array(32);
      const W = new Array(32);
      const S = new Array(32);

      // Initialize U = H, V = M
      for (let i = 0; i < 32; ++i) {
        U[i] = this.H[i];
        V[i] = this.M[i];
      }

      // Key generation and encryption (4 iterations)
      for (let i = 0; i < 4; ++i) {
        // W = U XOR V
        for (let j = 0; j < 32; ++j) {
          W[j] = (U[j] ^ V[j]) & 0xFF;
        }

        // K = P(W)
        const K = this._P(W);

        // S[i] = E(K, H[i])
        this._E(K, S, i*8, this.H, i*8);

        if (i < 3) {
          // U = A(U) XOR C[i+1]
          this._A(U);
          for (let j = 0; j < 32; ++j) {
            U[j] = (U[j] ^ this.C[i+1][j]) & 0xFF;
          }

          // V = A(A(V))
          this._A(V);
          this._A(V);
        }
      }

      // x(M, H) = y^61(H XOR y(M XOR y^12(S)))

      // Apply y^12 to S
      for (let n = 0; n < 12; ++n) {
        this._fw(S);
      }

      // S = S XOR M
      for (let n = 0; n < 32; ++n) {
        S[n] = (S[n] ^ this.M[n]) & 0xFF;
      }

      // Apply y to S
      this._fw(S);

      // S = H XOR S
      for (let n = 0; n < 32; ++n) {
        S[n] = (this.H[n] ^ S[n]) & 0xFF;
      }

      // Apply y^61 to S
      for (let n = 0; n < 61; ++n) {
        this._fw(S);
      }

      // H = S
      for (let i = 0; i < 32; ++i) {
        this.H[i] = S[i];
      }
    }

    // 256-bit modular addition
    _sumByteArray(input) {
      let carry = 0;
      for (let i = 0; i < 32; ++i) {
        const sum = (this.Sum[i] & 0xFF) + (input[i] & 0xFF) + carry;
        this.Sum[i] = sum & 0xFF;
        // Extract carry (upper byte of 9-bit sum)
        carry = Math.floor(sum / 256);
      }
    }

    // Finalization
    _finish() {
      // Encode length as 256-bit little-endian
      const bitCount = this.byteCount * 8;

      // Store bit count in L (little-endian, 64-bit is enough for practical purposes)
      for (let i = 0; i < 32; ++i) {
        this.L[i] = 0;
      }

      // Pack 64-bit bit count (little-endian)
      const bitCountBytes = OpCodes.Unpack32LE(bitCount);
      this.L[0] = bitCountBytes[0];
      this.L[1] = bitCountBytes[1];
      this.L[2] = bitCountBytes[2];
      this.L[3] = bitCountBytes[3];
      // Higher bytes remain 0 for practical message sizes

      // Pad with zeros to complete block
      while (this.xBufOff !== 0) {
        this.xBuf[this.xBufOff] = 0;
        ++this.xBufOff;

        if (this.xBufOff === 32) {
          this._sumByteArray(this.xBuf);
          this._processBlock(this.xBuf, 0);
          this.xBufOff = 0;
        }
      }

      // Process length block
      this._processBlock(this.L, 0);

      // Process sum block
      this._processBlock(this.Sum, 0);
    }
  }

  const algorithmInstance = new GOST3411Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { GOST3411Algorithm, GOST3411Instance };
});
