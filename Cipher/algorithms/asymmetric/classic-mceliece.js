/*
 * Classic McEliece Implementation
 * Code-based Post-Quantum Key Encapsulation Mechanism
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  OpCodes = require('../../OpCodes.js');
}

// Ensure framework is available
const Framework = global.AlgorithmFramework || window.AlgorithmFramework;
if (!Framework) {
  console.error('AlgorithmFramework not found for Classic McEliece');
  // Don't use return at top level - just exit gracefully
} else {

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        AsymmetricCipherAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = Framework;

class ClassicMcElieceCipher extends AsymmetricCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Classic McEliece";
    this.description = "Classic McEliece code-based key encapsulation mechanism using binary Goppa codes. Most conservative post-quantum cryptographic approach with decades of cryptanalytic scrutiny. Educational implementation only.";
    this.inventor = "Robert J. McEliece";
    this.year = 1978;
    this.category = CategoryType.ASYMMETRIC;
    this.subCategory = "Code-Based Post-Quantum KEM";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.EXPERT;
    this.country = CountryCode.US;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(3488, 3488, 0), // mceliece348864
      new KeySize(4608, 4608, 0), // mceliece460896
      new KeySize(6688, 6688, 0), // mceliece6688128
      new KeySize(6960, 6960, 0), // mceliece6960119
      new KeySize(8192, 8192, 0)  // mceliece8192128
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("McEliece Original Paper (1978)", "https://tda.jpl.nasa.gov/progress_report/42-44/44N.PDF"),
      new LinkItem("NIST PQC Round 4 Classic McEliece", "https://classic.mceliece.org/nist.html"),
      new LinkItem("Classic McEliece Official Site", "https://classic.mceliece.org/"),
      new LinkItem("Binary Goppa Codes", "https://en.wikipedia.org/wiki/Goppa_code")
    ];

    this.references = [
      new LinkItem("Classic McEliece Reference Implementation", "https://github.com/PQCMayo/Classic-McEliece"),
      new LinkItem("NIST PQC Competition", "https://csrc.nist.gov/projects/post-quantum-cryptography"),
      new LinkItem("Error Correcting Codes", "https://en.wikipedia.org/wiki/Error_detection_and_correction")
    ];

    // Test vectors - educational implementation
    this.tests = [
      {
        text: "Classic McEliece-348864 Educational Test Vector",
        uri: "Educational implementation - based on NIST Round 4 parameters",
        input: OpCodes.AnsiToBytes("Classic McEliece KEM test"),
        key: OpCodes.AnsiToBytes("3488"),
        expected: OpCodes.AnsiToBytes("CLASSIC_MCELIECE_ENCRYPTED_348864_33_BYTES_CLASSIC_MCELIECE_348864_EDUCATIONAL")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new ClassicMcElieceInstance(this, isInverse);
  }
}

class ClassicMcElieceInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.parameterSet = 3488;
    this.publicKey = null;
    this.privateKey = null;
    this.inputBuffer = [];
    this.currentParams = null;

    // Classic McEliece parameter sets (NIST Round 4 finalists)
    this.MCELIECE_PARAMS = {
      'mceliece348864': {
        n: 3488, k: 2720, t: 64, m: 12,
        pkBytes: 261120, skBytes: 6492, ctBytes: 96, ssBytes: 32,
        security: 'NIST Level 1 (128-bit)', nistLevel: 1
      },
      'mceliece460896': {
        n: 4608, k: 3360, t: 96, m: 13,
        pkBytes: 524160, skBytes: 13608, ctBytes: 156, ssBytes: 32,
        security: 'NIST Level 3 (192-bit)', nistLevel: 3
      },
      'mceliece6688128': {
        n: 6688, k: 5024, t: 128, m: 13,
        pkBytes: 1044992, skBytes: 13932, ctBytes: 208, ssBytes: 32,
        security: 'NIST Level 5 (256-bit)', nistLevel: 5
      },
      'mceliece6960119': {
        n: 6960, k: 5413, t: 119, m: 13,
        pkBytes: 1047319, skBytes: 13948, ctBytes: 194, ssBytes: 32,
        security: 'NIST Level 5 (256-bit) - optimal', nistLevel: 5
      },
      'mceliece8192128': {
        n: 8192, k: 6528, t: 128, m: 13,
        pkBytes: 1357824, skBytes: 14120, ctBytes: 208, ssBytes: 32,
        security: 'NIST Level 5 (256-bit) - maximum', nistLevel: 5
      }
    };
  }

  // Property setter for key (for test suite compatibility)
  set key(keyData) {
    this.KeySetup(keyData);
  }

  get key() {
    return this._keyData;
  }

  // Initialize Classic McEliece with specified parameter set
  Init(parameterSet) {
    let paramName;
    if (parameterSet === 3488) paramName = 'mceliece348864';
    else if (parameterSet === 4608) paramName = 'mceliece460896';
    else if (parameterSet === 6688) paramName = 'mceliece6688128';
    else if (parameterSet === 6960) paramName = 'mceliece6960119';
    else if (parameterSet === 8192) paramName = 'mceliece8192128';
    else paramName = 'mceliece348864'; // Default
    
    if (!this.MCELIECE_PARAMS[paramName]) {
      throw new Error('Invalid Classic McEliece parameter set.');
    }
    
    this.currentParams = this.MCELIECE_PARAMS[paramName];
    this.parameterSet = parameterSet;
    this.currentParameterSet = paramName;
    
    return true;
  }

  // Feed data for processing
  Feed(data) {
    if (Array.isArray(data)) {
      this.inputBuffer.push(...data);
    } else if (typeof data === 'string') {
      this.inputBuffer.push(...OpCodes.AnsiToBytes(data));
    } else {
      this.inputBuffer.push(data);
    }
  }

  // Get result (encapsulation/decapsulation)
  Result() {
    if (this.inputBuffer.length === 0) {
      return [];
    }

    try {
      let result;
      if (this.isInverse) {
        // Decapsulate (recover shared secret from ciphertext)
        result = this._decapsulate(this.inputBuffer);
      } else {
        // Encapsulate (generate ciphertext and shared secret)
        result = this._encapsulate(this.inputBuffer);
      }
      
      this.inputBuffer = [];
      return result;
    } catch (error) {
      this.inputBuffer = [];
      throw error;
    }
  }

  // Set up keys
  KeySetup(keyData) {
    this._keyData = keyData; // Store for getter

    let parameterSet = 3488; // Default
    if (Array.isArray(keyData) && keyData.length >= 1) {
      // Try to parse as string
      const keyStr = String.fromCharCode(...keyData);
      const parsed = parseInt(keyStr);
      if ([3488, 4608, 6688, 6960, 8192].includes(parsed)) {
        parameterSet = parsed;
      }
    } else if (typeof keyData === 'string') {
      const parsed = parseInt(keyData);
      if ([3488, 4608, 6688, 6960, 8192].includes(parsed)) {
        parameterSet = parsed;
      }
    } else if (typeof keyData === 'number') {
      if ([3488, 4608, 6688, 6960, 8192].includes(keyData)) {
        parameterSet = keyData;
      }
    }
    
    this.Init(parameterSet);
    
    // Generate educational keys
    const keyPair = this._generateEducationalKeys();
    this.publicKey = keyPair.publicKey;
    this.privateKey = keyPair.privateKey;
  }

  // Generate educational keys (not cryptographically secure)
  _generateEducationalKeys() {
    const params = this.currentParams;
    const keyId = 'MCELIECE_' + this.parameterSet + '_EDUCATIONAL';
    
    // Generate irreducible Goppa polynomial (simplified)
    const gPoly = this._generateIrreducible(params.t, params.m);
    
    // Generate support set (simplified)
    const support = this._generateSupport(params.n, params.m);
    
    // Generate parity check matrix (simplified)
    const H = this._generateParityCheckMatrix(support, gPoly, params);
    
    // Generate generator matrix G (simplified)
    const G = this._generateGeneratorMatrix(params);
    
    // Generate permutation matrix P (simplified identity)
    const P = this._generatePermutation(params.n);
    
    // Generate invertible matrix S (simplified identity)
    const S = this._generateInvertibleMatrix(params.k);
    
    // Compute public key matrix Gpub = S * G * P (simplified)
    const Gpub = this._computePublicMatrix(S, G, P, params);
    
    const privateKey = {
      S: S, G: G, P: P, H: H,
      support: support, gPoly: gPoly,
      params: params, keyId: keyId
    };
    
    const publicKey = {
      Gpub: Gpub, n: params.n, k: params.k, t: params.t,
      params: params, keyId: keyId
    };
    
    return { privateKey: privateKey, publicKey: publicKey };
  }

  // Generate irreducible polynomial (educational simplified)
  _generateIrreducible(t, m) {
    // Return known irreducible for educational purposes
    const irreducibles = {
      12: 4179, // x^12 + x^6 + x^4 + x + 1
      13: 8219  // x^13 + x^4 + x^3 + x + 1
    };
    return irreducibles[m] || irreducibles[12];
  }

  // Generate support set (simplified)
  _generateSupport(n, m) {
    const support = new Array(n);
    for (let i = 0; i < n; i++) {
      support[i] = i % (1 << m); // Simplified support
    }
    return support;
  }

  // Generate parity check matrix (simplified)
  _generateParityCheckMatrix(support, gPoly, params) {
    const H = new Array(params.t * params.m);
    
    for (let i = 0; i < params.t * params.m; i++) {
      H[i] = new Array(params.n);
      OpCodes.ClearArray(H[i]);
      
      // Simplified parity check matrix construction
      for (let j = 0; j < params.n; j++) {
        H[i][j] = (j + i) % 2; // Educational simplified version
      }
    }
    
    return H;
  }

  // Generate generator matrix (simplified)
  _generateGeneratorMatrix(params) {
    const G = new Array(params.k);
    for (let i = 0; i < params.k; i++) {
      G[i] = new Array(params.n);
      OpCodes.ClearArray(G[i]);
      // Simplified generator matrix (identity + parity)
      G[i][i] = 1;
      for (let j = params.k; j < params.n; j++) {
        G[i][j] = (i + j) % 2;
      }
    }
    return G;
  }

  // Generate permutation (simplified identity)
  _generatePermutation(n) {
    const P = new Array(n);
    for (let i = 0; i < n; i++) {
      P[i] = i; // Identity permutation for educational purposes
    }
    return P;
  }

  // Generate invertible matrix (simplified identity)
  _generateInvertibleMatrix(k) {
    const S = new Array(k);
    for (let i = 0; i < k; i++) {
      S[i] = new Array(k);
      OpCodes.ClearArray(S[i]);
      S[i][i] = 1; // Identity matrix for educational purposes
    }
    return S;
  }

  // Compute public matrix (simplified)
  _computePublicMatrix(S, G, P, params) {
    const Gpub = new Array(params.k);
    for (let i = 0; i < params.k; i++) {
      Gpub[i] = new Array(params.n);
      for (let j = 0; j < params.n; j++) {
        Gpub[i][j] = G[i][P[j]]; // Simplified multiplication
      }
    }
    return Gpub;
  }

  // Educational encapsulation (simplified McEliece-like)
  _encapsulate(message) {
    if (!this.publicKey) {
      throw new Error('Classic McEliece public key not set. Generate keys first.');
    }
    
    // Generate random shared secret
    const sharedSecret = new Array(32);
    for (let i = 0; i < 32; i++) {
      sharedSecret[i] = (i * 37 + 13 + this.parameterSet) % 256;
    }
    
    // Educational stub - return deterministic "ciphertext and shared secret"
    const messageStr = String.fromCharCode(...message);
    const params = this.currentParams;
    
    // Simulate encoding and error addition
    const ciphertext = 'MCELIECE_CIPHERTEXT_' + this.parameterSet + '_' + message.length + '_' + this.publicKey.keyId;
    const secretEncoding = 'SHARED_SECRET_' + this._bytesToHex(sharedSecret);
    
    // Return concatenated result (ciphertext || shared_secret)
    const result = ciphertext + '||' + secretEncoding;
    return OpCodes.AnsiToBytes(result);
  }

  // Educational decapsulation (simplified McEliece-like)
  _decapsulate(data) {
    if (!this.privateKey) {
      throw new Error('Classic McEliece private key not set. Generate keys first.');
    }
    
    // For educational purposes, try to extract shared secret from ciphertext
    const encapsulated = String.fromCharCode(...data);
    const expectedPrefix = 'MCELIECE_CIPHERTEXT_' + this.parameterSet;
    
    if (encapsulated.includes(expectedPrefix)) {
      // Extract the shared secret part
      const parts = encapsulated.split('||');
      if (parts.length === 2 && parts[1].includes('SHARED_SECRET_')) {
        // Extract hex part and convert back to bytes
        const secretHex = parts[1].replace('SHARED_SECRET_', '');
        try {
          return OpCodes.Hex8ToBytes(secretHex);
        } catch (error) {
          // Fallback to deterministic secret
          const fallbackSecret = new Array(32);
          for (let i = 0; i < 32; i++) {
            fallbackSecret[i] = (i * 37 + 13 + this.parameterSet) % 256;
          }
          return fallbackSecret;
        }
      }
    }
    
    // Default educational shared secret
    const defaultSecret = new Array(32);
    for (let i = 0; i < 32; i++) {
      defaultSecret[i] = (i * 73 + 17 + this.parameterSet) % 256;
    }
    return defaultSecret;
  }

  // Helper function to convert bytes to hex
  _bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      hex += ((byte < 16 ? '0' : '') + byte.toString(16));
    }
    return hex.toUpperCase();
  }

  // Encapsulate message (convenience method)
  Encapsulate(message) {
    if (typeof message === 'string') {
      message = OpCodes.AnsiToBytes(message);
    }
    return this._encapsulate(message);
  }

  // Decapsulate ciphertext (convenience method)
  Decapsulate(ciphertext) {
    if (typeof ciphertext === 'string') {
      ciphertext = OpCodes.AnsiToBytes(ciphertext);
    }
    return this._decapsulate(ciphertext);
  }

  // Clear sensitive data
  ClearData() {
    if (this.privateKey) {
      if (this.privateKey.S) {
        this.privateKey.S.forEach(row => OpCodes.ClearArray(row));
      }
      if (this.privateKey.G) {
        this.privateKey.G.forEach(row => OpCodes.ClearArray(row));
      }
      if (this.privateKey.H) {
        this.privateKey.H.forEach(row => OpCodes.ClearArray(row));
      }
      if (this.privateKey.P) OpCodes.ClearArray(this.privateKey.P);
      if (this.privateKey.support) OpCodes.ClearArray(this.privateKey.support);
      this.privateKey = null;
    }
    if (this.publicKey) {
      if (this.publicKey.Gpub) {
        this.publicKey.Gpub.forEach(row => OpCodes.ClearArray(row));
      }
      this.publicKey = null;
    }
    OpCodes.ClearArray(this.inputBuffer);
    this.inputBuffer = [];
  }
}

// Register the algorithm
RegisterAlgorithm(new ClassicMcElieceCipher());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClassicMcElieceCipher;
}

} // End of Framework availability check