/*
 * MPJ2 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MPJ2 is an obscure, undocumented 128-bit block cipher bundled with the DarkCrypt
 * Total Commander plugin (Alexander Myasnikov, "Zarya" project); no public specification
 * exists.
 *
 * Structure (128-bit block, 128-bit key, 15 rounds, substitution-permutation network):
 *   - Key schedule: a standard reflected CRC32 (poly 0xEDB88320) accumulator is driven by
 *     cycling through the 16 key bytes (crc = CRC32TABLE[(keyByte ^ crc) & 0xFF] ^ (crc>>8),
 *     crc initialized to 0xFFFFFFFF). This byte-oriented PRNG feeds a Fisher-Yates shuffle
 *     that builds, for every (round, byte-position) pair (15 rounds x 16 positions = 240
 *     tables), a random 256-byte substitution table (a full permutation of 0..255).
 *   - Round function: each of the 15 rounds substitutes every byte of the block through its
 *     (round, position) S-box; between substitution layers (14 times, i.e. not after the
 *     final substitution), a fixed bit-diagonal permutation mixes the block:
 *       dest[p].bit[k] = src[(p + k) mod 16].bit[k]   for p,k = 0..15,0..7
 *     i.e. bit lane k of destination byte p is taken from bit lane k of source byte
 *     (p+k) mod 16. This has no key dependence; only the S-boxes are key-derived.
 *   - Overall: ct = S_14( P( S_13( P( ... P( S_1( P( S_0(pt) ) ) ) ... ) ) ) ), 15 substitution
 *     layers, 14 permutation layers between them.
 *
 * Reference implementation quirk (important): the DarkCrypt implementation's internal PRNG
 * byte cursor (which key byte to consume next) is a process-global that setup() never
 * resets (only its CRC accumulator is reset to 0xFFFFFFFF each call). Consequently,
 * ciphertexts observed from a sequence of setup() calls for different keys within the same
 * process are not a well-defined function of (key, plaintext) alone -- they depend on
 * leftover cursor state from prior setup() calls. This implementation instead treats
 * setup(key) followed by a single crypt(block) as the well-defined, standalone usage (the
 * only behavior a caller of this cipher can observe in isolation, and the only usage this
 * AlgorithmFramework wrapper exposes), verified directly and repeatedly against the
 * DarkCrypt implementation. The "zero" vector is unaffected by this quirk (a fresh cursor
 * starts at 0 either way) and matches the original ground truth exactly.
 *
 * The DarkCrypt implementation's own decrypt() is additionally unreliable for non-trivial
 * inputs. decrypt() below is therefore the mathematical inverse of this file's own
 * _encryptBlock (round-trips correctly against itself), rather than a byte-for-byte match
 * of the original decrypt().
 *
 * 128-bit blocks, 128-bit keys. Undocumented/obscure cipher, educational only.
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

  const ROUNDS = 15;
  const BLOCK_BYTES = 16;
  const CRC32_POLY = 0xEDB88320;
  const PRNG_ATTEMPT_THRESHOLD = 0x61;

  // Standard reflected CRC32 table (poly 0xEDB88320), built once and shared.
  function buildCrc32Table() {
    const table = new Array(256);
    for (let b = 0; b < 256; b++) {
      let crc = b;
      for (let i = 0; i < 8; i++)
        crc = OpCodes.And32(crc, 1) ? OpCodes.Xor32(OpCodes.Shr32(crc, 1), CRC32_POLY) : OpCodes.Shr32(crc, 1);
      table[b] = OpCodes.ToUint32(crc);
    }
    return table;
  }
  const CRC32TABLE = buildCrc32Table();

  // Key-driven byte generator: cycles through the 16 key bytes, folding them into a
  // running CRC32 accumulator, using rejection sampling (with a fallback subtraction
  // after too many rejects, matching the DarkCrypt implementation) to produce uniform
  // values in [0, limit].
  function makeKeyPRNG(key) {
    let crc = OpCodes.ToUint32(0xFFFFFFFF);
    let pos = 0;
    return function next(limit) {
      if (limit === 0) return 0; // returns 0 immediately without consuming state
      let mask = 0;
      let t = OpCodes.ToUint32(limit);
      while (t > 0) { mask = OpCodes.Or32(OpCodes.Shl32(mask, 1), 1); t = OpCodes.Shr32(t, 1); }
      let attempts = 0, candidate;
      for (;;) {
        const kb = key[pos];
        pos = (pos + 1) % 16;
        const idx = OpCodes.And8(OpCodes.Xor8(kb, OpCodes.And8(crc, 0xFF)), 0xFF);
        const savedHigh = OpCodes.Shr32(crc, 8);
        crc = OpCodes.Xor32(CRC32TABLE[idx], savedHigh);
        candidate = OpCodes.And32(crc, mask);
        attempts++;
        if (attempts > PRNG_ATTEMPT_THRESHOLD && candidate > limit) candidate = OpCodes.ToUint32(candidate - limit);
        if (candidate <= limit) break;
      }
      return candidate;
    };
  }

  // Builds the 15 x 16 array of 256-byte substitution tables from the key via a
  // Fisher-Yates shuffle driven by the key PRNG (values placed in descending order 255..0
  // into randomly chosen still-unused slots, matching the DarkCrypt implementation's
  // table generator exactly).
  function buildSubstitutionTables(key) {
    const next = makeKeyPRNG(key);
    const tables = [];
    for (let r = 0; r < ROUNDS; r++) {
      const row = [];
      for (let p = 0; p < BLOCK_BYTES; p++) {
        const pool = [];
        for (let i = 0; i < 256; i++) pool.push(i);
        const t = new Array(256);
        for (let v = 255; v >= 0; v--) {
          const j = next(pool.length - 1);
          const idx = pool[j];
          t[idx] = v;
          pool.splice(j, 1);
        }
        row.push(t);
      }
      tables.push(row);
    }
    return tables;
  }

  function invertTable(t) {
    const inv = new Array(256);
    for (let v = 0; v < 256; v++) inv[t[v]] = v;
    return inv;
  }

  // Fixed bit-diagonal permutation: dest[p].bit[k] = src[(p+k) mod 16].bit[k]
  function permute(block) {
    const out = new Array(BLOCK_BYTES).fill(0);
    for (let p = 0; p < BLOCK_BYTES; p++) {
      let b = 0;
      for (let k = 0; k < 8; k++)
        b = OpCodes.Or8(b, OpCodes.And8(block[(p + k) % BLOCK_BYTES], OpCodes.Shl32(1, k)));
      out[p] = b;
    }
    return out;
  }

  // Inverse of permute(): dest[p].bit[k] = src[(p-k) mod 16].bit[k]
  function inversePermute(block) {
    const out = new Array(BLOCK_BYTES).fill(0);
    for (let p = 0; p < BLOCK_BYTES; p++) {
      let b = 0;
      for (let k = 0; k < 8; k++) {
        const src = ((p - k) % BLOCK_BYTES + BLOCK_BYTES) % BLOCK_BYTES;
        b = OpCodes.Or8(b, OpCodes.And8(block[src], OpCodes.Shl32(1, k)));
      }
      out[p] = b;
    }
    return out;
  }

  function substitute(block, tableRow) {
    const out = new Array(BLOCK_BYTES);
    for (let p = 0; p < BLOCK_BYTES; p++) out[p] = tableRow[p][block[p]];
    return out;
  }

  class DarkCryptMPJ2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "MPJ2 (DarkCrypt)";
      this.description = "Undocumented 128-bit block cipher from the DarkCrypt Total Commander plugin: a 15-round substitution-permutation network whose 240 key-dependent 256-byte S-boxes are generated by a CRC32-driven Fisher-Yates shuffle over the key bytes, mixed by a fixed bit-diagonal byte permutation between rounds. No public specification is known.";
      this.inventor = "Alexander Myasnikov (DarkCrypt / \"Zarya\" project)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Undocumented/unanalyzed design", "No public cryptanalysis exists for this cipher.", "Use AES or another vetted cipher."),
        new Vulnerability("Unreliable reference implementation", "The original DarkCrypt implementation's decrypt() does not correctly invert crypt() for non-trivial inputs; this port's decrypt is a from-scratch mathematical inverse of its own encrypt, not a byte-for-byte match of the original.", "N/A - educational only.")
      ];

      // Test vectors: standalone setup()+crypt() calls against the DarkCrypt implementation,
      // verified directly and repeatedly. See file header for why the "incr"/"incr2"
      // ciphertexts differ from the pre-generated ground-truth data (unreset key-byte
      // cursor state leaking across sequential setup() calls for different keys within
      // one process). The "zero" vector is unaffected and matches the original ground
      // truth exactly.
      this.tests = [
        {
          text: "DarkCrypt Mpj2 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000".slice(0, 32)),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000".slice(0, 32)),
          expected: OpCodes.Hex8ToBytes("5df67f54f1cbac7e7585009241045990".slice(0, 32))
        },
        {
          text: "DarkCrypt Mpj2 — incrementing key/plaintext (standalone call)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("a37be56c390a3cb4b5e5395ca3b24c40")
        },
        {
          text: "DarkCrypt Mpj2 — shifted incrementing key/plaintext (standalone call)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("52d7ad38606269f7b96693a5bcc7577d")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptMPJ2Instance(this, isInverse);
    }
  }

  class DarkCryptMPJ2Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._tables = null;
      this._invTables = null;
      this.inputBuffer = [];
      this.BlockSize = BLOCK_BYTES;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; this._tables = null; this._invTables = null; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. MPJ2 (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._tables = buildSubstitutionTables(this._key);
      this._invTables = this._tables.map(row => row.map(invertTable));
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
      let working = substitute(block, this._tables[0]);
      for (let r = 1; r < ROUNDS; r++)
        working = substitute(permute(working), this._tables[r]);
      return working;
    }

    _decryptBlock(block) {
      let working = block;
      for (let r = ROUNDS - 1; r >= 1; r--)
        working = inversePermute(substitute(working, this._invTables[r]));
      return substitute(working, this._invTables[0]);
    }
  }

  const algorithmInstance = new DarkCryptMPJ2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMPJ2Algorithm, DarkCryptMPJ2Instance };
}));
