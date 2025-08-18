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
      
      // Get the actual algorithm implementation
      const implementation = this.extractAlgorithmImplementation(algorithm);
      
      switch (language) {
        case 'freebasic':
          return this.generateFreeBASIC(algorithmName, displayName, options, implementation);
        case 'csharp':
          return this.generateCSharp(algorithmName, displayName, options, implementation);
        case 'cpp':
          return this.generateCPlusPlus(algorithmName, displayName, options, implementation);
        case 'java':
          return this.generateJava(algorithmName, displayName, options, implementation);
        case 'python':
          return this.generatePython(algorithmName, displayName, options, implementation);
        case 'rust':
          return this.generateRust(algorithmName, displayName, options, implementation);
        case 'kotlin':
          return this.generateKotlin(algorithmName, displayName, options, implementation);
        case 'delphi':
          return this.generateDelphi(algorithmName, displayName, options, implementation);
        case 'perl':
          return this.generatePerl(algorithmName, displayName, options, implementation);
        case 'javascript':
          return this.generateJavaScript(algorithmName, displayName, options, implementation);
        case 'go':
          return this.generateGo(algorithmName, displayName, options, implementation);
        default:
          throw new Error(`Unsupported language: ${language}`);
      }
    },
    
    /**
     * Extract implementation details from algorithm object
     */
    extractAlgorithmImplementation: function(algorithm) {
      const implementation = {
        encryptCode: '',
        decryptCode: '',
        constants: {},
        keySetup: '',
        hasConstants: false
      };
      
      try {
        // Try to get the actual encrypt/decrypt function code
        if (algorithm.encryptBlock && typeof algorithm.encryptBlock === 'function') {
          implementation.encryptCode = this.extractFunctionBody(algorithm.encryptBlock);
        }
        
        if (algorithm.decryptBlock && typeof algorithm.decryptBlock === 'function') {
          implementation.decryptCode = this.extractFunctionBody(algorithm.decryptBlock);
        }
        
        // Extract constants if they exist
        const constantKeys = Object.keys(algorithm).filter(key => 
          typeof algorithm[key] === 'string' && 
          key.toUpperCase() === key && 
          algorithm[key].length > 0
        );
        
        constantKeys.forEach(key => {
          implementation.constants[key] = algorithm[key];
          implementation.hasConstants = true;
        });
        
      } catch (error) {
        console.warn('Could not extract implementation details:', error.message);
      }
      
      return implementation;
    },
    
    /**
     * Extract function body from JavaScript function
     */
    extractFunctionBody: function(func) {
      try {
        const funcStr = func.toString();
        const bodyMatch = funcStr.match(/\{([\s\S]*)\}/);
        if (bodyMatch) {
          return bodyMatch[1].trim();
        }
      } catch (error) {
        console.warn('Could not extract function body:', error.message);
      }
      return '';
    },
    
    /**
     * Generate FreeBASIC code
     */
    generateFreeBASIC: function(algorithmName, displayName, options, implementation) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `' ${displayName} Implementation in FreeBASIC\n' Generated by SynthelicZ Cipher Tools\n' (c)2006-2025 Hawkynt\n\n` : '';
      
      // Convert implementation to FreeBASIC
      const encryptCode = this.convertToFreeBASIC(implementation.encryptCode, 'encrypt');
      const decryptCode = this.convertToFreeBASIC(implementation.decryptCode, 'decrypt');
      const constants = this.generateFreeBASICConstants(implementation.constants);
      
      return `${header}#Include "crt.bi"

${constants}Type ${className}
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
    
    ${encryptCode || `' ${displayName} encryption
    ' Implement ${displayName} encryption logic here
    Return data ' Placeholder`}
End Function

