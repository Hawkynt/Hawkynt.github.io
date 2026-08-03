/*
 * Rabbit (DarkCrypt kernel variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Rabbit stream cipher (Boesgaard, Vesterager, Pedersen, Christiansen,
 * Scavenius, 2003 / RFC 4503) as used by the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project).
 *
 * Key schedule, IV setup and the internal g-function/state-clocking are
 * byte-for-byte identical to RFC 4503 (and to algorithms/stream/rabbit.js
 * in this repository, which passes the RFC 4503 test vectors). The single
 * difference is the keystream word serialization: this variant writes each
 * generated 32-bit counter-combined word S[i] directly in little-endian
 * byte order, OMITTING the RFC 4503 reference "byte-swap" step
 *   S[i] = (S[i] <<< 8) & 0x00ff00ff | (S[i] <<< 24) & 0xff00ff00
 * that the standard RFC 4503 serialization applies before emitting bytes.
 * As implemented in the DarkCrypt Total Commander plugin.
 * 128-bit key, 64-bit IV. Educational only.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function () {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class DarkCryptRabbit extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Rabbit (DarkCrypt)";
      this.description = "DarkCrypt port of the Rabbit stream cipher. Identical state machine to RFC 4503, but the keystream words are serialized in little-endian order instead of RFC 4503's byte-swapped output format.";
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
        new LinkItem("eSTREAM Portfolio", "https://www.ecrypt.eu.org/stream/"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("Cryptico Rabbit Reference Source (eSTREAM archive)", "https://web.archive.org/web/20240708120501/https://www.ecrypt.eu.org/stream/p3ciphers/rabbit/rabbit_p3source.zip"),
        new LinkItem("DarkCrypt / Zarya Total Commander plugin", "https://totalcmd.ru/plugring/darkcryptTC.html")
      ];

      this.tests = [
        {
          text: "DarkCrypt Rablib -- sequential key/IV, 128 zero bytes",
          uri: "https://totalcmd.ru/plugring/darkcryptTC.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000"),
          input: new Array(128).fill(0),
          expected: OpCodes.Hex8ToBytes("a8f7e69b6940a78d136a5c154a157952a6e4235859e30220ea686436bb38ef539c2940556b09ecd7fea2b0ac8307f1696265a3d644281c39c9cd5e1e2f9be4d00d482cb85a874aa55197d99f877c9d91a1489eac8571e85bb7cd2a2d8ff4c183b91f57377310fde711b6ecd2a8e98887e1b3bcfbc0c29134e109c3b92dac44cd")
        },
        {
          text: "DarkCrypt Rablib -- sequential key/IV, incrementing 64-byte input",
          uri: "https://totalcmd.ru/plugring/darkcryptTC.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000"),
          input: (() => { const a = []; for (let i = 0; i < 64; i++) a.push(i); return a; })(),
          expected: OpCodes.Hex8ToBytes("a8f6e4986d45a18a1b63561e4618775db6f5314b4df61437f2717e2da725f14cbc0862764f2ccaf0d68b9a87af2adf46525491e5701d2a0ef1f4642513a6daef")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptRabbitInstance(this, isInverse);
    }
  }

  class DarkCryptRabbitInstance extends IAlgorithmInstance {
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
        output.push(OpCodes.Xor32(this.inputBuffer[i], keystreamByte));
      }

      this.inputBuffer = [];
      return output;
    }

    _initialize() {
      if (!this._key) return;

      const K = new Array(8);
      for (let i = 0; i < 8; i++) {
        K[i] = OpCodes.Or32(this._key[i * 2], OpCodes.Shl32(this._key[i * 2 + 1], 8));
      }

      for (let j = 0; j < 8; j++) {
        if (OpCodes.ToInt(j % 2) === 0) {
          this.X[j] = OpCodes.Or32(OpCodes.Shl32(K[OpCodes.ToInt((j + 1) % 8)], 16), K[j]);
          this.C[j] = OpCodes.Or32(OpCodes.Shl32(K[OpCodes.ToInt((j + 4) % 8)], 16), K[OpCodes.ToInt((j + 5) % 8)]);
        } else {
          this.X[j] = OpCodes.Or32(OpCodes.Shl32(K[OpCodes.ToInt((j + 5) % 8)], 16), K[OpCodes.ToInt((j + 4) % 8)]);
          this.C[j] = OpCodes.Or32(OpCodes.Shl32(K[j], 16), K[OpCodes.ToInt((j + 1) % 8)]);
        }
        this.X[j] = OpCodes.ToUint32(this.X[j]);
        this.C[j] = OpCodes.ToUint32(this.C[j]);
      }

      this.b = 0;

      for (let i = 0; i < 4; i++) {
        this._nextState();
      }

      for (let i = 0; i < 8; i++) {
        this.C[i] = OpCodes.ToUint32(OpCodes.Xor32(this.C[i], this.X[OpCodes.ToInt((i + 4) % 8)]));
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

      const i0 = OpCodes.Or32(OpCodes.And32(OpCodes.RotL32(IV_0, 8), 0x00ff00ff), OpCodes.And32(OpCodes.RotL32(IV_0, 24), 0xff00ff00));
      const i2 = OpCodes.Or32(OpCodes.And32(OpCodes.RotL32(IV_1, 8), 0x00ff00ff), OpCodes.And32(OpCodes.RotL32(IV_1, 24), 0xff00ff00));
      const i1 = OpCodes.Or32(OpCodes.Shr32(i0, 16), OpCodes.And32(i2, 0xffff0000));
      const i3 = OpCodes.Or32(OpCodes.Shl32(i2, 16), OpCodes.And32(i0, 0x0000ffff));

      this.C[0] = OpCodes.ToUint32(OpCodes.Xor32(this.C[0], i0));
      this.C[1] = OpCodes.ToUint32(OpCodes.Xor32(this.C[1], i1));
      this.C[2] = OpCodes.ToUint32(OpCodes.Xor32(this.C[2], i2));
      this.C[3] = OpCodes.ToUint32(OpCodes.Xor32(this.C[3], i3));
      this.C[4] = OpCodes.ToUint32(OpCodes.Xor32(this.C[4], i0));
      this.C[5] = OpCodes.ToUint32(OpCodes.Xor32(this.C[5], i1));
      this.C[6] = OpCodes.ToUint32(OpCodes.Xor32(this.C[6], i2));
      this.C[7] = OpCodes.ToUint32(OpCodes.Xor32(this.C[7], i3));

      for (let i = 0; i < 4; i++) {
        this._nextState();
      }
    }

    _gFunction(x, c) {
      const gx = OpCodes.ToUint32(x + c);
      const ga = OpCodes.And32(gx, 0xffff);
      const gb = OpCodes.Shr32(gx, 16);
      const gh = OpCodes.Shr32(OpCodes.Shr32(ga * ga, 17) + ga * gb, 15) + gb * gb;
      const gl = OpCodes.ToInt(OpCodes.And32(gx, 0xffff0000) * gx) + OpCodes.ToInt(OpCodes.And32(gx, 0x0000ffff) * gx);
      return OpCodes.ToUint32(OpCodes.Xor32(gh, gl));
    }

    _nextState() {
      const C_ = new Array(8);
      for (let i = 0; i < 8; i++) {
        C_[i] = this.C[i];
      }

      this.C[0] = OpCodes.ToInt(this.C[0] + 0x4d34d34d + this.b);
      this.C[1] = OpCodes.ToInt(this.C[1] + 0xd34d34d3 + (OpCodes.ToUint32(this.C[0]) < OpCodes.ToUint32(C_[0]) ? 1 : 0));
      this.C[2] = OpCodes.ToInt(this.C[2] + 0x34d34d34 + (OpCodes.ToUint32(this.C[1]) < OpCodes.ToUint32(C_[1]) ? 1 : 0));
      this.C[3] = OpCodes.ToInt(this.C[3] + 0x4d34d34d + (OpCodes.ToUint32(this.C[2]) < OpCodes.ToUint32(C_[2]) ? 1 : 0));
      this.C[4] = OpCodes.ToInt(this.C[4] + 0xd34d34d3 + (OpCodes.ToUint32(this.C[3]) < OpCodes.ToUint32(C_[3]) ? 1 : 0));
      this.C[5] = OpCodes.ToInt(this.C[5] + 0x34d34d34 + (OpCodes.ToUint32(this.C[4]) < OpCodes.ToUint32(C_[4]) ? 1 : 0));
      this.C[6] = OpCodes.ToInt(this.C[6] + 0x4d34d34d + (OpCodes.ToUint32(this.C[5]) < OpCodes.ToUint32(C_[5]) ? 1 : 0));
      this.C[7] = OpCodes.ToInt(this.C[7] + 0xd34d34d3 + (OpCodes.ToUint32(this.C[6]) < OpCodes.ToUint32(C_[6]) ? 1 : 0));
      this.b = OpCodes.ToUint32(this.C[7]) < OpCodes.ToUint32(C_[7]) ? 1 : 0;

      const G = new Array(8);
      for (let i = 0; i < 8; i++) {
        G[i] = this._gFunction(this.X[i], this.C[i]);
      }

      this.X[0] = OpCodes.ToInt(G[0] + OpCodes.RotL32(G[7], 16) + OpCodes.RotL32(G[6], 16));
      this.X[1] = OpCodes.ToInt(G[1] + OpCodes.RotL32(G[0], 8) + G[7]);
      this.X[2] = OpCodes.ToInt(G[2] + OpCodes.RotL32(G[1], 16) + OpCodes.RotL32(G[0], 16));
      this.X[3] = OpCodes.ToInt(G[3] + OpCodes.RotL32(G[2], 8) + G[1]);
      this.X[4] = OpCodes.ToInt(G[4] + OpCodes.RotL32(G[3], 16) + OpCodes.RotL32(G[2], 16));
      this.X[5] = OpCodes.ToInt(G[5] + OpCodes.RotL32(G[4], 8) + G[3]);
      this.X[6] = OpCodes.ToInt(G[6] + OpCodes.RotL32(G[5], 16) + OpCodes.RotL32(G[4], 16));
      this.X[7] = OpCodes.ToInt(G[7] + OpCodes.RotL32(G[6], 8) + G[5]);
    }

    _generateBlock() {
      this._nextState();

      const S = new Array(4);
      S[0] = OpCodes.Xor32(OpCodes.Xor32(this.X[0], OpCodes.Shr32(this.X[5], 16)), OpCodes.Shl32(this.X[3], 16));
      S[1] = OpCodes.Xor32(OpCodes.Xor32(this.X[2], OpCodes.Shr32(this.X[7], 16)), OpCodes.Shl32(this.X[5], 16));
      S[2] = OpCodes.Xor32(OpCodes.Xor32(this.X[4], OpCodes.Shr32(this.X[1], 16)), OpCodes.Shl32(this.X[7], 16));
      S[3] = OpCodes.Xor32(OpCodes.Xor32(this.X[6], OpCodes.Shr32(this.X[3], 16)), OpCodes.Shl32(this.X[1], 16));

      // NOTE: unlike RFC 4503 (and algorithms/stream/rabbit.js), this variant
      // does NOT apply the byte-swap step here -- it writes each S[i]
      // straight out in little-endian order.
      const keystream = [];

      for (let i = 0; i < 4; i++) {
        keystream.push(OpCodes.ToByte(S[i]));
        keystream.push(OpCodes.ToByte(OpCodes.Shr32(S[i], 8)));
        keystream.push(OpCodes.ToByte(OpCodes.Shr32(S[i], 16)));
        keystream.push(OpCodes.ToByte(OpCodes.Shr32(S[i], 24)));
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

  const algorithmInstance = new DarkCryptRabbit();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DarkCryptRabbit, DarkCryptRabbitInstance };
}));
