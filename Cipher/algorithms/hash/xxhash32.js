/*
 * xxHash32 (XXH32) - Universal AlgorithmFramework Implementation
 * Implemented from the official specification:
 *   https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md
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

  // Specification section "XXH32 algorithm description", step 1.
  const PRIME32_1 = 0x9E3779B1;
  const PRIME32_2 = 0x85EBCA77;
  const PRIME32_3 = 0xC2B2AE3D;
  const PRIME32_4 = 0x27D4EB2F;
  const PRIME32_5 = 0x165667B1;

  // XXH32 consumes the input in 16-byte stripes.
  const STRIPE = 16;
  const DIGEST_BYTES = 4;

  /**
   * XXH32AlgorithmInstance and XXH32Algorithm - non-cryptographic 32-bit hash
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class XXHash32Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "xxHash32";
      this.description = "xxHash is an extremely fast non-cryptographic hash algorithm designed by Yann Collet. XXH32 produces a 32-bit hash and is optimized for speed on 32-bit platforms. It offers no collision or preimage resistance and must not be used where a cryptographic hash is required.";
      this.inventor = "Yann Collet";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "Fast Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.LOW;
      this.country = CountryCode.FR;

      // Hash-specific metadata
      this.SupportedOutputSizes = [DIGEST_BYTES]; // 32 bits

      // Performance and technical specifications
      this.blockSize = STRIPE; // 128 bits = 16 bytes
      this.outputSize = DIGEST_BYTES;

      // Documentation and references
      this.documentation = [
        new LinkItem("xxHash Specification", "https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md"),
        new LinkItem("xxHash Website", "https://xxhash.com/")
      ];

      this.references = [
        new LinkItem("xxHash Reference Implementation", "https://github.com/Cyan4973/xxHash"),
        new LinkItem("Official Sanity Check Vectors", "https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c"),
        new LinkItem("SMHasher Quality Results", "https://github.com/rurban/smhasher")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Not Cryptographically Secure",
          "xxHash is a checksum, not a cryptographic hash: collisions are easy to construct and it is not preimage resistant.",
          "Use only for hash tables, checksums and corruption detection. Use SHA-2, SHA-3 or BLAKE2 where security is required."
        )
      ];

      // The result is presented most significant byte first, which the
      // specification calls the canonical representation.
      this.tests = [
        {
          text: "Official sanity check, length 0, seed 0",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c",
          input: [],
          expected: OpCodes.Hex8ToBytes("02CC5D05")
        },
        // The next three inputs are the official sanity-check buffer, produced
        // by XSUM_fillTestBuffer in the same file: byteGen starts at PRIME32,
        // each byte is the top byte of byteGen and byteGen is then multiplied
        // by PRIME64.
        {
          text: "Official sanity check, length 1, seed 0",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("CF65B03E")
        },
        {
          text: "Official sanity check, length 14, seed 0",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c",
          input: OpCodes.Hex8ToBytes("0052929BB732A3242D00AF950EEC"),
          expected: OpCodes.Hex8ToBytes("1208E7E2")
        },
        {
          text: "Official sanity check, length 222, seed 0",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c",
          input: OpCodes.Hex8ToBytes(
            "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
            "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
            "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
            "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
            "F33449EB0FD13B92A1A963DBAAED3DCFF10942CDF9B321A2EBF2C8F4E42F48D1" +
            "4B10F4C2EFECF84AB53874C3A4A6620EBFFD633741E386981AEB4CBA56036687" +
            "ED004559C18544B6C368F941A9EAF987E09F12D0D51454485D444051E338"),
          expected: OpCodes.Hex8ToBytes("5BD11DBD")
        },
        {
          text: ".NET runtime XxHash32 test: 'abc'",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs",
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("32D153FF")
        },
        {
          text: ".NET runtime XxHash32 test: '123456' (6 bytes)",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs",
          input: OpCodes.AnsiToBytes("123456"),
          expected: OpCodes.Hex8ToBytes("B7014066")
        },
        {
          text: "pierrec/xxHash test: 'abcdefghijklmnop' (exactly one 16-byte stripe)",
          uri: "https://github.com/pierrec/xxHash/blob/master/xxHash32/xxHash32_test.go",
          input: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          expected: OpCodes.Hex8ToBytes("9D2D8B62")
        },
        {
          text: ".NET runtime XxHash32 test: 'Hashing!' repeated 3 times (24 bytes)",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs",
          input: OpCodes.AnsiToBytes("Hashing!Hashing!Hashing!"),
          expected: OpCodes.Hex8ToBytes("5DF7D6C0")
        },
        {
          text: ".NET runtime XxHash32 test: 20 bytes",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs",
          input: OpCodes.AnsiToBytes("12345678901234567890"),
          expected: OpCodes.Hex8ToBytes("2D0C3D1B")
        },
        {
          text: ".NET runtime XxHash32 test: 21 bytes, tail not a whole number of lanes",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs",
          input: OpCodes.AnsiToBytes("123456789012345678901"),
          expected: OpCodes.Hex8ToBytes("8ED1B04E")
        },
        {
          text: ".NET runtime XxHash32 test: '.NET Hashes This' repeated 3 times (48 bytes, exact multiple of the stripe)",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs",
          input: OpCodes.AnsiToBytes(".NET Hashes This.NET Hashes This.NET Hashes This"),
          expected: OpCodes.Hex8ToBytes("29DA7472")
        },
        {
          text: ".NET runtime XxHash32 test: '.NET Hashes This!' repeated 3 times (51 bytes)",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs",
          input: OpCodes.AnsiToBytes(".NET Hashes This!.NET Hashes This!.NET Hashes This!"),
          expected: OpCodes.Hex8ToBytes("1FE08A04")
        },
        {
          text: ".NET runtime XxHash32 test: '.NET now has non-crypto hashing' repeated 3 times (93 bytes)",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs",
          input: OpCodes.AnsiToBytes(".NET now has non-crypto hashing.NET now has non-crypto hashing.NET now has non-crypto hashing"),
          expected: OpCodes.Hex8ToBytes("65242024")
        },
        {
          text: ".NET runtime XxHash32 test: 'Nobody inspects the spammish repetition'",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs",
          input: OpCodes.AnsiToBytes("Nobody inspects the spammish repetition"),
          expected: OpCodes.Hex8ToBytes("E2293B2F")
        },
        {
          text: ".NET runtime XxHash32 test: 'The quick brown fox jumps over the lazy dog'",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("E85EA4DE")
        },
        {
          text: "pierrec/xxHash test: 'abcdefghijklmnopqrstuvwxyz0123456789' (36 bytes)",
          uri: "https://github.com/pierrec/xxHash/blob/master/xxHash32/xxHash32_test.go",
          input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz0123456789"),
          expected: OpCodes.Hex8ToBytes("42AE804D")
        }
      ];
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - Unused, a hash has no inverse
   * @returns {Object} New hash instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new XXHash32AlgorithmInstance(this, isInverse);
    }
  }

  /**
 * XXH32 instance implementing the Feed/Result streaming pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class XXHash32AlgorithmInstance extends IHashFunctionInstance {
    /**
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Unused
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = DIGEST_BYTES;
      this._seed = 0;
      this.Init();
    }

    /**
     * Reset the streaming state. XXH32 keeps four accumulators, a 16-byte
     * holdback for the partial stripe and the total length, which is what
     * decides between the long and short finalization paths.
     */
    Init() {
      const seed = OpCodes.ToDWord(this._seed);
      this._acc1 = OpCodes.ToDWord(seed + PRIME32_1 + PRIME32_2);
      this._acc2 = OpCodes.ToDWord(seed + PRIME32_2);
      this._acc3 = OpCodes.ToDWord(seed);
      this._acc4 = OpCodes.ToDWord(seed - PRIME32_1);
      this._held = new Array(STRIPE).fill(0);
      this._pending = 0;
      this._length = 0;
      return true;
    }

    /**
     * Set the 32-bit seed. Changing the seed restarts the message.
     * @param {number|uint8[]} key - Seed as a number or 4 little-endian bytes
     */
    KeySetup(key) {
      if (typeof key === 'number') {
        this._seed = OpCodes.ToDWord(key);
      } else if (Array.isArray(key) && key.length >= 4) {
        this._seed = OpCodes.Pack32LE(key[0], key[1], key[2], key[3]);
      } else {
        this._seed = 0;
      }
      this.Init();
      return true;
    }

    /**
     * Round function, specification step 2.
     * The multiplications must wrap at 32 bits; a double-precision product of
     * two 32-bit values loses low bits, so they go through Mul32.
     */
    _round(acc, lane) {
      acc = OpCodes.ToDWord(acc + OpCodes.Mul32(lane, PRIME32_2));
      acc = OpCodes.RotL32(acc, 13);
      return OpCodes.Mul32(acc, PRIME32_1);
    }

    /** Read one little-endian 32-bit lane out of a byte array */
    _lane(data, offset) {
      return OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    }

    /** Consume one full 16-byte stripe into the four accumulators */
    _stripe(data, offset) {
      this._acc1 = this._round(this._acc1, this._lane(data, offset));
      this._acc2 = this._round(this._acc2, this._lane(data, offset + 4));
      this._acc3 = this._round(this._acc3, this._lane(data, offset + 8));
      this._acc4 = this._round(this._acc4, this._lane(data, offset + 12));
    }

    /**
     * Feed data. Successive calls extend the message, so Feed(a); Feed(b)
     * hashes the same bytes as Feed(a || b).
     * @param {uint8[]} data - Input bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      const total = data.length;
      this._length += total;
      let offset = 0;

      // Top up the holdback first. Unlike a Merkle-Damgard absorber nothing is
      // held back deliberately here: XXH32 consumes every complete stripe and
      // the remainder is whatever the message length leaves over, so a full
      // holdback is processed as soon as it is full.
      if (this._pending > 0) {
        const take = Math.min(STRIPE - this._pending, total);
        for (let i = 0; i < take; i++)
          this._held[this._pending + i] = OpCodes.ToByte(data[i]);
        this._pending += take;
        offset = take;

        if (this._pending < STRIPE) return;

        this._stripe(this._held, 0);
        this._pending = 0;
      }

      while (offset + STRIPE <= total) {
        this._stripe(data, offset);
        offset += STRIPE;
      }

      while (offset < total)
        this._held[this._pending++] = OpCodes.ToByte(data[offset++]);
    }

    /**
     * Finalize, specification steps 3 to 7.
     * @returns {uint8[]} 4-byte digest, most significant byte first
     */
    Result() {
      let hash;

      // The accumulators are only merged when the message reached at least one
      // stripe. A shorter message never touched them and starts from the seed.
      if (this._length >= STRIPE) {
        hash = OpCodes.ToDWord(
          OpCodes.RotL32(this._acc1, 1) +
          OpCodes.RotL32(this._acc2, 7) +
          OpCodes.RotL32(this._acc3, 12) +
          OpCodes.RotL32(this._acc4, 18)
        );
      } else {
        hash = OpCodes.ToDWord(this._seed + PRIME32_5);
      }

      hash = OpCodes.ToDWord(hash + this._length);

      // Remaining whole lanes, then remaining bytes.
      let offset = 0;
      while (offset + 4 <= this._pending) {
        hash = OpCodes.ToDWord(hash + OpCodes.Mul32(this._lane(this._held, offset), PRIME32_3));
        hash = OpCodes.Mul32(OpCodes.RotL32(hash, 17), PRIME32_4);
        offset += 4;
      }

      while (offset < this._pending) {
        hash = OpCodes.ToDWord(hash + OpCodes.Mul32(this._held[offset], PRIME32_5));
        hash = OpCodes.Mul32(OpCodes.RotL32(hash, 11), PRIME32_1);
        offset++;
      }

      hash = this._avalanche(hash);

      this.Init();
      return OpCodes.Unpack32BE(hash);
    }

    /** Final mix, specification step 6 */
    _avalanche(hash) {
      hash = OpCodes.Xor32(hash, OpCodes.Shr32(hash, 15));
      hash = OpCodes.Mul32(hash, PRIME32_2);
      hash = OpCodes.Xor32(hash, OpCodes.Shr32(hash, 13));
      hash = OpCodes.Mul32(hash, PRIME32_3);
      hash = OpCodes.Xor32(hash, OpCodes.Shr32(hash, 16));
      return OpCodes.ToDWord(hash);
    }

    /**
     * Hash a complete message in one call.
     * @param {uint8[]} message - Message bytes
     * @returns {uint8[]} Digest bytes
     */
    Hash(message) {
      this.Init();
      this.Feed(message);
      return this.Result();
    }

    ClearData() {
      this.Init();
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new XXHash32Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XXHash32Algorithm, XXHash32AlgorithmInstance };
}));
