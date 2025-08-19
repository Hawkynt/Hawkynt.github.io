/*
 * Universal Cipher System
 * Compatible with both Browser and Node.js environments
 * This class only manages the cipher algorithms.
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Create Cipher object
  const Cipher = {
    // Array of known Ciphers
    ciphers: {},
    
    // Check if cipher exists
    ExistsCipherByName: function(name) {
      return !!(Cipher.ciphers[name]);
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
        global.throwException('Class Already Exists Exception', cipher.name, 'Cipher', 'Cipher.Add');
        return false;
      }
      
      // Register cipher
      Cipher.ciphers[cipher.name] = cipher;
      
      // Initialize cipher if it has an Init method
      if (typeof cipher.Init === 'function' && !cipher.isInitialized) {
        try {
          cipher.Init();
        } catch (e) {
          console.warn(`Failed to initialize cipher ${cipher.name}:`, e.message);
        }
      }
      
      console.log(`✅[Cipher.Add] Registered cipher: ${cipher.name} (${cipher.category || 'unknown'})`);
      return true;
    },

    // Alias for compatibility with test runner
    GetCiphers: function() {
      return Object.keys(Cipher.ciphers);
    },
    
    // Add GetCipher alias for compatibility with test runner
    GetCipherByName: function(name) {
      if (Cipher.ciphers[name]) {
        return Cipher.ciphers[name];
      } else {
        global.throwException('Unknown Cipher Exception', name, 'Cipher', 'Cipher.GetCipherByName');
        return null;
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