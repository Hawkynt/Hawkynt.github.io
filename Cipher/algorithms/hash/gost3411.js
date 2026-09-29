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
  /** @type {uint8[][]} */
  const GOST_SBOX_DA = [
    OpCodes.Hex8ToBytes("0A040506080103070D0C0E0009020B0F"),
    OpCodes.Hex8ToBytes("050F0400020D0B09010706030C0E0A08"),
    OpCodes.Hex8ToBytes("070F0C0E09040100030B0502060A080D"),
    OpCodes.Hex8ToBytes("040A070C000F02080E0106050D0B0903"),
    OpCodes.Hex8ToBytes("0706040B090C020A0108000E0F0D0305"),
    OpCodes.Hex8ToBytes("070602040D090F000A01050B080E0C03"),
    OpCodes.Hex8ToBytes("0D0E04010700050A030C080F0602090B"),
    OpCodes.Hex8ToBytes("01030A09050B040F0806070E0D00020C")
  ];

  // Constant C[2] from GOST R 34.11-94 specification
  /** @type {uint8[]} */
  const C2 = OpCodes.Hex8ToBytes(
    "00FF00FF00FF00FF" +
    "FF00FF00FF00FF00" +
    "00FFFF00FF0000FF" +
    "FF000000FFFF00FF"
  );

  /**
   * GOST 28147-89 round function with D-A S-box
   * @param {uint32} data - right half
   * @param {uint32} key - subkey
   * @param {uint8[][]} sBox - eight 16-entry nibble S-boxes
   * @returns {uint32} f(data, key)
   */
  function gostRound(data, key, sBox) {
    const sum = OpCodes.Add32(data, key);

    // Unpack into bytes
    const bytes = OpCodes.Unpack32LE(sum);
    const b0 = bytes[0];
    const b1 = bytes[1];
    const b2 = bytes[2];
    const b3 = bytes[3];

    // S-box substitution (split each byte into nibbles)
    const s0 = OpCodes.Or8(sBox[0][OpCodes.And8(b0, 0x0F)], OpCodes.Shl8(sBox[1][OpCodes.Shr8(b0, 4)], 4));
    const s1 = OpCodes.Or8(sBox[2][OpCodes.And8(b1, 0x0F)], OpCodes.Shl8(sBox[3][OpCodes.Shr8(b1, 4)], 4));
    const s2 = OpCodes.Or8(sBox[4][OpCodes.And8(b2, 0x0F)], OpCodes.Shl8(sBox[5][OpCodes.Shr8(b2, 4)], 4));
    const s3 = OpCodes.Or8(sBox[6][OpCodes.And8(b3, 0x0F)], OpCodes.Shl8(sBox[7][OpCodes.Shr8(b3, 4)], 4));

    const result = OpCodes.Pack32LE(s0, s1, s2, s3);
    return OpCodes.RotL32(result, 11);
  }

  /**
   * GOST 28147-89 encryption (ECB mode, single block)
   * @param {uint32[]} key - eight subkeys
   * @param {uint8[]} input - 8-byte block
   * @param {uint8[][]} sBox - eight 16-entry nibble S-boxes
   * @returns {uint8[]} 8-byte ciphertext
   */
  function gostEncrypt(key, input, sBox) {
    let n1 = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
    let n2 = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);

    // 24 rounds (3 cycles of 8 subkeys)
    for (let cycle = 0; cycle < 3; ++cycle) {
      for (let i = 0; i < 8; ++i) {
        const temp = n1;
        n1 = OpCodes.Xor32(n2, gostRound(n1, key[i], sBox));
        n2 = temp;
      }
    }

    // Final 8 rounds (reverse key order)
    for (let i = 7; i >= 0; --i) {
      const temp = n1;
      n1 = OpCodes.Xor32(n2, gostRound(n1, key[i], sBox));
      n2 = temp;
    }

    /** @type {uint8[]} */
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

      /** @type {int32[]} */
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
   * Create new hash instance
   * @param {boolean} [isInverse=false] - Hashes have no inverse
   * @returns {GOST3411Instance} New hash instance, null when isInverse
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
 * GOST3411 hash instance implementing Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class GOST3411Instance extends IHashFunctionInstance {
    /**
     * @param {GOST3411Algorithm} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 32; // 256 bits

      /** @type {uint8[]} Hash state */
      this.H = [];
      /** @type {uint8[]} Length */
      this.L = [];
      /** @type {uint8[]} Message block */
      this.M = [];
      /** @type {uint8[]} Sum of all message blocks */
      this.Sum = [];
      /** @type {uint8[][]} Constants C[0], C[1], C[2], C[3] */
      this.C = null;
      /** @type {uint8[]} */
      this.xBuf = [];
      /** @type {int32} */
      this.xBufOff = 0;
      /** @type {int32} */
      this.byteCount = 0;

      this._Reset();
    }

    /**
     * Zero the state and reload the constants
     * @returns {void}
     */
    _Reset() {
      // State variables
      this.H = OpCodes.CreateArray(32, 0);
      this.L = OpCodes.CreateArray(32, 0);
      this.M = OpCodes.CreateArray(32, 0);
      this.Sum = OpCodes.CreateArray(32, 0);

      // Constants C[0], C[1], C[3] are all zeros, C[2] is the defined constant
      /** @type {uint8[][]} */
      const constants = [
        OpCodes.CreateArray(32, 0),
        OpCodes.CreateArray(32, 0),
        C2.slice(),
        OpCodes.CreateArray(32, 0)
      ];
      this.C = constants;

      this.xBuf = OpCodes.CreateArray(32, 0);
      this.xBufOff = 0;
      this.byteCount = 0;
    }

    /**
     * Start a new message
     * @returns {void}
     */
    Initialize() {
      this._Reset();
    }

    /**
   * Feed data to the hash
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; ++i) {
        this.xBuf[this.xBufOff] = OpCodes.ToByte(data[i]);
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
   * Finish the message and return the digest (the instance then restarts)
   * @returns {uint8[]} 32-byte digest
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

    /**
     * Permutation function P
     * @param {uint8[]} input - 32 bytes
     * @returns {uint8[]} 32 bytes
     */
    _P(input) {
      /** @type {uint8[]} */
      const K = new Array(32);
      for (let k = 0; k < 8; ++k) {
        K[4*k]     = input[k];
        K[1+4*k]   = input[8+k];
        K[2+4*k]   = input[16+k];
        K[3+4*k]   = input[24+k];
      }
      return K;
    }

    /**
     * Transformation function A, in place
     * @param {uint8[]} input - 32 bytes, updated
     * @returns {uint8[]} input
     */
    _A(input) {
      /** @type {uint8[]} */
      const a = new Array(8);
      for (let j = 0; j < 8; ++j) {
        a[j] = OpCodes.Xor8(input[j], input[j+8]);
      }

      // Shift: x0||x1||x2||x3 -> x1||x2||x3||(x0 xor x1)
      for (let i = 0; i < 24; ++i) {
        input[i] = input[i+8];
      }
      for (let i = 0; i < 8; ++i) {
        input[24+i] = a[i];
      }

      return input;
    }

    /**
     * Encryption function E (GOST 28147-89 with D-A S-box)
     * @param {uint8[]} key - 32-byte key
     * @param {uint8[]} s - output buffer
     * @param {int32} sOff - output offset
     * @param {uint8[]} h - input buffer
     * @param {int32} hOff - input offset
     * @returns {void}
     */
    _E(key, s, sOff, h, hOff) {
      // Expand key to 8 subkeys (32-bit words)
      /** @type {uint32[]} */
      const subkeys = new Array(8);
      for (let i = 0; i < 8; ++i) {
        const offset = i * 4;
        subkeys[i] = OpCodes.Pack32LE(key[offset], key[offset+1], key[offset+2], key[offset+3]);
      }

      // Prepare input block
      /** @type {uint8[]} */
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

    /**
     * Mixing function fw (16-bit word transformation), in place
     * @param {uint8[]} input - 32 bytes, updated
     * @returns {void}
     */
    _fw(input) {
      // Convert bytes to 16-bit words (little-endian)
      /** @type {uint16[]} */
      const wS = new Array(16);
      for (let i = 0; i < 16; ++i) {
        wS[i] = OpCodes.Pack16LE(input[i*2], input[i*2+1]);
      }

      // Apply transformation: w[15] = w[0] xor w[1] xor w[2] xor w[3] xor w[12] xor w[15]
      /** @type {uint16[]} */
      const w_S = new Array(16);
      const xor1 = OpCodes.Xor16(wS[0], wS[1]);
      const xor2 = OpCodes.Xor16(xor1, wS[2]);
      const xor3 = OpCodes.Xor16(xor2, wS[3]);
      const xor4 = OpCodes.Xor16(xor3, wS[12]);
      const xor5 = OpCodes.Xor16(xor4, wS[15]);
      w_S[15] = xor5;

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

    /**
     * Block processing (core hash compression function)
     * @param {uint8[]} input - message bytes
     * @param {int32} inOff - offset of the 32-byte block
     * @returns {void}
     */
    _processBlock(input, inOff) {
      // Copy message block
      for (let i = 0; i < 32; ++i) {
        this.M[i] = input[inOff + i];
      }

      // Working variables
      /** @type {uint8[]} */
      const U = new Array(32);
      /** @type {uint8[]} */
      const V = new Array(32);
      /** @type {uint8[]} */
      const W = new Array(32);
      /** @type {uint8[]} */
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
          W[j] = OpCodes.Xor8(U[j], V[j]);
        }

        // K = P(W)
        const K = this._P(W);

        // S[i] = E(K, H[i])
        this._E(K, S, i*8, this.H, i*8);

        if (i < 3) {
          // U = A(U) XOR C[i+1]
          this._A(U);
          for (let j = 0; j < 32; ++j) {
            U[j] = OpCodes.Xor8(U[j], this.C[i+1][j]);
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
        S[n] = OpCodes.Xor8(S[n], this.M[n]);
      }

      // Apply y to S
      this._fw(S);

      // S = H XOR S
      for (let n = 0; n < 32; ++n) {
        S[n] = OpCodes.Xor8(this.H[n], S[n]);
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

    /**
     * 256-bit modular addition into Sum
     * @param {uint8[]} input - 32 bytes
     * @returns {void}
     */
    _sumByteArray(input) {
      /** @type {uint32} */
      let carry = 0;
      for (let i = 0; i < 32; ++i) {
        const sum = OpCodes.Add32(OpCodes.Add32(OpCodes.ToByte(this.Sum[i]), OpCodes.ToByte(input[i])), carry);
        this.Sum[i] = OpCodes.ToByte(sum);
        // Extract carry (upper byte of 9-bit sum)
        carry = OpCodes.Shr32(sum, 8);
      }
    }

    /**
     * Finalization: pad, then fold in the length and the checksum
     * @returns {void}
     */
    _finish() {
      // Encode length as 256-bit little-endian; the bit count is kept to its
      // low 32 bits, exactly as Unpack32LE reduced it before
      const bitCount = OpCodes.Shl32(this.byteCount, 3);

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
