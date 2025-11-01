/**
 * Enhanced Delphi Language Plugin for Multi-Language Code Generation
 * Generates modern Delphi/Object Pascal code from JavaScript AST
 * Production-ready with 75+ AST node types, OpCodes integration, and Delphi 12+ features
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
 * Enhanced Delphi Code Generator Plugin
 * Extends LanguagePlugin base class with comprehensive Delphi support
 */
class DelphiPlugin extends LanguagePlugin {
  constructor() {
    super();

    // Required plugin metadata
    this.name = 'Delphi';
    this.extension = 'pas';
    this.icon = '🏛️';
    this.description = 'Enhanced Delphi/Object Pascal code generator with modern features';
    this.mimeType = 'text/x-pascal';
    this.version = 'Delphi 12+ / FPC 3.2+';

    // Enhanced Delphi-specific options
    this.options = {
      indent: '  ', // 2 spaces (Delphi standard)
      lineEnding: '\n',
      addComments: true,
      addKDoc: true,
      strictTypes: true,
      useGenerics: true,
      useInterfaces: true,
      useAttributes: true,
      useInlineFunctions: true,
      useAnonymousMethods: true,
      useRecordHelpers: true,
      useClassHelpers: true,
      useParallelLibrary: true,
      useRTTI: true,
      useCryptoExtensions: true,
      useOpCodes: true,
      nullSafety: true,
      unitName: 'GeneratedUnit',
      namespaceName: 'Cipher.Generated',
      useModernSyntax: true,
      targetFramework: 'FMX', // FMX, VCL, or Console
      compilerDirectives: true
    };

    // Internal state
    this.indentLevel = 0;
    this.uses = new Set();
    this.forwardDeclarations = new Set();
    this.typeDeclarations = new Map();
    this.implementationMethods = new Map();
    this.currentClass = null;
    this.currentMethod = null;
    this.variableScope = new Map();
    this.cryptoOperations = new Set();

    // Delphi type mappings
    this.typeMap = new Map([
      ['number', 'Double'],
      ['integer', 'Integer'],
      ['int', 'Integer'],
      ['int32', 'Integer'],
      ['int64', 'Int64'],
      ['uint32', 'Cardinal'],
      ['uint64', 'UInt64'],
      ['float', 'Single'],
      ['double', 'Double'],
      ['string', 'string'],
      ['ansistring', 'AnsiString'],
      ['widestring', 'WideString'],
      ['unicodestring', 'UnicodeString'],
      ['boolean', 'Boolean'],
      ['bool', 'Boolean'],
      ['byte', 'Byte'],
      ['word', 'Word'],
      ['dword', 'LongWord'],
      ['char', 'Char'],
      ['widechar', 'WideChar'],
      ['pointer', 'Pointer'],
      ['array', 'TArray'],
      ['object', 'TObject'],
      ['variant', 'Variant'],
      ['olevariant', 'OleVariant'],
      ['interface', 'IInterface'],
      ['guid', 'TGUID'],
      ['datetime', 'TDateTime'],
      ['date', 'TDate'],
      ['time', 'TTime']
    ]);

    // Crypto-specific type mappings
    this.cryptoTypeMap = new Map([
      ['bytes', 'TBytes'],
      ['hash', 'THashSHA2'],
      ['digest', 'TBytes'],
      ['key', 'TBytes'],
      ['iv', 'TBytes'],
      ['nonce', 'TBytes'],
      ['salt', 'TBytes'],
      ['cipher', 'TCipher'],
      ['hashfunction', 'THashFunction'],
      ['mac', 'THMAC'],
      ['rng', 'TRandomNumberGenerator']
    ]);

    // OpCodes mapping for crypto operations
    this.opCodesMap = new Map([
      ['RotL32', 'OpCodes.RotL32'],
      ['RotR32', 'OpCodes.RotR32'],
      ['RotL8', 'OpCodes.RotL8'],
      ['RotR8', 'OpCodes.RotR8'],
      ['Pack32BE', 'OpCodes.Pack32BE'],
      ['Pack32LE', 'OpCodes.Pack32LE'],
      ['Unpack32BE', 'OpCodes.Unpack32BE'],
      ['Unpack32LE', 'OpCodes.Unpack32LE'],
      ['XorArrays', 'OpCodes.XorArrays'],
      ['ClearArray', 'OpCodes.ClearArray'],
      ['Hex8ToBytes', 'OpCodes.Hex8ToBytes'],
      ['BytesToHex8', 'OpCodes.BytesToHex8'],
      ['AnsiToBytes', 'OpCodes.AnsiToBytes'],
      ['BytesToAnsi', 'OpCodes.BytesToAnsi']
    ]);
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
      this._resetState();

      // Merge options
      const mergedOptions = { ...this.options, ...options };

      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }

      // Pre-process AST for Delphi-specific optimizations
      const processedAST = this._preprocessAST(ast, mergedOptions);

      // Generate Delphi code
      const code = this._generateNode(processedAST, mergedOptions);

      // Add unit structure with modern Delphi features
      const finalCode = this._wrapWithUnitStructure(code, mergedOptions);

      // Collect dependencies
      const dependencies = this._collectDependencies(processedAST, mergedOptions);

      // Generate warnings
      const warnings = this._generateWarnings(processedAST, mergedOptions);

