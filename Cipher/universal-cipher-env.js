/*
 * Universal Cipher Environment
 * Cross-platform compatibility layer for Browser and Node.js
 * (c)2006-2025 Hawkynt - Updated for modern compatibility
 */

(function(global) {
  'use strict';
  
  // Optimized environment detection
  const hasModule = typeof module !== 'undefined';
  const hasWindow = typeof window !== 'undefined';
  const hasGlobal = typeof global !== 'undefined';
  const hasProcess = typeof process !== 'undefined';
  
  const isNode = hasModule && hasProcess && !hasWindow;
  const isBrowser = hasWindow && typeof document !== 'undefined';
  const isWebWorker = !hasWindow && typeof importScripts !== 'undefined';
  const isElectron = hasProcess && hasWindow && process.type;
  
  // Create universal environment object
  const env = {
    isNode: isNode,
    isBrowser: isBrowser,
    isWebWorker: isWebWorker,
    isElectron: isElectron,
    hasRequire: typeof require !== 'undefined',
    hasConsole: typeof console !== 'undefined',
    hasCrypto: typeof crypto !== 'undefined',
    
    // Performance hints
    supportsTypedArrays: typeof Uint8Array !== 'undefined',
    supportsArrayBuffer: typeof ArrayBuffer !== 'undefined',
    supportsWorkers: typeof Worker !== 'undefined',
    
    // Capability detection
    getEnvironmentInfo: function() {
      return {
        platform: isNode ? (process.platform || 'unknown') : 'browser',
        engine: this.getJSEngine(),
        version: this.getVersion(),
        memory: this.getMemoryInfo()
      };
    },
    
    getJSEngine: function() {
      if (isNode) return `Node.js ${process.version || 'unknown'}`;
      if (isBrowser) {
        const ua = navigator.userAgent || '';
        if (ua.includes('Chrome')) return 'Chrome/V8';
        if (ua.includes('Firefox')) return 'Firefox/SpiderMonkey';
        if (ua.includes('Safari')) return 'Safari/JavaScriptCore';
        if (ua.includes('Edge')) return 'Edge/Chakra';
      }
      return 'Unknown';
    },
    
    getVersion: function() {
      if (isNode && process.versions) {
        return `Node.js ${process.versions.node}, V8 ${process.versions.v8}`;
      }
      if (isBrowser && navigator.appVersion) {
        return navigator.appVersion;
      }
      return 'Unknown';
    },
    
    getMemoryInfo: function() {
      if (isNode && process.memoryUsage) {
        const mem = process.memoryUsage();
        return {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
        };
      }
      if (isBrowser && performance.memory) {
        return {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        };
      }
      return null;
    }
  };
  
  // Set up global context
  if (isNode) {
    // Node.js environment
    global.window = global;
    global.document = {
      readyState: 'complete',
      addEventListener: () => {},
      getElementById: () => null,
      createElement: () => ({ style: {} }),
      forms: {},
      getElementsByTagName: () => []
    };
    global.console = console;
    global.objectInstances = [];
  } else if (isBrowser) {
    // Browser environment - ensure XObjectInstances exists
    if (!global.objectInstances) {
      global.objectInstances = [];
    }
  }
  
  // Universal utility functions
  global.generateUniqueID = function() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) + 
           Date.now().toString(36);
  };
  
  global.throwException = function(szErrorType, szParam, szClass, szMethod) {
    const errorMsg = `${szErrorType} in ${szClass}.${szMethod}(): ${szParam}`;
    if (env.isNode) {
      console.error('Cipher Error:', errorMsg);
      throw new Error(errorMsg);
    } else {
      console.error('Cipher Error:', errorMsg);
      // In browser, we'll log but not throw to maintain compatibility
    }
  };
  
  // String extensions (safe check)
  if (!String.prototype.trim) {
    String.prototype.trim = function() {
      return this.replace(/(^\s+|\s+$)/g, '');
    };
  }
  
  // Meta content getter (simplified for universal use)
  global.getMetaContent = function(name, defaultValue) {
    if (isBrowser && document.getElementsByTagName) {
      try {
        const metas = document.getElementsByTagName('meta');
        for (let i = 0; i < metas.length; i++) {
          if (metas[i].name && metas[i].name.toLowerCase() === name.toLowerCase()) {
            return metas[i].content;
          }
        }
      } catch (e) {
        // Ignore errors in meta reading
      }
    }
    return defaultValue || '';
  };
  
  // Simplified DOM functions for Node compatibility
  global.removeScripts = global.removeScripts || function() {
    // No-op in Node.js, functional in browser
    if (isBrowser && document.getElementsByTagName) {
      try {
        const scripts = document.getElementsByTagName('script');
        for (let i = scripts.length - 1; i >= 0; i--) {
          if (scripts[i].parentNode) {
            scripts[i].parentNode.removeChild(scripts[i]);
          }
        }
      } catch (e) {
        // Ignore DOM errors
      }
    }
  };
  
  // Export environment info
  global.CipherEnv = env;
  
  // Node.js module export
  if (isNode && module.exports) {
    module.exports = {
      env: env,
      setupGlobals: () => {
        // Globals are already set up above
      }
    };
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);