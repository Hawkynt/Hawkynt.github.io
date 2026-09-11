/*
 * Lucifer Block Cipher Implementation
 * Universal Cipher Format
 * (c)2006-2025 Hawkynt
 *
 * IBM's Lucifer cipher (1973) - the direct predecessor to DES.
 * Features 128-bit blocks, 128-bit keys, and 16-round Feistel structure.
 * 
 * Based on the specifications from:
 * - Arthur Sorkin, "Lucifer, A Cryptographic Algorithm", Cryptologia Vol 8 No 1 (1984)
 * - Original IBM design by Horst Feistel and Don Coppersmith
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

  // Lucifer components as specified by Sorkin, CRYPTOLOGIA 8(1), 1984.

  // The two 4-bit substitution boxes
  const SBOX0 = Object.freeze([12, 15, 7, 10, 14, 13, 11, 0, 2, 6, 3, 1, 9, 4, 5, 8]);
  const SBOX1 = Object.freeze([7, 2, 14, 9, 3, 11, 0, 4, 12, 13, 1, 10, 6, 15, 8, 5]);

  // Bit permutation applied after substitution and to the key bytes
  const PBITS = Object.freeze([3, 5, 0, 4, 2, 1, 7, 6]);
  const SMASK = Object.freeze([128, 64, 32, 16, 8, 4, 2, 1]);

  // Diffusion pattern: the base row rotated right once per S-box position
  const BASE_DIFFUSION = Object.freeze([4, 16, 32, 2, 1, 8, 64, 128]);
  const DIFFUSION = Object.freeze((function () {
    const rows = [];
    for (let r = 0; r < 8; r++) {
      const row = new Array(8);
      for (let m = 0; m < 8; m++) row[m] = BASE_DIFFUSION[(m - r + 8) % 8];
      rows.push(Object.freeze(row));
    }
    return rows;
  })());

  // Combined substitute-and-permute tables. The transfer control bit decides
  // which of the two S-boxes sees which nibble, so TCB1 is TCB0 with the input
  // nibbles exchanged.
  const TCB0 = new Array(256);
  const TCB1 = new Array(256);
  (function () {
    const permute = function (b) {
      let out = 0;
      for (let i = 0; i < 8; i++) if (b&SMASK[i]) out |= SMASK[PBITS[i]];
      return out;
    };
    for (let x = 0; x < 256; x++) {
      const hi = OpCodes.Shr32(x, 4)&0x0F;
      const lo = x&0x0F;
      TCB0[x] = permute(OpCodes.Shl32(SBOX0[hi]&0x0F, 4)|(SBOX1[lo]&0x0F));
      TCB1[x] = permute(OpCodes.Shl32(SBOX0[lo]&0x0F, 4)|(SBOX1[hi]&0x0F));
    }
    Object.freeze(TCB0);
    Object.freeze(TCB1);
  })();

// Define classes only if AlgorithmFramework is available
let LuciferAlgorithm, LuciferInstance;

  LuciferAlgorithm = class extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Lucifer";
    this.description = "IBM's pioneering Feistel cipher (1973) that directly led to DES development. Uses 128-bit blocks and keys with 16-round structure.";
    this.inventor = "Horst Feistel, Don Coppersmith";
    this.year = 1973;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Feistel Cipher";
    this.securityStatus = SecurityStatus.OBSOLETE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Historical significance
    this.documentation = [
      new LinkItem("Original IBM Research Paper", "https://dominoweb.draco.res.ibm.com/reports/RC3326.pdf"),
      new LinkItem("Sorkin 1984 Specification", "https://www.tandfonline.com/doi/abs/10.1080/0161-118491858746")
    ];

    this.references = [
      new LinkItem("cryptospecs LUCIFER Reference Source (lucifer.c)", "https://github.com/stamparm/cryptospecs/blob/master/symmetrical/sources/lucifer.c"),
      new LinkItem("lucifer-go Implementation", "https://github.com/robwaddell/lucifer-go")
    ];

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(16, 16, 0) // Fixed 128-bit key
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 0) // Fixed 128-bit blocks
    ];

    // Published known-answer tests (LUCIFER2/TESTS, Applied Cryptography source code)
    this.tests = [
      {
        text: "Applied Cryptography LUCIFER2 TESTS vector 1",
        uri: "https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        expected: OpCodes.Hex8ToBytes("a201fc18d62c85ef5965a58295bbf609")
      },
      {
        text: "Applied Cryptography LUCIFER2 TESTS vector 2",
        uri: "https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip",
        input: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("9d14fe4377aa87dd07cc8a14522c21ed")
      },
      {
        text: "Applied Cryptography LUCIFER2 TESTS vector 3",
        uri: "https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip",
        input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
        key: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        expected: OpCodes.Hex8ToBytes("97f1c104b0f120d194c07024f14815ed")
      },
      {
        text: "Applied Cryptography LUCIFER2 TESTS vector 4",
        uri: "https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip",
        input: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
        expected: OpCodes.Hex8ToBytes("d442a34dd70e2b4156eb0f2a8aded1a7")
      },
      {
        text: "Applied Cryptography LUCIFER2 TESTS vector 5",
        uri: "https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip",
        input: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        key: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        expected: OpCodes.Hex8ToBytes("cf46622fa98546bb9a5bc00239eb0c92")
      },
      {
        text: "Applied Cryptography LUCIFER2 TESTS vector 6",
        uri: "https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip",
        input: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        key: OpCodes.Hex8ToBytes("fedcba9876543210" + "0123456789abcdef"),
        expected: OpCodes.Hex8ToBytes("7faf65bfc5458fd2dc9cc2266012ef44")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new LuciferInstance(this, isInverse);
  }
  };

  // Instance class for actual encryption/decryption
  LuciferInstance = class extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.inputBuffer = [];
    this.BlockSize = 16; // 128-bit blocks
    this.KeySize = 0;
    this.subKeys = null;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.subKeys = null;
      this.KeySize = 0;
      return;
    }

    if (keyBytes.length !== 16) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    this.subKeys = this._generateSubKeys(this._key);
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  /**
   * Build the transfer control bytes and the permuted key bytes for all 16 rounds.
   *
   * The 128-bit key is used twice per round: the byte selected by the round
   * counter supplies the eight transfer control bits, and eight consecutive
   * bit-permuted key bytes are XORed into the S-box outputs. Encryption walks
   * the key register forwards in steps of seven; decryption walks it backwards.
   */
  _generateSubKeys(masterKey) {
    const controlBytes = new Array(16);
    const keyBytes = new Array(16);
    const permuted = masterKey.map(LuciferInstance._permuteByte);

    let kc = this.isInverse ? 8 : 0;
    for (let round = 0; round < 16; round++) {
      if (this.isInverse) kc = (kc + 1)&15;
      controlBytes[round] = masterKey[kc];
      const row = new Array(8);
      for (let j = 0; j < 8; j++) {
        row[j] = permuted[kc];
        if (j < 7 || this.isInverse) kc = (kc + 1)&15;
      }
      keyBytes[round] = row;
    }

    return { controlBytes, keyBytes };
  }

  /**
   * Bit permutation applied to key bytes and to the S-box output byte.
   */
  static _permuteByte(b) {
    let out = 0;
    for (let i = 0; i < 8; i++) if (b&SMASK[i]) out |= SMASK[PBITS[i]];
    return out;
  }

  /**
   * Sixteen rounds of Lucifer over a 16-byte block. Each round confuses the
   * upper half through the two S-boxes and diffuses the result into the lower
   * half, then the halves exchange roles.
   */
  _transform(block) {
    const b = block.slice();
    let lower = 0, upper = 8;

    for (let round = 0; round < 16; round++) {
      const tcb = this.subKeys.controlBytes[round];
      const keyRow = this.subKeys.keyBytes[round];

      for (let j = 0; j < 8; j++) {
        let val = (tcb&SMASK[j]) ? TCB1[b[upper + j]] : TCB0[b[upper + j]];
        val ^= keyRow[j];
        const pattern = DIFFUSION[j];
        for (let m = 0; m < 8; m++) b[lower + m] ^= (val&pattern[m]);
      }

      const swap = lower;
      lower = upper;
      upper = swap;
    }

    // Final exchange of the two halves
    for (let m = 0; m < 8; m++) {
      const t = b[m];
      b[m] = b[m + 8];
      b[m + 8] = t;
    }

    return b;
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");
    for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
  }

  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
      const block = this.inputBuffer.slice(i, i + this.BlockSize);
      const processedBlock = this.isInverse 
        ? this._decryptBlock(block) 
        : this._encryptBlock(block);
      for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
    }

    this.inputBuffer = [];
    return output;
  }

  /**
   * Encrypt a 128-bit block
   */
  _encryptBlock(block) {
    return this._transform(block);
  }

  /**
   * Decrypt a 128-bit block (same transform driven by the reversed key schedule)
   */
  _decryptBlock(block) {
    return this._transform(block);
  }
  };

  // ===== REGISTRATION =====

    const algorithmInstance = new LuciferAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LuciferAlgorithm, LuciferInstance };
}));