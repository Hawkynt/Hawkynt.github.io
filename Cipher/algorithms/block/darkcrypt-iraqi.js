/*
 * Iraqi block cipher (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "Iraqi" block cipher as shipped in the DarkCrypt Total Commander plugin.
 * It is the obscure cipher that surfaced anonymously on Usenet around 1999:
 * a 5-round balanced Feistel network operating on two 128-bit halves of a
 * 256-bit block, with a 160-bit (20-byte) key.
 *
 *   - Key schedule (Blowfish-style) derives three key-dependent tables from two
 *     fixed tables and the key:
 *       * SB  : a 256-byte S-box, seeded as FIXED_S[i] ^ key[i mod 20] and then
 *               whitened by XOR-ing the output of a fixed-P Feistel run over an
 *               internal 32-byte seed buffer (4 iterations, before and after a
 *               second key XOR).
 *       * Pbox: a 16x16 table of 4-bit permutations, one row generated per round
 *               column by rejection-sampling nibbles from the fixed-P Feistel.
 *       * S2  : a 256-byte permutation, rejection-sampled the same way.
 *   - The round function F(half) maps each of 16 output bytes through a fixed
 *     boolean/arithmetic combination of 16 S-box lookups selected by a Pbox row,
 *     then post-mixes with S2.
 *   - Encryption: L,R = pt[0..15], pt[16..31]; five rounds of
 *       (L,R) <- (R, L ^ F(R)); output = R || L (halves swapped).
 *     The identical round function each round plus the final swap makes the
 *     cipher an involution, so decrypt() simply re-runs encrypt().
 *
 * Test vectors verified against the DarkCrypt implementation, including
 * encrypt/decrypt round-trip. 256-bit blocks, 160-bit keys.
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

  const KEY_LEN = 20;    // 160-bit key
  const BLOCK_LEN = 32;  // 256-bit block
  const ROUNDS = 5;      // 5-round balanced Feistel

  // Fixed 256-byte S-table seeding the key-dependent S-box.
  const FIXED_S = OpCodes.Hex8ToBytes(
    "ad54f0430135fe2429ac736ddfc798bd5a2e95c1da82fa28cb0423edecf6d58f" +
    "a9b030173dce4522619b046db7dc2a40157b1de9fd69b7d101bf710c2e0708b7" +
    "a6c7a6074e2587fcae548ca4985e16b93b44b53cb04333191cbe8ac62c5a5cdd" +
    "95afba1931d232ed29cf1fe27279e60f3a198e3a62e83b03bd1c087483b94efa" +
    "ef2174ad5e2d683e7ab31296f6fa11084f9de1ee2f0a853a087e5244998d029e" +
    "cc3282353b20f3a0ac23186b2373e48f1ce04d37191c7859ba98315475b41e8a" +
    "864db69d3de61695360f6e20d59b6a4e1017598c9ea96088ba681ec74323da9f" +
    "d26d1cee2196adb4f7c9539669a4e43bcf65dd633478c71f0690cad7d1312ac3");

  // Fixed 16x16 table of 4-bit permutations seeding the key-dependent P-box
  // and driving the fixed-P Feistel used during key setup.
  const FIXED_P = OpCodes.Hex8ToBytes(
    "050a010300040f0207090d080b0e0c0605070f0d0308010b0a00090c02060e04" +
    "04060c0e01000d0507090a0b020f08030304020c0d090108050f0e060a000b07" +
    "09080305040600020d0f0e010c0b070a0e0d030b0002010a070904050f060c08" +
    "0804000507030c0b0d0906010f0a020e0b0e0d01090804050c0607030a000f02" +
    "0d0c020106090e0b030a080f04050700010e0c0708000b09060504020a030f0d" +
    "06000a0805020b0d0e010409030c0f070c00050d02040806030f090a0e07010b" +
    "070a080b0902000305040c0f0e01060d08040f070a09030c060e000201050d0b" +
    "0b0d0e03050c070602000a08010f04090106030807040b0e000a09020f0c050d");

  // Fixed 32-byte seed buffer for the setup Feistel.
  const SEED32 = OpCodes.Hex8ToBytes(
    "2ef58a0df4e9ee9a8b1ef15a2fcdab61dfbe1c0ab90d17891ed0fe8fa5651b30");

  // Core mixing of the 16 selected S-box values into one output byte.
  function combine(g) {
    const t = OpCodes.And32((g[4] + g[5]) + OpCodes.Xor32(g[6], g[7]), 0xFF);
    const w = OpCodes.And32((g[0] | g[1]) + (g[2] | g[3]), 0xFF);
    const A = OpCodes.Xor32(t, w);
    const B1 = OpCodes.And32(OpCodes.Xor32(g[14], g[15]) + OpCodes.Xor32(g[12], OpCodes.And32(~g[13], 0xFF)), 0xFF);
    const B2 = OpCodes.And32(OpCodes.Xor32(g[9], OpCodes.And32(~g[8], 0xFF)) + OpCodes.And32(g[10], OpCodes.And32(~g[11], 0xFF)), 0xFF);
    return OpCodes.And32(A + OpCodes.Xor32(B1, B2), 0xFF);
  }

  // Round function using the fixed P-table (setup only; no S2 post-mix).
  function Ffixed(SB, D) {
    const O = new Array(16);
    for (let j = 0; j < 16; j++) {
      const g = new Array(16);
      for (let col = 0; col < 16; col++) g[col] = SB[D[FIXED_P[j * 16 + col]]];
      O[j] = combine(g);
    }
    return O;
  }

  // Round function used for actual encryption (key-dependent P-box + S2).
  function Ffull(SB, S2, Pbox, D) {
    const O = new Array(16);
    for (let j = 0; j < 16; j++) {
      const g = new Array(16);
      for (let col = 0; col < 16; col++) g[col] = SB[D[Pbox[j * 16 + col]]];
      const m = combine(g);
      O[j] = OpCodes.And32(S2[j] + m + S2[m], 0xFF);
    }
    return O;
  }

  // Balanced Feistel over a 32-byte block using the fixed-P round function.
  // roundsParam mirrors the reference loop bound (runs roundsParam-1 rounds), output
  // halves are NOT swapped. Returns the 32-byte state.
  function feistelFixed(SB, input32, roundsParam) {
    let L = input32.slice(0, 16), R = input32.slice(16, 32);
    for (let round = 1; round < roundsParam; round++) {
      const O = Ffixed(SB, R);
      const nR = new Array(16);
      for (let i = 0; i < 16; i++) nR[i] = OpCodes.And32(OpCodes.Xor32(L[i], O[i]), 0xFF);
      L = R; R = nR;
    }
    return L.concat(R);
  }

  // Blowfish-style key schedule: derives SB, S2 and Pbox from the key.
  function keySchedule(key) {
    const SB = new Array(256);
    const S2 = new Array(256);
    const Pbox = new Array(256).fill(0);

    // Phase A: seed S-box.
    for (let i = 0; i < 256; i++) SB[i] = OpCodes.And32(OpCodes.Xor32(FIXED_S[i], key[i % KEY_LEN]), 0xFF);

    // Phase B: whiten S-box with 4 rounds of the setup Feistel.
    let seed = SEED32.slice();
    let OUT = seed.slice();
    for (let b = 0; b < 4; b++) {
      OUT = feistelFixed(SB, seed, 32);
      for (let i = 0; i < 256; i++) SB[i] ^= OUT[i % 32];
      seed = OUT.slice();
    }

    // Phase C: build each P-box row as a permutation of 0..15 by
    // rejection-sampling nibbles from the fixed-P Feistel.
    for (let row = 0; row < 16; row++) {
      let c = 0;
      while (c < 16) {
        let dup = 0;
        OUT = feistelFixed(SB, OUT, 4);
        let ecx = 0;
        while (true) {
          if (ecx >= c) {
            if (dup !== 0) { dup = 0; }
            else { Pbox[row * 16 + c] = OpCodes.And32(OUT[7], 0x0F); c++; }
            if (c < 16) { dup = 0; OUT = feistelFixed(SB, OUT, 4); ecx = 0; continue; }
            break;
          } else if (Pbox[row * 16 + ecx] === OpCodes.And32(OUT[7], 0x0F)) {
            OUT = feistelFixed(SB, OUT, 4); dup = 1; ecx = c + 1; continue;
          } else { ecx++; continue; }
        }
      }
    }

    // Phase D: build S2 as a permutation of 0..255 the same way.
    let n = 0;
    while (n < 256) {
      let dup = 0;
      OUT = feistelFixed(SB, OUT, 4);
      for (let ecx = 0; ecx < n; ecx++) {
        if (S2[ecx] === OpCodes.And32(OUT[7], 0xFF)) { OUT = feistelFixed(SB, OUT, 4); dup = 1; break; }
      }
      if (dup === 0) { S2[n] = OpCodes.And32(OUT[7], 0xFF); n++; }
    }

    // Phase E: second key XOR, then another 4 Feistel whitening rounds.
    for (let i = 0; i < 256; i++) SB[i] ^= key[i % KEY_LEN];
    for (let b = 0; b < 4; b++) {
      OUT = feistelFixed(SB, seed, 32);
      for (let i = 0; i < 256; i++) SB[i] ^= OUT[i % 32];
      seed = OUT.slice();
    }

    return { SB, S2, Pbox };
  }

  // 5-round Feistel; because the round function is identical every round and the
  // halves are swapped on output, this is an involution (encrypt === decrypt).
  function processBlock(sched, block) {
    let L = block.slice(0, 16), R = block.slice(16, 32);
    for (let round = 0; round < ROUNDS; round++) {
      const O = Ffull(sched.SB, sched.S2, sched.Pbox, R);
      const nR = new Array(16);
      for (let i = 0; i < 16; i++) nR[i] = OpCodes.And32(OpCodes.Xor32(L[i], O[i]), 0xFF);
      L = R; R = nR;
    }
    return R.concat(L); // halves swapped
  }

  class DarkCryptIraqiAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Iraqi (DarkCrypt)";
      this.description = "The obscure \"Iraqi\" block cipher as shipped in the DarkCrypt Total Commander plugin: a 5-round balanced Feistel on two 128-bit halves of a 256-bit block, with a 160-bit key and key-dependent S-boxes/P-box.";
      this.inventor = "Anonymous (Iraqi block cipher); DarkCrypt packaging by Alexander Myasnikov";
      this.year = 1999;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.UNKNOWN;

      this.SupportedKeySizes = [new KeySize(20, 20, 0)];    // fixed 160-bit
      this.SupportedBlockSizes = [new KeySize(32, 32, 0)];  // fixed 256-bit

      this.documentation = [
        new LinkItem("Iraqi block cipher (Wikipedia)", "https://en.wikipedia.org/wiki/Iraqi_block_cipher"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unvetted / hoax-origin cipher", "The Iraqi cipher is widely regarded as a hoax of unknown provenance and has received little serious analysis; the DarkCrypt packaging is unmodified from that anonymous source.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Iraq — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0b58520f6a3c1e637046167357bc68cdbf7ce08f15543ae55996555483430e86")
        },
        {
          text: "DarkCrypt Iraq — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"),
          expected: OpCodes.Hex8ToBytes("078953cf710d92ce42a2f3b70f37bf175da25d7caf157d8255464232f3f116f3")
        },
        {
          text: "DarkCrypt Iraq — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f1011121314"),
          expected: OpCodes.Hex8ToBytes("fd8db3a65199496eba32fca274ee0e44e9cffaacd85363369c4b1bc30fe1bc2a")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptIraqiInstance(this, isInverse);
    }
  }

  class DarkCryptIraqiInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._sched = null;
      this.inputBuffer = [];
      this.BlockSize = BLOCK_LEN;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._sched = null; this.KeySize = 0; return; }
      if (keyBytes.length !== KEY_LEN)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Iraqi (DarkCrypt) requires exactly ${KEY_LEN} bytes`);
      this._key = [...keyBytes];
      this._sched = keySchedule(this._key);
      this.KeySize = keyBytes.length;
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._sched) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._sched) throw new Error("Key not set");
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

    // The cipher is an involution, so encrypt and decrypt are identical.
    _encryptBlock(block) { return processBlock(this._sched, block); }
    _decryptBlock(block) { return processBlock(this._sched, block); }
  }

  const algorithmInstance = new DarkCryptIraqiAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptIraqiAlgorithm, DarkCryptIraqiInstance };
}));
