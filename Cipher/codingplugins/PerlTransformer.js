/**
 * PerlTransformer.js - JavaScript AST to Perl AST Transformer
 * Converts type-annotated JavaScript AST to Perl AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Perl AST -> Perl Emitter -> Perl Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let PerlAST;
  if (typeof require !== 'undefined') {
    PerlAST = require('./PerlAST.js');
  } else if (global.PerlAST) {
    PerlAST = global.PerlAST;
  }

  const {
    PerlType, PerlModule, PerlUse, PerlPackage, PerlClass, PerlField,
    PerlSub, PerlParameter, PerlBlock, PerlVarDeclaration, PerlExpressionStatement,
    PerlReturn, PerlIf, PerlFor, PerlWhile, PerlLast, PerlNext, PerlRedo,
    PerlDie, PerlTry, PerlGiven, PerlWhen, PerlLiteral, PerlIdentifier,
    PerlBinaryExpression, PerlUnaryExpression, PerlAssignment, PerlMemberAccess,
    PerlSubscript, PerlCall, PerlArray, PerlHash, PerlAnonSub, PerlBless,
    PerlConditional, PerlList, PerlQw, PerlRegex, PerlStringInterpolation,
    PerlPOD, PerlComment, PerlGrouped, PerlArraySlice, PerlRawCode
  } = PerlAST;

  /**
   * Maps JavaScript/JSDoc types to Perl types (for comments or Moose)
   */
  const TYPE_MAP = {
    // Numeric types
    'uint8': 'Int', 'byte': 'Int',
    'uint16': 'Int', 'ushort': 'Int', 'word': 'Int',
    'uint32': 'Int', 'uint': 'Int', 'dword': 'Int',
    'uint64': 'Int', 'ulong': 'Int', 'qword': 'Int',
    'int8': 'Int', 'sbyte': 'Int',
    'int16': 'Int', 'short': 'Int',
    'int32': 'Int', 'int': 'Int',
    'int64': 'Int', 'long': 'Int',
    'float': 'Num', 'float32': 'Num',
    'double': 'Num', 'float64': 'Num',
    'number': 'Num',
    // Other types
    'boolean': 'Bool', 'bool': 'Bool',
    'string': 'Str', 'String': 'Str',
    'void': 'void',
    'object': 'HashRef',
    'Array': 'ArrayRef'
  };

  /**
   * JavaScript AST to Perl AST Transformer
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - lineEnding: string - Line ending character (default: '\n')
   * - useStrict: boolean - Add 'use strict'. Default: true
   * - useWarnings: boolean - Add 'use warnings'. Default: true
   * - addSignatures: boolean - Use modern Perl signatures. Default: true
   * - useModernClass: boolean - Use class keyword (5.38+). Default: false
   * - packageName: string - Package name. Default: 'main'
   * - addTypeComments: boolean - Add type hints in comments. Default: true
   */
  // Framework base classes that need stub packages
  const FRAMEWORK_CLASSES = new Set([
    'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'HashFunctionAlgorithm',
    'AsymmetricAlgorithm', 'MacAlgorithm', 'KdfAlgorithm', 'ChecksumAlgorithm',
    'ClassicalCipherAlgorithm', 'CompressionAlgorithm', 'EncodingAlgorithm',
    'EccAlgorithm', 'SpecialAlgorithm',
    'IBlockCipherInstance', 'IStreamCipherInstance', 'IHashFunctionInstance',
    'IAlgorithmInstance'
  ]);

  // Framework utility classes that should be skipped entirely (provided by runtime)
  const SKIP_CLASSES = new Set([
    'LinkItem', 'KeySize', 'Vulnerability', 'TestCase', 'AuthResult',
    'Algorithm', 'MacAlgorithm', 'AeadAlgorithm', 'RandomAlgorithm',
    'CipherModeAlgorithm', 'PaddingAlgorithm', 'SignatureAlgorithm',
    'KeyExchangeAlgorithm', 'KeyAgreementAlgorithm', 'ErrorCorrectionAlgorithm',
    'CryptoAlgorithm', 'IMacInstance', 'IAeadInstance', 'IKdfInstance',
    'IEncodingInstance', 'ICompressionInstance', 'IAsymmetricInstance',
    'IClassicalCipherInstance', 'IRandomInstance', 'IEccInstance',
    'ICryptoModeInstance', 'IRandomGeneratorInstance', 'IErrorCorrectionInstance',
    'ICryptoInstance', 'ICipherModeInstance', 'IPaddingInstance',
    'ISignatureInstance', 'IKeyExchangeInstance', 'IKeyAgreementInstance',
    'IChecksumInstance'
  ]);

  class PerlTransformer {
    constructor(options = {}) {
      this.options = options;
      this.variableTypes = new Map();  // Maps variable name -> PerlType
      this.scopeStack = [];
      this.currentClass = null;
      this.inMethod = false;
      this.requiredModules = new Map();  // Maps module name -> Set of imported functions
      this.currentModule = null;  // Track current module being built
      this.frameworkClasses = new Set();  // Track framework classes for stub generation
      this.functionNames = new Set();  // Track names that are functions (for code refs)
      this.codeRefVariables = new Set();  // Track variable names that hold code references (sub { ... })
      this.definedClassNames = new Set();  // Track class names defined during transformation
      this.destructureCounter = 0;  // Counter for unique destructuring variable names
      this.mapCounter = 0;  // Counter for map result variables when index is used
    }

    /**
     * Add a required module with optional function import
     * @param {string} moduleName - Module name (e.g., 'List::Util', 'POSIX')
     * @param {string} [funcName] - Optional function to import
     */
    addRequiredModule(moduleName, funcName = null) {
      if (!this.requiredModules.has(moduleName))
        this.requiredModules.set(moduleName, new Set());
      if (funcName)
        this.requiredModules.get(moduleName).add(funcName);
    }

    /**
     * Wrap expression for array/list context, avoiding double sigils.
     * If expression is already a bare @ array, return it directly.
     * Otherwise wrap with @{...} dereference.
     * @param {PerlNode} expr - Perl AST expression
     * @returns {PerlNode} Expression suitable for list context
     */
    wrapArrayDeref(expr) {
      // Already an array-sigiled identifier (@arr) - no wrapping needed
      if (expr.nodeType === 'Identifier' && expr.sigil === '@')
        return expr;

      // Already a @ unary expression - no double wrap
      if (expr.nodeType === 'UnaryExpression' && expr.operator === '@')
        return expr;

      // RawCode that starts with [ is an array literal/slice - just use @{...}
      // But if it's a complex expression like [@{...}[...]] we need to handle it
      if (expr.nodeType === 'RawCode') {
        const code = expr.code;
        // If it's an array constructor like [...], use @{...}
        if (code.startsWith('[') && code.endsWith(']'))
          return new PerlUnaryExpression('@', expr, true);
        // Otherwise return as-is (it might already be a list expression)
        return expr;
      }

      // Perl built-in functions that already return lists - no @ prefix needed
      // Adding @ would create invalid syntax like @keys(...) instead of keys(...)
      const listReturningFunctions = new Set([
        'keys', 'values', 'each', 'sort', 'reverse', 'map', 'grep',
        'split', 'unpack', 'localtime', 'gmtime', 'caller', 'stat', 'lstat'
      ]);

      // Check if expr is a call to a list-returning function
      if (expr.nodeType === 'Call') {
        const callee = expr.callee;
        // Handle string callee directly
        if (typeof callee === 'string' && listReturningFunctions.has(callee))
          return expr;
        // Handle Identifier callee
        if (callee && callee.nodeType === 'Identifier' && listReturningFunctions.has(callee.name))
          return expr;
      }

      // Wrap with @{...} for list context dereference
      return new PerlUnaryExpression('@', expr, true);
    }

    /**
     * Transform a callback for List::Util style functions that use $_ for the current element.
     * Takes a JS arrow/function expression and produces a Perl block that uses $_ instead of the first parameter.
     * @param {Object} callback - JS AST callback node (ArrowFunctionExpression or FunctionExpression)
     * @returns {PerlBlock} Perl block using $_
     */
    transformListUtilCallback(callback) {
      if (!callback) return new PerlBlock([]);

      // Get the parameter name to replace with $_
      const params = callback.params || [];
      const paramName = params.length > 0 ? (params[0].name || (params[0].type === 'Identifier' ? params[0].name : null)) : null;

      if (this.options.debug) console.log('transformListUtilCallback paramName:', paramName, 'body type:', callback.body?.type);

      // Save and set up parameter replacement context
      const oldReplacement = this._listUtilParamReplacement;
      this._listUtilParamReplacement = paramName;

      // Transform the body
      let body;
      if (callback.body) {
        if (callback.body.type === 'BlockStatement') {
          // Full block body
          body = new PerlBlock();
          for (const stmt of callback.body.body) {
            const transformed = this.transformStatement(stmt);
            if (transformed) {
              if (Array.isArray(transformed))
                body.statements.push(...transformed);
              else
                body.statements.push(transformed);
            }
          }
        } else {
          // Expression body (arrow function shorthand) - could be any IL node type
          if (this.options.debug) console.log('transformListUtilCallback expression body ilNodeType:', callback.body.ilNodeType);
          const expr = this.transformExpression(callback.body);
          if (this.options.debug) console.log('transformListUtilCallback result expr:', expr?.nodeType);
          const stmt = new PerlExpressionStatement(expr);
          body = new PerlBlock();
          body.statements.push(stmt);
        }
      } else {
        body = new PerlBlock();
      }

      // Restore context
      this._listUtilParamReplacement = oldReplacement;

      return body;
    }

    /**
     * Transform a JavaScript AST to a Perl AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {PerlModule} Perl AST
     */
    transform(jsAst) {
      const module = new PerlModule(this.options.packageName || 'main');

      // Add pragmas
      if (this.options.useStrict !== false) {
        module.pragmas.push('use strict');
      }
      if (this.options.useWarnings !== false) {
        module.pragmas.push('use warnings');
      }

      // Add feature pragmas for modern Perl
      if (this.options.addSignatures) {
        module.pragmas.push('use feature qw(signatures)');
        module.pragmas.push('no warnings qw(experimental::signatures)');
      }

      // Reset tracking for this transformation
      this.requiredModules.clear();
      this.frameworkClasses.clear();
      this.currentModule = module;

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, module);
        }
      }

      // Add required module imports to pragmas
      for (const [moduleName, funcs] of this.requiredModules) {
        if (funcs.size > 0) {
          const funcList = Array.from(funcs).join(' ');
          module.pragmas.push(`use ${moduleName} qw(${funcList})`);
        } else {
          module.pragmas.push(`use ${moduleName}`);
        }
      }

      // Note: Framework class stubs are generated by the emitter when emitting derived classes
      // This ensures base class stubs appear directly before the classes that need them

      return module;
    }

    /**
     * Generate stub packages for framework base classes
     * @returns {PerlClass[]} Array of stub class definitions
     */
    _generateFrameworkStubs() {
      const stubs = [];
      for (const className of this.frameworkClasses) {
        const stubClass = new PerlClass(className);
        // Add simple new() constructor that returns blessed hashref
        const newMethod = new PerlSub('new');
        newMethod.body = new PerlBlock();
        newMethod.body.statements.push(
          new PerlRawCode('my $class = shift;'),
          new PerlRawCode('my $self = { @_ };'),
          new PerlRawCode('bless $self, $class;'),
          new PerlRawCode('return $self;')
        );
        stubClass.methods.push(newMethod);
        stubs.push(stubClass);
      }
      return stubs;
    }

    /**
     * Transform a top-level JavaScript node
     */
    transformTopLevel(node, targetModule) {
      switch (node.type) {
        case 'VariableDeclaration':
          this.transformVariableDeclaration(node, targetModule);
          break;

        case 'FunctionDeclaration':
          this.transformFunctionDeclaration(node, targetModule);
          break;

        case 'ClassDeclaration':
          this.transformClassDeclaration(node, targetModule);
          break;

        case 'ExpressionStatement':
          // Handle IIFE wrappers - extract content from inside
          if (node.expression.type === 'CallExpression') {
            const callee = node.expression.callee;
            if (callee.type === 'FunctionExpression' ||
                callee.type === 'ArrowFunctionExpression') {
              // Extract and process IIFE body content
              this.transformIIFEContent(callee, node.expression, targetModule);
              break;
            }
          }
          // Handle regular expression statements (including ArrayForEach)
          {
            const stmt = this.transformExpressionStatementNode(node);
            if (stmt) {
              targetModule.statements.push(stmt);
            }
          }
          break;

        default:
          // Skip unhandled top-level node types
          break;
      }
    }

    /**
     * Extract and transform content from IIFE wrapper
     */
    transformIIFEContent(calleeNode, callExpr, targetModule) {
      let bodyStatements = [];

      // First, try to find the factory function in UMD pattern
      if (callExpr && callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          bodyStatements = factoryArg.body?.body || [];
        }
      }

      // Simple IIFE pattern: extract from callee's body
      if (bodyStatements.length === 0 && calleeNode.body && calleeNode.body.body) {
        bodyStatements = calleeNode.body.body;
      }

      // Process statements
      for (const stmt of bodyStatements) {
        // Skip 'use strict' and other expression statements
        if (stmt.type === 'ExpressionStatement') {
          continue;
        }

        // Process class declarations
        if (stmt.type === 'ClassDeclaration') {
          this.transformClassDeclaration(stmt, targetModule);
          continue;
        }

        // Process function declarations
        if (stmt.type === 'FunctionDeclaration') {
          this.transformFunctionDeclaration(stmt, targetModule);
          continue;
        }

        // Process variable declarations (const/let/var)
        if (stmt.type === 'VariableDeclaration') {
          this.transformVariableDeclaration(stmt, targetModule);
          continue;
        }

        // Skip if statements (usually feature detection)
        if (stmt.type === 'IfStatement') continue;
      }
    }

    /**
     * Transform a variable declaration
     */
    transformVariableDeclaration(node, targetModule) {
      for (const decl of node.declarations) {
        if (!decl.init) continue;

        // Skip object destructuring
        if (decl.id.type === 'ObjectPattern')
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        // Perl supports list assignment: my ($a, $b, $c) = @arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = elem.name;
              const indexExpr = new PerlSubscript(sourceExpr, PerlLiteral.Number(i));
              const varDecl = new PerlVarDeclaration('our', varName, '$', indexExpr);
              targetModule.statements.push(varDecl);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Skip framework module loading patterns like:
        // const AlgorithmFramework = global.AlgorithmFramework
        // const OpCodes = global.OpCodes
        // These are provided by the test harness
        if (decl.init.type === 'MemberExpression' &&
            decl.init.object.type === 'Identifier' &&
            (decl.init.object.name === 'global' || decl.init.object.name === 'globalThis')) {
          const member = decl.init.property.name || decl.init.property.value;
          if (member === 'AlgorithmFramework' || member === 'OpCodes')
            continue;
        }

        // Check if this is an object literal defining a module/struct
        if (decl.init.type === 'ObjectExpression') {
          // Store as hash reference ($hash = {...}) for consistent access with $hash->{key}
          // Register the variable type so subsequent uses get the correct sigil
          this.registerVariableType(name, '$');
          const varDecl = new PerlVarDeclaration(
            'our',
            name,
            '$',
            this.transformExpression(decl.init)
          );
          targetModule.statements.push(varDecl);
        }
        // Check if this is an IIFE
        else if (decl.init.type === 'CallExpression' &&
                 (decl.init.callee.type === 'FunctionExpression' ||
                  decl.init.callee.type === 'ArrowFunctionExpression')) {
          // IIFE - transform as do { } block to preserve internal functions
          if (this.options.debug) console.log('DEBUG: Found IIFE for', name);
          const iifeFunc = decl.init.callee;
          if (iifeFunc.body && iifeFunc.body.type === 'BlockStatement' && iifeFunc.body.body) {
            const doBlock = new PerlBlock();

            // Transform all statements in the IIFE body
            for (const stmt of iifeFunc.body.body) {
              // Convert local function declarations to local subs
              if (stmt.type === 'FunctionDeclaration') {
                const funcName = stmt.id.name;
                const func = new PerlSub(funcName);
                func.useSignatures = this.options.addSignatures;

                // Parameters
                if (stmt.params) {
                  for (const param of stmt.params) {
                    let paramName, defaultValue = null;
                    if (param.type === 'AssignmentPattern') {
                      paramName = param.left.name;
                      defaultValue = this.transformExpression(param.right);
                    } else if (param.defaultValue) {
                      paramName = param.name;
                      defaultValue = this.transformExpression(param.defaultValue);
                    } else {
                      paramName = param.name;
                    }
                    func.parameters.push(new PerlParameter(paramName, '$', null, defaultValue));
                    this.registerVariableType(paramName, '$');
                  }
                }

                // Body
                if (stmt.body) {
                  func.body = this.transformBlockStatement(stmt.body);
                }

                doBlock.statements.push(func);
              }
              // Variable declarations become my declarations
              else if (stmt.type === 'VariableDeclaration') {
                for (const innerDecl of stmt.declarations) {
                  if (innerDecl.init && innerDecl.id.name) {
                    const innerName = innerDecl.id.name;
                    // Handle nested function expressions
                    if (innerDecl.init.type === 'FunctionExpression' ||
                        innerDecl.init.type === 'ArrowFunctionExpression') {
                      const func = new PerlSub(innerName);
                      func.useSignatures = this.options.addSignatures;

                      if (innerDecl.init.params) {
                        for (const param of innerDecl.init.params) {
                          let paramName, defaultValue = null;
                          if (param.type === 'AssignmentPattern') {
                            paramName = param.left.name;
                            defaultValue = this.transformExpression(param.right);
                          } else if (param.defaultValue) {
                            paramName = param.name;
                            defaultValue = this.transformExpression(param.defaultValue);
                          } else {
                            paramName = param.name;
                          }
                          func.parameters.push(new PerlParameter(paramName, '$', null, defaultValue));
                          this.registerVariableType(paramName, '$');
                        }
                      }

                      if (innerDecl.init.body) {
                        if (innerDecl.init.body.type === 'BlockStatement') {
                          func.body = this.transformBlockStatement(innerDecl.init.body);
                        } else {
                          // Arrow function with expression body
                          func.body = new PerlBlock();
                          func.body.statements.push(new PerlReturn(this.transformExpression(innerDecl.init.body)));
                        }
                      }

                      doBlock.statements.push(func);
                    } else {
                      // Regular variable
                      const sigil = this.inferSigilFromValue(innerDecl.init);
                      const innerVarDecl = new PerlVarDeclaration('my', innerName, sigil,
                        this.transformExpression(innerDecl.init));
                      doBlock.statements.push(innerVarDecl);
                    }
                  }
                }
              }
              // Return statement becomes the do block's return
              else if (stmt.type === 'ReturnStatement' && stmt.argument) {
                doBlock.statements.push(this.transformExpression(stmt.argument));
              }
              // Other statements
              else {
                const transformed = this.transformStatement(stmt);
                if (transformed) {
                  if (Array.isArray(transformed))
                    doBlock.statements.push(...transformed);
                  else
                    doBlock.statements.push(transformed);
                }
              }
            }

            // Register the variable type so subsequent uses get the correct sigil
            this.registerVariableType(name, '$');
            const varDecl = new PerlVarDeclaration('our', name, '$',
              new PerlCall('do', [doBlock]));
            targetModule.statements.push(varDecl);
          } else {
            // Arrow function with expression body - just use the return value
            const returnValue = this.getIIFEReturnValue(decl.init);
            if (returnValue) {
              const sigil = this.inferSigilFromValue(returnValue);
              // Register the variable type so subsequent uses get the correct sigil
              this.registerVariableType(name, sigil);
              const varDecl = new PerlVarDeclaration(
                'our',
                name,
                sigil,
                this.transformExpression(returnValue)
              );
              targetModule.statements.push(varDecl);
            }
          }
        }
        // Handle class expressions: let ClassName = class extends X { ... }
        else if (decl.init.type === 'ClassExpression' || decl.init.type === 'ClassDeclaration') {
          const classNode = {
            ...decl.init,
            type: 'ClassDeclaration',
            id: decl.init.id || { name: name, type: 'Identifier' }
          };
          // transformClassDeclaration pushes directly to targetModule.statements
          this.transformClassDeclaration(classNode, targetModule);
        }
        // Handle function expressions as named subroutines
        // This handles hoisted IIFE functions: const piMix = (x, y) => { ... }
        else if (decl.init.type === 'FunctionExpression' ||
                 decl.init.type === 'ArrowFunctionExpression') {
          // Register this name as a function for code reference handling
          this.functionNames.add(name);

          const func = new PerlSub(name);
          func.useSignatures = this.options.addSignatures;

          // Parameters
          if (decl.init.params) {
            for (const param of decl.init.params) {
              let paramName, defaultValue = null;
              if (param.type === 'AssignmentPattern') {
                paramName = param.left.name;
                defaultValue = this.transformExpression(param.right);
              } else if (param.defaultValue) {
                paramName = param.name;
                defaultValue = this.transformExpression(param.defaultValue);
              } else {
                paramName = param.name;
              }
              func.parameters.push(new PerlParameter(paramName, '$', null, defaultValue));
              this.registerVariableType(paramName, '$');
            }
          }

          // Body
          if (decl.init.body) {
            if (decl.init.body.type === 'BlockStatement') {
              func.body = this.transformBlockStatement(decl.init.body);
            } else {
              // Arrow function with expression body
              func.body = new PerlBlock();
              func.body.statements.push(new PerlReturn(this.transformExpression(decl.init.body)));
            }
          }

          targetModule.statements.push(func);
        }
        // Handle simple literals and expressions as constants
        // This includes many IL node types: Floor, Ceil, Round, Abs, Min, Max, etc.
        else {
          // Skip destructuring temps that reference module identifiers like:
          // _destructure_0 = AlgorithmFramework, _destructure_0 = FountainFoundation
          // These are generated by the IL for const { ... } = require('./module.js')
          if (decl.init.type === 'Identifier' && name.startsWith('_destructure')) {
            // Skip - these are module imports that resolve to undefined in Perl
            continue;
          }

          // Skip member access from framework modules like:
          // RegisterAlgorithm = AlgorithmFramework.RegisterAlgorithm
          if (decl.init.type === 'MemberExpression' &&
              decl.init.object.type === 'Identifier' &&
              (decl.init.object.name === 'AlgorithmFramework' || decl.init.object.name === 'OpCodes')) {
            // Skip - these are framework imports
            continue;
          }

          // Skip assignments that extract from framework destructure temps like:
          // $RegisterAlgorithm = $_destructure_0->RegisterAlgorithm
          // These are provided by the test harness
          if (decl.init.type === 'MemberExpression' &&
              decl.init.object.type === 'Identifier' &&
              decl.init.object.name.startsWith('_destructure')) {
            // Skip - these are framework imports
            continue;
          }

          // Skip bare identifier assignments that are framework exports
          // e.g., RegisterAlgorithm = RegisterAlgorithm (from destructuring)
          const frameworkExports = [
            'RegisterAlgorithm', 'CategoryType', 'SecurityStatus', 'ComplexityType',
            'CountryCode', 'AeadAlgorithm', 'IAeadInstance', 'BlockCipherAlgorithm',
            'IBlockCipherInstance', 'StreamCipherAlgorithm', 'IStreamCipherInstance',
            'HashFunctionAlgorithm', 'IHashFunctionInstance', 'MacAlgorithm', 'IMacInstance',
            'KdfAlgorithm', 'IKdfInstance', 'ChecksumAlgorithm', 'IChecksumInstance',
            'EncodingAlgorithm', 'IEncodingInstance', 'CompressionAlgorithm', 'ICompressionInstance',
            'ClassicalCipherAlgorithm', 'IClassicalCipherInstance', 'RandomAlgorithm', 'IRandomInstance',
            'EccAlgorithm', 'IEccInstance', 'CipherModeAlgorithm', 'ICipherModeInstance',
            'PaddingAlgorithm', 'IPaddingInstance', 'SignatureAlgorithm', 'ISignatureInstance',
            'KeyExchangeAlgorithm', 'IKeyExchangeInstance', 'KeyAgreementAlgorithm', 'IKeyAgreementInstance',
            'AsymmetricCipherAlgorithm', 'IAsymmetricCipherInstance', 'AsymmetricAlgorithm',
            'TestCase', 'KeySize', 'LinkItem', 'Vulnerability', 'AuthResult',
            'ErrorCorrectionAlgorithm', 'IErrorCorrectionInstance', 'CryptoAlgorithm', 'ICryptoInstance',
            'Algorithm', 'IAlgorithmInstance', 'OpCodes'
          ];
          if (decl.init.type === 'Identifier' && frameworkExports.includes(decl.init.name)) {
            // Skip - these are framework imports
            continue;
          }

          const sigil = this.inferSigilFromValue(decl.init);
          // Register the variable type so subsequent uses get the correct sigil
          this.registerVariableType(name, sigil);
          const varDecl = new PerlVarDeclaration(
            'our',
            name,
            sigil,
            this.transformExpression(decl.init)
          );
          targetModule.statements.push(varDecl);
        }
      }
    }

    /**
     * Transform a function declaration
     */
    transformFunctionDeclaration(node, targetModule) {
      const funcName = node.id.name;
      // Register this name as a function for code reference handling
      this.functionNames.add(funcName);

      const func = new PerlSub(funcName);
      func.useSignatures = this.options.addSignatures;

      // Parameters
      // IMPORTANT: In Perl signatures, always use $ for parameters
      // - @ and % are "slurpy" and must be last in parameter list
      // - JavaScript arrays/objects are passed as references anyway
      if (node.params) {
        for (const param of node.params) {
          // Handle parameter with default value: function(x = 5) => sub($x = 5)
          let paramName, defaultValue = null;
          if (param.type === 'AssignmentPattern') {
            paramName = param.left.name;
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            paramName = param.name;
            defaultValue = this.transformExpression(param.defaultValue);
          } else {
            paramName = param.name;
          }
          // $_ is a special variable in Perl - cannot be used as a formal parameter in signatures
          if (paramName === '_') paramName = '_unused';
          // Always use $ for function parameters to avoid slurpy issues
          const perlParam = new PerlParameter(paramName, '$', null, defaultValue);
          func.parameters.push(perlParam);
          // IMPORTANT: Register as scalar so it's used correctly in body
          // (not inferred, since parameter is always scalar in Perl signatures)
          this.registerVariableType(paramName, '$');
        }
      }

      // Body
      if (node.body) {
        func.body = this.transformBlockStatement(node.body);
      }

      targetModule.statements.push(func);
    }

    /**
     * Transform a class declaration to a Perl package
     */
    transformClassDeclaration(node, targetModule = this.currentModule) {
      const className = node.id?.name;

      // Skip if no class name or no target module
      if (!className || !targetModule) return;

      // Track this class name for identifier resolution
      this.definedClassNames.add(className);

      // Skip framework utility classes (provided by runtime)
      if (SKIP_CLASSES.has(className))
        return;

      const perlClass = new PerlClass(className, {
        useModernClass: this.options.useModernClass
      });

      // Handle superclass
      if (node.superClass) {
        let baseName;
        if (node.superClass.type === 'MemberExpression') {
          // Handle AlgorithmFramework.BlockCipherAlgorithm
          baseName = node.superClass.property.name || node.superClass.property.value;
        } else {
          baseName = node.superClass.name;
        }
        perlClass.baseClass = baseName;

        // Track framework classes for stub generation
        if (baseName && FRAMEWORK_CLASSES.has(baseName))
          this.frameworkClasses.add(baseName);
      }

      const prevClass = this.currentClass;
      this.currentClass = perlClass;

      // Handle both class body structures
      const members = node.body?.body || node.body || [];

      // Collect getters and setters to combine them
      const accessors = new Map(); // name -> { getter: node, setter: node }

      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // Extract fields from constructor
              const fields = this.extractFieldsFromConstructor(member);
              for (const field of fields) {
                perlClass.fields.push(field);
              }

              // Also create ADJUST/BUILD method if needed
              const method = this.transformConstructor(member);
              if (method) {
                perlClass.methods.push(method);
              }
            } else if (member.kind === 'get' || member.kind === 'set') {
              // Collect getter/setter pairs
              const name = member.key.name;
              if (!accessors.has(name)) {
                accessors.set(name, { getter: null, setter: null });
              }
              if (member.kind === 'get') {
                accessors.get(name).getter = member;
              } else {
                accessors.get(name).setter = member;
              }
            } else {
              // Regular method
              const method = this.transformMethodDefinition(member);
              perlClass.methods.push(method);
            }
          } else if (member.type === 'PropertyDefinition') {
            // Field
            const field = this.transformPropertyDefinition(member);
            perlClass.fields.push(field);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> Perl module-level statements
            const initStatements = this.transformStaticBlock(member);
            if (initStatements) {
              perlClass.staticInitStatements = perlClass.staticInitStatements || [];
              perlClass.staticInitStatements.push(...initStatements);
            }
          }
        }

        // Process getter/setter pairs into combined methods
        for (const [name, pair] of accessors) {
          const combinedMethod = this.transformAccessorPair(name, pair.getter, pair.setter);
          perlClass.methods.push(combinedMethod);
        }
      }

      this.currentClass = prevClass;

      targetModule.statements.push(perlClass);
    }

    /**
     * Extract fields from constructor's this.x = y assignments
     */
    extractFieldsFromConstructor(node) {
      const fields = [];

      if (!node.value || !node.value.body || node.value.body.type !== 'BlockStatement')
        return fields;

      for (const stmt of node.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          const propName = expr.left.property.name || expr.left.property.value;
          const value = expr.right;

          const field = new PerlField(propName);
          field.defaultValue = this.transformExpression(value);

          fields.push(field);
        }
      }

      return fields;
    }

    /**
     * Check if a statement is a this.property = value assignment
     */
    isThisPropertyAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;
      if (expr.left.type !== 'MemberExpression') return false;
      return expr.left.object.type === 'ThisExpression';
    }

    /**
     * Transform a constructor to BUILD/ADJUST
     */
    transformConstructor(node) {
      const ctor = new PerlSub(this.options.useModernClass ? 'ADJUST' : 'BUILD');
      ctor.isMethod = true;
      ctor.useSignatures = this.options.addSignatures;

      // Parameters
      if (node.value && node.value.params) {
        // Add $self as first parameter if not using modern class
        if (!this.options.useModernClass) {
          ctor.parameters.push(new PerlParameter('self', '$'));
        }

        for (const param of node.value.params) {
          // Handle parameter with default value
          // IL AST: Identifier with defaultValue property
          // Raw AST: AssignmentPattern with left.name and right
          let paramName, defaultValue = null;
          if (param.type === 'AssignmentPattern') {
            paramName = param.left.name;
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            // IL AST puts default on the Identifier node
            paramName = param.name;
            defaultValue = this.transformExpression(param.defaultValue);
          } else {
            paramName = param.name;
            // For BUILD/ADJUST methods, make all parameters optional with undef default
            // This allows calling BUILD() without arguments for initialization
            defaultValue = PerlLiteral.Undef();
          }
          // Always use $ for function parameters to avoid slurpy issues
          ctor.parameters.push(new PerlParameter(paramName, '$', null, defaultValue));
          // IMPORTANT: Register parameter as scalar so it's used correctly in body
          this.registerVariableType(paramName, '$');
        }
      } else if (!this.options.useModernClass) {
        // No params, but still add $self
        ctor.parameters.push(new PerlParameter('self', '$'));
      }

      // Body - filter out super() calls since they're handled in 'new'
      if (node.value && node.value.body) {
        const filteredBody = this.filterSuperCalls(node.value.body);
        ctor.body = this.transformBlockStatement(filteredBody);
      }

      return ctor;
    }

    /**
     * Filter out super() calls from a block, since they're already in 'new'
     */
    filterSuperCalls(body) {
      if (!body || !body.body) return body;

      const filtered = {
        ...body,
        body: body.body.filter(stmt => {
          // Filter out ExpressionStatement with ParentConstructorCall
          if (stmt.type === 'ExpressionStatement') {
            const expr = stmt.expression;
            if (expr && expr.type === 'ParentConstructorCall') return false;
            // Also filter super() as CallExpression with Super callee
            if (expr && expr.type === 'CallExpression' && expr.callee && expr.callee.type === 'Super')
              return false;
          }
          return true;
        })
      };

      return filtered;
    }

    /**
     * Transform a method definition
     */
    transformMethodDefinition(node) {
      const methodName = node.key.name;
      const method = new PerlSub(methodName);
      method.isMethod = true;
      method.useSignatures = this.options.addSignatures;

      const prevInMethod = this.inMethod;
      this.inMethod = true;

      // Add $self parameter if not using modern class
      if (!this.options.useModernClass && !node.static) {
        method.parameters.push(new PerlParameter('self', '$'));
      }

      // Parameters
      // IMPORTANT: Always use $ for parameters to avoid slurpy issues
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          // Handle parameter with default value: function(x = 5) => sub($x = 5)
          let paramName, defaultValue = null;
          if (param.type === 'AssignmentPattern') {
            paramName = param.left.name;
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            paramName = param.name;
            defaultValue = this.transformExpression(param.defaultValue);
          } else {
            paramName = param.name;
          }
          // Always use $ for function parameters
          method.parameters.push(new PerlParameter(paramName, '$', null, defaultValue));
          // IMPORTANT: Register parameter as scalar so it's used correctly in body
          this.registerVariableType(paramName, '$');
        }
      }

      // Body
      if (node.value && node.value.body) {
        method.body = this.transformBlockStatement(node.value.body);
      }

      this.inMethod = prevInMethod;

      return method;
    }

    /**
     * Transform getter/setter pair into combined Perl accessor method
     * JavaScript: get foo() { return this._foo; }
     *             set foo(v) { this._foo = v; }
     * Perl:       sub foo { my $self = shift; if (@_) { <setter body> } else { <getter body> } }
     */
    transformAccessorPair(name, getterNode, setterNode) {
      const method = new PerlSub(name);

      // Don't add $self as parameter - we'll shift it manually
      // This allows the @_ check to work correctly for getter/setter detection

      const prevInMethod = this.inMethod;
      this.inMethod = true;

      const block = new PerlBlock();

      // First statement: my $self = shift; (removes $self from @_)
      block.statements.push(
        new PerlVarDeclaration('my', 'self', '$', new PerlCall('shift', []))
      );

      if (setterNode && getterNode) {
        // Both getter and setter - create if (@_) { setter } else { getter }
        const setterParam = setterNode.value?.params?.[0]?.name || 'value';

        // Setter branch: my $value = shift; <setter body>
        const setterBranch = new PerlBlock();
        setterBranch.statements.push(
          new PerlVarDeclaration('my', setterParam, '$', new PerlCall('shift', []))
        );

        // Transform setter body statements
        if (setterNode.value?.body?.body) {
          for (const stmt of setterNode.value.body.body) {
            const transformed = this.transformStatement(stmt);
            if (transformed) {
              if (Array.isArray(transformed)) {
                setterBranch.statements.push(...transformed);
              } else {
                setterBranch.statements.push(transformed);
              }
            }
          }
        }

        // Getter branch: transform getter body
        const getterBranch = new PerlBlock();
        if (getterNode.value?.body?.body) {
          for (const stmt of getterNode.value.body.body) {
            const transformed = this.transformStatement(stmt);
            if (transformed) {
              if (Array.isArray(transformed)) {
                getterBranch.statements.push(...transformed);
              } else {
                getterBranch.statements.push(transformed);
              }
            }
          }
        }

        // Create if (@_) { setter } else { getter }
        const ifStmt = new PerlIf(
          new PerlCall('scalar', [new PerlIdentifier('_', '@')]),
          setterBranch,
          [],  // no elsif branches
          getterBranch
        );
        block.statements.push(ifStmt);

      } else if (setterNode) {
        // Setter only
        const setterParam = setterNode.value?.params?.[0]?.name || 'value';

        block.statements.push(
          new PerlVarDeclaration('my', setterParam, '$', new PerlCall('shift', []))
        );

        if (setterNode.value?.body?.body) {
          for (const stmt of setterNode.value.body.body) {
            const transformed = this.transformStatement(stmt);
            if (transformed) {
              if (Array.isArray(transformed)) {
                block.statements.push(...transformed);
              } else {
                block.statements.push(transformed);
              }
            }
          }
        }

      } else if (getterNode) {
        // Getter only
        if (getterNode.value?.body?.body) {
          for (const stmt of getterNode.value.body.body) {
            const transformed = this.transformStatement(stmt);
            if (transformed) {
              if (Array.isArray(transformed)) {
                block.statements.push(...transformed);
              } else {
                block.statements.push(transformed);
              }
            }
          }
        }
      }

      method.body = block;
      this.inMethod = prevInMethod;

      return method;
    }

    /**
     * Transform a property definition
     */
    transformPropertyDefinition(node) {
      const fieldName = node.key.name;
      const field = new PerlField(fieldName);

      if (node.value) {
        field.defaultValue = this.transformExpression(node.value);
      }

      return field;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> Perl module-level statements
      // Perl doesn't have static class blocks, so transform to statements
      // Handle both array body and object with body property
      const statements = Array.isArray(node.body) ? node.body :
                         (node.body?.body && Array.isArray(node.body.body)) ? node.body.body : [];
      return statements.map(stmt => this.transformStatement(stmt));
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new PerlBlock();

      if (node.body && Array.isArray(node.body)) {
        for (const stmt of node.body) {
          const perlStmt = this.transformStatement(stmt);
          if (perlStmt) {
            if (Array.isArray(perlStmt)) {
              block.statements.push(...perlStmt);
            } else {
              block.statements.push(perlStmt);
            }
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement
     * CRITICAL: Handle all 16 statement types
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        case 'VariableDeclaration':
          return this.transformLetStatement(node);

        case 'ExpressionStatement':
          return this.transformExpressionStatementNode(node);

        case 'ReturnStatement':
          return this.transformReturnStatement(node);

        case 'IfStatement':
          return this.transformIfStatement(node);

        case 'ForStatement':
          return this.transformForStatement(node);

        case 'ForOfStatement':
          return this.transformForOfStatement(node);

        case 'ForInStatement':
          return this.transformForInStatement(node);

        case 'WhileStatement':
          return this.transformWhileStatement(node);

        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);

        case 'SwitchStatement':
          return this.transformSwitchStatement(node);

        case 'TryStatement':
          return this.transformTryStatement(node);

        case 'ThrowStatement':
          return this.transformThrowStatement(node);

        case 'BlockStatement':
          return this.transformBlockStatement(node);

        case 'BreakStatement':
          return new PerlLast();

        case 'ContinueStatement':
          return new PerlNext();

        case 'LabeledStatement':
          return this.transformLabeledStatement(node);

        default:
          return null;
      }
    }

    /**
     * Transform a variable declaration to 'my' statement
     */
    transformLetStatement(node) {
      const statements = [];

      for (const decl of node.declarations) {
        const varName = decl.id.name;
        let initializer = null;

        if (decl.init) {
          initializer = this.transformExpression(decl.init);

          // Track if this variable holds a code reference (function expression or arrow function)
          if (decl.init.type === 'FunctionExpression' ||
              decl.init.type === 'ArrowFunctionExpression') {
            this.codeRefVariables.add(varName);
          }
        }

        const sigil = this.inferSigilFromValue(decl.init);
        const varDecl = new PerlVarDeclaration('my', varName, sigil, initializer);

        this.registerVariableType(varName, sigil);
        statements.push(varDecl);
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      // Check if expression is ArrayForEach - it returns a statement, not expression
      const exprType = node.expression.type || node.expression.ilNodeType;
      if (exprType === 'ArrayForEach') {
        return this.transformArrayForEach(node.expression);
      }

      // ArrayFill as statement: array.fill(value) mutates in place
      // Generate: @{$arr} = (value) x scalar(@{$arr});
      if (exprType === 'ArrayFill') {
        const fillArr = this.transformExpression(node.expression.array);
        const fillVal = this.transformExpression(node.expression.value);
        const deref = this.wrapArrayDeref(fillArr);
        const fillLen = new PerlCall('scalar', [deref]);
        return new PerlExpressionStatement(
          new PerlAssignment(
            new PerlUnaryExpression('@', fillArr, true),
            '=',
            new PerlBinaryExpression(new PerlGrouped(fillVal), 'x', fillLen)
          )
        );
      }

      // ArraySort as statement: array.sort(fn) mutates in place
      // Generate: @{$arr} = sort { ... } @{$arr};
      if (exprType === 'ArraySort') {
        const sortArr = this.transformExpression(node.expression.array);
        const deref = this.wrapArrayDeref(sortArr);
        const compareFn = node.expression.compareFn;
        if (compareFn && compareFn.params && compareFn.params.length >= 2) {
          const aName = compareFn.params[0].name || 'a';
          const bName = compareFn.params[1].name || 'b';
          this.registerVariableType(aName, '$');
          this.registerVariableType(bName, '$');
          const bodyStmts = compareFn.body.type === 'BlockStatement'
            ? compareFn.body.body.map(s => this.transformStatement(s)).filter(s => s !== null)
            : [new PerlExpressionStatement(this.transformExpression(compareFn.body))];
          return new PerlExpressionStatement(
            new PerlAssignment(
              new PerlUnaryExpression('@', sortArr, true),
              '=',
              new PerlCall('sort', [new PerlAnonSub(
                [new PerlParameter(aName, '$'), new PerlParameter(bName, '$')],
                new PerlBlock(bodyStmts)), deref])
            )
          );
        }
        // No compareFn - simple sort
        return new PerlExpressionStatement(
          new PerlAssignment(
            new PerlUnaryExpression('@', sortArr, true),
            '=',
            new PerlCall('sort', [deref])
          )
        );
      }

      // Handle ClassName = class extends X { ... } assignment
      // Convert to a proper ClassDeclaration so the class body is processed
      if (node.expression.type === 'AssignmentExpression' &&
          node.expression.operator === '=' &&
          node.expression.right &&
          node.expression.right.type === 'ClassExpression') {
        const classNode = node.expression.right;
        // Synthesize a ClassDeclaration from the ClassExpression + assignment target
        const className = node.expression.left.name || node.expression.left.value;
        if (className) {
          const syntheticDecl = {
            ...classNode,
            type: 'ClassDeclaration',
            id: { name: className, type: 'Identifier' }
          };
          // transformClassDeclaration pushes directly to currentModule.statements
          this.transformClassDeclaration(syntheticDecl);
          return null; // Suppress the expression statement
        }
      }

      const expr = this.transformExpression(node.expression);
      if (!expr) return null;

      return new PerlExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      if (node.argument) {
        const expr = this.transformExpression(node.argument);
        return new PerlReturn(expr);
      }

      return new PerlReturn();
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      // Collapse framework-guarding if-statements: always emit the body
      // Patterns: if (typeof AlgorithmFramework !== 'undefined' && AlgorithmFramework.Find) { ... }
      //           if (typeof OpCodes !== 'undefined') { ... }
      if (this._isFrameworkGuard(node.test)) {
        const body = this.transformStatement(node.consequent);
        return body || new PerlBlock();
      }

      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new PerlBlock();

      const elsifBranches = [];
      let elseBranch = null;

      // Handle else-if chains
      if (node.alternate) {
        if (node.alternate.type === 'IfStatement') {
          // elsif
          const altCond = this.transformExpression(node.alternate.test);
          const altBody = this.transformStatement(node.alternate.consequent) || new PerlBlock();
          elsifBranches.push({ condition: altCond, body: altBody });

          // Check for more elsif/else
          if (node.alternate.alternate) {
            elseBranch = this.transformStatement(node.alternate.alternate) || new PerlBlock();
          }
        } else {
          elseBranch = this.transformStatement(node.alternate) || new PerlBlock();
        }
      }

      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const elseBlock = elseBranch ? (elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch)) : null;

      return new PerlIf(condition, thenBlock, elsifBranches, elseBlock);
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      // Convert C-style for loop to Perl for loop
      const forLoop = new PerlFor(null, null, this.transformStatement(node.body) || new PerlBlock());
      forLoop.isCStyle = true;
      forLoop.init = node.init ? this.transformStatement(node.init) : null;
      forLoop.condition = node.test ? this.transformExpression(node.test) : null;
      forLoop.increment = node.update ? this.transformExpression(node.update) : null;

      return forLoop;
    }

    /**
     * Transform a for-of statement: for (const x of array) { ... }
     * Also handles destructuring: for (const [a, b] of array) { ... }
     *
     * The parser may have already expanded destructuring into multiple declarations:
     * - First declaration with ilNodeType: 'DestructureTemp' (the temp variable)
     * - Remaining declarations with ilNodeType: 'DestructuredElement' (extracted vars)
     */
    transformForOfStatement(node) {
      // Extract variable name from left side
      let varName = 'item';
      let destructureNames = null;
      if (node.left.type === 'VariableDeclaration') {
        const declarations = node.left.declarations || [];
        const firstDecl = declarations[0];

        // Check if parser has already expanded destructuring (ilNodeType markers)
        if (firstDecl && firstDecl.ilNodeType === 'DestructureTemp') {
          // Parser has expanded destructuring - extract the temp name and element names
          varName = firstDecl.id?.name || '_destructure_' + this.destructureCounter++;
          destructureNames = [];
          for (let i = 1; i < declarations.length; ++i) {
            const decl = declarations[i];
            if (decl.ilNodeType === 'DestructuredElement' && decl.id?.name) {
              destructureNames.push(decl.id.name);
            }
          }
        } else if (firstDecl && firstDecl.id) {
          // Original ArrayPattern/ObjectPattern (if parser didn't expand)
          if (firstDecl.id.type === 'ArrayPattern' && firstDecl.id.elements) {
            destructureNames = firstDecl.id.elements.map(el => el && el.name).filter(n => n);
            varName = '_destructure_' + this.destructureCounter++;
          } else if (firstDecl.id.type === 'ObjectPattern' && firstDecl.id.properties) {
            destructureNames = firstDecl.id.properties.map(p => p.key?.name || p.value?.name).filter(n => n);
            varName = '_destructure_' + this.destructureCounter++;
          } else {
            varName = firstDecl.id.name || 'item';
          }
        }
      } else if (node.left.type === 'Identifier') {
        varName = node.left.name;
      }

      // Transform the iterable
      const iterable = this.transformExpression(node.right);

      // Transform the body
      let body = this.transformStatement(node.body) || new PerlBlock();
      let bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      // If we have destructuring, add extraction statements at the beginning of the loop body
      if (destructureNames && destructureNames.length > 0) {
        const extractStatements = [];
        for (let i = 0; i < destructureNames.length; ++i) {
          const name = destructureNames[i];
          // my $name = $_destructure_X->[$i];
          extractStatements.push(new PerlVarDeclaration(
            'my',
            name,
            '$',
            new PerlSubscript(
              new PerlIdentifier(varName, '$'),
              PerlLiteral.Number(i),
              'array'
            )
          ));
        }
        // Prepend extraction statements to body
        const newStatements = [...extractStatements, ...bodyBlock.statements];
        bodyBlock = new PerlBlock(newStatements);
      }

      return new PerlFor('$' + varName, iterable, bodyBlock);
    }

    /**
     * Transform a for-in statement: for (const key in object) { ... }
     */
    transformForInStatement(node) {
      // Extract variable name from left side
      let varName = 'key';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = decl.id.name;
        }
      } else if (node.left.type === 'Identifier') {
        varName = node.left.name;
      }

      // Transform the object - for-in iterates over keys
      const object = this.transformExpression(node.right);
      // In Perl: foreach my $key (keys %hash)
      const keysCall = new PerlCall(new PerlIdentifier('keys'), [object]);

      const body = this.transformStatement(node.body) || new PerlBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PerlFor('$' + varName, keysCall, bodyBlock);
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new PerlBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PerlWhile(condition, bodyBlock);
    }

    /**
     * Transform a do-while statement
     */
    transformDoWhileStatement(node) {
      const body = this.transformStatement(node.body) || new PerlBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);
      const condition = this.transformExpression(node.test);

      const doWhile = new PerlWhile(condition, bodyBlock);
      doWhile.isDoWhile = true;
      return doWhile;
    }

    /**
     * Transform a switch statement to if/elsif chain (more portable than given/when)
     */
    transformSwitchStatement(node) {
      // Generate unique temp variable name based on switch context
      const tempVarName = '_sw_' + (this._switchCounter = (this._switchCounter || 0) + 1);

      // Transform the discriminant expression
      const discriminant = this.transformExpression(node.discriminant);

      // Create temp variable: my $_sw_1 = $discriminant;
      const tempVar = new PerlIdentifier(tempVarName, '$');
      const tempDecl = new PerlVarDeclaration('my', tempVarName, '$', discriminant);

      // Build if/elsif chain
      let firstCase = true;
      let ifStmt = null;
      let lastElsif = null;
      let defaultBody = null;

      for (const caseNode of node.cases) {
        const caseBody = new PerlBlock();

        // Transform case body (filter out break statements)
        for (const stmt of caseNode.consequent) {
          if (stmt.type === 'BreakStatement') continue;  // Skip break

          const perlStmt = this.transformStatement(stmt);
          if (perlStmt) {
            if (Array.isArray(perlStmt))
              caseBody.statements.push(...perlStmt);
            else
              caseBody.statements.push(perlStmt);
          }
        }

        if (caseNode.test) {
          // Regular case - use == for numeric and eq for string
          const pattern = this.transformExpression(caseNode.test);
          // Use a fresh reference to the temp var for each condition
          const tempVarRef = new PerlIdentifier(tempVarName, '$');
          const condition = new PerlBinaryExpression(tempVarRef, '==', pattern);

          if (firstCase) {
            // Pass the PerlBlock (caseBody), not just its statements array
            ifStmt = new PerlIf(condition, caseBody);
            lastElsif = ifStmt;
            firstCase = false;
          } else {
            // Add as elsif - use elseBranch (not elseBlock) to match PerlIf AST
            const elsif = new PerlIf(condition, caseBody);
            lastElsif.elseBranch = elsif;
            lastElsif = elsif;
          }
        } else {
          // Default case - save for later
          defaultBody = caseBody;
        }
      }

      // Add default case as else - use elseBranch and pass PerlBlock
      if (defaultBody && lastElsif)
        lastElsif.elseBranch = defaultBody.statements.length > 0 ? defaultBody : null;

      // Return as a block with the temp declaration and if chain
      if (ifStmt) {
        return [tempDecl, ifStmt];
      } else if (defaultBody) {
        // Only default case - just return the body
        return [tempDecl, ...defaultBody.statements];
      }

      return tempDecl;
    }

    /**
     * Transform a try-catch statement
     */
    transformTryStatement(node) {
      const tryStmt = new PerlTry();
      tryStmt.useModernTry = this.options.useExperimentalFeatures;
      tryStmt.tryBlock = this.transformStatement(node.block);

      if (node.handler) {
        tryStmt.catchBlock = this.transformStatement(node.handler.body);
        if (node.handler.param) {
          tryStmt.catchVariable = '$' + node.handler.param.name;
        }
      }

      if (node.finalizer) {
        tryStmt.finallyBlock = this.transformStatement(node.finalizer);
      }

      return tryStmt;
    }

    /**
     * Transform a throw statement
     */
    transformThrowStatement(node) {
      const expr = node.argument ? this.transformExpression(node.argument) : PerlLiteral.String("error");
      return new PerlDie(expr);
    }

    /**
     * Transform a labeled statement
     */
    transformLabeledStatement(node) {
      // Transform the body statement
      const bodyStmt = this.transformStatement(node.body);

      // Add label comment
      const comment = new PerlComment(`Label: ${node.label.name}`);
      return [comment, bodyStmt];
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new PerlBlock();
      if (stmt) {
        if (Array.isArray(stmt)) {
          block.statements.push(...stmt);
        } else {
          block.statements.push(stmt);
        }
      }
      return block;
    }

    /**
     * Transform an expression
     * CRITICAL: Handle all 19 expression types
     */
    transformExpression(node) {
      if (!node) return null;

      switch (node.type) {
        case 'Literal':
          return this.transformLiteral(node);

        case 'Identifier':
          return this.transformIdentifier(node);

        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.transformBinaryExpression(node);

        case 'UnaryExpression':
          return this.transformUnaryExpression(node);

        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);

        case 'UpdateExpression':
          return this.transformUpdateExpression(node);

        case 'MemberExpression':
          return this.transformMemberExpression(node);

        case 'CallExpression':
          return this.transformCallExpression(node);

        case 'ArrayExpression':
          return this.transformArrayExpression(node);

        case 'ObjectExpression':
          return this.transformObjectExpression(node);

        case 'NewExpression':
          return this.transformNewExpression(node);

        case 'ThisExpression':
          return new PerlIdentifier('self', '$');

        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        case 'ArrowFunctionExpression':
        case 'ArrowFunction':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        case 'SequenceExpression':
          // Transform all expressions in the sequence and join with comma
          // JavaScript: (a++, b += 2) -> Perl: ($a++, $b += 2)
          // This is important for for loop updates like: for (...; ...; r++, k += 16)
          const seqExprs = node.expressions.map(e => this.transformExpression(e));
          return new PerlList(seqExprs);

        case 'SpreadElement':
          return this.transformSpreadElement(node);

        case 'Super':
          return new PerlIdentifier('SUPER');

        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        case 'ObjectPattern':
          // Object destructuring - Perl doesn't support this directly
          // Return a comment placeholder
          return new PerlIdentifier('# Object destructuring not supported in Perl');

        // ========================[ IL AST Node Types ]========================
        // These are generated by the type-aware-transpiler's IL building phase

        case 'StringToBytes':
          // OpCodes.AnsiToBytes("...") -> pack/unpack or array of char codes
          return this.transformStringToBytes(node);

        case 'BytesToString':
          // OpCodes.BytesToAnsi(arr) -> pack('C*', @{$arr})
          return this.transformBytesToString(node);

        case 'HexDecode':
          // OpCodes.Hex8ToBytes("...") -> pack('H*', ...) or byte array
          return this.transformHexDecode(node);

        case 'PackBytes':
          // OpCodes.Pack32BE/LE etc -> pack(format, ...)
          return this.transformPackBytes(node);

        case 'UnpackBytes':
          // OpCodes.Unpack32BE/LE etc -> unpack(format, ...)
          return this.transformUnpackBytes(node);

        case 'ArrayXor':
          // OpCodes.XorArrays -> XOR two arrays element-wise
          return this.transformArrayXor(node);

        case 'ArrayClear':
          // OpCodes.ClearArray -> reset array
          return this.transformArrayClear(node);

        case 'ArrayForEach':
          // array.forEach callback -> foreach loop
          return this.transformArrayForEach(node);

        case 'ArrayMap':
          // array.map callback -> map loop
          return this.transformArrayMap(node);

        case 'ArrayFilter':
          // array.filter callback -> grep
          return this.transformArrayFilter(node);

        case 'RotateLeft':
        case 'RotateRight':
          // Bit rotation operations
          return this.transformRotation(node);

        // ========================[ This/Super IL Node Types ]========================

        case 'ThisPropertyAccess':
          // this.property -> $self->{'property'}
          return new PerlSubscript(
            new PerlIdentifier('self', '$'),
            PerlLiteral.String(node.property, "'"),
            'hash',
            true
          );

        case 'ThisMethodCall':
          // this.method(args) -> $self->method(args)
          const thisArgs = (node.arguments || []).map(a => this.transformExpression(a));
          return new PerlMemberAccess(
            new PerlIdentifier('self', '$'),
            new PerlCall(new PerlIdentifier(node.method), thisArgs),
            '->'
          );

        case 'ParentConstructorCall':
          // super() -> $self->SUPER::new(@_) or $class->SUPER::new(args)
          const superCtorArgs = (node.arguments || []).map(a => this.transformExpression(a));
          return new PerlCall(
            new PerlMemberAccess(
              new PerlIdentifier('class', '$'),
              new PerlIdentifier('SUPER::new'),
              '->'
            ),
            superCtorArgs.length > 0 ? superCtorArgs : [new PerlIdentifier('_', '@')]
          );

        case 'ParentMethodCall':
          // super.method(args) -> $self->SUPER::method(args)
          const superArgs = (node.arguments || []).map(a => this.transformExpression(a));
          return new PerlCall(
            new PerlMemberAccess(
              new PerlIdentifier('self', '$'),
              new PerlIdentifier('SUPER::' + node.method),
              '->'
            ),
            superArgs
          );

        case 'ArrayLength': {
          // For strings: str.length -> length($str)
          // For arrays: arr.length -> scalar(@arr)
          const arrExpr = this.transformExpression(node.array);
          if (this.isStringType(node.array)) {
            return new PerlCall('length', [arrExpr]);
          }
          return new PerlCall('scalar', [this.wrapArrayDeref(arrExpr)]);
        }

        // ========================[ Cast IL Node Types ]========================

        case 'Cast': {
          // OpCodes.ToUint32(x) -> ($x) & 0xFFFFFFFF (for uint32)
          // OpCodes.ToUint8(x) -> ($x) & 0xFF (for uint8)
          // OpCodes.ToInt32(x) -> unpack('l', pack('L', $x)) (for int32)
          // Note: IL Cast node can have value, argument, or arguments[0]
          const castArg = node.value || node.argument || (node.arguments && node.arguments[0]);
          const castVal = this.transformExpression(castArg);
          switch (node.targetType) {
            case 'uint32':
              return new PerlBinaryExpression(
                new PerlGrouped(castVal),
                '&',
                PerlLiteral.Number(0xFFFFFFFF)
              );
            case 'uint8':
              return new PerlBinaryExpression(
                new PerlGrouped(castVal),
                '&',
                PerlLiteral.Number(0xFF)
              );
            case 'uint16':
              return new PerlBinaryExpression(
                new PerlGrouped(castVal),
                '&',
                PerlLiteral.Number(0xFFFF)
              );
            case 'int32':
              // For signed 32-bit: unpack('l', pack('L', $x))
              return new PerlCall('unpack', [
                PerlLiteral.String('l', "'"),
                new PerlCall('pack', [PerlLiteral.String('L', "'"), castVal])
              ]);
            default:
              // Unknown cast type - return value as-is
              return castVal;
          }
        }

        // ========================[ Math IL Node Types ]========================

        case 'Floor':
          return new PerlCall('int', [this.transformExpression(node.argument)]);

        case 'Ceil':
          // ceil(x) -> POSIX::ceil(x)
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("ceil"), "::"), [this.transformExpression(node.argument)]);

        case 'Round':
          // round(x) -> POSIX::round(x)
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("round"), "::"), [this.transformExpression(node.argument)]);

        case 'Abs':
          return new PerlCall('abs', [this.transformExpression(node.argument)]);

        case 'Min':
          // Use fully qualified name to work across package boundaries
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("min"), "::"), (node.arguments || []).map(a => this.transformExpression(a)));

        case 'Max':
          // Use fully qualified name to work across package boundaries
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("max"), "::"), (node.arguments || []).map(a => this.transformExpression(a)));

        case 'Pow':
          // Math.pow(a, b) -> a ** b
          const base = this.transformExpression(node.arguments[0]);
          const exp = this.transformExpression(node.arguments[1]);
          return new PerlBinaryExpression(base, '**', exp);

        case 'Sqrt':
          return new PerlCall('sqrt', [this.transformExpression(node.argument)]);

        case 'Log':
          return new PerlCall('log', [this.transformExpression(node.argument)]);

        case 'Log2':
          // Math.log2(x) -> log(x) / log(2)
          return new PerlBinaryExpression(
            new PerlCall('log', [this.transformExpression(node.argument)]),
            '/',
            new PerlCall('log', [PerlLiteral.Number(2)])
          );

        case 'Log10':
          // Math.log10(x) -> log(x) / log(10)
          return new PerlBinaryExpression(
            new PerlCall('log', [this.transformExpression(node.argument)]),
            '/',
            new PerlCall('log', [PerlLiteral.Number(10)])
          );

        case 'Exp':
          return new PerlCall('exp', [this.transformExpression(node.argument)]);

        case 'Sin':
          return new PerlCall('sin', [this.transformExpression(node.argument)]);

        case 'Cos':
          return new PerlCall('cos', [this.transformExpression(node.argument)]);

        case 'Tan':
          // tan(x) -> sin(x)/cos(x)
          return new PerlBinaryExpression(
            new PerlCall('sin', [this.transformExpression(node.arguments?.[0] || node.value)]),
            '/',
            new PerlCall('cos', [this.transformExpression(node.arguments?.[0] || node.value)])
          );

        case 'Asin':
          // asin(x) -> atan2(x, sqrt(1 - x*x))
          return new PerlCall('atan2', [
            this.transformExpression(node.arguments?.[0] || node.value),
            new PerlCall('sqrt', [new PerlBinaryExpression(
              PerlLiteral.Number(1),
              '-',
              new PerlBinaryExpression(
                this.transformExpression(node.arguments?.[0] || node.value),
                '*',
                this.transformExpression(node.arguments?.[0] || node.value)
              )
            )])
          ]);

        case 'Acos':
          // acos(x) -> atan2(sqrt(1 - x*x), x)
          return new PerlCall('atan2', [
            new PerlCall('sqrt', [new PerlBinaryExpression(
              PerlLiteral.Number(1),
              '-',
              new PerlBinaryExpression(
                this.transformExpression(node.arguments?.[0] || node.value),
                '*',
                this.transformExpression(node.arguments?.[0] || node.value)
              )
            )]),
            this.transformExpression(node.arguments?.[0] || node.value)
          ]);

        case 'Atan':
          // atan(x) -> atan2(x, 1)
          return new PerlCall('atan2', [
            this.transformExpression(node.arguments?.[0] || node.value),
            PerlLiteral.Number(1)
          ]);

        case 'Atan2':
          // atan2(y, x) -> atan2(y, x) (built-in)
          return new PerlCall('atan2', [
            this.transformExpression(node.arguments?.[0] || node.y),
            this.transformExpression(node.arguments?.[1] || node.x)
          ]);

        case 'Sinh':
          // sinh(x) -> POSIX::sinh(x)
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("sinh"), "::"), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cosh':
          // cosh(x) -> POSIX::cosh(x)
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("cosh"), "::"), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Tanh':
          // tanh(x) -> POSIX::tanh(x)
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("tanh"), "::"), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cbrt':
          // cbrt(x) -> x ** (1/3)
          return new PerlBinaryExpression(
            this.transformExpression(node.arguments?.[0] || node.value),
            '**',
            new PerlGrouped(new PerlBinaryExpression(PerlLiteral.Number(1), '/', PerlLiteral.Number(3)))
          );

        case 'Hypot': {
          // hypot(a, b) -> sqrt(a*a + b*b)
          const hypotArgs = (node.arguments || []).map(a => this.transformExpression(a));
          return new PerlCall('sqrt', [new PerlBinaryExpression(
            new PerlBinaryExpression(hypotArgs[0], '*', hypotArgs[0]),
            '+',
            new PerlBinaryExpression(hypotArgs[1], '*', hypotArgs[1])
          )]);
        }

        case 'Sign':
          // sign(x) -> (x <=> 0)
          return new PerlGrouped(new PerlBinaryExpression(
            this.transformExpression(node.arguments?.[0] || node.value),
            '<=>',
            PerlLiteral.Number(0)
          ));

        case 'Fround':
          // fround(x) -> x (no native equivalent, pass through)
          return this.transformExpression(node.arguments?.[0] || node.value);

        case 'MathConstant': {
          // Math constants -> Perl expressions
          switch (node.name) {
            case 'PI':
              return new PerlBinaryExpression(PerlLiteral.Number(4), '*', new PerlCall('atan2', [PerlLiteral.Number(1), PerlLiteral.Number(1)]));
            case 'E':
              return new PerlCall('exp', [PerlLiteral.Number(1)]);
            case 'LN2':
              return new PerlCall('log', [PerlLiteral.Number(2)]);
            case 'LN10':
              return new PerlCall('log', [PerlLiteral.Number(10)]);
            case 'LOG2E':
              return new PerlBinaryExpression(PerlLiteral.Number(1), '/', new PerlCall('log', [PerlLiteral.Number(2)]));
            case 'LOG10E':
              return new PerlBinaryExpression(PerlLiteral.Number(1), '/', new PerlCall('log', [PerlLiteral.Number(10)]));
            case 'SQRT2':
              return new PerlCall('sqrt', [PerlLiteral.Number(2)]);
            case 'SQRT1_2':
              return new PerlCall('sqrt', [PerlLiteral.Number(0.5)]);
            default:
              return PerlLiteral.Number(node.value);
          }
        }

        case 'NumberConstant': {
          // Number constants -> Perl values
          switch (node.name) {
            case 'POSITIVE_INFINITY':
              return new PerlRawCode('9e999');
            case 'NEGATIVE_INFINITY':
              return new PerlRawCode('-9e999');
            case 'NaN':
              return new PerlRawCode("('NaN' + 0)");
            case 'MAX_SAFE_INTEGER':
              return PerlLiteral.Number(9007199254740991);
            case 'MIN_SAFE_INTEGER':
              return PerlLiteral.Number(-9007199254740991);
            case 'EPSILON':
              return PerlLiteral.Number(2.220446049250313e-16);
            default:
              return PerlLiteral.Number(node.value);
          }
        }

        case 'InstanceOfCheck': {
          // value instanceof ClassName -> ref($value) eq 'ClassName'
          const instVal = this.transformExpression(node.value);
          // Always use string literal for class name in ref() comparison
          const className = node.className?.name || node.className?.value || (typeof node.className === 'string' ? node.className : null);
          const instClassStr = className
            ? PerlLiteral.String(className, "'")
            : PerlLiteral.String(String(this.transformExpression(node.className)), "'");
          return new PerlBinaryExpression(
            new PerlCall('ref', [instVal]),
            'eq',
            instClassStr
          );
        }

        case 'Power':
          // Math.pow(base, exponent) -> base ** exponent
          return new PerlBinaryExpression(
            this.transformExpression(node.base),
            '**',
            this.transformExpression(node.exponent)
          );

        // ========================[ OpCodes Call fallback ]========================

        case 'OpCodesCall': {
          // Unknown OpCodes method - handle common ones or prefix with OpCodes::
          const methodName = node.method;
          const opArgs = (node.arguments || []).map(a => this.transformExpression(a));

          // CopyArray - shallow copy of array
          if (methodName === 'CopyArray')
            return new PerlArray([new PerlUnaryExpression('@', opArgs[0], true)]);

          // FillArray - fill array with value
          if (methodName === 'FillArray' || methodName === 'Fill')
            return new PerlArray([
              new PerlBinaryExpression(
                new PerlGrouped(opArgs[1] || opArgs[0]),
                'x',
                opArgs[2] || opArgs[1] || PerlLiteral.Number(1)
              )
            ]);

          // BitMask - create bitmask
          if (methodName === 'BitMask')
            return new PerlBinaryExpression(
              new PerlBinaryExpression(PerlLiteral.Number(1), '<<', opArgs[0]),
              '-',
              PerlLiteral.Number(1)
            );

          // CompareArrays - compare two arrays
          if (methodName === 'CompareArrays') {
            const joinA = new PerlCall('join', [PerlLiteral.String('', "'"), new PerlUnaryExpression('@', opArgs[0], true)]);
            const joinB = new PerlCall('join', [PerlLiteral.String('', "'"), new PerlUnaryExpression('@', opArgs[1], true)]);
            return new PerlBinaryExpression(joinA, 'eq', joinB);
          }

          // Default: prefix with OpCodes:: package name
          return new PerlCall(
            new PerlMemberAccess(new PerlIdentifier('OpCodes'), new PerlIdentifier(methodName.toLowerCase()), '::'),
            opArgs
          );
        }

        // ========================[ Array IL Node Types ]========================

        case 'ArraySlice': {
          // array.slice(start?, end?) -> [@{$array}] or [@{$array}[start..end-1]]
          // NOTE: Slice returns list, so we wrap in [...] to get arrayref
          const sliceArr = this.transformExpression(node.array);
          if (!node.start && !node.end) {
            // No args: copy entire array
            return new PerlArray([this.wrapArrayDeref(sliceArr)]);
          }
          const start = node.start ? this.transformExpression(node.start) : PerlLiteral.Number(0);
          const end = node.end
            ? new PerlBinaryExpression(this.transformExpression(node.end), '-', PerlLiteral.Number(1))
            : new PerlUnaryExpression('$#', sliceArr, true);
          // Wrap slice in [...] to return arrayref instead of list
          return new PerlArray([new PerlArraySlice(sliceArr, start, end)]);
        }

        case 'ArrayAppend': {
          // array.push(val) -> push(@arr, $val) or push(@{$ref}, $val)
          // array.push(...data) -> push(@{$arr}, @$data)
          const appendArr = this.transformExpression(node.array);
          let valueExpr;
          if (node.value && node.value.type === 'SpreadElement') {
            // Spread element: push(@arr, @$data) - dereference the spread source
            const spreadArg = this.transformExpression(node.value.argument);
            valueExpr = new PerlUnaryExpression('@', spreadArg, true);
          } else {
            valueExpr = this.transformExpression(node.value);
          }
          return new PerlCall('push', [
            this.wrapArrayDeref(appendArr),
            valueExpr
          ]);
        }

        case 'ArrayPop': {
          // array.pop() -> pop(@arr) or pop(@{$ref})
          const popArr = this.transformExpression(node.array);
          return new PerlCall('pop', [this.wrapArrayDeref(popArr)]);
        }

        case 'ArrayShift': {
          // array.shift() -> shift(@arr) or shift(@{$ref})
          const shiftArr = this.transformExpression(node.array);
          return new PerlCall('shift', [this.wrapArrayDeref(shiftArr)]);
        }

        case 'ArrayUnshift': {
          // array.unshift(val) -> unshift(@arr, $val)
          const unshiftArr = this.transformExpression(node.array);
          return new PerlCall('unshift', [
            this.wrapArrayDeref(unshiftArr),
            this.transformExpression(node.value)
          ]);
        }

        case 'ArrayConcat': {
          // array.concat(...others) -> [@arr1, @arr2, ...]
          const concatFirst = this.wrapArrayDeref(this.transformExpression(node.array));
          const concatRest = (node.arrays || []).map(a =>
            this.wrapArrayDeref(this.transformExpression(a))
          );
          return new PerlArray([concatFirst, ...concatRest]);
        }

        case 'ArrayJoin': {
          // array.join(sep) -> join($sep, @arr)
          const joinArr = this.transformExpression(node.array);
          const joinSep = node.separator
            ? this.transformExpression(node.separator)
            : PerlLiteral.String('', "'");
          return new PerlCall('join', [joinSep, this.wrapArrayDeref(joinArr)]);
        }

        case 'ArrayReverse': {
          // array.reverse() -> [reverse @arr]
          const revArr = this.transformExpression(node.array);
          return new PerlArray([
            new PerlCall('reverse', [this.wrapArrayDeref(revArr)])
          ]);
        }

        case 'ArraySort': {
          // array.sort(fn?) -> [sort @arr]
          const sortArr = this.transformExpression(node.array);
          if (node.compareFn) {
            return new PerlArray([
              new PerlCall('sort', [
                this.transformExpression(node.compareFn),
                this.wrapArrayDeref(sortArr)
              ])
            ]);
          }
          return new PerlArray([
            new PerlCall('sort', [this.wrapArrayDeref(sortArr)])
          ]);
        }

        case 'ArrayIndexOf': {
          // array.indexOf(val) -> simplified: first index or -1
          this.addRequiredModule('List::Util', 'first');
          const idxArr = this.transformExpression(node.array);
          const idxVal = this.transformExpression(node.value);
          // Use inline loop to find index
          const forLoop = new PerlFor();
          forLoop.isCStyle = true;
          forLoop.init = new PerlVarDeclaration('my', 'i', '$', PerlLiteral.Number(0));
          forLoop.condition = new PerlBinaryExpression(
            new PerlIdentifier('i', '$'),
            '<',
            new PerlCall('scalar', [this.wrapArrayDeref(idxArr)])
          );
          forLoop.increment = new PerlUnaryExpression('++', new PerlIdentifier('i', '$'), false);
          forLoop.body = new PerlBlock([
            new PerlIf(
              new PerlBinaryExpression(
                new PerlSubscript(idxArr, new PerlIdentifier('i', '$'), 'array'),
                'eq',
                idxVal
              ),
              new PerlBlock([
                new PerlExpressionStatement(new PerlAssignment(new PerlIdentifier('idx', '$'), '=', new PerlIdentifier('i', '$'))),
                new PerlLast()
              ])
            )
          ]);
          return new PerlCall('do', [new PerlBlock([
            new PerlVarDeclaration('my', 'idx', '$', PerlLiteral.Number(-1)),
            forLoop,
            new PerlExpressionStatement(new PerlIdentifier('idx', '$'))
          ])]);
        }

        case 'ArrayIncludes': {
          // Check if this is actually a string.includes() call
          // The IL may generate ArrayIncludes for both array and string includes
          const inclVal = this.transformExpression(node.value);

          // If the array is a string method call (toLowerCase, etc.) or string type, use index()
          const arrayNode = node.array;
          const isStringContext = this.isStringType(arrayNode) ||
            (arrayNode && arrayNode.type === 'CallExpression' &&
             arrayNode.callee && arrayNode.callee.property &&
             (arrayNode.callee.property.name || arrayNode.callee.property.value) &&
             ['toLowerCase', 'toUpperCase', 'trim', 'toString', 'substring', 'substr', 'slice'].includes(arrayNode.callee.property.name || arrayNode.callee.property.value));

          if (isStringContext) {
            // string.includes(val) -> index($str, $val) >= 0
            const str = this.transformExpression(arrayNode);
            return new PerlBinaryExpression(
              new PerlCall('index', [str, inclVal]),
              '>=',
              PerlLiteral.Number(0)
            );
          }

          // array.includes(val) -> grep { $_ == $val } @arr
          const inclArr = this.transformExpression(arrayNode);
          return new PerlCall('grep', [
            new PerlBlock([new PerlExpressionStatement(
              new PerlBinaryExpression(new PerlIdentifier('_', '$'), '==', inclVal)
            )]),
            this.wrapArrayDeref(inclArr)
          ]);
        }

        case 'ArraySplice': {
          // array.splice(start, deleteCount?, ...items)
          const splArr = this.transformExpression(node.array);
          const splArgs = [this.wrapArrayDeref(splArr)];
          if (node.start !== undefined) splArgs.push(this.transformExpression(node.start));
          if (node.deleteCount !== undefined) splArgs.push(this.transformExpression(node.deleteCount));
          if (node.items) {
            for (const item of node.items) {
              splArgs.push(this.transformExpression(item));
            }
          }
          return new PerlCall('splice', splArgs);
        }

        case 'ArrayFill': {
          // array.fill(value, start?, end?) -> simplified: fill all with value
          const fillArr = this.transformExpression(node.array);
          const fillVal = this.transformExpression(node.value);
          const fillLen = new PerlCall('scalar', [this.wrapArrayDeref(fillArr)]);
          return new PerlArray([
            new PerlBinaryExpression(new PerlGrouped(fillVal), 'x', fillLen)
          ]);
        }

        case 'ArrayLiteral':
          // Array literal with elements
          return new PerlArray((node.elements || []).map(e => this.transformExpression(e)));

        case 'ArrayCreation':
          // new Array(size) -> [(undef) x size]
          if (node.size) {
            return new PerlArray([
              new PerlBinaryExpression(
                new PerlGrouped(PerlLiteral.Undef()),
                'x',
                this.transformExpression(node.size)
              )
            ]);
          }
          return new PerlArray([]);

        case 'TypedArrayCreation':
          // new Uint8Array(size) or new Uint8Array(buffer)
          // Perl doesn't have typed arrays, so we use regular arrays filled with zeros
          if (node.size) {
            return new PerlArray([
              new PerlBinaryExpression(
                new PerlGrouped(PerlLiteral.Number(0)),
                'x',
                this.transformExpression(node.size)
              )
            ]);
          }
          return new PerlArray([]);

        case 'BufferCreation':
          // new ArrayBuffer(size) -> array of zeros
          if (node.size) {
            return new PerlArray([
              new PerlBinaryExpression(
                new PerlGrouped(PerlLiteral.Number(0)),
                'x',
                this.transformExpression(node.size)
              )
            ]);
          }
          return new PerlArray([]);

        case 'DataViewCreation':
          // new DataView(buffer) -> just use the buffer directly (Perl arrays work as views)
          if (node.buffer) {
            return this.transformExpression(node.buffer);
          }
          return new PerlArray([]);

        case 'MapCreation': {
          // new Map() -> {} (hash reference)
          // new Map([entries]) -> {k1 => v1, k2 => v2, ...}
          if (node.entries && node.entries.elements && node.entries.elements.length > 0) {
            const pairs = node.entries.elements.map(entry => {
              if (entry.elements && entry.elements.length >= 2) {
                const key = this.transformExpression(entry.elements[0]);
                const value = this.transformExpression(entry.elements[1]);
                // PerlHash expects { key, value } objects, not [key, value] arrays
                return { key, value };
              }
              return null;
            }).filter(p => p !== null);
            return new PerlHash(pairs);
          }
          return new PerlHash([]);
        }

        case 'ArrayFind': {
          // array.find(fn) -> List::Util::first { $_ matches condition } @arr
          const findArr = this.transformExpression(node.array);
          const callbackBlock = this.transformListUtilCallback(node.callback);
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("first"), "::"), [
            callbackBlock,
            this.wrapArrayDeref(findArr)
          ]);
        }

        case 'ArrayFindIndex': {
          // Similar to indexOf but with callback - use firstidx from List::MoreUtils
          this.addRequiredModule('List::MoreUtils', 'firstidx');
          const findIdxArr = this.transformExpression(node.array);
          const findIdxBlock = this.transformListUtilCallback(node.callback);
          return new PerlCall('firstidx', [
            findIdxBlock,
            this.wrapArrayDeref(findIdxArr)
          ]);
        }

        case 'ArrayEvery': {
          // array.every(fn) -> List::Util::all { $_ matches condition } @arr
          const everyArr = this.transformExpression(node.array);
          const everyBlock = this.transformListUtilCallback(node.callback);
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("all"), "::"), [
            everyBlock,
            this.wrapArrayDeref(everyArr)
          ]);
        }

        case 'ArraySome': {
          // array.some(fn) -> List::Util::any { $_ matches condition } @arr
          const someArr = this.transformExpression(node.array);
          // Debug: log callback structure
          if (this.options.debug) console.log('ArraySome callback:', JSON.stringify(node.callback, null, 2).substring(0, 500));
          const someBlock = this.transformListUtilCallback(node.callback);
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("any"), "::"), [
            someBlock,
            this.wrapArrayDeref(someArr)
          ]);
        }

        // MathCall - for unhandled Math.* methods
        case 'MathCall': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          switch (node.method) {
            case 'imul':
              // Math.imul(a, b) → (($a * $b) & 0xFFFFFFFF) for 32-bit integer multiply
              if (args.length >= 2)
                return new PerlBinaryExpression(
                  new PerlBinaryExpression(args[0], '*', args[1]),
                  '&',
                  PerlLiteral.Number(0xFFFFFFFF)
                );
              break;
            case 'abs':
              return new PerlCall('abs', args);
            case 'floor':
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("floor"), "::"), args);
            case 'ceil':
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("ceil"), "::"), args);
            case 'round':
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("round"), "::"), args);
            case 'min':
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("min"), "::"), args);
            case 'max':
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("max"), "::"), args);
            case 'pow':
              return new PerlBinaryExpression(args[0], '**', args[1]);
            case 'sqrt':
              return new PerlCall('sqrt', args);
            case 'log':
              return new PerlCall('log', args);
            case 'exp':
              return new PerlCall('exp', args);
            case 'sin':
              return new PerlCall('sin', args);
            case 'cos':
              return new PerlCall('cos', args);
            case 'random':
              return new PerlCall('rand', []);
            case 'trunc':
              return new PerlCall('int', args);
            case 'sign':
              // sign(x) = x > 0 ? 1 : (x < 0 ? -1 : 0)
              // Perl: ($x <=> 0)
              return new PerlBinaryExpression(args[0], '<=>', PerlLiteral.Number(0));
            case 'tan':
              return new PerlBinaryExpression(new PerlCall('sin', args), '/', new PerlCall('cos', args));
            case 'asin':
              return new PerlCall('atan2', [args[0], new PerlCall('sqrt', [new PerlBinaryExpression(PerlLiteral.Number(1), '-', new PerlBinaryExpression(args[0], '*', args[0]))])]);
            case 'acos':
              return new PerlCall('atan2', [new PerlCall('sqrt', [new PerlBinaryExpression(PerlLiteral.Number(1), '-', new PerlBinaryExpression(args[0], '*', args[0]))]), args[0]]);
            case 'atan':
              return new PerlCall('atan2', [args[0], PerlLiteral.Number(1)]);
            case 'atan2':
              return new PerlCall('atan2', args);
            case 'sinh':
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("sinh"), "::"), args);
            case 'cosh':
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("cosh"), "::"), args);
            case 'tanh':
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("tanh"), "::"), args);
            case 'cbrt':
              return new PerlBinaryExpression(args[0], '**', new PerlGrouped(new PerlBinaryExpression(PerlLiteral.Number(1), '/', PerlLiteral.Number(3))));
            case 'hypot':
              return new PerlCall('sqrt', [new PerlBinaryExpression(new PerlBinaryExpression(args[0], '*', args[0]), '+', new PerlBinaryExpression(args[1], '*', args[1]))]);
            case 'fround':
              return args[0];
            case 'log2':
              return new PerlBinaryExpression(new PerlCall('log', args), '/', new PerlCall('log', [PerlLiteral.Number(2)]));
            case 'log10':
              return new PerlBinaryExpression(new PerlCall('log', args), '/', new PerlCall('log', [PerlLiteral.Number(10)]));
            default:
              // Fallback to lowercase function name
              return new PerlCall(node.method.toLowerCase(), args);
          }
        }

        // ========================[ String IL Node Types ]========================

        case 'StringReplace': {
          // string.replace(search, replacement) -> s/search/replacement/r
          // For simple cases, use: ($str =~ s/search/replacement/r)
          const str = this.transformExpression(node.string || node.object);
          const search = this.transformExpression(node.search || node.pattern) || PerlLiteral.String('', "'");
          const replacement = this.transformExpression(node.replacement) || PerlLiteral.String('', "'");
          // Use nested substitution: create raw Perl code
          return new PerlRawCode(`(${str} =~ s/\\Q${search}\\E/${replacement}/r)`);
        }

        case 'StringRepeat': {
          // string.repeat(count) -> $str x $count
          const str = this.transformExpression(node.string || node.object);
          const count = this.transformExpression(node.count);
          return new PerlBinaryExpression(str, 'x', count);
        }

        case 'StringIndexOf': {
          // string.indexOf(search, start?) -> index($str, $search, $start?)
          const str = this.transformExpression(node.string || node.object);
          const search = this.transformExpression(node.searchValue || node.search);
          const args = [str, search];
          if (node.start || node.fromIndex) args.push(this.transformExpression(node.start || node.fromIndex));
          return new PerlCall('index', args);
        }

        case 'StringSplit': {
          // string.split(separator) -> split(/$sep/, $str)
          const str = this.transformExpression(node.string || node.object);
          const sep = node.separator ? this.transformExpression(node.separator) : PerlLiteral.String('', "'");
          return new PerlArray([new PerlCall('split', [sep, str])]);
        }

        case 'StringSubstring': {
          // string.substring(start, end?) -> substr($str, $start, $length?)
          const str = this.transformExpression(node.string || node.object);
          const start = node.start ? this.transformExpression(node.start) : PerlLiteral.Number(0);
          const args = [str, start];
          if (node.end) {
            const end = this.transformExpression(node.end);
            // length = end - start
            args.push(new PerlBinaryExpression(end, '-', start));
          }
          return new PerlCall('substr', args);
        }

        case 'StringCharAt': {
          // string.charAt(index) -> substr($str, $index, 1)
          const str = this.transformExpression(node.string || node.object);
          const index = this.transformExpression(node.index);
          return new PerlCall('substr', [str, index, PerlLiteral.Number(1)]);
        }

        case 'StringCharCodeAt': {
          // string.charCodeAt(index) -> ord(substr($str, $index, 1))
          const str = this.transformExpression(node.string || node.object);
          const index = this.transformExpression(node.index);
          return new PerlCall('ord', [
            new PerlCall('substr', [str, index, PerlLiteral.Number(1)])
          ]);
        }

        case 'StringToUpperCase': {
          // string.toUpperCase() -> uc($str)
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new PerlCall('uc', [str]);
        }

        case 'StringTransform': {
          // Generic string transformation node with method property
          const str = this.transformExpression(node.string || node.object || node.argument);
          const method = node.method;

          switch (method) {
            case 'toLowerCase':
              return new PerlCall('lc', [str]);
            case 'toUpperCase':
              return new PerlCall('uc', [str]);
            case 'trim':
              // str is already a PerlAST node, wrap in do block for regex
              return new PerlRawCode(`do { my $_tmp_str = ${str}; $_tmp_str =~ s/^\\s+|\\s+$//g; $_tmp_str; }`);
            case 'trimStart':
            case 'trimLeft':
              return new PerlRawCode(`do { my $_tmp_str = ${str}; $_tmp_str =~ s/^\\s+//; $_tmp_str; }`);
            case 'trimEnd':
            case 'trimRight':
              return new PerlRawCode(`do { my $_tmp_str = ${str}; $_tmp_str =~ s/\\s+$//; $_tmp_str; }`);
            default:
              // Fallback: just return the string
              return str;
          }
        }

        case 'StringToLowerCase': {
          // string.toLowerCase() -> lc($str)
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new PerlCall('lc', [str]);
        }

        case 'StringTrim': {
          // string.trim() -> $str =~ s/^\s+|\s+$//gr
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new PerlRawCode(`(${str} =~ s/^\\s+|\\s+$//gr)`);
        }

        case 'StringStartsWith': {
          // string.startsWith(prefix) -> substr($str, 0, length($prefix)) eq $prefix
          const str = this.transformExpression(node.string || node.object);
          const prefix = this.transformExpression(node.prefix || node.search);
          return new PerlBinaryExpression(
            new PerlCall('substr', [str, PerlLiteral.Number(0), new PerlCall('length', [prefix])]),
            'eq',
            prefix
          );
        }

        case 'StringEndsWith': {
          // string.endsWith(suffix) -> substr($str, -length($suffix)) eq $suffix
          const str = this.transformExpression(node.string || node.object);
          const suffix = this.transformExpression(node.suffix || node.search);
          return new PerlBinaryExpression(
            new PerlCall('substr', [str, new PerlUnaryExpression('-', new PerlCall('length', [suffix]))]),
            'eq',
            suffix
          );
        }

        case 'StringIncludes': {
          // string.includes(search) -> index($str, $search) >= 0
          // Note: The IL uses 'method' to distinguish includes/startsWith/endsWith
          const str = this.transformExpression(node.string || node.object);
          const search = this.transformExpression(node.searchValue || node.search);

          // Handle the method property if present (includes, startsWith, endsWith)
          if (node.method === 'startsWith') {
            return new PerlBinaryExpression(
              new PerlCall('substr', [str, PerlLiteral.Number(0), new PerlCall('length', [search])]),
              'eq',
              search
            );
          }
          if (node.method === 'endsWith') {
            return new PerlBinaryExpression(
              new PerlCall('substr', [str, new PerlUnaryExpression('-', new PerlCall('length', [search]))]),
              'eq',
              search
            );
          }

          // Default: includes - use index >= 0
          return new PerlBinaryExpression(
            new PerlCall('index', [str, search]),
            '>=',
            PerlLiteral.Number(0)
          );
        }

        // ========================[ Additional IL Node Types ]========================

        case 'BigIntCast': {
          // BigInt(value) -> Perl handles arbitrary precision integers natively
          // Just return the value
          const val = this.transformExpression(node.value || node.argument || (node.arguments && node.arguments[0]));
          return val;
        }

        case 'TypedArraySet': {
          // typedArray.set(source, offset?) -> splice(@arr, $offset, scalar(@source), @source)
          const target = this.transformExpression(node.target || node.array);
          const source = this.transformExpression(node.source || node.values);
          const offset = node.offset ? this.transformExpression(node.offset) : PerlLiteral.Number(0);
          return new PerlCall('splice', [
            this.wrapArrayDeref(target),
            offset,
            new PerlCall('scalar', [this.wrapArrayDeref(source)]),
            this.wrapArrayDeref(source)
          ]);
        }

        case 'TypedArraySubarray': {
          // array.subarray(begin, end) -> @arr[begin..end-1]
          const array = this.transformExpression(node.array);
          const begin = node.begin ? this.transformExpression(node.begin) : PerlLiteral.Number(0);
          if (node.end) {
            const end = this.transformExpression(node.end);
            // @arr[begin..end-1]
            const endMinusOne = new PerlBinaryExpression(end, '-', PerlLiteral.Number(1));
            return new PerlRawCode(`[@{${array}}[${begin}..${endMinusOne}]]`);
          } else {
            // @arr[begin..$#arr]
            return new PerlRawCode(`[@{${array}}[${begin}..$#${array}]]`);
          }
        }

        case 'ArrayReduce': {
          // array.reduce(fn, initial) -> List::Util::reduce { fn } @arr (use fully qualified name for cross-package use)
          const reduceArr = this.transformExpression(node.array);
          const callback = this.transformExpression(node.callback);
          const args = [callback, this.wrapArrayDeref(reduceArr)];
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("reduce"), "::"), args);
        }

        // IL AST StringInterpolation - `Hello ${name}` -> "Hello $name"
        case 'StringInterpolation': {
          // Build parts array for PerlStringInterpolation (handles emission properly)
          const parts = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                if (part.value) parts.push(part.value);
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                const expr = this.transformExpression(part.expression);
                if (expr) parts.push(expr);
              }
            }
          } else if (node.quasis && node.expressions) {
            for (let i = 0; i < node.quasis.length; ++i) {
              if (node.quasis[i]) parts.push(node.quasis[i]);
              if (i < node.expressions.length) {
                const expr = this.transformExpression(node.expressions[i]);
                if (expr) parts.push(expr);
              }
            }
          }
          return new PerlStringInterpolation(parts);
        }

        // IL AST ObjectLiteral - {key: value} -> {key => value}
        case 'ObjectLiteral': {
          if (!node.properties || node.properties.length === 0)
            return new PerlHash([]);

          const pairs = [];
          for (const prop of node.properties) {
            if (prop.type === 'SpreadElement') continue;
            const key = prop.key?.name || prop.key?.value || prop.key || 'key';
            const value = this.transformExpression(prop.value);
            pairs.push({
              key: PerlLiteral.String(key),
              value: value || PerlLiteral.Undef()
            });
          }
          return new PerlHash(pairs);
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> chr(65)
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return PerlLiteral.String('', "'");
          if (args.length === 1)
            return new PerlCall('chr', args);
          // Multiple chars: join('', map { chr($_) } (c1, c2, ...))
          return new PerlCall('join', [
            PerlLiteral.String('', "'"),
            new PerlCall('map', [
              new PerlRawCode('{ chr($_) }'),
              new PerlList(args)
            ])
          ]);
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> ref($x) eq 'ARRAY'
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new PerlBinaryExpression(
            new PerlCall('ref', [value]),
            'eq',
            PerlLiteral.String('ARRAY', "'")
          );
        }

        // IL AST ArrowFunction - (x) => expr -> sub { my ($x) = @_; expr }
        case 'ArrowFunction': {
          // Map parameters to Perl parameter nodes
          const params = (node.params || []).map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'arg');
            return new PerlParameter(name, '$');
          });

          // Transform body to a PerlBlock
          let body = null;
          if (node.body) {
            if (node.body.type === 'BlockStatement') {
              // Block body: transform all statements
              body = this.transformBlockStatement(node.body);
            } else {
              // Expression body: wrap in a return statement
              const expr = this.transformExpression(node.body);
              body = new PerlBlock([new PerlReturn(expr)]);
            }
          } else {
            body = new PerlBlock([]);
          }

          return new PerlAnonSub(params, body);
        }

        // IL AST TypeOfExpression - typeof x -> ref($x) || 'SCALAR'
        case 'TypeOfExpression': {
          const value = this.transformExpression(node.value);
          return new PerlBinaryExpression(
            new PerlCall('ref', [value]),
            '||',
            PerlLiteral.String('SCALAR', "'")
          );
        }

        // IL AST Power - x ** y -> x ** y
        case 'Power': {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new PerlBinaryExpression(left, '**', right);
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (no-op in Perl)
        case 'ObjectFreeze': {
          return this.transformExpression(node.value);
        }

        // IL AST ArrayFrom - Array.from(x) -> [ @{$x} ]
        case 'ArrayFrom': {
          const iterable = this.transformExpression(node.iterable);
          if (node.mapFunction) {
            const mf = node.mapFunction;
            // Inline arrow/function expression bodies to avoid IIFE }( syntax errors
            if (mf.type === 'ArrowFunctionExpression' || mf.type === 'FunctionExpression' || mf.type === 'ArrowFunction') {
              const paramName = mf.params?.[0]?.name;
              const indexName = mf.params?.[1]?.name;
              const useImplicit = !paramName || paramName === '_';

              // If index parameter is used, use for-loop approach (same as transformArrayMap)
              if (indexName) {
                if (paramName && paramName !== '_') this.registerVariableType(paramName, '$');
                this.registerVariableType(indexName, '$');
                const resultVar = '_afrom_result_' + (this._aFromCounter || 0);
                this._aFromCounter = (this._aFromCounter || 0) + 1;

                let bodyExpr;
                if (mf.body && mf.body.type === 'BlockStatement') {
                  const bodyStmts = mf.body.body.map(s => this.transformStatement(s));
                  bodyExpr = bodyStmts.length > 0 ? bodyStmts[bodyStmts.length - 1] : new PerlIdentifier('_', '$');
                } else if (mf.body) {
                  bodyExpr = new PerlExpressionStatement(this.transformExpression(mf.body));
                } else {
                  bodyExpr = new PerlExpressionStatement(new PerlIdentifier('_', '$'));
                }

                const loopBodyStatements = [];
                loopBodyStatements.push(
                  new PerlCall('push', [
                    new PerlIdentifier(resultVar, '@'),
                    bodyExpr.expression || bodyExpr
                  ])
                );
                const loopBody = new PerlBlock(loopBodyStatements);
                const forInit = new PerlVarDeclaration('my', indexName, '$', PerlLiteral.Number(0));
                const forCond = new PerlBinaryExpression(
                  new PerlIdentifier(indexName, '$'),
                  '<',
                  new PerlCall('scalar', [this.wrapArrayDeref(iterable)])
                );
                const forIncr = new PerlUnaryExpression('++', new PerlIdentifier(indexName, '$'), false);
                const forLoop = new PerlFor();
                forLoop.isCStyle = true;
                forLoop.init = forInit;
                forLoop.condition = forCond;
                forLoop.increment = forIncr;
                forLoop.body = loopBody;

                return new PerlCall('do', [new PerlBlock([
                  new PerlVarDeclaration('my', resultVar, '@', null),
                  forLoop,
                  new PerlUnaryExpression('\\', new PerlIdentifier(resultVar, '@'), true)
                ])]);
              }

              let mapBody;
              if (mf.body && mf.body.type === 'BlockStatement') {
                if (!useImplicit) this._listUtilParamReplacement = paramName;
                mapBody = new PerlBlock(
                  mf.body.body.map(s => this.transformStatement(s))
                );
                if (!useImplicit) this._listUtilParamReplacement = null;
              } else if (mf.body) {
                if (!useImplicit) this._listUtilParamReplacement = paramName;
                mapBody = new PerlBlock([
                  new PerlExpressionStatement(this.transformExpression(mf.body))
                ]);
                if (!useImplicit) this._listUtilParamReplacement = null;
              } else {
                mapBody = new PerlBlock([
                  new PerlExpressionStatement(new PerlIdentifier('_', '$'))
                ]);
              }
              return new PerlArray([
                new PerlCall('map', [mapBody, this.wrapArrayDeref(iterable)])
              ]);
            }
            // Named function ref: map { $fn->($_) } @arr
            const mapFn = this.transformExpression(mf);
            const mapBlock = new PerlBlock([
              new PerlExpressionStatement(
                new PerlMemberAccess(mapFn, new PerlCall(null, [new PerlIdentifier('_', '$')]), '->')
              )
            ]);
            return new PerlArray([
              new PerlCall('map', [mapBlock, this.wrapArrayDeref(iterable)])
            ]);
          }
          // [ @{$iterable} ] - create array copy
          return new PerlArray([this.wrapArrayDeref(iterable)]);
        }

        // IL AST ObjectKeys - Object.keys(obj) -> keys %{$obj}
        case 'ObjectKeys': {
          const obj = this.transformExpression(node.object);
          return new PerlArray([new PerlCall('keys', [this.wrapHashDeref(obj)])]);
        }

        // IL AST ObjectValues - Object.values(obj) -> values %{$obj}
        case 'ObjectValues': {
          const obj = this.transformExpression(node.object);
          return new PerlArray([new PerlCall('values', [this.wrapHashDeref(obj)])]);
        }

        // IL AST ObjectEntries - Object.entries(obj) -> map { [$_, $obj->{$_}] } keys %$obj
        case 'ObjectEntries': {
          const obj = this.transformExpression(node.object);
          // Create array of [key, value] pairs
          return new PerlRawCode(`[map { [\$_, ${this.wrapHashDeref(obj)}->{\$_}] } keys \%{${obj}}]`);
        }

        // IL AST ObjectCreate - Object.create(proto) -> { %{$proto} }
        case 'ObjectCreate': {
          const proto = this.transformExpression(node.prototype);
          if (node.properties) {
            // Object.create(proto, properties) - merge hashes
            const props = this.transformExpression(node.properties);
            return new PerlRawCode(`{%{${proto}}, %{${props}}}`);
          }
          return new PerlRawCode(`{%{${proto}}}`);
        }

        // IL AST IsIntegerCheck - Number.isInteger(x) -> ($x == int($x))
        case 'IsIntegerCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          const intCall = new PerlCall('int', [value]);
          return new PerlGrouped(new PerlBinaryExpression(value, '==', intCall));
        }

        // IL AST DebugOutput - console.log/warn/error -> print/warn
        case 'DebugOutput': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          const method = node.method || 'log';
          if (method === 'warn' || method === 'error') {
            return new PerlCall('warn', args);
          }
          return new PerlCall('print', [...args, PerlLiteral.String("\\n", '"')]);
        }

        // IL AST DataViewWrite - view.setUint32(offset, value, le) -> pack/substr
        case 'DataViewWrite': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const value = this.transformExpression(node.value);
          const method = node.method;
          const littleEndian = node.littleEndian !== false;

          // Perl pack template
          let fmt = method.includes('32') ? (littleEndian ? 'V' : 'N') :
                    method.includes('16') ? (littleEndian ? 'v' : 'n') : 'C';

          return new PerlRawCode(`substr(${view}, ${offset}, length(pack('${fmt}', ${value}))) = pack('${fmt}', ${value})`);
        }

        // IL AST DataViewRead - view.getUint32(offset, le) -> unpack/substr
        case 'DataViewRead': {
          const view = this.transformExpression(node.view);
          const method = node.method;

          // toString() is misclassified as DataViewRead by the IL - handle as string conversion
          if (method === 'toString') {
            // For number.toString(radix): sprintf with format
            if (node.offset && node.offset.type === 'Literal' && typeof node.offset.value === 'number') {
              const radix = node.offset.value;
              if (radix === 16) return new PerlCall('sprintf', [PerlLiteral.String('%x', "'"), view]);
              if (radix === 8) return new PerlCall('sprintf', [PerlLiteral.String('%o', "'"), view]);
              if (radix === 2) return new PerlCall('sprintf', [PerlLiteral.String('%b', "'"), view]);
              if (radix === 36) return new PerlRawCode(`do { my @_d = (0..9, 'a'..'z'); my $_n = ${view}; my $_s = ''; while ($_n > 0) { $_s = $_d[$_n % 36] . $_s; $_n = int($_n / 36); } $_s || '0'; }`);
            }
            // Plain toString() -> just stringify: "$value" or "" . $value
            return new PerlRawCode(`"${view}"`);
          }

          const offset = this.transformExpression(node.offset);
          const littleEndian = node.littleEndian !== false;

          if (method === 'getUint8')
            return new PerlRawCode(`ord(substr(${view}, ${offset}, 1))`);

          // Perl unpack template
          let fmt = method.includes('32') ? (littleEndian ? 'V' : 'N') :
                    method.includes('16') ? (littleEndian ? 'v' : 'n') : 'C';
          const size = method.includes('32') ? 4 : method.includes('16') ? 2 : 1;

          return new PerlRawCode(`unpack('${fmt}', substr(${view}, ${offset}, ${size}))`);
        }

        // IL AST StringCharCodeAt - str.charCodeAt(i) -> ord(substr(str, i, 1))
        case 'StringCharCodeAt': {
          const str = this.transformExpression(node.string);
          const index = this.transformExpression(node.index);
          return new PerlCall(new PerlIdentifier('ord', ''), [
            new PerlCall(new PerlIdentifier('substr', ''), [str, index, PerlLiteral.Int(1)])
          ]);
        }

        // IL AST StringReplace - str.replace(search, replace) -> $str =~ s/search/replace/g
        case 'StringReplace': {
          const str = this.transformExpression(node.string);
          const search = this.transformExpression(node.searchValue) || PerlLiteral.String('', "'");
          const replace = this.transformExpression(node.replaceValue) || PerlLiteral.String('', "'");
          // Use a temp variable and substitution
          return new PerlRawCode(`do { my $tmp = ${str}; $tmp =~ s/${search}/${replace}/g; $tmp }`);
        }

        // IL AST BufferCreation - new ArrayBuffer(n) -> "\0" x n
        case 'BufferCreation': {
          const size = this.transformExpression(node.size);
          return new PerlRawCode(`("\\0" x ${size})`);
        }

        // IL AST MathCall - Math.imul(a,b) or other Math methods
        case 'MathCall': {
          const method = node.method;
          const args = (node.arguments || []).map(a => this.transformExpression(a));

          if (method === 'imul') {
            // Math.imul(a, b) -> unpack('l', pack('l', $a * $b))
            if (args.length >= 2)
              return new PerlRawCode(`unpack('l', pack('l', ${args[0]} * ${args[1]}))`);
          }
          // Default: call POSIX function or similar
          if (method === 'floor') return new PerlCall(new PerlIdentifier('int', ''), args);
          if (method === 'abs') return new PerlCall(new PerlIdentifier('abs', ''), args);
          if (method === 'sqrt') return new PerlCall(new PerlIdentifier('sqrt', ''), args);
          if (method === 'pow') return new PerlBinaryExpression(args[0], '**', args[1]);
          if (method === 'log') return new PerlCall(new PerlIdentifier('log', ''), args);
          if (method === 'exp') return new PerlCall(new PerlIdentifier('exp', ''), args);
          if (method === 'sin') return new PerlCall(new PerlIdentifier('sin', ''), args);
          if (method === 'cos') return new PerlCall(new PerlIdentifier('cos', ''), args);
          if (method === 'tan') return new PerlBinaryExpression(new PerlCall('sin', args), '/', new PerlCall('cos', args));
          if (method === 'asin') return new PerlCall('atan2', [args[0], new PerlCall('sqrt', [new PerlBinaryExpression(PerlLiteral.Number(1), '-', new PerlBinaryExpression(args[0], '*', args[0]))])]);
          if (method === 'acos') return new PerlCall('atan2', [new PerlCall('sqrt', [new PerlBinaryExpression(PerlLiteral.Number(1), '-', new PerlBinaryExpression(args[0], '*', args[0]))]), args[0]]);
          if (method === 'atan') return new PerlCall('atan2', [args[0], PerlLiteral.Number(1)]);
          if (method === 'atan2') return new PerlCall('atan2', args);
          if (method === 'sinh') return new PerlRawCode(`POSIX::sinh(${args[0]})`);
          if (method === 'cosh') return new PerlRawCode(`POSIX::cosh(${args[0]})`);
          if (method === 'tanh') return new PerlRawCode(`POSIX::tanh(${args[0]})`);
          if (method === 'cbrt') return new PerlBinaryExpression(args[0], '**', new PerlGrouped(new PerlBinaryExpression(PerlLiteral.Number(1), '/', PerlLiteral.Number(3))));
          if (method === 'hypot') return new PerlCall('sqrt', [new PerlBinaryExpression(new PerlBinaryExpression(args[0], '*', args[0]), '+', new PerlBinaryExpression(args[1], '*', args[1]))]);
          if (method === 'sign') return new PerlBinaryExpression(args[0], '<=>', PerlLiteral.Number(0));
          if (method === 'fround') return args[0];
          if (method === 'trunc') return new PerlCall(new PerlIdentifier('int', ''), args);
          if (method === 'random') return new PerlCall('rand', []);
          if (method === 'min') return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("min"), "::"), args);
          if (method === 'max') return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("max"), "::"), args);
          if (method === 'ceil') return new PerlRawCode(`POSIX::ceil(${args[0]})`);
          if (method === 'round') return new PerlRawCode(`POSIX::round(${args[0]})`);
          if (method === 'log2') return new PerlBinaryExpression(new PerlCall('log', args), '/', new PerlCall('log', [PerlLiteral.Number(2)]));
          if (method === 'log10') return new PerlBinaryExpression(new PerlCall('log', args), '/', new PerlCall('log', [PerlLiteral.Number(10)]));
          return new PerlRawCode(`POSIX::${method}(${args.join(', ')})`);
        }

        // IL AST TypedArraySubarray - arr.subarray(start, end) -> [ @arr[start..end-1] ]
        case 'TypedArraySubarray': {
          const array = this.transformExpression(node.array);
          const start = this.transformExpression(node.start);
          const end = node.end ? this.transformExpression(node.end) : null;

          if (end)
            return new PerlRawCode(`[ @{${array}}[${start}..${end}-1] ]`);
          return new PerlRawCode(`[ @{${array}}[${start}..$#{${array}}] ]`);
        }

        // IL AST JsonSerialize - JSON.stringify(x) -> encode_json(x)
        case 'JsonSerialize': {
          const arg = this.transformExpression(node.argument || node.value);
          this.addRequiredModule('JSON', 'encode_json');
          return new PerlCall('encode_json', [arg]);
        }

        // IL AST JsonDeserialize - JSON.parse(x) -> decode_json(x)
        case 'JsonDeserialize': {
          const arg = this.transformExpression(node.argument || node.value);
          this.addRequiredModule('JSON', 'decode_json');
          return new PerlCall('decode_json', [arg]);
        }

        default:
          return null;
      }
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to Perl equivalents
      if (name === 'undefined') return PerlLiteral.Undef();
      if (name === 'null') return PerlLiteral.Undef();
      if (name === 'Infinity') return new PerlRawCode('9e999');
      if (name === 'NaN') return new PerlCall(new PerlIdentifier('0', ''), [new PerlRawCode("'nan'")]);
      // JS global objects - not meaningful in Perl, return undef
      if (name === 'global' || name === 'globalThis' || name === 'window' || name === 'self') return PerlLiteral.Undef();

      // Check if this identifier should be replaced with $_ (for List::Util callbacks)
      if (this._listUtilParamReplacement && name === this._listUtilParamReplacement) {
        return new PerlIdentifier('_', '$');
      }

      // If this variable has been explicitly registered (e.g., via my/our declaration),
      // always use the registered sigil - even if it looks like a class name
      if (this.variableTypes.has(name)) {
        const sigil = this.variableTypes.get(name);
        return new PerlIdentifier(name, sigil);
      }

      // Class names (PascalCase, TypedArrays, etc.) should have no sigil
      // They are used as barewords for method calls like Uint8Array->from()
      const isClassName = /^[A-Z]/.test(name) &&
        (this.definedClassNames.has(name) ||
         name.endsWith('Array') || name.endsWith('Algorithm') || name.endsWith('Instance') ||
         name.endsWith('Point') || name.endsWith('Cipher') || name.endsWith('Module') ||
         name.endsWith('Utils') || name.endsWith('Transform') || name.endsWith('Encoder') ||
         name.endsWith('Decoder') || name.endsWith('Generator') || name.endsWith('Factory') ||
         name.endsWith('Core') || name.endsWith('Constants') || name.endsWith('Helper') ||
         name.endsWith('Hasher') || name.endsWith('Tree') || name.endsWith('Front') ||
         name === 'Object' || name === 'Array' || name === 'String' || name === 'Number' ||
         name === 'Math' || name === 'JSON' || name === 'Date' || name === 'RegExp' ||
         name === 'Error' || name === 'Promise' || name === 'Map' || name === 'Set' ||
         name === 'WeakMap' || name === 'WeakSet' || name === 'Symbol' || name === 'BigInt' ||
         // TypedArrays
         name === 'Int8Array' || name === 'Uint8Array' || name === 'Uint8ClampedArray' ||
         name === 'Int16Array' || name === 'Uint16Array' ||
         name === 'Int32Array' || name === 'Uint32Array' ||
         name === 'Float32Array' || name === 'Float64Array' ||
         name === 'BigInt64Array' || name === 'BigUint64Array' ||
         name === 'ArrayBuffer' || name === 'DataView' ||
         // Common crypto/algorithm class names
         name === 'OpCodes' || name === 'AlgorithmFramework' || name === 'NumberTheory');

      if (isClassName) {
        // Return as quoted string - Perl resolves 'ClassName'->method() correctly
        // and this avoids bareword errors under 'use strict' in boolean/value context
        return PerlLiteral.String(name, "'");
      }

      // If this identifier refers to a declared sub and is used as a value (not as a callee),
      // emit a code reference: \&functionName
      if (this.functionNames.has(name) && !this.variableTypes.has(name)) {
        return new PerlUnaryExpression('\\&', new PerlIdentifier(name, ''), true);
      }

      // Get sigil from registered type or infer
      const sigil = this.variableTypes.get(name) || this.inferSigilFromName(name);

      return new PerlIdentifier(name, sigil);
    }

    /**
     * Transform a literal
     */
    transformLiteral(node) {
      if (typeof node.value === 'number') {
        return PerlLiteral.Number(node.value);
      }

      if (typeof node.value === 'string') {
        return PerlLiteral.String(node.value, "'");
      }

      if (typeof node.value === 'boolean') {
        return PerlLiteral.Number(node.value ? 1 : 0);
      }

      if (node.value === null) {
        return PerlLiteral.Undef();
      }

      return PerlLiteral.Number(0);
    }

    /**
     * Transform a binary expression
     */
    transformBinaryExpression(node) {
      // Handle 'in' operator: key in obj -> exists $obj->{key}
      if (node.operator === 'in') {
        const key = this.transformExpression(node.left);
        const obj = this.transformExpression(node.right);
        // exists $obj->{$key}
        return new PerlCall('exists', [
          new PerlSubscript(obj, key, 'hash', true)
        ]);
      }

      // Handle instanceof operator: x instanceof Y -> ref($x) eq 'Y'
      // In Perl, we use ref() to check if a reference is blessed into a class
      if (node.operator === 'instanceof') {
        const left = this.transformExpression(node.left);
        // Get the class name from the right operand
        let className = '';
        if (node.right.type === 'Identifier') {
          className = node.right.name;
          // Handle typed arrays - in Perl these are just ARRAY refs
          if (className === 'Uint8Array' || className === 'Int8Array' ||
              className === 'Uint16Array' || className === 'Int16Array' ||
              className === 'Uint32Array' || className === 'Int32Array' ||
              className === 'Float32Array' || className === 'Float64Array' ||
              className === 'ArrayBuffer' || className === 'Array') {
            // Check if it's an array reference
            return new PerlBinaryExpression(
              new PerlCall('ref', [left]),
              'eq',
              PerlLiteral.String('ARRAY', "'")
            );
          }
        } else if (node.right.type === 'MemberExpression') {
          // Handle things like global.Uint8Array
          className = node.right.property.name || node.right.property.value || 'UNKNOWN';
          if (className === 'Uint8Array' || className === 'Array') {
            return new PerlBinaryExpression(
              new PerlCall('ref', [left]),
              'eq',
              PerlLiteral.String('ARRAY', "'")
            );
          }
        }
        // Default: ref($x) eq 'ClassName'
        return new PerlBinaryExpression(
          new PerlCall('ref', [left]),
          'eq',
          PerlLiteral.String(className, "'")
        );
      }

      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // Wrap assignment expressions in parentheses when used as operands
      // JavaScript: (x = a - b) <= max  must become Perl: ($x = $a - $b) <= $max
      // Without parens, Perl would parse: $x = ($a - $b <= $max) which is wrong
      if (node.left.type === 'AssignmentExpression') {
        left = new PerlGrouped(left);
      }
      if (node.right.type === 'AssignmentExpression') {
        right = new PerlGrouped(right);
      }

      // Map operators
      let operator = node.operator;

      // Equality operators: choose string or numeric based on context
      // In crypto code, most comparisons are numeric (lengths, counters, etc.)
      if (operator === '===' || operator === '==') {
        operator = this.isStringContext(node.left, node.right) ? 'eq' : '==';
      }
      if (operator === '!==' || operator === '!=') {
        operator = this.isStringContext(node.left, node.right) ? 'ne' : '!=';
      }

      // String concatenation
      if (operator === '+' && this.isStringContext(node.left, node.right)) {
        operator = '.';
      }

      // Logical operators
      if (operator === '&&') operator = '&&';
      if (operator === '||') operator = '||';

      // Unsigned right shift in Perl: use signed shift with mask
      // JavaScript >>> treats operand as unsigned 32-bit, Perl >> is signed
      // Convert: (x >>> n) to ((x >> n) & ((1 << (32-n)) - 1)) or simpler: ((x >> n) & 0xFFFFFFFF) >> 0
      // Actually simpler: For crypto we typically want ((x & 0xFFFFFFFF) >> n) & 0xFFFFFFFF
      // Or just mask after: (x >> n) & 0xFFFFFFFF if we're sure about bit width
      if (operator === '>>>') {
        // Convert to: ($left >> $right) & 0xFFFFFFFF  (for 32-bit unsigned)
        // Note: PerlBinaryExpression constructor is (left, operator, right)
        // Note: PerlLiteral.Hex expects a numeric value, not a string
        const shiftExpr = new PerlBinaryExpression(left, '>>', right);
        return new PerlBinaryExpression(shiftExpr, '&', PerlLiteral.Hex(0xFFFFFFFF));
      }

      return new PerlBinaryExpression(left, operator, right);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      let operator = node.operator;

      // Handle typeof specially before transforming operand
      if (operator === 'typeof') {
        // For known package names (OpCodes, Math, etc.), typeof returns 'object' (always defined)
        if (node.argument.type === 'Identifier') {
          const name = node.argument.name;
          const knownPackages = new Set([
            'OpCodes', 'Math', 'JSON', 'console', 'Object', 'Array', 'String', 'Number',
            'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array',
            'Float32Array', 'Float64Array', 'ArrayBuffer', 'DataView',
            'AlgorithmFramework', 'RegisterAlgorithm', 'CategoryType', 'SecurityStatus',
            'ComplexityType', 'CountryCode', 'LinkItem', 'KeySize', 'TestCase', 'Vulnerability'
          ]);
          if (knownPackages.has(name)) {
            // typeof KnownPackage returns 'object' (always defined)
            return PerlLiteral.String('object', "'");
          }

          // JavaScript globals that don't exist in Perl - return 'undefined'
          const jsGlobals = new Set([
            'TextEncoder', 'TextDecoder', 'Buffer', 'Crypto', 'crypto',
            'window', 'document', 'navigator', 'performance',
            'global', 'globalThis', 'self', 'process'
          ]);
          if (jsGlobals.has(name)) {
            // These don't exist in Perl, so typeof returns 'undefined'
            return PerlLiteral.String('undefined', "'");
          }
        }

        // For regular variables, use ref()
        const operand = this.transformExpression(node.argument);
        return new PerlCall(new PerlIdentifier('ref'), [operand]);
      }

      const operand = this.transformExpression(node.argument);

      if (operator === '!') operator = '!';

      return new PerlUnaryExpression(operator, operand);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      // Handle array.length = N assignment specially (IL transformed version)
      // The IL transformer converts arr.length to ArrayLength node
      // JavaScript: arr.length = 0 clears the array
      // JavaScript: arr.length = N truncates or extends with undefined
      // Perl: @arr = () to clear, or splice(@arr, N) to truncate
      if (node.left.type === 'ArrayLength' || node.left.ilNodeType === 'ArrayLength') {
        const arrExpr = this.transformExpression(node.left.array);
        const lengthVal = this.transformExpression(node.right);

        // If assigning 0 (Literal or NumberLiteral), clear the array: @{$arr} = ()
        if ((node.right.type === 'Literal' || node.right.type === 'NumberLiteral') &&
            node.right.value === 0) {
          return new PerlAssignment(
            this.wrapArrayDeref(arrExpr),
            '=',
            new PerlList([])  // Empty list ()
          );
        }

        // Otherwise use splice to truncate: splice(@{$arr}, $length)
        return new PerlCall('splice', [
          this.wrapArrayDeref(arrExpr),
          lengthVal
        ]);
      }

      // Handle array.length = N assignment specially (original MemberExpression version)
      // Fallback for non-IL transformed code
      if (node.left.type === 'MemberExpression' &&
          !node.left.computed &&
          (node.left.property.name === 'length' || node.left.property.value === 'length')) {
        const arrExpr = this.transformExpression(node.left.object);
        const lengthVal = this.transformExpression(node.right);

        // If assigning 0, clear the array: @{$arr} = ()
        if (node.right.type === 'Literal' && node.right.value === 0) {
          return new PerlAssignment(
            this.wrapArrayDeref(arrExpr),
            '=',
            new PerlList([])  // Empty list ()
          );
        }

        // Otherwise use splice to truncate: splice(@{$arr}, $length)
        return new PerlCall('splice', [
          this.wrapArrayDeref(arrExpr),
          lengthVal
        ]);
      }

      // Handle object destructuring assignment: { a: target1, b: target2 } = func()
      // JavaScript: ({ a: v[0], b: v[4] } = result)
      // Perl: do { my $_tmp = result; v->[0] = $_tmp->{'a'}; v->[4] = $_tmp->{'b'}; }
      // Note: In assignment context, parser may give ObjectExpression, ObjectPattern, or ObjectLiteral (from IL AST)
      if (node.left.type === 'ObjectPattern' || node.left.type === 'ObjectExpression' ||
          node.left.type === 'ObjectLiteral' || node.left.ilNodeType === 'ObjectLiteral') {
        const properties = node.left.properties || [];
        const rightExpr = this.transformExpression(node.right);

        // Create a do block that: 1) saves result, 2) assigns each property
        const statements = [];
        const tmpVar = new PerlIdentifier('_destr_tmp', '$');

        // my $_destr_tmp = <right>;
        statements.push(new PerlVarDeclaration('my', '_destr_tmp', '$', rightExpr));

        // For each property: target = $_destr_tmp->{'key'};
        for (const prop of properties) {
          // In destructuring { a: v[0] }, key='a', value=v[0] (the target)
          const key = prop.key.name || prop.key.value;
          const target = this.transformExpression(prop.value);
          const access = new PerlSubscript(tmpVar, PerlLiteral.String(key, "'"), 'hash');
          statements.push(new PerlExpressionStatement(
            new PerlAssignment(target, '=', access)
          ));
        }

        // Return do block
        return new PerlCall('do', [new PerlBlock(statements)]);
      }

      // Handle array destructuring assignment: [a, b] = func()
      // JavaScript: [x0, x1] = someFunction();
      // Perl: ($x0, $x1) = @{someFunction()};
      // Note: In assignment context, parser may give ArrayExpression instead of ArrayPattern
      if (node.left.type === 'ArrayPattern' || node.left.type === 'ArrayExpression') {
        const elements = node.left.elements
          .filter(e => e !== null)
          .map(e => this.transformExpression(e));
        const leftList = new PerlList(elements);
        const rightExpr = this.transformExpression(node.right);
        // Dereference the right side as an array
        const rightDeref = new PerlUnaryExpression('@', rightExpr, true);
        return new PerlAssignment(leftList, '=', rightDeref);
      }

      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      // Map compound assignments
      let operator = node.operator;
      if (operator === '+=' && this.isStringContext(node.left, node.right)) {
        operator = '.=';  // String concatenation assignment
      }

      // Handle unsigned right shift assignment (>>>=)
      // JavaScript: x >>>= n is equivalent to x = (x >>> n)
      // Perl: x = ((x >> n) & ((1 << (32 - n)) - 1))  for 32-bit unsigned
      // Simpler: $x = ($x >> $n) & 0xFFFFFFFF  (mask to 32-bit unsigned)
      if (operator === '>>>=') {
        // Convert to: $left = ($left >> $right) & 0xFFFFFFFF
        // Note: PerlBinaryExpression constructor is (left, operator, right)
        // Note: PerlLiteral.Hex expects a numeric value, not a string
        const shiftExpr = new PerlBinaryExpression(left, '>>', right);
        const maskedExpr = new PerlBinaryExpression(shiftExpr, '&', PerlLiteral.Hex(0xFFFFFFFF));
        return new PerlAssignment(left, '=', maskedExpr);
      }

      return new PerlAssignment(left, operator, right);
    }

    /**
     * Transform an update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);

      // Perl has ++ and --, same as JavaScript
      const op = node.operator === '++' ? '++' : '--';
      return new PerlUnaryExpression(op, operand, node.prefix);
    }

    /**
     * Transform a member expression
     */
    transformMemberExpression(node) {
      // Handle global.X and globalThis.X patterns
      if (node.object.type === 'Identifier') {
        const objectName = node.object.name;
        const member = node.property.name || node.property.value;

        // global.OpCodes and globalThis.OpCodes - always truthy in transpiled code
        if ((objectName === 'global' || objectName === 'globalThis') && member === 'OpCodes')
          return PerlLiteral.Number(1);

        // global.AlgorithmFramework and globalThis.AlgorithmFramework
        // The framework is always available, return the identifier
        if ((objectName === 'global' || objectName === 'globalThis') && member === 'AlgorithmFramework')
          return new PerlIdentifier('AlgorithmFramework');
      }

      // Handle global.AlgorithmFramework.X.Y patterns - treat as AlgorithmFramework.X.Y
      // e.g., global.AlgorithmFramework.CategoryType.BLOCK -> 'block'
      if (node.object.type === 'MemberExpression' &&
          node.object.object.type === 'MemberExpression') {
        const root = node.object.object.object;
        if (root && root.type === 'Identifier' && (root.name === 'global' || root.name === 'globalThis')) {
          const middle = node.object.object.property.name || node.object.object.property.value;
          if (middle === 'AlgorithmFramework') {
            // This is global.AlgorithmFramework.X.Y - handle like AlgorithmFramework.X.Y
            const enumClass = node.object.property.name || node.object.property.value;
            const enumValue = node.property.name || node.property.value;
            const ENUM_CLASSES = new Set(['CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode']);
            if (ENUM_CLASSES.has(enumClass))
              return PerlLiteral.String(enumValue.toLowerCase(), "'");
            // For other like LinkItem, Vulnerability, return the class name
            return new PerlIdentifier(enumClass);
          }
        }
      }

      // Handle global.AlgorithmFramework.X patterns (for class constructors like LinkItem, KeySize)
      // e.g., global.AlgorithmFramework.LinkItem -> LinkItem
      if (node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier') {
        const root = node.object.object.name;
        const middle = node.object.property.name || node.object.property.value;
        const member = node.property.name || node.property.value;
        if ((root === 'global' || root === 'globalThis') && middle === 'AlgorithmFramework')
          return new PerlIdentifier(member);
      }

      // Handle AlgorithmFramework enum constants - convert to string constants
      // These are things like CategoryType.BLOCK, SecurityStatus.SECURE, etc.
      const ENUM_CLASSES = new Set([
        'CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode'
      ]);

      // Known framework classes that should be used directly
      const FRAMEWORK_TYPES = new Set([
        'KeySize', 'LinkItem', 'Vulnerability', 'TestCase'
      ]);

      // Handle AlgorithmFramework.X pattern - strip the AlgorithmFramework. prefix
      // e.g., AlgorithmFramework.CategoryType -> CategoryType identifier
      // e.g., AlgorithmFramework.KeySize -> KeySize identifier
      if (node.object.type === 'Identifier' && node.object.name === 'AlgorithmFramework') {
        const propName = node.property.name || node.property.value;

        // For enums, return the enum identifier (which will be handled by the next iteration)
        if (ENUM_CLASSES.has(propName))
          return new PerlIdentifier(propName);

        // For helper classes, return the class name
        if (FRAMEWORK_TYPES.has(propName))
          return new PerlIdentifier(propName);

        // For other properties, return as identifier
        return new PerlIdentifier(propName);
      }

      // Handle AlgorithmFramework.CategoryType.BLOCK pattern (nested)
      // e.g., AlgorithmFramework.CategoryType.BLOCK -> 'BLOCK'
      if (node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier' &&
          node.object.object.name === 'AlgorithmFramework') {

        const middleProp = node.object.property.name || node.object.property.value;
        const outerProp = node.property.name || node.property.value;

        // For enum constants, return string value
        if (ENUM_CLASSES.has(middleProp))
          return PerlLiteral.String(outerProp, "'");

        // For other nested access, just return the outer property
        return new PerlIdentifier(outerProp);
      }

      if (node.object && node.object.type === 'Identifier' && ENUM_CLASSES.has(node.object.name)) {
        // Convert to string constant: CategoryType.BLOCK -> 'BLOCK'
        const enumValue = node.property.name || node.property.value;
        return PerlLiteral.String(enumValue, "'");
      }

      // When the object is a class name (package) and we're accessing a property,
      // use Perl package variable syntax $ClassName::property instead of
      // 'ClassName'->{'property'} which causes symbolic reference errors under strict
      if (!node.computed && node.object.type === 'Identifier') {
        const objName = node.object.name;
        const isClassObj = /^[A-Z]/.test(objName) &&
          (this.definedClassNames.has(objName) ||
           objName.endsWith('Array') || objName.endsWith('Algorithm') || objName.endsWith('Instance') ||
           objName.endsWith('Point') || objName.endsWith('Cipher') || objName.endsWith('Module') ||
           objName.endsWith('Utils') || objName.endsWith('Transform') || objName.endsWith('Encoder') ||
           objName.endsWith('Decoder') || objName.endsWith('Generator') || objName.endsWith('Factory') ||
           objName.endsWith('Core') || objName.endsWith('Constants') || objName.endsWith('Helper') ||
           objName.endsWith('Hasher') || objName.endsWith('Tree') || objName.endsWith('Front') ||
           objName === 'OpCodes' || objName === 'AlgorithmFramework' || objName === 'NumberTheory') &&
          !this.variableTypes.has(objName);
        if (isClassObj) {
          const member = node.property.name || node.property.value;
          // Use package variable syntax for data properties: $ClassName::PROPERTY
          const dataProps = new Set([
            'ROUNDS', 'DELTA', 'CYCLES', 'NUM_WORDS', 'WORD_SIZE', 'KEY_SCHEDULE_SIZE',
            'BlockSize', 'KeySize', 'IvSize', 'OutputSize',
            'spBox', 'spBoxInitialized', 'sBox', 'sbox',
          ]);
          if (dataProps.has(member)) {
            return new PerlRawCode(`$${objName}::${member}`);
          }
          // For method calls or other member access, use bareword package name
          return new PerlMemberAccess(new PerlIdentifier(objName, ''), member, '->');
        }
      }

      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Check for string indexing: str[i] -> substr($str, $i, 1)
        // JavaScript strings support bracket indexing like arrays
        if (this.isStringType(node.object)) {
          const index = this.transformExpression(node.property);
          return new PerlCall('substr', [object, index, PerlLiteral.Number(1)]);
        }

        // Array/hash indexing
        // JavaScript arrays are always references in Perl ($arr = [])
        // so we need arrow notation: $arr->[0] not $arr[0]
        const index = this.transformExpression(node.property);
        const subscriptType = this.isArrayContext(node.object, node.property) ? 'array' : 'hash';
        // isRefDeref = true because JS arrays/objects are Perl references
        return new PerlSubscript(object, index, subscriptType, true);
      } else {
        // Object method or field access
        const member = node.property.name || node.property.value;

        // Handle special properties
        if (member === 'length') {
          // @array in scalar context or length($string)
          return new PerlUnaryExpression('scalar', object);
        }

        // Known data properties in algorithm framework that need hash access, not method call
        // These are properties accessed as obj.Property, not obj.method()
        const dataProperties = new Set([
          // Algorithm metadata
          'SupportedKeySizes', 'SupportedBlockSizes', 'SupportedIvSizes',
          'BlockSize', 'KeySize', 'IvSize', 'OutputSize',
          'ROUNDS', 'DELTA', 'CYCLES', 'NUM_WORDS', 'WORD_SIZE',
          'name', 'description', 'inventor', 'year', 'category',
          'subCategory', 'securityStatus', 'complexity', 'country',
          'tests', 'documentation', 'comment', 'algorithm',
          // Instance properties
          'minSize', 'maxSize', 'stepSize',
          'isInverse', 'inputBuffer', 'outputBuffer',
          '_key', '_iv', '_nonce', '_state', '_buffer',
          'keyWords', 'sbox', 'S', 'P', 'K', 'L', 'R',
          'roundKeys', 'subkeys', 'expandedKey',
          // Config object properties (from variant configs)
          'config', 'sumBits', 'modulo', 'base', 'resultBytes',
          'blockSize', 'keySize', 'ivSize', 'tagSize', 'nonceSize',
          'rounds', 'wordSize', 'numWords', 'delta', 'cycles'
        ]);

        // Use hash subscript access for known data properties
        if (dataProperties.has(member)) {
          return new PerlSubscript(object, PerlLiteral.String(member, "'"), 'hash', true);
        }

        // Method call or field access - default to method style
        return new PerlMemberAccess(object, member, '->');
      }
    }

    /**
     * Transform a call expression
     */
    transformCallExpression(node) {
      // Handle .apply(thisArg, argsArray) pattern
      // e.g., String.fromCharCode.apply(null, bytes) -> pack('C*', @$bytes)
      if (node.callee.type === 'MemberExpression' &&
          (node.callee.property.name === 'apply' || node.callee.property.value === 'apply')) {
        const funcExpr = node.callee.object;
        if (funcExpr.type === 'MemberExpression' &&
            funcExpr.object.type === 'Identifier' &&
            funcExpr.object.name === 'String' &&
            (funcExpr.property.name === 'fromCharCode' || funcExpr.property.value === 'fromCharCode')) {
          // String.fromCharCode.apply(null, bytes) -> pack('C*', @$bytes)
          const argsArray = node.arguments[1]; // Second argument is the array
          if (argsArray) {
            const arr = this.transformExpression(argsArray);
            return new PerlCall('pack', [
              PerlLiteral.String('C*', "'"),
              new PerlUnaryExpression('@', arr, true)
            ]);
          }
        }
      }

      // Handle OpCodes method calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.transformOpCodesCall(node);
      }

      // Handle JavaScript global builtin static methods
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier') {
        const objName = node.callee.object.name;
        const methodName = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Array.isArray(x) -> ref(x) eq 'ARRAY'
        if (objName === 'Array' && methodName === 'isArray') {
          return new PerlBinaryExpression(
            new PerlCall('ref', [args[0]]),
            'eq',
            PerlLiteral.String('ARRAY', "'")
          );
        }

        // Array.from(x) -> [@{$x}] (creates a shallow copy of the array)
        if (objName === 'Array' && methodName === 'from') {
          // Just return the argument - in Perl context, if we need a copy we use [@{$x}]
          // But for most uses in crypto code, the original reference is fine
          return args[0];
        }

        // Object.keys(x) -> keys %{$x}
        if (objName === 'Object' && methodName === 'keys') {
          return new PerlCall('keys', [new PerlUnaryExpression('%', args[0], true)]);
        }

        // Object.values(x) -> values %{$x}
        if (objName === 'Object' && methodName === 'values') {
          return new PerlCall('values', [new PerlUnaryExpression('%', args[0], true)]);
        }

        // Object.entries(x) -> handled as array of [key, value] pairs
        if (objName === 'Object' && methodName === 'entries') {
          return new PerlCall('map', [
            new PerlBlock([
              new PerlExpressionStatement(
                new PerlArray([new PerlIdentifier('_', '$'), new PerlSubscript(args[0], new PerlIdentifier('_', '$'), 'hash')])
              )
            ]),
            new PerlCall('keys', [new PerlUnaryExpression('%', args[0], true)])
          ]);
        }

        // Object.freeze(x) -> $x (Perl doesn't have freeze, just return the object)
        if (objName === 'Object' && methodName === 'freeze') {
          return args[0];
        }

        // Object.assign(target, ...sources) -> do { my $t = $target; @{$t}{keys %$s} = values %$s for @sources; $t }
        if (objName === 'Object' && methodName === 'assign') {
          // Simple case: just return the target, sources would be merged at runtime
          // For static analysis, the IL transformer should handle this
          return args[0];
        }

        // Object.create(proto) -> simplified to empty hash (proto ignored in simple cases)
        if (objName === 'Object' && methodName === 'create') {
          return new PerlHash([]);
        }

        // JSON.stringify(x) -> use JSON 'encode_json'; encode_json($x)
        if (objName === 'JSON' && methodName === 'stringify') {
          this.addRequiredModule('JSON', 'encode_json');
          return new PerlCall('encode_json', args);
        }

        // JSON.parse(x) -> use JSON 'decode_json'; decode_json($x)
        if (objName === 'JSON' && methodName === 'parse') {
          this.addRequiredModule('JSON', 'decode_json');
          return new PerlCall('decode_json', args);
        }

        // console.log(x) -> print(x, "\n")
        // console.warn(x) -> warn(x)
        // console.error(x) -> warn(x) (Perl sends to STDERR)
        if (objName === 'console') {
          if (methodName === 'log') {
            return new PerlCall('print', [...args, PerlLiteral.String("\\n", '"')]);
          }
          if (methodName === 'warn' || methodName === 'error') {
            return new PerlCall('warn', args);
          }
          // Default to print for other console methods
          return new PerlCall('print', args);
        }

        // String.fromCharCode(x) -> chr(x)
        if (objName === 'String' && methodName === 'fromCharCode') {
          return new PerlCall('chr', args);
        }

        // Number.parseInt(x, radix) -> int($x) (simplified, ignores radix for now)
        if (objName === 'Number' && methodName === 'parseInt') {
          return new PerlCall('int', [args[0]]);
        }

        // Number.parseFloat(x) -> $x + 0
        if (objName === 'Number' && methodName === 'parseFloat') {
          return new PerlBinaryExpression(args[0], '+', new PerlLiteral(0));
        }

        // Number.isInteger(x) -> ($x == int($x))
        if (objName === 'Number' && methodName === 'isInteger') {
          const intCall = new PerlCall('int', [args[0]]);
          return new PerlGrouped(new PerlBinaryExpression(args[0], '==', intCall));
        }

        // Number.isNaN(x) -> (!defined($x) || $x ne $x)
        if (objName === 'Number' && methodName === 'isNaN') {
          const notDefined = new PerlUnaryExpression('!', new PerlCall('defined', [args[0]]), true);
          const neCheck = new PerlBinaryExpression(args[0], 'ne', args[0]);
          return new PerlGrouped(new PerlBinaryExpression(notDefined, '||', neCheck));
        }

        // Number.isFinite(x) -> defined($x) && $x !~ /^[+-]?inf/i
        if (objName === 'Number' && methodName === 'isFinite') {
          return new PerlCall('defined', [args[0]]);  // Simplified
        }

        // Math.min/max - use List::Util with fully qualified names
        if (objName === 'Math' && methodName === 'min')
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("min"), "::"), args);
        if (objName === 'Math' && methodName === 'max')
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("max"), "::"), args);

        // Math.floor -> POSIX::floor with fully qualified name
        if (objName === 'Math' && methodName === 'floor')
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("floor"), "::"), args);

        // Math.ceil -> POSIX::ceil
        if (objName === 'Math' && methodName === 'ceil')
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("ceil"), "::"), args);

        // Math.round -> POSIX::round
        if (objName === 'Math' && methodName === 'round')
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("round"), "::"), args);

        // Math.abs -> abs()
        if (objName === 'Math' && methodName === 'abs') {
          return new PerlCall('abs', args);
        }

        // Math.pow(a, b) -> a ** b
        if (objName === 'Math' && methodName === 'pow') {
          return new PerlBinaryExpression(args[0], '**', args[1]);
        }

        // Math.sqrt -> sqrt()
        if (objName === 'Math' && methodName === 'sqrt') {
          return new PerlCall('sqrt', args);
        }

        // Math.log -> log()
        if (objName === 'Math' && methodName === 'log') {
          return new PerlCall('log', args);
        }

        // Math.log2 -> log(x) / log(2)
        if (objName === 'Math' && methodName === 'log2') {
          return new PerlBinaryExpression(
            new PerlCall('log', args),
            '/',
            new PerlCall('log', [PerlLiteral.Number(2)])
          );
        }

        // Math.log10 -> log(x) / log(10)
        if (objName === 'Math' && methodName === 'log10') {
          return new PerlBinaryExpression(
            new PerlCall('log', args),
            '/',
            new PerlCall('log', [PerlLiteral.Number(10)])
          );
        }

        // Math.exp -> exp()
        if (objName === 'Math' && methodName === 'exp') {
          return new PerlCall('exp', args);
        }

        // Math.sin/cos/tan/atan/atan2
        if (objName === 'Math' && ['sin', 'cos', 'atan', 'atan2'].includes(methodName)) {
          return new PerlCall(methodName, args);
        }

        // Math.random() -> rand()
        if (objName === 'Math' && methodName === 'random') {
          return new PerlCall('rand', []);
        }
      }

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const method = node.callee.property.name || node.callee.property.value;

        // Handle array reduce specially
        if (method === 'reduce') {
          return this.transformArrayReduce(node);
        }

        const object = this.transformExpression(node.callee.object);
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle common array methods
        // slice() -> [@{$array}] or [@{$array}[start..end]]
        if (method === 'slice') {
          // No args: copy entire array
          if (args.length === 0) {
            return new PerlArray([new PerlUnaryExpression('@', object, true)]);
          }
          // With start: [@{$array}[start..$#{$array}]]
          if (args.length === 1) {
            const start = args[0];
            const end = new PerlUnaryExpression('$#', object, true);
            return new PerlArraySlice(object, start, end);
          }
          // With start and end: [@{$array}[start..end-1]]
          if (args.length >= 2) {
            const start = args[0];
            const end = new PerlBinaryExpression(args[1], '-', new PerlLiteral(1));
            return new PerlArraySlice(object, start, end);
          }
        }

        // push(@array, value) -> mutates array
        if (method === 'push') {
          return new PerlCall('push', [new PerlUnaryExpression('@', object, true), ...args]);
        }

        // pop(@array) -> removes and returns last
        if (method === 'pop') {
          return new PerlCall('pop', [new PerlUnaryExpression('@', object, true)]);
        }

        // shift(@array) -> removes and returns first
        if (method === 'shift') {
          return new PerlCall('shift', [new PerlUnaryExpression('@', object, true)]);
        }

        // unshift(@array, value) -> adds to front
        if (method === 'unshift') {
          return new PerlCall('unshift', [new PerlUnaryExpression('@', object, true), ...args]);
        }

        // join(sep) -> join($sep, @{$array})
        if (method === 'join') {
          const separator = args.length > 0 ? args[0] : PerlLiteral.String('', "'");
          return new PerlCall('join', [separator, new PerlUnaryExpression('@', object, true)]);
        }

        // indexOf(val) -> List::Util first_index
        if (method === 'indexOf') {
          this.addRequiredModule('List::Util', 'first');
          // Simplified: returns -1 or first matching index
          const grepExpr = new PerlCall('grep', [
            new PerlBlock([new PerlExpressionStatement(
              new PerlBinaryExpression(new PerlIdentifier('_', '$'), '==', args[0])
            )]),
            PerlLiteral.Number(0),
            new PerlBinaryExpression(new PerlCall('scalar', [new PerlUnaryExpression('@', object, true)]), '-', PerlLiteral.Number(1))
          ]);
          return grepExpr;
        }

        // includes(val) -> grep { $_ eq $val } @{$array}
        if (method === 'includes') {
          return new PerlCall('grep', [
            new PerlBlock([new PerlExpressionStatement(
              new PerlBinaryExpression(new PerlIdentifier('_', '$'), '==', args[0])
            )]),
            new PerlUnaryExpression('@', object, true)
          ]);
        }

        // some(fn) -> List::Util::any { fn } @{$array} - fallback when IL didn't detect it
        if (method === 'some') {
          const callback = args[0];
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("any"), "::"), [callback, this.wrapArrayDeref(object)]);
        }

        // every(fn) -> List::Util::all { fn } @{$array} - fallback when IL didn't detect it
        if (method === 'every') {
          const callback = args[0];
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("all"), "::"), [callback, this.wrapArrayDeref(object)]);
        }

        // find(fn) -> List::Util::first { fn } @{$array} - fallback when IL didn't detect it
        if (method === 'find') {
          const callback = args[0];
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("first"), "::"), [callback, this.wrapArrayDeref(object)]);
        }

        // map(fn) -> [map { fn } @{$array}] - fallback when IL didn't detect it
        if (method === 'map') {
          const callback = args[0];
          return new PerlArray([new PerlCall('map', [callback, this.wrapArrayDeref(object)])]);
        }

        // filter(fn) -> [grep { fn } @{$array}] - fallback when IL didn't detect it
        if (method === 'filter') {
          const callback = args[0];
          return new PerlArray([new PerlCall('grep', [callback, this.wrapArrayDeref(object)])]);
        }

        // reverse() -> [reverse @{$array}]
        if (method === 'reverse') {
          return new PerlArray([new PerlCall('reverse', [new PerlUnaryExpression('@', object, true)])]);
        }

        // sort() -> [sort @{$array}]
        if (method === 'sort') {
          if (args.length === 0) {
            return new PerlArray([new PerlCall('sort', [new PerlUnaryExpression('@', object, true)])]);
          }
          // With comparator - need special handling
          return new PerlArray([new PerlCall('sort', [args[0], new PerlUnaryExpression('@', object, true)])]);
        }

        // splice(start, deleteCount, ...items)
        if (method === 'splice') {
          return new PerlCall('splice', [new PerlUnaryExpression('@', object, true), ...args]);
        }

        // concat(...arrays) -> [@{$array1}, @{$array2}, ...]
        if (method === 'concat') {
          const allElements = [new PerlUnaryExpression('@', object, true)];
          for (const arg of args) {
            allElements.push(new PerlUnaryExpression('@', arg, true));
          }
          return new PerlArray(allElements);
        }

        // fill(value, start?, end?) -> simplified: replace all with value
        if (method === 'fill') {
          // Simplified: returns array of same length filled with value
          const len = new PerlCall('scalar', [new PerlUnaryExpression('@', object, true)]);
          return new PerlArray([
            new PerlBinaryExpression(
              new PerlGrouped(args[0]),
              'x',
              len
            )
          ]);
        }

        // String methods
        // toUpperCase() -> uc($str)
        if (method === 'toUpperCase') {
          return new PerlCall('uc', [object]);
        }

        // toLowerCase() -> lc($str)
        if (method === 'toLowerCase') {
          return new PerlCall('lc', [object]);
        }

        // charCodeAt(index) -> ord(substr($str, index, 1))
        if (method === 'charCodeAt') {
          const index = args.length > 0 ? args[0] : PerlLiteral.Number(0);
          return new PerlCall('ord', [
            new PerlCall('substr', [object, index, PerlLiteral.Number(1)])
          ]);
        }

        // split(sep) -> [split(/$sep/, $str)] or [split(//, $str)] for no arg
        // Note: Perl split returns a list, but JS split returns an array, so wrap in []
        if (method === 'split') {
          if (args.length === 0) {
            // Split into characters
            return new PerlArray([new PerlCall('split', [PerlLiteral.String('', "//"), object])]);
          }
          // Split by separator - if it's a string, quote it; if regex, use directly
          const sep = args[0];
          return new PerlArray([new PerlCall('split', [sep, object])]);
        }

        // replace(pattern, replacement) -> simplified regex substitution
        // Note: JavaScript replace() with string only replaces first occurrence
        // but with /g flag replaces all. We'll use a basic approach.
        if (method === 'replace') {
          // Check original node.arguments for literal values
          const origArgs = node.arguments || [];
          if (origArgs[0] && origArgs[0].type === 'Literal' && origArgs[1] && origArgs[1].type === 'Literal') {
            const pattern = String(origArgs[0].value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const replacement = String(origArgs[1].value);
            const tempVar = new PerlIdentifier('_tmp_str', '$');
            return new PerlCall('do', [
              new PerlBlock([
                new PerlVarDeclaration('my', '_tmp_str', '$', object),
                new PerlExpressionStatement(new PerlBinaryExpression(
                  tempVar, '=~', new PerlIdentifier(`s/${pattern}/${replacement}/g`)
                )),
                tempVar
              ])
            ]);
          }
          // Fallback: return object unchanged (simplified)
          return object;
        }

        // substring(start, end) -> substr($str, start, end-start)
        if (method === 'substring' || method === 'substr') {
          if (args.length === 1) {
            return new PerlCall('substr', [object, args[0]]);
          }
          if (args.length >= 2) {
            const length = new PerlBinaryExpression(args[1], '-', args[0]);
            return new PerlCall('substr', [object, args[0], length]);
          }
          return object;
        }

        // trim() -> use simple substitution approach
        if (method === 'trim') {
          const tempVar = new PerlIdentifier('_tmp_str', '$');
          return new PerlCall('do', [
            new PerlBlock([
              new PerlVarDeclaration('my', '_tmp_str', '$', object),
              new PerlExpressionStatement(new PerlBinaryExpression(
                tempVar, '=~', new PerlIdentifier('s/^\\s+|\\s+$//g')
              )),
              tempVar
            ])
          ]);
        }

        // trimStart/trimLeft() -> $str =~ s/^\s+//
        if (method === 'trimStart' || method === 'trimLeft') {
          const tempVar = new PerlIdentifier('_tmp_str', '$');
          return new PerlCall('do', [
            new PerlBlock([
              new PerlVarDeclaration('my', '_tmp_str', '$', object),
              new PerlExpressionStatement(new PerlBinaryExpression(
                tempVar, '=~', new PerlIdentifier('s/^\\s+//')
              )),
              tempVar
            ])
          ]);
        }

        // trimEnd/trimRight() -> $str =~ s/\s+$//
        if (method === 'trimEnd' || method === 'trimRight') {
          const tempVar = new PerlIdentifier('_tmp_str', '$');
          return new PerlCall('do', [
            new PerlBlock([
              new PerlVarDeclaration('my', '_tmp_str', '$', object),
              new PerlExpressionStatement(new PerlBinaryExpression(
                tempVar, '=~', new PerlIdentifier('s/\\s+$//')
              )),
              tempVar
            ])
          ]);
        }

        const call = new PerlCall(new PerlIdentifier(method), args);
        call.isMethodCall = true;

        // Create method call: $object->method(@args)
        return new PerlMemberAccess(object, call, '->');
      }

      // Handle global JavaScript functions (not method calls)
      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Array(n) called as function (without new) - same as new Array(n)
        // Creates an array of n undefined elements: [(undef) x $n]
        if (funcName === 'Array') {
          if (args.length === 1) {
            // Array(n) -> [(undef) x n]
            return new PerlArray([
              new PerlBinaryExpression(
                new PerlGrouped(new PerlIdentifier('undef')),
                'x',
                args[0]
              )
            ]);
          }
          // Array(a, b, c) -> [a, b, c]
          return new PerlArray(args);
        }

        // parseInt(x, radix) -> int($x)
        if (funcName === 'parseInt') {
          return new PerlCall('int', [args[0]]);
        }

        // parseFloat(x) -> $x + 0
        if (funcName === 'parseFloat') {
          return new PerlBinaryExpression(args[0], '+', new PerlLiteral(0));
        }

        // isNaN(x) -> (!defined($x) || $x ne $x)
        if (funcName === 'isNaN') {
          const notDefined = new PerlUnaryExpression('!', new PerlCall('defined', [args[0]]), true);
          const neCheck = new PerlBinaryExpression(args[0], 'ne', args[0]);
          return new PerlGrouped(new PerlBinaryExpression(notDefined, '||', neCheck));
        }

        // isFinite(x) -> defined($x)
        if (funcName === 'isFinite') {
          return new PerlCall('defined', [args[0]]);
        }

        // encodeURIComponent -> use URI::Escape 'uri_escape'
        if (funcName === 'encodeURIComponent') {
          this.addRequiredModule('URI::Escape', 'uri_escape');
          return new PerlCall('uri_escape', args);
        }

        // decodeURIComponent -> use URI::Escape 'uri_unescape'
        if (funcName === 'decodeURIComponent') {
          this.addRequiredModule('URI::Escape', 'uri_unescape');
          return new PerlCall('uri_unescape', args);
        }

        // Check if this is a code reference variable (assigned from function expression)
        // In Perl, code refs must be called with $coderef->() syntax
        if (this.codeRefVariables.has(funcName)) {
          return new PerlCall(new PerlIdentifier(funcName, '$'), args);
        }

        // Regular function call with Perl identifier
        return new PerlCall(new PerlIdentifier(funcName), args);
      }

      // Handle IIFE (Immediately Invoked Function Expression)
      // Pattern: (function() {...})() or (() => {...})()
      // In Perl, this needs to be: (sub { ... })->()
      if (node.callee.type === 'ArrowFunctionExpression' ||
          node.callee.type === 'FunctionExpression') {
        const anonSub = this.transformFunctionExpression(node.callee);
        const args = node.arguments.map(arg => this.transformExpression(arg));
        // Create IIFE: (sub { ... })->(args)
        const grouped = new PerlGrouped(anonSub);
        const methodCall = new PerlMemberAccess(grouped, new PerlCall(null, args), '->');
        return methodCall;
      }

      // Regular function call
      // For known function names, use bare name (not $sigiled) to produce functionName(args)
      if (node.callee.type === 'Identifier' && this.functionNames.has(node.callee.name)) {
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new PerlCall(new PerlIdentifier(node.callee.name, ''), args);
      }

      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      return new PerlCall(callee, args);
    }

    /**
     * Transform OpCodes method calls to Perl equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map common OpCodes methods to Perl equivalents inline

      // CopyArray - shallow copy
      if (methodName === 'CopyArray')
        return new PerlArray([new PerlUnaryExpression('@', args[0], true)]);

      // FillArray - fill array with value
      if (methodName === 'FillArray' || methodName === 'Fill') {
        // @{$arr} = ($val) x $count
        return new PerlArray([
          new PerlBinaryExpression(
            new PerlGrouped(args[1] || args[0]),
            'x',
            args[2] || args[1] || PerlLiteral.Number(1)
          )
        ]);
      }

      // BitMask - create a bitmask with n bits set
      if (methodName === 'BitMask')
        return new PerlBinaryExpression(
          new PerlBinaryExpression(PerlLiteral.Number(1), '<<', args[0]),
          '-',
          PerlLiteral.Number(1)
        );

      // CompareArrays - compare two arrays
      if (methodName === 'CompareArrays') {
        // join('', @$a) eq join('', @$b)
        const joinA = new PerlCall('join', [PerlLiteral.String('', "'"), new PerlUnaryExpression('@', args[0], true)]);
        const joinB = new PerlCall('join', [PerlLiteral.String('', "'"), new PerlUnaryExpression('@', args[1], true)]);
        return new PerlBinaryExpression(joinA, 'eq', joinB);
      }

      // Galois field multiplication for GF(256)
      if (methodName === 'GF256Mul' || methodName === 'gfMul') {
        // GF(256) multiplication needs a helper function - for now prefix with OpCodes::
        return new PerlCall(new PerlMemberAccess(new PerlIdentifier('OpCodes'), new PerlIdentifier('gf256_mul'), '::'), args);
      }

      // IntsTo32bits / BytesToWords - convert byte array to 32-bit words
      if (methodName === 'IntsTo32bits' || methodName === 'BytesToWords32BE') {
        // For now, prefix with OpCodes::
        return new PerlCall(new PerlMemberAccess(new PerlIdentifier('OpCodes'), new PerlIdentifier('ints_to_32bits'), '::'), args);
      }

      // Default: prefix with OpCodes:: package name so Perl can find it
      // This ensures that any OpCodes method not specially handled is still callable
      return new PerlCall(new PerlMemberAccess(new PerlIdentifier('OpCodes'), new PerlIdentifier(methodName.toLowerCase()), '::'), args);
    }

    /**
     * Transform array.reduce() to inline Perl reduction
     * JS: array.reduce((acc, elem) => acc + elem, initialValue)
     * Perl: do { my $acc = init; for my $x (@{$array}) { $acc = expr } $acc }
     */
    transformArrayReduce(node) {
      const array = this.transformExpression(node.callee.object);
      const callback = node.arguments[0];
      const initialValue = node.arguments.length > 1
        ? this.transformExpression(node.arguments[1])
        : PerlLiteral.Number(0);

      if (!callback || (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression')) {
        // Fallback to method call if callback is not a function literal
        const args = node.arguments.map(arg => this.transformExpression(arg));
        const call = new PerlCall(new PerlIdentifier('reduce'), args);
        call.isMethodCall = true;
        return new PerlMemberAccess(array, call, '->');
      }

      // Get parameter names from callback
      const params = callback.params || [];
      const accName = params[0]?.name || 'acc';
      const elemName = params[1]?.name || 'elem';

      // Transform callback body with substitution
      const bodyExpr = this.transformReduceBody(callback.body, accName, elemName);

      // Create inline do block structure
      const reduceBlock = {
        nodeType: 'ReduceBlock',
        array: array,
        initialValue: initialValue,
        bodyExpr: bodyExpr
      };

      return reduceBlock;
    }

    /**
     * Transform reduce callback body, replacing acc/elem with $acc/$x
     */
    transformReduceBody(body, accName, elemName) {
      if (!body) return PerlLiteral.Number(0);

      // If expression body (arrow function shorthand)
      if (body.type !== 'BlockStatement') {
        return this.transformWithSubst(body, accName, elemName);
      }

      // Block body - find return statement
      const statements = body.body || [];
      for (const stmt of statements) {
        if (stmt.type === 'ReturnStatement' && stmt.argument) {
          return this.transformWithSubst(stmt.argument, accName, elemName);
        }
      }

      return PerlLiteral.Number(0);
    }

    /**
     * Transform expression with accumulator/element substitution for reduce
     */
    transformWithSubst(node, accName, elemName) {
      if (!node) return null;

      if (node.type === 'Identifier') {
        if (node.name === accName) {
          return new PerlIdentifier('acc', '$');
        }
        if (node.name === elemName) {
          return new PerlIdentifier('x', '$');
        }
        return this.transformExpression(node);
      }

      if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
        const left = this.transformWithSubst(node.left, accName, elemName);
        const right = this.transformWithSubst(node.right, accName, elemName);
        return new PerlBinaryExpression(left, node.operator, right);
      }

      if (node.type === 'UnaryExpression') {
        const operand = this.transformWithSubst(node.argument, accName, elemName);
        return new PerlUnaryExpression(node.operator, operand, node.prefix);
      }

      if (node.type === 'Literal') {
        return this.transformLiteral(node);
      }

      if (node.type === 'ConditionalExpression') {
        const test = this.transformWithSubst(node.test, accName, elemName);
        const consequent = this.transformWithSubst(node.consequent, accName, elemName);
        const alternate = this.transformWithSubst(node.alternate, accName, elemName);
        return new PerlConditional(test, consequent, alternate);
      }

      // Fallback to regular transform
      return this.transformExpression(node);
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      const elements = node.elements.map(elem => this.transformExpression(elem));
      return new PerlArray(elements);
    }

    /**
     * Transform an object expression to Perl hash
     */
    transformObjectExpression(node) {
      const pairs = [];
      for (const prop of node.properties) {
        if (!prop.key) continue;

        const key = prop.key.name || prop.key.value || 'unknown';

        // Check if the value is an identifier that refers to a known function
        // In Perl, we need to use code references: \&funcName
        if (prop.value && prop.value.type === 'Identifier' &&
            this.functionNames.has(prop.value.name)) {
          // Create a code reference: \&funcName
          const codeRef = new PerlUnaryExpression('\\&', new PerlIdentifier(prop.value.name, ''), true);
          pairs.push({ key, value: codeRef });
        } else {
          const value = this.transformExpression(prop.value);
          pairs.push({ key, value });
        }
      }

      return new PerlHash(pairs);
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      // Handle MemberExpression callees like AlgorithmFramework.KeySize
      if (node.callee.type === 'MemberExpression') {
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle AlgorithmFramework.ClassName pattern
        if (node.callee.object.type === 'Identifier' &&
            node.callee.object.name === 'AlgorithmFramework') {
          const typeName = node.callee.property.name || node.callee.property.value;

          // Class instantiation: ClassName->new(@args)
          const newCall = new PerlCall(new PerlIdentifier('new'), args);
          newCall.isMethodCall = true;
          return new PerlMemberAccess(new PerlIdentifier(typeName), newCall, '->');
        }

        // For other MemberExpression callees, transform the callee and call ->new()
        const callee = this.transformExpression(node.callee);
        const newCall = new PerlCall(new PerlIdentifier('new'), args);
        newCall.isMethodCall = true;
        return new PerlMemberAccess(callee, newCall, '->');
      }

      if (node.callee.type === 'Identifier') {
        const typeName = node.callee.name;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle Error constructor - just return the message for use with die
        if (typeName === 'Error' || typeName === 'TypeError' || typeName === 'RangeError') {
          // new Error('message') -> 'message' (to be used with die)
          return args.length > 0 ? args[0] : PerlLiteral.String('Error', "'");
        }

        // Handle TypedArrays -> pack/unpack or Array::Typed
        if (typeName === 'Uint8Array' || typeName === 'Uint32Array') {
          // new Uint8Array([...]) -> pack or array
          return new PerlArray(args);
        }

        // Handle Array constructor
        if (typeName === 'Array') {
          return new PerlArray(args);
        }

        // Class instantiation: ClassName->new(@args)
        const newCall = new PerlCall(new PerlIdentifier('new'), args);
        newCall.isMethodCall = true;
        return new PerlMemberAccess(new PerlIdentifier(typeName), newCall, '->');
      }

      return null;
    }

    /**
     * Transform a conditional expression (ternary)
     */
    transformConditionalExpression(node) {
      // Collapse ternaries where the test is AlgorithmFramework (always truthy in transpiled code)
      const testName = node.test?.name || node.test?.object?.name;
      if (testName === 'AlgorithmFramework' || testName === 'global' || testName === 'globalThis') {
        const isFrameworkCheck = testName === 'AlgorithmFramework' ||
          (node.test?.property?.name === 'AlgorithmFramework' || node.test?.property?.value === 'AlgorithmFramework');
        if (isFrameworkCheck)
          return this.transformExpression(node.consequent);
      }

      // Collapse typeof X !== 'undefined' ? X : fallback for known packages
      // These always exist in transpiled Perl code
      if (node.test?.type === 'BinaryExpression' &&
          (node.test.operator === '!==' || node.test.operator === '!=' ||
           node.test.operator === '===' || node.test.operator === '==')) {
        const isNeq = node.test.operator === '!==' || node.test.operator === '!=';
        let typeofArg = null;
        let comparedValue = null;
        if (node.test.left?.type === 'UnaryExpression' && node.test.left.operator === 'typeof') {
          typeofArg = node.test.left.argument?.name;
          comparedValue = node.test.right?.value;
        } else if (node.test.right?.type === 'UnaryExpression' && node.test.right.operator === 'typeof') {
          typeofArg = node.test.right.argument?.name;
          comparedValue = node.test.left?.value;
        // Also detect IL TypeOfExpression nodes
        } else if (node.test.left?.type === 'TypeOfExpression' || node.test.left?.ilNodeType === 'TypeOfExpression') {
          typeofArg = node.test.left.value?.name || node.test.left.argument?.name;
          comparedValue = node.test.right?.value;
        } else if (node.test.right?.type === 'TypeOfExpression' || node.test.right?.ilNodeType === 'TypeOfExpression') {
          typeofArg = node.test.right.value?.name || node.test.right.argument?.name;
          comparedValue = node.test.left?.value;
        }
        if (typeofArg && comparedValue === 'undefined') {
          const knownDefined = new Set([
            'OpCodes', 'AlgorithmFramework', 'RegisterAlgorithm', 'CategoryType',
            'SecurityStatus', 'ComplexityType', 'CountryCode', 'LinkItem', 'KeySize',
            'TestCase', 'Vulnerability', 'Math', 'JSON', 'console', 'Object', 'Array',
            'String', 'Number', 'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array',
            'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array', 'ArrayBuffer',
            'DataView', 'require', 'module', 'exports'
          ]);
          if (knownDefined.has(typeofArg)) {
            // typeof KnownPkg !== 'undefined' ? consequent : alternate
            // Always true -> pick consequent (for !==), alternate (for ===)
            return this.transformExpression(isNeq ? node.consequent : node.alternate);
          }
          const knownUndefined = new Set([
            'window', 'document', 'navigator', 'performance', 'self',
            'global', 'globalThis', 'process', 'TextEncoder', 'TextDecoder',
            'Buffer', 'Crypto', 'crypto'
          ]);
          if (knownUndefined.has(typeofArg)) {
            // typeof browserGlobal !== 'undefined' ? consequent : alternate
            // Always false -> pick alternate (for !==), consequent (for ===)
            return this.transformExpression(isNeq ? node.alternate : node.consequent);
          }
        }
      }

      // Collapse logical AND checks: AlgorithmFramework && AlgorithmFramework.Find
      if (node.test?.type === 'LogicalExpression' && node.test.operator === '&&') {
        const leftName = node.test.left?.name || node.test.left?.argument?.name;
        if (leftName === 'AlgorithmFramework' || leftName === 'OpCodes')
          return this.transformExpression(node.consequent);
      }

      const condition = this.transformExpression(node.test);
      const consequent = this.transformExpression(node.consequent);
      const alternate = this.transformExpression(node.alternate);

      return new PerlConditional(condition, consequent, alternate);
    }

    /**
     * Transform a function expression to Perl anonymous subroutine
     */
    transformFunctionExpression(node) {
      // Map parameters - always use $ to avoid slurpy issues
      const params = node.params ? node.params.map(p => {
        let paramName, defaultValue = null;
        // Handle various parameter formats from IL/AST
        if (p.type === 'AssignmentPattern') {
          paramName = p.left && p.left.name;
          defaultValue = p.right ? this.transformExpression(p.right) : null;
        } else if (p.defaultValue !== undefined && p.defaultValue !== null) {
          paramName = p.name || (p.left && p.left.name) || (p.id && p.id.name);
          defaultValue = this.transformExpression(p.defaultValue);
        } else {
          paramName = p.name || (p.left && p.left.name) || (p.id && p.id.name);
        }
        if (!paramName) paramName = '_arg' + params.length;
        // $_ is a special variable in Perl - cannot be used as a formal parameter in signatures
        if (paramName === '_') paramName = '_unused';
        // Always use $ for function parameters and register so body references use correct sigil
        this.registerVariableType(paramName, '$');
        return new PerlParameter(paramName, '$', null, defaultValue);
      }) : [];

      // Check if body references 'this' (ThisExpression/ThisPropertyAccess/ThisMethodCall)
      // and $self is not already declared as a parameter
      const hasSelfParam = params.some(p => p.name === 'self');
      const bodyUsesThis = !hasSelfParam && this._bodyUsesThis(node.body);

      // Transform body
      let body = null;
      if (node.body) {
        if (node.body.type === 'BlockStatement') {
          body = this.transformBlockStatement(node.body);
        } else {
          // Arrow function with expression body
          body = new PerlBlock();
          body.statements.push(new PerlReturn(this.transformExpression(node.body)));
        }
      }

      // Add $self as first parameter if this is used without $self param
      // (avoids conflict with 'use feature "signatures"' - shift() is forbidden in signature-enabled subs)
      if (bodyUsesThis) {
        params.unshift(new PerlParameter('self', '$'));
      }

      return new PerlAnonSub(params, body);
    }

    /**
     * Check if a test condition is a framework-availability guard
     * (typeof AlgorithmFramework !== 'undefined', typeof OpCodes !== 'undefined', etc.)
     */
    _isFrameworkGuard(test) {
      if (!test) return false;
      const knownDefined = new Set([
        'OpCodes', 'AlgorithmFramework', 'RegisterAlgorithm', 'CategoryType',
        'SecurityStatus', 'ComplexityType', 'CountryCode', 'require', 'module'
      ]);

      // typeof X !== 'undefined'
      if (test.type === 'BinaryExpression' &&
          (test.operator === '!==' || test.operator === '!=')) {
        if (test.left?.type === 'UnaryExpression' && test.left.operator === 'typeof' &&
            knownDefined.has(test.left.argument?.name) &&
            test.right?.value === 'undefined')
          return true;
        if (test.right?.type === 'UnaryExpression' && test.right.operator === 'typeof' &&
            knownDefined.has(test.right.argument?.name) &&
            test.left?.value === 'undefined')
          return true;
      }

      // typeof X !== 'undefined' && X.Prop (LogicalExpression with &&)
      if (test.type === 'LogicalExpression' && test.operator === '&&') {
        if (this._isFrameworkGuard(test.left)) return true;
        // Also check for bare AlgorithmFramework or OpCodes as the left operand
        if (knownDefined.has(test.left?.name)) return true;
      }

      return false;
    }

    /**
     * Check if an IL AST node's body references 'this'
     */
    _bodyUsesThis(node) {
      if (!node || typeof node !== 'object') return false;
      if (node.type === 'ThisExpression' || node.ilNodeType === 'ThisExpression' ||
          node.type === 'ThisPropertyAccess' || node.ilNodeType === 'ThisPropertyAccess' ||
          node.type === 'ThisMethodCall' || node.ilNodeType === 'ThisMethodCall')
        return true;
      // Check for MemberExpression with this as object
      if (node.type === 'MemberExpression' && node.object?.type === 'ThisExpression')
        return true;
      // Recurse into child nodes (but not into nested function scopes)
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'ilNodeType' || key === 'resultType') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          for (const item of child)
            if (item && typeof item === 'object' && this._bodyUsesThis(item)) return true;
        } else if (child && typeof child === 'object') {
          // Don't recurse into nested function expressions (they have their own 'this' scope)
          if (child.type === 'FunctionExpression' || child.type === 'ArrowFunctionExpression' ||
              child.type === 'FunctionDeclaration') continue;
          if (this._bodyUsesThis(child)) return true;
        }
      }
      return false;
    }

    /**
     * Transform spread element: ...array
     */
    transformSpreadElement(node) {
      // In Perl, array flattening is automatic: @array
      // Mark the result as spread so the emitter knows to dereference it
      const result = this.transformExpression(node.argument);
      if (result) result.spread = true;
      return result;
    }

    /**
     * Transform template literal: `Hello ${name}!` -> "Hello $name!"
     */
    transformTemplateLiteral(node) {
      const parts = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        const quasi = node.quasis[i].value.raw;
        if (quasi) {
          parts.push(quasi);
        }
        if (i < node.expressions.length) {
          parts.push(this.transformExpression(node.expressions[i]));
        }
      }

      return new PerlStringInterpolation(parts);
    }

    /**
     * Infer Perl sigil from variable name
     * Note: Be conservative - default to scalar unless clearly an array/hash
     * This avoids issues with singular words that happen to end in 's'
     * (like "positions", "bytes", "status", "class", "process", etc.)
     */
    inferSigilFromName(name) {
      // In JS-to-Perl transpilation, nearly all variables are scalars:
      // - JS arrays become array references ($arr = [...]) not Perl arrays (@arr)
      // - JS objects become hash references ($obj = {...}) not Perl hashes (%obj)
      // - Function parameters are always scalars
      // Name-based guessing (e.g., 'options' → %, 'Algorithms' → @) causes
      // more wrong-sigil errors than it prevents. Always default to $.
      return '$';
    }

    /**
     * Infer sigil from value expression
     * Note: JavaScript arrays are stored as array references in Perl ($arr = [...])
     * not as Perl arrays (@arr = (...)). This allows consistent access with $arr->[$i].
     */
    inferSigilFromValue(valueNode) {
      if (!valueNode) return '$';

      switch (valueNode.type) {
        case 'ObjectExpression':
          // Perl hashes as hash references
          return '$';
        case 'ArrayExpression':
        default:
          // Scalar for everything, including array references
          return '$';
      }
    }

    // ========================[ IL Node Type Transforms ]========================

    /**
     * Transform StringToBytes IL node (OpCodes.AnsiToBytes/Utf8ToBytes)
     * Converts a string to byte array
     */
    transformStringToBytes(node) {
      const arg = node.arguments && node.arguments[0];
      if (!arg) return new PerlArray([]);

      // If it's a literal string, we can convert directly
      if (arg.type === 'Literal' && typeof arg.value === 'string') {
        const str = arg.value;
        if (str === '') return new PerlArray([]);

        // For short strings, inline as byte array: [ord('a'), ord('b'), ...]
        if (str.length <= 16) {
          const bytes = [];
          for (let i = 0; i < str.length; ++i)
            bytes.push(new PerlCall('ord', [PerlLiteral.String(str.charAt(i), "'")]));
          return new PerlArray(bytes);
        }

        // For longer strings: [unpack 'C*', 'string']
        return new PerlArray([
          new PerlCall('unpack', [
            PerlLiteral.String('C*', "'"),
            PerlLiteral.String(str, "'")
          ])
        ]);
      }

      // Dynamic expression: [unpack 'C*', $expr]
      const expr = this.transformExpression(arg);
      return new PerlArray([
        new PerlCall('unpack', [PerlLiteral.String('C*', "'"), expr])
      ]);
    }

    /**
     * Transform BytesToString IL node (OpCodes.BytesToAnsi/BytesToUtf8)
     * Converts byte array to string
     */
    transformBytesToString(node) {
      const arg = node.arguments && node.arguments[0];
      if (!arg) return PerlLiteral.String('', "'");

      // pack('C*', @{$arr}) - converts array of bytes to string
      const expr = this.transformExpression(arg);
      return new PerlCall('pack', [
        PerlLiteral.String('C*', "'"),
        new PerlUnaryExpression('@', expr, true)
      ]);
    }

    /**
     * Transform HexDecode IL node (OpCodes.Hex8ToBytes)
     * Converts hex string to byte array
     */
    transformHexDecode(node) {
      const arg = node.arguments && node.arguments[0];
      if (!arg) return new PerlArray([]);

      // If it's a literal hex string, we can convert directly
      if (arg.type === 'Literal' && typeof arg.value === 'string') {
        const hex = arg.value;
        if (hex === '') return new PerlArray([]);

        // Use pack to decode hex: [unpack 'C*', pack 'H*', 'hexstring']
        return new PerlArray([
          new PerlCall('unpack', [
            PerlLiteral.String('C*', "'"),
            new PerlCall('pack', [
              PerlLiteral.String('H*', "'"),
              PerlLiteral.String(hex, "'")
            ])
          ])
        ]);
      }

      // Dynamic expression
      const expr = this.transformExpression(arg);
      return new PerlArray([
        new PerlCall('unpack', [
          PerlLiteral.String('C*', "'"),
          new PerlCall('pack', [PerlLiteral.String('H*', "'"), expr])
        ])
      ]);
    }

    /**
     * Transform PackBytes IL node (OpCodes.Pack16BE/LE, Pack32BE/LE, Pack64BE/LE)
     * Packs values into byte array
     */
    transformPackBytes(node) {
      const args = node.arguments || [];
      const bits = node.bits || 32;
      const isBig = node.endian === 'big';

      // Check for compile-time constant: PackBytes(SpreadElement(HexDecode("...")))
      if (args.length === 1 && args[0].type === 'SpreadElement') {
        const spreadArg = args[0].argument;
        if (spreadArg && (spreadArg.type === 'HexDecode' || spreadArg.ilNodeType === 'HexDecode')) {
          const hexArg = spreadArg.arguments?.[0];
          if (hexArg && hexArg.type === 'Literal' && typeof hexArg.value === 'string') {
            const hexStr = hexArg.value;
            const intValue = parseInt(hexStr, 16);
            if (!isNaN(intValue)) {
              // Return as hex literal for readability
              return PerlLiteral.Hex(intValue);
            }
          }
        }
      }

      // Transform arguments
      const transformedArgs = args.map(a => this.transformExpression(a));

      // Perl pack format codes:
      // 16-bit: n (big), v (little)
      // 32-bit: N (big), V (little)
      // 64-bit: Q> (big), Q< (little)
      let format;
      switch (bits) {
        case 16: format = isBig ? 'n' : 'v'; break;
        case 32: format = isBig ? 'N' : 'V'; break;
        case 64: format = isBig ? 'Q>' : 'Q<'; break;
        default: format = isBig ? 'N' : 'V'; break;
      }

      // Pack bytes into integer: unpack('N', pack('C4', @bytes))
      // This returns a scalar integer value
      return new PerlCall('unpack', [
        PerlLiteral.String(format, "'"),
        new PerlCall('pack', [PerlLiteral.String('C' + (bits / 8), "'"), ...transformedArgs])
      ]);
    }

    /**
     * Transform UnpackBytes IL node (OpCodes.Unpack16BE/LE, Unpack32BE/LE, Unpack64BE/LE)
     * Converts an integer to a byte array
     * e.g., OpCodes.Unpack32BE(0x12345678) -> [0x12, 0x34, 0x56, 0x78]
     */
    transformUnpackBytes(node) {
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      const bits = node.bits || 32;
      const isBig = node.endian === 'big';
      const numBytes = bits / 8;

      let format;
      switch (bits) {
        case 16: format = isBig ? 'n' : 'v'; break;
        case 32: format = isBig ? 'N' : 'V'; break;
        case 64: format = isBig ? 'Q>' : 'Q<'; break;
        default: format = isBig ? 'N' : 'V'; break;
      }

      // Convert integer to bytes: [unpack('C4', pack('N', $int))]
      // This takes an integer and returns an array of bytes
      const intArg = args[0];
      const packCall = new PerlCall('pack', [
        PerlLiteral.String(format, "'"),
        intArg
      ]);

      return new PerlArray([
        new PerlCall('unpack', [
          PerlLiteral.String('C' + numBytes, "'"),
          packCall
        ])
      ]);
    }

    /**
     * Transform ArrayXor IL node (OpCodes.XorArrays)
     * XOR two byte arrays element-wise
     */
    transformArrayXor(node) {
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      if (args.length < 2) return new PerlArray([]);

      // [map { $a->[$_] ^ $b->[$_] } 0..$#{$a}]
      // But we'll use a cleaner approach with zip-style iteration
      // For now, generate a do block:
      // do { my @r; for my $i (0..$#{$a}) { push @r, $a->[$i] ^ $b->[$i] } \@r }
      this.addRequiredModule('POSIX');

      const arr1 = args[0];
      const arr2 = args[1];

      // Generate inline: [map { ${$arr1}[$_] ^ ${$arr2}[$_] } 0..$#{$arr1}]
      return new PerlArray([
        new PerlCall('map', [
          new PerlBlock([
            new PerlExpressionStatement(
              new PerlBinaryExpression(
                new PerlSubscript(arr1, new PerlIdentifier('_', '$'), 'array'),
                '^',
                new PerlSubscript(arr2, new PerlIdentifier('_', '$'), 'array')
              )
            )
          ]),
          new PerlBinaryExpression(
            PerlLiteral.Number(0),
            '..',
            new PerlUnaryExpression('$#', arr1, true)
          )
        ])
      ]);
    }

    /**
     * Transform ArrayClear IL node (OpCodes.ClearArray)
     * Clear/reset an array
     */
    transformArrayClear(node) {
      const arg = node.arguments && node.arguments[0];
      if (!arg) return new PerlIdentifier('undef');

      const arr = this.transformExpression(arg);
      // Wrap in do block so it's safe in expression context (e.g., $x && ClearArray)
      return new PerlRawCode(`do { @{${arr}} = () }`);
    }

    /**
     * Transform ArrayForEach IL node (array.forEach callback)
     */
    transformArrayForEach(node) {
      const arr = this.transformExpression(node.array);
      const callback = node.callback;

      // Get callback parameter names
      let paramName = 'x';
      let indexName = null;
      if (callback.params && callback.params.length > 0) {
        paramName = callback.params[0].name || 'x';
        if (callback.params.length > 1)
          indexName = callback.params[1].name;
      }

      this.registerVariableType(paramName, '$');

      // Transform callback body
      const bodyStmts = callback.body.type === 'BlockStatement'
        ? callback.body.body.map(s => this.transformStatement(s)).filter(s => s !== null)
        : [new PerlExpressionStatement(this.transformExpression(callback.body))];

      // If index parameter is used, generate a C-style for loop
      if (indexName) {
        this.registerVariableType(indexName, '$');
        const arrDeref = this.wrapArrayDeref(arr);

        // Build loop body: my $elem = $arr->[$idx]; <original body stmts>
        const loopBodyStatements = [
          new PerlVarDeclaration('my', paramName, '$',
            new PerlSubscript(arr, new PerlIdentifier(indexName, '$'), 'array')),
          ...bodyStmts
        ];

        const forInit = new PerlVarDeclaration('my', indexName, '$', PerlLiteral.Number(0));
        const forCond = new PerlBinaryExpression(
          new PerlIdentifier(indexName, '$'),
          '<',
          new PerlCall('scalar', [arrDeref])
        );
        const forIncr = new PerlUnaryExpression('++', new PerlIdentifier(indexName, '$'), false);

        const forLoop = new PerlFor();
        forLoop.isCStyle = true;
        forLoop.init = forInit;
        forLoop.condition = forCond;
        forLoop.increment = forIncr;
        forLoop.body = new PerlBlock(loopBodyStatements);
        return forLoop;
      }

      // Simple foreach loop (no index)
      return new PerlFor(
        '$' + paramName,
        new PerlUnaryExpression('@', arr, true),
        new PerlBlock(bodyStmts)
      );
    }

    /**
     * Transform ArrayMap IL node (array.map callback)
     */
    transformArrayMap(node) {
      const arr = this.transformExpression(node.array);
      const arrDeref = this.wrapArrayDeref(arr);  // Use helper to avoid @keys() issue
      const callback = node.callback;

      // Handle callbacks that are identifiers (like Number, String, Boolean)
      if (callback.type === 'Identifier') {
        const builtinMapping = {
          'Number': '0 + $_',          // Numeric context
          'String': '"$_"',            // String interpolation
          'Boolean': '!!$_',           // Boolean context
          'parseInt': 'int($_)',       // Integer conversion
          'parseFloat': '0 + $_'       // Float conversion
        };
        const perlExpr = builtinMapping[callback.name];
        if (perlExpr) {
          const mapBody = new PerlBlock([
            new PerlExpressionStatement(new PerlIdentifier(perlExpr, ''))
          ]);
          return new PerlArray([
            new PerlCall('map', [mapBody, arrDeref])
          ]);
        }
        // Unknown function - call it with $_
        const mapBody = new PerlBlock([
          new PerlExpressionStatement(new PerlCall(this.toSnakeCase(callback.name), [new PerlIdentifier('_', '$')]))
        ]);
        return new PerlArray([
          new PerlCall('map', [mapBody, arrDeref])
        ]);
      }

      // Handle MemberExpression callbacks (like Math.floor)
      if (callback.type === 'MemberExpression' && !callback.body) {
        const funcExpr = this.transformExpression(callback);
        const mapBody = new PerlBlock([
          new PerlExpressionStatement(new PerlCall(funcExpr, [new PerlIdentifier('_', '$')]))
        ]);
        return new PerlArray([
          new PerlCall('map', [mapBody, arrDeref])
        ]);
      }

      // Get callback parameter names
      let paramName = '_';
      let indexName = null;
      if (callback.params && callback.params.length > 0) {
        paramName = callback.params[0].name || '_';
        if (callback.params.length > 1) {
          indexName = callback.params[1].name;
        }
      }

      // For map, we use Perl's map { } @arr
      // If param is $_, we can use implicit (unless we need an index)
      const useImplicit = paramName === '_' && !indexName;

      // If index is used, we need a different approach:
      // Use for loop with index counter instead of map
      if (indexName) {
        // Convert to: do { my @_result; for (my $idx = 0; $idx < scalar(@arr); $idx++) { my $elem = $arr->[$idx]; push @_result, <expr>; } \@_result }
        this.registerVariableType(paramName, '$');
        this.registerVariableType(indexName, '$');

        const resultVar = '_map_result_' + (this.mapCounter || 0);
        this.mapCounter = (this.mapCounter || 0) + 1;

        let bodyExpr;
        if (callback.body && callback.body.type === 'BlockStatement') {
          // Block body - transform all statements
          const bodyStmts = callback.body.body.map(s => this.transformStatement(s));
          bodyExpr = bodyStmts.length > 0 ? bodyStmts[bodyStmts.length - 1] : new PerlIdentifier('_', '$');
        } else if (callback.body) {
          bodyExpr = new PerlExpressionStatement(this.transformExpression(callback.body));
        } else {
          bodyExpr = new PerlExpressionStatement(new PerlIdentifier('_', '$'));
        }

        // Build loop body: my $elem = $arr->[$idx]; push @result, expr
        // Skip declaring $_ since it's a special variable in Perl
        const loopBodyStatements = [];
        if (paramName !== '_') {
          loopBodyStatements.push(
            new PerlVarDeclaration('my', paramName, '$',
              new PerlSubscript(arr, new PerlIdentifier(indexName, '$'), 'array'))
          );
        }
        loopBodyStatements.push(
          new PerlCall('push', [
            new PerlIdentifier(resultVar, '@'),
            bodyExpr.expression || bodyExpr
          ])
        );
        const loopBody = new PerlBlock(loopBodyStatements);

        // Build for loop: for (my $idx = 0; $idx < scalar(@arr); $idx++)
        const forInit = new PerlVarDeclaration('my', indexName, '$', PerlLiteral.Number(0));
        const forCond = new PerlBinaryExpression(
          new PerlIdentifier(indexName, '$'),
          '<',
          new PerlCall('scalar', [arrDeref])
        );
        const forIncr = new PerlUnaryExpression('++', new PerlIdentifier(indexName, '$'), false);

        const forLoop = new PerlFor();
        forLoop.isCStyle = true;
        forLoop.init = forInit;
        forLoop.condition = forCond;
        forLoop.increment = forIncr;
        forLoop.body = loopBody;

        // Wrap in do block: do { my @result; for ... ; \@result }
        return new PerlCall('do', [new PerlBlock([
          new PerlVarDeclaration('my', resultVar, '@', null),
          forLoop,
          new PerlUnaryExpression('\\', new PerlIdentifier(resultVar, '@'), true)
        ])]);
      }

      let mapBody;
      if (callback.body && callback.body.type === 'BlockStatement') {
        // Block body - need to evaluate all statements and return last
        const stmts = callback.body.body.map(s => this.transformStatement(s));
        if (!useImplicit) {
          // Alias $_ to named param: my $param = $_;
          this.registerVariableType(paramName, '$');
          stmts.unshift(new PerlVarDeclaration('my', paramName, '$', new PerlIdentifier('_', '$')));
        }
        mapBody = new PerlBlock(stmts);
      } else if (callback.body) {
        // Expression body
        if (!useImplicit) {
          // Need to alias: map { my $x = $_; expr } @arr
          this.registerVariableType(paramName, '$');
          mapBody = new PerlBlock([
            new PerlVarDeclaration('my', paramName, '$', new PerlIdentifier('_', '$')),
            new PerlExpressionStatement(this.transformExpression(callback.body))
          ]);
        } else {
          mapBody = new PerlBlock([
            new PerlExpressionStatement(this.transformExpression(callback.body))
          ]);
        }
      } else {
        // No body - return $_ unchanged
        mapBody = new PerlBlock([
          new PerlExpressionStatement(new PerlIdentifier('_', '$'))
        ]);
      }

      return new PerlArray([
        new PerlCall('map', [mapBody, arrDeref])
      ]);
    }

    /**
     * Transform ArrayFilter IL node (array.filter callback)
     */
    transformArrayFilter(node) {
      const arr = this.transformExpression(node.array);
      const arrDeref = this.wrapArrayDeref(arr);  // Use helper to avoid @keys() issue
      const callback = node.callback;

      // Handle callbacks that are identifiers (like Number, Boolean)
      if (callback.type === 'Identifier') {
        const builtinMapping = {
          'Number': '$_',              // Truthy check on numeric value
          'Boolean': '$_',             // Truthy check
          'String': '$_',              // Truthy check on string value
          'isFinite': 'defined($_) && $_ =~ /^-?\\d+(\\.\\d+)?$/',
          'isNaN': '!defined($_) || $_ !~ /^-?\\d+(\\.\\d+)?$/'
        };
        const perlExpr = builtinMapping[callback.name];
        if (perlExpr) {
          const grepBody = new PerlBlock([
            new PerlExpressionStatement(new PerlIdentifier(perlExpr, ''))
          ]);
          return new PerlArray([
            new PerlCall('grep', [grepBody, arrDeref])
          ]);
        }
        // Unknown function - call it with $_
        const grepBody = new PerlBlock([
          new PerlExpressionStatement(new PerlCall(this.toSnakeCase(callback.name), [new PerlIdentifier('_', '$')]))
        ]);
        return new PerlArray([
          new PerlCall('grep', [grepBody, arrDeref])
        ]);
      }

      // Handle MemberExpression callbacks (like Math.floor)
      if (callback.type === 'MemberExpression' && !callback.body) {
        const funcExpr = this.transformExpression(callback);
        const grepBody = new PerlBlock([
          new PerlExpressionStatement(new PerlCall(funcExpr, [new PerlIdentifier('_', '$')]))
        ]);
        return new PerlArray([
          new PerlCall('grep', [grepBody, arrDeref])
        ]);
      }

      // Get callback parameter names
      let paramName = '_';
      let indexName = null;
      let arrayName = null;
      if (callback.params && callback.params.length > 0) {
        paramName = callback.params[0].name || '_';
        if (callback.params.length > 1) {
          indexName = callback.params[1].name;
        }
        if (callback.params.length > 2) {
          arrayName = callback.params[2].name;
        }
      }

      // If index or array parameter is used, we need a for loop instead of grep
      if (indexName || arrayName) {
        this.registerVariableType(paramName, '$');
        this.registerVariableType(indexName, '$');
        // Array parameter is passed as a reference ($), not an array (@)
        if (arrayName) this.registerVariableType(arrayName, '$');

        const resultVar = '_filter_result_' + (this.filterCounter || 0);
        this.filterCounter = (this.filterCounter || 0) + 1;

        // Build the condition expression from callback body
        let conditionExpr;
        if (callback.body && callback.body.type === 'BlockStatement') {
          // Transform block - take the last expression as condition
          const transformed = callback.body.body.map(s => this.transformStatement(s));
          conditionExpr = transformed.length > 0 ? transformed[transformed.length - 1] : new PerlIdentifier('_', '$');
        } else if (callback.body) {
          conditionExpr = this.transformExpression(callback.body);
        } else {
          conditionExpr = new PerlIdentifier('_', '$');
        }

        // Build loop body statements
        const loopBodyStatements = [];

        // Declare element variable if not $_
        if (paramName !== '_') {
          loopBodyStatements.push(
            new PerlVarDeclaration('my', paramName, '$',
              new PerlSubscript(arr, new PerlIdentifier(indexName, '$'), 'array'))
          );
        }

        // Declare array variable if used (pass array reference)
        if (arrayName) {
          loopBodyStatements.push(
            new PerlVarDeclaration('my', arrayName, '$', arr)
          );
        }

        // Add conditional push - extract expression from conditionExpr
        const pushCondition = conditionExpr.expression || conditionExpr;
        const elementToPush = paramName !== '_'
          ? new PerlIdentifier(paramName, '$')
          : new PerlSubscript(arr, new PerlIdentifier(indexName, '$'), 'array');
        loopBodyStatements.push(
          new PerlIf(
            pushCondition,
            new PerlBlock([
              new PerlCall('push', [
                new PerlIdentifier(resultVar, '@'),
                elementToPush
              ])
            ])
          )
        );

        const loopBody = new PerlBlock(loopBodyStatements);

        // Create for loop: for (my $i = 0; $i < scalar(@arr); $i++)
        const forInit = new PerlVarDeclaration('my', indexName, '$', PerlLiteral.Number(0));
        const forCond = new PerlBinaryExpression(
          new PerlIdentifier(indexName, '$'),
          '<',
          new PerlCall('scalar', [arrDeref])
        );
        const forIncr = new PerlUnaryExpression('++', new PerlIdentifier(indexName, '$'), false);

        const forLoop = new PerlFor();
        forLoop.isCStyle = true;
        forLoop.init = forInit;
        forLoop.condition = forCond;
        forLoop.increment = forIncr;
        forLoop.body = loopBody;

        // Return: do { my @result; for (...) {...} \@result }
        return new PerlCall('do', [new PerlBlock([
          new PerlVarDeclaration('my', resultVar, '@', null),
          forLoop,
          new PerlUnaryExpression('\\', new PerlIdentifier(resultVar, '@'), true)
        ])]);
      }

      const useImplicit = paramName === '_';

      let grepBody;
      if (callback.body && callback.body.type === 'BlockStatement') {
        const stmts = callback.body.body.map(s => this.transformStatement(s));
        if (!useImplicit) {
          this.registerVariableType(paramName, '$');
          stmts.unshift(new PerlVarDeclaration('my', paramName, '$', new PerlIdentifier('_', '$')));
        }
        grepBody = new PerlBlock(stmts);
      } else if (callback.body) {
        if (!useImplicit) {
          this.registerVariableType(paramName, '$');
          grepBody = new PerlBlock([
            // Shadow the callback parameter with a local copy of $_
            new PerlVarDeclaration('my', paramName, '$', new PerlIdentifier('_', '$')),
            new PerlExpressionStatement(this.transformExpression(callback.body))
          ]);
        } else {
          grepBody = new PerlBlock([
            new PerlExpressionStatement(this.transformExpression(callback.body))
          ]);
        }
      } else {
        // No body - use $_ as truthy test
        grepBody = new PerlBlock([
          new PerlExpressionStatement(new PerlIdentifier('_', '$'))
        ]);
      }

      return new PerlArray([
        new PerlCall('grep', [grepBody, arrDeref])
      ]);
    }

    /**
     * Transform RotateLeft/RotateRight IL node
     * Bit rotation operations
     */
    transformRotation(node) {
      const value = this.transformExpression(node.value);
      const amount = this.transformExpression(node.amount);
      const bits = node.bits || 32;
      const isLeft = node.type === 'RotateLeft';

      // Rotation formula:
      // Left:  ((val << n) | (val >> (bits - n))) & mask
      // Right: ((val >> n) | (val << (bits - n))) & mask
      const mask = bits === 64 ? '0xFFFFFFFFFFFFFFFF' :
                   bits === 32 ? '0xFFFFFFFF' :
                   bits === 16 ? '0xFFFF' :
                   bits === 8 ? '0xFF' : '0xFFFFFFFF';

      const bitsMinusN = new PerlBinaryExpression(
        PerlLiteral.Number(bits),
        '-',
        amount
      );

      let shift1, shift2;
      if (isLeft) {
        shift1 = new PerlBinaryExpression(value, '<<', amount);
        shift2 = new PerlBinaryExpression(value, '>>', bitsMinusN);
      } else {
        shift1 = new PerlBinaryExpression(value, '>>', amount);
        shift2 = new PerlBinaryExpression(value, '<<', bitsMinusN);
      }

      const orExpr = new PerlBinaryExpression(shift1, '|', shift2);
      return new PerlBinaryExpression(
        new PerlGrouped(orExpr),
        '&',
        new PerlIdentifier(mask, '')
      );
    }

    /**
     * Register a variable's type (sigil)
     */
    registerVariableType(name, sigil) {
      this.variableTypes.set(name, sigil);
    }

    /**
     * Check if expression is in string context
     */
    isStringContext(left, right) {
      // Simple heuristic: if either operand is a string literal, treat as string
      if (left && left.type === 'Literal' && typeof left.value === 'string') return true;
      if (right && right.type === 'Literal' && typeof right.value === 'string') return true;

      // Check IL AST resultType for string types
      const stringTypes = ['string', 'String', 'char', 'Char'];
      if (left && left.resultType && stringTypes.includes(left.resultType)) return true;
      if (right && right.resultType && stringTypes.includes(right.resultType)) return true;

      // Check for string method calls that return strings
      const stringMethods = ['toUpperCase', 'toLowerCase', 'toString', 'trim', 'substr', 'substring',
                             'charAt', 'charCodeAt', 'slice', 'split', 'join', 'replace', 'concat'];
      if (right && right.type === 'CallExpression' && right.callee?.property) {
        const methodName = right.callee.property.name || right.callee.property.value;
        if (stringMethods.includes(methodName)) return true;
      }

      // Check for Identifier with known string variable names
      if (left && left.type === 'MemberExpression' && !left.computed) {
        const propName = left.property?.name || left.property?.value;
        // Common string property names
        if (['data', 'text', 'message', 'str', 'string', 'name', 'value', 'char'].includes(propName))
          return true;
      }

      return false;
    }

    /**
     * Check if a node represents a string type
     * Uses resultType when available, falls back to conservative heuristics
     */
    isStringType(node) {
      if (!node) return false;

      // Check IL AST resultType - this is the most reliable indicator
      if (node.resultType === 'string' || node.resultType === 'String')
        return true;

      // Check for string literals
      if (node.type === 'Literal' && typeof node.value === 'string')
        return true;

      // Check IL StringSubstring node
      if (node.type === 'StringSubstring' || node.ilNodeType === 'StringSubstring')
        return true;

      // Check for string method calls that return strings
      // Only check method results when the type is not otherwise known
      const stringMethods = ['substring', 'substr', 'toUpperCase', 'toLowerCase',
                             'trim', 'trimStart', 'trimEnd', 'charAt', 'concat', 'repeat',
                             'replace', 'replaceAll', 'padStart', 'padEnd'];
      if (node.type === 'CallExpression' && node.callee?.property) {
        const methodName = node.callee.property.name || node.callee.property.value;
        if (stringMethods.includes(methodName)) return true;
      }

      // Note: We intentionally do NOT use variable name heuristics here
      // because they are too unreliable. Variables like 'data', 'result', etc.
      // are commonly used for both strings and arrays in crypto algorithms.
      // Only use explicit resultType from IL analysis.

      return false;
    }

    /**
     * Check if subscript should be array-style (numeric index) vs hash-style (string key)
     * @param {Object} objectNode - The object being indexed
     * @param {Object} propertyNode - The index/key being used
     */
    isArrayContext(objectNode, propertyNode = null) {
      // If we have a property node, check if it's numeric (array) vs string (hash)
      if (propertyNode) {
        // Check IL AST resultType - numeric types indicate array access
        if (propertyNode.resultType) {
          const numericTypes = ['int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64',
                                'float32', 'float64', 'number', 'int', 'uint', 'byte', 'short', 'long'];
          if (numericTypes.includes(propertyNode.resultType))
            return true;
        }

        // Numeric literals -> array access
        if (propertyNode.type === 'Literal' && typeof propertyNode.value === 'number')
          return true;

        // Variables that look like loop indices -> likely array access
        if (propertyNode.type === 'Identifier') {
          const name = propertyNode.name;
          // Common loop/index variable patterns (i, j, k, n, m, t, x, y, p, q, r, e) and numbered variants (i0, i1, etc.)
          if (/^[ijknmtxypqre]\d*$/.test(name) || /Index$/.test(name) || /^idx/.test(name))
            return true;
        }

        // MemberExpression accessing index-like properties (e.g., this.i, this.j)
        if (propertyNode.type === 'MemberExpression' && propertyNode.property) {
          const propName = propertyNode.property.name || propertyNode.property.value;
          if (propName && /^[ijknm]$/.test(propName))
            return true;
        }

        // IL node types that represent numeric indices
        if (propertyNode.type === 'ThisPropertyAccess') {
          const propName = propertyNode.property;
          if (propName && /^[ijknm]$/.test(propName))
            return true;
        }

        // Binary expressions with numeric operations -> array access
        // e.g., this.digits[this.digits.length - 1 - i]
        if (propertyNode.type === 'BinaryExpression') {
          const op = propertyNode.operator;
          // Arithmetic operators indicate numeric index
          if (['+', '-', '*', '/', '%', '<<', '>>', '>>>', '&', '|', '^'].includes(op))
            return true;
        }

        // Unary expressions on numeric values -> array access
        // e.g., arr[~i] or arr[-1]
        if (propertyNode.type === 'UnaryExpression') {
          const op = propertyNode.operator;
          if (['-', '+', '~'].includes(op))
            return true;
        }

        // Computed MemberExpression as index -> array access
        // e.g., F0[xx[i1]] where xx[i1] returns a numeric index
        if (propertyNode.type === 'MemberExpression' && propertyNode.computed)
          return true;

        // String literals -> hash access
        if (propertyNode.type === 'Literal' && typeof propertyNode.value === 'string')
          return false;
      }

      // Check variable type registration
      if (objectNode.type === 'Identifier') {
        const sigil = this.variableTypes.get(objectNode.name);
        if (sigil === '@') return true;

        // Check if variable name suggests it's an array
        const name = objectNode.name.toLowerCase();
        if (/^(data|bytes|buffer|array|list|items|elements|bits|digits|input|output|result|block|state|key|iv|nonce|xx|yy|zz|ww|tt|ss|aa|bb|cc|dd|ee|ff|gg|hh|words|v|w|temp|tmp|out)$/.test(name))
          return true;
        // S-box and lookup table names (common in crypto algorithms)
        if (/^(sbox|s[0-9]*|f[0-9]*|p[0-9]*|k[0-9]*|t[0-9]*|l[0-9]*|r[0-9]*|delta|sigma|rcon|round|sub|inv)$/i.test(objectNode.name))
          return true;
      }

      return false;
    }

    /**
     * Get the return value from an IIFE if it has one
     */
    getIIFEReturnValue(callNode) {
      const func = callNode.callee;
      if (!func.body || func.body.type !== 'BlockStatement') {
        // Arrow function with expression body - the body IS the return value
        if (func.body) return func.body;
        return null;
      }

      // Look for a return statement at the end of the function body
      const body = func.body.body;
      if (!body || body.length === 0) return null;

      const lastStmt = body[body.length - 1];
      if (lastStmt.type === 'ReturnStatement' && lastStmt.argument)
        return lastStmt.argument;

      return null;
    }
  }

  // Export
  const exports = { PerlTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PerlTransformer = PerlTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
