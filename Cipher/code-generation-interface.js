#!/usr/bin/env node
/*
 * Multi-Language Code Generation Interface
 * Generate downloadable implementations in FreeBASIC, C#, C++, Java, etc.
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load dependencies
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('./OpCodes.js');
    require('./OpCodes-CodeGen.js');
  }
  
  const CodeGenerationInterface = {
    
    // Supported languages
    supportedLanguages: {
      'freebasic': { name: 'FreeBASIC', extension: '.bas', icon: '🔤' },
      'csharp': { name: 'C#', extension: '.cs', icon: '🔷' },
      'cpp': { name: 'C++', extension: '.cpp', icon: '⚙️' },
      'java': { name: 'Java', extension: '.java', icon: '☕' },
      'python': { name: 'Python', extension: '.py', icon: '🐍' },
      'rust': { name: 'Rust', extension: '.rs', icon: '🦀' },
      'kotlin': { name: 'Kotlin', extension: '.kt', icon: '🎯' },
      'delphi': { name: 'Delphi', extension: '.pas', icon: '🏛️' },
  'perl': { name: 'Perl', extension: '.pl', icon: '🪄' },
  'javascript': { name: 'JavaScript', extension: '.js', icon: '🟨' },
  'go': { name: 'Go', extension: '.go', icon: '🐹' }
    },
    
    currentAlgorithm: null,
    generatedCode: {},
    
    /**
     * Initialize the code generation interface
     */
    init: function() {
      this.createCodeGenUI();
      this.setupEventHandlers();
      console.log('Code Generation Interface initialized');
    },
    
    /**
     * Create the code generation UI
     */
    createCodeGenUI: function() {
      const container = document.getElementById('code-gen-container') || document.createElement('div');
      container.id = 'code-gen-container';
      
      container.innerHTML = `
        <div class="code-generation-panel">
          <h3>📱 Multi-Language Code Generation</h3>
          
          <div class="algorithm-selector">
            <label for="algo-select">Select Algorithm:</label>
            <select id="algo-select">
              <option value="">Choose an algorithm...</option>
            </select>
          </div>
          
          <div class="language-grid">
            ${Object.entries(this.supportedLanguages).map(([key, lang]) => `
              <div class="language-card" data-language="${key}">
                <div class="language-icon">${lang.icon}</div>
                <div class="language-name">${lang.name}</div>
                <div class="language-ext">${lang.extension}</div>
                <button class="generate-btn" data-language="${key}">Generate</button>
                <button class="download-btn" data-language="${key}" disabled>Download</button>
              </div>
            `).join('')}
          </div>
          
          <div class="code-preview">
            <div class="preview-header">
              <span id="preview-title">Code Preview</span>
              <div class="preview-controls">
                <button id="copy-code">📋 Copy</button>
                <button id="download-all">📦 Download All</button>
              </div>
            </div>
            <pre id="code-display"><code>Select an algorithm and language to generate code...</code></pre>
          </div>
          
          <div class="generation-options">
            <h4>Generation Options</h4>
            <label><input type="checkbox" id="include-tests" checked> Include test vectors</label>
            <label><input type="checkbox" id="include-comments" checked> Include detailed comments</label>
            <label><input type="checkbox" id="include-examples" checked> Include usage examples</label>
            <label><input type="checkbox" id="standalone-code"> Generate standalone code (no dependencies)</label>
          </div>
        </div>
        
        <style>
        .code-generation-panel {
          background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
          color: white;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .algorithm-selector {
          margin-bottom: 20px;
        }
        
        .algorithm-selector label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        .algorithm-selector select {
          width: 100%;
          padding: 8px;
          border-radius: 5px;
          border: none;
          font-size: 14px;
        }
        
        .language-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }
        
        .language-card {
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 15px;
          text-align: center;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .language-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
        
        .language-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }
        
        .language-name {
          font-weight: bold;
          margin-bottom: 4px;
        }
        
        .language-ext {
          font-size: 12px;
          opacity: 0.8;
          margin-bottom: 10px;
        }
        
        .generate-btn, .download-btn {
          display: block;
          width: 100%;
          margin: 5px 0;
          padding: 8px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          transition: background-color 0.2s;
        }
        
        .generate-btn {
          background: #4CAF50;
          color: white;
        }
        
        .generate-btn:hover {
          background: #45a049;
        }
        
        .download-btn {
          background: #2196F3;
          color: white;
        }
        
        .download-btn:hover:not(:disabled) {
          background: #1976D2;
        }
        
        .download-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        
        .code-preview {
          background: rgba(0,0,0,0.3);
          border-radius: 8px;
          margin-bottom: 20px;
          overflow: hidden;
        }
        
        .preview-header {
          background: rgba(0,0,0,0.2);
          padding: 10px 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .preview-controls button {
          background: rgba(255,255,255,0.2);
          border: none;
          padding: 5px 10px;
          margin-left: 5px;
          border-radius: 3px;
          color: white;
          cursor: pointer;
        }
        
        #code-display {
          background: none;
          border: none;
          color: white;
          padding: 15px;
          margin: 0;
          max-height: 400px;
          overflow-y: auto;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.4;
        }
        
        .generation-options {
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 15px;
        }
        
        .generation-options h4 {
          margin-top: 0;
          margin-bottom: 10px;
        }
        
        .generation-options label {
          display: block;
          margin: 5px 0;
          cursor: pointer;
        }
        
        .generation-options input[type="checkbox"] {
          margin-right: 8px;
        }
        </style>
      `;
      
      // Add to page if not already there
      if (!document.getElementById('code-gen-container')) {
        const mainContent = document.querySelector('#content') || document.body;
        mainContent.appendChild(container);
      }
      
      this.populateAlgorithmSelector();
    },
    
    /**
     * Populate algorithm selector dropdown
     */
    populateAlgorithmSelector: function() {
      const select = document.getElementById('algo-select');
      if (!select || !global.Cipher || !global.Cipher.ciphers) return;
      
      // Clear existing options (except first)
      while (select.children.length > 1) {
        select.removeChild(select.lastChild);
      }
      
      // Add algorithm options
      Object.keys(global.Cipher.ciphers).sort().forEach(name => {
        const cipher = global.Cipher.ciphers[name];
        const option = document.createElement('option');
        option.value = name;
        option.textContent = cipher.name || name;
        select.appendChild(option);
      });
    },
    
    /**
     * Set up event handlers
     */
    setupEventHandlers: function() {
      // Algorithm selection
      const algoSelect = document.getElementById('algo-select');
      if (algoSelect) {
        algoSelect.addEventListener('change', (e) => {
          this.selectAlgorithm(e.target.value);
        });
      }
      
      // Generate buttons
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('generate-btn')) {
          const language = e.target.dataset.language;
          this.generateCode(language);
        }
        
        if (e.target.classList.contains('download-btn')) {
          const language = e.target.dataset.language;
          this.downloadCode(language);
        }
      });
      
      // Copy code button
      const copyBtn = document.getElementById('copy-code');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          this.copyCodeToClipboard();
        });
      }
      
      // Download all button
      const downloadAllBtn = document.getElementById('download-all');
      if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', () => {
          this.downloadAllGenerated();
        });
      }
    },
    
    /**
     * Select an algorithm for code generation
     */
    selectAlgorithm: function(algorithmName) {
      if (!algorithmName || !global.Cipher.ciphers[algorithmName]) {
        this.currentAlgorithm = null;
        return;
      }
      
      this.currentAlgorithm = global.Cipher.ciphers[algorithmName];
      this.generatedCode = {};
      
      // Reset download buttons
      document.querySelectorAll('.download-btn').forEach(btn => {
        btn.disabled = true;
      });
      
      // Clear code preview
      document.getElementById('code-display').textContent = 
        `Selected: ${this.currentAlgorithm.name}\nClick "Generate" for any language to see the code.`;
      document.getElementById('preview-title').textContent = 
        `${this.currentAlgorithm.name} - Code Preview`;
    },
    
    /**
     * Generate code for a specific language
     */
    generateCode: function(language) {
      if (!this.currentAlgorithm) {
        alert('Please select an algorithm first');
        return;
      }
      
      try {
        const options = this.getGenerationOptions();
        const code = this.generateCodeForLanguage(language, this.currentAlgorithm, options);
        
        this.generatedCode[language] = code;
        
        // Enable download button
        const downloadBtn = document.querySelector(`[data-language="${language}"].download-btn`);
        if (downloadBtn) {
          downloadBtn.disabled = false;
        }
        
        // Show code in preview
        this.showCodePreview(language, code);
        
      } catch (error) {
        console.error('Code generation failed:', error);
        alert('Code generation failed: ' + error.message);
      }
    },
    
    /**
     * Get generation options from UI
     */
    getGenerationOptions: function() {
      return {
        includeTests: document.getElementById('include-tests')?.checked || false,
        includeComments: document.getElementById('include-comments')?.checked || true,
        includeExamples: document.getElementById('include-examples')?.checked || true,
        standalone: document.getElementById('standalone-code')?.checked || false
      };
    },
    
    /**
     * Generate code for a specific language
     */
    generateCodeForLanguage: function(language, algorithm, options) {
      const algorithmName = algorithm.internalName || 'unknown';
      const displayName = algorithm.name || algorithmName;
      
      switch (language) {
        case 'freebasic':
          return this.generateFreeBASIC(algorithmName, displayName, options);
        case 'csharp':
          return this.generateCSharp(algorithmName, displayName, options);
        case 'cpp':
          return this.generateCPlusPlus(algorithmName, displayName, options);
        case 'java':
          return this.generateJava(algorithmName, displayName, options);
        case 'python':
          return this.generatePython(algorithmName, displayName, options);
        case 'rust':
          return this.generateRust(algorithmName, displayName, options);
        case 'kotlin':
          return this.generateKotlin(algorithmName, displayName, options);
        case 'delphi':
          return this.generateDelphi(algorithmName, displayName, options);
        case 'perl':
          return this.generatePerl(algorithmName, displayName, options);
        case 'javascript':
          return this.generateJavaScript(algorithmName, displayName, options);
        case 'go':
          return this.generateGo(algorithmName, displayName, options);
        default:
          throw new Error(`Unsupported language: ${language}`);
      }
    },
    
    /**
     * Generate FreeBASIC code
     */
    generateFreeBASIC: function(algorithmName, displayName, options) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `' ${displayName} Implementation in FreeBASIC\n' Generated by SynthelicZ Cipher Tools\n' (c)2006-2025 Hawkynt\n\n` : '';
      
      return `${header}#Include "crt.bi"

Type ${className}
    Declare Constructor()
    Declare Destructor()
    Declare Function Encrypt(ByRef data As String, ByRef key As String) As String
    Declare Function Decrypt(ByRef data As String, ByRef key As String) As String
    
    Private:
    initialized As Boolean
End Type

Constructor ${className}()
    This.initialized = True
End Constructor

Destructor ${className}()
    ' Clean up resources
End Destructor

Function ${className}.Encrypt(ByRef data As String, ByRef key As String) As String
    ${options.includeComments ? "' Encrypt data using " + displayName + " algorithm" : ""}
    If Not This.initialized Then Return ""
    
    ' TODO: Implement ${displayName} encryption
    ' This is a template - actual implementation needed
    
    Return data ' Placeholder
End Function

Function ${className}.Decrypt(ByRef data As String, ByRef key As String) As String
    ${options.includeComments ? "' Decrypt data using " + displayName + " algorithm" : ""}
    If Not This.initialized Then Return ""
    
    ' TODO: Implement ${displayName} decryption
    ' This is a template - actual implementation needed
    
    Return data ' Placeholder
End Function

${options.includeExamples ? `' Example usage:
' Dim cipher As ${className}
' Dim encrypted As String = cipher.Encrypt("Hello World", "secret_key")
' Dim decrypted As String = cipher.Decrypt(encrypted, "secret_key")
' Print "Original: Hello World"
' Print "Encrypted: " + encrypted
' Print "Decrypted: " + decrypted` : ''}`;
    },
    
    /**
     * Generate C# code
     */
    generateCSharp: function(algorithmName, displayName, options) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in C#\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      return `${header}using System;