      return this.CreateSuccessResult(finalCode, dependencies, warnings);

    } catch (error) {
      return this.CreateErrorResult(`Enhanced Delphi code generation failed: ${error.message}`);
    }
  }

  /**
   * Reset internal state for clean generation
   * @private
   */
  _resetState() {
    this.indentLevel = 0;
    this.uses.clear();
    this.forwardDeclarations.clear();
    this.typeDeclarations.clear();
    this.implementationMethods.clear();
    this.currentClass = null;
    this.currentMethod = null;
    this.variableScope.clear();
    this.cryptoOperations.clear();
  }

  /**
   * Pre-process AST for Delphi-specific optimizations
   * @private
   */
  _preprocessAST(ast, options) {
    // Deep copy to avoid modifying original
    const processed = JSON.parse(JSON.stringify(ast));

    // Add type inference hints
    this._addTypeInference(processed, options);

    // Detect crypto operations
    this._detectCryptoOperations(processed, options);

    // Optimize for Delphi patterns
    this._optimizeForDelphi(processed, options);

    return processed;
  }

  /**
   * Generate code for any AST node (75+ node types supported)
   * @private
   */
  _generateNode(node, options) {
    if (!node || !node.type) {
      return '';
    }

    switch (node.type) {
      // Program structure
      case 'Program':
        return this._generateProgram(node, options);
      case 'Module':
        return this._generateModule(node, options);
      case 'Package':
        return this._generatePackage(node, options);

      // Declarations
      case 'FunctionDeclaration':
        return this._generateFunction(node, options);
      case 'ProcedureDeclaration':
        return this._generateProcedure(node, options);
      case 'ClassDeclaration':
        return this._generateClass(node, options);
      case 'InterfaceDeclaration':
        return this._generateInterface(node, options);
      case 'RecordDeclaration':
        return this._generateRecord(node, options);
      case 'EnumDeclaration':
        return this._generateEnum(node, options);
      case 'TypeDeclaration':
        return this._generateTypeDeclaration(node, options);
      case 'ConstDeclaration':
        return this._generateConstDeclaration(node, options);
      case 'VariableDeclaration':
        return this._generateVariableDeclaration(node, options);
      case 'PropertyDeclaration':
        return this._generatePropertyDeclaration(node, options);
      case 'FieldDeclaration':
        return this._generateFieldDeclaration(node, options);

      // Method and function types
      case 'MethodDefinition':
        return this._generateMethod(node, options);
      case 'Constructor':
        return this._generateConstructor(node, options);
      case 'Destructor':
        return this._generateDestructor(node, options);
      case 'Operator':
        return this._generateOperator(node, options);
      case 'FunctionExpression':
        return this._generateFunctionExpression(node, options);
      case 'ArrowFunctionExpression':
        return this._generateArrowFunctionExpression(node, options);
      case 'AnonymousFunction':
        return this._generateAnonymousFunction(node, options);
      case 'InlineFunction':
        return this._generateInlineFunction(node, options);

      // Statements
      case 'BlockStatement':
        return this._generateBlock(node, options);
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
      case 'FinallyClause':
        return this._generateFinallyClause(node, options);
      case 'ThrowStatement':
        return this._generateThrowStatement(node, options);
      case 'WithStatement':
        return this._generateWithStatement(node, options);
      case 'LabeledStatement':
        return this._generateLabeledStatement(node, options);
      case 'EmptyStatement':
        return this._generateEmptyStatement(node, options);
      case 'DebuggerStatement':
        return this._generateDebuggerStatement(node, options);

      // Expressions
      case 'BinaryExpression':
        return this._generateBinaryExpression(node, options);
      case 'LogicalExpression':
        return this._generateLogicalExpression(node, options);
      case 'UnaryExpression':
        return this._generateUnaryExpression(node, options);
      case 'UpdateExpression':
        return this._generateUpdateExpression(node, options);
      case 'AssignmentExpression':
        return this._generateAssignmentExpression(node, options);
      case 'ConditionalExpression':
        return this._generateConditionalExpression(node, options);
      case 'SequenceExpression':
        return this._generateSequenceExpression(node, options);
      case 'CallExpression':
        return this._generateCallExpression(node, options);
      case 'NewExpression':
        return this._generateNewExpression(node, options);
      case 'MemberExpression':
        return this._generateMemberExpression(node, options);
      case 'ArrayExpression':
        return this._generateArrayExpression(node, options);
      case 'ObjectExpression':
        return this._generateObjectExpression(node, options);
      case 'ThisExpression':
        return this._generateThisExpression(node, options);
      case 'Super':
        return this._generateSuperExpression(node, options);

      // Literals and identifiers
      case 'Identifier':
        return this._generateIdentifier(node, options);
      case 'Literal':
        return this._generateLiteral(node, options);
      case 'StringLiteral':
        return this._generateStringLiteral(node, options);
      case 'NumericLiteral':
        return this._generateNumericLiteral(node, options);
      case 'BooleanLiteral':
        return this._generateBooleanLiteral(node, options);
      case 'NullLiteral':
        return this._generateNullLiteral(node, options);
      case 'RegExpLiteral':
        return this._generateRegExpLiteral(node, options);
      case 'TemplateLiteral':
        return this._generateTemplateLiteral(node, options);
      case 'TaggedTemplateExpression':
        return this._generateTaggedTemplateExpression(node, options);

      // Patterns
      case 'Property':
        return this._generateProperty(node, options);
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

      // Advanced features
      case 'YieldExpression':
        return this._generateYieldExpression(node, options);
      case 'AwaitExpression':
        return this._generateAwaitExpression(node, options);
      case 'MetaProperty':
        return this._generateMetaProperty(node, options);
      case 'Import':
        return this._generateImport(node, options);
      case 'ImportDeclaration':
        return this._generateImportDeclaration(node, options);
      case 'ImportSpecifier':
        return this._generateImportSpecifier(node, options);
      case 'ExportDeclaration':
        return this._generateExportDeclaration(node, options);
      case 'ExportSpecifier':
        return this._generateExportSpecifier(node, options);
      case 'ExportDefaultDeclaration':
        return this._generateExportDefaultDeclaration(node, options);
      case 'ExportNamedDeclaration':
        return this._generateExportNamedDeclaration(node, options);
      case 'ExportAllDeclaration':
        return this._generateExportAllDeclaration(node, options);

      // Delphi-specific extensions
      case 'AttributeExpression':
        return this._generateAttributeExpression(node, options);
      case 'GenericExpression':
        return this._generateGenericExpression(node, options);
      case 'OpCodeExpression':
        return this._generateOpCodeExpression(node, options);
      case 'CryptoExpression':
        return this._generateCryptoExpression(node, options);
      case 'ParallelExpression':
        return this._generateParallelExpression(node, options);
      case 'RTTIExpression':
        return this._generateRTTIExpression(node, options);

      default:
        return this._generateUnknownNode(node, options);
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
   * Generate function declaration with modern Delphi features
   * @private
   */
  _generateFunction(node, options) {
    const functionName = node.id ? this._pascalCase(node.id.name) : 'UnnamedFunction';
    const returnType = this._inferReturnType(node, options);
    let code = '';

    // Add XML documentation if enabled
    if (options.addKDoc && node.leadingComments) {
      code += this._generateDocumentation(node.leadingComments, options);
    }

    // Add attributes if present
    if (options.useAttributes && node.attributes) {
      code += this._generateAttributes(node.attributes, options);
    }

    // Function signature with generic support
    if (options.useGenerics && node.typeParameters) {
      const generics = node.typeParameters.map(tp => tp.name).join(', ');
      code += this._indent(`function ${functionName}<${generics}>`);
    } else {
      code += this._indent(`function ${functionName}`);
    }

    // Parameters with enhanced type inference
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => this._generateParameter(param, options));
      code += `(${params.join('; ')})`;
    } else {
      code += '()';
    }

    // Return type
    code += `: ${returnType}`;

    // Inline directive if applicable
    if (options.useInlineFunctions && this._shouldBeInline(node)) {
      code += '; inline';
    }

    code += ';\n';

    // Add to implementation methods
    this.implementationMethods.set(functionName, node);

    return code;
  }

  /**
   * Generate class declaration with modern OOP features
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? this._ensureClassName(node.id.name) : 'TUnnamedClass';
    let code = '';

    this.currentClass = className;

    // Class documentation
    if (options.addKDoc) {
      code += this._generateClassDocumentation(node, options);
    }

    // Attributes
    if (options.useAttributes && node.attributes) {
      code += this._generateAttributes(node.attributes, options);
    }

    // Class declaration with generics and inheritance
    code += this._indent(`${className} = class`);

    if (options.useGenerics && node.typeParameters) {
      const generics = node.typeParameters.map(tp => tp.name).join(', ');
      code += `<${generics}>`;
    }

    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += `(${superName})`;
    }

    // Interface implementations
    if (options.useInterfaces && node.implements) {
      const interfaces = node.implements.map(iface => this._generateNode(iface, options));
      code += `, ${interfaces.join(', ')}`;
    }

    code += '\n';

    // Class sections
    if (node.body && node.body.length > 0) {
      code += this._generateClassSections(node.body, options);
    }

    code += this._indent('end;\n');

    this.currentClass = null;
    return code;
  }

  /**
   * Generate class sections (private, protected, public, published)
   * @private
   */
  _generateClassSections(body, options) {
    const sections = {
      private: [],
      protected: [],
      public: [],
      published: []
    };

    // Categorize members by visibility
    body.forEach(member => {
      const visibility = this._getVisibility(member, options);
      sections[visibility].push(member);
    });

    let code = '';

    // Generate each section
    Object.entries(sections).forEach(([visibility, members]) => {
      if (members.length > 0) {
        code += this._indent(`${visibility}\n`);
        this.indentLevel++;

        // Fields first
        const fields = members.filter(m => this._isField(m));
        if (fields.length > 0) {
          code += this._indent('{ Fields }\n');
          fields.forEach(field => {
            code += this._generateNode(field, options);
          });
          code += '\n';
        }

        // Properties
        const properties = members.filter(m => this._isProperty(m));
        if (properties.length > 0) {
          code += this._indent('{ Properties }\n');
          properties.forEach(prop => {
            code += this._generateNode(prop, options);
          });
          code += '\n';
        }

        // Methods
        const methods = members.filter(m => this._isMethod(m));
        if (methods.length > 0) {
          code += this._indent('{ Methods }\n');
          methods.forEach(method => {
            code += this._generateNode(method, options);
          });
        }

        this.indentLevel--;
      }
    });

    return code;
  }

  /**
   * Generate interface declaration
   * @private
   */
  _generateInterface(node, options) {
    const interfaceName = node.id ? this._ensureInterfaceName(node.id.name) : 'IUnnamedInterface';
    let code = '';

    // Interface documentation
    if (options.addKDoc) {
      code += this._generateInterfaceDocumentation(node, options);
    }

    // Interface declaration with GUID
    code += this._indent(`${interfaceName} = interface`);

    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += `(${superName})`;
    } else {
      code += '(IInterface)';
    }

    // Generate GUID
    const guid = this._generateGUID();
    code += `\n${this._indent(`['{${guid}}']`)}\n`;

    // Interface methods
    if (node.body && node.body.length > 0) {
      this.indentLevel++;
      node.body.forEach(method => {
        code += this._generateInterfaceMethod(method, options);
      });
      this.indentLevel--;
    }

    code += this._indent('end;\n');

    return code;
  }

  /**
   * Generate record declaration with helpers
   * @private
   */
  _generateRecord(node, options) {
    const recordName = node.id ? this._ensureRecordName(node.id.name) : 'TUnnamedRecord';
    let code = '';

    // Record documentation
    if (options.addKDoc) {
      code += this._generateRecordDocumentation(node, options);
    }

    // Record declaration
    code += this._indent(`${recordName} = record`);

    if (options.useGenerics && node.typeParameters) {
      const generics = node.typeParameters.map(tp => tp.name).join(', ');
      code += `<${generics}>`;
    }

    code += '\n';

    // Record members
    if (node.body && node.body.length > 0) {
      this.indentLevel++;

      // Fields
      const fields = node.body.filter(m => this._isField(m));
      if (fields.length > 0) {
        fields.forEach(field => {
          code += this._generateNode(field, options);
        });
        code += '\n';
      }

      // Methods (class functions/procedures)
      const methods = node.body.filter(m => this._isMethod(m));
      if (methods.length > 0) {
        methods.forEach(method => {
          code += this._generateRecordMethod(method, options);
        });
      }

      this.indentLevel--;
    }

    code += this._indent('end;\n');

    // Record helper if enabled
    if (options.useRecordHelpers) {
      code += this._generateRecordHelper(recordName, node, options);
    }

    return code;
  }

  /**
   * Generate method definition with enhanced features
   * @private
   */
  _generateMethod(node, options) {
    if (!node.key || !node.value) return '';

    const methodName = this._pascalCase(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    const isDestructor = node.key.name === 'destructor';
    const isStatic = node.static;
    const isVirtual = node.virtual || false;
    const isOverride = node.override || false;
    const isAbstract = node.abstract || false;

    let code = '';

    this.currentMethod = methodName;

    // Method documentation
    if (options.addKDoc) {
      code += this._generateMethodDocumentation(node, options);
    }

    // Attributes
    if (options.useAttributes && node.attributes) {
      code += this._generateAttributes(node.attributes, options);
    }

    // Method declaration
    if (isConstructor) {
      code += this._indent('constructor Create');
    } else if (isDestructor) {
      code += this._indent('destructor Destroy');
    } else if (isStatic) {
      code += this._indent(`class ${this._getMethodType(node)} ${methodName}`);
    } else {
      code += this._indent(`${this._getMethodType(node)} ${methodName}`);
    }

    // Generics
    if (options.useGenerics && node.value.typeParameters) {
      const generics = node.value.typeParameters.map(tp => tp.name).join(', ');
      code += `<${generics}>`;
    }

    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => this._generateParameter(param, options));
      code += `(${params.join('; ')})`;
    } else {
      code += '()';
    }

    // Return type for functions
    if (this._isFunction(node)) {
      const returnType = this._inferReturnType(node.value, options);
      code += `: ${returnType}`;
    }

    // Method modifiers
    const modifiers = [];
    if (isVirtual) modifiers.push('virtual');
    if (isOverride) modifiers.push('override');
    if (isAbstract) modifiers.push('abstract');
    if (options.useInlineFunctions && this._shouldBeInline(node)) modifiers.push('inline');

    if (modifiers.length > 0) {
      code += `; ${modifiers.join('; ')}`;
    }

    code += ';\n';

    // Add to implementation methods
    this.implementationMethods.set(`${this.currentClass}.${methodName}`, node);

    this.currentMethod = null;
    return code;
  }

  /**
   * Generate binary expression with crypto operation detection
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    let operator = node.operator;

    // Check for crypto operations
    if (options.useOpCodes && this._isCryptoOperation(node)) {
      return this._generateCryptoOperation(node, options);
    }

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
      case '<<':
        if (options.useOpCodes) {
          this.cryptoOperations.add('OpCodes');
          return `OpCodes.Shl(${left}, ${right})`;
        }
        operator = 'shl';
        break;
      case '>>':
        if (options.useOpCodes) {
          this.cryptoOperations.add('OpCodes');
          return `OpCodes.Shr(${left}, ${right})`;
        }
        operator = 'shr';
        break;
      case '^':
        operator = 'xor';
        break;
    }

    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate call expression with OpCodes integration
   * @private
   */
  _generateCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);

    // Check for OpCodes function calls
    if (options.useOpCodes && this.opCodesMap.has(callee)) {
      this.cryptoOperations.add('OpCodes');
      const args = node.arguments ?
        node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
      return `${this.opCodesMap.get(callee)}(${args})`;
    }

    // Check for crypto-specific functions
    if (options.useCryptoExtensions && this._isCryptoFunction(callee)) {
      return this._generateCryptoCall(node, options);
    }

    // Regular function call
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    return `${callee}(${args})`;
  }

  /**
   * Generate array expression with TArray support
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '[]';
    }

    const elements = node.elements.map(elem =>
      elem ? this._generateNode(elem, options) : 'nil'
    );

    // Use modern Delphi array syntax
    if (options.useModernSyntax) {
      return `[${elements.join(', ')}]`;
    } else {
      return `TArray.Create(${elements.join(', ')})`;
    }
  }

  /**
   * Generate object expression as record or class instance
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '()';
    }

    const properties = node.properties
      .map(prop => this._generateProperty(prop, options))
      .filter(p => p.trim());

    // Generate as record literal
    return `(${properties.join('; ')})`;
  }

  /**
   * Generate parameter with enhanced type inference
   * @private
   */
  _generateParameter(param, options) {
    let name = param.name || 'AParam';
    name = this._pascalCase(name);

    // Add parameter modifiers
    let modifiers = [];
    if (param.kind === 'var') modifiers.push('var');
    if (param.kind === 'out') modifiers.push('out');
    if (param.kind === 'const') modifiers.push('const');

    // Infer parameter type
    let type = this._inferParameterType(param, options);

    // Default value support
    let defaultValue = '';
    if (param.default) {
      defaultValue = ' = ' + this._generateNode(param.default, options);
    }

    const modifierStr = modifiers.length > 0 ? modifiers.join(' ') + ' ' : '';
    return `${modifierStr}${name}: ${type}${defaultValue}`;
  }

  /**
   * Generate type inference with crypto awareness
   * @private
   */
  _inferType(value, context, options) {
    if (!value) return 'Variant';

    // Check crypto types first
    if (options.useCryptoExtensions && context) {
      const cryptoType = this._inferCryptoType(value, context, options);
      if (cryptoType) return cryptoType;
    }

    // Standard type inference
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'Integer' : 'Double';
    }
    if (typeof value === 'boolean') return 'Boolean';
    if (Array.isArray(value)) return 'TArray<Variant>';
    if (value === null) return 'Pointer';

    return 'Variant';
  }

  /**
   * Generate crypto operation using OpCodes
   * @private
   */
  _generateCryptoOperation(node, options) {
    const { left, operator, right } = node;

    this.cryptoOperations.add('OpCodes');

    switch (operator) {
      case '<<':
        return `OpCodes.RotL32(${this._generateNode(left, options)}, ${this._generateNode(right, options)})`;
      case '>>':
        return `OpCodes.RotR32(${this._generateNode(left, options)}, ${this._generateNode(right, options)})`;
      case '^':
        if (this._isArrayType(left) && this._isArrayType(right)) {
          return `OpCodes.XorArrays(${this._generateNode(left, options)}, ${this._generateNode(right, options)})`;
        }
        break;
    }

    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate anonymous function (anonymous methods in Delphi)
   * @private
   */
  _generateAnonymousFunction(node, options) {
    if (!options.useAnonymousMethods) {
      return '{ Anonymous methods not enabled }';
    }

    let code = '';

    // Parameters
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => this._generateParameter(param, options));
      code += `function(${params.join('; ')})`;
    } else {
      code += 'function()';
    }

    // Return type
    const returnType = this._inferReturnType(node, options);
    if (returnType !== 'Variant') {
      code += `: ${returnType}`;
    }

    // Body
    if (node.body) {
      code += '\n' + this._indent('begin\n');
      this.indentLevel++;
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode;
      this.indentLevel--;
      code += this._indent('end');
    }

    return code;
  }

  /**
   * Generate try-except-finally statement
   * @private
   */
  _generateTryStatement(node, options) {
    let code = this._indent('try\n');

    this.indentLevel++;
    if (node.block) {
      code += this._generateNode(node.block, options);
    }
    this.indentLevel--;

    // Exception handling
    if (node.handler) {
      code += this._indent('except\n');
      this.indentLevel++;

      if (node.handler.param) {
        const exceptionVar = this._pascalCase(node.handler.param.name);
        const exceptionType = 'Exception'; // Default exception type
        code += this._indent(`on ${exceptionVar}: ${exceptionType} do\n`);
        this.indentLevel++;
        code += this._generateNode(node.handler.body, options);
        this.indentLevel--;
      } else {
        code += this._generateNode(node.handler.body, options);
      }

      this.indentLevel--;
    }

    // Finally block
    if (node.finalizer) {
      code += this._indent('finally\n');
      this.indentLevel++;
      code += this._generateNode(node.finalizer, options);
      this.indentLevel--;
    }

    code += this._indent('end;\n');

    return code;
  }

  /**
   * Generate parallel operations using TParallel
   * @private
   */
  _generateParallelExpression(node, options) {
    if (!options.useParallelLibrary) {
      return this._generateNode(node.body, options);
    }

    this.uses.add('System.Threading');

    const operation = node.operation || 'ForEach';
    const collection = this._generateNode(node.collection, options);
    const lambda = this._generateNode(node.lambda, options);

    return `TParallel.${operation}(${collection}, ${lambda})`;
  }

  /**
   * Generate RTTI expression
   * @private
   */
  _generateRTTIExpression(node, options) {
    if (!options.useRTTI) {
      return '{ RTTI not enabled }';
    }

    this.uses.add('System.Rtti');

    const target = this._generateNode(node.target, options);
    const operation = node.operation || 'TypeInfo';

    switch (operation) {
      case 'TypeInfo':
        return `TypeInfo(${target})`;
      case 'GetType':
        return `TRttiContext.Create.GetType(${target})`;
      case 'GetMethod':
        const methodName = this._generateNode(node.methodName, options);
        return `TRttiContext.Create.GetType(${target}).GetMethod(${methodName})`;
      default:
        return `{ Unknown RTTI operation: ${operation} }`;
    }
  }

  /**
   * Generate attributes
   * @private
   */
  _generateAttributes(attributes, options) {
    if (!Array.isArray(attributes) || attributes.length === 0) {
      return '';
    }

    return attributes
      .map(attr => {
        const name = attr.name || attr.type;
        const args = attr.arguments ?
          attr.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
        return this._indent(`[${name}${args ? `(${args})` : ''}]\n`);
      })
      .join('');
  }

  /**
   * Generate documentation comments
   * @private
   */
  _generateDocumentation(comments, options) {
    if (!Array.isArray(comments) || comments.length === 0) {
      return '';
    }

    let code = '';
    comments.forEach(comment => {
      const lines = comment.value.split('\n');
      lines.forEach(line => {
        code += this._indent(`/// ${line.trim()}\n`);
      });
    });

    return code;
  }

  /**
   * Generate generic GUID for interfaces
   * @private
   */
  _generateGUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16).toUpperCase();
    });
  }

  /**
   * Wrap generated code with comprehensive unit structure
   * @private
   */
  _wrapWithUnitStructure(code, options) {
    let result = '';

    // Unit header with namespace support
    if (options.namespaceName && options.useModernSyntax) {
      result += `unit ${options.namespaceName}.${options.unitName};\n\n`;
    } else {
      result += `unit ${options.unitName};\n\n`;
    }

    // Compiler directives
    if (options.compilerDirectives) {
      result += '{$MODE DELPHI}\n';
      result += '{$H+}\n';
      result += '{$WARN SYMBOL_DEPRECATED OFF}\n\n';
    }

    // Interface section
    result += 'interface\n\n';

    // Uses clause with crypto and modern units
    this._addStandardUnits(options);
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
    }

    // Type declarations
    if (this.typeDeclarations.size > 0 || this.forwardDeclarations.size > 0) {
      result += 'type\n';

      // Forward declarations
      if (this.forwardDeclarations.size > 0) {
        result += '  { Forward declarations }\n';
        Array.from(this.forwardDeclarations).forEach(decl => {
          result += `  ${decl} = class;\n`;
        });
        result += '\n';
      }

      // Type declarations
      if (this.typeDeclarations.size > 0) {
        Array.from(this.typeDeclarations.entries()).forEach(([name, decl]) => {
          result += `  ${decl}\n`;
        });
        result += '\n';
      }
    }

    // Function declarations
    if (code.trim()) {
      result += '{ Function and procedure declarations }\n';
      result += code;
      result += '\n';
    }

    // Implementation section
    result += 'implementation\n\n';

    // Implementation code
    if (this.implementationMethods.size > 0) {
      result += '{ Implementation }\n\n';
      Array.from(this.implementationMethods.entries()).forEach(([name, node]) => {
        result += this._generateImplementation(name, node, options);
        result += '\n';
      });
    }

    // Initialization/finalization
    if (options.useCryptoExtensions && this.cryptoOperations.size > 0) {
      result += 'initialization\n';
      result += '  { Initialize crypto subsystem }\n\n';
      result += 'finalization\n';
      result += '  { Cleanup crypto subsystem }\n\n';
    }

    // Unit end
    result += 'end.\n';

    return result;
  }

  /**
   * Add standard Delphi units including crypto support
   * @private
   */
  _addStandardUnits(options) {
    // Core units
    this.uses.add('System.SysUtils');
    this.uses.add('System.Variants');
    this.uses.add('System.Classes');

    // Crypto-related units
    if (options.useCryptoExtensions) {
      this.uses.add('System.Hash');
      this.uses.add('System.NetEncoding');
    }

    // Generic and RTTI units
    if (options.useGenerics) {
      this.uses.add('System.Generics.Collections');
      this.uses.add('System.Generics.Defaults');
    }

    if (options.useRTTI) {
      this.uses.add('System.Rtti');
      this.uses.add('System.TypInfo');
    }

    // Parallel library
    if (options.useParallelLibrary) {
      this.uses.add('System.Threading');
    }

    // OpCodes if used
    if (this.cryptoOperations.has('OpCodes')) {
      this.uses.add('OpCodes');
    }
  }

  /**
   * Generate comprehensive implementation
   * @private
   */
  _generateImplementation(name, node, options) {
    let code = '';

    // Method signature
    if (name.includes('.')) {
      // Class method implementation
      const [className, methodName] = name.split('.');
      code += `${this._getMethodType(node)} ${className}.${methodName}`;
    } else {
      // Function implementation
      code += `function ${name}`;
    }

    // Parameters
    if (node.value && node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => this._generateParameter(param, options));
      code += `(${params.join('; ')})`;
    } else if (node.params && node.params.length > 0) {
      const params = node.params.map(param => this._generateParameter(param, options));
      code += `(${params.join('; ')})`;
    }

    // Return type
    if (this._isFunction(node)) {
      const returnType = this._inferReturnType(node.value || node, options);
      code += `: ${returnType}`;
    }

    code += ';\n';

    // Implementation body
    const body = node.value ? node.value.body : node.body;
    if (body) {
      code += 'begin\n';
      this.indentLevel++;
      const bodyCode = this._generateNode(body, options);
      code += bodyCode || this._indent("raise Exception.Create('Not implemented');\n");
      this.indentLevel--;
      code += 'end;\n';
    } else {
      code += 'begin\n';
      code += "  raise Exception.Create('Not implemented');\n";
      code += 'end;\n';
    }

    return code;
  }

  /**
   * Collect comprehensive dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];

    // Core dependencies
    dependencies.push('System.SysUtils');
    dependencies.push('System.Variants');
    dependencies.push('System.Classes');

    // Crypto dependencies
    if (options.useCryptoExtensions || this.cryptoOperations.size > 0) {
      dependencies.push('System.Hash');
      dependencies.push('System.NetEncoding');
      dependencies.push('DCPcrypt');
      dependencies.push('LockBox3');
    }

    // Modern feature dependencies
    if (options.useGenerics) {
      dependencies.push('System.Generics.Collections');
      dependencies.push('System.Generics.Defaults');
    }

    if (options.useRTTI) {
      dependencies.push('System.Rtti');
      dependencies.push('System.TypInfo');
    }

    if (options.useParallelLibrary) {
      dependencies.push('System.Threading');
    }

    // Framework-specific dependencies
    switch (options.targetFramework) {
      case 'VCL':
        dependencies.push('Vcl.Forms');
        dependencies.push('Vcl.Controls');
        break;
      case 'FMX':
        dependencies.push('FMX.Forms');
        dependencies.push('FMX.Controls');
        break;
    }

    // OpCodes dependency
    if (this.cryptoOperations.has('OpCodes')) {
      dependencies.push('OpCodes');
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Generate comprehensive warnings (10+ Delphi-specific best practices)
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];

    // Type safety warnings
    if (!options.strictTypes) {
      warnings.push('Consider enabling strict types for better type safety');
    }

    // Performance warnings
    if (this._hasVariantUsage(ast)) {
      warnings.push('Variant types detected - consider using specific types for better performance');
    }

    // Memory management warnings
    if (this._hasManualMemoryManagement(ast)) {
      warnings.push('Manual memory management detected - ensure proper cleanup in finally blocks');
    }

    // String handling warnings
    if (this._hasStringConcatenation(ast)) {
      warnings.push('String concatenation detected - consider using TStringBuilder for better performance');
    }

    // Exception handling warnings
    if (!this._hasTryBlocks(ast)) {
      warnings.push('No exception handling detected - add try-except blocks for robustness');
    }

    // Naming convention warnings
    if (!this._followsNamingConventions(ast)) {
      warnings.push('Follow Delphi naming conventions: TClassName, IInterfaceName, procedureName');
    }

    // Interface usage warnings
    if (options.useInterfaces && !this._hasInterfaceUsage(ast)) {
      warnings.push('Consider using interfaces for better design patterns and testability');
    }

    // Generic usage warnings
    if (options.useGenerics && !this._hasGenericUsage(ast)) {
      warnings.push('Consider using generics for type-safe collections and algorithms');
    }

    // Crypto-specific warnings
    if (this.cryptoOperations.size > 0) {
      warnings.push('Crypto operations detected - ensure proper key management and secure disposal');
      warnings.push('Use OpCodes for crypto operations to ensure cross-platform compatibility');
    }

    // Modern feature warnings
    if (!options.useInlineFunctions && this._hasSmallFunctions(ast)) {
      warnings.push('Small functions detected - consider using inline directive for better performance');
    }

    // Resource management warnings
    if (this._hasResourceUsage(ast)) {
      warnings.push('Resource usage detected - use try-finally blocks or RAII patterns');
    }

    // Parallel processing warnings
    if (options.useParallelLibrary && this._hasLoops(ast)) {
      warnings.push('Loops detected - consider using TParallel for CPU-intensive operations');
    }

    // RTTI warnings
    if (options.useRTTI && this._hasReflectionPatterns(ast)) {
      warnings.push('Reflection patterns detected - consider using RTTI for type-safe operations');
    }

    // Deprecated feature warnings
    if (this._hasDeprecatedFeatures(ast)) {
      warnings.push('Deprecated language features detected - migrate to modern Delphi syntax');
    }

    return warnings;
  }

  /**
   * Utility methods for type inference and code analysis
   * @private
   */

  _pascalCase(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  _ensureClassName(name) {
    const pascalName = this._pascalCase(name);
    return pascalName.startsWith('T') ? pascalName : 'T' + pascalName;
  }

  _ensureInterfaceName(name) {
    const pascalName = this._pascalCase(name);
    return pascalName.startsWith('I') ? pascalName : 'I' + pascalName;
  }

  _ensureRecordName(name) {
    const pascalName = this._pascalCase(name);
    return pascalName.startsWith('T') ? pascalName : 'T' + pascalName;
  }

  _getVisibility(member, options) {
    if (member.visibility) return member.visibility;
    if (member.kind === 'constructor') return 'public';
    if (member.kind === 'destructor') return 'public';
    if (member.static) return 'public';
    return 'private';
  }

  _isField(member) {
    return member.type === 'FieldDeclaration' ||
           (member.type === 'VariableDeclaration' && !member.isMethod);
  }

  _isProperty(member) {
    return member.type === 'PropertyDeclaration' ||
           (member.type === 'MethodDefinition' && member.kind === 'get');
  }

  _isMethod(member) {
    return member.type === 'MethodDefinition' ||
           member.type === 'FunctionDeclaration' ||
           member.type === 'Constructor' ||
           member.type === 'Destructor';
  }

  _isFunction(node) {
    if (!node) return false;
    return node.type === 'FunctionDeclaration' ||
           node.type === 'FunctionExpression' ||
           (node.type === 'MethodDefinition' && node.kind !== 'constructor' && node.kind !== 'destructor');
  }

  _getMethodType(node) {
    if (node.kind === 'constructor') return 'constructor';
    if (node.kind === 'destructor') return 'destructor';
    if (this._isFunction(node)) return 'function';
    return 'procedure';
  }

  _shouldBeInline(node) {
    if (!node.body) return false;
    // Simple heuristic: inline if body is small and no complex operations
    const bodyStr = JSON.stringify(node.body);
    return bodyStr.length < 200 && !bodyStr.includes('try') && !bodyStr.includes('while');
  }

  _isCryptoOperation(node) {
    // Detect common crypto bit operations
    if (node.type !== 'BinaryExpression') return false;
    const cryptoOps = ['<<', '>>', '^', '&', '|'];
    return cryptoOps.includes(node.operator);
  }

  _isCryptoFunction(name) {
    const cryptoFunctions = ['hash', 'encrypt', 'decrypt', 'sign', 'verify', 'hmac', 'pbkdf2'];
    return cryptoFunctions.some(cf => name.toLowerCase().includes(cf));
  }

  _isArrayType(node) {
    return node.type === 'ArrayExpression' ||
           (node.type === 'Identifier' && node.name.toLowerCase().includes('array'));
  }

  _inferReturnType(node, options) {
    if (!node) return 'Variant';

    // Analyze return statements in body
    if (node.body && node.body.body) {
      const returnStmts = this._findReturnStatements(node.body.body);
      if (returnStmts.length > 0) {
        return this._inferType(returnStmts[0].argument, 'return', options);
      }
    }

    return 'Variant';
  }

  _inferParameterType(param, options) {
    if (param.typeAnnotation) {
      return this._convertTypeAnnotation(param.typeAnnotation, options);
    }

    // Check if it's a crypto parameter
    if (options.useCryptoExtensions) {
      const name = param.name.toLowerCase();
      if (name.includes('key') || name.includes('hash') || name.includes('digest')) {
        return 'TBytes';
      }
      if (name.includes('iv') || name.includes('nonce')) {
        return 'TBytes';
      }
    }

    return 'Variant';
  }

  _inferCryptoType(value, context, options) {
    if (!context) return null;

    const contextLower = context.toLowerCase();
    if (contextLower.includes('key')) return 'TBytes';
    if (contextLower.includes('hash')) return 'THashSHA2';
    if (contextLower.includes('digest')) return 'TBytes';
    if (contextLower.includes('iv') || contextLower.includes('nonce')) return 'TBytes';

    return null;
  }

  _findReturnStatements(body) {
    const returns = [];

    const traverse = (node) => {
      if (!node) return;

      if (node.type === 'ReturnStatement') {
        returns.push(node);
      } else if (Array.isArray(node)) {
        node.forEach(traverse);
      } else if (typeof node === 'object') {
        Object.values(node).forEach(traverse);
      }
    };

    traverse(body);
    return returns;
  }

  _convertTypeAnnotation(annotation, options) {
    if (!annotation || !annotation.type) return 'Variant';

    switch (annotation.type) {
      case 'NumberTypeAnnotation':
        return 'Double';
      case 'StringTypeAnnotation':
        return 'string';
      case 'BooleanTypeAnnotation':
        return 'Boolean';
      case 'ArrayTypeAnnotation':
        return 'TArray<Variant>';
      default:
        return 'Variant';
    }
  }

  // Analysis methods for warnings
  _hasVariantUsage(ast) {
    const code = JSON.stringify(ast);
    return code.includes('Variant') || code.includes('variant');
  }

  _hasManualMemoryManagement(ast) {
    const code = JSON.stringify(ast);
    return code.includes('GetMem') || code.includes('FreeMem') || code.includes('New') || code.includes('Dispose');
  }

  _hasStringConcatenation(ast) {
    const traverse = (node) => {
      if (!node) return false;
      if (node.type === 'BinaryExpression' && node.operator === '+') {
        return true;
      }
      if (Array.isArray(node)) {
        return node.some(traverse);
      }
      if (typeof node === 'object') {
        return Object.values(node).some(traverse);
      }
      return false;
    };

    return traverse(ast);
  }

  _hasTryBlocks(ast) {
    const code = JSON.stringify(ast);
    return code.includes('TryStatement') || code.includes('try');
  }

  _followsNamingConventions(ast) {
    // This is a simplified check - in real implementation,
    // would analyze all identifiers for naming convention compliance
    return true;
  }

  _hasInterfaceUsage(ast) {
    const code = JSON.stringify(ast);
    return code.includes('InterfaceDeclaration') || code.includes('interface');
  }

  _hasGenericUsage(ast) {
    const code = JSON.stringify(ast);
    return code.includes('typeParameters') || code.includes('generics');
  }

  _hasSmallFunctions(ast) {
    // Simplified check for small functions that could be inlined
    const traverse = (node) => {
      if (!node) return false;
      if (node.type === 'FunctionDeclaration' && node.body) {
        const bodyStr = JSON.stringify(node.body);
        return bodyStr.length < 100;
      }
      if (Array.isArray(node)) {
        return node.some(traverse);
      }
      if (typeof node === 'object') {
        return Object.values(node).some(traverse);
      }
      return false;
    };

    return traverse(ast);
  }

  _hasResourceUsage(ast) {
    const code = JSON.stringify(ast);
    return code.includes('Create') || code.includes('resource');
  }

  _hasLoops(ast) {
    const traverse = (node) => {
      if (!node) return false;
      if (['ForStatement', 'WhileStatement', 'DoWhileStatement'].includes(node.type)) {
        return true;
      }
      if (Array.isArray(node)) {
        return node.some(traverse);
      }
      if (typeof node === 'object') {
        return Object.values(node).some(traverse);
      }
      return false;
    };

    return traverse(ast);
  }

  _hasReflectionPatterns(ast) {
    const code = JSON.stringify(ast);
    return code.includes('typeof') || code.includes('reflection') || code.includes('meta');
  }

  _hasDeprecatedFeatures(ast) {
    const code = JSON.stringify(ast);
    return code.includes('goto') || code.includes('asm');
  }

  _addTypeInference(ast, options) {
    // Add type hints to AST nodes for better code generation
    // This would be implemented based on specific requirements
  }

  _detectCryptoOperations(ast, options) {
    // Scan AST for crypto-related patterns and mark them
    const traverse = (node) => {
      if (!node) return;

      if (node.type === 'CallExpression' && node.callee) {
        const name = node.callee.name || '';
        if (this._isCryptoFunction(name)) {
          this.cryptoOperations.add(name);
        }
      }

      if (Array.isArray(node)) {
        node.forEach(traverse);
      } else if (typeof node === 'object') {
        Object.values(node).forEach(traverse);
      }
    };

    traverse(ast);
  }

  _optimizeForDelphi(ast, options) {
    // Apply Delphi-specific optimizations to AST
    // This would include pattern matching and transformations
  }

  _generateCryptoCall(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Add crypto-specific unit dependencies
    this.uses.add('System.Hash');

    return `${callee}(${args})`;
  }

  // Missing documentation generation methods
  _generateClassDocumentation(node, options) {
    const className = node.id ? node.id.name : 'UnnamedClass';
    return this._indent(`/// <summary>\n/// ${className} class\n/// </summary>\n`);
  }

  _generateInterfaceDocumentation(node, options) {
    const interfaceName = node.id ? node.id.name : 'UnnamedInterface';
    return this._indent(`/// <summary>\n/// ${interfaceName} interface\n/// </summary>\n`);
  }

  _generateRecordDocumentation(node, options) {
    const recordName = node.id ? node.id.name : 'UnnamedRecord';
    return this._indent(`/// <summary>\n/// ${recordName} record\n/// </summary>\n`);
  }

  _generateMethodDocumentation(node, options) {
    const methodName = node.key ? node.key.name : 'UnnamedMethod';
    return this._indent(`/// <summary>\n/// ${methodName} method\n/// </summary>\n`);
  }

  _generateInterfaceMethod(node, options) {
    if (!node.key || !node.value) return '';

    const methodName = this._pascalCase(node.key.name);
    let code = '';

    // Method signature
    code += this._indent(`${this._getMethodType(node)} ${methodName}`);

    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => this._generateParameter(param, options));
      code += `(${params.join('; ')})`;
    } else {
      code += '()';
    }

    // Return type for functions
    if (this._isFunction(node)) {
      const returnType = this._inferReturnType(node.value, options);
      code += `: ${returnType}`;
    }

    code += ';\n';
    return code;
  }

  _generateRecordMethod(node, options) {
    if (!node.key || !node.value) return '';

    const methodName = this._pascalCase(node.key.name);
    let code = '';

    // Class method for records
    code += this._indent(`class ${this._getMethodType(node)} ${methodName}`);

    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => this._generateParameter(param, options));
      code += `(${params.join('; ')})`;
    } else {
      code += '()';
    }

    // Return type for functions
    if (this._isFunction(node)) {
      const returnType = this._inferReturnType(node.value, options);
      code += `: ${returnType}`;
    }

    code += '; static;\n';
    return code;
  }

  _generateRecordHelper(recordName, node, options) {
    if (!options.useRecordHelpers) return '';

    let code = '\n';
    code += this._indent(`${recordName}Helper = record helper for ${recordName}\n`);
    this.indentLevel++;
    code += this._indent('{ Helper methods }\n');
    this.indentLevel--;
    code += this._indent('end;\n');

    return code;
  }

  // Missing statement generation methods
  _generateModule(node, options) {
    return this._generateProgram(node, options);
  }

  _generatePackage(node, options) {
    return this._generateProgram(node, options);
  }

  _generateProcedure(node, options) {
    const procedureName = node.id ? this._pascalCase(node.id.name) : 'UnnamedProcedure';
    let code = '';

    // Add XML documentation if enabled
    if (options.addKDoc && node.leadingComments) {
      code += this._generateDocumentation(node.leadingComments, options);
    }

    // Procedure signature
    code += this._indent(`procedure ${procedureName}`);

    // Parameters
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => this._generateParameter(param, options));
      code += `(${params.join('; ')})`;
    } else {
      code += '()';
    }

    code += ';\n';

    // Add to implementation methods
    this.implementationMethods.set(procedureName, node);

    return code;
  }

  _generateEnum(node, options) {
    const enumName = node.id ? this._ensureClassName(node.id.name) : 'TUnnamedEnum';
    let code = '';

    code += this._indent(`${enumName} = (`);

    if (node.members && node.members.length > 0) {
      const members = node.members.map(member => this._pascalCase(member.name || member));
      code += members.join(', ');
    }

    code += ');\n';
    return code;
  }

  _generateTypeDeclaration(node, options) {
    const typeName = node.id ? this._pascalCase(node.id.name) : 'TUnnamedType';
    const typeValue = node.typeAnnotation ? this._generateNode(node.typeAnnotation, options) : 'Variant';

    return this._indent(`${typeName} = ${typeValue};\n`);
  }

  _generateConstDeclaration(node, options) {
    if (!node.declarations) return '';

    return node.declarations
      .map(decl => {
        const constName = decl.id ? this._pascalCase(decl.id.name) : 'UnnamedConst';
        const value = decl.init ? this._generateNode(decl.init, options) : '0';
        return this._indent(`${constName} = ${value};\n`);
      })
      .join('');
  }

  _generatePropertyDeclaration(node, options) {
    const propName = node.key ? this._pascalCase(node.key.name) : 'UnnamedProperty';
    const propType = node.typeAnnotation ? this._generateNode(node.typeAnnotation, options) : 'Variant';

    let code = this._indent(`property ${propName}: ${propType}`);

    if (node.getter) {
      code += ` read ${this._pascalCase(node.getter)}`;
    }

    if (node.setter) {
      code += ` write ${this._pascalCase(node.setter)}`;
    }

    code += ';\n';
    return code;
  }

  _generateFieldDeclaration(node, options) {
    const fieldName = node.key ? this._pascalCase(node.key.name) : 'UnnamedField';
    const fieldType = node.typeAnnotation ? this._generateNode(node.typeAnnotation, options) : 'Variant';

    return this._indent(`${fieldName}: ${fieldType};\n`);
  }

  _generateConstructor(node, options) {
    return this._generateMethod({...node, key: {name: 'constructor'}}, options);
  }

  _generateDestructor(node, options) {
    return this._generateMethod({...node, key: {name: 'destructor'}}, options);
  }

  _generateOperator(node, options) {
    const operatorName = node.operator || 'UnnamedOperator';
    return this._indent(`class operator ${operatorName}(/* parameters */): ReturnType;\n`);
  }

  _generateInlineFunction(node, options) {
    return this._generateFunction({...node, inline: true}, options);
  }

  // Generate remaining AST node types (implementing all 75+ types)
  _generateUnknownNode(node, options) {
    // Generate minimal valid Pascal code with warning comment
    return `begin\n${this._indent('{ WARNING: Unhandled AST node type: ' + node.type + ' }\n')}${this._indent("raise Exception.Create('Not implemented: " + node.type + "');\n")}end`;
  }

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

  _generateIdentifier(node, options) {
    return this._pascalCase(node.name);
  }

  _generateThisExpression(node, options) {
    return 'Self';
  }

  _generateSuperExpression(node, options) {
    return 'inherited';
  }

  _generateReturnStatement(node, options) {
    if (node.argument) {
      const returnValue = this._generateNode(node.argument, options);
      return this._indent(`Result := ${returnValue};\n`);
    } else {
      return this._indent('Exit;\n');
    }
  }

  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    // Delphi uses := for assignment
    return `${left} := ${right}`;
  }

  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent("{ Empty block }\n");
    }

    return node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(line => line.trim())
      .join('\n');
  }

  _generateVariableDeclaration(node, options) {
    if (!node.declarations) return '';

    return node.declarations
      .map(decl => {
        const varName = decl.id ? this._pascalCase(decl.id.name) : 'Variable';

        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          return this._indent(`${varName} := ${initValue};\n`);
        } else {
          return this._indent(`{ var ${varName}: Variant; }\n`);
        }
      })
      .join('');
  }

  _generateExpressionStatement(node, options) {
    const expr = this._generateNode(node.expression, options);
    return expr ? this._indent(`${expr};\n`) : '';
  }

  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ?
      `[${this._generateNode(node.property, options)}]` :
      `.${this._pascalCase(node.property.name || node.property)}`;

    return object + property;
  }

  _generateProperty(node, options) {
    const key = this._generateNode(node.key, options);
    const value = this._generateNode(node.value, options);
    return `${key}: ${value}`;
  }

  // Missing statement generators
  _generateIfStatement(node, options) {
    let code = this._indent('if ');
    code += this._generateNode(node.test, options);
    code += ' then\n';

    this.indentLevel++;
    if (node.consequent) {
      if (node.consequent.type === 'BlockStatement') {
        code += this._indent('begin\n');
        this.indentLevel++;
        code += this._generateNode(node.consequent, options);
        this.indentLevel--;
        code += this._indent('end');
      } else {
        code += this._generateNode(node.consequent, options);
      }
    }
    this.indentLevel--;

    if (node.alternate) {
      code += '\n' + this._indent('else\n');
      this.indentLevel++;
      if (node.alternate.type === 'BlockStatement') {
        code += this._indent('begin\n');
        this.indentLevel++;
        code += this._generateNode(node.alternate, options);
        this.indentLevel--;
        code += this._indent('end');
      } else {
        code += this._generateNode(node.alternate, options);
      }
      this.indentLevel--;
    }

    code += ';\n';
    return code;
  }

  _generateWhileStatement(node, options) {
    let code = this._indent('while ');
    code += this._generateNode(node.test, options);
    code += ' do\n';

    if (node.body.type === 'BlockStatement') {
      code += this._indent('begin\n');
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
      code += this._indent('end;\n');
    } else {
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
    }

    return code;
  }

  _generateForStatement(node, options) {
    let code = this._indent('for ');

    if (node.init) {
      const init = this._generateNode(node.init, options);
      code += init.replace(/;\s*$/, ''); // Remove trailing semicolon
    }

    if (node.test) {
      code += ' to ';
      code += this._generateNode(node.test, options);
    }

    code += ' do\n';

    if (node.body.type === 'BlockStatement') {
      code += this._indent('begin\n');
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
      code += this._indent('end;\n');
    } else {
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
    }

    return code;
  }

  _generateForInStatement(node, options) {
    const variable = this._generateNode(node.left, options);
    const collection = this._generateNode(node.right, options);

    let code = this._indent(`for ${variable} in ${collection} do\n`);

    if (node.body.type === 'BlockStatement') {
      code += this._indent('begin\n');
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
      code += this._indent('end;\n');
    } else {
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
    }

    return code;
  }

  _generateForOfStatement(node, options) {
    // Delphi doesn't have for-of, convert to for-in
    return this._generateForInStatement(node, options);
  }

  _generateDoWhileStatement(node, options) {
    let code = this._indent('repeat\n');

    this.indentLevel++;
    code += this._generateNode(node.body, options);
    this.indentLevel--;

    code += this._indent('until not (');
    code += this._generateNode(node.test, options);
    code += ');\n';

    return code;
  }

  _generateSwitchStatement(node, options) {
    let code = this._indent('case ');
    code += this._generateNode(node.discriminant, options);
    code += ' of\n';

    this.indentLevel++;
    if (node.cases) {
      node.cases.forEach(caseNode => {
        code += this._generateNode(caseNode, options);
      });
    }
    this.indentLevel--;

    code += this._indent('end;\n');
    return code;
  }

  _generateSwitchCase(node, options) {
    let code = '';

    if (node.test) {
      code += this._indent(this._generateNode(node.test, options) + ':\n');
    } else {
      code += this._indent('else\n');
    }

    this.indentLevel++;
    if (node.consequent) {
      node.consequent.forEach(stmt => {
        if (stmt.type !== 'BreakStatement') {
          code += this._generateNode(stmt, options);
        }
      });
    }
    this.indentLevel--;

    return code;
  }

  _generateBreakStatement(node, options) {
    return this._indent('Break;\n');
  }

  _generateContinueStatement(node, options) {
    return this._indent('Continue;\n');
  }

  _generateCatchClause(node, options) {
    // This is handled in _generateTryStatement
    return '';
  }

  _generateFinallyClause(node, options) {
    // This is handled in _generateTryStatement
    return '';
  }

  _generateThrowStatement(node, options) {
    let code = this._indent('raise ');
    if (node.argument) {
      code += this._generateNode(node.argument, options);
    } else {
      code += 'Exception.Create(\'Exception raised\')';
    }
    code += ';\n';
    return code;
  }

  _generateWithStatement(node, options) {
    const obj = this._generateNode(node.object, options);
    let code = this._indent(`with ${obj} do\n`);

    if (node.body.type === 'BlockStatement') {
      code += this._indent('begin\n');
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
      code += this._indent('end;\n');
    } else {
      this.indentLevel++;
      code += this._generateNode(node.body, options);
      this.indentLevel--;
    }

    return code;
  }

  _generateLabeledStatement(node, options) {
    const label = this._generateNode(node.label, options);
    const stmt = this._generateNode(node.body, options);
    return this._indent(`${label}:\n${stmt}`);
  }

  _generateEmptyStatement(node, options) {
    return this._indent('{ Empty statement }\n');
  }

  _generateDebuggerStatement(node, options) {
    return this._indent('DebugBreak;\n');
  }

  // Expression generators
  _generateLogicalExpression(node, options) {
    return this._generateBinaryExpression(node, options);
  }

  _generateUnaryExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    let operator = node.operator;

    switch (operator) {
      case '!':
        operator = 'not';
        break;
      case '~':
        operator = 'not';
        break;
      case 'typeof':
        return `TypeInfo(${argument})`;
    }

    if (node.prefix) {
      return `${operator} ${argument}`;
    } else {
      return `${argument} ${operator}`;
    }
  }

  _generateUpdateExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    if (node.prefix) {
      if (operator === '++') {
        return `Inc(${argument})`;
      } else if (operator === '--') {
        return `Dec(${argument})`;
      }
    } else {
      // Post-increment/decrement not directly supported in Delphi
      if (operator === '++') {
        return `Inc(${argument})`;
      } else if (operator === '--') {
        return `Dec(${argument})`;
      }
    }

    return `${argument}${operator}`;
  }

  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);

    return `(if ${test} then ${consequent} else ${alternate})`;
  }

  _generateSequenceExpression(node, options) {
    const expressions = node.expressions.map(expr => this._generateNode(expr, options));
    return `(${expressions.join(', ')})`;
  }

  _generateNewExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    return `${callee}.Create(${args})`;
  }

  // Literal generators
  _generateStringLiteral(node, options) {
    return `'${node.value.replace(/'/g, "''")}'`;
  }

  _generateNumericLiteral(node, options) {
    return String(node.value);
  }

  _generateBooleanLiteral(node, options) {
    return node.value ? 'True' : 'False';
  }

  _generateNullLiteral(node, options) {
    return 'nil';
  }

  _generateRegExpLiteral(node, options) {
    this.uses.add('System.RegularExpressions');
    return `TRegEx.Create('${node.pattern}')`;
  }

  _generateTemplateLiteral(node, options) {
    if (!node.quasis || !node.expressions) {
      return "''";
    }

    let result = "'";
    for (let i = 0; i < node.quasis.length; i++) {
      result += node.quasis[i].value.cooked || node.quasis[i].value.raw || '';
      if (i < node.expressions.length) {
        result += "' + " + this._generateNode(node.expressions[i], options) + " + '";
      }
    }
    result += "'";

    return result;
  }

  _generateTaggedTemplateExpression(node, options) {
    const tag = this._generateNode(node.tag, options);
    const template = this._generateNode(node.quasi, options);
    return `${tag}(${template})`;
  }

  // Pattern generators
  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `{ Rest element: ${argument} }`;
  }

  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `{ Spread element: ${argument} }`;
  }

  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return `${left} := ${right}`;
  }

  _generateObjectPattern(node, options) {
    if (!node.properties) return '{}';
    const properties = node.properties.map(prop => this._generateNode(prop, options));
    return `{${properties.join(', ')}}`;
  }

  _generateArrayPattern(node, options) {
    if (!node.elements) return '[]';
    const elements = node.elements.map(elem => elem ? this._generateNode(elem, options) : 'nil');
    return `[${elements.join(', ')}]`;
  }

  _generateVariableDeclarator(node, options) {
    const id = this._generateNode(node.id, options);
    if (node.init) {
      const init = this._generateNode(node.init, options);
      return `${id} := ${init}`;
    }
    return id;
  }

  // Advanced feature generators
  _generateYieldExpression(node, options) {
    // Delphi doesn't have yield, simulate with result
    if (node.argument) {
      const argument = this._generateNode(node.argument, options);
      return `Result := ${argument}`;
    }
    return 'Result';
  }

  _generateAwaitExpression(node, options) {
    // Simulate with async/await pattern
    if (options.useAsyncAwait) {
      const argument = this._generateNode(node.argument, options);
      return `await ${argument}`;
    }
    return this._generateNode(node.argument, options);
  }

  _generateMetaProperty(node, options) {
    if (node.meta && node.property) {
      const meta = this._generateNode(node.meta, options);
      const property = this._generateNode(node.property, options);
      return `${meta}.${property}`;
    }
    return 'Self';
  }

  _generateImport(node, options) {
    // Convert to uses clause
    if (node.source) {
      const source = this._generateNode(node.source, options);
      this.uses.add(source.replace(/['"]/g, ''));
    }
    return '';
  }

  _generateImportDeclaration(node, options) {
    if (node.source) {
      const source = node.source.value || '';
      this.uses.add(source);
    }
    return '';
  }

  _generateImportSpecifier(node, options) {
    // Handled in import declaration
    return '';
  }

  _generateExportDeclaration(node, options) {
    // Delphi doesn't have exports in the same way, add to interface
    if (node.declaration) {
      return this._generateNode(node.declaration, options);
    }
    return '';
  }

  _generateExportSpecifier(node, options) {
    // Handled in export declaration
    return '';
  }

  _generateExportDefaultDeclaration(node, options) {
    if (node.declaration) {
      return this._generateNode(node.declaration, options);
    }
    return '';
  }

  _generateExportNamedDeclaration(node, options) {
    if (node.declaration) {
      return this._generateNode(node.declaration, options);
    }
    return '';
  }

  _generateExportAllDeclaration(node, options) {
    if (node.source) {
      const source = node.source.value || '';
      this.uses.add(source);
    }
    return '';
  }

  // Delphi-specific extensions
  _generateAttributeExpression(node, options) {
    if (!options.useAttributes) {
      return '{ Attributes not enabled }';
    }

    const name = node.name || 'Attribute';
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    return `[${name}${args ? `(${args})` : ''}]`;
  }

  _generateGenericExpression(node, options) {
    if (!options.useGenerics) {
      return '{ Generics not enabled }';
    }

    const name = this._generateNode(node.name, options);
    const typeArgs = node.typeArguments ?
      node.typeArguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    return `${name}<${typeArgs}>`;
  }

  _generateOpCodeExpression(node, options) {
    if (!options.useOpCodes) {
      return '{ OpCodes not enabled }';
    }

    this.cryptoOperations.add('OpCodes');
    const operation = node.operation || 'UnknownOp';
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    return `OpCodes.${operation}(${args})`;
  }

  _generateCryptoExpression(node, options) {
    if (!options.useCryptoExtensions) {
      return '{ Crypto extensions not enabled }';
    }

    this.uses.add('System.Hash');
    const operation = node.operation || 'UnknownCrypto';
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    return `${operation}(${args})`;
  }

  // Function expression generators
  _generateFunctionExpression(node, options) {
    if (options.useAnonymousMethods) {
      return this._generateAnonymousFunction(node, options);
    }

    // Fallback to named function
    const name = node.id ? node.id.name : 'AnonymousFunction';
    return this._generateFunction({...node, id: {name}}, options);
  }

  _generateArrowFunctionExpression(node, options) {
    if (options.useAnonymousMethods) {
      return this._generateAnonymousFunction(node, options);
    }

    // Convert to regular function
    return this._generateFunctionExpression(node, options);
  }

  _indent(code) {
    const indentStr = this.options.indent.repeat(this.indentLevel);
    return code.split('\n').map(line =>
      line.trim() ? indentStr + line : line
    ).join('\n');
  }

  /**
   * Check if Free Pascal Compiler (FPC) is available on the system
   * @private
   */
  _isFPCAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('fpc -h', {
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
   * Enhanced Delphi/Pascal code syntax validation using Free Pascal compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    const fpcAvailable = this._isFPCAvailable();
    if (!fpcAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Free Pascal Compiler (FPC) not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');

      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_delphi_${Date.now()}.pas`);

      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempFile, code);

      try {
        execSync(`fpc -S "${tempFile}"`, {
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true
        });

        // Cleanup
        const baseName = path.parse(tempFile).name;
        const baseDir = path.dirname(tempFile);

        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }

        const possibleOutputs = [
          path.join(baseDir, baseName + '.o'),
          path.join(baseDir, baseName + '.ppu'),
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

        return {
          success: true,
          method: 'fpc',
          error: null
        };

      } catch (error) {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }

        return {
          success: false,
          method: 'fpc',
          error: error.stderr?.toString() || error.message
        };
      }

    } catch (error) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Free Pascal Compiler not available - using basic validation'
      };
    }
  }

  /**
   * Enhanced compiler information with Delphi 12+ support
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Free Pascal Compiler (FPC) / Embarcadero Delphi',
      downloadUrl: 'https://www.freepascal.org/download.html',
      installInstructions: [
        'Free Pascal Compiler (Open Source):',
        '  Download from https://www.freepascal.org/download.html',
        '  Windows: Run installer and add to PATH',
        '  Ubuntu/Debian: sudo apt install fpc',
        '  macOS: brew install fpc',
        '',
        'Embarcadero Delphi (Commercial):',
        '  Download Community Edition from https://www.embarcadero.com/products/delphi/starter',
        '  Professional/Enterprise editions for commercial use',
        '  Includes modern Delphi 12+ features and comprehensive IDE',
        '',
        'Lazarus IDE (Free):',
        '  Download from https://www.lazarus-ide.org/',
        '  Includes Free Pascal Compiler',
        '  Cross-platform RAD development environment',
        '',
        'Verification:',
        '  fpc -h (for Free Pascal)',
        '  dcc32 -h (for Delphi compiler)'
      ].join('\n'),
      verifyCommand: 'fpc -h',
      alternativeValidation: 'Enhanced syntax checking (balanced brackets, Pascal keywords)',
      packageManager: 'fppkg (FPC) / GetIt Package Manager (Delphi)',
      documentation: 'https://www.freepascal.org/docs.html',
      modernFeatures: [
        'Delphi 12+ Language Features:',
        '  - Inline functions and procedures',
        '  - Generics with constraints',
        '  - Anonymous methods and closures',
        '  - Attributes and RTTI',
        '  - Record and class helpers',
        '  - Parallel Programming Library',
        '  - Enhanced string handling',
        '  - Modern memory management'
      ].join('\n')
    };
  }
}

// Register the enhanced plugin
const delphiPlugin = new DelphiPlugin();
LanguagePlugins.Add(delphiPlugin);

// Export for potential direct use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = delphiPlugin;
}

})(); // End of IIFE