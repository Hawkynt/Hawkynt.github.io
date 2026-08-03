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
  const MASK64 = OpCodes.ShiftLn(1n, 64) - 1n;
  const m64 = x => OpCodes.AndN(x, MASK64);
  const shl = (x, n) => m64(OpCodes.ShiftLn(x, n));
  const shr = (x, n) => OpCodes.ShiftRn(OpCodes.AndN(x, MASK64), n);          // logical right shift
  const rotr = (x, n) => m64(OpCodes.OrN(OpCodes.ShiftRn(x, n), OpCodes.ShiftLn(x, 64 - n)));
  const rotl = (x, n) => rotr(x, 64 - n);

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

  function be64(bytes, off) {
    let v = 0n;
    for (let i = 0; i < 8; ++i) v = OpCodes.OrN(OpCodes.ShiftLn(v, 8), BigInt(OpCodes.And32(bytes[off + i], 0xFF)));
    return v;
  }

  function le64(bytes, off) {
    let v = 0n;
    for (let i = 0; i < 8; ++i) v |= OpCodes.ShiftLn(BigInt(OpCodes.And32(bytes[off + i], 0xFF)), i * 8);
    return v;
  }

  function be64ToBytes(v, out, off) {
    for (let i = 7; i >= 0; --i) { out[off + i] = Number(OpCodes.AndN(v, 0xFFn)); v = OpCodes.ShiftRn(v, 8); }
  }

  // ---- Key expansion (Schroeppel "stir", original pre-Wagner-fix) -----------
  function expandKey(keyBytes) {
    const KX = new Array(286).fill(0n);

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

    const s = new Array(8);
    for (let i = 0; i < 8; ++i) s[i] = KX[248 + i];

    for (let j = 0; j < 3; ++j) {
      for (let i = 0; i < 256; ++i) {
        let t = OpCodes.XorN(KX[i], KX[OpCodes.And32(i + 83, 255)]);
        t = m64(t + KX[Number(OpCodes.AndN(s[0], 0xFFn))]);
        s[0] ^= t;
        s[1] = m64(s[1] + s[0]);
        s[3] ^= s[2];
        s[5] = m64(s[5] - s[4]);
        s[7] ^= s[6];
        s[3] = m64(s[3] + shr(s[0], 13));
        s[4] ^= shl(s[1], 11);
        s[5] ^= shl(s[3], Number(OpCodes.AndN(s[1], 31n)));
        s[6] = m64(s[6] + shr(s[2], 17));
        s[7] |= m64(s[3] + s[4]);
        s[2] = m64(s[2] - s[5]);
        s[0] = m64(s[0] - OpCodes.XorN(s[6], BigInt(i)));
        s[1] ^= m64(s[5] + PI19);
        s[2] = m64(s[2] + shr(s[7], j));
        s[2] ^= s[1];
        s[4] = m64(s[4] - s[3]);
        s[6] ^= s[5];
        s[0] = m64(s[0] + s[7]);
        KX[i] = m64(s[2] + s[6]);
      }
    }

    // Replicate the first 30 words into the overflow area so the encryption's
    // (s0 & 255) + 3*round + 1 index (up to 277) never wraps.
    for (let i = 0; i < 30; ++i) KX[256 + i] = KX[i];
    return KX;
  }

  // ---- HPC-Medium block transform (65-128 bit blocks, here fixed 128) -------
  const KKC = m64(PI19 + 128n); // p119 + blocksize

  function encryptBlock(KX, spice, block) {
    let s0 = be64(block, 0), s1 = be64(block, 8);
    s0 = m64(s0 + KX[128]); s1 = m64(s1 + KX[129]);

    for (let i = 0; i < ROUNDS; ++i) {
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
      s0 = m64(s0 + shl(s0, 22 + Number(OpCodes.AndN(s0, 31n))));
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
      kk &= OpCodes.AndN(~0xFFn, MASK64);
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
    const out = new Array(16);
    be64ToBytes(s0, out, 0);
    be64ToBytes(s1, out, 8);
    return out;
  }

  function decryptBlock(KX, spice, block) {
    let s0 = be64(block, 0), s1 = be64(block, 8);
    s0 = m64(s0 - KX[136]); s1 = m64(s1 - KX[137]);

    for (let i = ROUNDS - 1; i >= 0; --i) {
      let t, k, kk;
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
      let tt = Number(OpCodes.AndN(s0, 0xFFn));
      k = KX[tt];
      kk = OpCodes.XorN(KX[tt + 3 * i + 1], k);
      s0 ^= OpCodes.AndN(kk, OpCodes.AndN(~0xFFn, MASK64));
      s0 = m64(s0 + shl(kk, 12));
      s1 = m64(s1 - shr(kk, 5));
      kk = shl(KX[tt + 3 * i + 1], 8);
      s0 ^= kk;
      s1 ^= k;
      s0 = m64(s0 + spice[OpCodes.Xor32(i, 7)]);
      s0 ^= shr(s0, 23);
      s0 ^= shr(s0, 46);
      const sh = 22 + Number(OpCodes.AndN(s0, 31n));
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

    CreateInstance(isInverse = false) {
      return new DarkCryptHPCInstance(this, isInverse);
    }
  }

  class DarkCryptHPCInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._KX = null;
      this._spice = null;
      this.inputBuffer = [];
      this.BlockSize = BLOCK_BYTES;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._KX = null; this._spice = null; this.KeySize = 0; return; }
      if (keyBytes.length !== KEY_BYTES)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. HPC-256 (DarkCrypt) requires exactly ${KEY_BYTES} bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._KX = expandKey(this._key);
      this._spice = new Array(8);
      for (let i = 0; i < 8; ++i) this._spice[i] = le64(this._key, SPICE_OFFSET + i * 8);
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
