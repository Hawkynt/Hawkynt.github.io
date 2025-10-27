/*
 * Debug Configuration Module
 * Centralized debug mode control via URL parameter ?debug=true
 * Zero dependencies, works in both browser and Node.js
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  // Parse URL parameters (browser only)
  function getURLParameter(name) {
    if (typeof window === 'undefined' || !window.location) {
      return null;
    }

    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  // Determine if debug mode is enabled
  const isDebugMode = (function() {
    // Check URL parameter first (browser)
    const urlDebug = getURLParameter('debug');
    if (urlDebug === 'true' || urlDebug === '1') {
      return true;
    }

    // Check environment variable (Node.js)
    if (typeof process !== 'undefined' && process.env && process.env.DEBUG) {
      return process.env.DEBUG === 'true' || process.env.DEBUG === '1';
    }

    // Check localStorage (browser, persists across page loads)
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('debugMode');
        if (stored === 'true' || stored === '1') {
          return true;
        }
      } catch (e) {
        // localStorage might be blocked
      }
    }

    // Default: disabled
    return false;
  })();

  // Debug logging API
  const DebugConfig = {
    /**
     * Check if debug mode is enabled
     * @returns {boolean}
     */
    isEnabled: function() {
      return isDebugMode;
    },

    /**
     * Debug log - only outputs if debug mode is enabled
     * @param {...any} args - Arguments to log
     */
    log: function(...args) {
      if (isDebugMode && console && console.log) {
        console.log('[DEBUG]', ...args);
      }
    },

    /**
     * Debug warning - only outputs if debug mode is enabled
     * @param {...any} args - Arguments to warn
     */
    warn: function(...args) {
      if (isDebugMode && console && console.warn) {
        console.warn('[DEBUG]', ...args);
      }
    },

    /**
     * Debug error - always outputs (errors should always be visible)
     * @param {...any} args - Arguments to error
     */
    error: function(...args) {
      if (console && console.error) {
        console.error('[ERROR]', ...args);
      }
    },

    /**
     * Debug info - only outputs if debug mode is enabled
     * @param {...any} args - Arguments to info
     */
    info: function(...args) {
      if (isDebugMode && console && console.info) {
        console.info('[DEBUG]', ...args);
      }
    },

    /**
     * Always log (even when debug mode is disabled)
     * Use sparingly for critical user-facing messages
     * @param {...any} args - Arguments to log
     */
    always: function(...args) {
      if (console && console.log) {
        console.log(...args);
      }
    },

    /**
     * Enable/disable debug mode programmatically
     * Only works in browser with localStorage
     * @param {boolean} enabled
     */
    setEnabled: function(enabled) {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('debugMode', enabled ? 'true' : 'false');
          console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}. Reload page for changes to take effect.`);
        } catch (e) {
          console.warn('Cannot persist debug mode setting:', e.message);
        }
      }
    }
  };

  // Show debug mode status on load (browser only)
  if (typeof window !== 'undefined' && isDebugMode) {
    console.log('%c[DEBUG MODE ENABLED]', 'color: #00ff00; font-weight: bold; font-size: 14px;');
    console.log('To disable: remove ?debug=true from URL or run DebugConfig.setEnabled(false)');
  }

  // Export for different module systems
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js/CommonJS
    module.exports = DebugConfig;
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define([], function() { return DebugConfig; });
  } else {
    // Browser global
    global.DebugConfig = DebugConfig;
  }

})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
