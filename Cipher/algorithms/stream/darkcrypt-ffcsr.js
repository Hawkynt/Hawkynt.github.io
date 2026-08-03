/*
 * F-FCSR (DarkCrypt variant) Stream Cipher
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "FFCSR" stream cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project).
 *
 * It is a Feedback-with-Carry Shift Register (Galois FCSR) filter generator, but does
 * NOT match the textbook eSTREAM F-FCSR-H/F-FCSR-8 parameters:
 *   - 256-bit main register (8 x 32-bit words) plus a 256-bit carry register.
 *   - Feedback polynomial d = {390002C6, EFB55A6E, BAF08F39, 2102F996,
 *                              C8C9CEDB, 780CAA2E, AD4F7E66, CB5E129F} (word 0..7).
 *   - Filter mask equals the feedback polynomial d; output = fold32to16(XOR M[i] AND d[i]),
 *     yielding 16 keystream bits (2 bytes) per clock.
 *   - 128-bit key and 128-bit IV, loaded big-endian into the words.
 *   - Key/IV schedule: seed M with key+IV, run 16 clock/filter steps whose 16-bit
 *     outputs re-seed M, zero the carry, then 258 warm-up clocks before keystream.
 * Galois transition per clock: shift M right by one bit (feedback bit fb = M[0]&1),
 * then at each word sum = SM XOR C XOR (fb AND d), carry = majority(SM, C, fb AND d).
 * Test vectors generated from the DarkCrypt implementation.
 * 128-bit key, 128-bit IV. Educational only.
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
          StreamCipherAlgorithm, IAlgorithmInstance,
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // Feedback polynomial / filter mask (words 0..7)
  const D = [0x390002C6, 0xEFB55A6E, 0xBAF08F39, 0x2102F996,
             0xC8C9CEDB, 0x780CAA2E, 0xAD4F7E66, 0xCB5E129F];

  function beDword(bytes, o) {
    return OpCodes.ToUint32(OpCodes.Shl32(bytes[o], 24) | OpCodes.Shl32(bytes[o + 1], 16) | OpCodes.Shl32(bytes[o + 2], 8) | bytes[o + 3]);
  }

  class DarkCryptFFCSRAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "F-FCSR (DarkCrypt)";
      this.description = "Feedback-with-Carry Shift Register (Galois FCSR) filter generator from the DarkCrypt Total Commander plugin. Non-standard 256-bit register variant with a custom feedback polynomial, 128-bit key and 128-bit IV.";
      this.inventor = "François Arnault, Thierry Berger, Cédric Lauradoux (base F-FCSR); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "FCSR Stream Cipher";
      this.securityStatus = SecurityStatus.INSECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit key
      this.SupportedNonceSizes = [new KeySize(16, 16, 0)];  // fixed 128-bit IV

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("F-FCSR Specification (base algorithm)", "https://www.ecrypt.eu.org/stream/ciphers/ffcsr/ffcsr.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Broken family", "The F-FCSR family was cryptanalytically broken; this non-standard variant is unanalyzed.", "Use a modern vetted stream cipher.")
      ];

      // Vectors generated from the DarkCrypt implementation (setup(key,iv) then crypt).
      // key = 00 01 .. 0f, iv = 16 zero bytes.
      this.tests = [
        {
          text: "DarkCrypt Ffcsr — keystream (zero input)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("76ca63bf052e9a95075561334c58b548f7fd37f3d211bcbcdef9179ada8227db98454d5385979d0c2870dab8060ebfdbe1867588ffccc9103e9eba78e4e25e54753831b76e78b0b5f80263c43b57efe618c838c23176f5cb3e87ecf323fa802a6b91ccfba84d26d1052ed0c923ae3068de16643f9934e513c232f6b99ae17363")
        },
        {
          text: "DarkCrypt Ffcsr — encryption of incrementing bytes 00..3f",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("76cb61bc012b9c920f5c6b384055bb47e7ec25e0c604aaabc6e00d81c69f39c4b8646f70a1b2bb2b0059f0932a2391f4d1b747bbcbf9ff2706a78043d8df606b")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptFFCSRInstance(this, isInverse);
    }
  }

  class DarkCryptFFCSRInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];
      this.M = null;
      this.C = null;
      this.initialized = false;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.initialized = false; return; }
      if (keyBytes.length !== 16)
        throw new Error(`F-FCSR (DarkCrypt) requires a 16-byte key, got ${keyBytes.length}`);
      this._key = [...keyBytes];
      this._initIfReady();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; this.initialized = false; return; }
      if (ivBytes.length !== 16)
        throw new Error(`F-FCSR (DarkCrypt) requires a 16-byte IV, got ${ivBytes.length}`);
      this._iv = [...ivBytes];
      this._initIfReady();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

    _initIfReady() {
      if (!this._key || !this._iv) return;
      const key = this._key, iv = this._iv;
      const M = new Array(8).fill(0);
      const C = new Array(8).fill(0);

      // Key load (big-endian words), save key words
      M[3] = beDword(key, 0); M[2] = beDword(key, 4); M[1] = beDword(key, 8); M[0] = beDword(key, 12);
      const K = [M[0], M[1], M[2], M[3]];

      // IV load: reload key into low words, IV into high words
      for (let i = 0; i < 8; i++) C[i] = 0;
      M[0] = K[0]; M[1] = K[1]; M[2] = K[2]; M[3] = K[3];
      M[4] = beDword(iv, 12); M[5] = beDword(iv, 8); M[6] = beDword(iv, 4); M[7] = beDword(iv, 0);

      // 16 clock/filter steps whose 16-bit outputs re-seed M
      const wbuf = new Array(16);
      for (let k = 0; k < 16; k++) { this._clock(M, C); wbuf[k] = this._filter(M); }
      for (let i = 0; i < 8; i++) M[i] = OpCodes.ToUint32(OpCodes.Shl32(wbuf[2 * i + 1], 16) | wbuf[2 * i]);
      for (let i = 0; i < 8; i++) C[i] = 0;

      // 258 warm-up clocks
      for (let k = 0; k < 258; k++) this._clock(M, C);

      this.M = M; this.C = C;
      this.initialized = true;
    }

    // Galois FCSR transition: shift M right by one bit, add feedback with carry
    _clock(M, C) {
      const fb = OpCodes.And32(M[0], 1);
      const SM = new Array(8);
      for (let i = 0; i < 7; i++) SM[i] = OpCodes.ToUint32(OpCodes.Shr32(M[i], 1) | OpCodes.Shl32(OpCodes.And32(M[i + 1], 1), 31));
      SM[7] = OpCodes.Shr32(M[7], 1);
      for (let i = 0; i < 8; i++) {
        const t = fb ? D[i] : 0;
        const Ci = C[i];
        M[i] = OpCodes.Xor32(OpCodes.Xor32(SM[i], Ci), t);
        C[i] = OpCodes.Xor32(OpCodes.And32(Ci, SM[i]), OpCodes.And32(t, OpCodes.Xor32(SM[i], Ci)));
      }
    }

    // Filter: fold XOR of (M[i] AND d[i]) from 32 to 16 bits
    _filter(M) {
      let acc = 0;
      for (let i = 0; i < 8; i++) acc = OpCodes.Xor32(acc, OpCodes.And32(M[i], D[i]));
      acc = OpCodes.Xor32(acc, OpCodes.Shr32(acc, 16));
      return OpCodes.And32(acc, 0xFFFF);
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.initialized) throw new Error("F-FCSR (DarkCrypt) not initialized");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const out = new Array(this.inputBuffer.length);
      for (let i = 0; i < this.inputBuffer.length; i += 2) {
        this._clock(this.M, this.C);
        const f = this._filter(this.M);
        out[i] = OpCodes.Xor32(OpCodes.And32(f, 0xFF), this.inputBuffer[i]);
        if (i + 1 < this.inputBuffer.length)
          out[i + 1] = OpCodes.Xor32(OpCodes.And32(OpCodes.Shr32(f, 8), 0xFF), this.inputBuffer[i + 1]);
      }
      this.inputBuffer = [];
      return out;
    }
  }

  const algorithmInstance = new DarkCryptFFCSRAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptFFCSRAlgorithm, DarkCryptFFCSRInstance };
}));
