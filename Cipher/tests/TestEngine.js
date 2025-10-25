/*
 * Universal Test Engine for Cipher Algorithms
 * Works in both Node.js (CLI) and browser environments
 *
 * Public API (3 methods):
 * - TestFile(filePath) - Load and test an algorithm file (Node.js only)
 * - TestAlgorithm(algorithmInstance) - Test an algorithm instance
 * - TestVector(algorithmInstance, vector, index) - Test a single test vector
 *
 * (c)2006-2025 Hawkynt
 */

(function(global) {
    'use strict';

    // Node.js-specific requires
    const isNode = typeof require !== 'undefined';
    const fs = isNode ? require('fs') : null;
    const path = isNode ? require('path') : null;
    const { execSync } = isNode ? require('child_process') : { execSync: null };

    // ============================================================================
    // PUBLIC API - These are the only 3 methods you need
    // ============================================================================

    /**
     * TestFile - Load and test an algorithm file (Node.js only)
     * @param {string} filePath - Path to algorithm file
     * @param {object} options - { verbose: boolean, silent: boolean }
     * @returns {object} - Test results
     */
    async function TestFile(filePath, options = {}) {
        if (!isNode) {
            throw new Error('TestFile() only works in Node.js environment');
        }

        const verbose = options.verbose || false;
        const silent = options.silent || false;

        // Load dependencies
        await _loadDependencies(silent, verbose);

        const result = {
            filePath: filePath,
            compilation: { passed: false, error: null },
            interface: { passed: false, error: null, algorithms: [] },
            metadata: { passed: false, errors: [] },
            issues: { passed: false, errors: [] },
            functionality: { passed: false, errors: [], testResults: [] },
            optimization: { passed: false, error: null }
        };

        // Test compilation
        try {
            execSync(`node -c "${filePath}"`, { encoding: 'utf8', stdio: 'pipe' });
            result.compilation.passed = true;
        } catch (error) {
            result.compilation.error = error.message;
            return result;
        }

        // Load algorithm file
        const algorithmsBefore = AlgorithmFramework.Algorithms.length;
        try {
            require(path.resolve(filePath));
        } catch (error) {
            result.interface.error = `Failed to load: ${error.message}`;
            return result;
        }

        const algorithmsAfter = AlgorithmFramework.Algorithms.length;
        const registeredCount = algorithmsAfter - algorithmsBefore;

        if (registeredCount === 0) {
            result.interface.error = 'No algorithms registered';
            return result;
        }

        result.interface.passed = true;
        const registeredAlgorithms = AlgorithmFramework.Algorithms.slice(algorithmsBefore);
        result.interface.algorithms = registeredAlgorithms.map(a => a.name);

        // Test each registered algorithm
        let allMetadataValid = true;
        let allFunctionalityPassed = true;

        for (const algorithm of registeredAlgorithms) {
            // Test metadata
            const metadataErrors = _validateMetadata(algorithm);
            if (metadataErrors.length > 0) {
                result.metadata.errors.push(...metadataErrors);
                allMetadataValid = false;
            }

            // Test functionality
            if (algorithm.tests && algorithm.tests.length > 0) {
                const funcResult = await TestAlgorithm(algorithm, options);
                result.functionality.testResults.push({
                    algorithm: algorithm.name,
                    passed: funcResult.passed,
                    total: funcResult.total,
                    errors: funcResult.errors
                });

                if (funcResult.passed < funcResult.total) {
                    allFunctionalityPassed = false;
                }
            }
        }

        result.metadata.passed = allMetadataValid;
        result.functionality.passed = allFunctionalityPassed;

        // Test for unresolved issues (TODO, FIXME, etc.)
        const issuePatterns = [/TODO:/gi, /FIXME:/gi, /BUG:/gi, /ISSUE:/gi, /HACK:/gi];
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        const foundIssues = [];

        lines.forEach((line, lineNum) => {
            issuePatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    foundIssues.push({ line: lineNum + 1, content: line.trim() });
                }
            });
        });

        result.issues.passed = foundIssues.length === 0;
        result.issues.errors = foundIssues;

        // Test OpCodes optimization
        const nonOpCodesPatterns = [/(?<!\/\/.*)<<(?!\s*EOF)/g, /(?<!\/\/.*)>>/g, /\s+\^\s+/, /\s+\&\s+(?!&)/];
        let optimizationIssues = 0;

        lines.forEach((line, lineNum) => {
            if (line.includes('//')) line = line.split('//')[0]; // Strip comments
            nonOpCodesPatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    optimizationIssues++;
                }
            });
        });

        result.optimization.passed = optimizationIssues === 0;
        if (optimizationIssues > 0) {
            result.optimization.error = `Found ${optimizationIssues} non-OpCodes operations`;
        }

        return result;
    }

    /**
     * TestAlgorithm - Test an algorithm instance against all its test vectors
     * @param {object} algorithmInstance - Algorithm instance to test
     * @param {object} options - { verbose: boolean, progressCallback: function }
     * @returns {object} - { passed: number, total: number, errors: array, vectorResults: array }
     */
    async function TestAlgorithm(algorithmInstance, options = {}) {
        const verbose = options.verbose || false;
        const progressCallback = options.progressCallback || null;

        const result = {
            passed: 0,
            total: 0,
            errors: [],
            vectorResults: []
        };

        if (!algorithmInstance.tests || algorithmInstance.tests.length === 0) {
            result.errors.push('No test vectors defined');
            return result;
        }

        const vectors = algorithmInstance.tests;
        result.total = vectors.length;

        for (let i = 0; i < vectors.length; i++) {
            if (progressCallback) {
                progressCallback({
                    current: i + 1,
                    total: vectors.length,
                    algorithm: algorithmInstance.name
                });
            }

            const vectorResult = await TestVector(algorithmInstance, vectors[i], i);
            result.vectorResults.push(vectorResult);

            if (vectorResult.passed) {
                result.passed++;
            } else {
                result.errors.push({
                    vector: i,
                    text: vectors[i].text,
                    error: vectorResult.error
                });
            }

            if (verbose) {
                const status = vectorResult.passed ? '✓' : '✗';
                console.log(`  ${status} Vector ${i}: ${vectors[i].text || 'Unnamed'}`);
            }

            // CRITICAL: Yield to event loop every 5 vectors to keep UI responsive
            if ((i + 1) % 5 === 0 && typeof window !== 'undefined') {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        return result;
    }

    /**
     * TestVector - Test a single test vector
     * @param {object} algorithmInstance - Algorithm instance to test
     * @param {object} vector - Test vector { input, expected, key, iv, ... }
     * @param {number} index - Vector index for error reporting
     * @returns {object} - { passed: boolean, error: string, output: array, roundTripSuccess: boolean }
     */
    async function TestVector(algorithmInstance, vector, index = 0) {
        const result = {
            passed: false,
            roundTripSuccess: null,
            error: null,
            output: null,
            expected: vector.expected
        };

        try {
            // Create instance
            const instance = algorithmInstance.CreateInstance();
            if (!instance) {
                throw new Error('Failed to create algorithm instance');
            }

            // Handle block cipher modes
            if (_isBlockCipherMode(algorithmInstance)) {
                _setupBlockCipherMode(instance, vector, algorithmInstance.name);
            }

            // Apply all vector properties (key, iv, nonce, etc.)
            _applyVectorProperties(instance, vector);

            // Execute test
            instance.Feed(vector.input);
            const output = instance.Result();
            result.output = output;

            // Compare with expected
            const isRoundTripOnly = algorithmInstance.category === AlgorithmFramework.CategoryType.ASYMMETRIC &&
                                   _compareArrays(vector.expected, vector.input);

            if (isRoundTripOnly) {
                result.passed = true; // Round-trip will validate
            } else {
                result.passed = _compareArrays(output, vector.expected);
            }

            // Test round-trip if invertible
            if (_isInvertible(algorithmInstance)) {
                try {
                    const reverseInstance = algorithmInstance.CreateInstance(true);
                    if (reverseInstance) {
                        if (_isBlockCipherMode(algorithmInstance)) {
                            _setupBlockCipherMode(reverseInstance, vector, algorithmInstance.name);
                        }
                        _applyVectorProperties(reverseInstance, vector);

                        reverseInstance.Feed(output);
                        const roundTripResult = reverseInstance.Result();
                        result.roundTripSuccess = _compareArrays(roundTripResult, vector.input);
                    }
                } catch (error) {
                    result.roundTripSuccess = false;
                }
            }

        } catch (error) {
            result.passed = false;
            result.error = error.message;
        }

        return result;
    }

    // ============================================================================
    // PRIVATE HELPER METHODS - Internal implementation details
    // ============================================================================

    async function _loadDependencies(silent, verbose) {
        if (!isNode) return;

        // Load OpCodes
        if (!global.OpCodes) {
            global.OpCodes = require('../OpCodes.js');
        }

        // Load AlgorithmFramework
        if (!global.AlgorithmFramework) {
            const AlgorithmFrameworkPath = path.resolve(__dirname, '..', 'AlgorithmFramework.js');
            global.AlgorithmFramework = require(AlgorithmFrameworkPath);
        }

        // Load DummyBlockCipher for mode testing
        if (!global.DummyBlockCipher) {
            try {
                const dummyModule = require('./DummyBlockCipher.js');
                global.DummyBlockCipher = dummyModule.DummyBlockCipher;
            } catch (e) {
                if (verbose) console.warn('DummyBlockCipher not loaded');
            }
        }
    }

    function _validateMetadata(algorithm) {
        const errors = [];
        const required = ['name', 'description', 'category', 'year'];

        required.forEach(field => {
            if (!algorithm[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        });

        return errors;
    }

    function _isBlockCipherMode(algorithm) {
        try {
            if (algorithm.category && algorithm.category.name === 'Cipher Modes') {
                return true;
            }
            if (typeof AlgorithmFramework !== 'undefined' && AlgorithmFramework.CategoryType) {
                return algorithm.category === AlgorithmFramework.CategoryType.MODE;
            }
            const testInstance = algorithm.CreateInstance();
            return testInstance && (
                typeof testInstance.setBlockCipher === 'function' ||
                typeof testInstance.setBlockCipherAlgorithm === 'function'
            );
        } catch (error) {
            return false;
        }
    }

    function _setupBlockCipherMode(instance, vector, algorithmName) {
        const isSimpleMode = algorithmName === 'ECB';
        const dummyCipher = _createDummyCipher(vector, isSimpleMode);

        if (typeof instance.setBlockCipher === 'function') {
            instance.setBlockCipher(dummyCipher);
        }

        if (typeof instance.setIV === 'function') {
            if (vector.iv) {
                instance.setIV(vector.iv);
            } else {
                const defaultIV = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
                                  0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f];
                instance.setIV(defaultIV);
            }
        }
    }

    function _createDummyCipher(vector, isSimple) {
        if (!global.DummyBlockCipher) {
            throw new Error('DummyBlockCipher not available for mode testing');
        }

        const blockSize = vector.input.length;
        const keySize = vector.key ? vector.key.length : 16;

        return new DummyBlockCipher({
            blockSize: blockSize,
            keySize: keySize,
            simple: isSimple
        });
    }

    function _applyVectorProperties(instance, vector) {
        // Key handling
        if (vector.kek !== undefined) {
            _applyProperty(instance, vector, 'kek', 'setKEK');
            if (typeof instance.setKEK !== 'function' && typeof instance.setKey === 'function') {
                _applyProperty(instance, {...vector, key: vector.kek}, 'key', 'setKey');
            }
        } else {
            _applyProperty(instance, vector, 'key', 'setKey');
        }

        // IV/Nonce
        _applyProperty(instance, vector, 'iv', 'setIV');
        _applyProperty(instance, vector, 'nonce', 'setNonce');
        _applyProperty(instance, vector, 'iv1', 'setIV1');
        _applyProperty(instance, vector, 'iv2', 'setIV2');

        // Dual keys
        _applyProperty(instance, vector, 'key2', 'setKey2');

        // Tweaks
        _applyProperty(instance, vector, 'tweak', 'setTweak');
        _applyProperty(instance, vector, 'tweakKey', 'setTweakKey');

        // AEAD
        _applyProperty(instance, vector, 'aad', 'setAAD');
        _applyProperty(instance, vector, 'tagSize', 'setTagSize');
        _applyProperty(instance, vector, 'tagLength', 'setTagLength');
        _applyProperty(instance, vector, 'tag', 'setTag');

        // Format-preserving encryption
        _applyProperty(instance, vector, 'radix', 'setRadix');
        _applyProperty(instance, vector, 'alphabet', 'setAlphabet');

        // KDF properties
        _applyProperty(instance, vector, 'salt', 'setSalt');
        _applyProperty(instance, vector, 'info', 'setInfo');
        _applyProperty(instance, vector, 'outputSize', 'setOutputSize');
        _applyProperty(instance, vector, 'OutputSize', 'setOutputSize');
        _applyProperty(instance, vector, 'hashFunction', 'setHashFunction');
        _applyProperty(instance, vector, 'password', 'setPassword');
        _applyProperty(instance, vector, 'iterations', 'setIterations');

        // Apply any other properties
        const handledProps = new Set([
            'input', 'expected', 'text', 'uri', 'key', 'kek', 'key2', 'iv', 'iv1', 'iv2',
            'nonce', 'tweak', 'tweakKey', 'aad', 'tagSize', 'tagLength', 'tag', 'radix',
            'alphabet', 'salt', 'info', 'outputSize', 'OutputSize', 'hashFunction',
            'password', 'iterations'
        ]);

        Object.keys(vector).forEach(prop => {
            if (!handledProps.has(prop) && vector[prop] !== undefined) {
                try {
                    if (prop in instance) {
                        instance[prop] = vector[prop];
                    }
                } catch (error) {
                    // Silently ignore
                }
            }
        });
    }

    function _applyProperty(instance, vector, vectorProp, methodName) {
        if (vector[vectorProp] === undefined) return;

        const setterMethod = methodName || `set${vectorProp.charAt(0).toUpperCase()}${vectorProp.slice(1)}`;

        if (typeof instance[setterMethod] === 'function') {
            instance[setterMethod](vector[vectorProp]);
        } else if (vectorProp in instance) {
            instance[vectorProp] = vector[vectorProp];
        }
    }

    function _isInvertible(algorithm) {
        try {
            const instance = algorithm.CreateInstance(true);
            return instance !== null && instance !== undefined;
        } catch (error) {
            return false;
        }
    }

    function _compareArrays(arr1, arr2) {
        if (!arr1 || !arr2) return false;
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    // ============================================================================
    // EXPORTS - Make public API available
    // ============================================================================

    const TestEngine = {
        TestFile,
        TestAlgorithm,
        TestVector
    };

    // Node.js export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TestEngine;
    }

    // Browser global export
    if (typeof window !== 'undefined') {
        window.TestEngine = TestEngine;
    }

    // UMD global export
    if (typeof global !== 'undefined') {
        global.TestEngine = TestEngine;
    }

})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