Function ${className}.Decrypt(ByRef data As String, ByRef key As String) As String
    ${options.includeComments ? "' Decrypt data using " + displayName + " algorithm" : ""}
    If Not This.initialized Then Return ""
    
    ${decryptCode || `' ${displayName} decryption
    ' Implement ${displayName} decryption logic here
    Return data ' Placeholder`}
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
    generateCSharp: function(algorithmName, displayName, options, implementation) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in C#\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      // Convert implementation to C#
      const encryptCode = this.convertToCSharp(implementation.encryptCode, 'encrypt');
      const decryptCode = this.convertToCSharp(implementation.decryptCode, 'decrypt');
      const constants = this.generateCSharpConstants(implementation.constants);
      
      return `${header}using System;
using System.Text;

namespace SynthelicZ.Cryptography
{
    /// <summary>
    /// ${displayName} cryptographic algorithm implementation
    /// </summary>
    public class ${className}
    {
        ${constants}private bool initialized = false;
        
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
            
            ${encryptCode || `// ${displayName} encryption
            return data; // Placeholder - implement ${displayName} encryption`}
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
            
            ${decryptCode || `// ${displayName} decryption
            return data; // Placeholder - implement ${displayName} decryption`}
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
     * Convert JavaScript code to C#
     */
    convertToCSharp: function(jsCode, methodType) {
      if (!jsCode) return '';
      
      try {
        // Basic JavaScript to C# conversion
        let converted = jsCode
          // Remove function parameter validation
          .replace(/if\s*\(\s*!.*instances\[.*?\]\s*\)\s*\{[\s\S]*?return.*?;\s*\}/g, '')
          // Convert variable declarations
          .replace(/let\s+(\w+)\s*=\s*''/g, 'string $1 = "";')
          .replace(/let\s+(\w+)\s*=\s*/g, 'var $1 = ')
          .replace(/const\s+(\w+)\s*=\s*/g, 'var $1 = ')
          // Convert string methods
          .replace(/\.charAt\((\w+)\)/g, '[$1]')
          .replace(/\.length/g, '.Length')
          .replace(/\.indexOf\(/g, '.IndexOf(')
          // Convert for loops
          .replace(/for\s*\(\s*let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g, 'for (int $1 = $2; $1 < $3; $1++)')
          // Convert operators
          .replace(/!==/g, '!=')
          .replace(/===/g, '==')
          // Parameter names
          .replace(/\bplaintext\b/g, 'data')
          .replace(/\bciphertext\b/g, 'data')
          // Add proper indentation
          .split('\n')
          .map(line => '            ' + line.trim())
          .filter(line => line.trim().length > 0)
          .join('\n');
          
        return converted;
      } catch (error) {
        console.warn('Error converting to C#:', error.message);
        return `            // Converted ${methodType} implementation\n            return data; // Conversion failed`;
      }
    },
    
    /**
     * Generate C# constants
     */
    generateCSharpConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `        private const string ${key} = "${value}";`;
      });
      
      return constLines.join('\n') + '\n        ';
    },
    
    /**
     * Generate C++ code
     */
    generateCPlusPlus: function(algorithmName, displayName, options, implementation) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in C++\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      // Convert implementation to C++
      const encryptCode = this.convertToCPlusPlus(implementation.encryptCode, 'encrypt');
      const decryptCode = this.convertToCPlusPlus(implementation.decryptCode, 'decrypt');
      const constants = this.generateCPlusPlusConstants(implementation.constants);
      
      return `${header}#ifndef ${algorithmName.toUpperCase()}_H
#define ${algorithmName.toUpperCase()}_H

#include <string>
#include <vector>
#include <cstdint>

class ${className} {
private:
    bool initialized;
    ${constants}
    
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
    
    ${encryptCode || `// ${displayName} encryption
    // Implement ${displayName} encryption logic here
    return data; // Placeholder`}
}

