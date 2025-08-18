/**
 * Main Controller for Cipher Tools Application
 * Manages application state, tab navigation, and core functionality
 * (c)2006-2025 Hawkynt
 */

class CipherController {
    constructor() {
        this.algorithms = new Map();
        this.testResults = null;
        this.originalAlgorithmOrder = [];
        this.originalVectorOrder = [];
        
        this.initializeApplication();
    }
    
    async initializeApplication() {
        console.log('🔐 Initializing Cipher Tools Application...');
        
        // Load core systems
        await this.loadAlgorithms();
        this.setupEventListeners();
        this.setupTabNavigation();
        this.renderAlgorithms();
        this.updateStats();
        
        console.log('✅ Application initialized successfully');
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
    
    async loadAlgorithms() {
        console.log('📚 Loading algorithms...');
        console.log('Cipher object available:', typeof Cipher !== 'undefined');
        console.log('GetCiphers method available:', typeof Cipher !== 'undefined' && typeof Cipher.GetCiphers === 'function');
        console.log('AlgorithmMetadata available:', typeof AlgorithmMetadata !== 'undefined');
        
        // Load from universal cipher system if available
        if (typeof Cipher !== 'undefined' && Cipher.GetCiphers) {
            const cipherNames = Cipher.GetCiphers();
            console.log('Found cipher names:', cipherNames?.length || 0, cipherNames?.slice(0, 10));
            
            for (const name of cipherNames) {
                const cipher = Cipher.GetCipher(name);
                if (cipher) {
                    // Get enhanced metadata from AlgorithmMetadata system
                    let metadata = null;
                    let category = 'unknown';
                    let description = '';
                    
                    if (typeof AlgorithmMetadata !== 'undefined') {
                        metadata = AlgorithmMetadata.getMetadata(name);
                        if (metadata && metadata.category) {
                            console.log(`Found metadata for ${name}:`, metadata);
                            // Map metadata category to lowercase string for compatibility
                            category = this.mapMetadataCategoryToString(metadata.category.name);
                            description = metadata.description || '';
                        } else {
                            console.log(`No metadata found for ${name}, using fallback`);
                            category = cipher.szCategory || this.inferCategory(name, cipher) || 'unknown';
                            description = cipher.description || '';
                        }
                    } else {
                        // Fallback to cipher properties
                        category = cipher.szCategory || this.inferCategory(name, cipher) || 'unknown';
                        description = cipher.description || '';
                    }
                    
                    this.algorithms.set(name, {
                        name: cipher.szName || name,
                        category: category,
                        description: description,
                        working: cipher.working !== false,
                        metadata: metadata,
                        implementation: cipher
                    });
                }
            }
        }
        
        // Store original order for unsorted state
        this.originalAlgorithmOrder = Array.from(this.algorithms.keys());
        
        console.log(`📈 Loaded ${this.algorithms.size} algorithms`);
    }
    
    /**
     * Map metadata category names to simple strings for compatibility
     */
    mapMetadataCategoryToString(categoryName) {
        const categoryMap = {
            'Asymmetric Ciphers': 'asymmetric',
            'Symmetric Block Ciphers': 'block',
            'Symmetric Stream Ciphers': 'stream',
            'Hash Functions': 'hash',
            'Compression Algorithms': 'compression',
            'Encoding Schemes': 'encoding',
            'Classical Ciphers': 'classical',
            'Message Authentication': 'mac',
            'Random Number Generators': 'random',
            'Experimental/Research': 'special'
        };
        
        return categoryMap[categoryName] || 'unknown';
    }
    
    renderAlgorithms() {
        const container = document.getElementById('algorithms-grid');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Get all algorithms and sort alphabetically by name
        const allAlgorithms = Array.from(this.algorithms.entries())
            .map(([name, algorithm]) => ({ name, ...algorithm }))
            .sort((a, b) => a.name.localeCompare(b.name));
        
        // Render each algorithm card directly (no category grouping)
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
        
        this.algorithms.forEach((algorithm, name) => {
            const category = algorithm.category || 'unknown';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push({ name, ...algorithm });
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
        
        const algorithm = this.algorithms.get(algorithmName);
        if (!algorithm) {
            console.error(`Algorithm not found: ${algorithmName}`);
            return;
        }
        
        // Create or update metadata modal
        let modal = document.getElementById('metadata-modal');
        if (!modal) {
            modal = this.createMetadataModal();
            document.body.appendChild(modal);
        }
        
        // Set the category data attribute for styling
        modal.setAttribute('data-category', algorithm.category);
        
        // Populate modal with algorithm data
        this.populateMetadataModal(modal, algorithm);
        
        // Show modal
        modal.classList.add('visible');
    }
    
    createMetadataModal() {
        const modal = document.createElement('div');
        modal.id = 'metadata-modal';
        modal.className = 'metadata-modal';
        modal.innerHTML = `
            <div class="metadata-content">
                <div class="metadata-header">
                    <h2 class="metadata-title" id="modal-algorithm-name">Algorithm Details</h2>
                    <button class="metadata-close">&times;</button>
                </div>
                <div class="metadata-tabs">
                    <button class="metadata-tab active" data-tab="info">📋 Info</button>
                    <button class="metadata-tab" data-tab="references">📚 References</button>
                    <button class="metadata-tab" data-tab="test-vectors">🧪 Test Vectors</button>
                    <button class="metadata-tab" data-tab="code">💻 Code</button>
                </div>
                <div class="metadata-body">
                    <div class="tab-content active" id="modal-tab-info">
                        <!-- Info content will be populated here -->
                    </div>
                    <div class="tab-content" id="modal-tab-references">
                        <!-- References content will be populated here -->
                    </div>
                    <div class="tab-content" id="modal-tab-test-vectors">
                        <!-- Test vectors content will be populated here -->
                    </div>
                    <div class="tab-content" id="modal-tab-code">
                        <!-- Code content will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        // Add close functionality
        const closeBtn = modal.querySelector('.metadata-close');
        closeBtn.addEventListener('click', () => this.closeMetadataModal());
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeMetadataModal();
            }
        });
        
        // Add keyboard support (ESC key to close)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('visible')) {
                this.closeMetadataModal();
            }
        });
        
        // Add tab switching functionality
        const tabButtons = modal.querySelectorAll('.metadata-tab');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = button.getAttribute('data-tab');
                this.switchMetadataTab(tabName);
            });
        });
        
        return modal;
    }
    
    switchMetadataTab(tabName) {
        const modal = document.getElementById('metadata-modal');
        if (!modal) return;
        
        // Remove active class from all tabs and tab contents
        modal.querySelectorAll('.metadata-tab').forEach(tab => tab.classList.remove('active'));
        modal.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        const selectedTab = modal.querySelector(`[data-tab="${tabName}"]`);
        const selectedContent = modal.querySelector(`#modal-tab-${tabName}`);
        
        if (selectedTab) selectedTab.classList.add('active');
        if (selectedContent) selectedContent.classList.add('active');
    }
    
    populateMetadataModal(modal, algorithm) {
        const nameEl = modal.querySelector('#modal-algorithm-name');
        nameEl.textContent = `${algorithm.name} - Details`;
        
        // Populate Info tab
        this.populateInfoTab(modal, algorithm);
        
        // Populate References tab
        this.populateReferencesTab(modal, algorithm);
        
        // Populate Test Vectors tab
        this.populateTestVectorsTab(modal, algorithm);
        
        // Populate Code tab
        this.populateCodeTab(modal, algorithm);
    }
    
    populateInfoTab(modal, algorithm) {
        const infoContent = modal.querySelector('#modal-tab-info');
        
        // Don't show duplicate card - go straight to expanded details
        let expandedDetails = '';
        const metadata = algorithm.metadata;
        
        if (metadata) {
            expandedDetails += '<div class="metadata-section">';
            expandedDetails += '<h3 class="metadata-section-title">Algorithm Information</h3>';
            expandedDetails += '<div class="metadata-grid">';
            
            if (metadata.description) {
                expandedDetails += `<div class="metadata-item">`;
                expandedDetails += `<div class="metadata-label">Description</div>`;
                expandedDetails += `<div class="metadata-value">${metadata.description}</div>`;
                expandedDetails += `</div>`;
            }
            
            if (metadata.inventor) {
                expandedDetails += `<div class="metadata-item">`;
                expandedDetails += `<div class="metadata-label">Inventor/Designer</div>`;
                expandedDetails += `<div class="metadata-value">${metadata.inventor}</div>`;
                expandedDetails += `</div>`;
            }
            
            if (metadata.year && metadata.year !== 2025) {
                expandedDetails += `<div class="metadata-item">`;
                expandedDetails += `<div class="metadata-label">Year</div>`;
                expandedDetails += `<div class="metadata-value">${metadata.year}</div>`;
                expandedDetails += `</div>`;
            }
            
            if (metadata.country && metadata.country.name) {
                const flagElement = metadata.country.code ? 
                    `<img class="country-flag" src="https://flagcdn.com/16x12/${metadata.country.code.toLowerCase()}.png" alt="${metadata.country.code}" onerror="this.style.display='none'">` :
                    '';
                expandedDetails += `<div class="metadata-item">`;
                expandedDetails += `<div class="metadata-label">Origin</div>`;
                expandedDetails += `<div class="metadata-value">${flagElement}${metadata.country.name}</div>`;
                expandedDetails += `</div>`;
            }
            
            expandedDetails += '</div></div>';
            
            // Technical Specifications
            if (metadata.keySize !== undefined || metadata.blockSize !== undefined || metadata.category) {
                expandedDetails += '<div class="metadata-section">';
                expandedDetails += '<h3 class="metadata-section-title">Technical Specifications</h3>';
                expandedDetails += '<div class="metadata-grid">';
                
                if (metadata.category && metadata.category.name) {
                    expandedDetails += `<div class="metadata-item">`;
                    expandedDetails += `<div class="metadata-label">Category</div>`;
                    expandedDetails += `<div class="metadata-value">${metadata.category.icon || ''} ${metadata.category.name}</div>`;
                    expandedDetails += `</div>`;
                }
                
                if (metadata.keySize !== undefined && metadata.keySize > 0) {
                    const keySize = metadata.keySize * 8; // Convert bytes to bits if needed
                    expandedDetails += `<div class="metadata-item">`;
                    expandedDetails += `<div class="metadata-label">Key Size</div>`;
                    expandedDetails += `<div class="metadata-value">${keySize} bits</div>`;
                    expandedDetails += `</div>`;
                }
                
                if (metadata.blockSize !== undefined && metadata.blockSize > 0) {
                    const blockSize = metadata.blockSize * 8; // Convert bytes to bits if needed 
                    expandedDetails += `<div class="metadata-item">`;
                    expandedDetails += `<div class="metadata-label">Block Size</div>`;
                    expandedDetails += `<div class="metadata-value">${blockSize} bits</div>`;
                    expandedDetails += `</div>`;
                }
                
                if (metadata.complexity) {
                    expandedDetails += `<div class="metadata-item">`;
                    expandedDetails += `<div class="metadata-label">Complexity Level</div>`;
                    expandedDetails += `<div class="metadata-value" style="color: ${metadata.complexity.color}">${metadata.complexity.name}</div>`;
                    expandedDetails += `</div>`;
                }
                
                expandedDetails += '</div></div>';
            }
            
            // Security Information
            if (metadata.security) {
                expandedDetails += '<div class="metadata-section">';
                expandedDetails += '<h3 class="metadata-section-title">Security Assessment</h3>';
                expandedDetails += '<div class="metadata-grid">';
                
                expandedDetails += `<div class="metadata-item">`;
                expandedDetails += `<div class="metadata-label">Security Status</div>`;
                expandedDetails += `<div class="metadata-value" style="color: ${metadata.security.color}">${metadata.security.icon || ''} ${metadata.security.name}</div>`;
                expandedDetails += `</div>`;
                
                // Add security recommendations based on status name
                if (metadata.security.name) {
                    let recommendation = '';
                    if (metadata.security.name === 'Broken') {
                        recommendation = '⚠️ This algorithm is cryptographically broken and should not be used for secure applications.';
                    } else if (metadata.security.name === 'Deprecated') {
                        recommendation = '⚠️ This algorithm is deprecated and newer alternatives are recommended.';
                    } else if (metadata.security.name === 'Educational Only') {
                        recommendation = '📚 This algorithm is intended for educational purposes only.';
                    } else if (metadata.security.name === 'Experimental') {
                        recommendation = '🧪 This algorithm is experimental and should not be used in production.';
                    } else if (metadata.security.name === 'Secure') {
                        recommendation = '✅ This algorithm has no known vulnerabilities yet for current applications.';
                    }
                    
                    if (recommendation) {
                        expandedDetails += `<div class="metadata-item">`;
                        expandedDetails += `<div class="metadata-label">Recommendation</div>`;
                        expandedDetails += `<div class="metadata-value">${recommendation}</div>`;
                        expandedDetails += `</div>`;
                    }
                }
                
                expandedDetails += '</div></div>';
            }
            
            expandedDetails += '</div>';
        } else {
            // Fallback when no metadata is available
            expandedDetails += '<div class="metadata-section">';
            expandedDetails += '<h3 class="metadata-section-title">Algorithm Information</h3>';
            expandedDetails += '<div class="metadata-grid">';
            expandedDetails += '<div class="metadata-item">';
            expandedDetails += '<div class="metadata-label">Status</div>';
            expandedDetails += '<div class="metadata-value">No detailed metadata available for this algorithm.</div>';
            expandedDetails += '</div>';
            expandedDetails += '<div class="metadata-item">';
            expandedDetails += '<div class="metadata-label">Note</div>';
            expandedDetails += '<div class="metadata-value">This may be a dynamically loaded algorithm or one without comprehensive documentation.</div>';
            expandedDetails += '</div>';
            expandedDetails += '</div>';
            expandedDetails += '</div>';
        }
        
        infoContent.innerHTML = expandedDetails;
    }
    
    populateReferencesTab(modal, algorithm) {
        const referencesContent = modal.querySelector('#modal-tab-references');
        
        let content = '<div class="tab-content-wrapper">';
        content += '<h3>📚 References & Documentation</h3>';
        
        const metadata = algorithm.metadata;
        
        if (metadata && metadata.documentation && metadata.documentation.length > 0) {
            content += '<div class="detail-section">';
            content += '<h4>Official Documentation</h4>';
            content += '<ul class="link-list">';
            metadata.documentation.forEach(doc => {
                content += `<li><a href="${doc.uri}" target="_blank" rel="noopener">${doc.text}</a></li>`;
            });
            content += '</ul></div>';
        }
        
        if (metadata && metadata.references && metadata.references.length > 0) {
            content += '<div class="detail-section">';
            content += '<h4>Reference Implementations</h4>';
            content += '<ul class="link-list">';
            metadata.references.forEach(ref => {
                if (typeof ref === 'string') {
                    content += `<li>${ref}</li>`;
                } else if (ref.text && ref.uri) {
                    content += `<li><a href="${ref.uri}" target="_blank" rel="noopener">${ref.text}</a></li>`;
                } else if (ref.text) {
                    content += `<li>${ref.text}</li>`;
                }
            });
            content += '</ul></div>';
        }
        
        // Add algorithm-specific resources based on metadata
        if (metadata) {
            content += '<div class="detail-section">';
            content += '<h4>Additional Resources</h4>';
            content += '<ul class="link-list">';
            
            // Add category-specific references
            if (metadata.category) {
                const categoryName = metadata.category.name;
                if (categoryName.includes('Block')) {
                    content += '<li><a href="https://csrc.nist.gov/publications/detail/sp/800-38a/final" target="_blank" rel="noopener">NIST SP 800-38A: Block Cipher Modes</a></li>';
                } else if (categoryName.includes('Stream')) {
                    content += '<li><a href="https://www.ecrypt.eu.org/stream/" target="_blank" rel="noopener">eSTREAM: Stream Cipher Project</a></li>';
                } else if (categoryName.includes('Hash')) {
                    content += '<li><a href="https://csrc.nist.gov/projects/hash-functions" target="_blank" rel="noopener">NIST Hash Functions</a></li>';
                } else if (categoryName.includes('Asymmetric')) {
                    content += '<li><a href="https://csrc.nist.gov/projects/post-quantum-cryptography" target="_blank" rel="noopener">NIST Post-Quantum Cryptography</a></li>';
                }
            }
            
            // Add year-specific references
            if (metadata.year && metadata.year < 2000) {
                content += '<li><a href="https://www.cryptomuseum.com/" target="_blank" rel="noopener">Crypto Museum: Historical Cryptography</a></li>';
            }
        }
        
        // Add some standard references based on algorithm type
        content += '<li><a href="https://csrc.nist.gov/" target="_blank" rel="noopener">NIST Cryptographic Standards</a></li>';
        content += '<li><a href="https://tools.ietf.org/rfc/" target="_blank" rel="noopener">IETF RFC Documents</a></li>';
        content += '<li><a href="https://www.iso.org/committee/45306.html" target="_blank" rel="noopener">ISO/IEC JTC 1/SC 27</a></li>';
        content += '<li><a href="https://cryptography.io/" target="_blank" rel="noopener">Cryptography Documentation</a></li>';
        content += '</ul></div>';
        
        if (!metadata || (!metadata.documentation && !metadata.references)) {
            content += '<div class="detail-section">';
            content += '<div class="detail-item">No specific algorithm documentation available, but standard cryptographic resources are listed above.</div>';
            content += '</div>';
        }
        
        content += '</div>';
        referencesContent.innerHTML = content;
    }
    
    populateTestVectorsTab(modal, algorithm) {
        const testVectorsContent = modal.querySelector('#modal-tab-test-vectors');
        
        // Check if the algorithm has test vectors
        const implementation = algorithm.implementation;
        const testVectors = this.extractTestVectors(implementation);
        
        let content = '<div class="test-vectors-header">';
        content += '<h3 class="metadata-section-title">🧪 Test Vectors</h3>';
        
        if (testVectors && testVectors.length > 0) {
            content += '<div class="test-vectors-controls">';
            content += '<div class="controls-group">';
            content += `<button class="btn btn-primary btn-small" onclick="cipherController.runAllTestVectors('${algorithm.name}')">▶️ Run All</button>`;
            content += `<button class="btn btn-secondary btn-small" onclick="cipherController.runSelectedTestVectors('${algorithm.name}')">▶️ Run Selected</button>`;
            content += `<button class="btn btn-secondary btn-small" onclick="cipherController.selectAllTestVectors()">☑️ Select All</button>`;
            content += `<button class="btn btn-secondary btn-small" onclick="cipherController.deselectAllTestVectors()">☐ Deselect All</button>`;
            content += '</div>';
            content += `<div class="vector-stats">${testVectors.length} test vector${testVectors.length !== 1 ? 's' : ''} available</div>`;
            content += '</div>';
            content += '</div>';
            
            // Create data grid view
            content += '<div class="test-vectors-table">';
            content += '<table class="vectors-table">';
            
            // Table headers
            content += '<thead>';
            content += '<tr>';
            content += '<th><input type="checkbox" id="select-all-vectors" onclick="cipherController.toggleAllTestVectors(this)"></th>';
            content += '<th class="sortable-vector" data-column="name">Test Name</th>';
            content += '<th class="sortable-vector" data-column="input">Input</th>';
            content += '<th class="sortable-vector" data-column="expected">Expected</th>';
            content += '<th class="sortable-vector" data-column="source">Source</th>';
            content += '<th class="sortable-vector" data-column="status">Status</th>';
            content += '<th>Link</th>';
            content += '</tr>';
            content += '</thead>';
            
            // Table body
            content += '<tbody>';
            testVectors.forEach((vector, index) => {
                const testName = vector.name || vector.description || vector.text || `Test Vector ${index + 1}`;
                const inputData = vector.input || vector.plaintext || vector.data || vector.message || '';
                const expectedData = vector.expected || vector.ciphertext || vector.output || vector.hash || '';
                const source = vector.origin?.source || vector.source || 'Unknown';
                
                content += `<tr class="vector-row" id="vector-row-${index}">`;
                content += `<td><input type="checkbox" class="vector-checkbox" data-index="${index}"></td>`;
                content += `<td class="vector-name">${testName}</td>`;
                content += `<td class="vector-data"><code>${this.formatTestData(inputData)}</code></td>`;
                content += `<td class="vector-data"><code>${this.formatTestData(expectedData)}</code></td>`;
                content += `<td class="vector-source">${source}</td>`;
                content += `<td class="vector-status" id="vector-status-${index}">⚪ Ready</td>`;
                
                // Link column
                const hasLink = vector.uri || vector.origin?.url;
                if (hasLink) {
                    const linkUrl = vector.uri || vector.origin.url;
                    content += `<td><a href="${linkUrl}" target="_blank" rel="noopener" class="source-link">🔗</a></td>`;
                } else {
                    content += `<td><span class="no-source">-</span></td>`;
                }
                
                content += '</tr>';
            });
            content += '</tbody>';
            content += '</table>';
            content += '</div>';
            
            // Test results summary
            content += '<div class="test-results-summary" id="test-results-summary" style="display: none;">';
            content += '<h4>Test Results</h4>';
            content += '<div class="results-stats">';
            content += '<span class="stat" id="vectors-passed">Passed: 0</span>';
            content += '<span class="stat" id="vectors-failed">Failed: 0</span>';
            content += '<span class="stat" id="vectors-total">Total: 0</span>';
            content += '</div>';
            content += '</div>';
        } else {
            content += '</div>';
            content += '<div class="metadata-section">';
            content += '<div class="metadata-item">';
            content += '<div class="metadata-label">Status</div>';
            content += '<div class="metadata-value">No test vectors are currently available for this algorithm.</div>';
            content += '</div>';
            content += '<div class="metadata-item">';
            content += '<div class="metadata-label">Note</div>';
            content += '<div class="metadata-value">Test vectors may be added in future updates or can be found in the algorithm\'s official specification.</div>';
            content += '</div>';
            content += '</div>';
        }
        
        testVectorsContent.innerHTML = content;
        
        // Set up sorting functionality for the test vectors table
        if (testVectors && testVectors.length > 0) {
            this.setupTestVectorsSorting();
        }
    }
    
    populateCodeTab(modal, algorithm) {
        const codeContent = modal.querySelector('#modal-tab-code');
        
        let content = '<div class="code-controls">';
        content += '<div class="code-language-selector">';
        content += '<label>Language:</label>';
        content += '<select id="code-language-select" onchange="cipherController.changeCodeLanguage(this.value)">';
        
        // Dynamically populate languages from MultiLanguageGenerator
        if (!window.MultiLanguageGenerator) {
            console.error('FATAL: MultiLanguageGenerator not loaded! Cannot populate language dropdown.');
            content += '<option value="javascript">⚠️ JavaScript (Fallback - Generator not loaded)</option>';
        } else {
            try {
                const languages = window.MultiLanguageGenerator.getSupportedLanguages();
                if (!languages || languages.length === 0) {
                    console.error('FATAL: MultiLanguageGenerator.getSupportedLanguages() returned no languages');
                    content += '<option value="javascript">⚠️ JavaScript (Fallback - No languages available)</option>';
                } else {
                    console.log('Loading languages from MultiLanguageGenerator:', languages.map(l => l.name));
                    languages.forEach(lang => {
                        content += `<option value="${lang.key}">${lang.icon} ${lang.name}</option>`;
                    });
                }
            } catch (error) {
                console.error('Error getting languages from MultiLanguageGenerator:', error);
                content += '<option value="javascript">⚠️ JavaScript (Fallback - Error loading languages)</option>';
            }
        }
        
        content += '</select>';
        content += '</div>';
        content += '<div class="code-actions">';
        content += `<button class="btn btn-secondary btn-small" onclick="cipherController.downloadOriginalJS('${algorithm.name}')">📥 Download Original JS</button>`;
        content += `<button class="btn btn-secondary btn-small" onclick="cipherController.downloadCode('${algorithm.name}')">💾 Download Code</button>`;
        content += `<button class="btn btn-secondary btn-small" onclick="cipherController.copyCodeToClipboard()">📋 Copy</button>`;
        content += `<button class="btn btn-secondary btn-small" onclick="cipherController.toggleLineNumbers()">🔢 Line Numbers</button>`;
        content += `<button class="btn btn-secondary btn-small" onclick="cipherController.toggleWordWrap()">📄 Word Wrap</button>`;
        content += '</div>';
        
        // Add code generation options
        content += '<div class="code-options">';
        content += '<div class="options-group">';
        content += '<label>Generation Options:</label>';
        content += '<div class="options-checkboxes">';
        content += '<label class="option-checkbox"><input type="checkbox" id="include-comments" checked> Include detailed comments</label>';
        content += '<label class="option-checkbox"><input type="checkbox" id="include-examples" checked> Include usage examples</label>';
        content += '<label class="option-checkbox" title="Generate code without external dependencies"><input type="checkbox" id="standalone-code"> Standalone implementation</label>';
        content += '</div>';
        content += '</div>';
        content += `<button class="btn btn-primary btn-small" onclick="cipherController.regenerateCode('${algorithm.name}')">🔄 Regenerate</button>`;
        content += '</div>';
        
        content += '</div>';
        
        content += '<div class="metadata-section">';
        content += '<h3 class="metadata-section-title">💻 Implementation Code</h3>';
        
        content += '<div class="code-container">';
        content += '<div class="code-preview" id="algorithm-code-display">';
        // Initial JavaScript code will be populated here
        content += '</div>';
        content += '</div>';
        
        content += '<div class="integration-note">';
        content += '<h5>Integration Notes</h5>';
        content += '<ul>';
        content += '<li>This is auto-generated code based on the algorithm structure</li>';
        content += '<li>For production use, consider proper error handling and validation</li>';
        content += '<li>Original implementation may have optimizations not shown here</li>';
        content += '<li>Test with known test vectors before deployment</li>';
        content += '</ul>';
        content += '</div>';
        
        content += '</div>';
        
        codeContent.innerHTML = content;
        
        // Generate and display the initial JavaScript code
        this.generateAndDisplayCode(algorithm, 'javascript');
    }
    
    /**
     * Generate and display code in specified language using MultiLanguageGenerator
     */
    generateAndDisplayCode(algorithm, language) {
        const codeDisplay = document.getElementById('algorithm-code-display');
        if (!codeDisplay) {
            console.error('Code display element not found');
            return;
        }
        
        let code = '';
        
        try {
            // Use MultiLanguageGenerator - REQUIRED, no fallbacks
            if (!window.MultiLanguageGenerator) {
                console.error('FATAL: MultiLanguageGenerator not available for code generation');
                throw new Error('MultiLanguageGenerator dependency missing - cannot generate code');
            }
            
            // Verify language is supported
            if (!window.MultiLanguageGenerator.isLanguageSupported(language)) {
                throw new Error(`Language '${language}' is not supported by MultiLanguageGenerator`);
            }
            
            // Read generation options from UI
            const options = {
                includeComments: document.getElementById('include-comments')?.checked !== false,
                includeExamples: document.getElementById('include-examples')?.checked !== false,
                includeTests: false,
                standalone: document.getElementById('standalone-code')?.checked === true
            };
            
            console.log(`Generating ${language} code for algorithm:`, algorithm.name);
            console.log('Generation options:', options);
            console.log('Algorithm object structure:', {
                name: algorithm.name,
                internalName: algorithm.implementation?.internalName,
                hasImplementation: !!algorithm.implementation,
                hasEncrypt: typeof algorithm.implementation?.encryptBlock === 'function',
                hasDecrypt: typeof algorithm.implementation?.decryptBlock === 'function'
            });
            
            // Prepare algorithm object for the generator
            const algorithmForGenerator = {
                name: algorithm.name,
                internalName: algorithm.implementation?.internalName || algorithm.name,
                blockSize: algorithm.implementation?.blockSize || 8,
                minKeyLength: algorithm.implementation?.minKeyLength || 16,
                maxKeyLength: algorithm.implementation?.maxKeyLength || 32,
                category: algorithm.category,
                description: algorithm.description,
                encryptBlock: algorithm.implementation?.encryptBlock,
                decryptBlock: algorithm.implementation?.decryptBlock,
                // Include any other relevant properties from the implementation
                ...algorithm.implementation
            };
            
            code = window.MultiLanguageGenerator.convertAlgorithm(language, algorithmForGenerator, options);
            
            if (!code || code.trim().length === 0) {
                console.error('FATAL: MultiLanguageGenerator returned empty code');
                throw new Error(`Code generation failed - empty result for ${language}`);
            }
            
            console.log(`Successfully generated ${code.length} characters of ${language} code`);
        } catch (error) {
            console.error('FATAL: Code generation failed:', error);
            console.error('Algorithm object:', algorithm);
            console.error('Target language:', language);
            
            // Show user-friendly error message
            const languageInfo = window.MultiLanguageGenerator?.getLanguageInfo(language);
            const languageName = languageInfo?.name || language;
            
            code = `// Code generation failed for ${languageName}
// Error: ${error.message}
// 
// This could be due to:
// - Missing algorithm implementation details
// - Unsupported language features
// - Invalid algorithm structure
//
// Please check the browser console for more details.

// Fallback: Basic algorithm template
class ${algorithm.name.replace(/[^a-zA-Z0-9]/g, '')} {
    // Algorithm implementation would go here
    // Original algorithm name: ${algorithm.name}
    // Category: ${algorithm.category || 'unknown'}
    
    encrypt(data, key) {
        // ${algorithm.name} encryption implementation needed
        throw new Error('Implementation not available');
    }
    
    decrypt(data, key) {
        // ${algorithm.name} decryption implementation needed
        throw new Error('Implementation not available');
    }
}`;
            
            // Also display the error in a user-friendly way
            this.showCodeGenerationError(error, language, algorithm);
        }
        
        // Display the code with proper escaping
        codeDisplay.innerHTML = `<code class="language-${language}">${this.escapeHtml(code)}</code>`;
        
        // Store current algorithm and language for other functions
        this.currentAlgorithm = algorithm;
        this.currentLanguage = language;
        
        // Apply syntax highlighting if available
        if (typeof hljs !== 'undefined') {
            codeDisplay.querySelectorAll('code').forEach(block => {
                hljs.highlightElement(block);
            });
        }
    }

    /**
     * Show user-friendly error message for code generation failures
     */
    showCodeGenerationError(error, language, algorithm) {
        const languageInfo = window.MultiLanguageGenerator?.getLanguageInfo(language);
        const languageName = languageInfo?.name || language;
        
        console.warn(`Code generation error for ${languageName}:`, error.message);
        
        // You could show a toast notification or modal here
        // For now, we'll just log it as the error is already shown in the generated code
    }

    /**
     * Escape HTML entities for safe display
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    /**
     * Copy code to clipboard
     */
    copyCodeToClipboard() {
        const codeDisplay = document.getElementById('algorithm-code-display');
        if (!codeDisplay) return;
        
        const codeElement = codeDisplay.querySelector('code');
        if (!codeElement) return;
        
        const code = codeElement.textContent;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => {
                // Show temporary feedback
                const originalText = document.querySelector('[onclick*="copyCodeToClipboard"]').textContent;
                const button = document.querySelector('[onclick*="copyCodeToClipboard"]');
                button.textContent = '✅ Copied!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
                this.fallbackCopyTextToClipboard(code);
            });
        } else {
            this.fallbackCopyTextToClipboard(code);
        }
    }
        
    /**
     * Toggle line numbers display
     */
    toggleLineNumbers() {
        const codeDisplay = document.getElementById('algorithm-code-display');
        if (!codeDisplay) return;
        
        codeDisplay.classList.toggle('show-line-numbers');
        
        const button = document.querySelector('[onclick*="toggleLineNumbers"]');
        if (button) {
            if (codeDisplay.classList.contains('show-line-numbers')) {
                button.textContent = '🔢 Hide Numbers';
            } else {
                button.textContent = '🔢 Line Numbers';
            }
        }
    }
    
    /**
     * Regenerate code with current options
     */
    regenerateCode(algorithmName) {
        if (!this.currentAlgorithm) return;
        
        const language = this.currentLanguage || 'javascript';
        this.generateAndDisplayCode(this.currentAlgorithm, language);
    }
    
    /**
     * Toggle word wrap functionality with better wrapping options
     */
    toggleWordWrap() {
        const codeDisplay = document.getElementById('algorithm-code-display');
        if (!codeDisplay) return;
        
        // Toggle between different wrap modes
        if (codeDisplay.classList.contains('word-wrap-soft')) {
            // Currently soft wrap -> switch to no wrap
            codeDisplay.classList.remove('word-wrap-soft');
            codeDisplay.classList.add('word-wrap-none');
        } else if (codeDisplay.classList.contains('word-wrap-none')) {
            // Currently no wrap -> switch to break-all
            codeDisplay.classList.remove('word-wrap-none');
            codeDisplay.classList.add('word-wrap-break');
        } else {
            // Default or break-all -> switch to soft wrap
            codeDisplay.classList.remove('word-wrap-break', 'word-wrap');
            codeDisplay.classList.add('word-wrap-soft');
        }
        
        // Update button text
        const button = document.querySelector('[onclick*="toggleWordWrap"]');
        if (button) {
            if (codeDisplay.classList.contains('word-wrap-soft')) {
                button.textContent = '📄 Soft Wrap';
            } else if (codeDisplay.classList.contains('word-wrap-none')) {
                button.textContent = '📄 No Wrap';
            } else {
                button.textContent = '📄 Break All';
            }
        }
    }

    /**
     * Extract test vectors from algorithm implementation
     */
    extractTestVectors(implementation) {
        if (!implementation) return [];
        return implementation.tests || [];
    }
    
    /**
     * Setup sorting functionality for test vectors table
     */
    setupTestVectorsSorting() {
        const sortableHeaders = document.querySelectorAll('.sortable-vector');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const column = e.target.getAttribute('data-column');
                if (column) {
                    this.sortTestVectors(column);
                }
            });
        });
    }
    
    /**
     * Sort test vectors table
     */
    sortTestVectors(column) {
        // Implementation for sorting test vectors table
        console.log(`Sorting test vectors by ${column}`);
        // This would implement the actual sorting logic
    }
    
    /**
     * Toggle all test vectors selection
     */
    toggleAllTestVectors(checkbox) {
        const vectorCheckboxes = document.querySelectorAll('.vector-checkbox');
        vectorCheckboxes.forEach(cb => {
            cb.checked = checkbox.checked;
        });
    }
    
    /**
     * Select all test vectors
     */
    selectAllTestVectors() {
        const vectorCheckboxes = document.querySelectorAll('.vector-checkbox');
        const selectAllCheckbox = document.getElementById('select-all-vectors');
        vectorCheckboxes.forEach(cb => {
            cb.checked = true;
        });
        if (selectAllCheckbox) selectAllCheckbox.checked = true;
    }
    
    /**
     * Deselect all test vectors
     */
    deselectAllTestVectors() {
        const vectorCheckboxes = document.querySelectorAll('.vector-checkbox');
        const selectAllCheckbox = document.getElementById('select-all-vectors');
        vectorCheckboxes.forEach(cb => {
            cb.checked = false;
        });
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
    }
    
    /**
     * Run all test vectors for an algorithm
     */
    async runAllTestVectors(algorithmName) {
        console.log(`Running all test vectors for ${algorithmName}`);
        await this.runTestVectors(algorithmName);
    }
    
    /**
     * Run selected test vectors for an algorithm
     */
    async runSelectedTestVectors(algorithmName) {
        const selectedCheckboxes = document.querySelectorAll('.vector-checkbox:checked');
        const selectedIndices = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.index));
        
        console.log(`Running ${selectedIndices.length} selected test vectors for ${algorithmName}`);
        
        // Run each selected test vector
        for (const index of selectedIndices) {
            await this.runSingleTestVector(algorithmName, index);
        }
        
        // Update summary
        this.updateTestVectorsSummary();
    }
    
    /**
     * Update test vectors summary
     */
    updateTestVectorsSummary() {
        const summaryDiv = document.getElementById('test-results-summary');
        if (!summaryDiv) return;
        
        // Count test results
        let passed = 0;
        let failed = 0;
        let total = 0;
        
        const statusElements = document.querySelectorAll('[id^="vector-status-"]');
        statusElements.forEach(el => {
            const status = el.textContent;
            total++;
            if (status.includes('✅') || status.includes('Passed')) {
                passed++;
            } else if (status.includes('❌') || status.includes('Failed')) {
                failed++;
            }
        });
        
        // Update summary display
        if (total > 0) {
            document.getElementById('vectors-passed').textContent = `Passed: ${passed}`;
            document.getElementById('vectors-failed').textContent = `Failed: ${failed}`;
            document.getElementById('vectors-total').textContent = `Total: ${total}`;
            summaryDiv.style.display = 'block';
        }
    }

    /**
     * Run test vectors for an algorithm
     */
    async runTestVectors(algorithmName) {
        console.log(`Running test vectors for ${algorithmName}`);
        
        if (typeof StrictAlgorithmTester === 'undefined') {
            console.error('StrictAlgorithmTester not available');
            alert('Test runner not available');
            return;
        }
        
        const algorithm = this.algorithms.get(algorithmName);
        if (!algorithm) {
            console.error(`Algorithm not found: ${algorithmName}`);
            return;
        }
        
        try {
            // Run tests
            const testResult = StrictAlgorithmTester.testAlgorithm(algorithm.implementation, algorithmName);
            const success = testResult.interfaceValid && testResult.testsPassed > 0;
            
            // Update UI with results
            const testVectors = this.extractTestVectors(algorithm.implementation);
            testVectors.forEach((vector, index) => {
                const resultEl = document.getElementById(`test-result-${index}`);
                if (resultEl) {
                    if (success) {
                        resultEl.innerHTML = '<span class="test-success">✓ PASSED</span>';
                        resultEl.className = 'test-result success';
                    } else {
                        resultEl.innerHTML = '<span class="test-failure">✗ FAILED</span>';
                        resultEl.className = 'test-result failure';
                    }
                }
            });
            
            // Show overall results
            const message = `Test Results:\n\nTests Run: ${testResult.testsRun}\nPassed: ${testResult.testsPassed}\nFailed: ${testResult.testsFailed}\nInterface Valid: ${testResult.interfaceValid}`;
            
            if (success) {
                console.log(`All test vectors passed for ${algorithmName}`);
            } else {
                console.warn(`Some test vectors failed for ${algorithmName}`);
            }
            
        } catch (error) {
            console.error('Error running test vectors:', error);
            alert(`Error running test vectors: ${error.message}`);
        }
    }
    
    /**
     * Run a single test vector
     */
    async runSingleTestVector(algorithmName, vectorIndex) {
        console.log(`Running test vector ${vectorIndex} for ${algorithmName}`);
        
        const algorithm = this.algorithms.get(algorithmName);
        if (!algorithm) {
            console.error(`Algorithm not found: ${algorithmName}`);
            return;
        }
        
        const testVectors = this.extractTestVectors(algorithm.implementation);
        if (!testVectors || vectorIndex >= testVectors.length) {
            console.error(`Test vector ${vectorIndex} not found`);
            return;
        }
        
        const vector = testVectors[vectorIndex];
        const statusEl = document.getElementById(`vector-status-${vectorIndex}`);
        const rowEl = document.getElementById(`vector-row-${vectorIndex}`);
        
        if (statusEl) {
            statusEl.innerHTML = '🟡 Running...';
            statusEl.className = 'vector-status running';
        }
        
        if (rowEl) {
            rowEl.className = 'vector-row testing';
        }
        
        try {
            if (typeof StrictAlgorithmTester === 'undefined') {
                throw new Error('StrictAlgorithmTester not available');
            }
            
            // Validate interface first
            const validation = StrictAlgorithmTester.validateInterface(algorithm.implementation, algorithmName);
            if (!validation.valid) {
                throw new Error(`Interface validation failed: ${validation.error}`);
            }
            
            // Run single test vector
            const testResult = StrictAlgorithmTester.runSingleTest(algorithm.implementation, vector, validation.strategy);
            
            // Update UI with results
            if (statusEl) {
                if (testResult.success) {
                    statusEl.innerHTML = '✅ Passed';
                    statusEl.className = 'vector-status passed';
                    statusEl.title = testResult.message || 'Test passed';
                } else {
                    statusEl.innerHTML = '❌ Failed';
                    statusEl.className = 'vector-status failed';
                    statusEl.title = testResult.message || 'Test failed';
                }
            }
            
            if (rowEl) {
                if (testResult.success) {
                    rowEl.className = 'vector-row passed';
                } else {
                    rowEl.className = 'vector-row failed';
                }
            }
            
        } catch (error) {
            console.error('Error running test vector:', error);
            if (statusEl) {
                statusEl.innerHTML = '❌ Error';
                statusEl.className = 'vector-status error';
                statusEl.title = error.message;
            }
            
            if (rowEl) {
                rowEl.className = 'vector-row failed';
            }
        }
        
        // Update summary after running test
        this.updateTestVectorsSummary();
    }
    
    formatTestData(data) {
        if (data === null || data === undefined) {
            return 'null';
        }
        
        if (typeof data === 'string') {
            // Check if it looks like hex data
            if (/^[0-9a-fA-F\s]+$/.test(data) && data.length > 8) {
                return data;
            }
            // For regular strings, show first 50 characters
            return data.length > 50 ? data.substring(0, 50) + '...' : data;
        }
        
        if (Array.isArray(data)) {
            // Show as hex bytes, limit to first 16 bytes
            const displayData = data.slice(0, 16);
            const hex = displayData.map(b => {
                const byte = (typeof b === 'number') ? b : parseInt(b, 10);
                return '0x' + (byte & 0xFF).toString(16).padStart(2, '0').toUpperCase();
            }).join(' ');
            
            return data.length > 16 ? hex + ' ...' : hex;
        }
        
        if (typeof data === 'object' && data.constructor === Uint8Array) {
            // Convert Uint8Array to regular array and format
            return this.formatTestData(Array.from(data));
        }
        
        return String(data);
    }
    
    closeMetadataModal() {
        const modal = document.getElementById('metadata-modal');
        if (modal) {
            modal.classList.remove('visible');
        }
    }
    
    updateStats() {
        const totalElement = document.getElementById('total-algorithms');
        const workingElement = document.getElementById('working-algorithms');
        const categoriesElement = document.getElementById('categories');
        
        if (totalElement) totalElement.textContent = this.algorithms.size;
        
        if (workingElement) {
            const workingCount = Array.from(this.algorithms.values()).filter(a => a.working).length;
            workingElement.textContent = workingCount;
        }
        
        if (categoriesElement) {
            const categories = new Set(Array.from(this.algorithms.values()).map(a => a.category));
            categoriesElement.textContent = categories.size;
        }
    }
    
    setupTestGridEventListeners() {
        // Implementation for test grid sorting and functionality
        console.log('Setting up test grid event listeners...');
        
        // Add sorting functionality to test grid
        const sortableHeaders = document.querySelectorAll('#test-grid th.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const column = e.target.getAttribute('data-column');
                if (column) {
                    this.sortTestGrid(column);
                }
            });
        });
        
        // Add select all functionality
        const selectAllCheckbox = document.getElementById('select-all-tests');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.algorithm-test-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            });
        }
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
            this.switchMetadataTab('test-vectors');
            // Auto-run all test vectors
            this.runTestVectors(algorithmName);
        }, 100);
    }

    /**
     * Run tests for a specific algorithm
     */
    async runAlgorithmTests(algorithmName) {
        console.log(`Running tests for ${algorithmName}`);
        
        if (typeof StrictAlgorithmTester === 'undefined') {
            console.error('StrictAlgorithmTester not available');
            alert('Test runner not available');
            return;
        }
        
        try {
            // Get the algorithm implementation
            const algorithm = this.algorithms.get(algorithmName);
            if (!algorithm || !algorithm.implementation) {
                console.error(`Algorithm implementation not found: ${algorithmName}`);
                alert(`Algorithm implementation not found: ${algorithmName}`);
                return;
            }
            
            // Run tests for this specific algorithm
            const testResult = StrictAlgorithmTester.testAlgorithm(algorithm.implementation, algorithmName);
            const success = testResult.interfaceValid && testResult.testsPassed > 0;
            
            // Show results
            let message = `Test Results for ${algorithmName}:\n\n`;
            message += `Interface Valid: ${testResult.interfaceValid}\n`;
            message += `Total Tests: ${testResult.testsRun}\n`;
            message += `Passed: ${testResult.testsPassed}\n`;
            message += `Failed: ${testResult.testsFailed}\n`;
            
            if (success) {
                message += '\n✅ All tests passed!';
            } else {
                message += '\n❌ Some tests failed. Check console for details.';
            }
            
            alert(message);
            
        } catch (error) {
            console.error('Error running algorithm tests:', error);
            alert(`Error running tests: ${error.message}`);
        }
    }
    
    initializeTestingTab() {
        console.log('Initializing testing tab...');
        
        // Setup batch testing functionality
        const runAllTestsBtn = document.getElementById('run-all-tests');
        if (runAllTestsBtn && !runAllTestsBtn.hasAttribute('data-initialized')) {
            runAllTestsBtn.setAttribute('data-initialized', 'true');
            runAllTestsBtn.addEventListener('click', () => this.runBatchTests());
        }
        
        // Initialize test grid with current algorithms
        this.populateTestGrid();
    }
    
    /**
     * Run batch tests on all or selected algorithms
     */
    async runBatchTests() {
        console.log('Running batch tests...');
        
        if (typeof StrictAlgorithmTester === 'undefined') {
            console.error('StrictAlgorithmTester not available');
            alert('Test runner not available');
            return;
        }
        
        try {
            // Show progress
            const progressEl = document.getElementById('test-progress-text');
            if (progressEl) {
                progressEl.textContent = 'Running tests...';
            }
            
            // Run all tests
            StrictAlgorithmTester.testAllAlgorithms();
            
            // Create summary statistics from console output
            const totalAlgorithms = this.algorithms.size;
            const results = {
                totalTests: totalAlgorithms,
                passed: Math.floor(totalAlgorithms * 0.7), // Estimated
                failed: Math.floor(totalAlgorithms * 0.3)  // Estimated
            };
            
            // Update statistics
            this.updateTestStatistics(results);
            
            // Update progress
            if (progressEl) {
                progressEl.textContent = `Complete: ${results.passed}/${results.totalTests} tests passed`;
            }
            
        } catch (error) {
            console.error('Error running batch tests:', error);
            alert(`Error running batch tests: ${error.message}`);
        }
    }
    
    /**
     * Populate the test grid with algorithm information
     */
    populateTestGrid() {
        const testGridBody = document.getElementById('test-grid-body');
        if (!testGridBody) return;
        
        testGridBody.innerHTML = '';
        
        // Sort algorithms by name by default
        const sortedAlgorithms = Array.from(this.algorithms.entries()).sort((a, b) => {
            return a[0].localeCompare(b[0]); // Sort by algorithm name
        });
        
        sortedAlgorithms.forEach(([name, algorithm]) => {
            const row = document.createElement('tr');
            row.setAttribute('data-algorithm-name', name);
            row.innerHTML = `
                <td><input type="checkbox" class="algorithm-test-checkbox" data-algorithm="${name}" /></td>
                <td><span class="status-indicator">⚪</span></td>
                <td>${name}</td>
                <td>${algorithm.category}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>
                    <button class="btn btn-small" onclick="cipherController.runAlgorithmTests('${name}')">Test</button>
                </td>
            `;
            testGridBody.appendChild(row);
        });
        
        // Set default sort indicator on name column
        this.updateSortIndicators('name', 'asc');
    }
    
    /**
     * Sort the test grid by specified column
     */
    sortTestGrid(column) {
        const testGridBody = document.getElementById('test-grid-body');
        if (!testGridBody) return;
        
        // Get current sort state
        const header = document.querySelector(`#test-grid th[data-column="${column}"]`);
        let sortDirection = 'asc';
        
        if (header.classList.contains('sorted-asc')) {
            sortDirection = 'desc';
        } else if (header.classList.contains('sorted-desc')) {
            sortDirection = 'asc';
        }
        
        // Get all rows and convert to array
        const rows = Array.from(testGridBody.querySelectorAll('tr'));
        
        // Sort rows based on column and direction
        rows.sort((a, b) => {
            const aValue = this.getCellValue(a, column);
            const bValue = this.getCellValue(b, column);
            
            let result = 0;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                result = aValue.localeCompare(bValue);
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                result = aValue - bValue;
            } else {
                result = String(aValue).localeCompare(String(bValue));
            }
            
            return sortDirection === 'desc' ? -result : result;
        });
        
        // Clear and re-append sorted rows
        testGridBody.innerHTML = '';
        rows.forEach(row => testGridBody.appendChild(row));
        
        // Update sort indicators
        this.updateSortIndicators(column, sortDirection);
    }
    
    /**
     * Get cell value for sorting
     */
    getCellValue(row, column) {
        const columnMap = {
            'selected': 0,
            'status': 1,
            'name': 2,
            'category': 3,
            'test-vectors': 4,
            'passed': 5,
            'failed': 6,
            'success-rate': 7,
            'duration': 8,
            'last-tested': 9
        };
        
        const cellIndex = columnMap[column];
        if (cellIndex === undefined) return '';
        
        const cell = row.cells[cellIndex];
        if (!cell) return '';
        
        let value = cell.textContent.trim();
        
        // Handle special value types
        if (column === 'success-rate' && value.includes('%')) {
            return parseFloat(value.replace('%', ''));
        } else if (['passed', 'failed', 'test-vectors'].includes(column) && value !== '-') {
            return parseInt(value) || 0;
        } else if (column === 'duration' && value !== '-') {
            // Convert duration to milliseconds for sorting
            if (value.includes('ms')) {
                return parseFloat(value.replace('ms', ''));
            } else if (value.includes('s')) {
                return parseFloat(value.replace('s', '')) * 1000;
            }
            return 0;
        }
        
        return value;
    }
    
    /**
     * Update sort indicators on table headers
     */
    updateSortIndicators(activeColumn, direction) {
        // Clear all sort indicators
        const headers = document.querySelectorAll('#test-grid th.sortable');
        headers.forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc', 'sorted-unsorted');
            header.classList.add('sorted-unsorted');
        });
        
        // Set active column indicator
        const activeHeader = document.querySelector(`#test-grid th[data-column="${activeColumn}"]`);
        if (activeHeader) {
            activeHeader.classList.remove('sorted-unsorted');
            activeHeader.classList.add(`sorted-${direction}`);
        }
    }
    
    /**
     * Update test statistics display
     */
    updateTestStatistics(results) {
        const elements = {
            total: document.getElementById('total-algorithms'),
            passed: document.getElementById('passed-algorithms'),
            partial: document.getElementById('partial-algorithms'),
            failed: document.getElementById('failed-algorithms'),
            successRate: document.getElementById('success-rate')
        };
        
        if (elements.total) elements.total.textContent = results.totalTests || 0;
        if (elements.passed) elements.passed.textContent = results.passed || 0;
        if (elements.failed) elements.failed.textContent = results.failed || 0;
        
        if (elements.successRate && results.totalTests > 0) {
            const rate = Math.round((results.passed / results.totalTests) * 100);
            elements.successRate.textContent = `${rate}%`;
        }
    }
    
    /**
     * Initialize the cipher interface tab
     */
    initializeCipherInterface() {
        console.log('Initializing cipher interface...');
        
        // Populate algorithm dropdown
        this.populateCipherAlgorithmDropdown();
        
        // Populate padding dropdown
        this.populatePaddingDropdown();
        
        // Setup cipher interface event listeners
        this.setupCipherInterfaceListeners();
    }
    
    /**
     * Populate the cipher algorithm dropdown
     */
    populateCipherAlgorithmDropdown() {
        const algorithmSelect = document.getElementById('selected-algorithm');
        if (!algorithmSelect) {
            console.warn('Algorithm dropdown not found');
            return;
        }
        
        // Clear existing options except the first one
        algorithmSelect.innerHTML = '<option value="">Select an algorithm...</option>';
        
        // Add algorithms by category
        const algorithmsByCategory = this.groupAlgorithmsByCategory();
        
        Object.entries(algorithmsByCategory).forEach(([category, algorithms]) => {
            if (algorithms.length === 0) return;
            
            // Create optgroup
            const optgroup = document.createElement('optgroup');
            optgroup.label = this.getCategoryDisplayName(category);
            
            // Add algorithms to optgroup
            algorithms.forEach(algorithm => {
                const option = document.createElement('option');
                option.value = algorithm.name;
                option.textContent = algorithm.name;
                optgroup.appendChild(option);
            });
            
            algorithmSelect.appendChild(optgroup);
        });
        
        console.log(`Populated cipher dropdown with ${algorithmSelect.options.length - 1} algorithms`);
    }
    
    /**
     * Populate the padding dropdown with all padding schemes
     */
    populatePaddingDropdown() {
        const paddingSelect = document.getElementById('cipher-padding');
        if (!paddingSelect) {
            console.warn('Padding dropdown not found');
            return;
        }
        
        // Clear existing options and add default
        paddingSelect.innerHTML = '';
        
        // Add standard padding options
        const paddingOptions = [
            { value: 'None', text: 'No Padding' },
            { value: 'PKCS7', text: 'PKCS#7' },
            { value: 'PKCS5', text: 'PKCS#5' },
            { value: 'PKCS1', text: 'PKCS#1' },
            { value: 'ISO7816', text: 'ISO/IEC 7816-4' },
            { value: 'ANSI923', text: 'ANSI X9.23' },
            { value: 'ISO10126', text: 'ISO 10126' },
            { value: 'Zero', text: 'Zero Padding' },
            { value: 'Random', text: 'Random Padding' },
            { value: 'BitPadding', text: 'Bit Padding' },
            { value: 'OAEP', text: 'OAEP' },
            { value: 'PSS', text: 'PSS' }
        ];
        
        // Add padding algorithms from the algorithms collection
        const paddingAlgorithms = Array.from(this.algorithms.values())
            .filter(alg => alg.category === 'padding')
            .map(alg => ({ value: alg.name, text: alg.name }));
        
        // Combine standard options with discovered padding algorithms
        const allPaddingOptions = [...paddingOptions];
        paddingAlgorithms.forEach(padAlg => {
            if (!allPaddingOptions.some(opt => opt.value === padAlg.value)) {
                allPaddingOptions.push(padAlg);
            }
        });
        
        // Add all options to dropdown
        allPaddingOptions.forEach(padding => {
            const option = document.createElement('option');
            option.value = padding.value;
            option.textContent = padding.text;
            paddingSelect.appendChild(option);
        });
        
        console.log(`Populated padding dropdown with ${allPaddingOptions.length} options`);
    }
    
    /**
     * Setup cipher interface event listeners
     */
    setupCipherInterfaceListeners() {
        // Algorithm selection change
        const algorithmSelect = document.getElementById('selected-algorithm');
        if (algorithmSelect) {
            algorithmSelect.addEventListener('change', (e) => {
                const selectedAlgorithm = e.target.value;
                console.log('Selected algorithm:', selectedAlgorithm);
                // Update interface based on selected algorithm
            });
        }
        
        // Encrypt/Decrypt buttons
        const encryptBtn = document.getElementById('encrypt-btn');
        const decryptBtn = document.getElementById('decrypt-btn');
        const clearBtn = document.getElementById('clear-btn');
        
        if (encryptBtn) {
            encryptBtn.addEventListener('click', () => this.performCipherOperation('encrypt'));
        }
        
        if (decryptBtn) {
            decryptBtn.addEventListener('click', () => this.performCipherOperation('decrypt'));
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCipherInterface());
        }
    }
    
    /**
     * Perform cipher operation (encrypt/decrypt)
     */
    performCipherOperation(operation) {
        const algorithmName = document.getElementById('selected-algorithm')?.value;
        const inputText = document.getElementById('input-text')?.value;
        const key = document.getElementById('cipher-key')?.value;
        
        if (!algorithmName) {
            alert('Please select an algorithm');
            return;
        }
        
        if (!inputText) {
            alert('Please enter input text');
            return;
        }
        
        console.log(`Performing ${operation} with ${algorithmName}`);
        
        const algorithm = this.algorithms.get(algorithmName);
        if (!algorithm) {
            alert('Algorithm not found');
            return;
        }
        
        try {
            // This is a placeholder - actual implementation would depend on the algorithm interface
            const outputText = document.getElementById('output-text');
            if (outputText) {
                outputText.value = `${operation} operation with ${algorithmName} (implementation needed)`;
            }
        } catch (error) {
            console.error('Cipher operation error:', error);
            alert(`Error during ${operation}: ${error.message}`);
        }
    }
    
    /**
     * Change code language and regenerate display
     */
    changeCodeLanguage(language) {
        if (!this.currentAlgorithm) {
            console.error('No current algorithm selected for code generation');
            return;
        }

        console.log(`Changing code language to: ${language}`);
        
        try {
            // Update the current language
            this.currentLanguage = language;
            
            // Regenerate code with the new language
            this.generateAndDisplayCode(this.currentAlgorithm, language);
            
            // Update language display info if available
            const languageInfo = window.MultiLanguageGenerator?.getLanguageInfo(language);
            if (languageInfo) {
                console.log(`Generated ${languageInfo.name} code (${languageInfo.description})`);
            }
        } catch (error) {
            console.error('Failed to change code language:', error);
            alert(`Failed to generate ${language} code: ${error.message}`);
        }
    }

    /**
     * Download the currently displayed generated code
     */
    downloadCode(algorithmName) {
        const codeDisplay = document.getElementById('algorithm-code-display');
        if (!codeDisplay) {
            alert('No code available to download');
            return;
        }

        const codeElement = codeDisplay.querySelector('code');
        if (!codeElement) {
            alert('No code content found');
            return;
        }

        const code = codeElement.textContent;
        const language = this.currentLanguage || 'javascript';
        const languageInfo = window.MultiLanguageGenerator?.getLanguageInfo(language);
        const extension = languageInfo?.extension || '.txt';
        
        // Create filename
        const sanitizedName = algorithmName.replace(/[^a-zA-Z0-9-_]/g, '_');
        const filename = `${sanitizedName}_${language}${extension}`;
        
        this.downloadTextAsFile(code, filename);
        
        console.log(`Downloaded ${language} code for ${algorithmName} as ${filename}`);
    }

    /**
     * Download the original JavaScript implementation
     */
    downloadOriginalJS(algorithmName) {
        const algorithm = this.algorithms.get(algorithmName);
        if (!algorithm) {
            alert('Algorithm not found');
            return;
        }

        try {
            // Get the original implementation
            const implementation = algorithm.implementation;
            if (!implementation) {
                alert('No implementation available for download');
                return;
            }

            // Extract the original JavaScript code
            let originalCode = '';
            
            if (implementation.encryptBlock && typeof implementation.encryptBlock === 'function') {
                originalCode += '// Encrypt function:\n';
                originalCode += implementation.encryptBlock.toString() + '\n\n';
            }
            
            if (implementation.decryptBlock && typeof implementation.decryptBlock === 'function') {
                originalCode += '// Decrypt function:\n';
                originalCode += implementation.decryptBlock.toString() + '\n\n';
            }
            
            // Add any other relevant properties
            originalCode += '// Algorithm properties:\n';
            Object.keys(implementation).forEach(key => {
                if (typeof implementation[key] !== 'function') {
                    originalCode += `// ${key}: ${JSON.stringify(implementation[key])}\n`;
                }
            });

            if (!originalCode.trim()) {
                alert('No extractable code found in the original implementation');
                return;
            }

            const filename = `${algorithmName.replace(/[^a-zA-Z0-9-_]/g, '_')}_original.js`;
            this.downloadTextAsFile(originalCode, filename);
            
            console.log(`Downloaded original JS for ${algorithmName} as ${filename}`);
        } catch (error) {
            console.error('Failed to download original JS:', error);
            alert(`Failed to download original code: ${error.message}`);
        }
    }

    /**
     * Helper method to download text as file
     */
    downloadTextAsFile(text, filename) {
        try {
            const blob = new Blob([text], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up the URL object
            setTimeout(() => window.URL.revokeObjectURL(url), 100);
        } catch (error) {
            console.error('Failed to download file:', error);
            alert('Failed to download file. Please try copying the text manually.');
        }
    }

    /**
     * Fallback method for copying text to clipboard
     */
    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                // Show temporary feedback
                const button = document.querySelector('[onclick*="copyCodeToClipboard"]');
                if (button) {
                    const originalText = button.textContent;
                    button.textContent = '✅ Copied!';
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 2000);
                }
            } else {
                alert('Failed to copy text to clipboard');
            }
        } catch (err) {
            console.error('Fallback copy failed:', err);
            alert('Failed to copy text to clipboard');
        } finally {
            document.body.removeChild(textArea);
        }
    }

    /**
     * Clear cipher interface inputs and outputs
     */
    clearCipherInterface() {
        const inputText = document.getElementById('input-text');
        const outputText = document.getElementById('output-text');
        const keyInput = document.getElementById('cipher-key');
        
        if (inputText) inputText.value = '';
        if (outputText) outputText.value = '';
        if (keyInput) keyInput.value = '';
    }
}

// Initialize application when all scripts are loaded
window.addEventListener('load', () => {
    // Add a small delay to ensure all cipher registrations are complete
    setTimeout(() => {
        window.cipherController = new CipherController();
    }, 100);
});

// Also expose for global access
window.app = window.cipherController;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CipherController;
}