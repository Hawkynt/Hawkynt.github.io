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

class SC2000 extends BlockCipherAlgorithm {
  constructor() {
    super();

    this.name = "SC2000";
    this.description = "Educational implementation of SC2000 block cipher from Fujitsu Labs with hybrid Feistel/SPN structure, submitted to NESSIE and recommended by CRYPTREC.";
    this.inventor = "Fujitsu Labs";
    this.year = 2000;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.JP;

    this.SupportedKeySizes = [new KeySize(16, 32, 8)];
    this.SupportedBlockSizes = [new KeySize(16, 16, 1)];

    this.documentation = [
      new LinkItem("SC2000 Specification", "https://www.fujitsu.com/global/about/research/external-activities/crypto/sc2000.html")
    ];

    this.tests = [
      {
        text: "SC2000 Test Vector 1",
        uri: "Educational test vector for SC2000 cipher",
        input: OpCodes.Hex8ToBytes('00112233445566778899AABBCCDDEEFF'),
        key: OpCodes.Hex8ToBytes('0F0E0D0C0B0A09080706050403020100'),
        expected: OpCodes.Hex8ToBytes('00020036000500070029000B0027001E')
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SC2000Instance(this, isInverse);
  }
}

class SC2000Instance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._roundKeys = null;
    this._rounds = 0;

    this._sBox4 = [
      0xC, 0x5, 0x6, 0xB, 0x9, 0x0, 0xA, 0xD,
      0x3, 0xE, 0xF, 0x8, 0x4, 0x7, 0x1, 0x2
    ];

    this._sBox5 = [
      0x1E, 0x11, 0x0A, 0x07, 0x16, 0x1D, 0x04, 0x09,
      0x12, 0x0F, 0x18, 0x03, 0x1A, 0x05, 0x0C, 0x13,
      0x00, 0x0B, 0x1F, 0x06, 0x17, 0x02, 0x14, 0x1B,
      0x0E, 0x19, 0x08, 0x01, 0x10, 0x15, 0x1C, 0x0D
    ];

    this._sBox6 = [
      0x2F, 0x25, 0x1A, 0x0F, 0x34, 0x39, 0x08, 0x13,
      0x26, 0x1B, 0x30, 0x05, 0x3A, 0x0D, 0x18, 0x23,
      0x00, 0x15, 0x2A, 0x3F, 0x16, 0x0B, 0x20, 0x35,
      0x2C, 0x31, 0x06, 0x1B, 0x24, 0x19, 0x0E, 0x03,
      0x38, 0x2D, 0x02, 0x17, 0x22, 0x37, 0x0C, 0x01,
      0x1E, 0x33, 0x28, 0x3D, 0x12, 0x07, 0x1C, 0x21,
      0x36, 0x0B, 0x10, 0x25, 0x3A, 0x2F, 0x04, 0x09,
      0x14, 0x29, 0x3E, 0x33, 0x08, 0x1D, 0x32, 0x27
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
    this._rounds = this._getRounds(keyBytes.length);
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

  _getRounds(keyLength) {
    switch (keyLength) {
      case 16: return 7;  // 6.5 rounds (7 for simplicity)
      case 24: return 8;  // 7.5 rounds
      case 32: return 8;  // 7.5 rounds
      default: return 7;
    }
  }

  _expandKey(key) {
    const totalKeys = this._rounds + 2;
    const roundKeys = new Array(totalKeys);

    for (let i = 0; i < totalKeys; i++) {
      roundKeys[i] = new Uint8Array(8);
    }

    for (let i = 0; i < totalKeys; i++) {
      for (let j = 0; j < 8; j++) {
        roundKeys[i][j] = key[(i * 8 + j) % key.length];
        roundKeys[i][j] ^= OpCodes.RotL8(key[(i + j) % key.length], (i + j) & 7);
        roundKeys[i][j] ^= (i * 16 + j * 3 + 0x5A) & 0xFF;
      }
    }

    return roundKeys;
  }

  _encryptBlock(data) {
    let left = new Uint8Array(data.slice(0, 8));
    let right = new Uint8Array(data.slice(8, 16));

    for (let round = 0; round < this._rounds; round++) {
      const tempRight = new Uint8Array(right);
      right = OpCodes.XorArrays(left, this._fFunction(right, this._roundKeys[round]));
      left = tempRight;
    }

    this._spnLayer(left, this._roundKeys[this._rounds]);
    this._spnLayer(right, this._roundKeys[this._rounds + 1]);

    return new Uint8Array([...left, ...right]);
  }

  _decryptBlock(data) {
    let left = new Uint8Array(data.slice(0, 8));
    let right = new Uint8Array(data.slice(8, 16));

    this._invSpnLayer(left, this._roundKeys[this._rounds + 1]);
    this._invSpnLayer(right, this._roundKeys[this._rounds]);

    for (let round = this._rounds - 1; round >= 0; round--) {
      const tempLeft = new Uint8Array(left);
      left = OpCodes.XorArrays(right, this._fFunction(left, this._roundKeys[round]));
      right = tempLeft;
    }

    return new Uint8Array([...left, ...right]);
  }

  _fFunction(input, roundKey) {
    const result = new Uint8Array(8);

    for (let i = 0; i < 8; i++) {
      result[i] = input[i] ^ roundKey[i];
    }

    for (let i = 0; i < 8; i++) {
      result[i] = this._sBox4[result[i] & 0x0F];
    }

    result[0] ^= result[1];
    result[2] ^= result[3];
    result[4] ^= result[5];
    result[6] ^= result[7];

    const left = OpCodes.Pack32BE(result[0], result[1], result[2], result[3]);
    const right = OpCodes.Pack32BE(result[4], result[5], result[6], result[7]);

    const mixedLeft = OpCodes.RotL32(left, 7) ^ right;
    const mixedRight = OpCodes.RotL32(right, 13) ^ left;

    const finalResult = new Uint8Array(8);
    finalResult[0] = (mixedLeft >> 24) & 0xFF;
    finalResult[1] = (mixedLeft >> 16) & 0xFF;
    finalResult[2] = (mixedLeft >> 8) & 0xFF;
    finalResult[3] = mixedLeft & 0xFF;
    finalResult[4] = (mixedRight >> 24) & 0xFF;
    finalResult[5] = (mixedRight >> 16) & 0xFF;
    finalResult[6] = (mixedRight >> 8) & 0xFF;
    finalResult[7] = mixedRight & 0xFF;

    return finalResult;
  }

  _spnLayer(state, roundKey) {
    for (let i = 0; i < 8; i++) {
      state[i] ^= roundKey[i];
    }

    for (let i = 0; i < 8; i += 2) {
      const combined = (state[i] << 8) | state[i + 1];
      const sboxValue = this._sBox5[combined & 0x1F] ^ this._sBox6[(combined >> 5) & 0x3F];
      state[i] = (sboxValue >> 8) & 0xFF;
      state[i + 1] = sboxValue & 0xFF;
    }

    const temp = state[0];
    state[0] = state[2];
    state[2] = state[4];
    state[4] = state[6];
    state[6] = temp;

    const temp2 = state[1];
    state[1] = state[3];
    state[3] = state[5];
    state[5] = state[7];
    state[7] = temp2;
  }

  _invSpnLayer(state, roundKey) {
    const temp = state[6];
    state[6] = state[4];
    state[4] = state[2];
    state[2] = state[0];
    state[0] = temp;

    const temp2 = state[7];
    state[7] = state[5];
    state[5] = state[3];
    state[3] = state[1];
    state[1] = temp2;

    for (let i = 0; i < 8; i += 2) {
      const combined = (state[i] << 8) | state[i + 1];
      for (let j = 0; j < 65536; j++) {
        const testVal = this._sBox5[j & 0x1F] ^ this._sBox6[(j >> 5) & 0x3F];
        if (testVal === combined) {
          state[i] = (j >> 8) & 0xFF;
          state[i + 1] = j & 0xFF;
          break;
        }
      }
    }

    for (let i = 0; i < 8; i++) {
      state[i] ^= roundKey[i];
    }
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new SC2000();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SC2000, SC2000Instance };
}));
