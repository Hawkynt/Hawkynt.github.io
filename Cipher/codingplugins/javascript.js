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
      case 'EmptyStatement':
        return this._generateEmptyStatement(node, options);
      case 'UnaryExpression':
        return this._generateUnaryExpression(node, options);
      case 'UpdateExpression':
        return this._generateUpdateExpression(node, options);
      case 'IfStatement':
        return this._generateIfStatement(node, options);
      case 'ForStatement':
        return this._generateForStatement(node, options);
      case 'WhileStatement':
        return this._generateWhileStatement(node, options);
      case 'SwitchStatement':
        return this._generateSwitchStatement(node, options);
      case 'ArrayExpression':
        return this._generateArrayExpression(node, options);
      case 'ObjectExpression':
        return this._generateObjectExpression(node, options);
      case 'FunctionExpression':
        return this._generateFunctionExpression(node, options);
      case 'ArrowFunctionExpression':
        return this._generateArrowFunctionExpression(node, options);
      default:
        // Better fallback: try to extract basic structure
        if (node.body && Array.isArray(node.body)) {
          return this._generateProgram(node, options);
        }
        return `/* Unimplemented AST node: ${node.type} */`;
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
      // Empty body is valid in JavaScript (constructors and methods)
      code += bodyCode;
    } else {
      // No body - empty is valid
      code += '';
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
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle member expressions with method calls
    if (node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const propertyName = node.callee.property.name || node.callee.property;

      // Handle OpCodes method calls
      if (object === 'OpCodes') {
        return this._generateOpCodesCall(propertyName, args);
      }
    }

    const callee = this._generateNode(node.callee, options);
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
   * Generate empty statement
   * @private
   */
  _generateEmptyStatement(node, options) {
    return this._indent(';\n');
  }

  /**
   * Generate unary expression
   * @private
   */
  _generateUnaryExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    // Operators like typeof, void, delete need space
    const needsSpace = ['typeof', 'void', 'delete'].includes(operator);

    if (node.prefix) {
      return needsSpace ? `${operator} ${argument}` : `${operator}${argument}`;
    } else {
      // Postfix (rare, usually handled by UpdateExpression)
      return `${argument}${operator}`;
    }
  }

  /**
   * Generate update expression (++/--)
   * @private
   */
  _generateUpdateExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    if (node.prefix) {
      return `${operator}${argument}`;
    } else {
      return `${argument}${operator}`;
    }
  }

  /**
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    let code = '';

    code += this._indent('if (');
    code += this._generateNode(node.test, options);
    code += ') ';

    // Handle consequent (if branch)
    if (node.consequent.type === 'BlockStatement') {
      code += '{\n';
      this.indentLevel++;
      code += this._generateNode(node.consequent, options);
      this.indentLevel--;
      code += this._indent('}');
    } else {
      code += '\n';
      this.indentLevel++;
      code += this._generateNode(node.consequent, options);
      this.indentLevel--;
    }

    // Handle alternate (else branch)
    if (node.alternate) {
      code += ' else ';

      if (node.alternate.type === 'IfStatement') {
        // else if
        code += this._generateNode(node.alternate, options).trim();
      } else if (node.alternate.type === 'BlockStatement') {
        code += '{\n';
        this.indentLevel++;
        code += this._generateNode(node.alternate, options);
        this.indentLevel--;
        code += this._indent('}');
      } else {
        code += '\n';
        this.indentLevel++;
        code += this._generateNode(node.alternate, options);
        this.indentLevel--;
      }
    }

    code += '\n';
    return code;
  }

  /**
   * Generate for statement
   * @private
   */
  _generateForStatement(node, options) {
    let code = this._indent('for (');

    // Init
    if (node.init) {
      const initCode = this._generateNode(node.init, options);
      code += initCode.trim().replace(/;\s*$/, '');
    }
    code += '; ';

    // Test
    if (node.test) {
      code += this._generateNode(node.test, options);
    }
    code += '; ';

    // Update
    if (node.update) {
      code += this._generateNode(node.update, options);
    }

    code += ') ';

    // Body
    if (node.body.type === 'BlockStatement') {
      code += '{\n';
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
      code += this._indent('}\n');
    } else {
      code += '\n';
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
    }

    return code;
  }

  /**
   * Generate while statement
   * @private
   */
  _generateWhileStatement(node, options) {
    let code = this._indent('while (');
    code += this._generateNode(node.test, options);
    code += ') ';

    // Body
    if (node.body.type === 'BlockStatement') {
      code += '{\n';
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
      code += this._indent('}\n');
    } else {
      code += '\n';
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
    }

    return code;
  }

  /**
   * Generate switch statement
   * @private
   */
  _generateSwitchStatement(node, options) {
    let code = this._indent('switch (');
    code += this._generateNode(node.discriminant, options);
    code += ') {\n';

    this.indentLevel++;

    // Generate cases
    if (node.cases && node.cases.length > 0) {
      node.cases.forEach(caseNode => {
        if (caseNode.test) {
          // Regular case
          code += this._indent(`case ${this._generateNode(caseNode.test, options)}:\n`);
        } else {
          // Default case
          code += this._indent('default:\n');
        }

        // Case body
        this.indentLevel++;
        if (caseNode.consequent && caseNode.consequent.length > 0) {
          caseNode.consequent.forEach(stmt => {
            code += this._generateNode(stmt, options);
          });
        }
        this.indentLevel--;
      });
    }

    this.indentLevel--;
    code += this._indent('}\n');

    return code;
  }

  /**
   * Generate array expression
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '[]';
    }

    const elements = node.elements.map(elem => {
      if (elem === null) {
        return ''; // Sparse array
      }
      return this._generateNode(elem, options);
    });

    // Simple inline for short arrays
    if (elements.length <= 5 && elements.every(e => e.length < 20)) {
      return `[${elements.join(', ')}]`;
    }

    // Multi-line for longer arrays
    let code = '[\n';
    this.indentLevel++;
    elements.forEach((elem, idx) => {
      code += this._indent(elem);
      if (idx < elements.length - 1) {
        code += ',';
      }
      code += '\n';
    });
    this.indentLevel--;
    code += this._indent(']');

    return code;
  }

  /**
   * Generate object expression
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '{}';
    }

    // Simple inline for small objects
    if (node.properties.length === 1) {
      const prop = node.properties[0];
      const key = prop.key.name || this._generateNode(prop.key, options);
      const value = this._generateNode(prop.value, options);
      return `{ ${key}: ${value} }`;
    }

    // Multi-line for larger objects
    let code = '{\n';
    this.indentLevel++;

    node.properties.forEach((prop, idx) => {
      let key;
      if (prop.computed) {
        key = `[${this._generateNode(prop.key, options)}]`;
      } else if (prop.key.type === 'Identifier') {
        key = prop.key.name;
      } else {
        key = this._generateNode(prop.key, options);
      }

      const value = this._generateNode(prop.value, options);
      code += this._indent(`${key}: ${value}`);

      if (idx < node.properties.length - 1) {
        code += ',';
      }
      code += '\n';
    });

    this.indentLevel--;
    code += this._indent('}');

    return code;
  }

  /**
   * Generate function expression
   * @private
   */
  _generateFunctionExpression(node, options) {
    let code = 'function';

    // Named function expression
    if (node.id) {
      code += ` ${node.id.name}`;
    }

    code += '(';

    // Parameters
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => param.name || 'param');
      code += params.join(', ');
    }

    code += ') {\n';

    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      // Empty body is valid in JavaScript
      code += bodyCode;
    } else {
      // No body - empty is valid
      code += '';
    }
    this.indentLevel--;

    code += this._indent('}');

    return code;
  }

  /**
   * Generate arrow function expression
   * @private
   */
  _generateArrowFunctionExpression(node, options) {
    let code = '(';

    // Parameters
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => param.name || 'param');
      code += params.join(', ');
    }

    code += ') => ';

    // Body
    if (node.body.type === 'BlockStatement') {
      code += '{\n';
      this.indentLevel++;
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("throw new Error('Not implemented');\n");
      this.indentLevel--;
      code += this._indent('}');
    } else {
      // Expression body (implicit return)
      code += this._generateNode(node.body, options);
    }

    return code;
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

  /**
   * Check if Node.js is available on the system
   * @private
   */
  _isNodeAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('node --version', { 
        stdio: 'pipe', 
        timeout: 1000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Basic syntax validation using bracket/parentheses matching
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      const stack = [];
      const pairs = { '(': ')', '[': ']', '{': '}' };
      const opening = Object.keys(pairs);
      const closing = Object.values(pairs);
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        
        // Skip string literals
        if (char === '"' || char === "'" || char === '`') {
          const quote = char;
          i++; // Skip opening quote
          while (i < code.length && code[i] !== quote) {
            if (code[i] === '\\') i++; // Skip escaped characters
            i++;
          }
          continue;
        }
        
        if (opening.includes(char)) {
          stack.push(char);
        } else if (closing.includes(char)) {
          if (stack.length === 0) return false;
          const lastOpening = stack.pop();
          if (pairs[lastOpening] !== char) return false;
        }
      }
      
      return stack.length === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate JavaScript code syntax using Node.js
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Node.js is available first
    const nodeAvailable = this._isNodeAvailable();
    if (!nodeAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Node.js not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_js_${Date.now()}.js`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to parse the JavaScript code
        execSync(`node --check "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 2000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: 'node',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'node',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Node.js is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Node.js not available - using basic validation'
      };
    }
  }

  /**
   * Get Node.js runtime download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Node.js',
      downloadUrl: 'https://nodejs.org/en/download/',
      installInstructions: [
        'Download Node.js from https://nodejs.org/en/download/',
        'Run the installer for your operating system',
        'Verify installation with: node --version',
        'JavaScript can also run in any web browser'
      ].join('\n'),
      verifyCommand: 'node --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'npm',
      documentation: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript'
    };
  }

  /**
   * Generate OpCodes method call - JavaScript keeps OpCodes as-is
   * since it's the source language
   * @private
   */
  _generateOpCodesCall(methodName, args) {
    // JavaScript is the source language, so OpCodes calls stay the same
    // Just ensure proper formatting
    return `OpCodes.${methodName}(${args})`;
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