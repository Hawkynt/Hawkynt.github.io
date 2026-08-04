/*
 * RC5-32/16/64 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Ron Rivest's RC5 as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project): word size w=32 bits (native RC5
 * block = 2w = 64 bits), 16 rounds, and a 64-byte (512-bit) key run through
 * RC5's standard key schedule (which naturally generalizes to arbitrary key
 * byte lengths). Both the key schedule and the round function are otherwise
 * textbook RC5 (magic constants P32/Q32, little-endian word loading).
 *
 * This plugin exposes a 128-bit (16-byte) block interface, but the underlying
 * cipher primitive is only 64-bit: encryption/decryption transform bytes 0-7
 * of the caller's buffer and leave bytes 8-15 completely untouched. This port
 * reproduces that exact pass-through behavior for both directions.
 *
 * As implemented in the DarkCrypt Total Commander plugin; test vectors
 * verified against the DarkCrypt implementation. 512-bit key, 128-bit
 * external block (64-bit real block + 64-bit pass-through). Educational only.
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

  const P32 = 0xB7E15163;
  const Q32 = 0x9E3779B9;
  const ROUNDS = 16;
  const WORD_BYTES = 4;

  class DarkCryptRC5Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "RC5-32/16/64 (DarkCrypt)";
      this.description = "RC5 variant from the DarkCrypt Total Commander plugin: word size w=32 (64-bit real block), 16 rounds, 512-bit (64-byte) key via the standard RC5 key schedule. The external interface is 128 bits; only the first 8 bytes are transformed, the last 8 pass through unchanged. As implemented in the DarkCrypt Total Commander plugin.";
      this.inventor = "Ronald Rivest; DarkCrypt variant by Alexander Myasnikov";
      this.year = 1994;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit external interface (64-bit real + 64-bit pass-through)

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("RC5 Original Paper", "https://people.csail.mit.edu/rivest/Rivest-rc5rev.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard block truncation", "Only the first 8 of 16 declared block bytes are actually transformed by the DLL; the remaining 8 bytes are passed through unchanged (unauthenticated, unencrypted). Unanalyzed variant, not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Rc5 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("3de87930a1e4b7040000000000000000")
        },
        {
          text: "DarkCrypt Rc5 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("dafb117ea07259b108090a0b0c0d0e0f")
        },
        {
          text: "DarkCrypt Rc5 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("0cf2a083bc6e73e218191a1b1c1d1e1f")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptRC5Instance(this, isInverse);
    }
  }

  class DarkCryptRC5Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.expandedKey = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.expandedKey = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. RC5-32/16/64 (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._keyExpansion();
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

    // Standard RC5 key expansion, naturally generalizes to arbitrary key byte lengths.
    _keyExpansion() {
      const u = WORD_BYTES;
      const c = Math.max(1, Math.ceil(this.KeySize / u));
      const tableSize = 2 * (ROUNDS + 1);
      const L = new Array(c).fill(0);

      for (let i = 0; i < this.KeySize; i++) {
        const keyByte = OpCodes.AndN(this._key[i], 0xFF);
        const shift = 8 * (i % u);
        const idx = Math.floor(i / u);
        L[idx] = OpCodes.ToUint32(L[idx] + OpCodes.Shl32(keyByte, shift));
      }

      this.expandedKey = new Array(tableSize);
      this.expandedKey[0] = P32;
      for (let i = 1; i < tableSize; i++)
        this.expandedKey[i] = OpCodes.ToUint32(this.expandedKey[i - 1] + Q32);

      let A = 0, B = 0, i = 0, j = 0;
      const iterations = 3 * Math.max(tableSize, c);

      for (let k = 0; k < iterations; k++) {
        this.expandedKey[i] = OpCodes.ToUint32(this.expandedKey[i] + A + B);
        A = this.expandedKey[i] = OpCodes.RotL32(this.expandedKey[i], 3);

        L[j] = OpCodes.ToUint32(L[j] + A + B);
        B = L[j] = OpCodes.RotL32(L[j], OpCodes.AndN(A + B, 31));

        i = (i + 1) % tableSize;
        j = (j + 1) % c;
      }

      OpCodes.ClearArray(L);
    }

    // Only bytes 0-7 are transformed by the real 64-bit RC5 cipher; bytes 8-15 pass through unchanged.
    _encryptBlock(block) {
      let A = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let B = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);

      A = OpCodes.ToUint32(A + this.expandedKey[0]);
      B = OpCodes.ToUint32(B + this.expandedKey[1]);

      for (let i = 1; i <= ROUNDS; i++) {
        A = OpCodes.XorN(A, B);
        A = OpCodes.RotL32(A, OpCodes.AndN(B, 31));
        A = OpCodes.ToUint32(A + this.expandedKey[2 * i]);

        B = OpCodes.XorN(B, A);
        B = OpCodes.RotL32(B, OpCodes.AndN(A, 31));
        B = OpCodes.ToUint32(B + this.expandedKey[2 * i + 1]);
      }

      return [...OpCodes.Unpack32LE(A), ...OpCodes.Unpack32LE(B), ...block.slice(8, 16)];
    }

    _decryptBlock(block) {
      let A = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let B = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);

      for (let i = ROUNDS; i >= 1; i--) {
        B = OpCodes.ToUint32(B - this.expandedKey[2 * i + 1]);
        B = OpCodes.RotR32(B, OpCodes.AndN(A, 31));
        B = OpCodes.XorN(B, A);

        A = OpCodes.ToUint32(A - this.expandedKey[2 * i]);
        A = OpCodes.RotR32(A, OpCodes.AndN(B, 31));
        A = OpCodes.XorN(A, B);
      }

      A = OpCodes.ToUint32(A - this.expandedKey[0]);
      B = OpCodes.ToUint32(B - this.expandedKey[1]);

      return [...OpCodes.Unpack32LE(A), ...OpCodes.Unpack32LE(B), ...block.slice(8, 16)];
    }
  }

  const algorithmInstance = new DarkCryptRC5Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptRC5Algorithm, DarkCryptRC5Instance };
}));
