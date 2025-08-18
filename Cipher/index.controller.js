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
        
        // Load from universal cipher system if available
        if (typeof Cipher !== 'undefined' && Cipher.GetCiphers) {
            const cipherNames = Cipher.GetCiphers();
            console.log('Found cipher names:', cipherNames?.length || 0, cipherNames?.slice(0, 10));
            for (const name of cipherNames) {
                const cipher = Cipher.GetCipher(name);
                if (cipher) {
                    // Use category from cipher properties or infer from implementation
                    let category = cipher.szCategory || this.inferCategory(name, cipher) || 'unknown';
                    
                    this.algorithms.set(name, {
                        name: cipher.szName || name,
                        category: category,
                        country: cipher.szCountry || cipher.metadata?.country || '',
                        year: cipher.nYear || cipher.metadata?.year || null,
                        working: cipher.working !== false,
                        metadata: cipher.metadata,
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
            const card = this.createAlgorithmCard(algorithm);
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
                <div class="modal-body">
                    <div id="modal-algorithm-info"></div>
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
        
        return modal;
    }
    
    populateMetadataModal(modal, algorithm) {
        const nameEl = modal.querySelector('#modal-algorithm-name');
        const infoEl = modal.querySelector('#modal-algorithm-info');
        
        nameEl.textContent = `${algorithm.name} - Details`;
        
        // Create an algorithm card instance for the modal
        if (window.AlgorithmCard) {
            const modalCard = new AlgorithmCard(algorithm, {
                showActions: false, // Don't show Use/Details buttons in modal
                showStatus: true,
                showBadges: true,
                onClick: null // Disable click handling in modal
            });
            
            const cardElement = modalCard.createElement();
            
            // Add expanded details section after the card
            let expandedDetails = '';
            
            if (algorithm.metadata) {
                const metadata = algorithm.metadata;
                
                expandedDetails += '<div class="expanded-details">';
                expandedDetails += '<h3>Technical Details</h3>';
                
                // Technical specifications
                if (metadata.keySize || metadata.blockSize || metadata.cryptoFamily || metadata.cryptoType) {
                    expandedDetails += '<div class="detail-section">';
                    expandedDetails += '<h4>Specifications</h4>';
                    if (metadata.keySize) {
                        expandedDetails += `<div class="detail-item"><strong>Key Size:</strong> ${metadata.keySize}</div>`;
                    }
                    if (metadata.blockSize) {
                        expandedDetails += `<div class="detail-item"><strong>Block Size:</strong> ${metadata.blockSize}</div>`;
                    }
                    if (metadata.cryptoFamily) {
                        expandedDetails += `<div class="detail-item"><strong>Crypto Family:</strong> ${metadata.cryptoFamily}</div>`;
                    }
                    if (metadata.cryptoType) {
                        expandedDetails += `<div class="detail-item"><strong>Crypto Type:</strong> ${metadata.cryptoType}</div>`;
                    }
                    expandedDetails += '</div>';
                }
                
                // Security information
                if (metadata.security || metadata.securityNotes || (metadata.knownVulnerabilities && metadata.knownVulnerabilities.length > 0)) {
                    expandedDetails += '<div class="detail-section">';
                    expandedDetails += '<h4>Security Information</h4>';
                    
                    if (metadata.security) {
                        expandedDetails += `<div class="detail-item"><strong>Security Assessment:</strong> ${metadata.security}</div>`;
                    }
                    if (metadata.securityNotes) {
                        expandedDetails += `<div class="detail-item"><strong>Security Notes:</strong> ${metadata.securityNotes}</div>`;
                    }
                    
                    if (metadata.knownVulnerabilities && metadata.knownVulnerabilities.length > 0) {
                        expandedDetails += '<div class="detail-item"><strong>Known Vulnerabilities:</strong>';
                        expandedDetails += '<ul class="vulnerability-list">';
                        metadata.knownVulnerabilities.forEach(vuln => {
                            expandedDetails += `<li><strong>${vuln.type}:</strong> ${vuln.text}`;
                            if (vuln.mitigation) {
                                expandedDetails += ` <em>Mitigation: ${vuln.mitigation}</em>`;
                            }
                            expandedDetails += `</li>`;
                        });
                        expandedDetails += '</ul></div>';
                    }
                    expandedDetails += '</div>';
                }
                
                // Documentation links
                if (metadata.documentation && metadata.documentation.length > 0) {
                    expandedDetails += '<div class="detail-section">';
                    expandedDetails += '<h4>Documentation</h4>';
                    expandedDetails += '<ul class="link-list">';
                    metadata.documentation.forEach(doc => {
                        expandedDetails += `<li><a href="${doc.uri}" target="_blank" rel="noopener">${doc.text}</a></li>`;
                    });
                    expandedDetails += '</ul></div>';
                }
                
                // References
                if (metadata.references && metadata.references.length > 0) {
                    expandedDetails += '<div class="detail-section">';
                    expandedDetails += '<h4>Reference Implementations</h4>';
                    expandedDetails += '<ul class="link-list">';
                    metadata.references.forEach(ref => {
                        if (typeof ref === 'string') {
                            expandedDetails += `<li>${ref}</li>`;
                        } else if (ref.text && ref.uri) {
                            expandedDetails += `<li><a href="${ref.uri}" target="_blank" rel="noopener">${ref.text}</a></li>`;
                        } else if (ref.text) {
                            expandedDetails += `<li>${ref.text}</li>`;
                        }
                    });
                    expandedDetails += '</ul></div>';
                }
                
                // Performance characteristics
                if (metadata.performance) {
                    expandedDetails += '<div class="detail-section">';
                    expandedDetails += '<h4>Performance</h4>';
                    if (metadata.performance.throughput) {
                        expandedDetails += `<div class="detail-item"><strong>Throughput:</strong> ${metadata.performance.throughput}</div>`;
                    }
                    if (metadata.performance.memoryUsage) {
                        expandedDetails += `<div class="detail-item"><strong>Memory Usage:</strong> ${metadata.performance.memoryUsage}</div>`;
                    }
                    if (metadata.performance.parallelizable !== undefined) {
                        expandedDetails += `<div class="detail-item"><strong>Parallelizable:</strong> ${metadata.performance.parallelizable ? 'Yes' : 'No'}</div>`;
                    }
                    expandedDetails += '</div>';
                }
                
                // Test information
                if ((metadata.testVectors && metadata.testVectors.length > 0) || (metadata.tests && metadata.tests.length > 0)) {
                    expandedDetails += '<div class="detail-section">';
                    expandedDetails += '<h4>Test Information</h4>';
                    if (metadata.testVectors && metadata.testVectors.length > 0) {
                        expandedDetails += `<div class="detail-item"><strong>Test Vectors:</strong> ${metadata.testVectors.length} available</div>`;
                    }
                    if (metadata.tests && metadata.tests.length > 0) {
                        expandedDetails += `<div class="detail-item"><strong>Tests:</strong> ${metadata.tests.length} available</div>`;
                    }
                    expandedDetails += '</div>';
                }
                
                expandedDetails += '</div>';
            }
            
            // Combine card with expanded details
            infoEl.innerHTML = '';
            infoEl.appendChild(cardElement);
            if (expandedDetails) {
                infoEl.innerHTML += expandedDetails;
            }
        } else {
            // Fallback to old format if AlgorithmCard not available
            infoEl.innerHTML = '<p>AlgorithmCard component not loaded</p>';
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