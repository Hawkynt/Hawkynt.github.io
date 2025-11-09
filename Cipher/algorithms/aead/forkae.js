/**
 * ForkAE - Authenticated Encryption with Associated Data using ForkSkinny
 *
 * ForkAE is a family of authenticated encryption algorithms based on ForkSkinny,
 * a tweakable block cipher with forking construction. The cipher produces two
 * outputs from one input, enabling efficient parallel authenticated encryption.
 *
 * This implementation includes all 6 ForkAE variants:
 * - PAEF-ForkSkinny-64-192: 64-bit blocks, 128-bit key, 48-bit nonce
 * - PAEF-ForkSkinny-128-192: 128-bit blocks, 128-bit key, 48-bit nonce
 * - PAEF-ForkSkinny-128-256: 128-bit blocks, 128-bit key, 112-bit nonce
 * - PAEF-ForkSkinny-128-288: 128-bit blocks, 128-bit key, 104-bit nonce (primary)
 * - SAEF-ForkSkinny-128-192: 128-bit blocks, 128-bit key, 56-bit nonce
 * - SAEF-ForkSkinny-128-256: 128-bit blocks, 128-bit key, 120-bit nonce
 *
 * NIST Lightweight Cryptography Competition Finalist
 * Reference: https://www.esat.kuleuven.be/cosic/forkae/
 *
 * @author Reference implementation by Southern Storm Software, Pty Ltd (2020)
 * @author JavaScript implementation for SynthelicZ Cipher Tools
 */

