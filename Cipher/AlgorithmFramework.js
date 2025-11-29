/* AlgorithmFramework.js
 * Browser + Worker + Node (CJS/AMD-friendly) UMD
 * (c)2006-2025 Hawkynt
*/
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    const mod = factory();
    module.exports = mod;
    // ESM compatibility
    module.exports.default = mod;
    // Also assign to global for algorithm files to access
    if (typeof global !== 'undefined') {
      global.AlgorithmFramework = mod;
    }
  } else {
    // Browser/Worker global
    root.AlgorithmFramework = factory();
  }
}(
  // Standard UMD root detection
  (function() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof window !== 'undefined') return window;
    if (typeof global !== 'undefined') return global;
    if (typeof self !== 'undefined') return self;
    throw new Error('Unable to locate global object');
  })(),
  function () {
    'use strict';
      
    //#region ===== ENUMS =====
    const CategoryType = Object.freeze({
      ASYMMETRIC: { 
        name: 'Asymmetric Ciphers', 
        color: '#dc3545', // Red
        icon: '🔐',
        description: 'Public-key cryptography algorithms' 
      },
      BLOCK: { 
        name: 'Block Ciphers', 
        color: '#007bff', // Blue
        icon: '🧱',
        description: 'Block-based symmetric encryption' 
      },
      STREAM: { 
        name: 'Stream Ciphers', 
        color: '#17a2b8', // Light blue
        icon: '🌊',
        description: 'Stream-based symmetric encryption' 
      },
      HASH: { 
        name: 'Hash Functions', 
        color: '#ffc107', // Yellow
        icon: '#️⃣',
        description: 'Cryptographic hash algorithms' 
      },
      CHECKSUM: { 
        name: 'Checksums', 
        color: '#20c997', // Teal
        icon: '✔️',
        description: 'Checksum and integrity verification algorithms' 
      },
      COMPRESSION: { 
        name: 'Compression Algorithms', 
        color: '#28a745', // Green
        icon: '🗜️',
        description: 'Data compression algorithms' 
      },
      ENCODING: { 
        name: 'Encoding Schemes', 
        color: '#6f42c1', // Violet
        icon: '📝',
        description: 'Data encoding and representation' 
      },
      CLASSICAL: { 
        name: 'Classical Ciphers', 
        color: '#fd7e14', // Orange
        icon: '📜',
        description: 'Historical and educational ciphers' 
      },
      MAC: { 
        name: 'Message Authentication', 
        color: '#e83e8c', // Pink
        icon: '✅',
        description: 'Message authentication codes' 
      },
      KDF: { 
        name: 'Key Derivation Functions', 
        color: '#343a40', // Dark gray
        icon: '🔑',
        description: 'Key derivation and stretching functions' 
      },
      ECC: { 
        name: 'Error Correction', 
        color: '#17a2b8', // Info blue
        icon: '🔧',
        description: 'Error correction codes' 
      },
      MODE: { 
        name: 'Cipher Modes', 
        color: '#495057', // Gray
        icon: '⚙️',
        description: 'Block cipher modes of operation' 
      },
      PADDING: { 
        name: 'Padding Schemes', 
        color: '#6c757d', // Gray
        icon: '📦',
        description: 'Data padding algorithms' 
      },
      AEAD: { 
        name: 'Authenticated Encryption', 
        color: '#dc3545', // Red variant
        icon: '🛡️',
        description: 'Authenticated encryption with associated data' 
      },
      SPECIAL: { 
        name: 'Special Algorithms', 
        color: '#6f42c1', // Purple
        icon: '✨',
        description: 'Special purpose algorithms' 
      },
      PQC: { 
        name: 'Post-Quantum Cryptography', 
        color: '#e83e8c', // Pink variant
        icon: '🔮',
        description: 'Quantum-resistant cryptographic algorithms' 
      },
      RANDOM: { 
        name: 'Random Number Generators', 
        color: '#6c757d', // Gray
        icon: '🎲',
        description: 'Pseudo-random number generators' 
      }
    });

    const SecurityStatus = Object.freeze({
      SECURE: { name: 'Secure', color: '#28a745', icon: '🛡️' },
      DEPRECATED: { name: 'Deprecated', color: '#ffc107', icon: '⚠️' },
      BROKEN: { name: 'Broken', color: '#dc3545', icon: '❌' },
      OBSOLETE: { name: 'Obsolete', color: '#6c757d', icon: '📰' },
      EXPERIMENTAL: { name: 'Experimental', color: '#17a2b8', icon: '🧪' },
      EDUCATIONAL: { name: 'Educational Only', color: '#fd7e14', icon: '🎓' }
    });

    const ComplexityType = Object.freeze({
      BEGINNER: { name: 'Beginner', color: '#28a745', level: 1 },
      INTERMEDIATE: { name: 'Intermediate', color: '#ffc107', level: 2 },
      ADVANCED: { name: 'Advanced', color: '#fd7e14', level: 3 },
      EXPERT: { name: 'Expert', color: '#dc3545', level: 4 },
      RESEARCH: { name: 'Research', color: '#6f42c1', level: 5 }
    });

    const CountryCode = Object.freeze({
      US: { icon: '🇺🇸', name: 'United States' },
      RU: { icon: '🇷🇺', name: 'Russia' },
      CN: { icon: '🇨🇳', name: 'China' },
      UA: { icon: '🇺🇦', name: 'Ukraine' },
      DE: { icon: '🇩🇪', name: 'Germany' },
      GB: { icon: '🇬🇧', name: 'United Kingdom' },
      FR: { icon: '🇫🇷', name: 'France' },
      JP: { icon: '🇯🇵', name: 'Japan' },
      KR: { icon: '🇰🇷', name: 'South Korea' },
      IL: { icon: '🇮🇱', name: 'Israel' },
      BE: { icon: '🇧🇪', name: 'Belgium' },
      CA: { icon: '🇨🇦', name: 'Canada' },
      AU: { icon: '🇦🇺', name: 'Australia' },
      IT: { icon: '🇮🇹', name: 'Italy' },
      NL: { icon: '🇳🇱', name: 'Netherlands' },
      CH: { icon: '🇨🇭', name: 'Switzerland' },
      SE: { icon: '🇸🇪', name: 'Sweden' },
      NO: { icon: '🇳🇴', name: 'Norway' },
      IN: { icon: '🇮🇳', name: 'India' },
      BR: { icon: '🇧🇷', name: 'Brazil' },
      INTL: { icon: '🌐', name: 'International' },
      ANCIENT: { icon: '🏛️', name: 'Ancient' },
      UNKNOWN: { icon: '❓', name: 'Unknown' }
    });
    //#endregion

    //#region ===== Core Classes =====

    /**
     * Link item with text description and URI
     */
    class LinkItem {
      /**
       * @param {string} text - Display text
       * @param {string} uri - URL reference
       */
      constructor(text, uri) {
        /** @type {string} */
        this.text = text
        /** @type {string} */
        this.uri = uri
      }
    }

    /**
     * Test case with input data and expected output
     */
    class TestCase extends LinkItem {
      /**
       * @param {byte[]} input - Input data bytes
       * @param {byte[]} expected - Expected output bytes
       * @param {string} description - Test description
       * @param {string} uri - Reference URI
       */
      constructor(input, expected, description = '', uri = '') {
        super(description, uri)
        /** @type {byte[]} */
        this.input = input
        /** @type {byte[]} */
        this.expected = expected
      }
    }

    /**
     * Known vulnerability information
     */
    class Vulnerability extends LinkItem {
      /**
       * @param {string} type - Vulnerability type
       * @param {string} mitigation - Mitigation strategy
       * @param {string} uri - Reference URI
       */
      constructor(type, mitigation, uri = '') {
        super(type, uri)
        /** @type {string} */
        this.mitigation = mitigation
      }
    }

    /**
     * Authentication result for AEAD operations
     */
    class AuthResult {
      /**
       * @param {bool} success - Whether authentication succeeded
       * @param {byte[]} output - Output data if successful
       * @param {string} failureReason - Reason for failure if unsuccessful
       */
      constructor(success, output = null, failureReason = null) {
        /** @type {bool} */
        this.Success = success
        /** @type {byte[]} */
        this.Output = output
        /** @type {string} */
        this.FailureReason = failureReason
      }
    }

    /**
     * Key size specification with min, max, and step
     */
    class KeySize {
      /**
       * @param {int} minSize - Minimum key size in bytes
       * @param {int} maxSize - Maximum key size in bytes
       * @param {int} stepSize - Step size between valid sizes
       */
      constructor(minSize, maxSize, stepSize = 1) {
        /** @type {int} */
        this.minSize = minSize
        /** @type {int} */
        this.maxSize = maxSize
        /** @type {int} */
        this.stepSize = stepSize
      }
    }
    //#endregion

    //#region ===== Base Interfaces =====

    /**
     * Base interface for all algorithm instances
     * Implements the Feed/Result pattern for streaming data processing
     */
    class IAlgorithmInstance {
      /**
       * @param {Algorithm} algorithm - The parent algorithm
       */
      constructor(algorithm) {
        /** @type {Algorithm} */
        this.algorithm = algorithm
        /** @type {bool} */
        this.isInverse = false
        /** @type {byte[]} */
        this.inputBuffer = []
      }

      /**
       * Feed data into the algorithm for processing
       * @param {byte[]} data - Input data bytes
       * @returns {void}
       */
      Feed(data) { throw 'Feed() not implemented' }

      /**
       * Get the processed result
       * @returns {byte[]} Output data bytes
       */
      Result() { throw 'Result() not implemented' }

      /**
       * Dispose of sensitive data
       * @returns {void}
       */
      Dispose() {
        if (this.inputBuffer) {
          this.inputBuffer.length = 0
        }
      }
    }

    /**
     * Base class for all cryptographic algorithms
     */
    class Algorithm {
      constructor() {
        /** @type {string} */
        this.name = null
        /** @type {string} */
        this.description = null
        /** @type {string} */
        this.inventor = null
        /** @type {int} */
        this.year = null
        /** @type {object} */
        this.category = null
        /** @type {string} */
        this.subCategory = null
        /** @type {object} */
        this.securityStatus = null
        /** @type {object} */
        this.complexity = null
        /** @type {object} */
        this.country = null
        /** @type {LinkItem[]} */
        this.documentation = []
        /** @type {LinkItem[]} */
        this.references = []
        /** @type {Vulnerability[]} */
        this.knownVulnerabilities = []
        /** @type {TestCase[]} */
        this.tests = []
      }

      /**
       * Create an instance of this algorithm
       * @param {bool} isInverse - True for decryption/decompression, false for encryption/compression
       * @returns {IAlgorithmInstance} Algorithm instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }
    //#endregion

    //#region ===== Family Placeholders =====

    /** @extends Algorithm */
    class CryptoAlgorithm extends Algorithm {}

    /** @extends CryptoAlgorithm */
    class SymmetricCipherAlgorithm extends CryptoAlgorithm {}

    /** @extends CryptoAlgorithm */
    class AsymmetricCipherAlgorithm extends CryptoAlgorithm {}

    /**
     * Base class for block cipher algorithms
     * @extends SymmetricCipherAlgorithm
     */
    class BlockCipherAlgorithm extends SymmetricCipherAlgorithm {
      constructor() {
        super()
        /** @type {KeySize[]} */
        this.SupportedKeySizes = []
        /** @type {KeySize[]} */
        this.SupportedBlockSizes = []
      }

      /**
       * Create an instance of this block cipher
       * @param {bool} isInverse - True for decryption, false for encryption
       * @returns {IBlockCipherInstance} Block cipher instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }

    /**
     * Base class for stream cipher algorithms
     * @extends SymmetricCipherAlgorithm
     */
    class StreamCipherAlgorithm extends SymmetricCipherAlgorithm {
      /**
       * Create an instance of this stream cipher
       * @param {bool} isInverse - True for decryption, false for encryption
       * @returns {IAlgorithmInstance} Stream cipher instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }

    /**
     * Base class for encoding algorithms
     * @extends Algorithm
     */
    class EncodingAlgorithm extends Algorithm {
      /**
       * Create an instance of this encoding algorithm
       * @param {bool} isInverse - True for decoding, false for encoding
       * @returns {IAlgorithmInstance} Encoding instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }

    /**
     * Base class for compression algorithms
     * @extends Algorithm
     */
    class CompressionAlgorithm extends Algorithm {
      /**
       * Create an instance of this compression algorithm
       * @param {bool} isInverse - True for decompression, false for compression
       * @returns {IAlgorithmInstance} Compression instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }

    /** @extends Algorithm */
    class ErrorCorrectionAlgorithm extends Algorithm {}

    /**
     * Base class for hash function algorithms
     * @extends Algorithm
     */
    class HashFunctionAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {KeySize[]} */
        this.SupportedOutputSizes = []
      }

      /**
       * Create an instance of this hash function
       * @param {bool} isInverse - Ignored for hash functions (always false)
       * @returns {IHashFunctionInstance} Hash function instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }

    /**
     * Base class for MAC algorithms
     * @extends Algorithm
     */
    class MacAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {KeySize[]} */
        this.SupportedMacSizes = []
        /** @type {bool} */
        this.NeedsKey = true
      }
    }

    /**
     * Base class for KDF algorithms
     * @extends Algorithm
     */
    class KdfAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {KeySize[]} */
        this.SupportedOutputSizes = []
        /** @type {bool} */
        this.SaltRequired = true
      }
    }

    /** @extends Algorithm */
    class PaddingAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {bool} */
        this.IsLengthIncluded = false
      }
    }

    /** @extends Algorithm */
    class CipherModeAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {bool} */
        this.RequiresIV = true
        /** @type {KeySize[]} */
        this.SupportedIVSizes = []
      }
    }

    /** @extends CryptoAlgorithm */
    class AeadAlgorithm extends CryptoAlgorithm {
      constructor() {
        super()
        /** @type {KeySize[]} */
        this.SupportedTagSizes = []
        /** @type {bool} */
        this.SupportsDetached = false
      }
    }

    /** @extends Algorithm */
    class RandomGenerationAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {bool} */
        this.IsDeterministic = false
        /** @type {bool} */
        this.IsCryptographicallySecure = true
        /** @type {KeySize[]} */
        this.SupportedSeedSizes = []
      }
    }
    //#endregion

    //#region ===== Instance Interface Extensions =====

    /**
     * Instance interface for block ciphers
     * @extends IAlgorithmInstance
     */
    class IBlockCipherInstance extends IAlgorithmInstance {
      /**
       * @param {BlockCipherAlgorithm} algorithm - Parent algorithm
       */
      constructor(algorithm) {
        super(algorithm)
        /** @type {int} - Block size in bytes */
        this.BlockSize = 0
        /** @type {int} - Key size in bytes */
        this.KeySize = 0
        /** @type {byte[]} - Encryption/decryption key */
        this._key = null
      }

      /**
       * Set the encryption/decryption key
       * @param {byte[]} keyBytes - Key bytes
       */
      set key(keyBytes) { this._key = keyBytes }

      /**
       * Get the current key
       * @returns {byte[]} Key bytes
       */
      get key() { return this._key }

      /**
       * Encrypt a single block
       * @param {byte[]} block - Input block
       * @returns {byte[]} Encrypted block
       */
      EncryptBlock(block) { throw 'EncryptBlock() not implemented' }

      /**
       * Decrypt a single block
       * @param {byte[]} block - Encrypted block
       * @returns {byte[]} Decrypted block
       */
      DecryptBlock(block) { throw 'DecryptBlock() not implemented' }
    }

    /**
     * Instance interface for hash functions
     * @extends IAlgorithmInstance
     */
    class IHashFunctionInstance extends IAlgorithmInstance {
      /**
       * @param {HashFunctionAlgorithm} algorithm - Parent algorithm
       */
      constructor(algorithm) {
        super(algorithm)
        /** @type {int} - Output hash size in bytes */
        this.OutputSize = 0
      }
    }

    /**
     * Instance interface for MAC algorithms
     * @extends IAlgorithmInstance
     */
    class IMacInstance extends IAlgorithmInstance {
      /**
       * Compute MAC over data
       * @param {byte[]} data - Input data
       * @returns {byte[]} MAC bytes
       */
      ComputeMac(data) { throw 'ComputeMac() not implemented' }
    }

    /**
     * Instance interface for KDF algorithms
     * @extends IAlgorithmInstance
     */
    class IKdfInstance extends IAlgorithmInstance {
      /**
       * @param {KdfAlgorithm} algorithm - Parent algorithm
       */
      constructor(algorithm) {
        super(algorithm)
        /** @type {int} - Output key size in bytes */
        this.OutputSize = 0
        /** @type {int} - Number of iterations */
        this.Iterations = 0
      }
    }

    /**
     * Instance interface for AEAD algorithms
     * @extends IAlgorithmInstance
     */
    class IAeadInstance extends IAlgorithmInstance {
      /**
       * @param {AeadAlgorithm} algorithm - Parent algorithm
       */
      constructor(algorithm) {
        super(algorithm)
        /** @type {byte[]} - Additional authenticated data */
        this.aad = []
        /** @type {int} - Authentication tag size in bytes */
        this.tagSize = 0
      }
    }

    /**
     * Instance interface for error correction algorithms
     * @extends IAlgorithmInstance
     */
    class IErrorCorrectionInstance extends IAlgorithmInstance {
      /**
       * Detect errors in data
       * @param {byte[]} data - Input data
       * @returns {bool} True if errors detected
       */
      DetectError(data) { throw 'DetectError() not implemented' }
    }

    /**
     * Instance interface for random number generators
     * @extends IAlgorithmInstance
     */
    class IRandomGeneratorInstance extends IAlgorithmInstance {
      /**
       * Generate random bytes
       * @param {int} count - Number of bytes to generate
       * @returns {byte[]} Random bytes
       */
      NextBytes(count) { throw 'NextBytes() not implemented' }
    }
    //#endregion

    // #region Registry
    const Algorithms = [];
    
    function RegisterAlgorithm(algorithm) { 
      // Validate algorithm
      if (!algorithm || typeof algorithm !== 'object') {
        throw new Error('RegisterAlgorithm: Invalid algorithm object');
      }
      
      if (!algorithm.name || typeof algorithm.name !== 'string') {
        throw new Error('RegisterAlgorithm: Algorithm must have a valid name');
      }
      
      // Check for duplicate names
      if (Algorithms.find(a => a.name === algorithm.name)) {
        throw new Error(`RegisterAlgorithm: Algorithm '${algorithm.name}' already registered`);
      }
      
      // Process and validate test vectors
      if (algorithm.tests && Array.isArray(algorithm.tests)) {
        algorithm.tests = algorithm.tests.map((test, index) => {
          return _processTestVector(test, index, algorithm.name);
        });
      }
      
      Algorithms.push(algorithm);
    }
    
    function _processTestVector(test, index, algorithmName) {
      // Ensure test is a TestCase object or convert it
      if (!(test instanceof TestCase)) {
        // Convert plain object to TestCase
        if (test && typeof test === 'object' && test.input !== undefined) {
          const description = test.text  || `Test vector #${index + 1}`;
          const uri = test.uri || '';

          // Allow test vectors without 'expected' for round-trip testing
          // If no expected value, use empty array to signal round-trip mode
          const expected = test.expected !== undefined ? test.expected : [];
          const result = new TestCase(test.input, expected, description, uri);

          // Copy any additional properties (key, iv, outputSize, etc.)
          Object.keys(test).forEach(key => {
            if (!['input', 'expected', 'text', 'uri'].includes(key))
              result[key] = test[key];

          });

          return result;
        } else {
          throw new Error(`RegisterAlgorithm: Invalid test vector #${index + 1} in algorithm '${algorithmName}' - must have at least 'input' field`);
        }
      }

      // Validate that test is a TestCase with at least input
      if (test.input === undefined) {
        throw new Error(`RegisterAlgorithm: Test vector #${index + 1} in algorithm '${algorithmName}' missing input`);
      }

      // Validate that input is byte array or null
      if (!Array.isArray(test.input) && test.input !== null) {
        throw new Error(`RegisterAlgorithm: Test vector #${index + 1} in algorithm '${algorithmName}' has invalid input (must be byte array or null)`);
      }

      // Validate that expected is byte array if provided (allow empty for round-trip)
      if (test.expected !== undefined && !Array.isArray(test.expected)) {
        throw new Error(`RegisterAlgorithm: Test vector #${index + 1} in algorithm '${algorithmName}' has invalid expected (must be byte array)`);
      }

      return test;
    }
    
    function Find(name) { return Algorithms.find(a => a.name === name) || null }
    function Clear() { Algorithms.length = 0 }
    // #endregion

    // === expose everything needed by consumers ===
    return {
      // registering
      RegisterAlgorithm,
      
      // enums
      CategoryType,
      SecurityStatus,
      ComplexityType,
      CountryCode,

      // core
      LinkItem,
      TestCase,
      Vulnerability,
      AuthResult,
      KeySize,

      // base + families
      Algorithm,
      CryptoAlgorithm,
      SymmetricCipherAlgorithm,
      AsymmetricCipherAlgorithm,
      BlockCipherAlgorithm,
      StreamCipherAlgorithm,
      EncodingAlgorithm,
      CompressionAlgorithm,
      ErrorCorrectionAlgorithm,
      HashFunctionAlgorithm,
      MacAlgorithm,
      KdfAlgorithm,
      PaddingAlgorithm,
      CipherModeAlgorithm,
      AeadAlgorithm,
      RandomGenerationAlgorithm,
      
      // instances
      IAlgorithmInstance,
      IBlockCipherInstance,
      IHashFunctionInstance,
      IMacInstance,
      IKdfInstance,
      IAeadInstance,
      IErrorCorrectionInstance,
      IRandomGeneratorInstance,

      // registry
      Algorithms,
      Find,
      Clear
    };
  }
));
