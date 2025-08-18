/*
 * Universal Compression Framework
 * Compatible with both Browser and Node.js environments
 * Supports all 47 compression algorithms as specified in mission
 * (c)2006-2025 Hawkynt
 * 
 * This framework provides:
 * - Universal compression algorithm interface
 * - Performance benchmarking and metrics
 * - Lossless compression verification
 * - Integration with OpCodes.js building blocks
 * - Test data management (Calgary/Canterbury corpus)
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven compression libraries for production systems.
 */

(function(global) {
  'use strict';
  
  // Environment detection and dependency loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('./OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes.js:', e.message);
    }
  }
  
  // Create Compression registry
  const Compression = {
    // Registry of all compression algorithms
    algorithms: {},
    
    // Test datasets (Calgary/Canterbury corpus samples)
    testData: {
      // Small test strings for quick validation
      simple: [
        'hello world',
        'aaaaaaaaaaa',
        'abcdefghijk',
        '1234567890',
        'The quick brown fox jumps over the lazy dog.',
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        'abababababababababababababababababab',
        'abcabcabcabcabcabcabcabcabcabcabcabc'
      ],
      
      // Calgary Corpus samples (simplified for testing)
      calgary: {
        'book1': 'It was the best of times, it was the worst of times, it was the age of wisdom...',
        'book2': 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs...',
        'geo': '123.456 789.012 345.678 901.234 567.890 123.456 789.012 345.678...',
        'news': 'WASHINGTON - The President announced today that the new policy will take effect...',
        'obj1': 'Binary data simulation: 0x00 0xFF 0x55 0xAA 0x00 0xFF 0x55 0xAA...',
        'obj2': 'More binary: 0x12 0x34 0x56 0x78 0x9A 0xBC 0xDE 0xF0 0x12 0x34...',
        'paper1': 'Abstract: This paper presents a novel approach to data compression...',
        'paper2': 'Introduction: Compression algorithms are essential for modern computing...',
        'pic': 'Image data simulation: RGBA values and pixel patterns...',
        'progc': 'int main(void) { printf("Hello World"); return 0; }',
        'progl': 'program hello; begin writeln("Hello World"); end.',
        'progp': 'program hello; var i: integer; begin for i := 1 to 10 do writeln(i); end.',
        'trans': 'The quick brown fox jumps over the lazy dog in multiple languages...'
      }
    },
    
    // Performance metrics tracking
    metrics: {
      compressionRatios: {},
      compressionTimes: {},
      decompressionTimes: {},
      memoryUsage: {}
    },
    
    /**
     * Register a compression algorithm
     * @param {Object} algorithm - Algorithm implementation
     */
    AddAlgorithm: function(algorithm) {
      if (!algorithm.internalName) {
        throw new Error('Algorithm must have internalName property');
      }
      
      // Validate required interface
      const requiredMethods = ['Init', 'KeySetup', 'Compress', 'Decompress', 'ClearData'];
      for (const method of requiredMethods) {
        if (typeof algorithm[method] !== 'function') {
          throw new Error(`Algorithm ${algorithm.internalName} missing required method: ${method}`);
        }
      }
      
      this.algorithms[algorithm.internalName] = algorithm;
      console.log(`Registered compression algorithm: ${algorithm.name || algorithm.internalName}`);
    },
    
    /**
     * Get algorithm by name
     * @param {string} name - Algorithm internal name
     * @returns {Object} Algorithm object
     */
    GetAlgorithm: function(name) {
      return this.algorithms[name];
    },
    
    /**
     * List all registered algorithms
     * @returns {Array} Array of algorithm names
     */
    ListAlgorithms: function() {
      return Object.keys(this.algorithms);
    },
    
    /**
     * Test an algorithm with all test data
     * @param {string} algorithmName - Name of algorithm to test
     * @returns {Object} Test results
     */
    TestAlgorithm: function(algorithmName) {
      const algorithm = this.GetAlgorithm(algorithmName);
      if (!algorithm) {
        throw new Error(`Algorithm not found: ${algorithmName}`);
      }
      
      const results = {
        algorithm: algorithmName,
        tests: [],
        summary: {
          passed: 0,
          failed: 0,
          avgCompressionRatio: 0,
          avgCompressionTime: 0,
          avgDecompressionTime: 0
        }
      };
      
      // Initialize algorithm
      algorithm.Init();
      
      // Test with simple data
      for (const testString of this.testData.simple) {
        results.tests.push(this._runSingleTest(algorithm, testString, `simple-${testString.substring(0, 10)}`));
      }
      
      // Test with Calgary corpus
      for (const [name, data] of Object.entries(this.testData.calgary)) {
        results.tests.push(this._runSingleTest(algorithm, data, `calgary-${name}`));
      }
      
      // Calculate summary statistics
      const validTests = results.tests.filter(t => t.passed);
      results.summary.passed = validTests.length;
      results.summary.failed = results.tests.length - validTests.length;
      
      if (validTests.length > 0) {
        results.summary.avgCompressionRatio = validTests.reduce((sum, t) => sum + t.compressionRatio, 0) / validTests.length;
        results.summary.avgCompressionTime = validTests.reduce((sum, t) => sum + t.compressionTime, 0) / validTests.length;
        results.summary.avgDecompressionTime = validTests.reduce((sum, t) => sum + t.decompressionTime, 0) / validTests.length;
      }
      
      return results;
    },
    
    /**
     * Run a single test case
     * @private
     */
    _runSingleTest: function(algorithm, inputData, testName) {
      const result = {
        name: testName,
        inputSize: inputData.length,
        passed: false,
        compressionRatio: 0,
        compressionTime: 0,
        decompressionTime: 0,
        error: null
      };
      
      try {
        const keyId = algorithm.KeySetup();
        
        // Compression
        const compressStart = Date.now();
        const compressed = algorithm.Compress(keyId, inputData);
        result.compressionTime = Date.now() - compressStart;
        
        if (compressed === null || compressed === undefined) {
          throw new Error('Compression returned null/undefined');
        }
        
        result.compressedSize = compressed.length;
        result.compressionRatio = result.inputSize / result.compressedSize;
        
        // Decompression
        const decompressStart = Date.now();
        const decompressed = algorithm.Decompress(keyId, compressed);
        result.decompressionTime = Date.now() - decompressStart;
        
        // Verify lossless compression
        if (decompressed === inputData) {
          result.passed = true;
        } else {
          throw new Error('Decompressed data does not match original');
        }
        
        algorithm.ClearData(keyId);
        
      } catch (error) {
        result.error = error.message;
        result.passed = false;
      }
      
      return result;
    },
    
    /**
     * Benchmark all algorithms
     * @returns {Object} Benchmark results
     */
    BenchmarkAll: function() {
      const benchmark = {
        timestamp: new Date().toISOString(),
        algorithms: {},
        summary: {
          totalAlgorithms: 0,
          workingAlgorithms: 0,
          bestCompressionRatio: null,
          fastestCompression: null,
          fastestDecompression: null
        }
      };
      
      for (const algorithmName of this.ListAlgorithms()) {
        try {
          const results = this.TestAlgorithm(algorithmName);
          benchmark.algorithms[algorithmName] = results;
          benchmark.summary.totalAlgorithms++;
          
          if (results.summary.passed > 0) {
            benchmark.summary.workingAlgorithms++;
            
            // Track best performers
            if (!benchmark.summary.bestCompressionRatio || 
                results.summary.avgCompressionRatio > benchmark.summary.bestCompressionRatio.ratio) {
              benchmark.summary.bestCompressionRatio = {
                algorithm: algorithmName,
                ratio: results.summary.avgCompressionRatio
              };
            }
            
            if (!benchmark.summary.fastestCompression || 
                results.summary.avgCompressionTime < benchmark.summary.fastestCompression.time) {
              benchmark.summary.fastestCompression = {
                algorithm: algorithmName,
                time: results.summary.avgCompressionTime
              };
            }
            
            if (!benchmark.summary.fastestDecompression || 
                results.summary.avgDecompressionTime < benchmark.summary.fastestDecompression.time) {
              benchmark.summary.fastestDecompression = {
                algorithm: algorithmName,
                time: results.summary.avgDecompressionTime
              };
            }
          }
        } catch (error) {
          benchmark.algorithms[algorithmName] = {
            error: error.message,
            summary: { passed: 0, failed: 1 }
          };
        }
      }
      
      return benchmark;
    },
    
    /**
     * Generate comprehensive report
     * @returns {string} Formatted report
     */
    GenerateReport: function() {
      const benchmark = this.BenchmarkAll();
      let report = '# Compression Algorithm Implementation Report\n\n';
      
      report += `**Generated:** ${benchmark.timestamp}\n`;
      report += `**Total Algorithms:** ${benchmark.summary.totalAlgorithms}\n`;
      report += `**Working Algorithms:** ${benchmark.summary.workingAlgorithms}\n\n`;
      
      // Performance leaders
      if (benchmark.summary.bestCompressionRatio) {
        report += `**Best Compression Ratio:** ${benchmark.summary.bestCompressionRatio.algorithm} (${benchmark.summary.bestCompressionRatio.ratio.toFixed(2)}:1)\n`;
      }
      if (benchmark.summary.fastestCompression) {
        report += `**Fastest Compression:** ${benchmark.summary.fastestCompression.algorithm} (${benchmark.summary.fastestCompression.time.toFixed(2)}ms)\n`;
      }
      if (benchmark.summary.fastestDecompression) {
        report += `**Fastest Decompression:** ${benchmark.summary.fastestDecompression.algorithm} (${benchmark.summary.fastestDecompression.time.toFixed(2)}ms)\n`;
      }
      
      report += '\n## Algorithm Status\n\n';
      report += '| Algorithm | Status | Tests Passed | Avg Compression Ratio | Avg Compression Time | Avg Decompression Time |\n';
      report += '|-----------|--------|--------------|----------------------|---------------------|----------------------|\n';
      
      for (const [name, results] of Object.entries(benchmark.algorithms)) {
        const status = results.error ? 'ERROR' : (results.summary.passed > 0 ? 'WORKING' : 'FAILED');
        const ratio = results.summary ? results.summary.avgCompressionRatio.toFixed(2) : 'N/A';
        const compTime = results.summary ? results.summary.avgCompressionTime.toFixed(2) + 'ms' : 'N/A';
        const decompTime = results.summary ? results.summary.avgDecompressionTime.toFixed(2) + 'ms' : 'N/A';
        
        report += `| ${name} | ${status} | ${results.summary ? results.summary.passed : 0} | ${ratio} | ${compTime} | ${decompTime} |\n`;
      }
      
      return report;
    }
  };
  
  // Base compression algorithm template
  Compression.BaseAlgorithm = {
    // Required properties
    internalName: '',
    name: '',
    comment: '',
    category: '', // Dictionary, Entropy, Universal, Hybrid, Transform, Advanced, Simple
    instances: {},
    isInitialized: false,
    
    // Required methods (to be implemented by specific algorithms)
    Init: function() {
      this.isInitialized = true;
    },
    
    KeySetup: function() {
      const id = this.internalName + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      this.instances[id] = this._createInstance();
      return id;
    },
    
    Compress: function(keyId, data) {
      throw new Error('Compress method must be implemented');
    },
    
    Decompress: function(keyId, compressedData) {
      throw new Error('Decompress method must be implemented');
    },
    
    ClearData: function(keyId) {
      if (this.instances[keyId]) {
        delete this.instances[keyId];
        return true;
      }
      return false;
    },
    
    // Helper method to create instance (to be overridden)
    _createInstance: function() {
      return {};
    }
  };
  
  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Compression;
  }
  
  // Make globally available
  global.Compression = Compression;
  
})(typeof global !== 'undefined' ? global : window);