using System.Text;

namespace SynthelicZ.Cryptography
{
    /// <summary>
    /// ${displayName} cryptographic algorithm implementation
    /// </summary>
    public class ${className}
    {
        private bool initialized = false;
        
        public ${className}()
        {
            initialized = true;
        }
        
        /// <summary>
        /// Encrypts data using ${displayName} algorithm
        /// </summary>
        /// <param name="data">Data to encrypt</param>
        /// <param name="key">Encryption key</param>
        /// <returns>Encrypted data</returns>
        public string Encrypt(string data, string key)
        {
            if (!initialized) throw new InvalidOperationException("Cipher not initialized");
            
            // TODO: Implement ${displayName} encryption
            // This is a template - actual implementation needed
            
            return data; // Placeholder
        }
        
        /// <summary>
        /// Decrypts data using ${displayName} algorithm
        /// </summary>
        /// <param name="data">Data to decrypt</param>
        /// <param name="key">Decryption key</param>
        /// <returns>Decrypted data</returns>
        public string Decrypt(string data, string key)
        {
            if (!initialized) throw new InvalidOperationException("Cipher not initialized");
            
            // TODO: Implement ${displayName} decryption
            // This is a template - actual implementation needed
            
            return data; // Placeholder
        }
        
        public void Dispose()
        {
            // Clean up resources
            initialized = false;
        }
    }

${options.includeExamples ? `    // Example usage:
    // var cipher = new ${className}();
    // string encrypted = cipher.Encrypt("Hello World", "secret_key");
    // string decrypted = cipher.Decrypt(encrypted, "secret_key");
    // Console.WriteLine($"Original: Hello World");
    // Console.WriteLine($"Encrypted: {encrypted}");
    // Console.WriteLine($"Decrypted: {decrypted}");` : ''}
}`;
    },
    
    /**
     * Generate C++ code
     */
    generateCPlusPlus: function(algorithmName, displayName, options) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in C++\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      return `${header}#ifndef ${algorithmName.toUpperCase()}_H
