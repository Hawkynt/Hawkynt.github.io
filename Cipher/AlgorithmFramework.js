/* AlgorithmFramework.js
 * Browser + Worker + Node (CJS/AMD-friendly) UMD
 * (c)2006-2025 Hawkynt
*/
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node / CJS
    const mod = factory();
    module.exports = mod;
    // optional: nicer interop for some ESM/bundlers
    module.exports.default = mod;
  } else {
    // Browser/Worker global
    root.AlgorithmFramework = factory();
  }
}(
  // Prefer globalThis, else fall back safely
  typeof globalThis !== 'undefined' ? globalThis
    : (typeof self !== 'undefined' ? self
    : (typeof window !== 'undefined' ? window
    : (typeof global !== 'undefined' ? global
    : this))),
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
class LinkItem {
  constructor(text, uri) {
    this.text = text
    this.uri = uri
  }
}

class TestCase extends LinkItem {
  constructor(input, expected, description = '', uri = '') {
    super(description, uri)
    this.input = input
    this.expected = expected
  }
}

class Vulnerability extends LinkItem {
  constructor(type, mitigation, uri = '') {
    super(type, uri)
    this.mitigation = mitigation
  }
}

class AuthResult {
  constructor(success, output = null, failureReason = null) {
    this.Success = success
    this.Output = output
    this.FailureReason = failureReason
  }
}

class KeySize {
  constructor(minSize, maxSize, stepSize = 1) {
    this.minSize = minSize
    this.maxSize = maxSize
    this.stepSize = stepSize
  }
}
//#endregion

//#region ===== Base Interfaces =====
class IAlgorithmInstance {
  constructor(algorithm) {
    this.algorithm = algorithm
  }
  Feed(_) { throw 'Feed() not implemented' }
  Result() { throw 'Result() not implemented' }
}

class Algorithm {
  constructor() {
    this.name = null
    this.description = null
    this.inventor = null
    this.year = null
    this.category = null
    this.subCategory = null
    this.securityStatus = null
    this.complexity = null
    this.country = null
    this.documentation = []
    this.references = []
    this.knownVulnerabilities = []
    this.tests = []
  }
  CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
}
//#endregion

//#region ===== Family Placeholders =====
class CryptoAlgorithm extends Algorithm {}
class SymmetricCipherAlgorithm extends CryptoAlgorithm {}
class AsymmetricCipherAlgorithm extends CryptoAlgorithm {}
class BlockCipherAlgorithm extends SymmetricCipherAlgorithm {
  constructor() {
    super()
    this.SupportedKeySizes = []
    this.SupportedBlockSizes = []
  }
}
class StreamCipherAlgorithm extends SymmetricCipherAlgorithm {}
class EncodingAlgorithm extends Algorithm {}
class CompressionAlgorithm extends Algorithm {}
class ErrorCorrectionAlgorithm extends Algorithm {}
class HashFunctionAlgorithm extends Algorithm {
  constructor() {
    super()
    this.SupportedOutputSizes = []
  }
}
class MacAlgorithm extends Algorithm {
  constructor() {
    super()
    this.SupportedMacSizes = []
    this.NeedsKey = true
  }
}
class KdfAlgorithm extends Algorithm {
  constructor() {
    super()
    this.SupportedOutputSizes = []
    this.SaltRequired = true
  }
}
class PaddingAlgorithm extends Algorithm {
  constructor() {
    super()
    this.IsLengthIncluded = false
  }
}
class CipherModeAlgorithm extends Algorithm {
  constructor() {
    super()
    this.RequiresIV = true
    this.SupportedIVSizes = []
  }
}
class AeadAlgorithm extends CryptoAlgorithm {
  constructor() {
    super()
    this.SupportedTagSizes = []
    this.SupportsDetached = false
  }
}
class RandomGenerationAlgorithm extends Algorithm {
  constructor() {
    super()
    this.IsDeterministic = false
    this.IsCryptographicallySecure = true
    this.SupportedSeedSizes = []
  }
}
//#endregion

//#region ===== Instance Interface Extensions =====
class IBlockCipherInstance extends IAlgorithmInstance {
  constructor(algorithm) {
    super(algorithm)
    this.BlockSize = 0
    this.KeySize = 0
  }
}

class IHashFunctionInstance extends IAlgorithmInstance {
  constructor(algorithm) {
    super(algorithm)
    this.OutputSize = 0
  }
}

class IMacInstance extends IAlgorithmInstance {
  ComputeMac(_) { throw 'ComputeMac() not implemented' }
}

class IKdfInstance extends IAlgorithmInstance {
  constructor(algorithm) {
    super(algorithm)
    this.OutputSize = 0
    this.Iterations = 0
  }
}

class IAeadInstance extends IAlgorithmInstance {
  constructor(algorithm) {
    super(algorithm)
    this.aad = []
    this.tagSize = 0
  }
}

class IErrorCorrectionInstance extends IAlgorithmInstance {
  DetectError(_) { throw 'DetectError() not implemented' }
}

class IRandomGeneratorInstance extends IAlgorithmInstance {
  NextBytes(_) { throw 'NextBytes() not implemented' }
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
      if (test && typeof test === 'object' && test.input !== undefined && test.expected !== undefined) {
        const description = test.text  || `Test vector #${index + 1}`;
        const uri = test.uri || '';
        const newTest = new TestCase(test.input, test.expected, description, uri);
        
        // Copy any additional properties (key, iv, outputSize, etc.)
        Object.keys(test).forEach(key => {
          if (!['input', 'expected', 'text', 'uri'].includes(key)) {
            newTest[key] = test[key];
          }
        });
        
        return newTest;
      } else {
        throw new Error(`RegisterAlgorithm: Invalid test vector #${index + 1} in algorithm '${algorithmName}'`);
      }
    }
    
    // Validate required properties
    if (test.input === undefined || test.expected === undefined) {
      throw new Error(`RegisterAlgorithm: Test vector #${index + 1} in algorithm '${algorithmName}' missing input or expected`);
    }
    
    // Validate that input and expected are byte arrays
    if (!Array.isArray(test.input) && test.input !== null) {
      throw new Error(`RegisterAlgorithm: Test vector #${index + 1} in algorithm '${algorithmName}' has invalid input (must be byte array or null)`);
    }
    
    if (!Array.isArray(test.expected)) {
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
      Clear,
      
    };
  }
));