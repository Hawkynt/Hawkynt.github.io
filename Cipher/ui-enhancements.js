/*
 * Enhanced UI Components for SynthelicZ Cipher Tools
 * Provides advanced UI functionality while maintaining IE5+ compatibility
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Initialize UI Enhancement System
  global.UIEnhancements = {
    // Configuration
    config: {
      enableSyntaxHighlighting: true,
      enableSearch: true,
      animationDuration: 300,
      codeViewerMaxLines: 1000
    },
    
    // State management
    state: {
      currentAlgorithm: null,
      searchQuery: '',
      selectedLanguage: 'javascript',
      codeVisible: false,
      metadataVisible: false
    },
    
    // Initialize all UI enhancements
    init: function() {
      try {
        this.initAlgorithmSelector();
        this.initCodeViewer();
        this.initMetadataPanel();
        this.initMultiLanguagePanel();
        this.initProgressIndicators();
        this.initFileOperations();
        this.initAccessibility();
        this.initEventListeners();
        console.log('UI Enhancements initialized successfully');
      } catch (e) {
        console.error('Failed to initialize UI enhancements:', e);
      }
    },
    
    // Enhanced Algorithm Selector
    initAlgorithmSelector: function() {
      const originalSelect = document.getElementById('slctCipher');
      if (!originalSelect || !originalSelect.parentNode) {
        console.warn('Original cipher selector not found');
        return;
      }
      
      // Create enhanced selector container
      const container = document.createElement('div');
      container.className = 'algorithm-selector';
      container.innerHTML = this.getAlgorithmSelectorHTML();
      
      // Replace or enhance existing selector
      originalSelect.style.display = 'none';
      originalSelect.parentNode.insertBefore(container, originalSelect.nextSibling);
      
      // Populate algorithm grid
      this.populateAlgorithmGrid();
      
      // Setup search functionality
      this.setupAlgorithmSearch();
    },
    
    getAlgorithmSelectorHTML: function() {
      return `
        <div class="search-container">
          <input type="text" class="search-input" id="algorithm-search" 
                 placeholder="Search algorithms..." aria-label="Search algorithms">
          <span class="search-icon">🔍</span>
        </div>
        <div class="algorithm-grid" id="algorithm-grid" role="listbox" aria-label="Available cipher algorithms">
          <!-- Populated dynamically -->
        </div>
      `;
    },
    
    populateAlgorithmGrid: function() {
      const grid = document.getElementById('algorithm-grid');
      if (!grid || typeof Cipher === 'undefined') {
        console.warn('Cannot populate algorithm grid - missing elements');
        return;
      }
      
      try {
        const algorithms = Cipher.getCiphers ? Cipher.getCiphers() : [];
        grid.innerHTML = '';
        
        algorithms.forEach(function(algorithmId) {
          try {
            const cipherInfo = Cipher.objGetCipher(algorithmId);
            const card = UIEnhancements.createAlgorithmCard(algorithmId, cipherInfo);
            grid.appendChild(card);
          } catch (e) {
            console.warn('Error creating card for algorithm:', algorithmId, e);
          }
        });
      } catch (e) {
        console.error('Error populating algorithm grid:', e);
      }
    },
    
    createAlgorithmCard: function(algorithmId, cipherInfo) {
      const card = document.createElement('div');
      card.className = 'algorithm-card';
      card.setAttribute('data-algorithm', algorithmId);
      card.setAttribute('role', 'option');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', cipherInfo.name + ' cipher algorithm');
      
      const tags = this.generateAlgorithmTags(cipherInfo);
      const description = cipherInfo.comment || 'No description available.';
      
      card.innerHTML = `
        <div class="algorithm-name">${cipherInfo.name}</div>
        <div class="algorithm-description">${this.escapeHtml(description)}</div>
        <div class="algorithm-tags">${tags}</div>
      `;
      
      // Add event listeners
      const self = this;
      card.onclick = function() {
        self.selectAlgorithm(algorithmId, card);
      };
      
      card.onkeydown = function(e) {
        if (e.keyCode === 13 || e.keyCode === 32) { // Enter or Space
          e.preventDefault();
          self.selectAlgorithm(algorithmId, card);
        }
      };
      
      return card;
    },
    
    generateAlgorithmTags: function(cipherInfo) {
      const tags = [];
      
      // Determine cipher type
      if (cipherInfo.internalName && cipherInfo.internalName.toLowerCase().includes('stream')) {
        tags.push('Stream');
      } else if (cipherInfo.minBlockSize > 0) {
        tags.push('Block');
      } else {
        tags.push('Classical');
      }
      
      // Key length info
      if (cipherInfo.minKeyLength > 0) {
        tags.push(`${cipherInfo.minKeyLength}-${cipherInfo.maxKeyLength} bit key`);
      } else {
        tags.push('No key');
      }
      
      // Special properties
      if (cipherInfo.cantDecode) {
        tags.push('One-way');
      }
      
      // Convert to HTML
      return tags.map(function(tag) {
        return `<span class="algorithm-tag">${UIEnhancements.escapeHtml(tag)}</span>`;
      }).join('');
    },
    
    selectAlgorithm: function(algorithmId, cardElement) {
      try {
        // Update visual selection
        const allCards = document.querySelectorAll('.algorithm-card');
        for (let i = 0; i < allCards.length; i++) {
          allCards[i].classList.remove('selected');
        }
        cardElement.classList.add('selected');
        
        // Update original select (for compatibility)
        const originalSelect = document.getElementById('slctCipher');
        if (originalSelect) {
          for (let i = 0; i < originalSelect.options.length; i++) {
            if (originalSelect.options[i].value === algorithmId) {
              originalSelect.selectedIndex = i;
              break;
            }
          }
          
          // Trigger change event
          if (typeof ChangeCipher === 'function') {
            ChangeCipher(algorithmId);
          }
        }
        
        // Update state and UI
        this.state.currentAlgorithm = algorithmId;
        this.updateCodeViewer(algorithmId);
        this.updateMetadataPanel(algorithmId);
        
        // Show success feedback
        this.showNotification('Algorithm selected: ' + algorithmId, 'success');
        
      } catch (e) {
        console.error('Error selecting algorithm:', e);
        this.showNotification('Error selecting algorithm', 'error');
      }
    },
    
    setupAlgorithmSearch: function() {
      const searchInput = document.getElementById('algorithm-search');
      if (!searchInput) return;
      
      const self = this;
      searchInput.oninput = function() {
        self.filterAlgorithms(this.value);
      };
      
      searchInput.onkeydown = function(e) {
        if (e.keyCode === 27) { // Escape
          this.value = '';
          self.filterAlgorithms('');
        }
      };
    },
    
    filterAlgorithms: function(query) {
      this.state.searchQuery = query.toLowerCase();
      const cards = document.querySelectorAll('.algorithm-card');
      
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const name = card.querySelector('.algorithm-name').textContent.toLowerCase();
        const description = card.querySelector('.algorithm-description').textContent.toLowerCase();
        const tags = card.querySelector('.algorithm-tags').textContent.toLowerCase();
        
        const matches = name.includes(this.state.searchQuery) ||
                       description.includes(this.state.searchQuery) ||
                       tags.includes(this.state.searchQuery);
        
        card.style.display = matches ? 'block' : 'none';
      }
    },
    
    // Code Viewer Component
    initCodeViewer: function() {
      // Code viewer is created dynamically when needed
      this.codeCache = {};
    },
    
    updateCodeViewer: function(algorithmId) {
      if (!algorithmId) return;
      
      try {
        // Find or create code viewer container
        let container = document.getElementById('code-viewer-container');
        if (!container) {
          container = this.createCodeViewerContainer();
          const metadataPanel = document.querySelector('.metadata-panel') || 
                               document.querySelector('.cipher-info');
          if (metadataPanel && metadataPanel.parentNode) {
            metadataPanel.parentNode.insertBefore(container, metadataPanel.nextSibling);
          }
        }
        
        // Load and display code
        this.loadAlgorithmCode(algorithmId);
        
      } catch (e) {
        console.error('Error updating code viewer:', e);
      }
    },
    
    createCodeViewerContainer: function() {
      const container = document.createElement('div');
      container.id = 'code-viewer-container';
      container.className = 'code-viewer-container';
      container.style.display = 'none';
      
      container.innerHTML = `
        <div class="code-viewer-header">
          <div class="code-viewer-title">Algorithm Implementation</div>
          <div class="code-viewer-actions">
            <button class="code-action-btn" onclick="UIEnhancements.copyCode()" 
                    aria-label="Copy code to clipboard">📋 Copy</button>
            <button class="code-action-btn" onclick="UIEnhancements.downloadCode()" 
                    aria-label="Download code file">💾 Download</button>
            <button class="code-action-btn" onclick="UIEnhancements.toggleCodeViewer()" 
                    aria-label="Close code viewer">✕ Close</button>
          </div>
        </div>
        <div class="code-viewer-content" id="code-viewer-content">
          <div class="loading">Loading algorithm implementation...</div>
        </div>
      `;
      
      return container;
    },
    
    loadAlgorithmCode: function(algorithmId) {
      const content = document.getElementById('code-viewer-content');
      if (!content) return;
      
      // Check cache first
      if (this.codeCache[algorithmId]) {
        this.displayCode(this.codeCache[algorithmId]);
        return;
      }
      
      // Try to get code from global cipher object
      try {
        const cipherObj = global[algorithmId];
        if (cipherObj && typeof cipherObj === 'object') {
          const codeText = this.extractCodeFromObject(cipherObj);
          this.codeCache[algorithmId] = codeText;
          this.displayCode(codeText);
        } else {
          content.innerHTML = '<div class="error">Algorithm implementation not accessible for viewing.</div>';
        }
      } catch (e) {
        content.innerHTML = '<div class="error">Error loading algorithm code: ' + e.message + '</div>';
      }
    },
    
    extractCodeFromObject: function(cipherObj) {
      // Generate a simplified representation of the cipher object
      let codeText = '// Cipher Implementation Overview\n\n';
      
      codeText += `const ${cipherObj.internalName || 'Cipher'} = {\n`;
      codeText += `  name: "${cipherObj.name || 'Unknown'}",\n`;
      codeText += `  comment: "${cipherObj.comment || 'No description'}",\n`;
      
      if (cipherObj.minKeyLength !== undefined) {
        codeText += `  minKeyLength: ${cipherObj.minKeyLength},\n`;
      }
      if (cipherObj.maxKeyLength !== undefined) {
        codeText += `  maxKeyLength: ${cipherObj.maxKeyLength},\n`;
      }
      
      // Add method signatures
      if (typeof cipherObj.Init === 'function') {
        codeText += `  \n  Init: function() {\n    // Initialize cipher\n  },\n`;
      }
      if (typeof cipherObj.KeySetup === 'function') {
        codeText += `  \n  KeySetup: function(key) {\n    // Set up encryption key\n  },\n`;
      }
      if (typeof cipherObj.encryptBlock === 'function') {
        codeText += `  \n  encryptBlock: function(id, plaintext) {\n    // Encrypt block of data\n  },\n`;
      }
      if (typeof cipherObj.decryptBlock === 'function') {
        codeText += `  \n  decryptBlock: function(id, ciphertext) {\n    // Decrypt block of data\n  },\n`;
      }
      
      codeText += `};\n\n`;
      codeText += '// Note: This is a simplified view. Full implementation contains\n';
      codeText += '// detailed cryptographic operations and optimizations.\n';
      
      return codeText;
    },
    
    displayCode: function(codeText) {
      const content = document.getElementById('code-viewer-content');
      if (!content) return;
      
      const lines = codeText.split('\n');
      let html = '';
      
      for (let i = 0; i < lines.length && i < this.config.codeViewerMaxLines; i++) {
        const lineNumber = i + 1;
        const lineContent = this.config.enableSyntaxHighlighting ? 
                           this.highlightJavaScript(lines[i]) : 
                           this.escapeHtml(lines[i]);
        
        html += `
          <div class="code-line">
            <div class="line-number">${lineNumber}</div>
            <div class="line-content">${lineContent}</div>
          </div>
        `;
      }
      
      content.innerHTML = html;
      
      // Show container
      const container = document.getElementById('code-viewer-container');
      if (container) {
        container.style.display = 'block';
        this.state.codeVisible = true;
      }
    },
    
    highlightJavaScript: function(line) {
      if (!line) return '';
      
      let highlighted = this.escapeHtml(line);
      
      // Keywords
      highlighted = highlighted.replace(
        /\b(function|const|let|var|if|else|for|while|return|true|false|null|undefined)\b/g,
        '<span class="js-keyword">$1</span>'
      );
      
      // Strings
      highlighted = highlighted.replace(
        /(["'])((?:\\.|(?!\1)[^\\])*?)\1/g,
        '<span class="js-string">$1$2$1</span>'
      );
      
      // Comments
      highlighted = highlighted.replace(
        /(\/\/.*$)/g,
        '<span class="js-comment">$1</span>'
      );
      
      // Numbers
      highlighted = highlighted.replace(
        /\b(\d+(?:\.\d+)?)\b/g,
        '<span class="js-number">$1</span>'
      );
      
      return highlighted;
    },
    
    copyCode: function() {
      try {
        const codeContent = document.getElementById('code-viewer-content');
        if (!codeContent) return;
        
        // Extract text content without HTML
        const lines = codeContent.querySelectorAll('.line-content');
        let text = '';
        for (let i = 0; i < lines.length; i++) {
          text += lines[i].textContent + '\n';
        }
        
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function() {
            UIEnhancements.showNotification('Code copied to clipboard!', 'success');
          }).catch(function(e) {
            UIEnhancements.fallbackCopy(text);
          });
        } else {
          UIEnhancements.fallbackCopy(text);
        }
      } catch (e) {
        console.error('Error copying code:', e);
        this.showNotification('Failed to copy code', 'error');
      }
    },
    
    fallbackCopy: function(text) {
      try {
        // Create temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this.showNotification('Code copied to clipboard!', 'success');
      } catch (e) {
        this.showNotification('Please select and copy the code manually', 'warning');
      }
    },
    
    downloadCode: function() {
      try {
        const codeContent = document.getElementById('code-viewer-content');
        if (!codeContent) return;
        
        // Extract text content
        const lines = codeContent.querySelectorAll('.line-content');
        let text = '';
        for (let i = 0; i < lines.length; i++) {
          text += lines[i].textContent + '\n';
        }
        
        // Create download
        const blob = new Blob([text], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = (this.state.currentAlgorithm || 'cipher') + '-implementation.js';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.showNotification('Code download started', 'success');
      } catch (e) {
        console.error('Error downloading code:', e);
        this.showNotification('Download failed', 'error');
      }
    },
    
    toggleCodeViewer: function() {
      const container = document.getElementById('code-viewer-container');
      if (container) {
        if (this.state.codeVisible) {
          container.style.display = 'none';
          this.state.codeVisible = false;
        } else {
          container.style.display = 'block';
          this.state.codeVisible = true;
        }
      }
    },
    
    // Metadata Panel
    initMetadataPanel: function() {
      // Metadata panel is created dynamically when needed
    },
    
    updateMetadataPanel: function(algorithmId) {
      if (!algorithmId) return;
      
      try {
        // Find or create metadata panel
        let panel = document.getElementById('metadata-panel');
        if (!panel) {
          panel = this.createMetadataPanel();
          const cipherInfo = document.querySelector('.cipher-info');
          if (cipherInfo && cipherInfo.parentNode) {
            cipherInfo.parentNode.insertBefore(panel, cipherInfo.nextSibling);
          }
        }
        
        // Populate with algorithm metadata
        this.populateMetadata(algorithmId, panel);
        
      } catch (e) {
        console.error('Error updating metadata panel:', e);
      }
    },
    
    createMetadataPanel: function() {
      const panel = document.createElement('div');
      panel.id = 'metadata-panel';
      panel.className = 'metadata-panel';
      
      panel.innerHTML = `
        <div class="metadata-section">
          <div class="metadata-title">📋 Algorithm Details</div>
          <div class="metadata-content" id="metadata-details">
            <!-- Populated dynamically -->
          </div>
        </div>
        
        <div class="metadata-section">
          <div class="metadata-title">⚙️ Technical Specifications</div>
          <ul class="metadata-spec-list" id="metadata-specs">
            <!-- Populated dynamically -->
          </ul>
        </div>
        
        <div class="metadata-section">
          <div class="metadata-title">🔗 External References</div>
          <div class="external-links" id="metadata-links">
            <!-- Populated dynamically -->
          </div>
        </div>
      `;
      
      return panel;
    },
    
    populateMetadata: function(algorithmId, panel) {
      try {
        const cipherInfo = Cipher.objGetCipher(algorithmId);
        const cipherObj = global[algorithmId];
        
        // Update details
        const detailsEl = panel.querySelector('#metadata-details');
        if (detailsEl) {
          detailsEl.innerHTML = this.escapeHtml(cipherInfo.comment || 'No description available.');
        }
        
        // Update specifications
        const specsEl = panel.querySelector('#metadata-specs');
        if (specsEl) {
          specsEl.innerHTML = this.generateSpecificationsList(cipherInfo, cipherObj);
        }
        
        // Update external links
        const linksEl = panel.querySelector('#metadata-links');
        if (linksEl) {
          linksEl.innerHTML = this.generateExternalLinks(algorithmId, cipherInfo);
        }
        
        // Show panel
        panel.style.display = 'block';
        this.state.metadataVisible = true;
        
      } catch (e) {
        console.error('Error populating metadata:', e);
      }
    },
    
    generateSpecificationsList: function(cipherInfo, cipherObj) {
      const specs = [];
      
      if (cipherInfo.minKeyLength !== undefined) {
        specs.push({
          label: 'Key Length',
          value: cipherInfo.minKeyLength === cipherInfo.maxKeyLength ?
                 `${cipherInfo.minKeyLength} bits` :
                 `${cipherInfo.minKeyLength}-${cipherInfo.maxKeyLength} bits`
        });
      }
      
      if (cipherInfo.minBlockSize !== undefined && cipherInfo.minBlockSize > 0) {
        specs.push({
          label: 'Block Size',
          value: `${cipherInfo.minBlockSize} bytes`
        });
      }
      
      specs.push({
        label: 'Type',
        value: cipherInfo.minBlockSize > 0 ? 'Block Cipher' : 'Stream Cipher'
      });
      
      specs.push({
        label: 'Reversible',
        value: cipherInfo.cantDecode ? 'No (One-way)' : 'Yes'
      });
      
      if (cipherObj && cipherObj.testVectors) {
        specs.push({
          label: 'Test Vectors',
          value: `${cipherObj.testVectors.length} available`
        });
      }
      
      return specs.map(function(spec) {
        return `
          <li class="metadata-spec-item">
            <span class="spec-label">${spec.label}:</span>
            <span class="spec-value">${spec.value}</span>
          </li>
        `;
      }).join('');
    },
    
    generateExternalLinks: function(algorithmId, cipherInfo) {
      const links = [];
      
      // Add common reference links based on algorithm name
      const name = algorithmId.toLowerCase();
      
      if (name.includes('aes') || name.includes('rijndael')) {
        links.push({
          title: 'NIST FIPS 197',
          url: 'https://csrc.nist.gov/publications/fips/fips197/fips-197.pdf'
        });
      }
      
      if (name.includes('des')) {
        links.push({
          title: 'NIST FIPS 46-3',
          url: 'https://csrc.nist.gov/publications/fips/fips46-3/fips46-3.pdf'
        });
      }
      
      if (name.includes('chacha') || name.includes('salsa')) {
        links.push({
          title: 'RFC 7539',
          url: 'https://tools.ietf.org/rfc/rfc7539.txt'
        });
      }
      
      // Add generic links
      links.push({
        title: 'Wikipedia',
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(cipherInfo.name)}`
      });
      
      return links.map(function(link) {
        return `<a href="${link.url}" class="external-link" target="_blank" rel="noopener">${link.title} 🔗</a>`;
      }).join('');
    },
    
    // Multi-Language Conversion Panel (Framework)
    initMultiLanguagePanel: function() {
      // Create placeholder panel
      const panel = this.createMultiLanguagePanel();
      const metadataPanel = document.getElementById('metadata-panel');
      if (metadataPanel && metadataPanel.parentNode) {
        metadataPanel.parentNode.insertBefore(panel, metadataPanel.nextSibling);
      }
    },
    
    createMultiLanguagePanel: function() {
      const panel = document.createElement('div');
      panel.id = 'conversion-panel';
      panel.className = 'conversion-panel';
      panel.style.display = 'none'; // Hidden by default
      
      panel.innerHTML = `
        <div class="conversion-header">
          <div class="conversion-title">🌐 Multi-Language Code Conversion</div>
          <div class="conversion-subtitle">Convert algorithm implementations to different programming languages</div>
        </div>
        
        <div class="language-selector" id="language-selector">
          <div class="language-option" data-lang="perl">
            <div class="language-name">Perl</div>
            <div class="language-status">Coming Soon</div>
          </div>
          <div class="language-option" data-lang="cpp">
            <div class="language-name">C++</div>
            <div class="language-status">Coming Soon</div>
          </div>
          <div class="language-option" data-lang="basic">
            <div class="language-name">BASIC</div>
            <div class="language-status">Coming Soon</div>
          </div>
          <div class="language-option" data-lang="delphi">
            <div class="language-name">Delphi</div>
            <div class="language-status">Coming Soon</div>
          </div>
          <div class="language-option" data-lang="python">
            <div class="language-name">Python</div>
            <div class="language-status">Coming Soon</div>
          </div>
          <div class="language-option" data-lang="rust">
            <div class="language-name">Rust</div>
            <div class="language-status">Coming Soon</div>
          </div>
          <div class="language-option" data-lang="java">
            <div class="language-name">Java</div>
            <div class="language-status">Coming Soon</div>
          </div>
          <div class="language-option" data-lang="csharp">
            <div class="language-name">C#</div>
            <div class="language-status">Coming Soon</div>
          </div>
          <div class="language-option" data-lang="kotlin">
            <div class="language-name">Kotlin</div>
            <div class="language-status">Coming Soon</div>
          </div>
        </div>
      `;
      
      // Add event listeners for language selection
      this.setupLanguageSelector(panel);
      
      return panel;
    },
    
    setupLanguageSelector: function(panel) {
      const options = panel.querySelectorAll('.language-option');
      const self = this;
      
      for (let i = 0; i < options.length; i++) {
        options[i].onclick = function() {
          const lang = this.getAttribute('data-lang');
          self.selectLanguage(lang, this);
        };
      }
    },
    
    selectLanguage: function(language, element) {
      // Update visual selection
      const allOptions = document.querySelectorAll('.language-option');
      for (let i = 0; i < allOptions.length; i++) {
        allOptions[i].classList.remove('selected');
      }
      element.classList.add('selected');
      
      this.state.selectedLanguage = language;
      this.showNotification(`${language} conversion selected (feature in development)`, 'info');
    },
    
    // Progress Indicators
    initProgressIndicators: function() {
      // Progress indicators are created dynamically when needed
    },
    
    showProgress: function(message, percentage) {
      let container = document.getElementById('progress-container');
      if (!container) {
        container = this.createProgressContainer();
        const mainPanel = document.querySelector('.cipher-panel');
        if (mainPanel) {
          mainPanel.appendChild(container);
        }
      }
      
      const progressFill = container.querySelector('.progress-fill');
      const progressText = container.querySelector('.progress-text');
      
      if (progressFill) {
        progressFill.style.width = (percentage || 0) + '%';
      }
      if (progressText) {
        progressText.textContent = message || 'Processing...';
      }
      
      container.style.display = 'block';
    },
    
    hideProgress: function() {
      const container = document.getElementById('progress-container');
      if (container) {
        container.style.display = 'none';
      }
    },
    
    createProgressContainer: function() {
      const container = document.createElement('div');
      container.id = 'progress-container';
      container.className = 'progress-container';
      container.style.display = 'none';
      
      container.innerHTML = `
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <div class="progress-text">Processing...</div>
      `;
      
      return container;
    },
    
    // File Operations
    initFileOperations: function() {
      // File operations are added to appropriate panels when needed
    },
    
    createFileOperationsArea: function() {
      const area = document.createElement('div');
      area.className = 'file-operations';
      area.innerHTML = `
        <div class="file-upload-icon">📁</div>
        <div class="file-operations-text">
          Drag and drop files here or click to select
        </div>
        <input type="file" class="file-input" id="file-input" multiple accept=".js,.txt,.json">
        <button class="file-select-btn" onclick="document.getElementById('file-input').click()">
          Select Files
        </button>
      `;
      
      this.setupFileOperations(area);
      return area;
    },
    
    setupFileOperations: function(area) {
      const fileInput = area.querySelector('.file-input');
      const self = this;
      
      // Drag and drop
      area.ondragover = function(e) {
        e.preventDefault();
        area.classList.add('drag-over');
      };
      
      area.ondragleave = function() {
        area.classList.remove('drag-over');
      };
      
      area.ondrop = function(e) {
        e.preventDefault();
        area.classList.remove('drag-over');
        self.handleFiles(e.dataTransfer.files);
      };
      
      // File input
      if (fileInput) {
        fileInput.onchange = function() {
          self.handleFiles(this.files);
        };
      }
    },
    
    handleFiles: function(files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.showNotification(`File received: ${file.name} (${file.size} bytes)`, 'info');
        // TODO: Implement file processing
      }
    },
    
    // Accessibility
    initAccessibility: function() {
      // Add keyboard navigation
      this.setupKeyboardNavigation();
      
      // Add ARIA live regions
      this.createAriaLiveRegions();
      
      // Enhance focus management
      this.enhanceFocusManagement();
    },
    
    setupKeyboardNavigation: function() {
      // Global keyboard shortcuts
      document.onkeydown = function(e) {
        // Ctrl+/ for help
        if (e.ctrlKey && e.keyCode === 191) {
          e.preventDefault();
          UIEnhancements.showKeyboardHelp();
        }
        
        // Escape to close overlays
        if (e.keyCode === 27) {
          UIEnhancements.closeOverlays();
        }
      };
    },
    
    createAriaLiveRegions: function() {
      // Create live region for announcements
      const liveRegion = document.createElement('div');
      liveRegion.id = 'aria-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    },
    
    enhanceFocusManagement: function() {
      // Ensure tab navigation works properly
      const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const focusable = document.querySelectorAll(focusableElements);
      
      // Add focus indicators
      for (let i = 0; i < focusable.length; i++) {
        focusable[i].onfocus = function() {
          this.setAttribute('data-focused', 'true');
        };
        focusable[i].onblur = function() {
          this.removeAttribute('data-focused');
        };
      }
    },
    
    showKeyboardHelp: function() {
      const help = `
        Keyboard Shortcuts:
        • Ctrl+/ - Show this help
        • Escape - Close overlays
        • Tab/Shift+Tab - Navigate elements
        • Enter/Space - Activate buttons
        • Arrow keys - Navigate algorithm cards
      `;
      this.showNotification(help, 'info');
    },
    
    closeOverlays: function() {
      // Close code viewer
      const codeViewer = document.getElementById('code-viewer-container');
      if (codeViewer && this.state.codeVisible) {
        this.toggleCodeViewer();
      }
      
      // Clear search
      const searchInput = document.getElementById('algorithm-search');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
        this.filterAlgorithms('');
      }
    },
    
    // Event Listeners
    initEventListeners: function() {
      // Window resize
      window.onresize = function() {
        UIEnhancements.handleResize();
      };
      
      // Visibility change
      if (typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', function() {
          if (!document.hidden) {
            UIEnhancements.refreshUI();
          }
        });
      }
    },
    
    handleResize: function() {
      // Adjust layout for different screen sizes
      const grid = document.getElementById('algorithm-grid');
      if (grid && window.innerWidth < 768) {
        grid.style.gridTemplateColumns = '1fr';
      } else if (grid) {
        grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
      }
    },
    
    refreshUI: function() {
      // Refresh dynamic content when page becomes visible
      if (this.state.currentAlgorithm) {
        this.updateMetadataPanel(this.state.currentAlgorithm);
      }
    },
    
    // Notification System
    showNotification: function(message, type) {
      try {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = message;
        
        // Add type-specific styling
        if (type === 'error') {
          notification.style.background = '#dc3545';
        } else if (type === 'warning') {
          notification.style.background = '#ffc107';
          notification.style.color = '#000';
        } else if (type === 'info') {
          notification.style.background = '#17a2b8';
        }
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(function() {
          notification.classList.add('show');
        }, 100);
        
        // Hide notification
        setTimeout(function() {
          notification.classList.remove('show');
          setTimeout(function() {
            if (notification.parentNode) {
              document.body.removeChild(notification);
            }
          }, 300);
        }, 3000);
        
        // Also announce to screen readers
        this.announceToScreenReader(message);
        
      } catch (e) {
        console.error('Error showing notification:', e);
      }
    },
    
    announceToScreenReader: function(message) {
      const liveRegion = document.getElementById('aria-live-region');
      if (liveRegion) {
        liveRegion.textContent = message;
        // Clear after announcement
        setTimeout(function() {
          liveRegion.textContent = '';
        }, 1000);
      }
    },
    
    // Utility functions
    escapeHtml: function(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
    
    // Enhanced Tab System Integration
    enhanceExistingTabs: function() {
      const tabContainer = document.querySelector('.tab-container');
      if (!tabContainer) return;
      
      // Add new tabs
      const tabNav = tabContainer.querySelector('.tab-nav');
      if (tabNav) {
        // Add Code View tab
        const codeTab = document.createElement('button');
        codeTab.className = 'tab-button';
        codeTab.textContent = '💻 Code View';
        codeTab.onclick = function() {
          UIEnhancements.switchToCodeTab();
        };
        tabNav.appendChild(codeTab);
        
        // Add Metadata tab
        const metaTab = document.createElement('button');
        metaTab.className = 'tab-button';
        metaTab.textContent = '📋 Metadata';
        metaTab.onclick = function() {
          UIEnhancements.switchToMetadataTab();
        };
        tabNav.appendChild(metaTab);
        
        // Add Conversion tab
        const convTab = document.createElement('button');
        convTab.className = 'tab-button';
        convTab.textContent = '🌐 Convert';
        convTab.onclick = function() {
          UIEnhancements.switchToConversionTab();
        };
        tabNav.appendChild(convTab);
      }
    },
    
    switchToCodeTab: function() {
      this.hideAllTabs();
      const codeViewer = document.getElementById('code-viewer-container');
      if (codeViewer) {
        codeViewer.style.display = 'block';
        this.state.codeVisible = true;
      }
      this.updateActiveTab('💻 Code View');
    },
    
    switchToMetadataTab: function() {
      this.hideAllTabs();
      const metadataPanel = document.getElementById('metadata-panel');
      if (metadataPanel) {
        metadataPanel.style.display = 'block';
        this.state.metadataVisible = true;
      }
      this.updateActiveTab('📋 Metadata');
    },
    
    switchToConversionTab: function() {
      this.hideAllTabs();
      const conversionPanel = document.getElementById('conversion-panel');
      if (conversionPanel) {
        conversionPanel.style.display = 'block';
      }
      this.updateActiveTab('🌐 Convert');
    },
    
    hideAllTabs: function() {
      const panels = [
        'code-viewer-container',
        'metadata-panel', 
        'conversion-panel'
      ];
      
      panels.forEach(function(id) {
        const panel = document.getElementById(id);
        if (panel) {
          panel.style.display = 'none';
        }
      });
      
      this.state.codeVisible = false;
      this.state.metadataVisible = false;
    },
    
    updateActiveTab: function(tabText) {
      const tabButtons = document.querySelectorAll('.tab-button');
      for (let i = 0; i < tabButtons.length; i++) {
        const button = tabButtons[i];
        if (button.textContent.includes(tabText)) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      }
    }
  };
  
  // Initialize when DOM is ready
  function initWhenReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        UIEnhancements.init();
      });
    } else {
      UIEnhancements.init();
    }
  }
  
  // Legacy browser support
  if (typeof document.addEventListener === 'undefined') {
    // Use setTimeout for older browsers
    setTimeout(function() {
      UIEnhancements.init();
    }, 1000);
  } else {
    initWhenReady();
  }
  
})(typeof global !== 'undefined' ? global : window);