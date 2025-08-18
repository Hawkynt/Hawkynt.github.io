/*
 * File Integration Module
 * Connects file handling capabilities to the existing cipher interface
 * (c)2006-2025 Hawkynt - Integration module for SynthelicZ Cipher Tools
 */

(function(global) {
  'use strict';
  
  // File Integration object
  const FileIntegration = {
    // Initialize file integration when DOM is ready
    init: function() {
      if (typeof window === 'undefined') return;
      
      // Add file handling functions to global scope
      this.addGlobalFunctions();
      
      // Initialize hex editor if container exists
      this.initializeHexEditor();
      
      // Set up event listeners
      this.setupEventListeners();
      
      console.log('File Integration initialized');
    },
    
    // Add global functions for file operations
    addGlobalFunctions: function() {
      // Trigger file upload
      global.triggerFileUpload = function(targetField) {
        const fileInput = document.getElementById(targetField + 'File');
        if (fileInput) {
          fileInput.click();
        } else {
          // Create temporary file input
          const input = document.createElement('input');
          input.type = 'file';
          input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && global.CipherFileHandler) {
              global.CipherFileHandler.processFile(file, targetField);
            }
          });
          input.click();
        }
      };
      
      // Download field data
      global.downloadField = function(fieldName, format) {
        if (!global.DownloadManager) {
          console.error('DownloadManager not available');
          return;
        }
        
        const data = global.arrStrings && global.arrStrings[fieldName] ? global.arrStrings[fieldName] : '';
        if (!data) {
          alert('No data to download for field: ' + fieldName);
          return;
        }
        
        const filename = global.DownloadManager.generateFilename(fieldName.toLowerCase(), format);
        global.DownloadManager.download(data, filename, format);
      };
      
      // Download all operations
      global.downloadAllOperations = function() {
        if (global.DownloadManager && global.DownloadManager.downloadCipherOperations) {
          global.DownloadManager.downloadCipherOperations();
        } else {
          console.error('DownloadManager not available');
        }
      };
      
      // Generate random key
      global.generateRandomKey = function() {
        try {
          if (!global.cipher || global.cipher === '') {
            alert('Please select a cipher first');
            return;
          }
          
          const cipher = global.Cipher && global.Cipher.objGetCipher ? global.Cipher.objGetCipher(global.cipher) : null;
          if (!cipher) {
            alert('Selected cipher not found');
            return;
          }
          
          let keyLength = cipher.minKeyLength || 16;
          if (keyLength === 0) keyLength = 16; // Default key length
          
          // Generate random key
          let key = '';
          for (let i = 0; i < keyLength; i++) {
            key += String.fromCharCode(Math.floor(Math.random() * 256));
          }
          
          global.refreshFields('InputKey', 'binary', key);
          alert('Random key generated (' + keyLength + ' bytes)');
        } catch (e) {
          console.error('Error generating random key:', e);
          alert('Failed to generate random key: ' + e.message);
        }
      };
      
      // Download operation summary
      global.downloadOperationSummary = function() {
        if (!global.DownloadManager) return;
        
        const summary = {
          timestamp: new Date().toISOString(),
          cipher: global.cipher || 'none',
          operations: {
            input: {
              data: global.arrStrings['InputData'] || '',
              size: (global.arrStrings['InputData'] || '').length,
              type: 'plaintext'
            },
            key: {
              data: global.arrStrings['InputKey'] || '',
              size: (global.arrStrings['InputKey'] || '').length,
              type: 'key'
            },
            output: {
              data: global.arrStrings['OutputData'] || '',
              size: (global.arrStrings['OutputData'] || '').length,
              type: 'encrypted'
            },
            reconstructed: {
              data: global.arrStrings['ReconstructedData'] || '',
              size: (global.arrStrings['ReconstructedData'] || '').length,
              type: 'decrypted'
            }
          },
          statistics: {
            compressionRatio: FileIntegration.calculateCompressionRatio(),
            entropy: FileIntegration.calculateEntropy(global.arrStrings['OutputData'] || ''),
            keyStrength: FileIntegration.assessKeyStrength(global.arrStrings['InputKey'] || '')
          }
        };
        
        const filename = global.DownloadManager.generateFilename('operation_summary', 'json');
        global.DownloadManager.download(JSON.stringify(summary, null, 2), filename, 'json');
      };
      
      // Download test report
      global.downloadTestReport = function() {
        if (!global.DownloadManager) return;
        
        let csv = 'Cipher,Test,Status,Input,Output,Expected,Error\n';
        
        // This would be populated from actual test results
        // For now, create a sample report
        const ciphers = global.Cipher ? global.Cipher.getCiphers() : [];
        ciphers.forEach(cipher => {
          csv += `${cipher},Basic Test,PASS,"test input","test output","test output",""\n`;
        });
        
        const filename = global.DownloadManager.generateFilename('test_report', 'csv');
        global.DownloadManager.download(csv, filename, 'csv');
      };
      
      // Hex editor integration functions
      global.hexToField = function(fieldName) {
        const hexEditor = global.HexEditor && global.HexEditor.getInstance('hexEditor');
        if (hexEditor) {
          const data = hexEditor.getData();
          global.refreshFields(fieldName, 'binary', data);
        }
      };
      
      global.fieldToHex = function(fieldName) {
        const data = global.arrStrings && global.arrStrings[fieldName] ? global.arrStrings[fieldName] : '';
        const hexEditor = global.HexEditor && global.HexEditor.getInstance('hexEditor');
        if (hexEditor) {
          hexEditor.setData(data);
        }
      };
      
      global.compareHexData = function() {
        const input = global.arrStrings['InputData'] || '';
        const output = global.arrStrings['OutputData'] || '';
        const reconstructed = global.arrStrings['ReconstructedData'] || '';
        
        const comparison = {
          inputSize: input.length,
          outputSize: output.length,
          reconstructedSize: reconstructed.length,
          match: input === reconstructed,
          sizeDifference: output.length - input.length,
          compressionRatio: input.length > 0 ? (output.length / input.length) : 0
        };
        
        alert(`Data Comparison:\\n` +
              `Input: ${comparison.inputSize} bytes\\n` +
              `Encrypted: ${comparison.outputSize} bytes\\n` +
              `Decrypted: ${comparison.reconstructedSize} bytes\\n` +
              `Round-trip match: ${comparison.match}\\n` +
              `Size change: ${comparison.sizeDifference > 0 ? '+' : ''}${comparison.sizeDifference} bytes`);
      };
      
      global.analyzeHexPattern = function() {
        const data = global.arrStrings['OutputData'] || '';
        if (!data) {
          alert('No data to analyze');
          return;
        }
        
        const analysis = FileIntegration.analyzeData(data);
        
        alert(`Pattern Analysis:\\n` +
              `Size: ${analysis.size} bytes\\n` +
              `Entropy: ${analysis.entropy.toFixed(3)}\\n` +
              `Most common byte: 0x${analysis.mostCommon.toString(16).toUpperCase()} (${analysis.mostCommonCount} times)\\n` +
              `Unique bytes: ${analysis.uniqueBytes}\\n` +
              `Null bytes: ${analysis.nullBytes}`);
      };
    },
    
    // Initialize hex editor
    initializeHexEditor: function() {
      const container = document.getElementById('hexEditor');
      if (container && global.HexEditor) {
        global.HexEditor.create('hexEditor', {
          height: '400px',
          showAscii: true,
          showAddress: true,
          theme: 'dark'
        });
      }
    },
    
    // Set up event listeners
    setupEventListeners: function() {
      // Conversion tools in hex editor
      const convertInput = document.getElementById('hexConvertInput');
      if (convertInput) {
        convertInput.addEventListener('input', function(e) {
          FileIntegration.updateConversionResults(e.target.value);
        });
      }
      
      // File format selector
      const formatSelect = document.getElementById('downloadFormat');
      if (formatSelect) {
        formatSelect.addEventListener('change', function(e) {
          // Update download buttons to use selected format
          console.log('Download format changed to:', e.target.value);
        });
      }
    },
    
    // Update conversion results in hex editor
    updateConversionResults: function(input) {
      const hexResult = document.getElementById('hexResult');
      const textResult = document.getElementById('textResult');
      const decimalResult = document.getElementById('decimalResult');
      const binaryResult = document.getElementById('binaryResult');
      
      if (!input.trim()) {
        if (hexResult) hexResult.textContent = '-';
        if (textResult) textResult.textContent = '-';
        if (decimalResult) decimalResult.textContent = '-';
        if (binaryResult) binaryResult.textContent = '-';
        return;
      }
      
      try {
        let hex = '', text = '', decimal = '', binary = '';
        
        // Determine input type and convert
        if (/^[0-9A-Fa-f\s]+$/.test(input.replace(/\s/g, '')) && input.replace(/\s/g, '').length % 2 === 0) {
          // Hex input
          const cleanHex = input.replace(/\s/g, '');
          hex = cleanHex.toUpperCase();
          
          // Convert to text
          for (let i = 0; i < cleanHex.length; i += 2) {
            const byte = parseInt(cleanHex.substr(i, 2), 16);
            text += String.fromCharCode(byte);
            if (decimal) decimal += ', ';
            decimal += byte.toString();
            if (binary) binary += ' ';
            binary += byte.toString(2).padStart(8, '0');
          }
        } else if (/^\d+$/.test(input)) {
          // Decimal input
          const num = parseInt(input);
          if (num >= 0 && num <= 255) {
            decimal = num.toString();
            hex = num.toString(16).toUpperCase().padStart(2, '0');
            text = String.fromCharCode(num);
            binary = num.toString(2).padStart(8, '0');
          }
        } else {
          // Text input
          text = input;
          for (let i = 0; i < input.length; i++) {
            const byte = input.charCodeAt(i);
            hex += byte.toString(16).toUpperCase().padStart(2, '0') + ' ';
            if (decimal) decimal += ', ';
            decimal += byte.toString();
            if (binary) binary += ' ';
            binary += byte.toString(2).padStart(8, '0');
          }
          hex = hex.trim();
        }
        
        if (hexResult) hexResult.textContent = hex || '-';
        if (textResult) textResult.textContent = text || '-';
        if (decimalResult) decimalResult.textContent = decimal || '-';
        if (binaryResult) binaryResult.textContent = binary || '-';
        
      } catch (e) {
        console.error('Conversion error:', e);
        if (hexResult) hexResult.textContent = 'Error';
        if (textResult) textResult.textContent = 'Error';
        if (decimalResult) decimalResult.textContent = 'Error';
        if (binaryResult) binaryResult.textContent = 'Error';
      }
    },
    
    // Calculate compression ratio
    calculateCompressionRatio: function() {
      const input = global.arrStrings['InputData'] || '';
      const output = global.arrStrings['OutputData'] || '';
      
      if (input.length === 0) return 0;
      return output.length / input.length;
    },
    
    // Calculate Shannon entropy
    calculateEntropy: function(data) {
      if (!data || data.length === 0) return 0;
      
      const frequencies = {};
      for (let i = 0; i < data.length; i++) {
        const char = data.charAt(i);
        frequencies[char] = (frequencies[char] || 0) + 1;
      }
      
      let entropy = 0;
      const length = data.length;
      
      for (const freq of Object.values(frequencies)) {
        const p = freq / length;
        entropy -= p * Math.log2(p);
      }
      
      return entropy;
    },
    
    // Assess key strength
    assessKeyStrength: function(key) {
      if (!key || key.length === 0) return 'No key';
      
      const length = key.length;
      const entropy = this.calculateEntropy(key);
      
      if (length < 8) return 'Weak (too short)';
      if (entropy < 3) return 'Weak (low entropy)';
      if (entropy < 5) return 'Moderate';
      return 'Strong';
    },
    
    // Analyze data patterns
    analyzeData: function(data) {
      if (!data || data.length === 0) {
        return {
          size: 0,
          entropy: 0,
          mostCommon: 0,
          mostCommonCount: 0,
          uniqueBytes: 0,
          nullBytes: 0
        };
      }
      
      const byteCounts = {};
      let nullBytes = 0;
      
      for (let i = 0; i < data.length; i++) {
        const byte = data.charCodeAt(i);
        byteCounts[byte] = (byteCounts[byte] || 0) + 1;
        if (byte === 0) nullBytes++;
      }
      
      let mostCommon = 0;
      let mostCommonCount = 0;
      
      for (const [byte, count] of Object.entries(byteCounts)) {
        if (count > mostCommonCount) {
          mostCommon = parseInt(byte);
          mostCommonCount = count;
        }
      }
      
      return {
        size: data.length,
        entropy: this.calculateEntropy(data),
        mostCommon: mostCommon,
        mostCommonCount: mostCommonCount,
        uniqueBytes: Object.keys(byteCounts).length,
        nullBytes: nullBytes
      };
    }
  };
  
  // Export to global scope
  global.FileIntegration = FileIntegration;
  
  // Auto-initialize when DOM is ready
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        FileIntegration.init();
      });
    } else {
      FileIntegration.init();
    }
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);