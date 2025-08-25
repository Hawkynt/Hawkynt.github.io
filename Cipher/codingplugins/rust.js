/**
 * Rust Language Plugin for Multi-Language Code Generation
 * Generates Rust code from JavaScript AST
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
 * Rust Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class RustPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Rust';
    this.extension = 'rs';
    this.icon = '🦀';
    this.description = 'Rust language code generator';
    this.mimeType = 'text/x-rust';
    this.version = '1.70+';
    
    // Rust-specific options
    this.options = {
      indent: '    ', // 4 spaces (Rust convention)
      lineEnding: '\n',
      addComments: true,
      useStrictTypes: true,
      errorHandling: true,
      edition: '2021'
    };
    
    // Internal state
    this.indentLevel = 0;
    this.uses = new Set();
  }

  /**
   * Generate Rust code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.uses.clear();
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate Rust code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add use statements and module structure
      const finalCode = this._wrapWithModuleStructure(code, mergedOptions);
      
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
        return this._generateStruct(node, options);
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
        return 'self';
      default:
        return '// TODO: Implement ' + node.type;
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
    const functionName = node.id ? this._toSnakeCase(node.id.name) : 'unnamed_function';
    let code = '';
    
    // Rust doc comment
    if (options.addComments) {
      code += this._indent('/// ' + functionName + ' function\n');
      code += this._indent('/// Performs the ' + (node.id ? node.id.name : 'unnamed') + ' operation\n');
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent('/// * `' + paramName + '` - input parameter\n');
        });
      }
      code += this._indent('/// \n');
      code += this._indent('/// # Returns\n');
      code += this._indent('/// \n');
      code += this._indent('/// Returns the result of the operation\n');
    }
    
    // Function signature
    code += this._indent('fn ' + functionName + '(');
    
    // Parameters with Rust types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return paramName + ': i32'; // Default to i32, could be enhanced with type inference
      });
      code += params.join(', ');
    }
    
    // Return type
    code += ') -> i32 {\n';
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent('panic!("Not implemented")\n');
    } else {
      code += this._indent('panic!("Not implemented")\n');
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate struct (equivalent to class)
   * @private
   */
  _generateStruct(node, options) {
    const structName = node.id ? this._toPascalCase(node.id.name) : 'UnnamedStruct';
    let code = '';
    
    // Struct doc comment
    if (options.addComments) {
      code += this._indent('/// ' + structName + ' struct\n');
      code += this._indent('/// Represents a ' + (node.id ? node.id.name : 'unnamed') + ' entity\n');
    }
    
    // Struct declaration
    code += this._indent('#[derive(Debug, Clone)]\n');
    code += this._indent('pub struct ' + structName + ' {\n');
    
    // Struct fields (would need to be inferred from class body)
    this.indentLevel++;
    code += this._indent('// Fields would be defined here\n');
    this.indentLevel--;
    
    code += this._indent('}\n\n');
    
    // Implementation block
    code += this._indent('impl ' + structName + ' {\n');
    
    // Methods
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
    
    const methodName = this._toSnakeCase(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    let code = '';
    
    // Method doc comment
    if (options.addComments) {
      code += this._indent('/// ' + (isConstructor ? 'Creates a new instance' : methodName + ' method') + '\n');
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent('/// * `' + paramName + '` - input parameter\n');
        });
      }
    }
    
    // Method signature
    if (isConstructor) {
      code += this._indent('pub fn new(');
    } else {
      code += this._indent('pub fn ' + methodName + '(&self');
      if (node.value.params && node.value.params.length > 0) {
        code += ', ';
      }
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        return paramName + ': i32';
      });
      code += params.join(', ');
    }
    
    if (isConstructor) {
      code += ') -> Self {\n';
    } else {
      code += ') -> i32 {\n';
    }
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || (isConstructor ? this._indent('Self {}\n') : this._indent('panic!("Not implemented")\n'));
    } else {
      if (isConstructor) {
        code += this._indent('Self {}\n');
      } else {
        code += this._indent('panic!("Not implemented")\n');
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
      return this._indent('panic!("Empty block")\n');
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
        const varName = decl.id ? this._toSnakeCase(decl.id.name) : 'variable';
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // Use let for mutable variables
          const keyword = node.kind === 'const' ? 'let' : 'let mut';
          return this._indent(keyword + ' ' + varName + ' = ' + initValue + ';\n');
        } else {
          return this._indent('let ' + varName + ': i32;\n');
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
      return this._indent(returnValue + '\n'); // Rust uses implicit returns
    } else {
      return this._indent('()\n'); // Unit type
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
    
    // Rust operators
    switch (operator) {
      case '===':
      case '==':
        operator = '==';
        break;
      case '!==':
      case '!=':
        operator = '!=';
        break;
      case '&&':
        operator = '&&';
        break;
      case '||':
        operator = '||';
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
      '[' + this._generateNode(node.property, options) + ']' : 
      '.' + this._toSnakeCase(node.property.name || node.property);
    
    return object + property;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = node.operator;
    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return this._toSnakeCase(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return '"' + node.value.replace(/"/g, '\\"') + '"';
    } else if (node.value === null) {
      return 'None'; // Option<T>::None
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert to snake_case (Rust convention)
   * @private
   */
  _toSnakeCase(str) {
    if (!str) return str;
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  /**
   * Convert to PascalCase (Rust struct/enum naming)
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
   * Wrap generated code with module structure
   * @private
   */
  _wrapWithModuleStructure(code, options) {
    let result = '';
    
    // File header comment
    if (options.addComments) {
      result += '//! Generated Rust code\n';
      result += '//! This file was automatically generated from JavaScript AST\n\n';
    }
    
    // Use statements
    if (this.uses.size > 0) {
      for (const use of this.uses) {
        result += 'use ' + use + ';\n';
      }
      result += '\n';
    }
    
    return result + code;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Standard Rust crates that might be needed
    if (options.errorHandling) {
      dependencies.push('std::error::Error');
    }
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // Rust-specific warnings
    warnings.push('Consider using specific types instead of i32 for better type safety');
    warnings.push('Add proper error handling with Result<T, E> types');
    warnings.push('Consider using references (&T) to avoid unnecessary moves');
    warnings.push('Run `cargo clippy` to check for additional Rust-specific issues');
    
    return warnings;
  }

  /**
   * Check if Rust compiler is available on the system
   * @private
   */
  _isRustAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('rustc --version', { 
        stdio: 'pipe', 
        timeout: 2000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Basic syntax validation for Rust code
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      let braces = 0;
      let parentheses = 0;
      let brackets = 0;
      let inString = false;
      let inRawString = false;
      let inLineComment = false;
      let inBlockComment = false;
      let escaped = false;
      let rawStringHashes = 0;
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const nextChar = i < code.length - 1 ? code[i + 1] : '';
        
        // Handle raw strings (r#"..."# or r"...")
        if (char === 'r' && nextChar === '"' && !inString && !inLineComment && !inBlockComment) {
          inRawString = true;
          rawStringHashes = 0;
          i++; // Skip the quote
          continue;
        }
        
        if (char === 'r' && nextChar === '#' && !inString && !inLineComment && !inBlockComment) {
          // Count hashes for raw string delimiter
          let hashCount = 0;
          let j = i + 1;
          while (j < code.length && code[j] === '#') {
            hashCount++;
            j++;
          }
          if (j < code.length && code[j] === '"') {
            inRawString = true;
            rawStringHashes = hashCount;
            i = j; // Skip to the quote
            continue;
          }
        }
        
        // End raw strings
        if (inRawString && char === '"') {
          let hashCount = 0;
          let j = i + 1;
          while (j < code.length && code[j] === '#' && hashCount < rawStringHashes) {
            hashCount++;
            j++;
          }
          if (hashCount === rawStringHashes) {
            inRawString = false;
            i = j - 1; // Will be incremented by loop
            continue;
          }
        }
        
        // Handle regular strings
        if (char === '"' && !escaped && !inRawString && !inLineComment && !inBlockComment) {
          inString = !inString;
          continue;
        }
        
        // Handle comments
        if (!inString && !inRawString) {
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
        
        // Track escape sequences in regular strings
        if (char === '\\' && inString && !inRawString) {
          escaped = !escaped;
          continue;
        } else {
          escaped = false;
        }
        
        // Skip if inside string or comment
        if (inString || inRawString || inLineComment || inBlockComment) {
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
      
      return braces === 0 && parentheses === 0 && brackets === 0 && !inString && !inRawString && !inBlockComment;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate Rust code syntax using rustc compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Rust is available first
    if (!this._isRustAvailable()) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Rust compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_rust_${Date.now()}.rs`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write Rust code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the Rust code as a library crate (--crate-type=lib allows incomplete code)
        execSync(`rustc --crate-type=lib "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up (rustc generates output files)
        fs.unlinkSync(tempFile);
        
        // Clean up any generated library files
        const libFile = tempFile.replace('.rs', '.rlib');
        if (fs.existsSync(libFile)) {
          fs.unlinkSync(libFile);
        }
        
        return {
          success: true,
          method: 'rustc',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        // Clean up any generated files
        const libFile = tempFile.replace('.rs', '.rlib');
        if (fs.existsSync(libFile)) {
          fs.unlinkSync(libFile);
        }
        
        return {
          success: false,
          method: 'rustc',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Rust is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Rust compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get Rust compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Rust (rustc)',
      downloadUrl: 'https://www.rust-lang.org/tools/install',
      installInstructions: [
        'Install Rust using rustup from https://rustup.rs/',
        'Windows: Download and run rustup-init.exe',
        'macOS/Linux: curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh',
        'Follow the on-screen instructions to complete installation',
        'Restart your terminal or run: source $HOME/.cargo/env',
        'Verify installation with: rustc --version',
        'Install additional tools: rustup component add clippy rustfmt'
      ].join('\n'),
      verifyCommand: 'rustc --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/braces/parentheses)',
      packageManager: 'Cargo (built-in package manager)',
      documentation: 'https://doc.rust-lang.org/'
    };
  }
}

// Register the plugin
const rustPlugin = new RustPlugin();
LanguagePlugins.Add(rustPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = rustPlugin;
}


})(); // End of IIFE