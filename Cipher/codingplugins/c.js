/**
 * C Language Plugin for Multi-Language Code Generation
 * Generates C code from JavaScript AST
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
 * C Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class CPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'C';
    this.extension = 'c';
    this.icon = '🔧';
    this.description = 'C language code generator';
    this.mimeType = 'text/x-c';
    this.version = 'C99/C11';
    
    // C-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      addComments: true,
      useStrictTypes: true,
      standard: 'c99', // c89, c99, c11, c17
      addHeaders: true
    };
    
    // Internal state
    this.indentLevel = 0;
    this.includes = new Set();
    this.prototypes = [];
  }

  /**
   * Generate C code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.includes.clear();
      this.prototypes = [];
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate C code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add headers, prototypes, and program structure
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
      default:
        return '/* TODO: Implement ' + node.type + ' */';
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
    
    // Add function prototype for forward declaration
    let prototype = 'int ' + functionName + '(';
    if (node.params && node.params.length > 0) {
      const paramTypes = node.params.map(() => 'int').join(', ');
      prototype += paramTypes;
    } else {
      prototype += 'void';
    }
    prototype += ');';
    this.prototypes.push(prototype);
    
    // C comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * ' + functionName + ' function\n');
      code += this._indent(' * Performs the ' + (node.id ? node.id.name : 'unnamed') + ' operation\n');
      code += this._indent(' *\n');
      if (node.params && node.params.length > 0) {
        node.params.forEach((param, index) => {
          const paramName = param.name || 'param' + index;
          code += this._indent(' * @param ' + paramName + ' Input parameter\n');
        });
      }
      code += this._indent(' * @return Result of the operation\n');
      code += this._indent(' */\n');
    }
    
    // Function signature
    code += this._indent('int ' + functionName + '(');
    
    // Parameters with C types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return 'int ' + this._toSnakeCase(paramName);
      });
      code += params.join(', ');
    } else {
      code += 'void';
    }
    
    code += ')\n';
    code += this._indent('{\n');
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent('fprintf(stderr, "Not implemented\\n");\n' + this._indent('return -1;\n'));
    } else {
      code += this._indent('fprintf(stderr, "Not implemented\\n");\n');
      code += this._indent('return -1;\n');
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
    const structName = node.id ? this._toSnakeCase(node.id.name) + '_t' : 'unnamed_struct_t';
    let code = '';
    
    // Struct comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * ' + structName + ' structure\n');
      code += this._indent(' * Represents a ' + (node.id ? node.id.name : 'unnamed') + ' entity\n');
      code += this._indent(' */\n');
    }
    
    // Struct declaration
    code += this._indent('typedef struct {\n');
    
    // Struct fields
    this.indentLevel++;
    code += this._indent('int value; /* TODO: Add appropriate fields */\n');
    this.indentLevel--;
    
    code += this._indent('} ' + structName + ';\n\n');
    
    // Generate functions for struct methods
    if (node.body && node.body.length > 0) {
      code += this._indent('/* Methods for ' + structName + ' */\n');
      const methods = node.body
        .map(method => this._generateStructMethod(method, structName, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
    }
    
    return code;
  }

  /**
   * Generate struct method as a function
   * @private
   */
  _generateStructMethod(node, structName, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = this._toSnakeCase(node.key.name);
    const fullFunctionName = structName.replace('_t', '') + '_' + methodName;
    const isConstructor = node.key.name === 'constructor';
    let code = '';
    
    // Add prototype
    let prototype = '';
    if (isConstructor) {
      prototype = structName + ' ' + structName.replace('_t', '') + '_create(';
    } else {
      prototype = 'int ' + fullFunctionName + '(' + structName + '* self';
      if (node.value.params && node.value.params.length > 0) {
        prototype += ', ';
      }
    }
    
    if (node.value.params && node.value.params.length > 0) {
      const paramTypes = node.value.params.map(() => 'int').join(', ');
      prototype += paramTypes;
    }
    
    if (isConstructor && (!node.value.params || node.value.params.length === 0)) {
      prototype += 'void';
    }
    
    prototype += ');';
    this.prototypes.push(prototype);
    
    // Method comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * ' + (isConstructor ? 'Constructor for ' + structName : fullFunctionName + ' method') + '\n');
      code += this._indent(' */\n');
    }
    
    // Function signature
    if (isConstructor) {
      code += this._indent(structName + ' ' + structName.replace('_t', '') + '_create(');
    } else {
      code += this._indent('int ' + fullFunctionName + '(' + structName + '* self');
      if (node.value.params && node.value.params.length > 0) {
        code += ', ';
      }
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        return 'int ' + this._toSnakeCase(paramName);
      });
      code += params.join(', ');
    } else if (isConstructor) {
      code += 'void';
    }
    
    code += ')\n';
    code += this._indent('{\n');
    
    // Function body
    this.indentLevel++;
    if (isConstructor) {
      code += this._indent(structName + ' result = {0};\n');
      code += this._indent('/* TODO: Initialize struct */\n');
      code += this._indent('return result;\n');
    } else {
      if (node.value.body) {
        const bodyCode = this._generateNode(node.value.body, options);
        code += bodyCode || this._indent('/* Not implemented */\n' + this._indent('return -1;\n'));
      } else {
        code += this._indent('/* Not implemented */\n');
        code += this._indent('return -1;\n');
      }
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate method definition (placeholder)
   * @private
   */
  _generateMethod(node, options) {
    return this._generateStructMethod(node, 'unknown_t', options);
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent('fprintf(stderr, "Empty block\\n");\n');
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
          // C variable declaration with initialization
          return this._indent('int ' + varName + ' = ' + initValue + ';\n');
        } else {
          return this._indent('int ' + varName + ';\n');
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
      return this._indent('return ' + returnValue + ';\n');
    } else {
      return this._indent('return 0;\n');
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
    
    // C operators are mostly the same as JavaScript
    switch (operator) {
      case '===':
        operator = '==';
        break;
      case '!==':
        operator = '!=';
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
      return '"' + node.value.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    } else if (node.value === null) {
      return 'NULL';
    } else if (typeof node.value === 'boolean') {
      // C doesn't have boolean literals (before C99 stdbool.h)
      return node.value ? '1' : '0';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert to snake_case (C convention)
   * @private
   */
  _toSnakeCase(str) {
    if (!str) return str;
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
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
      result += '/**\n';
      result += ' * Generated C code\n';
      result += ' * This file was automatically generated from JavaScript AST\n';
      result += ' * Standard: ' + options.standard.toUpperCase() + '\n';
      result += ' * Compiler: GCC/Clang compatible\n';
      result += ' */\n\n';
    }
    
    // Standard includes
    this.includes.add('stdio.h');
    this.includes.add('stdlib.h');
    this.includes.add('string.h');
    
    // Add includes
    for (const include of this.includes) {
      result += '#include <' + include + '>\n';
    }
    result += '\n';
    
    // Feature test macros
    if (options.standard === 'c99' || options.standard === 'c11') {
      result += '#define _GNU_SOURCE\n';
      result += '#define _POSIX_C_SOURCE 200809L\n\n';
    }
    
    // Function prototypes
    if (this.prototypes.length > 0) {
      result += '/* Function prototypes */\n';
      this.prototypes.forEach(proto => {
        result += proto + '\n';
      });
      result += '\n';
    }
    
    // Generated code
    result += code;
    
    // Main function
    result += '\n\n/**\n';
    result += ' * Main function\n';
    result += ' * Entry point for the program\n';
    result += ' */\n';
    result += 'int main(int argc, char* argv[])\n';
    result += '{\n';
    result += '    /* TODO: Add main program logic */\n';
    result += '    printf("Generated C code execution\\n");\n';
    result += '    return EXIT_SUCCESS;\n';
    result += '}\n';
    
    return result;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Standard C library headers
    dependencies.push('stdio.h');
    dependencies.push('stdlib.h');
    dependencies.push('string.h');
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // C-specific warnings
    warnings.push('Check for buffer overflows and use safe string functions');
    warnings.push('Add proper error checking for system calls and library functions');
    warnings.push('Consider using const for read-only parameters');
    warnings.push('Add memory management (malloc/free) for dynamic allocation');
    warnings.push('Use static analysis tools like Clang Static Analyzer or Coverity');
    
    return warnings;
  }
}

// Register the plugin
const cPlugin = new CPlugin();
LanguagePlugins.Add(cPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = cPlugin;
}


})(); // End of IIFE