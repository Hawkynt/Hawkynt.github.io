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

class Rabbit extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "Rabbit";
    this.description = "High-speed stream cipher with 513-bit internal state using 8 state variables, 8 counter variables, and 1 carry bit. Designed for software implementations with 128-bit keys and optional 64-bit IV.";
    this.inventor = "Martin Boesgaard, Mette Vesterager, Thomas Pedersen, Jesper Christiansen, Ove Scavenius";
    this.year = 2003;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = null;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.DK;

    this.SupportedKeySizes = [new KeySize(16, 16, 1)];
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem("RFC 4503 Specification", "https://tools.ietf.org/html/rfc4503"),
      new LinkItem("eSTREAM Portfolio", "https://www.ecrypt.eu.org/stream/")
    ];

    this.tests = [
      {
        text: "RFC 4503 Test Vector 1 (All-zero key)",
        uri: "https://datatracker.ietf.org/doc/html/rfc4503",
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("B15754F036A5D6ECF56B45261C4AF70288E8D815C59C0C397B696C4789C68AA7")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new RabbitInstance(this, isInverse);
  }
}

class RabbitInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._iv = null;
    this.X = new Array(8);
    this.C = new Array(8);
    this.b = 0;
    this.keystreamBuffer = [];
    this.keystreamPosition = 0;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      return;
    }

    const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
    );

    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this._initialize();
  }

  get key() { return this._key ? [...this._key] : null; }

  set iv(ivBytes) {
    if (!ivBytes) {
      this._iv = null;
    } else {
      this._iv = [...ivBytes];
    }
    if (this._key) {
      this._initialize();
    }
  }

  get iv() { return this._iv ? [...this._iv] : null; }

  set nonce(nonceBytes) {
    this.iv = nonceBytes;
  }

  get nonce() { return this.iv; }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this._key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i++) {
      const keystreamByte = this._getNextKeystreamByte();
      output.push(this.inputBuffer[i] ^ keystreamByte);
    }

    this.inputBuffer = [];
    return output;
  }

  _initialize() {
    if (!this._key) return;

    const K = new Array(8);
    for (let i = 0; i < 8; i++) {
      K[i] = this._key[i*2] | (this._key[i*2+1] << 8);
    }

    for (let j = 0; j < 8; j++) {
      if (j % 2 === 0) {
        this.X[j] = (K[(j+1) & 7] << 16) | K[j];
        this.C[j] = (K[(j+4) & 7] << 16) | K[(j+5) & 7];
      } else {
        this.X[j] = (K[(j+5) & 7] << 16) | K[(j+4) & 7];
        this.C[j] = (K[j] << 16) | K[(j+1) & 7];
      }
      this.X[j] = this.X[j] >>> 0;
      this.C[j] = this.C[j] >>> 0;
    }

    this.b = 0;

    for (let i = 0; i < 4; i++) {
      this._nextState();
    }

    for (let i = 0; i < 8; i++) {
      this.C[i] = (this.C[i] ^ this.X[(i + 4) & 7]) >>> 0;
    }

    if (this._iv && this._iv.length >= 8) {
      this._ivSetup();
    }

    this.keystreamBuffer = [];
    this.keystreamPosition = 0;
  }

  _ivSetup() {
    const IV_0 = OpCodes.Pack32LE(this._iv[0], this._iv[1], this._iv[2], this._iv[3]);
    const IV_1 = OpCodes.Pack32LE(this._iv[4], this._iv[5], this._iv[6], this._iv[7]);

    const i0 = (OpCodes.RotL32(IV_0, 8) & 0x00ff00ff) | (OpCodes.RotL32(IV_0, 24) & 0xff00ff00);
    const i2 = (OpCodes.RotL32(IV_1, 8) & 0x00ff00ff) | (OpCodes.RotL32(IV_1, 24) & 0xff00ff00);
    const i1 = (i0 >>> 16) | (i2 & 0xffff0000);
    const i3 = (i2 << 16) | (i0 & 0x0000ffff);

    this.C[0] = (this.C[0] ^ i0) >>> 0;
    this.C[1] = (this.C[1] ^ i1) >>> 0;
    this.C[2] = (this.C[2] ^ i2) >>> 0;
    this.C[3] = (this.C[3] ^ i3) >>> 0;
    this.C[4] = (this.C[4] ^ i0) >>> 0;
    this.C[5] = (this.C[5] ^ i1) >>> 0;
    this.C[6] = (this.C[6] ^ i2) >>> 0;
    this.C[7] = (this.C[7] ^ i3) >>> 0;

    for (let i = 0; i < 4; i++) {
      this._nextState();
    }
  }

  _gFunction(x, c) {
    const gx = (x + c) >>> 0;
    const ga = gx & 0xffff;
    const gb = gx >>> 16;
    const gh = ((((ga * ga) >>> 17) + ga * gb) >>> 15) + gb * gb;
    const gl = (((gx & 0xffff0000) * gx) | 0) + (((gx & 0x0000ffff) * gx) | 0);
    return (gh ^ gl) >>> 0;
  }

  _nextState() {
    const C_ = new Array(8);
    for (let i = 0; i < 8; i++) {
      C_[i] = this.C[i];
    }

    this.C[0] = (this.C[0] + 0x4d34d34d + this.b) | 0;
    this.C[1] = (this.C[1] + 0xd34d34d3 + ((this.C[0] >>> 0) < (C_[0] >>> 0) ? 1 : 0)) | 0;
    this.C[2] = (this.C[2] + 0x34d34d34 + ((this.C[1] >>> 0) < (C_[1] >>> 0) ? 1 : 0)) | 0;
    this.C[3] = (this.C[3] + 0x4d34d34d + ((this.C[2] >>> 0) < (C_[2] >>> 0) ? 1 : 0)) | 0;
    this.C[4] = (this.C[4] + 0xd34d34d3 + ((this.C[3] >>> 0) < (C_[3] >>> 0) ? 1 : 0)) | 0;
    this.C[5] = (this.C[5] + 0x34d34d34 + ((this.C[4] >>> 0) < (C_[4] >>> 0) ? 1 : 0)) | 0;
    this.C[6] = (this.C[6] + 0x4d34d34d + ((this.C[5] >>> 0) < (C_[5] >>> 0) ? 1 : 0)) | 0;
    this.C[7] = (this.C[7] + 0xd34d34d3 + ((this.C[6] >>> 0) < (C_[6] >>> 0) ? 1 : 0)) | 0;
    this.b = (this.C[7] >>> 0) < (C_[7] >>> 0) ? 1 : 0;

    const G = new Array(8);
    for (let i = 0; i < 8; i++) {
      G[i] = this._gFunction(this.X[i], this.C[i]);
    }

    this.X[0] = (G[0] + OpCodes.RotL32(G[7], 16) + OpCodes.RotL32(G[6], 16)) | 0;
    this.X[1] = (G[1] + OpCodes.RotL32(G[0], 8) + G[7]) | 0;
    this.X[2] = (G[2] + OpCodes.RotL32(G[1], 16) + OpCodes.RotL32(G[0], 16)) | 0;
    this.X[3] = (G[3] + OpCodes.RotL32(G[2], 8) + G[1]) | 0;
    this.X[4] = (G[4] + OpCodes.RotL32(G[3], 16) + OpCodes.RotL32(G[2], 16)) | 0;
    this.X[5] = (G[5] + OpCodes.RotL32(G[4], 8) + G[3]) | 0;
    this.X[6] = (G[6] + OpCodes.RotL32(G[5], 16) + OpCodes.RotL32(G[4], 16)) | 0;
    this.X[7] = (G[7] + OpCodes.RotL32(G[6], 8) + G[5]) | 0;
  }

  _generateBlock() {
    this._nextState();

    const S = new Array(4);
    S[0] = this.X[0] ^ (this.X[5] >>> 16) ^ (this.X[3] << 16);
    S[1] = this.X[2] ^ (this.X[7] >>> 16) ^ (this.X[5] << 16);
    S[2] = this.X[4] ^ (this.X[1] >>> 16) ^ (this.X[7] << 16);
    S[3] = this.X[6] ^ (this.X[3] >>> 16) ^ (this.X[1] << 16);

    const keystream = [];

    for (let i = 0; i < 4; i++) {
      S[i] = (OpCodes.RotL32(S[i], 8) & 0x00ff00ff) | (OpCodes.RotL32(S[i], 24) & 0xff00ff00);
    }

    for (let i = 3; i >= 0; i--) {
      keystream.push(S[i] & 0xFF);
      keystream.push((S[i] >>> 8) & 0xFF);
      keystream.push((S[i] >>> 16) & 0xFF);
      keystream.push((S[i] >>> 24) & 0xFF);
    }

    return keystream;
  }

  _getNextKeystreamByte() {
    if (this.keystreamPosition >= this.keystreamBuffer.length) {
      this.keystreamBuffer = this._generateBlock();
      this.keystreamPosition = 0;
    }

    return this.keystreamBuffer[this.keystreamPosition++];
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new Rabbit();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Rabbit, RabbitInstance };
}));
