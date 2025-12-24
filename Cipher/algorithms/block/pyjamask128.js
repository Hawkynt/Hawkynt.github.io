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
    // Browser/Worker global - assign exports to global scope
    const exports = factory(root.AlgorithmFramework, root.OpCodes);
    if (exports) Object.assign(root, exports);
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
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  /**
 * Pyjamask128Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class Pyjamask128Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Pyjamask-128";
      this.description = "Lightweight block cipher designed for efficient masked implementations. Features a 128-bit block size with 128-bit keys using 14 rounds. Part of NIST Lightweight Cryptography competition (Round 2).";
      this.inventor = "Dahmun Goudarzi, Jérémy Jean, Stefan Kölbl, Thomas Peyrin, Matthieu Rivain, Yu Sasaki, Siang Meng Sim";
      this.year = 2019;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.FR;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0) // 128-bit key only
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Official Pyjamask Website", "https://pyjamask-cipher.github.io/"),
        new LinkItem("NIST LWC Submission", "https://csrc.nist.gov/Projects/lightweight-cryptography/round-2-candidates"),
        new LinkItem("Pyjamask Specification (PDF)", "https://pyjamask-cipher.github.io/spec.pdf")
      ];

      this.references = [
        new LinkItem("Southern Storm Software Reference Implementation", "https://github.com/rweather/lightweight-crypto"),
        new LinkItem("NIST LWC Round 2 Candidates", "https://csrc.nist.gov/Projects/lightweight-cryptography/round-2-candidates"),
        new LinkItem("Cryptanalysis Resources", "https://pyjamask-cipher.github.io/")
      ];

      // Test vectors verified against reference C implementation
      // from Southern Storm Software lightweight-crypto library
      this.tests = [
        {
          text: 'Reference Implementation Test Vector #1 - All Zeros',
          uri: 'https://github.com/rweather/lightweight-crypto',
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("dfe3692b4ca367d162890cb0f090311a")
        },
        {
          text: 'Reference Implementation Test Vector #2 - Sequential Pattern',
          uri: 'https://github.com/rweather/lightweight-crypto',
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("efdeb7e095a2446a7400a3d75dce8f5a")
        },
        {
          text: 'Reference Implementation Test Vector #3 - All Ones Key',
          uri: 'https://github.com/rweather/lightweight-crypto',
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("40f2a03d22860aa6e372f8bcf822ee0d")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Pyjamask128Instance(this, isInverse);
    }
  }

  /**
 * Pyjamask128 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Pyjamask128Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
    }

    // Pyjamask-128 constants
    static ROUNDS = 14;

    // Matrix multiplication functions for encryption
    static matrixMultiply_b881b9ca(y) {
      const result = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(y, OpCodes.RotR32(y, 2)), OpCodes.RotR32(y, 3)), OpCodes.RotR32(y, 4)), OpCodes.RotR32(y, 8)), OpCodes.RotR32(y, 15)), OpCodes.RotR32(y, 16)), OpCodes.RotR32(y, 18)), OpCodes.RotR32(y, 19)), OpCodes.RotR32(y, 20)), OpCodes.RotR32(y, 23)), OpCodes.RotR32(y, 24)), OpCodes.RotR32(y, 25)), OpCodes.RotR32(y, 28)), OpCodes.RotR32(y, 30));
      return OpCodes.ToUint32(result);
    }

    static matrixMultiply_a3861085(y) {
      const result = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(y, OpCodes.RotR32(y, 2)), OpCodes.RotR32(y, 6)), OpCodes.RotR32(y, 7)), OpCodes.RotR32(y, 8)), OpCodes.RotR32(y, 13)), OpCodes.RotR32(y, 14)), OpCodes.RotR32(y, 19)), OpCodes.RotR32(y, 24)), OpCodes.RotR32(y, 29)), OpCodes.RotR32(y, 31));
      return OpCodes.ToUint32(result);
    }

    static matrixMultiply_63417021(y) {
      const result = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(y, 1), OpCodes.RotR32(y, 2)), OpCodes.RotR32(y, 6)), OpCodes.RotR32(y, 7)), OpCodes.RotR32(y, 9)), OpCodes.RotR32(y, 15)), OpCodes.RotR32(y, 17)), OpCodes.RotR32(y, 18)), OpCodes.RotR32(y, 19)), OpCodes.RotR32(y, 26)), OpCodes.RotR32(y, 31));
      return OpCodes.ToUint32(result);
    }

    static matrixMultiply_692cf280(y) {
      const result = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(y, 1), OpCodes.RotR32(y, 2)), OpCodes.RotR32(y, 4)), OpCodes.RotR32(y, 7)), OpCodes.RotR32(y, 10)), OpCodes.RotR32(y, 12)), OpCodes.RotR32(y, 13)), OpCodes.RotR32(y, 16)), OpCodes.RotR32(y, 17)), OpCodes.RotR32(y, 18)), OpCodes.RotR32(y, 19)), OpCodes.RotR32(y, 22)), OpCodes.RotR32(y, 24));
      return OpCodes.ToUint32(result);
    }

    static matrixMultiply_48a54813(y) {
      const result = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(y, 1), OpCodes.RotR32(y, 4)), OpCodes.RotR32(y, 8)), OpCodes.RotR32(y, 10)), OpCodes.RotR32(y, 13)), OpCodes.RotR32(y, 15)), OpCodes.RotR32(y, 17)), OpCodes.RotR32(y, 20)), OpCodes.RotR32(y, 27)), OpCodes.RotR32(y, 30)), OpCodes.RotR32(y, 31));
      return OpCodes.ToUint32(result);
    }

    // Matrix multiplication functions for decryption (inverse)
    static matrixMultiply_2037a121(y) {
      const result = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(y, 2), OpCodes.RotR32(y, 10)), OpCodes.RotR32(y, 11)), OpCodes.RotR32(y, 13)), OpCodes.RotR32(y, 14)), OpCodes.RotR32(y, 15)), OpCodes.RotR32(y, 16)), OpCodes.RotR32(y, 18)), OpCodes.RotR32(y, 23)), OpCodes.RotR32(y, 26)), OpCodes.RotR32(y, 31));
      return OpCodes.ToUint32(result);
    }

    static matrixMultiply_108ff2a0(y) {
      const result = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(y, 3), OpCodes.RotR32(y, 8)), OpCodes.RotR32(y, 12)), OpCodes.RotR32(y, 13)), OpCodes.RotR32(y, 14)), OpCodes.RotR32(y, 15)), OpCodes.RotR32(y, 16)), OpCodes.RotR32(y, 17)), OpCodes.RotR32(y, 18)), OpCodes.RotR32(y, 19)), OpCodes.RotR32(y, 22)), OpCodes.RotR32(y, 24)), OpCodes.RotR32(y, 26));
      return OpCodes.ToUint32(result);
    }

    static matrixMultiply_9054d8c0(y) {
      const result = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(y, OpCodes.RotR32(y, 3)), OpCodes.RotR32(y, 9)), OpCodes.RotR32(y, 11)), OpCodes.RotR32(y, 13)), OpCodes.RotR32(y, 16)), OpCodes.RotR32(y, 17)), OpCodes.RotR32(y, 19)), OpCodes.RotR32(y, 20)), OpCodes.RotR32(y, 24)), OpCodes.RotR32(y, 25));
      return OpCodes.ToUint32(result);
    }

    static matrixMultiply_3354b117(y) {
      const result = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(y, 2), OpCodes.RotR32(y, 3)), OpCodes.RotR32(y, 6)), OpCodes.RotR32(y, 7)), OpCodes.RotR32(y, 9)), OpCodes.RotR32(y, 11)), OpCodes.RotR32(y, 13)), OpCodes.RotR32(y, 16)), OpCodes.RotR32(y, 18)), OpCodes.RotR32(y, 19)), OpCodes.RotR32(y, 23)), OpCodes.RotR32(y, 27)), OpCodes.RotR32(y, 29)), OpCodes.RotR32(y, 30)), OpCodes.RotR32(y, 31));
      return OpCodes.ToUint32(result);
    }

    // Property setter for key - validates and sets up key schedule
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        return;
      }

      // Validate key size (must be exactly 16 bytes for Pyjamask-128)
      if (keyBytes.length !== 16) {
        throw new Error('Invalid key size: ' + keyBytes.length + ' bytes (Pyjamask-128 requires 16 bytes)');
      }

      this._key = [...keyBytes];
      this.roundKeys = this.expandKey(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Key expansion function
    expandKey(keyBytes) {
      const roundKeys = [];

      // Load the initial key words (big-endian)
      let k0 = OpCodes.Pack32BE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]);
      let k1 = OpCodes.Pack32BE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]);
      let k2 = OpCodes.Pack32BE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]);
      let k3 = OpCodes.Pack32BE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15]);

      // First round key is the key itself
      roundKeys.push(k0, k1, k2, k3);

      // Derive round keys for all 14 rounds
      for (let round = 0; round < Pyjamask128Instance.ROUNDS; ++round) {
        // Mix the columns
        const temp = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(k0, k1), k2), k3));
        k0 = OpCodes.ToUint32(OpCodes.Xor32(k0, temp));
        k1 = OpCodes.ToUint32(OpCodes.Xor32(k1, temp));
        k2 = OpCodes.ToUint32(OpCodes.Xor32(k2, temp));
        k3 = OpCodes.ToUint32(OpCodes.Xor32(k3, temp));

        // Mix the rows and add round constants
        // Note: The specification says rotate left, but reference code uses right rotation
        k0 = Pyjamask128Instance.matrixMultiply_b881b9ca(k0);
        k0 = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(k0, 0x00000080), round));
        k1 = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.RotR32(k1, 8), 0x00006a00));
        k2 = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.RotR32(k2, 15), 0x003f0000));
        k3 = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.RotR32(k3, 18), 0x24000000));

        // Store round key
        roundKeys.push(k0, k1, k2, k3);
      }

      return roundKeys;
    }

    // Pyjamask-128 S-box
    sbox(s0, s1, s2, s3) {
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, s3));
      s3 = OpCodes.ToUint32(OpCodes.Xor32(s3, s0&s1));
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, s1&s2));
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, s2&s3));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, s0&s3));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, s1));
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, s0));
      s3 = OpCodes.ToUint32(~s3);
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, s3));
      s3 = OpCodes.ToUint32(OpCodes.Xor32(s3, s2));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, s3));

      return [s0, s1, s2, s3];
    }

    // Inverse Pyjamask-128 S-box
    sboxInverse(s0, s1, s2, s3) {
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, s3));
      s3 = OpCodes.ToUint32(OpCodes.Xor32(s3, s2));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, s3));
      s3 = OpCodes.ToUint32(~s3);
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, s0));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, s1));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, s0&s3));
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, s2&s3));
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, s1&s2));
      s3 = OpCodes.ToUint32(OpCodes.Xor32(s3, s0&s1));
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, s3));

      return [s0, s1, s2, s3];
    }

    // Encryption function
    encryptBlock(input) {
      if (!this.roundKeys) {
        throw new Error('Key not set');
      }

      // Load plaintext (big-endian)
      let s0 = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
      let s1 = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);
      let s2 = OpCodes.Pack32BE(input[8], input[9], input[10], input[11]);
      let s3 = OpCodes.Pack32BE(input[12], input[13], input[14], input[15]);

      // Perform all 14 encryption rounds
      for (let round = 0; round < Pyjamask128Instance.ROUNDS; ++round) {
        const rkOffset = round * 4;

        // Add round key
        s0 = OpCodes.ToUint32((s0^this.roundKeys[rkOffset]));
        s1 = OpCodes.ToUint32((s1^this.roundKeys[rkOffset + 1]));
        s2 = OpCodes.ToUint32((s2^this.roundKeys[rkOffset + 2]));
        s3 = OpCodes.ToUint32((s3^this.roundKeys[rkOffset + 3]));

        // Apply S-box
        [s0, s1, s2, s3] = this.sbox(s0, s1, s2, s3);

        // Mix rows
        s0 = Pyjamask128Instance.matrixMultiply_a3861085(s0);
        s1 = Pyjamask128Instance.matrixMultiply_63417021(s1);
        s2 = Pyjamask128Instance.matrixMultiply_692cf280(s2);
        s3 = Pyjamask128Instance.matrixMultiply_48a54813(s3);
      }

      // Final round key addition
      const finalRkOffset = Pyjamask128Instance.ROUNDS * 4;
      s0 = OpCodes.ToUint32((s0^this.roundKeys[finalRkOffset]));
      s1 = OpCodes.ToUint32((s1^this.roundKeys[finalRkOffset + 1]));
      s2 = OpCodes.ToUint32((s2^this.roundKeys[finalRkOffset + 2]));
      s3 = OpCodes.ToUint32((s3^this.roundKeys[finalRkOffset + 3]));

      // Store ciphertext (big-endian)
      const output = [];
      output.push(...OpCodes.Unpack32BE(s0));
      output.push(...OpCodes.Unpack32BE(s1));
      output.push(...OpCodes.Unpack32BE(s2));
      output.push(...OpCodes.Unpack32BE(s3));

      return output;
    }

    // Decryption function
    decryptBlock(input) {
      if (!this.roundKeys) {
        throw new Error('Key not set');
      }

      // Load ciphertext (big-endian)
      let s0 = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
      let s1 = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);
      let s2 = OpCodes.Pack32BE(input[8], input[9], input[10], input[11]);
      let s3 = OpCodes.Pack32BE(input[12], input[13], input[14], input[15]);

      // Initial round key subtraction (final round key)
      const finalRkOffset = Pyjamask128Instance.ROUNDS * 4;
      s0 = OpCodes.ToUint32((s0^this.roundKeys[finalRkOffset]));
      s1 = OpCodes.ToUint32((s1^this.roundKeys[finalRkOffset + 1]));
      s2 = OpCodes.ToUint32((s2^this.roundKeys[finalRkOffset + 2]));
      s3 = OpCodes.ToUint32((s3^this.roundKeys[finalRkOffset + 3]));

      // Perform all 14 decryption rounds (in reverse)
      for (let round = Pyjamask128Instance.ROUNDS - 1; round >= 0; --round) {
        // Inverse mix rows
        s0 = Pyjamask128Instance.matrixMultiply_2037a121(s0);
        s1 = Pyjamask128Instance.matrixMultiply_108ff2a0(s1);
        s2 = Pyjamask128Instance.matrixMultiply_9054d8c0(s2);
        s3 = Pyjamask128Instance.matrixMultiply_3354b117(s3);

        // Apply inverse S-box
        [s0, s1, s2, s3] = this.sboxInverse(s0, s1, s2, s3);

        // Subtract round key
        const rkOffset = round * 4;
        s0 = OpCodes.ToUint32((s0^this.roundKeys[rkOffset]));
        s1 = OpCodes.ToUint32((s1^this.roundKeys[rkOffset + 1]));
        s2 = OpCodes.ToUint32((s2^this.roundKeys[rkOffset + 2]));
        s3 = OpCodes.ToUint32((s3^this.roundKeys[rkOffset + 3]));
      }

      // Store plaintext (big-endian)
      const output = [];
      output.push(...OpCodes.Unpack32BE(s0));
      output.push(...OpCodes.Unpack32BE(s1));
      output.push(...OpCodes.Unpack32BE(s2));
      output.push(...OpCodes.Unpack32BE(s3));

      return output;
    }

    // Feed/Result pattern implementation
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error('Key not set');
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error('Key not set');
      if (this.inputBuffer.length === 0) throw new Error('No data fed');

      const output = [];
      const blockSize = this.BlockSize;

      // Process complete blocks only
      while (this.inputBuffer.length >= blockSize) {
        const block = this.inputBuffer.splice(0, blockSize);

        if (this.isInverse) {
          output.push(...this.decryptBlock(block));
        } else {
          output.push(...this.encryptBlock(block));
        }
      }

      return output;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Pyjamask128Algorithm());

  // Return empty object for UMD compatibility
  return {};
}));
