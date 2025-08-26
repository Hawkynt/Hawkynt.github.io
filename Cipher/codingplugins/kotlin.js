/**
 * Kotlin Language Plugin for Multi-Language Code Generation
 * Generates Kotlin compatible code from JavaScript AST
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
 * Kotlin Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class KotlinPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Kotlin';
    this.extension = 'kt';
    this.icon = '🔷';
    this.description = 'Kotlin/JVM code generator';
    this.mimeType = 'text/x-kotlin';
    this.version = '1.9+';
    
    // Kotlin-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      strictTypes: true,
      nullSafety: true,
      useDataClasses: false,
      addKDoc: true
    };
    
    // Internal state
    this.indentLevel = 0;
  }

  /**
   * Generate Kotlin code from Abstract Syntax Tree
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
      
      // Generate Kotlin code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add standard imports and package
      const finalCode = this._wrapWithImports(code, mergedOptions);
      
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
        return 'this';
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
    const functionName = node.id ? this._toKotlinName(node.id.name) : 'unnamedFunction';
    let code = '';
    
    // KDoc comment
    if (options.addKDoc) {
      code += this._indent('/**\n');
      code += this._indent(` * ${functionName} function\n`);
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent(` * @param ${paramName} parameter\n`);
        });
      }
      code += this._indent(' * @return return value\n');
      code += this._indent(' */\n');
    }
    
    // Function signature
    code += this._indent(`fun ${functionName}(`);
    
    // Parameters with types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = this._inferKotlinType(paramName);
        return `${paramName}: ${paramType}`;
      });
      code += params.join(', ');
    }
    
    // Return type
    const returnType = this._inferReturnType(functionName);
    code += `): ${returnType} {\n`;
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("return TODO(\"Not implemented\")\n");
    } else {
      code += this._indent("return TODO(\"Not implemented\")\n");
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
    
    // KDoc for class
    if (options.addKDoc) {
      code += this._indent('/**\n');
      code += this._indent(` * ${className} class\n`);
      code += this._indent(' */\n');
    }
    
    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`class ${className} : ${superName}() {\n`);
    } else {
      code += this._indent(`class ${className} {\n`);
    }
    
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
    
    if (isConstructor) {
      // Kotlin constructors are handled differently
      return '';
    }
    
    // KDoc
    if (options.addKDoc) {
      code += this._indent('/**\n');
      code += this._indent(` * ${methodName} method\n`);
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent(` * @param ${paramName} parameter\n`);
        });
      }
      code += this._indent(' * @return return value\n');
      code += this._indent(' */\n');
    }
    
    // Method signature
    code += this._indent(`fun ${this._toKotlinName(methodName)}(`);
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = this._inferKotlinType(paramName);
        return `${paramName}: ${paramType}`;
      });
      code += params.join(', ');
    }
    
    // Return type
    const returnType = this._inferReturnType(methodName);
    code += `): ${returnType} {\n`;
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || this._indent("return TODO(\"Not implemented\")\n");
    } else {
      code += this._indent("return TODO(\"Not implemented\")\n");
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
      return this._indent("return TODO(\"Empty block\")\n");
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
        const varName = decl.id ? decl.id.name : 'variable';
        const varType = this._inferKotlinType(varName);
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // Use 'val' for constants, 'var' for mutable
          const keyword = node.kind === 'const' ? 'val' : 'var';
          return this._indent(`${keyword} ${varName}: ${varType} = ${initValue}\n`);
        } else {
          return this._indent(`var ${varName}: ${varType}? = null\n`);
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
      return this._indent(`return ${returnValue}\n`);
    } else {
      return this._indent('return\n');
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
      return `${object}.${method}(${args})`;
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
      `.${node.property.name || node.property}`;
    
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
    return this._toKotlinName(node.name);
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
   * Convert JavaScript names to Kotlin naming convention
   * @private
   */
  _toKotlinName(name) {
    // Kotlin uses camelCase like JavaScript
    return name;
  }

  /**
   * Map JavaScript operators to Kotlin equivalents
   * @private
   */
  _mapOperator(operator) {
    const operatorMap = {
      '===': '==',
      '!==': '!=',
      '&&': '&&',
      '||': '||',
      '!': '!'
    };
    return operatorMap[operator] || operator;
  }

  /**
   * Infer Kotlin type from parameter/variable name
   * @private
   */
  _inferKotlinType(name) {
    const typeMap = {
      'data': 'ByteArray',
      'key': 'String',
      'input': 'Any',
      'value': 'Int',
      'index': 'Int',
      'length': 'Int',
      'result': 'Int'
    };
    return typeMap[name.toLowerCase()] || 'Any';
  }

  /**
   * Infer return type for functions
   * @private
   */
  _inferReturnType(functionName) {
    const returnTypeMap = {
      'encrypt': 'ByteArray',
      'decrypt': 'ByteArray',
      'simpleFunction': 'Int'
    };
    return returnTypeMap[functionName] || 'Any';
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
   * Wrap generated code with necessary imports
   * @private
   */
  _wrapWithImports(code, options) {
    let imports = '';
    
    // Check if we need specific imports
    if (code.includes('TODO(')) {
      imports += '// Kotlin TODO() is built-in\n';
    }
    
    return imports ? imports + '\n' + code : code;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Kotlin standard library is implicit
    // Could be enhanced to detect specific library usage
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // Check for null safety issues
    if (options.nullSafety && this._hasNullableOperations(ast)) {
      warnings.push('Some operations may require null safety annotations');
    }
    
    return warnings;
  }

  /**
   * Check if AST contains operations that might involve nulls
   * @private
   */
  _hasNullableOperations(ast) {
    return false; // Could be enhanced with more sophisticated checking
  }

  /**
   * Check if Kotlin compiler is available on the system
   * @private
   */
  _isKotlinAvailable() {
    try {
      const { execSync } = require('child_process');
      
      // Try kotlinc first
      try {
        execSync('kotlinc -version', { 
          stdio: 'pipe', 
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        return 'kotlinc';
      } catch (error) {
        // Try kotlin as fallback
        try {
          execSync('kotlin -version', { 
            stdio: 'pipe', 
            timeout: 3000,
            windowsHide: true  // Prevent Windows error dialogs
          });
          return 'kotlin';
        } catch (error2) {
          return false;
        }
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Basic syntax validation for Kotlin code
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      let braces = 0;
      let parentheses = 0;
      let brackets = 0;
      let inString = false;
      let inTripleString = false;
      let inLineComment = false;
      let inBlockComment = false;
      let escaped = false;
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const nextChar = i < code.length - 1 ? code[i + 1] : '';
        const nextNextChar = i < code.length - 2 ? code[i + 2] : '';
        
        // Handle triple-quoted strings (""")
        if (char === '"' && nextChar === '"' && nextNextChar === '"' && !inString && !inLineComment && !inBlockComment) {
          inTripleString = !inTripleString;
          i += 2; // Skip the next two quotes
          continue;
        }
        
        // Handle regular strings
        if (char === '"' && !escaped && !inTripleString && !inLineComment && !inBlockComment) {
          inString = !inString;
          continue;
        }
        
        // Handle comments
        if (!inString && !inTripleString) {
          if (char === '/' && nextChar === '/' && !inBlockComment) {
            inLineComment = true;
            i++; // Skip next character
            continue;
          }
          if (char === '/' && nextChar === '*' && !inLineComment) {
            inBlockComment = true;
            i++; // Skip next character
            continue;
          }
          if (char === '*' && nextChar === '/' && inBlockComment) {
            inBlockComment = false;
            i++; // Skip next character
            continue;
          }
        }
        
        // Handle line endings for line comments
        if (char === '\n') {
          inLineComment = false;
        }
        
        // Track escape sequences in regular strings (not in triple strings)
        if (char === '\\' && inString && !inTripleString) {
          escaped = !escaped;
          continue;
        } else {
          escaped = false;
        }
        
        // Skip if inside string or comment
        if (inString || inTripleString || inLineComment || inBlockComment) {
          continue;
        }
        
        // Count brackets and braces
        switch (char) {
          case '{':
            braces++;
            break;
          case '}':
            braces--;
            if (braces < 0) return false;
            break;
          case '(':
            parentheses++;
            break;
          case ')':
            parentheses--;
            if (parentheses < 0) return false;
            break;
          case '[':
            brackets++;
            break;
          case ']':
            brackets--;
            if (brackets < 0) return false;
            break;
        }
      }
      
      return braces === 0 && parentheses === 0 && brackets === 0 && !inString && !inTripleString && !inBlockComment;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate Kotlin code syntax using kotlinc compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Kotlin is available first
    const compiler = this._isKotlinAvailable();
    if (!compiler) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Kotlin compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_kotlin_${Date.now()}.kt`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write Kotlin code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the Kotlin code to JVM bytecode
        const outputDir = path.join(tempDir, 'output');
        fs.mkdirSync(outputDir, { recursive: true });
        
        execSync(`kotlinc "${tempFile}" -d "${outputDir}"`, { 
          stdio: 'pipe',
          timeout: 5000, // Kotlin compilation can be slower
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        if (fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
        
        return {
          success: true,
          method: 'kotlinc',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        const outputDir = path.join(tempDir, 'output');
        if (fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
        
        return {
          success: false,
          method: 'kotlinc',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Kotlin is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Kotlin compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get Kotlin compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Kotlin/JVM (kotlinc)',
      downloadUrl: 'https://kotlinlang.org/docs/command-line.html',
      installInstructions: [
        'Option 1 - Manual Installation:',
        '  Download Kotlin from https://github.com/JetBrains/kotlin/releases',
        '  Extract the archive and add bin/ directory to PATH',
        '',
        'Option 2 - Package Managers:',
        '  macOS: brew install kotlin',
        '  Windows: choco install kotlinc or scoop install kotlin',
        '  Linux: snap install kotlin --classic',
        '',
        'Option 3 - IntelliJ IDEA (includes Kotlin):',
        '  Download from https://www.jetbrains.com/idea/',
        '',
        'Prerequisites: Java 8+ must be installed',
        'Verify installation with: kotlinc -version'
      ].join('\n'),
      verifyCommand: 'kotlinc -version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/braces/parentheses)',
      packageManager: 'Gradle/Maven (for dependencies)',
      documentation: 'https://kotlinlang.org/docs/'
    };
  }
}

// Register the plugin
const kotlinPlugin = new KotlinPlugin();
LanguagePlugins.Add(kotlinPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = kotlinPlugin;
}


})(); // End of IIFE