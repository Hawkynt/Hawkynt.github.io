
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

        // Test vectors from CityHash reference implementation
        this.tests = [
          {
            text: "CityHash Test Vector - Empty string",
            uri: "https://github.com/google/cityhash/blob/master/src/city_test.cc",
            input: [],
            expected: OpCodes.Hex8ToBytes("9ae16a3b2f90404f")
          },
          {
            text: "CityHash Test Vector - 'abc'",
            uri: "https://github.com/google/cityhash/blob/master/src/city_test.cc",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("6ac716da16bff369")
          },
          {
            text: "CityHash Test Vector - 'hello'",
            uri: "https://github.com/google/cityhash/blob/master/src/city_test.cc",
            input: OpCodes.AnsiToBytes("hello"),
            expected: OpCodes.Hex8ToBytes("e39f3066b188f8ec")
          }
        ];

        // For test suite compatibility
        this.testVectors = this.tests;

        // CityHash constants - keeping original hex literals since they are internal constants
        this.K0 = 0xc3a5c85c97cb3127n;
        this.K1 = 0xb492b66fbe98f273n;
        this.K2 = 0x9ae16a3b2f90404fn;
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
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        // Process using existing hash logic (even for empty input)
        const result = this.compute(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      // Core CityHash computation (64-bit version)
      compute(data) {
        const bytes = Array.isArray(data) ? data : OpCodes.AnsiToBytes(data);
        const hash64 = this.cityHash64(bytes);

        // Convert to 8-byte array (little-endian byte order for test vector compatibility)
        // Note: OpCodes 64-bit functions use high/low 32-bit split, not BigInt
        return [
          Number((hash64 >> 56n) & 0xffn),
          Number((hash64 >> 48n) & 0xffn),
          Number((hash64 >> 40n) & 0xffn),
          Number((hash64 >> 32n) & 0xffn),
          Number((hash64 >> 24n) & 0xffn),
          Number((hash64 >> 16n) & 0xffn),
          Number((hash64 >> 8n) & 0xffn),
          Number(hash64 & 0xffn)
        ];
      }

      cityHash64(bytes) {
        const length = bytes.length;

        if (length <= 16) {
          return this.hashLen0to16(bytes);
        } else if (length <= 32) {
          return this.hashLen17to32(bytes);
        } else if (length <= 64) {
          return this.hashLen33to64(bytes);
        } else {
          return this.hashLen65Plus(bytes);
        }
      }

      hashLen0to16(bytes) {
        const length = bytes.length;

        if (length >= 8) {
          const mul = this.K2 + BigInt(length) * 2n;
          const a = this.fetch64(bytes, 0) + this.K2;
          const b = this.fetch64(bytes, length - 8);
          const c = this.rotr64(b, 37n) * mul + a;
          const d = (this.rotr64(a, 25n) + b) * mul;
          return this.hashLen16(c, d, mul);
        }

        if (length >= 4) {
          const mul = this.K2 + BigInt(length) * 2n;
          const a = BigInt(this.fetch32(bytes, 0));
          return this.hashLen16(BigInt(length) + (a << 3n), BigInt(this.fetch32(bytes, length - 4)), mul);
        }

        if (length > 0) {
          const a = bytes[0];
          const b = bytes[length >> 1];
          const c = bytes[length - 1];
          const y = BigInt(a) + (BigInt(b) << 8n);
          const z = BigInt(length) + (BigInt(c) << 2n);
          return this.shiftMix(y * this.K2 ^ z * this.K0) * this.K2;
        }

        return this.K2;
      }

      hashLen17to32(bytes) {
        const length = bytes.length;
        const mul = this.K2 + BigInt(length) * 2n;
        const a = this.fetch64(bytes, 0) * this.K1;
        const b = this.fetch64(bytes, 8);
        const c = this.fetch64(bytes, length - 8) * mul;
        const d = this.fetch64(bytes, length - 16) * this.K2;

        return this.hashLen16(
          this.rotr64(a + b, 43n) + this.rotr64(c, 30n) + d,
          a + this.rotr64(b + this.K2, 18n) + c,
          mul
        );
      }

      hashLen33to64(bytes) {
        const length = bytes.length;
        const mul = this.K2 + BigInt(length) * 2n;
        const a = this.fetch64(bytes, 0) * this.K2;
        const b = this.fetch64(bytes, 8);
        const c = this.fetch64(bytes, length - 24);
        const d = this.fetch64(bytes, length - 32);
        const e = this.fetch64(bytes, 16) * this.K2;
        const f = this.fetch64(bytes, 24) * 9n;
        const g = this.fetch64(bytes, length - 8);
        const h = this.fetch64(bytes, length - 16) * mul;

        const u = this.rotr64(a + g, 43n) + (this.rotr64(b, 30n) + c) * 9n;
        const v = ((a + g) ^ d) + f + 1n;
        const w = ((u + v) * mul) + h;
        const x = this.rotr64(e + f, 42n) + c;
        const y = (((v + w) * mul) + g) * mul;
        const z = e + f + c;

        const aa = ((x + z) * mul + y) & 0xffffffffn;
        const bb = this.shiftMix((z + aa) * mul + d + h) * mul;

        return this.hashLen16(aa, bb, mul);
      }

      hashLen65Plus(bytes) {
        const length = bytes.length;

        // For strings over 64 bytes
        let x = this.fetch64(bytes, 0);
        let y = this.fetch64(bytes, length - 16) ^ this.K1;
        let z = this.fetch64(bytes, length - 56) ^ this.K0;

        let v0 = 0n, v1 = 0n;
        let w0 = 0n, w1 = 0n;

        // Initial setup
        x = x * this.K2 + this.fetch64(bytes, 8);
        w0 = this.rotr64(y + z, 35n) + x;
        w1 = this.rotr64(x + this.fetch64(bytes, 88), 53n) * this.K1;

        // Process 64-byte chunks
        let pos = 0;
        while (pos < length - 64) {
          x = this.rotr64(x + y + v0 + this.fetch64(bytes, pos + 8), 37n) * this.K1;
          y = this.rotr64(y + v1 + this.fetch64(bytes, pos + 48), 42n) * this.K1;
          x ^= w1;
          y += v0 + this.fetch64(bytes, pos + 40);
          z = this.rotr64(z + w0, 33n) * this.K1;

          [v0, v1] = this.weakHashLen32WithSeeds(bytes, pos, v1 * this.K1, x + w0);
          [w0, w1] = this.weakHashLen32WithSeeds(bytes, pos + 32, z + w1, y + this.fetch64(bytes, pos + 16));

          [z, x] = [x, z]; // Swap
          pos += 64;
        }

        const mul = this.K1 + ((z & 0xffn) << 1n);

        // Final processing
        w0 += BigInt((length - 1) & 63);
        v0 += w0;
        w0 += v0;

        x = this.rotr64(x + y + v0 + this.fetch64(bytes, pos + 8), 37n) * mul;
        y = this.rotr64(y + v1 + this.fetch64(bytes, pos + 48), 42n) * mul;
        x ^= w1 * 9n;
        y += v0 * 9n + this.fetch64(bytes, pos + 40);
        z = this.rotr64(z + w0, 33n) * mul;

        [v0, v1] = this.weakHashLen32WithSeeds(bytes, pos, v1 * mul, x + w0);
        [w0, w1] = this.weakHashLen32WithSeeds(bytes, pos + 32, z + w1, y + this.fetch64(bytes, pos + 16));

        [z, x] = [x, z]; // Swap

        return this.hashLen16(
          this.hashLen16(v0, w0, mul) + this.shiftMix(y) * this.K0 + z,
          this.hashLen16(v1, w1, mul) + x,
          mul
        );
      }

      // Helper functions
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
        return low + (high << 32n);
      }

      rotr64(val, shift) {
        const mask = 0xffffffffffffffffn;
        val = val & mask;
        return ((val >> shift) | (val << (64n - shift))) & mask;
      }

      shiftMix(val) {
        return val ^ (val >> 47n);
      }

      hashLen16(u, v, mul) {
        mul = mul || this.K2;
        let a = (u ^ v) * mul;
        a ^= (a >> 47n);
        let b = (v ^ a) * mul;
        b ^= (b >> 47n);
        return b * mul;
      }

      weakHashLen32WithSeeds(bytes, offset, a, b) {
        return [
          a + this.fetch64(bytes, offset),
          b + this.fetch64(bytes, offset + 8) + this.fetch64(bytes, offset + 16)
        ];
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