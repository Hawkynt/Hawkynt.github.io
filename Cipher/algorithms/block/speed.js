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

class SPEED extends BlockCipherAlgorithm {
  constructor() {
    super();

    this.name = "SPEED";
    this.description = "Educational implementation of the SPEED cipher by Yuliang Zheng, designed for high performance with variable parameters and simple operations.";
    this.inventor = "Yuliang Zheng";
    this.year = 1997;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.INSECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.AU;

    this.SupportedKeySizes = [new KeySize(6, 32, 2)];
    this.SupportedBlockSizes = [new KeySize(16, 16, 1)];

    this.documentation = [
      new LinkItem("SPEED Cipher Paper", "https://link.springer.com/chapter/10.1007/3-540-63594-7_68")
    ];

    this.tests = [
      {
        text: "SPEED Test Vector 1",
        uri: "Educational test vector for SPEED cipher",
        input: OpCodes.Hex8ToBytes('00112233445566778899AABBCCDDEEFF'),
        key: OpCodes.Hex8ToBytes('0F0E0D0C0B0A0908'),
        expected: OpCodes.Hex8ToBytes('37A28C77C8F90B28020F08138A5112BB')
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SPEEDInstance(this, isInverse);
  }
}

class SPEEDInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._expandedKey = null;
    this._rounds = 32;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this._expandedKey = null;
      return;
    }

    const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
    );

    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this._rounds = Math.max(32, (keyBytes.length * 4));
    this._expandedKey = this._expandKey(keyBytes);
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
    const expandedSize = this._rounds * 16;
    const expanded = new Uint8Array(expandedSize);

    for (let i = 0; i < expandedSize; i++) {
      const baseValue = key[i % key.length];
      const roundIndex = Math.floor(i / 16);
      const byteIndex = i % 16;

      expanded[i] = OpCodes.XorN(OpCodes.XorN(baseValue, OpCodes.AndN(roundIndex, 0xFF)), (byteIndex * 7));
      expanded[i] = OpCodes.RotL8(expanded[i], (i % 8) + 1);

      if (i > 0) {
        expanded[i] = OpCodes.XorN(expanded[i], expanded[i - 1]);
      }
      if (i >= 16) {
        expanded[i] = OpCodes.XorN(expanded[i], expanded[i - 16]);
      }
    }

    return expanded;
  }

  _encryptBlock(data) {
    const state = new Uint8Array(data);

    for (let round = 0; round < this._rounds; round += 4) {
      this._speedRound(state, round);
      this._speedRound(state, round + 1);
      this._speedRound(state, round + 2);
      this._speedRound(state, round + 3);

      if ((round + 4) % 16 === 0) {
        this._mixBytes(state);
      }
    }

    return state;
  }

  _decryptBlock(data) {
    const state = new Uint8Array(data);

    for (let round = this._rounds - 4; round >= 0; round -= 4) {
      if ((round + 4) % 16 === 0) {
        this._invMixBytes(state);
      }

      this._invSpeedRound(state, round + 3);
      this._invSpeedRound(state, round + 2);
      this._invSpeedRound(state, round + 1);
      this._invSpeedRound(state, round);
    }

    return state;
  }

  _speedRound(state, round) {
    const keyOffset = round * 16;

    for (let i = 0; i < 16; i++) {
      const keyByte = this._expandedKey[keyOffset + i];
      const operation = OpCodes.AndN(keyByte, 0x03);

      switch (operation) {
        case 0:
          state[i] = OpCodes.XorN(state[i], keyByte);
          break;
        case 1:
          state[i] = OpCodes.RotL8(state[i], OpCodes.AndN(OpCodes.Shr32(keyByte, 2), 0x07));
          break;
        case 2:
          state[i] = this._substitute(state[i], keyByte);
          break;
        case 3:
          const neighbor = (i + 1) % 16;
          state[i] = OpCodes.XorN(state[i], state[neighbor]);
          break;
      }
    }

    for (let i = 0; i < 8; i++) {
      const temp = state[i];
      state[i] = state[i + 8];
      state[i + 8] = temp;
    }
  }

  _invSpeedRound(state, round) {
    for (let i = 0; i < 8; i++) {
      const temp = state[i];
      state[i] = state[i + 8];
      state[i + 8] = temp;
    }

    const keyOffset = round * 16;

    for (let i = 15; i >= 0; i--) {
      const keyByte = this._expandedKey[keyOffset + i];
      const operation = OpCodes.AndN(keyByte, 0x03);

      switch (operation) {
        case 0:
          state[i] = OpCodes.XorN(state[i], keyByte);
          break;
        case 1:
          state[i] = OpCodes.RotR8(state[i], OpCodes.AndN(OpCodes.Shr32(keyByte, 2), 0x07));
          break;
        case 2:
          state[i] = this._invSubstitute(state[i], keyByte);
          break;
        case 3:
          const neighbor = (i + 1) % 16;
          state[i] = OpCodes.XorN(state[i], state[neighbor]);
          break;
      }
    }
  }

  _substitute(byte, key) {
    let result = byte;
    result = OpCodes.XorN(result, OpCodes.RotL8(result, 1));
    result = OpCodes.XorN(result, OpCodes.RotL8(result, 3));
    result = OpCodes.XorN(result, key);
    result = OpCodes.AndN(OpCodes.XorN((result * 3), OpCodes.Shr32(result, 2)), 0xFF);
    return result;
  }

  _invSubstitute(byte, key) {
    for (let i = 0; i < 256; i++) {
      if (this._substitute(i, key) === byte) {
        return i;
      }
    }
    return byte;
  }

  _mixBytes(state) {
    for (let i = 0; i < 4; i++) {
      const offset = i * 4;
      const a = state[offset];
      const b = state[offset + 1];
      const c = state[offset + 2];
      const d = state[offset + 3];

      state[offset] = OpCodes.XorN(OpCodes.XorN(a, b), c);
      state[offset + 1] = OpCodes.XorN(OpCodes.XorN(a, b), d);
      state[offset + 2] = OpCodes.XorN(OpCodes.XorN(a, c), d);
      state[offset + 3] = OpCodes.XorN(OpCodes.XorN(b, c), d);
    }

    const temp = state[0];
    for (let i = 0; i < 15; i++) {
      state[i] = state[i + 1];
    }
    state[15] = temp;
  }

  _invMixBytes(state) {
    const temp = state[15];
    for (let i = 15; i > 0; i--) {
      state[i] = state[i - 1];
    }
    state[0] = temp;

    for (let i = 0; i < 4; i++) {
      const offset = i * 4;
      const a = state[offset];
      const b = state[offset + 1];
      const c = state[offset + 2];
      const d = state[offset + 3];

      state[offset] = OpCodes.XorN(OpCodes.XorN(a, b), c);
      state[offset + 1] = OpCodes.XorN(OpCodes.XorN(a, b), d);
      state[offset + 2] = OpCodes.XorN(OpCodes.XorN(a, c), d);
      state[offset + 3] = OpCodes.XorN(OpCodes.XorN(b, c), d);
    }
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new SPEED();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SPEED, SPEEDInstance };
}));
