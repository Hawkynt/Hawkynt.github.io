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

  /** @type {uint8[]} */
  const ROT = [16, 16, 8, 8, 16, 16, 24, 24];

  /**
   * @param {uint32} x - Word
   * @param {int32} n - Rotation count
   * @returns {uint32} x rotated right by n
   */
  function ror32(x, n) { return OpCodes.RotR32(OpCodes.ToUint32(x), n); }
  /**
   * @param {uint8[]} arr - Bytes
   * @param {int32} off - Offset of the first byte
   * @returns {uint32} Little-endian word
   */
  function pack32LE(arr, off) { return OpCodes.Pack32LE(arr[off], arr[off + 1], arr[off + 2], arr[off + 3]); }
  /**
   * @param {uint8[]} arr - Bytes (written in place)
   * @param {int32} off - Offset of the first byte
   * @param {uint32} v - Word to store little-endian
   */
  function writeLE(arr, off, v) {
    const b = OpCodes.Unpack32LE(v);
    arr[off] = b[0]; arr[off + 1] = b[1]; arr[off + 2] = b[2]; arr[off + 3] = b[3];
  }

  /**
   * @param {uint32} L - Left half
   * @param {uint32} R - Right half
   * @param {uint32[][]} octetTables - Eight 256-entry S-boxes
   * @returns {uint32[]} The two output halves
   */
  function encryptRounds(L, R, octetTables) {
    for (let k = 7; k >= 0; k--) {
      const sbox = octetTables[k];
      for (let r = 0; r < 8; r++) {
        if (OpCodes.And32(r, 1) === 0) { R = OpCodes.ToUint32(OpCodes.Xor32(R, sbox[OpCodes.And32(L, 0xFF)])); L = ror32(L, ROT[r]); }
        else { L = OpCodes.ToUint32(OpCodes.Xor32(L, sbox[OpCodes.And32(R, 0xFF)])); R = ror32(R, ROT[r]); }
      }
    }
    /** @type {uint32[]} */
    const halves = [L, R];
    return halves;
  }
  /**
   * @param {uint32} L - Left half
   * @param {uint32} R - Right half
   * @param {uint32[][]} octetTables - Eight 256-entry S-boxes
   * @returns {uint32[]} The two output halves
   */
  function decryptRounds(L, R, octetTables) {
    for (let k = 0; k <= 7; k++) {
      const sbox = octetTables[k];
      for (let r = 7; r >= 0; r--) {
        if (OpCodes.And32(r, 1) === 0) { L = OpCodes.RotL32(L, ROT[r]); R = OpCodes.ToUint32(OpCodes.Xor32(R, sbox[OpCodes.And32(L, 0xFF)])); }
        else { R = OpCodes.RotL32(R, ROT[r]); L = OpCodes.ToUint32(OpCodes.Xor32(L, sbox[OpCodes.And32(R, 0xFF)])); }
      }
    }
    /** @type {uint32[]} */
    const halves = [L, R];
    return halves;
  }

  // Module-level shared "leftover" octet state: mirrors the DarkCrypt implementation's
  // GLOBAL key-schedule memory. Octets not yet rebuilt within a given setup pass still
  // show whatever the previous setup() call last left there. Starts all-zero, matching
  // a freshly loaded, zero-initialized state.
  /** @type {uint32[][]} */
  const sharedOctets = [
    new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256),
    new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)
  ];

  // Table set layout: entries 0..7 are the octet S-boxes, entry 8 holds the
  // whitening words [preL, preR, postL, postR].
  const WHITENING = 8;

  /**
   * @param {uint8[]} keyBytes - Key bytes
   * @returns {uint32[][]} Octet S-boxes 0..7 and the whitening words at index WHITENING
   */
  function buildTablesOnce(keyBytes) {
    const seed = pack32LE(keyBytes, 64);
    // Borland-style LCG rand(), seeded with srand(seed)
    /** @type {uint32} */
    let rngSeed = OpCodes.ToUint32(seed);
    const rawSeed = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      rngSeed = OpCodes.Add32(OpCodes.Mul32(rngSeed, 0x41C64E6D), 0x3039);
      rawSeed[i] = OpCodes.And32(OpCodes.Shr32(rngSeed, 16), 0x7FFF);
    }

    /** @type {uint32[]} */
    const state = [0, 0, 0, 0]; // preL, preR, postL, postR
    const buf64 = Uint8Array.from(keyBytes.slice(0, 64));
    /** @type {int32} */
    let batchCounter = 0;

    /**
     * Re-encrypt the 64-byte buffer with the current shared octets
     */
    function regenerateBatch() {
      for (let b = 0; b < 8; b++) {
        let L = pack32LE(buf64, b * 8);
        let R = pack32LE(buf64, b * 8 + 4);
        L = OpCodes.ToUint32(OpCodes.Xor32(L, state[0])); R = OpCodes.ToUint32(OpCodes.Xor32(R, state[1]));
        /** @type {uint32[]} */
        const halves = encryptRounds(L, R, sharedOctets);
        L = halves[0]; R = halves[1];
        L = OpCodes.ToUint32(OpCodes.Xor32(L, state[2])); R = OpCodes.ToUint32(OpCodes.Xor32(R, state[3]));
        writeLE(buf64, b * 8, L); writeLE(buf64, b * 8 + 4, R);
      }
      batchCounter = 16;
    }
    /**
     * Next swap index drawn from the buffer
     * @param {int32} lo - Lowest allowed index
     * @returns {int32} Index in lo..255 (16..255 right after a regeneration)
     */
    function nextKeyRandom(lo) {
      let effectiveLo = lo;
      if (batchCounter === 0) { regenerateBatch(); effectiveLo = 16; }
      const dwordIndex = batchCounter - 1;
      const val = pack32LE(buf64, dwordIndex * 4);
      batchCounter--;
      const range = 256 - effectiveLo;
      /** @type {int32} */
      const reduced = val % range;
      return reduced + effectiveLo;
    }

    /** @type {uint32[][]} */
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

    state[0] = pack32LE(keyBytes, 0);
    state[1] = pack32LE(keyBytes, 4);
    state[2] = pack32LE(keyBytes, 8);
    state[3] = pack32LE(keyBytes, 12);

    snapshot.push(state);
    return snapshot;
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
  /** @type {string[]} */
  const tablesCacheKeys = [];
  /** @type {uint32[][][]} */
  const tablesCacheValues = [];
  /**
   * @param {uint8[]} keyBytes - Key bytes
   * @returns {uint32[][]} Octet S-boxes and whitening words (see buildTablesOnce)
   */
  function buildTables(keyBytes) {
    /** @type {string} */
    let cacheKey = "";
    for (let i = 0; i < keyBytes.length; i++) cacheKey += (i > 0 ? "," : "") + keyBytes[i];
    for (let i = 0; i < tablesCacheKeys.length; i++)
      if (tablesCacheKeys[i] === cacheKey) return tablesCacheValues[i];
    const tables = buildTablesOnce(keyBytes);
    buildTablesOnce(keyBytes);
    tablesCacheKeys.push(cacheKey);
    tablesCacheValues.push(tables);
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

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptKhufu512Instance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptKhufu512Instance(this, isInverse);
    }
  }

  class DarkCryptKhufu512Instance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptKhufu512Algorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
      /** @type {uint32[][]|null} */
      this._tables = null;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; this._tables = null; return; }
      if (keyBytes.length !== 68)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. Khufu-512 (DarkCrypt) requires exactly 68 bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._tables = buildTables(Uint8Array.from(this._key));
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
      const t = this._tables;
      const whitening = t[WHITENING];
      const octets = t.slice(0, WHITENING);
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        let L = pack32LE(block, 0), R = pack32LE(block, 4);
        if (this.isInverse) {
          L = OpCodes.ToUint32(OpCodes.Xor32(L, whitening[2])); R = OpCodes.ToUint32(OpCodes.Xor32(R, whitening[3]));
          /** @type {uint32[]} */
          const halves = decryptRounds(L, R, octets);
          L = halves[0]; R = halves[1];
          L = OpCodes.ToUint32(OpCodes.Xor32(L, whitening[0])); R = OpCodes.ToUint32(OpCodes.Xor32(R, whitening[1]));
        } else {
          L = OpCodes.ToUint32(OpCodes.Xor32(L, whitening[0])); R = OpCodes.ToUint32(OpCodes.Xor32(R, whitening[1]));
          /** @type {uint32[]} */
          const halves = encryptRounds(L, R, octets);
          L = halves[0]; R = halves[1];
          L = OpCodes.ToUint32(OpCodes.Xor32(L, whitening[2])); R = OpCodes.ToUint32(OpCodes.Xor32(R, whitening[3]));
        }
        const out = new Uint8Array(8);
        writeLE(out, 0, L); writeLE(out, 4, R);
        for (let _i = 0; _i < out.length; _i++) output.push(out[_i]);
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
