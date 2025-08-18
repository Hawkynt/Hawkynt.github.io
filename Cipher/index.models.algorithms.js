/**
 * Algorithm Models and Data Management
 * Handles algorithm metadata, test vectors, and data structures
 * (c)2006-2025 Hawkynt
 */

class AlgorithmManager {
    constructor() {
        this.algorithms = new Map();
        this.testVectors = new Map();
        this.categories = new Map();
        this.testResults = new Map();
    }
    
    /**
     * Register a new algorithm
     */
    registerAlgorithm(name, metadata) {
        const algorithm = {
            name: metadata.name || name,
            category: metadata.category || 'unknown',
            description: metadata.description || '',
            country: metadata.country || '',
            year: metadata.year || null,
            working: metadata.working !== false,
            metadata: metadata,
            testVectors: [],
            implementation: metadata.implementation || null
        };
        
        this.algorithms.set(name, algorithm);
        this.addToCategory(algorithm.category, name);
        
        return algorithm;
    }
    
    /**
     * Add algorithm to category tracking
     */
    addToCategory(category, algorithmName) {
        if (!this.categories.has(category)) {
            this.categories.set(category, new Set());
        }
        this.categories.get(category).add(algorithmName);
    }
    
    /**
     * Get algorithm by name
     */
    getAlgorithm(name) {
        return this.algorithms.get(name);
    }
    
    /**
     * Get all algorithms
     */
    getAllAlgorithms() {
        return Array.from(this.algorithms.values());
    }
    
    /**
     * Get algorithms by category
     */
    getAlgorithmsByCategory(category) {
        const algorithmNames = this.categories.get(category) || new Set();
        return Array.from(algorithmNames).map(name => this.algorithms.get(name)).filter(Boolean);
    }
    
    /**
     * Get all categories
     */
    getCategories() {
        return Array.from(this.categories.keys());
    }
    
    /**
     * Add test vector to algorithm
     */
    addTestVector(algorithmName, testVector) {
        const algorithm = this.algorithms.get(algorithmName);
        if (algorithm) {
            algorithm.testVectors.push(testVector);
        }
    }
    
    /**
     * Get test vectors for algorithm
     */
    getTestVectors(algorithmName) {
        const algorithm = this.algorithms.get(algorithmName);
        return algorithm ? algorithm.testVectors : [];
    }
    
    /**
     * Store test result for algorithm
     */
    setTestResult(algorithmName, result) {
        this.testResults.set(algorithmName, result);
    }
    
    /**
     * Get test result for algorithm
     */
    getTestResult(algorithmName) {
        return this.testResults.get(algorithmName);
    }
    
    /**
     * Search algorithms by name or description
     */
    searchAlgorithms(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAllAlgorithms().filter(algorithm => 
            algorithm.name.toLowerCase().includes(lowerQuery) ||
            (algorithm.description && algorithm.description.toLowerCase().includes(lowerQuery))
        );
    }
    
    /**
     * Get algorithm statistics
     */
    getStatistics() {
        const total = this.algorithms.size;
        const working = this.getAllAlgorithms().filter(a => a.working).length;
        const categories = this.categories.size;
        
        const categoryStats = {};
        this.categories.forEach((algorithms, category) => {
            categoryStats[category] = algorithms.size;
        });
        
        return {
            total,
            working,
            categories,
            categoryBreakdown: categoryStats
        };
    }
}

/**
 * Test Vector Model
 */
class TestVector {
    constructor(data) {
        this.description = data.description || '';
        this.input = data.input || '';
        this.key = data.key || '';
        this.iv = data.iv || '';
        this.expected = data.expected || '';
        this.source = data.source || '';
        this.parameters = data.parameters || {};
        this.status = 'pending'; // pending, running, passed, failed
        this.result = null;
        this.error = null;
        this.executionTime = null;
    }
    
    /**
     * Run the test vector against an algorithm
     */
    async execute(algorithm) {
        this.status = 'running';
        const startTime = performance.now();
        
        try {
            // This would be implemented based on the actual algorithm interface
            const result = await this.runAlgorithm(algorithm);
            
            this.executionTime = performance.now() - startTime;
            
            if (this.compareResults(result, this.expected)) {
                this.status = 'passed';
                this.result = result;
            } else {
                this.status = 'failed';
                this.result = result;
                this.error = `Expected: ${this.expected}, Got: ${result}`;
            }
        } catch (error) {
            this.status = 'failed';
            this.error = error.message;
            this.executionTime = performance.now() - startTime;
        }
        
        return this.status === 'passed';
    }
    
