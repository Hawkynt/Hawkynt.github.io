/**
 * Algorithm Details Modal Component
 * Displays comprehensive algorithm information in a modal dialog
 * (c)2006-2025 Hawkynt
 */

class AlgorithmDetails {
    constructor(options = {}) {
        this.options = {
            onClose: null,
            showKeyboardShortcuts: true,
            autoHighlightCode: true,
            ...options
        };
        this.element = null;
        this.currentAlgorithm = null;
        this.activeTab = 'info';
    }

    /**
     * Show the modal with algorithm details
     */
    show(algorithm) {
        try {
            this.currentAlgorithm = algorithm;
            
            if (!this.element) {
                this.createElement();
                document.body.appendChild(this.element);
            }
            
            this.populateContent();
            this.element.classList.add('visible');
            
            // Make instance globally accessible for onclick handlers
            window.algorithmDetailsInstance = this;
            
            // Focus management for accessibility
            this.element.focus();
        } catch (error) {
            DebugConfig.error('Error showing algorithm details modal:', error);
            DebugConfig.error('Algorithm:', algorithm ? algorithm.name : 'undefined');
            
            // Try to show a fallback error modal
            try {
                if (!this.element) {
                    this.createElement();
                    document.body.appendChild(this.element);
                }
                
                const content = this.element.querySelector('.algorithm-details-content');
                if (content) {
                    content.innerHTML = `
                        <div class="error-modal">
                            <h2>Error Loading Algorithm Details</h2>
                            <p>Sorry, there was an error loading the details for this algorithm.</p>
                            <p><strong>Algorithm:</strong> ${algorithm ? algorithm.name : 'Unknown'}</p>
                            <p><strong>Error:</strong> ${error.message}</p>
                            <button onclick="window.algorithmDetailsInstance.hide()" class="btn btn-primary">Close</button>
                        </div>
                    `;
                }
                
                this.element.classList.add('visible');
                window.algorithmDetailsInstance = this;
                this.element.focus();
            } catch (fallbackError) {
                DebugConfig.error('Even the fallback modal failed:', fallbackError);
                alert('Error loading algorithm details: ' + error.message);
            }
        }
    }

    /**
     * Hide the modal
     */
    hide() {
        if (this.element) {
            this.element.classList.remove('visible');
        }
        
        if (this.options.onClose) {
            this.options.onClose();
        }
    }

    /**
     * Create the modal DOM structure
     */
    createElement() {
        const modal = document.createElement('div');
        modal.className = 'algorithm-details-modal';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'modal-title');
        modal.setAttribute('aria-modal', 'true');
        
