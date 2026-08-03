/*
 * SPEED (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The SPEED block cipher as implemented by the DarkCrypt Total Commander plugin.
 * This is an unbalanced 8-word (16-bit words) shift-register
 * cipher rather than a classic balanced Feistel network: each round computes one new
 * head word from a nonlinear Boolean combination of the other seven words, data-
 * dependently rotates it, adds a rotated tail word and one expanded key word, and
 * shifts the whole 8-word queue down by one. 128-bit block (8x16-bit words), fixed
 * 256-bit key (16x16-bit words).
 *
 * Key schedule: the 16 raw key words seed a further 48-word expansion, each new word
 * built from ROTL16(majority(s1,s2,s3), 5) + s3 + rawKeyWord[i mod 16], where
 * (s1,s2,s3) is a 3-word shift register seeded from three fixed 16-bit constants
 * and updated every step — giving 64 expanded key words in total, one per round.
 *
 * Round function: 64 rounds split into four 16-round groups, each group using its
 * own nonlinear Boolean combining function (T1..T4, analogous in spirit to the four
 * round functions of MD4/MD5) over the seven most significant queue words; the 8th
 * (tail) word only contributes via a fixed ROTL16(,9). Decryption is the exact
 * algebraic inverse of one round (recovering the discarded tail word from the
 * updated head word), run over the 64 rounds in reverse.
 *
 * As implemented in the DarkCrypt Total Commander plugin; test vectors verified
 * against the DarkCrypt implementation, including its internal 64-word key schedule.
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
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // Key-schedule shift-register seed constants (DLL globals at 0x40800C/0x40800E/0x408010).
  const SEED_S1 = 0xf659; // (initial "ebx")
  const SEED_S2 = 0xd76c; // (initial "ecx")
  const SEED_S3 = 0x9bf4; // (initial "esi")

  function u16(x) { return OpCodes.AndN(x, 0xffff); }

  function rotL16(x, n) {
    x = u16(x);
    n &= 15;
    if (n === 0) return x;
    return u16(OpCodes.OrN(OpCodes.Shl32(x, n), OpCodes.Shr32(x, 16 - n)));
  }

  function rotR16(x, n) {
    x = u16(x);
    n &= 15;
    if (n === 0) return x;
    return u16(OpCodes.OrN(OpCodes.Shr32(x, n), OpCodes.Shl32(x, 16 - n)));
  }

  // Four nonlinear Boolean combining functions, one per 16-round group. Each takes
  // the current 8-word queue (q[0] = head/newest .. q[7] = tail/oldest) and returns
  // a 16-bit "T" value; q[7] itself never participates here (it is folded in
  // separately as rotL16(q[7], 9)).
  function combineT1(q) {
    return u16(OpCodes.XorN(OpCodes.XorN(q[0], OpCodes.AndN(q[0], q[1])),
           OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(q[2], q[4]), OpCodes.AndN(q[3], q[6])), OpCodes.AndN(q[1], q[5]))));
  }

  function combineT2(q) {
    const terms = OpCodes.XorN(OpCodes.XorN(q[1], OpCodes.AndN(q[0], q[3])),
      OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(q[1], q[4]), OpCodes.AndN(q[2], q[5])), OpCodes.AndN(q[3], q[4])));
    const triples = OpCodes.XorN(OpCodes.AndN(OpCodes.AndN(q[0], q[3]), q[4]), OpCodes.AndN(OpCodes.AndN(q[0], q[4]), q[6]));
    return u16(OpCodes.XorN(terms, triples));
  }

  function combineT3(q) {
    const terms = OpCodes.XorN(OpCodes.XorN(q[3], OpCodes.AndN(q[0], q[1])),
      OpCodes.XorN(OpCodes.AndN(q[0], q[3]), OpCodes.XorN(OpCodes.AndN(q[2], q[5]), OpCodes.AndN(q[4], q[6]))));
    const triple = OpCodes.AndN(OpCodes.AndN(q[0], q[4]), q[5]);
    return u16(OpCodes.XorN(terms, triple));
  }

  function combineT4(q) {
    const terms = OpCodes.XorN(OpCodes.XorN(q[2], OpCodes.AndN(q[0], q[1])),
      OpCodes.XorN(OpCodes.AndN(q[2], q[3]), OpCodes.XorN(OpCodes.AndN(q[3], q[4]), OpCodes.AndN(q[5], q[6]))));
    const quad = OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(q[0], q[2]), q[4]), q[6]);
    return u16(OpCodes.XorN(terms, quad));
  }

  const COMBINERS = [combineT1, combineT2, combineT3, combineT4];

  // Data-dependent rotate amount derived from T itself (RC5/RC6-style).
  function shiftAmount(T) {
    const mixed = OpCodes.AndN(OpCodes.Add32(OpCodes.Shr32(T, 8), T), 0xff);
    return OpCodes.Shr32(mixed, 4);
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class DarkCryptSpeedAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SPEED (DarkCrypt)";
      this.description = "SPEED cipher as implemented by the DarkCrypt Total Commander plugin: an 8x16-bit-word unbalanced shift-register cipher with 64 rounds split into four 16-round groups, each using its own nonlinear Boolean combining function, plus a 64-word expanded key schedule. 128-bit block, fixed 256-bit key.";
      this.inventor = "Yuliang Zheng; DarkCrypt variant";
      this.year = 1997;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("SPEED Cipher Paper (Yuliang Zheng)", "https://link.springer.com/chapter/10.1007/3-540-63594-7_68")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "DarkCrypt-specific SPEED parameterization (round-group Boolean functions, key schedule) not matched to any published SPEED reference vectors; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Speed — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("399531b3ea9d535c2b472ba48adfefd3")
        },
        {
          text: "DarkCrypt Speed — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("ef7717912202cea01703af3a74323942")
        },
        {
          text: "DarkCrypt Speed — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("638b7085b28fd4f6cdeab2f5f10a753f")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSpeedInstance(this, isInverse);
    }
  }

  class DarkCryptSpeedInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.expandedKey = null; // 64 x 16-bit round-key words
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.expandedKey = null;
        this.KeySize = 0;
        return;
      }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SPEED (DarkCrypt) requires exactly 32 bytes`);

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.expandedKey = this._expandKey(keyBytes);
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

    // Expands the 16 raw 16-bit key words into a 64-word round-key schedule via a
    // 3-word nonlinear (majority + rotate) shift register seeded from fixed constants.
    _expandKey(keyBytes) {
      const rawWords = new Array(16);
      for (let i = 0; i < 16; i++)
        rawWords[i] = OpCodes.Pack16LE(keyBytes[i * 2], keyBytes[i * 2 + 1]);

      const words = new Array(64);
      for (let i = 0; i < 16; i++) words[i] = rawWords[i];

      let s3 = SEED_S3, s1 = SEED_S1, s2 = SEED_S2; // (esi, ebx, ecx) in the DLL's naming
      for (let i = 16; i < 64; i++) {
        const majority = OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(s3, s1), OpCodes.AndN(s1, s2)), OpCodes.AndN(s2, s3));
        const rotated = rotL16(majority, 5);
        const newWord = u16(OpCodes.Add32(OpCodes.Add32(rotated, s2), rawWords[OpCodes.And32(i, 0xF)]));
        words[i] = newWord;
        s2 = s1; s1 = s3; s3 = newWord;
      }
      return words;
    }

    _encryptBlock(block) {
      let q = new Array(8);
      for (let i = 0; i < 8; i++) q[i] = OpCodes.OrN(block[i * 2], OpCodes.Shl32(block[i * 2 + 1], 8));

      for (let round = 0; round < 64; round++) {
        const combine = COMBINERS[Math.floor(round / 16)];
        const T = combine(q);
        const shamt = shiftAmount(T);
        const rotated = rotR16(OpCodes.AndN(T, 0xffff), shamt);
        const newHead = u16(OpCodes.Add32(OpCodes.Add32(rotated, rotL16(q[7], 9)), this.expandedKey[round]));
        q = [newHead, q[0], q[1], q[2], q[3], q[4], q[5], q[6]];
      }

      const out = [];
      for (let i = 0; i < 8; i++) out.push(OpCodes.AndN(q[i], 0xff), OpCodes.AndN(OpCodes.Shr32(q[i], 8), 0xff));
      return out;
    }

    _decryptBlock(block) {
      let q = new Array(8);
      for (let i = 0; i < 8; i++) q[i] = OpCodes.OrN(block[i * 2], OpCodes.Shl32(block[i * 2 + 1], 8));

      for (let round = 63; round >= 0; round--) {
        // q currently holds the post-round state; recover the pre-round state.
        const oldQ = [q[1], q[2], q[3], q[4], q[5], q[6], q[7], 0];
        const combine = COMBINERS[Math.floor(round / 16)];
        const T = combine(oldQ);
        const shamt = shiftAmount(T);
        const rotated = rotR16(OpCodes.AndN(T, 0xffff), shamt);
        const rotatedOldTail = u16(OpCodes.Sub32(OpCodes.Sub32(q[0], rotated), this.expandedKey[round]));
        oldQ[7] = rotR16(rotatedOldTail, 9);
        q = oldQ;
      }

      const out = [];
      for (let i = 0; i < 8; i++) out.push(OpCodes.AndN(q[i], 0xff), OpCodes.AndN(OpCodes.Shr32(q[i], 8), 0xff));
      return out;
    }
  }

  const algorithmInstance = new DarkCryptSpeedAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSpeedAlgorithm, DarkCryptSpeedInstance };
}));
