/*
 * Grain-128-AEAD - NIST Lightweight Cryptography Finalist
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * Grain-128-AEAD is an authenticated encryption algorithm based on the
 * Grain-128 stream cipher. It combines a 128-bit LFSR with a 128-bit NFSR
 * and includes built-in authentication via a 64-bit accumulator.
 *
 * Features:
 * - 128-bit key, 96-bit nonce
 * - 64-bit authentication tag
 * - Hardware-friendly shift register structure
 * - NIST LWC finalist
 *
 * References:
 * - https://grain-128aead.github.io/
 * - NIST Lightweight Cryptography Standardization
 *
 * This implementation is for educational purposes only.
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
    root.Grain128AEAD = factory(root.AlgorithmFramework, root.OpCodes);
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
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class Grain128AEADAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Grain-128-AEAD";
      this.description = "NIST Lightweight Cryptography finalist combining 128-bit LFSR and NFSR with integrated authentication. Designed for resource-constrained environments with hardware-friendly shift register operations.";
      this.inventor = "Martin Hell, Thomas Johansson, Willi Meier, Jonathan Sönnerup, Hirotaka Yoshida";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.SE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(8, 8, 0)  // 64-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("Grain-128-AEAD Official Site", "https://grain-128aead.github.io/"),
        new LinkItem("NIST LWC Round 3 Submission", "https://csrc.nist.gov/Projects/lightweight-cryptography"),
        new LinkItem("Grain-128-AEAD Specification", "https://grain-128aead.github.io/grain-aead-v2.pdf")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Test vectors from NIST LWC KAT (Grain-128AEAD.txt)
      this.tests = [
        {
          text: "NIST LWC Test Vector #1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("F879CF00B4AFA099")  // Tag only
        },
        {
          text: "NIST LWC Test Vector #2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("5FFC2734F4A6C668")
        },
        {
          text: "NIST LWC Test Vector #17 (empty PT, 16-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: [],
          expected: OpCodes.Hex8ToBytes("2BAAC762EF2C63E7")
        },
        {
          text: "BouncyCastle Test Vector #1 (32-byte PT, 31-byte AD)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/Grain128AEADTest.java",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("EAD60EF559493ACEF6A3C238C018835DE3ABB6AA621A9AA65EFAF7B9D05BBE6C0913DFC8674BACC9")
        },
        {
          text: "BouncyCastle Long AEAD Test (32-byte PT, 186-byte AD)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/Grain128AEADTest.java",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9FA0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("731DAA8B1D15317A1CCB4E3DD320095FB27E5BB2A10F2C669F870538637D4F162298C70430A2B560")
        }
      ];

      // Constants
      this.KEY_SIZE = 16;      // 128 bits
      this.NONCE_SIZE = 12;    // 96 bits
      this.TAG_SIZE = 8;       // 64 bits
      this.INIT_ROUNDS = 8;    // 256 bits / 32 bits per round
    }

    CreateInstance(isInverse = false) {
      return new Grain128AEADInstance(this, isInverse);
    }
  }

  class Grain128AEADInstance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._associatedData = [];
      this.inputBuffer = [];

      // Grain-128 state (using 32-bit words for bit-level operations)
      this.lfsr = new Array(4);    // 128 bits = 4 x 32-bit words
      this.nfsr = new Array(4);    // 128 bits = 4 x 32-bit words
      this.authAcc = new Array(2); // 64-bit accumulator (2 x 32-bit words)
      this.authSr = new Array(2);  // 64-bit shift register (2 x 32-bit words)

      this.initialized = false;
    }

    // Property: key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Grain-128-AEAD key must be 16 bytes long, got ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._initializeIfReady();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property: nonce
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(nonceBytes)) {
        throw new Error("Invalid nonce - must be byte array");
      }

      if (nonceBytes.length !== 12) {
        throw new Error(`Grain-128-AEAD requires exactly 12 bytes of nonce, got ${nonceBytes.length} bytes`);
      }

      this._nonce = [...nonceBytes];
      this._initializeIfReady();
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Property: associatedData
    set associatedData(adBytes) {
      if (!adBytes) {
        this._associatedData = [];
        return;
      }

      if (!Array.isArray(adBytes)) {
        throw new Error("Invalid associated data - must be byte array");
      }

      this._associatedData = [...adBytes];
    }

    get associatedData() {
      return [...this._associatedData];
    }

    // Feed/Result pattern
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }
      if (!this.initialized) {
        throw new Error("Grain-128-AEAD not properly initialized");
      }

      const result = [];

      if (this.isInverse) {
        // Decryption mode: input is ciphertext + tag
        if (this.inputBuffer.length < 8) {
          throw new Error("Ciphertext must include 8-byte authentication tag");
        }

        const ctLen = this.inputBuffer.length - 8;
        const ciphertext = this.inputBuffer.slice(0, ctLen);
        const receivedTag = this.inputBuffer.slice(ctLen);

        // Authenticate AD (with DER-encoded length prefix)
        this._authenticateAD();

        // Decrypt ciphertext
        const plaintext = this._decrypt(ciphertext);

        // Compute tag
        const computedTag = this._computeTag();

        // Verify tag (constant-time comparison)
        if (!OpCodes.ConstantTimeCompare(computedTag, receivedTag)) {
          throw new Error("Authentication tag verification failed");
        }

        result.push(...plaintext);
      } else {
        // Encryption mode: input is plaintext
        const plaintext = this.inputBuffer;

        // Authenticate AD (with DER-encoded length prefix)
        this._authenticateAD();

        // Encrypt plaintext
        const ciphertext = this._encrypt(plaintext);

        // Compute tag
        const tag = this._computeTag();

        // Return ciphertext || tag
        result.push(...ciphertext, ...tag);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];
      return result;
    }

    // Initialize Grain-128-AEAD when both key and nonce are set
    _initializeIfReady() {
      if (this._key && this._nonce && !this.initialized) {
        this._setup();
      }
    }

    // Setup Grain-128-AEAD with key and nonce
    _setup() {
      // Prepare working IV: nonce (96 bits) + padding (32 bits: 0xFFFFFF7F)
      const workingIV = new Array(16);
      for (let i = 0; i < 12; ++i) {
        workingIV[i] = this._nonce[i];
      }
      workingIV[12] = 0xFF;
      workingIV[13] = 0xFF;
      workingIV[14] = 0xFF;
      workingIV[15] = 0x7F;

      // Initialize NFSR and LFSR from key and IV (little-endian)
      this.nfsr[0] = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      this.nfsr[1] = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
      this.nfsr[2] = OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]);
      this.nfsr[3] = OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]);

      this.lfsr[0] = OpCodes.Pack32LE(workingIV[0], workingIV[1], workingIV[2], workingIV[3]);
      this.lfsr[1] = OpCodes.Pack32LE(workingIV[4], workingIV[5], workingIV[6], workingIV[7]);
      this.lfsr[2] = OpCodes.Pack32LE(workingIV[8], workingIV[9], workingIV[10], workingIV[11]);
      this.lfsr[3] = OpCodes.Pack32LE(workingIV[12], workingIV[13], workingIV[14], workingIV[15]);

      this.authAcc[0] = 0;
      this.authAcc[1] = 0;
      this.authSr[0] = 0;
      this.authSr[1] = 0;

      // 320 clocks initialization phase
      for (let i = 0; i < 320; ++i) {
        const output = this._getOutput();
        this._shift(this.nfsr, (this._getOutputNFSR() ^ this.lfsr[0] ^ output) & 1);
        this._shift(this.lfsr, (this._getOutputLFSR() ^ output) & 1);
      }

      // Absorb key (64 more clocks)
      for (let quotient = 0; quotient < 8; ++quotient) {
        for (let remainder = 0; remainder < 8; ++remainder) {
          const output = this._getOutput();
          this._shift(this.nfsr, (this._getOutputNFSR() ^ this.lfsr[0] ^ output ^ ((this._key[quotient] >> remainder))) & 1);
          this._shift(this.lfsr, (this._getOutputLFSR() ^ output ^ ((this._key[quotient + 8] >> remainder))) & 1);
        }
      }

      // Initialize authentication accumulator and shift register
      this._initGrain(this.authAcc);
      this._initGrain(this.authSr);

      // Reset keystream buffer position
      this.posn = 0;
      this.ksBufferValid = false;

      this.initialized = true;
    }

    // Shift array right by 1 bit, insert val at MSB
    _shift(array, val) {
      array[0] = OpCodes.ToDWord((array[0] >>> 1) | (array[1] << 31));
      array[1] = OpCodes.ToDWord((array[1] >>> 1) | (array[2] << 31));
      array[2] = OpCodes.ToDWord((array[2] >>> 1) | (array[3] << 31));
      array[3] = OpCodes.ToDWord((array[3] >>> 1) | (val << 31));
    }

    // Get output from NFSR
    _getOutputNFSR() {
      const b0 = this.nfsr[0];
      const b3 = this.nfsr[0] >>> 3;
      const b11 = this.nfsr[0] >>> 11;
      const b13 = this.nfsr[0] >>> 13;
      const b17 = this.nfsr[0] >>> 17;
      const b18 = this.nfsr[0] >>> 18;
      const b22 = this.nfsr[0] >>> 22;
      const b24 = this.nfsr[0] >>> 24;
      const b25 = this.nfsr[0] >>> 25;
      const b26 = this.nfsr[0] >>> 26;
      const b27 = this.nfsr[0] >>> 27;
      const b40 = this.nfsr[1] >>> 8;
      const b48 = this.nfsr[1] >>> 16;
      const b56 = this.nfsr[1] >>> 24;
      const b59 = this.nfsr[1] >>> 27;
      const b61 = this.nfsr[1] >>> 29;
      const b65 = this.nfsr[2] >>> 1;
      const b67 = this.nfsr[2] >>> 3;
      const b68 = this.nfsr[2] >>> 4;
      const b70 = this.nfsr[2] >>> 6;
      const b78 = this.nfsr[2] >>> 14;
      const b82 = this.nfsr[2] >>> 18;
      const b84 = this.nfsr[2] >>> 20;
      const b88 = this.nfsr[2] >>> 24;
      const b91 = this.nfsr[2] >>> 27;
      const b92 = this.nfsr[2] >>> 28;
      const b93 = this.nfsr[2] >>> 29;
      const b95 = this.nfsr[2] >>> 31;
      const b96 = this.nfsr[3];

      return (b0 ^ b26 ^ b56 ^ b91 ^ b96 ^ b3 & b67 ^ b11 & b13 ^ b17 & b18
        ^ b27 & b59 ^ b40 & b48 ^ b61 & b65 ^ b68 & b84 ^ b22 & b24 & b25 ^ b70 & b78 & b82 ^ b88 & b92 & b93 & b95) & 1;
    }

    // Get output from LFSR
    _getOutputLFSR() {
      const s0 = this.lfsr[0];
      const s7 = this.lfsr[0] >>> 7;
      const s38 = this.lfsr[1] >>> 6;
      const s70 = this.lfsr[2] >>> 6;
      const s81 = this.lfsr[2] >>> 17;
      const s96 = this.lfsr[3];

      return (s0 ^ s7 ^ s38 ^ s70 ^ s81 ^ s96) & 1;
    }

    // Get output from output function h(x)
    _getOutput() {
      const b2 = this.nfsr[0] >>> 2;
      const b12 = this.nfsr[0] >>> 12;
      const b15 = this.nfsr[0] >>> 15;
      const b36 = this.nfsr[1] >>> 4;
      const b45 = this.nfsr[1] >>> 13;
      const b64 = this.nfsr[2];
      const b73 = this.nfsr[2] >>> 9;
      const b89 = this.nfsr[2] >>> 25;
      const b95 = this.nfsr[2] >>> 31;
      const s8 = this.lfsr[0] >>> 8;
      const s13 = this.lfsr[0] >>> 13;
      const s20 = this.lfsr[0] >>> 20;
      const s42 = this.lfsr[1] >>> 10;
      const s60 = this.lfsr[1] >>> 28;
      const s79 = this.lfsr[2] >>> 15;
      const s93 = this.lfsr[2] >>> 29;
      const s94 = this.lfsr[2] >>> 30;

      return ((b12 & s8) ^ (s13 & s20) ^ (b95 & s42) ^ (s60 & s79) ^ (b12 & b95 & s94) ^ s93
        ^ b2 ^ b15 ^ b36 ^ b45 ^ b64 ^ b73 ^ b89) & 1;
    }

    // Initialize authentication registers
    _initGrain(auth) {
      for (let quotient = 0; quotient < 2; ++quotient) {
        for (let remainder = 0; remainder < 32; ++remainder) {
          auth[quotient] |= this._getByteKeyStream() << remainder;
        }
      }
    }

    // Get one bit of keystream and shift
    _getByteKeyStream() {
      const rlt = this._getOutput();
      this._shift(this.nfsr, (this._getOutputNFSR() ^ this.lfsr[0]) & 1);
      this._shift(this.lfsr, this._getOutputLFSR() & 1);
      return rlt;
    }

    // Update internal authentication state with one bit
    _updateInternalState(mask) {
      mask = -mask;  // Expand bit to full 32-bit mask
      this.authAcc[0] ^= this.authSr[0] & mask;
      this.authAcc[1] ^= this.authSr[1] & mask;
      mask = this._getByteKeyStream();
      this.authSr[0] = OpCodes.ToDWord((this.authSr[0] >>> 1) | (this.authSr[1] << 31));
      this.authSr[1] = OpCodes.ToDWord((this.authSr[1] >>> 1) | (mask << 31));
    }

    // Encode AD length in DER format
    _encodeDERLength(adlen) {
      const buf = [];
      if (adlen < 0x80) {
        buf.push(adlen);
      } else if (adlen < 0x100) {
        buf.push(0x81, adlen);
      } else if (adlen < 0x10000) {
        buf.push(0x82, adlen >>> 8, adlen & 0xFF);
      } else if (adlen < 0x1000000) {
        buf.push(0x83, adlen >>> 16, (adlen >>> 8) & 0xFF, adlen & 0xFF);
      } else {
        buf.push(0x84, adlen >>> 24, (adlen >>> 16) & 0xFF, (adlen >>> 8) & 0xFF, adlen & 0xFF);
      }
      return buf;
    }

    // Authenticate associated data
    _authenticateAD() {
      const adlen = this._associatedData.length;

      // Encode and authenticate the DER-encoded AD length
      const derLen = this._encodeDERLength(adlen);
      this._absorbAadData(derLen, 0, derLen.length);

      // Authenticate the actual AD
      if (adlen > 0) {
        this._absorbAadData(this._associatedData, 0, adlen);
      }
    }

    // Absorb AAD data into authentication state
    _absorbAadData(buf, off, len) {
      for (let i = 0; i < len; ++i) {
        const b = buf[off + i];
        for (let j = 0; j < 8; ++j) {
          this._shift(this.nfsr, (this._getOutputNFSR() ^ this.lfsr[0]) & 1);
          this._shift(this.lfsr, this._getOutputLFSR() & 1);
          this._updateInternalState((b >> j) & 1);
        }
      }
    }

    // Encrypt plaintext
    _encrypt(plaintext) {
      const ciphertext = [];
      for (let i = 0; i < plaintext.length; ++i) {
        let cc = 0;
        const input_i = plaintext[i];
        for (let j = 0; j < 8; ++j) {
          const input_i_j = (input_i >> j) & 1;
          cc |= (input_i_j ^ this._getByteKeyStream()) << j;
          this._updateInternalState(input_i_j);
        }
        ciphertext.push(cc);
      }
      return ciphertext;
    }

    // Decrypt ciphertext
    _decrypt(ciphertext) {
      const plaintext = [];
      for (let i = 0; i < ciphertext.length; ++i) {
        let cc = 0;
        const input_i = ciphertext[i];
        for (let j = 0; j < 8; ++j) {
          cc |= (((input_i >> j) & 1) ^ this._getByteKeyStream()) << j;
          this._updateInternalState((cc >> j) & 1);
        }
        plaintext.push(cc);
      }
      return plaintext;
    }

    // Compute authentication tag
    _computeTag() {
      // Final step: XOR shift register into accumulator (Java line 229-230)
      this.authAcc[0] ^= this.authSr[0];
      this.authAcc[1] ^= this.authSr[1];

      // Output as little-endian (Java line 231: Pack.intToLittleEndian(authAcc, mac, 0))
      const tag = [];
      // First int (authAcc[0])
      tag.push(this.authAcc[0] & 0xFF);
      tag.push((this.authAcc[0] >>> 8) & 0xFF);
      tag.push((this.authAcc[0] >>> 16) & 0xFF);
      tag.push((this.authAcc[0] >>> 24) & 0xFF);
      // Second int (authAcc[1])
      tag.push(this.authAcc[1] & 0xFF);
      tag.push((this.authAcc[1] >>> 8) & 0xFF);
      tag.push((this.authAcc[1] >>> 16) & 0xFF);
      tag.push((this.authAcc[1] >>> 24) & 0xFF);

      return tag;
    }
  }

  // Register the algorithm
  const algorithmInstance = new Grain128AEADAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // Return for module systems
  return { Grain128AEADAlgorithm, Grain128AEADInstance };
}));
