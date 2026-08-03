/*
 * RC2 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * RC2 as implemented in the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project). This variant uses a fixed 128-byte (1024-bit)
 * key that is copied verbatim
 * (no PITABLE-based key-expansion pass at all) into the 64-word subkey table,
 * and a MIX round whose register wiring is shifted by one position relative
 * to the textbook RFC 2268 mix (R0 combines with R2/R3 instead of R1/R2,
 * etc.); the MASH step, the 5-mix/mash/6-mix/mash/5-mix schedule and the
 * rotation amounts (1,2,3,5) match RFC 2268 exactly. Key setup is a plain
 * 128-byte copy into the subkey table, with no PITABLE involvement whatsoever.
 * 1024-bit key (128 bytes), 64-bit block. Educational only.
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

  function rotl16(x, n) {
    x = OpCodes.ToUint16(x);
    return OpCodes.ToUint16(OpCodes.Shl16(x, n) | OpCodes.Shr16(x, 16 - n));
  }
  function rotr16(x, n) {
    x = OpCodes.ToUint16(x);
    return OpCodes.ToUint16(OpCodes.Shr16(x, n) | OpCodes.Shl16(x, 16 - n));
  }

  // Build the 64-word subkey table directly from the raw 128-byte key (no
  // PITABLE key schedule: key setup is a plain copy).
  function buildSubkeys(keyBytes) {
    const K = new Array(64);
    for (let i = 0; i < 64; i++)
      K[i] = OpCodes.Pack16LE(keyBytes[i * 2], keyBytes[i * 2 + 1]);
    return K;
  }

  function mix(R, K, j) {
    R[0] = rotl16(OpCodes.ToUint16(R[0] + K[j] + OpCodes.And32(R[2], R[3]) + OpCodes.And32(~R[3], R[1])), 1);
    R[1] = rotl16(OpCodes.ToUint16(R[1] + K[j+1] + OpCodes.And32(R[0], R[3]) + OpCodes.And32(~R[0], R[2])), 2);
    R[2] = rotl16(OpCodes.ToUint16(R[2] + K[j+2] + OpCodes.And32(R[0], R[1]) + OpCodes.And32(~R[1], R[3])), 3);
    R[3] = rotl16(OpCodes.ToUint16(R[3] + K[j+3] + OpCodes.And32(R[1], R[2]) + OpCodes.And32(~R[2], R[0])), 5);
  }

  function unmix(R, K, j) {
    R[3] = OpCodes.ToUint16(rotr16(R[3], 5) - K[j+3] - OpCodes.And32(R[1], R[2]) - OpCodes.And32(~R[2], R[0]));
    R[2] = OpCodes.ToUint16(rotr16(R[2], 3) - K[j+2] - OpCodes.And32(R[0], R[1]) - OpCodes.And32(~R[1], R[3]));
    R[1] = OpCodes.ToUint16(rotr16(R[1], 2) - K[j+1] - OpCodes.And32(R[0], R[3]) - OpCodes.And32(~R[0], R[2]));
    R[0] = OpCodes.ToUint16(rotr16(R[0], 1) - K[j]   - OpCodes.And32(R[2], R[3]) - OpCodes.And32(~R[3], R[1]));
  }

  function mash(R, K) {
    R[0] = OpCodes.ToUint16(R[0] + K[OpCodes.And32(R[3], 63)]);
    R[1] = OpCodes.ToUint16(R[1] + K[OpCodes.And32(R[0], 63)]);
    R[2] = OpCodes.ToUint16(R[2] + K[OpCodes.And32(R[1], 63)]);
    R[3] = OpCodes.ToUint16(R[3] + K[OpCodes.And32(R[2], 63)]);
  }

  function unmash(R, K) {
    R[3] = OpCodes.ToUint16(R[3] - K[OpCodes.And32(R[2], 63)]);
    R[2] = OpCodes.ToUint16(R[2] - K[OpCodes.And32(R[1], 63)]);
    R[1] = OpCodes.ToUint16(R[1] - K[OpCodes.And32(R[0], 63)]);
    R[0] = OpCodes.ToUint16(R[0] - K[OpCodes.And32(R[3], 63)]);
  }

  class DarkCryptRC2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "RC2 (DarkCrypt)";
      this.description = "RC2 block cipher from the DarkCrypt Total Commander plugin, keyed with a fixed 1024-bit (128-byte) key copied verbatim into the subkey table (no PITABLE key-schedule pass) and a MIX round whose register wiring is shifted one position from RFC 2268's textbook layout.";
      this.inventor = "Ron Rivest (RSA Security); DarkCrypt variant by Alexander Myasnikov";
      this.year = 1987;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(128, 128, 0)]; // fixed 1024-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];    // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("RFC 2268 - A Description of the RC2(r) Encryption Algorithm", "https://www.rfc-editor.org/rfc/rfc2268.txt")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "Uses a raw 1024-bit key with no key schedule and a shifted mix wiring compared to RFC 2268; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation (raw primitive: key setup + single-block encryption).
      this.tests = [
        {
          text: "DarkCrypt Rc2 — incrementing key, zero plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f"),
          expected: OpCodes.Hex8ToBytes("60a9bd23ab51d808")
        },
        {
          text: "DarkCrypt Rc2 — incrementing key, incrementing plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f"),
          expected: OpCodes.Hex8ToBytes("a74666e1c9e7c5a7")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptRC2Instance(this, isInverse);
    }
  }

  class DarkCryptRC2Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._K = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._K = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 128)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. RC2 (DarkCrypt) requires exactly 128 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._K = buildSubkeys(keyBytes);
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
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    _encryptBlock(block) {
      const R = [
        OpCodes.Pack16LE(block[0], block[1]),
        OpCodes.Pack16LE(block[2], block[3]),
        OpCodes.Pack16LE(block[4], block[5]),
        OpCodes.Pack16LE(block[6], block[7])
      ];
      const K = this._K;
      let j = 0;
      for (let i = 0; i < 5; i++) { mix(R, K, j); j += 4; }
      mash(R, K);
      for (let i = 0; i < 6; i++) { mix(R, K, j); j += 4; }
      mash(R, K);
      for (let i = 0; i < 5; i++) { mix(R, K, j); j += 4; }

      return [
        ...OpCodes.Unpack16LE(R[0]), ...OpCodes.Unpack16LE(R[1]),
        ...OpCodes.Unpack16LE(R[2]), ...OpCodes.Unpack16LE(R[3])
      ];
    }

    _decryptBlock(block) {
      const R = [
        OpCodes.Pack16LE(block[0], block[1]),
        OpCodes.Pack16LE(block[2], block[3]),
        OpCodes.Pack16LE(block[4], block[5]),
        OpCodes.Pack16LE(block[6], block[7])
      ];
      const K = this._K;
      let j = 60;
      for (let i = 0; i < 5; i++) { unmix(R, K, j); j -= 4; }
      unmash(R, K);
      for (let i = 0; i < 6; i++) { unmix(R, K, j); j -= 4; }
      unmash(R, K);
      for (let i = 0; i < 5; i++) { unmix(R, K, j); j -= 4; }

      return [
        ...OpCodes.Unpack16LE(R[0]), ...OpCodes.Unpack16LE(R[1]),
        ...OpCodes.Unpack16LE(R[2]), ...OpCodes.Unpack16LE(R[3])
      ];
    }
  }

  const algorithmInstance = new DarkCryptRC2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptRC2Algorithm, DarkCryptRC2Instance };
}));
