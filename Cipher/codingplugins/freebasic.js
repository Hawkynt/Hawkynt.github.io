/**
 * FreeBasic Language Plugin for Multi-Language Code Generation
 * Generates FreeBasic code from JavaScript AST
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
 * FreeBasic Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class FreeBasicPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'FreeBasic';
    this.extension = 'bas';
    this.icon = '🆓';
    this.description = 'FreeBasic language code generator';
    this.mimeType = 'text/x-freebasic';
    this.version = 'FreeBasic 1.09+';
    
    // FreeBasic-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      addComments: true,
      useStrictTypes: true,
      explicitKeywords: true // Use explicit keywords like DIM, AS, etc.
    };
    
    // Internal state
    this.indentLevel = 0;
    this.includes = new Set();
  }

  /**
   * Generate FreeBasic code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.includes.clear();
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate FreeBasic code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add includes and program structure
      const finalCode = this._wrapWithProgramStructure(code, mergedOptions);
      
      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);
      
      // Generate warnings if any
      const warnings = this._generateWarnings(ast, mergedOptions);
      
      return this.CreateSuccessResult(finalCode, dependencies, warnings);
      
    } catch (error) {
      return this.CreateErrorResult('Code generation failed: ' + error.message);
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
      case 'ClassDeclaration':
        return this._generateType(node, options);
      case 'MethodDefinition':
        return this._generateMethod(node, options);
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
        return "' TODO: Implement " + node.type;
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
    
    return statements.join('\n\n');
  }

  /**
   * Generate function declaration
   * @private
   */
  _generateFunction(node, options) {
    const functionName = node.id ? this._toPascalCase(node.id.name) : 'UnnamedFunction';
    let code = '';
    
    // FreeBasic comment
    if (options.addComments) {
      code += this._indent("' " + functionName + " function\n");
      code += this._indent("' Performs the " + (node.id ? node.id.name : 'unnamed') + " operation\n");
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent("' @param " + paramName + " As Integer - input parameter\n");
        });
      }
      code += this._indent("' @return As Integer - result of the operation\n");
    }
    
    // Function signature
    code += this._indent('Function ' + functionName + '(');
    
    // Parameters with FreeBasic types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return 'ByVal ' + this._toPascalCase(paramName) + ' As Integer';
      });
      code += params.join(', ');
    }
    
    code += ') As Integer\n';
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent('Error "Not implemented"\n');
    } else {
      code += this._indent('Error "Not implemented"\n');
    }
    this.indentLevel--;
    
    code += this._indent('End Function\n');
    
    return code;
  }

  /**
   * Generate type (equivalent to class/struct)
   * @private
   */
  _generateType(node, options) {
    const typeName = node.id ? this._toPascalCase(node.id.name) : 'UnnamedType';
    let code = '';
    
    // Type comment
    if (options.addComments) {
      code += this._indent("' " + typeName + " type\n");
      code += this._indent("' Represents a " + (node.id ? node.id.name : 'unnamed') + " entity\n");
    }
    
    // Type declaration
    code += this._indent('Type ' + typeName + '\n');
    
    // Type fields
    this.indentLevel++;
    code += this._indent("' Add fields here\n");
    code += this._indent('Value As Integer\n');
    this.indentLevel--;
    
    code += this._indent('End Type\n\n');
    
    // Methods as separate functions (FreeBasic doesn't have true OOP methods in types)
    if (node.body && node.body.length > 0) {
      code += this._indent("' Methods for " + typeName + "\n");
      const methods = node.body
        .map(method => this._generateMethodAsFunction(method, typeName, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
    }
    
    return code;
  }

  /**
   * Generate method as a standalone function
   * @private
   */
  _generateMethodAsFunction(node, typeName, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = this._toPascalCase(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    let code = '';
    
    // Method comment
    if (options.addComments) {
      code += this._indent("' " + (isConstructor ? typeName + ' Constructor' : methodName + ' method for ' + typeName) + "\n");
    }
    
    // Function signature
    if (isConstructor) {
      code += this._indent('Function Create' + typeName + '(');
    } else {
      code += this._indent('Function ' + typeName + '_' + methodName + '(');
      // Add self parameter
      code += 'ByRef Self As ' + typeName;
      if (node.value.params && node.value.params.length > 0) {
        code += ', ';
      }
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        return 'ByVal ' + this._toPascalCase(paramName) + ' As Integer';
      });
      code += params.join(', ');
    }
    
    if (isConstructor) {
      code += ') As ' + typeName + '\n';
    } else {
      code += ') As Integer\n';
    }
    
    // Function body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || (isConstructor ? this._indent('Dim Result As ' + typeName + '\n' + 'Return Result\n') : this._indent('Error "Not implemented"\n'));
    } else {
      if (isConstructor) {
        code += this._indent('Dim Result As ' + typeName + '\n');
        code += this._indent('Return Result\n');
      } else {
        code += this._indent('Error "Not implemented"\n');
      }
    }
    this.indentLevel--;
    
    code += this._indent('End Function\n');
    
    return code;
  }

  /**
   * Generate method definition (placeholder)
   * @private
   */
  _generateMethod(node, options) {
    // In FreeBasic, methods are handled as functions
    return this._generateMethodAsFunction(node, 'UnknownType', options);
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent('Error "Empty block"\n');
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
        const varName = decl.id ? this._toPascalCase(decl.id.name) : 'Variable';
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // FreeBasic variable declaration with initialization
          return this._indent('Dim ' + varName + ' As Integer = ' + initValue + '\n');
        } else {
          return this._indent('Dim ' + varName + ' As Integer\n');
        }
      })
      .join('');
  }

  /**
   * Generate expression statement
   * @private
   */
  _generateExpressionStatement(node, options) {
    const expr = this._generateNode(node.expression, options);
    return expr ? this._indent(expr + '\n') : '';
  }

  /**
   * Generate return statement
   * @private
   */
  _generateReturnStatement(node, options) {
    if (node.argument) {
      const returnValue = this._generateNode(node.argument, options);
      return this._indent('Return ' + returnValue + '\n');
    } else {
      return this._indent('Return 0\n'); // FreeBasic functions need return value
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
    
    // FreeBasic operators
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
        operator = 'And';
        break;
      case '||':
        operator = 'Or';
        break;
      case '%':
        operator = 'Mod';
        break;
    }
    
    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate call expression
   * @private
   */
  _generateCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ? 
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
    
    return callee + '(' + args + ')';
  }

  /**
   * Generate member expression
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ? 
      '(' + this._generateNode(node.property, options) + ')' : 
      '.' + this._toPascalCase(node.property.name || node.property);
    
    return object + property;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    
    // FreeBasic uses = for assignment
    return left + ' = ' + right;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return this._toPascalCase(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return '"' + node.value.replace(/"/g, '""') + '"';
    } else if (node.value === null) {
      return '0'; // FreeBasic doesn't have null, use 0 or empty string
    } else if (typeof node.value === 'boolean') {
      return node.value ? '-1' : '0'; // FreeBasic uses -1 for true, 0 for false
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert to PascalCase (FreeBasic convention)
   * @private
   */
  _toPascalCase(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Add proper indentation
   * @private
   */
  _indent(code) {
    const indentStr = this.options.indent.repeat(this.indentLevel);
    return code.split('\n').map(line => 
      line.trim() ? indentStr + line : line
    ).join('\n');
  }

  /**
   * Wrap generated code with program structure
   * @private
   */
  _wrapWithProgramStructure(code, options) {
    let result = '';
    
    // File header comment
    if (options.addComments) {
      result += "' Generated FreeBasic code\n";
      result += "' This file was automatically generated from JavaScript AST\n";
      result += "' Compiler: " + this.version + "\n";
      result += "' Date: " + new Date().toDateString() + "\n\n";
    }
    
    // FreeBasic directives
    result += '#Lang "fb"\n'; // Use FreeBasic syntax
    result += 'Option Explicit\n'; // Require variable declarations
    result += 'Option Escape\n\n'; // Enable escape sequences
    
    // Includes
    if (this.includes.size > 0) {
      for (const inc of this.includes) {
        result += '#Include "' + inc + '"\n';
      }
      result += '\n';
    }
    
    // Generated code
    result += code;
    
    // Main program entry point
    result += '\n\n\' Main program\n';
    result += 'Sub Main()\n';
    result += '    \' TODO: Add main program code\n';
    result += '    Print "Generated FreeBasic code execution"\n';
    result += '    Sleep\n'; // Wait for keypress
    result += 'End Sub\n\n';
    result += 'Main()\n'; // Call main subroutine
    
    return result;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Common FreeBasic includes
    // Usually handled by the runtime
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // FreeBasic-specific warnings
    warnings.push('Consider using specific numeric types (Single, Double, LongInt) instead of Integer');
    warnings.push('Add proper error handling with On Error or explicit checks');
    warnings.push('Use Option Explicit to require variable declarations');
    warnings.push('Consider using UDTs (User Defined Types) for better data organization');
    
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
   * Validate FreeBasic code syntax using FreeBASIC compiler
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
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_freebasic_${Date.now()}.bas`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Check FreeBasic syntax using FBC -c (compile only, no linking) flag
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
   * Get FreeBASIC compiler download information
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
        'For Arch Linux: sudo pacman -S freebasic',
        'For source compilation: https://github.com/freebasic/fbc',
        'Add FBC to your system PATH',
        'Verify installation with: fbc -version',
        'Note: Modern BASIC with advanced features and good C library integration'
      ].join('\n'),
      verifyCommand: 'fbc -version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'None (standalone compiler)',
      documentation: 'https://www.freebasic.net/wiki/DocToc'
    };
  }
}

// Register the plugin
const freebasicPlugin = new FreeBasicPlugin();
LanguagePlugins.Add(freebasicPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = freebasicPlugin;
}


})(); // End of IIFE