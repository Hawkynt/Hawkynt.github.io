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

    // Load DebugConfig (works in both Node.js and browser)
    const DebugConfig = (function() {
        if (isNode && !global.DebugConfig) {
            try {
                return require('../DebugConfig.js');
            } catch (e) {
                // Fallback to console if DebugConfig not available
                return {
                    log: console.log.bind(console),
                    warn: console.warn.bind(console),
                    error: console.error.bind(console),
                    info: console.info.bind(console),
                    always: console.log.bind(console),
                    isEnabled: () => false
                };
            }
        }
        return global.DebugConfig || {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            info: console.info.bind(console),
            always: console.log.bind(console),
            isEnabled: () => false
        };
    })();

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

        // Verify dependencies are available
        if (typeof global.AlgorithmFramework === 'undefined') {
            throw new Error('AlgorithmFramework not available');
        }

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
        const AlgorithmFramework = global.AlgorithmFramework;
        const algorithmsBefore = AlgorithmFramework.Algorithms.length;

        // Get expected algorithm name from filename
        const expectedName = _getExpectedAlgorithmName(filePath);

        // Check if algorithm is already registered (loaded as dependency by another file)
        const alreadyRegistered = AlgorithmFramework.Algorithms.filter(a =>
            a.name && expectedName &&
            (a.name.toLowerCase() === expectedName.toLowerCase() ||
             a.name.toLowerCase().replace(/[-_\s]/g, '') === expectedName.toLowerCase().replace(/[-_\s]/g, ''))
        );

        const resolvedPath = path.resolve(filePath);

        // Only try to load if not already registered
        if (alreadyRegistered.length === 0) {
            try {
                require(resolvedPath);
            } catch (error) {
                result.interface.error = `Failed to load: ${error.message}`;
                return result;
            }
        }

        // Check for newly registered algorithms
        const algorithmsAfter = AlgorithmFramework.Algorithms.length;
        const registeredCount = algorithmsAfter - algorithmsBefore;

        let registeredAlgorithms;

        if (registeredCount === 0 && alreadyRegistered.length > 0) {
            // Algorithm was already registered from previous load (dependency)
            result.interface.passed = true;
            registeredAlgorithms = alreadyRegistered;
            result.interface.algorithms = registeredAlgorithms.map(a => a.name);
        } else if (registeredCount > 0) {
            // New algorithm(s) registered
            result.interface.passed = true;
            registeredAlgorithms = AlgorithmFramework.Algorithms.slice(algorithmsBefore);
            result.interface.algorithms = registeredAlgorithms.map(a => a.name);
        } else {
            // No registrations and not already registered
            result.interface.error = 'No algorithms registered';
            return result;
        }

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
                    status: funcResult.status,
                    passed: funcResult.passed,
                    total: funcResult.total,
                    vectorsPassed: funcResult.passed,
                    vectorsTotal: funcResult.total,
                    roundTripsPassed: funcResult.roundTripsPassed,
                    roundTripsAttempted: funcResult.roundTripsAttempted,
                    errors: funcResult.errors,
                    vectorDetails: funcResult.vectorResults
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
     * @returns {object} - { passed: number, total: number, errors: array, vectorResults: array, roundTripsPassed: number, status: string }
     */
    async function TestAlgorithm(algorithmInstance, options = {}) {
        const verbose = options.verbose || false;
        const progressCallback = options.progressCallback || null;

        // Verify dependencies are available
        const AlgorithmFramework = typeof window !== 'undefined' ? window.AlgorithmFramework : global.AlgorithmFramework;
        if (typeof AlgorithmFramework === 'undefined') {
            throw new Error('AlgorithmFramework not available - ensure it is loaded before testing');
        }

        const result = {
            passed: 0,
            total: 0,
            errors: [],
            vectorResults: [],
            roundTripsPassed: 0,
            roundTripsAttempted: 0,
            status: 'passed'
        };

        if (!algorithmInstance.tests || algorithmInstance.tests.length === 0) {
            result.errors.push('No test vectors defined');
            result.status = 'no-tests';
            return result;
        }

        const vectors = algorithmInstance.tests;
        result.total = vectors.length;

        // Determine requirements based on category
        const requiresRoundTrips = _requiresRoundTrips(algorithmInstance);
        const requiresEncodingStability = _requiresEncodingStability(algorithmInstance);

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

                // Track round trips
                if (vectorResult.roundTripSuccess === true) {
                    result.roundTripsPassed++;
                    result.roundTripsAttempted++;
                } else if (vectorResult.roundTripSuccess === false) {
                    result.roundTripsAttempted++;
                }
            } else {
                result.errors.push({
                    vector: i,
                    text: vectors[i].text,
                    error: vectorResult.error
                });
            }

            if (verbose) {
                const status = vectorResult.passed ? '✓' : '✗';
                const roundTrip = vectorResult.roundTripSuccess ? '↺✓' : (vectorResult.roundTripSuccess === false ? '↺✗' : '');
                DebugConfig.log(`  ${status} Vector ${i}: ${vectors[i].text || 'Unnamed'} ${roundTrip}`);
            }

            // CRITICAL: Yield to event loop every 5 vectors to keep UI responsive
            if ((i + 1) % 5 === 0 && typeof window !== 'undefined') {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // Determine final status
        if (result.passed === result.total && result.total > 0) {
            // All vectors passed - check round trip requirements
            const invertibilityRequired = (requiresRoundTrips || requiresEncodingStability) && result.passed > 0;
            const invertibilitySuccess = !invertibilityRequired || (result.roundTripsPassed === result.roundTripsAttempted && result.roundTripsAttempted > 0);

            if (invertibilitySuccess) {
                result.status = 'passed';
            } else if (requiresEncodingStability) {
                result.status = 'failed-encoding-stability';
                result.errors.push({
                    type: 'encoding-stability',
                    message: `Encoding stability failed (${result.roundTripsPassed}/${result.roundTripsAttempted} successful)`
                });
            } else {
                result.status = 'failed-roundtrips';
                result.errors.push({
                    type: 'roundtrips',
                    message: `Round-trip failed (${result.roundTripsPassed}/${result.roundTripsAttempted} successful)`
                });
            }
        } else if (result.passed > 0) {
            result.status = 'partial';
        } else {
            result.status = 'failed';
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
            expected: vector.expected,
            index: index,
            text: vector.text
        };

        try {
            // Create instance (respecting vector's inverse property for decryption tests)
            const isInverse = vector.inverse === true;
            const instance = algorithmInstance.CreateInstance(isInverse);
            if (!instance) {
                throw new Error('Failed to create algorithm instance');
            }

            // Handle block cipher modes
            if (_isBlockCipherMode(algorithmInstance)) {
                _setupBlockCipherMode(instance, vector, algorithmInstance.name);
            }

            // Apply all vector properties (key, iv, nonce, etc.)
            _applyVectorProperties(instance, vector);

            // Execute test with timeout protection (5 seconds max per test vector)
            const output = await _executeWithTimeout(
                () => {
                    instance.Feed(vector.input);
                    return instance.Result();
                },
                5000,
                `Test vector ${index} exceeded 5 second timeout`
            );
            result.output = output;

            // Compare with expected if provided
            const AlgorithmFramework = typeof window !== 'undefined' ? window.AlgorithmFramework : global.AlgorithmFramework;

            // Check if this is a round-trip only test (no expected value or expected equals input)
            const hasExpected = vector.expected && vector.expected.length > 0;
            const isRoundTripOnly = !hasExpected ||
                                   (AlgorithmFramework && AlgorithmFramework.CategoryType &&
                                    algorithmInstance.category === AlgorithmFramework.CategoryType.ASYMMETRIC &&
                                    _compareArrays(vector.expected, vector.input));

            if (isRoundTripOnly) {
                // No expected value - mark as passed, round-trip will validate
                result.passed = true;
            } else {
                // Compare output with expected value
                result.passed = _compareArrays(output, vector.expected);
            }

            // Test round-trip or encoding stability if invertible
            if (_isInvertible(algorithmInstance)) {
                try {
                    if (_requiresEncodingStability(algorithmInstance)) {
                        // Test encoding stability: encode(data) == encode(decode(encode(data)))
                        result.roundTripSuccess = await _testEncodingStability(algorithmInstance, vector, output);
                    } else {
                        // Test normal round-trip with timeout protection: decrypt(encrypt(data)) == data
                        const roundTripResult = await _executeWithTimeout(
                            () => {
                                // Create reverse instance: if we encrypted, decrypt; if we decrypted, encrypt
                                const reverseInstance = algorithmInstance.CreateInstance(!isInverse);
                                if (!reverseInstance) return null;

                                if (_isBlockCipherMode(algorithmInstance)) {
                                    _setupBlockCipherMode(reverseInstance, vector, algorithmInstance.name);
                                }
                                _applyVectorProperties(reverseInstance, vector);

                                reverseInstance.Feed(output);
                                return reverseInstance.Result();
                            },
                            5000,
                            `Round-trip test exceeded 5 second timeout`
                        );
                        result.roundTripSuccess = roundTripResult ? _compareArrays(roundTripResult, vector.input) : false;
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
                if (verbose) DebugConfig.warn('DummyBlockCipher not loaded');
            }
        }
    }

    /**
     * Execute a function with timeout protection
     * Prevents infinite loops from blocking the browser or test suite
     * @param {function} fn - Function to execute
     * @param {number} timeoutMs - Timeout in milliseconds
     * @param {string} timeoutMessage - Error message if timeout occurs
     * @returns {Promise} - Promise that resolves with function result or rejects on timeout
     */
    async function _executeWithTimeout(fn, timeoutMs, timeoutMessage) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(timeoutMessage || `Operation exceeded ${timeoutMs}ms timeout`));
            }, timeoutMs);

            try {
                // Execute the function
                const result = fn();

                // Clear timeout and resolve
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Extract expected algorithm name from filename
     * Maps common filename patterns to likely algorithm names
     */
    function _getExpectedAlgorithmName(filePath) {
        if (!filePath || !isNode) return null;

        const filename = path.basename(filePath, '.js');

        // Map filename patterns to expected algorithm names
        const nameMap = {
            'sha1': 'SHA-1',
            'sha256': 'SHA-256',
            'sha224': 'SHA-224',
            'sha384': 'SHA-384',
            'sha512': 'SHA-512',
            'sha3': 'SHA-3',
            'md5': 'MD5',
            'aes': 'Rijndael (AES)',
            'rijndael': 'Rijndael (AES)',
            '3des': '3DES (Triple DES)',
            'des': 'DES',
            'rc4': 'RC4',
            'rc2': 'RC2',
            'blowfish': 'Blowfish',
            'twofish': 'Twofish',
            'serpent': 'Serpent',
            'gost28147mac': 'GOST 28147-89 MAC',
            'cbcmac': 'CBC-MAC',
            'dmac': 'DMAC'
        };

        return nameMap[filename.toLowerCase()] || filename;
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
        // Modes that handle their own key splitting/management shouldn't have keys set on cipher
        const isMultiKeyMode = ['EDE', 'EEE'].includes(algorithmName);
        const dummyCipher = _createDummyCipher(vector, isSimpleMode, isMultiKeyMode);

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

    function _createDummyCipher(vector, isSimple, skipKeySet) {
        let algorithm = null;
        let instance = null;

        // Check if a specific cipher is requested in the test vector
        if (vector.cipher) {
            // Try to find the real cipher algorithm by name
            const AlgorithmFramework = typeof window !== 'undefined' ? window.AlgorithmFramework : global.AlgorithmFramework;

            if (AlgorithmFramework && AlgorithmFramework.Algorithms) {
                // Map common cipher names to their actual registered names and file paths
                const cipherNameMap = {
                    'AES': { name: 'Rijndael (AES)', file: 'block/rijndael.js' },
                    'Rijndael': { name: 'Rijndael (AES)', file: 'block/rijndael.js' },
                    'DES': { name: 'DES', file: 'block/des.js' },
                    '3DES': { name: '3DES (Triple DES)', file: 'block/3des.js' },
                    'Blowfish': { name: 'Blowfish', file: 'block/blowfish.js' },
                    'Camellia': { name: 'Camellia', file: 'block/camellia.js' },
                    'ARIA': { name: 'ARIA', file: 'block/aria.js' }
                };

                const cipherInfo = cipherNameMap[vector.cipher] || { name: vector.cipher, file: null };
                let foundAlgorithm = AlgorithmFramework.Algorithms.find(alg =>
                    alg.name === cipherInfo.name || alg.name === vector.cipher
                );

                // If not found and we're in Node.js, try to load the cipher file
                if (!foundAlgorithm && cipherInfo.file && isNode) {
                    try {
                        const cipherPath = path.join(__dirname, '..', 'algorithms', cipherInfo.file);
                        require(cipherPath);
                        // Try finding again after loading
                        foundAlgorithm = AlgorithmFramework.Algorithms.find(alg =>
                            alg.name === cipherInfo.name || alg.name === vector.cipher
                        );
                    } catch (error) {
                        // Silently fail - will fall back to DummyBlockCipher
                    }
                }

                if (foundAlgorithm) {
                    try {
                        algorithm = foundAlgorithm;
                        instance = algorithm.CreateInstance(false);
                    } catch (error) {
                        DebugConfig.warn(`Failed to create instance of ${vector.cipher}, falling back to DummyBlockCipher:`, error.message);
                    }
                }
            }
        }

        // Fall back to DummyBlockCipher if no specific cipher requested or cipher not found
        if (!instance) {
            const DummyBlockCipher = typeof window !== 'undefined' ? window.DummyBlockCipher : global.DummyBlockCipher;

            if (!DummyBlockCipher) {
                throw new Error('DummyBlockCipher not available for mode testing');
            }

            algorithm = new DummyBlockCipher();
            instance = algorithm.CreateInstance(false);
        }

        // Set key if provided in vector (skip for multi-key modes like EDE/EEE)
        if (!skipKeySet) {
            if (vector.key) {
                instance.key = vector.key;
            } else {
                // Default key
                instance.key = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
                               0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f];
            }
        }

        return instance;
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

        // Block size (for Kalyna and other variable block size algorithms)
        // Use property setter, not method call
        if (vector.blockSize !== undefined && 'blockSize' in instance) {
            instance.blockSize = vector.blockSize;
        }

        // Apply any other properties
        const handledProps = new Set([
            'input', 'expected', 'text', 'uri', 'key', 'kek', 'key2', 'iv', 'iv1', 'iv2',
            'nonce', 'tweak', 'tweakKey', 'aad', 'tagSize', 'tagLength', 'tag', 'radix',
            'alphabet', 'salt', 'info', 'outputSize', 'OutputSize', 'hashFunction',
            'password', 'iterations', 'blockSize', 'seed'
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

        // PRNG seed (apply AFTER other properties like stateSize, operationMode, etc.)
        _applyProperty(instance, vector, 'seed', 'setSeed');
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

    // Determine if algorithm category requires perfect round-trips (encrypt -> decrypt -> original)
    function _requiresRoundTrips(algorithm) {
        if (!algorithm.category) return false;

        // Categories that require perfect round-trip
        const perfectRoundTripCategories = [
            'Cipher', 'Block Cipher', 'Stream Cipher', 'Asymmetric', 'MAC', 'AEAD', 'Cipher Modes', 'Padding'
        ];

        // Check if category name matches (handle both string and object categories)
        const categoryName = typeof algorithm.category === 'string'
            ? algorithm.category
            : (algorithm.category.name || algorithm.category.toString());

        return perfectRoundTripCategories.some(cat =>
            categoryName && categoryName.toLowerCase().includes(cat.toLowerCase())
        );
    }

    // Determine if algorithm category requires encoding stability (encode -> decode -> encode -> same)
    function _requiresEncodingStability(algorithm) {
        if (!algorithm.category) return false;

        // Categories that require encoding stability
        const encodingStabilityCategories = [
            'Encoding', 'Checksum', 'Error Correction'
        ];

        // Check if category name matches
        const categoryName = typeof algorithm.category === 'string'
            ? algorithm.category
            : (algorithm.category.name || algorithm.category.toString());

        return encodingStabilityCategories.some(cat =>
            categoryName && categoryName.toLowerCase().includes(cat.toLowerCase())
        );
    }

    // Test encoding stability: encode(data) == encode(decode(encode(data)))
    async function _testEncodingStability(algorithm, vector, encodedOutput) {
        try {
            // Step 1: decode the encoded result: decode(encode(data))
            const decodeInstance = algorithm.CreateInstance(true); // true = decode mode
            if (!decodeInstance) return false;

            _applyVectorProperties(decodeInstance, vector);
            decodeInstance.Feed(encodedOutput);
            const decodedResult = decodeInstance.Result();

            // Step 2: re-encode the decoded result: encode(decode(encode(data)))
            const reEncodeInstance = algorithm.CreateInstance(false); // false = encode mode
            if (!reEncodeInstance) return false;

            _applyVectorProperties(reEncodeInstance, vector);
            reEncodeInstance.Feed(decodedResult);
            const reEncodedResult = reEncodeInstance.Result();

            // Step 3: verify encoding stability: encode(data) == encode(decode(encode(data)))
            return _compareArrays(encodedOutput, reEncodedResult);

        } catch (error) {
            return false;
        }
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
