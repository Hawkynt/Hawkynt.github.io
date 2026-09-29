/*
 * HPC-256 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Hasty Pudding Cipher (Rich Schroeppel, AES candidate) as implemented in the
 * DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project). DarkCrypt
 * advertises a 768-bit (96-byte) key and a 128-bit (16-byte) block, and internally
 * uses the "HPC-Medium" sub-cipher (which covers 65-128 bit blocks).
 *
 * It follows Rich Schroeppel's ORIGINAL 1998 specification (the pre-"Wagner fix"
 * key-stirring; i.e. the KX stir does NOT add KX[i] into s2 during each step), matching
 * B. Gladman's reference "hpc0.c". Deviations that make it its own variant:
 *   - The key-expansion length parameter is hardcoded to 256 bits: only the first 32
 *     bytes of the 96-byte key seed the KX table (read as four big-endian 64-bit words
 *     XORed into KX[0..3]); KX[1] is seeded with E19 * 256.
 *   - The remaining 64 key bytes (offsets 32..95) become the 8-word "spice" (tweak),
 *     read as little-endian 64-bit words. Textbook HPC leaves the spice zero.
 *   - Input/output 128-bit blocks are read/written big-endian (two 64-bit words).
 *   - The 3*round+1 key-schedule read index is NOT reduced mod 256 during encryption;
 *     it indexes the 30-word KX overflow area (KX[256..285]) the key setup replicates.
 *
 * Test vectors were verified against the DarkCrypt implementation for encrypt
 * match and decrypt round-trip.
 * 128-bit block, 768-bit key. Educational only.
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

  // ---- 64-bit BigInt helpers ------------------------------------------------
  /** @type {uint64} */
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;  // 2^64 - 1
  /** @type {uint64} */
  const MASK64_HIGH56 = 0xFFFFFFFFFFFFFF00n;  // ~0xFF within 64 bits
  /**
   * @param {uint64} x - Value
   * @returns {uint64} x mod 2^64
   */
  function m64(x) { return OpCodes.AndN(x, MASK64); }
  /**
   * @param {uint64} x - Value
   * @param {int32} n - Shift amount
   * @returns {uint64} (x << n) mod 2^64
   */
  function shl(x, n) { return m64(OpCodes.ShiftLn(x, n)); }
  /**
   * @param {uint64} x - Value
   * @param {int32} n - Shift amount
   * @returns {uint64} Logical right shift of the low 64 bits
   */
  function shr(x, n) { return OpCodes.ShiftRn(OpCodes.AndN(x, MASK64), n); }
  /**
   * @param {uint64} x - 64-bit value
   * @param {int32} n - Rotation (0..64)
   * @returns {uint64} x rotated right by n
   */
  function rotr(x, n) { return m64(OpCodes.OrN(OpCodes.ShiftRn(x, n), OpCodes.ShiftLn(x, 64 - n))); }
  /**
   * @param {uint64} x - 64-bit value
   * @param {int32} n - Rotation (0..64)
   * @returns {uint64} x rotated left by n
   */
  function rotl(x, n) { return rotr(x, 64 - n); }

  // HPC magic constants (truncated Pi, e and sqrt(2) fractions, 64-bit).
  const PI19 = 0x2B992DDFA23249D6n;
  const E19  = 0x25B946EBC0B36173n;
  const R220 = 0xC442F56BE9E17158n;

  const KEY_BYTES = 96;   // 768-bit key
  const BLOCK_BYTES = 16; // 128-bit block
  const ROUNDS = 8;
  const CIPHER_ID = 3;    // HPC-Medium
  const KEYLEN_PARAM = 256n; // DarkCrypt hardcodes the KX seed length to 256 bits
  const SPICE_OFFSET = 32;   // key bytes 32..95 form the 8-word spice

  /**
   * @param {uint8[]} bytes - Source bytes
   * @param {int32} off - Offset of the first byte
   * @returns {uint64} Big-endian 64-bit word
   */
  function be64(bytes, off) {
    /** @type {uint64} */
    let v = 0n;
    for (let i = 0; i < 8; ++i) v = OpCodes.OrN(OpCodes.ShiftLn(v, 8), BigInt(OpCodes.And32(bytes[off + i], 0xFF)));
    return v;
  }

  /**
   * @param {uint8[]} bytes - Source bytes
   * @param {int32} off - Offset of the first byte
   * @returns {uint64} Little-endian 64-bit word
   */
  function le64(bytes, off) {
    /** @type {uint64} */
    let v = 0n;
    for (let i = 0; i < 8; ++i) v |= OpCodes.ShiftLn(BigInt(OpCodes.And32(bytes[off + i], 0xFF)), i * 8);
    return v;
  }

  /**
   * @param {uint64} v - 64-bit word
   * @param {uint8[]} out - Destination bytes
   * @param {int32} off - Offset of the first byte
   */
  function be64ToBytes(v, out, off) {
    for (let i = 7; i >= 0; --i) {
      /** @type {uint8} */
      const b = Number(OpCodes.AndN(v, 0xFFn));
      out[off + i] = b;
      v = OpCodes.ShiftRn(v, 8);
    }
  }

  // ---- Key expansion (Schroeppel "stir", original pre-Wagner-fix) -----------
  /**
   * @param {uint8[]} keyBytes - Key bytes
   * @returns {uint64[]} The 286-word KX table
   */
  function expandKey(keyBytes) {
    /** @type {uint64[]} */
    const KX = new Array(286);
    for (let i = 0; i < 286; ++i) KX[i] = 0n;

    KX[0] = m64(PI19 + BigInt(CIPHER_ID));
    KX[1] = m64(E19 * KEYLEN_PARAM);
    KX[2] = rotl(R220, CIPHER_ID);
    for (let i = 3; i < 256; ++i)
      KX[i] = m64(OpCodes.XorN(rotr(KX[i - 3], 23), KX[i - 2]) + KX[i - 1]);

    // Seed with the first 256 key bits as four big-endian 64-bit words.
    KX[0] ^= be64(keyBytes, 0);
    KX[1] ^= be64(keyBytes, 8);
    KX[2] ^= be64(keyBytes, 16);
    KX[3] ^= be64(keyBytes, 24);

    /** @type {uint64[]} */
    const stir = new Array(8);
    for (let i = 0; i < 8; ++i) stir[i] = KX[248 + i];

    for (let j = 0; j < 3; ++j) {
      for (let i = 0; i < 256; ++i) {
        /** @type {uint64} */
        let t = OpCodes.XorN(KX[i], KX[OpCodes.And32(i + 83, 255)]);
        /** @type {int32} */
        const idx = Number(OpCodes.AndN(stir[0], 0xFFn));
        t = m64(t + KX[idx]);
        stir[0] ^= t;
        stir[1] = m64(stir[1] + stir[0]);
        stir[3] ^= stir[2];
        stir[5] = m64(stir[5] - stir[4]);
        stir[7] ^= stir[6];
        stir[3] = m64(stir[3] + shr(stir[0], 13));
        stir[4] ^= shl(stir[1], 11);
        /** @type {int32} */
        const sh = Number(OpCodes.AndN(stir[1], 31n));
        stir[5] ^= shl(stir[3], sh);
        stir[6] = m64(stir[6] + shr(stir[2], 17));
        stir[7] |= m64(stir[3] + stir[4]);
        stir[2] = m64(stir[2] - stir[5]);
        stir[0] = m64(stir[0] - OpCodes.XorN(stir[6], BigInt(i)));
        stir[1] ^= m64(stir[5] + PI19);
        stir[2] = m64(stir[2] + shr(stir[7], j));
        stir[2] ^= stir[1];
        stir[4] = m64(stir[4] - stir[3]);
        stir[6] ^= stir[5];
        stir[0] = m64(stir[0] + stir[7]);
        KX[i] = m64(stir[2] + stir[6]);
      }
    }

    // Replicate the first 30 words into the overflow area so the encryption's
    // (s0 & 255) + 3*round + 1 index (up to 277) never wraps.
    for (let i = 0; i < 30; ++i) KX[256 + i] = KX[i];
    return KX;
  }

  // ---- HPC-Medium block transform (65-128 bit blocks, here fixed 128) -------
  /** @type {uint64} */
  const KKC = m64(PI19 + 128n); // p119 + blocksize

  /**
   * @param {uint64[]} KX - Expanded key table
   * @param {uint64[]} spice - Eight spice words
   * @param {uint8[]} block - Input block
   * @returns {uint8[]} Output block
   */
  function encryptBlock(KX, spice, block) {
    let s0 = be64(block, 0), s1 = be64(block, 8);
    s0 = m64(s0 + KX[128]); s1 = m64(s1 + KX[129]);

    for (let i = 0; i < ROUNDS; ++i) {
      /** @type {int32} */
      let tt = Number(OpCodes.AndN(s0, 0xFFn));
      let k = KX[tt];
      s1 = m64(s1 + k);
      s0 ^= shl(k, 8);
      s1 ^= s0;
      s0 = m64(s0 - shr(s1, 11));
      s0 ^= shl(s1, 2);
      s0 = m64(s0 - spice[OpCodes.Xor32(i, 4)]);
      let t = OpCodes.XorN(shl(s0, 32), KKC);
      s0 = m64(s0 + t);
      s0 ^= shr(s0, 17);
      s0 ^= shr(s0, 34);
      t = spice[i];
      s0 ^= t;
      s0 = m64(s0 + shl(t, 5));
      t = shr(spice[i], 4);
      s1 = m64(s1 + t);
      s0 ^= t;
      /** @type {int32} */
      const low5 = Number(OpCodes.AndN(s0, 31n));
      const sh = 22 + low5;
      s0 = m64(s0 + shl(s0, sh));
      s0 ^= shr(s0, 23);
      s0 = m64(s0 - spice[OpCodes.Xor32(i, 7)]);
      tt = Number(OpCodes.AndN(s0, 0xFFn));
      k = KX[tt];
      let kk = KX[tt + 3 * i + 1];
      s1 ^= k;
      s0 ^= shl(kk, 8);
      kk ^= k;
      s1 = m64(s1 + shr(kk, 5));
      s0 = m64(s0 - shl(kk, 12));
      kk &= MASK64_HIGH56;
      s0 ^= kk;
      s1 = m64(s1 + s0);
      s0 = m64(s0 + shl(s1, 3));
      s0 ^= spice[OpCodes.Xor32(i, 2)];
      s0 = m64(s0 + KX[144 + i]);
      s0 = m64(s0 + shl(s0, 22));
      s0 ^= shr(s1, 4);
      s0 = m64(s0 + spice[OpCodes.Xor32(i, 1)]);
      s0 ^= shr(s0, 33 + i);
    }

    s0 = m64(s0 + KX[136]); s1 = m64(s1 + KX[137]);
    /** @type {uint8[]} */
    const out = new Array(16);
    be64ToBytes(s0, out, 0);
    be64ToBytes(s1, out, 8);
    return out;
  }

  /**
   * @param {uint64[]} KX - Expanded key table
   * @param {uint64[]} spice - Eight spice words
   * @param {uint8[]} block - Input block
   * @returns {uint8[]} Output block
   */
  function decryptBlock(KX, spice, block) {
    let s0 = be64(block, 0), s1 = be64(block, 8);
    s0 = m64(s0 - KX[136]); s1 = m64(s1 - KX[137]);

    for (let i = ROUNDS - 1; i >= 0; --i) {
      /** @type {uint64} */
      let t = 0n;
      /** @type {uint64} */
      let k = 0n;
      /** @type {uint64} */
      let kk = 0n;
      s0 ^= shr(s0, 33 + i);
      s0 = m64(s0 - spice[OpCodes.Xor32(i, 1)]);
      s0 ^= shr(s1, 4);
      k = shl(s0, 22);
      t = shl(m64(s0 - k), 22);
      s0 = m64(s0 - t);
      s0 = m64(s0 - KX[144 + i]);
      s0 ^= spice[OpCodes.Xor32(i, 2)];
      s0 = m64(s0 - shl(s1, 3));
      s1 = m64(s1 - s0);
      /** @type {int32} */
      let tt = Number(OpCodes.AndN(s0, 0xFFn));
      k = KX[tt];
      kk = OpCodes.XorN(KX[tt + 3 * i + 1], k);
      s0 ^= OpCodes.AndN(kk, MASK64_HIGH56);
      s0 = m64(s0 + shl(kk, 12));
      s1 = m64(s1 - shr(kk, 5));
      kk = shl(KX[tt + 3 * i + 1], 8);
      s0 ^= kk;
      s1 ^= k;
      s0 = m64(s0 + spice[OpCodes.Xor32(i, 7)]);
      s0 ^= shr(s0, 23);
      s0 ^= shr(s0, 46);
      /** @type {int32} */
      const low5 = Number(OpCodes.AndN(s0, 31n));
      const sh = 22 + low5;
      t = shl(s0, sh);
      kk = shl(m64(s0 - t), sh);
      s0 = m64(s0 - kk);
      t = spice[i];
      kk = shr(t, 4);
      s0 ^= kk;
      s1 = m64(s1 - kk);
      s0 = m64(s0 - shl(t, 5));
      s0 ^= t;
      s0 ^= shr(s0, 17);
      k = shl(m64(s0 - KKC), 32);
      t = OpCodes.XorN(KKC, k);
      s0 = m64(s0 - t);
      s0 = m64(s0 + spice[OpCodes.Xor32(i, 4)]);
      s0 ^= shl(s1, 2);
      s0 = m64(s0 + shr(s1, 11));
      s1 ^= s0;
      tt = Number(OpCodes.AndN(s0, 0xFFn));
      k = KX[tt];
      s0 ^= shl(k, 8);
      s1 = m64(s1 - k);
    }

    s0 = m64(s0 - KX[128]); s1 = m64(s1 - KX[129]);
    /** @type {uint8[]} */
    const out = new Array(16);
    be64ToBytes(s0, out, 0);
    be64ToBytes(s1, out, 8);
    return out;
  }

  class DarkCryptHPCAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "HPC-256 (DarkCrypt)";
      this.description = "Hasty Pudding Cipher (HPC-Medium sub-cipher) as shipped in the DarkCrypt Total Commander plugin. Uses Rich Schroeppel's original 1998 key-stirring (pre-Wagner-fix); the 96-byte key seeds a 256-bit KX expansion while its last 64 bytes act as an 8-word spice/tweak. 128-bit block, 768-bit key.";
      this.inventor = "Rich Schroeppel (base HPC); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(KEY_BYTES, KEY_BYTES, 0)];    // fixed 768-bit
      this.SupportedBlockSizes = [new KeySize(BLOCK_BYTES, BLOCK_BYTES, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Hasty Pudding Cipher (Rich Schroeppel, AES submission)", "https://richard.schroeppel.name:8015/hpc/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "Modified HPC using the original pre-Wagner-fix stirring and a fixed 256-bit key-seed length; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Hpc — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("e8d77b317b6ea04abfcb67a2ef4879cb")
        },
        {
          text: "DarkCrypt Hpc — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          expected: OpCodes.Hex8ToBytes("3d158e9dc45de315e1cef91efd369acc")
        },
        {
          text: "DarkCrypt Hpc — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f60"),
          expected: OpCodes.Hex8ToBytes("4d686475ede1aff9e60ef040fd5968f2")
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptHPCInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptHPCInstance(this, isInverse);
    }
  }

  class DarkCryptHPCInstance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptHPCAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint64[]|null} */
      this._KX = null;
      /** @type {uint64[]|null} */
      this._spice = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = BLOCK_BYTES;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._KX = null; this._spice = null; this.KeySize = 0; return; }
      if (keyBytes.length !== KEY_BYTES)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. HPC-256 (DarkCrypt) requires exactly " + KEY_BYTES + " bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._KX = expandKey(this._key);
      /** @type {uint64[]} */
      const spice = new Array(8);
      for (let i = 0; i < 8; ++i) spice[i] = le64(this._key, SPICE_OFFSET + i * 8);
      this._spice = spice;
    }

    /**
     * @returns {uint8[]|null} Copy of the key, or null
     */
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
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse
          ? decryptBlock(this._KX, this._spice, block)
          : encryptBlock(this._KX, this._spice, block)));
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptHPCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptHPCAlgorithm, DarkCryptHPCInstance };
}));
