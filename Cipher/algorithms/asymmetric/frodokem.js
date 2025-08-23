/*
 * FrodoKEM Implementation
 * Learning With Errors Key Encapsulation Mechanism
 * Compatible with Universal Cipher Framework
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }

  // FrodoKEM parameter sets (NIST Round 3 finalist)
  const FRODO_PARAMS = {
    'FrodoKEM-640': {
      n: 640, nbar: 8, m: 8, q: 32768, B: 2, // 2^15
      pkBytes: 9616, skBytes: 19888, ctBytes: 9720, ssBytes: 16,
      security: 'NIST Level 1 (128-bit)',
      nistLevel: 1
    },
    'FrodoKEM-976': {
      n: 976, nbar: 8, m: 8, q: 65536, B: 3, // 2^16
      pkBytes: 15632, skBytes: 31296, ctBytes: 15744, ssBytes: 24,
      security: 'NIST Level 3 (192-bit)',
      nistLevel: 3
    },
    'FrodoKEM-1344': {
      n: 1344, nbar: 8, m: 8, q: 65536, B: 4, // 2^16
      pkBytes: 21520, skBytes: 43088, ctBytes: 21632, ssBytes: 32,
      security: 'NIST Level 5 (256-bit)',
      nistLevel: 5
    }
  };
  
  const FrodoKEM = {
    name: "FrodoKEM",
    description: "Learning With Errors Key Encapsulation Mechanism. Conservative lattice-based post-quantum cryptography using unstructured lattices and standard LWE assumption. Educational implementation of NIST PQC finalist.",
    inventor: "Joppe Bos, Craig Costello, Léo Ducas, Ilya Mironov, Michael Naehrig, Valeria Nikolaenko, Ananth Raghunathan, Douglas Stebila",
    year: 2016,
    country: "International",
    category: "cipher",
    subCategory: "LWE-Based Post-Quantum KEM",
    securityStatus: "educational",
    securityNotes: "Educational LWE implementation. Real FrodoKEM requires proper matrix operations, noise sampling, and constant-time implementation.",

    documentation: [
      {text: "FrodoKEM Official Site", uri: "https://frodokem.org/"},
      {text: "NIST PQC Round 3 FrodoKEM", uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/FrodoKEM-Round3.zip"},
      {text: "Learning With Errors Problem", uri: "https://en.wikipedia.org/wiki/Learning_with_errors"},
      {text: "Lattice-Based Cryptography", uri: "https://en.wikipedia.org/wiki/Lattice-based_cryptography"}
    ],
    
    references: [
      {text: "FrodoKEM Reference Implementation", uri: "https://github.com/Microsoft/FrodoKEM"},
      {text: "Standard LWE Paper", uri: "https://eprint.iacr.org/2016/659"},
      {text: "NIST PQC Competition", uri: "https://csrc.nist.gov/projects/post-quantum-cryptography"},
      {text: "Regev's LWE", uri: "https://cims.nyu.edu/~regev/papers/lwesurvey.pdf"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Lattice Reduction",
        text: "Vulnerable to lattice reduction attacks if LWE parameters are insufficient",
        mitigation: "Use conservative parameters with sufficient noise and dimension"
      },
      {
        type: "Timing Attacks",
        text: "Variable-time operations can leak information about secret keys",
        mitigation: "Implement constant-time operations and protect against side-channels"
      }
    ],

    tests: [
      {
        text: "FrodoKEM-640 Educational Test Vector",
        uri: "Educational implementation - based on NIST Round 3 parameters",
        input: OpCodes.Hex8ToBytes("46726F646F4B454D204C574520746573"), // "FrodoKEM LWE tes"
        key: OpCodes.Hex8ToBytes("0280"), // 640 = 0x0280
        expected: null // Educational - computed during execution
      },
      {
        text: "FrodoKEM Official Test Vector Reference",
        uri: "https://frodokem.org/",
        input: OpCodes.Hex8ToBytes("4C6174746963652062617365642074657374"), // "Lattice based test"
        key: OpCodes.Hex8ToBytes("03D0"), // 976 = 0x03D0
        expected: null // Reference only
      }
    ],

    // Legacy compatibility properties
    internalName: 'frodokem',
    minKeyLength: 32,
    maxKeyLength: 128,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: [640, 976, 1344],
    blockSize: 32,
    isStreamCipher: false,
    isBlockCipher: false,
    isPostQuantum: true,
    isKEM: true,
    complexity: 'Expert',
    family: 'Post-Quantum',
    
    // Current parameter set
    currentParams: null,
    currentN: 640,

    // Initialize FrodoKEM with specified parameter set
    Init: function(n) {
      let paramName;
      if (n === 640) paramName = 'FrodoKEM-640';
      else if (n === 976) paramName = 'FrodoKEM-976';
      else if (n === 1344) paramName = 'FrodoKEM-1344';
      else paramName = 'FrodoKEM-640'; // Default
      
      if (!FRODO_PARAMS[paramName]) {
        throw new Error('Invalid FrodoKEM parameter set. Use 640, 976, or 1344.');
      }
      
      this.currentParams = FRODO_PARAMS[paramName];
      this.currentN = n;
      
      return true;
    },

    // Matrix operations for LWE
    Matrix: {
      // Create matrix with dimensions rows x cols
      create: function(rows, cols) {
        const matrix = new Array(rows);
        for (let i = 0; i < rows; i++) {
          matrix[i] = new Array(cols);
          OpCodes.ClearArray(matrix[i]);
        }
        return matrix;
      },
      
      // Generate random matrix with coefficients modulo q
      random: function(rows, cols, q) {
        const matrix = this.create(rows, cols);
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            matrix[i][j] = Math.floor(Math.random() * q);
          }
        }
        return matrix;
      },
      
      // Matrix multiplication modulo q
      multiply: function(A, B, q) {
        const rowsA = A.length;
        const colsA = A[0].length;
        const colsB = B[0].length;
        
        const result = this.create(rowsA, colsB);
        
        for (let i = 0; i < rowsA; i++) {
          for (let j = 0; j < colsB; j++) {
            for (let k = 0; k < colsA; k++) {
              result[i][j] = (result[i][j] + A[i][k] * B[k][j]) % q;
            }
          }
        }
        
        return result;
      },
      
      // Add matrices modulo q
      add: function(A, B, q) {
        const rows = A.length;
        const cols = A[0].length;
        const result = this.create(rows, cols);
        
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            result[i][j] = (A[i][j] + B[i][j]) % q;
          }
        }
        
        return result;
      }
    },

    // LWE noise sampling (educational simplified)
    NoiseSampling: {
      // Sample from centered binomial distribution
      sampleCenteredBinomial: function(B) {
        let sum = 0;
        for (let i = 0; i < B; i++) {
          sum += Math.random() < 0.5 ? 1 : -1;
        }
        return sum;
      },
      
      // Generate noise matrix
      generateNoiseMatrix: function(rows, cols, B, q) {
        const noise = new Array(rows);
        for (let i = 0; i < rows; i++) {
          noise[i] = new Array(cols);
          for (let j = 0; j < cols; j++) {
            let sample = this.sampleCenteredBinomial(B);
            noise[i][j] = ((sample % q) + q) % q; // Ensure positive
          }
        }
        return noise;
      },
      
      // Round to nearest multiple (for reconciliation)
      round: function(value, q, target) {
        const scaled = Math.round((value * target) / q);
        return scaled % target;
      }
    },

    // Key generation
    KeyGeneration: function() {
      if (!this.currentParams) {
        throw new Error('FrodoKEM not initialized. Call Init() first.');
      }
      
      const params = this.currentParams;
      const { n, nbar, m, q, B } = params;
      
      // Generate random matrix A (can be generated from seed in real implementation)
      const A = this.Matrix.random(n, n, q);
      
      // Generate secret matrix S
      const S = this.NoiseSampling.generateNoiseMatrix(n, nbar, B, q);
      
      // Generate error matrix E
      const E = this.NoiseSampling.generateNoiseMatrix(n, nbar, B, q);
      
      // Compute public key matrix B = A * S + E
      const AS = this.Matrix.multiply(A, S, q);
      const PK_B = this.Matrix.add(AS, E, q);
      
      const privateKey = {
        S: S,
        A: A,
        params: params
      };
      
      const publicKey = {
        A: A,
        B: PK_B,
        params: params
      };
      
      return {
        privateKey: privateKey,
        publicKey: publicKey,
        params: params
      };
    },

    // Encapsulation
    Encapsulate: function(publicKey) {
      if (!this.currentParams) {
        throw new Error('FrodoKEM not initialized. Call Init() first.');
      }
      
      const params = this.currentParams;
      const { n, nbar, m, q, B } = params;
      
      // Generate random shared secret
      const sharedSecret = new Array(params.ssBytes);
      for (let i = 0; i < params.ssBytes; i++) {
        sharedSecret[i] = Math.floor(Math.random() * 256);
      }
      
      // Generate ephemeral matrices
      const SPrime = this.NoiseSampling.generateNoiseMatrix(m, n, B, q);
      const EPrime = this.NoiseSampling.generateNoiseMatrix(m, n, B, q);
      const EDoublePrime = this.NoiseSampling.generateNoiseMatrix(m, nbar, B, q);
      
      // Compute ciphertext components
      // C1 = S' * A + E'
      const SPA = this.Matrix.multiply(SPrime, publicKey.A, q);
      const C1 = this.Matrix.add(SPA, EPrime, q);
      
      // Encode shared secret into matrix
      const mu = this.Matrix.create(m, nbar);
      for (let i = 0; i < m && i < sharedSecret.length; i++) {
        for (let j = 0; j < nbar && j < 8; j++) {
          mu[i][j] = (sharedSecret[i] >> j) & 1;
          mu[i][j] = (mu[i][j] * Math.floor(q / 2)) % q; // Scale to {0, q/2}
        }
      }
      
      // C2 = S' * B + E'' + mu
      const SPB = this.Matrix.multiply(SPrime, publicKey.B, q);
      const temp = this.Matrix.add(SPB, EDoublePrime, q);
      const C2 = this.Matrix.add(temp, mu, q);
      
      return {
        ciphertext: { C1: C1, C2: C2 },
        sharedSecret: sharedSecret
      };
    },
    
    // Decapsulation
    Decapsulate: function(privateKey, ciphertext) {
      if (!this.currentParams) {
        throw new Error('FrodoKEM not initialized. Call Init() first.');
      }
      
      const params = this.currentParams;
      const { n, nbar, m, q } = params;
      const { C1, C2 } = ciphertext;
      
      // Decrypt: mu' = C2 - C1 * S
      const C1S = this.Matrix.multiply(C1, privateKey.S, q);
      
      // Subtract (equivalent to add with negation)
      const muPrime = this.Matrix.create(m, nbar);
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < nbar; j++) {
          muPrime[i][j] = (C2[i][j] - C1S[i][j] + q) % q;
        }
      }
      
      // Decode shared secret from muPrime
      const sharedSecret = new Array(params.ssBytes);
      for (let i = 0; i < params.ssBytes && i < m; i++) {
        sharedSecret[i] = 0;
        for (let j = 0; j < 8 && j < nbar; j++) {
          // Round to nearest bit
          const bit = this.NoiseSampling.round(muPrime[i][j], q, 2);
          sharedSecret[i] |= (bit << j);
        }
      }
      
      return sharedSecret;
    },

    // Universal Cipher Framework Interface
    KeySetup: function(key) {
      // Extract n from key data
      if (Array.isArray(key) && key.length >= 2) {
        const n = OpCodes.Pack16BE(key[0], key[1]);
        return this.Init(n);
      } else if (typeof key === 'string') {
        const n = parseInt(key) || 640;
        return this.Init(n);
      } else if (typeof key === 'number') {
        return this.Init(key);
      }
      return this.Init(640); // Default to FrodoKEM-640
    },
    
    EncryptBlock: function(blockIndex, data) {
      // Generate keys if not present
      if (!this.publicKey || !this.privateKey) {
        const keyPair = this.KeyGeneration();
        this.publicKey = keyPair.publicKey;
        this.privateKey = keyPair.privateKey;
      }
      
      const result = this.Encapsulate(this.publicKey);
      // Flatten matrices for return
      return [result.ciphertext.C1.flat(), result.ciphertext.C2.flat()].flat();
    },
    
    DecryptBlock: function(blockIndex, data) {
      // Ensure keys are available
      if (!this.privateKey) {
        throw new Error('FrodoKEM private key not available for decapsulation');
      }
      
      const params = this.currentParams;
      const { n, nbar, m } = params;
      
      // Reconstruct matrices from flattened data
      const c1Size = m * n;
      const c2Size = m * nbar;
      
      const C1 = this.Matrix.create(m, n);
      const C2 = this.Matrix.create(m, nbar);
      
      let index = 0;
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          C1[i][j] = data[index++] || 0;
        }
      }
      
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < nbar; j++) {
          C2[i][j] = data[index++] || 0;
        }
      }
      
      return this.Decapsulate(this.privateKey, { C1: C1, C2: C2 });
    },
    
    ClearData: function() {
      // Securely clear sensitive data using OpCodes
      if (this.privateKey) {
        if (this.privateKey.S) {
          this.privateKey.S.forEach(row => OpCodes.ClearArray(row));
        }
        if (this.privateKey.A) {
          this.privateKey.A.forEach(row => OpCodes.ClearArray(row));
        }
      }
      if (this.publicKey) {
        if (this.publicKey.A) {
          this.publicKey.A.forEach(row => OpCodes.ClearArray(row));
        }
        if (this.publicKey.B) {
          this.publicKey.B.forEach(row => OpCodes.ClearArray(row));
        }
      }
      
      this.currentParams = null;
      this.currentN = 640;
      this.publicKey = null;
      this.privateKey = null;
    }

  };
  
  // Auto-register with universal Cipher system
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(FrodoKEM);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FrodoKEM;
  }
  
  // Global export
  global.FrodoKEM = FrodoKEM;
  
})(typeof global !== 'undefined' ? global : window);