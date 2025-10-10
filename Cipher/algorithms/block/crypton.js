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

  const CryptonTables = (() => {
    const PBOX = Object.freeze([
      new Uint8Array([15, 9, 6, 8, 9, 9, 4, 12, 6, 2, 6, 10, 1, 3, 5, 15]),
      new Uint8Array([10, 15, 4, 7, 5, 2, 14, 6, 9, 3, 12, 8, 13, 1, 11, 0]),
      new Uint8Array([0, 4, 8, 4, 2, 15, 8, 13, 1, 1, 15, 7, 2, 11, 14, 15])
    ]);

    const MA = new Uint32Array([0x3fcff3fc, 0xfc3fcff3, 0xf3fc3fcf, 0xcff3fc3f]);
    const MB = new Uint32Array([0xcffccffc, 0xf33ff33f, 0xfccffccf, 0x3ff33ff3]);
    const KP = new Uint32Array([0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f]);
    const KQ = new Uint32Array([0x9b05688c, 0x1f83d9ab, 0x5be0cd19, 0xcbbb9d5d]);

    const SBox = [new Uint8Array(256), new Uint8Array(256)];
    const MixTables = Array.from({ length: 4 }, () => new Uint32Array(256));
    let initialized = false;

    function generateTables() {
      if (initialized) {
        return;
      }

      for (let i = 0; i < 256; i++) {
        const xl = (i & 0xf0) >>> 4;
        const xr = i & 0x0f;
        const yr = xr ^ PBOX[1][xl ^ PBOX[0][xr]];
        const yl = xl ^ PBOX[0][xr] ^ PBOX[2][yr];
        const yCombined = (yr | (yl << 4)) & 0xff;

        SBox[0][i] = yCombined;
        SBox[1][yCombined] = i;

        const xrWord = (yCombined * 0x01010101) >>> 0;
        const xlWord = (i * 0x01010101) >>> 0;

        MixTables[0][i] = xrWord & MA[0];
        MixTables[1][yCombined] = xlWord & MA[1];
        MixTables[2][i] = xrWord & MA[2];
        MixTables[3][yCombined] = xlWord & MA[3];
      }

      initialized = true;
    }

    generateTables();

    const piMix = (words, n0, n1, n2, n3) => (
      ((words[0] & MA[n0]) ^
       (words[1] & MA[n1]) ^
       (words[2] & MA[n2]) ^
       (words[3] & MA[n3])) >>> 0
    );

    const phiN = (word, n0, n1, n2, n3) => (
      ((word & MB[n0]) ^
       (OpCodes.RotL32(word, 8) & MB[n1]) ^
       (OpCodes.RotL32(word, 16) & MB[n2]) ^
       (OpCodes.RotL32(word, 24) & MB[n3])) >>> 0
    );

    const phi0 = (src, out) => {
      out[0] = phiN(src[0], 0, 1, 2, 3);
      out[1] = phiN(src[1], 3, 0, 1, 2);
      out[2] = phiN(src[2], 2, 3, 0, 1);
      out[3] = phiN(src[3], 1, 2, 3, 0);
    };

    const phi1 = (src, out) => {
      out[0] = phiN(src[0], 3, 0, 1, 2);
      out[1] = phiN(src[1], 2, 3, 0, 1);
      out[2] = phiN(src[2], 1, 2, 3, 0);
      out[3] = phiN(src[3], 0, 1, 2, 3);
    };

    const getByte = (word, index) => (word >>> (index * 8)) & 0xff;

    const gammaTau = (vec, m, p, q) => (
      (SBox[p][getByte(vec[0], m)] |
       (SBox[q][getByte(vec[1], m)] << 8) |
       (SBox[p][getByte(vec[2], m)] << 16) |
       (SBox[q][getByte(vec[3], m)] << 24)) >>> 0
    );

    return Object.freeze({
      PBOX,
      MA,
      MB,
      KP,
      KQ,
      SBox,
      MixTables,
      piMix,
      phi0,
      phi1,
      gammaTau
    });
  })();

  // ===== ALGORITHM IMPLEMENTATION =====

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

      this.tables = CryptonTables;
    }

    CreateInstance(isInverse = false) {
      return new CryptonInstance(this, isInverse);
    }
  }

  class CryptonInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.roundKeyEnc = null;
      this.roundKeyDec = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeyEnc = null;
        this.roundKeyDec = null;
        this.KeySize = 0;
        return;
      }

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        ((keyBytes.length - ks.minSize) % ks.stepSize) === 0
      );

      if (!isValidSize) {
        throw new Error('Invalid key size: ' + keyBytes.length + ' bytes');
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._generateKeySchedule(keyBytes);
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error('Key not set');
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.key) throw new Error('Key not set');
      if (this.inputBuffer.length === 0) throw new Error('No data fed');
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error('Input length must be multiple of ' + this.BlockSize + ' bytes');
      }

      const output = [];
      const useDecrypt = this.isInverse;

      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processed = this._processBlock(block, useDecrypt);
        output.push(...processed);
      }

      this.inputBuffer = [];
      return output;
    }

    _generateKeySchedule(keyBytes) {
      const tables = this.algorithm.tables;
      const eKey = new Uint32Array(52);
      const dKey = new Uint32Array(52);
      const tmp = new Uint32Array(4);
      const tmpOut = new Uint32Array(4);
      const keyWords = new Uint32Array(keyBytes.length / 4);

      for (let i = 0; i < keyWords.length; i++) {
        const idx = i * 4;
        keyWords[i] = OpCodes.Pack32LE(keyBytes[idx], keyBytes[idx + 1], keyBytes[idx + 2], keyBytes[idx + 3]) >>> 0;
      }

      eKey[2] = eKey[3] = eKey[6] = eKey[7] = 0;

      const keyUnits = Math.floor((keyBytes.length + 7) / 8);
      switch (keyUnits) {
        case 4:
          eKey[3] = keyWords[6] >>> 0;
          eKey[7] = keyWords[7] >>> 0;
        case 3:
          eKey[2] = keyWords[4] >>> 0;
          eKey[6] = keyWords[5] >>> 0;
        case 2:
          eKey[0] = keyWords[0] >>> 0;
          eKey[4] = keyWords[1] >>> 0;
          eKey[1] = keyWords[2] >>> 0;
          eKey[5] = keyWords[3] >>> 0;
          break;
        default:
          throw new Error('Unsupported key length: ' + keyBytes.length + ' bytes');
      }

      tmp[0] = (tables.piMix(eKey.subarray(0, 4), 0, 1, 2, 3) ^ tables.KP[0]) >>> 0;
      tmp[1] = (tables.piMix(eKey.subarray(0, 4), 1, 2, 3, 0) ^ tables.KP[1]) >>> 0;
      tmp[2] = (tables.piMix(eKey.subarray(0, 4), 2, 3, 0, 1) ^ tables.KP[2]) >>> 0;
      tmp[3] = (tables.piMix(eKey.subarray(0, 4), 3, 0, 1, 2) ^ tables.KP[3]) >>> 0;

      eKey[0] = tables.gammaTau(tmp, 0, 0, 1);
      eKey[1] = tables.gammaTau(tmp, 1, 1, 0);
      eKey[2] = tables.gammaTau(tmp, 2, 0, 1);
      eKey[3] = tables.gammaTau(tmp, 3, 1, 0);

      tmp[0] = (tables.piMix(eKey.subarray(4, 8), 1, 2, 3, 0) ^ tables.KQ[0]) >>> 0;
      tmp[1] = (tables.piMix(eKey.subarray(4, 8), 2, 3, 0, 1) ^ tables.KQ[1]) >>> 0;
      tmp[2] = (tables.piMix(eKey.subarray(4, 8), 3, 0, 1, 2) ^ tables.KQ[2]) >>> 0;
      tmp[3] = (tables.piMix(eKey.subarray(4, 8), 0, 1, 2, 3) ^ tables.KQ[3]) >>> 0;

      eKey[4] = tables.gammaTau(tmp, 0, 1, 0);
      eKey[5] = tables.gammaTau(tmp, 1, 0, 1);
      eKey[6] = tables.gammaTau(tmp, 2, 1, 0);
      eKey[7] = tables.gammaTau(tmp, 3, 0, 1);

      const t0 = (eKey[0] ^ eKey[1] ^ eKey[2] ^ eKey[3]) >>> 0;
      const t1 = (eKey[4] ^ eKey[5] ^ eKey[6] ^ eKey[7]) >>> 0;

      for (let i = 0; i < 4; i++) {
        eKey[i] = (eKey[i] ^ t1) >>> 0;
        eKey[4 + i] = (eKey[4 + i] ^ t0) >>> 0;
      }

      let rc = 0x01010101 >>> 0;

      const h0Block = (n, r0, r1) => {
        eKey[4 * n + 8] = OpCodes.RotL32(eKey[4 * n + 0], r0);
        eKey[4 * n + 9] = (rc ^ eKey[4 * n + 1]) >>> 0;
        eKey[4 * n + 10] = OpCodes.RotL32(eKey[4 * n + 2], r1);
        eKey[4 * n + 11] = (rc ^ eKey[4 * n + 3]) >>> 0;
      };

      const h1Block = (n, r0, r1) => {
        eKey[4 * n + 8] = (rc ^ eKey[4 * n + 0]) >>> 0;
        eKey[4 * n + 9] = OpCodes.RotL32(eKey[4 * n + 1], r0);
        eKey[4 * n + 10] = (rc ^ eKey[4 * n + 2]) >>> 0;
        eKey[4 * n + 11] = OpCodes.RotL32(eKey[4 * n + 3], r1);
      };

      h0Block(0, 8, 16); h1Block(1, 16, 24); rc = (rc << 1) >>> 0;
      h1Block(2, 24, 8); h0Block(3, 8, 16); rc = (rc << 1) >>> 0;
      h0Block(4, 16, 24); h1Block(5, 24, 8); rc = (rc << 1) >>> 0;
      h1Block(6, 8, 16); h0Block(7, 16, 24); rc = (rc << 1) >>> 0;
      h0Block(8, 24, 8); h1Block(9, 8, 16); rc = (rc << 1) >>> 0;
      h1Block(10, 16, 24);

      for (let i = 0; i < 13; i++) {
        const src = eKey.subarray(i * 4, i * 4 + 4);
        const destIndex = 48 - 4 * i;
        const dest = dKey.subarray(destIndex, destIndex + 4);
        if (i & 1) {
          tables.phi0(src, tmpOut);
        } else {
          tables.phi1(src, tmpOut);
        }
        dest.set(tmpOut);
      }

      const dTail = dKey.subarray(48, 52);
      tables.phi1(dTail, tmpOut);
      dTail.set(tmpOut);

      const eTail = eKey.subarray(48, 52);
      tables.phi1(eTail, tmpOut);
      eTail.set(tmpOut);

      this.roundKeyEnc = eKey;
      this.roundKeyDec = dKey;

      OpCodes.ClearArray(tmp);
      OpCodes.ClearArray(tmpOut);
      OpCodes.ClearArray(keyWords);
    }

    _processBlock(bytes, useDecrypt) {
      const schedule = useDecrypt ? this.roundKeyDec : this.roundKeyEnc;
      const mix = this.algorithm.tables.MixTables;
      const gammaTau = this.algorithm.tables.gammaTau;
      const outWords = new Uint32Array(4);
      const b0 = new Uint32Array(4);
      const b1 = new Uint32Array(4);

      for (let i = 0; i < 4; i++) {
        const idx = i * 4;
        const word = OpCodes.Pack32LE(bytes[idx], bytes[idx + 1], bytes[idx + 2], bytes[idx + 3]) >>> 0;
        b0[i] = (word ^ schedule[i]) >>> 0;
      }

      const getByte = (word, index) => (word >>> (index * 8)) & 0xff;

      const roundF0 = offset => {
        for (let i = 0; i < 4; i++) {
          b1[i] = (
            mix[i][getByte(b0[0], i)] ^
            mix[(i + 1) & 3][getByte(b0[1], i)] ^
            mix[(i + 2) & 3][getByte(b0[2], i)] ^
            mix[(i + 3) & 3][getByte(b0[3], i)] ^
            schedule[offset + i]
          ) >>> 0;
        }
      };

      const roundF1 = offset => {
        for (let i = 0; i < 4; i++) {
          b0[i] = (
            mix[(i + 1) & 3][getByte(b1[0], i)] ^
            mix[(i + 2) & 3][getByte(b1[1], i)] ^
            mix[(i + 3) & 3][getByte(b1[2], i)] ^
            mix[i][getByte(b1[3], i)] ^
            schedule[offset + i]
          ) >>> 0;
        }
      };

      roundF0(4); roundF1(8);
      roundF0(12); roundF1(16);
      roundF0(20); roundF1(24);
      roundF0(28); roundF1(32);
      roundF0(36); roundF1(40);
      roundF0(44);

      outWords[0] = (gammaTau(b1, 0, 1, 0) ^ schedule[48]) >>> 0;
      outWords[1] = (gammaTau(b1, 1, 0, 1) ^ schedule[49]) >>> 0;
      outWords[2] = (gammaTau(b1, 2, 1, 0) ^ schedule[50]) >>> 0;
      outWords[3] = (gammaTau(b1, 3, 0, 1) ^ schedule[51]) >>> 0;

      const result = [];
      for (let i = 0; i < 4; i++) {
        const unpacked = OpCodes.Unpack32LE(outWords[i]);
        result.push(unpacked[0], unpacked[1], unpacked[2], unpacked[3]);
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
