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
          MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== CONSTANTS =====
  // CRITICAL PRECISION FIX: Use BigInt for all 64-bit constants to avoid precision loss
  // JavaScript Number has only 53-bit precision, but VMAC requires full 64-bit arithmetic

  const P64 = 0xfffffffffffffeffn; // 2^64 - 257 (prime for L3 hash)
  const M62 = 0x3fffffffffffffffn; // 62-bit mask
  const M63 = 0x7fffffffffffffffn; // 63-bit mask
  const M64 = 0xffffffffffffffffn; // 64-bit mask
  const MPOLY = 0x1fffffff1fffffffn; // Polynomial key mask

  // ===== 64-BIT ARITHMETIC HELPERS =====

  // NOTE: The following 64-bit and 128-bit arithmetic operations use BigInt
  // because JavaScript's Number type has only 53-bit precision, insufficient for VMAC's
  // 64-bit arithmetic requirements. These operations implement the complex polynomial
  // and modular arithmetic from the VMAC specification with bit-perfect accuracy.

  // Convert 64-bit BigInt to {high32, low32} (both as regular Numbers)
  function split64(value) {
    const bigValue = BigInt(value);
    return {
      high: Number((bigValue >> 32n) & 0xffffffffn),
      low: Number(bigValue & 0xffffffffn)
    };
  }

  // Convert {high32, low32} to 64-bit BigInt (PRECISION-CRITICAL)
  function join64(high, low) {
    return (BigInt(high >>> 0) << 32n) | BigInt(low >>> 0);
  }

  // Convert 8-byte array (big-endian) to {high32, low32} representation
  function bytes8ToWords(bytes) {
    return {
      high: OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]),
      low: OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7])
    };
  }

  // Convert {high32, low32} to 8-byte array (big-endian)
  function wordsToBytes8(high, low) {
    return [
      ...OpCodes.Unpack32BE(high),
      ...OpCodes.Unpack32BE(low)
    ];
  }

  // Multiply two 64-bit values (as {h,l} pairs) and return 128-bit result
  // PRECISION-CRITICAL: Uses BigInt to avoid precision loss in 64x64 multiplication
  function mul64x64to128(a_h, a_l, b_h, b_l) {
    // Convert inputs to 64-bit BigInts
    const a = join64(a_h, a_l);
    const b = join64(b_h, b_l);

    // Perform 128-bit multiplication
    const product = a * b;

    // Split result into four 32-bit parts
    const low64 = product & M64;
    const high64 = product >> 64n;

    const low = split64(low64);
    const high = split64(high64);

    return {
      high_h: high.high,
      high_l: high.low,
      low_h: low.high,
      low_l: low.low
    };
  }

  // Add two 64-bit values (as {h,l} pairs)
  // PRECISION-CRITICAL: Uses BigInt to handle carries correctly
  function add64(a_h, a_l, b_h, b_l) {
    const a = join64(a_h, a_l);
    const b = join64(b_h, b_l);
    const sum = a + b;
    return split64(sum);
  }

  // Add 128-bit values: [ah_h, ah_l, al_h, al_l] + [bh_h, bh_l, bl_h, bl_l]
  // PRECISION-CRITICAL: Uses BigInt for 128-bit arithmetic
  function add128(ah_h, ah_l, al_h, al_l, bh_h, bh_l, bl_h, bl_l) {
    const a_low = join64(al_h, al_l);
    const a_high = join64(ah_h, ah_l);
    const b_low = join64(bl_h, bl_l);
    const b_high = join64(bh_h, bh_l);

    // Build 128-bit values
    const a = (a_high << 64n) | a_low;
    const b = (b_high << 64n) | b_low;
    const sum = a + b;

    // Split back into 32-bit parts
    const low64 = sum & M64;
    const high64 = (sum >> 64n) & M64;

    const low = split64(low64);
    const high = split64(high64);

    return {
      high_h: high.high,
      high_l: high.low,
      low_h: low.high,
      low_l: low.low
    };
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
        new LinkItem("VMAC Paper (FSE 2006)", "https://www.iacr.org/archive/fse2006/40470135/40470135.pdf")
      ];

      // Reference links
      this.references = [
        new LinkItem("Crypto++ VMAC Implementation", "https://github.com/weidai11/cryptopp/blob/master/vmac.cpp"),
        new LinkItem("Ted Krovetz's Reference Code", "https://www.fastcrypto.org/vmac/vmac.c"),
        new LinkItem("VMAC Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new LinkItem("Nonce Reuse", "Using the same nonce with the same key completely breaks security"),
        new LinkItem("Side-Channel Attacks", "Implementation must use constant-time operations to prevent timing attacks")
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
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // VMAC cannot be reversed
      }
      return new VMACInstance(this);
    }
  }

  // ===== INSTANCE CLASS =====

  class VMACInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this._nonce = null;
      this._outputSize = 8; // Default to 64-bit MAC
      this.inputBuffer = [];
      this.initialized = false;

      // VMAC state
      this.L1KeyLength = 128; // Default L1 key length in bytes (16 64-bit words)
      this.nhKey = [];        // NH key array stored as byte arrays (8 bytes each)
      this.polyState = [];    // Polynomial accumulator state stored as byte arrays
      this.l3Key = [];        // L3/IP keys stored as byte arrays
      this.pad = null;        // AES-encrypted nonce (16 bytes)
      this.isFirstBlock = true;
      this.is128 = false;
    }

    // Property setter for key
    set key(keyBytes) {
      if (!keyBytes || !Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }
      if (keyBytes.length !== 16) {
        throw new Error("VMAC requires 16-byte (128-bit) key");
      }
      this._key = [...keyBytes];
      this.initialized = false; // Need to reinitialize with new key
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for nonce (IV)
    set nonce(nonceBytes) {
      if (!nonceBytes || !Array.isArray(nonceBytes)) {
        throw new Error("Invalid nonce - must be byte array");
      }
      if (nonceBytes.length < 1 || nonceBytes.length > 16) {
        throw new Error("VMAC requires 1-16 byte nonce");
      }

      // Pad nonce to 16 bytes (AES block size), right-aligned
      const paddedNonce = new Array(16).fill(0);
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
        this._padNonce = [...paddedNonce];
        this._padNonce[15] = paddedNonce[15] & 0xFE;
      }

      // Reset first block flag when nonce changes
      this.isFirstBlock = true;

      // Generate pad by encrypting nonce if key is set
      if (this._key && this.initialized) {
        this._generatePad();
      }
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Property setter for output MAC size
    set outputSize(size) {
      if (size !== 8 && size !== 16) {
        throw new Error("VMAC output size must be 8 (64-bit) or 16 (128-bit) bytes");
      }
      this._outputSize = size;
      this.is128 = (size === 16);
    }

    get outputSize() {
      return this._outputSize;
    }

    // Initialize VMAC with key
    _initializeVMAC() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Get AES algorithm
      let aesAlgorithm = AlgorithmFramework.Find("Rijndael (AES)") || AlgorithmFramework.Find("AES");

      if (!aesAlgorithm && typeof require !== 'undefined') {
        try {
          const rijndaelPath = require.resolve('../block/rijndael.js');
          delete require.cache[rijndaelPath];
          require('../block/rijndael.js');
          aesAlgorithm = AlgorithmFramework.Find("Rijndael (AES)") || AlgorithmFramework.Find("AES");
        } catch (loadError) {
          // Ignore
        }
      }

      if (!aesAlgorithm) {
        throw new Error("AES algorithm not found - required for VMAC");
      }

      const aes = aesAlgorithm.CreateInstance();
      aes.key = this._key;

      // Derive NH key (L1 key derivation) - tag 0x80
      const nhKeyBlocks = this.L1KeyLength / 16; // Number of AES blocks (8 for default 128 bytes)
      const extraBlocks = this.is128 ? 2 : 0; // Extra blocks for 128-bit mode
      this.nhKey = [];

      const counter = new Array(16).fill(0);
      counter[0] = 0x80; // NH key derivation tag

      for (let i = 0; i < nhKeyBlocks + extraBlocks; ++i) {
        // Encode counter in big-endian at bytes 12-15
        const counterBytes = OpCodes.Unpack32BE(i);
        counter[12] = counterBytes[0];
        counter[13] = counterBytes[1];
        counter[14] = counterBytes[2];
        counter[15] = counterBytes[3];

        aes.Feed(counter);
        const block = aes.Result();

        // Store as raw bytes to avoid precision loss (2 x 8-byte words per block)
        this.nhKey.push(block.slice(0, 8), block.slice(8, 16));
      }

      // Derive polynomial keys - tag 0xC0
      // PRECISION-CRITICAL: Store as BigInt to preserve full 64-bit values
      this.polyState = [];
      counter[0] = 0xC0; // Poly key derivation tag
      counter[15] = 0;

      const numPolyKeys = this.is128 ? 2 : 1;
      for (let i = 0; i < numPolyKeys; ++i) {
        counter[15] = i;
        aes.Feed(counter);
        const block = aes.Result();

        // Pack bytes and apply MPOLY mask to complete 64-bit words
        // CRITICAL: Mask must be applied AFTER packing, not before
        const kh_high = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
        const kh_low = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
        const kh = join64(kh_high, kh_low) & MPOLY;

        const kl_high = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
        const kl_low = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);
        const kl = join64(kl_high, kl_low) & MPOLY;

        // polyState stores: [ah, al, kh, kl] as BigInt values
        // Initialize accumulator to 0
        this.polyState.push(
          0n,  // ah
          0n,  // al
          kh,  // kh
          kl   // kl
        );
      }

      // Derive L3 keys (IP keys) - tag 0xE0
      // PRECISION-CRITICAL: Store as BigInt for modular arithmetic
      this.l3Key = [];
      counter[0] = 0xE0; // L3 key derivation tag
      counter[15] = 0;

      for (let i = 0; i < numPolyKeys; ++i) {
        let k0, k1;
        do {
          counter[15] = this.l3Key.length / 2;
          aes.Feed(counter);
          const block = aes.Result();

          // Convert to 64-bit BigInt
          const k0_high = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
          const k0_low = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
          k0 = join64(k0_high, k0_low);

          const k1_high = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
          const k1_low = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);
          k1 = join64(k1_high, k1_low);

          // Check if < p64 = 2^64 - 257
          if (k0 < P64 && k1 < P64) break;
        } while (true);

        this.l3Key.push(k0, k1);
      }

      this.initialized = true;

      // Generate pad if nonce is set
      if (this._nonce) {
        this._generatePad();
      }
    }

    // Generate pad by encrypting nonce
    _generatePad() {
      if (!this._key || !this._nonce) return;

      const aesAlgorithm = AlgorithmFramework.Find("Rijndael (AES)") || AlgorithmFramework.Find("AES");
      if (!aesAlgorithm) {
        throw new Error("AES algorithm not found");
      }

      const aes = aesAlgorithm.CreateInstance();
      aes.key = this._key;

      // For 64-bit mode, use masked nonce (last bit cleared)
      // This allows pad reuse for nonces differing only in last bit
      const nonceToEncrypt = this.is128 ? this._nonce : this._padNonce;

      aes.Feed(nonceToEncrypt);
      this.pad = aes.Result();
    }

    // Feed data to the MAC
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      this.inputBuffer.push(...data);
    }

    // NH hash function - core of VMAC
    // Processes message in 16-byte chunks, returns 128-bit result as {high, low}
    _nhHash(message, nhKeyOffset, tagIndex) {
      // Track 128-bit accumulator as high and low 64-bit parts
      let nh_high_h = 0, nh_high_l = 0;
      let nh_low_h = 0, nh_low_l = 0;

      // Process message in 16-byte blocks (two 64-bit words)
      const numBlocks = Math.floor(message.length / 16);

      for (let block = 0; block < numBlocks; ++block) {
        const msgOffset = block * 16;
        const keyOffset = nhKeyOffset + block * 2;

        // Load two 64-bit message words in LITTLE-endian
        const m0_low = OpCodes.Pack32LE(message[msgOffset], message[msgOffset+1], message[msgOffset+2], message[msgOffset+3]);
        const m0_high = OpCodes.Pack32LE(message[msgOffset+4], message[msgOffset+5], message[msgOffset+6], message[msgOffset+7]);

        const m1_low = OpCodes.Pack32LE(message[msgOffset+8], message[msgOffset+9], message[msgOffset+10], message[msgOffset+11]);
        const m1_high = OpCodes.Pack32LE(message[msgOffset+12], message[msgOffset+13], message[msgOffset+14], message[msgOffset+15]);

        // Get NH keys
        // For 64-bit mode (tagIndex=0): use consecutive keys
        // For 128-bit mode (tagIndex=1): offset by +2 to use next pair
        const k0Bytes = this.nhKey[keyOffset + tagIndex * 2];
        const k1Bytes = this.nhKey[keyOffset + tagIndex * 2 + 1];

        // Convert NH keys from byte arrays to 32-bit parts (BIG-endian to match Crypto++)
        const k0_high = OpCodes.Pack32BE(k0Bytes[0], k0Bytes[1], k0Bytes[2], k0Bytes[3]);
        const k0_low = OpCodes.Pack32BE(k0Bytes[4], k0Bytes[5], k0Bytes[6], k0Bytes[7]);

        const k1_high = OpCodes.Pack32BE(k1Bytes[0], k1Bytes[1], k1Bytes[2], k1Bytes[3]);
        const k1_low = OpCodes.Pack32BE(k1Bytes[4], k1Bytes[5], k1Bytes[6], k1Bytes[7]);

        // NH: Accumulate (m0 + k0) * (m1 + k1) as 128-bit
        const sum0 = add64(m0_high, m0_low, k0_high, k0_low);
        const sum1 = add64(m1_high, m1_low, k1_high, k1_low);

        const prod = mul64x64to128(sum0.high, sum0.low, sum1.high, sum1.low);
        const added = add128(nh_high_h, nh_high_l, nh_low_h, nh_low_l,
                            prod.high_h, prod.high_l, prod.low_h, prod.low_l);
        nh_high_h = added.high_h;
        nh_high_l = added.high_l;
        nh_low_h = added.low_h;
        nh_low_l = added.low_l;
      }

      // Convert back to 64-bit BigInts and mask to 126 bits (high is 62 bits max)
      // PRECISION-CRITICAL: Must use BigInt to preserve all bits
      const nhHigh = join64(nh_high_h, nh_high_l) & M62;
      const nhLow = join64(nh_low_h, nh_low_l);

      return { high: nhHigh, low: nhLow };
    }

    // Polynomial evaluation step - multiply accumulator by key and add message
    // PRECISION-CRITICAL: Implements Crypto++ poly_step algorithm using BigInt
    // Reference: vmac.cpp lines 708-721 (word128 version)
    _polyStep(ah, al, kh, kl, mh, ml) {
      // Build 127-bit accumulator from high/low parts
      const a = (BigInt(ah) << 64n) | BigInt(al);
      const k_high = BigInt(kh);
      const k_low = BigInt(kl);
      const a_high = BigInt(ah);
      const a_low = BigInt(al);

      // Crypto++ poly_step algorithm:
      // t2 = (a>>64) * kl
      // t3 = a * kh
      // t1 = a * kl
      // t4 = (a>>64) * (2*kh)
      // t2 += t3
      // t4 += t1
      // t2 += (t4>>64)
      // a = ((t2 & m63) << 64) | (t4 & m64)
      // a += m & m126

      const t1 = a * k_low;                    // a * kl
      const t2_init = a_high * k_low;          // (a>>64) * kl
      const t3 = a * k_high;                   // a * kh
      const t4_init = a_high * (k_high << 1n); // (a>>64) * (2*kh)

      let t2 = t2_init + t3;                   // ah*kl + a*kh
      let t4 = t4_init + t1;                   // ah*2kh + a*kl
      t2 += (t4 >> 64n);                       // Add carry from t4

      // Build result: high 63 bits from t2, low 64 bits from t4
      const result_high = t2 & M63;
      const result_low = t4 & M64;
      let result = (result_high << 64n) | result_low;

      // Add message (masked to 126 bits)
      const m_high = BigInt(mh);
      const m_low = BigInt(ml);
      const m = ((m_high & M62) << 64n) | m_low;  // m126 mask
      result += m;

      // Return as high/low parts
      return {
        high: (result >> 64n) & M63,
        low: result & M64
      };
    }

    // L3 hash function - final mixing with modular arithmetic
    // PRECISION-CRITICAL: Implements Crypto++ L3Hash algorithm using BigInt
    // Reference: vmac.cpp lines 798-837
    _l3Hash(polyHigh, polyLow, l3Key0, l3Key1, msgLenBits) {
      let p1 = BigInt(polyHigh);
      let p2 = BigInt(polyLow);
      const k1 = BigInt(l3Key0);
      const k2 = BigInt(l3Key1);
      const len = BigInt(msgLenBits); // Length in BITS (Crypto++ line 849 converts to bits before calling)

      const z = 0n;

      // Fully reduce (p1,p2)+(len,0) mod p127
      let t = p1 >> 63n;
      p1 &= M63;
      // ADD128(p1, p2, len, t)
      p2 += t;
      p1 += len + (p2 >> 64n);
      p2 &= M64;

      // At this point, (p1,p2) is at most 2^127+(len<<64)
      t = ((p1 > M63) ? 1n : 0n) + (((p1 === M63) && (p2 === M64)) ? 1n : 0n);
      // ADD128(p1, p2, z, t)
      p2 += t;
      p1 += (p2 >> 64n);
      p2 &= M64;
      p1 &= M63;

      // Compute (p1,p2)/(2^64-2^32) and (p1,p2)%(2^64-2^32)
      t = p1 + (p2 >> 32n);
      t += (t >> 32n);
      t += ((t & 0xffffffffn) > 0xfffffffen) ? 1n : 0n;
      p1 += (t >> 32n);
      p2 += (p1 << 32n);
      p2 &= M64; // Keep p2 in 64-bit range

      // Compute (p1+k1)%p64 and (p2+k2)%p64
      // Crypto++ vmac.cpp line 821-824
      const p1_before = p1;
      const p2_before = p2;
      p1 += k1;
      p1 += (p1 < p1_before) ? 257n : 0n; // Add 257 if wrapped (p1 < original value)
      p2 += k2;
      p2 += (p2 < p2_before) ? 257n : 0n; // Add 257 if wrapped

      // Compute (p1+k1)*(p2+k2)%p64
      const prod = p1 * p2;
      let rh = prod >> 64n;
      let rl = prod & M64;

      // Reduction mod p64:
      t = rh >> 56n;
      // ADD128(t, rl, z, rh)
      rl += rh;
      t += (rl >> 64n);
      rl &= M64;

      rh = (rh << 8n) & M64;
      // ADD128(t, rl, z, rh)
      rl += rh;
      t += (rl >> 64n);
      rl &= M64;

      t += (t << 8n);
      rl += t;
      const rl_wrapped = (rl < t);
      rl &= M64;
      rl += (rl_wrapped ? 257n : 0n);
      rl += ((rl > (P64 - 1n)) ? 257n : 0n);
      rl &= M64; // Final mask

      return rl;
    }

    // Get the MAC result
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
      const paddedMsg = [...this.inputBuffer];
      while (paddedMsg.length % 16 !== 0) {
        paddedMsg.push(0);
      }

      const numParts = this.is128 ? 2 : 1;
      const tagParts = [];

      // Process each tag part (1 for 64-bit, 2 for 128-bit)
      for (let tagIndex = 0; tagIndex < numParts; ++tagIndex) {
        const polyOffset = tagIndex * 4; // Each poly state is [ah, al, kh, kl]

        let polyHigh, polyLow;

        if (msgLen === 0 && this.isFirstBlock) {
          // Special case for empty message (Crypto++ vmac.cpp line 851-861)
          // For empty string, polynomial state = polynomial keys
          polyHigh = this.polyState[polyOffset + 2]; // ah = kh
          polyLow = this.polyState[polyOffset + 3];  // al = kl

          // Update state for consistency (though not used again for empty messages)
          this.polyState[polyOffset] = polyHigh;
          this.polyState[polyOffset + 1] = polyLow;
        } else {
          // Process message with NH hash
          const nhResult = this._nhHash(paddedMsg, 0, tagIndex);

          if (this.isFirstBlock) {
            // First block: first_poly_step (Crypto++ vmac.cpp line 672)
            // a = (NH_result & m126) + polynomial_key
            // This is a simple 128-bit addition with 126-bit masking
            const kh = this.polyState[polyOffset + 2];
            const kl = this.polyState[polyOffset + 3];

            // Mask NH result to 126 bits (high part to 62 bits)
            const nhHigh = nhResult.high & M62;
            const nhLow = nhResult.low;

            // Add to polynomial key: simple 128-bit addition
            const nhValue = (nhHigh << 64n) | nhLow;
            const kValue = (kh << 64n) | kl;
            const sum = nhValue + kValue;

            // Extract high and low parts (no additional masking needed here)
            polyHigh = (sum >> 64n);
            polyLow = sum & M64;
          } else {
            // Subsequent blocks: polynomial step
            const ah = this.polyState[polyOffset];
            const al = this.polyState[polyOffset + 1];
            const kh = this.polyState[polyOffset + 2];
            const kl = this.polyState[polyOffset + 3];
            const result = this._polyStep(ah, al, kh, kl, nhResult.high, nhResult.low);
            polyHigh = result.high;
            polyLow = result.low;
          }

          // Update polynomial state for next call
          this.polyState[polyOffset] = polyHigh;
          this.polyState[polyOffset + 1] = polyLow;
        }

        // L3 hash
        const l3Result = this._l3Hash(
          polyHigh,
          polyLow,
          this.l3Key[tagIndex * 2],
          this.l3Key[tagIndex * 2 + 1],
          msgLenBits
        );

        // Add pad (encrypted nonce)
        // For 64-bit mode, use nonce's last bit to select pad offset
        let padOffset = tagIndex * 8;
        if (!this.is128) {
          // 64-bit mode: use bit 0 of last nonce byte
          const nonceBit = this._nonce[15] & 1;
          padOffset = nonceBit * 8;
        }

        const padHigh = OpCodes.Pack32BE(
          this.pad[padOffset],
          this.pad[padOffset + 1],
          this.pad[padOffset + 2],
          this.pad[padOffset + 3]
        );
        const padLow = OpCodes.Pack32BE(
          this.pad[padOffset + 4],
          this.pad[padOffset + 5],
          this.pad[padOffset + 6],
          this.pad[padOffset + 7]
        );
        const padValue = join64(padHigh, padLow);

        // Add pad to L3 result (both are BigInt)
        // PRECISION-CRITICAL: Final tag assembly
        const finalTag = (l3Result + padValue) & M64;

        // Convert to bytes (big-endian)
        const finalSplit = split64(finalTag);
        const tagBytes = [
          ...OpCodes.Unpack32BE(finalSplit.high),
          ...OpCodes.Unpack32BE(finalSplit.low)
        ];

        tagParts.push(...tagBytes);
      }

      // Clear state for next message
      this.inputBuffer = [];
      this.isFirstBlock = false;

      return tagParts.slice(0, this._outputSize);
    }

    // Compute MAC (IMacInstance interface)
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
