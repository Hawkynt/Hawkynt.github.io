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
  const SBOX0 = OpCodes.Hex8ToBytes("0c0f070a0e0d0b000206030109040508");
  Object.freeze(SBOX0);
  const SBOX1 = OpCodes.Hex8ToBytes("07020e09030b00040c0d010a060f0805");
  Object.freeze(SBOX1);

  // Bit permutation applied after substitution and to the key bytes
  const PBITS = OpCodes.Hex8ToBytes("0305000402010706"); // 3, 5, 0, 4, 2, 1, 7, 6
  Object.freeze(PBITS);
  const SMASK = OpCodes.Hex8ToBytes("8040201008040201"); // 128, 64, ..., 1
  Object.freeze(SMASK);

  // Diffusion pattern: the base row rotated right once per S-box position
  const BASE_DIFFUSION = OpCodes.Hex8ToBytes("0410200201084080"); // 4, 16, 32, 2, 1, 8, 64, 128
  Object.freeze(BASE_DIFFUSION);

  /**
   * Build the eight diffusion rows (the base row rotated right once per row)
   * @returns {uint8[][]} Frozen diffusion rows
   */
  function buildDiffusion() {
    /** @type {uint8[][]} */
    const rows = [];
    for (let r = 0; r < 8; r++) {
      /** @type {uint8[]} */
      const pattern = [];
      for (let m = 0; m < 8; m++) pattern.push(BASE_DIFFUSION[(m - r + 8) % 8]);
      rows.push(Object.freeze(pattern));
    }
    return rows;
  }
  /** @type {uint8[][]} */
  const DIFFUSION = buildDiffusion();
  Object.freeze(DIFFUSION);

  /**
   * Bit permutation applied to key bytes and to the S-box output byte.
   * @param {uint8} b - Input byte
   * @returns {uint8} Permuted byte
   */
  function permuteByte(b) {
    /** @type {uint8} */
    let out = 0;
    for (let i = 0; i < 8; i++) if (OpCodes.And8(b, SMASK[i]) !== 0) out = OpCodes.Or8(out, SMASK[PBITS[i]]);
    return out;
  }

  // Combined substitute-and-permute tables. The transfer control bit decides
  // which of the two S-boxes sees which nibble, so TCB1 is TCB0 with the input
  // nibbles exchanged.
  /**
   * Build one substitute-and-permute table
   * @param {boolean} exchanged - False: S0 sees the high nibble (TCB0); true: the nibbles are exchanged (TCB1)
   * @returns {uint8[]} 256-entry table
   */
  function buildTcb(exchanged) {
    const table = OpCodes.CreateArray(256, 0);
    for (let x = 0; x < 256; x++) {
      const hi = OpCodes.And32(OpCodes.Shr32(x, 4), 0x0F);
      const lo = OpCodes.And32(x, 0x0F);
      const s0In = exchanged ? lo : hi;
      const s1In = exchanged ? hi : lo;
      table[x] = permuteByte(OpCodes.Or32(OpCodes.Shl32(OpCodes.And32(SBOX0[s0In], 0x0F), 4), OpCodes.And32(SBOX1[s1In], 0x0F)));
    }
    return table;
  }
  const TCB0 = buildTcb(false);
  const TCB1 = buildTcb(true);
  Object.freeze(TCB0);
  Object.freeze(TCB1);

  class LuciferAlgorithm extends BlockCipherAlgorithm {
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

  /**
   * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
   * @returns {LuciferInstance} New instance
   */
  CreateInstance(isInverse = false) {
    return new LuciferInstance(this, isInverse);
  }
  }

  // Instance class for actual encryption/decryption
  class LuciferInstance extends IBlockCipherInstance {
  /**
   * @param {LuciferAlgorithm} algorithm - Parent algorithm
   * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
   */
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    /** @type {uint8[]|null} */
    this._key = null;
    /** @type {uint8[]|null} */
    this.controlBytes = null;
    /** @type {uint8[][]|null} */
    this.roundKeyBytes = null;
    this.key = null;
    /** @type {uint8[]} */
    this.inputBuffer = [];
    this.BlockSize = 16; // 128-bit blocks
    this.KeySize = 0;
  }

  /**
   * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
   */
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.controlBytes = null;
      this.roundKeyBytes = null;
      this.KeySize = 0;
      return;
    }

    if (keyBytes.length !== 16) {
      throw new Error("Invalid key size: " + keyBytes.length + " bytes");
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    this._generateSubKeys(this._key);
  }

  /**
   * @returns {uint8[]|null} Copy of the key, or null
   */
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
   * The results go to this.controlBytes and this.roundKeyBytes.
   * @param {uint8[]} masterKey - 16 key bytes
   */
  _generateSubKeys(masterKey) {
    /** @type {uint8[]} */
    const controlBytes = new Array(16);
    /** @type {uint8[][]} */
    const keyBytes = new Array(16);
    /** @type {uint8[]} */
    const permuted = [];
    for (let i = 0; i < masterKey.length; i++) permuted.push(permuteByte(masterKey[i]));

    let kc = this.isInverse ? 8 : 0;
    for (let round = 0; round < 16; round++) {
      if (this.isInverse) kc = (kc + 1)&15;
      controlBytes[round] = masterKey[kc];
      /** @type {uint8[]} */
      const row = new Array(8);
      for (let j = 0; j < 8; j++) {
        row[j] = permuted[kc];
        if (j < 7 || this.isInverse) kc = (kc + 1)&15;
      }
      keyBytes[round] = row;
    }

    this.controlBytes = controlBytes;
    this.roundKeyBytes = keyBytes;
  }

  /**
   * Bit permutation applied to key bytes and to the S-box output byte.
   * @param {uint8} b - Input byte
   * @returns {uint8} Permuted byte
   */
  static _permuteByte(b) {
    return permuteByte(b);
  }

  /**
   * Sixteen rounds of Lucifer over a 16-byte block. Each round confuses the
   * upper half through the two S-boxes and diffuses the result into the lower
   * half, then the halves exchange roles.
   * @param {uint8[]} block - Input block
   * @returns {uint8[]} Output block
   */
  _transform(block) {
    const b = block.slice();
    let lower = 0, upper = 8;

    for (let round = 0; round < 16; round++) {
      const tcb = this.controlBytes[round];
      const keyRow = this.roundKeyBytes[round];

      for (let j = 0; j < 8; j++) {
        let val = OpCodes.And8(tcb, SMASK[j]) !== 0 ? TCB1[b[upper + j]] : TCB0[b[upper + j]];
        val = OpCodes.Xor8(val, keyRow[j]);
        const pattern = DIFFUSION[j];
        for (let m = 0; m < 8; m++) b[lower + m] = OpCodes.Xor8(b[lower + m], OpCodes.And8(val, pattern[m]));
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

  /**
   * @param {uint8[]} data - Input bytes
   */
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");
    for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
  }

  /**
   * @returns {uint8[]} Processed output bytes
   */
  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");
    }

    /** @type {uint8[]} */
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
   * @param {uint8[]} block - Input block
   * @returns {uint8[]} Output block
   */
  _encryptBlock(block) {
    return this._transform(block);
  }

  /**
   * Decrypt a 128-bit block (same transform driven by the reversed key schedule)
   * @param {uint8[]} block - Input block
   * @returns {uint8[]} Output block
   */
  _decryptBlock(block) {
    return this._transform(block);
  }
  }


  // ===== REGISTRATION =====

    const algorithmInstance = new LuciferAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LuciferAlgorithm, LuciferInstance };
}));