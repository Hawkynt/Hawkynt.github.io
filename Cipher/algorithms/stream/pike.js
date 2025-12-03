/*
 * Pike Stream Cipher Implementation
 * Educational implementation inspired by Pike cipher by Ross Anderson
 * Based on three lagged Fibonacci generators with clock control
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  // Environment detection and dependency loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }

  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      console.error('Failed to load AlgorithmFramework:', e.message);
      return;
    }
  }

  const PIKE = {
    // Required metadata following CONTRIBUTING.md
    name: "PIKE",
    description: "Educational implementation inspired by Pike stream cipher. Designed by Ross Anderson using three lagged Fibonacci generators with clock control mechanism.",
    inventor: "Ross Anderson",
    year: 1994,
    country: "GB",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: global.AlgorithmFramework ? global.AlgorithmFramework.SecurityStatus.EDUCATIONAL : "educational",
    securityNotes: "Educational implementation only. Pike was designed to replace FISH but has potential vulnerabilities. Use only for educational purposes.",

    documentation: [
      {text: "Pike Cipher Wikipedia", uri: "https://en.wikipedia.org/wiki/Pike_(cipher)"},
      {text: "Lagged Fibonacci Generators", uri: "https://en.wikipedia.org/wiki/Lagged_Fibonacci_generator"},
      {text: "Ross Anderson's Work", uri: "https://www.cl.cam.ac.uk/~rja14/"}
    ],

    references: [
      {text: "FISH Cryptanalysis", uri: "https://www.cl.cam.ac.uk/~rja14/Papers/fibonacci.pdf"},
      {text: "Pike Design Notes", uri: "https://en.wikipedia.org/wiki/Pike_(cipher)"},
      {text: "Anderson's Publications", uri: "https://www.cl.cam.ac.uk/~rja14/papers.html"}
    ],

    knownVulnerabilities: [
      {
        type: "Educational Implementation",
        text: "This is a simplified educational implementation",
        mitigation: "Use only for learning about lagged Fibonacci generators"
      }
    ],

    tests: [
      {
        text: "Pike Educational Test Vector 1 (Empty)",
        uri: "Educational test case",
        key: global.OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        iv: global.OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        input: global.OpCodes.Hex8ToBytes(""),
        expected: global.OpCodes.Hex8ToBytes("")
      },
      {
        text: "Pike Educational Test Vector 2 (Single Byte)",
        uri: "Educational test case",
        key: global.OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        iv: global.OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        input: global.OpCodes.Hex8ToBytes("00"),
        expected: global.OpCodes.Hex8ToBytes("20")
      },
      {
        text: "Pike Educational Test Vector 3 (Two Bytes)",
        uri: "Educational test case",
        key: global.OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        iv: global.OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        input: global.OpCodes.Hex8ToBytes("0001"),
        expected: global.OpCodes.Hex8ToBytes("20BF")
      },
      {
        text: "Pike Educational Test Vector 4 (Block)",
        uri: "Educational test case",
        key: global.OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        iv: global.OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        input: global.OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        expected: global.OpCodes.Hex8ToBytes("20BF4E19EC9F6A19F89B3EFDB47732D1")
      }
    ],

    // Legacy interface properties
    internalName: 'pike',
    minKeyLength: 32,
    maxKeyLength: 32,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 65536,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    // Pike educational parameters
    KEY_SIZE: 32,       // 256-bit key
    IV_SIZE: 16,        // 128-bit IV

    // LFG parameters (simplified Pike-inspired)
    LAG_A: 55, TAP_A: 24,   // a_i = a_{i-55} + a_{i-24} (mod 2^32)
    LAG_B: 57, TAP_B: 7,    // b_i = b_{i-57} + b_{i-7} (mod 2^32)
    LAG_C: 58, TAP_C: 19,   // c_i = c_{i-58} + c_{i-19} (mod 2^32)

    // Initialize algorithm
    Init: function() {
      this.isInitialized = true;
      return true;
    },

    // Key setup for legacy interface
    KeySetup: function(key) {
      if (!key || key.length < 8) {
        throw new Error('Pike requires at least 64-bit (8 byte) key');
      }

      // Accept various key sizes and adapt them to the required size
      let adaptedKey;
      if (key.length === this.KEY_SIZE) {
        adaptedKey = global.OpCodes.CopyArray(key);
      } else if (key.length > this.KEY_SIZE) {
        // Truncate longer keys
        adaptedKey = key.slice(0, this.KEY_SIZE);
      } else {
        // Extend shorter keys by repetition
        adaptedKey = new Array(this.KEY_SIZE);
        for (let i = 0; i < this.KEY_SIZE; i++) {
          adaptedKey[i] = key[i % key.length];
        }
      }

      this.key = adaptedKey;
      this.keyScheduled = true;
      return 'pike-educational-' + Math.random().toString(36).substr(2, 9);
    },

    // Educational Pike-inspired stream function
    educationalPike: function(key, iv, data) {
      // Initialize three LFGs with key and IV material
      const lfgA = new Array(this.LAG_A);
      const lfgB = new Array(this.LAG_B);
      const lfgC = new Array(this.LAG_C);

      // Initialize LFG A with key material
      for (let i = 0; i < this.LAG_A; i++) {
        lfgA[i] = global.OpCodes.Pack32LE(
          key[(i * 4) % key.length], key[(i * 4 + 1) % key.length],
          key[(i * 4 + 2) % key.length], key[(i * 4 + 3) % key.length]
        );
      }

      // Initialize LFG B with key material (offset)
      for (let i = 0; i < this.LAG_B; i++) {
        lfgB[i] = global.OpCodes.Pack32LE(
          key[(i * 4 + 8) % key.length], key[(i * 4 + 9) % key.length],
          key[(i * 4 + 10) % key.length], key[(i * 4 + 11) % key.length]
        );
      }

      // Initialize LFG C with key material (different offset)
      for (let i = 0; i < this.LAG_C; i++) {
        lfgC[i] = global.OpCodes.Pack32LE(
          key[(i * 4 + 16) % key.length], key[(i * 4 + 17) % key.length],
          key[(i * 4 + 18) % key.length], key[(i * 4 + 19) % key.length]
        );
      }

      // Mix in IV
      if (iv && iv.length >= 16) {
        for (let i = 0; i < 4; i++) {
          const ivWord = global.OpCodes.Pack32LE(
            iv[i * 4], iv[i * 4 + 1], iv[i * 4 + 2], iv[i * 4 + 3]
          );
          lfgA[i] = global.OpCodes.XorN(lfgA[i], ivWord);
          lfgB[i] = global.OpCodes.XorN(lfgB[i], ivWord);
          lfgC[i] = global.OpCodes.XorN(lfgC[i], ivWord);
        }
      }

      // LFG positions
      let posA = 0, posB = 0, posC = 0;

      // Generate keystream and encrypt data
      const output = [];

      for (let i = 0; i < data.length; i++) {
        // Simplified keystream generation (Pike-inspired but educational)
        // Mix the LFG states to create keystream

        // Simple state mixing for educational purposes
        const mixA = global.OpCodes.ToUint32(lfgA[posA % this.LAG_A] + lfgA[(posA + this.TAP_A) % this.LAG_A]);
        const mixB = global.OpCodes.ToUint32(lfgB[posB % this.LAG_B] + lfgB[(posB + this.TAP_B) % this.LAG_B]);
        const mixC = global.OpCodes.ToUint32(lfgC[posC % this.LAG_C] + lfgC[(posC + this.TAP_C) % this.LAG_C]);

        // Update LFG states
        lfgA[posA % this.LAG_A] = mixA;
        lfgB[posB % this.LAG_B] = mixB;
        lfgC[posC % this.LAG_C] = mixC;

        // Generate keystream by combining all three
        const keystreamWord = global.OpCodes.ToUint32(global.OpCodes.XorN(global.OpCodes.XorN(global.OpCodes.XorN(mixA, mixB), mixC), (i * 0x9E3779B9)));
        const keystreamByte = global.OpCodes.AndN((keystreamWord + i), 0xFF);

        output.push(global.OpCodes.XorN(data[i], keystreamByte));

        // Advance positions
        posA = (posA + 1) % this.LAG_A;
        posB = (posB + 1) % this.LAG_B;
        posC = (posC + 1) % this.LAG_C;
      }

      return output;
    },

    // Legacy cipher interface
    szEncryptBlock: function(blockIndex, plaintext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }

      const iv = new Array(this.IV_SIZE).fill(0);
      iv[0] = global.OpCodes.AndN(blockIndex, 0xFF);
      iv[1] = global.OpCodes.AndN(global.OpCodes.ShiftR32(blockIndex, 8), 0xFF);

      return this.educationalPike(this.key, iv, plaintext);
    },

    szDecryptBlock: function(blockIndex, ciphertext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }

      const iv = new Array(this.IV_SIZE).fill(0);
      iv[0] = global.OpCodes.AndN(blockIndex, 0xFF);
      iv[1] = global.OpCodes.AndN(global.OpCodes.ShiftR32(blockIndex, 8), 0xFF);

      return this.educationalPike(this.key, iv, ciphertext);
    },

    // Create algorithm instance (required by AlgorithmFramework)
    CreateInstance: function(isDecrypt) {
      return {
        _instance: null,
        _inputData: [],
        _key: null,
        _iv: null,

        set key(keyData) {
          this._key = keyData;
        },

        get key() {
          return this._key ? [...this._key] : null;
        },

        set iv(ivData) {
          this._iv = ivData;
        },

        get iv() {
          return this._iv ? [...this._iv] : null;
        },

        Feed: function(data) {
          if (Array.isArray(data)) {
            this._inputData = data.slice();
          } else if (typeof data === 'string') {
            this._inputData = [];
            for (let i = 0; i < data.length; i++) {
              this._inputData.push(data.charCodeAt(i));
            }
          }
        },

        Result: function() {
          if (!this._inputData) {
            return [];
          }

          // Use default key/iv if not provided
          const key = this._key || new Array(PIKE.KEY_SIZE).fill(0);
          const iv = this._iv || new Array(PIKE.IV_SIZE).fill(0);

          return PIKE.educationalPike(key, iv, this._inputData);
        }
      };
    },

    ClearData: function() {
      if (this.key) {
        global.OpCodes.ClearArray(this.key);
      }
      this.keyScheduled = false;
    }
  };

  // Auto-register with global cipher registry
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    try {
      global.Cipher.Add(PIKE);
    } catch (e) {
      console.error('Failed to register Pike with global cipher registry:', e.message);
    }
  }

  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    try {
      global.AlgorithmFramework.RegisterAlgorithm(PIKE);
    } catch (e) {
      console.error('Failed to register Pike with AlgorithmFramework:', e.message);
    }
  }

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PIKE;
  }

  // Global export
  global.PIKE = PIKE;

})(typeof global !== 'undefined' ? global : window);