std::string ${className}::decrypt(const std::string& data, const std::string& key) {
    ${options.includeComments ? "// Decrypt data using " + displayName + " algorithm" : ""}
    if (!initialized) {
        throw std::runtime_error("Cipher not initialized");
    }
    
    ${decryptCode || `// ${displayName} decryption
    // Implement ${displayName} decryption logic here
    return data; // Placeholder`}
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
    generateJava: function(algorithmName, displayName, options, implementation) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in Java\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      // Convert implementation to Java
      const encryptCode = this.convertToJava(implementation.encryptCode, 'encrypt');
      const decryptCode = this.convertToJava(implementation.decryptCode, 'decrypt');
      const constants = this.generateJavaConstants(implementation.constants);
      
      return `${header}package com.synthelicz.cryptography;

/**
 * ${displayName} cryptographic algorithm implementation
 */
public class ${className} {
    ${constants}private boolean initialized = false;
    
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
        
        ${encryptCode || `// ${displayName} encryption
        // Implement ${displayName} encryption logic here
        return data; // Placeholder`}
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
        
        ${decryptCode || `// ${displayName} decryption
        // Implement ${displayName} decryption logic here
        return data; // Placeholder`}
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
    generatePython: function(algorithmName, displayName, options, implementation) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `# ${displayName} Implementation in Python\n# Generated by SynthelicZ Cipher Tools\n# (c)2006-2025 Hawkynt\n\n` : '';
      
      // Convert implementation to Python
      const encryptCode = this.convertToPython(implementation.encryptCode, 'encrypt');
      const decryptCode = this.convertToPython(implementation.decryptCode, 'decrypt');
      const constants = this.generatePythonConstants(implementation.constants);
      
      return `${header}from typing import Optional

class ${className}:
    """${displayName} cryptographic algorithm implementation"""
    
    ${constants}def __init__(self):
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
        
        ${encryptCode || `# ${displayName} encryption
        return data  # Placeholder - implement ${displayName} encryption`}
    
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
        
        ${decryptCode || `# ${displayName} decryption
        return data  # Placeholder - implement ${displayName} decryption`}
    
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
     * Convert JavaScript code to Python
     */
    convertToPython: function(jsCode, methodType) {
      if (!jsCode) return '';
      
      try {
        // Basic JavaScript to Python conversion
        let converted = jsCode
          // Remove function parameter validation
          .replace(/if\s*\(\s*!.*instances\[.*?\]\s*\)\s*\{[\s\S]*?return.*?;\s*\}/g, '')
          // Convert variable declarations
          .replace(/let\s+(\w+)\s*=\s*''/g, '$1 = ""')
          .replace(/let\s+(\w+)\s*=\s*/g, '$1 = ')
          .replace(/const\s+(\w+)\s*=\s*/g, '$1 = ')
          // Convert string methods
          .replace(/\.charAt\((\w+)\)/g, '[$1]')
          .replace(/\.length/g, 'len($&)')
          .replace(/\.indexOf\(/g, '.find(')
          // Convert for loops
          .replace(/for\s*\(\s*let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g, 'for $1 in range($2, $3):')
          // Convert operators
          .replace(/!==/g, '!=')
          .replace(/===/g, '==')
          // Parameter names
          .replace(/\bplaintext\b/g, 'data')
          .replace(/\bciphertext\b/g, 'data')
          // Add proper indentation
          .split('\n')
          .map(line => '        ' + line.trim())
          .filter(line => line.trim().length > 0)
          .join('\n');
          
        return converted;
      } catch (error) {
        console.warn('Error converting to Python:', error.message);
        return `        # Converted ${methodType} implementation\n        return data  # Conversion failed`;
      }
    },
    
    /**
     * Generate Python constants
     */
    generatePythonConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    ${key} = "${value}"`;
      });
      
      return constLines.join('\n') + '\n    \n    ';
    },
    
    /**
     * Convert JavaScript code to FreeBASIC
     */
    convertToFreeBASIC: function(jsCode, methodType) {
      if (!jsCode) return '';
      
      try {
        let converted = jsCode
          .replace(/if\s*\(\s*!.*instances\[.*?\]\s*\)\s*\{[\s\S]*?return.*?;\s*\}/g, '')
          .replace(/let\s+(\w+)\s*=\s*''/g, 'Dim $1 As String = ""')
          .replace(/let\s+(\w+)\s*=\s*/g, 'Dim $1 As String = ')
          .replace(/const\s+(\w+)\s*=\s*/g, 'Dim $1 As String = ')
          .replace(/\.charAt\((\w+)\)/g, 'Mid($&, $1 + 1, 1)')
          .replace(/\.length/g, 'Len($&)')
          .replace(/\.indexOf\(/g, 'InStr(')
          .replace(/for\s*\(\s*let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g, 'For $1 As Integer = $2 To $3 - 1')
          .replace(/\bplaintext\b/g, 'data')
          .replace(/\bciphertext\b/g, 'data')
          .split('\n')
          .map(line => '    ' + line.trim())
          .filter(line => line.trim().length > 0)
          .join('\n');
          
        return converted;
      } catch (error) {
        console.warn('Error converting to FreeBASIC:', error.message);
        return `    ' Converted ${methodType} implementation\n    Return data ' Conversion failed`;
      }
    },
    
    /**
     * Convert JavaScript code to C++
     */
    convertToCPlusPlus: function(jsCode, methodType) {
      if (!jsCode) return '';
      
      try {
        let converted = jsCode
          .replace(/if\s*\(\s*!.*instances\[.*?\]\s*\)\s*\{[\s\S]*?return.*?;\s*\}/g, '')
          .replace(/let\s+(\w+)\s*=\s*''/g, 'std::string $1 = "";')
          .replace(/let\s+(\w+)\s*=\s*/g, 'auto $1 = ')
          .replace(/const\s+(\w+)\s*=\s*/g, 'const auto $1 = ')
          .replace(/\.charAt\((\w+)\)/g, '[$1]')
          .replace(/\.length/g, '.length()')
          .replace(/\.indexOf\(/g, '.find(')
          .replace(/for\s*\(\s*let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g, 'for (int $1 = $2; $1 < $3; ++$1)')
          .replace(/\bplaintext\b/g, 'data')
          .replace(/\bciphertext\b/g, 'data')
          .split('\n')
          .map(line => '    ' + line.trim())
          .filter(line => line.trim().length > 0)
          .join('\n');
          
        return converted;
      } catch (error) {
        console.warn('Error converting to C++:', error.message);
        return `    // Converted ${methodType} implementation\n    return data; // Conversion failed`;
      }
    },
    
    /**
     * Convert JavaScript code to Java
     */
    convertToJava: function(jsCode, methodType) {
      if (!jsCode) return '';
      
      try {
        let converted = jsCode
          .replace(/if\s*\(\s*!.*instances\[.*?\]\s*\)\s*\{[\s\S]*?return.*?;\s*\}/g, '')
          .replace(/let\s+(\w+)\s*=\s*''/g, 'String $1 = "";')
          .replace(/let\s+(\w+)\s*=\s*/g, 'var $1 = ')
          .replace(/const\s+(\w+)\s*=\s*/g, 'final var $1 = ')
          .replace(/\.charAt\((\w+)\)/g, '.charAt($1)')
          .replace(/\.length/g, '.length()')
          .replace(/\.indexOf\(/g, '.indexOf(')
          .replace(/for\s*\(\s*let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g, 'for (int $1 = $2; $1 < $3; $1++)')
          .replace(/\bplaintext\b/g, 'data')
          .replace(/\bciphertext\b/g, 'data')
          .split('\n')
          .map(line => '        ' + line.trim())
          .filter(line => line.trim().length > 0)
          .join('\n');
          
        return converted;
      } catch (error) {
        console.warn('Error converting to Java:', error.message);
        return `        // Converted ${methodType} implementation\n        return data; // Conversion failed`;
      }
    },
    
    /**
     * Convert JavaScript code to Rust
     */
    convertToRust: function(jsCode, methodType) {
      if (!jsCode) return '';
      
      try {
        let converted = jsCode
          .replace(/if\s*\(\s*!.*instances\[.*?\]\s*\)\s*\{[\s\S]*?return.*?;\s*\}/g, '')
          .replace(/let\s+(\w+)\s*=\s*''/g, 'let mut $1 = String::new();')
          .replace(/let\s+(\w+)\s*=\s*/g, 'let $1 = ')
          .replace(/const\s+(\w+)\s*=\s*/g, 'let $1 = ')
          .replace(/\.charAt\((\w+)\)/g, '.chars().nth($1).unwrap_or(\' \')')
          .replace(/\.length/g, '.len()')
          .replace(/\.indexOf\(/g, '.find(')
          .replace(/for\s*\(\s*let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g, 'for $1 in $2..$3')
          .replace(/\bplaintext\b/g, 'data')
          .replace(/\bciphertext\b/g, 'data')
          .split('\n')
          .map(line => '        ' + line.trim())
          .filter(line => line.trim().length > 0)
          .join('\n');
          
        return converted + '\n        Ok(data.to_string())';
      } catch (error) {
        console.warn('Error converting to Rust:', error.message);
        return `        // Converted ${methodType} implementation\n        Ok(data.to_string()) // Conversion failed`;
      }
    },
    
    /**
     * Convert JavaScript code to Kotlin
     */
    convertToKotlin: function(jsCode, methodType) {
      if (!jsCode) return '';
      
      try {
        let converted = jsCode
          .replace(/if\s*\(\s*!.*instances\[.*?\]\s*\)\s*\{[\s\S]*?return.*?;\s*\}/g, '')
          .replace(/let\s+(\w+)\s*=\s*''/g, 'var $1 = ""')
          .replace(/let\s+(\w+)\s*=\s*/g, 'var $1 = ')
          .replace(/const\s+(\w+)\s*=\s*/g, 'val $1 = ')
          .replace(/\.charAt\((\w+)\)/g, '[$1]')
          .replace(/\.length/g, '.length')
          .replace(/\.indexOf\(/g, '.indexOf(')
          .replace(/for\s*\(\s*let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g, 'for ($1 in $2 until $3)')
          .replace(/\bplaintext\b/g, 'data')
          .replace(/\bciphertext\b/g, 'data')
          .split('\n')
          .map(line => '        ' + line.trim())
          .filter(line => line.trim().length > 0)
          .join('\n');
          
        return converted;
      } catch (error) {
        console.warn('Error converting to Kotlin:', error.message);
        return `        // Converted ${methodType} implementation\n        return data // Conversion failed`;
      }
    },
    
    /**
     * Convert JavaScript code to Delphi
     */
    convertToDelphi: function(jsCode, methodType) {
      if (!jsCode) return '';
      
      try {
        let converted = jsCode
          .replace(/if\s*\(\s*!.*instances\[.*?\]\s*\)\s*\{[\s\S]*?return.*?;\s*\}/g, '')
          .replace(/let\s+(\w+)\s*=\s*''/g, '$1: string;')
          .replace(/let\s+(\w+)\s*=\s*/g, '$1: string;')
          .replace(/const\s+(\w+)\s*=\s*/g, '$1: string;')
          .replace(/\.charAt\((\w+)\)/g, '[$1 + 1]')
          .replace(/\.length/g, 'Length($&)')
          .replace(/\.indexOf\(/g, 'Pos(')
          .replace(/for\s*\(\s*let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g, 'for $1 := $2 to $3 - 1 do')
          .replace(/\bplaintext\b/g, 'Data')
          .replace(/\bciphertext\b/g, 'Data')
          .split('\n')
          .map(line => '  ' + line.trim())
          .filter(line => line.trim().length > 0)
          .join('\n');
          
        return converted;
      } catch (error) {
        console.warn('Error converting to Delphi:', error.message);
        return `  // Converted ${methodType} implementation\n  Result := Data; // Conversion failed`;
      }
    },
    
    /**
     * Convert JavaScript code to Perl
     */
    convertToPerl: function(jsCode, methodType) {
      if (!jsCode) return '';
      
      try {
        let converted = jsCode
          .replace(/if\s*\(\s*!.*instances\[.*?\]\s*\)\s*\{[\s\S]*?return.*?;\s*\}/g, '')
          .replace(/let\s+(\w+)\s*=\s*''/g, 'my \\$$1 = "";')
          .replace(/let\s+(\w+)\s*=\s*/g, 'my \\$$1 = ')
          .replace(/const\s+(\w+)\s*=\s*/g, 'my \\$$1 = ')
          .replace(/\.charAt\((\w+)\)/g, 'substr($&, $1, 1)')
          .replace(/\.length/g, 'length($&)')
          .replace(/\.indexOf\(/g, 'index(')
          .replace(/for\s*\(\s*let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g, 'for my \\$$1 ($2..$3-1)')
          .replace(/\bplaintext\b/g, '$data')
          .replace(/\bciphertext\b/g, '$data')
          .split('\n')
          .map(line => '    ' + line.trim())
          .filter(line => line.trim().length > 0)
          .join('\n');
          
        return converted;
      } catch (error) {
        console.warn('Error converting to Perl:', error.message);
        return `    # Converted ${methodType} implementation\n    return $data; # Conversion failed`;
      }
    },
    
    /**
     * Generate constants for all languages
     */
    generateFreeBASICConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `Const ${key} As String = "${value}"`;
      });
      return constLines.join('\n') + '\n';
    },
    
    generateCPlusPlusConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    static const std::string ${key};`;
      });
      return constLines.join('\n') + '\n';
    },
    
    generateJavaConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    private static final String ${key} = "${value}";`;
      });
      return constLines.join('\n') + '\n    ';
    },
    
    generateRustConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `const ${key}: &str = "${value}";`;
      });
      return constLines.join('\n') + '\n';
    },
    
    generateKotlinConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    companion object { const val ${key} = "${value}" }`;
      });
      return constLines.join('\n') + '\n    ';
    },
    
    generateDelphiConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `  ${key} = '${value}';`;
      });
      return 'const\n' + constLines.join('\n') + '\n';
    },
    
    generatePerlConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `our $${key} = "${value}";`;
      });
      return constLines.join('\n') + '\n';
    },
    
    /**
     * Generate Rust code
     */
    generateRust: function(algorithmName, displayName, options, implementation) {
      const structName = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in Rust\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      // Convert implementation to Rust
      const encryptCode = this.convertToRust(implementation.encryptCode, 'encrypt');
      const decryptCode = this.convertToRust(implementation.decryptCode, 'decrypt');
      const constants = this.generateRustConstants(implementation.constants);
      
      return `${header}use std::collections::HashMap;

${constants}
/// ${displayName} cryptographic algorithm implementation
pub struct ${structName} {
    initialized: bool,
}

impl ${structName} {
    /// Creates a new instance of ${displayName} cipher
    pub fn new() -> Self {
        ${structName} {
            initialized: true,
        }
    }
    
    /// Encrypts data using ${displayName} algorithm
    pub fn encrypt(&self, data: &str, key: &str) -> Result<String, &'static str> {
        if !self.initialized {
            return Err("Cipher not initialized");
        }
        
        ${encryptCode || `// ${displayName} encryption
        // Implement ${displayName} encryption logic here
        Ok(data.to_string()) // Placeholder`}
    }
    
    /// Decrypts data using ${displayName} algorithm
    pub fn decrypt(&self, data: &str, key: &str) -> Result<String, &'static str> {
        if !self.initialized {
            return Err("Cipher not initialized");
        }
        
        ${decryptCode || `// ${displayName} decryption
        // Implement ${displayName} decryption logic here
        Ok(data.to_string()) // Placeholder`}
    }
    
    /// Check if cipher is initialized
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }
}

