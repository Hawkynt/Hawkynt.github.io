/*
 * EAX (Encrypt-then-Authenticate-then-Translate) Mode of Operation
 * Authenticated encryption mode using CTR and OMAC
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
    root.EAX = factory(root.AlgorithmFramework, root.OpCodes);
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

  class EaxAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "EAX";
      this.description = "EAX (Encrypt-then-Authenticate-then-Translate) is an authenticated encryption mode that combines CTR mode encryption with OMAC authentication. It provides both confidentiality and authenticity, supporting arbitrary-length nonces and associated authenticated data (AAD).";
      this.inventor = "Bellare, Rogaway, Wagner";
      this.year = 2003;
      this.category = CategoryType.MODE;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedTagSizes = [new KeySize(1, 16, 1)]; // Variable tag size up to block size
      this.SupportsDetached = true;

      this.documentation = [
        new LinkItem("EAX Original Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/eax.html"),
        new LinkItem("ANSI C12.22 Standard", "https://webstore.ansi.org/standards/ansi/ansic1222008"),
        new LinkItem("IEEE 1703 Standard", "https://standards.ieee.org/standard/1703-2012.html")
      ];

      this.references = [
        new LinkItem("Handbook of Applied Cryptography", "Chapter 9 - Authenticated Encryption"),
        new LinkItem("OMAC Specification", "http://www.nuee.nagoya-u.ac.jp/labs/tiwata/omac/omac.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse", "Reusing nonce with same key breaks confidentiality and authenticity. Always use unique nonces."),
        new Vulnerability("Implementation Attacks", "Vulnerable to timing attacks if not implemented with constant-time operations.")
      ];

      this.tests = [
        {
          text: "Crypto++ Test Vector #1 - Empty plaintext",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/eax.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("233952DEE4D5ED5F9B9C6D6FF80FF478"),
          nonce: OpCodes.Hex8ToBytes("62EC67F9C3A4A407FCB2A8C49031A8B3"),
          aad: OpCodes.Hex8ToBytes("6BFB914FD07EAE6B"),
          expected: OpCodes.Hex8ToBytes("E037830E8389F27B025A2D6527E79D01"),
          tagSize: 16
        },
        {
          text: "Crypto++ Test Vector #2 - 2-byte plaintext",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/eax.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("F7FB"),
          key: OpCodes.Hex8ToBytes("91945D3F4DCBEE0BF45EF52255F095A4"),
          nonce: OpCodes.Hex8ToBytes("BECAF043B0A23D843194BA972C66DEBD"),
          aad: OpCodes.Hex8ToBytes("FA3BFD4806EB53FA"),
          expected: OpCodes.Hex8ToBytes("19DD5C4C9331049D0BDAB0277408F67967E5"),
          tagSize: 16
        },
        {
          text: "Crypto++ Test Vector #3 - 5-byte plaintext",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/eax.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("1A47CB4933"),
          key: OpCodes.Hex8ToBytes("01F74AD64077F2E704C0F60ADA3DD523"),
          nonce: OpCodes.Hex8ToBytes("70C3DB4F0D26368400A10ED05D2BFF5E"),
          aad: OpCodes.Hex8ToBytes("234A3463C1264AC6"),
          expected: OpCodes.Hex8ToBytes("D851D5BAE03A59F238A23E39199DC9266626C40F80"),
          tagSize: 16
        },
        {
          text: "Crypto++ Test Vector #4 - 5-byte plaintext",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/eax.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("481C9E39B1"),
          key: OpCodes.Hex8ToBytes("D07CF6CBB7F313BDDE66B727AFD3C5E8"),
          nonce: OpCodes.Hex8ToBytes("8408DFFF3C1A2B1292DC199E46B7D617"),
          aad: OpCodes.Hex8ToBytes("33CCE2EABFF5A79D"),
          expected: OpCodes.Hex8ToBytes("632A9D131AD4C168A4225D8E1FF755939974A7BEDE"),
          tagSize: 16
        },
        {
          text: "Crypto++ Test Vector #5 - 6-byte plaintext",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/eax.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("40D0C07DA5E4"),
          key: OpCodes.Hex8ToBytes("35B6D0580005BBC12B0587124557D2C2"),
          nonce: OpCodes.Hex8ToBytes("FDB6B06676EEDC5C61D74276E1F8E816"),
          aad: OpCodes.Hex8ToBytes("AEB96EAEBE2970E9"),
          expected: OpCodes.Hex8ToBytes("071DFE16C675CB0677E536F73AFE6A14B74EE49844DD"),
          tagSize: 16
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new EaxModeInstance(this, isInverse);
    }
  }

  /**
 * EaxMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class EaxModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.key = null;
      this.nonce = null;
      this.aad = [];
      this.tagSize = 16; // Default tag size
      this.inputBuffer = [];
    }

    /**
     * Set the underlying block cipher instance
     * @param {IBlockCipherInstance} cipher - The block cipher to use
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize) {
        throw new Error("Invalid block cipher instance");
      }
      this.blockCipher = cipher;
      this.key = cipher.key;
    }

    /**
     * Set the nonce for EAX mode
     * @param {Array} nonce - Nonce (arbitrary length)
     */
    setNonce(nonce) {
      if (!nonce || nonce.length === 0) {
        throw new Error("Nonce cannot be empty");
      }
      this.nonce = [...nonce];
    }

    /**
     * Set associated authenticated data
     * @param {Array} aad - Associated data to authenticate (optional)
     */
    setAAD(aad) {
      this.aad = aad ? [...aad] : [];
    }

    /**
     * Set authentication tag size
     * @param {number} size - Tag size in bytes (1-16)
     */
    setTagSize(size) {
      if (size < 1 || size > 16) {
        throw new Error("Tag size must be 1-16 bytes");
      }
      this.tagSize = size;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.nonce) {
        throw new Error("Nonce not set. Call setNonce() first.");
      }
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.nonce) {
        throw new Error("Nonce not set. Call setNonce() first.");
      }

      const blockSize = this.blockCipher.BlockSize;

      if (!this.isInverse) {
        // Encryption mode - return concatenated ciphertext+tag for test compatibility
        // Note: Empty plaintext is allowed in EAX
        const result = this._encrypt();
        return [...result.ciphertext, ...result.tag];
      } else {
        // Decryption mode - expect tag at end
        if (this.inputBuffer.length < this.tagSize) {
          throw new Error("Input too short for authentication tag");
        }
        return this._decrypt();
      }
    }

    _encrypt() {
      const blockSize = this.blockCipher.BlockSize;

      // Step 1: Compute N = OMAC(0, nonce)
      const N = this._omac(0, this.nonce);

      // Step 2: Compute H = OMAC(1, aad) 
      const H = this._omac(1, this.aad);

      // Step 3: CTR mode encryption
      const ciphertext = this._ctrMode(this.inputBuffer, N);

      // Step 4: Compute C' = OMAC(2, ciphertext)
      const CPrime = this._omac(2, ciphertext);

      // Step 5: Compute tag = N XOR H XOR C'
      const tag = new Array(this.tagSize);
      for (let i = 0; i < this.tagSize; i++) {
        tag[i] = N[i] ^ H[i] ^ CPrime[i];
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(N);
      OpCodes.ClearArray(H);
      OpCodes.ClearArray(CPrime);
      this.inputBuffer = [];

      return { ciphertext: ciphertext, tag: tag };
    }

    _decrypt() {
      const blockSize = this.blockCipher.BlockSize;

      // Extract ciphertext and tag
      const ciphertext = this.inputBuffer.slice(0, -this.tagSize);
      const receivedTag = this.inputBuffer.slice(-this.tagSize);

      // Step 1: Compute N = OMAC(0, nonce)
      const N = this._omac(0, this.nonce);

      // Step 2: Compute H = OMAC(1, aad)
      const H = this._omac(1, this.aad);

      // Step 3: Compute C' = OMAC(2, ciphertext)
      const CPrime = this._omac(2, ciphertext);

      // Step 4: Compute expected tag = N XOR H XOR C'
      const expectedTag = new Array(this.tagSize);
      for (let i = 0; i < this.tagSize; i++) {
        expectedTag[i] = N[i] ^ H[i] ^ CPrime[i];
      }

      // Step 5: Verify tag
      if (!OpCodes.SecureCompare(receivedTag, expectedTag)) {
        throw new Error("EAX authentication failed - tag mismatch");
      }

      // Step 6: CTR mode decryption
      const plaintext = this._ctrMode(ciphertext, N);

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(N);
      OpCodes.ClearArray(H);
      OpCodes.ClearArray(CPrime);
      OpCodes.ClearArray(expectedTag);
      this.inputBuffer = [];

      return plaintext;
    }

    /**
     * CMAC computation for EAX (as per specification)
     * EAX uses CMAC with prefix: (blockSize-1) zeros || tag || data
     * @param {number} tag - Tag byte (0 for nonce, 1 for header, 2 for ciphertext)
     * @param {Array} data - Data to authenticate
     * @returns {Array} CMAC output (blockSize bytes)
     */
    _omac(tag, data) {
      const blockSize = this.blockCipher.BlockSize;

      // Build message: (blockSize-1) zero bytes || tag byte || data
      const message = [];
      for (let i = 0; i < blockSize - 1; i++) {
        message.push(0);
      }
      message.push(tag);
      message.push(...data);

      // Compute CMAC subkeys (K1 and K2)
      const L = this._aesEncrypt(new Array(blockSize).fill(0));
      const K1 = this._leftShift(L);
      if (L[0] & 0x80) {
        K1[blockSize - 1] ^= blockSize === 16 ? 0x87 : 0x1B; // Rb constant
      }

      const K2 = this._leftShift(K1);
      if (K1[0] & 0x80) {
        K2[blockSize - 1] ^= blockSize === 16 ? 0x87 : 0x1B;
      }

      // CMAC computation
      let mac = new Array(blockSize).fill(0);
      const numBlocks = Math.ceil(message.length / blockSize);

      if (numBlocks === 0) {
        // Empty message case
        const finalBlock = [...K2];
        finalBlock[0] ^= 0x80; // Padding
        mac = this._aesEncrypt(finalBlock);
        return mac;
      }

      // Process all but last block
      for (let i = 0; i < numBlocks - 1; i++) {
        const block = message.slice(i * blockSize, (i + 1) * blockSize);
        for (let j = 0; j < blockSize; j++) {
          mac[j] ^= block[j];
        }
        mac = this._aesEncrypt(mac);
      }

      // Process last block
      const lastBlockStart = (numBlocks - 1) * blockSize;
      const lastBlock = message.slice(lastBlockStart);

      if (lastBlock.length === blockSize) {
        // Complete final block - use K1
        for (let j = 0; j < blockSize; j++) {
          mac[j] ^= lastBlock[j] ^ K1[j];
        }
      } else {
        // Incomplete final block - use K2 and padding
        const paddedBlock = [...lastBlock, 0x80];
        while (paddedBlock.length < blockSize) {
          paddedBlock.push(0x00);
        }
        for (let j = 0; j < blockSize; j++) {
          mac[j] ^= paddedBlock[j] ^ K2[j];
        }
      }

      mac = this._aesEncrypt(mac);
      return mac;
    }

    /**
     * Left shift for CMAC subkey generation
     */
    _leftShift(data) {
      const result = new Array(data.length);
      let carry = 0;

      for (let i = data.length - 1; i >= 0; i--) {
        const newCarry = (data[i] & 0x80) ? 1 : 0;
        result[i] = ((data[i] << 1) | carry) & 0xFF;
        carry = newCarry;
      }

      return result;
    }

    /**
     * AES encryption helper using the block cipher instance
     */
    _aesEncrypt(block) {
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(block);
      return cipher.Result();
    }

    /**
     * CTR mode implementation
     * @param {Array} data - Data to encrypt/decrypt
     * @param {Array} iv - Initial counter value
     * @returns {Array} Output data
     */
    _ctrMode(data, iv) {
      const blockSize = this.blockCipher.BlockSize;
      const output = [];
      let counter = [...iv];

      for (let i = 0; i < data.length; i += blockSize) {
        const remainingBytes = Math.min(blockSize, data.length - i);
        const inputBlock = data.slice(i, i + remainingBytes);

        // Encrypt counter
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key;
        cipher.Feed(counter);
        const keystream = cipher.Result();

        // XOR with data
        for (let j = 0; j < remainingBytes; j++) {
          output.push(inputBlock[j] ^ keystream[j]);
        }

        // Increment counter
        this._incrementCounter(counter);
      }

      OpCodes.ClearArray(counter);
      return output;
    }

    /**
     * Increment counter for CTR mode
     * @param {Array} counter - Counter to increment (modified in place)
     */
    _incrementCounter(counter) {
      for (let i = counter.length - 1; i >= 0; i--) {
        counter[i] = (counter[i] + 1) & 0xFF;
        if (counter[i] !== 0) break; // No carry
      }
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new EaxAlgorithm());

  // ===== EXPORTS =====

  return { EaxAlgorithm, EaxModeInstance };
}));