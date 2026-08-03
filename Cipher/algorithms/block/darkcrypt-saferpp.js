/*
 * SAFER++ (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SAFER++ as implemented in the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project), 128-bit block, 256-bit key, 10 rounds. This
 * matches the NESSIE SAFER++ submission structure (Massey, Khachatrian,
 * Kuregian, 2000): the 256-bit key is split into two 128-bit halves, each
 * expanded (with a 9th "parity"/checksum byte and a 3-bit/6-bit rotation
 * schedule reminiscent of SAFER+) into its own round-key stream -- the first
 * half feeds the "upper" (XOR/E-box) key layer of each round, the second
 * half feeds the "lower" (ADD/L-box) key layer. Unlike SAFER+, the SAFER++
 * round's linear transform is TWO passes of (byte-shuffle, then a per-4-byte
 * "PHT-4" mix) applied to the whole 16-byte state in place, rather than
 * SAFER+'s 4-layer ping-ponged 2-input PHT tree. The classic SAFER
 * exponential/logarithmic S-boxes (GF(257), base 45) and per-round bias
 * bytes are used for keying, exactly as in the wider SAFER family. The
 * bias-byte table used here diverges from the published SAFER+ bias table
 * past its 14th entry.
 * Test vectors verified against the DarkCrypt implementation.
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

  const BLOCK_SIZE = 16;
  const KEY_SIZE = 32;
  const ROUNDS = 10;
  const KA_LEN = 17; // 16 key bytes + 1 parity/checksum byte

  // Classic SAFER exponential (EBOX) / logarithmic (LBOX) S-boxes over GF(257), base 45.
  const EBOX = new Uint8Array([
    1,45,226,147,190,69,21,174,120,3,135,164,184,56,207,63,
    8,103,9,148,235,38,168,107,189,24,52,27,187,191,114,247,
    64,53,72,156,81,47,59,85,227,192,159,216,211,243,141,177,
    255,167,62,220,134,119,215,166,17,251,244,186,146,145,100,131,
    241,51,239,218,44,181,178,43,136,209,153,203,140,132,29,20,
    129,151,113,202,95,163,139,87,60,130,196,82,92,28,232,160,
    4,180,133,74,246,19,84,182,223,12,26,142,222,224,57,252,
    32,155,36,78,169,152,158,171,242,96,208,108,234,250,199,217,
    0,212,31,110,67,188,236,83,137,254,122,93,73,201,50,194,
    249,154,248,109,22,219,89,150,68,233,205,230,70,66,143,10,
    193,204,185,101,176,210,198,172,30,65,98,41,46,14,116,80,
    2,90,195,37,123,138,42,91,240,6,13,71,111,112,157,126,
    16,206,18,39,213,76,79,214,121,48,104,54,117,125,228,237,
    128,106,144,55,162,94,118,170,197,127,61,175,165,229,25,97,
    253,77,124,183,11,238,173,75,34,245,231,115,35,33,200,5,
    225,102,221,179,88,105,99,86,15,161,49,149,23,7,58,40
  ]);

  const LBOX = new Uint8Array([
    128,0,176,9,96,239,185,253,16,18,159,228,105,186,173,248,
    192,56,194,101,79,6,148,252,25,222,106,27,93,78,168,130,
    112,237,232,236,114,179,21,195,255,171,182,71,68,1,172,37,
    201,250,142,65,26,33,203,211,13,110,254,38,88,218,50,15,
    32,169,157,132,152,5,156,187,34,140,99,231,197,225,115,198,
    175,36,91,135,102,39,247,87,244,150,177,183,92,139,213,84,
    121,223,170,246,62,163,241,17,202,245,209,23,123,147,131,188,
    189,82,30,235,174,204,214,53,8,200,138,180,226,205,191,217,
    208,80,89,63,77,98,52,10,72,136,181,86,76,46,107,158,
    210,61,60,3,19,251,151,81,117,74,145,113,35,190,118,42,
    95,249,212,85,11,220,55,49,22,116,215,119,167,230,7,219,
    164,47,70,243,97,69,103,227,12,162,59,28,133,24,4,29,
    41,160,143,178,90,216,166,126,238,141,83,75,161,154,193,14,
    122,73,165,44,129,196,199,54,43,127,67,149,51,242,108,104,
    109,240,2,40,206,221,155,234,94,153,124,20,134,207,229,66,
    184,64,120,45,58,233,100,31,146,144,125,57,111,224,137,48
  ]);

  // Per-round-pair bias bytes (11 blocks of 32 bytes: 16 "upper"/KA bias +
  // 16 "lower"/KB bias). Diverges from the published SAFER+ bias table past
  // entry 14; the final 16-byte block is unused padding (only K[0..20] are
  // ever consumed).
  const BIAS = new Uint8Array([
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    70,151,177,186,163,183,16,10,197,55,179,201,90,40,172,100,
    236,171,170,198,103,149,88,13,248,154,246,110,102,220,5,61,
    138,195,216,137,106,233,54,73,67,191,235,212,150,155,104,160,
    93,87,146,31,213,113,92,187,34,193,190,123,188,153,99,148,
    42,97,184,52,50,25,253,251,23,64,230,81,29,65,68,143,
    221,4,128,222,231,49,214,127,1,162,247,57,218,111,35,202,
    58,208,28,209,48,62,18,161,205,15,224,168,175,130,89,44,
    125,173,178,239,194,135,206,117,6,19,2,144,79,46,114,51,
    192,141,207,169,129,226,196,39,47,108,122,159,82,225,21,56,
    252,32,66,199,8,228,9,85,94,140,20,118,96,255,223,215,
    250,11,33,0,26,249,166,185,232,158,98,76,217,145,80,210,
    24,180,7,132,234,91,164,200,14,203,72,105,75,78,156,53,
    69,77,84,229,37,60,12,74,139,63,204,167,219,107,174,244,
    45,243,124,109,157,181,38,116,242,147,83,176,240,17,237,131,
    103,9,148,235,38,168,107,189,24,52,27,187,191,114,247,64,
    72,156,81,47,59,85,227,192,159,216,211,243,141,177,255,167,
    220,134,119,215,166,17,251,244,186,146,145,100,131,241,51,239,
    44,181,178,43,136,209,153,203,140,132,29,20,129,151,113,202,
    163,139,87,60,130,196,82,92,28,232,160,4,180,133,74,246,
    84,182,223,12,26,142,222,224,57,252,32,155,36,78,169,152,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
  ]);

  // Byte positions using the E-box (XOR-in, ADD-out) round-key layer vs.
  // the L-box (ADD-in, XOR-out) layer, per the classic SAFER round pattern.
  const EBOX_POS = [0, 3, 4, 7, 8, 11, 12, 15];
  const LBOX_POS = [1, 2, 5, 6, 9, 10, 13, 14];

  // Byte-shuffle permutation of the SAFER++ linear transform: out[i] = in[SHUFFLE[i]].
  const SHUFFLE = [8, 5, 2, 15, 0, 13, 10, 7, 4, 1, 14, 11, 12, 9, 6, 3];
  // Inverse of SHUFFLE.
  const ISHUFFLE = [4, 9, 2, 15, 8, 1, 14, 7, 0, 13, 6, 11, 12, 5, 10, 3];

  class DarkCryptSaferPlusPlusAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SAFER++ (DarkCrypt)";
      this.description = "SAFER++ block cipher (James Massey, Gurgen Khachatrian, Melsik Kuregian; NESSIE submission, 2000). 128-bit block, 256-bit key, 10 rounds. As implemented in the DarkCrypt Total Commander plugin.";
      this.inventor = "James Massey, Gurgen Khachatrian, Melsik Kuregian";
      this.year = 2000;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("SAFER (Wikipedia)", "https://en.wikipedia.org/wiki/SAFER"),
        new LinkItem("NESSIE Project", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Multiset/boomerang attacks", "Reduced-round SAFER++ (up to 5.5 of 7 rounds) has been broken by multiset and boomerang cryptanalysis (Biryukov, De Canniere, Dellkrantz, CRYPTO 2003).", "Prefer a vetted modern cipher such as AES.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Saferpp — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("b3023ab8987797b91932b6b067769b49")
        },
        {
          text: "DarkCrypt Saferpp — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("f2460a9b53e7f50897f8ab242c29623c")
        },
        {
          text: "DarkCrypt Saferpp — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("fa7ef4fb4601d19d75c397c6ba39c336")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSaferPlusPlusInstance(this, isInverse);
    }
  }

  class DarkCryptSaferPlusPlusInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.K = null; // 22 round-key entries of 16 bytes each (only 0..20 used)
      this.inputBuffer = [];
      this.BlockSize = BLOCK_SIZE;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.K = null; this.KeySize = 0; return; }
      if (keyBytes.length !== KEY_SIZE)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SAFER++ (DarkCrypt) requires exactly ${KEY_SIZE} bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.K = this._scheduleKey(this._key);
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

    // Two 128-bit key halves each expand into their own 17-byte (16 data +
    // 1 parity/checksum) working array; KB is pre-rotated left by 3 bits
    // before the round-pair loop, KA is not. Each round pair p (0..10)
    // derives 16 "upper" bytes from KA and 16 "lower" bytes from KB, adding
    // the per-position bias byte; KA/KB are then both rotated left by 6
    // bits before the next round pair. K[2p] is the upper/XOR-layer key,
    // K[2p+1] the lower/ADD-layer key; only K[0..20] are ever used (K[21]
    // is unused padding).
    _scheduleKey(keyBytes) {
      const ka = new Array(KA_LEN);
      const kb = new Array(KA_LEN);
      ka[16] = 0;
      kb[16] = 0;
      for (let j = 0; j < 16; j++) {
        ka[j] = keyBytes[j];
        ka[16] ^= ka[j];
        kb[j] = keyBytes[16 + j];
        kb[16] ^= kb[j];
      }
      for (let j = 0; j < KA_LEN; j++) kb[j] = OpCodes.RotL8(kb[j], 3);

      const K = new Array(22);
      for (let p = 0; p <= 10; p++) {
        const i = 2 * p + 1;
        const biasOff = p * 32;
        const upper = new Array(16);
        const lower = new Array(16);
        for (let j = 0; j < 16; j++) {
          const kaIdx = (i + j - 1) % KA_LEN;
          const kbIdx = (i + j) % KA_LEN;
          upper[j] = OpCodes.And32(ka[kaIdx] + BIAS[biasOff + j], 0xFF);
          lower[j] = OpCodes.And32(kb[kbIdx] + BIAS[biasOff + 16 + j], 0xFF);
        }
        K[2 * p] = upper;
        K[2 * p + 1] = lower;

        for (let j = 0; j < KA_LEN; j++) {
          ka[j] = OpCodes.RotL8(ka[j], 6);
          kb[j] = OpCodes.RotL8(kb[j], 6);
        }
      }
      return K;
    }

    _sboxRound(block, K, K1) {
      for (const idx of EBOX_POS) block[idx] = OpCodes.And32(EBOX[OpCodes.Xor32(block[idx], K[idx])] + K1[idx], 0xFF);
      for (const idx of LBOX_POS) block[idx] = OpCodes.And32(OpCodes.Xor32(LBOX[OpCodes.And32(block[idx] + K[idx], 0xFF)], K1[idx]), 0xFF);
    }

    _isboxRound(block, K, K1) {
      for (const idx of EBOX_POS) block[idx] = OpCodes.Xor32(LBOX[OpCodes.And32(block[idx] - K1[idx], 0xFF)], K[idx]);
      for (const idx of LBOX_POS) block[idx] = OpCodes.And32(EBOX[OpCodes.Xor32(block[idx], K1[idx])] - K[idx], 0xFF);
    }

    _pht4(block, off) {
      const s = OpCodes.And32(block[off] + block[off + 1] + block[off + 2] + block[off + 3], 0xFF);
      block[off] = OpCodes.And32(block[off] + s, 0xFF);
      block[off + 1] = OpCodes.And32(block[off + 1] + s, 0xFF);
      block[off + 2] = OpCodes.And32(block[off + 2] + s, 0xFF);
      block[off + 3] = s;
    }

    _ipht4(block, off) {
      const s = block[off + 3];
      const a = OpCodes.And32(block[off] - s, 0xFF);
      const b = OpCodes.And32(block[off + 1] - s, 0xFF);
      const c = OpCodes.And32(block[off + 2] - s, 0xFF);
      block[off] = a;
      block[off + 1] = b;
      block[off + 2] = c;
      block[off + 3] = OpCodes.And32(s - a - b - c, 0xFF);
    }

    _shuffle(block) {
      const out = new Array(16);
      for (let i = 0; i < 16; i++) out[i] = block[SHUFFLE[i]];
      for (let i = 0; i < 16; i++) block[i] = out[i];
    }

    _ishuffle(block) {
      const out = new Array(16);
      for (let i = 0; i < 16; i++) out[i] = block[ISHUFFLE[i]];
      for (let i = 0; i < 16; i++) block[i] = out[i];
    }

    _lt(block) {
      this._shuffle(block);
      this._pht4(block, 0); this._pht4(block, 4); this._pht4(block, 8); this._pht4(block, 12);
      this._shuffle(block);
      this._pht4(block, 0); this._pht4(block, 4); this._pht4(block, 8); this._pht4(block, 12);
    }

    _ilt(block) {
      this._ipht4(block, 0); this._ipht4(block, 4); this._ipht4(block, 8); this._ipht4(block, 12);
      this._ishuffle(block);
      this._ipht4(block, 0); this._ipht4(block, 4); this._ipht4(block, 8); this._ipht4(block, 12);
      this._ishuffle(block);
    }

    _encryptBlock(input) {
      const block = [...input];
      for (let r = 0; r < ROUNDS; r++) {
        this._sboxRound(block, this.K[2 * r], this.K[2 * r + 1]);
        this._lt(block);
      }
      const kf = this.K[2 * ROUNDS];
      for (let i = 0; i < 16; i++) {
        const m = OpCodes.And32(i, 3);
        block[i] = (m === 0 || m === 3)
          ? OpCodes.And32(OpCodes.Xor32(block[i], kf[i]), 0xFF)
          : OpCodes.And32(block[i] + kf[i], 0xFF);
      }
      return block;
    }

    _decryptBlock(input) {
      const block = [...input];
      const kf = this.K[2 * ROUNDS];
      for (let i = 0; i < 16; i++) {
        const m = OpCodes.And32(i, 3);
        block[i] = (m === 0 || m === 3)
          ? OpCodes.And32(OpCodes.Xor32(block[i], kf[i]), 0xFF)
          : OpCodes.And32(block[i] - kf[i], 0xFF);
      }
      for (let r = ROUNDS - 1; r >= 0; r--) {
        this._ilt(block);
        this._isboxRound(block, this.K[2 * r], this.K[2 * r + 1]);
      }
      return block;
    }
  }

  const algorithmInstance = new DarkCryptSaferPlusPlusAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSaferPlusPlusAlgorithm, DarkCryptSaferPlusPlusInstance };
}));
