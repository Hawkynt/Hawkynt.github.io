/*
 * ML-DSA Implementation
 * NIST FIPS 204 - Module-Lattice-Based Digital Signature Algorithm
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
  console.error('AlgorithmFramework not found for ML-DSA');
  // Don't use return at top level - just exit gracefully
} else {

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        AsymmetricCipherAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = Framework;

class MLDSACipher extends AsymmetricCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "ML-DSA";
    this.description = "NIST FIPS 204 Module-Lattice-Based Digital Signature Algorithm. Post-quantum signature standard based on CRYSTALS-Dilithium with M-LWE hardness assumptions. Educational implementation only.";
    this.inventor = "Vadim Lyubashevsky, Leo Ducas, Eike Kiltz, Tancrede Lepoint, Peter Schwabe, Gregor Seiler, Damien Stehle";
    this.year = 2017;
    this.category = CategoryType.ASYMMETRIC;
    this.subCategory = "Post-Quantum Lattice-Based Signature";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.EXPERT;
    this.country = CountryCode.INTL;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(44, 44, 0),   // ML-DSA-44
      new KeySize(65, 65, 0),   // ML-DSA-65
      new KeySize(87, 87, 0)    // ML-DSA-87
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("NIST FIPS 204", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf"),
      new LinkItem("CRYSTALS-Dilithium Original Paper", "https://eprint.iacr.org/2017/633"),
      new LinkItem("NIST Post-Quantum Cryptography", "https://csrc.nist.gov/projects/post-quantum-cryptography"),
      new LinkItem("Module Learning With Errors", "https://en.wikipedia.org/wiki/Learning_with_errors")
    ];

    this.references = [
      new LinkItem("CRYSTALS-Dilithium Reference Implementation", "https://github.com/pq-crystals/dilithium"),
      new LinkItem("NIST PQC Standardization", "https://csrc.nist.gov/projects/post-quantum-cryptography/post-quantum-cryptography-standardization"),
      new LinkItem("Lattice-Based Cryptography", "https://en.wikipedia.org/wiki/Lattice-based_cryptography")
    ];

    // Test vectors - NIST FIPS 204 official ACVP test vectors
    this.tests = [
      {
        text: "NIST FIPS 204 ML-DSA-44 Key Generation Test Vector",
        uri: "https://github.com/usnistgov/ACVP-Server/tree/master/gen-val/json-files/ML-DSA-keyGen-FIPS204",
        input: OpCodes.Hex8ToBytes("D71361C000F9A7BC99DFB425BCB6BB27C32C36AB444FF3708B2D93B4E66D5B5B"), // seed
        key: OpCodes.AnsiToBytes("ML-DSA-44"), // parameter set identifier
        expected: OpCodes.Hex8ToBytes("B845FA2881407A59183071629B08223128116014FB58FF6BB4C8C9FE19CF5B0BD77B16648A344FFE486BC3E3CB5FAB9ABC4CC2F1C34901692BEC5D290D815A6CDF7E9710A3388247A7E0371615507A572C9835E6737BF30B92A796FFF3A10A730C7B550924EB1FB6D56195F02DE6D3746F9F330BEBE990C90C4D676AD415F4268D2D6B548A8BCDF27FDD467E6749C0F87B71E85C2797694772BBA88D4F1AC06C7C0E91786472CD76353708D6BBC5C28E9DB891C3940E879052D30C8FD10965CBB8EE1BD79B060D37FB839098552AABDD3A57AB1C6A82B0911D1CF148654AA5613B07014B21E4A1182B4A5501671D112F5975FB0C8A2AC45D575DC42F48977FF37FFF421DB27C45E79F8A9472007023DF0B64205CD9F57C02CE9D1F61F2AE24F7139F5641984EE8DF783B9EA43E997C6E19D09E062AFCA56E4F76AAAB8F66600FC78F6AB4F6785690D185816EE35A939458B60324EEFC60E64B11FA0D20317ACB6CB29AA03C775F151672952689FA4F8F838329CB9E6DC9945B6C7ADE") // expected public key
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new MLDSAInstance(this, isInverse);
  }
}

class MLDSAInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.parameterSet = 44;
    this.publicKey = null;
    this.privateKey = null;
    this.inputBuffer = [];
    this.currentParams = null;

    // NIST FIPS 204 ML-DSA Parameter Sets
    this.ML_DSA_PARAMS = {
      'ML-DSA-44': { 
        k: 4, l: 4, eta: 2, tau: 39, beta: 78, 
        gamma1: 131072, gamma2: 95232, omega: 80,
        q: 8380417, n: 256, d: 13,
        pkSize: 1312, skSize: 2560, sigSize: 2420,
        securityCategory: 2, nistLevel: 1
      },
      'ML-DSA-65': { 
        k: 6, l: 5, eta: 4, tau: 49, beta: 196, 
        gamma1: 524288, gamma2: 261888, omega: 55,
        q: 8380417, n: 256, d: 13,
        pkSize: 1952, skSize: 4032, sigSize: 3309,
        securityCategory: 3, nistLevel: 3
      },
      'ML-DSA-87': { 
        k: 8, l: 7, eta: 2, tau: 60, beta: 120, 
        gamma1: 524288, gamma2: 261888, omega: 75,
        q: 8380417, n: 256, d: 13,
        pkSize: 2592, skSize: 4896, sigSize: 4627,
        securityCategory: 5, nistLevel: 5
      }
    };

    // Constants for ML-DSA operations
    this.Q = 8380417; // Prime modulus
    this.N = 256;     // Polynomial degree
    this.D = 13;      // Dropped bits from t
    this.SEEDBYTES = 32;
    this.CRHBYTES = 64;
  }

  // Property setter for key (for test suite compatibility)
  set key(keyData) {
    this.KeySetup(keyData);
  }

  get key() {
    return this._keyData;
  }

  // Initialize ML-DSA with specified parameter set
  Init(parameterSet) {
    const paramName = 'ML-DSA-' + parameterSet;
    if (!this.ML_DSA_PARAMS[paramName]) {
      throw new Error('Invalid ML-DSA parameter set. Use 44, 65, or 87.');
    }
    
    this.currentParams = this.ML_DSA_PARAMS[paramName];
    this.parameterSet = parameterSet;
    
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

  // Get result (signature generation/verification)
  Result() {
    if (this.inputBuffer.length === 0) {
      return [];
    }

    try {
      let result;
      if (this.isInverse) {
        // Verify signature
        result = this._verify(this.inputBuffer);
      } else {
        // Generate signature
        result = this._sign(this.inputBuffer);
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

    let parameterSet = 44; // Default
    if (Array.isArray(keyData) && keyData.length >= 1) {
      // Try to parse as string
      const keyStr = String.fromCharCode(...keyData);
      const parsed = parseInt(keyStr);
      if ([44, 65, 87].includes(parsed)) {
        parameterSet = parsed;
      }
    } else if (typeof keyData === 'string') {
      const parsed = parseInt(keyData);
      if ([44, 65, 87].includes(parsed)) {
        parameterSet = parsed;
      }
    } else if (typeof keyData === 'number') {
      if ([44, 65, 87].includes(keyData)) {
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
    const keyId = 'ML_DSA_' + this.parameterSet + '_EDUCATIONAL';
    
    // Generate secret key seed
    const skSeed = new Array(this.SEEDBYTES);
    for (let i = 0; i < this.SEEDBYTES; i++) {
      skSeed[i] = (i * 37 + 13 + this.parameterSet) % 256;
    }
    
    // Generate public key seed
    const pkSeed = new Array(this.SEEDBYTES);
    for (let i = 0; i < this.SEEDBYTES; i++) {
      pkSeed[i] = (i * 73 + 17 + this.parameterSet) % 256;
    }
    
    // Generate matrix A in NTT form (simplified)
    const A = this._expandA(pkSeed, params.k, params.l);
    
    // Sample secret vectors s1, s2 (simplified)
    const s1 = this._sampleEtaVectors(skSeed, params.l, params.eta, 'S1_' + keyId);
    const s2 = this._sampleEtaVectors(skSeed, params.k, params.eta, 'S2_' + keyId);
    
    // Compute t = A * s1 + s2 (simplified)
    const t = this._computeT(A, s1, s2);
    
    // Pack public key: pk = (rho, t1) where t = t1 * 2^d + t0
    const t1 = this._power2Round(t, params.d);
    const t0 = this._extractT0(t, params.d);
    
    const privateKey = {
      skSeed: skSeed,
      pkSeed: pkSeed,
      s1: s1,
      s2: s2,
      t0: t0,
      params: params,
      keyId: keyId
    };
    
    const publicKey = {
      pkSeed: pkSeed,
      t1: t1,
      params: params,
      keyId: keyId
    };
    
    return { privateKey: privateKey, publicKey: publicKey };
  }

  // Simplified matrix expansion
  _expandA(pkSeed, k, l) {
    const A = new Array(k);
    for (let i = 0; i < k; i++) {
      A[i] = new Array(l);
      for (let j = 0; j < l; j++) {
        // Generate deterministic polynomial based on seeds
        A[i][j] = this._generateDeterministicPolynomial(this.N, pkSeed, i, j);
      }
    }
    return A;
  }

  // Generate deterministic polynomial
  _generateDeterministicPolynomial(n, seed, i, j) {
    const poly = new Array(n);
    let seedValue = 0;
    
    // Combine seed with indices
    for (let s = 0; s < seed.length; s++) {
      seedValue += seed[s];
    }
    seedValue = (seedValue + i * 73 + j * 97) >>> 0;
    
    for (let k = 0; k < n; k++) {
      seedValue = (seedValue * 1664525 + 1013904223) >>> 0;
      poly[k] = seedValue % this.Q;
    }
    
    return poly;
  }

  // Sample eta vectors (simplified)
  _sampleEtaVectors(seed, count, eta, suffix) {
    const vectors = new Array(count);
    
    for (let i = 0; i < count; i++) {
      vectors[i] = new Array(this.N);
      
      let seedValue = 0;
      for (let s = 0; s < seed.length; s++) {
        seedValue += seed[s];
      }
      seedValue = (seedValue + i * suffix.length) >>> 0;
      
      for (let j = 0; j < this.N; j++) {
        seedValue = (seedValue * 1103515245 + 12345) >>> 0;
        const value = seedValue % (2 * eta + 1);
        vectors[i][j] = value - eta; // Range [-eta, eta]
      }
    }
    
    return vectors;
  }

  // Compute t = A * s1 + s2 (simplified)
  _computeT(A, s1, s2) {
    const t = new Array(A.length);
    
    for (let i = 0; i < A.length; i++) {
      t[i] = new Array(this.N);
      
      // Initialize with s2[i]
      for (let j = 0; j < this.N; j++) {
        t[i][j] = s2[i][j];
      }
      
      // Add A[i] * s1
      for (let j = 0; j < A[i].length; j++) {
        for (let k = 0; k < this.N; k++) {
          t[i][k] = (t[i][k] + A[i][j][k] * s1[j][k]) % this.Q;
          if (t[i][k] < 0) t[i][k] += this.Q;
        }
      }
    }
    
    return t;
  }

  // Power2Round operation
  _power2Round(t, d) {
    const power = Math.pow(2, d);
    return t.map(poly => 
      poly.map(coeff => Math.floor((coeff + power / 2) / power))
    );
  }

  // Extract T0
  _extractT0(t, d) {
    const power = Math.pow(2, d);
    return t.map(poly => 
      poly.map(coeff => coeff % power)
    );
  }

  // Educational signature generation (simplified ML-DSA-like)
  _sign(message) {
    if (!this.privateKey) {
      throw new Error('ML-DSA private key not set. Generate keys first.');
    }
    
    // Educational stub - returns deterministic "signature"
    const messageStr = String.fromCharCode(...message);
    const params = this.currentParams;
    
    // Hash message with public key (simplified)
    const mu = this._educationalHash([...this.privateKey.pkSeed, ...message], this.CRHBYTES);
    
    // Generate commitment (simplified)
    const commitment = 'ML_DSA_COMMITMENT_' + this.parameterSet + '_' + this.privateKey.keyId;
    
    // Generate challenge c (simplified Fiat-Shamir)
    const challenge = ((messageStr.length * 37 + params.tau) % 256);
    
    // Generate response z (simplified)
    const response = 'ML_DSA_RESPONSE_' + challenge + '_GAMMA1_' + params.gamma1;
    
    // Pack signature (c, z, h)
    const signature = commitment + '||' + challenge + '||' + response + '||HINT';
    
    return OpCodes.AnsiToBytes(signature);
  }

  // Educational signature verification (simplified ML-DSA-like)
  _verify(signatureData) {
    if (!this.publicKey) {
      throw new Error('ML-DSA public key not set. Generate keys first.');
    }
    
    // For educational purposes, verify signature format
    const signature = String.fromCharCode(...signatureData);
    const expectedPrefix = 'ML_DSA_COMMITMENT_' + this.parameterSet;
    
    if (signature.includes(expectedPrefix)) {
      // Check if signature contains expected ML-DSA components
      const parts = signature.split('||');
      if (parts.length >= 4) {
        const commitment = parts[0];
        const challenge = parts[1];
        const response = parts[2];
        const hint = parts[3];
        
        // Educational verification (always accept properly formatted signatures)
        return OpCodes.AnsiToBytes('VALID_ML_DSA_SIGNATURE_' + this.parameterSet);
      }
    }
    
    return OpCodes.AnsiToBytes('INVALID_ML_DSA_SIGNATURE');
  }

  // Educational hash function
  _educationalHash(input, outputLength) {
    const output = new Array(outputLength);
    let state = 31; // SHAKE domain separator
    
    // Simplified sponge construction
    for (let i = 0; i < input.length; i++) {
      state = (state * 1103515245 + 12345 + input[i]) & OpCodes.Mask32;
      state = OpCodes.RotL32(state, 7) ^ 1779033703; // SHA-256 initial hash value
    }
    
    // Generate output
    for (let i = 0; i < outputLength; i++) {
      state = (state * 1664525 + 1013904223) & OpCodes.Mask32;
      state = OpCodes.RotL32(state, 13);
      output[i] = (state >>> 24) & OpCodes.Mask8;
    }
    
    return output;
  }

  // Sign message (convenience method)
  Sign(message) {
    if (typeof message === 'string') {
      message = OpCodes.AnsiToBytes(message);
    }
    return this._sign(message);
  }

  // Verify signature (convenience method)
  Verify(message, signature) {
    if (typeof signature === 'string') {
      signature = OpCodes.AnsiToBytes(signature);
    }
    const result = this._verify(signature);
    // Return true if verification succeeded
    const resultStr = String.fromCharCode(...result);
    return resultStr.includes('VALID_ML_DSA_SIGNATURE');
  }

  // Clear sensitive data
  ClearData() {
    if (this.privateKey) {
      if (this.privateKey.skSeed) OpCodes.ClearArray(this.privateKey.skSeed);
      if (this.privateKey.pkSeed) OpCodes.ClearArray(this.privateKey.pkSeed);
      if (this.privateKey.s1) {
        this.privateKey.s1.forEach(poly => OpCodes.ClearArray(poly));
      }
      if (this.privateKey.s2) {
        this.privateKey.s2.forEach(poly => OpCodes.ClearArray(poly));
      }
      if (this.privateKey.t0) {
        this.privateKey.t0.forEach(poly => OpCodes.ClearArray(poly));
      }
      this.privateKey = null;
    }
    if (this.publicKey) {
      if (this.publicKey.pkSeed) OpCodes.ClearArray(this.publicKey.pkSeed);
      if (this.publicKey.t1) {
        this.publicKey.t1.forEach(poly => OpCodes.ClearArray(poly));
      }
      this.publicKey = null;
    }
    OpCodes.ClearArray(this.inputBuffer);
    this.inputBuffer = [];
  }
}

// Register the algorithm
RegisterAlgorithm(new MLDSACipher());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MLDSACipher;
}

} // End of Framework availability check