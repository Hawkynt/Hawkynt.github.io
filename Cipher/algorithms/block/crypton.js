/*
 * Crypton Block Cipher Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * Korean AES candidate with 128-bit blocks and 128/192/256-bit keys.
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

  /** @type {uint8[][]} */
  const PBOX = [
    new Uint8Array([15, 9, 6, 8, 9, 9, 4, 12, 6, 2, 6, 10, 1, 3, 5, 15]),
    new Uint8Array([10, 15, 4, 7, 5, 2, 14, 6, 9, 3, 12, 8, 13, 1, 11, 0]),
    new Uint8Array([0, 4, 8, 4, 2, 15, 8, 13, 1, 1, 15, 7, 2, 11, 14, 15])
  ];
  Object.freeze(PBOX);

  const MA = new Uint32Array([0x3fcff3fc, 0xfc3fcff3, 0xf3fc3fcf, 0xcff3fc3f]);
  const MB = new Uint32Array([0xcffccffc, 0xf33ff33f, 0xfccffccf, 0x3ff33ff3]);
  const KP = new Uint32Array([0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f]);
  const KQ = new Uint32Array([0x9b05688c, 0x1f83d9ab, 0x5be0cd19, 0xcbbb9d5d]);

  /** @type {uint8[][]} */
  const SBox = [new Uint8Array(256), new Uint8Array(256)];
  /** @type {uint32[][]} */
  const MixTables = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];

  /**
   * Fill the S-boxes and the four mix tables (once, at load time)
   * @returns {boolean} Always true
   */
  function generateTables() {
    for (let i = 0; i < 256; i++) {
      const xl = OpCodes.Shr32(OpCodes.And32(i, 0xf0), 4);
      const xr = OpCodes.And32(i, 0x0f);
      const yr = OpCodes.Xor32(xr, PBOX[1][OpCodes.Xor32(xl, PBOX[0][xr])]);
      const yl = OpCodes.Xor32(OpCodes.Xor32(xl, PBOX[0][xr]), PBOX[2][yr]);
      const yCombined = OpCodes.And32(OpCodes.Or32(yr, OpCodes.Shl32(yl, 4)), 0xff);

      SBox[0][i] = yCombined;
      SBox[1][yCombined] = i;

      const xrWord = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(yCombined, OpCodes.Shl32(yCombined, 8)), OpCodes.Shl32(yCombined, 16)), OpCodes.Shl32(yCombined, 24)));
      const xlWord = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(i, OpCodes.Shl32(i, 8)), OpCodes.Shl32(i, 16)), OpCodes.Shl32(i, 24)));

      MixTables[0][i] = OpCodes.And32(xrWord, MA[0]);
      MixTables[1][yCombined] = OpCodes.And32(xlWord, MA[1]);
      MixTables[2][i] = OpCodes.And32(xrWord, MA[2]);
      MixTables[3][yCombined] = OpCodes.And32(xlWord, MA[3]);
    }
    return true;
  }

  const TABLES_READY = generateTables();

  /**
   * @param {uint32[]} words - Four words
   * @param {int32} n0 - Mask index for word 0
   * @param {int32} n1 - Mask index for word 1
   * @param {int32} n2 - Mask index for word 2
   * @param {int32} n3 - Mask index for word 3
   * @returns {uint32} Masked combination
   */
  function piMix(words, n0, n1, n2, n3) {
    return OpCodes.ToUint32(
      OpCodes.Xor32(
        OpCodes.Xor32(
          OpCodes.Xor32(OpCodes.And32(words[0], MA[n0]), OpCodes.And32(words[1], MA[n1])),
          OpCodes.And32(words[2], MA[n2])
        ),
        OpCodes.And32(words[3], MA[n3])
      )
    );
  }

  /**
   * @param {uint32} word - Word
   * @param {int32} n0 - Mask index for the unrotated word
   * @param {int32} n1 - Mask index for the word rotated by 8
   * @param {int32} n2 - Mask index for the word rotated by 16
   * @param {int32} n3 - Mask index for the word rotated by 24
   * @returns {uint32} Mixed word
   */
  function phiN(word, n0, n1, n2, n3) {
    return OpCodes.ToUint32(
      OpCodes.Xor32(
        OpCodes.Xor32(
          OpCodes.Xor32(OpCodes.And32(word, MB[n0]), OpCodes.And32(OpCodes.RotL32(word, 8), MB[n1])),
          OpCodes.And32(OpCodes.RotL32(word, 16), MB[n2])
        ),
        OpCodes.And32(OpCodes.RotL32(word, 24), MB[n3])
      )
    );
  }

  /**
   * @param {uint32[]} src - Four input words
   * @param {uint32[]} out - Four output words (written)
   */
  function phi0(src, out) {
    out[0] = phiN(src[0], 0, 1, 2, 3);
    out[1] = phiN(src[1], 3, 0, 1, 2);
    out[2] = phiN(src[2], 2, 3, 0, 1);
    out[3] = phiN(src[3], 1, 2, 3, 0);
  }

  /**
   * @param {uint32[]} src - Four input words
   * @param {uint32[]} out - Four output words (written)
   */
  function phi1(src, out) {
    out[0] = phiN(src[0], 3, 0, 1, 2);
    out[1] = phiN(src[1], 2, 3, 0, 1);
    out[2] = phiN(src[2], 1, 2, 3, 0);
    out[3] = phiN(src[3], 0, 1, 2, 3);
  }

  /**
   * @param {uint32} word - Word
   * @param {int32} index - Byte position (0 = least significant)
   * @returns {uint32} The byte
   */
  function getByte(word, index) {
    return OpCodes.And32(OpCodes.Shr32(word, index * 8), 0xff);
  }

  /**
   * @param {uint32[]} vec - Four words
   * @param {int32} m - Byte position taken from every word
   * @param {int32} p - S-box for words 0 and 2
   * @param {int32} q - S-box for words 1 and 3
   * @returns {uint32} Substituted, transposed word
   */
  function gammaTau(vec, m, p, q) {
    return OpCodes.ToUint32(
      OpCodes.Or32(
        OpCodes.Or32(
          OpCodes.Or32(
            SBox[p][getByte(vec[0], m)],
            OpCodes.Shl32(SBox[q][getByte(vec[1], m)], 8)
          ),
          OpCodes.Shl32(SBox[p][getByte(vec[2], m)], 16)
        ),
        OpCodes.Shl32(SBox[q][getByte(vec[3], m)], 24)
      )
    );
  }

  /**
   * Key-schedule step h0 for group n: rotate words 0 and 2, add rc to words 1 and 3
   * @param {uint32[]} eKey - Encryption schedule (written at 4n + 8 .. 4n + 11)
   * @param {int32} n - Group index
   * @param {int32} r0 - Rotation of word 0
   * @param {int32} r1 - Rotation of word 2
   * @param {uint32} rc - Round constant
   */
  function h0Block(eKey, n, r0, r1, rc) {
    eKey[4 * n + 8] = OpCodes.RotL32(eKey[4 * n + 0], r0);
    eKey[4 * n + 9] = OpCodes.ToUint32(OpCodes.Xor32(rc, eKey[4 * n + 1]));
    eKey[4 * n + 10] = OpCodes.RotL32(eKey[4 * n + 2], r1);
    eKey[4 * n + 11] = OpCodes.ToUint32(OpCodes.Xor32(rc, eKey[4 * n + 3]));
  }

  /**
   * Key-schedule step h1 for group n: add rc to words 0 and 2, rotate words 1 and 3
   * @param {uint32[]} eKey - Encryption schedule (written at 4n + 8 .. 4n + 11)
   * @param {int32} n - Group index
   * @param {int32} r0 - Rotation of word 1
   * @param {int32} r1 - Rotation of word 3
   * @param {uint32} rc - Round constant
   */
  function h1Block(eKey, n, r0, r1, rc) {
    eKey[4 * n + 8] = OpCodes.ToUint32(OpCodes.Xor32(rc, eKey[4 * n + 0]));
    eKey[4 * n + 9] = OpCodes.RotL32(eKey[4 * n + 1], r0);
    eKey[4 * n + 10] = OpCodes.ToUint32(OpCodes.Xor32(rc, eKey[4 * n + 2]));
    eKey[4 * n + 11] = OpCodes.RotL32(eKey[4 * n + 3], r1);
  }

  /**
   * Even round: b1 = mix(b0) xor round key
   * @param {uint32[][]} mix - The four mix tables
   * @param {uint32[]} b0 - Input words
   * @param {uint32[]} b1 - Output words (written)
   * @param {uint32[]} schedule - Round-key schedule
   * @param {int32} offset - Index of the round key
   */
  function roundF0(mix, b0, b1, schedule, offset) {
    for (let i = 0; i < 4; i++) {
      b1[i] = OpCodes.ToUint32(
        OpCodes.Xor32(
          OpCodes.Xor32(
            OpCodes.Xor32(
              OpCodes.Xor32(
                mix[i][getByte(b0[0], i)],
                mix[OpCodes.And32(i + 1, 3)][getByte(b0[1], i)]
              ),
              mix[OpCodes.And32(i + 2, 3)][getByte(b0[2], i)]
            ),
            mix[OpCodes.And32(i + 3, 3)][getByte(b0[3], i)]
          ),
          schedule[offset + i]
        )
      );
    }
  }

  /**
   * Odd round: b0 = mix(b1) xor round key
   * @param {uint32[][]} mix - The four mix tables
   * @param {uint32[]} b0 - Output words (written)
   * @param {uint32[]} b1 - Input words
   * @param {uint32[]} schedule - Round-key schedule
   * @param {int32} offset - Index of the round key
   */
  function roundF1(mix, b0, b1, schedule, offset) {
    for (let i = 0; i < 4; i++) {
      b0[i] = OpCodes.ToUint32(
        OpCodes.Xor32(
          OpCodes.Xor32(
            OpCodes.Xor32(
              OpCodes.Xor32(
                mix[OpCodes.And32(i + 1, 3)][getByte(b1[0], i)],
                mix[OpCodes.And32(i + 2, 3)][getByte(b1[1], i)]
              ),
              mix[OpCodes.And32(i + 3, 3)][getByte(b1[2], i)]
            ),
            mix[i][getByte(b1[3], i)]
          ),
          schedule[offset + i]
        )
      );
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * CryptonAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class CryptonAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Crypton";
      this.description = "Korean AES candidate with 128-bit blocks and 128/192/256-bit keys.";
      this.inventor = "Chae Hoon Lim";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.KR;

      this.SupportedKeySizes = [
        new KeySize(16, 32, 8)
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0)
      ];

      this.documentation = [
        new LinkItem("NIST IR 6391 - CRYPTON Block Cipher", "https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf"),
        new LinkItem("Wikipedia - Crypton (cipher)", "https://en.wikipedia.org/wiki/Crypton_(cipher)")
      ];

      this.references = [
        new LinkItem("Brian Gladman Reference Implementation (AES Candidate Suite)", "https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf")
      ];

      this.tests = [
        {
          text: "DarkCrypt CRYPTON-256 vector 1/zero",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ec62e539bb6bbc811a60c06faccb7ec8")
        },
        {
          text: "DarkCrypt CRYPTON-256 vector 2/incr",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("f492525dec52b41aa180a2477d8c3e7b")
        },
        {
          text: "DarkCrypt CRYPTON-256 vector 3/incr2",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("1ed972824b3cc0fce3f2ebc503db4424")
        },

        {
          text: "NIST IR 6391 sample - 128-bit key",
          uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf",
          input: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("B2E3C68C3183E69504D4B90377D126E6")
        },
        {
          text: "NIST IR 6391 sample - 192-bit key",
          uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf",
          input: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          expected: OpCodes.Hex8ToBytes("BA1744E85800F7A174326DA87EDA7E45")
        },
        {
          text: "NIST IR 6391 sample - 256-bit key",
          uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf",
          input: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("17D5FAC539EEA17B36371838792EA84D")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {CryptonInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CryptonInstance(this, isInverse);
    }
  }

  /**
 * Crypton cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CryptonInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {CryptonAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint32[]|null} */
      this.roundKeyEnc = null;
      /** @type {uint32[]|null} */
      this.roundKeyDec = null;
      /** @type {KeySize[]} */
      this.keySizeList = algorithm.SupportedKeySizes;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeyEnc = null;
        this.roundKeyDec = null;
        this.KeySize = 0;
        return;
      }

      const sizes = this.keySizeList;
      let isValidSize = false;
      for (let k = 0; k < sizes.length; k++) {
        const ks = sizes[k];
        if (keyBytes.length < ks.minSize || keyBytes.length > ks.maxSize) continue;
        if (((keyBytes.length - ks.minSize) % ks.stepSize) === 0) { isValidSize = true; break; }
      }

      if (!isValidSize) {
        throw new Error('Invalid key size: ' + keyBytes.length + ' bytes');
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._generateKeySchedule(keyBytes);
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
      if (!this.key) throw new Error('Key not set');
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) throw new Error('Key not set');
      if (this.inputBuffer.length === 0) throw new Error('No data fed');
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error('Input length must be multiple of ' + this.BlockSize + ' bytes');
      }

      /** @type {uint8[]} */
      const output = [];
      const useDecrypt = this.isInverse;

      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processed = this._processBlock(block, useDecrypt);
        for (let _i = 0; _i < processed.length; _i++) output.push(processed[_i]);
      }

      this.inputBuffer = [];
      return output;
    }

    /**
     * @param {uint8[]} keyBytes - Key bytes
     */
    _generateKeySchedule(keyBytes) {
      const eKey = new Uint32Array(52);
      const dKey = new Uint32Array(52);
      const tmp = new Uint32Array(4);
      const tmpOut = new Uint32Array(4);
      const keyWords = new Uint32Array(Math.floor(keyBytes.length / 4));

      for (let i = 0; i < keyWords.length; i++) {
        const idx = i * 4;
        keyWords[i] = OpCodes.ToUint32(OpCodes.Pack32LE(keyBytes[idx], keyBytes[idx + 1], keyBytes[idx + 2], keyBytes[idx + 3]));
      }

      eKey[2] = 0;
      eKey[3] = 0;
      eKey[6] = 0;
      eKey[7] = 0;

      // 2, 3 or 4 key units of 8 bytes; each longer key also sets the words of the shorter ones
      const keyUnits = Math.floor((keyBytes.length + 7) / 8);
      if (keyUnits < 2 || keyUnits > 4)
        throw new Error('Unsupported key length: ' + keyBytes.length + ' bytes');
      if (keyUnits === 4) {
        eKey[3] = OpCodes.ToUint32(keyWords[6]);
        eKey[7] = OpCodes.ToUint32(keyWords[7]);
      }
      if (keyUnits >= 3) {
        eKey[2] = OpCodes.ToUint32(keyWords[4]);
        eKey[6] = OpCodes.ToUint32(keyWords[5]);
      }
      eKey[0] = OpCodes.ToUint32(keyWords[0]);
      eKey[4] = OpCodes.ToUint32(keyWords[1]);
      eKey[1] = OpCodes.ToUint32(keyWords[2]);
      eKey[5] = OpCodes.ToUint32(keyWords[3]);

      /** @type {uint32[]} */
      const lowHalf = [eKey[0], eKey[1], eKey[2], eKey[3]];
      tmp[0] = OpCodes.ToUint32(OpCodes.Xor32(piMix(lowHalf, 0, 1, 2, 3), KP[0]));
      tmp[1] = OpCodes.ToUint32(OpCodes.Xor32(piMix(lowHalf, 1, 2, 3, 0), KP[1]));
      tmp[2] = OpCodes.ToUint32(OpCodes.Xor32(piMix(lowHalf, 2, 3, 0, 1), KP[2]));
      tmp[3] = OpCodes.ToUint32(OpCodes.Xor32(piMix(lowHalf, 3, 0, 1, 2), KP[3]));

      eKey[0] = gammaTau(tmp, 0, 0, 1);
      eKey[1] = gammaTau(tmp, 1, 1, 0);
      eKey[2] = gammaTau(tmp, 2, 0, 1);
      eKey[3] = gammaTau(tmp, 3, 1, 0);

      /** @type {uint32[]} */
      const highHalf = [eKey[4], eKey[5], eKey[6], eKey[7]];
      tmp[0] = OpCodes.ToUint32(OpCodes.Xor32(piMix(highHalf, 1, 2, 3, 0), KQ[0]));
      tmp[1] = OpCodes.ToUint32(OpCodes.Xor32(piMix(highHalf, 2, 3, 0, 1), KQ[1]));
      tmp[2] = OpCodes.ToUint32(OpCodes.Xor32(piMix(highHalf, 3, 0, 1, 2), KQ[2]));
      tmp[3] = OpCodes.ToUint32(OpCodes.Xor32(piMix(highHalf, 0, 1, 2, 3), KQ[3]));

      eKey[4] = gammaTau(tmp, 0, 1, 0);
      eKey[5] = gammaTau(tmp, 1, 0, 1);
      eKey[6] = gammaTau(tmp, 2, 1, 0);
      eKey[7] = gammaTau(tmp, 3, 0, 1);

      const t0 = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(eKey[0], eKey[1]), eKey[2]), eKey[3]));
      const t1 = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(eKey[4], eKey[5]), eKey[6]), eKey[7]));

      for (let i = 0; i < 4; i++) {
        eKey[i] = OpCodes.ToUint32(OpCodes.Xor32(eKey[i], t1));
        eKey[4 + i] = OpCodes.ToUint32(OpCodes.Xor32(eKey[4 + i], t0));
      }

      /** @type {uint32} */
      let rc = OpCodes.ToUint32(0x01010101);

      h0Block(eKey, 0, 8, 16, rc); h1Block(eKey, 1, 16, 24, rc); rc = OpCodes.ToUint32(OpCodes.Shl32(rc, 1));
      h1Block(eKey, 2, 24, 8, rc); h0Block(eKey, 3, 8, 16, rc); rc = OpCodes.ToUint32(OpCodes.Shl32(rc, 1));
      h0Block(eKey, 4, 16, 24, rc); h1Block(eKey, 5, 24, 8, rc); rc = OpCodes.ToUint32(OpCodes.Shl32(rc, 1));
      h1Block(eKey, 6, 8, 16, rc); h0Block(eKey, 7, 16, 24, rc); rc = OpCodes.ToUint32(OpCodes.Shl32(rc, 1));
      h0Block(eKey, 8, 24, 8, rc); h1Block(eKey, 9, 8, 16, rc); rc = OpCodes.ToUint32(OpCodes.Shl32(rc, 1));
      h1Block(eKey, 10, 16, 24, rc);

      for (let i = 0; i < 13; i++) {
        /** @type {uint32[]} */
        const src = [eKey[i * 4], eKey[i * 4 + 1], eKey[i * 4 + 2], eKey[i * 4 + 3]];
        const destIndex = 48 - 4 * i;
        if (OpCodes.And32(i, 1)) {
          phi0(src, tmpOut);
        } else {
          phi1(src, tmpOut);
        }
        for (let k = 0; k < 4; k++) dKey[destIndex + k] = tmpOut[k];
      }

      /** @type {uint32[]} */
      const dTail = [dKey[48], dKey[49], dKey[50], dKey[51]];
      phi1(dTail, tmpOut);
      for (let k = 0; k < 4; k++) dKey[48 + k] = tmpOut[k];

      /** @type {uint32[]} */
      const eTail = [eKey[48], eKey[49], eKey[50], eKey[51]];
      phi1(eTail, tmpOut);
      for (let k = 0; k < 4; k++) eKey[48 + k] = tmpOut[k];

      this.roundKeyEnc = eKey;
      this.roundKeyDec = dKey;

      OpCodes.ClearArray(tmp);
      OpCodes.ClearArray(tmpOut);
      OpCodes.ClearArray(keyWords);
    }

    /**
     * @param {uint8[]} bytes - Input block
     * @param {boolean} useDecrypt - Use the decryption schedule
     * @returns {uint8[]} Output block
     */
    _processBlock(bytes, useDecrypt) {
      const schedule = useDecrypt ? this.roundKeyDec : this.roundKeyEnc;
      const mix = MixTables;
      const outWords = new Uint32Array(4);
      const b0 = new Uint32Array(4);
      const b1 = new Uint32Array(4);

      for (let i = 0; i < 4; i++) {
        const idx = i * 4;
        const word = OpCodes.ToUint32(OpCodes.Pack32LE(bytes[idx], bytes[idx + 1], bytes[idx + 2], bytes[idx + 3]));
        b0[i] = OpCodes.ToUint32(OpCodes.Xor32(word, schedule[i]));
      }

      roundF0(mix, b0, b1, schedule, 4); roundF1(mix, b0, b1, schedule, 8);
      roundF0(mix, b0, b1, schedule, 12); roundF1(mix, b0, b1, schedule, 16);
      roundF0(mix, b0, b1, schedule, 20); roundF1(mix, b0, b1, schedule, 24);
      roundF0(mix, b0, b1, schedule, 28); roundF1(mix, b0, b1, schedule, 32);
      roundF0(mix, b0, b1, schedule, 36); roundF1(mix, b0, b1, schedule, 40);
      roundF0(mix, b0, b1, schedule, 44);

      outWords[0] = OpCodes.ToUint32(OpCodes.Xor32(gammaTau(b1, 0, 1, 0), schedule[48]));
      outWords[1] = OpCodes.ToUint32(OpCodes.Xor32(gammaTau(b1, 1, 0, 1), schedule[49]));
      outWords[2] = OpCodes.ToUint32(OpCodes.Xor32(gammaTau(b1, 2, 1, 0), schedule[50]));
      outWords[3] = OpCodes.ToUint32(OpCodes.Xor32(gammaTau(b1, 3, 0, 1), schedule[51]));

      /** @type {uint8[]} */
      const result = [];
      for (let i = 0; i < 4; i++) {
        const unpacked = OpCodes.Unpack32LE(outWords[i]);
        result.push(unpacked[0]);
        result.push(unpacked[1]);
        result.push(unpacked[2]);
        result.push(unpacked[3]);
      }

      OpCodes.ClearArray(b0);
      OpCodes.ClearArray(b1);
      OpCodes.ClearArray(outWords);

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new CryptonAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CryptonAlgorithm, CryptonInstance };
}));
