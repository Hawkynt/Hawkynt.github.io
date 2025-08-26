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
        
        // Setup UI systems 
        this.setupEventListeners();
        this.setupTabNavigation();
        
        this.setupAlgorithmsInterface();
        this.setupCipherInterface();
        this.setupChainingInterface();
        this.setupTestingInterface();
      
        this.updateStats();
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
        // Convert category to key format
        let categoryKey = category;
        
        if (typeof category === 'object' && category.name) {
            // Find the CategoryType key for this category object
            categoryKey = Object.keys(AlgorithmFramework.CategoryType).find(
                key => AlgorithmFramework.CategoryType[key].name === category.name
            );
        } else if (typeof category === 'string') {
            categoryKey = category.toUpperCase();
        }
        
        // Get display name from CategoryType
        const categoryType = AlgorithmFramework.CategoryType[categoryKey];
        if (categoryType) {
            return categoryType.name;
        }
        
        // Fallback for unknown categories
        return typeof category === 'string' 
            ? category.charAt(0).toUpperCase() + category.slice(1)
            : 'Unknown Category';
    }
    
    /**
     * Get category icon from CategoryType
     */
    getCategoryIcon(category) {
        const categoryType = this.getCategoryType(category);
        return categoryType ? categoryType.icon : '❓';
    }
    
    /**
     * Get category color from CategoryType
     */
    getCategoryColor(category) {
        const categoryType = this.getCategoryType(category);
        return categoryType ? categoryType.color : '#6c757d';
    }
    
    /**
     * Get category description from CategoryType
     */
    getCategoryDescription(category) {
        const categoryType = this.getCategoryType(category);
        return categoryType ? categoryType.description : 'Unknown category';
    }
    
    /**
     * Get CategoryType object from category input
     */
    getCategoryType(category) {
        let categoryKey = category;
        
        if (typeof category === 'object' && category.name) {
            // Find the CategoryType key for this category object
            categoryKey = Object.keys(AlgorithmFramework.CategoryType).find(
                key => AlgorithmFramework.CategoryType[key].name === category.name
            );
        } else if (typeof category === 'string') {
            categoryKey = category.toUpperCase();
        }
        
        return AlgorithmFramework.CategoryType[categoryKey] || null;
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
            const categories = new Set(
                algorithms.map(a => this.getCategoryDisplayName(a.category))
            );
            categoriesElement.textContent = categories.size;
        }
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
     * Get filtered algorithms based on testing tab filters
     */
    getFilteredAlgorithmsForTesting() {
        let algorithms = this.getAllAlgorithms();
        
        // Apply category filter
        const categoryFilter = document.getElementById('test-filter-category');
        if (categoryFilter && categoryFilter.value !== 'all') {
            const selectedCategory = categoryFilter.value.toUpperCase();
            const categoryType = AlgorithmFramework.CategoryType[selectedCategory];
            if (categoryType) {
                algorithms = algorithms.filter(alg => alg.category === categoryType);
            }
        }
        
        // Apply status filter
        const statusFilter = document.getElementById('test-filter-status');
        if (statusFilter && statusFilter.value !== 'all') {
            const selectedStatus = statusFilter.value;
            algorithms = algorithms.filter(alg => {
                const results = alg.testResults;
                const testCount = alg.tests ? alg.tests.length : 0;
                
                switch (selectedStatus) {
                    case 'passed':
                        return results && results.total > 0 && results.passed === results.total;
                    case 'partial':
                        return results && results.total > 0 && results.passed > 0 && results.passed < results.total;
                    case 'failed':
                        return results && results.total > 0 && results.passed === 0;
                    case 'untested':
                        return !results || results.total === 0;
                    case 'testing':
                        return results && results.isRunning;
                    default:
                        return true;
                }
            });
        }
        
        return algorithms;
    }

    /**
     * Update the Testing tab with current test results
     */
    updateTestingTabResults() {
        const algorithms = this.getFilteredAlgorithmsForTesting();
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
                <td>${this.getCategoryDisplayName(algorithm.category)}</td>
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
    
    setupAlgorithmsInterface() {
      this.populateAlgorithmCategoriesDropdown();
      this.renderAlgorithms();
    }
    
    /**
     * Setup cipher interface with algorithm dropdown and encryption/decryption
     */
    setupCipherInterface() {
        console.log('🔐 Setting up cipher interface...');
        
        this.populateAlgorithmDropdown();
        this.populateModeDropdown();
        this.populatePaddingDropdown();
        
        // Setup encrypt/decrypt buttons
        const encryptBtn = document.getElementById('encrypt-btn');
        const decryptBtn = document.getElementById('decrypt-btn');
        const clearBtn = document.getElementById('clear-btn');
        
        if (encryptBtn) {
            encryptBtn.addEventListener('click', () => this.performEncryption());
        }
        
        if (decryptBtn) {
            decryptBtn.addEventListener('click', () => this.performDecryption());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCipherInterface());
        }
        
        // Setup format tab switching
        this.setupFormatTabs();
        
        // Setup file upload
        this.setupFileUpload();
        
        // Setup copy and download buttons
        this.setupOutputActions();
        
        console.log('✅ Cipher interface setup complete');
    }
    
    /**
     * Setup algorithm chaining interface
     */
    setupChainingInterface() {
        console.log('🔗 Setting up chaining interface...');
        
        const executeBtn = document.getElementById('execute-chain');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeChain());
        }
        
        const resetBtn = document.getElementById('reset-chain');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.clearCanvas());
        }
        
        // Initialize chain builder if available
        this.initializeChainBuilder();
        
        // Setup drag and drop functionality
        this.setupDragAndDrop();
        
        // Setup algorithm palette tabs
        this.setupAlgorithmTabs();
        
        // Setup global functions for HTML onclick handlers
        if (typeof window !== 'undefined') {
            window.addTestNodes = () => this.addTestNodes();
            window.clearCanvas = () => this.clearCanvas();
            
            // Auto-update stats periodically
            setInterval(() => {
                this.updateChainStats();
            }, 2000);
        }
        
        console.log('✅ Chaining interface setup complete');
    }
    
    setupTestingInterface() {
        this.populateTestingCategoriesDropdown();
        this.setupTestingFilters();
    }
    
    /**
     * Setup event listeners for testing filters
     */
    setupTestingFilters() {
        const statusFilter = document.getElementById('test-filter-status');
        const categoryFilter = document.getElementById('test-filter-category');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.updateTestingTabResults();
            });
        }
        
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.updateTestingTabResults();
            });
        }
        
        console.log('✅ Testing filters setup complete');
    }
    
    /**
     * Initialize the chain builder
     */
    initializeChainBuilder() {
        // Check if ChainBuilder class is available
        if (typeof ChainBuilder !== 'undefined') {
            console.log('🔗 ChainBuilder class found, initializing...');
            this.chainBuilder = new ChainBuilder();
            this.populateAlgorithmPalette();
        } else {
            console.log('⚠️ ChainBuilder class not found, creating minimal implementation...');
            this.createMinimalChainBuilder();
        }
    }
    
    /**
     * Create minimal chain builder if the full one isn't available
     */
    createMinimalChainBuilder() {
        this.chainBuilder = {
            nodes: new Map(),
            connections: new Map(),
            
            addNode: function(id, nodeData) {
                this.nodes.set(id, nodeData);
            },
            
            addConnection: function(id, connectionData) {
                this.connections.set(id, connectionData);
            },
            
            clear: function() {
                this.nodes.clear();
                this.connections.clear();
            }
        };
        
        // Add default input/output nodes
        this.chainBuilder.addNode('input_default', {
            id: 'input_default',
            type: 'input',
            title: 'Data Input',
            x: 50,
            y: 100,
            inputs: [],
            outputs: ['data'],
            parameters: []
        });
        
        this.chainBuilder.addNode('output_default', {
            id: 'output_default',
            type: 'output', 
            title: 'Result Output',
            x: 400,
            y: 100,
            inputs: ['result'],
            outputs: [],
            parameters: []
        });
        
        this.populateAlgorithmPalette();
        
        // Create a demo chain to show expected functionality
        this.createDemoChain();
        
        console.log('✅ Minimal chain builder created');
    }
    
    /**
     * Create a demo chain showing CBC(AES(PADDING(data)))
     */
    createDemoChain() {
        if (!this.chainBuilder) return;
        
        const algorithms = this.getAllAlgorithms();
        
        // Find AES algorithm
        const aesAlgorithm = algorithms.find(a => 
            a.name.includes('AES') || 
            a.name.includes('Rijndael')
        );
        
        // Find CBC mode if available
        const cbcAlgorithm = algorithms.find(a => 
            a.name.includes('CBC')
        );
        
        // Add PADDING node
        this.chainBuilder.addNode('padding_1', {
            id: 'padding_1',
            type: 'padding',
            title: 'PKCS7 Padding',
            algorithm: null,
            x: 120,
            y: 100,
            inputs: ['data'],
            outputs: ['padded_data'],
            parameters: []
        });
        
        // Connect input to padding
        this.chainBuilder.addConnection('conn_input_padding', {
            from: 'input_default',
            to: 'padding_1',
            fromPort: 0,
            toPort: 0
        });
        
        // Add AES node if available
        if (aesAlgorithm) {
            this.chainBuilder.addNode('aes_1', {
                id: 'aes_1',
                type: 'algorithm',
                title: aesAlgorithm.name,
                algorithm: aesAlgorithm,
                x: 200,
                y: 100,
                inputs: ['padded_data'],
                outputs: ['encrypted_blocks'],
                parameters: ['key']
            });
            
            // Connect padding to AES
            this.chainBuilder.addConnection('conn_padding_aes', {
                from: 'padding_1',
                to: 'aes_1',
                fromPort: 0,
                toPort: 0
            });
            
            // Add CBC mode if available
            if (cbcAlgorithm) {
                this.chainBuilder.addNode('cbc_1', {
                    id: 'cbc_1',
                    type: 'mode',
                    title: 'CBC Mode',
                    algorithm: cbcAlgorithm,
                    x: 300,
                    y: 100,
                    inputs: ['encrypted_blocks'],
                    outputs: ['ciphertext'],
                    parameters: ['iv']
                });
                
                // Connect AES to CBC
                this.chainBuilder.addConnection('conn_aes_cbc', {
                    from: 'aes_1',
                    to: 'cbc_1',
                    fromPort: 0,
                    toPort: 0
                });
                
                // Connect CBC to output
                this.chainBuilder.addConnection('conn_cbc_output', {
                    from: 'cbc_1',
                    to: 'output_default',
                    fromPort: 0,
                    toPort: 0
                });
            } else {
                // Connect AES directly to output if no CBC
                this.chainBuilder.addConnection('conn_aes_output', {
                    from: 'aes_1',
                    to: 'output_default',
                    fromPort: 0,
                    toPort: 0
                });
            }
        } else {
            // Connect padding directly to output if no AES
            this.chainBuilder.addConnection('conn_padding_output', {
                from: 'padding_1',
                to: 'output_default',
                fromPort: 0,
                toPort: 0
            });
        }
        
        console.log('🏗️ Demo chain created with', this.chainBuilder.nodes.size, 'nodes');
    }
    
    /**
     * Populate the algorithm dropdown with available algorithms
     */
    /**
     * Populate algorithm categories dropdown for filtering
     */
    populateAlgorithmCategoriesDropdown() {
        const categoryFilter = document.getElementById('category-filter');
        if (!categoryFilter) return;
        
        // Clear existing options except the first placeholder
        while (categoryFilter.children.length > 1) {
            categoryFilter.removeChild(categoryFilter.lastChild);
        }
        
        // Get unique categories from AlgorithmFramework
        const categories = Object.keys(AlgorithmFramework.CategoryType).sort();
        
        categories.forEach(categoryKey => {
            const categoryType = AlgorithmFramework.CategoryType[categoryKey];
            const option = document.createElement('option');
            option.value = categoryKey.toLowerCase();
            option.textContent = `${categoryType.icon} ${categoryType.name}`;
            categoryFilter.appendChild(option);
        });
        
        console.log(`📋 Populated category filter with ${categories.length} categories`);
    }
    
    /**
     * Populate cipher modes dropdown from MODE category algorithms
     */
    populateModeDropdown() {
        const modeSelect = document.getElementById('cipher-mode');
        if (!modeSelect) return;
        
        // Get algorithms from MODE category
        const algorithms = this.getAllAlgorithms();
        const modeAlgorithms = algorithms.filter(algorithm => 
            algorithm.category === AlgorithmFramework.CategoryType.MODE
        );
        
        // Sort alphabetically
        modeAlgorithms.sort((a, b) => a.name.localeCompare(b.name));
        
        modeAlgorithms.forEach(algorithm => {
            const option = document.createElement('option');
            option.value = algorithm.name;
            option.textContent = algorithm.name;
            modeSelect.appendChild(option);
        });
        
        console.log(`📋 Populated mode dropdown with ${modeAlgorithms.length} mode algorithms`);
    }
    
    /**
     * Populate padding schemes dropdown from PADDING category algorithms
     */
    populatePaddingDropdown() {
        const paddingSelect = document.getElementById('cipher-padding');
        if (!paddingSelect) return;
        
        // Get algorithms from PADDING category
        const algorithms = this.getAllAlgorithms();
        const paddingAlgorithms = algorithms.filter(algorithm => 
            algorithm.category === AlgorithmFramework.CategoryType.PADDING
        );
        
        // Sort alphabetically
        paddingAlgorithms.sort((a, b) => a.name.localeCompare(b.name));
        
        paddingAlgorithms.forEach(algorithm => {
            const option = document.createElement('option');
            option.value = algorithm.name;
            option.textContent = algorithm.name;
            paddingSelect.appendChild(option);
        });
        
        console.log(`📋 Populated padding dropdown with ${paddingAlgorithms.length} padding algorithms`);
    }
    
    /**
     * Populate testing categories dropdown for filtering
     */
    populateTestingCategoriesDropdown() {
        const testCategoryFilter = document.getElementById('test-filter-category');
        if (!testCategoryFilter) return;
        
        // Clear existing options except the first placeholder
        while (testCategoryFilter.children.length > 1) {
            testCategoryFilter.removeChild(testCategoryFilter.lastChild);
        }
        
        // Get unique categories from AlgorithmFramework
        const categories = Object.keys(AlgorithmFramework.CategoryType).sort();
        
        categories.forEach(categoryKey => {
            const categoryType = AlgorithmFramework.CategoryType[categoryKey];
            const option = document.createElement('option');
            option.value = categoryKey.toLowerCase();
            option.textContent = `${categoryType.icon} ${categoryType.name}`;
            testCategoryFilter.appendChild(option);
        });
        
        console.log(`📋 Populated testing category filter with ${categories.length} categories`);
    }

    populateAlgorithmDropdown() {
        const algorithmSelect = document.getElementById('selected-algorithm');
        if (!algorithmSelect) return;
        
        // Clear existing options except the first placeholder
        while (algorithmSelect.children.length > 1) {
            algorithmSelect.removeChild(algorithmSelect.lastChild);
        }
        
        // Get all algorithms and group by category
        const algorithms = this.getAllAlgorithms();
        const algorithmsByCategory = {};
        
        algorithms.forEach(algorithm => {
            let categoryLabel = '❓ Other';
            if (algorithm.category) {
                try {
                    const categoryName = this.getCategoryDisplayName(algorithm.category);
                    const categoryIcon = this.getCategoryIcon(algorithm.category);
                    categoryLabel = `${categoryIcon} ${categoryName}`;
                } catch (e) {
                    console.warn('Failed to get category display name:', e.message);
                    categoryLabel = '❓ Other';
                }
            }
            
            if (!algorithmsByCategory[categoryLabel]) {
                algorithmsByCategory[categoryLabel] = [];
            }
            algorithmsByCategory[categoryLabel].push(algorithm);
        });
        
        // Add algorithms to dropdown grouped by category
        // Sort by category name (without emoji) for better alphabetical ordering
        Object.keys(algorithmsByCategory).sort((a, b) => {
            // Extract category name without emoji (everything after the first space)
            const nameA = a.includes(' ') ? a.substring(a.indexOf(' ') + 1) : a;
            const nameB = b.includes(' ') ? b.substring(b.indexOf(' ') + 1) : b;
            return nameA.localeCompare(nameB);
        }).forEach(categoryLabel => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = categoryLabel;
            
            algorithmsByCategory[categoryLabel]
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(algorithm => {
                    const option = document.createElement('option');
                    option.value = algorithm.name;
                    option.textContent = algorithm.name;
                    optgroup.appendChild(option);
                });
            
            algorithmSelect.appendChild(optgroup);
        });
        
        console.log(`📋 Populated algorithm dropdown with ${algorithms.length} algorithms`);
    }
    
    /**
     * Setup format tab switching for input/output
     */
    setupFormatTabs() {
        // Input format tabs
        const inputFormatTabs = document.querySelectorAll('.input-section .format-tab');
        inputFormatTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                inputFormatTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
        
        // Output format tabs
        const outputFormatTabs = document.querySelectorAll('.output-section .format-tab');
        outputFormatTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                outputFormatTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }
    
    /**
     * Setup file upload functionality
     */
    setupFileUpload() {
        const fileUploadArea = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('file-input');
        const inputText = document.getElementById('input-text');
        
        if (!fileUploadArea || !fileInput || !inputText) return;
        
        // Click to browse
        fileUploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Drag and drop
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('drag-over');
        });
        
        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('drag-over');
        });
        
        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('drag-over');
            this.handleFileUpload(e.dataTransfer.files);
        });
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });
    }
    
    /**
     * Handle file upload and populate input textarea
     */
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        const file = files[0];
        const inputText = document.getElementById('input-text');
        
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            alert('File size exceeds 50MB limit');
            return;
        }
        
        try {
            const text = await file.text();
            inputText.value = text;
        } catch (error) {
            console.error('Error reading file:', error);
            alert('Error reading file');
        }
    }
    
    /**
     * Setup copy and download output actions
     */
    setupOutputActions() {
        const copyBtn = document.getElementById('copy-output');
        const downloadBtn = document.getElementById('download-output');
        
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyOutput());
        }
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadOutput());
        }
    }
    
    /**
     * Copy output to clipboard
     */
    async copyOutput() {
        const outputText = document.getElementById('output-text');
        if (!outputText.value) {
            alert('No output to copy');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(outputText.value);
            // Temporary feedback
            const copyBtn = document.getElementById('copy-output');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        } catch (error) {
            console.error('Copy failed:', error);
            // Fallback for older browsers
            outputText.select();
            document.execCommand('copy');
        }
    }
    
    /**
     * Download output as file
     */
    downloadOutput() {
        const outputText = document.getElementById('output-text');
        if (!outputText.value) {
            alert('No output to download');
            return;
        }
        
        const algorithm = document.getElementById('selected-algorithm').value || 'cipher';
        const outputFormat = document.querySelector('.output-section .format-tab.active').getAttribute('data-format');
        
        // Create blob and download
        const blob = new Blob([outputText.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${algorithm}_output.${outputFormat === 'hex' ? 'hex' : 'txt'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
    
    /**
     * Perform encryption operation
     */
    async performEncryption() {
        try {
            const result = await this.performCipherOperation('encrypt');
            this.displayCipherResult(result);
        } catch (error) {
            console.error('Encryption error:', error);
            alert('Encryption failed: ' + error.message);
        }
    }
    
    /**
     * Perform decryption operation
     */
    async performDecryption() {
        try {
            const result = await this.performCipherOperation('decrypt');
            this.displayCipherResult(result);
        } catch (error) {
            console.error('Decryption error:', error);
            alert('Decryption failed: ' + error.message);
        }
    }
    
    /**
     * Perform cipher operation (encrypt or decrypt)
     */
    async performCipherOperation(operation) {
        // Get input values
        const algorithmName = document.getElementById('selected-algorithm').value;
        const inputText = document.getElementById('input-text').value;
        const cipherKey = document.getElementById('cipher-key').value;
        
        if (!algorithmName) {
            throw new Error('Please select an algorithm');
        }
        
        if (!inputText) {
            throw new Error('Please enter text to ' + operation);
        }
        
        // Find algorithm
        const algorithm = AlgorithmFramework.Algorithms.find(a => a.name === algorithmName);
        if (!algorithm) {
            throw new Error('Algorithm not found: ' + algorithmName);
        }
        
        // Convert input based on current format
        const inputFormat = document.querySelector('.input-section .format-tab.active').getAttribute('data-format');
        let inputBytes;
        
        switch (inputFormat) {
            case 'text':
                inputBytes = Array.from(new TextEncoder().encode(inputText));
                break;
            case 'hex':
                inputBytes = this.hexToBytes(inputText);
                break;
            case 'base64':
                inputBytes = Array.from(atob(inputText)).map(c => c.charCodeAt(0));
                break;
            default:
                inputBytes = Array.from(new TextEncoder().encode(inputText));
        }
        
        // Create algorithm instance
        const instance = algorithm.CreateInstance(operation === 'decrypt');
        
        // Set key if provided and supported
        if (cipherKey && instance.key !== undefined) {
            const keyBytes = Array.from(new TextEncoder().encode(cipherKey));
            instance.key = keyBytes;
        }
        
        // Perform operation
        instance.Feed(inputBytes);
        const outputBytes = instance.Result();
        
        return {
            bytes: outputBytes,
            operation: operation,
            algorithm: algorithmName
        };
    }
    
    /**
     * Display cipher operation result
     */
    displayCipherResult(result) {
        const outputText = document.getElementById('output-text');
        const outputFormat = document.querySelector('.output-section .format-tab.active').getAttribute('data-format');
        
        let displayText;
        
        switch (outputFormat) {
            case 'text':
                displayText = new TextDecoder().decode(new Uint8Array(result.bytes));
                break;
            case 'hex':
                displayText = this.bytesToHex(result.bytes);
                break;
            case 'base64':
                displayText = btoa(String.fromCharCode(...result.bytes));
                break;
            default:
                displayText = new TextDecoder().decode(new Uint8Array(result.bytes));
        }
        
        outputText.value = displayText;
    }
    
    /**
     * Clear cipher interface
     */
    clearCipherInterface() {
        document.getElementById('input-text').value = '';
        document.getElementById('output-text').value = '';
        document.getElementById('selected-algorithm').value = '';
        document.getElementById('cipher-key').value = '';
    }
    
    /**
     * Convert hex string to byte array
     */
    hexToBytes(hex) {
        const result = [];
        for (let i = 0; i < hex.length; i += 2) {
            result.push(parseInt(hex.substr(i, 2), 16));
        }
        return result;
    }
    
    /**
     * Convert byte array to hex string
     */
    bytesToHex(bytes) {
        return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Populate algorithm palette for chaining
     */
    populateAlgorithmPalette() {
        const palette = document.getElementById('algorithm-palette');
        if (!palette) return;
        
        const algorithms = this.getAllAlgorithms();
        const algorithmsByCategory = {};
        
        // Group algorithms by category
        algorithms.forEach(algorithm => {
            const category = algorithm.category || 'Other';
            if (!algorithmsByCategory[category]) {
                algorithmsByCategory[category] = [];
            }
            algorithmsByCategory[category].push(algorithm);
        });
        
        // Clear existing content except header
        const existingHeader = palette.querySelector('h4');
        palette.innerHTML = '';
        if (existingHeader) {
            palette.appendChild(existingHeader);
        }
        
        // Create draggable algorithm items by category
        Object.keys(algorithmsByCategory).sort().forEach(category => {
            const categorySection = document.createElement('div');
            categorySection.className = 'palette-category';
            categorySection.setAttribute('data-category', category.toLowerCase());
            
            const categoryHeader = document.createElement('h5');
            categoryHeader.textContent = category;
            categoryHeader.className = 'palette-category-header';
            categorySection.appendChild(categoryHeader);
            
            const algorithmsContainer = document.createElement('div');
            algorithmsContainer.className = 'palette-algorithms';
            
            algorithmsByCategory[category]
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(algorithm => {
                    const algorithmEl = document.createElement('div');
                    algorithmEl.className = 'palette-algorithm';
                    algorithmEl.textContent = algorithm.name;
                    algorithmEl.setAttribute('data-algorithm', algorithm.name);
                    algorithmEl.setAttribute('data-category', algorithm.category);
                    algorithmEl.draggable = true;
                    
                    // Add drag functionality
                    algorithmEl.addEventListener('dragstart', (e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'algorithm',
                            algorithm: algorithm.name,
                            category: algorithm.category
                        }));
                    });
                    
                    algorithmsContainer.appendChild(algorithmEl);
                });
            
            categorySection.appendChild(algorithmsContainer);
            palette.appendChild(categorySection);
        });
        
        console.log('📋 Populated algorithm palette with', algorithms.length, 'algorithms');
    }
    
    /**
     * Setup drag and drop functionality for chaining
     */
    setupDragAndDrop() {
        const canvas = document.getElementById('chain-canvas');
        if (!canvas) return;
        
        // Counter for generating unique node IDs
        this.nodeCounter = 0;
        
        // Allow dropping on canvas
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            canvas.classList.add('drag-over');
        });
        
        canvas.addEventListener('dragleave', (e) => {
            // Only remove if we're leaving the canvas entirely
            if (!canvas.contains(e.relatedTarget)) {
                canvas.classList.remove('drag-over');
            }
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('drag-over');
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (data.type === 'algorithm') {
                    this.createNodeOnCanvas(data, e.offsetX, e.offsetY);
                }
            } catch (error) {
                console.error('Drop data parsing error:', error);
            }
        });
        
        console.log('✅ Drag and drop setup complete');
    }
    
    /**
     * Create a new algorithm node on the canvas
     */
    createNodeOnCanvas(algorithmData, x, y) {
        if (!this.chainBuilder) return;
        
        this.nodeCounter++;
        const nodeId = `node_${this.nodeCounter}`;
        
        // Find the algorithm object
        const algorithms = this.getAllAlgorithms();
        const algorithm = algorithms.find(a => a.name === algorithmData.algorithm);
        
        if (!algorithm) {
            console.error('Algorithm not found:', algorithmData.algorithm);
            return;
        }
        
        // Create node data
        const nodeData = {
            id: nodeId,
            type: 'algorithm',
            title: algorithm.name,
            algorithm: algorithm,
            x: x,
            y: y,
            inputs: ['input'],
            outputs: ['output'],
            parameters: this.getAlgorithmParameters(algorithm)
        };
        
        // Add to chain builder
        this.chainBuilder.addNode(nodeId, nodeData);
        
        // Create visual representation on canvas
        this.renderNodeOnCanvas(nodeData);
        
        // Update statistics
        this.updateChainStats();
        
        console.log('Created node:', nodeId, nodeData);
    }
    
    /**
     * Render a visual node on the canvas
     */
    renderNodeOnCanvas(nodeData) {
        const canvas = document.getElementById('chain-canvas');
        if (!canvas) return;
        
        // Create node element
        const nodeEl = document.createElement('div');
        nodeEl.className = 'chain-node';
        nodeEl.setAttribute('data-node-id', nodeData.id);
        nodeEl.style.position = 'absolute';
        nodeEl.style.left = nodeData.x + 'px';
        nodeEl.style.top = nodeData.y + 'px';
        
        // Node structure
        nodeEl.innerHTML = `
            <div class="node-header">
                <span class="node-title">${nodeData.title}</span>
                <button class="node-remove" onclick="window.cipherController.removeNode('${nodeData.id}')">&times;</button>
            </div>
            <div class="node-body">
                <div class="node-inputs">
                    ${nodeData.inputs.map((input, index) => 
                        `<div class="node-port input-port" data-port="${index}" data-type="input">${input}</div>`
                    ).join('')}
                </div>
                <div class="node-outputs">
                    ${nodeData.outputs.map((output, index) => 
                        `<div class="node-port output-port" data-port="${index}" data-type="output">${output}</div>`
                    ).join('')}
                </div>
            </div>
        `;
        
        // Make the node draggable on the canvas
        this.makeNodeDraggable(nodeEl);
        
        // Add click handlers for connecting nodes
        this.setupNodeConnections(nodeEl);
        
        canvas.appendChild(nodeEl);
    }
    
    /**
     * Make a node draggable on the canvas
     */
    makeNodeDraggable(nodeEl) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        const header = nodeEl.querySelector('.node-header');
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = nodeEl.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            nodeEl.classList.add('dragging');
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const canvas = document.getElementById('chain-canvas');
            const canvasRect = canvas.getBoundingClientRect();
            
            const x = e.clientX - canvasRect.left - dragOffset.x;
            const y = e.clientY - canvasRect.top - dragOffset.y;
            
            nodeEl.style.left = Math.max(0, Math.min(x, canvas.offsetWidth - nodeEl.offsetWidth)) + 'px';
            nodeEl.style.top = Math.max(0, Math.min(y, canvas.offsetHeight - nodeEl.offsetHeight)) + 'px';
            
            // Update node data
            const nodeId = nodeEl.getAttribute('data-node-id');
            if (this.chainBuilder.nodes.has(nodeId)) {
                const nodeData = this.chainBuilder.nodes.get(nodeId);
                nodeData.x = parseFloat(nodeEl.style.left);
                nodeData.y = parseFloat(nodeEl.style.top);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                nodeEl.classList.remove('dragging');
            }
        });
    }
    
    /**
     * Setup node connection functionality
     */
    setupNodeConnections(nodeEl) {
        const ports = nodeEl.querySelectorAll('.node-port');
        
        ports.forEach(port => {
            port.addEventListener('click', (e) => {
                this.handlePortClick(port, nodeEl);
                e.stopPropagation();
            });
        });
    }
    
    /**
     * Handle clicking on node ports for connections
     */
    handlePortClick(port, nodeEl) {
        const nodeId = nodeEl.getAttribute('data-node-id');
        const portType = port.getAttribute('data-type');
        const portIndex = parseInt(port.getAttribute('data-port'));
        
        if (!this.connectionState) {
            // Start a new connection
            this.connectionState = {
                fromNode: nodeId,
                fromPort: portIndex,
                fromType: portType,
                element: port
            };
            port.classList.add('connecting');
            console.log('Started connection from:', nodeId, portType, portIndex);
        } else {
            // Complete the connection
            const toNode = nodeId;
            const toPort = portIndex;
            const toType = portType;
            
            // Validate connection (output to input only)
            if (this.connectionState.fromType === 'output' && toType === 'input') {
                this.createConnection(
                    this.connectionState.fromNode,
                    this.connectionState.fromPort,
                    toNode,
                    toPort
                );
            } else if (this.connectionState.fromType === 'input' && toType === 'output') {
                this.createConnection(
                    toNode,
                    toPort,
                    this.connectionState.fromNode,
                    this.connectionState.fromPort
                );
            } else {
                alert('Invalid connection. Connect output ports to input ports.');
            }
            
            // Clear connection state
            this.connectionState.element.classList.remove('connecting');
            this.connectionState = null;
        }
    }
    
    /**
     * Create a connection between two nodes
     */
    createConnection(fromNode, fromPort, toNode, toPort) {
        if (!this.chainBuilder) return;
        
        const connectionId = `conn_${fromNode}_${toNode}_${fromPort}_${toPort}`;
        
        const connectionData = {
            from: fromNode,
            fromPort: fromPort,
            to: toNode,
            toPort: toPort
        };
        
        this.chainBuilder.addConnection(connectionId, connectionData);
        
        // Draw connection line
        this.drawConnection(connectionData);
        
        // Update statistics
        this.updateChainStats();
        
        console.log('Created connection:', connectionId, connectionData);
    }
    
    /**
     * Draw a visual connection line between nodes
     */
    drawConnection(connectionData) {
        // This would typically use SVG or Canvas for drawing lines
        // For now, we'll log that the connection was made
        console.log('Drawing connection line between:', connectionData.from, 'and', connectionData.to);
        
        // In a full implementation, we would:
        // 1. Get the positions of the from and to ports
        // 2. Draw an SVG line or use Canvas to connect them
        // 3. Store the connection visually for later updates
    }
    
    /**
     * Remove a node from the chain
     */
    removeNode(nodeId) {
        if (!this.chainBuilder) return;
        
        // Remove from chain builder
        this.chainBuilder.nodes.delete(nodeId);
        
        // Remove visual element
        const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeEl) {
            nodeEl.remove();
        }
        
        // Remove associated connections
        for (const [connId, conn] of this.chainBuilder.connections) {
            if (conn.from === nodeId || conn.to === nodeId) {
                this.chainBuilder.connections.delete(connId);
            }
        }
        
        // Update statistics
        this.updateChainStats();
        
        console.log('Removed node:', nodeId);
    }
    
    /**
     * Update chain statistics display
     */
    updateChainStats() {
        const statsEl = document.getElementById('chain-stats');
        const expressionEl = document.getElementById('expression-display');
        
        if (!statsEl || !expressionEl || !this.chainBuilder) return;
        
        const nodeCount = this.chainBuilder.nodes.size;
        const connectionCount = this.chainBuilder.connections.size;
        
        statsEl.innerHTML = `
            <strong>Chain Stats:</strong><br>
            Nodes: ${nodeCount}<br>
            Connections: ${connectionCount}
        `;
        
        try {
            const expression = this.buildChainExpression();
            expressionEl.innerHTML = `
                <strong>Expression:</strong><br>
                <code style="font-size: 11px; word-break: break-all;">${expression}</code>
            `;
        } catch (error) {
            expressionEl.innerHTML = `
                <strong>Expression:</strong><br>
                <span style="color: #dc3545;">Error: ${error.message}</span>
            `;
        }
    }
    
    /**
     * Clear the canvas and reset chain
     */
    clearCanvas() {
        const canvas = document.getElementById('chain-canvas');
        if (canvas) {
            const nodes = canvas.querySelectorAll('.chain-node');
            nodes.forEach(node => node.remove());
        }
        
        if (this.chainBuilder) {
            this.chainBuilder.nodes.clear();
            this.chainBuilder.connections.clear();
            // Re-add default nodes
            this.createMinimalChainBuilder();
        }
        
        this.updateChainStats();
        console.log('✅ Canvas cleared');
    }
    
    /**
     * Add test nodes for demonstration
     */
    addTestNodes() {
        if (!this.chainBuilder) return;
        
        // Add AES node
        const aesData = {
            type: 'algorithm',
            algorithm: 'Rijndael (AES)',
            category: 'cipher'
        };
        this.createNodeOnCanvas(aesData, 200, 150);
        
        // Add SHA-256 node
        const shaData = {
            type: 'algorithm',
            algorithm: 'SHA-256',
            category: 'hash'
        };
        this.createNodeOnCanvas(shaData, 400, 150);
        
        this.updateChainStats();
        console.log('✅ Test nodes added');
    }
    
    /**
     * Get algorithm parameters for node setup
     */
    getAlgorithmParameters(algorithm) {
        // Basic parameter detection - could be enhanced
        const parameters = [];
        
        // Most block ciphers need a key
        if (algorithm.category === 'cipher' && algorithm.subCategory?.includes('Block')) {
            parameters.push('key');
        }
        
        // Stream ciphers often need a key and nonce/IV
        if (algorithm.category === 'cipher' && algorithm.subCategory?.includes('Stream')) {
            parameters.push('key', 'nonce');
        }
        
        // Hash functions typically don't need parameters
        if (algorithm.category === 'hash') {
            // No parameters needed
        }
        
        return parameters;
    }
    
    /**
     * Setup algorithm palette tabs
     */
    setupAlgorithmTabs() {
        const tabs = document.querySelectorAll('.palette-tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.getAttribute('data-category');
                this.switchAlgorithmCategory(category);
                
                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });
        
        console.log('✅ Algorithm palette tabs setup complete');
    }
    
    /**
     * Switch to a specific algorithm category
     */
    switchAlgorithmCategory(category) {
        const palette = document.getElementById('algorithm-palette');
        if (!palette) return;
        
        const categories = palette.querySelectorAll('.palette-category');
        
        categories.forEach(categoryEl => {
            const categoryData = categoryEl.getAttribute('data-category');
            
            if (category === 'all' || categoryData === category) {
                categoryEl.style.display = 'block';
            } else {
                categoryEl.style.display = 'none';
            }
        });
        
        console.log('Switched to algorithm category:', category);
    }
    
    /**
     * Execute the current algorithm chain
     */
    executeChain() {
        console.log('🚀 Executing algorithm chain...');
        
        if (!this.chainBuilder) {
            alert('Chain builder not initialized');
            return;
        }
        
        try {
            // Get chain expression
            const chainExpression = this.buildChainExpression();
            console.log('Chain expression:', chainExpression);
            
            // Display chain expression
            this.displayChainExpression(chainExpression);
            
            // Execute if we have valid chain
            if (chainExpression && chainExpression !== 'data') {
                const result = this.executeChainExpression(chainExpression);
                console.log('Chain execution result:', result);
            }
            
        } catch (error) {
            console.error('Chain execution error:', error);
            alert('Chain execution failed: ' + error.message);
        }
    }
    
    /**
     * Build chain expression from current nodes
     */
    buildChainExpression() {
        if (!this.chainBuilder || !this.chainBuilder.nodes.size) {
            return 'data';
        }
        
        // Find output node and work backwards
        let outputNode = null;
        for (const [id, node] of this.chainBuilder.nodes) {
            if (node.type === 'output') {
                outputNode = node;
                break;
            }
        }
        
        if (!outputNode) {
            return 'data';
        }
        
        // Build expression by following connections backwards from output
        return this.buildNodeExpressionBackwards(outputNode, new Set());
    }
    
    /**
     * Build expression working backwards from output node
     */
    buildNodeExpressionBackwards(node, visited) {
        if (visited.has(node.id)) {
            return 'data'; // Avoid infinite loops
        }
        visited.add(node.id);
        
        // Base case: input node
        if (node.type === 'input') {
            return 'data';
        }
        
        // Find what feeds into this node
        const inputExpressions = [];
        
        // Get all connections that feed into this node
        for (const [connId, connection] of this.chainBuilder.connections) {
            if (connection.to === node.id) {
                const fromNode = this.chainBuilder.nodes.get(connection.from);
                if (fromNode) {
                    const inputExpr = this.buildNodeExpressionBackwards(fromNode, visited);
                    inputExpressions.push(inputExpr);
                }
            }
        }
        
        // Build expression for this node
        const input = inputExpressions.length > 0 ? inputExpressions[0] : 'data';
        
        // For output node, just return the input
        if (node.type === 'output') {
            return input;
        }
        
        // For algorithm nodes
        if (node.algorithm) {
            return `${node.algorithm.name}(${input})`;
        }
        
        // For other node types (padding, mode, etc.)
        const nodeTypeName = node.title || node.type.toUpperCase();
        return `${nodeTypeName}(${input})`;
    }
    
    /**
     * Display the chain expression
     */
    displayChainExpression(expression) {
        // Find a place to display the expression - could be in properties panel or a dedicated area
        const propertiesPanel = document.getElementById('properties-panel');
        if (propertiesPanel) {
            const expressionDiv = document.createElement('div');
            expressionDiv.className = 'chain-expression';
            expressionDiv.innerHTML = `
                <h4>Chain Expression</h4>
                <div class="expression-formula" style="font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 10px 0;">
                    ${expression}
                </div>
            `;
            
            // Remove existing expression if any
            const existing = propertiesPanel.querySelector('.chain-expression');
            if (existing) {
                existing.remove();
            }
            
            propertiesPanel.appendChild(expressionDiv);
        }
    }
    
    /**
     * Execute the chain expression (simplified version)
     */
    executeChainExpression(expression) {
        // This is a simplified execution - in a full implementation,
        // we'd parse the expression and execute the actual algorithms
        console.log('Executing chain:', expression);
        
        // For now, just return the expression as a demonstration
        return {
            expression: expression,
            status: 'simulated',
            result: 'Chain execution would run here'
        };
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