#define ${algorithmName.toUpperCase()}_H

#include <string>
#include <vector>
#include <cstdint>

class ${className} {
private:
    bool initialized;
    
public:
    ${className}();
    ~${className}();
    
    std::string encrypt(const std::string& data, const std::string& key);
    std::string decrypt(const std::string& data, const std::string& key);
    
    bool isInitialized() const { return initialized; }
};

${className}::${className}() : initialized(true) {
    ${options.includeComments ? "// Initialize " + displayName + " cipher" : ""}
}

${className}::~${className}() {
    ${options.includeComments ? "// Clean up resources" : ""}
    initialized = false;
}

std::string ${className}::encrypt(const std::string& data, const std::string& key) {
    ${options.includeComments ? "// Encrypt data using " + displayName + " algorithm" : ""}
    if (!initialized) {
        throw std::runtime_error("Cipher not initialized");
    }
    
    // TODO: Implement ${displayName} encryption
    // This is a template - actual implementation needed
    
    return data; // Placeholder
}

std::string ${className}::decrypt(const std::string& data, const std::string& key) {
    ${options.includeComments ? "// Decrypt data using " + displayName + " algorithm" : ""}
    if (!initialized) {
        throw std::runtime_error("Cipher not initialized");
    }
    
    // TODO: Implement ${displayName} decryption
    // This is a template - actual implementation needed
    
    return data; // Placeholder
}

