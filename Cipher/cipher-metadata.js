#!/usr/bin/env node
/*
 * Universal Cipher Metadata Management System
 * Provides comprehensive metadata schema for all cipher implementations
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Metadata schema definitions
  const CipherMetadata = {
    
    // Security status classifications - NEVER claim algorithms are "secure"
    SecurityStatus: {
      INSECURE: 'insecure',       // Known vulnerabilities, should not be used in production
      EDUCATIONAL: 'educational', // For learning purposes only, not production
      UNKNOWN: null               // Not yet broken or thoroughly analyzed (safest default)
      // NOTE: We deliberately do NOT provide a "secure" status
      // Cryptographic security evolves and we are not qualified to make such claims
    },
    
    // Algorithm categories (matching Metadata-template.js exactly)
    Categories: {
      CIPHER: 'cipher',                         // Block/stream ciphers (AES, ChaCha20, etc.)
      MODE_OF_OPERATION: 'modeOfOperation',     // Cipher modes (CBC, GCM, etc.)
      PADDING_SCHEME: 'paddingScheme',          // Padding methods (PKCS#7, OAEP, etc.)
      HASH: 'hash',                             // Hash functions (SHA-256, Blake2, etc.)
      CHECKSUM: 'checksum',                     // Checksums (CRC32, Adler32, etc.)
      COMPRESSION: 'compression',               // Compression algorithms (DEFLATE, LZ77, etc.)
      KEY_DERIVATION: 'keyDerivation',          // KDF functions (PBKDF2, Argon2, etc.)
      RANDOM_NUMBER_GENERATOR: 'randomNumberGenerator', // RNG algorithms
      ENCODING_SCHEME: 'encodingScheme',        // Encoding methods (Base64, Hex, etc.)
      ERROR_CORRECTION: 'errorCorrection',      // Error correction codes
      
      // Legacy categories for backward compatibility
      BLOCK: 'cipher',                    // Maps to cipher
      STREAM: 'cipher',                   // Maps to cipher  
      MODE: 'modeOfOperation',            // Maps to modeOfOperation
      PADDING: 'paddingScheme',           // Maps to paddingScheme
      CLASSICAL: 'cipher',                // Maps to cipher
      ENCODING: 'encodingScheme',         // Maps to encodingScheme
      ASYMMETRIC: 'cipher',               // Maps to cipher
      EDUCATIONAL: 'cipher'               // Maps to cipher
    },
    
    // Complexity levels for educational purposes
    ComplexityLevels: {
      BEGINNER: 'beginner',         // Simple to understand and implement
      INTERMEDIATE: 'intermediate', // Moderate complexity
      ADVANCED: 'advanced',         // Complex mathematical operations
      EXPERT: 'expert'             // Cutting-edge cryptographic concepts
    },
    
    // Standard metadata structure with backward compatibility
    createMetadata: function(config) {
      return {
        // Basic information (supports both old and new template)
        algorithm: config.algorithm || config.name || '',
        name: config.name || config.algorithm || '',
        displayName: config.displayName || config.name || config.algorithm || '',
        description: config.description || '',
        
        // Historical context
        inventor: config.inventor || '',
        year: config.year || null,
        country: config.country || '',
        background: config.background || '',
        
        // Security and usage (updated to match template)
        securityStatus: config.securityStatus !== undefined ? config.securityStatus : CipherMetadata.SecurityStatus.UNKNOWN,
        securityNotes: config.securityNotes || '',
        security: config.security || '', // Backward compatibility field
        
        // Classification (updated to match template)
        category: config.category || CipherMetadata.Categories.CIPHER,
        subCategory: config.subCategory || config.subcategory || '', // Support both naming conventions
        complexity: config.complexity || CipherMetadata.ComplexityLevels.BEGINNER,
        
        // Technical specifications (enhanced)
        keySize: config.keySize || null,
        blockSize: config.blockSize || null,
        rounds: config.rounds || null,
        cryptoFamily: config.cryptoFamily || '',
        cryptoType: config.cryptoType || '',
        
        // References and specifications (enhanced for new template)
        specifications: config.specifications || [],
        testVectors: config.testVectors || [],
        tests: config.tests || config.testVectors || [], // Template naming compatibility
        references: config.references || [],
        documentation: config.documentation || [], // New template field
        
        // Performance characteristics (new template fields)
        performance: config.performance || null,
        knownVulnerabilities: config.knownVulnerabilities || config.vulnerabilities || [], // Template naming
        vulnerabilities: config.vulnerabilities || config.knownVulnerabilities || [], // Backward compatibility
        usage: config.usage || null,
        
        // Implementation notes
        implementationNotes: config.implementationNotes || '',
        performanceNotes: config.performanceNotes || '',
        
        // Educational value
        educationalValue: config.educationalValue || '',
        prerequisites: config.prerequisites || [],
        
        // Tags for searching and filtering
        tags: config.tags || [],
        
        // Version and maintenance info
        lastUpdated: config.lastUpdated || new Date().toISOString().split('T')[0],
        version: config.version || '1.0'
      };
    },
    
    // Helper functions for template compatibility
    Hex8ToBytes: function(hexString) {
      if (!hexString || typeof hexString !== 'string') {
        throw new Error('Invalid hex string input');
      }
      
      // Remove any whitespace and convert to lowercase
      const cleanHex = hexString.replace(/\s+/g, '').toLowerCase();
      
      // Validate hex characters
      if (!/^[0-9a-f]*$/i.test(cleanHex)) {
        throw new Error('Invalid hex characters in string');
      }
      
      // Ensure even length
      if (cleanHex.length % 2 !== 0) {
        throw new Error('Hex string must have even length');
      }
      
      const bytes = [];
      for (let i = 0; i < cleanHex.length; i += 2) {
        bytes.push(parseInt(cleanHex.substr(i, 2), 16));
      }
      
      return bytes;
    },
    
    // Convert bytes to hex string
    BytesToHex8: function(bytes) {
      if (!Array.isArray(bytes)) {
        throw new Error('Input must be an array of bytes');
      }
      
      return bytes.map(b => {
        if (typeof b !== 'number' || b < 0 || b > 255) {
          throw new Error('Invalid byte value: ' + b);
        }
        return b.toString(16).padStart(2, '0').toLowerCase();
      }).join('');
    },
    
    // Validation functions
    validateMetadata: function(metadata) {
      const errors = [];
      
      // Required fields
      if (!metadata.algorithm) errors.push('Algorithm name is required');
      if (!metadata.description) errors.push('Description is required');
      if (!metadata.category) errors.push('Category is required');
      
      // Valid enums
      if (metadata.securityStatus && !Object.values(CipherMetadata.SecurityStatus).includes(metadata.securityStatus)) {
        errors.push('Invalid security status: ' + metadata.securityStatus);
      }
      
      if (metadata.category && !Object.values(CipherMetadata.Categories).includes(metadata.category)) {
        errors.push('Invalid category: ' + metadata.category);
      }
      
      if (metadata.complexity && !Object.values(CipherMetadata.ComplexityLevels).includes(metadata.complexity)) {
        errors.push('Invalid complexity level: ' + metadata.complexity);
      }
      
      // Array validations
      if (metadata.specifications && !Array.isArray(metadata.specifications)) {
        errors.push('Specifications must be an array');
      }
      
      if (metadata.references && !Array.isArray(metadata.references)) {
        errors.push('References must be an array');
      }
      
      if (metadata.tags && !Array.isArray(metadata.tags)) {
        errors.push('Tags must be an array');
      }
      
      return errors;
    },
    
    // Helper functions for accessing metadata
    getSecurityColor: function(status) {
      switch (status) {
        case CipherMetadata.SecurityStatus.SECURE: return '#22c55e';      // Green
        case CipherMetadata.SecurityStatus.DEPRECATED: return '#f59e0b';  // Orange
        case CipherMetadata.SecurityStatus.EDUCATIONAL: return '#3b82f6'; // Blue
        case CipherMetadata.SecurityStatus.OBSOLETE: return '#ef4444';    // Red
        case CipherMetadata.SecurityStatus.EXPERIMENTAL: return '#8b5cf6'; // Purple
        default: return '#6b7280'; // Gray
      }
    },
    
    getComplexityIcon: function(complexity) {
      switch (complexity) {
        case CipherMetadata.ComplexityLevels.BEGINNER: return '⭐';
        case CipherMetadata.ComplexityLevels.INTERMEDIATE: return '⭐⭐';
        case CipherMetadata.ComplexityLevels.ADVANCED: return '⭐⭐⭐';
        case CipherMetadata.ComplexityLevels.EXPERT: return '⭐⭐⭐⭐';
        default: return '❓';
      }
    },
    
    // Search and filter functions
    searchMetadata: function(metadataArray, query) {
      const searchTerm = query.toLowerCase();
      return metadataArray.filter(metadata => {
        return (
          metadata.algorithm.toLowerCase().includes(searchTerm) ||
          metadata.displayName.toLowerCase().includes(searchTerm) ||
          metadata.description.toLowerCase().includes(searchTerm) ||
          metadata.inventor.toLowerCase().includes(searchTerm) ||
          metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      });
    },
    
    filterByCategory: function(metadataArray, category) {
      return metadataArray.filter(metadata => metadata.category === category);
    },
    
    filterByComplexity: function(metadataArray, complexity) {
      return metadataArray.filter(metadata => metadata.complexity === complexity);
    },
    
    filterBySecurityStatus: function(metadataArray, status) {
      return metadataArray.filter(metadata => metadata.securityStatus === status);
    },
    
    // Generate summary statistics
    getStatistics: function(metadataArray) {
      const stats = {
        total: metadataArray.length,
        byCategory: {},
        byComplexity: {},
        bySecurityStatus: {},
        averageYear: 0
      };
      
      // Count by category
      Object.values(CipherMetadata.Categories).forEach(cat => {
        stats.byCategory[cat] = metadataArray.filter(m => m.category === cat).length;
      });
      
      // Count by complexity
      Object.values(CipherMetadata.ComplexityLevels).forEach(comp => {
        stats.byComplexity[comp] = metadataArray.filter(m => m.complexity === comp).length;
      });
      
      // Count by security status
      Object.values(CipherMetadata.SecurityStatus).forEach(status => {
        stats.bySecurityStatus[status] = metadataArray.filter(m => m.securityStatus === status).length;
      });
      
      // Calculate average year
      const yearsWithData = metadataArray.filter(m => m.year && m.year > 0).map(m => m.year);
      if (yearsWithData.length > 0) {
        stats.averageYear = Math.round(yearsWithData.reduce((a, b) => a + b, 0) / yearsWithData.length);
      }
      
      return stats;
    },
    
    // Generate formatted metadata display
    formatMetadata: function(metadata, format = 'html') {
      if (format === 'markdown') {
        return CipherMetadata.formatMarkdown(metadata);
      } else if (format === 'json') {
        return JSON.stringify(metadata, null, 2);
      } else {
        return CipherMetadata.formatHTML(metadata);
      }
    },
    
    formatHTML: function(metadata) {
      return `
        <div class="cipher-metadata">
          <h3>${metadata.displayName}</h3>
          <p class="description">${metadata.description}</p>
          
          <div class="metadata-grid">
            <div class="metadata-item">
              <strong>Category:</strong> ${metadata.category}
              ${metadata.subcategory ? ` (${metadata.subcategory})` : ''}
            </div>
            <div class="metadata-item">
              <strong>Complexity:</strong> ${CipherMetadata.getComplexityIcon(metadata.complexity)} ${metadata.complexity}
            </div>
            <div class="metadata-item">
              <strong>Security Status:</strong> 
              <span style="color: ${CipherMetadata.getSecurityColor(metadata.securityStatus)}">
                ${metadata.securityStatus}
              </span>
            </div>
            ${metadata.inventor ? `<div class="metadata-item"><strong>Inventor:</strong> ${metadata.inventor}</div>` : ''}
            ${metadata.year ? `<div class="metadata-item"><strong>Year:</strong> ${metadata.year}</div>` : ''}
          </div>
          
          ${metadata.specifications.length > 0 ? `
            <div class="specifications">
              <strong>Specifications:</strong>
              <ul>
                ${metadata.specifications.map(spec => `<li><a href="${spec.url}" target="_blank">${spec.name}</a></li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${metadata.tags.length > 0 ? `
            <div class="tags">
              <strong>Tags:</strong> ${metadata.tags.map(tag => `<span class="tag">${tag}</span>`).join(', ')}
            </div>
          ` : ''}
        </div>
      `;
    },
    
    formatMarkdown: function(metadata) {
      let md = `# ${metadata.displayName}\n\n`;
      md += `${metadata.description}\n\n`;
      
      md += '## Details\n\n';
      md += `- **Category:** ${metadata.category}\n`;
      md += `- **Complexity:** ${metadata.complexity}\n`;
      md += `- **Security Status:** ${metadata.securityStatus}\n`;
      
      if (metadata.inventor) md += `- **Inventor:** ${metadata.inventor}\n`;
      if (metadata.year) md += `- **Year:** ${metadata.year}\n`;
      
      if (metadata.specifications.length > 0) {
        md += '\n## Specifications\n\n';
        metadata.specifications.forEach(spec => {
          md += `- [${spec.name}](${spec.url})\n`;
        });
      }
      
      if (metadata.tags.length > 0) {
        md += `\n**Tags:** ${metadata.tags.join(', ')}\n`;
      }
      
      return md;
    }
  };
  
  // Export to global scope
  global.CipherMetadata = CipherMetadata;
  
  // Make helper functions globally available for template usage
  global.Hex8ToBytes = CipherMetadata.Hex8ToBytes;
  global.BytesToHex8 = CipherMetadata.BytesToHex8;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CipherMetadata;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);