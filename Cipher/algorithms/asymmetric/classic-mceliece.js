/*
 * Classic McEliece Implementation
 * Code-based post-quantum key encapsulation mechanism
 * Compatible with Universal Cipher Framework
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }

  // Classic McEliece parameter sets (NIST Round 4 finalists)
  const MCELIECE_PARAMS = {
    'mceliece348864': {
      n: 3488, k: 2720, t: 64, m: 12,
      pkBytes: 261120, skBytes: 6492, ctBytes: 96, ssBytes: 32,
      security: 'NIST Level 1 (128-bit)',
      nistLevel: 1
    },
    'mceliece348864f': {
      n: 3488, k: 2720, t: 64, m: 12,
      pkBytes: 261120, skBytes: 6492, ctBytes: 96, ssBytes: 32,
      security: 'NIST Level 1 (128-bit) - fast variant',
      nistLevel: 1
    },
    'mceliece460896': {
      n: 4608, k: 3360, t: 96, m: 13,
      pkBytes: 524160, skBytes: 13608, ctBytes: 156, ssBytes: 32,
      security: 'NIST Level 3 (192-bit)',
      nistLevel: 3
    },
    'mceliece460896f': {
      n: 4608, k: 3360, t: 96, m: 13,
      pkBytes: 524160, skBytes: 13608, ctBytes: 156, ssBytes: 32,
      security: 'NIST Level 3 (192-bit) - fast variant',
      nistLevel: 3
    },
    'mceliece6688128': {
      n: 6688, k: 5024, t: 128, m: 13,
      pkBytes: 1044992, skBytes: 13932, ctBytes: 208, ssBytes: 32,
      security: 'NIST Level 5 (256-bit)',
      nistLevel: 5
    },
    'mceliece6688128f': {
      n: 6688, k: 5024, t: 128, m: 13,
      pkBytes: 1044992, skBytes: 13932, ctBytes: 208, ssBytes: 32,
      security: 'NIST Level 5 (256-bit) - fast variant',
      nistLevel: 5
    },
    'mceliece6960119': {
      n: 6960, k: 5413, t: 119, m: 13,
      pkBytes: 1047319, skBytes: 13948, ctBytes: 194, ssBytes: 32,
      security: 'NIST Level 5 (256-bit) - optimal',
      nistLevel: 5
    },
    'mceliece6960119f': {
      n: 6960, k: 5413, t: 119, m: 13,
      pkBytes: 1047319, skBytes: 13948, ctBytes: 194, ssBytes: 32,
      security: 'NIST Level 5 (256-bit) - optimal fast variant',
      nistLevel: 5
    },
    'mceliece8192128': {
      n: 8192, k: 6528, t: 128, m: 13,
      pkBytes: 1357824, skBytes: 14120, ctBytes: 208, ssBytes: 32,
      security: 'NIST Level 5 (256-bit) - maximum',
      nistLevel: 5
    },
    'mceliece8192128f': {
      n: 8192, k: 6528, t: 128, m: 13,
      pkBytes: 1357824, skBytes: 14120, ctBytes: 208, ssBytes: 32,
      security: 'NIST Level 5 (256-bit) - maximum fast variant',
      nistLevel: 5
    }
  };
  
  const ClassicMcEliece = {
    name: "Classic McEliece",
    description: "Classic McEliece code-based key encapsulation mechanism using binary Goppa codes. Most conservative post-quantum cryptographic approach with decades of cryptanalytic scrutiny. Educational implementation of NIST PQC finalist.",
    inventor: "Robert J. McEliece",
    year: 1978,
    country: "US",
    category: "cipher",
    subCategory: "Code-Based Post-Quantum KEM",
    securityStatus: "educational",
    securityNotes: "Educational code-based implementation. Real Classic McEliece requires proper Goppa code construction and syndrome decoding.",

    documentation: [
      {text: "McEliece Original Paper (1978)", uri: "https://tda.jpl.nasa.gov/progress_report/42-44/44N.PDF"},
      {text: "NIST PQC Round 4 Classic McEliece", uri: "https://classic.mceliece.org/nist.html"},
      {text: "Classic McEliece Official Site", uri: "https://classic.mceliece.org/"},
      {text: "Code-Based Cryptography Survey", uri: "https://eprint.iacr.org/2016/1174"},
      {text: "Binary Goppa Codes", uri: "https://en.wikipedia.org/wiki/Goppa_code"}
    ],
    
    references: [
      {text: "Classic McEliece Reference Implementation", uri: "https://github.com/PQCMayo/Classic-McEliece"},
      {text: "NIST PQC Competition", uri: "https://csrc.nist.gov/projects/post-quantum-cryptography"},
      {text: "Error Correcting Codes Handbook", uri: "https://en.wikipedia.org/wiki/Error_detection_and_correction"},
      {text: "Syndrome Decoding Algorithms", uri: "https://en.wikipedia.org/wiki/Syndrome_decoding"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Information Set Decoding",
        text: "Vulnerable to information set decoding attacks if parameters are insufficient",
        mitigation: "Use conservative parameter selection with sufficient security margins"
      },
      {
        type: "Key Size",
        text: "Very large public key sizes compared to other post-quantum schemes",
        mitigation: "Accept larger keys for conservative security or use structured variants"
      }
    ],

    tests: [
      {
        text: "Classic McEliece-348864 Educational Test Vector",
        uri: "Educational implementation - based on NIST Round 4 parameters",
        input: OpCodes.Hex8ToBytes("436C61737369632D4D634C69656365"), // "Classic-McEliece"
        key: OpCodes.Hex8ToBytes("0001"), // mceliece348864 = 1
        expected: null // Educational - computed during execution
      },
      {
        text: "Classic McEliece Official Test Vector Reference",
        uri: "https://classic.mceliece.org/nist.html",
        input: OpCodes.Hex8ToBytes("436F64652D6261736564204B454D2074657374"), // "Code-based KEM test"
        key: OpCodes.Hex8ToBytes("0002"), // mceliece460896 = 2
        expected: null // Reference only
      }
    ],

    // Legacy compatibility properties
    internalName: 'classic-mceliece',
    minKeyLength: 32,
    maxKeyLength: 128,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: [348864, 460896, 6688128, 6960119, 8192128],
    blockSize: 32,
    isStreamCipher: false,
    isBlockCipher: false,
    isPostQuantum: true,
    isKEM: true,
    complexity: 'Expert',
    family: 'Post-Quantum',
    
    // Current parameter set
    currentParams: null,
    currentParameterSet: 'mceliece348864',

    // Initialize Classic McEliece with specified parameter set
    Init: function(paramIndex) {
      const paramNames = [
        'mceliece348864',   // 0, 1
        'mceliece348864f',
        'mceliece460896',   // 2, 3
        'mceliece460896f',
        'mceliece6688128',  // 4, 5
        'mceliece6688128f',
        'mceliece6960119',  // 6, 7
        'mceliece6960119f',
        'mceliece8192128',  // 8, 9
        'mceliece8192128f'
      ];
      
      if (typeof paramIndex !== 'number' || paramIndex < 0 || paramIndex >= paramNames.length) {
        paramIndex = 0; // Default to mceliece348864
      }
      
      const paramName = paramNames[paramIndex];
      
      if (!MCELIECE_PARAMS[paramName]) {
        throw new Error('Invalid Classic McEliece parameter set.');
      }
      
      this.currentParams = MCELIECE_PARAMS[paramName];
      this.currentParameterSet = paramName;
      
      return true;
    },


    // Galois Field GF(2^m) arithmetic
    GaloisField: {
      // Multiply elements in GF(2^m)
      multiply: function(a, b, irreducible, m) {
        let result = 0;
        for (let i = 0; i < m; i++) {
          if ((b >> i) & 1) {
            result ^= (a << i);
          }
        }
        
        // Reduce modulo irreducible polynomial
        for (let i = 2 * m - 2; i >= m; i--) {
          if ((result >> i) & 1) {
            result ^= (irreducible << (i - m));
          }
        }
        
        return result;
      },
      
      // Evaluate polynomial at point alpha
      evaluate: function(poly, alpha, irreducible, m) {
        let result = 0;
        let alphaPower = 1;
        
        for (let i = 0; i < poly.length; i++) {
          if (poly[i]) {
            result ^= this.multiply(poly[i], alphaPower, irreducible, m);
          }
          alphaPower = this.multiply(alphaPower, alpha, irreducible, m);
        }
        
        return result;
      }
    },

    // Binary Goppa code construction (educational simplified version)
    GoppaCode: {
      // Generate random irreducible polynomial of degree t
      generateIrreducible: function(t, m) {
        // Simplified: return a known irreducible polynomial for educational purposes
        const irreducibles = {
          12: 0x1053, // x^12 + x^6 + x^4 + x + 1
          13: 0x201b  // x^13 + x^4 + x^3 + x + 1
        };
        return irreducibles[m] || 0x1053;
      },
      
      // Generate support set (field elements)
      generateSupport: function(n, m) {
        const support = new Array(n);
        for (let i = 0; i < n; i++) {
          support[i] = i % (1 << m); // Simplified support
        }
        return support;
      },
      
      // Generate parity check matrix for Goppa code
      generateParityCheckMatrix: function(support, gPoly, irreducible, n, t, m) {
        const r = n - t * m; // Dimension of the code
        const H = new Array(t * m);
        
        for (let i = 0; i < t * m; i++) {
          H[i] = new Array(n);
          OpCodes.ClearArray(H[i]);
        }
        
        // Simplified parity check matrix construction
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < t * m; i++) {
            H[i][j] = (j + i) % 2; // Educational simplified version
          }
        }
        
        return H;
      }
    },

    // Key generation (educational simplified version)
    KeyGeneration: function() {
      if (!this.currentParams) {
        throw new Error('Classic McEliece not initialized. Call Init() first.');
      }
      
      const params = this.currentParams;
      const { n, k, t, m } = params;
      
      // Generate irreducible Goppa polynomial
      const gPoly = this.GoppaCode.generateIrreducible(t, m);
      
      // Generate support set
      const support = this.GoppaCode.generateSupport(n, m);
      
      // Generate parity check matrix
      const H = this.GoppaCode.generateParityCheckMatrix(support, gPoly, gPoly, n, t, m);
      
      // Generate generator matrix G (simplified)
      const G = new Array(k);
      for (let i = 0; i < k; i++) {
        G[i] = new Array(n);
        OpCodes.ClearArray(G[i]);
        // Simplified generator matrix (identity + parity)
        G[i][i] = 1;
        for (let j = k; j < n; j++) {
          G[i][j] = (i + j) % 2;
        }
      }
      
      // Generate random permutation matrix P (simplified)
      const P = new Array(n);
      for (let i = 0; i < n; i++) {
        P[i] = i; // Identity permutation for educational purposes
      }
      
      // Generate random invertible matrix S (simplified)
      const S = new Array(k);
      for (let i = 0; i < k; i++) {
        S[i] = new Array(k);
        OpCodes.ClearArray(S[i]);
        S[i][i] = 1; // Identity matrix for educational purposes
      }
      
      // Compute public key matrix Gpub = S * G * P
      const Gpub = new Array(k);
      for (let i = 0; i < k; i++) {
        Gpub[i] = new Array(n);
        for (let j = 0; j < n; j++) {
          Gpub[i][j] = G[i][P[j]]; // Simplified multiplication
        }
      }
      
      const privateKey = {
        S: S,
        G: G,
        P: P,
        H: H,
        support: support,
        gPoly: gPoly,
        params: params
      };
      
      const publicKey = {
        Gpub: Gpub,
        n: n,
        k: k,
        t: t,
        params: params
      };
      
      return {
        privateKey: privateKey,
        publicKey: publicKey,
        params: params
      };
    },

    // Encapsulation (Key Encapsulation Mechanism)
    Encapsulate: function(publicKey) {
      if (!this.currentParams) {
        throw new Error('Classic McEliece not initialized. Call Init() first.');
      }
      
      const params = this.currentParams;
      const { n, k, t } = params;
      
      // Generate random shared secret
      const sharedSecret = new Array(32);
      for (let i = 0; i < 32; i++) {
        sharedSecret[i] = Math.floor(Math.random() * 256);
      }
      
      // Convert shared secret to message vector
      const m = new Array(k);
      for (let i = 0; i < k; i++) {
        m[i] = sharedSecret[i % 32] & 1;
      }
      
      // Encode message: c' = m * G
      const cPrime = new Array(n);
      OpCodes.ClearArray(cPrime);
      
      for (let i = 0; i < k; i++) {
        if (m[i]) {
          for (let j = 0; j < n; j++) {
            cPrime[j] ^= publicKey.Gpub[i][j];
          }
        }
      }
      
      // Add random error vector of weight t
      const e = new Array(n);
      OpCodes.ClearArray(e);
      
      let errorPositions = 0;
      while (errorPositions < t) {
        const pos = Math.floor(Math.random() * n);
        if (!e[pos]) {
          e[pos] = 1;
          errorPositions++;
        }
      }
      
      // Compute ciphertext c = c' + e
      const c = new Array(n);
      for (let i = 0; i < n; i++) {
        c[i] = cPrime[i] ^ e[i];
      }
      
      return {
        ciphertext: c,
        sharedSecret: sharedSecret
      };
    },
    
    // Decapsulation
    Decapsulate: function(privateKey, ciphertext) {
      if (!this.currentParams) {
        throw new Error('Classic McEliece not initialized. Call Init() first.');
      }
      
      const params = this.currentParams;
      const { n, k, t } = params;
      
      // Simplified syndrome decoding (educational)
      // In real implementation, this would use proper Goppa decoding
      
      // Compute syndrome s = H * c^T
      const syndrome = new Array(t * params.m);
      OpCodes.ClearArray(syndrome);
      
      for (let i = 0; i < t * params.m; i++) {
        for (let j = 0; j < n; j++) {
          syndrome[i] ^= privateKey.H[i][j] * ciphertext[j];
        }
      }
      
      // Educational error pattern estimation
      const errorPattern = new Array(n);
      OpCodes.ClearArray(errorPattern);
      
      // Simple error detection (not cryptographically correct)
      let errorCount = 0;
      for (let i = 0; i < n && errorCount < t; i++) {
        if (syndrome[i % syndrome.length]) {
          errorPattern[i] = 1;
          errorCount++;
        }
      }
      
      // Correct errors: c' = c + error_pattern
      const corrected = new Array(n);
      for (let i = 0; i < n; i++) {
        corrected[i] = ciphertext[i] ^ errorPattern[i];
      }
      
      // Extract message by inverting encoding
      const message = new Array(k);
      for (let i = 0; i < k; i++) {
        message[i] = corrected[i]; // Simplified extraction
      }
      
      // Convert message back to shared secret
      const sharedSecret = new Array(32);
      for (let i = 0; i < 32; i++) {
        sharedSecret[i] = 0;
        for (let j = 0; j < 8 && i * 8 + j < k; j++) {
          sharedSecret[i] |= (message[i * 8 + j] << j);
        }
      }
      
      return sharedSecret;
    },

    // Universal Cipher Framework Interface
    KeySetup: function(key) {
      // Extract parameter index from key data
      if (Array.isArray(key) && key.length >= 2) {
        const paramIndex = OpCodes.Pack16BE(key[0], key[1]);
        return this.Init(paramIndex);
      } else if (typeof key === 'string') {
        const paramIndex = parseInt(key) || 0;
        return this.Init(paramIndex);
      } else if (typeof key === 'number') {
        return this.Init(key);
      }
      return this.Init(0); // Default to mceliece348864
    },
    
    EncryptBlock: function(blockIndex, data) {
      // Generate keys if not present
      if (!this.publicKey || !this.privateKey) {
        const keyPair = this.KeyGeneration();
        this.publicKey = keyPair.publicKey;
        this.privateKey = keyPair.privateKey;
      }
      
      const result = this.Encapsulate(this.publicKey);
      return result.ciphertext;
    },
    
    DecryptBlock: function(blockIndex, data) {
      // Ensure keys are available
      if (!this.privateKey) {
        throw new Error('Classic McEliece private key not available for decapsulation');
      }
      
      return this.Decapsulate(this.privateKey, data);
    },
    
    ClearData: function() {
      // Securely clear sensitive data using OpCodes
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
      }
      if (this.publicKey && this.publicKey.Gpub) {
        this.publicKey.Gpub.forEach(row => OpCodes.ClearArray(row));
      }
      
      this.currentParams = null;
      this.currentParameterSet = 'mceliece348864';
      this.publicKey = null;
      this.privateKey = null;
    }

  };
  
  // Auto-register with universal Cipher system
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(ClassicMcEliece);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClassicMcEliece;
  }
  
  // Global export
  global.ClassicMcEliece = ClassicMcEliece;
  
})(typeof global !== 'undefined' ? global : window);