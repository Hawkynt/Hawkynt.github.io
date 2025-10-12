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
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * SIMECK - Lightweight block cipher family designed by NSA researchers
   * Published in 2015 as simplified version of SIMON cipher
   * Two variants:
   * - SIMECK-32: 32-bit blocks, 64-bit keys, 32 rounds
   * - SIMECK-64: 64-bit blocks, 128-bit keys, 44 rounds
   *
   * Uses simplified Feistel structure with efficient round function:
   * F(x) = (x & ROL(x, 5)) ^ ROL(x, 1)
   *
   * Security: EDUCATIONAL - Designed for constrained devices, not vetted for general use
   */

  // ===== SIMECK-32 (32-bit blocks, 64-bit keys) =====

  class SIMECK32Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SIMECK-32";
      this.description = "Lightweight 32-bit block cipher designed by NSA researchers as simplified SIMON variant. Uses efficient AND-rotation-XOR round function suitable for hardware implementations in constrained devices.";
      this.inventor = "Gangqiang Yang, Bo Zhu, Valentin Suder, Mark D. Aagaard, Guang Gong";
      this.year = 2015;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // SIMECK-32: 4-byte blocks, 8-byte keys
      this.SupportedKeySizes = [new KeySize(8, 8, 1)];
      this.SupportedBlockSizes = [new KeySize(4, 4, 1)];

      this.documentation = [
        new LinkItem("The Simeck Family of Lightweight Block Ciphers", "https://eprint.iacr.org/2015/612.pdf"),
        new LinkItem("Crypto++ SIMECK Implementation", "https://github.com/weidai11/cryptopp/blob/master/simeck.cpp")
      ];

      // Crypto++ test vectors from TestVectors/simeck.txt
      this.tests = [
        {
          text: "Crypto++ SIMECK-32 Test Vector #1",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt",
          key: OpCodes.Hex8ToBytes("1918111009080100"),
          input: OpCodes.Hex8ToBytes("65656877"),
          expected: OpCodes.Hex8ToBytes("770d2c76")
        },
        {
          text: "Crypto++ SIMECK-32 Test Vector #2",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt",
          key: OpCodes.Hex8ToBytes("3d6c4ae1678418be"),
          input: OpCodes.Hex8ToBytes("48230029"),
          expected: OpCodes.Hex8ToBytes("65359de9")
        },
        {
          text: "Crypto++ SIMECK-32 Test Vector #3",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt",
          key: OpCodes.Hex8ToBytes("6df116495f906952"),
          input: OpCodes.Hex8ToBytes("72ae2cd6"),
          expected: OpCodes.Hex8ToBytes("0ab073ca")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SIMECK32Instance(this, isInverse);
    }
  }

  class SIMECK32Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this.roundKeys = new Array(32); // 32 rounds for SIMECK-32
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 8) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (SIMECK-32 requires 8 bytes)`);
      }

      this._key = [...keyBytes];
      this._keySetup();
    }

    get key() { return this._key ? [...this._key] : null; }

    /**
     * SIMECK-32 key schedule from Crypto++ simeck.cpp lines 41-67
     * Generates 32 round keys using LFSR-based schedule
     */
    _keySetup() {
      if (!this._key) return;

      // Load 4 words of 16-bit (big-endian) from 8-byte key
      const t = new Array(5);
      t[3] = OpCodes.Pack16BE(this._key[0], this._key[1]);
      t[2] = OpCodes.Pack16BE(this._key[2], this._key[3]);
      t[1] = OpCodes.Pack16BE(this._key[4], this._key[5]);
      t[0] = OpCodes.Pack16BE(this._key[6], this._key[7]);

      // Key schedule constants
      let constant = 0xFFFC;
      let sequence = 0x9A42BB1F;

      // Generate 32 round keys
      for (let i = 0; i < 32; i++) {
        // Save current t[0] as round key
        this.roundKeys[i] = t[0];

        // Update constant from sequence
        constant &= 0xFFFC;
        constant |= (sequence & 1);
        sequence >>>= 1;

        // Apply round function to key state
        this._simeckRound16(constant, t, 1, 0);

        // Rotate LFSR
        t[4] = t[1];
        t[1] = t[2];
        t[2] = t[3];
        t[3] = t[4];
      }
    }

    /**
     * SIMECK round function for 16-bit words
     * From simeck.cpp lines 25-30:
     * left_new = (left & ROL(left, 5)) ^ ROL(left, 1) ^ right ^ key
     * right_new = left_old
     */
    _simeckRound16(key, state, leftIdx, rightIdx) {
      const left = state[leftIdx];
      const right = state[rightIdx];

      state[leftIdx] = ((left & OpCodes.RotL16(left, 5)) ^ OpCodes.RotL16(left, 1) ^ right ^ key) & 0xFFFF;
      state[rightIdx] = left;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = [];
      const blockSize = 4;

      // Process complete 4-byte blocks
      for (let i = 0; i + blockSize <= this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this._processBlock(block);
        output.push(...processedBlock);
      }

      this.inputBuffer = [];
      return output;
    }

    _processBlock(block) {
      const state = new Array(2);

      if (this.isInverse) {
        // Decryption: load in reverse order (right, left)
        state[0] = OpCodes.Pack16BE(block[2], block[3]);
        state[1] = OpCodes.Pack16BE(block[0], block[1]);

        // Apply rounds in reverse
        for (let i = 31; i >= 0; i--) {
          this._simeckRound16(this.roundKeys[i], state, 1, 0);
        }

        // Output in reverse order
        const bytes0 = OpCodes.Unpack16BE(state[1]);
        const bytes1 = OpCodes.Unpack16BE(state[0]);
        return [bytes0[0], bytes0[1], bytes1[0], bytes1[1]];
      } else {
        // Encryption: load normally (left, right)
        state[1] = OpCodes.Pack16BE(block[0], block[1]);
        state[0] = OpCodes.Pack16BE(block[2], block[3]);

        // Apply 32 rounds
        for (let i = 0; i < 32; i++) {
          this._simeckRound16(this.roundKeys[i], state, 1, 0);
        }

        // Output normally
        const bytes1 = OpCodes.Unpack16BE(state[1]);
        const bytes0 = OpCodes.Unpack16BE(state[0]);
        return [bytes1[0], bytes1[1], bytes0[0], bytes0[1]];
      }
    }
  }

  // ===== SIMECK-64 (64-bit blocks, 128-bit keys) =====

  class SIMECK64Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SIMECK-64";
      this.description = "Lightweight 64-bit block cipher designed by NSA researchers as simplified SIMON variant. Uses efficient AND-rotation-XOR round function suitable for hardware implementations in constrained devices.";
      this.inventor = "Gangqiang Yang, Bo Zhu, Valentin Suder, Mark D. Aagaard, Guang Gong";
      this.year = 2015;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // SIMECK-64: 8-byte blocks, 16-byte keys
      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)];

      this.documentation = [
        new LinkItem("The Simeck Family of Lightweight Block Ciphers", "https://eprint.iacr.org/2015/612.pdf"),
        new LinkItem("Crypto++ SIMECK Implementation", "https://github.com/weidai11/cryptopp/blob/master/simeck.cpp")
      ];

      // Crypto++ test vectors from TestVectors/simeck.txt
      this.tests = [
        {
          text: "Crypto++ SIMECK-64 Test Vector #1",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt",
          key: OpCodes.Hex8ToBytes("1b1a1918131211100b0a090803020100"),
          input: OpCodes.Hex8ToBytes("656b696c20646e75"),
          expected: OpCodes.Hex8ToBytes("45ce69025f7ab7ed")
        },
        {
          text: "Crypto++ SIMECK-64 Test Vector #2",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt",
          key: OpCodes.Hex8ToBytes("0938251f43bb8ba606b747de870c3e99"),
          input: OpCodes.Hex8ToBytes("f1bbe9ebe16cd6ae"),
          expected: OpCodes.Hex8ToBytes("4d11c6b9da2f7e28")
        },
        {
          text: "Crypto++ SIMECK-64 Test Vector #3",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt",
          key: OpCodes.Hex8ToBytes("323ba122444066d09e7d49dc407836fd"),
          input: OpCodes.Hex8ToBytes("1cdbae3296f5453b"),
          expected: OpCodes.Hex8ToBytes("1e6a0792f5a717c5")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SIMECK64Instance(this, isInverse);
    }
  }

  class SIMECK64Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this.roundKeys = new Array(44); // 44 rounds for SIMECK-64
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (SIMECK-64 requires 16 bytes)`);
      }

      this._key = [...keyBytes];
      this._keySetup();
    }

    get key() { return this._key ? [...this._key] : null; }

    /**
     * SIMECK-64 key schedule from Crypto++ simeck.cpp lines 100-126
     * Generates 44 round keys using LFSR-based schedule
     */
    _keySetup() {
      if (!this._key) return;

      // Load 4 words of 32-bit (big-endian) from 16-byte key
      const t = new Array(5);
      t[3] = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
      t[2] = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
      t[1] = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
      t[0] = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);

      // Key schedule constants (note: JavaScript can't handle 44-bit integers directly)
      // sequence = 0x938BCA3083F, we'll process bit by bit
      const sequenceBits = [
        1,1,1,1,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,1,
        1,1,0,1,0,0,1,0,1,0,0,1,1,1,1,0,0,1,0,0,1
      ]; // 44 bits of 0x938BCA3083F (LSB first)

      // Generate 44 round keys
      for (let i = 0; i < 44; i++) {
        // Save current t[0] as round key
        this.roundKeys[i] = t[0];

        // Build constant: 0xFFFFFFFC | sequence_bit
        const constant = (0xFFFFFFFC | sequenceBits[i]) >>> 0;

        // Apply round function to key state
        this._simeckRound32(constant, t, 1, 0);

        // Rotate LFSR
        t[4] = t[1];
        t[1] = t[2];
        t[2] = t[3];
        t[3] = t[4];
      }
    }

    /**
     * SIMECK round function for 32-bit words
     * From simeck.cpp lines 25-30:
     * left_new = (left & ROL(left, 5)) ^ ROL(left, 1) ^ right ^ key
     * right_new = left_old
     */
    _simeckRound32(key, state, leftIdx, rightIdx) {
      const left = state[leftIdx];
      const right = state[rightIdx];

      state[leftIdx] = ((left & OpCodes.RotL32(left, 5)) ^ OpCodes.RotL32(left, 1) ^ right ^ key) >>> 0;
      state[rightIdx] = left;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = [];
      const blockSize = 8;

      // Process complete 8-byte blocks
      for (let i = 0; i + blockSize <= this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this._processBlock(block);
        output.push(...processedBlock);
      }

      this.inputBuffer = [];
      return output;
    }

    _processBlock(block) {
      const state = new Array(2);

      if (this.isInverse) {
        // Decryption: load in reverse order (right, left)
        state[0] = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
        state[1] = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);

        // Apply rounds in reverse
        for (let i = 43; i >= 0; i--) {
          this._simeckRound32(this.roundKeys[i], state, 1, 0);
        }

        // Output in reverse order
        const bytes0 = OpCodes.Unpack32BE(state[1]);
        const bytes1 = OpCodes.Unpack32BE(state[0]);
        return [bytes0[0], bytes0[1], bytes0[2], bytes0[3],
                bytes1[0], bytes1[1], bytes1[2], bytes1[3]];
      } else {
        // Encryption: load normally (left, right)
        state[1] = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
        state[0] = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

        // Apply 44 rounds
        for (let i = 0; i < 44; i++) {
          this._simeckRound32(this.roundKeys[i], state, 1, 0);
        }

        // Output normally
        const bytes1 = OpCodes.Unpack32BE(state[1]);
        const bytes0 = OpCodes.Unpack32BE(state[0]);
        return [bytes1[0], bytes1[1], bytes1[2], bytes1[3],
                bytes0[0], bytes0[1], bytes0[2], bytes0[3]];
      }
    }
  }

  // ===== REGISTRATION =====

  const simeck32 = new SIMECK32Algorithm();
  const simeck64 = new SIMECK64Algorithm();

  if (!AlgorithmFramework.Find(simeck32.name)) {
    RegisterAlgorithm(simeck32);
  }

  if (!AlgorithmFramework.Find(simeck64.name)) {
    RegisterAlgorithm(simeck64);
  }

  // ===== EXPORTS =====

  return { SIMECK32Algorithm, SIMECK32Instance, SIMECK64Algorithm, SIMECK64Instance };
}));
