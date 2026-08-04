/*
 * REDOC III (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * REDOC III as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). 80-bit block, 256-bit key.
 * Structure:
 *   - key setup builds a 2560-byte pseudorandom table using a classic
 *     linear-congruential generator (multiplier 0x41C64E6D, increment
 *     0x3039 — the historic Borland/Turbo C runtime rand()), reseeded
 *     once per key byte pair with a fixed odd-prime step size used to
 *     walk the table indices
 *   - the 2560-byte table is XOR-folded (cyclically, 16 bytes at a
 *     time) into a 16-byte subkey
 *   - only the FIRST 8 bytes of the 10-byte block are transformed; the
 *     LAST 2 bytes pass through unmodified
 *   - encryption applies two forward "masking" passes over the 8
 *     working bytes: pass 1 uses subkey bytes 0-7, pass 2 uses subkey
 *     bytes 8-15. In each pass, byte i (XORed with the matching subkey
 *     byte) selects an 8-byte row of the table which is XORed into
 *     every OTHER working byte (byte i itself is left untouched by its
 *     own selection step, but may be touched by other steps)
 *   - decryption undoes the two passes in reverse (pass 8-15 first,
 *     then pass 0-7), each processed with the byte index running 7
 *     downto 0
 * Test vectors verified against the DarkCrypt implementation. Educational only.
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

  const TABLE_SIZE = 2560;          // 0xA00
  const KEY_BYTES = 32;             // 256-bit key
  const TRANSFORMED_BYTES = 8;      // only the first 8 of 10 block bytes are transformed
  const LCG_MULT = 0x41C64E6D;
  const LCG_INC = 0x3039;
  // Fixed constant occupying bits 16-31 of the per-key-byte LCG reseed value.
  const SEED_GARBAGE = 0x04F70000;
  // Fixed step table used to walk table indices during key setup (1 followed by the first 34 odd primes).
  const STEP_TABLE = [1, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
                       73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149];

  class DarkCryptREDOC3Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "REDOC III (DarkCrypt)";
      this.description = "REDOC III variant from the DarkCrypt Total Commander plugin: an 80-bit block (only the first 8 bytes are transformed, the last 2 pass through unchanged), 256-bit key. Key-dependent 2560-byte pseudorandom table (classic LCG) folded into a 16-byte subkey; two masking passes select table rows that get XORed into the other working bytes.";
      this.inventor = "IBM Research (Michael Wood); DarkCrypt variant by Alexander Myasnikov";
      this.year = 1985;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(10, 10, 0)]; // fixed 80-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Applied Cryptography, 2nd ed. (REDOC III description)", "https://www.schneier.com/books/applied-cryptography/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard, unanalyzed variant", "Only the last 2 of 10 block bytes are unprotected pass-through. Not analyzed for cryptographic strength.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Redoc3 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("59384d4a4be0617b0000")
        },
        {
          text: "DarkCrypt Redoc3 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00010203040506070809"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("84c182949e2875270809")
        },
        {
          text: "DarkCrypt Redoc3 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("10111213141516171819"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("dba910c8db2fb2ae1819")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptREDOC3Instance(this, isInverse);
    }
  }

  class DarkCryptREDOC3Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 10;
      this.KeySize = 0;
      this._table = null;
      this._subkey = null;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; this._table = null; this._subkey = null; return; }
      if (keyBytes.length !== KEY_BYTES)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. REDOC III (DarkCrypt) requires exactly ${KEY_BYTES} bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._table = this._buildTable(this._key);
      this._subkey = this._foldSubkey(this._table);
    }

    get key() { return this._key ? [...this._key] : null; }

    // Classic LCG (Borland/Turbo C runtime rand()): seed = seed*0x41C64E6D + 0x3039; value = (seed>>16) & 0x7FFF
    _buildTable(key) {
      const table = new Uint8Array(TABLE_SIZE);
      for (let edi = 1; edi <= KEY_BYTES; edi++) {
        let b0, b1;
        if (edi === KEY_BYTES) {
          b0 = key[KEY_BYTES - 1];
          b1 = key[0];
        } else {
          b0 = key[edi - 1];
          b1 = key[edi];
        }
        let seed = OpCodes.ToUint32(b0 | OpCodes.Shl32(b1, 8) | SEED_GARBAGE);
        let pos = 0;
        const step = STEP_TABLE[edi];
        for (let i = 0; i < TABLE_SIZE; i++) {
          pos = (pos + step) % TABLE_SIZE;
          seed = OpCodes.ToUint32(Math.imul(seed, LCG_MULT) + LCG_INC);
          const rv = OpCodes.AndN(OpCodes.Shr32(seed, 16), 0x7FFF);
          const lo = OpCodes.AndN(rv, 0xFF);
          const hi = OpCodes.AndN(OpCodes.Shr32(rv, 8), 0xFF);
          table[pos] = lo;
          const pos2 = pos + 1;
          if (pos2 === TABLE_SIZE - 1) table[0] = hi;
          else if (pos2 < TABLE_SIZE) table[pos2] = hi;
        }
      }
      return table;
    }

    _foldSubkey(table) {
      const subkey = new Uint8Array(16);
      let pos = 0;
      for (let i = 0; i < TABLE_SIZE; i++) {
        subkey[pos] ^= table[i];
        pos = (pos + 1) % 16;
      }
      return subkey;
    }

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

    _encryptBlock(block) {
      const table = this._table, subkey = this._subkey;
      const data = block.slice(0, TRANSFORMED_BYTES);

      for (let si = 0; si < TRANSFORMED_BYTES; si++) {
        const idx = OpCodes.XorN(subkey[si], data[si]) * TRANSFORMED_BYTES;
        for (let di = 0; di < TRANSFORMED_BYTES; di++)
          if (di !== si) data[di] = OpCodes.XorN(data[di], table[idx + di]);
      }
      for (let si = 0; si < TRANSFORMED_BYTES; si++) {
        const idx = OpCodes.XorN(subkey[si + 8], data[si]) * TRANSFORMED_BYTES;
        for (let di = 0; di < TRANSFORMED_BYTES; di++)
          if (di !== si) data[di] = OpCodes.XorN(data[di], table[idx + di]);
      }

      return [...data, block[8], block[9]];
    }

    _decryptBlock(block) {
      const table = this._table, subkey = this._subkey;
      const data = block.slice(0, TRANSFORMED_BYTES);

      for (let si = TRANSFORMED_BYTES - 1; si >= 0; si--) {
        const idx = OpCodes.XorN(subkey[si + 8], data[si]) * TRANSFORMED_BYTES;
        for (let di = 0; di < TRANSFORMED_BYTES; di++)
          if (di !== si) data[di] = OpCodes.XorN(data[di], table[idx + di]);
      }
      for (let si = TRANSFORMED_BYTES - 1; si >= 0; si--) {
        const idx = OpCodes.XorN(subkey[si], data[si]) * TRANSFORMED_BYTES;
        for (let di = 0; di < TRANSFORMED_BYTES; di++)
          if (di !== si) data[di] = OpCodes.XorN(data[di], table[idx + di]);
      }

      return [...data, block[8], block[9]];
    }
  }

  const algorithmInstance = new DarkCryptREDOC3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptREDOC3Algorithm, DarkCryptREDOC3Instance };
}));
