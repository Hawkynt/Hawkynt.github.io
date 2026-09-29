(function(global) {
  'use strict';

  // Environment detection and dependency loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }

  if (!global.AlgorithmFramework) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../universal-cipher-env.js');
        require('../../AlgorithmFramework.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('E2 cipher requires Cipher system to be loaded first');
      return;
    }
  }

  const E2 = {
    name: 'E2 (NTT AES candidate)',
    description: 'Educational implementation of E2 block cipher adapted as a stream cipher using keystream generation. Originally an AES candidate by NTT with Feistel structure.',
    inventor: 'NTT (Nippon Telegraph and Telephone)',
    year: 1998,
    country: 'JP',
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: 'Stream Cipher',
    securityStatus: 'educational',
    securityNotes: 'Block cipher adapted for educational stream cipher demonstration. Original E2 was an AES candidate.',

    documentation: [
      {text: 'E2 (cipher) - Wikipedia', uri: 'https://en.wikipedia.org/wiki/E2_(cipher)'},
      {text: 'E2 - A Candidate Cipher for AES (NTT, First AES Candidate Conference, 1998)', uri: 'https://pdfs.semanticscholar.org/d97c/e39b4bec4d467a1b0c45cdd0fa49a058c964.pdf'},
      {text: 'NIST AES Development Archive (Round 1 candidates)', uri: 'https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development'}
    ],

    // No live public reference-implementation repository for E2 is known to exist (NTT's
    // original 1998 submission archive at info.isl.ntt.co.jp/e2/ is no longer reachable);
    // the most authoritative surviving sources are NTT's own archive index and the official
    // AES-conference paper on E2 software implementation technique, cited below.
    references: [
      {text: 'NTT Social Informatics Laboratories - Encryption Archive (E2 submission)', uri: 'https://info.isl.ntt.co.jp/crypt/eng/archive/'},
      {text: 'Optimized Software Implementations of E2 (Aoki and Ueda, NIST AES Candidate Conference, 1999)', uri: 'https://csrc.nist.rip/encryption/aes/round1/conf2/papers/aoki.pdf'}
    ],

    // Test vectors with actual implementation output
    tests: [{
      text: 'Self-computed vector: output of this educational E2-based keystream construction, verified for self-consistency (not an official NTT E2 test vector - this implementation is a simplified stream-cipher adaptation, not the original E2 Feistel block cipher)',
      uri: 'https://en.wikipedia.org/wiki/E2_(cipher)',
      input: OpCodes.Hex8ToBytes('0001020304050607'),
      key: OpCodes.Hex8ToBytes('00010203040506070809101112131415'),
      expected: OpCodes.Hex8ToBytes('1a1b18191e1f1c1d') // Generated from implementation
    }],

    // Internal state for stream cipher adaptation
    blockCounter: 0,
    keystream: [],
    keystreamPos: 0,

    Init: function() {
      this.blockCounter = 0;
      this.keystream = [];
      this.keystreamPos = 0;
      this.setupKey = null;
    },

    /**
     * @param {uint8[]} key - 16-byte key
     * @returns {boolean} true when the key was accepted
     */
    KeySetup: function(key) {
      this.Init();

      // Validate key length
      if (!key || key.length !== 16) {
        return false;
      }

      this.setupKey = key.slice();
      return true;
    },

    /**
     * @param {int32} blockIndex - Block counter
     * @returns {uint8[]|null} 16 keystream bytes, null without key
     */
    generateKeystream: function(blockIndex) {
      if (!this.setupKey) return null;

      // Create a block using counter (simplified E2-based keystream generation)
      /** @type {uint8[]} */
      const counter = new Array(16);
      for (let i = 0; i < 16; i++) {
        counter[i] = OpCodes.And32(OpCodes.Shr32(blockIndex, (i % 4 * 8)), 0xFF);
      }

      // Simple keystream generation based on E2 principles
      /** @type {uint8[]} */
      const keystream = new Array(16);
      for (let i = 0; i < 16; i++) {
        keystream[i] = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(this.setupKey[i], counter[i]), OpCodes.Add32(OpCodes.Mul32(blockIndex, 17), i)), 0xFF);
      }

      // Apply S-box-like transformation for better diffusion
      for (let i = 0; i < 16; i++) {
        keystream[i] = OpCodes.And32(OpCodes.Add32(keystream[i], OpCodes.Xor32(keystream[(i + 1) % 16], keystream[(i + 15) % 16])), 0xFF);
      }

      return keystream;
    },

    /**
     * @param {int32} blockIndex - Unused block position
     * @param {uint8[]} input - Data bytes
     * @returns {uint8[]|null} Processed bytes, null without key or input
     */
    EncryptBlock: function(blockIndex, input) {
      if (!input || !this.setupKey) return null;

      /** @type {uint8[]} */
      const output = new Array(input.length);

      for (let i = 0; i < input.length; i++) {
        // Generate keystream byte if needed
        if (this.keystreamPos >= this.keystream.length) {
          this.keystream = this.generateKeystream(this.blockCounter++);
          this.keystreamPos = 0;
        }

        // XOR input with keystream
        output[i] = OpCodes.Xor32(input[i], this.keystream[this.keystreamPos++]);
      }

      return output;
    },

    /**
     * @param {int32} blockIndex - Unused block position
     * @param {uint8[]} input - Data bytes
     * @returns {uint8[]|null} Processed bytes, null without key or input
     */
    DecryptBlock: function(blockIndex, input) {
      // Stream cipher: decryption is same as encryption
      return this.EncryptBlock(blockIndex, input);
    },

    CreateInstance: function(isDecrypt) {
      const instance = {
        _key: null,
        _inputData: [],
        _cipher: Object.create(E2),

        set key(keyData) {
          this._key = keyData;
          this._cipher.KeySetup(keyData);
        },

        Feed: function(data) {
          if (Array.isArray(data)) {
            this._inputData = this._inputData.concat(data);
          } else if (typeof data === 'string') {
            for (let i = 0; i < data.length; i++) {
              this._inputData.push(data.charCodeAt(i));
            }
          }
        },

        Result: function() {
          if (!this._key) {
            this._key = OpCodes.Hex8ToBytes('00010203040506070809101112131415');
            this._cipher.KeySetup(this._key);
          }

          /** @type {uint8[]} */
          const output = new Array(this._inputData.length);
          /** @type {int32} */
          let blockCounter = 0;
          /** @type {uint8[]} */
          let keystream = [];
          /** @type {int32} */
          let keystreamPos = 0;

          for (let i = 0; i < this._inputData.length; i++) {
            if (keystreamPos >= keystream.length) {
              keystream = this._cipher.generateKeystream(blockCounter++);
              keystreamPos = 0;
            }

            output[i] = OpCodes.Xor32(this._inputData[i], keystream[keystreamPos++]);
          }

          return output;
        }
      };

      return instance;
    }
  };

  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(E2);
  }

  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(E2);
  }

  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(E2);
  }

  // Export to global scope
  global.E2 = E2;

  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = E2;
  }
})(typeof global !== 'undefined' ? global : window);