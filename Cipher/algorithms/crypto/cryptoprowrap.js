/*
 * CryptoPro Key Wrap Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * RFC 4357 Section 6.5 - CryptoPro KEK Diversification Algorithm
 * Russian cryptographic standard variant of GOST 28147-89 key wrapping
 *
 * Reference: Bouncy Castle CryptoProWrapEngine.java
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
    CryptoAlgorithm,
    IAlgorithmInstance,
    KeySize,
    LinkItem,
    Vulnerability
  } = AlgorithmFramework;

  /** @type {int32} */
  const BLOCK_SIZE = 8;
  /** @type {int32} */
  const KEY_BYTES = 32;
  /** @type {int32} */
  const UKM_SIZE = 8; // User Key Material size
  /** @type {int32} */
  const MAC_SIZE = 4; // MAC output size (4 bytes)

  // CryptoPro S-box (E-A standard S-box used in Russian cryptography)
  /** @type {uint8[]} */
  const CRYPTOPRO_SBOX = [
    0x9,0x6,0x3,0x2,0x8,0xB,0x1,0x7,0xA,0x4,0xE,0xF,0xC,0x0,0xD,0x5,
    0x3,0x7,0xE,0x9,0x8,0xA,0xF,0x0,0x5,0x2,0x6,0xC,0xB,0x4,0xD,0x1,
    0xE,0x4,0x6,0x2,0xB,0x3,0xD,0x8,0xC,0xF,0x5,0xA,0x0,0x7,0x1,0x9,
    0xE,0x7,0xA,0xC,0xD,0x1,0x3,0x9,0x0,0x2,0xB,0x4,0xF,0x8,0x5,0x6,
    0xB,0x5,0x1,0x9,0x8,0xD,0xF,0x0,0xE,0x4,0x2,0x3,0xC,0x7,0xA,0x6,
    0x3,0xA,0xD,0xC,0x1,0x2,0x0,0xB,0x7,0x5,0x9,0x4,0x8,0xF,0xE,0x6,
    0x1,0xD,0x2,0x9,0x7,0xA,0x6,0x0,0x8,0xC,0x4,0x5,0xF,0x3,0xB,0xE,
    0xB,0xA,0xF,0x5,0x0,0xC,0xE,0x8,0x6,0x2,0x3,0x9,0x1,0x7,0xD,0x4
  ];

  // GCFB constant 'C' from RFC 4357
  /** @type {uint8[]} */
  const GCFB_C = [
    0x69, 0x00, 0x72, 0x22, 0x64, 0xC9, 0x04, 0x23,
    0x8D, 0x3A, 0xDB, 0x96, 0x46, 0xE9, 0x2A, 0xC4,
    0x18, 0xFE, 0xAC, 0x94, 0x00, 0xED, 0x07, 0x12,
    0xC0, 0x86, 0xDC, 0xC2, 0xEF, 0x4C, 0xA9, 0x2B
  ];

  /**
   * GOST 28147-89 cipher core functions
   */
  class GOSTCipher {
    /**
     * @param {uint8[]|null} sbox - 8 x 16 S-box table, or null for the CryptoPro S-box
     */
    constructor(sbox) {
      /** @type {uint8[]} */
      this.sbox = sbox ? sbox : CRYPTOPRO_SBOX;
      /** @type {uint32[]|null} */
      this.workingKey = null;
    }

    /**
     * @param {uint8[]} keyBytes - 32-byte key
     * @returns {void}
     */
    init(keyBytes) {
      /** @type {uint32[]} */
      const words = new Uint32Array(8);
      for (let i = 0; i < 8; i++) {
        /** @type {int32} */
        const offset = i * 4;
        words[i] = OpCodes.Pack32LE(
          keyBytes[offset],
          keyBytes[offset + 1],
          keyBytes[offset + 2],
          keyBytes[offset + 3]
        );
      }
      this.workingKey = words;
    }

    /**
     * One 4-bit S-box lookup, placed at its nibble position
     * @param {int32} box - S-box index 0..7
     * @param {uint32} cm - Round input
     * @returns {uint32} Substituted nibble shifted into place
     */
    _sub(box, cm) {
      /** @type {int32} */
      const nibble = OpCodes.And32(OpCodes.Shr32(cm, box * 4), 0xF);
      return OpCodes.Shl32(this.sbox[box * 16 + nibble], box * 4);
    }

    /**
     * GOST round function
     * @param {uint32} n1 - Half block
     * @param {uint32} keyWord - Round key word
     * @returns {uint32} f(n1 + key)
     */
    _mainStep(n1, keyWord) {
      // Add key modulo 2^32
      /** @type {uint32} */
      const cm = OpCodes.Add32(n1, keyWord);

      // S-box substitution (8 x 4-bit S-boxes, each in its own nibble)
      /** @type {uint32} */
      let om = 0;
      for (let box = 0; box < 8; box++) {
        om = OpCodes.Or32(om, this._sub(box, cm));
      }

      // 11-bit left rotation
      return OpCodes.RotL32(om, 11);
    }

    /**
     * Encrypt one block
     * @param {uint8[]} input - Source buffer
     * @param {int32} inOff - Offset of the block
     * @param {uint8[]} output - Target buffer
     * @param {int32} outOff - Offset the block is written to
     * @returns {void}
     */
    encryptBlock(input, inOff, output, outOff) {
      /** @type {uint32[]} */
      const k = this.workingKey;
      /** @type {uint32} */
      let N1 = OpCodes.Pack32LE(input[inOff], input[inOff + 1], input[inOff + 2], input[inOff + 3]);
      /** @type {uint32} */
      let N2 = OpCodes.Pack32LE(input[inOff + 4], input[inOff + 5], input[inOff + 6], input[inOff + 7]);

      // 32 rounds (3 full cycles forward + 1 reverse cycle)
      // Forward rounds: 3 cycles of 8 subkeys
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let j = 0; j < 8; j++) {
          /** @type {uint32} */
          const tmp = N1;
          N1 = OpCodes.Xor32(N2, this._mainStep(N1, k[j]));
          N2 = tmp;
        }
      }

      // Final reverse round: 8 subkeys in reverse order
      for (let j = 7; j >= 0; j--) {
        /** @type {uint32} */
        const tmp = N1;
        N1 = OpCodes.Xor32(N2, this._mainStep(N1, k[j]));
        N2 = tmp;
      }

      // Write output (little-endian)
      /** @type {uint8[]} */
      const leftBytes = OpCodes.Unpack32LE(N2);
      /** @type {uint8[]} */
      const rightBytes = OpCodes.Unpack32LE(N1);
      for (let i = 0; i < 4; i++) {
        output[outOff + i] = leftBytes[i];
        output[outOff + i + 4] = rightBytes[i];
      }
    }

    /**
     * Decrypt one block
     * @param {uint8[]} input - Source buffer
     * @param {int32} inOff - Offset of the block
     * @param {uint8[]} output - Target buffer
     * @param {int32} outOff - Offset the block is written to
     * @returns {void}
     */
    decryptBlock(input, inOff, output, outOff) {
      /** @type {uint32[]} */
      const k = this.workingKey;
      /** @type {uint32} */
      let N1 = OpCodes.Pack32LE(input[inOff], input[inOff + 1], input[inOff + 2], input[inOff + 3]);
      /** @type {uint32} */
      let N2 = OpCodes.Pack32LE(input[inOff + 4], input[inOff + 5], input[inOff + 6], input[inOff + 7]);

      // Forward round first
      for (let j = 0; j < 8; j++) {
        /** @type {uint32} */
        const tmp = N1;
        N1 = OpCodes.Xor32(N2, this._mainStep(N1, k[j]));
        N2 = tmp;
      }

      // Then 3 reverse cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let j = 7; j >= 0; j--) {
          /** @type {uint32} */
          const tmp = N1;
          N1 = OpCodes.Xor32(N2, this._mainStep(N1, k[j]));
          N2 = tmp;
        }
      }

      // Write output (little-endian)
      /** @type {uint8[]} */
      const leftBytes = OpCodes.Unpack32LE(N2);
      /** @type {uint8[]} */
      const rightBytes = OpCodes.Unpack32LE(N1);
      for (let i = 0; i < 4; i++) {
        output[outOff + i] = leftBytes[i];
        output[outOff + i + 4] = rightBytes[i];
      }
    }
  }

  /**
   * GOST 28147-89 MAC
   */
  class GOSTMAC {
    /**
     * @param {uint8[]|null} sbox - S-box table, or null for the CryptoPro S-box
     */
    constructor(sbox) {
      /** @type {GOSTCipher} */
      this.cipher = new GOSTCipher(sbox);
      /** @type {uint8[]} */
      this.mac = OpCodes.CreateArray(BLOCK_SIZE, 0);
      /** @type {uint8[]} */
      this.buf = OpCodes.CreateArray(BLOCK_SIZE, 0);
      /** @type {int32} */
      this.bufOff = 0;
      /** @type {boolean} */
      this.firstStep = true;
      /** @type {uint8[]|null} */
      this.macIV = null;
    }

    /**
     * @param {uint8[]} keyBytes - 32-byte key
     * @param {uint8[]|null} ivBytes - 8-byte IV (UKM), or null
     * @returns {void}
     */
    init(keyBytes, ivBytes) {
      this.cipher.init(keyBytes);
      this.macIV = ivBytes ? Array.from(ivBytes) : null;
      this.reset();
    }

    /**
     * @param {uint8[]} data - Data
     * @param {int32} offset - First byte to process
     * @param {int32} length - Number of bytes
     * @returns {void}
     */
    update(data, offset, length) {
      if (!data || length === 0) return;

      /** @type {int32} */
      let len = length;
      /** @type {int32} */
      let inOff = offset;
      /** @type {int32} */
      const gapLen = BLOCK_SIZE - this.bufOff;

      if (len > gapLen) {
        // Fill buffer
        for (let i = 0; i < gapLen; i++) {
          this.buf[this.bufOff + i] = OpCodes.And32(data[inOff + i], 0xFF);
        }

        this._processBlock();
        this.bufOff = 0;
        len -= gapLen;
        inOff += gapLen;

        // Process full blocks
        while (len > BLOCK_SIZE) {
          for (let i = 0; i < BLOCK_SIZE; i++) {
            this.buf[i] = OpCodes.And32(data[inOff + i], 0xFF);
          }
          this._processBlock();
          len -= BLOCK_SIZE;
          inOff += BLOCK_SIZE;
        }
      }

      // Copy remaining
      for (let i = 0; i < len; i++) {
        this.buf[this.bufOff + i] = OpCodes.And32(data[inOff + i], 0xFF);
      }
      this.bufOff += len;
    }

    /**
     * @param {uint8[]} output - Target buffer
     * @param {int32} outOff - Offset the MAC is written to
     * @returns {int32} MAC size
     */
    doFinal(output, outOff) {
      // Pad with zeros
      while (this.bufOff < BLOCK_SIZE) {
        this.buf[this.bufOff++] = 0;
      }

      /** @type {uint8[]} */
      const sum = new Array(BLOCK_SIZE);
      if (this.firstStep) {
        this.firstStep = false;
        for (let i = 0; i < BLOCK_SIZE; i++) {
          sum[i] = this.buf[i];
        }
      } else {
        for (let i = 0; i < BLOCK_SIZE; i++) {
          sum[i] = OpCodes.And32(OpCodes.Xor32(this.buf[i], this.mac[i]), 0xFF);
        }
      }

      // Encrypt final block
      this.cipher.encryptBlock(sum, 0, this.mac, 0);

      // Extract MAC (first 4 bytes from middle)
      /** @type {int32} */
      const startPos = (BLOCK_SIZE / 2) - MAC_SIZE;
      for (let i = 0; i < MAC_SIZE; i++) {
        output[outOff + i] = this.mac[startPos + i];
      }

      this.reset();
      return MAC_SIZE;
    }

    /**
     * @returns {void}
     */
    _processBlock() {
      /** @type {uint8[]} */
      const sum = new Array(BLOCK_SIZE);

      if (this.firstStep) {
        this.firstStep = false;
        if (this.macIV !== null) {
          for (let i = 0; i < BLOCK_SIZE; i++) {
            sum[i] = OpCodes.And32(OpCodes.Xor32(this.buf[i], this.macIV[i]), 0xFF);
          }
        } else {
          for (let i = 0; i < BLOCK_SIZE; i++) {
            sum[i] = this.buf[i];
          }
        }
      } else {
        for (let i = 0; i < BLOCK_SIZE; i++) {
          sum[i] = OpCodes.And32(OpCodes.Xor32(this.buf[i], this.mac[i]), 0xFF);
        }
      }

      this.cipher.encryptBlock(sum, 0, this.mac, 0);
    }

    /**
     * @returns {void}
     */
    reset() {
      this.buf.fill(0);
      this.mac.fill(0);
      this.bufOff = 0;
      this.firstStep = true;
    }
  }

  /**
   * RFC 4357 Section 6.5 - CryptoPro KEK Diversification Algorithm
   *
   * Given a random 64-bit UKM and a GOST 28147-89 key K, this algorithm
   * creates a new GOST 28147-89 key K(UKM).
   * @param {uint8[]} K - 32-byte key
   * @param {uint8[]} ukm - 8-byte UKM
   * @param {uint8[]} sbox - S-box table
   * @returns {uint8[]} Diversified key
   */
  function cryptoProDiversify(K, ukm, sbox) {
    // K is modified in place through 8 iterations
    /** @type {uint8[]} */
    const keyBytes = Array.from(K);
    /** @type {GOSTCipher} */
    const cipher = new GOSTCipher(sbox);

    for (let i = 0; i < 8; i++) {
      // Calculate S[i] vector
      /** @type {uint32} */
      let sOn = 0;
      /** @type {uint32} */
      let sOff = 0;

      for (let j = 0; j < 8; j++) {
        /** @type {uint32} */
        const kj = OpCodes.Pack32LE(
          keyBytes[j * 4],
          keyBytes[j * 4 + 1],
          keyBytes[j * 4 + 2],
          keyBytes[j * 4 + 3]
        );

        // Check if bit j of ukm[i] is set
        if (OpCodes.And32(ukm[i], OpCodes.Shl32(1, j)) !== 0) {
          sOn = OpCodes.Add32(sOn, kj);
        } else {
          sOff = OpCodes.Add32(sOff, kj);
        }
      }

      // Create S[i] = sOn|sOff (8 bytes)
      /** @type {uint8[]} */
      const s = new Array(8);
      /** @type {uint8[]} */
      const sOnBytes = OpCodes.Unpack32LE(sOn);
      /** @type {uint8[]} */
      const sOffBytes = OpCodes.Unpack32LE(sOff);
      for (let j = 0; j < 4; j++) {
        s[j] = sOnBytes[j];
        s[j + 4] = sOffBytes[j];
      }

      // K[i+1] = encryptCFB(S[i], K[i], K[i])
      // According to RFC 4357, this uses GCFB (GOST CFB) mode
      // The key is encrypted using itself with S[i] as IV
      cipher.init(keyBytes);

      // GCFB encrypts the key using itself: processBlock(K, K) with IV=S
      // We need to XOR the key with encrypted S values
      /** @type {uint8[]} */
      const tempKey = new Array(KEY_BYTES);
      for (let block = 0; block < 4; block++) {
        /** @type {int32} */
        const blockOffset = block * BLOCK_SIZE;

        // Encrypt S[i] (or previous ciphertext for CFB chaining)
        /** @type {uint8[]} */
        const iv = new Array(BLOCK_SIZE);
        if (block === 0) {
          // First block uses S as IV
          for (let j = 0; j < BLOCK_SIZE; j++) {
            iv[j] = s[j];
          }
        } else {
          // Subsequent blocks use previous ciphertext as IV
          for (let j = 0; j < BLOCK_SIZE; j++) {
            iv[j] = tempKey[blockOffset - BLOCK_SIZE + j];
          }
        }

        // Encrypt the IV
        /** @type {uint8[]} */
        const encryptedIV = new Array(BLOCK_SIZE);
        cipher.encryptBlock(iv, 0, encryptedIV, 0);

        // XOR with key block to produce ciphertext
        for (let j = 0; j < BLOCK_SIZE; j++) {
          tempKey[blockOffset + j] = OpCodes.And32(OpCodes.Xor32(keyBytes[blockOffset + j], encryptedIV[j]), 0xFF);
        }
      }

      // Copy temp key back
      for (let j = 0; j < KEY_BYTES; j++) {
        keyBytes[j] = tempKey[j];
      }
    }

    return keyBytes;
  }

  class CryptoProWrapAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      this.name = "CryptoPro Key Wrap";
      this.description = "Russian GOST 28147-89 based key wrapping with RFC 4357 key diversification. Uses CryptoPro S-box and optional MAC for integrity.";
      this.inventor = "CryptoPro (Russian cryptographic standard)";
      this.year = 2006;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [
        new KeySize(KEY_BYTES, KEY_BYTES, 0)
      ];
      this.SupportedBlockSizes = [
        new KeySize(32, 32, 0) // Wraps 32-byte keys
      ];

      this.documentation = [
        new LinkItem("RFC 4357 - Additional Cryptographic Algorithms for GOST 28147-89", "https://www.rfc-editor.org/rfc/rfc4357"),
        new LinkItem("GOST 28147-89 Standard (TC26)", "https://www.tc26.ru/en/standard/gost/")
      ];

      this.references = [
        new LinkItem("Bouncy Castle CryptoProWrapEngine.java", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/CryptoProWrapEngine.java"),
        new LinkItem("RFC 4357 Section 6.5 - KEK Diversification", "https://www.rfc-editor.org/rfc/rfc4357#section-6.5")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Deprecated standard",
          "GOST 28147-89 has been superseded by newer Russian cryptographic standards.",
          "Use modern key wrap algorithms like AES Key Wrap (RFC 3394) for new applications."
        ),
        new Vulnerability(
          "S-box dependency",
          "Security depends on the CryptoPro S-box parameter set.",
          "Always use the standardized CryptoPro S-box (E-A)."
        )
      ];

      // Test vectors - validated with round-trip testing
      this.tests = [
        {
          text: "CryptoPro Wrap Test (Bouncy Castle compatible)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/CryptoProWrapEngine.java",
          input: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          key: OpCodes.Hex8ToBytes("546d203368656c326973652073736e62206167796967747473656865202c3d73"),
          ukm: OpCodes.Hex8ToBytes("1234567890abcdef"),
          // Expected output is 36 bytes: 32 bytes encrypted + 4 bytes MAC
          expected: OpCodes.Hex8ToBytes("0b45e8051b41a19ae67354da4e6249dc477444e855ce81375361fad40dbf659375d073f5")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {CryptoProWrapInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CryptoProWrapInstance(this, isInverse);
    }
  }

  /**
 * CryptoProWrap cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CryptoProWrapInstance extends IAlgorithmInstance {
    /**
     * @param {CryptoProWrapAlgorithm} algorithm - Parent algorithm instance
     * @param {boolean} isInverse - True to unwrap
     */
    constructor(algorithm, isInverse) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = !!isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._ukm = null;
      /** @type {GOSTCipher} */
      this.cipher = new GOSTCipher(CRYPTOPRO_SBOX);
      /** @type {GOSTMAC} */
      this.mac = new GOSTMAC(CRYPTOPRO_SBOX);
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== KEY_BYTES) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. CryptoPro Wrap requires 32 bytes (256 bits).");
      }

      this._key = Array.from(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? Array.from(this._key) : null;
    }

    /**
     * @param {uint8[]|null} ukmBytes - 8-byte User Key Material, or null to clear
     */
    set ukm(ukmBytes) {
      if (!ukmBytes || ukmBytes.length === 0) {
        this._ukm = null;
        return;
      }

      if (ukmBytes.length !== UKM_SIZE) {
        throw new Error("Invalid UKM size: " + ukmBytes.length + " bytes. Must be 8 bytes.");
      }

      this._ukm = Array.from(ukmBytes);
    }

    /**
     * @returns {uint8[]|null} Copy of the UKM or null
     */
    get ukm() {
      return this._ukm ? Array.from(this._ukm) : null;
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
      if (!this._ukm) {
        throw new Error("UKM (User Key Material) not set");
      }

      for (let i = 0; i < data.length; i++) {
        this.inputBuffer.push(OpCodes.And32(data[i], 0xFF));
      }
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
      if (!this._ukm) {
        throw new Error("UKM (User Key Material) not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      /** @type {uint8[]} */
      let output = [];

      if (this.isInverse) {
        // Unwrap
        output = this._unwrap(this.inputBuffer);
      } else {
        // Wrap
        output = this._wrap(this.inputBuffer);
      }

      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer.length = 0;

      return output;
    }

    /**
     * @param {uint8[]} input - 32-byte key
     * @returns {uint8[]} Encrypted key followed by the 4-byte MAC
     */
    _wrap(input) {
      if (input.length !== 32) {
        throw new Error("Invalid input size for wrapping: " + input.length + " bytes. Must be 32 bytes.");
      }

      // Apply key diversification (copy key first since diversify modifies in-place)
      /** @type {uint8[]} */
      const diversifiedKey = cryptoProDiversify(Array.from(this._key), this._ukm, CRYPTOPRO_SBOX);

      // Initialize cipher and MAC with diversified key
      this.cipher.init(diversifiedKey);
      this.mac.init(diversifiedKey, this._ukm);

      // Compute MAC over plaintext
      this.mac.update(input, 0, input.length);

      // Wrap: encrypt + append MAC
      /** @type {uint8[]} */
      const wrappedKey = new Array(input.length + MAC_SIZE);

      // Encrypt all blocks (4 blocks of 8 bytes each)
      this.cipher.encryptBlock(input, 0, wrappedKey, 0);
      this.cipher.encryptBlock(input, 8, wrappedKey, 8);
      this.cipher.encryptBlock(input, 16, wrappedKey, 16);
      this.cipher.encryptBlock(input, 24, wrappedKey, 24);

      // Append MAC
      this.mac.doFinal(wrappedKey, input.length);

      // Clear sensitive data
      OpCodes.ClearArray(diversifiedKey);

      return wrappedKey;
    }

    /**
     * @param {uint8[]} input - Encrypted key followed by the 4-byte MAC
     * @returns {uint8[]} 32-byte key
     */
    _unwrap(input) {
      if (input.length !== 36) {
        throw new Error("Invalid input size for unwrapping: " + input.length + " bytes. Must be 36 bytes (32 + 4 MAC).");
      }

      // Apply key diversification (copy key first since diversify modifies in-place)
      /** @type {uint8[]} */
      const diversifiedKey = cryptoProDiversify(Array.from(this._key), this._ukm, CRYPTOPRO_SBOX);

      // Initialize cipher and MAC with diversified key
      this.cipher.init(diversifiedKey);
      this.mac.init(diversifiedKey, this._ukm);

      // Decrypt all blocks
      /** @type {uint8[]} */
      const decryptedKey = new Array(32);
      this.cipher.decryptBlock(input, 0, decryptedKey, 0);
      this.cipher.decryptBlock(input, 8, decryptedKey, 8);
      this.cipher.decryptBlock(input, 16, decryptedKey, 16);
      this.cipher.decryptBlock(input, 24, decryptedKey, 24);

      // Compute MAC over decrypted data
      this.mac.update(decryptedKey, 0, decryptedKey.length);
      /** @type {uint8[]} */
      const macResult = new Array(MAC_SIZE);
      this.mac.doFinal(macResult, 0);

      // Extract expected MAC from input
      /** @type {uint8[]} */
      const macExpected = new Array(MAC_SIZE);
      for (let i = 0; i < MAC_SIZE; i++) {
        macExpected[i] = input[32 + i];
      }

      // Constant-time MAC comparison
      if (!OpCodes.ConstantTimeCompare(macResult, macExpected, MAC_SIZE)) {
        OpCodes.ClearArray(diversifiedKey);
        OpCodes.ClearArray(decryptedKey);
        throw new Error("MAC verification failed");
      }

      // Clear sensitive data
      OpCodes.ClearArray(diversifiedKey);

      return decryptedKey;
    }

    /**
     * Clear key material
     * @returns {void}
     */
    Dispose() {
      if (this._key) {
        OpCodes.ClearArray(this._key);
        this._key = null;
      }
      if (this._ukm) {
        OpCodes.ClearArray(this._ukm);
        this._ukm = null;
      }
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer.length = 0;
    }
  }

  const algorithmInstance = new CryptoProWrapAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { CryptoProWrapAlgorithm, CryptoProWrapInstance };
});
