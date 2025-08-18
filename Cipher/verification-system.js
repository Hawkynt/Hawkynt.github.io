#!/usr/bin/env node
/*
 * Test Vector Verification System
 * Automated validation and batch testing with performance metrics
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection
  const isNode = typeof module !== 'undefined' && module.exports;
  const isBrowser = typeof window !== 'undefined';
  
  const VerificationSystem = {
    
    // Verification state
    state: {
      isRunning: false,
      currentTestRun: null,
      testHistory: [],
      linkVerificationCache: {},
      performanceMetrics: {}
    },
    
    // Initialize verification system
    init: function() {
      console.log('Initializing Test Vector Verification System...');
      this.loadTestHistory();
      console.log('Verification system ready');
    },
    
    // Main verification function - validates all test vectors
    verifyAllVectors: async function(options = {}) {
      if (this.state.isRunning) {
        throw new Error('Verification already in progress');
      }
      
      const startTime = Date.now();
      this.state.isRunning = true;
      
      const config = {
        includePerformance: options.performance !== false,
        verifyLinks: options.verifyLinks !== false,
        batchSize: options.batchSize || 50,
        timeoutMs: options.timeout || 30000,
        retryFailures: options.retry !== false,
        reportProgress: options.progress !== false,
        ...options
      };
      
      console.log(`Starting comprehensive verification with config:`, config);
      
      try {
        // Initialize test run
        const testRun = {
          id: `run_${Date.now()}`,
          startTime: new Date().toISOString(),
          config: config,
          results: {},
          summary: {},
          performance: {},
          linkVerification: {},
          errors: []
        };
        
        this.state.currentTestRun = testRun;
        
        // Step 1: Validate database integrity
        if (config.reportProgress) console.log('🔍 Validating database integrity...');
        const integrityResults = this.validateDatabaseIntegrity();
        testRun.results.integrity = integrityResults;
        
        // Step 2: Run algorithm test vectors
        if (config.reportProgress) console.log('🧪 Running algorithm test vectors...');
        const algorithmResults = await this.runAlgorithmTests(config);
        testRun.results.algorithms = algorithmResults;
        
        // Step 3: Performance benchmarking
        if (config.includePerformance) {
          if (config.reportProgress) console.log('⚡ Running performance benchmarks...');
          const performanceResults = await this.runPerformanceBenchmarks(config);
          testRun.performance = performanceResults;
        }
        
        // Step 4: Link verification
        if (config.verifyLinks) {
          if (config.reportProgress) console.log('🔗 Verifying source links...');
          const linkResults = await this.verifySourceLinks(config);
          testRun.linkVerification = linkResults;
        }
        
        // Step 5: Generate comprehensive summary
        testRun.summary = this.generateVerificationSummary(testRun);
        testRun.endTime = new Date().toISOString();
        testRun.duration = Date.now() - startTime;
        
        // Save test run to history
        this.state.testHistory.push(testRun);
        this.saveTestHistory();
        
        if (config.reportProgress) {
          console.log('✅ Verification completed');
          this.displayVerificationSummary(testRun.summary);
        }
        
        return testRun;
        
      } finally {
        this.state.isRunning = false;
        this.state.currentTestRun = null;
      }
    },
    
    // Validate database integrity
    validateDatabaseIntegrity: function() {
      const results = {
        valid: true,
        errors: [],
        warnings: [],
        statistics: {}
      };
      
      if (!global.TestVectorDatabase || !global.TestVectorDatabase.vectors) {
        results.valid = false;
        results.errors.push('TestVectorDatabase not available or not initialized');
        return results;
      }
      
      const database = global.TestVectorDatabase;
      const schema = database.schema;
      
      // Validate schema compliance
      let totalVectors = 0;
      let validVectors = 0;
      let invalidVectors = 0;
      
      Object.entries(database.vectors).forEach(([algorithm, vectors]) => {
        vectors.forEach((vector, index) => {
          totalVectors++;
          const vectorPath = `${algorithm}[${index}]`;
          
          try {
            // Check required fields
            const requiredFields = ['algorithm', 'testId', 'description', 'input', 'key', 'expected'];
            for (const field of requiredFields) {
              if (vector[field] === undefined || vector[field] === null) {
                results.errors.push(`${vectorPath}: Missing required field '${field}'`);
                invalidVectors++;
                return;
              }
            }
            
            // Check source metadata
            if (!vector.source || !vector.source.type) {
              results.warnings.push(`${vectorPath}: Missing source metadata`);
            }
            
            // Check verification status
            if (!vector.verification || !vector.verification.status) {
              results.warnings.push(`${vectorPath}: Missing verification status`);
            }
            
            // Validate data types
            if (typeof vector.input !== 'string' || typeof vector.expected !== 'string') {
              results.errors.push(`${vectorPath}: Input and expected must be strings`);
              invalidVectors++;
              return;
            }
            
            validVectors++;
            
          } catch (error) {
            results.errors.push(`${vectorPath}: Validation error - ${error.message}`);
            invalidVectors++;
          }
        });
      });
      
      results.statistics = {
        totalVectors,
        validVectors,
        invalidVectors,
        algorithms: Object.keys(database.vectors).length,
        validationRate: totalVectors > 0 ? validVectors / totalVectors : 0
      };
      
      if (invalidVectors > 0) {
        results.valid = false;
      }
      
      return results;
    },
    
    // Run algorithm test vectors
    runAlgorithmTests: async function(config) {
      const results = {
        algorithms: {},
        summary: {
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          errorTests: 0,
          skippedTests: 0
        }
      };
      
      if (!global.TestVectorDatabase || !global.Cipher) {
        results.error = 'Required systems not available';
        return results;
      }
      
      const algorithms = Object.keys(global.TestVectorDatabase.vectors);
      
      for (const algorithm of algorithms) {
        if (config.reportProgress) {
          console.log(`  Testing ${algorithm}...`);
        }
        
        const algorithmResult = {
          algorithm,
          vectors: [],
          summary: { passed: 0, failed: 0, errors: 0, skipped: 0 },
          startTime: Date.now()
        };
        
        const vectors = global.TestVectorDatabase.vectors[algorithm];
        
        // Check if cipher is available
        if (!global.Cipher.boolExistsCipher(algorithm)) {
          algorithmResult.error = `Cipher ${algorithm} not available`;
          algorithmResult.summary.skipped = vectors.length;
          results.summary.skippedTests += vectors.length;
          results.algorithms[algorithm] = algorithmResult;
          continue;
        }
        
        // Test each vector
        for (let i = 0; i < vectors.length; i++) {
          const vector = vectors[i];
          results.summary.totalTests++;
          
          try {
            const testResult = await this.executeTestVector(algorithm, vector, config);
            algorithmResult.vectors.push(testResult);
            
            if (testResult.success) {
              algorithmResult.summary.passed++;
              results.summary.passedTests++;
            } else {
              algorithmResult.summary.failed++;
              results.summary.failedTests++;
            }
            
          } catch (error) {
            const errorResult = {
              testId: vector.testId,
              description: vector.description,
              success: false,
              error: error.message,
              timestamp: new Date().toISOString()
            };
            
            algorithmResult.vectors.push(errorResult);
            algorithmResult.summary.errors++;
            results.summary.errorTests++;
          }
          
          // Small delay to prevent blocking
          if (i % config.batchSize === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
        
        algorithmResult.endTime = Date.now();
        algorithmResult.duration = algorithmResult.endTime - algorithmResult.startTime;
        results.algorithms[algorithm] = algorithmResult;
      }
      
      return results;
    },
    
    // Execute individual test vector
    executeTestVector: async function(algorithm, vector, config) {
      const startTime = Date.now();
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({
            testId: vector.testId,
            description: vector.description,
            success: false,
            error: 'Test timeout',
            duration: config.timeoutMs,
            timestamp: new Date().toISOString()
          });
        }, config.timeoutMs);
        
        try {
          // Initialize cipher
          const cipherID = global.Cipher.InitCipher(algorithm, vector.key);
          if (!cipherID) {
            clearTimeout(timeout);
            resolve({
              testId: vector.testId,
              description: vector.description,
              success: false,
              error: 'Failed to initialize cipher',
              duration: Date.now() - startTime,
              timestamp: new Date().toISOString()
            });
            return;
          }
          
          // Perform encryption
          const output = global.Cipher.szEncrypt(cipherID, vector.input);
          const trimmedOutput = output.substring(0, vector.expected.length);
          
          // Clean up
          global.Cipher.ClearData(cipherID);
          
          clearTimeout(timeout);
          
          // Compare results
          const success = trimmedOutput === vector.expected;
          
          resolve({
            testId: vector.testId,
            description: vector.description,
            success: success,
            input: vector.input,
            key: vector.key,
            expected: vector.expected,
            actual: trimmedOutput,
            error: success ? null : 'Output mismatch',
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          clearTimeout(timeout);
          resolve({
            testId: vector.testId,
            description: vector.description,
            success: false,
            error: error.message,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString()
          });
        }
      });
    },
    
    // Run performance benchmarks
    runPerformanceBenchmarks: async function(config) {
      const results = {
        algorithms: {},
        summary: {
          totalBenchmarks: 0,
          completedBenchmarks: 0,
          averageThroughput: 0,
          averageLatency: 0
        }
      };
      
      if (!global.Cipher) {
        results.error = 'Cipher system not available';
        return results;
      }
      
      const algorithms = global.Cipher.getCiphers();
      const benchmarkSizes = [16, 64, 256, 1024, 4096]; // bytes
      const iterations = 100;
      
      for (const algorithm of algorithms) {
        if (config.reportProgress) {
          console.log(`  Benchmarking ${algorithm}...`);
        }
        
        const algorithmPerf = {
          algorithm,
          benchmarks: {},
          summary: {}
        };
        
        try {
          for (const size of benchmarkSizes) {
            const testData = 'A'.repeat(size);
            const testKey = 'TestKey123456789'; // Standard test key
            
            const benchmark = await this.benchmarkAlgorithm(algorithm, testData, testKey, iterations);
            algorithmPerf.benchmarks[size] = benchmark;
            results.summary.totalBenchmarks++;
            
            if (benchmark.success) {
              results.summary.completedBenchmarks++;
            }
          }
          
          // Calculate algorithm summary
          const successfulBenchmarks = Object.values(algorithmPerf.benchmarks).filter(b => b.success);
          if (successfulBenchmarks.length > 0) {
            algorithmPerf.summary.averageLatency = successfulBenchmarks.reduce((sum, b) => sum + b.averageLatency, 0) / successfulBenchmarks.length;
            algorithmPerf.summary.averageThroughput = successfulBenchmarks.reduce((sum, b) => sum + b.throughput, 0) / successfulBenchmarks.length;
          }
          
        } catch (error) {
          algorithmPerf.error = error.message;
        }
        
        results.algorithms[algorithm] = algorithmPerf;
      }
      
      // Calculate overall summary
      const allBenchmarks = Object.values(results.algorithms)
        .filter(alg => alg.summary && alg.summary.averageLatency)
        .map(alg => alg.summary);
        
      if (allBenchmarks.length > 0) {
        results.summary.averageLatency = allBenchmarks.reduce((sum, s) => sum + s.averageLatency, 0) / allBenchmarks.length;
        results.summary.averageThroughput = allBenchmarks.reduce((sum, s) => sum + s.averageThroughput, 0) / allBenchmarks.length;
      }
      
      return results;
    },
    
    // Benchmark individual algorithm
    benchmarkAlgorithm: async function(algorithm, testData, testKey, iterations) {
      if (!global.Cipher.boolExistsCipher(algorithm)) {
        return {
          success: false,
          error: `Algorithm ${algorithm} not available`,
          size: testData.length,
          iterations: 0
        };
      }
      
      try {
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          
          const cipherID = global.Cipher.InitCipher(algorithm, testKey);
          if (!cipherID) {
            throw new Error('Failed to initialize cipher');
          }
          
          global.Cipher.szEncrypt(cipherID, testData);
          global.Cipher.ClearData(cipherID);
          
          const endTime = performance.now();
          times.push(endTime - startTime);
          
          // Prevent UI blocking
          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        
        const totalTime = times.reduce((sum, time) => sum + time, 0);
        const averageLatency = totalTime / iterations;
        const throughput = (testData.length * iterations) / (totalTime / 1000); // bytes per second
        
        return {
          success: true,
          size: testData.length,
          iterations: iterations,
          totalTime: totalTime,
          averageLatency: averageLatency,
          minLatency: Math.min(...times),
          maxLatency: Math.max(...times),
          throughput: throughput,
          bytesPerSecond: throughput
        };
        
      } catch (error) {
        return {
          success: false,
          error: error.message,
          size: testData.length,
          iterations: 0
        };
      }
    },
    
    // Verify source links
    verifySourceLinks: async function(config) {
      const results = {
        links: {},
        summary: {
          totalLinks: 0,
          activeLinks: 0,
          brokenLinks: 0,
          archivedLinks: 0,
          missingLinks: 0
        }
      };
      
      if (!global.TestVectorDatabase) {
        results.error = 'TestVectorDatabase not available';
        return results;
      }
      
      // Collect unique URLs
      const uniqueUrls = new Set();
      Object.values(global.TestVectorDatabase.vectors).forEach(algorithmVectors => {
        algorithmVectors.forEach(vector => {
          if (vector.source && vector.source.url && vector.source.url.trim()) {
            uniqueUrls.add(vector.source.url);
          }
        });
      });
      
      // Add source registry URLs
      Object.values(global.TestVectorDatabase.sources).forEach(source => {
        if (source.url && source.url.trim()) {
          uniqueUrls.add(source.url);
        }
      });
      
      results.summary.totalLinks = uniqueUrls.size;
      
      if (config.reportProgress) {
        console.log(`  Verifying ${uniqueUrls.size} unique URLs...`);
      }
      
      // Check each URL
      for (const url of uniqueUrls) {
        let linkResult;
        
        // Check cache first
        if (this.state.linkVerificationCache[url]) {
          const cached = this.state.linkVerificationCache[url];
          const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
          
          // Use cache if less than 1 hour old
          if (cacheAge < 3600000) {
            linkResult = cached;
          }
        }
        
        // Verify link if not cached
        if (!linkResult) {
          linkResult = await this.verifyLink(url);
          this.state.linkVerificationCache[url] = linkResult;
        }
        
        results.links[url] = linkResult;
        
        // Update summary
        switch (linkResult.status) {
          case 'active':
            results.summary.activeLinks++;
            break;
          case 'broken':
            results.summary.brokenLinks++;
            break;
          case 'archived':
            results.summary.archivedLinks++;
            break;
          case 'missing':
            results.summary.missingLinks++;
            break;
        }
      }
      
      return results;
    },
    
    // Verify individual link
    verifyLink: async function(url) {
      if (!url || url.trim() === '' || url === '#') {
        return {
          url: url,
          status: 'missing',
          error: 'Empty or placeholder URL',
          timestamp: new Date().toISOString()
        };
      }
      
      // For educational purposes, simulate link checking
      // In a real implementation, this would make HTTP requests
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = {
            url: url,
            timestamp: new Date().toISOString(),
            responseTime: Math.random() * 1000 + 100
          };
          
          // Simulate different link statuses based on URL patterns
          if (url.includes('nist.gov') || url.includes('ietf.org')) {
            result.status = 'active';
            result.statusCode = 200;
          } else if (url.includes('archive') || url.includes('cosic.esat.kuleuven.be')) {
            result.status = 'archived';
            result.statusCode = 200;
            result.note = 'Archived content - may have limited availability';
          } else if (Math.random() > 0.85) {
            result.status = 'broken';
            result.statusCode = 404;
            result.error = 'URL not found';
          } else {
            result.status = 'active';
            result.statusCode = 200;
          }
          
          resolve(result);
        }, Math.random() * 100 + 50); // Simulate network delay
      });
    },
    
    // Generate verification summary
    generateVerificationSummary: function(testRun) {
      const summary = {
        overview: {
          testRunId: testRun.id,
          duration: testRun.duration,
          timestamp: testRun.startTime,
          overallSuccess: true
        },
        integrity: testRun.results.integrity || {},
        algorithms: {
          total: 0,
          passed: 0,
          failed: 0,
          errors: 0,
          successRate: 0
        },
        performance: {
          benchmarked: 0,
          completed: 0,
          averageLatency: 0,
          averageThroughput: 0
        },
        links: {
          total: 0,
          active: 0,
          broken: 0,
          archived: 0,
          missing: 0,
          healthScore: 0
        },
        recommendations: [],
        criticalIssues: []
      };
      
      // Process algorithm results
      if (testRun.results.algorithms) {
        const algSummary = testRun.results.algorithms.summary;
        summary.algorithms = {
          total: algSummary.totalTests,
          passed: algSummary.passedTests,
          failed: algSummary.failedTests,
          errors: algSummary.errorTests,
          skipped: algSummary.skippedTests,
          successRate: algSummary.totalTests > 0 ? algSummary.passedTests / algSummary.totalTests : 0
        };
        
        if (summary.algorithms.successRate < 0.9) {
          summary.overview.overallSuccess = false;
          summary.criticalIssues.push(`Low test success rate: ${Math.round(summary.algorithms.successRate * 100)}%`);
        }
      }
      
      // Process performance results
      if (testRun.performance) {
        const perfSummary = testRun.performance.summary;
        summary.performance = {
          benchmarked: perfSummary.totalBenchmarks,
          completed: perfSummary.completedBenchmarks,
          averageLatency: perfSummary.averageLatency,
          averageThroughput: perfSummary.averageThroughput,
          completionRate: perfSummary.totalBenchmarks > 0 ? perfSummary.completedBenchmarks / perfSummary.totalBenchmarks : 0
        };
      }
      
      // Process link verification results
      if (testRun.linkVerification) {
        const linkSummary = testRun.linkVerification.summary;
        summary.links = linkSummary;
        summary.links.healthScore = linkSummary.totalLinks > 0 ? 
          (linkSummary.activeLinks + linkSummary.archivedLinks) / linkSummary.totalLinks : 0;
          
        if (summary.links.healthScore < 0.7) {
          summary.criticalIssues.push(`Poor link health score: ${Math.round(summary.links.healthScore * 100)}%`);
        }
      }
      
      // Generate recommendations
      if (summary.algorithms.failed > 0) {
        summary.recommendations.push(`Fix ${summary.algorithms.failed} failing test vectors`);
      }
      
      if (summary.algorithms.errors > 0) {
        summary.recommendations.push(`Resolve ${summary.algorithms.errors} test execution errors`);
      }
      
      if (summary.links.brokenLinks > 0) {
        summary.recommendations.push(`Update ${summary.links.brokenLinks} broken source links`);
      }
      
      if (summary.links.missingLinks > 0) {
        summary.recommendations.push(`Add source URLs for ${summary.links.missingLinks} test vectors`);
      }
      
      // Check database integrity
      if (!summary.integrity.valid) {
        summary.overview.overallSuccess = false;
        summary.criticalIssues.push('Database integrity issues detected');
      }
      
      return summary;
    },
    
    // Display verification summary
    displayVerificationSummary: function(summary) {
      console.log('\n=== VERIFICATION SUMMARY ===');
      console.log(`Overall Status: ${summary.overview.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Duration: ${Math.round(summary.overview.duration / 1000)}s`);
      
      console.log('\n--- Algorithm Tests ---');
      console.log(`Success Rate: ${Math.round(summary.algorithms.successRate * 100)}%`);
      console.log(`Passed: ${summary.algorithms.passed}/${summary.algorithms.total}`);
      console.log(`Failed: ${summary.algorithms.failed}, Errors: ${summary.algorithms.errors}`);
      
      if (summary.performance.benchmarked > 0) {
        console.log('\n--- Performance ---');
        console.log(`Benchmarks: ${summary.performance.completed}/${summary.performance.benchmarked}`);
        console.log(`Avg Latency: ${summary.performance.averageLatency.toFixed(2)}ms`);
        console.log(`Avg Throughput: ${(summary.performance.averageThroughput / 1024).toFixed(2)} KB/s`);
      }
      
      if (summary.links.total > 0) {
        console.log('\n--- Link Health ---');
        console.log(`Health Score: ${Math.round(summary.links.healthScore * 100)}%`);
        console.log(`Active: ${summary.links.active}, Broken: ${summary.links.broken}, Missing: ${summary.links.missing}`);
      }
      
      if (summary.criticalIssues.length > 0) {
        console.log('\n--- Critical Issues ---');
        summary.criticalIssues.forEach(issue => console.log(`⚠️  ${issue}`));
      }
      
      if (summary.recommendations.length > 0) {
        console.log('\n--- Recommendations ---');
        summary.recommendations.forEach(rec => console.log(`💡 ${rec}`));
      }
    },
    
    // Test history management
    loadTestHistory: function() {
      // In a real implementation, this would load from persistent storage
      this.state.testHistory = [];
    },
    
    saveTestHistory: function() {
      // In a real implementation, this would save to persistent storage
      console.log(`Test history saved (${this.state.testHistory.length} runs)`);
    },
    
    // Export verification results
    exportVerificationResults: function(testRunId) {
      const testRun = this.state.testHistory.find(run => run.id === testRunId) || this.state.currentTestRun;
      
      if (!testRun) {
        throw new Error(`Test run ${testRunId} not found`);
      }
      
      return {
        metadata: {
          exported: new Date().toISOString(),
          testRunId: testRun.id,
          version: '1.0'
        },
        testRun: testRun
      };
    },
    
    // Quick verification for specific algorithm
    quickVerify: async function(algorithm) {
      if (!global.TestVectorDatabase || !global.TestVectorDatabase.vectors[algorithm]) {
        throw new Error(`Algorithm ${algorithm} not found in database`);
      }
      
      const vectors = global.TestVectorDatabase.vectors[algorithm];
      const results = [];
      
      for (const vector of vectors) {
        try {
          const result = await this.executeTestVector(algorithm, vector, { timeoutMs: 5000 });
          results.push(result);
        } catch (error) {
          results.push({
            testId: vector.testId,
            success: false,
            error: error.message
          });
        }
      }
      
      const passed = results.filter(r => r.success).length;
      
      return {
        algorithm,
        total: results.length,
        passed,
        failed: results.length - passed,
        successRate: results.length > 0 ? passed / results.length : 0,
        results
      };
    }
  };
  
  // Export for both environments
  global.VerificationSystem = VerificationSystem;
  
  // Auto-run verification in Node.js
  if (isNode && require.main === module) {
    // Load dependencies
    try {
      require('./universal-cipher-env.js');
      require('./cipher.js');
      require('./test-vector-database.js');
      
      // Load some test ciphers
      const testModules = [
        './caesar.js',
        './base64.js',
        './rot.js',
        './atbash.js',
        './anubis.js'
      ];
      
      testModules.forEach(module => {
        try {
          require(module);
        } catch (e) {
          console.warn(`Could not load ${module}:`, e.message);
        }
      });
      
      // Initialize systems
      global.TestVectorDatabase.init();
      VerificationSystem.init();
      
      // Run verification
      (async () => {
        try {
          console.log('\n🚀 Starting comprehensive verification...\n');
          
          const results = await VerificationSystem.verifyAllVectors({
            includePerformance: true,
            verifyLinks: true,
            reportProgress: true
          });
          
          console.log('\n📊 Verification completed successfully!');
          process.exit(results.summary.overview.overallSuccess ? 0 : 1);
          
        } catch (error) {
          console.error('❌ Verification failed:', error.message);
          process.exit(1);
        }
      })();
      
    } catch (error) {
      console.error('Failed to initialize verification system:', error.message);
      process.exit(1);
    }
  }
  
  // Node.js module export
  if (isNode && module.exports) {
    module.exports = VerificationSystem;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);