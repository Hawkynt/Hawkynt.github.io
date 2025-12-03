/*
 * COMET-64-SPECK AEAD - NIST Lightweight Cryptography Candidate
 * Professional implementation following official NIST LWC specification
 * (c)2006-2025 Hawkynt
 *
 * COMET (COunter Mode Encryption with authentication Tag) is a family of authenticated
 * encryption with associated data (AEAD) algorithms submitted to the NIST Lightweight
 * Cryptography competition. This implementation provides COMET-64_SPECK-64/128:
 * - 128-bit key
 * - 120-bit (15-byte) nonce
 * - 64-bit (8-byte) authentication tag
 * - Built on SPECK-64/128 block cipher (64-bit block size)
 *
 * Algorithm Structure:
 * - Initialization: Y = SPECK-64(Key, 0), Z = Nonce || 0 XOR Key
 * - AD Processing: Process associated data blocks with domain separator 0x08
 * - Encryption: CTR-like mode with shuffle function and domain separator 0x20
 * - Tag Generation: Final SPECK operation with domain separator 0x80
 *
 * Key Features:
 * - Lightweight block cipher (SPECK-64/128) optimized for resource-constrained devices
 * - ARX structure (Add-Rotate-XOR) for efficient software implementation
 * - CTR-based encryption with authentication
 * - Domain separation for security
 * - Galois Field arithmetic for key state updates
 *
 * Reference: https://www.isical.ac.in/~lightweight/comet/
 * Specification: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/comet-spec-final.pdf
 * C Reference: https://github.com/rweather/lightweight-crypto (Southern Storm Software)
 * Test Vectors: NIST LWC Known Answer Tests
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
}((function() {
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
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ========================[ SPECK-64/128 Block Cipher ]========================
  // SPECK is a lightweight block cipher with ARX (Add-Rotate-XOR) structure
  // 64-bit block size, 128-bit key, 27 rounds
  // Designed by NSA for constrained environments

  /**
   * SPECK-64/128 encryption function
   * @param {Uint8Array} key - 16-byte key
   * @param {Uint8Array} input - 8-byte input block
   * @returns {Uint8Array} - 8-byte output block
   */
  function speck64_128_encrypt(key, input) {
    // Unpack key (4 words of 32 bits each, little-endian)
    let s = OpCodes.Pack32LE(key[0], key[1], key[2], key[3]);
    let l0 = OpCodes.Pack32LE(key[4], key[5], key[6], key[7]);
    let l1 = OpCodes.Pack32LE(key[8], key[9], key[10], key[11]);
    let l2 = OpCodes.Pack32LE(key[12], key[13], key[14], key[15]);

    // Unpack input block (2 words of 32 bits each, little-endian)
    let y = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
    let x = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);

    // Perform 27 encryption rounds (in groups of 3)
    for (let round = 0; round < 27; ) {
      // Round 1
      x = OpCodes.ToUint32(OpCodes.XorN((OpCodes.RotR32(x, 8) + y), s));
      y = OpCodes.XorN(OpCodes.RotL32(y, 3), x);

      // Update key schedule
      l0 = OpCodes.ToUint32(OpCodes.XorN((s + OpCodes.RotR32(l0, 8)), round));
      s = OpCodes.XorN(OpCodes.RotL32(s, 3), l0);
      ++round;

      // Round 2
      x = OpCodes.ToUint32(OpCodes.XorN((OpCodes.RotR32(x, 8) + y), s));
      y = OpCodes.XorN(OpCodes.RotL32(y, 3), x);

      // Update key schedule
      l1 = OpCodes.ToUint32(OpCodes.XorN((s + OpCodes.RotR32(l1, 8)), round));
      s = OpCodes.XorN(OpCodes.RotL32(s, 3), l1);
      ++round;

      // Round 3
      x = OpCodes.ToUint32(OpCodes.XorN((OpCodes.RotR32(x, 8) + y), s));
      y = OpCodes.XorN(OpCodes.RotL32(y, 3), x);

      // Update key schedule
      l2 = OpCodes.ToUint32(OpCodes.XorN((s + OpCodes.RotR32(l2, 8)), round));
      s = OpCodes.XorN(OpCodes.RotL32(s, 3), l2);
      ++round;
    }

    // Pack output block (little-endian)
    const output = new Uint8Array(8);
    const yBytes = OpCodes.Unpack32LE(y);
    const xBytes = OpCodes.Unpack32LE(x);
    output.set(yBytes, 0);
    output.set(xBytes, 4);
    return output;
  }

  // ========================[ COMET-64 AEAD Mode ]========================

  /**
   * Adjusts Z state for next block (Galois Field doubling in GF(2^64))
   * Doubles the 64-bit prefix in the F(2^64) field
   * @param {Uint8Array} Z - 16-byte Z state (modified in place)
   */
  function comet_adjust_block_key(Z) {
    // Carry bit from bit 63 (byte 7, bit 7)
    const mask = OpCodes.AndN(Z[7], 0x80) ? 0x1B : 0x00;

    // Left shift by 1 bit across 8 bytes
    for (let i = 7; i > 0; --i) {
      Z[i] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(Z[i], 1), OpCodes.Shr32(Z[i - 1], 7)), 0xFF);
    }
    Z[0] = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(Z[0], 1), mask), 0xFF);
  }

  /**
   * Shuffle function for 64-bit blocks
   * Permutes: [x01(32), x2(16), x3(16)] -> [x3(16), ROR1(x2), x01(32)]
   * Where x01 is the concatenation of x0 and x1 (16 bits each)
   * @param {Uint8Array} block - 8-byte block
   * @returns {Uint8Array} - Shuffled 8-byte block
   */
  function comet_shuffle_block_64(block) {
    // Pack bytes to words
    const x01 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    const x2 = OpCodes.Pack16LE(block[4], block[5]);
    const x3_bytes = [block[6], block[7]];

    // Shuffle: [x3, ROR1(x2), x01]
    const x2_rotated = OpCodes.RotR16(x2, 1);
    const output = new Uint8Array(8);
    output[0] = x3_bytes[0];
    output[1] = x3_bytes[1];
    output.set(OpCodes.Unpack16LE(x2_rotated), 2);
    output.set(OpCodes.Unpack32LE(x01), 4);
    return output;
  }

  /**
   * Process associated data
   * @param {Uint8Array} Y - 8-byte Y state (modified in place)
   * @param {Uint8Array} Z - 16-byte Z state (modified in place)
   * @param {Uint8Array} key - 16-byte key
   * @param {Uint8Array} ad - Associated data
   */
  function comet_process_ad(Y, Z, key, ad) {
    // Domain separator for associated data
    Z[15] ^= 0x08;

    let offset = 0;
    const adlen = ad.length;

    // Process full blocks
    while (offset + 8 <= adlen) {
      comet_adjust_block_key(Z);
      const encrypted = speck64_128_encrypt(Z, Y);
      Y.set(encrypted);

      // XOR with AD block
      for (let i = 0; i < 8; ++i) {
        Y[i] ^= ad[offset + i];
      }
      offset += 8;
    }

    // Process partial block
    if (offset < adlen) {
      const remaining = adlen - offset;
      Z[15] ^= 0x10;
      comet_adjust_block_key(Z);
      const encrypted = speck64_128_encrypt(Z, Y);
      Y.set(encrypted);

      // XOR with partial AD block
      for (let i = 0; i < remaining; ++i) {
        Y[i] ^= ad[offset + i];
      }
      Y[remaining] ^= 0x01; // Padding
    }
  }

  /**
   * Encrypt plaintext
   * @param {Uint8Array} Y - 8-byte Y state (modified in place)
   * @param {Uint8Array} Z - 16-byte Z state (modified in place)
   * @param {Uint8Array} key - 16-byte key
   * @param {Uint8Array} plaintext - Input plaintext
   * @returns {Uint8Array} - Ciphertext (same length as plaintext)
   */
  function comet_encrypt_64(Y, Z, key, plaintext) {
    // Domain separator for payload data
    Z[15] ^= 0x20;

    const ciphertext = new Uint8Array(plaintext.length);
    let offset = 0;
    const mlen = plaintext.length;

    // Process full blocks
    while (offset + 8 <= mlen) {
      comet_adjust_block_key(Z);
      const encrypted = speck64_128_encrypt(Z, Y);
      Y.set(encrypted);

      const Ys = comet_shuffle_block_64(Y);

      // Update Y with plaintext
      for (let i = 0; i < 8; ++i) {
        Y[i] ^= plaintext[offset + i];
      }

      // Ciphertext = plaintext XOR shuffled Y
      for (let i = 0; i < 8; ++i) {
        ciphertext[offset + i] = OpCodes.XorN(plaintext[offset + i], Ys[i]);
      }

      offset += 8;
    }

    // Process partial block
    if (offset < mlen) {
      const remaining = mlen - offset;
      Z[15] ^= 0x40;
      comet_adjust_block_key(Z);
      const encrypted = speck64_128_encrypt(Z, Y);
      Y.set(encrypted);

      const Ys = comet_shuffle_block_64(Y);

      // Update Y with partial plaintext
      for (let i = 0; i < remaining; ++i) {
        Y[i] ^= plaintext[offset + i];
      }
      Y[remaining] ^= 0x01; // Padding

      // Ciphertext = plaintext XOR shuffled Y
      for (let i = 0; i < remaining; ++i) {
        ciphertext[offset + i] = OpCodes.XorN(plaintext[offset + i], Ys[i]);
      }
    }

    return ciphertext;
  }

  /**
   * Decrypt ciphertext
   * @param {Uint8Array} Y - 8-byte Y state (modified in place)
   * @param {Uint8Array} Z - 16-byte Z state (modified in place)
   * @param {Uint8Array} key - 16-byte key
   * @param {Uint8Array} ciphertext - Input ciphertext
   * @returns {Uint8Array} - Plaintext (same length as ciphertext)
   */
  function comet_decrypt_64(Y, Z, key, ciphertext) {
    // Domain separator for payload data
    Z[15] ^= 0x20;

    const plaintext = new Uint8Array(ciphertext.length);
    let offset = 0;
    const clen = ciphertext.length;

    // Process full blocks
    while (offset + 8 <= clen) {
      comet_adjust_block_key(Z);
      const encrypted = speck64_128_encrypt(Z, Y);
      Y.set(encrypted);

      const Ys = comet_shuffle_block_64(Y);

      // Plaintext = ciphertext XOR shuffled Y
      for (let i = 0; i < 8; ++i) {
        plaintext[offset + i] = OpCodes.XorN(ciphertext[offset + i], Ys[i]);
      }

      // Update Y with plaintext
      for (let i = 0; i < 8; ++i) {
        Y[i] ^= plaintext[offset + i];
      }

      offset += 8;
    }

    // Process partial block
    if (offset < clen) {
      const remaining = clen - offset;
      Z[15] ^= 0x40;
      comet_adjust_block_key(Z);
      const encrypted = speck64_128_encrypt(Z, Y);
      Y.set(encrypted);

      const Ys = comet_shuffle_block_64(Y);

      // Plaintext = ciphertext XOR shuffled Y
      for (let i = 0; i < remaining; ++i) {
        plaintext[offset + i] = OpCodes.XorN(ciphertext[offset + i], Ys[i]);
      }

      // Update Y with partial plaintext
      for (let i = 0; i < remaining; ++i) {
        Y[i] ^= plaintext[offset + i];
      }
      Y[remaining] ^= 0x01; // Padding
    }

    return plaintext;
  }

  // ========================[ Algorithm Class ]========================

  class Comet64SpeckAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "COMET-64-SPECK";
      this.description = "NIST Lightweight Cryptography candidate providing authenticated encryption with 64-bit blocks. Uses SPECK-64/128 ARX cipher in CTR-like mode with 64-bit authentication tag.";
      this.inventor = "Donghoon Chang, Mohona Ghosh, Kishan Chand Gupta, Arpan Jati, Abhishek Kumar, Dukjae Moon, Indranil Ray, Somitra Kumar Sanadhya";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight AEAD";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.IN; // India (Primarily), with contributors from South Korea

      // Algorithm parameters
      this.SupportedKeySizes = [new KeySize(16, 16, 1)]; // 128-bit key only
      this.SupportedNonceSizes = [new KeySize(15, 15, 1)]; // 120-bit (15-byte) nonce only
      this.SupportedTagSizes = [new KeySize(8, 8, 1)]; // 64-bit (8-byte) tag only

      // Documentation
      this.documentation = [
        new LinkItem("Official COMET Website", "https://www.isical.ac.in/~lightweight/comet/"),
        new LinkItem("NIST LWC Finalist Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/comet-spec-final.pdf"),
        new LinkItem("NIST LWC Project Page", "https://csrc.nist.gov/projects/lightweight-cryptography"),
        new LinkItem("GitHub Reference Implementation", "https://github.com/rweather/lightweight-crypto"),
        new LinkItem("SPECK Specification", "https://eprint.iacr.org/2013/404.pdf")
      ];

      // Official NIST LWC test vectors (Known Answer Tests)
      this.tests = [
        {
          text: "NIST LWC KAT Count=1: Empty plaintext, empty AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E"),
          input: new Uint8Array(0),
          associatedData: new Uint8Array(0),
          expected: OpCodes.Hex8ToBytes("D633B901593E5DFC")
        },
        {
          text: "NIST LWC KAT Count=2: Empty plaintext, 1-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E"),
          input: new Uint8Array(0),
          associatedData: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("9073A58EC98CD1C1")
        },
        {
          text: "NIST LWC KAT Count=3: Empty plaintext, 2-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E"),
          input: new Uint8Array(0),
          associatedData: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("70C62EF9E8D20C2D")
        },
        {
          text: "NIST LWC KAT Count=9: Empty plaintext, 8-byte AD (full block)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E"),
          input: new Uint8Array(0),
          associatedData: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("67CAB3FB65731AFA")
        },
        {
          text: "NIST LWC KAT Count=17: Empty plaintext, 16-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E"),
          input: new Uint8Array(0),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("657684FB59323AE4")
        },
        {
          text: "NIST LWC KAT Count=34: 1-byte plaintext, empty AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E"),
          input: OpCodes.Hex8ToBytes("00"),
          associatedData: new Uint8Array(0),
          expected: OpCodes.Hex8ToBytes("CCFD543F711A9794EB")
        },
        {
          text: "NIST LWC KAT Count=35: 1-byte plaintext, 1-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E"),
          input: OpCodes.Hex8ToBytes("00"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("E8C1B687B7FDC8D826")
        },
        {
          text: "NIST LWC KAT Count=42: 1-byte plaintext, 8-byte AD (full block)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E"),
          input: OpCodes.Hex8ToBytes("00"),
          associatedData: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("6DD3A86775755DAAAD")
        },
        {
          text: "NIST LWC KAT Count=10: Empty plaintext, 9-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E"),
          input: new Uint8Array(0),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708"),
          expected: OpCodes.Hex8ToBytes("459D3A0EFD66E5BA")
        },
        {
          text: "NIST LWC KAT Count=6: Empty plaintext, 5-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E"),
          input: new Uint8Array(0),
          associatedData: OpCodes.Hex8ToBytes("0001020304"),
          expected: OpCodes.Hex8ToBytes("EEB5CDF87A340DCB")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Comet64SpeckInstance(this, isInverse);
    }
  }

  // ========================[ Instance Class ]========================

  /**
 * Comet64Speck cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Comet64SpeckInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._nonce = null;
      this._associatedData = null;
    }

    // Key property
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

      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (must be 16 bytes)");
      }

      this._key = new Uint8Array(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? new Uint8Array(this._key) : null;
    }

    // Nonce property
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 15) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (must be 15 bytes)");
      }

      this._nonce = new Uint8Array(nonceBytes);
    }

    get nonce() {
      return this._nonce ? new Uint8Array(this._nonce) : null;
    }

    // Associated data property
    set associatedData(adBytes) {
      if (!adBytes || adBytes.length === 0) {
        this._associatedData = new Uint8Array(0);
        return;
      }

      this._associatedData = new Uint8Array(adBytes);
    }

    get associatedData() {
      return this._associatedData ? new Uint8Array(this._associatedData) : new Uint8Array(0);
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      const inputData = new Uint8Array(this.inputBuffer);
      this.inputBuffer = [];

      if (this.isInverse) {
        // Decrypt mode
        return this._decrypt(inputData);
      } else {
        // Encrypt mode
        return this._encrypt(inputData);
      }
    }

    _encrypt(plaintext) {
      // Initialize Y and Z states (from C reference)
      const Y = new Uint8Array(8); // Start with zeros
      const encryptedY = speck64_128_encrypt(this._key, Y);
      Y.set(encryptedY);

      // Initialize Z: Z = Nonce || 0 XOR Key
      const Z = new Uint8Array(16);
      Z.set(this._nonce, 0);
      Z[15] = 0;
      for (let i = 0; i < 16; ++i) {
        Z[i] ^= this._key[i];
      }

      // Process associated data if present
      if (this._associatedData && this._associatedData.length > 0) {
        comet_process_ad(Y, Z, this._key, this._associatedData);
      }

      // Encrypt plaintext
      let ciphertext;
      if (plaintext.length > 0) {
        ciphertext = comet_encrypt_64(Y, Z, this._key, plaintext);
      } else {
        ciphertext = new Uint8Array(0);
      }

      // Generate authentication tag (8 bytes)
      Z[15] ^= 0x80;
      comet_adjust_block_key(Z);
      const tag = speck64_128_encrypt(Z, Y);

      // Return ciphertext || tag
      const result = new Uint8Array(ciphertext.length + 8);
      result.set(ciphertext, 0);
      result.set(tag, ciphertext.length);
      return Array.from(result);
    }

    _decrypt(ciphertextAndTag) {
      if (ciphertextAndTag.length < 8) {
        throw new Error("Invalid ciphertext: too short for authentication tag");
      }

      // Split ciphertext and tag
      const ciphertext = ciphertextAndTag.slice(0, -8);
      const receivedTag = ciphertextAndTag.slice(-8);

      // Initialize Y and Z states (from C reference)
      const Y = new Uint8Array(8); // Start with zeros
      const encryptedY = speck64_128_encrypt(this._key, Y);
      Y.set(encryptedY);

      // Initialize Z: Z = Nonce || 0 XOR Key
      const Z = new Uint8Array(16);
      Z.set(this._nonce, 0);
      Z[15] = 0;
      for (let i = 0; i < 16; ++i) {
        Z[i] ^= this._key[i];
      }

      // Process associated data if present
      if (this._associatedData && this._associatedData.length > 0) {
        comet_process_ad(Y, Z, this._key, this._associatedData);
      }

      // Decrypt ciphertext
      let plaintext;
      if (ciphertext.length > 0) {
        plaintext = comet_decrypt_64(Y, Z, this._key, ciphertext);
      } else {
        plaintext = new Uint8Array(0);
      }

      // Verify authentication tag
      Z[15] ^= 0x80;
      comet_adjust_block_key(Z);
      const computedTag = speck64_128_encrypt(Z, Y);

      // Constant-time tag comparison
      let tagMatch = true;
      for (let i = 0; i < 8; ++i) {
        if (receivedTag[i] !== computedTag[i]) {
          tagMatch = false;
        }
      }

      if (!tagMatch) {
        throw new Error("Authentication tag verification failed");
      }

      return Array.from(plaintext);
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Comet64SpeckAlgorithm());

  return Comet64SpeckAlgorithm;
}));
