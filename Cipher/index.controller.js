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
        
        // Initialize testing tab
        this.updateTestingTabResults();
        
        console.log('✅ Application initialized successfully');
        console.log('📊 Loaded algorithms:', this.getAllAlgorithms().length);
        console.log('📋 Algorithm names:', this.getAllAlgorithms().map(a => a.name));
        
        // Auto-run tests for all algorithms
        setTimeout(() => this.autoRunAllTests(), 1000);
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
        
        // Global progress bar click to navigate to Testing tab
        const globalProgressContainer = document.getElementById('global-progress-container');
        if (globalProgressContainer) {
            globalProgressContainer.addEventListener('click', () => {
                this.switchTab('testing');
            });
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
     * Auto-run tests for all algorithms after page load
     */
    async autoRunAllTests() {
        console.log('🧪 Starting auto-test for all algorithms...');
        
        const algorithms = this.getAllAlgorithms().filter(alg => alg.tests && alg.tests.length > 0);
        console.log(`📊 Found ${algorithms.length} algorithms with test vectors`);
        
        // Show global testing indicator
        this.updateGlobalTestingProgress(0, algorithms.length, `Starting tests...`);
        
        // Process algorithms one by one with delay
        for (let i = 0; i < algorithms.length; i++) {
            const algorithm = algorithms[i];
            
            try {
                // Update global progress
                this.updateGlobalTestingProgress(i, algorithms.length, `Testing ${algorithm.name}...`);
                
                // Update card to show testing state (hourglass)
                this.updateCardTestingState(algorithm.name, true);
                
                // Give visual time to see hourglass
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Run tests for this algorithm
                await this.runAlgorithmTests(algorithm);
                
                // Update testing tab with results
                this.updateTestingTabResults();
                
                // Small delay between algorithms
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(`❌ Auto-test failed for ${algorithm.name}:`, error);
                
                // Store failed result
                algorithm.testResults = {
                    passed: 0,
                    total: algorithm.tests?.length || 0,
                    lastUpdated: Date.now(),
                    autoRun: true
                };
                
                // Update card to show failure
                this.updateCardTestingState(algorithm.name, false);
            }
        }
        
        // Complete global testing
        this.updateGlobalTestingProgress(algorithms.length, algorithms.length, `Completed testing ${algorithms.length} algorithms`);
        
        // Final update to testing tab
        this.updateTestingTabResults();
        
        console.log('✅ Auto-test completed for all algorithms');
    }
    
    /**
     * Run tests for a single algorithm
     */
    async runAlgorithmTests(algorithm) {
        if (!algorithm.tests || algorithm.tests.length === 0) {
            return;
        }
        
        let passedTests = 0;
        const totalTests = algorithm.tests.length;
        const startTime = performance.now();
        
        // Test each vector
        for (const test of algorithm.tests) {
            try {
                const result = this.executeAlgorithmTest(algorithm, test);
                if (result.success) {
                    passedTests++;
                }
            } catch (error) {
                console.warn(`Test failed for ${algorithm.name}:`, error.message);
            }
        }
        
        const duration = performance.now() - startTime;
        
        // Store results on algorithm
        algorithm.testResults = {
            passed: passedTests,
            total: totalTests,
            duration: duration,
            lastUpdated: Date.now(),
            autoRun: true
        };
        
        // Update the card UI
        this.updateCardTestingState(algorithm.name, false);
    }
    
    /**
     * Execute a single test for an algorithm
     */
    executeAlgorithmTest(algorithm, test) {
        const startTime = performance.now();
        
        try {
            // Validate test structure
            if (!test.input || !test.expected) {
                return {
                    success: false,
                    error: 'Test vector missing required input or expected output',
                    duration: performance.now() - startTime
                };
            }
            
            // Create algorithm instance
            const instance = algorithm.CreateInstance();
            if (!instance) {
                return {
                    success: false,
                    error: 'Failed to create algorithm instance',
                    duration: performance.now() - startTime
                };
            }
            
            // Feed input data
            instance.Feed(test.input);
            
            // Get output
            const output = instance.Result();
            
            // Compare with expected
            const success = this.compareByteArrays(output, test.expected);
            
            return {
                success: success,
                output: output,
                expected: test.expected,
                duration: performance.now() - startTime
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: performance.now() - startTime
            };
        }
    }
    
    /**
     * Compare two byte arrays for equality
     */
    compareByteArrays(arr1, arr2) {
        if (!arr1 || !arr2) return false;
        if (arr1.length !== arr2.length) return false;
        
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        
        return true;
    }
    
    /**
     * Update algorithm card testing state (show hourglass during testing)
     */
    updateCardTestingState(algorithmName, isTesting) {
        const algorithmCard = document.querySelector(`[data-name="${algorithmName}"]`);
        if (!algorithmCard) {
            console.warn(`⚠️ Card not found for algorithm: ${algorithmName}`);
            return;
        }
        
        const testButton = algorithmCard.querySelector('.card-test-btn');
        if (!testButton) {
            console.warn(`⚠️ Test button not found for algorithm: ${algorithmName}`);
            return;
        }
        
        if (isTesting) {
            // Store original content and show hourglass
            const originalText = testButton.innerHTML;
            console.log(`⏳ Starting test for ${algorithmName}, original text: "${originalText}"`);
            testButton.setAttribute('data-original-text', originalText);
            // Replace the test tube emoji with hourglass, handling any additional content like badges
            const updatedText = originalText.replace('🧪', '⏳');
            console.log(`⏳ Updated text: "${updatedText}"`);
            testButton.innerHTML = updatedText;
            testButton.disabled = true;
            testButton.style.opacity = '0.8';
            testButton.style.backgroundColor = '#ffa500';
            testButton.style.transform = 'scale(0.95)';
            testButton.style.transition = 'all 0.2s ease';
        } else {
            // Restore original content and update status
            const originalText = testButton.getAttribute('data-original-text');
            if (originalText) {
                testButton.innerHTML = originalText;
                testButton.removeAttribute('data-original-text');
            }
            testButton.disabled = false;
            testButton.style.opacity = '1';
            testButton.style.backgroundColor = '';
            testButton.style.transform = '';
            testButton.style.transition = '';
            
            // Update status color based on results
            const algorithm = this.getAlgorithm(algorithmName);
            if (algorithm && algorithm.testResults) {
                const { passed, total } = algorithm.testResults;
                let status = 'untested';
                
                if (total === 0) {
                    status = 'untested';
                } else if (passed === 0) {
                    status = 'none';
                } else if (passed === total) {
                    status = 'all';
                } else {
                    status = 'some';
                }
                
                // Remove old status classes
                testButton.classList.remove('test-status-none', 'test-status-some', 'test-status-all', 'test-status-untested');
                
                // Add new status class
                testButton.classList.add(`test-status-${status}`);
                testButton.setAttribute('data-test-status', status);
            }
        }
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
        
        // Filter individual algorithm cards
        cards.forEach(card => {
            const cardCategory = card.getAttribute('data-category');
            card.style.display = cardCategory === category ? 'block' : 'none';
        });
        
        // Filter palette sections (for chaining tab)
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

    /**
     * Update global testing progress indicator
     */
    updateGlobalTestingProgress(current, total, message) {
        const progressContainer = document.getElementById('global-progress-container');
        const progressFill = document.getElementById('global-test-progress-fill');
        const progressText = document.getElementById('global-test-progress-text');
        
        // Show progress bar when testing starts
        if (progressContainer) {
            progressContainer.style.display = current > 0 || total > 0 ? 'block' : 'none';
        }
        
        if (progressFill) {
            const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = message || `${current}/${total} algorithms tested`;
        }
        
        
        console.log(`📊 Testing progress: ${current}/${total} - ${message}`);
    }
    
    /**
     * Update the Testing tab with current test results
     */
    updateTestingTabResults() {
        const algorithms = this.getAllAlgorithms();
        const testedAlgorithms = algorithms.filter(alg => alg.testResults);
        
        // Update summary statistics
        let passed = 0, partial = 0, failed = 0;
        
        testedAlgorithms.forEach(alg => {
            if (alg.testResults.total === 0) return;
            
            if (alg.testResults.passed === 0) {
                failed++;
            } else if (alg.testResults.passed === alg.testResults.total) {
                passed++;
            } else {
                partial++;
            }
        });
        
        // Update summary UI
        const passedEl = document.getElementById('passed-algorithms');
        const partialEl = document.getElementById('partial-algorithms');
        const failedEl = document.getElementById('failed-algorithms');
        const successRateEl = document.getElementById('success-rate');
        
        if (passedEl) passedEl.textContent = passed;
        if (partialEl) partialEl.textContent = partial;
        if (failedEl) failedEl.textContent = failed;
        if (successRateEl) {
            const total = passed + partial + failed;
            const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
            successRateEl.textContent = `${rate}%`;
        }
        
        // Update test grid
        this.populateTestGrid(algorithms);
    }
    
    /**
     * Populate the test grid with algorithm results
     */
    populateTestGrid(algorithms) {
        const tbody = document.getElementById('test-grid-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        algorithms.forEach(algorithm => {
            const row = document.createElement('tr');
            const testCount = algorithm.tests ? algorithm.tests.length : 0;
            const results = algorithm.testResults;
            
            let status = '⚪ Not Tested';
            let statusClass = 'untested';
            let passed = 0, total = testCount;
            let successRate = 0;
            let duration = '-';
            let lastTested = '-';
            
            if (results) {
                passed = results.passed || 0;
                total = results.total || testCount;
                lastTested = new Date(results.lastUpdated).toLocaleTimeString();
                
                // Format duration
                if (results.duration !== undefined) {
                    if (results.duration < 1000) {
                        duration = `${Math.round(results.duration)}ms`;
                    } else {
                        duration = `${Math.round(results.duration / 1000 * 100) / 100}s`;
                    }
                }
                
                if (total === 0) {
                    status = '⚪ No Tests';
                } else if (passed === 0) {
                    status = '❌ Failed';
                    statusClass = 'failed';
                } else if (passed === total) {
                    status = '✅ Passed';
                    statusClass = 'passed';
                } else {
                    status = '🟡 Partial';
                    statusClass = 'partial';
                }
                
                successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
            }
            
            // Apply CSS class for row background tinting
            row.className = statusClass;
            
            row.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" data-algorithm="${algorithm.name}" /></td>
                <td><span class="test-status ${statusClass}">${status}</span></td>
                <td>${algorithm.name}</td>
                <td>${this.getCategoryString(algorithm.category)}</td>
                <td>${testCount}</td>
                <td>${passed}</td>
                <td>${total - passed}</td>
                <td>${successRate}%</td>
                <td>${duration}</td>
                <td>${lastTested}</td>
            `;
            
            // Add checkbox event listener for row selection
            const checkbox = row.querySelector('.row-checkbox');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    row.classList.add('selected');
                } else {
                    row.classList.remove('selected');
                }
            });
            
            tbody.appendChild(row);
        });
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
