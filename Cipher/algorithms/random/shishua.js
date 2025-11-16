/*
 * SHISHUA Pseudo-Random Number Generator
 * Original algorithm by Thaddée Tyl (2020)
 * Reference: https://github.com/espadrine/shishua
 *
 * SHISHUA is designed to be the fastest PRNG in the world while maintaining
 * high statistical quality. Operates on shift-shuffle-add pattern using
 * large state (16 x 64-bit values) and counter for period extension.
 *
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          RandomGenerationAlgorithm, IRandomGeneratorInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  class ShishuaAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SHISHUA";
      this.description = "SHISHUA is the fastest PRNG in the world, achieving 0.06 cycles per byte on modern x86-64 processors. Designed by Thaddée Tyl using a shift-shuffle-add pattern with large state (16 x 64-bit), it passes PractRand beyond 32 TiB while delivering exceptional speed.";
      this.inventor = "Thaddée Tyl";
      this.year = 2020;
      this.category = CategoryType.RANDOM;
      this.subCategory = "High-Performance PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FR;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(32, 32, 1)]; // 256-bit seed (4 x 64-bit values)

      // Documentation
      this.documentation = [
        new LinkItem(
          "SHISHUA Official Repository",
          "https://github.com/espadrine/shishua"
        ),
        new LinkItem(
          "Blog Post: SHISHUA - The Fastest PRNG In The World",
          "https://espadrine.github.io/blog/posts/shishua-the-fastest-prng-in-the-world.html"
        ),
        new LinkItem(
          "Reference C Implementation (Scalar)",
          "https://github.com/espadrine/shishua/blob/master/shishua.h"
        ),
        new LinkItem(
          "Official Test Vectors",
          "https://github.com/espadrine/shishua/blob/master/test-vectors.h"
        )
      ];

      this.references = [
        new LinkItem(
          "PractRand Statistical Testing Suite",
          "http://pracrand.sourceforge.net/"
        ),
        new LinkItem(
          "BigCrush Test Suite (TestU01)",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      // Test vectors from official SHISHUA repository
      // Generated using gen-test-vectors.c from reference implementation
      // https://github.com/espadrine/shishua/blob/master/test-vectors.h
      this.tests = [
        {
          text: "Seed Zero: First 128 bytes (official test vector)",
          uri: "https://github.com/espadrine/shishua/blob/master/test-vectors.h",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000000000000000000000000000" +
                                     "00000000000000000000000000000000"),
          outputSize: 128,
          // shishua_vector_unseeded from test-vectors.h
          expected: OpCodes.Hex8ToBytes(
            "955D96F90FB4AA53092D82E63A7C09E2" +
            "2CA5A4A5A75A5A39DC68B4125DE7CE2B" +
            "6B6EFEF58BD9CC4212DD744E81FD18B9" +
            "58F0625D38EFCC1B6FDB0DA336F7E5EE" +
            "6BDBE8EA5CDA40C75344D0D5BFC1D507" +
            "E02CF5120871" + "1BEA8882CFD6CCF71D06" +
            "62C75EF1985DF2C6D56D3D2E35DAD685" +
            "3AC176B74DB7E026512DCE348BA603F1"
          )
        },
        {
          text: "Seed Pi: First 128 bytes (digits of pi as seed)",
          uri: "https://github.com/espadrine/shishua/blob/master/test-vectors.h",
          input: null,
          // Digits of pi in big endian: 0x243f6a8885a308d3, 0x13198a2e03707344,
          //                              0xa409382229f31d00, 0x82efa98ec4e6c894
          seed: OpCodes.Hex8ToBytes("243F6A8885A308D313198A2E03707344" +
                                     "A409382229F31D0082EFA98EC4E6C894"),
          outputSize: 128,
          // shishua_vector_seeded from test-vectors.h
          expected: OpCodes.Hex8ToBytes(
            "FA62A926DC1FBF00F13CE868459B6F74" +
            "4BBF2B57505ED8160E4ED92A2EF6965C" +
            "01B5C9E79D84D8D95F0DB74A47F4ACC8" +
            "25CC0B2E3B90030A1D443CD827A842E0" +
            "6E8FA0C1B28E183DE3930679" + "11DC9293" +
            "0D85ACDEDBB32304D0BEFE74EFBBBF19" +
            "C1150A347845A22793B7B24D4B4F6EB6" +
            "C0DC42546A9BCD5073FAA19CB4D1D287"
          )
        },
        {
          text: "Seed Zero: 512 bytes (extended output test)",
          uri: "https://github.com/espadrine/shishua/blob/master/test-vectors.h",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000000000000000000000000000" +
                                     "00000000000000000000000000000000"),
          outputSize: 512,
          // Complete shishua_vector_unseeded from test-vectors.h
          expected: OpCodes.Hex8ToBytes(
            "955d96f90fb4aa53092d82e63a7c09e22ca5a4a5a75a5a39dc68b4125de7ce2b" +
            "6b6efef58bd9cc4212dd744e81fd18b958f0625d38efcc1b6fdb0da336f7e5ee" +
            "6bdbe8ea5cda40c75344d0d5bfc1d507e02cf51208711bea8882cfd6ccf71d06" +
            "62c75ef1985df2c6d56d3d2e35dad6853ac176b74db7e026512dce348ba603f1" +
            "0ea27a7fcb038c71e2c7057d8fef24945197a6dd608098f9f4cc275dd19751ad" +
            "0f4bf61896c9c2842e34609e2916384e719f7f056c2a70f4b8592c02d1d6f091" +
            "065dac7ec8a75e2825fd081e0dacbf1a32c22e8239606c41f1b13cd6b59e04c4" +
            "5afbfeb36700a9ef251cf572e1d74085dbcc0279491d7754962185687ae84102" +
            "b237021898335f445d673dcc82d03f7894dcc2872739e4853cb0c33ba03329f3" +
            "468b93a52b58b9429a9bd14bac3744dfee2243d30de211cf490e56b56c5540fc" +
            "80f768fa4725e75a6d3e8fe774c16a428c429279b03fad49170fb32aa829000" + "9" +
            "64f1b1cbf3492261f0e720db118f053d50e6904ac07676626143faafe0bd4e24" +
            "68f9ae751b5893814b873cdc263bfaa4cae7680bf0370c78d4d0ccaf54fd9399" +
            "ba473f88417e61a6ea72a7ee89ead24e559933cdef293a89cfca6b9d7a5e727e" +
            "34b5f7c83fad44ec25b76bd70e5306e09d0d9b44c1d5c14f9dcb8bbfaf7e0f6f" +
            "fae08c9a334a253719110db59d150900e4aaef3d1a853ac3b05403a750ec938f"
          )
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new ShishuaInstance(this);
    }
  }

  /**
 * Shishua cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ShishuaInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // SHISHUA state: 16 x 64-bit values (4 lanes of 4 values each)
      this._state = new Array(16).fill(0n);

      // Output buffer: 16 x 64-bit values
      this._output = new Array(16).fill(0n);

      // Counter: 4 x 64-bit values (1 lane)
      this._counter = new Array(4).fill(0n);

      // Phi constants: hex digits of golden ratio (Φ)
      // "Nothing up my sleeve" numbers from reference implementation
      this.PHI = [
        0x9E3779B97F4A7C15n, 0xF39CC0605CEDC834n, 0x1082276BF3A27251n, 0xF86C6A11D0C18E95n,
        0x2767F0B153D27B7Fn, 0x0347045B5BF1827Fn, 0x01886F0928403002n, 0xC1D64BA40F335E36n,
        0xF06AD7AE9717877En, 0x85839D6EFFBD7DC6n, 0x64D325D1C5371682n, 0xCADD0CCCFDFFBBE1n,
        0x626E33B8D04B4331n, 0xBBF73C790D94F79Dn, 0x471C4AB3ED3D82A5n, 0xFEC507705E4AE6E5n
      ];

      // Shuffle offsets for 32-bit lane rotation
      // Even lanes rotate by 5 (x32), odd lanes by 3 (x32)
      // Implements 96-bit and 160-bit rotations at 256-bit level
      this.SHUFFLE_OFFSETS = [
        2, 3, 0, 1, 5, 6, 7, 4,  // left side offsets
        3, 0, 1, 2, 6, 7, 4, 5   // right side offsets
      ];

      this._ready = false;
    }

    /**
     * Set seed value (256-bit = 32 bytes = 4 x 64-bit values)
     * Seeds are applied as 4 x 64-bit values in little-endian byte order
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Pad seed to 32 bytes if needed
      const paddedSeed = [...seedBytes];
      while (paddedSeed.length < 32) {
        paddedSeed.push(0);
      }

      // Convert seed bytes to 4 x 64-bit values (big-endian)
      // Each 8 bytes forms one 64-bit value, most significant byte first
      const seed64 = [];
      for (let i = 0; i < 4; ++i) {
        let value = 0n;
        for (let j = 0; j < 8; ++j) {
          const byteIndex = i * 8 + j;
          if (byteIndex < paddedSeed.length) {
            value = OpCodes.OrN(OpCodes.ShiftLn(value, 8), BigInt(paddedSeed[byteIndex]));
          } else {
            value = OpCodes.ShiftLn(value, 8);
          }
        }
        seed64.push(value);
      }

      // Initialize state with PHI constants
      for (let i = 0; i < 16; ++i) {
        this._state[i] = this.PHI[i];
      }

      // XOR seed into state
      // Pattern from reference: diffuse first two seed elements in s0, then last two
      for (let i = 0; i < 4; ++i) {
        this._state[i * 2 + 0] = OpCodes.XorN(this._state[i * 2 + 0], seed64[i]);
        this._state[i * 2 + 8] = OpCodes.XorN(this._state[i * 2 + 8], seed64[(i + 2) % 4]);
      }

      // Reset counter
      this._counter = [0n, 0n, 0n, 0n];

      // Run initialization: 13 rounds of generation without output
      const ROUNDS = 13;
      for (let round = 0; round < ROUNDS; ++round) {
        this._generateBlock();

        // Mix output back into state for initialization
        for (let j = 0; j < 4; ++j) {
          this._state[j + 0] = this._output[j + 12];
          this._state[j + 4] = this._output[j + 8];
          this._state[j + 8] = this._output[j + 4];
          this._state[j + 12] = this._output[j + 0];
        }
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate one 128-byte block (16 x 64-bit values)
     * Implements the core SHISHUA algorithm: shift-shuffle-add pattern
     */
    _generateBlock() {
      // Process two half-blocks (2 lanes each)
      for (let half = 0; half < 2; ++half) {
        const sOffset = half * 8;  // State offset (2 lanes)
        const oOffset = half * 4;  // Output offset (1 lane)

        // Apply counter to second lane of this half
        // Counter extends period to minimum 2^71 bytes
        for (let k = 0; k < 4; ++k) {
          this._state[sOffset + k + 4] = OpCodes.AndN(
            this._state[sOffset + k + 4] + this._counter[k],
            0xFFFFFFFFFFFFFFFFn
          );
        }

        // Shuffle: 32-bit lane permutation implementing bit rotation
        // Creates temporary shuffled values for mixing
        const temp = new Array(8);
        for (let k = 0; k < 8; ++k) {
          const leftIdx = this.SHUFFLE_OFFSETS[k];
          const rightIdx = this.SHUFFLE_OFFSETS[k + 8];

          // Funnel shift: combines two 64-bit values at 32-bit boundary
          temp[k] = OpCodes.OrN(
            OpCodes.ShiftRn(this._state[sOffset + leftIdx], 32),
            OpCodes.AndN(OpCodes.ShiftLn(this._state[sOffset + rightIdx], 32), 0xFFFFFFFF00000000n)
          );
        }

        // Shift-Add: main diffusion mechanism
        for (let k = 0; k < 4; ++k) {
          // Shift by odd amounts (1 and 3) to ensure full bit coverage
          const u_lo = OpCodes.ShiftRn(this._state[sOffset + k + 0], 1);
          const u_hi = OpCodes.ShiftRn(this._state[sOffset + k + 4], 3);

          // Add shifted values with shuffled temps (main diffusion)
          this._state[sOffset + k + 0] = OpCodes.AndN(u_lo + temp[k + 0], 0xFFFFFFFFFFFFFFFFn);
          this._state[sOffset + k + 4] = OpCodes.AndN(u_hi + temp[k + 4], 0xFFFFFFFFFFFFFFFFn);

          // Generate first orthogonal output piece
          this._output[oOffset + k] = OpCodes.XorN(u_lo, temp[k + 4]);
        }
      }

      // Generate second orthogonal output pieces by XORing state lanes
      for (let j = 0; j < 4; ++j) {
        this._output[j + 8] = OpCodes.XorN(this._state[j + 0], this._state[j + 12]);
        this._output[j + 12] = OpCodes.XorN(this._state[j + 8], this._state[j + 4]);
      }

      // Increment counter with odd numbers (coprime to 2^64)
      // Ensures full period coverage: 7, 5, 3, 1
      for (let j = 0; j < 4; ++j) {
        this._counter[j] = OpCodes.AndN(
          this._counter[j] + BigInt(7 - j * 2),
          0xFFFFFFFFFFFFFFFFn
        );
      }
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('SHISHUA not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const result = [];
      let bytesRemaining = length;
      let needsGeneration = false;

      while (bytesRemaining > 0) {
        // If we consumed the output buffer, generate next block
        if (needsGeneration) {
          this._generateBlock();
          needsGeneration = false;
        }

        // Extract bytes from CURRENT output buffer (little-endian)
        // This matches C implementation which outputs THEN generates next
        for (let i = 0; i < 16 && bytesRemaining > 0; ++i) {
          const value = this._output[i];

          // Extract up to 8 bytes from this 64-bit value
          const bytesToExtract = Math.min(8, bytesRemaining);
          for (let j = 0; j < bytesToExtract; ++j) {
            const shifted = OpCodes.ShiftRn(value, j * 8);
            const byte = Number(OpCodes.AndN(shifted, 0xFFn));
            result.push(byte);
            --bytesRemaining;
          }
        }

        // Mark that we need to generate next block before next output
        needsGeneration = true;
      }

      return result;
    }

    // AlgorithmFramework interface implementation
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      // For PRNG, Feed can be used to add entropy (reseed)
      // Not implemented in basic SHISHUA - would require state mixing
      // SHISHUA is deterministic for reproducibility
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 128 bytes (one block)
      const size = this._outputSize || 128;
      return this.NextBytes(size);
    }

    /**
     * Set output size for Result() method
     */
    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize || 128;
    }
  }

  // Register algorithm
  const algorithmInstance = new ShishuaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { ShishuaAlgorithm, ShishuaInstance };
}));
