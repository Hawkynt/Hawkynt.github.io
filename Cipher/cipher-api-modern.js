/*
 * Modern Cipher API (without Hungarian notation)
 * Compatible with both Browser and Node.js environments
 * Designed for upcoming algorithm implementations
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Ensure environment is set up
  if (typeof global.instances === 'undefined') {
    global.instances = {};
  }
  
  // Create modern Cipher object
  const Cipher = {
    // Registry of available ciphers
    algorithms: {},
    // Active cipher instances
    instances: {},
    
    // Check if cipher exists
    exists: function(name) {
      return !!(Cipher.algorithms[name]);
    },
    
    // Get cipher object
    get: function(name) {
      if (Cipher.algorithms[name]) {
        return Cipher.algorithms[name];
      } else {
        throw new Error(`Unknown cipher: ${name}`);
      }
    },
    
    // Register new cipher algorithm
    register: function(algorithm) {
      // Validate algorithm object
      const requiredProps = [
        'name', 'displayName', 'minKeyLength', 'maxKeyLength', 
        'stepKeyLength', 'minBlockSize', 'maxBlockSize', 'stepBlockSize'
      ];
      
      for (const prop of requiredProps) {
        if (algorithm[prop] === undefined) {
          throw new Error(`Missing property ${prop} in cipher ${algorithm.displayName || 'Unknown'}`);
        }
      }
      
      const requiredMethods = ['init', 'createKey', 'encrypt', 'decrypt', 'destroy'];
      for (const method of requiredMethods) {
        if (typeof algorithm[method] !== 'function') {
          throw new Error(`Missing method ${method} in cipher ${algorithm.displayName}`);
        }
      }
      
      if (!algorithm.instances) {
        throw new Error(`Missing instances storage in cipher ${algorithm.displayName}`);
      }
      
      if (Cipher.algorithms[algorithm.name]) {
        throw new Error(`Cipher ${algorithm.displayName} already registered`);
      }
      
      // Register algorithm
      Cipher.algorithms[algorithm.name] = algorithm;
      
      // Initialize algorithm if needed
      if (!algorithm.initialized) {
        try {
          algorithm.init();
          algorithm.initialized = true;
        } catch (e) {
          console.warn(`Failed to initialize cipher ${algorithm.displayName}:`, e.message);
        }
      }
      
      return true;
    },
    
    // Get list of available ciphers
    list: function() {
      return Object.keys(Cipher.algorithms);
    },
    
    // Get detailed cipher information
    info: function(name) {
      const algorithm = Cipher.get(name);
      return {
        name: algorithm.name,
        displayName: algorithm.displayName,
        description: algorithm.description || 'No description available',
        keyLength: {
          min: algorithm.minKeyLength,
          max: algorithm.maxKeyLength,
          step: algorithm.stepKeyLength
        },
        blockSize: {
          min: algorithm.minBlockSize,
          max: algorithm.maxBlockSize,
          step: algorithm.stepBlockSize
        },
        type: algorithm.type || 'Unknown',
        source: algorithm.source || 'Unknown',
        initialized: algorithm.initialized || false
      };
    },
    
    // Create cipher instance with key
    create: function(name, key, options = {}) {
      if (!Cipher.exists(name)) {
        throw new Error(`Unknown cipher: ${name}`);
      }
      
      const algorithm = Cipher.algorithms[name];
      
      // Validate key length
      if (key && (key.length < algorithm.minKeyLength || key.length > algorithm.maxKeyLength)) {
        throw new Error(`Invalid key length for ${name}: got ${key.length}, expected ${algorithm.minKeyLength}-${algorithm.maxKeyLength}`);
      }
      
      // Generate unique ID
      let id;
      do {
        id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      } while (Cipher.instances[id] || global.instances[id]);
      
      // Create key using algorithm's method
      const keyId = algorithm.createKey(key || '');
      if (!keyId) {
        throw new Error(`Failed to create key for cipher ${name}`);
      }
      
      // Store instance info
      Cipher.instances[id] = {
        algorithm: algorithm,
        keyId: keyId,
        name: name,
        created: Date.now(),
        options: options
      };
      
      global.instances[id] = true;
      return id;
    },
    
    // Encrypt data
    encrypt: function(instanceId, plaintext, options = {}) {
      const instance = Cipher.instances[instanceId];
      if (!instance) {
        throw new Error(`Unknown instance: ${instanceId}`);
      }
      
      try {
        return instance.algorithm.encrypt(instance.keyId, plaintext, options);
      } catch (e) {
        throw new Error(`Encryption failed: ${e.message}`);
      }
    },
    
    // Decrypt data
    decrypt: function(instanceId, ciphertext, options = {}) {
      const instance = Cipher.instances[instanceId];
      if (!instance) {
        throw new Error(`Unknown instance: ${instanceId}`);
      }
      
      try {
        return instance.algorithm.decrypt(instance.keyId, ciphertext, options);
      } catch (e) {
        throw new Error(`Decryption failed: ${e.message}`);
      }
    },
    
    // Clean up cipher instance
    destroy: function(instanceId) {
      const instance = Cipher.instances[instanceId];
      if (!instance) {
        return false;
      }
      
      // Clean up algorithm-specific data
      try {
        instance.algorithm.destroy(instance.keyId);
      } catch (e) {
        console.warn(`Failed to clean up cipher instance ${instanceId}:`, e.message);
      }
      
      // Remove from registries
      delete Cipher.instances[instanceId];
      delete global.instances[instanceId];
      
      return true;
    },
    
    // Batch operations for multiple instances
    batch: {
      // Create multiple instances
      create: function(configs) {
        const instances = [];
        for (const config of configs) {
          try {
            const id = Cipher.create(config.name, config.key, config.options);
            instances.push({ id, name: config.name, success: true });
          } catch (e) {
            instances.push({ name: config.name, success: false, error: e.message });
          }
        }
        return instances;
      },
      
      // Destroy multiple instances
      destroy: function(instanceIds) {
        const results = [];
        for (const id of instanceIds) {
          results.push({ id, success: Cipher.destroy(id) });
        }
        return results;
      }
    },
    
    // Utility functions
    utils: {
      // Validate key for specific cipher
      validateKey: function(name, key) {
        const algorithm = Cipher.get(name);
        return key.length >= algorithm.minKeyLength && 
               key.length <= algorithm.maxKeyLength;
      },
      
      // Generate random key for cipher
      generateKey: function(name, length = null) {
        const algorithm = Cipher.get(name);
        const keyLength = length || algorithm.minKeyLength;
        
        if (keyLength < algorithm.minKeyLength || keyLength > algorithm.maxKeyLength) {
          throw new Error(`Invalid key length: ${keyLength}`);
        }
        
        const key = new Array(keyLength);
        for (let i = 0; i < keyLength; i++) {
          key[i] = String.fromCharCode(Math.floor(Math.random() * 256));
        }
        return key.join('');
      },
      
      // Get cipher statistics
      stats: function() {
        return {
          totalAlgorithms: Object.keys(Cipher.algorithms).length,
          activeInstances: Object.keys(Cipher.instances).length,
          algorithms: Object.keys(Cipher.algorithms).map(name => ({
            name,
            displayName: Cipher.algorithms[name].displayName,
            initialized: Cipher.algorithms[name].initialized || false
          }))
        };
      }
    }
  };
  
  // Export to global scope
  global.CipherModern = Cipher;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cipher;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);