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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

class Salsa20 extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "Salsa20";
    this.description = "ARX-based stream cipher designed for high performance and security using Addition, Rotation, and XOR operations. Part of eSTREAM portfolio with no S-boxes or lookup tables required.";
    this.inventor = "Daniel J. Bernstein";
    this.year = 2005;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = null;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    this.SupportedKeySizes = [new KeySize(16, 32, 16)];
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem("Salsa20 Specification", "https://cr.yp.to/snuffle/spec.pdf"),
      new LinkItem("RFC 7914", "https://tools.ietf.org/html/rfc7914"),
      new LinkItem("eSTREAM Portfolio", "https://www.ecrypt.eu.org/stream/")
    ];

    this.references = [
      new LinkItem("Official Reference Implementation (D.J. Bernstein, public domain)", "https://cr.yp.to/snuffle/salsa20/ref/salsa20.c")
    ];

    this.tests = [
      {
        text: "eSTREAM Salsa20 Set 1, Vector 0 (128-bit key)",
        uri: "https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/salsa20/",
        key: OpCodes.Hex8ToBytes("80000000000000000000000000000000"),
        nonce: OpCodes.Hex8ToBytes("0000000000000000"),
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("4dfa5e481da23ea09a31022050859936")
      },
      {
        text: "eSTREAM Salsa20 Set 6, Vector 0 (256-bit key)",
        uri: "https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/salsa20/",
        key: OpCodes.Hex8ToBytes("8000000000000000000000000000000000000000000000000000000000000000"),
        nonce: OpCodes.Hex8ToBytes("0000000000000000"),
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("e3be8fdd8beca2e3ea8ef9475b29a6e7")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new Salsa20Instance(this, isInverse);
  }
}

class Salsa20Instance extends IAlgorithmInstance {
  /**
   * @param {Salsa20} algorithm
   * @param {boolean} [isInverse=false]
   */
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    /** @type {KeySize[]} */
    this.keySizeList = algorithm.SupportedKeySizes;
    /** @type {boolean} */
    this.isInverse = isInverse;
    /** @type {uint8[]} */
    this.inputBuffer = [];
    /** @type {uint8[]|null} */
    this._key = null;
    /** @type {uint8[]|null} */
    this._nonce = OpCodes.CreateArray(8, 0);
    /** @type {uint32[]} */
    this._blockNumber = [0, 0];
    /** @type {uint32[]} */
    this._matrix = new Array(16);
    /** @type {uint8[]} */
    this.keystreamBuffer = [];
    /** @type {int32} */
    this.bufferIndex = 0;