impl Drop for ${structName} {
    fn drop(&mut self) {
        // Clean up resources
        self.initialized = false;
    }
}

${options.includeExamples ? `#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn example_usage() {
        let cipher = ${structName}::new();
        let encrypted = cipher.encrypt("Hello World", "secret_key").unwrap();
        let decrypted = cipher.decrypt(&encrypted, "secret_key").unwrap();
        
        println!("Original: Hello World");
        println!("Encrypted: {}", encrypted);
        println!("Decrypted: {}", decrypted);
        
        assert_eq!(decrypted, "Hello World");
    }
}` : ''}`;
    },
    
    generateKotlin: function(algorithmName, displayName, options, implementation) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in Kotlin\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      // Convert implementation to Kotlin
      const encryptCode = this.convertToKotlin(implementation.encryptCode, 'encrypt');
      const decryptCode = this.convertToKotlin(implementation.decryptCode, 'decrypt');
      const constants = this.generateKotlinConstants(implementation.constants);
      
      return `${header}package com.synthelicz.cryptography

/**
 * ${displayName} cryptographic algorithm implementation
 */
class ${className} {
    ${constants}private var initialized = true
    
    /**
     * Encrypts data using ${displayName} algorithm
     * @param data Data to encrypt
     * @param key Encryption key
     * @return Encrypted data
     */
    fun encrypt(data: String, key: String): String {
        if (!initialized) {
            throw IllegalStateException("Cipher not initialized")
        }
        
        ${encryptCode || `// ${displayName} encryption
        // Implement ${displayName} encryption logic here
        return data // Placeholder`}
    }
    
