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
        html += '<label class="config-label">Include Native Wrapper:</label>';
        html += '<input type="checkbox" id="include-native-wrapper" onchange="window.algorithmDetailsInstance.updateCodeGeneration()" title="Generate language-specific framework wrapper (e.g., C# SymmetricAlgorithm)">';
        html += '</div>';
        html += '<div class="config-row">';
        html += '<label class="config-label">Standalone Code:</label>';
        html += '<input type="checkbox" id="standalone-code" checked onchange="window.algorithmDetailsInstance.updateCodeGeneration()" title="Inline all OpCodes methods - no external dependencies">';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        // Language-specific options section (dynamically populated)
        html += '<div class="code-section" id="language-options-section" style="display: none;">';
        html += '<h3 class="section-title">Language-Specific Options</h3>';
        html += '<div class="code-config" id="language-options-container">';
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
        html += '<div class="code-section" style="margin-top: 10px;">';
        html += '<h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-color);">📦 Infrastructure Downloads</h4>';
        html += '<div style="display: flex; gap: 8px; flex-wrap: wrap;">';
        html += '<button class="code-download-btn" onclick="window.algorithmDetailsInstance.downloadOpCodes()" title="Download OpCodes library for this language">📥 OpCodes</button>';
        html += '<button class="code-download-btn" onclick="window.algorithmDetailsInstance.downloadAlgorithmFramework()" title="Download AlgorithmFramework for this language">📥 Framework</button>';
        html += '<button class="code-download-btn" onclick="window.algorithmDetailsInstance.downloadNativeWrapper()" title="Download language-specific framework wrapper (e.g., C# SymmetricAlgorithm)">📥 Native Wrapper</button>';
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
    async runSingleTest(testIndex) {
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
            // Execute the test (now async via TestEngine)
            const result = await this.executeTest(test);

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

            // Note: Expected output already shown in test vector card above, no need to duplicate

            if (result.error) {
                html += `<div class="test-error">Error: ${result.error}</div>`;
            }

            if (result.duration !== undefined) {
                html += `<div class="test-duration">Duration: ${result.duration.toFixed(2)}ms</div>`;
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
    async runAllTests() {
        if (!this.currentAlgorithm || !this.currentAlgorithm.tests) {
            throw new Error('AlgorithmDetails: No algorithm or tests available for execution');
        }

        const tests = this.currentAlgorithm.tests;

        // Run tests sequentially with small delays for UI responsiveness
        for (let i = 0; i < tests.length; i++) {
            await this.runSingleTest(i);

            // Small delay to allow UI to update
            if (i < tests.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // Final update after all tests complete
        this.updateAlgorithmTestResults();
    }

    /**
     * Execute a single test and return results
     * Uses TestEngine.TestVector to ensure consistency with automated tests
     */
    async executeTest(test) {
        const startTime = performance.now();

        try {
            // Use TestEngine.TestVector for 100% consistency with automated tests
            if (!window.TestEngine) {
                return {
                    success: false,
                    error: 'TestEngine not loaded - required for test execution',
                    expected: test.expected,
                    duration: performance.now() - startTime
                };
            }

            // TestEngine.TestVector takes (algorithmInstance, vector, index)
            const result = await window.TestEngine.TestVector(this.currentAlgorithm, test, 0);

            // Convert TestEngine result format to UI format
            return {
                success: result.passed,
                output: result.output,
                expected: result.expected,
                error: result.error,
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

            // Step 2.5: Ensure type libraries are initialized for proper type inference
            if (!window.TypeAwareJSASTTranspiler.typeLibrariesReady) {
                DebugConfig.log('⏳ Waiting for type libraries to initialize...');
                await window.TypeAwareJSASTTranspiler.initTypeLibraries();
                window.TypeAwareJSASTTranspiler.typeLibrariesReady = true;
                DebugConfig.log('✅ Type libraries initialized');
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
                let code = generationResult.code;

                // Append native wrapper if requested
                if (options.includeNativeWrapper) {
                    DebugConfig.log('🔧 Generating native framework wrapper...');
                    const wrapper = await this.generateNativeWrapper(algorithm, plugin);
                    if (wrapper) {
                        code += '\n\n' + wrapper;
                        DebugConfig.log('✅ Native wrapper appended to generated code');
                    }
                }

                return code;
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
        const includeComments = document.getElementById('include-comments')?.checked ?? true;
        const includeExamples = document.getElementById('include-examples')?.checked ?? true;
        const includeTests = document.getElementById('include-tests')?.checked ?? false;
        const includeNativeWrapper = document.getElementById('include-native-wrapper')?.checked ?? false;
        const standaloneCode = document.getElementById('standalone-code')?.checked ?? true;

        return {
            includeComments: includeComments,
            includeExamples: includeExamples,
            includeTestVectors: includeTests,
            includeNativeWrapper: includeNativeWrapper,
            standaloneCode: standaloneCode,
            stripComments: !includeComments,
            stripTestVectors: !includeTests,
            stripExamples: !includeExamples,
            removeDebugCode: true,
            addTypeAnnotations: true,
            addDocstrings: includeComments
        };
    }

    /**
     * Apply AST transformations based on options
     */
    applyASTTransformations(ast, options) {
        DebugConfig.log('🔧 Applying AST transformations:', options);

        // CRITICAL: Strip IIFE and UMD patterns FIRST before any other transformations
        // This unwraps the module wrapper to expose the actual algorithm code
        ast = this.stripIIFEAndUMDPatterns(ast);

        // Strip test vectors from AST if not included
        if (options.stripTestVectors) {
            ast = this.removeTestVectorsFromAST(ast);
        }

        // Strip examples from AST if not included
        if (options.stripExamples) {
            ast = this.removeExamplesFromAST(ast);
        }

        // Remove debug code
        if (options.removeDebugCode) {
            ast = this.removeDebugCodeFromAST(ast);
        }

        // Strip comments from AST if not included
        if (options.stripComments) {
            ast = this.removeCommentsFromAST(ast);
        }

        // Inline OpCodes methods for standalone code
        if (options.standaloneCode) {
            ast = this.inlineOpCodesInAST(ast);
        }

        return ast;
    }

    /**
     * Strip IIFE (Immediately Invoked Function Expression) and UMD (Universal Module Definition) patterns
     * This unwraps module wrappers to expose the actual algorithm code for transpilation
     *
     * Patterns detected:
     * 1. Simple IIFE: (function(global) { ... })(global);
     * 2. UMD Pattern: (function(root, factory) { if (typeof define...) ... })(globalThis, function(...) { ... });
     */
    stripIIFEAndUMDPatterns(ast) {
        DebugConfig.log('🔧 Stripping IIFE and UMD patterns from AST');

        if (!ast || !ast.body || !Array.isArray(ast.body)) {
            DebugConfig.log('⚠️  AST structure invalid for IIFE stripping');
            return ast;
        }

        const newBody = [];

        for (const statement of ast.body) {
            // Check if this is an expression statement containing a call expression (IIFE/UMD)
            if (statement.type === 'ExpressionStatement' &&
                statement.expression &&
                statement.expression.type === 'CallExpression') {

                const callExpr = statement.expression;

                // Pattern 1: Simple IIFE - (function(params) { body })(args)
                if (callExpr.callee && callExpr.callee.type === 'FunctionExpression') {
                    DebugConfig.log('✅ Detected simple IIFE pattern - unwrapping');
                    const functionBody = callExpr.callee.body;

                    if (functionBody && functionBody.type === 'BlockStatement' && functionBody.body) {
                        // Extract the function body statements and add to new body
                        newBody.push(...this.unwrapIIFEBody(functionBody.body));
                        continue;
                    }
                }

                // Pattern 2: UMD Pattern - (function(root, factory) { ... })(global, function(...) { ... })
                // The actual code is in the factory function (second argument)
                if (callExpr.arguments && callExpr.arguments.length >= 2) {
                    const factoryArg = callExpr.arguments[1];

                    if (factoryArg && factoryArg.type === 'FunctionExpression') {
                        DebugConfig.log('✅ Detected UMD pattern - extracting factory function');
                        const factoryBody = factoryArg.body;

                        if (factoryBody && factoryBody.type === 'BlockStatement' && factoryBody.body) {
                            // Extract the factory function body statements
                            newBody.push(...this.unwrapIIFEBody(factoryBody.body));
                            continue;
                        }
                    }
                }

                // Pattern 3: IIFE wrapped in parentheses - ((function() { ... })())
                if (callExpr.callee && callExpr.callee.type === 'CallExpression') {
                    const innerCall = callExpr.callee;
                    if (innerCall.callee && innerCall.callee.type === 'FunctionExpression') {
                        DebugConfig.log('✅ Detected nested IIFE pattern - unwrapping');
                        const functionBody = innerCall.callee.body;

                        if (functionBody && functionBody.type === 'BlockStatement' && functionBody.body) {
                            newBody.push(...this.unwrapIIFEBody(functionBody.body));
                            continue;
                        }
                    }
                }
            }

            // Not an IIFE/UMD pattern - keep as-is
            newBody.push(statement);
        }

        // Replace AST body with unwrapped content
        ast.body = newBody;
        DebugConfig.log(`✅ IIFE/UMD stripping complete - ${newBody.length} top-level statements`);

        return ast;
    }

    /**
     * Unwrap IIFE body statements, removing module export code
     */
    unwrapIIFEBody(bodyStatements) {
        const unwrapped = [];

        for (const stmt of bodyStatements) {
            // Skip 'use strict' directives at top level (will be added by language plugin if needed)
            if (stmt.type === 'ExpressionStatement' &&
                stmt.expression &&
                stmt.expression.type === 'Literal' &&
                stmt.expression.value === 'use strict') {
                DebugConfig.log('  → Skipping "use strict" directive');
                continue;
            }

            // Skip module export statements (CommonJS, AMD, global assignments)
            if (this.isModuleExportStatement(stmt)) {
                DebugConfig.log('  → Skipping module export statement');
                continue;
            }

            unwrapped.push(stmt);
        }

        return unwrapped;
    }

    /**
     * Check if a statement is a module export statement
     */
    isModuleExportStatement(stmt) {
        if (stmt.type !== 'ExpressionStatement' && stmt.type !== 'IfStatement') {
            return false;
        }

        // Check for: module.exports = ...
        if (stmt.type === 'ExpressionStatement' &&
            stmt.expression &&
            stmt.expression.type === 'AssignmentExpression') {
            const left = stmt.expression.left;

            if (left && left.type === 'MemberExpression' &&
                left.object && left.object.name === 'module' &&
                left.property && left.property.name === 'exports') {
                return true;
            }

            // Check for: global.OpCodes = ...
            if (left && left.type === 'MemberExpression' &&
                left.object && (left.object.name === 'global' || left.object.name === 'window' || left.object.name === 'root')) {
                return true;
            }
        }

        // Check for: if (typeof module !== 'undefined' && module.exports) { ... }
        if (stmt.type === 'IfStatement' && stmt.test) {
            const test = stmt.test;

            // Check for typeof checks on 'module', 'define', 'exports'
            if (test.type === 'BinaryExpression' || test.type === 'LogicalExpression') {
                const testStr = this.astNodeToString(test);
                if (testStr.includes('typeof module') ||
                    testStr.includes('typeof define') ||
                    testStr.includes('typeof exports') ||
                    testStr.includes('module.exports')) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Convert AST node to string for pattern matching (simple helper)
     */
    astNodeToString(node) {
        if (!node) return '';

        try {
            return JSON.stringify(node);
        } catch (e) {
            return '';
        }
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
        DebugConfig.log('🧹 Removing comments from AST');

        const removeCommentsFromNode = (node) => {
            if (!node || typeof node !== 'object') return node;

            // Remove leadingComments and trailingComments
            if (node.leadingComments) delete node.leadingComments;
            if (node.trailingComments) delete node.trailingComments;
            if (node.comments) delete node.comments;

            // Recursively process child nodes
            for (const key in node) {
                if (node.hasOwnProperty(key) && key !== 'leadingComments' && key !== 'trailingComments') {
                    if (Array.isArray(node[key])) {
                        node[key] = node[key].map(child => removeCommentsFromNode(child));
                    } else if (typeof node[key] === 'object' && node[key] !== null) {
                        node[key] = removeCommentsFromNode(node[key]);
                    }
                }
            }

            return node;
        };

        return removeCommentsFromNode(ast);
    }

    /**
     * Remove examples from AST
     */
    removeExamplesFromAST(ast) {
        DebugConfig.log('🧹 Removing examples from AST');

        const removeExamplesFromNode = (node) => {
            if (!node || typeof node !== 'object') return node;

            // Remove @example tags from JSDoc comments
            if (node.leadingComments) {
                node.leadingComments = node.leadingComments.filter(comment => {
                    if (comment.value && typeof comment.value === 'string') {
                        // Remove @example sections from JSDoc
                        comment.value = comment.value.replace(/@example[\s\S]*?(?=@\w+|$)/g, '');
                    }
                    return true;
                });
            }

            // Recursively process child nodes
            for (const key in node) {
                if (node.hasOwnProperty(key)) {
                    if (Array.isArray(node[key])) {
                        node[key] = node[key].map(child => removeExamplesFromNode(child));
                    } else if (typeof node[key] === 'object' && node[key] !== null) {
                        node[key] = removeExamplesFromNode(node[key]);
                    }
                }
            }

            return node;
        };

        return removeExamplesFromNode(ast);
    }

    /**
     * Inline OpCodes methods into AST for standalone code
     */
    inlineOpCodesInAST(ast) {
        DebugConfig.log('🔧 Inlining OpCodes methods for standalone code');

        // Collect all OpCodes method calls used in the algorithm
        const usedOpCodesMethods = new Set();

        const collectOpCodesUsage = (node) => {
            if (!node || typeof node !== 'object') return;

            // Check for OpCodes.MethodName() calls
            if (node.type === 'CallExpression' &&
                node.callee &&
                node.callee.type === 'MemberExpression' &&
                node.callee.object &&
                node.callee.object.name === 'OpCodes') {
                if (node.callee.property && node.callee.property.name) {
                    usedOpCodesMethods.add(node.callee.property.name);
                }
            }

            // Recursively search all child nodes
            for (const key in node) {
                if (node.hasOwnProperty(key)) {
                    if (Array.isArray(node[key])) {
                        node[key].forEach(child => collectOpCodesUsage(child));
                    } else if (typeof node[key] === 'object' && node[key] !== null) {
                        collectOpCodesUsage(node[key]);
                    }
                }
            }
        };

        collectOpCodesUsage(ast);

        DebugConfig.log(`📝 Found ${usedOpCodesMethods.size} OpCodes methods used:`, Array.from(usedOpCodesMethods));

        // For now, just mark that OpCodes inlining is needed
        // The actual inlining will be done by the language plugin when it sees options.standaloneCode = true
        ast._opCodesMethodsUsed = Array.from(usedOpCodesMethods);

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
                if (langInfo)
                    languageName = langInfo.name;
            }
            languageDisplay.textContent = languageName;
        }

        // Update language-specific options
        this.updateLanguageOptions(languageKey);

        // Update code display with async loading
        const codeElement = this.element.querySelector('#generated-code code');
        if (codeElement)
            this.loadCodeAsync(languageKey, codeElement);

        // Store current language
        this.currentLanguage = languageKey;
    }

    /**
     * Update language-specific options panel based on selected language
     */
    updateLanguageOptions(languageKey) {
        const optionsSection = this.element.querySelector('#language-options-section');
        const optionsContainer = this.element.querySelector('#language-options-container');
        if (!optionsSection || !optionsContainer) return;

        // Get language plugin
        let plugin = null;
        if (typeof window !== 'undefined' && window.LanguagePlugins)
            plugin = window.LanguagePlugins.GetByExtension(languageKey);

        if (!plugin || !plugin.options) {
            optionsSection.style.display = 'none';
            return;
        }

        // Store reference to plugin for constraint checking
        this._currentPlugin = plugin;

        // Build options UI
        let html = '';
        const options = plugin.options;
        const optionsMeta = plugin.optionsMeta || {};
        const optionConstraints = plugin.optionConstraints || {};

        // Group options by type for better organization
        const booleanOptions = [];
        const stringOptions = [];
        const selectOptions = [];

        // Default enum choices for common options (fallback if not defined in plugin)
        const defaultEnumChoices = {
            indent: [
                { value: '  ', label: '2 Spaces' },
                { value: '    ', label: '4 Spaces' },
                { value: '\t', label: 'Tab' }
            ]
        };

        for (const [key, value] of Object.entries(options)) {
            // Skip internal/formatting options that shouldn't be exposed
            if (key === 'lineEnding') continue;

            const label = this.formatOptionLabel(key);
            const optionId = `lang-opt-${key}`;
            const meta = optionsMeta[key];

            // Check if this option has enum choices defined in plugin metadata
            if (meta && meta.type === 'enum' && meta.choices) {
                selectOptions.push({
                    key, label, value, optionId,
                    choices: meta.choices
                });
            } else if (typeof value === 'boolean') {
                // Check constraints for boolean options
                const constraint = optionConstraints[key];
                const isEnabled = this.isOptionEnabled(key, options, optionConstraints);
                const disabledReason = constraint?.disabledReason || '';

                booleanOptions.push({ key, label, value, optionId, isEnabled, disabledReason });
            } else if (typeof value === 'string') {
                // Check for default enum choices
                if (defaultEnumChoices[key]) {
                    selectOptions.push({
                        key, label, value, optionId,
                        choices: defaultEnumChoices[key]
                    });
                } else if (this.isNameOption(key)) {
                    stringOptions.push({ key, label, value, optionId });
                }
                // Skip other string options that aren't name fields or enums
            }
        }

        // Render select options first (most important)
        for (const opt of selectOptions) {
            html += '<div class="config-row">';
            html += `<label class="config-label">${opt.label}:</label>`;
            html += `<select id="${opt.optionId}" onchange="window.algorithmDetailsInstance.onLanguageOptionChange('${opt.key}', this.value)">`;
            for (const choice of opt.choices) {
                const selected = choice.value === opt.value ? ' selected' : '';
                const description = choice.description ? ` title="${choice.description}"` : '';
                html += `<option value="${choice.value}"${selected}${description}>${choice.label}</option>`;
            }
            html += '</select>';
            html += '</div>';
        }

        // Render string options (namespace, package name, etc.)
        for (const opt of stringOptions) {
            html += '<div class="config-row">';
            html += `<label class="config-label">${opt.label}:</label>`;
            html += `<input type="text" id="${opt.optionId}" value="${opt.value}" onchange="window.algorithmDetailsInstance.onLanguageOptionChange('${opt.key}', this.value)" style="flex: 1; padding: 4px;">`;
            html += '</div>';
        }

        // Render boolean options in a compact grid
        if (booleanOptions.length > 0) {
            html += '<div class="config-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px;">';
            for (const opt of booleanOptions) {
                const checked = opt.value ? ' checked' : '';
                const disabled = opt.isEnabled ? '' : ' disabled';
                const disabledStyle = opt.isEnabled ? '' : ' opacity: 0.5;';
                const title = opt.isEnabled ? '' : ` title="${opt.disabledReason}"`;
                html += `<div class="config-row" style="margin: 0;${disabledStyle}"${title}>`;
                html += `<label class="config-label" style="font-size: 12px;">${opt.label}:</label>`;
                html += `<input type="checkbox" id="${opt.optionId}"${checked}${disabled} onchange="window.algorithmDetailsInstance.onLanguageOptionChange('${opt.key}', this.checked)">`;
                html += '</div>';
            }
            html += '</div>';
        }

        optionsContainer.innerHTML = html;
        optionsSection.style.display = html ? 'block' : 'none';
    }

    /**
     * Check if an option is a name/identifier field
     */
    isNameOption(key) {
        const nameKeys = ['namespace', 'packageName', 'unitName', 'namespaceName', 'className', 'moduleName'];
        return nameKeys.includes(key);
    }

    /**
     * Check if an option is enabled based on constraints
     */
    isOptionEnabled(optionKey, currentOptions, constraints) {
        const constraint = constraints[optionKey];
        if (!constraint || !constraint.enabledWhen) return true;

        // Check each constraint condition
        for (const [dependsOnKey, allowedValues] of Object.entries(constraint.enabledWhen)) {
            const currentValue = currentOptions[dependsOnKey];
            if (!allowedValues.includes(currentValue)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Format option key into human-readable label
     */
    formatOptionLabel(key) {
        // Convert camelCase to Title Case with spaces
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/Use /g, '')
            .replace(/Add /g, '')
            .trim();
    }

    /**
     * Handle language option change
     */
    onLanguageOptionChange(optionKey, value) {
        // Get current plugin and update its option
        if (typeof window !== 'undefined' && window.LanguagePlugins && this.currentLanguage) {
            const plugin = window.LanguagePlugins.GetByExtension(this.currentLanguage);
            if (plugin && plugin.options) {
                plugin.options[optionKey] = value;

                // If this option affects constraints of other options, refresh the UI
                if (plugin.optionConstraints) {
                    // Check if any constraint depends on this option
                    const affectsOthers = Object.values(plugin.optionConstraints).some(
                        constraint => constraint.enabledWhen && optionKey in constraint.enabledWhen
                    );
                    if (affectsOthers) {
                        // Refresh the options UI to update enabled/disabled states
                        this.updateLanguageOptions(this.currentLanguage);
                    }
                }

                // Regenerate code with new options
                this.updateCodeGeneration();
            }
        }
    }

    /**
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
     * Download OpCodes library for current language
     */
    async downloadOpCodes() {
        const language = this.currentLanguage || 'javascript';

        try {
            if (typeof InfrastructureGenerator === 'undefined') {
                alert('Infrastructure generator not loaded. Please reload the page.');
                return;
            }

            DebugConfig.log(`📦 Generating OpCodes for ${language}...`);
            const plugin = window.LanguagePlugins.GetByExtension(language);

            if (!plugin) {
                alert(`No plugin found for language: ${language}`);
                return;
            }

            // Generate OpCodes for this specific language
            const result = await InfrastructureGenerator._generateOpCodesForLanguage(
                await (await fetch('./OpCodes.js')).text(),
                plugin
            );

            if (result.success) {
                // Download the generated code
                const filename = `OpCodes.${plugin.extension}`;
                const blob = new Blob([result.code], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                DebugConfig.log(`✅ OpCodes downloaded for ${plugin.name}`);
            } else {
                alert(`Failed to generate OpCodes: ${result.error}`);
            }
        } catch (error) {
            DebugConfig.error('Error downloading OpCodes:', error);
            alert(`Error: ${error.message}`);
        }
    }

    /**
     * Download AlgorithmFramework for current language
     */
    async downloadAlgorithmFramework() {
        const language = this.currentLanguage || 'javascript';

        try {
            if (typeof InfrastructureGenerator === 'undefined') {
                alert('Infrastructure generator not loaded. Please reload the page.');
                return;
            }

            DebugConfig.log(`📦 Generating AlgorithmFramework for ${language}...`);
            const plugin = window.LanguagePlugins.GetByExtension(language);

            if (!plugin) {
                alert(`No plugin found for language: ${language}`);
                return;
            }

            // Generate AlgorithmFramework for this specific language
            const result = await InfrastructureGenerator._generateFrameworkForLanguage(
                await (await fetch('./AlgorithmFramework.js')).text(),
                plugin
            );

            if (result.success) {
                // Download the generated code
                const filename = `AlgorithmFramework.${plugin.extension}`;
                const blob = new Blob([result.code], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                DebugConfig.log(`✅ AlgorithmFramework downloaded for ${plugin.name}`);
            } else {
                alert(`Failed to generate AlgorithmFramework: ${result.error}`);
            }
        } catch (error) {
            DebugConfig.error('Error downloading AlgorithmFramework:', error);
            alert(`Error: ${error.message}`);
        }
    }

    /**
     * Download native framework wrapper for current language
     * Generates language-specific adapters (e.g., C# SymmetricAlgorithm, Java Cipher)
     */
    async downloadNativeWrapper() {
        const language = this.currentLanguage || 'javascript';
        const algorithm = this.currentAlgorithm;

        try {
            const plugin = window.LanguagePlugins.GetByExtension(language);

            if (!plugin) {
                alert(`No plugin found for language: ${language}`);
                return;
            }

            DebugConfig.log(`📦 Generating native wrapper for ${algorithm.name} in ${plugin.name}...`);

            // Generate native wrapper based on algorithm type and target language
            const wrapperCode = await this.generateNativeWrapper(algorithm, plugin);

            if (wrapperCode) {
                // Download the generated wrapper
                const filename = `${algorithm.name.replace(/\s+/g, '')}Wrapper.${plugin.extension}`;
                const blob = new Blob([wrapperCode], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                DebugConfig.log(`✅ Native wrapper downloaded for ${plugin.name}`);
            } else {
                alert(`Native wrapper not yet implemented for ${plugin.name}`);
            }
        } catch (error) {
            DebugConfig.error('Error downloading native wrapper:', error);
            alert(`Error: ${error.message}`);
        }
    }

    /**
     * Generate native framework wrapper code
     * Creates language-specific adapters that integrate with native crypto APIs
     */
    async generateNativeWrapper(algorithm, plugin) {
        // Detect algorithm category
        const category = algorithm.category?.name?.toLowerCase() || '';

        // Language-specific wrapper templates
        const wrappers = {
            'cs': this.generateCSharpWrapper(algorithm, category),
            'java': this.generateJavaWrapper(algorithm, category),
            'py': this.generatePythonWrapper(algorithm, category),
            'cpp': this.generateCppWrapper(algorithm, category)
        };

        return wrappers[plugin.extension] || null;
    }

    /**
     * Generate C# native wrapper (SymmetricAlgorithm, HashAlgorithm, etc.)
     */
    generateCSharpWrapper(algorithm, category) {
        const className = algorithm.name.replace(/[^a-zA-Z0-9]/g, '');
        const needsKey = algorithm.NeedsKey || algorithm.SupportedMacSizes;

        if (category.includes('mac')) {
            // MACs use HMAC base class
            return `using System;
using System.Security.Cryptography;

namespace Cipher.Wrappers
{
    /// <summary>
    /// C# HMAC wrapper for ${algorithm.name}
    /// Auto-generated from SynthelicZ Cipher Tools
    /// </summary>
    public class ${className}HMAC : HMAC
    {
        private readonly dynamic _instance;
        private byte[] _key;

        public ${className}HMAC()
        {
            HashName = "${algorithm.name}";
            HashSizeValue = ${algorithm.SupportedOutputSizes?.[0]?.minSize * 8 || algorithm.outputSize * 8 || 256};
        }

        public ${className}HMAC(byte[] key) : this()
        {
            Key = key;
        }

        public override byte[] Key
        {
            get => _key;
            set
            {
                _key = value;
                KeyValue = value;
            }
        }

        protected override void HashCore(byte[] array, int ibStart, int cbSize)
        {
            // Lazy initialization of instance
            if (_instance == null)
            {
                var algorithm = new ${className}();
                _instance = algorithm.CreateInstance(false);
                if (_instance.GetType().GetProperty("key") != null)
                    _instance.key = _key;
            }

            // Feed data to MAC algorithm
            byte[] input = new byte[cbSize];
            Array.Copy(array, ibStart, input, 0, cbSize);
            _instance.Feed(input);
        }

        protected override byte[] HashFinal()
        {
            // Get final MAC result
            return _instance.Result();
        }

        public override void Initialize()
        {
            // Reset by creating new instance
            var algorithm = new ${className}();
            _instance = algorithm.CreateInstance(false);
            if (_instance.GetType().GetProperty("key") != null && _key != null)
                _instance.key = _key;
        }
    }
}`;
        } else if (category.includes('hash') && needsKey) {
            // Keyed hashes use KeyedHashAlgorithm
            return `using System;
using System.Security.Cryptography;

namespace Cipher.Wrappers
{
    /// <summary>
    /// C# KeyedHashAlgorithm wrapper for ${algorithm.name}
    /// Auto-generated from SynthelicZ Cipher Tools
    /// </summary>
    public class ${className}Keyed : KeyedHashAlgorithm
    {
        private readonly dynamic _instance;

        public ${className}Keyed()
        {
            HashSizeValue = ${algorithm.SupportedOutputSizes?.[0]?.minSize * 8 || 256};

            // Create algorithm instance
            var algorithm = new ${className}();
            _instance = algorithm.CreateInstance(false);
        }

        public ${className}Keyed(byte[] key) : this()
        {
            Key = key;
        }

        public override byte[] Key
        {
            get => KeyValue;
            set
            {
                KeyValue = value;
                if (_instance != null && _instance.GetType().GetProperty("key") != null)
                    _instance.key = value;
            }
        }

        protected override void HashCore(byte[] array, int ibStart, int cbSize)
        {
            byte[] input = new byte[cbSize];
            Array.Copy(array, ibStart, input, 0, cbSize);
            _instance.Feed(input);
        }

        protected override byte[] HashFinal()
        {
            return _instance.Result();
        }

        public override void Initialize()
        {
            var algorithm = new ${className}();
            _instance = algorithm.CreateInstance(false);
            if (KeyValue != null && _instance.GetType().GetProperty("key") != null)
                _instance.key = KeyValue;
        }
    }
}`;
        } else if (category.includes('block') || category.includes('stream')) {
            return `using System;
using System.Security.Cryptography;

namespace Cipher.Wrappers
{
    /// <summary>
    /// C# SymmetricAlgorithm wrapper for ${algorithm.name}
    /// Auto-generated from SynthelicZ Cipher Tools
    /// </summary>
    public class ${className}Managed : SymmetricAlgorithm
    {
        public ${className}Managed()
        {
            // Set algorithm-specific defaults
            KeySizeValue = ${algorithm.SupportedKeySizes?.[0]?.minSize * 8 || 128};
            BlockSizeValue = ${algorithm.SupportedBlockSizes?.[0]?.minSize * 8 || 128};
            FeedbackSizeValue = BlockSizeValue;

            LegalKeySizesValue = new KeySizes[] {
                new KeySizes(${algorithm.SupportedKeySizes?.[0]?.minSize * 8 || 128},
                             ${algorithm.SupportedKeySizes?.[0]?.maxSize * 8 || 256},
                             ${algorithm.SupportedKeySizes?.[0]?.step * 8 || 64})
            };

            LegalBlockSizesValue = new KeySizes[] {
                new KeySizes(${algorithm.SupportedBlockSizes?.[0]?.minSize * 8 || 128},
                             ${algorithm.SupportedBlockSizes?.[0]?.maxSize * 8 || 128},
                             ${algorithm.SupportedBlockSizes?.[0]?.step * 8 || 64})
            };
        }

        public override ICryptoTransform CreateEncryptor(byte[] rgbKey, byte[] rgbIV)
        {
            return new ${className}Transform(rgbKey, rgbIV, encrypting: true);
        }

        public override ICryptoTransform CreateDecryptor(byte[] rgbKey, byte[] rgbIV)
        {
            return new ${className}Transform(rgbKey, rgbIV, encrypting: false);
        }

        public override void GenerateKey()
        {
            KeyValue = new byte[KeySizeValue / 8];
            RandomNumberGenerator.Fill(KeyValue);
        }

        public override void GenerateIV()
        {
            IVValue = new byte[BlockSizeValue / 8];
            RandomNumberGenerator.Fill(IVValue);
        }
    }

    internal class ${className}Transform : ICryptoTransform
    {
        private readonly byte[] _key;
        private readonly byte[] _iv;
        private readonly bool _encrypting;
        private readonly dynamic _instance;

        public ${className}Transform(byte[] key, byte[] iv, bool encrypting)
        {
            _key = key;
            _iv = iv;
            _encrypting = encrypting;

            // Create algorithm instance (assumes generated ${className} class with CreateInstance method)
            var algorithm = new ${className}();
            _instance = algorithm.CreateInstance(!encrypting);
            _instance.key = key;
            if (iv != null && iv.Length > 0)
            {
                _instance.iv = iv;
            }
        }

        public int TransformBlock(byte[] inputBuffer, int inputOffset, int inputCount,
                                   byte[] outputBuffer, int outputOffset)
        {
            // Extract input block
            byte[] input = new byte[inputCount];
            Array.Copy(inputBuffer, inputOffset, input, 0, inputCount);

            // Process using generated algorithm
            _instance.Feed(input);
            byte[] output = _instance.Result();

            // Copy result to output buffer
            Array.Copy(output, 0, outputBuffer, outputOffset, output.Length);
            return output.Length;
        }

        public byte[] TransformFinalBlock(byte[] inputBuffer, int inputOffset, int inputCount)
        {
            byte[] output = new byte[inputCount];
            TransformBlock(inputBuffer, inputOffset, inputCount, output, 0);
            return output;
        }

        public int InputBlockSize => ${algorithm.SupportedBlockSizes?.[0]?.minSize || 16};
        public int OutputBlockSize => ${algorithm.SupportedBlockSizes?.[0]?.minSize || 16};
        public bool CanTransformMultipleBlocks => true;
        public bool CanReuseTransform => false;

        public void Dispose() { }
    }
}`;
        } else if (category.includes('hash')) {
            return `using System;
using System.Security.Cryptography;

namespace Cipher.Wrappers
{
    /// <summary>
    /// C# HashAlgorithm wrapper for ${algorithm.name}
    /// Auto-generated from SynthelicZ Cipher Tools
    /// </summary>
    public class ${className}Managed : HashAlgorithm
    {
        private readonly dynamic _instance;

        public ${className}Managed()
        {
            HashSizeValue = ${algorithm.SupportedOutputSizes?.[0]?.minSize * 8 || 256};

            // Create algorithm instance (assumes generated ${className} class with CreateInstance method)
            var algorithm = new ${className}();
            _instance = algorithm.CreateInstance(false);
        }

        protected override void HashCore(byte[] array, int ibStart, int cbSize)
        {
            // Extract input data
            byte[] input = new byte[cbSize];
            Array.Copy(array, ibStart, input, 0, cbSize);

            // Feed data to hash algorithm
            _instance.Feed(input);
        }

        protected override byte[] HashFinal()
        {
            // Get final hash result
            return _instance.Result();
        }

        public override void Initialize()
        {
            // Reset by creating new instance
            var algorithm = new ${className}();
            _instance = algorithm.CreateInstance(false);
        }
    }
}`;
        } else if (category.includes('random')) {
            return `using System;
using System.Security.Cryptography;

namespace Cipher.Wrappers
{
    /// <summary>
    /// C# RandomNumberGenerator wrapper for ${algorithm.name}
    /// Auto-generated from SynthelicZ Cipher Tools
    /// </summary>
    public class ${className}RandomNumberGenerator : RandomNumberGenerator
    {
        private readonly dynamic _instance;
        private bool _disposed = false;

        public ${className}RandomNumberGenerator()
        {
            // Create algorithm instance (assumes generated ${className} class with CreateInstance method)
            var algorithm = new ${className}();
            _instance = algorithm.CreateInstance(false);

            // Set seed if algorithm supports it
            if (_instance.GetType().GetProperty("seed") != null)
            {
                // Use cryptographically secure random seed
                byte[] seedBytes = new byte[${algorithm.SupportedSeedSizes?.[0]?.minSize || 4}];
                using (var rng = RandomNumberGenerator.Create())
                {
                    rng.GetBytes(seedBytes);
                }
                _instance.seed = seedBytes;
            }
        }

        public ${className}RandomNumberGenerator(byte[] seed)
        {
            // Create algorithm instance with custom seed
            var algorithm = new ${className}();
            _instance = algorithm.CreateInstance(false);

            if (_instance.GetType().GetProperty("seed") != null)
            {
                _instance.seed = seed;
            }
        }

        public override void GetBytes(byte[] data)
        {
            if (data == null)
                throw new ArgumentNullException(nameof(data));

            if (_disposed)
                throw new ObjectDisposedException(GetType().Name);

            // Generate random bytes using the algorithm
            for (int i = 0; i < data.Length; i++)
            {
                _instance.Feed(new byte[] { 0 }); // Request next random value
                byte[] result = _instance.Result();
                data[i] = result[0];
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (!_disposed)
            {
                _disposed = true;
            }
            base.Dispose(disposing);
        }
    }
}`;
        } else if (category.includes('kdf')) {
            return `using System;
using System.Security.Cryptography;

namespace Cipher.Wrappers
{
    /// <summary>
    /// C# DeriveBytes wrapper for ${algorithm.name}
    /// Auto-generated from SynthelicZ Cipher Tools
    /// </summary>
    public class ${className}DeriveBytes : DeriveBytes
    {
        private readonly dynamic _instance;
        private readonly byte[] _password;
        private readonly byte[] _salt;
        private readonly int _iterations;
        private bool _disposed = false;

        public ${className}DeriveBytes(byte[] password, byte[] salt, int iterations)
        {
            _password = password ?? throw new ArgumentNullException(nameof(password));
            _salt = salt ?? throw new ArgumentNullException(nameof(salt));
            _iterations = iterations;

            // Create algorithm instance
            var algorithm = new ${className}();
            _instance = algorithm.CreateInstance(false);

            // Set KDF parameters
            if (_instance.GetType().GetProperty("password") != null)
                _instance.password = _password;
            if (_instance.GetType().GetProperty("salt") != null)
                _instance.salt = _salt;
            if (_instance.GetType().GetProperty("iterations") != null)
                _instance.iterations = _iterations;
        }

        public ${className}DeriveBytes(string password, byte[] salt, int iterations)
            : this(System.Text.Encoding.UTF8.GetBytes(password), salt, iterations)
        {
        }

        public override byte[] GetBytes(int cb)
        {
            if (_disposed)
                throw new ObjectDisposedException(GetType().Name);

            if (cb <= 0)
                throw new ArgumentOutOfRangeException(nameof(cb));

            // Set output size
            if (_instance.GetType().GetProperty("outputSize") != null)
                _instance.outputSize = cb;

            // Generate derived key
            _instance.Feed(_password);
            return _instance.Result();
        }

        public override void Reset()
        {
            if (_disposed)
                throw new ObjectDisposedException(GetType().Name);

            // Reset by creating new instance
            var algorithm = new ${className}();
            _instance = algorithm.CreateInstance(false);

            if (_instance.GetType().GetProperty("password") != null)
                _instance.password = _password;
            if (_instance.GetType().GetProperty("salt") != null)
                _instance.salt = _salt;
            if (_instance.GetType().GetProperty("iterations") != null)
                _instance.iterations = _iterations;
        }

        protected override void Dispose(bool disposing)
        {
            if (!_disposed)
            {
                if (disposing)
                {
                    Array.Clear(_password, 0, _password.Length);
                    if (_salt != null)
                        Array.Clear(_salt, 0, _salt.Length);
                }
                _disposed = true;
            }
            base.Dispose(disposing);
        }
    }
}`;
        } else if (category.includes('asymmetric') && (algorithm.name.toLowerCase().includes('dsa') || algorithm.name.toLowerCase().includes('signature'))) {
            return `using System;
using System.Security.Cryptography;

namespace Cipher.Wrappers
{
    /// <summary>
    /// C# AsymmetricAlgorithm wrapper for ${algorithm.name}
    /// Auto-generated from SynthelicZ Cipher Tools
    /// </summary>
    public class ${className}Algorithm : AsymmetricAlgorithm
    {
        private readonly dynamic _instance;
        private byte[] _privateKey;
        private byte[] _publicKey;

        public ${className}Algorithm()
        {
            // Create algorithm instance
            var algorithm = new ${className}();
            _instance = algorithm.CreateInstance(false);

            // Set key size from algorithm metadata
            KeySizeValue = ${algorithm.SupportedKeySizes?.[0]?.minSize * 8 || 2048};
            LegalKeySizesValue = new KeySizes[] {
                new KeySizes(${algorithm.SupportedKeySizes?.[0]?.minSize * 8 || 1024},
                             ${algorithm.SupportedKeySizes?.[0]?.maxSize * 8 || 4096},
                             ${algorithm.SupportedKeySizes?.[0]?.step * 8 || 1024})
            };
        }

        public byte[] SignData(byte[] data, HashAlgorithmName hashAlgorithm)
        {
            if (_privateKey == null)
                throw new InvalidOperationException("Private key not set");

            // Set private key
            if (_instance.GetType().GetProperty("privateKey") != null)
                _instance.privateKey = _privateKey;

            // Sign data
            _instance.Feed(data);
            return _instance.Result();
        }

        public bool VerifyData(byte[] data, byte[] signature, HashAlgorithmName hashAlgorithm)
        {
            if (_publicKey == null)
                throw new InvalidOperationException("Public key not set");

            // Set public key
            if (_instance.GetType().GetProperty("publicKey") != null)
                _instance.publicKey = _publicKey;

            // Verify signature
            _instance.Feed(data);
            byte[] computedSignature = _instance.Result();

            // Compare signatures
            if (signature.Length != computedSignature.Length)
                return false;

            for (int i = 0; i < signature.Length; i++)
            {
                if (signature[i] != computedSignature[i])
                    return false;
            }
            return true;
        }

        public void ImportParameters(byte[] privateKey, byte[] publicKey)
        {
            _privateKey = privateKey;
            _publicKey = publicKey;
        }

        public override string KeyExchangeAlgorithm => "${algorithm.name}";
        public override string SignatureAlgorithm => "${algorithm.name}";
    }
}`;
        }

        return null;
    }

    /**
     * Generate Java native wrapper (javax.crypto.Cipher, MessageDigest, etc.)
     */
    generateJavaWrapper(algorithm, category) {
        const className = algorithm.name.replace(/[^a-zA-Z0-9]/g, '');

        if (category.includes('block') || category.includes('stream')) {
            return `package com.synthelicz.cipher.wrappers;

import javax.crypto.*;
import javax.crypto.spec.SecretKeySpec;
import java.security.*;

/**
 * Java Cipher wrapper for ${algorithm.name}
 * Auto-generated from SynthelicZ Cipher Tools
 */
public class ${className}Cipher extends CipherSpi {

    private byte[] key;
    private int opmode;

    @Override
    protected void engineSetMode(String mode) throws NoSuchAlgorithmException {
        if (!mode.equalsIgnoreCase("ECB")) {
            throw new NoSuchAlgorithmException("Only ECB mode is supported");
        }
    }

    @Override
    protected void engineSetPadding(String padding) throws NoSuchPaddingException {
        if (!padding.equalsIgnoreCase("NoPadding")) {
            throw new NoSuchPaddingException("Only NoPadding is supported");
        }
    }

    @Override
    protected int engineGetBlockSize() {
        return ${algorithm.SupportedBlockSizes?.[0]?.minSize || 16};
    }

    @Override
    protected int engineGetOutputSize(int inputLen) {
        return inputLen;
    }

    @Override
    protected byte[] engineGetIV() {
        return null;
    }

    @Override
    protected AlgorithmParameters engineGetParameters() {
        return null;
    }

    @Override
    protected void engineInit(int opmode, Key key, SecureRandom random) {
        this.opmode = opmode;
        this.key = key.getEncoded();
    }

    @Override
    protected void engineInit(int opmode, Key key, AlgorithmParameterSpec params, SecureRandom random) {
        engineInit(opmode, key, random);
    }

    @Override
    protected void engineInit(int opmode, Key key, AlgorithmParameters params, SecureRandom random) {
        engineInit(opmode, key, random);
    }

    @Override
    protected byte[] engineUpdate(byte[] input, int inputOffset, int inputLen) {
        // TODO: Implement using generated ${algorithm.name} code
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    protected int engineUpdate(byte[] input, int inputOffset, int inputLen,
                               byte[] output, int outputOffset) {
        // TODO: Implement using generated ${algorithm.name} code
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    protected byte[] engineDoFinal(byte[] input, int inputOffset, int inputLen) {
        // TODO: Implement using generated ${algorithm.name} code
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    protected int engineDoFinal(byte[] input, int inputOffset, int inputLen,
                               byte[] output, int outputOffset) {
        // TODO: Implement using generated ${algorithm.name} code
        throw new UnsupportedOperationException("Not implemented yet");
    }
}`;
        } else if (category.includes('hash')) {
            return `package com.synthelicz.cipher.wrappers;

import java.security.*;

/**
 * Java MessageDigest wrapper for ${algorithm.name}
 * Auto-generated from SynthelicZ Cipher Tools
 */
public class ${className}Digest extends MessageDigestSpi {

    @Override
    protected void engineUpdate(byte input) {
        // TODO: Implement using generated ${algorithm.name} code
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    protected void engineUpdate(byte[] input, int offset, int len) {
        // TODO: Implement using generated ${algorithm.name} code
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    protected byte[] engineDigest() {
        // TODO: Implement using generated ${algorithm.name} code
        throw new UnsupportedOperationException("Not implemented yet");
    }

    @Override
    protected void engineReset() {
        // Reset internal state
    }
}`;
        }

        return null;
    }

    /**
     * Generate Python native wrapper (cryptography library integration)
     */
    generatePythonWrapper(algorithm, category) {
        const className = algorithm.name.replace(/[^a-zA-Z0-9]/g, '');

        if (category.includes('block') || category.includes('stream')) {
            return `"""
${algorithm.name} wrapper for Python cryptography library
Auto-generated from SynthelicZ Cipher Tools
"""

from cryptography.hazmat.primitives.ciphers import (
    Cipher, CipherAlgorithm, CipherContext
)
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes

class ${className}(CipherAlgorithm):
    """
    ${algorithm.name} cipher algorithm

    Block size: ${algorithm.SupportedBlockSizes?.[0]?.minSize || 16} bytes
    Key sizes: ${algorithm.SupportedKeySizes?.[0]?.minSize || 16}-${algorithm.SupportedKeySizes?.[0]?.maxSize || 32} bytes
    """

    name = "${algorithm.name}"
    block_size = ${algorithm.SupportedBlockSizes?.[0]?.minSize * 8 || 128}  # bits
    key_size = ${algorithm.SupportedKeySizes?.[0]?.minSize * 8 || 128}  # bits

    def __init__(self, key: bytes):
        if len(key) not in [${algorithm.SupportedKeySizes?.map(k => k.minSize).join(', ') || '16, 24, 32'}]:
            raise ValueError(f"Invalid key size: {len(key)}")
        self.key = key

    @property
    def key_size(self):
        return len(self.key) * 8

# Example usage:
# from cryptography.hazmat.primitives.ciphers import modes
# cipher = Cipher(${className}(key), modes.ECB(), backend=default_backend())
# encryptor = cipher.encryptor()
# ciphertext = encryptor.update(plaintext) + encryptor.finalize()
`;
        } else if (category.includes('hash')) {
            return `"""
${algorithm.name} hash function for Python
Auto-generated from SynthelicZ Cipher Tools
"""

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

class ${className}(hashes.HashAlgorithm):
    """
    ${algorithm.name} hash algorithm

    Output size: ${algorithm.SupportedOutputSizes?.[0]?.minSize || 32} bytes
    """

    name = "${algorithm.name}"
    digest_size = ${algorithm.SupportedOutputSizes?.[0]?.minSize || 32}  # bytes
    block_size = ${algorithm.SupportedBlockSizes?.[0]?.minSize || 64}  # bytes

    def __init__(self):
        # TODO: Initialize state using generated ${algorithm.name} code
        pass

# Example usage:
# from cryptography.hazmat.primitives import hashes
# digest = hashes.Hash(${className}(), backend=default_backend())
# digest.update(b"message")
# hash_value = digest.finalize()
`;
        }

        return null;
    }

    /**
     * Generate C++ native wrapper
     */
    generateCppWrapper(algorithm, category) {
        const className = algorithm.name.replace(/[^a-zA-Z0-9]/g, '');

        return `// ${algorithm.name} C++ wrapper
// Auto-generated from SynthelicZ Cipher Tools

#include <cstdint>
#include <vector>
#include <stdexcept>

namespace synthelicz {
namespace cipher {

class ${className} {
public:
    static constexpr size_t BLOCK_SIZE = ${algorithm.SupportedBlockSizes?.[0]?.minSize || 16};
    static constexpr size_t KEY_SIZE = ${algorithm.SupportedKeySizes?.[0]?.minSize || 16};

    ${className}(const uint8_t* key, size_t keyLen) {
        if (keyLen != KEY_SIZE) {
            throw std::invalid_argument("Invalid key size");
        }
        // TODO: Initialize using generated ${algorithm.name} code
    }

    void encrypt(const uint8_t* input, uint8_t* output, size_t length) {
        // TODO: Implement using generated ${algorithm.name} code
    }

    void decrypt(const uint8_t* input, uint8_t* output, size_t length) {
        // TODO: Implement using generated ${algorithm.name} code
    }
};

} // namespace cipher
} // namespace synthelicz
`;
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