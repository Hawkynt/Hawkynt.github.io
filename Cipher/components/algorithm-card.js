/**
 * Algorithm Card Component - Simple Working Version
 * (c)2006-2025 Hawkynt
 */

class AlgorithmCard {
    constructor(algorithm, options = {}) {
        this.algorithm = algorithm;
        this.options = {
            showActions: true,
            showStatus: true,
            showBadges: true,
            onClick: null,
            onDetailsClick: null,
            onUseClick: null,
            ...options
        };
        this.element = null;
    }
    
    createElement() {
        const card = document.createElement('div');
        card.className = 'algorithm-card';
        card.setAttribute('data-category', this.getCategoryKey());
        card.setAttribute('data-name', this.algorithm.name);
        
        const statusIcon = this.getStatusIcon();
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${statusIcon} ${this.algorithm.name}</div>
                ${this.options.showBadges ? this.createBadges() : ''}
            </div>
            <div class="card-description">
                ${this.algorithm.description || 'A cryptographic algorithm implementation.'}
            </div>
            ${this.options.showActions ? this.createActions() : ''}
        `;
        
        this.setupEventListeners(card);
        this.element = card;
        return card;
    }
    
    createBadges() {
        let badges = `<div class="card-badges">`;
        
        // Category badge
        const categoryName = this.getCategoryDisplayName();
        badges += `<span class="badge badge-category" style="background-color: ${this.getCategoryColor()}">${categoryName}</span>`;
        
        // Country badge with flag
        const countryInfo = this.getCountryInfo();
        if (countryInfo) {
            let flagElement = '';
            if (countryInfo.flag) {
                flagElement = `<img class="country-flag" src="${countryInfo.flag}" alt="${countryInfo.code || 'flag'}" onerror="this.style.display='none'">`;
            }
            badges += `<span class="badge badge-country">${flagElement}${countryInfo.name}</span>`;
        }
        
        // Year badge
        const year = this.getYear();
        if (year && year !== 2025) {
            badges += `<span class="badge badge-year">${year}</span>`;
        }
        
        badges += `</div>`;
        return badges;
    }
    
    /**
     * Create action buttons for the algorithm card
     * @returns {string} HTML string for the action buttons
     */
    createActions() {
        const testVectorCount = this.getTestVectorCount();
        const testVectorBadge = testVectorCount > 0 ? `<span class="action-badge">${testVectorCount}</span>` : '';
        const testStatus = this.getTestStatus();
        const testButtonClass = `btn btn-secondary btn-small card-test-btn test-status-${testStatus}`;
        
        return `
            <div class="card-actions">
                <button class="btn btn-primary btn-small card-details-btn">📖 Details</button>
                <button class="${testButtonClass}" title="Run test vectors" data-test-status="${testStatus}">🧪 Test ${testVectorBadge}</button>
                <button class="btn btn-secondary btn-small card-use-btn">🔧 Use</button>
            </div>
        `;
    }
    
    getStatusIcon() {
        return this.algorithm.working ? '✅' : '❌';
    }
    
    setupEventListeners(card) {
        // Card click
        if (this.options.onClick) {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.card-actions')) {
                    this.options.onClick(this.algorithm, e);
                }
            });
        }
        
        // Button event listeners
        const detailsBtn = card.querySelector('.card-details-btn');
        const testBtn = card.querySelector('.card-test-btn');
        const useBtn = card.querySelector('.card-use-btn');
        
        if (detailsBtn) {
            detailsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.options.onDetailsClick) {
                    this.options.onDetailsClick(this.algorithm, e);
                }
            });
        }
        
        if (testBtn) {
            testBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.options.onTestClick) {
                    this.options.onTestClick(this.algorithm, e);
                }
            });
        }
        
        if (useBtn) {
            useBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.options.onUseClick) {
                    this.options.onUseClick(this.algorithm, e);
                }
            });
        }
    }
    
    static createCards(algorithms, container, options = {}) {
        const cards = [];
        algorithms.forEach(algorithm => {
            try {
                const card = new AlgorithmCard(algorithm, options);
                const element = card.createElement();
                container.appendChild(element);
                cards.push(card);
            } catch (error) {
                console.warn('AlgorithmCard: Failed to create card for algorithm:', algorithm.name || 'unknown', error);
                // Continue with next algorithm rather than breaking entire UI
            }
        });
        return cards;
    }
    
    getCategoryDisplayName() {
        if (this.algorithm.category && typeof this.algorithm.category === 'object' && this.algorithm.category.name) {
            return this.algorithm.category.name;
        }
        if (typeof this.algorithm.category === 'string') {
            return this.algorithm.category.charAt(0).toUpperCase() + this.algorithm.category.slice(1);
        }
        return 'Unknown';
    }
    
    getCategoryColor() {
        if (this.algorithm.category && typeof this.algorithm.category === 'object' && this.algorithm.category.color) {
            return this.algorithm.category.color;
        }
        const colorMap = {
            'classical': '#fd7e14',
            'block': '#007bff',
            'stream': '#17a2b8',
            'hash': '#ffc107'
        };
        return colorMap[this.getCategoryKey()] || '#6c757d';
    }
    
    getCategoryKey() {
        if (this.algorithm.category && typeof this.algorithm.category === 'object' && this.algorithm.category.name) {
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
            
            return categoryMap[this.algorithm.category.name] || this.algorithm.category.name.toLowerCase().replace(/\s+/g, '-');
        }
        return String(this.algorithm.category || 'unknown').toLowerCase();
    }
    
    getCountryInfo() {
        // Handle AlgorithmFramework country format
        if (this.algorithm.country && typeof this.algorithm.country === 'object' && this.algorithm.country.name) {
            const countryMap = {
                'Italy': 'it',
                'United States': 'us',
                'Germany': 'de',
                'France': 'fr',
                'United Kingdom': 'gb',
                'Russia': 'ru',
                'China': 'cn',
                'Japan': 'jp'
            };
            
            const countryCode = countryMap[this.algorithm.country.name] || null;
            
            return {
                name: this.algorithm.country.name,
                code: countryCode,
                flag: countryCode ? `https://flagcdn.com/16x12/${countryCode.toLowerCase()}.png` : null
            };
        }
        
        return null;
    }
    
    getYear() {
        return this.algorithm.year || null;
    }
    
    /**
     * Get the number of test vectors for this algorithm
     * @returns {number} The number of test vectors
     */
    getTestVectorCount() {
        if (this.algorithm.tests && Array.isArray(this.algorithm.tests)) {
            return this.algorithm.tests.length;
        }
        return 0;
    }
    
    /**
     * Get the test status for this algorithm based on test results
     * @returns {'none'|'some'|'all'|'untested'} Test status indicator
     */
    getTestStatus() {
        const testCount = this.getTestVectorCount();
        
        if (testCount === 0) {
            return 'untested'; // No test vectors - no tinting
        }
        
        // Check if we have stored test results
        if (this.algorithm.testResults) {
            const passed = this.algorithm.testResults.passed || 0;
            const total = this.algorithm.testResults.total || testCount;
            
            if (passed === 0) {
                return 'none'; // None passed (including single test failure) - red
            } else if (passed === total) {
                return 'all'; // All passed - green
            } else {
                return 'some'; // Some passed - yellow
            }
        }
        
        // Default to 'untested' (no tinting) if we have tests but no results yet
        return 'untested';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlgorithmCard;
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.AlgorithmCard = AlgorithmCard;
}