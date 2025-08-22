/**
 * Ruby Language Plugin for Multi-Language Code Generation
 * Generates Ruby code from JavaScript AST
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
 * Ruby Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class RubyPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Ruby';
    this.extension = 'rb';
    this.icon = '💎';
    this.description = 'Ruby language code generator';
    this.mimeType = 'text/x-ruby';
    this.version = 'Ruby 3.0+';
    
    // Ruby-specific options
    this.options = {
      indent: '  ', // 2 spaces (Ruby convention)
      lineEnding: '\n',
      addComments: true,
      useStrictTypes: false, // Ruby is dynamically typed
      addShebang: true
    };
    
    // Internal state
    this.indentLevel = 0;
    this.requires = new Set();
  }

  /**
   * Generate Ruby code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.requires.clear();
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate Ruby code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add requires and script structure
      const finalCode = this._wrapWithScriptStructure(code, mergedOptions);
      
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
        return this._generateMethod(node, options);
      case 'ClassDeclaration':
        return this._generateClass(node, options);
      case 'MethodDefinition':
        return this._generateMethodDef(node, options);
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
        return '# TODO: Implement ' + node.type;
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
   * Generate method (Ruby def)
   * @private
   */
  _generateMethod(node, options) {
    const methodName = node.id ? this._toSnakeCase(node.id.name) : 'unnamed_method';
    let code = '';
    
    // Ruby comment
    if (options.addComments) {
      code += this._indent('# ' + methodName + ' method\n');
      code += this._indent('# Performs the ' + (node.id ? node.id.name : 'unnamed') + ' operation\n');
      if (node.params && node.params.length > 0) {
        code += this._indent('# @param [Object] parameters - input parameters\n');
      }
      code += this._indent('# @return [Object] result of the operation\n');
    }
    
    // Method signature
    code += this._indent('def ' + methodName);
    
    // Parameters
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return this._toSnakeCase(paramName);
      });
      code += '(' + params.join(', ') + ')';
    }
    code += '\n';
    
    // Method body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent('raise NotImplementedError, "Not implemented"\n');
    } else {
      code += this._indent('raise NotImplementedError, "Not implemented"\n');
    }
    this.indentLevel--;
    
    code += this._indent('end\n');
    
    return code;
  }

  /**
   * Generate class declaration
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? this._toPascalCase(node.id.name) : 'UnnamedClass';
    let code = '';
    
    // Class comment
    if (options.addComments) {
      code += this._indent('# ' + className + ' class\n');
      code += this._indent('# Represents a ' + (node.id ? node.id.name : 'unnamed') + ' entity\n');
    }
    
    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent('class ' + className + ' < ' + superName + '\n');
    } else {
      code += this._indent('class ' + className + '\n');
    }
    
    // Class body
    this.indentLevel++;
    
    // Add attr_accessor for properties
    code += this._indent('# Add attr_accessor, attr_reader, attr_writer as needed\n\n');
    
    // Methods
    if (node.body && node.body.length > 0) {
      const methods = node.body
        .map(method => this._generateNode(method, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
    }
    
    this.indentLevel--;
    code += this._indent('end\n');
    
    return code;
  }

  /**
   * Generate method definition
   * @private
   */
  _generateMethodDef(node, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = this._toSnakeCase(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    let code = '';
    
    // Method comment
    if (options.addComments) {
      code += this._indent('# ' + (isConstructor ? 'Constructor (initialize)' : methodName + ' method') + '\n');
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent('# @param [Object] ' + this._toSnakeCase(paramName) + ' - input parameter\n');
        });
      }
      if (!isConstructor) {
        code += this._indent('# @return [Object] method result\n');
      }
    }
    
    // Method signature
    if (isConstructor) {
      code += this._indent('def initialize');
    } else {
      code += this._indent('def ' + methodName);
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        return this._toSnakeCase(paramName);
      });
      code += '(' + params.join(', ') + ')';
    }
    code += '\n';
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || (isConstructor ? '' : this._indent('raise NotImplementedError, "Not implemented"\n'));
    } else {
      if (!isConstructor) {
        code += this._indent('raise NotImplementedError, "Not implemented"\n');
      }
    }
    this.indentLevel--;
    
    code += this._indent('end\n');
    
    return code;
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent('raise "Empty block"\n');
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
          // Ruby assignment
          return this._indent(varName + ' = ' + initValue + '\n');
        } else {
          return this._indent(varName + ' = nil\n');
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
      return this._indent(returnValue + '\n'); // Ruby implicit returns
    } else {
      return this._indent('nil\n');
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
    
    // Ruby operators
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
        operator = '&&'; // or 'and'
        break;
      case '||':
        operator = '||'; // or 'or'
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
    
    // Ruby method calls can omit parentheses, but we'll include them for clarity
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
      // Use single quotes for Ruby strings
      return "'" + node.value.replace(/'/g, "\\'") + "'";
    } else if (node.value === null) {
      return 'nil';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert to snake_case (Ruby convention)
   * @private
   */
  _toSnakeCase(str) {
    if (!str) return str;
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  /**
   * Convert to PascalCase (Ruby class naming)
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
   * Wrap generated code with script structure
   * @private
   */
  _wrapWithScriptStructure(code, options) {
    let result = '';
    
    // Shebang
    if (options.addShebang) {
      result += '#!/usr/bin/env ruby\n';
      result += '# frozen_string_literal: true\n\n';
    }
    
    // File header comment
    if (options.addComments) {
      result += '# Generated Ruby code\n';
      result += '# This file was automatically generated from JavaScript AST\n';
      result += '# Author: Code Generator\n';
      result += '# Ruby version: ' + this.version + '\n\n';
    }
    
    // Requires
    if (this.requires.size > 0) {
      for (const req of this.requires) {
        result += 'require \'' + req + '\'\n';
      }
      result += '\n';
    }
    
    // Generated code
    result += code;
    
    // Add main execution block if this is a script
    result += '\n\n# Main execution\nif __FILE__ == $0\n';
    result += '  # TODO: Add main execution code\n';
    result += '  puts "Generated Ruby code execution"\nend\n';
    
    return result;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Common Ruby gems that might be needed
    // (Ruby standard library is quite comprehensive)
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // Ruby-specific warnings
    warnings.push('Consider using symbols (:symbol) for constant string values');
    warnings.push('Add proper error handling with begin/rescue/end blocks');
    warnings.push('Consider using Ruby naming conventions (snake_case for methods/variables)');
    warnings.push('Add type annotations using Sorbet or RBS for better type safety');
    
    return warnings;
  }
}

// Register the plugin
const rubyPlugin = new RubyPlugin();
LanguagePlugins.Add(rubyPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = rubyPlugin;
}


})(); // End of IIFE