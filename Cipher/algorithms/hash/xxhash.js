/*
 * xxHash64 (XXH64) - Universal AlgorithmFramework Implementation
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

  // Specification section "XXH64 algorithm description".
  const PRIME64_1 = 0x9E3779B185EBCA87n;
  const PRIME64_2 = 0xC2B2AE3D27D4EB4Fn;
  const PRIME64_3 = 0x165667B19E3779F9n;
  const PRIME64_4 = 0x85EBCA77C2B2AE63n;
  const PRIME64_5 = 0x27D4EB2F165667C5n;

  const MASK64 = 0xFFFFFFFFFFFFFFFFn;

  // XXH64 consumes the input in 32-byte stripes of four 8-byte lanes.
  const STRIPE = 32;
  const DIGEST_BYTES = 8;

  /** Wrap a BigInt to 64 bits */
  function u64(value) {
    return OpCodes.AndN(value, MASK64);
  }

  /** Read one little-endian 64-bit lane out of a byte array */
  function lane64(data, offset) {
    let value = 0n;
    for (let i = 7; i >= 0; i--)
      value = OpCodes.OrN(OpCodes.ShiftLn(value, 8), BigInt(OpCodes.ToByte(data[offset + i])));
    return value;
  }

  /** Read one little-endian 32-bit lane out of a byte array, widened to 64 bits */
  function lane32(data, offset) {
    let value = 0n;
    for (let i = 3; i >= 0; i--)
      value = OpCodes.OrN(OpCodes.ShiftLn(value, 8), BigInt(OpCodes.ToByte(data[offset + i])));
    return value;
  }

  /** Serialize a 64-bit value most significant byte first, the canonical form */
  function toCanonical(value) {
    const bytes = new Array(DIGEST_BYTES);
    for (let i = DIGEST_BYTES - 1; i >= 0; i--) {
      bytes[i] = Number(OpCodes.AndN(value, 0xFFn));
      value = OpCodes.ShiftRn(value, 8);
    }
    return bytes;
  }

  /**
   * XXHash64Algorithm - non-cryptographic 64-bit hash
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class XXHash64Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "xxHash64";
      this.description = "xxHash is an extremely fast non-cryptographic hash algorithm designed by Yann Collet. XXH64 produces a 64-bit hash and is the variant intended for 64-bit platforms. It offers no collision or preimage resistance and must not be used where a cryptographic hash is required.";
      this.inventor = "Yann Collet";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "Fast Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.LOW;
      this.country = CountryCode.FR;

      // Hash-specific metadata
      this.SupportedOutputSizes = [DIGEST_BYTES]; // 64 bits

      // Performance and technical specifications
      this.blockSize = STRIPE; // 256 bits = 32 bytes
      this.outputSize = DIGEST_BYTES;

      // Documentation and references
      this.documentation = [
        new LinkItem("xxHash Specification", "https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md"),
        new LinkItem("xxHash Website", "https://xxhash.com/")
      ];

      this.references = [
        new LinkItem("xxHash Reference Implementation", "https://github.com/Cyan4973/xxHash"),
        new LinkItem("Official Sanity Check Vectors", "https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c"),
        new LinkItem("LZ4 Compression Usage", "https://github.com/lz4/lz4")
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
        // The first four inputs are the official sanity-check buffer, produced
        // by XSUM_fillTestBuffer in the same file: byteGen starts at PRIME32,
        // each byte is the top byte of byteGen and byteGen is then multiplied
        // by PRIME64.
        {
          text: "Official sanity check, length 0, seed 0",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c",
          input: [],
          expected: OpCodes.Hex8ToBytes("EF46DB3751D8E999")
        },
        {
          text: "Official sanity check, length 1, seed 0",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("E934A84ADB052768")
        },
        {
          text: "Official sanity check, length 4, seed 0",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c",
          input: OpCodes.Hex8ToBytes("0052929B"),
          expected: OpCodes.Hex8ToBytes("9136A0DCA57457EE")
        },
        {
          text: "Official sanity check, length 14, seed 0",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c",
          input: OpCodes.Hex8ToBytes("0052929BB732A3242D00AF950EEC"),
          expected: OpCodes.Hex8ToBytes("8282DCC4994E35C8")
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
          expected: OpCodes.Hex8ToBytes("B641AE8CB691C174")
        },
        {
          text: "pierrec/xxHash test: 'a'",
          uri: "https://github.com/pierrec/xxHash/blob/master/xxHash64/xxHash64_test.go",
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("D24EC4F1A98C6E5B")
        },
        {
          text: "pierrec/xxHash test: 'abc'",
          uri: "https://github.com/pierrec/xxHash/blob/master/xxHash64/xxHash64_test.go",
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("44BC2CF5AD770999")
        },
        {
          text: "pierrec/xxHash test: 'abcdefg' (7 bytes, tail shorter than a lane)",
          uri: "https://github.com/pierrec/xxHash/blob/master/xxHash64/xxHash64_test.go",
          input: OpCodes.AnsiToBytes("abcdefg"),
          expected: OpCodes.Hex8ToBytes("1860940E2902822D")
        },
        {
          text: "pierrec/xxHash test: 'abcdefgh' (exactly one 8-byte lane)",
          uri: "https://github.com/pierrec/xxHash/blob/master/xxHash64/xxHash64_test.go",
          input: OpCodes.AnsiToBytes("abcdefgh"),
          expected: OpCodes.Hex8ToBytes("3AD351775B4634B7")
        },
        {
          text: ".NET runtime XxHash64 test: '.NET now has non-crypto hashing' (31 bytes, one under the stripe)",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs",
          input: OpCodes.AnsiToBytes(".NET now has non-crypto hashing"),
          expected: OpCodes.Hex8ToBytes("D8444D7806DFDE0E")
        },
        {
          text: "pierrec/xxHash test: 'abcdefghijklmnopqrstuvwxyz012345' (exactly one 32-byte stripe)",
          uri: "https://github.com/pierrec/xxHash/blob/master/xxHash64/xxHash64_test.go",
          input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz012345"),
          expected: OpCodes.Hex8ToBytes("BF2CD639B4143B80")
        },
        {
          text: ".NET runtime XxHash64 test: 'This string has 33 ASCII bytes...' repeated 3 times (99 bytes)",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs",
          input: OpCodes.AnsiToBytes("This string has 33 ASCII bytes...This string has 33 ASCII bytes...This string has 33 ASCII bytes..."),
          expected: OpCodes.Hex8ToBytes("488DF4E623587E10")
        },
        {
          text: ".NET runtime XxHash64 test: 'This string has 32 ASCII bytes..' repeated 3 times (96 bytes, exact multiple of the stripe)",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs",
          input: OpCodes.AnsiToBytes("This string has 32 ASCII bytes..This string has 32 ASCII bytes..This string has 32 ASCII bytes.."),
          expected: OpCodes.Hex8ToBytes("975E3E6FE7E67FBC")
        },
        {
          text: ".NET runtime XxHash64 test: '0123456789ABCDEF' repeated 3 times (48 bytes)",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs",
          input: OpCodes.AnsiToBytes("0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF"),
          expected: OpCodes.Hex8ToBytes("BDD40F0FAC166EAA")
        },
        {
          text: "cespare/xxhash test: 63-byte input exercising every code path",
          uri: "https://github.com/cespare/xxhash/blob/main/xxhash_test.go",
          input: OpCodes.AnsiToBytes("Call me Ishmael. Some years ago--never mind how long precisely-"),
          expected: OpCodes.Hex8ToBytes("02A2E85470D6FD96")
        },
        {
          text: ".NET runtime XxHash64 test: 'Nobody inspects the spammish repetition'",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs",
          input: OpCodes.AnsiToBytes("Nobody inspects the spammish repetition"),
          expected: OpCodes.Hex8ToBytes("FBCEA83C8A378BF1")
        },
        {
          text: ".NET runtime XxHash64 test: 'The quick brown fox jumps over the lazy dog'",
          uri: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("0B242D361FDA71BC")
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
      return new XXHash64AlgorithmInstance(this, isInverse);
    }
  }

  /**
 * XXH64 instance implementing the Feed/Result streaming pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class XXHash64AlgorithmInstance extends IHashFunctionInstance {
    /**
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Unused
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = DIGEST_BYTES;
      this._seed = 0n;
      this.Init();
    }

    /**
     * Reset the streaming state. XXH64 keeps four accumulators, a 32-byte
     * holdback for the partial stripe and the total length, which is what
     * decides between the long and short finalization paths.
     */
    Init() {
      const seed = u64(this._seed);
      this._acc1 = u64(seed + PRIME64_1 + PRIME64_2);
      this._acc2 = u64(seed + PRIME64_2);
      this._acc3 = seed;
      this._acc4 = u64(seed - PRIME64_1);
      this._held = new Array(STRIPE).fill(0);
      this._pending = 0;
      this._length = 0;
      return true;
    }

    /**
     * Set the 64-bit seed. Changing the seed restarts the message.
     * @param {number|BigInt|uint8[]} key - Seed value or 8 little-endian bytes
     */
    KeySetup(key) {
      if (typeof key === 'bigint') {
        this._seed = u64(key);
      } else if (typeof key === 'number') {
        this._seed = u64(BigInt(Math.trunc(key)));
      } else if (Array.isArray(key) && key.length >= 8) {
        this._seed = lane64(key, 0);
      } else {
        this._seed = 0n;
      }
      this.Init();
      return true;
    }

    /** Round function, specification step 2 */
    _round(acc, lane) {
      acc = u64(acc + u64(lane * PRIME64_2));
      acc = OpCodes.RotL64n(acc, 31);
      return u64(acc * PRIME64_1);
    }

    /** Accumulator merge, specification step 3 */
    _merge(acc, accN) {
      acc = OpCodes.XorN(acc, this._round(0n, accN));
      acc = u64(acc * PRIME64_1);
      return u64(acc + PRIME64_4);
    }

    /** Consume one full 32-byte stripe into the four accumulators */
    _stripe(data, offset) {
      this._acc1 = this._round(this._acc1, lane64(data, offset));
      this._acc2 = this._round(this._acc2, lane64(data, offset + 8));
      this._acc3 = this._round(this._acc3, lane64(data, offset + 16));
      this._acc4 = this._round(this._acc4, lane64(data, offset + 24));
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

      // Top up the holdback first. Nothing is held back deliberately here:
      // XXH64 consumes every complete stripe and the remainder is whatever the
      // message length leaves over, so a full holdback is processed at once.
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
     * @returns {uint8[]} 8-byte digest, most significant byte first
     */
    Result() {
      let acc;

      // The accumulators are only merged when the message reached at least one
      // stripe. A shorter message never touched them and starts from the seed.
      if (this._length >= STRIPE) {
        acc = u64(
          OpCodes.RotL64n(this._acc1, 1) +
          OpCodes.RotL64n(this._acc2, 7) +
          OpCodes.RotL64n(this._acc3, 12) +
          OpCodes.RotL64n(this._acc4, 18)
        );
        acc = this._merge(acc, this._acc1);
        acc = this._merge(acc, this._acc2);
        acc = this._merge(acc, this._acc3);
        acc = this._merge(acc, this._acc4);
      } else {
        acc = u64(this._seed + PRIME64_5);
      }

      acc = u64(acc + BigInt(this._length));

      // Remaining whole 8-byte lanes, then a spare 4-byte lane, then bytes.
      let offset = 0;
      while (offset + 8 <= this._pending) {
        acc = OpCodes.XorN(acc, this._round(0n, lane64(this._held, offset)));
        acc = u64(OpCodes.RotL64n(acc, 27) * PRIME64_1);
        acc = u64(acc + PRIME64_4);
        offset += 8;
      }

      if (offset + 4 <= this._pending) {
        acc = OpCodes.XorN(acc, u64(lane32(this._held, offset) * PRIME64_1));
        acc = u64(OpCodes.RotL64n(acc, 23) * PRIME64_2);
        acc = u64(acc + PRIME64_3);
        offset += 4;
      }

      while (offset < this._pending) {
        acc = OpCodes.XorN(acc, u64(BigInt(this._held[offset]) * PRIME64_5));
        acc = u64(OpCodes.RotL64n(acc, 11) * PRIME64_1);
        offset++;
      }

      acc = this._avalanche(acc);

      this.Init();
      return toCanonical(acc);
    }

    /** Final mix, specification step 6 */
    _avalanche(acc) {
      acc = OpCodes.XorN(acc, OpCodes.ShiftRn(acc, 33));
      acc = u64(acc * PRIME64_2);
      acc = OpCodes.XorN(acc, OpCodes.ShiftRn(acc, 29));
      acc = u64(acc * PRIME64_3);
      acc = OpCodes.XorN(acc, OpCodes.ShiftRn(acc, 32));
      return u64(acc);
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

  const algorithmInstance = new XXHash64Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XXHash64Algorithm, XXHash64AlgorithmInstance };
}));
