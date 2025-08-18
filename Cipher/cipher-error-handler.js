/*
 * Universal Cipher Error Handler
 * Standardized error handling and logging across all cipher implementations
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Error severity levels
  const ErrorSeverity = {
    DEBUG: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    CRITICAL: 4
  };
  
  // Error categories
  const ErrorCategories = {
    INITIALIZATION: 'initialization',
    KEY_SETUP: 'key_setup',
    ENCRYPTION: 'encryption',
    DECRYPTION: 'decryption',
    VALIDATION: 'validation',
    MEMORY: 'memory',
    PERFORMANCE: 'performance',
    SECURITY: 'security'
  };
  
  // Standardized cipher error handler
  const CipherErrorHandler = {
    
    // Configuration
    config: {
      logLevel: ErrorSeverity.WARNING,
      enableConsoleLogging: true,
      enableErrorCollection: true,
      maxErrorHistory: 100,
      enablePerformanceLogging: false
    },
    
    // Error history for debugging
    errorHistory: [],
    performanceMetrics: {},
    
    /**
     * Log an error with standardized format
     * @param {string} cipherName - Name of the cipher
     * @param {string} category - Error category
     * @param {number} severity - Error severity level
     * @param {string} message - Error message
     * @param {Object} details - Additional error details
     * @param {Error} originalError - Original error object (if any)
     */
    logError: function(cipherName, category, severity, message, details, originalError) {
      const timestamp = new Date().toISOString();
      const errorRecord = {
        timestamp: timestamp,
        cipherName: cipherName,
        category: category,
        severity: severity,
        message: message,
        details: details || {},
        stackTrace: originalError ? originalError.stack : new Error().stack,
        environment: this.getEnvironmentInfo()
      };
      
      // Add to error history if collection is enabled
      if (this.config.enableErrorCollection) {
        this.errorHistory.push(errorRecord);
        
        // Maintain maximum history size
        if (this.errorHistory.length > this.config.maxErrorHistory) {
          this.errorHistory.shift();
        }
      }
      
      // Console logging if enabled and severity meets threshold
      if (this.config.enableConsoleLogging && severity >= this.config.logLevel) {
        this.consoleLog(errorRecord);
      }
      
      // Handle critical errors
      if (severity === ErrorSeverity.CRITICAL) {
        this.handleCriticalError(errorRecord);
      }
      
      return errorRecord;
    },
    
    /**
     * Console logging with appropriate formatting
     * @param {Object} errorRecord - Error record to log
     */
    consoleLog: function(errorRecord) {
      const severityNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
      const severityName = severityNames[errorRecord.severity] || 'UNKNOWN';
      const prefix = `[${severityName}] ${errorRecord.cipherName}/${errorRecord.category}:`;
      
      switch (errorRecord.severity) {
        case ErrorSeverity.DEBUG:
          console.debug(prefix, errorRecord.message, errorRecord.details);
          break;
        case ErrorSeverity.INFO:
          console.info(prefix, errorRecord.message, errorRecord.details);
          break;
        case ErrorSeverity.WARNING:
          console.warn(prefix, errorRecord.message, errorRecord.details);
          break;
        case ErrorSeverity.ERROR:
        case ErrorSeverity.CRITICAL:
          console.error(prefix, errorRecord.message, errorRecord.details);
          if (errorRecord.stackTrace) {
            console.error('Stack trace:', errorRecord.stackTrace);
          }
          break;
      }
    },
    
    /**
     * Handle critical errors
     * @param {Object} errorRecord - Critical error record
     */
    handleCriticalError: function(errorRecord) {
      // In Node.js, we might want to exit or emit an event
      if (typeof process !== 'undefined' && process.emit) {
        process.emit('cipherCriticalError', errorRecord);
      }
      
      // In browser, we might want to throw or dispatch a custom event
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const event = new CustomEvent('cipherCriticalError', { detail: errorRecord });
        window.dispatchEvent(event);
      }
    },
    
    /**
     * Get environment information for error context
     * @returns {Object} Environment information
     */
    getEnvironmentInfo: function() {
      const info = {
        timestamp: Date.now(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
        memory: null
      };
      
      // Add memory information if available
      if (typeof process !== 'undefined' && process.memoryUsage) {
        info.memory = process.memoryUsage();
      } else if (typeof performance !== 'undefined' && performance.memory) {
        info.memory = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        };
      }
      
      return info;
    },
    
    /**
     * Create a performance timer for cipher operations
     * @param {string} cipherName - Name of the cipher
     * @param {string} operation - Operation name
     * @returns {Object} Timer object
     */
    createTimer: function(cipherName, operation) {
      const timerKey = `${cipherName}.${operation}`;
      const startTime = Date.now();
      
      return {
        end: () => {
          const duration = Date.now() - startTime;
          
          if (this.config.enablePerformanceLogging) {
            if (!this.performanceMetrics[timerKey]) {
              this.performanceMetrics[timerKey] = {
                count: 0,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0,
                avgTime: 0
              };
            }
            
            const metrics = this.performanceMetrics[timerKey];
            metrics.count++;
            metrics.totalTime += duration;
            metrics.minTime = Math.min(metrics.minTime, duration);
            metrics.maxTime = Math.max(metrics.maxTime, duration);
            metrics.avgTime = metrics.totalTime / metrics.count;
            
            // Log slow operations
            if (duration > 100) { // 100ms threshold
              this.logError(
                cipherName,
                ErrorCategories.PERFORMANCE,
                ErrorSeverity.WARNING,
                `Slow operation detected: ${operation} took ${duration}ms`,
                { duration: duration, operation: operation }
              );
            }
          }
          
          return duration;
        }
      };
    },
    
    /**
     * Validate cipher parameters and log issues
     * @param {string} cipherName - Name of the cipher
     * @param {string} key - Cipher key
     * @param {string} input - Input data
     * @returns {boolean} True if validation passes
     */
    validateCipherParams: function(cipherName, key, input) {
      let isValid = true;
      
      // Check for null/undefined parameters
      if (!key) {
        this.logError(
          cipherName,
          ErrorCategories.VALIDATION,
          ErrorSeverity.ERROR,
          'Cipher key is null or undefined',
          { key: key, input: input }
        );
        isValid = false;
      }
      
      if (input === null || input === undefined) {
        this.logError(
          cipherName,
          ErrorCategories.VALIDATION,
          ErrorSeverity.ERROR,
          'Input data is null or undefined',
          { key: key, input: input }
        );
        isValid = false;
      }
      
      // Check for empty parameters where not allowed
      if (typeof key === 'string' && key.length === 0) {
        this.logError(
          cipherName,
          ErrorCategories.VALIDATION,
          ErrorSeverity.WARNING,
          'Cipher key is empty string',
          { keyLength: 0 }
        );
      }
      
      // Check for potentially insecure keys
      if (typeof key === 'string') {
        // Warn about weak keys
        if (key.length < 8) {
          this.logError(
            cipherName,
            ErrorCategories.SECURITY,
            ErrorSeverity.WARNING,
            'Short cipher key detected - security risk',
            { keyLength: key.length }
          );
        }
        
        // Check for common weak patterns
        if (/^(.)\1*$/.test(key)) { // All same character
          this.logError(
            cipherName,
            ErrorCategories.SECURITY,
            ErrorSeverity.WARNING,
            'Cipher key contains repeated characters - security risk',
            { key: key.substring(0, 8) + '...' }
          );
        }
      }
      
      return isValid;
    },
    
    /**
     * Memory usage monitor for cipher operations
     * @param {string} cipherName - Name of the cipher
     * @param {Function} operation - Operation to monitor
     * @returns {*} Result of the operation
     */
    monitorMemoryUsage: function(cipherName, operation) {
      const startMemory = this.getMemorySnapshot();
      
      try {
        const result = operation();
        
        const endMemory = this.getMemorySnapshot();
        const memoryDelta = this.calculateMemoryDelta(startMemory, endMemory);
        
        // Log significant memory usage
        if (memoryDelta.heapUsed > 5 * 1024 * 1024) { // 5MB threshold
          this.logError(
            cipherName,
            ErrorCategories.MEMORY,
            ErrorSeverity.WARNING,
            `High memory usage detected: ${Math.round(memoryDelta.heapUsed / 1024 / 1024)}MB`,
            { memoryDelta: memoryDelta }
          );
        }
        
        return result;
      } catch (error) {
        this.logError(
          cipherName,
          ErrorCategories.MEMORY,
          ErrorSeverity.ERROR,
          'Memory monitoring failed',
          { error: error.message },
          error
        );
        throw error;
      }
    },
    
    /**
     * Get memory snapshot
     * @returns {Object} Memory information
     */
    getMemorySnapshot: function() {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        return process.memoryUsage();
      }
      if (typeof performance !== 'undefined' && performance.memory) {
        return {
          rss: 0,
          heapTotal: performance.memory.totalJSHeapSize,
          heapUsed: performance.memory.usedJSHeapSize,
          external: 0
        };
      }
      return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 };
    },
    
    /**
     * Calculate memory delta between snapshots
     * @param {Object} before - Before memory snapshot
     * @param {Object} after - After memory snapshot
     * @returns {Object} Memory delta
     */
    calculateMemoryDelta: function(before, after) {
      return {
        rss: after.rss - before.rss,
        heapTotal: after.heapTotal - before.heapTotal,
        heapUsed: after.heapUsed - before.heapUsed,
        external: after.external - before.external
      };
    },
    
    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getErrorStats: function() {
      const stats = {
        totalErrors: this.errorHistory.length,
        errorsBySeverity: {},
        errorsByCategory: {},
        errorsByCipher: {}
      };
      
      // Count by severity
      Object.values(ErrorSeverity).forEach(severity => {
        if (typeof severity === 'number') {
          stats.errorsBySeverity[severity] = this.errorHistory.filter(e => e.severity === severity).length;
        }
      });
      
      // Count by category
      this.errorHistory.forEach(error => {
        stats.errorsByCategory[error.category] = (stats.errorsByCategory[error.category] || 0) + 1;
        stats.errorsByCipher[error.cipherName] = (stats.errorsByCipher[error.cipherName] || 0) + 1;
      });
      
      return stats;
    },
    
    /**
     * Clear error history
     */
    clearErrorHistory: function() {
      this.errorHistory = [];
      this.performanceMetrics = {};
    },
    
    /**
     * Configure error handler
     * @param {Object} newConfig - New configuration options
     */
    configure: function(newConfig) {
      Object.assign(this.config, newConfig);
    }
  };
  
  // Export error handler and constants
  global.CipherErrorHandler = CipherErrorHandler;
  global.ErrorSeverity = ErrorSeverity;
  global.ErrorCategories = ErrorCategories;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CipherErrorHandler: CipherErrorHandler,
      ErrorSeverity: ErrorSeverity,
      ErrorCategories: ErrorCategories
    };
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);