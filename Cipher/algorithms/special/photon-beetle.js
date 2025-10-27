/*
 * Photon-Beetle AEAD Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * Photon-Beetle - NIST Lightweight Cryptography Finalist
 * Based on PHOTON-256 permutation
 * Reference: BouncyCastle Java implementation and NIST LWC submission
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["../../AlgorithmFramework", "../../OpCodes"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("../../AlgorithmFramework"),
      require("../../OpCodes")
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
})(
  (function () {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    if (typeof self !== "undefined") return self;
    throw new Error("Unable to locate global object");
  })(),
  function (AlgorithmFramework, OpCodes) {
    "use strict";

    if (!AlgorithmFramework) {
      throw new Error("AlgorithmFramework dependency is required");
    }

    if (!OpCodes) {
      throw new Error("OpCodes dependency is required");
    }

    const {
      RegisterAlgorithm,
      CategoryType,
      SecurityStatus,
      ComplexityType,
      CountryCode,
      AeadAlgorithm,
      IAeadInstance,
      KeySize,
      LinkItem,
    } = AlgorithmFramework;

    // Photon-Beetle constants
    const KEY_SIZE = 16;
    const NONCE_SIZE = 16;
    const TAG_SIZE = 16;
    const STATE_SIZE = 32;       // 256 bits = 32 bytes
    const RATE_SIZE = 16;        // 128 bits for pb128
    const D = 8;                 // Dimension
    const D_SQUARE = 64;         // 8x8 cells
    const ROUNDS = 12;

    // Round constants
    const RC = [
      [1, 3, 7, 14, 13, 11, 6, 12, 9, 2, 5, 10],
      [0, 2, 6, 15, 12, 10, 7, 13, 8, 3, 4, 11],
      [2, 0, 4, 13, 14, 8, 5, 15, 10, 1, 6, 9],
      [6, 4, 0, 9, 10, 12, 1, 11, 14, 5, 2, 13],
      [14, 12, 8, 1, 2, 4, 9, 3, 6, 13, 10, 5],
      [15, 13, 9, 0, 3, 5, 8, 2, 7, 12, 11, 4],
      [13, 15, 11, 2, 1, 7, 10, 0, 5, 14, 9, 6],
      [9, 11, 15, 6, 5, 3, 14, 4, 1, 10, 13, 2]
    ];

    // S-box
    const SBOX = [12, 5, 6, 11, 9, 0, 10, 13, 3, 14, 15, 8, 4, 7, 1, 2];

    // MixColumn matrix
    const MIX_MATRIX = [
      [2, 4, 2, 11, 2, 8, 5, 6],
      [12, 9, 8, 13, 7, 7, 5, 2],
      [4, 4, 13, 13, 9, 4, 13, 9],
      [1, 6, 5, 1, 12, 13, 15, 14],
      [15, 12, 9, 13, 14, 5, 14, 13],
      [9, 14, 5, 15, 4, 12, 9, 6],
      [12, 2, 2, 10, 3, 1, 1, 14],
      [15, 1, 13, 10, 5, 10, 2, 3]
    ];

    // GF(16) multiplication
    function gf16Mult(a, b) {
      let result = 0;
      for (let i = 0; i < 4; ++i) {
        if ((b & (1 << i)) !== 0) {
          result ^= a << i;
        }
      }
      // Reduction by x^4 + x + 1
      for (let i = 7; i >= 4; --i) {
        if ((result & (1 << i)) !== 0) {
          result ^= (0x13 << (i - 4));
        }
      }
      return result & 0x0F;
    }

    class PhotonBeetle extends AeadAlgorithm {
      constructor() {
        super();

        this.name = "Photon-Beetle AEAD-ENC-128";
        this.description = "Photon-Beetle is a lightweight AEAD scheme based on the PHOTON-256 permutation, finalist in NIST's Lightweight Cryptography competition. Optimized for constrained environments with 128-bit rate.";
        this.inventor = "Zhenzhen Bao, Avik Chakraborti, Nilanjan Datta, Jian Guo, Mridul Nandi, Thomas Peyrin, Kan Yasuda";
        this.year = 2019;
        this.category = CategoryType.SPECIAL;
        this.subCategory = "AEAD Cipher";
        this.securityStatus = SecurityStatus.EXPERIMENTAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.INTL;

        this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 1)];
        this.SupportedNonceSizes = [new KeySize(NONCE_SIZE, NONCE_SIZE, 1)];
        this.SupportedTagSizes = [new KeySize(TAG_SIZE, TAG_SIZE, 1)];
        this.BlockSize = RATE_SIZE;

        this.documentation = [
          new LinkItem(
            "Photon-Beetle Official Specification (NIST LWC)",
            "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/photon-beetle-spec-final.pdf"
          ),
          new LinkItem(
            "NIST Lightweight Cryptography Project",
            "https://www.nist.gov/programs-projects/lightweight-cryptography"
          ),
          new LinkItem(
            "Photon-Beetle Official Website",
            "https://www.isical.ac.in/~lightweight/beetle/"
          ),
        ];

        this.references = [
          new LinkItem(
            "BouncyCastle Java Implementation",
            "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/PhotonBeetleEngine.java"
          ),
          new LinkItem(
            "Photon-Beetle Reference Implementation",
            "https://github.com/PHOTON-Beetle/Software"
          ),
        ];

        // Official NIST LWC KAT test vectors
        this.tests = [
          {
            text: "NIST LWC KAT Vector #1 - Empty plaintext and AD",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            input: OpCodes.Hex8ToBytes(""),
            aad: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("DF4E0BAC1162408098FA5CF084D8F464"),
          },
          {
            text: "NIST LWC KAT Vector #2 - Empty plaintext, 1 byte AD",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            input: OpCodes.Hex8ToBytes(""),
            aad: OpCodes.Hex8ToBytes("00"),
            expected: OpCodes.Hex8ToBytes("E840449949081C5378E01EBA6046DBE8"),
          },
        ];
      }

      CreateInstance(isInverse = false) {
        return new PhotonBeetleInstance(this, isInverse);
      }
    }

    class PhotonBeetleInstance extends IAeadInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;

        this.state = new Array(STATE_SIZE).fill(0);
        this._key = null;
        this._nonce = null;
        this._aad = [];
        this._aadPos = 0;
        this._buffer = [];
        this._bufPos = 0;
        this.inputEmpty = true;
        this.aadCount = 0;
        this.dataCount = 0;

        this.KeySize = KEY_SIZE;
        this.NonceSize = NONCE_SIZE;
        this.TagSize = TAG_SIZE;
        this.BlockSize = RATE_SIZE;
      }

      set key(keyBytes) {
        if (!keyBytes) {
          this._key = null;
          return;
        }
        if (keyBytes.length !== KEY_SIZE) {
          throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${KEY_SIZE})`);
        }
        this._key = [...keyBytes];
        this.KeySize = KEY_SIZE;

        // Auto-initialize state if both key and nonce are set
        if (this._nonce) {
          this._initializeState();
        }
      }

      get key() {
        return this._key ? [...this._key] : null;
      }

      set nonce(nonceBytes) {
        if (!nonceBytes) {
          this._nonce = null;
          return;
        }
        if (nonceBytes.length !== NONCE_SIZE) {
          throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${NONCE_SIZE})`);
        }
        this._nonce = [...nonceBytes];
        this.NonceSize = NONCE_SIZE;

        // Auto-initialize state if both key and nonce are set
        if (this._key) {
          this._initializeState();
        }
      }

      get nonce() {
        return this._nonce ? [...this._nonce] : null;
      }

      set aad(aadBytes) {
        if (!aadBytes || aadBytes.length === 0) {
          this._aad = [];
          this._aadPos = 0;
          return;
        }
        this._aad = [...aadBytes];
        this._aadPos = aadBytes.length;
      }

      get aad() {
        return this._aad.length > 0 ? [...this._aad] : [];
      }

      _initializeState() {
        // Initialize state with key || nonce
        for (let i = 0; i < KEY_SIZE; ++i) {
          this.state[i] = this._key[i];
        }
        for (let i = 0; i < NONCE_SIZE; ++i) {
          this.state[KEY_SIZE + i] = this._nonce[i];
        }
      }

      Reset() {
        if (!this._key || !this._nonce) {
          this.state.fill(0);
          this.inputEmpty = true;
          this._buffer = [];
          this._bufPos = 0;
          this.aadCount = 0;
          this.dataCount = 0;
          return;
        }

        this._initializeState();

        this.inputEmpty = true;
        this._buffer = [];
        this._bufPos = 0;
        this.aadCount = 0;
        this.dataCount = 0;
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        if (!this._key) throw new Error("Key not set");
        if (!this._nonce) throw new Error("Nonce not set");

        this._buffer.push(...data);
        this._bufPos = this._buffer.length;
        this.dataCount += data.length;
      }

      Result() {
        if (!this._key) throw new Error("Key not set");
        if (!this._nonce) throw new Error("Nonce not set");

        const output = [];
        const msgLen = this.isInverse ? this._bufPos - TAG_SIZE : this._bufPos;

        // Process AAD (pass msgLen so it knows if message is empty)
        this._processAAD(msgLen);

        // Process full blocks
        let offset = 0;
        while (offset + RATE_SIZE <= msgLen) {
          const block = this._buffer.slice(offset, offset + RATE_SIZE);
          const processed = this.isInverse
            ? this._decryptBlock(block)
            : this._encryptBlock(block);
          output.push(...processed);
          offset += RATE_SIZE;
        }

        // Process final block
        const remaining = this._buffer.slice(offset, msgLen);
        const finalOutput = this.isInverse
          ? this._decryptFinal(remaining)
          : this._encryptFinal(remaining);
        output.push(...finalOutput);

        // Finalize and generate/verify tag
        this._finalize(msgLen);
        const tag = this.state.slice(0, TAG_SIZE);

        if (this.isInverse) {
          // Verify tag
          const expectedTag = this._buffer.slice(msgLen, msgLen + TAG_SIZE);
          let tagMatch = true;
          for (let i = 0; i < TAG_SIZE; ++i) {
            if (tag[i] !== expectedTag[i]) tagMatch = false;
          }
          if (!tagMatch) {
            throw new Error("Authentication tag verification failed");
          }
        } else {
          // Append tag
          output.push(...tag);
        }

        // Clear buffers
        this._buffer = [];
        this._bufPos = 0;
        this._aad = [];
        this._aadPos = 0;

        return output;
      }

      _processAAD(msgLen) {
        if (this._aadPos === 0) return;

        this.aadCount = this._aadPos;

        // Process full AAD blocks
        let offset = 0;
        while (offset + RATE_SIZE < this._aadPos) {  // Changed <= to < to match reference
          this._photonPermutation();
          const block = this._aad.slice(offset, offset + RATE_SIZE);
          for (let i = 0; i < RATE_SIZE; ++i) {
            this.state[i] ^= block[i];
          }
          offset += RATE_SIZE;
        }

        // Process final AAD block
        const remaining = this._aadPos - offset;
        this._photonPermutation();
        for (let i = 0; i < remaining; ++i) {
          this.state[i] ^= this._aad[offset + i];
        }
        if (remaining < RATE_SIZE) {
          this.state[remaining] ^= 0x01; // padding
        }

        // Add domain constant based on message empty and last block size
        const lastThreeBitsOffset = 5;
        const mempty = (msgLen === 0);  // Use actual message length, not dataCount
        let domainConst;
        if (mempty && remaining === RATE_SIZE) {
          domainConst = 3;
        } else if (mempty) {
          domainConst = 4;
        } else if (remaining === RATE_SIZE) {
          domainConst = 1;
        } else {
          domainConst = 2;
        }
        this.state[STATE_SIZE - 1] ^= domainConst << lastThreeBitsOffset;
      }

      _encryptBlock(block) {
        const output = this._rhoohr(block, RATE_SIZE);
        for (let i = 0; i < RATE_SIZE; ++i) {
          this.state[i] ^= block[i];
        }
        this.inputEmpty = false;
        return output;
      }

      _decryptBlock(block) {
        const output = this._rhoohr(block, RATE_SIZE);
        for (let i = 0; i < RATE_SIZE; ++i) {
          this.state[i] ^= output[i];
        }
        this.inputEmpty = false;
        return output;
      }

      _encryptFinal(block) {
        if (block.length === 0) {
          return [];
        }
        const output = this._rhoohr(block, block.length);
        for (let i = 0; i < block.length; ++i) {
          this.state[i] ^= block[i];
        }
        if (block.length < RATE_SIZE) {
          this.state[block.length] ^= 0x01; // padding
        }
        this.inputEmpty = false;
        return output;
      }

      _decryptFinal(block) {
        if (block.length === 0) {
          return [];
        }
        const output = this._rhoohr(block, block.length);
        for (let i = 0; i < block.length; ++i) {
          this.state[i] ^= output[i];
        }
        if (block.length < RATE_SIZE) {
          this.state[block.length] ^= 0x01; // padding
        }
        return output;
      }

      _rhoohr(input, len) {
        this._photonPermutation();
        const halfRate = RATE_SIZE >>> 1;
        const output = new Array(len);

        // Perform ROTR1 on first half of rate (state[0..halfRate-1])
        const rotated = new Array(halfRate);
        for (let i = 0; i < halfRate - 1; ++i) {
          rotated[i] = ((this.state[i] & 0xFF) >>> 1) | ((this.state[i + 1] & 1) << 7);
        }
        rotated[halfRate - 1] = ((this.state[halfRate - 1] & 0xFF) >>> 1) | ((this.state[0] & 1) << 7);

        // XOR operations as per BouncyCastle
        const loopEnd = Math.min(len, halfRate);

        // First part: XOR state[halfRate..] with input
        for (let i = 0; i < loopEnd; ++i) {
          output[i] = this.state[halfRate + i] ^ input[i];
        }

        // Second part: XOR rotated with remaining input
        for (let i = loopEnd; i < len; ++i) {
          output[i] = rotated[i - halfRate] ^ input[i];
        }

        return output;
      }

      _finalize(msgLen) {
        const lastThreeBitsOffset = 5;
        const adempty = (this.aadCount === 0);

        // Only apply domain constant if message was processed
        if (msgLen > 0) {
          const lastBlockSize = msgLen % RATE_SIZE || RATE_SIZE;
          let domainConst;
          if (adempty && lastBlockSize === RATE_SIZE) {
            domainConst = 5;
          } else if (adempty) {
            domainConst = 6;
          } else if (lastBlockSize === RATE_SIZE) {
            domainConst = 1;
          } else {
            domainConst = 2;
          }
          this.state[STATE_SIZE - 1] ^= domainConst << lastThreeBitsOffset;
        } else if (adempty && msgLen === 0) {
          // Both AD and message empty: domain constant 1
          this.state[STATE_SIZE - 1] ^= 1 << lastThreeBitsOffset;
        }
        // If AAD present but message empty: no domain constant (already applied in _processAAD)

        this._photonPermutation();
      }

      _photonPermutation() {
        // Convert byte state to 2D nibble array
        const state2d = [];
        for (let i = 0; i < D; ++i) {
          state2d[i] = new Array(D);
        }

        // BouncyCastle extracts low nibble first (i&1==0), then high nibble (i&1==1)
        for (let i = 0; i < D_SQUARE; ++i) {
          const row = i >>> 3;
          const col = i & 7;
          const byteVal = this.state[i >> 1];
          const nibble = ((byteVal & 0xFF) >>> (4 * (i & 1))) & 0x0F;
          state2d[row][col] = nibble;
        }

        // 12 rounds
        for (let round = 0; round < ROUNDS; ++round) {
          // AddKey
          for (let i = 0; i < D; ++i) {
            state2d[i][0] ^= RC[i][round];
          }

          // SubCell
          for (let i = 0; i < D; ++i) {
            for (let j = 0; j < D; ++j) {
              state2d[i][j] = SBOX[state2d[i][j]];
            }
          }

          // ShiftRow
          const tmp = [];
          for (let i = 0; i < D; ++i) {
            tmp[i] = [...state2d[i]];
          }
          for (let i = 1; i < D; ++i) {
            for (let j = 0; j < D; ++j) {
              state2d[i][j] = tmp[i][(j + i) % D];
            }
          }

          // MixColumn
          for (let j = 0; j < D; ++j) {
            const col = [];
            for (let i = 0; i < D; ++i) {
              col[i] = 0;
              for (let k = 0; k < D; ++k) {
                col[i] ^= gf16Mult(MIX_MATRIX[i][k], state2d[k][j]);
              }
            }
            for (let i = 0; i < D; ++i) {
              state2d[i][j] = col[i];
            }
          }
        }

        // Convert back to bytes
        // BouncyCastle packs: state[i>>>1] = nibble[i] | (nibble[i+1] << 4)
        for (let i = 0; i < D_SQUARE; i += 2) {
          const row = i >>> 3;
          const col = i & 7;
          const nibble0 = state2d[row][col] & 0x0F;          // low nibble
          const nibble1 = state2d[row][(col + 1) & 7] & 0x0F; // high nibble
          this.state[i >>> 1] = nibble0 | (nibble1 << 4);
        }
      }
    }

    // Register algorithm
    RegisterAlgorithm(new PhotonBeetle());

    return PhotonBeetle;
  }
);
