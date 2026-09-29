/*
 * Threefish-512-TW (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Threefish-512 (the "standard" member of the Threefish tweakable block-cipher family,
 * designed for the Skein hash function) as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project), build "TW1.2".
 *
 * Structurally and numerically this matches the published Threefish-512 specification
 * exactly: 72 mixing rounds grouped in fours between subkey injections, the standard
 * 8-word permutation pi = [2,1,4,7,6,5,0,3], the standard 8x4 rotation-constant table,
 * and the standard 128-bit tweak schedule (T0,T1,T2=T0^T1 injected into words 5/6, round
 * counter into word 7). setup(key) reads 80 bytes: the first 64 bytes are the 512-bit
 * key, the last 16 bytes are the tweak (both are used - the tweak is NOT forced to zero).
 *
 * DarkCrypt's only deviation from the published spec is the key-schedule parity word:
 * 0x5555555555555555 (both 32-bit halves 0x55555555), replacing the standard Skein
 * constant C240 = 0x1BD11BDA1BD11BD1.
 * As implemented in the DarkCrypt Total Commander plugin; test vectors verified against
 * the DarkCrypt implementation.
 * 512-bit blocks, 512-bit keys, 128-bit tweak (640-bit total "key" material as exposed by
 * the setup() interface). Educational only.
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

  /** @type {uint64} */
  const MASK64 = 0xFFFFFFFFFFFFFFFFn; // 2^64 - 1
  // DarkCrypt's non-standard key-schedule parity constant (standard Skein uses C240 = 0x1BD11BDA1BD11BD1).
  /** @type {uint64} */
  const PARITY = 0x5555555555555555n;

  /**
   * @param {uint64} x - Word
   * @param {int32} r - Rotation
   * @returns {uint64} Rotated word
   */
  function rotl(x, r) { return OpCodes.RotL64n(x, r); }
  /**
   * @param {uint64} x - Word
   * @param {int32} r - Rotation
   * @returns {uint64} Rotated word
   */
  function rotr(x, r) { return OpCodes.RotR64n(x, r); }
  /**
   * @param {uint64} a - First word
   * @param {uint64} b - Second word
   * @returns {uint64} (a + b) mod 2^64
   */
  function add(a, b) { return OpCodes.AndN(a + b, MASK64); }
  /**
   * @param {uint64} a - First word
   * @param {uint64} b - Second word
   * @returns {uint64} (a - b) mod 2^64
   */
  function sub(a, b) { return OpCodes.AndN(a - b, MASK64); }

  /**
   * @param {uint8[]} bytes - Bytes
   * @param {int32} n - Number of 64-bit words
   * @returns {uint64[]} Little-endian words
   */
  function bytesToWords64LE(bytes, n) {
    /** @type {uint64[]} */
    const w = [];
    for (let i = 0; i < n; i++) {
      /** @type {uint64} */
      let v = 0n;
      for (let j = 7; j >= 0; j--) v = OpCodes.OrN(OpCodes.ShiftLn(v, 8), BigInt(bytes[i * 8 + j]));
      w.push(v);
    }
    return w;
  }

  /**
   * @param {uint64[]} words - Words
   * @returns {uint8[]} Little-endian bytes
   */
  function words64ToBytesLE(words) {
    /** @type {uint8[]} */
    const out = [];
    for (let i = 0; i < words.length; i++) {
      let v = words[i];
      for (let j = 0; j < 8; j++) {
        /** @type {uint8} */
        const byteVal = Number(OpCodes.AndN(v, 0xffn));
        out.push(byteVal);
        v = OpCodes.ShiftRn(v, 8);
      }
    }
    return out;
  }

  /**
   * @param {uint64[]} keyWords - Eight key words
   * @returns {uint64[]} Nine words: the key words and their parity word
   */
  function keySchedule(keyWords) {
    let x = PARITY;
    for (let i = 0; i < 8; i++) x = OpCodes.XorN(x, keyWords[i]);
    /** @type {uint64[]} */
    const out = [...keyWords, x];
    return out;
  }

  // Threefish-512 rotation constants for even and odd rounds
  /** @type {int32[]} */
  const ROT_EVEN = [46, 36, 19, 37, 33, 27, 14, 42, 17, 49, 36, 39, 44, 9, 54, 56];
  /** @type {int32[]} */
  const ROT_ODD = [39, 30, 34, 24, 13, 50, 10, 17, 25, 29, 39, 43, 8, 35, 56, 22];

  // Encrypt512: standard Threefish-512 definition (rotation table and permutation both
  // match the published spec exactly; only the key-schedule parity constant is custom).
  /**
   * @param {uint64[]} block - Eight state words
   * @param {uint64[]} K - Nine key-schedule words
   * @param {uint64[]} T - Three tweak words
   * @returns {uint64[]} Eight state words
   */
  function encrypt512(block, K, T) {
    let b0 = block[0], b1 = block[1], b2 = block[2], b3 = block[3], b4 = block[4], b5 = block[5], b6 = block[6], b7 = block[7];
    for (let r = 0; r < 18; r++) {
      b0 = add(b0, K[r % 9]);
      b1 = add(b1, K[(r + 1) % 9]);
      b2 = add(b2, K[(r + 2) % 9]);
      b3 = add(b3, K[(r + 3) % 9]);
      b4 = add(b4, K[(r + 4) % 9]);
      b5 = add(add(b5, K[(r + 5) % 9]), T[r % 3]);
      b6 = add(add(b6, K[(r + 6) % 9]), T[(r + 1) % 3]);
      b7 = add(add(b7, K[(r + 7) % 9]), BigInt(r));

      const rots = (r % 2 === 0) ? ROT_EVEN : ROT_ODD;
      b0 = add(b0, b1); b1 = OpCodes.XorN(rotl(b1, rots[0]), b0);
      b2 = add(b2, b3); b3 = OpCodes.XorN(rotl(b3, rots[1]), b2);
      b4 = add(b4, b5); b5 = OpCodes.XorN(rotl(b5, rots[2]), b4);
      b6 = add(b6, b7); b7 = OpCodes.XorN(rotl(b7, rots[3]), b6);

      b2 = add(b2, b1); b1 = OpCodes.XorN(rotl(b1, rots[4]), b2);
      b4 = add(b4, b7); b7 = OpCodes.XorN(rotl(b7, rots[5]), b4);
      b6 = add(b6, b5); b5 = OpCodes.XorN(rotl(b5, rots[6]), b6);
      b0 = add(b0, b3); b3 = OpCodes.XorN(rotl(b3, rots[7]), b0);

      b4 = add(b4, b1); b1 = OpCodes.XorN(rotl(b1, rots[8]), b4);
      b6 = add(b6, b3); b3 = OpCodes.XorN(rotl(b3, rots[9]), b6);
      b0 = add(b0, b5); b5 = OpCodes.XorN(rotl(b5, rots[10]), b0);
      b2 = add(b2, b7); b7 = OpCodes.XorN(rotl(b7, rots[11]), b2);

      b6 = add(b6, b1); b1 = OpCodes.XorN(rotl(b1, rots[12]), b6);
      b0 = add(b0, b7); b7 = OpCodes.XorN(rotl(b7, rots[13]), b0);
      b2 = add(b2, b5); b5 = OpCodes.XorN(rotl(b5, rots[14]), b2);
      b4 = add(b4, b3); b3 = OpCodes.XorN(rotl(b3, rots[15]), b4);
    }
    b0 = add(b0, K[0]);
    b1 = add(b1, K[1]);
    b2 = add(b2, K[2]);
    b3 = add(b3, K[3]);
    b4 = add(b4, K[4]);
    b5 = add(add(b5, K[5]), T[0]);
    b6 = add(add(b6, K[6]), T[1]);
    b7 = add(add(b7, K[7]), 18n);
    /** @type {uint64[]} */
    const out = [b0, b1, b2, b3, b4, b5, b6, b7];
    return out;
  }

  /**
   * @param {uint64[]} block - Eight state words
   * @param {uint64[]} K - Nine key-schedule words
   * @param {uint64[]} T - Three tweak words
   * @returns {uint64[]} Eight state words
   */
  function decrypt512(block, K, T) {
    let b0 = block[0], b1 = block[1], b2 = block[2], b3 = block[3], b4 = block[4], b5 = block[5], b6 = block[6], b7 = block[7];
    /** @type {uint64} */
    let tmp;
    for (let r = 18; r > 1; r--) {
      b0 = sub(b0, K[r % 9]); b1 = sub(b1, K[(r + 1) % 9]); b2 = sub(b2, K[(r + 2) % 9]); b3 = sub(b3, K[(r + 3) % 9]);
      b4 = sub(b4, K[(r + 4) % 9]); b5 = sub(sub(b5, K[(r + 5) % 9]), T[r % 3]); b6 = sub(sub(b6, K[(r + 6) % 9]), T[(r + 1) % 3]); b7 = sub(sub(b7, K[(r + 7) % 9]), BigInt(r));

      tmp = OpCodes.XorN(b3, b4); b3 = rotr(tmp, 22); b4 = sub(b4, b3);
      tmp = OpCodes.XorN(b5, b2); b5 = rotr(tmp, 56); b2 = sub(b2, b5);
      tmp = OpCodes.XorN(b7, b0); b7 = rotr(tmp, 35); b0 = sub(b0, b7);
      tmp = OpCodes.XorN(b1, b6); b1 = rotr(tmp, 8); b6 = sub(b6, b1);

      tmp = OpCodes.XorN(b7, b2); b7 = rotr(tmp, 43); b2 = sub(b2, b7);
      tmp = OpCodes.XorN(b5, b0); b5 = rotr(tmp, 39); b0 = sub(b0, b5);
      tmp = OpCodes.XorN(b3, b6); b3 = rotr(tmp, 29); b6 = sub(b6, b3);
      tmp = OpCodes.XorN(b1, b4); b1 = rotr(tmp, 25); b4 = sub(b4, b1);

      tmp = OpCodes.XorN(b3, b0); b3 = rotr(tmp, 17); b0 = sub(b0, b3);
      tmp = OpCodes.XorN(b5, b6); b5 = rotr(tmp, 10); b6 = sub(b6, b5);
      tmp = OpCodes.XorN(b7, b4); b7 = rotr(tmp, 50); b4 = sub(b4, b7);
      tmp = OpCodes.XorN(b1, b2); b1 = rotr(tmp, 13); b2 = sub(b2, b1);

      tmp = OpCodes.XorN(b7, b6); b7 = rotr(tmp, 24); b6 = sub(b6, b7);
      tmp = OpCodes.XorN(b5, b4); b5 = rotr(tmp, 34); b4 = sub(b4, b5);
      tmp = OpCodes.XorN(b3, b2); b3 = rotr(tmp, 30); b2 = sub(b2, b3);
      tmp = OpCodes.XorN(b1, b0); b1 = rotr(tmp, 39); b0 = sub(b0, b1);

      r--;

      b0 = sub(b0, K[r % 9]); b1 = sub(b1, K[(r + 1) % 9]); b2 = sub(b2, K[(r + 2) % 9]); b3 = sub(b3, K[(r + 3) % 9]);
      b4 = sub(b4, K[(r + 4) % 9]); b5 = sub(sub(b5, K[(r + 5) % 9]), T[r % 3]); b6 = sub(sub(b6, K[(r + 6) % 9]), T[(r + 1) % 3]); b7 = sub(sub(b7, K[(r + 7) % 9]), BigInt(r));

      tmp = OpCodes.XorN(b3, b4); b3 = rotr(tmp, 56); b4 = sub(b4, b3);
      tmp = OpCodes.XorN(b5, b2); b5 = rotr(tmp, 54); b2 = sub(b2, b5);
      tmp = OpCodes.XorN(b7, b0); b7 = rotr(tmp, 9); b0 = sub(b0, b7);
      tmp = OpCodes.XorN(b1, b6); b1 = rotr(tmp, 44); b6 = sub(b6, b1);

      tmp = OpCodes.XorN(b7, b2); b7 = rotr(tmp, 39); b2 = sub(b2, b7);
      tmp = OpCodes.XorN(b5, b0); b5 = rotr(tmp, 36); b0 = sub(b0, b5);
      tmp = OpCodes.XorN(b3, b6); b3 = rotr(tmp, 49); b6 = sub(b6, b3);
      tmp = OpCodes.XorN(b1, b4); b1 = rotr(tmp, 17); b4 = sub(b4, b1);

      tmp = OpCodes.XorN(b3, b0); b3 = rotr(tmp, 42); b0 = sub(b0, b3);
      tmp = OpCodes.XorN(b5, b6); b5 = rotr(tmp, 14); b6 = sub(b6, b5);
      tmp = OpCodes.XorN(b7, b4); b7 = rotr(tmp, 27); b4 = sub(b4, b7);
      tmp = OpCodes.XorN(b1, b2); b1 = rotr(tmp, 33); b2 = sub(b2, b1);

      tmp = OpCodes.XorN(b7, b6); b7 = rotr(tmp, 37); b6 = sub(b6, b7);
      tmp = OpCodes.XorN(b5, b4); b5 = rotr(tmp, 19); b4 = sub(b4, b5);
      tmp = OpCodes.XorN(b3, b2); b3 = rotr(tmp, 36); b2 = sub(b2, b3);
      tmp = OpCodes.XorN(b1, b0); b1 = rotr(tmp, 46); b0 = sub(b0, b1);
    }
    b0 = sub(b0, K[0]); b1 = sub(b1, K[1]); b2 = sub(b2, K[2]); b3 = sub(b3, K[3]);
    b4 = sub(b4, K[4]); b5 = sub(sub(b5, K[5]), T[0]); b6 = sub(sub(b6, K[6]), T[1]); b7 = sub(b7, K[7]);
    /** @type {uint64[]} */
    const out = [b0, b1, b2, b3, b4, b5, b6, b7];
    return out;
  }

  class DarkCryptThreefish512TWAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Threefish-512-TW (DarkCrypt)";
      this.description = "Threefish-512 as implemented in the DarkCrypt Total Commander plugin build \"TW1.2\": standard 72-round/permutation/rotation/tweak structure, but with a non-standard key-schedule parity constant (0x5555555555555555). 512-bit block, 512-bit key + 128-bit tweak.";
      this.inventor = "Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker (base Threefish); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2008;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(80, 80, 0)]; // 64-byte key + 16-byte tweak, fixed
      this.SupportedBlockSizes = [new KeySize(64, 64, 0)]; // fixed 512-bit block

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("The Skein Hash Function Family / Threefish specification", "https://www.schneier.com/academic/paperfiles/skein1.3.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "Modified Threefish-512 with an unanalyzed key-schedule constant; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Threefish-512-tweak — zero key/tweak/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("54c48fea2dac72222c0380d1a1a9f7684d47bd90fc491724dc599e1824b6b30ae22db97e841482db209c0e6974c2111ad6c691984919c11f987fc2d132379fb4")
        },
        {
          text: "DarkCrypt Threefish-512-tweak — incrementing key/tweak/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f"),
          expected: OpCodes.Hex8ToBytes("54eba34f9c4492af834cc2cb46ac16117e9100f6c3f9ec2240f22750038a0ff1144bf2448bebcd6bc6919270a2a18322091f60b4345a1c8a5538d57058a22def")
        },
        {
          text: "DarkCrypt Threefish-512-tweak — shifted incrementing key/tweak/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f50"),
          expected: OpCodes.Hex8ToBytes("95d7e6e756799a33da241d309d8f23ea7b8436ac36380e90bfc8a3eac0ebcabe302a0472ded6d94a97484fc7e02b21dc95ad2fab5e85fd26547ebd2ff1a9ca47")
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptThreefish512TWInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptThreefish512TWInstance(this, isInverse);
    }
  }

  class DarkCryptThreefish512TWInstance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptThreefish512TWAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint64[]|null} */
      this._K = null;
      /** @type {uint64[]|null} */
      this._T = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 64;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._K = null; this._T = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 80)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. Threefish-512-TW (DarkCrypt) requires exactly 80 bytes (64-byte key + 16-byte tweak)");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      const keyWords = bytesToWords64LE(keyBytes.slice(0, 64), 8);
      const twWords = bytesToWords64LE(keyBytes.slice(64, 80), 2);
      twWords.push(OpCodes.XorN(twWords[0], twWords[1]));

      this._K = keySchedule(keyWords);
      this._T = twWords;
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
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      const words = bytesToWords64LE(block, 8);
      const out = encrypt512(words, this._K, this._T);
      return words64ToBytesLE(out);
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      const words = bytesToWords64LE(block, 8);
      const out = decrypt512(words, this._K, this._T);
      return words64ToBytesLE(out);
    }
  }

  const algorithmInstance = new DarkCryptThreefish512TWAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptThreefish512TWAlgorithm, DarkCryptThreefish512TWInstance };
}));
