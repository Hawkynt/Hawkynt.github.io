/*
 * REDOC Block Cipher Implementation (REDOC II and REDOC III)
 * Compatible with AlgorithmFramework
 * Michael Wood's data-dependent ciphers for Cryptech Inc
 * (c)2006-2025 Hawkynt
 *
 * REDOC II: 80-bit blocks, 160-bit keys, 10 rounds of key- and data-selected
 *           substitutions, enclaves and permutations,
 *           following Michael Wood's reference source code
 * REDOC III: 64-bit blocks, 8- to 272-bit keys, XOR-only key-table masking,
 *            following Michael Wood's reference source code
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

  // ===== REDOC II IMPLEMENTATION =====
  //
  // Follows Michael Wood's REDOC II reference source (REDOC2.ZIP of the
  // Applied Cryptography source distribution) and the published description
  // (Cusick and Wood, "The REDOC II Cryptosystem", CRYPTO '90):
  //   - fixed, key-independent function tables drawn from rand(): 256
  //     permutations of the 10 block bytes, 16 byte substitutions with their
  //     inverses, and 256 enclave tables (three rows, each a permutation of
  //     0-4, whose columns hold three distinct indices)
  //   - the 160-bit key is split into two 10-byte halves; the second half is
  //     transformed 256 times (permutation, substitution, left and right
  //     enclave, all selected by the first half XOR the current row, while the
  //     first half is permuted as well), each state becoming a key-table row
  //   - the 2560-byte key table is XOR-folded into a 10x10 mask table
  //   - 10 rounds, each skipping bytes r and r+1: two substitutions, a key-row
  //     XOR, the left and right enclave, a second key-row XOR and a
  //     permutation, every table chosen by a block byte XOR a mask byte
  // Choices for what the reference source leaves to its platform:
  //   - rand() is the C standard's reference generator (multiplier
  //     1103515245, increment 12345, 15-bit result), as for REDOC III;
  //   - the table generators take their seeds from consecutive values starting
  //     at 32 (the source passes the constant 32 as the seed address); each of
  //     the three generators starts again at 32, reseeding with the next value
  //     after every 6 permutations, every substitution and every 6 enclave
  //     tables;
  //   - the mask fold reads 2600 entries, 40 more than the key table holds;
  //     the source declares the mask table right after the key table, so the
  //     last 40 entries are mask bytes 0-39, XORed into mask bytes 60-99.

  /** @type {int32} */
  const REDOC2_BLOCK_SIZE = 10;
  /** @type {int32} */
  const REDOC2_KEY_SIZE = 20;
  /** @type {int32} */
  const REDOC2_ROUNDS = 10;
  /** @type {int32} */
  const REDOC2_PERMUTATIONS = 256;
  /** @type {int32} */
  const REDOC2_SUBSTITUTIONS = 16;
  /** @type {int32} */
  const REDOC2_ENCLAVES = 256;
  /** @type {int32} */
  const REDOC2_ENCLAVE_SIZE = 15;
  /** @type {int32} */
  const REDOC2_KEY_ROWS = 256;
  /** @type {int32} */
  const REDOC2_MASK_SIZE = 100;
  /** @type {int32} */
  const REDOC2_MASK_FOLD = 2600;
  /** @type {int32} */
  const REDOC2_FIRST_SEED = 32;
  /** @type {uint32} */
  const REDOC2_RAND_MULT = 1103515245;
  /** @type {uint32} */
  const REDOC2_RAND_INC = 12345;

  /**
   * The C standard's reference rand(): advance the seed, return its bits 16-30
   * @param {uint32[]} state - One-element generator state, updated
   * @returns {int32} Next value, 0 to 32767
   */
  function redoc2Rand(state) {
    state[0] = OpCodes.ToUint32(OpCodes.Add32(OpCodes.Mul32(state[0], REDOC2_RAND_MULT), REDOC2_RAND_INC));
    return OpCodes.And32(OpCodes.Shr32(state[0], 16), 0x7FFF);
  }

  /**
   * Write a random permutation of 0..count-1 into table, drawing values with
   * rand() modulo count and rejecting repeats
   * @param {uint32[]} rng - Generator state
   * @param {uint8[]} table - Destination
   * @param {int32} offset - First entry written
   * @param {int32} count - Permutation length
   */
  function redoc2RandomPermutation(rng, table, offset, count) {
    /** @type {uint8[]} */
    const seen = new Uint8Array(count);
    let filled = 0;
    while (filled < count) {
      /** @type {int32} */
      const value = redoc2Rand(rng) % count;
      if (seen[value] === 0) {
        seen[value] = 1;
        table[offset + filled] = value;
        ++filled;
      }
    }
  }

  /**
   * Key-independent function tables of REDOC II
   * @typedef {Object} REDOC2Tables
   * @property {uint8[]} perm - 256 permutations of 10 bytes
   * @property {uint8[]} sub - 16 substitutions of 256 bytes
   * @property {uint8[]} inv - Inverses of the substitutions
   * @property {uint8[]} encl - 256 enclave tables of 3x5 entries
   */

  /** @type {REDOC2Tables|null} */
  let redoc2Tables = null;

  /**
   * Build (once) the permutation, substitution and enclave tables
   * @returns {REDOC2Tables} Function tables
   */
  function redoc2FunctionTables() {
    if (redoc2Tables) return redoc2Tables;

    /** @type {uint8[]} */
    const perm = new Uint8Array(REDOC2_PERMUTATIONS * REDOC2_BLOCK_SIZE);
    /** @type {uint32[]} */
    const rng = new Uint32Array([REDOC2_FIRST_SEED]);
    let seed = REDOC2_FIRST_SEED;
    for (let i = 0; i < REDOC2_PERMUTATIONS; i++) {
      redoc2RandomPermutation(rng, perm, i * REDOC2_BLOCK_SIZE, REDOC2_BLOCK_SIZE);
      if ((i + 1) % 6 === 0) rng[0] = ++seed;
    }

    /** @type {uint8[]} */
    const sub = new Uint8Array(REDOC2_SUBSTITUTIONS * 256);
    /** @type {uint8[]} */
    const inv = new Uint8Array(REDOC2_SUBSTITUTIONS * 256);
    seed = REDOC2_FIRST_SEED;
    rng[0] = seed;
    for (let t = 0; t < REDOC2_SUBSTITUTIONS; t++) {
      redoc2RandomPermutation(rng, sub, t * 256, 256);
      rng[0] = ++seed;
      for (let i = 0; i < 256; i++) inv[OpCodes.Add32(t * 256, sub[t * 256 + i])] = i;
    }

    /** @type {uint8[]} */
    const encl = new Uint8Array(REDOC2_ENCLAVES * REDOC2_ENCLAVE_SIZE);
    seed = REDOC2_FIRST_SEED;
    rng[0] = seed;
    for (let t = 0; t < REDOC2_ENCLAVES; t++) {
      const base = t * REDOC2_ENCLAVE_SIZE;
      let valid = false;
      while (!valid) {
        for (let row = 0; row < 3; row++) redoc2RandomPermutation(rng, encl, base + row * 5, 5);
        valid = true;
        for (let col = 0; col < 5; col++) {
          const x = encl[base + col];
          const y = encl[base + 5 + col];
          const z = encl[base + 10 + col];
          if (x === y || x === z || y === z) valid = false;
        }
      }
      if ((t + 1) % 6 === 0) rng[0] = ++seed;
    }

    redoc2Tables = { perm: perm, sub: sub, inv: inv, encl: encl };
    return redoc2Tables;
  }

  /**
   * Move byte i of the 10 bytes to position perm[i]
   * @param {uint8[]} perm - Permutation tables
   * @param {int32} row - Permutation number
   * @param {uint8[]} data - Bytes, changed in place
   */
  function redoc2Permute(perm, row, data) {
    const src = data.slice(0, REDOC2_BLOCK_SIZE);
    const base = row * REDOC2_BLOCK_SIZE;
    for (let i = 0; i < REDOC2_BLOCK_SIZE; i++) data[perm[base + i]] = src[i];
  }

  /**
   * Undo redoc2Permute
   * @param {uint8[]} perm - Permutation tables
   * @param {int32} row - Permutation number
   * @param {uint8[]} data - Bytes, changed in place
   */
  function redoc2Unpermute(perm, row, data) {
    const src = data.slice(0, REDOC2_BLOCK_SIZE);
    const base = row * REDOC2_BLOCK_SIZE;
    for (let i = 0; i < REDOC2_BLOCK_SIZE; i++) data[i] = src[perm[base + i]];
  }

  /**
   * Substitute every block byte except the skipped one
   * @param {uint8[]} sub - Substitution (or inverse) tables
   * @param {int32} table - Table number, 0 to 15
   * @param {uint8[]} data - Bytes, changed in place
   * @param {int32} skip - Byte left unchanged (10 = none)
   */
  function redoc2Substitute(sub, table, data, skip) {
    const base = table * 256;
    for (let i = 0; i < REDOC2_BLOCK_SIZE; i++) {
      if (i !== skip) data[i] = sub[OpCodes.Add32(base, data[i])];
    }
  }

  /**
   * XOR a key-table row into every block byte except the skipped one
   * @param {uint8[]} keyTable - Key table
   * @param {int32} row - Row number, 0 to 255
   * @param {uint8[]} data - Bytes, changed in place
   * @param {int32} skip - Byte left unchanged
   */
  function redoc2KeyXor(keyTable, row, data, skip) {
    const base = row * REDOC2_BLOCK_SIZE;
    for (let i = 0; i < REDOC2_BLOCK_SIZE; i++) {
      if (i !== skip) data[i] = OpCodes.Xor8(data[i], keyTable[base + i]);
    }
  }

  /**
   * Apply (or undo) one enclave table to the 5-byte half at offset: per
   * column, the byte named by the first row gains (loses) the bytes named by
   * the second and third rows
   * @param {uint8[]} encl - Enclave tables
   * @param {int32} table - Enclave table number
   * @param {uint8[]} data - Bytes, changed in place
   * @param {int32} half - Offset of the half, 0 or 5
   * @param {boolean} forward - Add (true) or subtract (false)
   */
  function redoc2Clave(encl, table, data, half, forward) {
    const base = table * REDOC2_ENCLAVE_SIZE;
    for (let n = 0; n < 5; n++) {
      const col = forward ? n : 4 - n;
      const target = OpCodes.Add32(half, encl[base + col]);
      const sum = OpCodes.Add32(data[OpCodes.Add32(half, encl[base + 5 + col])], data[OpCodes.Add32(half, encl[base + 10 + col])]);
      data[target] = OpCodes.ToByte(forward ? OpCodes.Add32(data[target], sum) : OpCodes.Sub32(data[target], sum));
    }
  }

  /**
   * Enclave function on one half: two enclave tables, then the other half is
   * XORed into it
   * @param {uint8[]} encl - Enclave tables
   * @param {int32} first - First enclave table
   * @param {int32} second - Second enclave table
   * @param {uint8[]} data - Bytes, changed in place
   * @param {int32} half - Offset of the changed half, 0 (left) or 5 (right)
   * @param {boolean} forward - Apply (true) or undo (false)
   */
  function redoc2Enclave(encl, first, second, data, half, forward) {
    const other = 5 - half;
    if (forward) {
      redoc2Clave(encl, first, data, half, true);
      redoc2Clave(encl, second, data, half, true);
    }
    for (let i = 0; i < 5; i++) data[half + i] = OpCodes.Xor8(data[half + i], data[other + i]);
    if (!forward) {
      redoc2Clave(encl, second, data, half, false);
      redoc2Clave(encl, first, data, half, false);
    }
  }

  /**
 * REDOC2Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class REDOC2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "REDOC II";
      this.description = "Michael Wood's cipher for Cryptech Inc: 80-bit blocks, a 160-bit key and 10 rounds of substitutions, key-table XORs, enclave functions and permutations, each chosen by a block byte XORed with a mask byte. The key expands into a 256-row key table and a 10x10 mask table. Follows Wood's reference source code.";
      this.inventor = "Michael Wood";
      this.year = 1990;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(REDOC2_KEY_SIZE, REDOC2_KEY_SIZE, 0)
      ];
      this.SupportedBlockSizes = [
        new KeySize(REDOC2_BLOCK_SIZE, REDOC2_BLOCK_SIZE, 0)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Applied Cryptography source code (REDOC2.ZIP by Michael Wood)", "https://www.schneier.com/books/applied-cryptography-source/"),
        new LinkItem("Cusick, Wood - \"The REDOC II Cryptosystem\", CRYPTO '90", "https://link.springer.com/chapter/10.1007/3-540-38424-3_38"),
        new LinkItem("Wikipedia: REDOC", "https://en.wikipedia.org/wiki/REDOC"),
        new LinkItem("US Patent 5,003,596 (Wood)", "https://patents.google.com/patent/US5003596A")
      ];

      this.references = [
        new LinkItem("REDOC II reference source (Michael Wood)", "https://www.schneier.com/wp-content/uploads/2015/03/REDOC2-2.zip")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Differential cryptanalysis", "Biham and Shamir attack one round with about 2300 encryptions and recover three masks of up to four rounds faster than exhaustive search; Cusick found another one-round attack.", "Use AES or another vetted cipher.", "https://www.cs.technion.ac.il/~biham/Reports/Weizmann/cs91-18.ps.gz")
      ];

      // Test vectors: Michael Wood's reference source compiled with the C
      // standard's reference rand() (see the notes above the constants).
      const uri = "https://www.schneier.com/wp-content/uploads/2015/03/REDOC2-2.zip";
      this.tests = [
        {
          text: "REDOC II reference - sample key and block of the reference source (\"ABCDEFGHIJ\")",
          uri: uri,
          input: OpCodes.Hex8ToBytes("4142434445464748494a"),
          key: OpCodes.Hex8ToBytes("724d3e0e5b71e9aa3898ffde1a9bd5f80c6d4e5f"),
          expected: OpCodes.Hex8ToBytes("d3e1b40d11f4c81224ca")
        },
        {
          text: "REDOC II reference - zero key, zero block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("00000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("f00bb85e8f9205917b57")
        },
        {
          text: "REDOC II reference - incrementing key and block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("00010203040506070809"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"),
          expected: OpCodes.Hex8ToBytes("98b8a06b23bf702b729e")
        },
        {
          text: "REDOC II reference - all-ones key and block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("ffffffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("cba888ddd1b273eb965e")
        },
        {
          text: "REDOC II reference - mixed key and block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c762e7160"),
          expected: OpCodes.Hex8ToBytes("0f78543ed2e217aaa2bf")
        },
        {
          text: "REDOC II reference - single set bit in the block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("80000000000000000000"),
          key: OpCodes.Hex8ToBytes("0123456789abcdeffedcba987654321000112233"),
          expected: OpCodes.Hex8ToBytes("d1d49c32755140ea71ca")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {REDOC2Instance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new REDOC2Instance(this, isInverse);
    }
  }

  /**
 * REDOC2 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class REDOC2Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {REDOC2Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = REDOC2_BLOCK_SIZE;
      this.KeySize = 0;
      /** @type {uint8[]|null} */
      this.keyTable = null;
      /** @type {uint8[]|null} */
      this.maskTable = null;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * @param {uint8[]|null} value - Key bytes, or null to clear
     */
    set key(value) {
      if (!value) {
        this._key = null;
        this.KeySize = 0;
        this.keyTable = null;
        this.maskTable = null;
        return;
      }

      if (value.length !== REDOC2_KEY_SIZE) {
        throw new Error('Invalid REDOC II key size: ' + value.length + ' bytes. Required: ' + REDOC2_KEY_SIZE + ' bytes.');
      }
      this._key = [...value]; // Copy the key
      this.KeySize = value.length;
      this.keyTable = this._buildKeyTable(this._key);
      this.maskTable = this._buildMaskTable(this.keyTable);
    }

    /**
     * Expand the key into the 256-row key table
     * @param {uint8[]} key - 20 key bytes
     * @returns {uint8[]} Key table
     */
    _buildKeyTable(key) {
      const tables = redoc2FunctionTables();
      /** @type {uint8[]} */
      const table = new Uint8Array(REDOC2_KEY_ROWS * REDOC2_BLOCK_SIZE);
      const x = key.slice(0, REDOC2_BLOCK_SIZE);
      const row = key.slice(REDOC2_BLOCK_SIZE, REDOC2_KEY_SIZE);
      for (let r = 0; r < REDOC2_KEY_ROWS; r++) {
        /** @type {uint8[]} */
        const s = new Array(REDOC2_BLOCK_SIZE);
        for (let i = 0; i < REDOC2_BLOCK_SIZE; i++) s[i] = OpCodes.Xor8(x[i], row[i]);
        const m = OpCodes.Xor8(s[4], s[5]);
        const n = OpCodes.Xor8(s[6], s[7]);
        const z = OpCodes.Xor8(OpCodes.Xor8(x[8], row[8]), OpCodes.ToByte(OpCodes.Add32(x[9], row[9])));

        redoc2Permute(tables.perm, n, row);
        redoc2Substitute(tables.sub, m % REDOC2_SUBSTITUTIONS, row, REDOC2_BLOCK_SIZE);
        redoc2Enclave(tables.encl, s[0], s[1], row, 0, true);
        redoc2Enclave(tables.encl, s[2], s[3], row, 5, true);
        redoc2Permute(tables.perm, z, x);

        for (let i = 0; i < REDOC2_BLOCK_SIZE; i++) table[r * REDOC2_BLOCK_SIZE + i] = row[i];
      }
      return table;
    }

    /**
     * XOR-fold the key table into the 10x10 mask table
     * @param {uint8[]} table - Key table
     * @returns {uint8[]} Mask table
     */
    _buildMaskTable(table) {
      /** @type {uint8[]} */
      const mask = new Uint8Array(REDOC2_MASK_SIZE);
      for (let i = 0; i < table.length; i++) {
        mask[i % REDOC2_MASK_SIZE] = OpCodes.Xor8(mask[i % REDOC2_MASK_SIZE], table[i]);
      }
      // The fold's last 40 entries lie past the key table, in mask bytes 0-39
      for (let i = table.length; i < REDOC2_MASK_FOLD; i++) {
        const target = i % REDOC2_MASK_SIZE;
        mask[target] = OpCodes.Xor8(mask[target], mask[i - table.length]);
      }
      return mask;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Feed expects byte array');
      }
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error('Key not set');
      }

      if (this.inputBuffer.length === 0) {
        throw new Error('No data fed');
      }
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");
      }

      /** @type {uint8[]} */
      const output = [];
      while (this.inputBuffer.length >= this.BlockSize) {
        const block = this.inputBuffer.splice(0, this.BlockSize);
        const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
        for (let _i = 0; _i < processed.length; _i++) output.push(processed[_i]);
      }
      return output;
    }

    /**
     * Mask byte k of round r
     * @param {int32} round - Round, 0 to 9
     * @param {int32} k - Mask row, 0 to 8
     * @returns {uint8} Mask byte
     */
    _mask(round, k) {
      return this.maskTable[k * REDOC2_BLOCK_SIZE + round];
    }

    /**
     * Data byte XOR mask byte, the selector of a table in round r
     * @param {uint8[]} data - Block bytes
     * @param {int32} index - Block byte
     * @param {int32} round - Round
     * @param {int32} k - Mask row
     * @returns {uint8} Selector
     */
    _select(data, index, round, k) {
      return OpCodes.Xor8(data[index], this._mask(round, k));
    }

    /**
     * XOR of all block bytes and the round's last mask byte
     * @param {uint8[]} data - Block bytes
     * @param {int32} round - Round
     * @returns {uint8} Permutation number
     */
    _permutationSelector(data, round) {
      let acc = this._mask(round, 8);
      for (let i = 0; i < REDOC2_BLOCK_SIZE; i++) acc = OpCodes.Xor8(acc, data[i]);
      return acc;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      const tables = redoc2FunctionTables();
      const data = block.slice();
      for (let r = 0; r < REDOC2_ROUNDS; r++) {
        const s1 = r;
        const s2 = (r + 1) % REDOC2_BLOCK_SIZE;
        const w = (r + 4) % 5;
        const z = (w + 1) % 5;
        redoc2Substitute(tables.sub, this._select(data, s1, r, 0) % REDOC2_SUBSTITUTIONS, data, s1);
        redoc2Substitute(tables.sub, this._select(data, s2, r, 1) % REDOC2_SUBSTITUTIONS, data, s2);
        redoc2KeyXor(this.keyTable, this._select(data, s1, r, 2), data, s1);
        redoc2Enclave(tables.encl, this._select(data, 5 + w, r, 3), this._select(data, 5 + z, r, 4), data, 0, true);
        redoc2Enclave(tables.encl, this._select(data, w, r, 5), this._select(data, z, r, 6), data, 5, true);
        redoc2KeyXor(this.keyTable, this._select(data, s2, r, 7), data, s2);
        redoc2Permute(tables.perm, this._permutationSelector(data, r), data);
      }
      return data;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      const tables = redoc2FunctionTables();
      const data = block.slice();
      for (let r = REDOC2_ROUNDS - 1; r >= 0; r--) {
        const s1 = r;
        const s2 = (r + 1) % REDOC2_BLOCK_SIZE;
        const w = (r + 4) % 5;
        const z = (w + 1) % 5;
        redoc2Unpermute(tables.perm, this._permutationSelector(data, r), data);
        redoc2KeyXor(this.keyTable, this._select(data, s2, r, 7), data, s2);
        redoc2Enclave(tables.encl, this._select(data, w, r, 5), this._select(data, z, r, 6), data, 5, false);
        redoc2Enclave(tables.encl, this._select(data, 5 + w, r, 3), this._select(data, 5 + z, r, 4), data, 0, false);
        redoc2KeyXor(this.keyTable, this._select(data, s1, r, 2), data, s1);
        redoc2Substitute(tables.inv, this._select(data, s2, r, 1) % REDOC2_SUBSTITUTIONS, data, s2);
        redoc2Substitute(tables.inv, this._select(data, s1, r, 0) % REDOC2_SUBSTITUTIONS, data, s1);
      }
      return data;
    }
  }

  // ===== REDOC III IMPLEMENTATION =====
  //
  // Follows Michael Wood's REDOC III reference source (REDOC3.ZIP of the
  // Applied Cryptography source distribution):
  //   - each pair of neighbouring key bytes (the last byte pairs with the
  //     first) seeds rand() and writes 2560 pseudorandom byte pairs into a
  //     2560-byte key table, walking it with a fixed odd-prime step
  //   - the key table is XOR-folded, 16 bytes at a time, into a 16-byte mask
  //   - each 8-byte block gets two passes (mask bytes 0-7, then 8-15): byte i,
  //     XORed with its mask byte, selects an 8-byte row of the key table that
  //     is XORed into every other block byte
  // rand() is the C standard's reference generator (multiplier 1103515245,
  // increment 12345, 15-bit result); the reference source was written for a
  // 16-bit int, so the seed is the 16-bit value of the two key bytes.

  /** @type {int32} */
  const REDOC3_TABLE_SIZE = 2560;
  /** @type {int32} */
  const REDOC3_BLOCK_SIZE = 8;
  /** @type {int32} */
  const REDOC3_MAX_KEY = 34;
  /** @type {uint32} */
  const REDOC3_RAND_MULT = 1103515245;
  /** @type {uint32} */
  const REDOC3_RAND_INC = 12345;
  // Table-walk step per key byte pair: 1 followed by the first 34 odd primes.
  /** @type {uint8[]} */
  const REDOC3_PRIMES = [1, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
                         73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149];

  /**
 * REDOC3Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class REDOC3Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "REDOC III";
      this.description = "Michael Wood's streamlined successor of REDOC II, built only from XORs: the key (1 to 34 bytes) seeds a 2560-byte key table that is folded into a 16-byte mask; two passes over the 8-byte block let each byte, masked, select a table row XORed into all other bytes. Follows Wood's reference source code, which processes 64-bit blocks; Applied Cryptography describes an 80-bit block.";
      this.inventor = "Michael Wood";
      this.year = 1985;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(1, REDOC3_MAX_KEY, 1)
      ];
      this.SupportedBlockSizes = [
        new KeySize(REDOC3_BLOCK_SIZE, REDOC3_BLOCK_SIZE, 0)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Applied Cryptography source code (REDOC3.ZIP by Michael Wood)", "https://www.schneier.com/books/applied-cryptography-source/"),
        new LinkItem("Wikipedia: REDOC", "https://en.wikipedia.org/wiki/REDOC"),
        new LinkItem("US Patent 5,003,596 (Wood)", "https://patents.google.com/patent/US5003596A")
      ];

      this.references = [
        new LinkItem("REDOC III reference source (Michael Wood)", "https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Differential cryptanalysis", "Ken Shirriff's differential attack recovers the key with about 2^20 chosen plaintexts and 2^30 memory.", "Use AES or another vetted cipher.", "https://en.wikipedia.org/wiki/REDOC")
      ];

      // Test vectors: Michael Wood's reference source compiled with the C
      // standard's reference rand(); the 32-byte-key vectors also match the
      // DarkCrypt Total Commander plugin's REDOC III on its first 8 bytes.
      const uri = "https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip";
      this.tests = [
        {
          text: "REDOC III reference - sample key of the reference source, zero block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("594280e7122b"),
          expected: OpCodes.Hex8ToBytes("d907f979f2477825")
        },
        {
          text: "REDOC III reference - 1-byte key (minimum)",
          uri: uri,
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("80"),
          expected: OpCodes.Hex8ToBytes("c96886528fbdd43e")
        },
        {
          text: "REDOC III reference - 16-byte key",
          uri: uri,
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          expected: OpCodes.Hex8ToBytes("ab6a95c7fc7fd581")
        },
        {
          text: "REDOC III reference - zero 32-byte key, zero block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("4f83a9591536d9bd")
        },
        {
          text: "REDOC III reference - incrementing 32-byte key and block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("731624c431837ac5")
        },
        {
          text: "REDOC III reference - all-ones 32-byte key and block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("3485b3877f608773")
        },
        {
          text: "REDOC III reference - 34-byte key (maximum)",
          uri: uri,
          input: OpCodes.Hex8ToBytes("fedcba9876543210"),
          key: OpCodes.Hex8ToBytes("e0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff0001"),
          expected: OpCodes.Hex8ToBytes("8c81eb7f3db7776e")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {REDOC3Instance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new REDOC3Instance(this, isInverse);
    }
  }

  /**
 * REDOC3 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class REDOC3Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {REDOC3Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = REDOC3_BLOCK_SIZE;
      this.KeySize = 0;
      /** @type {uint8[]|null} */
      this.keyTable = null;
      /** @type {uint8[]|null} */
      this.maskTable = null;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * @param {uint8[]|null} value - Key bytes, or null to clear
     */
    set key(value) {
      if (!value) {
        this._key = null;
        this.KeySize = 0;
        this.keyTable = null;
        this.maskTable = null;
        return;
      }

      if (value.length < 1 || value.length > REDOC3_MAX_KEY) {
        throw new Error('Invalid REDOC III key size: ' + value.length + ' bytes. Required: 1 to ' + REDOC3_MAX_KEY + ' bytes.');
      }
      this._key = [...value]; // Copy the key
      this.KeySize = value.length;
      this.keyTable = this._buildKeyTable(this._key);
      this.maskTable = this._buildMaskTable(this.keyTable);
    }

    /**
     * Fill the 2560-byte key table from the key byte pairs
     * @param {uint8[]} key - Key bytes
     * @returns {uint8[]} Key table
     */
    _buildKeyTable(key) {
      /** @type {uint8[]} */
      const table = new Uint8Array(REDOC3_TABLE_SIZE);
      const length = key.length;
      for (let pi = 1; pi <= length; pi++) {
        // Seed: low byte is key byte pi-1, high byte its successor (the last wraps to the first)
        const next = pi === length ? key[0] : key[pi];
        /** @type {uint32} */
        let seed = OpCodes.Or32(key[pi - 1], OpCodes.Shl32(next, 8));
        /** @type {int32} */
        const step = REDOC3_PRIMES[pi];
        /** @type {int32} */
        let point = 0;
        for (let i = 0; i < REDOC3_TABLE_SIZE; i++) {
          point += step;
          if (point >= REDOC3_TABLE_SIZE) point -= REDOC3_TABLE_SIZE;
          seed = OpCodes.ToUint32(OpCodes.Mul32(seed, REDOC3_RAND_MULT) + REDOC3_RAND_INC);
          const value = OpCodes.And32(OpCodes.Shr32(seed, 16), 0x7FFF);
          table[point] = OpCodes.And32(value, 0xFF);
          // Quirk of the reference: the high byte for position 2558 lands on position 0,
          // and the one for position 2559 falls outside the table.
          const high = OpCodes.Shr32(value, 8);
          if (point + 1 === REDOC3_TABLE_SIZE - 1) table[0] = high;
          else if (point + 1 < REDOC3_TABLE_SIZE) table[point + 1] = high;
        }
      }
      return table;
    }

    /**
     * XOR-fold the key table into the 16-byte mask table
     * @param {uint8[]} table - Key table
     * @returns {uint8[]} Mask table
     */
    _buildMaskTable(table) {
      /** @type {uint8[]} */
      const mask = new Uint8Array(16);
      for (let i = 0; i < REDOC3_TABLE_SIZE; i++) {
        mask[i % 16] = OpCodes.Xor8(mask[i % 16], table[i]);
      }
      return mask;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Feed expects byte array');
      }
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error('Key not set');
      }

      if (this.inputBuffer.length === 0) {
        throw new Error('No data fed');
      }
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");
      }

      /** @type {uint8[]} */
      const output = [];
      while (this.inputBuffer.length >= this.BlockSize) {
        const block = this.inputBuffer.splice(0, this.BlockSize);
        const processed = this._cryptBlock(block, !this.isInverse);
        for (let _i = 0; _i < processed.length; _i++) output.push(processed[_i]);
      }
      return output;
    }

    /**
     * Apply one masking step: block byte index, XORed with a mask byte,
     * selects the key-table row that is XORed into every other block byte
     * @param {uint8[]} data - Block bytes, changed in place
     * @param {int32} index - Selecting block byte
     * @param {uint8} maskByte - Mask byte for this step
     */
    _step(data, index, maskByte) {
      const row = OpCodes.Mul32(OpCodes.Xor8(data[index], maskByte), REDOC3_BLOCK_SIZE);
      for (let j = 0; j < REDOC3_BLOCK_SIZE; j++) {
        if (j !== index) data[j] = OpCodes.Xor8(data[j], this.keyTable[OpCodes.Add32(row, j)]);
      }
    }

    /**
     * @param {uint8[]} block - Input block
     * @param {boolean} encrypt - Encrypt (true) or decrypt (false)
     * @returns {uint8[]} Output block
     */
    _cryptBlock(block, encrypt) {
      const data = block.slice();
      const mask = this.maskTable;
      if (encrypt) {
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < REDOC3_BLOCK_SIZE; i++) this._step(data, i, mask[pass * REDOC3_BLOCK_SIZE + i]);
        }
      } else {
        // Each step leaves its selecting byte unchanged, so it undoes itself; run them backwards
        for (let pass = 1; pass >= 0; pass--) {
          for (let i = REDOC3_BLOCK_SIZE - 1; i >= 0; i--) this._step(data, i, mask[pass * REDOC3_BLOCK_SIZE + i]);
        }
      }
      return data;
    }
  }

  // ===== REGISTRATION =====

  const redoc2Instance = new REDOC2Algorithm();
  if (!AlgorithmFramework.Find(redoc2Instance.name)) {
    RegisterAlgorithm(redoc2Instance);
  }

  const redoc3Instance = new REDOC3Algorithm();
  if (!AlgorithmFramework.Find(redoc3Instance.name)) {
    RegisterAlgorithm(redoc3Instance);
  }

  // ===== EXPORTS =====

  return { REDOC2Algorithm, REDOC2Instance, REDOC3Algorithm, REDOC3Instance };
}));
