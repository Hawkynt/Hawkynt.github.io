/*
 * ML-KEM Implementation - Module Lattice-Based Key Encapsulation Mechanism
 * NIST Post-Quantum Cryptography Standard (FIPS 203)
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const ML_KEM = {
    name: "ML-KEM",
    description: "Module Lattice-Based Key Encapsulation Mechanism standardized by NIST for post-quantum cryptography. Provides security against both classical and quantum attacks through the hardness of lattice problems.",
    inventor: "CRYSTALS-Kyber Team (Bos, Ducas, Kiltz, Lepoint, Lyubashevsky, Schwabe, Seiler, Stehlé)",
    year: 2024,
    country: "Multi-national",
    category: "pqc",
    subCategory: "Key Encapsulation",
    securityStatus: "standard",
    securityNotes: "NIST FIPS 203 standard for post-quantum key encapsulation. Designed to resist attacks from large-scale quantum computers while maintaining practical performance.",
    
    documentation: [
      {text: "FIPS 203", uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.203.pdf"},
      {text: "CRYSTALS-Kyber", uri: "https://pq-crystals.org/kyber/"},
      {text: "NIST PQC Standardization", uri: "https://csrc.nist.gov/Projects/post-quantum-cryptography"}
    ],
    
    references: [
      {text: "Reference Implementation", uri: "https://github.com/pq-crystals/kyber"},
      {text: "Security Analysis", uri: "https://eprint.iacr.org/2017/634"},
      {text: "NIST Evaluation", uri: "https://csrc.nist.gov/CSRC/media/Events/Third-PQC-Standardization-Conference/documents/accepted-papers/bos-crystals-kyber-third-pqc-standardization-conference.pdf"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Implementation Attacks",
        text: "Side-channel vulnerabilities in some implementations",
        mitigation: "Use constant-time implementations with masking countermeasures"
      },
      {
        type: "Quantum Attacks",
        text: "Designed to resist quantum attacks but analysis ongoing",
        mitigation: "Monitor latest cryptanalysis research and NIST guidance"
      }
    ],
    
    tests: [
      {
        text: "ML-KEM-512 Test Vector 1",
        uri: "NIST FIPS 203",
        securityLevel: 512,
        publicKeySize: 800,
        privateKeySize: 1632,
        ciphertextSize: 768,
        sharedSecretSize: 32
      },
      {
        text: "ML-KEM-768 Test Vector 2",
        uri: "NIST FIPS 203",
        securityLevel: 768,
        publicKeySize: 1184,
        privateKeySize: 2400,
        ciphertextSize: 1088,
        sharedSecretSize: 32
      },
      {
        text: "ML-KEM-1024 Test Vector 3",
        uri: "NIST FIPS 203",
        securityLevel: 1024,
        publicKeySize: 1568,
        privateKeySize: 3168,
        ciphertextSize: 1568,
        sharedSecretSize: 32
      }
    ],

    // Legacy interface properties
    internalName: 'ml-kem',
    minKeyLength: 32,
    maxKeyLength: 32,
    stepKeyLength: 1,
    minBlockSize: 32,
    maxBlockSize: 32,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: 32,
    blockSize: 32,
    
    // Algorithm metadata
    isStreamCipher: false,
    isBlockCipher: false,
    isKEM: true,
    isPostQuantum: true,
    complexity: 'Very High',
    family: 'Lattice-Based',
    category: 'Post-Quantum-KEM',
    
    // ML-KEM parameters for different security levels
    PARAMETERS: {
      512: {
        k: 2,        // module dimension
        n: 256,      // polynomial degree
        q: 3329,     // modulus
        eta1: 3,     // noise parameter
        eta2: 2,     // noise parameter
        du: 10,      // compression parameter
        dv: 4,       // compression parameter
        pkSize: 800,
        skSize: 1632,
        ctSize: 768
      },
      768: {
        k: 3,
        n: 256,
        q: 3329,
        eta1: 2,
        eta2: 2,
        du: 10,
        dv: 4,
        pkSize: 1184,
        skSize: 2400,
        ctSize: 1088
      },
      1024: {
        k: 4,
        n: 256,
        q: 3329,
        eta1: 2,
        eta2: 2,
        du: 11,
        dv: 5,
        pkSize: 1568,
        skSize: 3168,
        ctSize: 1568
      }
    },
    
    // Current configuration
    securityLevel: 768,
    params: null,
    keyScheduled: false,
    
    // Initialize ML-KEM
    Init: function() {
      this.securityLevel = 768;
      this.params = this.PARAMETERS[768];
      this.keyScheduled = false;
      return true;
    },
    
    // Parameter setup
    KeySetup: function(key, options) {
      if (options && options.securityLevel) {
        if (!this.PARAMETERS[options.securityLevel]) {
          throw new Error('Unsupported security level. Use 512, 768, or 1024.');
        }
        this.securityLevel = options.securityLevel;
        this.params = this.PARAMETERS[options.securityLevel];
      }
      
      this.keyScheduled = true;
      return 'ml-kem-' + this.securityLevel + '-' + Math.random().toString(36).substr(2, 9);
    },
    
    // Educational polynomial arithmetic operations
    
    // Modular reduction
    modReduce: function(x) {
      return ((x % this.params.q) + this.params.q) % this.params.q;
    },
    
    // Polynomial addition
    polyAdd: function(a, b) {
      const result = new Array(this.params.n);
      for (let i = 0; i < this.params.n; i++) {
        result[i] = this.modReduce(a[i] + b[i]);
      }
      return result;
    },
    
    // Polynomial subtraction
    polySub: function(a, b) {
      const result = new Array(this.params.n);
      for (let i = 0; i < this.params.n; i++) {
        result[i] = this.modReduce(a[i] - b[i]);
      }
      return result;
    },
    
    // Simplified polynomial multiplication (educational)
    polyMul: function(a, b) {
      const result = new Array(this.params.n).fill(0);
      
      // Simplified multiplication for educational purposes
      for (let i = 0; i < this.params.n; i++) {
        for (let j = 0; j < this.params.n; j++) {
          const index = (i + j) % this.params.n;
          const sign = Math.floor((i + j) / this.params.n) % 2 === 0 ? 1 : -1;
          result[index] = this.modReduce(result[index] + sign * a[i] * b[j]);
        }
      }
      
      return result;
    },
    
    // Number Theoretic Transform (simplified educational version)
    ntt: function(poly) {
      // Simplified NTT for educational purposes
      // Production implementations use optimized NTT algorithms
      const result = OpCodes.CopyArray(poly);
      
      for (let len = 2; len <= this.params.n; len *= 2) {
        for (let start = 0; start < this.params.n; start += len) {
          for (let i = 0; i < len / 2; i++) {
            const u = result[start + i];
            const v = result[start + i + len / 2];
            result[start + i] = this.modReduce(u + v);
            result[start + i + len / 2] = this.modReduce(u - v);
          }
        }
      }
      
      return result;
    },
    
    // Inverse Number Theoretic Transform
    invNtt: function(poly) {
      // Simplified inverse NTT
      const result = OpCodes.CopyArray(poly);
      
      for (let len = this.params.n; len >= 2; len /= 2) {
        for (let start = 0; start < this.params.n; start += len) {
          for (let i = 0; i < len / 2; i++) {
            const u = result[start + i];
            const v = result[start + i + len / 2];
            result[start + i] = this.modReduce(u + v);
            result[start + i + len / 2] = this.modReduce(u - v);
          }
        }
      }
      
      // Scale by inverse of n
      const nInv = this.modInverse(this.params.n);
      for (let i = 0; i < this.params.n; i++) {
        result[i] = this.modReduce(result[i] * nInv);
      }
      
      return result;
    },
    
    // Modular inverse (simplified)
    modInverse: function(a) {
      // Extended Euclidean algorithm (simplified)
      for (let i = 1; i < this.params.q; i++) {
        if (this.modReduce(a * i) === 1) {
          return i;
        }
      }
      return 1;
    },
    
    // Sample from binomial distribution
    sampleBinomial: function(eta, randomness, offset) {
      const poly = new Array(this.params.n);
      
      for (let i = 0; i < this.params.n; i++) {
        let sum = 0;
        
        // Sample eta bits for positive contribution
        for (let j = 0; j < eta; j++) {
          const byteIndex = Math.floor((offset + i * eta * 2 + j) / 8);
          const bitIndex = (offset + i * eta * 2 + j) % 8;
          if (randomness[byteIndex] && (randomness[byteIndex] & (1 << bitIndex))) {
            sum++;
          }
        }
        
        // Sample eta bits for negative contribution
        for (let j = 0; j < eta; j++) {
          const byteIndex = Math.floor((offset + i * eta * 2 + eta + j) / 8);
          const bitIndex = (offset + i * eta * 2 + eta + j) % 8;
          if (randomness[byteIndex] && (randomness[byteIndex] & (1 << bitIndex))) {
            sum--;
          }
        }
        
        poly[i] = this.modReduce(sum);
      }
      
      return poly;
    },
    
    // Compress coefficient
    compress: function(x, d) {
      return Math.floor((x * (1 << d) + this.params.q / 2) / this.params.q) & ((1 << d) - 1);
    },
    
    // Decompress coefficient
    decompress: function(x, d) {
      return Math.floor((x * this.params.q + (1 << (d - 1))) / (1 << d));
    },
    
    // Generate matrix A from seed
    generateMatrix: function(seed) {
      // Simplified matrix generation for educational purposes
      const A = [];
      
      for (let i = 0; i < this.params.k; i++) {
        A[i] = [];
        for (let j = 0; j < this.params.k; j++) {
          const poly = new Array(this.params.n);
          
          // Generate polynomial coefficients from seed
          for (let coeff = 0; coeff < this.params.n; coeff++) {
            const input = [...seed, i, j, coeff];
            const hash = OpCodes.SHA256Simple(input);
            poly[coeff] = this.modReduce(OpCodes.Pack32LE(hash[0], hash[1], hash[2], hash[3]));
          }
          
          A[i][j] = poly;
        }
      }
      
      return A;
    },
    
    // Matrix-vector multiplication
    matrixVectorMul: function(matrix, vector) {
      const result = [];
      
      for (let i = 0; i < this.params.k; i++) {
        let sum = new Array(this.params.n).fill(0);
        
        for (let j = 0; j < this.params.k; j++) {
          const product = this.polyMul(matrix[i][j], vector[j]);
          sum = this.polyAdd(sum, product);
        }
        
        result.push(sum);
      }
      
      return result;
    },
    
    // Key generation
    generateKeyPair: function(randomness) {
      randomness = randomness || OpCodes.GetRandomBytes(64);
      
      // Extract seeds
      const rho = randomness.slice(0, 32);
      const sigma = randomness.slice(32, 64);
      
      // Generate matrix A
      const A = this.generateMatrix(rho);
      
      // Sample secret vector s
      const s = [];
      for (let i = 0; i < this.params.k; i++) {
        s.push(this.sampleBinomial(this.params.eta1, sigma, i * 64));
      }
      
      // Sample error vector e
      const e = [];
      for (let i = 0; i < this.params.k; i++) {
        e.push(this.sampleBinomial(this.params.eta1, sigma, (this.params.k + i) * 64));
      }
      
      // Compute t = As + e
      const As = this.matrixVectorMul(A, s);
      const t = [];
      for (let i = 0; i < this.params.k; i++) {
        t.push(this.polyAdd(As[i], e[i]));
      }
      
      // Encode public key
      const publicKey = this.encodePublicKey(t, rho);
      
      // Encode private key
      const privateKey = this.encodePrivateKey(s, publicKey);
      
      return {
        publicKey: publicKey,
        privateKey: privateKey
      };
    },
    
    // Encode public key
    encodePublicKey: function(t, rho) {
      const encoded = [];
      
      // Encode polynomial vector t
      for (let i = 0; i < this.params.k; i++) {
        for (let j = 0; j < this.params.n; j++) {
          const compressed = this.compress(t[i][j], 12);
          encoded.push(compressed & 0xFF);
          encoded.push((compressed >> 8) & 0xFF);
        }
      }
      
      // Append seed rho
      encoded.push(...rho);
      
      return encoded;
    },
    
    // Encode private key
    encodePrivateKey: function(s, publicKey) {
      const encoded = [];
      
      // Encode polynomial vector s
      for (let i = 0; i < this.params.k; i++) {
        for (let j = 0; j < this.params.n; j++) {
          encoded.push(s[i][j] & 0xFF);
        }
      }
      
      // Append public key
      encoded.push(...publicKey);
      
      // Append hash of public key
      const pkHash = OpCodes.SHA256Simple(publicKey);
      encoded.push(...pkHash);
      
      return encoded;
    },
    
    // Encapsulation
    encapsulate: function(publicKey, randomness) {
      randomness = randomness || OpCodes.GetRandomBytes(32);
      
      // Hash randomness
      const m = OpCodes.SHA256Simple(randomness);
      
      // Hash public key
      const pkHash = OpCodes.SHA256Simple(publicKey);
      
      // Derive randomness for encryption
      const Kr = OpCodes.SHA256Simple([...m, ...pkHash]);
      const coins = Kr.slice(0, 32);
      
      // Encrypt
      const ciphertext = this.encrypt(publicKey, m, coins);
      
      // Derive shared secret
      const sharedSecret = OpCodes.SHA256Simple([...Kr, ...OpCodes.SHA256Simple(ciphertext)]);
      
      return {
        ciphertext: ciphertext,
        sharedSecret: sharedSecret
      };
    },
    
    // Decapsulation
    decapsulate: function(privateKey, ciphertext) {
      // Decrypt
      const m = this.decrypt(privateKey, ciphertext);
      
      // Extract public key from private key
      const publicKey = privateKey.slice(this.params.k * this.params.n, -32);
      
      // Hash public key
      const pkHash = OpCodes.SHA256Simple(publicKey);
      
      // Derive randomness
      const Kr = OpCodes.SHA256Simple([...m, ...pkHash]);
      const coins = Kr.slice(0, 32);
      
      // Re-encrypt to verify
      const ciphertext2 = this.encrypt(publicKey, m, coins);
      
      // Check if ciphertexts match
      if (OpCodes.SecureCompare(ciphertext, ciphertext2)) {
        // Derive shared secret
        const sharedSecret = OpCodes.SHA256Simple([...Kr, ...OpCodes.SHA256Simple(ciphertext)]);
        return sharedSecret;
      } else {
        // Implicit rejection
        const z = privateKey.slice(-32);
        const sharedSecret = OpCodes.SHA256Simple([...z, ...OpCodes.SHA256Simple(ciphertext)]);
        return sharedSecret;
      }
    },
    
    // Encryption (simplified)
    encrypt: function(publicKey, message, randomness) {
      // This is a simplified educational implementation
      // Production code would implement full Kyber encryption
      
      const ciphertext = [];
      
      // Simulate encryption by combining message with randomness
      for (let i = 0; i < 32; i++) {
        ciphertext.push(message[i] ^ randomness[i % randomness.length]);
      }
      
      // Pad to expected ciphertext size
      while (ciphertext.length < this.params.ctSize) {
        ciphertext.push(randomness[ciphertext.length % randomness.length]);
      }
      
      return ciphertext.slice(0, this.params.ctSize);
    },
    
    // Decryption (simplified)
    decrypt: function(privateKey, ciphertext) {
      // This is a simplified educational implementation
      // Production code would implement full Kyber decryption
      
      const message = new Array(32);
      const s = privateKey.slice(0, this.params.k * this.params.n);
      
      // Simulate decryption
      for (let i = 0; i < 32; i++) {
        message[i] = ciphertext[i] ^ s[i % s.length];
      }
      
      return message;
    },
    
    // Legacy cipher interface
    szEncryptBlock: function(blockIndex, plaintext) {
      if (!this.keyScheduled) {
        throw new Error('Parameters not set up');
      }
      
      // Generate key pair
      const keyPair = this.generateKeyPair();
      
      // Encapsulate
      const result = this.encapsulate(keyPair.publicKey);
      
      // XOR plaintext with shared secret
      const ciphertext = [];
      for (let i = 0; i < plaintext.length; i++) {
        ciphertext.push(plaintext[i] ^ result.sharedSecret[i % result.sharedSecret.length]);
      }
      
      return ciphertext;
    },
    
    szDecryptBlock: function(blockIndex, ciphertext) {
      throw new Error('ML-KEM decryption requires both private key and ciphertext from encapsulation');
    },
    
    ClearData: function() {
      this.keyScheduled = false;
    },
    
    // Test vector runner
    runTestVector: function() {
      console.log('Running ML-KEM test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          this.Init();
          this.KeySetup(null, {securityLevel: test.securityLevel});
          
          // Generate key pair
          const keyPair = this.generateKeyPair();
          
          console.log(`Test ${i + 1} - Security Level: ${test.securityLevel}`);
          console.log('Public key size:', keyPair.publicKey.length, 'bytes (expected:', test.publicKeySize, ')');
          console.log('Private key size:', keyPair.privateKey.length, 'bytes (expected:', test.privateKeySize, ')');
          
          // Test encapsulation/decapsulation
          const encapResult = this.encapsulate(keyPair.publicKey);
          console.log('Ciphertext size:', encapResult.ciphertext.length, 'bytes (expected:', test.ciphertextSize, ')');
          console.log('Shared secret size:', encapResult.sharedSecret.length, 'bytes (expected:', test.sharedSecretSize, ')');
          
          const decapSecret = this.decapsulate(keyPair.privateKey, encapResult.ciphertext);
          const secretsMatch = OpCodes.SecureCompare(encapResult.sharedSecret, decapSecret);
          
          if (secretsMatch) {
            console.log(`Test ${i + 1}: PASS (key exchange successful)`);
          } else {
            console.log(`Test ${i + 1}: FAIL (shared secrets don't match)`);
            allPassed = false;
          }
          
        } catch (error) {
          console.log(`Test ${i + 1}: ERROR - ${error.message}`);
          allPassed = false;
        }
      }
      
      // Demonstrate post-quantum cryptography
      console.log('\nML-KEM Post-Quantum Cryptography Demonstration:');
      this.Init();
      this.KeySetup(null, {securityLevel: 768});
      
      const keyPair = this.generateKeyPair();
      console.log('Generated ML-KEM-768 key pair');
      console.log('Public key:', OpCodes.BytesToHex8(keyPair.publicKey.slice(0, 32)), '...');
      console.log('Private key:', OpCodes.BytesToHex8(keyPair.privateKey.slice(0, 32)), '...');
      
      const encapResult = this.encapsulate(keyPair.publicKey);
      console.log('Encapsulated shared secret');
      console.log('Ciphertext:', OpCodes.BytesToHex8(encapResult.ciphertext.slice(0, 32)), '...');
      console.log('Shared secret:', OpCodes.BytesToHex8(encapResult.sharedSecret));
      
      const decapSecret = this.decapsulate(keyPair.privateKey, encapResult.ciphertext);
      const demoSuccess = OpCodes.SecureCompare(encapResult.sharedSecret, decapSecret);
      console.log('Decapsulated shared secret:', OpCodes.BytesToHex8(decapSecret));
      console.log('Key exchange test:', demoSuccess ? 'PASS' : 'FAIL');
      
      return {
        algorithm: 'ML-KEM',
        securityLevel: this.securityLevel,
        allTestsPassed: allPassed && demoSuccess,
        testCount: this.tests.length,
        publicKeySize: this.params.pkSize,
        privateKeySize: this.params.skSize,
        ciphertextSize: this.params.ctSize,
        notes: 'NIST FIPS 203 post-quantum key encapsulation mechanism'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(ML_KEM);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ML_KEM;
  }
  
  // Global export
  global.ML_KEM = ML_KEM;
  
})(typeof global !== 'undefined' ? global : window);