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
            console.error('Error showing algorithm details modal:', error);
            console.error('Algorithm:', algorithm ? algorithm.name : 'undefined');
            
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
                console.error('Even the fallback modal failed:', fallbackError);
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
        titleEl.textContent = this.currentAlgorithm.name;

        // Set category attribute for styling
        this.element.setAttribute('data-category', this.getCategoryKey());

        // Apply category color tinting to header background
        this.applyCategoryTinting();

        // Populate each tab
        this.populateInfoTab();
        this.populateReferencesTab();
        this.populateTestVectorsTab();
        this.populateCodeTab();
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
        
        // Check if MultiLanguageGenerator is available
        if (typeof window !== 'undefined' && window.MultiLanguageGenerator) {
            const supportedLanguages = window.MultiLanguageGenerator.getSupportedLanguages();
            
            supportedLanguages.forEach((lang, index) => {
                const isActive = index === 0; // Default to first language
                html += `<button class="language-btn ${isActive ? 'active' : ''}" data-language="${lang.key}" onclick="window.algorithmDetailsInstance.switchLanguage('${lang.key}')">` ;
                html += `${lang.icon} ${lang.name}`;
                html += '</button>';
            });
        } else {
            // Fallback if MultiLanguageGenerator is not available
            const fallbackLanguages = [
                { key: 'javascript', name: 'JavaScript', icon: '🟨' },
                { key: 'python', name: 'Python', icon: '🐍' },
                { key: 'cpp', name: 'C++', icon: '⚡' },
                { key: 'java', name: 'Java', icon: '☕' }
            ];
            
            fallbackLanguages.forEach((lang, index) => {
                const isActive = index === 0;
                html += `<button class="language-btn ${isActive ? 'active' : ''}" data-language="${lang.key}" onclick="window.algorithmDetailsInstance.switchLanguage('${lang.key}')">` ;
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
        html += '<pre class="code-content" id="generated-code"><code>';
        
        // Generate initial code (JavaScript by default)
        const initialCode = this.generateCodeForLanguage('javascript');
        html += this.escapeHtml(initialCode);
        
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
        
        // Apply syntax highlighting if available
        const codeElement = content.querySelector('#generated-code code');
        if (codeElement) {
            this.applySyntaxHighlighting(codeElement, 'javascript');
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
        
        // Extract country code from country name - this should be standardized in CountryCode objects
        // but if we need a mapping, it should be comprehensive and maintained in AlgorithmFramework
        const countryMap = {
            'Italy': 'it',
            'United States': 'us',
            'Germany': 'de',
            'France': 'fr',
            'United Kingdom': 'gb',
            'Russia': 'ru',
            'China': 'cn',
            'Japan': 'jp',
            'Unknown': null, // Special case for unknown countries
            'International': null // Special case for international standards
        };
        
        const code = countryMap[country.name];
        if (code === undefined) {
            throw new Error(`AlgorithmDetails: No country code mapping found for '${country.name}'. Add mapping to AlgorithmFramework.CountryCode`);
        }
        
        // Return empty string for unknown countries (no flag)
        if (code === null) {
            return '';
        }
        
        return `<img class="country-flag" src="https://flagcdn.com/16x12/${code.toLowerCase()}.png" alt="${code}" onerror="this.style.display='none'">`;
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
        
        return algorithm.category.name.toLowerCase().replace(/\s+/g, '');
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
            
        } catch (error) {
            resultsContainer.innerHTML = `<div class="test-status failure">❌ FAILED</div><div class="test-error">Error: ${error.message}</div>`;
            console.error('Test execution failed:', error);
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
            setTimeout(() => this.runSingleTest(i), i * 100);
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
     * Generate code for a specific language
     */
    generateCodeForLanguage(languageKey) {
        const algorithm = this.currentAlgorithm;
        
        if (!algorithm) {
            throw new Error('AlgorithmDetails: No algorithm available for code generation');
        }
        
        const config = this.getCodeGenerationConfig();
        
        // Check if MultiLanguageGenerator is available
        if (typeof window !== 'undefined' && window.MultiLanguageGenerator) {
            try {
                const generatedCode = window.MultiLanguageGenerator.convertAlgorithm(languageKey, algorithm, config);
                return generatedCode;
            } catch (error) {
                console.warn('MultiLanguageGenerator failed, using AlgorithmFramework structure:', error);
                return this.generateFallbackCode(languageKey);
            }
        } else {
            // Generate AlgorithmFramework structure code
            return this.generateFallbackCode(languageKey);
        }
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
            code += 'console.log(OpCodes.BytesToAnsi(result));';
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
        
        // Generate new code
        const generatedCode = this.generateCodeForLanguage(languageKey);
        
        // Update code display
        const codeElement = this.element.querySelector('#generated-code code');
        if (codeElement) {
            codeElement.textContent = generatedCode;
            
            // Apply syntax highlighting
            this.applySyntaxHighlighting(codeElement, languageKey);
        }
        
        // Store current language
        this.currentLanguage = languageKey;
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
                console.error('Failed to copy code:', err);
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
     * Apply syntax highlighting to code element
     */
    applySyntaxHighlighting(codeElement, languageKey) {
        if (!window.hljs || !codeElement) return;
        
        try {
            // Remove existing highlighting
            delete codeElement.dataset.highlighted;
            codeElement.className = codeElement.className.replace(/hljs[^\s]*/g, '');
            
            // Map language keys to highlight.js language identifiers
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
            
            const hlLanguage = languageMap[languageKey] || languageKey;
            
            // For line-numbered code, we need to highlight each line content separately
            if (codeElement.querySelector('.code-line')) {
                const lineContents = codeElement.querySelectorAll('.line-content');
                lineContents.forEach(lineContent => {
                    if (lineContent.textContent.trim()) {
                        const result = hljs.highlight(lineContent.textContent, { language: hlLanguage });
                        lineContent.innerHTML = result.value;
                    }
                });
            } else {
                // Standard highlighting for non-line-numbered code
                const result = hljs.highlight(codeElement.textContent, { language: hlLanguage });
                codeElement.innerHTML = result.value;
                codeElement.classList.add('hljs');
            }
        } catch (error) {
            console.warn('Syntax highlighting failed:', error);
            // Fallback to basic highlighting
            if (window.hljs.highlightElement) {
                hljs.highlightElement(codeElement);
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
     * Toggle line numbers in code display
     */
    toggleLineNumbers() {
        if (!this.element) {
            throw new Error('AlgorithmDetails: Modal not available for line numbers toggle');
        }
        
        const codeContent = this.element.querySelector('#generated-code');
        const toggleBtn = this.element.querySelector('#toggle-line-numbers');
        
        if (!codeContent || !toggleBtn) {
            throw new Error('AlgorithmDetails: Code elements not found for line numbers toggle');
        }
        
        const hasLineNumbers = codeContent.classList.contains('line-numbers');
        
        if (hasLineNumbers) {
            codeContent.classList.remove('line-numbers');
            toggleBtn.textContent = '🔢 Numbers';
            toggleBtn.classList.remove('active');
            this.removeLineNumbers();
        } else {
            codeContent.classList.add('line-numbers');
            toggleBtn.textContent = '🔢 No Numbers';
            toggleBtn.classList.add('active');
            this.addLineNumbers();
        }
    }

    /**
     * Add line numbers to code display
     */
    addLineNumbers() {
        const codeElement = this.element.querySelector('#generated-code code');
        if (!codeElement) return;
        
        const code = codeElement.textContent || '';
        const lines = code.split('\n');
        const maxLineNumber = lines.length;
        const lineNumberWidth = Math.max(maxLineNumber.toString().length, 2);
        
        // Store original code for later restoration
        if (!codeElement.hasAttribute('data-original-code')) {
            codeElement.setAttribute('data-original-code', code);
        }
        
        // Create numbered lines with proper structure
        const numberedLines = lines.map((line, index) => {
            const lineNumber = (index + 1).toString().padStart(lineNumberWidth, ' ');
            return `<div class="code-line"><span class="line-number">${lineNumber}</span><span class="line-content">${this.escapeHtml(line || ' ')}</span></div>`;
        }).join('');
        
        codeElement.innerHTML = numberedLines;
        
        // Re-apply syntax highlighting if available
        if (this.currentLanguage) {
            this.applySyntaxHighlighting(codeElement, this.currentLanguage);
        }
    }

    /**
     * Remove line numbers from code display
     */
    removeLineNumbers() {
        const codeElement = this.element.querySelector('#generated-code code');
        if (!codeElement) return;
        
        // Restore original code from stored attribute
        const originalCode = codeElement.getAttribute('data-original-code');
        if (originalCode) {
            codeElement.textContent = originalCode;
            codeElement.removeAttribute('data-original-code');
        } else {
            // Fallback: extract from line-content spans
            const lineContents = codeElement.querySelectorAll('.line-content');
            if (lineContents.length > 0) {
                const extractedCode = Array.from(lineContents).map(span => span.textContent).join('\n');
                codeElement.textContent = extractedCode;
            }
        }
        
        // Re-apply syntax highlighting if available
        if (this.currentLanguage) {
            this.applySyntaxHighlighting(codeElement, this.currentLanguage);
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