    /**
     * Decrypts data using ${displayName} algorithm
     * @param data Data to decrypt
     * @param key Decryption key
     * @return Decrypted data
     */
    fun decrypt(data: String, key: String): String {
        if (!initialized) {
            throw IllegalStateException("Cipher not initialized")
        }
        
        ${decryptCode || `// ${displayName} decryption
        // Implement ${displayName} decryption logic here
        return data // Placeholder`}
    }
    
    /**
     * Clean up resources
     */
    fun dispose() {
        initialized = false
    }
    
    /**
     * Check if cipher is initialized
     */
    fun isInitialized(): Boolean = initialized
}

${options.includeExamples ? `// Example usage:
fun main() {
    val cipher = ${className}()
    val encrypted = cipher.encrypt("Hello World", "secret_key")
    val decrypted = cipher.decrypt(encrypted, "secret_key")
    
    println("Original: Hello World")
    println("Encrypted: \$encrypted")
    println("Decrypted: \$decrypted")
    
    cipher.dispose()
}` : ''}`;
    },
    
    generateDelphi: function(algorithmName, displayName, options, implementation) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in Delphi\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      // Convert implementation to Delphi
      const encryptCode = this.convertToDelphi(implementation.encryptCode, 'encrypt');
      const decryptCode = this.convertToDelphi(implementation.decryptCode, 'decrypt');
      const constants = this.generateDelphiConstants(implementation.constants);
      
      return `${header}unit ${className};

