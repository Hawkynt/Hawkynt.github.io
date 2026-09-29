/*
 * Mercy-6 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "Mercy-6" large-block cipher as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). It is a wide-block
 * Feistel construction in the spirit of Paul Crowley & Stefan Lucks' Mercy design
 * (a 4096-bit / 512-byte block cipher for disk-sector encryption), with the state
 * machine / linear-transform core credited to Tom St Denis' LibTomCrypt-era work.
 *
 * Test vectors verified against the DarkCrypt implementation.
 *
 * Structure:
 *   - Block: 4096 bits (512 bytes) = 128 little-endian 32-bit words.
 *   - Key:   256 bits (32 bytes). key[0..15] seeds a modified RC4 stream that
 *            generates all key-dependent tables; key[16..31] is a fixed 128-bit
 *            tweak baked into the key schedule.
 *   - Key schedule (from key[0..15]):
 *       * a 256-entry, 32-bit key-dependent T-box, each byte-lane being an affine
 *         GF(2^8) permutation composed with the AES multiplicative inverse,
 *       * a 24-word constant vector (drives the tweak schedule),
 *       * two 64-word whitening keys (pre/post whitening of the two halves).
 *   - The tweak schedule expands key[16..31] into 6 round-tweaks of 4 words each.
 *   - 6-round Feistel: each round L ^= F(R, roundTweak), then swap halves.
 *     F is a T-function state machine of four 32-bit registers, feeding the
 *     T-box (v -> (v<<8) ^ T[v>>>24]) across the whole half-block.
 *
 * Educational only. Mercy was broken by differential cryptanalysis (Fluhrer, FSE 2001).
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

  const BLOCK_BYTES = 512;   // 4096-bit block
  const BLOCK_WORDS = 128;   // 128 x 32-bit
  const HALF_WORDS = 64;     // half block
  const ROUNDS = 6;

  // ---- key-dependent table generation ----

  // AES multiplicative-inverse table in GF(2^8) with reduction poly 0x11B; generator 3.
  /**
   * @returns {uint8[]} inv[a] = a^-1 in GF(2^8) (inv[0] = 0)
   */
  function buildInverseTable() {
    /** @type {uint8[]} */
    const exp = new Array(256);
    /** @type {uint8[]} */
    const log = new Array(256);
    /** @type {uint32} */
    let pow = 1;
    for (let i = 0; i < 256; i++) {
      exp[i] = pow;
      log[pow] = i;
      let x = OpCodes.Shl32(pow, 1);
      if (OpCodes.And32(pow, 0x80) !== 0) x = OpCodes.Xor32(x, 0x11B);
      x = OpCodes.And32(x, 0xFF);
      pow = OpCodes.And32(OpCodes.Xor32(x, pow), 0xFF); // pow *= 3
    }
    /** @type {uint8[]} */
    const inv = new Array(256);
    inv.fill(0);
    for (let a = 1; a < 256; a++) inv[a] = exp[OpCodes.And32(OpCodes.Sub32(255, log[a]), 0xFF)];
    return inv;
  }

  // DarkCrypt's modified RC4: the PRGA advances j by the index i (not by S[i]).
  class MercyRc4 {
    /**
     * Key the generator and drop the first 256 outputs
     * @param {uint8[]} keyBytes16 - RC4 key bytes
     */
    constructor(keyBytes16) {
      /** @type {uint8[]} */
      this.S = new Array(256);
      /** @type {uint32} */
      this.i = 0;
      /** @type {uint32} */
      this.j = 0;
      for (let i = 0; i < 256; i++) this.S[i] = i;
      /** @type {uint32} */
      let j = 0;
      for (let i = 0; i < 256; i++) {
        j = OpCodes.And32(OpCodes.Add32(OpCodes.Add32(j, this.S[i]), keyBytes16[i % keyBytes16.length]), 0xFF);
        const t = this.S[i]; this.S[i] = this.S[j]; this.S[j] = t;
      }
      for (let k = 0; k < 256; k++) this.next(); // drop 256
    }

    /**
     * @returns {uint8} Next keystream byte
     */
    next() {
      this.i = OpCodes.And32(OpCodes.Add32(this.i, 1), 0xFF);
      const a = this.S[this.i];
      this.j = OpCodes.And32(OpCodes.Add32(this.j, this.i), 0xFF);
      const b = this.S[this.j];
      this.S[this.i] = b;
      this.S[this.j] = a;
      return this.S[OpCodes.And32(OpCodes.Add32(a, b), 0xFF)];
    }
  }

  // Generate a key-dependent affine permutation of 0..255 by XOR-doubling with
  // fresh (non-duplicate) random basis elements drawn from the RC4 stream.
  /**
   * @param {MercyRc4} st - Keystream generator
   * @returns {uint8[]} Permutation of 0..255
   */
  function genPermutation(st) {
    /** @type {uint8[]} */
    const out = new Array(256);
    out[0] = OpCodes.And32(st.next(), 0xFF);
    let n = 1;
    while (n < 256) {
      /** @type {uint8} */
      let c = 0;
      for (;;) {
        c = st.next();
        let dup = false;
        for (let k = 0; k < n; k++) if (out[k] === c) { dup = true; break; }
        if (!dup) break;
      }
      const d = OpCodes.And32(OpCodes.Xor32(c, out[0]), 0xFF);
      for (let k = 0; k < n; k++) out[n + k] = OpCodes.And32(OpCodes.Xor32(d, out[k]), 0xFF);
      n *= 2;
    }
    return out;
  }

  // Fill `count` little-endian 32-bit words from the RC4 stream.
  /**
   * @param {MercyRc4} st - Keystream generator
   * @param {int32} count - Number of words
   * @returns {uint32[]} The words
   */
  function genWords(st, count) {
    /** @type {uint32[]} */
    const w = new Array(count);
    for (let p = 0; p < count; p++) {
      /** @type {uint32} */
      let word = 0;
      for (let s = 0; s < 32; s += 8) word = OpCodes.Add32(word, OpCodes.Shl32(st.next(), s));
      w[p] = word;
    }
    return w;
  }

  // ---- core transform ----

  // T-box mixing step: v -> (v<<8) ^ T[v>>>24]
  /**
   * @param {uint32} v - Word
   * @param {uint32[]} T - 256-entry T-box
   * @returns {uint32} Mixed word
   */
  function tmix(v, T) {
    return OpCodes.Xor32(OpCodes.Shl32(v, 8), T[OpCodes.And32(OpCodes.Shr32(v, 24), 0xFF)]);
  }

  // Four-register T-function state machine. For step i:
  //   x = input[i] + r[(i-1)&3];  y = tmix(x) + r[(i+1)&3];  r[i&3] ^= y.
  // r is updated in place (callers pass a fresh 4-word array).
  /**
   * @param {uint32[]} inputs - Input words
   * @param {uint32[]} r - The four registers, updated in place
   * @param {uint32[]} T - 256-entry T-box
   * @returns {uint32[]} One output word per input word
   */
  function runMachine(inputs, r, T) {
    /** @type {uint32[]} */
    const ys = new Array(inputs.length);
    for (let i = 0; i < inputs.length; i++) {
      const x = OpCodes.Add32(inputs[i], r[OpCodes.And32(i - 1, 3)]);
      const y = OpCodes.Add32(tmix(x, T), r[OpCodes.And32(i + 1, 3)]);
      r[OpCodes.And32(i, 3)] = OpCodes.Xor32(r[OpCodes.And32(i, 3)], y);
      ys[i] = y;
    }
    return ys;
  }

  // Feistel round function: words[loOff .. loOff+63] ^= F(R, roundTweak),
  // where R = words[hiOff .. hiOff+63] and the round tweak is tw[tOff .. tOff+3].
  /**
   * @param {uint32[]} words - Block words, updated in place
   * @param {int32} loOff - Offset of the half that is modified
   * @param {int32} hiOff - Offset of the half that feeds F
   * @param {uint32[]} tw - The 24 tweak words
   * @param {int32} tOff - Offset of this round's four tweak words in tw
   * @param {uint32[]} T - 256-entry T-box
   */
  function fApply(words, loOff, hiOff, tw, tOff, T) {
    /** @type {uint32[]} */
    const inputs = [tw[tOff], tw[tOff + 1], tw[tOff + 2], tw[tOff + 3],
      words[hiOff + 56], words[hiOff + 57], words[hiOff + 58], words[hiOff + 59]];
    for (let k = 0; k < 60; k++) inputs.push(words[hiOff + k]); // R[0..59]
    /** @type {uint32[]} */
    const r = [words[hiOff + 63], words[hiOff + 62], words[hiOff + 61], words[hiOff + 60]];
    const ys = runMachine(inputs, r, T);
    for (let i = 8; i < 68; i++) {
      const o = loOff + (i - 8);
      words[o] = OpCodes.Xor32(words[o], ys[i]);
    }
    words[loOff + 60] = OpCodes.Xor32(words[loOff + 60], r[3]);
    words[loOff + 61] = OpCodes.Xor32(words[loOff + 61], r[2]);
    words[loOff + 62] = OpCodes.Xor32(words[loOff + 62], r[1]);
    words[loOff + 63] = OpCodes.Xor32(words[loOff + 63], r[0]);
  }

  /**
   * @param {uint8[]} b - Bytes (length a multiple of 4)
   * @returns {uint32[]} Little-endian words
   */
  function bytesToWords(b) {
    /** @type {uint32[]} */
    const w = new Array(OpCodes.Shr32(b.length, 2));
    for (let i = 0; i < w.length; i++) {
      const o = i * 4;
      w[i] = OpCodes.Pack32LE(b[o], b[o + 1], b[o + 2], b[o + 3]);
    }
    return w;
  }

  /**
   * @param {uint32[]} w - Words
   * @returns {uint8[]} Little-endian bytes
   */
  function wordsToBytes(w) {
    /** @type {uint8[]} */
    const b = new Array(w.length * 4);
    for (let i = 0; i < w.length; i++) {
      const o = i * 4, v = w[i];
      b[o] = OpCodes.And32(v, 0xFF); b[o + 1] = OpCodes.And32(OpCodes.Shr32(v, 8), 0xFF); b[o + 2] = OpCodes.And32(OpCodes.Shr32(v, 16), 0xFF); b[o + 3] = OpCodes.And32(OpCodes.Shr32(v, 24), 0xFF);
    }
    return b;
  }

  /**
   * Test-vector plaintext: byte i is (i + offset) mod 256
   * @param {int32} offset - Value of the first byte
   * @returns {uint8[]} One block of ramp bytes
   */
  function rampBlock(offset) {
    /** @type {uint8[]} */
    const out = new Array(BLOCK_BYTES);
    for (let i = 0; i < BLOCK_BYTES; i++) out[i] = OpCodes.And32(i + offset, 0xFF);
    return out;
  }

  // ---- algorithm registration ----

  class DarkCryptMercyAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Mercy-6 (DarkCrypt)";
      this.description = "Wide-block (4096-bit / 512-byte) 6-round Feistel cipher from the DarkCrypt Total Commander plugin, in the spirit of Crowley and Lucks' Mercy disk-sector cipher. A modified RC4 stream derives a key-dependent 32-bit T-box, tweak-schedule constants and whitening keys; key[16..31] is a fixed tweak.";
      this.inventor = "Paul Crowley, Stefan Lucks (base Mercy); Tom St Denis (state-machine core); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];    // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(512, 512, 0)]; // fixed 4096-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Mercy: A Fast Large Block Cipher for Disk Sector Encryption (FSE 2000)", "https://www.ciphergoth.org/crypto/mercy/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Differential Cryptanalysis", "The base Mercy design was broken by Scott Fluhrer at FSE 2001 across all six rounds; this non-standard plugin variant is unanalyzed.", "Use AES-XTS or another vetted sector cipher."),
        new Vulnerability("Non-standard variant", "Modified RC4 key schedule and DarkCrypt-specific structure; not recommended for real use.", "Educational only.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      // 256-bit key (key[16..31] is the fixed tweak), 512-byte block.
      this.tests = [
        {
          text: "DarkCrypt Mercy - zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          input: OpCodes.CreateArray(BLOCK_BYTES, 0),
          expected: OpCodes.Hex8ToBytes(
            "83c9ceaede3dbe73aae4423eebb42efe268f3033d5d45a7fcd9b308532e7fe0c" +
            "fc66a401f35755fee980d6669835da9662169d5423947a488d11735099c6568f" +
            "7b6894643da3db6a1140dd3ee7cf4ab2ed7903b46e2f41d148f3cf5adf16e2fa" +
            "30e3a47d9f68f13b51b09d0ae009ab85d0148e47208b0f76ff6adce328a9a59e" +
            "7ff6ab6ed1296d20bb6220faad8dbb5090515ee5ec095846495cbf6ee80ca2e8" +
            "8fed4ae7cd7a6db78c6d3ddce80c080b4fa4598f4ced8dca3314b239ba92e0a8" +
            "faef80d40e9cae007736aafc8934c9d41d9b2d60e8d54e0c2d2f9ffb771397df" +
            "3397822d77f709b1498bbf6b1fc84369fa3616de759f6151ace6164588c2c31b" +
            "6b3bb3db1764a5a50f22669460afc650992e57bf056c3bb5631e337d842d5200" +
            "1f35abb58d3974148975eb78e9edffe77787bd860470ea0df24c7af837107ad2" +
            "792ad7967410f8369dd9081842c8d88462b13262196308ad4962297ca9106787" +
            "5eb3837f25d57d8278bcd07452414a62d5310ee38db25adeb3df3ff7dd0620a3" +
            "4e1baf3bcd779f281b2516ac0d55854d78755d034371dd20e5dc8e206b3b1440" +
            "9f23dd9f15b0f225cd25f34caab1d2e535f8fe4005efe2e21911ff4fa9d12d20" +
            "4512cd93653de3531f9f3ecbb3e872a5cd9731560c8b203a6fff50208eb73e29" +
            "59beb1cb0627f5fde029ec4b3d61ced30219639997dcd92602df2394b47ac3d4")
        },
        {
          text: "DarkCrypt Mercy - incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          input: rampBlock(0),
          expected: OpCodes.Hex8ToBytes(
            "7f06feb5db0790abc131d40d5f1be2953e080cfcd7d09317abff3ada8bf753e4" +
            "f716ea9be2a39258489818a288f9d5e097d04e86a7f97424c87be629e970c75f" +
            "d08d7bd945eadc47b70c186bfa2f1f4c5f7e8ec65a39754fddc9b7fb71002e1c" +
            "903e098d364618745db77903cad6fb022fa25931554d952b7086f4a1b827bccb" +
            "c56b5b88f2c8aef7613a62b9b47568fb696df7426923fe82659f1af4d6c507a3" +
            "a1763b563ac6635028f46682575d20cc29f2cc349b7009ce81954db82a69a9b5" +
            "2c27b660b4af14683cdcac27e8951e61cb5a202fe63b6f75146af22fce462056" +
            "be6811404f0ecdba14d6359141897d49fd5bf5cd129cca8cb1a89544355489aa" +
            "6dcdc84dfaaf23b0205c0fa064a28b6b576a6da256b3cb1e6e5950b0c75ffa17" +
            "af20e04b6c4cf95eda3cadcf3d7498f324c812a7e6548daec95e06bde7343564" +
            "66970bb071ebdeabcf7607e6d3e34abe0d5443ebba6c25b4ac1bb3a6998cf1e1" +
            "4d19838b71e8346d5758872e9ff77e59bf921c58da1ee684bc80a2306742948c" +
            "171b7c5d151a002fe0424c963ab9c80f5eeb99dd6984434fa8c63f7c74ad7b5b" +
            "f56347d61c909315d13eee5b398b315f02edd1f8d2be704d6aa6932b911ceed0" +
            "3c139ac3ee055896b8459d31e0ec011a40d11c92c1cfff752cb84b55414eff5f" +
            "8c3393aa99c5059c86eb6581c2168e2a230724ce5465ff31d8f97bb30e09dfed")
        },
        {
          text: "DarkCrypt Mercy - shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          input: rampBlock(16),
          expected: OpCodes.Hex8ToBytes(
            "546cf3cfdac444e440cb54741ce79be3f972c330dd2ecbe0c44fbcde08eb99ae" +
            "ff9a80d6b1ed52b57473a7e56b1e1b77f1c1db8f158973aee7e1b899d4f3e150" +
            "0c76bfe63ca0e147e0bea112231ad37b91fd472d8a3aee91106b5e034c1616e4" +
            "3ddbee93af5f37d637b75914bfbc8ecbde3a183d576222da3f326f77d22758a8" +
            "e39334b41bc4356984dc9062f9f4838785a987b383352e33c8a8458a8b2cb9df" +
            "d2b2c854776ab39b41cb1ce7d73aed8f0280c306a7b50987d555923983ac71b5" +
            "41d81c6914a96dd50da1d5c112bd43080a228daa3d507624655e946211dd55b8" +
            "4cabe9ef5e39b4e37a948a37bea7e87fbe6b58583841f424452d078cdbda842c" +
            "a5a9a10bc3ad91ae197e21b602db257ddcaa962010a89f7ca0f3813dc3ac9c2e" +
            "02ae43a85b850b300e67ba51e629e9254ac9ff7627651c73be616b456e676b4b" +
            "c59444c87615b32d2e590b5fd68658f7b650b6a229f4c93d9a8e06ffd5add058" +
            "f5dbb9ed31fa3c0c12258b2452bd1cedd3e38334b2d586a755fb09f24ec373aa" +
            "e7cc618710b281b4858b334ce3978460225d30dbf69998f01546dab12a34d4fd" +
            "7c71e1a08107303930d69e63c0b9f2d261400a2e688d2da939a13d624b66bdb0" +
            "8c6681091d70638cefd564efe203122dc4ef9c7a1f4488b6fcb158d93b6ddaba" +
            "a9d2f4518fccf52320ed1a0b53f1dbac258f2047f11752a75ce270755b6c5414")
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptMercyInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptMercyInstance(this, isInverse);
    }
  }

  class DarkCryptMercyInstance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptMercyAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint32[]|null} */
      this._T = null;
      /** @type {uint32[]|null} */
      this._constants = null;
      /** @type {uint32[]|null} */
      this._whitenPost = null;
      /** @type {uint32[]|null} */
      this._whitenPre = null;
      /** @type {uint32[]|null} */
      this._tweak = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = BLOCK_BYTES;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null; this._T = null; this._constants = null;
        this._whitenPost = null; this._whitenPre = null; this._tweak = null;
        this.KeySize = 0;
        return;
      }
      if (keyBytes.length !== 32)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. Mercy-6 (DarkCrypt) requires exactly 32 bytes");
      this._keySchedule(keyBytes);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
    }

    /**
     * @returns {uint8[]|null} Copy of the key, or null
     */
    get key() { return this._key ? [...this._key] : null; }

    /**
     * Derive the T-box, tweak-schedule constants, whitening words and tweak
     * @param {uint8[]} keyBytes - 32 key bytes
     */
    _keySchedule(keyBytes) {
      const inv = buildInverseTable();
      const st = new MercyRc4(keyBytes.slice(0, 16));

      // 256-entry, 32-bit T-box: each byte lane is D_lane[ inv( C_lane[i] ) ].
      /** @type {uint32[]} */
      const T = new Array(256);
      T.fill(0);
      for (let lane = 0; lane < 4; lane++) {
        const C = genPermutation(st);
        const D = genPermutation(st);
        const shift = 8 * lane;
        for (let i = 0; i < 256; i++) {
          const d = D[inv[C[i]]];
          T[i] = OpCodes.Or32(T[i], OpCodes.Shl32(d, shift));
        }
      }
      this._T = T;

      this._constants = genWords(st, 24);  // tweak-schedule constants
      this._whitenPost = genWords(st, 64); // 0x40A070
      this._whitenPre = genWords(st, 64);  // 0x40A170

      // Fixed 128-bit tweak = key[16..31] as 4 little-endian words.
      /** @type {uint32[]} */
      const tweak = [];
      for (let k = 0; k < 4; k++) {
        const o = 16 + 4 * k;
        tweak.push(OpCodes.Pack32LE(keyBytes[o], keyBytes[o + 1], keyBytes[o + 2], keyBytes[o + 3]));
      }
      this._tweak = tweak;
    }

    // Expand the 128-bit tweak into 24 words (six 4-word round tweaks).
    /**
     * @returns {uint32[]} The 24 round-tweak words
     */
    _tweakSchedule() {
      const C = this._constants, tw = this._tweak;
      /** @type {uint32[]} */
      const inputs = [tw[0], tw[1], tw[2], tw[3], C[16], C[17], C[18], C[19]];
      for (let k = 0; k < 16; k++) inputs.push(C[k]);
      for (let k = 16; k < 20; k++) inputs.push(C[k]);
      /** @type {uint32[]} */
      const r = [C[23], C[22], C[21], C[20]];
      const ys = runMachine(inputs, r, this._T);
      /** @type {uint32[]} */
      const out = new Array(24);
      for (let k = 0; k < 20; k++) out[k] = ys[8 + k];
      out[20] = r[3]; out[21] = r[2]; out[22] = r[1]; out[23] = r[0];
      return out;
    }

    /**
     * @param {uint8[]} blockBytes - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(blockBytes) {
      const words = bytesToWords(blockBytes);
      const T = this._T;
      const tw = this._tweakSchedule();
      for (let k = 0; k < HALF_WORDS; k++) words[64 + k] = OpCodes.Xor32(words[64 + k], this._whitenPre[k]);
      let lo = 0, hi = 64;
      for (let round = 0; round < ROUNDS; round++) {
        fApply(words, lo, hi, tw, 20 - 4 * round, T);
        const s = lo; lo = hi; hi = s;
      }
      for (let k = 0; k < HALF_WORDS; k++) words[lo + k] = OpCodes.Xor32(words[lo + k], this._whitenPost[k]);
      return wordsToBytes(words);
    }

    /**
     * @param {uint8[]} blockBytes - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(blockBytes) {
      const words = bytesToWords(blockBytes);
      const T = this._T;
      const tw = this._tweakSchedule();
      for (let k = 0; k < HALF_WORDS; k++) words[k] = OpCodes.Xor32(words[k], this._whitenPost[k]);
      let lo = 64, hi = 0;
      for (let round = 0; round < ROUNDS; round++) {
        fApply(words, lo, hi, tw, 4 * round, T);
        const s = lo; lo = hi; hi = s;
      }
      for (let k = 0; k < HALF_WORDS; k++) words[lo + k] = OpCodes.Xor32(words[lo + k], this._whitenPre[k]);
      return wordsToBytes(words);
    }

    /**
     * @param {uint8[]} data - Input bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
     * @returns {uint8[]} Encrypted or decrypted blocks
     */
    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptMercyAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMercyAlgorithm, DarkCryptMercyInstance };
}));
