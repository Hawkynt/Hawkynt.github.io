#!/usr/bin/env node
/*
 * Test Vector Database and Management System
 * Comprehensive test vector tracking with origin metadata and verification
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection
  const isNode = typeof module !== 'undefined' && module.exports;
  const isBrowser = typeof window !== 'undefined';
  
  // Test Vector Database Schema
  const TestVectorDatabase = {
    
    // Metadata schema for test vectors
    schema: {
      // Core identification
      algorithm: 'string',          // Cipher algorithm name
      variant: 'string',           // Optional algorithm variant (e.g., AES-128, AES-256)
      testId: 'string',            // Unique test identifier
      description: 'string',       // Human-readable test description
      
      // Test data
      input: 'string',             // Plaintext input
      key: 'string',               // Encryption key
      expected: 'string',          // Expected ciphertext output
      iv: 'string',                // Optional initialization vector
      
      // Origin metadata
      source: {
        type: 'string',            // 'rfc', 'nist', 'ieee', 'academic', 'reference', 'generated'
        identifier: 'string',      // RFC number, NIST publication, etc.
        title: 'string',           // Official document title
        url: 'string',             // Working link to specification
        section: 'string',         // Section/appendix within document
        datePublished: 'string',   // Publication date (ISO 8601)
        dateAccessed: 'string',    // Last verified date (ISO 8601)
        authors: 'array',          // Document authors
        organization: 'string'     // Publishing organization
      },
      
      // Technical metadata
      category: 'string',          // 'official', 'reference', 'educational', 'edge-case', 'compliance'
      security: {
        level: 'string',           // 'production', 'test-only', 'demonstration', 'weak'
        notes: 'string'            // Security considerations
      },
      
      // Verification tracking
      verification: {
        status: 'string',          // 'verified', 'failed', 'pending', 'unknown'
        lastChecked: 'string',     // ISO 8601 timestamp
        checkedBy: 'string',       // Test system version
        errorDetails: 'string',    // Failure details if applicable
        linkStatus: 'string'       // 'active', 'broken', 'moved', 'archived'
      },
      
      // Implementation notes
      implementation: {
        complexity: 'string',      // 'trivial', 'standard', 'complex', 'edge-case'
        prerequisites: 'array',    // Required features/modes
        notes: 'string'           // Implementation-specific notes
      }
    },
    
    // Test vector registry - organized by algorithm
    vectors: {},
    
    // Source registry for link verification
    sources: {},
    
    // Initialize database
    init: function() {
      console.log('Initializing Test Vector Database...');
      this.loadExistingVectors();
      this.registerOfficialSources();
      console.log(`Database initialized with ${this.getTotalVectorCount()} test vectors across ${Object.keys(this.vectors).length} algorithms`);
    },
    
    // Load existing test vectors from universal cipher implementations
    loadExistingVectors: function() {
      // Extract test vectors from currently loaded ciphers
      if (typeof global.Cipher !== 'undefined') {
        const ciphers = global.Cipher.getCiphers();
        
        ciphers.forEach(cipherName => {
          const cipherObj = global.Cipher.objGetCipher(cipherName);
          if (cipherObj && cipherObj.testVectors) {
            this.importCipherTestVectors(cipherName, cipherObj.testVectors, cipherObj.metadata);
          }
        });
      }
    },
    
    // Import test vectors from cipher object
    importCipherTestVectors: function(algorithm, testVectors, metadata) {
      if (!this.vectors[algorithm]) {
        this.vectors[algorithm] = [];
      }
      
      testVectors.forEach((vector, index) => {
        const vectorData = {
          algorithm: algorithm,
          testId: `${algorithm}_${index + 1}`,
          description: vector.description || `${algorithm} test vector ${index + 1}`,
          input: vector.input,
          key: vector.key,
          expected: vector.expected,
          iv: vector.iv || '',
          
          source: this.extractSourceFromMetadata(metadata),
          category: this.categorizeTestVector(vector),
          
          security: {
            level: this.assessSecurityLevel(vector),
            notes: this.getSecurityNotes(vector)
          },
          
          verification: {
            status: 'pending',
            lastChecked: new Date().toISOString(),
            checkedBy: 'TestVectorDatabase v1.0'
          },
          
          implementation: {
            complexity: this.assessComplexity(vector),
            prerequisites: this.extractPrerequisites(metadata),
            notes: this.getImplementationNotes(vector, metadata)
          }
        };
        
        this.vectors[algorithm].push(vectorData);
      });
    },
    
    // Extract source information from cipher metadata
    extractSourceFromMetadata: function(metadata) {
      if (!metadata) {
        return {
          type: 'generated',
          identifier: 'internal',
          title: 'Internal test vector',
          url: '',
          dateAccessed: new Date().toISOString(),
          organization: 'Cipher Collection Project'
        };
      }
      
      // Extract from metadata references
      if (metadata.references && metadata.references.length > 0) {
        const primary = metadata.references[0];
        return {
          type: this.detectSourceType(primary.url),
          identifier: this.extractIdentifier(primary.url),
          title: primary.name,
          url: primary.url,
          dateAccessed: new Date().toISOString(),
          organization: this.extractOrganization(primary.url)
        };
      }
      
      return {
        type: 'reference',
        identifier: metadata.standard || 'unknown',
        title: metadata.description || `${metadata.algorithm} reference`,
        url: '',
        dateAccessed: new Date().toISOString()
      };
    },
    
    // Register official cryptographic standard sources
    registerOfficialSources: function() {
      this.sources = {
        // NIST Publications
        'fips-197': {
          title: 'Advanced Encryption Standard (AES)',
          url: 'https://csrc.nist.gov/publications/detail/fips/197/final',
          organization: 'NIST',
          type: 'fips',
          status: 'active'
        },
        'fips-46-3': {
          title: 'Data Encryption Standard (DES)',
          url: 'https://csrc.nist.gov/publications/detail/fips/46-3/archive/1999-10-25',
          organization: 'NIST',
          type: 'fips',
          status: 'archived'
        },
        'sp-800-38a': {
          title: 'Recommendation for Block Cipher Modes of Operation',
          url: 'https://csrc.nist.gov/publications/detail/sp/800-38a/final',
          organization: 'NIST',
          type: 'special-publication',
          status: 'active'
        },
        
        // RFC Standards
        'rfc-3713': {
          title: 'A Description of the Camellia Encryption Algorithm',
          url: 'https://tools.ietf.org/rfc/rfc3713.txt',
          organization: 'IETF',
          type: 'rfc',
          status: 'active'
        },
        'rfc-4648': {
          title: 'The Base16, Base32, and Base64 Data Encodings',
          url: 'https://tools.ietf.org/rfc/rfc4648.txt',
          organization: 'IETF',
          type: 'rfc',
          status: 'active'
        },
        'rfc-7539': {
          title: 'ChaCha20 and Poly1305 for IETF Protocols',
          url: 'https://tools.ietf.org/rfc/rfc7539.txt',
          organization: 'IETF',
          type: 'rfc',
          status: 'active'
        },
        
        // Academic and Research Sources
        'nessie': {
          title: 'NESSIE Project Test Vectors',
          url: 'https://www.cosic.esat.kuleuven.be/nessie/',
          organization: 'COSIC, K.U.Leuven',
          type: 'academic',
          status: 'archived'
        },
        'schneier-ac': {
          title: 'Applied Cryptography by Bruce Schneier',
          url: 'https://www.schneier.com/books/applied-cryptography/',
          organization: 'Bruce Schneier',
          type: 'reference',
          status: 'active'
        }
      };
    },
    
    // Utility functions for metadata extraction
    detectSourceType: function(url) {
      if (!url) return 'unknown';
      if (url.includes('nist.gov') || url.includes('csrc.nist.gov')) return 'nist';
      if (url.includes('ietf.org') || url.includes('rfc')) return 'rfc';
      if (url.includes('ieee.org')) return 'ieee';
      if (url.includes('edu') || url.includes('research')) return 'academic';
      return 'reference';
    },
    
    extractIdentifier: function(url) {
      if (!url) return 'unknown';
      
      // Extract RFC numbers
      const rfcMatch = url.match(/rfc(\d+)/i);
      if (rfcMatch) return `RFC ${rfcMatch[1]}`;
      
      // Extract FIPS numbers
      const fipsMatch = url.match(/fips[\/\-](\d+(?:\-\d+)?)/i);
      if (fipsMatch) return `FIPS ${fipsMatch[1]}`;
      
      // Extract NIST SP numbers
      const spMatch = url.match(/sp[\/\-](\d+(?:\-\d+[a-z]?)?)/i);
      if (spMatch) return `NIST SP ${spMatch[1]}`;
      
      return url.split('/').pop() || 'unknown';
    },
    
    extractOrganization: function(url) {
      if (!url) return 'Unknown';
      if (url.includes('nist.gov')) return 'NIST';
      if (url.includes('ietf.org')) return 'IETF';
      if (url.includes('ieee.org')) return 'IEEE';
      if (url.includes('schneier.com')) return 'Bruce Schneier';
      return 'Unknown';
    },
    
    categorizeTestVector: function(vector) {
      const desc = (vector.description || '').toLowerCase();
      if (desc.includes('rfc') || desc.includes('nist') || desc.includes('fips')) return 'official';
      if (desc.includes('boundary') || desc.includes('edge') || desc.includes('single bit')) return 'edge-case';
      if (desc.includes('educational') || desc.includes('demonstration')) return 'educational';
      if (desc.includes('reference') || desc.includes('standard')) return 'reference';
      return 'standard';
    },
    
    assessSecurityLevel: function(vector) {
      const key = vector.key || '';
      const input = vector.input || '';
      
      // Detect weak patterns
      if (key === '' || key.split('').every(c => c === key[0])) return 'weak';
      if (input.split('').every(c => c === input[0])) return 'test-only';
      if ((vector.description || '').toLowerCase().includes('educational')) return 'demonstration';
      return 'production';
    },
    
    getSecurityNotes: function(vector) {
      const level = this.assessSecurityLevel(vector);
      switch (level) {
        case 'weak': return 'Uses weak or predictable key patterns - not suitable for production';
        case 'test-only': return 'Designed for testing purposes with simplified patterns';
        case 'demonstration': return 'Educational example for learning cryptographic concepts';
        default: return 'Standard security considerations apply';
      }
    },
    
    assessComplexity: function(vector) {
      const desc = (vector.description || '').toLowerCase();
      if (desc.includes('basic') || desc.includes('simple')) return 'trivial';
      if (desc.includes('edge') || desc.includes('boundary')) return 'edge-case';
      if (desc.includes('complex') || desc.includes('advanced')) return 'complex';
      return 'standard';
    },
    
    extractPrerequisites: function(metadata) {
      if (!metadata) return [];
      
      const prereqs = [];
      if (metadata.blockSize) prereqs.push(`Block size: ${metadata.blockSize} bits`);
      if (metadata.keyLength) prereqs.push(`Key length: ${metadata.keyLength} bits`);
      if (metadata.mode && metadata.mode !== 'ECB') prereqs.push(`Mode: ${metadata.mode}`);
      
      return prereqs;
    },
    
    getImplementationNotes: function(vector, metadata) {
      const notes = [];
      
      if (metadata && metadata.implementationNotes) {
        notes.push(metadata.implementationNotes);
      }
      
      const complexity = this.assessComplexity(vector);
      switch (complexity) {
        case 'trivial':
          notes.push('Straightforward implementation with basic algorithm features');
          break;
        case 'edge-case':
          notes.push('Tests boundary conditions and edge cases in implementation');
          break;
        case 'complex':
          notes.push('Requires careful attention to advanced cryptographic features');
          break;
      }
      
      return notes.join('. ');
    },
    
    // Database query and management functions
    getTotalVectorCount: function() {
      return Object.values(this.vectors).reduce((total, algorithmVectors) => total + algorithmVectors.length, 0);
    },
    
    getAlgorithmVectors: function(algorithm) {
      return this.vectors[algorithm] || [];
    },
    
    getVectorsByCategory: function(category) {
      const results = [];
      Object.values(this.vectors).forEach(algorithmVectors => {
        algorithmVectors.forEach(vector => {
          if (vector.category === category) {
            results.push(vector);
          }
        });
      });
      return results;
    },
    
    getVectorsBySource: function(sourceType) {
      const results = [];
      Object.values(this.vectors).forEach(algorithmVectors => {
        algorithmVectors.forEach(vector => {
          if (vector.source.type === sourceType) {
            results.push(vector);
          }
        });
      });
      return results;
    },
    
    getFailedVectors: function() {
      return this.getVectorsByVerificationStatus('failed');
    },
    
    getVectorsByVerificationStatus: function(status) {
      const results = [];
      Object.values(this.vectors).forEach(algorithmVectors => {
        algorithmVectors.forEach(vector => {
          if (vector.verification.status === status) {
            results.push(vector);
          }
        });
      });
      return results;
    },
    
    // Link verification and health checking
    verifySourceLinks: async function() {
      if (!isNode) {
        console.warn('Link verification requires Node.js environment');
        return {};
      }
      
      const results = {};
      const uniqueUrls = new Set();
      
      // Collect all unique URLs
      Object.values(this.vectors).forEach(algorithmVectors => {
        algorithmVectors.forEach(vector => {
          if (vector.source.url) {
            uniqueUrls.add(vector.source.url);
          }
        });
      });
      
      console.log(`Verifying ${uniqueUrls.size} unique source URLs...`);
      
      // Note: In a real implementation, you would use HTTP requests
      // For this educational example, we'll simulate the verification
      for (const url of uniqueUrls) {
        results[url] = {
          status: this.simulateLinkCheck(url),
          lastChecked: new Date().toISOString(),
          responseTime: Math.random() * 1000 + 200 // Simulated response time
        };
      }
      
      return results;
    },
    
    simulateLinkCheck: function(url) {
      // Simulate link checking based on URL patterns
      if (url.includes('nist.gov') || url.includes('ietf.org')) return 'active';
      if (url.includes('archive') || url.includes('cosic.esat.kuleuven.be')) return 'archived';
      if (url === '' || url === '#') return 'missing';
      return Math.random() > 0.1 ? 'active' : 'broken'; // 90% success rate simulation
    },
    
    // Export database for analysis
    exportDatabase: function() {
      return {
        metadata: {
          version: '1.0',
          exported: new Date().toISOString(),
          totalVectors: this.getTotalVectorCount(),
          algorithms: Object.keys(this.vectors).length
        },
        schema: this.schema,
        vectors: this.vectors,
        sources: this.sources
      };
    },
    
    // Generate database statistics
    generateStatistics: function() {
      const stats = {
        overview: {
          totalVectors: this.getTotalVectorCount(),
          algorithms: Object.keys(this.vectors).length,
          sources: Object.keys(this.sources).length
        },
        byCategory: {},
        bySource: {},
        byVerification: {},
        byComplexity: {},
        coverage: {}
      };
      
      // Initialize counters
      const categories = ['official', 'reference', 'educational', 'edge-case', 'standard'];
      const sources = ['nist', 'rfc', 'ieee', 'academic', 'reference', 'generated'];
      const verifications = ['verified', 'failed', 'pending', 'unknown'];
      const complexities = ['trivial', 'standard', 'complex', 'edge-case'];
      
      categories.forEach(cat => stats.byCategory[cat] = 0);
      sources.forEach(src => stats.bySource[src] = 0);
      verifications.forEach(ver => stats.byVerification[ver] = 0);
      complexities.forEach(comp => stats.byComplexity[comp] = 0);
      
      // Count vectors by various attributes
      Object.entries(this.vectors).forEach(([algorithm, vectors]) => {
        stats.coverage[algorithm] = {
          count: vectors.length,
          hasOfficial: vectors.some(v => v.category === 'official'),
          hasEdgeCases: vectors.some(v => v.category === 'edge-case'),
          verificationRate: vectors.filter(v => v.verification.status === 'verified').length / vectors.length
        };
        
        vectors.forEach(vector => {
          stats.byCategory[vector.category]++;
          stats.bySource[vector.source.type]++;
          stats.byVerification[vector.verification.status]++;
          stats.byComplexity[vector.implementation.complexity]++;
        });
      });
      
      return stats;
    }
  };
  
  // Export for both environments
  global.TestVectorDatabase = TestVectorDatabase;
  
  // Auto-initialize in Node.js
  if (isNode && require.main === module) {
    // Load cipher system first
    try {
      require('./universal-cipher-env.js');
      require('./cipher.js');
      
      // Load some universal ciphers for demonstration
      const demoModules = [
        './caesar.js',
        './base64.js',
        './rot.js',
        './atbash.js'
      ];
      
      demoModules.forEach(module => {
        try {
          require(module);
        } catch (e) {
          console.warn(`Could not load ${module}:`, e.message);
        }
      });
      
      // Initialize and demonstrate database
      TestVectorDatabase.init();
      
      const stats = TestVectorDatabase.generateStatistics();
      console.log('\n=== TEST VECTOR DATABASE STATISTICS ===');
      console.log(`Total vectors: ${stats.overview.totalVectors}`);
      console.log(`Algorithms: ${stats.overview.algorithms}`);
      console.log(`Sources: ${stats.overview.sources}`);
      
      console.log('\n=== COVERAGE BY ALGORITHM ===');
      Object.entries(stats.coverage).forEach(([algorithm, coverage]) => {
        const officialMark = coverage.hasOfficial ? '✓' : '✗';
        const edgeMark = coverage.hasEdgeCases ? '✓' : '✗';
        console.log(`${algorithm}: ${coverage.count} vectors | Official: ${officialMark} | Edge cases: ${edgeMark}`);
      });
      
    } catch (error) {
      console.error('Failed to initialize test vector database:', error.message);
      process.exit(1);
    }
  }
  
  // Node.js module export
  if (isNode && module.exports) {
    module.exports = TestVectorDatabase;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);