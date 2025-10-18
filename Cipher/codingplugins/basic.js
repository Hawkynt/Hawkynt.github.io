/**
 * Enhanced BASIC Language Plugin for Multi-Language Code Generation
 * Generates production-ready BASIC code from JavaScript AST
 * Supports modern BASIC variants with comprehensive features
 *
 * Follows the LanguagePlugin specification exactly
 */

// Import the framework
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
   * Enhanced BASIC Code Generator Plugin
   * Extends LanguagePlugin base class with comprehensive modern BASIC support
   */
  class BasicPlugin extends LanguagePlugin {
    constructor() {
      super();

      // Required plugin metadata
      this.name = 'BASIC';
      this.extension = 'bas';
      this.icon = '📟';
      this.description = 'Enhanced BASIC language code generator with modern variant support';
      this.mimeType = 'text/x-basic';
      this.version = 'Multi-dialect: VB.NET, FreeBASIC, QB64, PureBASIC, PowerBASIC, True BASIC, Liberty BASIC';

      // Enhanced BASIC-specific options with modern variant support
      this.options = {
        indent: '    ', // 4 spaces
        lineEnding: '\n',
        useLineNumbers: false, // Modern BASIC doesn't need line numbers by default
        addComments: true,
        upperCase: false, // Modern BASIC supports mixed case
        variant: 'FREEBASIC', // Default variant: FREEBASIC, VBNET, QB64, PUREBASIC, POWERBASIC, TRUEBASIC, LIBERTYBASIC
        strictTypes: true, // Enable strong typing for modern variants
        useModules: true, // Enable module/namespace support
        useClasses: true, // Enable OOP features for modern variants
        useExceptionHandling: true, // Enable try/catch for supported variants
        useGenerics: false, // Enable generics for VB.NET
        useCryptoExtensions: true, // Enable crypto library integration
        useOpCodes: true, // Enable OpCodes integration for crypto operations
        packageName: 'CipherGenerated', // Default namespace/module name
        addDocComments: true, // Add XML documentation for VB.NET
        optimization: 'BALANCED', // SPEED, SIZE, BALANCED
        compatibility: 'MODERN' // LEGACY, MODERN, STRICT
      };

      // Internal state
      this.indentLevel = 0;
      this.lineNumber = 10;
      this.lineIncrement = 10;
      this.currentVariant = 'FREEBASIC';
      this.usedNamespaces = new Set();
      this.declaredVariables = new Map();
      this.cryptoOperations = new Set();
      this.requiresOpCodes = false;
      this.projectFiles = new Map();
    }

    /**
     * Generate enhanced BASIC code from Abstract Syntax Tree
     * @param {Object} ast - Parsed/Modified AST representation
     * @param {Object} options - Generation options
     * @returns {CodeGenerationResult}
     */
    GenerateFromAST(ast, options = {}) {
      try {
        // Reset state for clean generation
        this.indentLevel = 0;
        this.lineNumber = 10;
        this.usedNamespaces.clear();
        this.declaredVariables.clear();
        this.cryptoOperations.clear();
        this.requiresOpCodes = false;
        this.projectFiles.clear();

        // Merge options
        const mergedOptions = { ...this.options, ...options };
        this.currentVariant = mergedOptions.variant.toUpperCase();

        // Validate AST
        if (!ast || typeof ast !== 'object') {
          return this.CreateErrorResult('Invalid AST: must be an object');
        }

        // Generate BASIC code
        const code = this._generateNode(ast, mergedOptions);

        // Add program structure with imports and declarations
        const finalCode = this._wrapWithProgramStructure(code, mergedOptions);

        // Collect dependencies
        const dependencies = this._collectDependencies(ast, mergedOptions);

        // Generate comprehensive warnings
        const warnings = this._generateWarnings(ast, mergedOptions);

        // Create result with project files
        const result = this.CreateSuccessResult(finalCode, dependencies, warnings);
        result.projectFiles = this.projectFiles;

        return result;

      } catch (error) {
        return this.CreateErrorResult(`Code generation failed: ${error.message}`);
      }
    }

    /**
     * Generate code for any AST node with comprehensive type coverage
     * @private
     */
    _generateNode(node, options) {
      if (!node || !node.type) {
        return '';
      }

      switch (node.type) {
        // Core program structure
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
        case 'VariableDeclarator':
          return this._generateVariableDeclarator(node, options);

        // Statements
        case 'ExpressionStatement':
          return this._generateExpressionStatement(node, options);
        case 'ReturnStatement':
          return this._generateReturnStatement(node, options);
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

        // Expressions
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
          return this._generateThisExpression(node, options);
        case 'Super':
          return this._generateSuperExpression(node, options);
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

        // Patterns and destructuring
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

        // Advanced features
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

        // Additional AST node types for comprehensive coverage
        case 'AssignmentOperator':
          return this._generateAssignmentOperator(node, options);
        case 'BinaryOperator':
          return this._generateBinaryOperator(node, options);
        case 'LogicalOperator':
          return this._generateLogicalOperator(node, options);
        case 'UnaryOperator':
          return this._generateUnaryOperator(node, options);
        case 'UpdateOperator':
          return this._generateUpdateOperator(node, options);
        case 'SourceLocation':
          return this._generateSourceLocation(node, options);
        case 'Position':
          return this._generatePosition(node, options);

        default:
          return this._generateFallbackNode(node, options);
      }
    }

    /**
     * Generate program (root level) with proper structure
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
     * Generate enhanced function declaration with modern BASIC features
     * @private
     */
    _generateFunction(node, options) {
      const functionName = node.id ? this._toBasicName(node.id.name, options) : 'UnnamedFunction';
      let code = '';

      // Documentation comment
      if (options.addDocComments && this.currentVariant === 'VBNET') {
        code += this._generateXmlDocComment(node, options);
      } else if (options.addComments) {
        code += this._formatBasicLine(`' Function: ${functionName}`, options);
      }

      // Function signature with modern BASIC syntax
      const isFunction = this._shouldBeFunction(node);
      const keyword = this._getFunctionKeyword(isFunction, options);

      let signature = `${keyword} ${functionName}(`;

      // Parameters with types
      if (node.params && node.params.length > 0) {
        const params = node.params.map(param => {
          const paramName = this._toBasicName(param.name || 'param', options);
          const paramType = this._inferBasicType(paramName, param, options);
          return this._formatParameter(paramName, paramType, options);
        });
        signature += params.join(', ');
      }
      signature += ')';

      // Return type for functions
      if (isFunction) {
        const returnType = this._inferReturnType(functionName, node, options);
        signature += ` As ${returnType}`;
      }

      code += this._formatBasicLine(signature, options);

      // Function body
      this.indentLevel++;
      if (node.body) {
        const bodyCode = this._generateNode(node.body, options);
        code += bodyCode || this._formatBasicLine(`' Not implemented`, options);
      } else {
        code += this._formatBasicLine(`' Not implemented`, options);
      }
      this.indentLevel--;

      // End function/sub
      const endKeyword = this._getEndKeyword(isFunction, options);
      code += this._formatBasicLine(`${endKeyword} ${keyword}`, options);

      return code;
    }

    /**
     * Generate class declaration with OOP support
     * @private
     */
    _generateClass(node, options) {
      if (!options.useClasses || !this._supportsClasses(options)) {
        return this._generateClassAsModule(node, options);
      }

      const className = node.id ? this._toBasicName(node.id.name, options) : 'UnnamedClass';
      let code = '';

      // Class documentation
      if (options.addDocComments && this.currentVariant === 'VBNET') {
        code += this._generateXmlDocComment(node, options);
      } else if (options.addComments) {
        code += this._formatBasicLine(`' Class: ${className}`, options);
      }

      // Class declaration
      let classDecl = this._getClassKeyword(options) + ' ' + className;

      // Inheritance
      if (node.superClass) {
        const superClassName = this._generateNode(node.superClass, options);
        classDecl += this._getInheritanceKeyword(options) + ' ' + superClassName;
      }

      code += this._formatBasicLine(classDecl, options);

      // Class body
      this.indentLevel++;
      if (node.body && node.body.body) {
        const members = node.body.body
          .map(member => this._generateNode(member, options))
          .filter(memberCode => memberCode.trim() !== '');
        code += members.join('\n\n');
      }
      this.indentLevel--;

      // End class
      code += this._formatBasicLine(this._getEndClassKeyword(options), options);

      return code;
    }

    /**
     * Generate method definition within a class
     * @private
     */
    _generateMethod(node, options) {
      const methodName = node.key ? this._toBasicName(node.key.name, options) : 'UnnamedMethod';
      let code = '';

      // Method modifiers
      const modifiers = this._getMethodModifiers(node, options);

      // Method signature
      const isFunction = this._shouldBeFunction(node.value);
      const keyword = this._getFunctionKeyword(isFunction, options);

      let signature = modifiers + keyword + ' ' + methodName + '(';

      // Parameters
      if (node.value.params && node.value.params.length > 0) {
        const params = node.value.params.map(param => {
          const paramName = this._toBasicName(param.name || 'param', options);
          const paramType = this._inferBasicType(paramName, param, options);
          return this._formatParameter(paramName, paramType, options);
        });
        signature += params.join(', ');
      }
      signature += ')';

      // Return type
      if (isFunction) {
        const returnType = this._inferReturnType(methodName, node.value, options);
        signature += ` As ${returnType}`;
      }

      code += this._formatBasicLine(signature, options);

      // Method body
      this.indentLevel++;
      if (node.value.body) {
        const bodyCode = this._generateNode(node.value.body, options);
        code += bodyCode || this._formatBasicLine(`' Not implemented`, options);
      }
      this.indentLevel--;

      // End method
      const endKeyword = this._getEndKeyword(isFunction, options);
      code += this._formatBasicLine(`${endKeyword} ${keyword}`, options);

      return code;
    }

    /**
     * Generate block statement
     * @private
     */
    _generateBlock(node, options) {
      if (!node.body || node.body.length === 0) {
        return this._formatBasicLine(`' Empty block`, options);
      }

      return node.body
        .map(stmt => this._generateNode(stmt, options))
        .filter(line => line.trim())
        .join('\n');
    }

    /**
     * Generate enhanced variable declaration with typing
     * @private
     */
    _generateVariableDeclaration(node, options) {
      if (!node.declarations) return '';

      return node.declarations
        .map(decl => this._generateVariableDeclarator(decl, options))
        .filter(line => line.trim())
        .join('\n');
    }

    /**
     * Generate variable declarator with type inference
     * @private
     */
    _generateVariableDeclarator(node, options) {
      const varName = node.id ? this._toBasicName(node.id.name, options) : 'Variable';

      // Track declared variable
      this.declaredVariables.set(varName, {
        type: 'unknown',
        initialized: !!node.init
      });

      if (node.init) {
        const initValue = this._generateNode(node.init, options);
        const varType = this._inferBasicType(varName, node.init, options);

        // Update variable tracking
        this.declaredVariables.set(varName, {
          type: varType,
          initialized: true
        });

        if (options.strictTypes && this._requiresExplicitType(options)) {
          return this._formatBasicLine(`Dim ${varName} As ${varType} = ${initValue}`, options);
        } else {
          return this._formatBasicLine(`${varName} = ${initValue}`, options);
        }
      } else {
        const varType = this._inferBasicType(varName, null, options);
        if (this._requiresDeclaration(options)) {
          return this._formatBasicLine(`Dim ${varName} As ${varType}`, options);
        } else {
          return this._formatBasicLine(`Dim ${varName}`, options);
        }
      }
    }

    /**
     * Generate expression statement
     * @private
     */
    _generateExpressionStatement(node, options) {
      const expr = this._generateNode(node.expression, options);
      return expr ? this._formatBasicLine(expr, options) : '';
    }

    /**
     * Generate return statement
     * @private
     */
    _generateReturnStatement(node, options) {
      if (node.argument) {
        const returnValue = this._generateNode(node.argument, options);
        if (this.currentVariant === 'VBNET' || this.currentVariant === 'FREEBASIC') {
          return this._formatBasicLine(`Return ${returnValue}`, options);
        } else {
          return this._formatBasicLine(`' Return ${returnValue}`, options);
        }
      } else {
        if (this.currentVariant === 'VBNET' || this.currentVariant === 'FREEBASIC') {
          return this._formatBasicLine('Return', options);
        } else {
          return this._formatBasicLine('Return', options);
        }
      }
    }

    /**
     * Generate if statement with proper BASIC syntax
     * @private
     */
    _generateIfStatement(node, options) {
      const test = this._generateNode(node.test, options);
      let code = this._formatBasicLine(`If ${test} Then`, options);

      this.indentLevel++;
      if (node.consequent) {
        code += this._generateNode(node.consequent, options);
      }
      this.indentLevel--;

      if (node.alternate) {
        if (node.alternate.type === 'IfStatement') {
          code += this._formatBasicLine('ElseIf', options);
          code += this._generateIfStatement(node.alternate, options).replace(/^If /, '');
        } else {
          code += this._formatBasicLine('Else', options);
          this.indentLevel++;
          code += this._generateNode(node.alternate, options);
          this.indentLevel--;
        }
      }

      code += this._formatBasicLine('End If', options);
      return code;
    }

    /**
     * Generate while statement
     * @private
     */
    _generateWhileStatement(node, options) {
      const test = this._generateNode(node.test, options);
      let code = this._formatBasicLine(`While ${test}`, options);

      this.indentLevel++;
      if (node.body) {
        code += this._generateNode(node.body, options);
      }
      this.indentLevel--;

      code += this._formatBasicLine('Wend', options);
      return code;
    }

    /**
     * Generate for statement with modern BASIC syntax
     * @private
     */
    _generateForStatement(node, options) {
      if (this._isSimpleForLoop(node)) {
        return this._generateBasicForLoop(node, options);
      } else {
        return this._generateComplexForLoop(node, options);
      }
    }

    /**
     * Generate for-in statement
     * @private
     */
    _generateForInStatement(node, options) {
      const left = this._generateNode(node.left, options);
      const right = this._generateNode(node.right, options);

      let code = this._formatBasicLine(`For Each ${left} In ${right}`, options);

      this.indentLevel++;
      if (node.body) {
        code += this._generateNode(node.body, options);
      }
      this.indentLevel--;

      code += this._formatBasicLine('Next', options);
      return code;
    }

    /**
     * Generate for-of statement (similar to for-in in BASIC)
     * @private
     */
    _generateForOfStatement(node, options) {
      return this._generateForInStatement(node, options);
    }

    /**
     * Generate do-while statement
     * @private
     */
    _generateDoWhileStatement(node, options) {
      let code = this._formatBasicLine('Do', options);

      this.indentLevel++;
      if (node.body) {
        code += this._generateNode(node.body, options);
      }
      this.indentLevel--;

      const test = this._generateNode(node.test, options);
      code += this._formatBasicLine(`Loop While ${test}`, options);

      return code;
    }

    /**
     * Generate switch statement using Select Case
     * @private
     */
    _generateSwitchStatement(node, options) {
      const discriminant = this._generateNode(node.discriminant, options);
      let code = this._formatBasicLine(`Select Case ${discriminant}`, options);

      this.indentLevel++;
      if (node.cases) {
        for (const caseNode of node.cases) {
          code += this._generateNode(caseNode, options);
        }
      }
      this.indentLevel--;

      code += this._formatBasicLine('End Select', options);
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
        code += this._formatBasicLine(`Case ${test}`, options);
      } else {
        code += this._formatBasicLine('Case Else', options);
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
      return this._formatBasicLine('Exit For', options);
    }

    /**
     * Generate continue statement
     * @private
     */
    _generateContinueStatement(node, options) {
      return this._formatBasicLine('Continue For', options);
    }

    /**
     * Generate try statement with exception handling
     * @private
     */
    _generateTryStatement(node, options) {
      if (!options.useExceptionHandling || !this._supportsExceptions(options)) {
        return this._generateTryStatementFallback(node, options);
      }

      let code = this._formatBasicLine('Try', options);

      this.indentLevel++;
      if (node.block) {
        code += this._generateNode(node.block, options);
      }
      this.indentLevel--;

      if (node.handler) {
        code += this._generateNode(node.handler, options);
      }

      if (node.finalizer) {
        code += this._formatBasicLine('Finally', options);
        this.indentLevel++;
        code += this._generateNode(node.finalizer, options);
        this.indentLevel--;
      }

      code += this._formatBasicLine('End Try', options);
      return code;
    }

    /**
     * Generate catch clause
     * @private
     */
    _generateCatchClause(node, options) {
      let code = '';

      if (node.param) {
        const paramName = this._generateNode(node.param, options);
        const exceptionType = this._inferBasicType(paramName, null, options, 'Exception');
        code += this._formatBasicLine(`Catch ${paramName} As ${exceptionType}`, options);
      } else {
        code += this._formatBasicLine('Catch', options);
      }

      this.indentLevel++;
      if (node.body) {
        code += this._generateNode(node.body, options);
      }
      this.indentLevel--;

      return code;
    }

    /**
     * Generate throw statement
     * @private
     */
    _generateThrowStatement(node, options) {
      if (node.argument) {
        const argument = this._generateNode(node.argument, options);
        return this._formatBasicLine(`Throw ${argument}`, options);
      } else {
        return this._formatBasicLine('Throw', options);
      }
    }

    /**
     * Generate empty statement
     * @private
     */
    _generateEmptyStatement(node, options) {
      return '';
    }

    /**
     * Generate debugger statement
     * @private
     */
    _generateDebuggerStatement(node, options) {
      if (this.currentVariant === 'VBNET') {
        return this._formatBasicLine('System.Diagnostics.Debugger.Break()', options);
      } else {
        return this._formatBasicLine(`' Debugger breakpoint`, options);
      }
    }

    /**
     * Generate with statement
     * @private
     */
    _generateWithStatement(node, options) {
      const object = this._generateNode(node.object, options);

      if (this.currentVariant === 'VBNET') {
        let code = this._formatBasicLine(`With ${object}`, options);
        this.indentLevel++;
        if (node.body) {
          code += this._generateNode(node.body, options);
        }
        this.indentLevel--;
        code += this._formatBasicLine('End With', options);
        return code;
      } else {
        return this._formatBasicLine(`' With statement not supported in ${this.currentVariant}`, options);
      }
    }

    /**
     * Generate labeled statement
     * @private
     */
    _generateLabeledStatement(node, options) {
      const label = node.label.name;
      const body = this._generateNode(node.body, options);

      return this._formatBasicLine(`${label}:`, options) + body;
    }

    /**
     * Generate binary expression with BASIC operators
     * @private
     */
    _generateBinaryExpression(node, options) {
      const left = this._generateNode(node.left, options);
      const right = this._generateNode(node.right, options);
      let operator = this._mapBinaryOperator(node.operator, options);

      // Handle crypto operations
      if (this._isCryptoOperation(node.operator, left, right)) {
        this.cryptoOperations.add(node.operator);
        this.requiresOpCodes = true;
        return this._generateCryptoOperation(node.operator, left, right, options);
      }

      return `${left} ${operator} ${right}`;
    }

    /**
     * Generate call expression with function calls
     * @private
     */
    _generateCallExpression(node, options) {
      const callee = this._generateNode(node.callee, options);
      const args = node.arguments ?
        node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

      // Check for crypto function calls
      if (this._isCryptoFunction(callee)) {
        this.cryptoOperations.add(callee);
        this.requiresOpCodes = true;
        return this._generateCryptoFunctionCall(callee, args, options);
      }

      // Handle special BASIC functions
      const basicFunction = this._mapToBasicFunction(callee, options);
      return `${basicFunction}(${args})`;
    }

    /**
     * Generate member expression
     * @private
     */
    _generateMemberExpression(node, options) {
      const object = this._generateNode(node.object, options);

      if (node.computed) {
        const property = this._generateNode(node.property, options);
        return `${object}(${property})`;
      } else {
        const property = node.property.name || node.property;
        if (this.currentVariant === 'VBNET') {
          return `${object}.${property}`;
        } else {
          return `${object}_${property}`;
        }
      }
    }

    /**
     * Generate assignment expression
     * @private
     */
    _generateAssignmentExpression(node, options) {
      const left = this._generateNode(node.left, options);
      const right = this._generateNode(node.right, options);

      let operator = this._mapAssignmentOperator(node.operator, options);

      return `${left} ${operator} ${right}`;
    }

    /**
     * Generate identifier with proper BASIC naming
     * @private
     */
    _generateIdentifier(node, options) {
      return this._toBasicName(node.name, options);
    }

    /**
     * Generate literal values
     * @private
     */
    _generateLiteral(node, options) {
      if (typeof node.value === 'string') {
        return `"${node.value.replace(/"/g, '""')}"`;
      } else if (node.value === null) {
        return this._getNullValue(options);
      } else if (typeof node.value === 'boolean') {
        return this._getBooleanValue(node.value, options);
      } else if (typeof node.value === 'number') {
        return this._formatNumber(node.value, options);
      } else {
        return String(node.value);
      }
    }

    /**
     * Generate this expression
     * @private
     */
    _generateThisExpression(node, options) {
      if (this.currentVariant === 'VBNET') {
        return 'Me';
      } else {
        return 'This';
      }
    }

    /**
     * Generate super expression
     * @private
     */
    _generateSuperExpression(node, options) {
      if (this.currentVariant === 'VBNET') {
        return 'MyBase';
      } else {
        return 'Super';
      }
    }

    /**
     * Generate array expression
     * @private
     */
    _generateArrayExpression(node, options) {
      if (!node.elements || node.elements.length === 0) {
        return this._getEmptyArray(options);
      }

      const elements = node.elements.map(el =>
        el ? this._generateNode(el, options) : this._getNullValue(options)
      ).join(', ');

      if (this.currentVariant === 'VBNET') {
        return `{${elements}}`;
      } else {
        return `[${elements}]`;
      }
    }

    /**
     * Generate object expression
     * @private
     */
    _generateObjectExpression(node, options) {
      if (!options.useClasses || !this._supportsClasses(options)) {
        return this._generateObjectAsStruct(node, options);
      }

      if (!node.properties || node.properties.length === 0) {
        return this._getEmptyObject(options);
      }

      const properties = node.properties
        .map(prop => this._generateNode(prop, options))
        .join(', ');

      return `{${properties}}`;
    }

    /**
     * Generate property definition
     * @private
     */
    _generateProperty(node, options) {
      const key = this._generateNode(node.key, options);
      const value = this._generateNode(node.value, options);

      if (this.currentVariant === 'VBNET') {
        return `.${key} = ${value}`;
      } else {
        return `${key} = ${value}`;
      }
    }

    // Additional generation methods for comprehensive AST coverage...
    // (Due to length constraints, I'll include key methods and indicate others)

    /**
     * Generate function expression
     * @private
     */
    _generateFunctionExpression(node, options) {
      // Similar to _generateFunction but as expression
      return this._generateFunction(node, options);
    }

    /**
     * Generate arrow function expression
     * @private
     */
    _generateArrowFunctionExpression(node, options) {
      // Convert to regular function in BASIC
      return this._generateFunction({
        id: null,
        params: node.params,
        body: node.body,
        type: 'FunctionDeclaration'
      }, options);
    }

    /**
     * Generate new expression
     * @private
     */
    _generateNewExpression(node, options) {
      const callee = this._generateNode(node.callee, options);
      const args = node.arguments ?
        node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

      if (this.currentVariant === 'VBNET') {
        return `New ${callee}(${args})`;
      } else {
        return `${callee}(${args})`;
      }
    }

    /**
     * Generate unary expression
     * @private
     */
    _generateUnaryExpression(node, options) {
      const argument = this._generateNode(node.argument, options);
      const operator = this._mapUnaryOperator(node.operator, options);

      if (node.prefix) {
        return `${operator}${argument}`;
      } else {
        return `${argument}${operator}`;
      }
    }

    /**
     * Generate update expression
     * @private
     */
    _generateUpdateExpression(node, options) {
      const argument = this._generateNode(node.argument, options);

      if (node.operator === '++') {
        return `${argument} = ${argument} + 1`;
      } else if (node.operator === '--') {
        return `${argument} = ${argument} - 1`;
      }

      return argument;
    }

    /**
     * Generate logical expression
     * @private
     */
    _generateLogicalExpression(node, options) {
      const left = this._generateNode(node.left, options);
      const right = this._generateNode(node.right, options);
      const operator = this._mapLogicalOperator(node.operator, options);

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

      if (this.currentVariant === 'VBNET') {
        return `If(${test}, ${consequent}, ${alternate})`;
      } else {
        return `(${test} ? ${consequent} : ${alternate})`;
      }
    }

    // ... Continue with remaining AST node generation methods ...

    /**
     * Generate fallback for unsupported node types
     * @private
     */
    _generateFallbackNode(node, options) {
      return this._formatBasicLine(`' Unsupported node type: ${node.type}`, options);
    }

    // Helper methods for BASIC-specific functionality

    /**
     * Convert identifier to proper BASIC naming convention
     * @private
     */
    _toBasicName(name, options) {
      if (!name) return 'UnnamedIdentifier';

      // Handle case sensitivity based on variant
      if (options.upperCase || this.currentVariant === 'QB64') {
        return name.toUpperCase();
      } else if (this.currentVariant === 'VBNET') {
        // PascalCase for VB.NET
        return name.charAt(0).toUpperCase() + name.slice(1);
      } else {
        return name;
      }
    }

    /**
     * Infer BASIC type from value or context
     * @private
     */
    _inferBasicType(name, node, options, defaultType = 'Variant') {
      if (!options.strictTypes) {
        return defaultType;
      }

      // Type inference based on naming conventions
      if (name.toLowerCase().includes('count') || name.toLowerCase().includes('index')) {
        return 'Integer';
      }
      if (name.toLowerCase().includes('flag') || name.toLowerCase().includes('is')) {
        return 'Boolean';
      }
      if (name.toLowerCase().includes('name') || name.toLowerCase().includes('text')) {
        return 'String';
      }
      if (name.toLowerCase().includes('key') || name.toLowerCase().includes('hash')) {
        return 'Byte()';
      }

      // Type inference from AST node
      if (node) {
        switch (node.type) {
          case 'Literal':
            return this._inferTypeFromLiteral(node);
          case 'ArrayExpression':
            return 'Array';
          case 'ObjectExpression':
            return 'Object';
          case 'CallExpression':
            return this._inferTypeFromFunctionCall(node, options);
          default:
            return defaultType;
        }
      }

      return defaultType;
    }

    /**
     * Map JavaScript operators to BASIC operators
     * @private
     */
    _mapBinaryOperator(operator, options) {
      const mapping = {
        '===': '=',
        '==': '=',
        '!==': '<>',
        '!=': '<>',
        '&&': 'And',
        '||': 'Or',
        '%': 'Mod',
        '**': '^'
      };

      return mapping[operator] || operator;
    }

    /**
     * Check if operation involves cryptographic functions
     * @private
     */
    _isCryptoOperation(operator, left, right) {
      if (!this.options.useCryptoExtensions) return false;

      const cryptoKeywords = ['hash', 'encrypt', 'decrypt', 'key', 'cipher', 'crypto'];
      const operandText = `${left} ${right}`.toLowerCase();

      return cryptoKeywords.some(keyword => operandText.includes(keyword)) ||
             ['<<', '>>', '&', '|', '^'].includes(operator);
    }

    /**
     * Generate crypto operation using OpCodes
     * @private
     */
    _generateCryptoOperation(operator, left, right, options) {
      if (!options.useOpCodes) {
        return `${left} ${operator} ${right}`;
      }

      switch (operator) {
        case '<<':
          return `OpCodes.RotL32(${left}, ${right})`;
        case '>>':
          return `OpCodes.RotR32(${left}, ${right})`;
        case '&':
          return `OpCodes.BitwiseAnd(${left}, ${right})`;
        case '|':
          return `OpCodes.BitwiseOr(${left}, ${right})`;
        case '^':
          return `OpCodes.BitwiseXor(${left}, ${right})`;
        default:
          return `${left} ${this._mapBinaryOperator(operator, options)} ${right}`;
      }
    }

    /**
     * Format a BASIC line with proper indentation and line numbering
     * @private
     */
    _formatBasicLine(code, options) {
      if (!code.trim()) return '\n';

      let line = '';

      if (options.useLineNumbers) {
        line = `${this.lineNumber} `;
        this.lineNumber += this.lineIncrement;
      }

      // Add indentation
      const indentStr = options.indent.repeat(this.indentLevel);
      line += indentStr + code;

      return line + '\n';
    }

    /**
     * Get appropriate function keyword for variant
     * @private
     */
    _getFunctionKeyword(isFunction, options) {
      if (isFunction) {
        return this.currentVariant === 'VBNET' ? 'Function' : 'Function';
      } else {
        return this.currentVariant === 'VBNET' ? 'Sub' : 'Sub';
      }
    }

    /**
     * Check if variant supports classes
     * @private
     */
    _supportsClasses(options) {
      return ['VBNET', 'FREEBASIC'].includes(this.currentVariant);
    }

    /**
     * Check if variant supports exception handling
     * @private
     */
    _supportsExceptions(options) {
      return ['VBNET', 'FREEBASIC'].includes(this.currentVariant);
    }

    /**
     * Wrap generated code with proper program structure and create complete, compilable programs
     * @private
     */
    _wrapWithProgramStructure(code, options) {
      let result = '';

      // Generate complete program structure based on variant
      switch (this.currentVariant) {
        case 'VBNET':
          result = this._generateVBNetCompleteProgram(code, options);
          this._generateVBNetProjectFiles(options);
          break;
        case 'QB64':
          result = this._generateQB64CompleteProgram(code, options);
          this._generateQB64ProjectFiles(options);
          break;
        case 'PUREBASIC':
          result = this._generatePureBASICCompleteProgram(code, options);
          this._generatePureBASICProjectFiles(options);
          break;
        case 'FREEBASIC':
          result = this._generateFreeBASICCompleteProgram(code, options);
          this._generateFreeBASICProjectFiles(options);
          break;
        case 'TRUEBASIC':
          result = this._generateTrueBASICCompleteProgram(code, options);
          this._generateTrueBASICProjectFiles(options);
          break;
        case 'LIBERTYBASIC':
          result = this._generateLibertyBASICCompleteProgram(code, options);
          this._generateLibertyBASICProjectFiles(options);
          break;
        case 'POWERBASIC':
          result = this._generatePowerBASICCompleteProgram(code, options);
          this._generatePowerBASICProjectFiles(options);
          break;
        default:
          // Fallback to generic BASIC structure
          result = this._generateGenericBASICProgram(code, options);
          this._generateGenericProjectFiles(options);
      }

      return result;
    }

    /**
     * Generate imports and includes for the variant
     * @private
     */
    _generateImportsAndIncludes(options) {
      let imports = '';

      switch (this.currentVariant) {
        case 'VBNET':
          imports += this._formatBasicLine('Imports System', options);
          if (this.cryptoOperations.size > 0) {
            imports += this._formatBasicLine('Imports System.Security.Cryptography', options);
            imports += this._formatBasicLine('Imports System.Text', options);
          }
          break;

        case 'FREEBASIC':
          if (this.requiresOpCodes) {
            imports += this._formatBasicLine('#Include "opcodes.bi"', options);
          }
          break;

        case 'QB64':
          if (this.requiresOpCodes) {
            imports += this._formatBasicLine("'$Include:'opcodes.bm'", options);
          }
          break;
      }

      if (imports) {
        imports += '\n';
      }

      return imports;
    }

    /**
     * Generate OpCodes integration
     * @private
     */
    _generateOpCodesIntegration(options) {
      let code = '';

      if (options.addComments) {
        code += this._formatBasicLine(`' OpCodes Integration for Cryptographic Operations`, options);
      }

      switch (this.currentVariant) {
        case 'VBNET':
          code += this._formatBasicLine('Public Class OpCodes', options);
          this.indentLevel++;
          code += this._generateVBNetOpCodes(options);
          this.indentLevel--;
          code += this._formatBasicLine('End Class', options);
          break;

        case 'FREEBASIC':
          code += this._generateFreeBASICOpCodes(options);
          break;

        default:
          code += this._formatBasicLine(`' OpCodes simulation for ${this.currentVariant}`, options);
          code += this._generateGenericOpCodes(options);
      }

      code += '\n';
      return code;
    }

    /**
     * Collect comprehensive dependencies
     * @private
     */
    _collectDependencies(ast, options) {
      const dependencies = [];

      // Standard dependencies based on variant
      switch (this.currentVariant) {
        case 'VBNET':
          dependencies.push({
            name: '.NET Framework',
            version: '4.8+',
            type: 'runtime'
          });
          if (this.cryptoOperations.size > 0) {
            dependencies.push({
              name: 'System.Security.Cryptography',
              version: 'Standard',
              type: 'namespace'
            });
          }
          break;

        case 'FREEBASIC':
          dependencies.push({
            name: 'FreeBASIC Compiler',
            version: '1.09+',
            type: 'compiler'
          });
          break;

        case 'QB64':
          dependencies.push({
            name: 'QB64 Environment',
            version: '2.0+',
            type: 'interpreter'
          });
          break;
      }

      // OpCodes dependency
      if (this.requiresOpCodes) {
        dependencies.push({
          name: 'OpCodes Cryptographic Library',
          version: '1.0+',
          type: 'library'
        });
      }

      // Module dependencies
      this.usedNamespaces.forEach(namespace => {
        dependencies.push({
          name: namespace,
          type: 'module'
        });
      });

      return dependencies;
    }

    /**
     * Generate comprehensive warnings about potential issues
     * @private
     */
    _generateWarnings(ast, options) {
      const warnings = [];

      // Variant compatibility warnings
      if (this.currentVariant === 'QB64' && options.useClasses) {
        warnings.push('QB64 has limited object-oriented programming support. Consider using FreeBASIC or VB.NET for full OOP features.');
      }

      // Legacy BASIC warnings
      if (['QBASIC', 'GWBASIC'].includes(this.currentVariant)) {
        warnings.push('Legacy BASIC variants have significant limitations. Consider modern alternatives like FreeBASIC or VB.NET.');
      }

      // Type safety warnings
      if (!options.strictTypes && this._hasTypeAmbiguity(ast)) {
        warnings.push('Type ambiguity detected. Enable strict typing for better type safety and performance.');
      }

      // Performance warnings
      if (this._hasPerformanceIssues(ast)) {
        warnings.push('Performance concerns detected. Consider optimizing loops and using appropriate data types.');
      }

      // Security warnings for crypto operations
      if (this.cryptoOperations.size > 0) {
        warnings.push('Cryptographic operations detected. Ensure proper key management and secure coding practices.');

        if (!options.useOpCodes) {
          warnings.push('Consider enabling OpCodes integration for secure and optimized cryptographic operations.');
        }
      }

      // Memory management warnings
      if (this._hasMemoryLeakRisks(ast)) {
        warnings.push('Potential memory management issues. Ensure proper cleanup of resources and large arrays.');
      }

      // String handling warnings
      if (this._hasStringConcatenationIssues(ast)) {
        warnings.push('Multiple string concatenations detected. Consider using StringBuilder for better performance.');
      }

      // Array bounds warnings
      if (this._hasArrayBoundsRisks(ast)) {
        warnings.push('Array operations detected. Ensure proper bounds checking to prevent runtime errors.');
      }

      // Exception handling warnings
      if (options.useExceptionHandling && !this._supportsExceptions(options)) {
        warnings.push(`Exception handling is not fully supported in ${this.currentVariant}. Consider using error codes instead.`);
      }

      // Naming convention warnings
      if (this._hasNamingConventionIssues(ast, options)) {
        warnings.push('Naming convention inconsistencies detected. Follow BASIC naming standards for better maintainability.');
      }

      // Compatibility warnings
      if (this._hasCompatibilityIssues(ast, options)) {
        warnings.push('Cross-variant compatibility issues detected. Some features may not work across all BASIC dialects.');
      }

      return warnings;
    }

    // Helper methods for warning detection
    _hasTypeAmbiguity(ast) {
      return this._traverseAST(ast, node => {
        return node.type === 'Identifier' && !this.declaredVariables.has(node.name);
      });
    }

    _hasPerformanceIssues(ast) {
      return this._traverseAST(ast, node => {
        return node.type === 'WhileStatement' ||
               (node.type === 'ForStatement' && this._isNestedLoop(node));
      });
    }

    _hasMemoryLeakRisks(ast) {
      return this._traverseAST(ast, node => {
        return node.type === 'ArrayExpression' &&
               node.elements && node.elements.length > 1000;
      });
    }

    _hasStringConcatenationIssues(ast) {
      return this._traverseAST(ast, node => {
        return node.type === 'BinaryExpression' &&
               node.operator === '+' &&
               this._isStringOperation(node);
      });
    }

    _hasArrayBoundsRisks(ast) {
      return this._traverseAST(ast, node => {
        return node.type === 'MemberExpression' && node.computed;
      });
    }

    _hasNamingConventionIssues(ast, options) {
      return this._traverseAST(ast, node => {
        if (node.type === 'Identifier') {
          const name = node.name;
          if (this.currentVariant === 'VBNET') {
            return !/^[A-Z][a-zA-Z0-9]*$/.test(name);
          } else if (options.upperCase) {
            return !/^[A-Z_][A-Z0-9_]*$/.test(name);
          }
        }
        return false;
      });
    }

    _hasCompatibilityIssues(ast, options) {
      return this._traverseAST(ast, node => {
        return (node.type === 'ClassDeclaration' && !this._supportsClasses(options)) ||
               (node.type === 'TryStatement' && !this._supportsExceptions(options));
      });
    }

    /**
     * Traverse AST and check condition
     * @private
     */
    _traverseAST(node, condition) {
      if (!node || typeof node !== 'object') return false;

      if (condition(node)) return true;

      for (const key in node) {
        const value = node[key];
        if (Array.isArray(value)) {
          if (value.some(item => this._traverseAST(item, condition))) {
            return true;
          }
        } else if (typeof value === 'object') {
          if (this._traverseAST(value, condition)) {
            return true;
          }
        }
      }

      return false;
    }

    // Additional helper methods for comprehensive functionality
    _supportsModules(options) {
      return ['VBNET', 'FREEBASIC'].includes(this.currentVariant);
    }

    _generateModuleDeclaration(options) {
      switch (this.currentVariant) {
        case 'VBNET':
          return this._formatBasicLine(`Namespace ${options.packageName}`, options);
        case 'FREEBASIC':
          return this._formatBasicLine(`Namespace ${options.packageName}`, options);
        default:
          return '';
      }
    }

    _generateModuleEnd(options) {
      switch (this.currentVariant) {
        case 'VBNET':
          return this._formatBasicLine('End Namespace', options);
        case 'FREEBASIC':
          return this._formatBasicLine('End Namespace', options);
        default:
          return '';
      }
    }

    // VB.NET specific OpCodes implementation
    _generateVBNetOpCodes(options) {
      let code = '';

      code += this._formatBasicLine('Public Shared Function RotL32(value As UInteger, positions As Integer) As UInteger', options);
      this.indentLevel++;
      code += this._formatBasicLine('Return (value << positions) Or (value >> (32 - positions))', options);
      this.indentLevel--;
      code += this._formatBasicLine('End Function', options);
      code += '\n';

      code += this._formatBasicLine('Public Shared Function RotR32(value As UInteger, positions As Integer) As UInteger', options);
      this.indentLevel++;
      code += this._formatBasicLine('Return (value >> positions) Or (value << (32 - positions))', options);
      this.indentLevel--;
      code += this._formatBasicLine('End Function', options);
      code += '\n';

      code += this._formatBasicLine('Public Shared Function BitwiseXor(a As Byte(), b As Byte()) As Byte()', options);
      this.indentLevel++;
      code += this._formatBasicLine('Dim result(Math.Max(a.Length, b.Length) - 1) As Byte', options);
      code += this._formatBasicLine('For i As Integer = 0 To result.Length - 1', options);
      this.indentLevel++;
      code += this._formatBasicLine('result(i) = a(i Mod a.Length) Xor b(i Mod b.Length)', options);
      this.indentLevel--;
      code += this._formatBasicLine('Next', options);
      code += this._formatBasicLine('Return result', options);
      this.indentLevel--;
      code += this._formatBasicLine('End Function', options);

      return code;
    }

    // FreeBASIC specific OpCodes implementation
    _generateFreeBASICOpCodes(options) {
      let code = '';

      code += this._formatBasicLine('Function RotL32(value As ULong, positions As Integer) As ULong', options);
      this.indentLevel++;
      code += this._formatBasicLine('Return (value Shl positions) Or (value Shr (32 - positions))', options);
      this.indentLevel--;
      code += this._formatBasicLine('End Function', options);
      code += '\n';

      code += this._formatBasicLine('Function RotR32(value As ULong, positions As Integer) As ULong', options);
      this.indentLevel++;
      code += this._formatBasicLine('Return (value Shr positions) Or (value Shl (32 - positions))', options);
      this.indentLevel--;
      code += this._formatBasicLine('End Function', options);

      return code;
    }

    // Generic OpCodes for other variants
    _generateGenericOpCodes(options) {
      let code = '';

      code += this._formatBasicLine('REM OpCodes simulation - implement crypto operations here', options);
      code += this._formatBasicLine('REM Use bitwise operations appropriate for your BASIC variant', options);

      return code;
    }

    /**
     * Enhanced syntax validation
     * @override
     */
    ValidateCodeSyntax(code) {
      // First try FreeBASIC compiler if available
      const fbcResult = this._validateWithFreeBASIC(code);
      if (fbcResult.success || fbcResult.method === 'fbc') {
        return fbcResult;
      }

      // Fall back to enhanced basic validation
      return this._validateBasicSyntax(code);
    }

    _validateWithFreeBASIC(code) {
      if (!this._isFBCAvailable()) {
        return { success: false, method: 'none', error: 'FBC not available' };
      }

      try {
        const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');

        const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_basic_${Date.now()}.bas`);
        const tempDir = path.dirname(tempFile);

        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        fs.writeFileSync(tempFile, code);

        try {
          execSync(`fbc -c "${tempFile}"`, {
            stdio: 'pipe',
            timeout: 3000,
            windowsHide: true
          });

          // Cleanup
          this._cleanupTempFiles(tempFile);

          return {
            success: true,
            method: 'fbc',
            error: null
          };

        } catch (error) {
          this._cleanupTempFiles(tempFile);

          return {
            success: false,
            method: 'fbc',
            error: error.stderr?.toString() || error.message
          };
        }

      } catch (error) {
        return { success: false, method: 'fbc', error: error.message };
      }
    }

    _validateBasicSyntax(code) {
      const errors = [];

      // Remove comments before checking keywords to avoid false positives
      const codeWithoutComments = this._removeBasicComments(code);

      // Check balanced keywords
      const keywordPairs = [
        ['If', 'End If'],
        ['While', 'Wend'],
        ['For', 'Next'],
        ['Sub', 'End Sub'],
        ['Function', 'End Function'],
        ['Class', 'End Class'],
        ['Namespace', 'End Namespace'],
        ['Try', 'End Try'],
        ['With', 'End With'],
        ['Select', 'End Select']
      ];

      for (const [start, end] of keywordPairs) {
        // Count actual start keywords (not preceded by "End")
        const startPattern = new RegExp(`(?<!\\bEnd\\s+)\\b${start}\\b`, 'gi');
        let startCount = 0;

        // Use a more reliable approach to count start keywords
        const lines = codeWithoutComments.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();

          // Check for start keyword not preceded by "End"
          const startRegex = new RegExp(`^\\s*${start}\\b`, 'i');
          if (startRegex.test(trimmedLine)) {
            startCount++;
          }
        }

        // Count end keywords normally
        const endCount = (codeWithoutComments.match(new RegExp(`\\b${end}\\b`, 'gi')) || []).length;

        if (startCount !== endCount) {
          errors.push(`Unmatched ${start}/${end} keywords: ${startCount} vs ${endCount}`);
        }
      }

      // Check parentheses and brackets
      if (!this._checkBalancedDelimiters(code)) {
        errors.push('Unbalanced parentheses, brackets, or quotes');
      }

      return {
        success: errors.length === 0,
        method: 'enhanced-basic',
        error: errors.length > 0 ? errors.join('; ') : null
      };
    }

    /**
     * Remove BASIC comments from code to avoid counting keywords in comments
     * @private
     */
    _removeBasicComments(code) {
      // Remove single-line comments starting with '
      const lines = code.split('\n');
      const cleanLines = lines.map(line => {
        const commentIndex = line.indexOf("'");
        if (commentIndex !== -1) {
          // Check if the quote is inside a string literal
          let inString = false;
          let stringChar = '';
          for (let i = 0; i < commentIndex; i++) {
            if ((line[i] === '"' || line[i] === "'") && !inString) {
              inString = true;
              stringChar = line[i];
            } else if (line[i] === stringChar && inString) {
              if (line[i + 1] === stringChar) {
                i++; // Skip escaped quote
              } else {
                inString = false;
              }
            }
          }

          // If we're not inside a string, remove the comment
          if (!inString) {
            return line.substring(0, commentIndex).trimEnd();
          }
        }
        return line;
      });

      return cleanLines.join('\n');
    }

    _checkBalancedDelimiters(code) {
      const stack = [];
      const pairs = { '(': ')', '[': ']', '{': '}' };
      let inString = false;
      let stringChar = '';
      let inComment = false;

      for (let i = 0; i < code.length; i++) {
        const char = code[i];

        // Handle line endings - comments end at line breaks
        if (char === '\n' || char === '\r') {
          inComment = false;
        }

        // Handle BASIC comments (single quote starts comment)
        if (char === "'" && !inString && !inComment) {
          inComment = true;
          continue;
        }

        // Skip everything if we're in a comment
        if (inComment) {
          continue;
        }

        // Handle string literals (only double quotes in BASIC)
        if (char === '"' && !inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar && inString) {
          if (code[i + 1] === char) {
            i++; // Skip escaped quote
          } else {
            inString = false;
          }
        } else if (!inString) {
          if (pairs[char]) {
            stack.push(char);
          } else if (Object.values(pairs).includes(char)) {
            const last = stack.pop();
            if (!last || pairs[last] !== char) {
              return false;
            }
          }
        }
      }

      return stack.length === 0 && !inString;
    }

    _cleanupTempFiles(tempFile) {
      const fs = require('fs');
      const path = require('path');

      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }

        const baseName = path.parse(tempFile).name;
        const baseDir = path.dirname(tempFile);

        const possibleOutputs = [
          path.join(baseDir, baseName + '.o'),
          path.join(baseDir, baseName),
          path.join(baseDir, baseName + '.exe')
        ];

        possibleOutputs.forEach(file => {
          try {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    _isFBCAvailable() {
      try {
        const { execSync } = require('child_process');
        execSync('fbc -version', {
          stdio: 'pipe',
          timeout: 1000,
          windowsHide: true
        });
        return true;
      } catch (error) {
        return false;
      }
    }

    /**
     * Get enhanced compiler information
     * @override
     */
    GetCompilerInfo() {
      return {
        name: this.name,
        compilerName: 'Multiple BASIC Compilers Supported',
        downloadUrl: 'https://www.freebasic.net/wiki/CompilerInstalling',
        installInstructions: [
          'For FreeBASIC: Download from https://www.freebasic.net/wiki/CompilerInstalling',
          'For VB.NET: Install Visual Studio or .NET SDK',
          'For QB64: Download from https://qb64.org/',
          'For PureBASIC: Download from https://www.purebasic.com/',
          'For PowerBASIC: Commercial license from PowerBASIC Inc.',
          'For True BASIC: Download from https://www.truebasic.com/',
          'For Liberty BASIC: Download from http://www.libertybasic.com/',
          'Add compiler to your system PATH',
          'Verify installation with compiler-specific version command'
        ].join('\n'),
        verifyCommand: 'fbc -version (FreeBASIC), vbc /help (VB.NET)',
        alternativeValidation: 'Enhanced syntax checking with keyword balancing',
        packageManager: 'Varies by variant (NuGet for VB.NET, manual for others)',
        documentation: 'https://www.freebasic.net/wiki/DocToc (FreeBASIC), https://docs.microsoft.com/en-us/dotnet/visual-basic/ (VB.NET)',
        supportedVariants: [
          'VB.NET - Modern, full-featured with .NET integration',
          'FreeBASIC - QB-compatible with modern features',
          'QB64 - QBasic compatible with modern OS support',
          'PureBASIC - Fast compiled BASIC',
          'PowerBASIC - Windows-focused compiled BASIC',
          'True BASIC - Educational structured BASIC',
          'Liberty BASIC - Windows GUI BASIC'
        ]
      };
    }

    // Additional missing helper methods for complete functionality

    /**
     * Generate XML documentation comment for VB.NET
     * @private
     */
    _generateXmlDocComment(node, options) {
      let comment = this._formatBasicLine("''' <summary>", options);
      if (node.type === 'FunctionDeclaration') {
        const funcName = node.id ? node.id.name : 'Function';
        comment += this._formatBasicLine(`''' ${funcName} function`, options);
      } else if (node.type === 'ClassDeclaration') {
        const className = node.id ? node.id.name : 'Class';
        comment += this._formatBasicLine(`''' ${className} class`, options);
      }
      comment += this._formatBasicLine("''' </summary>", options);
      return comment;
    }

    /**
     * Check if function should be a Function (returns value) or Sub
     * @private
     */
    _shouldBeFunction(node) {
      if (!node || !node.body) return false;

      // Check if function has return statements
      return this._traverseAST(node.body, n => n.type === 'ReturnStatement' && n.argument);
    }

    /**
     * Format parameter with type
     * @private
     */
    _formatParameter(name, type, options) {
      if (this.currentVariant === 'VBNET') {
        return `${name} As ${type}`;
      } else {
        return `${name} As ${type}`;
      }
    }

    /**
     * Infer return type for function
     * @private
     */
    _inferReturnType(functionName, node, options) {
      // Simple heuristics for return type inference
      if (functionName.toLowerCase().includes('count') || functionName.toLowerCase().includes('length')) {
        return 'Integer';
      }
      if (functionName.toLowerCase().includes('is') || functionName.toLowerCase().includes('has')) {
        return 'Boolean';
      }
      if (functionName.toLowerCase().includes('get') || functionName.toLowerCase().includes('find')) {
        return 'String';
      }
      if (functionName.toLowerCase().includes('calculate') || functionName.toLowerCase().includes('compute')) {
        return 'Double';
      }
      return 'Variant';
    }

    /**
     * Get end keyword for function/sub
     * @private
     */
    _getEndKeyword(isFunction, options) {
      return 'End';
    }

    /**
     * Check if explicit type declaration is required
     * @private
     */
    _requiresExplicitType(options) {
      return options.strictTypes && ['VBNET', 'FREEBASIC'].includes(this.currentVariant);
    }

    /**
     * Check if variable declaration is required
     * @private
     */
    _requiresDeclaration(options) {
      return ['VBNET', 'FREEBASIC'].includes(this.currentVariant);
    }

    /**
     * Get null value representation
     * @private
     */
    _getNullValue(options) {
      if (this.currentVariant === 'VBNET') {
        return 'Nothing';
      } else {
        return '0';
      }
    }

    /**
     * Get boolean value representation
     * @private
     */
    _getBooleanValue(value, options) {
      if (this.currentVariant === 'VBNET') {
        return value ? 'True' : 'False';
      } else {
        return value ? '-1' : '0';
      }
    }

    /**
     * Format number value
     * @private
     */
    _formatNumber(value, options) {
      return String(value);
    }

    /**
     * Get empty array representation
     * @private
     */
    _getEmptyArray(options) {
      if (this.currentVariant === 'VBNET') {
        return '{}';
      } else {
        return '()';
      }
    }

    /**
     * Get empty object representation
     * @private
     */
    _getEmptyObject(options) {
      if (this.currentVariant === 'VBNET') {
        return 'New Object()';
      } else {
        return 'Nothing';
      }
    }

    /**
     * Generate class as module fallback
     * @private
     */
    _generateClassAsModule(node, options) {
      const className = node.id ? this._toBasicName(node.id.name, options) : 'UnnamedModule';
      let code = '';

      if (options.addComments) {
        code += this._formatBasicLine(`' Module: ${className} (Class simulation)`, options);
      }

      // Generate module-like structure
      if (node.body && node.body.body) {
        for (const member of node.body.body) {
          code += this._generateNode(member, options);
        }
      }

      return code;
    }

    /**
     * Generate object as struct fallback
     * @private
     */
    _generateObjectAsStruct(node, options) {
      if (!node.properties || node.properties.length === 0) {
        return this._getEmptyObject(options);
      }

      let code = '';
      if (options.addComments) {
        code += this._formatBasicLine(`' Structure definition`, options);
      }

      for (const prop of node.properties) {
        const key = this._generateNode(prop.key, options);
        const value = this._generateNode(prop.value, options);
        code += this._formatBasicLine(`${key} = ${value}`, options);
      }

      return code;
    }

    /**
     * Get class keyword for variant
     * @private
     */
    _getClassKeyword(options) {
      return 'Class';
    }

    /**
     * Get inheritance keyword
     * @private
     */
    _getInheritanceKeyword(options) {
      if (this.currentVariant === 'VBNET') {
        return ' Inherits';
      } else {
        return ' Extends';
      }
    }

    /**
     * Get end class keyword
     * @private
     */
    _getEndClassKeyword(options) {
      return 'End Class';
    }

    /**
     * Get method modifiers
     * @private
     */
    _getMethodModifiers(node, options) {
      let modifiers = '';

      if (node.static) {
        modifiers += 'Shared ';
      }
      if (node.kind === 'constructor') {
        modifiers += 'New ';
      }

      return modifiers;
    }

    /**
     * Check if simple for loop
     * @private
     */
    _isSimpleForLoop(node) {
      return node.init && node.test && node.update &&
             node.init.type === 'VariableDeclaration' &&
             node.test.type === 'BinaryExpression' &&
             node.update.type === 'UpdateExpression';
    }

    /**
     * Generate basic for loop
     * @private
     */
    _generateBasicForLoop(node, options) {
      const variable = node.init.declarations[0].id.name;
      const start = node.init.declarations[0].init ?
        this._generateNode(node.init.declarations[0].init, options) : '0';

      let end = '';
      if (node.test.right) {
        end = this._generateNode(node.test.right, options);
        if (node.test.operator === '<') {
          end = `${end} - 1`;
        }
      }

      let code = this._formatBasicLine(`For ${variable} = ${start} To ${end}`, options);

      this.indentLevel++;
      if (node.body) {
        code += this._generateNode(node.body, options);
      }
      this.indentLevel--;

      code += this._formatBasicLine('Next', options);
      return code;
    }

    /**
     * Generate complex for loop
     * @private
     */
    _generateComplexForLoop(node, options) {
      let code = '';

      if (node.init) {
        code += this._generateNode(node.init, options);
      }

      const test = node.test ? this._generateNode(node.test, options) : 'True';
      code += this._formatBasicLine(`While ${test}`, options);

      this.indentLevel++;
      if (node.body) {
        code += this._generateNode(node.body, options);
      }
      if (node.update) {
        code += this._formatBasicLine(this._generateNode(node.update, options), options);
      }
      this.indentLevel--;

      code += this._formatBasicLine('Wend', options);
      return code;
    }

    /**
     * Generate try statement fallback
     * @private
     */
    _generateTryStatementFallback(node, options) {
      let code = '';

      if (options.addComments) {
        code += this._formatBasicLine(`' Try-catch simulation (${this.currentVariant} doesn't support exceptions)`, options);
      }

      if (node.block) {
        code += this._generateNode(node.block, options);
      }

      return code;
    }

    /**
     * Map assignment operators
     * @private
     */
    _mapAssignmentOperator(operator, options) {
      const mapping = {
        '+=': '+',
        '-=': '-',
        '*=': '*',
        '/=': '/',
        '%=': 'Mod',
        '&=': 'And',
        '|=': 'Or',
        '^=': 'Xor'
      };

      if (mapping[operator]) {
        return `= ${mapping[operator]}`;
      }
      return '=';
    }

    /**
     * Map unary operators
     * @private
     */
    _mapUnaryOperator(operator, options) {
      const mapping = {
        '!': 'Not ',
        '-': '-',
        '+': '+',
        '~': 'Not '
      };

      return mapping[operator] || operator;
    }

    /**
     * Map logical operators
     * @private
     */
    _mapLogicalOperator(operator, options) {
      const mapping = {
        '&&': 'And',
        '||': 'Or'
      };

      return mapping[operator] || operator;
    }

    /**
     * Check if crypto function
     * @private
     */
    _isCryptoFunction(functionName) {
      const cryptoFunctions = [
        'encrypt', 'decrypt', 'hash', 'hmac', 'sha256', 'md5',
        'aes', 'des', 'rsa', 'cipher', 'digest', 'sign', 'verify'
      ];

      const lowerName = functionName.toLowerCase();
      return cryptoFunctions.some(fn => lowerName.includes(fn));
    }

    /**
     * Generate crypto function call
     * @private
     */
    _generateCryptoFunctionCall(functionName, args, options) {
      if (this.currentVariant === 'VBNET') {
        // Map to .NET crypto functions
        const functionMap = {
          'sha256': 'System.Security.Cryptography.SHA256.Create().ComputeHash',
          'md5': 'System.Security.Cryptography.MD5.Create().ComputeHash',
          'aes_encrypt': 'System.Security.Cryptography.AesManaged.CreateEncryptor',
          'aes_decrypt': 'System.Security.Cryptography.AesManaged.CreateDecryptor'
        };

        const mappedFunction = functionMap[functionName.toLowerCase()] || functionName;
        return `${mappedFunction}(${args})`;
      } else {
        return `OpCodes.${functionName}(${args})`;
      }
    }

    /**
     * Map to BASIC function equivalents
     * @private
     */
    _mapToBasicFunction(functionName, options) {
      const functionMap = {
        'console.log': 'Print',
        'alert': 'MsgBox',
        'parseInt': 'CInt',
        'parseFloat': 'CDbl',
        'toString': 'CStr',
        'length': 'Len',
        'substring': 'Mid',
        'toLowerCase': 'LCase',
        'toUpperCase': 'UCase'
      };

      return functionMap[functionName] || this._toBasicName(functionName, options);
    }

    /**
     * Infer type from literal value
     * @private
     */
    _inferTypeFromLiteral(node) {
      if (typeof node.value === 'string') {
        return 'String';
      } else if (typeof node.value === 'number') {
        return Number.isInteger(node.value) ? 'Integer' : 'Double';
      } else if (typeof node.value === 'boolean') {
        return 'Boolean';
      } else if (node.value === null) {
        return 'Object';
      }
      return 'Variant';
    }

    /**
     * Infer type from function call
     * @private
     */
    _inferTypeFromFunctionCall(node, options) {
      const functionName = this._generateNode(node.callee, options).toLowerCase();

      if (functionName.includes('count') || functionName.includes('length')) {
        return 'Integer';
      }
      if (functionName.includes('calculate') || functionName.includes('compute')) {
        return 'Double';
      }
      if (functionName.includes('get') || functionName.includes('find')) {
        return 'String';
      }
      if (functionName.includes('is') || functionName.includes('has')) {
        return 'Boolean';
      }

      return 'Variant';
    }

    /**
     * Check if nested loop for performance warning
     * @private
     */
    _isNestedLoop(node) {
      return this._traverseAST(node.body, n =>
        n.type === 'ForStatement' || n.type === 'WhileStatement' || n.type === 'DoWhileStatement'
      );
    }

    /**
     * Check if string operation
     * @private
     */
    _isStringOperation(node) {
      // Simplified check - in real implementation would need type analysis
      return node.left && node.right &&
             (this._looksLikeString(node.left) || this._looksLikeString(node.right));
    }

    /**
     * Check if node looks like string
     * @private
     */
    _looksLikeString(node) {
      return node.type === 'Literal' && typeof node.value === 'string';
    }

    // Additional missing node generation methods for comprehensive coverage

    /**
     * Generate sequence expression
     * @private
     */
    _generateSequenceExpression(node, options) {
      const expressions = node.expressions.map(expr => this._generateNode(expr, options));
      return expressions.join(': '); // BASIC statement separator
    }

    /**
     * Generate template literal
     * @private
     */
    _generateTemplateLiteral(node, options) {
      let result = '"';
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.raw;
        if (i < node.expressions.length) {
          result += '" + CStr(' + this._generateNode(node.expressions[i], options) + ') + "';
        }
      }
      result += '"';
      return result;
    }

    /**
     * Generate tagged template expression
     * @private
     */
    _generateTaggedTemplateExpression(node, options) {
      const tag = this._generateNode(node.tag, options);
      const quasi = this._generateNode(node.quasi, options);
      return `${tag}(${quasi})`;
    }

    /**
     * Generate rest element
     * @private
     */
    _generateRestElement(node, options) {
      const argument = this._generateNode(node.argument, options);
      return `ParamArray ${argument}`;
    }

    /**
     * Generate spread element
     * @private
     */
    _generateSpreadElement(node, options) {
      const argument = this._generateNode(node.argument, options);
      return `${argument}()`;
    }

    /**
     * Generate assignment pattern
     * @private
     */
    _generateAssignmentPattern(node, options) {
      const left = this._generateNode(node.left, options);
      const right = this._generateNode(node.right, options);
      return `Optional ${left} = ${right}`;
    }

    /**
     * Generate object pattern
     * @private
     */
    _generateObjectPattern(node, options) {
      return this._formatBasicLine(`' Object destructuring not supported in BASIC`, options);
    }

    /**
     * Generate array pattern
     * @private
     */
    _generateArrayPattern(node, options) {
      return this._formatBasicLine(`' Array destructuring not supported in BASIC`, options);
    }

    /**
     * Generate meta property
     * @private
     */
    _generateMetaProperty(node, options) {
      if (node.meta.name === 'new' && node.property.name === 'target') {
        return 'Me.GetType()';
      }
      return `${node.meta.name}.${node.property.name}`;
    }

    /**
     * Generate await expression
     * @private
     */
    _generateAwaitExpression(node, options) {
      const argument = this._generateNode(node.argument, options);
      if (this.currentVariant === 'VBNET') {
        return `Await ${argument}`;
      } else {
        return `' Await not supported: ${argument}`;
      }
    }

    /**
     * Generate yield expression
     * @private
     */
    _generateYieldExpression(node, options) {
      const argument = node.argument ? this._generateNode(node.argument, options) : '';
      return argument ? `Yield ${argument}` : 'Yield';
    }

    /**
     * Generate import declaration
     * @private
     */
    _generateImportDeclaration(node, options) {
      const source = node.source.value;

      if (this.currentVariant === 'VBNET') {
        return this._formatBasicLine(`Imports ${source}`, options);
      } else {
        return this._formatBasicLine(`#Include "${source}"`, options);
      }
    }

    /**
     * Generate export declaration
     * @private
     */
    _generateExportDeclaration(node, options) {
      if (node.declaration) {
        const decl = this._generateNode(node.declaration, options);
        return decl.replace(/^(\s*)/, '$1Public ');
      }
      return '';
    }

    /**
     * Generate class expression
     * @private
     */
    _generateClassExpression(node, options) {
      return this._generateClass(node, options);
    }

    /**
     * Generate property definition
     * @private
     */
    _generatePropertyDefinition(node, options) {
      const key = this._generateNode(node.key, options);
      const value = node.value ? this._generateNode(node.value, options) : 'Nothing';
      const modifier = node.static ? 'Shared ' : '';

      return this._formatBasicLine(`${modifier}Public ${key} As Object = ${value}`, options);
    }

    /**
     * Generate private identifier
     * @private
     */
    _generatePrivateIdentifier(node, options) {
      const name = node.name.substring(1); // Remove # prefix
      return `Private ${this._toBasicName(name, options)}`;
    }

    /**
     * Generate static block
     * @private
     */
    _generateStaticBlock(node, options) {
      let code = this._formatBasicLine('Shared Sub New()', options);
      this.indentLevel++;
      if (node.body) {
        code += this._generateNode(node.body, options);
      }
      this.indentLevel--;
      code += this._formatBasicLine('End Sub', options);
      return code;
    }

    /**
     * Generate chain expression
     * @private
     */
    _generateChainExpression(node, options) {
      return this._generateNode(node.expression, options);
    }

    /**
     * Generate import expression
     * @private
     */
    _generateImportExpression(node, options) {
      const source = this._generateNode(node.source, options);
      return `LoadAssembly(${source})`;
    }

    // Implementation methods for remaining AST node types

    /**
     * Generate assignment operator
     * @private
     */
    _generateAssignmentOperator(node, options) {
      if (!node || !node.operator) return '';
      return this._mapAssignmentOperator(node.operator, options);
    }

    /**
     * Generate binary operator
     * @private
     */
    _generateBinaryOperator(node, options) {
      if (!node || !node.operator) return '';
      return this._mapBinaryOperator(node.operator, options);
    }

    /**
     * Generate logical operator
     * @private
     */
    _generateLogicalOperator(node, options) {
      if (!node || !node.operator) return '';
      return this._mapLogicalOperator(node.operator, options);
    }

    /**
     * Generate unary operator
     * @private
     */
    _generateUnaryOperator(node, options) {
      if (!node || !node.operator) return '';
      return this._mapUnaryOperator(node.operator, options);
    }

    /**
     * Generate update operator
     * @private
     */
    _generateUpdateOperator(node, options) {
      if (!node || !node.operator) return '';

      if (node.operator === '++') {
        return '+ 1';
      } else if (node.operator === '--') {
        return '- 1';
      }

      return node.operator;
    }

    /**
     * Generate source location information (used for debugging)
     * @private
     */
    _generateSourceLocation(node, options) {
      if (!node || !options.addComments) return '';

      if (node.start && node.end) {
        return this._formatBasicLine(`' Source: line ${node.start.line}-${node.end.line}`, options);
      }

      return '';
    }

    /**
     * Generate position information (used for debugging)
     * @private
     */
    _generatePosition(node, options) {
      if (!node || !options.addComments) return '';

      if (node.line && node.column) {
        return this._formatBasicLine(`' Position: ${node.line}:${node.column}`, options);
      }

      return '';
    }

    // ==================== COMPLETE PROGRAM GENERATORS ====================

    /**
     * Generate complete VB.NET program with proper project structure
     * @private
     */
    _generateVBNetCompleteProgram(code, options) {
      let program = '';

      // Header comments
      program += "' VB.NET Generated Program\n";
      program += `' Generated: ${new Date().toISOString()}\n`;
      program += "' This file contains a complete, compilable VB.NET program\n\n";

      // Imports
      program += "Imports System\n";
      program += "Imports System.Collections.Generic\n";
      program += "Imports System.Linq\n";
      if (this.cryptoOperations.size > 0) {
        program += "Imports System.Security.Cryptography\n";
        program += "Imports System.Text\n";
      }
      program += "\n";

      // Namespace
      program += `Namespace ${options.packageName || 'GeneratedProgram'}\n`;

      // Main Module
      program += "    ''' <summary>\n";
      program += "    ''' Main program module\n";
      program += "    ''' </summary>\n";
      program += "    Module Program\n\n";

      // Main Sub
      program += "        ''' <summary>\n";
      program += "        ''' Main entry point\n";
      program += "        ''' </summary>\n";
      program += "        ''' <param name=\"args\">Command line arguments</param>\n";
      program += "        Sub Main(args As String())\n";
      program += "            Console.WriteLine(\"Generated VB.NET Program\")\n";
      program += "            Console.WriteLine(\"Demonstrating generated cryptographic functions\")\n";
      program += "            Console.WriteLine()\n\n";

      // Example usage
      program += "            ' Example usage of generated functions\n";
      program += "            Try\n";
      program += "                Dim testData As Byte() = {&H01, &H02, &H03, &H04}\n";
      program += "                Dim testKey As Byte() = {&HAA, &HBB, &HCC, &HDD}\n";
      program += "                \n";
      program += "                Console.WriteLine(\"Input data: \" & BitConverter.ToString(testData))\n";
      program += "                Console.WriteLine(\"Key: \" & BitConverter.ToString(testKey))\n";
      program += "                \n";
      program += "                ' Call generated encrypt function if available\n";
      if (this._hasEncryptFunction(code)) {
        program += "                Dim encrypted = Encrypt(testData, testKey)\n";
        program += "                Console.WriteLine(\"Encrypted: \" & encrypted.ToString())\n";
      }
      program += "                \n";
      program += "            Catch ex As Exception\n";
      program += "                Console.WriteLine(\"Error: \" & ex.Message)\n";
      program += "            End Try\n\n";

      program += "            Console.WriteLine(\"Press any key to exit...\")\n";
      program += "            Console.ReadKey()\n";
      program += "        End Sub\n\n";

      // Add the generated code (indented properly)
      const indentedCode = code.split('\n').map(line =>
        line.trim() ? '        ' + line : line
      ).join('\n');
      program += indentedCode + "\n\n";

      // OpCodes if needed
      if (this.requiresOpCodes) {
        program += this._generateVBNetOpCodesClass(options);
      }

      // Close Module and Namespace
      program += "    End Module\n";
      program += "End Namespace\n";

      return program;
    }

    /**
     * Generate VB.NET project files
     * @private
     */
    _generateVBNetProjectFiles(options) {
      const projectName = options.packageName || 'GeneratedProgram';

      // .vbproj file
      const vbprojContent = `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net6.0</TargetFramework>
    <RootNamespace>${projectName}</RootNamespace>
    <AssemblyName>${projectName}</AssemblyName>
    <GenerateAssemblyInfo>false</GenerateAssemblyInfo>
  </PropertyGroup>

  <ItemGroup>
    <Reference Include="System" />
    <Reference Include="System.Core" />
    <Reference Include="System.Security.Cryptography" />
  </ItemGroup>

</Project>`;

      // README file
      const readmeContent = `# ${projectName}

Generated VB.NET program containing cryptographic functions.

## Building

\`\`\`bash
dotnet build
\`\`\`

## Running

\`\`\`bash
dotnet run
\`\`\`

## Requirements

- .NET 6.0 or later
- Visual Studio 2022 or Visual Studio Code with VB.NET extension

## Generated Files

- \`${projectName}.vb\` - Main program file
- \`${projectName}.vbproj\` - Project file
- \`README.md\` - This file

## Features

${this.cryptoOperations.size > 0 ? '- Cryptographic operations using System.Security.Cryptography' : '- Basic BASIC-to-VB.NET converted functions'}
- Complete compilable program structure
- Error handling with Try/Catch blocks
- Console output for testing

## Notes

This code was automatically generated from JavaScript AST and may require manual optimization for production use.
`;

      // Build script
      const buildScriptContent = `@echo off
echo Building ${projectName}...
dotnet build
if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)
echo Build successful!
echo.
echo To run: dotnet run
pause
`;

      this.projectFiles.set(`${projectName}.vbproj`, vbprojContent);
      this.projectFiles.set('README.md', readmeContent);
      this.projectFiles.set('build.bat', buildScriptContent);
    }

    /**
     * Generate complete QB64 program
     * @private
     */
    _generateQB64CompleteProgram(code, options) {
      let program = '';

      // Header
      program += "' QB64 Generated Program\n";
      program += `' Generated: ${new Date().toISOString()}\n`;
      program += "' Complete QB64 program with example usage\n";
      program += "'\n";
      program += "' To run: Load this file in QB64 and press F5\n\n";

      // Screen setup
      program += "SCREEN _NEWIMAGE(800, 600, 32)\n";
      program += "_TITLE \"Generated Cryptographic Program\"\n";
      program += "CLS\n\n";

      // OpCodes includes if needed
      if (this.requiresOpCodes) {
        program += "'$INCLUDE:'opcodes.bm'\n\n";
      }

      // Main program
      program += "' Main Program\n";
      program += "PRINT \"QB64 Generated Cryptographic Program\"\n";
      program += "PRINT \"=====================================\"\n";
      program += "PRINT\n\n";

      // Example data
      program += "' Example test data\n";
      program += "DIM TestData(3) AS INTEGER\n";
      program += "DIM TestKey(3) AS INTEGER\n";
      program += "TestData(0) = 1: TestData(1) = 2: TestData(2) = 3: TestData(3) = 4\n";
      program += "TestKey(0) = 170: TestKey(1) = 187: TestKey(2) = 204: TestKey(3) = 221\n\n";

      program += "PRINT \"Input Data: \";\n";
      program += "FOR I = 0 TO 3\n";
      program += "    PRINT HEX$(TestData(I)); \" \";\n";
      program += "NEXT I\n";
      program += "PRINT\n\n";

      program += "PRINT \"Key: \";\n";
      program += "FOR I = 0 TO 3\n";
      program += "    PRINT HEX$(TestKey(I)); \" \";\n";
      program += "NEXT I\n";
      program += "PRINT\n\n";

      // Add generated functions (convert to QB64 syntax)
      const qb64Code = this._convertToQB64Syntax(code);
      program += "' Generated Functions\n";
      program += qb64Code + "\n\n";

      // Call functions if available
      if (this._hasEncryptFunction(code)) {
        program += "' Test the encryption function\n";
        program += "Result = ENCRYPT%(TestData(0), TestKey(0))\n";
        program += "PRINT \"Encrypted result: \"; Result\n";
        program += "PRINT\n\n";
      }

      // End program
      program += "PRINT \"Press any key to exit...\"\n";
      program += "k$ = INPUT$(1)\n";
      program += "END\n\n";

      // Add subroutines/functions at the end
      if (this.requiresOpCodes) {
        program += this._generateQB64OpCodes(options);
      }

      return program;
    }

    /**
     * Generate QB64 project files
     * @private
     */
    _generateQB64ProjectFiles(options) {
      const projectName = options.packageName || 'GeneratedProgram';

      // README
      const readmeContent = `# ${projectName} - QB64 Program

Generated QB64 program containing cryptographic functions.

## Requirements

- QB64 version 2.0 or later
- Download from: https://qb64.org/

## Running

1. Open QB64 IDE
2. Load \`${projectName}.bas\`
3. Press F5 to run

## Features

- Complete QB64 program structure
- Graphics window setup
- Example data and testing
- Error-safe programming practices

## Files

- \`${projectName}.bas\` - Main QB64 program
- \`README.md\` - This file
- \`run.bat\` - Batch file to compile and run

## Notes

This code was automatically generated from JavaScript AST. QB64 syntax may need manual adjustment for complex operations.

## Compilation

QB64 can compile to standalone executable:
1. In QB64 IDE: Run > Make EXE Only
2. Or use command line: \`qb64 -c ${projectName}.bas\`
`;

      // Run script
      const runScriptContent = `@echo off
echo Starting QB64 program: ${projectName}
echo.
echo Make sure QB64 is installed and in your PATH
echo.
qb64 -c -x "${projectName}.bas"
if exist "${projectName}.exe" (
    echo Compilation successful!
    echo Running program...
    "${projectName}.exe"
) else (
    echo Compilation failed or QB64 not found
    echo Please open ${projectName}.bas in QB64 IDE manually
)
pause
`;

      this.projectFiles.set('README.md', readmeContent);
      this.projectFiles.set('run.bat', runScriptContent);
    }

    /**
     * Generate complete PureBASIC program
     * @private
     */
    _generatePureBASICCompleteProgram(code, options) {
      let program = '';

      // Header
      program += "; PureBASIC Generated Program\n";
      program += `; Generated: ${new Date().toISOString()}\n`;
      program += "; Complete PureBASIC program ready for compilation\n\n";

      // Includes
      if (this.requiresOpCodes) {
        program += "IncludeFile \"opcodes.pbi\"\n\n";
      }

      // Procedures section
      program += "; Generated Procedures\n";
      program += "; ====================\n\n";

      // Convert generated code to PureBASIC syntax
      const pureBasicCode = this._convertToPureBASICSyntax(code);
      program += pureBasicCode + "\n\n";

      // Main program
      program += "; Main Program\n";
      program += "; ============\n\n";

      program += "If OpenConsole()\n";
      program += "  PrintN(\"PureBASIC Generated Cryptographic Program\")\n";
      program += "  PrintN(\"=========================================\")\n";
      program += "  PrintN(\"\")\n\n";

      // Example usage
      program += "  ; Example test data\n";
      program += "  Dim TestData.a(3)\n";
      program += "  Dim TestKey.a(3)\n";
      program += "  TestData(0) = 1 : TestData(1) = 2 : TestData(2) = 3 : TestData(3) = 4\n";
      program += "  TestKey(0) = 170 : TestKey(1) = 187 : TestKey(2) = 204 : TestKey(3) = 221\n\n";

      program += "  Print(\"Input Data: \")\n";
      program += "  For i = 0 To 3\n";
      program += "    Print(Hex(TestData(i)) + \" \")\n";
      program += "  Next i\n";
      program += "  PrintN(\"\")\n\n";

      if (this._hasEncryptFunction(code)) {
        program += "  ; Test encryption function\n";
        program += "  Result = encrypt(TestData(0), TestKey(0))\n";
        program += "  PrintN(\"Encrypted result: \" + Str(Result))\n";
        program += "  PrintN(\"\")\n\n";
      }

      program += "  PrintN(\"Press Enter to exit...\")\n";
      program += "  Input()\n";
      program += "EndIf\n\n";

      if (this.requiresOpCodes) {
        program += this._generatePureBASICOpCodes(options);
      }

      return program;
    }

    /**
     * Generate PureBASIC project files
     * @private
     */
    _generatePureBASICProjectFiles(options) {
      const projectName = options.packageName || 'GeneratedProgram';

      // Project file (.pbp)
      const projectContent = `<?xml version="1.0" encoding="UTF-8"?>

<project xmlns="http://www.purebasic.com/namespace" version="1.0" creator="PureBasic 6.00 LTS">
  <section name="config">
    <options closefiles="1" openmode="0" name="${projectName}"/>
  </section>
  <section name="data">
    <explorer view="" pattern="0"/>
    <log show="1"/>
    <lastopen date="2025-10-18 00:00" user="" host=""/>
  </section>
  <section name="files">
    <file name="${projectName}.pb">
      <config load="0" scan="1" panel="1" warn="1" lastopen="1" sortindex="1" panelstate="+"/>
      <fingerprint md5=""/>
    </file>
  </section>
  <section name="targets">
    <target name="Default Target" enabled="1" default="1">
      <inputfile value="${projectName}.pb"/>
      <outputfile value="${projectName}.exe"/>
      <compiler version="PureBasic 6.00 LTS"/>
      <executable value="${projectName}.exe"/>
      <options xpskin="1" debug="1"/>
    </target>
  </section>
</project>`;

      // README
      const readmeContent = `# ${projectName} - PureBASIC Program

Generated PureBASIC program containing cryptographic functions.

## Requirements

- PureBASIC 6.0 LTS or later
- Download from: https://www.purebasic.com/

## Building

### Using PureBASIC IDE
1. Open \`${projectName}.pbp\` in PureBASIC IDE
2. Press F5 to compile and run
3. Or press F7 to compile only

### Command Line
\`\`\`bash
pbcompiler "${projectName}.pb"
\`\`\`

## Files

- \`${projectName}.pb\` - Main PureBASIC source
- \`${projectName}.pbp\` - PureBASIC project file
- \`README.md\` - This file
- \`compile.bat\` - Windows compilation script

## Features

- Native compiled executable
- Console-based user interface
- Example cryptographic operations
- Optimized for speed and size

## Notes

PureBASIC generates very fast native code. This program is ready for distribution as a standalone executable.
`;

      // Compile script
      const compileScriptContent = `@echo off
echo Compiling ${projectName} with PureBASIC...
echo.

if exist "pbcompiler.exe" (
    pbcompiler "${projectName}.pb"
) else (
    echo PureBASIC compiler not found in current directory
    echo Please ensure PureBASIC is installed and pbcompiler.exe is in PATH
    echo Or open ${projectName}.pbp in PureBASIC IDE
)

if exist "${projectName}.exe" (
    echo.
    echo Compilation successful!
    echo Running program...
    "${projectName}.exe"
) else (
    echo.
    echo Compilation failed. Check for errors above.
)

pause
`;

      this.projectFiles.set(`${projectName}.pbp`, projectContent);
      this.projectFiles.set('README.md', readmeContent);
      this.projectFiles.set('compile.bat', compileScriptContent);
    }

    /**
     * Generate complete FreeBASIC program (integrates with existing freebasic.js)
     * @private
     */
    _generateFreeBASICCompleteProgram(code, options) {
      let program = '';

      // Header
      program += "' FreeBASIC Generated Program\n";
      program += `' Generated: ${new Date().toISOString()}\n`;
      program += "' Complete FreeBASIC program with full language features\n\n";

      // Includes
      if (this.requiresOpCodes) {
        program += "#Include \"opcodes.bi\"\n\n";
      }

      // Using statements for namespaces
      if (options.useModules) {
        program += `Using ${options.packageName || 'GeneratedProgram'}\n\n`;
      }

      // Add generated code
      program += "' Generated Procedures and Functions\n";
      program += "' ==================================\n\n";
      program += code + "\n\n";

      // Main program
      program += "' Main Program\n";
      program += "' ============\n\n";

      program += "Sub Main()\n";
      program += "    Print \"FreeBASIC Generated Cryptographic Program\"\n";
      program += "    Print \"===========================================\"\n";
      program += "    Print \"\"\n\n";

      // Example usage
      program += "    ' Example test data\n";
      program += "    Dim TestData(0 To 3) As UByte => {1, 2, 3, 4}\n";
      program += "    Dim TestKey(0 To 3) As UByte => {170, 187, 204, 221}\n\n";

      program += "    Print \"Input Data: \";\n";
      program += "    For i As Integer = 0 To 3\n";
      program += "        Print Hex(TestData(i)) & \" \";\n";
      program += "    Next i\n";
      program += "    Print \"\"\n\n";

      if (this._hasEncryptFunction(code)) {
        program += "    ' Test encryption function\n";
        program += "    Dim Result As Integer = encrypt(TestData(0), TestKey(0))\n";
        program += "    Print \"Encrypted result: \" & Result\n";
        program += "    Print \"\"\n\n";
      }

      program += "    Print \"Press any key to exit...\"\n";
      program += "    Sleep\n";
      program += "End Sub\n\n";

      // Call main
      program += "' Program entry point\n";
      program += "Main()\n";

      return program;
    }

    /**
     * Generate FreeBASIC project files
     * @private
     */
    _generateFreeBASICProjectFiles(options) {
      const projectName = options.packageName || 'GeneratedProgram';

      // Makefile
      const makefileContent = `# FreeBASIC Makefile for ${projectName}

COMPILER = fbc
SOURCE = ${projectName}.bas
TARGET = ${projectName}
CFLAGS = -w all -exx

# Default target
all: \$(TARGET)

# Compile the program
\$(TARGET): \$(SOURCE)
\t\$(COMPILER) \$(CFLAGS) \$(SOURCE) -x \$(TARGET)

# Clean build artifacts
clean:
\tif exist \$(TARGET).exe del \$(TARGET).exe
\tif exist \$(TARGET) del \$(TARGET)

# Run the program
run: \$(TARGET)
\t./\$(TARGET)

# Install FreeBASIC (Windows)
install-fbc:
\t@echo Download FreeBASIC from https://www.freebasic.net/
\t@echo Extract and add to PATH

.PHONY: all clean run install-fbc
`;

      // README
      const readmeContent = `# ${projectName} - FreeBASIC Program

Generated FreeBASIC program with modern BASIC features and cryptographic functions.

## Requirements

- FreeBASIC 1.09.0 or later
- Download from: https://www.freebasic.net/

## Building

### Using Make (recommended)
\`\`\`bash
make
\`\`\`

### Manual compilation
\`\`\`bash
fbc -w all -exx ${projectName}.bas -x ${projectName}
\`\`\`

### Windows batch file
\`\`\`bash
compile.bat
\`\`\`

## Running

\`\`\`bash
make run
# or
./${projectName}
\`\`\`

## Features

- Modern BASIC syntax with strong typing
- Exception handling (if enabled)
- Namespace support
- Object-oriented programming features
- Native compilation to optimized executable

## Files

- \`${projectName}.bas\` - Main FreeBASIC source
- \`Makefile\` - Build configuration
- \`compile.bat\` - Windows compilation script
- \`README.md\` - This file

## Development

FreeBASIC supports:
- Modern programming constructs
- Inline assembly
- C library integration
- Cross-platform compilation

## Notes

This code was generated from JavaScript AST and uses FreeBASIC's advanced features for optimal performance and maintainability.
`;

      // Compile script for Windows
      const compileScriptContent = `@echo off
setlocal enabledelayedexpansion

echo FreeBASIC Compilation Script for ${projectName}
echo ===============================================
echo.

REM Check if FreeBASIC compiler is available
fbc -version > nul 2>&1
if errorlevel 1 (
    echo ERROR: FreeBASIC compiler 'fbc' not found!
    echo.
    echo Please:
    echo 1. Download FreeBASIC from https://www.freebasic.net/
    echo 2. Install it
    echo 3. Add FreeBASIC bin directory to your PATH
    echo.
    pause
    exit /b 1
)

echo FreeBASIC compiler found. Compiling...
echo.

REM Compile with error checking and warnings
fbc -w all -exx "${projectName}.bas" -x "${projectName}.exe"

if errorlevel 1 (
    echo.
    echo Compilation FAILED! Check errors above.
    pause
    exit /b 1
)

echo.
echo Compilation SUCCESSFUL!
echo Generated: ${projectName}.exe
echo.

REM Ask user if they want to run the program
set /p choice="Run the program now? (y/n): "
if /i "!choice!"=="y" (
    echo.
    echo Running ${projectName}.exe...
    echo.
    "${projectName}.exe"
)

pause
`;

      this.projectFiles.set('Makefile', makefileContent);
      this.projectFiles.set('README.md', readmeContent);
      this.projectFiles.set('compile.bat', compileScriptContent);
    }

    /**
     * Generate complete True BASIC educational program
     * @private
     */
    _generateTrueBASICCompleteProgram(code, options) {
      let program = '';

      // True BASIC follows strict structured programming
      program += "! True BASIC Generated Program\n";
      program += `! Generated: ${new Date().toISOString()}\n`;
      program += "! Educational cryptographic programming example\n";
      program += "! Follows True BASIC structured programming principles\n\n";

      // Program section
      program += "PROGRAM CryptographicExample\n\n";

      // External procedures (if any)
      if (this.requiresOpCodes) {
        program += "EXTERNAL\n";
        program += "LIBRARY \"opcodes.tru\"\n";
        program += "END EXTERNAL\n\n";
      }

      // Add generated procedures (converted to True BASIC)
      const truBasicCode = this._convertToTrueBASICSyntax(code);
      program += truBasicCode + "\n\n";

      // Main program logic
      program += "! Main program execution\n";
      program += "PRINT \"True BASIC Cryptographic Learning Program\"\n";
      program += "PRINT \"===========================================\"\n";
      program += "PRINT\n\n";

      // Educational explanation
      program += "PRINT \"This program demonstrates cryptographic concepts:\"\n";
      program += "PRINT \"1. Data encryption algorithms\"\n";
      program += "PRINT \"2. Key-based transformations\"\n";
      program += "PRINT \"3. Structured programming in BASIC\"\n";
      program += "PRINT\n\n";

      // Interactive example
      program += "! Interactive demonstration\n";
      program += "DIM TestData(1 TO 4)\n";
      program += "DIM TestKey(1 TO 4)\n";
      program += "MAT READ TestData\n";
      program += "MAT READ TestKey\n\n";

      program += "DATA 1, 2, 3, 4\n";
      program += "DATA 170, 187, 204, 221\n\n";

      program += "PRINT \"Input data values:\"\n";
      program += "FOR I = 1 TO 4\n";
      program += "    PRINT USING \"##\": TestData(I);\n";
      program += "NEXT I\n";
      program += "PRINT\n\n";

      if (this._hasEncryptFunction(code)) {
        program += "! Demonstrate encryption\n";
        program += "CALL Encrypt(TestData(1), TestKey(1), Result)\n";
        program += "PRINT \"Encrypted result:\"; Result\n";
        program += "PRINT\n\n";
      }

      program += "PRINT \"Press Enter to continue...\"\n";
      program += "INPUT Dummy$\n\n";

      program += "END\n";

      return program;
    }

    /**
     * Generate True BASIC project files
     * @private
     */
    _generateTrueBASICProjectFiles(options) {
      const projectName = options.packageName || 'GeneratedProgram';

      // True BASIC uses .tru extension
      const readmeContent = `# ${projectName} - True BASIC Educational Program

Generated True BASIC program for learning cryptographic programming concepts.

## Requirements

- True BASIC version 6.0 or later
- Download from: https://www.truebasic.com/

## Running

1. Open True BASIC environment
2. Load \`${projectName}.tru\`
3. Press F5 or select Run > Start

## Educational Objectives

This program demonstrates:
- Structured programming with True BASIC
- Cryptographic algorithm concepts
- Data transformation techniques
- Interactive programming

## Files

- \`${projectName}.tru\` - Main True BASIC program
- \`README.md\` - This file
- \`lesson_plan.txt\` - Educational lesson plan

## True BASIC Features Used

- Structured programming (PROGRAM...END)
- Subroutines and functions
- Array processing (MAT operations)
- Formatted output (PRINT USING)
- Interactive input/output

## Learning Path

1. Study the program structure
2. Understand data flow
3. Experiment with different input values
4. Modify algorithms to see effects
5. Add error checking and validation

## Notes

True BASIC emphasizes clarity and correctness. This program serves as an educational tool for understanding both programming concepts and cryptographic principles.
`;

      // Lesson plan
      const lessonPlan = `True BASIC Cryptographic Programming Lesson Plan
===============================================

Objective: Learn structured programming and cryptographic concepts using True BASIC

Duration: 60 minutes

Prerequisites:
- Basic understanding of BASIC programming
- Elementary mathematics knowledge

Lesson Structure:

1. Introduction (10 minutes)
   - What is True BASIC?
   - Structured programming principles
   - Overview of cryptography

2. Program Analysis (20 minutes)
   - Examine program structure
   - Identify main components:
     * Data declaration
     * Algorithm implementation
     * User interaction
     * Output formatting

3. Hands-on Exploration (20 minutes)
   - Run the program
   - Try different input values
   - Observe output patterns
   - Discuss what makes encryption secure

4. Code Modification (10 minutes)
   - Modify the encryption algorithm
   - Add input validation
   - Enhance output formatting
   - Test error conditions

Learning Outcomes:
- Understand structured programming concepts
- Learn basic cryptographic principles
- Practice debugging and testing
- Develop problem-solving skills

Extensions:
- Implement additional encryption algorithms
- Add file input/output
- Create graphical visualizations
- Research historical ciphers

Assessment:
- Can student explain program flow?
- Can student modify the algorithm?
- Does student understand security concepts?
- Can student debug simple errors?
`;

      this.projectFiles.set('README.md', readmeContent);
      this.projectFiles.set('lesson_plan.txt', lessonPlan);
    }

    /**
     * Generate complete Liberty BASIC program with GUI
     * @private
     */
    _generateLibertyBASICCompleteProgram(code, options) {
      let program = '';

      // Liberty BASIC header
      program += "' Liberty BASIC Generated Program\n";
      program += `' Generated: ${new Date().toISOString()}\n`;
      program += "' Windows GUI application with cryptographic functions\n\n";

      // Window setup
      program += "WindowWidth = 600\n";
      program += "WindowHeight = 500\n";
      program += "UpperLeftX = 100\n";
      program += "UpperLeftY = 100\n\n";

      // GUI definition
      program += "STATICTEXT #main.title, \"Cryptographic Function Tester\", 10, 10, 300, 25\n";
      program += "STATICTEXT #main.inputLabel, \"Input Data (hex):\", 10, 50, 100, 20\n";
      program += "TEXTBOX #main.inputData, 120, 50, 200, 25\n";
      program += "STATICTEXT #main.keyLabel, \"Key (hex):\", 10, 85, 100, 20\n";
      program += "TEXTBOX #main.keyData, 120, 85, 200, 25\n";
      program += "BUTTON #main.encrypt, \"Encrypt\", [encrypt], UL, 10, 120, 80, 30\n";
      program += "BUTTON #main.decrypt, \"Decrypt\", [decrypt], UL, 100, 120, 80, 30\n";
      program += "STATICTEXT #main.resultLabel, \"Result:\", 10, 165, 100, 20\n";
      program += "TEXTBOX #main.result, 120, 165, 300, 25\n";
      program += "TEXTEDITOR #main.log, 10, 200, 500, 200\n";
      program += "BUTTON #main.clear, \"Clear Log\", [clearLog], UL, 10, 410, 80, 30\n";
      program += "BUTTON #main.exit, \"Exit\", [exit], UL, 450, 410, 80, 30\n\n";

      // Open main window
      program += "OPEN \"Cryptographic Tester\" FOR WINDOW AS #main\n\n";

      // Initialize
      program += "#main.inputData \"01020304\"\n";
      program += "#main.keyData \"AABBCCDD\"\n";
      program += "#main.log \"\\r\\nCryptographic Function Tester Ready\\r\\n\"\n";
      program += "#main.log \"Enter hex data and key, then click Encrypt or Decrypt\\r\\n\\r\\n\"\n\n";

      // Wait for events
      program += "WAIT\n\n";

      // Event handlers
      program += "[encrypt]\n";
      program += "    #main.inputData \"?\", inputHex$\n";
      program += "    #main.keyData \"?\", keyHex$\n";
      program += "    \n";
      program += "    ' Convert hex strings to numbers\n";
      program += "    inputVal = HexDec(inputHex$)\n";
      program += "    keyVal = HexDec(keyHex$)\n";
      program += "    \n";
      if (this._hasEncryptFunction(code)) {
        program += "    ' Call generated encrypt function\n";
        program += "    result = encrypt(inputVal, keyVal)\n";
      } else {
        program += "    ' Simple XOR encryption as example\n";
        program += "    result = inputVal XOR keyVal\n";
      }
      program += "    \n";
      program += "    resultHex$ = Hex$(result)\n";
      program += "    #main.result resultHex$\n";
      program += "    \n";
      program += "    logEntry$ = \"Encrypted \" + inputHex$ + \" with key \" + keyHex$ + \" = \" + resultHex$ + \"\\r\\n\"\n";
      program += "    #main.log \"!append?\"; logEntry$\n";
      program += "    WAIT\n\n";

      program += "[decrypt]\n";
      program += "    #main.inputData \"?\", inputHex$\n";
      program += "    #main.keyData \"?\", keyHex$\n";
      program += "    \n";
      program += "    inputVal = HexDec(inputHex$)\n";
      program += "    keyVal = HexDec(keyHex$)\n";
      program += "    \n";
      program += "    ' For demonstration, use same function (XOR is symmetric)\n";
      program += "    result = inputVal XOR keyVal\n";
      program += "    \n";
      program += "    resultHex$ = Hex$(result)\n";
      program += "    #main.result resultHex$\n";
      program += "    \n";
      program += "    logEntry$ = \"Decrypted \" + inputHex$ + \" with key \" + keyHex$ + \" = \" + resultHex$ + \"\\r\\n\"\n";
      program += "    #main.log \"!append?\"; logEntry$\n";
      program += "    WAIT\n\n";

      program += "[clearLog]\n";
      program += "    #main.log \"\"\n";
      program += "    #main.log \"Log cleared\\r\\n\"\n";
      program += "    WAIT\n\n";

      program += "[exit]\n";
      program += "    CLOSE #main\n";
      program += "    END\n\n";

      // Utility functions
      program += "FUNCTION HexDec(hex$)\n";
      program += "    ' Convert hex string to decimal\n";
      program += "    result = 0\n";
      program += "    FOR i = 1 TO LEN(hex$)\n";
      program += "        char$ = MID$(hex$, i, 1)\n";
      program += "        IF char$ >= \"0\" AND char$ <= \"9\" THEN\n";
      program += "            digit = ASC(char$) - ASC(\"0\")\n";
      program += "        ELSE\n";
      program += "            digit = ASC(UPPER$(char$)) - ASC(\"A\") + 10\n";
      program += "        END IF\n";
      program += "        result = result * 16 + digit\n";
      program += "    NEXT i\n";
      program += "    HexDec = result\n";
      program += "END FUNCTION\n\n";

      // Add generated functions (converted to Liberty BASIC syntax)
      const libertyCode = this._convertToLibertyBASICSyntax(code);
      program += libertyCode;

      return program;
    }

    /**
     * Generate Liberty BASIC project files
     * @private
     */
    _generateLibertyBASICProjectFiles(options) {
      const projectName = options.packageName || 'GeneratedProgram';

      const readmeContent = `# ${projectName} - Liberty BASIC GUI Program

Generated Liberty BASIC program with Windows GUI for testing cryptographic functions.

## Requirements

- Liberty BASIC 4.5.1 or later
- Windows operating system
- Download from: http://www.libertybasic.com/

## Running

1. Open Liberty BASIC IDE
2. Load \`${projectName}.bas\`
3. Press F5 to run

## Features

- Windows GUI interface
- Hex input/output for cryptographic data
- Real-time encryption/decryption testing
- Activity log for tracking operations
- Easy-to-use point-and-click interface

## GUI Components

- Input fields for data and key (hex format)
- Encrypt/Decrypt buttons
- Result display area
- Scrollable log window
- Clear and Exit buttons

## Usage

1. Enter hex data (e.g., "01020304")
2. Enter hex key (e.g., "AABBCCDD")
3. Click "Encrypt" to encrypt data
4. Click "Decrypt" to decrypt data
5. View results in hex format
6. Check log for operation history

## Files

- \`${projectName}.bas\` - Main Liberty BASIC program
- \`README.md\` - This file
- \`icon.ico\` - Program icon (optional)

## Customization

Liberty BASIC allows easy GUI customization:
- Modify window layout
- Add new controls
- Change colors and fonts
- Add menu systems
- Include bitmap graphics

## Distribution

Liberty BASIC can create standalone Windows executables for distribution without requiring Liberty BASIC installation on target systems.
`;

      this.projectFiles.set('README.md', readmeContent);
    }

    /**
     * Generate complete PowerBASIC program
     * @private
     */
    _generatePowerBASICCompleteProgram(code, options) {
      let program = '';

      // PowerBASIC header
      program += "' PowerBASIC Generated Program\n";
      program += `' Generated: ${new Date().toISOString()}\n`;
      program += "' High-performance compiled BASIC for Windows\n\n";

      // Compiler directives
      program += "#COMPILE EXE\n";
      program += "#DIM ALL\n";
      program += "#OPTIMIZE ON\n";
      program += "#INCLUDE \"WIN32API.INC\"\n\n";

      // Generated functions
      const powerBasicCode = this._convertToPowerBASICSyntax(code);
      program += powerBasicCode + "\n\n";

      // Main function
      program += "FUNCTION PBMAIN() AS LONG\n";
      program += "    LOCAL result AS LONG\n";
      program += "    LOCAL testData AS LONG\n";
      program += "    LOCAL testKey AS LONG\n\n";

      program += "    ' PowerBASIC Cryptographic Performance Test\n";
      program += "    STDOUT \"PowerBASIC Generated Cryptographic Program\" & $CRLF\n";
      program += "    STDOUT \"==========================================\" & $CRLF\n";
      program += "    STDOUT $CRLF\n\n";

      program += "    testData = &H01020304\n";
      program += "    testKey = &HAABBCCDD\n\n";

      program += "    STDOUT \"Input Data: \" & HEX$(testData) & $CRLF\n";
      program += "    STDOUT \"Key: \" & HEX$(testKey) & $CRLF\n";
      program += "    STDOUT $CRLF\n\n";

      if (this._hasEncryptFunction(code)) {
        program += "    ' Performance timing\n";
        program += "    LOCAL startTime AS QUAD\n";
        program += "    LOCAL endTime AS QUAD\n";
        program += "    LOCAL frequency AS QUAD\n";
        program += "    LOCAL iterations AS LONG\n\n";

        program += "    QueryPerformanceFrequency frequency\n";
        program += "    iterations = 1000000  ' One million iterations\n\n";

        program += "    STDOUT \"Performing \" & STR$(iterations) & \" encryption operations...\" & $CRLF\n";
        program += "    QueryPerformanceCounter startTime\n\n";

        program += "    FOR LOCAL i AS LONG = 1 TO iterations\n";
        program += "        result = encrypt(testData, testKey)\n";
        program += "    NEXT i\n\n";

        program += "    QueryPerformanceCounter endTime\n";
        program += "    LOCAL elapsed AS DOUBLE\n";
        program += "    elapsed = (endTime - startTime) / frequency\n\n";

        program += "    STDOUT \"Result: \" & HEX$(result) & $CRLF\n";
        program += "    STDOUT \"Elapsed time: \" & FORMAT$(elapsed, \"0.000000\") & \" seconds\" & $CRLF\n";
        program += "    STDOUT \"Operations per second: \" & FORMAT$(iterations / elapsed, \"0\") & $CRLF\n";
      }

      program += "    STDOUT $CRLF\n";
      program += "    STDOUT \"Press any key to exit...\" & $CRLF\n";
      program += "    WAITKEY$\n\n";

      program += "    FUNCTION = 0\n";
      program += "END FUNCTION\n";

      return program;
    }

    /**
     * Generate PowerBASIC project files
     * @private
     */
    _generatePowerBASICProjectFiles(options) {
      const projectName = options.packageName || 'GeneratedProgram';

      const readmeContent = `# ${projectName} - PowerBASIC High-Performance Program

Generated PowerBASIC program optimized for maximum performance in cryptographic operations.

## Requirements

- PowerBASIC Console Compiler (PB/CC) or PowerBASIC for Windows (PB/WIN)
- Windows operating system
- Commercial license from PowerBASIC Inc.

## Building

### Using PowerBASIC IDE
1. Open \`${projectName}.bas\` in PowerBASIC IDE
2. Press F9 to compile
3. Press F5 to run

### Command Line Compilation
\`\`\`
PBCC "${projectName}.bas"
\`\`\`

## Performance Features

- Compiled to optimized native machine code
- Direct Windows API access
- High-precision timing for performance measurement
- Million-operation benchmarking
- Minimal runtime overhead

## Features

- Performance benchmarking of cryptographic operations
- High-precision timing measurements
- Optimized loops for speed testing
- Native Windows console application
- Zero external dependencies

## Files

- \`${projectName}.bas\` - Main PowerBASIC source
- \`README.md\` - This file
- \`compile.bat\` - Compilation script

## Performance Notes

PowerBASIC generates some of the fastest BASIC code available:
- Direct compilation to optimized assembly
- Aggressive optimization options
- Minimal overhead compared to interpreted BASIC
- Professional-grade compiler optimizations

## Benchmark Results

The program includes built-in performance testing:
- Times cryptographic operations
- Measures operations per second
- Provides detailed performance metrics
- Suitable for algorithm comparison

## Commercial Use

PowerBASIC is a commercial product. Ensure proper licensing for:
- Development use
- Distribution rights
- Commercial applications
- Source code redistribution
`;

      const compileScript = `@echo off
echo PowerBASIC Compilation for ${projectName}
echo ========================================
echo.

REM Check for PowerBASIC Console Compiler
if exist "PBCC.EXE" (
    echo Found PowerBASIC Console Compiler
    PBCC "${projectName}.bas"
) else if exist "C:\\PowerBASIC\\PBCC\\PBCC.EXE" (
    echo Using PowerBASIC from default installation
    "C:\\PowerBASIC\\PBCC\\PBCC.EXE" "${projectName}.bas"
) else (
    echo PowerBASIC Console Compiler not found!
    echo.
    echo Please ensure PowerBASIC is installed and:
    echo 1. PBCC.EXE is in current directory, or
    echo 2. PowerBASIC is installed in default location
    echo.
    pause
    exit /b 1
)

if exist "${projectName}.exe" (
    echo.
    echo Compilation successful!
    echo Running performance test...
    echo.
    "${projectName}.exe"
) else (
    echo.
    echo Compilation failed. Check for errors above.
)

pause
`;

      this.projectFiles.set('README.md', readmeContent);
      this.projectFiles.set('compile.bat', compileScript);
    }

    /**
     * Generate generic BASIC program (fallback)
     * @private
     */
    _generateGenericBASICProgram(code, options) {
      let program = '';

      // Generic header
      program += "REM Generic BASIC Generated Program\n";
      program += `REM Generated: ${new Date().toISOString()}\n`;
      program += "REM Compatible with most BASIC interpreters\n\n";

      // Line numbers for compatibility
      let lineNum = 10;
      program += `${lineNum} REM Main Program\n`;
      lineNum += 10;
      program += `${lineNum} PRINT "Generic BASIC Cryptographic Program"\n`;
      lineNum += 10;
      program += `${lineNum} PRINT "==================================="\n`;
      lineNum += 10;
      program += `${lineNum} PRINT ""\n`;
      lineNum += 10;

      // Convert code to line-numbered BASIC
      const genericCode = this._convertToGenericBASIC(code, lineNum);
      program += genericCode;

      return program;
    }

    /**
     * Generate generic project files
     * @private
     */
    _generateGenericProjectFiles(options) {
      const projectName = options.packageName || 'GeneratedProgram';

      const readmeContent = `# ${projectName} - Generic BASIC Program

Generated BASIC program compatible with most BASIC interpreters and environments.

## Compatibility

This program should work with:
- GW-BASIC
- QBasic
- Quick BASIC
- BBC BASIC
- Commodore BASIC
- And many other BASIC variants

## Features

- Line-numbered programming for maximum compatibility
- Simple, clear structure
- Basic cryptographic demonstrations
- Educational focus

## Running

### Modern BASIC Environments
1. Load the .bas file in your BASIC environment
2. Type RUN and press Enter

### DOSBox (for vintage BASIC)
1. Install DOSBox
2. Mount directory containing the .bas file
3. Run GW-BASIC or QBasic
4. Load and run the program

### QB64 (recommended for modern systems)
1. Download QB64 from https://qb64.org/
2. Load ${projectName}.bas
3. Press F5 to run

## Files

- \`${projectName}.bas\` - Main BASIC program
- \`README.md\` - This file

## Educational Value

This program demonstrates:
- Classic BASIC programming techniques
- Line-numbered structure
- Simple algorithm implementation
- Historical programming methods

## Notes

This generic BASIC version prioritizes compatibility over advanced features. For modern BASIC programming, consider FreeBASIC, QB64, or VB.NET variants.
`;

      this.projectFiles.set('README.md', readmeContent);
    }

    // ==================== SYNTAX CONVERSION HELPERS ====================

    /**
     * Check if code has encrypt function
     * @private
     */
    _hasEncryptFunction(code) {
      return code.toLowerCase().includes('encrypt');
    }

    /**
     * Convert code to QB64 syntax
     * @private
     */
    _convertToQB64Syntax(code) {
      return code
        .replace(/Function\s+(\w+)/gi, 'FUNCTION $1%')
        .replace(/Sub\s+(\w+)/gi, 'SUB $1')
        .replace(/End Function/gi, 'END FUNCTION')
        .replace(/End Sub/gi, 'END SUB')
        .replace(/Dim\s+(\w+)\s+As\s+(\w+)/gi, 'DIM $1 AS $2')
        .replace(/Return\s+(\w+)/gi, '$1% = $1: EXIT FUNCTION')
        .toUpperCase();
    }

    /**
     * Convert code to PureBASIC syntax
     * @private
     */
    _convertToPureBASICSyntax(code) {
      return code
        .replace(/Function\s+(\w+)/gi, 'Procedure.i $1')
        .replace(/Sub\s+(\w+)/gi, 'Procedure $1')
        .replace(/End Function/gi, 'EndProcedure')
        .replace(/End Sub/gi, 'EndProcedure')
        .replace(/Dim\s+(\w+)\s+As\s+(\w+)/gi, 'Define $1.$2')
        .replace(/Return\s+(\w+)/gi, 'ProcedureReturn $1');
    }

    /**
     * Convert code to True BASIC syntax
     * @private
     */
    _convertToTrueBASICSyntax(code) {
      return code
        .replace(/Function\s+(\w+)/gi, 'DEF $1')
        .replace(/Sub\s+(\w+)/gi, 'SUB $1')
        .replace(/End Function/gi, 'END DEF')
        .replace(/End Sub/gi, 'END SUB')
        .replace(/Dim\s+(\w+)\s+As\s+(\w+)/gi, 'DIM $1')
        .replace(/Return\s+(\w+)/gi, 'LET $1 = $1')
        .toUpperCase();
    }

    /**
     * Convert code to Liberty BASIC syntax
     * @private
     */
    _convertToLibertyBASICSyntax(code) {
      return code
        .replace(/Function\s+(\w+)/gi, 'function $1()')
        .replace(/Sub\s+(\w+)/gi, 'sub $1()')
        .replace(/End Function/gi, 'end function')
        .replace(/End Sub/gi, 'end sub')
        .replace(/Dim\s+(\w+)\s+As\s+(\w+)/gi, '$1 = 0  \' $2')
        .replace(/Return\s+(\w+)/gi, '$1 = $1');
    }

    /**
     * Convert code to PowerBASIC syntax
     * @private
     */
    _convertToPowerBASICSyntax(code) {
      return code
        .replace(/Function\s+(\w+)/gi, 'FUNCTION $1() AS LONG')
        .replace(/Sub\s+(\w+)/gi, 'SUB $1()')
        .replace(/End Function/gi, 'END FUNCTION')
        .replace(/End Sub/gi, 'END SUB')
        .replace(/Dim\s+(\w+)\s+As\s+(\w+)/gi, 'LOCAL $1 AS $2')
        .replace(/Return\s+(\w+)/gi, 'FUNCTION = $1')
        .toUpperCase();
    }

    /**
     * Convert code to generic line-numbered BASIC
     * @private
     */
    _convertToGenericBASIC(code, startLine = 1000) {
      const lines = code.split('\n');
      let result = '';
      let lineNum = startLine;

      for (const line of lines) {
        if (line.trim()) {
          const basicLine = line
            .replace(/Function\s+(\w+)/gi, 'REM Function $1')
            .replace(/Sub\s+(\w+)/gi, 'REM Subroutine $1')
            .replace(/End Function/gi, 'REM End Function')
            .replace(/End Sub/gi, 'REM End Subroutine')
            .replace(/Dim\s+(\w+)\s+As\s+(\w+)/gi, 'LET $1 = 0: REM $2')
            .replace(/Return\s+(\w+)/gi, 'RETURN')
            .toUpperCase();

          result += `${lineNum} ${basicLine}\n`;
          lineNum += 10;
        }
      }

      return result;
    }

    /**
     * Generate VB.NET OpCodes class
     * @private
     */
    _generateVBNetOpCodesClass(options) {
      let code = "        ''' <summary>\n";
      code += "        ''' Cryptographic operations class\n";
      code += "        ''' </summary>\n";
      code += "        Public Class OpCodes\n\n";

      code += "            ''' <summary>\n";
      code += "            ''' Rotate left 32-bit\n";
      code += "            ''' </summary>\n";
      code += "            Public Shared Function RotL32(value As UInteger, positions As Integer) As UInteger\n";
      code += "                Return (value << positions) Or (value >> (32 - positions))\n";
      code += "            End Function\n\n";

      code += "            ''' <summary>\n";
      code += "            ''' Rotate right 32-bit\n";
      code += "            ''' </summary>\n";
      code += "            Public Shared Function RotR32(value As UInteger, positions As Integer) As UInteger\n";
      code += "                Return (value >> positions) Or (value << (32 - positions))\n";
      code += "            End Function\n\n";

      code += "            ''' <summary>\n";
      code += "            ''' XOR byte arrays\n";
      code += "            ''' </summary>\n";
      code += "            Public Shared Function XorBytes(a As Byte(), b As Byte()) As Byte()\n";
      code += "                Dim result(Math.Max(a.Length, b.Length) - 1) As Byte\n";
      code += "                For i As Integer = 0 To result.Length - 1\n";
      code += "                    result(i) = a(i Mod a.Length) Xor b(i Mod b.Length)\n";
      code += "                Next\n";
      code += "                Return result\n";
      code += "            End Function\n\n";

      code += "        End Class\n\n";

      return code;
    }

    /**
     * Generate QB64 OpCodes
     * @private
     */
    _generateQB64OpCodes(options) {
      let code = "\n' QB64 OpCodes Simulation\n";
      code += "' ========================\n\n";

      code += "FUNCTION ROTL32%(value AS LONG, positions AS INTEGER)\n";
      code += "    ' Simulate 32-bit left rotation\n";
      code += "    ROTL32% = _SHL(value, positions) OR _SHR(value, 32 - positions)\n";
      code += "END FUNCTION\n\n";

      code += "FUNCTION ROTR32%(value AS LONG, positions AS INTEGER)\n";
      code += "    ' Simulate 32-bit right rotation\n";
      code += "    ROTR32% = _SHR(value, positions) OR _SHL(value, 32 - positions)\n";
      code += "END FUNCTION\n\n";

      return code;
    }

    /**
     * Generate PureBASIC OpCodes
     * @private
     */
    _generatePureBASICOpCodes(options) {
      let code = "\n; PureBASIC OpCodes\n";
      code += "; ==================\n\n";

      code += "Procedure.l RotL32(value.l, positions.i)\n";
      code += "  ; 32-bit left rotation\n";
      code += "  ProcedureReturn (value << positions) | (value >> (32 - positions))\n";
      code += "EndProcedure\n\n";

      code += "Procedure.l RotR32(value.l, positions.i)\n";
      code += "  ; 32-bit right rotation\n";
      code += "  ProcedureReturn (value >> positions) | (value << (32 - positions))\n";
      code += "EndProcedure\n\n";

      return code;
    }
  }

  // Register the enhanced plugin
  const basicPlugin = new BasicPlugin();
  LanguagePlugins.Add(basicPlugin);

  // Export for potential direct use (Node.js environment)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = basicPlugin;
  }

})(); // End of IIFE