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

class UnicornA extends BlockCipherAlgorithm {
  constructor() {
    super();

    this.name = "CIPHERUNICORN-A";
    this.description = "Educational implementation of CIPHERUNICORN-A from NEC, a 16-round Feistel network with complex parallel round functions, recommended by CRYPTREC.";
    this.inventor = "NEC Corporation";
    this.year = 2000;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.JP;

    this.SupportedKeySizes = [new KeySize(16, 32, 8)];
    this.SupportedBlockSizes = [new KeySize(16, 16, 1)];

    this.documentation = [
      new LinkItem("CRYPTREC Report", "https://www.cryptrec.go.jp/en/")
    ];

    this.tests = [
      {
        text: "CIPHERUNICORN-A Test Vector 1",
        uri: "Educational test vector for CIPHERUNICORN-A cipher",
        input: OpCodes.Hex8ToBytes('00112233445566778899AABBCCDDEEFF'),
        key: OpCodes.Hex8ToBytes('0F0E0D0C0B0A09080706050403020100'),
        expected: OpCodes.Hex8ToBytes('9FC26F56CA7752EE45A3141A869551C4')
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new UnicornAInstance(this, isInverse);
  }
}

class UnicornAInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._roundKeys = null;

    this._sBox = [
      0x63, 0x7C, 0x77, 0x7B, 0xF2, 0x6B, 0x6F, 0xC5,
      0x30, 0x01, 0x67, 0x2B, 0xFE, 0xD7, 0xAB, 0x76,
      0xCA, 0x82, 0xC9, 0x7D, 0xFA, 0x59, 0x47, 0xF0,
      0xAD, 0xD4, 0xA2, 0xAF, 0x9C, 0xA4, 0x72, 0xC0,
      0xB7, 0xFD, 0x93, 0x26, 0x36, 0x3F, 0xF7, 0xCC,
      0x34, 0xA5, 0xE5, 0xF1, 0x71, 0xD8, 0x31, 0x15,
      0x04, 0xC7, 0x23, 0xC3, 0x18, 0x96, 0x05, 0x9A,
      0x07, 0x12, 0x80, 0xE2, 0xEB, 0x27, 0xB2, 0x75,
      0x09, 0x83, 0x2C, 0x1A, 0x1B, 0x6E, 0x5A, 0xA0,
      0x52, 0x3B, 0xD6, 0xB3, 0x29, 0xE3, 0x2F, 0x84,
      0x53, 0xD1, 0x00, 0xED, 0x20, 0xFC, 0xB1, 0x5B,
      0x6A, 0xCB, 0xBE, 0x39, 0x4A, 0x4C, 0x58, 0xCF,
      0xD0, 0xEF, 0xAA, 0xFB, 0x43, 0x4D, 0x33, 0x85,
      0x45, 0xF9, 0x02, 0x7F, 0x50, 0x3C, 0x9F, 0xA8,
      0x51, 0xA3, 0x40, 0x8F, 0x92, 0x9D, 0x38, 0xF5,
      0xBC, 0xB6, 0xDA, 0x21, 0x10, 0xFF, 0xF3, 0xD2,
      0xCD, 0x0C, 0x13, 0xEC, 0x5F, 0x97, 0x44, 0x17,
      0xC4, 0xA7, 0x7E, 0x3D, 0x64, 0x5D, 0x19, 0x73,
      0x60, 0x81, 0x4F, 0xDC, 0x22, 0x2A, 0x90, 0x88,
      0x46, 0xEE, 0xB8, 0x14, 0xDE, 0x5E, 0x0B, 0xDB,
      0xE0, 0x32, 0x3A, 0x0A, 0x49, 0x06, 0x24, 0x5C,
      0xC2, 0xD3, 0xAC, 0x62, 0x91, 0x95, 0xE4, 0x79,
      0xE7, 0xC8, 0x37, 0x6D, 0x8D, 0xD5, 0x4E, 0xA9,
      0x6C, 0x56, 0xF4, 0xEA, 0x65, 0x7A, 0xAE, 0x08,
      0xBA, 0x78, 0x25, 0x2E, 0x1C, 0xA6, 0xB4, 0xC6,
      0xE8, 0xDD, 0x74, 0x1F, 0x4B, 0xBD, 0x8B, 0x8A,
      0x70, 0x3E, 0xB5, 0x66, 0x48, 0x03, 0xF6, 0x0E,
      0x61, 0x35, 0x57, 0xB9, 0x86, 0xC1, 0x1D, 0x9E,
      0xE1, 0xF8, 0x98, 0x11, 0x69, 0xD9, 0x8E, 0x94,
      0x9B, 0x1E, 0x87, 0xE9, 0xCE, 0x55, 0x28, 0xDF,
      0x8C, 0xA1, 0x89, 0x0D, 0xBF, 0xE6, 0x42, 0x68,
      0x41, 0x99, 0x2D, 0x0F, 0xB0, 0x54, 0xBB, 0x16
    ];
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this._roundKeys = null;
      return;
    }

