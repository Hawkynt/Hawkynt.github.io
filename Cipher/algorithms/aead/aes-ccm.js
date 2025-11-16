/*
 * AES-CCM (Counter with CBC-MAC) - NIST AEAD Encryption
 * Professional implementation following RFC 3610 specification
 * (c)2006-2025 Hawkynt
 *
 * AES-CCM is a NIST-standardized authenticated encryption with associated data (AEAD)
 * mode combining AES block cipher with CBC-MAC for authentication and counter mode
 * for encryption. Designed for resource-constrained environments.
 *
 * Features:
 * - 128-bit block cipher (AES only)
 * - Flexible key sizes: 128, 192, 256 bits
 * - Flexible tag sizes: 4, 6, 8, 10, 12, 14, 16 bytes (even values)
 * - Flexible nonce sizes: 7-13 bytes (15 - L parameter)
 * - Supports associated data (AD)
 * - Message length limit: 2^(8*L) bytes where L = 15 - nonce_size
 *
 * RFC 3610: Counter with CBC-MAC (CCM)
 * NIST SP 800-38C: Recommendation for Block Cipher Modes of Operation: The CCM Mode
 * Reference: https://tools.ietf.org/rfc/rfc3610.txt
 * Specification: https://csrc.nist.gov/publications/detail/sp/800-38c/final
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

  // ========================[ AES-CCM MAIN CLASS ]========================

  class AesCcm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = 'AES-CCM';
      this.description = 'AES Counter with CBC-MAC authenticated encryption. NIST-standardized AEAD mode combining AES with CBC-MAC for authentication and counter mode for encryption.';
      this.inventor = 'NIST';
      this.year = 2003;
      this.category = CategoryType.AEAD;
      this.subCategory = 'Authenticated Encryption with Associated Data';
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.SupportedKeySizes = [
        new KeySize(16, 32, 8)  // 128-256 bits in 8-bit increments
      ];

      // CCM can use different nonce sizes. Standard is 13 bytes.
      // L parameter (length field size) = 15 - nonce_size_bytes
      // Valid: L = 2-8, so nonce size = 7-13 bytes
      this.SupportedNonceSizes = [
        new KeySize(7, 13, 1)   // 7-13 bytes
      ];

      // Authentication tag sizes: 4, 6, 8, 10, 12, 14, 16 bytes (even values between 4-16)
      this.SupportedTagSizes = [4, 6, 8, 10, 12, 14, 16];

      this.documentation = [
        new LinkItem('RFC 3610 - Counter with CBC-MAC', 'https://tools.ietf.org/rfc/rfc3610.txt'),
        new LinkItem('NIST SP 800-38C - CCM Mode Recommendation', 'https://csrc.nist.gov/publications/detail/sp/800-38c/final'),
        new LinkItem('NIST Test Vectors', 'https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines'),
        new LinkItem('Botan Reference Implementation', 'https://github.com/randombit/botan/tree/master/src/lib/modes/aead/ccm')
      ];

      // Official test vectors from RFC 3610 and NIST
      this.tests = [
        // RFC 3610 Appendix D Test Vector 1
        {
          text: 'RFC 3610 Test Vector #1 (L=2, M=8)',
          uri: 'https://tools.ietf.org/rfc/rfc3610.txt#appendix-D',
          key: OpCodes.Hex8ToBytes('C0C1C2C3C4C5C6C7C8C9CACBCCCDCECF'),
          nonce: OpCodes.Hex8ToBytes('00000003020100A0A1A2A3A4A5'),
          input: OpCodes.Hex8ToBytes('08090A0B0C0D0E0F101112131415161718191A1B1C1D1E'),
          aad: OpCodes.Hex8ToBytes('0001020304050607'),
          tagSize: 8,
          expected: OpCodes.Hex8ToBytes('588C979A61C663D2F066D0C2C0F989806D5F6B61DAC38417E8D12CFDF926E0')
        },
        // RFC 3610 Appendix D Test Vector 2
        {
          text: 'RFC 3610 Test Vector #2 (L=2, M=10)',
          uri: 'https://tools.ietf.org/rfc/rfc3610.txt#appendix-D',
          key: OpCodes.Hex8ToBytes('C0C1C2C3C4C5C6C7C8C9CACBCCCDCECF'),
          nonce: OpCodes.Hex8ToBytes('00000004030201A0A1A2A3A4A5'),
          input: OpCodes.Hex8ToBytes('08090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          aad: OpCodes.Hex8ToBytes('0001020304050607'),
          tagSize: 10,
          expected: OpCodes.Hex8ToBytes('72C91A36E135F8CF291CA894085C87E3CC15C439C9E43A3BA091D56E10400916')
        },
        // NIST SP 800-38C Appendix C Test Case
        {
          text: 'NIST SP 800-38C Test Vector (empty plaintext)',
          uri: 'https://csrc.nist.gov/publications/detail/sp/800-38c/final',
          key: OpCodes.Hex8ToBytes('2EBF60F0969013A54A3DEDB19D20F6C8'),
          nonce: OpCodes.Hex8ToBytes('1DE8C5E21F9DB33123FF870ADD'),
          input: OpCodes.Hex8ToBytes(''),
          aad: OpCodes.Hex8ToBytes('E1DE6C6119D7DB471136285D10B47A450221B16978569190EF6A22B055295603'),
          tagSize: 16,
          expected: OpCodes.Hex8ToBytes('0EAD29EF205FBB86D11ABE5ED704B880')
        },
        // NIST SP 800-38C Appendix C Test Case - with plaintext
        {
          text: 'NIST SP 800-38C Test Vector (with plaintext)',
          uri: 'https://csrc.nist.gov/publications/detail/sp/800-38c/final',
          key: OpCodes.Hex8ToBytes('43C1142877D9F450E12D7B6DB47A85BA'),
          nonce: OpCodes.Hex8ToBytes('76BECD9D27CA8A026215F32712'),
          input: OpCodes.Hex8ToBytes('B506A6BA900C1147C806775324B36EB376AA01D4C3EEF6F5'),
          aad: OpCodes.Hex8ToBytes('6A59AACADD416E465264C15E1A1E9BFA084687492710F9BDA832E2571E468224'),
          tagSize: 16,
          expected: OpCodes.Hex8ToBytes('14B14FE5B317411392861638EC383AE40BA95FEFE34255DC2EC067887114BC370281DE6F00836CE4')
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AesCcmInstance(this, isInverse);
    }
  }

  // ========================[ AES-CCM INSTANCE ]========================

  /**
 * AesCcm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AesCcmInstance extends IAeadInstance {
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
      this._associatedData = null;
      this._plaintext = [];
      this._tagSize = 16;  // Initialize with valid default
      this._aesInstance = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this._aesInstance = null;
        return;
      }

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Expected 16-32 bytes.`);
      }

      this._key = [...keyBytes];

      // Create AES instance for ECB mode (block cipher)
      // We'll use inline AES implementation for now
      const aesModule = this._createAesEcb(this._key);
      this._aesInstance = aesModule;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      const isValidSize = this.algorithm.SupportedNonceSizes.some(ks =>
        nonceBytes.length >= ks.minSize && nonceBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes. Expected 7-13 bytes.`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    set associatedData(adBytes) {
      this._associatedData = adBytes ? [...adBytes] : null;
    }

    get associatedData() {
      return this._associatedData ? [...this._associatedData] : null;
    }

    set aad(adBytes) {
      this._associatedData = adBytes ? [...adBytes] : null;
    }

    get aad() {
      return this._associatedData ? [...this._associatedData] : null;
    }

    set tagSize(size) {
      // Allow 0 during initialization (set by parent class), will be overridden
      if (size !== 0 && !this.algorithm.SupportedTagSizes.includes(size)) {
        throw new Error(`Invalid tag size: ${size}. Must be one of: ${this.algorithm.SupportedTagSizes.join(', ')}`);
      }
      this._tagSize = size || 16;  // Default to 16 if 0
    }

    get tagSize() {
      return this._tagSize || 16;  // Default to 16 if not set
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      this._plaintext.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      const plaintext = this._plaintext;
      this._plaintext = [];

      const L = 15 - this._nonce.length;  // Length field size
      const M = this._tagSize;  // Authentication tag size

      if (L < 2 || L > 8) {
        throw new Error(`Invalid L parameter: ${L}. Must be 2-8.`);
      }

      if (plaintext.length >= (1n << (8n * BigInt(L)))) {
        throw new Error(`Message length exceeds 2^(8*${L}) bytes`);
      }

      if (this.isInverse) {
        // Decryption: extract tag, decrypt, verify
        const tagStart = plaintext.length - M;
        if (tagStart < 0) {
          throw new Error('Ciphertext too short for tag');
        }

        const ciphertextData = plaintext.slice(0, tagStart);
        const receivedTag = plaintext.slice(tagStart);

        const decrypted = this._decryptAndVerify(ciphertextData, receivedTag, L, M);
        return decrypted;
      } else {
        // Encryption: encrypt, compute MAC, append tag
        const { ciphertext, tag } = this._encryptAndAuthenticate(plaintext, L, M);
        return [...ciphertext, ...tag];
      }
    }

    _encryptAndAuthenticate(plaintext, L, M) {
      // Step 1: Compute CBC-MAC (authentication tag T)
      const T = this._computeCbcMac(plaintext, L, M);

      // Step 2: Encrypt plaintext and authentication tag
      const U = this._encryptPayload([...T], L);  // Encrypt T
      const ciphertext = this._encryptPayload(plaintext, L);

      // Return ciphertext || Tag where Tag = first M bytes of U
      const tag = U.slice(0, M);
      return { ciphertext, tag };
    }

    _decryptAndVerify(ciphertext, receivedTag, L, M) {
      // Step 1: Decrypt ciphertext
      const plaintext = this._encryptPayload(ciphertext, L);

      // Step 2: Compute expected authentication tag
      const T_expected = this._computeCbcMac(plaintext, L, M);

      // Step 3: Decrypt received tag to get T_actual
      const U = this._encryptPayload([...receivedTag, ...new Array(16 - receivedTag.length).fill(0)], L);
      const T_actual = U.slice(0, M);

      // Step 4: Verify tag (constant-time comparison)
      let tagValid = true;
      for (let i = 0; i < M; i++) {
        if (T_expected[i] !== T_actual[i]) {
          tagValid = false;
        }
      }

      if (!tagValid) {
        throw new Error('Authentication tag verification failed');
      }

      return plaintext;
    }

    _computeCbcMac(plaintext, L, M) {
      const blockSize = 16;
      const L_param = L;
      const M_param = M;

      // Format B_0 block
      const B0 = this._formatB0(plaintext.length, L_param, M_param);

      // Prepare message to authenticate: B_0 || encoded_AD || plaintext || padding
      let msgToAuth = [...B0];

      // Add encoded associated data if present
      if (this._associatedData && this._associatedData.length > 0) {
        msgToAuth.push(...this._encodeAssociatedData(this._associatedData));
      }

      // Add plaintext
      msgToAuth.push(...plaintext);

      // Pad to block size
      while (msgToAuth.length % blockSize !== 0) {
        msgToAuth.push(0);
      }

      // CBC-MAC
      let X = new Array(blockSize).fill(0);

      for (let i = 0; i < msgToAuth.length; i += blockSize) {
        const block = msgToAuth.slice(i, i + blockSize);

        // XOR with previous result
        for (let j = 0; j < blockSize; j++) {
          X[j] ^= block[j];
        }

        // Encrypt block
        X = this._aesInstance.encrypt(X);
      }

      // Return first M bytes as tag
      return X.slice(0, M_param);
    }

    _encryptPayload(data, L) {
      const blockSize = 16;
      const L_param = L;

      // Counter value starts at 1 (not 0)
      let counterBlock = this._formatCounterBlock(0, L_param);
      let S = this._aesInstance.encrypt([...counterBlock]);

      let result = [];
      let counterValue = 1;

      // Encrypt plaintext with counter mode
      for (let i = 0; i < data.length; i += blockSize) {
        const block = data.slice(i, Math.min(i + blockSize, data.length));

        // Generate keystream block
        counterBlock = this._formatCounterBlock(counterValue, L_param);
        const keystreamBlock = this._aesInstance.encrypt([...counterBlock]);

        // XOR block with keystream
        for (let j = 0; j < block.length; j++) {
          result.push(block[j] ^ keystreamBlock[j]);
        }

        counterValue++;
      }

      return result;
    }

    _formatB0(messageLength, L, M) {
      const blockSize = 16;
      const B0 = new Array(blockSize).fill(0);

      // Flags byte
      let flags = 0;
      if (this._associatedData && this._associatedData.length > 0) {
        flags |= 0x40;  // Bit 6: Adata present
      }
      flags |= ((M - 2) / 2) << 3;  // Bits 3-5: (M-2)/2
      flags |= (L - 1);  // Bits 0-2: L-1

      B0[0] = flags;

      // Nonce (N)
      for (let i = 0; i < this._nonce.length; i++) {
        B0[1 + i] = this._nonce[i];
      }

      // Message length (Q)
      const lenStartPos = blockSize - L;
      let len = messageLength;
      for (let i = 0; i < L; i++) {
        B0[blockSize - 1 - i] = len & 0xFF;
        len >>>= 8;
      }

      return B0;
    }

    _formatCounterBlock(counter, L) {
      const blockSize = 16;
      const counterBlock = new Array(blockSize).fill(0);

      // Flags byte for counter mode
      const flags = L - 1;
      counterBlock[0] = flags;

      // Nonce
      for (let i = 0; i < this._nonce.length; i++) {
        counterBlock[1 + i] = this._nonce[i];
      }

      // Counter value
      for (let i = 0; i < L; i++) {
        counterBlock[blockSize - 1 - i] = counter & 0xFF;
        counter >>>= 8;
      }

      return counterBlock;
    }

    _encodeAssociatedData(ad) {
      const encoded = [];
      const len = ad.length;

      if (len < (1 << 16)) {
        // Encode as 2 bytes (big-endian)
        encoded.push((len >>> 8) & 0xFF);
        encoded.push(len & 0xFF);
      } else {
        // Encode as 6 bytes: 0xFFFE followed by 4-byte length
        encoded.push(0xFF);
        encoded.push(0xFE);
        encoded.push((len >>> 24) & 0xFF);
        encoded.push((len >>> 16) & 0xFF);
        encoded.push((len >>> 8) & 0xFF);
        encoded.push(len & 0xFF);
      }

      encoded.push(...ad);
      return encoded;
    }

    // ========================[ INLINE AES IMPLEMENTATION ]========================
    // AES ECB mode encryption for CBC-MAC and counter generation

    _createAesEcb(key) {
      // Use predefined AES S-boxes and constants
      const aes = new AesEcb(key);
      return {
        encrypt: (plaintext) => aes.encrypt(plaintext)
      };
    }
  }

  // ========================[ INLINE AES ECB IMPLEMENTATION ]========================

  class AesEcb {
    constructor(key) {
      this.keySize = key.length;
      this.rounds = this._getRounds(this.keySize);
      this.roundKeys = this._expandKey(key);
    }

    encrypt(plaintext) {
      if (plaintext.length !== 16) {
        throw new Error('AES input must be 16 bytes');
      }

      let state = [...plaintext];
      state = this._addRoundKey(state, 0);

      for (let round = 1; round < this.rounds; round++) {
        state = this._subBytes(state);
        state = this._shiftRows(state);
        state = this._mixColumns(state);
        state = this._addRoundKey(state, round);
      }

      state = this._subBytes(state);
      state = this._shiftRows(state);
      state = this._addRoundKey(state, this.rounds);

      return state;
    }

    _getRounds(keySize) {
      switch (keySize) {
        case 16: return 10;
        case 24: return 12;
        case 32: return 14;
        default: throw new Error(`Invalid key size: ${keySize}`);
      }
    }

    _expandKey(key) {
      const Nk = key.length / 4;
      const Nr = this._getRounds(key.length);
      const totalWords = 4 * (Nr + 1);
      const w = new Array(totalWords);

      // Copy key into first Nk words
      for (let i = 0; i < Nk; i++) {
        w[i] = (key[4*i] << 24) | (key[4*i+1] << 16) | (key[4*i+2] << 8) | key[4*i+3];
      }

      // Expand remaining words
      for (let i = Nk; i < totalWords; i++) {
        let temp = w[i - 1];
        if (i % Nk === 0) {
          temp = this._subWord(this._rotWord(temp)) ^ (AES_RCON[i / Nk - 1] << 24);
        } else if (Nk > 6 && i % Nk === 4) {
          temp = this._subWord(temp);
        }
        w[i] = w[i - Nk] ^ temp;
      }

      return w;
    }

    _subWord(word) {
      let result = 0;
      for (let i = 0; i < 4; i++) {
        const byte = (word >>> (24 - 8*i)) & 0xFF;
        result |= (AES_SBOX[byte] << (24 - 8*i));
      }
      return result;
    }

    _rotWord(word) {
      return ((word << 8) | (word >>> 24));
    }

    _addRoundKey(state, roundNum) {
      const result = [...state];
      const keyStart = roundNum * 4;

      for (let i = 0; i < 4; i++) {
        const col = i * 4;
        const rk = this.roundKeys[keyStart + i];
        result[col] ^= (rk >>> 24) & 0xFF;
        result[col + 1] ^= (rk >>> 16) & 0xFF;
        result[col + 2] ^= (rk >>> 8) & 0xFF;
        result[col + 3] ^= rk & 0xFF;
      }

      return result;
    }

    _subBytes(state) {
      const result = [...state];
      for (let i = 0; i < 16; i++) {
        result[i] = AES_SBOX[state[i]];
      }
      return result;
    }

    _shiftRows(state) {
      const result = [...state];
      // Row 1: shift left by 1
      [result[1], result[5], result[9], result[13]] =
        [result[5], result[9], result[13], result[1]];
      // Row 2: shift left by 2
      [result[2], result[6], result[10], result[14]] =
        [result[10], result[14], result[2], result[6]];
      // Row 3: shift left by 3
      [result[3], result[7], result[11], result[15]] =
        [result[15], result[3], result[7], result[11]];
      return result;
    }

    _mixColumns(state) {
      const result = new Array(16);

      for (let c = 0; c < 4; c++) {
        const col = [state[c], state[4 + c], state[8 + c], state[12 + c]];
        const mixed = this._mixColumn(col);

        result[c] = mixed[0];
        result[4 + c] = mixed[1];
        result[8 + c] = mixed[2];
        result[12 + c] = mixed[3];
      }

      return result;
    }

    _mixColumn(col) {
      const gmul = (a, b) => {
        let result = 0;
        for (let i = 0; i < 8; i++) {
          if (b & 1) result ^= a;
          const msb = a & 0x80;
          a = (a << 1) & 0xFF;
          if (msb) a ^= 0x1B;
          b >>= 1;
        }
        return result;
      };

      return [
        gmul(0x02, col[0]) ^ gmul(0x03, col[1]) ^ col[2] ^ col[3],
        col[0] ^ gmul(0x02, col[1]) ^ gmul(0x03, col[2]) ^ col[3],
        col[0] ^ col[1] ^ gmul(0x02, col[2]) ^ gmul(0x03, col[3]),
        gmul(0x03, col[0]) ^ col[1] ^ col[2] ^ gmul(0x02, col[3])
      ];
    }
  }

  // ========================[ AES LOOKUP TABLES ]========================

  const AES_SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5e, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xd7, 0x4b, 0x55, 0xcf, 0x34, 0xc5, 0x84,
    0xcb, 0xeb, 0xbb, 0x42, 0xa4, 0xb7, 0xb8, 0x6f, 0x25, 0xcd, 0x68, 0xfb, 0xad, 0xa9, 0x7a, 0xb5,
    0x29, 0x61, 0x0c, 0x12, 0x4e, 0xb4, 0x50, 0x54, 0xaa, 0xd0, 0xce, 0xbc, 0xca, 0xd8, 0x20, 0x82,
    0x31, 0x79, 0xe3, 0xda, 0x47, 0xd6, 0xa2, 0xd2, 0xf2, 0xd9, 0xcc, 0xe1, 0xad, 0x17, 0x9d, 0x3d
  ];

  const AES_RCON = [
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36,
    0x6c, 0xd8, 0xab, 0x4d, 0x9a, 0x2f, 0x5e, 0xbc, 0x63, 0xc6
  ];

  // ========================[ REGISTRATION ]========================

  RegisterAlgorithm(new AesCcm());

  return {
    AesCcm,
    AesCcmInstance
  };
}));
