#!/usr/bin/env node
/*
 * Multi-Language Code Generator
 * Centralized system for converting algorithm implementations to multiple target languages
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  const MultiLanguageGenerator = {
    
    /**
     * Supported target languages with metadata
     */
    supportedLanguages: {
      'javascript': { 
        name: 'JavaScript', 
        extension: '.js', 
        icon: '🟨',
        description: 'ECMAScript/JavaScript implementation',
        mimeType: 'application/javascript'
      },
      'python': { 
        name: 'Python', 
        extension: '.py', 
        icon: '🐍',
        description: 'Python 3.x implementation',
        mimeType: 'text/x-python'
      },
      'cpp': { 
        name: 'C++', 
        extension: '.cpp', 
        icon: '⚡',
        description: 'C++17 compatible implementation',
        mimeType: 'text/x-c++src'
      },
      'java': { 
        name: 'Java', 
        extension: '.java', 
        icon: '☕',
        description: 'Java 8+ compatible implementation',
        mimeType: 'text/x-java'
      },
      'rust': { 
        name: 'Rust', 
        extension: '.rs', 
        icon: '🦀',
        description: 'Rust 2021 edition implementation',
        mimeType: 'text/x-rust'
      },
      'csharp': { 
        name: 'C#', 
        extension: '.cs', 
        icon: '💻',
        description: 'C# .NET implementation',
        mimeType: 'text/x-csharp'
      },
      'kotlin': { 
        name: 'Kotlin', 
        extension: '.kt', 
        icon: '🎯',
        description: 'Kotlin multiplatform implementation',
        mimeType: 'text/x-kotlin'
      },
      'perl': { 
        name: 'Perl', 
        extension: '.pl', 
        icon: '🐪',
        description: 'Perl 5 implementation',
        mimeType: 'text/x-perl'
      },
      'freebasic': { 
        name: 'FreeBASIC', 
        extension: '.bas', 
        icon: '📚',
        description: 'FreeBASIC implementation',
        mimeType: 'text/x-basic'
      },
      'delphi': { 
        name: 'Delphi', 
        extension: '.pas', 
        icon: '🏛️',
        description: 'Object Pascal/Delphi implementation',
        mimeType: 'text/x-pascal'
      },
      'go': { 
        name: 'Go', 
        extension: '.go', 
        icon: '🐹',
        description: 'Go language implementation',
        mimeType: 'text/x-go'
      }
    },

    /**
     * Convert algorithm to target language
     * @param {string} targetLanguage - Target language key
     * @param {Object} algorithm - Algorithm object with implementation
     * @param {Object} options - Generation options
     * @returns {string} Generated code in target language
     */
    convertAlgorithm: function(targetLanguage, algorithm, options = {}) {
      if (!this.supportedLanguages[targetLanguage]) {
        throw new Error(`Unsupported target language: ${targetLanguage}`);
      }

      if (!algorithm) {
        throw new Error('Algorithm object is required');
      }

      // Default options
      const defaultOptions = {
        includeComments: true,
        includeTests: false,
        includeExamples: true,
        standalone: false
      };
      
      const finalOptions = { ...defaultOptions, ...options };
      
      // Extract algorithm implementation details
      const implementation = this._extractAlgorithmImplementation(algorithm);
      const algorithmName = algorithm.internalName || algorithm.name || 'unknown';
      const displayName = algorithm.name || algorithmName;
      
      // Generate code based on target language
      switch (targetLanguage) {
        case 'javascript':
          return this._generateJavaScript(algorithmName, displayName, finalOptions, implementation);
        case 'python':
          return this._generatePython(algorithmName, displayName, finalOptions, implementation);
        case 'cpp':
          return this._generateCPlusPlus(algorithmName, displayName, finalOptions, implementation);
        case 'java':
          return this._generateJava(algorithmName, displayName, finalOptions, implementation);
        case 'rust':
          return this._generateRust(algorithmName, displayName, finalOptions, implementation);
        case 'csharp':
          return this._generateCSharp(algorithmName, displayName, finalOptions, implementation);
        case 'kotlin':
          return this._generateKotlin(algorithmName, displayName, finalOptions, implementation);
        case 'perl':
          return this._generatePerl(algorithmName, displayName, finalOptions, implementation);
        case 'freebasic':
          return this._generateFreeBASIC(algorithmName, displayName, finalOptions, implementation);
        case 'delphi':
          return this._generateDelphi(algorithmName, displayName, finalOptions, implementation);
        case 'go':
          return this._generateGo(algorithmName, displayName, finalOptions, implementation);
        default:
          throw new Error(`Code generator not implemented for: ${targetLanguage}`);
      }
    },

    /**
     * Get list of supported languages
     * @returns {Array} Array of language objects with keys and metadata
     */
    getSupportedLanguages: function() {
      return Object.entries(this.supportedLanguages).map(([key, lang]) => ({
        key,
        ...lang
      }));
    },

    /**
     * Get language info by key
     * @param {string} languageKey - Language key
     * @returns {Object|null} Language metadata or null if not found
     */
    getLanguageInfo: function(languageKey) {
      return this.supportedLanguages[languageKey] || null;
    },

    /**
     * Check if language is supported
     * @param {string} languageKey - Language key to check
     * @returns {boolean} True if language is supported
     */
    isLanguageSupported: function(languageKey) {
      return languageKey in this.supportedLanguages;
    },

    /**
     * Extract implementation details from algorithm object
     * @private
     */
    _extractAlgorithmImplementation: function(algorithm) {
      const implementation = {
        encryptCode: '',
        decryptCode: '',
        constants: {},
        keySetup: '',
        hasConstants: false,
        algorithmType: '',
        blockSize: algorithm.blockSize || 8,
        keyLength: algorithm.minKeyLength || 16
      };

      try {
        // Determine algorithm type
        if (algorithm.internalName) {
          implementation.algorithmType = algorithm.internalName.toLowerCase();
        }

        // Extract encrypt/decrypt function code with better conversion
        if (algorithm.encryptBlock && typeof algorithm.encryptBlock === 'function') {
          implementation.encryptCode = this._convertAlgorithmFunction(algorithm.encryptBlock, algorithm, 'encrypt');
        }

        if (algorithm.decryptBlock && typeof algorithm.decryptBlock === 'function') {
          implementation.decryptCode = this._convertAlgorithmFunction(algorithm.decryptBlock, algorithm, 'decrypt');
        }

        // Extract constants and algorithm properties
        const constantKeys = Object.keys(algorithm).filter(key => 
          (typeof algorithm[key] === 'string' || typeof algorithm[key] === 'number') && 
          (key.toUpperCase() === key || key.includes('SIZE') || key.includes('LENGTH')) && 
          key.length > 1
        );

        constantKeys.forEach(key => {
          implementation.constants[key] = algorithm[key];
        });

        // Add common algorithm properties as constants
        if (algorithm.blockSize) implementation.constants.BLOCK_SIZE = algorithm.blockSize;
        if (algorithm.minKeyLength) implementation.constants.MIN_KEY_LENGTH = algorithm.minKeyLength;
        if (algorithm.maxKeyLength) implementation.constants.MAX_KEY_LENGTH = algorithm.maxKeyLength;

        implementation.hasConstants = Object.keys(implementation.constants).length > 0;

      } catch (error) {
        console.warn('Failed to extract algorithm implementation:', error);
      }

      return implementation;
    },

    /**
     * Convert algorithm function to a more generic implementation
     * @private
     */
    _convertAlgorithmFunction: function(func, algorithm, operation) {
      try {
        const funcStr = func.toString();
        const algorithmName = algorithm.internalName || algorithm.name || 'cipher';
        
        // Generate a simplified but meaningful implementation
        if (operation === 'encrypt') {
          return `// ${algorithmName} encryption implementation
        // Validate input
        if (!data || data.length !== ${algorithm.blockSize || 8}) {
            throw new Error('Invalid block size for ${algorithmName}');
        }
        
        // Convert input to bytes if needed
        const inputBytes = typeof data === 'string' ? this.stringToBytes(data) : data;
        
        // Perform ${algorithmName} encryption
        // Note: This is a simplified implementation - actual algorithm logic would go here
        const processedBytes = this.processBlock(inputBytes, key, true);
        
        // Return result in appropriate format
        return typeof data === 'string' ? this.bytesToString(processedBytes) : processedBytes;`;
        } else {
          return `// ${algorithmName} decryption implementation
        // Validate input
        if (!data || data.length !== ${algorithm.blockSize || 8}) {
            throw new Error('Invalid block size for ${algorithmName}');
        }
        
        // Convert input to bytes if needed
        const inputBytes = typeof data === 'string' ? this.stringToBytes(data) : data;
        
        // Perform ${algorithmName} decryption
        // Note: This is a simplified implementation - actual algorithm logic would go here
        const processedBytes = this.processBlock(inputBytes, key, false);
        
        // Return result in appropriate format
        return typeof data === 'string' ? this.bytesToString(processedBytes) : processedBytes;`;
        }
      } catch (error) {
        console.warn('Failed to convert algorithm function:', error);
        return `// ${operation} implementation placeholder\nreturn data;`;
      }
    },

    /**
     * Extract function body from JavaScript function
     * @private
     */
    _extractFunctionBody: function(func) {
      try {
        const funcStr = func.toString();
        const match = funcStr.match(/function[^{]*\{([\s\S]*)\}$/);
        if (match) {
          return match[1].trim();
        }
        
        // Handle arrow functions
        const arrowMatch = funcStr.match(/=>\s*\{([\s\S]*)\}$/);
        if (arrowMatch) {
          return arrowMatch[1].trim();
        }
        
        // Handle single expression arrow functions
        const singleExprMatch = funcStr.match(/=>\s*(.+)$/);
        if (singleExprMatch) {
          return `return ${singleExprMatch[1].trim()};`;
        }
        
      } catch (error) {
        console.warn('Failed to extract function body:', error);
      }
      return '';
    },

    /**
     * Generate JavaScript code
     * @private
     */
    _generateJavaScript: function(algorithmName, displayName, options, implementation) {
      const className = this._toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in JavaScript\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      const constants = this._generateJavaScriptConstants(implementation.constants);
      const encryptCode = implementation.encryptCode || `// ${displayName} encryption\nreturn data; // Placeholder`;
      const decryptCode = implementation.decryptCode || `// ${displayName} decryption\nreturn data; // Placeholder`;

      return `${header}/**
 * ${displayName} cryptographic algorithm implementation
 */
class ${className} {
    ${constants}constructor() {
        this.initialized = true;
    }

    /**
     * Encrypts data using ${displayName} algorithm
     * @param {string|Uint8Array} data Data to encrypt
     * @param {string|Uint8Array} key Encryption key
     * @returns {string|Uint8Array} Encrypted data
     */
    encrypt(data, key) {
        if (!this.initialized) {
            throw new Error('Cipher not initialized');
        }
        
        ${encryptCode}
    }

    /**
     * Decrypts data using ${displayName} algorithm
     * @param {string|Uint8Array} data Data to decrypt
     * @param {string|Uint8Array} key Decryption key
     * @returns {string|Uint8Array} Decrypted data
     */
    decrypt(data, key) {
        if (!this.initialized) {
            throw new Error('Cipher not initialized');
        }
        
        ${decryptCode}
    }

    /**
     * Convert string to bytes
     * @private
     */
    stringToBytes(str) {
        return new TextEncoder().encode(str);
    }

    /**
     * Convert bytes to string
     * @private
     */
    bytesToString(bytes) {
        return new TextDecoder().decode(bytes);
    }

    /**
     * Process a block of data (placeholder for actual algorithm logic)
     * @private
     */
    processBlock(inputBytes, key, encrypt) {
        // This is a placeholder - actual implementation would contain
        // the specific cryptographic algorithm logic
        if (encrypt) {
            // Simplified encryption: XOR with key (not cryptographically secure)
            const keyBytes = typeof key === 'string' ? this.stringToBytes(key) : key;
            return inputBytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
        } else {
            // Simplified decryption: same as encryption for XOR
            const keyBytes = typeof key === 'string' ? this.stringToBytes(key) : key;
            return inputBytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.initialized = false;
    }
}

${options.includeExamples ? `// Example usage:
const cipher = new ${className}();
try {
    const encrypted = cipher.encrypt("Hello World", "secret_key");
    const decrypted = cipher.decrypt(encrypted, "secret_key");
    console.log("Original: Hello World");
    console.log("Encrypted:", encrypted);
    console.log("Decrypted:", decrypted);
} finally {
    cipher.dispose();
}` : ''}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ${className};
}`;
    },

    /**
     * Generate Python code
     * @private
     */
    _generatePython: function(algorithmName, displayName, options, implementation) {
      const className = this._toPascalCase(algorithmName);
      const header = options.includeComments ? `# ${displayName} Implementation in Python\n# Generated by SynthelicZ Cipher Tools\n# (c)2006-2025 Hawkynt\n\n` : '';
      
      const constants = this._generatePythonConstants(implementation.constants);
      const encryptCode = this._convertToPython(implementation.encryptCode) || `# ${displayName} encryption\nreturn data  # Placeholder`;
      const decryptCode = this._convertToPython(implementation.decryptCode) || `# ${displayName} decryption\nreturn data  # Placeholder`;

      return `${header}from typing import Union

class ${className}:
    """${displayName} cryptographic algorithm implementation"""
    
    ${constants}def __init__(self):
        """Initialize the cipher"""
        self.initialized = True
    
    def encrypt(self, data: Union[str, bytes], key: Union[str, bytes]) -> Union[str, bytes]:
        """
        Encrypts data using ${displayName} algorithm
        
        Args:
            data: Data to encrypt
            key: Encryption key
            
        Returns:
            Encrypted data
        """
        if not self.initialized:
            raise RuntimeError("Cipher not initialized")
        
        ${encryptCode}
    
    def decrypt(self, data: Union[str, bytes], key: Union[str, bytes]) -> Union[str, bytes]:
        """
        Decrypts data using ${displayName} algorithm
        
        Args:
            data: Data to decrypt
            key: Decryption key
            
        Returns:
            Decrypted data
        """
        if not self.initialized:
            raise RuntimeError("Cipher not initialized")
        
        ${decryptCode}
    
    def dispose(self):
        """Clean up resources"""
        self.initialized = False
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.dispose()

${options.includeExamples ? `if __name__ == "__main__":
    # Example usage
    with ${className}() as cipher:
        encrypted = cipher.encrypt("Hello World", "secret_key")
        decrypted = cipher.decrypt(encrypted, "secret_key")
        
        print(f"Original: Hello World")
        print(f"Encrypted: {encrypted}")
        print(f"Decrypted: {decrypted}")` : ''}`;
    },

    /**
     * Generate C++ code
     * @private
     */
    _generateCPlusPlus: function(algorithmName, displayName, options, implementation) {
      const className = this._toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in C++\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      const constants = this._generateCPlusPlusConstants(implementation.constants);
      const encryptCode = this._convertToCPlusPlus(implementation.encryptCode) || `// ${displayName} encryption\nreturn data; // Placeholder`;
      const decryptCode = this._convertToCPlusPlus(implementation.decryptCode) || `// ${displayName} decryption\nreturn data; // Placeholder`;

      return `${header}#include <vector>
#include <string>
#include <stdexcept>
#include <algorithm>

/**
 * ${displayName} cryptographic algorithm implementation
 */
class ${className} {
private:
    bool initialized;
    ${constants}
public:
    /**
     * Constructor
     */
    ${className}() : initialized(true) {}

    /**
     * Destructor
     */
    ~${className}() {
        dispose();
    }

    /**
     * Encrypts data using ${displayName} algorithm
     * @param data Data to encrypt
     * @param key Encryption key
     * @returns Encrypted data
     */
    std::vector<uint8_t> encrypt(const std::vector<uint8_t>& data, const std::vector<uint8_t>& key) {
        if (!initialized) {
            throw std::runtime_error("Cipher not initialized");
        }
        
        ${encryptCode}
    }

    /**
     * Decrypts data using ${displayName} algorithm
     * @param data Data to decrypt
     * @param key Decryption key
     * @returns Decrypted data
     */
    std::vector<uint8_t> decrypt(const std::vector<uint8_t>& data, const std::vector<uint8_t>& key) {
        if (!initialized) {
            throw std::runtime_error("Cipher not initialized");
        }
        
        ${decryptCode}
    }

    /**
     * Process a block of data (placeholder for actual algorithm logic)
     */
    std::vector<uint8_t> processBlock(const std::vector<uint8_t>& inputBytes, const std::vector<uint8_t>& key, bool encrypt) {
        // This is a placeholder - actual implementation would contain
        // the specific cryptographic algorithm logic
        std::vector<uint8_t> result = inputBytes;
        
        if (encrypt) {
            // Simplified encryption: XOR with key (not cryptographically secure)
            for (size_t i = 0; i < result.size(); ++i) {
                result[i] ^= key[i % key.size()];
            }
        } else {
            // Simplified decryption: same as encryption for XOR
            for (size_t i = 0; i < result.size(); ++i) {
                result[i] ^= key[i % key.size()];
            }
        }
        
        return result;
    }

    /**
     * Clean up resources
     */
    void dispose() {
        initialized = false;
    }
};

${options.includeExamples ? `// Example usage:
int main() {
    try {
        ${className} cipher;
        
        std::vector<uint8_t> data = {'H', 'e', 'l', 'l', 'o', ' ', 'W', 'o', 'r', 'l', 'd'};
        std::vector<uint8_t> key = {'s', 'e', 'c', 'r', 'e', 't', '_', 'k', 'e', 'y'};
        
        auto encrypted = cipher.encrypt(data, key);
        auto decrypted = cipher.decrypt(encrypted, key);
        
        // Output results (implementation specific)
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}` : ''}`;
    },

    /**
     * Generate Java code
     * @private
     */
    _generateJava: function(algorithmName, displayName, options, implementation) {
      const className = this._toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in Java\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      const constants = this._generateJavaConstants(implementation.constants);
      const encryptCode = this._convertToJava(implementation.encryptCode) || `// ${displayName} encryption\nreturn data; // Placeholder`;
      const decryptCode = this._convertToJava(implementation.decryptCode) || `// ${displayName} decryption\nreturn data; // Placeholder`;

      return `${header}import java.util.Arrays;

/**
 * ${displayName} cryptographic algorithm implementation
 */
public class ${className} {
    private boolean initialized;
    ${constants}
    
    /**
     * Constructor
     */
    public ${className}() {
        this.initialized = true;
    }

    /**
     * Encrypts data using ${displayName} algorithm
     * @param data Data to encrypt
     * @param key Encryption key
     * @return Encrypted data
     * @throws RuntimeException if cipher not initialized
     */
    public byte[] encrypt(byte[] data, byte[] key) throws RuntimeException {
        if (!initialized) {
            throw new RuntimeException("Cipher not initialized");
        }
        
        ${encryptCode}
    }

    /**
     * Decrypts data using ${displayName} algorithm
     * @param data Data to decrypt
     * @param key Decryption key
     * @return Decrypted data
     * @throws RuntimeException if cipher not initialized
     */
    public byte[] decrypt(byte[] data, byte[] key) throws RuntimeException {
        if (!initialized) {
            throw new RuntimeException("Cipher not initialized");
        }
        
        ${decryptCode}
    }

    /**
     * Process a block of data (placeholder for actual algorithm logic)
     * @param inputBytes Input data
     * @param key Encryption/decryption key
     * @param encrypt True for encryption, false for decryption
     * @return Processed data
     */
    private byte[] processBlock(byte[] inputBytes, byte[] key, boolean encrypt) {
        // This is a placeholder - actual implementation would contain
        // the specific cryptographic algorithm logic
        byte[] result = Arrays.copyOf(inputBytes, inputBytes.length);
        
        if (encrypt) {
            // Simplified encryption: XOR with key (not cryptographically secure)
            for (int i = 0; i < result.length; i++) {
                result[i] ^= key[i % key.length];
            }
        } else {
            // Simplified decryption: same as encryption for XOR
            for (int i = 0; i < result.length; i++) {
                result[i] ^= key[i % key.length];
            }
        }
        
        return result;
    }

    /**
     * Clean up resources
     */
    public void dispose() {
        this.initialized = false;
    }

    /**
     * AutoCloseable implementation
     */
    public void close() {
        dispose();
    }
}

${options.includeExamples ? `// Example usage:
public class ${className}Example {
    public static void main(String[] args) {
        try (${className} cipher = new ${className}()) {
            byte[] data = "Hello World".getBytes();
            byte[] key = "secret_key".getBytes();
            
            byte[] encrypted = cipher.encrypt(data, key);
            byte[] decrypted = cipher.decrypt(encrypted, key);
            
            System.out.println("Original: " + new String(data));
            System.out.println("Encrypted: " + Arrays.toString(encrypted));
            System.out.println("Decrypted: " + new String(decrypted));
            
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
        }
    }
}` : ''}`;
    },

    _generateRust: function(algorithmName, displayName, options, implementation) {
      const className = this._toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in Rust\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      const constants = this._generateRustConstants(implementation.constants);
      const encryptCode = this._convertToRust(implementation.encryptCode) || `// ${displayName} encryption\ndata // Placeholder`;
      const decryptCode = this._convertToRust(implementation.decryptCode) || `// ${displayName} decryption\ndata // Placeholder`;

      return `${header}use std::error::Error;
use std::fmt;

/// ${displayName} cryptographic algorithm implementation
pub struct ${className} {
    initialized: bool,
}

#[derive(Debug)]
pub struct CipherError(String);

impl fmt::Display for CipherError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Error for CipherError {}

impl ${className} {
    ${constants}/// Create a new ${displayName} cipher instance
    pub fn new() -> Self {
        Self {
            initialized: true,
        }
    }

    /// Encrypt data using ${displayName} algorithm
    /// 
    /// # Arguments
    /// * \`data\` - Data to encrypt
    /// * \`key\` - Encryption key
    /// 
    /// # Returns
    /// * \`Result<Vec<u8>, CipherError>\` - Encrypted data or error
    pub fn encrypt(&self, data: &[u8], key: &[u8]) -> Result<Vec<u8>, CipherError> {
        if !self.initialized {
            return Err(CipherError("Cipher not initialized".to_string()));
        }
        
        ${encryptCode}
    }

    /// Decrypt data using ${displayName} algorithm
    /// 
    /// # Arguments
    /// * \`data\` - Data to decrypt
    /// * \`key\` - Decryption key
    /// 
    /// # Returns
    /// * \`Result<Vec<u8>, CipherError>\` - Decrypted data or error
    pub fn decrypt(&self, data: &[u8], key: &[u8]) -> Result<Vec<u8>, CipherError> {
        if !self.initialized {
            return Err(CipherError("Cipher not initialized".to_string()));
        }
        
        ${decryptCode}
    }

    /// Process a block of data (placeholder for actual algorithm logic)
    fn process_block(&self, input_bytes: &[u8], key: &[u8], encrypt: bool) -> Vec<u8> {
        // This is a placeholder - actual implementation would contain
        // the specific cryptographic algorithm logic
        let mut result = input_bytes.to_vec();
        
        if encrypt {
            // Simplified encryption: XOR with key (not cryptographically secure)
            for (i, byte) in result.iter_mut().enumerate() {
                *byte ^= key[i % key.len()];
            }
        } else {
            // Simplified decryption: same as encryption for XOR
            for (i, byte) in result.iter_mut().enumerate() {
                *byte ^= key[i % key.len()];
            }
        }
        
        result
    }

    /// Clean up resources
    pub fn dispose(&mut self) {
        self.initialized = false;
    }
}

impl Default for ${className} {
    fn default() -> Self {
        Self::new()
    }
}

${options.includeExamples ? `#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_encryption() {
        let mut cipher = ${className}::new();
        let data = b"Hello World";
        let key = b"secret_key";
        
        let encrypted = cipher.encrypt(data, key).expect("Encryption failed");
        let decrypted = cipher.decrypt(&encrypted, key).expect("Decryption failed");
        
        assert_eq!(data, &decrypted[..]);
        cipher.dispose();
    }
}

// Example usage:
fn main() -> Result<(), Box<dyn Error>> {
    let mut cipher = ${className}::new();
    
    let data = b"Hello World";
    let key = b"secret_key";
    
    let encrypted = cipher.encrypt(data, key)?;
    let decrypted = cipher.decrypt(&encrypted, key)?;
    
    println!("Original: {:?}", std::str::from_utf8(data)?);
    println!("Encrypted: {:?}", encrypted);
    println!("Decrypted: {:?}", std::str::from_utf8(&decrypted)?);
    
    cipher.dispose();
    Ok(())
}` : ''}`;
    },

    _generateCSharp: function(algorithmName, displayName, options, implementation) {
      const className = this._toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in C#\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      const constants = this._generateCSharpConstants(implementation.constants);
      const encryptCode = this._convertToCSharp(implementation.encryptCode) || `// ${displayName} encryption\nreturn data; // Placeholder`;
      const decryptCode = this._convertToCSharp(implementation.decryptCode) || `// ${displayName} decryption\nreturn data; // Placeholder`;

      return `${header}using System;

/// <summary>
/// ${displayName} cryptographic algorithm implementation
/// </summary>
public sealed class ${className} : IDisposable
{
    private bool _initialized;
    ${constants}

    /// <summary>
    /// Initializes a new instance of the ${className} class
    /// </summary>
    public ${className}()
    {
        _initialized = true;
    }

    /// <summary>
    /// Encrypts data using ${displayName} algorithm
    /// </summary>
    /// <param name="data">Data to encrypt</param>
    /// <param name="key">Encryption key</param>
    /// <returns>Encrypted data</returns>
    /// <exception cref="InvalidOperationException">Thrown when cipher is not initialized</exception>
    /// <exception cref="ArgumentNullException">Thrown when data or key is null</exception>
    public byte[] Encrypt(byte[] data, byte[] key)
    {
        if (!_initialized)
            throw new InvalidOperationException("Cipher not initialized");
        
        if (data == null)
            throw new ArgumentNullException(nameof(data));
        
        if (key == null)
            throw new ArgumentNullException(nameof(key));
        
        ${encryptCode}
    }

    /// <summary>
    /// Decrypts data using ${displayName} algorithm
    /// </summary>
    /// <param name="data">Data to decrypt</param>
    /// <param name="key">Decryption key</param>
    /// <returns>Decrypted data</returns>
    /// <exception cref="InvalidOperationException">Thrown when cipher is not initialized</exception>
    /// <exception cref="ArgumentNullException">Thrown when data or key is null</exception>
    public byte[] Decrypt(byte[] data, byte[] key)
    {
        if (!_initialized)
            throw new InvalidOperationException("Cipher not initialized");
        
        if (data == null)
            throw new ArgumentNullException(nameof(data));
        
        if (key == null)
            throw new ArgumentNullException(nameof(key));
        
        ${decryptCode}
    }

    /// <summary>
    /// Process a block of data (placeholder for actual algorithm logic)
    /// </summary>
    /// <param name="inputBytes">Input data</param>
    /// <param name="key">Encryption/decryption key</param>
    /// <param name="encrypt">True for encryption, false for decryption</param>
    /// <returns>Processed data</returns>
    private byte[] ProcessBlock(byte[] inputBytes, byte[] key, bool encrypt)
    {
        // This is a placeholder - actual implementation would contain
        // the specific cryptographic algorithm logic
        var result = new byte[inputBytes.Length];
        Array.Copy(inputBytes, result, inputBytes.Length);
        
        if (encrypt)
        {
            // Simplified encryption: XOR with key (not cryptographically secure)
            for (int i = 0; i < result.Length; i++)
            {
                result[i] ^= key[i % key.Length];
            }
        }
        else
        {
            // Simplified decryption: same as encryption for XOR
            for (int i = 0; i < result.Length; i++)
            {
                result[i] ^= key[i % key.Length];
            }
        }
        
        return result;
    }

    /// <summary>
    /// Releases all resources used by the ${className}
    /// </summary>
    public void Dispose()
    {
        _initialized = false;
    }
}

${options.includeExamples ? `// Example usage:
public class Program
{
    public static void Main(string[] args)
    {
        try
        {
            using var cipher = new ${className}();
            
            var data = System.Text.Encoding.UTF8.GetBytes("Hello World");
            var key = System.Text.Encoding.UTF8.GetBytes("secret_key");
            
            var encrypted = cipher.Encrypt(data, key);
            var decrypted = cipher.Decrypt(encrypted, key);
            
            Console.WriteLine($"Original: {System.Text.Encoding.UTF8.GetString(data)}");
            Console.WriteLine($"Encrypted: {Convert.ToBase64String(encrypted)}");
            Console.WriteLine($"Decrypted: {System.Text.Encoding.UTF8.GetString(decrypted)}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
        }
    }
}` : ''}`;
    },

    _generateKotlin: function(algorithmName, displayName, options, implementation) {
      const className = this._toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in Kotlin\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      const constants = this._generateKotlinConstants(implementation.constants);
      const encryptCode = this._convertToKotlin(implementation.encryptCode) || `// ${displayName} encryption\nreturn data // Placeholder`;
      const decryptCode = this._convertToKotlin(implementation.decryptCode) || `// ${displayName} decryption\nreturn data // Placeholder`;

      return `${header}/**
 * ${displayName} cryptographic algorithm implementation
 */
class ${className} : AutoCloseable {
    private var initialized: Boolean = true
    
    ${constants}/**
     * Encrypt data using ${displayName} algorithm
     * @param data Data to encrypt
     * @param key Encryption key
     * @return Encrypted data
     * @throws IllegalStateException if cipher not initialized
     */
    fun encrypt(data: ByteArray, key: ByteArray): ByteArray {
        require(initialized) { "Cipher not initialized" }
        
        ${encryptCode}
    }

    /**
     * Decrypt data using ${displayName} algorithm
     * @param data Data to decrypt
     * @param key Decryption key
     * @return Decrypted data
     * @throws IllegalStateException if cipher not initialized
     */
    fun decrypt(data: ByteArray, key: ByteArray): ByteArray {
        require(initialized) { "Cipher not initialized" }
        
        ${decryptCode}
    }

    /**
     * Process a block of data (placeholder for actual algorithm logic)
     */
    private fun processBlock(inputBytes: ByteArray, key: ByteArray, encrypt: Boolean): ByteArray {
        // This is a placeholder - actual implementation would contain
        // the specific cryptographic algorithm logic
        val result = inputBytes.copyOf()
        
        if (encrypt) {
            // Simplified encryption: XOR with key (not cryptographically secure)
            for (i in result.indices) {
                result[i] = (result[i].toInt() xor key[i % key.size].toInt()).toByte()
            }
        } else {
            // Simplified decryption: same as encryption for XOR
            for (i in result.indices) {
                result[i] = (result[i].toInt() xor key[i % key.size].toInt()).toByte()
            }
        }
        
        return result
    }

    /**
     * Clean up resources
     */
    override fun close() {
        initialized = false
    }
    
    fun dispose() = close()
}

${options.includeExamples ? `// Example usage:
fun main() {
    try {
        ${className}().use { cipher ->
            val data = "Hello World".toByteArray()
            val key = "secret_key".toByteArray()
            
            val encrypted = cipher.encrypt(data, key)
            val decrypted = cipher.decrypt(encrypted, key)
            
            println("Original: \${String(data)}")
            println("Encrypted: \${encrypted.contentToString()}")
            println("Decrypted: \${String(decrypted)}")
        }
    } catch (e: Exception) {
        println("Error: \${e.message}")
    }
}` : ''}`;
    },

    _generatePerl: function(algorithmName, displayName, options, implementation) {
      const className = this._toPascalCase(algorithmName);
      const header = options.includeComments ? `# ${displayName} Implementation in Perl\n# Generated by SynthelicZ Cipher Tools\n# (c)2006-2025 Hawkynt\n\n` : '';
      
      const constants = this._generatePerlConstants(implementation.constants);
      const encryptCode = this._convertToPerl(implementation.encryptCode) || `# ${displayName} encryption\nreturn $data; # Placeholder`;
      const decryptCode = this._convertToPerl(implementation.decryptCode) || `# ${displayName} decryption\nreturn $data; # Placeholder`;

      return `${header}package ${className};

use strict;
use warnings;
use Carp;

=head1 NAME

${className} - ${displayName} cryptographic algorithm implementation

=head1 SYNOPSIS

    use ${className};
    
    my $cipher = ${className}->new();
    my $encrypted = $cipher->encrypt("Hello World", "secret_key");
    my $decrypted = $cipher->decrypt($encrypted, "secret_key");

=head1 DESCRIPTION

This module implements the ${displayName} cryptographic algorithm.

=cut

${constants}
=head2 new

Creates a new ${className} instance.

=cut

sub new {
    my ($class) = @_;
    my $self = {
        initialized => 1,
    };
    return bless $self, $class;
}

=head2 encrypt

Encrypts data using ${displayName} algorithm.

=cut

sub encrypt {
    my ($self, $data, $key) = @_;
    
    croak "Cipher not initialized" unless $self->{initialized};
    croak "Data is required" unless defined $data;
    croak "Key is required" unless defined $key;
    
    ${encryptCode}
}

=head2 decrypt

Decrypts data using ${displayName} algorithm.

=cut

sub decrypt {
    my ($self, $data, $key) = @_;
    
    croak "Cipher not initialized" unless $self->{initialized};
    croak "Data is required" unless defined $data;
    croak "Key is required" unless defined $key;
    
    ${decryptCode}
}

=head2 _process_block

Process a block of data (placeholder for actual algorithm logic).

=cut

sub _process_block {
    my ($self, $input_bytes, $key, $encrypt) = @_;
    
    # This is a placeholder - actual implementation would contain
    # the specific cryptographic algorithm logic
    my @result = unpack('C*', $input_bytes);
    my @key_bytes = unpack('C*', $key);
    
    if ($encrypt) {
        # Simplified encryption: XOR with key (not cryptographically secure)
        for my $i (0 .. $#result) {
            $result[$i] ^= $key_bytes[$i % @key_bytes];
        }
    } else {
        # Simplified decryption: same as encryption for XOR
        for my $i (0 .. $#result) {
            $result[$i] ^= $key_bytes[$i % @key_bytes];
        }
    }
    
    return pack('C*', @result);
}

=head2 dispose

Clean up resources.

=cut

sub dispose {
    my ($self) = @_;
    $self->{initialized} = 0;
}

sub DESTROY {
    my ($self) = @_;
    $self->dispose();
}

1;

${options.includeExamples ? `# Example usage:
if ($0 eq __FILE__) {
    my $cipher = ${className}->new();
    
    eval {
        my $data = "Hello World";
        my $key = "secret_key";
        
        my $encrypted = $cipher->encrypt($data, $key);
        my $decrypted = $cipher->decrypt($encrypted, $key);
        
        print "Original: $data\\n";
        print "Encrypted: " . unpack('H*', $encrypted) . "\\n";
        print "Decrypted: $decrypted\\n";
        
        $cipher->dispose();
    };
    if ($@) {
        print "Error: $@\\n";
    }
}

__END__

=head1 AUTHOR

Generated by SynthelicZ Cipher Tools

=head1 COPYRIGHT

(c)2006-2025 Hawkynt

=cut` : ''}`;
    },

    _generateFreeBASIC: function(algorithmName, displayName, options, implementation) {
      const className = this._toPascalCase(algorithmName);
      const header = options.includeComments ? `' ${displayName} Implementation in FreeBASIC\n' Generated by SynthelicZ Cipher Tools\n' (c)2006-2025 Hawkynt\n\n` : '';
      
      const constants = this._generateFreeBASICConstants(implementation.constants);
      const encryptCode = this._convertToFreeBASIC(implementation.encryptCode) || `' ${displayName} encryption\nFunction = data ' Placeholder`;
      const decryptCode = this._convertToFreeBASIC(implementation.decryptCode) || `' ${displayName} decryption\nFunction = data ' Placeholder`;

      return `${header}' ${displayName} cryptographic algorithm implementation

Type ${className}
    Private:
        initialized As Boolean
    Public:
        Declare Constructor()
        Declare Destructor()
        Declare Function Encrypt(data As String, key As String) As String
        Declare Function Decrypt(data As String, key As String) As String
        Declare Sub Dispose()
End Type

${constants}' Constructor
Constructor ${className}()
    This.initialized = True
End Constructor

' Destructor
Destructor ${className}()
    This.Dispose()
End Destructor

' Encrypt data using ${displayName} algorithm
Function ${className}.Encrypt(data As String, key As String) As String
    If Not This.initialized Then
        Print "Error: Cipher not initialized"
        Function = ""
        Exit Function
    End If
    
    If Len(data) = 0 Then
        Print "Error: Data is required"
        Function = ""
        Exit Function
    End If
    
    If Len(key) = 0 Then
        Print "Error: Key is required"
        Function = ""
        Exit Function
    End If
    
    ${encryptCode}
End Function

' Decrypt data using ${displayName} algorithm
Function ${className}.Decrypt(data As String, key As String) As String
    If Not This.initialized Then
        Print "Error: Cipher not initialized"
        Function = ""
        Exit Function
    End If
    
    If Len(data) = 0 Then
        Print "Error: Data is required"
        Function = ""
        Exit Function
    End If
    
    If Len(key) = 0 Then
        Print "Error: Key is required"
        Function = ""
        Exit Function
    End If
    
    ${decryptCode}
End Function

' Process a block of data (placeholder for actual algorithm logic)
Private Function ${className}.ProcessBlock(inputData As String, key As String, encrypt As Boolean) As String
    ' This is a placeholder - actual implementation would contain
    ' the specific cryptographic algorithm logic
    Dim result As String = inputData
    Dim i As Integer
    Dim keyLen As Integer = Len(key)
    
    For i = 1 To Len(result)
        Dim dataByte As Integer = Asc(Mid(result, i, 1))
        Dim keyByte As Integer = Asc(Mid(key, ((i - 1) Mod keyLen) + 1, 1))
        
        If encrypt Then
            ' Simplified encryption: XOR with key (not cryptographically secure)
            dataByte = dataByte Xor keyByte
        Else
            ' Simplified decryption: same as encryption for XOR
            dataByte = dataByte Xor keyByte
        End If
        
        Mid(result, i, 1) = Chr(dataByte)
    Next i
    
    Function = result
End Function

' Clean up resources
Sub ${className}.Dispose()
    This.initialized = False
End Sub

${options.includeExamples ? `' Example usage:
Sub Main()
    Dim cipher As ${className}
    
    Dim data As String = "Hello World"
    Dim key As String = "secret_key"
    
    Dim encrypted As String = cipher.Encrypt(data, key)
    Dim decrypted As String = cipher.Decrypt(encrypted, key)
    
    Print "Original: " & data
    Print "Encrypted: " & encrypted
    Print "Decrypted: " & decrypted
    
    cipher.Dispose()
End Sub

' Entry point
Main()` : ''}`;
    },

    _generateDelphi: function(algorithmName, displayName, options, implementation) {
      const className = 'T' + this._toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in Delphi\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      const constants = this._generateDelphiConstants(implementation.constants);
      const encryptCode = this._convertToDelphi(implementation.encryptCode) || `// ${displayName} encryption\nResult := Data; // Placeholder`;
      const decryptCode = this._convertToDelphi(implementation.decryptCode) || `// ${displayName} decryption\nResult := Data; // Placeholder`;

      return `${header}unit ${className.substring(1)};

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils;

type
  /// <summary>
  /// ${displayName} cryptographic algorithm implementation
  /// </summary>
  ${className} = class
  private
    FInitialized: Boolean;
    ${constants}function ProcessBlock(const InputData: TBytes; const Key: TBytes; Encrypt: Boolean): TBytes;
  public
    constructor Create;
    destructor Destroy; override;
    
    /// <summary>
    /// Encrypt data using ${displayName} algorithm
    /// </summary>
    /// <param name="Data">Data to encrypt</param>
    /// <param name="Key">Encryption key</param>
    /// <returns>Encrypted data</returns>
    function Encrypt(const Data: TBytes; const Key: TBytes): TBytes; overload;
    function Encrypt(const Data: string; const Key: string): string; overload;
    
    /// <summary>
    /// Decrypt data using ${displayName} algorithm
    /// </summary>
    /// <param name="Data">Data to decrypt</param>
    /// <param name="Key">Decryption key</param>
    /// <returns>Decrypted data</returns>
    function Decrypt(const Data: TBytes; const Key: TBytes): TBytes; overload;
    function Decrypt(const Data: string; const Key: string): string; overload;
    
    /// <summary>
    /// Clean up resources
    /// </summary>
    procedure Dispose;
  end;

implementation

constructor ${className}.Create;
begin
  inherited Create;
  FInitialized := True;
end;

destructor ${className}.Destroy;
begin
  Dispose;
  inherited Destroy;
end;

function ${className}.Encrypt(const Data: TBytes; const Key: TBytes): TBytes;
begin
  if not FInitialized then
    raise Exception.Create('Cipher not initialized');
  
  if Length(Data) = 0 then
    raise Exception.Create('Data is required');
  
  if Length(Key) = 0 then
    raise Exception.Create('Key is required');
  
  ${encryptCode}
end;

function ${className}.Encrypt(const Data: string; const Key: string): string;
var
  DataBytes, KeyBytes, ResultBytes: TBytes;
begin
  DataBytes := TEncoding.UTF8.GetBytes(Data);
  KeyBytes := TEncoding.UTF8.GetBytes(Key);
  ResultBytes := Encrypt(DataBytes, KeyBytes);
  Result := TEncoding.UTF8.GetString(ResultBytes);
end;

function ${className}.Decrypt(const Data: TBytes; const Key: TBytes): TBytes;
begin
  if not FInitialized then
    raise Exception.Create('Cipher not initialized');
  
  if Length(Data) = 0 then
    raise Exception.Create('Data is required');
  
  if Length(Key) = 0 then
    raise Exception.Create('Key is required');
  
  ${decryptCode}
end;

function ${className}.Decrypt(const Data: string; const Key: string): string;
var
  DataBytes, KeyBytes, ResultBytes: TBytes;
begin
  DataBytes := TEncoding.UTF8.GetBytes(Data);
  KeyBytes := TEncoding.UTF8.GetBytes(Key);
  ResultBytes := Decrypt(DataBytes, KeyBytes);
  Result := TEncoding.UTF8.GetString(ResultBytes);
end;

function ${className}.ProcessBlock(const InputData: TBytes; const Key: TBytes; Encrypt: Boolean): TBytes;
var
  I: Integer;
begin
  // This is a placeholder - actual implementation would contain
  // the specific cryptographic algorithm logic
  SetLength(Result, Length(InputData));
  
  for I := 0 to High(InputData) do
  begin
    if Encrypt then
      // Simplified encryption: XOR with key (not cryptographically secure)
      Result[I] := InputData[I] xor Key[I mod Length(Key)]
    else
      // Simplified decryption: same as encryption for XOR
      Result[I] := InputData[I] xor Key[I mod Length(Key)];
  end;
end;

procedure ${className}.Dispose;
begin
  FInitialized := False;
end;

end.

${options.includeExamples ? `// Example usage:
program ${className.substring(1)}Example;

{$mode objfpc}{$H+}

uses
  Classes, SysUtils, ${className.substring(1)};

var
  Cipher: ${className};
  Data, Key: string;
  Encrypted, Decrypted: string;

begin
  try
    Cipher := ${className}.Create;
    try
      Data := 'Hello World';
      Key := 'secret_key';
      
      Encrypted := Cipher.Encrypt(Data, Key);
      Decrypted := Cipher.Decrypt(Encrypted, Key);
      
      WriteLn('Original: ', Data);
      WriteLn('Encrypted: ', Encrypted);
      WriteLn('Decrypted: ', Decrypted);
      
    finally
      Cipher.Free;
    end;
  except
    on E: Exception do
      WriteLn('Error: ', E.Message);
  end;
end.` : ''}`;
    },

    _generateGo: function(algorithmName, displayName, options, implementation) {
      const structName = this._toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in Go\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      const constants = this._generateGoConstants(implementation.constants);
      const encryptCode = this._convertToGo(implementation.encryptCode) || `// ${displayName} encryption\nreturn data // Placeholder`;
      const decryptCode = this._convertToGo(implementation.decryptCode) || `// ${displayName} decryption\nreturn data // Placeholder`;

      return `${header}package main

import (
	"errors"
	"fmt"
)

${constants}// ${structName} represents a ${displayName} cryptographic algorithm implementation
type ${structName} struct {
	initialized bool
}

// New${structName} creates a new ${displayName} cipher instance
func New${structName}() *${structName} {
	return &${structName}{
		initialized: true,
	}
}

// Encrypt encrypts data using ${displayName} algorithm
func (c *${structName}) Encrypt(data []byte, key []byte) ([]byte, error) {
	if !c.initialized {
		return nil, errors.New("cipher not initialized")
	}
	
	if len(data) == 0 {
		return nil, errors.New("data is required")
	}
	
	if len(key) == 0 {
		return nil, errors.New("key is required")
	}
	
	${encryptCode}
}

// Decrypt decrypts data using ${displayName} algorithm
func (c *${structName}) Decrypt(data []byte, key []byte) ([]byte, error) {
	if !c.initialized {
		return nil, errors.New("cipher not initialized")
	}
	
	if len(data) == 0 {
		return nil, errors.New("data is required")
	}
	
	if len(key) == 0 {
		return nil, errors.New("key is required")
	}
	
	${decryptCode}
}

// processBlock processes a block of data (placeholder for actual algorithm logic)
func (c *${structName}) processBlock(inputBytes []byte, key []byte, encrypt bool) []byte {
	// This is a placeholder - actual implementation would contain
	// the specific cryptographic algorithm logic
	result := make([]byte, len(inputBytes))
	copy(result, inputBytes)
	
	if encrypt {
		// Simplified encryption: XOR with key (not cryptographically secure)
		for i, b := range result {
			result[i] = b ^ key[i%len(key)]
		}
	} else {
		// Simplified decryption: same as encryption for XOR
		for i, b := range result {
			result[i] = b ^ key[i%len(key)]
		}
	}
	
	return result
}

// Dispose cleans up resources
func (c *${structName}) Dispose() {
	c.initialized = false
}

// Close implements io.Closer interface
func (c *${structName}) Close() error {
	c.Dispose()
	return nil
}

${options.includeExamples ? `// Example usage:
func main() {
	cipher := New${structName}()
	defer cipher.Close()
	
	data := []byte("Hello World")
	key := []byte("secret_key")
	
	encrypted, err := cipher.Encrypt(data, key)
	if err != nil {
		fmt.Printf("Encryption error: %v\\n", err)
		return
	}
	
	decrypted, err := cipher.Decrypt(encrypted, key)
	if err != nil {
		fmt.Printf("Decryption error: %v\\n", err)
		return
	}
	
	fmt.Printf("Original: %s\\n", string(data))
	fmt.Printf("Encrypted: %v\\n", encrypted)
	fmt.Printf("Decrypted: %s\\n", string(decrypted))
}` : ''}`;
    },

    /**
     * Helper methods
     * @private
     */
    _toPascalCase: function(str) {
      return str.replace(/(?:^|[-_])(\w)/g, (_, char) => char.toUpperCase());
    },

    _generateJavaScriptConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    static ${key} = "${value}";`;
      });
      
      return constLines.join('\n') + '\n\n    ';
    },

    _generatePythonConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    ${key} = "${value}"`;
      });
      
      return constLines.join('\n') + '\n\n    ';
    },

    _generatePythonConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    ${key} = "${value}"`;
      });
      
      return constLines.join('\n') + '\n\n    ';
    },

    _generateCPlusPlusConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    static const int ${key} = ${JSON.stringify(value)};`;
      });
      
      return constLines.join('\n    ') + '\n    ';
    },

    _generateJavaConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    public static final int ${key} = ${JSON.stringify(value)};`;
      });
      
      return constLines.join('\n    ') + '\n    ';
    },

    _convertToCPlusPlus: function(jsCode) {
      if (!jsCode) return '';
      
      // Basic JavaScript to C++ conversion
      return jsCode
        .replace(/var\s+/g, 'auto ')
        .replace(/let\s+/g, 'auto ')
        .replace(/const\s+/g, 'const auto ')
        .replace(/\/\/\s*/g, '// ')
        .replace(/true/g, 'true')
        .replace(/false/g, 'false')
        .replace(/null/g, 'nullptr');
    },

    _convertToJava: function(jsCode) {
      if (!jsCode) return '';
      
      // Basic JavaScript to Java conversion
      return jsCode
        .replace(/var\s+/g, '')
        .replace(/let\s+/g, '')
        .replace(/const\s+/g, 'final ')
        .replace(/\/\/\s*/g, '// ')
        .replace(/true/g, 'true')
        .replace(/false/g, 'false')
        .replace(/null/g, 'null');
    },

    _convertToPython: function(jsCode) {
      if (!jsCode) return '';
      
      // Basic JavaScript to Python conversion
      return jsCode
        .replace(/var\s+/g, '')
        .replace(/let\s+/g, '')
        .replace(/const\s+/g, '')
        .replace(/function\s+(\w+)\s*\(/g, 'def $1(')
        .replace(/{\s*$/gm, ':')
        .replace(/}\s*$/gm, '')
        .replace(/\/\/\s*/g, '# ')
        .replace(/true/g, 'True')
        .replace(/false/g, 'False')
        .replace(/null/g, 'None');
    },

    // Missing constants generators
    _generateRustConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    const ${key}: usize = ${JSON.stringify(value)};`;
      });
      
      return constLines.join('\n    ') + '\n\n    ';
    },

    _generateCSharpConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    private const int ${key} = ${JSON.stringify(value)};`;
      });
      
      return constLines.join('\n    ') + '\n    ';
    },

    _generateKotlinConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    companion object {\n        const val ${key} = ${JSON.stringify(value)}\n    }`;
      });
      
      return constLines.join('\n    ') + '\n\n    ';
    },

    _generatePerlConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `use constant ${key} => ${JSON.stringify(value)};`;
      });
      
      return constLines.join('\n') + '\n\n';
    },

    _generateFreeBASICConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `Const ${key} As Integer = ${JSON.stringify(value)}`;
      });
      
      return constLines.join('\n') + '\n\n';
    },

    _generateDelphiConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    const ${key}: Integer = ${JSON.stringify(value)};`;
      });
      
      return constLines.join('\n    ') + '\n    ';
    },

    _generateGoConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `const ${key} = ${JSON.stringify(value)}`;
      });
      
      return 'const (\n\t' + constLines.join('\n\t') + '\n)\n\n';
    },

    // Missing language converters
    _convertToRust: function(jsCode) {
      if (!jsCode) return '';
      
      return jsCode
        .replace(/var\s+/g, 'let ')
        .replace(/let\s+/g, 'let ')
        .replace(/const\s+/g, 'let ')
        .replace(/\/\/\s*/g, '// ')
        .replace(/true/g, 'true')
        .replace(/false/g, 'false')
        .replace(/null/g, 'None');
    },

    _convertToCSharp: function(jsCode) {
      if (!jsCode) return '';
      
      return jsCode
        .replace(/var\s+/g, 'var ')
        .replace(/let\s+/g, 'var ')
        .replace(/const\s+/g, 'var ')
        .replace(/\/\/\s*/g, '// ')
        .replace(/true/g, 'true')
        .replace(/false/g, 'false')
        .replace(/null/g, 'null');
    },

    _convertToKotlin: function(jsCode) {
      if (!jsCode) return '';
      
      return jsCode
        .replace(/var\s+/g, 'var ')
        .replace(/let\s+/g, 'var ')
        .replace(/const\s+/g, 'val ')
        .replace(/\/\/\s*/g, '// ')
        .replace(/true/g, 'true')
        .replace(/false/g, 'false')
        .replace(/null/g, 'null');
    },

    _convertToPerl: function(jsCode) {
      if (!jsCode) return '';
      
      return jsCode
        .replace(/var\s+/g, 'my ')
        .replace(/let\s+/g, 'my ')
        .replace(/const\s+/g, 'my ')
        .replace(/\/\/\s*/g, '# ')
        .replace(/true/g, '1')
        .replace(/false/g, '0')
        .replace(/null/g, 'undef');
    },

    _convertToFreeBASIC: function(jsCode) {
      if (!jsCode) return '';
      
      return jsCode
        .replace(/var\s+/g, 'Dim ')
        .replace(/let\s+/g, 'Dim ')
        .replace(/const\s+/g, 'Dim ')
        .replace(/\/\/\s*/g, '\' ')
        .replace(/true/g, 'True')
        .replace(/false/g, 'False')
        .replace(/null/g, 'Nothing');
    },

    _convertToDelphi: function(jsCode) {
      if (!jsCode) return '';
      
      return jsCode
        .replace(/var\s+/g, 'var ')
        .replace(/let\s+/g, 'var ')
        .replace(/const\s+/g, 'const ')
        .replace(/\/\/\s*/g, '// ')
        .replace(/true/g, 'True')
        .replace(/false/g, 'False')
        .replace(/null/g, 'nil');
    },

    _convertToGo: function(jsCode) {
      if (!jsCode) return '';
      
      return jsCode
        .replace(/var\s+/g, 'var ')
        .replace(/let\s+/g, 'var ')
        .replace(/const\s+/g, 'var ')
        .replace(/\/\/\s*/g, '// ')
        .replace(/true/g, 'true')
        .replace(/false/g, 'false')
        .replace(/null/g, 'nil');
    }
  };

  // Export to global scope
  global.MultiLanguageGenerator = MultiLanguageGenerator;

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiLanguageGenerator;
  }

})(typeof global !== 'undefined' ? global : window);
