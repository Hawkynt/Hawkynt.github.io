/*
 * FrodoKEM Implementation
 * Learning With Errors Key Encapsulation Mechanism
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
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
   * One FrodoKEM parameter set.
   */
  class FrodoParams {
    /**
     * @param {string} name - Reference implementation name
     * @param {int32} n - Lattice dimension
     * @param {int32} D - Modulus exponent (q = 2^D)
     * @param {int32} B - Bits encoded per matrix entry
     * @param {uint16[]} cdfTable - Error distribution CDF
     * @param {int32} nbar - Matrix width
     * @param {int32} keySize - Shared secret length in bytes
     */
    constructor(name, n, D, B, cdfTable, nbar, keySize) {
      /** @type {string} */
      this.name = name;
      /** @type {int32} */
      this.n = n;
      /** @type {int32} */
      this.D = D;
      /** @type {int32} */
      this.B = B;
      /** @type {uint16[]} */
      this.cdf_table = cdfTable;
      /** @type {int32} */
      this.nbar = nbar;
      /** @type {int32} */
      this.keySize = keySize;
    }
  }

  // FrodoKEM Parameter Sets (based on NIST PQC standards), named by
  // FRODO_PARAM_NAMES in the same order
  /** @type {string[]} */
  const FRODO_PARAM_NAMES = ['FrodoKEM-640', 'FrodoKEM-976', 'FrodoKEM-1344'];
  /** @type {uint16[]} */
  const FRODO_CDF_640 = [4643, 13363, 20579, 25843, 29227, 31145, 32103, 32525, 32689, 32745, 32762, 32766, 32767];
  /** @type {uint16[]} */
  const FRODO_CDF_976 = [5638, 15915, 23689, 28571, 31116, 32217, 32613, 32731, 32760, 32766, 32767];
  /** @type {uint16[]} */
  const FRODO_CDF_1344 = [9142, 23462, 30338, 32361, 32725, 32765, 32767];
  /** @type {FrodoParams[]} */
  const FRODO_PARAM_SETS = [
    new FrodoParams('frodokem640aes', 640, 15, 2, FRODO_CDF_640, 8, 32),
    new FrodoParams('frodokem976aes', 976, 16, 3, FRODO_CDF_976, 8, 32),
    new FrodoParams('frodokem1344aes', 1344, 16, 4, FRODO_CDF_1344, 8, 32)
  ];

  /**
   * The parameter set of that name, or null.
   * @param {string} paramName - Name such as 'FrodoKEM-640'
   * @returns {FrodoParams|null} The parameter set
   */
  function findParams(paramName) {
    const index = FRODO_PARAM_NAMES.indexOf(paramName);
    return index < 0 ? null : FRODO_PARAM_SETS[index];
  }

  /**
   * An educational FrodoKEM public key.
   */
  class FrodoPublicKey {
    /**
     * @param {int32[][]} matrix - Public matrix
     * @param {int32} keySize - Lattice dimension
     * @param {string} keyId - Key label
     */
    constructor(matrix, keySize, keyId) {
      /** @type {int32[][]} */
      this.matrix = matrix;
      /** @type {int32} */
      this.keySize = keySize;
      /** @type {string} */
      this.keyId = keyId;
    }
  }

  /**
   * An educational FrodoKEM private key.
   */
  class FrodoPrivateKey {
    /**
     * @param {int32[][]} secret - Secret matrix
     * @param {int32} keySize - Lattice dimension
     * @param {string} keyId - Key label
     */
    constructor(secret, keySize, keyId) {
      /** @type {int32[][]} */
      this.secret = secret;
      /** @type {int32} */
      this.keySize = keySize;
      /** @type {string} */
      this.keyId = keyId;
    }
  }

  /**
   * A generated key pair.
   */
  class FrodoKeyPair {
    /**
     * @param {FrodoPublicKey} publicKey - Public half
     * @param {FrodoPrivateKey} privateKey - Private half
     */
    constructor(publicKey, privateKey) {
      /** @type {FrodoPublicKey} */
      this.publicKey = publicKey;
      /** @type {FrodoPrivateKey} */
      this.privateKey = privateKey;
    }
  }

  /**
   * Read a parameter set selector from the key bytes. Both spellings used
   * across this collection are accepted: decimal digits in ASCII, and a
   * big-endian 16-bit count. The ASCII form used to be read as a 16-bit
   * count, so "976" arrived as 0x3937 and quietly selected 640.
   * @param {uint8[]} keyData - Parameter set selector
   * @returns {int32} The lattice dimension n
   */
  function parseParameterSet(keyData) {
    if (keyData) {
      /** @type {uint8[]} */
      const bytes = keyData;
      let digits = '';
      let allDigits = bytes.length > 0;
      for (let i = 0; i < bytes.length; ++i) {
        if (bytes[i] < 0x30 || bytes[i] > 0x39) {
          allDigits = false;
          break;
        }
        digits += String.fromCharCode(bytes[i]);
      }

      if (allDigits) {
        /** @type {int32} */
        const size = parseInt(digits, 10);
        return size;
      }

      if (bytes.length >= 2) {
        return OpCodes.Pack16BE(bytes[0], bytes[1]);
      }
    }

    throw new Error('FrodoKEM: unrecognised parameter set selector');
  }

  class FrodoKEMCipher extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "FrodoKEM";
      this.description = "Learning With Errors Key Encapsulation Mechanism. Conservative lattice-based post-quantum cryptography using unstructured lattices and standard LWE assumption. Educational implementation of NIST PQC finalist.";
      this.inventor = "Joppe Bos, Craig Costello, Léo Ducas, Ilya Mironov, Michael Naehrig, Valeria Nikolaenko, Ananth Raghunathan, Douglas Stebila";
      this.year = 2016;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "LWE-Based Post-Quantum KEM";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(640, 640, 0), // FrodoKEM-640
        new KeySize(976, 976, 0), // FrodoKEM-976
        new KeySize(1344, 1344, 0)  // FrodoKEM-1344
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("FrodoKEM Official Site", "https://frodokem.org/"),
        new LinkItem("NIST PQC Round 3 FrodoKEM", "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/FrodoKEM-Round3.zip"),
        new LinkItem("Learning With Errors Problem", "https://en.wikipedia.org/wiki/Learning_with_errors"),
        new LinkItem("Lattice-Based Cryptography", "https://en.wikipedia.org/wiki/Lattice-based_cryptography")
      ];

      this.references = [
        new LinkItem("FrodoKEM Reference Implementation", "https://github.com/Microsoft/FrodoKEM"),
        new LinkItem("Standard LWE Paper", "https://eprint.iacr.org/2016/659"),
        new LinkItem("NIST PQC Competition", "https://csrc.nist.gov/projects/post-quantum-cryptography"),
        new LinkItem("Regev's LWE", "https://cims.nyu.edu/~regev/papers/lwesurvey.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Lattice Reduction", "Vulnerable to lattice reduction attacks if LWE parameters are insufficient. Use conservative parameters with sufficient noise and dimension."),
        new Vulnerability("Timing Attacks", "Variable-time operations can leak information about secret keys. Implement constant-time operations and protect against side-channels.")
      ];

      // The ciphertext this file produces is not FrodoKEM's. The scheme here
      // is the educational stand-in its security status advertises - a key
      // stream derived from a deterministic matrix - so the published KAT
      // files of the NIST submission say nothing about it and there is no
      // expected ciphertext anywhere that it could be measured against.
      //
      // What the vectors below do pin is the property that is actually being
      // claimed: that each of the three declared parameter sets is selected by
      // its own name and recovers what it encrypted. The expected value is the
      // input, which is how this collection writes a round-trip vector; the
      // engine runs the reverse instance and compares.
      //
      // Two vectors used to carry a ciphertext under a NIST citation. Nothing
      // in that submission published those bytes - they can only have come
      // from running this file - and the parameter set selector was read as a
      // 16-bit count, so the one labelled 976 was running 640 as well.
      const FRODO_SPEC = "https://frodokem.org/files/FrodoKEM-specification-20210604.pdf";

      this.tests = [
        {
          text: "FrodoKEM-640 round-trip under the parameter set named 640",
          uri: FRODO_SPEC,
          input: OpCodes.Hex8ToBytes("01020304050607080910111213141516"),
          key: OpCodes.AnsiToBytes("640"),
          expected: OpCodes.Hex8ToBytes("01020304050607080910111213141516")
        },
        {
          text: "FrodoKEM-976 round-trip under the parameter set named 976",
          uri: FRODO_SPEC,
          input: OpCodes.Hex8ToBytes("deadbeefcafebabe0123456789abcdef"),
          key: OpCodes.AnsiToBytes("976"),
          expected: OpCodes.Hex8ToBytes("deadbeefcafebabe0123456789abcdef")
        },
        {
          text: "FrodoKEM-1344 round-trip under the parameter set named 1344",
          uri: FRODO_SPEC,
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.AnsiToBytes("1344"),
          expected: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new FrodoKEMInstance(this, isInverse);
    }
  }

  /**
 * FrodoKEM cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FrodoKEMInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {FrodoKEMCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {FrodoParams|null} */
      this.currentParams = null;
      /** @type {int32} */
      this.currentN = 640;
      /** @type {FrodoPublicKey|null} */
      this._publicKey = null;
      /** @type {FrodoPrivateKey|null} */
      this._privateKey = null;
      /** @type {uint8[]|null} */
      this._keyData = null; // Initialize to null so UI condition passes
    }

    // Property setter for key (for test suite compatibility)
    /**
     * @param {uint8[]} keyData - Parameter set selector (see parseParameterSet)
     */
    set key(keyData) {
      this.KeySetup(keyData);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._keyData;
    }

    // Property setters/getters for UI compatibility
    /**
     * @param {FrodoPublicKey|null} keyData - Public key
     */
    set publicKey(keyData) {
      if (keyData) {
        this._publicKey = keyData;
      } else {
        this._publicKey = null;
      }
    }

    /**
     * @returns {FrodoPublicKey|null} Current public key
     */
    get publicKey() {
      return this._publicKey;
    }

    /**
     * @param {FrodoPrivateKey|null} keyData - Private key
     */
    set privateKey(keyData) {
      if (keyData) {
        this._privateKey = keyData;
      } else {
        this._privateKey = null;
      }
    }

    /**
     * @returns {FrodoPrivateKey|null} Current private key
     */
    get privateKey() {
      return this._privateKey;
    }

    // Initialize FrodoKEM with specified parameter set
    /**
     * @param {int32} n - Lattice dimension selecting the parameter set
     * @returns {boolean} True once the set is accepted
     */
    Init(n) {
      // An unrecognised n used to fall back to FrodoKEM-640 in silence, which
      // meant a caller asking for 976 or 1344 was handed 640 and had no way to
      // tell. The three sets differ in the key stream they derive, so the
      // wrong one is not a detail.
      const paramName = 'FrodoKEM-' + n;

      if (!findParams(paramName)) {
        throw new Error('Invalid FrodoKEM parameter set. Use 640, 976, or 1344.');
      }

      this.currentParams = findParams(paramName);
      this.currentN = n;

      return true;
    }

    // Feed data for processing
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (Array.isArray(data)) {
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      } else if (typeof data === 'string') {
        this.inputBuffer.push(...OpCodes.AnsiToBytes(data));
      } else {
        this.inputBuffer.push(data);
      }
    }

    // Get result (encryption/decryption)
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        /** @type {uint8[]} */
        const none = [];
        return none;
      }

      try {
        /** @type {uint8[]} */
        let result;
        if (this.isInverse) {
          // Decrypt
          result = this._decrypt(this.inputBuffer);
        } else {
          // Encrypt  
          result = this._encrypt(this.inputBuffer);
        }

        return result;
      } finally {
        this.inputBuffer = [];
      }
    }

    // Educational encryption (simplified FrodoKEM-like)
    /**
     * @param {uint8[]} message - Message bytes
     * @returns {uint8[]} Length header followed by the masked message
     */
    _encrypt(message) {
      if (!this._publicKey) {
        const keyPair = this._generateEducationalKeys();
        this._publicKey = keyPair.publicKey;
        this._privateKey = keyPair.privateKey;
      }

      // Simple educational encryption: XOR with deterministic key stream
      const keyStream = this._generateKeyStream(message.length);
      /** @type {uint8[]} */
      const encrypted = new Array(message.length + 4); // Add header for decryption

      // Store original length in first 4 bytes (little-endian) using OpCodes
      const lengthBytes = OpCodes.Unpack32LE(message.length);
      encrypted[0] = lengthBytes[0];
      encrypted[1] = lengthBytes[1];
      encrypted[2] = lengthBytes[2];
      encrypted[3] = lengthBytes[3];

      // Encrypt message using OpCodes XOR
      /** @type {uint8[]} */
      const messageArray = [...message];
      const encryptedMessage = OpCodes.XorArrays(messageArray, keyStream.slice(0, message.length));
      for (let i = 0; i < encryptedMessage.length; i++) {
        encrypted[i + 4] = encryptedMessage[i];
      }

      return encrypted;
    }

    // Educational decryption (simplified FrodoKEM-like)
    /**
     * @param {uint8[]} data - Length header followed by the masked message
     * @returns {uint8[]} Recovered message
     */
    _decrypt(data) {
      if (!this._privateKey) {
        throw new Error('FrodoKEM private key not set. Generate keys first.');
      }

      if (data.length < 4) {
        throw new Error('Invalid ciphertext: too short');
      }

      // Extract original length from header using OpCodes
      const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);

      if (data.length !== OpCodes.Add32(originalLength, 4)) {
        throw new Error('Invalid ciphertext: length mismatch');
      }

      // Generate same key stream for decryption
      const keyStream = this._generateKeyStream(originalLength);
      /** @type {uint8[]} */
      const decrypted = new Array(originalLength);

      // Decrypt message using OpCodes XOR
      const cipherArray = data.slice(4, OpCodes.Add32(4, originalLength));
      const decryptedArray = OpCodes.XorArrays(cipherArray, keyStream.slice(0, originalLength));
      for (let i = 0; i < originalLength; i++) {
        decrypted[i] = decryptedArray[i];
      }

      return decrypted;
    }

    // Generate educational keys (not cryptographically secure)
    /**
     * @returns {FrodoKeyPair} Deterministic demonstration key pair
     */
    _generateEducationalKeys() {
      const keyId = 'FRODOKEM_' + this.currentN + '_EDUCATIONAL';

      const publicKey = new FrodoPublicKey(this._generateDeterministicMatrix(), this.currentN, keyId);

      const privateKey = new FrodoPrivateKey(this._generateDeterministicMatrix(), this.currentN, keyId);

      return new FrodoKeyPair(publicKey, privateKey);
    }

    // Generate deterministic matrix for educational purposes
    /**
     * @returns {int32[][]} Matrix of (i * j + n) mod 65536, at most 16 x 16
     */
    _generateDeterministicMatrix() {
      const size = Math.min(this.currentN, 16); // Keep small for educational purposes
      /** @type {int32[][]} */
      const matrix = new Array(size);
      for (let i = 0; i < size; i++) {
        /** @type {int32[]} */
        const row = new Array(size);
        matrix[i] = row;
        for (let j = 0; j < size; j++) {
          matrix[i][j] = (i * j + this.currentN) % 65536;
        }
      }
      return matrix;
    }

    // Generate deterministic key stream for educational encryption
    /**
     * @param {int32} length - Number of key stream bytes
     * @returns {uint8[]} Key stream
     */
    _generateKeyStream(length) {
      if (!this._publicKey || !this._publicKey.matrix) {
        throw new Error('Public key matrix not available');
      }

      /** @type {uint8[]} */
      const keyStream = new Array(length);
      const matrixSize = this._publicKey.matrix.length;

      for (let i = 0; i < length; i++) {
        // Generate pseudo-random byte from matrix elements
        const row = i % matrixSize;
        const col = (i + this.currentN) % matrixSize;
        const matrixValue = this._publicKey.matrix[row][col];

        // Mix with parameter-specific values for better distribution using OpCodes
        const mixed = OpCodes.And32(matrixValue + i + this.currentN + row * col, 0xFFFF);
        const highByte = OpCodes.Unpack16BE(mixed)[0]; // Get high byte
        const lowByte = OpCodes.Unpack16BE(mixed)[1];  // Get low byte
        keyStream[i] = OpCodes.Xor8(lowByte, highByte);
      }

      return keyStream;
    }

    // Set up keys
    /**
     * @param {uint8[]} keyData - Parameter set selector (see parseParameterSet)
     */
    KeySetup(keyData) {
      this._keyData = keyData;

      this.Init(parseParameterSet(keyData));

      // Generate educational keys
      const keyPair = this._generateEducationalKeys();
      this._publicKey = keyPair.publicKey;
      this._privateKey = keyPair.privateKey;
    }

    // Clear sensitive data
    ClearData() {
      if (this._privateKey) {
        if (this._privateKey.secret) {
          this._privateKey.secret.forEach(row => OpCodes.ClearArray(row));
        }
        this._privateKey = null;
      }
      if (this._publicKey) {
        if (this._publicKey.matrix) {
          this._publicKey.matrix.forEach(row => OpCodes.ClearArray(row));
        }
        this._publicKey = null;
      }
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new FrodoKEMCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FrodoKEMCipher, FrodoKEMInstance };
}));