/*
 * Browser Compatibility Bridge
 * Allows the original browser interface to work with universal cipher system
 * (c)2006-2025 Hawkynt
 */

(function() {
  'use strict';
  
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return;
  }
  
  // Load universal cipher system if not already loaded
  if (typeof window.Cipher === 'undefined') {
    console.log('Loading universal cipher system for browser compatibility...');
    
    // Create script loader function
    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    
    // Load universal cipher system
    Promise.all([
      loadScript('./universal-cipher-env.js'),
      loadScript('./cipher.js'),
      loadScript('./caesar.js'),
      loadScript('./base64.js'),
      loadScript('./rot.js'),
      loadScript('./atbash.js')
    ]).then(() => {
      console.log('Universal cipher system loaded successfully');
      initializeBrowserCompatibility();
    }).catch(error => {
      console.error('Failed to load universal cipher system:', error);
    });
  } else {
    // System already loaded, just set up compatibility
    initializeBrowserCompatibility();
  }
  
  function initializeBrowserCompatibility() {
    // Ensure the original test system works with universal ciphers
    if (typeof window.runAllTests === 'function') {
      const originalRunAllTests = window.runAllTests;
      
      window.runAllTests = function() {
        // Try universal test first
        if (window.UniversalTestRunner) {
          try {
            const results = window.UniversalTestRunner.runAllTests();
            
            // Update the browser UI with results
            const resultsDiv = document.getElementById('test-results');
            const summaryDiv = document.getElementById('test-summary');
            const statsDiv = document.getElementById('test-stats');
            
            if (resultsDiv) {
              resultsDiv.innerHTML = '';
              
              for (const cipherName in results.results) {
                const result = results.results[cipherName];
                for (const detail of result.details) {
                  const statusIcon = detail.status === 'pass' ? '✓' : detail.status === 'fail' ? '✗' : '⚠';
                  const statusText = detail.status === 'pass' ? 'PASS' : detail.status === 'fail' ? 'FAIL' : 'WARN';
                  const statusClass = detail.status;
                  
                  const testDiv = document.createElement('div');
                  testDiv.className = 'test-case ' + statusClass;
                  
                  let detailsHtml = '';
                  if (detail.status !== 'pass') {
                    detailsHtml = '<div class="test-details">' +
                      '<div><strong>Input:</strong> "' + escapeHtml(detail.input || '') + '"</div>' +
                      '<div><strong>Key:</strong> "' + escapeHtml(detail.key || '') + '"</div>' +
                      '<div><strong>Expected:</strong> "' + escapeHtml(detail.expected || '') + '"</div>' +
                      '<div><strong>Got:</strong> "' + escapeHtml(detail.output || '') + '"</div>' +
                      (detail.error ? '<div><strong>Error:</strong> ' + escapeHtml(detail.error) + '</div>' : '') +
                      '</div>';
                  }
                  
                  testDiv.innerHTML = 
                    '<strong>' + statusIcon + ' [' + statusText + '] ' + cipherName + '</strong>: ' + detail.description + '<br>' +
                    detailsHtml;
                  
                  resultsDiv.appendChild(testDiv);
                }
              }
            }
            
            if (statsDiv) {
              const passRate = results.totalTests > 0 ? Math.round((results.passedTests / results.totalTests) * 100) : 0;
              const statusClass = results.passedTests === results.totalTests ? 'success' : results.failedTests > results.passedTests ? 'error' : 'warning';
              
              statsDiv.innerHTML = 
                '<div class="stats-grid">' +
                '<div class="stat-item ' + statusClass + '">' +
                '<span class="stat-number">' + results.passedTests + '/' + results.totalTests + '</span>' +
                '<span class="stat-label">Tests Passed (' + passRate + '%)</span>' +
                '</div>' +
                '<div class="stat-item">' +
                '<span class="stat-number">' + Object.keys(results.results).length + '</span>' +
                '<span class="stat-label">Algorithms Tested</span>' +
                '</div>' +
                '</div>';
            }
            
            if (summaryDiv) {
              summaryDiv.style.display = 'block';
            }
            
            return;
          } catch (error) {
            console.warn('Universal test failed, falling back to original:', error.message);
          }
        }
        
        // Fallback to original test system
        originalRunAllTests();
      };
    }
    
    // Make sure cipher objects are accessible for browser UI
    window.runUniversalTests = function() {
      if (window.UniversalTestRunner) {
        return window.UniversalTestRunner.runAllTests();
      } else {
        console.error('Universal test runner not available');
        return null;
      }
    };
    
    // Ensure BodyInit works with universal system
    if (typeof window.BodyInit === 'function') {
      const originalBodyInit = window.BodyInit;
      
      window.BodyInit = function() {
        // Initialize universal system first
        try {
          const selectElement = document.forms['frmCipher'] && document.forms['frmCipher'].elements['slctCipher'];
          if (selectElement && window.Cipher) {
            // Clear existing options except first two
            while (selectElement.options.length > 2) {
              selectElement.removeChild(selectElement.options[selectElement.options.length - 1]);
            }
            
            // Add universal ciphers
            const ciphers = window.Cipher.getCiphers();
            for (let i = 0; i < ciphers.length; i++) {
              const cipherInfo = window.Cipher.objGetCipher(ciphers[i]);
              if (cipherInfo) {
                selectElement.options[selectElement.options.length] = new Option(cipherInfo.name, ciphers[i]);
              }
            }
            
            selectElement.selectedIndex = 0;
          }
        } catch (error) {
          console.warn('Universal BodyInit failed, falling back to original:', error.message);
          originalBodyInit();
        }
      };
    }
  }
  
  // Helper function
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[m];
    });
  }
  
})();