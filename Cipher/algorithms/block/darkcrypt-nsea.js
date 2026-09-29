/*
 * NSEA (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * NSEA ("Nonpatented Simple Encryption Algorithm", Peter Gutmann, 1992) as
 * implemented in the DarkCrypt Total Commander plugin (Alexander Myasnikov,
 * "Zarya" project). The block is 4 32-bit words (lLeft, rLeft, lRight,
 * rRight); each of the two rounds performs 8 steps that alternately XOR the
 * "Left" pair with values pulled from two 256-entry, key-derived 32-bit
 * S-boxes (indexed by the low byte of the "Right" pair) and then rotate the
 * "Right" pair 8 bits, or vice versa. The working S-boxes are built from the
 * key by seeding a small 16-bit LCRNG (period-limited multiplicative
 * generator) and using its output to Fisher-Yates-permute an initial
 * identity table, first directly from the key, and then again from the key
 * re-encrypted (ECB, block by block) under the first pass of S-boxes.
 *
 * The DarkCrypt implementation's setup(key) reads a 36-byte (288-bit) key but
 * only the first 32 bytes are used as the actual key material; the last 4
 * bytes (little-endian) become the "salt" that seeds the initial S-box
 * permutation. This differs from Gutmann's reference nsea.c (which takes a
 * separate, explicit salt parameter and folds all key bytes into the
 * schedule). crypt()/decrypt() carry no state across calls - each call is a
 * pure, stateless 128-bit block primitive. Test vectors verified against the
 * DarkCrypt implementation (encrypt/decrypt round-trip confirmed). 128-bit
 * blocks, 288-bit keys. Educational only.
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

  const SBOX_SIZE = 256 * 4;   // bytes per S-box table (1024)
  const BLOCK_SIZE = 16;       // 128-bit block
  const KEY_MATERIAL_LEN = 32; // key bytes actually mixed into the schedule
  /** @type {uint16[]} */
  const COLUMN_TABLE = [0, 256, 512, 768];

  // 16-bit multiplicative LCRNG: x' = (x*23311 + 1) mod 65533
  /**
   * @param {uint32} v - Current generator state (16 bits)
   * @returns {uint32} Next generator state
   */
  function rnd(v) {
    return OpCodes.And32(OpCodes.Add32(OpCodes.Mul32(v, 23311), 1) % 65533, 0xFFFF);
  }

  /**
   * @returns {uint8[]} Identity S-box bytes (each byte value repeated 4 times)
   */
  function identitySBoxBytes() {
    /** @type {uint8[]} */
    const sBox = new Array(SBOX_SIZE);
    let idx = 0;
    for (let i = 0; i < 256; i++)
      for (let j = 0; j < 4; j++)
        sBox[idx++] = i;
    return sBox;
  }

  /**
   * @param {uint8[]} key - Key material
   * @param {uint32} salt - 16-bit salt
   * @returns {uint32} 16-bit generator seed
   */
  function seedFromKey(key, salt) {
    let s = OpCodes.And32(salt, 0xFFFF);
    for (let i = 0; i < KEY_MATERIAL_LEN; i++) s = OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(s, 1), key[i]), 0xFFFF);
    return s;
  }

  /**
   * @param {uint8[]} key - Key material
   * @param {uint32} salt - 16-bit salt
   * @param {uint8[]} tempKey - Buffer to fill
   * @param {int32} offset - First index to fill
   */
  function fillTempKeyHalf(key, salt, tempKey, offset) {
    let v = seedFromKey(key, salt);
    for (let i = 0; i < SBOX_SIZE; i++) {
      v = rnd(v);
      tempKey[offset + i] = OpCodes.And32(OpCodes.Shr32(v, 8), 0xFF);
    }
  }

  /**
   * @param {uint8[]} sBox - S-box bytes, permuted in place
   * @param {uint8[]} tempKey - Permutation source
   * @param {int32} tempKeyIndex - First source index
   */
  function permuteSBox(sBox, tempKey, tempKeyIndex) {
    let tki = tempKeyIndex;
    for (let srcIndex = 0; srcIndex < SBOX_SIZE; srcIndex++) {
      const destIndex = OpCodes.Add32(tempKey[tki++], COLUMN_TABLE[OpCodes.And32(srcIndex, 3)]);
      const t = sBox[srcIndex];
      sBox[srcIndex] = sBox[destIndex];
      sBox[destIndex] = t;
    }
  }

  /**
   * @param {uint8[]} sBoxBytes - 1024 S-box bytes
   * @returns {uint32[]} 256 little-endian S-box words
   */
  function sBoxBytesToWords(sBoxBytes) {
    /** @type {uint32[]} */
    const out = new Array(256);
    for (let i = 0; i < 256; i++) out[i] = OpCodes.Pack32LE(sBoxBytes[i*4], sBoxBytes[i*4+1], sBoxBytes[i*4+2], sBoxBytes[i*4+3]);
    return out;
  }

  // Core stateless two-round transform shared by encrypt/decrypt/key-setup.
  /**
   * @param {uint8[]} block - Input block
   * @param {uint32[]} S1 - First S-box words
   * @param {uint32[]} S2 - Second S-box words
   * @returns {uint8[]} Output block
   */
  function coreEncrypt(block, S1, S2) {
    let lLeft = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    let rLeft = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
    let lRight = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
    let rRight = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);
    let rotTemp;
    const rotateRightPair = () => {
      rotTemp = OpCodes.Shr32(lRight, 24);
      lRight = OpCodes.ToUint32(OpCodes.Shl32(lRight, 8) | OpCodes.Shr32(rRight, 24));
      rRight = OpCodes.ToUint32(OpCodes.Shl32(rRight, 8) | rotTemp);
    };
    const rotateLeftPair = () => {
      rotTemp = OpCodes.Shr32(lLeft, 24);
      lLeft = OpCodes.ToUint32(OpCodes.Shl32(lLeft, 8) | OpCodes.Shr32(rLeft, 24));
      rLeft = OpCodes.ToUint32(OpCodes.Shl32(rLeft, 8) | rotTemp);
    };
    for (let round = 0; round < 2; round++) {
      for (let step = 0; step < 4; step++) {
        lLeft = OpCodes.Xor32(lLeft, S1[OpCodes.And32(lRight, 0xFF)]);
        rLeft = OpCodes.Xor32(rLeft, S2[OpCodes.And32(rRight, 0xFF)]);
        rotateRightPair();
        lRight = OpCodes.Xor32(lRight, S1[OpCodes.And32(lLeft, 0xFF)]);
        rRight = OpCodes.Xor32(rRight, S2[OpCodes.And32(rLeft, 0xFF)]);
        rotateLeftPair();
      }
    }
    return [...OpCodes.Unpack32LE(lLeft), ...OpCodes.Unpack32LE(rLeft), ...OpCodes.Unpack32LE(lRight), ...OpCodes.Unpack32LE(rRight)];
  }

  /**
   * @param {uint8[]} block - Input block
   * @param {uint32[]} S1 - First S-box words
   * @param {uint32[]} S2 - Second S-box words
   * @returns {uint8[]} Output block
   */
  function coreDecrypt(block, S1, S2) {
    let lLeft = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    let rLeft = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
    let lRight = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
    let rRight = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);
    let rotTemp;
    const unrotateLeftPair = () => {
      rotTemp = OpCodes.Shl32(rLeft, 24);
      rLeft = OpCodes.ToUint32(OpCodes.Shr32(rLeft, 8) | OpCodes.Shl32(lLeft, 24));
      lLeft = OpCodes.ToUint32(OpCodes.Shr32(lLeft, 8) | rotTemp);
    };
    const unrotateRightPair = () => {
      rotTemp = OpCodes.Shl32(rRight, 24);
      rRight = OpCodes.ToUint32(OpCodes.Shr32(rRight, 8) | OpCodes.Shl32(lRight, 24));
      lRight = OpCodes.ToUint32(OpCodes.Shr32(lRight, 8) | rotTemp);
    };
    // Exact reverse of coreEncrypt's 16 elementary steps (self-inverse XORs,
    // rotations undone with the opposite-direction rotate).
    for (let round = 0; round < 2; round++) {
      for (let step = 0; step < 4; step++) {
        unrotateLeftPair();
        lRight = OpCodes.Xor32(lRight, S1[OpCodes.And32(lLeft, 0xFF)]);
        rRight = OpCodes.Xor32(rRight, S2[OpCodes.And32(rLeft, 0xFF)]);
        unrotateRightPair();
        lLeft = OpCodes.Xor32(lLeft, S1[OpCodes.And32(lRight, 0xFF)]);
        rLeft = OpCodes.Xor32(rLeft, S2[OpCodes.And32(rRight, 0xFF)]);
      }
    }
    return [...OpCodes.Unpack32LE(lLeft), ...OpCodes.Unpack32LE(rLeft), ...OpCodes.Unpack32LE(lRight), ...OpCodes.Unpack32LE(rRight)];
  }

  // DarkCrypt's key setup:
  //   keyLength = 32 (first 32 of the 36 key bytes)
  //   salt      = LE32(key[32..35])   (last 4 key bytes)
  //   1) two 1024-byte identity S-boxes are permuted using LCRNG streams
  //      seeded from (key, salt-low16) and (key, salt-high16)
  //   2) a 2048-byte "tempKey" buffer (2-byte length header + 32 key bytes +
  //      zero padding) is scrambled by running the stateless block cipher
  //      (using the S-boxes from step 1) over it, one 16-byte block at a
  //      time, independently (ECB - no chaining/IV)
  //   3) the S-boxes are reset to identity and re-permuted using the
  //      scrambled tempKey, producing the final working S-boxes
  /**
   * @param {uint8[]} key36 - 36-byte key
   * @returns {uint32[][]} The two working S-boxes as words
   */
  function setupSBoxes(key36) {
    const salt = OpCodes.Pack32LE(key36[32], key36[33], key36[34], key36[35]);
    const key = key36.slice(0, KEY_MATERIAL_LEN);

    let sBox1 = identitySBoxBytes();
    let sBox2 = identitySBoxBytes();
    /** @type {uint8[]} */
    const tempKey = new Array(SBOX_SIZE * 2);

    fillTempKeyHalf(key, OpCodes.And32(salt, 0xFFFF), tempKey, 0);
    fillTempKeyHalf(key, OpCodes.And32(OpCodes.Shr32(salt, 16), 0xFFFF), tempKey, SBOX_SIZE);

    permuteSBox(sBox1, tempKey, 0);
    permuteSBox(sBox2, tempKey, SBOX_SIZE);
    const S1pass1 = sBoxBytesToWords(sBox1), S2pass1 = sBoxBytesToWords(sBox2);

    tempKey[0] = OpCodes.And32(OpCodes.Shr32(KEY_MATERIAL_LEN, 8), 0xFF);
    tempKey[1] = OpCodes.And32(KEY_MATERIAL_LEN, 0xFF);
    for (let i = 0; i < KEY_MATERIAL_LEN; i++) tempKey[2 + i] = key[i];
    for (let i = 2 + KEY_MATERIAL_LEN; i < SBOX_SIZE * 2; i++) tempKey[i] = 0;

    for (let i = 0; i < SBOX_SIZE * 2; i += BLOCK_SIZE) {
      const chunk = tempKey.slice(i, i + BLOCK_SIZE);
      const enc = coreEncrypt(chunk, S1pass1, S2pass1);
      for (let j = 0; j < BLOCK_SIZE; j++) tempKey[i + j] = enc[j];
    }

    sBox1 = identitySBoxBytes();
    sBox2 = identitySBoxBytes();
    permuteSBox(sBox1, tempKey, 0);
    permuteSBox(sBox2, tempKey, SBOX_SIZE);

    /** @type {uint32[][]} */
    const boxes = [];
    boxes.push(sBoxBytesToWords(sBox1));
    boxes.push(sBoxBytesToWords(sBox2));
    return boxes;
  }

  class DarkCryptNSEAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "NSEA (DarkCrypt)";
      this.description = "Nonpatented Simple Encryption Algorithm by Peter Gutmann (1992) as implemented in the DarkCrypt Total Commander plugin: 128-bit block, 288-bit key, two-round key-dependent S-box Feistel-like network. DarkCrypt uses only 32 of the 36 key bytes as key material, with the last 4 bytes as an S-box permutation salt.";
      this.inventor = "Peter Gutmann; DarkCrypt port by Alexander Myasnikov";
      this.year = 1992;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL; // Peter Gutmann (University of Auckland, New Zealand) - no NZ entry available

      this.SupportedKeySizes = [new KeySize(36, 36, 0)];   // fixed 288-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("NSEA.C, Peter Gutmann's public-domain reference implementation", "https://github.com/ab300819/applied-cryptography/blob/master/NSEA/NSEA.C")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed key setup truncation", "The DarkCrypt port silently discards 4 of the 36 key bytes (used only as an S-box permutation salt) rather than mixing all key material into the schedule; not independently cryptanalyzed.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Nsea — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("9d6833213a0ba3b4d42f2f6147997c3f")
        },
        {
          text: "DarkCrypt Nsea — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20212223"),
          expected: OpCodes.Hex8ToBytes("77408d242bb7b14433700eb68b0e94a4")
        },
        {
          text: "DarkCrypt Nsea — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021222324"),
          expected: OpCodes.Hex8ToBytes("723203dcc20ed097448a4e3382a33d90")
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptNSEAInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptNSEAInstance(this, isInverse);
    }
  }

  class DarkCryptNSEAInstance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptNSEAAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint32[]|null} */
      this._S1 = null;
      /** @type {uint32[]|null} */
      this._S2 = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._S1 = null; this._S2 = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 36)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. NSEA (DarkCrypt) requires exactly 36 bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      const boxes = setupSBoxes(this._key);
      this._S1 = boxes[0];
      this._S2 = boxes[1];
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
        output.push(...(this.isInverse ? coreDecrypt(block, this._S1, this._S2) : coreEncrypt(block, this._S1, this._S2)));
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptNSEAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptNSEAAlgorithm, DarkCryptNSEAInstance };
}));
