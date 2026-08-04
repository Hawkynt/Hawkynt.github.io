/*
 * MacGuffin (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MacGuffin as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). The core primitive (S-boxes, bit
 * selection, GUFN round structure, 32-round self-encrypting key schedule)
 * is an exact match for Matt Blaze's original 1994 reference implementation
 * ("mcg.c"). The one deviation found in the DarkCrypt implementation:
 * the plugin's exported encrypt ("crypt") and decrypt routines are swapped
 * relative to Blaze's naming -- DarkCrypt's "crypt" runs the round-key
 * sequence that Blaze's code calls decryption (subkeys applied in reverse,
 * starting from the last of the 96 16-bit round words), while DarkCrypt's
 * "decrypt" runs Blaze's encryption sequence (subkeys applied forward from
 * the first word). The self-keying key schedule always uses the forward
 * (Blaze "encrypt") direction, matching the original algorithm exactly.
 * 64-bit blocks, 128-bit keys. Educational only.
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

  const ROUNDS = 32;
  const KSIZE = ROUNDS * 3; // 96 sixteen-bit round-key words

  // The 8 DES S-boxes, reduced to their two "outer" output bits and
  // pre-shifted into their final bit position within the 16-bit F output
  // (left-right DES order, per Blaze's mcg.c).
  const SBOXES = [
    [0x0002,0x0000,0x0000,0x0003,0x0003,0x0001,0x0001,0x0000,0x0000,0x0002,0x0003,0x0000,0x0003,0x0003,0x0002,0x0001,
     0x0001,0x0002,0x0002,0x0000,0x0000,0x0002,0x0002,0x0003,0x0001,0x0003,0x0003,0x0001,0x0000,0x0001,0x0001,0x0002,
     0x0000,0x0003,0x0001,0x0002,0x0002,0x0002,0x0002,0x0000,0x0003,0x0000,0x0000,0x0003,0x0000,0x0001,0x0003,0x0001,
     0x0003,0x0001,0x0002,0x0003,0x0003,0x0001,0x0001,0x0002,0x0001,0x0002,0x0002,0x0000,0x0001,0x0000,0x0000,0x0003],
    [0x000c,0x0004,0x0004,0x000c,0x0008,0x0000,0x0008,0x0004,0x0000,0x000c,0x000c,0x0000,0x0004,0x0008,0x0000,0x0008,
     0x000c,0x0008,0x0004,0x0000,0x0000,0x0004,0x000c,0x0008,0x0008,0x0000,0x0000,0x000c,0x0004,0x000c,0x0008,0x0004,
     0x0000,0x000c,0x0008,0x0008,0x0004,0x0008,0x000c,0x0004,0x0008,0x0004,0x0000,0x000c,0x000c,0x0000,0x0004,0x0000,
     0x0004,0x000c,0x0008,0x0000,0x0008,0x0004,0x0000,0x0008,0x000c,0x0000,0x0004,0x0004,0x0000,0x0008,0x000c,0x000c],
    [0x0020,0x0030,0x0000,0x0010,0x0030,0x0000,0x0020,0x0030,0x0000,0x0010,0x0010,0x0000,0x0030,0x0000,0x0010,0x0020,
     0x0010,0x0000,0x0030,0x0020,0x0020,0x0010,0x0010,0x0020,0x0030,0x0020,0x0000,0x0030,0x0000,0x0030,0x0020,0x0010,
     0x0030,0x0010,0x0000,0x0020,0x0000,0x0030,0x0030,0x0000,0x0020,0x0000,0x0030,0x0030,0x0010,0x0020,0x0000,0x0010,
     0x0030,0x0000,0x0010,0x0030,0x0000,0x0020,0x0020,0x0010,0x0010,0x0030,0x0020,0x0010,0x0020,0x0000,0x0010,0x0020],
    [0x0040,0x00c0,0x00c0,0x0080,0x0080,0x00c0,0x0040,0x0040,0x0000,0x0000,0x0000,0x00c0,0x00c0,0x0000,0x0080,0x0040,
     0x0040,0x0000,0x0000,0x0040,0x0080,0x0000,0x0040,0x0080,0x00c0,0x0040,0x0080,0x0080,0x0000,0x0080,0x00c0,0x00c0,
     0x0080,0x0040,0x0000,0x00c0,0x00c0,0x0000,0x0000,0x0000,0x0080,0x0080,0x00c0,0x0040,0x0040,0x00c0,0x00c0,0x0080,
     0x00c0,0x00c0,0x0040,0x0000,0x0040,0x0040,0x0080,0x00c0,0x0040,0x0080,0x0000,0x0040,0x0080,0x0000,0x0000,0x0080],
    [0x0000,0x0200,0x0200,0x0300,0x0000,0x0000,0x0100,0x0200,0x0100,0x0000,0x0200,0x0100,0x0300,0x0300,0x0000,0x0100,
     0x0200,0x0100,0x0100,0x0000,0x0100,0x0300,0x0300,0x0200,0x0300,0x0100,0x0000,0x0300,0x0200,0x0200,0x0300,0x0000,
     0x0000,0x0300,0x0000,0x0200,0x0100,0x0200,0x0300,0x0100,0x0200,0x0100,0x0300,0x0200,0x0100,0x0000,0x0200,0x0300,
     0x0300,0x0000,0x0300,0x0300,0x0200,0x0000,0x0100,0x0300,0x0000,0x0200,0x0100,0x0000,0x0000,0x0100,0x0200,0x0100],
    [0x0800,0x0800,0x0400,0x0c00,0x0800,0x0000,0x0c00,0x0000,0x0c00,0x0400,0x0000,0x0800,0x0000,0x0c00,0x0800,0x0400,
     0x0000,0x0000,0x0c00,0x0400,0x0400,0x0c00,0x0000,0x0800,0x0800,0x0000,0x0400,0x0c00,0x0400,0x0400,0x0c00,0x0800,
     0x0c00,0x0000,0x0800,0x0400,0x0c00,0x0000,0x0400,0x0800,0x0000,0x0c00,0x0800,0x0400,0x0800,0x0c00,0x0400,0x0800,
     0x0400,0x0c00,0x0000,0x0800,0x0000,0x0400,0x0800,0x0400,0x0400,0x0000,0x0c00,0x0000,0x0c00,0x0800,0x0000,0x0c00],
    [0x0000,0x3000,0x3000,0x0000,0x0000,0x3000,0x2000,0x1000,0x3000,0x0000,0x0000,0x3000,0x2000,0x1000,0x3000,0x2000,
     0x1000,0x2000,0x2000,0x1000,0x3000,0x1000,0x1000,0x2000,0x1000,0x0000,0x2000,0x3000,0x0000,0x2000,0x1000,0x0000,
     0x1000,0x0000,0x0000,0x3000,0x3000,0x3000,0x3000,0x2000,0x2000,0x1000,0x1000,0x0000,0x1000,0x2000,0x2000,0x1000,
     0x2000,0x3000,0x3000,0x1000,0x0000,0x0000,0x2000,0x3000,0x0000,0x2000,0x1000,0x0000,0x3000,0x1000,0x0000,0x2000],
    [0xc000,0x4000,0x0000,0xc000,0x8000,0xc000,0x0000,0x8000,0x0000,0x8000,0xc000,0x4000,0xc000,0x4000,0x4000,0x0000,
     0x8000,0x8000,0xc000,0x4000,0x4000,0x0000,0x8000,0xc000,0x4000,0x0000,0x0000,0x8000,0x8000,0xc000,0x4000,0x0000,
     0x4000,0x0000,0xc000,0x4000,0x0000,0x8000,0x4000,0x4000,0xc000,0x0000,0x8000,0x8000,0x8000,0x8000,0x0000,0xc000,
     0x0000,0xc000,0x0000,0x8000,0x8000,0xc000,0xc000,0x0000,0xc000,0x4000,0x4000,0x4000,0x4000,0x0000,0x8000,0xc000]
  ];

  // Input-bit selection for each of the 8 S-boxes: two bits taken from each
  // of the three 16-bit registers "a", "b", "c" fed into the round function.
  const SBITS = [
    [2,5,6,9,11,13], [1,4,7,10,8,14],
    [3,6,8,13,0,15], [12,14,1,2,4,10],
    [0,10,3,14,6,12], [7,8,12,15,1,5],
    [9,15,5,11,2,7], [11,13,0,4,3,9]
  ];

  // GUFN round function: 3 register words in, 16 bits out (2 per S-box).
  function roundF(a, b, c) {
    let out = 0;
    for (let j = 0; j < 8; j++) {
      const s = SBITS[j];
      const idx = OpCodes.And32(OpCodes.Shr32(a, s[0]), 1) | OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(a, s[1]), 1), 1) |
                  OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(b, s[2]), 1), 2) | OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(b, s[3]), 1), 3) |
                  OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(c, s[4]), 1), 4) | OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(c, s[5]), 1), 5);
      out |= SBOXES[j][idx];
    }
    return OpCodes.And32(out, 0xFFFF);
  }

  // Blaze's "encrypt" round sequence: subkeys consumed forward, ek[0..95].
  function forwardRounds(words, ek) {
    let [r0, r1, r2, r3] = words;
    let p = 0;
    for (let i = 0; i < ROUNDS / 4; i++) {
      let a, b, c;
      a = OpCodes.Xor16(r1, ek[p++]); b = OpCodes.Xor16(r2, ek[p++]); c = OpCodes.Xor16(r3, ek[p++]);
      r0 = OpCodes.Xor16(r0, roundF(a, b, c));
      a = OpCodes.Xor16(r2, ek[p++]); b = OpCodes.Xor16(r3, ek[p++]); c = OpCodes.Xor16(r0, ek[p++]);
      r1 = OpCodes.Xor16(r1, roundF(a, b, c));
      a = OpCodes.Xor16(r3, ek[p++]); b = OpCodes.Xor16(r0, ek[p++]); c = OpCodes.Xor16(r1, ek[p++]);
      r2 = OpCodes.Xor16(r2, roundF(a, b, c));
      a = OpCodes.Xor16(r0, ek[p++]); b = OpCodes.Xor16(r1, ek[p++]); c = OpCodes.Xor16(r2, ek[p++]);
      r3 = OpCodes.Xor16(r3, roundF(a, b, c));
    }
    return [r0, r1, r2, r3];
  }

  // Blaze's "decrypt" round sequence: subkeys consumed backward, ek[95..0].
  function reverseRounds(words, ek) {
    let [r0, r1, r2, r3] = words;
    let p = KSIZE;
    for (let i = 0; i < ROUNDS / 4; i++) {
      let a, b, c;
      c = OpCodes.Xor16(r2, ek[--p]); b = OpCodes.Xor16(r1, ek[--p]); a = OpCodes.Xor16(r0, ek[--p]);
      r3 = OpCodes.Xor16(r3, roundF(a, b, c));
      c = OpCodes.Xor16(r1, ek[--p]); b = OpCodes.Xor16(r0, ek[--p]); a = OpCodes.Xor16(r3, ek[--p]);
      r2 = OpCodes.Xor16(r2, roundF(a, b, c));
      c = OpCodes.Xor16(r0, ek[--p]); b = OpCodes.Xor16(r3, ek[--p]); a = OpCodes.Xor16(r2, ek[--p]);
      r1 = OpCodes.Xor16(r1, roundF(a, b, c));
      c = OpCodes.Xor16(r3, ek[--p]); b = OpCodes.Xor16(r2, ek[--p]); a = OpCodes.Xor16(r1, ek[--p]);
      r0 = OpCodes.Xor16(r0, roundF(a, b, c));
    }
    return [r0, r1, r2, r3];
  }

  function blockToWords(block) {
    return [
      OpCodes.Pack16LE(block[0], block[1]),
      OpCodes.Pack16LE(block[2], block[3]),
      OpCodes.Pack16LE(block[4], block[5]),
      OpCodes.Pack16LE(block[6], block[7])
    ];
  }

  function wordsToBlock(words) {
    return [
      ...OpCodes.Unpack16LE(words[0]),
      ...OpCodes.Unpack16LE(words[1]),
      ...OpCodes.Unpack16LE(words[2]),
      ...OpCodes.Unpack16LE(words[3])
    ];
  }

  // Self-encrypting key schedule (Blaze mcg_keyset): split the 128-bit key
  // into two 8-byte halves and repeatedly run each half through the
  // forward round sequence, folding 48 bits of ciphertext into the round
  // key array on every pass, until all 96 words have been mixed twice.
  function expandKey(keyBytes) {
    const ek = new Array(KSIZE).fill(0);
    const halves = [keyBytes.slice(0, 8), keyBytes.slice(8, 16)];
    for (let i = 0; i < 2; i++) {
      let half = halves[i].slice();
      for (let j = 0; j < ROUNDS; j++) {
        const words = forwardRounds(blockToWords(half), ek);
        half = wordsToBlock(words);
        ek[j * 3]     = OpCodes.Xor16(ek[j * 3],     OpCodes.Pack16LE(half[0], half[1]));
        ek[j * 3 + 1] = OpCodes.Xor16(ek[j * 3 + 1], OpCodes.Pack16LE(half[2], half[3]));
        ek[j * 3 + 2] = OpCodes.Xor16(ek[j * 3 + 2], OpCodes.Pack16LE(half[4], half[5]));
      }
    }
    return ek;
  }

  class DarkCryptMacGuffinAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "MacGuffin (DarkCrypt)";
      this.description = "MacGuffin GUFN block cipher (Blaze and Schneier, 1994) as implemented in the DarkCrypt Total Commander plugin: identical S-boxes, bit selection and self-encrypting key schedule to the original reference source, but with the encrypt/decrypt round-key directions swapped. 64-bit block, 128-bit key, 32 rounds.";
      this.inventor = "Matt Blaze, Bruce Schneier (base MacGuffin); DarkCrypt variant by Alexander Myasnikov";
      this.year = 1994;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("The MacGuffin Block Cipher Algorithm (Blaze and Schneier, FSE 1994)", "https://www.schneier.com/academic/archives/1995/01/the_macguffin_block.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Broken cipher", "MacGuffin was cryptanalyzed and broken at the same workshop where it was introduced (Rijmen and Preneel, 1994).", "Use AES or another vetted cipher."),
        new Vulnerability("Non-standard variant", "DarkCrypt swaps the encrypt/decrypt round-key directions relative to the original reference implementation; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Mg — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("91d3c484e44e69e9")
        },
        {
          text: "DarkCrypt Mg — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("667a727b5a48a9d8")
        },
        {
          text: "DarkCrypt Mg — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("68ed39824c45e8f7")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptMacGuffinInstance(this, isInverse);
    }
  }

  class DarkCryptMacGuffinInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. MacGuffin (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = expandKey(this._key);
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

    // DarkCrypt "crypt": Blaze's reverse (decrypt-direction) round-key sequence.
    _encryptBlock(block) {
      return wordsToBlock(reverseRounds(blockToWords(block), this._roundKeys));
    }

    // DarkCrypt "decrypt": Blaze's forward (encrypt-direction) round-key sequence.
    _decryptBlock(block) {
      return wordsToBlock(forwardRounds(blockToWords(block), this._roundKeys));
    }
  }

  const algorithmInstance = new DarkCryptMacGuffinAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMacGuffinAlgorithm, DarkCryptMacGuffinInstance };
}));
