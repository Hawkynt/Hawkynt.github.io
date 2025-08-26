/**
 * Algorithm Models and Data Management
 * Uses AlgorithmFramework as the only algorithm registry
 * (c)2006-2025 Hawkynt
 */

class AlgorithmManager {
    constructor() {
        // Only use AlgorithmFramework as the algorithm registry
        this.testResults = new Map();
    }
    
    /**
     * Register a new algorithm - use AlgorithmFramework.RegisterAlgorithm
     */
    registerAlgorithm(algorithm) {
        AlgorithmFramework.RegisterAlgorithm(algorithm);
    }
    
    /**
     * Get algorithm by name
     */
    getAlgorithm(name) {
        return AlgorithmFramework.Find(name);
    }
    
    /**
     * Get all algorithms from AlgorithmFramework
     */
    getAllAlgorithms() {
        return AlgorithmFramework.Algorithms;
    }
    
    /**
     * Get algorithms by category
     */
    getAlgorithmsByCategory(category) {
        const algorithms = this.getAllAlgorithms();
        const categoryKey = this._mapCategoryStringToEnum(category);
        
        return algorithms.filter(algorithm => algorithm.category === categoryKey);
    }
    
    /**
     * Get all categories from AlgorithmFramework
     */
    getCategories() {
        return Object.keys(AlgorithmFramework.CategoryType).map(key => 
            key.toLowerCase().replace(/_/g, '-')
        );
    }
    
    /**
     * Map category string to AlgorithmFramework CategoryType enum
     */
    _mapCategoryStringToEnum(categoryString) {
        const enumKey = categoryString.toUpperCase().replace(/-/g, '_');
        return AlgorithmFramework.CategoryType[enumKey];
    }
    
    /**
     * Get test vectors for algorithm
     */
    getTestVectors(algorithmName) {
        const algorithm = this.getAlgorithm(algorithmName);
        return algorithm ? (algorithm.tests || []) : [];
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
 * Algorithm Category Manager - uses AlgorithmFramework CategoryType
 */
class CategoryManager {
    constructor() {
        // No local storage needed - uses AlgorithmFramework directly
    }
    
    /**
     * Get category definition from AlgorithmFramework CategoryType
     */
    getCategoryDefinition(categoryKey) {
        // Convert categoryKey to framework enum key
        const enumKey = categoryKey.toUpperCase().replace(/-/g, '_');
        const frameworkCategory = AlgorithmFramework.CategoryType[enumKey];
        
        return {
            name: frameworkCategory.name,
            description: frameworkCategory.description,
            color: frameworkCategory.color,
            icon: frameworkCategory.icon
        };
    }
    
    /**
     * Get all category definitions from AlgorithmFramework
     */
    getAllCategories() {
        const categories = {};
        
        Object.entries(AlgorithmFramework.CategoryType).forEach(([key, category]) => {
            const categoryKey = key.toLowerCase().replace(/_/g, '-');
            categories[categoryKey] = {
                name: category.name,
                description: category.description,
                color: category.color,
                icon: category.icon
            };
        });
        
        return categories;
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