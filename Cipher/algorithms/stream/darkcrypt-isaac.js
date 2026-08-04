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
  const GOLDEN_RATIO = 0x9e3779b9;
  const SETUP_DISCARD_ROUNDS = 256; // DarkCrypt-specific extra warm-up

  // Bob Jenkins's mix() macro, applied to an 8-word accumulator.
  function mix(x) {
    x[0] = OpCodes.ToUint32(OpCodes.XorN(x[0], OpCodes.Shl32(x[1], 11))); x[3] = OpCodes.ToUint32(x[3] + x[0]); x[1] = OpCodes.ToUint32(x[1] + x[2]);
    x[1] = OpCodes.ToUint32(OpCodes.XorN(x[1], OpCodes.Shr32(x[2], 2)));  x[4] = OpCodes.ToUint32(x[4] + x[1]); x[2] = OpCodes.ToUint32(x[2] + x[3]);
    x[2] = OpCodes.ToUint32(OpCodes.XorN(x[2], OpCodes.Shl32(x[3], 8)));  x[5] = OpCodes.ToUint32(x[5] + x[2]); x[3] = OpCodes.ToUint32(x[3] + x[4]);
    x[3] = OpCodes.ToUint32(OpCodes.XorN(x[3], OpCodes.Shr32(x[4], 16))); x[6] = OpCodes.ToUint32(x[6] + x[3]); x[4] = OpCodes.ToUint32(x[4] + x[5]);
    x[4] = OpCodes.ToUint32(OpCodes.XorN(x[4], OpCodes.Shl32(x[5], 10))); x[7] = OpCodes.ToUint32(x[7] + x[4]); x[5] = OpCodes.ToUint32(x[5] + x[6]);
    x[5] = OpCodes.ToUint32(OpCodes.XorN(x[5], OpCodes.Shr32(x[6], 4)));  x[0] = OpCodes.ToUint32(x[0] + x[5]); x[6] = OpCodes.ToUint32(x[6] + x[7]);
    x[6] = OpCodes.ToUint32(OpCodes.XorN(x[6], OpCodes.Shl32(x[7], 8)));  x[1] = OpCodes.ToUint32(x[1] + x[6]); x[7] = OpCodes.ToUint32(x[7] + x[0]);
    x[7] = OpCodes.ToUint32(OpCodes.XorN(x[7], OpCodes.Shr32(x[0], 9)));  x[2] = OpCodes.ToUint32(x[2] + x[7]); x[0] = OpCodes.ToUint32(x[0] + x[1]);
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
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._mm = null;
      this._randrsl = null;
      this._aa = 0;
      this._bb = 0;
      this._cc = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== SEED_BYTES)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. ISAAC (DarkCrypt) requires exactly ${SEED_BYTES} bytes`);
      this._key = [...keyBytes];
      this._initialize();
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const keystream = this._crypt(this.inputBuffer.length);
      const output = this.inputBuffer.map((b, i) => OpCodes.XorN(b, keystream[i]));

      this.inputBuffer = [];
      return output;
    }

    _initialize() {
      this._mm = new Array(STATE_SIZE).fill(0);
      this._randrsl = new Array(STATE_SIZE).fill(0);
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
      const x = new Array(8).fill(GOLDEN_RATIO);
      for (let i = 0; i < 4; i++) mix(x);

      for (let pass = 0; pass < 2; pass++) {
        const source = pass === 0 ? this._randrsl : this._mm;
        for (let j = 0; j < STATE_SIZE; j += 8) {
          for (let k = 0; k < 8; k++) x[k] = OpCodes.ToUint32(x[k] + source[j + k]);
          mix(x);
          for (let k = 0; k < 8; k++) this._mm[j + k] = x[k];
        }
      }

      // Reference randinit() ends with one isaac() round.
      this._isaac();
    }

    _isaac() {
      this._cc = OpCodes.ToUint32(this._cc + 1);
      this._bb = OpCodes.ToUint32(this._bb + this._cc);

      for (let i = 0; i < STATE_SIZE; i++) {
        const x = this._mm[i];

        switch (OpCodes.AndN(i, 3)) {
          case 0: this._aa = OpCodes.ToUint32(OpCodes.XorN(this._aa, OpCodes.Shl32(this._aa, 13))); break;
          case 1: this._aa = OpCodes.ToUint32(OpCodes.XorN(this._aa, OpCodes.Shr32(this._aa, 6))); break;
          case 2: this._aa = OpCodes.ToUint32(OpCodes.XorN(this._aa, OpCodes.Shl32(this._aa, 2))); break;
          case 3: this._aa = OpCodes.ToUint32(OpCodes.XorN(this._aa, OpCodes.Shr32(this._aa, 16))); break;
        }

        this._aa = OpCodes.ToUint32(this._aa + this._mm[OpCodes.AndN(i + 128, 0xFF)]);
        const y = OpCodes.ToUint32(this._mm[OpCodes.AndN(OpCodes.Shr32(x, 2), 0xFF)] + this._aa + this._bb);
        this._mm[i] = y;
        this._bb = OpCodes.ToUint32(this._mm[OpCodes.AndN(OpCodes.Shr32(y, 10), 0xFF)] + x);
        this._randrsl[i] = this._bb;
      }
    }

    _crypt(len) {
      this._isaac();
      const out = new Array(len);
      for (let i = 0; i < len; i++) {
        const word = this._randrsl[OpCodes.Shr32(i, 2)];
        out[i] = OpCodes.AndN(OpCodes.Shr32(word, OpCodes.Shl32(OpCodes.AndN(i, 3), 3)), 0xFF);
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
