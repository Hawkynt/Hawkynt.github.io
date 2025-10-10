/*
 * Browser-Compatible Test API for UI Integration
 * Provides clean interface for UI to execute tests on already-loaded algorithms
 * Uses unified TestCore module to eliminate code duplication
 *
 * Key Features:
 * - Works with AlgorithmFramework's loaded algorithms (no file reading)
 * - UI-friendly return formats (JSON objects)
 * - Real-time progress callbacks for UI feedback
 * - Error handling suitable for UI display
 * - Unified testing logic with CLI
 *
 * (c)2006-2025 Hawkynt
 */

(function(global) {
    'use strict';

    // Load TestCore dependency
    if (typeof require !== 'undefined') {
        if (!global.TestCore) {
            try {
                const testCoreModule = require('./TestCore.js');
                global.TestCore = testCoreModule.TestCore;
            } catch(e) { /* ignore */ }
        }
    }

    class TestAPI {
        constructor(options = {}) {
            this.progressCallback = options.progressCallback || null;
            this.verbose = options.verbose || false;

            // Create TestCore instance
            this.testCore = new TestCore();
            this.testCore.verbose = this.verbose;
        }

        // Initialize the testing system
        async initialize() {
            try {
                // Check if required dependencies are available
                if (typeof AlgorithmFramework === 'undefined') {
                    throw new Error('AlgorithmFramework not available');
                }
                if (typeof OpCodes === 'undefined') {
                    throw new Error('OpCodes not available');
                }
                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }

        // Test an algorithm by name (from AlgorithmFramework)
        async testAlgorithm(algorithmName) {
            try {
                // Try exact match first
                let algorithm = AlgorithmFramework.Find(algorithmName);

                if (!algorithm) {
                    // Try case-insensitive match
                    const allAlgorithms = AlgorithmFramework.Algorithms;
                    algorithm = allAlgorithms.find(alg =>
                        alg.name.toLowerCase() === algorithmName.toLowerCase()
                    );
                }

                if (!algorithm) {
                    // Try partial/fuzzy match
                    const allAlgorithms = AlgorithmFramework.Algorithms;
                    algorithm = allAlgorithms.find(alg =>
                        alg.name.toLowerCase().includes(algorithmName.toLowerCase()) ||
                        algorithmName.toLowerCase().includes(alg.name.toLowerCase())
                    );
                }

                if (!algorithm) {
                    throw new Error(`Algorithm not found: ${algorithmName} (tried exact, case-insensitive, and fuzzy matching)`);
                }

                const result = await this.testAlgorithmInstance(algorithm);

                return {
                    success: true,
                    algorithm: result,
                    summary: this.formatAlgorithmSummary(result)
                };

            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    algorithm: null,
                    summary: null
                };
            }
        }

        // Test an algorithm instance
        async testAlgorithmInstance(algorithm) {
            const startTime = performance.now();

            const result = {
                name: algorithm.name,
                category: algorithm.category?.name || 'unknown',
                tests: {
                    compilation: true, // Always true in browser (already loaded)
                    interface: true,   // Will be tested
                    metadata: true,    // Will be tested
                    issues: true,      // Default pass (cannot scan files in browser)
                    functionality: true, // Will be tested
                    optimization: false  // Cannot test in browser (no file access)
                },
                details: {
                    registeredNames: [algorithm.name],
                    testResults: [],
                    optimizationError: 'Cannot test optimization in browser (no file access)'
                }
            };

            // Test interface compatibility
            result.tests.interface = this.testInterface(algorithm);

            // Test metadata compliance
            result.tests.metadata = this.testMetadata(algorithm);

            // Test functionality (test vectors)
            if (algorithm.tests && algorithm.tests.length > 0) {
                const funcResult = await this.testFunctionality(algorithm);
                result.tests.functionality = funcResult.passed === funcResult.total;
                result.details.testResults.push(funcResult);
            }

            result.details.duration = performance.now() - startTime;
            return result;
        }

        // Test algorithm interface using TestCore
        testInterface(algorithm) {
            return this.testCore.testInterface(algorithm);
        }

        // Test algorithm metadata using TestCore
        testMetadata(algorithm) {
            return this.testCore.testMetadata(algorithm);
        }

        // Test algorithm functionality using TestCore
        async testFunctionality(algorithm) {
            return await this.testCore.testFunctionality(algorithm, this.progressCallback);
        }

        // Test a single test vector using unified TestCore
        async testSingleVector(algorithm, vector, index = 0) {
            return await this.testCore.testSingleVector(algorithm, vector, index);
        }

        // Delegate to TestCore for these operations
        isInvertible(algorithm) {
            return this.testCore.isInvertible(algorithm);
        }

        compareArrays(arr1, arr2) {
            return this.testCore.compareArrays(arr1, arr2);
        }

        // Format algorithm summary for UI
        formatAlgorithmSummary(result) {
            const totalTests = Object.keys(result.tests).length;
            const passedTests = Object.values(result.tests).filter(t => t).length;
            const percentage = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

            return {
                passed: passedTests,
                total: totalTests,
                percentage: percentage,
                errors: this.extractErrors(result)
            };
        }

        // Extract errors from test results
        extractErrors(result) {
            const errors = [];

            Object.entries(result.tests).forEach(([testType, passed]) => {
                if (!passed) {
                    errors.push({
                        type: testType,
                        message: `${testType} test failed`
                    });
                }
            });

            return errors;
        }

        // Set progress callback for batch operations
        setProgressCallback(callback) {
            this.progressCallback = callback;
        }

        // Test multiple algorithms (batch)
        async testBatch(algorithmNames) {
            const results = [];

            for (let i = 0; i < algorithmNames.length; i++) {
                const algorithmName = algorithmNames[i];

                if (this.progressCallback) {
                    this.progressCallback({
                        current: i + 1,
                        total: algorithmNames.length,
                        algorithm: algorithmName,
                        percentage: Math.round(((i + 1) / algorithmNames.length) * 100),
                        status: 'testing'
                    });
                }

                const result = await this.testAlgorithm(algorithmName);
                results.push(result);
            }

            return results;
        }

        // Delegate to TestCore for block cipher mode operations
        isBlockCipherMode(algorithm) {
            return this.testCore.isBlockCipherMode(algorithm);
        }

        setupBlockCipherMode(instance, vector) {
            return this.testCore.setupBlockCipherMode(instance, vector);
        }
    }

    // Export for browser
    if (typeof global !== 'undefined') {
        global.TestAPI = TestAPI;
    }
    if (typeof window !== 'undefined') {
        window.TestAPI = TestAPI;
    }

})(typeof global !== 'undefined' ? global : window);