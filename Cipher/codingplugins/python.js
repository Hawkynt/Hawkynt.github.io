/**
 * Python Language Plugin for Multi-Language Code Generation
 * Generates Python 3.x compatible code from JavaScript AST
 *
 * Follows the LanguagePlugin specification exactly
 *
 * Uses AST pipeline: JS AST -> Python AST -> Python Emitter
 */

// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let PythonAST, PythonEmitter, PythonTransformer;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load AST pipeline components
    try {
      PythonAST = require('./PythonAST.js');
      const emitterModule = require('./PythonEmitter.js');
      PythonEmitter = emitterModule.PythonEmitter;
      const transformerModule = require('./PythonTransformer.js');
      PythonTransformer = transformerModule.PythonTransformer;
    } catch (e) {
      // Pipeline components not available - will fail during generation
      console.warn('Python AST pipeline components not loaded:', e.message);
    }
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    PythonAST = window.PythonAST;
    PythonEmitter = window.PythonEmitter;
    PythonTransformer = window.PythonTransformer;
  }

/**
 * Python Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class PythonPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Python';
    this.extension = 'py';
    this.icon = '🐍';
    this.description = 'Python 3.x code generator';
    this.mimeType = 'text/x-python';
    this.version = '3.9+';
    
    // Python-specific options
    this.options = {
      indent: '    ', // 4 spaces for Python PEP 8
      lineEnding: '\n',
      strictTypes: false,
      addTypeHints: true,
      addDocstrings: true
    };
    
    // Python type mappings for cryptographic algorithms
    this.typeMap = {
      'byte': 'int',
      'word': 'int',
      'dword': 'int',
      'qword': 'int',
      'uint': 'int',
      'uint32': 'int',
      'byte[]': 'bytes',
      'word[]': 'List[int]',
      'dword[]': 'List[int]',
      'qword[]': 'List[int]',
      'uint[]': 'List[int]',
      'int[]': 'List[int]',
      'string': 'str',
      'boolean': 'bool',
      'object': 'Any',
      'void': 'None'
    };
  }

  /**
   * Generate Python code from Abstract Syntax Tree
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
      if (!PythonTransformer || !PythonEmitter) {
        return this.CreateErrorResult('Python AST pipeline components not available');
      }

      // Create transformer with options
      const transformer = new PythonTransformer({
        typeKnowledge: mergedOptions.parser?.typeKnowledge || mergedOptions.typeKnowledge,
        addTypeHints: mergedOptions.addTypeHints !== undefined ? mergedOptions.addTypeHints : true,
        addDocstrings: mergedOptions.addDocstrings !== undefined ? mergedOptions.addDocstrings : true,
        strictTypes: mergedOptions.strictTypes !== undefined ? mergedOptions.strictTypes : false
      });

      // Transform JS AST to Python AST
      const pyAst = transformer.transform(ast);

      // Create emitter with formatting options
      const emitter = new PythonEmitter({
        indent: mergedOptions.indent || '    ',
        lineEnding: mergedOptions.lineEnding || '\n',
        addTypeHints: mergedOptions.addTypeHints !== undefined ? mergedOptions.addTypeHints : true,
        addDocstrings: mergedOptions.addDocstrings !== undefined ? mergedOptions.addDocstrings : true
      });

      // Emit Python source code
      const code = emitter.emit(pyAst);

      // Collect any warnings from transformation
      const warnings = transformer.warnings || [];

      return this.CreateSuccessResult(code, [], warnings);

    } catch (error) {
      return this.CreateErrorResult(`AST pipeline generation failed: ${error.message}`);
    }
  }


  /**
   * Map JavaScript/internal type to Python type
   * @override
   */
  MapType(internalType) {
    return this.typeMap[internalType] || internalType;
  }

  /**
   * Check if Python is available on the system
   * @private
   */
  _isPythonAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('python --version', { 
        stdio: 'pipe', 
        timeout: 1000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      try {
        // Try python3 as fallback
        execSync('python3 --version', { 
          stdio: 'pipe', 
          timeout: 1000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        return 'python3';
      } catch (error2) {
        return false;
      }
    }
  }

  /**
   * Validate Python code syntax using native interpreter
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Python is available first
    const pythonCommand = this._isPythonAvailable();
    if (!pythonCommand) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Python not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const pythonCmd = pythonCommand === true ? 'python' : pythonCommand;
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_python_${Date.now()}.py`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the Python code
        execSync(`${pythonCmd} -m py_compile "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 2000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: 'python',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'python',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Python is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Python not available - using basic validation'
      };
    }
  }

  /**
   * Get Python compiler/interpreter download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Python',
      downloadUrl: 'https://www.python.org/downloads/',
      installInstructions: [
        'Download Python from https://www.python.org/downloads/',
        'Run the installer and check "Add Python to PATH"',
        'Verify installation with: python --version'
      ].join('\n'),
      verifyCommand: 'python --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'pip',
      documentation: 'https://docs.python.org/'
    };
  }
}

// Register the plugin
const pythonPlugin = new PythonPlugin();
LanguagePlugins.Add(pythonPlugin);

// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = pythonPlugin;
}

})(); // End of IIFE
