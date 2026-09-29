/*
 * VMAC (Very High-Speed Message Authentication Code) Implementation
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * Based on Wei Dai's Crypto++ implementation and draft-krovetz-vmac-01.txt
 * Reference: https://tools.ietf.org/html/draft-krovetz-vmac-01
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
    root.VMAC = factory(root.AlgorithmFramework, root.OpCodes);
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
          MacAlgorithm, IMacInstance, TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== CONSTANTS =====
  // CRITICAL PRECISION FIX: Use BigInt for all 64-bit constants to avoid precision loss
  // JavaScript Number has only 53-bit precision, but VMAC requires full 64-bit arithmetic

  /** @type {BigInt} */
  const P64 = 0xfffffffffffffeffn; // 2^64 - 257 (prime for L3 hash)
  /** @type {BigInt} */
  const P127 = 0x7fffffffffffffffffffffffffffffffn; // 2^127 - 1 (prime for L2 hash)
  /** @type {BigInt} */
  const M62 = 0x3fffffffffffffffn; // 62-bit mask
  /** @type {BigInt} */
  const M63 = 0x7fffffffffffffffn; // 63-bit mask
  /** @type {BigInt} */
  const M64 = 0xffffffffffffffffn; // 64-bit mask
  /** @type {BigInt} */
  const M128 = 0xffffffffffffffffffffffffffffffffn; // 128-bit mask
  /** @type {BigInt} */
  const MPOLY = 0x1fffffff1fffffffn; // Polynomial key mask

  // ===== 64-BIT ARITHMETIC HELPERS =====

  // NOTE: The 64-bit and 128-bit arithmetic uses BigInt because JavaScript's
  // Number type has only 53-bit precision, insufficient for VMAC's 64-bit
  // arithmetic requirements. These operations implement the polynomial and
  // modular arithmetic from the VMAC specification with bit-perfect accuracy.

  /**
   * Join two 32-bit halves into a 64-bit BigInt (PRECISION-CRITICAL)
   * @param {uint32} high - High 32 bits
   * @param {uint32} low - Low 32 bits
   * @returns {BigInt} (high << 32) | low
   */
  function join64(high, low) {
    return OpCodes.OrN(OpCodes.ShiftLn(BigInt(OpCodes.ToUint32(high)), 32), BigInt(OpCodes.ToUint32(low)));
  }

  /**
   * Big-endian 64-bit word from 8 bytes
   * @param {uint8[]} bytes - Source bytes
   * @param {int32} offset - Index of the first byte
   * @returns {BigInt} The word
   */
  function load64BE(bytes, offset) {
    return join64(
      OpCodes.Pack32BE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]),
      OpCodes.Pack32BE(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
    );
  }

  /**
   * Little-endian 64-bit word from 8 bytes
   * @param {uint8[]} bytes - Source bytes
   * @param {int32} offset - Index of the first byte
   * @returns {BigInt} The word
   */
  function load64LE(bytes, offset) {
    return join64(
      OpCodes.Pack32LE(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]),
      OpCodes.Pack32LE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
    );
  }

  /**
   * 8 big-endian bytes of the low 64 bits of a BigInt
   * @param {BigInt} value - Value to serialize
   * @returns {uint8[]} 8 bytes
   */
  function store64BE(value) {
    /** @type {uint32} */
    const high = Number(OpCodes.AndN(OpCodes.ShiftRn(value, 32), 0xffffffffn));
    /** @type {uint32} */
    const low = Number(OpCodes.AndN(value, 0xffffffffn));
    return OpCodes.Unpack32BE(high).concat(OpCodes.Unpack32BE(low));
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class VMACAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "VMAC";
      this.description = "Very high-speed message authentication code using universal hashing and AES-based key derivation. Designed for high performance with formal security proofs.";
      this.inventor = "Ted Krovetz, Wei Dai";
      this.year = 2007;
      this.category = CategoryType.MAC;
      this.subCategory = "Universal Hashing MAC";
      this.securityStatus = null; // Not thoroughly analyzed for this implementation
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(8, 16, 8)  // VMAC produces 64-bit or 128-bit MAC
      ];
      this.NeedsKey = true;

      // Documentation links
      this.documentation = [
        new LinkItem("VMAC Draft Specification", "https://tools.ietf.org/html/draft-krovetz-vmac-01"),
        new LinkItem("Fastcrypto VMAC Page", "https://www.fastcrypto.org/vmac/"),
        new LinkItem("Message Authentication on 64-bit Architectures (Krovetz, FSE 2006)", "http://krovetz.net/csus/papers/vmac.pdf")
      ];

      // Reference links
      this.references = [
        new LinkItem("Crypto++ VMAC Implementation", "https://github.com/weidai11/cryptopp/blob/master/vmac.cpp"),
        new LinkItem("Ted Krovetz's Reference Code", "https://www.fastcrypto.org/vmac/vmac.c"),
        new LinkItem("VMAC Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse", "Using the same nonce with the same key completely breaks security"),
        new Vulnerability("Side-Channel Attacks", "Implementation must use constant-time operations to prevent timing attacks")
      ];

      // Authentic test vectors from Crypto++ TestVectors/vmac.txt
      this.tests = [
        // VMAC-64 test vectors
        {
          text: "VMAC(AES)-64: Empty message",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: [],
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("2576BE1C56D8B81B")
        },
        {
          text: "VMAC(AES)-64: 'abc'",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("2D376CF5B1813CE5")
        },
        {
          text: "VMAC(AES)-64: 16 x 'abc'",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc".repeat(16)),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("E8421F61D573D298")
        },
        // VMAC-128 test vectors
        {
          text: "VMAC(AES)-128: Empty message",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: [],
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("472766C70F74ED23481D6D7DE4E80DAC")
        },
        {
          text: "VMAC(AES)-128: 'abc'",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("4EE815A06A1D71EDD36FC75D51188A42")
        },
        {
          text: "VMAC(AES)-128: 16 x 'abc'",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc".repeat(16)),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("09F2C80C8E1007A0C12FAE19FE4504AE")
        },
        // L1-HASH segment boundary: the segment length is 128 bytes, so these
        // sit exactly on it (128), one byte past it (129) and well beyond it
        // (195, 300, 512), which is where multi-segment folding shows up.
        {
          text: "VMAC(AES)-64: 42 x 'abc' + 'ab' (128 bytes, exactly one L1 segment)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc".repeat(42) + "ab"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("D638B73921F184DE")
        },
        {
          text: "VMAC(AES)-128: 42 x 'abc' + 'ab' (128 bytes, exactly one L1 segment)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc".repeat(42) + "ab"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("F7E95FE3DA8DB9E6BB973E65D0B4CEA5")
        },
        {
          text: "VMAC(AES)-64: 129 x 'a' (one byte past the L1 segment)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("a".repeat(129)),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("86348387D13D8233")
        },
        {
          text: "VMAC(AES)-128: 129 x 'a' (one byte past the L1 segment)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("a".repeat(129)),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("A7E52C3289D9B73B53576F059585EE79")
        },
        {
          text: "VMAC(AES)-64: 65 x 'abc' (195 bytes, two L1 segments)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc".repeat(65)),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("E86A86EC77A8BF61")
        },
        {
          text: "VMAC(AES)-128: 65 x 'abc' (195 bytes, two L1 segments)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc".repeat(65)),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("0A1B2F973044F469F405917E45010334")
        },
        {
          text: "VMAC(AES)-64: 100 x 'abc' (300 bytes, three L1 segments)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc".repeat(100)),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("4492DF6C5CAC1BBE")
        },
        {
          text: "VMAC(AES)-128: 100 x 'abc' (300 bytes, three L1 segments)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc".repeat(100)),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("66438817154850C61D8A412164803BCB")
        },
        {
          text: "VMAC(AES)-64: 170 x 'abc' + 'ab' (512 bytes, exactly four L1 segments)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc".repeat(170) + "ab"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("9DA310281E6FD0A0")
        },
        {
          text: "VMAC(AES)-128: 170 x 'abc' + 'ab' (512 bytes, exactly four L1 segments)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt",
          key: OpCodes.AnsiToBytes("abcdefghijklmnop"),
          nonce: OpCodes.AnsiToBytes("bcdefghi"),
          input: OpCodes.AnsiToBytes("abc".repeat(170) + "ab"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("BF53B8D2D70C05A85880C2E21CAF1299")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for the inverse, which a MAC does not have
   * @returns {VMACInstance} New MAC instance (null for the inverse)
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // VMAC cannot be reversed
      }
      return new VMACInstance(this);
    }
  }

  // ===== INSTANCE CLASS =====

  /**
   * The registered AES algorithm
   * @returns {Algorithm} AES, or null when it is not registered
   */
  function findAes() {
    const rijndael = AlgorithmFramework.Find("Rijndael (AES)");
    if (rijndael) return rijndael;
    return AlgorithmFramework.Find("AES");
  }

  /**
 * VMAC instance implementing the Feed/Result pattern
 * @class
 * @extends {IMacInstance}
 */

  class VMACInstance extends IMacInstance {
    /**
     * @param {VMACAlgorithm} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} */
      this._key = null;
      /** @type {uint8[]} */
      this._nonce = null;
      /** @type {uint8[]} */
      this._padNonce = null;
      /** @type {int32} */
      this._outputSize = 8; // Default to 64-bit MAC
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {boolean} */
      this.initialized = false;

      // VMAC state
      /** @type {int32} */
      this.L1KeyLength = 128; // Default L1 key length in bytes (16 64-bit words)
      /** @type {uint8[][]} */
      this.nhKey = [];        // NH key array stored as byte arrays (8 bytes each)
      /** @type {BigInt[]} */
      this.polyState = [];    // Polynomial accumulator state: [ah, al, kh, kl] per tag part
      /** @type {BigInt[]} */
      this.l3Key = [];        // L3/IP keys
      /** @type {uint8[]} */
      this.pad = null;        // AES-encrypted nonce (16 bytes)
      /** @type {boolean} */
      this.isFirstBlock = true;
      /** @type {boolean} */
      this.is128 = false;
    }

    // Property setter for key
    /**
   * Set the AES key
   * @param {uint8[]} keyBytes - 16-byte key
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes || !Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }
      if (keyBytes.length !== 16) {
        throw new Error("VMAC requires 16-byte (128-bit) key");
      }
      this._key = keyBytes.slice();
      this.initialized = false; // Need to reinitialize with new key
    }

    /**
   * Get copy of current key
   * @returns {uint8[]} Copy of key bytes or null
   */

    get key() {
      if (!this._key) return null;
      return this._key.slice();
    }

    /**
     * Property setter for nonce (IV)
     * @param {uint8[]} nonceBytes - 1..16 nonce bytes
     */
    set nonce(nonceBytes) {
      if (!nonceBytes || !Array.isArray(nonceBytes)) {
        throw new Error("Invalid nonce - must be byte array");
      }
      if (nonceBytes.length < 1 || nonceBytes.length > 16) {
        throw new Error("VMAC requires 1-16 byte nonce");
      }

      // Pad nonce to 16 bytes (AES block size), right-aligned
      const paddedNonce = OpCodes.CreateArray(16, 0);
      const offset = 16 - nonceBytes.length;
      for (let i = 0; i < nonceBytes.length; ++i) {
        paddedNonce[offset + i] = nonceBytes[i];
      }

      // For 64-bit mode, mask off last bit for pad generation (caching optimization)
      if (this.is128) {
        this._nonce = paddedNonce;
      } else {
        // Store nonce with last bit intact
        this._nonce = paddedNonce;
        // Use masked nonce for pad generation (bit 0 of last byte cleared)
        this._padNonce = paddedNonce.slice();
        this._padNonce[15] = OpCodes.And32(paddedNonce[15], 0xFE);
      }

      // Reset first block flag when nonce changes
      this.isFirstBlock = true;

      // Generate pad by encrypting nonce if key is set
      if (this._key && this.initialized) {
        this._generatePad();
      }
    }

    /**
     * @returns {uint8[]} Copy of the 16-byte padded nonce, or null
     */
    get nonce() {
      if (!this._nonce) return null;
      return this._nonce.slice();
    }

    /**
     * Property setter for output MAC size
     * @param {int32} size - 8 or 16 bytes
     */
    set outputSize(size) {
      if (size !== 8 && size !== 16) {
        throw new Error("VMAC output size must be 8 (64-bit) or 16 (128-bit) bytes");
      }
      this._outputSize = size;
      this.is128 = (size === 16);
    }

    /**
     * @returns {int32} MAC length in bytes
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * Derive the NH, polynomial and L3 keys from the AES key
     * @returns {void}
     */
    _initializeVMAC() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Get AES algorithm (registry-first, plain require fallback)
      let aesAlgorithm = findAes();

      if (!aesAlgorithm && typeof require !== 'undefined') {
        try { require('../block/rijndael.js'); } catch (loadError) { /* ignore */ }
        aesAlgorithm = findAes();
      }

      if (!aesAlgorithm) {
        throw new Error("AES algorithm not found - required for VMAC");
      }

      /** @type {IAlgorithmInstance} */
      const aes = aesAlgorithm.CreateInstance();
      aes.key = this._key;

      // Derive NH key (L1 key derivation) - tag 0x80
      const nhKeyBlocks = this.L1KeyLength / 16; // Number of AES blocks (8 for default 128 bytes)
      /** @type {int32} */
      let extraBlocks = 0; // Extra blocks for 128-bit mode
      if (this.is128) extraBlocks = 2;
      this.nhKey = [];

      const counter = OpCodes.CreateArray(16, 0);
      counter[0] = 0x80; // NH key derivation tag

      for (let i = 0; i < nhKeyBlocks + extraBlocks; ++i) {
        // Encode counter in big-endian at bytes 12-15
        const counterBytes = OpCodes.Unpack32BE(i);
        counter[12] = counterBytes[0];
        counter[13] = counterBytes[1];
        counter[14] = counterBytes[2];
        counter[15] = counterBytes[3];

        aes.Feed(counter);
        /** @type {uint8[]} */
        const block = aes.Result();

        // Store as raw bytes to avoid precision loss (2 x 8-byte words per block)
        this.nhKey.push(block.slice(0, 8));
        this.nhKey.push(block.slice(8, 16));
      }

      // Derive polynomial keys - tag 0xC0
      // PRECISION-CRITICAL: Store as BigInt to preserve full 64-bit values
      this.polyState = [];
      counter[0] = 0xC0; // Poly key derivation tag
      counter[15] = 0;

      /** @type {int32} */
      let numPolyKeys = 1;
      if (this.is128) numPolyKeys = 2;
      for (let i = 0; i < numPolyKeys; ++i) {
        counter[15] = i;
        aes.Feed(counter);
        /** @type {uint8[]} */
        const block = aes.Result();

        // Pack bytes and apply MPOLY mask to complete 64-bit words
        // CRITICAL: Mask must be applied AFTER packing, not before
        const kh = OpCodes.AndN(load64BE(block, 0), MPOLY);
        const kl = OpCodes.AndN(load64BE(block, 8), MPOLY);

        // polyState stores: [ah, al, kh, kl] as BigInt values
        // Initialize accumulator to 0
        this.polyState.push(0n);  // ah
        this.polyState.push(0n);  // al
        this.polyState.push(kh);  // kh
        this.polyState.push(kl);  // kl
      }

      // Derive L3 keys (IP keys) - tag 0xE0
      // PRECISION-CRITICAL: Store as BigInt for modular arithmetic
      this.l3Key = [];
      counter[0] = 0xE0; // L3 key derivation tag
      counter[15] = 0;

      // The key-derivation counter advances on every candidate block, including
      // rejected ones - not only on accepted ones (draft-krovetz-vmac-01 5.4.1).
      let l3Counter = 0;
      for (let i = 0; i < numPolyKeys; ++i) {
        /** @type {BigInt} */
        let k0 = 0n;
        /** @type {BigInt} */
        let k1 = 0n;
        do {
          counter[15] = l3Counter;
          ++l3Counter;
          aes.Feed(counter);
          /** @type {uint8[]} */
          const block = aes.Result();

          // Convert to 64-bit BigInt
          k0 = load64BE(block, 0);
          k1 = load64BE(block, 8);

          // Check if < p64 = 2^64 - 257
          if (k0 < P64 && k1 < P64) break;
        } while (true);

        this.l3Key.push(k0);
        this.l3Key.push(k1);
      }

      this.initialized = true;

      // Generate pad if nonce is set
      if (this._nonce) {
        this._generatePad();
      }
    }

    /**
     * Generate pad by encrypting nonce
     * @returns {void}
     */
    _generatePad() {
      if (!this._key || !this._nonce) return;

      const aesAlgorithm = findAes();
      if (!aesAlgorithm) {
        throw new Error("AES algorithm not found");
      }

      /** @type {IAlgorithmInstance} */
      const aes = aesAlgorithm.CreateInstance();
      aes.key = this._key;

      // For 64-bit mode, use masked nonce (last bit cleared)
      // This allows pad reuse for nonces differing only in last bit
      /** @type {uint8[]} */
      let nonceToEncrypt = this._padNonce;
      if (this.is128) nonceToEncrypt = this._nonce;

      aes.Feed(nonceToEncrypt);
      this.pad = aes.Result();
    }

    // Feed data to the MAC
    /**
   * Feed message bytes
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If the data is not a byte array
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
     * NH hash function - core of VMAC. Processes the message in 16-byte
     * chunks: sum of (m0 + k0 mod 2^64) * (m1 + k1 mod 2^64), mod 2^128.
     * @param {uint8[]} message - Segment, a multiple of 16 bytes
     * @param {int32} nhKeyOffset - First NH key word to use
     * @param {int32} tagIndex - Tag part (0, or 1 for the second half of VMAC-128)
     * @returns {BigInt} NH result masked to 126 bits
     */
    _nhHash(message, nhKeyOffset, tagIndex) {
      // 128-bit accumulator
      /** @type {BigInt} */
      let acc = 0n;

      // Process message in 16-byte blocks (two 64-bit words)
      const numBlocks = Math.floor(message.length / 16);

      for (let block = 0; block < numBlocks; ++block) {
        const msgOffset = block * 16;
        const keyOffset = nhKeyOffset + block * 2;

        // Load two 64-bit message words in LITTLE-endian
        const m0 = load64LE(message, msgOffset);
        const m1 = load64LE(message, msgOffset + 8);

        // Get NH keys
        // For 64-bit mode (tagIndex=0): use consecutive keys
        // For 128-bit mode (tagIndex=1): offset by +2 to use next pair
        // NH keys are stored BIG-endian to match Crypto++
        const k0 = load64BE(this.nhKey[keyOffset + tagIndex * 2], 0);
        const k1 = load64BE(this.nhKey[keyOffset + tagIndex * 2 + 1], 0);

        // NH: Accumulate (m0 + k0) * (m1 + k1) as 128-bit
        const sum0 = OpCodes.AndN(m0 + k0, M64);
        const sum1 = OpCodes.AndN(m1 + k1, M64);
        acc = OpCodes.AndN(acc + sum0 * sum1, M128);
      }

      // Mask to 126 bits (high word is 62 bits max)
      // PRECISION-CRITICAL: Must use BigInt to preserve all bits
      return OpCodes.AndN(acc, OpCodes.OrN(OpCodes.ShiftLn(M62, 64), M64));
    }

    /**
     * Polynomial evaluation step of L2-HASH: y = (y * k + m) mod (2^127 - 1)
     * draft-krovetz-vmac-01 section 5.4.1. BigInt keeps the 127-bit arithmetic
     * exact, so the reduction is written directly rather than as a lazy
     * carry-propagating sequence.
     * @param {BigInt} y - Polynomial accumulator
     * @param {BigInt} k - Polynomial key
     * @param {BigInt} m - NH result (126 bits)
     * @returns {BigInt} Next accumulator value
     */
    _polyStep(y, k, m) {
      return (y * k + m) % P127;
    }

    /**
     * L3 hash function - final mixing with modular arithmetic
     * PRECISION-CRITICAL: Implements Crypto++ L3Hash algorithm using BigInt
     * Reference: vmac.cpp lines 798-837
     * @param {BigInt} polyHigh - High part of the polynomial value
     * @param {BigInt} polyLow - Low 64 bits of the polynomial value
     * @param {BigInt} l3Key0 - First L3 key
     * @param {BigInt} l3Key1 - Second L3 key
     * @param {int32} msgLenBits - Length term in bits
     * @returns {BigInt} 64-bit L3 result
     */
    _l3Hash(polyHigh, polyLow, l3Key0, l3Key1, msgLenBits) {
      /** @type {BigInt} */
      let p1 = polyHigh;
      /** @type {BigInt} */
      let p2 = polyLow;
      const k1 = l3Key0;
      const k2 = l3Key1;
      const len = BigInt(msgLenBits); // Length in BITS (Crypto++ line 849 converts to bits before calling)

      // Fully reduce (p1,p2)+(len,0) mod p127
      /** @type {BigInt} */
      let t = OpCodes.ShiftRn(p1, 63);
      p1 = OpCodes.AndN(p1, M63);
      // ADD128(p1, p2, len, t)
      p2 += t;
      p1 += len + OpCodes.ShiftRn(p2, 64);
      p2 = OpCodes.AndN(p2, M64);

      // At this point, (p1,p2) is at most 2^127+(len << 64)
      t = 0n;
      if (p1 > M63) t += 1n;
      if (p1 === M63 && p2 === M64) t += 1n;
      // ADD128(p1, p2, z, t)
      p2 += t;
      p1 += OpCodes.ShiftRn(p2, 64);
      p2 = OpCodes.AndN(p2, M64);
      p1 = OpCodes.AndN(p1, M63);

      // Compute (p1,p2)/(2^64-2^32) and (p1,p2)%(2^64-2^32)
      t = p1 + OpCodes.ShiftRn(p2, 32);
      t += OpCodes.ShiftRn(t, 32);
      if (OpCodes.AndN(t, 0xffffffffn) > 0xfffffffen) t += 1n;
      p1 += OpCodes.ShiftRn(t, 32);
      p2 += OpCodes.ShiftLn(p1, 32);
      p2 = OpCodes.AndN(p2, M64); // Keep p2 in 64-bit range

      // Compute (p1+k1)%p64 and (p2+k2)%p64
      // Crypto++ vmac.cpp line 821-824
      const p1_before = p1;
      const p2_before = p2;
      p1 += k1;
      if (p1 < p1_before) p1 += 257n; // Add 257 if wrapped (p1 < original value)
      p2 += k2;
      if (p2 < p2_before) p2 += 257n; // Add 257 if wrapped

      // Compute (p1+k1)*(p2+k2)%p64
      /** @type {BigInt} */
      const prod = p1 * p2;
      let rh = OpCodes.ShiftRn(prod, 64);
      let rl = OpCodes.AndN(prod, M64);

      // Reduction mod p64:
      t = OpCodes.ShiftRn(rh, 56);
      // ADD128(t, rl, z, rh)
      rl += rh;
      t += OpCodes.ShiftRn(rl, 64);
      rl = OpCodes.AndN(rl, M64);

      rh = OpCodes.AndN(OpCodes.ShiftLn(rh, 8), M64);
      // ADD128(t, rl, z, rh)
      rl += rh;
      t += OpCodes.ShiftRn(rl, 64);
      rl = OpCodes.AndN(rl, M64);

      t += OpCodes.ShiftLn(t, 8);
      rl += t;
      const rl_wrapped = (rl < t);
      rl = OpCodes.AndN(rl, M64);
      if (rl_wrapped) rl += 257n;
      if (rl > (P64 - 1n)) rl += 257n;
      rl = OpCodes.AndN(rl, M64); // Final mask

      return rl;
    }

    // Get the MAC result
    /**
   * Get the MAC of everything fed so far
   * @returns {uint8[]} outputSize MAC bytes
   * @throws {Error} If key or nonce not set
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      // Initialize if not done
      if (!this.initialized) {
        this._initializeVMAC();
      }

      const msgLen = this.inputBuffer.length;
      const msgLenBits = msgLen * 8;

      // Pad message to 16-byte boundary with zeros
      const paddedMsg = this.inputBuffer.slice();
      while (paddedMsg.length % 16 !== 0) {
        paddedMsg.push(0);
      }

      /** @type {int32} */
      let numParts = 1;
      if (this.is128) {
        numParts = 2;
      }
      /** @type {uint8[]} */
      const tagParts = [];

      // L1-HASH breaks the message into segments of L1KeyLength bytes and hashes
      // each with NH under the SAME NH key; L2-HASH then folds the per-segment NH
      // results together with a polynomial hash. Hashing the whole message as one
      // NH call runs off the end of the key and skips the polynomial layer.
      // draft-krovetz-vmac-01 section 5.3.
      /** @type {uint8[][]} */
      const segments = [];
      for (let off = 0; off < paddedMsg.length; off += this.L1KeyLength) {
        segments.push(paddedMsg.slice(off, Math.min(off + this.L1KeyLength, paddedMsg.length)));
      }

      // L2-HASH adds (bitlength(M) mod L1KEYLEN) * 2^64 to the polynomial value,
      // so a message that is an exact multiple of the segment length contributes
      // zero here - not its full bit length.
      const lenTermBits = msgLenBits % (this.L1KeyLength * 8);

      // Process each tag part (1 for 64-bit, 2 for 128-bit)
      for (let tagIndex = 0; tagIndex < numParts; ++tagIndex) {
        const polyOffset = tagIndex * 4; // Each poly state is [ah, al, kh, kl]
        const kh = this.polyState[polyOffset + 2];
        const kl = this.polyState[polyOffset + 3];
        const kValue = OpCodes.OrN(OpCodes.ShiftLn(kh, 64), kl);

        // Empty message: the polynomial value is the polynomial key itself.
        /** @type {BigInt} */
        let poly = kValue;

        for (let seg = 0; seg < segments.length; ++seg) {
          const nh = this._nhHash(segments[seg], 0, tagIndex);

          if (seg === 0) {
            // First segment: a = (NH_result masked to 126 bits) + polynomial key
            poly = nh + kValue;
          } else {
            // Subsequent segments: polynomial step
            poly = this._polyStep(poly, kValue, nh);
          }
        }

        const polyHigh = OpCodes.ShiftRn(poly, 64);
        const polyLow = OpCodes.AndN(poly, M64);

        // Record the polynomial value reached for this message
        this.polyState[polyOffset] = polyHigh;
        this.polyState[polyOffset + 1] = polyLow;

        // L3 hash
        const l3Result = this._l3Hash(
          polyHigh,
          polyLow,
          this.l3Key[tagIndex * 2],
          this.l3Key[tagIndex * 2 + 1],
          lenTermBits
        );

        // Add pad (encrypted nonce)
        // For 64-bit mode, use nonce's last bit to select pad offset
        let padOffset = tagIndex * 8;
        if (!this.is128) {
          // 64-bit mode: use bit 0 of last nonce byte
          if (OpCodes.And32(this._nonce[15], 1) !== 0) padOffset = 8;
          else padOffset = 0;
        }

        const padValue = load64BE(this.pad, padOffset);

        // Add pad to L3 result (both are BigInt)
        // PRECISION-CRITICAL: Final tag assembly
        const finalTag = OpCodes.AndN(l3Result + padValue, M64);

        // Convert to bytes (big-endian)
        const tagBytes = store64BE(finalTag);

        for (let _i = 0; _i < tagBytes.length; _i++) tagParts.push(tagBytes[_i]);
      }

      // Clear state for next message
      this.inputBuffer = [];
      this.isFirstBlock = false;

      return tagParts.slice(0, this._outputSize);
    }

    /**
     * Compute MAC (IMacInstance interface)
     * @param {uint8[]} data - Message bytes
     * @returns {uint8[]} outputSize MAC bytes
     */
    ComputeMac(data) {
      if (!this._key || !this._nonce) {
        throw new Error("Key and nonce not set");
      }
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }

      this.Feed(data);
      return this.Result();
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new VMACAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { VMACAlgorithm, VMACInstance };
}));
