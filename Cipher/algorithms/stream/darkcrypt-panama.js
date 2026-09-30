/*
 * Panama (DarkCrypt stream cipher mode) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Panama pseudo-random keystream generator (belt-and-mill construction)
 * as used by the DarkCrypt Total Commander plugin (Alexander Myasnikov,
 * "Zarya" project). Panama's hash/MAC mode is already covered by
 * algorithms/hash/panama.js; this file implements the distinct genuine
 * stream-cipher (PRNG) mode:
 *   1. Reset mill/belt state to zero.
 *   2. Push the 256-bit key as one 32-byte block.
 *   3. Push the 256-bit IV as one 32-byte block.
 *   4. Perform 32 blank ("blind") iterations to diffuse key/IV material
 *      through the belt before any output is produced.
 *   5. Repeatedly pull 32-byte keystream blocks, little-endian word order,
 *      XORed with plaintext to produce ciphertext.
 * The belt-and-mill core matches the published "Fast Hashing and Stream
 * Encryption with PANAMA" specification exactly. Test vectors verified
 * against the DarkCrypt implementation (setup(key,iv)+crypt(buf,len) in place).
 * 256-bit key, 256-bit IV. Educational only.
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
          StreamCipherAlgorithm, IAlgorithmInstance,
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const STAGES = 32;      // belt stages
  const STAGE_SIZE = 8;   // words per stage
  const BLANK_ROUNDS = 32;

  /**
   * Panama belt-and-mill state machine core (little-endian word order).
   */
  class PanamaCore {
    constructor() {
      this.reset();
    }

    reset() {
      /** @type {uint32[]} */
      this.a = new Uint32Array(17);
      /** @type {uint32[][]} */
      this.b = new Array(STAGES);
      for (let i = 0; i < STAGES; i++) this.b[i] = new Uint32Array(STAGE_SIZE);
      /** @type {int32} */
      this.bstart = 0;
    }

    /**
     * @param {int32} i - Mill word position
     * @returns {int32} Index of that word after the gamma permutation
     */
    _aIndex(i) { return (i * 13 + 16) % 17; }

    /**
     * One round of the belt-and-mill machine.
     * @param {uint32[]|null} input - 8-word block to push, or null to pull.
     * @param {uint8[]|null} output - if given, 32 bytes of keystream are appended.
     */
    _iterate(input, output) {
      const c = new Uint32Array(17);

      if (output) {
        for (let i = 0; i < STAGE_SIZE; i++) {
          const word = this.a[this._aIndex(i + 9)];
          const bytes = OpCodes.Unpack32LE(word);
          output.push(bytes[0]);
          output.push(bytes[1]);
          output.push(bytes[2]);
          output.push(bytes[3]);
        }
      }

      const b16 = this.b[OpCodes.And32(this.bstart + 16, STAGES - 1)];
      const b4 = this.b[OpCodes.And32(this.bstart + (STAGES - 4), STAGES - 1)];

      this.bstart = OpCodes.And32(this.bstart + 1, STAGES - 1);

      const b0 = this.b[this.bstart];
      const b25 = this.b[OpCodes.And32(this.bstart + (STAGES - 25), STAGES - 1)];

      if (input) {
        for (let i = 0; i < STAGE_SIZE; i++) {
          const t = b0[i];
          b0[i] = OpCodes.Xor32(input[i], t);
          b25[(i + 6) % STAGE_SIZE] = OpCodes.Xor32(b25[(i + 6) % STAGE_SIZE], t);
        }
      } else {
        for (let i = 0; i < STAGE_SIZE; i++) {
          const t = b0[i];
          b0[i] = OpCodes.Xor32(this.a[this._aIndex(i + 1)], t);
          b25[(i + 6) % STAGE_SIZE] = OpCodes.Xor32(b25[(i + 6) % STAGE_SIZE], t);
        }
      }

      for (let i = 0; i < 17; i++) {
        const ai = this.a[this._aIndex(i)];
        const ai1 = this.a[this._aIndex((i + 1) % 17)];
        const ai2 = this.a[this._aIndex((i + 2) % 17)];
        const notAi2 = OpCodes.ToUint32(~ai2);
        const gamma = OpCodes.Xor32(ai, OpCodes.ToUint32(ai1 | notAi2));
        const pos = (5 * i) % 17;
        const rotation = (pos * (pos + 1) / 2) % 32;
        c[this._aIndex(pos)] = OpCodes.RotL32(gamma, rotation);
      }

      const theta0_1 = OpCodes.Xor32(c[this._aIndex(0)], c[this._aIndex(1)]);
      const theta0_2 = OpCodes.Xor32(theta0_1, c[this._aIndex(4)]);
      this.a[this._aIndex(0)] = OpCodes.Xor32(theta0_2, 1);

      if (input) {
        for (let i = 0; i < STAGE_SIZE; i++) {
          const xor1 = OpCodes.Xor32(c[this._aIndex(i + 1)], c[this._aIndex((i + 2) % 17)]);
          const xor2 = OpCodes.Xor32(xor1, c[this._aIndex((i + 5) % 17)]);
          this.a[this._aIndex(i + 1)] = OpCodes.Xor32(xor2, input[i]);
        }
      } else {
        for (let i = 0; i < STAGE_SIZE; i++) {
          const xor1 = OpCodes.Xor32(c[this._aIndex(i + 1)], c[this._aIndex((i + 2) % 17)]);
          const xor2 = OpCodes.Xor32(xor1, c[this._aIndex((i + 5) % 17)]);
          this.a[this._aIndex(i + 1)] = OpCodes.Xor32(xor2, b4[i]);
        }
      }

      for (let i = 0; i < STAGE_SIZE; i++) {
        const xor1 = OpCodes.Xor32(c[this._aIndex(i + 9)], c[this._aIndex((i + 10) % 17)]);
        const xor2 = OpCodes.Xor32(xor1, c[this._aIndex((i + 13) % 17)]);
        this.a[this._aIndex(i + 9)] = OpCodes.Xor32(xor2, b16[i]);
      }
    }
  }

  class DarkCryptPanamaAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Panama (DarkCrypt)";
      this.description = "Panama belt-and-mill construction used as a keystream generator (PRNG mode), as implemented in the DarkCrypt Total Commander plugin. Distinct from the Panama hermetic hash/MAC mode. 256-bit key, 256-bit IV.";
      this.inventor = "Joan Daemen, Craig Clapp";
      this.year = 1998;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("Panama Specification (FSE'98)", "http://www.weidai.com/scan-mirror/md.html#Panama"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Cryptanalytic weaknesses", "Panama's compression function has known collision/distinguishing attacks; the PRNG mode is unanalyzed for stream-cipher use.", "Use a vetted modern stream cipher.")
      ];

      this.tests = [
        {
          text: "DarkCrypt keystream, incremental key",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("18bfb00205af08bb4e294f897aedd0abe99a80b203a3e25d53de52929c02c2cf2b66dee8dd0de55cc17a8877f9bbd02e4ea046c1997ec0d86cf4cb122fe17e754cd8ad9306221c72f772ddce75504016fa43150b49e7d79e303488a4b2150b4557da010d74a300375687994f2cae9c87767d6448a9cf30fba41be0ac39ff2271")
        },
        {
          text: "DarkCrypt incremental plaintext, incremental key",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("18beb20101aa0ebc4620458276e0dea4f98b92a117b6f44a4bc74889801fdcd00b47fccbf928c37be953a25cd596fe017e9174f2ad4bf6ef54cdf12913dc404a")
        },
        {
          text: "DarkCrypt Panama — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("03203d5a7794b1ceeb0825425f7c99b6d3f00d2a4764819ebbd8f5122f4c6986a3c0ddfa1734516e8ba8c5e2ff1c3956"),
          key: OpCodes.Hex8ToBytes("0b30557a9fc4e90e33587da2c7ec11365b80a5caef14395e83a8cdf2173c6186"),
          iv: OpCodes.Hex8ToBytes("073c71a6db10457aafe4194e83b8ed22578cc1f62b6095caff34699ed3083d72"),
          expected: OpCodes.Hex8ToBytes("51696579a2eb522e3f583b213bdba819ccf024a8385436b4239264ffcaa8430162a9ac95789b7aaf03d7986fa221c8a8")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptPanamaInstance(this, isInverse);
    }
  }

  class DarkCryptPanamaInstance extends IAlgorithmInstance {
    /**
     * @param {DarkCryptPanamaAlgorithm} algorithm
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
      this._iv = null;
      /** @type {int32} */
      this.IV_SIZE = 32;

      /** @type {PanamaCore|null} */
      this.core = null;
      /** @type {uint8[]} */
      this.keystreamBuffer = [];
      /** @type {int32} */
      this.keystreamPosition = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      const sizes = this.keySizeList;
      let isValidSize = false;
      for (let k = 0; k < sizes.length; k++) {
        const ks = sizes[k];
        if (keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize) {
          isValidSize = true;
          break;
        }
      }
      if (!isValidSize) throw new Error("Invalid key size: " + keyBytes.length + " bytes");
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }

    /**
     * @returns {uint8[]|null}
     */
    get key() { return this._key ? [...this._key] : null; }

    /**
     * @param {uint8[]|null} ivBytes
     */
    set iv(ivBytes) {
      if (!ivBytes || ivBytes.length !== this.IV_SIZE) {
        this._iv = OpCodes.CreateArray(this.IV_SIZE, 0);
      } else {
        this._iv = [...ivBytes];
      }
      if (this._key) this._initialize();
    }

    /**
     * @returns {uint8[]|null}
     */
    get iv() { return this._iv ? [...this._iv] : null; }

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
        /** @type {uint8[]} */
        const empty = [];
        return empty;
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

    /**
     * @param {uint8[]} bytes
     * @returns {uint32[]}
     */
    _wordsFromBytes(bytes) {
      /** @type {uint32[]} */
      const w = new Uint32Array(STAGE_SIZE);
      for (let i = 0; i < STAGE_SIZE; i++) {
        w[i] = OpCodes.Pack32LE(bytes[i * 4], bytes[i * 4 + 1], bytes[i * 4 + 2], bytes[i * 4 + 3]);
      }
      return w;
    }

    _initialize() {
      if (!this._key || !this._iv) return;

      this.core = new PanamaCore();

      const keyWords = this._wordsFromBytes(this._key);
      const ivWords = this._wordsFromBytes(this._iv);

      this.core._iterate(keyWords, null);
      this.core._iterate(ivWords, null);
      for (let i = 0; i < BLANK_ROUNDS; i++) this.core._iterate(null, null);

      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
    }

    /**
     * @returns {uint8[]}
     */
    _generateBlock() {
      /** @type {uint8[]} */
      const keystream = [];
      this.core._iterate(null, keystream);
      return keystream;
    }

    /**
     * @returns {uint8}
     */
    _getNextKeystreamByte() {
      if (this.keystreamPosition >= this.keystreamBuffer.length) {
        this.keystreamBuffer = this._generateBlock();
        this.keystreamPosition = 0;
      }
      return this.keystreamBuffer[this.keystreamPosition++];
    }
  }

  const algorithmInstance = new DarkCryptPanamaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptPanamaAlgorithm, DarkCryptPanamaInstance };
}));
