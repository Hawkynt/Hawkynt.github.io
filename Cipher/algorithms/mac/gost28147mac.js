/*
 * GOST 28147-89 MAC Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * CBC-MAC construction using GOST 28147-89 block cipher.
 * Specified in GOST R 34.13-2015 (Russian cryptographic standard).
 *
 * Reference: Bouncy Castle GOST28147Mac.java
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["../../AlgorithmFramework", "../../OpCodes"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("../../AlgorithmFramework"),
      require("../../OpCodes")
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
})((function () {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof window !== "undefined") return window;
  if (typeof global !== "undefined") return global;
  if (typeof self !== "undefined") return self;
  throw new Error("Unable to locate global object");
})(), function (AlgorithmFramework, OpCodes) {
  "use strict";

  if (!AlgorithmFramework) {
    throw new Error("AlgorithmFramework dependency is required");
  }

  if (!OpCodes) {
    throw new Error("OpCodes dependency is required");
  }

  const {
    RegisterAlgorithm,
    CategoryType,
    SecurityStatus,
    ComplexityType,
    CountryCode,
    MacAlgorithm,
    IMacInstance,
    KeySize,
    LinkItem,
    Vulnerability
  } = AlgorithmFramework;

  const BLOCK_SIZE = 8;
  const KEY_BYTES = 32;
  const MAC_SIZE = 4; // Default MAC output size (4 bytes = 32 bits)

  // Default S-box (E-A / TestParam S-box used in Bouncy Castle)
  /** @type {uint8[]} */
  const DEFAULT_SBOX = [
    0x9,0x6,0x3,0x2,0x8,0xB,0x1,0x7,0xA,0x4,0xE,0xF,0xC,0x0,0xD,0x5,
    0x3,0x7,0xE,0x9,0x8,0xA,0xF,0x0,0x5,0x2,0x6,0xC,0xB,0x4,0xD,0x1,
    0xE,0x4,0x6,0x2,0xB,0x3,0xD,0x8,0xC,0xF,0x5,0xA,0x0,0x7,0x1,0x9,
    0xE,0x7,0xA,0xC,0xD,0x1,0x3,0x9,0x0,0x2,0xB,0x4,0xF,0x8,0x5,0x6,
    0xB,0x5,0x1,0x9,0x8,0xD,0xF,0x0,0xE,0x4,0x2,0x3,0xC,0x7,0xA,0x6,
    0x3,0xA,0xD,0xC,0x1,0x2,0x0,0xB,0x7,0x5,0x9,0x4,0x8,0xF,0xE,0x6,
    0x1,0xD,0x2,0x9,0x7,0xA,0x6,0x0,0x8,0xC,0x4,0x5,0xF,0x3,0xB,0xE,
    0xB,0xA,0xF,0x5,0x0,0xC,0xE,0x8,0x6,0x2,0x3,0x9,0x1,0x7,0xD,0x4
  ];

  class GOST28147MACAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      this.name = "GOST 28147-89 MAC";
      this.description = "CBC-MAC construction using GOST 28147-89 block cipher. Specified in GOST R 34.13-2015 for message authentication.";
      this.inventor = "Soviet/Russian standard committee";
      this.year = 1989;
      this.category = CategoryType.MAC;
      this.subCategory = "Block Cipher MAC";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedMacSizes = [
        new KeySize(4, 8, 4)  // 4 or 8 byte MAC output
      ];
      this.NeedsKey = true;

      this.documentation = [
        new LinkItem("GOST 28147-89 Standard (TC26)", "https://www.tc26.ru/en/standard/gost/"),
        new LinkItem("GOST R 34.13-2015 Modes of Operation", "https://www.tc26.ru/en/standard/gost/GOST_R_3413-2015.pdf"),
        new LinkItem("RFC 5830 - GOST 28147-89 Cipher Suites for TLS", "https://www.rfc-editor.org/rfc/rfc5830")
      ];

      this.references = [
        new LinkItem("Bouncy Castle GOST28147Mac.java", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/macs/GOST28147Mac.java"),
        new LinkItem("Crypto++ GOST Implementation", "https://github.com/weidai11/cryptopp/blob/master/gost.cpp")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Deprecated standard",
          "GOST 28147-89 has been superseded by newer Russian standards (Kuznyechik/Magma).",
          "Use modern MAC algorithms like CMAC with AES or HMAC-SHA256 for new applications."
        ),
        new Vulnerability(
          "S-box dependency",
          "Security depends on the selected S-box parameter set.",
          "Always use standardized S-box sets (E-A, CryptoPro, etc.)."
        )
      ];

      // Test vectors from Bouncy Castle GOST28147MacTest.java
      this.tests = [
        {
          text: "Bouncy Castle test vector 1 (E-A S-box)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/GOST28147MacTest.java",
          input: OpCodes.Hex8ToBytes("7768617420646f2079612077616e7420666f72206e6f7468696e673f"),
          key: OpCodes.Hex8ToBytes("6d145dc993f4019e104280df6fcd8cd8e01e101e4c113d7ec4f469ce6dcd9e49"),
          expected: OpCodes.Hex8ToBytes("93468a46")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // MAC cannot be reversed
      }
      return new GOST28147MACInstance(this);
    }
  }

  /**
 * GOST28147MAC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GOST28147MACInstance extends IMacInstance {
    /**
     * Initialize a GOST 28147-89 MAC instance
     * @param {GOST28147MACAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} */
      this._key = null;
      /** @type {uint32[]} */
      this.workingKey = null;
      /** @type {uint8[]} */
      this.sbox = DEFAULT_SBOX.slice(); // Copy default S-box
      /** @type {uint8[]} */
      this.mac = OpCodes.CreateArray(BLOCK_SIZE, 0); // MAC state (8 bytes)
      /** @type {uint8[]} */
      this.buf = OpCodes.CreateArray(BLOCK_SIZE, 0); // Input buffer (8 bytes)
      /** @type {int32} */
      this.bufOff = 0;
      /** @type {boolean} */
      this.firstStep = true;
      /** @type {int32} */
      this.macSize = MAC_SIZE; // Default 4-byte output
      /** @type {uint8[]} */
      this.macIV = null; // Optional initialization vector
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        this._key = null;
        this.workingKey = null;
        return;
      }

      if (keyBytes.length !== KEY_BYTES) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. GOST MAC requires 32 bytes (256 bits).");
      }

      this._key = Array.from(keyBytes);
      this.workingKey = this._generateWorkingKey(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? Array.from(this._key) : null;
    }

    // Additional property setters for MAC configuration
    /**
     * Select the MAC size
     * @param {int32} size - 4 or 8 bytes
     * @throws {Error} If size is neither
     */
    set outputSize(size) {
      if (size !== 4 && size !== 8) {
        throw new Error("Invalid MAC size: " + size + " bytes. Must be 4 or 8 bytes.");
      }
      this.macSize = size;
    }

    /**
     * MAC size in bytes
     * @returns {int32} MAC size in bytes
     */
    get outputSize() {
      return this.macSize;
    }

    /**
   * Set initialization vector
   * @param {uint8[]|null} ivBytes - IV bytes or null to clear
   * @throws {Error} If IV size is invalid
   */

    set iv(ivBytes) {
      if (!ivBytes || ivBytes.length === 0) {
        this.macIV = null;
        return;
      }
      if (ivBytes.length !== BLOCK_SIZE) {
        throw new Error("Invalid IV size: " + ivBytes.length + " bytes. Must be 8 bytes.");
      }
      this.macIV = Array.from(ivBytes);
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this.macIV ? Array.from(this.macIV) : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) {
        throw new Error("Key not set");
      }

      let len = data.length;
      let inOff = 0;
      const gapLen = BLOCK_SIZE - this.bufOff;

      if (len > gapLen) {
        // Fill remaining buffer space
        for (let i = 0; i < gapLen; i++) {
          this.buf[this.bufOff + i] = OpCodes.ToByte(data[inOff + i]);
        }

        // Process full block
        this._processBlock();

        this.bufOff = 0;
        len -= gapLen;
        inOff += gapLen;

        // Process full blocks directly from input
        while (len > BLOCK_SIZE) {
          for (let i = 0; i < BLOCK_SIZE; i++) {
            this.buf[i] = OpCodes.ToByte(data[inOff + i]);
          }
          this._processBlock();
          len -= BLOCK_SIZE;
          inOff += BLOCK_SIZE;
        }
      }

      // Copy remaining data to buffer
      for (let i = 0; i < len; i++) {
        this.buf[this.bufOff + i] = OpCodes.ToByte(data[inOff + i]);
      }
      this.bufOff += len;
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Pad final block with zeros
      while (this.bufOff < BLOCK_SIZE) {
        this.buf[this.bufOff++] = 0;
      }

      // Process final block
      /** @type {uint8[]} */
      const sum = new Array(BLOCK_SIZE);
      if (this.firstStep) {
        this.firstStep = false;
        for (let i = 0; i < BLOCK_SIZE; i++) {
          sum[i] = this.buf[i];
        }
      } else {
        this._CM5func(this.buf, 0, this.mac, sum);
      }

      this._gost28147MacFunc(sum, this.mac);

      // Extract MAC bytes: take from middle of final block
      // Bouncy Castle uses: mac[(mac.length/2)-MAC_SIZE] to mac[mac.length/2]
      // For 8-byte block with 4-byte MAC: mac[0..3] (first 4 bytes)
      /** @type {uint8[]} */
      const macResult = new Array(this.macSize);
      const startPos = (BLOCK_SIZE / 2) - MAC_SIZE; // Position 0 for 4-byte MAC
      for (let i = 0; i < this.macSize; i++) {
        macResult[i] = this.mac[startPos + i];
      }

      // Reset for next MAC computation
      this._reset();

      return macResult;
    }

    /**
     * Compute the MAC of a whole message, discarding any buffered state
     * @param {uint8[]} data - Message bytes
     * @returns {uint8[]} MAC bytes
     * @throws {Error} If key not set
     */
    ComputeMac(data) {
      if (!this._key) {
        throw new Error("Key not set");
      }

      this._reset();
      this.Feed(data);
      return this.Result();
    }

    // GOST 28147-89 MAC internal functions

    /**
     * Load the 256-bit key as eight little-endian 32-bit subkeys
     * @param {uint8[]} userKey - 32-byte key
     * @returns {uint32[]} Subkeys K0..K7
     */
    _generateWorkingKey(userKey) {
      /** @type {uint32[]} */
      const key = new Uint32Array(8);
      for (let i = 0; i < 8; i++) {
        const offset = i * 4;
        key[i] = OpCodes.Pack32LE(
          userKey[offset],
          userKey[offset + 1],
          userKey[offset + 2],
          userKey[offset + 3]
        );
      }
      return key;
    }

    /**
     * GOST round function: S-boxes over n1 + key, rotated left by 11
     * @param {uint32} n1 - Right half
     * @param {uint32} keyWord - Round subkey
     * @returns {uint32} Round function output
     */
    _gost28147_mainStep(n1, keyWord) {
      // CM1: Add key
      const cm = OpCodes.Add32(n1, keyWord);

      // S-box substitution (8 x 4-bit S-boxes); the nibbles land in disjoint
      // positions, so combining them with OR is the same as adding them
      /** @type {uint32} */
      let om = 0;
      for (let i = 0; i < 8; i++) {
        /** @type {int32} */
        const nibble = OpCodes.And32(OpCodes.Shr32(cm, i * 4), 0xF);
        om = OpCodes.Or32(om, OpCodes.Shl32(this.sbox[i * 16 + nibble], i * 4));
      }

      // 11-bit left rotation
      return OpCodes.RotL32(om, 11);
    }

    /**
     * 16 GOST rounds over one block (the MAC's reduced encryption)
     * @param {uint8[]} inBlock - 8-byte input block
     * @param {uint8[]} outBlock - Receives the 8-byte result
     * @returns {void}
     */
    _gost28147MacFunc(inBlock, outBlock) {
      let N1 = OpCodes.Pack32LE(inBlock[0], inBlock[1], inBlock[2], inBlock[3]);
      let N2 = OpCodes.Pack32LE(inBlock[4], inBlock[5], inBlock[6], inBlock[7]);

      // 16 rounds (2 cycles of 8 subkeys)
      for (let k = 0; k < 2; k++) {
        for (let j = 0; j < 8; j++) {
          const tmp = N1;
          N1 = OpCodes.ToUint32(OpCodes.Xor32(N2, this._gost28147_mainStep(N1, this.workingKey[j])));
          N2 = tmp;
        }
      }

      // Write result to output block (little-endian)
      const leftBytes = OpCodes.Unpack32LE(N1);
      const rightBytes = OpCodes.Unpack32LE(N2);
      for (let i = 0; i < 4; i++) {
        outBlock[i] = leftBytes[i];
        outBlock[i + 4] = rightBytes[i];
      }
    }

    /**
     * sum = buf[bufOff..] xor mac for one block
     * @param {uint8[]} buf - Input bytes
     * @param {int32} bufOff - Offset into buf
     * @param {uint8[]} mac - Chaining value (or IV)
     * @param {uint8[]} sum - Receives the block
     * @returns {void}
     */
    _CM5func(buf, bufOff, mac, sum) {
      // XOR input block with MAC state
      for (let i = 0; i < BLOCK_SIZE; i++) {
        sum[i] = OpCodes.Xor8(buf[bufOff + i], mac[i]);
      }
    }

    /**
     * Absorb the full buffer block
     * @returns {void}
     */
    _processBlock() {
      /** @type {uint8[]} */
      const sum = new Array(BLOCK_SIZE);

      if (this.firstStep) {
        this.firstStep = false;
        if (this.macIV !== null) {
          // XOR with IV on first block
          this._CM5func(this.buf, 0, this.macIV, sum);
        } else {
          // No IV: just copy input
          for (let i = 0; i < BLOCK_SIZE; i++) {
            sum[i] = this.buf[i];
          }
        }
      } else {
        // CBC-MAC: XOR with previous MAC state
        this._CM5func(this.buf, 0, this.mac, sum);
      }

      // Encrypt XORed block
      this._gost28147MacFunc(sum, this.mac);
    }

    /**
     * Clear buffer and chaining state
     * @returns {void}
     */
    _reset() {
      // Clear buffer and state
      this.buf.fill(0);
      this.mac.fill(0);
      this.bufOff = 0;
      this.firstStep = true;
    }
  }

  // Register the algorithm
  const algorithmInstance = new GOST28147MACAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { GOST28147MACAlgorithm, GOST28147MACInstance };
});
