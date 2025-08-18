#!/usr/bin/env node
/*
 * Cipher Metadata API System
 * Provides high-level API for accessing and managing cipher metadata
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load dependencies
  if (!global.CipherMetadata && typeof require !== 'undefined') {
    try {
      require('./cipher-metadata.js');
    } catch (e) {
      console.error('Failed to load cipher metadata system:', e.message);
      return;
    }
  }
  
  if (!global.Cipher && typeof require !== 'undefined') {
    try {
      require('./cipher.js');
    } catch (e) {
      console.error('Failed to load cipher system:', e.message);
      return;
    }
  }
  
  // Metadata API System
  const CipherMetadataAPI = {
    
    // Get all registered ciphers with their metadata
    getAllCiphers: function() {
      if (!global.Cipher) {
        console.warn('Cipher system not available');
        return [];
      }
      
      const ciphers = [];
      const cipherNames = global.Cipher.getCiphers();
      
      cipherNames.forEach(name => {
        try {
          const cipher = global.Cipher.objGetCipher(name);
          if (cipher && cipher.metadata) {
            ciphers.push({
              internalName: cipher.internalName,
              displayName: cipher.name,
              metadata: cipher.metadata,
              hasTestVectors: !!(cipher.testVectors && cipher.testVectors.length > 0)
            });
          }
        } catch (e) {
          console.warn(`Failed to get metadata for cipher ${name}:`, e.message);
        }
      });
      
      return ciphers;
    },
    
    // Get metadata for a specific cipher
    getCipherMetadata: function(cipherName) {
      if (!global.Cipher) {
        console.warn('Cipher system not available');
        return null;
      }
      
      try {
        const cipher = global.Cipher.objGetCipher(cipherName);
        return cipher ? cipher.metadata : null;
      } catch (e) {
        console.warn(`Failed to get metadata for cipher ${cipherName}:`, e.message);
        return null;
      }
    },
    
    // Search ciphers by various criteria
    searchCiphers: function(query) {
      const allCiphers = CipherMetadataAPI.getAllCiphers();
      const searchTerm = query.toLowerCase();
      
      return allCiphers.filter(cipher => {
        if (!cipher.metadata) return false;
        
        const metadata = cipher.metadata;
        return (
          metadata.algorithm.toLowerCase().includes(searchTerm) ||
          metadata.displayName.toLowerCase().includes(searchTerm) ||
          metadata.description.toLowerCase().includes(searchTerm) ||
          metadata.inventor.toLowerCase().includes(searchTerm) ||
          metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
          metadata.category.toLowerCase().includes(searchTerm)
        );
      });
    },
    
    // Filter by category
    getCiphersByCategory: function(category) {
      const allCiphers = CipherMetadataAPI.getAllCiphers();
      return allCiphers.filter(cipher => 
        cipher.metadata && cipher.metadata.category === category
      );
    },
    
    // Filter by security status
    getCiphersBySecurityStatus: function(status) {
      const allCiphers = CipherMetadataAPI.getAllCiphers();
      return allCiphers.filter(cipher => 
        cipher.metadata && cipher.metadata.securityStatus === status
      );
    },
    
    // Filter by complexity level
    getCiphersByComplexity: function(complexity) {
      const allCiphers = CipherMetadataAPI.getAllCiphers();
      return allCiphers.filter(cipher => 
        cipher.metadata && cipher.metadata.complexity === complexity
      );
    },
    
    // Get ciphers by time period
    getCiphersByTimePeriod: function(startYear, endYear) {
      const allCiphers = CipherMetadataAPI.getAllCiphers();
      return allCiphers.filter(cipher => {
        if (!cipher.metadata || !cipher.metadata.year) return false;
        const year = cipher.metadata.year;
        return year >= startYear && year <= endYear;
      });
    },
    
    // Get summary statistics
    getStatistics: function() {
      const allCiphers = CipherMetadataAPI.getAllCiphers();
      const metadata = allCiphers.map(c => c.metadata).filter(m => m);
      
      if (!global.CipherMetadata) {
        return { error: 'CipherMetadata system not available' };
      }
      
      return global.CipherMetadata.getStatistics(metadata);
    },
    
    // Validate all cipher metadata
    validateAllMetadata: function() {
      const allCiphers = CipherMetadataAPI.getAllCiphers();
      const validationResults = {
        total: allCiphers.length,
        valid: 0,
        invalid: 0,
        errors: []
      };
      
      if (!global.CipherMetadata) {
        validationResults.errors.push('CipherMetadata system not available');
        return validationResults;
      }
      
      allCiphers.forEach(cipher => {
        if (!cipher.metadata) {
          validationResults.invalid++;
          validationResults.errors.push({
            cipher: cipher.internalName,
            error: 'No metadata available'
          });
          return;
        }
        
        const errors = global.CipherMetadata.validateMetadata(cipher.metadata);
        if (errors.length === 0) {
          validationResults.valid++;
        } else {
          validationResults.invalid++;
          validationResults.errors.push({
            cipher: cipher.internalName,
            errors: errors
          });
        }
      });
      
      return validationResults;
    },
    
    // Generate metadata report for UI consumption
    generateReport: function(format = 'json') {
      const allCiphers = CipherMetadataAPI.getAllCiphers();
      const stats = CipherMetadataAPI.getStatistics();
      const validation = CipherMetadataAPI.validateAllMetadata();
      
      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          totalCiphers: allCiphers.length,
          ciphersWithMetadata: allCiphers.filter(c => c.metadata).length,
          statistics: stats,
          validation: validation
        },
        ciphers: allCiphers.map(cipher => ({
          internalName: cipher.internalName,
          displayName: cipher.displayName,
          metadata: cipher.metadata,
          hasTestVectors: cipher.hasTestVectors
        }))
      };
      
      if (format === 'html') {
        return CipherMetadataAPI.generateHTMLReport(report);
      } else if (format === 'markdown') {
        return CipherMetadataAPI.generateMarkdownReport(report);
      } else {
        return report; // JSON format
      }
    },
    
    // Generate HTML report
    generateHTMLReport: function(report) {
      let html = `
        <div class="metadata-report">
          <h1>Cipher Metadata Report</h1>
          <p>Generated: ${report.timestamp}</p>
          
          <div class="summary">
            <h2>Summary</h2>
            <ul>
              <li>Total Ciphers: ${report.summary.totalCiphers}</li>
              <li>Ciphers with Metadata: ${report.summary.ciphersWithMetadata}</li>
              <li>Validation: ${report.summary.validation.valid} valid, ${report.summary.validation.invalid} invalid</li>
            </ul>
          </div>
          
          <div class="statistics">
            <h2>Statistics</h2>
            <h3>By Category</h3>
            <ul>
      `;
      
      if (report.summary.statistics.byCategory) {
        Object.entries(report.summary.statistics.byCategory).forEach(([category, count]) => {
          if (count > 0) {
            html += `<li>${category}: ${count}</li>`;
          }
        });
      }
      
      html += `
            </ul>
            <h3>By Security Status</h3>
            <ul>
      `;
      
      if (report.summary.statistics.bySecurityStatus) {
        Object.entries(report.summary.statistics.bySecurityStatus).forEach(([status, count]) => {
          if (count > 0) {
            html += `<li>${status}: ${count}</li>`;
          }
        });
      }
      
      html += `
            </ul>
          </div>
          
          <div class="ciphers">
            <h2>Cipher Details</h2>
      `;
      
      report.ciphers.forEach(cipher => {
        if (cipher.metadata) {
          html += global.CipherMetadata.formatHTML(cipher.metadata);
        }
      });
      
      html += `
          </div>
        </div>
      `;
      
      return html;
    },
    
    // Generate Markdown report
    generateMarkdownReport: function(report) {
      let md = `# Cipher Metadata Report\n\n`;
      md += `Generated: ${report.timestamp}\n\n`;
      
      md += `## Summary\n\n`;
      md += `- Total Ciphers: ${report.summary.totalCiphers}\n`;
      md += `- Ciphers with Metadata: ${report.summary.ciphersWithMetadata}\n`;
      md += `- Validation: ${report.summary.validation.valid} valid, ${report.summary.validation.invalid} invalid\n\n`;
      
      md += `## Statistics\n\n`;
      md += `### By Category\n\n`;
      if (report.summary.statistics.byCategory) {
        Object.entries(report.summary.statistics.byCategory).forEach(([category, count]) => {
          if (count > 0) {
            md += `- ${category}: ${count}\n`;
          }
        });
      }
      
      md += `\n### By Security Status\n\n`;
      if (report.summary.statistics.bySecurityStatus) {
        Object.entries(report.summary.statistics.bySecurityStatus).forEach(([status, count]) => {
          if (count > 0) {
            md += `- ${status}: ${count}\n`;
          }
        });
      }
      
      md += `\n## Cipher Details\n\n`;
      report.ciphers.forEach(cipher => {
        if (cipher.metadata) {
          md += global.CipherMetadata.formatMarkdown(cipher.metadata);
          md += '\n---\n\n';
        }
      });
      
      return md;
    },
    
    // Export cipher metadata for external tools
    exportMetadata: function(format = 'json', cipherNames = null) {
      let ciphers = CipherMetadataAPI.getAllCiphers();
      
      if (cipherNames) {
        ciphers = ciphers.filter(c => cipherNames.includes(c.internalName));
      }
      
      const exportData = {
        formatVersion: '1.0',
        exportedAt: new Date().toISOString(),
        ciphers: ciphers.map(c => c.metadata).filter(m => m)
      };
      
      if (format === 'csv') {
        return CipherMetadataAPI.exportToCSV(exportData.ciphers);
      } else {
        return exportData;
      }
    },
    
    // Export to CSV format
    exportToCSV: function(metadataArray) {
      const headers = [
        'algorithm', 'displayName', 'category', 'complexity', 
        'securityStatus', 'inventor', 'year', 'description'
      ];
      
      let csv = headers.join(',') + '\n';
      
      metadataArray.forEach(metadata => {
        const row = headers.map(header => {
          let value = metadata[header] || '';
          if (typeof value === 'string') {
            value = '"' + value.replace(/"/g, '""') + '"';
          }
          return value;
        });
        csv += row.join(',') + '\n';
      });
      
      return csv;
    }
  };
  
  // Export to global scope
  global.CipherMetadataAPI = CipherMetadataAPI;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CipherMetadataAPI;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);