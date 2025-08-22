/**
 * Perl Language Plugin for Multi-Language Code Generation
 * Generates Perl 5.x compatible code from JavaScript AST
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
 * Perl Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class PerlPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Perl';
    this.extension = 'pl';
    this.icon = '🐪';
    this.description = 'Perl 5.x code generator';
    this.mimeType = 'text/x-perl';
    this.version = '5.30+';
    
    // Perl-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      strictTypes: false,
      useStrict: true,
      useWarnings: true,
      addSignatures: false // Perl 5.36+ feature
    };
    
    // Internal state
    this.indentLevel = 0;
  }

  /**
   * Generate Perl code from Abstract Syntax Tree
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
      
      // Generate Perl code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add standard headers and pragmas
      const finalCode = this._wrapWithPragmas(code, mergedOptions);
      
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
        return '$self';
      default:
        return `# TODO: Implement ${node.type}`;
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
    const functionName = node.id ? this._toPerlName(node.id.name) : 'unnamed_function';
    let code = '';
    
    // Function signature
    if (options.addSignatures && options.version >= '5.36') {
      // Modern Perl with signatures
      code += this._indent(`sub ${functionName}(`);
      if (node.params && node.params.length > 0) {
        const params = node.params.map(param => '$' + (param.name || 'param'));
        code += params.join(', ');
      }
      code += ') {\n';
    } else {
      // Traditional Perl
      code += this._indent(`sub ${functionName} {\n`);
      
      // Parameter extraction
      if (node.params && node.params.length > 0) {
        this.indentLevel++;
        const params = node.params.map((param, index) => 
          `my $${param.name || 'param' + index} = $_[${index}];`
        );
        code += this._indent(params.join('\n') + '\n\n');
        this.indentLevel--;
      }
    }
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("return;\n");
    } else {
      code += this._indent("return;\n");
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate class declaration (using Moo/Moose style)
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? node.id.name : 'UnnamedClass';
    let code = '';
    
    // Package declaration
    code += this._indent(`package ${className};\n\n`);
    
    // Use modern object system
    code += this._indent('use Moo;\n');
    
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`extends '${superName}';\n`);
    }
    
    code += '\n';
    
    // Class body (methods)
    if (node.body && node.body.length > 0) {
      const methods = node.body
        .map(method => this._generateNode(method, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
    }
    
    // End package
    code += '\n' + this._indent('1; # End of package\n');
    
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
    
    if (isConstructor) {
      // Constructor is handled by Moo automatically
      return '';
    }
    
    return this._generateFunction({
      id: { name: methodName },
      params: [{ name: 'self' }, ...(node.value.params || [])],
      body: node.value.body
    }, options);
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent("return;\n");
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
          return this._indent(`my ${varName} = ${initValue};\n`);
        } else {
          return this._indent(`my ${varName};\n`);
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
      `{${this._generateNode(node.property, options)}}` : 
      `->{${node.property.name || node.property}}`;
    
    // Convert this.something to $self->{something}
    if (object === '$self' || object === 'this') {
      return `$self${property}`;
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
    if (node.name === 'this') return '$self';
    return '$' + this._toPerlName(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return `"${node.value.replace(/"/g, '\\"')}"`;
    } else if (node.value === null) {
      return 'undef';
    } else if (typeof node.value === 'boolean') {
      return node.value ? '1' : '0';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert JavaScript names to Perl naming convention
   * @private
   */
  _toPerlName(name) {
    // Convert camelCase to snake_case
    return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  /**
   * Map JavaScript operators to Perl equivalents
   * @private
   */
  _mapOperator(operator) {
    const operatorMap = {
      '===': 'eq',
      '!==': 'ne',
      '&&': '&&',
      '||': '||',
      '!': '!'
    };
    return operatorMap[operator] || operator;
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
   * Wrap generated code with necessary pragmas
   * @private
   */
  _wrapWithPragmas(code, options) {
    let pragmas = '#!/usr/bin/perl\n';
    
    if (options.useStrict) {
      pragmas += 'use strict;\n';
    }
    
    if (options.useWarnings) {
      pragmas += 'use warnings;\n';
    }
    
    pragmas += 'use v5.30;\n'; // Modern Perl features
    
    return pragmas + '\n' + code;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = ['strict', 'warnings'];
    
    // Check if we need Moo for classes
    if (this._hasClasses(ast)) {
      dependencies.push('Moo');
    }
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // Check for features that might need attention
    if (this._hasComplexExpressions(ast)) {
      warnings.push('Complex expressions may need manual review for Perl idioms');
    }
    
    return warnings;
  }

  /**
   * Check if AST contains class declarations
   * @private
   */
  _hasClasses(ast) {
    return JSON.stringify(ast).includes('"type":"ClassDeclaration"');
  }

  /**
   * Check if AST contains complex expressions
   * @private
   */
  _hasComplexExpressions(ast) {
    return false; // Could be enhanced with more sophisticated checking
  }
}

// Register the plugin
const perlPlugin = new PerlPlugin();
LanguagePlugins.Add(perlPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = perlPlugin;
}


})(); // End of IIFE