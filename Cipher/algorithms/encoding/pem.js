#!/usr/bin/env node
/*
 * Universal PEM (Privacy-Enhanced Mail) Encoder/Decoder
 * Based on RFC 1421 and RFC 7468 specifications
 * Compatible with both Browser and Node.js environments
 * 
 * PEM encoding is used for encoding cryptographic objects like
 * certificates, keys, and other binary data in a text format
 * suitable for email transmission.
 * 
 * References:
 * - RFC 1421: Privacy Enhancement for Internet Electronic Mail
 * - RFC 7468: Textual Encodings of PKIX, PKCS, and CMS Structures
 * 
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }
  
  if (!global.Cipher && typeof require !== 'undefined') {
    try {
      require('../../universal-cipher-env.js');
      require('../../cipher.js');
    } catch (e) {
      console.error('Failed to load cipher dependencies:', e.message);
      return;
    }
  }
  
  const PEM = {
    internalName: 'pem',
    name: 'PEM (Privacy-Enhanced Mail)',
    version: '1.0.0',
        comment: 'Educational implementation for learning purposes',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    
    // Standard Base64 alphabet for PEM
    base64Alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    
    // Default PEM label
    label: 'DATA',
    
    /**
     * Initialize the encoder
     */
    Init: function() {
      this.label = 'DATA';
    },
    
    /**
     * Set up PEM label
     * @param {string} key - PEM label (e.g., 'CERTIFICATE', 'PRIVATE KEY')
     */
    KeySetup: function(key) {
      if (typeof key === 'string') {
        this.label = key.toUpperCase();
      } else {
        this.label = 'DATA';
      }
    },
    
    /**
     * Encode binary data to PEM format
     * @param {number} mode - Encoding mode (0 = encode)
     * @param {string|Array} data - Input data to encode
     * @returns {string} PEM encoded text
     */
    encryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('PEM: Invalid mode for encoding');
      }
      
      // Convert input to byte array
      let bytes;
      if (typeof data === 'string') {
        bytes = OpCodes.StringToBytes(data);
      } else if (Array.isArray(data)) {
        bytes = data.slice();
      } else {
        throw new Error('PEM: Invalid input data type');
      }
      
      if (bytes.length === 0) {
        return this.formatPEM('');
      }
      
      // Encode to Base64
      const base64 = this.encodeBase64(bytes);
      
      // Format as PEM with proper line breaks
      return this.formatPEM(base64);
    },
    
    /**
     * Decode PEM format to binary data
     * @param {number} mode - Decoding mode (0 = decode)
     * @param {string} data - PEM encoded text
     * @returns {Array} Decoded byte array
     */
    decryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('PEM: Invalid mode for decoding');
      }
      
      if (typeof data !== 'string' || data.length === 0) {
        return [];
      }
      
      // Extract Base64 content from PEM format
      const base64Content = this.extractBase64FromPEM(data);
      
      if (base64Content === '') {
        return [];
      }
      
      // Decode Base64
      return this.decodeBase64(base64Content);
    },
    
    /**
     * Encode bytes to Base64
     * @param {Array} bytes - Input bytes
     * @returns {string} Base64 encoded string
     */
    encodeBase64: function(bytes) {
      let result = '';
      let i = 0;
      
      // Process 3-byte groups
      while (i < bytes.length) {
        const byte1 = bytes[i++] || 0;
        const byte2 = bytes[i++] || 0;
        const byte3 = bytes[i++] || 0;
        
        const combined = (byte1 << 16) | (byte2 << 8) | byte3;
        
        result += this.base64Alphabet[(combined >>> 18) & 0x3F];
        result += this.base64Alphabet[(combined >>> 12) & 0x3F];
        result += this.base64Alphabet[(combined >>> 6) & 0x3F];
        result += this.base64Alphabet[combined & 0x3F];
      }
      
      // Add padding
      const padding = (3 - (bytes.length % 3)) % 3;
      return result.slice(0, result.length - padding) + '='.repeat(padding);
    },
    
    /**
     * Decode Base64 to bytes
     * @param {string} base64 - Base64 encoded string
     * @returns {Array} Decoded bytes
     */
    decodeBase64: function(base64) {
      // Remove padding and whitespace
      const cleaned = base64.replace(/[=\\s]/g, '');
      const bytes = [];
      
      for (let i = 0; i < cleaned.length; i += 4) {
        const char1 = this.base64Alphabet.indexOf(cleaned[i] || '');
        const char2 = this.base64Alphabet.indexOf(cleaned[i + 1] || '');
        const char3 = this.base64Alphabet.indexOf(cleaned[i + 2] || '');
        const char4 = this.base64Alphabet.indexOf(cleaned[i + 3] || '');
        
        if (char1 === -1 || char2 === -1) {
          throw new Error('PEM: Invalid Base64 character');
        }
        
        const combined = (char1 << 18) | (char2 << 12) | 
                        ((char3 !== -1 ? char3 : 0) << 6) | 
                        (char4 !== -1 ? char4 : 0);
        
        bytes.push((combined >>> 16) & 0xFF);
        if (char3 !== -1) bytes.push((combined >>> 8) & 0xFF);
        if (char4 !== -1) bytes.push(combined & 0xFF);
      }
      
      return bytes;
    },
    
    /**
     * Format Base64 content as PEM
     * @param {string} base64 - Base64 content
     * @returns {string} PEM formatted text
     */
    formatPEM: function(base64) {
      let result = `-----BEGIN ${this.label}-----\\n`;
      
      // Add Base64 content with 64-character lines
      for (let i = 0; i < base64.length; i += 64) {
        result += base64.substring(i, i + 64) + '\\n';
      }
      
      result += `-----END ${this.label}-----\\n`;
      
      return result;
    },
    
    /**
     * Extract Base64 content from PEM format
     * @param {string} pem - PEM formatted text
     * @returns {string} Base64 content
     */
    extractBase64FromPEM: function(pem) {
      // Find BEGIN and END markers
      const beginPattern = /-----BEGIN\\s+([^-]+)-----/;
      const endPattern = /-----END\\s+([^-]+)-----/;
      
      const beginMatch = pem.match(beginPattern);
      const endMatch = pem.match(endPattern);
      
      if (!beginMatch || !endMatch) {
        throw new Error('PEM: Invalid PEM format - missing BEGIN/END markers');
      }
      
      const beginLabel = beginMatch[1].trim();
      const endLabel = endMatch[1].trim();
      
      if (beginLabel !== endLabel) {
        throw new Error('PEM: Mismatched BEGIN/END labels');
      }
      
      // Update label for future encoding
      this.label = beginLabel;
      
      // Extract content between markers
      const beginIndex = pem.indexOf(beginMatch[0]) + beginMatch[0].length;
      const endIndex = pem.indexOf(endMatch[0]);
      
      if (beginIndex >= endIndex) {
        return '';
      }
      
      const content = pem.substring(beginIndex, endIndex);
      
      // Remove whitespace and line breaks
      return content.replace(/\\s/g, '');
    },
    
    /**
     * Validate PEM format
     * @param {string} pem - PEM text to validate
     * @returns {Object} Validation result
     */
    validatePEM: function(pem) {
      try {
        const base64Content = this.extractBase64FromPEM(pem);
        const decoded = this.decodeBase64(base64Content);
        
        return {
          valid: true,
          label: this.label,
          contentLength: base64Content.length,
          decodedSize: decoded.length,
          hasHeaders: pem.includes('-----BEGIN') && pem.includes('-----END')
        };
      } catch (error) {
        return {
          valid: false,
          error: error.message
        };
      }
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      this.label = 'DATA';
    },
    
    /**
     * Get cipher information
     * @returns {Object} Cipher information
     */
    GetInfo: function() {
      return {
        name: this.name,
        version: this.version,
        type: 'Encoding',
        blockSize: '3 bytes → 4 characters + headers',
        keySize: 'PEM label',
        description: 'PEM encoding for cryptographic objects',
        features: ['Base64 encoding', 'Header/footer markers', 'Line breaks', 'Label identification'],
        standards: ['RFC 1421', 'RFC 7468'],
        applications: ['X.509 certificates', 'Private keys', 'CSRs', 'CRLs'],
        commonLabels: ['CERTIFICATE', 'PRIVATE KEY', 'PUBLIC KEY', 'CERTIFICATE REQUEST'],
        lineLength: 64
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(PEM);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PEM;
  }
  
  // Make available globally
  global.PEM = PEM;
  
})(typeof global !== 'undefined' ? global : window);