/*
 * COMET-128-CHAM AEAD - NIST Lightweight Cryptography Candidate
 * Professional implementation following official NIST LWC specification
 * (c)2006-2025 Hawkynt
 *
 * COMET (COunter Mode Encryption with authentication Tag) is a family of authenticated
 * encryption with associated data (AEAD) algorithms submitted to the NIST Lightweight
 * Cryptography competition. This implementation provides COMET-128_CHAM-128/128:
 * - 128-bit key
 * - 128-bit nonce
 * - 128-bit authentication tag
 * - Built on CHAM-128/128 block cipher
 *
 * Algorithm Structure:
 * - Initialization: Z = CHAM(Key, Nonce), Y = Key
 * - AD Processing: Process associated data blocks with domain separator 0x08
 * - Encryption: CTR-like mode with shuffle function and domain separator 0x20
 * - Tag Generation: Final CHAM operation with domain separator 0x80
 *
 * Key Features:
 * - Lightweight block cipher (CHAM) optimized for resource-constrained devices
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

  // ========================[ CHAM-128/128 Block Cipher ]========================
  // CHAM is a lightweight block cipher with ARX (Add-Rotate-XOR) structure
  // 128-bit block size, 128-bit key, 80 rounds

  /**
   * CHAM-128/128 encryption function
   * @param {Uint8Array} key - 16-byte key
   * @param {Uint8Array} input - 16-byte input block
   * @returns {Uint8Array} - 16-byte output block
   */
  function cham128_128_encrypt(key, input) {
    // Unpack key and generate key schedule
    const k = new Array(8);
    k[0] = OpCodes.Pack32LE(key[0], key[1], key[2], key[3]);
    k[1] = OpCodes.Pack32LE(key[4], key[5], key[6], key[7]);
    k[2] = OpCodes.Pack32LE(key[8], key[9], key[10], key[11]);
    k[3] = OpCodes.Pack32LE(key[12], key[13], key[14], key[15]);

    // Key schedule generation (from C reference)
    k[4] = (k[1] ^ OpCodes.RotL32(k[1], 1) ^ OpCodes.RotL32(k[1], 11)) >>> 0;
    k[5] = (k[0] ^ OpCodes.RotL32(k[0], 1) ^ OpCodes.RotL32(k[0], 11)) >>> 0;
    k[6] = (k[3] ^ OpCodes.RotL32(k[3], 1) ^ OpCodes.RotL32(k[3], 11)) >>> 0;
    k[7] = (k[2] ^ OpCodes.RotL32(k[2], 1) ^ OpCodes.RotL32(k[2], 11)) >>> 0;
    k[0] = (k[0] ^ OpCodes.RotL32(k[0], 1) ^ OpCodes.RotL32(k[0], 8)) >>> 0;
    k[1] = (k[1] ^ OpCodes.RotL32(k[1], 1) ^ OpCodes.RotL32(k[1], 8)) >>> 0;
    k[2] = (k[2] ^ OpCodes.RotL32(k[2], 1) ^ OpCodes.RotL32(k[2], 8)) >>> 0;
    k[3] = (k[3] ^ OpCodes.RotL32(k[3], 1) ^ OpCodes.RotL32(k[3], 8)) >>> 0;

    // Unpack input block
    let x0 = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
    let x1 = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
    let x2 = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
    let x3 = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);

    // Perform 80 rounds (8 at a time)
    for (let round = 0; round < 80; round += 8) {
      // Round operations: ((x ^ round_const) + (rotate(next_x) ^ key))
      x0 = OpCodes.RotL32(((x0 ^ round) + (OpCodes.RotL32(x1, 1) ^ k[0])) >>> 0, 8);
      x1 = OpCodes.RotL32(((x1 ^ (round + 1)) + (OpCodes.RotL32(x2, 8) ^ k[1])) >>> 0, 1);
      x2 = OpCodes.RotL32(((x2 ^ (round + 2)) + (OpCodes.RotL32(x3, 1) ^ k[2])) >>> 0, 8);
      x3 = OpCodes.RotL32(((x3 ^ (round + 3)) + (OpCodes.RotL32(x0, 8) ^ k[3])) >>> 0, 1);
      x0 = OpCodes.RotL32(((x0 ^ (round + 4)) + (OpCodes.RotL32(x1, 1) ^ k[4])) >>> 0, 8);
      x1 = OpCodes.RotL32(((x1 ^ (round + 5)) + (OpCodes.RotL32(x2, 8) ^ k[5])) >>> 0, 1);
      x2 = OpCodes.RotL32(((x2 ^ (round + 6)) + (OpCodes.RotL32(x3, 1) ^ k[6])) >>> 0, 8);
      x3 = OpCodes.RotL32(((x3 ^ (round + 7)) + (OpCodes.RotL32(x0, 8) ^ k[7])) >>> 0, 1);
    }

    // Pack output block
    const output = new Uint8Array(16);
    const b0 = OpCodes.Unpack32LE(x0);
    const b1 = OpCodes.Unpack32LE(x1);
    const b2 = OpCodes.Unpack32LE(x2);
    const b3 = OpCodes.Unpack32LE(x3);
    output.set(b0, 0);
    output.set(b1, 4);
    output.set(b2, 8);
    output.set(b3, 12);
    return output;
  }

  // ========================[ COMET-128 AEAD Mode ]========================

  /**
   * Adjusts Z state for next block (Galois Field doubling in GF(2^64))
   * Doubles the 64-bit prefix in the F(2^64) field
   * @param {Uint8Array} Z - 16-byte Z state (modified in place)
   */
  function comet_adjust_block_key(Z) {
    // Carry bit from bit 63 (byte 7, bit 7)
    const mask = (Z[7] & 0x80) ? 0x1B : 0x00;

    // Left shift by 1 bit across 8 bytes
    for (let i = 7; i > 0; --i) {
      Z[i] = ((Z[i] << 1) | (Z[i - 1] >>> 7)) & 0xFF;
    }
    Z[0] = ((Z[0] << 1) ^ mask) & 0xFF;
  }

  /**
   * Shuffle function for 128-bit blocks
   * Permutes: [x0, x1, x2, x3] -> [x3, ROR1(x2), x0, x1]
   * @param {Uint8Array} block - 16-byte block
   * @returns {Uint8Array} - Shuffled 16-byte block
   */
  function comet_shuffle_block_128(block) {
    // Pack bytes to 32-bit words
    const x0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    const x1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
    const x2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
    const x3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

    // Shuffle: [x3, ROR1(x2), x0, x1]
    const output = new Uint8Array(16);
    output.set(OpCodes.Unpack32LE(x3), 0);
    output.set(OpCodes.Unpack32LE(OpCodes.RotR32(x2, 1)), 4);
    output.set(OpCodes.Unpack32LE(x0), 8);
    output.set(OpCodes.Unpack32LE(x1), 12);
    return output;
  }

  /**
   * Process associated data
   * @param {Uint8Array} Y - 16-byte Y state (modified in place)
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
    while (offset + 16 <= adlen) {
      comet_adjust_block_key(Z);
      const encrypted = cham128_128_encrypt(Z, Y);
      Y.set(encrypted);

      // XOR with AD block
      for (let i = 0; i < 16; ++i) {
        Y[i] ^= ad[offset + i];
      }
      offset += 16;
    }

    // Process partial block
    if (offset < adlen) {
      const remaining = adlen - offset;
      Z[15] ^= 0x10;
      comet_adjust_block_key(Z);
      const encrypted = cham128_128_encrypt(Z, Y);
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
   * @param {Uint8Array} Y - 16-byte Y state (modified in place)
   * @param {Uint8Array} Z - 16-byte Z state (modified in place)
   * @param {Uint8Array} key - 16-byte key
   * @param {Uint8Array} plaintext - Input plaintext
   * @returns {Uint8Array} - Ciphertext (same length as plaintext)
   */
  function comet_encrypt_128(Y, Z, key, plaintext) {
    // Domain separator for payload data
    Z[15] ^= 0x20;

    const ciphertext = new Uint8Array(plaintext.length);
    let offset = 0;
    const mlen = plaintext.length;

    // Process full blocks
    while (offset + 16 <= mlen) {
      comet_adjust_block_key(Z);
      const encrypted = cham128_128_encrypt(Z, Y);
      Y.set(encrypted);

      const Ys = comet_shuffle_block_128(Y);

      // Update Y with plaintext
      for (let i = 0; i < 16; ++i) {
        Y[i] ^= plaintext[offset + i];
      }

      // Ciphertext = plaintext XOR shuffled Y
      for (let i = 0; i < 16; ++i) {
        ciphertext[offset + i] = plaintext[offset + i] ^ Ys[i];
      }

      offset += 16;
    }

    // Process partial block
    if (offset < mlen) {
      const remaining = mlen - offset;
      Z[15] ^= 0x40;
      comet_adjust_block_key(Z);
      const encrypted = cham128_128_encrypt(Z, Y);
      Y.set(encrypted);

      const Ys = comet_shuffle_block_128(Y);

      // Update Y with partial plaintext
      for (let i = 0; i < remaining; ++i) {
        Y[i] ^= plaintext[offset + i];
      }
      Y[remaining] ^= 0x01; // Padding

      // Ciphertext = plaintext XOR shuffled Y
      for (let i = 0; i < remaining; ++i) {
        ciphertext[offset + i] = plaintext[offset + i] ^ Ys[i];
      }
    }

    return ciphertext;
  }

  /**
   * Decrypt ciphertext
   * @param {Uint8Array} Y - 16-byte Y state (modified in place)
   * @param {Uint8Array} Z - 16-byte Z state (modified in place)
   * @param {Uint8Array} key - 16-byte key
   * @param {Uint8Array} ciphertext - Input ciphertext
   * @returns {Uint8Array} - Plaintext (same length as ciphertext)
   */
  function comet_decrypt_128(Y, Z, key, ciphertext) {
    // Domain separator for payload data
    Z[15] ^= 0x20;

    const plaintext = new Uint8Array(ciphertext.length);
    let offset = 0;
    const clen = ciphertext.length;

    // Process full blocks
    while (offset + 16 <= clen) {
      comet_adjust_block_key(Z);
      const encrypted = cham128_128_encrypt(Z, Y);
      Y.set(encrypted);

      const Ys = comet_shuffle_block_128(Y);

      // Plaintext = ciphertext XOR shuffled Y
      for (let i = 0; i < 16; ++i) {
        plaintext[offset + i] = ciphertext[offset + i] ^ Ys[i];
      }

      // Update Y with plaintext
      for (let i = 0; i < 16; ++i) {
        Y[i] ^= plaintext[offset + i];
      }

      offset += 16;
    }

    // Process partial block
    if (offset < clen) {
      const remaining = clen - offset;
      Z[15] ^= 0x40;
      comet_adjust_block_key(Z);
      const encrypted = cham128_128_encrypt(Z, Y);
      Y.set(encrypted);

      const Ys = comet_shuffle_block_128(Y);

      // Plaintext = ciphertext XOR shuffled Y
      for (let i = 0; i < remaining; ++i) {
        plaintext[offset + i] = ciphertext[offset + i] ^ Ys[i];
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

  class CometChamAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "COMET-128-CHAM";
      this.description = "NIST Lightweight Cryptography candidate providing authenticated encryption with 128-bit security. Uses CHAM-128/128 block cipher in CTR-like mode with authentication tag.";
      this.inventor = "Donghoon Chang, Mohona Ghosh, Kishan Chand Gupta, Arpan Jati, Abhishek Kumar, Dukjae Moon, Indranil Ray, Somitra Kumar Sanadhya";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight AEAD";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.IN; // India (Primarily), with contributors from South Korea

      // Algorithm parameters
      this.SupportedKeySizes = [new KeySize(16, 16, 1)]; // 128-bit key only
      this.SupportedNonceSizes = [new KeySize(16, 16, 1)]; // 128-bit nonce only
      this.SupportedTagSizes = [new KeySize(16, 16, 1)]; // 128-bit tag only

      // Documentation
      this.documentation = [
        new LinkItem("Official COMET Website", "https://www.isical.ac.in/~lightweight/comet/"),
        new LinkItem("NIST LWC Finalist Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/comet-spec-final.pdf"),
        new LinkItem("NIST LWC Project Page", "https://csrc.nist.gov/projects/lightweight-cryptography"),
        new LinkItem("GitHub Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      // Official NIST LWC test vectors (Known Answer Tests)
      this.tests = [
        {
          text: "NIST LWC KAT Count=1: Empty plaintext, empty AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: new Uint8Array(0),
          associatedData: new Uint8Array(0),
          expected: OpCodes.Hex8ToBytes("04744F36AAB6D5F430D7B70B65C82C24")
        },
        {
          text: "NIST LWC KAT Count=2: Empty plaintext, 1-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: new Uint8Array(0),
          associatedData: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("67E521A56812EBA8916FAEED6EF568FC")
        },
        {
          text: "NIST LWC KAT Count=17: Empty plaintext, 16-byte AD (full block)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: new Uint8Array(0),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("D2EB1621D6416296B8D957B4230A3646")
        },
        {
          text: "NIST LWC KAT Count=34: 1-byte plaintext, empty AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00"),
          associatedData: new Uint8Array(0),
          expected: OpCodes.Hex8ToBytes("DA1A04685F162BC5E548AA0BF007FD1786")
        },
        {
          text: "NIST LWC KAT Count=35: 1-byte plaintext, 1-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("16BF66003098F5F7D920B9A7D5C63EF814")
        },
        {
          text: "NIST LWC KAT Count=67: 2-byte plaintext, empty AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("0001"),
          associatedData: new Uint8Array(0),
          expected: OpCodes.Hex8ToBytes("DA8E240846E93BDB066E02B53BD0FE8DC9C5")
        },
        {
          text: "NIST LWC KAT Count=69: 2-byte plaintext, 2-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("0001"),
          associatedData: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("19CB6A66F38FDF38C485CDEA719E1367AC14")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CometChamInstance(this, isInverse);
    }
  }

  // ========================[ Instance Class ]========================

  /**
 * CometCham cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CometChamInstance extends IAeadInstance {
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

      if (nonceBytes.length !== 16) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (must be 16 bytes)");
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
      // Initialize Y and Z states
      const Y = new Uint8Array(this._key);
      const Z = cham128_128_encrypt(this._key, this._nonce);

      // Process associated data if present
      if (this._associatedData && this._associatedData.length > 0) {
        comet_process_ad(Y, Z, this._key, this._associatedData);
      }

      // Encrypt plaintext
      let ciphertext;
      if (plaintext.length > 0) {
        ciphertext = comet_encrypt_128(Y, Z, this._key, plaintext);
      } else {
        ciphertext = new Uint8Array(0);
      }

      // Generate authentication tag
      Z[15] ^= 0x80;
      comet_adjust_block_key(Z);
      const tag = cham128_128_encrypt(Z, Y);

      // Return ciphertext || tag
      const result = new Uint8Array(ciphertext.length + 16);
      result.set(ciphertext, 0);
      result.set(tag, ciphertext.length);
      return Array.from(result);
    }

    _decrypt(ciphertextAndTag) {
      if (ciphertextAndTag.length < 16) {
        throw new Error("Invalid ciphertext: too short for authentication tag");
      }

      // Split ciphertext and tag
      const ciphertext = ciphertextAndTag.slice(0, -16);
      const receivedTag = ciphertextAndTag.slice(-16);

      // Initialize Y and Z states
      const Y = new Uint8Array(this._key);
      const Z = cham128_128_encrypt(this._key, this._nonce);

      // Process associated data if present
      if (this._associatedData && this._associatedData.length > 0) {
        comet_process_ad(Y, Z, this._key, this._associatedData);
      }

      // Decrypt ciphertext
      let plaintext;
      if (ciphertext.length > 0) {
        plaintext = comet_decrypt_128(Y, Z, this._key, ciphertext);
      } else {
        plaintext = new Uint8Array(0);
      }

      // Verify authentication tag
      Z[15] ^= 0x80;
      comet_adjust_block_key(Z);
      const computedTag = cham128_128_encrypt(Z, Y);

      // Constant-time tag comparison
      let tagMatch = true;
      for (let i = 0; i < 16; ++i) {
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
  RegisterAlgorithm(new CometChamAlgorithm());

  return CometChamAlgorithm;
}));
