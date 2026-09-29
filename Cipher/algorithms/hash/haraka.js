/*
 * Haraka Hash Function Family (Haraka-256 and Haraka-512)
 * Based on AES round function, optimized for Intel AES-NI
 * From: "Haraka v2 – Efficient Short-Input Hashing for Post-Quantum Applications"
 * Authors: Stefan Kölbl, Martin M. Lauridsen, Florian Mendel, Christian Rechberger
 * Conference: IACR ePrint Archive 2016/098
 * (c)2006-2025 Hawkynt
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework.js'),
      require('../../OpCodes.js')
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

  // AES S-box for Haraka operations
  /** @type {uint8[]} */
  const AES_SBOX = Object.freeze(OpCodes.Hex8ToBytes(
    "637C777BF26B6FC53001672BFED7AB76CA82C97DFA5947F0ADD4A2AF9CA472C0" +
    "B7FD9326363FF7CC34A5E5F171D8311504C723C31896059A071280E2EB27B275" +
    "09832C1A1B6E5AA0523BD6B329E32F8453D100ED20FCB15B6ACBBE394A4C58CF" +
    "D0EFAAFB434D338545F9027F503C9FA851A3408F929D38F5BCB6DA2110FFF3D2" +
    "CD0C13EC5F974417C4A77E3D645D197360814FDC222A908846EEB814DE5E0BDB" +
    "E0323A0A4906245CC2D3AC629195E479E7C8376D8DD54EA96C56F4EA657AAE08" +
    "BA78252E1CA6B4C6E8DD741F4BBD8B8A703EB5664803F60E613557B986C11D9E" +
    "E1F8981169D98E949B1E87E9CE5528DF8CA1890DBFE6426841992D0FB054BB16"
  ));

  // Haraka round constants (from reference implementation)
  /** @type {uint8[][]} */
  const HARAKA_RC_ROWS = [
    Object.freeze(OpCodes.Hex8ToBytes("9D7B8175F0FEC5B20AC020E64C708406")),
    Object.freeze(OpCodes.Hex8ToBytes("17F7082FA46B0F646BA0F388E1B4668B")),
    Object.freeze(OpCodes.Hex8ToBytes("1491029F609D02CF9884F2532DDE0234")),
    Object.freeze(OpCodes.Hex8ToBytes("794F5BFDAFBCF3BB084F7B2EE6EAD60E")),
    Object.freeze(OpCodes.Hex8ToBytes("447039BE1CCDEE798B447248CBB0CFCB")),
    Object.freeze(OpCodes.Hex8ToBytes("7B058A2BED35538DB732906EEECDEA7E")),
    Object.freeze(OpCodes.Hex8ToBytes("1BEF4FDA612741E2D07C2E5E438FC267")),
    Object.freeze(OpCodes.Hex8ToBytes("3B0BC71FE2FD5F6707CCCAAFB0D92429")),
    Object.freeze(OpCodes.Hex8ToBytes("EE65D4B9CA8FDBECE97F86E6F1634DAB")),
    Object.freeze(OpCodes.Hex8ToBytes("337E03AD4F402A5B64CDB7D484BF301C")),
    Object.freeze(OpCodes.Hex8ToBytes("0098F68D2E8B0269BF231794B90BCCB2")),
    Object.freeze(OpCodes.Hex8ToBytes("8A2D9D5CC89EAA4A72556FDEA67804FA")),
    Object.freeze(OpCodes.Hex8ToBytes("D49F12292E4FFA0E122A776B2B9FB4DF")),
    Object.freeze(OpCodes.Hex8ToBytes("EE126ABBAE11D63236A249F44403A11E")),
    Object.freeze(OpCodes.Hex8ToBytes("A6ECA89CC900965F8400054B884904AF")),
    Object.freeze(OpCodes.Hex8ToBytes("EC93E527E3C7A2784F9C199DD85E0221")),
    Object.freeze(OpCodes.Hex8ToBytes("7301D482CD2E28B9B7C959A7F8AA3ABF")),
    Object.freeze(OpCodes.Hex8ToBytes("6B7D3010D9EFF23717B086610D706062")),
    Object.freeze(OpCodes.Hex8ToBytes("C69AFCF65391C28143043021C245CA5A")),
    Object.freeze(OpCodes.Hex8ToBytes("3A94D136E892AF2CBB686B223C972392")),
    Object.freeze(OpCodes.Hex8ToBytes("B47110E558B9BA6CEB8658223892BFD3")),
    Object.freeze(OpCodes.Hex8ToBytes("8D12E124DDFD3D9377C6F0AEE53C86DB")),
    Object.freeze(OpCodes.Hex8ToBytes("B11222CBE38DE4839CA0EBFF686260BB")),
    Object.freeze(OpCodes.Hex8ToBytes("7DF72BC74E1AB92D9CD1E4E2DCD34B73")),
    Object.freeze(OpCodes.Hex8ToBytes("4E92B32CC415144B431B3061C347BB43")),
    Object.freeze(OpCodes.Hex8ToBytes("9968EB16DD31B203F6EF07E7A875A7DB")),
    Object.freeze(OpCodes.Hex8ToBytes("2C47CA7E02235E8E7759753C4B61F36D")),
    Object.freeze(OpCodes.Hex8ToBytes("F91786B8B9E51B6D777DDED6175AA7CD")),
    Object.freeze(OpCodes.Hex8ToBytes("5DEE46A99D066C9DAAE9A86BF0436BEC")),
    Object.freeze(OpCodes.Hex8ToBytes("C127F33B591153A22B3357F950691ECB")),
    Object.freeze(OpCodes.Hex8ToBytes("D9D00E605303EDE49C61DA00750CEE2C")),
    Object.freeze(OpCodes.Hex8ToBytes("50A3A463BCBABB80AB0CE996A1A5B1F0")),
    Object.freeze(OpCodes.Hex8ToBytes("39CA8D9330DE0DAB8829965E02B13DAE")),
    Object.freeze(OpCodes.Hex8ToBytes("42B4752EA8F314880BA454D5388FBB17")),
    Object.freeze(OpCodes.Hex8ToBytes("F6160A3679B7B6AED77F425F5B8ABB34")),
    Object.freeze(OpCodes.Hex8ToBytes("DEAFBAFF1859CE433854E5CB4152F626")),
    Object.freeze(OpCodes.Hex8ToBytes("78C99E83F79CCAA26A02F3B9549AE94C")),
    Object.freeze(OpCodes.Hex8ToBytes("35129022286EC040BEF7DF1B1AA551AE")),
    Object.freeze(OpCodes.Hex8ToBytes("CF59A6480FBC73C12BD27EBA3C61C1A0")),
    Object.freeze(OpCodes.Hex8ToBytes("A19DC5E9FDBDD64A8882280203CC6A75"))
  ];
  /** @type {uint8[][]} */
  const HARAKA_RC = Object.freeze(HARAKA_RC_ROWS);

  // Helper functions for AES operations using OpCodes

  /**
   * AES SubBytes
   * @param {uint8[]} state - 16 bytes
   * @returns {uint8[]} substituted bytes
   */
  function aesSubBytes(state) {
    /** @type {uint8[]} */
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = AES_SBOX[state[i]];
    }
    return result;
  }

  /**
   * AES ShiftRows
   * @param {uint8[]} state - 16 bytes, column-major
   * @returns {uint8[]} shifted bytes
   */
  function aesShiftRows(state) {
    /** @type {uint8[]} */
    const result = [
      state[0], state[5], state[10], state[15],  // Row 0: no shift
      state[4], state[9], state[14], state[3],   // Row 1: left shift 1
      state[8], state[13], state[2], state[7],   // Row 2: left shift 2
      state[12], state[1], state[6], state[11]   // Row 3: left shift 3
    ];
    return result;
  }

  /**
   * Galois field multiplication by x in GF(2^8) (AES polynomial)
   * @param {uint8} p - byte
   * @returns {uint8} p times x
   */
  function mulX(p) {
    const reduce = OpCodes.Shr8(OpCodes.And8(p, 0x80), 7) === 1 ? 0x1B : 0x00;
    return OpCodes.Xor8(OpCodes.Shl8(OpCodes.And8(p, 0x7F), 1), reduce);
  }

  /**
   * AES MixColumns
   * @param {uint8[]} state - 16 bytes, column-major
   * @returns {uint8[]} mixed bytes
   */
  function aesMixColumns(state) {
    /** @type {uint8[]} */
    const result = new Array(16);
    let j = 0;

    // Process each column (4 bytes)
    for (let i = 0; i < 4; ++i) {
      const c0 = state[4 * i];
      const c1 = state[4 * i + 1];
      const c2 = state[4 * i + 2];
      const c3 = state[4 * i + 3];

      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(mulX(c0), mulX(c1)), c1), c2), c3);
      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(c0, mulX(c1)), mulX(c2)), c2), c3);
      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(c0, c1), mulX(c2)), mulX(c3)), c3);
      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(mulX(c0), c0), c1), c2), mulX(c3));
    }

    return result;
  }

  /**
   * One AES encryption round (SubBytes, ShiftRows, MixColumns, AddRoundKey)
   * @param {uint8[]} state - 16 bytes
   * @param {uint8[]} roundKey - 16 bytes
   * @returns {uint8[]} new state
   */
  function aesEncryptRound(state, roundKey) {
    state = aesSubBytes(state);
    state = aesShiftRows(state);
    state = aesMixColumns(state);

    // Add round key using OpCodes XOR
    return OpCodes.XorArrays(state, roundKey);
  }

  // ===== HARAKA-256 ALGORITHM =====

  /**
 * Haraka256Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Haraka256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Haraka-256";
      this.description = "High-performance hash function optimized for short inputs using AES round function. Designed for post-quantum cryptographic applications with Intel AES-NI optimization.";
      this.inventor = "Stefan Kölbl, Martin M. Lauridsen, Florian Mendel, Christian Rechberger";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AT; // Austria (TU Graz)

      /** @type {int32} */
      this.inputSize = 32;  // 256 bits
      /** @type {int32} */
      this.outputSize = 32; // 256 bits

      this.documentation = [
        new LinkItem("IACR ePrint Archive", "https://eprint.iacr.org/2016/098.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/kste/haraka"),
        new LinkItem("Bouncy Castle Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/Haraka256Digest.java")
      ];

      this.references = [
        new LinkItem("Official Haraka reference implementation (Kölbl et al.)", "https://github.com/kste/haraka")
      ];

      // Official test vectors from Appendix B, Haraka-256 v2, IACR ePrint 2016/098
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          OpCodes.Hex8ToBytes("8027CCB87949774B78D0545FB72BF70C695C2A0923CBD47BBA1159EFBF2B2C1C"),
          "IACR ePrint 2016/098 Appendix B",
          "https://eprint.iacr.org/2016/098.pdf"
        )
      ];
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - Hashes have no inverse
   * @returns {Haraka256Instance} New hash instance, null when isInverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new Haraka256Instance(this);
    }
  }

  /**
 * Haraka256 hash instance implementing Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class Haraka256Instance extends IHashFunctionInstance {
    /**
     * @param {Haraka256Algorithm} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      if (this.inputBuffer.length + data.length > 32) {
        throw new Error("Input too long: Haraka-256 accepts exactly 32 bytes");
      }

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length !== 32) {
        throw new Error('Invalid input size: expected 32 bytes, got ' + this.inputBuffer.length);
      }

      return this._haraka256(this.inputBuffer);
    }

    /**
     * Haraka-256 permutation plus feed-forward
     * @param {uint8[]} input - 32 bytes
     * @returns {uint8[]} 32-byte digest
     */
    _haraka256(input) {
      // Split 32-byte input into two 16-byte blocks
      /** @type {uint8[][]} */
      const s1 = [
        input.slice(0, 16),    // s1[0]
        input.slice(16, 32)    // s1[1]
      ];

      /** @type {uint8[][]} */
      const s2 = [OpCodes.CreateArray(16, 0), OpCodes.CreateArray(16, 0)];
      const original = input.slice(); // Save original for final XOR

      // 5 rounds of Haraka-256
      for (let round = 0; round < 5; ++round) {
        // Apply 2 AES rounds per Haraka round
        s1[0] = aesEncryptRound(s1[0], HARAKA_RC[round * 4]);
        s1[1] = aesEncryptRound(s1[1], HARAKA_RC[round * 4 + 1]);
        s1[0] = aesEncryptRound(s1[0], HARAKA_RC[round * 4 + 2]);
        s1[1] = aesEncryptRound(s1[1], HARAKA_RC[round * 4 + 3]);

        // Mix operation - interleave the blocks
        this._mix256(s1, s2);

        // Copy s2 back to s1 for next round
        s1[0] = s2[0].slice();
        s1[1] = s2[1].slice();
      }

      // Final XOR with original input (Davies-Meyer construction)
      /** @type {uint8[]} */
      const output = new Array(32);
      for (let i = 0; i < 16; ++i) {
        output[i] = OpCodes.Xor8(s2[0][i], original[i]);
        output[i + 16] = OpCodes.Xor8(s2[1][i], original[i + 16]);
      }

      return output;
    }

    /**
     * Haraka-256 mix: interleave the two blocks of s1 into s2
     * @param {uint8[][]} s1 - two 16-byte blocks
     * @param {uint8[][]} s2 - two 16-byte blocks, written
     * @returns {void}
     */
    _mix256(s1, s2) {
      // Haraka-256 mix operation - specific interleaving pattern
      for (let i = 0; i < 4; ++i) {
        s2[0][i] = s1[0][i];
        s2[0][i + 4] = s1[1][i];
        s2[0][i + 8] = s1[0][i + 4];
        s2[0][i + 12] = s1[1][i + 4];

        s2[1][i] = s1[0][i + 8];
        s2[1][i + 4] = s1[1][i + 8];
        s2[1][i + 8] = s1[0][i + 12];
        s2[1][i + 12] = s1[1][i + 12];
      }
    }
  }

  // ===== HARAKA-512 ALGORITHM =====

  /**
 * Haraka512Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Haraka512Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Haraka-512";
      this.description = "High-performance hash function for 512-bit inputs producing 256-bit output using AES round function. Optimized for post-quantum signature schemes requiring efficient hashing.";
      this.inventor = "Stefan Kölbl, Martin M. Lauridsen, Florian Mendel, Christian Rechberger";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AT; // Austria (TU Graz)

      /** @type {int32} */
      this.inputSize = 64;  // 512 bits
      /** @type {int32} */
      this.outputSize = 32; // 256 bits

      this.documentation = [
        new LinkItem("IACR ePrint Archive", "https://eprint.iacr.org/2016/098.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/kste/haraka"),
        new LinkItem("Bouncy Castle Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/Haraka512Digest.java")
      ];

      this.references = [
        new LinkItem("Official Haraka reference implementation (Kölbl et al.)", "https://github.com/kste/haraka")
      ];

      // Official test vectors from Appendix B, Haraka-512 v2, IACR ePrint 2016/098
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          OpCodes.Hex8ToBytes("BE7F723B4E80A99813B292287F306F625A6D57331CAE5F34DD9277B0945BE2AA"),
          "IACR ePrint 2016/098 Appendix B",
          "https://eprint.iacr.org/2016/098.pdf"
        )
      ];
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - Hashes have no inverse
   * @returns {Haraka512Instance} New hash instance, null when isInverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new Haraka512Instance(this);
    }
  }

  /**
 * Haraka512 hash instance implementing Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class Haraka512Instance extends IHashFunctionInstance {
    /**
     * @param {Haraka512Algorithm} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      if (this.inputBuffer.length + data.length > 64) {
        throw new Error("Input too long: Haraka-512 accepts exactly 64 bytes");
      }

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length !== 64) {
        throw new Error('Invalid input size: expected 64 bytes, got ' + this.inputBuffer.length);
      }

      return this._haraka512(this.inputBuffer);
    }

    /**
     * Haraka-512 permutation, feed-forward and truncation
     * @param {uint8[]} input - 64 bytes
     * @returns {uint8[]} 32-byte digest
     */
    _haraka512(input) {
      // Split 64-byte input into four 16-byte blocks
      /** @type {uint8[][]} */
      const s1 = [
        input.slice(0, 16),    // s1[0]
        input.slice(16, 32),   // s1[1]
        input.slice(32, 48),   // s1[2]
        input.slice(48, 64)    // s1[3]
      ];

      /** @type {uint8[][]} */
      const s2 = [OpCodes.CreateArray(16, 0), OpCodes.CreateArray(16, 0), OpCodes.CreateArray(16, 0), OpCodes.CreateArray(16, 0)];
      let rcIndex = 0; // Round constant index

      // 5 rounds of Haraka-512 (following reference implementation exactly)
      for (let round = 0; round < 5; ++round) {
        // Apply 2 AES rounds per Haraka round to each block
        s1[0] = aesEncryptRound(s1[0], HARAKA_RC[rcIndex++]);
        s1[1] = aesEncryptRound(s1[1], HARAKA_RC[rcIndex++]);
        s1[2] = aesEncryptRound(s1[2], HARAKA_RC[rcIndex++]);
        s1[3] = aesEncryptRound(s1[3], HARAKA_RC[rcIndex++]);

        s1[0] = aesEncryptRound(s1[0], HARAKA_RC[rcIndex++]);
        s1[1] = aesEncryptRound(s1[1], HARAKA_RC[rcIndex++]);
        s1[2] = aesEncryptRound(s1[2], HARAKA_RC[rcIndex++]);
        s1[3] = aesEncryptRound(s1[3], HARAKA_RC[rcIndex++]);

        // Mix operation - interleave the four blocks
        this._mix512(s1, s2);

        // Copy s2 back to s1 for next round
        for (let i = 0; i < 4; ++i) {
          s1[i] = s2[i].slice();
        }
      }

      // Final XOR with original message (Davies-Meyer construction)
      s1[0] = OpCodes.XorArrays(s2[0], input.slice(0, 16));
      s1[1] = OpCodes.XorArrays(s2[1], input.slice(16, 32));
      s1[2] = OpCodes.XorArrays(s2[2], input.slice(32, 48));
      s1[3] = OpCodes.XorArrays(s2[3], input.slice(48, 64));

      // Haraka-512 specific output construction (256-bit output from 512-bit input)
      /** @type {uint8[]} */
      const output = new Array(32);

      // Copy s1[0][8:15] (8 bytes)
      for (let i = 0; i < 8; ++i) {
        output[i] = s1[0][i + 8];
      }

      // Copy s1[1][8:15] (8 bytes)
      for (let i = 0; i < 8; ++i) {
        output[i + 8] = s1[1][i + 8];
      }

      // Copy s1[2][0:7] (8 bytes)
      for (let i = 0; i < 8; ++i) {
        output[i + 16] = s1[2][i];
      }

      // Copy s1[3][0:7] (8 bytes)
      for (let i = 0; i < 8; ++i) {
        output[i + 24] = s1[3][i];
      }

      return output;
    }

    /**
     * Haraka-512 mix: interleave the four blocks of s1 into s2
     * @param {uint8[][]} s1 - four 16-byte blocks
     * @param {uint8[][]} s2 - four 16-byte blocks, written
     * @returns {void}
     */
    _mix512(s1, s2) {
      // Haraka-512 mix operation - complex interleaving of four blocks
      for (let i = 0; i < 4; ++i) {
        s2[0][i] = s1[0][i + 12];
        s2[0][i + 4] = s1[2][i + 12];
        s2[0][i + 8] = s1[1][i + 12];
        s2[0][i + 12] = s1[3][i + 12];

        s2[1][i] = s1[2][i];
        s2[1][i + 4] = s1[0][i];
        s2[1][i + 8] = s1[3][i];
        s2[1][i + 12] = s1[1][i];

        s2[2][i] = s1[2][i + 4];
        s2[2][i + 4] = s1[0][i + 4];
        s2[2][i + 8] = s1[3][i + 4];
        s2[2][i + 12] = s1[1][i + 4];

        s2[3][i] = s1[0][i + 8];
        s2[3][i + 4] = s1[2][i + 8];
        s2[3][i + 8] = s1[1][i + 8];
        s2[3][i + 12] = s1[3][i + 8];
      }
    }
  }

  // Register both algorithms
  RegisterAlgorithm(new Haraka256Algorithm());
  RegisterAlgorithm(new Haraka512Algorithm());

  // Export for module systems
  return { Haraka256Algorithm, Haraka256Instance, Haraka512Algorithm, Haraka512Instance };
}));
