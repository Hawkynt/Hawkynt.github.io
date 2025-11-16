
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

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * ECHO - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class ECHO extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ECHO";
      this.description = "ECHO is a cryptographic hash function submitted to the NIST SHA-3 competition. It uses AES-like round functions with a wide-pipe construction operating on a large internal state.";
      this.inventor = "Ryad Benadjila, Olivier Billet, Henri Gilbert, Gilles Macario-Rat, Thomas Peyrin, Matt Robshaw, Yannick Seurin";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FR;

      // Hash-specific properties
      this.SupportedOutputSizes = [
        new KeySize(28, 28, 1),  // 224 bits
        new KeySize(32, 32, 1),  // 256 bits
        new KeySize(48, 48, 1),  // 384 bits
        new KeySize(64, 64, 1)   // 512 bits
      ];

      // Documentation
      this.documentation = [
        new LinkItem("ECHO Specification v2.0", "https://crypto.orange-labs.fr/ECHO/"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("sphlib Reference Implementation", "https://github.com/pornin/sphlib")
      ];

      this.references = [
        new LinkItem("ECHO: A Low-Latency AEAD Mode", "https://eprint.iacr.org/2010/003")
      ];

      // Test vectors from sphlib NIST test suite
      this.tests = [
        // ECHO-256 test vectors
        {
          text: "NIST vector #0 (0 bits) - ECHO-256",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [],
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("3f4d42c8276522f6e60547e852c39c888d2b6f0c8747a0950ec57c9b5e0545f0")
        },

        // ECHO-224 test vectors
        {
          text: "NIST vector #0 (0 bits) - ECHO-224",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [],
          outputSize: 28,
          expected: OpCodes.Hex8ToBytes("17da087595166f733fff7cdb0bca6438f303d0e00c48b5e7a3075905")
        },

        // ECHO-384 test vectors
        {
          text: "NIST vector #0 (0 bits) - ECHO-384",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [],
          outputSize: 48,
          expected: OpCodes.Hex8ToBytes("1bb3f6be58666de69f54ab7c23b7bb88da9e5e78e0e2f5cc0ca6c880ca91a665f3bef9bf677b8f7fb9e1fb7b62cf8b25")
        },

        // ECHO-512 test vectors
        {
          text: "NIST vector #0 (0 bits) - ECHO-512",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_echo.c",
          input: [],
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("89d42c9d857bdaed6818c1925c635d1bf1a5a05c8eeba6d012cdeed6698c2e0fd4f5e6b03e93f71f3d5f891c8c7ff3b64b95727e07cdd3fbe0ba388f39239c95")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new ECHOInstance(this);
    }
  }

  /**
 * ECHO cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ECHOInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.inputBuffer = [];
      this._outputSize = 32; // Default to 256-bit output
    }

    set outputSize(size) {
      if (!size) return;

      // Validate output size
      const validSizes = [28, 32, 48, 64];
      if (!validSizes.includes(size)) {
        throw new Error(`Invalid output size: ${size} bytes (valid: 28, 32, 48, 64)`);
      }

      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const hasher = new ECHOHasher(this._outputSize * 8);
      hasher.update(this.inputBuffer);
      const result = hasher.finalize();

      this.inputBuffer = [];
      return Array.from(result);
    }
  }

  // ===== ECHO HASHER CORE IMPLEMENTATION =====

  class ECHOHasher {
    constructor(outputBits) {
      this.outputBits = outputBits;

      // Determine state size
      // Small: 224/256-bit output uses 64-byte (512-bit) state
      // Big: 384/512-bit output uses 128-byte (1024-bit) state
      this.isSmall = (outputBits <= 256);
      this.stateSize = this.isSmall ? 64 : 128; // bytes
      this.blockSize = this.isSmall ? 192 : 128; // bytes (input block)
      this.rounds = this.isSmall ? 8 : 10;

      // State: 4x4 matrix of 32-bit words (16 cells of 4 words each for small, 8 words for big)
      // Small: W[16][4] = 256 bytes total
      // Big: W[16][4] = 256 bytes total (but we use first 64 or 128 for chaining value)
      this.state = new Array(this.stateSize).fill(0);

      // Counter (128-bit)
      this.counter = [0, 0, 0, 0]; // 4x 32-bit words

      this.buffer = [];
      this.totalBytes = 0;

      this.initializeState();
    }

    initializeState() {
      // Initialize state with output length
      this.state.fill(0);

      // Set hash output size in the last bytes (big-endian)
      this.state[this.stateSize - 2] = (this.outputBits >>> 8) & 0xFF;
      this.state[this.stateSize - 1] = this.outputBits & 0xFF;
    }

    update(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        data = Array.from(data);
      }

      this.buffer.push(...data);
      this.totalBytes += data.length;

      // Process complete blocks
      while (this.buffer.length >= this.blockSize) {
        const block = this.buffer.splice(0, this.blockSize);
        this.compress(block);
      }
    }

    finalize() {
      // Pad with 0x80 followed by zeros
      this.buffer.push(0x80);

      // Pad to block size minus 18 bytes (16 for length, 2 for output size)
      const paddingTarget = this.blockSize - 18;
      while (this.buffer.length < paddingTarget) {
        this.buffer.push(0x00);
      }

      // Append message length in bits (128-bit big-endian)
      const totalBits = this.totalBytes * 8;
      // High 64 bits (always zero for our purposes)
      for (let i = 0; i < 8; ++i) {
        this.buffer.push(0x00);
      }
      // Low 64 bits (big-endian)
      for (let i = 7; i >= 0; --i) {
        this.buffer.push((totalBits >>> (i * 8)) & 0xFF);
      }

      // Append output size (16-bit big-endian)
      this.buffer.push((this.outputBits >>> 8) & 0xFF);
      this.buffer.push(this.outputBits & 0xFF);

      // Process final block
      if (this.buffer.length === this.blockSize) {
        this.compress(this.buffer);
      }

      // Extract output from final state (last bytes)
      const outputBytes = this.outputBits / 8;
      return this.state.slice(this.stateSize - outputBytes);
    }

    compress(block) {
      // ECHO compression: W = state matrix (4x4 of 128-bit cells)
      // Each cell contains 4x 32-bit words (16 bytes)
      const W = new Array(16);
      for (let i = 0; i < 16; ++i) {
        W[i] = new Array(4);
      }

      // Copy chaining value to first part of W
      if (this.isSmall) {
        // Small: first 4 cells (64 bytes) from state
        for (let i = 0; i < 4; ++i) {
          for (let j = 0; j < 4; ++j) {
            const idx = i * 16 + j * 4;
            W[i][j] = OpCodes.Pack32LE(
              this.state[idx], this.state[idx + 1],
              this.state[idx + 2], this.state[idx + 3]
            );
          }
        }
        // Load 192-byte message block into remaining 12 cells
        for (let i = 0; i < 12; ++i) {
          for (let j = 0; j < 4; ++j) {
            const idx = i * 16 + j * 4;
            W[i + 4][j] = OpCodes.Pack32LE(
              block[idx], block[idx + 1],
              block[idx + 2], block[idx + 3]
            );
          }
        }
      } else {
        // Big: first 8 cells (128 bytes) from state
        for (let i = 0; i < 8; ++i) {
          for (let j = 0; j < 4; ++j) {
            const idx = i * 16 + j * 4;
            W[i][j] = OpCodes.Pack32LE(
              this.state[idx], this.state[idx + 1],
              this.state[idx + 2], this.state[idx + 3]
            );
          }
        }
        // Load 128-byte message block into remaining 8 cells
        for (let i = 0; i < 8; ++i) {
          for (let j = 0; j < 4; ++j) {
            const idx = i * 16 + j * 4;
            W[i + 8][j] = OpCodes.Pack32LE(
              block[idx], block[idx + 1],
              block[idx + 2], block[idx + 3]
            );
          }
        }
      }

      // Initialize round key counter
      const K = this.counter.slice();

      // Apply rounds
      for (let round = 0; round < this.rounds; ++round) {
        // SubBytes: Two AES rounds per ECHO round
        this.bigSubWords(W, K);

        // ShiftRows
        this.bigShiftRows(W);

        // MixColumns
        this.bigMixColumns(W);
      }

      // Finalization: XOR result with input block and chaining value
      if (this.isSmall) {
        // XOR first 4 cells with block bytes 0-63 and 64-127
        for (let i = 0; i < 4; ++i) {
          for (let j = 0; j < 4; ++j) {
            const idx = i * 4 + j;
            const b1 = OpCodes.Pack32LE(
              block[idx * 4], block[idx * 4 + 1],
              block[idx * 4 + 2], block[idx * 4 + 3]
            );
            const b2 = OpCodes.Pack32LE(
              block[64 + idx * 4], block[64 + idx * 4 + 1],
              block[64 + idx * 4 + 2], block[64 + idx * 4 + 3]
            );
            const b3 = OpCodes.Pack32LE(
              block[128 + idx * 4], block[128 + idx * 4 + 1],
              block[128 + idx * 4 + 2], block[128 + idx * 4 + 3]
            );
            W[i][j] ^= b1 ^ b2 ^ b3;
          }
        }
      } else {
        // XOR first 8 cells with block bytes
        for (let i = 0; i < 8; ++i) {
          for (let j = 0; j < 4; ++j) {
            const idx = i * 4 + j;
            const b = OpCodes.Pack32LE(
              block[idx * 4], block[idx * 4 + 1],
              block[idx * 4 + 2], block[idx * 4 + 3]
            );
            W[i][j] ^= b;
          }
        }
      }

      // Update state from final W
      const stateCells = this.isSmall ? 4 : 8;
      for (let i = 0; i < stateCells; ++i) {
        for (let j = 0; j < 4; ++j) {
          const bytes = OpCodes.Unpack32LE(W[i][j]);
          const idx = i * 16 + j * 4;
          this.state[idx] = bytes[0];
          this.state[idx + 1] = bytes[1];
          this.state[idx + 2] = bytes[2];
          this.state[idx + 3] = bytes[3];
        }
      }

      // Increment counter
      this.incrCounter(this.blockSize * 8);
    }

    bigSubWords(W, K) {
      // Apply two AES rounds to each cell
      for (let i = 0; i < 16; ++i) {
        // First AES round with key
        const X = W[i];
        const Y = new Array(4);

        this.aesRound(X, K, Y);

        // Second AES round without key
        this.aesRoundNoKey(Y, X);

        // Increment counter
        K[0] = (K[0] + 1) >>> 0;
        if (K[0] === 0) {
          K[1] = (K[1] + 1) >>> 0;
          if (K[1] === 0) {
            K[2] = (K[2] + 1) >>> 0;
            if (K[2] === 0) {
              K[3] = (K[3] + 1) >>> 0;
            }
          }
        }
      }
    }

    aesRound(input, key, output) {
      // AES round: SubBytes + ShiftRows + MixColumns + AddRoundKey
      const T0 = AES_T0;
      const T1 = AES_T1;
      const T2 = AES_T2;
      const T3 = AES_T3;

      output[0] = (T0[(input[0] >>> 0) & 0xFF] ^
                   T1[(input[1] >>> 8) & 0xFF] ^
                   T2[(input[2] >>> 16) & 0xFF] ^
                   T3[(input[3] >>> 24) & 0xFF] ^
                   key[0]) >>> 0;

      output[1] = (T0[(input[1] >>> 0) & 0xFF] ^
                   T1[(input[2] >>> 8) & 0xFF] ^
                   T2[(input[3] >>> 16) & 0xFF] ^
                   T3[(input[0] >>> 24) & 0xFF] ^
                   key[1]) >>> 0;

      output[2] = (T0[(input[2] >>> 0) & 0xFF] ^
                   T1[(input[3] >>> 8) & 0xFF] ^
                   T2[(input[0] >>> 16) & 0xFF] ^
                   T3[(input[1] >>> 24) & 0xFF] ^
                   key[2]) >>> 0;

      output[3] = (T0[(input[3] >>> 0) & 0xFF] ^
                   T1[(input[0] >>> 8) & 0xFF] ^
                   T2[(input[1] >>> 16) & 0xFF] ^
                   T3[(input[2] >>> 24) & 0xFF] ^
                   key[3]) >>> 0;
    }

    aesRoundNoKey(input, output) {
      // AES round without AddRoundKey
      const T0 = AES_T0;
      const T1 = AES_T1;
      const T2 = AES_T2;
      const T3 = AES_T3;

      output[0] = (T0[(input[0] >>> 0) & 0xFF] ^
                   T1[(input[1] >>> 8) & 0xFF] ^
                   T2[(input[2] >>> 16) & 0xFF] ^
                   T3[(input[3] >>> 24) & 0xFF]) >>> 0;

      output[1] = (T0[(input[1] >>> 0) & 0xFF] ^
                   T1[(input[2] >>> 8) & 0xFF] ^
                   T2[(input[3] >>> 16) & 0xFF] ^
                   T3[(input[0] >>> 24) & 0xFF]) >>> 0;

      output[2] = (T0[(input[2] >>> 0) & 0xFF] ^
                   T1[(input[3] >>> 8) & 0xFF] ^
                   T2[(input[0] >>> 16) & 0xFF] ^
                   T3[(input[1] >>> 24) & 0xFF]) >>> 0;

      output[3] = (T0[(input[3] >>> 0) & 0xFF] ^
                   T1[(input[0] >>> 8) & 0xFF] ^
                   T2[(input[1] >>> 16) & 0xFF] ^
                   T3[(input[2] >>> 24) & 0xFF]) >>> 0;
    }

    bigShiftRows(W) {
      // ECHO ShiftRows operates on the 4x4 matrix of cells
      // Row 0: no shift
      // Row 1: shift left by 1
      this.shiftRow(W, 1, 4, 8, 12);
      // Row 2: shift left by 2
      this.shiftRow(W, 2, 6, 10, 14);
      this.shiftRow(W, 2, 6, 10, 14); // Shift twice
      // Row 3: shift left by 3
      this.shiftRow(W, 3, 7, 11, 15);
      this.shiftRow(W, 3, 7, 11, 15);
      this.shiftRow(W, 3, 7, 11, 15);
    }

    shiftRow(W, a, b, c, d) {
      // Rotate cells in a row
      for (let n = 0; n < 4; ++n) {
        const tmp = W[a][n];
        W[a][n] = W[b][n];
        W[b][n] = W[c][n];
        W[c][n] = W[d][n];
        W[d][n] = tmp;
      }
    }

    bigMixColumns(W) {
      // Apply MixColumns to each column of the 4x4 cell matrix
      this.mixColumn(W, 0, 1, 2, 3);
      this.mixColumn(W, 4, 5, 6, 7);
      this.mixColumn(W, 8, 9, 10, 11);
      this.mixColumn(W, 12, 13, 14, 15);
    }

    mixColumn(W, ia, ib, ic, id) {
      // MixColumns on 4 cells (each cell has 4 words)
      // Uses GF(256) multiplication similar to AES
      for (let n = 0; n < 4; ++n) {
        const a = W[ia][n];
        const b = W[ib][n];
        const c = W[ic][n];
        const d = W[id][n];

        // Compute xor combinations
        const ab = a ^ b;
        const bc = b ^ c;
        const cd = c ^ d;

        // Multiply by x in GF(256) using bytewise operations
        const abx = this.gfMulX(ab);
        const bcx = this.gfMulX(bc);
        const cdx = this.gfMulX(cd);

        // Apply MDS matrix multiplication
        W[ia][n] = (abx ^ bc ^ d) >>> 0;
        W[ib][n] = (bcx ^ a ^ cd) >>> 0;
        W[ic][n] = (cdx ^ ab ^ d) >>> 0;
        W[id][n] = (abx ^ bcx ^ cdx ^ ab ^ c) >>> 0;
      }
    }

    gfMulX(x) {
      // Multiply by x in GF(256) bytewise (each byte separately)
      // Formula: ((x & 0x80808080) >> 7) * 27 ^ ((x & 0x7F7F7F7F) << 1)
      const high = (x & 0x80808080) >>> 7;
      const low = (x & 0x7F7F7F7F) << 1;

      // Multiply high bits by 27 (0x1B) for each byte that had bit 7 set
      const mult = (high * 27) & 0xFFFFFFFF;

      return (mult ^ low) >>> 0;
    }

    incrCounter(bits) {
      // Increment 128-bit counter by bit count
      this.counter[0] = (this.counter[0] + bits) >>> 0;
      if (this.counter[0] < bits) {
        this.counter[1] = (this.counter[1] + 1) >>> 0;
        if (this.counter[1] === 0) {
          this.counter[2] = (this.counter[2] + 1) >>> 0;
          if (this.counter[2] === 0) {
            this.counter[3] = (this.counter[3] + 1) >>> 0;
          }
        }
      }
    }
  }

  // AES T-tables for fast AES round implementation
  const AES_T0 = new Uint32Array([
    0xc66363a5, 0xf87c7c84, 0xee777799, 0xf67b7b8d, 0xfff2f20d, 0xd66b6bbd, 0xde6f6fb1, 0x91c5c554,
    0x60303050, 0x02010103, 0xce6767a9, 0x562b2b7d, 0xe7fefe19, 0xb5d7d762, 0x4dababe6, 0xec76769a,
    0x8fcaca45, 0x1f82829d, 0x89c9c940, 0xfa7d7d87, 0xeffafa15, 0xb25959eb, 0x8e4747c9, 0xfbf0f00b,
    0x41adadec, 0xb3d4d467, 0x5fa2a2fd, 0x45afafea, 0x239c9cbf, 0x53a4a4f7, 0xe4727296, 0x9bc0c05b,
    0x75b7b7c2, 0xe1fdfd1c, 0x3d9393ae, 0x4c26266a, 0x6c36365a, 0x7e3f3f41, 0xf5f7f702, 0x83cccc4f,
    0x6834345c, 0x51a5a5f4, 0xd1e5e534, 0xf9f1f108, 0xe2717193, 0xabd8d873, 0x62313153, 0x2a15153f,
    0x0804040c, 0x95c7c752, 0x46232365, 0x9dc3c35e, 0x30181828, 0x379696a1, 0x0a05050f, 0x2f9a9ab5,
    0x0e070709, 0x24121236, 0x1b80809b, 0xdfe2e23d, 0xcdebeb26, 0x4e272769, 0x7fb2b2cd, 0xea75759f,
    0x1209091b, 0x1d83839e, 0x582c2c74, 0x341a1a2e, 0x361b1b2d, 0xdc6e6eb2, 0xb45a5aee, 0x5ba0a0fb,
    0xa45252f6, 0x763b3b4d, 0xb7d6d661, 0x7db3b3ce, 0x5229297b, 0xdde3e33e, 0x5e2f2f71, 0x13848497,
    0xa65353f5, 0xb9d1d168, 0x00000000, 0xc1eded2c, 0x40202060, 0xe3fcfc1f, 0x79b1b1c8, 0xb65b5bed,
    0xd46a6abe, 0x8dcbcb46, 0x67bebed9, 0x7239394b, 0x944a4ade, 0x984c4cd4, 0xb05858e8, 0x85cfcf4a,
    0xbbd0d06b, 0xc5efef2a, 0x4faaaae5, 0xedfbfb16, 0x864343c5, 0x9a4d4dd7, 0x66333355, 0x11858594,
    0x8a4545cf, 0xe9f9f910, 0x04020206, 0xfe7f7f81, 0xa05050f0, 0x783c3c44, 0x259f9fba, 0x4ba8a8e3,
    0xa25151f3, 0x5da3a3fe, 0x804040c0, 0x058f8f8a, 0x3f9292ad, 0x219d9dbc, 0x70383848, 0xf1f5f504,
    0x63bcbcdf, 0x77b6b6c1, 0xafdada75, 0x42212163, 0x20101030, 0xe5ffff1a, 0xfdf3f30e, 0xbfd2d26d,
    0x81cdcd4c, 0x180c0c14, 0x26131335, 0xc3ecec2f, 0xbe5f5fe1, 0x359797a2, 0x884444cc, 0x2e171739,
    0x93c4c457, 0x55a7a7f2, 0xfc7e7e82, 0x7a3d3d47, 0xc86464ac, 0xba5d5de7, 0x3219192b, 0xe6737395,
    0xc06060a0, 0x19818198, 0x9e4f4fd1, 0xa3dcdc7f, 0x44222266, 0x542a2a7e, 0x3b9090ab, 0x0b888883,
    0x8c4646ca, 0xc7eeee29, 0x6bb8b8d3, 0x2814143c, 0xa7dede79, 0xbc5e5ee2, 0x160b0b1d, 0xaddbdb76,
    0xdbe0e03b, 0x64323256, 0x743a3a4e, 0x140a0a1e, 0x924949db, 0x0c06060a, 0x4824246c, 0xb85c5ce4,
    0x9fc2c25d, 0xbdd3d36e, 0x43acacef, 0xc46262a6, 0x399191a8, 0x319595a4, 0xd3e4e437, 0xf279798b,
    0xd5e7e732, 0x8bc8c843, 0x6e373759, 0xda6d6db7, 0x018d8d8c, 0xb1d5d564, 0x9c4e4ed2, 0x49a9a9e0,
    0xd86c6cb4, 0xac5656fa, 0xf3f4f407, 0xcfeaea25, 0xca6565af, 0xf47a7a8e, 0x47aeaee9, 0x10080818,
    0x6fbabad5, 0xf0787888, 0x4a25256f, 0x5c2e2e72, 0x381c1c24, 0x57a6a6f1, 0x73b4b4c7, 0x97c6c651,
    0xcbe8e823, 0xa1dddd7c, 0xe874749c, 0x3e1f1f21, 0x964b4bdd, 0x61bdbddc, 0x0d8b8b86, 0x0f8a8a85,
    0xe0707090, 0x7c3e3e42, 0x71b5b5c4, 0xcc6666aa, 0x904848d8, 0x06030305, 0xf7f6f601, 0x1c0e0e12,
    0xc26161a3, 0x6a35355f, 0xae5757f9, 0x69b9b9d0, 0x17868691, 0x99c1c158, 0x3a1d1d27, 0x279e9eb9,
    0xd9e1e138, 0xebf8f813, 0x2b9898b3, 0x22111133, 0xd26969bb, 0xa9d9d970, 0x078e8e89, 0x339494a7,
    0x2d9b9bb6, 0x3c1e1e22, 0x15878792, 0xc9e9e920, 0x87cece49, 0xaa5555ff, 0x50282878, 0xa5dfdf7a,
    0x038c8c8f, 0x59a1a1f8, 0x09898980, 0x1a0d0d17, 0x65bfbfda, 0xd7e6e631, 0x844242c6, 0xd06868b8,
    0x824141c3, 0x299999b0, 0x5a2d2d77, 0x1e0f0f11, 0x7bb0b0cb, 0xa85454fc, 0x6dbbbbd6, 0x2c16163a
  ]);

  const AES_T1 = new Uint32Array(256);
  const AES_T2 = new Uint32Array(256);
  const AES_T3 = new Uint32Array(256);

  // Generate T1, T2, T3 from T0 by rotation
  for (let i = 0; i < 256; ++i) {
    AES_T1[i] = OpCodes.RotL32(AES_T0[i], 8);
    AES_T2[i] = OpCodes.RotL32(AES_T0[i], 16);
    AES_T3[i] = OpCodes.RotL32(AES_T0[i], 24);
  }

  // Register algorithm
  RegisterAlgorithm(new ECHO());

  return ECHO;
}));