interface

uses
  SysUtils, Classes;

${constants}

type
  T${className} = class
  private
    FInitialized: Boolean;
  public
    constructor Create;
    destructor Destroy; override;
    
    function Encrypt(const Data, Key: string): string;
    function Decrypt(const Data, Key: string): string;
    procedure Dispose;
    
    property Initialized: Boolean read FInitialized;
  end;

implementation

constructor T${className}.Create;
begin
  inherited Create;
  FInitialized := True;
end;

destructor T${className}.Destroy;
begin
  Dispose;
  inherited Destroy;
end;

function T${className}.Encrypt(const Data, Key: string): string;
begin
  if not FInitialized then
    raise Exception.Create('Cipher not initialized');
    
  ${encryptCode || `// ${displayName} encryption
  // Implement ${displayName} encryption logic here
  Result := Data; // Placeholder`}
end;

function T${className}.Decrypt(const Data, Key: string): string;
begin
  if not FInitialized then
    raise Exception.Create('Cipher not initialized');
    
  ${decryptCode || `// ${displayName} decryption
  // Implement ${displayName} decryption logic here
  Result := Data; // Placeholder`}
end;

procedure T${className}.Dispose;
begin
  FInitialized := False;
end;

${options.includeExamples ? `// Example usage:
// var
//   Cipher: T${className};
//   Encrypted, Decrypted: string;
// begin
//   Cipher := T${className}.Create;
//   try
//     Encrypted := Cipher.Encrypt('Hello World', 'secret_key');
//     Decrypted := Cipher.Decrypt(Encrypted, 'secret_key');
//     
//     WriteLn('Original: Hello World');
//     WriteLn('Encrypted: ', Encrypted);
//     WriteLn('Decrypted: ', Decrypted);
//   finally
//     Cipher.Free;
//   end;
// end.` : ''}

