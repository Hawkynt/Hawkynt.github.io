/*
 * Pike (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Pike is a lagged-Fibonacci stream cipher designed by Ross Anderson (1994) as a
 * faster, hardened replacement for his earlier FISH cipher after Golic showed FISH's
 * two-register design was breakable. Pike keeps three lagged add-with-carry registers
 * of pairwise-distinct lengths (55, 57 and 58 words here); on every step each register
 * either clocks or stands still depending on how its own carry bit compares to the
 * majority of all three carry bits, and the three registers' outputs are XORed to form
 * one keystream word. A register that clocks reads its two lag-separated words, adds
 * them (with the carry-out recorded for the next step's majority vote), and outputs the
 * sum; the register's contents themselves are never rewritten, only its two read cursors
 * advance and wrap. The 64-byte secret key seeds a 680-byte buffer (repeating the key
 * cyclically, with its very first byte overwritten by the key length), which is then
 * whitened by repeatedly compressing the whole buffer with a compact SHA-family digest
 * and writing each 20-byte result back into the buffer at an advancing position; the
 * finished buffer is split word-for-word into the three registers.
 *
 * Key size: 64 bytes (fixed by the DarkCrypt Total Commander plugin build). No IV.
 * Encryption and decryption are identical (plain keystream XOR). Educational only.
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

  const KEY_SIZE = 64;                    // fixed 64-byte key
  const SEED_SIZE = 680;                  // 34 rounds * 20 bytes
  const WHITEN_ROUNDS = 34;
  const DIGEST_WORDS = 5;                 // 20 bytes written back per round
  const BLOCK_WORDS = 200;                // keystream words produced per generator block
  const BLOCK_BYTES = BLOCK_WORDS * 4;    // 800 bytes

  // Lagged-register shapes: word count and lag of registers A, B and C.
  /** @type {int32[]} */
  const REG_LENGTHS = [55, 57, 58];
  /** @type {int32[]} */
  const REG_LAGS = [31, 50, 39];

  // Round constants and initial chaining values for the internal seed-whitening digest
  // (an 80-round Merkle-Damgard compression with a non-rotating message schedule).
  /** @type {uint32[]} */
  const DIGEST_K = [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6];
  /** @type {uint32[]} */
  const DIGEST_IV = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];

  // Compress an arbitrary-length byte array into a 5-word (20-byte) digest. Standard
  // MD-strengthening padding (0x80, zero fill, 64-bit big-endian bit length); message
  // words are big-endian; the schedule expansion W[t]=W[t-3]^W[t-8]^W[t-14]^W[t-16] has
  // no additional rotation.
  /**
   * @param {uint8[]} bytes
   * @returns {uint32[]}
   */
  function compressDigest(bytes) {
    /** @type {uint8[]} */
    const padded = bytes.slice();
    padded.push(0x80);
    while ((padded.length % 64) !== 56) padded.push(0);
    const bitLenLo = OpCodes.ToUint32(bytes.length * 8);
    const lenHiBytes = OpCodes.Unpack32BE(0);
    const lenLoBytes = OpCodes.Unpack32BE(bitLenLo);
    for (let i = 0; i < 4; i++) padded.push(lenHiBytes[i]);
    for (let i = 0; i < 4; i++) padded.push(lenLoBytes[i]);

    /** @type {uint32} */
    let h0 = DIGEST_IV[0];
    /** @type {uint32} */
    let h1 = DIGEST_IV[1];
    /** @type {uint32} */
    let h2 = DIGEST_IV[2];
    /** @type {uint32} */
    let h3 = DIGEST_IV[3];
    /** @type {uint32} */
    let h4 = DIGEST_IV[4];

    for (let off = 0; off < padded.length; off += 64) {
      /** @type {uint32[]} */
      const w = new Array(80);
      for (let t = 0; t < 16; t++) {
        const p = off + t * 4;
        w[t] = OpCodes.Pack32BE(padded[p], padded[p + 1], padded[p + 2], padded[p + 3]);
      }
      for (let t = 16; t < 80; t++)
        w[t] = OpCodes.Xor32(OpCodes.Xor32(w[t - 3], w[t - 8]), OpCodes.Xor32(w[t - 14], w[t - 16]));

      /** @type {uint32} */
      let a = h0;
      /** @type {uint32} */
      let b = h1;
      /** @type {uint32} */
      let c = h2;
      /** @type {uint32} */
      let d = h3;
      /** @type {uint32} */
      let e = h4;
      for (let t = 0; t < 80; t++) {
        /** @type {uint32} */
        let f = 0;
        if (t < 20) f = OpCodes.Or32(OpCodes.And32(b, c), OpCodes.And32(OpCodes.Not32(b), d));
        else if (t < 40) f = OpCodes.Xor32(OpCodes.Xor32(b, c), d);
        else if (t < 60) f = OpCodes.Or32(OpCodes.Or32(OpCodes.And32(b, c), OpCodes.And32(b, d)), OpCodes.And32(c, d));
        else f = OpCodes.Xor32(OpCodes.Xor32(b, c), d);

        const k = DIGEST_K[(t / 20) | 0];
        const temp = OpCodes.Add32(OpCodes.Add32(OpCodes.RotL32(a, 5), f), OpCodes.Add32(OpCodes.Add32(e, k), w[t]));
        e = d; d = c; c = OpCodes.RotL32(b, 30); b = a; a = temp;
      }
      h0 = OpCodes.Add32(h0, a); h1 = OpCodes.Add32(h1, b); h2 = OpCodes.Add32(h2, c);
      h3 = OpCodes.Add32(h3, d); h4 = OpCodes.Add32(h4, e);
    }
    /** @type {uint32[]} */
    const digest = [h0, h1, h2, h3, h4];
    return digest;
  }

  // Build the 680-byte whitened seed buffer from the 64-byte key: cyclic key fill with
  // the first byte overwritten by the key length, then 34 rounds of "digest the whole
  // buffer, write the 20-byte result back at the next 20-byte slot" self-mixing.
  /**
   * @param {uint8[]} keyBytes
   * @returns {uint8[]}
   */
  function buildSeed(keyBytes) {
    const keyLen = keyBytes.length;
    /** @type {uint8[]} */
    const seed = new Array(SEED_SIZE);
    for (let i = 0; i < SEED_SIZE; i++) seed[i] = keyBytes[i % keyLen];
    seed[0] = OpCodes.And32(keyLen, 0xFF);

    for (let round = 0; round < WHITEN_ROUNDS; round++) {
      /** @type {uint32[]} */
      const digest = compressDigest(seed);
      const pos = round * (DIGEST_WORDS * 4);
      for (let w = 0; w < DIGEST_WORDS; w++) {
        const b = OpCodes.Unpack32LE(digest[w]);
        const o = pos + w * 4;
        seed[o] = b[0]; seed[o + 1] = b[1]; seed[o + 2] = b[2]; seed[o + 3] = b[3];
      }
    }
    return seed;
  }

  /**
   * @param {uint8[]} seed
   * @returns {uint32[]}
   */
  function seedToWords(seed) {
    /** @type {uint32[]} */
    const words = new Array(SEED_SIZE / 4);
    for (let w = 0; w < words.length; w++) {
      const o = w * 4;
      words[w] = OpCodes.Pack32LE(seed[o], seed[o + 1], seed[o + 2], seed[o + 3]);
    }
    return words;
  }

  // One lagged register: its words, two read cursors, the last output word and carry.
  class PikeRegister {
    constructor() {
      /** @type {int32} */
      this.length = 0;
      /** @type {uint32[]} */
      this.buf = [];
      /** @type {int32} */
      this.idx1 = 0;
      /** @type {int32} */
      this.idx2 = 0;
      /** @type {uint32} */
      this.carry = 0;
      /** @type {uint32} */
      this.field = 0;
    }
  }

  /**
   * @param {int32} length
   * @param {int32} lag
   * @param {uint32[]} words
   * @returns {PikeRegister}
   */
  function makeRegister(length, lag, words) {
    const reg = new PikeRegister();
    reg.length = length;
    reg.buf = words;
    reg.idx2 = lag % length;
    return reg;
  }

  // Clock one register: read its two lag-separated words, output their sum, record the
  // carry-out (whether the unsigned addition wrapped), and advance both read cursors.
  // The register's own contents are never modified.
  /**
   * @param {PikeRegister} reg
   */
  function clockRegister(reg) {
    const a = OpCodes.ToUint32(reg.buf[reg.idx1]);
    const b = OpCodes.ToUint32(reg.buf[reg.idx2]);
    const sum = OpCodes.Add32(a, b);
    const minAB = a < b ? a : b;
    reg.field = sum;
    reg.carry = minAB > sum ? 1 : 0;
    reg.idx1 = (reg.idx1 + 1) % reg.length;
    reg.idx2 = (reg.idx2 + 1) % reg.length;
  }

  // Produce `count` keystream words. Each step clocks whichever registers have a carry
  // bit matching the majority of all three carry bits (a register whose carry disagrees
  // with the majority stands still that step); the keystream word is the XOR of the
  // three registers' current outputs.
  /**
   * @param {PikeRegister[]} regs
   * @param {int32} count
   * @returns {uint32[]}
   */
  function generateWords(regs, count) {
    /** @type {PikeRegister} */
    const a = regs[0];
    /** @type {PikeRegister} */
    const b = regs[1];
    /** @type {PikeRegister} */
    const c = regs[2];
    /** @type {uint32[]} */
    const out = new Array(count);
    for (let i = 0; i < count; i++) {
      const maj = OpCodes.Or32(OpCodes.Or32(OpCodes.And32(b.carry, a.carry), OpCodes.And32(b.carry, c.carry)), OpCodes.And32(a.carry, c.carry));
      if (maj === a.carry) clockRegister(a);
      if (maj === b.carry) clockRegister(b);
      if (maj === c.carry) clockRegister(c);
      out[i] = OpCodes.Xor32(OpCodes.Xor32(a.field, b.field), c.field);
    }
    return out;
  }

  /**
   * @param {uint32[]} words
   * @returns {uint8[]}
   */
  function wordsToBytes(words) {
    /** @type {uint8[]} */
    const out = new Array(words.length * 4);
    for (let w = 0; w < words.length; w++) {
      const b = OpCodes.Unpack32LE(words[w]);
      out[w * 4] = b[0]; out[w * 4 + 1] = b[1]; out[w * 4 + 2] = b[2]; out[w * 4 + 3] = b[3];
    }
    return out;
  }

  class DarkCryptPikeAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Pike (DarkCrypt)";
      this.description = "Lagged-Fibonacci stream cipher with three add-with-carry registers of lengths 55, 57 and 58 words; each step, registers whose carry bit matches the majority of all three clock and output the sum of two lag-separated words, and the three outputs are XORed into one keystream word. From the DarkCrypt Total Commander plugin build.";
      this.inventor = "Ross Anderson";
      this.year = 1994;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.GB;

      this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 0)];
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("FISH and Pike stream ciphers (background and history)", "https://en.wikipedia.org/wiki/FISH_(cipher)")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed construction", "Lagged-Fibonacci design with weaker public cryptanalysis than mainstream stream ciphers of similar age; not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors: key = 64 bytes 0x00..0x3F; verified round-trip against the original
      // DarkCrypt Pike plugin build (encrypt then decrypt of the incrementing-byte vector
      // reproduces the plaintext exactly).
      this.tests = [
        {
          text: "DarkCrypt Pike - 64-byte key keystream",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: (function () { const z = OpCodes.CreateArray(128, 0); return z; })(),
          key: (function () { const k = new Array(KEY_SIZE); for (let i = 0; i < KEY_SIZE; i++) k[i] = OpCodes.And32(i, 0xFF); return k; })(),
          expected: OpCodes.Hex8ToBytes("35d6782712939f32ec285eb4bb2d69ca9b40f741c877ada8dcc7f3621c46f25c41ff7dae6fee4983a225f7007beb26fd038138499fbef54e310d899ccbe82193f1cba7645c56cf82fc582a3527662d085d269059929eb783f1953d7dad93ad703e77943c37cb50be8a4aeb3cfacb3365c10e4f6ffe45b7d9ef09aaf4b45ab7da")
        },
        {
          text: "DarkCrypt Pike - incrementing plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: (function () { const k = new Array(KEY_SIZE); for (let i = 0; i < KEY_SIZE; i++) k[i] = OpCodes.And32(i, 0xFF); return k; })(),
          expected: OpCodes.Hex8ToBytes("35d77a2416969935e42154bfb72067c58b51e552dc62bbbfc4dee979005bec4361de5f8d4bcb6fa48a0cdd2b57c608d233b00a7aab8bc3790934b3a7f7d51fac")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptPikeInstance(this, isInverse);
    }
  }

  class DarkCryptPikeInstance extends IAlgorithmInstance {
    /**
     * @param {DarkCryptPikeAlgorithm} algorithm
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

      /** @type {PikeRegister[]|null} */
      this._regs = null;     // [regA, regB, regC]
    }

    /**
     * @param {uint8[]|null} keyBytes
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== KEY_SIZE)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. Pike (DarkCrypt) requires exactly " + KEY_SIZE + " bytes");
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
      const output = this._process(this.inputBuffer);
      this.inputBuffer = [];
      return output;
    }

    // Whiten the key into a 680-byte seed and split it word-for-word into the three
    // lagged registers, ready to be clocked from a freshly reset state.
    _initialize() {
      /** @type {uint8[]} */
      const seed = buildSeed(this._key);
      /** @type {uint32[]} */
      const words = seedToWords(seed);

      /** @type {int32} */
      let offset = 0;
      /** @type {PikeRegister[]} */
      const regs = [];
      for (let r = 0; r < REG_LENGTHS.length; r++) {
        /** @type {uint32[]} */
        const slice = words.slice(offset, offset + REG_LENGTHS[r]);
        offset += REG_LENGTHS[r];
        regs.push(makeRegister(REG_LENGTHS[r], REG_LAGS[r], slice));
      }

      this._regs = regs;
    }

    // Every buffer is enciphered against freshly generated keystream blocks of up to
    // 800 bytes each (200 generator words), continuing the register state across blocks.
    /**
     * @param {uint8[]} data
     * @returns {uint8[]}
     */
    _process(data) {
      /** @type {uint8[]} */
      const out = new Array(data.length);
      /** @type {int32} */
      let pos = 0;
      while (pos < data.length) {
        /** @type {uint8[]} */
        const ksBytes = wordsToBytes(generateWords(this._regs, BLOCK_WORDS));
        /** @type {int32} */
        const chunk = Math.min(BLOCK_BYTES, data.length - pos);
        for (let k = 0; k < chunk; k++)
          out[pos + k] = OpCodes.Xor32(data[pos + k], ksBytes[k]);
        pos += chunk;
      }
      return out;
    }
  }

  const algorithmInstance = new DarkCryptPikeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptPikeAlgorithm, DarkCryptPikeInstance };
}));
