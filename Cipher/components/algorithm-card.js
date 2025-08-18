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
        badges += `<span class="badge badge-category">${this.algorithm.category}</span>`;
        
        if (this.algorithm.country) {
            badges += `<span class="badge badge-country">${this.algorithm.country}</span>`;
        }
        
        if (this.algorithm.year) {
            badges += `<span class="badge badge-year">${this.algorithm.year}</span>`;
        }
        
        badges += `</div>`;
        return badges;
    }
    
    /**
     * Create action buttons
     */
    createActions() {
        return `
            <div class="card-actions">
                <button class="btn btn-primary btn-small card-details-btn">
                    📖 Details
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
                if (this.options.onDetailsClick) {
                    this.options.onDetailsClick(this.algorithm, e);
                } else if (window.cipherController) {
                    window.cipherController.showMetadata(this.algorithm.name);
                }
            });
        }
        
        // Use button
        const useBtn = card.querySelector('.card-use-btn');
        if (useBtn) {
            useBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.options.onUseClick) {
                    this.options.onUseClick(this.algorithm, e);
                } else if (window.cipherController) {
                    window.cipherController.selectAlgorithm(this.algorithm.name);
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
     * Static method to create cards grouped by category
     */
    static createCategorizedCards(algorithmsByCategory, container, options = {}) {
        const allCards = [];
        
        Object.entries(algorithmsByCategory).forEach(([category, algorithms]) => {
            // Create section
            const section = document.createElement('div');
            section.className = 'palette-section';
            section.setAttribute('data-category', category);
            
            // Create header
            const header = document.createElement('div');
            header.className = 'palette-header';
            header.textContent = AlgorithmCard.getCategoryDisplayName(category);
            
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