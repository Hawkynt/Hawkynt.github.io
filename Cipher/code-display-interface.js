#!/usr/bin/env node
/*
 * Code Display Interface for Multi-Language Algorithm Visualization
 * Interactive code display system with language switching and educational features
 * Integrates with existing cipher tab system and OpCodes code generation
 * (c)2006-2025 Hawkynt - SynthelicZ Educational Tools
 * 
 * Features:
 * - Language selector dropdown with educational info
 * - Real-time code generation and syntax highlighting
 * - Side-by-side comparison view
 * - Full-screen code viewer
 * - Performance optimization with caching
 * - Educational annotations and explanations
 * - Integration with existing algorithm cards
 * 
 * Dependencies:
 * - syntax-highlighter.js (Prism.js integration)
 * - OpCodes-CodeGen.js (code generation)
 * - Universal cipher system
 */

(function(global) {
  'use strict';
  
  // ========================[ CODE DISPLAY MANAGER ]========================
  
  class CodeDisplayManager {
    constructor(options = {}) {
      this.options = {
        container: options.container || null,
        defaultLanguage: options.defaultLanguage || 'python',
        showComparison: options.showComparison !== false,
        showEducationalInfo: options.showEducationalInfo !== false,
        enableFullscreen: options.enableFullscreen !== false,
        maxCacheSize: options.maxCacheSize || 50,
        ...options
      };
      
      this.currentCipher = null;
      this.currentLanguage = this.options.defaultLanguage;
      this.currentOperation = null;
      this.codeCache = new Map();
      this.isFullscreen = false;
      
      // Wait for dependencies
      this.highlighter = null;
      this.isInitialized = false;
      
      this._initializeWhenReady();
    }
    
    /**
     * Initialize when dependencies are ready
     * @private
     */
    async _initializeWhenReady() {
      // Wait for syntax highlighter
      if (global.syntaxHighlighter) {
        this.highlighter = global.syntaxHighlighter;
        await this._initialize();
      } else {
        // Listen for syntax highlighter ready event
        if (typeof document !== 'undefined') {
          document.addEventListener('syntaxHighlighterReady', (event) => {
            this.highlighter = event.detail.highlighter;
            this._initialize();
          });
        }
        
        // Fallback timeout
        setTimeout(() => {
          if (global.syntaxHighlighter && !this.isInitialized) {
            this.highlighter = global.syntaxHighlighter;
            this._initialize();
          }
        }, 2000);
      }
    }
    
    /**
     * Initialize the code display system
     * @private
     */
    async _initialize() {
      try {
        // Verify dependencies
        if (!this.highlighter) {
          console.error('CodeDisplayManager: SyntaxHighlighter not available');
          return;
        }
        
        if (!global.OpCodes || !global.OpCodes.generateCode) {
          console.warn('CodeDisplayManager: OpCodes code generation not available');
        }
        
        this.isInitialized = true;
        console.log('CodeDisplayManager: Initialized successfully');
        
        // Trigger ready event
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('codeDisplayManagerReady', {
            detail: { manager: this }
          }));
        }
        
      } catch (error) {
        console.error('CodeDisplayManager: Initialization failed:', error);
      }
    }
    
    /**
     * Create complete code display interface
     * @param {HTMLElement} container - Container element
     * @returns {HTMLElement} Code display interface
     */
    createInterface(container) {
      if (!container) {
        throw new Error('Container element required');
      }
      
      this.options.container = container;
      
      // Create main interface structure
      const interface_ = document.createElement('div');
      interface_.className = 'code-display-interface';
      interface_.setAttribute('role', 'region');
      interface_.setAttribute('aria-label', 'Code generation and display interface');
      
      // Create header with controls
      const header = this._createHeader();
      interface_.appendChild(header);
      
      // Create main content area
      const content = this._createContentArea();
      interface_.appendChild(content);
      
      // Create footer with educational info
      const footer = this._createFooter();
      interface_.appendChild(footer);
      
      // Append to container
      container.appendChild(interface_);
      
      // Initialize with default content
      this._updateInterface();
      
      return interface_;
    }
    
    /**
     * Create header with language selector and controls
     * @private
     */
    _createHeader() {
      const header = document.createElement('div');
      header.className = 'code-display-header';
      
      header.innerHTML = `
        <div class="header-left">
          <h3 class="code-title">
            <span class="title-icon">💻</span>
            Algorithm Implementation
          </h3>
          <p class="code-description">
            View cryptographic algorithm implementations across multiple programming languages
          </p>
        </div>
        <div class="header-right">
          <div class="control-group">
            <label for="language-selector" class="control-label">Language:</label>
            <select id="language-selector" class="language-selector" aria-label="Select programming language">
              <option value="">Select Language...</option>
            </select>
          </div>
          <div class="control-group">
            <label for="view-mode-selector" class="control-label">View:</label>
            <select id="view-mode-selector" class="view-mode-selector" aria-label="Select view mode">
              <option value="single">Single Language</option>
              <option value="comparison">Side-by-Side</option>
              <option value="grid">Grid View</option>
            </select>
          </div>
          <div class="action-buttons">
            <button id="refresh-code-btn" class="action-btn" title="Refresh code generation">
              🔄 Refresh
            </button>
            <button id="fullscreen-btn" class="action-btn" title="Toggle fullscreen view">
              ⛶ Fullscreen
            </button>
            <button id="theme-btn" class="action-btn" title="Switch theme">
              🎨 Theme
            </button>
          </div>
        </div>
      `;
      
      // Populate language selector
      this._populateLanguageSelector(header.querySelector('#language-selector'));
      
      // Attach event listeners
      this._attachHeaderEvents(header);
      
      return header;
    }
    
    /**
     * Create main content area for code display
     * @private
     */
    _createContentArea() {
      const content = document.createElement('div');
      content.className = 'code-display-content';
      content.setAttribute('role', 'main');
      content.setAttribute('aria-live', 'polite');
      
      // Create placeholder content
      content.innerHTML = `
        <div class="code-placeholder">
          <div class="placeholder-icon">🔐</div>
          <h4>Ready to Generate Code</h4>
          <p>Select a cipher algorithm and programming language to view the implementation.</p>
          <div class="placeholder-steps">
            <ol>
              <li>Choose an algorithm from the "Cipher Tool" tab</li>
              <li>Select your preferred programming language</li>
              <li>View syntax-highlighted implementation</li>
              <li>Compare implementations across languages</li>
            </ol>
          </div>
        </div>
      `;
      
      return content;
    }
    
    /**
     * Create footer with educational information
     * @private
     */
    _createFooter() {
      const footer = document.createElement('div');
      footer.className = 'code-display-footer';
      
      footer.innerHTML = `
        <div class="educational-notice">
          <div class="notice-icon">📚</div>
          <div class="notice-content">
            <strong>Educational Purpose:</strong>
            All generated code is for learning and understanding cryptographic algorithms.
            Review and test implementations before any production use.
          </div>
        </div>
        <div class="language-stats" id="language-stats">
          <span class="stats-item">
            <strong>Supported Languages:</strong> 
            <span id="supported-count">9</span>
          </span>
          <span class="stats-item">
            <strong>Current Theme:</strong> 
            <span id="current-theme">Educational</span>
          </span>
        </div>
      `;
      
      return footer;
    }
    
    /**
     * Populate language selector with available languages
     * @private
     */
    _populateLanguageSelector(selector) {
      if (!this.highlighter) return;
      
      const languages = this.highlighter.getAvailableLanguages();
      
      // Clear existing options except first
      while (selector.children.length > 1) {
        selector.removeChild(selector.lastChild);
      }
      
      // Add language options
      languages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.id;
        option.textContent = `${lang.icon} ${lang.name}`;
        option.title = lang.description;
        
        // Mark default language as selected
        if (lang.id === this.currentLanguage) {
          option.selected = true;
        }
        
        selector.appendChild(option);
      });
    }
    
    /**
     * Attach event listeners to header elements
     * @private
     */
    _attachHeaderEvents(header) {
      // Language selector change
      const langSelector = header.querySelector('#language-selector');
      langSelector.addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
      });
      
      // View mode selector change
      const viewSelector = header.querySelector('#view-mode-selector');
      viewSelector.addEventListener('change', (e) => {
        this.setViewMode(e.target.value);
      });
      
      // Refresh button
      const refreshBtn = header.querySelector('#refresh-code-btn');
      refreshBtn.addEventListener('click', () => {
        this._refreshCode();
      });
      
      // Fullscreen button
      const fullscreenBtn = header.querySelector('#fullscreen-btn');
      fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
      });
      
      // Theme button
      const themeBtn = header.querySelector('#theme-btn');
      themeBtn.addEventListener('click', () => {
        this._showThemeSelector();
      });
    }
    
    /**
     * Set current cipher algorithm
     * @param {string} cipherName - Cipher identifier
     */
    setCipher(cipherName) {
      if (this.currentCipher === cipherName) return;
      
      this.currentCipher = cipherName;
      this.currentOperation = this._getOperationFromCipher(cipherName);
      
      console.log(`CodeDisplayManager: Set cipher to ${cipherName}`);
      this._updateInterface();
    }
    
    /**
     * Set current programming language
     * @param {string} language - Language identifier
     */
    setLanguage(language) {
      if (this.currentLanguage === language || !language) return;
      
      this.currentLanguage = language;
      console.log(`CodeDisplayManager: Set language to ${language}`);
      this._updateInterface();
    }
    
    /**
     * Set view mode (single, comparison, grid)
     * @param {string} mode - View mode identifier
     */
    setViewMode(mode) {
      this.viewMode = mode;
      console.log(`CodeDisplayManager: Set view mode to ${mode}`);
      this._updateInterface();
    }
    
    /**
     * Generate and display code for current settings
     */
    async generateCode() {
      if (!this.isInitialized) {
        console.warn('CodeDisplayManager: Not initialized yet');
        return;
      }
      
      if (!this.currentCipher || !this.currentLanguage) {
        console.log('CodeDisplayManager: Missing cipher or language selection');
        return;
      }
      
      try {
        const content = this._getContentArea();
        if (!content) return;
        
        // Show loading state
        this._showLoading(content);
        
        // Check cache first
        const cacheKey = `${this.currentCipher}:${this.currentLanguage}:${this.viewMode || 'single'}`;
        if (this.codeCache.has(cacheKey)) {
          const cachedContent = this.codeCache.get(cacheKey);
          content.innerHTML = '';
          content.appendChild(cachedContent.cloneNode(true));
          return;
        }
        
        let resultElement;
        
        if (this.viewMode === 'comparison' || this.viewMode === 'grid') {
          // Generate comparison view
          const languages = this._getComparisonLanguages();
          resultElement = await this._generateComparisonView(languages);
        } else {
          // Generate single language view
          resultElement = await this._generateSingleView();
        }
        
        // Cache the result
        if (this.codeCache.size >= this.options.maxCacheSize) {
          const firstKey = this.codeCache.keys().next().value;
          this.codeCache.delete(firstKey);
        }
        this.codeCache.set(cacheKey, resultElement.cloneNode(true));
        
        // Display result
        content.innerHTML = '';
        content.appendChild(resultElement);
        
        // Update footer stats
        this._updateFooterStats();
        
      } catch (error) {
        console.error('CodeDisplayManager: Code generation failed:', error);
        this._showError(error.message);
      }
    }
    
    /**
     * Generate single language view
     * @private
     */
    async _generateSingleView() {
      if (!global.OpCodes || !global.OpCodes.generateCode) {
        throw new Error('OpCodes code generation not available');
      }
      
      // Generate code using OpCodes
      const operation = this.currentOperation || 'RotL32'; // Default operation
      const generatedCode = global.OpCodes.generateCode(this.currentLanguage, operation);
      
      // Create syntax highlighted display
      const codeDisplay = await this.highlighter.createCodeDisplay(generatedCode, this.currentLanguage, {
        title: `${this.currentCipher} - ${operation} Implementation`,
        showEducationalInfo: this.options.showEducationalInfo
      });
      
      // Add algorithm context
      const wrapper = document.createElement('div');
      wrapper.className = 'single-code-view';
      
      // Add algorithm header
      const algoHeader = this._createAlgorithmHeader();
      wrapper.appendChild(algoHeader);
      
      wrapper.appendChild(codeDisplay);
      
      // Add educational notes
      if (this.options.showEducationalInfo) {
        const notes = this._createEducationalNotes();
        wrapper.appendChild(notes);
      }
      
      return wrapper;
    }
    
    /**
     * Generate comparison view
     * @private
     */
    async _generateComparisonView(languages) {
      if (!global.CodeGenIntegration) {
        throw new Error('Code generation integration not available');
      }
      
      const operation = this.currentOperation || 'RotL32';
      
      // Use existing comparison functionality
      const comparison = await global.CodeGenIntegration.createLanguageComparison(
        languages,
        operation,
        this.highlighter
      );
      
      // Adjust grid layout based on view mode
      const grid = comparison.querySelector('.comparison-grid');
      if (grid && this.viewMode === 'grid') {
        grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(400px, 1fr))';
      }
      
      return comparison;
    }
    
    /**
     * Create algorithm header with context
     * @private
     */
    _createAlgorithmHeader() {
      const header = document.createElement('div');
      header.className = 'algorithm-header';
      
      // Get cipher info if available
      let cipherInfo = null;
      if (global.Cipher && global.Cipher.objGetCipher && this.currentCipher) {
        try {
          cipherInfo = global.Cipher.objGetCipher(this.currentCipher);
        } catch (e) {
          // Cipher not available
        }
      }
      
      const algorithmName = cipherInfo ? cipherInfo.name: this.currentCipher;
      const algorithmDescription = cipherInfo ? cipherInfo.comment: 'Cryptographic algorithm implementation';
      
      header.innerHTML = `
        <div class="algorithm-info">
          <h4 class="algorithm-name">
            <span class="algorithm-icon">🔒</span>
            ${algorithmName}
          </h4>
          <p class="algorithm-description">${algorithmDescription}</p>
        </div>
        <div class="implementation-info">
          <span class="impl-label">Implementation:</span>
          <span class="impl-language">${this._getLanguageDisplayName()}</span>
        </div>
      `;
      
      return header;
    }
    
    /**
     * Create educational notes section
     * @private
     */
    _createEducationalNotes() {
      const notes = document.createElement('div');
      notes.className = 'educational-notes';
      
      const langInfo = this._getCurrentLanguageInfo();
      
      notes.innerHTML = `
        <div class="notes-header">
          <h5>📖 Educational Notes</h5>
        </div>
        <div class="notes-content">
          <div class="note-section">
            <strong>About ${langInfo.name}:</strong>
            <p>${langInfo.educational.cryptoUse}</p>
          </div>
          <div class="note-section">
            <strong>Key Strengths:</strong>
            <ul>
              ${langInfo.educational.strengths.map(strength => `<li>${strength}</li>`).join('')}
            </ul>
          </div>
          <div class="note-section">
            <strong>Difficulty Level:</strong>
            <span class="difficulty-badge difficulty-${langInfo.educational.difficulty.toLowerCase()}">
              ${langInfo.educational.difficulty}
            </span>
          </div>
        </div>
      `;
      
      return notes;
    }
    
    /**
     * Show loading state
     * @private
     */
    _showLoading(container) {
      container.innerHTML = `
        <div class="code-loading">
          <div class="loading-spinner"></div>
          <h4>Generating Code...</h4>
          <p>Creating ${this._getLanguageDisplayName()} implementation for ${this.currentCipher}</p>
        </div>
      `;
    }
    
    /**
     * Show error state
     * @private
     */
    _showError(message) {
      const content = this._getContentArea();
      if (!content) return;
      
      content.innerHTML = `
        <div class="code-error">
          <div class="error-icon">⚠️</div>
          <h4>Code Generation Failed</h4>
          <p class="error-message">${message}</p>
          <div class="error-suggestions">
            <p><strong>Suggestions:</strong></p>
            <ul>
              <li>Try selecting a different programming language</li>
              <li>Ensure a cipher algorithm is selected</li>
              <li>Check that OpCodes code generation is available</li>
              <li>Refresh the page if the issue persists</li>
            </ul>
          </div>
          <button onclick="location.reload()" class="retry-btn">🔄 Retry</button>
        </div>
      `;
    }
    
    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
      const interface_ = this.options.container?.querySelector('.code-display-interface');
      if (!interface_) return;
      
      this.isFullscreen = !this.isFullscreen;
      
      if (this.isFullscreen) {
        interface_.classList.add('fullscreen');
        interface_.style.position = 'fixed';
        interface_.style.top = '0';
        interface_.style.left = '0';
        interface_.style.right = '0';
        interface_.style.bottom = '0';
        interface_.style.zIndex = '9999';
        interface_.style.background = '#ffffff';
        
        // Update button text
        const btn = interface_.querySelector('#fullscreen-btn');
        if (btn) btn.textContent = '🗗 Exit Fullscreen';
        
      } else {
        interface_.classList.remove('fullscreen');
        interface_.style.position = '';
        interface_.style.top = '';
        interface_.style.left = '';
        interface_.style.right = '';
        interface_.style.bottom = '';
        interface_.style.zIndex = '';
        interface_.style.background = '';
        
        // Update button text
        const btn = interface_.querySelector('#fullscreen-btn');
        if (btn) btn.textContent = '⛶ Fullscreen';
      }
    }
    
    /**
     * Show theme selector modal
     * @private
     */
    _showThemeSelector() {
      if (!this.highlighter) return;
      
      const themes = this.highlighter.getAvailableThemes();
      const currentTheme = this.highlighter.currentTheme;
      
      const modal = document.createElement('div');
      modal.className = 'theme-selector-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'theme-modal-title');
      
      modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h4 id="theme-modal-title">🎨 Select Theme</h4>
            <button class="modal-close" onclick="this.closest('.theme-selector-modal').remove()" aria-label="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="theme-grid">
              ${themes.map(theme => `
                <div class="theme-option ${theme === currentTheme ? 'selected' : ''}" 
                     onclick="window.codeDisplayManager?.switchTheme('${theme}', this)">
                  <div class="theme-preview theme-${theme}"></div>
                  <div class="theme-name">${this._formatThemeName(theme)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Focus management
      const closeButton = modal.querySelector('.modal-close');
      closeButton.focus();
    }
    
    /**
     * Switch syntax highlighting theme
     * @param {string} themeName - Theme identifier
     * @param {HTMLElement} element - Theme option element
     */
    async switchTheme(themeName, element) {
      if (!this.highlighter) return;
      
      try {
        await this.highlighter.switchTheme(themeName);
        
        // Update UI
        const modal = element.closest('.theme-selector-modal');
        modal.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('selected'));
        element.classList.add('selected');
        
        // Update footer
        const themeSpan = document.getElementById('current-theme');
        if (themeSpan) {
          themeSpan.textContent = this._formatThemeName(themeName);
        }
        
        // Close modal after short delay
        setTimeout(() => modal.remove(), 500);
        
      } catch (error) {
        console.error('Theme switch failed:', error);
      }
    }
    
    /**
     * Refresh current code display
     * @private
     */
    _refreshCode() {
      // Clear cache for current settings
      const cacheKey = `${this.currentCipher}:${this.currentLanguage}:${this.viewMode || 'single'}`;
      this.codeCache.delete(cacheKey);
      
      // Regenerate code
      this.generateCode();
    }
    
    /**
     * Update the entire interface based on current state
     * @private
     */
    _updateInterface() {
      if (!this.isInitialized) return;
      
      // Update language selector
      const langSelector = document.getElementById('language-selector');
      if (langSelector && langSelector.value !== this.currentLanguage) {
        langSelector.value = this.currentLanguage;
      }
      
      // Update title if cipher is selected
      const title = document.querySelector('.code-title');
      if (title && this.currentCipher) {
        title.innerHTML = `
          <span class="title-icon">💻</span>
          ${this.currentCipher} Implementation
        `;
      }
      
      // Generate code if we have required info
      if (this.currentCipher && this.currentLanguage) {
        this.generateCode();
      }
    }
    
    // ========================[ HELPER METHODS ]========================
    
    _getContentArea() {
      return this.options.container?.querySelector('.code-display-content');
    }
    
    _getOperationFromCipher(cipherName) {
      // Map cipher names to OpCodes operations
      const operationMap = {
        'Caesar': 'StringToBytes',
        'BASE64': 'StringToBytes',
        'ROT13': 'StringToBytes',
        'Atbash': 'StringToBytes',
        'Rijndael': 'RotL32',
        'Blowfish': 'Pack32BE',
        'TEA': 'XorArrays',
        'Anubis': 'GF256Mul',
        'Khazad': 'PKCS7Padding'
      };
      
      return operationMap[cipherName] || 'RotL32';
    }
    
    _getLanguageDisplayName() {
      if (!this.highlighter) return this.currentLanguage;
      
      const languages = this.highlighter.getAvailableLanguages();
      const lang = languages.find(l => l.id === this.currentLanguage);
      return lang ? lang.name : this.currentLanguage;
    }
    
    _getCurrentLanguageInfo() {
      if (!global.LanguageMap) return { name: this.currentLanguage, educational: { strengths: [], difficulty: 'Unknown', cryptoUse: 'General purpose' } };
      
      return global.LanguageMap[this.currentLanguage] || { 
        name: this.currentLanguage, 
        educational: { strengths: [], difficulty: 'Unknown', cryptoUse: 'General purpose' }
      };
    }
    
    _getComparisonLanguages() {
      // Default comparison languages based on educational value
      const defaultLanguages = ['python', 'java', 'cpp'];
      
      if (this.viewMode === 'grid') {
        return ['python', 'java', 'cpp', 'rust'];
      }
      
      return defaultLanguages;
    }
    
    _formatThemeName(theme) {
      return theme.charAt(0).toUpperCase() + theme.slice(1).replace(/-/g, ' ');
    }
    
    _updateFooterStats() {
      const supportedSpan = document.getElementById('supported-count');
      if (supportedSpan && this.highlighter) {
        supportedSpan.textContent = this.highlighter.getAvailableLanguages().length;
      }
    }
  }

  // ========================[ INTEGRATION WITH EXISTING SYSTEM ]========================
  
  /**
   * Integration manager for connecting with existing cipher tab system
   */
  const CodeTabIntegration = {
    
    /**
     * Initialize code tab in existing interface
     */
    initializeCodeTab() {
      // Wait for DOM to be ready
      if (typeof document === 'undefined') return;
      
      const initFn = () => {
        const codeTab = document.getElementById('code-tab');
        if (codeTab) {
          this.setupCodeTab(codeTab);
        } else {
          console.warn('Code tab not found in existing interface');
        }
      };
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFn);
      } else {
        initFn();
      }
    },
    
    /**
     * Setup code tab content
     */
    setupCodeTab(codeTab) {
      // Clear existing content
      codeTab.innerHTML = '';
      
      // Create code display manager
      const manager = new CodeDisplayManager({
        container: codeTab,
        showEducationalInfo: true,
        enableFullscreen: true
      });
      
      // Store reference for global access
      global.codeDisplayManager = manager;
      
      // Create interface
      manager.createInterface(codeTab);
      
      // Listen for cipher changes from main interface
      this.setupCipherChangeListener(manager);
      
      console.log('Code tab initialized successfully');
    },
    
    /**
     * Setup listener for cipher changes from main cipher tool
     */
    setupCipherChangeListener(manager) {
      // Override the global ChangeCipher function to notify code display
      if (typeof global.ChangeCipher === 'function') {
        const originalChangeCipher = global.ChangeCipher;
        
        global.ChangeCipher = function(cipherName) {
          // Call original function
          const result = originalChangeCipher.call(this, cipherName);
          
          // Notify code display manager
          if (manager && cipherName && cipherName !== '...' && cipherName !== '...') {
            manager.setCipher(cipherName);
          }
          
          return result;
        };
      }
      
      // Also listen for custom events
      if (typeof document !== 'undefined') {
        document.addEventListener('cipherChanged', (event) => {
          if (manager && event.detail && event.detail.cipherName) {
            manager.setCipher(event.detail.cipherName);
          }
        });
      }
    }
  };

  // ========================[ STYLES FOR CODE INTERFACE ]========================
  
  /**
   * Inject styles for the code display interface
   */
  function injectCodeInterfaceStyles() {
    if (typeof document === 'undefined') return;
    
    const style = document.createElement('style');
    style.textContent = `
      /* Code Display Interface Styles */
      .code-display-interface {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 500px;
        background: #f8f9fa;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .code-display-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-bottom: 1px solid #e1e1e1;
      }
      
      .header-left {
        flex: 1;
      }
      
      .code-title {
        margin: 0 0 0.5rem 0;
        font-size: 1.25rem;
        font-weight: bold;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .title-icon {
        font-size: 1.5rem;
      }
      
      .code-description {
        margin: 0;
        font-size: 0.875rem;
        opacity: 0.9;
      }
      
      .header-right {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: flex-end;
      }
      
      .control-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .control-label {
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      .language-selector,
      .view-mode-selector {
        padding: 0.5rem;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 0.875rem;
        min-width: 150px;
      }
      
      .language-selector option,
      .view-mode-selector option {
        background: #2d2d30;
        color: white;
      }
      
      .action-buttons {
        display: flex;
        gap: 0.5rem;
      }
      
      .action-btn {
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s ease;
      }
      
      .action-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-1px);
      }
      
      .action-btn:focus {
        outline: 2px solid rgba(255, 255, 255, 0.5);
        outline-offset: 2px;
      }
      
      /* Content area */
      .code-display-content {
        flex: 1;
        padding: 1rem;
        overflow-y: auto;
        background: white;
      }
      
      /* Placeholder content */
      .code-placeholder {
        text-align: center;
        padding: 3rem 2rem;
        color: #6c757d;
      }
      
      .placeholder-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
      }
      
      .placeholder-steps {
        margin-top: 2rem;
        text-align: left;
        max-width: 400px;
        margin-left: auto;
        margin-right: auto;
      }
      
      .placeholder-steps ol {
        padding-left: 1.5rem;
      }
      
      .placeholder-steps li {
        margin-bottom: 0.5rem;
        line-height: 1.5;
      }
      
      /* Loading state */
      .code-loading {
        text-align: center;
        padding: 3rem 2rem;
        color: #6c757d;
      }
      
      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem auto;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Error state */
      .code-error {
        text-align: center;
        padding: 3rem 2rem;
        color: #dc3545;
      }
      
      .error-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }
      
      .error-message {
        font-size: 1.1rem;
        margin-bottom: 1.5rem;
        color: #721c24;
      }
      
      .error-suggestions {
        text-align: left;
        max-width: 500px;
        margin: 0 auto 2rem auto;
        padding: 1rem;
        background: #f8d7da;
        border-radius: 4px;
      }
      
      .retry-btn {
        padding: 0.75rem 1.5rem;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
      }
      
      .retry-btn:hover {
        background: #c82333;
      }
      
      /* Single code view */
      .single-code-view {
        margin-bottom: 2rem;
      }
      
      .algorithm-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background: #e9ecef;
        border-radius: 8px 8px 0 0;
        border-bottom: 1px solid #dee2e6;
      }
      
      .algorithm-info h4 {
        margin: 0 0 0.5rem 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .algorithm-icon {
        font-size: 1.25rem;
      }
      
      .algorithm-description {
        margin: 0;
        font-size: 0.875rem;
        color: #6c757d;
      }
      
      .implementation-info {
        text-align: right;
        font-size: 0.875rem;
      }
      
      .impl-label {
        color: #6c757d;
      }
      
      .impl-language {
        font-weight: bold;
        color: #495057;
      }
      
      /* Educational notes */
      .educational-notes {
        margin-top: 1rem;
        padding: 1rem;
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 0 0 8px 8px;
      }
      
      .notes-header h5 {
        margin: 0 0 1rem 0;
        color: #495057;
      }
      
      .note-section {
        margin-bottom: 1rem;
      }
      
      .note-section:last-child {
        margin-bottom: 0;
      }
      
      .note-section ul {
        margin: 0.5rem 0;
        padding-left: 1.5rem;
      }
      
      /* Footer */
      .code-display-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background: #f8f9fa;
        border-top: 1px solid #e9ecef;
        font-size: 0.875rem;
      }
      
      .educational-notice {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #6c757d;
      }
      
      .notice-icon {
        font-size: 1.25rem;
      }
      
      .language-stats {
        display: flex;
        gap: 1rem;
      }
      
      .stats-item {
        color: #495057;
      }
      
      /* Theme selector modal */
      .theme-selector-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
      }
      
      .theme-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        padding: 1rem 0;
      }
      
      .theme-option {
        text-align: center;
        cursor: pointer;
        padding: 1rem;
        border: 2px solid transparent;
        border-radius: 8px;
        transition: all 0.2s ease;
      }
      
      .theme-option:hover {
        background: #f8f9fa;
        border-color: #dee2e6;
      }
      
      .theme-option.selected {
        border-color: #007bff;
        background: #e7f3ff;
      }
      
      .theme-preview {
        width: 60px;
        height: 40px;
        margin: 0 auto 0.5rem auto;
        border-radius: 4px;
        border: 1px solid #dee2e6;
      }
      
      .theme-preview.theme-educational {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      }
      
      .theme-preview.theme-dark {
        background: linear-gradient(135deg, #1e1e1e 0%, #2d2d30 100%);
      }
      
      .theme-preview.theme-okaidia {
        background: linear-gradient(135deg, #272822 0%, #3c3d2e 100%);
      }
      
      .theme-preview.theme-tomorrow {
        background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
      }
      
      .theme-preview.theme-twilight {
        background: linear-gradient(135deg, #141414 0%, #323232 100%);
      }
      
      .theme-preview.theme-high-contrast {
        background: linear-gradient(135deg, #000000 0%, #333333 100%);
      }
      
      .theme-name {
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      /* Fullscreen mode */
      .code-display-interface.fullscreen {
        border-radius: 0;
      }
      
      .code-display-interface.fullscreen .code-display-content {
        max-height: none;
      }
      
      /* Responsive design */
      @media (max-width: 768px) {
        .code-display-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 1rem;
        }
        
        .header-right {
          width: 100%;
          align-items: flex-start;
        }
        
        .control-group {
          width: 100%;
          justify-content: space-between;
        }
        
        .language-selector,
        .view-mode-selector {
          min-width: 120px;
        }
        
        .action-buttons {
          width: 100%;
          justify-content: flex-start;
          flex-wrap: wrap;
        }
        
        .algorithm-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }
        
        .implementation-info {
          text-align: left;
        }
        
        .code-display-footer {
          flex-direction: column;
          align-items: flex-start;
          gap: 1rem;
        }
        
        .language-stats {
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .theme-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  // ========================[ INITIALIZATION ]========================
  
  // Auto-inject styles when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectCodeInterfaceStyles);
    } else {
      injectCodeInterfaceStyles();
    }
  }
  
  // Initialize code tab integration
  CodeTabIntegration.initializeCodeTab();
  
  // Export to global scope
  global.CodeDisplayManager = CodeDisplayManager;
  global.CodeTabIntegration = CodeTabIntegration;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CodeDisplayManager,
      CodeTabIntegration
    };
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);