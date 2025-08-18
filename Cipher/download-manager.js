/*
 * Universal Download Manager
 * Advanced file download system with multiple formats and batch operations
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt - Download manager for SynthelicZ Cipher Tools
 */

(function(global) {
  'use strict';
  
  // Download Manager object
  const DownloadManager = {
    // Configuration constants
    MAX_FILENAME_LENGTH: 255,
    SUPPORTED_FORMATS: ['text', 'binary', 'hex', 'base64', 'json', 'csv', 'xml'],
    BATCH_DELAY: 100, // ms delay between batch downloads
    
    // File format configurations
    formatConfigs: {
      text: {
        extension: 'txt',
        mimeType: 'text/plain',
        description: 'Plain Text File'
      },
      binary: {
        extension: 'bin',
        mimeType: 'application/octet-stream',
        description: 'Binary File'
      },
      hex: {
        extension: 'hex',
        mimeType: 'text/plain',
        description: 'Hex Dump File'
      },
      base64: {
        extension: 'b64',
        mimeType: 'text/plain',
        description: 'Base64 Encoded File'
      },
      json: {
        extension: 'json',
        mimeType: 'application/json',
        description: 'JSON Data File'
      },
      csv: {
        extension: 'csv',
        mimeType: 'text/csv',
        description: 'Comma-Separated Values'
      },
      xml: {
        extension: 'xml',
        mimeType: 'application/xml',
        description: 'XML Document'
      }
    },
    
    // Initialize download manager
    init: function() {
      if (typeof window !== 'undefined') {
        this.setupBrowserEnvironment();
      }
      console.log('DownloadManager initialized');
    },
    
    // Set up browser-specific functionality
    setupBrowserEnvironment: function() {
      // Check for download API support
      this.hasDownloadSupport = typeof document !== 'undefined' && 
                                typeof document.createElement === 'function';
      
      // Check for modern File API support
      this.hasFileAPI = typeof Blob !== 'undefined' && 
                        typeof URL !== 'undefined' && 
                        typeof URL.createObjectURL === 'function';
      
      console.log('Download support:', this.hasDownloadSupport);
      console.log('File API support:', this.hasFileAPI);
    },
    
    // Generate filename with timestamp and cipher info
    generateFilename: function(prefix, format, includeTimestamp = true) {
      let filename = prefix || 'cipher-output';
      
      // Add cipher name if available
      if (typeof window !== 'undefined' && window.cipher && window.cipher !== '') {
        filename += `_${window.cipher}`;
      }
      
      // Add timestamp if requested
      if (includeTimestamp) {
        const timestamp = new Date().toISOString()
          .replace(/[:.]/g, '-')
          .replace('T', '_')
          .slice(0, -5); // Remove milliseconds and 'Z'
        filename += `_${timestamp}`;
      }
      
      // Add extension
      const config = this.formatConfigs[format] || this.formatConfigs.text;
      filename += `.${config.extension}`;
      
      // Ensure filename length is valid
      if (filename.length > this.MAX_FILENAME_LENGTH) {
        const extension = `.${config.extension}`;
        const maxBase = this.MAX_FILENAME_LENGTH - extension.length;
        filename = filename.substring(0, maxBase) + extension;
      }
      
      return filename;
    },
    
    // Main download function
    download: function(data, filename, format = 'text', options = {}) {
      if (!this.hasDownloadSupport) {
        console.error('Download not supported in this environment');
        return false;
      }
      
      try {
        const processedData = this.processDataForFormat(data, format, options);
        const config = this.formatConfigs[format] || this.formatConfigs.text;
        const finalFilename = filename || this.generateFilename('download', format);
        
        return this.createDownload(processedData, finalFilename, config, options);
      } catch (error) {
        console.error('Download failed:', error.message);
        this.showError(`Download failed: ${error.message}`);
        return false;
      }
    },
    
    // Process data according to format
    processDataForFormat: function(data, format, options = {}) {
      switch (format.toLowerCase()) {
        case 'text':
          return this.processTextData(data, options);
        
        case 'binary':
          return this.processBinaryData(data, options);
        
        case 'hex':
          return this.processHexData(data, options);
        
        case 'base64':
          return this.processBase64Data(data, options);
        
        case 'json':
          return this.processJsonData(data, options);
        
        case 'csv':
          return this.processCsvData(data, options);
        
        case 'xml':
          return this.processXmlData(data, options);
        
        default:
          return data;
      }
    },
    
    // Process text data
    processTextData: function(data, options) {
      let textData = String(data);
      
      // Add BOM for UTF-8 if requested
      if (options.addBOM) {
        textData = '\uFEFF' + textData;
      }
      
      // Convert line endings if specified
      if (options.lineEndings) {
        switch (options.lineEndings) {
          case 'windows':
            textData = textData.replace(/\n/g, '\r\n');
            break;
          case 'unix':
            textData = textData.replace(/\r\n/g, '\n');
            break;
          case 'mac':
            textData = textData.replace(/\n/g, '\r');
            break;
        }
      }
      
      return textData;
    },
    
    // Process binary data
    processBinaryData: function(data, options) {
      if (typeof data === 'string') {
        // Convert string to Uint8Array
        const uint8Array = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          uint8Array[i] = data.charCodeAt(i);
        }
        return uint8Array;
      }
      return data;
    },
    
    // Process hex data
    processHexData: function(data, options) {
      let hexData = '';
      const bytesPerLine = options.bytesPerLine || 16;
      const includeAddress = options.includeAddress !== false;
      const includeAscii = options.includeAscii !== false;
      
      const binaryData = String(data);
      
      for (let i = 0; i < binaryData.length; i += bytesPerLine) {
        let line = '';
        
        // Add address if requested
        if (includeAddress) {
          const address = i.toString(16).toUpperCase().padStart(8, '0');
          line += `${address}: `;
        }
        
        // Add hex bytes
        let hexPart = '';
        let asciiPart = '';
        
        for (let j = 0; j < bytesPerLine && (i + j) < binaryData.length; j++) {
          const byte = binaryData.charCodeAt(i + j);
          hexPart += (byte < 16 ? '0' : '') + byte.toString(16).toUpperCase() + ' ';
          asciiPart += (byte >= 32 && byte <= 126) ? binaryData.charAt(i + j) : '.';
        }
        
        // Pad hex part if needed
        const padding = bytesPerLine - Math.min(bytesPerLine, binaryData.length - i);
        hexPart += '   '.repeat(padding);
        
        line += hexPart;
        
        // Add ASCII if requested
        if (includeAscii) {
          line += ` | ${asciiPart}`;
        }
        
        hexData += line + '\n';
      }
      
      return hexData.trim();
    },
    
    // Process base64 data
    processBase64Data: function(data, options) {
      const binaryData = String(data);
      let base64Data = '';
      
      if (typeof btoa !== 'undefined') {
        base64Data = btoa(binaryData);
      } else {
        // Fallback base64 encoding
        base64Data = this.base64Encode(binaryData);
      }
      
      // Add line breaks if requested
      if (options.lineLength && options.lineLength > 0) {
        const regex = new RegExp(`.{1,${options.lineLength}}`, 'g');
        base64Data = base64Data.match(regex).join('\n');
      }
      
      return base64Data;
    },
    
    // Process JSON data
    processJsonData: function(data, options) {
      const metadata = {
        format: 'SynthelicZ Cipher Output',
        version: '1.0',
        timestamp: new Date().toISOString(),
        cipher: (typeof window !== 'undefined' && window.cipher) ? window.cipher: 'unknown',
        dataSize: String(data).length,
        encoding: options.encoding || 'binary'
      };
      
      let jsonData;
      
      if (options.includeHex) {
        const hexData = this.stringToHex(String(data));
        jsonData = {
          metadata: metadata,
          data: {
            original: String(data),
            hex: hexData,
            base64: this.stringToBase64(String(data))
          }
        };
      } else {
        jsonData = {
          metadata: metadata,
          data: String(data)
        };
      }
      
      const indent = options.minify ? 0 : 2;
      return JSON.stringify(jsonData, null, indent);
    },
    
    // Process CSV data
    processCsvData: function(data, options) {
      const binaryData = String(data);
      let csvData = 'Address,Hex,Decimal,ASCII\n';
      
      for (let i = 0; i < binaryData.length; i++) {
        const byte = binaryData.charCodeAt(i);
        const hex = (byte < 16 ? '0' : '') + byte.toString(16).toUpperCase();
        const ascii = (byte >= 32 && byte <= 126) ? binaryData.charAt(i) : '.';
        
        csvData += `${i},${hex},${byte},"${ascii}"\n`;
      }
      
      return csvData;
    },
    
    // Process XML data
    processXmlData: function(data, options) {
      const binaryData = String(data);
      const cipher = (typeof window !== 'undefined' && window.cipher) ? window.cipher: 'unknown';
      
      let xmlData = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xmlData += `<cipherOutput>\n`;
      xmlData += `  <metadata>\n`;
      xmlData += `    <format>SynthelicZ Cipher Output</format>\n`;
      xmlData += `    <timestamp>${new Date().toISOString()}</timestamp>\n`;
      xmlData += `    <cipher>${this.escapeXml(cipher)}</cipher>\n`;
      xmlData += `    <dataSize>${binaryData.length}</dataSize>\n`;
      xmlData += `  </metadata>\n`;
      xmlData += `  <data encoding="base64">${this.stringToBase64(binaryData)}</data>\n`;
      xmlData += `  <hexDump>\n`;
      
      // Add hex dump
      for (let i = 0; i < binaryData.length; i += 16) {
        const chunk = binaryData.substring(i, i + 16);
        let hexLine = '';
        let asciiLine = '';
        
        for (let j = 0; j < chunk.length; j++) {
          const byte = chunk.charCodeAt(j);
          hexLine += (byte < 16 ? '0' : '') + byte.toString(16).toUpperCase() + ' ';
          asciiLine += (byte >= 32 && byte <= 126) ? chunk.charAt(j) : '.';
        }
        
        xmlData += `    <line address="${i.toString(16).toUpperCase().padStart(8, '0')}" hex="${hexLine.trim()}" ascii="${this.escapeXml(asciiLine)}" />\n`;
      }
      
      xmlData += `  </hexDump>\n`;
      xmlData += `</cipherOutput>\n`;
      
      return xmlData;
    },
    
    // Create download
    createDownload: function(data, filename, config, options) {
      if (!this.hasFileAPI) {
        console.error('File API not supported');
        return false;
      }
      
      try {
        let blob;
        
        if (data instanceof Uint8Array) {
          blob = new Blob([data], { type: config.mimeType });
        } else {
          blob = new Blob([data], { type: config.mimeType });
        }
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up URL after a delay
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
        
        this.showSuccess(`Downloaded: ${filename} (${config.description})`);
        return true;
      } catch (error) {
        console.error('Create download failed:', error);
        return false;
      }
    },
    
    // Batch download
    downloadBatch: function(downloads) {
      if (!Array.isArray(downloads) || downloads.length === 0) {
        this.showError('No downloads specified for batch operation');
        return;
      }
      
      this.showInfo(`Starting batch download of ${downloads.length} files...`);
      
      downloads.forEach((download, index) => {
        setTimeout(() => {
          const { data, filename, format, options } = download;
          this.download(data, filename, format, options);
          
          if (index === downloads.length - 1) {
            this.showSuccess(`Batch download completed (${downloads.length} files)`);
          }
        }, index * this.BATCH_DELAY);
      });
    },
    
    // Calculate Shannon entropy (moved from FileIntegration)
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

    // Download current cipher operations
    downloadCipherOperations: function() {
      if (typeof window === 'undefined' || !window.arrStrings) {
        this.showError('No cipher data available');
        return;
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const cipher = window.cipher || 'unknown';
      
      const downloads = [
        {
          data: window.arrStrings['InputData'] || '',
          filename: `input_${cipher}_${timestamp}`,
          format: 'text',
          options: {}
        },
        {
          data: window.arrStrings['OutputData'] || '',
          filename: `encrypted_${cipher}_${timestamp}`,
          format: 'binary',
          options: {}
        },
        {
          data: window.arrStrings['ReconstructedData'] || '',
          filename: `decrypted_${cipher}_${timestamp}`,
          format: 'text',
          options: {}
        }
      ];
      
      // Add hex versions
      downloads.push({
        data: window.arrStrings['OutputData'] || '',
        filename: `encrypted_hex_${cipher}_${timestamp}`,
        format: 'hex',
        options: { includeAddress: true, includeAscii: true }
      });
      
      // Add JSON summary
      const summary = {
        cipher: cipher,
        timestamp: timestamp,
        operations: {
          input: window.arrStrings['InputData'] || '',
          key: window.arrStrings['InputKey'] || '',
          encrypted: window.arrStrings['OutputData'] || '',
          decrypted: window.arrStrings['ReconstructedData'] || ''
        }
      };
      
      downloads.push({
        data: JSON.stringify(summary, null, 2),
        filename: `cipher_summary_${cipher}_${timestamp}`,
        format: 'json',
        options: {}
      });
      
      this.downloadBatch(downloads.filter(d => d.data !== ''));
    },
    
    // Utility functions
    stringToHex: function(str) {
      let hex = '';
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        hex += (code < 16 ? '0' : '') + code.toString(16).toUpperCase() + ' ';
      }
      return hex.trim();
    },
    
    stringToBase64: function(str) {
      if (typeof btoa !== 'undefined') {
        return btoa(str);
      }
      return this.base64Encode(str);
    },
    
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
    
    escapeXml: function(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    
    // Notification functions
    showSuccess: function(message) {
      this.showNotification(message, 'success');
    },
    
    showError: function(message) {
      this.showNotification(message, 'error');
    },
    
    showInfo: function(message) {
      this.showNotification(message, 'info');
    },
    
    showNotification: function(message, type) {
      console.log(`[${type.toUpperCase()}] ${message}`);
      
      if (typeof window !== 'undefined') {
        // Create visual notification
        const notification = document.createElement('div');
        notification.className = `download-notification ${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 6px;
          color: white;
          font-weight: 500;
          z-index: 10000;
          max-width: 400px;
          word-wrap: break-word;
          background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
          if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
              notification.parentNode.removeChild(notification);
            }, 300);
          }
        }, 4000);
      }
    }
  };
  
  // Export to global scope
  global.DownloadManager = DownloadManager;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DownloadManager;
  }
  
  // Auto-initialize in browser environment
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        DownloadManager.init();
      });
    } else {
      DownloadManager.init();
    }
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);