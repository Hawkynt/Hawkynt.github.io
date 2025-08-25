/**
 * BASIC Language Plugin for Multi-Language Code Generation
 * Generates BASIC code from JavaScript AST
 * 
 * Follows the LanguagePlugin specification exactly
 */

// Import the framework
// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
}

/**
 * BASIC Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class BasicPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'BASIC';
    this.extension = 'bas';
    this.icon = '📟';
    this.description = 'BASIC language code generator';
    this.mimeType = 'text/x-basic';
    this.version = 'QuickBASIC 4.5+';
    
    // BASIC-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      useLineNumbers: false, // Modern BASIC doesn't need line numbers
      addComments: true,
      upperCase: true // Traditional BASIC uses uppercase keywords
    };
    
    // Internal state
    this.indentLevel = 0;
    this.lineNumber = 10;
    this.lineIncrement = 10;
  }

  /**
   * Generate BASIC code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.lineNumber = 10;
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate BASIC code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add program structure
      const finalCode = this._wrapWithProgramStructure(code, mergedOptions);
      
      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);
      
      // Generate warnings if any
      const warnings = this._generateWarnings(ast, mergedOptions);
      
      return this.CreateSuccessResult(finalCode, dependencies, warnings);
      
    } catch (error) {
      return this.CreateErrorResult(`Code generation failed: ${error.message}`);
    }
  }

  /**
   * Generate code for any AST node
   * @private
   */
  _generateNode(node, options) {
    if (!node || !node.type) {
      return '';
    }
    
    switch (node.type) {
      case 'Program':
        return this._generateProgram(node, options);
      case 'FunctionDeclaration':
        return this._generateFunction(node, options);
      case 'BlockStatement':
        return this._generateBlock(node, options);
      case 'VariableDeclaration':
        return this._generateVariableDeclaration(node, options);
      case 'ExpressionStatement':
        return this._generateExpressionStatement(node, options);
      case 'ReturnStatement':
        return this._generateReturnStatement(node, options);
      case 'BinaryExpression':
        return this._generateBinaryExpression(node, options);
      case 'CallExpression':
        return this._generateCallExpression(node, options);
      case 'MemberExpression':
        return this._generateMemberExpression(node, options);
      case 'AssignmentExpression':
        return this._generateAssignmentExpression(node, options);
      case 'Identifier':
        return this._generateIdentifier(node, options);
      case 'Literal':
        return this._generateLiteral(node, options);
      default:
        return this._formatBasicLine(`REM TODO: Implement ${node.type}`, options);
    }
  }

  /**
   * Generate program (root level)
   * @private
   */
  _generateProgram(node, options) {
    if (!node.body || !Array.isArray(node.body)) {
      return '';
    }
    
    const statements = node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(code => code.trim() !== '');
    
    return statements.join('\n');
  }

  /**
   * Generate function declaration
   * @private
   */
  _generateFunction(node, options) {
    const functionName = node.id ? node.id.name.toUpperCase() : 'UNNAMED';
    let code = '';
    
    // BASIC comment
    if (options.addComments) {
      code += this._formatBasicLine(`REM Function: ${functionName}`, options);
    }
    
    // BASIC functions are typically SUBroutines or FUNCTIONs
    const keyword = options.upperCase ? 'SUB' : 'SUB';
    let signature = `${keyword} ${functionName}(`;
    
    // Parameters
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'PARAM';
        return paramName.toUpperCase();
      });
      signature += params.join(', ');
    }
    signature += ')';
    
    code += this._formatBasicLine(signature, options);
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._formatBasicLine('REM Not implemented', options);
    } else {
      code += this._formatBasicLine('REM Not implemented', options);
    }
    this.indentLevel--;
    
    // End subroutine
    code += this._formatBasicLine(`END ${keyword}`, options);
    
    return code;
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._formatBasicLine('REM Empty block', options);
    }
    
    return node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(line => line.trim())
      .join('\n');
  }

  /**
   * Generate variable declaration
   * @private
   */
  _generateVariableDeclaration(node, options) {
    if (!node.declarations) return '';
    
    return node.declarations
      .map(decl => {
        const varName = decl.id ? decl.id.name.toUpperCase() : 'VARIABLE';
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // BASIC assignment
          return this._formatBasicLine(`${varName} = ${initValue}`, options);
        } else {
          // BASIC variable declaration (DIM in some dialects)
          return this._formatBasicLine(`DIM ${varName}`, options);
        }
      })
      .join('\n');
  }

  /**
   * Generate expression statement
   * @private
   */
  _generateExpressionStatement(node, options) {
    const expr = this._generateNode(node.expression, options);
    return expr ? this._formatBasicLine(expr, options) : '';
  }

  /**
   * Generate return statement
   * @private
   */
  _generateReturnStatement(node, options) {
    if (node.argument) {
      const returnValue = this._generateNode(node.argument, options);
      // In BASIC, functions return values by assigning to function name
      return this._formatBasicLine(`REM Return ${returnValue}`, options);
    } else {
      return this._formatBasicLine('RETURN', options);
    }
  }

  /**
   * Generate binary expression
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    let operator = node.operator;
    
    // BASIC operators
    switch (operator) {
      case '===':
      case '==':
        operator = '=';
        break;
      case '!==':
      case '!=':
        operator = '<>';
        break;
      case '&&':
        operator = 'AND';
        break;
      case '||':
        operator = 'OR';
        break;
    }
    
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate call expression
   * @private
   */
  _generateCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ? 
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
    
    // BASIC function calls
    return `${callee.toUpperCase()}(${args})`;
  }

  /**
   * Generate member expression
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ? 
      `(${this._generateNode(node.property, options)})` : 
      `_${node.property.name || node.property}`;
    
    // BASIC doesn't have member access, simulate with underscore
    return `${object}${property}`.toUpperCase();
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    
    // BASIC only supports = assignment
    return `${left} = ${right}`;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return options.upperCase ? node.name.toUpperCase() : node.name;
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return `"${node.value.replace(/"/g, '""')}"`;
    } else if (node.value === null) {
      return '0'; // BASIC doesn't have null, use 0
    } else if (typeof node.value === 'boolean') {
      return node.value ? '-1' : '0'; // BASIC uses -1 for true, 0 for false
    } else {
      return String(node.value);
    }
  }

  /**
   * Format a BASIC line with optional line numbers
   * @private
   */
  _formatBasicLine(code, options) {
    let line = '';
    
    if (options.useLineNumbers) {
      line = `${this.lineNumber} `;
      this.lineNumber += this.lineIncrement;
    }
    
    // Add indentation
    const indentStr = options.indent.repeat(this.indentLevel);
    line += indentStr + code;
    
    return line + '\n';
  }

  /**
   * Wrap generated code with program structure
   * @private
   */
  _wrapWithProgramStructure(code, options) {
    let result = '';
    
    // Program header comment
    if (options.addComments) {
      result += this._formatBasicLine('REM Generated BASIC Program', options);
      result += this._formatBasicLine(`REM Created: ${new Date().toDateString()}`, options);
      result += '\n';
    }
    
    // Main program
    result += code;
    
    // Program end
    if (!options.useLineNumbers) {
      result += '\n';
      result += this._formatBasicLine('END', options);
    }
    
    return result;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // BASIC typically doesn't have external dependencies
    // But could include common libraries or modules
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // BASIC-specific warnings
    warnings.push('BASIC has limited object-oriented features');
    warnings.push('Consider using structured programming practices');
    warnings.push('Variable names may be limited in length depending on BASIC dialect');
    
    return warnings;
  }

  /**
   * Check if FreeBASIC compiler is available on the system
   * @private
   */
  _isFBCAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('fbc -version', { 
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
   * Validate BASIC code syntax using FreeBASIC compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if FBC is available first
    const fbcAvailable = this._isFBCAvailable();
    if (!fbcAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'FreeBASIC compiler (fbc) not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_basic_${Date.now()}.bas`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Check BASIC syntax using FBC -c (compile only, no linking) flag
        execSync(`fbc -c "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up (FBC might create additional files)
        const baseName = path.parse(tempFile).name;
        const baseDir = path.dirname(tempFile);
        
        // Remove original temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        // Clean up potential compiler outputs
        const possibleOutputs = [
          path.join(baseDir, baseName + '.o'),
          path.join(baseDir, baseName),
          path.join(baseDir, baseName + '.exe')
        ];
        
        possibleOutputs.forEach(file => {
          try {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        });
        
        return {
          success: true,
          method: 'fbc',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'fbc',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If FBC is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'FreeBASIC compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get BASIC/FreeBASIC compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'FreeBASIC Compiler (FBC)',
      downloadUrl: 'https://www.freebasic.net/wiki/CompilerInstalling',
      installInstructions: [
        'Download FreeBASIC from https://www.freebasic.net/wiki/CompilerInstalling',
        'For Windows: Download and extract the ZIP file, add to PATH',
        'For Ubuntu/Debian: sudo apt install fbc',
        'For macOS: Use Homebrew - brew install freebasic',
        'For source compilation: https://github.com/freebasic/fbc',
        'Add FBC to your system PATH',
        'Verify installation with: fbc -version',
        'Note: Supports modern BASIC features and QB64 compatibility'
      ].join('\n'),
      verifyCommand: 'fbc -version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'None (standalone compiler)',
      documentation: 'https://www.freebasic.net/wiki/DocToc'
    };
  }
}

// Register the plugin
const basicPlugin = new BasicPlugin();
LanguagePlugins.Add(basicPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = basicPlugin;
}


})(); // End of IIFE