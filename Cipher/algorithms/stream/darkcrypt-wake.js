/*
 * WAKE (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * WAKE as implemented in the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project).
 *
 * This is David Wheeler's WAKE cipher (table-driven, 257-word M() cascade,
 * TT[8] constant table identical to the published algorithm), but with two
 * confirmed deviations from the textbook/Crypto++ construction:
 *   - setup(key, iv) only reads 16 bytes (128 bits) from the key buffer,
 *     not 32; those same 16 bytes seed BOTH the 257-word table (t[0..3] =
 *     key words, matching Crypto++'s k0..k3 role) AND the four running
 *     registers r3..r6 (matching Crypto++'s r3..r6 role) -- i.e. this
 *     implementation does not use a separate second key half. WAKE is often
 *     documented as a 256-bit-key cipher, but only 128 bits are actually
 *     consumed here.
 *   - the table-fill step's shift is a plain logical (unsigned) shift, not
 *     an arithmetic/signed shift as some WAKE ports use.
 *   - crypt(buf, len) XORs the keystream into buf IN PLACE, and after the
 *     first 4-byte word of keystream is produced, subsequent words feed the
 *     just-produced CIPHERTEXT word (not a fixed internal register) into
 *     the first M() of the next round -- output feedback for the first
 *     word, then ciphertext-autokeyed feedback afterwards. setup() also
 *     accepts a 32-byte IV, but it has no observable effect on the produced
 *     keystream, so it is accepted for API compatibility and otherwise
 *     ignored.
 * Test vectors verified against the DarkCrypt implementation (key = 00 01
 * 02 ... 0F, iv = 32 zero bytes).
 *
 * 128-bit key. Educational only; WAKE is a broken, historic cipher.
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

  const KEY_SIZE = 16; // 128 bits (only the first 16 key bytes are used)
  const IV_SIZE = 32;  // consumed by setup() but has no effect on the keystream

  // TT[8] constant table, identical to the published WAKE algorithm.
  const TT = [
    0x726a8f3b, 0xe69a3b5c, 0xd3c71fe5, 0xab3c73d2,
    0x4d3a8eb3, 0x0396d6e8, 0x3d4c2f7a, 0x9ee27cf3
  ];

  function genTable(k0, k1, k2, k3) {
    const t = new Array(257).fill(0);
    t[0] = OpCodes.ToUint32(k0);
    t[1] = OpCodes.ToUint32(k1);
    t[2] = OpCodes.ToUint32(k2);
    t[3] = OpCodes.ToUint32(k3);

    // Fill table: t[p] = (t[p-4]+t[p-1] logical-shifted right 3) XOR TT[sum&7]
    for (let p = 4; p < 256; p++) {
      const sum = OpCodes.ToUint32(OpCodes.Add32(t[p - 4], t[p - 1]));
      t[p] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shr32(sum, 3), TT[OpCodes.And32(sum, 7)]));
    }

    // Mix first 23 entries
    for (let p = 0; p < 23; p++)
      t[p] = OpCodes.ToUint32(OpCodes.Add32(t[p], t[p + 89]));

    // Change top byte to a permutation, driven by t[33]/t[59]
    let x = t[33];
    let z = OpCodes.ToUint32(OpCodes.Or32(t[59], 0x01000001));
    z = OpCodes.ToUint32(OpCodes.And32(z, 0xff7fffff));

    for (let p = 0; p < 256; p++) {
      x = OpCodes.ToUint32(OpCodes.Add32(OpCodes.And32(x, 0xff7fffff), z));
      t[p] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.And32(t[p], 0x00ffffff), x));
    }

    t[256] = t[0];

    // Final index permutation: y = byte(t[p^y]^y); t[p]=t[y]; t[y]=t[p+1]
    // (the two stores must happen in THIS order -- when y==p the
    // second store, t[y]=t[p+1], wins)
    let y = OpCodes.And32(x, 0xff);
    for (let p = 0; p < 256; p++) {
      y = OpCodes.And32(OpCodes.Xor32(t[OpCodes.And32(OpCodes.Xor32(p, y), 0xff)], y), 0xff);
      const temp = t[y];
      t[p] = temp;
      const next = t[p + 1];
      t[y] = next;
    }

    return t;
  }

  function M(t, x, y) {
    const w = OpCodes.ToUint32(OpCodes.Add32(x, y));
    return OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shr32(w, 8), t[OpCodes.And32(w, 0xff)]));
  }

  class DarkCryptWakeAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "WAKE (DarkCrypt)";
      this.description = "David Wheeler's WAKE stream cipher as implemented in the DarkCrypt Total Commander plugin: a 257-word table-driven M() cascade over four running registers, with ciphertext-autokeyed feedback between words. Only a 128-bit key is actually consumed despite the algorithm's commonly documented 256-bit key.";
      this.inventor = "David Wheeler";
      this.year = 1993;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.GB;

      this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 0)]; // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("Wheeler: A Bulk Data Encryption Algorithm", "https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-249.pdf"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Chosen plaintext/ciphertext attacks", "WAKE's M() cascade is known to be vulnerable to chosen plaintext/ciphertext attacks; the DarkCrypt variant additionally autokeys on its own ciphertext output.", "Use a vetted stream cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv)
      // then crypt(buf,len) in-place XOR; key = 00..0F, iv = 32 zero bytes).
      this.tests = [
        {
          text: "DarkCrypt Wake — keystream from incrementing key, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("0c0d0e0fadce43a5bd2e485c632d8608d6695564b103608d49b8c481e7a9d85966147da4967a7d9b18978fbf3935674798116f610e7f0bd118355b7a0167a3b1737e20e2aeaffc47f2f082e4396e023e119c52e454e50e9dc9e311f0c91a88bb07efb68dc574f32ad06b7c3ec545539b3e9fd0da3015901b8c5102d72dd203ae")
        },
        {
          text: "DarkCrypt Wake — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("0c0c0c0c9995d326fda1a6bbe95a897635a9235a80fcce412c604bee1f002bb397b0726ba90e21f0d735c8b9eae292d16e917dee685ce2d93d1d11c50e8f5683")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptWakeInstance(this, isInverse);
    }
  }

  class DarkCryptWakeInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;

      this._t = null;
      this._RA = 0; this._RB = 0; this._RC = 0; this._RD = 0;
      this._pendingBytes = [0, 0, 0, 0]; // current 4-byte output word, LE
      this._wordPos = 0;                  // 0..3, position within pendingBytes
      this._cbuf = [0, 0, 0, 0];          // ciphertext bytes of the current word being produced
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== KEY_SIZE)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. WAKE (DarkCrypt) requires exactly ${KEY_SIZE} bytes`);
      this._key = [...keyBytes];
      this._initialize();
    }

    get key() { return this._key ? [...this._key] : null; }

    // Accepted for API compatibility with the reference setup(key,iv); has
    // no effect on the keystream (see header comment), so it is only
    // range-checked, never consumed.
    set iv(ivBytes) {
      if (ivBytes && ivBytes.length !== IV_SIZE)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. WAKE (DarkCrypt) expects ${IV_SIZE} bytes (ignored)`);
    }

    get iv() { return null; }

    _initialize() {
      const k0 = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      const k1 = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
      const k2 = OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]);
      const k3 = OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]);

      this._t = genTable(k0, k1, k2, k3);
      this._RA = k0; this._RB = k1; this._RC = k2; this._RD = k3;
      this._pendingBytes = OpCodes.Unpack32LE(this._RD);
      this._wordPos = 0;
      this._cbuf = [0, 0, 0, 0];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const out = new Array(this.inputBuffer.length);
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const outByte = OpCodes.And32(OpCodes.Xor32(this._pendingBytes[this._wordPos], this.inputBuffer[i]), 0xff);
        out[i] = outByte;
        // Autokey feedback always uses the CIPHERTEXT byte: that is the output
        // when encrypting, but the *input* (already ciphertext) when decrypting.
        this._cbuf[this._wordPos] = this.isInverse ? this.inputBuffer[i] : outByte;
        this._wordPos++;

        if (this._wordPos === 4) {
          const cipherWord = OpCodes.Pack32LE(this._cbuf[0], this._cbuf[1], this._cbuf[2], this._cbuf[3]);
          const newA = M(this._t, this._RA, cipherWord);
          const newB = M(this._t, this._RB, newA);
          const newC = M(this._t, this._RC, newB);
          const newD = M(this._t, this._RD, newC);
          this._RA = newA; this._RB = newB; this._RC = newC; this._RD = newD;
          this._pendingBytes = OpCodes.Unpack32LE(this._RD);
          this._wordPos = 0;
        }
      }

      this.inputBuffer = [];
      return out;
    }
  }

  const algorithmInstance = new DarkCryptWakeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptWakeAlgorithm, DarkCryptWakeInstance };
}));
