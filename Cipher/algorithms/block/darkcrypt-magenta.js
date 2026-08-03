/*
 * MAGENTA (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MAGENTA (Multifunctional Algorithm for General-purpose Encryption and Network
 * Telecommunication Applications) as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). This build always treats the
 * key as 256 bits (32 bytes), producing an 8-round unbalanced Feistel network on
 * the 128-bit block with the palindromic subkey schedule K1,K2,K3,K4,K4,K3,K2,K1
 * (Ki = 8-byte chunk i of the key). This matches the structure of the original
 * MAGENTA AES-candidate submission by Deutsche Telekom.
 *
 * Round function F(right[8], subkey[8]):
 *   state = right || subkey (16 bytes)
 *   repeat 3 times:
 *     tmp = state; apply the byte permutation-substitution P four times to tmp
 *     w = byteTranspose(tmp)
 *     if not the last iteration: state = orig XOR w
 *   return w[0..7]        (the final iteration's transpose is NOT XORed with orig)
 * where P pairs byte i with byte i+8 (i=0..7) via a(x,y) = S(x XOR S(y)),
 * S(x) = 2^x in GF(2^8) with reduction polynomial 0x165 (x^8+x^6+x^5+x^2+1),
 * and byteTranspose deinterleaves even/odd byte positions across the 4 dwords.
 *
 * Test vectors verified against the DarkCrypt implementation, including
 * encrypt/decrypt round-trip.
 * 128-bit blocks, 256-bit keys (fixed by this build). Educational only.
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

  // S-box: S(x) = 2^x in GF(2^8) with reduction polynomial 0x165, x=0..254; S(255)=0
  const SBOX = (function () {
    const table = new Array(256).fill(0);
    let cur = 1;
    for (let i = 0; i < 255; i++) {
      table[i] = OpCodes.AndN(cur, 0xFF);
      cur = OpCodes.Shl32(cur, 1);
      if (OpCodes.AndN(cur, 0x100))
        cur = OpCodes.XorN(cur, 0x165);
      cur = OpCodes.AndN(cur, 0x1FF);
    }
    return table;
  })();

  // a(x,y) = S(x XOR S(y))
  function a(x, y) {
    return SBOX[OpCodes.XorN(x, SBOX[y])];
  }

  // P: pairs byte i with byte i+8 (i=0..7), both directions
  function permuteP(x) {
    const y = new Array(16);
    for (let i = 0; i < 8; i++) {
      y[2 * i] = a(x[i], x[i + 8]);
      y[2 * i + 1] = a(x[i + 8], x[i]);
    }
    return y;
  }

  // Byte transpose: deinterleave even/odd byte lanes of the 4 dwords
  function byteTranspose(z) {
    return [
      z[0], z[2], z[4], z[6],
      z[8], z[10], z[12], z[14],
      z[1], z[3], z[5], z[7],
      z[9], z[11], z[13], z[15]
    ];
  }

  // MAGENTA round function: F(right[8], subkey[8]) -> 8 bytes
  function magentaF(right, subkey) {
    const orig = right.concat(subkey);
    let state = OpCodes.CopyArray(orig);
    let w = null;

    for (let round = 0; round < 3; round++) {
      let tmp = state;
      for (let k = 0; k < 4; k++)
        tmp = permuteP(tmp);
      w = byteTranspose(tmp);
      if (round < 2)
        state = OpCodes.XorArrays(orig, w);
    }

    return w.slice(0, 8);
  }

  class DarkCryptMagentaAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "MAGENTA (DarkCrypt)";
      this.description = "MAGENTA block cipher as implemented in the DarkCrypt Total Commander plugin: 8-round unbalanced Feistel network with palindromic subkey schedule K1-K2-K3-K4-K4-K3-K2-K1, always operating on a 256-bit key. 128-bit block.";
      this.inventor = "Michael Jacobson Jr., Klaus Huber (base MAGENTA); DarkCrypt build by Alexander Myasnikov";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.INSECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit (this build always uses 4 x 8-byte key chunks)
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("MAGENTA AES Submission", "https://csrc.nist.gov/archive/aes/round1/conf1/papers/jacobson.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Structural weakness", "MAGENTA has well-documented structural weaknesses (Biham et al.) allowing key-recovery attacks far faster than brute force; not recommended for any real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Magenta — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("f0f66c085c77ca9433c95e0300c71891")
        },
        {
          text: "DarkCrypt Magenta — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("11345de72c2e1159bd4b80712c7b6a65")
        },
        {
          text: "DarkCrypt Magenta — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("c476434c32b0768576a291359fe766cd")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptMagentaInstance(this, isInverse);
    }
  }

  class DarkCryptMagentaInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._subkeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._subkeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. MAGENTA (DarkCrypt) requires exactly 32 bytes`);

      this._key = OpCodes.CopyArray(keyBytes);
      this.KeySize = keyBytes.length;

      const k1 = keyBytes.slice(0, 8);
      const k2 = keyBytes.slice(8, 16);
      const k3 = keyBytes.slice(16, 24);
      const k4 = keyBytes.slice(24, 32);
      this._subkeys = [k1, k2, k3, k4, k4, k3, k2, k1];
    }

    get key() { return this._key ? OpCodes.CopyArray(this._key) : null; }

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
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    _encryptBlock(block) {
      let A = block.slice(0, 4), B = block.slice(4, 8), C = block.slice(8, 12), D = block.slice(12, 16);

      for (let i = 0; i < 8; i++) {
        if (OpCodes.AndN(i, 1) === 0) {
          const fOut = magentaF(C.concat(D), this._subkeys[i]);
          A = OpCodes.XorArrays(A, fOut.slice(0, 4));
          B = OpCodes.XorArrays(B, fOut.slice(4, 8));
        } else {
          const fOut = magentaF(A.concat(B), this._subkeys[i]);
          C = OpCodes.XorArrays(C, fOut.slice(0, 4));
          D = OpCodes.XorArrays(D, fOut.slice(4, 8));
        }
      }

      return A.concat(B, C, D);
    }

    _decryptBlock(block) {
      let A = block.slice(0, 4), B = block.slice(4, 8), C = block.slice(8, 12), D = block.slice(12, 16);

      for (let i = 0; i < 8; i++) {
        if (OpCodes.AndN(i, 1) === 0) {
          const fOut = magentaF(A.concat(B), this._subkeys[i]);
          C = OpCodes.XorArrays(C, fOut.slice(0, 4));
          D = OpCodes.XorArrays(D, fOut.slice(4, 8));
        } else {
          const fOut = magentaF(C.concat(D), this._subkeys[i]);
          A = OpCodes.XorArrays(A, fOut.slice(0, 4));
          B = OpCodes.XorArrays(B, fOut.slice(4, 8));
        }
      }

      return A.concat(B, C, D);
    }
  }

  const algorithmInstance = new DarkCryptMagentaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMagentaAlgorithm, DarkCryptMagentaInstance };
}));
