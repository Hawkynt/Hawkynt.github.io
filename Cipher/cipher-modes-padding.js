#!/usr/bin/env node
/*
 * Cipher Modes and Padding System
 * Provides comprehensive cipher mode selection and padding schemes for block ciphers
 * Default: ECB mode with no padding
 * (c)2024-2025 SynthelicZ Cipher Tools
 */

(function(global) {
  'use strict';

  // Load OpCodes if available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('./OpCodes.js');
    } catch (e) {
      console.warn('OpCodes not available:', e.message);
    }
  }

  const CipherModes = {
    
    // ===== CIPHER MODES =====
    modes: {
      ECB: 'Electronic Codebook',
      CBC: 'Cipher Block Chaining', 
      CFB: 'Cipher Feedback',
      OFB: 'Output Feedback',
      CTR: 'Counter',
      GCM: 'Galois/Counter Mode'
    },

    // ===== PADDING SCHEMES =====
    paddingSchemes: {
      NONE: 'No Padding',
      PKCS7: 'PKCS#7 Padding',
      ISO7816: 'ISO/IEC 7816-4',
      ANSI923: 'ANSI X9.23',
      ZERO: 'Zero Padding'
    },

    // ===== DEFAULT SETTINGS =====
    defaultMode: 'ECB',
    defaultPadding: 'NONE',

    // Initialize cipher modes system
    init: function() {
      this.createModeSelectionUI();
      this.setupEventHandlers();
      this.setDefaults();
    },

    // Create mode and padding selection UI
    createModeSelectionUI: function() {
      const container = this.getModeContainer();
      
      container.innerHTML = `
        <div class="cipher-modes-panel">
          <h3>🔧 Cipher Configuration</h3>
          
          <div class="mode-controls">
            <div class="control-group">
              <label for="cipher-mode">Mode of Operation:</label>
              <select id="cipher-mode" onchange="CipherModes.onModeChange(this.value)">
                ${this.renderModeOptions()}
              </select>
              <div class="mode-description" id="mode-description">
                Select a cipher mode to see description
              </div>
            </div>
            
            <div class="control-group">
              <label for="padding-scheme">Padding Scheme:</label>
              <select id="padding-scheme" onchange="CipherModes.onPaddingChange(this.value)">
                ${this.renderPaddingOptions()}
              </select>
              <div class="padding-description" id="padding-description">
                Select a padding scheme to see description
              </div>
            </div>
            
            <div class="control-group iv-group" id="iv-group" style="display: none;">
              <label for="cipher-iv">Initialization Vector (IV):</label>
              <div class="iv-controls">
                <input type="text" id="cipher-iv" placeholder="Enter IV in hex (optional)" />
                <button type="button" onclick="CipherModes.generateIV()" class="btn-generate-iv">
                  🎲 Generate
                </button>
              </div>
              <div class="iv-info" id="iv-info"></div>
            </div>
            
            <div class="control-group counter-group" id="counter-group" style="display: none;">
              <label for="cipher-counter">Counter/Nonce:</label>
              <div class="counter-controls">
                <input type="text" id="cipher-counter" placeholder="Enter counter in hex (optional)" />
                <button type="button" onclick="CipherModes.generateCounter()" class="btn-generate-counter">
                  🎲 Generate
                </button>
              </div>
            </div>
          </div>
          
          <div class="mode-warnings" id="mode-warnings"></div>
        </div>
      `;
    },

    getModeContainer: function() {
      let container = document.getElementById('cipher-modes-container');
      
      if (!container) {
        container = document.createElement('div');
        container.id = 'cipher-modes-container';
        container.className = 'cipher-modes-container';
        
        // Insert after cipher selection or before data input
        const cipherSelect = document.getElementById('cipherList') || 
                           document.querySelector('.cipher-selection') ||
                           document.querySelector('select[name="cipher"]');
        
        if (cipherSelect && cipherSelect.parentNode) {
          cipherSelect.parentNode.insertBefore(container, cipherSelect.nextSibling);
        } else {
          // Fallback: add to main interface
          const mainInterface = document.getElementById('main-interface') || 
                               document.querySelector('main') ||
                               document.body;
          mainInterface.appendChild(container);
        }
      }
      
      return container;
    },

    renderModeOptions: function() {
      return Object.entries(this.modes).map(([key, name]) => 
        `<option value="${key}" ${key === this.defaultMode ? 'selected' : ''}>${name} (${key})</option>`
      ).join('');
    },

    renderPaddingOptions: function() {
      return Object.entries(this.paddingSchemes).map(([key, name]) => 
        `<option value="${key}" ${key === this.defaultPadding ? 'selected' : ''}>${name}</option>`
      ).join('');
    },

    setDefaults: function() {
      this.currentMode = this.defaultMode;
      this.currentPadding = this.defaultPadding;
      this.updateModeDescription(this.defaultMode);
      this.updatePaddingDescription(this.defaultPadding);
    },

    // ===== EVENT HANDLERS =====
    
    onModeChange: function(mode) {
      this.currentMode = mode;
      this.updateModeDescription(mode);
      this.updateIVControls(mode);
      this.updateWarnings(mode);
      this.notifyModeChange(mode);
    },

    onPaddingChange: function(padding) {
      this.currentPadding = padding;
      this.updatePaddingDescription(padding);
      this.validatePaddingCompatibility();
      this.notifyPaddingChange(padding);
    },

    // ===== MODE DESCRIPTIONS =====
    
    updateModeDescription: function(mode) {
      const descriptions = {
        ECB: '⚠️ Each block encrypted independently. Simple but reveals patterns. Default mode.',
        CBC: '🔗 Each block depends on previous. Requires IV. Sequential encryption.',
        CFB: '🌊 Converts block cipher to stream cipher. Self-synchronizing.',
        OFB: '🔄 Output feedback mode. Converts to stream cipher. Not self-synchronizing.',
        CTR: '🔢 Counter mode. Parallel encryption/decryption. Requires unique counter.',
        GCM: '🔒 Authenticated encryption. Provides both confidentiality and integrity.'
      };
      
      const description = descriptions[mode] || 'Unknown mode';
      const element = document.getElementById('mode-description');
      if (element) {
        element.textContent = description;
        element.className = `mode-description mode-${mode.toLowerCase()}`;
      }
    },

    updatePaddingDescription: function(padding) {
      const descriptions = {
        NONE: '⚠️ No padding applied. Input must be exact multiple of block size.',
        PKCS7: '📦 Standard padding. Bytes added equal to number of padding bytes.',
        ISO7816: '📄 Bit padding with 0x80 followed by zero bytes.',
        ANSI923: '🔢 Zero padding with final byte indicating padding length.',
        ZERO: '0️⃣ Simple zero byte padding. May be ambiguous.'
      };
      
      const description = descriptions[padding] || 'Unknown padding';
      const element = document.getElementById('padding-description');
      if (element) {
        element.textContent = description;
        element.className = `padding-description padding-${padding.toLowerCase()}`;
      }
    },

    // ===== IV/COUNTER MANAGEMENT =====
    
    updateIVControls: function(mode) {
      const ivGroup = document.getElementById('iv-group');
      const counterGroup = document.getElementById('counter-group');
      
      if (!ivGroup || !counterGroup) return;
      
      // Hide all initially
      ivGroup.style.display = 'none';
      counterGroup.style.display = 'none';
      
      // Show appropriate controls based on mode
      if (['CBC', 'CFB', 'OFB'].includes(mode)) {
        ivGroup.style.display = 'block';
        this.updateIVInfo(mode);
      } else if (['CTR', 'GCM'].includes(mode)) {
        counterGroup.style.display = 'block';
      }
    },

    updateIVInfo: function(mode) {
      const info = {
        CBC: 'IV must be random and unique for each message. Same IV reveals patterns.',
        CFB: 'IV should be unique but can be predictable. Affects first block only.',
        OFB: 'IV must be unique but can be predictable. Never reuse with same key.',
        GCM: 'Nonce must be unique for each encryption. Reuse is catastrophic.'
      };
      
      const element = document.getElementById('iv-info');
      if (element) {
        element.textContent = info[mode] || '';
      }
    },

    generateIV: function() {
      const blockSize = this.getCurrentBlockSize();
      const iv = this.generateRandomBytes(blockSize);
      const ivInput = document.getElementById('cipher-iv');
      
      if (ivInput) {
        ivInput.value = this.bytesToHex(iv);
      }
    },

    generateCounter: function() {
      const blockSize = this.getCurrentBlockSize();
      const counter = this.generateRandomBytes(blockSize);
      const counterInput = document.getElementById('cipher-counter');
      
      if (counterInput) {
        counterInput.value = this.bytesToHex(counter);
      }
    },

    // ===== WARNINGS AND VALIDATION =====
    
    updateWarnings: function(mode) {
      const warnings = {
        ECB: '⚠️ ECB mode is not semantically secure. Identical plaintexts produce identical ciphertexts.',
        CBC: 'ℹ️ CBC requires padding for non-block-size inputs. IV must be unpredictable.',
        CFB: 'ℹ️ CFB mode can handle any size input. Error propagation affects one block.',
        OFB: 'ℹ️ OFB mode can handle any size input. No error propagation.',
        CTR: 'ℹ️ CTR mode converts block cipher to stream cipher. Never reuse counter.',
        GCM: '✅ GCM provides authenticated encryption. Preferred for new applications.'
      };
      
      const element = document.getElementById('mode-warnings');
      if (element) {
        element.innerHTML = warnings[mode] || '';
        element.className = `mode-warnings warning-${mode.toLowerCase()}`;
      }
    },

    validatePaddingCompatibility: function() {
      const streamModes = ['CFB', 'OFB', 'CTR', 'GCM'];
      
      if (streamModes.includes(this.currentMode) && this.currentPadding !== 'NONE') {
        this.showPaddingWarning('Stream modes do not require padding');
      }
    },

    showPaddingWarning: function(message) {
      const warnings = document.getElementById('mode-warnings');
      if (warnings) {
        warnings.innerHTML += `<br><span class="padding-warning">⚠️ ${message}</span>`;
      }
    },

    // ===== CIPHER OPERATIONS =====
    
    // Apply the selected mode and padding to encrypt data
    encrypt: function(cipher, plaintext, key) {
      const mode = this.currentMode;
      const padding = this.currentPadding;
      
      try {
        // Prepare cipher
        if (typeof cipher.Init === 'function') cipher.Init();
        if (typeof cipher.KeySetup === 'function') cipher.KeySetup(key);
        
        // Apply padding if needed
        const paddedData = this.applyPadding(plaintext, padding, cipher);
        
        // Apply cipher mode
        const ciphertext = this.applyCipherMode(cipher, paddedData, mode, true);
        
        return {
          success: true,
          data: ciphertext,
          mode: mode,
          padding: padding,
          iv: this.getCurrentIV(),
          counter: this.getCurrentCounter()
        };
        
      } catch (error) {
        return {
          success: false,
          error: error.message,
          mode: mode,
          padding: padding
        };
      }
    },

    // Apply the selected mode and padding to decrypt data
    decrypt: function(cipher, ciphertext, key) {
      const mode = this.currentMode;
      const padding = this.currentPadding;
      
      try {
        // Prepare cipher
        if (typeof cipher.Init === 'function') cipher.Init();
        if (typeof cipher.KeySetup === 'function') cipher.KeySetup(key);
        
        // Apply cipher mode (decrypt)
        const paddedPlaintext = this.applyCipherMode(cipher, ciphertext, mode, false);
        
        // Remove padding if needed
        const plaintext = this.removePadding(paddedPlaintext, padding, cipher);
        
        return {
          success: true,
          data: plaintext,
          mode: mode,
          padding: padding
        };
        
      } catch (error) {
        return {
          success: false,
          error: error.message,
          mode: mode,
          padding: padding
        };
      }
    },

    // ===== PADDING IMPLEMENTATION =====
    
    applyPadding: function(data, paddingType, cipher) {
      if (paddingType === 'NONE') {
        return data;
      }
      
      const blockSize = this.getBlockSize(cipher);
      const dataBytes = this.stringToBytes(data);
      const paddingLength = blockSize - (dataBytes.length % blockSize);
      
      switch (paddingType) {
        case 'PKCS7':
          return this.applyPKCS7Padding(dataBytes, blockSize);
        case 'ISO7816':
          return this.applyISO7816Padding(dataBytes, blockSize);
        case 'ANSI923':
          return this.applyANSI923Padding(dataBytes, blockSize);
        case 'ZERO':
          return this.applyZeroPadding(dataBytes, blockSize);
        default:
          throw new Error(`Unknown padding scheme: ${paddingType}`);
      }
    },

    removePadding: function(data, paddingType, cipher) {
      if (paddingType === 'NONE') {
        return data;
      }
      
      const dataBytes = this.stringToBytes(data);
      
      switch (paddingType) {
        case 'PKCS7':
          return this.removePKCS7Padding(dataBytes);
        case 'ISO7816':
          return this.removeISO7816Padding(dataBytes);
        case 'ANSI923':
          return this.removeANSI923Padding(dataBytes);
        case 'ZERO':
          return this.removeZeroPadding(dataBytes);
        default:
          throw new Error(`Unknown padding scheme: ${paddingType}`);
      }
    },

    // PKCS#7 Padding Implementation
    applyPKCS7Padding: function(data, blockSize) {
      const paddingLength = blockSize - (data.length % blockSize);
      const paddingBytes = new Array(paddingLength).fill(paddingLength);
      return data.concat(paddingBytes);
    },

    removePKCS7Padding: function(data) {
      if (data.length === 0) throw new Error('Cannot remove padding from empty data');
      
      const paddingLength = data[data.length - 1];
      if (paddingLength > data.length || paddingLength === 0) {
        throw new Error('Invalid PKCS#7 padding');
      }
      
      // Verify padding bytes
      for (let i = data.length - paddingLength; i < data.length; i++) {
        if (data[i] !== paddingLength) {
          throw new Error('Invalid PKCS#7 padding');
        }
      }
      
      return data.slice(0, data.length - paddingLength);
    },

    // ===== MODE IMPLEMENTATION =====
    
    applyCipherMode: function(cipher, data, mode, encrypt) {
      const dataBytes = Array.isArray(data) ? data : this.stringToBytes(data);
      const blockSize = this.getBlockSize(cipher);
      
      switch (mode) {
        case 'ECB':
          return this.applyECB(cipher, dataBytes, blockSize, encrypt);
        case 'CBC':
          return this.applyCBC(cipher, dataBytes, blockSize, encrypt);
        case 'CFB':
          return this.applyCFB(cipher, dataBytes, blockSize, encrypt);
        case 'OFB':
          return this.applyOFB(cipher, dataBytes, blockSize, encrypt);
        case 'CTR':
          return this.applyCTR(cipher, dataBytes, blockSize, encrypt);
        case 'GCM':
          return this.applyGCM(cipher, dataBytes, blockSize, encrypt);
        default:
          throw new Error(`Unknown cipher mode: ${mode}`);
      }
    },

    // ECB Mode Implementation
    applyECB: function(cipher, data, blockSize, encrypt) {
      const result = [];
      const operation = encrypt ? 'szEncryptBlock' : 'szDecryptBlock';
      
      for (let i = 0; i < data.length; i += blockSize) {
        const block = data.slice(i, i + blockSize);
        if (block.length !== blockSize) {
          throw new Error(`Block size mismatch: expected ${blockSize}, got ${block.length}`);
        }
        
        const blockString = this.bytesToString(block);
        const processedBlock = cipher[operation](i / blockSize, blockString);
        result.push(...this.stringToBytes(processedBlock));
      }
      
      return this.bytesToString(result);
    },

    // ===== UTILITY FUNCTIONS =====
    
    getCurrentBlockSize: function() {
      // Try to get from selected cipher
      const cipherSelect = document.getElementById('cipherList');
      if (cipherSelect && typeof Cipher !== 'undefined') {
        const selectedCipher = Cipher.GetCipher(cipherSelect.value);
        if (selectedCipher) {
          return this.getBlockSize(selectedCipher);
        }
      }
      
      // Default block size
      return 16; // AES default
    },

    getBlockSize: function(cipher) {
      // Try various ways to determine block size
      if (cipher.maxBlockSize && cipher.maxBlockSize > 0) {
        return cipher.maxBlockSize;
      }
      if (cipher.blockSize) {
        return cipher.blockSize;
      }
      if (cipher.metadata && cipher.metadata.blockSize) {
        return cipher.metadata.blockSize;
      }
      
      // Default fallback
      return 16;
    },

    getCurrentIV: function() {
      const ivInput = document.getElementById('cipher-iv');
      return ivInput ? ivInput.value : '';
    },

    getCurrentCounter: function() {
      const counterInput = document.getElementById('cipher-counter');
      return counterInput ? counterInput.value : '';
    },

    generateRandomBytes: function(length) {
      const bytes = [];
      for (let i = 0; i < length; i++) {
        bytes.push(Math.floor(Math.random() * 256));
      }
      return bytes;
    },

    stringToBytes: function(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
      }
      return bytes;
    },

    bytesToString: function(bytes) {
      return String.fromCharCode.apply(null, bytes);
    },

    bytesToHex: function(bytes) {
      return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    hexToBytes: function(hex) {
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }
      return bytes;
    },

    // ===== INTEGRATION HOOKS =====
    
    notifyModeChange: function(mode) {
      // Hook for external systems to respond to mode changes
      if (typeof window !== 'undefined' && window.onCipherModeChange) {
        window.onCipherModeChange(mode);
      }
    },

    notifyPaddingChange: function(padding) {
      // Hook for external systems to respond to padding changes
      if (typeof window !== 'undefined' && window.onPaddingChange) {
        window.onPaddingChange(padding);
      }
    },

    setupEventHandlers: function() {
      // Additional event handlers can be added here
      console.log('Cipher modes and padding system initialized');
    }
  };

  // Export to global scope
  global.CipherModes = CipherModes;

  // Auto-initialize when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        CipherModes.init();
      });
    } else {
      CipherModes.init();
    }
  }

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CipherModes;
  }

})(typeof global !== 'undefined' ? global : window);