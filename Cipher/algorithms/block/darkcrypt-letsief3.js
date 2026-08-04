/*
 * Letsief3 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Letsief3 block cipher as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). Test vectors were verified
 * against the DarkCrypt implementation, including encrypt/decrypt round-trip.
 *
 * Structure:
 *   - 64-bit block, 512-bit (64-byte) key, big-endian 32-bit words.
 *   - 6-round Feistel-like network operating on two 32-bit halves.
 *   - The core nonlinear primitive is modular multiplication over a 16-bit
 *     limb representation (multiply with reduction toward the 2^32-1
 *     modulus).
 *   - Each half is multiplied by two key-dependent 256-entry lookup tables
 *     (S1 at index (b1+b0)&0xFF, S2 at index (b3+b2)&0xFF of the partner half),
 *     then XORed with a round subkey; halves are whitened with subkeys 0/1
 *     (pre) and 14/15 (post).
 *   - Key schedule: a rolling sliding-window premix multiplies each 4-byte
 *     window of the key by the constant 0x2F8E6D85 (32 + 288 passes, wrapping
 *     mod 64), producing a 576-byte stream. Bytes 0..63 form 16 BE subkey
 *     words; bytes 64..575 seed the two S-boxes through a bit-decomposition
 *     product map over a fixed 16-entry generator table.
 *   - The all-zero key/plaintext maps to all-zero ciphertext because every
 *     operation preserves zero (multiplication and XOR only, no additive
 *     constants).
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

  const ROUNDS = 6;
  const KEY_MULT = 0x2F8E6D85;

  // Fixed 16-entry generator table driving the S-box map.
  const GEN = Object.freeze([
    0x2f8e6d85, 0x8d3c228d, 0xd6ad0dd8, 0x8ab56e61,
    0x23e99c57, 0xc4e1db7e, 0x17177161, 0x01b9ff46,
    0x7dbb8245, 0x32d8cd28, 0x82027dfe, 0x70009000,
    0x82007e00, 0x80087ff8, 0x7f808080, 0x00010000
  ]);

  // 16-bit-limb modular multiply used throughout the cipher.
  function mul(A, B) {
    A = OpCodes.ToUint32(A); B = OpCodes.ToUint32(B);
    const a0 = OpCodes.And32(A, 0xFFFF), a1 = OpCodes.And32(OpCodes.Shr32(A, 16), 0xFFFF);
    const b0 = OpCodes.And32(B, 0xFFFF), b1 = OpCodes.And32(OpCodes.Shr32(B, 16), 0xFFFF);
    let eax, ebx, ecx, edx, esi, rLo, rHi;
    ecx = a0;
    ebx = b0;
    edx = OpCodes.ToUint32(ecx * ebx);
    esi = a1;
    rHi = 0; rLo = 0;
    eax = OpCodes.ToUint32(esi * ebx);
    rLo = OpCodes.And32(edx, 0xFFFF);
    edx = OpCodes.Shr32(edx, 16);
    eax = eax + edx;
    edx = b1;
    ecx = OpCodes.ToUint32(ecx * edx);
    esi = OpCodes.ToUint32(esi * edx);
    rHi = OpCodes.And32(eax, 0xFFFF);
    ebx = eax;
    eax = OpCodes.And32(eax, 0xFFFF);
    ebx = OpCodes.Shr32(ebx, 16);
    eax = eax + ecx;
    edx = OpCodes.And32(ebx, 0xFFFF);
    rHi = OpCodes.And32(eax, 0xFFFF);
    edx = edx + esi;
    eax = OpCodes.Shr32(eax, 16);
    eax = eax + edx;
    edx = rLo;
    ecx = eax;
    eax = OpCodes.And32(eax, 0xFFFF);
    ebx = rHi;
    eax = eax + edx;
    ecx = OpCodes.Shr32(ecx, 16);
    rLo = OpCodes.And32(eax, 0xFFFF);
    edx = OpCodes.And32(ecx, 0xFFFF);
    eax = OpCodes.Shr32(eax, 16);
    edx = edx + ebx;
    eax = eax + edx;
    rHi = OpCodes.And32(eax, 0xFFFF);
    eax = OpCodes.Shr32(eax, 16);
    eax = OpCodes.ToUint32(eax + (OpCodes.Shl32(rHi, 16) + rLo));
    return OpCodes.ToUint32(eax);
  }

  // Map a 16-bit value to a pair of table entries.
  function expMap(V) {
    V &= 0xFFFF;
    let esi = V;
    if (OpCodes.And32(V, 0x7FFF) === 0) esi = OpCodes.And32(esi + 0xDAE, 0xFFFF);
    let p0 = 1, p1 = 1;
    for (let bit = 0; bit < 16; bit++) {
      if (OpCodes.And32(esi, 1) === 1) p0 = mul(p0, GEN[bit]);
      else p1 = mul(p1, GEN[bit]);
      esi = OpCodes.Shr32(OpCodes.And32(esi, 0xFFFF), 1);
    }
    p1 = mul(p1, GEN[0]);
    return [p0, p1];
  }

  const byteOf = (word, n) => OpCodes.And32(OpCodes.Shr32(word, 8 * n), 0xFF);

  class DarkCryptLetsief3Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Letsief3 (DarkCrypt)";
      this.description = "Letsief3 block cipher from the DarkCrypt Total Commander plugin. 6-round Feistel-like network over two 32-bit big-endian halves; the round function multiplies each half (modular multiply over 16-bit limbs) by two key-dependent 256-entry S-boxes and XORs a round subkey. 64-bit block, 512-bit key.";
      this.inventor = "Alexander Myasnikov (DarkCrypt / Zarya project)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];    // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard / unanalyzed variant", "Proprietary DarkCrypt cipher with no public cryptanalysis; the small round count and reliance on key-dependent multiplicative S-boxes are unvetted. Not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Letsief — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0000000000000000")
        },
        {
          text: "DarkCrypt Letsief — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("985e38bc074b9e16")
        },
        {
          text: "DarkCrypt Letsief — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("2140ee72033560a9")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptLetsief3Instance(this, isInverse);
    }
  }

  class DarkCryptLetsief3Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._schedule = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._schedule = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Letsief3 (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._schedule = this._buildSchedule(this._key);
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

    // Rolling sliding-window key premix producing subkeys and the two S-boxes.
    _buildSchedule(key) {
      const K = key.slice(0, 64);

      const transform = (p0, p1, p2, p3) => {
        const W = OpCodes.Pack32BE(K[p0], K[p1], K[p2], K[p3]);
        const R = mul(W, KEY_MULT);
        const bytes = OpCodes.Unpack32BE(R);
        K[p0] = bytes[0]; K[p1] = bytes[1]; K[p2] = bytes[2]; K[p3] = bytes[3];
      };

      // Pass 1: 32 in-place window transforms.
      for (let k = 0; k < 32; k++)
        transform(OpCodes.And32(2*k, 63), OpCodes.And32(2*k+1, 63), OpCodes.And32(2*k+2, 63), OpCodes.And32(2*k+3, 63));

      // Pass 2: 288 transforms, snapshotting two bytes per step into a 576-byte stream.
      const buf = new Array(576);
      for (let j = 0; j < 288; j++) {
        const i0 = OpCodes.And32(2*j, 63), i1 = OpCodes.And32(2*j+1, 63), i2 = OpCodes.And32(2*j+2, 63), i3 = OpCodes.And32(2*j+3, 63);
        transform(i0, i1, i2, i3);
        buf[2*j] = K[i0];
        buf[2*j+1] = K[i1];
      }

      const subkey = new Array(16);
      for (let w = 0; w < 16; w++)
        subkey[w] = OpCodes.Pack32BE(buf[4*w], buf[4*w+1], buf[4*w+2], buf[4*w+3]);

      const S1 = new Array(256), S2 = new Array(256);
      for (let t = 0; t < 128; t++) {
        const v1 = OpCodes.And32(OpCodes.Shl32(buf[0x40 + 2*t], 8) | buf[0x40 + 2*t + 1], 0xFFFF);
        const [a, b] = expMap(v1);
        S1[2*t] = a; S1[2*t+1] = b;
        const v2 = OpCodes.And32(OpCodes.Shl32(buf[0x140 + 2*t], 8) | buf[0x140 + 2*t + 1], 0xFFFF);
        const [c, d] = expMap(v2);
        S2[2*t] = c; S2[2*t+1] = d;
      }

      return { subkey, S1, S2 };
    }

    _encryptRound(v0, v1, r) {
      const { subkey, S1, S2 } = this._schedule;
      const i1 = OpCodes.And32(byteOf(v1, 1) + byteOf(v1, 0), 0xFF);
      let t = mul(v0, S1[i1]);
      const i2 = OpCodes.And32(byteOf(v1, 3) + byteOf(v1, 2), 0xFF);
      t = mul(t, S2[i2]);
      const nv0 = OpCodes.Xor32(t, subkey[2*r]);
      const i3 = OpCodes.And32(byteOf(nv0, 1) + byteOf(nv0, 0), 0xFF);
      let u = mul(v1, S1[i3]);
      const i4 = OpCodes.And32(byteOf(nv0, 3) + byteOf(nv0, 2), 0xFF);
      u = mul(u, S2[i4]);
      const nv1 = OpCodes.Xor32(u, subkey[2*r+1]);
      return [nv0, nv1];
    }

    _decryptRound(a, b, r) {
      const { subkey, S1, S2 } = this._schedule;
      let nb = OpCodes.Xor32(b, subkey[2*r+1]);
      const i1 = OpCodes.And32(OpCodes.Xor32(OpCodes.And32(byteOf(a, 0) + byteOf(a, 1), 0xFF), 1), 0xFF);
      nb = mul(nb, S1[i1]);
      const i2 = OpCodes.And32(OpCodes.Xor32(OpCodes.And32(byteOf(a, 2) + byteOf(a, 3), 0xFF), 1), 0xFF);
      nb = mul(nb, S2[i2]);
      let na = OpCodes.Xor32(a, subkey[2*r]);
      const i3 = OpCodes.And32(OpCodes.Xor32(OpCodes.And32(byteOf(nb, 0) + byteOf(nb, 1), 0xFF), 1), 0xFF);
      na = mul(na, S1[i3]);
      const i4 = OpCodes.And32(OpCodes.Xor32(OpCodes.And32(byteOf(nb, 2) + byteOf(nb, 3), 0xFF), 1), 0xFF);
      na = mul(na, S2[i4]);
      return [na, nb];
    }

    _encryptBlock(block) {
      const { subkey } = this._schedule;
      let v0 = OpCodes.Xor32(OpCodes.Pack32BE(block[0], block[1], block[2], block[3]), subkey[0]);
      let v1 = OpCodes.Xor32(OpCodes.Pack32BE(block[4], block[5], block[6], block[7]), subkey[1]);
      for (let r = 1; r <= ROUNDS; r++) {
        const nx = this._encryptRound(v0, v1, r);
        v0 = nx[0]; v1 = nx[1];
      }
      v0 = OpCodes.Xor32(v0, subkey[14]);
      v1 = OpCodes.Xor32(v1, subkey[15]);
      return [...OpCodes.Unpack32BE(v0), ...OpCodes.Unpack32BE(v1)];
    }

    _decryptBlock(block) {
      const { subkey } = this._schedule;
      let a = OpCodes.Xor32(OpCodes.Pack32BE(block[0], block[1], block[2], block[3]), subkey[14]);
      let b = OpCodes.Xor32(OpCodes.Pack32BE(block[4], block[5], block[6], block[7]), subkey[15]);
      for (let r = ROUNDS; r >= 1; r--) {
        const nx = this._decryptRound(a, b, r);
        a = nx[0]; b = nx[1];
      }
      a = OpCodes.Xor32(a, subkey[0]);
      b = OpCodes.Xor32(b, subkey[1]);
      return [...OpCodes.Unpack32BE(a), ...OpCodes.Unpack32BE(b)];
    }
  }

  const algorithmInstance = new DarkCryptLetsief3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptLetsief3Algorithm, DarkCryptLetsief3Instance };
}));
