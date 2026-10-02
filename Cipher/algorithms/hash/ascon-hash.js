/*
 * ASCON Hash Family - NIST Lightweight Cryptography Standard
 * Professional implementation following reference C implementation
 * (c)2006-2025 Hawkynt
 *
 * ASCON-HASH: Fixed 256-bit hash output
 * ASCON-HASH256: Alias for ASCON-HASH (standardized in NIST SP 800-232)
 * ASCON-XOF: Extendable output function supporting variable-length output
 *
 * All variants selected as part of NIST's lightweight cryptography standard.
 * Reference: Southern Storm Software lightweight-crypto/src/combined/ascon-hash.c
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
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  /** @type {int32} */
  const ASCON_HASH_RATE = 8; // 64 bits (8 bytes)

  /**
   * 64-bit rotate right of a split word
   * @param {uint32} low - Low 32 bits
   * @param {uint32} high - High 32 bits
   * @param {int32} positions - Rotation amount
   * @returns {uint32[]} [low, high] of the rotated word
   */
  function rotr64(low, high, positions) {
    positions %= 64;
    if (positions === 0) return [low, high];
    if (positions === 32) return [high, low];

    if (positions < 32) {
      return [
        OpCodes.Or32(OpCodes.Shr32(low, positions), OpCodes.Shl32(high, 32 - positions)),
        OpCodes.Or32(OpCodes.Shr32(high, positions), OpCodes.Shl32(low, 32 - positions))
      ];
    }

    positions -= 32;
    return [
      OpCodes.Or32(OpCodes.Shr32(high, positions), OpCodes.Shl32(low, 32 - positions)),
      OpCodes.Or32(OpCodes.Shr32(low, positions), OpCodes.Shl32(high, 32 - positions))
    ];
  }

  // Shared Ascon permutation implementation
  class AsconPermutation {
    constructor() {
      // Ascon state: 5 x 64-bit words (stored as pairs of 32-bit values: [low32, high32])
      /** @type {uint32[][]} */
      this.S = new Array(5);
      for (let i = 0; i < 5; i++) {
        this.S[i] = OpCodes.Hex32ToDWords('0000000000000000');
      }
    }

    /**
     * Load the five state words
     * @param {uint32[]} s0 - Word 0 as [low, high]
     * @param {uint32[]} s1 - Word 1 as [low, high]
     * @param {uint32[]} s2 - Word 2 as [low, high]
     * @param {uint32[]} s3 - Word 3 as [low, high]
     * @param {uint32[]} s4 - Word 4 as [low, high]
     * @returns {void}
     */
    setInitialState(s0, s1, s2, s3, s4) {
      this.S[0] = s0.slice();
      this.S[1] = s1.slice();
      this.S[2] = s2.slice();
      this.S[3] = s3.slice();
      this.S[4] = s4.slice();
    }

    /**
     * Ascon permutation with 12 rounds (P12)
     * @returns {void}
     */
    permute() {
      // Reference: ascon-hash.c line 33-34, internal-ascon.c
      // Round constants: 0xf0, 0xe1, 0xd2, 0xc3, 0xb4, 0xa5, 0x96, 0x87, 0x78, 0x69, 0x5a, 0x4b
      this._round(0xf0);
      this._round(0xe1);
      this._round(0xd2);
      this._round(0xc3);
      this._round(0xb4);
      this._round(0xa5);
      this._round(0x96);
      this._round(0x87);
      this._round(0x78);
      this._round(0x69);
      this._round(0x5a);
      this._round(0x4b);
    }

    /**
     * Ascon round function
     * Reference: internal-ascon.c ascon_permute() function
     * @param {uint32} c - Round constant
     * @returns {void}
     */
    _round(c) {
      const S = this.S;

      // Addition of constants (to S[2] low word)
      S[2][0] = OpCodes.Xor32(S[2][0], c);

      // Substitution layer (S-box)
      // Pre-XOR phase
      S[0][0] = OpCodes.Xor32(S[0][0], S[4][0]); S[0][1] = OpCodes.Xor32(S[0][1], S[4][1]); // x0 ^= x4
      S[4][0] = OpCodes.Xor32(S[4][0], S[3][0]); S[4][1] = OpCodes.Xor32(S[4][1], S[3][1]); // x4 ^= x3
      S[2][0] = OpCodes.Xor32(S[2][0], S[1][0]); S[2][1] = OpCodes.Xor32(S[2][1], S[1][1]); // x2 ^= x1

      // Compute temporary values for 5-bit S-box
      /** @type {uint32} */
      const t0_l = OpCodes.And32(OpCodes.Not32(S[0][0]), S[1][0]);
      /** @type {uint32} */
      const t0_h = OpCodes.And32(OpCodes.Not32(S[0][1]), S[1][1]);
      /** @type {uint32} */
      const t1_l = OpCodes.And32(OpCodes.Not32(S[1][0]), S[2][0]);
      /** @type {uint32} */
      const t1_h = OpCodes.And32(OpCodes.Not32(S[1][1]), S[2][1]);
      /** @type {uint32} */
      const t2_l = OpCodes.And32(OpCodes.Not32(S[2][0]), S[3][0]);
      /** @type {uint32} */
      const t2_h = OpCodes.And32(OpCodes.Not32(S[2][1]), S[3][1]);
      /** @type {uint32} */
      const t3_l = OpCodes.And32(OpCodes.Not32(S[3][0]), S[4][0]);
      /** @type {uint32} */
      const t3_h = OpCodes.And32(OpCodes.Not32(S[3][1]), S[4][1]);
      /** @type {uint32} */
      const t4_l = OpCodes.And32(OpCodes.Not32(S[4][0]), S[0][0]);
      /** @type {uint32} */
      const t4_h = OpCodes.And32(OpCodes.Not32(S[4][1]), S[0][1]);

      // Apply S-box
      S[0][0] = OpCodes.Xor32(S[0][0], t1_l); S[0][1] = OpCodes.Xor32(S[0][1], t1_h);
      S[1][0] = OpCodes.Xor32(S[1][0], t2_l); S[1][1] = OpCodes.Xor32(S[1][1], t2_h);
      S[2][0] = OpCodes.Xor32(S[2][0], t3_l); S[2][1] = OpCodes.Xor32(S[2][1], t3_h);
      S[3][0] = OpCodes.Xor32(S[3][0], t4_l); S[3][1] = OpCodes.Xor32(S[3][1], t4_h);
      S[4][0] = OpCodes.Xor32(S[4][0], t0_l); S[4][1] = OpCodes.Xor32(S[4][1], t0_h);

      // Post-XOR phase
      S[1][0] = OpCodes.Xor32(S[1][0], S[0][0]); S[1][1] = OpCodes.Xor32(S[1][1], S[0][1]); // x1 ^= x0
      S[0][0] = OpCodes.Xor32(S[0][0], S[4][0]); S[0][1] = OpCodes.Xor32(S[0][1], S[4][1]); // x0 ^= x4
      S[3][0] = OpCodes.Xor32(S[3][0], S[2][0]); S[3][1] = OpCodes.Xor32(S[3][1], S[2][1]); // x3 ^= x2
      S[2][0] = OpCodes.Not32(S[2][0]);                        // x2 = ~x2
      S[2][1] = OpCodes.Not32(S[2][1]);

      // Linear diffusion layer
      this._diffuse(0, 19, 28);
      this._diffuse(1, 61, 39);
      this._diffuse(2, 1, 6);
      this._diffuse(3, 10, 17);
      this._diffuse(4, 7, 41);
    }

    /**
     * Linear diffusion of one word: x ^= rotr64(x, r0) ^ rotr64(x, r1)
     * @param {int32} i - State word index
     * @param {int32} n0 - First rotation
     * @param {int32} n1 - Second rotation
     * @returns {void}
     */
    _diffuse(i, n0, n1) {
      /** @type {uint32} */
      const lo = this.S[i][0];
      /** @type {uint32} */
      const hi = this.S[i][1];
      /** @type {uint32[]} */
      const r0 = rotr64(lo, hi, n0);
      /** @type {uint32[]} */
      const r1 = rotr64(lo, hi, n1);
      this.S[i][0] = OpCodes.Xor32(OpCodes.Xor32(lo, r0[0]), r1[0]);
      this.S[i][1] = OpCodes.Xor32(OpCodes.Xor32(hi, r0[1]), r1[1]);
    }
  }

  // ============================================================================
  // ASCON-HASH (256-bit fixed output)
  // ============================================================================

  /**
 * AsconHash - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class AsconHash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "ASCON-HASH";
      this.description = "Lightweight hash function based on Ascon permutation, finalist in CAESAR competition and standardized by NIST. Provides 256-bit security with efficient hardware and software implementations.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2014;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [new KeySize(32, 32, 1)];

      this.documentation = [
        new LinkItem(
          "NIST Lightweight Cryptography",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "Ascon Official Website",
          "https://ascon.iaik.tugraz.at/"
        ),
        new LinkItem(
          "NIST SP 800-232: Ascon Standard",
          "https://csrc.nist.gov/pubs/sp/800/232/final"
        ),
        new LinkItem(
          "CAESAR Competition",
          "https://competitions.cr.yp.to/caesar.html"
        )
      ];

      this.references = [
        new LinkItem("Official Ascon C reference implementation", "https://github.com/ascon/ascon-c"),
        new LinkItem("Ascon Python reference implementation", "https://github.com/ascon/ascon-python")
      ];

      // Official test vectors from ASCON-HASH.txt
      this.tests = [
        {
          text: "ASCON-HASH: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("7346BC14F036E87AE03D0997913088F5F68411434B3CF8B54FA796A80D251F91")
        },
        {
          text: "ASCON-HASH: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("8DD446ADA58A7740ECF56EB638EF775F7D5C0FD5F0C2BBBDFDEC29609D3C43A2")
        },
        {
          text: "ASCON-HASH: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("F77CA13BF89146D3254F1CFB7EDDBA8FA1BF162284BB29E7F645545CF9E08424")
        },
        {
          text: "ASCON-HASH: Three bytes (Count=4)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("15CCF3B00F73EF96FAA08C9B440660BEA52D6F6AA53C8E2DA3F8200A990A122F")
        },
        {
          text: "ASCON-HASH: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("8013EAAA1951580A7BEF7D29BAC323377E64F279EA73E6881B8AED69855EF764")
        },
        {
          text: "ASCON-HASH: Eight bytes (Count=9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("F4C6A44B29915D3D57CF928A18EC6226BB8DD6C1136ACD24965F7E7780CD69CF")
        }
      ];
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {IHashFunctionInstance} New hash instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new AsconHashInstance(this, 'hash');
    }
  }

  // ============================================================================
  // ASCON-HASH256 (Alias for ASCON-HASH with NIST SP 800-232 branding)
  // ============================================================================

  /**
 * AsconHash256 - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class AsconHash256 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Ascon-Hash256";
      this.description = "Lightweight hash function based on Ascon permutation, standardized in NIST SP 800-232. Provides 256-bit security with efficient hardware and software implementations.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2023;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AUSTRIA;

      this.SupportedOutputSizes = [new KeySize(32, 32, 1)];

      this.documentation = [
        new LinkItem(
          "NIST SP 800-232",
          "https://csrc.nist.gov/pubs/sp/800/232/final"
        ),
        new LinkItem(
          "Ascon Specification",
          "https://ascon.iaik.tugraz.at/"
        ),
        new LinkItem(
          "NIST LWC Announcement",
          "https://www.nist.gov/news-events/news/2023/02/nist-standardizes-ascon-cryptography-protecting-iot-devices"
        )
      ];

      this.references = [
        new LinkItem("Official Ascon C reference implementation", "https://github.com/ascon/ascon-c"),
        new LinkItem("Ascon Python reference implementation", "https://github.com/ascon/ascon-python")
      ];

      // Official NIST SP 800-232 test vectors (asconhash256 KAT, Count 1/2/3/5/9/17/33)
      this.tests = [
        {
          text: "Ascon-Hash256: Empty message (Count=1)",
          uri: "https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("0B3BE5850F2F6B98CAF29F8FDEA89B64A1FA70AA249B8F839BD53BAA304D92B2")
        },
        {
          text: "Ascon-Hash256: Single byte 0x00 (Count=2)",
          uri: "https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("0728621035AF3ED2BCA03BF6FDE900F9456F5330E4B5EE23E7F6A1E70291BC80")
        },
        {
          text: "Ascon-Hash256: Two bytes (Count=3)",
          uri: "https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("6115E7C9C4081C2797FC8FE1BC57A836AFA1C5381E556DD583860CA2DFB48DD2")
        },
        {
          text: "Ascon-Hash256: Four bytes (Count=5)",
          uri: "https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("D7E4C7ED9B8A325CD08B9EF259F8877054ECD8304FE1B2D7FD847137DF6727EE")
        },
        {
          text: "Ascon-Hash256: Eight bytes, exact rate multiple (Count=9)",
          uri: "https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("B88E497AE8E6FB641B87EF622EB8F2FCA0ED95383F7FFEBE167ACF1099BA764F")
        },
        {
          text: "Ascon-Hash256: Sixteen bytes (Count=17)",
          uri: "https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("3158C1940A2FBADBD68AB661777859B94A689E4EFC375911467ADDD641835C38")
        },
        {
          text: "Ascon-Hash256: 32 bytes (Count=33)",
          uri: "https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("BD9D3D60A66B53868EAB2A5C74539A518A1F60F01EB176C60E43DEE81680B33E")
        }
      ];
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {IHashFunctionInstance} New hash instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new AsconHashInstance(this, 'hash256');
    }
  }

  // ============================================================================
  // ASCON-XOF (Extendable Output Function)
  // ============================================================================

  /**
 * AsconXof - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class AsconXof extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "ASCON-XOF";
      this.description = "Lightweight extendable output function (XOF) based on Ascon permutation, standardized by NIST. Supports variable-length output with efficient hardware and software implementations for constrained environments.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2014;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight XOF";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // XOF supports arbitrary output sizes (common range 1-1024 bytes)
      this.SupportedOutputSizes = [new KeySize(1, 1024, 1)];

      this.documentation = [
        new LinkItem(
          "NIST Lightweight Cryptography",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "Ascon Official Website",
          "https://ascon.iaik.tugraz.at/"
        ),
        new LinkItem(
          "NIST SP 800-232: Ascon Standard",
          "https://csrc.nist.gov/pubs/sp/800/232/final"
        ),
        new LinkItem(
          "CAESAR Competition",
          "https://competitions.cr.yp.to/caesar.html"
        )
      ];

      this.references = [
        new LinkItem("Official Ascon C reference implementation", "https://github.com/ascon/ascon-c"),
        new LinkItem("Ascon Python reference implementation", "https://github.com/ascon/ascon-python")
      ];

      // Official test vectors from ASCON-XOF.txt
      this.tests = [
        {
          text: "ASCON-XOF: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes(""),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("5D4CBDE6350EA4C174BD65B5B332F8408F99740B81AA02735EAEFBCF0BA0339E")
        },
        {
          text: "ASCON-XOF: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("00"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("B2EDBB27AC8397A55BC83D137C151DE9EDE048338FE907F0D3629E717846FEDC")
        },
        {
          text: "ASCON-XOF: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("D196461C299DB714D78C267924B5786EE26FC43B3E640DAA5397E38E39D39DC6")
        },
        {
          text: "ASCON-XOF: Three bytes (Count=4)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("000102"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("1D18B9DD8FF9A1BF59751B88D32766C5E054910F497BFF4092AFC47F5885523B")
        },
        {
          text: "ASCON-XOF: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("66FB74174782AFED898478AA729058D5C30AF19AF2F5D4E1CE65CD320594EF66")
        },
        {
          text: "ASCON-XOF: Eight bytes (Count=9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("18427D2D29DF1E0202649F032F2080363FEC5DE72ECAE11B4F98CCC75843E7CC")
        },
        {
          text: "ASCON-XOF: Sixteen bytes (Count=17)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("C861A89CFB1335F278C96CF7FFC9753C290CBE1A4E186D2923B496BB4EA5E519")
        },
        {
          text: "ASCON-XOF: 32 bytes (Count=33)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("0B8E325B9BBF1BB43E77AA1EED93BEE62B4EA1E4B0C5A696B2F5C5B09C968918")
        }
      ];
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {IHashFunctionInstance} New hash instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new AsconHashInstance(this, 'xof');
    }
  }

  // ============================================================================
  // Shared Instance Implementation
  // ============================================================================

  /**
 * AsconHash hash instance implementing Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class AsconHashInstance extends IHashFunctionInstance {
    /**
     * @param {HashFunctionAlgorithm} algorithm - Parent algorithm
     * @param {string} variant - 'hash', 'hash256' or 'xof'
     */
    constructor(algorithm, variant) {
      super(algorithm);
      /** @type {string} */
      this.variant = variant; // 'hash', 'hash256', or 'xof'
      /** @type {AsconPermutation} */
      this.permutation = new AsconPermutation();
      /** @type {uint8[]} */
      this.buffer = new Uint8Array(ASCON_HASH_RATE);
      /** @type {int32} */
      this.bufferPos = 0;
      /** @type {int32} */
      this.mode = 0; // 0 = absorbing, 1 = squeezing (XOF only)
      /** @type {int32} */
      this._outputSize = 0; // 0 = not set yet
      this.Reset();
    }

    /**
     * Set the digest size in bytes (1..1024 for the XOF, 32 otherwise)
     * @param {int32} size - Digest size in bytes
     */
    set outputSize(size) {
      if (this.variant === 'xof') {
        if (size < 1 || size > 1024) {
          throw new Error('Invalid output size: ' + size + ' bytes');
        }
        this._outputSize = size;
      } else {
        if (size !== 32) {
          throw new Error('Invalid output size: ' + size + ' bytes (must be 32)');
        }
        this._outputSize = 32;
      }
    }

    /**
     * @returns {int32} Digest size in bytes
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * Load the IV of the variant and clear the buffer
     * @returns {void}
     */
    Reset() {
      // Set initial state based on variant
      if (this.variant === 'xof') {
        // ASCON-XOF IV (after P12 transformation)
        // Reference: ascon-xof.c lines 63-69
        this.permutation.setInitialState(
          OpCodes.Hex32ToDWords('814cd416b57e273b'), // 0xb57e273b814cd416
          OpCodes.Hex32ToDWords('62ae24202b510425'), // 0x2b51042562ae2420
          OpCodes.Hex32ToDWords('8ddf221866a3a776'), // 0x66a3a7768ddf2218
          OpCodes.Hex32ToDWords('8153650c5aad0a7a'), // 0x5aad0a7a8153650c
          OpCodes.Hex32ToDWords('539493b64f3e0e32')  // 0x4f3e0e32539493b6
        );
      } else if (this.variant === 'hash256') {
        // Ascon-Hash256 IV (NIST SP 800-232), state after P12 of 0x0000080100cc0002
        // Reference: ascon-c constants.h ASCON_HASH_IV0..ASCON_HASH_IV4
        this.permutation.setInitialState(
          OpCodes.Hex32ToDWords('e934d6819b1e5494'), // 0x9b1e5494e934d681
          OpCodes.Hex32ToDWords('333751d24bc3a01e'), // 0x4bc3a01e333751d2
          OpCodes.Hex32ToDWords('6b34b81aae65396c'), // 0xae65396c6b34b81a
          OpCodes.Hex32ToDWords('d56a4db33c7fd4a4'), // 0x3c7fd4a4d56a4db3
          OpCodes.Hex32ToDWords('06c5976d1a5c4649')  // 0x1a5c464906c5976d
        );
      } else {
        // ASCON-HASH IV (LWC round version, after P12 transformation)
        // Reference: ascon-hash.c lines 81-87
        this.permutation.setInitialState(
          OpCodes.Hex32ToDWords('db67f03dee9398aa'), // 0xee9398aadb67f03d
          OpCodes.Hex32ToDWords('c60f10028bb21831'), // 0x8bb21831c60f1002
          OpCodes.Hex32ToDWords('98d5da62b48a92db'), // 0xb48a92db98d5da62
          OpCodes.Hex32ToDWords('b8f8e3e843189921'), // 0x43189921b8f8e3e8
          OpCodes.Hex32ToDWords('d525e140348fa5c9')  // 0x348fa5c9d525e140
        );
      }

      this.buffer.fill(0);
      this.bufferPos = 0;
      this.mode = 0;
    }

    /**
     * Feed data to the hash
     * @param {uint8[]} data - Input data bytes
     * @returns {void}
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      // XOF: If we were squeezing, go back to absorb phase
      if (this.variant === 'xof' && this.mode === 1) {
        this.mode = 0;
        this.bufferPos = 0;
        this.permutation.permute();
      }

      /** @type {int32} */
      let offset = 0;

      // Handle partial block from previous Feed
      while (offset < data.length && this.bufferPos < ASCON_HASH_RATE) {
        this.buffer[this.bufferPos++] = data[offset++];
      }

      // Process complete blocks
      while (this.bufferPos === ASCON_HASH_RATE) {
        this._absorb();
        this.bufferPos = 0;

        while (offset < data.length && this.bufferPos < ASCON_HASH_RATE) {
          this.buffer[this.bufferPos++] = data[offset++];
        }
      }
    }

    /**
     * Finish the hash (or squeeze the XOF output) and reset the instance
     * @returns {uint8[]} Digest bytes
     */
    Result() {
      if (this.variant === 'xof') {
        return this._resultXof();
      }
      if (this.variant === 'hash256') {
        return this._resultHash256();
      }
      return this._resultHash();
    }

    /**
     * Rate word S[0] as 8 big-endian bytes (high word first)
     * @returns {uint8[]} 8 bytes
     */
    _rateBytesBE() {
      return OpCodes.Unpack32BE(this.permutation.S[0][1]).concat(OpCodes.Unpack32BE(this.permutation.S[0][0]));
    }

    /**
     * XOR the buffered partial block (big-endian, masked to its length) and
     * the 0x80 padding byte into the rate word
     * @param {int32} finalBytes - Buffered bytes (0..7)
     * @returns {void}
     */
    _padBE(finalBytes) {
      const S = this.permutation.S;

      // XOR partial block into state if present
      if (finalBytes > 0) {
        // Pack buffer data into 64-bit word (big-endian)
        /** @type {uint32} */
        const high = OpCodes.Pack32BE(
          this.buffer[0], this.buffer[1], this.buffer[2], this.buffer[3]
        );
        /** @type {uint32} */
        const low = OpCodes.Pack32BE(
          this.buffer[4], this.buffer[5], this.buffer[6], this.buffer[7]
        );

        // Create mask for partial block (big-endian: leftmost bytes count)
        /** @type {uint32} */
        let maskHigh = 0xFFFFFFFF;
        /** @type {uint32} */
        let maskLow = 0;
        if (finalBytes <= 4) {
          maskHigh = OpCodes.Shl32(0xFFFFFFFF, 8 * (4 - finalBytes));
        } else {
          maskLow = OpCodes.Shl32(0xFFFFFFFF, 8 * (8 - finalBytes));
        }

        // XOR masked data into S[0]
        S[0][0] = OpCodes.Xor32(S[0][0], OpCodes.And32(low, maskLow));
        S[0][1] = OpCodes.Xor32(S[0][1], OpCodes.And32(high, maskHigh));
      }

      // Apply 0x80 padding byte at position finalBytes
      if (finalBytes < 4) {
        // Padding in high word (bytes 0-3)
        S[0][1] = OpCodes.Xor32(S[0][1], OpCodes.Shl32(0x80, 8 * (3 - finalBytes)));
      } else {
        // Padding in low word (bytes 4-7)
        S[0][0] = OpCodes.Xor32(S[0][0], OpCodes.Shl32(0x80, 8 * (7 - finalBytes)));
      }
    }

    /**
     * NIST SP 800-232 finalisation: little-endian rate word, 0x01 padding byte
     * @returns {uint8[]} 32-byte digest
     */
    _resultHash256() {
      /** @type {int32} */
      const finalBytes = this.bufferPos;
      const S = this.permutation.S;

      // Zero-extend the partial block and append the 0x01 padding byte
      /** @type {uint8[]} */
      const padded = OpCodes.CreateArray(ASCON_HASH_RATE, 0);
      for (let i = 0; i < finalBytes; i++) {
        padded[i] = this.buffer[i];
      }
      padded[finalBytes] = 0x01;

      /** @type {uint32} */
      const low = OpCodes.Pack32LE(padded[0], padded[1], padded[2], padded[3]);
      /** @type {uint32} */
      const high = OpCodes.Pack32LE(padded[4], padded[5], padded[6], padded[7]);
      S[0][0] = OpCodes.Xor32(S[0][0], low);
      S[0][1] = OpCodes.Xor32(S[0][1], high);

      // Squeeze 32 bytes as four little-endian rate words
      /** @type {uint8[]} */
      let output = [];
      for (let block = 0; block < 4; block++) {
        this.permutation.permute();
        output = output.concat(OpCodes.Unpack32LE(S[0][0]), OpCodes.Unpack32LE(S[0][1]));
      }

      this.Reset();
      return output;
    }

    /**
     * ASCON-HASH finalisation: big-endian rate word, 0x80 padding byte
     * @returns {uint8[]} 32-byte digest
     */
    _resultHash() {
      // Fixed 256-bit output for ASCON-HASH
      this._padBE(this.bufferPos);

      // Squeeze phase: extract 32 bytes (4 blocks of 8 bytes)
      /** @type {uint8[]} */
      let output = [];
      for (let block = 0; block < 4; block++) {
        // Apply permutation before extracting each block
        this.permutation.permute();
        output = output.concat(this._rateBytesBE());
      }

      this.Reset();
      return output;
    }

    /**
     * ASCON-XOF finalisation and squeeze of outputSize bytes
     * @returns {uint8[]} XOF output
     */
    _resultXof() {
      if (!this._outputSize) {
        throw new Error("Output size not set");
      }

      // Pad the final input block if we were still in absorb phase
      if (this.mode === 0) {
        this._padBE(this.bufferPos);
        this.bufferPos = 0;
        this.mode = 1; // Switch to squeeze mode
      }

      // Squeeze phase: extract requested output bytes
      /** @type {uint8[]} */
      let output = [];
      /** @type {int32} */
      let outlen = this._outputSize;

      // Handle left-over partial blocks from last time (if Result() called multiple times)
      if (this.bufferPos > 0) {
        /** @type {int32} */
        let temp = ASCON_HASH_RATE - this.bufferPos;
        if (outlen < temp) temp = outlen;
        for (let i = 0; i < temp; i++) {
          output.push(this.buffer[this.bufferPos++]);
        }
        outlen -= temp;
        if (outlen === 0) {
          return output;
        }
        this.bufferPos = 0;
      }

      // Handle full blocks
      while (outlen >= ASCON_HASH_RATE) {
        this.permutation.permute();

        // Extract S[0] as big-endian bytes
        output = output.concat(this._rateBytesBE());
        outlen -= ASCON_HASH_RATE;
      }

      // Handle the left-over partial block
      if (outlen > 0) {
        this.permutation.permute();

        // Extract partial block from S[0]
        /** @type {uint8[]} */
        const stateBytes = this._rateBytesBE();

        for (let i = 0; i < outlen; i++) {
          output.push(stateBytes[i]);
          this.buffer[i] = stateBytes[i];
        }
        this.bufferPos = outlen;
      }

      this.Reset();
      return output;
    }

    /**
     * XOR the full buffered block into the rate word and permute
     * @returns {void}
     */
    _absorb() {
      const S = this.permutation.S;

      if (this.variant === 'hash256') {
        // NIST SP 800-232 loads message bytes little-endian into the rate word
        /** @type {uint32} */
        const loWord = OpCodes.Pack32LE(
          this.buffer[0], this.buffer[1], this.buffer[2], this.buffer[3]
        );
        /** @type {uint32} */
        const hiWord = OpCodes.Pack32LE(
          this.buffer[4], this.buffer[5], this.buffer[6], this.buffer[7]
        );

        S[0][0] = OpCodes.Xor32(S[0][0], loWord);
        S[0][1] = OpCodes.Xor32(S[0][1], hiWord);

        this.permutation.permute();
        return;
      }

      // XOR buffer into S[0] and apply permutation
      /** @type {uint32} */
      const high = OpCodes.Pack32BE(
        this.buffer[0], this.buffer[1], this.buffer[2], this.buffer[3]
      );
      /** @type {uint32} */
      const low = OpCodes.Pack32BE(
        this.buffer[4], this.buffer[5], this.buffer[6], this.buffer[7]
      );

      S[0][0] = OpCodes.Xor32(S[0][0], low);
      S[0][1] = OpCodes.Xor32(S[0][1], high);

      this.permutation.permute();
    }
  }

  // Register all three algorithms
  RegisterAlgorithm(new AsconHash());
  RegisterAlgorithm(new AsconHash256());
  RegisterAlgorithm(new AsconXof());

  return { AsconHash, AsconHash256, AsconXof };
}));
