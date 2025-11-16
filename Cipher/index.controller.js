/**
 * Main Controller for Cipher Tools Application
 * Manages application state, tab navigation, and core functionality
 * (c)2006-2025 Hawkynt
 */

class CipherController {
    constructor() {
        // Only use AlgorithmFramework - no local storage
        this.testResults = null;

        this.isParallelTestingEnabled = true;
        this.workerCount = Math.max(2, (navigator.hardwareConcurrency || 4) - 1); // Optimal default
        this.isTesting = false;
        this.cancelled = false;

        // Testing tab filter state
        this.currentTestFilter = 'all'; // all, passed, partial, failed, skipped

        // Don't auto-initialize - wait for manual call
    }
    
    async initializeApplication() {
        DebugConfig.log('🔐 Initializing Cipher Tools Application...');

        // Verify AlgorithmFramework is available
        if (typeof AlgorithmFramework === 'undefined') {
            DebugConfig.error('❌ AlgorithmFramework not available');
            return;
        }

        DebugConfig.log('✅ AlgorithmFramework available');
        DebugConfig.log('📊 Algorithms registered:', AlgorithmFramework.Algorithms.length);

        // Verify TestEngine is available
        if (typeof TestEngine === 'undefined') {
            DebugConfig.error('❌ TestEngine not available');
            alert('Testing framework failed to load. Please ensure tests/TestEngine.js is loaded.');
            return;
        }
        DebugConfig.log('✅ TestEngine available');

        // Setup UI systems
        this.setupEventListeners();
        this.setupTabNavigation();

        this.setupAlgorithmsInterface();
        this.setupCipherInterface();
        this.setupChainingInterface();
        this.setupTestingInterface();

        this.updateStats();
        this.updateTestingTabResults();

        DebugConfig.log('✅ Application initialized successfully');

        // Wait for all algorithms to register, then auto-run tests
        this.waitForAlgorithmsAndAutoTest();
    }
    
    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        const searchClearBtn = document.getElementById('search-clear-btn');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterAlgorithms(e.target.value);
                // Show/hide clear button
                if (searchClearBtn) {
                    searchClearBtn.style.display = e.target.value ? 'flex' : 'none';
                }
            });
        }

        // Clear button functionality
        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    searchClearBtn.style.display = 'none';
                    // Re-apply filters with empty search (will respect category)
                    this.filterAlgorithms('');
                }
            });
        }

        // Category filter
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                // Apply both category and current search term
                const searchTerm = searchInput ? searchInput.value : '';
                this.filterAlgorithms(searchTerm);
            });
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
     * Wait for all algorithms to finish registering, then auto-test
     */
    async waitForAlgorithmsAndAutoTest() {
        DebugConfig.log('⏳ Waiting for all algorithms to register...');

        let previousCount = 0;
        let stableCount = 0;
        const maxWaitTime = 5000; // Maximum 5 seconds
        const checkInterval = 100; // Check every 100ms
        const requiredStableChecks = 3; // Must be stable for 3 checks
        const startTime = Date.now();

        // Poll until algorithm count stabilizes
        while (Date.now() - startTime < maxWaitTime) {
            const currentCount = this.getAllAlgorithms().length;

            if (currentCount === previousCount) {
                stableCount++;
                if (stableCount >= requiredStableChecks) {
                    // Count has been stable for required checks
                    break;
                }
            } else {
                // Count changed, reset stability counter
                stableCount = 0;
                previousCount = currentCount;
            }

            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        const finalCount = this.getAllAlgorithms().length;
        const waitTime = Date.now() - startTime;

        DebugConfig.log('✅ Algorithm registration complete');
        DebugConfig.log(`📊 Total algorithms registered: ${finalCount}`);
        DebugConfig.log(`⏱️ Wait time: ${waitTime}ms`);
        DebugConfig.log('📋 Algorithm names:', this.getAllAlgorithms().map(a => a.name).slice(0, 10).join(', ') + '...');

        // Additional small delay for UI rendering
        await new Promise(resolve => setTimeout(resolve, 100));

        // Now run tests
        DebugConfig.log('🚀 Starting auto-test with all algorithms loaded');
        this.runAllTestsManually();
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
     * Auto-run tests for all algorithms using TestEngine
     */
    async autoRunAllTests() {
        DebugConfig.log('🧪 Starting sequential test for all algorithms using TestEngine...');

        if (typeof TestEngine === 'undefined') {
            throw new Error('TestEngine not available');
        }

        const allAlgorithms = this.getAllAlgorithms();
        const algorithms = allAlgorithms.filter(alg => alg.tests && alg.tests.length > 0);
        DebugConfig.log(`📊 Total algorithms in registry: ${allAlgorithms.length}`);
        DebugConfig.log(`📊 Algorithms with test vectors: ${algorithms.length}`);
        DebugConfig.log(`📊 Algorithms without test vectors: ${allAlgorithms.length - algorithms.length}`);

        // Show global testing indicator
        this.updateGlobalTestingProgress(0, algorithms.length, 'Starting tests...');

        // Process algorithms one by one
        for (let i = 0; i < algorithms.length; i++) {
            // Check if testing was stopped
            if (!this.isTesting) {
                DebugConfig.log('⏹️ Testing stopped by user');
                break;
            }

            const algorithm = algorithms[i];

            try {
                // Update global progress BEFORE starting test
                this.updateGlobalTestingProgress(i, algorithms.length, `Testing ${algorithm.name}...`);

                // Update card to show testing state (hourglass)
                this.updateCardTestingState(algorithm.name, true);

                // Give visual time to see hourglass
                await new Promise(resolve => setTimeout(resolve, 300));

                const result = await TestEngine.TestAlgorithm(algorithm);

                // Store test results
                algorithm.testResults = {
                    passed: result.passed,
                    total: result.total,
                    percentage: result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0,
                    lastUpdated: Date.now(),
                    autoRun: true,
                    success: result.passed === result.total,
                    errors: result.errors
                };

                // Update card to show results
                this.updateCardTestingState(algorithm.name, false);

                // Update testing tab with results
                this.updateTestingTabResults();

                // Update header stats with live pass count
                this.updateStats();

                // Update progress AFTER completing test
                this.updateGlobalTestingProgress(i + 1, algorithms.length, `Completed ${algorithm.name}`);

                // Small delay between algorithms
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                DebugConfig.error(`❌ Auto-test failed for ${algorithm.name}:`, error);

                // Store failed result
                algorithm.testResults = {
                    passed: 0,
                    total: algorithm.tests?.length || 0,
                    lastUpdated: Date.now(),
                    autoRun: true,
                    error: error.message
                };

                // Update card to show failure
                this.updateCardTestingState(algorithm.name, false);

                // Update progress even on failure
                this.updateGlobalTestingProgress(i + 1, algorithms.length, `Failed ${algorithm.name}`);
            }
        }

        // Complete global testing
        this.updateGlobalTestingProgress(algorithms.length, algorithms.length, `Completed testing ${algorithms.length} algorithms`);

        // Final update to testing tab
        this.updateTestingTabResults();

        // Generate failure report for bug reporting
        this.generateFailureReport(algorithms);

        DebugConfig.log('✅ Auto-test completed for all algorithms');
    }

    /**
     * Generate comprehensive failure report for bug reporting
     * ALWAYS outputs to console (not gated by debug mode) for error reporting
     */
    generateFailureReport(algorithms) {
        const failedAlgorithms = algorithms.filter(alg =>
            alg.testResults && !alg.testResults.success
        );

        if (failedAlgorithms.length === 0) {
            DebugConfig.always('\n✅ ALL TESTS PASSED - No failures to report!');
            return;
        }

        // Accumulate entire report as a single string to avoid console clobbering
        let report = [];
        report.push('\n' + '='.repeat(80));
        report.push('❌ FAILURE REPORT - Copy this for bug reporting');
        report.push('='.repeat(80));
        report.push(`\nTotal Failed: ${failedAlgorithms.length}/${algorithms.length} algorithms\n`);

        failedAlgorithms.forEach((alg, index) => {
            const { passed, total, errors, error, status } = alg.testResults;

            report.push(`${index + 1}. ${alg.name}`);
            report.push(`   Category: ${alg.category?.name || 'Unknown'}`);
            report.push(`   Passed: ${passed}/${total} vectors`);

            if (status) {
                report.push(`   Status: ${status}`);
            }

            if (error) {
                report.push(`   Error: ${error}`);
            }

            if (errors && errors.length > 0) {
                report.push(`   Failures:`);
                errors.forEach((err, errIdx) => {
                    if (typeof err === 'string') {
                        report.push(`     - ${err}`);
                    } else if (err.vector !== undefined) {
                        report.push(`     - Vector ${err.vector}: ${err.text || 'Unnamed'}`);
                        if (err.error) {
                            report.push(`       ${err.error}`);
                        }
                    } else if (err.type) {
                        report.push(`     - ${err.type}: ${err.message}`);
                    } else {
                        report.push(`     - ${JSON.stringify(err)}`);
                    }
                });
            }

            report.push('');
        });

        report.push('='.repeat(80));

        // Output entire report in a single console call to avoid clobbering
        DebugConfig.always(report.join('\n'));
    }

    async runParallelTests() {
        DebugConfig.log('🚀 Starting parallel algorithm testing...');

        if (typeof TestEngine === 'undefined') {
            throw new Error('TestEngine not available');
        }

        // Get algorithms to test
        const allAlgorithms = this.getAllAlgorithms();
        const algorithms = allAlgorithms.filter(alg => alg.tests && alg.tests.length > 0);
        DebugConfig.log(`📊 Testing ${algorithms.length} algorithms with ${this.workerCount} parallel tasks`);

        if (algorithms.length === 0) {
            DebugConfig.log('⚠️ No algorithms with test vectors found');
            return;
        }

        // Clear old results
        DebugConfig.log('🧹 Clearing previous test results...');
        algorithms.forEach(alg => delete alg.testResults);
        this.updateTestingTabResults();

        // Create shared queue
        const queue = [...algorithms];
        let completedCount = 0;
        const totalCount = algorithms.length;
        const startTime = Date.now();
        this.cancelled = false;

        // Simple async worker that pulls from queue
        const worker = async (workerId) => {
            while (queue.length > 0 && !this.cancelled) {
                const algorithm = queue.shift();
                if (!algorithm) break;

                try {
                    DebugConfig.log(`📤 Worker ${workerId} testing: ${algorithm.name}`);

                    // Update card to show testing in progress (hourglass)
                    this.updateCardTestingState(algorithm.name, true);

                    // Test using TestEngine.TestAlgorithm (same as sequential)
                    const result = await TestEngine.TestAlgorithm(algorithm);

                    // Store results
                    algorithm.testResults = {
                        passed: result.passed,
                        total: result.total,
                        percentage: result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0,
                        lastUpdated: Date.now(),
                        success: result.passed === result.total,
                        errors: result.errors
                    };

                    // Update card to show results
                    this.updateCardTestingState(algorithm.name, false);

                    // Update progress
                    completedCount++;
                    const progress = ((completedCount / totalCount) * 100).toFixed(1);
                    DebugConfig.log(`📥 ✅ ${algorithm.name} completed [${progress}%] - ${algorithm.testResults.success ? 'PASSED' : 'FAILED'}`);

                    // Update UI in real-time
                    this.updateTestingTabResults();
                    this.updateGlobalTestingProgress(completedCount, totalCount,
                        `Parallel testing: ${completedCount}/${totalCount} algorithms (${progress}%)`);

                } catch (error) {
                    DebugConfig.error(`❌ Worker ${workerId} failed on ${algorithm.name}:`, error);
                    algorithm.testResults = {
                        passed: 0,
                        total: algorithm.tests?.length || 0,
                        percentage: 0,
                        lastUpdated: Date.now(),
                        success: false,
                        error: error.message
                    };

                    // Update card to show failure
                    this.updateCardTestingState(algorithm.name, false);

                    completedCount++;
                }

                // CRITICAL: Yield to event loop to keep UI responsive
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            DebugConfig.log(`✅ Worker ${workerId} finished`);
        };

        // Spawn multiple async workers
        const workers = [];
        for (let i = 0; i < this.workerCount; i++) {
            workers.push(worker(i));
        }

        // Wait for all to complete
        await Promise.all(workers);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const passedCount = algorithms.filter(alg => alg.testResults?.success).length;
        const failedCount = algorithms.length - passedCount;

        DebugConfig.log(`\n🎯 Parallel testing completed in ${duration}s`);
        DebugConfig.log(`  ✅ Passed: ${passedCount}/${algorithms.length}`);
        DebugConfig.log(`  ❌ Failed: ${failedCount}/${algorithms.length}`);
        DebugConfig.log(`  📊 Success Rate: ${((passedCount / algorithms.length) * 100).toFixed(1)}%`);

        // Generate failure report
        this.generateFailureReport(algorithms);

        // Final UI update
        this.updateTestingTabResults();
        this.updateGlobalTestingProgress(totalCount, totalCount, `Completed testing ${totalCount} algorithms`);
    }

    /**
     * Update parallel testing progress UI
     */
    updateParallelProgressUI(progress) {
        // Update progress bar
        const progressFill = document.getElementById('parallel-progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progress.percentage}%`;
        }

        // Update stats
        const elements = {
            'parallel-completed': progress.completed,
            'parallel-total': progress.total,
            'parallel-percentage': Math.round(progress.percentage),
            'parallel-workers-active': progress.workersActive,
            'parallel-throughput': progress.throughput.toFixed(1),
            'parallel-eta': progress.eta > 0 ? this.formatDuration(progress.eta) : '--:--'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    /**
     * Process individual generic parallel test result
     */
    processGenericParallelResult(result) {
        // Find corresponding algorithm and update its test results
        const algorithms = this.getAllAlgorithms();
        const algorithm = algorithms.find(alg => alg.name === result.algorithmName);

        if (algorithm) {
            // Convert parallel result to format expected by UI (same as sequential)
            algorithm.testResults = {
                passed: result.vectorsPassed || 0,
                total: result.vectorsTotal || 0,
                percentage: result.vectorsTotal > 0 ? Math.round((result.vectorsPassed / result.vectorsTotal) * 100) : 0,
                lastUpdated: Date.now(),
                autoRun: true,
                parallelResult: result,
                success: result.success,
                error: result.error || null
            };

            // Update card state
            this.updateCardTestingState(algorithm.name, false);

            // CRITICAL: Update testing tab IMMEDIATELY for real-time results
            this.updateTestingTabResults();

            // Update header stats with live pass count
            this.updateStats();

            DebugConfig.log(`✅ Processed parallel result for ${result.algorithmName}: ${result.success ? 'PASSED' : 'FAILED'}${result.error ? ' - ' + result.error : ''}`);
        }
    }

    /**
     * Process all generic parallel test results
     */
    processAllGenericParallelResults(results, algorithms) {
        const summary = {
            passed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            total: results.length
        };

        DebugConfig.log('🎯 Parallel Test Summary:');
        DebugConfig.log(`  ✅ Passed: ${summary.passed}/${summary.total}`);
        DebugConfig.log(`  ❌ Failed: ${summary.failed}/${summary.total}`);
        DebugConfig.log(`  📊 Success Rate: ${((summary.passed / summary.total) * 100).toFixed(1)}%`);
        DebugConfig.log(`  ⚡ Parallel Speedup: ~${this.workerCount}x faster than sequential`);
    }

    /**
     * Update test button states during testing
     */
    updateTestButtonStates(isTesting) {
        const buttons = {
            'run-all-tests': !isTesting,
            'run-selected-tests': !isTesting,
            'stop-testing': isTesting
        };

        Object.entries(buttons).forEach(([id, enabled]) => {
            const button = document.getElementById(id);
            if (button) {
                button.disabled = !enabled;
            }
        });
    }

    /**
     * Format duration in seconds to MM:SS
     */
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    

    /**
     * Run tests for a single algorithm using TestEngine
     */
    async runAlgorithmTests(algorithm) {
        if (typeof TestEngine === 'undefined') {
            throw new Error('TestEngine not available');
        }

        if (!algorithm.tests || algorithm.tests.length === 0) {
            return;
        }

        try {
            const result = await TestEngine.TestAlgorithm(algorithm);

            // Store test results
            algorithm.testResults = {
                passed: result.passed,
                total: result.total,
                percentage: result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0,
                lastUpdated: Date.now(),
                autoRun: true,
                success: result.passed === result.total,
                errors: result.errors
            };

            // Update the card UI
            this.updateCardTestingState(algorithm.name, false);

        } catch (error) {
            DebugConfig.error(`Test failed for ${algorithm.name}:`, error);

            // Store failed result
            algorithm.testResults = {
                passed: 0,
                total: algorithm.tests?.length || 0,
                lastUpdated: Date.now(),
                autoRun: true,
                error: error.message
            };

            // Update card to show failure
            this.updateCardTestingState(algorithm.name, false);
            throw error;
        }
    }

    
    
    /**
     * Update algorithm card testing state using TestAPI results
     */
    updateCardTestingState(algorithmName, isTesting) {
        const algorithmCard = document.querySelector(`[data-name="${algorithmName}"]`);
        if (!algorithmCard) {
            DebugConfig.warn(`⚠️ Card not found for algorithm: ${algorithmName}`);
            return;
        }

        const testButton = algorithmCard.querySelector('.card-test-btn');
        if (!testButton) {
            DebugConfig.warn(`⚠️ Test button not found for algorithm: ${algorithmName}`);
            return;
        }

        if (isTesting) {
            // Store original content and show hourglass
            const originalText = testButton.innerHTML;
            DebugConfig.log(`⏳ Starting test for ${algorithmName}, original text: "${originalText}"`);
            testButton.setAttribute('data-original-text', originalText);
            // Replace the test tube emoji with hourglass
            const updatedText = originalText.replace('🧪', '⏳');
            DebugConfig.log(`⏳ Updated text: "${updatedText}"`);
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

            // Update status based on test results
            const algorithm = this.getAlgorithm(algorithmName);
            if (algorithm && algorithm.testResults) {
                const { passed, total, percentage, error, errors, success } = algorithm.testResults;
                let status = 'untested';

                // Use success flag if available, otherwise fall back to percentage
                const testPassed = success !== undefined ? success : (percentage === 100);

                if (total === 0) {
                    status = 'untested';
                } else if (testPassed && percentage === 100) {
                    status = 'all';
                } else if (passed > 0) {
                    status = 'some';
                } else {
                    status = 'none';
                }

                // Remove old status classes
                testButton.classList.remove('test-status-none', 'test-status-some', 'test-status-all', 'test-status-untested');

                // Add new status class
                testButton.classList.add(`test-status-${status}`);
                testButton.setAttribute('data-test-status', status);

                // Update button text with test results
                let testText = `🧪 ${passed}/${total}`;

                // Only show error if test actually failed
                if (error && !testPassed) {
                    testText = `❌ Error`;
                } else if (!testPassed && errors && errors.length > 0) {
                    testText = `❌ ${errors.length} errors`;
                }

                testButton.innerHTML = testText;
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

        // Convert CategoryType object to string key for filtering
        const categoryKey = this.getCategoryString(algorithm.category);
        card.setAttribute('data-category', categoryKey);
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
     * Category should always be a CategoryType object from AlgorithmFramework
     * This method is mainly for validation and fallback handling
     */
    getCategoryType(category) {
        if (!category) return null;

        // Category should already be a CategoryType object
        if (typeof category === 'object' && category.name) {
            // Validate it's actually in AlgorithmFramework.CategoryType
            const isValid = Object.keys(AlgorithmFramework.CategoryType).some(
                key => AlgorithmFramework.CategoryType[key] === category
            );
            if (isValid) {
                return category;
            }
            DebugConfig.warn('getCategoryType received an invalid CategoryType object:', category);
            return null;
        }

        // String input is a bug - warn about it
        if (typeof category === 'string') {
            DebugConfig.warn('getCategoryType received a string instead of CategoryType object:', category);
            const categoryKey = category.toUpperCase();
            return AlgorithmFramework.CategoryType[categoryKey] || null;
        }

        DebugConfig.warn('getCategoryType received unexpected input:', category);
        return null;
    }

    /**
     * Get category string key from CategoryType object
     * Returns lowercase category key for use in filtering (e.g., "hash", "special")
     * Category must always be a CategoryType object from AlgorithmFramework
     */
    getCategoryString(category) {
        if (!category) return null;

        // Category should always be a CategoryType object from AlgorithmFramework
        if (typeof category === 'string') {
            DebugConfig.warn('getCategoryString received a string instead of CategoryType object:', category);
            return category.toLowerCase();
        }

        // Find the CategoryType key for this category object
        const categoryKey = Object.keys(AlgorithmFramework.CategoryType).find(
            key => AlgorithmFramework.CategoryType[key] === category
        );

        if (!categoryKey) {
            DebugConfig.warn('getCategoryString could not find CategoryType key for:', category);
            return null;
        }

        return categoryKey.toLowerCase();
    }

    filterAlgorithms(searchTerm) {
        const cards = document.querySelectorAll('.algorithm-card');
        const sections = document.querySelectorAll('.palette-section');
        const categoryFilter = document.getElementById('category-filter');
        const selectedCategory = categoryFilter ? categoryFilter.value : '';

        cards.forEach(card => {
            const name = card.getAttribute('data-name').toLowerCase();
            const cardCategory = card.getAttribute('data-category');

            // Check if name matches search term
            const nameMatches = name.includes(searchTerm.toLowerCase());

            // Check if category matches (if category filter is active)
            const categoryMatches = !selectedCategory || cardCategory === selectedCategory;

            // Show card only if both conditions are met
            card.style.display = (nameMatches && categoryMatches) ? 'block' : 'none';
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
        DebugConfig.log(`Showing metadata for: ${algorithmName}`);
        
        const frameworkAlgorithm = this.getAlgorithm(algorithmName);
        if (!frameworkAlgorithm) {
            DebugConfig.error(`Algorithm not found: ${algorithmName}`);
            return;
        }
        
        // Create algorithm details component if not exists
        if (!this.algorithmDetails) {
            this.algorithmDetails = new AlgorithmDetails({
                onClose: () => {
                    DebugConfig.log('Algorithm details modal closed');
                }
            });
        }
        
        // Show the modal with algorithm data
        this.algorithmDetails.show(frameworkAlgorithm);
    }

    /**
     * Show algorithm details modal, switch to test vectors tab, and run all tests
     * Used when clicking on test results table rows
     */
    showAlgorithmDetailsWithTests(algorithm) {
        // Create algorithm details component if not exists
        if (!this.algorithmDetails) {
            this.algorithmDetails = new AlgorithmDetails({
                onClose: () => {
                    DebugConfig.log('Algorithm details modal closed');
                }
            });
        }

        // Show the modal with algorithm data
        this.algorithmDetails.show(algorithm);

        // Switch to test vectors tab
        this.algorithmDetails.switchTab('test-vectors');

        // Small delay to ensure tab content is rendered, then run all tests
        setTimeout(() => {
            try {
                this.algorithmDetails.runAllTests();
            } catch (error) {
                DebugConfig.error('Error running tests:', error);
            }
        }, 100);
    }

    // Modal methods removed - now using AlgorithmDetails component
    
    
    updateStats() {
        const totalElement = document.getElementById('total-algorithms');
        const workingElement = document.getElementById('working-algorithms');
        const categoriesElement = document.getElementById('categories');

        const algorithms = this.getAllAlgorithms();

        if (totalElement) {
            totalElement.textContent = algorithms.length;
        }

        if (workingElement) {
            // Count algorithms that passed tests (success === true OR passed === total)
            const passedCount = algorithms.filter(algo => {
                if (!algo.testResults) return false;
                // Check success flag if available, otherwise compare passed to total
                if (algo.testResults.success !== undefined) {
                    return algo.testResults.success === true;
                }
                return algo.testResults.passed === algo.testResults.total && algo.testResults.total > 0;
            }).length;

            // Just show the number (HTML has "Working" after the span)
            workingElement.textContent = passedCount;
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
        
        
        DebugConfig.log(`📊 Testing progress: ${current}/${total} - ${message}`);
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
     * Update the Testing tab with TestAPI results
     */
    updateTestingTabResults() {
        const algorithms = this.getFilteredAlgorithmsForTesting();
        const testedAlgorithms = algorithms.filter(alg => alg.testResults);

        // Update summary statistics using TestAPI results
        let passed = 0, partial = 0, failed = 0, skipped = 0;

        testedAlgorithms.forEach(alg => {
            if (alg.testResults.total === 0) {
                skipped++;
                return;
            }

            const results = alg.testResults;

            if (results.error) {
                failed++;
            } else if (results.percentage === 100) {
                passed++;
            } else if (results.passed > 0) {
                partial++;
            } else {
                failed++;
            }
        });

        // Count algorithms without test results as skipped
        skipped += algorithms.length - testedAlgorithms.length;

        // Update summary UI
        const passedEl = document.getElementById('passed-algorithms');
        const partialEl = document.getElementById('partial-algorithms');
        const failedEl = document.getElementById('failed-algorithms');
        const skippedEl = document.getElementById('skipped-algorithms');
        const successRateEl = document.getElementById('success-rate');
        const workingEl = document.getElementById('working-algorithms');

        if (passedEl) passedEl.textContent = passed;
        if (partialEl) partialEl.textContent = partial;
        if (failedEl) failedEl.textContent = failed;
        if (skippedEl) skippedEl.textContent = skipped;
        if (workingEl) workingEl.textContent = passed; // Update header "Working" badge
        if (successRateEl) {
            const total = passed + partial + failed;
            const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
            successRateEl.textContent = `${rate}%`;
        }

        // Update test grid
        this.populateTestGrid(algorithms);
    }
    
    /**
     * Populate the test grid with TestAPI results
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

                // Format duration (TestAPI doesn't provide duration, use placeholder)
                duration = '-';

                // Determine status using TestAPI results
                if (results.error) {
                    status = '❌ Error';
                    statusClass = 'failed';
                } else if (total === 0) {
                    status = '⚪ No Tests';
                    statusClass = 'untested';
                } else if (results.percentage === 100) {
                    status = '✅ Passed';
                    statusClass = 'passed';
                } else if (passed > 0) {
                    status = '🟡 Partial';
                    statusClass = 'partial';
                } else {
                    status = '❌ Failed';
                    statusClass = 'failed';
                }

                successRate = results.percentage || 0;
            }

            // Apply CSS class for row background tinting
            row.className = statusClass;

            // Build enhanced test result display from TestAPI results
            let enhancedTestDisplay = '-';
            if (results && results.functionalityResults) {
                const funcResults = results.functionalityResults;
                const roundTripInfo = funcResults
                    .filter(r => r.roundTripsAttempted > 0)
                    .map(r => `RT:${r.roundTripsPassed}/${r.roundTripsAttempted}`)
                    .join(' ');
                if (roundTripInfo) {
                    enhancedTestDisplay = roundTripInfo;
                }
            }

            row.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" data-algorithm="${algorithm.name}" /></td>
                <td><span class="test-status ${statusClass}">${status}</span></td>
                <td>${algorithm.name}</td>
                <td>${this.getCategoryDisplayName(algorithm.category)}</td>
                <td>${testCount}</td>
                <td>${passed}</td>
                <td>${total - passed}</td>
                <td>${successRate}%</td>
                <td>${enhancedTestDisplay}</td>
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

            // Add click event listener for row - navigate to algorithm details
            row.addEventListener('click', (e) => {
                // Don't trigger if clicking on checkbox
                if (e.target.type === 'checkbox' || e.target.closest('.row-checkbox')) {
                    return;
                }

                // Navigate to algorithm details > test vectors tab and run tests
                this.showAlgorithmDetailsWithTests(algorithm);
            });

            // Add hover cursor styling
            row.style.cursor = 'pointer';

            tbody.appendChild(row);
        });

        // Apply the current filter after populating the grid
        this.applyTestFilter();
    }

    setupTestGridEventListeners() {
        // Implementation for test grid sorting and functionality
        DebugConfig.log('Setting up test grid event listeners...');
        
        // Test grid functionality will be implemented here
    }

    setupMetadataModal() {
        // Implementation for metadata modal functionality
        DebugConfig.log('Setting up metadata modal...');
    }
    
    setupAlgorithmsInterface() {
      this.populateAlgorithmCategoriesDropdown();
      this.renderAlgorithms();
    }
    
    /**
     * Setup cipher interface with algorithm dropdown and encryption/decryption
     */
    setupCipherInterface() {
        DebugConfig.log('🔐 Setting up cipher interface...');
        
        this.populateAlgorithmDropdown();
        this.populateModeDropdown();
        this.populatePaddingDropdown();
        this.populateKdfDropdown();
        
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

        // Setup KDF controls
        this.setupKdfControls();

        // Setup input validation and salmon tinting
        this.setupInputValidation();

        // Setup algorithm selection change event for dynamic block visibility
        const algorithmSelect = document.getElementById('selected-algorithm');
        if (algorithmSelect) {
            algorithmSelect.addEventListener('change', () => {
                this.updateBlockVisibility();
                this.updateActionButtons();
            });
        }

        // Initialize block visibility and action buttons
        this.updateBlockVisibility();
        this.updateActionButtons();

        // Setup drag-and-drop for all text input areas
        this.setupDragAndDrop();

        DebugConfig.log('✅ Cipher interface setup complete');
    }

    /**
     * Setup drag-and-drop file loading for input and all data parameter fields
     */
    setupDragAndDrop() {
        // Apply to input text
        const inputText = document.getElementById('input-text');
        if (inputText) {
            this.addDragAndDropToElement(inputText, 'input');
        }

        // Apply to all data parameters
        const parameterTypes = ['key', 'iv', 'salt', 'nonce', 'pepper'];
        parameterTypes.forEach(paramType => {
            const paramInput = document.getElementById(`cipher-${paramType}`);
            if (paramInput) {
                this.addDragAndDropToElement(paramInput, paramType);
            }
        });

        DebugConfig.log('📥 Drag-and-drop file loading enabled for all text areas');
    }

    /**
     * Add drag-and-drop handlers to a textarea element
     */
    addDragAndDropToElement(element, fieldName) {
        // Get the container (parent element) for overlay activation
        const container = element.parentElement;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Activate overlay on drag over
        ['dragenter', 'dragover'].forEach(eventName => {
            element.addEventListener(eventName, () => {
                if (container && container.classList.contains('textarea-container')) {
                    container.classList.add('drag-active');
                }
            }, false);
        });

        // Deactivate overlay on drag leave or drop
        ['dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, () => {
                if (container && container.classList.contains('textarea-container')) {
                    container.classList.remove('drag-active');
                }
            }, false);
        });

        // Handle file drop
        element.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileForTextarea(files[0], element, fieldName);
            }
        }, false);
    }

    /**
     * Handle file dropped onto textarea
     */
    handleFileForTextarea(file, textarea, fieldName) {
        const reader = new FileReader();

        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            const bytes = new Uint8Array(arrayBuffer);

            // Determine active format using unified data-toolbar structure
            let format = 'text';

            // Find the toolbar associated with this textarea
            // The toolbar is the previous sibling of the textarea
            const toolbar = textarea.previousElementSibling;
            if (toolbar && toolbar.classList.contains('data-toolbar')) {
                const activeTab = toolbar.querySelector('.format-tab.active');
                format = activeTab?.getAttribute('data-format') || 'text';
            }

            // Convert bytes to appropriate format
            let text;
            if (format === 'hex') {
                text = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
            } else if (format === 'base64') {
                text = btoa(String.fromCharCode.apply(null, bytes));
            } else {
                // Text format
                text = new TextDecoder().decode(bytes);
            }

            textarea.value = text;

            // Trigger validation
            this.validateInputs();

            DebugConfig.log(`📁 File loaded into ${fieldName} field (${bytes.length} bytes, ${format} format)`);
        };

        reader.readAsArrayBuffer(file);
    }

    /**
     * Setup algorithm chaining interface
     */
    setupChainingInterface() {
        DebugConfig.log('🔗 Setting up chaining interface...');
        
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
        
        // Setup algorithm palette tabs and populate it
        this.populateAlgorithmPalette();
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
        
        DebugConfig.log('✅ Chaining interface setup complete');
    }
    
    setupTestingInterface() {
        this.populateTestingCategoriesDropdown();
        this.setupTestingFilters();
        this.setupTestingActions();
        this.setupParallelTestingControls();
        this.setupTestStatusFilters();
        this.setupTableSorting();
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

        DebugConfig.log('✅ Testing filters setup complete');
    }

    /**
     * Setup testing action buttons
     */
    setupTestingActions() {
        const runAllBtn = document.getElementById('run-all-tests');
        const runSelectedBtn = document.getElementById('run-selected-tests');
        const stopTestingBtn = document.getElementById('stop-testing');
        const exportResultsBtn = document.getElementById('export-test-results');
        const downloadInfraBtn = document.getElementById('download-infrastructure');

        if (runAllBtn) {
            runAllBtn.addEventListener('click', () => this.runAllTestsManually());
        }

        if (runSelectedBtn) {
            runSelectedBtn.addEventListener('click', () => this.runSelectedTests());
        }

        if (stopTestingBtn) {
            stopTestingBtn.addEventListener('click', () => this.stopTesting());
        }

        if (exportResultsBtn) {
            exportResultsBtn.addEventListener('click', () => this.exportTestResults());
        }

        if (downloadInfraBtn) {
            downloadInfraBtn.addEventListener('click', async () => {
                if (typeof InfrastructureGenerator !== 'undefined') {
                    DebugConfig.log('📦 Generating multi-language infrastructure bundle...');
                    try {
                        await InfrastructureGenerator.DownloadInfrastructureBundle();
                        DebugConfig.log('✅ Infrastructure bundle generated successfully');
                    } catch (error) {
                        DebugConfig.error('❌ Failed to generate infrastructure:', error);
                        alert(`Failed to generate infrastructure: ${error.message}`);
                    }
                } else {
                    alert('Infrastructure generator not loaded. Please reload the page.');
                }
            });
        }

        DebugConfig.log('✅ Testing actions setup complete');
    }

    /**
     * Setup parallel testing controls and CPU detection
     */
    setupParallelTestingControls() {
        // Detect CPU cores and set up worker count
        const cpuCores = navigator.hardwareConcurrency || 4;
        const cpuInfo = document.getElementById('cpu-cores-info');
        const workerCountInput = document.getElementById('worker-count');
        const parallelToggle = document.getElementById('enable-parallel-testing');

        if (cpuInfo) {
            cpuInfo.textContent = `(${cpuCores} CPU cores detected)`;
        }

        if (workerCountInput) {
            this.workerCount = Math.max(1, cpuCores - 1); // Leave one core for main thread
            workerCountInput.value = this.workerCount;
            workerCountInput.max = cpuCores;

            workerCountInput.addEventListener('change', (e) => {
                this.workerCount = Math.max(1, Math.min(parseInt(e.target.value) || 4, cpuCores));
                e.target.value = this.workerCount; // Clamp the displayed value
                DebugConfig.log(`🔧 Worker count set to: ${this.workerCount}`);
            });
        }

        if (parallelToggle) {
            this.isParallelTestingEnabled = parallelToggle.checked;

            parallelToggle.addEventListener('change', (e) => {
                this.isParallelTestingEnabled = e.target.checked;
                DebugConfig.log(`🚀 Parallel testing ${this.isParallelTestingEnabled ? 'enabled' : 'disabled'}`);
            });
        }

        DebugConfig.log(`✅ Parallel testing controls initialized - ${cpuCores} cores, ${this.workerCount} workers (max(1, cores-1) formula)`);
    }

    /**
     * Setup click handlers for test status filtering badges
     */
    setupTestStatusFilters() {
        // Find the testing tab stat elements (not the header ones)
        const testingTab = document.querySelector('#testing-tab');
        if (!testingTab) return;

        const filterElements = {
            'all': testingTab.querySelector('#total-algorithms')?.closest('.test-stat'),
            'passed': testingTab.querySelector('#passed-algorithms')?.closest('.test-stat'),
            'partial': testingTab.querySelector('#partial-algorithms')?.closest('.test-stat'),
            'failed': testingTab.querySelector('#failed-algorithms')?.closest('.test-stat'),
            'skipped': testingTab.querySelector('#skipped-algorithms')?.closest('.test-stat')
        };

        Object.entries(filterElements).forEach(([filterType, element]) => {
            if (element) {
                element.style.cursor = 'pointer';
                element.addEventListener('click', () => {
                    this.currentTestFilter = filterType;
                    this.applyTestFilter();

                    // Visual feedback: highlight active filter
                    Object.values(filterElements).forEach(el => {
                        if (el) el.style.opacity = '0.6';
                    });
                    element.style.opacity = '1.0';
                });
            }
        });

        DebugConfig.log('✅ Test status filters initialized');
    }

    /**
     * Setup table sorting functionality
     */
    setupTableSorting() {
        // Initialize sorting state
        this.currentSortColumn = null;
        this.currentSortDirection = 'asc'; // Default to ascending

        // Get all sortable headers
        const sortableHeaders = document.querySelectorAll('.test-grid th.sortable');

        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const column = header.getAttribute('data-column');
                this.sortTableByColumn(column);
            });
        });

        DebugConfig.log('✅ Table sorting initialized');
    }

    /**
     * Sort the test grid by a specific column
     */
    sortTableByColumn(column) {
        // Determine sort direction
        if (this.currentSortColumn === column) {
            // Toggle direction if clicking the same column
            this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // Default to ascending for new column
            this.currentSortDirection = 'asc';
        }

        this.currentSortColumn = column;

        // Get table body and rows
        const tableBody = document.getElementById('test-grid-body');
        if (!tableBody) return;

        const rows = Array.from(tableBody.querySelectorAll('tr'));

        // Sort rows
        rows.sort((a, b) => {
            let valueA = this.getCellValue(a, column);
            let valueB = this.getCellValue(b, column);

            // Handle numeric values
            if (column === 'test-vectors' || column === 'passed' || column === 'failed' ||
                column === 'success-rate' || column === 'enhanced-tests') {
                valueA = parseFloat(valueA) || 0;
                valueB = parseFloat(valueB) || 0;
            }

            // Handle duration (convert to milliseconds)
            if (column === 'duration') {
                valueA = this.parseDuration(valueA);
                valueB = this.parseDuration(valueB);
            }

            // Handle dates
            if (column === 'last-tested') {
                valueA = new Date(valueA || 0).getTime();
                valueB = new Date(valueB || 0).getTime();
            }

            // Compare values
            let comparison = 0;
            if (valueA > valueB) {
                comparison = 1;
            } else if (valueA < valueB) {
                comparison = -1;
            }

            // Apply sort direction
            return this.currentSortDirection === 'asc' ? comparison : -comparison;
        });

        // Re-append sorted rows
        rows.forEach(row => tableBody.appendChild(row));

        // Update header styling
        this.updateSortIndicators();
    }

    /**
     * Get cell value for a given column
     */
    getCellValue(row, column) {
        const columnIndex = this.getColumnIndex(column);
        const cell = row.cells[columnIndex];

        if (!cell) return '';

        // Handle different cell types
        if (column === 'status') {
            // Extract status from emoji or data attribute
            return cell.textContent.trim();
        }

        return cell.textContent.trim();
    }

    /**
     * Get column index by data-column attribute
     */
    getColumnIndex(column) {
        const headers = document.querySelectorAll('.test-grid th');
        for (let i = 0; i < headers.length; i++) {
            if (headers[i].getAttribute('data-column') === column) {
                return i;
            }
        }
        return 0;
    }

    /**
     * Parse duration string to milliseconds
     */
    parseDuration(duration) {
        if (!duration) return 0;

        // Handle formats like "123ms", "1.23s", "1m 23s"
        const msMatch = duration.match(/(\d+)ms/);
        if (msMatch) return parseFloat(msMatch[1]);

        const sMatch = duration.match(/(\d+\.?\d*)s/);
        if (sMatch) return parseFloat(sMatch[1]) * 1000;

        const mMatch = duration.match(/(\d+)m/);
        if (mMatch) {
            let ms = parseFloat(mMatch[1]) * 60000;
            const sMatch2 = duration.match(/(\d+)s/);
            if (sMatch2) ms += parseFloat(sMatch2[1]) * 1000;
            return ms;
        }

        return 0;
    }

    /**
     * Update sort indicator styling
     */
    updateSortIndicators() {
        // Remove all sort classes
        const headers = document.querySelectorAll('.test-grid th.sortable');
        headers.forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
        });

        // Add class to current sort column
        if (this.currentSortColumn) {
            const currentHeader = document.querySelector(
                `.test-grid th.sortable[data-column="${this.currentSortColumn}"]`
            );
            if (currentHeader) {
                currentHeader.classList.add(`sorted-${this.currentSortDirection}`);
            }
        }
    }

    /**
     * Apply the current filter to the test grid
     */
    applyTestFilter() {
        const tbody = document.getElementById('test-grid-body');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const statusClass = row.className;

            if (this.currentTestFilter === 'all') {
                row.style.display = '';
            } else if (this.currentTestFilter === 'passed' && statusClass === 'passed') {
                row.style.display = '';
            } else if (this.currentTestFilter === 'partial' && statusClass === 'partial') {
                row.style.display = '';
            } else if (this.currentTestFilter === 'failed' && statusClass === 'failed') {
                row.style.display = '';
            } else if (this.currentTestFilter === 'skipped' && statusClass === 'untested') {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    /**
     * Manually run all tests (Enhanced with parallel testing support)
     */
    async runAllTestsManually() {
        DebugConfig.log('🔧 runAllTestsManually called');
        DebugConfig.log('  TestEngine available:', typeof TestEngine !== 'undefined');
        DebugConfig.log('  Parallel enabled:', this.isParallelTestingEnabled);
        DebugConfig.log('  Already testing:', this.isTesting);

        if (typeof TestEngine === 'undefined') {
            DebugConfig.error('❌ Testing framework not initialized');
            alert('Testing framework not initialized. Please reload the page.');
            return;
        }

        if (this.isTesting) {
            DebugConfig.log('🚫 Testing already in progress');
            return;
        }

        try {
            this.isTesting = true;
            this.updateTestButtonStates(true);

            if (this.isParallelTestingEnabled) {
                DebugConfig.log('🚀 Starting MEGATHINK parallel testing...');
                await this.runParallelTests();
            } else {
                DebugConfig.log('🐌 Starting sequential testing...');
                await this.autoRunAllTests();
            }
        } catch (error) {
            DebugConfig.error('❌ Manual test run failed:', error);
            DebugConfig.error('Error stack:', error.stack);
            alert('Test execution failed: ' + error.message);
        } finally {
            this.isTesting = false;
            this.updateTestButtonStates(false);
        }
    }

    /**
     * Run tests for selected algorithms
     */
    async runSelectedTests() {
        if (typeof TestEngine === 'undefined') {
            alert('Testing framework not initialized. Please reload the page.');
            return;
        }

        const checkboxes = document.querySelectorAll('.row-checkbox:checked');
        if (checkboxes.length === 0) {
            alert('Please select algorithms to test.');
            return;
        }

        const algorithmNames = Array.from(checkboxes).map(cb => cb.getAttribute('data-algorithm'));
        DebugConfig.log('Running tests for selected algorithms:', algorithmNames);

        try {
            // Test each algorithm sequentially
            for (const algorithmName of algorithmNames) {
                const algorithm = this.getAlgorithm(algorithmName);
                if (algorithm && algorithm.tests && algorithm.tests.length > 0) {
                    const result = await TestEngine.TestAlgorithm(algorithm);

                    algorithm.testResults = {
                        passed: result.passed,
                        total: result.total,
                        percentage: result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0,
                        lastUpdated: Date.now(),
                        success: result.passed === result.total,
                        errors: result.errors
                    };
                } else if (algorithm) {
                    algorithm.testResults = {
                        passed: 0,
                        total: algorithm.tests?.length || 0,
                        error: 'No test vectors',
                        lastUpdated: Date.now()
                    };
                }
            }

            this.updateTestingTabResults();
            this.updateStats();
        } catch (error) {
            DebugConfig.error('Selected tests failed:', error);
            alert('Test execution failed: ' + error.message);
        }
    }

    /**
     * Stop testing (works for both sequential and parallel)
     */
    stopTesting() {
        DebugConfig.log('⏹️ Stop button clicked - stopping tests...');

        // Set flags to stop both modes
        this.isTesting = false;
        this.cancelled = true;

        // Update UI state
        this.updateTestButtonStates(false);

        // Update global progress to show stopped state
        const progressText = document.getElementById('global-progress-text');
        if (progressText) {
            progressText.textContent = 'Testing stopped by user';
        }

        // Hide progress container after a short delay
        const progressContainer = document.getElementById('global-progress-container');
        setTimeout(() => {
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
        }, 2000);

        DebugConfig.log('✅ Testing stopped');
    }

    /**
     * Export test results
     */
    exportTestResults() {
        try {
            const algorithms = this.getAllAlgorithms().filter(alg => alg.testResults);
            const results = algorithms.map(alg => ({
                name: alg.name,
                category: this.getCategoryDisplayName(alg.category),
                passed: alg.testResults.passed,
                total: alg.testResults.total,
                percentage: alg.testResults.percentage,
                lastTested: new Date(alg.testResults.lastUpdated).toISOString(),
                error: alg.testResults.error || null
            }));

            const csvContent = this.convertToCSV(results);
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `cipher-test-results-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            DebugConfig.error('Export failed:', error);
            alert('Export failed: ' + error.message);
        }
    }

    /**
     * Convert test results to CSV format
     */
    convertToCSV(data) {
        if (!data.length) return '';

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) return '';
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value}"`;
                }
                return value;
            }).join(','))
        ].join('\n');

        return csvContent;
    }
    
    /**
     * Initialize the chain builder
     */
    initializeChainBuilder() {
        // Check if ChainBuilder class is available
        if (typeof ChainBuilder !== 'undefined') {
            DebugConfig.log('🔗 ChainBuilder class found, initializing...');
            this.chainBuilder = new ChainBuilder();
            this.populateAlgorithmPalette();
        } else {
            DebugConfig.log('⚠️ ChainBuilder class not found, creating minimal implementation...');
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
        
        DebugConfig.log('✅ Minimal chain builder created');
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
        
        DebugConfig.log('🏗️ Demo chain created with', this.chainBuilder.nodes.size, 'nodes');
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
        
        DebugConfig.log(`📋 Populated category filter with ${categories.length} categories`);
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
        
        DebugConfig.log(`📋 Populated mode dropdown with ${modeAlgorithms.length} mode algorithms`);
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

        DebugConfig.log(`📋 Populated padding dropdown with ${paddingAlgorithms.length} padding algorithms`);
    }

    /**
     * Populate KDF dropdown from KDF category algorithms
     */
    populateKdfDropdown() {
        // Get algorithms from KDF category
        const algorithms = this.getAllAlgorithms();
        const kdfAlgorithms = algorithms.filter(algorithm =>
            algorithm.category === AlgorithmFramework.CategoryType.KDF
        );

        // Sort alphabetically
        kdfAlgorithms.sort((a, b) => a.name.localeCompare(b.name));

        // Populate all KDF selectors (key, iv, salt, nonce, pepper)
        const parameterTypes = ['key', 'iv', 'salt', 'nonce', 'pepper'];

        parameterTypes.forEach(paramType => {
            const kdfSelect = document.getElementById(`${paramType}-kdf`);
            if (!kdfSelect) return;

            // Clear existing options except the first "None" option
            while (kdfSelect.options.length > 1) {
                kdfSelect.remove(1);
            }

            // Add KDF options
            kdfAlgorithms.forEach(algorithm => {
                const option = document.createElement('option');
                option.value = algorithm.name;
                option.textContent = algorithm.name;
                kdfSelect.appendChild(option);
            });
        });

        DebugConfig.log(`📋 Populated KDF dropdowns for all parameters with ${kdfAlgorithms.length} KDF algorithms`);
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
        
        DebugConfig.log(`📋 Populated testing category filter with ${categories.length} categories`);
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
                    DebugConfig.warn('Failed to get category display name:', e.message);
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
                    
                    // Apply category color styling
                    if (algorithm.category) {
                        const foundKey = Object.keys(AlgorithmFramework.CategoryType).find(key => 
                            AlgorithmFramework.CategoryType[key] === algorithm.category
                        );
                        if (foundKey) {
                            const categoryColor = AlgorithmFramework.CategoryType[foundKey].color;
                            option.style.backgroundColor = categoryColor;
                            option.style.color = 'white';
                            option.style.setProperty('--category-color', categoryColor);
                        }
                    }
                    
                    optgroup.appendChild(option);
                });
            
            algorithmSelect.appendChild(optgroup);
        });
        
        DebugConfig.log(`📋 Populated algorithm dropdown with ${algorithms.length} algorithms`);
    }
    
    /**
     * Setup format tab switching for all textareas using unified toolbar
     */
    setupFormatTabs() {
        // UNIFIED: All format tabs now use data-toolbar structure with data-target
        // This handles input, output, and all data parameters (key, iv, salt, nonce, pepper)
        const allFormatTabs = document.querySelectorAll('.data-toolbar .format-tab');
        allFormatTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetId = tab.getAttribute('data-target');
                const newFormat = tab.getAttribute('data-format');

                if (!targetId || !newFormat) return;

                // Find the toolbar containing this tab
                const toolbar = tab.closest('.data-toolbar');
                if (!toolbar) return;

                // Find the active tab in this toolbar
                const activeTab = toolbar.querySelector('.format-tab.active');
                const oldFormat = activeTab?.getAttribute('data-format') || 'text';

                if (oldFormat === newFormat) return; // No change

                // Update active state within this toolbar only
                toolbar.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Get the textarea and convert content
                const textarea = document.getElementById(targetId);
                if (textarea && textarea.value) {
                    this.convertTextAreaFormat(textarea, oldFormat, newFormat);
                }
            });
        });
    }

    /**
     * Convert textarea content between formats
     * @param {HTMLTextAreaElement} textarea - The textarea element to convert
     * @param {string} fromFormat - Current format (text/hex/base64)
     * @param {string} toFormat - Target format (text/hex/base64)
     */
    convertTextAreaFormat(textarea, fromFormat, toFormat) {
        if (!textarea || !textarea.value) return;

        const currentValue = textarea.value;

        try {
            // First, convert from current format to bytes
            let bytes;
            switch (fromFormat) {
                case 'text':
                    bytes = Array.from(new TextEncoder().encode(currentValue));
                    break;
                case 'hex':
                    bytes = this.hexToBytes(currentValue);
                    break;
                case 'base64':
                    bytes = Array.from(atob(currentValue)).map(c => c.charCodeAt(0));
                    break;
                default:
                    return; // Unknown format, don't convert
            }

            // Then, convert from bytes to target format
            let newValue;
            switch (toFormat) {
                case 'text':
                    // Try to decode as UTF-8
                    try {
                        newValue = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
                    } catch (e) {
                        // If not valid UTF-8, show a warning and don't convert
                        alert(`⚠️ Cannot convert to text: data contains non-UTF-8 bytes.\n\nStaying in ${fromFormat} format.`);
                        // Revert tab selection
                        document.querySelectorAll(`.format-tab[data-format="${fromFormat}"]`).forEach(t => {
                            if (t.closest('.input-section, .output-section, .key-format-tabs') === textarea.closest('.input-section, .output-section, .controls-section')) {
                                t.click();
                            }
                        });
                        return;
                    }
                    break;
                case 'hex':
                    newValue = this.bytesToHex(bytes);
                    break;
                case 'base64':
                    newValue = btoa(String.fromCharCode(...bytes));
                    break;
                default:
                    return; // Unknown format, don't convert
            }

            textarea.value = newValue;
        } catch (error) {
            DebugConfig.error('Format conversion error:', error);
            alert(`⚠️ Conversion failed: ${error.message}\n\nThe current content may not be valid ${fromFormat} format.`);

            // Revert tab selection
            const container = textarea.closest('.input-section, .output-section, .controls-section');
            if (container) {
                container.querySelectorAll(`.format-tab[data-format="${fromFormat}"]`).forEach(t => {
                    t.click();
                });
            }
        }
    }
    
    /**
     * Setup unified toolbar for all textboxes
     */
    setupFileUpload() {
        // Setup unified toolbar event handlers
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.getAttribute('data-action');
                const targetId = btn.getAttribute('data-target');
                const textarea = document.getElementById(targetId);

                if (!textarea) return;

                switch (action) {
                    case 'copy':
                        this.handleCopy(textarea);
                        break;
                    case 'paste':
                        this.handlePaste(textarea);
                        break;
                    case 'download':
                        this.handleDownload(textarea, targetId);
                        break;
                    case 'upload':
                        this.handleUploadClick(targetId);
                        break;
                }
            });
        });

        // Setup file input change handlers
        document.querySelectorAll('input[type="file"]').forEach(fileInput => {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    const targetId = fileInput.id.replace('-file-input', '');
                    const textarea = document.getElementById(targetId);
                    if (textarea) {
                        this.handleFileUploadForTextarea(e.target.files[0], textarea);
                    }
                }
            });
        });

        // Setup tooltip removal on focus for all textareas
        this.setupTooltipBehavior();
    }

    /**
     * Setup tooltip behavior - remove title on focus, restore on blur
     */
    setupTooltipBehavior() {
        const textareas = [
            document.getElementById('input-text'),
            document.getElementById('cipher-key'),
            document.getElementById('cipher-iv'),
            document.getElementById('cipher-salt'),
            document.getElementById('cipher-nonce'),
            document.getElementById('cipher-pepper')
        ].filter(el => el !== null);

        textareas.forEach(textarea => {
            const originalTitle = textarea.getAttribute('title');

            textarea.addEventListener('focus', () => {
                textarea.removeAttribute('title');
            });

            textarea.addEventListener('blur', () => {
                if (originalTitle && textarea.value === '') {
                    textarea.setAttribute('title', originalTitle);
                }
            });
        });
    }

    /**
     * Handle copy action
     */
    async handleCopy(textarea) {
        if (!textarea || !textarea.value) {
            alert('No content to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(textarea.value);
            // Visual feedback - briefly change button appearance
            const copyBtn = document.querySelector(`.toolbar-btn[data-target="${textarea.id}"][data-action="copy"]`);
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1000);
            }
        } catch (error) {
            DebugConfig.error('Error copying to clipboard:', error);
            alert('Error copying to clipboard: ' + error.message);
        }
    }

    /**
     * Handle paste action
     */
    async handlePaste(textarea) {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                textarea.value = text;
                this.validateInputs();
            }
        } catch (error) {
            DebugConfig.error('Error pasting from clipboard:', error);
            alert('Error pasting from clipboard: ' + error.message);
        }
    }

    /**
     * Handle upload click - trigger file input
     */
    handleUploadClick(textareaId) {
        const fileInput = document.getElementById(`${textareaId}-file-input`);
        if (fileInput) {
            fileInput.click();
        }
    }

    /**
     * Handle download action
     */
    handleDownload(textarea, textareaId) {
        if (!textarea || !textarea.value) {
            alert('No content to download');
            return;
        }

        try {
            // Get current format by finding active format tab for this textarea
            const toolbar = textarea.previousElementSibling;
            const formatTab = toolbar?.querySelector('.format-tab.active, .format-tab-small.active');
            const currentFormat = formatTab?.getAttribute('data-format') || 'text';

            // Convert content to bytes
            let bytes;
            switch (currentFormat) {
                case 'text':
                    bytes = new TextEncoder().encode(textarea.value);
                    break;
                case 'hex':
                    bytes = new Uint8Array(this.hexToBytes(textarea.value));
                    break;
                case 'base64':
                    const binaryString = atob(textarea.value);
                    bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    break;
                default:
                    bytes = new TextEncoder().encode(textarea.value);
            }

            // Create blob and download
            const blob = new Blob([bytes], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Generate filename based on textarea ID and format
            const baseName = textareaId.replace('cipher-', '').replace('-text', '').replace('-', '_');
            const extension = currentFormat === 'text' ? 'txt' : currentFormat;
            link.download = `${baseName}.${extension}`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            DebugConfig.error('Error downloading file:', error);
            alert('Error downloading file: ' + error.message);
        }
    }

    /**
     * Handle file upload for a specific textarea
     */
    async handleFileUploadForTextarea(file, textarea) {
        if (!file || !textarea) return;

        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            alert('File size exceeds 50MB limit');
            return;
        }

        try {
            // Read file as binary
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);

            // Get current format by finding active format tab for this textarea
            const toolbar = textarea.previousElementSibling;
            const formatTab = toolbar?.querySelector('.format-tab.active, .format-tab-small.active');
            const currentFormat = formatTab?.getAttribute('data-format') || 'text';

            // Convert to appropriate format
            let displayText;
            switch (currentFormat) {
                case 'text':
                    // Try to decode as UTF-8 text
                    try {
                        displayText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                    } catch (e) {
                        // If not valid UTF-8, switch to hex format
                        alert('File contains binary data. Switching to Hex format.');
                        const hexTab = toolbar?.querySelector('.format-tab[data-format="hex"], .format-tab-small[data-format="hex"]');
                        hexTab?.click();
                        displayText = this.bytesToHex(Array.from(bytes));
                    }
                    break;
                case 'hex':
                    displayText = this.bytesToHex(Array.from(bytes));
                    break;
                case 'base64':
                    displayText = btoa(String.fromCharCode(...bytes));
                    break;
                default:
                    displayText = new TextDecoder().decode(bytes);
            }

            textarea.value = displayText;
            this.validateInputs();
        } catch (error) {
            DebugConfig.error('Error reading file:', error);
            alert('Error reading file: ' + error.message);
        }
    }

    /**
     * Handle file upload and populate input textarea (LEGACY - keeping for compatibility)
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
            // Read file as binary
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);

            // Get current input format
            const inputFormat = document.querySelector('.input-section .format-tab.active')?.getAttribute('data-format') || 'text';

            // Convert to appropriate format
            let displayText;
            switch (inputFormat) {
                case 'text':
                    // Try to decode as UTF-8 text
                    try {
                        displayText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                    } catch (e) {
                        // If not valid UTF-8, switch to hex format
                        alert('File contains binary data. Switching to Hex format.');
                        document.querySelector('.input-section .format-tab[data-format="hex"]')?.click();
                        displayText = this.bytesToHex(Array.from(bytes));
                    }
                    break;
                case 'hex':
                    displayText = this.bytesToHex(Array.from(bytes));
                    break;
                case 'base64':
                    displayText = btoa(String.fromCharCode(...bytes));
                    break;
                default:
                    displayText = new TextDecoder().decode(bytes);
            }

            inputText.value = displayText;
        } catch (error) {
            DebugConfig.error('Error reading file:', error);
            alert('Error reading file: ' + error.message);
        }
    }
    
    /**
     * Setup KDF (Key Derivation Function) controls
     */
    setupKdfControls() {
        // Setup KDF controls for all parameter types
        const parameterTypes = ['key', 'iv', 'salt', 'nonce', 'pepper'];

        parameterTypes.forEach(paramType => {
            this.setupKdfControlsForParameter(paramType);
        });

        DebugConfig.log('🔑 KDF controls setup complete for all parameters');
    }

    /**
     * Setup KDF controls for a specific parameter type
     * @param {string} parameterType - 'key', 'iv', 'salt', 'nonce', or 'pepper'
     */
    setupKdfControlsForParameter(parameterType) {
        const kdfSelect = document.getElementById(`${parameterType}-kdf`);
        if (!kdfSelect) return;

        // Add event listener for KDF selection change
        kdfSelect.addEventListener('change', () => {
            this.updateKdfParameterVisibility(parameterType);
            // Re-validate inputs to update salmon coloring
            this.validateInputs();
        });

        // Initialize visibility on page load
        this.updateKdfParameterVisibility(parameterType);
    }

    /**
     * Update KDF parameter visibility based on selected KDF algorithm for a specific parameter type
     * @param {string} parameterType - 'key', 'iv', 'salt', 'nonce', or 'pepper'
     */
    updateKdfParameterVisibility(parameterType) {
        const kdfSelect = document.getElementById(`${parameterType}-kdf`);
        const kdfParameters = document.getElementById(`${parameterType}-kdf-parameters`);

        if (!kdfSelect || !kdfParameters) return;

        const selectedKdf = kdfSelect.value;

        // Show/hide the entire parameters container
        if (selectedKdf) {
            kdfParameters.style.display = 'block';
        } else {
            kdfParameters.style.display = 'none';
            return;
        }

        // Get parameter containers (using parameterType prefix)
        const iterationsContainer = document.getElementById(`${parameterType}-kdf-iterations-container`);
        const infoContainer = document.getElementById(`${parameterType}-kdf-info-container`);
        const hashContainer = document.getElementById(`${parameterType}-kdf-hash-container`);
        const nContainer = document.getElementById(`${parameterType}-kdf-n-container`);
        const rContainer = document.getElementById(`${parameterType}-kdf-r-container`);
        const pContainer = document.getElementById(`${parameterType}-kdf-p-container`);

        // Hide all optional parameters initially
        if (iterationsContainer) iterationsContainer.style.display = 'none';
        if (infoContainer) infoContainer.style.display = 'none';
        if (hashContainer) hashContainer.style.display = 'none';
        if (nContainer) nContainer.style.display = 'none';
        if (rContainer) rContainer.style.display = 'none';
        if (pContainer) pContainer.style.display = 'none';

        // Show parameters based on selected KDF
        switch (selectedKdf) {
            case 'PBKDF2':
                // PBKDF2: salt, iterations, outputSize
                if (iterationsContainer) iterationsContainer.style.display = 'block';
                break;

            case 'HKDF':
                // HKDF: salt, info, hashFunction, outputSize
                if (infoContainer) infoContainer.style.display = 'block';
                if (hashContainer) hashContainer.style.display = 'block';
                break;

            case 'scrypt':
                // scrypt: salt, N, r, p, outputSize (keyLength)
                if (nContainer) nContainer.style.display = 'block';
                if (rContainer) rContainer.style.display = 'block';
                if (pContainer) pContainer.style.display = 'block';
                break;

            default:
                DebugConfig.log(`⚠️ Unknown KDF selected: ${selectedKdf}`);
                break;
        }
    }

    /**
     * Derive data using selected KDF algorithm for any parameter type
     * @param {Array} dataBytes - The data input as byte array
     * @param {string} parameterType - Type of parameter: 'key', 'iv', 'salt', 'nonce', 'pepper'
     * @returns {Array} - Derived data bytes
     */
    async deriveDataWithKdf(dataBytes, parameterType) {
        const kdfSelect = document.getElementById(`${parameterType}-kdf`);
        const kdfName = kdfSelect?.value;

        if (!kdfName) {
            // No KDF selected, return original data
            return dataBytes;
        }

        // Find KDF algorithm
        const kdfAlgorithm = AlgorithmFramework.Algorithms.find(a => a.name === kdfName);
        if (!kdfAlgorithm) {
            throw new Error(`KDF algorithm "${kdfName}" not found`);
        }

        // Create KDF instance
        const kdfInstance = kdfAlgorithm.CreateInstance();
        if (!kdfInstance) {
            throw new Error(`Failed to create instance of ${kdfName}`);
        }

        // Get KDF parameters from UI (using parameterType prefix)
        const saltTextarea = document.getElementById(`${parameterType}-kdf-salt`);
        const outputSize = parseInt(document.getElementById(`${parameterType}-kdf-output-size`)?.value) || 32;

        // Get salt bytes using format-aware parsing
        let saltBytes = [];
        if (saltTextarea && saltTextarea.value.trim()) {
            const saltFormat = this.getActiveFormatForParameter(saltTextarea);
            saltBytes = this.parseInputByFormat(saltTextarea.value, saltFormat);
        }

        // Set common parameters
        kdfInstance.salt = saltBytes;
        kdfInstance.outputSize = outputSize;

        // Set algorithm-specific parameters
        switch (kdfName) {
            case 'PBKDF2':
                const iterations = parseInt(document.getElementById(`${parameterType}-kdf-iterations`)?.value) || 10000;
                kdfInstance.iterations = iterations;
                break;

            case 'HKDF':
                const infoTextarea = document.getElementById(`${parameterType}-kdf-info`);
                let infoBytes = [];
                if (infoTextarea && infoTextarea.value.trim()) {
                    const infoFormat = this.getActiveFormatForParameter(infoTextarea);
                    infoBytes = this.parseInputByFormat(infoTextarea.value, infoFormat);
                }
                const hashFunction = document.getElementById(`${parameterType}-kdf-hash`)?.value || 'SHA256';
                kdfInstance.info = infoBytes;
                kdfInstance.hashFunction = hashFunction;
                break;

            case 'scrypt':
                const N = parseInt(document.getElementById(`${parameterType}-kdf-n`)?.value) || 16;
                const r = parseInt(document.getElementById(`${parameterType}-kdf-r`)?.value) || 1;
                const p = parseInt(document.getElementById(`${parameterType}-kdf-p`)?.value) || 1;
                kdfInstance.N = N;
                kdfInstance.r = r;
                kdfInstance.p = p;
                kdfInstance.password = dataBytes;
                break;

            default:
                DebugConfig.log(`⚠️ Unknown KDF: ${kdfName}`);
                break;
        }

        // Derive data
        kdfInstance.Feed(dataBytes);
        const derivedData = kdfInstance.Result();

        DebugConfig.log(`🔑 Derived ${derivedData.length}-byte ${parameterType} using ${kdfName}`);

        return derivedData;
    }

    /**
     * Setup input validation with salmon tinting for invalid key/input sizes
     */
    setupInputValidation() {
        const inputText = document.getElementById('input-text');
        const algorithmSelect = document.getElementById('selected-algorithm');
        const modeSelect = document.getElementById('cipher-mode');
        const paddingSelect = document.getElementById('cipher-padding');

        if (!inputText || !algorithmSelect) return;

        // GENERALIZED: Validate on input change for ALL data parameters
        const parameterTypes = ['key', 'iv', 'salt', 'nonce', 'pepper'];

        inputText.addEventListener('input', () => this.validateInputs());
        algorithmSelect.addEventListener('change', () => this.validateInputs());

        if (modeSelect) {
            modeSelect.addEventListener('change', () => {
                this.updateBlockVisibility();
                this.validateInputs();
            });
        }
        if (paddingSelect) {
            paddingSelect.addEventListener('change', () => this.validateInputs());
        }

        // Add input listeners for all data parameter fields
        parameterTypes.forEach(paramType => {
            const paramInput = document.getElementById(`cipher-${paramType}`);
            if (paramInput) {
                paramInput.addEventListener('input', () => this.validateInputs());
            }
        });

        // Also validate when format tabs are clicked (text/hex/base64)
        const formatTabs = document.querySelectorAll('.format-tab, .format-tab-small');
        formatTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Delay validation to allow format switch to complete
                setTimeout(() => this.validateInputs(), 50);
            });
        });

        // Initial validation
        this.validateInputs();
    }

    /**
     * GENERALIZED: Validate all data parameter field sizes and apply CSS classes for visual feedback
     * Handles: input, key, iv, salt, nonce, pepper
     */
    validateInputs() {
        const inputText = document.getElementById('input-text');
        const algorithmSelect = document.getElementById('selected-algorithm');
        const modeSelect = document.getElementById('cipher-mode');
        const paddingSelect = document.getElementById('cipher-padding');

        if (!inputText || !algorithmSelect) return;

        const algorithmName = algorithmSelect.value;
        const modeName = modeSelect ? modeSelect.value : '';

        // Helper function to remove all validation classes
        const clearValidation = (element) => {
            if (element) {
                element.classList.remove('input-invalid', 'input-disabled');
            }
        };

        // All data parameter types to validate
        const parameterTypes = ['key', 'iv', 'salt', 'nonce', 'pepper'];

        if (!algorithmName) {
            // No algorithm selected - clear all validation states
            clearValidation(inputText);
            parameterTypes.forEach(paramType => {
                clearValidation(document.getElementById(`cipher-${paramType}`));
            });
            return;
        }

        // Get the selected algorithm
        const algorithm = AlgorithmFramework.Algorithms.find(a => a.name === algorithmName);
        if (!algorithm) {
            clearValidation(inputText);
            parameterTypes.forEach(paramType => {
                clearValidation(document.getElementById(`cipher-${paramType}`));
            });
            return;
        }

        // GENERALIZED: Validate each data parameter based on algorithm requirements
        parameterTypes.forEach(paramType => {
            const paramInput = document.getElementById(`cipher-${paramType}`);
            if (!paramInput) return; // Parameter not in HTML (skip silently)

            // Determine if this parameter is needed for the selected algorithm
            const isNeeded = this.algorithmNeedsParameter(algorithm, paramType, modeName);

            // Check if KDF is active for this parameter
            const kdfSelect = document.getElementById(`${paramType}-kdf`);
            const hasKdfActive = kdfSelect && kdfSelect.value && kdfSelect.value !== '';

            if (!isNeeded) {
                // Parameter not needed - disable the field
                clearValidation(paramInput);
                paramInput.classList.add('input-disabled');
            } else if (hasKdfActive) {
                // KDF is active - size validation doesn't apply (password can be any length)
                clearValidation(paramInput);
            } else if (paramInput.value) {
                // Parameter is needed and has content - validate format and size
                const paramFormat = this.getActiveFormatForParameter(paramInput);

                try {
                    const paramBytes = this.parseInputByFormat(paramInput.value, paramFormat);
                    const isValidSize = this.isValidParameterSize(algorithm, paramType, paramBytes.length);

                    clearValidation(paramInput);
                    if (!isValidSize) {
                        paramInput.classList.add('input-invalid');
                    }
                } catch (e) {
                    // Invalid format - show as invalid
                    clearValidation(paramInput);
                    paramInput.classList.add('input-invalid');
                }
            } else {
                // Parameter needed but empty - clear validation (don't mark as invalid when empty)
                clearValidation(paramInput);
            }
        });

        // Validate INPUT field (only if no padding is selected)
        const paddingValue = paddingSelect ? paddingSelect.value : '';
        if (!paddingValue && inputText.value) {
            const inputFormat = document.querySelector('.input-section .format-tab.active')?.getAttribute('data-format') || 'text';
            let inputBytes;

            try {
                inputBytes = this.parseInputByFormat(inputText.value, inputFormat);
                const isValidInputSize = this.isValidInputSize(algorithm, inputBytes.length);

                clearValidation(inputText);
                if (!isValidInputSize) {
                    inputText.classList.add('input-invalid');
                }
            } catch (e) {
                // Invalid format - show as invalid
                clearValidation(inputText);
                inputText.classList.add('input-invalid');
            }
        } else {
            clearValidation(inputText);
        }
    }

    /**
     * GENERALIZED: Get the active format for a data parameter field
     * Uses the data-control structure to find the active tab
     */
    getActiveFormatForParameter(textarea) {
        const dataControl = textarea.closest('.data-control, .controls-section');
        if (!dataControl) return 'text';

        const activeTab = dataControl.querySelector('.data-control-tabs .format-tab.active, .format-tab-small.active');
        return activeTab?.getAttribute('data-format') || 'text';
    }

    /**
     * GENERALIZED: Check if algorithm needs a specific parameter
     * @param {Algorithm} algorithm - The algorithm object
     * @param {string} parameterType - The parameter type (key, iv, salt, nonce, pepper)
     * @param {string} modeName - The cipher mode name (for block ciphers)
     * @returns {boolean} - True if the parameter is required
     */
    algorithmNeedsParameter(algorithm, parameterType, modeName = '') {
        const category = algorithm.category;

        switch (parameterType) {
            case 'key':
                return this.algorithmNeedsKey(algorithm);
            case 'iv':
                return this.algorithmNeedsIV(algorithm, modeName);
            case 'salt':
                // Salt is used by hash functions and KDFs
                return category === AlgorithmFramework.CategoryType.HASH ||
                       category === AlgorithmFramework.CategoryType.KDF;
            case 'nonce':
                // Nonce is used by stream ciphers and AEAD
                return category === AlgorithmFramework.CategoryType.STREAM ||
                       category === AlgorithmFramework.CategoryType.AEAD;
            case 'pepper':
                // Pepper is optional for password hashing (KDF)
                return category === AlgorithmFramework.CategoryType.KDF;
            default:
                return false;
        }
    }

    /**
     * GENERALIZED: Validate parameter size against algorithm requirements
     * @param {Algorithm} algorithm - The algorithm object
     * @param {string} parameterType - The parameter type
     * @param {number} size - The byte size to validate
     * @returns {boolean} - True if size is valid
     */
    isValidParameterSize(algorithm, parameterType, size) {
        switch (parameterType) {
            case 'key':
                return this.isValidKeySize(algorithm, size);
            case 'iv':
                return this.isValidIVSize(algorithm, size);
            case 'salt':
            case 'nonce':
            case 'pepper':
                // For salt/nonce/pepper, any reasonable size is acceptable (1-256 bytes)
                return size >= 1 && size <= 256;
            default:
                return true;
        }
    }

    /**
     * Update block visibility based on selected algorithm
     * Shows/hides Mode, Padding, Key, IV, Salt, Nonce, Pepper blocks dynamically
     */
    updateBlockVisibility() {
        const algorithmSelect = document.getElementById('selected-algorithm');
        const algorithmName = algorithmSelect?.value;
        const modeSelect = document.getElementById('cipher-mode');
        const modeName = modeSelect?.value || '';

        // Get all block elements
        const modeBlock = document.getElementById('mode-block');
        const paddingBlock = document.getElementById('padding-block');
        const keyBlock = document.getElementById('key-block');
        const ivBlock = document.getElementById('iv-block');
        const saltBlock = document.getElementById('salt-block');
        const nonceBlock = document.getElementById('nonce-block');
        const pepperBlock = document.getElementById('pepper-block');

        // If no algorithm selected, hide all optional blocks
        if (!algorithmName) {
            if (modeBlock) modeBlock.style.display = 'none';
            if (paddingBlock) paddingBlock.style.display = 'none';
            if (keyBlock) keyBlock.style.display = 'none';
            if (ivBlock) ivBlock.style.display = 'none';
            if (saltBlock) saltBlock.style.display = 'none';
            if (nonceBlock) nonceBlock.style.display = 'none';
            if (pepperBlock) pepperBlock.style.display = 'none';
            return;
        }

        // Find algorithm
        const algorithm = AlgorithmFramework.Algorithms.find(a => a.name === algorithmName);
        if (!algorithm) {
            // Hide all if algorithm not found
            if (modeBlock) modeBlock.style.display = 'none';
            if (paddingBlock) paddingBlock.style.display = 'none';
            if (keyBlock) keyBlock.style.display = 'none';
            if (ivBlock) ivBlock.style.display = 'none';
            if (saltBlock) saltBlock.style.display = 'none';
            if (nonceBlock) nonceBlock.style.display = 'none';
            if (pepperBlock) pepperBlock.style.display = 'none';
            return;
        }

        const category = algorithm.category;

        // Determine visibility based on category and actual needs
        const showMode = category === AlgorithmFramework.CategoryType.BLOCK;
        const showPadding = category === AlgorithmFramework.CategoryType.BLOCK;
        const showKey = this.algorithmNeedsKey(algorithm);
        const showIV = this.algorithmNeedsIV(algorithm, modeName);
        const showSalt = category === AlgorithmFramework.CategoryType.HASH || category === AlgorithmFramework.CategoryType.KDF;
        const showNonce = category === AlgorithmFramework.CategoryType.STREAM || category === AlgorithmFramework.CategoryType.AEAD;
        const showPepper = category === AlgorithmFramework.CategoryType.KDF;

        // Apply visibility
        if (modeBlock) modeBlock.style.display = showMode ? '' : 'none';
        if (paddingBlock) paddingBlock.style.display = showPadding ? '' : 'none';
        if (keyBlock) keyBlock.style.display = showKey ? '' : 'none';
        if (ivBlock) ivBlock.style.display = showIV ? '' : 'none';
        if (saltBlock) saltBlock.style.display = showSalt ? '' : 'none';
        if (nonceBlock) nonceBlock.style.display = showNonce ? '' : 'none';
        if (pepperBlock) pepperBlock.style.display = showPepper ? '' : 'none';

        DebugConfig.log(`🔍 Block visibility updated for ${algorithmName} (${category.name}): Mode=${showMode}, Padding=${showPadding}, Key=${showKey}, IV=${showIV}, Salt=${showSalt}, Nonce=${showNonce}, Pepper=${showPepper}`);
    }

    /**
     * Update action buttons (encrypt/decrypt) based on algorithm type
     * Hides decrypt for one-way algorithms, relabels for non-ciphers
     */
    updateActionButtons() {
        const algorithmSelect = document.getElementById('selected-algorithm');
        const algorithmName = algorithmSelect?.value;
        const encryptBtn = document.getElementById('encrypt-btn');
        const decryptBtn = document.getElementById('decrypt-btn');

        if (!encryptBtn || !decryptBtn) return;

        // Default state
        if (!algorithmName) {
            encryptBtn.innerHTML = '🔒 Encrypt';
            encryptBtn.style.display = '';
            decryptBtn.style.display = '';
            return;
        }

        // Find algorithm
        const algorithm = AlgorithmFramework.Algorithms.find(a => a.name === algorithmName);
        if (!algorithm) {
            encryptBtn.innerHTML = '🔒 Encrypt';
            encryptBtn.style.display = '';
            decryptBtn.style.display = '';
            return;
        }

        const category = algorithm.category;

        // Determine button state based on category
        const isCipher = category === AlgorithmFramework.CategoryType.BLOCK ||
                         category === AlgorithmFramework.CategoryType.STREAM ||
                         category === AlgorithmFramework.CategoryType.ASYMMETRIC ||
                         category === AlgorithmFramework.CategoryType.AEAD;

        if (isCipher) {
            // Two-way ciphers: show both encrypt and decrypt
            encryptBtn.innerHTML = '🔒 Encrypt';
            decryptBtn.style.display = '';
        } else {
            // One-way algorithms: hide decrypt, relabel encrypt
            decryptBtn.style.display = 'none';

            // Choose appropriate label based on category
            if (category === AlgorithmFramework.CategoryType.HASH) {
                encryptBtn.innerHTML = '#️⃣ Hash';
            } else if (category === AlgorithmFramework.CategoryType.MAC) {
                encryptBtn.innerHTML = '✅ Compute MAC';
            } else if (category === AlgorithmFramework.CategoryType.KDF) {
                encryptBtn.innerHTML = '🔑 Derive Key';
            } else if (category === AlgorithmFramework.CategoryType.CHECKSUM) {
                encryptBtn.innerHTML = '✔️ Checksum';
            } else if (category === AlgorithmFramework.CategoryType.ENCODING) {
                encryptBtn.innerHTML = '📝 Encode';
            } else if (category === AlgorithmFramework.CategoryType.COMPRESSION) {
                encryptBtn.innerHTML = '🗜️ Compress';
            } else if (category === AlgorithmFramework.CategoryType.ECC) {
                encryptBtn.innerHTML = '🔧 Encode';
            } else {
                encryptBtn.innerHTML = '⚡ Transform';
            }
        }

        DebugConfig.log(`🔘 Action buttons updated for ${algorithmName}: ${encryptBtn.innerHTML}, decrypt=${decryptBtn.style.display !== 'none'}`);
    }

    /**
     * Helper: Parse input string by format (text/hex/base64)
     */
    parseInputByFormat(value, format) {
        switch (format) {
            case 'text':
                return Array.from(new TextEncoder().encode(value));
            case 'hex':
                return this.hexToBytes(value);
            case 'base64':
                return Array.from(atob(value)).map(c => c.charCodeAt(0));
            default:
                return Array.from(new TextEncoder().encode(value));
        }
    }

    /**
     * Determine if algorithm needs a key based on its category
     */
    algorithmNeedsKey(algorithm) {
        if (!algorithm || !algorithm.category) return false;

        // Categories that don't need keys
        const noKeyCategories = [
            'HASH',
            'CHECKSUM',
            'ENCODING'
        ];

        return !noKeyCategories.includes(algorithm.category);
    }

    /**
     * Determine if algorithm needs an IV based on category and cipher mode
     */
    algorithmNeedsIV(algorithm, modeName) {
        if (!algorithm || !algorithm.category) return false;

        // Categories that might need IV
        const ivCategories = ['BLOCK', 'STREAM', 'AEAD'];

        if (!ivCategories.includes(algorithm.category)) {
            return false; // Other categories don't use IV
        }

        // Modes that require IV
        const ivModes = ['CBC', 'CFB', 'OFB', 'CTR', 'GCM', 'EAX', 'CCM', 'SIV', 'IGE'];

        // Stream ciphers typically need IV/nonce
        if (algorithm.category === 'STREAM') {
            return true;
        }

        // AEAD ciphers need IV/nonce
        if (algorithm.category === 'AEAD') {
            return true;
        }

        // Block ciphers need IV only in certain modes
        if (algorithm.category === 'BLOCK') {
            return modeName && ivModes.includes(modeName);
        }

        return false;
    }

    /**
     * Validate IV size for the selected algorithm
     */
    isValidIVSize(algorithm, ivSize) {
        // Check if algorithm has SupportedBlockSizes (IV usually matches block size)
        if (algorithm.SupportedBlockSizes && algorithm.SupportedBlockSizes.length > 0) {
            for (const blockSize of algorithm.SupportedBlockSizes) {
                if (ivSize >= blockSize.minSize && ivSize <= blockSize.maxSize) {
                    // Check if size matches step requirement
                    if (blockSize.step) {
                        return (ivSize - blockSize.minSize) % blockSize.step === 0;
                    }
                    return true;
                }
            }
            return false;
        }

        // If no specific IV size requirements, allow any size
        return true;
    }

    /**
     * Check if key size is valid for the selected algorithm
     */
    isValidKeySize(algorithm, keySize) {
        if (!algorithm.SupportedKeySizes || algorithm.SupportedKeySizes.length === 0) {
            return true; // Algorithm doesn't specify key size restrictions
        }

        // Check against all supported key sizes
        for (const keyRange of algorithm.SupportedKeySizes) {
            if (keySize >= keyRange.minSize && keySize <= keyRange.maxSize) {
                // Check step/increment
                if (keyRange.stepSize) {
                    if ((keySize - keyRange.minSize) % keyRange.stepSize === 0) {
                        return true;
                    }
                } else {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if input size is valid for the selected algorithm (when no padding)
     */
    isValidInputSize(algorithm, inputSize) {
        if (!algorithm.SupportedBlockSizes || algorithm.SupportedBlockSizes.length === 0) {
            return true; // Algorithm doesn't specify block size restrictions
        }

        // For block ciphers, input must be a multiple of block size when no padding
        for (const blockRange of algorithm.SupportedBlockSizes) {
            if (blockRange.minSize > 0 && inputSize % blockRange.minSize === 0) {
                return true;
            }
        }

        return false;
    }
    /**
     * Perform encryption operation
     */
    async performEncryption() {
        try {
            const result = await this.performCipherOperation('encrypt');
            this.displayCipherResult(result);
        } catch (error) {
            DebugConfig.error('Encryption error:', error);
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
            DebugConfig.error('Decryption error:', error);
            alert('Decryption failed: ' + error.message);
        }
    }
    
    /**
     * Perform cipher operation (encrypt or decrypt)
     */
    async performCipherOperation(operation) {
        try {
            // Get input values
            const algorithmName = document.getElementById('selected-algorithm').value;
            const inputText = document.getElementById('input-text').value;
            const cipherKey = document.getElementById('cipher-key').value;
            const modeName = document.getElementById('cipher-mode').value;
            const paddingName = document.getElementById('cipher-padding').value;

            // Validation
            if (!algorithmName) {
                throw new Error('❌ Please select an algorithm from the dropdown.\n\n💡 Tip: Choose a cipher like "Rijndael (AES)" or "ChaCha20"');
            }

            // Allow empty input if padding is selected (padding will handle it)
            if (!inputText && !paddingName) {
                throw new Error(`❌ Please enter ${operation === 'encrypt' ? 'plaintext' : 'ciphertext'} to ${operation}.\n\n💡 Tip: You can type text, paste hex, or drag & drop a file. Or select padding to encrypt empty data.`);
            }

            // Find algorithm
            const algorithm = AlgorithmFramework.Algorithms.find(a => a.name === algorithmName);
            if (!algorithm) {
                throw new Error(`❌ Algorithm "${algorithmName}" not found.\n\n💡 Tip: Try reloading the page if algorithms aren't loading.`);
            }

            // Convert input based on current format
            const inputFormat = document.querySelector('.input-section .format-tab.active')?.getAttribute('data-format') || 'text';
            let inputBytes;

            try {
                // Handle empty input (will be padded if padding is selected)
                if (!inputText || inputText.trim() === '') {
                    inputBytes = [];
                } else {
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
                }
            } catch (error) {
                throw new Error(`❌ Invalid ${inputFormat} format in input.\n\n💡 Tip: Make sure your input matches the selected format (Text/Hex/Base64).`);
            }

            // Get key bytes if provided
            let keyBytes = null;
            if (cipherKey) {
                const keyFormat = document.querySelector('.key-format-tabs .format-tab.active')?.getAttribute('data-format') || 'text';
                try {
                    switch (keyFormat) {
                        case 'text':
                            keyBytes = Array.from(new TextEncoder().encode(cipherKey));
                            break;
                        case 'hex':
                            keyBytes = this.hexToBytes(cipherKey);
                            break;
                        case 'base64':
                            keyBytes = Array.from(atob(cipherKey)).map(c => c.charCodeAt(0));
                            break;
                    }
                } catch (error) {
                    throw new Error(`❌ Invalid ${keyFormat} format in key.\n\n💡 Tip: Switch key format to match your key data (Text/Hex/Base64).`);
                }

                // Apply KDF if selected
                keyBytes = await this.deriveDataWithKdf(keyBytes, 'key');
            }

            // Create algorithm instance
            let instance = algorithm.CreateInstance(operation === 'decrypt');
            if (!instance) {
                throw new Error(`❌ Cannot create ${operation === 'decrypt' ? 'decryption' : 'encryption'} instance for ${algorithmName}.\n\n💡 Tip: This algorithm may not support ${operation === 'decrypt' ? 'decryption' : 'encryption'}.`);
            }

            // Apply mode if selected
            if (modeName && modeName !== '') {
                const modeAlgorithm = AlgorithmFramework.Algorithms.find(a => a.name === modeName);
                if (modeAlgorithm) {
                    const modeInstance = modeAlgorithm.CreateInstance(operation === 'decrypt');
                    if (modeInstance && modeInstance.setCipher) {
                        modeInstance.setCipher(instance);
                        instance = modeInstance; // Use mode instance instead
                    }
                }
            }

            // Apply padding if selected and encrypting
            let paddingInstance = null;
            if (paddingName && paddingName !== '' && operation === 'encrypt') {
                const paddingAlgorithm = AlgorithmFramework.Algorithms.find(a => a.name === paddingName);
                if (paddingAlgorithm) {
                    paddingInstance = paddingAlgorithm.CreateInstance(false);
                    if (paddingInstance && paddingInstance.setBlockSize && algorithm.SupportedBlockSizes && algorithm.SupportedBlockSizes.length > 0) {
                        const blockSize = algorithm.SupportedBlockSizes[0].minSize;
                        paddingInstance.setBlockSize(blockSize);
                    }
                }
            }

            // Set key if provided and supported
            if (keyBytes && instance.key !== undefined) {
                try {
                    instance.key = keyBytes;
                } catch (error) {
                    // Extract supported key sizes for helpful error message
                    let helpMessage = '';
                    if (algorithm.SupportedKeySizes && algorithm.SupportedKeySizes.length > 0) {
                        const keySizes = algorithm.SupportedKeySizes.map(ks => {
                            if (ks.minSize === ks.maxSize) {
                                return `${ks.minSize} bytes`;
                            } else {
                                return `${ks.minSize}-${ks.maxSize} bytes`;
                            }
                        }).join(', ');
                        helpMessage = `\n\n✅ Supported key sizes for ${algorithmName}: ${keySizes}\n📏 Your key size: ${keyBytes.length} bytes\n\n💡 Tip: Adjust your key to match one of the supported sizes, or switch the key format (Text/Hex/Base64).`;
                    }
                    throw new Error(`❌ Invalid key size for ${algorithmName}.${helpMessage}`);
                }
            } else if (!keyBytes && instance.key !== undefined && algorithm.SupportedKeySizes && algorithm.SupportedKeySizes.length > 0) {
                // Algorithm requires a key but none was provided
                const keySizes = algorithm.SupportedKeySizes.map(ks => {
                    if (ks.minSize === ks.maxSize) {
                        return `${ks.minSize} bytes`;
                    } else {
                        return `${ks.minSize}-${ks.maxSize} bytes`;
                    }
                }).join(', ');
                throw new Error(`❌ ${algorithmName} requires a key.\n\n✅ Supported key sizes: ${keySizes}\n\n💡 Tip: Enter a key in the "Key" field and select the appropriate format.`);
            }

            // Apply padding to input if encrypting
            if (paddingInstance && operation === 'encrypt') {
                try {
                    paddingInstance.Feed(inputBytes);
                    inputBytes = paddingInstance.Result();

                    // Validate padding produced output
                    if (!inputBytes || inputBytes.length === 0) {
                        throw new Error(`❌ Padding "${paddingName}" failed to produce output.\n\n💡 Tip: Try a different padding scheme like "PKCS#7" or ensure input data is valid.`);
                    }
                } catch (error) {
                    if (error.message.includes('❌')) {
                        throw error; // Re-throw our formatted error
                    }
                    throw new Error(`❌ Padding "${paddingName}" failed: ${error.message}\n\n💡 Tip: Check that the selected padding is compatible with ${algorithmName}.`);
                }
            }

            // For algorithms that require data, ensure we have some
            // Some ciphers accept zero-length input, but many require at least one block
            if ((!inputBytes || inputBytes.length === 0) && !paddingInstance) {
                // No padding and no input - try to encrypt anyway (algorithm will decide if it's valid)
                inputBytes = [];
            }

            // Perform operation
            let outputBytes;
            try {
                instance.Feed(inputBytes);
                outputBytes = instance.Result();

                // Validate we got output
                if (!outputBytes) {
                    outputBytes = [];
                }
            } catch (error) {
                if (error.message.includes('❌')) {
                    throw error; // Re-throw our formatted error
                }

                // Check if it's a "no data fed" error
                if (error.message.toLowerCase().includes('no data') || error.message.toLowerCase().includes('not fed')) {
                    if (inputBytes && inputBytes.length > 0) {
                        throw new Error(`❌ ${algorithmName} rejected the input data.\n\n💡 Tip: Some algorithms require specific block sizes. Try selecting a padding scheme like "PKCS#7".`);
                    } else {
                        throw new Error(`❌ ${algorithmName} requires input data.\n\n💡 Tip: Enter some text to encrypt, or select a padding scheme to encrypt zero-length data.`);
                    }
                }

                throw new Error(`❌ ${operation === 'encrypt' ? 'Encryption' : 'Decryption'} failed: ${error.message}\n\n💡 Tip: Check your input data and algorithm settings.`);
            }

            // Remove padding if decrypting
            if (paddingName && paddingName !== '' && operation === 'decrypt') {
                const paddingAlgorithm = AlgorithmFramework.Algorithms.find(a => a.name === paddingName);
                if (paddingAlgorithm) {
                    const unpaddingInstance = paddingAlgorithm.CreateInstance(true);
                    if (unpaddingInstance && unpaddingInstance.setBlockSize && algorithm.SupportedBlockSizes && algorithm.SupportedBlockSizes.length > 0) {
                        const blockSize = algorithm.SupportedBlockSizes[0].minSize;
                        unpaddingInstance.setBlockSize(blockSize);
                    }
                    if (unpaddingInstance) {
                        unpaddingInstance.Feed(outputBytes);
                        outputBytes = unpaddingInstance.Result();
                    }
                }
            }

            return {
                bytes: outputBytes,
                operation: operation,
                algorithm: algorithmName
            };
        } catch (error) {
            // Re-throw with stack trace preserved
            throw error;
        }
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
        // Clear basic fields
        document.getElementById('input-text').value = '';
        document.getElementById('output-text').value = '';
        document.getElementById('selected-algorithm').value = '';
        document.getElementById('cipher-mode').value = '';
        document.getElementById('cipher-padding').value = '';

        // Clear all data parameter fields (key, iv, salt, nonce, pepper)
        const parameterTypes = ['key', 'iv', 'salt', 'nonce', 'pepper'];

        parameterTypes.forEach(paramType => {
            // Clear data input
            const dataField = document.getElementById(`cipher-${paramType}`);
            if (dataField) dataField.value = '';

            // Clear KDF selector
            const kdfSelect = document.getElementById(`${paramType}-kdf`);
            if (kdfSelect) kdfSelect.value = '';

            // Clear KDF parameters for this parameter type
            const kdfSalt = document.getElementById(`${paramType}-kdf-salt`);
            const kdfIterations = document.getElementById(`${paramType}-kdf-iterations`);
            const kdfInfo = document.getElementById(`${paramType}-kdf-info`);
            const kdfHash = document.getElementById(`${paramType}-kdf-hash`);
            const kdfN = document.getElementById(`${paramType}-kdf-n`);
            const kdfR = document.getElementById(`${paramType}-kdf-r`);
            const kdfP = document.getElementById(`${paramType}-kdf-p`);
            const kdfOutputSize = document.getElementById(`${paramType}-kdf-output-size`);

            if (kdfSalt) kdfSalt.value = '';
            if (kdfIterations) kdfIterations.value = '10000';
            if (kdfInfo) kdfInfo.value = '';
            if (kdfHash) kdfHash.value = 'SHA256';
            if (kdfN) kdfN.value = '16';
            if (kdfR) kdfR.value = '1';
            if (kdfP) kdfP.value = '1';

            // Set default output sizes based on parameter type
            if (kdfOutputSize) {
                if (paramType === 'key') kdfOutputSize.value = '32';
                else if (paramType === 'iv') kdfOutputSize.value = '16';
                else if (paramType === 'nonce') kdfOutputSize.value = '12';
                else kdfOutputSize.value = '16';
            }

            // Hide KDF parameters for this parameter type
            this.updateKdfParameterVisibility(paramType);
        });
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
        
        // Group algorithms by category key
        algorithms.forEach(algorithm => {
            let categoryKey = 'other';
            let categoryName = '❓ Other';
            
            if (algorithm.category) {
                // Find the category key from AlgorithmFramework.CategoryType
                const foundKey = Object.keys(AlgorithmFramework.CategoryType).find(key => 
                    AlgorithmFramework.CategoryType[key] === algorithm.category
                );
                if (foundKey) {
                    categoryKey = foundKey.toLowerCase();
                    const categoryType = AlgorithmFramework.CategoryType[foundKey];
                    categoryName = `${categoryType.icon} ${categoryType.name}`;
                }
            }
            
            if (!algorithmsByCategory[categoryKey]) {
                algorithmsByCategory[categoryKey] = {
                    name: categoryName,
                    algorithms: []
                };
            }
            algorithmsByCategory[categoryKey].algorithms.push(algorithm);
        });
        
        // Clear existing content
        palette.innerHTML = '';
        
        // Create draggable algorithm items by category
        Object.keys(algorithmsByCategory).sort().forEach(categoryKey => {
            const categoryData = algorithmsByCategory[categoryKey];
            const categorySection = document.createElement('div');
            categorySection.className = 'palette-category';
            categorySection.setAttribute('data-category', categoryKey);
            
            const categoryHeader = document.createElement('h5');
            categoryHeader.textContent = categoryData.name;
            categoryHeader.className = 'palette-category-header';
            
            // Set category color for the header and section
            if (categoryKey !== 'other') {
                const foundKey = Object.keys(AlgorithmFramework.CategoryType).find(key => 
                    key.toLowerCase() === categoryKey
                );
                if (foundKey) {
                    const categoryColor = AlgorithmFramework.CategoryType[foundKey].color;
                    categoryHeader.style.setProperty('--category-color', categoryColor);
                    categorySection.style.setProperty('--category-color', categoryColor);
                }
            }
            
            categorySection.appendChild(categoryHeader);
            
            const algorithmsContainer = document.createElement('div');
            algorithmsContainer.className = 'palette-algorithms';
            
            categoryData.algorithms
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(algorithm => {
                    const algorithmEl = document.createElement('div');
                    algorithmEl.className = 'palette-algorithm';
                    algorithmEl.textContent = algorithm.name;
                    algorithmEl.setAttribute('data-algorithm', algorithm.name);
                    algorithmEl.setAttribute('data-category', algorithm.category);
                    algorithmEl.draggable = true;
                    
                    // Set category color directly
                    if (algorithm.category) {
                        const foundKey = Object.keys(AlgorithmFramework.CategoryType).find(key => 
                            AlgorithmFramework.CategoryType[key] === algorithm.category
                        );
                        if (foundKey) {
                            const categoryColor = AlgorithmFramework.CategoryType[foundKey].color;
                            algorithmEl.style.setProperty('--category-color', categoryColor);
                            algorithmEl.style.backgroundColor = categoryColor;
                            algorithmEl.style.borderColor = categoryColor;
                            DebugConfig.log(`Setting color for ${algorithm.name}: ${categoryColor}`);
                        }
                    }
                    
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
        
        DebugConfig.log('📋 Populated algorithm palette with', algorithms.length, 'algorithms');
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
                DebugConfig.error('Drop data parsing error:', error);
            }
        });
        
        DebugConfig.log('✅ Drag and drop setup complete');
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
            DebugConfig.error('Algorithm not found:', algorithmData.algorithm);
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
        
        DebugConfig.log('Created node:', nodeId, nodeData);
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
            DebugConfig.log('Started connection from:', nodeId, portType, portIndex);
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
        
        DebugConfig.log('Created connection:', connectionId, connectionData);
    }
    
    /**
     * Draw a visual connection line between nodes
     */
    drawConnection(connectionData) {
        // This would typically use SVG or Canvas for drawing lines
        // For now, we'll log that the connection was made
        DebugConfig.log('Drawing connection line between:', connectionData.from, 'and', connectionData.to);
        
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
        
        DebugConfig.log('Removed node:', nodeId);
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
        DebugConfig.log('✅ Canvas cleared');
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
        DebugConfig.log('✅ Test nodes added');
    }
    
    /**
     * Get algorithm parameters for node setup
     * Category should always be a CategoryType object from AlgorithmFramework
     */
    getAlgorithmParameters(algorithm) {
        // Basic parameter detection - could be enhanced
        const parameters = [];

        if (!algorithm.category) return parameters;

        // Most block ciphers need a key
        if (algorithm.category === AlgorithmFramework.CategoryType.BLOCK) {
            parameters.push('key');
        }

        // Stream ciphers often need a key and nonce/IV
        if (algorithm.category === AlgorithmFramework.CategoryType.STREAM) {
            parameters.push('key', 'nonce');
        }

        // Hash functions typically don't need parameters
        if (algorithm.category === AlgorithmFramework.CategoryType.HASH) {
            // No parameters needed
        }

        return parameters;
    }
    
    /**
     * Setup algorithm palette tabs with dynamic category buttons
     */
    setupAlgorithmTabs() {
        const tabsContainer = document.querySelector('.palette-tabs');
        if (!tabsContainer) return;
        
        // Clear existing tabs
        tabsContainer.innerHTML = '';
        
        // Create "All" tab
        const allTab = document.createElement('button');
        allTab.className = 'palette-tab active';
        allTab.setAttribute('data-category', 'all');
        allTab.innerHTML = '🌟 All Algorithms';
        tabsContainer.appendChild(allTab);
        
        // Get categories from AlgorithmFramework and create tabs
        const categories = Object.keys(AlgorithmFramework.CategoryType).sort((a, b) => {
            const nameA = AlgorithmFramework.CategoryType[a].name;
            const nameB = AlgorithmFramework.CategoryType[b].name;
            return nameA.localeCompare(nameB);
        });
        
        categories.forEach(categoryKey => {
            const categoryType = AlgorithmFramework.CategoryType[categoryKey];
            const tab = document.createElement('button');
            tab.className = 'palette-tab';
            tab.setAttribute('data-category', categoryKey.toLowerCase());
            tab.innerHTML = `${categoryType.icon} ${categoryType.name}`;
            
            // Apply category color as CSS custom property
            tab.style.setProperty('--category-color', categoryType.color);
            
            tabsContainer.appendChild(tab);
        });
        
        // Setup event listeners for all tabs
        const tabs = tabsContainer.querySelectorAll('.palette-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.getAttribute('data-category');
                this.switchAlgorithmCategory(category);
                
                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });
        
        // Load initial category
        this.switchAlgorithmCategory('all');
        
        DebugConfig.log(`🎨 Created ${categories.length + 1} palette category tabs`);
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
        
        DebugConfig.log('Switched to algorithm category:', category);
    }
    
    /**
     * Execute the current algorithm chain
     */
    executeChain() {
        DebugConfig.log('🚀 Executing algorithm chain...');
        
        if (!this.chainBuilder) {
            alert('Chain builder not initialized');
            return;
        }
        
        try {
            // Get chain expression
            const chainExpression = this.buildChainExpression();
            DebugConfig.log('Chain expression:', chainExpression);
            
            // Display chain expression
            this.displayChainExpression(chainExpression);
            
            // Execute if we have valid chain
            if (chainExpression && chainExpression !== 'data') {
                const result = this.executeChainExpression(chainExpression);
                DebugConfig.log('Chain execution result:', result);
            }
            
        } catch (error) {
            DebugConfig.error('Chain execution error:', error);
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
        DebugConfig.log('Executing chain:', expression);
        
        // For now, just return the expression as a demonstration
        return {
            expression: expression,
            status: 'simulated',
            result: 'Chain execution would run here'
        };
    }

    /**
     * Run tests and switch to test vectors tab using TestEngine
     */
    async runTestAndSwitchToTestVectors(algorithmName) {
        DebugConfig.log(`Running tests and switching to test vectors for ${algorithmName}`);

        if (typeof TestEngine === 'undefined') {
            alert('Testing framework not initialized. Please reload the page.');
            return;
        }

        try {
            // Get the algorithm
            const algorithm = this.getAlgorithm(algorithmName);
            if (!algorithm) {
                throw new Error(`Algorithm not found: ${algorithmName}`);
            }

            // Run test using TestEngine
            await this.runAlgorithmTests(algorithm);

            // Switch to metadata modal and show test vectors tab
            this.showMetadata(algorithmName);

            // Wait a moment for modal to open, then switch to test vectors tab
            setTimeout(() => {
                if (this.algorithmDetails) {
                    this.algorithmDetails.switchTab('test-vectors');
                }
            }, 100);

        } catch (error) {
            DebugConfig.error(`Test execution failed for ${algorithmName}:`, error);
            alert(`Test failed: ${error.message}`);
        }
    }

}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    DebugConfig.log('🔗 Window loaded, checking AlgorithmFramework...');
    
    if (typeof AlgorithmFramework !== 'undefined') {
        DebugConfig.log('AlgorithmFramework available:', !!AlgorithmFramework);
        DebugConfig.log('🔢 Initial algorithm count:', AlgorithmFramework.Algorithms.length);
    }
    
    // Add a small delay to ensure all cipher registrations are complete
    setTimeout(() => {
        DebugConfig.log('⏰ Starting controller initialization...');
        if (typeof AlgorithmFramework !== 'undefined') {
            DebugConfig.log('🔢 Algorithm count after delay:', AlgorithmFramework.Algorithms.length);
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
