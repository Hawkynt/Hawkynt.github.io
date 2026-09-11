
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

  /**
 * CityHash - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class CityHash extends HashFunctionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "CityHash";
        this.description = "Fast non-cryptographic hash function developed by Google. Optimized for short strings with excellent speed and distribution.";
        this.category = CategoryType.HASH;
        this.subCategory = "Fast Hash";
        this.securityStatus = SecurityStatus.EDUCATIONAL; // Non-cryptographic
        this.complexity = ComplexityType.MEDIUM;

        // Algorithm properties
        this.inventor = "Geoff Pike, Jyrki Alakuijala";
        this.year = 2011;
        this.country = CountryCode.US;

        // Hash-specific properties
        this.hashSize = 64; // bits (8 bytes) 
        this.blockSize = 0; // Variable input size
        this.outputSize = 8; // 64 bits = 8 bytes
        this.SupportedOutputSizes = [8]; // 64 bits = 8 bytes

        // Documentation
        this.documentation = [
          new LinkItem("CityHash Official Repository", "https://github.com/google/cityhash"),
          new LinkItem("Hash Function Performance Analysis", "https://github.com/aappleby/smhasher"),
          new LinkItem("Wikipedia CityHash", "https://en.wikipedia.org/wiki/CityHash")
        ];

        this.references = [
          new LinkItem("Google CityHash Implementation", "https://github.com/google/cityhash"),
          new LinkItem("Abseil C++ Libraries", "https://github.com/abseil/abseil-cpp")
        ];

        // Official CityHash64 test vectors from google/cityhash src/city-test.cc.
        // That file builds a deterministic 1 MiB pseudorandom buffer in setup()
        // and then checks Test(testdata[i], i * i, i) - i.e. the first column of
        // row i is CityHash64 over the i bytes at offset i*i. The inputs below are
        // those exact byte ranges, and the expected values are the published
        // first-column entries. Lengths chosen to cover every branch boundary of
        // CityHash64: 0/4/8/16 inside HashLen0to16, 17 and 32 for HashLen17to32,
        // 33 and 64 for HashLen33to64, and 65/96/128/200 for the 64-byte chunk loop.
        const CITY_TEST = "https://github.com/google/cityhash/blob/master/src/city-test.cc";
        this.tests = [
          {
            text: "CityHash64 - empty string (city-test.cc row 0)",
            uri: CITY_TEST,
            input: [],
            expected: OpCodes.Hex8ToBytes("9ae16a3b2f90404f")
          },
          {
            text: "CityHash64 - 1 byte (city-test.cc row 1)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes("e4"),
            expected: OpCodes.Hex8ToBytes("541150e87f415e96")
          },
          {
            text: "CityHash64 - 4 bytes, 32-bit fetch branch (city-test.cc row 4)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes("3b30a72c"),
            expected: OpCodes.Hex8ToBytes("11df592596f41d88")
          },
          {
            text: "CityHash64 - 8 bytes, 64-bit fetch branch (city-test.cc row 8)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes("1f412460c1cdf8a0"),
            expected: OpCodes.Hex8ToBytes("a0f10149a0e538d6")
          },
          {
            text: "CityHash64 - 16 bytes, upper bound of HashLen0to16 (city-test.cc row 16)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes("08fe8b0699b1481fcdd211877e37ae7a"),
            expected: OpCodes.Hex8ToBytes("03ead5f21d344056")
          },
          {
            text: "CityHash64 - 17 bytes, first length using HashLen17to32 (city-test.cc row 17)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes("4fcbab25b38771771b3737436f4de89322"),
            expected: OpCodes.Hex8ToBytes("6abbfde37ee03b5b")
          },
          {
            text: "CityHash64 - 32 bytes, upper bound of HashLen17to32 (city-test.cc row 32)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes("687cb7cc8039f4f635371953a976f2fd44a295e949c026bc1b2bfc4fe987f3ca"),
            expected: OpCodes.Hex8ToBytes("0782fa1b08b475e7")
          },
          {
            text: "CityHash64 - 33 bytes, first length using HashLen33to64 (city-test.cc row 33)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes("1a8d3c9b2722df26ed606175cb22f3c12d161a28216d540848b58c817ebd3a6cdd"),
            expected: OpCodes.Hex8ToBytes("c5dc19b876d37a80")
          },
          {
            text: "CityHash64 - 64 bytes, upper bound of HashLen33to64 (city-test.cc row 64)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes(
              "3e04258f937d4e2ab1380ca11c95fa0f16d0a650807eef9ccd32db4680dbe246" +
              "aeb73ff35f483a5fddf78b44d3f695af314b9f7e9a8a8fa8ad9ccd596420fa33"),
            expected: OpCodes.Hex8ToBytes("e88419922b87176f")
          },
          {
            text: "CityHash64 - 65 bytes, first length using the 64-byte chunk loop (city-test.cc row 65)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes(
              "5ad402a5a42187df5c0c6c4db1a8663cdc2c55b7dbf8c410c109bec2f0847b64" +
              "95fc6a14cc9be158d204aeefc4cf97fb8b2d3b9e0f30319a9adba14575370065" +
              "d0"),
            expected: OpCodes.Hex8ToBytes("105191e0ec8f7f60")
          },
          {
            text: "CityHash64 - 96 bytes, exact multiple of the 64-byte chunk size (city-test.cc row 96)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes(
              "14598623ad0fc80367503fb23d694cb642523739ba5d4adbe96f1786aa7a16ff" +
              "5ecd0f89c450be61c49e3accc979e9bc2242042c4d74727d1e00be8c51acd78e" +
              "f76ed08a3c4b2174e0d520c84a7c4687c1034c4b49f4326b9c1e235b6078f38f"),
            expected: OpCodes.Hex8ToBytes("930380a3741e862a")
          },
          {
            text: "CityHash64 - 128 bytes, two full chunks (city-test.cc row 128)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes(
              "e3ea15658192c1a40203b56a1a805429d2a2e5dd7dbf4c771e0ba3f898040149" +
              "0cdf0b621499796fd023370d621a6d99ee178bc250e00d773888f32300208cf7" +
              "6af1462e4a3ea8d6bf36b2edb1505830e75c0bdc0305d7114213e1fe730be727" +
              "9941acdd9c50d130fccd92d715119e34299ff378c1e534ef899157d55f8a742b"),
            expected: OpCodes.Hex8ToBytes("b2e23e8116c2ba9f")
          },
          {
            text: "CityHash64 - 200 bytes, multi-chunk with remainder (city-test.cc row 200)",
            uri: CITY_TEST,
            input: OpCodes.Hex8ToBytes(
              "e7084a778ece35a266602c33468c9d1926860cec599b58fa95c4183e4a9126fa" +
              "b3412bcea7079d759dbf197c3cfb400a42df4df3dc95963957081e92d9c4ae25" +
              "80b3831d68c75ecbf386d73065630ed4a001be18c9495676e2d933ae0862c773" +
              "9c7fee6296587f5edf1426307733c0648d58b576e9a7fcbffae08098b492b8c9" +
              "47f101e91c2e28b5df9c0924456249fa92cfaa0bd846e95abeec2640b21fc82e" +
              "e521d1d05278a2802e3e7d585111d9f65b19e3c526a07c197450e869a9609e81" +
              "f0431a85541cae2f"),
            expected: OpCodes.Hex8ToBytes("07fc98006e25cac9")
          }
        ];

        // For test suite compatibility
        this.testVectors = this.tests;

        // CityHash constants - keeping original hex literals since they are internal constants
        this.K0 = 0xc3a5c85c97cb3127n;
        this.K1 = 0xb492b66fbe98f273n;
        this.K2 = 0x9ae16a3b2f90404fn;
        // Multiplier used by Hash128to64 (city.h), i.e. the two-argument HashLen16
        this.KMUL = 0x9ddfea08eb382d69n;
      }

      CreateInstance(isInverse = false) {
        return new CityHashInstance(this, isInverse);
      }
    }

    class CityHashInstance extends IHashFunctionInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.inputBuffer = [];
        this.hashSize = algorithm.hashSize;
        this.K0 = algorithm.K0;
        this.K1 = algorithm.K1;
        this.K2 = algorithm.K2;
        this.KMUL = algorithm.KMUL;
      }


      Result() {
        // Process using existing hash logic (even for empty input)
        const result = this.compute(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      // Core CityHash computation (64-bit version)
      compute(data) {
        // Feed only ever accumulates raw bytes, so the input is already a byte
        // array. It must not be pushed through a text conversion: CityHash is
        // defined over arbitrary octets and any 7-bit masking would corrupt
        // every byte above 0x7F.
        const bytes = Array.isArray(data) ? data : Array.from(data);
        const hash64 = this.cityHash64(bytes);

        // Serialize the 64-bit hash big-endian, matching the hex notation the
        // published city-test.cc table uses for its expected values.
        return [
          Number(OpCodes.AndN(OpCodes.ShiftRn(hash64, 56n), 0xffn)),
          Number(OpCodes.AndN(OpCodes.ShiftRn(hash64, 48n), 0xffn)),
          Number(OpCodes.AndN(OpCodes.ShiftRn(hash64, 40n), 0xffn)),
          Number(OpCodes.AndN(OpCodes.ShiftRn(hash64, 32n), 0xffn)),
          Number(OpCodes.AndN(OpCodes.ShiftRn(hash64, 24n), 0xffn)),
          Number(OpCodes.AndN(OpCodes.ShiftRn(hash64, 16n), 0xffn)),
          Number(OpCodes.AndN(OpCodes.ShiftRn(hash64, 8n), 0xffn)),
          Number(OpCodes.AndN(hash64, 0xffn))
        ];
      }

      cityHash64(bytes) {
        const length = bytes.length;

        if (length <= 32) {
          if (length <= 16) {
            return this.hashLen0to16(bytes, 0, length);
          }
          return this.hashLen17to32(bytes, 0, length);
        } else if (length <= 64) {
          return this.hashLen33to64(bytes, 0, length);
        }
        return this.hashLen65Plus(bytes);
      }

      hashLen0to16(bytes, offset, length) {
        if (length >= 8) {
          const mul = this.mask(this.K2 + BigInt(length) * 2n);
          const a = this.mask(this.fetch64(bytes, offset) + this.K2);
          const b = this.fetch64(bytes, offset + length - 8);
          const c = this.mask(this.mul(this.rotr64(b, 37n), mul) + a);
          const d = this.mul(this.mask(this.rotr64(a, 25n) + b), mul);
          return this.hashLen16(c, d, mul);
        }

        if (length >= 4) {
          const mul = this.mask(this.K2 + BigInt(length) * 2n);
          const a = BigInt(this.fetch32(bytes, offset));
          return this.hashLen16(
            this.mask(BigInt(length) + this.mask(OpCodes.ShiftLn(a, 3n))),
            BigInt(this.fetch32(bytes, offset + length - 4)),
            mul
          );
        }

        if (length > 0) {
          const a = BigInt(OpCodes.AndN(bytes[offset], 0xFF));
          const b = BigInt(OpCodes.AndN(bytes[offset + OpCodes.Shr32(length, 1)], 0xFF));
          const c = BigInt(OpCodes.AndN(bytes[offset + length - 1], 0xFF));
          // y and z are 32-bit quantities in the reference implementation
          const y = OpCodes.AndN(a + OpCodes.ShiftLn(b, 8n), 0xFFFFFFFFn);
          const z = OpCodes.AndN(BigInt(length) + OpCodes.ShiftLn(c, 2n), 0xFFFFFFFFn);
          return this.mul(this.shiftMix(OpCodes.XorN(this.mul(y, this.K2), this.mul(z, this.K0))), this.K2);
        }

        return this.K2;
      }

      hashLen17to32(bytes, offset, length) {
        const mul = this.mask(this.K2 + BigInt(length) * 2n);
        const a = this.mul(this.fetch64(bytes, offset), this.K1);
        const b = this.fetch64(bytes, offset + 8);
        const c = this.mul(this.fetch64(bytes, offset + length - 8), mul);
        const d = this.mul(this.fetch64(bytes, offset + length - 16), this.K2);

        return this.hashLen16(
          this.mask(this.rotr64(this.mask(a + b), 43n) + this.rotr64(c, 30n) + d),
          this.mask(a + this.rotr64(this.mask(b + this.K2), 18n) + c),
          mul
        );
      }

      hashLen33to64(bytes, offset, length) {
        const mul = this.mask(this.K2 + BigInt(length) * 2n);
        let a = this.mul(this.fetch64(bytes, offset), this.K2);
        const b = this.fetch64(bytes, offset + 8);
        const c = this.fetch64(bytes, offset + length - 24);
        const d = this.fetch64(bytes, offset + length - 32);
        const e = this.mul(this.fetch64(bytes, offset + 16), this.K2);
        const f = this.mul(this.fetch64(bytes, offset + 24), 9n);
        const g = this.fetch64(bytes, offset + length - 8);
        const h = this.mul(this.fetch64(bytes, offset + length - 16), mul);

        const u = this.mask(this.rotr64(this.mask(a + g), 43n) + this.mul(this.mask(this.rotr64(b, 30n) + c), 9n));
        const v = this.mask(OpCodes.XorN(this.mask(a + g), d) + f + 1n);
        const w = this.mask(this.bswap64(this.mul(this.mask(u + v), mul)) + h);
        const x = this.mask(this.rotr64(this.mask(e + f), 42n) + c);
        const y = this.mul(this.mask(this.bswap64(this.mul(this.mask(v + w), mul)) + g), mul);
        const z = this.mask(e + f + c);

        a = this.mask(this.bswap64(this.mask(this.mul(this.mask(x + z), mul) + y)) + b);
        const bb = this.mul(this.shiftMix(this.mask(this.mul(this.mask(z + a), mul) + d + h)), mul);

        return this.mask(bb + x);
      }

      hashLen65Plus(bytes) {
        let length = bytes.length;
        let offset = 0;

        // For strings over 64 bytes we hash the end first, then keep 56 bytes
        // of state (v, w, x, y, z) while looping over 64-byte chunks.
        let x = this.fetch64(bytes, length - 40);
        let y = this.mask(this.fetch64(bytes, length - 16) + this.fetch64(bytes, length - 56));
        let z = this.hashLen16Seeded(
          this.mask(this.fetch64(bytes, length - 48) + BigInt(length)),
          this.fetch64(bytes, length - 24)
        );

        let v = this.weakHashLen32WithSeeds(bytes, length - 64, BigInt(length), z);
        let w = this.weakHashLen32WithSeeds(bytes, length - 32, this.mask(y + this.K1), x);
        x = this.mask(this.mul(x, this.K1) + this.fetch64(bytes, 0));

        // Decrease length to the nearest multiple of 64 and operate on 64-byte chunks
        length = OpCodes.AndN(length - 1, ~63);
        do {
          x = this.mul(this.rotr64(this.mask(x + y + v[0] + this.fetch64(bytes, offset + 8)), 37n), this.K1);
          y = this.mul(this.rotr64(this.mask(y + v[1] + this.fetch64(bytes, offset + 48)), 42n), this.K1);
          x = OpCodes.XorN(x, w[1]);
          y = this.mask(y + v[0] + this.fetch64(bytes, offset + 40));
          z = this.mul(this.rotr64(this.mask(z + w[0]), 33n), this.K1);

          v = this.weakHashLen32WithSeeds(bytes, offset, this.mul(v[1], this.K1), this.mask(x + w[0]));
          w = this.weakHashLen32WithSeeds(bytes, offset + 32, this.mask(z + w[1]), this.mask(y + this.fetch64(bytes, offset + 16)));

          const t = z; z = x; x = t; // swap(z, x)
          offset += 64;
          length -= 64;
        } while (length !== 0);

        return this.hashLen16Seeded(
          this.mask(this.hashLen16Seeded(v[0], w[0]) + this.mul(this.shiftMix(y), this.K1) + z),
          this.mask(this.hashLen16Seeded(v[1], w[1]) + x)
        );
      }

      // Helper functions

      mask(val) {
        return OpCodes.AndN(val, 0xffffffffffffffffn);
      }

      mul(a, b) {
        return this.mask(a * b);
      }

      bswap64(val) {
        let v = this.mask(val);
        let r = 0n;
        for (let i = 0; i < 8; i++) {
          r = OpCodes.OrN(OpCodes.ShiftLn(r, 8n), OpCodes.AndN(v, 0xffn));
          v = OpCodes.ShiftRn(v, 8n);
        }
        return r;
      }

      fetch32(bytes, offset) {
        return OpCodes.Pack32LE(
          bytes[offset] || 0,
          bytes[offset + 1] || 0,
          bytes[offset + 2] || 0,
          bytes[offset + 3] || 0
        );
      }

      fetch64(bytes, offset) {
        // Note: OpCodes Pack64LE works with separate bytes, not pre-packed 32-bit values
        const low = BigInt(this.fetch32(bytes, offset));
        const high = BigInt(this.fetch32(bytes, offset + 4));
        return this.mask(low + OpCodes.ShiftLn(high, 32n));
      }

      rotr64(val, shift) {
        return OpCodes.RotR64n(this.mask(val), Number(shift));
      }

      shiftMix(val) {
        const v = this.mask(val);
        return OpCodes.XorN(v, OpCodes.ShiftRn(v, 47n));
      }

      // Murmur-inspired 128-to-64-bit mixer with an explicit multiplier
      hashLen16(u, v, mul) {
        let a = this.mul(OpCodes.XorN(u, v), mul);
        a = OpCodes.XorN(a, OpCodes.ShiftRn(a, 47n));
        let b = this.mul(OpCodes.XorN(v, a), mul);
        b = OpCodes.XorN(b, OpCodes.ShiftRn(b, 47n));
        return this.mul(b, mul);
      }

      // Hash128to64: the two-argument HashLen16, which uses its own constant
      hashLen16Seeded(u, v) {
        return this.hashLen16(u, v, this.KMUL);
      }

      weakHashLen32WithSeeds(bytes, offset, a, b) {
        return this.weakHashLen32WithSeedsWords(
          this.fetch64(bytes, offset),
          this.fetch64(bytes, offset + 8),
          this.fetch64(bytes, offset + 16),
          this.fetch64(bytes, offset + 24),
          a,
          b
        );
      }

      weakHashLen32WithSeedsWords(w, x, y, z, a, b) {
        a = this.mask(a + w);
        b = this.rotr64(this.mask(b + a + z), 21n);
        const c = a;
        a = this.mask(a + x);
        a = this.mask(a + y);
        b = this.mask(b + this.rotr64(a, 44n));
        return [this.mask(a + z), this.mask(b + c)];
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new CityHash();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CityHash, CityHashInstance };
}));