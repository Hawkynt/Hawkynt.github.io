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
      case 'ArrayExpression':
        return this._generateArrayExpression(node, options);
      case 'ObjectExpression':
        return this._generateObjectExpression(node, options);
      case 'Property':
        return this._generateProperty(node, options);
      case 'FunctionExpression':
        return this._generateFunctionExpression(node, options);
      case 'ArrowFunctionExpression':
        return this._generateArrowFunctionExpression(node, options);
      case 'NewExpression':
        return this._generateNewExpression(node, options);
      case 'UnaryExpression':
        return this._generateUnaryExpression(node, options);
      case 'UpdateExpression':
        return this._generateUpdateExpression(node, options);
      case 'LogicalExpression':
        return this._generateLogicalExpression(node, options);
      case 'ConditionalExpression':
        return this._generateConditionalExpression(node, options);
      case 'SequenceExpression':
        return this._generateSequenceExpression(node, options);
      case 'TemplateLiteral':
        return this._generateTemplateLiteral(node, options);
      case 'TaggedTemplateExpression':
        return this._generateTaggedTemplateExpression(node, options);
      case 'RestElement':
        return this._generateRestElement(node, options);
      case 'SpreadElement':
        return this._generateSpreadElement(node, options);
      case 'AssignmentPattern':
        return this._generateAssignmentPattern(node, options);
      case 'ObjectPattern':
        return this._generateObjectPattern(node, options);
      case 'ArrayPattern':
        return this._generateArrayPattern(node, options);
      case 'VariableDeclarator':
        return this._generateVariableDeclarator(node, options);
      case 'IfStatement':
        return this._generateIfStatement(node, options);
      case 'WhileStatement':
        return this._generateWhileStatement(node, options);
      case 'ForStatement':
        return this._generateForStatement(node, options);
      case 'ForInStatement':
        return this._generateForInStatement(node, options);
      case 'ForOfStatement':
        return this._generateForOfStatement(node, options);
      case 'DoWhileStatement':
        return this._generateDoWhileStatement(node, options);
      case 'SwitchStatement':
        return this._generateSwitchStatement(node, options);
      case 'SwitchCase':
        return this._generateSwitchCase(node, options);
      case 'BreakStatement':
        return this._generateBreakStatement(node, options);
      case 'ContinueStatement':
        return this._generateContinueStatement(node, options);
      case 'TryStatement':
        return this._generateTryStatement(node, options);
      case 'CatchClause':
        return this._generateCatchClause(node, options);
      case 'ThrowStatement':
        return this._generateThrowStatement(node, options);
      case 'EmptyStatement':
        return this._generateEmptyStatement(node, options);
      case 'DebuggerStatement':
        return this._generateDebuggerStatement(node, options);
      case 'WithStatement':
        return this._generateWithStatement(node, options);
      case 'LabeledStatement':
        return this._generateLabeledStatement(node, options);
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
   * Generate binary expression with TypeScript cryptographic patterns
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    // Handle cryptographic-specific bitwise operations before mapping
    if (node.operator === '>>>') {
      // Unsigned right shift - TypeScript supports this natively
      return `(${left} >>> ${right})`;
    }
    if (node.operator === '<<') {
      // Left shift with overflow protection for 32-bit
      return `((${left} << ${right}) >>> 0)`;
    }
    if (node.operator === '^') {
      // XOR - common in crypto
      return `(${left} ^ ${right})`;
    }
    if (node.operator === '&') {
      // Bitwise AND
      return `(${left} & ${right})`;
    }
    if (node.operator === '|') {
      // Bitwise OR
      return `(${left} | ${right})`;
    }

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
   * Generate array expression
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return options.useTypeScript ? '[] as any[]' : '[]';
    }

    const elements = node.elements
      .map(element => element ? this._generateNode(element, options) : 'undefined')
      .join(', ');

    return options.useTypeScript ? `[${elements}] as any[]` : `[${elements}]`;
  }

  /**
   * Generate object expression
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return options.useTypeScript ? '{} as Record<string, any>' : '{}';
    }

    const properties = node.properties.map(prop => this._generateNode(prop, options));
    return `{ ${properties.join(', ')} }`;
  }

  /**
   * Generate property
   * @private
   */
  _generateProperty(node, options) {
    const key = node.computed ?
      `[${this._generateNode(node.key, options)}]` :
      this._generateNode(node.key, options);
    const value = this._generateNode(node.value, options);

    return `${key}: ${value}`;
  }

  /**
   * Generate function expression
   * @private
   */
  _generateFunctionExpression(node, options) {
    const name = node.id ? node.id.name : '';
    const params = this._generateParameters(node.params, options);
    const returnType = options.useTypeScript ? ': any' : '';

    let code = `function ${name}(${params})${returnType} {\n`;
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty function body\n');
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
    const params = this._generateParameters(node.params, options);
    const returnType = options.useTypeScript ? ': any' : '';

    if (node.body.type === 'BlockStatement') {
      let code = `(${params})${returnType} => {\n`;
      this.indentLevel++;
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty arrow function body\n');
      this.indentLevel--;
      code += this._indent('}');
      return code;
    } else {
      const body = this._generateNode(node.body, options);
      return `(${params})${returnType} => ${body}`;
    }
  }

  /**
   * Generate new expression
   * @private
   */
  _generateNewExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    return `new ${callee}(${args})`;
  }

  /**
   * Generate unary expression
   * @private
   */
  _generateUnaryExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    switch (operator) {
      case 'typeof':
        return `typeof ${argument}`;
      case 'delete':
        return `delete ${argument}`;
      case 'void':
        return `void ${argument}`;
      default:
        return `${operator}${argument}`;
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
   * Generate logical expression
   * @private
   */
  _generateLogicalExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = node.operator;

    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate conditional expression (ternary)
   * @private
   */
  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);

    return `${test} ? ${consequent} : ${alternate}`;
  }

  /**
   * Generate sequence expression
   * @private
   */
  _generateSequenceExpression(node, options) {
    if (!node.expressions || node.expressions.length === 0) {
      return '';
    }

    const expressions = node.expressions.map(expr => this._generateNode(expr, options));
    return `(${expressions.join(', ')})`;
  }

  /**
   * Generate template literal
   * @private
   */
  _generateTemplateLiteral(node, options) {
    if (!node.quasis || node.quasis.length === 0) {
      return '``';
    }

    let result = '`';
    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      result += quasi.value ? quasi.value.raw || quasi.value.cooked || '' : '';

      if (i < node.expressions.length) {
        const expr = this._generateNode(node.expressions[i], options);
        result += '${' + expr + '}';
      }
    }
    result += '`';
    return result;
  }

  /**
   * Generate tagged template expression
   * @private
   */
  _generateTaggedTemplateExpression(node, options) {
    const tag = this._generateNode(node.tag, options);
    const quasi = this._generateNode(node.quasi, options);
    return `${tag}${quasi}`;
  }

  /**
   * Generate rest element
   * @private
   */
  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    const type = options.useTypeScript ? ': any[]' : '';
    return `...${argument}${type}`;
  }

  /**
   * Generate spread element
   * @private
   */
  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `...${argument}`;
  }

  /**
   * Generate assignment pattern (default parameters)
   * @private
   */
  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return `${left} = ${right}`;
  }

  /**
   * Generate object pattern (destructuring)
   * @private
   */
  _generateObjectPattern(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '{}';
    }

    const properties = node.properties.map(prop => this._generateNode(prop, options));
    return `{ ${properties.join(', ')} }`;
  }

  /**
   * Generate array pattern (destructuring)
   * @private
   */
  _generateArrayPattern(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '[]';
    }

    const elements = node.elements.map(elem =>
      elem ? this._generateNode(elem, options) : ''
    );
    return `[${elements.join(', ')}]`;
  }

  /**
   * Generate variable declarator
   * @private
   */
  _generateVariableDeclarator(node, options) {
    const id = node.id ? this._generateNode(node.id, options) : 'variable';
    const type = options.useTypeScript ? ': any' : '';

    if (node.init) {
      const init = this._generateNode(node.init, options);
      return `${id}${type} = ${init}`;
    } else {
      return `${id}${type}`;
    }
  }

  /**
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    const test = this._generateNode(node.test, options);
    let code = this._indent(`if (${test}) {\n`);

    this.indentLevel++;
    if (node.consequent) {
      const consequent = this._generateNode(node.consequent, options);
      code += consequent || this._indent('// Empty if body\n');
    }
    this.indentLevel--;

    code += this._indent('}\n');

    if (node.alternate) {
      if (node.alternate.type === 'IfStatement') {
        code += this._indent('else ');
        code += this._generateIfStatement(node.alternate, options).replace(/^\s+/, '');
      } else {
        code += this._indent('else {\n');
        this.indentLevel++;
        const alternate = this._generateNode(node.alternate, options);
        code += alternate || this._indent('// Empty else body\n');
        this.indentLevel--;
        code += this._indent('}\n');
      }
    }

    return code;
  }

  /**
   * Generate while statement
   * @private
   */
  _generateWhileStatement(node, options) {
    const test = this._generateNode(node.test, options);
    let code = this._indent(`while (${test}) {\n`);

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty while body\n');
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for statement
   * @private
   */
  _generateForStatement(node, options) {
    const init = node.init ? this._generateNode(node.init, options).replace(/;\n$/, '') : '';
    const test = node.test ? this._generateNode(node.test, options) : '';
    const update = node.update ? this._generateNode(node.update, options) : '';

    let code = this._indent(`for (${init}; ${test}; ${update}) {\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty for body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for-in statement
   * @private
   */
  _generateForInStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent(`for (${left} in ${right}) {\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty for-in body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for-of statement
   * @private
   */
  _generateForOfStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent(`for (${left} of ${right}) {\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty for-of body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate do-while statement
   * @private
   */
  _generateDoWhileStatement(node, options) {
    let code = this._indent('do {\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty do body\n');
    }

    this.indentLevel--;
    const test = this._generateNode(node.test, options);
    code += this._indent(`} while (${test});\n`);
    return code;
  }

  /**
   * Generate switch statement
   * @private
   */
  _generateSwitchStatement(node, options) {
    const discriminant = this._generateNode(node.discriminant, options);
    let code = this._indent(`switch (${discriminant}) {\n`);

    this.indentLevel++;
    if (node.cases) {
      for (const caseNode of node.cases) {
        code += this._generateNode(caseNode, options);
      }
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate switch case
   * @private
   */
  _generateSwitchCase(node, options) {
    let code = '';

    if (node.test) {
      const test = this._generateNode(node.test, options);
      code += this._indent(`case ${test}:\n`);
    } else {
      code += this._indent('default:\n');
    }

    this.indentLevel++;
    if (node.consequent) {
      for (const stmt of node.consequent) {
        code += this._generateNode(stmt, options);
      }
    }
    this.indentLevel--;

    return code;
  }

  /**
   * Generate break statement
   * @private
   */
  _generateBreakStatement(node, options) {
    return this._indent('break;\n');
  }

  /**
   * Generate continue statement
   * @private
   */
  _generateContinueStatement(node, options) {
    return this._indent('continue;\n');
  }

  /**
   * Generate try statement
   * @private
   */
  _generateTryStatement(node, options) {
    let code = this._indent('try {\n');
    this.indentLevel++;

    if (node.block) {
      const block = this._generateNode(node.block, options);
      code += block || this._indent('// Empty try block\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');

    if (node.handler) {
      code += this._generateNode(node.handler, options);
    }

    if (node.finalizer) {
      code += this._indent('finally {\n');
      this.indentLevel++;
      const finalizer = this._generateNode(node.finalizer, options);
      code += finalizer || this._indent('// Empty finally block\n');
      this.indentLevel--;
      code += this._indent('}\n');
    }

    return code;
  }

  /**
   * Generate catch clause
   * @private
   */
  _generateCatchClause(node, options) {
    let code = this._indent('catch');

    if (node.param) {
      const param = this._generateNode(node.param, options);
      const type = options.useTypeScript ? ': any' : '';
      code += ` (${param}${type})`;
    }

    code += ' {\n';
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty catch block\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate throw statement
   * @private
   */
  _generateThrowStatement(node, options) {
    if (node.argument) {
      const argument = this._generateNode(node.argument, options);
      return this._indent(`throw ${argument};\n`);
    } else {
      return this._indent('throw new Error();\n');
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
   * Generate debugger statement
   * @private
   */
  _generateDebuggerStatement(node, options) {
    return this._indent('debugger;\n');
  }

  /**
   * Generate with statement
   * @private
   */
  _generateWithStatement(node, options) {
    const object = this._generateNode(node.object, options);
    let code = this._indent(`with (${object}) {\n`);

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty with body\n');
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate labeled statement
   * @private
   */
  _generateLabeledStatement(node, options) {
    const label = node.label ? this._generateNode(node.label, options) : 'label';
    const body = node.body ? this._generateNode(node.body, options) : '';

    return this._indent(`${label}:\n`) + body;
  }

  /**
   * Generate parameters with TypeScript type annotations
   * @private
   */
  _generateParameters(params, options) {
    if (!params || params.length === 0) {
      return '';
    }

    return params.map(param => {
      const name = this._generateNode(param, options);
      const type = options.useTypeScript ? ': any' : '';
      return `${name}${type}`;
    }).join(', ');
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

  /**
   * Check if TypeScript compiler is available on the system
   * @private
   */
  _isTypescriptAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('tsc --version', { 
        stdio: 'pipe', 
        timeout: 1000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      // Try npx tsc as fallback
      try {
        execSync('npx tsc --version', { 
          stdio: 'pipe', 
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        return 'npx';
      } catch (error2) {
        return false;
      }
    }
  }

  /**
   * Basic syntax validation using bracket/parentheses matching
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      const stack = [];
      const pairs = { '(': ')', '[': ']', '{': '}', '<': '>' };
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
        
        // Skip single-line comments
        if (char === '/' && i + 1 < code.length && code[i + 1] === '/') {
          while (i < code.length && code[i] !== '\n') i++;
          continue;
        }
        
        // Skip multi-line comments
        if (char === '/' && i + 1 < code.length && code[i + 1] === '*') {
          i += 2;
          while (i < code.length - 1) {
            if (code[i] === '*' && code[i + 1] === '/') {
              i += 2;
              break;
            }
            i++;
          }
          continue;
        }
        
        if (opening.includes(char)) {
          // Special handling for < in TypeScript - only count as opening if it looks like a generic
          if (char === '<') {
            // Simple heuristic: check if this could be a generic type parameter
            const nextChars = code.slice(i + 1, i + 10);
            if (!/^[A-Za-z_]/.test(nextChars)) continue;
          }
          stack.push(char);
        } else if (closing.includes(char)) {
          if (char === '>') {
            // Only match > with < if we have an unmatched <
            if (stack.length === 0 || stack[stack.length - 1] !== '<') continue;
          }
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
   * Validate TypeScript code syntax using tsc
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if TypeScript compiler is available first
    const tscAvailable = this._isTypescriptAvailable();
    if (!tscAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'TypeScript compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const tscCommand = tscAvailable === 'npx' ? 'npx tsc' : 'tsc';
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_ts_${Date.now()}.ts`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the TypeScript code (no emit, just check)
        execSync(`${tscCommand} --noEmit --skipLibCheck "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: 'tsc',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'tsc',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If TypeScript compiler is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'TypeScript compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get TypeScript compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'TypeScript Compiler',
      downloadUrl: 'https://www.typescriptlang.org/download',
      installInstructions: [
        'Install TypeScript globally: npm install -g typescript',
        'Or use npx: npx typescript',
        'Or install Node.js first from https://nodejs.org/en/download/',
        'Verify installation with: tsc --version'
      ].join('\n'),
      verifyCommand: 'tsc --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses with TypeScript generics)',
      packageManager: 'npm',
      documentation: 'https://www.typescriptlang.org/docs/'
    };
  }

  /**
   * Generate OpCodes method call with TypeScript types
   * @private
   */
  _generateOpCodesCall(methodName, args) {
    // Map OpCodes methods to TypeScript equivalents with proper typing
    switch (methodName) {
      case 'Pack32LE':
        return `OpCodes.pack32LE(${args})`;
      case 'Pack32BE':
        return `OpCodes.pack32BE(${args})`;
      case 'Unpack32LE':
        return `OpCodes.unpack32LE(${args})`;
      case 'Unpack32BE':
        return `OpCodes.unpack32BE(${args})`;
      case 'RotL32':
        return `OpCodes.rotL32(${args})`;
      case 'RotR32':
        return `OpCodes.rotR32(${args})`;
      case 'XorArrays':
        return `OpCodes.xorArrays(${args})`;
      case 'ClearArray':
        return `OpCodes.clearArray(${args})`;
      case 'Hex8ToBytes':
        return `OpCodes.hexToBytes(${args})`;
      case 'BytesToHex8':
        return `OpCodes.bytesToHex(${args})`;
      default:
        return `OpCodes.${methodName}(${args})`;
    }
  }

  /**
   * Generate Array constructor call with TypeScript types
   * @private
   */
  _generateArrayConstructorCall(args) {
    if (!args) {
      return 'new Array<number>()';
    }
    // Handle new Array(size) pattern
    if (!args.includes(',')) {
      return `new Array<number>(${args}).fill(0)`;
    }
    // Handle new Array(element1, element2, ...) pattern
    return `[${args}] as number[]`;
  }

  /**
   * Check if a value is likely a byte value for crypto contexts
   * @private
   */
  _isLikelyByteValue(node) {
    if (node.type === 'Literal' && typeof node.value === 'number') {
      return node.value >= 0 && node.value <= 255;
    }
    return false;
  }

  /**
   * Infer TypeScript type from JavaScript AST value with crypto context
   * @private
   */
  _inferTypeScriptType(node, context = {}) {
    if (!node) return 'unknown';

    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') return 'string';
        if (typeof node.value === 'number') {
          return Number.isInteger(node.value) ? 'number' : 'number';
        }
        if (typeof node.value === 'boolean') return 'boolean';
        if (node.value === null) return 'null';
        break;
      case 'ArrayExpression':
        if (node.elements && node.elements.length > 0) {
          const firstElement = node.elements.find(el => el !== null);
          if (firstElement && this._isLikelyByteValue(firstElement)) {
            return 'Uint8Array';
          }
        }
        return 'number[]';
      case 'ObjectExpression':
        return 'Record<string, unknown>';
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return '(...args: any[]) => any';
    }

    return context.isCryptographic ? 'number' : 'unknown';
  }

  /**
   * Generate missing AST node types for modern TypeScript
   * @private
   */
  _generateMetaProperty(node, options) {
    return `// MetaProperty: ${node.meta?.name || 'unknown'}.${node.property?.name || 'unknown'}`;
  }

  _generateAwaitExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `await ${argument}`;
  }

  _generateYieldExpression(node, options) {
    const argument = node.argument ? this._generateNode(node.argument, options) : '';
    return node.delegate ? `yield* ${argument}` : `yield ${argument}`;
  }

  _generateImportDeclaration(node, options) {
    const source = this._generateNode(node.source, options);
    if (node.specifiers && node.specifiers.length > 0) {
      const imports = node.specifiers.map(spec => {
        if (spec.type === 'ImportDefaultSpecifier') {
          return spec.local.name;
        }
        return spec.imported?.name || spec.local.name;
      }).join(', ');
      return this._indent(`import { ${imports} } from ${source};\n`);
    }
    return this._indent(`import ${source};\n`);
  }

  _generateExportDeclaration(node, options) {
    return this._indent(`export ${this._generateNode(node.declaration, options)};\n`);
  }

  _generateClassExpression(node, options) {
    return this._generateClass(node, options);
  }

  _generatePropertyDefinition(node, options) {
    const key = this._generateNode(node.key, options);
    const value = node.value ? this._generateNode(node.value, options) : 'undefined';
    const type = options.strictTypes ? ': any' : '';
    return this._indent(`${key}${type} = ${value};\n`);
  }

  _generatePrivateIdentifier(node, options) {
    return `#${node.name}`; // TypeScript private fields
  }

  _generateStaticBlock(node, options) {
    return this._indent('static {\n') + this._generateNode(node.body, options) + this._indent('}\n');
  }

  _generateChainExpression(node, options) {
    return this._generateNode(node.expression, options);
  }

  _generateImportExpression(node, options) {
    const source = this._generateNode(node.source, options);
    return `import(${source})`;
  }

  _generateTSTypeAnnotation(node, options) {
    return `: ${this._generateNode(node.typeAnnotation, options)}`;
  }

  _generateTSInterfaceDeclaration(node, options) {
    const name = node.id ? node.id.name : 'UnknownInterface';
    let code = this._indent(`interface ${name} {\n`);
    this.indentLevel++;
    if (node.body && node.body.body) {
      for (const member of node.body.body) {
        code += this._generateNode(member, options);
      }
    }
    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateTSTypeAliasDeclaration(node, options) {
    const name = node.id ? node.id.name : 'UnknownType';
    const type = node.typeAnnotation ? this._generateNode(node.typeAnnotation, options) : 'unknown';
    return this._indent(`type ${name} = ${type};\n`);
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