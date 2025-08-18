#!/usr/bin/env node
/*
 * Algorithm Chaining System
 * Advanced pipeline system for multi-step cryptographic operations
 * Supports: Upload → Compress → Cipher → Cipher → Download workflows
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load dependencies
  if (!global.Cipher && typeof require !== 'undefined') {
    require('./universal-cipher-env.js');
    require('./cipher.js');
  }
  
  const AlgorithmChain = {
    
    // Chain configuration
    currentChain: [],
    maxChainLength: 10,
    supportedOperations: ['compression', 'encryption', 'hash', 'encoding', 'mac'],
    
    // File handling
    inputFile: null,
    outputFile: null,
    
    /**
     * Initialize the chaining system
     */
    init: function() {
      this.createChainUI();
      this.setupEventHandlers();
      console.log('Algorithm Chaining System initialized');
    },
    
    /**
     * Create the chain builder UI
     */
    createChainUI: function() {
      const container = document.getElementById('chain-container') || document.createElement('div');
      container.id = 'chain-container';
      
      container.innerHTML = `
        <div class="chain-builder">
          <h3>Algorithm Chain Builder</h3>
          <div class="chain-steps">
            <div class="step file-input">
              <div class="step-header">1. Input File</div>
              <input type="file" id="chain-file-input" accept="*/*">
              <div class="file-info"></div>
            </div>
            
            <div class="step chain-operations">
              <div class="step-header">2. Processing Steps</div>
              <div class="operations-list" id="chain-operations"></div>
              <button class="add-operation">+ Add Operation</button>
            </div>
            
            <div class="step file-output">
              <div class="step-header">3. Output</div>
              <button class="execute-chain" disabled>Execute Chain</button>
              <button class="download-result" disabled>Download Result</button>
            </div>
          </div>
          
          <div class="chain-visualization">
            <canvas id="chain-canvas" width="800" height="200"></canvas>
          </div>
        </div>
        
        <div class="operation-selector" style="display: none;">
          <h4>Select Operation</h4>
          <div class="operation-categories">
            <div class="category compression">
              <h5>Compression</h5>
              <div class="algorithms"></div>
            </div>
            <div class="category encryption">
              <h5>Encryption</h5>
              <div class="algorithms"></div>
            </div>
            <div class="category hash">
              <h5>Hash Functions</h5>
              <div class="algorithms"></div>
            </div>
            <div class="category encoding">
              <h5>Encoding</h5>
              <div class="algorithms"></div>
            </div>
            <div class="category mac">
              <h5>MAC</h5>
              <div class="algorithms"></div>
            </div>
          </div>
        </div>
        
        <style>
        .chain-builder {
          background: linear-gradient(135deg, #2D1B69 0%, #1A0D3C 100%);
          border-radius: 10px;
          padding: 20px;
          margin: 20px 0;
          color: white;
        }
        
        .chain-steps {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .step {
          flex: 1;
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 15px;
          min-height: 120px;
        }
        
        .step-header {
          font-weight: bold;
          margin-bottom: 10px;
          color: #FFD700;
        }
        
        .operations-list {
          min-height: 60px;
          border: 2px dashed rgba(255,255,255,0.3);
          border-radius: 4px;
          padding: 10px;
          margin-bottom: 10px;
        }
        
        .operation-item {
          background: rgba(255,255,255,0.2);
          border-radius: 4px;
          padding: 8px;
          margin: 5px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .operation-selector {
          background: rgba(255,255,255,0.95);
          border-radius: 8px;
          padding: 20px;
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1000;
          max-width: 600px;
          max-height: 500px;
          overflow-y: auto;
          color: #333;
        }
        
        .operation-categories {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }
        
        .category {
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 10px;
        }
        
        .algorithm-option {
          padding: 5px 10px;
          margin: 2px 0;
          background: #f0f0f0;
          border-radius: 3px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .algorithm-option:hover {
          background: #e0e0e0;
        }
        
        button {
          background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
        }
        
        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        
        button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        #chain-canvas {
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          width: 100%;
          height: 200px;
        }
        </style>
      `;
      
      // Add to page if not already there
      if (!document.getElementById('chain-container')) {
        const mainContent = document.querySelector('#content') || document.body;
        mainContent.appendChild(container);
      }
      
      this.populateAlgorithmOptions();
    },
    
    /**
     * Populate algorithm selection options
     */
    populateAlgorithmOptions: function() {
      if (!global.Cipher || !global.Cipher.ciphers) return;
      
      const categories = {
        compression: [],
        encryption: [],
        hash: [],
        encoding: [],
        mac: []
      };
      
      // Categorize available algorithms
      Object.keys(global.Cipher.ciphers).forEach(name => {
        const cipher = global.Cipher.ciphers[name];
        const internalName = cipher.internalName || name;
        
        // Determine category based on algorithm properties
        if (internalName.includes('compress') || internalName.includes('huff') || 
            internalName.includes('lz') || internalName.includes('rle')) {
          categories.compression.push({name, cipher});
        } else if (internalName.includes('hash') || internalName.includes('md') || 
                   internalName.includes('sha') || internalName.includes('blake')) {
          categories.hash.push({name, cipher});
        } else if (internalName.includes('base') || internalName.includes('encode') ||
                   internalName.includes('morse') || internalName.includes('rot')) {
          categories.encoding.push({name, cipher});
        } else if (internalName.includes('hmac') || internalName.includes('cmac') ||
                   internalName.includes('poly1305')) {
          categories.mac.push({name, cipher});
        } else {
          categories.encryption.push({name, cipher});
        }
      });
      
      // Populate UI
      Object.keys(categories).forEach(category => {
        const container = document.querySelector(`.category.${category} .algorithms`);
        if (container) {
          container.innerHTML = categories[category].map(item => `
            <div class="algorithm-option" data-algorithm="${item.name}" data-category="${category}">
              ${item.cipher.name || item.name}
            </div>
          `).join('');
        }
      });
    },
    
    /**
     * Set up event handlers
     */
    setupEventHandlers: function() {
      // File input handler
      const fileInput = document.getElementById('chain-file-input');
      if (fileInput) {
        fileInput.addEventListener('change', (e) => {
          this.handleFileInput(e.target.files[0]);
        });
      }
      
      // Add operation button
      const addOpBtn = document.querySelector('.add-operation');
      if (addOpBtn) {
        addOpBtn.addEventListener('click', () => {
          this.showOperationSelector();
        });
      }
      
      // Execute chain button
      const executeBtn = document.querySelector('.execute-chain');
      if (executeBtn) {
        executeBtn.addEventListener('click', () => {
          this.executeChain();
        });
      }
      
      // Download result button
      const downloadBtn = document.querySelector('.download-result');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          this.downloadResult();
        });
      }
      
      // Algorithm selection handlers
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('algorithm-option')) {
          this.addOperationToChain(
            e.target.dataset.algorithm,
            e.target.dataset.category
          );
          this.hideOperationSelector();
        }
        
        if (e.target.classList.contains('remove-operation')) {
          const index = parseInt(e.target.dataset.index);
          this.removeOperationFromChain(index);
        }
      });
      
      // Close operation selector when clicking outside
      document.addEventListener('click', (e) => {
        const selector = document.querySelector('.operation-selector');
        if (selector && selector.style.display !== 'none' && 
            !selector.contains(e.target) && 
            !e.target.classList.contains('add-operation')) {
          this.hideOperationSelector();
        }
      });
    },
    
    /**
     * Handle file input
     */
    handleFileInput: function(file) {
      if (!file) return;
      
      this.inputFile = file;
      
      const fileInfo = document.querySelector('.file-info');
      if (fileInfo) {
        fileInfo.innerHTML = `
          <strong>${file.name}</strong><br>
          Size: ${this.formatFileSize(file.size)}<br>
          Type: ${file.type || 'Unknown'}
        `;
      }
      
      this.updateExecuteButton();
    },
    
    /**
     * Show operation selector
     */
    showOperationSelector: function() {
      const selector = document.querySelector('.operation-selector');
      if (selector) {
        selector.style.display = 'block';
      }
    },
    
    /**
     * Hide operation selector
     */
    hideOperationSelector: function() {
      const selector = document.querySelector('.operation-selector');
      if (selector) {
        selector.style.display = 'none';
      }
    },
    
    /**
     * Add operation to chain
     */
    addOperationToChain: function(algorithmName, category) {
      if (this.currentChain.length >= this.maxChainLength) {
        alert(`Maximum chain length is ${this.maxChainLength} operations`);
        return;
      }
      
      const operation = {
        algorithm: algorithmName,
        category: category,
        id: Date.now()
      };
      
      this.currentChain.push(operation);
      this.updateChainDisplay();
      this.updateExecuteButton();
      this.drawChainVisualization();
    },
    
    /**
     * Remove operation from chain
     */
    removeOperationFromChain: function(index) {
      this.currentChain.splice(index, 1);
      this.updateChainDisplay();
      this.updateExecuteButton();
      this.drawChainVisualization();
    },
    
    /**
     * Update chain display
     */
    updateChainDisplay: function() {
      const container = document.getElementById('chain-operations');
      if (!container) return;
      
      if (this.currentChain.length === 0) {
        container.innerHTML = '<div class="empty-chain">No operations added yet</div>';
        return;
      }
      
      container.innerHTML = this.currentChain.map((op, index) => `
        <div class="operation-item">
          <span>${index + 1}. ${op.algorithm} (${op.category})</span>
          <button class="remove-operation" data-index="${index}">×</button>
        </div>
      `).join('');
    },
    
    /**
     * Update execute button state
     */
    updateExecuteButton: function() {
      const executeBtn = document.querySelector('.execute-chain');
      if (executeBtn) {
        executeBtn.disabled = !this.inputFile || this.currentChain.length === 0;
      }
    },
    
    /**
     * Execute the algorithm chain
     */
    executeChain: async function() {
      if (!this.inputFile || this.currentChain.length === 0) return;
      
      try {
        let data = await this.readFileAsArrayBuffer(this.inputFile);
        let currentData = new Uint8Array(data);
        
        // Process through each operation in the chain
        for (let i = 0; i < this.currentChain.length; i++) {
          const operation = this.currentChain[i];
          console.log(`Executing step ${i + 1}: ${operation.algorithm}`);
          
          currentData = await this.processWithAlgorithm(currentData, operation);
          
          // Update progress visualization
          this.updateProgress(i + 1, this.currentChain.length);
        }
        
        this.outputFile = currentData;
        this.enableDownload();
        
      } catch (error) {
        console.error('Chain execution failed:', error);
        alert('Chain execution failed: ' + error.message);
      }
    },
    
    /**
     * Process data with a specific algorithm
     */
    processWithAlgorithm: function(data, operation) {
      return new Promise((resolve, reject) => {
        try {
          const cipher = global.Cipher.ciphers[operation.algorithm];
          if (!cipher) {
            throw new Error(`Algorithm not found: ${operation.algorithm}`);
          }
          
          // Initialize cipher if needed
          if (typeof cipher.Init === 'function') {
            cipher.Init();
          }
          
          // Set up key if needed (use default or generate)
          let cipherID = null;
          if (typeof cipher.KeySetup === 'function') {
            const defaultKey = this.generateDefaultKey(cipher);
            cipherID = cipher.KeySetup(defaultKey);
          }
          
          // Process data
          let result;
          if (operation.category === 'hash') {
            // Hash functions
            const dataString = Array.from(data).map(b => String.fromCharCode(b)).join('');
            result = cipher.encryptBlock(cipherID, dataString);
            result = this.hexToBytes(result);
          } else if (operation.category === 'encoding') {
            // Encoding functions
            const dataString = Array.from(data).map(b => String.fromCharCode(b)).join('');
            result = cipher.encryptBlock(cipherID, dataString);
            result = new Uint8Array(result.split('').map(c => c.charCodeAt(0)));
          } else {
            // Encryption/compression
            const blockSize = cipher.minBlockSize || 16;
            const resultArray = [];
            
            for (let i = 0; i < data.length; i += blockSize) {
              const block = Array.from(data.slice(i, i + blockSize));
              const processed = cipher.encryptBlock(cipherID, block);
              resultArray.push(...processed);
            }
            
            result = new Uint8Array(resultArray);
          }
          
          // Clean up
          if (cipherID && typeof cipher.ClearData === 'function') {
            cipher.ClearData(cipherID);
          }
          
          resolve(result);
          
        } catch (error) {
          reject(error);
        }
      });
    },
    
    /**
     * Generate default key for algorithm
     */
    generateDefaultKey: function(cipher) {
      const keyLength = cipher.minKeyLength || 16;
      const key = [];
      for (let i = 0; i < keyLength; i++) {
        key.push(Math.floor(Math.random() * 256));
      }
      return key;
    },
    
    /**
     * Convert hex string to bytes
     */
    hexToBytes: function(hex) {
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }
      return new Uint8Array(bytes);
    },
    
    /**
     * Read file as array buffer
     */
    readFileAsArrayBuffer: function(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    },
    
    /**
     * Update progress visualization
     */
    updateProgress: function(current, total) {
      console.log(`Progress: ${current}/${total} operations completed`);
      // Could add visual progress indicator here
    },
    
    /**
     * Enable download button
     */
    enableDownload: function() {
      const downloadBtn = document.querySelector('.download-result');
      if (downloadBtn) {
        downloadBtn.disabled = false;
      }
    },
    
    /**
     * Download the result
     */
    downloadResult: function() {
      if (!this.outputFile) return;
      
      const blob = new Blob([this.outputFile]);
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `processed_${this.inputFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    
    /**
     * Draw chain visualization
     */
    drawChainVisualization: function() {
      const canvas = document.getElementById('chain-canvas');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (this.currentChain.length === 0) return;
      
      const stepWidth = canvas.width / (this.currentChain.length + 1);
      const y = canvas.height / 2;
      
      // Draw flow
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(stepWidth * 0.5, y);
      ctx.lineTo(canvas.width - stepWidth * 0.5, y);
      ctx.stroke();
      
      // Draw operations
      this.currentChain.forEach((op, index) => {
        const x = stepWidth * (index + 1);
        
        // Draw operation box
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(x - 40, y - 20, 80, 40);
        
        // Draw operation text
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(op.algorithm.substring(0, 8), x, y + 5);
      });
    },
    
    /**
     * Format file size for display
     */
    formatFileSize: function(bytes) {
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 Bytes';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
  };
  
  // Export to global scope
  global.AlgorithmChain = AlgorithmChain;
  
  // Auto-initialize when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        AlgorithmChain.init();
      });
    } else {
      AlgorithmChain.init();
    }
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlgorithmChain;
  }
  
})(typeof global !== 'undefined' ? global : window);