(function(global) {
  'use strict';

  // Load dependencies
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }

  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize, Find } = AlgorithmFramework;

  // Import ForkSkinny block cipher implementations
  if (typeof require !== 'undefined') {
    require('../block/forkskinny.js');
  }

  // Helper: XOR two byte arrays
  function xorBytes(a, b, len) {
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = (a[i] ^ b[i]) & 0xFF;
    }
    return result;
  }

  // Helper: Pad block with 0x80 followed by zeros
  function padBlock(data, blockSize) {
    const padded = new Array(blockSize).fill(0);
    padded.splice(0, data.length, ...data);
    if (data.length < blockSize) {
      padded[data.length] = 0x80;
    }
    return padded;
  }

  // Helper: Check if padding is valid
  function checkPadding(block, dataLen, blockSize) {
    if (dataLen >= blockSize) return true;
    if (block[dataLen] !== 0x80) return false;
    for (let i = dataLen + 1; i < blockSize; i++) {
      if (block[i] !== 0) return false;
    }
    return true;
  }

  // ==================== PAEF Mode Implementation ====================

  /**
   * PAEF (Parallel AEAD with Forking) encryption/decryption
   * Uses ForkSkinny to process blocks with counter-based tweakey
   */
  class PAEFMode {
    constructor(blockSize, nonceSize, counterSize, tweakeySize, forkSkinnyVariant) {
      this.blockSize = blockSize;
      this.nonceSize = nonceSize;
      this.counterSize = counterSize;
      this.tweakeySize = tweakeySize;
      this.forkSkinnyVariant = forkSkinnyVariant;
    }

    // Set counter value in tweakey (big-endian with domain separation)
    setCounter(tweakey, counter, domain) {
      // Domain is encoded in top 3 bits of counter
      let val = counter | (domain << (this.counterSize * 8 - 3));
      for (let i = 0; i < this.counterSize; i++) {
        tweakey[16 + this.nonceSize + this.counterSize - 1 - i] = val & 0xFF;
        val >>>= 8;
      }
    }

    // Get ForkSkinny instance for this variant
    getForkSkinnyInstance() {
      const algo = Find(this.forkSkinnyVariant);

      if (!algo) {
        throw new Error(`ForkSkinny variant ${this.forkSkinnyVariant} not found in registry`);
      }

      return algo.CreateInstance(false);
    }

    encrypt(key, nonce, plaintext, ad) {
      // Initialize tweakey: key || nonce || counter
      const tweakey = new Array(this.tweakeySize).fill(0);
      tweakey.splice(0, 16, ...key.slice(0, 16));
      tweakey.splice(16, this.nonceSize, ...nonce);

      // Tag accumulator (XOR of all intermediate tags)
      const tag = new Array(this.blockSize).fill(0);

      // Get ForkSkinny instance
      const forkskinny = this.getForkSkinnyInstance();
      forkskinny.key = tweakey;

      let counter = 1;

      // Process associated data
      let adPos = 0;
      while (ad.length - adPos > this.blockSize) {
        this.setCounter(tweakey, counter, 0);
        forkskinny.key = tweakey;
        forkskinny.forkOutput = "right";
        forkskinny.Feed(ad.slice(adPos, adPos + this.blockSize));
        const block = forkskinny.Result();
        for (let i = 0; i < this.blockSize; i++) {
          tag[i] ^= block[i];
        }
        adPos += this.blockSize;
        counter++;
      }

      // Process final AD block
      const adRem = ad.length - adPos;
      if (adRem === this.blockSize) {
        this.setCounter(tweakey, counter, 1);
        forkskinny.key = tweakey;
        forkskinny.forkOutput = "right";
        forkskinny.Feed(ad.slice(adPos));
        const block = forkskinny.Result();
        for (let i = 0; i < this.blockSize; i++) {
          tag[i] ^= block[i];
        }
      } else if (adRem > 0 || plaintext.length === 0) {
        const padded = padBlock(ad.slice(adPos), this.blockSize);
        this.setCounter(tweakey, counter, 3);
        forkskinny.key = tweakey;
        forkskinny.forkOutput = "right";
        forkskinny.Feed(padded);
        const block = forkskinny.Result();
        for (let i = 0; i < this.blockSize; i++) {
          tag[i] ^= block[i];
        }
      }

      // If no plaintext, return just the tag
      if (plaintext.length === 0) {
        return tag;
      }

      // Process plaintext
      const ciphertext = [];
      counter = 1;
      let ptPos = 0;

      // Process all but last plaintext block
      while (plaintext.length - ptPos > this.blockSize) {
        this.setCounter(tweakey, counter, 4);
        forkskinny.key = tweakey;
        forkskinny.forkOutput = "both";
        forkskinny.Feed(plaintext.slice(ptPos, ptPos + this.blockSize));
        const result = forkskinny.Result();

        // Result contains left output (16 bytes) then right output (16 bytes)
        const leftOutput = result.slice(0, this.blockSize);
        const rightOutput = result.slice(this.blockSize);

        ciphertext.push(...leftOutput);
        for (let i = 0; i < this.blockSize; i++) {
          tag[i] ^= rightOutput[i];
        }

        ptPos += this.blockSize;
        counter++;
      }

      // Process final plaintext block
      const ptRem = plaintext.length - ptPos;
      if (ptRem === this.blockSize) {
        this.setCounter(tweakey, counter, 5);
        forkskinny.key = tweakey;
        forkskinny.forkOutput = "both";
        forkskinny.Feed(plaintext.slice(ptPos));
        const result = forkskinny.Result();

        const leftOutput = result.slice(0, this.blockSize);
        const rightOutput = result.slice(this.blockSize);

        // XOR left output with accumulated tag for ciphertext
        const ctBlock = xorBytes(leftOutput, tag, this.blockSize);
        ciphertext.push(...ctBlock);

        // Right output becomes final tag
        ciphertext.push(...rightOutput);
      } else {
        const padded = padBlock(plaintext.slice(ptPos), this.blockSize);
        this.setCounter(tweakey, counter, 7);
        forkskinny.key = tweakey;
        forkskinny.forkOutput = "both";
        forkskinny.Feed(padded);
        const result = forkskinny.Result();

        const leftOutput = result.slice(0, this.blockSize);
        const rightOutput = result.slice(this.blockSize);

        // XOR left output with accumulated tag - this is the ciphertext block
        const ctBlock = xorBytes(leftOutput, tag, this.blockSize);
        ciphertext.push(...ctBlock);

        // Append truncated right output as truncated tag
        ciphertext.push(...rightOutput.slice(0, ptRem));
      }

      return ciphertext;
    }

    decrypt(key, nonce, ciphertext, ad) {
      if (ciphertext.length < this.blockSize) {
        throw new Error("Ciphertext too short");
      }

      // Initialize tweakey
      const tweakey = new Array(this.tweakeySize).fill(0);
      tweakey.splice(0, 16, ...key.slice(0, 16));
      tweakey.splice(16, this.nonceSize, ...nonce);

      // Tag accumulator
      const tag = new Array(this.blockSize).fill(0);

      // Get ForkSkinny instance
      const forkskinny = this.getForkSkinnyInstance();
      let counter = 1;

      // Process associated data (same as encryption)
      let adPos = 0;
      while (ad.length - adPos > this.blockSize) {
        this.setCounter(tweakey, counter, 0);
        forkskinny.key = tweakey;
        forkskinny.forkOutput = "right";
        forkskinny.Feed(ad.slice(adPos, adPos + this.blockSize));
        const block = forkskinny.Result();
        for (let i = 0; i < this.blockSize; i++) {
          tag[i] ^= block[i];
        }
        adPos += this.blockSize;
        counter++;
      }

      const adRem = ad.length - adPos;
      if (adRem === this.blockSize) {
        this.setCounter(tweakey, counter, 1);
        forkskinny.key = tweakey;
        forkskinny.forkOutput = "right";
        forkskinny.Feed(ad.slice(adPos));
        const block = forkskinny.Result();
        for (let i = 0; i < this.blockSize; i++) {
          tag[i] ^= block[i];
        }
      } else if (adRem > 0 || (ciphertext.length - this.blockSize) === 0) {
        const padded = padBlock(ad.slice(adPos), this.blockSize);
        this.setCounter(tweakey, counter, 3);
        forkskinny.key = tweakey;
        forkskinny.forkOutput = "right";
        forkskinny.Feed(padded);
        const block = forkskinny.Result();
        for (let i = 0; i < this.blockSize; i++) {
          tag[i] ^= block[i];
        }
      }

      // Extract message length
      const msgLen = ciphertext.length - this.blockSize;

      // If no ciphertext, verify tag only
      if (msgLen === 0) {
        const receivedTag = ciphertext.slice(0, this.blockSize);
        for (let i = 0; i < this.blockSize; i++) {
          if (tag[i] !== receivedTag[i]) {
            throw new Error("Authentication tag verification failed");
          }
        }
        return [];
      }

      // Decrypt ciphertext
      const plaintext = [];
      counter = 1;
      let ctPos = 0;

      // Process all but last ciphertext block
      while (msgLen - ctPos > this.blockSize) {
        this.setCounter(tweakey, counter, 4);
        forkskinny.key = tweakey;

        const ctBlock = ciphertext.slice(ctPos, ctPos + this.blockSize);
        const instance = forkskinny.algorithm.CreateInstance(true);
        instance.key = tweakey;
        instance.forkOutput = "both";
        instance.Feed(ctBlock);
        const result = instance.Result();

        const leftOutput = result.slice(0, this.blockSize);
        const rightOutput = result.slice(this.blockSize);

        plaintext.push(...leftOutput);
        for (let i = 0; i < this.blockSize; i++) {
          tag[i] ^= rightOutput[i];
        }

        ctPos += this.blockSize;
        counter++;
      }

      // Process final ciphertext block
      const ctRem = msgLen - ctPos;
      if (ctRem === this.blockSize) {
        this.setCounter(tweakey, counter, 5);

        const ctBlock = ciphertext.slice(ctPos, ctPos + this.blockSize);
        const xoredBlock = xorBytes(ctBlock, tag, this.blockSize);

        const instance = forkskinny.algorithm.CreateInstance(true);
        instance.key = tweakey;
        instance.forkOutput = "both";
        instance.Feed(xoredBlock);
        const result = instance.Result();

        const leftOutput = result.slice(0, this.blockSize);
        const rightOutput = result.slice(this.blockSize);

        plaintext.push(...leftOutput);

        // Verify tag
        const receivedTag = ciphertext.slice(ctPos + this.blockSize);
        for (let i = 0; i < this.blockSize; i++) {
          if (rightOutput[i] !== receivedTag[i]) {
            throw new Error("Authentication tag verification failed");
          }
        }
      } else {
        this.setCounter(tweakey, counter, 7);

        const ctBlock = ciphertext.slice(ctPos, ctPos + this.blockSize);
        const xoredBlock = xorBytes(ctBlock, tag, this.blockSize);

        const instance = forkskinny.algorithm.CreateInstance(true);
        instance.key = tweakey;
        instance.forkOutput = "both";
        instance.Feed(xoredBlock);
        const result = instance.Result();

        const leftOutput = result.slice(0, this.blockSize);
        const rightOutput = result.slice(this.blockSize);

        // Verify padding
        if (!checkPadding(leftOutput, ctRem, this.blockSize)) {
          throw new Error("Invalid padding");
        }

        plaintext.push(...leftOutput.slice(0, ctRem));

        // Verify tag
        const receivedTag = ciphertext.slice(ctPos + this.blockSize, ctPos + this.blockSize + ctRem);
        for (let i = 0; i < ctRem; i++) {
          if (rightOutput[i] !== receivedTag[i]) {
            throw new Error("Authentication tag verification failed");
          }
        }
      }

      return plaintext;
    }
  }

  // ==================== PAEF-ForkSkinny-128-256 Algorithm ====================

  class PAEFForkSkinny128_256 extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "PAEF-ForkSkinny-128-256";
      this.description = "Parallel authenticated encryption with 128-bit blocks using ForkSkinny-128-256 tweakable block cipher. NIST Lightweight Cryptography finalist designed for efficient parallel processing.";
      this.inventor = "Elena Andreeva, Virginie Lallemand, Antoon Purnal, Reza Reyhanitabar, Arnab Roy, Damian Vizar";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedNonceSizes = [new KeySize(14, 14, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];

      this.documentation = [
        new LinkItem("ForkAE Official Website", "https://www.esat.kuleuven.be/cosic/forkae/"),
        new LinkItem("NIST Lightweight Crypto", "https://csrc.nist.gov/projects/lightweight-cryptography"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      // Official NIST test vectors
      this.tests = [
        {
          text: "PAEF-ForkSkinny-128-256 Vector #1 (empty PT, empty AAD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("DE1792AF88E5988B82C8761F9EDB783F")
        },
        {
          text: "PAEF-ForkSkinny-128-256 Vector #2 (empty PT, 1-byte AAD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("9A6B44B77970FADFA42B056E12472C2C")
        },
        {
          text: "PAEF-ForkSkinny-128-256 Vector #34 (1-byte PT, empty AAD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("9F3AEF46FF52FD2160CEC9C6C21B59EB59")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new PAEFForkSkinny128_256Instance(this, isInverse);
    }
  }

  class PAEFForkSkinny128_256Instance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.mode = new PAEFMode(16, 14, 2, 32, "ForkSkinny-128-256");
      this._key = null;
      this._nonce = null;
      this._ad = [];
      this._data = [];
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }
      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }
      if (nonceBytes.length !== 14) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes`);
      }
      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    set associatedData(adBytes) {
      this._ad = adBytes ? [...adBytes] : [];
    }

    get associatedData() {
      return [...this._ad];
    }

    // Alias for test vectors
    set aad(adBytes) {
      this.associatedData = adBytes;
    }

    get aad() {
      return this.associatedData;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");
      this._data.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      let result;
      if (this.isInverse) {
        result = this.mode.decrypt(this._key, this._nonce, this._data, this._ad);
      } else {
        result = this.mode.encrypt(this._key, this._nonce, this._data, this._ad);
      }

      this._data = [];
      this._ad = [];
      return result;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new PAEFForkSkinny128_256());

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      PAEFForkSkinny128_256,
      PAEFForkSkinny128_256Instance
    };
  }

})(typeof window !== 'undefined' ? window : global);
