/*
 * LILI-2 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LILI-2 is the DarkCrypt Total Commander plugin's enlarged successor to
 * LILI-128 (Alexander Myasnikov, "Zarya" project). It keeps LILI-128's
 * overall clock-controlled two-register structure but widens both
 * registers to 128 bits (16 bytes) and both keys AND has a 128-bit IV:
 *   - LFSRc: a 128-bit shift register. Before each output bit it yields a
 *     clock count k = 1 + bit6(byte0) + 2*bit0(byte15) (range 1-4), then is
 *     shifted left by 1 bit (byte-serial, MSB first) and XORed with one of
 *     two 16-byte feedback masks (selected by the old byte0's top bit) -
 *     a Galois-form realization of a single-tap linear feedback function.
 *   - LFSRd: a 128-bit shift register, clocked irregularly 1-4 times (by
 *     LFSRc's k) per output bit using the same shift+mask mechanism (its
 *     own 16-byte mask pair). Before each round of clocking, 12 taps are
 *     read from LFSRd and used to index a 4096-entry packed-bit nonlinear
 *     Boolean function table, producing the actual keystream bit.
 *   - Setup: LFSRc <- key (16 bytes); LFSRd <- key doubled (the key, as a
 *     128-bit big-endian number, shifted left by 1); both registers are
 *     then XORed with the 16-byte IV. The (key,iv)-derived state is run
 *     through the generator itself for two 255-bit "compression" rounds:
 *     each round produces 32 bytes of output, whose first half becomes the
 *     new LFSRc and second half the new LFSRd (self-referential key
 *     expansion, familiar from stream ciphers such as RC4-drop/Sosemanuk).
 *     Finally LFSRd's last bit is cleared to avoid one degenerate state.
 * Differs from the published LILI-128 design in that it takes an explicit
 * 128-bit IV in addition to the key, and both registers plus their
 * feedback masks and function table are enlarged accordingly.
 * As implemented in the DarkCrypt Total Commander plugin. The two
 * feedback-mask tables and the 512-byte (4096-bit) nonlinear function
 * table are embedded verbatim below.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // LFSRc feedback masks: 2 rows of 16 bytes, selected by the outgoing top
  // bit of byte0 before each shift.
  /** @type {uint8[]} */
  const TABLE_C = [
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x7c, 0xa8, 0x97, 0xc1, 0x44, 0x87, 0xa7, 0xce, 0x37, 0xbe, 0x99, 0x98, 0x62, 0x87, 0xcb, 0xc3
  ];

  // LFSRd feedback masks: 2 rows of 16 bytes, same scheme as TABLE_C but for
  // the D register.
  /** @type {uint8[]} */
  const TABLE_D = [
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x06, 0x08, 0x19, 0x46, 0xa5, 0x34, 0x3a, 0x66, 0x96, 0xaa, 0xd3, 0x70, 0xf5, 0xf8, 0x8b, 0xbe
  ];

  // fd: 4096-entry nonlinear Boolean function table (12-bit LFSRd tap
  // selection -> 1 output bit), packed as 128 little-endian 32-bit words
  // (bit (31 - (index & 31)) of word (index >> 5)).
  /** @type {uint8[]} */
  const FD_TABLE_BYTES = [
    0xa5, 0x69, 0x5a, 0x96, 0x5a, 0x96, 0xa5, 0x69, 0x5a, 0x96, 0xa5, 0x69, 0x5a, 0x96, 0xa5, 0x69,
    0x55, 0x99, 0xaa, 0x66, 0xaa, 0x66, 0x55, 0x99, 0xaa, 0x66, 0x55, 0x99, 0xaa, 0x66, 0x55, 0x99,
    0x0f, 0xc3, 0xf0, 0x3c, 0xf0, 0x3c, 0x0f, 0xc3, 0xf1, 0x3e, 0x0d, 0xc2, 0xf1, 0x3e, 0x0d, 0xc2,
    0xff, 0x33, 0x00, 0xcc, 0x00, 0xcc, 0xff, 0x33, 0x02, 0xcd, 0xfe, 0x31, 0x02, 0xcd, 0xfe, 0x31,
    0x5a, 0x96, 0xa5, 0x69, 0xa5, 0x69, 0x5a, 0x96, 0x5a, 0x96, 0xa5, 0x69, 0x5a, 0x96, 0xa5, 0x69,
    0xaa, 0x66, 0x55, 0x99, 0x55, 0x99, 0xaa, 0x66, 0xaa, 0x66, 0x55, 0x99, 0xaa, 0x66, 0x55, 0x99,
    0xf0, 0x3c, 0x0f, 0xc3, 0x0f, 0xc3, 0xf0, 0x3c, 0xf2, 0x3d, 0x0e, 0xc1, 0xf2, 0x3d, 0x0e, 0xc1,
    0x00, 0xcc, 0xff, 0x33, 0xff, 0x33, 0x00, 0xcc, 0x01, 0xce, 0xfd, 0x32, 0x01, 0xce, 0xfd, 0x32,
    0xa5, 0x69, 0xa5, 0x69, 0x5a, 0x96, 0x5a, 0x96, 0x71, 0x4f, 0x72, 0x4e, 0x73, 0x4f, 0x71, 0x4c,
    0x55, 0x99, 0x55, 0x99, 0xaa, 0x66, 0xaa, 0x66, 0x81, 0xbc, 0x83, 0xbe, 0x42, 0xbd, 0x80, 0xbc,
    0x0f, 0xc3, 0x0f, 0xc3, 0xf0, 0x3c, 0xf0, 0x3c, 0xee, 0xdd, 0xe1, 0xda, 0xe2, 0xd7, 0xe7, 0xda,
    0xff, 0x33, 0xff, 0x33, 0x00, 0xcc, 0x00, 0xcc, 0x27, 0x1b, 0x22, 0x16, 0x20, 0x1a, 0x2c, 0x1e,
    0x5a, 0x96, 0x5a, 0x96, 0xa5, 0x69, 0xa5, 0x69, 0x8c, 0xb2, 0x8f, 0xb0, 0x8d, 0xb3, 0x8c, 0xb3,
    0xaa, 0x66, 0xaa, 0x66, 0x55, 0x99, 0x55, 0x99, 0x7d, 0x42, 0x7f, 0x40, 0x7d, 0x42, 0x7c, 0x43,
    0xf0, 0x3c, 0xf0, 0x3c, 0x0f, 0xc3, 0x0f, 0xc3, 0x28, 0x13, 0x20, 0x1a, 0x2e, 0x10, 0x2f, 0x1f,
    0x00, 0xcc, 0x00, 0xcc, 0xff, 0x33, 0xff, 0x33, 0xe5, 0xd0, 0xed, 0xd9, 0xe8, 0xdb, 0xe5, 0xd8,
    0xa5, 0x69, 0x5a, 0x96, 0x5a, 0x96, 0xa5, 0x69, 0x78, 0x4b, 0x87, 0xb4, 0x78, 0x4b, 0x87, 0xb4,
    0x55, 0x99, 0xaa, 0x66, 0xaa, 0x66, 0x55, 0x99, 0x88, 0xbb, 0x77, 0x44, 0x88, 0xbb, 0x77, 0x44,
    0x0f, 0xc3, 0xf0, 0x3c, 0xf0, 0x3c, 0x0f, 0xc3, 0xe1, 0xd2, 0x1d, 0x2e, 0xe1, 0xd2, 0x1d, 0x2e,
    0xff, 0x33, 0x00, 0xcc, 0x00, 0xcc, 0xff, 0x33, 0x22, 0x11, 0xde, 0xed, 0x22, 0x11, 0xde, 0xed,
    0xa5, 0x69, 0x5a, 0x96, 0x5a, 0x96, 0xa5, 0x69, 0x87, 0xb4, 0x78, 0x4b, 0x87, 0xb4, 0x78, 0x4b,
    0x55, 0x99, 0xaa, 0x66, 0xaa, 0x66, 0x55, 0x99, 0x77, 0x44, 0x88, 0xbb, 0x77, 0x44, 0x88, 0xbb,
    0x0f, 0xc3, 0xf0, 0x3c, 0xf0, 0x3c, 0x0f, 0xc3, 0x1d, 0x2e, 0xe1, 0xd2, 0x1d, 0x2e, 0xe1, 0xd2,
    0xff, 0x33, 0x00, 0xcc, 0x00, 0xcc, 0xff, 0x33, 0xde, 0xed, 0x22, 0x11, 0xde, 0xed, 0x22, 0x11,
    0xa5, 0x69, 0xa5, 0x69, 0x5a, 0x96, 0x5a, 0x96, 0x78, 0x44, 0x71, 0x49, 0x7b, 0x4f, 0x7d, 0x49,
    0x55, 0x99, 0x55, 0x99, 0xaa, 0x66, 0xaa, 0x66, 0x82, 0xb7, 0x8e, 0xb2, 0x84, 0xb9, 0x86, 0xba,
    0x0d, 0xc2, 0x0e, 0xc1, 0xf1, 0x3e, 0xf2, 0x3d, 0xac, 0x68, 0xad, 0x66, 0xa3, 0x6c, 0xa7, 0x68,
    0xfe, 0x31, 0xfd, 0x32, 0x02, 0xcd, 0x01, 0xce, 0xad, 0x65, 0xa0, 0x67, 0xa7, 0x67, 0xa0, 0x60,
    0xa5, 0x69, 0xa5, 0x69, 0x5a, 0x96, 0x5a, 0x96, 0x74, 0x46, 0x79, 0x4f, 0x70, 0x40, 0x79, 0x4a,
    0x55, 0x99, 0x55, 0x99, 0xaa, 0x66, 0xaa, 0x66, 0x8f, 0xba, 0x8b, 0xb4, 0x8e, 0xb5, 0x83, 0xb5,
    0x0e, 0xc1, 0x0d, 0xc2, 0xf2, 0x3d, 0xf1, 0x3e, 0x53, 0x95, 0x52, 0x9e, 0x59, 0x98, 0x52, 0x99,
    0xfd, 0x32, 0xfe, 0x31, 0x01, 0xce, 0x02, 0xcd, 0x5e, 0x95, 0x56, 0x97, 0x5d, 0x91, 0x5f, 0x99
  ];

  if (FD_TABLE_BYTES.length !== 512) {
    throw new Error('LILI-2 fd table must have 512 bytes (4096 bits)');
  }

  // Pack into 128 little-endian 32-bit words for fast bit extraction.
  /** @type {uint32[]} */
  const FD_TABLE = [];
  for (let i = 0; i < 128; i++)
    FD_TABLE.push(OpCodes.Pack32LE(FD_TABLE_BYTES[i*4], FD_TABLE_BYTES[i*4+1], FD_TABLE_BYTES[i*4+2], FD_TABLE_BYTES[i*4+3]));

  /**
   * @param {uint32} index
   * @returns {uint32}
   */
  function fdBit(index) {
    const row = OpCodes.Shr32(index, 5);
    /** @type {int32} */
    const bitpos = 31 - OpCodes.And32(index, 0x1f);
    return OpCodes.And32(OpCodes.Shr32(FD_TABLE[row], bitpos), 1);
  }

  // Outgoing top bit of byte0 of a 128-bit MSB-first register (selects the
  // feedback mask row when the register is shifted left by 1 bit).
  /**
   * @param {uint8[]} bytes - 16-byte register
   * @returns {uint32} 0 or 1
   */
  function topBit(bytes) {
    return OpCodes.And32(OpCodes.Shr32(bytes[0], 7), 1);
  }

  // 128-bit (16-byte) MSB-first left shift by 1 bit; returns the shifted bytes.
  /**
   * @param {uint8[]} bytes - 16-byte register
   * @returns {uint8[]} shifted register
   */
  function shiftLeft1(bytes) {
    /** @type {uint8[]} */
    const out = new Array(16);
    for (let i = 0; i < 15; i++)
      out[i] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(bytes[i], 1), OpCodes.Shr32(bytes[i+1], 7)), 0xFF);
    out[15] = OpCodes.And32(OpCodes.Shl32(bytes[15], 1), 0xFF);
    return out;
  }

  class DarkCryptLili2Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "LILI-2 (DarkCrypt)";
      this.description = "Enlarged successor to LILI-128 used by the DarkCrypt Total Commander plugin: two 128-bit clock-controlled shift registers (LFSRc, LFSRd) with Galois-style table-driven feedback and a 4096-entry nonlinear Boolean function, seeded via a key+IV whitening step and two self-referential 255-bit compression rounds.";
      this.inventor = "Alexander Myasnikov (\"Zarya\" project, DarkCrypt plugin)";
      this.year = 2008;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit
      this.SupportedNonceSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit IV
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("LILI Keystream Generator (base LILI-128 design, SAC 2000 paper)", "https://www.researchgate.net/publication/2528091_LILI_Keystream_Generator")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed proprietary variant", "Non-public enlargement of LILI-128 with no independent cryptanalysis; not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv) then in-place XOR keystream).
      this.tests = [
        {
          text: "DarkCrypt Lili2 — keystream from incrementing key, zero IV/input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("1198a219a3f3ed729500b3a54187f40dbbc9da59ceb3216f2dfbfdb31b70b63463eba7448eed9b629b622cd545b9a458eb4f559e145be166fff1f640d7e706123a61be369b294af9dd489193b7b0eaf0eb7dd8deaa3efa309344810abc1db15457816e31b6ea37b1b2d437d994c52a14b172af605149529e6ec3a9c28782ac1c")
        },
        {
          text: "DarkCrypt Lili2 — incrementing key/plaintext, zero IV",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("1199a01aa7f6eb759d09b9ae4d8afa02abd8c84adaa6377835e2e7a8076da82b43ca8567aac8bd45b34b06fe69948a77db7e67ad206ed751c7c8cc7bebda382d")
        },
        {
          text: "DarkCrypt Lili2 — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("03203d5a7794b1ceeb0825425f7c99b6d3f00d2a4764819ebbd8f5122f4c6986a3c0ddfa1734516e8ba8c5e2ff1c3956"),
          key: OpCodes.Hex8ToBytes("0b30557a9fc4e90e33587da2c7ec1136"),
          iv: OpCodes.Hex8ToBytes("073c71a6db10457aafe4194e83b8ed22"),
          expected: OpCodes.Hex8ToBytes("60a4bc025c0938ea737f073a2f733852f4477ffd3f4f8d67984fafa637417bd90ee480ca40d2d0c40b378496e6a1d422")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptLili2Instance(this, isInverse);
    }
  }

  class DarkCryptLili2Instance extends IAlgorithmInstance {
    /**
     * @param {DarkCryptLili2Algorithm} algorithm
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
      /** @type {uint8[]} */
      this._iv = OpCodes.CreateArray(16, 0);
      /** @type {uint8[]|null} */
      this._c = null; // LFSRc: 16 bytes
      /** @type {uint8[]|null} */
      this._d = null; // LFSRd: 16 bytes
    }

    /**
     * @param {uint8[]|null} keyBytes
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 16)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. LILI-2 (DarkCrypt) requires exactly 16 bytes");
      this._key = [...keyBytes];
      this._initialize();
    }

    /**
     * @returns {uint8[]|null}
     */
    get key() { return this._key ? [...this._key] : null; }

    /**
     * @param {uint8[]|null} ivBytes
     */
    set iv(ivBytes) {
      this._iv = ivBytes ? [...ivBytes] : OpCodes.CreateArray(16, 0);
      if (this._iv.length !== 16)
        throw new Error("Invalid IV size: " + this._iv.length + " bytes. LILI-2 (DarkCrypt) requires exactly 16 bytes");
      if (this._key) this._initialize();
    }

    /**
     * @returns {uint8[]|null}
     */
    get iv() { return [...this._iv]; }

    /**
     * @param {uint8[]|null} n
     */
    set nonce(n) { this.iv = n; }
    /**
     * @returns {uint8[]|null}
     */
    get nonce() { return this.iv; }

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
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.Xor8(this.inputBuffer[i], this._generateKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    _initialize() {
      const k = this._key;
      const iv = this._iv;

      /** @type {uint8[]} */
      const c = new Array(16);
      /** @type {uint8[]} */
      const d = new Array(16);
      for (let i = 0; i < 15; i++) {
        c[i] = k[i];
        d[i] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(k[i], 1), OpCodes.Shr32(k[i+1], 7)), 0xFF);
      }
      c[15] = k[15];
      d[15] = OpCodes.And32(OpCodes.Shl32(k[15], 1), 0xFF);

      for (let i = 0; i < 16; i++) {
        c[i] = OpCodes.Xor8(c[i], iv[i]);
        d[i] = OpCodes.Xor8(d[i], iv[i]);
      }

      this._c = c;
      this._d = d;

      // Two self-referential 255-bit compression rounds.
      for (let round = 0; round < 2; round++) {
        /** @type {uint8[]} */
        const buf32 = this._generateBits(255);
        this._c = buf32.slice(0, 16);
        this._d = buf32.slice(16, 32);
      }

      this._d[15] = OpCodes.And32(this._d[15], 0xFE);
    }

    /**
     * @returns {int32}
     */
    _clockC() {
      const oldC = this._c;
      /** @type {int32} */
      const tapHigh = OpCodes.And32(OpCodes.Shr32(oldC[0], 6), 1);
      /** @type {int32} */
      const tapLow = OpCodes.And32(oldC[15], 1);
      /** @type {int32} */
      const k = 1 + tapHigh + 2 * tapLow;
      /** @type {int32} */
      const row = topBit(oldC);
      /** @type {uint8[]} */
      const out = shiftLeft1(oldC);
      /** @type {int32} */
      const base = row * 16;
      for (let i = 0; i < 16; i++) out[i] = OpCodes.Xor8(out[i], TABLE_C[base + i]);
      this._c = out;
      return k;
    }

    /**
     * @returns {uint32}
     */
    _dTapIndex() {
      const d = this._d;
      /** @type {uint32} */
      let idx = 0;
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(d[0xF], 1), 1), 11);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(d[0xF], 2), 1), 10);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(d[0xF], 4), 1), 9);
      idx |= OpCodes.Shl32(OpCodes.And32(d[0xE], 1), 8);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(d[0xE], 5), 1), 7);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(d[0xD], 5), 1), 6);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(d[0xC], 7), 1), 5);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(d[0xA], 5), 1), 4);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(d[7], 2), 1), 3);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(d[5], 1), 1), 2);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(d[3], 1), 1), 1);
      idx |= OpCodes.And32(OpCodes.Shr32(d[0], 3), 1);
      return idx;
    }

    _clockDOnce() {
      /** @type {int32} */
      const row = topBit(this._d);
      /** @type {uint8[]} */
      const out = shiftLeft1(this._d);
      /** @type {int32} */
      const base = row * 16;
      for (let i = 0; i < 16; i++) out[i] = OpCodes.Xor8(out[i], TABLE_D[base + i]);
      this._d = out;
    }

    /**
     * @returns {uint32}
     */
    _generateKeystreamBit() {
      /** @type {int32} */
      const k = this._clockC();
      /** @type {uint32} */
      const idx = this._dTapIndex();
      /** @type {uint32} */
      const bit = fdBit(idx);
      for (let i = 0; i < k; i++) this._clockDOnce();
      return bit;
    }

    // Generates nbits bits packed MSB-first into ceil(nbits/8) bytes,
    // matching the key-expansion helper exactly (including its
    // last-partial-byte MSB alignment; only used internally by _initialize
    // for the 255-bit compression rounds).
    /**
     * @param {int32} nbits
     * @returns {uint8[]}
     */
    _generateBits(nbits) {
      /** @type {int32} */
      const nbytes = Math.ceil(nbits / 8);
      /** @type {uint8[]} */
      const out = OpCodes.CreateArray(nbytes, 0);
      let bitPos = 0;
      for (let n = 0; n < nbits; n++) {
        const bytePos = OpCodes.Shr32(bitPos, 3);
        const bit = this._generateKeystreamBit();
        out[bytePos] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(out[bytePos], 1), bit), 0xFF);
        bitPos++;
      }
      const rem = nbits % 8;
      if (rem !== 0) {
        const lastByte = nbytes - 1;
        out[lastByte] = OpCodes.And32(OpCodes.Shl32(out[lastByte], 8 - rem), 0xFF);
      }
      return out;
    }

    /**
     * @returns {uint8}
     */
    _generateKeystreamByte() {
      /** @type {uint32} */
      let byte = 0;
      for (let i = 0; i < 8; i++)
        byte = OpCodes.Or32(OpCodes.And32(OpCodes.Shl32(byte, 1), 0xFF), this._generateKeystreamBit());
      return byte;
    }
  }

  const algorithmInstance = new DarkCryptLili2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptLili2Algorithm, DarkCryptLili2Instance };
}));
