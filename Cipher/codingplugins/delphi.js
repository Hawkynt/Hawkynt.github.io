/**
 * Delphi Language Plugin for Multi-Language Code Generation
 * Generates Delphi/Object Pascal code from JavaScript AST
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
 * Delphi Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class DelphiPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Delphi';
    this.extension = 'pas';
    this.icon = '🏛️';
    this.description = 'Delphi/Object Pascal code generator';
    this.mimeType = 'text/x-pascal';
    this.version = 'Delphi 11+';
    
    // Delphi-specific options
    this.options = {
      indent: '  ', // 2 spaces
      lineEnding: '\n',
      addComments: true,
      strictTypes: true,
      unitName: 'GeneratedUnit',
      useInterfaces: true
    };
    
    // Internal state
    this.indentLevel = 0;
    this.uses = new Set();
  }

  /**
   * Generate Delphi code from Abstract Syntax Tree
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
      
      // Generate Delphi code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add unit structure
      const finalCode = this._wrapWithUnitStructure(code, mergedOptions);
      
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
        return 'Self';
      default:
        return '{ TODO: Implement ' + node.type + ' }';
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
    
    // Delphi XML documentation comment
    if (options.addComments) {
      code += this._indent('{ ' + functionName + ' function }\n');
      code += this._indent('{ Performs the ' + (node.id ? node.id.name : 'unnamed') + ' operation }\n');
    }
    
    // Function declaration
    code += this._indent('function ' + functionName + '(');
    
    // Parameters with Pascal types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'AParam';
        return `${this._capitalizeFirst(paramName)}: Variant`;
      });
      code += params.join('; ');
    }
    
    code += '): Variant;\n';
    
    // Function body
    if (node.body) {
      code += this._indent('begin\n');
      this.indentLevel++;
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("raise Exception.Create('Not implemented');\n");
      this.indentLevel--;
      code += this._indent('end;\n');
    } else {
      code += this._indent('begin\n');
      code += this._indent("  raise Exception.Create('Not implemented');\n");
      code += this._indent('end;\n');
    }
    
    return code;
  }

  /**
   * Generate class declaration
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? this._capitalizeFirst(node.id.name) : 'TUnnamedClass';
    let code = '';
    
    // Ensure class name starts with T (Delphi convention)
    const delphiClassName = className.startsWith('T') ? className : 'T' + className;
    
    // Class comment
    if (options.addComments) {
      code += this._indent(`{ ${delphiClassName} class }\n`);
    }
    
    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`${delphiClassName} = class(${superName})\n`);
    } else {
      code += this._indent(`${delphiClassName} = class\n`);
    }
    
    // Class sections
    if (node.body && node.body.length > 0) {
      code += this._indent('private\n');
      this.indentLevel++;
      code += this._indent('{ Private declarations }\n');
      this.indentLevel--;
      
      code += this._indent('public\n');
      this.indentLevel++;
      
      // Methods
      const methods = node.body
        .map(method => this._generateNode(method, options))
        .filter(m => m.trim());
      code += methods.join('\n');
      
      this.indentLevel--;
    }
    
    code += this._indent('end;\n');
    
    return code;
  }

  /**
   * Generate method definition
   * @private
   */
  _generateMethod(node, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = this._capitalizeFirst(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    let code = '';
    
    // Method comment
    if (options.addComments) {
      code += this._indent('{ ' + (isConstructor ? 'Constructor' : methodName + ' method') + ' }\n');
    }
    
    // Method declaration
    if (isConstructor) {
      code += this._indent('constructor Create(');
    } else {
      code += this._indent('procedure ' + methodName + '(');
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'AParam';
        return this._capitalizeFirst(paramName) + ': Variant';
      });
      code += params.join('; ');
    }
    
    if (isConstructor) {
      code += '); override;\n';
    } else {
      code += ');\n';
    }
    
    return code;
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent("raise Exception.Create('Empty block');\n");
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
        const varName = decl.id ? this._capitalizeFirst(decl.id.name) : 'Variable';
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // Delphi assignment
          return this._indent(varName + ' := ' + initValue + ';\n');
        } else {
          // Delphi variable declaration would be in var section
          return this._indent('{ var ' + varName + ': Variant; }\n');
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
      return this._indent('Result := ' + returnValue + ';\n');
    } else {
      return this._indent('Exit;\n');
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
    
    // Delphi operators
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
        operator = 'and';
        break;
      case '||':
        operator = 'or';
        break;
      case '%':
        operator = 'mod';
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
    
    return `${callee}(${args})`;
  }

  /**
   * Generate member expression
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ? 
      '[' + this._generateNode(node.property, options) + ']' : 
      '.' + this._capitalizeFirst(node.property.name || node.property);
    
    return object + property;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    
    // Delphi uses := for assignment
    return left + ' := ' + right;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return this._capitalizeFirst(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return `'${node.value.replace(/'/g, "''")}'`;
    } else if (node.value === null) {
      return 'nil';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'True' : 'False';
    } else {
      return String(node.value);
    }
  }

  /**
   * Capitalize first letter (Delphi naming convention)
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
   * Wrap generated code with unit structure
   * @private
   */
  _wrapWithUnitStructure(code, options) {
    let result = `unit ${options.unitName};\n\n`;
    
    // Interface section
    result += 'interface\n\n';
    
    // Uses clause
    if (this.uses.size > 0) {
      result += 'uses\n';
      const usesList = Array.from(this.uses);
      for (let i = 0; i < usesList.length; i++) {
        result += '  ' + usesList[i];
        if (i < usesList.length - 1) {
          result += ',\n';
        } else {
          result += ';\n';
        }
      }
      result += '\n';
    } else {
      result += 'uses\n  System.SysUtils, System.Variants;\n\n';
    }
    
    // Type declarations (if any classes)
    result += 'type\n';
    result += '  { Forward declarations }\n\n';
    
    // Function declarations
    result += '{ Function declarations }\n';
    result += code;
    result += '\n';
    
    // Implementation section
    result += 'implementation\n\n';
    
    // Implementation would go here in a full unit
    result += '{ Implementation }\n\n';
    
    // Unit end
    result += 'end.\n';
    
    return result;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Common Delphi units
    dependencies.push('System.SysUtils');
    dependencies.push('System.Variants');
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // Delphi-specific warnings
    warnings.push('Consider using specific types instead of Variant for better performance');
    warnings.push('Add proper exception handling');
    warnings.push('Follow Delphi naming conventions (TClassName, ProcedureName)');
    
    return warnings;
  }
}

// Register the plugin
const delphiPlugin = new DelphiPlugin();
LanguagePlugins.Add(delphiPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = delphiPlugin;
}


})(); // End of IIFE