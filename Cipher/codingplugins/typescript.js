/**
 * TypeScript Language Plugin for Multi-Language Code Generation
 * Generates TypeScript compatible code from JavaScript AST
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
 * TypeScript Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class TypeScriptPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'TypeScript';
    this.extension = 'ts';
    this.icon = '📘';
    this.description = 'TypeScript code generator';
    this.mimeType = 'text/x-typescript';
    this.version = '5.0+';
    
    // TypeScript-specific options
    this.options = {
      indent: '  ', // 2 spaces (common TS convention)
      lineEnding: '\n',
      strictTypes: true,
      addJSDoc: true,
      useInterfaces: true,
      exportAll: false
    };
    
    // Internal state
    this.indentLevel = 0;
  }

  /**
   * Generate TypeScript code from Abstract Syntax Tree
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
      
      // Generate TypeScript code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add standard headers and types
      const finalCode = this._wrapWithTypes(code, mergedOptions);
      
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
          const paramType = this._inferTypeScriptType(paramName);
          code += this._indent(` * @param ${paramName} - ${paramType} parameter\n`);
        });
      }
      const returnType = this._inferReturnType(functionName);
      code += this._indent(` * @returns ${returnType}\n`);
      code += this._indent(' */\n');
    }
    
    // Function signature with export if needed
    const exportKeyword = options.exportAll ? 'export ' : '';
    code += this._indent(`${exportKeyword}function ${functionName}(`);
    
    // Parameters with types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = this._inferTypeScriptType(paramName);
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
      code += bodyCode || this._indent("throw new Error('Not implemented');\n");
    } else {
      code += this._indent("throw new Error('Not implemented');\n");
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
    
    // JSDoc for class
    if (options.addJSDoc) {
      code += this._indent('/**\n');
      code += this._indent(` * ${className} class\n`);
      code += this._indent(' */\n');
    }
    
    // Class declaration with inheritance and export
    const exportKeyword = options.exportAll ? 'export ' : '';
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`${exportKeyword}class ${className} extends ${superName} {\n`);
    } else {
      code += this._indent(`${exportKeyword}class ${className} {\n`);
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
          const paramType = this._inferTypeScriptType(paramName);
          code += this._indent(` * @param ${paramName} - ${paramType} parameter\n`);
        });
      }
      if (!isConstructor) {
        const returnType = this._inferReturnType(methodName);
        code += this._indent(` * @returns ${returnType}\n`);
      }
      code += this._indent(' */\n');
    }
    
    // Method signature
    code += this._indent(`${methodName}(`);
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = this._inferTypeScriptType(paramName);
        return `${paramName}: ${paramType}`;
      });
      code += params.join(', ');
    }
    
    // Return type
    if (!isConstructor) {
      const returnType = this._inferReturnType(methodName);
      code += `): ${returnType} {\n`;
    } else {
      code += ') {\n';
    }
    
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
        const varType = this._inferTypeScriptType(varName);
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          const keyword = node.kind || 'let';
          return this._indent(`${keyword} ${varName}: ${varType} = ${initValue};\n`);
        } else {
          return this._indent(`let ${varName}: ${varType} | undefined;\n`);
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
      return 'null';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Map JavaScript operators (mostly unchanged for TypeScript)
   * @private
   */
  _mapOperator(operator) {
    // TypeScript uses same operators as JavaScript
    return operator;
  }

  /**
   * Infer TypeScript type from parameter/variable name
   * @private
   */
  _inferTypeScriptType(name) {
    const typeMap = {
      'data': 'Uint8Array | string',
      'key': 'string',
      'input': 'any',
      'value': 'number',
      'index': 'number',
      'length': 'number',
      'result': 'number'
    };
    return typeMap[name.toLowerCase()] || 'any';
  }

  /**
   * Infer return type for functions
   * @private
   */
  _inferReturnType(functionName) {
    const returnTypeMap = {
      'encrypt': 'Uint8Array',
      'decrypt': 'Uint8Array',
      'simpleFunction': 'number'
    };
    return returnTypeMap[functionName] || 'any';
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
   * Wrap generated code with necessary type definitions
   * @private
   */
  _wrapWithTypes(code, options) {
    let types = '';
    
    // Add common type definitions if needed
    if (options.useInterfaces && this._needsInterfaces(code)) {
      types += '// Type definitions\n';
      types += 'interface CipherInterface {\n';
      types += '  encrypt(data: Uint8Array | string): Uint8Array;\n';
      types += '  decrypt(data: Uint8Array): Uint8Array;\n';
      types += '}\n\n';
    }
    
    return types + code;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // TypeScript compiler handles most dependencies
    if (this._usesNodeTypes(ast)) {
      dependencies.push('@types/node');
    }
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // Check for type safety issues
    if (options.strictTypes && this._hasAnyTypes(ast)) {
      warnings.push('Consider replacing "any" types with more specific types');
    }
    
    return warnings;
  }

  /**
   * Check if code needs interface definitions
   * @private
   */
  _needsInterfaces(code) {
    return false; // Could be enhanced with more sophisticated checking
  }

  /**
   * Check if AST uses Node.js specific features
   * @private
   */
  _usesNodeTypes(ast) {
    return false; // Could be enhanced to detect Buffer, fs, etc.
  }

  /**
   * Check if AST has "any" types that could be made more specific
   * @private
   */
  _hasAnyTypes(ast) {
    return false; // Could be enhanced with type analysis
  }
}

// Register the plugin
const typeScriptPlugin = new TypeScriptPlugin();
LanguagePlugins.Add(typeScriptPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = typeScriptPlugin;
}


})(); // End of IIFE