#endif // ${algorithmName.toUpperCase()}_H

${options.includeExamples ? `/*
Example usage:
#include <iostream>

int main() {
    ${className} cipher;
    std::string encrypted = cipher.encrypt("Hello World", "secret_key");
    std::string decrypted = cipher.decrypt(encrypted, "secret_key");
    
    std::cout << "Original: Hello World" << std::endl;
    std::cout << "Encrypted: " << encrypted << std::endl;
    std::cout << "Decrypted: " << decrypted << std::endl;
    
    return 0;
}
*/` : ''}`;
    },
    
    /**
     * Generate Java code
     */
    generateJava: function(algorithmName, displayName, options) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in Java\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      return `${header}package com.synthelicz.cryptography;

/**
 * ${displayName} cryptographic algorithm implementation
 */
public class ${className} {
    private boolean initialized = false;
    
    public ${className}() {
        this.initialized = true;
    }
    
    /**
     * Encrypts data using ${displayName} algorithm
     * @param data Data to encrypt
     * @param key Encryption key
     * @return Encrypted data
     */
    public String encrypt(String data, String key) {
        if (!initialized) {
            throw new IllegalStateException("Cipher not initialized");
        }
        
        // TODO: Implement ${displayName} encryption
        // This is a template - actual implementation needed
        
        return data; // Placeholder
    }
    
