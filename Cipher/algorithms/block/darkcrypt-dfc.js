/*
 * DFC-128/256 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * DFC (Decorrelated Fast Cipher) as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). DFC is an 8-round Feistel cipher
 * submitted to the AES contest by Vaudenay, Granboulan, Levy-dit-Vehel, Nguyen,
 * Pornin and Dhem (ENS/CNRS/France Telecom). The DarkCrypt implementation uses the
 * original DFCv1 round-key schedule exactly (not the later DFCv2 revision).
 *
 * Round function: for round input (left, right) as 64-bit halves and 64-bit
 * round-key halves (a, b):
 *   left = left XOR CP(RF_mod(a, b, right))
 *   [left, right] = [right, left]
 * where RF_mod(a, b, x) = ((a * x + b) mod (2^64 + 13)) mod 2^64, and
 *   CP(y) = { hi: y.lo XOR RT[y.hi >>> 26], lo: y.hi XOR KC } + KD  (64-bit add)
 * RT (64 words), KC, KD, KA, KB are all derived from the fractional part of e
 * ("nothing up my sleeve" constants from the DFC specification).
 *
 * Key schedule (v1, 256-bit key -> eight 32-bit words pk[0..7], no padding needed
 * since the key already fills all 8 words):
 *   oap[0] = (pk[0], pk[7]); obp[0] = (pk[4], pk[3])
 *   eap[0] = (pk[1], pk[6]); ebp[0] = (pk[5], pk[2])
 *   oap[i] = oap[0] XOR KA[i-1]; obp[i] = obp[0] XOR KB[i-1]  (i = 1..3, same for eap/ebp)
 * Eight round keys are produced by four "sub-rounds" of the same RF/CP round
 * function per round (using oap/obp on even rounds, eap/ebp on odd rounds),
 * seeded from an all-zero 64-bit pair; decryption simply reverses the round-key
 * order and reuses the same (forward) Feistel transform.
 *
 * The DarkCrypt implementation matches the standard DFCv1 construction exactly
 * (validated against DarkCrypt vectors: no DarkCrypt-specific deviation found).
 * 128-bit blocks, 256-bit keys. Educational only.
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

  const ROUNDS = 8;
  const SUBKEY_ROUNDS = 4;

  // "Nothing up my sleeve" constants: fractional part of Euler's number e,
  // as 32-bit big-endian words (from the DFC AES submission specification).
  const E_FRACTION = [
    0xb7e15162, 0x8aed2a6a, 0xbf715880, 0x9cf4f3c7,
    0x62e7160f, 0x38b4da56, 0xa784d904, 0x5190cfef,
    0x324e7738, 0x926cfbe5, 0xf4bf8d8d, 0x8c31d763,
    0xda06c80a, 0xbb1185eb, 0x4f7c7b57, 0x57f59584,
    0x90cfd47d, 0x7c19bb42, 0x158d9554, 0xf7b46bce,
    0xd55c4d79, 0xfd5f24d6, 0x613c31c3, 0x839a2ddf,
    0x8a9a276b, 0xcfbfa1c8, 0x77c56284, 0xdab79cd4,
    0xc2b3293d, 0x20e9e5ea, 0xf02ac60a, 0xcc93ed87,
    0x4422a52e, 0xcb238fee, 0xe5ab6add, 0x835fd1a0,
    0x753d0a8f, 0x78e537d2, 0xb95bb79d, 0x8dcaec64,
    0x2c1e9f23, 0xb829b5c2, 0x780bf387, 0x37df8bb3,
    0x00d01334, 0xa0d0bd86, 0x45cbfa73, 0xa6160ffe,
    0x393c48cb, 0xbbca060f, 0x0ff8ec6d, 0x31beb5cc,
    0xeed7f2f0, 0xbb088017, 0x163bc60d, 0xf45a0ecb,
    0x1bcd289b, 0x06cbbfea, 0x21ad08e1, 0x847f3f73,
    0x78d56ced, 0x94640d6e, 0xf0d3d37b, 0xe67008e1,
    0x86d1bf27, 0x5b9b241d, 0xeb64749a, 0x47dfdfb9,
    0x6632c3eb, 0x061b6472, 0xbbf84c26, 0x144e49c2
  ].map(x => OpCodes.ToUint32(x));

  const RT = E_FRACTION.slice(0, 64);           // confusion table (64 entries)
  const KD = { hi: E_FRACTION[64], lo: E_FRACTION[65] };
  const KC = E_FRACTION[66];
  const KA = [
    { hi: E_FRACTION[0], lo: E_FRACTION[1] },
    { hi: E_FRACTION[2], lo: E_FRACTION[3] },
    { hi: E_FRACTION[4], lo: E_FRACTION[5] }
  ];
  const KB = [
    { hi: E_FRACTION[6], lo: E_FRACTION[7] },
    { hi: E_FRACTION[8], lo: E_FRACTION[9] },
    { hi: E_FRACTION[10], lo: E_FRACTION[11] }
  ];

  const PRIME = OpCodes.ShiftLn(1n, 64) + 13n;
  const MASK32 = 0xffffffffn;
  const MASK64 = OpCodes.ShiftLn(1n, 64) - 1n;

  function to64(v) { return OpCodes.ShiftLn(BigInt(OpCodes.ToUint32(v.hi)), 32) | BigInt(OpCodes.ToUint32(v.lo)); }
  function from64(b) {
    b &= MASK64;
    return { hi: OpCodes.ToUint32(Number(OpCodes.AndN(OpCodes.ShiftRn(b, 32), MASK32))), lo: OpCodes.ToUint32(Number(OpCodes.AndN(b, MASK32))) };
  }

  function xor64(x, y) { return { hi: OpCodes.Xor32(x.hi, y.hi), lo: OpCodes.Xor32(x.lo, y.lo) }; }

  function add64(x, y) {
    return from64(OpCodes.AndN(to64(x) + to64(y), MASK64));
  }

  // Confusion permutation: mixes the low 64 bits of the modular product/sum
  // through a table lookup indexed by the top 6 bits, then adds a constant.
  function CP(y) {
    const yl = y.hi, yr = y.lo;
    const x = {
      hi: OpCodes.Xor32(yr, RT[OpCodes.Shr32(yl, 26)]),
      lo: OpCodes.Xor32(yl, KC)
    };
    return add64(x, KD);
  }

  // Round function: (a*x + b) mod (2^64+13), reduced mod 2^64, then confused.
  function RF(a, b, x) {
    const rf = (to64(a) * to64(x) + to64(b)) % PRIME;
    return CP(from64(OpCodes.AndN(rf, MASK64)));
  }

  class DarkCryptDFCAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "DFC-128/256 (DarkCrypt)";
      this.description = "Decorrelated Fast Cipher (DFCv1): 8-round Feistel network with a round function based on 64-bit modular multiply-add mod 2^64+13 followed by a table-based confusion permutation. 128-bit block, 256-bit key. As implemented in the DarkCrypt Total Commander plugin, matching the standard DFCv1 AES-submission construction exactly.";
      this.inventor = "Serge Vaudenay, Loïc Granboulan, Fabrice Levy-dit-Vehel, Phong Nguyen, Thomas Pornin, Jacques Stern (ENS/CNRS/France Télécom); DarkCrypt packaging by Alexander Myasnikov";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("DFC (Decorrelated Fast Cipher) (Wikipedia)", "https://en.wikipedia.org/wiki/DFC_(cipher)"),
        new LinkItem("On the Decorrelated Fast Cipher (DFC) and Its Theory (Knudsen, Rijmen)", "https://link.springer.com/chapter/10.1007/3-540-48519-8_7")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Weak keys / reduction concerns", "Coppersmith identified weak-key issues in the original key schedule (addressed by the later DFCv2 revision); not selected as an AES finalist.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Dfc — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0205d7133ed37cee091c36f24a74592a")
        },
        {
          text: "DarkCrypt Dfc — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("e2dcada042d08fa0426707e23d34c08d")
        },
        {
          text: "DarkCrypt Dfc — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("8b3a1c45c001590bd00477f664e98c44")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptDFCInstance(this, isInverse);
    }
  }

  class DarkCryptDFCInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._subKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._subKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. DFC-128/256 (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._subKeys = this._generateSubKeys(this._key);
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
      const subKeys = this.isInverse ? this._subKeys.slice().reverse() : this._subKeys;
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...this._transformBlock(block, subKeys));
      }
      this.inputBuffer = [];
      return output;
    }

    _bytesToWord64(bytes, off) {
      return {
        hi: OpCodes.ToUint32(OpCodes.Pack32BE(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3])),
        lo: OpCodes.ToUint32(OpCodes.Pack32BE(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]))
      };
    }

    _word64ToBytes(w) {
      return [...OpCodes.Unpack32BE(w.hi), ...OpCodes.Unpack32BE(w.lo)];
    }

    // Forward Feistel transform. Decryption reuses the same transform with a
    // reversed round-key order (standard Feistel network property).
    _transformBlock(block, subKeys) {
      let left = this._bytesToWord64(block, 0);
      let right = this._bytesToWord64(block, 8);

      for (let i = 0; i < ROUNDS; i++) {
        const [a, b] = subKeys[i];
        left = xor64(RF(a, b, right), left);
        [left, right] = [right, left];
      }

      return [...this._word64ToBytes(right), ...this._word64ToBytes(left)];
    }

    _generateSubKeys(keyBytes) {
      const pk = [];
      for (let i = 0; i < 8; i++)
        pk.push(OpCodes.ToUint32(OpCodes.Pack32BE(keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3])));

      const oap = new Array(SUBKEY_ROUNDS), obp = new Array(SUBKEY_ROUNDS);
      const eap = new Array(SUBKEY_ROUNDS), ebp = new Array(SUBKEY_ROUNDS);

      oap[0] = { hi: pk[0], lo: pk[7] };
      obp[0] = { hi: pk[4], lo: pk[3] };
      eap[0] = { hi: pk[1], lo: pk[6] };
      ebp[0] = { hi: pk[5], lo: pk[2] };

      for (let i = 1; i < SUBKEY_ROUNDS; i++) {
        oap[i] = xor64(oap[0], KA[i - 1]);
        obp[i] = xor64(obp[0], KB[i - 1]);
        eap[i] = xor64(eap[0], KA[i - 1]);
        ebp[i] = xor64(ebp[0], KB[i - 1]);
      }

      const keys = new Array(ROUNDS);
      let left = { hi: 0, lo: 0 }, right = { hi: 0, lo: 0 };
      for (let r = 0; r < ROUNDS; r++) {
        for (let s = 0; s < SUBKEY_ROUNDS; s++) {
          const a = OpCodes.And32(r, 1) === 0 ? oap[s] : eap[s];
          const b = OpCodes.And32(r, 1) === 0 ? obp[s] : ebp[s];
          left = xor64(RF(a, b, right), left);
          [left, right] = [right, left];
        }
        [left, right] = [right, left];
        keys[r] = [left, right];
      }
      return keys;
    }
  }

  const algorithmInstance = new DarkCryptDFCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptDFCAlgorithm, DarkCryptDFCInstance };
}));
