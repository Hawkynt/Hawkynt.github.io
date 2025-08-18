#!/usr/bin/env node
/*
 * Algorithm Card System
 * Interactive UI for displaying cipher algorithms with color coding, flags, and detailed views
 * (c)2024-2025 SynthelicZ Cipher Tools
 */

(function(global) {
  'use strict';

  // Category color mapping
  const CATEGORY_COLORS = {
    'asymmetric': '#DC2626',     // Red
    'block': '#2563EB',          // Blue  
    'stream': '#06B6D4',         // Light Blue
    'hash': '#EAB308',           // Yellow
    'compression': '#16A34A',    // Green
    'encoding': '#7C3AED',       // Violet
    'classical': '#EA580C',      // Orange
    'special': '#1F2937',        // Dark Gray
    'mac': '#DB2777',            // Pink
    'kdf': '#059669',            // Emerald
    'prng': '#7C2D12'            // Brown
  };

  // Country flag emojis (Unicode)
  const COUNTRY_FLAGS = {
    'US': '🇺🇸', 'RU': '🇷🇺', 'CN': '🇨🇳', 'UA': '🇺🇦', 'KR': '🇰🇷',
    'DE': '🇩🇪', 'FR': '🇫🇷', 'GB': '🇬🇧', 'JP': '🇯🇵', 'IT': '🇮🇹',
    'CA': '🇨🇦', 'AU': '🇦🇺', 'SE': '🇸🇪', 'CH': '🇨🇭', 'NL': '🇳🇱',
    'BE': '🇧🇪', 'IL': '🇮🇱', 'IN': '🇮🇳', 'BR': '🇧🇷', 'INT': '🌐'
  };

  // Security level badges
  const SECURITY_LEVELS = {
    'secure': { color: '#16A34A', text: 'Secure', icon: '🔒' },
    'deprecated': { color: '#EAB308', text: 'Deprecated', icon: '⚠️' },
    'obsolete': { color: '#DC2626', text: 'Obsolete', icon: '⛔' },
    'educational': { color: '#06B6D4', text: 'Educational', icon: '🎓' },
    'experimental': { color: '#7C3AED', text: 'Experimental', icon: '🧪' }
  };

  const AlgorithmCardSystem = {
    
    // Initialize the card system
    init: function() {
      this.createCardContainer();
      this.setupSearchAndFilters();
      this.setupSyntaxHighlighting();
      this.renderAllCards();
      this.setupEventHandlers();
    },

    // Create the main container for algorithm cards
    createCardContainer: function() {
      const container = document.getElementById('algorithm-cards-container') || 
                       this.createCardContainerElement();
      
      container.innerHTML = `
        <div class="cards-header">
          <h2>🔐 Algorithm Collection (162+ Implementations)</h2>
          <div class="cards-controls">
            <input type="text" id="algorithm-search" placeholder="🔍 Search algorithms..." />
            <select id="category-filter">
              <option value="">All Categories</option>
              <option value="block">🔵 Block Ciphers</option>
              <option value="stream">🔷 Stream Ciphers</option>
              <option value="hash">🟡 Hash Functions</option>
              <option value="encoding">🟣 Encoding</option>
              <option value="compression">🟢 Compression</option>
              <option value="classical">🟠 Classical</option>
              <option value="asymmetric">🔴 Asymmetric</option>
              <option value="special">⚫ Special</option>
            </select>
            <select id="security-filter">
              <option value="">All Security Levels</option>
              <option value="secure">🔒 Secure</option>
              <option value="deprecated">⚠️ Deprecated</option>
              <option value="obsolete">⛔ Obsolete</option>
              <option value="educational">🎓 Educational</option>
            </select>
          </div>
        </div>
        <div class="cards-grid" id="cards-grid"></div>
      `;
    },

    createCardContainerElement: function() {
      const container = document.createElement('div');
      container.id = 'algorithm-cards-container';
      container.className = 'algorithm-cards-container';
      
      // Insert after the main cipher interface or at the end of body
      const mainInterface = document.getElementById('cipher-interface') || 
                           document.querySelector('main') ||
                           document.body;
      mainInterface.appendChild(container);
      
      return container;
    },

    // Render all algorithm cards
    renderAllCards: function() {
      const grid = document.getElementById('cards-grid');
      if (!grid) return;

      // Get all available ciphers
      const ciphers = this.getAllCiphers();
      grid.innerHTML = '';

      ciphers.forEach(cipher => {
        const card = this.createAlgorithmCard(cipher);
        grid.appendChild(card);
      });
    },

    // Get all available cipher algorithms
    getAllCiphers: function() {
      const ciphers = [];
      
      // Try to get ciphers from global Cipher registry
      if (typeof Cipher !== 'undefined' && Cipher.ciphers) {
        ciphers.push(...Cipher.ciphers);
      }
      
      // If no ciphers found, create sample data
      if (ciphers.length === 0) {
        ciphers.push(...this.getSampleCiphers());
      }
      
      return ciphers;
    },

    // Create individual algorithm card
    createAlgorithmCard: function(cipher) {
      const metadata = cipher.metadata || this.getDefaultMetadata(cipher);
      const category = metadata.category || 'special';
      const country = metadata.szCountry || 'INT';
      const securityLevel = metadata.szSecurityLevel || 'educational';
      
      const card = document.createElement('div');
      card.className = 'algorithm-card';
      card.setAttribute('data-category', category);
      card.setAttribute('data-security', securityLevel);
      card.setAttribute('data-cipher-id', cipher.internalName);
      
      const borderColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.special;
      const flag = COUNTRY_FLAGS[country] || COUNTRY_FLAGS.INT;
      const security = SECURITY_LEVELS[securityLevel] || SECURITY_LEVELS.educational;
      
      card.style.borderLeft = `4px solid ${borderColor}`;
      
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title">
            <h3>${cipher.name || cipher.internalName}</h3>
            <div class="card-badges">
              <span class="country-badge" title="${metadata.szCountryName || country}">
                ${flag}
              </span>
              <span class="year-badge">${metadata.nYear || '?'}</span>
              <span class="security-badge" style="background-color: ${security.color}">
                ${security.icon} ${security.text}
              </span>
            </div>
          </div>
          <div class="category-tag" style="background-color: ${borderColor}">
            ${metadata.szCategoryName || category}
          </div>
        </div>
        
        <div class="card-body">
          <p class="algorithm-description">
            ${metadata.description || cipher.comment || 'Classical cryptographic algorithm'}
          </p>
          
          <div class="card-stats">
            <span class="stat">📊 Key: ${this.getKeyInfo(cipher)}</span>
            <span class="stat">🔧 Block: ${this.getBlockInfo(cipher)}</span>
            <span class="stat">⚡ Speed: ${metadata.szPerformance || 'Standard'}</span>
          </div>
        </div>
        
        <div class="card-footer">
          <button class="btn-details" onclick="AlgorithmCardSystem.showDetailModal('${cipher.internalName}')">
            📋 Show Details
          </button>
          <button class="btn-test" onclick="AlgorithmCardSystem.runQuickTest('${cipher.internalName}')">
            🧪 Quick Test
          </button>
        </div>
      `;
      
      return card;
    },

    // Show detailed modal for algorithm
    showDetailModal: function(algorithmId) {
      const cipher = this.getCipherById(algorithmId);
      if (!cipher) return;
      
      const modal = this.createDetailModal(cipher);
      document.body.appendChild(modal);
      
      // Trigger animation
      requestAnimationFrame(() => {
        modal.classList.add('active');
      });
    },

    // Create detailed modal with three tabs
    createDetailModal: function(cipher) {
      const metadata = cipher.metadata || this.getDefaultMetadata(cipher);
      
      const modal = document.createElement('div');
      modal.className = 'algorithm-modal';
      modal.innerHTML = `
        <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h2>${cipher.name || cipher.internalName}</h2>
            <button class="modal-close" onclick="this.closest('.algorithm-modal').remove()">×</button>
          </div>
          
          <div class="modal-tabs">
            <button class="tab-btn active" data-tab="info">📋 Info</button>
            <button class="tab-btn" data-tab="test">🧪 Test</button>
            <button class="tab-btn" data-tab="code">💻 Code</button>
          </div>
          
          <div class="modal-body">
            ${this.createInfoTab(cipher, metadata)}
            ${this.createTestTab(cipher)}
            ${this.createCodeTab(cipher)}
          </div>
        </div>
      `;
      
      this.setupModalTabs(modal);
      return modal;
    },

    // Create info tab content
    createInfoTab: function(cipher, metadata) {
      const country = metadata.szCountry || 'INT';
      const flag = COUNTRY_FLAGS[country] || COUNTRY_FLAGS.INT;
      
      return `
        <div class="tab-content active" data-tab="info">
          <div class="info-grid">
            <div class="info-section">
              <h3>📖 Description</h3>
              <p>${metadata.description || 'Classical cryptographic algorithm'}</p>
            </div>
            
            <div class="info-section">
              <h3>🌍 Origin</h3>
              <p>
                ${flag} ${metadata.szCountryName || country} (${metadata.nYear || 'Unknown'})
                ${metadata.szInventor ? '<br>Inventor: ' + metadata.szInventor : ''}
              </p>
            </div>
            
            <div class="info-section">
              <h3>🔒 Security Status</h3>
              <p class="security-status ${metadata.szSecurityLevel || 'educational'}">
                ${metadata.szSecurityWarning || 'Educational implementation only'}
              </p>
            </div>
            
            <div class="info-section">
              <h3>📚 Specifications</h3>
              <div class="specification-links">
                ${this.renderSpecificationLinks(metadata.arrSpecifications || [])}
              </div>
            </div>
            
            <div class="info-section">
              <h3>🎯 Educational Value</h3>
              <p>
                <strong>Level:</strong> ${metadata.szComplexity || 'Intermediate'}<br>
                <strong>Tags:</strong> ${(metadata.arrTags || []).join(', ')}<br>
                <strong>Objectives:</strong> ${metadata.szLearningObjectives || 'Algorithm understanding'}
              </p>
            </div>
            
            <div class="info-section">
              <h3>⚡ Performance</h3>
              <p>
                <strong>Speed:</strong> ${metadata.szPerformance || 'Standard'}<br>
                <strong>Memory:</strong> ${metadata.szMemoryUsage || 'Standard'}<br>
                <strong>Optimization:</strong> ${metadata.szOptimizations || 'None specified'}
              </p>
            </div>
          </div>
        </div>
      `;
    },

    // Create test tab content
    createTestTab: function(cipher) {
      const testVectors = cipher.testVectors || [];
      
      return `
        <div class="tab-content" data-tab="test">
          <div class="test-controls">
            <div class="test-actions">
              <button class="btn-select-all" onclick="AlgorithmCardSystem.selectAllTests('${cipher.internalName}')">
                ☑️ Select All
              </button>
              <button class="btn-select-none" onclick="AlgorithmCardSystem.selectNoTests('${cipher.internalName}')">
                ☐ Select None
              </button>
              <button class="btn-run-tests" onclick="AlgorithmCardSystem.runSelectedTests('${cipher.internalName}')">
                🚀 Run Selected Tests
              </button>
            </div>
            <div class="test-results" id="test-results-${cipher.internalName}"></div>
          </div>
          
          <div class="test-vectors-table">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" id="select-all-${cipher.internalName}" /></th>
                  <th>Test Name</th>
                  <th>Input</th>
                  <th>Key</th>
                  <th>Expected</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${this.renderTestVectorRows(testVectors, cipher.internalName)}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // Create code tab content
    createCodeTab: function(cipher) {
      return `
        <div class="tab-content" data-tab="code">
          <div class="code-controls">
            <select id="language-selector-${cipher.internalName}" onchange="AlgorithmCardSystem.switchLanguage('${cipher.internalName}', this.value)">
              <option value="javascript">🟨 JavaScript</option>
              <option value="python">🐍 Python</option>
              <option value="cpp">⚡ C++</option>
              <option value="java">☕ Java</option>
              <option value="rust">🦀 Rust</option>
              <option value="csharp">💻 C#</option>
              <option value="kotlin">🎯 Kotlin</option>
              <option value="perl">🔄 Perl</option>
              <option value="basic">📚 BASIC</option>
              <option value="delphi">🏗️ Delphi</option>
              <option value="go">🐹 Go</option>
            </select>
            <button class="btn-copy-code" onclick="AlgorithmCardSystem.copyCode('${cipher.internalName}')">
              📋 Copy Code
            </button>
            <button class="btn-download-code" onclick="AlgorithmCardSystem.downloadCode('${cipher.internalName}')">
              💾 Download
            </button>
          </div>
          
          <div class="code-display">
            <pre><code id="code-display-${cipher.internalName}" class="language-javascript">
${this.getAlgorithmCode(cipher, 'javascript')}
            </code></pre>
          </div>
        </div>
      `;
    },

    // Setup syntax highlighting using Prism.js
    setupSyntaxHighlighting: function() {
      // Load Prism.js if not already loaded
      if (typeof Prism === 'undefined') {
        this.loadPrismJS();
      }
    },

    loadPrismJS: function() {
      // Load Prism.js CSS
      const prismCSS = document.createElement('link');
      prismCSS.rel = 'stylesheet';
      prismCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
      document.head.appendChild(prismCSS);
      
      // Load Prism.js core
      const prismJS = document.createElement('script');
      prismJS.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
      prismJS.onload = () => {
        // Load additional language support
        this.loadPrismLanguages();
      };
      document.head.appendChild(prismJS);
    },

    loadPrismLanguages: function() {
      const languages = [
        'python', 'cpp', 'java', 'rust', 'csharp', 'kotlin', 'perl', 'basic', 'pascal'
      ];
      
      languages.forEach(lang => {
        const script = document.createElement('script');
        script.src = `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${lang}.min.js`;
        document.head.appendChild(script);
      });
    },

    // Switch programming language in code view
    switchLanguage: function(algorithmId, language) {
      const cipher = this.getCipherById(algorithmId);
      if (!cipher) return;
      
      const codeDisplay = document.getElementById(`code-display-${algorithmId}`);
      if (!codeDisplay) return;
      
      const code = this.getAlgorithmCode(cipher, language);
      codeDisplay.textContent = code;
      codeDisplay.className = `language-${language}`;
      
      // Re-highlight with Prism
      if (typeof Prism !== 'undefined') {
        Prism.highlightElement(codeDisplay);
      }
    },

    // Get algorithm code in specified language
    getAlgorithmCode: function(cipher, language) {
      // Use the CodeGenerationInterface for actual code generation
      if (typeof CodeGenerationInterface !== 'undefined') {
        try {
          // Map language values to CodeGenerationInterface methods
          const languageMap = {
            'javascript': 'JavaScript',
            'python': 'Python',
            'cpp': 'Cpp',
            'java': 'Java',
            'rust': 'Rust',
            'csharp': 'CSharp',
            'kotlin': 'Kotlin',
            'perl': 'Perl',
            'basic': 'FreeBASIC',
            'delphi': 'Delphi',
            'go': 'Go'
          };
          
          const mappedLanguage = languageMap[language];
          if (mappedLanguage) {
            const methodName = `generate${mappedLanguage}`;
            if (typeof CodeGenerationInterface[methodName] === 'function') {
              return CodeGenerationInterface[methodName](cipher.internalName);
            }
          }
        } catch (error) {
          console.warn('Code generation failed:', error);
        }
      }
      
      // Fallback to JavaScript implementation if available
      if (language === 'javascript') {
        return this.getJavaScriptImplementation(cipher);
      }
      
      // Final fallback to placeholder
      return `// ${language.toUpperCase()} implementation for ${cipher.name}
// Code generation interface not available
// Please ensure CodeGenerationInterface is loaded

function ${cipher.internalName.toLowerCase()}Encrypt(plaintext, key) {
    // ${language} implementation would go here
    return "Implementation pending...";
}`;
    },

    // Helper functions
    getKeyInfo: function(cipher) {
      const min = cipher.minKeyLength || 0;
      const max = cipher.maxKeyLength || 0;
      if (min === max && min === 0) return 'None';
      if (min === max) return `${min} bytes`;
      return `${min}-${max} bytes`;
    },

    getBlockInfo: function(cipher) {
      const min = cipher.minBlockSize || 0;
      const max = cipher.maxBlockSize || 0;
      if (min === max && min === 0) return 'Stream';
      if (min === max) return `${min} bytes`;
      return `${min}-${max} bytes`;
    },

    getCipherById: function(id) {
      const ciphers = this.getAllCiphers();
      return ciphers.find(c => c.internalName === id);
    },

    getDefaultMetadata: function(cipher) {
      return {
        description: cipher.comment || 'Cryptographic algorithm implementation',
        szCountry: 'INT',
        szCountryName: 'International',
        nYear: 2000,
        category: 'special',
        szCategoryName: 'Special',
        szSecurityLevel: 'educational',
        szComplexity: 'intermediate',
        arrTags: ['educational'],
        arrSpecifications: []
      };
    },

    // Sample ciphers for demonstration
    getSampleCiphers: function() {
      return [
        {
          internalName: 'Caesar',
          name: 'Caesar Cipher',
          comment: 'Classical substitution cipher',
          metadata: {
            description: 'Simple substitution cipher used by Julius Caesar',
            szCountry: 'IT',
            nYear: -50,
            category: 'classical',
            szSecurityLevel: 'obsolete'
          }
        },
        {
          internalName: 'AES',
          name: 'Advanced Encryption Standard',
          comment: 'Modern symmetric block cipher',
          metadata: {
            description: 'NIST standard symmetric encryption algorithm',
            szCountry: 'US',
            nYear: 2001,
            category: 'block',
            szSecurityLevel: 'secure'
          }
        }
      ];
    },

    // Event handlers
    setupEventHandlers: function() {
      // Search functionality
      const searchInput = document.getElementById('algorithm-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.filterCards(e.target.value, '', '');
        });
      }
      
      // Category filter
      const categoryFilter = document.getElementById('category-filter');
      if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
          this.filterCards('', e.target.value, '');
        });
      }
      
      // Security filter
      const securityFilter = document.getElementById('security-filter');
      if (securityFilter) {
        securityFilter.addEventListener('change', (e) => {
          this.filterCards('', '', e.target.value);
        });
      }
    },

    filterCards: function(search, category, security) {
      const cards = document.querySelectorAll('.algorithm-card');
      
      cards.forEach(card => {
        const cardCategory = card.getAttribute('data-category');
        const cardSecurity = card.getAttribute('data-security');
        const cardText = card.textContent.toLowerCase();
        
        const matchesSearch = !search || cardText.includes(search.toLowerCase());
        const matchesCategory = !category || cardCategory === category;
        const matchesSecurity = !security || cardSecurity === security;
        
        if (matchesSearch && matchesCategory && matchesSecurity) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    },

    setupModalTabs: function(modal) {
      const tabButtons = modal.querySelectorAll('.tab-btn');
      const tabContents = modal.querySelectorAll('.tab-content');
      
      tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const tabId = btn.getAttribute('data-tab');
          
          // Update button states
          tabButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          // Update content visibility
          tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.getAttribute('data-tab') === tabId) {
              content.classList.add('active');
            }
          });
        });
      });
    },

    // Stub functions for testing and interaction
    runQuickTest: function(algorithmId) {
      console.log('Running quick test for:', algorithmId);
      alert(`Quick test for ${algorithmId} - Feature in development`);
    },

    selectAllTests: function(algorithmId) {
      const checkboxes = document.querySelectorAll(`input[type="checkbox"][data-test]`);
      checkboxes.forEach(cb => cb.checked = true);
    },

    selectNoTests: function(algorithmId) {
      const checkboxes = document.querySelectorAll(`input[type="checkbox"][data-test]`);
      checkboxes.forEach(cb => cb.checked = false);
    },

    renderTestVectorRows: function(testVectors, algorithmId) {
      if (!testVectors || testVectors.length === 0) {
        return '<tr><td colspan="7">No test vectors available</td></tr>';
      }
      
      return testVectors.map((test, index) => `
        <tr>
          <td><input type="checkbox" data-test="${algorithmId}-${index}" /></td>
          <td>${test.name || `Test ${index + 1}`}</td>
          <td class="code-cell">${this.truncateText(test.szInput || test.input, 20)}</td>
          <td class="code-cell">${this.truncateText(test.key || test.key, 15)}</td>
          <td class="code-cell">${this.truncateText(test.szExpected || test.expected, 20)}</td>
          <td>
            ${test.origin ? `<a href="${test.origin.szUrl}" target="_blank">${test.origin.szSource}</a>` : 'Internal'}
          </td>
          <td class="status-cell">⏳ Pending</td>
        </tr>
      `).join('');
    },

    renderSpecificationLinks: function(specifications) {
      if (!specifications || specifications.length === 0) {
        return '<p>No specifications available</p>';
      }
      
      return specifications.map(spec => `
        <div class="spec-link">
          <a href="${spec.szUrl}" target="_blank" rel="noopener">
            📄 ${spec.name}
          </a>
          <span class="spec-type">${spec.szType}</span>
        </div>
      `).join('');
    },

    truncateText: function(text, maxLength) {
      if (!text) return '';
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    },

    getJavaScriptImplementation: function(cipher) {
      return `// ${cipher.name || cipher.internalName} Implementation
// Educational cryptographic algorithm implementation

const ${cipher.internalName} = {
  name: "${cipher.name || cipher.internalName}",
  
  // Initialize cipher
  Init: function() {
    this.isInitialized = true;
    return true;
  },
  
  // Setup encryption key
  KeySetup: function(key) {
    // Key processing implementation
    this.key = key;
    return true;
  },
  
  // Encrypt data block
  encryptBlock: function(blockIndex, data) {
    // Encryption implementation
    return data; // Placeholder
  },
  
  // Decrypt data block  
  decryptBlock: function(blockIndex, data) {
    // Decryption implementation
    return data; // Placeholder
  },
  
  // Clean up sensitive data
  ClearData: function() {
    this.key = null;
    this.isInitialized = false;
  }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ${cipher.internalName};
}`;
    },

    // Copy code to clipboard
    copyCode: function(algorithmId) {
      const codeDisplay = document.getElementById(`code-display-${algorithmId}`);
      if (!codeDisplay) return;
      
      const code = codeDisplay.textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
          console.log('Code copied to clipboard');
          // Show temporary success feedback
          const button = document.querySelector(`button[onclick*="copyCode('${algorithmId}')"]`);
          if (button) {
            const originalText = button.textContent;
            button.textContent = '✅ Copied!';
            button.style.backgroundColor = '#4CAF50';
            setTimeout(() => {
              button.textContent = originalText;
              button.style.backgroundColor = '';
            }, 2000);
          }
        });
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log('Code copied to clipboard (fallback)');
      }
    },

    // Download code as file
    downloadCode: function(algorithmId) {
      const cipher = this.getCipherById(algorithmId);
      if (!cipher) return;
      
      const codeDisplay = document.getElementById(`code-display-${algorithmId}`);
      if (!codeDisplay) return;
      
      const languageSelector = document.getElementById(`language-selector-${algorithmId}`);
      const language = languageSelector ? languageSelector.value : 'javascript';
      
      const code = codeDisplay.textContent;
      
      // Determine file extension based on language
      const extensions = {
        'javascript': 'js',
        'python': 'py',
        'cpp': 'cpp',
        'java': 'java',
        'rust': 'rs',
        'csharp': 'cs',
        'kotlin': 'kt',
        'perl': 'pl',
        'basic': 'bas',
        'delphi': 'pas',
        'go': 'go'
      };
      
      const extension = extensions[language] || 'txt';
      const filename = `${cipher.internalName.toLowerCase()}.${extension}`;
      
      // Create download
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`Code downloaded as ${filename}`);
    }
  };

  // Export to global scope
  global.AlgorithmCardSystem = AlgorithmCardSystem;

  // Auto-initialize when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        AlgorithmCardSystem.init();
      });
    } else {
      AlgorithmCardSystem.init();
    }
  }

})(typeof global !== 'undefined' ? global : window);