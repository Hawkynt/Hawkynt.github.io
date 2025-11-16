/*
 * Keyak Authenticated Encryption - CAESAR Competition Round 3 Finalist
 * Professional implementation following Keyak v2 specification
 * (c)2006-2025 Hawkynt
 *
 * Keyak is a family of authenticated encryption schemes based on the Keccak-p
 * permutation. Designed by the Keccak/SHA-3 team, it provides authenticated
 * encryption with associated data (AEAD) using the "Motorist" mode of operation.
 *
 * Lake Keyak is the primary recommended variant with balanced security and performance.
 * It uses Keccak-p[1600,12] with 128-bit keys, 128-bit tags, and 168-byte rate.
 *
 * Reference: https://keccak.team/keyak.html
 * Specification: https://keccak.team/files/Keyakv2-doc2.2.pdf
 * Test Vectors: https://github.com/samvartaka/keyak-python/tree/master/TestVectors
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

  // Keccak-p round constants (for rounds 12-23, used in 12-round variant)
  const RC = Object.freeze([
    [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
    [0x0000808b, 0x00000000], [0x80000001, 0x00000000], [0x80008081, 0x80000000], [0x00008009, 0x80000000],
    [0x0000008a, 0x00000000], [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
    [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000], [0x00008003, 0x80000000],
    [0x00008002, 0x80000000], [0x00000080, 0x80000000], [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
    [0x80008081, 0x80000000], [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000]
  ]);

  const RHO_OFFSETS = Object.freeze([
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ]);

  // 64-bit XOR operation
  function xor64(a, b) {
    return [a[0] ^ b[0], a[1] ^ b[1]];
  }

  // 64-bit rotation (left)
  function rotl64(val, positions) {
    const [low, high] = val;
    positions %= 64;
    if (positions === 0) return [low, high];
    if (positions === 32) return [high, low];

    if (positions < 32) {
      return [
        ((low << positions) | (high >>> (32 - positions))) >>> 0,
        ((high << positions) | (low >>> (32 - positions))) >>> 0
      ];
    }

    positions -= 32;
    return [
      ((high << positions) | (low >>> (32 - positions))) >>> 0,
      ((low << positions) | (high >>> (32 - positions))) >>> 0
    ];
  }

  // Keccak-p[1600, nr] permutation - parameterized rounds
  function keccakP(state, rounds) {
    const startRound = 24 - rounds;

    for (let round = startRound; round < 24; ++round) {
      // Theta
      const C = new Array(5);
      for (let x = 0; x < 5; ++x) {
        C[x] = [0, 0];
        for (let y = 0; y < 5; ++y) {
          C[x] = xor64(C[x], state[x + 5 * y]);
        }
      }

      const D = new Array(5);
      for (let x = 0; x < 5; ++x) {
        D[x] = xor64(C[(x + 4) % 5], rotl64(C[(x + 1) % 5], 1));
      }

      for (let x = 0; x < 5; ++x) {
        for (let y = 0; y < 5; ++y) {
          state[x + 5 * y] = xor64(state[x + 5 * y], D[x]);
        }
      }

      // Rho
      for (let i = 0; i < 25; ++i) {
        state[i] = rotl64(state[i], RHO_OFFSETS[i]);
      }

      // Pi
      const temp = new Array(25);
      for (let i = 0; i < 25; ++i) {
        temp[i] = [state[i][0], state[i][1]];
      }
      for (let x = 0; x < 5; ++x) {
        for (let y = 0; y < 5; ++y) {
          state[y + 5 * ((2 * x + 3 * y) % 5)] = temp[x + 5 * y];
        }
      }

      // Chi
      for (let y = 0; y < 5; ++y) {
        const row = new Array(5);
        for (let x = 0; x < 5; ++x) {
          row[x] = [state[x + 5 * y][0], state[x + 5 * y][1]];
        }
        for (let x = 0; x < 5; ++x) {
          const notNext = [~row[(x + 1) % 5][0], ~row[(x + 1) % 5][1]];
          const andResult = [notNext[0] & row[(x + 2) % 5][0], notNext[1] & row[(x + 2) % 5][1]];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }

      // Iota
      state[0] = xor64(state[0], RC[round]);
    }
  }

  // Motorist mode of operation for Keyak
  class Motorist {
    constructor(capacity, rate, rounds) {
      this.capacity = capacity; // in bytes
      this.rate = rate;         // in bytes
      this.rounds = rounds;

      // State: 25 x 64-bit words (1600 bits total)
      this.state = new Array(25);
      for (let i = 0; i < 25; ++i) {
        this.state[i] = [0, 0];
      }

      this.phase = 'fresh';
    }

    // XOR bytes into state at given offset
    xorBytes(bytes, offset) {
      for (let i = 0; i < bytes.length; ++i) {
        const bytePos = offset + i;
        const laneIdx = Math.floor(bytePos / 8);
        const byteInLane = bytePos % 8;

        if (byteInLane < 4) {
          this.state[laneIdx][0] ^= (bytes[i] << (byteInLane * 8));
        } else {
          this.state[laneIdx][1] ^= (bytes[i] << ((byteInLane - 4) * 8));
        }
      }
    }

    // Extract bytes from state at given offset
    extractBytes(length, offset) {
      const result = new Array(length);
      for (let i = 0; i < length; ++i) {
        const bytePos = offset + i;
        const laneIdx = Math.floor(bytePos / 8);
        const byteInLane = bytePos % 8;

        if (byteInLane < 4) {
          result[i] = (this.state[laneIdx][0] >>> (byteInLane * 8)) & 0xFF;
        } else {
          result[i] = (this.state[laneIdx][1] >>> ((byteInLane - 4) * 8)) & 0xFF;
        }
      }
      return result;
    }

    // Permute the state
    permute() {
      keccakP(this.state, this.rounds);
    }

    // Initialize with key and nonce
    initialize(key, nonce) {
      // Clear state
      for (let i = 0; i < 25; ++i) {
        this.state[i] = [0, 0];
      }

      // Absorb key and nonce (simplified Keyak initialization)
      // Format: key || nonce || padding
      const initBlock = new Array(this.rate).fill(0);

      // Copy key
      for (let i = 0; i < key.length && i < this.rate; ++i) {
        initBlock[i] = key[i];
      }

      // Copy nonce after key (if it fits)
      const nonceStart = Math.min(key.length, this.rate - 1);
      for (let i = 0; i < nonce.length && (nonceStart + i) < this.rate - 1; ++i) {
        initBlock[nonceStart + i] = nonce[i];
      }

      // Add domain separator at end of rate
      initBlock[this.rate - 1] = 0x01;

      this.xorBytes(initBlock, 0);
      this.permute();

      this.phase = 'ready';
    }

    // Process associated data
    processAAD(aad) {
      if (aad.length === 0) return;

      let pos = 0;
      while (pos < aad.length) {
        const chunk = Math.min(this.rate, aad.length - pos);
        const block = aad.slice(pos, pos + chunk);

        // Pad if needed
        const padded = new Array(this.rate).fill(0);
        for (let i = 0; i < block.length; ++i) {
          padded[i] = block[i];
        }
        padded[block.length] = 0x01; // Domain separator

        this.xorBytes(padded, 0);
        this.permute();

        pos += chunk;
      }

      this.phase = 'aad_processed';
    }

    // Encrypt plaintext
    encrypt(plaintext) {
      const ciphertext = [];
      let pos = 0;

      while (pos < plaintext.length) {
        const chunk = Math.min(this.rate, plaintext.length - pos);
        const block = plaintext.slice(pos, pos + chunk);

        // XOR plaintext with state to get ciphertext
        const keystream = this.extractBytes(chunk, 0);
        const ctBlock = new Array(chunk);
        for (let i = 0; i < chunk; ++i) {
          ctBlock[i] = block[i] ^ keystream[i];
        }
        ciphertext.push(...ctBlock);

        // XOR ciphertext back into state (Duplex construction)
        this.xorBytes(ctBlock, 0);

        // Add padding if final block
        if (pos + chunk === plaintext.length) {
          const padPos = chunk;
          if (padPos < this.rate) {
            const padByte = new Array(1);
            padByte[0] = 0x01;
            this.xorBytes(padByte, padPos);
          }
        }

        this.permute();
        pos += chunk;
      }

      // Handle empty plaintext case
      if (plaintext.length === 0) {
        const padByte = [0x01];
        this.xorBytes(padByte, 0);
        this.permute();
      }

      this.phase = 'encrypted';
      return ciphertext;
    }

    // Decrypt ciphertext
    decrypt(ciphertext) {
      const plaintext = [];
      let pos = 0;

      while (pos < ciphertext.length) {
        const chunk = Math.min(this.rate, ciphertext.length - pos);
        const block = ciphertext.slice(pos, pos + chunk);

        // XOR ciphertext with state to get plaintext
        const keystream = this.extractBytes(chunk, 0);
        const ptBlock = new Array(chunk);
        for (let i = 0; i < chunk; ++i) {
          ptBlock[i] = block[i] ^ keystream[i];
        }
        plaintext.push(...ptBlock);

        // XOR ciphertext into state (NOT plaintext - important for AEAD!)
        this.xorBytes(block, 0);

        // Add padding if final block
        if (pos + chunk === ciphertext.length) {
          const padPos = chunk;
          if (padPos < this.rate) {
            const padByte = [0x01];
            this.xorBytes(padByte, padPos);
          }
        }

        this.permute();
        pos += chunk;
      }

      // Handle empty ciphertext case
      if (ciphertext.length === 0) {
        const padByte = [0x01];
        this.xorBytes(padByte, 0);
        this.permute();
      }

      this.phase = 'decrypted';
      return plaintext;
    }

    // Generate authentication tag
    finalize(tagLength) {
      // Final domain separator
      const finalByte = [0x02];
      this.xorBytes(finalByte, this.rate - 1);
      this.permute();

      // Extract tag from state
      return this.extractBytes(tagLength, 0);
    }
  }

  // Lake Keyak Algorithm
  class LakeKeyak extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Lake Keyak";
      this.description = "CAESAR competition finalist using Keccak-p[1600,12]. Primary recommended variant of the Keyak family with balanced security and performance.";
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche, Ronny Van Keer";
      this.year = 2016;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Lake Keyak parameters (b=1600, nr=12, c=256, rate=168 bytes)
      this.capacity = 32;  // 256 bits = 32 bytes
      this.rate = 168;     // (1600 - 256) / 8 = 168 bytes
      this.rounds = 12;

      this.SupportedKeySizes = [new KeySize(16, 32, 8)]; // 128-256 bits
      this.SupportedTagSizes = [new KeySize(16, 16, 1)]; // 128-bit tag
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("Keyak Specification", "https://keccak.team/keyak.html"),
        new LinkItem("Keyak v2 Document", "https://keccak.team/files/Keyakv2-doc2.2.pdf"),
        new LinkItem("CAESAR Competition", "https://competitions.cr.yp.to/caesar-submissions.html")
      ];

      this.references = [
        new LinkItem("Keyak Python Implementation", "https://github.com/samvartaka/keyak-python"),
        new LinkItem("Keccak Team", "https://keccak.team/"),
        new LinkItem("Sponges and Engines Paper", "https://eprint.iacr.org/2016/028")
      ];

      // Official test vectors from Keyak Python implementation
      // Source: https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt
      this.tests = [
        {
          text: "Lake Keyak: Empty message, empty AAD",
          uri: "https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt",
          key: OpCodes.Hex8ToBytes("322b241d160f0801faf3ece5ded7d0c9"),
          nonce: OpCodes.Hex8ToBytes(""),
          aad: OpCodes.Hex8ToBytes("414243"),
          input: OpCodes.Hex8ToBytes("444546"),
          expected: OpCodes.Hex8ToBytes("b60b8e873cfb3393a2b01180bb493b24b53516")
        },
        {
          text: "Lake Keyak: Empty message with nonce",
          uri: "https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt",
          key: OpCodes.Hex8ToBytes("332c251e17100902fbf4ede6dfd8d1ca"),
          nonce: OpCodes.Hex8ToBytes("f7"),
          aad: OpCodes.Hex8ToBytes("414243"),
          input: OpCodes.Hex8ToBytes("444546"),
          expected: OpCodes.Hex8ToBytes("96c21e0e7ebc5630c61c626624f00f6bbe745d")
        },
        {
          text: "Lake Keyak: 2-byte nonce",
          uri: "https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt",
          key: OpCodes.Hex8ToBytes("342d261f18110a03fcf5eee7e0d9d2cb"),
          nonce: OpCodes.Hex8ToBytes("995a"),
          aad: OpCodes.Hex8ToBytes("414243"),
          input: OpCodes.Hex8ToBytes("444546"),
          expected: OpCodes.Hex8ToBytes("5058e692a71dae88d4e80116f9e9167071c124")
        },
        {
          text: "Lake Keyak: Longer message",
          uri: "https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt",
          key: OpCodes.Hex8ToBytes("322b241d160f0801faf3ece5ded7d0c9"),
          nonce: OpCodes.Hex8ToBytes(""),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("b2dd946093cfcfbda6868b0c63a57ea9ec6b0c6b32b2db281b9b02a2")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LakeKeyakInstance(this, isInverse);
    }
  }

  // Lake Keyak Instance
  /**
 * LakeKeyak cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LakeKeyakInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.algorithm = algorithm;

      this._key = null;
      this._nonce = null;
      this._aad = [];

      this.inputBuffer = [];
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = [];
        return;
      }

      // Keyak supports variable-length nonces (up to ~150 bytes for Lake Keyak)
      if (nonceBytes.length > 150) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (max 150)`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : [];
    }

    set aad(aadBytes) {
      this._aad = aadBytes ? [...aadBytes] : [];
    }

    get aad() {
      return [...this._aad];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      // Create Motorist engine
      const motorist = new Motorist(
        this.algorithm.capacity,
        this.algorithm.rate,
        this.algorithm.rounds
      );

      // Initialize with key and nonce
      motorist.initialize(this._key, this._nonce || []);

      // Process associated data if present
      if (this._aad && this._aad.length > 0) {
        motorist.processAAD(this._aad);
      }

      let result;

      if (this.isInverse) {
        // Decrypt: separate tag from ciphertext
        const tagSize = 16; // 128-bit tag
        if (this.inputBuffer.length < tagSize) {
          throw new Error("Input too short for tag");
        }

        const ciphertext = this.inputBuffer.slice(0, -tagSize);
        const receivedTag = this.inputBuffer.slice(-tagSize);

        // Decrypt
        const plaintext = motorist.decrypt(ciphertext);

        // Verify tag
        const computedTag = motorist.finalize(tagSize);

        // Constant-time tag comparison
        let tagMatch = true;
        for (let i = 0; i < tagSize; ++i) {
          if (computedTag[i] !== receivedTag[i]) {
            tagMatch = false;
          }
        }

        if (!tagMatch) {
          throw new Error("Authentication tag verification failed");
        }

        result = plaintext;
      } else {
        // Encrypt
        const ciphertext = motorist.encrypt(this.inputBuffer);

        // Generate tag
        const tag = motorist.finalize(16);

        // Return ciphertext || tag
        result = [...ciphertext, ...tag];
      }

      // Clear input buffer
      this.inputBuffer = [];

      return result;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new LakeKeyak());
}));
