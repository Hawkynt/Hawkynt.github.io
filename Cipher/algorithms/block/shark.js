/*
 * SHARK Block Cipher
 * 64-bit block cipher with 128-bit key and variable rounds (default 6)
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', './shark-cboxes.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./shark-cboxes.data')
    );
  } else {
    // Browser/Worker global
    root.SHARK = factory(root.AlgorithmFramework, root.OpCodes, root.SharkCBoxes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, SharkCBoxes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  if (!SharkCBoxes) {
    throw new Error('SharkCBoxes dependency is required');
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

  // Extract C-boxes for optimized transformations
  const { CBOX_ENC, CBOX_DEC } = SharkCBoxes;

  // ===== S-BOXES AND C-BOXES =====

  // Encryption S-box
  const SBOX_ENC = Object.freeze([
    177, 206, 195, 149,  90, 173, 231,   2,  77,  68, 251, 145,  12, 135, 161,  80,
    203, 103,  84, 221,  70, 143, 225,  78, 240, 253, 252, 235, 249, 196,  26, 110,
     94, 245, 204, 141,  28,  86,  67, 254,   7,  97, 248, 117,  89, 255,   3,  34,
    138, 209,  19, 238, 136,   0,  14,  52,  21, 128, 148, 227, 237, 181,  83,  35,
     75,  71,  23, 167, 144,  53, 171, 216, 184, 223,  79,  87, 154, 146, 219,  27,
     60, 200, 153,   4, 142, 224, 215, 125, 133, 187,  64,  44,  58,  69, 241,  66,
    101,  32,  65,  24, 114,  37, 147, 112,  54,   5, 242,  11, 163, 121, 236,   8,
     39,  49,  50, 182, 124, 176,  10, 115,  91, 123, 183, 129, 210,  13, 106,  38,
    158,  88, 156, 131, 116, 179, 172,  48, 122, 105, 119,  15, 174,  33, 222, 208,
     46, 151,  16, 164, 152, 168, 212, 104,  45,  98,  41, 109,  22,  73, 118, 199,
    232, 193, 150,  55, 229, 202, 244, 233,  99,  18, 194, 166,  20, 188, 211,  40,
    175,  47, 230,  36,  82, 198, 160,   9, 189, 140, 207,  93,  17,  95,   1, 197,
    159,  61, 162, 155, 201,  59, 190,  81,  25,  31,  63,  92, 178, 239,  74, 205,
    191, 186, 111, 100, 217, 243,  62, 180, 170, 220, 213,   6, 192, 126, 246, 102,
    108, 132, 113,  56, 185,  29, 127, 157,  72, 139,  42, 218, 165,  51, 130,  57,
    214, 120, 134, 250, 228,  43, 169,  30, 137,  96, 107, 234,  85,  76, 247, 226
  ]);

  // Decryption S-box
  const SBOX_DEC = Object.freeze([
     53, 190,   7,  46,  83, 105, 219,  40, 111, 183, 118, 107,  12, 125,  54, 139,
    146, 188, 169,  50, 172,  56, 156,  66,  99, 200,  30,  79,  36, 229, 247, 201,
     97, 141,  47,  63, 179, 101, 127, 112, 175, 154, 234, 245,  91, 152, 144, 177,
    135, 113, 114, 237,  55,  69, 104, 163, 227, 239,  92, 197,  80, 193, 214, 202,
     90,  98,  95,  38,   9,  93,  20,  65, 232, 157, 206,  64, 253,   8,  23,  74,
     15, 199, 180,  62,  18, 252,  37,  75, 129,  44,   4, 120, 203, 187,  32, 189,
    249,  41, 153, 168, 211,  96, 223,  17, 151, 137, 126, 250, 224, 155,  31, 210,
    103, 226, 100, 119, 132,  43, 158, 138, 241, 109, 136, 121, 116,  87, 221, 230,
     57, 123, 238, 131, 225,  88, 242,  13,  52, 248,  48, 233, 185,  35,  84,  21,
     68,  11,  77, 102,  58,   3, 162, 145, 148,  82,  76, 195, 130, 231, 128, 192,
    182,  14, 194, 108, 147, 236, 171,  67, 149, 246, 216,  70, 134,   5, 140, 176,
    117,   0, 204, 133, 215,  61, 115, 122,  72, 228, 209,  89, 173, 184, 198, 208,
    220, 161, 170,   2,  29, 191, 181, 159,  81, 196, 165,  16,  34, 207,   1, 186,
    143,  49, 124, 174, 150, 218, 240,  86,  71, 212, 235,  78, 217,  19, 142,  73,
     85,  22, 255,  59, 244, 164, 178,   6, 160, 167, 251,  27, 110,  60,  51, 205,
     24,  94, 106, 213, 166,  33, 222, 254,  42,  28, 243,  10,  26,  25,  39,  45
  ]);

  // C-boxes are now loaded from shark-cboxes.js
  // CBOX_ENC and CBOX_DEC contain precomputed S-box + MDS transform tables
  // Each C-box has 8 arrays of 256 entries, where each entry is [high32, low32]

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * SharkAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class SharkAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SHARK";
      this.description = "SHARK is a 64-bit block cipher using S-box and MDS matrix transformations over GF(2^8). Designed in 1996, it features variable rounds (default 6) with a 128-bit key and incorporates provable security against differential and linear cryptanalysis through its maximum distance separable (MDS) matrix design.";
      this.inventor = "Vincent Rijmen, Joan Daemen, Bart Preneel, Anton Bosselaers, Erik De Win";
      this.year = 1996;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL; // Historical cipher, limited analysis
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)]; // 128-bit key only
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)]; // 64-bit block only

      this.documentation = [
        new LinkItem("SHARK Specification", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/shark.zip"),
        new LinkItem("Crypto++ Implementation", "https://www.cryptopp.com/wiki/SHARK"),
        new LinkItem("Rijndael Predecessors", "https://en.wikipedia.org/wiki/Advanced_Encryption_Standard#Development")
      ];

      this.references = [
        new LinkItem("COSIC Research Group", "https://www.esat.kuleuven.be/cosic/"),
        new LinkItem("Block Cipher Design Principles", "https://csrc.nist.gov/publications/detail/sp/800-38a/final"),
        new LinkItem("MDS Matrix Theory", "https://en.wikipedia.org/wiki/MDS_matrix")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Limited Rounds", "With only 6 rounds by default, SHARK has less security margin than modern ciphers like AES which uses 10-14 rounds."),
        new Vulnerability("Small Block Size", "64-bit blocks are vulnerable to birthday attacks after processing 2^32 blocks (~32GB)."),
        new Vulnerability("Historical Design", "SHARK predates AES and has received less cryptanalysis than modern standards.")
      ];

      // Test vectors from Crypto++ TestData/sharkval.dat
      this.tests = [
        {
          text: "Crypto++ Test Vector #1 (Zero Key/Plaintext)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/sharkval.dat",
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("214BCF4E7716420A")
        },
        {
          text: "Crypto++ Test Vector #2 (Sequential Key)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/sharkval.dat",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("C76C696289898137")
        },
        {
          text: "Crypto++ Test Vector #3 (Round-trip)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/sharkval.dat",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("C76C696289898137"),
          expected: OpCodes.Hex8ToBytes("077A4A59FAEEEA4D")
        },
        {
          text: "Crypto++ Test Vector #4",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/sharkval.dat",
          key: OpCodes.Hex8ToBytes("915F4619BE41B2516355A50110A9CE91"),
          input: OpCodes.Hex8ToBytes("21A5DBEE154B8F6D"),
          expected: OpCodes.Hex8ToBytes("6FF33B98F448E95A")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SharkInstance(this, isInverse);
    }
  }

  /**
 * Shark cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SharkInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._rounds = 6; // Default rounds
      this.roundKeys = null; // Array of 64-bit words (as 2-element [high, low] arrays)
    }

    /**
     * Set encryption/decryption key
     * @param {Array} keyBytes - 16-byte (128-bit) key
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (SHARK requires 16 bytes)`);
      }

      this._key = [...keyBytes];
      this._keySetup();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * Set number of rounds (2 minimum, 6 default)
     * @param {number} rounds - Number of rounds
     */
    setRounds(rounds) {
      if (rounds < 2) {
        throw new Error("SHARK requires at least 2 rounds");
      }
      this._rounds = rounds;
      if (this._key) {
        this._keySetup(); // Regenerate round keys
      }
    }

    /**
     * Pack 8 bytes into a 64-bit word (big-endian)
     * Returns [high32, low32]
     */
    _pack64BE(bytes, offset) {
      const high = OpCodes.Pack32BE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
      const low = OpCodes.Pack32BE(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
      return [high, low];
    }

    /**
     * Unpack 64-bit word to 8 bytes (big-endian)
     */
    _unpack64BE(word64) {
      const highBytes = OpCodes.Unpack32BE(word64[0]);
      const lowBytes = OpCodes.Unpack32BE(word64[1]);
      return [...highBytes, ...lowBytes];
    }

    /**
     * Get byte from 64-bit word at position (0 = MSB)
     */
    _getByte(word64, pos) {
      if (pos < 4) {
        return OpCodes.Shr32(word64[0], (3 - pos) * 8)&0xFF;
      } else {
        return OpCodes.Shr32(word64[1], (7 - pos) * 8)&0xFF;
      }
    }

    /**
     * Generate round keys using CFB-based key schedule
     * Based on Crypto++ implementation in shark.cpp
     */
    _keySetup() {
      // Fixed initialization keys for CFB (from cbox[0][0..6])
      // These are the first 7 entries of SHARK::Enc::cbox[0]
      const initKeysRaw = [
        [0x060d838f, 0x16f3a365], // cbox[0][0]
        [0xa68857ee, 0x5cae56f6], // cbox[0][1]
        [0xebf51635, 0x3c2c4d89], // cbox[0][2]
        [0x652174be, 0x88e85bdc], // cbox[0][3]
        [0x0d4e9a80, 0x86c17921], // cbox[0][4]
        [0x27ba7d33, 0xcffa58a1], // cbox[0][5]
        [0x88d9e104, 0xa237b530]  // cbox[0][6]
      ];

      const initKeys = [...initKeysRaw];
      // Transform the last round key as per Crypto++ InitForKeySetup()
      initKeys[6] = this._sharkTransformWord(initKeysRaw[6]);

      // Step 1: Concatenate key enough times to fill round key buffer
      const keyBuffer = new Array((this._rounds + 1) * 8);
      for (let i = 0; i < keyBuffer.length; i++) {
        keyBuffer[i] = this._key[i % this._key.length];
      }

      // Step 2: Apply CFB encryption to the key buffer
      // CFB: C[i] = P[i] XOR E(IV or C[i-1])
      let feedback = [0, 0]; // IV = 0

      for (let block = 0; block < this._rounds + 1; block++) {
        const offset = block * 8;

        // Encrypt feedback using SHARK with init keys (6 rounds)
        const encrypted = this._sharkEncryptBlock(feedback, initKeys, 6);

        // XOR with plaintext (key material)
        const plain = this._pack64BE(keyBuffer, offset);
        const cipher = [plain[0]^encrypted[0], plain[1]^encrypted[1]];

        // Store back to key buffer and use as next feedback
        const cipherBytes = this._unpack64BE(cipher);
        for (let i = 0; i < 8; i++) {
          keyBuffer[offset + i] = cipherBytes[i];
        }
        feedback = cipher;
      }

      // Step 3: Convert to 64-bit words (big-endian) and store as round keys
      this.roundKeys = [];
      for (let i = 0; i <= this._rounds; i++) {
        const word = this._pack64BE(keyBuffer, i * 8);
        this.roundKeys.push(word);
      }

      // Step 4: Transform the last round key
      this.roundKeys[this._rounds] = this._sharkTransformWord(this.roundKeys[this._rounds]);

      // Step 5: For decryption, modify round keys
      if (this.isInverse) {
        // Reverse the order of round keys
        const temp = [];
        for (let i = 0; i <= this._rounds; i++) {
          temp.push(this.roundKeys[this._rounds - i]);
        }
        this.roundKeys = temp;

        // Transform middle round keys (not first and last)
        for (let i = 1; i < this._rounds; i++) {
          this.roundKeys[i] = this._sharkTransformWord(this.roundKeys[i]);
        }
      }
    }

    /**
     * GF(2^8) multiplication using polynomial 0xf5
     * @param {number} a - First operand
     * @param {number} b - Second operand
     * @returns {number} Product in GF(2^8)
     */
    _gf256Multiply(a, b) {
      let result = 0;
      let temp = a;

      for (let i = 0; i < 8; ++i) {
        if ((b&1) !== 0) {
          result = OpCodes.Xor32(result, temp);
        }

        const carry = temp&0x80;
        temp = OpCodes.ToByte(OpCodes.Shl8(temp, 1));

        if (carry !== 0) {
          temp = OpCodes.Xor32(temp, 0xf5); // Irreducible polynomial
        }

        b = OpCodes.Shr8(b, 1);
      }

      return OpCodes.ToByte(result);
    }

    /**
     * SHARK Transform - MDS matrix multiplication over GF(2^8)
     * Operates on 64-bit word, returns transformed 64-bit word
     * @param {Array} word64 - [high32, low32]
     * @returns {Array} Transformed [high32, low32]
     */
    _sharkTransformWord(word64) {
      // Inverse of matrix G (iG) from SHARK specification
      const iG = [
        [0xe7, 0x30, 0x90, 0x85, 0xd0, 0x4b, 0x91, 0x41],
        [0x53, 0x95, 0x9b, 0xa5, 0x96, 0xbc, 0xa1, 0x68],
        [0x02, 0x45, 0xf7, 0x65, 0x5c, 0x1f, 0xb6, 0x52],
        [0xa2, 0xca, 0x22, 0x94, 0x44, 0x63, 0x2a, 0xa2],
        [0xfc, 0x67, 0x8e, 0x10, 0x29, 0x75, 0x85, 0x71],
        [0x24, 0x45, 0xa2, 0xcf, 0x2f, 0x22, 0xc1, 0x0e],
        [0xa1, 0xf1, 0x71, 0x40, 0x91, 0x27, 0x18, 0xa5],
        [0x56, 0xf4, 0xaf, 0x32, 0xd2, 0xa4, 0xdc, 0x71]
      ];

      // Extract bytes from word (big-endian)
      const inputBytes = new Array(8);
      for (let i = 0; i < 8; i++) {
        inputBytes[i] = this._getByte(word64, i);
      }

      // Matrix multiplication over GF(2^8)
      const resultBytes = new Array(8).fill(0);
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          resultBytes[i] ^= this._gf256Multiply(iG[i][j], inputBytes[j]);
        }
      }

      // Pack result back to 64-bit word
      return this._pack64BE(resultBytes, 0);
    }

    /**
     * Optimized SHARK round using C-boxes (combines S-box + Transform)
     * This is much faster than separate S-box and transform operations
     * @param {Array} word64 - Input [high32, low32]
     * @param {Array} cboxes - CBOX_ENC or CBOX_DEC
     * @returns {Array} Transformed [high32, low32]
     */
    _sharkRoundCBox(word64, cboxes) {
      // Extract 8 bytes from the 64-bit word
      const bytes = new Array(8);
      for (let i = 0; i < 8; i++) {
        bytes[i] = this._getByte(word64, i);
      }

      // XOR all 8 C-box lookups (each byte uses its corresponding C-box)
      let result = [0, 0];
      for (let i = 0; i < 8; i++) {
        const cboxEntry = cboxes[i][bytes[i]];
        result[0] ^= cboxEntry[0];
        result[1] ^= cboxEntry[1];
      }

      return result;
    }

    /**
     * Encrypt a single block using SHARK
     * @param {Array} input64 - Input as [high32, low32]
     * @param {Array} roundKeys - Array of round keys (64-bit words)
     * @param {number} numRounds - Number of rounds to use
     * @returns {Array} Encrypted [high32, low32]
     */
    _sharkEncryptBlock(input64, roundKeys, numRounds = null) {
      const rounds = numRounds !== null ? numRounds : this._rounds;

      // XOR with first round key
      let tmp = [input64[0]^roundKeys[0][0], input64[1]^roundKeys[0][1]];

      // Middle rounds (use C-boxes for optimized S-box + Transform)
      for (let round = 1; round < rounds; round++) {
        // C-box lookup combines S-box substitution and MDS transform
        tmp = this._sharkRoundCBox(tmp, CBOX_ENC);

        // XOR with round key
        tmp = [tmp[0]^roundKeys[round][0], tmp[1]^roundKeys[round][1]];
      }

      // Final round (S-box only, no transform)
      const finalBytes = new Array(8);
      for (let i = 0; i < 8; i++) {
        finalBytes[i] = SBOX_ENC[this._getByte(tmp, i)];
      }
      tmp = this._pack64BE(finalBytes, 0);

      // XOR with last round key
      tmp = [tmp[0]^roundKeys[rounds][0], tmp[1]^roundKeys[rounds][1]];

      return tmp;
    }

    /**
     * Decrypt a single block using SHARK
     * @param {Array} input64 - Input as [high32, low32]
     * @param {Array} roundKeys - Array of decryption round keys (already reversed/transformed)
     * @returns {Array} Decrypted [high32, low32]
     */
    _sharkDecryptBlock(input64, roundKeys) {
      // XOR with first round key (which is the last encryption round key)
      let tmp = [input64[0]^roundKeys[0][0], input64[1]^roundKeys[0][1]];

      // Middle rounds (use C-boxes for optimized inverse S-box + Transform)
      for (let round = 1; round < this._rounds; round++) {
        // C-box lookup combines inverse S-box substitution and MDS transform
        tmp = this._sharkRoundCBox(tmp, CBOX_DEC);

        // XOR with round key
        tmp = [tmp[0]^roundKeys[round][0], tmp[1]^roundKeys[round][1]];
      }

      // Final round (inverse S-box only, no transform)
      const finalBytes = new Array(8);
      for (let i = 0; i < 8; i++) {
        finalBytes[i] = SBOX_DEC[this._getByte(tmp, i)];
      }
      tmp = this._pack64BE(finalBytes, 0);

      // XOR with last round key (which is the first encryption round key)
      tmp = [tmp[0]^roundKeys[this._rounds][0], tmp[1]^roundKeys[this._rounds][1]];

      return tmp;
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

      if (this.inputBuffer.length % 8 !== 0) {
        throw new Error(`Invalid input length: ${this.inputBuffer.length} bytes (must be multiple of 8)`);
      }

      const output = [];

      // Process each 8-byte block
      for (let blockStart = 0; blockStart < this.inputBuffer.length; blockStart += 8) {
        // Pack block to 64-bit word
        const input64 = this._pack64BE(this.inputBuffer, blockStart);

        let result64;
        if (this.isInverse) {
          // Decryption
          result64 = this._sharkDecryptBlock(input64, this.roundKeys);
        } else {
          // Encryption
          result64 = this._sharkEncryptBlock(input64, this.roundKeys, null);
        }

        // Unpack result back to bytes
        const resultBytes = this._unpack64BE(result64);
        output.push(...resultBytes);
      }

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return output;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new SharkAlgorithm());

  // ===== EXPORTS =====

  return { SharkAlgorithm, SharkInstance };
}));
