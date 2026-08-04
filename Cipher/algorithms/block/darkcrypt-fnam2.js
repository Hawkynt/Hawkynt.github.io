/*
 * FNAm2-512 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "FNAm2-512" block cipher as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). No public specification exists;
 * this implementation follows the behavior of the DarkCrypt plugin:
 *   - 128-bit block treated as four 32-bit little-endian words
 *   - 512-bit key treated as sixteen 32-bit little-endian words
 *   - 64 sequential ARX-with-multiply steps (16 cycles over the four words)
 *   - each step updates one word: w[t] = ~( w[t] + f(w[(t+1)%4], S) )
 *       f(x,S) = S*(~(x<<7)) + ( (x>>>16) ^ ((x<<25) + S) )
 *       S(r)   = K[r&15]*r + K[(r&15)+1]         (all 32-bit modular arithmetic)
 * Test vectors verified against the DarkCrypt implementation (crypt/decrypt
 * round-trip verified). 128-bit block, 512-bit key.
 * Educational only.
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
          BlockCipherAlgorithm, IBlockCipherInstance,
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const STEPS = 64;

  // 32-bit modular multiply (low word).
  function mul32(a, b) { return OpCodes.ToUint32(Math.imul(a, b)); }

  // Round mixing function f(x,S) = S*(~(x<<7)) + ( (x>>>16) ^ ((x<<25) + S) )
  function mix(x, S) {
    const notShift = OpCodes.Not32(OpCodes.Shl32(x, 7));
    const t1 = mul32(S, notShift);
    const part = OpCodes.Xor32(OpCodes.Shr32(x, 16), OpCodes.ToUint32(OpCodes.Shl32(x, 25) + S));
    return OpCodes.ToUint32(t1 + part);
  }

  class DarkCryptFNAm2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "FNAm2-512 (DarkCrypt)";
      this.description = "FNAm2-512 block cipher from the DarkCrypt Total Commander plugin. A 128-bit-block / 512-bit-key ARX-with-multiply construction: 64 sequential steps mix the four little-endian words using key-derived subkeys built from 32-bit multiplication.";
      this.inventor = "Alexander Myasnikov (DarkCrypt / Zarya)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];  // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard cipher", "Custom ARX-with-multiply design of unknown provenance; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Fnam2 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("e7dbfb251bf0fcfb302602cc2cfe03f2")
        },
        {
          text: "DarkCrypt Fnam2 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("838b7b06c845801344698e2fd3b89fc0")
        },
        {
          text: "DarkCrypt Fnam2 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("7baf2995776dab041609d53a6b4b59c7")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptFNAm2Instance(this, isInverse);
    }
  }

  class DarkCryptFNAm2Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. FNAm2-512 (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
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
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    // Sixteen 32-bit little-endian key words; index 16 is a per-session counter,
    // which is always 0 for a freshly keyed single block.
    _keyWords() {
      const k = this._key;
      const K = [];
      for (let i = 0; i < 16; i++)
        K.push(OpCodes.Pack32LE(k[i * 4], k[i * 4 + 1], k[i * 4 + 2], k[i * 4 + 3]));
      K.push(0);
      return K;
    }

    // Subkey for step r (session counter fixed at 0): S = K[m]*r + K[m+1], m = r & 15
    _subkey(K, r) {
      const m = OpCodes.And32(r, 0xF);
      const kNext = (m + 1 <= 15) ? K[m + 1] : 0; // K[16] is the counter (0)
      return OpCodes.ToUint32(mul32(K[m], r) + kNext);
    }

    _encryptBlock(block) {
      const K = this._keyWords();
      const w = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];
      for (let r = 0; r < STEPS; r++) {
        const S = this._subkey(K, r);
        const t = OpCodes.And32(r, 3);
        const f = mix(w[OpCodes.And32(t + 1, 3)], S);
        w[t] = OpCodes.Not32(OpCodes.ToUint32(w[t] + f));
      }
      return [
        ...OpCodes.Unpack32LE(w[0]), ...OpCodes.Unpack32LE(w[1]),
        ...OpCodes.Unpack32LE(w[2]), ...OpCodes.Unpack32LE(w[3])
      ];
    }

    _decryptBlock(block) {
      const K = this._keyWords();
      const w = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];
      for (let r = STEPS - 1; r >= 0; r--) {
        const S = this._subkey(K, r);
        const t = OpCodes.And32(r, 3);
        const f = mix(w[OpCodes.And32(t + 1, 3)], S);
        // invert w[t] = ~(w[t] + f)  =>  w[t] = ~w[t] - f
        w[t] = OpCodes.ToUint32(OpCodes.Not32(w[t]) - f);
      }
      return [
        ...OpCodes.Unpack32LE(w[0]), ...OpCodes.Unpack32LE(w[1]),
        ...OpCodes.Unpack32LE(w[2]), ...OpCodes.Unpack32LE(w[3])
      ];
    }
  }

  const algorithmInstance = new DarkCryptFNAm2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptFNAm2Algorithm, DarkCryptFNAm2Instance };
}));