    /**
     * Run algorithm with test vector data
     */
    async runAlgorithm(algorithm) {
        // Placeholder implementation - would need to be customized per algorithm type
        if (algorithm.implementation && algorithm.implementation.EncryptBlock) {
            const keyId = algorithm.implementation.KeySetup(this.key);
            const result = algorithm.implementation.EncryptBlock(keyId, this.input);
            algorithm.implementation.ClearData(keyId);
            return result;
        }
        
        throw new Error('Algorithm implementation not available');
    }
    
    /**
     * Compare actual vs expected results
     */
    compareResults(actual, expected) {
        // Handle different formats (hex, base64, etc.)
        const normalizeValue = (value) => {
            if (typeof value === 'string') {
                return value.toLowerCase().replace(/[^a-f0-9]/g, '');
            }
            return String(value);
        };
        
        return normalizeValue(actual) === normalizeValue(expected);
    }
}

/**
 * Algorithm Category Definitions
 */
class CategoryManager {
    constructor() {
        this.categoryDefinitions = {
            'block': {
                name: 'Block Ciphers',
                description: 'Symmetric encryption algorithms that process fixed-size blocks',
                color: '#3182ce',
                icon: '🔒'
            },
            'stream': {
                name: 'Stream Ciphers',
                description: 'Symmetric encryption algorithms that process data streams',
                color: '#38b2ac',
                icon: '🌊'
            },
            'hash': {
                name: 'Hash Functions',
                description: 'Cryptographic hash functions and message digests',
                color: '#d69e2e',
                icon: '#️⃣'
            },
            'classical': {
                name: 'Classical Ciphers',
                description: 'Historical encryption methods and traditional ciphers',
                color: '#dd6b20',
                icon: '📜'
            },
            'encoding': {
                name: 'Encoding Schemes',
                description: 'Data encoding and representation formats',
                color: '#805ad5',
                icon: '🔤'
            },
            'compression': {
                name: 'Compression',
                description: 'Data compression and decompression algorithms',
                color: '#38a169',
                icon: '🗜️'
            },
            'asymmetric': {
                name: 'Asymmetric (Public Key)',
                description: 'Public key cryptography and digital signatures',
                color: '#e53e3e',
                icon: '🔐'
            },
            'special': {
                name: 'Special Purpose',
                description: 'Specialized cryptographic constructions',
                color: '#2d3748',
                icon: '⚙️'
            },
            'mac': {
                name: 'Message Authentication',
                description: 'Message Authentication Codes and integrity protection',
                color: '#b83280',
                icon: '🔏'
            },
            'kdf': {
                name: 'Key Derivation',
                description: 'Key derivation functions and password-based cryptography',
                color: '#319795',
                icon: '🔑'
            },
            'mode': {
                name: 'Mode of Operation',
                description: 'Block cipher modes and operation methods',
                color: '#f56565',
                icon: '🔄'
            },
            'padding': {
                name: 'Padding Schemes',
                description: 'Data padding and block completion methods',
                color: '#9f7aea',
                icon: '📦'
            },
            'ecc': {
                name: 'Elliptic Curve',
                description: 'Elliptic curve cryptography and related algorithms',
                color: '#9f7aea',
                icon: '📈'
            },
            'checksum': {
                name: 'Checksums',
                description: 'Error detection and data integrity algorithms',
                color: '#ed8936',
                icon: '✅'
            }
        };
    }
    
    /**
     * Get category definition
     */
    getCategoryDefinition(categoryKey) {
        return this.categoryDefinitions[categoryKey] || {
            name: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1),
            description: `${categoryKey} algorithms`,
            color: '#667eea',
            icon: '❓'
        };
    }
    
    /**
     * Get all category definitions
     */
    getAllCategories() {
        return this.categoryDefinitions;
    }
    
    /**
     * Get category color
     */
    getCategoryColor(categoryKey) {
        const definition = this.getCategoryDefinition(categoryKey);
        return definition.color;
    }
}

// Export classes for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AlgorithmManager,
        TestVector,
        CategoryManager
    };
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.AlgorithmManager = AlgorithmManager;
    window.TestVector = TestVector;
    window.CategoryManager = CategoryManager;
}