#!/usr/bin/env node
/*
 * Universal Syntax Highlighter System
 * Educational syntax highlighting for multi-language code display
 * Compatible with both Browser and Node.js environments
 * Based on Prism.js for maximum browser compatibility and educational features
 * (c)2006-2025 Hawkynt - SynthelicZ Educational Tools
 * 
 * Features:
 * - 9+ programming language support with syntax highlighting
 * - Dynamic language switching with live updates
 * - Educational themes optimized for readability
 * - Copy/download functionality
 * - Side-by-side code comparison
 * - Performance optimized with lazy loading
 * - Accessibility features (screen readers, high contrast)
 * - Integration with existing OpCodes code generation
 * 
 * Supported Languages:
 * - Python, C++, Java, Rust, C#, Kotlin, Perl, BASIC, Delphi/Pascal
 * 
 * Educational Purpose: This implementation demonstrates modern web
 * development practices for syntax highlighting in educational tools
 */

(function(global) {
  'use strict';
  
  // ========================[ PRISM.JS INTEGRATION ]========================
  
  const PrismConfig = {
    // CDN URLs for Prism.js components (latest stable version)
    core: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js',
    css: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css',
    
    // Language components (loaded dynamically)
    languages: {
      python: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js',
      cpp: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cpp.min.js',
      java: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js',
      rust: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-rust.min.js',
      csharp: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-csharp.min.js',
      kotlin: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-kotlin.min.js',
      perl: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-perl.min.js',
      pascal: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-pascal.min.js'
    },
    
    // Educational themes optimized for learning
    themes: {
      educational: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css',
      dark: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-dark.min.css',
      okaidia: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css',
      tomorrow: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css',
      twilight: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-twilight.min.css',
      'high-contrast': 'custom' // Custom high contrast theme for accessibility
    },
    
    // Plugins for enhanced functionality
    plugins: {
      lineNumbers: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.js',
      lineNumbersCSS: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.css',
      copyToClipboard: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/copy-to-clipboard/prism-copy-to-clipboard.min.js',
      downloadButton: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/download-button/prism-download-button.min.js'
    }
  };
  
  // ========================[ LANGUAGE DEFINITIONS ]========================
  
  const LanguageMap = {
    python: {
      name: 'Python',
      prismName: 'python',
      extension: '.py',
      icon: '🐍',
      description: 'Clean, readable syntax perfect for learning algorithms',
      mimeType: 'text/x-python',
      educational: {
        difficulty: 'Beginner',
        strengths: ['Readable syntax', 'Great for prototyping', 'Rich standard library'],
        cryptoUse: 'Ideal for understanding algorithm logic and quick prototyping'
      }
    },
    
    cpp: {
      name: 'C++',
      prismName: 'cpp',
      extension: '.cpp',
      icon: '⚙️',
      description: 'High-performance system programming with fine control',
      mimeType: 'text/x-c++src',
      educational: {
        difficulty: 'Advanced',
        strengths: ['Maximum performance', 'Memory control', 'Template system'],
        cryptoUse: 'Production cryptographic implementations requiring speed'
      }
    },
    
    java: {
      name: 'Java',
      prismName: 'java',
      extension: '.java',
      icon: '☕',
      description: 'Object-oriented programming with strong type safety',
      mimeType: 'text/x-java',
      educational: {
        difficulty: 'Intermediate',
        strengths: ['Platform independence', 'Strong typing', 'Rich ecosystem'],
        cryptoUse: 'Enterprise cryptographic applications and large systems'
      }
    },
    
    rust: {
      name: 'Rust',
      prismName: 'rust',
      extension: '.rs',
      icon: '🦀',
      description: 'Memory safety without garbage collection',
      mimeType: 'text/x-rust',
      educational: {
        difficulty: 'Advanced',
        strengths: ['Memory safety', 'Zero-cost abstractions', 'Concurrent programming'],
        cryptoUse: 'Modern secure implementations with guaranteed memory safety'
      }
    },
    
    csharp: {
      name: 'C#',
      prismName: 'csharp',
      extension: '.cs',
      icon: '🔷',
      description: 'Modern object-oriented language for .NET ecosystem',
      mimeType: 'text/x-csharp',
      educational: {
        difficulty: 'Intermediate',
        strengths: ['Modern syntax', '.NET integration', 'Strong tooling'],
        cryptoUse: 'Windows and cross-platform .NET cryptographic applications'
      }
    },
    
    kotlin: {
      name: 'Kotlin',
      prismName: 'kotlin',
      extension: '.kt',
      icon: '🟣',
      description: 'Modern JVM language with concise syntax',
      mimeType: 'text/x-kotlin',
      educational: {
        difficulty: 'Intermediate',
        strengths: ['Null safety', 'Concise syntax', 'Java interop'],
        cryptoUse: 'Android and JVM cryptographic applications'
      }
    },
    
    perl: {
      name: 'Perl',
      prismName: 'perl',
      extension: '.pl',
      icon: '🐪',
      description: 'Powerful text processing and pattern matching',
      mimeType: 'text/x-perl',
      educational: {
        difficulty: 'Intermediate',
        strengths: ['Regex mastery', 'Text processing', 'CPAN modules'],
        cryptoUse: 'Text-based crypto protocols and legacy system integration'
      }
    },
    
    basic: {
      name: 'BASIC',
      prismName: 'basic',
      extension: '.bas',
      icon: '📟',
      description: 'Simple, educational programming language',
      mimeType: 'text/x-basic',
      educational: {
        difficulty: 'Beginner',
        strengths: ['Simple syntax', 'Educational focus', 'Easy to understand'],
        cryptoUse: 'Learning fundamental cryptographic concepts'
      }
    },
    
    pascal: {
      name: 'Delphi/Pascal',
      prismName: 'pascal',
      extension: '.pas',
      icon: '🏛️',
      description: 'Structured programming with strong typing',
      mimeType: 'text/x-pascal',
      educational: {
        difficulty: 'Intermediate',
        strengths: ['Clear structure', 'Strong typing', 'Educational value'],
        cryptoUse: 'Academic cryptographic implementations and education'
      }
    }
  };

  // ========================[ SYNTAX HIGHLIGHTER CLASS ]========================
  
  class SyntaxHighlighter {
    constructor(options = {}) {
      this.options = {
        theme: options.theme || 'educational',
        lineNumbers: options.lineNumbers !== false,
        copyButton: options.copyButton !== false,
        downloadButton: options.downloadButton !== false,
        autoLanguageDetection: options.autoLanguageDetection || false,
        maxCodeLength: options.maxCodeLength || 50000, // Performance limit
        ...options
      };
      
      this.loadedLanguages = new Set();
      this.loadedPlugins = new Set();
      this.isInitialized = false;
      this.currentTheme = this.options.theme;
      
      // Performance optimization: cache compiled code
      this.codeCache = new Map();
      
      // Accessibility support
      this.accessibilityEnabled = true;
      
      // Initialize when DOM is ready
      this._initializeWhenReady();
    }
    
    /**
     * Initialize the syntax highlighter system
     * @private
     */
    async _initializeWhenReady() {
      if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => this._initialize());
        } else {
          await this._initialize();
        }
      } else {
        // Node.js environment - skip DOM-based initialization
        this.isInitialized = true;
      }
    }
    
    /**
     * Load and initialize Prism.js core
     * @private
     */
    async _initialize() {
      try {
        // Load Prism.js core if not already loaded
        if (typeof window.Prism === 'undefined') {
          await this._loadScript(PrismConfig.core);
          await this._loadStylesheet(PrismConfig.css);
        }
        
        // Configure Prism
        if (window.Prism) {
          window.Prism.manual = true; // Manual highlighting for better control
          window.Prism.plugins = window.Prism.plugins || {};
        }
        
        // Load essential plugins
        await this._loadPlugin('lineNumbers');
        await this._loadPlugin('copyToClipboard');
        
        // Load custom educational theme if needed
        if (this.currentTheme === 'high-contrast') {
          this._injectCustomTheme();
        }
        
        this.isInitialized = true;
        console.log('SyntaxHighlighter: Initialization complete');
        
        // Trigger custom event for integration
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('syntaxHighlighterReady', {
            detail: { highlighter: this }
          }));
        }
        
      } catch (error) {
        console.error('SyntaxHighlighter: Failed to initialize:', error);
      }
    }
    
    /**
     * Load external script dynamically
     * @private
     */
    _loadScript(url) {
      return new Promise((resolve, reject) => {
        if (typeof document === 'undefined') {
          reject(new Error('Document not available'));
          return;
        }
        
        // Check if already loaded
        const existing = document.querySelector(`script[src="${url}"]`);
        if (existing) {
          resolve();
          return;
        }
        
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
        document.head.appendChild(script);
      });
    }
    
    /**
     * Load external stylesheet dynamically
     * @private
     */
    _loadStylesheet(url) {
      return new Promise((resolve, reject) => {
        if (typeof document === 'undefined') {
          resolve();
          return;
        }
        
        // Check if already loaded
        const existing = document.querySelector(`link[href="${url}"]`);
        if (existing) {
          resolve();
          return;
        }
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = resolve;
        link.onerror = () => reject(new Error(`Failed to load stylesheet: ${url}`));
        document.head.appendChild(link);
      });
    }
    
    /**
     * Load Prism plugin
     * @private
     */
    async _loadPlugin(pluginName) {
      if (this.loadedPlugins.has(pluginName)) return;
      
      const config = PrismConfig.plugins;
      if (config[pluginName]) {
        await this._loadScript(config[pluginName]);
        
        // Load plugin CSS if available
        const cssKey = pluginName + 'CSS';
        if (config[cssKey]) {
          await this._loadStylesheet(config[cssKey]);
        }
        
        this.loadedPlugins.add(pluginName);
      }
    }
    
    /**
     * Load language support dynamically
     * @param {string} language - Language identifier
     */
    async loadLanguage(language) {
      if (this.loadedLanguages.has(language)) return;
      
      const langConfig = LanguageMap[language];
      if (!langConfig) {
        console.warn(`SyntaxHighlighter: Unknown language: ${language}`);
        return;
      }
      
      const prismLangUrl = PrismConfig.languages[language];
      if (prismLangUrl) {
        try {
          await this._loadScript(prismLangUrl);
          this.loadedLanguages.add(language);
          console.log(`SyntaxHighlighter: Loaded ${langConfig.name} support`);
        } catch (error) {
          console.error(`SyntaxHighlighter: Failed to load ${langConfig.name}:`, error);
        }
      }
    }
    
    /**
     * Inject custom high contrast theme for accessibility
     * @private
     */
    _injectCustomTheme() {
      if (typeof document === 'undefined') return;
      
      const style = document.createElement('style');
      style.textContent = `
        /* High Contrast Educational Theme */
        .syntax-highlighter-high-contrast {
          background: #000000 !important;
          color: #FFFFFF !important;
          border: 2px solid #FFFFFF;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          line-height: 1.6;
        }
        
        .syntax-highlighter-high-contrast .token.comment { color: #00FF00 !important; }
        .syntax-highlighter-high-contrast .token.keyword { color: #00FFFF !important; font-weight: bold; }
        .syntax-highlighter-high-contrast .token.string { color: #FFFF00 !important; }
        .syntax-highlighter-high-contrast .token.number { color: #FF00FF !important; }
        .syntax-highlighter-high-contrast .token.function { color: #FFA500 !important; font-weight: bold; }
        .syntax-highlighter-high-contrast .token.class-name { color: #FF69B4 !important; font-weight: bold; }
        .syntax-highlighter-high-contrast .token.operator { color: #FFFFFF !important; font-weight: bold; }
        .syntax-highlighter-high-contrast .token.punctuation { color: #CCCCCC !important; }
        
        /* Line numbers in high contrast */
        .syntax-highlighter-high-contrast .line-numbers .line-numbers-rows {
          border-right: 2px solid #FFFFFF;
          background: #333333;
        }
        
        .syntax-highlighter-high-contrast .line-numbers-rows > span:before {
          color: #FFFFFF !important;
          font-weight: bold;
        }
      `;
      document.head.appendChild(style);
    }
    
    /**
     * Highlight code with specified language
     * @param {string} code - Source code to highlight
     * @param {string} language - Programming language
     * @param {Object} options - Highlighting options
     * @returns {string} Highlighted HTML
     */
    async highlightCode(code, language, options = {}) {
      if (!this.isInitialized) {
        await this._initialize();
      }
      
      // Performance check
      if (code.length > this.options.maxCodeLength) {
        console.warn('SyntaxHighlighter: Code too long, truncating for performance');
        code = code.substring(0, this.options.maxCodeLength) + '\n// ... (truncated for performance)';
      }
      
      // Check cache first
      const cacheKey = `${language}:${this._hashCode(code)}`;
      if (this.codeCache.has(cacheKey)) {
        return this.codeCache.get(cacheKey);
      }
      
      // Load language support if needed
      await this.loadLanguage(language);
      
      // Get language config
      const langConfig = LanguageMap[language];
      if (!langConfig) {
        return this._highlightAsPlainText(code);
      }
      
      let highlightedCode;
      
      try {
        if (typeof window !== 'undefined' && window.Prism) {
          // Browser environment with Prism.js
          const prismLanguage = langConfig.prismName;
          
          if (window.Prism.languages[prismLanguage]) {
            highlightedCode = window.Prism.highlight(code, window.Prism.languages[prismLanguage], prismLanguage);
          } else {
            console.warn(`Prism language not available: ${prismLanguage}`);
            highlightedCode = this._highlightAsPlainText(code);
          }
        } else {
          // Fallback for Node.js or when Prism is not available
          highlightedCode = this._highlightAsPlainText(code);
        }
        
        // Cache the result
        this.codeCache.set(cacheKey, highlightedCode);
        
        // Limit cache size
        if (this.codeCache.size > 100) {
          const firstKey = this.codeCache.keys().next().value;
          this.codeCache.delete(firstKey);
        }
        
      } catch (error) {
        console.error('SyntaxHighlighter: Highlighting failed:', error);
        highlightedCode = this._highlightAsPlainText(code);
      }
      
      return highlightedCode;
    }
    
    /**
     * Create complete code display with controls
     * @param {string} code - Source code
     * @param {string} language - Programming language
     * @param {Object} options - Display options
     * @returns {HTMLElement} Complete code display element
     */
    async createCodeDisplay(code, language, options = {}) {
      const langConfig = LanguageMap[language];
      if (!langConfig) {
        throw new Error(`Unsupported language: ${language}`);
      }
      
      // Create container
      const container = document.createElement('div');
      container.className = 'syntax-highlighter-container';
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', `${langConfig.name} code example`);
      
      // Add language header
      const header = this._createLanguageHeader(langConfig, options);
      container.appendChild(header);
      
      // Create code block
      const codeElement = document.createElement('pre');
      codeElement.className = `language-${langConfig.prismName}`;
      
      if (this.options.lineNumbers) {
        codeElement.classList.add('line-numbers');
      }
      
      if (this.currentTheme === 'high-contrast') {
        codeElement.classList.add('syntax-highlighter-high-contrast');
      }
      
      // Add accessibility attributes
      codeElement.setAttribute('tabindex', '0');
      codeElement.setAttribute('role', 'textbox');
      codeElement.setAttribute('aria-readonly', 'true');
      codeElement.setAttribute('aria-label', `${langConfig.name} source code`);
      
      // Create code element
      const codeInner = document.createElement('code');
      codeInner.className = `language-${langConfig.prismName}`;
      
      // Highlight the code
      const highlightedCode = await this.highlightCode(code, language, options);
      codeInner.innerHTML = highlightedCode;
      
      codeElement.appendChild(codeInner);
      container.appendChild(codeElement);
      
      // Add control buttons
      const controls = this._createControlButtons(code, language, langConfig);
      container.appendChild(controls);
      
      // Trigger Prism highlighting for plugins
      if (typeof window !== 'undefined' && window.Prism) {
        window.Prism.highlightElement(codeInner);
      }
      
      return container;
    }
    
    /**
     * Create language header with info
     * @private
     */
    _createLanguageHeader(langConfig, options) {
      const header = document.createElement('div');
      header.className = 'syntax-highlighter-header';
      
      header.innerHTML = `
        <div class="language-info">
          <span class="language-icon" role="img" aria-label="${langConfig.name} icon">${langConfig.icon}</span>
          <span class="language-name">${langConfig.name}</span>
          <span class="language-description">${langConfig.description}</span>
        </div>
        <div class="educational-info">
          <span class="difficulty-badge difficulty-${langConfig.educational.difficulty.toLowerCase()}">
            ${langConfig.educational.difficulty}
          </span>
        </div>
      `;
      
      return header;
    }
    
    /**
     * Create control buttons for code display
     * @private
     */
    _createControlButtons(code, language, langConfig) {
      const controls = document.createElement('div');
      controls.className = 'syntax-highlighter-controls';
      
      // Copy button
      if (this.options.copyButton) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'syntax-btn copy-btn';
        copyBtn.innerHTML = '📋 Copy Code';
        copyBtn.setAttribute('aria-label', 'Copy code to clipboard');
        copyBtn.onclick = () => this._copyToClipboard(code, copyBtn);
        controls.appendChild(copyBtn);
      }
      
      // Download button
      if (this.options.downloadButton) {
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'syntax-btn download-btn';
        downloadBtn.innerHTML = '💾 Download';
        downloadBtn.setAttribute('aria-label', `Download ${langConfig.name} file`);
        downloadBtn.onclick = () => this._downloadCode(code, language, langConfig);
        controls.appendChild(downloadBtn);
      }
      
      // Educational info button
      const infoBtn = document.createElement('button');
      infoBtn.className = 'syntax-btn info-btn';
      infoBtn.innerHTML = '📚 Learn More';
      infoBtn.setAttribute('aria-label', `Learn more about ${langConfig.name}`);
      infoBtn.onclick = () => this._showEducationalInfo(langConfig);
      controls.appendChild(infoBtn);
      
      return controls;
    }
    
    /**
     * Copy code to clipboard
     * @private
     */
    async _copyToClipboard(code, button) {
      try {
        await navigator.clipboard.writeText(code);
        
        // Visual feedback
        const originalText = button.innerHTML;
        button.innerHTML = '✅ Copied!';
        button.classList.add('success');
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('success');
        }, 2000);
        
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        
        // Fallback for older browsers
        this._fallbackCopyToClipboard(code);
        
        button.innerHTML = '⚠️ Copy manually';
        setTimeout(() => {
          button.innerHTML = '📋 Copy Code';
        }, 2000);
      }
    }
    
    /**
     * Fallback copy method for older browsers
     * @private
     */
    _fallbackCopyToClipboard(code) {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
      } catch (error) {
        console.error('Fallback copy failed:', error);
      }
      
      document.body.removeChild(textArea);
    }
    
    /**
     * Download code as file
     * @private
     */
    _downloadCode(code, language, langConfig) {
      const filename = `cipher_implementation${langConfig.extension}`;
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up object URL
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }
    
    /**
     * Show educational information modal
     * @private
     */
    _showEducationalInfo(langConfig) {
      // Create modal with educational information
      const modal = document.createElement('div');
      modal.className = 'syntax-highlighter-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'modal-title');
      
      modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="modal-title">${langConfig.icon} ${langConfig.name}</h3>
            <button class="modal-close" onclick="this.closest('.syntax-highlighter-modal').remove()" aria-label="Close modal">&times;</button>
          </div>
          <div class="modal-body">
            <p><strong>Description:</strong> ${langConfig.description}</p>
            <p><strong>Difficulty Level:</strong> ${langConfig.educational.difficulty}</p>
            <p><strong>Cryptographic Use:</strong> ${langConfig.educational.cryptoUse}</p>
            <div class="strengths">
              <strong>Key Strengths:</strong>
              <ul>
                ${langConfig.educational.strengths.map(strength => `<li>${strength}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Focus management for accessibility
      const closeButton = modal.querySelector('.modal-close');
      closeButton.focus();
      
      // Escape key handling
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          modal.remove();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    }
    
    /**
     * Switch theme
     * @param {string} themeName - Theme identifier
     */
    async switchTheme(themeName) {
      if (this.currentTheme === themeName) return;
      
      // Remove current theme styles
      const existingThemeLinks = document.querySelectorAll('link[data-syntax-theme]');
      existingThemeLinks.forEach(link => link.remove());
      
      // Load new theme
      if (PrismConfig.themes[themeName] && PrismConfig.themes[themeName] !== 'custom') {
        const themeUrl = PrismConfig.themes[themeName];
        await this._loadStylesheet(themeUrl);
        
        // Mark as theme stylesheet
        const themeLink = document.querySelector(`link[href="${themeUrl}"]`);
        if (themeLink) {
          themeLink.setAttribute('data-syntax-theme', themeName);
        }
      } else if (themeName === 'high-contrast') {
        this._injectCustomTheme();
      }
      
      this.currentTheme = themeName;
      
      // Update all existing code displays
      this._updateExistingDisplays();
    }
    
    /**
     * Update existing code displays with new theme
     * @private
     */
    _updateExistingDisplays() {
      const codeElements = document.querySelectorAll('.syntax-highlighter-container pre');
      codeElements.forEach(element => {
        if (this.currentTheme === 'high-contrast') {
          element.classList.add('syntax-highlighter-high-contrast');
        } else {
          element.classList.remove('syntax-highlighter-high-contrast');
        }
      });
    }
    
    /**
     * Get available languages
     * @returns {Array} Array of language objects
     */
    getAvailableLanguages() {
      return Object.keys(LanguageMap).map(key => ({
        id: key,
        ...LanguageMap[key]
      }));
    }
    
    /**
     * Get available themes
     * @returns {Array} Array of theme names
     */
    getAvailableThemes() {
      return Object.keys(PrismConfig.themes);
    }
    
    /**
     * Clear code cache (useful for memory management)
     */
    clearCache() {
      this.codeCache.clear();
    }
    
    /**
     * Hash code for caching
     * @private
     */
    _hashCode(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash;
    }
    
    /**
     * Fallback plain text highlighting
     * @private
     */
    _highlightAsPlainText(code) {
      return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }

  // ========================[ INTEGRATION HELPERS ]========================
  
  /**
   * Integration with existing OpCodes code generation system
   */
  const CodeGenIntegration = {
    
    /**
     * Generate and highlight code from OpCodes
     * @param {string} language - Target language
     * @param {string} operation - Operation name
     * @param {SyntaxHighlighter} highlighter - Highlighter instance
     * @returns {HTMLElement} Highlighted code display
     */
    async generateHighlightedCode(language, operation, highlighter) {
      if (!global.OpCodes || !global.OpCodes.generateCode) {
        throw new Error('OpCodes code generation not available');
      }
      
      try {
        // Generate code using OpCodes system
        const generatedCode = global.OpCodes.generateCode(language, operation);
        
        // Create syntax highlighted display
        const codeDisplay = await highlighter.createCodeDisplay(generatedCode, language, {
          title: `${operation} Implementation`,
          showEducationalInfo: true
        });
        
        return codeDisplay;
        
      } catch (error) {
        console.error('Code generation failed:', error);
        throw error;
      }
    },
    
    /**
     * Create side-by-side comparison of multiple languages
     * @param {Array<string>} languages - Languages to compare
     * @param {string} operation - Operation name
     * @param {SyntaxHighlighter} highlighter - Highlighter instance
     * @returns {HTMLElement} Comparison container
     */
    async createLanguageComparison(languages, operation, highlighter) {
      const container = document.createElement('div');
      container.className = 'language-comparison';
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', `Code comparison for ${operation}`);
      
      // Add comparison header
      const header = document.createElement('div');
      header.className = 'comparison-header';
      header.innerHTML = `
        <h3>Algorithm Implementation Comparison: ${operation}</h3>
        <p>Compare the same cryptographic operation across different programming languages</p>
      `;
      container.appendChild(header);
      
      // Create grid container
      const grid = document.createElement('div');
      grid.className = 'comparison-grid';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = `repeat(${Math.min(languages.length, 2)}, 1fr)`;
      grid.style.gap = '20px';
      
      // Generate code for each language
      for (const language of languages) {
        try {
          const codeDisplay = await this.generateHighlightedCode(language, operation, highlighter);
          codeDisplay.classList.add('comparison-item');
          grid.appendChild(codeDisplay);
        } catch (error) {
          console.error(`Failed to generate ${language} code:`, error);
          
          // Create error placeholder
          const errorDiv = document.createElement('div');
          errorDiv.className = 'comparison-item comparison-error';
          errorDiv.innerHTML = `
            <div class="syntax-highlighter-header">
              <div class="language-info">
                <span class="language-name">${language}</span>
                <span class="error-message">Generation failed</span>
              </div>
            </div>
            <pre class="error-placeholder">Code generation not available for this language</pre>
          `;
          grid.appendChild(errorDiv);
        }
      }
      
      container.appendChild(grid);
      return container;
    }
  };

  // ========================[ CSS STYLES ]========================
  
  /**
   * Inject necessary CSS styles for the syntax highlighter
   */
  function injectStyles() {
    if (typeof document === 'undefined') return;
    
    const style = document.createElement('style');
    style.textContent = `
      /* Syntax Highlighter Base Styles */
      .syntax-highlighter-container {
        margin: 1rem 0;
        border: 1px solid #e1e1e1;
        border-radius: 8px;
        overflow: hidden;
        background: #f8f9fa;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      }
      
      .syntax-highlighter-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-bottom: 1px solid #e1e1e1;
      }
      
      .language-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .language-icon {
        font-size: 1.25rem;
      }
      
      .language-name {
        font-weight: bold;
        font-size: 1rem;
      }
      
      .language-description {
        font-size: 0.875rem;
        opacity: 0.9;
      }
      
      .educational-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .difficulty-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: bold;
        text-transform: uppercase;
      }
      
      .difficulty-beginner {
        background: #28a745;
        color: white;
      }
      
      .difficulty-intermediate {
        background: #ffc107;
        color: black;
      }
      
      .difficulty-advanced {
        background: #dc3545;
        color: white;
      }
      
      /* Code display styles */
      .syntax-highlighter-container pre {
        margin: 0;
        padding: 1rem;
        background: #ffffff;
        font-size: 14px;
        line-height: 1.5;
        overflow-x: auto;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .syntax-highlighter-container code {
        font-family: inherit;
      }
      
      /* Control buttons */
      .syntax-highlighter-controls {
        display: flex;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: #f8f9fa;
        border-top: 1px solid #e1e1e1;
      }
      
      .syntax-btn {
        padding: 0.5rem 1rem;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s ease;
      }
      
      .syntax-btn:hover {
        background: #e9ecef;
        border-color: #adb5bd;
      }
      
      .syntax-btn:focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
      }
      
      .syntax-btn.success {
        background: #28a745;
        color: white;
        border-color: #28a745;
      }
      
      /* Modal styles */
      .syntax-highlighter-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
      }
      
      .modal-content {
        position: relative;
        background: white;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid #e1e1e1;
        background: #f8f9fa;
      }
      
      .modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }
      
      .modal-close:hover {
        background: #e9ecef;
      }
      
      .modal-body {
        padding: 1rem;
      }
      
      .strengths ul {
        margin: 0.5rem 0;
        padding-left: 1.5rem;
      }
      
      /* Language comparison styles */
      .language-comparison {
        margin: 2rem 0;
      }
      
      .comparison-header {
        text-align: center;
        margin-bottom: 1.5rem;
        padding: 1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 8px;
      }
      
      .comparison-grid {
        display: grid;
        gap: 1rem;
      }
      
      .comparison-item {
        border: 1px solid #e1e1e1;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .comparison-error {
        background: #f8d7da;
        color: #721c24;
      }
      
      .comparison-error .error-placeholder {
        background: #f5c6cb;
        color: #721c24;
        padding: 1rem;
        margin: 0;
        font-style: italic;
      }
      
      /* Responsive design */
      @media (max-width: 768px) {
        .syntax-highlighter-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }
        
        .language-description {
          display: none;
        }
        
        .syntax-highlighter-controls {
          flex-wrap: wrap;
        }
        
        .comparison-grid {
          grid-template-columns: 1fr !important;
        }
      }
      
      /* Dark theme compatibility */
      @media (prefers-color-scheme: dark) {
        .syntax-highlighter-container {
          background: #1e1e1e;
          border-color: #333;
        }
        
        .syntax-highlighter-container pre {
          background: #2d2d30;
          color: #d4d4d4;
        }
        
        .syntax-highlighter-controls {
          background: #1e1e1e;
          border-color: #333;
        }
        
        .syntax-btn {
          background: #2d2d30;
          color: #d4d4d4;
          border-color: #3e3e42;
        }
        
        .syntax-btn:hover {
          background: #3e3e42;
        }
        
        .modal-content {
          background: #1e1e1e;
          color: #d4d4d4;
        }
        
        .modal-header {
          background: #2d2d30;
          border-color: #3e3e42;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  // ========================[ INITIALIZATION & EXPORT ]========================
  
  // Auto-inject styles when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
      injectStyles();
    }
  }
  
  // Export to global scope
  global.SyntaxHighlighter = SyntaxHighlighter;
  global.CodeGenIntegration = CodeGenIntegration;
  global.LanguageMap = LanguageMap;
  
  // Create global instance for easy access
  global.syntaxHighlighter = new SyntaxHighlighter({
    theme: 'educational',
    lineNumbers: true,
    copyButton: true,
    downloadButton: true
  });
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SyntaxHighlighter,
      CodeGenIntegration,
      LanguageMap,
      PrismConfig
    };
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);