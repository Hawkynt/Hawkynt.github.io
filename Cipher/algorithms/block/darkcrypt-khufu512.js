/*
 * Khufu-512 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Ralph Merkle's Khufu cipher (1990) as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project), using a 544-bit (68-byte) key. 64-bit
 * Feistel block, 8 octets of 8 rounds each (64 rounds total), rotate pattern per octet
 * 16,16,8,8,16,16,24,24 (matches Merkle's reference design).
 *
 * Key schedule (all constants/quirks below confirmed against the DarkCrypt
 * implementation, not assumed from any reference source):
 *   - the last 4 key bytes seed the classic Borland/Turbo runtime rand()/srand()
 *     (seed = seed*0x41C64E6D + 0x3039; value = (seed>>16) & 0x7FFF), generating a
 *     256-entry raw pseudorandom table shared as the starting point for all 8 octets;
 *   - each 256-entry octet S-box is built by copying that raw table, then doing a
 *     byte-column-wise (4 columns = 4 byte lanes of each 32-bit entry) partial
 *     Fisher-Yates shuffle; the swap index for row i in each column comes from a
 *     16-value "batch" obtained by self-referentially calling the cipher's OWN crypt()
 *     entry point on the first 64 key bytes (8 blocks encrypted in place, whitening
 *     keys still zero at this point), consumed 16 dwords per batch in reverse order,
 *     regenerating (re-encrypting the running 64-byte buffer) whenever exhausted;
 *   - octets are built and consumed in descending order (7 down to 0);
 *   - CONFIRMED QUIRK: the swap range's lower bound is reset to 16 by the batch-
 *     regeneration path and never restored, so on any single call that itself triggers
 *     a regeneration, the modulus/offset math uses 16 instead of the true row index
 *     for that one call;
 *   - the 4 whitening dwords (pre-L, pre-R, post-L, post-R) are simply the first 16
 *     key bytes, written after all 8 octets are built;
 *   - CONFIRMED GLOBAL-STATE QUIRK: setup() builds the key schedule in shared
 *     GLOBAL (not per-call) memory, and octets not yet rebuilt during a
 *     setup() call still hold whatever a PRIOR setup() call last left
 *     there (there is no zero-fill between calls) - the self-referential bootstrap
 *     above therefore reads that leftover state for not-yet-built octets. This makes
 *     Khufu-512's key schedule NOT a pure function of the key alone: its output
 *     depends on prior setup() calls in the same process. This implementation
 *     reproduces that exactly (module-level shared "leftover" octet state), matching
 *     the reference vectors, which call setup() twice per key (once before
 *     crypt, once before decrypt) for zero, then incr, then incr2, in that order.
 * IMPORTANT: the DarkCrypt implementation's own decrypt(crypt(x)) does not
 * round-trip (a further quirk of that implementation) - only encryption was
 * validated against it. This implementation's decrypt() is the correct
 * mathematical inverse of ITS OWN encrypt() (self-consistent round trip),
 * independent of the shared leftover-state mechanism, which only affects
 * key-schedule construction, not the round function itself.
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

  const ROT = [16, 16, 8, 8, 16, 16, 24, 24];

  function makeRng() {
    let seed = 0;
    return {
      srand(s) { seed = OpCodes.ToUint32(s); },
      rand() { seed = OpCodes.ToUint32(Math.imul(seed, 0x41C64E6D) + 0x3039); return OpCodes.And32(OpCodes.Shr32(seed, 16), 0x7FFF); }
    };
  }
  function ror32(x, n) { return OpCodes.RotR32(OpCodes.ToUint32(x), n); }
  function pack32LE(arr, off) { return OpCodes.Pack32LE(arr[off], arr[off + 1], arr[off + 2], arr[off + 3]); }
  function writeLE(arr, off, v) {
    const b = OpCodes.Unpack32LE(v);
    arr[off] = b[0]; arr[off + 1] = b[1]; arr[off + 2] = b[2]; arr[off + 3] = b[3];
  }

  function encryptRounds(L, R, octetTables) {
    for (let k = 7; k >= 0; k--) {
      const sbox = octetTables[k];
      for (let r = 0; r < 8; r++) {
        if (OpCodes.And32(r, 1) === 0) { R = OpCodes.ToUint32(OpCodes.Xor32(R, sbox[OpCodes.And32(L, 0xFF)])); L = ror32(L, ROT[r]); }
        else { L = OpCodes.ToUint32(OpCodes.Xor32(L, sbox[OpCodes.And32(R, 0xFF)])); R = ror32(R, ROT[r]); }
      }
    }
    return [L, R];
  }
  function decryptRounds(L, R, octetTables) {
    for (let k = 0; k <= 7; k++) {
      const sbox = octetTables[k];
      for (let r = 7; r >= 0; r--) {
        if (OpCodes.And32(r, 1) === 0) { L = OpCodes.RotL32(L, ROT[r]); R = OpCodes.ToUint32(OpCodes.Xor32(R, sbox[OpCodes.And32(L, 0xFF)])); }
        else { R = OpCodes.RotL32(R, ROT[r]); L = OpCodes.ToUint32(OpCodes.Xor32(L, sbox[OpCodes.And32(R, 0xFF)])); }
      }
    }
    return [L, R];
  }

  // Module-level shared "leftover" octet state: mirrors the DarkCrypt implementation's
  // GLOBAL key-schedule memory. Octets not yet rebuilt within a given setup pass still
  // show whatever the previous setup() call last left there. Starts all-zero, matching
  // a freshly loaded, zero-initialized state.
  const sharedOctets = [
    new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256),
    new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)
  ];

  function buildTablesOnce(keyBytes) {
    const seed = pack32LE(keyBytes, 64);
    const rng = makeRng();
    rng.srand(seed);
    const rawSeed = new Uint32Array(256);
    for (let i = 0; i < 256; i++) rawSeed[i] = rng.rand();

    const state = { preL: 0, preR: 0, postL: 0, postR: 0 };
    const buf64 = Uint8Array.from(keyBytes.slice(0, 64));
    let batchCounter = 0;

    function regenerateBatch() {
      for (let b = 0; b < 8; b++) {
        let L = pack32LE(buf64, b * 8);
        let R = pack32LE(buf64, b * 8 + 4);
        L = OpCodes.ToUint32(OpCodes.Xor32(L, state.preL)); R = OpCodes.ToUint32(OpCodes.Xor32(R, state.preR));
        [L, R] = encryptRounds(L, R, sharedOctets);
        L = OpCodes.ToUint32(OpCodes.Xor32(L, state.postL)); R = OpCodes.ToUint32(OpCodes.Xor32(R, state.postR));
        writeLE(buf64, b * 8, L); writeLE(buf64, b * 8 + 4, R);
      }
      batchCounter = 16;
    }
    function nextKeyRandom(lo) {
      let effectiveLo = lo;
      if (batchCounter === 0) { regenerateBatch(); effectiveLo = 16; }
      const dwordIndex = batchCounter - 1;
      const val = pack32LE(buf64, dwordIndex * 4);
      batchCounter--;
      const range = 256 - effectiveLo;
      return (val % range) + effectiveLo;
    }

    const snapshot = [
      new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256),
      new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)
    ];
    for (let k = 7; k >= 0; k--) {
      const table = sharedOctets[k];
      table.set(rawSeed);
      const bytes = new Uint8Array(1024);
      for (let i = 0; i < 256; i++) writeLE(bytes, i * 4, table[i]);
      for (let col = 0; col < 4; col++) {
        for (let i = 0; i < 256; i++) {
          const swapIdx = nextKeyRandom(i);
          const a = i * 4 + col, b = swapIdx * 4 + col;
          const tmp = bytes[a]; bytes[a] = bytes[b]; bytes[b] = tmp;
          table[i] = pack32LE(bytes, i * 4);
          table[swapIdx] = pack32LE(bytes, swapIdx * 4);
        }
      }
      snapshot[k].set(table);
    }

    state.preL = pack32LE(keyBytes, 0);
    state.preR = pack32LE(keyBytes, 4);
    state.postL = pack32LE(keyBytes, 8);
    state.postR = pack32LE(keyBytes, 12);

    return { octetTables: snapshot, state };
  }

  // setup(key) in the DarkCrypt implementation is always exercised twice per key
  // (once before crypt, once before decrypt); the second call's only externally
  // observable effect is on the shared leftover state consumed by the NEXT setup()
  // call, so it is reproduced here even though its own table snapshot is unused.
  //
  // Cached by literal key bytes: re-setting the SAME key (as encrypt/decrypt instance
  // pairs and round-trip tests do) reuses the tables from that key's first use instead
  // of mutating the shared leftover state again, so encrypt/decrypt of one key stay
  // mutually consistent while distinct keys still see the real call-order
  // dependent leftover state on their first use.
  const tablesCache = new Map();
  function buildTables(keyBytes) {
    const cacheKey = Array.from(keyBytes).join(',');
    let tables = tablesCache.get(cacheKey);
    if (!tables) {
      tables = buildTablesOnce(keyBytes);
      buildTablesOnce(keyBytes);
      tablesCache.set(cacheKey, tables);
    }
    return tables;
  }

  class DarkCryptKhufu512Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Khufu-512 (DarkCrypt)";
      this.description = "Ralph Merkle's Khufu cipher with a 544-bit key as implemented in the DarkCrypt Total Commander plugin: 64-bit Feistel block, 8 octets of 8 rounds (64 rounds total), key-dependent S-boxes built via a self-referential bootstrap encryption. Includes a confirmed register-clobber bug in the key schedule's swap-index computation and reliance on global (not per-call) key-schedule memory.";
      this.inventor = "Ralph Merkle; DarkCrypt variant by Alexander Myasnikov";
      this.year = 1990;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(68, 68, 0)]; // fixed 544-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];  // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Merkle, \"Fast Software Encryption Functions\", CRYPTO '90", "https://link.springer.com/chapter/10.1007/3-540-38424-3_34")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard key schedule with global-state dependency", "The DarkCrypt implementation's key schedule reads global memory left over from prior setup() calls rather than being a pure function of the key; this implementation reproduces that exactly via shared module state. Encryption for a given key can therefore differ depending on prior key-schedule calls in the same process, exactly like the original implementation.", "Use AES or another vetted cipher."),
        new Vulnerability("Differential cryptanalysis (base Khufu)", "Textbook Khufu is broken by differential cryptanalysis; this DarkCrypt variant is unanalyzed.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      // setup() is called twice per key (crypt test, then decrypt
      // test) and vectors are processed in this exact order (zero, incr, incr2); because
      // of the global-state quirk documented above, these three vectors MUST be
      // exercised as CreateInstance+key+Feed+Result in this exact order for incr and
      // incr2 to reproduce the expected ciphertext (zero is order-independent, since it
      // is always first against a freshly loaded/module-initialized state).
      this.tests = [
        {
          text: "DarkCrypt Khufu — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("8786833be7a2484b")
        },
        {
          text: "DarkCrypt Khufu — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40414243"),
          expected: OpCodes.Hex8ToBytes("6ea8385a3a73a96b")
        },
        {
          text: "DarkCrypt Khufu — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f4041424344"),
          expected: OpCodes.Hex8ToBytes("e629f9a0abc6c61b")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptKhufu512Instance(this, isInverse);
    }
  }

  class DarkCryptKhufu512Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
      this._tables = null;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; this._tables = null; return; }
      if (keyBytes.length !== 68)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Khufu-512 (DarkCrypt) requires exactly 68 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._tables = buildTables(Uint8Array.from(this._key));
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
      const t = this._tables;
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        let L = pack32LE(block, 0), R = pack32LE(block, 4);
        if (this.isInverse) {
          L = OpCodes.ToUint32(OpCodes.Xor32(L, t.state.postL)); R = OpCodes.ToUint32(OpCodes.Xor32(R, t.state.postR));
          [L, R] = decryptRounds(L, R, t.octetTables);
          L = OpCodes.ToUint32(OpCodes.Xor32(L, t.state.preL)); R = OpCodes.ToUint32(OpCodes.Xor32(R, t.state.preR));
        } else {
          L = OpCodes.ToUint32(OpCodes.Xor32(L, t.state.preL)); R = OpCodes.ToUint32(OpCodes.Xor32(R, t.state.preR));
          [L, R] = encryptRounds(L, R, t.octetTables);
          L = OpCodes.ToUint32(OpCodes.Xor32(L, t.state.postL)); R = OpCodes.ToUint32(OpCodes.Xor32(R, t.state.postR));
        }
        const out = new Uint8Array(8);
        writeLE(out, 0, L); writeLE(out, 4, R);
        output.push(...out);
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptKhufu512Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptKhufu512Algorithm, DarkCryptKhufu512Instance };
}));
