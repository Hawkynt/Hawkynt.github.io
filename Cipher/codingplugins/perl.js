/**
 * Perl Language Plugin for Multi-Language Code Generation
 * Production-ready Perl 5.38+ code generator with comprehensive AST support
 * Includes modern Perl features, crypto extensions, and 75+ AST node types
 *
 * Features:
 * - Modern Perl 5.38+ syntax (signatures, try/catch, class keyword)
 * - OpCodes integration for cryptographic operations
 * - Comprehensive warnings system (10+ Perl-specific best practices)
 * - Full CPAN crypto modules support (Crypt::*, Digest::*, CryptX)
 * - Advanced type inference with context sensitivity
 * - Complete package and namespace management
 * - 75+ AST node types with proper generation methods
 *
 * @version 2.0.0
 * @requires Perl 5.38+
 * @follows LanguagePlugin specification exactly
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
    this.description = 'Production-ready Perl 5.38+ code generator with crypto extensions';
    this.mimeType = 'text/x-perl';
    this.version = '5.38+';

    // Perl-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      strictTypes: false,
      useStrict: true,
      useWarnings: true,
      addSignatures: true, // Modern Perl 5.36+ feature
      useExperimentalFeatures: true, // try/catch, class, etc.
      useCryptoExtensions: true,
      usePostfixDeref: true, // Modern dereferencing
      useMultidimensionalArrays: true,
      useModernOOP: true, // class keyword, field attributes
      packageName: 'CipherGenerated',
      useContextSensitivity: true,
      addTypeComments: true,
      useCPANModules: true,
      enableBestPractices: true,
      addComprehensiveWarnings: true
    };
    
    // Internal state
    this.indentLevel = 0;
    this.currentPackage = null;
    this.usedModules = new Set();
    this.declaredVariables = new Map();
    this.cryptoOperations = new Set();
    this.contextStack = ['void']; // Track Perl contexts
    this.warnings = [];
    this.scopeStack = []; // Track lexical scopes
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
      let finalCode = this._wrapWithPragmas(code, mergedOptions);

      // Apply line ending preference
      if (mergedOptions.lineEnding !== '\n') {
        finalCode = finalCode.replace(/\n/g, mergedOptions.lineEnding);
      }

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
   * Generate code for any AST node - 75+ supported types
   * @private
   */
  _generateNode(node, options) {
    if (!node || !node.type) {
      return '';
    }

    switch (node.type) {
      // Core language constructs
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
        return '$self';
      case 'Super':
        return 'SUPER';
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

      // Control flow statements
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

      // Modern JavaScript features
      case 'MetaProperty':
        return this._generateMetaProperty(node, options);
      case 'AwaitExpression':
        return this._generateAwaitExpression(node, options);
      case 'YieldExpression':
        return this._generateYieldExpression(node, options);
      case 'ImportDeclaration':
        return this._generateImportDeclaration(node, options);
      case 'ExportDefaultDeclaration':
        return this._generateExportDefaultDeclaration(node, options);
      case 'ExportNamedDeclaration':
        return this._generateExportNamedDeclaration(node, options);
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

      // Additional expression types
      case 'RegExpLiteral':
        return this._generateRegExpLiteral(node, options);
      case 'BigIntLiteral':
        return this._generateBigIntLiteral(node, options);
      case 'ParenthesizedExpression':
        return this._generateParenthesizedExpression(node, options);

      // Type-related (for TypeScript compatibility)
      case 'TSTypeAnnotation':
        return this._generateTSTypeAnnotation(node, options);
      case 'TSAsExpression':
        return this._generateTSAsExpression(node, options);
      case 'TSNonNullExpression':
        return this._generateTSNonNullExpression(node, options);

      // JSX support (if needed)
      case 'JSXElement':
        return this._generateJSXElement(node, options);
      case 'JSXFragment':
        return this._generateJSXFragment(node, options);
      case 'JSXText':
        return this._generateJSXText(node, options);
      case 'JSXExpressionContainer':
        return this._generateJSXExpressionContainer(node, options);

      default:
        this._addWarning(`Unsupported AST node type: ${node.type}`);
        // Generate minimal valid Perl code with warning comment
        return '{\n' + this._indent('# WARNING: Unhandled AST node type: ' + node.type + '\n') + this._indent('die "Not implemented: ' + node.type + '";\n') + '}';
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

    // Reset state for new program
    this.currentPackage = options.packageName || 'main';
    this.usedModules.clear();
    this.cryptoOperations.clear();
    this.warnings = [];

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

    // OpCodes integration check
    if (options.useCryptoExtensions && this._isCryptoFunction(functionName)) {
      this.cryptoOperations.add(functionName);
    }

    // Function signature with modern Perl features
    if (options.addSignatures && node.params && node.params.length > 0) {
      // Modern Perl with signatures (5.36+)
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        const sigil = this._inferSigil(param, options);
        return `${sigil}${paramName}`;
      });
      code += this._indent(`sub ${functionName} (${params.join(', ')}) {\n`);
    } else if (options.addSignatures && (!node.params || node.params.length === 0)) {
      code += this._indent(`sub ${functionName} () {\n`);
    } else {
      // Traditional Perl
      code += this._indent(`sub ${functionName} {\n`);

      // Parameter extraction
      if (node.params && node.params.length > 0) {
        this.indentLevel++;
        const params = node.params.map((param, index) => {
          const paramName = param.name || 'param' + index;
          const sigil = this._inferSigil(param, options);
          return `my ${sigil}${paramName} = $_[${index}];`;
        });
        code += this._indent(params.join('\n') + '\n\n');
        this.indentLevel--;
      }
    }

    // Function body
    this.indentLevel++;
    this._pushScope('function');
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("return;\n");
    } else {
      code += this._indent("return;\n");
    }
    this._popScope();
    this.indentLevel--;

    code += this._indent('}\n');

    return code;
  }

  /**
   * Generate class declaration (modern Perl 5.38+ class syntax)
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? node.id.name : 'UnnamedClass';
    let code = '';

    // Get class body members - handle both node.body and node.body.body
    const bodyMembers = node.body?.body || node.body || [];

    if (options.useModernOOP && options.useExperimentalFeatures) {
      // Modern Perl 5.38+ class syntax
      code += this._indent(`class ${className}`);
      if (node.superClass) {
        const superName = this._generateNode(node.superClass, options);
        code += ` :isa(${superName})`;
      }
      code += ' {\n';

      this.indentLevel++;
      this._pushScope('class');

      // Class body
      if (bodyMembers.length > 0) {
        const members = bodyMembers
          .map(member => this._generateNode(member, options))
          .filter(m => m && m.trim());
        code += members.join('\n\n');
      }

      this._popScope();
      this.indentLevel--;
      code += '\n' + this._indent('}\n');
    } else {
      // Traditional Moo/Moose style
      code += this._indent(`package ${className};\n\n`);

      // Use modern object system
      this.usedModules.add('Moo');
      code += this._indent('use Moo;\n');

      if (node.superClass) {
        const superName = this._generateNode(node.superClass, options);
        code += this._indent(`extends '${superName}';\n`);
      }

      code += '\n';

      // Class body (methods and attributes)
      if (bodyMembers.length > 0) {
        const methods = bodyMembers
          .map(method => this._generateNode(method, options))
          .filter(m => m && m.trim());
        code += methods.join('\n\n');
      }

      // End package
      code += '\n' + this._indent('1; # End of package\n');
    }

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
    const isStatic = node.static;

    if (isConstructor) {
      // Generate constructor as BUILDARGS for Moo/Moose or new() for traditional
      if (options.useModernOOP && options.useExperimentalFeatures) {
        // Modern Perl class - constructor is implicit, just generate ADJUST block if needed
        if (!node.value.body || !node.value.body.body || node.value.body.body.length === 0) {
          return ''; // Empty constructor
        }

        const params = node.value.params || [];
        let code = '';

        // Generate ADJUST block with constructor parameters
        if (params.length > 0) {
          code += this._indent(`ADJUST (${params.map(p => '$' + p.name).join(', ')}) {\n`);
        } else {
          code += this._indent('ADJUST {\n');
        }

        this.indentLevel++;
        this._pushScope('method');

        // Extract field initializations from constructor
        if (node.value.body) {
          const bodyCode = this._generateNode(node.value.body, options);
          code += bodyCode || this._indent("# empty constructor\n");
        }

        this._popScope();
        this.indentLevel--;
        code += this._indent('}\n');
        return code;
      } else {
        // Traditional Moo/Moose style - generate BUILD method
        const params = node.value.params || [];
        let code = this._indent('sub BUILD {\n');
        this.indentLevel++;
        code += this._indent('my ($self');
        if (params.length > 0) {
          code += ', ' + params.map(p => '$' + p.name).join(', ');
        }
        code += ') = @_;\n\n';

        // Generate body
        if (node.value.body) {
          const bodyCode = this._generateNode(node.value.body, options);
          code += bodyCode || this._indent("# empty constructor\n");
        }

        this.indentLevel--;
        code += this._indent('}\n');
        return code;
      }
    }

    // Generate regular method with $self as first parameter
    const params = node.value.params || [];
    const perlFunctionNode = {
      id: { name: methodName },
      params: [{ name: 'self' }, ...params],
      body: node.value.body
    };

    return this._generateFunction(perlFunctionNode, options);
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
        let typeComment = '';

        // Add type comments if enabled or required by strictTypes
        if (options.addTypeComments || options.strictTypes) {
          if (decl.id && decl.id.typeAnnotation) {
            typeComment = this._generateTSTypeAnnotation(decl.id, options);
          } else if (options.strictTypes && decl.init) {
            // Infer type from initialization when strictTypes is enabled
            const inferredType = this._inferType(decl.init);
            typeComment = ` # ${inferredType}`;
          } else if (options.strictTypes) {
            // Require explicit type when strictTypes is enabled
            this._addWarning(`Variable ${varName} lacks type information`);
            typeComment = ' # unknown';
          }
        }

        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          return this._indent(`my ${varName} = ${initValue};${typeComment}\n`);
        } else {
          return this._indent(`my ${varName};${typeComment}\n`);
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
    // OpCodes integration for crypto operations (always check, regardless of options)
    if (this._isOpCodesCall(node)) {
      return this._generateOpCodesCall(node, options);
    }

    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle method calls vs function calls
    if (node.callee && node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const method = node.callee.property.name || node.callee.property;

      // Handle special array methods
      if (method === 'push') {
        // Convert array.push(x) to push @{$array_ref}, $x or push @array, $x
        if (object.startsWith('$self->{') || object.includes('->')) {
          // It's a hash reference access like $self->{_buffer}
          return `push @{${object}}, ${args}`;
        } else {
          const arrayName = object.replace(/^\$/, '@');
          return `push ${arrayName}, ${args}`;
        }
      } else if (method === 'pop') {
        if (object.startsWith('$self->{') || object.includes('->')) {
          return `pop @{${object}}`;
        } else {
          const arrayName = object.replace(/^\$/, '@');
          return `pop ${arrayName}`;
        }
      } else if (method === 'shift') {
        if (object.startsWith('$self->{') || object.includes('->')) {
          return `shift @{${object}}`;
        } else {
          const arrayName = object.replace(/^\$/, '@');
          return `shift ${arrayName}`;
        }
      } else if (method === 'unshift') {
        if (object.startsWith('$self->{') || object.includes('->')) {
          return `unshift @{${object}}, ${args}`;
        } else {
          const arrayName = object.replace(/^\$/, '@');
          return `unshift ${arrayName}, ${args}`;
        }
      } else if (method === 'splice') {
        if (object.startsWith('$self->{') || object.includes('->')) {
          return `splice @{${object}}, ${args}`;
        } else {
          const arrayName = object.replace(/^\$/, '@');
          return `splice ${arrayName}, ${args}`;
        }
      }

      // Regular method call
      return `${object}->${method}(${args})`;
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
    const propertyName = node.property.name || node.property;

    // Handle array.length as scalar(@array) or scalar(@{$ref})
    if (propertyName === 'length' && !node.computed) {
      if (object.startsWith('$') && !object.startsWith('$self')) {
        // Regular scalar variable - convert to array
        const arrayName = object.replace(/^\$/, '@');
        return `scalar(${arrayName})`;
      } else if (object.includes('->') || object.includes('{')) {
        // Reference access like $self->{items} - needs dereferencing
        return `scalar(@{${object}})`;
      } else {
        const arrayName = object.replace(/^\$/, '@');
        return `scalar(${arrayName})`;
      }
    }

    // Handle computed member access (array indexing or hash access)
    if (node.computed) {
      const index = this._generateNode(node.property, options);
      // Array indexing: convert $array[$index] syntax
      if (object.startsWith('$')) {
        return `${object}[${index}]`;
      } else if (object.startsWith('@')) {
        return `${object}[${index}]`;
      } else if (object.startsWith('%')) {
        return `${object}{${index}}`;
      } else {
        // For $self->{field} or other references, use arrow notation
        // Check if we're accessing nested multidimensional arrays
        if (options.useMultidimensionalArrays && this._isNestedArrayAccess(node)) {
          // Modern multidimensional array syntax (Perl 5.36+)
          return `${object}[${index}]`;
        } else {
          // Traditional array of array references
          return `${object}->[${index}]`;
        }
      }
    }

    // Non-computed property access (hash key or method)
    const property = `->{${propertyName}}`;

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
    const name = this._toPerlName(node.name);
    // Don't add $ if the name already starts with a sigil
    if (name.startsWith('$') || name.startsWith('@') || name.startsWith('%')) {
      return name;
    }
    return '$' + name;
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

  // ======================== COMPREHENSIVE AST NODE GENERATORS ========================

  /**
   * Generate array expression
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '[]';
    }

    const elements = node.elements.map(element => {
      if (element === null) return 'undef';
      return this._generateNode(element, options);
    });

    // Context sensitivity: in list context, use qw() for simple word lists
    if (options.useContextSensitivity && this._isSimpleWordList(node)) {
      const words = node.elements.map(e => e.value).join(' ');
      return `qw(${words})`;
    }

    return `[${elements.join(', ')}]`;
  }

  /**
   * Generate object expression (hash in Perl)
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '{}';
    }

    const properties = node.properties.map(prop => this._generateNode(prop, options));
    return `{${properties.join(', ')}}`;
  }

  /**
   * Generate property (for object/hash properties)
   * @private
   */
  _generateProperty(node, options) {
    const key = node.computed ?
      this._generateNode(node.key, options) :
      `"${node.key.name || node.key.value}"`;
    const value = this._generateNode(node.value, options);
    return `${key} => ${value}`;
  }

  /**
   * Generate function expression (anonymous sub)
   * @private
   */
  _generateFunctionExpression(node, options) {
    let code = 'sub ';

    if (options.addSignatures && node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        const sigil = this._inferSigil(param, options);
        return `${sigil}${paramName}`;
      });
      code += `(${params.join(', ')}) `;
    }

    code += '{\n';
    this.indentLevel++;

    if (!options.addSignatures && node.params && node.params.length > 0) {
      const params = node.params.map((param, index) => {
        const paramName = param.name || 'param' + index;
        const sigil = this._inferSigil(param, options);
        return `my ${sigil}${paramName} = $_[${index}];`;
      });
      code += this._indent(params.join('\n') + '\n\n');
    }

    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("return;\n");
    }

    this.indentLevel--;
    code += this._indent('}');

    return code;
  }

  /**
   * Generate arrow function expression (modern anonymous sub)
   * @private
   */
  _generateArrowFunctionExpression(node, options) {
    // Perl doesn't have arrow functions, convert to anonymous sub
    return this._generateFunctionExpression(node, options);
  }

  /**
   * Generate new expression (object construction)
   * @private
   */
  _generateNewExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    return `${callee}->new(${args})`;
  }

  /**
   * Generate unary expression
   * @private
   */
  _generateUnaryExpression(node, options) {
    const operator = this._mapUnaryOperator(node.operator);
    const argument = this._generateNode(node.argument, options);

    if (node.prefix) {
      return `${operator}${argument}`;
    } else {
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
   * Generate logical expression (&&, ||)
   * @private
   */
  _generateLogicalExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapLogicalOperator(node.operator);
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
   * Generate sequence expression (comma operator)
   * @private
   */
  _generateSequenceExpression(node, options) {
    const expressions = node.expressions.map(expr => this._generateNode(expr, options));
    return `(${expressions.join(', ')})`;
  }

  /**
   * Generate template literal (interpolated strings)
   * @private
   */
  _generateTemplateLiteral(node, options) {
    if (!node.expressions || node.expressions.length === 0) {
      return `"${node.quasis[0].value.raw}"`;
    }

    let result = '"';
    for (let i = 0; i < node.quasis.length; i++) {
      result += node.quasis[i].value.raw;
      if (i < node.expressions.length) {
        const expr = this._generateNode(node.expressions[i], options);
        result += `\${${expr}}`;
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
   * Generate rest element (...)
   * @private
   */
  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `@${argument.substring(1)}`; // Convert $var to @var for arrays
  }

  /**
   * Generate spread element (...)
   * @private
   */
  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    if (argument.startsWith('@')) {
      return argument; // Already an array
    } else if (argument.startsWith('$')) {
      return `@{${argument}}`;
    }
    return `@{${argument}}`;
  }

  /**
   * Generate assignment pattern (default parameters)
   * @private
   */
  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return `${left} // ${right}`; // Perl's defined-or operator
  }

  /**
   * Generate object pattern (destructuring)
   * @private
   */
  _generateObjectPattern(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '()';
    }

    const properties = node.properties.map(prop => {
      if (prop.type === 'Property') {
        const key = prop.key.name || prop.key.value;
        const value = this._generateNode(prop.value, options);
        return `${value}`;
      }
      return this._generateNode(prop, options);
    });

    return `my (${properties.join(', ')}) = @{$_[0]}{qw(${node.properties.map(p => p.key.name || p.key.value).join(' ')})}`;
  }

  /**
   * Generate array pattern (array destructuring)
   * @private
   */
  _generateArrayPattern(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '()';
    }

    const elements = node.elements.map((element, index) => {
      if (element === null) return 'undef';
      return this._generateNode(element, options);
    });

    return `my (${elements.join(', ')}) = @_`;
  }

  /**
   * Generate variable declarator
   * @private
   */
  _generateVariableDeclarator(node, options) {
    const varName = this._generateNode(node.id, options);
    if (node.init) {
      const initValue = this._generateNode(node.init, options);
      return `${varName} = ${initValue}`;
    } else {
      return varName;
    }
  }

  // ==================== CONTROL FLOW STATEMENTS ====================

  /**
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    const test = this._generateNode(node.test, options);
    let code = this._indent(`if (${test}) {\n`);

    this.indentLevel++;
    const consequent = this._generateNode(node.consequent, options);
    code += consequent || this._indent("# empty block\n");
    this.indentLevel--;

    if (node.alternate) {
      if (node.alternate.type === 'IfStatement') {
        code += this._indent('} elsif');
        code += this._generateIfStatement(node.alternate, options).replace(/^if/, '');
      } else {
        code += this._indent('} else {\n');
        this.indentLevel++;
        const alternate = this._generateNode(node.alternate, options);
        code += alternate || this._indent("# empty block\n");
        this.indentLevel--;
        code += this._indent('}\n');
      }
    } else {
      code += this._indent('}\n');
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
    const body = this._generateNode(node.body, options);
    code += body || this._indent("# empty loop\n");
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for statement
   * @private
   */
  _generateForStatement(node, options) {
    // Extract init, test, and update parts
    let init = '';
    if (node.init) {
      const initCode = this._generateNode(node.init, options);
      // Remove 'my ' if present and trailing semicolon
      init = initCode.trim().replace(/^my\s+/, '').replace(/;\s*$/, '').trim();
    }

    const test = node.test ? this._generateNode(node.test, options) : '';
    const update = node.update ? this._generateNode(node.update, options) : '';

    let code = this._indent(`for (my ${init}; ${test}; ${update}) {\n`);

    this.indentLevel++;
    const body = this._generateNode(node.body, options);
    code += body || this._indent("# empty loop\n");
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for-in statement (foreach in Perl)
   * @private
   */
  _generateForInStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const varName = left.replace(/^my /, '').replace(/^\$/, '');

    let code = this._indent(`foreach my $${varName} (keys %{${right}}) {\n`);

    this.indentLevel++;
    const body = this._generateNode(node.body, options);
    code += body || this._indent("# empty loop\n");
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for-of statement (foreach in Perl)
   * @private
   */
  _generateForOfStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const varName = left.replace(/^my /, '').replace(/^\$/, '');

    let code = this._indent(`foreach my $${varName} (@{${right}}) {\n`);

    this.indentLevel++;
    const body = this._generateNode(node.body, options);
    code += body || this._indent("# empty loop\n");
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
    const body = this._generateNode(node.body, options);
    code += body || this._indent("# empty loop\n");
    this.indentLevel--;

    const test = this._generateNode(node.test, options);
    code += this._indent(`} while (${test});\n`);

    return code;
  }

  /**
   * Generate switch statement (given/when in modern Perl)
   * @private
   */
  _generateSwitchStatement(node, options) {
    const discriminant = this._generateNode(node.discriminant, options);

    if (options.useExperimentalFeatures) {
      // Modern Perl given/when
      let code = this._indent(`given (${discriminant}) {\n`);

      this.indentLevel++;
      if (node.cases && node.cases.length > 0) {
        node.cases.forEach(caseNode => {
          code += this._generateSwitchCase(caseNode, options);
        });
      }
      this.indentLevel--;

      code += this._indent('}\n');
      return code;
    } else {
      // Traditional if/elsif chain
      let code = '';
      let isFirst = true;

      if (node.cases && node.cases.length > 0) {
        node.cases.forEach(caseNode => {
          if (caseNode.test === null) {
            // Default case
            code += this._indent('else {\n');
          } else {
            const test = this._generateNode(caseNode.test, options);
            if (isFirst) {
              code += this._indent(`if (${discriminant} eq ${test}) {\n`);
              isFirst = false;
            } else {
              code += this._indent(`} elsif (${discriminant} eq ${test}) {\n`);
            }
          }

          this.indentLevel++;
          if (caseNode.consequent && caseNode.consequent.length > 0) {
            caseNode.consequent.forEach(stmt => {
              code += this._generateNode(stmt, options);
            });
          }
          this.indentLevel--;
        });

        code += this._indent('}\n');
      }

      return code;
    }
  }

  /**
   * Generate switch case
   * @private
   */
  _generateSwitchCase(node, options) {
    let code = '';

    if (node.test === null) {
      // Default case
      code += this._indent('default {\n');
    } else {
      const test = this._generateNode(node.test, options);
      code += this._indent(`when (${test}) {\n`);
    }

    this.indentLevel++;
    if (node.consequent && node.consequent.length > 0) {
      node.consequent.forEach(stmt => {
        code += this._generateNode(stmt, options);
      });
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate break statement
   * @private
   */
  _generateBreakStatement(node, options) {
    return this._indent('last;\n');
  }

  /**
   * Generate continue statement
   * @private
   */
  _generateContinueStatement(node, options) {
    return this._indent('next;\n');
  }

  /**
   * Generate try statement
   * @private
   */
  _generateTryStatement(node, options) {
    if (options.useExperimentalFeatures) {
      // Modern Perl try/catch (5.34+)
      let code = this._indent('try {\n');

      this.indentLevel++;
      const tryBlock = this._generateNode(node.block, options);
      code += tryBlock || this._indent("# empty try block\n");
      this.indentLevel--;

      if (node.handler) {
        code += this._generateCatchClause(node.handler, options);
      }

      if (node.finalizer) {
        code += this._indent('} finally {\n');
        this.indentLevel++;
        const finallyBlock = this._generateNode(node.finalizer, options);
        code += finallyBlock || this._indent("# empty finally block\n");
        this.indentLevel--;
      }

      code += this._indent('}\n');
      return code;
    } else {
      // Traditional eval/die pattern
      let code = this._indent('eval {\n');

      this.indentLevel++;
      const tryBlock = this._generateNode(node.block, options);
      code += tryBlock || this._indent("# empty try block\n");
      this.indentLevel--;

      code += this._indent('};\n');

      if (node.handler) {
        const param = node.handler.param ? node.handler.param.name : 'error';
        code += this._indent(`if ($@) {\n`);
        this.indentLevel++;
        code += this._indent(`my $${param} = $@;\n`);
        const catchBlock = this._generateNode(node.handler.body, options);
        code += catchBlock || this._indent("# empty catch block\n");
        this.indentLevel--;
        code += this._indent('}\n');
      }

      if (node.finalizer) {
        const finallyBlock = this._generateNode(node.finalizer, options);
        code += finallyBlock || '';
      }

      return code;
    }
  }

  /**
   * Generate catch clause
   * @private
   */
  _generateCatchClause(node, options) {
    const param = node.param ? node.param.name : 'error';

    if (options.useExperimentalFeatures) {
      let code = this._indent(`} catch ($${param}) {\n`);

      this.indentLevel++;
      const body = this._generateNode(node.body, options);
      code += body || this._indent("# empty catch block\n");
      this.indentLevel--;

      return code;
    } else {
      // Handled in _generateTryStatement for traditional pattern
      return '';
    }
  }

  /**
   * Generate throw statement
   * @private
   */
  _generateThrowStatement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return this._indent(`die ${argument};\n`);
  }

  /**
   * Generate empty statement
   * @private
   */
  _generateEmptyStatement(node, options) {
    return this._indent(";\n");
  }

  /**
   * Generate debugger statement
   * @private
   */
  _generateDebuggerStatement(node, options) {
    this.usedModules.add('Perl::Tidy'); // For debugging support
    return this._indent('$DB::single = 1; # debugger breakpoint\n');
  }

  /**
   * Generate with statement (not supported in Perl)
   * @private
   */
  _generateWithStatement(node, options) {
    this._addWarning('With statements are not supported in Perl');
    return this._indent('# With statement not supported in Perl\n');
  }

  /**
   * Generate labeled statement
   * @private
   */
  _generateLabeledStatement(node, options) {
    const label = node.label.name;
    const body = this._generateNode(node.body, options);
    return `${label}: ${body}`;
  }

  // ==================== MODERN JAVASCRIPT FEATURES ====================

  /**
   * Generate meta property (new.target, import.meta)
   * @private
   */
  _generateMetaProperty(node, options) {
    if (node.meta.name === 'new' && node.property.name === 'target') {
      return '__PACKAGE__'; // Perl equivalent
    }
    if (node.meta.name === 'import' && node.property.name === 'meta') {
      return '__FILE__'; // Closest Perl equivalent
    }
    return `${node.meta.name}.${node.property.name}`;
  }

  /**
   * Generate await expression (async/await not native in Perl)
   * @private
   */
  _generateAwaitExpression(node, options) {
    this._addWarning('Async/await requires Future::AsyncAwait or similar module');
    this.usedModules.add('Future::AsyncAwait');
    const argument = this._generateNode(node.argument, options);
    return `await(${argument})`;
  }

  /**
   * Generate yield expression (generators)
   * @private
   */
  _generateYieldExpression(node, options) {
    this._addWarning('Generators require Iterator::Simple or similar module');
    this.usedModules.add('Iterator::Simple');
    if (node.argument) {
      const argument = this._generateNode(node.argument, options);
      return `yield(${argument})`;
    }
    return 'yield()';
  }

  /**
   * Generate import declaration
   * @private
   */
  _generateImportDeclaration(node, options) {
    const source = node.source.value;
    let code = '';

    if (node.specifiers && node.specifiers.length > 0) {
      node.specifiers.forEach(spec => {
        if (spec.type === 'ImportDefaultSpecifier') {
          const local = spec.local.name;
          code += this._indent(`use ${source};\n`);
          code += this._indent(`my $${local} = ${source}->new();\n`);
        } else if (spec.type === 'ImportSpecifier') {
          const imported = spec.imported.name;
          const local = spec.local.name;
          code += this._indent(`use ${source} qw(${imported});\n`);
          if (imported !== local) {
            code += this._indent(`*${local} = \\&${imported};\n`);
          }
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          const local = spec.local.name;
          code += this._indent(`use ${source};\n`);
          code += this._indent(`my $${local} = ${source};\n`);
        }
      });
    } else {
      code += this._indent(`use ${source};\n`);
    }

    this.usedModules.add(source);
    return code;
  }

  /**
   * Generate export default declaration
   * @private
   */
  _generateExportDefaultDeclaration(node, options) {
    const declaration = this._generateNode(node.declaration, options);
    return declaration; // Perl doesn't have exports in the same way
  }

  /**
   * Generate export named declaration
   * @private
   */
  _generateExportNamedDeclaration(node, options) {
    if (node.declaration) {
      return this._generateNode(node.declaration, options);
    }
    // Handle export { name } syntax
    return ''; // Perl doesn't have named exports
  }

  /**
   * Generate class expression
   * @private
   */
  _generateClassExpression(node, options) {
    // Similar to class declaration but anonymous
    return this._generateClass(node, options);
  }

  /**
   * Generate property definition (class fields)
   * @private
   */
  _generatePropertyDefinition(node, options) {
    const key = node.key.name || node.key.value;
    const value = node.value ? this._generateNode(node.value, options) : 'undef';

    if (options.useModernOOP && options.useExperimentalFeatures) {
      // Modern Perl class field
      const staticKeyword = node.static ? 'our ' : 'field ';
      if (node.value) {
        return this._indent(`${staticKeyword}$${key} = ${value};\n`);
      } else {
        return this._indent(`${staticKeyword}$${key};\n`);
      }
    } else {
      // Traditional Moo/Moose attribute
      let code = this._indent(`has '${key}' => (\n`);
      this.indentLevel++;
      code += this._indent(`is => 'rw',\n`);
      if (node.value) {
        code += this._indent(`default => sub { ${value} },\n`);
      }
      this.indentLevel--;
      code += this._indent(');\n');
      return code;
    }
  }

  /**
   * Generate private identifier
   * @private
   */
  _generatePrivateIdentifier(node, options) {
    return `_${node.name}`; // Perl convention for private
  }

  /**
   * Generate static block
   * @private
   */
  _generateStaticBlock(node, options) {
    let code = this._indent('BEGIN {\n');
    this.indentLevel++;
    const body = this._generateNode(node.body, options);
    code += body || this._indent("# empty static block\n");
    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate chain expression (optional chaining)
   * @private
   */
  _generateChainExpression(node, options) {
    // Perl doesn't have optional chaining, generate with checks
    const expression = this._generateNode(node.expression, options);
    this._addWarning('Optional chaining converted to explicit checks');
    return `(defined ${expression} ? ${expression} : undef)`;
  }

  /**
   * Generate import expression (dynamic import)
   * @private
   */
  _generateImportExpression(node, options) {
    const source = this._generateNode(node.source, options);
    this._addWarning('Dynamic imports require Module::Runtime or similar');
    this.usedModules.add('Module::Runtime');
    return `require_module(${source})`;
  }

  // ==================== ADDITIONAL EXPRESSION TYPES ====================

  /**
   * Generate regular expression literal
   * @private
   */
  _generateRegExpLiteral(node, options) {
    const pattern = node.pattern;
    const flags = node.flags || '';

    // Convert JS flags to Perl modifiers
    let perlFlags = '';
    if (flags.includes('i')) perlFlags += 'i';
    if (flags.includes('m')) perlFlags += 'm';
    if (flags.includes('s')) perlFlags += 's';
    if (flags.includes('x')) perlFlags += 'x';
    if (flags.includes('g')) perlFlags += 'g';

    return `qr/${pattern}/${perlFlags}`;
  }

  /**
   * Generate BigInt literal
   * @private
   */
  _generateBigIntLiteral(node, options) {
    this.usedModules.add('Math::BigInt');
    const value = node.value.toString().replace(/n$/, '');
    return `Math::BigInt->new('${value}')`;
  }

  /**
   * Generate parenthesized expression
   * @private
   */
  _generateParenthesizedExpression(node, options) {
    const expression = this._generateNode(node.expression, options);
    return `(${expression})`;
  }

  // ==================== TYPESCRIPT COMPATIBILITY ====================

  /**
   * Generate TypeScript type annotation
   * @private
   */
  _generateTSTypeAnnotation(node, options) {
    // Perl doesn't have type annotations, add as comment
    if (options.addTypeComments) {
      return ` # ${this._generateTSType(node.typeAnnotation, options)}`;
    }
    return '';
  }

  /**
   * Generate TypeScript as expression
   * @private
   */
  _generateTSAsExpression(node, options) {
    // Just return the expression, ignore the type assertion
    return this._generateNode(node.expression, options);
  }

  /**
   * Generate TypeScript non-null expression
   * @private
   */
  _generateTSNonNullExpression(node, options) {
    // Just return the expression
    return this._generateNode(node.expression, options);
  }

  /**
   * Generate TypeScript type
   * @private
   */
  _generateTSType(node, options) {
    if (!node) return 'any';

    switch (node.type) {
      case 'TSStringKeyword': return 'string';
      case 'TSNumberKeyword': return 'number';
      case 'TSBooleanKeyword': return 'boolean';
      case 'TSArrayType':
        return `Array<${this._generateTSType(node.elementType, options)}>`;
      default:
        return node.type || 'any';
    }
  }

  /**
   * Infer Perl type from AST node
   * @private
   */
  _inferType(node) {
    if (!node) return 'unknown';

    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') return 'string';
        if (typeof node.value === 'number') return 'number';
        if (typeof node.value === 'boolean') return 'boolean';
        if (node.value === null) return 'undef';
        return 'scalar';
      case 'ArrayExpression':
        return 'arrayref';
      case 'ObjectExpression':
        return 'hashref';
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return 'coderef';
      case 'NewExpression':
        return 'object';
      case 'BinaryExpression':
        if (['+', '-', '*', '/', '%', '**'].includes(node.operator)) return 'number';
        if (['==', '!=', '<', '>', '<=', '>='].includes(node.operator)) return 'boolean';
        if (['.', 'x'].includes(node.operator)) return 'string';
        return 'scalar';
      case 'LogicalExpression':
        return 'boolean';
      case 'UnaryExpression':
        if (node.operator === '!') return 'boolean';
        if (node.operator === '-' || node.operator === '+') return 'number';
        return 'scalar';
      case 'CallExpression':
        // Try to infer from function name
        if (node.callee && node.callee.name) {
          const funcName = node.callee.name.toLowerCase();
          if (funcName.includes('array') || funcName.includes('list')) return 'arrayref';
          if (funcName.includes('hash') || funcName.includes('object')) return 'hashref';
          if (funcName.includes('string') || funcName.includes('str')) return 'string';
          if (funcName.includes('number') || funcName.includes('int')) return 'number';
        }
        return 'scalar';
      case 'MemberExpression':
        return 'scalar';
      case 'Identifier':
        return 'scalar';
      default:
        return 'unknown';
    }
  }

  // ==================== JSX SUPPORT ====================

  /**
   * Generate JSX element (not applicable to Perl)
   * @private
   */
  _generateJSXElement(node, options) {
    this._addWarning('JSX is not applicable to Perl');
    return '# JSX not supported in Perl';
  }

  /**
   * Generate JSX fragment
   * @private
   */
  _generateJSXFragment(node, options) {
    this._addWarning('JSX is not applicable to Perl');
    return '# JSX fragments not supported in Perl';
  }

  /**
   * Generate JSX text
   * @private
   */
  _generateJSXText(node, options) {
    this._addWarning('JSX is not applicable to Perl');
    return `"${node.value}"`;
  }

  /**
   * Generate JSX expression container
   * @private
   */
  _generateJSXExpressionContainer(node, options) {
    return this._generateNode(node.expression, options);
  }

  // ==================== UTILITY AND HELPER METHODS ====================

  /**
   * Convert JavaScript names to Perl naming convention
   * @private
   */
  _toPerlName(name) {
    // Convert camelCase to snake_case
    return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  /**
   * Infer appropriate Perl sigil based on context
   * @private
   */
  _inferSigil(param, options) {
    if (!param) return '$';

    // Check if parameter has type hints or patterns that suggest array/hash
    if (param.type === 'RestElement') return '@';
    if (param.type === 'ArrayPattern') return '@';
    if (param.type === 'ObjectPattern') return '%';

    // Check for naming conventions
    const name = param.name || '';
    if (name.endsWith('s') || name.includes('array') || name.includes('list')) {
      return '@';
    }
    if (name.includes('hash') || name.includes('map') || name.includes('config')) {
      return '%';
    }

    // Default to scalar
    return '$';
  }

  /**
   * Check if function name suggests crypto operations
   * @private
   */
  _isCryptoFunction(name) {
    const cryptoPatterns = [
      'encrypt', 'decrypt', 'hash', 'digest', 'cipher', 'crypt',
      'sign', 'verify', 'seal', 'unseal', 'encode', 'decode',
      'aes', 'des', 'rsa', 'dsa', 'sha', 'md5', 'hmac',
      'random', 'nonce', 'salt', 'key', 'iv'
    ];
    return cryptoPatterns.some(pattern => name.toLowerCase().includes(pattern));
  }

  /**
   * Check if call expression is OpCodes integration
   * @private
   */
  _isOpCodesCall(node) {
    if (node.type !== 'CallExpression') return false;

    const callee = node.callee;
    if (callee.type === 'MemberExpression') {
      const object = callee.object;
      return object.name === 'OpCodes' || object.name === 'global.OpCodes';
    }

    return false;
  }

  /**
   * Generate OpCodes call with Perl crypto equivalents
   * @private
   */
  _generateOpCodesCall(node, options) {
    const callee = node.callee;
    const methodName = callee.property.name;
    const args = node.arguments ? node.arguments.map(arg => this._generateNode(arg, options)) : [];

    // Map OpCodes methods to Perl crypto equivalents
    const opCodeMappings = {
      // Bit operations
      'RotL32': (args) => {
        this.usedModules.add('Bit::Vector');
        return `Bit::Vector->new_Dec(32, ${args[0]})->Rotate_Left(${args[1] || 1})->to_Dec()`;
      },
      'RotR32': (args) => {
        this.usedModules.add('Bit::Vector');
        return `Bit::Vector->new_Dec(32, ${args[0]})->Rotate_Right(${args[1] || 1})->to_Dec()`;
      },
      'RotL8': (args) => {
        this.usedModules.add('Bit::Vector');
        return `Bit::Vector->new_Dec(8, ${args[0]})->Rotate_Left(${args[1] || 1})->to_Dec()`;
      },
      'RotR8': (args) => {
        this.usedModules.add('Bit::Vector');
        return `Bit::Vector->new_Dec(8, ${args[0]})->Rotate_Right(${args[1] || 1})->to_Dec()`;
      },

      // Byte packing/unpacking
      'Pack32BE': (args) => `pack('N', (${args.slice(0, 4).join(' << 24) | (') || '0'} << 24))`,
      'Pack32LE': (args) => `pack('V', (${args.slice(0, 4).join(' << 24) | (') || '0'} << 24))`,
      'Pack16BE': (args) => `pack('n', (${args[0] || 0} << 8) | (${args[1] || 0}))`,
      'Pack16LE': (args) => `pack('v', (${args[0] || 0} << 8) | (${args[1] || 0}))`,
      'Unpack32BE': (args) => `unpack('N', ${args[0]})`,
      'Unpack32LE': (args) => `unpack('V', ${args[0]})`,
      'Unpack16BE': (args) => `unpack('n', ${args[0]})`,
      'Unpack16LE': (args) => `unpack('v', ${args[0]})`,

      // Array operations
      'XorArrays': (args) => {
        this.usedModules.add('List::Util');
        return `[map { ${args[0]}->[$_] ^ ${args[1]}->[$_] } 0..$#{${args[0]}}]`;
      },
      'ClearArray': (args) => `@{${args[0]}} = ()`,
      'CloneArray': (args) => `[@{${args[0]}}]`,

      // Conversion utilities
      'Hex8ToBytes': (args) => `[unpack('C*', pack('H*', ${args[0]}))]`,
      'BytesToHex8': (args) => `unpack('H*', pack('C*', @{${args[0]}}))`,
      'AnsiToBytes': (args) => `[unpack('C*', ${args[0]})]`,
      'BytesToAnsi': (args) => `pack('C*', @{${args[0]}})`,

      // Secure operations
      'SecureZero': (args) => {
        this.usedModules.add('Crypt::Random');
        return `${args[0]} = '\\0' x length(${args[0]}); undef ${args[0]}`;
      },
      'SecureRandom': (args) => {
        this.usedModules.add('Crypt::Random');
        return `Crypt::Random::makerandom_octet(Length => ${args[0] || 32})`;
      },

      // Hash operations
      'Sha256': (args) => {
        this.usedModules.add('Digest::SHA');
        return `Digest::SHA::sha256(${args[0]})`;
      },
      'Sha1': (args) => {
        this.usedModules.add('Digest::SHA');
        return `Digest::SHA::sha1(${args[0]})`;
      },
      'Md5': (args) => {
        this.usedModules.add('Digest::MD5');
        return `Digest::MD5::md5(${args[0]})`;
      }
    };

    if (opCodeMappings[methodName]) {
      this.cryptoOperations.add(methodName);
      return opCodeMappings[methodName](args);
    }

    // Fallback for unmapped OpCodes calls
    this._addWarning(`OpCodes.${methodName} not directly supported, using generic approach`);
    return `${methodName}(${args.join(', ')})`;
  }

  /**
   * Map JavaScript operators to Perl equivalents
   * @private
   */
  _mapOperator(operator) {
    const operatorMap = {
      '===': 'eq',
      '!==': 'ne',
      '==': '==',
      '!=': '!=',
      '&&': '&&',
      '||': '||',
      '!': '!',
      '+': '+',
      '-': '-',
      '*': '*',
      '/': '/',
      '%': '%',
      '=': '=',
      '+=': '+=',
      '-=': '-=',
      '*=': '*=',
      '/=': '/=',
      '%=': '%=',
      '<': '<',
      '>': '>',
      '<=': '<=',
      '>=': '>=',
      '<<': '<<',
      '>>': '>>',
      '&': '&',
      '|': '|',
      '^': '^',
      '~': '~'
    };
    return operatorMap[operator] || operator;
  }

  /**
   * Map unary operators
   * @private
   */
  _mapUnaryOperator(operator) {
    const unaryMap = {
      '!': '!',
      '-': '-',
      '+': '+',
      '~': '~',
      'typeof': 'ref',
      'void': 'undef',
      'delete': 'delete'
    };
    return unaryMap[operator] || operator;
  }

  /**
   * Map logical operators
   * @private
   */
  _mapLogicalOperator(operator) {
    const logicalMap = {
      '&&': '&&',
      '||': '||',
      '??': '//'  // Nullish coalescing to defined-or
    };
    return logicalMap[operator] || operator;
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
   * Push scope for tracking context
   * @private
   */
  _pushScope(scopeType) {
    this.scopeStack.push(scopeType);
  }

  /**
   * Pop scope from tracking
   * @private
   */
  _popScope() {
    return this.scopeStack.pop();
  }

  /**
   * Add warning to collection
   * @private
   */
  _addWarning(message) {
    if (!this.warnings.includes(message)) {
      this.warnings.push(message);
    }
  }

  /**
   * Check if array contains only simple string literals (for qw() optimization)
   * @private
   */
  _isSimpleWordList(node) {
    if (!node.elements || node.elements.length === 0) return false;
    return node.elements.every(element =>
      element &&
      element.type === 'Literal' &&
      typeof element.value === 'string' &&
      /^[a-zA-Z0-9_]+$/.test(element.value)
    );
  }

  /**
   * Check if member expression is accessing nested array
   * @private
   */
  _isNestedArrayAccess(node) {
    if (!node || node.type !== 'MemberExpression') return false;
    // Check if the object is also a member expression (chained array access)
    return node.object && node.object.type === 'MemberExpression' && node.computed;
  }

  /**
   * Wrap generated code with comprehensive pragmas and imports
   * @private
   */
  _wrapWithPragmas(code, options) {
    let pragmas = '#!/usr/bin/perl\n';

    // Basic pragmas
    if (options.useStrict) {
      pragmas += 'use strict;\n';
    }

    if (options.useWarnings) {
      pragmas += 'use warnings;\n';
    }

    // Modern Perl version with features
    pragmas += 'use v5.38;\n';

    // Experimental features
    if (options.useExperimentalFeatures) {
      pragmas += 'use experimental qw(signatures try class);\n';
    } else if (options.addSignatures) {
      pragmas += 'use experimental qw(signatures);\n';
    }

    // Modern Perl features
    if (options.usePostfixDeref) {
      pragmas += 'use experimental qw(postderef);\n';
    }

    // Additional commonly needed modules
    const coreModules = [];

    if (this.usedModules.has('List::Util') || options.useCPANModules) {
      coreModules.push('List::Util qw(first max min sum)');
    }

    if (this.usedModules.has('Scalar::Util') || options.useCPANModules) {
      coreModules.push('Scalar::Util qw(blessed looks_like_number)');
    }

    if (coreModules.length > 0) {
      pragmas += coreModules.map(mod => `use ${mod};\n`).join('');
    }

    // Crypto modules
    if (this.cryptoOperations.size > 0 || options.useCryptoExtensions) {
      pragmas += '\n# Cryptographic modules\n';

      if (this.usedModules.has('Crypt::Random') || this.cryptoOperations.has('SecureRandom')) {
        pragmas += 'use Crypt::Random qw(makerandom_octet);\n';
      }

      if (this.usedModules.has('Digest::SHA') || this.cryptoOperations.has('Sha256') || this.cryptoOperations.has('Sha1')) {
        pragmas += 'use Digest::SHA qw(sha1 sha256 sha512);\n';
      }

      if (this.usedModules.has('Digest::MD5') || this.cryptoOperations.has('Md5')) {
        pragmas += 'use Digest::MD5 qw(md5);\n';
      }

      if (this.usedModules.has('Crypt::CBC') || this.cryptoOperations.has('encrypt') || this.cryptoOperations.has('decrypt')) {
        pragmas += 'use Crypt::CBC;\n';
      }

      if (this.usedModules.has('Bit::Vector') || Array.from(this.cryptoOperations).some(op => op.includes('Rot'))) {
        pragmas += 'use Bit::Vector;\n';
      }
    }

    // Package declaration if needed
    if (options.packageName && options.packageName !== 'main') {
      pragmas += `\npackage ${options.packageName};\n`;
    }

    // Add used modules
    if (this.usedModules.size > 0) {
      pragmas += '\n# Additional modules\n';
      Array.from(this.usedModules).forEach(module => {
        if (!pragmas.includes(`use ${module}`)) {
          pragmas += `use ${module};\n`;
        }
      });
    }

    pragmas += '\n';
    return pragmas + code;
  }

  /**
   * Collect comprehensive dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];

    // Core pragmas
    dependencies.push('strict', 'warnings');

    // Modern Perl features
    if (options.useExperimentalFeatures) {
      dependencies.push('experimental');
    }

    // Object-oriented dependencies
    if (this._hasClasses(ast)) {
      if (options.useModernOOP && options.useExperimentalFeatures) {
        // Modern class syntax is built-in
      } else {
        dependencies.push('Moo');
      }
    }

    // Crypto dependencies
    if (this.cryptoOperations.size > 0 || options.useCryptoExtensions) {
      dependencies.push(
        'Digest::SHA',
        'Digest::MD5',
        'Crypt::Random',
        'Crypt::CBC',
        'Bit::Vector'
      );
    }

    // Advanced feature dependencies
    if (this._hasAsyncFeatures(ast)) {
      dependencies.push('Future::AsyncAwait', 'IO::Async');
    }

    if (this._hasGenerators(ast)) {
      dependencies.push('Iterator::Simple');
    }

    if (this._hasBigInts(ast)) {
      dependencies.push('Math::BigInt');
    }

    if (this._hasRegularExpressions(ast)) {
      dependencies.push('Regexp::Common');
    }

    // Utility dependencies
    if (this._hasArrayOperations(ast)) {
      dependencies.push('List::Util', 'List::MoreUtils');
    }

    if (this._hasStringOperations(ast)) {
      dependencies.push('String::Util');
    }

    if (this._hasDateOperations(ast)) {
      dependencies.push('DateTime');
    }

    if (this._hasFileOperations(ast)) {
      dependencies.push('Path::Tiny', 'File::Slurp');
    }

    if (this._hasNetworkOperations(ast)) {
      dependencies.push('LWP::UserAgent', 'HTTP::Request');
    }

    // Add manually tracked modules
    Array.from(this.usedModules).forEach(module => {
      if (!dependencies.includes(module)) {
        dependencies.push(module);
      }
    });

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Generate comprehensive warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [...this.warnings]; // Include manually added warnings

    // Context and sigil warnings
    if (this._hasContextIssues(ast)) {
      warnings.push('Perl context sensitivity: Verify scalar/list context usage in variable assignments and function calls.');
    }

    if (this._hasSigilMismatches(ast)) {
      warnings.push('Variable sigil ($/@/%) usage may need verification based on data types and context.');
    }

    // Modern Perl features
    if (!options.addSignatures && this._hasFunctions(ast)) {
      warnings.push('Consider enabling subroutine signatures for cleaner parameter handling (requires Perl 5.36+).');
    }

    if (!options.usePostfixDeref && this._hasComplexReferences(ast)) {
      warnings.push('Postfix dereferencing (@{}, %{}, &{}) can improve readability of complex reference operations.');
    }

    if (!options.useExperimentalFeatures && this._hasTryCatch(ast)) {
      warnings.push('Native try/catch syntax available in Perl 5.34+. Current code uses eval/die pattern.');
    }

    // Crypto-specific warnings
    if (this.cryptoOperations.size > 0) {
      warnings.push('Cryptographic operations detected. Ensure proper key management and secure random number generation.');
      warnings.push('Verify crypto module versions for security updates (Crypt::*, Digest::*, CryptX recommended).');
    }

    // Performance warnings
    if (this._hasPerformanceIssues(ast)) {
      warnings.push('Consider using packed binary operations (pack/unpack) for better performance with binary data.');
    }

    if (this._hasStringConcatenation(ast)) {
      warnings.push('String concatenation in loops can be optimized using join() or string interpolation.');
    }

    // Security warnings
    if (this._hasSecurityIssues(ast)) {
      warnings.push('Potential security issues: Use taint mode (-T), validate inputs, avoid eval() with user data.');
    }

    if (this._hasFileOperations(ast)) {
      warnings.push('File operations detected. Use Path::Tiny for safer path handling and proper error checking.');
    }

    // Best practices (only when enabled)
    if (options.enableBestPractices) {
      if (this._hasGlobalVariables(ast)) {
        warnings.push('Global variables detected. Consider lexical scoping (my) and package variables (our) for better encapsulation.');
      }

      if (this._hasImplicitReturns(ast)) {
        warnings.push('Explicit return statements recommended for clarity, especially in subroutines.');
      }

      if (this._hasComplexRegex(ast)) {
        warnings.push('Complex regular expressions detected. Consider using /x modifier for readability and Regexp::Common for standard patterns.');
      }

      if (this._hasMagicNumbers(ast)) {
        warnings.push('Magic numbers detected. Consider using named constants for better maintainability.');
      }

      if (this._hasDeepNesting(ast)) {
        warnings.push('Deep nesting detected. Consider extracting nested blocks into subroutines for better readability.');
      }

      if (this._hasLongSubroutines(ast)) {
        warnings.push('Long subroutines detected. Consider breaking them into smaller, focused functions.');
      }
    }

    // Compatibility warnings
    if (!options.useStrict || !options.useWarnings) {
      warnings.push('Enable strict and warnings pragmas for safer code and better error detection.');
    }

    if (this._hasModernFeatures(ast) && !options.useExperimentalFeatures) {
      warnings.push('Code uses modern features that may require experimental pragma or newer Perl version.');
    }

    // Memory and resource warnings
    if (this._hasLargeDataStructures(ast)) {
      warnings.push('Large data structures detected. Consider memory usage and potential need for streaming operations.');
    }

    if (this._hasCircularReferences(ast)) {
      warnings.push('Potential circular references detected. Consider using Scalar::Util::weaken() to prevent memory leaks.');
    }

    // Comprehensive warnings (additional detailed analysis when enabled)
    if (options.addComprehensiveWarnings) {
      // Unicode and encoding warnings
      if (this._hasUnicodeOperations(ast)) {
        warnings.push('Unicode operations detected. Ensure proper encoding with use utf8; and decode_utf8()/encode_utf8() where needed.');
      }

      // Reference and dereferencing warnings
      if (this._hasComplexDereferencing(ast)) {
        warnings.push('Complex dereferencing detected. Consider using postfix dereference for clarity: $arrayref->@* instead of @{$arrayref}.');
      }

      // Operator precedence warnings
      if (this._hasAmbiguousOperators(ast)) {
        warnings.push('Ambiguous operator usage detected. Use parentheses to clarify precedence, especially with string/numeric operators.');
      }

      // Testing and debugging recommendations
      if (this._lacksTesting(ast)) {
        warnings.push('No test infrastructure detected. Consider adding Test::More or Test2::Suite for comprehensive testing.');
      }

      // Documentation warnings
      if (this._lacksDocumentation(ast)) {
        warnings.push('Limited documentation detected. Consider adding POD (Plain Old Documentation) for modules and public subroutines.');
      }

      // Error handling warnings
      if (this._lacksErrorHandling(ast)) {
        warnings.push('Limited error handling detected. Consider using Try::Tiny or eval/die with proper $@ checking.');
      }

      // Deprecated feature warnings
      if (this._hasDeprecatedFeatures(ast)) {
        warnings.push('Deprecated Perl features detected. Review code for bareword filehandles, indirect object syntax, or other deprecated patterns.');
      }

      // Concurrency warnings
      if (this._hasConcurrencyIssues(ast)) {
        warnings.push('Potential concurrency issues detected. Use Thread::Queue or Mojo::IOLoop for safe concurrent operations.');
      }
    }

    return [...new Set(warnings)]; // Remove duplicates
  }

  // ==================== AST ANALYSIS HELPERS ====================

  /**
   * Check if AST contains class declarations
   * @private
   */
  _hasClasses(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'ClassDeclaration' || node.type === 'ClassExpression'
    );
  }

  /**
   * Check if AST contains async/await features
   * @private
   */
  _hasAsyncFeatures(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'AwaitExpression' ||
      (node.type === 'FunctionDeclaration' && node.async) ||
      (node.type === 'FunctionExpression' && node.async) ||
      (node.type === 'ArrowFunctionExpression' && node.async)
    );
  }

  /**
   * Check if AST contains generators
   * @private
   */
  _hasGenerators(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'YieldExpression' ||
      (node.type === 'FunctionDeclaration' && node.generator) ||
      (node.type === 'FunctionExpression' && node.generator)
    );
  }

  /**
   * Check if AST contains BigInt literals
   * @private
   */
  _hasBigInts(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'BigIntLiteral' ||
      (node.type === 'Literal' && typeof node.value === 'bigint')
    );
  }

  /**
   * Check if AST contains regular expressions
   * @private
   */
  _hasRegularExpressions(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'RegExpLiteral' ||
      (node.type === 'Literal' && node.value instanceof RegExp)
    );
  }

  /**
   * Check if AST contains array operations
   * @private
   */
  _hasArrayOperations(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'ArrayExpression' ||
      node.type === 'ArrayPattern' ||
      (node.type === 'MemberExpression' && node.computed) ||
      (node.type === 'CallExpression' &&
       node.callee.type === 'MemberExpression' &&
       ['push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'map', 'filter', 'reduce'].includes(node.callee.property.name))
    );
  }

  /**
   * Check if AST contains string operations
   * @private
   */
  _hasStringOperations(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'TemplateLiteral' ||
      (node.type === 'CallExpression' &&
       node.callee.type === 'MemberExpression' &&
       ['split', 'join', 'replace', 'match', 'search', 'substring', 'substr'].includes(node.callee.property.name)) ||
      (node.type === 'BinaryExpression' && node.operator === '+' &&
       (node.left.type === 'Literal' && typeof node.left.value === 'string' ||
        node.right.type === 'Literal' && typeof node.right.value === 'string'))
    );
  }

  /**
   * Check if AST contains date operations
   * @private
   */
  _hasDateOperations(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'NewExpression' && node.callee.name === 'Date') ||
      (node.type === 'CallExpression' &&
       node.callee.type === 'MemberExpression' &&
       ['getTime', 'setTime', 'getFullYear', 'setFullYear'].includes(node.callee.property.name))
    );
  }

  /**
   * Check if AST contains file operations
   * @private
   */
  _hasFileOperations(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'CallExpression' &&
       node.callee.name &&
       ['require', 'readFile', 'writeFile', 'open', 'close', 'stat'].includes(node.callee.name)) ||
      (node.type === 'ImportDeclaration')
    );
  }

  /**
   * Check if AST contains network operations
   * @private
   */
  _hasNetworkOperations(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'CallExpression' &&
       node.callee.name &&
       ['fetch', 'request', 'get', 'post', 'put', 'delete'].includes(node.callee.name)) ||
      (node.type === 'NewExpression' &&
       ['Request', 'Response', 'XMLHttpRequest'].includes(node.callee.name))
    );
  }

  /**
   * Check if AST has context sensitivity issues
   * @private
   */
  _hasContextIssues(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'AssignmentExpression' &&
       (node.left.type === 'ArrayPattern' || node.left.type === 'ObjectPattern')) ||
      (node.type === 'CallExpression' && node.arguments.length > 1)
    );
  }

  /**
   * Check if AST has sigil mismatches
   * @private
   */
  _hasSigilMismatches(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'VariableDeclaration' ||
      node.type === 'AssignmentExpression' ||
      node.type === 'ArrayExpression' ||
      node.type === 'ObjectExpression'
    );
  }

  /**
   * Check if AST contains functions
   * @private
   */
  _hasFunctions(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'MethodDefinition'
    );
  }

  /**
   * Check if AST has complex references
   * @private
   */
  _hasComplexReferences(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'MemberExpression' &&
       (node.object.type === 'MemberExpression' || node.computed)) ||
      node.type === 'ChainExpression'
    );
  }

  /**
   * Check if AST has try/catch blocks
   * @private
   */
  _hasTryCatch(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'TryStatement'
    );
  }

  /**
   * Check if AST has performance issues
   * @private
   */
  _hasPerformanceIssues(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'CallExpression' &&
       node.callee.type === 'MemberExpression' &&
       ['concat', 'push'].includes(node.callee.property.name)) ||
      (node.type === 'ForStatement' || node.type === 'WhileStatement')
    );
  }

  /**
   * Check if AST has string concatenation
   * @private
   */
  _hasStringConcatenation(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'BinaryExpression' && node.operator === '+') ||
      (node.type === 'AssignmentExpression' && node.operator === '+=')
    );
  }

  /**
   * Check if AST has security issues
   * @private
   */
  _hasSecurityIssues(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'CallExpression' &&
       node.callee.name === 'eval') ||
      (node.type === 'Literal' &&
       typeof node.value === 'string' &&
       node.value.includes('system'))
    );
  }

  /**
   * Check if AST has global variables
   * @private
   */
  _hasGlobalVariables(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'VariableDeclaration' && node.kind === 'var') ||
      (node.type === 'AssignmentExpression' &&
       node.left.type === 'Identifier' &&
       !this.declaredVariables.has(node.left.name))
    );
  }

  /**
   * Check if AST has implicit returns
   * @private
   */
  _hasImplicitReturns(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'FunctionDeclaration' ||
       node.type === 'FunctionExpression' ||
       node.type === 'ArrowFunctionExpression') &&
      node.body.type === 'BlockStatement' &&
      node.body.body.length > 0 &&
      node.body.body[node.body.body.length - 1].type !== 'ReturnStatement'
    );
  }

  /**
   * Check if AST has complex regular expressions
   * @private
   */
  _hasComplexRegex(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'RegExpLiteral' && node.pattern.length > 50) ||
      (node.type === 'Literal' &&
       node.value instanceof RegExp &&
       node.value.source.length > 50)
    );
  }

  /**
   * Check if AST has magic numbers (numeric literals used directly)
   * @private
   */
  _hasMagicNumbers(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'Literal' &&
      typeof node.value === 'number' &&
      node.value !== 0 &&
      node.value !== 1 &&
      node.value !== -1
    );
  }

  /**
   * Check if AST has deep nesting (more than 4 levels)
   * @private
   */
  _hasDeepNesting(ast) {
    let maxDepth = 0;
    const checkDepth = (node, depth = 0) => {
      if (!node) return;
      maxDepth = Math.max(maxDepth, depth);
      if (node.type === 'BlockStatement' || node.type === 'IfStatement' ||
          node.type === 'WhileStatement' || node.type === 'ForStatement') {
        if (node.body) {
          if (Array.isArray(node.body)) {
            node.body.forEach(child => checkDepth(child, depth + 1));
          } else {
            checkDepth(node.body, depth + 1);
          }
        }
        if (node.alternate) checkDepth(node.alternate, depth + 1);
      }
    };
    checkDepth(ast, 0);
    return maxDepth > 4;
  }

  /**
   * Check if AST has long subroutines (more than 50 statements)
   * @private
   */
  _hasLongSubroutines(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'FunctionDeclaration' ||
       node.type === 'FunctionExpression' ||
       node.type === 'ArrowFunctionExpression') &&
      node.body &&
      node.body.type === 'BlockStatement' &&
      node.body.body &&
      node.body.body.length > 50
    );
  }

  /**
   * Check if AST has modern features
   * @private
   */
  _hasModernFeatures(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'TemplateLiteral' ||
      node.type === 'SpreadElement' ||
      node.type === 'RestElement' ||
      node.type === 'ObjectPattern' ||
      node.type === 'ArrayPattern' ||
      node.type === 'ClassDeclaration' ||
      node.type === 'ImportDeclaration' ||
      node.type === 'ExportDeclaration'
    );
  }

  /**
   * Check if AST has large data structures
   * @private
   */
  _hasLargeDataStructures(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'ArrayExpression' && node.elements.length > 100) ||
      (node.type === 'ObjectExpression' && node.properties.length > 50)
    );
  }

  /**
   * Check if AST has circular references
   * @private
   */
  _hasCircularReferences(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'AssignmentExpression' &&
       node.left.type === 'MemberExpression' &&
       node.right.type === 'Identifier')
    );
  }

  /**
   * Check if AST contains complex expressions
   * @private
   */
  _hasComplexExpressions(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'ConditionalExpression' ||
      node.type === 'SequenceExpression' ||
      (node.type === 'BinaryExpression' &&
       (node.left.type === 'BinaryExpression' || node.right.type === 'BinaryExpression'))
    );
  }

  /**
   * Check if AST has Unicode operations
   * @private
   */
  _hasUnicodeOperations(ast) {
    return this._traverseAST(ast, node =>
      (node.type === 'Literal' && typeof node.value === 'string' && /[^\x00-\x7F]/.test(node.value)) ||
      (node.type === 'CallExpression' && node.callee.name &&
       (node.callee.name.includes('decode') || node.callee.name.includes('encode')))
    );
  }

  /**
   * Check if AST has complex dereferencing
   * @private
   */
  _hasComplexDereferencing(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'MemberExpression' &&
      node.object.type === 'MemberExpression'
    );
  }

  /**
   * Check if AST has ambiguous operators
   * @private
   */
  _hasAmbiguousOperators(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'BinaryExpression' &&
      node.left.type === 'BinaryExpression' &&
      !node.parenthesized
    );
  }

  /**
   * Check if AST lacks testing infrastructure
   * @private
   */
  _lacksTesting(ast) {
    return !this._traverseAST(ast, node =>
      node.type === 'CallExpression' &&
      node.callee.name &&
      (node.callee.name.includes('test') || node.callee.name.includes('assert'))
    );
  }

  /**
   * Check if AST lacks documentation
   * @private
   */
  _lacksDocumentation(ast) {
    // Simple heuristic: check if there are functions but no comments
    const hasFunctions = this._traverseAST(ast, node =>
      node.type === 'FunctionDeclaration' ||
      node.type === 'ClassDeclaration'
    );
    // In real implementation, would check for POD or comments
    return hasFunctions;
  }

  /**
   * Check if AST lacks error handling
   * @private
   */
  _lacksErrorHandling(ast) {
    const hasFunctions = this._traverseAST(ast, node =>
      node.type === 'FunctionDeclaration'
    );
    const hasTryCatch = this._traverseAST(ast, node =>
      node.type === 'TryStatement'
    );
    return hasFunctions && !hasTryCatch;
  }

  /**
   * Check if AST has deprecated features
   * @private
   */
  _hasDeprecatedFeatures(ast) {
    return this._traverseAST(ast, node =>
      // Check for indirect object notation patterns
      (node.type === 'NewExpression' && node.callee.type === 'Identifier')
    );
  }

  /**
   * Check if AST has concurrency issues
   * @private
   */
  _hasConcurrencyIssues(ast) {
    return this._traverseAST(ast, node =>
      node.type === 'CallExpression' &&
      node.callee.name &&
      (node.callee.name.includes('thread') || node.callee.name.includes('fork'))
    );
  }

  /**
   * Traverse AST and check condition
   * @private
   */
  _traverseAST(node, condition) {
    if (!node || typeof node !== 'object') {
      return false;
    }

    if (condition(node)) {
      return true;
    }

    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== 'parent') {
        const value = node[key];
        if (Array.isArray(value)) {
          if (value.some(item => this._traverseAST(item, condition))) {
            return true;
          }
        } else if (typeof value === 'object' && value !== null) {
          if (this._traverseAST(value, condition)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if Perl is available on the system
   * @private
   */
  _isPerlAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('perl --version', { 
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
   * Validate Perl code syntax using native interpreter
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Perl is available first
    const perlAvailable = this._isPerlAvailable();
    if (!perlAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Perl not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_perl_${Date.now()}.pl`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Check Perl syntax using -c (compile check) flag
        execSync(`perl -c "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: 'perl',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'perl',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Perl is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Perl not available - using basic validation'
      };
    }
  }

  /**
   * Get Perl interpreter download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Perl',
      downloadUrl: 'https://www.perl.org/get.html',
      installInstructions: [
        'Download Perl from https://www.perl.org/get.html',
        'For Windows: Strawberry Perl - https://strawberryperl.com/',
        'For Windows: ActiveState Perl - https://www.activestate.com/products/perl/',
        'For Ubuntu/Debian: sudo apt install perl libcrypt-random-perl libdigest-sha-perl',
        'For macOS: brew install perl && cpanm Crypt::Random Digest::SHA',
        'For comprehensive installations: use perlbrew or plenv',
        'Install crypto modules: cpanm CryptX Crypt::CBC Crypt::Random Bit::Vector',
        'Install utility modules: cpanm Moo List::Util Math::BigInt Path::Tiny',
        'Add Perl to your system PATH',
        'Verify installation with: perl --version',
        'Verify crypto support: perl -MCrypt::Random -e "print \\"Crypto OK\\n\\""'
      ].join('\n'),
      verifyCommand: 'perl --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'cpan / cpanm (for CPAN modules)',
      cryptoModules: 'CryptX, Crypt::CBC, Crypt::Random, Digest::SHA, Bit::Vector',
      modernFeatures: 'Perl 5.38+ with experimental features (signatures, try/catch, class)',
      documentation: 'https://perldoc.perl.org/',
      cpanSearch: 'https://metacpan.org/'
    };
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