end.`;
    },
    
    generatePerl: function(algorithmName, displayName, options, implementation) {
      const packageName = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `# ${displayName} Implementation in Perl\n# Generated by SynthelicZ Cipher Tools\n# (c)2006-2025 Hawkynt\n\n` : '';
      
      // Convert implementation to Perl
      const encryptCode = this.convertToPerl(implementation.encryptCode, 'encrypt');
      const decryptCode = this.convertToPerl(implementation.decryptCode, 'decrypt');
      const constants = this.generatePerlConstants(implementation.constants);
      
      return `${header}package ${packageName};

use strict;
use warnings;
use Carp;

${constants}

sub new {
    my $class = shift;
    my $self = {
        initialized => 1,
    };
    return bless $self, $class;
}

sub encrypt {
    my ($self, $data, $key) = @_;
    
    croak "Cipher not initialized" unless $self->{initialized};
    
    ${encryptCode || `# ${displayName} encryption
    # Implement ${displayName} encryption logic here
    return $data; # Placeholder`}
}

sub decrypt {
    my ($self, $data, $key) = @_;
    
    croak "Cipher not initialized" unless $self->{initialized};
    
    ${decryptCode || `# ${displayName} decryption
    # Implement ${displayName} decryption logic here
    return $data; # Placeholder`}
}

sub dispose {
    my $self = shift;
    $self->{initialized} = 0;
}

sub is_initialized {
    my $self = shift;
    return $self->{initialized};
}

sub DESTROY {
    my $self = shift;
    $self->dispose();
}

${options.includeExamples ? `# Example usage:
# my $cipher = ${packageName}->new();
# my $encrypted = $cipher->encrypt("Hello World", "secret_key");
# my $decrypted = $cipher->decrypt($encrypted, "secret_key");
# 
# print "Original: Hello World\\n";
# print "Encrypted: $encrypted\\n";
# print "Decrypted: $decrypted\\n";
# 
# $cipher->dispose();` : ''}

