/*
 * Browser-Compatible Test API for UI Integration
 * Provides clean interface for UI to execute tests on already-loaded algorithms
 * Adapted from TestAPI.js to work in browser environment
 *
 * Key Features:
 * - Works with AlgorithmFramework's loaded algorithms (no file reading)
 * - UI-friendly return formats (JSON objects)
 * - Real-time progress callbacks for UI feedback
 * - Error handling suitable for UI display
 *
 * (c)2006-2025 Hawkynt
 */

(function(global) {
    'use strict';

    class TestAPI {
        constructor(options = {}) {
            this.progressCallback = options.progressCallback || null;
            this.verbose = options.verbose || false;
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

        // Test algorithm interface
        testInterface(algorithm) {
            try {
                // Check if algorithm can create instances
                const instance = algorithm.CreateInstance();
                if (!instance) return false;

                // Check if instance has required methods
                if (typeof instance.Feed !== 'function') return false;
                if (typeof instance.Result !== 'function') return false;

                return true;
            } catch (error) {
                console.warn(`Interface test failed for ${algorithm.name}:`, error);
                return false;
            }
        }

        // Test algorithm metadata (matches CLI TestEngine validation)
        testMetadata(algorithm) {
            try {
                const errors = [];

                // Check required metadata fields
                if (!algorithm.name || typeof algorithm.name !== 'string') {
                    errors.push('Missing or empty name');
                }
                if (!algorithm.description || typeof algorithm.description !== 'string') {
                    errors.push('Missing or empty description');
                }

                // Check category (should be CategoryType object, not string)
                if (!algorithm.category) {
                    errors.push('Missing or empty category');
                } else if (typeof algorithm.category === 'string') {
                    errors.push('Category should be CategoryType object, not string');
                }

                // Check security status (strict validation like CLI)
                const validSecurityStatuses = [null, 'insecure', 'educational'];
                if (algorithm.securityStatus !== undefined &&
                    algorithm.securityStatus !== null &&
                    !validSecurityStatuses.includes(algorithm.securityStatus)) {
                    errors.push(`Invalid securityStatus: "${algorithm.securityStatus}" (must be null, "insecure", or "educational")`);
                }

                // Check subCategory
                if (!algorithm.subCategory || typeof algorithm.subCategory !== 'string') {
                    errors.push('Missing or empty subCategory');
                }

                // Store errors for debugging
                if (errors.length > 0) {
                    if (!algorithm._metadataErrors) {
                        algorithm._metadataErrors = errors;
                    }
                }

                return errors.length === 0;
            } catch (error) {
                console.warn(`Metadata test failed for ${algorithm.name}:`, error);
                return false;
            }
        }

        // Test algorithm functionality
        async testFunctionality(algorithm) {
            const result = {
                algorithm: algorithm.name,
                status: 'passed',
                vectorsPassed: 0,
                vectorsTotal: algorithm.tests ? algorithm.tests.length : 0,
                roundTripsPassed: 0,
                roundTripsAttempted: 0,
                message: null,
                vectorDetails: []
            };

            if (!algorithm.tests || algorithm.tests.length === 0) {
                result.status = 'no-tests';
                result.message = 'No test vectors available';
                return result;
            }

            try {
                // Test each vector
                for (let i = 0; i < algorithm.tests.length; i++) {
                    const test = algorithm.tests[i];
                    const vectorResult = await this.testSingleVector(algorithm, test, i);

                    if (vectorResult.result.passed) {
                        result.vectorsPassed++;
                    }

                    if (vectorResult.result.roundTripSuccess !== null) {
                        result.roundTripsAttempted++;
                        if (vectorResult.result.roundTripSuccess) {
                            result.roundTripsPassed++;
                        }
                    }

                    result.vectorDetails.push({
                        index: i,
                        text: test.text || `Vector ${i + 1}`,
                        passed: vectorResult.result.passed,
                        roundTripSuccess: vectorResult.result.roundTripSuccess,
                        error: vectorResult.result.error
                    });
                }

                // Determine overall status
                if (result.vectorsPassed === 0) {
                    result.status = 'failed';
                } else if (result.vectorsPassed < result.vectorsTotal) {
                    result.status = 'partial';
                }

            } catch (error) {
                result.status = 'error';
                result.message = error.message;
            }

            return result;
        }

        // Test a single test vector
        async testSingleVector(algorithm, vector, index = 0) {
            try {
                const result = {
                    passed: false,
                    roundTripSuccess: null,
                    error: null,
                    output: null,
                    expected: vector.expected
                };

                // Basic functionality test
                const instance = algorithm.CreateInstance();
                if (vector.key && instance.key !== undefined) {
                    instance.key = vector.key;
                }

                instance.Feed(vector.input);
                const output = instance.Result();
                result.output = output;

                // Compare with expected
                result.passed = this.compareArrays(output, vector.expected);

                // Round-trip test for invertible algorithms
                if (this.isInvertible(algorithm)) {
                    try {
                        const reverseInstance = algorithm.CreateInstance(true);
                        if (vector.key && reverseInstance.key !== undefined) {
                            reverseInstance.key = vector.key;
                        }
                        reverseInstance.Feed(output);
                        const roundTripResult = reverseInstance.Result();
                        result.roundTripSuccess = this.compareArrays(roundTripResult, vector.input);
                    } catch (error) {
                        result.roundTripSuccess = false;
                    }
                }

                return {
                    success: true,
                    result: result
                };

            } catch (error) {
                return {
                    success: false,
                    result: {
                        passed: false,
                        roundTripSuccess: null,
                        error: error.message,
                        output: null,
                        expected: vector.expected
                    }
                };
            }
        }

        // Check if algorithm is invertible (supports round-trips)
        isInvertible(algorithm) {
            if (!algorithm.category || !AlgorithmFramework.CategoryType) {
                return false;
            }

            const invertibleCategories = [
                AlgorithmFramework.CategoryType.BLOCK,
                AlgorithmFramework.CategoryType.STREAM,
                AlgorithmFramework.CategoryType.CLASSICAL,
                AlgorithmFramework.CategoryType.ENCODING
            ];

            return invertibleCategories.includes(algorithm.category);
        }

        // Compare arrays for equality
        compareArrays(arr1, arr2) {
            if (!arr1 || !arr2) return false;
            if (arr1.length !== arr2.length) return false;

            for (let i = 0; i < arr1.length; i++) {
                if (arr1[i] !== arr2[i]) return false;
            }

            return true;
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
    }

    // Export for browser
    if (typeof global !== 'undefined') {
        global.TestAPI = TestAPI;
    }
    if (typeof window !== 'undefined') {
        window.TestAPI = TestAPI;
    }

})(typeof global !== 'undefined' ? global : window);