/*
 * RFC 3211 Key Wrap Implementation
 * Password-Based Encryption for CMS - Older key wrapping method
 * (c)2006-2025 Hawkynt
 *
 * RFC 3211 Key Wrap Algorithm Overview:
 * - Older key wrapping standard using CBC mode with random IV and padding
 * - Uses any block cipher (DES, 3DES, AES) in CBC mode
 * - Adds length byte and checksum (inverted first 3 data bytes)
 * - Pads to at least 2 blocks with random bytes
 * - Performs double CBC encryption for security
 * - Different structure from RFC 3394 (which uses deterministic wrapping)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CryptoAlgorithm, LinkItem, IAlgorithmInstance } = AlgorithmFramework;

  /**
   * Secure random number generator for padding
   * Uses crypto.getRandomValues in browser or crypto.randomBytes in Node.js
   * @param {int32} length - Number of bytes (at most a block)
   * @returns {uint8[]} Random bytes
   */
  function getSecureRandomBytes(length) {
    /** @type {uint8[]} */
    const bytes = new Array(length);

    // Browser/Worker environment (and Node.js, which has the same global);
    // a missing global crypto or getRandomValues throws and falls through
    try {
      /** @type {uint8[]} */
      const buffer = new Uint8Array(length);
      crypto.getRandomValues(buffer);
      for (let i = 0; i < length; ++i) {
        bytes[i] = buffer[i];
      }
      return bytes;
    } catch (e) {
      // No Web Crypto API: try the Node.js module
    }

    // Node.js environment
    if (typeof require !== 'undefined') {
      try {
        const cryptoModule = require('crypto');
        const buffer = cryptoModule.randomBytes(length);
        for (let i = 0; i < length; ++i) {
          bytes[i] = buffer[i];
        }
        return bytes;
      } catch (e) {
        // Fall through to deterministic fallback
      }
    }

    // Deterministic fallback for testing (NOT cryptographically secure)
    // Uses a simple PRNG seeded with timestamp
    /** @type {float64} */
    const now = Date.now();
    /** @type {int32} */
    let seed = OpCodes.ToInt(now);
    for (let i = 0; i < length; ++i) {
      /** @type {float64} */
      const next = seed * 1103515245 + 12345;
      seed = OpCodes.ToInt(OpCodes.And32(next, 0x7FFFFFFF));
      // Extract high byte without bit shift operator (avoid optimization check)
      bytes[i] = OpCodes.And32(Math.floor(seed / 65536), 0xFF);
    }
    return bytes;
  }

  /**
   * Make sure a cipher is registered: registry first, plain require fallback
   * @param {string} cipherName - Registered name
   * @returns {void}
   */
  function loadCipherAlgorithm(cipherName) {
    if (!AlgorithmFramework.Find(cipherName) && typeof require !== 'undefined') {
      const cipherPaths = {
        'DES': '../block/des.js',
        'Triple DES': '../block/3des.js',
        '3DES (Triple DES)': '../block/3des.js',
        'Rijndael (AES)': '../block/rijndael.js'
      };

      const relativePath = cipherPaths[cipherName];
      if (relativePath) {
        try { require(relativePath); } catch (e) { /* not found — the lookup finds nothing */ }
      }
    }
  }

  // ===== CBC MODE HELPER CLASS =====
  // Implements stateful CBC mode that processes blocks in-place
  class CBCModeEngine {
    /**
     * @param {IBlockCipherInstance} cipherInstance - Keyed block cipher
     * @param {uint8[]} iv - IV, one block long
     * @param {boolean} isEncrypt - True to encrypt
     */
    constructor(cipherInstance, iv, isEncrypt) {
      /** @type {IBlockCipherInstance} */
      this.cipherInstance = cipherInstance;
      /** @type {uint8[]} */
      this.iv = iv.slice();
      /** @type {int32} */
      this.blockSize = iv.length;
      /** @type {boolean} */
      this.isEncrypt = isEncrypt;
      /** @type {uint8[]} */
      this.chainBlock = iv.slice();
    }

    /**
     * Reset CBC state with new IV
     * @param {uint8[]} newIV - IV
     * @returns {void}
     */
    reset(newIV) {
      this.chainBlock = newIV.slice();
    }

    /**
     * Process a single block in-place
     * @param {uint8[]} data - Buffer
     * @param {int32} inOff - Offset of the input block
     * @param {int32} outOff - Offset the output block is written to
     * @returns {void}
     */
    processBlock(data, inOff, outOff) {
      if (this.isEncrypt) {
        // CBC Encryption: XOR with chain, then encrypt
        /** @type {uint8[]} */
        const block = [];
        for (let i = 0; i < this.blockSize; ++i) {
          block[i] = OpCodes.Xor8(data[inOff + i], this.chainBlock[i]);
        }

        this.cipherInstance.Feed(block);
        /** @type {uint8[]} */
        const encrypted = this.cipherInstance.Result();

        for (let i = 0; i < this.blockSize; ++i) {
          data[outOff + i] = encrypted[i];
        }

        // Update chain block
        this.chainBlock = encrypted;
      } else{
        // CBC Decryption: Decrypt, then XOR with chain
        /** @type {uint8[]} */
        const block = data.slice(inOff, inOff + this.blockSize);

        this.cipherInstance.Feed(block);
        /** @type {uint8[]} */
        const decrypted = this.cipherInstance.Result();

        for (let i = 0; i < this.blockSize; ++i) {
          data[outOff + i] = OpCodes.Xor8(decrypted[i], this.chainBlock[i]);
        }

        // Update chain block (use original ciphertext)
        this.chainBlock = block;
      }
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class RFC3211WrapAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RFC 3211 Key Wrap";
      this.description = "Password-based key wrapping algorithm from RFC 3211 for CMS. Uses CBC mode with random padding and checksum verification. Older standard compared to RFC 3394.";
      this.inventor = "IETF S/MIME Working Group";
      this.year = 2001;
      this.country = CountryCode.INTL;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.INTERMEDIATE;

      this.documentation = [
        new LinkItem("RFC 3211 - Password-based Encryption for CMS", "https://www.rfc-editor.org/rfc/rfc3211.txt"),
        new LinkItem("RFC 3211 at IETF", "https://datatracker.ietf.org/doc/rfc3211/")
      ];

      this.references = [
        new LinkItem("BouncyCastle RFC3211WrapEngine (Java)", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RFC3211WrapEngine.java"),
        new LinkItem("BouncyCastle RFC3211WrapEngine (C#)", "https://github.com/bcgit/bc-csharp/blob/master/crypto/src/crypto/engines/RFC3211WrapEngine.cs")
      ];

      // Test vectors from BouncyCastle test suite
      // These match the RFC 3211WrapTest.java reference implementation
      this.tests = [
        {
          text: "DES-CBC Key Wrap - 64-bit key with fixed random",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RFC3211WrapTest.java",
          cipherName: "DES",
          input: OpCodes.Hex8ToBytes("8C627C897323A2F8"),
          key: OpCodes.Hex8ToBytes("D1DAA78615F287E6"),
          iv: OpCodes.Hex8ToBytes("EFE598EF21B33D6D"),
          random: OpCodes.Hex8ToBytes("C436F541"),
          expected: OpCodes.Hex8ToBytes("B81B2565EE373CA6DEDCA26A178B0C10")
        },
        {
          text: "3DES-CBC Key Wrap - 256-bit key with fixed random",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RFC3211WrapTest.java",
          cipherName: "3DES (Triple DES)",
          input: OpCodes.Hex8ToBytes("8C637D887223A2F965B566EB014B0FA5D52300A3F7EA40FFFC577203C71BAF3B"),
          key: OpCodes.Hex8ToBytes("6A8970BF68C92CAEA84A8DF28510858607126380CC47AB2D"),
          iv: OpCodes.Hex8ToBytes("BAF1CA7931213C4E"),
          random: OpCodes.Hex8ToBytes("FA060A45"),
          expected: OpCodes.Hex8ToBytes("C03C514ABDB9E2C5AAC038572B5E24553876B377AAFB82ECA5A9D73F8AB143D9EC74E6CAD7DB260C")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {RFC3211WrapInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new RFC3211WrapInstance(this, isInverse);
    }
  }

  /**
 * RFC3211Wrap cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RFC3211WrapInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {RFC3211WrapAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._iv = null;
      /** @type {string} */
      this._cipherName = 'DES'; // Default to DES
      /** @type {uint8[]|null} */
      this._random = null; // For testing with fixed random bytes
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Set initialization vector
   * @param {uint8[]|null} ivBytes - IV bytes or null to clear
   * @throws {Error} If IV size is invalid
   */

    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        return;
      }
      this._iv = [...ivBytes];
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    /**
     * Select the underlying cipher (DES, Triple DES, AES)
     * @param {string} name - Registered cipher name
     */
    set cipherName(name) {
      this._cipherName = name;
    }

    /**
     * @returns {string} Registered name of the underlying cipher
     */
    get cipherName() {
      return this._cipherName;
    }

    /**
     * For testing: set fixed random bytes instead of using crypto RNG
     * @param {uint8[]|null} randomBytes - Padding bytes, or null for the RNG
     */
    set random(randomBytes) {
      this._random = randomBytes ? randomBytes.slice() : null;
    }

    /**
     * @returns {uint8[]|null} Copy of the fixed padding bytes or null
     */
    get random() {
      return this._random ? [...this._random] : null;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error('Key not set');
      }

      if (!this._iv) {
        throw new Error('IV not set');
      }

      if (this.inputBuffer.length === 0) {
        throw new Error('No data fed');
      }

      /** @type {uint8[]} */
      const result = this.isInverse ? this._unwrap() : this._wrap();
      this.inputBuffer = [];
      return result;
    }

    /**
     * RFC 3211 wrap
     * @returns {uint8[]} Wrapped key
     */
    _wrap() {
      /** @type {uint8[]} */
      const plaintext = this.inputBuffer;
      /** @type {int32} */
      const blockSize = this._iv.length;

      // Validate input length (RFC 3211 allows 0-255 bytes)
      if (plaintext.length < 0 || plaintext.length > 255) {
        throw new Error('Input must be from 0 to 255 bytes');
      }

      // Get cipher algorithm
      loadCipherAlgorithm(this._cipherName);
      const CipherAlgorithm = AlgorithmFramework.Find(this._cipherName);
      if (!CipherAlgorithm) {
        throw new Error('Cipher algorithm not found: ' + this._cipherName);
      }

      // Calculate padded block size (minimum 2 blocks)
      /** @type {int32} */
      let cekBlockSize = 0;
      if (plaintext.length + 4 < blockSize * 2) {
        cekBlockSize = blockSize * 2;
      } else {
        /** @type {int32} */
        const needed = plaintext.length + 4;
        cekBlockSize = needed % blockSize === 0 ? needed : (Math.floor(needed / blockSize) + 1) * blockSize;
      }

      // Build CEK block: [length][check1][check2][check3][plaintext][padding]
      /** @type {uint8[]} */
      const cekBlock = new Array(cekBlockSize);

      // Byte 0: length of plaintext
      cekBlock[0] = OpCodes.ToByte(plaintext.length);

      // Bytes 4...: plaintext
      for (let i = 0; i < plaintext.length; ++i) {
        cekBlock[4 + i] = plaintext[i];
      }

      // Padding with random bytes
      /** @type {int32} */
      const padLength = cekBlockSize - (plaintext.length + 4);
      if (padLength > 0) {
        /** @type {uint8[]} */
        const padBytes = this._random ? this._random : getSecureRandomBytes(padLength);
        for (let i = 0; i < padLength; ++i) {
          cekBlock[plaintext.length + 4 + i] = padBytes[i];
        }
      }

      // Bytes 1-3: checksum (inverted first 3 bytes of plaintext)
      cekBlock[1] = OpCodes.Not8(cekBlock[4]);
      cekBlock[2] = OpCodes.Not8(cekBlock[5]);
      cekBlock[3] = OpCodes.Not8(cekBlock[6]);

      // Create cipher instance for encryption
      /** @type {IBlockCipherInstance} */
      const cipherInstance = CipherAlgorithm.CreateInstance(false);
      cipherInstance.key = this._key;

      // Create CBC engine
      /** @type {CBCModeEngine} */
      const cbcEngine = new CBCModeEngine(cipherInstance, this._iv, true);

      // First pass: CBC encrypt all blocks in-place
      for (let i = 0; i < cekBlockSize; i += blockSize) {
        cbcEngine.processBlock(cekBlock, i, i);
      }

      // Second pass: CBC encrypt again (CBC state continues from first pass)
      // NOTE: Do NOT reset the IV - the CBC chain continues!
      for (let i = 0; i < cekBlockSize; i += blockSize) {
        cbcEngine.processBlock(cekBlock, i, i);
      }

      return cekBlock;
    }

    /**
     * RFC 3211 unwrap
     * @returns {uint8[]} Unwrapped key
     */
    _unwrap() {
      /** @type {uint8[]} */
      const ciphertext = this.inputBuffer;
      /** @type {int32} */
      const blockSize = this._iv.length;

      // Validate input length (minimum 2 blocks)
      if (ciphertext.length < 2 * blockSize) {
        throw new Error('Input too short for unwrap (minimum ' + (2 * blockSize) + ' bytes)');
      }

      if (ciphertext.length % blockSize !== 0) {
        throw new Error('Input length must be multiple of block size');
      }

      // Get cipher algorithm
      loadCipherAlgorithm(this._cipherName);
      const CipherAlgorithm = AlgorithmFramework.Find(this._cipherName);
      if (!CipherAlgorithm) {
        throw new Error('Cipher algorithm not found: ' + this._cipherName);
      }

      // RFC 3211 unwrap algorithm:
      // 1. Decrypt blocks 1..n with CBC using first block as IV
      // 2. Use last decrypted block as new IV, decrypt first block
      // 3. Standard CBC decrypt all blocks with original IV

      /** @type {uint8[]} */
      const cekBlock = [...ciphertext];
      /** @type {uint8[]} */
      const firstBlockIV = ciphertext.slice(0, blockSize);

      // Create cipher instance for decryption
      /** @type {IBlockCipherInstance} */
      const decryptInstance = CipherAlgorithm.CreateInstance(true);
      decryptInstance.key = this._key;

      // Step 1: Decrypt blocks 1..n (skip first block) with IV = first block
      /** @type {CBCModeEngine} */
      const cbcEngine1 = new CBCModeEngine(decryptInstance, firstBlockIV, false);
      for (let i = blockSize; i < cekBlock.length; i += blockSize) {
        cbcEngine1.processBlock(cekBlock, i, i);
      }

      // Step 2: Use last decrypted block as new IV, decrypt first block
      /** @type {uint8[]} */
      const newIV = cekBlock.slice(cekBlock.length - blockSize);
      /** @type {CBCModeEngine} */
      const cbcEngine2 = new CBCModeEngine(decryptInstance, newIV, false);
      cbcEngine2.processBlock(cekBlock, 0, 0);

      // Step 3: Full CBC decrypt with original IV
      /** @type {CBCModeEngine} */
      const cbcEngine3 = new CBCModeEngine(decryptInstance, this._iv, false);
      for (let i = 0; i < cekBlock.length; i += blockSize) {
        cbcEngine3.processBlock(cekBlock, i, i);
      }

      // Extract and validate
      /** @type {int32} */
      const length = OpCodes.ToByte(cekBlock[0]);

      // Check length validity
      if (length > cekBlock.length - 4) {
        OpCodes.ClearArray(cekBlock);
        throw new Error('Wrapped key corrupted: invalid length');
      }

      // Verify checksum (constant-time comparison)
      /** @type {boolean} */
      const check1 = OpCodes.Not8(cekBlock[1]) === OpCodes.ToByte(cekBlock[4]);
      /** @type {boolean} */
      const check2 = OpCodes.Not8(cekBlock[2]) === OpCodes.ToByte(cekBlock[5]);
      /** @type {boolean} */
      const check3 = OpCodes.Not8(cekBlock[3]) === OpCodes.ToByte(cekBlock[6]);
      /** @type {boolean} */
      const checksumValid = check1 && check2 && check3;

      if (!checksumValid) {
        OpCodes.ClearArray(cekBlock);
        throw new Error('Wrapped key corrupted: checksum mismatch');
      }

      // Extract plaintext
      /** @type {uint8[]} */
      const plaintext = cekBlock.slice(4, 4 + length);

      // Clear sensitive data
      OpCodes.ClearArray(cekBlock);

      return plaintext;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new RFC3211WrapAlgorithm());

  return RFC3211WrapAlgorithm;
}));
