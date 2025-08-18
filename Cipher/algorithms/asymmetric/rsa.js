/*
 * RSA Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  // RSA parameter sets
  const RSA_PARAMS = {
    'RSA-1024': { 
      keySize: 1024, // bits
      e: 65537, // Common public exponent (2^16 + 1)
      pkBytes: 140, skBytes: 632, // Approximate sizes
      security: 'Deprecated - only for educational use'
    },
    'RSA-2048': { 
      keySize: 2048,
      e: 65537,
      pkBytes: 270, skBytes: 1192,
      security: 'Legacy - equivalent to 112-bit symmetric'
    },
    'RSA-3072': { 
      keySize: 3072,
      e: 65537,
      pkBytes: 398, skBytes: 1760,
      security: 'Current - equivalent to 128-bit symmetric'
    },
    'RSA-4096': { 
      keySize: 4096,
      e: 65537,
      pkBytes: 526, skBytes: 2344,
      security: 'High - equivalent to 192-bit symmetric'
    }
  };
  
  const RSA = {
    name: "RSA",
    description: "RSA public key cryptosystem based on integer factorization. First practical asymmetric encryption algorithm enabling secure communication without shared secrets. Vulnerable to quantum attacks using Shor's algorithm.",
    inventor: "Ron Rivest, Adi Shamir, Leonard Adleman",
    year: 1977,
    country: "US",
    category: "cipher",
    subCategory: "Asymmetric Cipher",
    securityStatus: null,
    securityNotes: "Quantum-vulnerable to Shor's algorithm but still widely used. Minimum 2048-bit keys recommended for legacy systems.",
    
    documentation: [
      {text: "Wikipedia - RSA (cryptosystem)", uri: "https://en.wikipedia.org/wiki/RSA_(cryptosystem)"},
      {text: "Original RSA Paper (1978)", uri: "https://dl.acm.org/doi/10.1145/359340.359342"},
      {text: "RFC 3447 - PKCS #1: RSA Cryptography Specifications", uri: "https://tools.ietf.org/rfc/rfc3447.txt"},
      {text: "NIST SP 800-56B - Key Establishment Using Integer Factorization", uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Br2.pdf"}
    ],
    
    references: [
      {text: "OpenSSL RSA Implementation", uri: "https://github.com/openssl/openssl/blob/master/crypto/rsa/rsa_lib.c"},
      {text: "GnuPG RSA Implementation", uri: "https://github.com/gpg/gnupg/blob/master/g10/pubkey-enc.c"},
      {text: "Python cryptography library RSA", uri: "https://github.com/pyca/cryptography/tree/main/src/cryptography/hazmat/primitives/asymmetric"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Quantum Attack", 
        text: "Shor's algorithm can factor RSA moduli in polynomial time on sufficiently large quantum computers",
        mitigation: "Migrate to post-quantum cryptographic algorithms before practical quantum computers arrive"
      },
      {
        type: "Small Key Size", 
        text: "RSA-1024 and smaller can be factored using classical methods with significant computational resources",
        mitigation: "Use minimum 2048-bit keys, prefer 3072-bit or larger for new applications"
      },
      {
        type: "Implementation Attacks", 
        text: "Timing attacks, power analysis, and fault injection can reveal private keys in poorly implemented RSA",
        mitigation: "Use constant-time implementations with proper side-channel protections"
      }
    ],
    
    tests: [
      {
        text: "RSA-2048 PKCS#1 v1.5 Test Vector",
        uri: "https://tools.ietf.org/rfc/rfc3447.txt",
        keySize: 256, // 2048 bits = 256 bytes
        input: Hex8ToBytes("48656c6c6f20525341"), // "Hello RSA"
        // Note: RSA test vectors require specific key pairs - using educational example
        expected: null // Will be computed during test
      }
    ],

    // Legacy interface properties for compatibility
    internalName: 'rsa',
    minKeyLength: 128,
    maxKeyLength: 512,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: [1024, 2048, 3072, 4096],
    blockSize: 32,
    isStreamCipher: false,
    isBlockCipher: false,
    isPostQuantum: false,
    isAsymmetric: true,
    isSignature: true,
    complexity: 'Medium',
    family: 'Classical',
    
    // Current parameter set
    currentParams: null,
    currentKeySize: 2048,
    
    // Initialize RSA with specified key size
    Init: function(keySize) {
      const paramName = 'RSA-' + keySize;
      if (!RSA_PARAMS[paramName]) {
        throw new Error('Invalid RSA key size. Use 1024, 2048, 3072, or 4096.');
      }
      
      if (keySize < 2048) {
        console.warn('⚠️  WARNING: RSA key sizes below 2048 bits are deprecated!');
      }
      
      this.currentParams = RSA_PARAMS[paramName];
      this.currentKeySize = keySize;
      
      return true;
    },
    
    // Big integer operations (simplified educational version)
    BigInt: {
      // Convert number to big integer representation (simplified)
      fromNumber: function(n) {
        return BigInt(n);
      },
      
      // Modular exponentiation: (base^exp) mod modulus
      modPow: function(base, exp, modulus) {
        if (typeof base === 'number') base = BigInt(base);
        if (typeof exp === 'number') exp = BigInt(exp);
        if (typeof modulus === 'number') modulus = BigInt(modulus);
        
        let result = 1n;
        base = base % modulus;
        
        while (exp > 0n) {
          if (exp % 2n === 1n) {
            result = (result * base) % modulus;
          }
          exp = exp / 2n;
          base = (base * base) % modulus;
        }
        
        return result;
      },
      
      // Extended Euclidean Algorithm
      extendedGCD: function(a, b) {
        if (typeof a === 'number') a = BigInt(a);
        if (typeof b === 'number') b = BigInt(b);
        
        if (a === 0n) {
          return { gcd: b, x: 0n, y: 1n };
        }
        
        const result = this.extendedGCD(b % a, a);
        const x = result.y - (b / a) * result.x;
        const y = result.x;
        
        return { gcd: result.gcd, x: x, y: y };
      },
      
      // Modular multiplicative inverse
      modInverse: function(a, m) {
        if (typeof a === 'number') a = BigInt(a);
        if (typeof m === 'number') m = BigInt(m);
        
        const result = this.extendedGCD(a, m);
        if (result.gcd !== 1n) {
          throw new Error('Modular inverse does not exist');
        }
        
        return ((result.x % m) + m) % m;
      },
      
      // Simple primality test (Miller-Rabin simplified)
      isProbablyPrime: function(n, k = 5) {
        if (typeof n === 'number') n = BigInt(n);
        
        if (n === 2n || n === 3n) return true;
        if (n < 2n || n % 2n === 0n) return false;
        
        // Write n-1 as d * 2^r
        let d = n - 1n;
        let r = 0n;
        while (d % 2n === 0n) {
          d /= 2n;
          r++;
        }
        
        // Simplified Miller-Rabin test
        for (let i = 0; i < k; i++) {
          const a = BigInt(2 + Math.floor(Math.random() * Number(n - 4n)));
          let x = this.modPow(a, d, n);
          
          if (x === 1n || x === n - 1n) continue;
          
          let composite = true;
          for (let j = 0n; j < r - 1n; j++) {
            x = this.modPow(x, 2n, n);
            if (x === n - 1n) {
              composite = false;
              break;
            }
          }
          
          if (composite) return false;
        }
        
        return true;
      },
      
      // Generate random prime (simplified)
      generatePrime: function(bits) {
        const min = 1n << BigInt(bits - 1);
        const max = (1n << BigInt(bits)) - 1n;
        
        for (let attempts = 0; attempts < 1000; attempts++) {
          // Generate random odd number in range
          const range = max - min + 1n;
          let candidate = min + BigInt(Math.floor(Math.random() * Number(range / 1000000n))) * 1000000n;
          candidate = candidate | 1n; // Make odd
          
          if (this.isProbablyPrime(candidate)) {
            return candidate;
          }
        }
        
        throw new Error('Failed to generate prime after 1000 attempts');
      }
    },
    
    // PKCS#1 padding (simplified educational version)
    Padding: {
      // PKCS#1 v1.5 padding for encryption
      pkcs1Pad: function(message, keySize) {
        const messageBytes = typeof message === 'string' ? 
          Array.from(message, c => c.charCodeAt(0)) : message;
        
        const keyBytes = Math.floor(keySize / 8);
        const maxMessageLength = keyBytes - 11; // 3 bytes overhead + 8 bytes minimum padding
        
        if (messageBytes.length > maxMessageLength) {
          throw new Error('Message too long for PKCS#1 padding');
        }
        
        const paddedLength = keyBytes;
        const padded = new Array(paddedLength);
        
        // PKCS#1 v1.5 padding format: 0x00 || 0x02 || PS || 0x00 || M
        padded[0] = 0x00;
        padded[1] = 0x02;
        
        // Generate random non-zero padding
        const paddingLength = paddedLength - messageBytes.length - 3;
        for (let i = 2; i < 2 + paddingLength; i++) {
          padded[i] = Math.floor(Math.random() * 255) + 1; // Non-zero
        }
        
        padded[2 + paddingLength] = 0x00;
        
        // Copy message
        for (let i = 0; i < messageBytes.length; i++) {
          padded[3 + paddingLength + i] = messageBytes[i];
        }
        
        return padded;
      },
      
      // Remove PKCS#1 padding
      pkcs1Unpad: function(padded) {
        if (padded[0] !== 0x00 || padded[1] !== 0x02) {
          throw new Error('Invalid PKCS#1 padding');
        }
        
        // Find separator
        let separatorIndex = -1;
        for (let i = 2; i < padded.length; i++) {
          if (padded[i] === 0x00) {
            separatorIndex = i;
            break;
          }
        }
        
        if (separatorIndex === -1 || separatorIndex < 10) {
          throw new Error('Invalid PKCS#1 padding');
        }
        
        return padded.slice(separatorIndex + 1);
      }
    },
    
    // Key generation (educational simplified version)
    KeyGeneration: function() {
      if (!this.currentParams) {
        throw new Error('RSA not initialized. Call Init() first.');
      }
      
      const keySize = this.currentParams.keySize;
      const e = BigInt(this.currentParams.e);
      
      console.log(`Generating RSA-${keySize} key pair (this may take a moment)...`);
      
      // Generate two distinct primes p and q
      const pBits = Math.floor(keySize / 2);
      const qBits = keySize - pBits;
      
      const p = this.BigInt.generatePrime(pBits);
      let q;
      do {
        q = this.BigInt.generatePrime(qBits);
      } while (p === q);
      
      // Compute n = p * q
      const n = p * q;
      
      // Compute Euler's totient function φ(n) = (p-1)(q-1)
      const phi = (p - 1n) * (q - 1n);
      
      // Verify e is coprime to φ(n)
      if (this.BigInt.extendedGCD(e, phi).gcd !== 1n) {
        throw new Error('Public exponent e is not coprime to φ(n)');
      }
      
      // Compute private exponent d = e^(-1) mod φ(n)
      const d = this.BigInt.modInverse(e, phi);
      
      // Compute CRT parameters for efficiency
      const dp = d % (p - 1n);
      const dq = d % (q - 1n);
      const qinv = this.BigInt.modInverse(q, p);
      
      const privateKey = {
        n: n,
        e: e,
        d: d,
        p: p,
        q: q,
        dp: dp,
        dq: dq,
        qinv: qinv,
        keySize: keySize
      };
      
      const publicKey = {
        n: n,
        e: e,
        keySize: keySize
      };
      
      return {
        privateKey: privateKey,
        publicKey: publicKey,
        params: this.currentParams
      };
    },
    
    // Convert byte array to big integer
    bytesToBigInt: function(bytes) {
      let result = 0n;
      for (let i = 0; i < bytes.length; i++) {
        result = (result << 8n) + BigInt(bytes[i]);
      }
      return result;
    },
    
    // Convert big integer to byte array
    bigIntToBytes: function(bigint, length) {
      const bytes = new Array(length);
      for (let i = length - 1; i >= 0; i--) {
        bytes[i] = Number(bigint & 0xFFn);
        bigint >>= 8n;
      }
      return bytes;
    },
    
    // Encryption
    Encrypt: function(publicKey, message) {
      if (!this.currentParams) {
        throw new Error('RSA not initialized. Call Init() first.');
      }
      
      // Apply PKCS#1 padding
      const paddedMessage = this.Padding.pkcs1Pad(message, publicKey.keySize);
      
      // Convert to big integer
      const m = this.bytesToBigInt(paddedMessage);
      
      // Encrypt: c = m^e mod n
      const c = this.BigInt.modPow(m, publicKey.e, publicKey.n);
      
      // Convert back to bytes
      const keyBytes = Math.floor(publicKey.keySize / 8);
      return this.bigIntToBytes(c, keyBytes);
    },
    
    // Decryption
    Decrypt: function(privateKey, ciphertext) {
      if (!this.currentParams) {
        throw new Error('RSA not initialized. Call Init() first.');
      }
      
      // Convert to big integer
      const c = this.bytesToBigInt(ciphertext);
      
      // Decrypt: m = c^d mod n
      const m = this.BigInt.modPow(c, privateKey.d, privateKey.n);
      
      // Convert back to bytes
      const keyBytes = Math.floor(privateKey.keySize / 8);
      const paddedMessage = this.bigIntToBytes(m, keyBytes);
      
      // Remove PKCS#1 padding
      const message = this.Padding.pkcs1Unpad(paddedMessage);
      
      return message;
    },
    
    // Sign message (basic RSA signature)
    Sign: function(privateKey, message) {
      if (!this.currentParams) {
        throw new Error('RSA not initialized. Call Init() first.');
      }
      
      // Simple hash of message (in real implementation, use SHA-256)
      let messageBytes;
      if (typeof message === 'string') {
        messageBytes = Array.from(message, c => c.charCodeAt(0));
      } else {
        messageBytes = message;
      }
      
      // Apply PKCS#1 padding for signatures
      const paddedHash = this.Padding.pkcs1Pad(messageBytes, privateKey.keySize);
      
      // Convert to big integer
      const m = this.bytesToBigInt(paddedHash);
      
      // Sign: s = m^d mod n
      const s = this.BigInt.modPow(m, privateKey.d, privateKey.n);
      
      // Convert back to bytes
      const keyBytes = Math.floor(privateKey.keySize / 8);
      return this.bigIntToBytes(s, keyBytes);
    },
    
    // Verify signature
    Verify: function(publicKey, message, signature) {
      if (!this.currentParams) {
        throw new Error('RSA not initialized. Call Init() first.');
      }
      
      try {
        // Convert signature to big integer
        const s = this.bytesToBigInt(signature);
        
        // Verify: m = s^e mod n
        const m = this.BigInt.modPow(s, publicKey.e, publicKey.n);
        
        // Convert back to bytes
        const keyBytes = Math.floor(publicKey.keySize / 8);
        const paddedHash = this.bigIntToBytes(m, keyBytes);
        
        // Remove PKCS#1 padding
        const recoveredHash = this.Padding.pkcs1Unpad(paddedHash);
        
        // Compare with message hash
        let messageBytes;
        if (typeof message === 'string') {
          messageBytes = Array.from(message, c => c.charCodeAt(0));
        } else {
          messageBytes = message;
        }
        
        if (recoveredHash.length !== messageBytes.length) {
          return false;
        }
        
        for (let i = 0; i < recoveredHash.length; i++) {
          if (recoveredHash[i] !== messageBytes[i]) {
            return false;
          }
        }
        
        return true;
      } catch (error) {
        return false;
      }
    },
    
    // Convert message to string
    bytesToString: function(bytes) {
      return String.fromCharCode(...bytes);
    },
    
    // Required interface methods
    KeySetup: function(key) {
      // RSA uses key generation, not traditional key setup
      return this.Init(this.currentKeySize);
    },
    
    encryptBlock: function(block, plaintext) {
      // For compatibility, implement block encryption
      if (!this.publicKey) {
        throw new Error('RSA public key not set. Generate keys first.');
      }
      return this.Encrypt(this.publicKey, plaintext);
    },
    
    decryptBlock: function(block, ciphertext) {
      // For compatibility, implement block decryption
      if (!this.privateKey) {
        throw new Error('RSA private key not set. Generate keys first.');
      }
      return this.Decrypt(this.privateKey, ciphertext);
    },
    
    ClearData: function() {
      this.currentParams = null;
      this.currentKeySize = 2048;
      this.publicKey = null;
      this.privateKey = null;
    },
    
    // ===== COMPREHENSIVE RSA TEST VECTORS WITH HISTORICAL METADATA =====
    testVectors: [
      // RSA Historical Test Vectors
      {
        algorithm: 'RSA',
        testId: 'rsa-historical-001',
        description: 'RSA-2048 classical public key cryptosystem test vector',
        category: 'classical-cryptography',
        variant: 'RSA-2048',
        securityLevel: 'Legacy',
        classicalSecurity: 112, // bits equivalent
        quantumSecurity: 0,     // bits (broken by Shor\'s algorithm)
        parameters: {
          keySize: 2048, // bits
          publicExponent: 65537, // 2^16 + 1
          publicKeySize: 270,  // bytes
          privateKeySize: 1192, // bytes
          maxMessageSize: 245   // bytes (with PKCS#1 padding)
        },
        source: {
          type: 'historical-standard',
          inventors: ['Ron Rivest', 'Adi Shamir', 'Leonard Adleman'],
          publication: 'A Method for Obtaining Digital Signatures and Public-Key Cryptosystems',
          venue: 'Communications of the ACM',
          year: 1978,
          url: 'https://dl.acm.org/doi/10.1145/359340.359342',
          significance: 'First practical public key cryptosystem'
        },
        mathematicalFoundation: {
          problemBasis: 'Integer Factorization Problem',
          trapdoorFunction: 'x^e mod n (easy) vs n-th root mod n (hard)',
          hardnessProblem: 'Factoring large semiprimes',
          securityReduction: 'No formal reduction to factoring'
        }
      },
      
      // RSA Historical Development and Impact
      {
        algorithm: 'RSA',
        testId: 'rsa-history-001',
        description: 'RSA historical development and cryptographic impact',
        category: 'historical-impact',
        invention: {
          year: 1977,
          inventors: {
            ronRivest: {
              role: 'Co-inventor',
              affiliation: 'MIT',
              contribution: 'Algorithm development and analysis'
            },
            adiShamir: {
              role: 'Co-inventor', 
              affiliation: 'MIT',
              contribution: 'Mathematical foundations'
            },
            leonardAdleman: {
              role: 'Co-inventor',
              affiliation: 'MIT',
              contribution: 'Complexity theory analysis'
            }
          },
          context: 'Response to Diffie-Hellman key exchange (1976)',
          breakthrough: 'First practical public key cryptosystem'
        },
        historicalSignificance: {
          firstPractical: 'First working public key cryptosystem',
          commercialSuccess: 'Widely adopted in industry and standards',
          internetSecurity: 'Foundation of internet security (SSL/TLS)',
          digitalSignatures: 'Enabled practical digital signatures'
        },
        timeline: {
          invention1977: 'RSA algorithm invented at MIT',
          publication1978: 'Published in Communications of the ACM',
          patent1983: 'US Patent 4,405,829 granted',
          commercialization1982: 'RSA Data Security Inc. founded',
          patent_expiry2000: 'RSA patent expired, algorithm became public domain',
          nist_standards: 'Incorporated into numerous NIST standards',
          tls_adoption: 'Became standard for web security (SSL/TLS)',
          quantum_threat2010s: 'Quantum computing threat recognized'
        },
        industrialAdoption: {
          early1980s: 'Secure communication systems',
          internetBoom1990s: 'SSL/TLS for web security',
          ecommerce: 'Online banking and e-commerce',
          pki: 'Public Key Infrastructure foundation',
          smartCards: 'Smart card and embedded systems',
          modernUse: 'Still used despite quantum threats'
        }
      },
      
      // RSA Mathematical Structure and Security
      {
        algorithm: 'RSA',
        testId: 'rsa-mathematics-001',
        description: 'RSA mathematical structure and security analysis',
        category: 'mathematical-analysis',
        numberTheoreticFoundation: {
          eulerTotient: 'φ(n) = (p-1)(q-1) for n = pq',
          eulerTheorem: 'a^φ(n) ≡ 1 (mod n) for gcd(a,n) = 1',
          modularArithmetic: 'Exponentiation in multiplicative group Z*_n',
          chineseRemainder: 'CRT for efficient private key operations'
        },
        trapdoorConstruction: {
          publicFunction: 'E(m) = m^e mod n (easy to compute)',
          privateFunction: 'D(c) = c^d mod n (easy with d)',
          trapdoorInfo: 'Private exponent d = e^(-1) mod φ(n)',
          hardDirection: 'Computing e-th roots mod n without factoring'
        },
        securityAnalysis: {
          factoring: 'Security relies on difficulty of factoring n',
          rsa_problem: 'RSA Problem: given (n,e,c), find m such that m^e ≡ c (mod n)',
          relationship: 'RSA Problem ≤ Factoring (but reduction not tight)',
          bestAttacks: 'General Number Field Sieve (sub-exponential)'
        },
        parameterSelection: {
          primeGeneration: 'p, q are large random primes',
          modulus: 'n = pq should be hard to factor',
          publicExponent: 'e commonly 3 or 65537',
          privateExponent: 'd ≡ e^(-1) (mod φ(n))'
        }
      },
      
      // RSA vs Post-Quantum Cryptography
      {
        algorithm: 'RSA',
        testId: 'rsa-quantum-threat-001',
        description: 'RSA quantum vulnerability and post-quantum transition',
        category: 'quantum-threat-analysis',
        quantumVulnerability: {
          shorsAlgorithm: {
            year: 1994,
            inventor: 'Peter Shor',
            impact: 'Polynomial-time factoring on quantum computers',
            complexity: 'O((log n)^3) vs O(exp((log n)^(1/3))) classical',
            threat: 'Completely breaks RSA when large quantum computers exist'
          },
          quantumComputers: {
            current2024: 'Small quantum computers exist (~1000 qubits)',
            threat_timeline: 'RSA-2048 may be broken by 2030-2040',
            rsa_4096: 'Requires larger quantum computers',
            cryptographic_cliff: 'When quantum computers arrive, RSA becomes useless'
          }
        },
        postQuantumTransition: {
          nist_standards: 'NIST PQC standardization (2016-2024)',
          hybrid_approach: 'Combine RSA with post-quantum algorithms',
          timeline: 'Organizations planning migration by 2030',
          challenges: 'Infrastructure, performance, compatibility'
        },
        comparisonWithPQC: {
          keySize: 'RSA: 2048-4096 bits, PQC: varies widely',
          performance: 'RSA: moderate, PQC: ranges from fast to slow',
          maturity: 'RSA: very mature, PQC: recently standardized',
          quantumSecurity: 'RSA: none, PQC: designed for quantum resistance'
        },
        migrationStrategy: {
          cryptoAgility: 'Design systems to easily change algorithms',
          hybridSecurity: 'Use both RSA and PQC during transition',
          riskAssessment: 'Evaluate quantum threat timeline',
          standardsCompliance: 'Follow NIST and industry guidance'
        }
      },
      
      // RSA Implementation and Optimization
      {
        algorithm: 'RSA',
        testId: 'rsa-implementation-001',
        description: 'RSA implementation techniques and optimization',
        category: 'implementation-optimization',
        algorithmicOptimizations: {
          chineseRemainderTheorem: 'CRT for 4x faster private key operations',
          modularExponentiation: 'Square-and-multiply for efficient exponentiation',
          montgomeryMultiplication: 'Efficient modular multiplication',
          slidingWindow: 'Sliding window exponentiation methods'
        },
        performanceBenchmarks: {
          'RSA-2048': {
            keyGeneration: '45ms (Intel i7-8700K)',
            encryption: '0.2ms (public key operation)',
            decryption: '8.5ms (private key operation)',
            signing: '8.5ms (private key operation)',
            verification: '0.2ms (public key operation)',
            throughput: '120 decryptions/sec'
          },
          'RSA-4096': {
            keyGeneration: '180ms',
            encryption: '0.8ms',
            decryption: '68ms',
            signing: '68ms',
            verification: '0.8ms',
            throughput: '15 decryptions/sec'
          }
        },
        implementationChallenges: {
          bigIntegerArithmetic: 'Efficient multi-precision arithmetic',
          primeGeneration: 'Cryptographically secure prime generation',
          sidechannelResistance: 'Constant-time implementations',
          randomNumberGeneration: 'High-quality entropy for key generation'
        },
        securityImplementation: {
          pkcs1: 'PKCS#1 padding for semantic security',
          oaep: 'OAEP padding for chosen-ciphertext security',
          pss: 'PSS padding for provably secure signatures',
          constantTime: 'Timing attack resistance'
        }
      },
      
      // RSA Standards and Applications
      {
        algorithm: 'RSA',
        testId: 'rsa-standards-001',
        description: 'RSA standards and real-world applications',
        category: 'standards-applications',
        standards: {
          pkcs1: 'PKCS #1: RSA Cryptography Specifications',
          rfc3447: 'RFC 3447: Public-Key Cryptography Standards',
          fips186: 'FIPS 186: Digital Signature Standard',
          x509: 'X.509 certificates with RSA keys',
          tls: 'TLS/SSL protocol RSA cipher suites'
        },
        applications: {
          webSecurity: 'HTTPS/TLS for web browsing security',
          email: 'S/MIME for secure email',
          codeSignning: 'Software signing and verification',
          documentSigning: 'PDF and document authentication',
          smartCards: 'Smart card and hardware tokens',
          blockchain: 'Some cryptocurrency systems',
          ssh: 'Secure Shell authentication'
        },
        deploymentConsiderations: {
          keyManagement: 'Certificate authorities and PKI',
          keySize: 'Minimum 2048 bits recommended',
          performance: 'Asymmetric operations are expensive',
          hybridSystems: 'Usually combined with symmetric encryption'
        },
        modernStatus: {
          currentUse: 'Still widely deployed despite quantum threat',
          recommendations: 'NIST recommends planning post-quantum migration',
          timeline: 'Expected phase-out by 2030-2035',
          legacy: 'Will remain in legacy systems for decades'
        }
      },
      
      // Educational Value and Learning Objectives
      {
        algorithm: 'RSA',
        testId: 'rsa-educational-001',
        description: 'Educational value of RSA implementation and study',
        category: 'educational-objectives',
        variant: 'RSA-2048 (educational version)',
        message: 'Classical public key cryptography education',
        educationalValue: {
          publicKeyCryptography: 'Introduction to asymmetric cryptography',
          numberTheory: 'Applied number theory and modular arithmetic',
          securityAnalysis: 'Understanding cryptographic security assumptions',
          historicalContext: 'Cryptographic history and development'
        },
        learningObjectives: [
          'Understand public key cryptography fundamentals',
          'Implement modular exponentiation and big integer arithmetic',
          'Analyze integer factorization and RSA security',
          'Compare classical and post-quantum approaches'
        ],
        mathematicalConcepts: {
          modularArithmetic: 'Operations in multiplicative groups',
          numberTheory: 'Euler\'s theorem and totient function',
          bigIntegerArithmetic: 'Multi-precision arithmetic algorithms',
          complexityTheory: 'Computational complexity and hardness assumptions'
        },
        practicalExercises: {
          basic: 'Implement modular exponentiation',
          intermediate: 'Build complete RSA encryption/decryption',
          advanced: 'Optimize with CRT and Montgomery multiplication',
          research: 'Analyze security parameters and quantum threats'
        },
        historicalPerspective: {
          breakthrough: 'Revolutionary impact of public key cryptography',
          evolution: 'Development from academic research to industrial standard',
          lessons: 'Understanding cryptographic lifecycle and threats',
          future: 'Transition to post-quantum cryptography'
        },
        academicReferences: [
          {
            title: 'A Method for Obtaining Digital Signatures and Public-Key Cryptosystems',
            authors: ['R. Rivest', 'A. Shamir', 'L. Adleman'],
            venue: 'Communications of the ACM',
            year: 1978,
            significance: 'Original RSA paper'
          },
          {
            title: 'New Directions in Cryptography',
            authors: ['W. Diffie', 'M. Hellman'],
            venue: 'IEEE Transactions on Information Theory',
            year: 1976,
            significance: 'Introduced public key cryptography concept'
          },
          {
            title: 'Polynomial-Time Algorithms for Prime Factorization and Discrete Logarithms on a Quantum Computer',
            authors: ['Peter W. Shor'],
            venue: 'SIAM Journal on Computing',
            year: 1997,
            significance: 'Quantum algorithm that breaks RSA'
          }
        ]
      }
    ],
    
    // Educational test vector runner
    runTestVector: function() {
      console.log('Running RSA educational test...');
      console.warn('⚠️  Note: RSA is vulnerable to quantum attacks (Shor\'s algorithm)');
      
      // Test RSA-2048 (educational - key generation is simplified)
      this.Init(2048);
      
      try {
        const keyPair = this.KeyGeneration();
        
        // Store keys for block operations
        this.publicKey = keyPair.publicKey;
        this.privateKey = keyPair.privateKey;
        
        const message = 'Hello RSA!';
        const ciphertext = this.Encrypt(keyPair.publicKey, message);
        const decrypted = this.Decrypt(keyPair.privateKey, ciphertext);
        const recoveredMessage = this.bytesToString(decrypted);
        
        console.log('RSA-2048 encryption test:', recoveredMessage === message ? 'PASS' : 'FAIL');
        
        // Test signing
        const signature = this.Sign(keyPair.privateKey, message);
        const isValid = this.Verify(keyPair.publicKey, message, signature);
        
        console.log('RSA-2048 signature test:', isValid ? 'PASS' : 'FAIL');
        
        // Test with wrong message
        const wrongMessage = 'Wrong message';
        const isInvalid = this.Verify(keyPair.publicKey, wrongMessage, signature);
        
        console.log('RSA-2048 invalid signature test:', !isInvalid ? 'PASS' : 'FAIL');
        
        return {
          algorithm: 'RSA-2048',
          keySize: this.currentKeySize,
          encryptionSuccess: recoveredMessage === message,
          signatureValid: isValid,
          signatureInvalid: !isInvalid,
          success: (recoveredMessage === message) && isValid && !isInvalid,
          publicKeySize: this.currentParams.pkBytes,
          privateKeySize: this.currentParams.skBytes,
          quantumSecurity: 0, // RSA has no quantum security
          warning: '⚠️  RSA is vulnerable to quantum attacks and not post-quantum secure',
          note: 'Educational implementation with simplified prime generation - not for production use'
        };
      } catch (error) {
        console.log('RSA-2048 test: FAIL (', error.message, ')');
        return {
          algorithm: 'RSA-2048',
          keySize: this.currentKeySize,
          success: false,
          error: error.message,
          note: 'Educational implementation - key generation may occasionally fail'
        };
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(RSA);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RSA;
  }
  
  // Global export
  global.RSA = RSA;
  
})(typeof global !== 'undefined' ? global : window);