        modal.innerHTML = `
            <div class="algorithm-details-content">
                <div class="algorithm-details-header">
                    <h2 class="algorithm-details-title" id="modal-title">Algorithm Details</h2>
                    <button class="algorithm-details-close" aria-label="Close modal">&times;</button>
                </div>
                <div class="algorithm-details-tabs" role="tablist">
                    <button class="algorithm-details-tab active" role="tab" data-tab="info" aria-selected="true">📋 Info</button>
                    <button class="algorithm-details-tab" role="tab" data-tab="references" aria-selected="false">📚 References</button>
                    <button class="algorithm-details-tab" role="tab" data-tab="test-vectors" aria-selected="false">🧪 Test Vectors</button>
                    <button class="algorithm-details-tab" role="tab" data-tab="code" aria-selected="false">💻 Code</button>
                </div>
                <div class="algorithm-details-body">
                    <div class="tab-content active" id="tab-info" role="tabpanel" aria-labelledby="tab-info-button">
                        <!-- Info content will be populated here -->
                    </div>
                    <div class="tab-content" id="tab-references" role="tabpanel" aria-labelledby="tab-references-button">
                        <!-- References content will be populated here -->
                    </div>
                    <div class="tab-content" id="tab-test-vectors" role="tabpanel" aria-labelledby="tab-test-vectors-button">
                        <!-- Test vectors content will be populated here -->
                    </div>
                    <div class="tab-content" id="tab-code" role="tabpanel" aria-labelledby="tab-code-button">
                        <!-- Code content will be populated here -->
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners(modal);
        this.element = modal;
        return modal;
    }

    /**
     * Setup event listeners for modal interactions
     */
    setupEventListeners(modal) {
        // Close button
        const closeBtn = modal.querySelector('.algorithm-details-close');
        closeBtn.addEventListener('click', () => this.hide());

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hide();
            }
        });

        // Tab switching
        const tabButtons = modal.querySelectorAll('.algorithm-details-tab');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Keyboard shortcuts
        if (this.options.showKeyboardShortcuts) {
            document.addEventListener('keydown', this.handleKeyboard.bind(this));
        }
    }

    /**
     * Handle keyboard navigation
     */
    handleKeyboard(e) {
        if (!this.element || !this.element.classList.contains('visible')) return;

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                this.hide();
                break;
            case '1':
            case '2':
            case '3':
            case '4':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    const tabs = ['info', 'references', 'test-vectors', 'code'];
                    const tabIndex = parseInt(e.key) - 1;
                    if (tabs[tabIndex]) {
                        this.switchTab(tabs[tabIndex]);
                    }
                }
                break;
        }
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        if (!this.element) return;

        this.activeTab = tabName;

        // Update tab buttons
        this.element.querySelectorAll('.algorithm-details-tab').forEach(tab => {
            const isActive = tab.getAttribute('data-tab') === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive.toString());
        });

        // Update tab content
        this.element.querySelectorAll('.tab-content').forEach(content => {
            const isActive = content.id === `tab-${tabName}`;
            content.classList.toggle('active', isActive);
        });

        // Focus the active tab content for accessibility
        const activeContent = this.element.querySelector(`#tab-${tabName}`);
        if (activeContent) {
            activeContent.focus();
        }
    }

    /**
     * Populate modal content with algorithm data
     */
    populateContent() {
        if (!this.currentAlgorithm || !this.element) return;

        // Update title (remove "- Details" suffix)
        const titleEl = this.element.querySelector('.algorithm-details-title');
        if (titleEl) {
            titleEl.textContent = this.currentAlgorithm.name;
        } else {
            DebugConfig.warn('AlgorithmDetails: Title element not found for algorithm:', this.currentAlgorithm.name);
        }

        // Set category attribute for styling
        try {
            this.element.setAttribute('data-category', this.getCategoryKey());
        } catch (error) {
            DebugConfig.warn('AlgorithmDetails: Failed to set category attribute:', error);
        }

        // Apply category color tinting to header background
        try {
            this.applyCategoryTinting();
        } catch (error) {
            DebugConfig.warn('AlgorithmDetails: Failed to apply category tinting:', error);
        }

        // Populate each tab with individual error handling
        try {
            this.populateInfoTab();
        } catch (error) {
            DebugConfig.warn('AlgorithmDetails: Failed to populate info tab:', error);
        }

        try {
            this.populateReferencesTab();
        } catch (error) {
            DebugConfig.warn('AlgorithmDetails: Failed to populate references tab:', error);
        }

        try {
            this.populateTestVectorsTab();
        } catch (error) {
            DebugConfig.warn('AlgorithmDetails: Failed to populate test vectors tab:', error);
        }

        try {
            this.populateCodeTab();
        } catch (error) {
            DebugConfig.warn('AlgorithmDetails: Failed to populate code tab:', error);
        }
    }

    /**
     * Populate the Info tab
     */
    populateInfoTab() {
        const content = this.element.querySelector('#tab-info');
        const algorithm = this.currentAlgorithm;
        
        let html = '<div class="tab-content-inner">';

        // Basic Information Section
        html += '<div class="info-section">';
        html += '<h3 class="section-title">Basic Information</h3>';
        html += '<div class="info-grid">';

        if (algorithm.description) {
            html += this.createInfoItem('Description', algorithm.description);
        }

        if (algorithm.inventor) {
            html += this.createInfoItem('Inventor/Designer', algorithm.inventor);
        }

        if (algorithm.year && algorithm.year !== 2025) {
            html += this.createInfoItem('Year', algorithm.year);
        }

        if (algorithm.country && algorithm.country.name) {
            const flagElement = this.getCountryFlag(algorithm.country);
            html += this.createInfoItem('Origin', `${flagElement}${algorithm.country.name}`);
        }

        html += '</div></div>';

        // Technical Specifications Section
        if (this.hasTechnicalSpecs(algorithm)) {
            html += '<div class="info-section">';
            html += '<h3 class="section-title">Technical Specifications</h3>';
            html += '<div class="info-grid">';

            if (algorithm.category && algorithm.category.name) {
                const categoryIcon = algorithm.category.icon || '';
                html += this.createInfoItem('Category', `${categoryIcon} ${algorithm.category.name}`);
            }

            if (algorithm.keySize !== undefined && algorithm.keySize > 0) {
                const keySize = algorithm.keySize * 8;
                html += this.createInfoItem('Key Size', `${keySize} bits`);
            }

            if (algorithm.blockSize !== undefined && algorithm.blockSize > 0) {
                const blockSize = algorithm.blockSize * 8;
                html += this.createInfoItem('Block Size', `${blockSize} bits`);
            }

            if (algorithm.complexity) {
                html += this.createInfoItem('Complexity Level', 
                    `<span style="color: ${algorithm.complexity.color}">${algorithm.complexity.name}</span>`);
            }

            html += '</div></div>';
        }

        // Security Information Section
        if (algorithm.securityStatus || algorithm.securityLevel) {
            html += '<div class="info-section">';
            html += '<h3 class="section-title">Security Information</h3>';
            html += '<div class="info-grid">';

            if (algorithm.securityStatus) {
                if (typeof algorithm.securityStatus !== 'object') {
                    throw new Error(`AlgorithmDetails: Invalid securityStatus for ${algorithm.name}. Expected SecurityStatus object, got: ${typeof algorithm.securityStatus}`);
                }
                
                if (!algorithm.securityStatus.name) {
                    throw new Error(`AlgorithmDetails: Missing name property in securityStatus for ${algorithm.name}`);
                }
                
                const statusColor = this.getSecurityStatusColor(algorithm.securityStatus);
                const statusIcon = algorithm.securityStatus.icon || '';
                html += this.createInfoItem('Security Status', 
                    `<span style="color: ${statusColor}">${statusIcon} ${algorithm.securityStatus.name}</span>`);
            }

            html += '</div></div>';
        }

        html += '</div>';
        content.innerHTML = html;
    }

    /**
     * Populate the References tab
     */
    populateReferencesTab() {
        const content = this.element.querySelector('#tab-references');
        const algorithm = this.currentAlgorithm;
        
        if (!algorithm) {
            throw new Error('AlgorithmDetails: No algorithm data available for references tab');
        }
        
        let html = '<div class="tab-content-inner">';

        // Check for documentation links first, then references
        const documentationLinks = algorithm.documentation || [];
        const referenceLinks = algorithm.references || [];
        const allLinks = [...documentationLinks, ...referenceLinks];

        if (allLinks.length > 0) {
            // Documentation section
            if (documentationLinks.length > 0) {
                html += '<div class="references-section">';
                html += '<h3 class="section-title">Documentation</h3>';
                html += '<div class="references-list">';

                documentationLinks.forEach((link, index) => {
                    if (!link || typeof link !== 'object') {
                        throw new Error(`AlgorithmDetails: Invalid documentation link at index ${index} for ${algorithm.name}. Expected LinkItem object`);
                    }
                    
                    if (!link.text) {
                        throw new Error(`AlgorithmDetails: Missing text in documentation link at index ${index} for ${algorithm.name}`);
                    }
                    
                    if (!link.uri) {
                        throw new Error(`AlgorithmDetails: Missing uri in documentation link at index ${index} for ${algorithm.name}`);
                    }

                    html += '<div class="reference-item">';
                    html += `<div class="reference-index">${index + 1}</div>`;
                    html += '<div class="reference-content">';
                    html += `<div class="reference-title">${link.text}</div>`;
                    html += `<div class="reference-url"><a href="${link.uri}" target="_blank" rel="noopener noreferrer">${link.uri}</a></div>`;
                    html += '</div></div>';
                });

                html += '</div></div>';
            }

            // References section  
            if (referenceLinks.length > 0) {
                html += '<div class="references-section">';
                html += '<h3 class="section-title">References</h3>';
                html += '<div class="references-list">';

                referenceLinks.forEach((link, index) => {
                    if (!link || typeof link !== 'object') {
                        throw new Error(`AlgorithmDetails: Invalid reference link at index ${index} for ${algorithm.name}. Expected LinkItem object`);
                    }
                    
                    if (!link.text) {
                        throw new Error(`AlgorithmDetails: Missing text in reference link at index ${index} for ${algorithm.name}`);
                    }
                    
                    if (!link.uri) {
                        throw new Error(`AlgorithmDetails: Missing uri in reference link at index ${index} for ${algorithm.name}`);
                    }

                    html += '<div class="reference-item">';
                    html += `<div class="reference-index">${documentationLinks.length + index + 1}</div>`;
                    html += '<div class="reference-content">';
                    html += `<div class="reference-title">${link.text}</div>`;
                    html += `<div class="reference-url"><a href="${link.uri}" target="_blank" rel="noopener noreferrer">${link.uri}</a></div>`;
                    html += '</div></div>';
                });

                html += '</div></div>';
            }
        } else {
            html += '<div class="empty-state">';
            html += '<div class="empty-icon">📚</div>';
            html += '<div class="empty-title">No References Available</div>';
            html += '<div class="empty-description">Reference information for this algorithm has not been added yet.</div>';
            html += '</div>';
        }

        html += '</div>';
        content.innerHTML = html;
    }

    /**
     * Populate the Test Vectors tab
     */
    populateTestVectorsTab() {
        const content = this.element.querySelector('#tab-test-vectors');
        const algorithm = this.currentAlgorithm;
        
        let html = '<div class="tab-content-inner">';

        if (algorithm.tests && algorithm.tests.length > 0) {
            html += '<div class="test-vectors-section">';
            html += '<h3 class="section-title">Test Vectors';
            html += ` <span class="test-count">(${algorithm.tests.length})</span></h3>`;
            
            html += '<div class="test-controls">';
            html += '<button class="btn btn-primary btn-small" onclick="window.algorithmDetailsInstance.runAllTests()">🚀 Run All Tests</button>';
            html += '<button class="btn btn-secondary btn-small" onclick="window.algorithmDetailsInstance.clearAllResults()">🗑️ Clear Results</button>';
            html += '<button class="btn btn-secondary btn-small" onclick="window.algorithmDetailsInstance.exportTestResults()">📊 Export Results</button>';
            html += '</div>';

            html += '<div class="test-vectors-list">';

            algorithm.tests.forEach((test, index) => {
                html += '<div class="test-vector-item">';
                html += `<div class="test-header">`;
                html += `<h4 class="test-title">Test Vector ${index + 1}</h4>`;
                html += `<button class="btn btn-small test-run-btn" onclick="window.algorithmDetailsInstance.runSingleTest(${index})">▶️ Run</button>`;
                html += `</div>`;

                if (test.text) {
                    html += `<div class="test-description">${test.text}</div>`;
                }

                if (test.uri) {
                    html += `<div class="test-source">Source: <a href="${test.uri}" target="_blank" rel="noopener noreferrer">${test.uri}</a></div>`;
                }

                // Test data
                html += '<div class="test-data">';
                
                if (test.input) {
                    html += '<div class="test-data-item">';
                    html += '<div class="test-data-label">Input:</div>';
                    html += `<div class="test-data-value"><code>${this.formatBytes(test.input)}</code></div>`;
                    html += '</div>';
                }

                if (test.key) {
                    html += '<div class="test-data-item">';
                    html += '<div class="test-data-label">Key:</div>';
                    html += `<div class="test-data-value"><code>${this.formatBytes(test.key)}</code></div>`;
                    html += '</div>';
                }

                if (test.expected) {
                    html += '<div class="test-data-item">';
                    html += '<div class="test-data-label">Expected:</div>';
                    html += `<div class="test-data-value"><code>${this.formatBytes(test.expected)}</code></div>`;
                    html += '</div>';
                }

                html += '</div>';
                html += '</div>';
            });

            html += '</div></div>';
        } else {
            html += '<div class="empty-state">';
            html += '<div class="empty-icon">🧪</div>';
            html += '<div class="empty-title">No Test Vectors Available</div>';
            html += '<div class="empty-description">Test vectors for this algorithm have not been implemented yet.</div>';
            html += '</div>';
        }

        html += '</div>';
        content.innerHTML = html;
    }

    /**
     * Populate the Code tab
     */
    populateCodeTab() {
        const content = this.element.querySelector('#tab-code');
        const algorithm = this.currentAlgorithm;
        
        if (!algorithm) {
            throw new Error('AlgorithmDetails: No algorithm data available for code tab');
        }
        
        let html = '<div class="tab-content-inner">';
        
        // Language selection section
        html += '<div class="code-section">';
        html += '<h3 class="section-title">Multi-Language Code Generation</h3>';
        html += '<div class="language-selector">';
        
        // Check if LanguagePlugins is available
        if (typeof window !== 'undefined' && window.LanguagePlugins) {
            const plugins = window.LanguagePlugins.GetAll();
            DebugConfig.log(`🔌 Found ${plugins.length} language plugins for algorithm details`);
            
            if (plugins.length > 0) {
                DebugConfig.log('📝 Available plugins:', plugins.map(p => `${p.name} (.${p.extension})`));
                
                plugins.forEach((plugin, index) => {
                    const isActive = index === 0; // Default to first language
                    html += `<button class="language-btn ${isActive ? 'active' : ''}" data-language="${plugin.extension}" onclick="window.algorithmDetailsInstance.switchLanguage('${plugin.extension}')">`;
                    html += `${plugin.icon} ${plugin.name}`;
                    html += '</button>';
                });
            } else {
                DebugConfig.warn('⚠️ LanguagePlugins registry is empty');
                html += '<div class="loading-message">⚠️ No language plugins found. Please check plugin loading.</div>';
            }
        } else {
            DebugConfig.warn('❌ LanguagePlugins not available in algorithm details');
            // Fallback languages if LanguagePlugins is not available
            const fallbackLanguages = [
                { key: 'js', name: 'JavaScript', icon: '�' },
                { key: 'py', name: 'Python', icon: '🐍' },
                { key: 'cpp', name: 'C++', icon: '⚡' },
                { key: 'java', name: 'Java', icon: '☕' }
            ];
            
            fallbackLanguages.forEach((lang, index) => {
                const isActive = index === 0;
                html += `<button class="language-btn ${isActive ? 'active' : ''}" data-language="${lang.key}" onclick="window.algorithmDetailsInstance.switchLanguage('${lang.key}')">`;
                html += `${lang.icon} ${lang.name}`;
                html += '</button>';
            });
        }
        
        html += '</div>';
        html += '</div>';
        
        // Code generation configuration section
        html += '<div class="code-section">';
        html += '<h3 class="section-title">Generation Options</h3>';
        html += '<div class="code-config">';
        html += '<div class="config-row">';
        html += '<label class="config-label">Include Comments:</label>';
        html += '<input type="checkbox" id="include-comments" checked onchange="window.algorithmDetailsInstance.updateCodeGeneration()">';
        html += '</div>';
        html += '<div class="config-row">';
        html += '<label class="config-label">Include Examples:</label>';
        html += '<input type="checkbox" id="include-examples" checked onchange="window.algorithmDetailsInstance.updateCodeGeneration()">';
        html += '</div>';
        html += '<div class="config-row">';
        html += '<label class="config-label">Include Test Vectors:</label>';
        html += '<input type="checkbox" id="include-tests" onchange="window.algorithmDetailsInstance.updateCodeGeneration()">';
        html += '</div>';
        html += '<div class="config-row">';
        html += '<label class="config-label">Standalone Code:</label>';
        html += '<input type="checkbox" id="standalone-code" checked onchange="window.algorithmDetailsInstance.updateCodeGeneration()">';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        
        // Code display section
        html += '<div class="code-section">';
        html += '<h3 class="section-title">Generated Code</h3>';
        html += '<div class="code-display">';
        html += '<div class="code-block">';
        html += '<div class="code-header">';
        html += '<span class="code-language" id="current-language">JavaScript</span>';
        html += '<div class="code-header-buttons">';
        html += '<button class="code-toggle-btn" id="toggle-word-wrap" onclick="window.algorithmDetailsInstance.toggleWordWrap()" title="Toggle Word Wrap">📄 Wrap</button>';
        html += '<button class="code-toggle-btn" id="toggle-line-numbers" onclick="window.algorithmDetailsInstance.toggleLineNumbers()" title="Toggle Line Numbers">🔢 Numbers</button>';
        html += '<button class="code-copy-btn" onclick="window.algorithmDetailsInstance.copyCurrentCode()">📋 Copy</button>';
        html += '<button class="code-download-btn" onclick="window.algorithmDetailsInstance.downloadCurrentCode()">💾 Download</button>';
        html += '</div>';
        html += '</div>';
        html += '<pre class="code-content" id="generated-code"><code class="language-javascript">';
        
        // Generate initial code (JavaScript by default) - placeholder for now
        html += '// Loading source code...';
        
        html += '</code></pre>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        
        // Implementation notes section
        html += '<div class="code-section">';
        html += '<h3 class="section-title">Implementation Notes</h3>';
        html += '<div class="implementation-notes">';
        html += '<div class="note-item">';
        html += '<div class="note-icon">🔧</div>';
        html += '<div class="note-content">';
        html += '<div class="note-title">OpCodes Library</div>';
        html += '<div class="note-description">This algorithm uses the OpCodes.js library for cryptographic operations. Generated code includes equivalent operations for the target language.</div>';
        html += '</div>';
        html += '</div>';
        
        html += '<div class="note-item">';
        html += '<div class="note-icon">🌐</div>';
        html += '<div class="note-content">';
        html += '<div class="note-title">Multi-Language Support</div>';
        html += '<div class="note-description">Code can be generated for 11 different programming languages while maintaining functional equivalence.</div>';
        html += '</div>';
        html += '</div>';
        
        html += '<div class="note-item">';
        html += '<div class="note-icon">📚</div>';
        html += '<div class="note-content">';
        html += '<div class="note-title">Educational Purpose</div>';
        html += '<div class="note-description">Generated code is optimized for learning and understanding algorithm implementation patterns.</div>';
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        content.innerHTML = html;
        
        // Store current language
        this.currentLanguage = 'javascript';
        
        // Apply syntax highlighting if available - load actual code asynchronously
        const codeElement = content.querySelector('#generated-code code');
        if (codeElement) {
            // Load the actual JavaScript code
            this.loadCodeAsync('javascript', codeElement);
        }
    }

    /**
     * Helper method to create info items
     */
    createInfoItem(label, value) {
        return `
            <div class="info-item">
                <div class="info-label">${label}</div>
                <div class="info-value">${value}</div>
            </div>
        `;
    }

    /**
     * Helper method to get country flag
     */
    getCountryFlag(country) {
        if (!country || typeof country !== 'object') {
            throw new Error('AlgorithmDetails: Invalid country data. Expected CountryCode object');
        }
        
        if (!country.name) {
            throw new Error('AlgorithmDetails: Missing country name in CountryCode object');
        }
        
        // Dynamically generate country mapping from AlgorithmFramework.CountryCode
        // This ensures we always have up-to-date mappings without manual maintenance
        let isoCode = null;
        
        // Check if AlgorithmFramework is available and has CountryCode
        if (typeof AlgorithmFramework !== 'undefined' && AlgorithmFramework.CountryCode) {
            // Create reverse lookup from country name to ISO code
            for (const [key, countryData] of Object.entries(AlgorithmFramework.CountryCode)) {
                if (countryData.name === country.name) {
                    // Special cases that shouldn't show flags
                    if (key === 'UNKNOWN' || key === 'ANCIENT' || key === 'INTL') {
                        return '';
                    }
                    isoCode = key.toLowerCase();
                    break;
                }
            }
        }
        
        // If not found in AlgorithmFramework, show error
        if (isoCode === null) {
            throw new Error(`AlgorithmDetails: No country code mapping found for '${country.name}'. Add to AlgorithmFramework.CountryCode`);
        }
        
        return `<img class="country-flag" src="https://flagcdn.com/16x12/${isoCode}.png" alt="${isoCode}" onerror="this.style.display='none'">`;
    }

    /**
     * Helper method to check if algorithm has technical specs
     */
    hasTechnicalSpecs(algorithm) {
        return algorithm.keySize !== undefined || 
               algorithm.blockSize !== undefined || 
               algorithm.category || 
               algorithm.complexity;
    }

    /**
     * Helper method to get security status color
     */
    getSecurityStatusColor(securityStatus) {
        if (!securityStatus) {
            throw new Error('AlgorithmDetails: Security status is required but not provided');
        }
        
        if (typeof securityStatus !== 'object') {
            throw new Error(`AlgorithmDetails: Invalid security status type. Expected SecurityStatus object, got: ${typeof securityStatus}`);
        }
        
        if (!securityStatus.color) {
            throw new Error(`AlgorithmDetails: Missing color property in SecurityStatus object. Status: ${securityStatus.name}`);
        }
        
        return securityStatus.color;
    }

    /**
     * Helper method to get category key
     */
    getCategoryKey() {
        const algorithm = this.currentAlgorithm;
        
        if (!algorithm) {
            throw new Error('AlgorithmDetails: No algorithm data available for category key generation');
        }
        
        if (!algorithm.category || typeof algorithm.category !== 'object') {
            throw new Error(`AlgorithmDetails: Invalid category for ${algorithm.name}. Expected CategoryType object, got: ${typeof algorithm.category}`);
        }
        
        if (!algorithm.category.name) {
            throw new Error(`AlgorithmDetails: Missing category name for ${algorithm.name}`);
        }
        
        // Use the same category mapping as the controller
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
        
        return categoryMap[algorithm.category.name] || algorithm.category.name.toLowerCase().replace(/\s+/g, '-');
    }

    /**
     * Apply category color tinting to modal header
     */
    applyCategoryTinting() {
        if (!this.element) {
            throw new Error('AlgorithmDetails: Modal element not found when applying category tinting');
        }
        
        if (!this.currentAlgorithm) {
            throw new Error('AlgorithmDetails: No algorithm data available for category tinting');
        }

        const header = this.element.querySelector('.algorithm-details-header');
        if (!header) {
            throw new Error('AlgorithmDetails: Modal header element not found');
        }

        // Require proper CategoryType object with color
        if (!this.currentAlgorithm.category || typeof this.currentAlgorithm.category !== 'object') {
            throw new Error(`AlgorithmDetails: Invalid category type for ${this.currentAlgorithm.name}. Expected CategoryType object, got: ${typeof this.currentAlgorithm.category}`);
        }
        
        if (!this.currentAlgorithm.category.color) {
            throw new Error(`AlgorithmDetails: Missing color property in category for ${this.currentAlgorithm.name}. Category: ${this.currentAlgorithm.category.name}`);
        }

        const categoryColor = this.currentAlgorithm.category.color;

        // Convert hex to rgba with 50% opacity and blend with existing background
        const hex = categoryColor.replace('#', '');
        if (hex.length !== 6) {
            throw new Error(`AlgorithmDetails: Invalid hex color format for ${this.currentAlgorithm.name}. Expected #RRGGBB, got: ${categoryColor}`);
        }
        
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
            throw new Error(`AlgorithmDetails: Failed to parse hex color ${categoryColor} for ${this.currentAlgorithm.name}`);
        }
        
        // Apply 50% tinted background
        header.style.background = `linear-gradient(rgba(${r}, ${g}, ${b}, 0.3), rgba(${r}, ${g}, ${b}, 0.2)), rgba(255, 255, 255, 0.1)`;
        header.style.backdropFilter = 'blur(10px)';
    }

    /**
     * Helper method to format byte arrays for display
     */
    formatBytes(bytes) {
        if (!bytes || !Array.isArray(bytes)) return '';
        
        // Convert to hex string
        return bytes.map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    }

    /**
     * Helper method to escape HTML in code content
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Run a single test vector
     */
    runSingleTest(testIndex) {
        if (!this.currentAlgorithm || !this.currentAlgorithm.tests) {
            throw new Error('AlgorithmDetails: No algorithm or tests available for execution');
        }
        
        const test = this.currentAlgorithm.tests[testIndex];
        if (!test) {
            throw new Error(`AlgorithmDetails: Test vector ${testIndex} not found`);
        }
        
        // Find the test vector item in the DOM
        const testItems = this.element.querySelectorAll('.test-vector-item');
        const testItem = testItems[testIndex];
        if (!testItem) {
            throw new Error(`AlgorithmDetails: Test vector DOM element ${testIndex} not found`);
        }
        
        // Add a results container if it doesn't exist
        let resultsContainer = testItem.querySelector('.test-results');
        if (!resultsContainer) {
            resultsContainer = document.createElement('div');
            resultsContainer.className = 'test-results';
            testItem.appendChild(resultsContainer);
        }
        
        // Show running state
        resultsContainer.innerHTML = '<div class="test-status running">🔄 Running test...</div>';
        
        try {
            // Execute the test
            const result = this.executeTest(test);
            
            // Display results
            const success = result.success;
            const statusClass = success ? 'success' : 'failure';
            const statusIcon = success ? '✅' : '❌';
            const statusText = success ? 'PASSED' : 'FAILED';
            
            let html = `<div class="test-status ${statusClass}">${statusIcon} ${statusText}</div>`;
            
            if (result.output) {
                html += '<div class="test-output">';
                html += '<div class="test-data-label">Actual Output:</div>';
                html += `<div class="test-data-value"><code>${this.formatBytes(result.output)}</code></div>`;
                html += '</div>';
            }
            
            if (result.expected) {
                html += '<div class="test-expected">';
                html += '<div class="test-data-label">Expected Output:</div>';
                html += `<div class="test-data-value"><code>${this.formatBytes(result.expected)}</code></div>`;
                html += '</div>';
            }
            
            if (result.error) {
                html += `<div class="test-error">Error: ${result.error}</div>`;
            }
            
            if (result.duration !== undefined) {
                html += `<div class="test-duration">Duration: ${result.duration}ms</div>`;
            }
            
            resultsContainer.innerHTML = html;
            
            // Update the algorithm's test results and refresh the card
            this.updateAlgorithmTestResults();
            
        } catch (error) {
            resultsContainer.innerHTML = `<div class="test-status failure">❌ FAILED</div><div class="test-error">Error: ${error.message}</div>`;
            DebugConfig.error('Test execution failed:', error);
            
            // Update the algorithm's test results and refresh the card
            this.updateAlgorithmTestResults();
        }
    }

    /**
     * Update the algorithm's test results and refresh the algorithm card
     */
    updateAlgorithmTestResults() {
        if (!this.currentAlgorithm || !this.element) {
            return;
        }
        
        // Count test results from the DOM
        const testItems = this.element.querySelectorAll('.test-vector-item');
        let totalTests = 0;
        let passedTests = 0;
        
        testItems.forEach(item => {
            const resultsContainer = item.querySelector('.test-results');
            if (resultsContainer) {
                const statusEl = resultsContainer.querySelector('.test-status');
                if (statusEl) {
                    totalTests++;
                    if (statusEl.classList.contains('success')) {
                        passedTests++;
                    }
                }
            }
        });
        
        // Store results on the algorithm object
        this.currentAlgorithm.testResults = {
            passed: passedTests,
            total: totalTests,
            lastUpdated: Date.now()
        };
        
        // Refresh the algorithm card in the main UI
        this.refreshAlgorithmCard();
    }
    
    /**
     * Refresh the algorithm card to update test status colors
     */
    refreshAlgorithmCard() {
        // Find the algorithm card in the main UI and update its test button
        const algorithmCard = document.querySelector(`[data-name="${this.currentAlgorithm.name}"]`);
        if (algorithmCard) {
            const testButton = algorithmCard.querySelector('.card-test-btn');
            if (testButton) {
                // Create a temporary card instance to get the new status
                const tempCard = new AlgorithmCard(this.currentAlgorithm);
                const newStatus = tempCard.getTestStatus();
                
                // Remove old status classes
                testButton.classList.remove('test-status-none', 'test-status-some', 'test-status-all', 'test-status-untested');
                
                // Add new status class
                testButton.classList.add(`test-status-${newStatus}`);
                testButton.setAttribute('data-test-status', newStatus);
            }
        }
    }

    /**
     * Run all test vectors
     */
    runAllTests() {
        if (!this.currentAlgorithm || !this.currentAlgorithm.tests) {
            throw new Error('AlgorithmDetails: No algorithm or tests available for execution');
        }
        
        const tests = this.currentAlgorithm.tests;
        for (let i = 0; i < tests.length; i++) {
            // Add small delay between tests to show progress
            setTimeout(() => {
                this.runSingleTest(i);
                // Update results after the last test completes
                if (i === tests.length - 1) {
                    setTimeout(() => this.updateAlgorithmTestResults(), 50);
                }
            }, i * 100);
        }
    }

    /**
     * Execute a single test and return results
     */
    executeTest(test) {
        const startTime = performance.now();
        
        try {
            // Validate test structure first
            if (!test.input || !test.expected) {
                return {
                    success: false,
                    error: 'Test vector missing required input or expected output',
                    expected: test.expected,
                    duration: performance.now() - startTime
                };
            }
            
            // Check if we have the actual algorithm implementation using AlgorithmFramework
            if (!this.currentAlgorithm.CreateInstance) {
                return {
                    success: false,
                    error: 'Algorithm implementation not available - CreateInstance method missing (AlgorithmFramework required)',
                    expected: test.expected,
                    duration: performance.now() - startTime
                };
            }
            
            // Create algorithm instance
            const algorithmInstance = this.currentAlgorithm.CreateInstance(false);
            if (!algorithmInstance) {
                return {
                    success: false,
                    error: 'Failed to create algorithm instance',
                    expected: test.expected,
                    duration: performance.now() - startTime
                };
            }
            
            // Configure the instance based on test parameters
            if (test.key !== undefined) {
                // For algorithms that need keys
                if (algorithmInstance.SetKey) {
                    algorithmInstance.SetKey(test.key);
                } else if (algorithmInstance.key !== undefined) {
                    algorithmInstance.key = test.key;
                }
            }
            
            if (test.shift !== undefined) {
                // For Caesar cipher and similar algorithms
                if (algorithmInstance.shift !== undefined) {
                    algorithmInstance.shift = test.shift;
                } else if (algorithmInstance.SetShift) {
                    algorithmInstance.SetShift(test.shift);
                }
            }
            
            // Execute the algorithm using AlgorithmFramework pattern
            if (!algorithmInstance.Feed || !algorithmInstance.Result) {
                return {
                    success: false,
                    error: 'Algorithm instance does not implement Feed/Result methods (AlgorithmFramework pattern)',
                    expected: test.expected,
                    duration: performance.now() - startTime
                };
            }
            
            // Clear any previous state and feed input data
            if (algorithmInstance.Reset) {
                algorithmInstance.Reset();
            }
            
            algorithmInstance.Feed(test.input);
            const actualOutput = algorithmInstance.Result();
            
            // Compare results
            const matches = this.compareBytes(actualOutput, test.expected);
            
            return {
                success: matches,
                output: actualOutput,
                expected: test.expected,
                duration: performance.now() - startTime
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                expected: test.expected,
                duration: performance.now() - startTime
            };
        }
    }

    /**
     * Compare two byte arrays for equality
     */
    compareBytes(actual, expected) {
        if (!actual || !expected) return false;
        if (actual.length !== expected.length) return false;
        
        for (let i = 0; i < actual.length; i++) {
            if (actual[i] !== expected[i]) return false;
        }
        return true;
    }

    /**
     * Get current code generation configuration
     */
    getCodeGenerationConfig() {
        if (!this.element) {
            // Default configuration if modal not available
            return {
                includeComments: true,
                includeTests: false,
                includeExamples: true,
                standalone: true
            };
        }
        
        return {
            includeComments: this.element.querySelector('#include-comments')?.checked ?? true,
            includeTests: this.element.querySelector('#include-tests')?.checked ?? false,
            includeExamples: this.element.querySelector('#include-examples')?.checked ?? true,
            standalone: this.element.querySelector('#standalone-code')?.checked ?? true
        };
    }

    /**
     * Update code generation when configuration changes
     */
    updateCodeGeneration() {
        if (this.currentLanguage) {
            this.switchLanguage(this.currentLanguage);
        }
    }

    /**
     * Generate code for a specific language using TypeAware transpiler
     */
    async generateCodeForLanguage(languageKey) {
        DebugConfig.log(`🔧 Generating code for language: ${languageKey}`);
        
        const algorithm = this.currentAlgorithm;
        if (!algorithm) {
            throw new Error('AlgorithmDetails: No algorithm available for code generation');
        }
        
        try {
            // Step 1: Get the JavaScript source code
            const jsSource = await this.getJavaScriptSource();
            if (!jsSource || jsSource.trim().length === 0) {
                DebugConfig.error('❌ No JavaScript source code available');
                throw new Error(`No source code available for ${algorithm.name}`);
            }
            
            DebugConfig.log(`📄 Got JavaScript source (${jsSource.length} chars)`);
            
            // Debug: Log the first 500 characters of the source to see what we're parsing
            DebugConfig.log('🔍 JavaScript source preview:');
            DebugConfig.log(jsSource.substring(0, 500));
            DebugConfig.log('...');
            
            // For JavaScript, return the source as-is (it's the original)
            if (languageKey === 'js' || languageKey === 'javascript') {
                DebugConfig.log('✅ Returning original JavaScript source');
                return jsSource;
            }
            
            // Step 2: Check if TypeAwareJSASTTranspiler is available
            if (!window.TypeAwareJSASTTranspiler) {
                DebugConfig.error('❌ TypeAwareJSASTTranspiler not available');
                throw new Error('TypeAwareJSASTTranspiler not loaded');
            }
            
            // Step 3: Get the language plugin
            const plugin = window.LanguagePlugins.GetByExtension(languageKey);
            if (!plugin) {
                DebugConfig.error(`❌ No plugin found for language: ${languageKey}`);
                throw new Error(`No plugin available for .${languageKey} files`);
            }
            
            DebugConfig.log(`📝 Using plugin: ${plugin.name} for .${plugin.extension}`);
            
            // Step 4: Parse JavaScript into AST using TypeAware transpiler
            DebugConfig.log('🚀 Parsing JavaScript source with TypeAware transpiler...');
            
            const parser = new window.TypeAwareJSASTTranspiler.TypeAwareJSASTParser(jsSource);
            parser.tokenize();
            DebugConfig.log('✅ Tokenization completed');
            
            const ast = parser.parse();
            DebugConfig.log('✅ JavaScript parsed successfully into AST');
            
            // Apply AST transformations
            const options = this.getCodeGenerationOptions();
            const transformedAST = this.applyASTTransformations(ast, options);
            
            // Generate target language code using the plugin
            const generationResult = plugin.GenerateFromAST(transformedAST, options);
            
            if (generationResult.success) {
                DebugConfig.log(`✅ Code generation successful for ${languageKey}`);
                return generationResult.code;
            } else {
                DebugConfig.error(`❌ Code generation failed: ${generationResult.error}`);
                throw new Error(`Code generation failed: ${generationResult.error}`);
            }
            
        } catch (error) {
            DebugConfig.error(`❌ Error in generateCodeForLanguage:`, error);
            throw error;
        }
    }

    /**
     * Get JavaScript source code for the current algorithm
     */
    async getJavaScriptSource() {
        const algorithm = this.currentAlgorithm;
        if (!algorithm) {
            throw new Error('No algorithm available');
        }
        
        DebugConfig.log(`📄 Getting JavaScript source for ${algorithm.name}`);
        
        // Delegate to the existing method
        return await this.getActualJavaScriptSource(algorithm);
    }

    /**
     * Get code generation options from UI settings
     */
    getCodeGenerationOptions() {
        return {
            stripComments: false,
            stripTestVectors: true,
            stripMetadata: false,
            removeDebugCode: true,
            addTypeAnnotations: true,
            addDocstrings: true
        };
    }

    /**
     * Apply AST transformations based on options
     */
    applyASTTransformations(ast, options) {
        DebugConfig.log('🔧 Applying AST transformations:', options);
        
        if (options.stripTestVectors) {
            ast = this.removeTestVectorsFromAST(ast);
        }
        
        if (options.removeDebugCode) {
            ast = this.removeDebugCodeFromAST(ast);
        }
        
        if (options.stripComments) {
            ast = this.removeCommentsFromAST(ast);
        }
        
        return ast;
    }

    /**
     * Remove test vectors from AST
     */
    removeTestVectorsFromAST(ast) {
        // For now, return AST as-is. Could implement test vector removal logic here
        DebugConfig.log('🧹 Removing test vectors from AST');
        return ast;
    }

    /**
     * Remove debug code from AST
     */
    removeDebugCodeFromAST(ast) {
        // For now, return AST as-is. Could implement debug code removal logic here
        DebugConfig.log('🧹 Removing debug code from AST');
        return ast;
    }

    /**
     * Remove comments from AST
     */
    removeCommentsFromAST(ast) {
        // For now, return AST as-is. Could implement comment removal logic here
        DebugConfig.log('🧹 Removing comments from AST');
        return ast;
    }

    /**
     * Get valid JavaScript class name from algorithm name
     */
    getValidClassName(algorithmName) {
        return algorithmName
            .replace(/[^a-zA-Z0-9]/g, '')
            .replace(/^[^a-zA-Z]/, 'Algorithm')
            .replace(/^\w/, c => c.toUpperCase());
    }

    /**
     * Get the actual JavaScript source code for the algorithm
     */
    async getActualJavaScriptSource(algorithm) {
        DebugConfig.log(`🚀 === STARTING JAVASCRIPT SOURCE EXTRACTION FOR "${algorithm.name}" ===`);
        
        // Try to get the source from the algorithm's file
        if (algorithm.sourceCode) {
            DebugConfig.log(`✅ Found algorithm.sourceCode property`);
            return algorithm.sourceCode;
        }
        DebugConfig.log(`❌ No algorithm.sourceCode property found`);
        
        // Try to read the original file directly
        DebugConfig.log(`🔍 Attempting to load original file...`);
        const sourceFromFile = await this.loadOriginalJavaScriptFile(algorithm);
        if (sourceFromFile) {
            DebugConfig.log(`✅ Successfully loaded source from file (${sourceFromFile.length} chars)`);
            return sourceFromFile;
        }
        DebugConfig.log(`❌ Failed to load source from file`);
        
        // Try to get source from the constructor if available
        DebugConfig.log(`🔍 Checking algorithm constructor...`);
        if (algorithm.constructor && algorithm.constructor.toString) {
            const constructorSource = algorithm.constructor.toString();
            DebugConfig.log(`📋 Constructor source: "${constructorSource.substring(0, 100)}..."`);
            if (constructorSource !== '[native code]') {
                DebugConfig.log(`✅ Found constructor source (${constructorSource.length} chars)`);
                DebugConfig.log(`🔄 But let's also try to extract instance classes...`);
                
                // Try to get instance source as well and combine them
                const instanceExtraction = this.extractInstanceSources(algorithm);
                if (instanceExtraction && instanceExtraction.length > 0) {
                    DebugConfig.log(`✅ Also extracted instance sources (${instanceExtraction.length} chars)`);
                    const combinedSource = constructorSource + '\n\n' + instanceExtraction;
                    DebugConfig.log(`📊 Combined source: ${constructorSource.length} + ${instanceExtraction.length} = ${combinedSource.length} chars`);
                    return combinedSource;
                } else {
                    DebugConfig.log(`❌ No additional instance sources found, using constructor only`);
                    return constructorSource;
                }
            } else {
                DebugConfig.log(`❌ Constructor is native code`);
            }
        } else {
            DebugConfig.log(`❌ No valid constructor found`);
        }
        
        // Try to reconstruct source from algorithm properties and methods
        DebugConfig.log(`🔄 Falling back to source reconstruction...`);
        let source = this.reconstructJavaScriptSource(algorithm);
        DebugConfig.log(`📊 Final reconstructed source length: ${source.length} characters`);
        return source;
    }

    /**
     * Extract instance sources without full reconstruction
     */
    extractInstanceSources(algorithm) {
        let instanceSource = '';
        
        try {
            if (algorithm.CreateInstance && typeof algorithm.CreateInstance === 'function') {
                DebugConfig.log(`🔄 Extracting instance sources for ${algorithm.name}...`);
                
                const encryptInstance = algorithm.CreateInstance(false);
                DebugConfig.log(`📥 Encryption instance:`, encryptInstance);
                DebugConfig.log(`📥 Encryption constructor:`, encryptInstance?.constructor);
                DebugConfig.log(`📥 Encryption constructor name:`, encryptInstance?.constructor?.name);
                
                const decryptInstance = algorithm.CreateInstance(true);
                DebugConfig.log(`📤 Decryption instance:`, decryptInstance);
                DebugConfig.log(`📤 Decryption constructor:`, decryptInstance?.constructor);
                DebugConfig.log(`📤 Decryption constructor name:`, decryptInstance?.constructor?.name);
                
                // Extract encryption instance class
                if (encryptInstance && encryptInstance.constructor && encryptInstance.constructor.toString) {
                    const encryptClassSource = encryptInstance.constructor.toString();
                    DebugConfig.log(`🔍 Encryption class source length:`, encryptClassSource?.length);
                    DebugConfig.log(`🔍 Encryption class source preview:`, encryptClassSource?.substring(0, 200));
                    
                    if (encryptClassSource && encryptClassSource !== '[native code]' && 
                        !encryptClassSource.includes('function Object()')) {
                        instanceSource += '// Encryption Instance Class\n';
                        instanceSource += encryptClassSource + '\n\n';
                        DebugConfig.log(`✅ Added encryption instance class (${encryptClassSource.length} chars) - contains all methods`);
                    } else {
                        DebugConfig.log(`❌ Encryption class source rejected: native/Object/empty`);
                    }
                } else {
                    DebugConfig.log(`❌ No valid encryption instance constructor found`);
                }
                
                // Extract decryption instance class if different
                if (decryptInstance && decryptInstance.constructor && 
                    decryptInstance.constructor !== encryptInstance?.constructor) {
                    const decryptClassSource = decryptInstance.constructor.toString();
                    DebugConfig.log(`🔍 Decryption class source length:`, decryptClassSource?.length);
                    DebugConfig.log(`🔍 Decryption class source preview:`, decryptClassSource?.substring(0, 200));
                    
                    if (decryptClassSource && decryptClassSource !== '[native code]' && 
                        !decryptClassSource.includes('function Object()')) {
                        instanceSource += '// Decryption Instance Class\n';
                        instanceSource += decryptClassSource + '\n\n';
                        DebugConfig.log(`✅ Added decryption instance class (${decryptClassSource.length} chars) - contains all methods`);
                    } else {
                        DebugConfig.log(`❌ Decryption class source rejected: native/Object/empty`);
                    }
                } else {
                    DebugConfig.log(`⚠️ Decryption instance same as encryption or invalid`);
                }
                
                // Note: We don't extract methods separately since they're already in the class source
                DebugConfig.log(`ℹ️ Instance classes already contain all methods and fields - no separate extraction needed`);
                
                DebugConfig.log(`📊 Total extracted instance source length: ${instanceSource.length} characters`);
            } else {
                DebugConfig.log(`❌ No CreateInstance method available`);
            }
        } catch (e) {
            DebugConfig.warn('Could not extract instance sources:', e);
        }
        
        return instanceSource;
    }

    /**
     * Load code asynchronously and update the display
     */
    async loadCodeAsync(languageKey, codeElement) {
        try {
            // Show loading state
            codeElement.textContent = '// Loading source code...';
            
            // Generate the code
            const generatedCode = await this.generateCodeForLanguage(languageKey);
            
            // Update the display
            codeElement.textContent = generatedCode;
            
            // Apply syntax highlighting
            setTimeout(() => {
                this.applySyntaxHighlighting(codeElement, languageKey);
            }, 100);
            
        } catch (error) {
            DebugConfig.error('Failed to load code:', error);
            codeElement.textContent = `// Error loading source code: ${error.message}`;
        }
    }

    /**
     * Load the original JavaScript file for the algorithm
     */
    async loadOriginalJavaScriptFile(algorithm) {
        try {
            // Check if we're running on file:// protocol
            const isFileProtocol = window.location.protocol === 'file:';
            
            if (isFileProtocol) {
                DebugConfig.log(`⚠️ File protocol detected - CORS will block fetch requests`);
                DebugConfig.log(`� Falling back to source reconstruction...`);
                
                // Return null to trigger fallback to reconstruction
                return null;
            }
            
            // Use smart matching to get the actual file path from loaded scripts
            const smartMatchedPaths = this.getSmartMatchedFilePaths(algorithm);
            
            // Try each matched path
            for (const filePath of smartMatchedPaths) {
                try {
                    DebugConfig.log(`Attempting to load source from: ${filePath}`);
                    
                    const response = await fetch(filePath);
                    if (response.ok) {
                        const sourceCode = await response.text();
                        DebugConfig.log(`✅ Successfully loaded ${sourceCode.length} characters from ${filePath}`);
                        
                        // TODO: Clean up the source code to remove everything outside class/function/fields
                        return this.cleanupSourceCode(sourceCode, algorithm);
                    } else {
                        DebugConfig.log(`Failed to load ${filePath}: ${response.status}`);
                    }
                } catch (fetchError) {
                    DebugConfig.log(`❌ Fetch failed for ${filePath}: ${fetchError.message}`);
                    DebugConfig.log(`🔄 CORS detected - falling back to reconstruction...`);
                }
            }
            
            DebugConfig.warn(`No source file found for ${algorithm.name} - falling back to reconstruction`);
            return null;
            
        } catch (error) {
            DebugConfig.warn('Failed to load original JavaScript file:', error);
            DebugConfig.log(`🔄 Falling back to source reconstruction...`);
            return null;
        }
    }

    /**
     * Clean up source code to remove imports/exports and registration code
     * TODO: Address - remove everything outside class and/or function and/or fields
     */
    cleanupSourceCode(sourceCode, algorithm) {
        try {
            DebugConfig.log(`🧹 Cleaning up source code for ${algorithm.name}...`);
            
            let cleanedCode = sourceCode;
            
            // Remove common registration patterns at the end of files
            cleanedCode = cleanedCode.replace(/\n\s*\/\/\s*Register.*$/gm, '');
            cleanedCode = cleanedCode.replace(/\n\s*AlgorithmFramework\.register.*$/gm, '');
            cleanedCode = cleanedCode.replace(/\n\s*window\..*\s*=.*$/gm, '');
            
            // Remove import/export statements
            cleanedCode = cleanedCode.replace(/^import\s+.*$/gm, '');
            cleanedCode = cleanedCode.replace(/^export\s+.*$/gm, '');
            
            // Remove top-level comments that are just boilerplate
            cleanedCode = cleanedCode.replace(/^\/\*\*?\s*\n\s*\*?\s*(File:|Author:|Description:).*?\*\/\s*\n/gm, '');
            
            // Remove standalone console.log calls at file level
            cleanedCode = cleanedCode.replace(/^console\.log\(.*\);\s*$/gm, '');
            
            // Extract class definitions, functions, and meaningful content
            const classMatches = cleanedCode.match(/class\s+\w+\s*\{[\s\S]*?\n\}/g);
            const functionMatches = cleanedCode.match(/^function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n\}/gm);
            const constMatches = cleanedCode.match(/^const\s+\w+\s*=[\s\S]*?;/gm);
            
            // If we found structured content, use that
            if (classMatches || functionMatches || constMatches) {
                let structuredCode = '';
                
                if (constMatches) {
                    structuredCode += constMatches.join('\n\n') + '\n\n';
                }
                
                if (functionMatches) {
                    structuredCode += functionMatches.join('\n\n') + '\n\n';
                }
                
                if (classMatches) {
                    structuredCode += classMatches.join('\n\n');
                }
                
                if (structuredCode.trim()) {
                    cleanedCode = structuredCode;
                }
            }
            
            // Final cleanup - remove excessive blank lines
            cleanedCode = cleanedCode.replace(/\n{3,}/g, '\n\n');
            cleanedCode = cleanedCode.trim();
            
            DebugConfig.log(`✅ Cleaned up source: ${sourceCode.length} → ${cleanedCode.length} characters`);
            return cleanedCode;
            
        } catch (error) {
            DebugConfig.warn('Error cleaning up source code:', error);
            return sourceCode; // Return original if cleanup fails
        }
    }

    /**
     * Smart match algorithm name to loaded script files
     */
    getSmartMatchedFilePaths(algorithm) {
        const matches = [];
        
        try {
            DebugConfig.log(`🔍 === SMART MATCHING DEBUG FOR "${algorithm.name}" ===`);
            
            // Get all script elements in the document and extract their actual paths
            const scripts = document.querySelectorAll('script[src]');
            const loadedFiles = [];
            
            scripts.forEach(script => {
                const src = script.getAttribute('src');
                if (src && src.includes('.js') && src.includes('algorithms/')) {
                    // Store both the relative path from src attribute and filename
                    const fileName = src.split('/').pop().replace('.js', '');
                    loadedFiles.push({
                        fullPath: src,
                        fileName: fileName,
                        category: src.split('/')[2] // Extract category from path like ./algorithms/category/file.js
                    });
                }
            });
            
            DebugConfig.log(`📁 Found ${loadedFiles.length} loaded algorithm files with paths:`, loadedFiles);
            
            // Normalize algorithm name for comparison
            const normalizedAlgorithmName = this.normalizeForComparison(algorithm.name);
            DebugConfig.log(`🎯 Algorithm "${algorithm.name}" → normalized: "${normalizedAlgorithmName}"`);
            
            // Create detailed normalized list with actual paths
            DebugConfig.log(`📋 NORMALIZED FILE LIST (${loadedFiles.length} files):`);
            loadedFiles.forEach((item, index) => {
                const normalizedFileName = this.normalizeForComparison(item.fileName);
                DebugConfig.log(`  ${index + 1}. "${item.fileName}" → "${normalizedFileName}" [${item.category}] → ${item.fullPath}`);
            });
            
            // Find best matches with detailed scoring using actual paths
            const scored = loadedFiles.map(item => {
                const normalizedFileName = this.normalizeForComparison(item.fileName);
                const score = this.calculateSimilarityScore(normalizedAlgorithmName, normalizedFileName);
                
                return {
                    filePath: item.fullPath, // Use the actual path from the script src
                    fileName: item.fileName,
                    normalizedFileName: normalizedFileName,
                    category: item.category,
                    score,
                    comparison: `"${normalizedAlgorithmName}" vs "${normalizedFileName}"`
                };
            });
            
            // Sort all results for debugging
            const allSorted = scored.sort((a, b) => b.score - a.score);
            
            DebugConfig.log(`🏆 ALL SCORING RESULTS (sorted by score):`);
            allSorted.forEach((item, index) => {
                const emoji = item.score > 0.8 ? '🟢' : item.score > 0.5 ? '🟡' : '🔴';
                DebugConfig.log(`  ${index + 1}. ${emoji} ${item.comparison} → Score: ${item.score.toFixed(3)} → [${item.category}] ${item.fileName}`);
            });
            
            // Filter for good matches
            const goodMatches = allSorted.filter(item => item.score > 0.5);
            
            DebugConfig.log(`✅ GOOD MATCHES (score > 0.5): ${goodMatches.length} found`);
            
            // Take the best matches and use their actual paths
            goodMatches.slice(0, 3).forEach((item, index) => {
                matches.push(item.filePath); // This is now the real path from script src
                DebugConfig.log(`  ${index + 1}. ✅ Selected: "${item.fileName}" → ${item.filePath} (score: ${item.score.toFixed(3)})`);
            });
            
            if (goodMatches.length === 0) {
                DebugConfig.log(`❌ NO GOOD MATCHES FOUND for "${algorithm.name}" (normalized: "${normalizedAlgorithmName}")`);
            }
            
        } catch (error) {
            DebugConfig.warn('Smart matching failed:', error);
        }
        
        return matches;
    }

    /**
     * Normalize string for comparison by removing special characters and whitespace
     */
    normalizeForComparison(str) {
        if (!str) return '';
        
        return str
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
            .replace(/\s+/g, '');      // Remove whitespace
    }

    /**
     * Calculate similarity score between two normalized strings
     */
    calculateSimilarityScore(str1, str2) {
        if (!str1 || !str2) return 0;
        
        // Exact match
        if (str1 === str2) return 1.0;
        
        // Check if one contains the other
        if (str1.includes(str2) || str2.includes(str1)) {
            const longer = str1.length > str2.length ? str1 : str2;
            const shorter = str1.length <= str2.length ? str1 : str2;
            return shorter.length / longer.length * 0.9; // High score for containment
        }
        
        // Levenshtein distance based similarity
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        
        if (maxLength === 0) return 1.0;
        
        return 1 - (distance / maxLength);
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Determine the file path for an algorithm
     */
    getAlgorithmFilePath(algorithm) {
        // Check if algorithm has a file path property
        if (algorithm.filePath) {
            return algorithm.filePath;
        }
        
        // Try to determine from algorithm name and category
        if (algorithm.category && algorithm.category.name) {
            const categoryPath = this.getCategoryPath(algorithm.category.name);
            const fileName = this.getAlgorithmFileName(algorithm.name);
            
            if (categoryPath && fileName) {
                return `algorithms/${categoryPath}/${fileName}.js`;
            }
        }
        
        // Try common patterns
        const fileName = this.getAlgorithmFileName(algorithm.name);
        if (fileName) {
            // Try different category folders
            const commonCategories = [
                'classical', 'block', 'stream', 'hash', 'mac', 'encoding', 
                'compression', 'asymmetric', 'ecc', 'modes', 'padding',
                'kdf', 'special', 'checksum', 'pqc'
            ];
            
            for (const category of commonCategories) {
                // We'll try the first match in the calling code
                return `algorithms/${category}/${fileName}.js`;
            }
        }
        
        return null;
    }

    /**
     * Get file name from algorithm name
     */
    getAlgorithmFileName(algorithmName) {
        if (!algorithmName) return null;
        
        // Convert algorithm name to likely file name
        return algorithmName
            .toLowerCase()
            .replace(/[^a-z0-9\-]/g, '-')  // Replace non-alphanumeric with hyphens
            .replace(/-+/g, '-')           // Multiple hyphens to single
            .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
    }

    /**
     * Reconstruct JavaScript source from algorithm object
     */
    reconstructJavaScriptSource(algorithm) {
        DebugConfig.log(`🔧 === RECONSTRUCTING JAVASCRIPT SOURCE FOR "${algorithm.name}" ===`);
        
        try {
            let source = '';
            
            // Add header comment
            source += `/*\n * ${algorithm.name}\n`;
            if (algorithm.description) source += ` * ${algorithm.description}\n`;
            if (algorithm.inventor) source += ` * Inventor: ${algorithm.inventor}\n`;
            if (algorithm.year && algorithm.year !== 2025) source += ` * Year: ${algorithm.year}\n`;
            source += ' */\n\n';
            
            // Add the actual algorithm class if we can access it
            const className = algorithm.constructor.name || algorithm.name.replace(/[^a-zA-Z0-9]/g, '');
            DebugConfig.log(`🏷️ Using class name: ${className}`);
            
            // Try to get the actual class source
            if (algorithm.constructor && algorithm.constructor.toString) {
                const classSource = algorithm.constructor.toString();
                DebugConfig.log(`📋 Algorithm constructor toString: "${classSource.substring(0, 100)}..."`);
                if (classSource && classSource !== '[native code]' && !classSource.includes('function Object()')) {
                    source += '// Algorithm Class\n';
                    source += classSource + '\n\n';
                    DebugConfig.log(`✅ Added algorithm class source (${classSource.length} chars)`);
                } else {
                    DebugConfig.log(`❌ Algorithm class source rejected: native/Object/empty`);
                }
            } else {
                DebugConfig.log(`❌ No algorithm constructor.toString available`);
            }
            
            // Try to get instance class source by checking if CreateInstance returns an object with a constructor
            let instanceSource = '';
            try {
                if (algorithm.CreateInstance && typeof algorithm.CreateInstance === 'function') {
                    DebugConfig.log(`🔄 Extracting both encryption and decryption instances for ${algorithm.name}...`);
                    
                    // TODO ADDRESSED: Get both directions since they may refer to different types
                    const encryptInstance = algorithm.CreateInstance(false); // Encryption instance
                    DebugConfig.log(`📥 Encryption instance:`, encryptInstance);
                    DebugConfig.log(`📥 Encryption constructor:`, encryptInstance?.constructor);
                    DebugConfig.log(`📥 Encryption constructor name:`, encryptInstance?.constructor?.name);
                    
                    const decryptInstance = algorithm.CreateInstance(true);  // Decryption instance
                    DebugConfig.log(`📤 Decryption instance:`, decryptInstance);
                    DebugConfig.log(`📤 Decryption constructor:`, decryptInstance?.constructor);
                    DebugConfig.log(`📤 Decryption constructor name:`, decryptInstance?.constructor?.name);
                    
                    // Extract from encryption instance
                    if (encryptInstance && encryptInstance.constructor && encryptInstance.constructor.toString) {
                        const encryptClassSource = encryptInstance.constructor.toString();
                        DebugConfig.log(`🔍 Encryption class source length:`, encryptClassSource?.length);
                        DebugConfig.log(`🔍 Encryption class source preview:`, encryptClassSource?.substring(0, 200));
                        
                        if (encryptClassSource && encryptClassSource !== '[native code]' && 
                            !encryptClassSource.includes('function Object()')) {
                            instanceSource += '// Encryption Instance Class\n';
                            instanceSource += encryptClassSource + '\n\n';
                            DebugConfig.log(`✅ Added encryption instance class (${encryptClassSource.length} chars)`);
                        } else {
                            DebugConfig.log(`❌ Encryption class source rejected: native/Object/empty`);
                        }
                    } else {
                        DebugConfig.log(`❌ No valid encryption instance constructor found`);
                    }
                    
                    // Extract from decryption instance if different
                    if (decryptInstance && decryptInstance.constructor && 
                        decryptInstance.constructor !== encryptInstance?.constructor) {
                        const decryptClassSource = decryptInstance.constructor.toString();
                        DebugConfig.log(`🔍 Decryption class source length:`, decryptClassSource?.length);
                        DebugConfig.log(`🔍 Decryption class source preview:`, decryptClassSource?.substring(0, 200));
                        
                        if (decryptClassSource && decryptClassSource !== '[native code]' && 
                            !decryptClassSource.includes('function Object()')) {
                            instanceSource += '// Decryption Instance Class\n';
                            instanceSource += decryptClassSource + '\n\n';
                            DebugConfig.log(`✅ Added decryption instance class (${decryptClassSource.length} chars)`);
                        } else {
                            DebugConfig.log(`❌ Decryption class source rejected: native/Object/empty`);
                        }
                    } else {
                        DebugConfig.log(`⚠️ Decryption instance same as encryption or invalid`);
                    }
                                        
                    DebugConfig.log(`📊 Total instance source length: ${instanceSource.length} characters`);
                }
            } catch (e) {
                DebugConfig.warn('Could not extract instance source:', e);
            }
            
            // If we have actual source, use it
            DebugConfig.log(`📊 Final source analysis:`);
            DebugConfig.log(`📊 - Base source length: ${source.length}`);
            DebugConfig.log(`📊 - Instance source length: ${instanceSource.length}`);
            DebugConfig.log(`📊 - Condition: source.length (${source.length}) > 200 || instanceSource.length (${instanceSource.length}) > 100`);
            DebugConfig.log(`📊 - Result: ${source.length > 200 || instanceSource.length > 100}`);
            
            if (source.length > 200 || instanceSource.length > 100) {
                source += instanceSource;
                DebugConfig.log(`✅ Using extracted source (${source.length} total chars)`);
                
                // Add registration if not present
                if (!source.includes('RegisterAlgorithm')) {
                    source += `\n// Register the algorithm\n`;
                    source += `RegisterAlgorithm(new ${className}());\n`;
                }
                
                return source;
            }
            
            // Fallback to reconstructed source
            DebugConfig.log(`⚠️ Falling back to comprehensive reconstruction`);
            return this.buildComprehensiveJavaScriptSource(algorithm);
            
        } catch (error) {
            DebugConfig.warn('Failed to reconstruct JavaScript source:', error);
            return this.buildComprehensiveJavaScriptSource(algorithm);
        }
    }

    /**
     * Extract instance methods from an algorithm instance
     */
    extractInstanceMethods(instance, direction = '') {
        let methods = '';
        
        try {
            DebugConfig.log(`🔍 Extracting ${direction} instance methods...`);
            
            // Get all methods from the instance prototype
            const prototype = Object.getPrototypeOf(instance);
            const methodNames = Object.getOwnPropertyNames(prototype);
            
            methodNames.forEach(methodName => {
                if (methodName !== 'constructor' && typeof instance[methodName] === 'function') {
                    try {
                        const methodSource = instance[methodName].toString();
                        if (methodSource && !methodSource.includes('[native code]')) {
                            methods += `  // ${direction} ${methodName} method\n`;
                            methods += `  ${methodSource}\n\n`;
                        }
                    } catch (e) {
                        // Skip methods we can't access
                    }
                }
            });
            
            // Also check for methods directly on the instance
            Object.getOwnPropertyNames(instance).forEach(propName => {
                if (typeof instance[propName] === 'function' && propName !== 'constructor') {
                    try {
                        const methodSource = instance[propName].toString();
                        if (methodSource && !methodSource.includes('[native code]')) {
                            methods += `  // ${direction} ${propName} method (instance property)\n`;
                            methods += `  ${methodSource}\n\n`;
                        }
                    } catch (e) {
                        // Skip
                    }
                }
            });
            
            if (methods) {
                return `// ${direction} Instance Methods\n${methods}`;
            }
            
        } catch (error) {
            DebugConfig.warn(`Could not extract ${direction} instance methods:`, error);
        }
        
        return '';
    }

    /**
     * Extract instance fields and properties
     * TODO ADDRESSED: Extract fields from algorithm instances
     */
    extractInstanceFields(instance, direction = '') {
        let fields = '';
        
        try {
            DebugConfig.log(`🔍 Extracting ${direction} instance fields...`);
            
            const fieldEntries = [];
            
            // Get all enumerable properties
            Object.keys(instance).forEach(key => {
                const value = instance[key];
                if (typeof value !== 'function') {
                    let fieldInfo = `  ${key}: `;
                    
                    if (typeof value === 'string') {
                        fieldInfo += `"${value}"`;
                    } else if (typeof value === 'number' || typeof value === 'boolean') {
                        fieldInfo += value;
                    } else if (Array.isArray(value)) {
                        fieldInfo += `[${value.length} items]`;
                    } else if (value === null) {
                        fieldInfo += 'null';
                    } else if (typeof value === 'object') {
                        fieldInfo += `{${Object.keys(value).length} properties}`;
                    } else {
                        fieldInfo += typeof value;
                    }
                    
                    fieldEntries.push(fieldInfo);
                }
            });
            
            // Get non-enumerable properties
            const propertyNames = Object.getOwnPropertyNames(instance);
            propertyNames.forEach(propName => {
                if (!Object.prototype.hasOwnProperty.call(instance, propName) && 
                    typeof instance[propName] !== 'function' && 
                    propName !== 'constructor') {
                    
                    try {
                        const descriptor = Object.getOwnPropertyDescriptor(instance, propName);
                        if (descriptor && descriptor.value !== undefined) {
                            fieldEntries.push(`  ${propName}: ${typeof descriptor.value} (non-enumerable)`);
                        }
                    } catch (e) {
                        // Skip properties we can't access
                    }
                }
            });
            
            if (fieldEntries.length > 0) {
                fields = `// ${direction} Instance Fields\n`;
                fields += `/*\n${fieldEntries.join('\n')}\n*/\n\n`;
            }
            
        } catch (error) {
            DebugConfig.warn(`Could not extract ${direction} instance fields:`, error);
        }
        
        return fields;
    }

    /**
     * Build comprehensive JavaScript source when actual source isn't available
     */
    buildComprehensiveJavaScriptSource(algorithm) {
        let source = '';
        
        // Header
        source += `/*\n * ${algorithm.name}\n`;
        if (algorithm.description) source += ` * ${algorithm.description}\n`;
        if (algorithm.inventor) source += ` * Inventor: ${algorithm.inventor}\n`;
        if (algorithm.year && algorithm.year !== 2025) source += ` * Year: ${algorithm.year}\n`;
        source += ' */\n\n';
        
        // Imports
        source += 'const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,\n';
        source += '        CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;\n\n';
        
        const className = algorithm.name.replace(/[^a-zA-Z0-9]/g, '');
        
        // Main Algorithm Class with all available properties and methods
        source += `class ${className} extends CryptoAlgorithm {\n`;
        source += '  constructor() {\n';
        source += '    super();\n\n';
        
        // Add all algorithm properties
        Object.keys(algorithm).forEach(key => {
            if (typeof algorithm[key] !== 'function' && !key.startsWith('_')) {
                const value = algorithm[key];
                if (typeof value === 'string') {
                    source += `    this.${key} = "${value}";\n`;
                } else if (typeof value === 'number') {
                    source += `    this.${key} = ${value};\n`;
                } else if (typeof value === 'boolean') {
                    source += `    this.${key} = ${value};\n`;
                } else if (Array.isArray(value)) {
                    source += `    this.${key} = [${value.slice(0, 5).join(', ')}${value.length > 5 ? ', ...' : ''}];\n`;
                }
            }
        });
        
        source += '  }\n\n';
        
        // Add all algorithm methods
        Object.getOwnPropertyNames(Object.getPrototypeOf(algorithm)).forEach(methodName => {
            if (methodName !== 'constructor' && typeof algorithm[methodName] === 'function') {
                try {
                    const methodSource = algorithm[methodName].toString();
                    if (methodSource && !methodSource.includes('[native code]')) {
                        source += `  // ${methodName} method\n`;
                        source += `  ${methodSource}\n\n`;
                    }
                } catch (e) {
                    // Add a placeholder for methods we can't access
                    source += `  // ${methodName} method\n`;
                    source += `  ${methodName}() {\n`;
                    source += `    // Implementation not accessible\n`;
                    source += `  }\n\n`;
                }
            }
        });
        
        source += '}\n\n';
        
        // Instance Class - try to get actual instance and extract its structure
        source += `class ${className}Instance extends IAlgorithmInstance {\n`;
        source += '  constructor(algorithm, isInverse = false) {\n';
        source += '    super(algorithm);\n';
        source += '    this.isInverse = isInverse;\n';
        
        // Try to get actual instance to see its properties
        try {
            if (algorithm.CreateInstance) {
                const instance = algorithm.CreateInstance(false);
                if (instance) {
                    // Add instance properties
                    Object.getOwnPropertyNames(instance).forEach(propName => {
                        if (!propName.startsWith('_') && typeof instance[propName] !== 'function') {
                            const value = instance[propName];
                            if (typeof value === 'string') {
                                source += `    this.${propName} = "${value}";\n`;
                            } else if (typeof value === 'number') {
                                source += `    this.${propName} = ${value};\n`;
                            } else if (typeof value === 'boolean') {
                                source += `    this.${propName} = ${value};\n`;
                            } else if (Array.isArray(value)) {
                                source += `    this.${propName} = [];\n`;
                            } else if (value === null) {
                                source += `    this.${propName} = null;\n`;
                            }
                        }
                    });
                }
            }
        } catch (e) {
            // Fallback properties
            source += '    this.inputBuffer = [];\n';
        }
        
        source += '  }\n\n';
        
        // Add instance methods
        try {
            if (algorithm.CreateInstance) {
                const instance = algorithm.CreateInstance(false);
                if (instance) {
                    // Get prototype methods
                    const prototype = Object.getPrototypeOf(instance);
                    Object.getOwnPropertyNames(prototype).forEach(methodName => {
                        if (methodName !== 'constructor' && typeof instance[methodName] === 'function') {
                            try {
                                const methodSource = instance[methodName].toString();
                                if (methodSource && !methodSource.includes('[native code]')) {
                                    source += `  // ${methodName} method\n`;
                                    source += `  ${methodSource}\n\n`;
                                }
                            } catch (e) {
                                // Add placeholder
                                source += `  // ${methodName} method\n`;
                                source += `  ${methodName}() {\n`;
                                source += `    // Implementation not accessible\n`;
                                source += `  }\n\n`;
                            }
                        }
                    });
                    
                    // Get instance methods
                    Object.getOwnPropertyNames(instance).forEach(propName => {
                        if (typeof instance[propName] === 'function' && propName !== 'constructor') {
                            try {
                                const methodSource = instance[propName].toString();
                                if (methodSource && !methodSource.includes('[native code]')) {
                                    source += `  // ${propName} method\n`;
                                    source += `  ${methodSource}\n\n`;
                                }
                            } catch (e) {
                                // Skip
                            }
                        }
                    });
                }
            }
        } catch (e) {
            // Add standard methods as placeholders
            source += '  Feed(data) {\n';
            source += '    // Implementation not accessible\n';
            source += '  }\n\n';
            source += '  Result() {\n';
            source += '    // Implementation not accessible\n';
            source += '  }\n\n';
        }
        
        source += '}\n\n';
        
        // Registration
        source += `// Register the algorithm\n`;
        source += `RegisterAlgorithm(new ${className}());\n`;
        
        return source;
    }

    /**
     * Generate a more accurate JavaScript template when actual source isn't available
     */
    generateActualJavaScriptTemplate(algorithm) {
        const config = this.getCodeGenerationConfig();
        
        let code = '';
        
        if (config.includeComments) {
            code += `/*\n * ${algorithm.name}\n * ${algorithm.description}\n`;
            if (algorithm.inventor) code += ` * Inventor: ${algorithm.inventor}\n`;
            if (algorithm.year && algorithm.year !== 2025) code += ` * Year: ${algorithm.year}\n`;
            if (algorithm.country) code += ` * Origin: ${algorithm.country.name}\n`;
            code += ' */\n\n';
        }
        
        // Import statement
        code += '// Import AlgorithmFramework\n';
        code += 'const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,\n';
        code += '        CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;\n\n';
        
        const className = algorithm.name.replace(/[^a-zA-Z0-9]/g, '');
        
        // Main algorithm class with actual metadata
        code += `class ${className} extends CryptoAlgorithm {\n`;
        code += '  constructor() {\n';
        code += '    super();\n\n';
        
        // Real algorithm metadata
        code += `    this.name = "${algorithm.name}";\n`;
        code += `    this.description = "${algorithm.description}";\n`;
        if (algorithm.inventor) code += `    this.inventor = "${algorithm.inventor}";\n`;
        if (algorithm.year && algorithm.year !== 2025) code += `    this.year = ${algorithm.year};\n`;
        if (algorithm.category) code += `    this.category = CategoryType.${algorithm.category.name.toUpperCase().replace(/\s+/g, '_')};\n`;
        if (algorithm.securityStatus) code += `    this.securityStatus = SecurityStatus.${algorithm.securityStatus.name.toUpperCase()};\n`;
        if (algorithm.complexity) code += `    this.complexity = ComplexityType.${algorithm.complexity.name.toUpperCase()};\n`;
        if (algorithm.country) code += `    this.country = CountryCode.${algorithm.country.name.replace(/\s+/g, '_').toUpperCase()};\n`;
        if (algorithm.keySize) code += `    this.keySize = ${algorithm.keySize};\n`;
        if (algorithm.blockSize) code += `    this.blockSize = ${algorithm.blockSize};\n`;
        
        // Test vectors if requested and available
        if (config.includeTests && algorithm.tests && algorithm.tests.length > 0) {
            code += '\n    // Test Vectors\n';
            code += '    this.tests = [\n';
            algorithm.tests.slice(0, 3).forEach((test, i) => {
                code += '      {\n';
                if (test.input) code += `        input: [${test.input.slice(0, 10).join(', ')}${test.input.length > 10 ? ', ...' : ''}],\n`;
                if (test.expected) code += `        expected: [${test.expected.slice(0, 10).join(', ')}${test.expected.length > 10 ? ', ...' : ''}],\n`;
                if (test.key !== undefined) code += `        key: ${Array.isArray(test.key) ? `[${test.key.join(', ')}]` : test.key},\n`;
                if (test.shift !== undefined) code += `        shift: ${test.shift},\n`;
                code += '      }' + (i < Math.min(algorithm.tests.length, 3) - 1 ? ',' : '') + '\n';
            });
            if (algorithm.tests.length > 3) {
                code += `      // ... ${algorithm.tests.length - 3} more test vectors\n`;
            }
            code += '    ];\n';
        }
        
        code += '  }\n\n';
        
        // CreateInstance method
        code += '  // Create algorithm instance\n';
        code += '  CreateInstance(isInverse = false) {\n';
        code += `    return new ${className}Instance(this, isInverse);\n`;
        code += '  }\n';
        code += '}\n\n';
        
        // Instance class
        code += `// Algorithm Instance Implementation\n`;
        code += `class ${className}Instance extends IAlgorithmInstance {\n`;
        code += '  constructor(algorithm, isInverse = false) {\n';
        code += '    super(algorithm);\n';
        code += '    this.isInverse = isInverse;\n';
        code += '    this.inputBuffer = [];\n';
        
        // Add algorithm-specific properties
        if (algorithm.name.toLowerCase().includes('caesar')) {
            code += '    this.shift = 3; // Default Caesar shift\n';
        } else if (algorithm.name.toLowerCase().includes('vigenere')) {
            code += '    this.keyword = "KEY"; // Default Vigenère keyword\n';
        } else if (algorithm.keySize) {
            code += `    this.key = null; // ${algorithm.keySize}-bit key\n`;
        }
        
        code += '  }\n\n';
        
        // Feed method
        code += '  // Feed data to the algorithm\n';
        code += '  Feed(data) {\n';
        code += '    if (!data || data.length === 0) return;\n';
        code += '    this.inputBuffer.push(...data);\n';
        code += '  }\n\n';
        
        // Result method
        code += '  // Get processed result\n';
        code += '  Result() {\n';
        code += '    if (this.inputBuffer.length === 0) return [];\n';
        code += '    \n';
        code += '    const output = this.processData(this.inputBuffer);\n';
        code += '    this.inputBuffer = []; // Clear buffer\n';
        code += '    return output;\n';
        code += '  }\n\n';
        
        // Core algorithm method with hints based on algorithm type
        code += '  // Core algorithm implementation\n';
        code += '  processData(data) {\n';
        
        if (algorithm.name.toLowerCase().includes('caesar')) {
            code += '    // Caesar cipher implementation\n';
            code += '    return data.map(byte => {\n';
            code += '      if (byte >= 65 && byte <= 90) { // A-Z\n';
            code += '        return ((byte - 65 + this.shift) % 26) + 65;\n';
            code += '      } else if (byte >= 97 && byte <= 122) { // a-z\n';
            code += '        return ((byte - 97 + this.shift) % 26) + 97;\n';
            code += '      }\n';
            code += '      return byte; // Non-alphabetic characters unchanged\n';
            code += '    });\n';
        } else if (algorithm.name.toLowerCase().includes('base64')) {
            code += '    // Base64 encoding/decoding implementation\n';
            code += '    // Implementation would go here\n';
            code += '    return data; // Placeholder\n';
        } else {
            code += '    // Algorithm-specific processing logic\n';
            code += '    // Implementation would go here\n';
            code += '    return data; // Placeholder\n';
        }
        
        code += '  }\n';
        code += '}\n\n';
        
        // Registration
        code += '// Register the algorithm\n';
        code += `RegisterAlgorithm(new ${className}());\n`;
        
        // Usage example if requested
        if (config.includeExamples) {
            code += '\n// Usage Example\n';
            code += `const cipher = new ${className}();\n`;
            code += 'const instance = cipher.CreateInstance();\n';
            code += 'instance.Feed(OpCodes.AnsiToBytes("Hello World"));\n';
            code += 'const result = instance.Result();\n';
            code += 'DebugConfig.log(OpCodes.BytesToAnsi(result));';
        }
        
        return code;
    }
    
    /**
     * Generate fallback code when MultiLanguageGenerator is not available
     */
    generateFallbackCode(languageKey) {
        const algorithm = this.currentAlgorithm;
        
        // Create a better fallback that shows the actual algorithm structure
        return this.generateAlgorithmStructureCode(algorithm, languageKey);
    }

    /**
     * Generate code showing the actual algorithm structure and implementation pattern
     */
    generateAlgorithmStructureCode(algorithm, languageKey) {
        const config = this.getCodeGenerationConfig();
        
        switch (languageKey) {
            case 'javascript':
                return this.generateJavaScriptStructure(algorithm, config);
            case 'python':
                return this.generatePythonStructure(algorithm, config);
            case 'cpp':
                return this.generateCppStructure(algorithm, config);
            case 'java':
                return this.generateJavaStructure(algorithm, config);
            default:
                return this.generateGenericStructure(algorithm, languageKey, config);
        }
    }
    
    /**
     * Generate JavaScript structure showing real AlgorithmFramework implementation
     */
    generateJavaScriptStructure(algorithm, config) {
        let code = '';
        
        if (config.includeComments) {
            code += `/*\n * ${algorithm.name}\n * ${algorithm.description}\n`;
            if (algorithm.inventor) code += ` * Inventor: ${algorithm.inventor}\n`;
            if (algorithm.year && algorithm.year !== 2025) code += ` * Year: ${algorithm.year}\n`;
            if (algorithm.country) code += ` * Origin: ${algorithm.country.name}\n`;
            code += ' */\n\n';
        }
        
        // Show the actual AlgorithmFramework structure
        code += '// AlgorithmFramework Implementation\n';
        code += 'const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,\n';
        code += '        CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;\n\n';
        
        const className = algorithm.name.replace(/[^a-zA-Z0-9]/g, '');
        code += `class ${className} extends CryptoAlgorithm {\n`;
        code += '  constructor() {\n';
        code += '    super();\n\n';
        
        // Show actual metadata
        code += '    // Algorithm Metadata\n';
        code += `    this.name = "${algorithm.name}";\n`;
        code += `    this.description = "${algorithm.description}";\n`;
        if (algorithm.inventor) code += `    this.inventor = "${algorithm.inventor}";\n`;
        if (algorithm.year && algorithm.year !== 2025) code += `    this.year = ${algorithm.year};\n`;
        if (algorithm.category) code += `    this.category = CategoryType.${algorithm.category.name.toUpperCase().replace(/\\s+/g, '_')};\n`;
        if (algorithm.securityStatus) code += `    this.securityStatus = SecurityStatus.${algorithm.securityStatus.name.toUpperCase()};\n`;
        if (algorithm.complexity) code += `    this.complexity = ComplexityType.${algorithm.complexity.name.toUpperCase()};\n`;
        if (algorithm.country) code += `    this.country = CountryCode.${algorithm.country.name.replace(/\\s+/g, '_').toUpperCase()};\n`;
        
        // Show test vectors if requested
        if (config.includeTests && algorithm.tests && algorithm.tests.length > 0) {
            code += '\n    // Test Vectors\n';
            code += '    this.tests = [\n';
            algorithm.tests.slice(0, 2).forEach((test, i) => {
                code += '      {\n';
                if (test.text) code += `        text: "${test.text}",\n`;
                if (test.uri) code += `        uri: "${test.uri}",\n`;
                code += '        input: OpCodes.AnsiToBytes("' + (test.input ? 'test_input' : '') + '"),\n';
                if (test.key) code += '        key: OpCodes.AnsiToBytes("test_key"),\n';
                if (test.shift !== undefined) code += `        shift: ${test.shift},\n`;
                code += '        expected: OpCodes.AnsiToBytes("expected_output")\n';
                code += '      }' + (i < Math.min(algorithm.tests.length, 2) - 1 ? ',' : '') + '\n';
            });
            if (algorithm.tests.length > 2) {
                code += `      // ... ${algorithm.tests.length - 2} more test vectors\n`;
            }
            code += '    ];\n';
        }
        
        code += '  }\n\n';
        code += '  // Create algorithm instance\n';
        code += '  CreateInstance(isInverse = false) {\n';
        code += `    return new ${className}Instance(this, isInverse);\n`;
        code += '  }\n';
        code += '}\n\n';
        
        // Show instance implementation pattern
        code += `// Algorithm Instance Implementation\n`;
        code += `class ${className}Instance extends IAlgorithmInstance {\n`;
        code += '  constructor(algorithm, isInverse = false) {\n';
        code += '    super(algorithm);\n';
        code += '    this.isInverse = isInverse;\n';
        if (algorithm.name.toLowerCase().includes('caesar')) {
            code += '    this.shift = 3; // Default Caesar shift\n';
        }
        code += '    this.inputBuffer = [];\n';
        code += '  }\n\n';
        
        code += '  // Feed data to the algorithm\n';
        code += '  Feed(data) {\n';
        code += '    if (!data || data.length === 0) return;\n';
        code += '    this.inputBuffer.push(...data);\n';
        code += '  }\n\n';
        
        code += '  // Get processed result\n';
        code += '  Result() {\n';
        code += '    if (this.inputBuffer.length === 0) return [];\n';
        code += '    \n';
        code += '    // Algorithm-specific processing logic would go here\n';
        code += '    const output = this.processData(this.inputBuffer);\n';
        code += '    this.inputBuffer = []; // Clear buffer\n';
        code += '    return output;\n';
        code += '  }\n\n';
        
        code += '  // Core algorithm implementation\n';
        code += '  processData(data) {\n';
        code += '    // Implement the actual algorithm logic here\n';
        code += '    return data; // Placeholder\n';
        code += '  }\n';
        code += '}\n\n';
        
        code += '// Register the algorithm\n';
        code += `RegisterAlgorithm(new ${className}());\n`;
        
        if (config.includeExamples) {
            code += '\n// Usage Example\n';
            code += `const cipher = new ${className}();\n`;
            code += 'const instance = cipher.CreateInstance();\n';
            code += 'instance.Feed(OpCodes.AnsiToBytes("Hello World"));\n';
            code += 'const result = instance.Result();\n';
            code += 'DebugConfig.log(OpCodes.BytesToAnsi(result));';
        }
        
        return code;
    }
    
    /**
     * Generate Python structure showing AlgorithmFramework implementation
     */
    generatePythonStructure(algorithm, config) {
        let code = '';
        
        if (config.includeComments) {
            code += `"""\n${algorithm.name}\n${algorithm.description}\n`;
            if (algorithm.inventor) code += `Inventor: ${algorithm.inventor}\n`;
            if (algorithm.year && algorithm.year !== 2025) code += `Year: ${algorithm.year}\n`;
            if (algorithm.country) code += `Origin: ${algorithm.country.name}\n`;
            code += '"""\n\n';
        }
        
        const className = algorithm.name.replace(/[^a-zA-Z0-9]/g, '');
        code += `class ${className}:\n`;
        code += `    """${algorithm.description}"""\n\n`;
        code += '    def __init__(self):\n';
        code += `        self.name = "${algorithm.name}"\n`;
        code += `        self.description = "${algorithm.description}"\n`;
        if (algorithm.inventor) code += `        self.inventor = "${algorithm.inventor}"\n`;
        if (algorithm.year && algorithm.year !== 2025) code += `        self.year = ${algorithm.year}\n`;
        code += '\n';
        
        code += '    def create_instance(self, is_inverse=False):\n';
        code += `        """Create an instance of the ${algorithm.name} algorithm"""\n`;
        code += `        return ${className}Instance(self, is_inverse)\n\n`;
        
        code += `class ${className}Instance:\n`;
        code += '    """Algorithm instance for processing data"""\n\n';
        code += '    def __init__(self, algorithm, is_inverse=False):\n';
        code += '        self.algorithm = algorithm\n';
        code += '        self.is_inverse = is_inverse\n';
        code += '        self.input_buffer = []\n\n';
        
        code += '    def feed(self, data):\n';
        code += '        """Feed data to the algorithm"""\n';
        code += '        if data:\n';
        code += '            self.input_buffer.extend(data)\n\n';
        
        code += '    def result(self):\n';
        code += '        """Get the processed result"""\n';
        code += '        if not self.input_buffer:\n';
        code += '            return []\n';
        code += '        \n';
        code += '        output = self.process_data(self.input_buffer)\n';
        code += '        self.input_buffer = []\n';
        code += '        return output\n\n';
        
        code += '    def process_data(self, data):\n';
        code += '        """Core algorithm implementation"""\n';
        code += '        # Implement algorithm logic here\n';
        code += '        return data  # Placeholder\n';
        
        if (config.includeExamples) {
            code += '\n# Usage Example\n';
            code += `cipher = ${className}()\n`;
            code += 'instance = cipher.create_instance()\n';
            code += 'instance.feed(b"Hello World")\n';
            code += 'result = instance.result()\n';
            code += 'print(result)';
        }
        
        return code;
    }

    /**
     * Generate C++ structure showing AlgorithmFramework implementation  
     */
    generateCppStructure(algorithm, config) {
        let code = '';
        
        if (config.includeComments) {
            code += `/*\n * ${algorithm.name}\n * ${algorithm.description}\n`;
            if (algorithm.inventor) code += ` * Inventor: ${algorithm.inventor}\n`;
            if (algorithm.year && algorithm.year !== 2025) code += ` * Year: ${algorithm.year}\n`;
            if (algorithm.country) code += ` * Origin: ${algorithm.country.name}\n`;
            code += ' */\n\n';
        }
        
        code += '#include <vector>\n#include <cstdint>\n#include <string>\n\n';
        
        const className = algorithm.name.replace(/[^a-zA-Z0-9]/g, '');
        code += `class ${className} {\npublic:\n`;
        code += `    // ${algorithm.description}\n\n`;
        code += '    class Instance {\n';
        code += '    private:\n';
        code += '        std::vector<uint8_t> inputBuffer;\n';
        code += '        bool isInverse;\n\n';
        code += '    public:\n';
        code += '        Instance(bool inverse = false) : isInverse(inverse) {}\n\n';
        code += '        void Feed(const std::vector<uint8_t>& data) {\n';
        code += '            inputBuffer.insert(inputBuffer.end(), data.begin(), data.end());\n';
        code += '        }\n\n';
        code += '        std::vector<uint8_t> Result() {\n';
        code += '            if (inputBuffer.empty()) return {};\n';
        code += '            \n';
        code += '            auto output = ProcessData(inputBuffer);\n';
        code += '            inputBuffer.clear();\n';
        code += '            return output;\n';
        code += '        }\n\n';
        code += '    private:\n';
        code += '        std::vector<uint8_t> ProcessData(const std::vector<uint8_t>& data) {\n';
        code += '            // Implement algorithm logic here\n';
        code += '            return data; // Placeholder\n';
        code += '        }\n';
        code += '    };\n\n';
        code += '    Instance CreateInstance(bool isInverse = false) {\n';
        code += '        return Instance(isInverse);\n';
        code += '    }\n';
        code += '};';
        
        return code;
    }

    /**
     * Generate Java structure showing AlgorithmFramework implementation
     */
    generateJavaStructure(algorithm, config) {
        let code = '';
        
        if (config.includeComments) {
            code += `/*\n * ${algorithm.name}\n * ${algorithm.description}\n`;
            if (algorithm.inventor) code += ` * Inventor: ${algorithm.inventor}\n`;
            if (algorithm.year && algorithm.year !== 2025) code += ` * Year: ${algorithm.year}\n`;
            if (algorithm.country) code += ` * Origin: ${algorithm.country.name}\n`;
            code += ' */\n\n';
        }
        
        code += 'import java.util.*;\n\n';
        
        const className = algorithm.name.replace(/[^a-zA-Z0-9]/g, '');
        code += `public class ${className} {\n`;
        code += `    // ${algorithm.description}\n\n`;
        
        code += '    public static class Instance {\n';
        code += '        private List<Byte> inputBuffer = new ArrayList<>();\n';
        code += '        private boolean isInverse;\n\n';
        
        code += '        public Instance(boolean isInverse) {\n';
        code += '            this.isInverse = isInverse;\n';
        code += '        }\n\n';
        
        code += '        public void feed(byte[] data) {\n';
        code += '            for (byte b : data) {\n';
        code += '                inputBuffer.add(b);\n';
        code += '            }\n';
        code += '        }\n\n';
        
        code += '        public byte[] result() {\n';
        code += '            if (inputBuffer.isEmpty()) return new byte[0];\n';
        code += '            \n';
        code += '            byte[] data = new byte[inputBuffer.size()];\n';
        code += '            for (int i = 0; i < inputBuffer.size(); i++) {\n';
        code += '                data[i] = inputBuffer.get(i);\n';
        code += '            }\n';
        code += '            \n';
        code += '            byte[] output = processData(data);\n';
        code += '            inputBuffer.clear();\n';
        code += '            return output;\n';
        code += '        }\n\n';
        
        code += '        private byte[] processData(byte[] data) {\n';
        code += '            // Implement algorithm logic here\n';
        code += '            return data; // Placeholder\n';
        code += '        }\n';
        code += '    }\n\n';
        
        code += '    public Instance createInstance(boolean isInverse) {\n';
        code += '        return new Instance(isInverse);\n';
        code += '    }\n';
        code += '}';
        
        return code;
    }

    /**
     * Generate generic structure for unsupported languages
     */
    generateGenericStructure(algorithm, languageKey, config) {
        let code = `# ${algorithm.name} - ${algorithm.description}\n\n`;
        
        if (algorithm.category) {
            code += `# Category: ${algorithm.category.name}\n`;
        }
        if (algorithm.inventor) {
            code += `# Inventor: ${algorithm.inventor}\n`;
        }
        if (algorithm.year && algorithm.year !== 2025) {
            code += `# Year: ${algorithm.year}\n`;
        }
        if (algorithm.country) {
            code += `# Origin: ${algorithm.country.name}\n`;
        }
        
        code += '\n# AlgorithmFramework Implementation Pattern\n';
        code += '# This shows the structure that would be used in the universal cipher framework\n\n';
        
        code += `# Main Algorithm Class\n`;
        code += `class Algorithm {\n`;
        code += `    name: "${algorithm.name}"\n`;
        code += `    description: "${algorithm.description}"\n`;
        code += `    category: ${algorithm.category ? algorithm.category.name : 'Unknown'}\n`;
        if (algorithm.securityStatus) {
            code += `    securityStatus: ${algorithm.securityStatus.name}\n`;
        }
        code += '\n';
        code += `    CreateInstance(isInverse) -> AlgorithmInstance\n`;
        code += '}\n\n';
        
        code += '# Algorithm Instance Class\n';
        code += 'class AlgorithmInstance {\n';
        code += '    Feed(data: bytes[]) -> void\n';
        code += '    Result() -> bytes[]\n';
        code += '}\n\n';
        
        code += `# Note: ${languageKey} code generation requires implementing the MultiLanguageGenerator\n`;
        code += '# for this specific language. The above shows the conceptual structure.';
        
        return code;
    }
    
    /**
     * Switch language in code tab
     */
    switchLanguage(languageKey) {
        if (!this.element) {
            throw new Error('AlgorithmDetails: Modal not available for language switching');
        }
        
        // Update active button
        const languageButtons = this.element.querySelectorAll('.language-btn');
        languageButtons.forEach(btn => {
            const isActive = btn.getAttribute('data-language') === languageKey;
            btn.classList.toggle('active', isActive);
        });
        
        // Update language display
        const languageDisplay = this.element.querySelector('#current-language');
        if (languageDisplay) {
            // Get language name
            let languageName = languageKey;
            if (typeof window !== 'undefined' && window.MultiLanguageGenerator) {
                const langInfo = window.MultiLanguageGenerator.getLanguageInfo(languageKey);
                if (langInfo) {
                    languageName = langInfo.name;
                }
        }
        languageDisplay.textContent = languageName;
        }
        
        // Update code display with async loading
        const codeElement = this.element.querySelector('#generated-code code');
        if (codeElement) {
            this.loadCodeAsync(languageKey, codeElement);
        }
        
        // Store current language
        this.currentLanguage = languageKey;
    }    /**
     * Copy current code to clipboard
     */
    copyCurrentCode() {
        const codeElement = this.element.querySelector('#generated-code code');
        if (!codeElement) {
            throw new Error('AlgorithmDetails: Code element not found for copying');
        }
        
        const codeText = codeElement.textContent;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(codeText).then(() => {
                // Show success feedback
                const copyBtn = this.element.querySelector('.code-copy-btn');
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✅ Copied';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            }).catch(err => {
                DebugConfig.error('Failed to copy code:', err);
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = codeText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }
    
    /**
     * Download current code as file
     */
    downloadCurrentCode() {
        const codeElement = this.element.querySelector('#generated-code code');
        if (!codeElement) {
            throw new Error('AlgorithmDetails: Code element not found for download');
        }
        
        const codeText = codeElement.textContent;
        const algorithm = this.currentAlgorithm;
        const language = this.currentLanguage || 'javascript';
        
        // Get file extension
        let extension = '.txt';
        if (typeof window !== 'undefined' && window.MultiLanguageGenerator) {
            const langInfo = window.MultiLanguageGenerator.getLanguageInfo(language);
            if (langInfo && langInfo.extension) {
                extension = langInfo.extension;
            }
        } else {
            const extensionMap = {
                'javascript': '.js',
                'python': '.py',
                'cpp': '.cpp',
                'java': '.java'
            };
            extension = extensionMap[language] || '.txt';
        }
        
        // Create and download file
        const filename = `${algorithm.name.replace(/\s+/g, '_').toLowerCase()}${extension}`;
        const blob = new Blob([codeText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Apply syntax highlighting to code element using Prism.js
     */
    applySyntaxHighlighting(codeElement, languageKey) {
        if (!window.Prism || !codeElement) {
            DebugConfig.warn('Prism not available or no code element');
            return;
        }
        
        try {
            
            // Remove existing highlighting classes
            codeElement.className = codeElement.className.replace(/language-[^\s]*/g, '');
            
            // Map language keys to Prism language identifiers
            const languageMap = {
                'javascript': 'javascript',
                'python': 'python', 
                'cpp': 'cpp',
                'java': 'java',
                'rust': 'rust',
                'csharp': 'csharp',
                'kotlin': 'kotlin',
                'perl': 'perl',
                'freebasic': 'basic',
                'delphi': 'pascal',
                'go': 'go'
            };
            
            const prismLanguage = languageMap[languageKey] || languageKey;
            
            // Check if the language is supported by Prism
            const supportedLanguages = Object.keys(Prism.languages);
            const finalLanguage = supportedLanguages.includes(prismLanguage) ? prismLanguage : 'javascript';
            
            // Add the language class for Prism
            codeElement.classList.add(`language-${finalLanguage}`);
            
            // Clear any existing Prism highlighting
            codeElement.removeAttribute('data-highlighted');
            
            // For line-numbered code, we need to highlight each line content separately
            if (codeElement.querySelector('.code-line')) {
                const lineContents = codeElement.querySelectorAll('.line-content');
                lineContents.forEach(lineContent => {
                    if (lineContent.textContent.trim()) {
                        lineContent.classList.add(`language-${finalLanguage}`);
                        lineContent.removeAttribute('data-highlighted');
                        Prism.highlightElement(lineContent);
                    }
                });
            } else {
                // Standard highlighting for non-line-numbered code
                Prism.highlightElement(codeElement);
            }
        } catch (error) {
            DebugConfig.warn('Syntax highlighting failed:', error);
            // Fallback - just add a basic language class
            codeElement.classList.add('language-javascript');
            codeElement.removeAttribute('data-highlighted');
            try {
                Prism.highlightElement(codeElement);
            } catch (fallbackError) {
                DebugConfig.warn('Fallback highlighting also failed:', fallbackError);
            }
        }
    }

    /**
     * Toggle word wrap in code display
     */
    toggleWordWrap() {
        if (!this.element) {
            throw new Error('AlgorithmDetails: Modal not available for word wrap toggle');
        }
        
        const codeContent = this.element.querySelector('#generated-code');
        const toggleBtn = this.element.querySelector('#toggle-word-wrap');
        
        if (!codeContent || !toggleBtn) {
            throw new Error('AlgorithmDetails: Code elements not found for word wrap toggle');
        }
        
        const isWrapped = codeContent.classList.contains('word-wrap');
        
        if (isWrapped) {
            codeContent.classList.remove('word-wrap');
            toggleBtn.textContent = '📄 Wrap';
            toggleBtn.classList.remove('active');
        } else {
            codeContent.classList.add('word-wrap');
            toggleBtn.textContent = '📄 No Wrap';
            toggleBtn.classList.add('active');
        }
    }

    /**
     * Toggle line numbers in code display using Prism's line-numbers plugin
     */
    toggleLineNumbers() {
        if (!this.element) {
            throw new Error('AlgorithmDetails: Modal not available for line numbers toggle');
        }
        
        const codeContainer = this.element.querySelector('#generated-code'); // This is the <pre> element
        const toggleBtn = this.element.querySelector('#toggle-line-numbers');
        
        if (!codeContainer || !toggleBtn) {
            throw new Error('AlgorithmDetails: Code elements not found for line numbers toggle');
        }
        
        const hasLineNumbers = codeContainer.classList.contains('line-numbers');
        
        if (hasLineNumbers) {
            codeContainer.classList.remove('line-numbers');
            toggleBtn.textContent = '🔢 Numbers';
            toggleBtn.classList.remove('active');
        } else {
            codeContainer.classList.add('line-numbers');
            toggleBtn.textContent = '🔢 No Numbers';
            toggleBtn.classList.add('active');
        }
        
        // Re-highlight to apply line numbers with Prism
        const codeElement = codeContainer.querySelector('code');
        if (codeElement && this.currentLanguage) {
            // For Prism line numbers to work, we need to re-process the element
            codeElement.removeAttribute('data-highlighted');
            this.applySyntaxHighlighting(codeElement, this.currentLanguage);
        }
    }

    /**
     * Add line numbers using Prism's line-numbers plugin
     */
    addLineNumbers() {
        // Prism handles line numbers automatically when line-numbers class is present
        // This method is kept for backward compatibility but delegates to Prism
        const codeContainer = this.element.querySelector('#generated-code');
        if (codeContainer) {
            codeContainer.classList.add('line-numbers');
            const codeElement = codeContainer.querySelector('code');
            if (codeElement && this.currentLanguage) {
                this.applySyntaxHighlighting(codeElement, this.currentLanguage);
            }
        }
    }

    /**
     * Remove line numbers using Prism's line-numbers plugin
     */
    removeLineNumbers() {
        // Prism handles line numbers automatically when line-numbers class is removed
        // This method is kept for backward compatibility but delegates to Prism
        const codeContainer = this.element.querySelector('#generated-code');
        if (codeContainer) {
            codeContainer.classList.remove('line-numbers');
            const codeElement = codeContainer.querySelector('code');
            if (codeElement && this.currentLanguage) {
                this.applySyntaxHighlighting(codeElement, this.currentLanguage);
            }
        }
    }

    /**
     * Clear all test results
     */
    clearAllResults() {
        if (!this.element) {
            throw new Error('AlgorithmDetails: Modal not available for clearing results');
        }
        
        const testItems = this.element.querySelectorAll('.test-vector-item');
        testItems.forEach(item => {
            const resultsContainer = item.querySelector('.test-results');
            if (resultsContainer) {
                resultsContainer.remove();
            }
        });
    }

    /**
     * Export test results to JSON
     */
    exportTestResults() {
        if (!this.currentAlgorithm) {
            throw new Error('AlgorithmDetails: No algorithm available for export');
        }
        
        const results = {
            algorithm: this.currentAlgorithm.name,
            timestamp: new Date().toISOString(),
            testResults: []
        };
        
        // Collect results from DOM
        const testItems = this.element.querySelectorAll('.test-vector-item');
        testItems.forEach((item, index) => {
            const resultsContainer = item.querySelector('.test-results');
            const statusEl = resultsContainer?.querySelector('.test-status');
            
            if (statusEl) {
                const success = statusEl.classList.contains('success');
                const status = statusEl.textContent.trim();
                
                results.testResults.push({
                    testIndex: index,
                    status: success ? 'PASSED' : 'FAILED',
                    details: status
                });
            }
        });
        
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentAlgorithm.name.replace(/\s+/g, '_')}_test_results.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Destroy the component
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.currentAlgorithm = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlgorithmDetails;
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.AlgorithmDetails = AlgorithmDetails;
}