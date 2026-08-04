/*
 * Breakme (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "Breakme" block cipher as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). It has no known public
 * specification; this implementation follows the behavior of the DarkCrypt
 * plugin.
 *
 * Structure:
 *   - 64-bit block (two 32-bit little-endian words L, R), 256-bit key
 *     (eight 32-bit little-endian words).
 *   - A 20-round unbalanced Feistel network. Each round both halves change:
 *       R' = ROL32(F(R), 12) XOR L
 *       L' = R XOR roundKey[i]
 *     (round i = 1..20, using roundKey[2..21] of a 24-word schedule).
 *   - Pre-whitening: L0 = block[0] XOR K[0], R0 = block[1] XOR K[1].
 *   - Post-whitening (with a word swap on store): ct[0] = R20 XOR K[23],
 *     ct[1] = L20 XOR K[22].
 *   - F(x) is a nested lookup network built purely from one 256-entry byte
 *     table S. Splitting x into bytes b3..b0 (MSB..LSB):
 *       V1 = ((S[b3]<<4) & 0xFF) | S[b2]
 *       V0 = S[b0] | ((S[b1]<<4) & 0xFF)
 *       V2 = ((S[V1]<<4) & 0xFF) | S[V0]
 *       V3 = ((S[V0]<<4) & 0xFF) | S[V2]
 *       F(x) = (V1<<24) | (V0<<16) | (V2<<8) | V3
 *     (all intermediate values truncate to 8 bits; the shifts and ORs are
 *     reproduced literally to match the reference behavior.)
 *   - Key schedule: a 25-word scratch buffer is filled with a template that
 *     is all zero for this cipher, then buffer[0..7] are overwritten with
 *     the 8 key words. Words 8..24 are then produced by the recurrence
 *     buffer[i] = buffer[i-8] XOR buffer[i-1] XOR i. A second pass then
 *     walks T = 19 downto 0, mixing buffer[T] ^= F((buffer[24] * T) mod
 *     2^32) XOR buffer[T+4] XOR buffer[T+1] (buffer[24] itself is only ever
 *     used as this multiplier and is never written by this pass, nor
 *     copied into the final schedule). The round-key array K[0..23] is
 *     finally set to buffer[0..23]; buffer[24] is discarded.
 * Test vectors verified against the DarkCrypt implementation (crypt/decrypt
 * round-trip verified). 64-bit blocks, 256-bit keys. Educational only.
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
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const ROUNDS = 20;

  // 256-entry substitution table used by the F function.
  const SBOX = [
    163,215,9,131,248,72,246,244,179,33,21,120,153,177,175,249,231,45,77,138,206,76,202,46,82,149,217,30,78,56,68,40,
    10,223,2,160,23,241,96,104,18,183,122,195,233,250,61,83,150,132,107,186,242,99,154,25,124,174,229,245,247,22,106,162,
    57,182,123,15,193,147,129,27,238,180,26,234,208,145,47,184,85,185,218,133,63,65,191,224,90,88,128,95,102,11,216,144,
    53,213,192,167,51,6,101,105,69,0,148,86,109,152,155,118,151,252,178,194,176,254,219,32,225,235,214,228,221,71,74,29,
    66,237,158,110,73,60,205,67,39,210,7,212,222,199,103,24,137,203,48,31,141,198,143,170,200,116,220,201,93,92,49,164,
    112,136,97,44,159,13,43,135,80,130,84,100,38,125,3,64,52,75,28,115,209,196,253,59,204,251,127,171,230,62,91,165,
    173,4,35,156,20,81,34,240,41,121,113,126,255,140,14,226,12,239,188,114,117,111,55,161,236,211,142,98,139,134,16,232,
    8,119,17,190,146,79,36,197,50,54,157,207,243,166,187,172,94,108,169,19,87,37,181,227,189,168,58,1,5,89,42,70
  ];

  class DarkCryptBreakmeAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Breakme (DarkCrypt)";
      this.description = "Non-standard 20-round unbalanced Feistel cipher from the DarkCrypt Total Commander plugin. 64-bit block, 256-bit key. F applies a nested 256-entry byte S-box network; the key schedule expands 8 key words to 24 round-key words via an XOR recurrence followed by a multiplier-driven mixing pass. No public specification exists.";
      this.inventor = "Alexander Myasnikov (DarkCrypt \"Zarya\" project)";
      this.year = 2009;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Undocumented non-standard design", "No public specification or cryptanalysis exists for this cipher. Not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Breakme — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("7feb8e2d688d5db8")
        },
        {
          text: "DarkCrypt Breakme — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("9a6f6f72a77702ac")
        },
        {
          text: "DarkCrypt Breakme — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("82c42b1a61929624")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptBreakmeInstance(this, isInverse);
    }
  }

  class DarkCryptBreakmeInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._K = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._K = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Breakme (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._K = this._scheduleKey(this._key);
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

    // Nested S-box network: see file header for the exact bit-level derivation.
    _f(x) {
      const b3 = OpCodes.And32(OpCodes.Shr32(x, 24), 0xFF);
      const b2 = OpCodes.And32(OpCodes.Shr32(x, 16), 0xFF);
      const b1 = OpCodes.And32(OpCodes.Shr32(x, 8), 0xFF);
      const b0 = OpCodes.And32(x, 0xFF);
      let v1 = OpCodes.And32(OpCodes.Shl32(SBOX[b3], 4), 0xFF) | SBOX[b2];
      let v0 = SBOX[b0] | OpCodes.And32(OpCodes.Shl32(SBOX[b1], 4), 0xFF);
      let v2 = OpCodes.And32(OpCodes.Shl32(SBOX[v1], 4), 0xFF) | SBOX[v0];
      let v3 = OpCodes.And32(OpCodes.Shl32(SBOX[v0], 4), 0xFF) | SBOX[v2];
      return OpCodes.ToUint32(OpCodes.Shl32(v1, 24) | OpCodes.Shl32(v0, 16) | OpCodes.Shl32(v2, 8) | v3);
    }

    // Round-key schedule: 8 key words expanded to 24 round-key words.
    _scheduleKey(key) {
      const buf = new Array(25).fill(0);
      for (let i = 0; i < 8; i++)
        buf[i] = OpCodes.Pack32LE(key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]);

      for (let idx = 8; idx <= 24; idx++)
        buf[idx] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(buf[idx-8], buf[idx-1]), idx));

      for (let T = 19; T >= 0; T--) {
        const mult = OpCodes.ToUint32(Math.imul(buf[24], T));
        const mixed = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(this._f(mult), buf[T+4]), buf[T+1]));
        buf[T] = OpCodes.ToUint32(OpCodes.Xor32(buf[T], mixed));
      }

      return buf.slice(0, 24);
    }

    _encryptBlock(block) {
      const K = this._K;
      let L = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Pack32LE(block[0], block[1], block[2], block[3]), K[0]));
      let R = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Pack32LE(block[4], block[5], block[6], block[7]), K[1]));
      for (let i = 1; i <= ROUNDS; i++) {
        const k = K[i + 1];
        const t = OpCodes.RotL32(this._f(R), 12);
        const newR = OpCodes.ToUint32(OpCodes.Xor32(t, L));
        const newL = OpCodes.ToUint32(OpCodes.Xor32(R, k));
        L = newL; R = newR;
      }
      const ct0 = OpCodes.ToUint32(OpCodes.Xor32(R, K[23]));
      const ct1 = OpCodes.ToUint32(OpCodes.Xor32(L, K[22]));
      return [...OpCodes.Unpack32LE(ct0), ...OpCodes.Unpack32LE(ct1)];
    }

    _decryptBlock(block) {
      const K = this._K;
      let A = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Pack32LE(block[0], block[1], block[2], block[3]), K[23]));
      let B = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Pack32LE(block[4], block[5], block[6], block[7]), K[22]));
      for (let idx = ROUNDS + 1; idx >= 2; idx--) {
        B = OpCodes.ToUint32(OpCodes.Xor32(B, K[idx]));
        let t = OpCodes.RotL32(this._f(B), 12);
        t = OpCodes.ToUint32(OpCodes.Xor32(t, A));
        A = B;
        B = t;
      }
      const pt1 = OpCodes.ToUint32(OpCodes.Xor32(A, K[1]));
      const pt0 = OpCodes.ToUint32(OpCodes.Xor32(B, K[0]));
      return [...OpCodes.Unpack32LE(pt0), ...OpCodes.Unpack32LE(pt1)];
    }
  }

  const algorithmInstance = new DarkCryptBreakmeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptBreakmeAlgorithm, DarkCryptBreakmeInstance };
}));
