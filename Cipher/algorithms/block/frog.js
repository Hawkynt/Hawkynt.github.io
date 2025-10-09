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


class FROG extends BlockCipherAlgorithm {
  constructor() {
    super();

    this.name = "FROG";
    this.description = "Educational implementation of the FROG block cipher, an AES candidate from TecApro that uses a unique key-as-program design with 8 rounds and complex key schedule.";
    this.inventor = "Georgoudis, Leroux and Chaves";
    this.year = 1998;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.INSECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.CR;

    this.SupportedKeySizes = [new KeySize(16, 32, 8)];
    this.SupportedBlockSizes = [new KeySize(16, 16, 1)];

    this.documentation = [
      new LinkItem("FROG AES Submission", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/frog.pdf")
    ];

    this.tests = [
      {
        text: "FROG Test Vector 1",
        uri: "Educational test vector for FROG cipher",
        input: OpCodes.Hex8ToBytes('00112233445566778899AABBCCDDEEFF'),
        key: OpCodes.Hex8ToBytes('0F0E0D0C0B0A09080706050403020100'),
        expected: OpCodes.Hex8ToBytes('63EE65DF98CD8D545305692BB983A3BF')
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new FROGInstance(this, isInverse);
  }
}

class FROGInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._internalKey = null;
    this._keySize = 0;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this._internalKey = null;
      return;
    }

    const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
    );

    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this._setupKey(keyBytes);
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

  _setupKey(key) {
    this._keySize = key.length;
    this._internalKey = new Uint8Array(2304);

    const expandedKey = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      expandedKey[i] = key[i % key.length] ^ i;
    }

    let keyIndex = 0;
    for (let i = 0; i < 2304; i++) {
      this._internalKey[i] = expandedKey[keyIndex];
      keyIndex = (keyIndex + 1) % 256;

      if (i > 0) {
        this._internalKey[i] ^= this._internalKey[i - 1];
      }

      this._internalKey[i] = OpCodes.RotL8(this._internalKey[i], (i % 8) + 1);
    }
  }

  _encryptBlock(data) {
    if (!this._internalKey) {
      throw new Error('Key not set up');
    }

    const block = new Uint8Array(data);
    let keyOffset = 0;

    for (let round = 0; round < 8; round++) {
      // Save original block values for operation 2 dependencies
      const originalBlock = new Uint8Array(block);

      for (let i = 0; i < 16; i++) {
        const instruction = this._internalKey[keyOffset + i];
        const operation = instruction & 0x03;
        const sourceIdx = (instruction >> 2) & 0x0F;

        switch (operation) {
          case 0:
            block[i] ^= this._internalKey[keyOffset + 16 + sourceIdx];
            break;
          case 1:
            block[i] = OpCodes.RotL8(block[i], (sourceIdx & 0x07) + 1);
            break;
          case 2:
            block[i] ^= originalBlock[sourceIdx % 16];
            break;
          case 3:
            block[i] = this._substituteByte(block[i], keyOffset + sourceIdx);
            break;
        }
      }

      this._mixColumns(block);
      keyOffset += 288;
    }

    return block;
  }

  _decryptBlock(data) {
    if (!this._internalKey) {
      throw new Error('Key not set up');
    }

    const block = new Uint8Array(data);
    let keyOffset = 288 * 7;

    for (let round = 7; round >= 0; round--) {
      this._invMixColumns(block);

      // Save original block values for operation 2 dependencies
      const originalBlock = new Uint8Array(block);

      for (let i = 15; i >= 0; i--) {
        const instruction = this._internalKey[keyOffset + i];
        const operation = instruction & 0x03;
        const sourceIdx = (instruction >> 2) & 0x0F;

        switch (operation) {
          case 0:
            block[i] ^= this._internalKey[keyOffset + 16 + sourceIdx];
            break;
          case 1:
            block[i] = OpCodes.RotR8(block[i], (sourceIdx & 0x07) + 1);
            break;
          case 2:
            block[i] ^= originalBlock[sourceIdx % 16];
            break;
          case 3:
            block[i] = this._invSubstituteByte(block[i], keyOffset + sourceIdx);
            break;
        }
      }

      keyOffset -= 288;
    }

    return block;
  }

  _substituteByte(byte, keyOffset) {
    const sboxKey = this._internalKey[keyOffset % 2304];
    return ((byte + sboxKey) ^ OpCodes.RotL8(byte, 3)) & 0xFF;
  }

  _invSubstituteByte(byte, keyOffset) {
    for (let i = 0; i < 256; i++) {
      if (this._substituteByte(i, keyOffset) === byte) {
        return i;
      }
    }
    return byte;
  }

  _mixColumns(block) {
    for (let col = 0; col < 4; col++) {
      const offset = col * 4;
      const temp = [
        block[offset],
        block[offset + 1],
        block[offset + 2],
        block[offset + 3]
      ];

      block[offset] = temp[1] ^ temp[2] ^ temp[3];
      block[offset + 1] = temp[0] ^ temp[2] ^ temp[3];
      block[offset + 2] = temp[0] ^ temp[1] ^ temp[3];
      block[offset + 3] = temp[0] ^ temp[1] ^ temp[2];
    }
  }

  _invMixColumns(block) {
    for (let col = 0; col < 4; col++) {
      const offset = col * 4;
      const temp = [
        block[offset],
        block[offset + 1],
        block[offset + 2],
        block[offset + 3]
      ];

      block[offset] = temp[1] ^ temp[2] ^ temp[3];
      block[offset + 1] = temp[0] ^ temp[2] ^ temp[3];
      block[offset + 2] = temp[0] ^ temp[1] ^ temp[3];
      block[offset + 3] = temp[0] ^ temp[1] ^ temp[2];
    }
  }
}


  // ===== REGISTRATION =====

  const algorithmInstance = new FROG();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FROG, FROGInstance };
}));