    /**
     * Decrypts data using ${displayName} algorithm
     * @param data Data to decrypt
     * @param key Decryption key
     * @return Decrypted data
     */
    public String decrypt(String data, String key) {
        if (!initialized) {
            throw new IllegalStateException("Cipher not initialized");
        }
        
        // TODO: Implement ${displayName} decryption
        // This is a template - actual implementation needed
        
        return data; // Placeholder
    }
    
    public void dispose() {
        // Clean up resources
        this.initialized = false;
    }
    
    public boolean isInitialized() {
        return initialized;
    }

${options.includeExamples ? `    // Example usage:
    public static void main(String[] args) {
        ${className} cipher = new ${className}();
        String encrypted = cipher.encrypt("Hello World", "secret_key");
        String decrypted = cipher.decrypt(encrypted, "secret_key");
        
        System.out.println("Original: Hello World");
        System.out.println("Encrypted: " + encrypted);
        System.out.println("Decrypted: " + decrypted);
        
        cipher.dispose();
    }` : ''}
}`;
    },
    
    /**
     * Generate Python code
     */
    generatePython: function(algorithmName, displayName, options) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `# ${displayName} Implementation in Python\n# Generated by SynthelicZ Cipher Tools\n# (c)2006-2025 Hawkynt\n\n` : '';
      
      return `${header}from typing import Optional

class ${className}:
    """${displayName} cryptographic algorithm implementation"""
    
    def __init__(self):
        """Initialize the cipher"""
        self.initialized = True
    
    def encrypt(self, data: str, key: str) -> str:
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
        
        # TODO: Implement ${displayName} encryption
        # This is a template - actual implementation needed
        
        return data  # Placeholder
    
    def decrypt(self, data: str, key: str) -> str:
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
        
        # TODO: Implement ${displayName} decryption
        # This is a template - actual implementation needed
        
        return data  # Placeholder
    
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
     * Generate placeholder for other languages
     */
    generateRust: function(algorithmName, displayName, options) {
      return `// ${displayName} implementation in Rust\n// TODO: Rust implementation template`;
    },
    
    generateKotlin: function(algorithmName, displayName, options) {
      return `// ${displayName} implementation in Kotlin\n// TODO: Kotlin implementation template`;
    },
    
    generateDelphi: function(algorithmName, displayName, options) {
      return `// ${displayName} implementation in Delphi\n// TODO: Delphi implementation template`;
    },
    
    generatePerl: function(algorithmName, displayName, options) {
      return `# ${displayName} implementation in Perl\n# TODO: Perl implementation template`;
    },
    
    /**
     * Generate JavaScript code
     */
    generateJavaScript: function(algorithmName, displayName, options) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in JavaScript\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      return `${header}/**
 * ${displayName} cryptographic algorithm implementation
 */
class ${className} {
    constructor() {
        this.initialized = true;
    }
    
    /**
     * Encrypts data using ${displayName} algorithm
     * @param {string} data - Data to encrypt
     * @param {string} key - Encryption key
     * @returns {string} Encrypted data
     */
    encrypt(data, key) {
        if (!this.initialized) {
            throw new Error('Cipher not initialized');
        }
        
        // TODO: Implement ${displayName} encryption
        // This is a template - actual implementation needed
        
        return data; // Placeholder
    }
    
    /**
     * Decrypts data using ${displayName} algorithm
     * @param {string} data - Data to decrypt
     * @param {string} key - Decryption key
     * @returns {string} Decrypted data
     */
    decrypt(data, key) {
        if (!this.initialized) {
            throw new Error('Cipher not initialized');
        }
        
        // TODO: Implement ${displayName} decryption
        // This is a template - actual implementation needed
        
        return data; // Placeholder
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        this.initialized = false;
    }
    
    /**
     * Check if cipher is initialized
     * @returns {boolean} True if initialized
     */
    isInitialized() {
        return this.initialized;
    }
}

${options.includeExamples ? `// Example usage:
const cipher = new ${className}();
const encrypted = cipher.encrypt("Hello World", "secret_key");
const decrypted = cipher.decrypt(encrypted, "secret_key");

console.log("Original: Hello World");
console.log("Encrypted:", encrypted);
console.log("Decrypted:", decrypted);

