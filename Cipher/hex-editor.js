/*
 * Universal Hex Editor Component
 * Advanced hex editing with binary/text visualization
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt - Hex editor for SynthelicZ Cipher Tools
 */

(function(global) {
  'use strict';
  
  // Hex Editor object
  const HexEditor = {
    // Configuration
    BYTES_PER_ROW: 16,
    MAX_DISPLAY_SIZE: 1024 * 1024, // 1MB max for performance
    
    // Initialize hex editor instances
    instances: {},
    
    // Create new hex editor instance
    create: function(containerId, options = {}) {
      const instance = new HexEditorInstance(containerId, options);
      this.instances[containerId] = instance;
      return instance;
    },
    
    // Get existing instance
    getInstance: function(containerId) {
      return this.instances[containerId];
    },
    
    // Utility functions
    utils: {
      // Convert string to hex with formatting
      stringToHex: function(str, bytesPerRow = 16) {
        let hex = '';
        let ascii = '';
        let result = '';
        
        for (let i = 0; i < str.length; i++) {
          const byte = str.charCodeAt(i);
          const hexByte = (byte < 16 ? '0' : '') + byte.toString(16).toUpperCase();
          
          hex += hexByte + ' ';
          ascii += (byte >= 32 && byte <= 126) ? str.charAt(i) : '.';
          
          if ((i + 1) % bytesPerRow === 0 || i === str.length - 1) {
            // Pad hex section if needed
            const padding = bytesPerRow - ((i % bytesPerRow) + 1);
            hex += '   '.repeat(padding);
            
            // Add address
            const address = (Math.floor(i / bytesPerRow) * bytesPerRow).toString(16).toUpperCase().padStart(8, '0');
            result += `${address}: ${hex} | ${ascii}\n`;
            
            hex = '';
            ascii = '';
          }
        }
        
        return result.trim();
      },
      
      // Convert hex string to binary string
      hexToBinary: function(hexStr) {
        const cleanHex = hexStr.replace(/[^0-9A-Fa-f]/g, '');
        let binary = '';
        
        for (let i = 0; i < cleanHex.length; i += 2) {
          const hexByte = cleanHex.substr(i, 2);
          if (hexByte.length === 2) {
            binary += String.fromCharCode(parseInt(hexByte, 16));
          }
        }
        
        return binary;
      },
      
      // Validate hex string
      isValidHex: function(hexStr) {
        const cleanHex = hexStr.replace(/\s/g, '');
        return /^[0-9A-Fa-f]*$/.test(cleanHex) && cleanHex.length % 2 === 0;
      },
      
      // Format hex string with spaces
      formatHex: function(hexStr) {
        const cleanHex = hexStr.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
        return cleanHex.replace(/(..)/g, '$1 ').trim();
      },
      
      // Convert between different number bases
      convertBase: function(value, fromBase, toBase) {
        return parseInt(value, fromBase).toString(toBase).toUpperCase();
      }
    }
  };
  
  // Hex Editor Instance Class
  function HexEditorInstance(containerId, options = {}) {
    this.containerId = containerId;
    this.container = null;
    this.options = {
      readOnly: options.readOnly || false,
      showAscii: options.showAscii !== false,
      showAddress: options.showAddress !== false,
      bytesPerRow: options.bytesPerRow || 16,
      height: options.height || '400px',
      theme: options.theme || 'dark'
    };
    
    this.data = '';
    this.isDirty = false;
    this.selection = { start: 0, end: 0 };
    
    this.init();
  }
  
  HexEditorInstance.prototype = {
    // Initialize the hex editor
    init: function() {
      if (typeof window === 'undefined') {
        console.log('Hex editor requires browser environment');
        return;
      }
      
      this.container = document.getElementById(this.containerId);
      if (!this.container) {
        console.error('Hex editor container not found:', this.containerId);
        return;
      }
      
      this.createEditor();
      this.bindEvents();
    },
    
    // Create editor DOM structure
    createEditor: function() {
      this.container.innerHTML = `
        <div class="hex-editor ${this.options.theme}" data-readonly="${this.options.readOnly}">
          <div class="hex-toolbar">
            <div class="hex-tools">
              <button class="hex-btn" data-action="load">Load File</button>
              <button class="hex-btn" data-action="save">Save</button>
              <button class="hex-btn" data-action="clear">Clear</button>
              <button class="hex-btn" data-action="copy">Copy Hex</button>
              <button class="hex-btn" data-action="paste">Paste Hex</button>
            </div>
            <div class="hex-info">
              <span class="hex-size">Size: 0 bytes</span>
              <span class="hex-selection">Selection: None</span>
            </div>
          </div>
          
          <div class="hex-input-section">
            <label for="${this.containerId}_hex_input">Hex Input:</label>
            <textarea 
              id="${this.containerId}_hex_input" 
              class="hex-input" 
              placeholder="Enter hex values (e.g., 48 65 6C 6C 6F)"
              ${this.options.readOnly ? 'readonly' : ''}
            ></textarea>
          </div>
          
          <div class="hex-display" style="height: ${this.options.height}">
            <div class="hex-content">
              <div class="hex-address-column"></div>
              <div class="hex-data-column"></div>
              <div class="hex-ascii-column" style="display: ${this.options.showAscii ? 'block' : 'none'}"></div>
            </div>
          </div>
          
          <div class="hex-status">
            <div class="hex-cursor-info">
              Position: <span class="hex-position">0</span> | 
              Byte: <span class="hex-byte-value">--</span> | 
              Char: <span class="hex-char-value">--</span>
            </div>
            <div class="hex-encoding-tools">
              <select class="hex-encoding">
                <option value="utf8">UTF-8</option>
                <option value="ascii">ASCII</option>
                <option value="latin1">Latin-1</option>
              </select>
              <button class="hex-btn-small" data-action="goto">Go to Address</button>
            </div>
          </div>
        </div>
      `;
      
      // Store references to key elements
      this.hexInput = this.container.querySelector('.hex-input');
      this.hexDisplay = this.container.querySelector('.hex-display');
      this.addressColumn = this.container.querySelector('.hex-address-column');
      this.dataColumn = this.container.querySelector('.hex-data-column');
      this.asciiColumn = this.container.querySelector('.hex-ascii-column');
      this.sizeInfo = this.container.querySelector('.hex-size');
      this.selectionInfo = this.container.querySelector('.hex-selection');
      this.positionInfo = this.container.querySelector('.hex-position');
      this.byteValueInfo = this.container.querySelector('.hex-byte-value');
      this.charValueInfo = this.container.querySelector('.hex-char-value');
    },
    
    // Bind event handlers
    bindEvents: function() {
      // Hex input change
      this.hexInput.addEventListener('input', (e) => {
        this.handleHexInput(e.target.value);
      });
      
      // Toolbar buttons
      this.container.addEventListener('click', (e) => {
        if (e.target.classList.contains('hex-btn') || e.target.classList.contains('hex-btn-small')) {
          this.handleToolbarAction(e.target.dataset.action);
        }
      });
      
      // Hex input validation
      this.hexInput.addEventListener('keydown', (e) => {
        this.handleKeyInput(e);
      });
      
      // Selection tracking
      this.hexInput.addEventListener('selectionchange', () => {
        this.updateSelection();
      });
    },
    
    // Handle hex input
    handleHexInput: function(value) {
      try {
        if (HexEditor.utils.isValidHex(value)) {
          this.data = HexEditor.utils.hexToBinary(value);
          this.isDirty = true;
          this.updateDisplay();
        } else {
          this.showError('Invalid hex format');
        }
      } catch (e) {
        this.showError('Error processing hex input: ' + e.message);
      }
    },
    
    // Handle keyboard input in hex field
    handleKeyInput: function(e) {
      const allowedKeys = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End', 'PageUp', 'PageDown'
      ];
      
      if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
        return;
      }
      
      const isHexChar = /^[0-9A-Fa-f\s]$/.test(e.key);
      if (!isHexChar) {
        e.preventDefault();
        this.showError('Only hex characters (0-9, A-F) and spaces allowed');
      }
    },
    
    // Handle toolbar actions
    handleToolbarAction: function(action) {
      switch (action) {
        case 'load':
          this.loadFile();
          break;
        case 'save':
          this.saveFile();
          break;
        case 'clear':
          this.clear();
          break;
        case 'copy':
          this.copyHex();
          break;
        case 'paste':
          this.pasteHex();
          break;
        case 'goto':
          this.gotoAddress();
          break;
      }
    },
    
    // Update hex display
    updateDisplay: function() {
      if (!this.data) {
        this.clearDisplay();
        return;
      }
      
      let addressHtml = '';
      let dataHtml = '';
      let asciiHtml = '';
      
      const bytesPerRow = this.options.bytesPerRow;
      const totalRows = Math.ceil(this.data.length / bytesPerRow);
      
      for (let row = 0; row < totalRows; row++) {
        const address = (row * bytesPerRow).toString(16).toUpperCase().padStart(8, '0');
        addressHtml += `<div class="hex-address">${address}</div>`;
        
        let rowDataHtml = '';
        let rowAsciiHtml = '';
        
        for (let col = 0; col < bytesPerRow; col++) {
          const index = row * bytesPerRow + col;
          
          if (index < this.data.length) {
            const byte = this.data.charCodeAt(index);
            const hexByte = (byte < 16 ? '0' : '') + byte.toString(16).toUpperCase();
            const asciiChar = (byte >= 32 && byte <= 126) ? this.data.charAt(index) : '.';
            
            rowDataHtml += `<span class="hex-byte" data-index="${index}">${hexByte}</span>`;
            rowAsciiHtml += `<span class="hex-ascii-char" data-index="${index}">${asciiChar}</span>`;
          } else {
            rowDataHtml += '<span class="hex-byte-empty">  </span>';
            rowAsciiHtml += '<span class="hex-ascii-empty"> </span>';
          }
        }
        
        dataHtml += `<div class="hex-data-row">${rowDataHtml}</div>`;
        asciiHtml += `<div class="hex-ascii-row">${rowAsciiHtml}</div>`;
      }
      
      this.addressColumn.innerHTML = addressHtml;
      this.dataColumn.innerHTML = dataHtml;
      this.asciiColumn.innerHTML = asciiHtml;
      
      // Update info
      this.sizeInfo.textContent = `Size: ${this.data.length} bytes`;
    },
    
    // Clear display
    clearDisplay: function() {
      this.addressColumn.innerHTML = '';
      this.dataColumn.innerHTML = '';
      this.asciiColumn.innerHTML = '';
      this.sizeInfo.textContent = 'Size: 0 bytes';
    },
    
    // Load file
    loadFile: function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*';
      
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          this.loadFileData(file);
        }
      };
      
      input.click();
    },
    
    // Load file data
    loadFileData: function(file) {
      if (file.size > HexEditor.MAX_DISPLAY_SIZE) {
        this.showError(`File too large. Maximum size is ${HexEditor.MAX_DISPLAY_SIZE / 1024 / 1024}MB`);
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        this.data = String.fromCharCode.apply(null, uint8Array);
        this.hexInput.value = HexEditor.utils.formatHex(this.getHexString());
        this.updateDisplay();
        this.showSuccess(`Loaded file: ${file.name} (${file.size} bytes)`);
      };
      
      reader.onerror = () => {
        this.showError('Failed to read file');
      };
      
      reader.readAsArrayBuffer(file);
    },
    
    // Save file
    saveFile: function() {
      if (!this.data) {
        this.showError('No data to save');
        return;
      }
      
      const blob = new Blob([this.data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hex_data.bin';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showSuccess('File saved successfully');
    },
    
    // Clear data
    clear: function() {
      this.data = '';
      this.hexInput.value = '';
      this.updateDisplay();
      this.isDirty = false;
    },
    
    // Copy hex to clipboard
    copyHex: function() {
      const hexString = this.getHexString();
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(hexString).then(() => {
          this.showSuccess('Hex copied to clipboard');
        }).catch(() => {
          this.fallbackCopy(hexString);
        });
      } else {
        this.fallbackCopy(hexString);
      }
    },
    
    // Fallback copy method
    fallbackCopy: function(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      
      try {
        document.execCommand('copy');
        this.showSuccess('Hex copied to clipboard');
      } catch (e) {
        this.showError('Failed to copy to clipboard');
      }
      
      document.body.removeChild(textarea);
    },
    
    // Paste hex from clipboard
    pasteHex: function() {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then((text) => {
          this.hexInput.value = text;
          this.handleHexInput(text);
        }).catch(() => {
          this.showError('Failed to read from clipboard');
        });
      } else {
        this.showError('Clipboard access not supported');
      }
    },
    
    // Go to specific address
    gotoAddress: function() {
      const address = prompt('Enter hex address (e.g., 100, 0x100):');
      if (address) {
        const addr = parseInt(address.replace('0x', ''), 16);
        if (addr >= 0 && addr < this.data.length) {
          this.scrollToAddress(addr);
        } else {
          this.showError('Address out of range');
        }
      }
    },
    
    // Scroll to address
    scrollToAddress: function(address) {
      const row = Math.floor(address / this.options.bytesPerRow);
      const rowHeight = 20; // Approximate row height
      this.hexDisplay.scrollTop = row * rowHeight;
    },
    
    // Get hex string representation
    getHexString: function() {
      let hex = '';
      for (let i = 0; i < this.data.length; i++) {
        const byte = this.data.charCodeAt(i);
        hex += (byte < 16 ? '0' : '') + byte.toString(16).toUpperCase();
      }
      return hex;
    },
    
    // Update selection info
    updateSelection: function() {
      const start = this.hexInput.selectionStart;
      const end = this.hexInput.selectionEnd;
      
      if (start !== end) {
        this.selectionInfo.textContent = `Selection: ${start}-${end} (${end - start} chars)`;
      } else {
        this.selectionInfo.textContent = 'Selection: None';
      }
    },
    
    // Show success message
    showSuccess: function(message) {
      console.log('[SUCCESS]', message);
      this.showNotification(message, 'success');
    },
    
    // Show error message
    showError: function(message) {
      console.error('[ERROR]', message);
      this.showNotification(message, 'error');
    },
    
    // Show notification
    showNotification: function(message, type) {
      // Create notification element
      const notification = document.createElement('div');
      notification.className = `hex-notification ${type}`;
      notification.textContent = message;
      
      // Add to container
      this.container.appendChild(notification);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
    },
    
    // Public API methods
    setData: function(data) {
      this.data = data;
      this.hexInput.value = HexEditor.utils.formatHex(this.getHexString());
      this.updateDisplay();
    },
    
    getData: function() {
      return this.data;
    },
    
    getHex: function() {
      return HexEditor.utils.formatHex(this.getHexString());
    },
    
    setHex: function(hexString) {
      this.hexInput.value = hexString;
      this.handleHexInput(hexString);
    }
  };
  
  // Export to global scope
  global.HexEditor = HexEditor;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HexEditor;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);