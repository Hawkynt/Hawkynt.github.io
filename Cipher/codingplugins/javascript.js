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
    this.description = 'Modern JavaScript (ES2020+) code generator';
    this.mimeType = 'text/javascript';
    this.version = 'ES2020+';
    
    // JavaScript-specific options
    this.options = {
      indent: '  ', // 2 spaces (common JS convention)
      lineEnding: '\n',
      strictTypes: false,
      useModules: true,
      addJSDoc: true,
      useArrowFunctions: true,
      useTemplateLiterals: true
    };
    
    // Internal state
    this.indentLevel = 0;
  }

  /**
   * Generate JavaScript code from Abstract Syntax Tree
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
      
      // Generate JavaScript code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add standard headers and exports
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
    const functionName = node.id ? node.id.name : 'unnamedFunction';
    let code = '';
    
    // JSDoc comment
    if (options.addJSDoc) {
      code += this._indent('/**\n');
      code += this._indent(` * ${functionName} function\n`);
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent(` * @param {*} ${paramName} - parameter\n`);
        });
      }
      code += this._indent(' * @returns {*} return value\n');
      code += this._indent(' */\n');
    }
    
    // Function signature (using regular function or arrow function based on options)
    if (options.useArrowFunctions && !this._isTopLevelFunction(node)) {
      code += this._indent(`const ${functionName} = (`);
    } else {
      code += this._indent(`function ${functionName}(`);
    }
    
    // Parameters
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => param.name || 'param');
      code += params.join(', ');
    }
    
    if (options.useArrowFunctions && !this._isTopLevelFunction(node)) {
      code += ') => {\n';
    } else {
      code += ') {\n';
    }
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("throw new Error('Not implemented');\n");
    } else {
      code += this._indent("throw new Error('Not implemented');\n");
    }
    this.indentLevel--;
    
    if (options.useArrowFunctions && !this._isTopLevelFunction(node)) {
      code += this._indent('};\n');
    } else {
      code += this._indent('}\n');
    }
    
    return code;
  }

  /**
   * Generate class declaration
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? node.id.name : 'UnnamedClass';
    let code = '';
    
    // JSDoc for class
    if (options.addJSDoc) {
      code += this._indent('/**\n');
      code += this._indent(` * ${className} class\n`);
      code += this._indent(' */\n');
    }
    
    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`class ${className} extends ${superName} {\n`);
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
    
    // JSDoc
    if (options.addJSDoc) {
      code += this._indent('/**\n');
      code += this._indent(` * ${isConstructor ? 'Constructor' : methodName + ' method'}\n`);
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent(` * @param {*} ${paramName} - parameter\n`);
        });
      }
      if (!isConstructor) {
        code += this._indent(' * @returns {*} return value\n');
      }
      code += this._indent(' */\n');
    }
    
    // Method signature
    code += this._indent(`${methodName}(`);
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => param.name || 'param');
      code += params.join(', ');
    }
    
    code += ') {\n';
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || (isConstructor ? '' : this._indent("throw new Error('Not implemented');\n"));
    } else {
      if (!isConstructor) {
        code += this._indent("throw new Error('Not implemented');\n");
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
      return this._indent("throw new Error('Empty block');\n");
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
          const keyword = node.kind || 'let';
          return this._indent(`${keyword} ${varName} = ${initValue};\n`);
        } else {
          return this._indent(`let ${varName};\n`);
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
    const operator = node.operator;
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
    const operator = node.operator;
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return node.name;
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      // Use template literals if enabled and string contains variables
      if (options.useTemplateLiterals && this._shouldUseTemplateLiteral(node.value)) {
        return `\`${node.value.replace(/`/g, '\\`')}\``;
      }
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
   * Check if this is a top-level function declaration
   * @private
   */
  _isTopLevelFunction(node) {
    // For now, assume all function declarations are top-level
    // Could be enhanced with more context tracking
    return true;
  }

  /**
   * Check if string should use template literal
   * @private
   */
  _shouldUseTemplateLiteral(str) {
    // Simple heuristic: use template literals for strings with ${} patterns
    return str.includes('${');
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
    let headers = '';
    
    if (options.useModules) {
      headers += '// Modern JavaScript ES2020+ module\n';
      headers += '"use strict";\n\n';
    }
    
    return headers + code;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // JavaScript typically doesn't have external dependencies for basic features
    // Could be enhanced to detect specific library usage
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // Check for potential improvements
    if (!options.useArrowFunctions) {
      warnings.push('Consider using arrow functions for modern JavaScript');
    }
    
    if (!options.useTemplateLiterals) {
      warnings.push('Consider using template literals for string interpolation');
    }
    
    return warnings;
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