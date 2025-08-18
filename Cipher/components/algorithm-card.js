/**
 * Algorithm Card Component
 * Reusable card component for displaying algorithm information
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
    
    /**
     * Create the card DOM element
     */
    createElement() {
        const card = document.createElement('div');
        card.className = 'algorithm-card';
        card.setAttribute('data-category', this.algorithm.category);
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
    
    /**
     * Create badge elements
     */
    createBadges() {
        let badges = `<div class="card-badges">`;
        
        // Category badge with proper handling of metadata structure
        const categoryName = this.getCategoryDisplayName();
        badges += `<span class="badge badge-category" style="background-color: ${this.getCategoryColor()}">${categoryName}</span>`;
        
        // Country badge with flag and name
        const countryInfo = this.getCountryInfo();
        if (countryInfo) {
            badges += `<span class="badge badge-country">${countryInfo.flag} ${countryInfo.name}</span>`;
        }
        
        // Year badge
        const year = this.getYear();
        if (year && year !== 2025) { // Don't show default year for unknown algorithms
            badges += `<span class="badge badge-year">${year}</span>`;
        }
        
        // Security status badge
        const securityInfo = this.getSecurityInfo();
        if (securityInfo) {
            badges += `<span class="badge badge-security" style="background-color: ${securityInfo.color}" title="${securityInfo.name}">${securityInfo.icon}</span>`;
        }
        
        badges += `</div>`;
        return badges;
    }
    
    /**
     * Create action buttons
     */
    createActions() {
        const testVectorCount = this.getTestVectorCount();
        const testVectorBadge = testVectorCount > 0 ? `<span class="action-badge">${testVectorCount}</span>` : '';
        
        return `
            <div class="card-actions">
                <button class="btn btn-primary btn-small card-details-btn">
                    📖 Details
                </button>
                <button class="btn btn-secondary btn-small card-test-btn" title="Run test vectors">
                    🧪 Test ${testVectorBadge}
                </button>
                <button class="btn btn-secondary btn-small card-use-btn">
                    🔧 Use
                </button>
            </div>
        `;
    }
    
    /**
     * Get status icon based on algorithm working state and test results
     */
    getStatusIcon() {
        if (!this.options.showStatus) return '';
        
        // This would integrate with test results
        const testResult = this.algorithm.testResult;
        
        if (testResult) {
            if (testResult.total === 0) {
                return this.algorithm.working ? '✅' : '❌';
            } else if (testResult.passed === testResult.total) {
                return '✅'; // All tests passed
            } else if (testResult.passed > 0) {
                return '⚠️'; // Some tests passed, some failed
            } else {
                return '❌'; // All tests failed
            }
        }
        
        // Fallback to working status
        return this.algorithm.working ? '✅' : '❌';
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners(card) {
        // Card click
        if (this.options.onClick) {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.card-actions')) {
                    this.options.onClick(this.algorithm, e);
                }
            });
        }
        
        // Details button
        const detailsBtn = card.querySelector('.card-details-btn');
        if (detailsBtn) {
            detailsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log(`Opening details for algorithm: ${this.algorithm.name}`);
                
                if (this.options.onDetailsClick) {
                    this.options.onDetailsClick(this.algorithm, e);
                } else if (window.cipherController) {
                    window.cipherController.showMetadata(this.algorithm.name);
                } else {
                    console.error('No cipherController available and no onDetailsClick handler provided');
                    alert('Unable to show details: Controller not ready');
                }
            });
        }
        
        // Test button
        const testBtn = card.querySelector('.card-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log(`Running tests for algorithm: ${this.algorithm.name}`);
                
                if (this.options.onTestClick) {
                    this.options.onTestClick(this.algorithm, e);
                } else if (window.cipherController) {
                    window.cipherController.runAlgorithmTests(this.algorithm.name);
                } else {
                    console.error('No cipherController available and no onTestClick handler provided');
                    alert('Unable to run tests: Controller not ready');
                }
            });
        }
        
        // Use button
        const useBtn = card.querySelector('.card-use-btn');
        if (useBtn) {
            useBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log(`Selecting algorithm for use: ${this.algorithm.name}`);
                
                if (this.options.onUseClick) {
                    this.options.onUseClick(this.algorithm, e);
                } else if (window.cipherController) {
                    window.cipherController.selectAlgorithm(this.algorithm.name);
                } else {
                    console.error('No cipherController available and no onUseClick handler provided');
                    alert('Unable to use algorithm: Controller not ready');
                }
            });
        }
    }
    
    /**
     * Update algorithm data
     */
    updateAlgorithm(algorithm) {
        this.algorithm = algorithm;
        if (this.element) {
            const newElement = this.createElement();
            this.element.parentNode?.replaceChild(newElement, this.element);
        }
    }
    
    /**
     * Set loading state
     */
    setLoading(loading = true) {
        if (!this.element) return;
        
        if (loading) {
            this.element.classList.add('loading');
            this.element.style.opacity = '0.6';
        } else {
            this.element.classList.remove('loading');
            this.element.style.opacity = '1';
        }
    }
    
    /**
     * Highlight the card (for search results, etc.)
     */
    highlight(highlighted = true) {
        if (!this.element) return;
        
        if (highlighted) {
            this.element.classList.add('highlighted');
        } else {
            this.element.classList.remove('highlighted');
        }
    }
    
    /**
     * Destroy the component
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
    
    /**
     * Static method to create multiple cards
     */
    static createCards(algorithms, container, options = {}) {
        const cards = [];
        
        algorithms.forEach(algorithm => {
            const card = new AlgorithmCard(algorithm, options);
            const element = card.createElement();
            container.appendChild(element);
            cards.push(card);
        });
        
        return cards;
    }
    
    /**
     * Helper methods for metadata extraction
     */
    getCategoryDisplayName() {
        if (this.algorithm.metadata && this.algorithm.metadata.category) {
            return this.algorithm.metadata.category.name || 'Unknown';
        }
        return AlgorithmCard.getCategoryDisplayName(this.algorithm.category || 'unknown');
    }
    
    getCategoryColor() {
        if (this.algorithm.metadata && this.algorithm.metadata.category) {
            return this.algorithm.metadata.category.color || '#6c757d';
        }
        // Default colors for legacy categories
        const colorMap = {
            'block': '#007bff',
            'stream': '#17a2b8',
            'hash': '#ffc107',
            'classical': '#fd7e14',
            'encoding': '#6f42c1',
            'compression': '#28a745',
            'asymmetric': '#dc3545',
            'special': '#20c997',
            'mac': '#e83e8c',
            'kdf': '#6c757d',
            'mode': '#343a40',
            'padding': '#6c757d'
        };
        return colorMap[this.algorithm.category] || '#6c757d';
    }
    
    getCountryInfo() {
        if (this.algorithm.metadata && this.algorithm.metadata.country) {
            return this.algorithm.metadata.country;
        }
        // Handle legacy string country format
        if (this.algorithm.country && typeof this.algorithm.country === 'string') {
            return { flag: '🏳️', name: this.algorithm.country };
        }
        return null;
    }
    
    getYear() {
        if (this.algorithm.metadata) {
            return this.algorithm.metadata.year;
        }
        return this.algorithm.year;
    }
    
    getSecurityInfo() {
        if (this.algorithm.metadata && this.algorithm.metadata.security) {
            return this.algorithm.metadata.security;
        }
        return null;
    }
    
    getTestVectorCount() {
        if (this.algorithm.implementation && this.algorithm.implementation.testVectors) {
            return this.algorithm.implementation.testVectors.length;
        }
        if (this.algorithm.testVectors) {
            return this.algorithm.testVectors.length;
        }
        return 0;
    }
    
    /**
     * Static method to create cards grouped by category
     */
    static createCategorizedCards(algorithmsByCategory, container, options = {}) {
        const allCards = [];
        
        Object.entries(algorithmsByCategory).forEach(([category, algorithms]) => {
            // Create section
            const section = document.createElement('div');
            section.className = 'palette-section';
            section.setAttribute('data-category', category);
            
            // Create header with algorithm count
            const header = document.createElement('div');
            header.className = 'palette-header';
            const displayName = AlgorithmCard.getCategoryDisplayName(category);
            const count = algorithms.length;
            header.innerHTML = `
                <span class="category-title">${displayName}</span>
                <span class="category-count">${count} algorithm${count !== 1 ? 's' : ''}</span>
            `;
            
            // Create grid
            const grid = document.createElement('div');
            grid.className = 'algorithms-grid';
            
            // Create cards for this category
            const categoryCards = AlgorithmCard.createCards(algorithms, grid, options);
            allCards.push(...categoryCards);
            
            // Assemble section
            section.appendChild(header);
            section.appendChild(grid);
            container.appendChild(section);
        });
        
        return allCards;
    }
    
    /**
     * Get display name for category
     */
    static getCategoryDisplayName(category) {
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlgorithmCard;
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.AlgorithmCard = AlgorithmCard;
}