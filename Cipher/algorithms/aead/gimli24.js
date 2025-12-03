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
      this.words = new Uint32Array(12);
    }

    /**
     * Apply SP-box to a column (3 words at positions i, i+4, i+8)
     * Following the reference implementation's column structure
     */
    spBox(col) {
      const s0 = this.words[col];
      const s4 = this.words[col + 4];
      const s8 = this.words[col + 8];

      // Rotate for diffusion: x = rotl24(s0), y = rotl9(s4)
      const x = OpCodes.RotL32(s0, 24);
      const y = OpCodes.RotL32(s4, 9);

      // SP-box transformations (from internal-gimli24.c):
      // s4 = y ^ x ^ ((x | s8) << 1)
      // s0 = s8 ^ y ^ ((x & y) << 3)
      // s8 = x ^ (s8 << 1) ^ ((y & s8) << 2)
      this.words[col + 4] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(y, x), OpCodes.Shl32(OpCodes.OrN(x, s8), 1)));
      this.words[col] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(s8, y), OpCodes.Shl32(OpCodes.AndN(x, y), 3)));
      this.words[col + 8] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(x, OpCodes.Shl32(s8, 1)), OpCodes.Shl32(OpCodes.AndN(y, s8), 2)));
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
        this.words[0] = OpCodes.XorN(OpCodes.XorN(this.words[1], 0x9e377900), round); // Round constant
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
     */
    loadBytes(bytes, offset, count) {
      for (let i = 0; i < count && i < GIMLI24_STATE_SIZE; i += 4) {
        const wordIndex = OpCodes.Shr32(offset + i, 2);
        if (wordIndex < 12) {
          this.words[wordIndex] = OpCodes.Pack32LE(
            bytes[i] || 0,
            bytes[i + 1] || 0,
            bytes[i + 2] || 0,
            bytes[i + 3] || 0
          );
        }
      }
    }

    /**
     * Store state words to bytes (little-endian)
     */
    storeBytes(offset, count) {
      const result = [];
      for (let i = 0; i < count; i += 4) {
        const wordIndex = OpCodes.Shr32(offset + i, 2);
        if (wordIndex < 12) {
          const wordBytes = OpCodes.Unpack32LE(this.words[wordIndex]);
          result.push(wordBytes[0], wordBytes[1], wordBytes[2], wordBytes[3]);
        }
      }
      return result.slice(0, count);
    }

    /**
     * XOR bytes into state at specified offset
     */
    xorBytes(bytes, offset) {
      for (let i = 0; i < bytes.length && (offset + i) < GIMLI24_STATE_SIZE; ++i) {
        const wordIndex = OpCodes.Shr32(offset + i, 2);
        const byteInWord = OpCodes.AndN(offset + i, 3);
        const mask = OpCodes.Shl32(0xFF, byteInWord * 8);
        const cleared = OpCodes.AndN(this.words[wordIndex], ~mask);
        const currentByte = OpCodes.AndN(OpCodes.Shr32(this.words[wordIndex], byteInWord * 8), 0xFF);
        const newByte = OpCodes.AndN(OpCodes.XorN(currentByte, bytes[i]), 0xFF);
        this.words[wordIndex] = OpCodes.ToUint32(OpCodes.OrN(cleared, OpCodes.Shl32(newByte, byteInWord * 8)));
      }
    }

    /**
     * Read bytes from state without modification
     */
    getBytes(offset, count) {
      const result = [];
      for (let i = 0; i < count && (offset + i) < GIMLI24_STATE_SIZE; ++i) {
        const wordIndex = OpCodes.Shr32(offset + i, 2);
        const byteInWord = OpCodes.AndN(offset + i, 3);
        result.push(OpCodes.AndN(OpCodes.Shr32(this.words[wordIndex], byteInWord * 8), 0xFF));
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this.adBuffer = [];
      this.dataBuffer = [];
      this.adProcessed = false;
      this.state = new Gimli24State();
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

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Associated data property (inherited from IAeadInstance)
    set aad(aadBytes) {
      if (!aadBytes) {
        this.adBuffer = [];
        return;
      }
      this.adBuffer = [...aadBytes];
    }

    get aad() {
      return [...this.adBuffer];
    }

    /**
     * Initialize state with nonce and key, then permute
     */
    initializeState() {
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      this.state.clear();

      // Load nonce (16 bytes) into first 4 words
      this.state.loadBytes(this._nonce, 0, GIMLI24_NONCE_SIZE);

      // Load key (32 bytes) into words 4-11
      this.state.loadBytes(this._key, 16, GIMLI24_KEY_SIZE);

      // Initial permutation
      this.state.permute();
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
        this.state.xorBytes(this.adBuffer.slice(adPos, adPos + GIMLI24_BLOCK_SIZE), 0);
        this.state.permute();
        adPos += GIMLI24_BLOCK_SIZE;
        adLen -= GIMLI24_BLOCK_SIZE;
      }

      // Process final partial block with padding
      if (adLen > 0) {
        this.state.xorBytes(this.adBuffer.slice(adPos, adPos + adLen), 0);
      }

      // Padding: XOR 0x01 at position adLen and position 47
      const wordIndex1 = OpCodes.Shr32(adLen, 2);
      const byteInWord1 = OpCodes.AndN(adLen, 3);
      const mask1 = OpCodes.Shl32(0xFF, byteInWord1 * 8);
      const cleared1 = OpCodes.AndN(this.state.words[wordIndex1], ~mask1);
      const currentByte1 = OpCodes.AndN(OpCodes.Shr32(this.state.words[wordIndex1], byteInWord1 * 8), 0xFF);
      this.state.words[wordIndex1] = OpCodes.ToUint32(OpCodes.OrN(cleared1, OpCodes.Shl32(OpCodes.XorN(currentByte1, 0x01), byteInWord1 * 8)));

      // XOR 0x01 at byte position 47 (word 11, byte 3)
      this.state.words[11] = OpCodes.XorN(this.state.words[11], 0x01000000);

      this.state.permute();
      this.adProcessed = true;
    }

    /**
     * Encrypt data blocks (XOR with state, update state)
     */
    encryptData() {
      const ciphertext = [];
      let dataLen = this.dataBuffer.length;
      let dataPos = 0;

      // Process full blocks
      while (dataLen >= GIMLI24_BLOCK_SIZE) {
        const block = this.dataBuffer.slice(dataPos, dataPos + GIMLI24_BLOCK_SIZE);
        const stateBytes = this.state.getBytes(0, GIMLI24_BLOCK_SIZE);

        // XOR plaintext with state to get ciphertext
        for (let i = 0; i < GIMLI24_BLOCK_SIZE; ++i) {
          ciphertext.push(OpCodes.XorN(stateBytes[i], block[i]));
        }

        this.state.permute();
        dataPos += GIMLI24_BLOCK_SIZE;
        dataLen -= GIMLI24_BLOCK_SIZE;
      }

      // Process final partial block with padding
      if (dataLen > 0) {
        const block = this.dataBuffer.slice(dataPos, dataPos + dataLen);
        const stateBytes = this.state.getBytes(0, dataLen);

        for (let i = 0; i < dataLen; ++i) {
          ciphertext.push(OpCodes.XorN(stateBytes[i], block[i]));
        }
      }

      // Padding after encryption
      const wordIndex1 = OpCodes.Shr32(dataLen, 2);
      const byteInWord1 = OpCodes.AndN(dataLen, 3);
      const mask1 = OpCodes.Shl32(0xFF, byteInWord1 * 8);
      const cleared1 = OpCodes.AndN(this.state.words[wordIndex1], ~mask1);
      const currentByte1 = OpCodes.AndN(OpCodes.Shr32(this.state.words[wordIndex1], byteInWord1 * 8), 0xFF);
      this.state.words[wordIndex1] = OpCodes.ToUint32(OpCodes.OrN(cleared1, OpCodes.Shl32(OpCodes.XorN(currentByte1, 0x01), byteInWord1 * 8)));

      // XOR 0x01 at byte position 47
      this.state.words[11] = OpCodes.XorN(this.state.words[11], 0x01000000);

      this.state.permute();

      return ciphertext;
    }

    /**
     * Decrypt data blocks (XOR with state, update state with ciphertext)
     */
    decryptData() {
      const plaintext = [];
      let dataLen = this.dataBuffer.length;
      let dataPos = 0;

      // Process full blocks
      while (dataLen >= GIMLI24_BLOCK_SIZE) {
        const block = this.dataBuffer.slice(dataPos, dataPos + GIMLI24_BLOCK_SIZE);
        const stateBytes = this.state.getBytes(0, GIMLI24_BLOCK_SIZE);

        // XOR ciphertext with state to get plaintext
        const ptBlock = [];
        for (let i = 0; i < GIMLI24_BLOCK_SIZE; ++i) {
          ptBlock.push(OpCodes.XorN(stateBytes[i], block[i]));
        }
        plaintext.push(...ptBlock);

        // Update state with ciphertext (swap operation)
        this.state.xorBytes(block, 0);
        this.state.xorBytes(ptBlock, 0);

        this.state.permute();
        dataPos += GIMLI24_BLOCK_SIZE;
        dataLen -= GIMLI24_BLOCK_SIZE;
      }

      // Process final partial block with padding
      if (dataLen > 0) {
        const block = this.dataBuffer.slice(dataPos, dataPos + dataLen);
        const stateBytes = this.state.getBytes(0, dataLen);

        const ptBlock = [];
        for (let i = 0; i < dataLen; ++i) {
          ptBlock.push(OpCodes.XorN(stateBytes[i], block[i]));
        }
        plaintext.push(...ptBlock);

        // Update state with ciphertext (swap operation)
        this.state.xorBytes(block, 0);
        this.state.xorBytes(ptBlock, 0);
      }

      // Padding after decryption
      const wordIndex1 = OpCodes.Shr32(dataLen, 2);
      const byteInWord1 = OpCodes.AndN(dataLen, 3);
      const mask1 = OpCodes.Shl32(0xFF, byteInWord1 * 8);
      const cleared1 = OpCodes.AndN(this.state.words[wordIndex1], ~mask1);
      const currentByte1 = OpCodes.AndN(OpCodes.Shr32(this.state.words[wordIndex1], byteInWord1 * 8), 0xFF);
      this.state.words[wordIndex1] = OpCodes.ToUint32(OpCodes.OrN(cleared1, OpCodes.Shl32(OpCodes.XorN(currentByte1, 0x01), byteInWord1 * 8)));

      // XOR 0x01 at byte position 47
      this.state.words[11] = OpCodes.XorN(this.state.words[11], 0x01000000);

      this.state.permute();

      return plaintext;
    }

    /**
     * Feed data for processing
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      this.dataBuffer.push(...data);
    }

    /**
     * Result: Encrypt or decrypt and return data with/without tag
     */
    Result() {
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      // Initialize state
      this.initializeState();

      // Absorb associated data
      this.absorbAD();

      let result;

      if (this.isInverse) {
        // Decrypt mode: extract tag, decrypt, verify tag
        if (this.dataBuffer.length < GIMLI24_TAG_SIZE) {
          throw new Error('Ciphertext too short (no tag)');
        }

        // Split ciphertext and tag
        const ctLen = this.dataBuffer.length - GIMLI24_TAG_SIZE;
        const ciphertext = this.dataBuffer.slice(0, ctLen);
        const receivedTag = this.dataBuffer.slice(ctLen, ctLen + GIMLI24_TAG_SIZE);

        // Decrypt
        this.dataBuffer = ciphertext;
        const plaintext = this.decryptData();

        // Generate tag and verify
        const computedTag = this.state.getBytes(0, GIMLI24_TAG_SIZE);

        // Constant-time tag comparison
        let tagMatch = 0;
        for (let i = 0; i < GIMLI24_TAG_SIZE; ++i) {
          tagMatch = OpCodes.OrN(tagMatch, OpCodes.XorN(computedTag[i], receivedTag[i]));
        }

        if (tagMatch !== 0) {
          throw new Error('Authentication tag verification failed');
        }

        result = plaintext;
      } else {
        // Encrypt mode: encrypt and append tag
        const ciphertext = this.encryptData();
        const tag = this.state.getBytes(0, GIMLI24_TAG_SIZE);
        result = ciphertext.concat(tag);
      }

      // Reset for next operation
      this.dataBuffer = [];
      this.adBuffer = [];
      this.adProcessed = false;
      this.state.clear();

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
