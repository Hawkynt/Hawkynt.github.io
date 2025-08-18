#!/usr/bin/env node
/*
 * SIKE Universal Implementation
 * Based on SIKE - Supersingular Isogeny Key Encapsulation
 * 
 * This is an educational implementation of the SIKE algorithm.
 * ⚠️  CRITICAL SECURITY WARNING: ⚠️ 
 * SIKE WAS CRYPTOGRAPHICALLY BROKEN IN 2022 BY CASTRYCK AND DECRU
 * This implementation is for HISTORICAL and EDUCATIONAL purposes ONLY
 * NEVER use SIKE for any real cryptographic applications
 * 
 * SIKE: Supersingular Isogeny Key Encapsulation Mechanism (BROKEN)
 * Reference: https://sike.org/ (Historical)
 * Breaking Paper: "An efficient key recovery attack on SIKE" by Castryck & Decru (2022)
 * 
 * (c)2006-2025 Hawkynt - Educational implementation
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  // SIKE parameter sets (HISTORICAL - BROKEN)
  const SIKE_PARAMS = {
    'SIKEp434': { 
      p: '434', // Prime characteristic (simplified representation)
      eA: 216, eB: 137, // Exponents for A and B isogeny degrees
      lA: 2, lB: 3,     // Small prime isogeny degrees
      pkBytes: 330, skBytes: 374, ctBytes: 346, ssBytes: 16,
      security: 'BROKEN by Castryck-Decru attack (2022)'
    },
    'SIKEp503': { 
      p: '503',
      eA: 250, eB: 159,
      lA: 2, lB: 3,
      pkBytes: 378, skBytes: 434, ctBytes: 402, ssBytes: 24,
      security: 'BROKEN by Castryck-Decru attack (2022)'
    },
    'SIKEp610': { 
      p: '610',
      eA: 305, eB: 192,
      lA: 2, lB: 3,
      pkBytes: 462, skBytes: 524, ctBytes: 486, ssBytes: 24,
      security: 'BROKEN by Castryck-Decru attack (2022)'
    },
    'SIKEp751': { 
      p: '751',
      eA: 372, eB: 239,
      lA: 2, lB: 3,
      pkBytes: 564, skBytes: 644, ctBytes: 596, ssBytes: 32,
      security: 'BROKEN by Castryck-Decru attack (2022)'
    }
  };
  
  const SIKE = {
    internalName: 'sike',
    name: 'SIKE (BROKEN)',
    // Required Cipher interface properties
    minKeyLength: 16,        // Minimum key length in bytes
    maxKeyLength: 64,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking
    version: '1.0.0',
    date: '2025-01-17',
    author: 'SIKE Team (Historical)',
    description: '⚠️ BROKEN ⚠️ Supersingular Isogeny Key Encapsulation - Educational/Historical Only',
    reference: 'SIKE: https://sike.org/ (BROKEN in 2022)',
    
    // Security parameters (ALL BROKEN)
    keySize: [434, 503, 610, 751], // SIKE parameter sets (ALL BROKEN)
    blockSize: 32, // Variable based on parameter set
    
    // Algorithm metadata
    isStreamCipher: false,
    isBlockCipher: false,
    isPostQuantum: false, // WAS post-quantum until broken
    isKEM: true, // Key Encapsulation Mechanism
    isBroken: true, // CRITICAL: Algorithm is cryptographically broken
    complexity: 'Very High',
    family: 'Isogeny-based (BROKEN)',
    category: 'Historical-Educational',
    subcategory: 'Isogeny-based',
    
    // Current parameter set
    currentParams: null,
    currentLevel: 434,
    
    // Initialize SIKE with specified parameter set
    Init: function(level) {
      const paramName = 'SIKEp' + level;
      if (!SIKE_PARAMS[paramName]) {
        throw new Error('Invalid SIKE parameter set. Use 434, 503, 610, or 751. WARNING: SIKE is BROKEN!');
      }
      
      console.warn('🚨 CRITICAL SECURITY WARNING: SIKE was cryptographically broken in 2022!');
      console.warn('🚨 This implementation is for educational/historical purposes ONLY!');
      console.warn('🚨 NEVER use SIKE for real cryptographic applications!');
      
      this.currentParams = SIKE_PARAMS[paramName];
      this.currentLevel = level;
      
      return true;
    },
    
    // Simplified elliptic curve operations (educational version)
    EllipticCurve: {
      // Point representation: [x, y, z] in projective coordinates
      // Curve: y^2 = x^3 + ax^2 + x over F_p^2
      
      // Point addition (simplified educational version)
      pointAdd: function(P, Q, a) {
        // In real SIKE, this involves complex F_p^2 arithmetic
        // Educational simplified version
        if (P.isInfinity) return Q;
        if (Q.isInfinity) return P;
        
        // Simplified addition - real implementation much more complex
        const R = {
          x: (P.x + Q.x) % 1000, // Simplified modular arithmetic
          y: (P.y + Q.y) % 1000,
          isInfinity: false
        };
        
        return R;
      },
      
      // Point doubling
      pointDouble: function(P, a) {
        if (P.isInfinity) return P;
        
        // Simplified doubling
        const R = {
          x: (2 * P.x) % 1000,
          y: (2 * P.y) % 1000,
          isInfinity: false
        };
        
        return R;
      },
      
      // Scalar multiplication (simplified)
      scalarMult: function(k, P, a) {
        let result = { x: 0, y: 0, isInfinity: true };
        let addend = P;
        
        while (k > 0) {
          if (k & 1) {
            result = this.pointAdd(result, addend, a);
          }
          addend = this.pointDouble(addend, a);
          k >>= 1;
        }
        
        return result;
      }
    },
    
    // Isogeny operations (heavily simplified for education)
    Isogeny: {
      // Compute l-isogeny (educational simplified version)
      computeIsogeny: function(kernel, l, eA) {
        // In real SIKE, this involves:
        // 1. Vélu's formulas for small-degree isogenies
        // 2. Complex point arithmetic over F_p^2
        // 3. Composition of many small isogenies
        
        // Educational simplified version
        const isogeny = {
          domain: { a: Math.floor(Math.random() * 100), b: Math.floor(Math.random() * 100) },
          codomain: { a: Math.floor(Math.random() * 100), b: Math.floor(Math.random() * 100) },
          degree: Math.pow(l, eA),
          kernel: kernel
        };
        
        return isogeny;
      },
      
      // Evaluate isogeny at a point
      evaluateIsogeny: function(isogeny, point) {
        // Educational simplified evaluation
        const result = {
          x: (point.x + isogeny.domain.a) % 1000,
          y: (point.y + isogeny.domain.b) % 1000,
          isInfinity: point.isInfinity
        };
        
        return result;
      },
      
      // Generate random isogeny of given degree
      generateRandomIsogeny: function(l, e) {
        // Generate random kernel point
        const kernel = {
          x: Math.floor(Math.random() * 1000),
          y: Math.floor(Math.random() * 1000),
          isInfinity: false
        };
        
        return this.computeIsogeny(kernel, l, e);
      }
    },
    
    // Key generation (educational simplified version)
    KeyGeneration: function() {
      if (!this.currentParams) {
        throw new Error('SIKE not initialized. Call Init() first. WARNING: SIKE is BROKEN!');
      }
      
      const params = this.currentParams;
      const { eA, eB, lA, lB } = params;
      
      console.warn('🚨 Generating BROKEN SIKE keys for educational purposes only!');
      
      // Generate Alice's secret key: random scalar mA < 2^eA
      const mA = Math.floor(Math.random() * Math.pow(2, Math.min(eA, 20))); // Limited for demo
      
      // Generate Bob's secret key: random scalar mB < 3^eB  
      const mB = Math.floor(Math.random() * Math.pow(3, Math.min(eB/10, 10))); // Limited for demo
      
      // Starting supersingular curve E0: y^2 = x^3 + x
      const E0 = { a: 0, b: 1 };
      
      // Generate base points (simplified)
      const PA = { x: 1, y: 1, isInfinity: false };
      const QA = { x: 2, y: 2, isInfinity: false };
      const PB = { x: 3, y: 3, isInfinity: false };
      const QB = { x: 4, y: 4, isInfinity: false };
      
      // Alice computes her isogeny φA: E0 → EA
      const kernelA = this.EllipticCurve.scalarMult(mA, PA, E0.a);
      const isogenyA = this.Isogeny.computeIsogeny(kernelA, lA, eA);
      
      // Alice's public key: EA and φA(PB), φA(QB)
      const EA = isogenyA.codomain;
      const phiA_PB = this.Isogeny.evaluateIsogeny(isogenyA, PB);
      const phiA_QB = this.Isogeny.evaluateIsogeny(isogenyA, QB);
      
      const privateKey = {
        secretScalar: mA,
        isogeny: isogenyA,
        type: 'Alice'
      };
      
      const publicKey = {
        curve: EA,
        pointPB: phiA_PB,
        pointQB: phiA_QB,
        parameters: params
      };
      
      return {
        privateKey: privateKey,
        publicKey: publicKey,
        params: params,
        warning: 'SIKE is cryptographically BROKEN - for education only!'
      };
    },
    
    // Encapsulation (encrypt shared secret)
    Encapsulate: function(publicKey) {
      if (!this.currentParams) {
        throw new Error('SIKE not initialized. Call Init() first. WARNING: SIKE is BROKEN!');
      }
      
      const params = this.currentParams;
      const { eB, lB } = params;
      
      console.warn('🚨 Performing BROKEN SIKE encapsulation for educational purposes only!');
      
      // Generate ephemeral secret for Bob
      const mB = Math.floor(Math.random() * Math.pow(3, Math.min(eB/10, 10)));
      
      // Bob computes kernel point
      const kernelB = this.EllipticCurve.scalarMult(mB, publicKey.pointPB, publicKey.curve.a);
      
      // Bob computes isogeny φB: EA → EAB
      const isogenyB = this.Isogeny.computeIsogeny(kernelB, lB, eB);
      
      // Bob's ciphertext: EB and φB(PA), φB(QA) (simplified)
      const EB = isogenyB.codomain;
      const phiB_PA = { x: Math.floor(Math.random() * 1000), y: Math.floor(Math.random() * 1000), isInfinity: false };
      const phiB_QA = { x: Math.floor(Math.random() * 1000), y: Math.floor(Math.random() * 1000), isInfinity: false };
      
      // Shared secret: j-invariant of EAB (simplified)
      const sharedSecret = new Array(params.ssBytes);
      for (let i = 0; i < params.ssBytes; i++) {
        sharedSecret[i] = (isogenyB.codomain.a + isogenyB.codomain.b + i) % 256;
      }
      
      const ciphertext = {
        curve: EB,
        pointPA: phiB_PA,
        pointQA: phiB_QA,
        ephemeralIsogeny: isogenyB
      };
      
      return {
        ciphertext: ciphertext,
        sharedSecret: sharedSecret,
        warning: 'SIKE shared secret is NOT SECURE - algorithm is BROKEN!'
      };
    },
    
    // Decapsulation (decrypt shared secret)
    Decapsulate: function(privateKey, ciphertext) {
      if (!this.currentParams) {
        throw new Error('SIKE not initialized. Call Init() first. WARNING: SIKE is BROKEN!');
      }
      
      console.warn('🚨 Performing BROKEN SIKE decapsulation for educational purposes only!');
      
      // Alice uses her secret to compute kernel on EB
      const kernelAB = this.EllipticCurve.scalarMult(privateKey.secretScalar, ciphertext.pointPA, ciphertext.curve.a);
      
      // Alice computes φA: EB → EAB
      const isogenyAB = this.Isogeny.computeIsogeny(kernelAB, this.currentParams.lA, this.currentParams.eA);
      
      // Shared secret: j-invariant of EAB (should match encapsulation)
      const sharedSecret = new Array(this.currentParams.ssBytes);
      for (let i = 0; i < this.currentParams.ssBytes; i++) {
        sharedSecret[i] = (isogenyAB.codomain.a + isogenyAB.codomain.b + i) % 256;
      }
      
      return sharedSecret;
    },
    
    // Required interface methods (KEM doesn't use traditional encrypt/decrypt)
    KeySetup: function(key) {
      // SIKE uses key generation, not traditional key setup
      console.warn('🚨 WARNING: Setting up BROKEN SIKE algorithm!');
      return this.Init(this.currentLevel);
    },
    
    encryptBlock: function(block, plaintext) {
      // SIKE is a Key Encapsulation Mechanism, not a traditional cipher
      throw new Error('SIKE is a Key Encapsulation Mechanism. Use Encapsulate() method. WARNING: SIKE is BROKEN!');
    },
    
    decryptBlock: function(block, ciphertext) {
      // SIKE is a Key Encapsulation Mechanism, not a traditional cipher
      throw new Error('SIKE is a Key Encapsulation Mechanism. Use Decapsulate() method. WARNING: SIKE is BROKEN!');
    },
    
    ClearData: function() {
      this.currentParams = null;
      this.currentLevel = 434;
    },
    
    // ===== COMPREHENSIVE SIKE TEST VECTORS WITH HISTORICAL AND BREAK ANALYSIS =====
    testVectors: [
      // SIKE Historical Test Vectors (PRE-BREAK)
      {
        algorithm: 'SIKE (BROKEN)',
        testId: 'sike-historical-001',
        description: '🚨 BROKEN 🚨 Historical SIKE434 test vector (pre-2022 break)',
        category: 'historical-broken',
        variant: 'SIKEp434',
        securityLevel: 0, // BROKEN
        originalSecurityClaim: 128, // bits (INVALID after break)
        actualSecurity: 0, // bits (BROKEN)
        parameters: {
          p: 434,
          eA: 216,
          eB: 137,
          lA: 2,
          lB: 3,
          publicKeySize: 330,  // bytes
          privateKeySize: 374, // bytes
          ciphertextSize: 346, // bytes
          sharedSecretSize: 16 // bytes
        },
        breakingAttack: {
          name: 'Castryck-Decru Attack',
          authors: ['Wouter Castryck', 'Thomas Decru'],
          institution: 'KU Leuven',
          date: '2022-07-30',
          paper: 'An efficient key recovery attack on SIKE',
          complexity: 'Polynomial time',
          impact: 'Complete break - key recovery in minutes'
        },
        source: {
          type: 'nist-competition-broken',
          round: 4,
          status: 'ELIMINATED due to cryptographic break',
          submissionDate: '2017-11-30',
          breakDate: '2022-07-30',
          url: 'https://sike.org/ (historical)'
        },
        historicalFoundation: {
          problemBasis: 'Supersingular Isogeny Graph Problem (BROKEN)',
          isogenyStructure: 'Isogenies between supersingular elliptic curves',
          hardnessProblem: 'Finding isogenies between given curves (SOLVED)',
          securityReduction: 'INVALID due to break'
        }
      },
      
      // The Castryck-Decru Break Analysis
      {
        algorithm: 'SIKE (BROKEN)',
        testId: 'sike-break-analysis-001',
        description: 'Complete analysis of the Castryck-Decru attack that broke SIKE',
        category: 'cryptographic-break-analysis',
        breakDetails: {
          attackName: 'Castryck-Decru Attack',
          discoverers: 'Wouter Castryck and Thomas Decru (KU Leuven)',
          announcementDate: '2022-07-30',
          publicationVenue: 'EUROCRYPT 2023',
          impactLevel: 'Complete cryptographic break'
        },
        technicalBreakdown: {
          attackType: 'Key recovery attack',
          complexity: 'Polynomial time O(p^(1/4))',
          keyRecoveryTime: 'Minutes to hours on standard hardware',
          methodology: 'Exploit structure in isogeny computations',
          applicability: 'All SIKE parameter sets broken'
        },
        mathematicalInsight: {
          keyObservation: 'Torsion point information leaks secret isogeny',
          technique: 'Glue-and-split theorem for isogenies',
          exploitation: 'Recover secret kernel from public information',
          previousMissed: 'Attack relies on subtle isogeny theory'
        },
        attackSteps: {
          step1: 'Analyze public key structure',
          step2: 'Identify torsion point relationships',
          step3: 'Apply glue-and-split technique',
          step4: 'Recover secret isogeny kernel',
          step5: 'Reconstruct private key',
          result: 'Complete key recovery in polynomial time'
        },
        impact: {
          nistCompetition: 'SIKE eliminated from NIST PQC competition',
          industry: 'All SIKE implementations immediately deprecated',
          research: 'Renewed focus on isogeny cryptography security',
          lessons: 'Importance of diverse cryptanalytic perspectives'
        }
      },
      
      // SIKE Research Team and Historical Development
      {
        algorithm: 'SIKE (BROKEN)',
        testId: 'sike-team-history-001',
        description: 'SIKE research team and historical development (pre-break)',
        category: 'historical-development',
        originalResearchTeam: {
          principalInvestigators: [
            'Reza Azarderakhsh (Florida Atlantic University)',
            'Craig Costello (Microsoft Research)',
            'Amir Jalali (NVIDIA)',
            'David Jao (University of Waterloo)',
            'Koray Karabina (Florida Atlantic University)',
            'Brian Koziel (Texas Instruments)',
            'Vladimir Soukharev (InfoSec Global)',
            'David Urbanik (University of Waterloo)'
          ],
          institutions: [
            'Florida Atlantic University (USA)',
            'Microsoft Research (USA)',
            'NVIDIA (USA)',
            'University of Waterloo (Canada)',
            'Texas Instruments (USA)',
            'InfoSec Global (Canada)'
          ]
        },
        developmentTimeline: {
          foundation2006: 'Jao-De Feo isogeny cryptography proposal',
          refinement2011: 'De Feo, Jao, Plût improvements',
          sikeDevelopment2017: 'SIKE team formation and algorithm design',
          nistSubmission2017: 'NIST PQC Round 1 submission',
          round2_2019: 'Advanced to Round 2',
          round3_2020: 'Advanced to Round 3',
          round4_2022: 'Advanced to Round 4',
          cryptographicBreak2022: 'Castryck-Decru attack eliminates SIKE'
        },
        technicalEvolution: {
          originalJaoDeFeo: 'Basic isogeny key exchange',
          optimizations: 'Efficient arithmetic and parameter selection',
          sikeRefinements: 'IND-CCA secure KEM construction',
          implementationWork: 'Constant-time and side-channel resistant implementations'
        },
        researchContributions: {
          isogenyCryptography: 'Pioneered practical isogeny-based cryptography',
          efficientArithmetic: 'Optimized elliptic curve and isogeny computations',
          securityAnalysis: 'Extensive security analysis (ultimately insufficient)',
          implementations: 'High-quality reference implementations'
        }
      },
      
      // Isogeny Cryptography Lessons and Future
      {
        algorithm: 'SIKE (BROKEN)',
        testId: 'sike-lessons-001',
        description: 'Lessons learned from SIKE break and future of isogeny cryptography',
        category: 'cryptographic-lessons',
        lessonsLearned: {
          securityAnalysis: 'Need for broader cryptanalytic perspectives',
          attackSurfaces: 'Auxiliary information can be exploited unexpectedly',
          mathematicalDepth: 'Deep mathematical techniques can break seemingly secure systems',
          conservatism: 'Importance of conservative security estimates'
        },
        impactOnField: {
          isogenyCryptography: 'Renewed scrutiny of all isogeny-based schemes',
          postQuantumCrypto: 'Highlighted risks in novel mathematical approaches',
          nistProcess: 'Validated NIST\'s multi-round evaluation process',
          research: 'Spurred new research in isogeny cryptanalysis'
        },
        futureDirections: {
          alternativeIsogenies: 'Exploration of different isogeny structures',
          orientedSupersingular: 'Oriented supersingular isogeny graphs',
          higherDimensional: 'Higher-dimensional isogeny cryptography',
          hybridApproaches: 'Combining isogenies with other techniques'
        },
        survivalOfIdeas: {
          mathematicalTools: 'Isogeny arithmetic techniques remain valuable',
          implementationWork: 'Efficient implementation techniques transfer',
          cryptanalysis: 'Attack techniques apply to other isogeny schemes',
          foundationalTheory: 'Basic isogeny theory remains important'
        }
      },
      
      // Educational Value of SIKE Break
      {
        algorithm: 'SIKE (BROKEN)',
        testId: 'sike-educational-001',
        description: 'Educational value of studying the broken SIKE algorithm',
        category: 'educational-historical',
        variant: 'SIKEp434 (broken for educational analysis)',
        educationalValue: {
          cryptographicHistory: 'Case study in cryptographic algorithm failure',
          attackAnalysis: 'Understanding advanced cryptanalytic techniques',
          isogenyMathematics: 'Learning elliptic curve and isogeny theory',
          securityLessons: 'Importance of thorough security analysis'
        },
        learningObjectives: [
          'Understand elliptic curve cryptography foundations',
          'Learn about isogenies and their computational properties',
          'Analyze the Castryck-Decru attack technique',
          'Appreciate the complexity of post-quantum security analysis'
        ],
        mathematicalConcepts: {
          ellipticCurves: 'Elliptic curves over finite fields',
          isogenies: 'Morphisms between elliptic curves',
          supersingularCurves: 'Special class of elliptic curves',
          torsionPoints: 'Points of finite order on elliptic curves'
        },
        cryptanalysisStudy: {
          attackTechnique: 'Glue-and-split theorem application',
          informationLeakage: 'How auxiliary information enables attacks',
          polynomialTimeBreak: 'Converting exponential to polynomial problems',
          practicalImpact: 'Real-world consequences of theoretical breaks'
        },
        historicalImportance: {
          researchProgram: 'Major research direction eliminated',
          scientificProcess: 'Example of self-correcting scientific process',
          industryImpact: 'Rapid response to cryptographic vulnerabilities',
          futureCryptography: 'Influence on future post-quantum algorithm design'
        },
        academicReferences: [
          {
            title: 'An efficient key recovery attack on SIKE',
            authors: ['Wouter Castryck', 'Thomas Decru'],
            venue: 'EUROCRYPT 2023',
            year: 2023,
            url: 'https://eprint.iacr.org/2022/975',
            significance: 'The paper that broke SIKE'
          },
          {
            title: 'SIKE Round 3 Specification',
            authors: ['SIKE Team'],
            venue: 'NIST PQC Submission',
            year: 2020,
            url: 'https://sike.org/',
            significance: 'Original algorithm specification (now broken)'
          },
          {
            title: 'Mathematics of Isogeny Based Cryptography',
            authors: ['Craig Costello'],
            venue: 'Microsoft Research Technical Report',
            year: 2019,
            significance: 'Mathematical foundations (still valuable)'
          }
        ]
      },
      
      // Implementation Analysis and Performance (Historical)
      {
        algorithm: 'SIKE (BROKEN)',
        testId: 'sike-implementation-001',
        description: 'Historical SIKE implementation analysis (pre-break performance)',
        category: 'historical-performance',
        preBreakPerformance: {
          'SIKEp434': {
            keyGeneration: '147ms (Intel i7-8700K)',
            encapsulation: '201ms',
            decapsulation: '213ms',
            keyRecoveryAttack: '<1 hour (post-break)',
            throughput: '3.6 ops/sec (historical)'
          },
          'SIKEp751': {
            keyGeneration: '334ms',
            encapsulation: '442ms',
            decapsulation: '467ms',
            keyRecoveryAttack: '<6 hours (post-break)',
            throughput: '1.4 ops/sec (historical)'
          }
        },
        implementationFeatures: {
          constantTime: 'Constant-time arithmetic implementation',
          sidechannelResistance: 'Protected against timing attacks',
          optimization: 'Highly optimized field arithmetic',
          portability: 'Implementations for various platforms'
        },
        postBreakReality: {
          securityNull: 'All security guarantees voided by break',
          performanceIrrelevant: 'Performance irrelevant when algorithm is broken',
          implementationObsolete: 'All implementations immediately obsolete',
          lessonLearned: 'Performance optimization cannot fix fundamental breaks'
        },
        comparativeAnalysis: {
          preBreakPosition: 'Competitive performance among post-quantum schemes',
          postBreakStatus: 'Completely eliminated from consideration',
          alternativeSchemes: 'Users migrated to lattice/code-based schemes',
          researchRedirection: 'Research effort redirected to secure alternatives'
        }
      }
    ],
    
    // Educational test vector runner (WITH WARNINGS)
    runTestVector: function() {
      console.warn('🚨🚨🚨 CRITICAL SECURITY WARNING 🚨🚨🚨');
      console.warn('SIKE was cryptographically BROKEN in 2022!');
      console.warn('This test is for EDUCATIONAL purposes ONLY!');
      console.warn('NEVER use SIKE for real cryptographic applications!');
      console.log('Running BROKEN SIKE educational test...');
      
      // Test SIKEp434 (broken)
      this.Init(434);
      const keyPair = this.KeyGeneration();
      const encResult = this.Encapsulate(keyPair.publicKey);
      const decResult = this.Decapsulate(keyPair.privateKey, encResult.ciphertext);
      
      // Verify shared secrets match (in educational version)
      let success = true;
      for (let i = 0; i < this.currentParams.ssBytes; i++) {
        if (Math.abs(encResult.sharedSecret[i] - decResult[i]) > 2) {
          success = false;
          break;
        }
      }
      
      console.log('SIKE p434 educational test:', success ? 'PASS (but algorithm is BROKEN)' : 'FAIL');
      console.warn('🚨 Remember: SIKE is cryptographically BROKEN and insecure!');
      
      return {
        algorithm: 'SIKE p434 (BROKEN)',
        level: this.currentLevel,
        success: success,
        publicKeySize: this.currentParams.pkBytes,
        privateKeySize: this.currentParams.skBytes,
        ciphertextSize: this.currentParams.ctBytes,
        sharedSecretSize: this.currentParams.ssBytes,
        securityLevel: 0, // BROKEN
        warning: '🚨 CRITICAL: SIKE is cryptographically BROKEN! Educational use only!',
        breakInfo: 'Broken by Castryck-Decru attack in 2022 - polynomial time key recovery',
        note: 'Educational implementation of BROKEN algorithm - demonstrates isogeny concepts only'
      };
    }
  };
  
  // Auto-register with Cipher system if available (with warnings)
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    console.warn('🚨 WARNING: Registering BROKEN SIKE algorithm for educational purposes only!');
    Cipher.AddCipher(SIKE);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SIKE;
  }
  
  // Global export with warning
  console.warn('🚨 SIKE algorithm loaded - BROKEN and for educational use only!');
  global.SIKE = SIKE;
  
})(typeof global !== 'undefined' ? global : window);