    /** @type {uint32[]} */
    this.CONSTANTS_32 = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];
    /** @type {uint32[]} */
    this.CONSTANTS_16 = [0x61707865, 0x3120646e, 0x79622d36, 0x6b206574];
  }

  /**
   * @param {uint8[]|null} keyBytes
   */
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      return;
    }

    const sizes = this.keySizeList;
    let isValidSize = false;
    for (let k = 0; k < sizes.length; k++) {
      const ks = sizes[k];
      if (keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize) {
        isValidSize = true;
        break;
      }
    }

    if (!isValidSize) {
      throw new Error("Invalid key size: " + keyBytes.length + " bytes");
    }

    this._key = [...keyBytes];
    this._setupState();
  }

  /**
   * @returns {uint8[]|null}
   */
  get key() { return this._key ? [...this._key] : null; }

  /**
   * @param {uint8[]|null} nonceBytes
   */
  set nonce(nonceBytes) {
    if (!nonceBytes || nonceBytes.length !== 8) {
      this._nonce = OpCodes.CreateArray(8, 0);
    } else {
      this._nonce = [...nonceBytes];
    }
    this._setupState();
  }

  /**
   * @returns {uint8[]|null}
   */
  get nonce() { return this._nonce ? [...this._nonce] : null; }

  /**
   * @param {uint8[]} data
   */
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
  }

  /**
   * @returns {uint8[]}
   */
  Result() {
    if (!this._key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) {
      throw new Error("No data fed");
    }

    /** @type {uint8[]} */
    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i++) {
      const keystreamByte = this._getNextKeystreamByte();
      output.push(OpCodes.Xor8(this.inputBuffer[i], keystreamByte));
    }

    this.inputBuffer = [];
    return output;
  }

  _setupState() {
    if (!this._key || !this._nonce) return;

    /** @type {uint32[]} */
    const constants = (this._key.length === 32) ? this.CONSTANTS_32 : this.CONSTANTS_16;

    this._matrix[0] = constants[0];
    this._matrix[5] = constants[1];
    this._matrix[10] = constants[2];
    this._matrix[15] = constants[3];

    if (this._key.length === 32) {
      this._matrix[1] = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      this._matrix[2] = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
      this._matrix[3] = OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]);
      this._matrix[4] = OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]);
      this._matrix[11] = OpCodes.Pack32LE(this._key[16], this._key[17], this._key[18], this._key[19]);
      this._matrix[12] = OpCodes.Pack32LE(this._key[20], this._key[21], this._key[22], this._key[23]);
      this._matrix[13] = OpCodes.Pack32LE(this._key[24], this._key[25], this._key[26], this._key[27]);
      this._matrix[14] = OpCodes.Pack32LE(this._key[28], this._key[29], this._key[30], this._key[31]);
    } else {
      this._matrix[1] = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      this._matrix[2] = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
      this._matrix[3] = OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]);
      this._matrix[4] = OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]);
      this._matrix[11] = this._matrix[1];
      this._matrix[12] = this._matrix[2];
      this._matrix[13] = this._matrix[3];
      this._matrix[14] = this._matrix[4];
    }

    this._matrix[6] = OpCodes.Pack32LE(this._nonce[0], this._nonce[1], this._nonce[2], this._nonce[3]);
    this._matrix[7] = OpCodes.Pack32LE(this._nonce[4], this._nonce[5], this._nonce[6], this._nonce[7]);

    this._blockNumber = [0, 0];
    this._matrix[8] = 0;
    this._matrix[9] = 0;

    this.keystreamBuffer = [];
    this.bufferIndex = 0;
  }

  /**
   * @param {uint32} y0
   * @param {uint32} y1
   * @param {uint32} y2
   * @param {uint32} y3
   * @returns {uint32[]}
   */
  _quarterRound(y0, y1, y2, y3) {
    const z1 = OpCodes.Xor32(y1, OpCodes.RotL32(OpCodes.Add32(y0, y3), 7));
    const z2 = OpCodes.Xor32(y2, OpCodes.RotL32(OpCodes.Add32(z1, y0), 9));
    const z3 = OpCodes.Xor32(y3, OpCodes.RotL32(OpCodes.Add32(z2, z1), 13));
    const z0 = OpCodes.Xor32(y0, OpCodes.RotL32(OpCodes.Add32(z3, z2), 18));

    /** @type {uint32[]} */
    const words = [OpCodes.ToUint32(z0), OpCodes.ToUint32(z1), OpCodes.ToUint32(z2), OpCodes.ToUint32(z3)];
    return words;
  }

  /**
   * @param {uint32[]} words
   * @returns {uint32[]}
   */
  _salsa20Core(words) {
    /** @type {uint32[]} */
    const w = new Array(16);
    /** @type {uint32[]} */
    const x = new Array(16);
    /** @type {uint32[]} */
    const y = new Array(16);
    /** @type {uint32[]} */
    const t = new Array(4);

    for (let i = 0; i < 16; i++) {
      x[i] = y[i] = words[i];
    }

    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 4; j++) {
        for (let m = 0; m < 4; m++) {
          t[m] = x[(5*j + 4*m) % 16];
        }

        t[1] = OpCodes.Xor32(t[1], OpCodes.RotL32(OpCodes.Add32(t[0], t[3]), 7));
        t[2] = OpCodes.Xor32(t[2], OpCodes.RotL32(OpCodes.Add32(t[1], t[0]), 9));
        t[3] = OpCodes.Xor32(t[3], OpCodes.RotL32(OpCodes.Add32(t[2], t[1]), 13));
        t[0] = OpCodes.Xor32(t[0], OpCodes.RotL32(OpCodes.Add32(t[3], t[2]), 18));

        for (let m = 0; m < 4; m++) {
          w[4*j + (j+m) % 4] = t[m];
        }
      }
      for (let m = 0; m < 16; m++) {
        x[m] = w[m];
      }
    }

    /** @type {uint32[]} */
    const sum = new Array(16);
    for (let i = 0; i < 16; i++) {
      sum[i] = OpCodes.Add32(x[i], y[i]);
    }

    return sum;
  }

  /**
   * @returns {uint8[]}
   */
  _generateBlock() {
    this._matrix[8] = this._blockNumber[0];
    this._matrix[9] = this._blockNumber[1];

    /** @type {uint32[]} */
    const words = this._salsa20Core(this._matrix);

    /** @type {uint8[]} */
    const keystream = [];
    for (let i = 0; i < 16; i++) {
      const bytes = OpCodes.Unpack32LE(words[i]);
      keystream.push(bytes[0]);
      keystream.push(bytes[1]);
      keystream.push(bytes[2]);
      keystream.push(bytes[3]);
    }

    this._blockNumber[0] = OpCodes.Add32(this._blockNumber[0], 1);
    if (this._blockNumber[0] === 0) {
      this._blockNumber[1] = OpCodes.Add32(this._blockNumber[1], 1);
    }

    return keystream;
  }

  /**
   * @returns {uint8}
   */
  _getNextKeystreamByte() {
    if (this.bufferIndex >= this.keystreamBuffer.length) {
      this.keystreamBuffer = this._generateBlock();
      this.bufferIndex = 0;
    }

    return this.keystreamBuffer[this.bufferIndex++];
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new Salsa20();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Salsa20, Salsa20Instance };
}));
