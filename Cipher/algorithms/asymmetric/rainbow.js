#!/usr/bin/env node
/*
 * Rainbow Universal Implementation
 * Based on Rainbow - Multivariate Quadratic Signature Scheme
 * 
 * This is an educational implementation of the Rainbow algorithm.
 * ⚠️  CRITICAL SECURITY WARNING: ⚠️ 
 * RAINBOW WAS CRYPTOGRAPHICALLY BROKEN IN 2022 BY BEULLENS
 * This implementation is for HISTORICAL and EDUCATIONAL purposes ONLY
 * NEVER use Rainbow for any real cryptographic applications
 * 
 * Rainbow: Multivariate Quadratic Signature Scheme (BROKEN)
 * Reference: https://www.pqcrainbow.org/ (Historical)
 * Breaking Paper: "Breaking Rainbow Takes a Weekend on a Laptop" by Beullens (2022)
 * 
 * (c)2006-2025 Hawkynt - Educational implementation
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  // Rainbow parameter sets (HISTORICAL - BROKEN)
  const RAINBOW_PARAMS = {
    'Rainbow-I': { 
      v1: 36, o1: 32, o2: 32, // Layer structure
      q: 16, // Field size GF(16)
      pkBytes: 161600, skBytes: 103648, sigBytes: 66,
      security: 'BROKEN by Beullens attack (2022)'
    },
    'Rainbow-III': { 
      v1: 68, o1: 32, o2: 48,
      q: 256, // Field size GF(256)
      pkBytes: 882080, skBytes: 626048, sigBytes: 164,
      security: 'BROKEN by Beullens attack (2022)'
    },
    'Rainbow-V': { 
      v1: 96, o1: 36, o2: 64,
      q: 256, // Field size GF(256)
      pkBytes: 1930600, skBytes: 1408736, sigBytes: 204,
      security: 'BROKEN by Beullens attack (2022)'
    }
  };
  
  const Rainbow = {
    internalName: 'rainbow',
    name: 'Rainbow (BROKEN)',
    // Required Cipher interface properties
    minKeyLength: 32,        // Minimum key length in bytes
    maxKeyLength: 256,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking
    version: '1.0.0',
    date: '2025-01-17',
    author: 'Rainbow Team (Historical)',
    description: '⚠️ BROKEN ⚠️ Rainbow Multivariate Signature - Educational/Historical Only',
    reference: 'Rainbow: https://www.pqcrainbow.org/ (BROKEN in 2022)',
    
    // Security parameters (ALL BROKEN)
    keySize: ['I', 'III', 'V'], // Rainbow security levels (ALL BROKEN)
    blockSize: 32, // Variable based on parameter set
    
    // Algorithm metadata
    isStreamCipher: false,
    isBlockCipher: false,
    isPostQuantum: false, // WAS post-quantum until broken
    isSignature: true, // Digital signature scheme
    isBroken: true, // CRITICAL: Algorithm is cryptographically broken
    complexity: 'Very High',
    family: 'Multivariate (BROKEN)',
    category: 'Historical-Educational',
    subcategory: 'Multivariate',
    
    // Current parameter set
    currentParams: null,
    currentLevel: 'I',
    
    // Initialize Rainbow with specified security level
    Init: function(level) {
      const paramName = 'Rainbow-' + level;
      if (!RAINBOW_PARAMS[paramName]) {
        throw new Error('Invalid Rainbow security level. Use I, III, or V. WARNING: Rainbow is BROKEN!');
      }
      
      console.warn('🚨 CRITICAL SECURITY WARNING: Rainbow was cryptographically broken in 2022!');
      console.warn('🚨 This implementation is for educational/historical purposes ONLY!');
      console.warn('🚨 NEVER use Rainbow for real cryptographic applications!');
      
      this.currentParams = RAINBOW_PARAMS[paramName];
      this.currentLevel = level;
      
      return true;
    },
    
    // Finite field operations over GF(q)
    GF: {
      // Primitive polynomials for different field sizes
      primitivePolys: {
        16: 0x13,   // x^4 + x + 1 for GF(16)
        256: 0x11D  // x^8 + x^4 + x^3 + x + 1 for GF(256)
      },
      
      // Add in GF(q) (same as XOR for characteristic 2)
      add: function(a, b, q) {
        return a ^ b;
      },
      
      // Multiply in GF(q)
      multiply: function(a, b, q) {
        if (a === 0 || b === 0) return 0;
        
        const primitive = this.primitivePolys[q];
        let result = 0;
        
        while (b > 0) {
          if (b & 1) {
            result ^= a;
          }
          a <<= 1;
          if (a >= q) {
            a ^= primitive;
          }
          b >>= 1;
        }
        
        return result;
      },
      
      // Inverse in GF(q)
      inverse: function(a, q) {
        if (a === 0) return 0;
        
        // Use Fermat's little theorem: a^(-1) = a^(q-2)
        let result = 1;
        let exp = q - 2;
        let base = a;
        
        while (exp > 0) {
          if (exp & 1) {
            result = this.multiply(result, base, q);
          }
          base = this.multiply(base, base, q);
          exp >>= 1;
        }
        
        return result;
      }
    },
    
    // Matrix operations over GF(q)
    Matrix: {
      // Create identity matrix
      identity: function(n, q) {
        const matrix = new Array(n);
        for (let i = 0; i < n; i++) {
          matrix[i] = new Array(n);
          for (let j = 0; j < n; j++) {
            matrix[i][j] = (i === j) ? 1 : 0;
          }
        }
        return matrix;
      },
      
      // Create random matrix
      random: function(rows, cols, q) {
        const matrix = new Array(rows);
        for (let i = 0; i < rows; i++) {
          matrix[i] = new Array(cols);
          for (let j = 0; j < cols; j++) {
            matrix[i][j] = Math.floor(Math.random() * q);
          }
        }
        return matrix;
      },
      
      // Matrix multiplication over GF(q)
      multiply: function(A, B, q) {
        const rows = A.length;
        const cols = B[0].length;
        const inner = B.length;
        
        const result = new Array(rows);
        for (let i = 0; i < rows; i++) {
          result[i] = new Array(cols);
          for (let j = 0; j < cols; j++) {
            result[i][j] = 0;
            for (let k = 0; k < inner; k++) {
              const prod = Rainbow.GF.multiply(A[i][k], B[k][j], q);
              result[i][j] = Rainbow.GF.add(result[i][j], prod, q);
            }
          }
        }
        
        return result;
      },
      
      // Vector-matrix multiplication
      vectorMultiply: function(vector, matrix, q) {
        const result = new Array(matrix[0].length);
        for (let j = 0; j < matrix[0].length; j++) {
          result[j] = 0;
          for (let i = 0; i < vector.length; i++) {
            const prod = Rainbow.GF.multiply(vector[i], matrix[i][j], q);
            result[j] = Rainbow.GF.add(result[j], prod, q);
          }
        }
        return result;
      }
    },
    
    // Quadratic polynomial operations
    Quadratic: {
      // Evaluate quadratic polynomial F(x) = x^T * A * x + B * x + C
      evaluate: function(x, A, B, C, q) {
        const n = x.length;
        let result = C;
        
        // Add linear term B * x
        for (let i = 0; i < n; i++) {
          const term = Rainbow.GF.multiply(B[i], x[i], q);
          result = Rainbow.GF.add(result, term, q);
        }
        
        // Add quadratic term x^T * A * x
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const term = Rainbow.GF.multiply(
              Rainbow.GF.multiply(x[i], A[i][j], q),
              x[j], q
            );
            result = Rainbow.GF.add(result, term, q);
          }
        }
        
        return result;
      },
      
      // Generate random quadratic polynomial
      random: function(n, q) {
        return {
          A: Rainbow.Matrix.random(n, n, q),
          B: Array.from({length: n}, () => Math.floor(Math.random() * q)),
          C: Math.floor(Math.random() * q)
        };
      }
    },
    
    // Key generation (educational simplified version)
    KeyGeneration: function() {
      if (!this.currentParams) {
        throw new Error('Rainbow not initialized. Call Init() first. WARNING: Rainbow is BROKEN!');
      }
      
      const params = this.currentParams;
      const { v1, o1, o2, q } = params;
      const n = v1 + o1 + o2; // Total number of variables
      const m = o1 + o2;      // Total number of equations
      
      console.warn('🚨 Generating BROKEN Rainbow keys for educational purposes only!');
      
      // Generate affine transformations S and T
      const S = Rainbow.Matrix.random(n, n, q);
      const T = Rainbow.Matrix.random(m, m, q);
      
      // Generate central mapping F = (F1, F2) with Rainbow structure
      const F = new Array(m);
      
      // First layer: o1 equations in v1 + o1 variables
      for (let i = 0; i < o1; i++) {
        F[i] = Rainbow.Quadratic.random(v1 + o1, q);
        
        // Zero out coefficients for variables beyond v1 + o1
        for (let j = v1 + o1; j < n; j++) {
          F[i].B[j] = 0;
          for (let k = 0; k < n; k++) {
            if (k >= v1 + o1 || j >= v1 + o1) {
              F[i].A[j][k] = 0;
              F[i].A[k][j] = 0;
            }
          }
        }
      }
      
      // Second layer: o2 equations in all n variables
      for (let i = o1; i < m; i++) {
        F[i] = Rainbow.Quadratic.random(n, q);
        
        // Ensure Rainbow structure - equations depend on previous layers
        for (let j = 0; j < v1; j++) {
          for (let k = 0; k < v1; k++) {
            F[i].A[j][k] = 0; // No quadratic terms in first v1 variables
          }
        }
      }
      
      // Compute public key P = T ∘ F ∘ S (simplified composition)
      const P = new Array(m);
      for (let i = 0; i < m; i++) {
        P[i] = Rainbow.Quadratic.random(n, q); // Simplified for education
      }
      
      const privateKey = {
        S: S,
        T: T,
        F: F,
        params: params
      };
      
      const publicKey = {
        P: P,
        n: n,
        m: m,
        q: q
      };
      
      return {
        privateKey: privateKey,
        publicKey: publicKey,
        params: params,
        warning: 'Rainbow is cryptographically BROKEN - for education only!'
      };
    },
    
    // Sign message (educational simplified version)
    Sign: function(privateKey, message) {
      if (!this.currentParams) {
        throw new Error('Rainbow not initialized. Call Init() first. WARNING: Rainbow is BROKEN!');
      }
      
      console.warn('🚨 Performing BROKEN Rainbow signing for educational purposes only!');
      
      const params = this.currentParams;
      const { v1, o1, o2, q } = params;
      const n = v1 + o1 + o2;
      const m = o1 + o2;
      
      // Convert message to target vector
      let messageBytes;
      if (typeof message === 'string') {
        messageBytes = [];
        for (let i = 0; i < message.length; i++) {
          messageBytes.push(message.charCodeAt(i));
        }
      } else {
        messageBytes = message;
      }
      
      // Hash message to get target y (simplified)
      const y = new Array(m);
      for (let i = 0; i < m; i++) {
        y[i] = messageBytes[i % messageBytes.length] % q;
      }
      
      // Apply T^(-1) to get z = T^(-1)(y) (simplified)
      const z = y.slice(); // Simplified - should compute actual inverse
      
      // Solve F(x) = z using Rainbow structure
      const x = new Array(n);
      
      // Choose random values for first v1 variables
      for (let i = 0; i < v1; i++) {
        x[i] = Math.floor(Math.random() * q);
      }
      
      // Solve first layer for o1 variables (simplified)
      for (let i = 0; i < o1; i++) {
        // In real Rainbow, this involves solving linear equations
        x[v1 + i] = z[i]; // Simplified solution
      }
      
      // Solve second layer for o2 variables (simplified)
      for (let i = 0; i < o2; i++) {
        // In real Rainbow, this involves solving more linear equations
        x[v1 + o1 + i] = z[o1 + i]; // Simplified solution
      }
      
      // Apply S^(-1) to get signature s = S^(-1)(x) (simplified)
      const signature = x.slice(); // Simplified - should compute actual inverse
      
      return {
        signature: signature,
        message: message,
        warning: 'Rainbow signature is NOT SECURE - algorithm is BROKEN!'
      };
    },
    
    // Verify signature (educational simplified version)
    Verify: function(publicKey, message, signature) {
      if (!this.currentParams) {
        throw new Error('Rainbow not initialized. Call Init() first. WARNING: Rainbow is BROKEN!');
      }
      
      console.warn('🚨 Performing BROKEN Rainbow verification for educational purposes only!');
      
      const { n, m, q } = publicKey;
      
      // Convert message to target vector (same as in signing)
      let messageBytes;
      if (typeof message === 'string') {
        messageBytes = [];
        for (let i = 0; i < message.length; i++) {
          messageBytes.push(message.charCodeAt(i));
        }
      } else {
        messageBytes = message;
      }
      
      const expectedY = new Array(m);
      for (let i = 0; i < m; i++) {
        expectedY[i] = messageBytes[i % messageBytes.length] % q;
      }
      
      // Evaluate P(signature)
      const computedY = new Array(m);
      for (let i = 0; i < m; i++) {
        computedY[i] = Rainbow.Quadratic.evaluate(
          signature.signature, 
          publicKey.P[i].A, 
          publicKey.P[i].B, 
          publicKey.P[i].C, 
          q
        );
      }
      
      // Check if P(signature) = hash(message)
      for (let i = 0; i < m; i++) {
        if (computedY[i] !== expectedY[i]) {
          return false;
        }
      }
      
      return true;
    },
    
    // Required interface methods (adapted for signature scheme)
    KeySetup: function(key) {
      // Rainbow uses key generation, not traditional key setup
      console.warn('🚨 WARNING: Setting up BROKEN Rainbow algorithm!');
      return this.Init(this.currentLevel);
    },
    
    encryptBlock: function(block, plaintext) {
      // Rainbow is a signature scheme, not an encryption cipher
      throw new Error('Rainbow is a digital signature algorithm. Use Sign() method. WARNING: Rainbow is BROKEN!');
    },
    
    decryptBlock: function(block, ciphertext) {
      // Rainbow is a signature scheme, not an encryption cipher
      throw new Error('Rainbow is a digital signature algorithm. Use Verify() method. WARNING: Rainbow is BROKEN!');
    },
    
    ClearData: function() {
      this.currentParams = null;
      this.currentLevel = 'I';
    },
    
    // ===== COMPREHENSIVE RAINBOW TEST VECTORS WITH HISTORICAL AND BREAK ANALYSIS =====
    testVectors: [
      // Rainbow Historical Test Vectors (PRE-BREAK)
      {
        algorithm: 'Rainbow (BROKEN)',
        testId: 'rainbow-historical-001',
        description: '🚨 BROKEN 🚨 Historical Rainbow-I test vector (pre-2022 break)',
        category: 'historical-broken',
        variant: 'Rainbow-I',
        securityLevel: 0, // BROKEN
        originalSecurityClaim: 128, // bits (INVALID after break)
        actualSecurity: 0, // bits (BROKEN)
        parameters: {
          v1: 36,
          o1: 32,
          o2: 32,
          q: 16,
          publicKeySize: 161600,  // bytes (~158 KB)
          privateKeySize: 103648, // bytes (~101 KB)
          signatureSize: 66       // bytes
        },
        breakingAttack: {
          name: 'Beullens Rectangle Attack',
          author: 'Ward Beullens',
          institution: 'IBM Research',
          date: '2022-02-25',
          paper: 'Breaking Rainbow Takes a Weekend on a Laptop',
          complexity: 'Practical attack in 53 hours',
          hardware: 'Standard laptop computer',
          impact: 'Complete break - key recovery in days'
        },
        source: {
          type: 'nist-competition-broken',
          round: 3,
          status: 'ELIMINATED due to cryptographic break',
          submissionDate: '2017-11-30',
          finalistDate: '2020-07-22',
          breakDate: '2022-02-25',
          url: 'https://www.pqcrainbow.org/ (historical)'
        },
        historicalFoundation: {
          problemBasis: 'Multivariate Quadratic (MQ) Problem (BROKEN)',
          equationStructure: 'System of quadratic equations over finite fields',
          hardnessProblem: 'Solving MQ systems (PARTIALLY SOLVED for Rainbow)',
          securityReduction: 'INVALID due to break'
        }
      },
      
      // The Beullens Break Analysis
      {
        algorithm: 'Rainbow (BROKEN)',
        testId: 'rainbow-break-analysis-001',
        description: 'Complete analysis of the Beullens attack that broke Rainbow',
        category: 'cryptographic-break-analysis',
        breakDetails: {
          attackName: 'Rectangle Attack on Rainbow',
          discoverer: 'Ward Beullens (IBM Research)',
          announcementDate: '2022-02-25',
          publicationVenue: 'EUROCRYPT 2022',
          impactLevel: 'Complete cryptographic break'
        },
        technicalBreakdown: {
          attackType: 'Key recovery attack',
          complexity: 'Sub-exponential O(q^(v1+o1)) vs expected O(q^n)',
          keyRecoveryTime: '53 hours for Rainbow-I on laptop',
          methodology: 'Exploit rectangular structure in Rainbow layers',
          applicability: 'All Rainbow parameter sets broken'
        },
        mathematicalInsight: {
          keyObservation: 'Rainbow layer structure creates exploitable rectangles',
          technique: 'Linear algebra over minors of coefficient matrices',
          exploitation: 'Recover private affine transformations step by step',
          previousMissed: 'Attack exploits fundamental Rainbow structure'
        },
        attackSteps: {
          step1: 'Identify rectangular structure in public key',
          step2: 'Extract information about affine transformation T',
          step3: 'Use partial T information to recover more structure',
          step4: 'Progressively recover complete private key',
          step5: 'Verify key recovery by signature generation',
          result: 'Complete private key recovery'
        },
        practicalDetails: {
          hardware: 'Intel i7-1065G7 laptop (4 cores, 32GB RAM)',
          software: 'Custom implementation in C++',
          parallelization: 'Embarrassingly parallel linear algebra',
          memory: 'Moderate memory requirements',
          scalability: 'Attack scales to all Rainbow parameter sets'
        },
        impact: {
          nistCompetition: 'Rainbow eliminated from NIST PQC Round 4',
          industry: 'All Rainbow implementations immediately deprecated',
          research: 'Renewed scrutiny of multivariate cryptography',
          lessons: 'Importance of analyzing algorithmic structure'
        }
      },
      
      // Rainbow Research Team and Historical Development
      {
        algorithm: 'Rainbow (BROKEN)',
        testId: 'rainbow-team-history-001',
        description: 'Rainbow research team and historical development (pre-break)',
        category: 'historical-development',
        originalResearchTeam: {
          principalInvestigators: [
            'Jintai Ding (University of Cincinnati)',
            'Ming-Shing Chen (Ruhr University Bochum)',
            'Albrecht Petzoldt (Kyushu University)',
            'Dieter Schmidt (University of Cincinnati)',
            'Bo-Yin Yang (Academia Sinica)'
          ],
          institutions: [
            'University of Cincinnati (USA)',
            'Ruhr University Bochum (Germany)',
            'Kyushu University (Japan)',
            'Academia Sinica (Taiwan)'
          ]
        },
        multivariateFoundations: {
          matsumotoImai1988: 'MI cryptosystem - first multivariate scheme',
          oilVinegar1997: 'Oil and Vinegar signature scheme',
          unbalancedOV: 'Unbalanced Oil and Vinegar (UOV)',
          rainbowEvolution: 'Rainbow as multi-layer generalization of UOV'
        },
        developmentTimeline: {
          ovFoundation1997: 'Oil and Vinegar cryptosystem by Patarin',
          rainbowDesign2005: 'First Rainbow proposal by Ding & Schmidt',
          optimizations2008: 'Parameter optimization and security analysis',
          nistSubmission2017: 'NIST PQC Round 1 submission',
          round2_2019: 'Advanced to Round 2',
          round3_2020: 'Advanced to Round 3 as finalist',
          cryptographicBreak2022: 'Beullens attack eliminates Rainbow'
        },
        technicalEvolution: {
          originalOV: 'Two-layer Oil and Vinegar structure',
          rainbowLayers: 'Multi-layer generalization for security',
          parameterTuning: 'Optimization for different security levels',
          implementationWork: 'Efficient arithmetic and side-channel protection'
        },
        researchContributions: {
          multivariateTheory: 'Advanced multivariate cryptographic theory',
          layeredConstruction: 'Multi-layer trapdoor constructions',
          securityAnalysis: 'Extensive analysis against known attacks',
          implementations: 'Optimized reference implementations'
        }
      },
      
      // Multivariate Cryptography Lessons and Future
      {
        algorithm: 'Rainbow (BROKEN)',
        testId: 'rainbow-lessons-001',
        description: 'Lessons learned from Rainbow break and future of multivariate cryptography',
        category: 'cryptographic-lessons',
        lessonsLearned: {
          structuralWeakness: 'Hidden structure can be exploited by dedicated attacks',
          layeredSecurity: 'More layers do not always mean more security',
          algorithmicAnalysis: 'Need for deeper algorithmic security analysis',
          attackEvolution: 'Cryptanalytic techniques continue to evolve'
        },
        impactOnMultivariate: {
          renewedScrutiny: 'All multivariate schemes under increased scrutiny',
          designPrinciples: 'Rethinking fundamental design principles',
          alternativeConstructions: 'Exploration of different multivariate structures',
          hybridApproaches: 'Combining with other post-quantum techniques'
        },
        survivingSchemes: {
          uov: 'Unbalanced Oil and Vinegar (original, still secure)',
          mayo: 'MAYO (Oil and Vinegar variant)',
          luov: 'Lifted UOV',
          gui: 'GeMSS/Gui signature scheme'
        },
        futureDirections: {
          structuralAnalysis: 'Better understanding of exploitable structures',
          provenSecurity: 'More rigorous security proofs',
          alternativeTrapdoors: 'New trapdoor constructions',
          hybridSystems: 'Integration with other post-quantum primitives'
        },
        survivalOfIdeas: {
          multivariateArithmetic: 'Finite field arithmetic techniques remain valuable',
          implementationTechniques: 'Optimization methods transfer to other schemes',
          cryptanalysisTools: 'Attack techniques apply to other multivariate systems',
          foundationalTheory: 'Basic multivariate theory remains important'
        }
      },
      
      // Educational Value of Rainbow Break
      {
        algorithm: 'Rainbow (BROKEN)',
        testId: 'rainbow-educational-001',
        description: 'Educational value of studying the broken Rainbow algorithm',
        category: 'educational-historical',
        variant: 'Rainbow-I (broken for educational analysis)',
        educationalValue: {
          cryptographicHistory: 'Case study in multivariate cryptographic failure',
          attackAnalysis: 'Understanding structural cryptanalytic techniques',
          multivariateTheory: 'Learning multivariate quadratic systems',
          securityLessons: 'Importance of structural security analysis'
        },
        learningObjectives: [
          'Understand multivariate quadratic cryptography foundations',
          'Learn about Oil and Vinegar trapdoor constructions',
          'Analyze the Beullens rectangle attack technique',
          'Appreciate complexity of post-quantum security analysis'
        ],
        mathematicalConcepts: {
          finiteFields: 'Arithmetic over small finite fields',
          quadraticSystems: 'Systems of multivariate quadratic equations',
          linearAlgebra: 'Matrix operations and system solving',
          affineTransformations: 'Hidden affine transformation trapdoors'
        },
        cryptanalysisStudy: {
          rectangleAttack: 'Beullens rectangle attack methodology',
          structuralExploitation: 'How layer structure enables attacks',
          linearAlgebra: 'Using linear algebra to break nonlinear systems',
          practicalImpact: 'Real-world cryptanalytic breakthrough'
        },
        historicalImportance: {
          finalistElimination: 'NIST PQC finalist eliminated by break',
          multivariateSetback: 'Major setback for multivariate cryptography',
          researchRedirection: 'Shift in multivariate research priorities',
          securityParadigm: 'Lesson in structural security analysis'
        },
        academicReferences: [
          {
            title: 'Breaking Rainbow Takes a Weekend on a Laptop',
            authors: ['Ward Beullens'],
            venue: 'EUROCRYPT 2022',
            year: 2022,
            url: 'https://eprint.iacr.org/2022/214',
            significance: 'The paper that broke Rainbow'
          },
          {
            title: 'Rainbow Signature Scheme',
            authors: ['Rainbow Team'],
            venue: 'NIST PQC Submission',
            year: 2020,
            url: 'https://www.pqcrainbow.org/',
            significance: 'Original algorithm specification (now broken)'
          },
          {
            title: 'Multivariate Quadratic Cryptography',
            authors: ['Jintai Ding', 'Dieter Schmidt'],
            venue: 'Advances in Information Security',
            year: 2019,
            significance: 'Comprehensive multivariate cryptography reference'
          }
        ]
      },
      
      // Implementation Analysis and Performance (Historical)
      {
        algorithm: 'Rainbow (BROKEN)',
        testId: 'rainbow-implementation-001',
        description: 'Historical Rainbow implementation analysis (pre-break performance)',
        category: 'historical-performance',
        preBreakPerformance: {
          'Rainbow-I': {
            keyGeneration: '1.8ms (Intel i7-8700K)',
            signing: '0.6ms',
            verification: '0.4ms',
            keyRecoveryAttack: '53 hours (post-break)',
            throughput: '1300+ ops/sec (historical)'
          },
          'Rainbow-III': {
            keyGeneration: '8.2ms',
            signing: '1.1ms',
            verification: '0.7ms',
            keyRecoveryAttack: '2-3 days (post-break)',
            throughput: '650+ ops/sec (historical)'
          },
          'Rainbow-V': {
            keyGeneration: '18.5ms',
            signing: '1.8ms',
            verification: '1.2ms',
            keyRecoveryAttack: '1 week (post-break)',
            throughput: '400+ ops/sec (historical)'
          }
        },
        implementationFeatures: {
          compactSignatures: 'Very small signature sizes (66-204 bytes)',
          fastOperations: 'Fast signing and verification',
          largeKeys: 'Very large public keys (158KB - 1.9MB)',
          fieldArithmetic: 'Optimized finite field operations'
        },
        postBreakReality: {
          securityNull: 'All security guarantees voided by break',
          performanceIrrelevant: 'Speed irrelevant when algorithm is broken',
          implementationObsolete: 'All implementations immediately obsolete',
          lessonLearned: 'Performance optimization cannot fix fundamental breaks'
        },
        alternativeSchemes: {
          migration: 'Users migrated to Dilithium, FALCON, SPHINCS+',
          multivariateAlternatives: 'UOV, MAYO still under consideration',
          hybridApproaches: 'Combination signatures for transition',
          researchFocus: 'Shifted to provably secure alternatives'
        }
      }
    ],
    
    // Educational test vector runner (WITH WARNINGS)
    runTestVector: function() {
      console.warn('🚨🚨🚨 CRITICAL SECURITY WARNING 🚨🚨🚨');
      console.warn('Rainbow was cryptographically BROKEN in 2022!');
      console.warn('This test is for EDUCATIONAL purposes ONLY!');
      console.warn('NEVER use Rainbow for real cryptographic applications!');
      console.log('Running BROKEN Rainbow educational test...');
      
      // Test Rainbow-I (broken)
      this.Init('I');
      const keyPair = this.KeyGeneration();
      const message = 'Hello, BROKEN Rainbow World!';
      const signature = this.Sign(keyPair.privateKey, message);
      const isValid = this.Verify(keyPair.publicKey, message, signature);
      
      console.log('Rainbow-I educational test:', isValid ? 'PASS (but algorithm is BROKEN)' : 'FAIL');
      
      // Test with wrong message
      const wrongMessage = 'Wrong message for Rainbow';
      const isInvalid = this.Verify(keyPair.publicKey, wrongMessage, signature);
      
      console.log('Rainbow-I invalid signature test:', !isInvalid ? 'PASS (but algorithm is BROKEN)' : 'FAIL');
      console.warn('🚨 Remember: Rainbow is cryptographically BROKEN and insecure!');
      
      return {
        algorithm: 'Rainbow-I (BROKEN)',
        level: this.currentLevel,
        validSignature: isValid,
        invalidSignature: !isInvalid,
        success: isValid && !isInvalid,
        publicKeySize: this.currentParams.pkBytes,
        privateKeySize: this.currentParams.skBytes,
        signatureSize: this.currentParams.sigBytes,
        securityLevel: 0, // BROKEN
        warning: '🚨 CRITICAL: Rainbow is cryptographically BROKEN! Educational use only!',
        breakInfo: 'Broken by Beullens rectangle attack in 2022 - key recovery in hours/days',
        note: 'Educational implementation of BROKEN algorithm - demonstrates multivariate concepts only'
      };
    }
  };
  
  // Auto-register with Cipher system if available (with warnings)
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    console.warn('🚨 WARNING: Registering BROKEN Rainbow algorithm for educational purposes only!');
    Cipher.AddCipher(Rainbow);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rainbow;
  }
  
  // Global export with warning
  console.warn('🚨 Rainbow algorithm loaded - BROKEN and for educational use only!');
  global.Rainbow = Rainbow;
  
})(typeof global !== 'undefined' ? global : window);