/**
 * TypeScript Language Plugin for Multi-Language Code Generation
 * Generates TypeScript compatible code from JavaScript AST
 *
 * Follows the LanguagePlugin specification exactly
 *
 * Uses AST pipeline: JS AST -> TS AST (via TypeScriptTransformer) -> TS Code (via TypeScriptEmitter)
 */

// Import the framework
// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let TypeScriptAST, TypeScriptEmitter, TypeScriptTransformer;

if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;

  // Load AST pipeline components (required)
  try {
    TypeScriptAST = require('./TypeScriptAST.js');
    const emitterModule = require('./TypeScriptEmitter.js');
    TypeScriptEmitter = emitterModule.TypeScriptEmitter;
    const transformerModule = require('./TypeScriptTransformer.js');
    TypeScriptTransformer = transformerModule.TypeScriptTransformer;
  } catch (e) {
    // Pipeline components not available - plugin will fail
    console.warn('TypeScript AST pipeline components not loaded:', e.message);
  }
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  TypeScriptAST = window.TypeScriptAST;
  TypeScriptEmitter = window.TypeScriptEmitter;
  TypeScriptTransformer = window.TypeScriptTransformer;
}

/**
 * TypeScript Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class TypeScriptPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'TypeScript';
    this.extension = 'ts';
    this.icon = '📘';
    this.description = 'TypeScript code generator';
    this.mimeType = 'text/x-typescript';
    this.version = '5.0+';
    
    // TypeScript-specific options
    this.options = {
      indent: '  ', // 2 spaces (common TS convention)
      lineEnding: '\n',
      strictTypes: true,
      addJSDoc: true,
      useInterfaces: true,
      exportAll: false
    };
  }

  /**
   * Generate TypeScript code from Abstract Syntax Tree
   * Uses AST pipeline: JS AST -> TS AST -> TS Emitter -> TS Source
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Merge options
      const mergedOptions = { ...this.options, ...options };

      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }

      // Validate AST pipeline components are available
      if (!TypeScriptTransformer || !TypeScriptEmitter) {
        return this.CreateErrorResult('TypeScript AST pipeline components not loaded');
      }

      // Create transformer with options
      const transformer = new TypeScriptTransformer({
        typeKnowledge: mergedOptions.parser?.typeKnowledge || mergedOptions.typeKnowledge
      });

      // Transform JS AST to TypeScript AST
      const tsAst = transformer.transform(ast);

      // Create emitter with options
      const emitter = new TypeScriptEmitter({
        indent: mergedOptions.indent || '  ',
        newline: mergedOptions.lineEnding || mergedOptions.newline || '\n'
      });

      // Emit TypeScript code from TypeScript AST
      const code = emitter.emit(tsAst);

      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);

      // Generate warnings if any
      const warnings = this._generateWarnings(ast, mergedOptions);

      return this.CreateSuccessResult(code, dependencies, warnings);

    } catch (error) {
      return this.CreateErrorResult(`Code generation failed: ${error.message}\n${error.stack}`);
    }
  }


  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    // TypeScript compiler handles most dependencies
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    return warnings;
  }

  /**
   * Check if TypeScript compiler is available on the system
   * @private
   */
  _isTypescriptAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('tsc --version', { 
        stdio: 'pipe', 
        timeout: 1000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      // Try npx tsc as fallback
      try {
        execSync('npx tsc --version', { 
          stdio: 'pipe', 
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        return 'npx';
      } catch (error2) {
        return false;
      }
    }
  }

  /**
   * Basic syntax validation using bracket/parentheses matching
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      const stack = [];
      const pairs = { '(': ')', '[': ']', '{': '}', '<': '>' };
      const opening = Object.keys(pairs);
      const closing = Object.values(pairs);
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        
        // Skip string literals
        if (char === '"' || char === "'" || char === '`') {
          const quote = char;
          i++; // Skip opening quote
          while (i < code.length && code[i] !== quote) {
            if (code[i] === '\\') i++; // Skip escaped characters
            i++;
          }
          continue;
        }
        
        // Skip single-line comments
        if (char === '/' && i + 1 < code.length && code[i + 1] === '/') {
          while (i < code.length && code[i] !== '\n') i++;
          continue;
        }
        
        // Skip multi-line comments
        if (char === '/' && i + 1 < code.length && code[i + 1] === '*') {
          i += 2;
          while (i < code.length - 1) {
            if (code[i] === '*' && code[i + 1] === '/') {
              i += 2;
              break;
            }
            i++;
          }
          continue;
        }
        
        if (opening.includes(char)) {
          // Special handling for < in TypeScript - only count as opening if it looks like a generic
          if (char === '<') {
            // Simple heuristic: check if this could be a generic type parameter
            const nextChars = code.slice(i + 1, i + 10);
            if (!/^[A-Za-z_]/.test(nextChars)) continue;
          }
          stack.push(char);
        } else if (closing.includes(char)) {
          if (char === '>') {
            // Only match > with < if we have an unmatched <
            if (stack.length === 0 || stack[stack.length - 1] !== '<') continue;
          }
          if (stack.length === 0) return false;
          const lastOpening = stack.pop();
          if (pairs[lastOpening] !== char) return false;
        }
      }
      
      return stack.length === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate TypeScript code syntax using tsc
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if TypeScript compiler is available first
    const tscAvailable = this._isTypescriptAvailable();
    if (!tscAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'TypeScript compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const tscCommand = tscAvailable === 'npx' ? 'npx tsc' : 'tsc';
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_ts_${Date.now()}.ts`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the TypeScript code (no emit, just check)
        execSync(`${tscCommand} --noEmit --skipLibCheck "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: 'tsc',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'tsc',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If TypeScript compiler is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'TypeScript compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get TypeScript compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'TypeScript Compiler',
      downloadUrl: 'https://www.typescriptlang.org/download',
      installInstructions: [
        'Install TypeScript globally: npm install -g typescript',
        'Or use npx: npx typescript',
        'Or install Node.js first from https://nodejs.org/en/download/',
        'Verify installation with: tsc --version'
      ].join('\n'),
      verifyCommand: 'tsc --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses with TypeScript generics)',
      packageManager: 'npm',
      documentation: 'https://www.typescriptlang.org/docs/'
    };
  }

}

// Register the plugin
const typeScriptPlugin = new TypeScriptPlugin();
LanguagePlugins.Add(typeScriptPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = typeScriptPlugin;
}


})(); // End of IIFE