1; # End of module`;
    },
    
    /**
     * Generate JavaScript code
     */
    generateJavaScript: function(algorithmName, displayName, options, implementation) {
      const className = this.toPascalCase(algorithmName);
      const header = options.includeComments ? `// ${displayName} Implementation in JavaScript\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      // Convert implementation to JavaScript
      const encryptCode = this.convertToJavaScript(implementation.encryptCode, 'encrypt');
      const decryptCode = this.convertToJavaScript(implementation.decryptCode, 'decrypt');
      const constants = this.generateJavaScriptConstants(implementation.constants);
      
      return `${header}/**
 * ${displayName} cryptographic algorithm implementation
 */
class ${className} {
    ${constants ? constants + '\n    ' : ''}constructor() {
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
        
        ${encryptCode || `// ${displayName} encryption
        return data; // Placeholder - implement ${displayName} encryption`}
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
        
        ${decryptCode || `// ${displayName} decryption
        return data; // Placeholder - implement ${displayName} decryption`}
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
    generateGo: function(algorithmName, displayName, options, implementation) {
      const structName = this.toPascalCase(algorithmName);
      const packageName = algorithmName.toLowerCase();
      const header = options.includeComments ? `// ${displayName} Implementation in Go\n// Generated by SynthelicZ Cipher Tools\n// (c)2006-2025 Hawkynt\n\n` : '';
      
      // Convert implementation to Go
      const encryptCode = this.convertToGo(implementation.encryptCode, 'encrypt');
      const decryptCode = this.convertToGo(implementation.decryptCode, 'decrypt');
      const constants = this.generateGoConstants(implementation.constants);
      
      return `${header}package ${packageName}

import (
    "errors"
    "fmt"
)

${constants}

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
    
    ${encryptCode || `// ${displayName} encryption
    return data, nil // Placeholder - implement ${displayName} encryption`}
}

// Decrypt decrypts data using ${displayName} algorithm
func (c *${structName}) Decrypt(data, key string) (string, error) {
    if !c.initialized {
        return "", errors.New("cipher not initialized")
    }
    
    ${decryptCode || `// ${displayName} decryption
    return data, nil // Placeholder - implement ${displayName} decryption`}
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
     * Convert JavaScript code to JavaScript (clean up and format)
     */
    convertToJavaScript: function(jsCode, methodType) {
      if (!jsCode) return '';
      
      try {
        // Basic cleanup and conversion
        let converted = jsCode
          // Remove function parameter validation since we handle it in the wrapper
          .replace(/if\s*\(\s*!.*instances\[.*?\]\s*\)\s*\{[\s\S]*?return.*?;\s*\}/g, '')
          // Replace parameter names
          .replace(/\bplaintext\b/g, 'data')
          .replace(/\bciphertext\b/g, 'data')
          // Clean up variable declarations
          .replace(/let\s+result\s*=\s*'';/, 'let result = "";')
          // Fix string concatenation
          .replace(/result\s*\+=\s*/g, 'result += ')
          // Add proper indentation
          .split('\n')
          .map(line => '        ' + line.trim())
          .filter(line => line.trim().length > 0)
          .join('\n');
          
        return converted;
      } catch (error) {
        console.warn('Error converting JavaScript code:', error.message);
        return `// Converted ${methodType} implementation\n        return data; // Conversion failed`;
      }
    },
    
    /**
     * Convert JavaScript code to Go
     */
    convertToGo: function(jsCode, methodType) {
      if (!jsCode) return '';
      
      try {
        // Basic JavaScript to Go conversion
        let converted = jsCode
          // Remove function parameter validation
          .replace(/if\s*\(\s*!.*instances\[.*?\]\s*\)\s*\{[\s\S]*?return.*?;\s*\}/g, '')
          // Convert variable declarations
          .replace(/let\s+(\w+)\s*=\s*''/g, '$1 := ""')
          .replace(/let\s+(\w+)\s*=\s*/g, '$1 := ')
          .replace(/const\s+(\w+)\s*=\s*/g, '$1 := ')
          // Convert string methods
          .replace(/\.charAt\(/g, '[')
          .replace(/\.charAt\((\w+)\)/g, '[$1]')
          .replace(/\.length/g, 'len($&)')
          .replace(/\.indexOf\(/g, 'strings.Index(')
          // Convert for loops
          .replace(/for\s*\(\s*let\s+(\w+)\s*=\s*(\d+);\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g, 'for $1 := $2; $1 < $3; $1++')
          // Parameter names
          .replace(/\bplaintext\b/g, 'data')
          .replace(/\bciphertext\b/g, 'data')
          // Add proper indentation
          .split('\n')
          .map(line => '    ' + line.trim())
          .filter(line => line.trim().length > 0)
          .join('\n');
          
        return converted + '\n    return data, nil';
      } catch (error) {
        console.warn('Error converting to Go:', error.message);
        return `// Converted ${methodType} implementation\n    return data, nil // Conversion failed`;
      }
    },
    
    /**
     * Generate JavaScript constants
     */
    generateJavaScriptConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `static ${key} = "${value}";`;
      });
      
      return constLines.join('\n    ');
    },
    
    /**
     * Generate Go constants
     */
    generateGoConstants: function(constants) {
      if (!constants || Object.keys(constants).length === 0) return '';
      
      const constLines = Object.entries(constants).map(([key, value]) => {
        return `    ${key.toLowerCase()} = "${value}"`;
      });
      
      return 'const (\n' + constLines.join('\n') + '\n)';
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