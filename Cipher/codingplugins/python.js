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

  /**
   * Generate Python test runner code from ILTestRunner node
   * @param {Object} testRunner - ILTestRunner node with tests array
   * @returns {string} Python test runner code
   */
  generateTestRunner(testRunner) {
    if (!testRunner || !testRunner.tests || !Array.isArray(testRunner.tests)) {
      return '# Error: Invalid test runner structure\n';
    }

    const lines = [];
    const indent = this.options.indent || '    ';

    // Add header comment
    lines.push('#!/usr/bin/env python3');
    lines.push('"""');
    lines.push('Auto-generated test runner for cryptographic algorithm implementations');
    lines.push('"""');
    lines.push('');
    lines.push('import sys');
    lines.push('');

    // Helper function to format byte array
    const formatByteArray = (bytes) => {
      if (!bytes || bytes.length === 0) return 'bytes([])';
      const hexValues = bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`);
      return `bytes([${hexValues.join(', ')}])`;
    };

    // Helper function to convert property name to snake_case
    const toSnakeCase = (str) => {
      return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    };

    // Generate main test function
    lines.push('def run_tests():');
    lines.push(`${indent}"""Run all test cases and return success status"""`);
    lines.push(`${indent}passed = 0`);
    lines.push(`${indent}failed = 0`);
    lines.push('');

    // Generate test cases
    testRunner.tests.forEach((algorithmTest, algIndex) => {
      const { algorithmClass, instanceClass, testCases } = algorithmTest;

      if (!testCases || testCases.length === 0) return;

      lines.push(`${indent}# Test cases for ${algorithmClass}`);

      testCases.forEach((testCase, testIndex) => {
        const testNum = `${algIndex + 1}_${testIndex + 1}`;
        const description = testCase.description || `Test ${testNum}`;

        lines.push(`${indent}# ${description}`);
        lines.push(`${indent}try:`);

        // Create algorithm instance
        const instanceVar = toSnakeCase(instanceClass.replace(/Instance$/, ''));
        lines.push(`${indent}${indent}${instanceVar} = ${instanceClass}()`);
        lines.push('');

        // Set properties (key, iv, nonce, etc.)
        if (testCase.key) {
          lines.push(`${indent}${indent}# Set key`);
          lines.push(`${indent}${indent}${instanceVar}.key = ${formatByteArray(testCase.key)}`);
        }
        if (testCase.iv) {
          lines.push(`${indent}${indent}# Set IV`);
          lines.push(`${indent}${indent}${instanceVar}.iv = ${formatByteArray(testCase.iv)}`);
        }
        if (testCase.nonce) {
          lines.push(`${indent}${indent}# Set nonce`);
          lines.push(`${indent}${indent}${instanceVar}.nonce = ${formatByteArray(testCase.nonce)}`);
        }
        if (testCase.outputSize !== undefined) {
          lines.push(`${indent}${indent}# Set output size`);
          lines.push(`${indent}${indent}${instanceVar}.output_size = ${testCase.outputSize}`);
        }

        // Set any other properties from test case
        Object.keys(testCase).forEach(key => {
          if (!['input', 'expected', 'key', 'iv', 'nonce', 'outputSize', 'description'].includes(key)) {
            const value = testCase[key];
            const propName = toSnakeCase(key);
            if (Array.isArray(value)) {
              lines.push(`${indent}${indent}${instanceVar}.${propName} = ${formatByteArray(value)}`);
            } else if (typeof value === 'number') {
              lines.push(`${indent}${indent}${instanceVar}.${propName} = ${value}`);
            } else if (typeof value === 'string') {
              lines.push(`${indent}${indent}${instanceVar}.${propName} = "${value}"`);
            } else if (typeof value === 'boolean') {
              lines.push(`${indent}${indent}${instanceVar}.${propName} = ${value ? 'True' : 'False'}`);
            }
          }
        });

        lines.push('');

        // Feed input
        lines.push(`${indent}${indent}# Feed input data`);
        lines.push(`${indent}${indent}input_data = ${formatByteArray(testCase.input)}`);
        lines.push(`${indent}${indent}${instanceVar}.feed(input_data)`);
        lines.push('');

        // Get result
        lines.push(`${indent}${indent}# Get result`);
        lines.push(`${indent}${indent}actual = ${instanceVar}.result()`);
        lines.push(`${indent}${indent}expected = ${formatByteArray(testCase.expected)}`);
        lines.push('');

        // Compare results
        lines.push(`${indent}${indent}# Compare byte-by-byte`);
        lines.push(`${indent}${indent}if actual == expected:`);
        lines.push(`${indent}${indent}${indent}print(f"PASS: ${description}")`);
        lines.push(`${indent}${indent}${indent}passed += 1`);
        lines.push(`${indent}${indent}else:`);
        lines.push(`${indent}${indent}${indent}print(f"FAIL: ${description}")`);
        lines.push(`${indent}${indent}${indent}print(f"  Expected: {expected.hex()}")`);
        lines.push(`${indent}${indent}${indent}print(f"  Actual:   {actual.hex()}")`);
        lines.push(`${indent}${indent}${indent}failed += 1`);
        lines.push('');

        // Exception handling
        lines.push(`${indent}except Exception as e:`);
        lines.push(`${indent}${indent}print(f"ERROR: ${description}")`);
        lines.push(`${indent}${indent}print(f"  Exception: {str(e)}")`);
        lines.push(`${indent}${indent}failed += 1`);
        lines.push('');
      });
    });

    // Print summary
    lines.push(`${indent}# Print summary`);
    lines.push(`${indent}print()`);
    lines.push(`${indent}print(f"Test Results: {passed} passed, {failed} failed")`);
    lines.push(`${indent}return failed == 0`);
    lines.push('');

    // Main block
    lines.push('');
    lines.push('if __name__ == "__main__":');
    lines.push(`${indent}success = run_tests()`);
    lines.push(`${indent}sys.exit(0 if success else 1)`);
    lines.push('');

    return lines.join('\n');
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
