/*
 * AES-CCM (Counter with CBC-MAC) - NIST AEAD Encryption
 * Implementation following RFC 3610 and NIST SP 800-38C
 * (c)2006-2025 Hawkynt
 *
 * AES-CCM is a NIST-standardized authenticated encryption with associated data (AEAD)
 * mode combining the AES block cipher with CBC-MAC for authentication and counter mode
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
 * RFC 3610: Counter with CBC-MAC (CCM), D. Whiting, R. Housley, N. Ferguson, September 2003
 * NIST SP 800-38C: Recommendation for Block Cipher Modes of Operation: The CCM Mode
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
      this.inventor = 'Doug Whiting, Russ Housley, Niels Ferguson';
      this.year = 2003;
      this.category = CategoryType.AEAD;
      this.subCategory = 'Authenticated Encryption with Associated Data';
      this.securityStatus = SecurityStatus.EDUCATIONAL;
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
      this.SupportedTagSizes = [
        new KeySize(4, 16, 2)
      ];

      this.documentation = [
        new LinkItem('RFC 3610 - Counter with CBC-MAC', 'https://www.rfc-editor.org/rfc/rfc3610'),
        new LinkItem('NIST SP 800-38C - CCM Mode Recommendation', 'https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38c.pdf'),
        new LinkItem('NIST CAVP - CCM Validation System', 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/cavp-testing-block-cipher-modes')
      ];

      this.references = [
        new LinkItem('Botan CCM Reference Implementation', 'https://github.com/randombit/botan/tree/master/src/lib/modes/aead/ccm'),
        new LinkItem('mbed TLS CCM Reference Implementation', 'https://github.com/Mbed-TLS/mbedtls/blob/development/library/ccm.c'),
        new LinkItem('Crypto++ CCM Reference Implementation', 'https://github.com/weidai11/cryptopp/blob/master/ccm.h')
      ];

      // Official test vectors from RFC 3610 Appendix D and NIST SP 800-38C Appendix C
      this.tests = [
        // RFC 3610 Appendix D Packet Vector #1
        {
          text: 'RFC 3610 Packet Vector #1 (L=2, M=8)',
          uri: 'https://www.rfc-editor.org/rfc/rfc3610#section-8',
          key: OpCodes.Hex8ToBytes('C0C1C2C3C4C5C6C7C8C9CACBCCCDCECF'),
          nonce: OpCodes.Hex8ToBytes('00000003020100A0A1A2A3A4A5'),
          input: OpCodes.Hex8ToBytes('08090A0B0C0D0E0F101112131415161718191A1B1C1D1E'),
          aad: OpCodes.Hex8ToBytes('0001020304050607'),
          tagSize: 8,
          expected: OpCodes.Hex8ToBytes('588C979A61C663D2F066D0C2C0F989806D5F6B61DAC38417E8D12CFDF926E0')
        },
        // RFC 3610 Appendix D Packet Vector #2
        {
          text: 'RFC 3610 Packet Vector #2 (L=2, M=8)',
          uri: 'https://www.rfc-editor.org/rfc/rfc3610#section-8',
          key: OpCodes.Hex8ToBytes('C0C1C2C3C4C5C6C7C8C9CACBCCCDCECF'),
          nonce: OpCodes.Hex8ToBytes('00000004030201A0A1A2A3A4A5'),
          input: OpCodes.Hex8ToBytes('08090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F'),
          aad: OpCodes.Hex8ToBytes('0001020304050607'),
          tagSize: 8,
          expected: OpCodes.Hex8ToBytes('72C91A36E135F8CF291CA894085C87E3CC15C439C9E43A3BA091D56E10400916')
        },
        // NIST SP 800-38C Appendix C, Example 1 (Klen=128, Tlen=32, Nlen=56, Alen=64, Plen=32)
        {
          text: 'NIST SP 800-38C Appendix C Example 1 (L=8, M=4)',
          uri: 'https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38c.pdf',
          key: OpCodes.Hex8ToBytes('404142434445464748494A4B4C4D4E4F'),
          nonce: OpCodes.Hex8ToBytes('10111213141516'),
          input: OpCodes.Hex8ToBytes('20212223'),
          aad: OpCodes.Hex8ToBytes('0001020304050607'),
          tagSize: 4,
          expected: OpCodes.Hex8ToBytes('7162015B4DAC255D')
        },
        // NIST SP 800-38C Appendix C, Example 3 (Klen=128, Tlen=64, Nlen=96, Alen=160, Plen=192)
        {
          text: 'NIST SP 800-38C Appendix C Example 3 (L=4, M=8)',
          uri: 'https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38c.pdf',
          key: OpCodes.Hex8ToBytes('404142434445464748494A4B4C4D4E4F'),
          nonce: OpCodes.Hex8ToBytes('101112131415161718191A1B'),
          input: OpCodes.Hex8ToBytes('202122232425262728292A2B2C2D2E2F3031323334353637'),
          aad: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F10111213'),
          tagSize: 8,
          expected: OpCodes.Hex8ToBytes('E3B201A9F5B71A7A9B1CEAECCD97E70B6176AAD9A4428AA5484392FBC1B09951')
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
 * @extends {IAeadInstance}
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

      this._key = OpCodes.CopyArray(keyBytes);

      // Use the AES block cipher registered in the AlgorithmFramework for the
      // forward-only cipher operations CCM requires (CBC-MAC and CTR keystream).
      this._aesInstance = AesCcmInstance._createAesEncryptor(this._key);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? OpCodes.CopyArray(this._key) : null;
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

      this._nonce = OpCodes.CopyArray(nonceBytes);
    }

    get nonce() {
      return this._nonce ? OpCodes.CopyArray(this._nonce) : null;
    }

    set associatedData(adBytes) {
      this._associatedData = adBytes ? OpCodes.CopyArray(adBytes) : null;
    }

    get associatedData() {
      return this._associatedData ? OpCodes.CopyArray(this._associatedData) : null;
    }

    set aad(adBytes) {
      this._associatedData = adBytes ? OpCodes.CopyArray(adBytes) : null;
    }

    get aad() {
      return this._associatedData ? OpCodes.CopyArray(this._associatedData) : null;
    }

    set tagSize(size) {
      // Allow 0 during initialization (set by parent class), will be overridden
      if (size !== 0) {
        const isValidSize = this.algorithm.SupportedTagSizes.some(ts =>
          size >= ts.minSize && size <= ts.maxSize && (size - ts.minSize) % ts.stepSize === 0
        );
        if (!isValidSize) {
          throw new Error(`Invalid tag size: ${size}. Must be an even value between 4 and 16 bytes.`);
        }
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

      this._plaintext = OpCodes.ConcatArrays([this._plaintext, data]);
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

      const maxLength = Math.pow(2, 8 * L);
      if (plaintext.length >= maxLength) {
        throw new Error(`Message length exceeds 2^(8*${L}) bytes`);
      }

      if (this.isInverse) {
        // Decryption: split ciphertext and tag, decrypt, verify
        const tagStart = plaintext.length - M;
        if (tagStart < 0) {
          throw new Error('Ciphertext too short for tag');
        }

        const ciphertextData = OpCodes.ArraySlice(plaintext, 0, tagStart);
        const receivedTag = OpCodes.ArraySlice(plaintext, tagStart, plaintext.length);

        return this._decryptAndVerify(ciphertextData, receivedTag, L, M);
      }

      // Encryption: encrypt, compute MAC, append tag
      const encrypted = this._encryptAndAuthenticate(plaintext, L, M);
      return OpCodes.ConcatArrays([encrypted.ciphertext, encrypted.tag]);
    }

    _encryptAndAuthenticate(plaintext, L, M) {
      // Step 1: Compute the raw CBC-MAC value T over B0 || encoded(AAD) || plaintext
      const T = this._computeCbcMac(plaintext, L, M);

      // Step 2: Mask T with S0 = CIPH_K(Ctr0) and truncate to M bytes
      const tag = this._maskTag(T, L);

      // Step 3: Encrypt the plaintext with the counter starting at 1
      const ciphertext = this._encryptPayload(plaintext, L);

      return { ciphertext: ciphertext, tag: tag };
    }

    _decryptAndVerify(ciphertext, receivedTag, L, M) {
      // Step 1: Decrypt ciphertext (CTR mode is its own inverse)
      const plaintext = this._encryptPayload(ciphertext, L);

      // Step 2: Recompute the expected masked tag from the decrypted plaintext
      const T_expected = this._computeCbcMac(plaintext, L, M);
      const expectedTag = this._maskTag(T_expected, L);

      // Step 3: Verify tag (constant-time comparison)
      if (!OpCodes.SecureCompare(expectedTag, receivedTag)) {
        throw new Error('Authentication tag verification failed');
      }

      return plaintext;
    }

    _computeCbcMac(plaintext, L, M) {
      const blockSize = 16;

      // Format B_0 block
      const B0 = this._formatB0(plaintext.length, L, M);

      // Prepare message to authenticate: B_0 || pad16(encoded_AD) || pad16(plaintext)
      // The associated data field and the payload field are each zero-padded to a
      // block boundary independently before being concatenated (RFC 3610 section 2.2).
      const parts = [B0];

      if (this._associatedData && this._associatedData.length > 0) {
        parts.push(this._padToBlock(this._encodeAssociatedData(this._associatedData), blockSize));
      }

      if (plaintext.length > 0) {
        parts.push(this._padToBlock(plaintext, blockSize));
      }

      const msgToAuth = OpCodes.ConcatArrays(parts);

      // CBC-MAC
      let X = OpCodes.CreateArray(blockSize, 0);

      for (let i = 0; i < msgToAuth.length; i += blockSize) {
        const block = OpCodes.ArraySlice(msgToAuth, i, i + blockSize);
        X = OpCodes.XorArrays(X, block);
        X = this._aesInstance.EncryptBlock(X);
      }

      // Return first M bytes as the raw (unmasked) MAC
      return OpCodes.ArraySlice(X, 0, M);
    }

    // Zero-pad `data` to a multiple of blockSize bytes.
    _padToBlock(data, blockSize) {
      const padLength = (blockSize - (data.length % blockSize)) % blockSize;
      return padLength > 0 ? OpCodes.ConcatArrays([data, OpCodes.CreateArray(padLength, 0)]) : OpCodes.CopyArray(data);
    }

    // Mask the raw CBC-MAC value T with S0 = CIPH_K(Ctr0), truncated to M bytes.
    _maskTag(T, L) {
      const counterBlock0 = this._formatCounterBlock(0, L);
      const S0 = this._aesInstance.EncryptBlock(counterBlock0);
      return OpCodes.XorArrays(T, S0);
    }

    _encryptPayload(data, L) {
      const blockSize = 16;
      let result = [];
      let counterValue = 1;

      // Encrypt/decrypt with counter mode, counter starting at 1
      for (let i = 0; i < data.length; i += blockSize) {
        const block = OpCodes.ArraySlice(data, i, Math.min(i + blockSize, data.length));

        const counterBlock = this._formatCounterBlock(counterValue, L);
        const keystreamBlock = this._aesInstance.EncryptBlock(counterBlock);

        const xored = OpCodes.XorArrays(block, keystreamBlock);
        result = OpCodes.ConcatArrays([result, xored]);

        counterValue++;
      }

      return result;
    }

    _formatB0(messageLength, L, M) {
      const hasAad = !!(this._associatedData && this._associatedData.length > 0);
      const adataFlag = hasAad ? 0x40 : 0;
      const mField = (M - 2) / 2;         // Bits 3-5: (M-2)/2
      const flags = adataFlag + (mField * 8) + (L - 1);  // Bits 0-2: L-1

      const lengthField = this._encodeLength(messageLength, L);

      return OpCodes.ConcatArrays([[flags], OpCodes.CopyArray(this._nonce), lengthField]);
    }

    _formatCounterBlock(counter, L) {
      const flags = L - 1;
      const counterField = this._encodeLength(counter, L);

      return OpCodes.ConcatArrays([[flags], OpCodes.CopyArray(this._nonce), counterField]);
    }

    // Encode a non-negative integer as `length` big-endian bytes (length <= 8).
    _encodeLength(value, length) {
      const split = OpCodes.Split64(value);
      const full = OpCodes.ConcatArrays([OpCodes.Unpack32BE(split.high32), OpCodes.Unpack32BE(split.low32)]);
      return OpCodes.ArraySlice(full, 8 - length, 8);
    }

    // Encode the associated data length prefix as specified in RFC 3610 section 2.2 / NIST SP 800-38C Appendix A.
    _encodeAssociatedData(ad) {
      const len = ad.length;
      let lengthPrefix;

      if (len < 0xFF00) {
        lengthPrefix = OpCodes.Unpack16BE(len);
      } else if (len <= 0xFFFFFFFF) {
        lengthPrefix = OpCodes.ConcatArrays([[0xFF, 0xFE], OpCodes.Unpack32BE(len)]);
      } else {
        const split = OpCodes.Split64(len);
        lengthPrefix = OpCodes.ConcatArrays([[0xFF, 0xFF], OpCodes.Unpack32BE(split.high32), OpCodes.Unpack32BE(split.low32)]);
      }

      return OpCodes.ConcatArrays([lengthPrefix, ad]);
    }

    // ========================[ AES BLOCK CIPHER RESOLUTION ]========================
    // CCM only ever needs the forward AES transform (both for CBC-MAC and CTR
    // keystream generation), so a single encrypt-mode instance suffices.

    static _createAesEncryptor(key) {
      let aesAlgorithm = AlgorithmFramework.Find('Rijndael (AES)') || AlgorithmFramework.Find('AES');

      if (!aesAlgorithm && typeof require !== 'undefined') {
        try { require('../block/rijndael.js'); } catch (loadError) { /* fall back below */ }
        aesAlgorithm = AlgorithmFramework.Find('Rijndael (AES)') || AlgorithmFramework.Find('AES');
      }

      if (!aesAlgorithm) {
        throw new Error('AES block cipher is not available in the AlgorithmFramework registry');
      }

      const instance = aesAlgorithm.CreateInstance(false);
      instance.key = key;
      return instance;
    }
  }

  // ========================[ REGISTRATION ]========================

  RegisterAlgorithm(new AesCcm());

  return {
    AesCcm,
    AesCcmInstance
  };
}));
