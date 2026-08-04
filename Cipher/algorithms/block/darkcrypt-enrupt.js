/*
 * Enrupt-512-512 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "Enrupt-512-512" block cipher as shipped in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). It is a member of Sean O'Neil's
 * EnRUPT ARX family: an all add/rotate/xor construction with no S-boxes, operating
 * on a sliding three-word window over the state.
 *
 * No public specification of this DarkCrypt variant exists; this implementation
 * follows the behavior of the DarkCrypt plugin (verified byte-for-byte,
 * encrypt/decrypt round-trip confirmed):
 *   - 512-bit block  = 16 x 32-bit little-endian words (state S[0..15])
 *   - 512-bit key    = 16 x 32-bit little-endian words (key   K[0..15])
 *   - 192 update steps (= 16*8 + 16*4), each touching one state word
 *   - per-step round function f(a,b,kw,i) = 9 * ror((2*a) ^ b ^ kw ^ i, 8)
 *   - step i (1..192): S[i mod16] ^= f(S[(i-1)mod16], S[(i+1)mod16], K[i mod16], i) ^ K[i mod16]
 *   - decryption replays the identical step with i running 192..1
 * 512-bit blocks, 512-bit keys. Educational only.
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

  const WORDS = 16;   // 16 x 32-bit words = 512 bits
  const STEPS = WORDS * 8 + WORDS * 4;  // 192 update steps

  class DarkCryptEnruptAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Enrupt-512-512 (DarkCrypt)";
      this.description = "EnRUPT-family ARX block cipher from the DarkCrypt Total Commander plugin. 512-bit block and 512-bit key, both as 16 little-endian 32-bit words. 192 sliding-window add/rotate/xor steps with round function 9*ror((2*a)^b^k^i,8); no S-boxes.";
      this.inventor = "Sean O'Neil (EnRUPT family); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(64, 64, 0)]; // fixed 512-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("EnRUPT (base design by Sean O'Neil)", "https://www.enrupt.com/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard / unvetted variant", "A custom EnRUPT-family construction with unusual step count and window layout; the EnRUPT family itself was not selected in the SHA-3/eSTREAM processes and this variant is unanalyzed.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Enrupt — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0c77adc0d76a5fbe7f05e481327af72020541cdfe571ef6e8f141385dde0097527f676c436fc90dc9abbff82cdc05986ad92b7f1c06b611e0b5258d9fbc8d1fb")
        },
        {
          text: "DarkCrypt Enrupt — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("25395342858a086e553ea6f50c8d92887f6c7220fd6c7b8b68865a49482f83d7c8ec3200d836cd8ab87b0d7cf127d0215b51af3de44a805e9aab5e05eabb97d8")
        },
        {
          text: "DarkCrypt Enrupt — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("d1e5d9fcb3c9b9e61535c1adb982082992397219f2fb387465c019fc61b87e4f43d3c9fc3390536f881a916a707003bf33d1361aa2bf5ea0a4c102d00c6dd73b")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptEnruptInstance(this, isInverse);
    }
  }

  class DarkCryptEnruptInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._keyWords = null;
      this.inputBuffer = [];
      this.BlockSize = 64;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._keyWords = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Enrupt-512-512 (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this._keyWords = [];
      for (let k = 0; k < WORDS; k++)
        this._keyWords[k] = OpCodes.Pack32LE(keyBytes[4*k], keyBytes[4*k+1], keyBytes[4*k+2], keyBytes[4*k+3]);
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

    // f(a,b,kw,i) = 9 * ror( (2*a) ^ b ^ kw ^ i, 8 )
    _f(a, b, kw, i) {
      let t = OpCodes.ToUint32(a + a);
      t = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(t, b), OpCodes.Xor32(kw, i)));
      t = OpCodes.RotR32(t, 8);
      return OpCodes.ToUint32(t * 9);
    }

    _loadState(block) {
      const S = [];
      for (let k = 0; k < WORDS; k++)
        S[k] = OpCodes.Pack32LE(block[4*k], block[4*k+1], block[4*k+2], block[4*k+3]);
      return S;
    }

    _storeState(S) {
      const out = [];
      for (let k = 0; k < WORDS; k++)
        out.push(...OpCodes.Unpack32LE(S[k]));
      return out;
    }

    _encryptBlock(block) {
      const S = this._loadState(block);
      const K = this._keyWords;
      for (let i = 1; i <= STEPS; i++) {
        const kw = K[i % WORDS];
        const t = OpCodes.ToUint32(OpCodes.Xor32(this._f(S[(i-1) % WORDS], S[(i+1) % WORDS], kw, i), kw));
        S[i % WORDS] = OpCodes.ToUint32(OpCodes.Xor32(S[i % WORDS], t));
      }
      return this._storeState(S);
    }

    _decryptBlock(block) {
      const S = this._loadState(block);
      const K = this._keyWords;
      for (let i = STEPS; i >= 1; i--) {
        const kw = K[i % WORDS];
        const t = OpCodes.ToUint32(OpCodes.Xor32(this._f(S[(i-1) % WORDS], S[(i+1) % WORDS], kw, i), kw));
        S[i % WORDS] = OpCodes.ToUint32(OpCodes.Xor32(S[i % WORDS], t));
      }
      return this._storeState(S);
    }
  }

  const algorithmInstance = new DarkCryptEnruptAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptEnruptAlgorithm, DarkCryptEnruptInstance };
}));
