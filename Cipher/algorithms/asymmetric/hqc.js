/*
 * HQC Implementation
 * Hamming Quasi-Cyclic Key Encapsulation Mechanism
 * Compatible with Universal Cipher Framework
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }

  // HQC parameter sets (NIST Round 4 alternate candidate)
  const HQC_PARAMS = {
    'hqc-128': {
      n: 17669, k: 256, delta: 57, w: 66, wr: 75,
      pkBytes: 2249, skBytes: 2289, ctBytes: 4481, ssBytes: 64,
      security: 'NIST Level 1 (128-bit)',
      nistLevel: 1
    },
    'hqc-192': {
      n: 35851, k: 512, delta: 119, w: 133, wr: 149,
      pkBytes: 4562, skBytes: 4618, ctBytes: 9026, ssBytes: 64,
      security: 'NIST Level 3 (192-bit)',
      nistLevel: 3
    },
    'hqc-256': {
      n: 57637, k: 256, delta: 151, w: 197, wr: 220,
      pkBytes: 7317, skBytes: 7373, ctBytes: 14477, ssBytes: 64,
      security: 'NIST Level 5 (256-bit)',
      nistLevel: 5
    }
  };
  
  const HQC = {
    name: "HQC",
    description: "Hamming Quasi-Cyclic Key Encapsulation Mechanism. Code-based post-quantum cryptography using rank syndrome decoding and quasi-cyclic codes. Educational implementation of NIST PQC alternate candidate.",
    inventor: "Carlos Aguilar Melchor, Nicolas Aragon, Slim Bettaieb, Loïc Bidoux, Olivier Blazy, Jean-Christophe Deneuville, Philippe Gaborit, Edoardo Persichetti, Gilles Zémor",
    year: 2017,
    country: "FR",
    category: "cipher",
    subCategory: "Code-Based Post-Quantum KEM",
    securityStatus: "educational",
    securityNotes: "Educational quasi-cyclic code implementation. Real HQC requires proper rank syndrome decoding and Hamming code construction.",

    documentation: [
      {text: "HQC Official Site", uri: "http://pqc-hqc.org/"},
      {text: "NIST PQC Round 4 HQC Submission", uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip"},
      {text: "Rank Syndrome Decoding Paper", uri: "https://eprint.iacr.org/2016/1194"},
      {text: "Code-Based Cryptography Survey", uri: "https://eprint.iacr.org/2016/1174"}
    ],
    
    references: [
      {text: "HQC Reference Implementation", uri: "https://github.com/SWilson4/package-hqc"},
      {text: "NIST PQC Competition", uri: "https://csrc.nist.gov/projects/post-quantum-cryptography"},
      {text: "Quasi-Cyclic Codes", uri: "https://en.wikipedia.org/wiki/Cyclic_code"},
      {text: "Hamming Codes", uri: "https://en.wikipedia.org/wiki/Hamming_code"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Structural Attacks",
        text: "Potential vulnerability to attacks exploiting quasi-cyclic structure",
        mitigation: "Use conservative parameters and hybrid security approaches"
      },
      {
        type: "Rank Syndrome Decoding",
        text: "Security relies on hardness of rank syndrome decoding problem",
        mitigation: "Ensure sufficient rank and syndrome dimensions"
      }
    ],

    tests: [
      {
        text: "HQC-128 Educational Test Vector",
        uri: "Educational implementation - based on NIST Round 4 parameters",
        input: OpCodes.Hex8ToBytes("48514320717561736920637963"), // "HQC quasi cyc"
        key: OpCodes.Hex8ToBytes("0080"), // 128 security level
        expected: null // Educational - computed during execution
      },
      {
        text: "HQC Official Test Vector Reference",
        uri: "http://pqc-hqc.org/",
        input: OpCodes.Hex8ToBytes("48616D6D696E6720636F64657320746573"), // "Hamming codes tes"
        key: OpCodes.Hex8ToBytes("00C0"), // 192 security level
        expected: null // Reference only
      }
    ],

    // Legacy compatibility properties
    internalName: 'hqc',
    minKeyLength: 32,
    maxKeyLength: 128,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: [128, 192, 256],
    blockSize: 64,
    isStreamCipher: false,
    isBlockCipher: false,
    isPostQuantum: true,
    isKEM: true,
    complexity: 'Expert',
    family: 'Post-Quantum',
    
    // Current parameter set
    currentParams: null,
    currentSecurityLevel: 128,

    // Initialize HQC with specified security level
    Init: function(securityLevel) {
      let paramName;
      if (securityLevel === 128) paramName = 'hqc-128';
      else if (securityLevel === 192) paramName = 'hqc-192';
      else if (securityLevel === 256) paramName = 'hqc-256';
      else paramName = 'hqc-128'; // Default
      
      if (!HQC_PARAMS[paramName]) {
        throw new Error('Invalid HQC security level. Use 128, 192, or 256.');
      }
      
      this.currentParams = HQC_PARAMS[paramName];
      this.currentSecurityLevel = securityLevel;
      
      return true;
    },


    // Quasi-cyclic operations
    QuasiCyclic: {
      // Rotate vector cyclically
      rotate: function(vector, positions) {
        const n = vector.length;
        const rotated = new Array(n);
        for (let i = 0; i < n; i++) {
          rotated[i] = vector[(i - positions + n) % n];
        }
        return rotated;
      },
      
      // XOR two vectors
      xor: function(a, b) {
        const result = new Array(a.length);
        for (let i = 0; i < a.length; i++) {
          result[i] = a[i] ^ b[i];
        }
        return result;
      },
      
      // Generate random vector with specified weight
      generateRandomVector: function(n, weight) {
        const vector = new Array(n);
        OpCodes.ClearArray(vector);
        
        let placed = 0;
        while (placed < weight) {
          const pos = Math.floor(Math.random() * n);
          if (vector[pos] === 0) {
            vector[pos] = 1;
            placed++;
          }
        }
        
        return vector;
      },
      
      // Compute Hamming weight
      hammingWeight: function(vector) {
        let weight = 0;
        for (let i = 0; i < vector.length; i++) {
          if (vector[i]) weight++;
        }
        return weight;
      }
    },

    // Rank syndrome decoding (educational simplified version)
    RankSyndromeDecoding: {
      // Generate parity check matrix
      generateParityCheckMatrix: function(n, k, delta) {
        const H = new Array(n - k);
        for (let i = 0; i < n - k; i++) {
          H[i] = new Array(n);
          OpCodes.ClearArray(H[i]);
          
          // Simplified quasi-cyclic structure
          for (let j = 0; j < n; j++) {
            H[i][j] = (i + j * delta) % 2;
          }
        }
        return H;
      },
      
      // Compute syndrome s = H * c^T
      computeSyndrome: function(H, codeword) {
        const syndrome = new Array(H.length);
        OpCodes.ClearArray(syndrome);
        
        for (let i = 0; i < H.length; i++) {
          for (let j = 0; j < codeword.length; j++) {
            syndrome[i] ^= H[i][j] * codeword[j];
          }
        }
        
        return syndrome;
      },
      
      // Simplified error correction
      correctErrors: function(received, H, expectedWeight) {
        const corrected = received.slice();
        const syndrome = this.computeSyndrome(H, received);
        
        // Educational error correction (not cryptographically correct)
        let errorPositions = 0;
        for (let i = 0; i < syndrome.length && errorPositions < expectedWeight; i++) {
          if (syndrome[i]) {
            const errorPos = i % received.length;
            corrected[errorPos] ^= 1;
            errorPositions++;
          }
        }
        
        return corrected;
      }
    },

    // Key generation (educational simplified version)
    KeyGeneration: function() {
      if (!this.currentParams) {
        throw new Error('HQC not initialized. Call Init() first.');
      }
      
      const params = this.currentParams;
      const { n, k, delta, w } = params;
      
      // Generate private key vectors
      const x = this.QuasiCyclic.generateRandomVector(n, w);
      const y = this.QuasiCyclic.generateRandomVector(n, w);
      
      // Generate parity check matrix
      const H = this.RankSyndromeDecoding.generateParityCheckMatrix(n, k, delta);
      
      // Generate public key h (simplified)
      const h = new Array(n);
      for (let i = 0; i < n; i++) {
        h[i] = (x[i] + y[i] * delta) % 2;
      }
      
      const privateKey = {
        x: x,
        y: y,
        H: H,
        params: params
      };
      
      const publicKey = {
        h: h,
        H: H,
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
        throw new Error('HQC not initialized. Call Init() first.');
      }
      
      const params = this.currentParams;
      const { n, k, wr } = params;
      
      // Generate random shared secret
      const sharedSecret = new Array(64);
      for (let i = 0; i < 64; i++) {
        sharedSecret[i] = Math.floor(Math.random() * 256);
      }
      
      // Convert shared secret to message vector
      const m = new Array(k);
      for (let i = 0; i < k; i++) {
        m[i] = sharedSecret[i % 64] & 1;
      }
      
      // Generate random error vectors
      const e = this.QuasiCyclic.generateRandomVector(n, wr);
      const r1 = this.QuasiCyclic.generateRandomVector(n, wr);
      const r2 = this.QuasiCyclic.generateRandomVector(n, wr);
      
      // Compute ciphertext components
      // u = r1 * G + e (simplified)
      const u = new Array(n);
      for (let i = 0; i < n; i++) {
        u[i] = (r1[i] + e[i]) % 2;
      }
      
      // v = m + r2 * h (simplified)
      const v = new Array(n);
      for (let i = 0; i < n; i++) {
        const mBit = i < k ? m[i] : 0;
        v[i] = (mBit + r2[i] * publicKey.h[i]) % 2;
      }
      
      return {
        ciphertext: { u: u, v: v },
        sharedSecret: sharedSecret
      };
    },
    
    // Decapsulation
    Decapsulate: function(privateKey, ciphertext) {
      if (!this.currentParams) {
        throw new Error('HQC not initialized. Call Init() first.');
      }
      
      const params = this.currentParams;
      const { n, k, wr } = params;
      const { u, v } = ciphertext;
      
      // Decode using rank syndrome decoding
      const correctedU = this.RankSyndromeDecoding.correctErrors(
        u, privateKey.H, wr
      );
      
      // Extract message (simplified)
      const message = new Array(k);
      for (let i = 0; i < k; i++) {
        message[i] = v[i] ^ (correctedU[i] * privateKey.x[i]);
      }
      
      // Convert message back to shared secret
      const sharedSecret = new Array(64);
      for (let i = 0; i < 64; i++) {
        sharedSecret[i] = 0;
        for (let j = 0; j < 8 && i * 8 + j < k; j++) {
          sharedSecret[i] |= (message[i * 8 + j] << j);
        }
      }
      
      return sharedSecret;
    },

    // Universal Cipher Framework Interface
    KeySetup: function(key) {
      // Extract security level from key data
      if (Array.isArray(key) && key.length >= 2) {
        const securityLevel = OpCodes.Pack16BE(key[0], key[1]);
        return this.Init(securityLevel);
      } else if (typeof key === 'string') {
        const securityLevel = parseInt(key) || 128;
        return this.Init(securityLevel);
      } else if (typeof key === 'number') {
        return this.Init(key);
      }
      return this.Init(128); // Default to HQC-128
    },
    
    EncryptBlock: function(blockIndex, data) {
      // Generate keys if not present
      if (!this.publicKey || !this.privateKey) {
        const keyPair = this.KeyGeneration();
        this.publicKey = keyPair.publicKey;
        this.privateKey = keyPair.privateKey;
      }
      
      const result = this.Encapsulate(this.publicKey);
      return [result.ciphertext.u, result.ciphertext.v].flat();
    },
    
    DecryptBlock: function(blockIndex, data) {
      // Ensure keys are available
      if (!this.privateKey) {
        throw new Error('HQC private key not available for decapsulation');
      }
      
      // Split data back into u and v components
      const n = this.currentParams.n;
      const u = data.slice(0, n);
      const v = data.slice(n, 2 * n);
      
      return this.Decapsulate(this.privateKey, { u: u, v: v });
    },
    
    ClearData: function() {
      // Securely clear sensitive data using OpCodes
      if (this.privateKey) {
        if (this.privateKey.x) OpCodes.ClearArray(this.privateKey.x);
        if (this.privateKey.y) OpCodes.ClearArray(this.privateKey.y);
        if (this.privateKey.H) {
          this.privateKey.H.forEach(row => OpCodes.ClearArray(row));
        }
      }
      if (this.publicKey) {
        if (this.publicKey.h) OpCodes.ClearArray(this.publicKey.h);
        if (this.publicKey.H) {
          this.publicKey.H.forEach(row => OpCodes.ClearArray(row));
        }
      }
      
      this.currentParams = null;
      this.currentSecurityLevel = 128;
      this.publicKey = null;
      this.privateKey = null;
    }

  };
  
  // Auto-register with universal Cipher system
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(HQC);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HQC;
  }
  
  // Global export
  global.HQC = HQC;
  
})(typeof global !== 'undefined' ? global : window);