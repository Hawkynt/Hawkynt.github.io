/**
 * PHP Language Plugin for Multi-Language Code Generation
 * Generates PHP 8.x compatible code from JavaScript AST
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
 * PHP Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class PHPPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'PHP';
    this.extension = 'php';
    this.icon = '🐘';
    this.description = 'PHP 8.x code generator';
    this.mimeType = 'text/x-php';
    this.version = '8.0+';
    
    // PHP-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      strictTypes: true,
      addTypeHints: true,
      addDocBlocks: true,
      useShortArraySyntax: true
    };
    
    // Internal state
    this.indentLevel = 0;
  }

  /**
   * Generate PHP code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate PHP code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add standard headers
      const finalCode = this._wrapWithHeaders(code, mergedOptions);
      
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
      case 'ClassDeclaration':
        return this._generateClass(node, options);
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
      case 'ThisExpression':
        return '$this';
      default:
        return `// TODO: Implement ${node.type}`;
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
    const functionName = node.id ? this._toPHPName(node.id.name) : 'unnamedFunction';
    let code = '';
    
    // DocBlock comment
    if (options.addDocBlocks) {
      code += this._indent('/**\n');
      code += this._indent(` * ${functionName} function\n`);
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          const paramType = this._inferParameterType(paramName);
          code += this._indent(` * @param ${paramType} $${paramName}\n`);
        });
      }
      const returnType = this._inferReturnType(functionName);
      code += this._indent(` * @return ${returnType}\n`);
      code += this._indent(' */\n');
    }
    
    // Function signature
    code += this._indent(`function ${functionName}(`);
    
    // Parameters with type hints
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        if (options.addTypeHints) {
          const typeHint = this._inferPHPTypeHint(paramName);
          return typeHint ? `${typeHint} $${paramName}` : `$${paramName}`;
        }
        return `$${paramName}`;
      });
      code += params.join(', ');
    }
    
    // Return type hint
    if (options.addTypeHints) {
      const returnType = this._inferPHPReturnType(functionName);
      code += returnType ? `): ${returnType}` : ')';
    } else {
      code += ')';
    }
    
    code += '\n' + this._indent('{\n');
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("return null;\n");
    } else {
      code += this._indent("return null;\n");
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate class declaration
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? node.id.name : 'UnnamedClass';
    let code = '';
    
    // DocBlock for class
    if (options.addDocBlocks) {
      code += this._indent('/**\n');
      code += this._indent(` * ${className} class\n`);
      code += this._indent(' */\n');
    }
    
    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`class ${className} extends ${superName}\n`);
    } else {
      code += this._indent(`class ${className}\n`);
    }
    
    code += this._indent('{\n');
    
    // Class body
    this.indentLevel++;
    if (node.body && node.body.length > 0) {
      const methods = node.body
        .map(method => this._generateNode(method, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate method definition
   * @private
   */
  _generateMethod(node, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = node.key.name;
    const isConstructor = methodName === 'constructor';
    let code = '';
    
    // DocBlock
    if (options.addDocBlocks) {
      code += this._indent('/**\n');
      code += this._indent(` * ${isConstructor ? 'Constructor' : methodName + ' method'}\n`);
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          const paramType = this._inferParameterType(paramName);
          code += this._indent(` * @param ${paramType} $${paramName}\n`);
        });
      }
      if (!isConstructor) {
        const returnType = this._inferReturnType(methodName);
        code += this._indent(` * @return ${returnType}\n`);
      }
      code += this._indent(' */\n');
    }
    
    // Method signature
    const phpMethodName = isConstructor ? '__construct' : this._toPHPName(methodName);
    code += this._indent(`public function ${phpMethodName}(`);
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        if (options.addTypeHints) {
          const typeHint = this._inferPHPTypeHint(paramName);
          return typeHint ? `${typeHint} $${paramName}` : `$${paramName}`;
        }
        return `$${paramName}`;
      });
      code += params.join(', ');
    }
    
    // Return type
    if (options.addTypeHints && !isConstructor) {
      const returnType = this._inferPHPReturnType(methodName);
      code += returnType ? `): ${returnType}` : ')';
    } else {
      code += ')';
    }
    
    code += '\n' + this._indent('{\n');
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || (isConstructor ? '' : this._indent("return null;\n"));
    } else {
      if (!isConstructor) {
        code += this._indent("return null;\n");
      }
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent("return null;\n");
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
        const varName = decl.id ? '$' + decl.id.name : '$variable';
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          return this._indent(`${varName} = ${initValue};\n`);
        } else {
          return this._indent(`${varName} = null;\n`);
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
    return expr ? this._indent(expr + ';\n') : '';
  }

  /**
   * Generate return statement
   * @private
   */
  _generateReturnStatement(node, options) {
    if (node.argument) {
      const returnValue = this._generateNode(node.argument, options);
      return this._indent(`return ${returnValue};\n`);
    } else {
      return this._indent('return;\n');
    }
  }

  /**
   * Generate binary expression
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapOperator(node.operator);
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
    
    // Handle method calls vs function calls
    if (node.callee && node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const method = node.callee.property.name || node.callee.property;
      return `${object}->${method}(${args})`;
    }
    
    return `${callee}(${args})`;
  }

  /**
   * Generate member expression
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ? 
      `[${this._generateNode(node.property, options)}]` : 
      `->${node.property.name || node.property}`;
    
    // Convert this.something to $this->something
    if (object === '$this' || object === 'this') {
      return `$this${property}`;
    }
    
    return `${object}${property}`;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapOperator(node.operator);
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    if (node.name === 'this') return '$this';
    return '$' + this._toPHPName(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return `"${node.value.replace(/"/g, '\\"')}"`;
    } else if (node.value === null) {
      return 'null';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert JavaScript names to PHP naming convention
   * @private
   */
  _toPHPName(name) {
    // PHP typically uses camelCase, so keep it mostly the same
    return name;
  }

  /**
   * Map JavaScript operators to PHP equivalents
   * @private
   */
  _mapOperator(operator) {
    const operatorMap = {
      '===': '===',
      '!==': '!==',
      '&&': '&&',
      '||': '||',
      '!': '!'
    };
    return operatorMap[operator] || operator;
  }

  /**
   * Infer parameter type for docblocks
   * @private
   */
  _inferParameterType(paramName) {
    const typeMap = {
      'data': 'string|array',
      'key': 'string',
      'input': 'mixed',
      'value': 'int|string',
      'index': 'int',
      'length': 'int'
    };
    return typeMap[paramName.toLowerCase()] || 'mixed';
  }

  /**
   * Infer return type for docblocks
   * @private
   */
  _inferReturnType(functionName) {
    const returnTypeMap = {
      'encrypt': 'string',
      'decrypt': 'string',
      'simpleFunction': 'int'
    };
    return returnTypeMap[functionName] || 'mixed';
  }

  /**
   * Infer PHP type hints for parameters
   * @private
   */
  _inferPHPTypeHint(paramName) {
    const typeMap = {
      'data': 'string',
      'key': 'string',
      'input': '', // mixed has no type hint in older PHP
      'index': 'int',
      'length': 'int'
    };
    return typeMap[paramName.toLowerCase()] || '';
  }

  /**
   * Infer PHP return type hints
   * @private
   */
  _inferPHPReturnType(functionName) {
    const returnTypeMap = {
      'encrypt': 'string',
      'decrypt': 'string',
      'simpleFunction': 'int'
    };
    return returnTypeMap[functionName] || '';
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
   * Wrap generated code with necessary headers
   * @private
   */
  _wrapWithHeaders(code, options) {
    let headers = '<?php\n';
    
    if (options.strictTypes) {
      headers += 'declare(strict_types=1);\n';
    }
    
    headers += '\n';
    
    return headers + code;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // PHP doesn't typically have external dependencies for basic features
    // Could be enhanced to detect specific library usage
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // Check for features that might need attention
    if (this._hasArrayOperations(ast)) {
      warnings.push('Array operations may need review for PHP array syntax');
    }
    
    return warnings;
  }

  /**
   * Check if AST contains array operations
   * @private
   */
  _hasArrayOperations(ast) {
    return false; // Could be enhanced with more sophisticated checking
  }

  /**
   * Check if PHP is available on the system
   * @private
   */
  _isPHPAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('php --version', { 
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
   * Validate PHP code syntax using native interpreter
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if PHP is available first
    const phpAvailable = this._isPHPAvailable();
    if (!phpAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'PHP not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_php_${Date.now()}.php`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Check PHP syntax using -l (lint) flag
        execSync(`php -l "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: 'php',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'php',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If PHP is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'PHP not available - using basic validation'
      };
    }
  }

  /**
   * Get PHP interpreter download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'PHP',
      downloadUrl: 'https://www.php.net/downloads',
      installInstructions: [
        'Download PHP from https://www.php.net/downloads',
        'For Windows: Download from https://windows.php.net/download/',
        'For Ubuntu/Debian: sudo apt install php-cli',
        'For macOS: brew install php',
        'Add PHP to your system PATH',
        'Verify installation with: php --version'
      ].join('\n'),
      verifyCommand: 'php --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'composer',
      documentation: 'https://www.php.net/manual/'
    };
  }
}

// Register the plugin
const phpPlugin = new PHPPlugin();
LanguagePlugins.Add(phpPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = phpPlugin;
}


})(); // End of IIFE