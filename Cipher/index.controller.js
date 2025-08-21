/**
 * Main Controller for Cipher Tools Application
 * Manages application state, tab navigation, and core functionality
 * (c)2006-2025 Hawkynt
 */

class CipherController {
    constructor() {
        // Only use AlgorithmFramework - no local storage
        this.testResults = null;
        
        // Don't auto-initialize - wait for manual call
    }
    
    async initializeApplication() {
        console.log('🔐 Initializing Cipher Tools Application...');
        
        // Verify AlgorithmFramework is available
        if (typeof AlgorithmFramework === 'undefined') {
            console.error('❌ AlgorithmFramework not available');
            return;
        }
        
        console.log('✅ AlgorithmFramework available');
        console.log('📊 Algorithms registered:', AlgorithmFramework.Algorithms.length);
        
        // Setup UI systems (will throw if AlgorithmFramework is not available)
        this.setupEventListeners();
        this.setupTabNavigation();
        this.renderAlgorithms();
        this.updateStats();
        
        console.log('✅ Application initialized successfully');
        console.log('📊 Loaded algorithms:', this.getAllAlgorithms().length);
        console.log('📋 Algorithm names:', this.getAllAlgorithms().map(a => a.name));
    }
    
    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterAlgorithms(e.target.value));
        }
        
        // Category filter
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => this.filterByCategory(e.target.value));
        }
        
        // Test grid functionality
        this.setupTestGridEventListeners();
        
        // Metadata modal
        this.setupMetadataModal();
    }
    
    setupTabNavigation() {
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = e.target.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });
    }
    
    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active from nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show target tab
        const targetTab = document.getElementById(`${tabName}-tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // Activate nav tab
        const navTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (navTab) {
            navTab.classList.add('active');
        }
        
        // Initialize tab-specific functionality
        this.initializeTabContent(tabName);
    }
    
    initializeTabContent(tabName) {
        switch (tabName) {
            case 'chaining':
                if (window.ChainBuilder && !this.chainBuilder) {
                    this.chainBuilder = new ChainBuilder();
                }
                break;
            case 'cipher':
                this.initializeCipherInterface();
                break;
            case 'testing':
                this.initializeTestingTab();
                break;
        }
    }
    
    /**
     * Get all algorithms from AlgorithmFramework
     */
    getAllAlgorithms() {
        return AlgorithmFramework.Algorithms;
    }
    
    /**
     * Get algorithm by name from AlgorithmFramework
     */
    getAlgorithm(name) {
        return AlgorithmFramework.Find(name);
    }
    
    /**
     * Get category string from AlgorithmFramework category object
     */
    getCategoryString(category) {
        if (!category) return 'unknown';
        
        if (typeof category === 'string') return category;
        
        // Map AlgorithmFramework CategoryType to string
        const categoryMap = {
            'Asymmetric Ciphers': 'asymmetric',
            'Block Ciphers': 'block',
            'Stream Ciphers': 'stream',
            'Hash Functions': 'hash',
            'Compression Algorithms': 'compression',
            'Encoding Schemes': 'encoding',
            'Classical Ciphers': 'classical',
            'Message Authentication': 'mac',
            'Key Derivation Functions': 'kdf',
            'Error Correction': 'ecc',
            'Checksums': 'checksum',
            'Cipher Modes': 'mode',
            'Padding Schemes': 'padding',
            'Authenticated Encryption': 'aead',
            'Special Algorithms': 'special',
            'Post-Quantum Cryptography': 'pqc',
            'Random Number Generators': 'random'
        };
        
        return categoryMap[category.name] || category.name.toLowerCase().replace(/\s+/g, '-');
    }
    
    renderAlgorithms() {
        const container = document.getElementById('algorithms-grid');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Get all algorithms from AlgorithmFramework and sort alphabetically by name
        const allAlgorithms = this.getAllAlgorithms()
            .map(algorithm => ({
                name: algorithm.name,
                category: algorithm.category, // Keep full CategoryType object for color/icon
                description: algorithm.description || '',
                country: algorithm.country, // Keep full CountryCode object for flag
                year: algorithm.year || null,
                working: true, // AlgorithmFramework algorithms are assumed working
                tests: algorithm.tests, // Include tests array for count
                metadata: algorithm,
                implementation: algorithm
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        
        // Render each algorithm card
        allAlgorithms.forEach(algorithm => {
            let card;
            
            // Use AlgorithmCard component if available, otherwise fall back to old method
            if (window.AlgorithmCard) {
                const algorithmCard = new AlgorithmCard(algorithm, {
                    showActions: true,
                    showStatus: true,
                    showBadges: true,
                    onDetailsClick: (algo) => this.showMetadata(algo.name),
                    onTestClick: (algo) => this.runTestAndSwitchToTestVectors(algo.name),
                    onUseClick: (algo) => this.selectAlgorithm(algo.name)
                });
                card = algorithmCard.createElement();
            } else {
                card = this.createAlgorithmCard(algorithm);
            }
            
            container.appendChild(card);
        });
    }
    
    groupAlgorithmsByCategory() {
        const groups = {};
        
        this.getAllAlgorithms().forEach(algorithm => {
            const category = this.getCategoryString(algorithm.category) || 'unknown';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push({
                name: algorithm.name,
                category: algorithm.category, // Keep full CategoryType object
                description: algorithm.description || '',
                country: algorithm.country, // Keep full CountryCode object
                year: algorithm.year || null,
                working: true,
                tests: algorithm.tests, // Include tests array
                metadata: algorithm,
                implementation: algorithm
            });
        });
        
        return groups;
    }
    
    renderAlgorithmCategory(container, categoryName, algorithms) {
        const section = document.createElement('div');
        section.className = 'palette-section';
        section.setAttribute('data-category', categoryName);
        
        const header = document.createElement('div');
        header.className = 'palette-header';
        header.textContent = this.getCategoryDisplayName(categoryName);
        
        const grid = document.createElement('div');
        grid.className = 'algorithms-grid';
        
        algorithms.forEach(algorithm => {
            let card;
            
            // Use AlgorithmCard component if available, otherwise fall back to old method
            if (window.AlgorithmCard) {
                const algorithmCard = new AlgorithmCard(algorithm, {
                    showActions: true,
                    showStatus: true,
                    showBadges: true,
                    onDetailsClick: (algo) => this.showMetadata(algo.name),
                    onTestClick: (algo) => this.runAlgorithmTests(algo.name),
                    onUseClick: (algo) => this.selectAlgorithm(algo.name)
                });
                card = algorithmCard.createElement();
            } else {
                card = this.createAlgorithmCard(algorithm);
            }
            
            grid.appendChild(card);
        });
        
        section.appendChild(header);
        section.appendChild(grid);
        container.appendChild(section);
    }
    
    createAlgorithmCard(algorithm) {
        const card = document.createElement('div');
        card.className = 'algorithm-card';
        card.setAttribute('data-category', algorithm.category);
        card.setAttribute('data-name', algorithm.name);
        
        const statusIcon = this.getAlgorithmStatusIcon(algorithm.name, algorithm);
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${statusIcon} ${algorithm.name}</div>
                <div class="card-badges">
                    <span class="badge badge-category">${algorithm.category}</span>
                    ${algorithm.country ? `<span class="badge badge-country">${algorithm.country}</span>` : ''}
                    ${algorithm.year ? `<span class="badge badge-year">${algorithm.year}</span>` : ''}
                </div>
            </div>
            <div class="card-description">
                ${algorithm.description || 'A cryptographic algorithm implementation.'}
            </div>
            <div class="card-actions">
                <button class="btn btn-primary btn-small" onclick="cipherController.showMetadata('${algorithm.name}')">
                    📖 Details
                </button>
                <button class="btn btn-secondary btn-small" onclick="cipherController.selectAlgorithm('${algorithm.name}')">
                    🔧 Use
                </button>
            </div>
        `;
        
        return card;
    }
    
    getAlgorithmStatusIcon(name, algorithm) {
        const testResult = this.testResults?.find(r => r.name === name);
        
        if (testResult) {
            if (testResult.total === 0) {
                return algorithm.working ? '✅' : '❌';
            } else if (testResult.passed === testResult.total) {
                return '✅'; // All tests passed
            } else if (testResult.passed > 0) {
                return '⚠️'; // Some tests passed, some failed
            } else {
                return '❌'; // All tests failed
            }
        }
        
        // Fallback to working status
        return algorithm.working ? '✅' : '❌';
    }
    
    getCategoryDisplayName(category) {
        const displayNames = {
            'block': 'Block Ciphers',
            'stream': 'Stream Ciphers',
            'hash': 'Hash Functions',
            'classical': 'Classical Ciphers',
            'encoding': 'Encoding Schemes',
            'compression': 'Compression',
            'asymmetric': 'Asymmetric (Public Key)',
            'special': 'Special Purpose',
            'mac': 'Message Authentication',
            'kdf': 'Key Derivation',
            'mode': 'Mode of Operation',
            'padding': 'Padding Schemes',
            'ecc': 'Elliptic Curve',
            'checksum': 'Checksums',
            'unknown': 'Other'
        };
        
        return displayNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }
    
    filterAlgorithms(searchTerm) {
        const cards = document.querySelectorAll('.algorithm-card');
        const sections = document.querySelectorAll('.palette-section');
        
        cards.forEach(card => {
            const name = card.getAttribute('data-name').toLowerCase();
            const matches = name.includes(searchTerm.toLowerCase());
            card.style.display = matches ? 'block' : 'none';
        });
        
        // Hide sections with no visible cards
        sections.forEach(section => {
            const visibleCards = section.querySelectorAll('.algorithm-card[style*="block"], .algorithm-card:not([style*="none"])');
            section.style.display = visibleCards.length > 0 ? 'block' : 'none';
        });
    }
    
    filterByCategory(category) {
        const cards = document.querySelectorAll('.algorithm-card');
        const sections = document.querySelectorAll('.palette-section');
        
        if (!category) {
            // Show all
            cards.forEach(card => card.style.display = 'block');
            sections.forEach(section => section.style.display = 'block');
            return;
        }
        
        sections.forEach(section => {
            const sectionCategory = section.getAttribute('data-category');
            section.style.display = sectionCategory === category ? 'block' : 'none';
        });
    }
    
    selectAlgorithm(algorithmName) {
        // Switch to cipher interface tab and select algorithm
        this.switchTab('cipher');
        
        // Set the algorithm in the cipher interface
        const algorithmSelect = document.getElementById('selected-algorithm');
        if (algorithmSelect) {
            algorithmSelect.value = algorithmName;
            algorithmSelect.dispatchEvent(new Event('change'));
        }
    }
    
    showMetadata(algorithmName) {
        console.log(`Showing metadata for: ${algorithmName}`);
        
        const frameworkAlgorithm = this.getAlgorithm(algorithmName);
        if (!frameworkAlgorithm) {
            console.error(`Algorithm not found: ${algorithmName}`);
            return;
        }
        
        // Create algorithm details component if not exists
        if (!this.algorithmDetails) {
            this.algorithmDetails = new AlgorithmDetails({
                onClose: () => {
                    console.log('Algorithm details modal closed');
                }
            });
        }
        
        // Show the modal with algorithm data
        this.algorithmDetails.show(frameworkAlgorithm);
    }
    
    // Modal methods removed - now using AlgorithmDetails component
    
    
    updateStats() {
        const totalElement = document.getElementById('total-algorithms');
        const workingElement = document.getElementById('working-algorithms');
        const categoriesElement = document.getElementById('categories');
        
        const algorithms = this.getAllAlgorithms();
        
        if (totalElement) totalElement.textContent = algorithms.length;
        
        if (workingElement) {
            // All AlgorithmFramework algorithms are considered working
            workingElement.textContent = algorithms.length;
        }
        
        if (categoriesElement) {
            const categories = new Set(algorithms.map(a => this.getCategoryString(a.category)));
            categoriesElement.textContent = categories.size;
        }
    }

    getCategoryString(category) {
        if (typeof category === 'string') return category;
        if (category && category.name) return category.name;
        return 'unknown';
    }

    setupTestGridEventListeners() {
        // Implementation for test grid sorting and functionality
        console.log('Setting up test grid event listeners...');
        
        // Test grid functionality will be implemented here
    }

    setupMetadataModal() {
        // Implementation for metadata modal functionality
        console.log('Setting up metadata modal...');
    }

    /**
     * Run tests and switch to test vectors tab - called from card test button  
     */
    async runTestAndSwitchToTestVectors(algorithmName) {
        console.log(`Running tests and switching to test vectors for ${algorithmName}`);
        
        // Switch to metadata modal and show test vectors tab
        this.showMetadata(algorithmName);
        
        // Wait a moment for modal to open, then switch to test vectors tab
        setTimeout(() => {
            if (this.algorithmDetails) {
                this.algorithmDetails.switchTab('test-vectors');
                // Auto-run all test vectors could be implemented here
            }
        }, 100);
    }

}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔗 Window loaded, checking AlgorithmFramework...');
    
    if (typeof AlgorithmFramework !== 'undefined') {
        console.log('AlgorithmFramework available:', !!AlgorithmFramework);
        console.log('🔢 Initial algorithm count:', AlgorithmFramework.Algorithms.length);
    }
    
    // Add a small delay to ensure all cipher registrations are complete
    setTimeout(() => {
        console.log('⏰ Starting controller initialization...');
        if (typeof AlgorithmFramework !== 'undefined') {
            console.log('🔢 Algorithm count after delay:', AlgorithmFramework.Algorithms.length);
        }
        window.cipherController = new CipherController();
    }, 500); // Increased delay to allow more algorithms to register
});

// Also expose for global access
window.app = window.cipherController;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CipherController;
}
