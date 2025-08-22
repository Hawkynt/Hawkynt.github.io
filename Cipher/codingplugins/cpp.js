/**
 * C++ Language Plugin for Multi-Language Code Generation
 * Generates C++ code from JavaScript AST
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
 * C++ Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class CppPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'C++';
    this.extension = 'cpp';
    this.icon = '🔧';
    this.description = 'C++ language code generator';
    this.mimeType = 'text/x-c++src';
    this.version = 'C++11/14/17/20';
    
    // C++-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      addComments: true,
      useNamespaces: true,
      cppStandard: 'cpp17', // cpp98, cpp03, cpp11, cpp14, cpp17, cpp20
      useSmartPointers: true,
      useModernSyntax: true,
      addHeaders: true
    };
    
    // Internal state
    this.indentLevel = 0;
    this.includes = new Set();
    this.namespaces = new Set();
    this.declarations = [];
  }

  /**
   * Generate C++ code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.includes.clear();
      this.namespaces.clear();
      this.declarations = [];
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate C++ code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add headers, namespaces, and program structure
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
    const functionName = node.id ? this._toCamelCase(node.id.name) : 'unnamedFunction';
    let code = '';
    
    // Function template (C++11+)
    if (options.useModernSyntax) {
      code += this._indent('template<typename T = int>\n');
    }
    
    // Doxygen comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * @brief ' + functionName + ' function\n');
      code += this._indent(' * @details Performs the ' + (node.id ? node.id.name : 'unnamed') + ' operation\n');
      if (node.params && node.params.length > 0) {
        node.params.forEach((param, index) => {
          const paramName = param.name || 'param' + index;
          code += this._indent(' * @param ' + paramName + ' Input parameter\n');
        });
      }
      code += this._indent(' * @return Result of the operation\n');
      code += this._indent(' * @throws std::exception On error conditions\n');
      code += this._indent(' */\n');
    }
    
    // Function signature with modern C++ features
    let returnType = 'auto';
    if (!options.useModernSyntax || options.cppStandard === 'cpp98' || options.cppStandard === 'cpp03') {
      returnType = 'int';
    }
    
    code += this._indent(returnType + ' ' + functionName + '(');
    
    // Parameters with C++ types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = options.useModernSyntax ? 'const T&' : 'int';
        return paramType + ' ' + this._toCamelCase(paramName);
      });
      code += params.join(', ');
    }
    
    code += ')';
    
    // Trailing return type (C++11+)
    if (options.useModernSyntax && (options.cppStandard === 'cpp11' || options.cppStandard === 'cpp14' || options.cppStandard === 'cpp17' || options.cppStandard === 'cpp20')) {
      code += ' -> int';
    }
    
    code += '\n';
    code += this._indent('{\n');
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent('std::cerr << "Not implemented" << std::endl;\n' + this._indent('return -1;\n'));
    } else {
      code += this._indent('std::cerr << "Not implemented" << std::endl;\n');
      code += this._indent('return -1;\n');
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
    const className = node.id ? this._toPascalCase(node.id.name) : 'UnnamedClass';
    let code = '';
    
    // Doxygen comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * @brief ' + className + ' class\n');
      code += this._indent(' * @details Represents a ' + (node.id ? node.id.name : 'unnamed') + ' entity\n');
      code += this._indent(' * @author Auto-generated from JavaScript AST\n');
      code += this._indent(' * @version 1.0\n');
      code += this._indent(' */\n');
    }
    
    // Class declaration
    code += this._indent('class ' + className + '\n');
    code += this._indent('{\n');
    
    // Public section
    code += this._indent('public:\n');
    this.indentLevel++;
    
    // Constructor
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * @brief Default constructor\n');
      code += this._indent(' */\n');
    }
    
    code += this._indent(className + '()');
    if (options.useModernSyntax) {
      code += ' = default;\n\n';
    } else {
      code += ' {}\n\n';
    }
    
    // Destructor
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * @brief Virtual destructor\n');
      code += this._indent(' */\n');
    }
    
    code += this._indent('virtual ~' + className + '()');
    if (options.useModernSyntax) {
      code += ' = default;\n\n';
    } else {
      code += ' {}\n\n';
    }
    
    // Copy constructor and assignment operator (Rule of Three/Five)
    if (options.useModernSyntax) {
      code += this._indent('// Rule of Five\n');
      code += this._indent(className + '(const ' + className + '&) = default;\n');
      code += this._indent(className + '& operator=(const ' + className + '&) = default;\n');
      code += this._indent(className + '(' + className + '&&) = default;\n');
      code += this._indent(className + '& operator=(' + className + '&&) = default;\n\n');
    }
    
    // Generate methods from class body
    if (node.body && node.body.length > 0) {
      const methods = node.body
        .map(method => this._generateMethod(method, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
      code += '\n';
    }
    
    // Private section
    this.indentLevel--;
    code += this._indent('private:\n');
    this.indentLevel++;
    
    // Member variables
    code += this._indent('int m_value{0}; ///< Member variable placeholder\n');
    if (options.useSmartPointers) {
      this.includes.add('memory');
      code += this._indent('std::unique_ptr<int> m_data; ///< Smart pointer example\n');
    }
    
    this.indentLevel--;
    code += this._indent('};\n');
    
    return code;
  }

  /**
   * Generate method definition
   * @private
   */
  _generateMethod(node, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = this._toCamelCase(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    const isStatic = node.static;
    let code = '';
    
    // Method comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * @brief ' + (isConstructor ? 'Constructor' : methodName + ' method') + '\n');
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach((param, index) => {
          const paramName = param.name || 'param' + index;
          code += this._indent(' * @param ' + paramName + ' Input parameter\n');
        });
      }
      if (!isConstructor) {
        code += this._indent(' * @return Result of the operation\n');
      }
      code += this._indent(' */\n');
    }
    
    // Method signature
    let signature = '';
    if (isStatic) {
      signature += 'static ';
    }
    
    if (isConstructor) {
      // Skip - constructor already handled in class generation
      return '';
    } else {
      if (options.useModernSyntax) {
        signature += 'auto ';
      } else {
        signature += 'int ';
      }
      signature += methodName + '(';
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = options.useModernSyntax ? 'const auto&' : 'int';
        return paramType + ' ' + this._toCamelCase(paramName);
      });
      signature += params.join(', ');
    }
    
    signature += ')';
    
    // Const qualifier for non-mutating methods
    if (!isStatic && methodName !== 'operator=') {
      signature += ' const';
    }
    
    // Trailing return type
    if (options.useModernSyntax && !isConstructor) {
      signature += ' -> int';
    }
    
    code += this._indent(signature + '\n');
    code += this._indent('{\n');
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || this._indent('// Not implemented\n' + this._indent('return -1;\n'));
    } else {
      code += this._indent('// Not implemented\n');
      code += this._indent('return -1;\n');
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
      return this._indent('std::cout << "Empty block" << std::endl;\n');
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
        const varName = decl.id ? this._toCamelCase(decl.id.name) : 'variable';
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          
          if (options.useModernSyntax) {
            // Modern C++ auto with initialization
            return this._indent('auto ' + varName + ' = ' + initValue + ';\n');
          } else {
            return this._indent('int ' + varName + ' = ' + initValue + ';\n');
          }
        } else {
          const type = options.useModernSyntax ? 'int' : 'int';
          return this._indent(type + ' ' + varName + '{};\n');
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
    
    // C++ operators (mostly same as JavaScript)
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
      '.' + this._toCamelCase(node.property.name || node.property);
    
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
    return this._toCamelCase(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return '"' + node.value.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    } else if (node.value === null) {
      return 'nullptr';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert to camelCase (C++ method convention)
   * @private
   */
  _toCamelCase(str) {
    if (!str) return str;
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
  }

  /**
   * Convert to PascalCase (C++ class convention)
   * @private
   */
  _toPascalCase(str) {
    if (!str) return str;
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, word => word.toUpperCase()).replace(/\s+/g, '');
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
      result += ' * @file generated.cpp\n';
      result += ' * @brief Generated C++ code\n';
      result += ' * @details This file was automatically generated from JavaScript AST\n';
      result += ' * @standard ' + options.cppStandard.replace('cpp', 'C++') + '\n';
      result += ' * @compiler GCC/Clang/MSVC compatible\n';
      result += ' * @author Auto-generated\n';
      result += ' * @date Generated at runtime\n';
      result += ' */\n\n';
    }
    
    // Standard includes
    this.includes.add('iostream');
    this.includes.add('string');
    this.includes.add('vector');
    this.includes.add('algorithm');
    
    if (options.useSmartPointers) {
      this.includes.add('memory');
    }
    
    if (options.useModernSyntax) {
      this.includes.add('type_traits');
      this.includes.add('utility');
    }
    
    // Add includes
    for (const include of this.includes) {
      result += '#include <' + include + '>\n';
    }
    result += '\n';
    
    // Using namespace (if enabled)
    if (options.useNamespaces) {
      result += 'using namespace std;\n\n';
    }
    
    // Generated code
    result += code;
    
    // Main function
    result += '\n\n/**\n';
    result += ' * @brief Main function\n';
    result += ' * @details Entry point for the program\n';
    result += ' * @param argc Number of command line arguments\n';
    result += ' * @param argv Array of command line arguments\n';
    result += ' * @return Exit status\n';
    result += ' */\n';
    result += 'int main(int argc, char* argv[])\n';
    result += '{\n';
    if (options.useModernSyntax) {
      result += '    // Modern C++ main with unused parameter attributes\n';
      result += '    [[maybe_unused]] auto argumentCount = argc;\n';
      result += '    [[maybe_unused]] auto arguments = argv;\n\n';
    }
    
    result += '    ' + (options.useNamespaces ? '' : 'std::') + 'cout << "Generated C++ code execution" << ' + (options.useNamespaces ? '' : 'std::') + 'endl;\n';
    
    if (options.useModernSyntax) {
      result += '    return EXIT_SUCCESS;\n';
    } else {
      result += '    return 0;\n';
    }
    result += '}\n';
    
    return result;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Standard C++ library headers
    dependencies.push('iostream');
    dependencies.push('string');
    dependencies.push('vector');
    dependencies.push('algorithm');
    
    if (options.useSmartPointers) {
      dependencies.push('memory');
    }
    
    if (options.useModernSyntax) {
      dependencies.push('type_traits');
      dependencies.push('utility');
    }
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // C++-specific warnings
    warnings.push('Consider using RAII for resource management');
    warnings.push('Use const-correctness for better code safety');
    warnings.push('Consider exception safety (basic, strong, no-throw)');
    warnings.push('Use smart pointers instead of raw pointers when appropriate');
    warnings.push('Enable compiler warnings (-Wall -Wextra -Wpedantic)');
    warnings.push('Consider using static analysis tools (Clang-tidy, PVS-Studio)');
    
    if (options.useModernSyntax) {
      warnings.push('Modern C++ features may require C++11 or later compiler support');
    }
    
    return warnings;
  }
}

// Register the plugin
const cppPlugin = new CppPlugin();
LanguagePlugins.Add(cppPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = cppPlugin;
}


})(); // End of IIFE