cipher.dispose();` : ''}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ${className};
} else if (typeof window !== 'undefined') {
    window.${className} = ${className};
}`;
    },
    
    /**
     * Generate Go code
     */
    generateGo: function(algorithmName, displayName, options) {
      const structName = this.toPascalCase(algorithmName);
      const packageName = algorithmName.toLowerCase();
      const header = options.includeComments ? `// ${displayName} Implementation in Go\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      return `${header}package ${packageName}

import (
    "errors"
    "fmt"
)

// ${structName} represents a ${displayName} cipher implementation
type ${structName} struct {
    initialized bool
}

// New${structName} creates a new instance of ${displayName} cipher
func New${structName}() *${structName} {
    return &${structName}{
        initialized: true,
    }
}

// Encrypt encrypts data using ${displayName} algorithm
func (c *${structName}) Encrypt(data, key string) (string, error) {
    if !c.initialized {
        return "", errors.New("cipher not initialized")
    }
    
    // TODO: Implement ${displayName} encryption
    // This is a template - actual implementation needed
    
    return data, nil // Placeholder
}

// Decrypt decrypts data using ${displayName} algorithm
func (c *${structName}) Decrypt(data, key string) (string, error) {
    if !c.initialized {
        return "", errors.New("cipher not initialized")
    }
    
    // TODO: Implement ${displayName} decryption
    // This is a template - actual implementation needed
    
    return data, nil // Placeholder
}

// Dispose cleans up resources
func (c *${structName}) Dispose() {
    c.initialized = false
}

// IsInitialized returns true if cipher is initialized
func (c *${structName}) IsInitialized() bool {
    return c.initialized
}

${options.includeExamples ? `// Example usage:
func Example() {
    cipher := New${structName}()
    defer cipher.Dispose()
    
    encrypted, err := cipher.Encrypt("Hello World", "secret_key")
    if err != nil {
        fmt.Printf("Encryption error: %v\\n", err)
        return
    }
    
    decrypted, err := cipher.Decrypt(encrypted, "secret_key")
    if err != nil {
        fmt.Printf("Decryption error: %v\\n", err)
        return
    }
    
    fmt.Println("Original: Hello World")
    fmt.Printf("Encrypted: %s\\n", encrypted)
    fmt.Printf("Decrypted: %s\\n", decrypted)
}` : ''}`;
    },
    
    /**
     * Convert string to PascalCase
     */
    toPascalCase: function(str) {
      return str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
    },
    
    /**
     * Show code in preview
     */
    showCodePreview: function(language, code) {
      const display = document.getElementById('code-display');
      const title = document.getElementById('preview-title');
      
      if (display) {
        display.textContent = code;
      }
      
      if (title) {
        const langName = this.supportedLanguages[language]?.name || language;
        title.textContent = `${this.currentAlgorithm.name} - ${langName}`;
      }
    },
    
    /**
     * Copy code to clipboard
     */
    copyCodeToClipboard: function() {
      const codeDisplay = document.getElementById('code-display');
      if (!codeDisplay) return;
      
      navigator.clipboard.writeText(codeDisplay.textContent).then(() => {
        // Show temporary feedback
        const copyBtn = document.getElementById('copy-code');
        const original = copyBtn.textContent;
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => {
          copyBtn.textContent = original;
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy code:', err);
      });
    },
    
    /**
     * Download code for a specific language
     */
    downloadCode: function(language) {
      const code = this.generatedCode[language];
      if (!code) return;
      
      const langConfig = this.supportedLanguages[language];
      const filename = `${this.currentAlgorithm.internalName}${langConfig.extension}`;
      
      this.downloadFile(code, filename);
    },
    
    /**
     * Download all generated code as a ZIP
     */
    downloadAllGenerated: function() {
      // For now, download each file separately
      // TODO: Implement ZIP generation
      Object.keys(this.generatedCode).forEach(language => {
        this.downloadCode(language);
      });
    },
    
    /**
     * Download a file
     */
    downloadFile: function(content, filename) {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };
  
  // Export to global scope
  global.CodeGenerationInterface = CodeGenerationInterface;
  
  // Auto-initialize when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        CodeGenerationInterface.init();
      });
    } else {
      CodeGenerationInterface.init();
    }
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeGenerationInterface;
  }
  
})(typeof global !== 'undefined' ? global : window);