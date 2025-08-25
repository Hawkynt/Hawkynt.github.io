/**
 * Go Language Plugin for Multi-Language Code Generation
 * Generates Go code from JavaScript AST
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
 * Go Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class GoPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Go';
    this.extension = 'go';
    this.icon = '🐹';
    this.description = 'Go language code generator';
    this.mimeType = 'text/x-go';
    this.version = '1.21+';
    
    // Go-specific options
    this.options = {
      indent: '\t', // Go uses tabs by convention
      lineEnding: '\n',
      packageName: 'main',
      addComments: true,
      useStrictTypes: true,
      errorHandling: true
    };
    
    // Internal state
    this.indentLevel = 0;
    this.imports = new Set();
  }

  /**
   * Generate Go code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.imports.clear();
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate Go code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add package declaration and imports
      const finalCode = this._wrapWithPackageAndImports(code, mergedOptions);
      
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
    const functionName = node.id ? this._capitalizeFirst(node.id.name) : 'UnnamedFunction';
    let code = '';
    
    // Go doc comment
    if (options.addComments) {
      code += this._indent(`// ${functionName} performs the ${node.id ? node.id.name : 'unnamed'} operation\n`);
    }
    
    // Function signature
    code += this._indent(`func ${functionName}(`);
    
    // Parameters with Go types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return `${paramName} interface{}`; // Use interface{} for generic type
      });
      code += params.join(', ');
    }
    
    // Return type (infer from context or use interface{})
    code += ') interface{} {\n';
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent('panic("Not implemented")\n');
    } else {
      code += this._indent('panic("Not implemented")\n');
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
      return this._indent('panic("Empty block")\n');
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
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // Use := for short variable declaration in Go
          return this._indent(`${varName} := ${initValue}\n`);
        } else {
          // Use var declaration with zero value
          return this._indent(`var ${varName} interface{}\n`);
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
      return this._indent('return nil\n');
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
    
    // Handle type conversions for arithmetic operations
    if (['+', '-', '*', '/', '%'].includes(operator)) {
      // In Go, we might need type assertions for interface{} operations
      return `${left}.(int) ${operator} ${right}.(int)`;
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
      `.${this._capitalizeFirst(node.property.name || node.property)}`;
    
    return `${object}${property}`;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = node.operator;
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    // Go naming conventions: exported names start with uppercase
    return node.name;
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return `"${node.value.replace(/"/g, '\\"')}"`;
    } else if (node.value === null) {
      return 'nil';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Capitalize first letter (Go convention for exported functions)
   * @private
   */
  _capitalizeFirst(str) {
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
   * Wrap generated code with package declaration and imports
   * @private
   */
  _wrapWithPackageAndImports(code, options) {
    let result = `package ${options.packageName}\n\n`;
    
    // Add imports if any were collected
    if (this.imports.size > 0) {
      if (this.imports.size === 1) {
        result += `import "${Array.from(this.imports)[0]}"\n\n`;
      } else {
        result += 'import (\n';
        for (const imp of this.imports) {
          result += `\t"${imp}"\n`;
        }
        result += ')\n\n';
      }
    }
    
    return result + code;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Standard Go packages that might be needed
    if (options.errorHandling) {
      dependencies.push('errors');
    }
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // Go-specific warnings
    warnings.push('Consider adding proper error handling');
    warnings.push('Replace interface{} with specific types for better performance');
    warnings.push('Add unit tests using the testing package');
    
    return warnings;
  }

  /**
   * Check if Go compiler is available on the system
   * @private
   */
  _isGoAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('go version', { 
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
   * Basic syntax validation for Go code
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
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const nextChar = i < code.length - 1 ? code[i + 1] : '';
        
        // Handle raw strings (`...`)
        if (char === '`' && !inString && !inLineComment && !inBlockComment) {
          inRawString = !inRawString;
          continue;
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
   * Validate Go code syntax using go compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Go is available first
    if (!this._isGoAvailable()) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Go compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary directory and file
      const tempDir = path.join(__dirname, '..', '.agent.tmp', `temp_go_${Date.now()}`);
      const tempFile = path.join(tempDir, 'main.go');
      
      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Create go.mod file for proper module structure
      const goModContent = `module tempvalidation

go 1.21
`;
      fs.writeFileSync(path.join(tempDir, 'go.mod'), goModContent);
      
      // Write Go code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the Go code (build without executing)
        // Use different output depending on platform
        const buildOutput = process.platform === 'win32' ? 'nul' : '/dev/null';
        execSync(`go build -o ${buildOutput} .`, { 
          stdio: 'pipe',
          timeout: 3000,
          cwd: tempDir,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        return {
          success: true,
          method: 'go',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        
        return {
          success: false,
          method: 'go',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Go is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Go compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get Go compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Go',
      downloadUrl: 'https://golang.org/dl/',
      installInstructions: [
        'Download Go from https://golang.org/dl/',
        'Windows: Run the MSI installer and follow the prompts',
        'macOS: Run the PKG installer or use Homebrew: brew install go',
        'Linux: Extract to /usr/local and add /usr/local/go/bin to PATH',
        'Verify installation with: go version',
        'Set GOPATH environment variable (optional for Go 1.11+)'
      ].join('\n'),
      verifyCommand: 'go version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/braces/parentheses)',
      packageManager: 'go mod (built-in module system)',
      documentation: 'https://golang.org/doc/'
    };
  }
}

// Register the plugin
const goPlugin = new GoPlugin();
LanguagePlugins.Add(goPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = goPlugin;
}


})(); // End of IIFE