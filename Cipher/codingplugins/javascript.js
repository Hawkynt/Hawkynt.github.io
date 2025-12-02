/**
 * JavaScript Language Plugin for Multi-Language Code Generation
 * Generates modern JavaScript (ES2020+) code from JavaScript AST
 * 
 * Follows the LanguagePlugin specification exactly
 */

// Import the framework
// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let JavaScriptAST, JavaScriptEmitter, JavaScriptTransformer;

if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;

  // Load AST pipeline components (required)
  try {
    JavaScriptAST = require('./JavaScriptAST.js');
    const emitterModule = require('./JavaScriptEmitter.js');
    JavaScriptEmitter = emitterModule.JavaScriptEmitter;
    const transformerModule = require('./JavaScriptTransformer.js');
    JavaScriptTransformer = transformerModule.JavaScriptTransformer;
  } catch (e) {
    // Pipeline components not available - plugin will not work
    console.error('JavaScript AST pipeline components not loaded:', e.message);
  }
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  JavaScriptAST = window.JavaScriptAST;
  JavaScriptEmitter = window.JavaScriptEmitter;
  JavaScriptTransformer = window.JavaScriptTransformer;
}

/**
 * JavaScript Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class JavaScriptPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'JavaScript';
    this.extension = 'js';
    this.icon = '💛';
    this.description = 'JavaScript code generator with ECMAScript version targeting (ES3 to ESNext)';
    this.mimeType = 'text/javascript';
    this.version = 'ES3-ESNext';
    
    // JavaScript-specific options
    this.options = {
      indent: '  ', // 2 spaces (common JS convention)
      lineEnding: '\n',
      ecmaVersion: 'es2020', // Target ECMAScript version
      strictTypes: false,
      useModules: true,
      addJSDoc: true,
      useArrowFunctions: true,
      useTemplateLiterals: true,
      useClasses: true,
      useDestructuring: true,
      useSpreadOperator: true,
      useOptionalChaining: true,
      useNullishCoalescing: true,
      useAsyncAwait: true,
      useBigInt: true,
      usePrivateFields: true
    };

    // Option metadata - defines enum choices
    this.optionsMeta = {
      ecmaVersion: {
        type: 'enum',
        choices: [
          { value: 'es3', label: 'ES3 (1999)', description: 'ECMAScript 3 - Original JavaScript standard' },
          { value: 'es5', label: 'ES5 (2009)', description: 'ECMAScript 5 - Strict mode, JSON, Array methods' },
          { value: 'es2015', label: 'ES2015/ES6', description: 'Classes, arrow functions, let/const, promises' },
          { value: 'es2016', label: 'ES2016/ES7', description: 'Array.includes, exponentiation operator' },
          { value: 'es2017', label: 'ES2017/ES8', description: 'Async/await, Object.entries/values' },
          { value: 'es2018', label: 'ES2018/ES9', description: 'Spread properties, async iteration' },
          { value: 'es2019', label: 'ES2019/ES10', description: 'Array.flat, Object.fromEntries' },
          { value: 'es2020', label: 'ES2020/ES11', description: 'Optional chaining, nullish coalescing, BigInt' },
          { value: 'es2021', label: 'ES2021/ES12', description: 'String.replaceAll, Promise.any' },
          { value: 'es2022', label: 'ES2022/ES13', description: 'Class fields, top-level await' },
          { value: 'es2023', label: 'ES2023/ES14', description: 'Array findLast, Hashbang support' },
          { value: 'esnext', label: 'ESNext', description: 'Latest ECMAScript features' }
        ]
      },
      indent: {
        type: 'enum',
        choices: [
          { value: '  ', label: '2 Spaces' },
          { value: '    ', label: '4 Spaces' },
          { value: '\t', label: 'Tab' }
        ]
      }
    };

    // Option constraints - which options are available based on ECMAScript version
    this.optionConstraints = {
      useArrowFunctions: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Arrow functions require ES2015 or later'
      },
      useClasses: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Classes require ES2015 or later'
      },
      useTemplateLiterals: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Template literals require ES2015 or later'
      },
      useDestructuring: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Destructuring requires ES2015 or later'
      },
      useSpreadOperator: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Spread operator requires ES2015 or later'
      },
      useModules: {
        enabledWhen: { ecmaVersion: ['es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'ES modules require ES2015 or later'
      },
      useAsyncAwait: {
        enabledWhen: { ecmaVersion: ['es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Async/await requires ES2017 or later'
      },
      useOptionalChaining: {
        enabledWhen: { ecmaVersion: ['es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Optional chaining requires ES2020 or later'
      },
      useNullishCoalescing: {
        enabledWhen: { ecmaVersion: ['es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'Nullish coalescing requires ES2020 or later'
      },
      useBigInt: {
        enabledWhen: { ecmaVersion: ['es2020', 'es2021', 'es2022', 'es2023', 'esnext'] },
        disabledReason: 'BigInt requires ES2020 or later'
      },
      usePrivateFields: {
        enabledWhen: { ecmaVersion: ['es2022', 'es2023', 'esnext'] },
        disabledReason: 'Private class fields require ES2022 or later'
      }
    };
  }

  /**
   * Generate JavaScript code from Abstract Syntax Tree
   * Uses AST pipeline: IL AST -> JS Transformer -> JS AST -> JS Emitter -> JS Source
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

      // Check if AST pipeline components are available
      if (!JavaScriptTransformer || !JavaScriptEmitter) {
        return this.CreateErrorResult('AST pipeline components (JavaScriptTransformer/JavaScriptEmitter) not available');
      }

      // Create transformer
      const transformer = new JavaScriptTransformer({});

      // Transform IL AST to JavaScript AST
      const jsAst = transformer.transform(ast);

      // Create emitter with options
      const emitter = new JavaScriptEmitter({
        indent: mergedOptions.indent || '  ',
        newline: mergedOptions.lineEnding || mergedOptions.newline || '\n'
      });

      // Emit JavaScript code from JavaScript AST
      const code = emitter.emit(jsAst);

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
    // JavaScript typically doesn't have external dependencies for basic features
    // Could be enhanced to detect specific library usage
    return [];
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    // Warnings are now handled by the emitter and transformer
    // Could be enhanced to provide language-specific warnings
    return [];
  }

  /**
   * Check if Node.js is available on the system
   * @private
   */
  _isNodeAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('node --version', { 
        stdio: 'pipe', 
        timeout: 1000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Basic syntax validation using bracket/parentheses matching
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      const stack = [];
      const pairs = { '(': ')', '[': ']', '{': '}' };
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
        
        if (opening.includes(char)) {
          stack.push(char);
        } else if (closing.includes(char)) {
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
   * Validate JavaScript code syntax using Node.js
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Node.js is available first
    const nodeAvailable = this._isNodeAvailable();
    if (!nodeAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Node.js not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_js_${Date.now()}.js`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to parse the JavaScript code
        execSync(`node --check "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 2000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: 'node',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'node',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Node.js is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Node.js not available - using basic validation'
      };
    }
  }

  /**
   * Get Node.js runtime download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Node.js',
      downloadUrl: 'https://nodejs.org/en/download/',
      installInstructions: [
        'Download Node.js from https://nodejs.org/en/download/',
        'Run the installer for your operating system',
        'Verify installation with: node --version',
        'JavaScript can also run in any web browser',
        '',
        'ECMAScript version support:',
        '  ES3: All browsers since Netscape 4 / IE4',
        '  ES5: All modern browsers, Node.js 0.10+',
        '  ES2015: Node.js 6+, Chrome 51+, Firefox 52+, Safari 10+',
        '  ES2017: Node.js 8+, Chrome 55+, Firefox 52+, Safari 10.1+',
        '  ES2020: Node.js 14+, Chrome 80+, Firefox 72+, Safari 13.1+',
        '  ES2022: Node.js 16.11+, Chrome 94+, Firefox 93+, Safari 15+'
      ].join('\n'),
      verifyCommand: 'node --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'npm',
      documentation: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      supportedVersions: ['es3', 'es5', 'es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023', 'esnext']
    };
  }

}

// Register the plugin
const javaScriptPlugin = new JavaScriptPlugin();
LanguagePlugins.Add(javaScriptPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = javaScriptPlugin;
}


})(); // End of IIFE