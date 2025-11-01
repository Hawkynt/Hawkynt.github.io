/**
 * Java Language Plugin for Multi-Language Code Generation
 * Generates Java code from JavaScript AST
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
 * Java Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class JavaPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Java';
    this.extension = 'java';
    this.icon = '☕';
    this.description = 'Java language code generator';
    this.mimeType = 'text/x-java';
    this.version = 'Java 17+';
    
    // Java-specific options
    this.options = {
      indent: '    ', // 4 spaces (Java convention)
      lineEnding: '\n',
      addComments: true,
      useStrictTypes: true,
      packageName: 'com.generated',
      className: 'GeneratedClass'
    };
    
    // Internal state
    this.indentLevel = 0;
    this.imports = new Set();
  }

  /**
   * Generate Java code from Abstract Syntax Tree
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
      
      // Generate Java code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add package declaration, imports, and class structure
      const finalCode = this._wrapWithClassStructure(code, mergedOptions);
      
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
      case 'UnaryExpression':
        return this._generateUnaryExpression(node, options);
      case 'UpdateExpression':
        return this._generateUpdateExpression(node, options);
      case 'LogicalExpression':
        return this._generateLogicalExpression(node, options);
      case 'ConditionalExpression':
        return this._generateConditionalExpression(node, options);
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
      case 'Super':
        return 'super';
      case 'MetaProperty':
        return this._generateMetaProperty(node, options);
      case 'AwaitExpression':
        return this._generateAwaitExpression(node, options);
      case 'YieldExpression':
        return this._generateYieldExpression(node, options);
      case 'ImportDeclaration':
        return this._generateImportDeclaration(node, options);
      case 'ExportDefaultDeclaration':
        return this._generateExportDeclaration(node, options);
      case 'ExportNamedDeclaration':
        return this._generateExportDeclaration(node, options);
      case 'ClassExpression':
        return this._generateClassExpression(node, options);
      case 'PropertyDefinition':
        return this._generatePropertyDefinition(node, options);
      case 'PrivateIdentifier':
        return this._generatePrivateIdentifier(node, options);
      case 'StaticBlock':
        return this._generateStaticBlock(node, options);
      case 'ChainExpression':
        return this._generateChainExpression(node, options);
      case 'ImportExpression':
        return this._generateImportExpression(node, options);
      default:
        return this._generateFallbackNode(node, options);
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
   * Generate method (function becomes static method)
   * @private
   */
  _generateMethod(node, options) {
    const methodName = node.id ? this._toCamelCase(node.id.name) : 'unnamedMethod';
    let code = '';
    
    // Javadoc comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * ' + methodName + ' method\n');
      code += this._indent(' * Performs the ' + (node.id ? node.id.name : 'unnamed') + ' operation\n');
      code += this._indent(' *\n');
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent(' * @param ' + paramName + ' input parameter\n');
        });
      }
      code += this._indent(' * @return result of the operation\n');
      code += this._indent(' */\n');
    }
    
    // Method signature
    code += this._indent('public static int ' + methodName + '(');
    
    // Parameters with Java types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return 'int ' + this._toCamelCase(paramName);
      });
      code += params.join(', ');
    }
    
    code += ') {\n';
    
    // Method body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent('throw new UnsupportedOperationException("Not implemented");\n');
    } else {
      code += this._indent('throw new UnsupportedOperationException("Not implemented");\n');
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
    
    // Class Javadoc
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * ' + className + ' class\n');
      code += this._indent(' * Represents a ' + (node.id ? node.id.name : 'unnamed') + ' entity\n');
      code += this._indent(' */\n');
    }
    
    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent('public class ' + className + ' extends ' + superName + ' {\n');
    } else {
      code += this._indent('public class ' + className + ' {\n');
    }
    
    // Class body
    this.indentLevel++;
    
    // Add fields section
    code += this._indent('// Fields\n');
    code += this._indent('// Fields will be added automatically based on usage\n');
    code += this._indent('private byte[] buffer;\n');
    code += this._indent('private int state;\n\n');
    
    // Methods
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
  _generateMethodDef(node, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = this._toCamelCase(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    let code = '';
    
    // Javadoc
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * ' + (isConstructor ? 'Constructor' : methodName + ' method') + '\n');
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent(' * @param ' + paramName + ' input parameter\n');
        });
      }
      if (!isConstructor) {
        code += this._indent(' * @return method result\n');
      }
      code += this._indent(' */\n');
    }
    
    // Method signature
    if (isConstructor) {
      // Constructor - class name should come from context
      code += this._indent('public ' + options.className + '(');
    } else {
      code += this._indent('public int ' + methodName + '(');
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        return 'int ' + this._toCamelCase(paramName);
      });
      code += params.join(', ');
    }
    
    code += ') {\n';
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || (isConstructor ? '' : this._indent('throw new UnsupportedOperationException("Not implemented");\n'));
    } else {
      if (!isConstructor) {
        code += this._indent('throw new UnsupportedOperationException("Not implemented");\n');
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
      return this._indent('throw new RuntimeException("Empty block");\n');
    }
    
    return node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(line => line.trim())
      .join('\n');
  }

  /**
   * Generate variable declaration with modern Java features
   * @private
   */
  _generateVariableDeclaration(node, options) {
    if (!node.declarations) return '';

    return node.declarations
      .map(decl => {
        const originalName = decl.id ? decl.id.name : 'variable';
        const varName = node.kind === 'const' ?
          this._toConstantCase(originalName) :
          this._toCamelCase(originalName);

        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);

          // Enhanced type inference with crypto context
          let type = this._inferJavaType(decl.init, {
            isCryptographic: this._isCryptographicContext(varName),
            isKey: varName.toLowerCase().includes('key'),
            isIV: varName.toLowerCase().includes('iv') || varName.toLowerCase().includes('nonce'),
            isState: varName.toLowerCase().includes('state') || varName.toLowerCase().includes('buffer')
          });

          // Use var for type inference in modern Java when appropriate
          const useVar = options.useModernJava && decl.init &&
                         !['byte[]', 'int[]', 'long[]'].includes(type);

          const finalType = useVar ? 'var' : type;
          const modifier = node.kind === 'const' ? 'final ' : '';

          return this._indent(`${modifier}${finalType} ${varName} = ${initValue};\n`);
        } else {
          const type = this._isCryptographicContext(varName) ? 'int' : 'Object';
          return this._indent(`${type} ${varName};\n`);
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
    let operator = node.operator;
    
    // Java operators
    switch (operator) {
      case '===':
        operator = '=='; // Note: in Java, use .equals() for objects
        break;
      case '!==':
        operator = '!=';
        break;
    }
    
    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate call expression with Java-specific transformations
   * @private
   */
  _generateCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle OpCodes calls
    if (node.callee.type === 'MemberExpression' &&
        node.callee.object.name === 'OpCodes') {
      const methodName = node.callee.property.name;
      return this._generateOpCodesCall(methodName, args);
    }

    // Handle special JavaScript methods
    if (node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const property = node.callee.property.name;

      switch (property) {
        case 'push':
          this.imports.add('java.util.List');
          return `${object}.add(${args})`;
        case 'pop':
          this.imports.add('java.util.List');
          return `${object}.remove(${object}.size() - 1)`;
        case 'shift':
          this.imports.add('java.util.List');
          return `${object}.remove(0)`;
        case 'unshift':
          this.imports.add('java.util.List');
          return `${object}.add(0, ${args})`;
        case 'join':
          return `String.join(${args}, ${object})`;
        case 'split':
          return `${object}.split(${args})`;
        case 'substring':
        case 'substr':
          return `${object}.substring(${args})`;
        case 'indexOf':
          return `${object}.indexOf(${args})`;
        case 'charAt':
          return `${object}.charAt(${args})`;
        case 'charCodeAt':
          return `(int)${object}.charAt(${args})`;
        case 'toUpperCase':
          return `${object}.toUpperCase()`;
        case 'toLowerCase':
          return `${object}.toLowerCase()`;
        case 'replace':
          return `${object}.replace(${args})`;
        case 'slice':
          return `${object}.substring(${args})`;
        case 'toString':
          return `${object}.toString()`;
        case 'length':
          return `${object}.length()`;
        case 'map':
          return this._generateStreamOperation(node.callee.object, 'map', options);
        case 'filter':
          return this._generateStreamOperation(node.callee.object, 'filter', options);
        case 'reduce':
          return this._generateStreamOperation(node.callee.object, 'reduce', options);
        case 'forEach':
          return this._generateStreamOperation(node.callee.object, 'forEach', options);
        default:
          return `${callee}(${args})`;
      }
    }

    // Handle constructor calls
    if (node.callee.type === 'Identifier') {
      switch (node.callee.name) {
        case 'Array':
          if (!args) {
            return 'new ArrayList<>()';
          }
          this.imports.add('java.util.ArrayList');
          this.imports.add('java.util.Arrays');
          return `new ArrayList<>(Arrays.asList(${args}))`;
        case 'Object':
          this.imports.add('java.util.HashMap');
          return 'new HashMap<>()';
        case 'BigInteger':
          this.imports.add('java.math.BigInteger');
          return `new BigInteger(${args})`;
        case 'SecretKey':
          this.imports.add('javax.crypto.spec.SecretKeySpec');
          return `new SecretKeySpec(${args})`;
      }
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
    // Special handling for Java class names that should remain capitalized
    const javaClasses = ['Integer', 'Double', 'Float', 'Long', 'Short', 'Byte', 'Boolean',
                        'String', 'Object', 'Class', 'Math', 'System', 'Arrays', 'List',
                        'Map', 'Set', 'Collection', 'ArrayList', 'HashMap', 'HashSet'];

    if (javaClasses.includes(node.name)) {
      return node.name;
    }

    return this._toCamelCase(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return '"' + node.value.replace(/"/g, '\\"') + '"';
    } else if (node.value === null) {
      return 'null';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    let code = '';
    const test = this._generateNode(node.test, options);

    code += this._indent('if (' + test + ') {\n');
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
    let code = this._indent('while (' + test + ') {\n');
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

    let code = this._indent('for (' + init + '; ' + test + '; ' + update + ') {\n');
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
   * Generate for-in statement (enhanced for loop)
   * @private
   */
  _generateForInStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent('for (Object ' + left.replace(/var\s+/, '') + ' : ' + right + '.keySet()) {\n');
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
   * Generate for-of statement (enhanced for loop)
   * @private
   */
  _generateForOfStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent('for (Object ' + left.replace(/var\s+/, '') + ' : ' + right + ') {\n');
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
    code += this._indent('} while (' + test + ');\n');
    return code;
  }

  /**
   * Generate switch statement
   * @private
   */
  _generateSwitchStatement(node, options) {
    const discriminant = this._generateNode(node.discriminant, options);
    let code = this._indent('switch (' + discriminant + ') {\n');
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
      code += this._indent('case ' + test + ':\n');
    } else {
      code += this._indent('default:\n');
    }

    this.indentLevel++;
    if (node.consequent) {
      for (const stmt of node.consequent) {
        code += this._generateNode(stmt, options);
      }
    }

    // Add break if not already present
    if (!code.includes('break;') && !code.includes('return;')) {
      code += this._indent('break;\n');
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
      code += ' (Exception ' + param + ')';
    } else {
      code += ' (Exception e)';
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
      return this._indent('throw ' + argument + ';\n');
    } else {
      return this._indent('throw new RuntimeException();\n');
    }
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
        return argument + '.getClass().getSimpleName()';
      case 'delete':
        return '/* delete not supported in Java */ ' + argument;
      case 'void':
        return '/* void */ ' + argument;
      case '!':
        return '!' + argument;
      default:
        return operator + argument;
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
      return operator + argument;
    } else {
      return argument + operator;
    }
  }

  /**
   * Generate logical expression
   * @private
   */
  _generateLogicalExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    let operator = node.operator;

    switch (operator) {
      case '||':
        operator = '||';
        break;
      case '&&':
        operator = '&&';
        break;
      case '??':
        // Java doesn't have null-coalescing operator
        return '(' + left + ' != null ? ' + left + ' : ' + right + ')';
    }

    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate conditional expression (ternary operator)
   * @private
   */
  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);

    return test + ' ? ' + consequent + ' : ' + alternate;
  }

  /**
   * Generate array expression with proper Java generics
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return 'new int[0]';
    }

    // Determine array type based on elements
    const firstElement = node.elements.find(el => el !== null);
    const elementType = this._inferJavaType(firstElement, { isCryptographic: true });

    const elements = node.elements
      .map(element => element ? this._generateNode(element, options) : 'null')
      .join(', ');

    // Generate typed array based on element type
    if (elementType === 'byte' || this._isLikelyByteValue(firstElement)) {
      return `new byte[] { ${elements} }`;
    } else if (elementType === 'int') {
      return `new int[] { ${elements} }`;
    } else if (elementType === 'long') {
      return `new long[] { ${elements} }`;
    } else if (elementType === 'String') {
      return `new String[] { ${elements} }`;
    }

    return `new ${elementType}[] { ${elements} }`;
  }

  /**
   * Generate object expression
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return 'new HashMap<String, Object>()';
    }

    let code = 'new HashMap<String, Object>() {{\n';
    this.indentLevel++;

    const properties = node.properties.map(prop => {
      const key = prop.key ? this._generateNode(prop.key, options) : '"unknown"';
      const value = prop.value ? this._generateNode(prop.value, options) : 'null';
      return this._indent('put(' + key + ', ' + value + ');');
    });

    code += properties.join('\n') + '\n';
    this.indentLevel--;
    code += this._indent('}}');

    return code;
  }

  /**
   * Generate property
   * @private
   */
  _generateProperty(node, options) {
    const key = node.key ? this._generateNode(node.key, options) : '"unknown"';
    const value = node.value ? this._generateNode(node.value, options) : 'null';
    return 'put(' + key + ', ' + value + ')';
  }

  /**
   * Generate function expression
   * @private
   */
  _generateFunctionExpression(node, options) {
    const params = node.params ?
      node.params.map(param => 'Object ' + this._toCamelCase(param.name || 'param')).join(', ') : '';

    let code = '/* function expression */ new Function<Object>() {\n';
    this.indentLevel++;
    code += this._indent('public Object apply(' + params + ') {\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('return null;\n');
    } else {
      code += this._indent('return null;\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    this.indentLevel--;
    code += this._indent('}');
    return code;
  }

  /**
   * Generate arrow function expression
   * @private
   */
  _generateArrowFunctionExpression(node, options) {
    const params = node.params ?
      node.params.map(param => this._toCamelCase(param.name || 'param')).join(', ') : '';

    if (node.body.type === 'BlockStatement') {
      let code = '(' + params + ') -> {\n';
      this.indentLevel++;
      const body = this._generateNode(node.body, options);
      code += body || this._indent('return null;\n');
      this.indentLevel--;
      code += this._indent('}');
      return code;
    } else {
      const body = this._generateNode(node.body, options);
      return '(' + params + ') -> ' + body;
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

    return 'new ' + this._toPascalCase(callee) + '(' + args + ')';
  }

  /**
   * Generate sequence expression
   * @private
   */
  _generateSequenceExpression(node, options) {
    if (!node.expressions || node.expressions.length === 0) {
      return '';
    }

    // Java doesn't have comma operators like JavaScript
    const expressions = node.expressions.map(expr => this._generateNode(expr, options));
    return '/* sequence: */ (' + expressions.join(', ') + ')';
  }

  /**
   * Generate template literal
   * @private
   */
  _generateTemplateLiteral(node, options) {
    if (!node.quasis || node.quasis.length === 0) {
      return '""';
    }

    let result = 'String.format("';
    const args = [];

    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      result += quasi.value ? quasi.value.raw || quasi.value.cooked || '' : '';

      if (i < node.expressions.length) {
        result += '%s';
        const expr = this._generateNode(node.expressions[i], options);
        args.push(expr);
      }
    }
    result += '"';

    if (args.length > 0) {
      result += ', ' + args.join(', ');
    }
    result += ')';
    return result;
  }

  /**
   * Generate tagged template expression
   * @private
   */
  _generateTaggedTemplateExpression(node, options) {
    const tag = this._generateNode(node.tag, options);
    const quasi = this._generateNode(node.quasi, options);
    return tag + '(' + quasi + ')';
  }

  /**
   * Generate rest element
   * @private
   */
  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return '/* ...rest */ Object... ' + argument;
  }

  /**
   * Generate spread element
   * @private
   */
  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return '/* ...spread */ ' + argument;
  }

  /**
   * Generate assignment pattern
   * @private
   */
  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return left + ' = ' + right;
  }

  /**
   * Generate object pattern
   * @private
   */
  _generateObjectPattern(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '/* empty object pattern */';
    }

    const properties = node.properties.map(prop => this._generateNode(prop, options));
    return '/* object destructuring: */ { ' + properties.join(', ') + ' }';
  }

  /**
   * Generate array pattern
   * @private
   */
  _generateArrayPattern(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '/* empty array pattern */';
    }

    const elements = node.elements.map(elem => elem ? this._generateNode(elem, options) : 'null');
    return '/* array destructuring: */ [' + elements.join(', ') + ']';
  }

  /**
   * Generate variable declarator
   * @private
   */
  _generateVariableDeclarator(node, options) {
    const id = node.id ? this._generateNode(node.id, options) : 'variable';

    if (node.init) {
      const init = this._generateNode(node.init, options);
      return id + ' = ' + init;
    } else {
      return id;
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
    return this._indent('// Debugger statement (Java equivalent: set breakpoint here)\n');
  }

  /**
   * Generate with statement
   * @private
   */
  _generateWithStatement(node, options) {
    const object = this._generateNode(node.object, options);
    let code = this._indent('try (var resource = ' + object + ') {\n');
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

    return this._indent(label + ':\n') + body;
  }

  /**
   * Convert to camelCase (Java variable/method naming)
   * @private
   */
  _toCamelCase(str) {
    if (!str) return str;
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * Convert to CONSTANT_CASE (Java constant naming)
   * @private
   */
  _toConstantCase(str) {
    if (!str) return str;
    // Convert camelCase to CONSTANT_CASE
    return str.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
  }

  /**
   * Convert to PascalCase (Java class naming)
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
   * Wrap generated code with class structure
   * @private
   */
  _wrapWithClassStructure(code, options) {
    let result = '';

    // Package declaration
    result += 'package ' + options.packageName + ';\n\n';

    // Imports
    if (this.imports.size > 0) {
      for (const imp of this.imports) {
        result += 'import ' + imp + ';\n';
      }
      result += '\n';
    }

    // File header comment
    if (options.addComments) {
      result += '/**\n';
      result += ' * Generated Java code\n';
      result += ' * This file was automatically generated from JavaScript AST\n';
      result += ' * \n';
      result += ' * @author Code Generator\n';
      result += ' * @version 1.0\n';
      result += ' */\n';
    }

    // Class wrapper
    result += 'public class ' + options.className + ' {\n\n';

    // Separate class-level declarations from executable statements
    const { classDeclarations, executableStatements } = this._separateCodeByScope(code);

    // Add class-level declarations (fields, methods)
    if (classDeclarations.trim()) {
      const indentedClassCode = classDeclarations.split('\n').map(line =>
        line.trim() ? '    ' + line : line
      ).join('\n');
      result += indentedClassCode + '\n\n';
    }

    // Add main method with executable statements
    result += '    /**\n';
    result += '     * Main method - contains generated executable code\n';
    result += '     * @param args command line arguments\n';
    result += '     */\n';
    result += '    public static void main(String[] args) {\n';

    if (executableStatements.trim()) {
      // Convert JavaScript patterns to Java
      const javaExecutableCode = this._convertToJavaExecutable(executableStatements);
      const indentedExecCode = javaExecutableCode.split('\n').map(line =>
        line.trim() ? '        ' + line : line
      ).join('\n');
      result += indentedExecCode;

      // Ensure we close any open braces in the main method
      if (!indentedExecCode.trim().endsWith('}')) {
        result += '\n';
      }
    } else {
      result += '        // Generated code execution\n';
      result += '        System.out.println("Generated Java code");\n';
    }

    result += '    }\n\n';

    // Add crypto utility methods if needed
    const cryptoUtilities = this._generateCryptoUtilities(options);
    if (cryptoUtilities) {
      result += cryptoUtilities;
    }

    result += '}\n';

    return result;
  }

  /**
   * Separate code into class-level declarations and executable statements
   * @private
   */
  _separateCodeByScope(code) {
    const lines = code.split('\n');
    const classDeclarations = [];
    const executableStatements = [];
    let insideMethod = false;
    let braceLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
        classDeclarations.push(line);
        continue;
      }

      // Track brace levels
      const openBraces = (trimmedLine.match(/\{/g) || []).length;
      const closeBraces = (trimmedLine.match(/\}/g) || []).length;
      braceLevel += openBraces - closeBraces;

      // Detect start of methods/classes (but not if we're already inside one)
      if (!insideMethod && this._isMethodOrClassDeclaration(trimmedLine)) {
        insideMethod = true;
        classDeclarations.push(line);
        continue;
      }

      // If we're inside a method, everything goes to class declarations
      // until we reach the method's closing brace
      if (insideMethod) {
        classDeclarations.push(line);
        if (braceLevel === 0) {
          insideMethod = false;
        }
        continue;
      }

      // If we're not inside a method and it's an executable statement,
      // it goes to the main method
      if (this._isExecutableStatement(trimmedLine)) {
        executableStatements.push(line);
      } else {
        // Default to class declarations
        classDeclarations.push(line);
      }
    }

    return {
      classDeclarations: classDeclarations.join('\n'),
      executableStatements: executableStatements.join('\n')
    };
  }

  /**
   * Check if a line is a method or class declaration
   * @private
   */
  _isMethodOrClassDeclaration(line) {
    return (line.includes('public ') || line.includes('private ') || line.includes('protected ') || line.includes('static ')) &&
           (line.includes('(') && line.includes(')')) ||
           line.includes('class ') ||
           line.includes('interface ') ||
           line.includes('enum ');
  }

  /**
   * Check if a line is a class-level declaration
   * @private
   */
  _isClassLevelDeclaration(line) {
    // Methods, constructors, static blocks, field declarations
    return line.includes('public static') ||
           line.includes('private static') ||
           line.includes('protected static') ||
           line.includes('public ') && line.includes('(') && line.includes(')') ||
           line.includes('private ') && line.includes('(') && line.includes(')') ||
           line.includes('protected ') && line.includes('(') && line.includes(')') ||
           line.startsWith('/**') ||
           line.startsWith('*/') ||
           line.startsWith('*') ||
           line.includes('static {') ||
           line === '{' || line === '}';
  }

  /**
   * Check if a line is an executable statement
   * @private
   */
  _isExecutableStatement(line) {
    // Variable declarations, loops, conditionals, method calls
    return line.includes('final ') ||
           line.includes('for (') ||
           line.includes('while (') ||
           line.includes('if (') ||
           line.includes('=') ||
           line.includes('(') && line.includes(')') && line.endsWith(';') ||
           line.includes('break;') ||
           line.includes('continue;') ||
           line.includes('return') ||
           line.includes('throw ') ||
           line.includes('try {') ||
           line.includes('catch (') ||
           line.includes('finally {');
  }

  /**
   * Convert JavaScript patterns to Java executable code
   * @private
   */
  _convertToJavaExecutable(code) {
    let result = code;

    // Convert console.log to System.out.println
    result = result.replace(/console\.log\(/g, 'System.out.println(');

    // Convert console.error to System.err.println
    result = result.replace(/console\.error\(/g, 'System.err.println(');

    // Convert console.warn to System.err.println
    result = result.replace(/console\.warn\(/g, 'System.err.println(');

    return result;
  }

  /**
   * Collect required dependencies with crypto-specific imports
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];

    // Common Java dependencies
    this.imports.add('java.util.*');
    this.imports.add('java.util.stream.*');
    this.imports.add('java.util.function.*');
    this.imports.add('java.lang.UnsupportedOperationException');

    // Crypto-specific imports
    if (this._hasOpCodesUsage(ast)) {
      this.imports.add('java.nio.ByteBuffer');
      this.imports.add('java.nio.ByteOrder');
      this.imports.add('javax.crypto.*');
      this.imports.add('javax.crypto.spec.*');
      this.imports.add('java.security.*');
      this.imports.add('java.math.BigInteger');
    }

    return dependencies;
  }

  /**
   * Check if AST contains OpCodes usage
   * @private
   */
  _hasOpCodesUsage(ast) {
    const astString = JSON.stringify(ast);
    return astString.includes('OpCodes') ||
           astString.includes('Pack32') ||
           astString.includes('Unpack32') ||
           astString.includes('RotL') ||
           astString.includes('RotR') ||
           astString.includes('XorArrays');
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];

    // Java-specific warnings
    warnings.push('Consider using specific types instead of int for better type safety');
    warnings.push('Add proper exception handling');
    warnings.push('Consider using Objects.equals() for object comparisons');
    warnings.push('Add proper access modifiers (private/protected/public)');

    return warnings;
  }

  /**
   * Generate OpCodes method call with Java cryptographic libraries
   * @private
   */
  _generateOpCodesCall(methodName, args) {
    // Map OpCodes methods to Java equivalents with crypto libraries
    switch (methodName) {
      case 'Pack32LE':
        this.imports.add('java.nio.ByteBuffer');
        this.imports.add('java.nio.ByteOrder');
        return `ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(${args}).array()`;
      case 'Pack32BE':
        this.imports.add('java.nio.ByteBuffer');
        this.imports.add('java.nio.ByteOrder');
        return `ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putInt(${args}).array()`;
      case 'Unpack32LE':
        this.imports.add('java.nio.ByteBuffer');
        this.imports.add('java.nio.ByteOrder');
        return `ByteBuffer.wrap(${args}).order(ByteOrder.LITTLE_ENDIAN).getInt()`;
      case 'Unpack32BE':
        this.imports.add('java.nio.ByteBuffer');
        this.imports.add('java.nio.ByteOrder');
        return `ByteBuffer.wrap(${args}).order(ByteOrder.BIG_ENDIAN).getInt()`;
      case 'RotL32':
        return `Integer.rotateLeft(${args})`;
      case 'RotR32':
        return `Integer.rotateRight(${args})`;
      case 'XorArrays':
        return `xorArrays(${args})`; // Custom utility method
      case 'ClearArray':
        this.imports.add('java.util.Arrays');
        return `Arrays.fill(${args}, (byte)0)`;
      case 'Hex8ToBytes':
        return `hexToBytes(${args})`; // Custom utility method
      case 'BytesToHex8':
        return `bytesToHex(${args})`; // Custom utility method
      case 'AnsiToBytes':
        this.imports.add('java.nio.charset.StandardCharsets');
        return `${args}.getBytes(StandardCharsets.US_ASCII)`;
      default:
        return `OpCodes.${methodName}(${args})`;
    }
  }

  /**
   * Infer Java type from JavaScript AST value with crypto context
   * @private
   */
  _inferJavaType(node, context = {}) {
    if (!node) return 'Object';

    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') return 'String';
        if (typeof node.value === 'number') {
          return Number.isInteger(node.value) ? 'int' : 'double';
        }
        if (typeof node.value === 'boolean') return 'boolean';
        if (node.value === null) return 'Object';
        break;
      case 'ArrayExpression':
        if (node.elements && node.elements.length > 0) {
          const firstElement = node.elements.find(el => el !== null);
          if (firstElement && this._isLikelyByteValue(firstElement)) {
            return 'byte[]';
          }
          const elementType = this._inferJavaType(firstElement, context);
          if (elementType === 'int') return 'int[]';
          if (elementType === 'long') return 'long[]';
        }
        return context.isCryptographic ? 'byte[]' : 'Object[]';
      case 'ObjectExpression':
        return context.isCryptographic ? 'Map<String, Object>' : 'Object';
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return 'Function<Object, Object>'; // Generic functional interface
    }

    // Crypto-specific type inference
    if (context.isCryptographic) {
      if (context.isKey) return 'SecretKey';
      if (context.isIV) return 'byte[]';
      if (context.isState) return 'int[]';
      return 'int';
    }

    return 'Object';
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
   * Check if a variable name suggests a cryptographic context
   * @private
   */
  _isCryptographicContext(varName) {
    if (!varName || typeof varName !== 'string') return false;

    const lowerName = varName.toLowerCase();
    const cryptoKeywords = [
      'key', 'cipher', 'crypto', 'encrypt', 'decrypt', 'hash', 'digest',
      'nonce', 'iv', 'salt', 'seed', 'round', 'state', 'buffer', 'block',
      'word', 'byte', 'bit', 'xor', 'sbox', 'pbox', 'permutation', 'substitution',
      'algorithm', 'algo', 'aes', 'des', 'rsa', 'sha', 'md5', 'hmac', 'mac',
      'signature', 'certificate', 'token', 'random', 'secure'
    ];

    return cryptoKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Generate Java stream operations for array processing
   * @private
   */
  _generateStreamOperation(arrayNode, operation, options) {
    this.imports.add('java.util.stream.IntStream');
    this.imports.add('java.util.Arrays');

    const array = this._generateNode(arrayNode, options);

    switch (operation) {
      case 'map':
        return `Arrays.stream(${array}).map(x -> x)`;
      case 'filter':
        return `Arrays.stream(${array}).filter(x -> true)`;
      case 'reduce':
        return `Arrays.stream(${array}).reduce(0, Integer::sum)`;
      case 'forEach':
        return `Arrays.stream(${array}).forEach(System.out::println)`;
      default:
        return `Arrays.stream(${array})`;
    }
  }

  /**
   * Generate Java crypto utility methods
   * @private
   */
  _generateCryptoUtilities(options) {
    let utilities = '';

    // XOR arrays utility
    utilities += '    /**\n';
    utilities += '     * XOR two byte arrays\n';
    utilities += '     */\n';
    utilities += '    private static byte[] xorArrays(byte[] a, byte[] b) {\n';
    utilities += '        byte[] result = new byte[Math.min(a.length, b.length)];\n';
    utilities += '        for (int i = 0; i < result.length; i++) {\n';
    utilities += '            result[i] = (byte)(a[i] ^ b[i]);\n';
    utilities += '        }\n';
    utilities += '        return result;\n';
    utilities += '    }\n\n';

    // Hex conversion utilities
    utilities += '    /**\n';
    utilities += '     * Convert hex string to byte array\n';
    utilities += '     */\n';
    utilities += '    private static byte[] hexToBytes(String hex) {\n';
    utilities += '        int len = hex.length();\n';
    utilities += '        byte[] data = new byte[len / 2];\n';
    utilities += '        for (int i = 0; i < len; i += 2) {\n';
    utilities += '            data[i / 2] = (byte)((Character.digit(hex.charAt(i), 16) << 4)\n';
    utilities += '                                + Character.digit(hex.charAt(i + 1), 16));\n';
    utilities += '        }\n';
    utilities += '        return data;\n';
    utilities += '    }\n\n';

    utilities += '    /**\n';
    utilities += '     * Convert byte array to hex string\n';
    utilities += '     */\n';
    utilities += '    private static String bytesToHex(byte[] bytes) {\n';
    utilities += '        StringBuilder result = new StringBuilder();\n';
    utilities += '        for (byte b : bytes) {\n';
    utilities += '            result.append(String.format("%02x", b));\n';
    utilities += '        }\n';
    utilities += '        return result.toString();\n';
    utilities += '    }\n\n';

    return utilities;
  }

  /**
   * Generate missing AST node types for modern Java
   * @private
   */
  _generateMetaProperty(node, options) {
    return `// MetaProperty: ${node.meta?.name || 'unknown'}.${node.property?.name || 'unknown'}`;
  }

  _generateAwaitExpression(node, options) {
    // Java doesn't have await, use CompletableFuture
    this.imports.add('java.util.concurrent.CompletableFuture');
    const argument = this._generateNode(node.argument, options);
    return `${argument}.get()`;
  }

  _generateYieldExpression(node, options) {
    // Java doesn't have yield expressions like JavaScript
    const argument = node.argument ? this._generateNode(node.argument, options) : '';
    return `/* yield */ ${argument}`;
  }

  _generateImportDeclaration(node, options) {
    const source = this._generateNode(node.source, options);
    const cleanSource = source.replace(/["']/g, '');
    this.imports.add(cleanSource);
    return this._indent(`// import ${source};\n`);
  }

  _generateExportDeclaration(node, options) {
    // Java uses public classes for exports
    const declaration = this._generateNode(node.declaration, options);
    return declaration.replace('class ', 'public class ');
  }

  _generateClassExpression(node, options) {
    return this._generateClass(node, options);
  }

  _generatePropertyDefinition(node, options) {
    const key = this._generateNode(node.key, options);
    const value = node.value ? this._generateNode(node.value, options) : 'null';
    const type = this._inferJavaType(node.value, { isCryptographic: true });
    const modifier = node.static ? 'static ' : '';
    return this._indent(`private ${modifier}${type} ${key} = ${value};\n`);
  }

  _generatePrivateIdentifier(node, options) {
    return `_${node.name}`; // Java doesn't have # private fields, use underscore
  }

  _generateStaticBlock(node, options) {
    let code = this._indent('static {\n');
    this.indentLevel++;
    if (node.body) {
      code += this._generateNode(node.body, options);
    }
    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateChainExpression(node, options) {
    // Java doesn't have optional chaining, handle gracefully
    const expr = this._generateNode(node.expression, options);
    return `Optional.ofNullable(${expr}).orElse(null)`;
  }

  _generateImportExpression(node, options) {
    // Java doesn't have dynamic imports, use static imports
    const source = this._generateNode(node.source, options);
    return `/* Dynamic import not supported: ${source} */`;
  }

  _generateFallbackNode(node, options) {
    // Enhanced fallback for unknown node types
    if (node.type && node.type.startsWith('TS')) {
      return `/* TypeScript node: ${node.type} */`;
    }

    // Try to handle common patterns
    if (node.operator && node.left && node.right) {
      const left = this._generateNode(node.left, options);
      const right = this._generateNode(node.right, options);
      return `${left} ${node.operator} ${right}`;
    }

    // Generate minimal valid Java code stub with warning
    return `{\n${this._indent('// WARNING: Unhandled AST node type: ' + node.type + '\n')}${this._indent('throw new UnsupportedOperationException("Not implemented: ' + node.type + '");\n')}}`;
  }

  /**
   * Check if Java compiler is available on the system
   * @private
   */
  _isJavaAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('javac -version', { 
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
      const pairs = { '(': ')', '[': ']', '{': '}', '<': '>' };
      const opening = Object.keys(pairs);
      const closing = Object.values(pairs);
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        
        // Skip string literals
        if (char === '"') {
          i++; // Skip opening quote
          while (i < code.length && code[i] !== '"') {
            if (code[i] === '\\') i++; // Skip escaped characters
            i++;
          }
          continue;
        }
        
        // Skip character literals
        if (char === "'") {
          i++; // Skip opening quote
          while (i < code.length && code[i] !== "'") {
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
          // Special handling for < in Java - only count as opening if it looks like a generic
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
   * Validate Java code syntax using javac
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Java compiler is available first
    const javacAvailable = this._isJavaAvailable();
    if (!javacAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Java compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `TempJavaClass_${Date.now()}.java`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Wrap code in a basic class structure if needed
      let javaCode = code;
      if (!code.includes('class ') && !code.includes('interface ') && !code.includes('enum ')) {
        const className = path.basename(tempFile, '.java');
        javaCode = `public class ${className} {\n${code}\n}`;
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, javaCode);
      
      try {
        // Try to compile the Java code
        execSync(`javac "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          cwd: path.dirname(tempFile),
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up source file
        fs.unlinkSync(tempFile);
        
        // Clean up compiled class file if it exists
        const classFile = tempFile.replace('.java', '.class');
        if (fs.existsSync(classFile)) {
          fs.unlinkSync(classFile);
        }
        
        return {
          success: true,
          method: 'javac',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        const classFile = tempFile.replace('.java', '.class');
        if (fs.existsSync(classFile)) {
          fs.unlinkSync(classFile);
        }
        
        return {
          success: false,
          method: 'javac',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Java compiler is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Java compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get Java compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Java Development Kit (JDK)',
      downloadUrl: 'https://www.oracle.com/java/technologies/downloads/',
      installInstructions: [
        'Download JDK from https://www.oracle.com/java/technologies/downloads/',
        'Or use OpenJDK from https://openjdk.org/',
        'Install the JDK package for your operating system',
        'Add JAVA_HOME and update PATH environment variables',
        'Verify installation with: javac -version'
      ].join('\n'),
      verifyCommand: 'javac -version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses with Java generics)',
      packageManager: 'Maven/Gradle',
      documentation: 'https://docs.oracle.com/en/java/'
    };
  }
}

// Register the plugin
const javaPlugin = new JavaPlugin();
LanguagePlugins.Add(javaPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = javaPlugin;
}


})(); // End of IIFE