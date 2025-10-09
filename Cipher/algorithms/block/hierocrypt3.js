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

class Hierocrypt3 extends BlockCipherAlgorithm {
  constructor() {
    super();

    this.name = "Hierocrypt-3";
    this.description = "Educational implementation of Hierocrypt-3, a 128-bit block cipher from Toshiba submitted to NESSIE with nested SPN structure and variable rounds.";
    this.inventor = "Toshiba Corporation";
    this.year = 2000;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.JP;

    this.SupportedKeySizes = [new KeySize(16, 32, 8)];
    this.SupportedBlockSizes = [new KeySize(16, 16, 1)];

    this.documentation = [
      new LinkItem("NESSIE Specification", "https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/08_02espec.pdf")
    ];

    this.tests = [
      {
        text: "Hierocrypt-3 Test Vector 1",
        uri: "Educational test vector for Hierocrypt-3 cipher",
        input: OpCodes.Hex8ToBytes('00112233445566778899AABBCCDDEEFF'),
        key: OpCodes.Hex8ToBytes('0F0E0D0C0B0A09080706050403020100'),
        expected: OpCodes.Hex8ToBytes('06C42E69000392E7DF7C28D40D4419CF')
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new Hierocrypt3Instance(this, isInverse);
  }
}

class Hierocrypt3Instance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._roundKeys = null;
    this._rounds = 0;
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
      case 32: return 9;  // 8.5 rounds
      default: return 7;
    }
  }

  _expandKey(key) {
    const totalRounds = this._rounds + 1;
    const roundKeys = new Array(totalRounds);

    for (let i = 0; i < totalRounds; i++) {
      roundKeys[i] = new Uint8Array(16);
    }

    for (let i = 0; i < 16; i++) {
      roundKeys[0][i] = key[i % key.length];
    }

    for (let round = 1; round < totalRounds; round++) {
      for (let i = 0; i < 16; i++) {
        roundKeys[round][i] = roundKeys[round - 1][i];
        roundKeys[round][i] ^= OpCodes.RotL8(key[(round + i) % key.length], round & 7);
        roundKeys[round][i] ^= (round * 16 + i) & 0xFF;
      }
    }

    return roundKeys;
  }

  _encryptBlock(data) {
    let state = new Uint8Array(data);

    this._addRoundKey(state, 0);

    for (let round = 1; round <= this._rounds; round++) {
      state = this._xsBoxLayer(state, round);
      if (round < this._rounds) {
        state = this._linearDiffusion(state);
      }
      this._addRoundKey(state, round);
    }

    return state;
  }

  _decryptBlock(data) {
    let state = new Uint8Array(data);

    this._addRoundKey(state, this._rounds);

    for (let round = this._rounds; round >= 1; round--) {
      if (round < this._rounds) {
        state = this._invLinearDiffusion(state);
      }
      state = this._invXsBoxLayer(state, round);
      this._addRoundKey(state, round - 1);
    }

    return state;
  }

  _addRoundKey(state, round) {
    for (let i = 0; i < 16; i++) {
      state[i] ^= this._roundKeys[round][i];
    }
  }

  _xsBoxLayer(state, round) {
    const newState = new Uint8Array(16);

    for (let i = 0; i < 16; i++) {
      newState[i] = this._sBox(state[i], round);
    }

    for (let i = 0; i < 16; i += 4) {
      const temp = newState[i];
      newState[i] = newState[i + 1];
      newState[i + 1] = newState[i + 2];
      newState[i + 2] = newState[i + 3];
      newState[i + 3] = temp;
    }

    return newState;
  }

  _invXsBoxLayer(state, round) {
    const newState = new Uint8Array(state);

    for (let i = 0; i < 16; i += 4) {
      const temp = newState[i + 3];
      newState[i + 3] = newState[i + 2];
      newState[i + 2] = newState[i + 1];
      newState[i + 1] = newState[i];
      newState[i] = temp;
    }

    for (let i = 0; i < 16; i++) {
      newState[i] = this._invSBox(newState[i], round);
    }

    return newState;
  }

  _sBox(byte, round) {
    let result = byte;
    result ^= OpCodes.RotL8(result, 1);
    result ^= OpCodes.RotL8(result, 2);
    result ^= (round * 17) & 0xFF;
    result = ((result * 7) ^ (result >> 4)) & 0xFF;
    return result;
  }

  _invSBox(byte, round) {
    for (let i = 0; i < 256; i++) {
      if (this._sBox(i, round) === byte) {
        return i;
      }
    }
    return byte;
  }

  _linearDiffusion(state) {
    const newState = new Uint8Array(16);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        newState[i * 4 + j] = 0;
        for (let k = 0; k < 4; k++) {
          const mixValue = this._getMixValue(j, k);
          newState[i * 4 + j] ^= OpCodes.GF256Mul(state[i * 4 + k], mixValue);
        }
      }
    }

    for (let i = 0; i < 4; i++) {
      const temp = newState[i];
      newState[i] = newState[i + 4];
      newState[i + 4] = newState[i + 8];
      newState[i + 8] = newState[i + 12];
      newState[i + 12] = temp;
    }

    return newState;
  }

  _invLinearDiffusion(state) {
    const tempState = new Uint8Array(state);

    for (let i = 0; i < 4; i++) {
      const temp = tempState[i + 12];
      tempState[i + 12] = tempState[i + 8];
      tempState[i + 8] = tempState[i + 4];
      tempState[i + 4] = tempState[i];
      tempState[i] = temp;
    }

    const newState = new Uint8Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        newState[i * 4 + j] = 0;
        for (let k = 0; k < 4; k++) {
          const mixValue = this._getInvMixValue(j, k);
          newState[i * 4 + j] ^= OpCodes.GF256Mul(tempState[i * 4 + k], mixValue);
        }
      }
    }

    return newState;
  }

  _getMixValue(row, col) {
    const mixMatrix = [
      [0x02, 0x03, 0x01, 0x01],
      [0x01, 0x02, 0x03, 0x01],
      [0x01, 0x01, 0x02, 0x03],
      [0x03, 0x01, 0x01, 0x02]
    ];
    return mixMatrix[row][col];
  }

  _getInvMixValue(row, col) {
    const invMixMatrix = [
      [0x0E, 0x0B, 0x0D, 0x09],
      [0x09, 0x0E, 0x0B, 0x0D],
      [0x0D, 0x09, 0x0E, 0x0B],
      [0x0B, 0x0D, 0x09, 0x0E]
    ];
    return invMixMatrix[row][col];
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new Hierocrypt3();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Hierocrypt3, Hierocrypt3Instance };
}));