    const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
    );

    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this._roundKeys = this._expandKey(keyBytes);
  }

  get key() { return this._key ? [...this._key] : null; }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this._key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    const output = [];
    const blockSize = 16;

    for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
      const block = this.inputBuffer.slice(i, i + blockSize);
      if (block.length !== blockSize) {
        throw new Error(`Incomplete block: ${block.length} bytes`);
      }

      const processedBlock = this.isInverse ?
        this._decryptBlock(block) :
        this._encryptBlock(block);

      output.push(...processedBlock);
    }

    this.inputBuffer = [];
    return output;
  }

  _expandKey(key) {
    const roundKeys = new Array(16);

    for (let round = 0; round < 16; round++) {
      roundKeys[round] = {
        mainKey: new Uint8Array(8),
        tempKey: new Uint8Array(8)
      };

      for (let i = 0; i < 8; i++) {
        roundKeys[round].mainKey[i] = key[(round * 8 + i) % key.length];
        roundKeys[round].mainKey[i] = OpCodes.XorN(roundKeys[round].mainKey[i], OpCodes.RotL8(key[(round + i) % key.length], OpCodes.AndN(round, 7)));
        roundKeys[round].mainKey[i] = OpCodes.XorN(roundKeys[round].mainKey[i], OpCodes.AndN(round * 13 + i * 7, 0xFF));

        roundKeys[round].tempKey[i] = key[(round * 4 + i) % key.length];
        roundKeys[round].tempKey[i] = OpCodes.XorN(roundKeys[round].tempKey[i], OpCodes.RotL8(roundKeys[round].mainKey[i], OpCodes.AndN(i + 1, 7)));
        roundKeys[round].tempKey[i] = OpCodes.XorN(roundKeys[round].tempKey[i], OpCodes.AndN(round * 17 + i * 11, 0xFF));
      }
    }

    return roundKeys;
  }

  _encryptBlock(data) {
    let left = new Uint8Array(data.slice(0, 8));
    let right = new Uint8Array(data.slice(8, 16));

    for (let round = 0; round < 16; round++) {
      const tempRight = new Uint8Array(right);
      const fResult = this._complexFFunction(right, this._roundKeys[round]);
      right = OpCodes.XorArrays(left, fResult);
      left = tempRight;
    }

    return new Uint8Array([...left, ...right]);
  }

  _decryptBlock(data) {
    let left = new Uint8Array(data.slice(0, 8));
    let right = new Uint8Array(data.slice(8, 16));

    for (let round = 15; round >= 0; round--) {
      const tempLeft = new Uint8Array(left);
      const fResult = this._complexFFunction(left, this._roundKeys[round]);
      left = OpCodes.XorArrays(right, fResult);
      right = tempLeft;
    }

    return new Uint8Array([...left, ...right]);
  }

  _complexFFunction(input, roundKey) {
    const mainStream = this._mainFeistelNetwork(input, roundKey.mainKey);
    const tempStream = this._tempKeyGeneration(input, roundKey.tempKey);

    const result = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      result[i] = OpCodes.XorN(mainStream[i], tempStream[i % 4]);
    }

    return result;
  }

  _mainFeistelNetwork(input, key) {
    let left = new Uint8Array(input.slice(0, 4));
    let right = new Uint8Array(input.slice(4, 8));

    for (let round = 0; round < 10; round++) {
      const tempRight = new Uint8Array(right);
      const fResult = this._innerFFunction(right, key, round);
      right = OpCodes.XorArrays(left, fResult);
      left = tempRight;
    }

    return new Uint8Array([...left, ...right]);
  }

  _tempKeyGeneration(input, key) {
    const result = new Uint8Array(4);

    for (let i = 0; i < 4; i++) {
      result[i] = OpCodes.XorN(OpCodes.XorN(input[i], input[i + 4]), key[i]);
      result[i] = this._sBox[result[i]];
      result[i] = OpCodes.XorN(result[i], OpCodes.RotL8(result[i], OpCodes.AndN(i + 1, 7)));
    }

    const temp = result[0];
    result[0] = result[1];
    result[1] = result[2];
    result[2] = result[3];
    result[3] = temp;

    return result;
  }

  _innerFFunction(input, key, round) {
    const result = new Uint8Array(4);

    for (let i = 0; i < 4; i++) {
      result[i] = OpCodes.XorN(input[i], key[(round + i) % 8]);
      result[i] = this._sBox[result[i]];
    }

    result[0] = OpCodes.XorN(result[0], result[1]);
    result[2] = OpCodes.XorN(result[2], result[3]);

    const temp = result[0];
    result[0] = OpCodes.RotL8(result[2], 3);
    result[2] = OpCodes.RotL8(temp, 1);

    result[1] = OpCodes.RotL8(result[1], 2);
    result[3] = OpCodes.RotL8(result[3], 5);

    return result;
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new UnicornA();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { UnicornA, UnicornAInstance };
}));
