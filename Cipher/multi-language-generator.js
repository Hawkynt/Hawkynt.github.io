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
      // Implementation for Rust generation
      return `// ${displayName} Rust implementation - Template\nstruct ${this._toPascalCase(algorithmName)} {\n    // Implementation needed\n}`;
    },

    _generateCSharp: function(algorithmName, displayName, options, implementation) {
      // Implementation for C# generation
      return `// ${displayName} C# implementation - Template\npublic class ${this._toPascalCase(algorithmName)} {\n    // Implementation needed\n}`;
    },

    _generateKotlin: function(algorithmName, displayName, options, implementation) {
      // Implementation for Kotlin generation
      return `// ${displayName} Kotlin implementation - Template\nclass ${this._toPascalCase(algorithmName)} {\n    // Implementation needed\n}`;
    },

    _generatePerl: function(algorithmName, displayName, options, implementation) {
      // Implementation for Perl generation
      return `# ${displayName} Perl implementation - Template\npackage ${this._toPascalCase(algorithmName)};\n# Implementation needed`;
    },

    _generateFreeBASIC: function(algorithmName, displayName, options, implementation) {
      // Implementation for FreeBASIC generation
      return `' ${displayName} FreeBASIC implementation - Template\nType ${this._toPascalCase(algorithmName)}\n    ' Implementation needed\nEnd Type`;
    },

    _generateDelphi: function(algorithmName, displayName, options, implementation) {
      // Implementation for Delphi generation
      return `// ${displayName} Delphi implementation - Template\ntype\n  T${this._toPascalCase(algorithmName)} = class\n    // Implementation needed\n  end;`;
    },

    _generateGo: function(algorithmName, displayName, options, implementation) {
      // Implementation for Go generation
      return `// ${displayName} Go implementation - Template\ntype ${this._toPascalCase(algorithmName)} struct {\n    // Implementation needed\n}`;
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
    }
  };

  // Export to global scope
  global.MultiLanguageGenerator = MultiLanguageGenerator;

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiLanguageGenerator;
  }

})(typeof global !== 'undefined' ? global : window);
