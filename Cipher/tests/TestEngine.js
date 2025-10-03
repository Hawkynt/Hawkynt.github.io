/*
 * Core Test Engine for Cipher Algorithms
 * Reusable testing functionality for both CLI and UI interfaces
 * Tests compilation, interface compatibility, metadata compliance, unresolved issues, functionality, and optimization
 *
 * Test Categories:
 * - COMPILATION: Tests JavaScript syntax using `node -c` (syntax errors)
 * - INTERFACE: Tests if algorithm can be loaded and RegisterAlgorithm accepts it (interface errors)
 * - METADATA: Tests metadata compliance with CONTRIBUTING.md format
 * - ISSUES: Tests for unresolved TODO, FIXME, BUG, ISSUE comments
 * - FUNCTIONALITY: Tests algorithm functionality using test vectors
 * - OPTIMIZATION: Tests OpCodes usage for performance optimization
 *
 * (c)2006-2025 Hawkynt
 */

const fs = require('fs');
const path = require('path');

class TestEngine {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.silent = options.silent || false;
    this.dependenciesLoaded = false;

    // Define algorithm category arrays for invertibility requirements
    // These will be set after AlgorithmFramework is loaded
    this.perfectRoundTripCategories = null;
    this.encodingStabilityCategories = null;

    this.results = {
      compilation: { passed: 0, failed: 0, errors: [] },
      interface: { passed: 0, failed: 0, errors: [] },
      metadata: { passed: 0, failed: 0, errors: [] },
      issues: { passed: 0, failed: 0, errors: [] },
      functionality: { passed: 0, failed: 0, errors: [] },
      optimization: { passed: 0, failed: 0, errors: [] }
    };
  }

  // Load required dependencies
  async loadDependencies() {
    if (this.dependenciesLoaded) return;

    try {
      // Load OpCodes
      require('../OpCodes.js');
      if (!global.OpCodes) {
        throw new Error('OpCodes not loaded properly');
      }

      // Load AlgorithmFramework
      global.AlgorithmFramework = require('../AlgorithmFramework.js');
      if (!global.AlgorithmFramework) {
        throw new Error('AlgorithmFramework not loaded properly');
      }

      // Initialize algorithm category arrays now that AlgorithmFramework is loaded
      this.initializeCategoryArrays();
      this.dependenciesLoaded = true;

    } catch (error) {
      throw new Error(`Failed to load dependencies: ${error.message}`);
    }
  }

  // Initialize category arrays for invertibility requirements
  initializeCategoryArrays() {
    // Categories that require perfect round-trip (encrypt -> decrypt -> original)
    this.perfectRoundTripCategories = [
      'cipher', 'block', 'stream', 'asymmetric', 'mac', 'aead', 'modes', 'padding'
    ];

    // Categories that require encoding stability (encode -> decode -> encode -> same result)
    this.encodingStabilityCategories = [
      'encoding', 'checksum', 'ecc'
    ];
  }

  // Helper function to determine if an algorithm requires round-trips
  requiresRoundTrips(algorithm) {
    if (!algorithm.category || !this.perfectRoundTripCategories) return false;
    return this.perfectRoundTripCategories.includes(algorithm.category);
  }

  // Helper function to determine if an algorithm requires encoding stability
  requiresEncodingStability(algorithm) {
    if (!algorithm.category || !this.encodingStabilityCategories) return false;
    return this.encodingStabilityCategories.includes(algorithm.category);
  }

  // Test individual algorithm file - Core testing logic
  async testAlgorithm(filePath, algorithmName = null, category = null) {
    if (!algorithmName) {
      algorithmName = path.basename(filePath, '.js');
    }
    if (!category) {
      category = path.basename(path.dirname(filePath));
    }

    const algorithmData = {
      name: algorithmName,
      category: category,
      file: path.basename(filePath),
      filePath: filePath,
      tests: {
        compilation: false,
        interface: false,
        metadata: false,
        issues: false,
        functionality: false,
        optimization: false
      },
      details: {}
    };

    // Ensure dependencies are loaded
    await this.loadDependencies();

    // COMPILATION TEST - JavaScript syntax and loading
    algorithmData.tests.compilation = await this.testCompilation(filePath, algorithmData);

    if (algorithmData.tests.compilation) {
      // INTERFACE TEST - AlgorithmFramework registration compatibility
      algorithmData.tests.interface = await this.testInterface(filePath, algorithmData);

      if (algorithmData.tests.interface) {
        // METADATA TEST - CONTRIBUTING.MD interface format
        algorithmData.tests.metadata = await this.testMetadata(filePath, category, algorithmData);

        // ISSUES TEST - Check for TODO, ISSUE, BUG, FIXME comments
        algorithmData.tests.issues = await this.testIssues(filePath, algorithmData);

        // FUNCTIONALITY TEST - Test vectors
        algorithmData.tests.functionality = await this.testFunctionality(filePath, algorithmData);

        // OPTIMIZATION TEST - OpCodes usage
        algorithmData.tests.optimization = await this.testOptimization(filePath, algorithmData);
      }
    }

    return algorithmData;
  }

  // Test if file has valid JavaScript syntax without executing
  async testCompilation(filePath, algorithmData) {
    try {
      // Use Node.js to check syntax without executing
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Use the full path for node -c
      await execAsync(`node -c "${filePath}"`);

      algorithmData.details.syntaxValid = true;
      this.results.compilation.passed++;
      return true;

    } catch (error) {
      const errorMsg = error.stderr || error.message;
      algorithmData.details.compilationError = errorMsg;
      this.results.compilation.failed++;
      this.results.compilation.errors.push(`${algorithmData.name}: ${errorMsg}`);

      return false;
    }
  }

  // Test if algorithm can be loaded and registered via AlgorithmFramework
  async testInterface(filePath, algorithmData) {
    try {
      // Clear the algorithm registry before testing
      global.AlgorithmFramework.Clear();

      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(filePath)];

      // Try to require the file (this should call RegisterAlgorithm internally)
      require(filePath);

      // Check if algorithms were registered
      const registeredAlgorithms = global.AlgorithmFramework.Algorithms;
      const algorithmCount = registeredAlgorithms.length;

      if (algorithmCount > 0) {
        algorithmData.details.addedToFramework = true;
        algorithmData.details.algorithmCount = algorithmCount;
        algorithmData.details.registeredNames = registeredAlgorithms.map(alg => alg.name);
        this.results.interface.passed++;
        return true;
      } else {
        const errorMsg = 'No algorithms registered (RegisterAlgorithm likely failed)';
        algorithmData.details.interfaceError = errorMsg;
        this.results.interface.failed++;
        this.results.interface.errors.push(`${algorithmData.name}: ${errorMsg}`);
        return false;
      }

    } catch (error) {
      const errorMsg = error.message;
      algorithmData.details.interfaceError = errorMsg;
      this.results.interface.failed++;
      this.results.interface.errors.push(`${algorithmData.name}: ${errorMsg}`);
      return false;
    }
  }

  // Test metadata compliance with CONTRIBUTING.md standards
  async testMetadata(filePath, category, algorithmData) {
    try {
      const registeredAlgorithms = global.AlgorithmFramework.Algorithms;

      if (!registeredAlgorithms || registeredAlgorithms.length === 0) {
        algorithmData.details.metadataError = 'No algorithms registered for metadata testing';
        this.results.metadata.failed++;
        this.results.metadata.errors.push(`${algorithmData.name}: No algorithms registered`);
        return false;
      }

      let anySuccess = false;
      const metadataResults = [];

      for (const algorithm of registeredAlgorithms) {
        const issues = [];

        // Required fields
        if (!algorithm.name || typeof algorithm.name !== 'string' || algorithm.name.trim() === '') {
          issues.push('Missing or empty name');
        }

        if (!algorithm.description || typeof algorithm.description !== 'string' || algorithm.description.trim() === '') {
          issues.push('Missing or empty description');
        }

        // Category MUST be a framework object (CategoryType.HASH, etc.) - NO STRINGS ALLOWED
        if (!algorithm.category) {
          issues.push('Missing category');
        } else if (typeof algorithm.category === 'string') {
          issues.push(`Invalid category: "${algorithm.category}" is a string literal - MUST use framework objects (CategoryType.HASH, CategoryType.BLOCK, etc.)`);
        } else if (typeof algorithm.category !== 'object') {
          issues.push(`Invalid category type: ${typeof algorithm.category} - MUST use framework objects`);
        }

        if (!algorithm.subCategory || typeof algorithm.subCategory !== 'string' || algorithm.subCategory.trim() === '') {
          issues.push('Missing or empty subCategory');
        }

        // Security status MUST be null or framework object - NO STRING LITERALS ALLOWED
        if (algorithm.securityStatus !== undefined && algorithm.securityStatus !== null) {
          if (typeof algorithm.securityStatus === 'string') {
            issues.push(`Invalid securityStatus: "${algorithm.securityStatus}" is a string literal - MUST use framework objects (SecurityStatus.EDUCATIONAL, SecurityStatus.INSECURE) or null`);
          } else if (typeof algorithm.securityStatus !== 'object') {
            issues.push(`Invalid securityStatus type: ${typeof algorithm.securityStatus} - MUST use framework objects or null`);
          }
        }

        // Check if claiming to be secure (forbidden) - handle both string and object cases
        if (algorithm.securityStatus === 'secure' ||
            (typeof algorithm.securityStatus === 'object' &&
             algorithm.securityStatus &&
             algorithm.securityStatus.toString &&
             algorithm.securityStatus.toString().toLowerCase().includes('secure'))) {
          issues.push('Cannot claim securityStatus "secure" - use null, "insecure", "educational", or appropriate framework objects');
        }

        metadataResults.push({
          algorithm: algorithm.name,
          issues: issues,
          passed: issues.length === 0
        });

        if (issues.length === 0) {
          anySuccess = true;
        }
      }

      algorithmData.details.metadataResults = metadataResults;

      if (anySuccess) {
        this.results.metadata.passed++;
        return true;
      } else {
        const allIssues = metadataResults.flatMap(r => r.issues);
        algorithmData.details.metadataError = `Metadata validation failed: ${allIssues.join(', ')}`;
        this.results.metadata.failed++;
        this.results.metadata.errors.push(`${algorithmData.name}: ${allIssues.join(', ')}`);
        return false;
      }

    } catch (error) {
      const errorMsg = error.message;
      algorithmData.details.metadataError = errorMsg;
      this.results.metadata.failed++;
      this.results.metadata.errors.push(`${algorithmData.name}: ${errorMsg}`);
      return false;
    }
  }

  // Test for unresolved TODO, FIXME, BUG, ISSUE comments
  async testIssues(filePath, algorithmData) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n');

      const issuePatterns = [
        { type: 'TODO', pattern: /\b(TODO|todo)\b/g },
        { type: 'FIXME', pattern: /\b(FIXME|fixme)\b/g },
        { type: 'BUG', pattern: /\b(BUG|bug)\b/g },
        { type: 'ISSUE', pattern: /\b(ISSUE|issue)\b/g }
      ];

      const foundIssues = [];
      let totalCount = 0;

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        for (const issuePattern of issuePatterns) {
          const matches = [...line.matchAll(issuePattern.pattern)];
          if (matches.length > 0) {
            foundIssues.push({
              type: issuePattern.type,
              line: lineNum + 1,
              content: line.trim()
            });
            totalCount += matches.length;
          }
        }
      }

      algorithmData.details.issues = {
        found: foundIssues,
        totalCount: totalCount
      };

      if (totalCount === 0) {
        this.results.issues.passed++;
        return true;
      } else {
        this.results.issues.failed++;
        this.results.issues.errors.push(`${algorithmData.name}: ${totalCount} ${totalCount === 1 ? 'issue' : 'issues'} found`);
        return false;
      }

    } catch (error) {
      const errorMsg = error.message;
      algorithmData.details.issuesError = errorMsg;
      this.results.issues.failed++;
      this.results.issues.errors.push(`${algorithmData.name}: ${errorMsg}`);
      return false;
    }
  }

  // Test algorithm functionality using test vectors - CORE FUNCTIONALITY TESTING
  async testFunctionality(filePath, algorithmData) {
    if (algorithmData.details.interfaceError) {
      this.results.functionality.failed++;
      return false;
    }

    try {
      // Get registered algorithms
      const registeredAlgorithms = global.AlgorithmFramework.Algorithms;

      if (!registeredAlgorithms || registeredAlgorithms.length === 0) {
        algorithmData.details.functionalityError = 'No algorithms registered for testing';
        this.results.functionality.failed++;
        this.results.functionality.errors.push(`${algorithmData.name}: No algorithms registered`);
        return false;
      }

      // Test each registered algorithm
      let anySuccess = false;
      const testResults = [];

      for (const algorithm of registeredAlgorithms) {
        const result = await this.testAlgorithmFunctionality(algorithm);
        testResults.push(result);

        if (result.status === 'passed') {
          anySuccess = true;
        }
      }

      algorithmData.details.testResults = testResults;

      if (anySuccess) {
        this.results.functionality.passed++;
        return true;
      } else {
        const errorMessages = testResults
          .filter(r => r.status !== 'passed')
          .map(r => r.message || r.status)
          .join(', ');

        algorithmData.details.functionalityError = errorMessages;
        this.results.functionality.failed++;
        this.results.functionality.errors.push(`${algorithmData.name}: ${errorMessages}`);
        return false;
      }

    } catch (error) {
      const errorMsg = error.message;
      algorithmData.details.functionalityError = errorMsg;
      this.results.functionality.failed++;
      this.results.functionality.errors.push(`${algorithmData.name}: ${errorMsg}`);
      return false;
    }
  }

  // Core algorithm functionality testing logic - This is what UI will call
  async testAlgorithmFunctionality(algorithm) {
    try {
      // Get test vectors from metadata
      const testVectors = algorithm.tests || [];

      if (testVectors.length === 0) {
        return {
          algorithm: algorithm.name,
          status: 'no-tests',
          message: 'No test vectors available',
          vectorsPassed: 0,
          vectorsTotal: 0,
          roundTripsPassed: 0,
          roundTripsAttempted: 0,
          vectorDetails: []
        };
      }

      // Test all vectors
      const vectorsToTest = testVectors;
      let vectorsPassed = 0;
      let roundTripsPassed = 0;
      const vectorDetails = [];

      for (let i = 0; i < vectorsToTest.length; i++) {
        const vector = vectorsToTest[i];
        const vectorResult = await this.testSingleVector(algorithm, vector, i);
        vectorDetails.push(vectorResult);

        if (vectorResult.passed) {
          vectorsPassed++;

          if (vectorResult.roundTripSuccess) {
            roundTripsPassed++;
          }
        }
      }

      // Algorithm passes only if ALL test vectors pass
      if (vectorsPassed === vectorsToTest.length && vectorsToTest.length > 0) {
        // Check if round-trips or encoding stability are required and if they all passed
        const requiresRoundTrips = this.requiresRoundTrips(algorithm);
        const requiresEncodingStability = this.requiresEncodingStability(algorithm);
        const invertibilityRequired = (requiresRoundTrips || requiresEncodingStability) && vectorsPassed > 0;
        const invertibilitySuccess = !invertibilityRequired || (roundTripsPassed === vectorsPassed);

        if (invertibilitySuccess) {
          return {
            algorithm: algorithm.name,
            status: 'passed',
            vectorsPassed: vectorsPassed,
            vectorsTotal: vectorsToTest.length,
            roundTripsPassed: roundTripsPassed,
            roundTripsAttempted: vectorsPassed,
            requiresRoundTrips: requiresRoundTrips,
            requiresEncodingStability: requiresEncodingStability,
            vectorDetails: vectorDetails
          };
        } else {
          // Algorithm failed due to invertibility failure
          const failureType = requiresEncodingStability ? 'encoding stability' : 'round-trip decryption';
          return {
            algorithm: algorithm.name,
            status: requiresEncodingStability ? 'failed-encoding-stability' : 'failed-roundtrips',
            vectorsPassed: vectorsPassed,
            vectorsTotal: vectorsToTest.length,
            roundTripsPassed: roundTripsPassed,
            roundTripsAttempted: vectorsPassed,
            requiresRoundTrips: requiresRoundTrips,
            requiresEncodingStability: requiresEncodingStability,
            message: `${failureType.charAt(0).toUpperCase() + failureType.slice(1)} failed (${roundTripsPassed}/${vectorsPassed} successful)`,
            vectorDetails: vectorDetails
          };
        }
      } else {
        return {
          algorithm: algorithm.name,
          status: 'failed',
          vectorsPassed: vectorsPassed,
          vectorsTotal: vectorsToTest.length,
          roundTripsPassed: roundTripsPassed,
          roundTripsAttempted: vectorsPassed,
          message: `Test vectors failed (${vectorsPassed}/${vectorsToTest.length} passed)`,
          vectorDetails: vectorDetails
        };
      }

    } catch (error) {
      return {
        algorithm: algorithm.name,
        status: 'error',
        message: error.message,
        vectorsPassed: 0,
        vectorsTotal: 0,
        roundTripsPassed: 0,
        roundTripsAttempted: 0,
        vectorDetails: []
      };
    }
  }

  // Test a single test vector - Core vector testing logic
  async testSingleVector(algorithm, vector, index) {
    try {
      // Create fresh instance for each test vector
      const testInstance = algorithm.CreateInstance(false); // false = forward/encrypt mode

      // Apply test vector properties to instance (automatic configuration)
      for (const [key, value] of Object.entries(vector)) {
        if (key !== 'text' && key !== 'uri' && key !== 'input' && key !== 'expected' && key !== 'output') {
          try {
            if (testInstance.hasOwnProperty(key) || key in testInstance) {
              testInstance[key] = value;
            }
          } catch (propertyError) {
            // Property setting failed, continue anyway
          }
        }
      }

      // Feed input data
      testInstance.Feed(vector.input);

      // Get result
      const result = testInstance.Result();

      // Compare with expected output (try both 'expected' and 'output' properties)
      const expectedOutput = vector.expected || vector.output;
      const passed = this.compareArrays(result, expectedOutput);

      let roundTripSuccess = false;

      if (passed) {
        // Try round-trip test or encoding stability test
        try {
          if (this.requiresEncodingStability(algorithm)) {
            roundTripSuccess = await this.testEncodingStability(algorithm, vector, result);
          } else {
            roundTripSuccess = await this.testRoundTrip(algorithm, vector, result);
          }
        } catch (inverseError) {
          // Inverse instance creation failed or round-trip failed - that's okay
          // Not all algorithms support inverse operations
          roundTripSuccess = false;
        }
      }

      return {
        index: index + 1,
        text: vector.text || `Test Vector ${index + 1}`,
        passed: passed,
        input: vector.input,
        expected: expectedOutput,
        actual: result,
        roundTripSuccess: roundTripSuccess
      };

    } catch (vectorError) {
      return {
        index: index + 1,
        text: vector.text || `Test Vector ${index + 1}`,
        passed: false,
        input: vector.input,
        expected: vector.expected || vector.output,
        actual: null,
        error: vectorError.message,
        roundTripSuccess: false
      };
    }
  }

  // Test encoding stability: encode(data) = encode(decode(encode(data)))
  async testEncodingStability(algorithm, vector, result) {
    // Try to create a decode instance
    const decodeInstance = algorithm.CreateInstance(true); // true = decode mode

    if (!decodeInstance) return false;

    // Apply same properties to decode instance
    for (const [key, value] of Object.entries(vector)) {
      if (key !== 'text' && key !== 'uri' && key !== 'input' && key !== 'expected' && key !== 'output') {
        try {
          if (decodeInstance.hasOwnProperty(key) || key in decodeInstance) {
            decodeInstance[key] = value;
          }
        } catch (propertyError) {
          // Property setting failed, continue anyway
        }
      }
    }

    // Decode the encoded result: decode(encode(data))
    decodeInstance.Feed(result);
    const decodedResult = decodeInstance.Result();

    // Re-encode the decoded result: encode(decode(encode(data)))
    const reEncodeInstance = algorithm.CreateInstance(false); // false = encode mode
    for (const [key, value] of Object.entries(vector)) {
      if (key !== 'text' && key !== 'uri' && key !== 'input' && key !== 'expected' && key !== 'output') {
        try {
          if (reEncodeInstance.hasOwnProperty(key) || key in reEncodeInstance) {
            reEncodeInstance[key] = value;
          }
        } catch (propertyError) {
          // Property setting failed, continue anyway
        }
      }
    }

    reEncodeInstance.Feed(decodedResult);
    const reEncodedResult = reEncodeInstance.Result();

    // Check encoding stability: encode(data) = encode(decode(encode(data)))
    return this.compareArrays(result, reEncodedResult);
  }

  // Test perfect round-trip: encrypt(data) -> decrypt(result) -> original data
  async testRoundTrip(algorithm, vector, result) {
    // Try to create an inverse instance (decrypt mode)
    const inverseInstance = algorithm.CreateInstance(true); // true = inverse/decrypt mode

    if (!inverseInstance) return false;

    // Apply same properties to inverse instance
    for (const [key, value] of Object.entries(vector)) {
      if (key !== 'text' && key !== 'uri' && key !== 'input' && key !== 'expected' && key !== 'output') {
        try {
          if (inverseInstance.hasOwnProperty(key) || key in inverseInstance) {
            inverseInstance[key] = value;
          }
        } catch (propertyError) {
          // Property setting failed, continue anyway
        }
      }
    }

    // Feed the result (encrypted data) to decrypt it back
    inverseInstance.Feed(result);
    const decryptedResult = inverseInstance.Result();

    // Check if we get back the original input
    return this.compareArrays(decryptedResult, vector.input);
  }

  // Test OpCodes usage for optimization
  async testOptimization(filePath, algorithmData) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');

      // Check for OpCodes usage
      const opCodesUsage = fileContent.includes('OpCodes.');

      // Check for manual bit operations that should use OpCodes
      const manualOperations = [
        { pattern: /[^a-zA-Z_](\d+|[a-zA-Z_]+)\s*>>>\s*\d+/g, description: 'manual right rotation' },
        { pattern: /[^a-zA-Z_](\d+|[a-zA-Z_]+)\s*<<<\s*\d+/g, description: 'manual left rotation' },
        { pattern: /[^a-zA-Z_](\d+|[a-zA-Z_]+)\s*>>\s*\d+/g, description: 'manual right shift' },
        { pattern: /[^a-zA-Z_](\d+|[a-zA-Z_]+)\s*<<\s*\d+/g, description: 'manual left shift' }
      ];

      const foundManualOps = [];
      const lines = fileContent.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

        for (const manualOp of manualOperations) {
          const matches = [...line.matchAll(manualOp.pattern)];
          if (matches.length > 0) {
            foundManualOps.push({
              line: lineNum + 1,
              description: manualOp.description,
              content: line.trim()
            });
          }
        }
      }

      algorithmData.details.optimization = {
        usesOpCodes: opCodesUsage,
        manualOperations: foundManualOps
      };

      // Pass if using OpCodes and no problematic manual operations
      if (opCodesUsage && foundManualOps.length === 0) {
        this.results.optimization.passed++;
        return true;
      } else {
        let errorMsg = '';
        if (!opCodesUsage) {
          errorMsg += 'No OpCodes usage detected. ';
        }
        if (foundManualOps.length > 0) {
          errorMsg += `${foundManualOps.length} manual bit operations found that should use OpCodes.`;
        }

        algorithmData.details.optimizationError = errorMsg;
        this.results.optimization.failed++;
        this.results.optimization.errors.push(`${algorithmData.name}: ${errorMsg}`);
        return false;
      }

    } catch (error) {
      const errorMsg = error.message;
      algorithmData.details.optimizationError = errorMsg;
      this.results.optimization.failed++;
      this.results.optimization.errors.push(`${algorithmData.name}: ${errorMsg}`);
      return false;
    }
  }

  // Utility function to compare arrays
  compareArrays(arr1, arr2) {
    if (!arr1 || !arr2) return false;
    if (arr1.length !== arr2.length) return false;

    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  }

  // Reset results counters
  resetResults() {
    this.results = {
      compilation: { passed: 0, failed: 0, errors: [] },
      interface: { passed: 0, failed: 0, errors: [] },
      metadata: { passed: 0, failed: 0, errors: [] },
      issues: { passed: 0, failed: 0, errors: [] },
      functionality: { passed: 0, failed: 0, errors: [] },
      optimization: { passed: 0, failed: 0, errors: [] }
    };
  }

  // Get current test results summary
  getResultsSummary() {
    const total = Object.values(this.results).reduce((sum, cat) => sum + cat.passed + cat.failed, 0) / 6;
    const passed = Object.values(this.results).reduce((sum, cat) => sum + cat.passed, 0) / 6;

    return {
      total: Math.round(total),
      passed: Math.round(passed),
      failed: Math.round(total - passed),
      percentage: total > 0 ? Math.round((passed / total) * 100) : 0,
      details: this.results
    };
  }
}

module.exports = TestEngine;