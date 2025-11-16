/*
 * GIMLI-24-HASH - Lightweight Cryptographic Hash Function
 * Professional implementation following reference C implementation
 * (c)2006-2025 Hawkynt
 *
 * GIMLI-24-HASH is the hash function mode of the GIMLI-24 permutation, designed for
 * lightweight cryptography applications. It uses a sponge construction with 256-bit output.
 * Reference: Southern Storm Software lightweight-crypto/src/combined/gimli24.c
 * Specification: https://gimli.cr.yp.to/
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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem } = AlgorithmFramework;

  const GIMLI24_BLOCK_SIZE = 16;  // 16 bytes rate for sponge
  const GIMLI24_HASH_SIZE = 32;   // 256-bit output

  /**
   * GIMLI-24 permutation implementation
   * State: 12 x 32-bit words (48 bytes total)
   * Operates on 3 columns of 4 rows each
   */
  function gimli24_permute(state) {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;
    var x, y;
    var round;

    // Load state (little-endian)
    s0 = state[0];
    s1 = state[1];
    s2 = state[2];
    s3 = state[3];
    s4 = state[4];
    s5 = state[5];
    s6 = state[6];
    s7 = state[7];
    s8 = state[8];
    s9 = state[9];
    s10 = state[10];
    s11 = state[11];

    // 24 rounds, processed 4 at a time
    for (round = 24; round > 0; round -= 4) {
      // Round 0: SP-box, small swap, add round constant
      // Apply SP-box to each column
      // Column 0: s0, s4, s8
      x = OpCodes.RotL32(s0, 24);
      y = OpCodes.RotL32(s4, 9);
      s4 = (y ^ x ^ ((x | s8) << 1)) >>> 0;
      s0 = (s8 ^ y ^ ((x & y) << 3)) >>> 0;
      s8 = (x ^ (s8 << 1) ^ ((y & s8) << 2)) >>> 0;

      // Column 1: s1, s5, s9
      x = OpCodes.RotL32(s1, 24);
      y = OpCodes.RotL32(s5, 9);
      s5 = (y ^ x ^ ((x | s9) << 1)) >>> 0;
      s1 = (s9 ^ y ^ ((x & y) << 3)) >>> 0;
      s9 = (x ^ (s9 << 1) ^ ((y & s9) << 2)) >>> 0;

      // Column 2: s2, s6, s10
      x = OpCodes.RotL32(s2, 24);
      y = OpCodes.RotL32(s6, 9);
      s6 = (y ^ x ^ ((x | s10) << 1)) >>> 0;
      s2 = (s10 ^ y ^ ((x & y) << 3)) >>> 0;
      s10 = (x ^ (s10 << 1) ^ ((y & s10) << 2)) >>> 0;

      // Column 3: s3, s7, s11
      x = OpCodes.RotL32(s3, 24);
      y = OpCodes.RotL32(s7, 9);
      s7 = (y ^ x ^ ((x | s11) << 1)) >>> 0;
      s3 = (s11 ^ y ^ ((x & y) << 3)) >>> 0;
      s11 = (x ^ (s11 << 1) ^ ((y & s11) << 2)) >>> 0;

      // Small swap (swap s0<->s1, s2<->s3)
      x = s0;
      y = s2;
      s0 = (s1 ^ 0x9e377900 ^ round) >>> 0;
      s1 = x;
      s2 = s3;
      s3 = y;

      // Round 1: SP-box only
      // Column 0
      x = OpCodes.RotL32(s0, 24);
      y = OpCodes.RotL32(s4, 9);
      s4 = (y ^ x ^ ((x | s8) << 1)) >>> 0;
      s0 = (s8 ^ y ^ ((x & y) << 3)) >>> 0;
      s8 = (x ^ (s8 << 1) ^ ((y & s8) << 2)) >>> 0;

      // Column 1
      x = OpCodes.RotL32(s1, 24);
      y = OpCodes.RotL32(s5, 9);
      s5 = (y ^ x ^ ((x | s9) << 1)) >>> 0;
      s1 = (s9 ^ y ^ ((x & y) << 3)) >>> 0;
      s9 = (x ^ (s9 << 1) ^ ((y & s9) << 2)) >>> 0;

      // Column 2
      x = OpCodes.RotL32(s2, 24);
      y = OpCodes.RotL32(s6, 9);
      s6 = (y ^ x ^ ((x | s10) << 1)) >>> 0;
      s2 = (s10 ^ y ^ ((x & y) << 3)) >>> 0;
      s10 = (x ^ (s10 << 1) ^ ((y & s10) << 2)) >>> 0;

      // Column 3
      x = OpCodes.RotL32(s3, 24);
      y = OpCodes.RotL32(s7, 9);
      s7 = (y ^ x ^ ((x | s11) << 1)) >>> 0;
      s3 = (s11 ^ y ^ ((x & y) << 3)) >>> 0;
      s11 = (x ^ (s11 << 1) ^ ((y & s11) << 2)) >>> 0;

      // Round 2: SP-box, big swap
      // Column 0
      x = OpCodes.RotL32(s0, 24);
      y = OpCodes.RotL32(s4, 9);
      s4 = (y ^ x ^ ((x | s8) << 1)) >>> 0;
      s0 = (s8 ^ y ^ ((x & y) << 3)) >>> 0;
      s8 = (x ^ (s8 << 1) ^ ((y & s8) << 2)) >>> 0;

      // Column 1
      x = OpCodes.RotL32(s1, 24);
      y = OpCodes.RotL32(s5, 9);
      s5 = (y ^ x ^ ((x | s9) << 1)) >>> 0;
      s1 = (s9 ^ y ^ ((x & y) << 3)) >>> 0;
      s9 = (x ^ (s9 << 1) ^ ((y & s9) << 2)) >>> 0;

      // Column 2
      x = OpCodes.RotL32(s2, 24);
      y = OpCodes.RotL32(s6, 9);
      s6 = (y ^ x ^ ((x | s10) << 1)) >>> 0;
      s2 = (s10 ^ y ^ ((x & y) << 3)) >>> 0;
      s10 = (x ^ (s10 << 1) ^ ((y & s10) << 2)) >>> 0;

      // Column 3
      x = OpCodes.RotL32(s3, 24);
      y = OpCodes.RotL32(s7, 9);
      s7 = (y ^ x ^ ((x | s11) << 1)) >>> 0;
      s3 = (s11 ^ y ^ ((x & y) << 3)) >>> 0;
      s11 = (x ^ (s11 << 1) ^ ((y & s11) << 2)) >>> 0;

      // Big swap (swap s0<->s2, s1<->s3)
      x = s0;
      y = s1;
      s0 = s2;
      s1 = s3;
      s2 = x;
      s3 = y;

      // Round 3: SP-box only
      // Column 0
      x = OpCodes.RotL32(s0, 24);
      y = OpCodes.RotL32(s4, 9);
      s4 = (y ^ x ^ ((x | s8) << 1)) >>> 0;
      s0 = (s8 ^ y ^ ((x & y) << 3)) >>> 0;
      s8 = (x ^ (s8 << 1) ^ ((y & s8) << 2)) >>> 0;

      // Column 1
      x = OpCodes.RotL32(s1, 24);
      y = OpCodes.RotL32(s5, 9);
      s5 = (y ^ x ^ ((x | s9) << 1)) >>> 0;
      s1 = (s9 ^ y ^ ((x & y) << 3)) >>> 0;
      s9 = (x ^ (s9 << 1) ^ ((y & s9) << 2)) >>> 0;

      // Column 2
      x = OpCodes.RotL32(s2, 24);
      y = OpCodes.RotL32(s6, 9);
      s6 = (y ^ x ^ ((x | s10) << 1)) >>> 0;
      s2 = (s10 ^ y ^ ((x & y) << 3)) >>> 0;
      s10 = (x ^ (s10 << 1) ^ ((y & s10) << 2)) >>> 0;

      // Column 3
      x = OpCodes.RotL32(s3, 24);
      y = OpCodes.RotL32(s7, 9);
      s7 = (y ^ x ^ ((x | s11) << 1)) >>> 0;
      s3 = (s11 ^ y ^ ((x & y) << 3)) >>> 0;
      s11 = (x ^ (s11 << 1) ^ ((y & s11) << 2)) >>> 0;
    }

    // Store state back (little-endian)
    state[0] = s0 >>> 0;
    state[1] = s1 >>> 0;
    state[2] = s2 >>> 0;
    state[3] = s3 >>> 0;
    state[4] = s4 >>> 0;
    state[5] = s5 >>> 0;
    state[6] = s6 >>> 0;
    state[7] = s7 >>> 0;
    state[8] = s8 >>> 0;
    state[9] = s9 >>> 0;
    state[10] = s10 >>> 0;
    state[11] = s11 >>> 0;
  }

  /**
 * Gimli24Hash - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Gimli24Hash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "GIMLI-24-HASH";
      this.description = "Lightweight hash function based on the GIMLI-24 permutation using a sponge construction. Designed for simplicity and efficiency in constrained environments while providing 256-bit security.";
      this.inventor = "Daniel J. Bernstein, Stefan Kölbl, Stefan Lucks, Pedro Maat Costa Massolino, Florian Mendel, Kashif Nawaz, Tobias Schneider, Peter Schwabe, François-Xavier Standaert, Yosuke Todo, Benoît Viguier";
      this.year = 2017;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [{ minSize: 32, maxSize: 32, stepSize: 1 }];

      this.documentation = [
        new LinkItem(
          "GIMLI Official Website",
          "https://gimli.cr.yp.to/"
        ),
        new LinkItem(
          "GIMLI Specification",
          "https://gimli.cr.yp.to/gimli-20170627.pdf"
        ),
        new LinkItem(
          "NIST Lightweight Cryptography",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "Reference Implementation",
          "https://github.com/rweather/lightweight-crypto"
        )
      ];

      // Official test vectors from GIMLI-24-HASH.txt
      this.tests = [
        {
          text: "GIMLI-24-HASH: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("27AE20E95FBC2BF01E972B0015EEA431C20FC8818F25BC6DBE66232230DB352F")
        },
        {
          text: "GIMLI-24-HASH: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("FEAE3B182D3BF6FF48F63865146ABEAE85D89C13E5AA688677D0354A9E893FC4")
        },
        {
          text: "GIMLI-24-HASH: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("5FEAFD3C603B3BD7B31EE0982C5330E8348CB5B4CC9A10EDB860E1226063D047")
        },
        {
          text: "GIMLI-24-HASH: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("AC9BC82B68FE1FC51DB80C67F6751A09F432D0C7E78239C0697468F54AE3F5AA")
        },
        {
          text: "GIMLI-24-HASH: Eight bytes (Count=9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("EF1B75E245D5956B71FCD5B90DFE72BC43F95886AD18B11E1C5B0FBA44852983")
        },
        {
          text: "GIMLI-24-HASH: Sixteen bytes (Count=17)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("404C130AF1B9023A7908200919F690FFBB756D5176E056FFDE320016A37C7282")
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
      return new Gimli24HashInstance(this);
    }
  }

  /**
 * Gimli24Hash cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Gimli24HashInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // GIMLI-24 state: 12 x 32-bit words (48 bytes)
      this.state = new Array(12);
      for (var i = 0; i < 12; i++) {
        this.state[i] = 0;
      }

      // Input buffer for incomplete blocks
      this.buffer = [];
    }

    /**
     * Absorb data into the state using sponge construction
     * Rate: 16 bytes (first 16 bytes of state)
     */
    _absorb(data) {
      var offset = 0;
      var stateBytes = new Array(48);
      var i, j, temp, word;
      var self = this;

      // Convert state to bytes (little-endian)
      function stateToBytes() {
        for (j = 0; j < 12; j++) {
          word = self.state[j];
          stateBytes[j * 4 + 0] = word & 0xFF;
          stateBytes[j * 4 + 1] = (word >>> 8) & 0xFF;
          stateBytes[j * 4 + 2] = (word >>> 16) & 0xFF;
          stateBytes[j * 4 + 3] = (word >>> 24) & 0xFF;
        }
      }

      // Convert bytes to state (little-endian)
      function bytesToState() {
        for (j = 0; j < 12; j++) {
          self.state[j] = (
            stateBytes[j * 4 + 0] |
            (stateBytes[j * 4 + 1] << 8) |
            (stateBytes[j * 4 + 2] << 16) |
            (stateBytes[j * 4 + 3] << 24)
          ) >>> 0;
        }
      }

      // Process full blocks
      while (offset + GIMLI24_BLOCK_SIZE <= data.length) {
        stateToBytes();
        // XOR block into first 16 bytes of state
        for (i = 0; i < GIMLI24_BLOCK_SIZE; i++) {
          stateBytes[i] ^= data[offset + i];
        }
        bytesToState();
        gimli24_permute(self.state);
        offset += GIMLI24_BLOCK_SIZE;
      }

      // Buffer remaining bytes
      while (offset < data.length) {
        self.buffer.push(data[offset++]);
      }
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this._absorb(data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      var i, j, temp, word;
      var stateBytes = new Array(48);
      var output = new Array(GIMLI24_HASH_SIZE);
      var self = this;

      // Convert state to bytes (little-endian)
      function stateToBytes() {
        for (j = 0; j < 12; j++) {
          word = self.state[j];
          stateBytes[j * 4 + 0] = word & 0xFF;
          stateBytes[j * 4 + 1] = (word >>> 8) & 0xFF;
          stateBytes[j * 4 + 2] = (word >>> 16) & 0xFF;
          stateBytes[j * 4 + 3] = (word >>> 24) & 0xFF;
        }
      }

      // Convert bytes to state (little-endian)
      function bytesToState() {
        for (j = 0; j < 12; j++) {
          self.state[j] = (
            stateBytes[j * 4 + 0] |
            (stateBytes[j * 4 + 1] << 8) |
            (stateBytes[j * 4 + 2] << 16) |
            (stateBytes[j * 4 + 3] << 24)
          ) >>> 0;
        }
      }

      // Process remaining buffered data with padding
      if (self.buffer.length > 0) {
        stateToBytes();
        // XOR buffered data
        for (i = 0; i < self.buffer.length; i++) {
          stateBytes[i] ^= self.buffer[i];
        }
        bytesToState();
      }

      // Apply padding: byte at position of last data XOR 0x01, byte 47 XOR 0x01
      stateToBytes();
      temp = self.buffer.length;
      stateBytes[temp] ^= 0x01;
      stateBytes[47] ^= 0x01;
      bytesToState();

      // Final permutation
      gimli24_permute(self.state);

      // Extract first half of output (16 bytes)
      stateToBytes();
      for (i = 0; i < GIMLI24_HASH_SIZE / 2; i++) {
        output[i] = stateBytes[i];
      }

      // Permute again
      gimli24_permute(self.state);

      // Extract second half of output (16 bytes)
      stateToBytes();
      for (i = 0; i < GIMLI24_HASH_SIZE / 2; i++) {
        output[GIMLI24_HASH_SIZE / 2 + i] = stateBytes[i];
      }

      // Clear sensitive data
      OpCodes.ClearArray(self.state);
      OpCodes.ClearArray(self.buffer);

      return output;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Gimli24Hash());

  return Gimli24Hash;
}));
