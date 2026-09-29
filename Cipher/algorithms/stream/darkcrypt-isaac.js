/*
 * ISAAC (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ISAAC PRNG as exposed as a stream cipher by the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). The core ISAAC round and
 * seed-mixing routine are Bob Jenkins's standard algorithm, unmodified.
 * DarkCrypt's wrapper differs from a typical ISAAC-as-stream-cipher usage:
 *   - setup() takes a full 1024-byte (256-word) seed buffer (the complete
 *     ISAAC "randrsl" array, not a short key) and copies it directly in,
 *     with no truncation/expansion
 *   - after the standard seed-mixing (randinit, which itself performs one
 *     isaac() round internally per the reference algorithm), the DarkCrypt
 *     setup() discards 256 additional isaac() rounds before crypt() is ever
 *     called (an extra warm-up not present in the reference implementation)
 *   - crypt(buf, len) runs exactly one more isaac() round per call and XORs
 *     the first `len` bytes of the resulting 256-word result array, read as
 *     raw little-endian bytes, into the buffer in place; it does not
 *     consume the array incrementally across calls
 * Test vectors generated from the DarkCrypt implementation (setup takes a
 * single argument; crypt(buf,len) takes two arguments). Educational only.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  const STATE_SIZE = 256;          // words
  const SEED_BYTES = 1024;         // 256 * 4
  /** @type {uint32} */
  const GOLDEN_RATIO = 0x9e3779b9;
  const SETUP_DISCARD_ROUNDS = 256; // DarkCrypt-specific extra warm-up

  /**
   * @param {int32} n - Word count
   * @param {uint32} value - Fill value
   * @returns {uint32[]} n words set to value
   */
  function filledWords(n, value) {
    /** @type {uint32[]} */
    const words = new Array(n);
    for (let i = 0; i < n; ++i) words[i] = value;
    return words;
  }

  // Bob Jenkins's mix() macro, applied to an 8-word accumulator.
  /**
   * @param {uint32[]} x
   */
  function mix(x) {
    x[0] = OpCodes.Xor32(x[0], OpCodes.Shl32(x[1], 11)); x[3] = OpCodes.Add32(x[3], x[0]); x[1] = OpCodes.Add32(x[1], x[2]);
    x[1] = OpCodes.Xor32(x[1], OpCodes.Shr32(x[2], 2));  x[4] = OpCodes.Add32(x[4], x[1]); x[2] = OpCodes.Add32(x[2], x[3]);
    x[2] = OpCodes.Xor32(x[2], OpCodes.Shl32(x[3], 8));  x[5] = OpCodes.Add32(x[5], x[2]); x[3] = OpCodes.Add32(x[3], x[4]);
    x[3] = OpCodes.Xor32(x[3], OpCodes.Shr32(x[4], 16)); x[6] = OpCodes.Add32(x[6], x[3]); x[4] = OpCodes.Add32(x[4], x[5]);
    x[4] = OpCodes.Xor32(x[4], OpCodes.Shl32(x[5], 10)); x[7] = OpCodes.Add32(x[7], x[4]); x[5] = OpCodes.Add32(x[5], x[6]);
    x[5] = OpCodes.Xor32(x[5], OpCodes.Shr32(x[6], 4));  x[0] = OpCodes.Add32(x[0], x[5]); x[6] = OpCodes.Add32(x[6], x[7]);
    x[6] = OpCodes.Xor32(x[6], OpCodes.Shl32(x[7], 8));  x[1] = OpCodes.Add32(x[1], x[6]); x[7] = OpCodes.Add32(x[7], x[0]);
    x[7] = OpCodes.Xor32(x[7], OpCodes.Shr32(x[0], 9));  x[2] = OpCodes.Add32(x[2], x[7]); x[0] = OpCodes.Add32(x[0], x[1]);
  }

  class DarkCryptISAACAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "ISAAC (DarkCrypt)";
      this.description = "Bob Jenkins's ISAAC PRNG wrapped as a stream cipher by the DarkCrypt Total Commander plugin. Seeds from a full 1024-byte state buffer, discards 256 extra rounds during setup, and XORs raw little-endian keystream bytes.";
      this.inventor = "Bob Jenkins (base ISAAC design); DarkCrypt wrapper by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(SEED_BYTES, SEED_BYTES, 0)];   // fixed 1024-byte seed
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("ISAAC Homepage - Bob Jenkins", "https://www.burtleburtle.net/bob/rand/isaacafa.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard wrapper", "Uses the unmodified ISAAC core but a bespoke setup/crypt protocol; unanalyzed and not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation
      // (setup(seed[1024]) then crypt(buf,len) in-place XOR).
      this.tests = [
        {
          text: "DarkCrypt Isaac — 1024-byte incrementing seed, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: (function () {
            const k = new Array(SEED_BYTES);
            for (let i = 0; i < SEED_BYTES; i++) k[i] = OpCodes.And32(i, 0xFF);
            return k;
          })(),
          expected: OpCodes.Hex8ToBytes("c86ae56681b5ff86a91004199a995a5c8d699a0f454b79a250401a4b6e0acee38e2c8beea25b40270f18903e25622020caffb586a47b679e47b7961c2173db60f6672ae9fbeebe295aacc2812b27cec56d046bcbf4c5868ee2bcb0db5e56f23781efcdd0e2f5d6eebcef2baae8756a09005646a53684c5c8ff42cd0ed0a31342")
        },
        {
          text: "DarkCrypt Isaac — 1024-byte incrementing seed, incrementing plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: (function () {
            const k = new Array(SEED_BYTES);
            for (let i = 0; i < SEED_BYTES; i++) k[i] = OpCodes.And32(i, 0xFF);
            return k;
          })(),
          expected: OpCodes.Hex8ToBytes("c86be76585b0f981a1190e12969454539d78881c515e6fb5485900507217d0fcae0da9cd867e66002731ba15094f0e0fface87b5904e51a97f8eac271d4ee55f")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptISAACInstance(this, isInverse);
    }
  }

  class DarkCryptISAACInstance extends IAlgorithmInstance {
    /**
     * @param {DarkCryptISAACAlgorithm} algorithm
     * @param {boolean} [isInverse=false]
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint32[]|null} */
      this._mm = null;
      /** @type {uint32[]|null} */
      this._randrsl = null;
      /** @type {uint32} */
      this._aa = 0;
      /** @type {uint32} */
      this._bb = 0;
      /** @type {uint32} */
      this._cc = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== SEED_BYTES)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. ISAAC (DarkCrypt) requires exactly " + SEED_BYTES + " bytes");
      this._key = [...keyBytes];
      this._initialize();
    }

    /**
     * @returns {uint8[]|null}
     */
    get key() { return this._key ? [...this._key] : null; }

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
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      /** @type {uint8[]} */
      const keystream = this._crypt(this.inputBuffer.length);
      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) output.push(OpCodes.Xor32(this.inputBuffer[i], keystream[i]));

      this.inputBuffer = [];
      return output;
    }

    _initialize() {
      this._mm = filledWords(STATE_SIZE, 0);
      this._randrsl = filledWords(STATE_SIZE, 0);
      this._aa = 0;
      this._bb = 0;
      this._cc = 0;

      for (let i = 0; i < STATE_SIZE; i++) {
        const o = i * 4;
        this._randrsl[i] = OpCodes.Pack32LE(this._key[o], this._key[o + 1], this._key[o + 2], this._key[o + 3]);
      }

      this._randinit();

      // DarkCrypt setup() discards 256 extra rounds beyond the one already
      // performed at the end of randinit().
      for (let i = 0; i < SETUP_DISCARD_ROUNDS; i++) this._isaac();
    }

    _randinit() {
      /** @type {uint32[]} */
      const x = filledWords(8, GOLDEN_RATIO);
      for (let i = 0; i < 4; i++) mix(x);

      for (let pass = 0; pass < 2; pass++) {
        /** @type {uint32[]} */
        const source = pass === 0 ? this._randrsl : this._mm;
        for (let j = 0; j < STATE_SIZE; j += 8) {
          for (let k = 0; k < 8; k++) x[k] = OpCodes.Add32(x[k], source[j + k]);
          mix(x);
          for (let k = 0; k < 8; k++) this._mm[j + k] = x[k];
        }
      }

      // Reference randinit() ends with one isaac() round.
      this._isaac();
    }

    _isaac() {
      this._cc = OpCodes.Add32(this._cc, 1);
      this._bb = OpCodes.Add32(this._bb, this._cc);

      for (let i = 0; i < STATE_SIZE; i++) {
        /** @type {uint32} */
        const x = this._mm[i];

        switch (OpCodes.And32(i, 3)) {
          case 0: this._aa = OpCodes.Xor32(this._aa, OpCodes.Shl32(this._aa, 13)); break;
          case 1: this._aa = OpCodes.Xor32(this._aa, OpCodes.Shr32(this._aa, 6)); break;
          case 2: this._aa = OpCodes.Xor32(this._aa, OpCodes.Shl32(this._aa, 2)); break;
          case 3: this._aa = OpCodes.Xor32(this._aa, OpCodes.Shr32(this._aa, 16)); break;
        }

        this._aa = OpCodes.Add32(this._aa, this._mm[OpCodes.And32(i + 128, 0xFF)]);
        const y = OpCodes.Add32(OpCodes.Add32(this._mm[OpCodes.And32(OpCodes.Shr32(x, 2), 0xFF)], this._aa), this._bb);
        this._mm[i] = y;
        this._bb = OpCodes.Add32(this._mm[OpCodes.And32(OpCodes.Shr32(y, 10), 0xFF)], x);
        this._randrsl[i] = this._bb;
      }
    }

    /**
     * @param {int32} len
     * @returns {uint8[]}
     */
    _crypt(len) {
      this._isaac();
      /** @type {uint8[]} */
      const out = new Array(len);
      for (let i = 0; i < len; i++) {
        /** @type {uint32} */
        const word = this._randrsl[OpCodes.Shr32(i, 2)];
        out[i] = OpCodes.And32(OpCodes.Shr32(word, OpCodes.Shl32(OpCodes.And32(i, 3), 3)), 0xFF);
      }
      return out;
    }
  }

  const algorithmInstance = new DarkCryptISAACAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptISAACAlgorithm, DarkCryptISAACInstance };
}));
