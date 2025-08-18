/*
 * Universal Cipher File Handler
 * Comprehensive file upload, download, and hex editing capabilities
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt - File handling extension for SynthelicZ Cipher Tools
 */

(function(global) {
  'use strict';
  
  // File handler object
  const CipherFileHandler = {
    // Configuration constants
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB maximum file size
    CHUNK_SIZE: 1024 * 1024, // 1MB chunks for progress tracking
    SUPPORTED_FORMATS: ['text', 'binary', 'hex', 'base64', 'json'],
    
    // File type detection patterns
    TEXT_EXTENSIONS: ['.txt', '.log', '.csv', '.xml', '.json', '.js', '.css', '.html', '.md'],
    BINARY_EXTENSIONS: ['.bin', '.exe', '.dll', '.so', '.dylib', '.pdf', '.jpg', '.png', '.gif'],
    
    // Initialize file handler
    init: function() {
      if (typeof window !== 'undefined') {
        this.setupBrowserHandlers();
      }
      console.log('CipherFileHandler initialized');
    },
    
    // Set up browser-specific event handlers
    setupBrowserHandlers: function() {
      // Set up drag and drop
      document.addEventListener('DOMContentLoaded', () => {
        this.initializeDragAndDrop();
        this.setupFileInputs();
        this.setupHexEditor();
      });
    },
    
    // Initialize drag and drop functionality
    initializeDragAndDrop: function() {
      const dropZones = document.querySelectorAll('.file-drop-zone');
      
      dropZones.forEach(zone => {
        zone.addEventListener('dragover', this.handleDragOver.bind(this));
        zone.addEventListener('dragenter', this.handleDragEnter.bind(this));
        zone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        zone.addEventListener('drop', this.handleDrop.bind(this));
      });
      
      // Prevent default drag behaviors on document
      document.addEventListener('dragover', e => e.preventDefault());
      document.addEventListener('drop', e => e.preventDefault());
    },
    
    // Set up file input elements
    setupFileInputs: function() {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      
      fileInputs.forEach(input => {
        input.addEventListener('change', this.handleFileSelect.bind(this));
      });
    },
    
    // Set up hex editor functionality
    setupHexEditor: function() {
      const hexEditors = document.querySelectorAll('.hex-editor');
      
      hexEditors.forEach(editor => {
        this.initializeHexEditor(editor);
      });
    },
    
    // Drag and drop event handlers
    handleDragOver: function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      e.currentTarget.classList.add('drag-over');
    },
    
    handleDragEnter: function(e) {
      e.preventDefault();
      e.currentTarget.classList.add('drag-enter');
    },
    
    handleDragLeave: function(e) {
      e.preventDefault();
      if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drag-over', 'drag-enter');
      }
    },
    
    handleDrop: function(e) {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over', 'drag-enter');
      
      const files = Array.from(e.dataTransfer.files);
      const targetField = e.currentTarget.dataset.target;
      
      if (files.length > 0) {
        this.processFiles(files, targetField);
      }
    },
    
    // Handle file selection from input
    handleFileSelect: function(e) {
      const files = Array.from(e.target.files);
      const targetField = e.target.dataset.target;
      
      if (files.length > 0) {
        this.processFiles(files, targetField);
      }
    },
    
    // Process uploaded files
    processFiles: function(files, targetField) {
      files.forEach(file => {
        this.processFile(file, targetField);
      });
    },
    
    // Process individual file
    processFile: function(file, targetField) {
      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        this.showError(`File "${file.name}" is too large. Maximum size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB.`);
        return;
      }
      
      // Show progress indicator
      const progressId = this.showProgress(file.name);
      
      // Determine file type
      const fileType = this.detectFileType(file);
      
      // Read file based on type
      if (fileType === 'text') {
        this.readTextFile(file, targetField, progressId);
      } else {
        this.readBinaryFile(file, targetField, progressId);
      }
    },
    
    // Detect file type
    detectFileType: function(file) {
      const extension = '.' + file.name.split('.').pop().toLowerCase();
      
      if (this.TEXT_EXTENSIONS.includes(extension)) {
        return 'text';
      } else if (this.BINARY_EXTENSIONS.includes(extension)) {
        return 'binary';
      } else {
        // Try to detect by MIME type
        if (file.type.startsWith('text/')) {
          return 'text';
        } else {
          return 'binary';
        }
      }
    },
    
    // Read text file
    readTextFile: function(file, targetField, progressId) {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target.result;
        this.populateField(targetField, content, 'text');
        this.hideProgress(progressId);
        this.showSuccess(`File "${file.name}" loaded successfully (${file.size} bytes)`);
      };
      
      reader.onerror = () => {
        this.hideProgress(progressId);
        this.showError(`Failed to read file "${file.name}"`);
      };
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          this.updateProgress(progressId, progress);
        }
      };
      
      reader.readAsText(file);
    },
    
    // Read binary file
    readBinaryFile: function(file, targetField, progressId) {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        const binaryString = this.arrayBufferToBinaryString(uint8Array);
        
        this.populateField(targetField, binaryString, 'binary');
        this.hideProgress(progressId);
        this.showSuccess(`Binary file "${file.name}" loaded successfully (${file.size} bytes)`);
      };
      
      reader.onerror = () => {
        this.hideProgress(progressId);
        this.showError(`Failed to read binary file "${file.name}"`);
      };
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          this.updateProgress(progressId, progress);
        }
      };
      
      reader.readAsArrayBuffer(file);
    },
    
    // Convert ArrayBuffer to binary string
    arrayBufferToBinaryString: function(uint8Array) {
      let binaryString = '';
      const chunkSize = 8192; // Process in chunks to avoid call stack limits
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binaryString += String.fromCharCode.apply(null, chunk);
      }
      
      return binaryString;
    },
    
    // Populate form field with data
    populateField: function(targetField, content, dataType) {
      if (typeof window !== 'undefined' && window.refreshFields) {
        window.refreshFields(targetField, 'binary', content);
      } else {
        // Fallback for direct field population
        const form = document.forms['frmCipher'];
        if (form && form.elements[targetField]) {
          form.elements[targetField].value = content;
          
          // Update hex and base64 fields if they exist
          if (form.elements[targetField + 'HEX']) {
            form.elements[targetField + 'HEX'].value = this.stringToHex(content);
          }
          if (form.elements[targetField + 'BASE64']) {
            form.elements[targetField + 'BASE64'].value = this.stringToBase64(content);
          }
        }
      }
    },
    
    // Convert string to hex
    stringToHex: function(str) {
      let hex = '';
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        hex += (code < 16 ? '0' : '') + code.toString(16).toUpperCase() + ' ';
      }
      return hex.trim();
    },
    
    // Convert string to base64
    stringToBase64: function(str) {
      if (typeof btoa !== 'undefined') {
        return btoa(str);
      } else {
        // Fallback base64 encoding
        return this.base64Encode(str);
      }
    },
    
    // Fallback base64 encoding
    base64Encode: function(str) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      let i = 0;
      
      while (i < str.length) {
        const a = str.charCodeAt(i++);
        const b = i < str.length ? str.charCodeAt(i++) : 0;
        const c = i < str.length ? str.charCodeAt(i++) : 0;
        
        const bitmap = (a << 16) | (b << 8) | c;
        
        result += chars.charAt((bitmap >> 18) & 63);
        result += chars.charAt((bitmap >> 12) & 63);
        result += i - 2 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
        result += i - 1 < str.length ? chars.charAt(bitmap & 63) : '=';
      }
      
      return result;
    },
    
    // Download functionality
    downloadData: function(data, filename, format) {
      if (typeof window === 'undefined') {
        console.log('Download not supported in Node.js environment');
        return;
      }
      
      let blob;
      let downloadFilename = filename;
      
      switch (format.toLowerCase()) {
        case 'text':
          blob = new Blob([data], { type: 'text/plain' });
          downloadFilename += '.txt';
          break;
        case 'binary':
          const uint8Array = this.binaryStringToUint8Array(data);
          blob = new Blob([uint8Array], { type: 'application/octet-stream' });
          downloadFilename += '.bin';
          break;
        case 'hex':
          const hexData = this.stringToHex(data);
          blob = new Blob([hexData], { type: 'text/plain' });
          downloadFilename += '.hex';
          break;
        case 'base64':
          const base64Data = this.stringToBase64(data);
          blob = new Blob([base64Data], { type: 'text/plain' });
          downloadFilename += '.b64';
          break;
        case 'json':
          const jsonData = JSON.stringify({
            data: data,
            format: 'cipher-output',
            timestamp: new Date().toISOString(),
            cipher: window.cipher || 'unknown'
          }, null, 2);
          blob = new Blob([jsonData], { type: 'application/json' });
          downloadFilename += '.json';
          break;
        default:
          blob = new Blob([data], { type: 'text/plain' });
          downloadFilename += '.txt';
      }
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showSuccess(`File "${downloadFilename}" downloaded successfully`);
    },
    
    // Convert binary string to Uint8Array
    binaryStringToUint8Array: function(str) {
      const uint8Array = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        uint8Array[i] = str.charCodeAt(i);
      }
      return uint8Array;
    },
    
    // Hex editor functionality
    initializeHexEditor: function(editor) {
      const textarea = editor.querySelector('.hex-input');
      const preview = editor.querySelector('.hex-preview');
      
      if (textarea) {
        textarea.addEventListener('input', (e) => {
          this.updateHexPreview(e.target.value, preview);
        });
        
        textarea.addEventListener('keydown', (e) => {
          this.handleHexInput(e);
        });
      }
    },
    
    // Handle hex input validation
    handleHexInput: function(e) {
      const allowedKeys = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End', 'PageUp', 'PageDown'
      ];
      
      if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
        return; // Allow navigation and control keys
      }
      
      const isHexChar = /^[0-9A-Fa-f\s]$/.test(e.key);
      if (!isHexChar) {
        e.preventDefault();
      }
    },
    
    // Update hex preview
    updateHexPreview: function(hexString, preview) {
      if (!preview) return;
      
      try {
        const cleanHex = hexString.replace(/\s/g, '');
        if (cleanHex.length % 2 !== 0) {
          preview.textContent = 'Invalid hex (odd number of characters)';
          preview.className = 'hex-preview error';
          return;
        }
        
        let text = '';
        for (let i = 0; i < cleanHex.length; i += 2) {
          const byte = parseInt(cleanHex.substr(i, 2), 16);
          if (isNaN(byte)) {
            preview.textContent = 'Invalid hex character';
            preview.className = 'hex-preview error';
            return;
          }
          text += String.fromCharCode(byte);
        }
        
        preview.textContent = text;
        preview.className = 'hex-preview success';
      } catch (e) {
        preview.textContent = 'Error parsing hex';
        preview.className = 'hex-preview error';
      }
    },
    
    // Convert hex to binary string
    hexToBinaryString: function(hexString) {
      const cleanHex = hexString.replace(/\s/g, '');
      let result = '';
      
      for (let i = 0; i < cleanHex.length; i += 2) {
        const byte = parseInt(cleanHex.substr(i, 2), 16);
        result += String.fromCharCode(byte);
      }
      
      return result;
    },
    
    // Progress indicator functions
    showProgress: function(filename) {
      const progressId = 'progress_' + Date.now();
      const progressHtml = `
        <div id="${progressId}" class="file-progress">
          <div class="progress-info">
            <span class="filename">${filename}</span>
            <span class="progress-percent">0%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
        </div>
      `;
      
      let container = document.getElementById('file-progress-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'file-progress-container';
        document.body.appendChild(container);
      }
      
      container.insertAdjacentHTML('beforeend', progressHtml);
      return progressId;
    },
    
    updateProgress: function(progressId, percent) {
      const progressElement = document.getElementById(progressId);
      if (progressElement) {
        const fill = progressElement.querySelector('.progress-fill');
        const percentText = progressElement.querySelector('.progress-percent');
        
        if (fill) fill.style.width = percent + '%';
        if (percentText) percentText.textContent = Math.round(percent) + '%';
      }
    },
    
    hideProgress: function(progressId) {
      const progressElement = document.getElementById(progressId);
      if (progressElement) {
        setTimeout(() => {
          progressElement.remove();
        }, 1000);
      }
    },
    
    // Notification functions
    showSuccess: function(message) {
      this.showNotification(message, 'success');
    },
    
    showError: function(message) {
      this.showNotification(message, 'error');
    },
    
    showNotification: function(message, type) {
      if (typeof console !== 'undefined') {
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
      
      if (typeof window !== 'undefined') {
        const notification = document.createElement('div');
        notification.className = `file-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 3000);
      }
    },
    
    // Utility: Generate filename with timestamp and cipher info
    generateFilename: function(prefix, extension) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const cipher = (typeof window !== 'undefined' && window.cipher) ? window.cipher: 'cipher';
      return `${prefix}_${cipher}_${timestamp}.${extension}`;
    },
    
    // Batch file operations
    downloadBatch: function(operations) {
      operations.forEach((op, index) => {
        setTimeout(() => {
          this.downloadData(op.data, op.filename, op.format);
        }, index * 100); // Stagger downloads to avoid browser limits
      });
    }
  };
  
  // Export to global scope
  global.CipherFileHandler = CipherFileHandler;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CipherFileHandler;
  }
  
  // Auto-initialize in browser environment
  if (typeof window !== 'undefined') {
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        CipherFileHandler.init();
      });
    } else {
      CipherFileHandler.init();
    }
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);