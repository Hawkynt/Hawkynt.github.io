/*
 * IDEA (International Data Encryption Algorithm) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * IDEA Algorithm by Xuejia Lai and James L. Massey (1991)
 * - 64-bit block size, 128-bit key size
 * - Uses 8 full rounds + final half-round with Lai-Massey structure
 * - Three operations: XOR (⊕), addition mod 2^16 (+), multiplication mod (2^16 + 1) (⊙)
 * - Patent expired in 2011, now freely usable
 */

// Load AlgorithmFramework (REQUIRED)

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
 * IDEAAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class IDEAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "IDEA";
      this.description = "International Data Encryption Algorithm by Lai and Massey. Uses Lai-Massey structure with three operations: XOR, addition mod 2^16, and multiplication mod (2^16+1). Patent expired 2011.";
      this.inventor = "Xuejia Lai, James L. Massey";
      this.year = 1991;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 1) // Fixed 128-bit key
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 1) // Fixed 64-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("IDEA Algorithm Specification", "https://en.wikipedia.org/wiki/International_Data_Encryption_Algorithm"),
        new LinkItem("Original Academic Paper", "https://link.springer.com/chapter/10.1007/3-540-46877-3_35"),
        new LinkItem("Applied Cryptography - IDEA", "https://www.schneier.com/books/applied_cryptography/")
      ];

      this.references = [
        new LinkItem("OpenSSL IDEA Implementation", "https://github.com/openssl/openssl/blob/master/crypto/idea/"),
        new LinkItem("Crypto++ IDEA Implementation", "https://github.com/weidai11/cryptopp/blob/master/idea.cpp"),
        new LinkItem("Bouncy Castle IDEA Implementation", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability("Patent History", "Algorithm was patented until 2011, limiting adoption. Patent-free since 2011.", "Use AES for new applications requiring standardized algorithms", "https://patents.google.com/patent/US5214703A")
      ];

      // Test vectors from NESSIE IDEA ECB test vectors
      this.tests = [
        {
          text: "NESSIE IDEA ECB test vector - all zeros",
          uri: "https://raw.githubusercontent.com/pyca/cryptography/main/vectors/cryptography_vectors/ciphers/IDEA/idea-ecb.txt",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0001000100000000")
        },
        {
          text: "NESSIE IDEA ECB test vector - high bit plaintext",
          uri: "https://raw.githubusercontent.com/pyca/cryptography/main/vectors/cryptography_vectors/ciphers/IDEA/idea-ecb.txt",
          input: OpCodes.Hex8ToBytes("8000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("8001000180008000")
        },
        {
          text: "Botan idea.vec - classic ISO/IEC 18033-3 sample, counting plaintext",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/block/idea.vec",
          input: OpCodes.Hex8ToBytes("0000000100020003"),
          key: OpCodes.Hex8ToBytes("00010002000300040005000600070008"),
          expected: OpCodes.Hex8ToBytes("11fbed2b01986de5")
        },
        {
          text: "Botan idea.vec - classic sample, sequential plaintext",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/block/idea.vec",
          input: OpCodes.Hex8ToBytes("0102030405060708"),
          key: OpCodes.Hex8ToBytes("00010002000300040005000600070008"),
          expected: OpCodes.Hex8ToBytes("540e5fea18c2f8b1")
        },
        {
          text: "Botan idea.vec - random key/plaintext pair",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/block/idea.vec",
          input: OpCodes.Hex8ToBytes("7409000000000000"),
          key: OpCodes.Hex8ToBytes("ed1bcc9e9267925f3132ba3a8cf9b764"),
          expected: OpCodes.Hex8ToBytes("e18315c171b83765")
        },
        {
          text: "Botan idea.vec - multi-block ECB chain",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/block/idea.vec",
          input: OpCodes.Hex8ToBytes("000000010002000301020304050607080019324b647d96aff5202d5b9c671b08"),
          key: OpCodes.Hex8ToBytes("00010002000300040005000600070008"),
          expected: OpCodes.Hex8ToBytes("11fbed2b01986de5540e5fea18c2f8b19f0a0ab6e10ced78cf18fd7355e2c5c5")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {IDEAInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new IDEAInstance(this, isInverse);
    }
  }

  /**
 * IDEA cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class IDEAInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {IDEAAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint16[]|null} */
      this.encryptKeys = null;
      /** @type {uint16[]|null} */
      this.decryptKeys = null;
      this.key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;

      // IDEA constants
      /** @type {int32} */
      this.ROUNDS = 8;
      /** @type {int32} */
      this.TOTAL_SUBKEYS = 52; // (8 * 6) + 4
      /** @type {uint32} */
      this.MODULUS = 0x10001;  // 2^16 + 1
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.encryptKeys = null;
        this.decryptKeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (must be 16)");
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Generate encryption and decryption subkeys
      this.encryptKeys = this._expandKey(keyBytes);
      this.decryptKeys = this._invertKey(this.encryptKeys);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }


    /**
     * Multiplication modulo (2^16 + 1) - IDEA's special operation
     * Based on Bouncy Castle implementation
     * In IDEA, 0 represents 2^16 (65536) for multiplication
     * @param {uint32} x - First 16-bit factor
     * @param {uint32} y - Second 16-bit factor
     * @returns {uint16} x * y mod 2^16+1
     */
    _mulMod(x, y) {
      const BASE = 0x10001;

      /** @type {uint32} */
      let r = 0;
      if (x === 0) {
        r = OpCodes.Sub32(BASE, y);
      } else if (y === 0) {
        r = OpCodes.Sub32(BASE, x);
      } else {
        const p = OpCodes.Mul32(x, y);  // below 2^32
        const lo = OpCodes.ToUint16(p);
        const hi = OpCodes.Shr32(p, 16);
        // lo - hi (+1 when negative); only the low 16 bits are kept
        r = OpCodes.Add32(OpCodes.Sub32(lo, hi), (lo < hi) ? 1 : 0);
      }
      return OpCodes.ToUint16(r);
    }

    /**
     * Modular inverse for multiplication mod (2^16 + 1)
     * Based on Bouncy Castle MulInv implementation
     * @param {uint16} x - 16-bit value
     * @returns {uint16} Multiplicative inverse mod 2^16+1
     */
    _mulInv(x) {
      const BASE = 0x10001;
      /** @type {uint32} */
      let t0 = 1;

      if (x < 2) return x;

      /** @type {uint32} */
      let t1 = Math.floor(BASE / x);
      let y = BASE % x;

      while (y !== 1) {
        const q = Math.floor(x / y);
        x = x % y;
        t0 = OpCodes.ToUint16(OpCodes.Add32(t0, OpCodes.Mul32(t1, q)));

        if (x === 1) return t0;

        const q2 = Math.floor(y / x);
        y = y % x;
        t1 = OpCodes.ToUint16(OpCodes.Add32(t1, OpCodes.Mul32(t0, q2)));
      }

      return OpCodes.ToUint16(OpCodes.Sub32(1, t1));
    }

    /**
     * Additive inverse modulo 2^16
     * Based on Bouncy Castle AddInv implementation
     * @param {uint16} x - 16-bit value
     * @returns {uint16} -x mod 2^16
     */
    _addInv(x) {
      return OpCodes.ToUint16(OpCodes.Sub32(0, x));
    }

    /**
     * Generate 52 subkeys from 128-bit master key
     * Based on Bouncy Castle ExpandKey implementation
     * @param {uint8[]} uKey - Key bytes
     * @returns {uint16[]} The 52 encryption subkeys
     */
    _expandKey(uKey) {
      /** @type {uint16[]} */
      const ek = new Array(52);

      // Pad key if needed (though IDEA requires exactly 16 bytes)
      if (uKey.length < 16) {
        /** @type {uint8[]} */
        const tmp = new Array(16);
        for (let i = 0; i < 16; i++) tmp[i] = 0;
        for (let i = 0; i < uKey.length; i++) {
          tmp[tmp.length - uKey.length + i] = uKey[i];
        }
        uKey = tmp;
      }
      
      // Extract first 8 subkeys directly from user key (big-endian)
      for (let i = 0; i < 8; i++) {
        ek[i] = OpCodes.Pack16BE(uKey[i * 2], uKey[i * 2 + 1]);
      }
      
      // Generate remaining subkeys using the IDEA key schedule.
      // After every group of eight subkeys the 128-bit key register is rotated
      // left by 25 bits, which the reference formulation expresses as a case
      // split on (i mod 8) taking the low seven bits of one earlier subkey and
      // the high nine bits of another.
      for (let i = 8; i < 52; i++) {
        const slot = i % 8;
        if (slot < 6) {
          ek[i] = OpCodes.ToUint16(OpCodes.Shl16(OpCodes.And16(ek[i - 7], 0x7F), 9) + OpCodes.Shr16(ek[i - 6], 7));
        } else if (slot === 6) {
          ek[i] = OpCodes.ToUint16(OpCodes.Shl16(OpCodes.And16(ek[i - 7], 0x7F), 9) + OpCodes.Shr16(ek[i - 14], 7));
        } else {
          ek[i] = OpCodes.ToUint16(OpCodes.Shl16(OpCodes.And16(ek[i - 15], 0x7F), 9) + OpCodes.Shr16(ek[i - 14], 7));
        }
      }
      
      return ek;
    }

    /**
     * Generate decryption subkeys from encryption subkeys
     * Based on Bouncy Castle InvertKey implementation
     * @param {uint16[]} inKey - Encryption subkeys
     * @returns {uint16[]} Decryption subkeys
     */
    _invertKey(inKey) {
      /** @type {uint16[]} */
      const dk = new Array(52);
      let inOff = 0;
      let p = 52; // Work backwards
      
      // First round
      let t1 = this._mulInv(inKey[inOff++]);
      let t2 = this._addInv(inKey[inOff++]);
      let t3 = this._addInv(inKey[inOff++]);
      let t4 = this._mulInv(inKey[inOff++]);
      dk[--p] = t4;
      dk[--p] = t3;
      dk[--p] = t2;
      dk[--p] = t1;
      
      // Rounds 2-8
      for (let round = 1; round < 8; round++) {
        t1 = inKey[inOff++];
        t2 = inKey[inOff++];
        dk[--p] = t2;
        dk[--p] = t1;
        
        t1 = this._mulInv(inKey[inOff++]);
        t2 = this._addInv(inKey[inOff++]);
        t3 = this._addInv(inKey[inOff++]);
        t4 = this._mulInv(inKey[inOff++]);
        dk[--p] = t4;
        dk[--p] = t2; // NB: Order - t2 and t3 are swapped!
        dk[--p] = t3;
        dk[--p] = t1;
      }
      
      // Final half-round
      t1 = inKey[inOff++];
      t2 = inKey[inOff++];
      dk[--p] = t2;
      dk[--p] = t1;
      
      t1 = this._mulInv(inKey[inOff++]);
      t2 = this._addInv(inKey[inOff++]);
      t3 = this._addInv(inKey[inOff++]);
      t4 = this._mulInv(inKey[inOff]);
      dk[--p] = t4;
      dk[--p] = t3;
      dk[--p] = t2;
      dk[--p] = t1;
      
      return dk;
    }

    /**
     * IDEA encryption/decryption engine
     * Based on Bouncy Castle IdeaFunc implementation
     * @param {uint16[]} workingKey - Encryption or decryption subkeys
     * @param {uint8[]} input - 8-byte block
     * @param {uint8[]} output - 8-byte result buffer
     * @returns {uint8[]} output
     */
    _ideaFunc(workingKey, input, output) {
      const MASK = 0xFFFF;
      
      // Extract four 16-bit words (big-endian)
      let x0 = OpCodes.Pack16BE(input[0], input[1]);
      let x1 = OpCodes.Pack16BE(input[2], input[3]);
      let x2 = OpCodes.Pack16BE(input[4], input[5]);
      let x3 = OpCodes.Pack16BE(input[6], input[7]);
      
      let keyOff = 0;
      
      // 8 rounds
      for (let round = 0; round < 8; round++) {
        x0 = this._mulMod(x0, workingKey[keyOff++]);
        x1 = OpCodes.And32(OpCodes.Add32(x1, workingKey[keyOff++]), MASK);
        x2 = OpCodes.And32(OpCodes.Add32(x2, workingKey[keyOff++]), MASK);
        x3 = this._mulMod(x3, workingKey[keyOff++]);

        const t0 = x1;
        const t1 = x2;
        x2 = OpCodes.Xor32(x2, x0);
        x1 = OpCodes.Xor32(x1, x3);
        x2 = this._mulMod(x2, workingKey[keyOff++]);
        x1 = OpCodes.And32(OpCodes.Add32(x1, x2), MASK);
        x1 = this._mulMod(x1, workingKey[keyOff++]);
        x2 = OpCodes.And32(OpCodes.Add32(x2, x1), MASK);
        x0 = OpCodes.Xor32(x0, x1);
        x3 = OpCodes.Xor32(x3, x2);
        x1 = OpCodes.Xor32(x1, t1);
        x2 = OpCodes.Xor32(x2, t0);
      }

      // Final transformation
      const result = [
        OpCodes.And32(this._mulMod(x0, workingKey[keyOff++]), 0xFFFF),
        OpCodes.And32(OpCodes.Add32(x2, workingKey[keyOff++]), MASK), // NB: Order - x2 and x1 swapped
        OpCodes.And32(OpCodes.Add32(x1, workingKey[keyOff++]), MASK),
        OpCodes.And32(this._mulMod(x3, workingKey[keyOff]), 0xFFFF)
      ];
      
      // Convert back to bytes (big-endian)
      const bytes0 = OpCodes.Unpack16BE(result[0]);
      const bytes1 = OpCodes.Unpack16BE(result[1]);
      const bytes2 = OpCodes.Unpack16BE(result[2]);
      const bytes3 = OpCodes.Unpack16BE(result[3]);

      output[0] = bytes0[0];
      output[1] = bytes0[1];
      output[2] = bytes1[0];
      output[3] = bytes1[1];
      output[4] = bytes2[0];
      output[5] = bytes2[1];
      output[6] = bytes3[0];
      output[7] = bytes3[1];
      
      return output;
    }

    // Encrypt a 64-bit block
    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    EncryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('IDEA block size must be exactly 8 bytes');
      }

      /** @type {uint8[]} */
      const output = new Array(8);
      return this._ideaFunc(this.encryptKeys, block, output);
    }

    // Decrypt a 64-bit block
    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    DecryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('IDEA block size must be exactly 8 bytes');
      }

      /** @type {uint8[]} */
      const output = new Array(8);
      return this._ideaFunc(this.decryptKeys, block, output);
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new IDEAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { IDEAAlgorithm, IDEAInstance };
}));