/*
 * PhotonBeetle AEAD - NIST Lightweight Cryptography Finalist
 * Professional Implementation following NIST LWC specification
 * (c)2006-2025 Hawkynt
 *
 * PhotonBeetle is a family of lightweight AEAD algorithms based on the PHOTON-256
 * permutation. This file implements both variants:
 * - PhotonBeetle-AEAD[128] (rate=128 bits, capacity=128 bits)
 * - PhotonBeetle-AEAD[32] (rate=32 bits, capacity=224 bits)
 *
 * Features:
 * - 128-bit key and nonce
 * - 128-bit authentication tag
 * - PHOTON-256 permutation with 4-bit S-box
 * - Two rate configurations for different use cases
 * - NIST LWC finalist
 *
 * References:
 * - https://www.isical.ac.in/~lightweight/beetle/
 * - NIST LWC Specification: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/photon-beetle-spec-final.pdf
 *
 * This implementation reuses the PHOTON-256 permutation from photon-beetle-hash.js
 * and implements the authenticated encryption mode with associated data.
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== PHOTON-256 PERMUTATION (Shared between Hash and AEAD) =====

  const D = 8;
  const Dq = 3;
  const Dr = 7;
  const DSquare = 64;
  const ROUND = 12;
  const STATE_INBYTES = 32;

  // PHOTON permutation round constants
  const RC = [
     1,  0,  2,  6, 14, 15, 13,  9,
     3,  2,  0,  4, 12, 13, 15, 11,
     7,  6,  4,  0,  8,  9, 11, 15,
    14, 15, 13,  9,  1,  0,  2,  6,
    13, 12, 14, 10,  2,  3,  1,  5,
    11, 10,  8, 12,  4,  5,  7,  3,
     6,  7,  5,  1,  9,  8, 10, 14,
    12, 13, 15, 11,  3,  2,  0,  4,
     9,  8, 10, 14,  6,  7,  5,  1,
     2,  3,  1,  5, 13, 12, 14, 10,
     5,  4,  6,  2, 10, 11,  9, 13,
    10, 11,  9, 13,  5,  4,  6,  2
  ];

  // MixColumn matrix for PHOTON permutation
  const MixColMatrix = [
    [  2,  4,  2, 11,  2,  8,  5,  6 ],
    [ 12,  9,  8, 13,  7,  7,  5,  2 ],
    [  4,  4, 13, 13,  9,  4, 13,  9 ],
    [  1,  6,  5,  1, 12, 13, 15, 14 ],
    [ 15, 12,  9, 13, 14,  5, 14, 13 ],
    [  9, 14,  5, 15,  4, 12,  9,  6 ],
    [ 12,  2,  2, 10,  3,  1,  1, 14 ],
    [ 15,  1, 13, 10,  5, 10,  2,  3 ]
  ];

  // PHOTON S-box
  const sbox = [ 12, 5, 6, 11, 9, 0, 10, 13, 3, 14, 15, 8, 4, 7, 1, 2 ];

  // PHOTON-256 permutation
  function PHOTON_Permutation(state, state_2d) {
    // Convert byte array to 2D nibble array
    for (let i = 0; i < DSquare; ++i) {
      state_2d[i >> Dq][i & Dr] = ((state[i >> 1] & 0xFF) >>> (4 * (i & 1))) & 0xf;
    }

    // 12 rounds of PHOTON permutation
    for (let round = 0; round < ROUND; ++round) {
      // AddConstant
      const rcOff = round * D;
      for (let i = 0; i < D; ++i) {
        state_2d[i][0] ^= RC[rcOff + i];
      }

      // SubCells (S-box layer)
      for (let i = 0; i < D; ++i) {
        for (let j = 0; j < D; ++j) {
          state_2d[i][j] = sbox[state_2d[i][j]];
        }
      }

      // ShiftRows
      for (let i = 1; i < D; ++i) {
        const temp = new Array(D);
        for (let j = 0; j < D; ++j) {
          temp[j] = state_2d[i][j];
        }
        for (let j = 0; j < D; ++j) {
          state_2d[i][j] = temp[(j + i) % D];
        }
      }

      // MixColumnSerial
      const tempCol = new Array(D);
      for (let j = 0; j < D; ++j) {
        for (let i = 0; i < D; ++i) {
          let sum = 0;
          for (let k = 0; k < D; ++k) {
            const x = MixColMatrix[i][k];
            const b = state_2d[k][j];

            // GF(16) multiplication by expanding b
            sum ^= x * (b & 1);
            sum ^= x * (b & 2);
            sum ^= x * (b & 4);
            sum ^= x * (b & 8);
          }

          // Reduction modulo x^4 + x + 1
          let t0 = sum >>> 4;
          sum = (sum & 15) ^ t0 ^ (t0 << 1);

          let t1 = sum >>> 4;
          sum = (sum & 15) ^ t1 ^ (t1 << 1);

          tempCol[i] = sum & 0xf;
        }
        for (let i = 0; i < D; ++i) {
          state_2d[i][j] = tempCol[i];
        }
      }
    }

    // Convert 2D nibble array back to byte array
    for (let i = 0; i < DSquare; i += 2) {
      state[i >> 1] = ((state_2d[i >> Dq][i & Dr] & 0xf)) |
                       ((state_2d[i >> Dq][(i + 1) & Dr] & 0xf) << 4);
    }
  }

  // ===== PHOTONBEETLE AEAD IMPLEMENTATION =====

  class PhotonBeetleAEADAlgorithm extends AeadAlgorithm {
    constructor(rate) {
      super();

      const is128 = (rate === 128);
      this.rate = rate;
      this.rateInBytes = rate / 8;

      // Required metadata
      this.name = is128 ? "PhotonBeetle-AEAD[128]" : "PhotonBeetle-AEAD[32]";
      this.description = is128
        ? "NIST Lightweight Cryptography finalist with 128-bit rate. Balanced performance using PHOTON-256 permutation with efficient absorption for larger messages."
        : "NIST Lightweight Cryptography finalist with 32-bit rate. Optimized for constrained environments with smaller state updates for enhanced security margin.";
      this.inventor = "Zhenzhen Bao, Avik Chakraborti, Nilanjan Datta, Jian Guo, Mridul Nandi, Thomas Peyrin, Kan Yasuda";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("PhotonBeetle Official Site", "https://www.isical.ac.in/~lightweight/beetle/"),
        new LinkItem("NIST LWC Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/photon-beetle-spec-final.pdf"),
        new LinkItem("NIST LWC Project", "https://csrc.nist.gov/Projects/lightweight-cryptography")
      ];

      // Constants
      this.KEY_SIZE = 16;      // 128 bits
      this.NONCE_SIZE = 16;    // 128 bits (N in spec)
      this.TAG_SIZE = 16;      // 128 bits
      this.STATE_SIZE = 32;    // 256 bits (PHOTON-256)
      this.LAST_THREE_BITS_OFFSET = 5;  // For 256-bit state

      // Load appropriate test vectors based on rate
      if (is128) {
        this._loadTestVectors128();
      } else {
        this._loadTestVectors32();
      }
    }

    _loadTestVectors128() {
      // Official NIST LWC test vectors for PhotonBeetle-AEAD[128]
      this.tests = [
        {
          text: "NIST LWC Vector #1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("DF4E0BAC1162408098FA5CF084D8F464")
        },
        {
          text: "NIST LWC Vector #2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("E840449949081C5378E01EBA6046DBE8")
        },
        {
          text: "NIST LWC KAT Count=34 (1-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("A75DF91EA594D719D44F29E78E0AE94872")
        },
        {
          text: "NIST LWC KAT Count=529 (16-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("A7B9AF5BA1AA580976839229747C9E32403476D930A13D7AF7299E3681FC702B")
        },
        {
          text: "NIST LWC KAT Count=35 (1-byte PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("850D8807C20344C924E2D35382DD3F2D8E")
        }
      ];
    }

    _loadTestVectors32() {
      // Official NIST LWC test vectors for PhotonBeetle-AEAD[32]
      this.tests = [
        {
          text: "NIST LWC Vector #1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("DF4E0BAC1162408098FA5CF084D8F464")
        },
        {
          text: "NIST LWC Vector #2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("E840449949081C5378E01EBA6046DBE8")
        },
        {
          text: "NIST LWC Vector #5 (empty PT, 4-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00010203"),
          input: [],
          expected: OpCodes.Hex8ToBytes("E71C21D5CFFB6D6F5C57725757831467")
        },
        {
          text: "NIST LWC KAT Count=34 (1-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("315DF91EA594D719D44F29E78E0AE94872")
        },
        {
          text: "NIST LWC KAT Count=133 (4-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("31447C09C54CDEB0FD4D20607B6B733FFC021EC2")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new PhotonBeetleAEADInstance(this, isInverse);
    }
  }

  class PhotonBeetleAEADInstance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._associatedData = [];
      this.inputBuffer = [];

      // PHOTON-256 state
      this.state = new Array(STATE_INBYTES).fill(0);
      this.state_2d = Array.from({ length: D }, () => new Array(D).fill(0));

      this.initialized = false;
      this.rate = algorithm.rateInBytes;
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
        throw new Error(`PhotonBeetle-AEAD key must be 16 bytes long, got ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
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

      if (nonceBytes.length !== 16) {
        throw new Error(`PhotonBeetle-AEAD requires exactly 16 bytes of nonce, got ${nonceBytes.length} bytes`);
      }

      this._nonce = [...nonceBytes];
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

      // Initialize state with nonce || key
      for (let i = 0; i < 16; ++i) {
        this.state[i] = this._nonce[i];
        this.state[16 + i] = this._key[i];
      }

      const adLen = this._associatedData.length;
      const mLen = this.inputBuffer.length;
      const output = new Array(mLen + 16);  // Message + Tag

      // Process associated data
      if (adLen > 0) {
        this._processAssociatedData(mLen === 0);
      } else if (mLen === 0) {
        // Empty AD and empty message
        this.state[STATE_INBYTES - 1] ^= (1 << this.algorithm.LAST_THREE_BITS_OFFSET);
      }

      // Encrypt/decrypt the message
      if (mLen > 0) {
        if (this.isInverse) {
          // Decryption: extract tag first
          if (mLen < 16) {
            throw new Error("Ciphertext too short - must include 16-byte tag");
          }
          const ctLen = mLen - 16;
          const ciphertext = this.inputBuffer.slice(0, ctLen);
          const receivedTag = this.inputBuffer.slice(ctLen, mLen);

          // Decrypt
          const plaintext = this._processMessage(ciphertext, adLen === 0, false);

          // Generate and verify tag
          PHOTON_Permutation(this.state, this.state_2d);
          const computedTag = this.state.slice(0, 16);

          // Constant-time tag comparison
          let tagMatch = 0xFF;
          for (let i = 0; i < 16; ++i) {
            tagMatch &= (computedTag[i] ^ receivedTag[i]) - 1;
          }

          if (tagMatch !== 0xFF) {
            throw new Error("Authentication tag verification failed");
          }

          // Clear buffers
          this.inputBuffer = [];
          return plaintext;
        } else {
          // Encryption
          const ciphertext = this._processMessage(this.inputBuffer, adLen === 0, true);

          // Generate tag
          PHOTON_Permutation(this.state, this.state_2d);
          const tag = this.state.slice(0, 16);

          // Return ciphertext || tag
          for (let i = 0; i < ciphertext.length; ++i) {
            output[i] = ciphertext[i];
          }
          for (let i = 0; i < 16; ++i) {
            output[ciphertext.length + i] = tag[i];
          }

          // Clear buffers
          this.inputBuffer = [];
          return output.slice(0, ciphertext.length + 16);
        }
      } else {
        // No message, just generate tag
        PHOTON_Permutation(this.state, this.state_2d);
        const tag = this.state.slice(0, 16);

        this.inputBuffer = [];
        return tag;
      }
    }

    _processAssociatedData(mempty) {
      const ad = this._associatedData;
      const adlen = ad.length;
      let pos = 0;

      // Absorb full rate blocks (C code uses adlen > rate, so don't process last block here)
      while (pos + this.rate < adlen) {
        PHOTON_Permutation(this.state, this.state_2d);
        for (let i = 0; i < this.rate; ++i) {
          this.state[i] ^= ad[pos + i];
        }
        pos += this.rate;
      }

      // Absorb final partial block with padding
      const remaining = adlen - pos;
      PHOTON_Permutation(this.state, this.state_2d);
      for (let i = 0; i < remaining; ++i) {
        this.state[i] ^= ad[pos + i];
      }
      if (remaining < this.rate) {
        this.state[remaining] ^= 0x01;  // ozs padding
      }

      // Add domain separation
      if (mempty && remaining === this.rate) {
        this.state[STATE_INBYTES - 1] ^= (3 << this.algorithm.LAST_THREE_BITS_OFFSET);
      } else if (mempty) {
        this.state[STATE_INBYTES - 1] ^= (4 << this.algorithm.LAST_THREE_BITS_OFFSET);
      } else if (remaining === this.rate) {
        this.state[STATE_INBYTES - 1] ^= (1 << this.algorithm.LAST_THREE_BITS_OFFSET);
      } else {
        this.state[STATE_INBYTES - 1] ^= (2 << this.algorithm.LAST_THREE_BITS_OFFSET);
      }
    }

    _processMessage(msg, adempty, isEncrypt) {
      const mlen = msg.length;
      const output = new Array(mlen);
      const shuffle = new Array(this.rate);
      let pos = 0;

      // Process full rate blocks (C code uses mlen > rate, which means we DON'T process the last block here)
      while (pos + this.rate < mlen) {
        PHOTON_Permutation(this.state, this.state_2d);

        // rhoohr operation: generate keystream from rotated state
        const half = this.rate / 2;
        // Copy second half of state to first half of shuffle
        for (let i = 0; i < half; ++i) {
          shuffle[i] = this.state[half + i];
        }
        // Rotate first half of state by 1 bit to the right, store in second half of shuffle
        for (let i = 0; i < half - 1; ++i) {
          shuffle[half + i] = ((this.state[i] >>> 1) | (this.state[i + 1] << 7)) & 0xFF;
        }
        shuffle[this.rate - 1] = ((this.state[half - 1] >>> 1) | (this.state[0] << 7)) & 0xFF;

        // Update state and generate output
        if (isEncrypt) {
          // Encryption: state ^= plaintext, then ciphertext = plaintext ^ shuffle
          for (let i = 0; i < this.rate; ++i) {
            this.state[i] ^= msg[pos + i];
          }
          for (let i = 0; i < this.rate; ++i) {
            output[pos + i] = msg[pos + i] ^ shuffle[i];
          }
        } else {
          // Decryption: plaintext = ciphertext ^ shuffle, then state ^= plaintext
          for (let i = 0; i < this.rate; ++i) {
            output[pos + i] = msg[pos + i] ^ shuffle[i];
          }
          for (let i = 0; i < this.rate; ++i) {
            this.state[i] ^= output[pos + i];
          }
        }

        pos += this.rate;
      }

      // Process final block (always, even if remaining==0 from full blocks)
      const remaining = mlen - pos;
      PHOTON_Permutation(this.state, this.state_2d);

        // rhoohr operation
        const half = this.rate / 2;
        // Copy second half of state to first half of shuffle
        for (let i = 0; i < half; ++i) {
          shuffle[i] = this.state[half + i];
        }
        // Rotate first half of state by 1 bit to the right, store in second half of shuffle
        for (let i = 0; i < half - 1; ++i) {
          shuffle[half + i] = ((this.state[i] >>> 1) | (this.state[i + 1] << 7)) & 0xFF;
        }
        shuffle[this.rate - 1] = ((this.state[half - 1] >>> 1) | (this.state[0] << 7)) & 0xFF;

        // Update state and generate output for partial block
        if (isEncrypt) {
          // Encryption: state ^= plaintext, then ciphertext = plaintext ^ shuffle
          for (let i = 0; i < remaining; ++i) {
            this.state[i] ^= msg[pos + i];
          }
          if (remaining < this.rate) {
            this.state[remaining] ^= 0x01;  // ozs padding
          }
          for (let i = 0; i < remaining; ++i) {
            output[pos + i] = msg[pos + i] ^ shuffle[i];
          }
        } else {
          // Decryption: plaintext = ciphertext ^ shuffle, then state ^= plaintext
          for (let i = 0; i < remaining; ++i) {
            output[pos + i] = msg[pos + i] ^ shuffle[i];
          }
          for (let i = 0; i < remaining; ++i) {
            this.state[i] ^= output[pos + i];
          }
          if (remaining < this.rate) {
            this.state[remaining] ^= 0x01;  // ozs padding
          }
        }

      // Add domain separation
      if (adempty && remaining === this.rate) {
        this.state[STATE_INBYTES - 1] ^= (5 << this.algorithm.LAST_THREE_BITS_OFFSET);
      } else if (adempty) {
        this.state[STATE_INBYTES - 1] ^= (6 << this.algorithm.LAST_THREE_BITS_OFFSET);
      } else if (remaining === this.rate) {
        this.state[STATE_INBYTES - 1] ^= (1 << this.algorithm.LAST_THREE_BITS_OFFSET);
      } else {
        this.state[STATE_INBYTES - 1] ^= (2 << this.algorithm.LAST_THREE_BITS_OFFSET);
      }

      return output;
    }
  }

  // Register both variants
  RegisterAlgorithm(new PhotonBeetleAEADAlgorithm(128));
  RegisterAlgorithm(new PhotonBeetleAEADAlgorithm(32));

  return {
    PhotonBeetleAEAD128: PhotonBeetleAEADAlgorithm,
    PhotonBeetleAEAD32: PhotonBeetleAEADAlgorithm
  };
}));
