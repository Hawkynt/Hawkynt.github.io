/*
 * FEAL-NX Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * FEAL-NX Algorithm by NTT (Akihiro Shimizu and Shoji Miyaguchi, 1990)
 * Block size: 64 bits, Key size: 128 bits, Configurable rounds (default: 32)
 * Uses Feistel network with extended key schedule for 128-bit keys
 *
 * NOTE: This is an educational implementation for learning purposes only.
 * FEAL-NX is cryptographically broken for N <= 31 rounds and should not be used for security.
 *
 * References:
 * - Miyaguchi, S. "The FEAL Cipher Family" (CRYPTO 1990)
 * - Handbook of Applied Cryptography, Chapter 7
 * - Biham and Shamir differential cryptanalysis showed weaknesses
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * FEALNXAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class FEALNXAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "FEAL-NX";
      this.description = "Fast Data Encipherment Algorithm NX variant by NTT with 128-bit keys. Educational implementation of a cryptographically broken Feistel cipher with variable rounds (default 32), 64-bit blocks and 128-bit keys.";
      this.inventor = "Akihiro Shimizu, Shoji Miyaguchi";
      this.year = 1990;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN; // Broken for N <= 31 rounds
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.JP;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit (16-byte) key
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0) // Fixed 64-bit (8-byte) blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("FEAL Cipher Family", "https://en.wikipedia.org/wiki/FEAL"),
        new LinkItem("The FEAL Cipher Family (CRYPTO 1990)", "https://link.springer.com/chapter/10.1007/BFb0083866"),
        new LinkItem("Handbook of Applied Cryptography Chapter 7", "http://koclab.cs.ucsb.edu/teaching/cs178/docx/d-chap07.pdf")
      ];

      this.references = [
        new LinkItem("Differential Cryptanalysis of FEAL", "https://link.springer.com/chapter/10.1007/3-540-46877-3_35"),
        new LinkItem("Linear Cryptanalysis of FEAL-8X", "https://link.springer.com/chapter/10.1007/978-3-319-13051-4_4")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new LinkItem("Differential Cryptanalysis", "https://en.wikipedia.org/wiki/Differential_cryptanalysis",
                     "FEAL-NX can be broken with differential cryptanalysis for N <= 31 rounds. Requires N > 31 for security against known attacks.")
      ];

      // Test vectors from official GitHub reference implementation
      // Source: https://github.com/zilijonas/FEAL-NX/blob/master/test-vectors.txt
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("0000000100020003"), // input
          OpCodes.Hex8ToBytes("0309E94066035E24"), // expected
          "FEAL-NX test vector #1 (32 rounds)",
          "https://github.com/zilijonas/FEAL-NX/blob/master/test-vectors.txt"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("0001000200030004"), // input
          OpCodes.Hex8ToBytes("F158CBA2FBDB6747"), // expected
          "FEAL-NX test vector #2 (32 rounds)",
          "https://github.com/zilijonas/FEAL-NX/blob/master/test-vectors.txt"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("0002000300040005"), // input
          OpCodes.Hex8ToBytes("07A44B91188FB722"), // expected
          "FEAL-NX test vector #3 (32 rounds)",
          "https://github.com/zilijonas/FEAL-NX/blob/master/test-vectors.txt"
        )
      ];

      // Set key for all test vectors (128-bit key from test vectors file)
      const testKey = OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F");
      for (let i = 0; i < this.tests.length; i++) {
        this.tests[i].key = testKey;
        this.tests[i].rounds = 32; // Default secure round count
      }
    }

    // Required: Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new FEALNXInstance(this, isInverse);
    }

  }

  // Instance class - handles the actual encryption/decryption
  /**
 * FEALNX cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FEALNXInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8; // 64-bit blocks
      this.KeySize = 0;   // will be set when key is assigned
      this._rounds = 32;  // Default to secure 32 rounds
    }

    // Property setter for rounds
    set rounds(numRounds) {
      if (numRounds < 4) {
        throw new Error(`Invalid rounds: ${numRounds} (minimum 4 rounds required)`);
      }
      this._rounds = numRounds;

      // Regenerate round keys if key is already set
      if (this._key) {
        this.roundKeys = this._generateRoundKeys(this._key, this._rounds);
      }
    }

    get rounds() {
      return this._rounds;
    }

    // Property setter for key - validates and sets up key schedule
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16 bytes)`);
      }

      this._key = [...keyBytes]; // Copy the key
      this.KeySize = keyBytes.length;
      this.roundKeys = this._generateRoundKeys(keyBytes, this._rounds);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    // Feed data to the cipher (accumulates until we have complete blocks)
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      // Add data to input buffer
      this.inputBuffer.push(...data);
    }

    // Get the result of the transformation
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Process complete blocks
      const output = [];
      const blockSize = this.BlockSize;

      // Validate input length for block cipher
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes`);
      }

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // FEAL S-box functions (same as FEAL-8)
    _S0(a, b) {
      return OpCodes.RotL8((a + b) & 0xFF, 2);
    }

    _S1(a, b) {
      return OpCodes.RotL8((a + b + 1) & 0xFF, 2);
    }

    // FEAL F-function - takes 4 bytes data and 2 bytes key
    _F(data, key) {
      // data is 4 bytes [a[0], a[1], a[2], a[3]]
      // key is 2 bytes [b[0], b[1]]
      const a = data;
      const b = key;

      // FEAL F-function as per specification
      const ret = [0, 0, 0, 0];
      const T = a[3] ^ a[2] ^ b[1];
      ret[1] = this._S1(a[0] ^ a[1] ^ b[0], T);
      ret[0] = this._S0(a[0], ret[1]);
      ret[2] = this._S0(T, ret[1]);
      ret[3] = this._S1(ret[2], a[3]);

      return ret;
    }

    // FEAL Fk function for key schedule - takes 4 bytes a and 4 bytes b
    _Fk(a, b) {
      // a and b are 4-byte arrays
      const ret = [0, 0, 0, 0];

      // FEAL Fk function as per specification
      ret[1] = this._S1(a[0] ^ a[1], b[0] ^ a[2] ^ a[3]);
      ret[0] = this._S0(a[0], b[2] ^ ret[1]);
      ret[2] = this._S0(a[2] ^ a[3], b[1] ^ this._S1(a[0] ^ a[1], b[0] ^ a[2] ^ a[3]));
      ret[3] = this._S1(a[3], b[3] ^ ret[2]);

      return ret;
    }

    // Generate round keys for FEAL-NX (128-bit key schedule)
    // Returns byte array of subkeys: 2*(numberOfRounds+4) bytes
    _generateRoundKeys(keyBytes, numRounds) {
      // Total subkeys needed: 2*(numberOfRounds+4) bytes
      const subKeys = new Array(2 * (numRounds + 4));
      for (let i = 0; i < subKeys.length; i++) {
        subKeys[i] = 0;
      }

      // Split key into components
      let ACurrent = keyBytes.slice(0, 4);   // KL
      let BCurrent = keyBytes.slice(4, 8);   // KR
      const KR1 = keyBytes.slice(8, 12);
      const KR2 = keyBytes.slice(12, 16);
      const KRX = OpCodes.XorArrays(KR1, KR2);

      let XORTemp = [0, 0, 0, 0];

      // Core loop - generate subkeys
      const numIterations = Math.floor(numRounds / 2) + 4;
      for (let i = 0; i < numIterations; i++) {
        // Compute XOR based on position (i % 3)
        let XORResult;
        if (i % 3 === 0) {
          XORResult = OpCodes.XorArrays(BCurrent, KRX);
        } else if (i % 3 === 1) {
          XORResult = OpCodes.XorArrays(BCurrent, KR1);
        } else { // i % 3 === 2
          XORResult = OpCodes.XorArrays(BCurrent, KR2);
        }

        // XOR with previous temp if not first iteration
        if (i > 0) {
          XORResult = OpCodes.XorArrays(XORResult, XORTemp);
        }

        // Save current A before transformation
        XORTemp = ACurrent.slice(0, 4);

        // Apply Fk transformation
        ACurrent = this._Fk(ACurrent, XORResult);

        // Store subkeys (2 bytes at a time from ACurrent)
        subKeys[4 * i] = ACurrent[0];
        subKeys[4 * i + 1] = ACurrent[1];
        subKeys[4 * i + 2] = ACurrent[2];
        subKeys[4 * i + 3] = ACurrent[3];

        // Swap A and B
        const temp = ACurrent;
        ACurrent = BCurrent;
        BCurrent = temp;
      }

      return subKeys;
    }

    // Encrypt 8-byte block
    _encryptBlock(block) {
      const N = this._rounds;
      const subkeys = this.roundKeys;

      // First XOR (pre-whitening)
      const FirstXOR = subkeys.slice(2 * N, 2 * N + 8);
      let PlainText = OpCodes.XorArrays(block, FirstXOR);

      // Split into left and right halves
      let LCurrent = PlainText.slice(0, 4);
      let RCurrent = PlainText.slice(4, 8);

      // Initial XOR
      RCurrent = OpCodes.XorArrays(LCurrent, RCurrent);

      // Core loop - N rounds
      for (let i = 0; i < N; i++) {
        const subkey = subkeys.slice(2 * i, 2 * i + 2);
        const fResult = this._F(RCurrent, subkey);
        LCurrent = OpCodes.XorArrays(LCurrent, fResult);

        // Swap L and R
        const temp = LCurrent;
        LCurrent = RCurrent;
        RCurrent = temp;
      }

      // Last XOR
      const LastXOR = subkeys.slice(2 * N + 8, 2 * N + 16);
      LCurrent = OpCodes.XorArrays(LCurrent, RCurrent);

      // Notice that LCurrent and RCurrent switch positions
      const CipherText = RCurrent.concat(LCurrent);
      return OpCodes.XorArrays(LastXOR, CipherText);
    }

    // Decrypt 8-byte block
    _decryptBlock(block) {
      const N = this._rounds;
      const subkeys = this.roundKeys;

      // First XOR (reverse of last XOR in encryption)
      const FirstXOR = subkeys.slice(2 * N + 8, 2 * N + 16);
      let CipherText = OpCodes.XorArrays(block, FirstXOR);

      // Notice that LCurrent is the right half of CipherText, and RCurrent is the left half
      let LCurrent = CipherText.slice(4, 8);
      let RCurrent = CipherText.slice(0, 4);

      // Initial XOR for decryption
      LCurrent = OpCodes.XorArrays(LCurrent, RCurrent);

      // Core loop - N rounds in reverse
      for (let i = N - 1; i >= 0; i--) {
        // Swap L and R FIRST
        const temp = LCurrent;
        LCurrent = RCurrent;
        RCurrent = temp;

        // Then apply F function
        const subkey = subkeys.slice(2 * i, 2 * i + 2);
        const fResult = this._F(RCurrent, subkey);
        LCurrent = OpCodes.XorArrays(LCurrent, fResult);
      }

      // Last XOR (reverse of first XOR in encryption)
      const LastXOR = subkeys.slice(2 * N, 2 * N + 8);
      RCurrent = OpCodes.XorArrays(LCurrent, RCurrent);
      const PlainText = LCurrent.concat(RCurrent);
      return OpCodes.XorArrays(PlainText, LastXOR);
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

  const algorithmInstance = new FEALNXAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FEALNXAlgorithm, FEALNXInstance };
}));
