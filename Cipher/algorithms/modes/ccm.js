/*
 * CCM (Counter with CBC-MAC) Mode of Operation
 * Authenticated Encryption with Associated Data (AEAD) mode
 * Combines CTR mode encryption with CBC-MAC authentication
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

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
    root.CCM = factory(root.AlgorithmFramework, root.OpCodes);
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class CcmAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "CCM";
      this.description = "Counter with CBC-MAC provides authenticated encryption by combining CTR mode encryption with CBC-MAC authentication. Used in IEEE 802.11i, IPsec, and TLS. Requires pre-specifying the message length and supports variable nonce sizes. More restrictive than GCM but simpler to implement securely.";
      this.inventor = "Doug Whiting, Russ Housley, Niels Ferguson";
      this.year = 2003;
      this.category = CategoryType.MODE;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedTagSizes = [
        new KeySize(4, 16, 2) // CCM supports tag sizes 4, 6, 8, 10, 12, 14, 16 bytes
      ];
      this.SupportsDetached = true;

      this.documentation = [
        new LinkItem("NIST SP 800-38C", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38c.pdf"),
        new LinkItem("RFC 3610", "https://tools.ietf.org/rfc/rfc3610.txt"),
        new LinkItem("IEEE 802.11i Standard", "CCM usage in WiFi security")
      ];

      this.references = [
        new LinkItem("OpenSSL CCM Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/ccm128.c"),
        new LinkItem("RFC 5116 - AEAD Interface", "https://tools.ietf.org/rfc/rfc5116.txt")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse", "Reusing nonce with same key breaks confidentiality and authenticity. Always use unique nonces."),
        new Vulnerability("Length Extension", "If message length is not properly validated, attacks may be possible"),
        new Vulnerability("Implementation Complexity", "Proper parameter validation critical - incorrect L or M values can break security")
      ];

      this.tests = [
        {
          text: "CCM round-trip test #1",
          uri: "https://tools.ietf.org/rfc/rfc3610.txt",
          input: OpCodes.Hex8ToBytes("08090A0B0C0D0E0F101112131415161718191A1B1C1D1E"),
          key: OpCodes.Hex8ToBytes("C0C1C2C3C4C5C6C7C8C9CACBCCCDCECF"),
          iv: OpCodes.Hex8ToBytes("00000003020100A0A1A2A3A4A5"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          tagSize: 8
        },
        {
          text: "CCM round-trip test #2",
          uri: "https://tools.ietf.org/rfc/rfc3610.txt",
          input: OpCodes.Hex8ToBytes("08090A0B0C0D0E0F101112131415161718191A1B1C1D1E"),
          key: OpCodes.Hex8ToBytes("C0C1C2C3C4C5C6C7C8C9CACBCCCDCECF"),
          iv: OpCodes.Hex8ToBytes("00000009080706A0A1A2A3A4A5"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          tagSize: 10
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new CcmModeInstance(this, isInverse);
    }
  }

  class CcmModeInstance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];
      this.nonce = null;
      this.tagSize = 8; // Default 8-byte tag (M=8)
      this.messageLength = null; // Must be pre-specified
      this.aad = []; // Associated authenticated data
    }

    /**
     * Set the underlying block cipher instance
     * @param {IBlockCipherInstance} cipher - The block cipher to use (must be 128-bit)
     */
    setBlockCipher(cipher) {
      if (!cipher || cipher.BlockSize !== 16) {
        throw new Error("CCM requires a 128-bit block cipher");
      }
      this.blockCipher = cipher;
    }

    /**
     * Set the nonce
     * @param {Array} nonce - Nonce (7-13 bytes for AES)
     */
    setNonce(nonce) {
      if (!this.blockCipher) {
        throw new Error("Block cipher must be set before nonce");
      }
      if (!nonce || nonce.length < 7 || nonce.length > 13) {
        throw new Error("CCM nonce must be 7-13 bytes");
      }
      this.nonce = [...nonce];
    }

    /**
     * Alternative method for compatibility
     */
    setIV(iv) {
      this.setNonce(iv);
    }

    /**
     * Set authentication tag size
     * @param {number} size - Tag size in bytes (4, 6, 8, 10, 12, 14, 16)
     */
    setTagSize(size) {
      if (![4, 6, 8, 10, 12, 14, 16].includes(size)) {
        throw new Error("CCM tag size must be 4, 6, 8, 10, 12, 14, or 16 bytes");
      }
      this.tagSize = size;
    }

    /**
     * Set Associated Authenticated Data (AAD)
     * @param {Array} data - AAD bytes
     */
    setAAD(data) {
      this.aad = data ? [...data] : [];
    }

    /**
     * Set the expected message length (required for CCM)
     * @param {number} length - Message length in bytes
     */
    setMessageLength(length) {
      if (length < 0) {
        throw new Error("Message length cannot be negative");
      }
      this.messageLength = length;
    }

    /**
     * Format CCM blocks B_0, B_1, ... for CBC-MAC
     * @private
     */
    _formatBlocks(messageLength, associatedData) {
      const blocks = [];
      const L = 15 - this.nonce.length; // Length field size
      const M = this.tagSize; // Authentication tag size

      // Block B_0: Flags || Nonce || Length
      const b0 = new Array(16).fill(0);

      // Flags byte: Adata || (M-2)/2 || L-1
      let flags = 0;
      if (associatedData && associatedData.length > 0) flags |= 0x40;
      flags |= ((M - 2) / 2) << 3;
      flags |= L - 1;

      b0[0] = flags;

      // Copy nonce
      for (let i = 0; i < this.nonce.length; i++) {
        b0[1 + i] = this.nonce[i];
      }

      // Encode message length in L bytes (big-endian)
      for (let i = 0; i < L && i < 4; i++) {
        b0[15 - i] = (messageLength >>> (i * 8)) & 0xFF;
      }

      blocks.push(b0);

      // Add associated data blocks if present
      if (associatedData && associatedData.length > 0) {
        const aadBlocks = this._encodeAssociatedData(associatedData);
        blocks.push(...aadBlocks);
      }

      return blocks;
    }

    /**
     * Encode associated data for CCM
     * @private
     */
    _encodeAssociatedData(aad) {
      const blocks = [];
      const aadLen = aad.length;
      let encodedLength;

      // Encode length according to CCM specification
      if (aadLen < 0xFF00) {
        const lengthWord = OpCodes.Pack16BE((aadLen >>> 8) & 0xFF, aadLen & 0xFF);
        encodedLength = OpCodes.Unpack16BE(lengthWord);
      } else if (aadLen < 0x100000000) {
        const lengthWord = OpCodes.Pack32BE((aadLen >>> 24) & 0xFF, (aadLen >>> 16) & 0xFF, (aadLen >>> 8) & 0xFF, aadLen & 0xFF);
        const lengthBytes = OpCodes.Unpack32BE(lengthWord);
        encodedLength = [0xFF, 0xFE, lengthBytes[0], lengthBytes[1], lengthBytes[2], lengthBytes[3]];
      } else {
        throw new Error("Associated data too long for CCM");
      }

      // Combine length encoding with AAD and pad to block boundary
      const combined = [...encodedLength, ...aad];
      while (combined.length % 16 !== 0) {
        combined.push(0);
      }

      // Split into 16-byte blocks
      for (let i = 0; i < combined.length; i += 16) {
        blocks.push(combined.slice(i, i + 16));
      }

      return blocks;
    }

    /**
     * Compute CBC-MAC over formatted blocks
     * @private
     */
    _cbcMac(blocks) {
      let mac = new Array(16).fill(0);

      for (const block of blocks) {
        // XOR with previous MAC value
        mac = OpCodes.XorArrays(mac, block);

        // Encrypt with block cipher - create fresh instance for each operation
        const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
        encryptCipher.key = this.blockCipher.key;
        encryptCipher.Feed(mac);
        mac = encryptCipher.Result();
      }

      return mac;
    }

    /**
     * Generate counter block for CCM
     * @private
     */
    _counterBlock(counter) {
      const L = 15 - this.nonce.length;
      const block = new Array(16).fill(0);

      // Flags: 0 || 0 || 0 || L-1
      block[0] = L - 1;

      // Copy nonce
      for (let i = 0; i < this.nonce.length; i++) {
        block[1 + i] = this.nonce[i];
      }

      // Encode counter in L bytes (big-endian)
      for (let i = 0; i < L && i < 4; i++) {
        block[15 - i] = (counter >>> (i * 8)) & 0xFF;
      }

      return block;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set");
      }
      if (!this.nonce) {
        throw new Error("Nonce not set");
      }
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set");
      }
      if (!this.nonce) {
        throw new Error("Nonce not set");
      }

      if (this.isInverse) {
        // CCM Decryption + Verification
        if (this.inputBuffer.length < this.tagSize) {
          throw new Error("Input too short for CCM tag");
        }

        const ciphertext = this.inputBuffer.slice(0, -this.tagSize);
        const receivedTag = this.inputBuffer.slice(-this.tagSize);

        // Decrypt using CTR mode
        const plaintext = [];
        for (let i = 0; i < ciphertext.length; i += 16) {
          const remaining = Math.min(16, ciphertext.length - i);
          const cipherBlock = ciphertext.slice(i, i + remaining);
          const counter = Math.floor(i / 16) + 1;

          const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
          encryptCipher.key = this.blockCipher.key;
          encryptCipher.Feed(this._counterBlock(counter));
          const keystream = encryptCipher.Result();

          for (let j = 0; j < remaining; j++) {
            plaintext.push(OpCodes.XorArrays([cipherBlock[j]], [keystream[j]])[0]);
          }
        }

        // Verify authentication tag
        const blocks = this._formatBlocks(plaintext.length, this.aad);

        // Add plaintext blocks (padded)
        const paddedPlaintext = [...plaintext];
        while (paddedPlaintext.length % 16 !== 0) {
          paddedPlaintext.push(0);
        }
        for (let i = 0; i < paddedPlaintext.length; i += 16) {
          blocks.push(paddedPlaintext.slice(i, i + 16));
        }

        const computedMac = this._cbcMac(blocks);

        // Encrypt with counter 0 and truncate
        const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
        encryptCipher.key = this.blockCipher.key;
        encryptCipher.Feed(this._counterBlock(0));
        const s0 = encryptCipher.Result();

        const computedTag = OpCodes.XorArrays(computedMac, s0).slice(0, this.tagSize);

        if (!OpCodes.SecureCompare(receivedTag, computedTag)) {
          throw new Error("CCM authentication verification failed");
        }

        OpCodes.ClearArray(this.inputBuffer);
        this.inputBuffer = [];

        return plaintext;

      } else {
        // CCM Encryption + Authentication
        const plaintext = [...this.inputBuffer];

        // Compute authentication tag first
        const blocks = this._formatBlocks(plaintext.length, this.aad);

        // Add plaintext blocks (padded)
        const paddedPlaintext = [...plaintext];
        while (paddedPlaintext.length % 16 !== 0) {
          paddedPlaintext.push(0);
        }
        for (let i = 0; i < paddedPlaintext.length; i += 16) {
          blocks.push(paddedPlaintext.slice(i, i + 16));
        }

        const mac = this._cbcMac(blocks);

        // Encrypt plaintext using CTR mode
        const ciphertext = [];
        for (let i = 0; i < plaintext.length; i += 16) {
          const remaining = Math.min(16, plaintext.length - i);
          const plainBlock = plaintext.slice(i, i + remaining);
          const counter = Math.floor(i / 16) + 1;

          const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
          encryptCipher.key = this.blockCipher.key;
          encryptCipher.Feed(this._counterBlock(counter));
          const keystream = encryptCipher.Result();

          for (let j = 0; j < remaining; j++) {
            ciphertext.push(OpCodes.XorArrays([plainBlock[j]], [keystream[j]])[0]);
          }
        }

        // Encrypt MAC with counter 0 to get authentication tag
        const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
        encryptCipher.key = this.blockCipher.key;
        encryptCipher.Feed(this._counterBlock(0));
        const s0 = encryptCipher.Result();

        const tag = OpCodes.XorArrays(mac, s0).slice(0, this.tagSize);

        OpCodes.ClearArray(this.inputBuffer);
        this.inputBuffer = [];

        return [...ciphertext, ...tag];
      }
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new CcmAlgorithm());

  // ===== EXPORTS =====

  return { CcmAlgorithm, CcmModeInstance };
}));