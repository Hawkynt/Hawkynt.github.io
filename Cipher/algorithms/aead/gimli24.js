/*
 * Gimli-24 AEAD - NIST Lightweight Cryptography Competition Candidate
 * Professional implementation following official C reference implementation
 * (c)2006-2025 Hawkynt
 *
 * Gimli-24 is a 384-bit permutation-based authenticated encryption algorithm
 * that participated in the NIST Lightweight Cryptography Competition.
 *
 * Features:
 * - 256-bit keys, 128-bit nonces, 128-bit tags
 * - 384-bit (48-byte) state with 24-round permutation
 * - SP-box column operations with rotation-based diffusion
 * - 16-byte rate for data absorption and encryption
 *
 * Reference: https://gimli.cr.yp.to/
 * C Implementation: Southern Storm Software lightweight-crypto library
 * Specification: https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-1/spec-doc/gimli-spec.pdf
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

  // Constants from reference implementation
  const GIMLI24_KEY_SIZE = 32;     // 256 bits
  const GIMLI24_NONCE_SIZE = 16;   // 128 bits
  const GIMLI24_TAG_SIZE = 16;     // 128 bits
  const GIMLI24_BLOCK_SIZE = 16;   // 16 bytes rate
  const GIMLI24_STATE_SIZE = 48;   // 384 bits = 12 x 32-bit words

  /**
   * Gimli-24 permutation state and operations
   */
  class Gimli24State {
    constructor() {
      // State: 12 x 32-bit words (48 bytes total, 384 bits)
      // Organized as 3 rows x 4 columns for SP-box operations
      /** @type {uint32[]} */
      this.words = new Uint32Array(12);
    }

    /**
     * Apply SP-box to a column (3 words at positions i, i+4, i+8)
     * Following the reference implementation's column structure
     * @param {int32} col
     */
    spBox(col) {
      /** @type {uint32} */
      const s0 = this.words[col];
      /** @type {uint32} */
      const s4 = this.words[col + 4];
      /** @type {uint32} */
      const s8 = this.words[col + 8];

      // Rotate for diffusion: x = rotl24(s0), y = rotl9(s4)
      const x = OpCodes.RotL32(s0, 24);
      const y = OpCodes.RotL32(s4, 9);

      // SP-box transformations (from internal-gimli24.c):
      // s4 = y^x^(left-shift((x|s8), 1))
      // s0 = s8^y^(left-shift((x&y), 3))
      // s8 = x^(left-shift(s8, 1))^(left-shift((y&s8), 2))
      this.words[col + 4] = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32(OpCodes.Or32(x, s8), 1));
      this.words[col] = OpCodes.Xor32(OpCodes.Xor32(s8, y), OpCodes.Shl32(OpCodes.And32(x, y), 3));
      this.words[col + 8] = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(s8, 1)), OpCodes.Shl32(OpCodes.And32(y, s8), 2));
    }

    /**
     * Gimli-24 permutation: 24 rounds with SP-box and linear mixing
     * Reference: internal-gimli24.c::gimli24_permute()
     */
    permute() {
      // Process 24 rounds in groups of 4 (unrolled pattern from reference)
      for (let round = 24; round > 0; round -= 4) {
        // Round 0 (of 4): SP-box, small swap, add round constant
        this.spBox(0);
        this.spBox(1);
        this.spBox(2);
        this.spBox(3);

        // Small swap: rotate first row (words 0-3) by 1 position
        const x = this.words[0];
        const y = this.words[2];
        this.words[0] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(this.words[1], 0x9e377900), round)); // Round constant
        this.words[1] = x;
        this.words[2] = this.words[3];
        this.words[3] = y;

        // Round 1 (of 4): SP-box only
        this.spBox(0);
        this.spBox(1);
        this.spBox(2);
        this.spBox(3);

        // Round 2 (of 4): SP-box, big swap
        this.spBox(0);
        this.spBox(1);
        this.spBox(2);
        this.spBox(3);

        // Big swap: swap first two rows (words 0-3 with words 4-7)
        const x2 = this.words[0];
        const y2 = this.words[1];
        this.words[0] = this.words[2];
        this.words[1] = this.words[3];
        this.words[2] = x2;
        this.words[3] = y2;

        // Round 3 (of 4): SP-box only
        this.spBox(0);
        this.spBox(1);
        this.spBox(2);
        this.spBox(3);
      }
    }

    /**
     * Load bytes into state (little-endian 32-bit words)
     * @param {uint8[]} bytes
     * @param {int32} offset
     * @param {int32} count
     */
    loadBytes(bytes, offset, count) {
      for (let i = 0; i < count && i < GIMLI24_STATE_SIZE; i += 4) {
        const wordIndex = Math.floor((offset + i) / 4);
        if (wordIndex < 12) {
          this.words[wordIndex] = OpCodes.Pack32LE(
            i < bytes.length ? bytes[i] : 0,
            i + 1 < bytes.length ? bytes[i + 1] : 0,
            i + 2 < bytes.length ? bytes[i + 2] : 0,
            i + 3 < bytes.length ? bytes[i + 3] : 0
          );
        }
      }
    }

    /**
     * Store state words to bytes (little-endian)
     * @param {int32} offset
     * @param {int32} count
     * @returns {uint8[]}
     */
    storeBytes(offset, count) {
      /** @type {uint8[]} */
      const result = [];
      for (let i = 0; i < count; i += 4) {
        const wordIndex = Math.floor((offset + i) / 4);
        if (wordIndex < 12) {
          const wordBytes = OpCodes.Unpack32LE(this.words[wordIndex]);
          result.push(wordBytes[0]);
          result.push(wordBytes[1]);
          result.push(wordBytes[2]);
          result.push(wordBytes[3]);
        }
      }
      return result.slice(0, count);
    }

    /**
     * XOR bytes into state at specified offset
     * @param {uint8[]} bytes
     * @param {int32} offset
     */
    xorBytes(bytes, offset) {
      for (let i = 0; i < bytes.length && (offset + i) < GIMLI24_STATE_SIZE; ++i) {
        const wordIndex = Math.floor((offset + i) / 4);
        const byteInWord = OpCodes.And32(offset + i, 3);
        const mask = OpCodes.Shl32(0xFF, byteInWord * 8);
        const cleared = OpCodes.And32(this.words[wordIndex], OpCodes.Not32(mask));
        const currentByte = OpCodes.ToByte(OpCodes.Shr32(this.words[wordIndex], byteInWord * 8));
        const newByte = OpCodes.ToByte(OpCodes.Xor32(currentByte, bytes[i]));
        this.words[wordIndex] = OpCodes.Or32(cleared, OpCodes.Shl32(newByte, byteInWord * 8));
      }
    }

    /**
     * Read bytes from state without modification
     * @param {int32} offset
     * @param {int32} count
     * @returns {uint8[]}
     */
    getBytes(offset, count) {
      /** @type {uint8[]} */
      const result = [];
      for (let i = 0; i < count && (offset + i) < GIMLI24_STATE_SIZE; ++i) {
        const wordIndex = Math.floor((offset + i) / 4);
        const byteInWord = OpCodes.And32(offset + i, 3);
        result.push(OpCodes.ToByte(OpCodes.Shr32(this.words[wordIndex], byteInWord * 8)));
      }
      return result;
    }

    /**
     * Clear state
     */
    clear() {
      for (let i = 0; i < 12; ++i) {
        this.words[i] = 0;
      }
    }
  }

  /**
   * Gimli-24 AEAD instance implementing Feed/Result pattern
   */
  class Gimli24Instance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Gimli24Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._nonce = null;
      /** @type {uint8[]} */
      this.adBuffer = [];
      /** @type {uint8[]} */
      this.dataBuffer = [];
      /** @type {boolean} */
      this.adProcessed = false;
      /** @type {Gimli24State} */
      this.perm = new Gimli24State();
    }

    // Key property (256 bits = 32 bytes)
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

      if (keyBytes.length !== GIMLI24_KEY_SIZE) {
        throw new Error('Invalid key size: ' + keyBytes.length + ' bytes (expected 32 bytes)');
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

    // Nonce property (128 bits = 16 bytes)
    /**
     * @param {uint8[]|null} nonceBytes
     */
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== GIMLI24_NONCE_SIZE) {
        throw new Error('Invalid nonce size: ' + nonceBytes.length + ' bytes (expected 16 bytes)');
      }

      this._nonce = [...nonceBytes];
    }

    /**
     * @returns {uint8[]|null}
     */
    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Associated data property (inherited from IAeadInstance)
    /**
     * @param {uint8[]|null} aadBytes
     */
    set aad(aadBytes) {
      if (!aadBytes) {
        this.adBuffer = [];
        return;
      }
      this.adBuffer = [...aadBytes];
    }

    /**
     * @returns {uint8[]|null}
     */
    get aad() {
      return [...this.adBuffer];
    }

    /**
     * Initialize state with nonce and key, then permute
     */
    initializeState() {
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      this.perm.clear();

      // Load nonce (16 bytes) into first 4 words
      this.perm.loadBytes(this._nonce, 0, GIMLI24_NONCE_SIZE);

      // Load key (32 bytes) into words 4-11
      this.perm.loadBytes(this._key, 16, GIMLI24_KEY_SIZE);

      // Initial permutation
      this.perm.permute();
    }

    /**
     * Absorb associated data (with padding)
     */
    absorbAD() {
      if (this.adProcessed) return;

      let adLen = this.adBuffer.length;
      let adPos = 0;

      // Process full blocks
      while (adLen >= GIMLI24_BLOCK_SIZE) {
        this.perm.xorBytes(this.adBuffer.slice(adPos, adPos + GIMLI24_BLOCK_SIZE), 0);
        this.perm.permute();
        adPos += GIMLI24_BLOCK_SIZE;
        adLen -= GIMLI24_BLOCK_SIZE;
      }

      // Process final partial block with padding
      if (adLen > 0) {
        this.perm.xorBytes(this.adBuffer.slice(adPos, adPos + adLen), 0);
      }

      // Padding: XOR 0x01 at position adLen and position 47
      const wordIndex1 = Math.floor(adLen / 4);
      const byteInWord1 = OpCodes.And32(adLen, 3);
      const mask1 = OpCodes.Shl32(0xFF, byteInWord1 * 8);
      const cleared1 = OpCodes.And32(this.perm.words[wordIndex1], OpCodes.Not32(mask1));
      const currentByte1 = OpCodes.ToByte(OpCodes.Shr32(this.perm.words[wordIndex1], byteInWord1 * 8));
      this.perm.words[wordIndex1] = OpCodes.Or32(cleared1, OpCodes.Shl32(OpCodes.Xor32(currentByte1, 0x01), byteInWord1 * 8));

      // XOR 0x01 at byte position 47 (word 11, byte 3)
      this.perm.words[11] = OpCodes.Xor32(this.perm.words[11], 0x01000000);

      this.perm.permute();
      this.adProcessed = true;
    }

    /**
     * Encrypt data blocks (XOR with state, update state)
     * @returns {uint8[]}
     */
    encryptData() {
      /** @type {uint8[]} */
      const ciphertext = [];
      let dataLen = this.dataBuffer.length;
      let dataPos = 0;

      // Process full blocks
      while (dataLen >= GIMLI24_BLOCK_SIZE) {
        /** @type {uint8[]} */
        const block = this.dataBuffer.slice(dataPos, dataPos + GIMLI24_BLOCK_SIZE);
        /** @type {uint8[]} */
        const stateBytes = this.perm.getBytes(0, GIMLI24_BLOCK_SIZE);

        // XOR plaintext with state to get ciphertext
        for (let i = 0; i < GIMLI24_BLOCK_SIZE; ++i) {
          ciphertext.push(OpCodes.Xor32(stateBytes[i], block[i]));
        }

        // Duplex rule: absorb the plaintext so the rate now holds the ciphertext
        this.perm.xorBytes(block, 0);

        this.perm.permute();
        dataPos += GIMLI24_BLOCK_SIZE;
        dataLen -= GIMLI24_BLOCK_SIZE;
      }

      // Process final partial block with padding
      if (dataLen > 0) {
        /** @type {uint8[]} */
        const block = this.dataBuffer.slice(dataPos, dataPos + dataLen);
        /** @type {uint8[]} */
        const stateBytes = this.perm.getBytes(0, dataLen);

        for (let i = 0; i < dataLen; ++i) {
          ciphertext.push(OpCodes.Xor32(stateBytes[i], block[i]));
        }

        // Duplex rule: absorb the plaintext so the rate now holds the ciphertext
        this.perm.xorBytes(block, 0);
      }

      // Padding after encryption
      const wordIndex1 = Math.floor(dataLen / 4);
      const byteInWord1 = OpCodes.And32(dataLen, 3);
      const mask1 = OpCodes.Shl32(0xFF, byteInWord1 * 8);
      const cleared1 = OpCodes.And32(this.perm.words[wordIndex1], OpCodes.Not32(mask1));
      const currentByte1 = OpCodes.ToByte(OpCodes.Shr32(this.perm.words[wordIndex1], byteInWord1 * 8));
      this.perm.words[wordIndex1] = OpCodes.Or32(cleared1, OpCodes.Shl32(OpCodes.Xor32(currentByte1, 0x01), byteInWord1 * 8));

      // XOR 0x01 at byte position 47
      this.perm.words[11] = OpCodes.Xor32(this.perm.words[11], 0x01000000);

      this.perm.permute();

      return ciphertext;
    }

    /**
     * Decrypt data blocks (XOR with state, update state with ciphertext)
     * @returns {uint8[]}
     */
    decryptData() {
      /** @type {uint8[]} */
      const plaintext = [];
      let dataLen = this.dataBuffer.length;
      let dataPos = 0;

      // Process full blocks
      while (dataLen >= GIMLI24_BLOCK_SIZE) {
        /** @type {uint8[]} */
        const block = this.dataBuffer.slice(dataPos, dataPos + GIMLI24_BLOCK_SIZE);
        /** @type {uint8[]} */
        const stateBytes = this.perm.getBytes(0, GIMLI24_BLOCK_SIZE);

        // XOR ciphertext with state to get plaintext
        /** @type {uint8[]} */
        const ptBlock = [];
        for (let i = 0; i < GIMLI24_BLOCK_SIZE; ++i) {
          ptBlock.push(OpCodes.Xor32(stateBytes[i], block[i]));
        }
        for (let _i = 0; _i < ptBlock.length; _i++) plaintext.push(ptBlock[_i]);

        // Duplex rule: the rate must end up holding the ciphertext.
        // state XOR plaintext == ciphertext, because plaintext == state XOR ciphertext.
        this.perm.xorBytes(ptBlock, 0);

        this.perm.permute();
        dataPos += GIMLI24_BLOCK_SIZE;
        dataLen -= GIMLI24_BLOCK_SIZE;
      }

      // Process final partial block with padding
      if (dataLen > 0) {
        /** @type {uint8[]} */
        const block = this.dataBuffer.slice(dataPos, dataPos + dataLen);
        /** @type {uint8[]} */
        const stateBytes = this.perm.getBytes(0, dataLen);

        /** @type {uint8[]} */
        const ptBlock = [];
        for (let i = 0; i < dataLen; ++i) {
          ptBlock.push(OpCodes.Xor32(stateBytes[i], block[i]));
        }
        for (let _i = 0; _i < ptBlock.length; _i++) plaintext.push(ptBlock[_i]);

        // Duplex rule: the rate must end up holding the ciphertext.
        // state XOR plaintext == ciphertext, because plaintext == state XOR ciphertext.
        this.perm.xorBytes(ptBlock, 0);
      }

      // Padding after decryption
      const wordIndex1 = Math.floor(dataLen / 4);
      const byteInWord1 = OpCodes.And32(dataLen, 3);
      const mask1 = OpCodes.Shl32(0xFF, byteInWord1 * 8);
      const cleared1 = OpCodes.And32(this.perm.words[wordIndex1], OpCodes.Not32(mask1));
      const currentByte1 = OpCodes.ToByte(OpCodes.Shr32(this.perm.words[wordIndex1], byteInWord1 * 8));
      this.perm.words[wordIndex1] = OpCodes.Or32(cleared1, OpCodes.Shl32(OpCodes.Xor32(currentByte1, 0x01), byteInWord1 * 8));

      // XOR 0x01 at byte position 47
      this.perm.words[11] = OpCodes.Xor32(this.perm.words[11], 0x01000000);

      this.perm.permute();

      return plaintext;
    }

    /**
     * Feed data for processing
     * @param {uint8[]} data
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.dataBuffer.push(data[_i]);
    }

    /**
     * Result: Encrypt or decrypt and return data with/without tag
     * @returns {uint8[]}
     */
    Result() {
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      // Initialize state
      this.initializeState();

      // Absorb associated data
      this.absorbAD();

      /** @type {uint8[]} */
      let result;

      if (this.isInverse) {
        // Decrypt mode: extract tag, decrypt, verify tag
        if (this.dataBuffer.length < GIMLI24_TAG_SIZE) {
          throw new Error('Ciphertext too short (no tag)');
        }

        // Split ciphertext and tag
        const ctLen = this.dataBuffer.length - GIMLI24_TAG_SIZE;
        /** @type {uint8[]} */
        const ciphertext = this.dataBuffer.slice(0, ctLen);
        /** @type {uint8[]} */
        const receivedTag = this.dataBuffer.slice(ctLen, ctLen + GIMLI24_TAG_SIZE);

        // Decrypt
        this.dataBuffer = ciphertext;
        /** @type {uint8[]} */
        const plaintext = this.decryptData();

        // Generate tag and verify
        /** @type {uint8[]} */
        const computedTag = this.perm.getBytes(0, GIMLI24_TAG_SIZE);

        // Constant-time tag comparison
        /** @type {uint32} */
        let tagMatch = 0;
        for (let i = 0; i < GIMLI24_TAG_SIZE; ++i) {
          tagMatch = OpCodes.Or32(tagMatch, OpCodes.Xor32(computedTag[i], receivedTag[i]));
        }

        if (tagMatch !== 0) {
          throw new Error('Authentication tag verification failed');
        }

        result = plaintext;
      } else {
        // Encrypt mode: encrypt and append tag
        /** @type {uint8[]} */
        const ciphertext = this.encryptData();
        /** @type {uint8[]} */
        const tag = this.perm.getBytes(0, GIMLI24_TAG_SIZE);
        result = ciphertext.concat(tag);
      }

      // Reset for next operation
      this.dataBuffer = [];
      this.adBuffer = [];
      this.adProcessed = false;
      this.perm.clear();

      return result;
    }
  }

  /**
   * Gimli-24 AEAD Algorithm
   */
  class Gimli24Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = 'Gimli-24';
      this.description = 'Lightweight authenticated encryption with 384-bit permutation and 24 rounds. NIST LWC competition candidate with compact design optimized for constrained devices.';
      this.inventor = 'Daniel J. Bernstein, Stefan Kolbl, Stefan Lucks, Pedro Maat Costa Massolino, Florian Mendel, Kashif Nawaz, Tobias Schneider, Peter Schwabe, Francois-Xavier Standaert, Yosuke Todo, and Benoit Viguier';
      this.year = 2017;
      this.category = CategoryType.AEAD;
      this.subCategory = 'Authenticated Encryption';
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // Algorithm capabilities
      this.SupportedKeySizes = [new KeySize(32, 32, 1)]; // 256-bit key only
      this.SupportedBlockSizes = [new KeySize(16, 16, 1)]; // 16-byte rate
      this.SupportedTagSizes = [new KeySize(16, 16, 1)]; // 128-bit tag only
      this.SupportsDetached = false;

      // Documentation
      this.documentation = [
        new LinkItem(
          'Official Specification',
          'https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-1/spec-doc/gimli-spec.pdf'
        ),
        new LinkItem(
          'Gimli Website',
          'https://gimli.cr.yp.to/'
        ),
        new LinkItem(
          'NIST LWC Round 1 Submission',
          'https://csrc.nist.gov/Projects/lightweight-cryptography/round-1-candidates'
        ),
        new LinkItem(
          'Reference Implementation',
          'https://github.com/rweather/lightweight-crypto'
        )
      ];

      this.references = [
        new LinkItem(
          'Gimli Reference Implementations (Gimli team)',
          'https://github.com/jedisct1/gimli'
        ),
        new LinkItem(
          'Gimli Hardware Implementation (secworks)',
          'https://github.com/secworks/gimli'
        ),
        new LinkItem(
          'Gimli Go Port of the Reference C Code',
          'https://github.com/bmkessler/gimli'
        )
      ];

      // Official test vectors from GIMLI-24-CIPHER.txt (NIST LWC KAT)
      this.tests = [
        {
          text: 'Count 1 - Empty plaintext and AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: [],
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: [],
          expected: OpCodes.Hex8ToBytes('14DA9BB7120BF58B985A8E00FDEBA15B')
        },
        {
          text: 'Count 2 - Empty plaintext, 1-byte AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: [],
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: OpCodes.Hex8ToBytes('00'),
          expected: OpCodes.Hex8ToBytes('E8D50453F84B575412327D7C0302D8D3')
        },
        {
          text: 'Count 3 - Empty plaintext, 2-byte AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: [],
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: OpCodes.Hex8ToBytes('0001'),
          expected: OpCodes.Hex8ToBytes('776F829EB5DE73D400EF4DEDB2E2772D')
        },
        {
          text: 'Count 34 - 1-byte plaintext, empty AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: OpCodes.Hex8ToBytes('00'),
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: [],
          expected: OpCodes.Hex8ToBytes('7F80492C317B1CD58A1EDC3A0D3E9876FC')
        },
        {
          text: 'Count 496 - 15-byte plaintext (below the 16-byte rate), empty AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E'),
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: [],
          expected: OpCodes.Hex8ToBytes('7F8A2CF4F52AA4D6B2E74105C30A276DE1B05CB36F9546D5DEDDE3F5EA64D1')
        },
        {
          text: 'Count 511 - 15-byte plaintext, 15-byte AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E'),
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E'),
          expected: OpCodes.Hex8ToBytes('1A259C7E82BF80485E65D7EFCE7C35258C36AEFF25F990FB6B23CA3CACA30D')
        },
        {
          text: 'Count 529 - 16-byte plaintext (exactly one rate block), empty AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: [],
          expected: OpCodes.Hex8ToBytes('7F8A2CF4F52AA4D6B2E74105C30A2777B9B7502494528B5160F5EE0F65C3A7B4')
        },
        {
          text: 'Count 545 - 16-byte plaintext, 16-byte AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          expected: OpCodes.Hex8ToBytes('9A93DEC680CA514C36E7DD94E6C7417A5AF0C6AF4582419A3317176F887B67B1')
        },
        {
          text: 'Count 562 - 17-byte plaintext (spans two rate blocks), empty AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F10'),
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: [],
          expected: OpCodes.Hex8ToBytes('7F8A2CF4F52AA4D6B2E74105C30A2777B960057B937A5E002F488DC19DB7B011CF')
        },
        {
          text: 'Count 567 - 17-byte plaintext, 5-byte AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F10'),
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: OpCodes.Hex8ToBytes('0001020304'),
          expected: OpCodes.Hex8ToBytes('1F6649AE35BCB8511B3F60020CEFEEE995F239F4EB51F8EB088431116464570BCB')
        },
        {
          text: 'Count 1057 - 32-byte plaintext (two full rate blocks), empty AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: [],
          expected: OpCodes.Hex8ToBytes('7F8A2CF4F52AA4D6B2E74105C30A2777B9D0C8AEFDD555DE35861BD3011F652F7256456FA935AC34BBF55AE135F33257')
        },
        {
          text: 'Count 1089 - 32-byte plaintext, 32-byte AD',
          uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt',
          input: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          aad: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          expected: OpCodes.Hex8ToBytes('766B3B5E7788272D39EDAD2BCEBAF41606E62076A0FD1494B99527BF45DC138F1A9606DB255937B68E02FEC83E2C54B9')
        }
      ];
    }

    /**
     * Create instance for Feed/Result pattern
     */
    CreateInstance(isInverse = false) {
      return new Gimli24Instance(this, isInverse);
    }
  }

  // Register algorithm
  RegisterAlgorithm(new Gimli24Algorithm());

  return Gimli24Algorithm;
}));
