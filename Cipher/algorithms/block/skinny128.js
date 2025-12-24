/* SKINNY-128 Tweakable Block Cipher
 * Browser + Worker + Node (CJS/AMD-friendly) UMD
 * (c)2006-2025 Hawkynt
 *
 * SKINNY is a family of lightweight tweakable block ciphers designed for
 * resource-constrained environments. SKINNY-128 operates on 128-bit blocks
 * with tweakey sizes of 128, 256, or 384 bits.
 *
 * Specification: https://eprint.iacr.org/2016/660.pdf
 * Designers: Christof Beierle, Jérémy Jean, Stefan Kölbl, Gregor Leander,
 *            Amir Moradi, Thomas Peyrin, Yu Sasaki, Pascal Sasdrich, Siang Meng Sim
 * Year: 2016
 *
 * Used in NIST lightweight cryptography finalist Romulus.
 */

(function(global) {
  'use strict';

  // Load AlgorithmFramework
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }

  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  const OpCodes = global.OpCodes;

  // ============================================================================
  // SKINNY-128 S-box and Helper Functions
  // ============================================================================

  /**
   * Apply SKINNY-128 S-box to all bytes in a 32-bit word
   * This is a highly optimized bit-sliced implementation
   */
  function skinny128_sbox(x) {
    x = OpCodes.ToUint32(x);
    let y;

    // Mix the bits (bit-sliced S-box operations)
    x = ~x;
    x = OpCodes.Xor32(x, (((OpCodes.Shr32(x, 2))&(OpCodes.Shr32(x, 3)))&0x11111111));
    y = (((OpCodes.Shl32(x, 5))&(OpCodes.Shl32(x, 1)))&0x20202020);
    x = OpCodes.Xor32(x, OpCodes.Xor32((((OpCodes.Shl32(x, 5))&(OpCodes.Shl32(x, 4)))&0x40404040), y));
    y = (((OpCodes.Shl32(x, 2))&(OpCodes.Shl32(x, 1)))&0x80808080);
    x = OpCodes.Xor32(x, OpCodes.Xor32((((OpCodes.Shr32(x, 2))&(OpCodes.Shl32(x, 1)))&0x02020202), y));
    y = (((OpCodes.Shr32(x, 5))&(OpCodes.Shl32(x, 1)))&0x04040404);
    x = OpCodes.Xor32(x, OpCodes.Xor32((((OpCodes.Shr32(x, 1))&(OpCodes.Shr32(x, 2)))&0x08080808), y));
    x = ~x;

    // Final permutation [2 7 6 1 3 0 4 5]
    x = (OpCodes.Shl32((x&0x08080808), 1)|OpCodes.Shl32((x&0x32323232), 2)|OpCodes.Shl32((x&0x01010101), 5)|OpCodes.Shr32((x&0x80808080), 6)|OpCodes.Shr32((x&0x40404040), 4)|OpCodes.Shr32((x&0x04040404), 2));

    return x;
  }

  /**
   * Apply inverse SKINNY-128 S-box to all bytes in a 32-bit word
   */
  function skinny128_inv_sbox(x) {
    x = OpCodes.ToUint32(x);
    let y;

    // Mix the bits (inverse bit-sliced S-box operations)
    x = ~x;
    y = (((OpCodes.Shr32(x, 1))&(OpCodes.Shr32(x, 3)))&0x01010101);
    x = OpCodes.Xor32(x, OpCodes.Xor32((((OpCodes.Shr32(x, 2))&(OpCodes.Shr32(x, 3)))&0x10101010), y));
    y = (((OpCodes.Shr32(x, 6))&(OpCodes.Shr32(x, 1)))&0x02020202);
    x = OpCodes.Xor32(x, OpCodes.Xor32((((OpCodes.Shr32(x, 1))&(OpCodes.Shr32(x, 2)))&0x08080808), y));
    y = (((OpCodes.Shl32(x, 2))&(OpCodes.Shl32(x, 1)))&0x80808080);
    x = OpCodes.Xor32(x, OpCodes.Xor32((((OpCodes.Shr32(x, 1))&(OpCodes.Shl32(x, 2)))&0x04040404), y));
    y = (((OpCodes.Shl32(x, 5))&(OpCodes.Shl32(x, 1)))&0x20202020);
    x = OpCodes.Xor32(x, OpCodes.Xor32((((OpCodes.Shl32(x, 4))&(OpCodes.Shl32(x, 5)))&0x40404040), y));
    x = ~x;

    // Final permutation [5 3 0 4 6 7 2 1]
    x = (OpCodes.Shl32((x&0x01010101), 2)|OpCodes.Shl32((x&0x04040404), 4)|OpCodes.Shl32((x&0x02020202), 6)|OpCodes.Shr32((x&0x20202020), 5)|OpCodes.Shr32((x&0xC8C8C8C8), 2)|OpCodes.Shr32((x&0x10101010), 1));

    return x;
  }

  /**
   * LFSR2 - Linear feedback shift register for TK2 update
   * Applied to each byte independently
   */
  function skinny128_LFSR2(x) {
    x = OpCodes.ToUint32(x);
    const shifted = (OpCodes.Shl32(x, 1))&0xFEFEFEFE;
    const feedback = OpCodes.Xor32(OpCodes.Shr32(x, 7), OpCodes.Shr32(x, 5))&0x01010101;
    return OpCodes.Xor32(shifted, feedback);
  }

  /**
   * LFSR3 - Linear feedback shift register for TK3 update
   * Applied to each byte independently (inverse of LFSR2)
   */
  function skinny128_LFSR3(x) {
    x = OpCodes.ToUint32(x);
    const shifted = (OpCodes.Shr32(x, 1))&0x7F7F7F7F;
    const feedback = OpCodes.Xor32(OpCodes.Shl32(x, 7), OpCodes.Shl32(x, 1))&0x80808080;
    return OpCodes.Xor32(shifted, feedback);
  }

  /**
   * Permute half of the tweakey state in-place
   * PT = [9, 15, 8, 13, 10, 14, 12, 11, 0, 1, 2, 3, 4, 5, 6, 7]
   * This modifies the array in-place at the specified index
   */
  function skinny128_permute_tk_half(tk, idx) {
    const row2 = tk[idx];
    const row3 = tk[idx + 1];
    const row3_rotated = OpCodes.RotL32(row3, 16);

    tk[idx] = (((OpCodes.Shr32(row2, 8))&0x000000FF)|((OpCodes.Shl32(row2, 16))&0x00FF0000)|(row3_rotated&0xFF00FF00));

    tk[idx + 1] = (((OpCodes.Shr32(row2, 16))&0x000000FF)|(row2&0xFF000000)|((OpCodes.Shl32(row3_rotated, 8))&0x0000FF00)|(row3_rotated&0x00FF0000));
  }

  /**
   * Inverse permute half of the tweakey state
   * PT' = [8, 9, 10, 11, 12, 13, 14, 15, 2, 0, 4, 7, 6, 3, 5, 1]
   */
  function skinny128_inv_permute_tk_half(tk, idx) {
    const row0 = tk[idx];
    const row1 = tk[idx + 1];

    tk[idx] = (((OpCodes.Shr32(row0, 16))&0x000000FF)|((OpCodes.Shl32(row0, 8))&0x0000FF00)|((OpCodes.Shl32(row1, 16))&0x00FF0000)|(row1&0xFF000000));

    tk[idx + 1] = (((OpCodes.Shr32(row0, 16))&0x0000FF00)|((OpCodes.Shl32(row0, 16))&0xFF000000)|((OpCodes.Shr32(row1, 16))&0x000000FF)|((OpCodes.Shl32(row1, 8))&0x00FF0000));
  }

  /**
   * Fast-forward TK1 to the end of the key schedule for decryption
   * Applies permutation 8 times (for 40 and 56 round variants)
   */
  function skinny128_fast_forward_tk(tk) {
    const row0 = tk[0];
    const row1 = tk[1];
    const row2 = tk[2];
    const row3 = tk[3];

    tk[0] = (((OpCodes.Shr32(row1, 8))&0x0000FFFF)|((OpCodes.Shr32(row0, 8))&0x00FF0000)|((OpCodes.Shl32(row0, 8))&0xFF000000));

    tk[1] = (((OpCodes.Shr32(row1, 24))&0x000000FF)|((OpCodes.Shl32(row0, 8))&0x00FFFF00)|((OpCodes.Shl32(row1, 24))&0xFF000000));

    tk[2] = (((OpCodes.Shr32(row3, 8))&0x0000FFFF)|((OpCodes.Shr32(row2, 8))&0x00FF0000)|((OpCodes.Shl32(row2, 8))&0xFF000000));

    tk[3] = (((OpCodes.Shr32(row3, 24))&0x000000FF)|((OpCodes.Shl32(row2, 8))&0x00FFFF00)|((OpCodes.Shl32(row3, 24))&0xFF000000));
  }

  // ============================================================================
  // SKINNY-128 Algorithm Classes
  // ============================================================================

  /**
 * SKINNY128Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class SKINNY128Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = 'SKINNY-128';
      this.description = 'A family of lightweight tweakable block ciphers designed for resource-constrained environments. Features efficient hardware and software implementations with strong security guarantees. Used in the Romulus AEAD scheme (NIST LWC finalist).';
      this.inventor = 'Beierle, Jean, Kölbl, Leander, Moradi, Peyrin, Sasaki, Sasdrich, Sim';
      this.year = 2016;
      this.category = CategoryType.BLOCK;
      this.subCategory = 'Tweakable Block Cipher';
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // SKINNY-128 supports 128-bit blocks with 128/256/384-bit tweakeys
      this.SupportedKeySizes = [
        new KeySize(16, 16, 1),  // SKINNY-128-128 (40 rounds)
        new KeySize(32, 32, 1),  // SKINNY-128-256 (48 rounds)
        new KeySize(48, 48, 1)   // SKINNY-128-384 (56 rounds)
      ];
      this.SupportedBlockSizes = [new KeySize(16, 16, 1)];

      this.documentation = [
        new LinkItem('SKINNY Specification (ePrint)', 'https://eprint.iacr.org/2016/660.pdf'),
        new LinkItem('SKINNY Official Website', 'https://sites.google.com/site/skinnycipher/'),
        new LinkItem('Romulus AEAD (NIST LWC)', 'https://romulusae.github.io/romulus/')
      ];

      this.references = [
        new LinkItem('SKINNY Paper (CRYPTO 2016)', 'https://eprint.iacr.org/2016/660'),
        new LinkItem('Reference Implementation', 'https://github.com/rweather/lightweight-crypto')
      ];

      // Official test vectors from SKINNY specification paper
      this.tests = [
        // SKINNY-128-256 test vector
        {
          text: 'SKINNY-128-256 Official Test Vector',
          uri: 'https://eprint.iacr.org/2016/660.pdf',
          input: OpCodes.Hex8ToBytes('3a0c47767a26a68dd382a695e7022e25'),
          key: OpCodes.Hex8ToBytes('009cec81605d4ac1d2ae9e3085d7a1f31ac123ebfc00fddcf01046ceeddfcab3'),
          expected: OpCodes.Hex8ToBytes('b731d98a4bde147a7ed4a6f16b9b587f')
        },
        // SKINNY-128-384 test vector
        {
          text: 'SKINNY-128-384 Official Test Vector',
          uri: 'https://eprint.iacr.org/2016/660.pdf',
          input: OpCodes.Hex8ToBytes('a3994b66ad85a3459f44e92b08f550cb'),
          key: OpCodes.Hex8ToBytes('df889548cfc7ea52d296339301797449ab588a34a47f1ab2dfe9c8293fbea9a5ab1afac2611012cd8cef952618c3ebe8'),
          expected: OpCodes.Hex8ToBytes('94ecf589e2017c601b38c6346a10dcfa')
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SKINNY128Instance(this, isInverse);
    }
  }

  // ============================================================================
  // SKINNY-128 Instance Implementation
  // ============================================================================

  /**
 * SKINNY128 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SKINNY128Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this.keySchedule = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.keySchedule = null;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Must be 16, 32, or 48 bytes.`);
      }

      this._key = [...keyBytes];
      this.keySchedule = this._expandKey(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * Expand key into round keys (key schedule)
     */
    _expandKey(keyBytes) {
      const keySize = keyBytes.length;
      let rounds;

      if (keySize === 16) {
        rounds = 40;  // SKINNY-128-128
      } else if (keySize === 32) {
        rounds = 48;  // SKINNY-128-256
      } else {
        rounds = 56;  // SKINNY-128-384
      }

      const schedule = {
        rounds: rounds,
        TK1: new Array(4),
        roundKeys: []
      };

      // Load TK1 (first 16 bytes)
      schedule.TK1[0] = OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]);
      schedule.TK1[1] = OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]);
      schedule.TK1[2] = OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]);
      schedule.TK1[3] = OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15]);

      if (keySize >= 32) {
        // Pre-compute TK2 schedule for SKINNY-128-256 and SKINNY-128-384
        const TK2 = new Array(4);
        TK2[0] = OpCodes.Pack32LE(keyBytes[16], keyBytes[17], keyBytes[18], keyBytes[19]);
        TK2[1] = OpCodes.Pack32LE(keyBytes[20], keyBytes[21], keyBytes[22], keyBytes[23]);
        TK2[2] = OpCodes.Pack32LE(keyBytes[24], keyBytes[25], keyBytes[26], keyBytes[27]);
        TK2[3] = OpCodes.Pack32LE(keyBytes[28], keyBytes[29], keyBytes[30], keyBytes[31]);

        if (keySize === 48) {
          // Pre-compute TK3 schedule for SKINNY-128-384
          const TK3 = new Array(4);
          TK3[0] = OpCodes.Pack32LE(keyBytes[32], keyBytes[33], keyBytes[34], keyBytes[35]);
          TK3[1] = OpCodes.Pack32LE(keyBytes[36], keyBytes[37], keyBytes[38], keyBytes[39]);
          TK3[2] = OpCodes.Pack32LE(keyBytes[40], keyBytes[41], keyBytes[42], keyBytes[43]);
          TK3[3] = OpCodes.Pack32LE(keyBytes[44], keyBytes[45], keyBytes[46], keyBytes[47]);

          // Generate round keys for SKINNY-128-384
          let rc = 0;
          for (let round = 0; round < rounds; round += 2) {
            // Round 1
            rc = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(rc, 1), (OpCodes.Shr32(rc, 5)&0x01)), (OpCodes.Shr32(rc, 4)&0x01)), 0x01)&0x3F;
            schedule.roundKeys.push({
              tk0: OpCodes.Xor32(OpCodes.Xor32(TK2[0], TK3[0]), (rc&0x0F)),
              tk1: OpCodes.Xor32(OpCodes.Xor32(TK2[1], TK3[1]), OpCodes.Shr32(rc, 4))
            });

            // Permute bottom half and apply LFSR
            skinny128_permute_tk_half(TK2, 2);
            skinny128_permute_tk_half(TK3, 2);
            TK2[2] = skinny128_LFSR2(TK2[2]);
            TK2[3] = skinny128_LFSR2(TK2[3]);
            TK3[2] = skinny128_LFSR3(TK3[2]);
            TK3[3] = skinny128_LFSR3(TK3[3]);

            // Round 2
            rc = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(rc, 1), (OpCodes.Shr32(rc, 5)&0x01)), (OpCodes.Shr32(rc, 4)&0x01)), 0x01)&0x3F;
            schedule.roundKeys.push({
              tk0: OpCodes.Xor32(OpCodes.Xor32(TK2[2], TK3[2]), (rc&0x0F)),
              tk1: OpCodes.Xor32(OpCodes.Xor32(TK2[3], TK3[3]), OpCodes.Shr32(rc, 4))
            });

            // Permute top half and apply LFSR
            skinny128_permute_tk_half(TK2, 0);
            skinny128_permute_tk_half(TK3, 0);
            TK2[0] = skinny128_LFSR2(TK2[0]);
            TK2[1] = skinny128_LFSR2(TK2[1]);
            TK3[0] = skinny128_LFSR3(TK3[0]);
            TK3[1] = skinny128_LFSR3(TK3[1]);
          }
        } else {
          // Generate round keys for SKINNY-128-256
          let rc = 0;
          for (let round = 0; round < rounds; round += 2) {
            // Round 1
            rc = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(rc, 1), (OpCodes.Shr32(rc, 5)&0x01)), (OpCodes.Shr32(rc, 4)&0x01)), 0x01)&0x3F;
            schedule.roundKeys.push({
              tk0: OpCodes.Xor32(TK2[0], (rc&0x0F)),
              tk1: OpCodes.Xor32(TK2[1], OpCodes.Shr32(rc, 4))
            });

            // Permute bottom half and apply LFSR
            skinny128_permute_tk_half(TK2, 2);
            TK2[2] = skinny128_LFSR2(TK2[2]);
            TK2[3] = skinny128_LFSR2(TK2[3]);

            // Round 2
            rc = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(rc, 1), (OpCodes.Shr32(rc, 5)&0x01)), (OpCodes.Shr32(rc, 4)&0x01)), 0x01)&0x3F;
            schedule.roundKeys.push({
              tk0: OpCodes.Xor32(TK2[2], (rc&0x0F)),
              tk1: OpCodes.Xor32(TK2[3], OpCodes.Shr32(rc, 4))
            });

            // Permute top half and apply LFSR
            skinny128_permute_tk_half(TK2, 0);
            TK2[0] = skinny128_LFSR2(TK2[0]);
            TK2[1] = skinny128_LFSR2(TK2[1]);
          }
        }
      }

      return schedule;
    }

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

      const blockSize = 16;
      const output = [];

      // Process complete blocks
      while (this.inputBuffer.length >= blockSize) {
        const block = this.inputBuffer.splice(0, blockSize);
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      return output;
    }

    /**
     * Encrypt a single 16-byte block
     */
    _encryptBlock(block) {
      // Load state
      let s0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let s1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let s2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let s3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      // Make a local copy of TK1
      const TK1 = [...this.keySchedule.TK1];
      const rounds = this.keySchedule.rounds;
      const hasRoundKeys = this.keySchedule.roundKeys.length > 0;

      // Perform all encryption rounds (4 at a time due to word rotation pattern)
      for (let round = 0; round < rounds; round += 4) {
        // Round 1 (state pattern: s0, s1, s2, s3)
        s0 = skinny128_sbox(s0);
        s1 = skinny128_sbox(s1);
        s2 = skinny128_sbox(s2);
        s3 = skinny128_sbox(s3);

        if (hasRoundKeys) {
          const rk = this.keySchedule.roundKeys[round];
          s0 = OpCodes.Xor32(OpCodes.Xor32(s0, rk.tk0), TK1[0]);
          s1 = OpCodes.Xor32(OpCodes.Xor32(s1, rk.tk1), TK1[1]);
        } else {
          s0 = OpCodes.Xor32(s0, TK1[0]);
          s1 = OpCodes.Xor32(s1, TK1[1]);
        }
        s2 = OpCodes.Xor32(s2, 0x02);

        s1 = OpCodes.RotL32(s1, 8);
        s2 = OpCodes.RotL32(s2, 16);
        s3 = OpCodes.RotL32(s3, 24);

        s1 = OpCodes.Xor32(s1, s2);
        s2 = OpCodes.Xor32(s2, s0);
        s3 = OpCodes.Xor32(s3, s2);

        skinny128_permute_tk_half(TK1, 2);

        // Round 2 (state pattern: s3, s0, s1, s2)
        s3 = skinny128_sbox(s3);
        s0 = skinny128_sbox(s0);
        s1 = skinny128_sbox(s1);
        s2 = skinny128_sbox(s2);

        if (hasRoundKeys) {
          const rk = this.keySchedule.roundKeys[round + 1];
          s3 = OpCodes.Xor32(OpCodes.Xor32(s3, rk.tk0), TK1[2]);
          s0 = OpCodes.Xor32(OpCodes.Xor32(s0, rk.tk1), TK1[3]);
        } else {
          s3 = OpCodes.Xor32(s3, TK1[2]);
          s0 = OpCodes.Xor32(s0, TK1[3]);
        }
        s1 = OpCodes.Xor32(s1, 0x02);

        s0 = OpCodes.RotL32(s0, 8);
        s1 = OpCodes.RotL32(s1, 16);
        s2 = OpCodes.RotL32(s2, 24);

        s0 = OpCodes.Xor32(s0, s1);
        s1 = OpCodes.Xor32(s1, s3);
        s2 = OpCodes.Xor32(s2, s1);

        skinny128_permute_tk_half(TK1, 0);

        // Round 3 (state pattern: s2, s3, s0, s1)
        s2 = skinny128_sbox(s2);
        s3 = skinny128_sbox(s3);
        s0 = skinny128_sbox(s0);
        s1 = skinny128_sbox(s1);

        if (hasRoundKeys) {
          const rk = this.keySchedule.roundKeys[round + 2];
          s2 = OpCodes.Xor32(OpCodes.Xor32(s2, rk.tk0), TK1[0]);
          s3 = OpCodes.Xor32(OpCodes.Xor32(s3, rk.tk1), TK1[1]);
        } else {
          s2 = OpCodes.Xor32(s2, TK1[0]);
          s3 = OpCodes.Xor32(s3, TK1[1]);
        }
        s0 = OpCodes.Xor32(s0, 0x02);

        s3 = OpCodes.RotL32(s3, 8);
        s0 = OpCodes.RotL32(s0, 16);
        s1 = OpCodes.RotL32(s1, 24);

        s3 = OpCodes.Xor32(s3, s0);
        s0 = OpCodes.Xor32(s0, s2);
        s1 = OpCodes.Xor32(s1, s0);

        skinny128_permute_tk_half(TK1, 2);

        // Round 4 (state pattern: s1, s2, s3, s0)
        s1 = skinny128_sbox(s1);
        s2 = skinny128_sbox(s2);
        s3 = skinny128_sbox(s3);
        s0 = skinny128_sbox(s0);

        if (hasRoundKeys) {
          const rk = this.keySchedule.roundKeys[round + 3];
          s1 = OpCodes.Xor32(OpCodes.Xor32(s1, rk.tk0), TK1[2]);
          s2 = OpCodes.Xor32(OpCodes.Xor32(s2, rk.tk1), TK1[3]);
        } else {
          s1 = OpCodes.Xor32(s1, TK1[2]);
          s2 = OpCodes.Xor32(s2, TK1[3]);
        }
        s3 = OpCodes.Xor32(s3, 0x02);

        s2 = OpCodes.RotL32(s2, 8);
        s3 = OpCodes.RotL32(s3, 16);
        s0 = OpCodes.RotL32(s0, 24);

        s2 = OpCodes.Xor32(s2, s3);
        s3 = OpCodes.Xor32(s3, s1);
        s0 = OpCodes.Xor32(s0, s3);

        skinny128_permute_tk_half(TK1, 0);
      }

      // Pack result
      const result = new Array(16);
      const s0_bytes = OpCodes.Unpack32LE(s0);
      const s1_bytes = OpCodes.Unpack32LE(s1);
      const s2_bytes = OpCodes.Unpack32LE(s2);
      const s3_bytes = OpCodes.Unpack32LE(s3);

      result[0] = s0_bytes[0]; result[1] = s0_bytes[1];
      result[2] = s0_bytes[2]; result[3] = s0_bytes[3];
      result[4] = s1_bytes[0]; result[5] = s1_bytes[1];
      result[6] = s1_bytes[2]; result[7] = s1_bytes[3];
      result[8] = s2_bytes[0]; result[9] = s2_bytes[1];
      result[10] = s2_bytes[2]; result[11] = s2_bytes[3];
      result[12] = s3_bytes[0]; result[13] = s3_bytes[1];
      result[14] = s3_bytes[2]; result[15] = s3_bytes[3];

      return result;
    }

    /**
     * Decrypt a single 16-byte block
     * Following the exact C reference implementation pattern
     */
    _decryptBlock(block) {
      // Load state
      let s0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let s1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let s2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let s3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      // Make a local copy of TK1 and fast-forward to end for decryption
      const TK1 = [...this.keySchedule.TK1];
      const rounds = this.keySchedule.rounds;
      const hasRoundKeys = this.keySchedule.roundKeys.length > 0;

      // Fast-forward TK1 for decryption (only needed for 40 and 56 round variants)
      if (rounds !== 48) {
        skinny128_fast_forward_tk(TK1);
      }

      // Perform all decryption rounds (4 at a time, in reverse order)
      // C reference uses pattern: (s0,s1,s2,s3), (s1,s2,s3,s0), (s2,s3,s0,s1), (s3,s0,s1,s2)
      for (let round = rounds - 1; round >= 0; round -= 4) {
        // Round 4 inverse (C pattern: s0, s1, s2, s3 with offset 3)
        skinny128_inv_permute_tk_half(TK1, 2);

        // Inverse MixColumns
        s0 = OpCodes.Xor32(s0, s3);
        s3 = OpCodes.Xor32(s3, s1);
        s2 = OpCodes.Xor32(s2, s3);

        // Inverse ShiftRows
        s2 = OpCodes.RotL32(s2, 24);
        s3 = OpCodes.RotL32(s3, 16);
        s0 = OpCodes.RotL32(s0, 8);

        // Remove round tweakey
        if (hasRoundKeys) {
          const rk = this.keySchedule.roundKeys[round];
          s1 = OpCodes.Xor32(OpCodes.Xor32(s1, rk.tk0), TK1[2]);
          s2 = OpCodes.Xor32(OpCodes.Xor32(s2, rk.tk1), TK1[3]);
        } else {
          s1 = OpCodes.Xor32(s1, TK1[2]);
          s2 = OpCodes.Xor32(s2, TK1[3]);
        }
        s3 = OpCodes.Xor32(s3, 0x02);

        // Inverse S-box
        s0 = skinny128_inv_sbox(s0);
        s1 = skinny128_inv_sbox(s1);
        s2 = skinny128_inv_sbox(s2);
        s3 = skinny128_inv_sbox(s3);

        // Round 3 inverse (C pattern: s1, s2, s3, s0 with offset 2)
        skinny128_inv_permute_tk_half(TK1, 0);

        s1 = OpCodes.Xor32(s1, s0);
        s0 = OpCodes.Xor32(s0, s2);
        s3 = OpCodes.Xor32(s3, s0);

        s3 = OpCodes.RotL32(s3, 24);
        s0 = OpCodes.RotL32(s0, 16);
        s1 = OpCodes.RotL32(s1, 8);

        if (hasRoundKeys) {
          const rk = this.keySchedule.roundKeys[round - 1];
          s2 = OpCodes.Xor32(OpCodes.Xor32(s2, rk.tk0), TK1[0]);
          s3 = OpCodes.Xor32(OpCodes.Xor32(s3, rk.tk1), TK1[1]);
        } else {
          s2 = OpCodes.Xor32(s2, TK1[0]);
          s3 = OpCodes.Xor32(s3, TK1[1]);
        }
        s0 = OpCodes.Xor32(s0, 0x02);

        s1 = skinny128_inv_sbox(s1);
        s2 = skinny128_inv_sbox(s2);
        s3 = skinny128_inv_sbox(s3);
        s0 = skinny128_inv_sbox(s0);

        // Round 2 inverse (C pattern: s2, s3, s0, s1 with offset 1)
        skinny128_inv_permute_tk_half(TK1, 2);

        s2 = OpCodes.Xor32(s2, s1);
        s1 = OpCodes.Xor32(s1, s3);
        s0 = OpCodes.Xor32(s0, s1);

        s0 = OpCodes.RotL32(s0, 24);
        s1 = OpCodes.RotL32(s1, 16);
        s2 = OpCodes.RotL32(s2, 8);

        if (hasRoundKeys) {
          const rk = this.keySchedule.roundKeys[round - 2];
          s3 = OpCodes.Xor32(OpCodes.Xor32(s3, rk.tk0), TK1[2]);
          s0 = OpCodes.Xor32(OpCodes.Xor32(s0, rk.tk1), TK1[3]);
        } else {
          s3 = OpCodes.Xor32(s3, TK1[2]);
          s0 = OpCodes.Xor32(s0, TK1[3]);
        }
        s1 = OpCodes.Xor32(s1, 0x02);

        s2 = skinny128_inv_sbox(s2);
        s3 = skinny128_inv_sbox(s3);
        s0 = skinny128_inv_sbox(s0);
        s1 = skinny128_inv_sbox(s1);

        // Round 1 inverse (C pattern: s3, s0, s1, s2 with offset 0)
        skinny128_inv_permute_tk_half(TK1, 0);

        s3 = OpCodes.Xor32(s3, s2);
        s2 = OpCodes.Xor32(s2, s0);
        s1 = OpCodes.Xor32(s1, s2);

        s1 = OpCodes.RotL32(s1, 24);
        s2 = OpCodes.RotL32(s2, 16);
        s3 = OpCodes.RotL32(s3, 8);

        if (hasRoundKeys) {
          const rk = this.keySchedule.roundKeys[round - 3];
          s0 = OpCodes.Xor32(OpCodes.Xor32(s0, rk.tk0), TK1[0]);
          s1 = OpCodes.Xor32(OpCodes.Xor32(s1, rk.tk1), TK1[1]);
        } else {
          s0 = OpCodes.Xor32(s0, TK1[0]);
          s1 = OpCodes.Xor32(s1, TK1[1]);
        }
        s2 = OpCodes.Xor32(s2, 0x02);

        s3 = skinny128_inv_sbox(s3);
        s0 = skinny128_inv_sbox(s0);
        s1 = skinny128_inv_sbox(s1);
        s2 = skinny128_inv_sbox(s2);
      }

      // Pack result
      const result = new Array(16);
      const s0_bytes = OpCodes.Unpack32LE(s0);
      const s1_bytes = OpCodes.Unpack32LE(s1);
      const s2_bytes = OpCodes.Unpack32LE(s2);
      const s3_bytes = OpCodes.Unpack32LE(s3);

      result[0] = s0_bytes[0]; result[1] = s0_bytes[1];
      result[2] = s0_bytes[2]; result[3] = s0_bytes[3];
      result[4] = s1_bytes[0]; result[5] = s1_bytes[1];
      result[6] = s1_bytes[2]; result[7] = s1_bytes[3];
      result[8] = s2_bytes[0]; result[9] = s2_bytes[1];
      result[10] = s2_bytes[2]; result[11] = s2_bytes[3];
      result[12] = s3_bytes[0]; result[13] = s3_bytes[1];
      result[14] = s3_bytes[2]; result[15] = s3_bytes[3];

      return result;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new SKINNY128Algorithm());

  // Export for Node.js/CommonJS
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SKINNY128Algorithm, SKINNY128Instance };
  }

})(typeof globalThis !== 'undefined' ? globalThis :
   typeof window !== 'undefined' ? window :
   typeof global !== 'undefined' ? global :
   typeof self !== 'undefined' ? self : this);
