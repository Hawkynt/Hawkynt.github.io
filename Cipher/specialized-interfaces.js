#!/usr/bin/env node
/*
 * Specialized Interfaces for Different Algorithm Types
 * Provides tailored UI for ciphers, hashes, encodings, and compression
 * Supports comprehensive data formats: string, hex, binary, file
 * (c)2024-2025 SynthelicZ Cipher Tools
 */

(function(global) {
  'use strict';

  const SpecializedInterfaces = {
    
    // Current interface type
    currentInterface: 'cipher',
    
    // Interface definitions
    interfaces: {
      cipher: {
        name: 'Cipher Interface',
        icon: '🔐',
        description: 'Symmetric and asymmetric encryption/decryption',
        fields: ['plaintext', 'ciphertext', 'key', 'iv', 'counter', 'mode', 'padding']
      },
      hash: {
        name: 'Hash Interface', 
        icon: '🔗',
        description: 'Cryptographic hash functions and checksums',
        fields: ['input', 'hash', 'salt', 'rounds', 'outputLength']
      },
      encoding: {
        name: 'Encoding Interface',
        icon: '📝',
        description: 'Character encoding and data representation',
        fields: ['input', 'encoded', 'charset', 'format', 'options']
      },
      compression: {
        name: 'Compression Interface',
        icon: '📦',
        description: 'Lossless data compression algorithms',
        fields: ['input', 'compressed', 'level', 'dictionary', 'windowSize']
      },
      mac: {
        name: 'MAC Interface',
        icon: '🛡️',
        description: 'Message Authentication Codes',
        fields: ['message', 'mac', 'key', 'salt', 'tagLength']
      },
      kdf: {
        name: 'KDF Interface',
        icon: '🔑',
        description: 'Key Derivation Functions',
        fields: ['password', 'salt', 'derivedKey', 'iterations', 'keyLength', 'pepper']
      }
    },

    // Data format types
    dataFormats: ['string', 'hex', 'binary', 'base64', 'file'],
    
    // Initialize the specialized interface system
    init: function() {
      this.createInterfaceSelector();
      this.createDataFormatSystem();
      this.setupEventHandlers();
      this.loadInterface('cipher'); // Default
    },

    // Create interface type selector
    createInterfaceSelector: function() {
      const container = this.getInterfaceContainer();
      
      const selectorHtml = `
        <div class="interface-selector">
          <h2>🎛️ Algorithm Interface</h2>
          <div class="interface-tabs">
            ${Object.entries(this.interfaces).map(([key, iface]) => `
              <button class="interface-tab ${key === 'cipher' ? 'active' : ''}" 
                      data-interface="${key}"
                      onclick="SpecializedInterfaces.switchInterface('${key}')">
                ${iface.icon} ${iface.name}
              </button>
            `).join('')}
          </div>
          <div class="interface-description" id="interface-description">
            ${this.interfaces.cipher.description}
          </div>
        </div>
      `;
      
      container.innerHTML = selectorHtml + container.innerHTML;
    },

    // Create comprehensive data format system
    createDataFormatSystem: function() {
      const container = this.getInterfaceContainer();
      
      const formatSystemHtml = `
        <div class="data-format-system" id="data-format-system">
          <div class="format-controls">
            <div class="format-selector">
              <label>Input Format:</label>
              <select id="input-format" onchange="SpecializedInterfaces.onInputFormatChange(this.value)">
                <option value="string">📝 String/Text</option>
                <option value="hex">🔢 Hexadecimal</option>
                <option value="binary">💾 Binary</option>
                <option value="base64">📋 Base64</option>
                <option value="file">📁 File Upload</option>
              </select>
            </div>
            
            <div class="format-selector">
              <label>Output Format:</label>
              <select id="output-format" onchange="SpecializedInterfaces.onOutputFormatChange(this.value)">
                <option value="string">📝 String/Text</option>
                <option value="hex">🔢 Hexadecimal</option>
                <option value="binary">💾 Binary</option>
                <option value="base64">📋 Base64</option>
              </select>
            </div>
            
            <div class="format-actions">
              <button onclick="SpecializedInterfaces.convertFormats()" class="btn-convert">
                🔄 Convert Formats
              </button>
              <button onclick="SpecializedInterfaces.clearAllFields()" class="btn-clear">
                🗑️ Clear All
              </button>
            </div>
          </div>
          
          <div class="data-fields" id="data-fields">
            <!-- Dynamic fields will be inserted here -->
          </div>
        </div>
      `;
      
      container.innerHTML += formatSystemHtml;
    },

    getInterfaceContainer: function() {
      let container = document.getElementById('specialized-interface-container');
      
      if (!container) {
        container = document.createElement('div');
        container.id = 'specialized-interface-container';
        container.className = 'specialized-interface-container';
        
        // Insert into main interface area
        const mainArea = document.getElementById('main-interface') || 
                        document.querySelector('main') ||
                        document.body;
        mainArea.appendChild(container);
      }
      
      return container;
    },

    // Switch between interface types
    switchInterface: function(interfaceType) {
      if (!this.interfaces[interfaceType]) return;
      
      this.currentInterface = interfaceType;
      this.updateInterfaceDescription(interfaceType);
      this.updateActiveTab(interfaceType);
      this.rebuildDataFields(interfaceType);
      this.updateAlgorithmFilter(interfaceType);
    },

    updateInterfaceDescription: function(interfaceType) {
      const description = document.getElementById('interface-description');
      if (description) {
        description.textContent = this.interfaces[interfaceType].description;
      }
    },

    updateActiveTab: function(interfaceType) {
      const tabs = document.querySelectorAll('.interface-tab');
      tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-interface') === interfaceType) {
          tab.classList.add('active');
        }
      });
    },

    // Rebuild data fields based on interface type
    rebuildDataFields: function(interfaceType) {
      const fieldsContainer = document.getElementById('data-fields');
      if (!fieldsContainer) return;
      
      const iface = this.interfaces[interfaceType];
      const fieldsHtml = this.generateFieldsHTML(iface.fields, interfaceType);
      
      fieldsContainer.innerHTML = fieldsHtml;
      this.setupFieldEventHandlers();
    },

    generateFieldsHTML: function(fields, interfaceType) {
      return fields.map(field => {
        const fieldConfig = this.getFieldConfig(field, interfaceType);
        return this.createFieldHTML(field, fieldConfig);
      }).join('');
    },

    getFieldConfig: function(field, interfaceType) {
      const configs = {
        // Cipher interface
        plaintext: { label: 'Plaintext', icon: '📝', type: 'textarea', placeholder: 'Enter text to encrypt...' },
        ciphertext: { label: 'Ciphertext', icon: '🔐', type: 'textarea', placeholder: 'Encrypted data appears here...' },
        key: { label: 'Encryption Key', icon: '🔑', type: 'input', placeholder: 'Enter encryption key...' },
        iv: { label: 'Initialization Vector', icon: '🎲', type: 'input', placeholder: 'IV (auto-generated if empty)...' },
        counter: { label: 'Counter/Nonce', icon: '🔢', type: 'input', placeholder: 'Counter value...' },
        mode: { label: 'Cipher Mode', icon: '⚙️', type: 'select', options: ['ECB', 'CBC', 'CFB', 'OFB', 'CTR', 'GCM'] },
        padding: { label: 'Padding Scheme', icon: '📦', type: 'select', options: ['None', 'PKCS#7', 'ISO 7816-4', 'ANSI X9.23', 'Zero'] },
        
        // Hash interface  
        input: { label: 'Input Data', icon: '📄', type: 'textarea', placeholder: 'Enter data to hash...' },
        hash: { label: 'Hash Output', icon: '🔗', type: 'textarea', placeholder: 'Hash value appears here...' },
        salt: { label: 'Salt', icon: '🧂', type: 'input', placeholder: 'Optional salt value...' },
        rounds: { label: 'Rounds/Iterations', icon: '🔄', type: 'number', placeholder: '1000' },
        outputLength: { label: 'Output Length', icon: '📏', type: 'number', placeholder: '32' },
        
        // Encoding interface
        encoded: { label: 'Encoded Output', icon: '📝', type: 'textarea', placeholder: 'Encoded data appears here...' },
        charset: { label: 'Character Set', icon: '🔤', type: 'select', options: ['UTF-8', 'ASCII', 'Latin-1', 'UTF-16'] },
        format: { label: 'Encoding Format', icon: '📋', type: 'select', options: ['Base64', 'Hex', 'URL', 'HTML'] },
        options: { label: 'Options', icon: '⚙️', type: 'input', placeholder: 'Additional options...' },
        
        // Compression interface
        compressed: { label: 'Compressed Output', icon: '📦', type: 'textarea', placeholder: 'Compressed data appears here...' },
        level: { label: 'Compression Level', icon: '📊', type: 'range', min: 1, max: 9, value: 5 },
        dictionary: { label: 'Dictionary', icon: '📚', type: 'textarea', placeholder: 'Optional compression dictionary...' },
        windowSize: { label: 'Window Size', icon: '🪟', type: 'number', placeholder: '32768' },
        
        // MAC interface
        message: { label: 'Message', icon: '💬', type: 'textarea', placeholder: 'Enter message to authenticate...' },
        mac: { label: 'MAC Output', icon: '🛡️', type: 'textarea', placeholder: 'MAC value appears here...' },
        tagLength: { label: 'Tag Length', icon: '🏷️', type: 'number', placeholder: '16' },
        
        // KDF interface
        password: { label: 'Password', icon: '🔒', type: 'input', placeholder: 'Enter password...' },
        derivedKey: { label: 'Derived Key', icon: '🔑', type: 'textarea', placeholder: 'Derived key appears here...' },
        iterations: { label: 'Iterations', icon: '🔄', type: 'number', placeholder: '100000' },
        keyLength: { label: 'Key Length', icon: '📏', type: 'number', placeholder: '32' },
        pepper: { label: 'Pepper', icon: '🌶️', type: 'input', placeholder: 'Optional pepper value...' }
      };
      
      return configs[field] || { label: field, icon: '❓', type: 'input', placeholder: `Enter ${field}...` };
    },

    createFieldHTML: function(fieldName, config) {
      const fieldId = `field-${fieldName}`;
      let inputHTML = '';
      
      switch (config.type) {
        case 'textarea':
          inputHTML = `
            <textarea id="${fieldId}" placeholder="${config.placeholder}" 
                      onchange="SpecializedInterfaces.onFieldChange('${fieldName}', this.value)"></textarea>
          `;
          break;
          
        case 'select':
          inputHTML = `
            <select id="${fieldId}" onchange="SpecializedInterfaces.onFieldChange('${fieldName}', this.value)">
              ${config.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
            </select>
          `;
          break;
          
        case 'number':
          inputHTML = `
            <input type="number" id="${fieldId}" placeholder="${config.placeholder}" 
                   onchange="SpecializedInterfaces.onFieldChange('${fieldName}', this.value)" />
          `;
          break;
          
        case 'range':
          inputHTML = `
            <input type="range" id="${fieldId}" min="${config.min || 0}" max="${config.max || 100}" 
                   value="${config.value || 50}" onchange="SpecializedInterfaces.onFieldChange('${fieldName}', this.value)" />
            <span class="range-value" id="${fieldId}-value">${config.value || 50}</span>
          `;
          break;
          
        default: // input
          inputHTML = `
            <input type="text" id="${fieldId}" placeholder="${config.placeholder}" 
                   onchange="SpecializedInterfaces.onFieldChange('${fieldName}', this.value)" />
          `;
      }
      
      return `
        <div class="data-field" data-field="${fieldName}">
          <label for="${fieldId}">
            ${config.icon} ${config.label}:
          </label>
          <div class="field-input-container">
            ${inputHTML}
            <div class="field-format-controls">
              <button onclick="SpecializedInterfaces.convertFieldFormat('${fieldName}', 'hex')" 
                      class="btn-format" title="Convert to Hex">HEX</button>
              <button onclick="SpecializedInterfaces.convertFieldFormat('${fieldName}', 'base64')" 
                      class="btn-format" title="Convert to Base64">B64</button>
              <button onclick="SpecializedInterfaces.showFieldAsFile('${fieldName}')" 
                      class="btn-format" title="Save as File">💾</button>
            </div>
          </div>
        </div>
      `;
    },

    // Update algorithm filter based on interface
    updateAlgorithmFilter: function(interfaceType) {
      const algorithmSelect = document.getElementById('cipherList');
      if (!algorithmSelect || typeof Cipher === 'undefined') return;
      
      const allCiphers = Cipher.ciphers || [];
      const filteredCiphers = allCiphers.filter(cipher => {
        const category = (cipher.metadata && cipher.metadata.category) || 'special';
        return this.getCategoryForInterface(interfaceType).includes(category);
      });
      
      // Update algorithm dropdown
      algorithmSelect.innerHTML = '';
      filteredCiphers.forEach(cipher => {
        const option = document.createElement('option');
        option.value = cipher.internalName || cipher.internalName;
        option.textContent = cipher.name || cipher.name;
        algorithmSelect.appendChild(option);
      });
    },

    getCategoryForInterface: function(interfaceType) {
      const categoryMap = {
        cipher: ['block', 'stream', 'asymmetric', 'classical'],
        hash: ['hash'],
        encoding: ['encoding'],
        compression: ['compression'],
        mac: ['mac'],
        kdf: ['kdf', 'special']
      };
      
      return categoryMap[interfaceType] || ['special'];
    },

    // ===== EVENT HANDLERS =====
    
    onInputFormatChange: function(format) {
      this.currentInputFormat = format;
      this.updateFormatHandlers();
      
      if (format === 'file') {
        this.showFileUploadInterface();
      } else {
        this.hideFileUploadInterface();
      }
    },

    onOutputFormatChange: function(format) {
      this.currentOutputFormat = format;
      this.updateFormatHandlers();
    },

    onFieldChange: function(fieldName, value) {
      // Store field values for processing
      if (!this.fieldValues) this.fieldValues = {};
      this.fieldValues[fieldName] = value;
      
      // Update range display
      const rangeValue = document.getElementById(`field-${fieldName}-value`);
      if (rangeValue) {
        rangeValue.textContent = value;
      }
      
      // Trigger auto-conversion if enabled
      if (this.autoConvert) {
        this.performOperation();
      }
    },

    // ===== DATA FORMAT CONVERSION =====
    
    convertFormats: function() {
      const inputFormat = document.getElementById('input-format').value;
      const outputFormat = document.getElementById('output-format').value;
      
      // Get all field values and convert
      const fields = document.querySelectorAll('.data-field input, .data-field textarea');
      fields.forEach(field => {
        if (field.value) {
          const convertedValue = this.convertData(field.value, inputFormat, outputFormat);
          if (convertedValue !== field.value) {
            field.value = convertedValue;
            field.style.backgroundColor = '#2563EB20'; // Highlight changed fields
            setTimeout(() => field.style.backgroundColor = '', 1000);
          }
        }
      });
    },

    convertFieldFormat: function(fieldName, targetFormat) {
      const field = document.getElementById(`field-${fieldName}`);
      if (!field || !field.value) return;
      
      const currentFormat = this.detectFormat(field.value);
      const convertedValue = this.convertData(field.value, currentFormat, targetFormat);
      field.value = convertedValue;
      
      // Show format change notification
      this.showFormatNotification(fieldName, currentFormat, targetFormat);
    },

    convertData: function(data, fromFormat, toFormat) {
      if (fromFormat === toFormat) return data;
      
      try {
        // First convert to bytes (internal format)
        let bytes;
        switch (fromFormat) {
          case 'string':
            bytes = this.stringToBytes(data);
            break;
          case 'hex':
            bytes = this.hexToBytes(data);
            break;
          case 'binary':
            bytes = this.binaryToBytes(data);
            break;
          case 'base64':
            bytes = this.base64ToBytes(data);
            break;
          default:
            bytes = this.stringToBytes(data);
        }
        
        // Then convert from bytes to target format
        switch (toFormat) {
          case 'string':
            return this.bytesToString(bytes);
          case 'hex':
            return this.bytesToHex(bytes);
          case 'binary':
            return this.bytesToBinary(bytes);
          case 'base64':
            return this.bytesToBase64(bytes);
          default:
            return this.bytesToString(bytes);
        }
      } catch (error) {
        console.error('Format conversion error:', error);
        return data; // Return original on error
      }
    },

    detectFormat: function(data) {
      if (!data) return 'string';
      
      // Check for hex pattern
      if (/^[0-9A-Fa-f\s]+$/.test(data) && data.length % 2 === 0) {
        return 'hex';
      }
      
      // Check for binary pattern
      if (/^[01\s]+$/.test(data)) {
        return 'binary';
      }
      
      // Check for base64 pattern
      if (/^[A-Za-z0-9+/]+=*$/.test(data)) {
        return 'base64';
      }
      
      return 'string';
    },

    // ===== FILE HANDLING =====
    
    showFileUploadInterface: function() {
      const container = document.getElementById('data-fields');
      if (!container) return;
      
      const fileUploadHtml = `
        <div class="file-upload-zone" id="file-upload-zone">
          <div class="upload-area" 
               ondrop="SpecializedInterfaces.handleFileDrop(event)" 
               ondragover="event.preventDefault()"
               ondragenter="event.preventDefault()">
            <div class="upload-icon">📁</div>
            <div class="upload-text">
              <p>Drop files here or <button onclick="document.getElementById('file-input').click()">browse</button></p>
              <small>Supports: Text, Binary, Images, Documents (max 50MB)</small>
            </div>
            <input type="file" id="file-input" style="display: none" 
                   onchange="SpecializedInterfaces.handleFileSelect(event)" multiple />
          </div>
          <div class="uploaded-files" id="uploaded-files"></div>
        </div>
      `;
      
      container.insertAdjacentHTML('afterbegin', fileUploadHtml);
    },

    hideFileUploadInterface: function() {
      const uploadZone = document.getElementById('file-upload-zone');
      if (uploadZone) {
        uploadZone.remove();
      }
    },

    handleFileDrop: function(event) {
      event.preventDefault();
      const files = event.dataTransfer.files;
      this.processFiles(files);
    },

    handleFileSelect: function(event) {
      const files = event.target.files;
      this.processFiles(files);
    },

    processFiles: function(files) {
      const maxSize = 50 * 1024 * 1024; // 50MB
      
      Array.from(files).forEach(file => {
        if (file.size > maxSize) {
          alert(`File ${file.name} is too large (max 50MB)`);
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          this.addUploadedFile(file.name, e.target.result, file.type);
        };
        
        // Read as appropriate type
        if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
          reader.readAsText(file);
        } else {
          reader.readAsArrayBuffer(file);
        }
      });
    },

    addUploadedFile: function(filename, content, type) {
      const container = document.getElementById('uploaded-files');
      if (!container) return;
      
      const fileElement = document.createElement('div');
      fileElement.className = 'uploaded-file';
      fileElement.innerHTML = `
        <div class="file-info">
          <span class="file-name">📄 ${filename}</span>
          <span class="file-type">${type || 'unknown'}</span>
        </div>
        <div class="file-actions">
          <button onclick="SpecializedInterfaces.useFileContent('${filename}')">Use Content</button>
          <button onclick="this.parentElement.parentElement.remove()">Remove</button>
        </div>
      `;
      
      container.appendChild(fileElement);
      
      // Store file content
      if (!this.uploadedFiles) this.uploadedFiles = {};
      this.uploadedFiles[filename] = content;
    },

    useFileContent: function(filename) {
      const content = this.uploadedFiles[filename];
      if (!content) return;
      
      // Put content into primary input field
      const primaryField = this.getPrimaryInputField();
      if (primaryField) {
        if (typeof content === 'string') {
          primaryField.value = content;
        } else {
          // Convert ArrayBuffer to hex
          const bytes = new Uint8Array(content);
          primaryField.value = this.bytesToHex(Array.from(bytes));
        }
        
        this.onFieldChange(primaryField.id.replace('field-', ''), primaryField.value);
      }
    },

    getPrimaryInputField: function() {
      const fieldOrder = ['plaintext', 'input', 'message', 'password'];
      
      for (const fieldName of fieldOrder) {
        const field = document.getElementById(`field-${fieldName}`);
        if (field) return field;
      }
      
      // Fallback to first textarea or input
      return document.querySelector('.data-field textarea, .data-field input[type="text"]');
    },

    // ===== UTILITY FUNCTIONS =====
    
    stringToBytes: function(str) {
      return Array.from(str, char => char.charCodeAt(0));
    },

    bytesToString: function(bytes) {
      return String.fromCharCode(...bytes);
    },

    hexToBytes: function(hex) {
      const cleanHex = hex.replace(/\s/g, '');
      const bytes = [];
      for (let i = 0; i < cleanHex.length; i += 2) {
        bytes.push(parseInt(cleanHex.substr(i, 2), 16));
      }
      return bytes;
    },

    bytesToHex: function(bytes) {
      return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    binaryToBytes: function(binary) {
      const cleanBinary = binary.replace(/\s/g, '');
      const bytes = [];
      for (let i = 0; i < cleanBinary.length; i += 8) {
        const byte = cleanBinary.substr(i, 8);
        bytes.push(parseInt(byte, 2));
      }
      return bytes;
    },

    bytesToBinary: function(bytes) {
      return bytes.map(b => b.toString(2).padStart(8, '0')).join('');
    },

    base64ToBytes: function(base64) {
      const binaryString = atob(base64);
      return Array.from(binaryString, char => char.charCodeAt(0));
    },

    bytesToBase64: function(bytes) {
      const binaryString = String.fromCharCode(...bytes);
      return btoa(binaryString);
    },

    clearAllFields: function() {
      const fields = document.querySelectorAll('.data-field input, .data-field textarea');
      fields.forEach(field => {
        field.value = '';
        field.style.backgroundColor = '';
      });
      
      this.fieldValues = {};
    },

    showFieldAsFile: function(fieldName) {
      const field = document.getElementById(`field-${fieldName}`);
      if (!field || !field.value) return;
      
      const data = field.value;
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fieldName}-data.txt`;
      a.click();
      
      URL.revokeObjectURL(url);
    },

    showFormatNotification: function(fieldName, fromFormat, toFormat) {
      // Create temporary notification
      const notification = document.createElement('div');
      notification.className = 'format-notification';
      notification.textContent = `${fieldName}: ${fromFormat} → ${toFormat}`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #3B82F6;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
      `;
      
      document.body.appendChild(notification);
      
      // Animate in
      setTimeout(() => notification.style.opacity = '1', 10);
      
      // Remove after delay
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }, 2000);
    },

    setupEventHandlers: function() {
      // Global event handlers for the specialized interface system
      console.log('Specialized interfaces initialized');
    },

    setupFieldEventHandlers: function() {
      // Set up field-specific event handlers after field creation
      const rangeInputs = document.querySelectorAll('input[type="range"]');
      rangeInputs.forEach(input => {
        input.addEventListener('input', (e) => {
          const valueSpan = document.getElementById(e.target.id + '-value');
          if (valueSpan) {
            valueSpan.textContent = e.target.value;
          }
        });
      });
    },

    performOperation: function() {
      // Perform the cryptographic operation based on current interface and values
      // This would integrate with the existing cipher system
      console.log('Performing operation for interface:', this.currentInterface);
      console.log('Field values:', this.fieldValues);
    }
  };

  // Export to global scope
  global.SpecializedInterfaces = SpecializedInterfaces;

  // Auto-initialize when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        SpecializedInterfaces.init();
      });
    } else {
      SpecializedInterfaces.init();
    }
  }

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpecializedInterfaces;
  }

})(typeof global !== 'undefined' ? global : window);