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
                    let country = '';
                    let year = null;
                    
                    if (typeof AlgorithmMetadata !== 'undefined') {
                        metadata = AlgorithmMetadata.getMetadata(name);
                        if (metadata) {
                            console.log(`Found metadata for ${name}:`, metadata);
                            category = metadata.category?.name?.toLowerCase() || this.inferCategory(name, cipher) || 'unknown';
                            country = metadata.country?.name || '';
                            year = metadata.year || null;
                        } else {
                            console.log(`No metadata found for ${name}, using fallback`);
                            category = cipher.szCategory || this.inferCategory(name, cipher) || 'unknown';
                            country = cipher.szCountry || '';
                            year = cipher.nYear || null;
                        }
                    } else {
                        // Fallback to cipher properties
                        category = cipher.szCategory || this.inferCategory(name, cipher) || 'unknown';
                        country = cipher.szCountry || '';
                        year = cipher.nYear || null;
                    }
                    
                    this.algorithms.set(name, {
                        name: cipher.szName || name,
                        category: category,
                        country: country,
                        year: year,
                        working: cipher.working !== false,
                        metadata: metadata || cipher.metadata,
                        implementation: cipher
                    });
                }
            }
        }
        
        // Load mode of operation and padding algorithms from individual .js files
        await this.loadModeAndPaddingFiles();
        
        // Store original order for unsorted state
        this.originalAlgorithmOrder = Array.from(this.algorithms.keys());
        
        console.log(`📈 Loaded ${this.algorithms.size} algorithms`);
        
        // Debug: Log algorithm categories for verification
        const categories = {};
        this.algorithms.forEach((alg, name) => {
            categories[alg.category] = (categories[alg.category] || 0) + 1;
        });
        console.log('📊 Algorithms by category:', categories);
    }
    
    inferCategory(algorithmName, cipher) {
        // Infer category from algorithm name and characteristics
        const name = algorithmName.toLowerCase();
        
        // Check common algorithm name patterns
        if (name.includes('aes') || name.includes('des') || name.includes('rijndael') || 
            name.includes('blowfish') || name.includes('twofish') || name.includes('serpent') ||
            name.includes('cast') || name.includes('idea') || name.includes('skipjack')) {
            return 'block';
        }
        
        if (name.includes('chacha') || name.includes('salsa') || name.includes('rc4') ||
            name.includes('stream') || name.includes('a5-') || name.includes('trivium')) {
            return 'stream';
        }
        
        if (name.includes('sha') || name.includes('md5') || name.includes('md4') || 
            name.includes('blake') || name.includes('hash') || name.includes('ripemd') ||
            name.includes('tiger') || name.includes('whirlpool')) {
            return 'hash';
        }
        
        if (name.includes('base64') || name.includes('base32') || name.includes('base16') ||
            name.includes('hex') || name.includes('morse') || name.includes('atbash')) {
            return 'encoding';
        }
        
        if (name.includes('caesar') || name.includes('vigenere') || name.includes('playfair') ||
            name.includes('enigma') || name.includes('scytale')) {
            return 'classical';
        }
        
        if (name.includes('cbc') || name.includes('ecb') || name.includes('gcm') || 
            name.includes('ctr') || name.includes('cfb') || name.includes('ofb')) {
            return 'mode';
        }
        
        if (name.includes('pkcs') || name.includes('padding') || name.includes('oaep') ||
            name.includes('pss')) {
            return 'padding';
        }
        
        if (name.includes('hmac') || name.includes('cmac') || name.includes('gmac') ||
            name.includes('poly1305')) {
            return 'mac';
        }
        
        if (name.includes('rsa') || name.includes('ecdsa') || name.includes('dh') ||
            name.includes('asymmetric')) {
            return 'asymmetric';
        }
        
        if (name.includes('lz') || name.includes('deflate') || name.includes('huffman') ||
            name.includes('rle') || name.includes('compress')) {
            return 'compression';
        }
        
        if (name.includes('crc') || name.includes('adler') || name.includes('checksum') ||
            name.includes('fletcher')) {
            return 'checksum';
        }
        
        // If we can't infer, return null (will become 'unknown')
        return null;
    }

    async loadModeAndPaddingFiles() {
        // Individual .js files in algorithms/modes/ and algorithms/padding/ 
        // automatically register themselves when loaded via script tags
        console.log('✅ Mode and padding files loaded via script tags');
    }
    
    
    renderAlgorithms() {
        const container = document.getElementById('algorithms-grid');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Group algorithms by category
        const algorithmsByCategory = this.groupAlgorithmsByCategory();
        
        // Render each category
        Object.entries(algorithmsByCategory).forEach(([category, algorithms]) => {
            this.renderAlgorithmCategory(container, category, algorithms);
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
        const algorithmSelect = document.getElementById('algorithm-select');
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
        modal.style.display = 'block';
        modal.classList.add('active');
    }
    
    createMetadataModal() {
        const modal = document.createElement('div');
        modal.id = 'metadata-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="modal-algorithm-name">Algorithm Details</h2>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-tabs">
                    <button class="modal-tab active" data-tab="info">📋 Info</button>
                    <button class="modal-tab" data-tab="references">📚 References</button>
                    <button class="modal-tab" data-tab="test-vectors">🧪 Test Vectors</button>
                    <button class="modal-tab" data-tab="code">💻 Code</button>
                </div>
                <div class="modal-body">
                    <div class="modal-tab-content active" id="modal-tab-info">
                        <!-- Info content will be populated here -->
                    </div>
                    <div class="modal-tab-content" id="modal-tab-references">
                        <!-- References content will be populated here -->
                    </div>
                    <div class="modal-tab-content" id="modal-tab-test-vectors">
                        <!-- Test vectors content will be populated here -->
                    </div>
                    <div class="modal-tab-content" id="modal-tab-code">
                        <!-- Code content will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        // Add close functionality
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => this.closeMetadataModal());
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeMetadataModal();
            }
        });
        
        // Add keyboard support (ESC key to close)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.closeMetadataModal();
            }
        });
        
        // Add tab switching functionality
        const tabButtons = modal.querySelectorAll('.modal-tab');
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
        modal.querySelectorAll('.modal-tab').forEach(tab => tab.classList.remove('active'));
        modal.querySelectorAll('.modal-tab-content').forEach(content => content.classList.remove('active'));
        
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
        
        // Create an algorithm card instance for the modal
        let cardHtml = '';
        
        if (window.AlgorithmCard) {
            const modalCard = new AlgorithmCard(algorithm, {
                showActions: false, // Don't show Use/Details buttons in modal
                showStatus: true,
                showBadges: true,
                onClick: null // Disable click handling in modal
            });
            
            const cardElement = modalCard.createElement();
            cardHtml = cardElement.outerHTML;
        }
        
        // Add expanded details section after the card
        let expandedDetails = '';
        const metadata = algorithm.metadata;
        
        if (metadata) {
            expandedDetails += '<div class="expanded-details">';
            expandedDetails += '<h3>Algorithm Information</h3>';
            
            // Basic Information
            expandedDetails += '<div class="detail-section">';
            expandedDetails += '<h4>Basic Information</h4>';
            
            if (metadata.description) {
                expandedDetails += `<div class="detail-item"><strong>Description:</strong> ${metadata.description}</div>`;
            }
            
            if (metadata.inventor) {
                expandedDetails += `<div class="detail-item"><strong>Inventor/Designer:</strong> ${metadata.inventor}</div>`;
            }
            
            if (metadata.year) {
                expandedDetails += `<div class="detail-item"><strong>Year:</strong> ${metadata.year}</div>`;
            }
            
            if (metadata.country && metadata.country.name) {
                expandedDetails += `<div class="detail-item"><strong>Origin:</strong> ${metadata.country.flag} ${metadata.country.name}</div>`;
            }
            
            expandedDetails += '</div>';
            
            // Technical Specifications
            if (metadata.keySize !== undefined || metadata.blockSize !== undefined || metadata.category) {
                expandedDetails += '<div class="detail-section">';
                expandedDetails += '<h4>Technical Specifications</h4>';
                
                if (metadata.category && metadata.category.name) {
                    expandedDetails += `<div class="detail-item"><strong>Category:</strong> ${metadata.category.icon} ${metadata.category.name}</div>`;
                    if (metadata.category.description) {
                        expandedDetails += `<div class="detail-item"><strong>Category Description:</strong> ${metadata.category.description}</div>`;
                    }
                }
                
                if (metadata.keySize !== undefined && metadata.keySize > 0) {
                    expandedDetails += `<div class="detail-item"><strong>Key Size:</strong> ${metadata.keySize} bits</div>`;
                }
                
                if (metadata.blockSize !== undefined && metadata.blockSize > 0) {
                    expandedDetails += `<div class="detail-item"><strong>Block Size:</strong> ${metadata.blockSize} bits</div>`;
                }
                
                if (metadata.complexity) {
                    expandedDetails += `<div class="detail-item"><strong>Complexity Level:</strong> <span style="color: ${metadata.complexity.color}">${metadata.complexity.name}</span></div>`;
                }
                
                expandedDetails += '</div>';
            }
            
            // Security Information
            if (metadata.security) {
                expandedDetails += '<div class="detail-section">';
                expandedDetails += '<h4>Security Assessment</h4>';
                
                expandedDetails += `<div class="detail-item"><strong>Security Status:</strong> <span style="color: ${metadata.security.color}">${metadata.security.icon} ${metadata.security.name}</span></div>`;
                
                // Add security recommendations based on status
                if (metadata.security && typeof SecurityStatus !== 'undefined') {
                    if (metadata.security === SecurityStatus.BROKEN) {
                        expandedDetails += `<div class="detail-item" style="color: #dc3545;"><strong>⚠️ Warning:</strong> This algorithm is cryptographically broken and should not be used for secure applications.</div>`;
                    } else if (metadata.security === SecurityStatus.DEPRECATED) {
                        expandedDetails += `<div class="detail-item" style="color: #ffc107;"><strong>⚠️ Note:</strong> This algorithm is deprecated and newer alternatives are recommended.</div>`;
                    } else if (metadata.security === SecurityStatus.EDUCATIONAL) {
                        expandedDetails += `<div class="detail-item" style="color: #fd7e14;"><strong>📚 Note:</strong> This algorithm is intended for educational purposes only.</div>`;
                    }
                }
                
                expandedDetails += '</div>';
            }
            
            expandedDetails += '</div>';
        } else {
            // Fallback when no metadata is available
            expandedDetails += '<div class="expanded-details">';
            expandedDetails += '<h3>Algorithm Information</h3>';
            expandedDetails += '<div class="detail-section">';
            expandedDetails += '<div class="detail-item">No detailed metadata available for this algorithm.</div>';
            expandedDetails += '</div>';
            expandedDetails += '</div>';
        }
        
        infoContent.innerHTML = cardHtml + expandedDetails;
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
        
        // Add some standard references based on algorithm type
        if (algorithm.implementation) {
            content += '<div class="detail-section">';
            content += '<h4>Standard References</h4>';
            content += '<div class="detail-item">Algorithm implementation follows standard cryptographic practices and may reference:</div>';
            content += '<ul class="link-list">';
            content += '<li><a href="https://csrc.nist.gov/" target="_blank" rel="noopener">NIST Cryptographic Standards</a></li>';
            content += '<li><a href="https://tools.ietf.org/rfc/" target="_blank" rel="noopener">IETF RFC Documents</a></li>';
            content += '<li><a href="https://www.iso.org/committee/45306.html" target="_blank" rel="noopener">ISO/IEC JTC 1/SC 27</a></li>';
            content += '</ul></div>';
        }
        
        if (!metadata || (!metadata.documentation && !metadata.references)) {
            content += '<div class="detail-section">';
            content += '<div class="detail-item">No specific references available for this algorithm.</div>';
            content += '</div>';
        }
        
        content += '</div>';
        referencesContent.innerHTML = content;
    }
    
    populateTestVectorsTab(modal, algorithm) {
        const testVectorsContent = modal.querySelector('#modal-tab-test-vectors');
        
        let content = '<div class="tab-content-wrapper">';
        content += '<h3>🧪 Test Vectors</h3>';
        
        // Check if the algorithm has test vectors
        const implementation = algorithm.implementation;
        
        if (implementation && implementation.testVectors && implementation.testVectors.length > 0) {
            content += '<div class="detail-section">';
            content += `<h4>Available Test Vectors (${implementation.testVectors.length})</h4>`;
            
            implementation.testVectors.forEach((vector, index) => {
                content += '<div class="test-vector-item">';
                content += `<h5>Test Vector ${index + 1}</h5>`;
                
                if (vector.description) {
                    content += `<div class="test-vector-description"><strong>Description:</strong> ${vector.description}</div>`;
                }
                
                if (vector.input) {
                    content += `<div class="test-vector-field"><strong>Input:</strong> <code>${this.formatTestData(vector.input)}</code></div>`;
                }
                
                if (vector.key) {
                    content += `<div class="test-vector-field"><strong>Key:</strong> <code>${this.formatTestData(vector.key)}</code></div>`;
                }
                
                if (vector.expected) {
                    content += `<div class="test-vector-field"><strong>Expected:</strong> <code>${this.formatTestData(vector.expected)}</code></div>`;
                }
                
                if (vector.origin) {
                    content += '<div class="test-vector-origin">';
                    content += `<strong>Source:</strong> ${vector.origin.source || 'Unknown'}`;
                    if (vector.origin.url) {
                        content += ` (<a href="${vector.origin.url}" target="_blank" rel="noopener">Link</a>)`;
                    }
                    content += '</div>';
                }
                
                content += '</div>';
            });
            
            content += '</div>';
        } else {
            content += '<div class="detail-section">';
            content += '<div class="detail-item">No test vectors are currently available for this algorithm.</div>';
            content += '<div class="detail-item">Test vectors may be added in future updates or can be found in the algorithm\'s official specification.</div>';
            content += '</div>';
        }
        
        content += '</div>';
        testVectorsContent.innerHTML = content;
    }
    
    populateCodeTab(modal, algorithm) {
        const codeContent = modal.querySelector('#modal-tab-code');
        
        let content = '<div class="tab-content-wrapper">';
        content += '<h3>💻 Implementation Code</h3>';
        
        content += '<div class="detail-section">';
        content += '<h4>Algorithm Implementation</h4>';
        content += '<div class="detail-item">This section shows the core implementation structure for educational purposes.</div>';
        
        // Show basic algorithm structure
        content += '<pre class="code-block">';
        content += '<code class="language-javascript">';
        content += `// ${algorithm.name} Implementation Structure\n`;
        content += `const ${algorithm.name.replace(/[^a-zA-Z0-9]/g, '')} = {\n`;
        content += `  // Algorithm metadata\n`;
        content += `  szInternalName: '${algorithm.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}',\n`;
        content += `  szName: '${algorithm.name}',\n`;
        content += `  szCategory: '${algorithm.category}',\n`;
        
        if (algorithm.country) {
            content += `  szCountry: '${algorithm.country}',\n`;
        }
        
        if (algorithm.year) {
            content += `  nYear: ${algorithm.year},\n`;
        }
        
        content += `\n`;
        content += `  // Core implementation methods\n`;
        content += `  Init: function() {\n`;
        content += `    // Algorithm initialization\n`;
        content += `  },\n\n`;
        
        if (algorithm.category === 'block' || algorithm.category === 'stream') {
            content += `  KeySetup: function(key) {\n`;
            content += `    // Key schedule/setup\n`;
            content += `    return keyId;\n`;
            content += `  },\n\n`;
            
            content += `  EncryptBlock: function(keyId, data) {\n`;
            content += `    // Encryption implementation\n`;
            content += `    return encryptedData;\n`;
            content += `  },\n\n`;
            
            content += `  DecryptBlock: function(keyId, data) {\n`;
            content += `    // Decryption implementation\n`;
            content += `    return decryptedData;\n`;
            content += `  }\n`;
        } else if (algorithm.category === 'hash') {
            content += `  Hash: function(data) {\n`;
            content += `    // Hash computation\n`;
            content += `    return hashValue;\n`;
            content += `  }\n`;
        }
        
        content += `};\n`;
        content += '</code>';
        content += '</pre>';
        
        content += '</div>';
        
        // Add usage example
        content += '<div class="detail-section">';
        content += '<h4>Usage Example</h4>';
        content += '<pre class="code-block">';
        content += '<code class="language-javascript">';
        content += `// Example usage of ${algorithm.name}\n`;
        
        if (algorithm.category === 'block' || algorithm.category === 'stream') {
            content += `const algorithm = Cipher.GetCipher('${algorithm.name}');\n`;
            content += `const keyId = algorithm.KeySetup([0x01, 0x23, 0x45, 0x67]); // Example key\n`;
            content += `const encrypted = algorithm.EncryptBlock(keyId, [0x00, 0x11, 0x22, 0x33]);\n`;
            content += `const decrypted = algorithm.DecryptBlock(keyId, encrypted);\n`;
        } else if (algorithm.category === 'hash') {
            content += `const algorithm = Cipher.GetCipher('${algorithm.name}');\n`;
            content += `const hash = algorithm.Hash([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"\n`;
        } else {
            content += `const algorithm = Cipher.GetCipher('${algorithm.name}');\n`;
            content += `// See algorithm documentation for specific usage\n`;
        }
        
        content += '</code>';
        content += '</pre>';
        content += '</div>';
        
        content += '</div>';
        codeContent.innerHTML = content;
        
        // Apply syntax highlighting if available
        if (typeof hljs !== 'undefined') {
            codeContent.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
        }
    }
    
    formatTestData(data) {
        if (typeof data === 'string') {
            return data;
        } else if (Array.isArray(data)) {
            return data.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        } else {
            return String(data);
        }
    }
    
    closeMetadataModal() {
        const modal = document.getElementById('metadata-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
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
    }
    
    setupMetadataModal() {
        // Implementation for metadata modal functionality
        console.log('Setting up metadata modal...');
    }
    
    initializeTestingTab() {
        console.log('Initializing testing tab...');
    }
}

// Initialize application when all scripts are loaded
window.addEventListener('load', () => {
    // Add a small delay to ensure all cipher registrations are complete
    setTimeout(() => {
        window.cipherController = new CipherController();
    }, 100);
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CipherController;
}