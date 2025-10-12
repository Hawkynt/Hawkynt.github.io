/*
 * TinyJAMBU Lightweight Authenticated Encryption Algorithm
 * NIST LWC Winner - Optimized for IoT and constrained environments
 * Based on reference implementation from NIST LWC competition
 * (c)2024 SynthelicZ Cipher Tools - Educational Implementation
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (REQUIRED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

(function(root, factory) {
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
})(), function(AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework is required for TinyJAMBU');
  }
  if (!OpCodes) {
    throw new Error('OpCodes is required for TinyJAMBU');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // TinyJAMBU Algorithm (unified with variable key sizes)
  class TinyJAMBUAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "TinyJAMBU";
      this.description = "TinyJAMBU is a lightweight authenticated encryption algorithm optimized for IoT devices. Winner of NIST Lightweight Cryptography competition, it provides excellent performance on constrained platforms with minimal RAM and flash footprint. Supports 128/192/256-bit keys.";
      this.inventor = "Hongjun Wu, Tao Huang";
      this.year = 2019;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.SG; // Singapore

      // Algorithm capabilities with variable key sizes
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8) // 128/192/256-bit keys (16/24/32 bytes)
      ];
      this.nonceSize = 12; // 96 bits
      this.tagSize = 8; // 64 bits
      this.stateSize = 16; // 128 bits (4 x 32-bit words)

      // Documentation
      this.documentation = [
        new LinkItem("NIST LWC Winner Announcement", "https://csrc.nist.gov/news/2023/lightweight-cryptography-nist-selects-ascon"),
        new LinkItem("TinyJAMBU Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/tinyjambu-spec-final.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lwc-finalists")
      ];

      // Official test vectors from NIST LWC Known Answer Test (KAT) files
      this.tests = [
        // TinyJAMBU-128 test vectors
        {
          text: "TinyJAMBU-128 KAT Count=1 - Empty PT, Empty AD",
          uri: "https://github.com/rweather/lwc-finalists/blob/master/test/kat/TinyJAMBU-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          input: OpCodes.Hex8ToBytes(""),
          associatedData: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("7C5456E109B55A3A") // Tag only (8 bytes)
        },
        {
          text: "TinyJAMBU-128 KAT Count=13 - Empty PT, 12-byte AD",
          uri: "https://github.com/rweather/lwc-finalists/blob/master/test/kat/TinyJAMBU-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          input: OpCodes.Hex8ToBytes(""),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          expected: OpCodes.Hex8ToBytes("077CF101A9FEBBF5") // Tag only (8 bytes)
        },
        // TinyJAMBU-192 test vector (from official KAT file)
        {
          text: "TinyJAMBU-192 KAT Count=1 - Empty PT, Empty AD",
          uri: "https://github.com/rweather/lwc-finalists/blob/master/test/kat/TinyJAMBU-192.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          input: OpCodes.Hex8ToBytes(""),
          associatedData: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("7A0775B5021A22A6") // Official test vector
        },
        // TinyJAMBU-256 test vector (from official KAT file)
        {
          text: "TinyJAMBU-256 KAT Count=1 - Empty PT, Empty AD",
          uri: "https://github.com/rweather/lwc-finalists/blob/master/test/kat/TinyJAMBU-256.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          input: OpCodes.Hex8ToBytes(""),
          associatedData: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("9B04ED416F7D7F56") // Official test vector
        }
      ];
    }

    CreateInstance(isDecryption = false) {
      return new TinyJAMBUInstance(this, isDecryption);
    }
  }

  // TinyJAMBU Instance Implementation (handles all key sizes)
  class TinyJAMBUInstance extends IAlgorithmInstance {
    constructor(algorithm, isDecryption = false) {
      super(algorithm);
      this.isDecryption = isDecryption;
      this.inputBuffer = [];
      this._key = null;
      this._nonce = null;
      this._associatedData = [];
      this.state = new Array(4).fill(0); // 4 x 32-bit words

      // TinyJAMBU permutation rounds (converted to round counts)
      this.ROUNDS_KEY = Math.floor(1024 / 128);    // 8 rounds
      this.ROUNDS_NONCE = Math.floor(384 / 128);   // 3 rounds
      this.ROUNDS_AD = Math.floor(384 / 128);      // 3 rounds
      this.ROUNDS_MSG = Math.floor(384 / 128);     // 3 rounds
    }

    // Property setters with variable key size support
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      // Validate key size against algorithm's SupportedKeySizes
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16, 24, or 32)`);
      }

      this._key = [...keyBytes];

      // Update key setup rounds based on key size
      // TinyJAMBU-128: 1024/128 = 8 rounds
      // TinyJAMBU-192: 1152/128 = 9 rounds
      // TinyJAMBU-256: 1280/128 = 10 rounds
      if (keyBytes.length === 16) {
        this.ROUNDS_KEY = 8;
      } else if (keyBytes.length === 24) {
        this.ROUNDS_KEY = 9;
      } else if (keyBytes.length === 32) {
        this.ROUNDS_KEY = 10;
      }
    }

    get key() { return this._key ? [...this._key] : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }
      if (nonceBytes.length !== 12) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected 12)`);
      }
      this._nonce = [...nonceBytes];
    }

    get nonce() { return this._nonce ? [...this._nonce] : null; }

    set associatedData(adBytes) {
      this._associatedData = adBytes ? [...adBytes] : [];
    }

    get associatedData() { return [...this._associatedData]; }

    // Alias for test framework compatibility
    set aad(adBytes) {
      this.associatedData = adBytes;
    }

    get aad() { return this.associatedData; }

    // TinyJAMBU permutation (handles 128/192/256-bit keys with proper key schedules)
    permutation(state, key, rounds) {
      // Convert key bytes to 32-bit words (little-endian)
      // For 128-bit: 4 words, 192-bit: 6 words, 256-bit: 8 words
      const keyWords = [];
      for (let i = 0; i < key.length; i += 4) {
        keyWords.push(OpCodes.Pack32LE(
          key[i] || 0,
          key[i + 1] || 0,
          key[i + 2] || 0,
          key[i + 3] || 0
        ));
      }

      // Load state into local variables
      let s0 = state[0];
      let s1 = state[1];
      let s2 = state[2];
      let s3 = state[3];

      // Key schedule depends on key size
      const keySize = keyWords.length;

      if (keySize === 4) {
        // TinyJAMBU-128: Simple pattern key[0,1,2,3] repeated
        while (rounds > 0) {
          // First set of 128 steps
          s0 = this.tinyJambuSteps32(s0, s1, s2, s3, keyWords[0]);
          s1 = this.tinyJambuSteps32(s1, s2, s3, s0, keyWords[1]);
          s2 = this.tinyJambuSteps32(s2, s3, s0, s1, keyWords[2]);
          s3 = this.tinyJambuSteps32(s3, s0, s1, s2, keyWords[3]);
          if (--rounds === 0) break;

          // Second set of 128 steps
          s0 = this.tinyJambuSteps32(s0, s1, s2, s3, keyWords[0]);
          s1 = this.tinyJambuSteps32(s1, s2, s3, s0, keyWords[1]);
          s2 = this.tinyJambuSteps32(s2, s3, s0, s1, keyWords[2]);
          s3 = this.tinyJambuSteps32(s3, s0, s1, s2, keyWords[3]);
          --rounds;
        }
      } else if (keySize === 6) {
        // TinyJAMBU-192: Pattern key[0,1,2,3], key[4,5,0,1], key[2,3,4,5]
        while (rounds > 0) {
          // First set: key[0,1,2,3]
          s0 = this.tinyJambuSteps32(s0, s1, s2, s3, keyWords[0]);
          s1 = this.tinyJambuSteps32(s1, s2, s3, s0, keyWords[1]);
          s2 = this.tinyJambuSteps32(s2, s3, s0, s1, keyWords[2]);
          s3 = this.tinyJambuSteps32(s3, s0, s1, s2, keyWords[3]);
          if (--rounds === 0) break;

          // Second set: key[4,5,0,1]
          s0 = this.tinyJambuSteps32(s0, s1, s2, s3, keyWords[4]);
          s1 = this.tinyJambuSteps32(s1, s2, s3, s0, keyWords[5]);
          s2 = this.tinyJambuSteps32(s2, s3, s0, s1, keyWords[0]);
          s3 = this.tinyJambuSteps32(s3, s0, s1, s2, keyWords[1]);
          if (--rounds === 0) break;

          // Third set: key[2,3,4,5]
          s0 = this.tinyJambuSteps32(s0, s1, s2, s3, keyWords[2]);
          s1 = this.tinyJambuSteps32(s1, s2, s3, s0, keyWords[3]);
          s2 = this.tinyJambuSteps32(s2, s3, s0, s1, keyWords[4]);
          s3 = this.tinyJambuSteps32(s3, s0, s1, s2, keyWords[5]);
          --rounds;
        }
      } else if (keySize === 8) {
        // TinyJAMBU-256: Pattern key[0,1,2,3], key[4,5,6,7]
        while (rounds > 0) {
          // First set: key[0,1,2,3]
          s0 = this.tinyJambuSteps32(s0, s1, s2, s3, keyWords[0]);
          s1 = this.tinyJambuSteps32(s1, s2, s3, s0, keyWords[1]);
          s2 = this.tinyJambuSteps32(s2, s3, s0, s1, keyWords[2]);
          s3 = this.tinyJambuSteps32(s3, s0, s1, s2, keyWords[3]);
          if (--rounds === 0) break;

          // Second set: key[4,5,6,7]
          s0 = this.tinyJambuSteps32(s0, s1, s2, s3, keyWords[4]);
          s1 = this.tinyJambuSteps32(s1, s2, s3, s0, keyWords[5]);
          s2 = this.tinyJambuSteps32(s2, s3, s0, s1, keyWords[6]);
          s3 = this.tinyJambuSteps32(s3, s0, s1, s2, keyWords[7]);
          --rounds;
        }
      }

      // Store back to state
      state[0] = s0;
      state[1] = s1;
      state[2] = s2;
      state[3] = s3;
    }

    // TinyJAMBU 32-step function
    tinyJambuSteps32(s0, s1, s2, s3, kword) {
      // TinyJAMBU step function - 32 steps compressed
      // NOTE: These cross-word rotations are part of the TinyJAMBU specification
      // and cannot be replaced with standard OpCodes rotation functions.
      // They perform rotations across two 32-bit words (treating them as 64-bit values).
      // Reference: TinyJAMBU specification, Section 2.1 (State Update Function)
      const t1 = ((s1 >>> 15) | (s2 << 17)) >>> 0; // Rotate (s1:s2) right by 15
      const t2 = ((s2 >>> 6) | (s3 << 26)) >>> 0;  // Rotate (s2:s3) right by 6
      const t3 = ((s2 >>> 21) | (s3 << 11)) >>> 0; // Rotate (s2:s3) right by 21
      const t4 = ((s2 >>> 27) | (s3 << 5)) >>> 0;  // Rotate (s2:s3) right by 27

      // Update: s0 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ kword
      return (s0 ^ t1 ^ (~(t2 & t3)) ^ t4 ^ kword) >>> 0;
    }

    // Process setup with key and nonce
    setup() {
      // Initialize state with zeros
      this.state = [0, 0, 0, 0];

      // Key setup phase
      this.permutation(this.state, this._key, this.ROUNDS_KEY);

      // Nonce setup phase (3 x 32-bit words)
      for (let i = 0; i < 3; i++) {
        // Add domain separator
        this.state[1] ^= 0x10;
        this.permutation(this.state, this._key, this.ROUNDS_NONCE);

        // Inject nonce word (little-endian)
        const nonceWord = OpCodes.Pack32LE(
          this._nonce[i*4] || 0,
          this._nonce[i*4 + 1] || 0,
          this._nonce[i*4 + 2] || 0,
          this._nonce[i*4 + 3] || 0
        );
        this.state[3] ^= nonceWord;
      }

      // Process associated data
      let adlen = this._associatedData.length;
      let adPos = 0;

      // Process full 32-bit words of associated data
      while (adlen >= 4) {
        this.state[1] ^= 0x30; // Domain separator for AD
        this.permutation(this.state, this._key, this.ROUNDS_AD);
        const adWord = OpCodes.Pack32LE(
          this._associatedData[adPos],
          this._associatedData[adPos + 1],
          this._associatedData[adPos + 2],
          this._associatedData[adPos + 3]
        );
        this.state[3] ^= adWord;
        adPos += 4;
        adlen -= 4;
      }

      // Handle leftover AD bytes with length encoding
      if (adlen === 1) {
        this.state[1] ^= 0x30;
        this.permutation(this.state, this._key, this.ROUNDS_AD);
        this.state[3] ^= this._associatedData[adPos];
        this.state[1] ^= 0x01;
      } else if (adlen === 2) {
        this.state[1] ^= 0x30;
        this.permutation(this.state, this._key, this.ROUNDS_AD);
        const adWord = OpCodes.Pack32LE(
          this._associatedData[adPos],
          this._associatedData[adPos + 1],
          0, 0
        );
        this.state[3] ^= adWord & 0xFFFF;
        this.state[1] ^= 0x02;
      } else if (adlen === 3) {
        this.state[1] ^= 0x30;
        this.permutation(this.state, this._key, this.ROUNDS_AD);
        const adWord = OpCodes.Pack32LE(
          this._associatedData[adPos],
          this._associatedData[adPos + 1],
          this._associatedData[adPos + 2],
          0
        );
        this.state[3] ^= adWord & 0xFFFFFF;
        this.state[1] ^= 0x03;
      }
    }

    // Process message encryption/decryption
    processMessage(data) {
      const output = [];
      let mlen = data.length;
      let mPos = 0;

      // Process full 32-bit words
      while (mlen >= 4) {
        this.state[1] ^= 0x50; // Domain separator for message
        this.permutation(this.state, this._key, this.ROUNDS_MSG);

        const msgWord = OpCodes.Pack32LE(
          data[mPos],
          data[mPos + 1],
          data[mPos + 2],
          data[mPos + 3]
        );

        let outputWord;
        if (this.isDecryption) {
          // Decrypt: ciphertext XOR state[2] gives plaintext
          outputWord = msgWord ^ this.state[2];
          this.state[3] ^= outputWord; // Update state with plaintext
        } else {
          // Encrypt: plaintext goes into state, plaintext XOR state[2] gives ciphertext
          this.state[3] ^= msgWord;
          outputWord = msgWord ^ this.state[2];
        }

        const bytes = OpCodes.Unpack32LE(outputWord);
        output.push(bytes[0], bytes[1], bytes[2], bytes[3]);
        mPos += 4;
        mlen -= 4;
      }

      // Handle leftover message bytes with length encoding
      if (mlen === 1) {
        this.state[1] ^= 0x50;
        this.permutation(this.state, this._key, this.ROUNDS_MSG);
        if (this.isDecryption) {
          const plainByte = (data[mPos] ^ this.state[2]) & 0xFF;
          this.state[3] ^= plainByte;
          this.state[1] ^= 0x01;
          output.push(plainByte);
        } else {
          this.state[3] ^= data[mPos];
          this.state[1] ^= 0x01;
          output.push((data[mPos] ^ this.state[2]) & 0xFF);
        }
      } else if (mlen === 2) {
        this.state[1] ^= 0x50;
        this.permutation(this.state, this._key, this.ROUNDS_MSG);
        const msgWord = OpCodes.Pack32LE(data[mPos], data[mPos + 1], 0, 0) & 0xFFFF;
        if (this.isDecryption) {
          const plainWord = (msgWord ^ this.state[2]) & 0xFFFF;
          this.state[3] ^= plainWord;
          this.state[1] ^= 0x02;
          output.push(plainWord & 0xFF, (plainWord >> 8) & 0xFF);
        } else {
          this.state[3] ^= msgWord;
          this.state[1] ^= 0x02;
          const cipherWord = msgWord ^ this.state[2];
          output.push(cipherWord & 0xFF, (cipherWord >> 8) & 0xFF);
        }
      } else if (mlen === 3) {
        this.state[1] ^= 0x50;
        this.permutation(this.state, this._key, this.ROUNDS_MSG);
        const msgWord = OpCodes.Pack32LE(data[mPos], data[mPos + 1], data[mPos + 2], 0) & 0xFFFFFF;
        if (this.isDecryption) {
          const plainWord = (msgWord ^ this.state[2]) & 0xFFFFFF;
          this.state[3] ^= plainWord;
          this.state[1] ^= 0x03;
          output.push(plainWord & 0xFF, (plainWord >> 8) & 0xFF, (plainWord >> 16) & 0xFF);
        } else {
          this.state[3] ^= msgWord;
          this.state[1] ^= 0x03;
          const cipherWord = msgWord ^ this.state[2];
          output.push(cipherWord & 0xFF, (cipherWord >> 8) & 0xFF, (cipherWord >> 16) & 0xFF);
        }
      }

      return output;
    }

    // Generate authentication tag
    generateTag() {
      // Finalization phase (reference: lines 239-248 in tinyjambu.c)
      this.state[1] ^= 0x70; // Domain separator for finalization
      this.permutation(this.state, this._key, this.ROUNDS_KEY); // Use KEY rounds (1024)

      // Extract first 32 bits of tag from state[2]
      const tag = [];
      const bytes1 = OpCodes.Unpack32LE(this.state[2]);
      tag.push(...bytes1);

      // Second part of tag
      this.state[1] ^= 0x70;
      this.permutation(this.state, this._key, this.ROUNDS_AD); // Use AD rounds (384)

      const bytes2 = OpCodes.Unpack32LE(this.state[2]);
      tag.push(...bytes2);

      return tag; // Return 64-bit tag
    }

    // Feed/Result pattern implementation
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      // Setup with key, nonce, and AD
      this.setup();

      let output = [];

      if (this.isDecryption) {
        // Decryption mode
        if (this.inputBuffer.length < 8) {
          throw new Error("Ciphertext too short (no tag)");
        }

        // Split ciphertext and tag
        const ciphertext = this.inputBuffer.slice(0, -8);
        const receivedTag = this.inputBuffer.slice(-8);

        // Decrypt
        output = this.processMessage(ciphertext);

        // Generate tag for verification
        const computedTag = this.generateTag();

        // Verify tag
        let valid = true;
        for (let i = 0; i < 8; i++) {
          if (computedTag[i] !== receivedTag[i]) {
            valid = false;
          }
        }

        if (!valid) {
          throw new Error("Authentication failed");
        }
      } else {
        // Encryption mode
        output = this.processMessage(this.inputBuffer);
        const tag = this.generateTag();
        output.push(...tag);
      }

      // Clear buffer for next operation
      this.inputBuffer = [];
      return output;
    }
  }

  // Register unified TinyJAMBU algorithm
  RegisterAlgorithm(new TinyJAMBUAlgorithm());

  // Export for testing
  return {
    TinyJAMBUAlgorithm,
    TinyJAMBUInstance
  };
}));
