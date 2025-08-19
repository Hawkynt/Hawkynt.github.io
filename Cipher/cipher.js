/*
 * Universal Cipher System
 * Compatible with both Browser and Node.js environments
 * Based on original cipher.js but modernized for cross-platform use
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Ensure environment is set up
  if (typeof global.objectInstances === 'undefined') {
    global.objectInstances = [];
  }
  
  // Create Cipher object
  const Cipher = {
    // Array of known Ciphers
    ciphers: {},
    // Instances of Cipher Wrapper  
    instances: {},
    
    // Check if cipher exists
    existsCipher: function(cipherName) {
      return !!(Cipher.ciphers[cipherName]);
    },
    
    // Legacy alias for compatibility
    boolExistsCipher: function(cipherName) {
      return this.existsCipher(cipherName);
    },
    
    // Get cipher object
    getCipher: function(cipherName) {
      if (Cipher.ciphers[cipherName]) {
        return Cipher.ciphers[cipherName];
      } else {
        global.throwException('Unknown Cipher Exception', cipherName, 'Cipher', 'getCipher');
        return null;
      }
    },
    
    // Legacy alias for compatibility
    objGetCipher: function(cipherName) {
      return this.getCipher(cipherName);
    },
    
    // Add cipher to registry
    Add: function(cipher) {
      
      // Validate cipher object (need to match CONTRIBUTING.md)
      const requiredProps = ['name','category'];
      
      // Category-specific validation for properties and functions
      const categoryRequirements = {
        'cipher': {
          properties: ['subCategory', 'description'],
          functions: ['KeySetup', 'EncryptBlock', 'DecryptBlock'],
          subCategories: ['Block Cipher', 'Stream Cipher', 'Classical Cipher', 'Asymmetric Cipher']
        },
        'hash': {
          properties: ['subCategory', 'description'],
          functions: ['Hash'],
          subCategories: ['Cryptographic Hash', 'Fast Hash', 'Specialized Hash']
        },
        'checksum': {
          properties: ['subCategory', 'description'],
          functions: ['Hash'],
          subCategories: ['CRC Family', 'Simple Checksum', 'Network Checksum']
        },
        'compression': {
          properties: ['subCategory', 'description'],
          functions: ['Compress', 'Decompress'],
          subCategories: ['Dictionary', 'Statistical', 'Transform', 'Modern']
        },
        'encodingScheme': {
          properties: ['subCategory', 'description'],
          functions: ['Encode', 'Decode'],
          subCategories: ['Base Encoding', 'Text Encoding', 'Binary Encoding', 'Specialized']
        },
        'keyDerivation': {
          properties: ['subCategory', 'description'],
          functions: ['DeriveKey'],
          subCategories: ['Password-Based', 'Key-Based', 'Function-Based']
        },
        'modeOfOperation': {
          properties: ['subCategory', 'description'],
          functions: ['EncryptBlock', 'DecryptBlock'],
          subCategories: ['Confidentiality Mode', 'Authenticated Mode', 'Format Preserving', 'Key Wrapping']
        },
        'paddingScheme': {
          properties: ['subCategory', 'description'],
          functions: ['Pad', 'Unpad'],
          subCategories: ['Block Padding', 'Signature Padding', 'Encryption Padding', 'Bit Padding']
        },
        'errorCorrection': {
          properties: ['subCategory', 'description'],
          functions: ['Encode', 'Decode'],
          subCategories: ['Block Code', 'Convolutional', 'LDPC', 'Linear Code']
        },
        'randomNumberGenerator': {
          properties: ['subCategory', 'description'],
          functions: ['Generate', 'Seed'],
          subCategories: ['CSPRNG', 'PRNG', 'Hardware RNG', 'Stream Cipher RNG']
        }
      };

      // Check basic required properties
      for (const prop of requiredProps) {
        if (cipher[prop] === undefined) {
          global.throwException(`Missing ${prop} Exception`, cipher.name || 'Unknown', 'Cipher', 'Cipher.Add');
          return false;
        }
      }
      
      // Check category-specific requirements
      const categoryReq = categoryRequirements[cipher.category];
      if (categoryReq) {
        // Check required properties for this category
        for (const prop of categoryReq.properties) {
          if (cipher[prop] === undefined) {
            global.throwException(`Missing ${prop} for ${cipher.category} Exception`, cipher.name || 'Unknown', 'Cipher', 'Cipher.Add');
            return false;
          }
        }
        
        // Validate subCategory if defined
        if (cipher.subCategory && categoryReq.subCategories && !categoryReq.subCategories.includes(cipher.subCategory)) {
          global.throwException(`Invalid subCategory Exception`, 
            `${cipher.subCategory} is not valid for category ${cipher.category}. Valid options: ${categoryReq.subCategories.join(', ')}`, 
            'Cipher', 'AddCipher');
          return false;
        }
        
        // Check required functions for this category
        for (const funcName of categoryReq.functions) {
          if (typeof cipher[funcName] !== 'function') {
            global.throwException(`Missing ${funcName} Function Exception`, 
              `${cipher.category} algorithms must implement ${funcName}() function`, 
              'Cipher', 'AddCipher');
            return false;
          }
        }
      } else {
        // Unknown category - issue warning but allow
        console.warn(`Warning: Unknown category '${cipher.category}' for cipher '${cipher.name}'. Valid categories: ${Object.keys(categoryRequirements).join(', ')}`);
      }
      
      if (Cipher.ciphers[cipher.name]) {
        global.throwException('Class Already Exists Exception', cipher.name, 'Cipher', 'AddCipher');
        return false;
      }
      
      // Register cipher
      Cipher.ciphers[cipher.internalName] = cipher;
      
      // Initialize cipher if it has an Init method
      if (typeof cipher.Init === 'function' && !cipher.isInitialized) {
        try {
          cipher.Init();
        } catch (e) {
          console.warn(`Failed to initialize cipher ${cipher.name}:`, e.message);
        }
      }
      
      return true;
    },

    // Get list of available ciphers
    getCiphers: function() {
      return Object.keys(Cipher.ciphers);
    },
    
    // Alias for compatibility with test runner
    GetCiphers: function() {
      return Object.keys(Cipher.ciphers);
    },
    
    // Add GetCipher alias for compatibility with test runner
    GetCipher: function(cipherName) {
      return this.getCipher(cipherName);
    },
    
    // RegisterCipher method for new individual algorithm files
    RegisterCipher: function(name, implementation) {
      // Create a simplified cipher object compatible with the old system
      const cipher = {
        internalName: name,
        name: implementation.szName || name,
        minKeyLength: 1,
        maxKeyLength: 512,
        stepKeyLength: 1,
        minBlockSize: 1,
        maxBlockSize: 512,
        stepBlockSize: 1,
        szCategory: implementation.szCategory || 'unknown',
        szCountry: implementation.szCountry || 'International', 
        nYear: implementation.nYear || null,
        working: implementation.working !== false,
        metadata: implementation.metadata,
        
        // Store the implementation for access by the controller
        implementation: implementation,
        
        // Create minimal instances lookup
        instances: {
          [name]: implementation
        }
      };
      
      // Register using the existing AddCipher method
      Cipher.ciphers[name] = cipher;
      console.log(`✅ Registered cipher: ${name} (${implementation.szCategory || 'unknown'})`);
      return true;
    },
    
    // Initialize cipher with key
    InitCipher: function(cipherName, key) {
      if (!Cipher.existsCipher(cipherName)) {
        global.throwException('Unknown Cipher Exception', cipherName, 'Cipher', 'InitCipher');
        return undefined;
      }
      
      const objUsedCipher = Cipher.ciphers[cipherName];
      let processedKey = key || '';
      
      // Generate unique ID
      let id;
      do {
        id = 'Cipher[' + global.generateUniqueID() + ']';
      } while (Cipher.instances[id] || global.objectInstances[id]);
      
      // Store instance info
      Cipher.instances[id] = {
        cipherName: cipherName,
        usedCipher: usedCipher,
        externalKey: key || '',
        internalKey: '',
        ciphersID: null
      };
      global.objectInstances[id] = true;
      
      // Process key according to cipher requirements
      processedKey = Cipher._processKey(processedKey, usedCipher);
      Cipher.instances[id].internalKey = processedKey;
      
      // Validate key length
      if (!Cipher._validateKeyLength(processedKey, usedCipher)) {
        delete Cipher.instances[id];
        delete global.objectInstances[id];
        return undefined;
      }
      
      // Initialize cipher with processed key
      try {
        Cipher.instances[id].ciphersID = usedCipher.KeySetup(processedKey);
        return id;
      } catch (e) {
        delete Cipher.instances[id];
        delete global.objectInstances[id];
        global.throwException('Cipher Initialization Failed', e.message, 'Cipher', 'InitCipher');
        return undefined;
      }
    },
    
    // Process key according to cipher requirements
    _processKey: function(key, cipher) {
      let processedKey = key;
      
      // Extend key if too short
      if (cipher.minKeyLength > 0) {
        while (processedKey.length < cipher.minKeyLength && key.length > 0) {
          processedKey += key;
        }
      }
      
      // Truncate key if too long
      if (cipher.maxKeyLength > 0 && processedKey.length > cipher.maxKeyLength) {
        processedKey = processedKey.substr(0, cipher.maxKeyLength);
      }
      
      // Handle key stepping
      if (cipher.stepKeyLength > 1) {
        const modulo = (processedKey.length - cipher.minKeyLength) % cipher.stepKeyLength;
        if (modulo > 0) {
          if ((processedKey.length - modulo) < cipher.minKeyLength) {
            // Pad up
            processedKey += key.substr(0, cipher.stepKeyLength - modulo);
          } else {
            // Truncate down
            processedKey = processedKey.substr(0, processedKey.length - modulo);
          }
        }
      }
      
      return processedKey;
    },
    
    // Validate key length
    _validateKeyLength: function(key, cipher) {
      const keyLen = key.length;
      const minLen = cipher.minKeyLength;
      const maxLen = cipher.maxKeyLength;
      
      if (minLen > 0 && keyLen < minLen) {
        global.throwException('Invalid Key Length Exception', 
          `Key Length is ${keyLen * 8} Bits, but must be at least ${minLen * 8} Bits`, 
          'Cipher', 'InitCipher');
        return false;
      }
      
      if (maxLen > 0 && keyLen > maxLen) {
        global.throwException('Invalid Key Length Exception', 
          `Key Length is ${keyLen * 8} Bits, but must be at most ${maxLen * 8} Bits`, 
          'Cipher', 'InitCipher');
        return false;
      }
      
      return true;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Cipher.instances[id]) {
        try {
          if (Cipher.instances[id].usedCipher.ClearData) {
            Cipher.instances[id].usedCipher.ClearData(Cipher.instances[id].ciphersID);
          }
        } catch (e) {
          console.warn('Error clearing cipher data:', e.message);
        }
        
        delete Cipher.instances[id];
        delete global.objectInstances[id];
        return true;
      }
      return false;
    },
    
    // Encrypt data
    encrypt: function(id, inputBuffer, optional_mode) {
      const mode = (optional_mode || 'ECB').toUpperCase();
      
      if (!Cipher.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Cipher', 'encrypt');
        return inputBuffer;
      }
      
      const currentCipher = Cipher.instances[id].usedCipher;
      
      if (mode === 'ECB') {
        return Cipher._encryptECB(id, inputBuffer, currentCipher);
      } else {
        global.throwException('Unknown Block Mode Exception', mode, 'Cipher', 'encrypt');
        return inputBuffer;
      }
    },
    
    // Legacy alias for compatibility
    szEncrypt: function(id, inputBuffer, optional_mode) {
      return this.encrypt(id, inputBuffer, optional_mode);
    },
    
    // ECB encryption mode
    _encryptECB: function(id, inputBuffer, currentCipher) {
      let result = '';
      
      if (currentCipher.maxBlockSize === 0) {
        // Stream cipher or variable block size
        return Cipher.encryptBlock(id, inputBuffer);
      }
      
      let i = 0;
      while (i < inputBuffer.length) {
        const bytesLeft = inputBuffer.length - i;
        let block;
        
        if (bytesLeft >= currentCipher.maxBlockSize) {
          // Full block
          block = inputBuffer.substr(i, currentCipher.maxBlockSize);
          i += currentCipher.maxBlockSize;
        } else {
          // Partial block - pad with zeros
          block = inputBuffer.substr(i);
          i = inputBuffer.length;
          
          // Pad to minimum block size
          while (block.length < currentCipher.minBlockSize) {
            block += String.fromCharCode(0);
          }
          
          // Pad according to step size
          if (currentCipher.stepBlockSize > 1) {
            const modulo = (block.length - currentCipher.minBlockSize) % currentCipher.stepBlockSize;
            if (modulo > 0) {
              const padding = currentCipher.stepBlockSize - modulo;
              for (let p = 0; p < padding; p++) {
                block += String.fromCharCode(0);
              }
            }
          }
        }
        
        result += Cipher.encryptBlock(id, block);
      }
      
      return result;
    },
    
    // Decrypt data
    decrypt: function(id, inputBuffer, optional_mode) {
      const mode = (optional_mode || 'ECB').toUpperCase();
      
      if (!Cipher.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Cipher', 'decrypt');
        return inputBuffer;
      }
      
      const currentCipher = Cipher.instances[id].usedCipher;
      
      if (mode === 'ECB') {
        return Cipher._decryptECB(id, inputBuffer, currentCipher);
      } else {
        global.throwException('Unknown Block Mode Exception', mode, 'Cipher', 'decrypt');
        return inputBuffer;
      }
    },
    
    // Legacy alias for compatibility
    szDecrypt: function(id, inputBuffer, optional_mode) {
      return this.decrypt(id, inputBuffer, optional_mode);
    },
    
    // ECB decryption mode
    _decryptECB: function(id, inputBuffer, currentCipher) {
      let result = '';
      
      if (currentCipher.maxBlockSize === 0) {
        return Cipher.decryptBlock(id, inputBuffer);
      }
      
      let i = 0;
      while (i < inputBuffer.length) {
        const bytesLeft = inputBuffer.length - i;
        let block;
        
        if (bytesLeft >= currentCipher.maxBlockSize) {
          block = inputBuffer.substr(i, currentCipher.maxBlockSize);
          i += currentCipher.maxBlockSize;
        } else {
          block = inputBuffer.substr(i);
          i = inputBuffer.length;
          
          while (block.length < currentCipher.minBlockSize) {
            block += String.fromCharCode(0);
          }
        }
        
        result += Cipher.decryptBlock(id, block);
      }
      
      return result;
    },
    
    // Encrypt single block
    encryptBlock: function(id, block) {
      if (!Cipher.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Cipher', 'encryptBlock');
        return block;
      }
      
      try {
        return Cipher.instances[id].usedCipher.encryptBlock(
          Cipher.instances[id].ciphersID, 
          block
        );
      } catch (e) {
        global.throwException('Encryption Error', e.message, 'Cipher', 'encryptBlock');
        return block;
      }
    },
    
    // Decrypt single block
    decryptBlock: function(id, block) {
      if (!Cipher.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Cipher', 'decryptBlock');
        return block;
      }
      
      try {
        return Cipher.instances[id].usedCipher.decryptBlock(
          Cipher.instances[id].ciphersID, 
          block
        );
      } catch (e) {
        global.throwException('Decryption Error', e.message, 'Cipher', 'decryptBlock');
        return block;
      }
    }
  };
  
  // Export to global scope
  global.Cipher = Cipher;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cipher;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);