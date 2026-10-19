/**
 * BasicTransformer.js - IL AST to Basic AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to Basic AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → Basic AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - variant: 'FREEBASIC' | 'VBNET' | 'VB6' | 'VB' | 'VBA' | 'VBSCRIPT' | 'GAMBAS' | 'XOJO'
 *   - useClasses: boolean (generate Class vs Type structures)
 *   - useProperties: boolean (generate Property Get/Set)
 *   - useModules: boolean (wrap in Module vs Class)
 */

(function(global) {
  'use strict';

  // Load dependencies
  let BasicAST;
  if (typeof require !== 'undefined') {
    BasicAST = require('./BasicAST.js');
  } else if (global.BasicAST) {
    BasicAST = global.BasicAST;
  }

  const {
    BasicType, BasicModule, BasicImport, BasicAttribute,
    BasicTypeDeclaration, BasicField, BasicClass, BasicProperty, BasicConstructor,
    BasicFunction, BasicParameter, BasicBlock, BasicDim, BasicAssignment,
    BasicExpressionStatement, BasicReturn, BasicIf, BasicFor, BasicForEach,
    BasicWhile, BasicDoLoop, BasicSelect, BasicCase, BasicTry, BasicCatch,
    BasicExit, BasicContinue, BasicThrow, BasicOnError, BasicLiteral, BasicIdentifier,
    BasicBinaryExpression, BasicUnaryExpression, BasicMemberAccess, BasicIndexAccess,
    BasicCall, BasicMethodCall, BasicNew, BasicArrayLiteral, BasicCast, BasicConditional,
    BasicLambda, BasicAddressOf, BasicTypeOf, BasicWith, BasicComment
  } = BasicAST;

  /**
   * Maps JavaScript/JSDoc types to Basic types
   */
  const TYPE_MAP = {
    // Unsigned integers -> Long (Basic doesn't have unsigned types except in some dialects)
    'uint8': 'Byte', 'byte': 'Byte',
    'uint16': 'Integer', 'ushort': 'Integer', 'word': 'Integer',
    'uint32': 'Long', 'uint': 'Long', 'dword': 'Long',
    'uint64': 'LongLong', 'ulong': 'LongLong', 'qword': 'LongLong',
    // Signed integers
    'int8': 'Byte', 'sbyte': 'Byte',
    'int16': 'Integer', 'short': 'Integer',
    'int32': 'Long', 'int': 'Long',
    'int64': 'LongLong', 'long': 'LongLong',
    // Floating point
    'float': 'Single', 'float32': 'Single',
    'double': 'Double', 'float64': 'Double',
    // JavaScript 'number' in crypto context typically means Long
    'number': 'Long',
    // Other
    'boolean': 'Boolean', 'bool': 'Boolean',
    'string': 'String', 'String': 'String',
    'void': '',
    'object': 'Object',
    'Array': 'Array'
  };

  /**
   * JavaScript AST to Basic AST Transformer
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Add comments. Default: true
   * - variant: string - Basic dialect ('FREEBASIC', 'VBNET', 'VB6', etc.). Default: 'FREEBASIC'
   * - upperCase: boolean - Use uppercase keywords. Default: false
   * - strictTypes: boolean - Use strict type annotations. Default: true
   * - useClasses: boolean - Generate classes vs Types. Default: true
   * - useExceptionHandling: boolean - Use Try/Catch vs On Error. Default: true
   */
  class BasicTransformer {
    constructor(options = {}) {
      this.options = options;
      this.variant = (options.variant || 'FREEBASIC').toUpperCase();
      this.currentClass = null;
      this.variableTypes = new Map();  // Maps variable name -> BasicType
      this.scopeStack = [];
      this.insideStandaloneFunction = false; // For procedural mode: use 'self' instead of 'This'
    }

    /**
     * Convert name to PascalCase (Basic convention for types, functions)
     */
    toPascalCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);

      // Split on underscores and capitalize each part
      const parts = str.split(/[_\s]+/);
      return parts.map(part => {
        if (!part) return '';
        return part.charAt(0).toUpperCase() + part.slice(1);
      }).join('');
    }

    /**
     * Convert name to camelCase (Basic convention for variables)
     */
    toCamelCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);

      const pascal = this.toPascalCase(str);
      return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }

    /**
     * Map JavaScript type string to Basic type
     */
    mapType(typeName) {
      if (!typeName) return BasicType.Long();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return BasicType.Array(elementType);
      }

      const basicTypeName = TYPE_MAP[typeName] || typeName;

      // Map to Basic types
      const typeMap = {
        'Byte': BasicType.Byte(),
        'Integer': BasicType.Integer(),
        'Long': BasicType.Long(),
        'LongLong': BasicType.LongLong(),
        'Single': BasicType.Single(),
        'Double': BasicType.Double(),
        'Boolean': BasicType.Boolean(),
        'String': BasicType.String(),
        'Object': BasicType.Object(),
        'Variant': BasicType.Variant()
      };

      return typeMap[basicTypeName] || new BasicType(basicTypeName);
    }

    /**
     * Register a variable's type in the current scope
     */
    registerVariableType(name, type) {
      this.variableTypes.set(name, type);
    }

    /**
     * Get a registered variable's type
     */
    getVariableType(name) {
      return this.variableTypes.get(name) || null;
    }

    /**
     * Push a new scope
     */
    pushScope() {
      this.scopeStack.push(new Map(this.variableTypes));
    }

    /**
     * Pop scope
     */
    popScope() {
      if (this.scopeStack.length > 0) {
        this.variableTypes = this.scopeStack.pop();
      }
    }

    /**
     * Infer Basic type from variable name pattern
     */
    inferTypeFromName(name) {
      if (!name) return BasicType.Long();

      const lowerName = name.toLowerCase();

      // Byte-related names
      if (lowerName.includes('byte') || lowerName === 'b' || /^b\d$/.test(lowerName)) {
        return BasicType.Byte();
      }

      // Array-related names
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('state')) {
        return BasicType.Array(BasicType.Byte());
      }

      // Integer-related names
      if (lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return BasicType.Integer();
      }

      // Boolean names
      if (lowerName.startsWith('is') || lowerName.startsWith('has') ||
          lowerName.startsWith('can') || lowerName.startsWith('should')) {
        return BasicType.Boolean();
      }

      // String names
      if (lowerName.includes('name') || lowerName.includes('text') ||
          lowerName.includes('str') || lowerName.includes('msg')) {
        return BasicType.String();
      }

      // Default to Long for crypto operations
      return BasicType.Long();
    }

    /**
     * Transform a JavaScript AST to a Basic AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {BasicModule} Basic AST
     */
    transform(jsAst) {
      const module = new BasicModule();

      // Add module comment
      if (this.options.addComments !== false) {
        module.moduleComment = new BasicComment(
          `Generated ${this.variant} code\nThis file was automatically generated from JavaScript AST`,
          false
        );
      }

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, module);
        }
      }

      return module;
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
              this.transformIIFEContent(callee, node.expression, targetModule);
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

      // Try to find the factory function in UMD pattern
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
        if (stmt.type === 'ExpressionStatement') continue;

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

        // Process variable declarations
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

        // Skip ObjectPattern destructuring
        if (decl.id.type === 'ObjectPattern')
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toPascalCase(elem.name);
              const indexExpr = new BasicArrayAccess(sourceExpr, BasicLiteral.Integer(i));
              const dim = new BasicDim(varName, BasicType.Variant(), indexExpr);
              dim.isConst = node.kind === 'const';
              targetModule.declarations.push(dim);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Check if this is an object literal defining a struct/type
        if (decl.init.type === 'ObjectExpression') {
          // Skip - we'll handle these as part of classes
          continue;
        }

        // Handle simple literals as constants
        if (decl.init.type === 'Literal' ||
            decl.init.type === 'ArrayExpression' ||
            decl.init.type === 'UnaryExpression' ||
            decl.init.type === 'BinaryExpression') {
          const dim = new BasicDim(
            this.toPascalCase(name),
            this.inferTypeFromValue(decl.init),
            this.transformExpression(decl.init)
          );
          dim.isConst = node.kind === 'const';
          targetModule.declarations.push(dim);
        }
      }
    }

    /**
     * Infer Basic type from a JavaScript value expression
     */
    inferTypeFromValue(valueNode) {
      if (!valueNode) return BasicType.Long();

      switch (valueNode.type) {
        case 'Literal':
          if (typeof valueNode.value === 'number') {
            if (Number.isInteger(valueNode.value)) {
              if (valueNode.value >= 0 && valueNode.value <= 255) return BasicType.Byte();
              if (valueNode.value >= -32768 && valueNode.value <= 32767) return BasicType.Integer();
              return BasicType.Long();
            }
            return BasicType.Double();
          }
          if (typeof valueNode.value === 'string') return BasicType.String();
          if (typeof valueNode.value === 'boolean') return BasicType.Boolean();
          return BasicType.Long();

        case 'ArrayExpression':
          if (valueNode.elements.length > 0) {
            const elemType = this.inferTypeFromValue(valueNode.elements[0]);
            return BasicType.Array(elemType);
          }
          return BasicType.Array(BasicType.Byte());

        case 'CallExpression':
          // Infer return type from known function names
          return this.inferTypeFromCall(valueNode);

        default:
          return BasicType.Long();
      }
    }

    /**
     * Infer return type from a call expression
     */
    inferTypeFromCall(node) {
      // Get the callee name
      let funcName = '';
      if (node.callee?.type === 'Identifier') {
        funcName = node.callee.name.toLowerCase();
      } else if (node.callee?.type === 'MemberExpression') {
        const objName = node.callee.object?.name?.toLowerCase() || '';
        const methodName = (node.callee.property?.name || node.callee.property?.value || '').toLowerCase();
        funcName = `${objName}.${methodName}`;
      }

      // String-returning functions
      const stringFuncs = [
        'chr', 'chr$', 'string.fromcharcode', 'str', 'str$', 'string', 'string$',
        'left', 'left$', 'right', 'right$', 'mid', 'mid$', 'trim', 'trim$',
        'ltrim', 'ltrim$', 'rtrim', 'rtrim$', 'ucase', 'ucase$', 'lcase', 'lcase$',
        'space', 'space$', 'format', 'format$', 'hex', 'hex$', 'oct', 'oct$', 'bin', 'bin$'
      ];
      if (stringFuncs.includes(funcName))
        return BasicType.String();

      // Integer-returning functions
      const intFuncs = [
        'len', 'asc', 'instr', 'instrrev', 'ubound', 'lbound',
        'cint', 'clng', 'cbyte', 'cshort', 'int', 'fix', 'abs', 'sgn'
      ];
      if (intFuncs.includes(funcName))
        return BasicType.Long();

      // Boolean-returning functions
      const boolFuncs = ['isarray', 'isnumeric', 'isdate', 'isnull', 'isempty', 'isobject'];
      if (boolFuncs.includes(funcName))
        return BasicType.Boolean();

      // Double-returning functions
      const doubleFuncs = [
        'cdbl', 'csng', 'val', 'sin', 'cos', 'tan', 'atn', 'sqr', 'sqrt', 'log', 'exp',
        'math.sin', 'math.cos', 'math.tan', 'math.sqrt', 'math.log', 'math.exp',
        'math.floor', 'math.ceil', 'math.round', 'math.pow', 'math.abs'
      ];
      if (doubleFuncs.includes(funcName))
        return BasicType.Double();

      return BasicType.Long();
    }

    /**
     * Transform a function declaration
     */
    transformFunctionDeclaration(node, targetModule) {
      const funcName = this.toPascalCase(node.id.name);

      // Determine if it's a Sub (void) or Function (returns value)
      const hasReturn = this.hasReturnWithValue(node.body);
      const func = new BasicFunction(funcName, !hasReturn);

      // Infer return type
      if (hasReturn) {
        const returnType = this.inferReturnType(node.body);
        func.returnType = returnType || BasicType.Long();
      }

      // Parameters
      if (node.params) {
        node.params.forEach((param, index) => {
          const rawName = this._paramName(param, index);
          const paramName = this.toCamelCase(rawName);
          const paramType = param.typeAnnotation ?
            this.mapType(param.typeAnnotation) :
            this.inferTypeFromName(rawName);
          const basicParam = new BasicParameter(paramName, paramType);
          func.parameters.push(basicParam);

          this.registerVariableType(rawName, paramType);
        });
      }

      // Body
      if (node.body) {
        func.body = this.transformBlockStatement(node.body);
      }

      targetModule.functions.push(func);
    }

    /**
     * Resolve a usable parameter name from any parameter node shape
     * (plain Identifier, default value, rest, or destructuring pattern).
     * Basic has no destructuring, so patterns fall back to a positional name.
     */
    _paramName(param, index) {
      if (!param) return `arg${index || 0}`;
      switch (param.type) {
        case 'Identifier':
          return param.name;
        case 'AssignmentPattern': // (x = default)
          return this._paramName(param.left, index);
        case 'RestElement': // (...rest)
          return this._paramName(param.argument, index);
        case 'ObjectPattern':
        case 'ArrayPattern':
        default:
          return param.name || `arg${index || 0}`;
      }
    }

    /**
     * Transform a class declaration to a Basic Class or Type
     */
    transformClassDeclaration(node, targetModule) {
      const className = this.toPascalCase(node.id.name);

      const useClasses = this.options.useClasses !== false &&
        ['VBNET', 'FREEBASIC', 'VB6', 'GAMBAS', 'XOJO'].includes(this.variant);

      if (useClasses) {
        const cls = new BasicClass(className);
        const prevClass = this.currentClass;
        this.currentClass = cls;

        // Handle inheritance (skip if skipInheritance option is set)
        if (node.superClass && !this.options.skipInheritance) {
          const baseClassName = node.superClass.type === 'Identifier' ?
            this.toPascalCase(node.superClass.name) :
            this.transformExpression(node.superClass);
          cls.baseClass = typeof baseClassName === 'string' ? baseClassName : baseClassName.toString();
        }

        // Handle both class body structures
        const members = node.body?.body || node.body || [];

        if (members && members.length > 0) {
          for (const member of members) {
            if (member.type === 'MethodDefinition') {
              if (member.kind === 'constructor') {
                // Constructor
                const { fields, ctor } = this.extractFieldsFromConstructor(member);
                cls.fields.push(...fields);
                cls.constructors.push(ctor);
              } else {
                // Regular method
                const method = this.transformMethodDefinition(member);
                cls.methods.push(method);
              }
            } else if (member.type === 'PropertyDefinition') {
              // Field
              const field = this.transformPropertyDefinition(member);
              cls.fields.push(field);
            } else if (member.type === 'StaticBlock') {
              // ES2022 static block -> BASIC module-level statements
              const initStatements = this.transformStaticBlock(member);
              if (initStatements) {
                cls.staticInitStatements = cls.staticInitStatements || [];
                cls.staticInitStatements.push(...initStatements);
              }
            }
          }
        }

        this.currentClass = prevClass;
        targetModule.declarations.push(cls);
      } else {
        // Use Type/Structure for non-OOP dialects (procedural style)
        const typeDecl = new BasicTypeDeclaration(className);
        const standaloneFunctions = [];

        const members = node.body?.body || node.body || [];
        if (members && members.length > 0) {
          for (const member of members) {
            if (member.type === 'MethodDefinition') {
              if (member.kind === 'constructor') {
                // Extract fields from constructor
                const { fields } = this.extractFieldsFromConstructor(member);
                typeDecl.fields.push(...fields);
                // Create constructor function with 'Create' name (avoids conflict with 'init' method)
                const initFunc = this.transformMethodToStandaloneFunction(member, className, 'Create');
                if (initFunc) standaloneFunctions.push(initFunc);
              } else {
                // Convert method to standalone function
                const func = this.transformMethodToStandaloneFunction(member, className);
                if (func) standaloneFunctions.push(func);
              }
            } else if (member.type === 'PropertyDefinition') {
              const field = this.transformPropertyDefinitionToField(member);
              typeDecl.fields.push(field);
            } else if (member.type === 'StaticBlock') {
              // ES2022 static block -> BASIC module-level statements
              const initStatements = this.transformStaticBlock(member);
              if (initStatements) {
                typeDecl.staticInitStatements = typeDecl.staticInitStatements || [];
                typeDecl.staticInitStatements.push(...initStatements);
              }
            }
          }
        }

        targetModule.types.push(typeDecl);
        // Add standalone functions after the type
        for (const func of standaloneFunctions) {
          targetModule.declarations.push(func);
        }
      }
    }

    /**
     * Transform a method to a standalone function (for procedural mode)
     */
    transformMethodToStandaloneFunction(node, className, overrideName = null) {
      const methodName = overrideName || this.toPascalCase(node.key.name);
      const funcName = className + '_' + methodName;

      // Determine if Sub or Function
      const hasReturn = node.value && node.value.body ?
        this.hasReturnWithValue(node.value.body) : false;

      const func = new BasicFunction(funcName, !hasReturn);
      func.isShared = node.static || false;

      // For functions, set a default return type (Long for FreeBASIC compatibility)
      if (hasReturn) {
        func.returnType = new BasicType('Long');
      }

      // Add 'self' parameter as first parameter for instance methods
      if (!node.static) {
        func.parameters.push(new BasicParameter('self', new BasicType(className)));
      }

      // Parameters
      if (node.value && node.value.params) {
        node.value.params.forEach((param, index) => {
          const rawName = this._paramName(param, index);
          const paramName = this.toCamelCase(rawName);
          const paramType = this.inferTypeFromName(rawName);
          func.parameters.push(new BasicParameter(paramName, paramType));
          this.registerVariableType(rawName, paramType);
        });
      }

      // Body - transform and replace This/Me references with self
      if (node.value && node.value.body) {
        const body = new BasicBlock();
        const statements = node.value.body.body || [];

        // Set flag so This/Me gets replaced with 'self'
        const prevFlag = this.insideStandaloneFunction;
        this.insideStandaloneFunction = !node.static; // Only for instance methods

        for (const stmt of statements) {
          // Skip ParentConstructorCall in procedural mode
          if (stmt.type === 'ExpressionStatement' &&
              stmt.expression?.type === 'ParentConstructorCall') {
            continue;
          }
          // Skip framework metadata assignments in procedural mode
          if (this.isFrameworkMetadataAssignment(stmt)) {
            continue;
          }
          const transformed = this.transformStatement(stmt);
          if (transformed) {
            if (Array.isArray(transformed))
              body.statements.push(...transformed);
            else
              body.statements.push(transformed);
          }
        }

        this.insideStandaloneFunction = prevFlag; // Restore
        func.body = body;
      }

      return func;
    }

    /**
     * Check if statement is a framework metadata assignment that should be skipped
     * Examples: this.category = categoryType.HASH, this.documentation = [LinkItem(...)]
     */
    isFrameworkMetadataAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;

      // Check if it's a this.property assignment
      const left = expr.left;
      let propName = null;
      if (left.type === 'ThisPropertyAccess') {
        propName = left.property;
      } else if (left.type === 'MemberExpression' && left.object.type === 'ThisExpression') {
        propName = left.property.name || left.property.value;
      }
      if (!propName) return false;

      // List of framework metadata properties to skip
      const metadataProps = [
        'category', 'securityStatus', 'complexity', 'country',
        'documentation', 'references', 'tests', 'inventor',
        'year', 'description', 'name', 'subCategory',
        'supportedKeySizes', 'supportedBlockSizes', 'supportedOutputSizes',
        'notes', 'algorithm', 'icon', 'variants', 'history',
        'vulnerabilities', 'applications', 'standardizedIn',
        'knownVulnerabilities', 'testVectors', 'checksumSize',
        'supportedIvSizes', 'supportedNonceSizes', 'supportedTagSizes',
        'blockSize', 'outputSize', 'stateSize', 'rounds', 'keySize',
        'minKeySize', 'maxKeySize', 'defaultKeySize', 'ivSize',
        'tagSize', 'nonceSize', 'wordSize', 'parallelism',
        'memoryCost', 'timeCost', 'saltSize', 'hashSize',
        'padding', 'mode', 'feedbackSize', 'alphabetSize'
      ];

      const propLower = propName.toLowerCase();
      if (metadataProps.some(p => p.toLowerCase() === propLower)) {
        return true;
      }

      // Also check if the right side uses framework enums
      const right = expr.right;
      if (right.type === 'MemberExpression' || right.type === 'StaticPropertyAccess') {
        const objName = right.object?.name || right.object;
        const frameworkEnums = ['categorytype', 'securitystatus', 'complexitytype', 'countrycode'];
        if (typeof objName === 'string' && frameworkEnums.includes(objName.toLowerCase())) {
          return true;
        }
      }

      // Check for LinkItem, TestCase, KeySize constructor calls
      if (right.type === 'CallExpression' || right.type === 'NewExpression') {
        const callee = right.callee;
        const calleeName = callee?.name || callee?.property?.name;
        const frameworkTypes = ['linkitem', 'testcase', 'keysize', 'vulnerability', 'authresult'];
        if (typeof calleeName === 'string' && frameworkTypes.includes(calleeName.toLowerCase())) {
          return true;
        }
      }

      // Check for arrays of LinkItem/TestCase
      if (right.type === 'ArrayExpression' && right.elements?.length > 0) {
        const firstElem = right.elements[0];
        if (firstElem?.type === 'CallExpression' || firstElem?.type === 'NewExpression') {
          const calleeName = firstElem.callee?.name || firstElem.callee?.property?.name;
          const frameworkTypes = ['linkitem', 'testcase', 'keysize'];
          if (typeof calleeName === 'string' && frameworkTypes.includes(calleeName.toLowerCase())) {
            return true;
          }
        }
      }

      return false;
    }

    /**
     * Extract fields from constructor's this.x = y assignments
     */
    extractFieldsFromConstructor(node) {
      const fields = [];
      const ctor = new BasicConstructor();

      if (!node.value || !node.value.body || node.value.body.type !== 'BlockStatement')
        return { fields, ctor };

      // Parameters
      if (node.value.params) {
        node.value.params.forEach((param, index) => {
          const rawName = this._paramName(param, index);
          const paramName = this.toCamelCase(rawName);
          const paramType = this.inferTypeFromName(rawName);
          ctor.parameters.push(new BasicParameter(paramName, paramType));
          this.registerVariableType(rawName, paramType);
        });
      }

      const body = new BasicBlock();

      for (const stmt of node.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          // Skip framework metadata in procedural mode
          if (!this.options.useClasses && this.isFrameworkMetadataAssignment(stmt)) {
            continue;
          }

          const expr = stmt.expression;
          const propName = this.getThisPropertyName(expr);
          let fieldName = this.toCamelCase(propName);

          // Remove leading underscore
          if (fieldName.startsWith('_'))
            fieldName = fieldName.substring(1);

          const value = expr.right;
          let fieldType = this.inferTypeFromValue(value);

          const field = new BasicField(fieldName, fieldType);
          fields.push(field);

          // Add assignment to constructor body
          const assignment = new BasicAssignment(
            new BasicIdentifier(fieldName),
            this.transformExpression(value)
          );
          body.statements.push(assignment);
        } else {
          // Transform other statements
          const stmt2 = this.transformStatement(stmt);
          if (stmt2) {
            if (Array.isArray(stmt2))
              body.statements.push(...stmt2);
            else
              body.statements.push(stmt2);
          }
        }
      }

      ctor.body = body;
      return { fields, ctor };
    }

    /**
     * Check if a statement is a this.property = value assignment
     */
    isThisPropertyAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;
      // Handle both standard JS AST and IL AST node types
      if (expr.left.type === 'ThisPropertyAccess')
        return true;
      if (expr.left.type !== 'MemberExpression') return false;
      return expr.left.object.type === 'ThisExpression';
    }

    /**
     * Get property name from this property access
     */
    getThisPropertyName(expr) {
      if (expr.left.type === 'ThisPropertyAccess')
        return expr.left.property;
      return expr.left.property.name || expr.left.property.value;
    }

    /**
     * Transform a method definition
     */
    transformMethodDefinition(node) {
      const methodName = this.toPascalCase(node.key.name);

      // Determine if Sub or Function
      const hasReturn = node.value && node.value.body ?
        this.hasReturnWithValue(node.value.body) : false;

      const method = new BasicFunction(methodName, !hasReturn);
      method.isShared = node.static || false;

      // Infer return type
      if (hasReturn) {
        const returnType = this.inferReturnType(node.value.body);
        method.returnType = returnType || BasicType.Long();
      }

      // Parameters
      if (node.value && node.value.params) {
        node.value.params.forEach((param, index) => {
          const rawName = this._paramName(param, index);
          const paramName = this.toCamelCase(rawName);
          const paramType = this.inferTypeFromName(rawName);
          method.parameters.push(new BasicParameter(paramName, paramType));
          this.registerVariableType(rawName, paramType);
        });
      }

      // Body
      if (node.value && node.value.body) {
        method.body = this.transformBlockStatement(node.value.body);
      }

      return method;
    }

    /**
     * Transform a property definition
     */
    transformPropertyDefinition(node) {
      const fieldName = this.toCamelCase(node.key.name);
      let fieldType = BasicType.Long();

      if (node.value) {
        fieldType = this.inferTypeFromValue(node.value);
      }

      return new BasicField(fieldName, fieldType);
    }

    transformStaticBlock(node) {
      // ES2022 static block -> BASIC module-level statements
      // BASIC doesn't have static class blocks, so transform to statements
      // Handle both BlockStatement (node.body.body) and direct array (node.body)
      const statements = Array.isArray(node.body) ? node.body :
                         node.body?.body ? node.body.body :
                         node.body?.type === 'BlockStatement' ? node.body.body :
                         [];
      if (!Array.isArray(statements))
        return [];
      return statements.map(stmt => this.transformStatement(stmt));
    }

    transformClassExpression(node) {
      // ClassExpression -> VB.NET Class
      const className = node.id?.name || 'AnonymousClass';
      const classDecl = new BasicClass(className);

      if (node.superClass) {
        classDecl.inherits = this.transformExpression(node.superClass);
      }

      if (node.body?.body) {
        for (const member of node.body.body) {
          const transformed = this.transformClassMember(member);
          if (transformed)
            classDecl.members.push(transformed);
        }
      }

      return classDecl;
    }

    transformYieldExpression(node) {
      // VB.NET has Yield keyword - return argument for now
      const argument = node.argument ? this.transformExpression(node.argument) : BasicLiteral.Nothing();
      return argument;
    }

    /**
     * Transform a property definition to a field (for Type/Structure)
     */
    transformPropertyDefinitionToField(node) {
      const fieldName = this.toCamelCase(node.key.name);
      let fieldType = BasicType.Long();

      if (node.value) {
        fieldType = this.inferTypeFromValue(node.value);
      }

      return new BasicField(fieldName, fieldType);
    }

    /**
     * Check if body has return statement with value
     */
    hasReturnWithValue(bodyNode) {
      if (!bodyNode) return false;

      const check = (node) => {
        if (!node) return false;
        if (node.type === 'ReturnStatement' && node.argument) return true;

        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            if (value.some(check)) return true;
          } else if (value && typeof value === 'object') {
            if (check(value)) return true;
          }
        }
        return false;
      };

      return check(bodyNode);
    }

    /**
     * Infer return type from return statements
     */
    inferReturnType(bodyNode) {
      if (!bodyNode) return null;

      const returnTypes = [];
      const collect = (node) => {
        if (!node) return;
        if (node.type === 'ReturnStatement' && node.argument) {
          returnTypes.push(this.inferTypeFromValue(node.argument));
        }

        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            value.forEach(collect);
          } else if (value && typeof value === 'object') {
            collect(value);
          }
        }
      };

      collect(bodyNode);

      if (returnTypes.length === 0) return null;
      return returnTypes[0];
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new BasicBlock();

      if (node.body && Array.isArray(node.body)) {
        for (const stmt of node.body) {
          const basicStmt = this.transformStatement(stmt);
          if (basicStmt) {
            if (Array.isArray(basicStmt)) {
              block.statements.push(...basicStmt);
            } else {
              block.statements.push(basicStmt);
            }
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement - ALL 16 critical statement types
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        // 1. VariableDeclaration
        case 'VariableDeclaration':
          return this.transformDimStatement(node);

        // 2. ExpressionStatement
        case 'ExpressionStatement':
          return this.transformExpressionStatementNode(node);

        // 3. ReturnStatement
        case 'ReturnStatement':
          return this.transformReturnStatement(node);

        // 4. IfStatement
        case 'IfStatement':
          return this.transformIfStatement(node);

        // 5. ForStatement
        case 'ForStatement':
          return this.transformForStatement(node);

        // 6. ForOfStatement
        case 'ForOfStatement':
          return this.transformForEachStatement(node);

        // 7. ForInStatement
        case 'ForInStatement':
          return this.transformForEachStatement(node);

        // 8. WhileStatement
        case 'WhileStatement':
          return this.transformWhileStatement(node);

        // 9. DoWhileStatement
        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);

        // 10. SwitchStatement
        case 'SwitchStatement':
          return this.transformSelectStatement(node);

        // 11. TryStatement
        case 'TryStatement':
          return this.transformTryStatement(node);

        // 12. ThrowStatement
        case 'ThrowStatement':
          return this.transformThrowStatement(node);

        // 13. BlockStatement
        case 'BlockStatement':
          return this.transformBlockStatement(node);

        // 14. BreakStatement
        case 'BreakStatement':
          return new BasicExit('For'); // Context-dependent

        // 15. ContinueStatement
        case 'ContinueStatement':
          return new BasicContinue('For'); // Context-dependent

        // 16. EmptyStatement
        case 'EmptyStatement':
          return null;

        default:
          return null;
      }
    }

    /**
     * Transform a Dim statement
     */
    transformDimStatement(node) {
      const statements = [];

      for (const decl of node.declarations) {
        const varName = this.toCamelCase(decl.id.name);
        let varType = null;
        let initializer = null;

        if (decl.init) {
          initializer = this.transformExpression(decl.init);
          varType = this.inferTypeFromValue(decl.init);
        } else {
          varType = this.inferTypeFromName(decl.id.name);
        }

        const dim = new BasicDim(varName, varType, initializer);
        dim.isConst = node.kind === 'const';

        this.registerVariableType(decl.id.name, varType);
        statements.push(dim);
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      const expr = this.transformExpression(node.expression);
      if (!expr) return null;

      return new BasicExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      if (node.argument) {
        const expr = this.transformExpression(node.argument);
        return new BasicReturn(expr);
      }

      return new BasicReturn();
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new BasicBlock();

      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const ifStmt = new BasicIf(condition, thenBlock);

      // Handle else if and else
      if (node.alternate) {
        if (node.alternate.type === 'IfStatement') {
          // ElseIf
          const elseIfCondition = this.transformExpression(node.alternate.test);
          const elseIfBranch = this.transformStatement(node.alternate.consequent) || new BasicBlock();
          const elseIfBlock = elseIfBranch.nodeType === 'Block' ? elseIfBranch : this.wrapInBlock(elseIfBranch);

          ifStmt.elseIfBranches.push({ condition: elseIfCondition, body: elseIfBlock });

          // Handle further else
          if (node.alternate.alternate) {
            const elseBranch = this.transformStatement(node.alternate.alternate);
            ifStmt.elseBranch = elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch);
          }
        } else {
          // Else
          const elseBranch = this.transformStatement(node.alternate);
          ifStmt.elseBranch = elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch);
        }
      }

      return ifStmt;
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      // C-style for: for (let i = 0; i < n; i++)
      let variable = 'i';
      let start = new BasicLiteral(0, 'int');
      let end = new BasicLiteral(10, 'int');
      let step = null;

      // Extract variable from init
      if (node.init && node.init.type === 'VariableDeclaration') {
        const decl = node.init.declarations[0];
        if (decl) {
          variable = this.toCamelCase(decl.id.name);
          if (decl.init) {
            start = this.transformExpression(decl.init);
          }
        }
      }

      // Extract end from test - handle various test forms
      if (node.test) {
        if (node.test.type === 'BinaryExpression') {
          // i < n or i <= n
          const rightExpr = this.transformExpression(node.test.right);
          if (rightExpr) {
            // For < operator, we need to subtract 1: for(i=0; i<n; i++) -> For i = 0 To n-1
            if (node.test.operator === '<') {
              end = new BasicBinaryExpression(rightExpr, '-', new BasicLiteral(1, 'int'));
            } else {
              end = rightExpr;
            }
          }
        } else {
          // Try to transform the whole test expression
          const testExpr = this.transformExpression(node.test);
          if (testExpr) {
            end = testExpr;
          }
        }
      }

      // Extract step from update
      if (node.update) {
        if (node.update.type === 'UpdateExpression') {
          step = node.update.operator === '++' ?
            new BasicLiteral(1, 'int') :
            new BasicLiteral(-1, 'int');
        } else if (node.update.type === 'AssignmentExpression') {
          step = this.transformExpression(node.update.right);
        }
      }

      const body = this.transformStatement(node.body) || new BasicBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      const forLoop = new BasicFor(variable, start, end, bodyBlock);
      forLoop.step = step;

      return forLoop;
    }

    /**
     * Transform a for-each statement
     */
    transformForEachStatement(node) {
      let varName = 'item';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toCamelCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toCamelCase(node.left.name);
      }

      const collection = this.transformExpression(node.right);
      const body = this.transformStatement(node.body) || new BasicBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new BasicForEach(varName, collection, bodyBlock);
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new BasicBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new BasicWhile(condition, bodyBlock);
    }

    /**
     * Transform a do-while statement
     */
    transformDoWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new BasicBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      const doLoop = new BasicDoLoop(bodyBlock, condition);
      doLoop.isWhile = true;
      doLoop.testAtTop = false; // Do...Loop While

      return doLoop;
    }

    /**
     * Transform a switch statement to Select Case
     */
    transformSelectStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const select = new BasicSelect(discriminant);

      for (const caseNode of node.cases) {
        let values = null;
        if (caseNode.test) {
          values = [this.transformExpression(caseNode.test)];
        }

        const caseBody = new BasicBlock();
        for (const stmt of caseNode.consequent) {
          const basicStmt = this.transformStatement(stmt);
          if (basicStmt) {
            if (Array.isArray(basicStmt)) {
              caseBody.statements.push(...basicStmt);
            } else {
              caseBody.statements.push(basicStmt);
            }
          }
        }

        select.cases.push(new BasicCase(values, caseBody));
      }

      return select;
    }

    /**
     * Transform a try-catch statement
     */
    transformTryStatement(node) {
      const tryStmt = new BasicTry();
      tryStmt.tryBlock = this.transformStatement(node.block);

      if (node.handler) {
        const exceptionVar = node.handler.param ?
          this.toCamelCase(node.handler.param.name) : 'ex';
        const catchBody = this.transformStatement(node.handler.body);
        const catchClause = new BasicCatch('Exception', exceptionVar, catchBody);
        tryStmt.catchClauses.push(catchClause);
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
      const expr = node.argument ?
        this.transformExpression(node.argument) :
        new BasicNew('Exception', []);
      return new BasicThrow(expr);
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new BasicBlock();
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
     * Transform an expression - ALL 19 critical expression types
     */
    transformExpression(node) {
      if (!node) return null;

      switch (node.type) {
        // 1. Literal
        case 'Literal':
          return this.transformLiteral(node);

        // 2. Identifier
        case 'Identifier':
          return this.transformIdentifier(node);

        // 3. BinaryExpression
        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.transformBinaryExpression(node);

        // 4. UnaryExpression
        case 'UnaryExpression':
          return this.transformUnaryExpression(node);

        // 5. AssignmentExpression
        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);

        // 6. UpdateExpression
        case 'UpdateExpression':
          return this.transformUpdateExpression(node);

        // 7. MemberExpression
        case 'MemberExpression':
          return this.transformMemberExpression(node);

        // 8. CallExpression
        case 'CallExpression':
          return this.transformCallExpression(node);

        // 9. ArrayExpression
        case 'ArrayExpression':
          return this.transformArrayExpression(node);

        // 10. ObjectExpression
        case 'ObjectExpression':
          return this.transformObjectExpression(node);

        // 11. NewExpression
        case 'NewExpression':
          return this.transformNewExpression(node);

        // 12. ThisExpression
        case 'ThisExpression':
          // In procedural mode (standalone functions), use 'self' parameter
          if (this.insideStandaloneFunction)
            return new BasicIdentifier('self');
          // FreeBASIC uses This, VB uses Me
          return new BasicIdentifier(this.variant === 'FREEBASIC' ? 'This' : 'Me');

        // 13. ConditionalExpression
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        // 14. ArrowFunctionExpression
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        // 15. SequenceExpression
        case 'SequenceExpression':
          return this.transformExpression(node.expressions[node.expressions.length - 1]);

        // 16. SpreadElement
        case 'SpreadElement':
          return this.transformExpression(node.argument);

        // 17. TemplateLiteral
        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        // 18. Super
        case 'Super':
          return new BasicIdentifier('MyBase');

        // 19. MetaProperty (import.meta, new.target)
        case 'MetaProperty':
          return new BasicIdentifier('Unknown');

        // 20. ObjectPattern (destructuring)
        case 'ObjectPattern':
          // Object destructuring - Basic doesn't support this directly
          // Return a comment placeholder
          return new BasicComment('Object destructuring not supported in Basic', true);

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - Basic doesn't have this
          return this.transformExpression(node.expression);

        case 'ClassExpression':
          // Anonymous class expression
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - VB.NET has Iterator/Yield
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> VB.NET Private field with _ prefix
          return new BasicIdentifier('_' + this.toCamelCase(node.name));

        // IL AST node types from type-aware-transpiler
        case 'ThisPropertyAccess':
          // this.property -> This.property (FreeBASIC) or Me.property (VB.NET)
          // In procedural mode (standalone functions), use 'self' parameter
          {
            const selfRef = this.insideStandaloneFunction ? 'self' :
              (this.variant === 'FREEBASIC' ? 'This' : 'Me');
            return new BasicMemberAccess(new BasicIdentifier(selfRef), node.property);
          }

        case 'ParentConstructorCall':
          // super(args) -> dialect-specific parent constructor call
          // FreeBASIC: Base(args)
          // VB.NET: MyBase.New(args)
          // Skip if skipInheritance option is set (return null to skip)
          {
            if (this.options.skipInheritance)
              return null; // Skip parent constructor call
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            if (this.variant === 'FREEBASIC')
              return new BasicCall(new BasicIdentifier('Base'), args);
            return new BasicCall(new BasicMemberAccess(new BasicIdentifier('MyBase'), 'New'), args);
          }

        case 'ThisMethodCall':
          // this.method(args) -> This.method(args) (FreeBASIC) or Me.method(args) (VB.NET)
          // In procedural mode, use 'self' parameter
          {
            const selfRef = this.insideStandaloneFunction ? 'self' :
              (this.variant === 'FREEBASIC' ? 'This' : 'Me');
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            return new BasicCall(new BasicMemberAccess(new BasicIdentifier(selfRef), node.method), args);
          }

        case 'RotateLeft':
          // Bit rotation left - use function call or inline expression
          {
            const value = this.transformExpression(node.value);
            const amount = this.transformExpression(node.amount);
            const bits = node.bits || 32;
            // ((value << amount) Or (value >> (bits - amount))) And mask
            const mask = bits === 32 ? '&HFFFFFFFF' : bits === 64 ? '&HFFFFFFFFFFFFFFFF' : `((1 Shl ${bits}) - 1)`;
            return new BasicBinaryExpression(
              new BasicBinaryExpression(
                new BasicBinaryExpression(value, 'Shl', amount),
                'Or',
                new BasicBinaryExpression(value, 'Shr', new BasicBinaryExpression(BasicLiteral.Int(bits), '-', amount))
              ),
              'And', new BasicLiteral(mask, 'Long')
            );
          }

        case 'RotateRight':
          // Bit rotation right
          {
            const value = this.transformExpression(node.value);
            const amount = this.transformExpression(node.amount);
            const bits = node.bits || 32;
            const mask = bits === 32 ? '&HFFFFFFFF' : bits === 64 ? '&HFFFFFFFFFFFFFFFF' : `((1 Shl ${bits}) - 1)`;
            return new BasicBinaryExpression(
              new BasicBinaryExpression(
                new BasicBinaryExpression(value, 'Shr', amount),
                'Or',
                new BasicBinaryExpression(value, 'Shl', new BasicBinaryExpression(BasicLiteral.Int(bits), '-', amount))
              ),
              'And', new BasicLiteral(mask, 'Long')
            );
          }

        case 'ArrayClear':
          // ClearArray -> Erase or ReDim
          {
            const arr = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : new BasicIdentifier('array');
            return new BasicCall(new BasicIdentifier('Erase'), [arr]);
          }

        case 'ArrayLiteral':
          // [a, b, c] -> {a, b, c} array initializer
          {
            const elements = (node.elements || []).map(e => this.transformExpression(e));
            return new BasicArrayLiteral(elements);
          }

        case 'OpCodesCall':
          // OpCodes.MethodName(args) -> Basic equivalent or function call
          {
            const methodName = node.methodName || node.method;
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            const funcName = this.toPascalCase(methodName);
            return new BasicCall(new BasicIdentifier(funcName), args);
          }

        case 'Cast':
          // Type cast
          {
            const value = node.value ? this.transformExpression(node.value) :
                         node.argument ? this.transformExpression(node.argument) :
                         node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : BasicLiteral.Int(0);
            const targetType = node.targetType || 'int';
            const castFunc = targetType === 'uint32' || targetType === 'dword' ? 'CUInt' :
                            targetType === 'int32' || targetType === 'int' ? 'CInt' :
                            targetType === 'uint8' || targetType === 'byte' ? 'CByte' :
                            targetType === 'float' || targetType === 'single' ? 'CSng' :
                            targetType === 'double' ? 'CDbl' : 'CInt';
            return new BasicCall(new BasicIdentifier(castFunc), [value]);
          }

        case 'ArraySlice':
          // array.slice(start, end) - use CopyArray helper function or direct array syntax
          {
            const arr = this.transformExpression(node.array || node.arguments?.[0]);
            const start = node.start ? this.transformExpression(node.start) :
                         node.arguments?.[1] ? this.transformExpression(node.arguments[1]) : BasicLiteral.Int(0);
            const end = node.end ? this.transformExpression(node.end) :
                       node.arguments?.[2] ? this.transformExpression(node.arguments[2]) : null;
            // Use CopyArray helper function: CopyArray(arr, start, length)
            if (end) {
              // Length = end - start
              const length = new BasicBinaryExpression(end, '-', start);
              return new BasicCall(new BasicIdentifier('CopyArray'), [arr, start, length]);
            } else {
              // Copy from start to end of array
              return new BasicCall(new BasicIdentifier('CopyArray'), [arr, start]);
            }
          }

        case 'ArrayIndexOf':
          // array.indexOf(value) - Basic needs loop or function
          {
            const arr = this.transformExpression(node.array);
            const value = node.value ? this.transformExpression(node.value) : BasicLiteral.Nothing();
            return new BasicCall(new BasicIdentifier('IndexOf'), [arr, value]);
          }

        case 'ErrorCreation':
          // new Error("message") -> Err.Raise or Throw New Exception
          {
            const message = node.message ? this.transformExpression(node.message) : BasicLiteral.String('');
            return new BasicCall(new BasicIdentifier('Err.Raise'), [BasicLiteral.Int(5), BasicLiteral.String(''), message]);
          }

        case 'StringFromCharCode':
          // String.fromCharCode(n) -> Chr(n)
          {
            const code = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : BasicLiteral.Int(0);
            return new BasicCall(new BasicIdentifier('Chr'), [code]);
          }

        case 'StringCharCodeAt':
          // str.charCodeAt(i) -> Asc(Mid(str, i+1, 1))
          {
            const str = this.transformExpression(node.string || node.object);
            const idx = node.index ? this.transformExpression(node.index) : BasicLiteral.Int(0);
            return new BasicCall(new BasicIdentifier('Asc'), [
              new BasicCall(new BasicIdentifier('Mid'), [str, new BasicBinaryExpression(idx, '+', BasicLiteral.Int(1)), BasicLiteral.Int(1)])
            ]);
          }

        case 'ArrayLength':
          // array.length -> UBound(array) - LBound(array) + 1 or just UBound+1 for 0-based
          {
            const arr = node.array ? this.transformExpression(node.array) : new BasicIdentifier('array');
            // In FreeBASIC, arrays are typically 0-based, so UBound(arr) + 1 gives length
            return new BasicBinaryExpression(
              new BasicCall(new BasicIdentifier('UBound'), [arr]),
              '+',
              BasicLiteral.Int(1)
            );
          }

        case 'PackBytes':
          // Pack bytes to value - use function call
          {
            const endian = node.endian || 'big';
            const bits = node.bits || 32;
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            const funcName = `Pack${bits}${endian === 'big' ? 'BE' : 'LE'}`;
            return new BasicCall(new BasicIdentifier(funcName), args);
          }

        case 'UnpackBytes':
          // Unpack value to bytes - use function call
          {
            const endian = node.endian || 'big';
            const bits = node.bits || 32;
            // Check multiple possible locations for the value argument
            const value = node.value ? this.transformExpression(node.value) :
                         node.argument ? this.transformExpression(node.argument) :
                         node.arguments?.[0] ? this.transformExpression(node.arguments[0]) :
                         BasicLiteral.Int(0);
            const funcName = `Unpack${bits}${endian === 'big' ? 'BE' : 'LE'}`;
            return new BasicCall(new BasicIdentifier(funcName), [value]);
          }

        case 'HexDecode':
          // Decode hex string to byte array - Hex8ToBytes(hexString)
          {
            const hexStr = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : BasicLiteral.String('');
            return new BasicCall(new BasicIdentifier('Hex8ToBytes'), [hexStr]);
          }

        case 'HexEncode':
          // Encode byte array to hex string - BytesToHex8(bytes)
          {
            const bytes = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : new BasicIdentifier('bytes');
            return new BasicCall(new BasicIdentifier('BytesToHex8'), [bytes]);
          }

        case 'BitwiseXor':
          // Bitwise XOR
          {
            const left = this.transformExpression(node.left);
            const right = this.transformExpression(node.right);
            return new BasicBinaryExpression(left, 'Xor', right);
          }

        case 'BitwiseAnd':
          // Bitwise AND
          {
            const left = this.transformExpression(node.left);
            const right = this.transformExpression(node.right);
            return new BasicBinaryExpression(left, 'And', right);
          }

        case 'BitwiseOr':
          // Bitwise OR
          {
            const left = this.transformExpression(node.left);
            const right = this.transformExpression(node.right);
            return new BasicBinaryExpression(left, 'Or', right);
          }

        case 'BitwiseNot':
          // Bitwise NOT
          {
            const arg = this.transformExpression(node.argument);
            return new BasicUnaryExpression('Not', arg);
          }

        case 'LeftShift':
          // Left shift
          {
            const value = this.transformExpression(node.left || node.value);
            const amount = this.transformExpression(node.right || node.amount);
            return new BasicBinaryExpression(value, 'Shl', amount);
          }

        case 'RightShift':
          // Right shift (logical)
          {
            const value = this.transformExpression(node.left || node.value);
            const amount = this.transformExpression(node.right || node.amount);
            return new BasicBinaryExpression(value, 'Shr', amount);
          }

        case 'RightShiftSigned':
          // Right shift (arithmetic/signed) - same as Shr in Basic for signed types
          {
            const value = this.transformExpression(node.left || node.value);
            const amount = this.transformExpression(node.right || node.amount);
            return new BasicBinaryExpression(value, 'Shr', amount);
          }

        case 'UnsignedRightShift':
          // Unsigned right shift - in Basic, Shr on unsigned types
          {
            const value = this.transformExpression(node.left || node.value);
            const amount = this.transformExpression(node.right || node.amount);
            return new BasicBinaryExpression(value, 'Shr', amount);
          }

        case 'XorArrays':
          // XOR two byte arrays element-wise
          {
            const arr1 = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : new BasicIdentifier('arr1');
            const arr2 = node.arguments?.[1] ? this.transformExpression(node.arguments[1]) : new BasicIdentifier('arr2');
            return new BasicCall(new BasicIdentifier('XorArrays'), [arr1, arr2]);
          }

        case 'TypeMask':
          // Mask to N bits - value And ((1 Shl bits) - 1) or value And &HFFFFFFFF
          {
            const value = this.transformExpression(node.value || node.argument);
            const bits = node.bits || 32;
            let mask;
            if (bits === 8) mask = '&HFF';
            else if (bits === 16) mask = '&HFFFF';
            else if (bits === 32) mask = '&HFFFFFFFF';
            else if (bits === 64) mask = '&HFFFFFFFFFFFFFFFF';
            else mask = `((1 Shl ${bits}) - 1)`;
            return new BasicBinaryExpression(value, 'And', new BasicLiteral(mask, 'Long'));
          }

        case 'Concatenate':
          // String concatenation
          {
            const parts = (node.arguments || node.parts || []).map(a => this.transformExpression(a));
            if (parts.length === 0) return BasicLiteral.String('');
            if (parts.length === 1) return parts[0];
            return parts.reduce((acc, part) => new BasicBinaryExpression(acc, '&', part));
          }

        case 'ObjectProperty':
          // Object property access
          {
            const obj = this.transformExpression(node.object);
            return new BasicMemberAccess(obj, node.property);
          }

        // IL AST StringInterpolation - `Hello ${name}` -> "Hello " & name
        case 'StringInterpolation': {
          const parts = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                if (part.value)
                  parts.push(BasicLiteral.String(part.value));
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                parts.push(this.transformExpression(part.expression));
              }
            }
          }
          if (parts.length === 0) return BasicLiteral.String('');
          if (parts.length === 1) return parts[0];
          return parts.reduce((acc, part) => new BasicBinaryExpression(acc, '&', part));
        }

        // IL AST ObjectLiteral - {key: value} -> Not directly supported in BASIC
        case 'ObjectLiteral': {
          // BASIC doesn't have object literals; return Nothing
          return new BasicIdentifier('Nothing');
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> Chr(65)
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return BasicLiteral.String('');
          if (args.length === 1)
            return new BasicCall(new BasicIdentifier('Chr'), args);
          // Multiple: Chr(c1) & Chr(c2) & ...
          const chrCalls = args.map(a => new BasicCall(new BasicIdentifier('Chr'), [a]));
          return chrCalls.reduce((acc, call) => new BasicBinaryExpression(acc, '&', call));
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> IsArray(x)
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new BasicCall(new BasicIdentifier('IsArray'), [value]);
        }

        // IL AST ArrowFunction - (x) => expr -> Function(x) = expr (not really supported)
        case 'ArrowFunction': {
          // BASIC doesn't have lambdas; return placeholder
          return new BasicIdentifier("' Lambda function");
        }

        // IL AST TypeOfExpression - typeof x -> TypeName(x)
        case 'TypeOfExpression': {
          const value = this.transformExpression(node.value);
          return new BasicCall(new BasicIdentifier('TypeName'), [value]);
        }

        // IL AST Power - x ** y -> x ^ y
        case 'Power': {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new BasicBinaryExpression(left, '^', right);
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (no-op in BASIC)
        case 'ObjectFreeze': {
          return this.transformExpression(node.value);
        }

        default:
          return null;
      }
    }

    /**
     * Transform a literal
     */
    transformLiteral(node) {
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          if (node.value >= -32768 && node.value <= 32767)
            return BasicLiteral.Int(node.value);
          return BasicLiteral.Long(node.value);
        }
        return BasicLiteral.Double(node.value);
      }

      if (typeof node.value === 'string') {
        return BasicLiteral.String(node.value);
      }

      if (typeof node.value === 'boolean') {
        return BasicLiteral.Boolean(node.value);
      }

      if (node.value === null) {
        return BasicLiteral.Nothing();
      }
      // Handle undefined - treat same as Nothing in BASIC
      if (node.value === undefined) {
        return BasicLiteral.Nothing();
      }

      return new BasicLiteral(node.value, 'unknown');
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to Basic equivalents
      if (name === 'undefined') return BasicLiteral.Nothing();
      if (name === 'null') return BasicLiteral.Nothing();
      if (name === 'true') return BasicLiteral.Boolean(true);
      if (name === 'false') return BasicLiteral.Boolean(false);

      return new BasicIdentifier(this.toCamelCase(name));
    }

    /**
     * Transform a binary expression
     */
    transformBinaryExpression(node) {
      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // Map operators
      let operator = node.operator;

      // Comparison operators
      if (operator === '===') operator = '=';
      if (operator === '!==') operator = '<>';
      if (operator === '==') operator = '=';
      if (operator === '!=') operator = '<>';

      // Bitwise/logical operators
      if (operator === '&&') operator = 'And';
      if (operator === '||') operator = 'Or';
      if (operator === '!') operator = 'Not';
      if (operator === '&') operator = 'And'; // Bitwise And
      if (operator === '|') operator = 'Or';  // Bitwise Or
      if (operator === '^') operator = 'Xor';

      // Shift operators
      if (operator === '<<') operator = '<<'; // Left shift (VB.NET only)
      if (operator === '>>') operator = '>>'; // Right shift (VB.NET only)
      if (operator === '>>>') operator = '>>'; // Unsigned right shift -> regular shift

      // Modulo
      if (operator === '%') operator = 'Mod';

      return new BasicBinaryExpression(left, operator, right);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);

      let operator = node.operator;

      // Handle !array (array null/empty check) -> UBound(array) < LBound(array)
      if (operator === '!') {
        // Check if operand is likely an array based on type info
        const argType = this.getVariableType(node.argument?.name);
        if (argType?.isArray || this.isLikelyArrayName(node.argument?.name)) {
          // Transform !arrayVar to (UBound(arrayVar) < LBound(arrayVar)) which checks if empty
          return new BasicBinaryExpression(
            new BasicCall(new BasicIdentifier('UBound'), [operand]),
            '<',
            new BasicCall(new BasicIdentifier('LBound'), [operand])
          );
        }
        operator = 'Not';
      }

      if (operator === 'typeof') {
        // TypeOf is different in Basic
        return new BasicCall(new BasicIdentifier('TypeName'), [operand]);
      }

      return new BasicUnaryExpression(operator, operand);
    }

    /**
     * Check if a variable name is likely an array based on naming conventions
     */
    isLikelyArrayName(name) {
      if (!name) return false;
      const lower = name.toLowerCase();
      return lower.includes('data') || lower.includes('bytes') || lower.includes('buffer') ||
             lower.includes('array') || lower.includes('input') || lower.includes('output') ||
             lower.includes('block') || lower.includes('key') || lower.includes('state');
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      return new BasicAssignment(left, right, node.operator);
    }

    /**
     * Transform an update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);

      // Basic doesn't have ++ or --, use += 1 or -= 1
      const op = node.operator === '++' ? '+=' : '-=';
      return new BasicAssignment(operand, new BasicLiteral(1, 'int'), op);
    }

    /**
     * Transform a member expression
     */
    transformMemberExpression(node) {
      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Array indexing
        const index = this.transformExpression(node.property);
        return new BasicIndexAccess(object, [index]);
      } else {
        // Member access
        const member = node.property.name || node.property.value;

        // Handle special properties
        if (member === 'length') {
          // array.length -> UBound(array) + 1 or array.Length in VB.NET
          if (this.variant === 'VBNET') {
            return new BasicMemberAccess(object, 'Length');
          } else {
            return new BasicBinaryExpression(
              new BasicCall(new BasicIdentifier('UBound'), [object]),
              '+',
              new BasicLiteral(1, 'int')
            );
          }
        }

        return new BasicMemberAccess(object, this.toPascalCase(member));
      }
    }

    /**
     * Transform a call expression
     */
    transformCallExpression(node) {
      // Handle OpCodes method calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.transformOpCodesCall(node);
      }

      // Handle JavaScript builtins
      if (node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier') {
        const objName = node.callee.object.name.toLowerCase();
        const methodName = (node.callee.property.name || node.callee.property.value || '').toLowerCase();
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // String.fromCharCode(n) -> Chr(n)
        if (objName === 'string' && methodName === 'fromcharcode') {
          return new BasicCall(new BasicIdentifier('Chr'), args);
        }

        // Array.isArray(x) -> IsArray(x) or (TypeOf x Is Array)
        if (objName === 'array' && methodName === 'isarray') {
          // FreeBASIC: use a check for array - no direct equivalent, so just use a simple check
          // This would require runtime support in actual code
          return new BasicCall(new BasicIdentifier('IsArray'), args);
        }

        // Math functions
        if (objName === 'math') {
          const mathMap = {
            'floor': 'Int', 'ceil': 'CInt', 'round': 'CInt',
            'abs': 'Abs', 'sqrt': 'Sqr', 'sin': 'Sin', 'cos': 'Cos',
            'tan': 'Tan', 'exp': 'Exp', 'log': 'Log', 'pow': 'Pow',
            'min': 'Min', 'max': 'Max', 'random': 'Rnd'
          };
          const basicFunc = mathMap[methodName];
          if (basicFunc) {
            return new BasicCall(new BasicIdentifier(basicFunc), args);
          }
        }
      }

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        return new BasicMethodCall(object, this.toPascalCase(method), args);
      }

      // Regular function call
      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      return new BasicCall(callee, args);
    }

    /**
     * Transform OpCodes method calls to Basic equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map OpCodes methods to Basic helper functions
      // These would need to be implemented in the target Basic code
      const funcName = this.toPascalCase(methodName);
      return new BasicCall(new BasicIdentifier(funcName), args);
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      const elements = node.elements.map(elem => this.transformExpression(elem));
      return new BasicArrayLiteral(elements);
    }

    /**
     * Transform an object expression
     */
    transformObjectExpression(node) {
      // For Basic, we'd typically use a Type or Class instance
      // Object literals with properties can be converted to anonymous type initializers in VB.NET
      // or to Nothing in FreeBASIC (no direct equivalent)
      if (this.variant === 'FREEBASIC') {
        // FreeBASIC: Return Nothing since there's no object literal syntax
        // The algorithm should still work if test data is handled separately
        return BasicLiteral.Nothing();
      }
      // VB.NET: Could use anonymous types, but for simplicity return Nothing
      return BasicLiteral.Nothing();
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      if (node.callee.type === 'Identifier') {
        const typeName = this.toPascalCase(node.callee.name);
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle TypedArrays
        const typedArrayMap = {
          'Uint8Array': 'Byte',
          'Uint16Array': 'Integer',
          'Uint32Array': 'Long',
          'Int8Array': 'Byte',
          'Int16Array': 'Integer',
          'Int32Array': 'Long'
        };

        if (typedArrayMap[node.callee.name]) {
          // Create array
          if (args.length === 1) {
            // new Uint8Array(n) -> Dim arr(n-1) As Byte
            return new BasicIdentifier(`Array(${typedArrayMap[node.callee.name]})`);
          }
        }

        return new BasicNew(typeName, args);
      }

      return new BasicNew('Object', []);
    }

    /**
     * Transform a conditional expression
     */
    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const trueExpr = this.transformExpression(node.consequent);
      const falseExpr = this.transformExpression(node.alternate);

      return new BasicConditional(condition, trueExpr, falseExpr);
    }

    /**
     * Transform a function expression to lambda
     */
    transformFunctionExpression(node) {
      const params = node.params ? node.params.map(p => {
        const paramName = this.toCamelCase(p.name);
        const paramType = this.inferTypeFromName(p.name);
        return new BasicParameter(paramName, paramType);
      }) : [];

      let body = null;
      if (node.body) {
        if (node.body.type === 'BlockStatement') {
          body = this.transformBlockStatement(node.body);
        } else {
          body = this.transformExpression(node.body);
        }
      }

      const hasReturn = node.body && this.hasReturnWithValue(node.body);
      return new BasicLambda(params, body, !hasReturn);
    }

    /**
     * Transform template literal
     */
    transformTemplateLiteral(node) {
      // Convert to string concatenation
      let result = null;

      for (let i = 0; i < node.quasis.length; ++i) {
        const text = node.quasis[i].value.raw;
        if (text) {
          const strLit = BasicLiteral.String(text);
          result = result ? new BasicBinaryExpression(result, '&', strLit) : strLit;
        }

        if (i < node.expressions.length) {
          const expr = this.transformExpression(node.expressions[i]);
          result = result ? new BasicBinaryExpression(result, '&', expr) : expr;
        }
      }

      return result || BasicLiteral.String('');
    }
  }

  // BEGIN FREEBASIC
  const FB_RUNTIME = String.raw`' ---------------------------------------------------------------------------
' JavaScript semantics for transpiled FreeBASIC (c)2006-2025 Hawkynt
' Numbers are IEEE doubles, as in JavaScript. Every other value lives on the
' heap with a reference count that JsV's copy, assignment and destruction keep.
' ---------------------------------------------------------------------------
#include once "crt/setjmp.bi"
#include once "crt/math.bi"
#include once "crt/stdio.bi"
#include once "crt/stdlib.bi"
#include once "crt/string.bi"

#define JS_T_UNDEF 0
#define JS_T_NULL 1
#define JS_T_BOOL 2
#define JS_T_NUM 3
#define JS_T_STR 4
#define JS_T_OBJ 5
#define JS_T_BIG 6

#define JS_K_STR 1
#define JS_K_ARR 2
#define JS_K_TYPED 3
#define JS_K_BUF 4
#define JS_K_OBJ 5
#define JS_K_FN 6
#define JS_K_CLASS 7
#define JS_K_MAP 8
#define JS_K_BIG 10
#define JS_K_ENV 11
#define JS_K_DV 12

Type JsHeap Extends Object
  rc As Long
  kind As Long
  Declare Virtual Destructor()
End Type

Destructor JsHeap()
End Destructor

Type JsV
  tag As Long
  n As Double
  p As JsHeap Ptr
  Declare Constructor()
  Declare Constructor(ByRef o As JsV)
  Declare Destructor()
  Declare Operator Let(ByRef o As JsV)
End Type

Constructor JsV()
  tag = JS_T_UNDEF
  n = 0
  p = 0
End Constructor

Constructor JsV(ByRef o As JsV)
  tag = o.tag
  n = o.n
  p = o.p
  If p Then p->rc += 1
End Constructor

Destructor JsV()
  If p Then
    p->rc -= 1
    If p->rc <= 0 Then Delete p
  End If
End Destructor

Operator JsV.Let(ByRef o As JsV)
  Dim op As JsHeap Ptr = o.p
  If op Then op->rc += 1
  If p Then
    p->rc -= 1
    If p->rc <= 0 Then Delete p
  End If
  tag = o.tag
  n = o.n
  p = op
End Operator

' A JavaScript function: the receiver, the arguments, and the closure environment
Type JsFnPtr As Function(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV

' ---------------------------------------------------------------------------
' Heap kinds
' ---------------------------------------------------------------------------
Type JsStrH Extends JsHeap
  s As String
End Type

Type JsArrH Extends JsHeap
  items As JsV Ptr
  length As Long
  cap As Long
  Declare Destructor()
End Type

Destructor JsArrH()
  For i As Long = 0 To length - 1
    items[i].Destructor()
  Next
  If items Then Deallocate(items)
End Destructor

Type JsBufH Extends JsHeap
  bytes As UByte Ptr
  size As Long
  Declare Destructor()
End Type

Destructor JsBufH()
  If bytes Then Deallocate(bytes)
End Destructor

#define JS_E_U8 1
#define JS_E_U8C 2
#define JS_E_I8 3
#define JS_E_U16 4
#define JS_E_I16 5
#define JS_E_U32 6
#define JS_E_I32 7
#define JS_E_F32 8
#define JS_E_F64 9
#define JS_E_U64 10
#define JS_E_I64 11

Type JsTypedH Extends JsHeap
  buf As JsBufH Ptr
  offset As Long
  length As Long
  ek As Long
  esize As Long
  Declare Destructor()
End Type

Destructor JsTypedH()
  If buf Then
    buf->rc -= 1
    If buf->rc <= 0 Then Delete buf
  End If
End Destructor

Type JsDvH Extends JsHeap
  buf As JsBufH Ptr
  offset As Long
  length As Long
  Declare Destructor()
End Type

Destructor JsDvH()
  If buf Then
    buf->rc -= 1
    If buf->rc <= 0 Then Delete buf
  End If
End Destructor

Type JsClassFwd As JsClassH

' An object: its class and an ordered list of (symbol, value) properties
Type JsObjH Extends JsHeap
  cls As JsClassFwd Ptr
  keys As Long Ptr
  vals As JsV Ptr
  count As Long
  cap As Long
  Declare Destructor()
End Type

Destructor JsObjH()
  For i As Long = 0 To count - 1
    vals[i].Destructor()
  Next
  If vals Then Deallocate(vals)
  If keys Then Deallocate(keys)
End Destructor

Type JsMethodEntry
  sym As Long
  fn As JsFnPtr
  kind As Long   ' 0 method, 1 getter, 2 setter
End Type

' A class: an object (its static members) with methods, accessors, a constructor and a parent
Type JsClassH Extends JsObjH
  cname As String
  parent As JsClassH Ptr
  ctor As JsFnPtr
  methods As JsMethodEntry Ptr
  mcount As Long
  mcap As Long
  Declare Destructor()
End Type

Destructor JsClassH()
  If methods Then Deallocate(methods)
End Destructor

' A function: code, its captured environment and, for a bound method, the receiver
Type JsFnH Extends JsHeap
  fn As JsFnPtr
  env As JsHeap Ptr
  bound As JsV
  hasBound As Long
  Declare Destructor()
End Type

Destructor JsFnH()
  If env Then
    env->rc -= 1
    If env->rc <= 0 Then Delete env
  End If
End Destructor

' The captured variables of one function activation, chained to the enclosing one
Type JsEnvH Extends JsHeap
  vars As JsV Ptr
  count As Long
  parent As JsEnvH Ptr
  Declare Destructor()
End Type

Destructor JsEnvH()
  For i As Long = 0 To count - 1
    vars[i].Destructor()
  Next
  If vars Then Deallocate(vars)
  If parent Then
    parent->rc -= 1
    If parent->rc <= 0 Then Delete parent
  End If
End Destructor

Type JsMapH Extends JsHeap
  ks As JsV Ptr
  vs As JsV Ptr
  count As Long
  cap As Long
  isSet As Long
  Declare Destructor()
End Type

Destructor JsMapH()
  For i As Long = 0 To count - 1
    ks[i].Destructor()
    vs[i].Destructor()
  Next
  If ks Then Deallocate(ks)
  If vs Then Deallocate(vs)
End Destructor

' A BigInt: sign and magnitude in 32-bit limbs, least significant first
Type JsBigH Extends JsHeap
  neg As Long
  limbs As ULong Ptr
  count As Long
  Declare Destructor()
End Type

Destructor JsBigH()
  If limbs Then Deallocate(limbs)
End Destructor

' Int and Fix of a Double saturate past 2^63; every double from 2^52 up is already whole
Function js_dfloor(ByVal d As Double) As Double
  If d <> d OrElse Abs(d) >= 4503599627370496.0 Then Return d
  Return Int(d)
End Function

Function js_dfix(ByVal d As Double) As Double
  If d <> d OrElse Abs(d) >= 4503599627370496.0 Then Return d
  Return Fix(d)
End Function

' ---------------------------------------------------------------------------
' Symbols, primitive values, conversions, exceptions
' ---------------------------------------------------------------------------

' ---- symbols: every property name is interned to a number ----
Dim Shared js_sym_names() As String
Dim Shared js_sym_count As Long
Dim Shared js_sym_hash(0 To 8191) As Long   ' open addressing: index+1, 0 = empty

Function js_hash_str(ByRef s As String) As ULong
  Dim h As ULong = 2166136261
  For i As Long = 0 To Len(s) - 1
    h = (h Xor s[i]) * 16777619
  Next
  Return h
End Function

Function js_sym(ByRef s As String) As Long
  Dim h As Long = js_hash_str(s) And 8191
  Do
    Dim e As Long = js_sym_hash(h)
    If e = 0 Then Exit Do
    If js_sym_names(e - 1) = s Then Return e - 1
    h = (h + 1) And 8191
  Loop
  If js_sym_count > UBound(js_sym_names) Then ReDim Preserve js_sym_names(0 To js_sym_count * 2 + 64)
  js_sym_names(js_sym_count) = s
  js_sym_hash(h) = js_sym_count + 1
  js_sym_count += 1
  Return js_sym_count - 1
End Function

Function js_symname(ByVal id As Long) As String
  If id >= 0 AndAlso id < js_sym_count Then Return js_sym_names(id)
  Return ""
End Function

' ---- primitive constructors ----
Function js_undefined() As JsV
  Dim r As JsV
  Return r
End Function

Function js_null() As JsV
  Dim r As JsV
  r.tag = JS_T_NULL
  Return r
End Function

Function js_num(ByVal d As Double) As JsV
  Dim r As JsV
  r.tag = JS_T_NUM
  r.n = d
  Return r
End Function

Function js_bool(ByVal b As Long) As JsV
  Dim r As JsV
  r.tag = JS_T_BOOL
  r.n = IIf(b, 1, 0)
  Return r
End Function

Function js_str(ByRef s As String) As JsV
  Dim r As JsV
  Dim h As JsStrH Ptr = New JsStrH
  h->rc = 1
  h->kind = JS_K_STR
  h->s = s
  r.tag = JS_T_STR
  r.p = h
  Return r
End Function

' wrap a heap object (taking over one reference)
Function js_objv(ByVal h As JsHeap Ptr) As JsV
  Dim r As JsV
  r.tag = JS_T_OBJ
  r.p = h
  Return r
End Function

#define JSS(v) (Cast(JsStrH Ptr, (v).p)->s)
#define JS_KIND(v) (IIf((v).p, (v).p->kind, 0))

Dim Shared js_nan As Double
Dim Shared js_inf As Double

' ---- exceptions: a stack of setjmp targets ----
Dim Shared js_jmp(0 To 255) As jmp_buf
Dim Shared js_jmp_top As Long = -1
Dim Shared js_thrown As JsV
Dim Shared js_uncaught_handler As Sub(ByRef v As JsV)

Declare Function js_tostring(ByRef v As JsV) As String
Declare Function js_error_new(ByRef msg As String, ByRef ename As String) As JsV

Sub js_throw(ByRef v As JsV)
  js_thrown = v
  If js_jmp_top < 0 Then
    Print "Uncaught "; js_tostring(v)
    End 3
  End If
  longjmp(@js_jmp(js_jmp_top), 1)
End Sub

Sub js_throw_error(ByRef msg As String, ByRef ename As String = "Error")
  Dim e As JsV = js_error_new(msg, ename)
  js_throw(e)
End Sub

' ---- number formatting (JavaScript Number.prototype.toString) ----
Function js_numstr(ByVal d As Double, ByVal radix As Long = 10) As String
  If d <> d Then Return "NaN"
  If d = js_inf Then Return "Infinity"
  If d = -js_inf Then Return "-Infinity"
  If d = 0 Then Return "0"
  If radix <> 10 Then
    Dim neg As Long = d < 0
    Dim v As Double = Abs(d)
    Dim ip As Double = js_dfloor(v)
    Dim fp As Double = v - ip
    Dim digits As String = "0123456789abcdefghijklmnopqrstuvwxyz"
    Dim s As String
    If ip = 0 Then s = "0"
    Do While ip > 0
      Dim q As Double = js_dfloor(ip / radix)
      Dim rr As Long = CLng(ip - q * radix)
      s = Chr(digits[rr]) & s
      ip = q
    Loop
    If fp > 0 Then
      s &= "."
      For k As Long = 1 To 20
        fp *= radix
        Dim dg As Long = js_dfloor(fp)
        s &= Chr(digits[dg])
        fp -= dg
        If fp = 0 Then Exit For
      Next
    End If
    Return IIf(neg, "-" & s, s)
  End If
  If d = js_dfloor(d) AndAlso Abs(d) < 1e21 Then
    ' an integral value: its digits
    Dim buf As ZString * 64
    sprintf(@buf, "%.0f", d)
    Return buf
  End If
  ' the shortest representation that reads back as the same double
  Dim buf As ZString * 64
  For prec As Long = 1 To 17
    sprintf(@buf, "%.*g", prec, d)
    If strtod(@buf, 0) = d Then Exit For
  Next
  Dim s As String = buf
  Dim epos As Long = InStr(s, "e")
  If epos > 0 Then
    Dim mant As String = Left(s, epos - 1)
    Dim ex As Long = ValInt(Mid(s, epos + 1))
    ' JavaScript writes exponents only from 1e21 up and below 1e-6
    If ex >= -7 AndAlso ex < 21 Then
      sprintf(@buf, "%.17f", d)
      For prec As Long = 0 To 20
        sprintf(@buf, "%.*f", prec, d)
        If strtod(@buf, 0) = d Then Exit For
      Next
      Return buf
    End If
    Return mant & "e" & IIf(ex >= 0, "+", "-") & Abs(ex)
  End If
  Return s
End Function

' ---- conversions ----
Declare Function js_big_tostring(ByVal h As JsBigH Ptr, ByVal radix As Long = 10) As String
Declare Function js_big_todouble(ByVal h As JsBigH Ptr) As Double
Declare Function js_callm(ByRef obj As JsV, ByVal sym As Long, ByVal argv As JsV Ptr, ByVal argc As Long) As JsV
Declare Function js_has_method(ByRef obj As JsV, ByVal sym As Long) As Long
Declare Function js_getp(ByRef obj As JsV, ByVal sym As Long) As JsV
Declare Function js_index_get(ByRef obj As JsV, ByVal i As Long) As JsV
Dim Shared SYM_toString As Long
Dim Shared SYM_message As Long
Dim Shared SYM_name As Long
Dim Shared SYM_length As Long

Function js_parse_number(ByRef s0 As String) As Double
  Dim s As String = Trim(s0, Any !" \t\n\r")
  If Len(s) = 0 Then Return 0
  If LCase(Left(s, 2)) = "0x" Then
    Dim r As Double = 0
    For i As Long = 2 To Len(s) - 1
      Dim c As Long = s[i]
      Dim dv As Long
      If c >= 48 AndAlso c <= 57 Then
        dv = c - 48
      ElseIf c >= 97 AndAlso c <= 102 Then
        dv = c - 87
      ElseIf c >= 65 AndAlso c <= 70 Then
        dv = c - 55
      Else
        Return js_nan
      End If
      r = r * 16 + dv
    Next
    Return r
  End If
  If s = "Infinity" OrElse s = "+Infinity" Then Return js_inf
  If s = "-Infinity" Then Return -js_inf
  Dim endp As ZString Ptr
  Dim d As Double = strtod(StrPtr(s), @endp)
  If endp = StrPtr(s) OrElse *endp <> "" Then Return js_nan
  Return d
End Function

Function js_tonum(ByRef v As JsV) As Double
  Select Case v.tag
    Case JS_T_NUM, JS_T_BOOL
      Return v.n
    Case JS_T_UNDEF
      Return js_nan
    Case JS_T_NULL
      Return 0
    Case JS_T_STR
      Return js_parse_number(JSS(v))
    Case JS_T_BIG
      Return js_big_todouble(Cast(JsBigH Ptr, v.p))
    Case Else
      If v.p->kind = JS_K_ARR Then
        Dim a As JsArrH Ptr = Cast(JsArrH Ptr, v.p)
        If a->length = 0 Then Return 0
        If a->length = 1 Then Return js_tonum(a->items[0])
      End If
      Return js_nan
  End Select
End Function

' ToInt32 / ToUint32 of a double
Function js_toi32(ByVal d As Double) As Long
  If d >= -2147483648.0 AndAlso d <= 2147483647.0 Then Return CLng(js_dfix(d))
  If d <> d OrElse d = js_inf OrElse d = -js_inf Then Return 0
  Dim t As Double = js_dfix(d)
  Dim m As Double = t - js_dfloor(t / 4294967296.0) * 4294967296.0
  If m >= 2147483648.0 Then m -= 4294967296.0
  Return CLng(m)
End Function

Function js_tou32(ByVal d As Double) As ULong
  If d >= 0 AndAlso d <= 4294967295.0 Then Return CULng(js_dfix(d))
  If d <> d OrElse d = js_inf OrElse d = -js_inf Then Return 0
  Dim t As Double = js_dfix(d)
  Dim m As Double = t - js_dfloor(t / 4294967296.0) * 4294967296.0
  Return CULng(m)
End Function

Function js_truthy(ByRef v As JsV) As Long
  Select Case v.tag
    Case JS_T_UNDEF, JS_T_NULL
      Return 0
    Case JS_T_BOOL
      Return v.n <> 0
    Case JS_T_NUM
      Return v.n <> 0 AndAlso v.n = v.n
    Case JS_T_STR
      Return Len(JSS(v)) > 0
    Case JS_T_BIG
      Return Cast(JsBigH Ptr, v.p)->count > 0
    Case Else
      Return -1
  End Select
End Function

Function js_dtruthy(ByVal d As Double) As Long
  Return d <> 0 AndAlso d = d
End Function

Function js_typeof(ByRef v As JsV) As JsV
  Select Case v.tag
    Case JS_T_UNDEF
      Return js_str("undefined")
    Case JS_T_NULL
      Return js_str("object")
    Case JS_T_BOOL
      Return js_str("boolean")
    Case JS_T_NUM
      Return js_str("number")
    Case JS_T_STR
      Return js_str("string")
    Case JS_T_BIG
      Return js_str("bigint")
    Case Else
      If v.p->kind = JS_K_FN OrElse v.p->kind = JS_K_CLASS Then Return js_str("function")
      Return js_str("object")
  End Select
End Function

Function js_tostring(ByRef v As JsV) As String
  Select Case v.tag
    Case JS_T_UNDEF
      Return "undefined"
    Case JS_T_NULL
      Return "null"
    Case JS_T_BOOL
      Return IIf(v.n <> 0, "true", "false")
    Case JS_T_NUM
      Return js_numstr(v.n)
    Case JS_T_STR
      Return JSS(v)
    Case JS_T_BIG
      Return js_big_tostring(Cast(JsBigH Ptr, v.p))
    Case Else
      Select Case v.p->kind
        Case JS_K_ARR
          Dim a As JsArrH Ptr = Cast(JsArrH Ptr, v.p)
          Dim s As String
          For i As Long = 0 To a->length - 1
            If i > 0 Then s &= ","
            If a->items[i].tag > JS_T_NULL Then s &= js_tostring(a->items[i])
          Next
          Return s
        Case JS_K_TYPED
          Dim ta As JsTypedH Ptr = Cast(JsTypedH Ptr, v.p)
          Dim ts As String
          For i As Long = 0 To ta->length - 1
            If i > 0 Then ts &= ","
            ts &= js_tostring(js_index_get(v, i))
          Next
          Return ts
        Case JS_K_FN
          Return "function () { [native code] }"
        Case JS_K_OBJ, JS_K_CLASS
          Dim o As JsObjH Ptr = Cast(JsObjH Ptr, v.p)
          If o->cls <> 0 AndAlso js_has_method(v, SYM_toString) Then
            Dim r As JsV = js_callm(v, SYM_toString, 0, 0)
            If r.tag = JS_T_STR Then Return JSS(r)
          End If
          Dim m As JsV = js_getp(v, SYM_message)
          Dim nm As JsV = js_getp(v, SYM_name)
          If m.tag = JS_T_STR AndAlso nm.tag = JS_T_STR Then Return JSS(nm) & ": " & JSS(m)
          Return "[object " & "Object]"
        Case Else
          Return "[object " & "Object]"
      End Select
  End Select
End Function

Function js_tostrv(ByRef v As JsV) As JsV
  If v.tag = JS_T_STR Then Return v
  Return js_str(js_tostring(v))
End Function

' ---------------------------------------------------------------------------
' Arrays, objects, functions, classes, property access and method calls
' ---------------------------------------------------------------------------

' ---- arrays ----
Function js_arrh_new(ByVal n As Long) As JsArrH Ptr
  Dim a As JsArrH Ptr = New JsArrH
  a->rc = 1
  a->kind = JS_K_ARR
  a->cap = IIf(n < 4, 4, n)
  a->items = Allocate(a->cap * SizeOf(JsV))
  For i As Long = 0 To a->cap - 1
    a->items[i].Constructor()
  Next
  a->length = n
  Return a
End Function

Function js_arr_new(ByVal n As Long = 0) As JsV
  Return js_objv(js_arrh_new(n))
End Function

Sub js_arrh_reserve(ByVal a As JsArrH Ptr, ByVal n As Long)
  If n <= a->cap Then Exit Sub
  Dim nc As Long = a->cap * 2
  If nc < n Then nc = n
  a->items = Reallocate(a->items, nc * SizeOf(JsV))
  For i As Long = a->cap To nc - 1
    a->items[i].Constructor()
  Next
  a->cap = nc
End Sub

Sub js_arrh_setlen(ByVal a As JsArrH Ptr, ByVal n As Long)
  If n > a->length Then
    js_arrh_reserve(a, n)
  Else
    Dim u As JsV
    For i As Long = n To a->length - 1
      a->items[i] = u
    Next
  End If
  a->length = n
End Sub

Sub js_arrh_push(ByVal a As JsArrH Ptr, ByRef v As JsV)
  If a->length >= a->cap Then js_arrh_reserve(a, a->length + 1)
  a->items[a->length] = v
  a->length += 1
End Sub

' an array of numbers filled with one value
Function js_arr_fillnew(ByVal n As Long, ByRef v As JsV) As JsV
  Dim a As JsArrH Ptr = js_arrh_new(n)
  For i As Long = 0 To n - 1
    a->items[i] = v
  Next
  Return js_objv(a)
End Function

Function js_arr_from_bytes(ByVal p As UByte Ptr, ByVal n As Long) As JsV
  Dim a As JsArrH Ptr = js_arrh_new(n)
  For i As Long = 0 To n - 1
    a->items[i].tag = JS_T_NUM
    a->items[i].n = p[i]
  Next
  Return js_objv(a)
End Function

Function js_is_arr(ByRef v As JsV) As Long
  Return v.tag = JS_T_OBJ AndAlso v.p->kind = JS_K_ARR
End Function

' ArrayBuffer.isView: a typed array or a DataView
Function js_is_view(ByRef v As JsV) As Long
  Return v.tag = JS_T_OBJ AndAlso (v.p->kind = JS_K_TYPED OrElse v.p->kind = JS_K_DV)
End Function

Declare Function js_crt_time Cdecl Alias "time" (ByVal t As Any Ptr) As Long

' Date.now(): milliseconds since the epoch (to the second)
Function js_date_now() As Double
  Return CDbl(js_crt_time(0)) * 1000.0
End Function

' ---- objects ----
Function js_objh_new(ByVal klass As JsClassH Ptr) As JsObjH Ptr
  Dim o As JsObjH Ptr = New JsObjH
  o->rc = 1
  o->kind = JS_K_OBJ
  o->cls = klass
  If klass Then klass->rc += 1
  Return o
End Function

Function js_obj_new() As JsV
  Return js_objv(js_objh_new(0))
End Function

Function js_objh_find(ByVal o As JsObjH Ptr, ByVal sym As Long) As Long
  For i As Long = 0 To o->count - 1
    If o->keys[i] = sym Then Return i
  Next
  Return -1
End Function

Sub js_objh_set(ByVal o As JsObjH Ptr, ByVal sym As Long, ByRef v As JsV)
  Dim i As Long = js_objh_find(o, sym)
  If i >= 0 Then
    o->vals[i] = v
    Exit Sub
  End If
  If o->count >= o->cap Then
    Dim nc As Long = IIf(o->cap = 0, 8, o->cap * 2)
    o->keys = Reallocate(o->keys, nc * SizeOf(Long))
    o->vals = Reallocate(o->vals, nc * SizeOf(JsV))
    For k As Long = o->cap To nc - 1
      o->vals[k].Constructor()
    Next
    o->cap = nc
  End If
  o->keys[o->count] = sym
  o->vals[o->count] = v
  o->count += 1
End Sub

Sub js_objh_remove(ByVal o As JsObjH Ptr, ByVal sym As Long)
  Dim i As Long = js_objh_find(o, sym)
  If i < 0 Then Exit Sub
  For k As Long = i To o->count - 2
    o->keys[k] = o->keys[k + 1]
    o->vals[k] = o->vals[k + 1]
  Next
  Dim u As JsV
  o->vals[o->count - 1] = u
  o->count -= 1
End Sub

' ---- functions and closures ----
Function js_fn_new(ByVal fn As JsFnPtr, ByVal env As JsHeap Ptr = 0) As JsV
  Dim f As JsFnH Ptr = New JsFnH
  f->rc = 1
  f->kind = JS_K_FN
  f->fn = fn
  f->env = env
  If env Then env->rc += 1
  Return js_objv(f)
End Function

Function js_env_new(ByVal count As Long, ByVal parent As JsEnvH Ptr) As JsEnvH Ptr
  Dim e As JsEnvH Ptr = New JsEnvH
  e->rc = 1
  e->kind = JS_K_ENV
  e->count = count
  e->vars = Allocate(IIf(count < 1, 1, count) * SizeOf(JsV))
  For i As Long = 0 To count - 1
    e->vars[i].Constructor()
  Next
  e->parent = parent
  If parent Then parent->rc += 1
  Return e
End Function

Sub js_env_release(ByVal e As JsEnvH Ptr)
  If e = 0 Then Exit Sub
  e->rc -= 1
  If e->rc <= 0 Then Delete e
End Sub

' the variable at index i, up environments out
Function js_envvar(ByVal e As JsEnvH Ptr, ByVal up As Long, ByVal i As Long) As JsV Ptr
  For k As Long = 1 To up
    e = e->parent
  Next
  Return @e->vars[i]
End Function

Declare Function js_construct_new(ByRef klass As JsV, ByVal argv As JsV Ptr, ByVal argc As Long) As JsV

Function js_call(ByRef f As JsV, ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long) As JsV
  If f.tag <> JS_T_OBJ OrElse f.p->kind <> JS_K_FN Then
    If f.tag = JS_T_OBJ AndAlso f.p->kind = JS_K_CLASS Then Return js_construct_new(f, argv, argc)
    js_throw_error(js_tostring(f) & " is not a function", "TypeError")
  End If
  Dim h As JsFnH Ptr = Cast(JsFnH Ptr, f.p)
  If h->hasBound Then Return h->fn(h->bound, argv, argc, h->env)
  Return h->fn(self, argv, argc, h->env)
End Function

' call with up to 4 arguments given directly
Function js_call0(ByRef f As JsV) As JsV
  Dim u As JsV
  Return js_call(f, u, 0, 0)
End Function

Function js_call1(ByRef f As JsV, ByRef a As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 0) As JsV
  args(0) = a
  Return js_call(f, u, @args(0), 1)
End Function

Function js_call2(ByRef f As JsV, ByRef a As JsV, ByRef b As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 1) As JsV
  args(0) = a
  args(1) = b
  Return js_call(f, u, @args(0), 2)
End Function

Function js_call3(ByRef f As JsV, ByRef a As JsV, ByRef b As JsV, ByRef c As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 2) As JsV
  args(0) = a
  args(1) = b
  args(2) = c
  Return js_call(f, u, @args(0), 3)
End Function

' an argument, or undefined past the end
Function js_arg(ByVal argv As JsV Ptr, ByVal argc As Long, ByVal i As Long) As JsV
  If i < argc Then Return argv[i]
  Dim u As JsV
  Return u
End Function

Function js_argnum(ByVal argv As JsV Ptr, ByVal argc As Long, ByVal i As Long) As Double
  If i < argc Then
    If argv[i].tag = JS_T_NUM Then Return argv[i].n
    Return js_tonum(argv[i])
  End If
  Return js_nan
End Function

' the rest of the arguments from i, as an array
Function js_argrest(ByVal argv As JsV Ptr, ByVal argc As Long, ByVal i As Long) As JsV
  Dim n As Long = argc - i
  If n < 0 Then n = 0
  Dim a As JsArrH Ptr = js_arrh_new(n)
  For k As Long = 0 To n - 1
    a->items[k] = argv[i + k]
  Next
  Return js_objv(a)
End Function

' ---- classes ----
Function js_class_new(ByRef cname As String, ByVal parent As JsClassH Ptr, ByVal ctor As JsFnPtr) As JsV
  Dim c As JsClassH Ptr = New JsClassH
  c->rc = 1
  c->kind = JS_K_CLASS
  c->cname = cname
  c->parent = parent
  If parent Then parent->rc += 1
  c->ctor = ctor
  Return js_objv(c)
End Function

Function js_classh(ByRef v As JsV) As JsClassH Ptr
  If v.tag = JS_T_OBJ AndAlso v.p->kind = JS_K_CLASS Then Return Cast(JsClassH Ptr, v.p)
  Return 0
End Function

Sub js_class_add(ByRef cv As JsV, ByVal sym As Long, ByVal fn As JsFnPtr, ByVal mkind As Long)
  Dim c As JsClassH Ptr = js_classh(cv)
  If c->mcount >= c->mcap Then
    c->mcap = IIf(c->mcap = 0, 8, c->mcap * 2)
    c->methods = Reallocate(c->methods, c->mcap * SizeOf(JsMethodEntry))
  End If
  c->methods[c->mcount].sym = sym
  c->methods[c->mcount].fn = fn
  c->methods[c->mcount].kind = mkind
  c->mcount += 1
End Sub

' the method (kind 0), getter (1) or setter (2) of a class chain
Function js_class_lookup(ByVal c As JsClassH Ptr, ByVal sym As Long, ByVal mkind As Long) As JsFnPtr
  Do While c
    For i As Long = c->mcount - 1 To 0 Step -1
      If c->methods[i].sym = sym AndAlso c->methods[i].kind = mkind Then Return c->methods[i].fn
    Next
    c = c->parent
  Loop
  Return 0
End Function

Function js_class_has_accessor(ByVal c As JsClassH Ptr, ByVal sym As Long) As Long
  Return js_class_lookup(c, sym, 1) <> 0 OrElse js_class_lookup(c, sym, 2) <> 0
End Function

Function js_instanceof_cls(ByRef v As JsV, ByVal c As JsClassH Ptr) As Long
  If v.tag <> JS_T_OBJ OrElse c = 0 Then Return 0
  If v.p->kind <> JS_K_OBJ Then Return 0
  Dim k As JsClassH Ptr = Cast(JsObjH Ptr, v.p)->cls
  Do While k
    If k = c Then Return -1
    k = k->parent
  Loop
  Return 0
End Function

Sub js_construct(ByVal c As JsClassH Ptr, ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long)
  Do While c
    If c->ctor Then
      c->ctor(self, argv, argc, 0)
      Exit Sub
    End If
    c = c->parent
  Loop
End Sub

Function js_construct_new(ByRef klass As JsV, ByVal argv As JsV Ptr, ByVal argc As Long) As JsV
  Dim c As JsClassH Ptr = js_classh(klass)
  If c = 0 Then js_throw_error(js_tostring(klass) & " is not a constructor", "TypeError")
  Dim self As JsV = js_objv(js_objh_new(c))
  js_construct(c, self, argv, argc)
  Return self
End Function

' a method bound to its receiver, for a method read as a value
Function js_bound_method(ByVal fn As JsFnPtr, ByRef self As JsV) As JsV
  Dim f As JsV = js_fn_new(fn, 0)
  Dim h As JsFnH Ptr = Cast(JsFnH Ptr, f.p)
  h->bound = self
  h->hasBound = 1
  Return f
End Function

' ---- property access ----
Declare Function js_builtin_get(ByRef obj As JsV, ByVal sym As Long) As JsV
Declare Function js_builtin_call(ByRef obj As JsV, ByVal sym As Long, ByVal argv As JsV Ptr, ByVal argc As Long, ByRef handled As Long) As JsV
Declare Sub js_index_set(ByRef obj As JsV, ByVal i As Long, ByRef v As JsV)

Function js_getp(ByRef obj As JsV, ByVal sym As Long) As JsV
  If obj.tag = JS_T_OBJ Then
    Dim k As Long = obj.p->kind
    If k = JS_K_OBJ OrElse k = JS_K_CLASS Then
      Dim o As JsObjH Ptr = Cast(JsObjH Ptr, obj.p)
      Dim i As Long = js_objh_find(o, sym)
      If i >= 0 Then Return o->vals[i]
      Dim c As JsClassH Ptr = IIf(k = JS_K_CLASS, Cast(JsClassH Ptr, o)->parent, o->cls)
      If k = JS_K_CLASS Then
        ' a static member inherited from the parent class
        Dim pc As JsClassH Ptr = Cast(JsClassH Ptr, o)->parent
        Do While pc
          Dim j As Long = js_objh_find(pc, sym)
          If j >= 0 Then Return pc->vals[j]
          pc = pc->parent
        Loop
        Return js_builtin_get(obj, sym)
      End If
      If c Then
        Dim g As JsFnPtr = js_class_lookup(c, sym, 1)
        If g Then Return g(obj, 0, 0, 0)
        Dim m As JsFnPtr = js_class_lookup(c, sym, 0)
        If m Then Return js_bound_method(m, obj)
      End If
      Return js_builtin_get(obj, sym)
    End If
  End If
  If obj.tag <= JS_T_NULL Then js_throw_error("Cannot read properties of " & IIf(obj.tag = JS_T_NULL, "null", "undefined") & " (reading '" & js_symname(sym) & "')", "TypeError")
  Return js_builtin_get(obj, sym)
End Function

Sub js_setp(ByRef obj As JsV, ByVal sym As Long, ByRef v As JsV)
  If obj.tag = JS_T_OBJ Then
    Dim k As Long = obj.p->kind
    If k = JS_K_OBJ Then
      Dim o As JsObjH Ptr = Cast(JsObjH Ptr, obj.p)
      If o->cls Then
        Dim s As JsFnPtr = js_class_lookup(o->cls, sym, 2)
        If s Then
          Dim args(0 To 0) As JsV
          args(0) = v
          s(obj, @args(0), 1, 0)
          Exit Sub
        End If
      End If
      js_objh_set(o, sym, v)
      Exit Sub
    ElseIf k = JS_K_CLASS Then
      js_objh_set(Cast(JsObjH Ptr, obj.p), sym, v)
      Exit Sub
    ElseIf k = JS_K_ARR AndAlso sym = SYM_length Then
      js_arrh_setlen(Cast(JsArrH Ptr, obj.p), js_toi32(js_tonum(v)))
      Exit Sub
    End If
  End If
  If obj.tag <= JS_T_NULL Then js_throw_error("Cannot set properties of undefined (setting '" & js_symname(sym) & "')", "TypeError")
End Sub

' own property (or accessor/method) presence: JavaScript's name in obj
Function js_hasp(ByRef obj As JsV, ByVal sym As Long) As Long
  If obj.tag <> JS_T_OBJ Then Return 0
  Dim k As Long = obj.p->kind
  If k = JS_K_OBJ OrElse k = JS_K_CLASS Then
    Dim o As JsObjH Ptr = Cast(JsObjH Ptr, obj.p)
    If js_objh_find(o, sym) >= 0 Then Return -1
    If k = JS_K_OBJ AndAlso o->cls Then
      If js_class_lookup(o->cls, sym, 0) OrElse js_class_lookup(o->cls, sym, 1) OrElse js_class_lookup(o->cls, sym, 2) Then Return -1
    End If
    Return 0
  End If
  If k = JS_K_ARR Then Return sym = SYM_length
  Return 0
End Function

Function js_has_method(ByRef obj As JsV, ByVal sym As Long) As Long
  If obj.tag <> JS_T_OBJ OrElse obj.p->kind <> JS_K_OBJ Then Return 0
  Dim o As JsObjH Ptr = Cast(JsObjH Ptr, obj.p)
  If o->cls AndAlso js_class_lookup(o->cls, sym, 0) <> 0 Then Return -1
  Dim i As Long = js_objh_find(o, sym)
  If i >= 0 AndAlso o->vals[i].tag = JS_T_OBJ AndAlso o->vals[i].p->kind = JS_K_FN Then Return -1
  Return 0
End Function

' obj.name(args)
Function js_callm(ByRef obj As JsV, ByVal sym As Long, ByVal argv As JsV Ptr, ByVal argc As Long) As JsV
  If obj.tag = JS_T_OBJ Then
    Dim k As Long = obj.p->kind
    If k = JS_K_OBJ Then
      Dim o As JsObjH Ptr = Cast(JsObjH Ptr, obj.p)
      Dim i As Long = js_objh_find(o, sym)
      If i >= 0 Then Return js_call(o->vals[i], obj, argv, argc)
      If o->cls Then
        Dim m As JsFnPtr = js_class_lookup(o->cls, sym, 0)
        If m Then Return m(obj, argv, argc, 0)
        Dim g As JsFnPtr = js_class_lookup(o->cls, sym, 1)
        If g Then
          Dim f As JsV = g(obj, 0, 0, 0)
          Return js_call(f, obj, argv, argc)
        End If
      End If
    ElseIf k = JS_K_CLASS Then
      Dim c As JsClassH Ptr = Cast(JsClassH Ptr, obj.p)
      Do While c
        Dim i As Long = js_objh_find(c, sym)
        If i >= 0 Then Return js_call(c->vals[i], obj, argv, argc)
        c = c->parent
      Loop
    End If
  End If
  If obj.tag <= JS_T_NULL Then js_throw_error("Cannot read properties of " & IIf(obj.tag = JS_T_NULL, "null", "undefined") & " (reading '" & js_symname(sym) & "')", "TypeError")
  Dim handled As Long
  Dim r As JsV = js_builtin_call(obj, sym, argv, argc, handled)
  If handled Then Return r
  js_throw_error(js_symname(sym) & " is not a function", "TypeError")
  Return r
End Function

' super.name(args): the method of a class chain, on this receiver
Function js_callsuper(ByRef klass As JsV, ByVal sym As Long, ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long) As JsV
  Dim m As JsFnPtr = js_class_lookup(js_classh(klass), sym, 0)
  If m = 0 Then js_throw_error("super." & js_symname(sym) & " is not a function", "TypeError")
  Return m(self, argv, argc, 0)
End Function

Function js_getsuper(ByRef klass As JsV, ByVal sym As Long, ByRef self As JsV) As JsV
  Dim c As JsClassH Ptr = js_classh(klass)
  Dim g As JsFnPtr = js_class_lookup(c, sym, 1)
  If g Then Return g(self, 0, 0, 0)
  Return js_getp(self, sym)
End Function

' ---- dynamic keys: obj[key] ----
Function js_keysym(ByRef key As JsV) As Long
  If key.tag = JS_T_STR Then Return js_sym(JSS(key))
  Return js_sym(js_tostring(key))
End Function

Function js_get(ByRef obj As JsV, ByRef key As JsV) As JsV
  If key.tag = JS_T_NUM AndAlso obj.tag = JS_T_OBJ Then
    Dim k As Long = obj.p->kind
    If k = JS_K_ARR OrElse k = JS_K_TYPED Then
      If key.n >= 0 AndAlso key.n = js_dfloor(key.n) Then Return js_index_get(obj, CLng(key.n))
      Dim u As JsV
      Return u
    End If
  End If
  If key.tag = JS_T_NUM AndAlso obj.tag = JS_T_STR Then
    Dim s As String = JSS(obj)
    Dim i As Long = CLng(key.n)
    If i >= 0 AndAlso i < Len(s) Then Return js_str(Chr(s[i]))
    Dim u As JsV
    Return u
  End If
  Return js_getp(obj, js_keysym(key))
End Function

Sub js_set(ByRef obj As JsV, ByRef key As JsV, ByRef v As JsV)
  If key.tag = JS_T_NUM AndAlso obj.tag = JS_T_OBJ Then
    Dim k As Long = obj.p->kind
    If k = JS_K_ARR OrElse k = JS_K_TYPED Then
      js_index_set(obj, CLng(key.n), v)
      Exit Sub
    End If
  End If
  js_setp(obj, js_keysym(key), v)
End Sub

' ---------------------------------------------------------------------------
' Element access, typed arrays, ArrayBuffer, DataView
' ---------------------------------------------------------------------------

Function js_esize(ByVal ek As Long) As Long
  Select Case ek
    Case JS_E_U8, JS_E_U8C, JS_E_I8
      Return 1
    Case JS_E_U16, JS_E_I16
      Return 2
    Case JS_E_U32, JS_E_I32, JS_E_F32
      Return 4
    Case Else
      Return 8
  End Select
End Function

Function js_bufh_new(ByVal n As Long) As JsBufH Ptr
  Dim b As JsBufH Ptr = New JsBufH
  b->rc = 1
  b->kind = JS_K_BUF
  b->size = n
  b->bytes = CAllocate(IIf(n < 1, 1, n), 1)
  Return b
End Function

Function js_typed_over(ByVal ek As Long, ByVal b As JsBufH Ptr, ByVal offset As Long, ByVal n As Long) As JsV
  Dim t As JsTypedH Ptr = New JsTypedH
  t->rc = 1
  t->kind = JS_K_TYPED
  t->ek = ek
  t->esize = js_esize(ek)
  t->buf = b
  b->rc += 1
  t->offset = offset
  t->length = n
  Return js_objv(t)
End Function

Function js_typed_new(ByVal ek As Long, ByVal n As Long) As JsV
  Dim b As JsBufH Ptr = js_bufh_new(n * js_esize(ek))
  Dim r As JsV = js_typed_over(ek, b, 0, n)
  b->rc -= 1
  Return r
End Function

Declare Function js_big_from_double(ByVal d As Double) As JsV
Declare Function js_big_toint64(ByRef v As JsV) As LongInt
Declare Function js_big_fromu64(ByVal u As ULongInt, ByVal neg As Long) As JsV

' an element of a typed array as a double
Function js_typed_getn(ByVal t As JsTypedH Ptr, ByVal i As Long) As Double
  Dim p As UByte Ptr = t->buf->bytes + t->offset + i * t->esize
  Select Case t->ek
    Case JS_E_U8, JS_E_U8C
      Return *p
    Case JS_E_I8
      Return *Cast(Byte Ptr, p)
    Case JS_E_U16
      Return *Cast(UShort Ptr, p)
    Case JS_E_I16
      Return *Cast(Short Ptr, p)
    Case JS_E_U32
      Return *Cast(ULong Ptr, p)
    Case JS_E_I32
      Return *Cast(Long Ptr, p)
    Case JS_E_F32
      Return *Cast(Single Ptr, p)
    Case JS_E_F64
      Return *Cast(Double Ptr, p)
    Case JS_E_U64
      Return CDbl(*Cast(ULongInt Ptr, p))
    Case Else
      Return CDbl(*Cast(LongInt Ptr, p))
  End Select
End Function

Sub js_typed_setn(ByVal t As JsTypedH Ptr, ByVal i As Long, ByVal d As Double)
  Dim p As UByte Ptr = t->buf->bytes + t->offset + i * t->esize
  Select Case t->ek
    Case JS_E_U8
      *p = js_tou32(d) And 255
    Case JS_E_U8C
      If d <> d OrElse d <= 0 Then
        *p = 0
      ElseIf d >= 255 Then
        *p = 255
      Else
        ' round half to even
        Dim f As Double = js_dfloor(d)
        Dim r As Double = d - f
        If r > 0.5 OrElse (r = 0.5 AndAlso (CLng(f) And 1)) Then f += 1
        *p = CUByte(f)
      End If
    Case JS_E_I8
      *Cast(Byte Ptr, p) = CByte(js_toi32(d) And 255)
    Case JS_E_U16
      *Cast(UShort Ptr, p) = js_tou32(d) And 65535
    Case JS_E_I16
      *Cast(UShort Ptr, p) = js_tou32(d) And 65535
    Case JS_E_U32
      *Cast(ULong Ptr, p) = js_tou32(d)
    Case JS_E_I32
      *Cast(Long Ptr, p) = js_toi32(d)
    Case JS_E_F32
      *Cast(Single Ptr, p) = CSng(d)
    Case JS_E_F64
      *Cast(Double Ptr, p) = d
    Case JS_E_U64
      *Cast(ULongInt Ptr, p) = CULngInt(d)
    Case Else
      *Cast(LongInt Ptr, p) = CLngInt(d)
  End Select
End Sub

Function js_typed_get(ByVal t As JsTypedH Ptr, ByVal i As Long) As JsV
  If t->ek = JS_E_U64 Then Return js_big_fromu64(*Cast(ULongInt Ptr, t->buf->bytes + t->offset + i * 8), 0)
  If t->ek = JS_E_I64 Then
    Dim s As LongInt = *Cast(LongInt Ptr, t->buf->bytes + t->offset + i * 8)
    Return js_big_fromu64(IIf(s < 0, CULngInt(-s), CULngInt(s)), s < 0)
  End If
  Return js_num(js_typed_getn(t, i))
End Function

Sub js_typed_set(ByVal t As JsTypedH Ptr, ByVal i As Long, ByRef v As JsV)
  If t->ek = JS_E_U64 OrElse t->ek = JS_E_I64 Then
    *Cast(LongInt Ptr, t->buf->bytes + t->offset + i * 8) = js_big_toint64(v)
    Exit Sub
  End If
  If v.tag = JS_T_NUM Then
    js_typed_setn(t, i, v.n)
  Else
    js_typed_setn(t, i, js_tonum(v))
  End If
End Sub

Function js_index_get(ByRef obj As JsV, ByVal i As Long) As JsV
  If obj.tag = JS_T_OBJ Then
    Select Case obj.p->kind
      Case JS_K_ARR
        Dim a As JsArrH Ptr = Cast(JsArrH Ptr, obj.p)
        If i >= 0 AndAlso i < a->length Then Return a->items[i]
      Case JS_K_TYPED
        Dim t As JsTypedH Ptr = Cast(JsTypedH Ptr, obj.p)
        If i >= 0 AndAlso i < t->length Then Return js_typed_get(t, i)
      Case Else
        Return js_getp(obj, js_sym(Str(i)))
    End Select
  ElseIf obj.tag = JS_T_STR Then
    Dim s As String = JSS(obj)
    If i >= 0 AndAlso i < Len(s) Then Return js_str(Chr(s[i]))
  ElseIf obj.tag <= JS_T_NULL Then
    js_throw_error("Cannot read properties of undefined (reading '" & i & "')", "TypeError")
  End If
  Dim u As JsV
  Return u
End Function

Sub js_index_set(ByRef obj As JsV, ByVal i As Long, ByRef v As JsV)
  If obj.tag = JS_T_OBJ Then
    Select Case obj.p->kind
      Case JS_K_ARR
        Dim a As JsArrH Ptr = Cast(JsArrH Ptr, obj.p)
        If i < 0 Then Exit Sub
        If i >= a->length Then js_arrh_setlen(a, i + 1)
        a->items[i] = v
        Exit Sub
      Case JS_K_TYPED
        Dim t As JsTypedH Ptr = Cast(JsTypedH Ptr, obj.p)
        If i >= 0 AndAlso i < t->length Then js_typed_set(t, i, v)
        Exit Sub
      Case Else
        js_setp(obj, js_sym(Str(i)), v)
        Exit Sub
    End Select
  End If
  If obj.tag <= JS_T_NULL Then js_throw_error("Cannot set properties of undefined (setting '" & i & "')", "TypeError")
End Sub

' element as a number (the hot path of byte and word arrays)
Function js_idxn(ByRef obj As JsV, ByVal d As Double) As Double
  Dim i As Long = CLng(d)
  If obj.tag = JS_T_OBJ Then
    If obj.p->kind = JS_K_ARR Then
      Dim a As JsArrH Ptr = Cast(JsArrH Ptr, obj.p)
      If i >= 0 AndAlso i < a->length AndAlso d = i Then
        If a->items[i].tag = JS_T_NUM Then Return a->items[i].n
        Return js_tonum(a->items[i])
      End If
      Return js_nan
    ElseIf obj.p->kind = JS_K_TYPED Then
      Dim t As JsTypedH Ptr = Cast(JsTypedH Ptr, obj.p)
      If i >= 0 AndAlso i < t->length AndAlso d = i Then Return js_typed_getn(t, i)
      Return js_nan
    End If
  End If
  Dim key As JsV = js_num(d)
  Dim r As JsV = js_get(obj, key)
  Return js_tonum(r)
End Function

Sub js_setidxn(ByRef obj As JsV, ByVal d As Double, ByVal v As Double)
  Dim i As Long = CLng(d)
  If obj.tag = JS_T_OBJ AndAlso d = i AndAlso i >= 0 Then
    If obj.p->kind = JS_K_ARR Then
      Dim a As JsArrH Ptr = Cast(JsArrH Ptr, obj.p)
      If i >= a->length Then js_arrh_setlen(a, i + 1)
      Dim it As JsV Ptr = @a->items[i]
      If it->p Then
        Dim nv As JsV = js_num(v)
        *it = nv
      Else
        it->tag = JS_T_NUM
        it->n = v
      End If
      Exit Sub
    ElseIf obj.p->kind = JS_K_TYPED Then
      Dim t As JsTypedH Ptr = Cast(JsTypedH Ptr, obj.p)
      If i < t->length Then js_typed_setn(t, i, v)
      Exit Sub
    End If
  End If
  Dim key As JsV = js_num(d)
  Dim nv As JsV = js_num(v)
  js_set(obj, key, nv)
End Sub

Function js_idx(ByRef obj As JsV, ByVal d As Double) As JsV
  If d = js_dfloor(d) AndAlso d >= 0 AndAlso d < 2147483647 Then Return js_index_get(obj, CLng(d))
  Dim key As JsV = js_num(d)
  Return js_get(obj, key)
End Function

Sub js_setidx(ByRef obj As JsV, ByVal d As Double, ByRef v As JsV)
  If d = js_dfloor(d) AndAlso d >= 0 AndAlso d < 2147483647 Then
    js_index_set(obj, CLng(d), v)
    Exit Sub
  End If
  Dim key As JsV = js_num(d)
  js_set(obj, key, v)
End Sub

Function js_length(ByRef obj As JsV) As Double
  If obj.tag = JS_T_OBJ Then
    Select Case obj.p->kind
      Case JS_K_ARR
        Return Cast(JsArrH Ptr, obj.p)->length
      Case JS_K_TYPED
        Return Cast(JsTypedH Ptr, obj.p)->length
      Case JS_K_BUF
        Return Cast(JsBufH Ptr, obj.p)->size
    End Select
  ElseIf obj.tag = JS_T_STR Then
    Return Len(JSS(obj))
  End If
  Dim r As JsV = js_getp(obj, SYM_length)
  Return js_tonum(r)
End Function

' the values of an array-like (array, typed array, string) as a new plain array
Function js_toarr(ByRef v As JsV) As JsV
  If v.tag = JS_T_OBJ AndAlso v.p->kind = JS_K_ARR Then Return v
  Dim n As Long = js_length(v)
  Dim a As JsArrH Ptr = js_arrh_new(n)
  For i As Long = 0 To n - 1
    a->items[i] = js_index_get(v, i)
  Next
  Return js_objv(a)
End Function

Function js_typed_from(ByVal ek As Long, ByRef src As JsV) As JsV
  If src.tag = JS_T_NUM Then Return js_typed_new(ek, CLng(src.n))
  If src.tag = JS_T_OBJ AndAlso src.p->kind = JS_K_BUF Then
    Dim b As JsBufH Ptr = Cast(JsBufH Ptr, src.p)
    Return js_typed_over(ek, b, 0, b->size \ js_esize(ek))
  End If
  If src.tag <= JS_T_NULL Then Return js_typed_new(ek, 0)
  Dim n As Long = js_length(src)
  Dim r As JsV = js_typed_new(ek, n)
  Dim t As JsTypedH Ptr = Cast(JsTypedH Ptr, r.p)
  For i As Long = 0 To n - 1
    Dim e As JsV = js_index_get(src, i)
    js_typed_set(t, i, e)
  Next
  Return r
End Function

Function js_typed_view(ByVal ek As Long, ByRef bufv As JsV, ByRef offv As JsV, ByRef lenv As JsV) As JsV
  ' only an ArrayBuffer is viewed; numbers, arrays and typed arrays are copied (JS ctor semantics)
  If bufv.tag <> JS_T_OBJ OrElse bufv.p->kind <> JS_K_BUF Then Return js_typed_from(ek, bufv)
  Dim b As JsBufH Ptr = Cast(JsBufH Ptr, bufv.p)
  Dim off As Long = IIf(offv.tag = JS_T_UNDEF, 0, CLng(js_tonum(offv)))
  Dim n As Long = IIf(lenv.tag = JS_T_UNDEF, (b->size - off) \ js_esize(ek), CLng(js_tonum(lenv)))
  Return js_typed_over(ek, b, off, n)
End Function

Function js_buffer_new(ByVal n As Long) As JsV
  Return js_objv(js_bufh_new(n))
End Function

' typed array .buffer: its backing store (shared)
Function js_typed_buffer(ByRef v As JsV) As JsV
  Dim t As JsTypedH Ptr = Cast(JsTypedH Ptr, v.p)
  t->buf->rc += 1
  Return js_objv(t->buf)
End Function

Function js_subarray(ByRef v As JsV, ByVal a As Double, ByVal b As Double, ByVal hasEnd As Long) As JsV
  Dim t As JsTypedH Ptr = Cast(JsTypedH Ptr, v.p)
  Dim n As Long = t->length
  Dim s As Long = IIf(a < 0, n + a, a)
  If s < 0 Then s = 0
  If s > n Then s = n
  Dim e As Long = IIf(hasEnd, IIf(b < 0, n + b, b), n)
  If e < 0 Then e = 0
  If e > n Then e = n
  If e < s Then e = s
  Return js_typed_over(t->ek, t->buf, t->offset + s * t->esize, e - s)
End Function

' ---- DataView ----
Function js_dataview_new(ByRef bufv As JsV, ByRef offv As JsV, ByRef lenv As JsV) As JsV
  Dim b As JsBufH Ptr
  If bufv.tag = JS_T_OBJ AndAlso bufv.p->kind = JS_K_BUF Then
    b = Cast(JsBufH Ptr, bufv.p)
  ElseIf bufv.tag = JS_T_OBJ AndAlso bufv.p->kind = JS_K_TYPED Then
    b = Cast(JsTypedH Ptr, bufv.p)->buf
  Else
    js_throw_error("DataView needs an ArrayBuffer", "TypeError")
  End If
  Dim d As JsDvH Ptr = New JsDvH
  d->rc = 1
  d->kind = JS_K_DV
  d->buf = b
  b->rc += 1
  d->offset = IIf(offv.tag = JS_T_UNDEF, 0, CLng(js_tonum(offv)))
  d->length = IIf(lenv.tag = JS_T_UNDEF, b->size - d->offset, CLng(js_tonum(lenv)))
  Return js_objv(d)
End Function

Function js_dv_get(ByRef dv As JsV, ByVal ek As Long, ByVal at As Double, ByVal little As Long) As JsV
  Dim d As JsDvH Ptr = Cast(JsDvH Ptr, dv.p)
  Dim sz As Long = js_esize(ek)
  Dim at_ As Long = CLng(at)
  If at_ < 0 OrElse at_ + sz > d->length Then js_throw_error("Offset is outside the bounds of the DataView", "RangeError")
  Dim tmp(0 To 7) As UByte
  For k As Long = 0 To sz - 1
    tmp(k) = d->buf->bytes[d->offset + at_ + IIf(little, k, sz - 1 - k)]
  Next
  Dim b As JsBufH Ptr = js_bufh_new(8)
  memcpy(b->bytes, @tmp(0), 8)
  Dim t As JsV = js_typed_over(ek, b, 0, 1)
  b->rc -= 1
  Return js_typed_get(Cast(JsTypedH Ptr, t.p), 0)
End Function

Sub js_dv_set(ByRef dv As JsV, ByVal ek As Long, ByVal at As Double, ByRef v As JsV, ByVal little As Long)
  Dim d As JsDvH Ptr = Cast(JsDvH Ptr, dv.p)
  Dim sz As Long = js_esize(ek)
  Dim at_ As Long = CLng(at)
  If at_ < 0 OrElse at_ + sz > d->length Then js_throw_error("Offset is outside the bounds of the DataView", "RangeError")
  Dim t As JsV = js_typed_new(ek, 1)
  Dim th As JsTypedH Ptr = Cast(JsTypedH Ptr, t.p)
  js_typed_set(th, 0, v)
  For k As Long = 0 To sz - 1
    d->buf->bytes[d->offset + at_ + IIf(little, k, sz - 1 - k)] = th->buf->bytes[k]
  Next
End Sub

' ---------------------------------------------------------------------------
' BigInt: arbitrary precision integers, sign and magnitude in 32-bit limbs
' ---------------------------------------------------------------------------

Function js_bigh_alloc(ByVal count As Long) As JsBigH Ptr
  Dim b As JsBigH Ptr = New JsBigH
  b->rc = 1
  b->kind = JS_K_BIG
  b->count = count
  b->limbs = CAllocate(IIf(count < 1, 1, count), SizeOf(ULong))
  Return b
End Function

Sub js_bigh_trim(ByVal b As JsBigH Ptr)
  Do While b->count > 0 AndAlso b->limbs[b->count - 1] = 0
    b->count -= 1
  Loop
  If b->count = 0 Then b->neg = 0
End Sub

Function js_bigv(ByVal b As JsBigH Ptr) As JsV
  js_bigh_trim(b)
  Dim r As JsV
  r.tag = JS_T_BIG
  r.p = b
  Return r
End Function

Function js_big_fromu64(ByVal u As ULongInt, ByVal neg As Long) As JsV
  Dim b As JsBigH Ptr = js_bigh_alloc(2)
  b->limbs[0] = CULng(u And &HFFFFFFFFull)
  b->limbs[1] = CULng(u Shr 32)
  b->neg = IIf(neg AndAlso u <> 0, 1, 0)
  Return js_bigv(b)
End Function

Function js_big_from_double(ByVal d As Double) As JsV
  If d <> d OrElse d = js_inf OrElse d = -js_inf OrElse (Abs(d) < 4503599627370496.0 AndAlso d <> js_dfloor(d)) Then
    js_throw_error("The number " & js_numstr(d) & " cannot be converted to a BigInt because it is not an integer", "RangeError")
  End If
  Dim neg As Long = d < 0
  Dim v As Double = Abs(d)
  ' a double integer has at most 1024 bits
  Dim limbs(0 To 33) As ULong
  Dim n As Long = 0
  Do While v > 0
    Dim q As Double = js_dfloor(v / 4294967296.0)
    limbs(n) = CULng(v - q * 4294967296.0)
    n += 1
    v = q
  Loop
  Dim b As JsBigH Ptr = js_bigh_alloc(n)
  For i As Long = 0 To n - 1
    b->limbs[i] = limbs(i)
  Next
  b->neg = IIf(neg, 1, 0)
  Return js_bigv(b)
End Function

Function js_big_todouble(ByVal b As JsBigH Ptr) As Double
  Dim r As Double = 0
  For i As Long = b->count - 1 To 0 Step -1
    r = r * 4294967296.0 + b->limbs[i]
  Next
  Return IIf(b->neg, -r, r)
End Function

Function js_tobig(ByRef v As JsV) As JsV
  Select Case v.tag
    Case JS_T_BIG
      Return v
    Case JS_T_NUM
      Return js_big_from_double(v.n)
    Case JS_T_BOOL
      Return js_big_from_double(v.n)
    Case JS_T_STR
      Dim s As String = Trim(JSS(v))
      Dim neg As Long = 0
      If Left(s, 1) = "-" Then neg = 1 : s = Mid(s, 2)
      If Left(s, 1) = "+" Then s = Mid(s, 2)
      Dim radix As Long = 10
      If LCase(Left(s, 2)) = "0x" Then radix = 16 : s = Mid(s, 3)
      If LCase(Left(s, 2)) = "0b" Then radix = 2 : s = Mid(s, 3)
      If LCase(Left(s, 2)) = "0o" Then radix = 8 : s = Mid(s, 3)
      Dim b As JsBigH Ptr = js_bigh_alloc(Len(s) \ 2 + 2)
      b->count = 0
      For i As Long = 0 To Len(s) - 1
        Dim c As Long = s[i]
        Dim dv As Long
        If c >= 48 AndAlso c <= 57 Then
          dv = c - 48
        ElseIf c >= 97 AndAlso c <= 122 Then
          dv = c - 87
        ElseIf c >= 65 AndAlso c <= 90 Then
          dv = c - 55
        Else
          dv = 99
        End If
        If dv >= radix Then
          Delete b
          js_throw_error("Cannot convert " & JSS(v) & " to a BigInt", "SyntaxError")
        End If
        ' b = b * radix + dv
        Dim carry As ULongInt = dv
        For k As Long = 0 To b->count - 1
          Dim t As ULongInt = CULngInt(b->limbs[k]) * radix + carry
          b->limbs[k] = CULng(t And &HFFFFFFFFull)
          carry = t Shr 32
        Next
        If carry Then
          b->limbs[b->count] = CULng(carry)
          b->count += 1
        End If
      Next
      b->neg = neg
      Return js_bigv(b)
    Case Else
      js_throw_error("Cannot convert " & js_tostring(v) & " to a BigInt", "TypeError")
  End Select
  Return v
End Function

' compare magnitudes
Function js_bigh_cmpmag(ByVal a As JsBigH Ptr, ByVal b As JsBigH Ptr) As Long
  If a->count <> b->count Then Return IIf(a->count > b->count, 1, -1)
  For i As Long = a->count - 1 To 0 Step -1
    If a->limbs[i] <> b->limbs[i] Then Return IIf(a->limbs[i] > b->limbs[i], 1, -1)
  Next
  Return 0
End Function

Function js_bigh_addmag(ByVal a As JsBigH Ptr, ByVal b As JsBigH Ptr) As JsBigH Ptr
  Dim n As Long = IIf(a->count > b->count, a->count, b->count) + 1
  Dim r As JsBigH Ptr = js_bigh_alloc(n)
  Dim carry As ULongInt = 0
  For i As Long = 0 To n - 1
    Dim s As ULongInt = carry
    If i < a->count Then s += a->limbs[i]
    If i < b->count Then s += b->limbs[i]
    r->limbs[i] = CULng(s And &HFFFFFFFFull)
    carry = s Shr 32
  Next
  Return r
End Function

' |a| - |b| for |a| >= |b|
Function js_bigh_submag(ByVal a As JsBigH Ptr, ByVal b As JsBigH Ptr) As JsBigH Ptr
  Dim r As JsBigH Ptr = js_bigh_alloc(a->count)
  Dim borrow As LongInt = 0
  For i As Long = 0 To a->count - 1
    Dim s As LongInt = CLngInt(a->limbs[i]) - borrow
    If i < b->count Then s -= b->limbs[i]
    If s < 0 Then
      s += 4294967296ll
      borrow = 1
    Else
      borrow = 0
    End If
    r->limbs[i] = CULng(s)
  Next
  Return r
End Function

Function js_bigh(ByRef v As JsV) As JsBigH Ptr
  Return Cast(JsBigH Ptr, v.p)
End Function

Function js_big_addsub(ByRef x As JsV, ByRef y As JsV, ByVal subtract As Long) As JsV
  Dim a As JsBigH Ptr = js_bigh(x)
  Dim b As JsBigH Ptr = js_bigh(y)
  Dim bneg As Long = IIf(subtract, IIf(b->count = 0, 0, 1 - b->neg), b->neg)
  Dim r As JsBigH Ptr
  If a->neg = bneg Then
    r = js_bigh_addmag(a, b)
    r->neg = a->neg
  ElseIf js_bigh_cmpmag(a, b) >= 0 Then
    r = js_bigh_submag(a, b)
    r->neg = a->neg
  Else
    r = js_bigh_submag(b, a)
    r->neg = bneg
  End If
  Return js_bigv(r)
End Function

Function js_big_mul(ByRef x As JsV, ByRef y As JsV) As JsV
  Dim a As JsBigH Ptr = js_bigh(x)
  Dim b As JsBigH Ptr = js_bigh(y)
  Dim r As JsBigH Ptr = js_bigh_alloc(a->count + b->count + 1)
  For i As Long = 0 To a->count - 1
    Dim carry As ULongInt = 0
    Dim ai As ULongInt = a->limbs[i]
    If ai = 0 Then Continue For
    For j As Long = 0 To b->count - 1
      Dim t As ULongInt = ai * b->limbs[j] + r->limbs[i + j] + carry
      r->limbs[i + j] = CULng(t And &HFFFFFFFFull)
      carry = t Shr 32
    Next
    Dim k As Long = i + b->count
    Do While carry
      Dim t As ULongInt = CULngInt(r->limbs[k]) + carry
      r->limbs[k] = CULng(t And &HFFFFFFFFull)
      carry = t Shr 32
      k += 1
    Loop
  Next
  r->neg = a->neg Xor b->neg
  Return js_bigv(r)
End Function

' magnitude division: q = |a| / |b|, r = |a| mod |b| (schoolbook, bit by bit for multi-limb divisors)
Sub js_bigh_divmod(ByVal a As JsBigH Ptr, ByVal b As JsBigH Ptr, ByRef q As JsBigH Ptr, ByRef r As JsBigH Ptr)
  If b->count = 0 Then js_throw_error("Division by zero", "RangeError")
  q = js_bigh_alloc(a->count)
  If b->count = 1 Then
    Dim d As ULongInt = b->limbs[0]
    Dim rem_ As ULongInt = 0
    For i As Long = a->count - 1 To 0 Step -1
      Dim cur As ULongInt = (rem_ Shl 32) Or a->limbs[i]
      q->limbs[i] = CULng(cur \ d)
      rem_ = cur Mod d
    Next
    r = js_bigh_alloc(1)
    r->limbs[0] = CULng(rem_)
    js_bigh_trim(q)
    js_bigh_trim(r)
    Exit Sub
  End If
  r = js_bigh_alloc(b->count + 1)
  r->count = 0
  Dim bits As Long = a->count * 32
  For i As Long = bits - 1 To 0 Step -1
    ' r = r * 2 + bit i of a
    Dim carry As ULong = (a->limbs[i \ 32] Shr (i Mod 32)) And 1
    For k As Long = 0 To r->count - 1
      Dim nb As ULong = r->limbs[k] Shr 31
      r->limbs[k] = (r->limbs[k] Shl 1) Or carry
      carry = nb
    Next
    If carry Then
      r->limbs[r->count] = carry
      r->count += 1
    End If
    If js_bigh_cmpmag(r, b) >= 0 Then
      Dim t As JsBigH Ptr = js_bigh_submag(r, b)
      js_bigh_trim(t)
      For k As Long = 0 To b->count
        r->limbs[k] = IIf(k < t->count, t->limbs[k], 0)
      Next
      r->count = t->count
      Delete t
      q->limbs[i \ 32] Or= CULng(1) Shl (i Mod 32)
    End If
  Next
  js_bigh_trim(q)
  js_bigh_trim(r)
End Sub

' BigInt / truncates toward zero, % takes the dividend's sign
Function js_big_div(ByRef x As JsV, ByRef y As JsV) As JsV
  Dim q As JsBigH Ptr, r As JsBigH Ptr
  js_bigh_divmod(js_bigh(x), js_bigh(y), q, r)
  Delete r
  q->neg = js_bigh(x)->neg Xor js_bigh(y)->neg
  Return js_bigv(q)
End Function

Function js_big_mod(ByRef x As JsV, ByRef y As JsV) As JsV
  Dim q As JsBigH Ptr, r As JsBigH Ptr
  js_bigh_divmod(js_bigh(x), js_bigh(y), q, r)
  Delete q
  r->neg = js_bigh(x)->neg
  Return js_bigv(r)
End Function

Function js_big_cmp(ByRef x As JsV, ByRef y As JsV) As Long
  Dim a As JsBigH Ptr = js_bigh(x)
  Dim b As JsBigH Ptr = js_bigh(y)
  If a->neg <> b->neg Then Return IIf(a->neg, -1, 1)
  Dim c As Long = js_bigh_cmpmag(a, b)
  Return IIf(a->neg, -c, c)
End Function

' two's complement limbs of a value, n limbs wide
Sub js_bigh_twos(ByVal a As JsBigH Ptr, ByVal limbs As ULong Ptr, ByVal n As Long)
  For i As Long = 0 To n - 1
    limbs[i] = IIf(i < a->count, a->limbs[i], 0)
  Next
  If a->neg Then
    Dim carry As ULongInt = 1
    For i As Long = 0 To n - 1
      Dim t As ULongInt = CULngInt(Not limbs[i]) + carry
      limbs[i] = CULng(t And &HFFFFFFFFull)
      carry = t Shr 32
    Next
  End If
End Sub

Function js_bigh_from_twos(ByVal limbs As ULong Ptr, ByVal n As Long) As JsV
  Dim b As JsBigH Ptr = js_bigh_alloc(n)
  Dim neg As Long = (limbs[n - 1] Shr 31) And 1
  For i As Long = 0 To n - 1
    b->limbs[i] = limbs[i]
  Next
  If neg Then
    Dim carry As ULongInt = 1
    For i As Long = 0 To n - 1
      Dim t As ULongInt = CULngInt(Not b->limbs[i]) + carry
      b->limbs[i] = CULng(t And &HFFFFFFFFull)
      carry = t Shr 32
    Next
    b->neg = 1
  End If
  Return js_bigv(b)
End Function

' & | ^ on BigInts (two's complement of infinite width)
Function js_big_bitop(ByRef x As JsV, ByRef y As JsV, ByVal op As Long) As JsV
  Dim a As JsBigH Ptr = js_bigh(x)
  Dim b As JsBigH Ptr = js_bigh(y)
  Dim n As Long = IIf(a->count > b->count, a->count, b->count) + 1
  Dim la As ULong Ptr = Allocate(n * 4)
  Dim lb As ULong Ptr = Allocate(n * 4)
  js_bigh_twos(a, la, n)
  js_bigh_twos(b, lb, n)
  For i As Long = 0 To n - 1
    Select Case op
      Case 0
        la[i] = la[i] And lb[i]
      Case 1
        la[i] = la[i] Or lb[i]
      Case Else
        la[i] = la[i] Xor lb[i]
    End Select
  Next
  Dim r As JsV = js_bigh_from_twos(la, n)
  Deallocate(la)
  Deallocate(lb)
  Return r
End Function

Function js_big_not(ByRef x As JsV) As JsV
  ' ~x = -x - 1
  Dim one As JsV = js_big_fromu64(1, 0)
  Dim nx As JsV = js_big_addsub(js_big_fromu64(0, 0), x, 1)
  Return js_big_addsub(nx, one, 1)
End Function

Function js_big_shl(ByRef x As JsV, ByVal n As Long) As JsV
  Dim a As JsBigH Ptr = js_bigh(x)
  If n < 0 Then
    ' x >> -n
    Dim m As Long = -n
    If a->neg Then
      ' floor division by 2^m for negatives
      Dim one As JsV = js_big_fromu64(1, 0)
      Dim t As JsV = js_big_addsub(x, one, 0)
      Dim tb As JsBigH Ptr = js_bigh(t)
      Dim mag As JsV = js_big_fromu64(0, 0)
      Dim at_ As JsBigH Ptr = js_bigh_alloc(tb->count)
      For i As Long = 0 To tb->count - 1
        at_->limbs[i] = tb->limbs[i]
      Next
      Dim pv As JsV = js_bigv(at_)
      Dim sh As JsV = js_big_shl(pv, -m)
      Dim r As JsV = js_big_addsub(js_big_fromu64(0, 0), sh, 1)
      Return js_big_addsub(r, one, 1)
    End If
    Dim ws As Long = m \ 32
    Dim bs As Long = m Mod 32
    If ws >= a->count Then Return js_big_fromu64(0, 0)
    Dim r As JsBigH Ptr = js_bigh_alloc(a->count - ws)
    For i As Long = 0 To r->count - 1
      Dim lo As ULongInt = a->limbs[i + ws]
      Dim hi As ULongInt = IIf(i + ws + 1 < a->count, a->limbs[i + ws + 1], 0)
      r->limbs[i] = CULng((((hi Shl 32) Or lo) Shr bs) And &HFFFFFFFFull)
    Next
    Return js_bigv(r)
  End If
  Dim ws As Long = n \ 32
  Dim bs As Long = n Mod 32
  Dim r As JsBigH Ptr = js_bigh_alloc(a->count + ws + 1)
  For i As Long = 0 To a->count - 1
    Dim t As ULongInt = CULngInt(a->limbs[i]) Shl bs
    r->limbs[i + ws] Or= CULng(t And &HFFFFFFFFull)
    r->limbs[i + ws + 1] Or= CULng(t Shr 32)
  Next
  r->neg = a->neg
  Return js_bigv(r)
End Function

Function js_big_pow(ByRef x As JsV, ByRef y As JsV) As JsV
  Dim e As Double = js_big_todouble(js_bigh(y))
  If e < 0 Then js_throw_error("Exponent must be non-negative", "RangeError")
  Dim result As JsV = js_big_fromu64(1, 0)
  Dim base_ As JsV = x
  Dim k As LongInt = CLngInt(e)
  Do While k > 0
    If k And 1 Then result = js_big_mul(result, base_)
    k Shr= 1
    If k Then base_ = js_big_mul(base_, base_)
  Loop
  Return result
End Function

Function js_big_toint64(ByRef v As JsV) As LongInt
  Dim b As JsV = js_tobig(v)
  Dim h As JsBigH Ptr = js_bigh(b)
  Dim lim(0 To 1) As ULong
  js_bigh_twos(h, @lim(0), 2)
  Return CLngInt((CULngInt(lim(1)) Shl 32) Or lim(0))
End Function

Function js_big_asuintn(ByVal bits As Long, ByRef v As JsV) As JsV
  Dim h As JsBigH Ptr = js_bigh(v)
  Dim n As Long = (bits + 31) \ 32 + 1
  If n < h->count + 1 Then n = h->count + 1
  Dim lim As ULong Ptr = Allocate(n * 4)
  js_bigh_twos(h, lim, n)
  Dim r As JsBigH Ptr = js_bigh_alloc((bits + 31) \ 32)
  For i As Long = 0 To r->count - 1
    r->limbs[i] = lim[i]
  Next
  If bits Mod 32 Then r->limbs[r->count - 1] And= (CULng(1) Shl (bits Mod 32)) - 1
  Deallocate(lim)
  Return js_bigv(r)
End Function

Function js_big_asintn(ByVal bits As Long, ByRef v As JsV) As JsV
  Dim u As JsV = js_big_asuintn(bits, v)
  ' the top bit set: subtract 2^bits
  Dim top As JsV = js_big_shl(js_big_fromu64(1, 0), bits - 1)
  If js_big_cmp(u, top) >= 0 Then
    Dim full As JsV = js_big_shl(js_big_fromu64(1, 0), bits)
    Return js_big_addsub(u, full, 1)
  End If
  Return u
End Function

Function js_big_tostring(ByVal h As JsBigH Ptr, ByVal radix As Long = 10) As String
  If h->count = 0 Then Return "0"
  Dim digits As String = "0123456789abcdefghijklmnopqrstuvwxyz"
  Dim tmp As ULong Ptr = Allocate(h->count * 4)
  memcpy(tmp, h->limbs, h->count * 4)
  Dim n As Long = h->count
  Dim s As String
  Do While n > 0
    Dim rem_ As ULongInt = 0
    For i As Long = n - 1 To 0 Step -1
      Dim cur As ULongInt = (rem_ Shl 32) Or tmp[i]
      tmp[i] = CULng(cur \ radix)
      rem_ = cur Mod radix
    Next
    s = Chr(digits[rem_]) & s
    Do While n > 0 AndAlso tmp[n - 1] = 0
      n -= 1
    Loop
  Loop
  Deallocate(tmp)
  Return IIf(h->neg, "-" & s, s)
End Function

Function js_big_isbig(ByRef v As JsV) As Long
  Return v.tag = JS_T_BIG
End Function

' ---------------------------------------------------------------------------
' Operators on dynamic values (numbers take the Double fast paths elsewhere)
' ---------------------------------------------------------------------------

Function js_isnumlike(ByRef v As JsV) As Long
  Return v.tag = JS_T_NUM OrElse v.tag = JS_T_BOOL OrElse v.tag <= JS_T_NULL
End Function

Function js_add(ByRef a As JsV, ByRef b As JsV) As JsV
  If a.tag = JS_T_NUM AndAlso b.tag = JS_T_NUM Then Return js_num(a.n + b.n)
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_addsub(a, b, 0)
  If a.tag = JS_T_STR OrElse b.tag = JS_T_STR OrElse a.tag = JS_T_OBJ OrElse b.tag = JS_T_OBJ Then
    Return js_str(js_tostring(a) & js_tostring(b))
  End If
  If a.tag = JS_T_BIG OrElse b.tag = JS_T_BIG Then js_throw_error("Cannot mix BigInt and other types, use explicit conversions", "TypeError")
  Return js_num(js_tonum(a) + js_tonum(b))
End Function

Function js_sub(ByRef a As JsV, ByRef b As JsV) As JsV
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_addsub(a, b, 1)
  Return js_num(js_tonum(a) - js_tonum(b))
End Function

Function js_mul(ByRef a As JsV, ByRef b As JsV) As JsV
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_mul(a, b)
  Return js_num(js_tonum(a) * js_tonum(b))
End Function

Function js_div(ByRef a As JsV, ByRef b As JsV) As JsV
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_div(a, b)
  Return js_num(js_tonum(a) / js_tonum(b))
End Function

Function js_dmod(ByVal a As Double, ByVal b As Double) As Double
  Return fmod(a, b)
End Function

Function js_mod(ByRef a As JsV, ByRef b As JsV) As JsV
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_mod(a, b)
  Return js_num(fmod(js_tonum(a), js_tonum(b)))
End Function

Function js_dpow(ByVal a As Double, ByVal b As Double) As Double
  If b <> b Then Return js_nan
  If b = 0 Then Return 1
  If (a = 1 OrElse a = -1) AndAlso (b = js_inf OrElse b = -js_inf) Then Return js_nan
  Return pow(a, b)
End Function

Function js_pow(ByRef a As JsV, ByRef b As JsV) As JsV
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_pow(a, b)
  Return js_num(js_dpow(js_tonum(a), js_tonum(b)))
End Function

Function js_neg(ByRef a As JsV) As JsV
  If a.tag = JS_T_BIG Then
    Dim z As JsV = js_big_fromu64(0, 0)
    Return js_big_addsub(z, a, 1)
  End If
  Return js_num(-js_tonum(a))
End Function

' ---- bit operators (JavaScript int32 semantics; BigInt when both are BigInts) ----
Function js_band(ByRef a As JsV, ByRef b As JsV) As JsV
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_bitop(a, b, 0)
  Return js_num(js_toi32(js_tonum(a)) And js_toi32(js_tonum(b)))
End Function

Function js_bor(ByRef a As JsV, ByRef b As JsV) As JsV
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_bitop(a, b, 1)
  Return js_num(js_toi32(js_tonum(a)) Or js_toi32(js_tonum(b)))
End Function

Function js_bxor(ByRef a As JsV, ByRef b As JsV) As JsV
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_bitop(a, b, 2)
  Return js_num(js_toi32(js_tonum(a)) Xor js_toi32(js_tonum(b)))
End Function

Function js_bnot(ByRef a As JsV) As JsV
  If a.tag = JS_T_BIG Then Return js_big_not(a)
  Return js_num(Not js_toi32(js_tonum(a)))
End Function

Function js_shl(ByRef a As JsV, ByRef b As JsV) As JsV
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_shl(a, CLng(js_big_todouble(js_bigh(b))))
  Return js_num(js_toi32(js_tonum(a)) Shl (js_tou32(js_tonum(b)) And 31))
End Function

Function js_sar(ByRef a As JsV, ByRef b As JsV) As JsV
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_shl(a, -CLng(js_big_todouble(js_bigh(b))))
  Return js_num(js_toi32(js_tonum(a)) Shr (js_tou32(js_tonum(b)) And 31))
End Function

Function js_shr(ByRef a As JsV, ByRef b As JsV) As JsV
  Return js_num(js_tou32(js_tonum(a)) Shr (js_tou32(js_tonum(b)) And 31))
End Function

' Double forms of the bit operators: the IL types the operands as numbers
Function js_dshl(ByVal a As Double, ByVal n As Double) As Double
  Return js_toi32(a) Shl (js_tou32(n) And 31)
End Function

Function js_dsar(ByVal a As Double, ByVal n As Double) As Double
  Return js_toi32(a) Shr (js_tou32(n) And 31)
End Function

Function js_dshr(ByVal a As Double, ByVal n As Double) As Double
  Return js_tou32(a) Shr (js_tou32(n) And 31)
End Function

Function js_rotl32(ByVal v As Double, ByVal n As Double) As Double
  Dim x As ULong = js_tou32(v)
  Dim s As Long = js_toi32(n) And 31
  If s = 0 Then Return x
  Return (x Shl s) Or (x Shr (32 - s))
End Function

Function js_rotr32(ByVal v As Double, ByVal n As Double) As Double
  Dim x As ULong = js_tou32(v)
  Dim s As Long = js_toi32(n) And 31
  If s = 0 Then Return x
  Return (x Shr s) Or (x Shl (32 - s))
End Function

Function js_rotln(ByVal v As Double, ByVal n As Double, ByVal bits As Long) As Double
  Dim m As ULong = (CULng(1) Shl bits) - 1
  Dim x As ULong = js_tou32(v) And m
  Dim s As Long = js_toi32(n) Mod bits
  If s < 0 Then s += bits
  If s = 0 Then Return x
  Return ((x Shl s) Or (x Shr (bits - s))) And m
End Function

Function js_rotrn(ByVal v As Double, ByVal n As Double, ByVal bits As Long) As Double
  Dim s As Long = js_toi32(n) Mod bits
  If s < 0 Then s += bits
  Return js_rotln(v, bits - s, bits)
End Function

' Math.imul and OpCodes.Mul32 (low 32 bits of the exact product)
Function js_mul32(ByVal a As Double, ByVal b As Double) As Double
  Return CULng((CULngInt(js_tou32(a)) * CULngInt(js_tou32(b))) And &HFFFFFFFFull)
End Function

Function js_imul(ByVal a As Double, ByVal b As Double) As Double
  Return CLng((CULngInt(js_tou32(a)) * CULngInt(js_tou32(b))) And &HFFFFFFFFull)
End Function

Function js_clz32(ByVal v As Double) As Double
  Dim x As ULong = js_tou32(v)
  If x = 0 Then Return 32
  Dim n As Long = 0
  Do While (x And &H80000000ul) = 0
    x Shl= 1
    n += 1
  Loop
  Return n
End Function

' ---- comparison ----
Function js_strict_eq(ByRef a As JsV, ByRef b As JsV) As Long
  If a.tag <> b.tag Then Return 0
  Select Case a.tag
    Case JS_T_UNDEF, JS_T_NULL
      Return -1
    Case JS_T_NUM, JS_T_BOOL
      Return a.n = b.n
    Case JS_T_STR
      Return JSS(a) = JSS(b)
    Case JS_T_BIG
      Return js_big_cmp(a, b) = 0
    Case Else
      Return a.p = b.p
  End Select
End Function

Function js_loose_eq(ByRef a As JsV, ByRef b As JsV) As Long
  If a.tag <= JS_T_NULL OrElse b.tag <= JS_T_NULL Then Return a.tag <= JS_T_NULL AndAlso b.tag <= JS_T_NULL
  If a.tag = b.tag Then Return js_strict_eq(a, b)
  If a.tag = JS_T_BIG OrElse b.tag = JS_T_BIG Then Return js_tonum(a) = js_tonum(b)
  If a.tag = JS_T_OBJ AndAlso b.tag <> JS_T_OBJ Then
    Dim s As JsV = js_str(js_tostring(a))
    Return js_loose_eq(s, b)
  End If
  If b.tag = JS_T_OBJ AndAlso a.tag <> JS_T_OBJ Then
    Dim s As JsV = js_str(js_tostring(b))
    Return js_loose_eq(a, s)
  End If
  Return js_tonum(a) = js_tonum(b)
End Function

' -1 less, 0 equal, 1 greater, 2 unordered (NaN)
Function js_compare(ByRef a As JsV, ByRef b As JsV) As Long
  If a.tag = JS_T_STR AndAlso b.tag = JS_T_STR Then
    Dim sa As String = JSS(a)
    Dim sb As String = JSS(b)
    If sa < sb Then Return -1
    If sa > sb Then Return 1
    Return 0
  End If
  If a.tag = JS_T_BIG AndAlso b.tag = JS_T_BIG Then Return js_big_cmp(a, b)
  Dim x As Double = js_tonum(a)
  Dim y As Double = js_tonum(b)
  If x <> x OrElse y <> y Then Return 2
  If x < y Then Return -1
  If x > y Then Return 1
  Return 0
End Function

Function js_lt(ByRef a As JsV, ByRef b As JsV) As Long
  Return js_compare(a, b) = -1
End Function

Function js_le(ByRef a As JsV, ByRef b As JsV) As Long
  Dim c As Long = js_compare(a, b)
  Return c = -1 OrElse c = 0
End Function

Function js_gt(ByRef a As JsV, ByRef b As JsV) As Long
  Return js_compare(a, b) = 1
End Function

Function js_ge(ByRef a As JsV, ByRef b As JsV) As Long
  Dim c As Long = js_compare(a, b)
  Return c = 1 OrElse c = 0
End Function

' ---- Math ----
Function js_round(ByVal x As Double) As Double
  If x <> x OrElse x = js_inf OrElse x = -js_inf Then Return x
  Return js_dfloor(x + 0.5)
End Function

Function js_trunc(ByVal x As Double) As Double
  If x <> x OrElse x = js_inf OrElse x = -js_inf Then Return x
  Return js_dfix(x)
End Function

Function js_floor(ByVal x As Double) As Double
  If x <> x OrElse x = js_inf OrElse x = -js_inf Then Return x
  Return js_dfloor(x)
End Function

Function js_ceil(ByVal x As Double) As Double
  If x <> x OrElse x = js_inf OrElse x = -js_inf Then Return x
  Return -js_dfloor(-x)
End Function

Function js_sign(ByVal x As Double) As Double
  If x <> x Then Return x
  If x > 0 Then Return 1
  If x < 0 Then Return -1
  Return 0
End Function

Function js_dmin(ByVal a As Double, ByVal b As Double) As Double
  If a <> a OrElse b <> b Then Return js_nan
  Return IIf(a < b, a, b)
End Function

Function js_dmax(ByVal a As Double, ByVal b As Double) As Double
  If a <> a OrElse b <> b Then Return js_nan
  Return IIf(a > b, a, b)
End Function

Function js_fround(ByVal x As Double) As Double
  Dim s As Single = CSng(x)
  Return s
End Function

Function js_dsqrt(ByVal x As Double) As Double
  If x < 0 Then Return js_nan
  Return Sqr(x)
End Function

Function js_dlog(ByVal x As Double) As Double
  If x < 0 Then Return js_nan
  If x = 0 Then Return -js_inf
  Return Log(x)
End Function

Function js_random() As Double
  Return Rnd
End Function

' ---- strings ----
Function js_concat(ByRef a As JsV, ByRef b As JsV) As JsV
  Return js_str(js_tostring(a) & js_tostring(b))
End Function

Function js_charcode(ByRef s As JsV, ByVal i As Double) As Double
  Dim t As String = js_tostring(s)
  If i < 0 OrElse i >= Len(t) OrElse i <> js_dfloor(i) Then Return js_nan
  Return t[CLng(i)]
End Function

Function js_charat(ByRef s As JsV, ByVal i As Double) As JsV
  Dim t As String = js_tostring(s)
  If i < 0 OrElse i >= Len(t) Then Return js_str("")
  Return js_str(Chr(t[CLng(i)]))
End Function

Function js_fromcharcode(ByVal c As Double) As String
  Dim v As Long = js_tou32(c) And 65535
  If v > 255 Then Return "?"
  Return Chr(v)
End Function

' ---------------------------------------------------------------------------
' Regular expressions: the subset the algorithms use - literals, escapes
' (\d \w \s and their negations), character classes with ranges and
' negation, ".", the quantifiers * + ? {m,n}, the anchors ^ and $, and the
' flags g and i. No groups or alternation. A RegExp is an object holding
' its source and flags; it is compiled where it is used.
' ---------------------------------------------------------------------------

Type JsReNode
  bits(0 To 255) As UByte
  qmin As Long
  qmax As Long
End Type

Type JsRe
  nodes As JsReNode Ptr
  n As Long
  bol As Long
  eol As Long
  Declare Destructor()
End Type

Destructor JsRe()
  If nodes Then Deallocate(nodes)
End Destructor

Dim Shared SYM_re_source As Long, SYM_re_flags As Long, SYM_re_global As Long, SYM_re_mark As Long
Dim Shared SYM_test As Long, SYM_match As Long, SYM_search As Long, SYM_exec As Long, SYM_replaceAll As Long
Dim Shared SYM_lastIndex As Long, SYM_localeCompare As Long
Declare Function js_str_replace(ByRef s As String, ByRef search As String, ByRef repl As String, ByVal all As Long) As String

Sub js_re_init_syms()
  SYM_re_source = js_sym("source") : SYM_re_flags = js_sym("flags") : SYM_re_global = js_sym("global")
  SYM_re_mark = js_sym("__regexp__") : SYM_test = js_sym("test") : SYM_match = js_sym("match")
  SYM_search = js_sym("search") : SYM_exec = js_sym("exec") : SYM_replaceAll = js_sym("replaceAll")
  SYM_lastIndex = js_sym("lastIndex") : SYM_localeCompare = js_sym("localeCompare")
End Sub

Function js_regex_new(ByRef src As String, ByRef flags As String) As JsV
  Dim r As JsV = js_obj_new()
  js_setp(r, SYM_re_mark, js_bool(-1))
  js_setp(r, SYM_re_source, js_str(src))
  js_setp(r, SYM_re_flags, js_str(flags))
  js_setp(r, SYM_re_global, js_bool(InStr(flags, "g") > 0))
  js_setp(r, SYM_lastIndex, js_num(0))
  Return r
End Function

Function js_is_regex(ByRef v As JsV) As Long
  If v.tag <> JS_T_OBJ OrElse v.p->kind <> JS_K_OBJ Then Return 0
  Return js_hasp(v, SYM_re_mark)
End Function

Function js_re_global(ByRef v As JsV) As Long
  Return InStr(js_tostring(js_getp(v, SYM_re_flags)), "g") > 0
End Function

' \d \w \s (and capitals) into a node's set; 0 when c names no class
Function js_re_escclass(ByVal c As Long, ByVal nd As JsReNode Ptr) As Long
  Dim t(0 To 255) As UByte
  Select Case c
    Case Asc("d"), Asc("D")
      For ch As Long = Asc("0") To Asc("9") : t(ch) = 1 : Next
    Case Asc("w"), Asc("W")
      For ch As Long = Asc("0") To Asc("9") : t(ch) = 1 : Next
      For ch As Long = Asc("A") To Asc("Z") : t(ch) = 1 : t(ch + 32) = 1 : Next
      t(Asc("_")) = 1
    Case Asc("s"), Asc("S")
      t(32) = 1 : t(9) = 1 : t(10) = 1 : t(11) = 1 : t(12) = 1 : t(13) = 1 : t(160) = 1
    Case Else
      Return 0
  End Select
  Dim neg As Long = (c = Asc("D") OrElse c = Asc("W") OrElse c = Asc("S"))
  For ch As Long = 0 To 255
    If (t(ch) <> 0) Xor (neg <> 0) Then nd->bits(ch) = 1
  Next
  Return -1
End Function

Function js_re_escchar(ByVal c As Long) As Long
  Select Case c
    Case Asc("n") : Return 10
    Case Asc("t") : Return 9
    Case Asc("r") : Return 13
    Case Asc("f") : Return 12
    Case Asc("v") : Return 11
    Case Asc("0") : Return 0
  End Select
  Return c
End Function

Sub js_re_compile(ByRef pat As String, ByRef flags As String, ByRef re As JsRe)
  Dim L As Long = Len(pat)
  re.nodes = CAllocate(L + 1, SizeOf(JsReNode))
  re.n = 0
  Dim icase As Long = InStr(flags, "i") > 0
  Dim i As Long = 0
  If L > 0 AndAlso pat[0] = Asc("^") Then re.bol = -1 : i = 1
  Do While i < L
    Dim c As Long = pat[i]
    If c = Asc("$") AndAlso i = L - 1 Then re.eol = -1 : Exit Do
    Dim nd As JsReNode Ptr = @re.nodes[re.n]
    If c = Asc("[") Then
      i += 1
      Dim neg As Long = 0
      If i < L AndAlso pat[i] = Asc("^") Then neg = -1 : i += 1
      Dim first As Long = -1
      Do While i < L AndAlso (pat[i] <> Asc("]") OrElse first)
        first = 0
        Dim lo As Long
        If pat[i] = Asc("\") AndAlso i + 1 < L Then
          i += 1
          If js_re_escclass(pat[i], nd) Then
            i += 1
            Continue Do
          End If
          lo = js_re_escchar(pat[i])
        Else
          lo = pat[i]
        End If
        i += 1
        Dim hi As Long = lo
        If i + 1 < L AndAlso pat[i] = Asc("-") AndAlso pat[i + 1] <> Asc("]") Then
          i += 1
          If pat[i] = Asc("\") AndAlso i + 1 < L Then
            i += 1
            hi = js_re_escchar(pat[i])
          Else
            hi = pat[i]
          End If
          i += 1
        End If
        For ch As Long = lo To hi
          nd->bits(ch And 255) = 1
        Next
      Loop
      i += 1
      If icase Then
        For ch As Long = Asc("A") To Asc("Z")
          If nd->bits(ch) OrElse nd->bits(ch + 32) Then nd->bits(ch) = 1 : nd->bits(ch + 32) = 1
        Next
      End If
      If neg Then
        For ch As Long = 0 To 255
          nd->bits(ch) = 1 - nd->bits(ch)
        Next
      End If
    ElseIf c = Asc("\") AndAlso i + 1 < L Then
      i += 1
      If js_re_escclass(pat[i], nd) = 0 Then nd->bits(js_re_escchar(pat[i]) And 255) = 1
      i += 1
    ElseIf c = Asc(".") Then
      For ch As Long = 0 To 255
        nd->bits(ch) = 1
      Next
      nd->bits(10) = 0 : nd->bits(13) = 0
      i += 1
    Else
      nd->bits(c) = 1
      If icase AndAlso ((c >= Asc("A") AndAlso c <= Asc("Z")) OrElse (c >= Asc("a") AndAlso c <= Asc("z"))) Then nd->bits(c Xor 32) = 1
      i += 1
    End If
    nd->qmin = 1 : nd->qmax = 1
    If i < L Then
      Select Case pat[i]
        Case Asc("+") : nd->qmax = &h7FFFFFFF : i += 1
        Case Asc("*") : nd->qmin = 0 : nd->qmax = &h7FFFFFFF : i += 1
        Case Asc("?") : nd->qmin = 0 : i += 1
        Case Asc("{")
          Dim e As Long = InStr(i + 1, pat, "}")
          If e > 0 Then
            Dim body As String = Mid(pat, i + 2, e - i - 2)
            Dim comma As Long = InStr(body, ",")
            If comma = 0 Then
              nd->qmin = ValInt(body) : nd->qmax = nd->qmin
            Else
              nd->qmin = ValInt(Left(body, comma - 1))
              nd->qmax = IIf(comma = Len(body), &h7FFFFFFF, ValInt(Mid(body, comma + 1)))
            End If
            i = e
          End If
      End Select
      ' a lazy marker is taken greedily: every use matches a single run
      If i < L AndAlso pat[i] = Asc("?") AndAlso (nd->qmin <> 1 OrElse nd->qmax <> 1) Then i += 1
    End If
    re.n += 1
  Loop
End Sub

' end of a match of nodes ni.. at p, or -1
Function js_re_at(ByRef re As JsRe, ByVal ni As Long, ByRef s As String, ByVal p As Long) As Long
  If ni = re.n Then
    If re.eol AndAlso p <> Len(s) Then Return -1
    Return p
  End If
  Dim nd As JsReNode Ptr = @re.nodes[ni]
  Dim L As Long = Len(s)
  Dim cnt As Long = 0
  Do While cnt < nd->qmax AndAlso p + cnt < L
    If nd->bits(s[p + cnt]) = 0 Then Exit Do
    cnt += 1
  Loop
  Do While cnt >= nd->qmin
    Dim r As Long = js_re_at(re, ni + 1, s, p + cnt)
    If r >= 0 Then Return r
    cnt -= 1
  Loop
  Return -1
End Function

' first match at or after from: its end, its start in mstart; -1 when none
Function js_re_search(ByRef re As JsRe, ByRef s As String, ByVal from As Long, ByRef mstart As Long) As Long
  For st As Long = from To Len(s)
    If re.bol AndAlso st > 0 Then Exit For
    Dim e As Long = js_re_at(re, 0, s, st)
    If e >= 0 Then
      mstart = st
      Return e
    End If
  Next
  Return -1
End Function

Function js_re_replace(ByRef s As String, ByRef rx As JsV, ByRef repl As JsV, ByVal forceAll As Long) As String
  Dim re As JsRe
  js_re_compile(js_tostring(js_getp(rx, SYM_re_source)), js_tostring(js_getp(rx, SYM_re_flags)), re)
  Dim all As Long = forceAll OrElse js_re_global(rx)
  Dim isFn As Long = repl.tag = JS_T_OBJ AndAlso repl.p->kind = JS_K_FN
  Dim rs As String = IIf(isFn, "", js_tostring(repl))
  Dim r As String
  Dim p As Long = 0
  Dim from As Long = 0
  Do
    Dim ms As Long
    Dim e As Long = js_re_search(re, s, from, ms)
    If e < 0 Then Exit Do
    r &= Mid(s, p + 1, ms - p)
    If isFn Then
      Dim args(0 To 2) As JsV
      args(0) = js_str(Mid(s, ms + 1, e - ms))
      args(1) = js_num(ms)
      args(2) = js_str(s)
      Dim u As JsV
      r &= js_tostring(js_call(repl, u, @args(0), 3))
    Else
      r &= js_str_replace(rs, "$&", Mid(s, ms + 1, e - ms), -1)
    End If
    p = e
    from = IIf(e = ms, e + 1, e)
    If all = 0 OrElse from > Len(s) Then Exit Do
  Loop
  Return r & Mid(s, p + 1)
End Function

Function js_re_split(ByRef s As String, ByRef rx As JsV) As JsV
  Dim re As JsRe
  js_re_compile(js_tostring(js_getp(rx, SYM_re_source)), js_tostring(js_getp(rx, SYM_re_flags)), re)
  Dim r As JsArrH Ptr = js_arrh_new(0)
  If Len(s) = 0 Then
    If js_re_at(re, 0, s, 0) < 0 Then
      Dim one As JsV = js_str("")
      js_arrh_push(r, one)
    End If
    Return js_objv(r)
  End If
  Dim p As Long = 0
  Dim q As Long = 0
  Do While q < Len(s)
    Dim ms As Long
    Dim e As Long = js_re_search(re, s, q, ms)
    If e < 0 OrElse ms >= Len(s) Then Exit Do
    If e = ms AndAlso ms = p Then
      q = ms + 1
      Continue Do
    End If
    If e = ms Then
      Dim piece As JsV = js_str(Mid(s, p + 1, ms - p))
      js_arrh_push(r, piece)
      p = ms
      q = ms + 1
    Else
      Dim piece As JsV = js_str(Mid(s, p + 1, ms - p))
      js_arrh_push(r, piece)
      p = e
      q = e
    End If
  Loop
  Dim last As JsV = js_str(Mid(s, p + 1))
  js_arrh_push(r, last)
  Return js_objv(r)
End Function

' String.prototype.match: the first match (an array) or every match (g), null when none
Function js_re_match(ByRef s As String, ByRef rx As JsV) As JsV
  Dim re As JsRe
  js_re_compile(js_tostring(js_getp(rx, SYM_re_source)), js_tostring(js_getp(rx, SYM_re_flags)), re)
  Dim all As Long = js_re_global(rx)
  Dim r As JsArrH Ptr = js_arrh_new(0)
  Dim from As Long = 0
  Do
    Dim ms As Long
    Dim e As Long = js_re_search(re, s, from, ms)
    If e < 0 Then Exit Do
    Dim m As JsV = js_str(Mid(s, ms + 1, e - ms))
    js_arrh_push(r, m)
    If all = 0 Then
      Dim rv As JsV = js_objv(r)
      js_setp(rv, js_sym("index"), js_num(ms))
      Return rv
    End If
    from = IIf(e = ms, e + 1, e)
    If from > Len(s) Then Exit Do
  Loop
  If r->length = 0 Then
    Dim rv As JsV = js_objv(r)
    Return js_null()
  End If
  Return js_objv(r)
End Function

Function js_re_test(ByRef rx As JsV, ByRef s As String) As Long
  Dim re As JsRe
  js_re_compile(js_tostring(js_getp(rx, SYM_re_source)), js_tostring(js_getp(rx, SYM_re_flags)), re)
  Dim ms As Long
  Return js_re_search(re, s, 0, ms) >= 0
End Function

Function js_re_search_index(ByRef s As String, ByRef rx As JsV) As Long
  Dim re As JsRe
  js_re_compile(js_tostring(js_getp(rx, SYM_re_source)), js_tostring(js_getp(rx, SYM_re_flags)), re)
  Dim ms As Long
  If js_re_search(re, s, 0, ms) < 0 Then Return -1
  Return ms
End Function

' ---------------------------------------------------------------------------
' Built-in methods of arrays, strings, numbers, Map and Set; errors
' ---------------------------------------------------------------------------

Dim Shared SYM_push As Long, SYM_pop As Long, SYM_shift As Long, SYM_unshift As Long
Dim Shared SYM_slice As Long, SYM_splice As Long, SYM_concat As Long, SYM_join As Long
Dim Shared SYM_indexOf As Long, SYM_lastIndexOf As Long, SYM_includes As Long, SYM_reverse As Long
Dim Shared SYM_fill As Long, SYM_map As Long, SYM_filter As Long, SYM_forEach As Long
Dim Shared SYM_reduce As Long, SYM_some As Long, SYM_every As Long, SYM_find As Long
Dim Shared SYM_findIndex As Long, SYM_sort As Long, SYM_set As Long, SYM_subarray As Long
Dim Shared SYM_get As Long, SYM_has As Long, SYM_delete As Long, SYM_add As Long, SYM_clear As Long
Dim Shared SYM_keys As Long, SYM_values As Long, SYM_entries As Long, SYM_size As Long
Dim Shared SYM_charAt As Long, SYM_charCodeAt As Long, SYM_substring As Long, SYM_substr As Long
Dim Shared SYM_split As Long, SYM_toUpperCase As Long, SYM_toLowerCase As Long, SYM_trim As Long
Dim Shared SYM_padStart As Long, SYM_padEnd As Long, SYM_repeat As Long, SYM_startsWith As Long
Dim Shared SYM_endsWith As Long, SYM_replace As Long, SYM_toFixed As Long, SYM_buffer As Long
Dim Shared SYM_byteLength As Long, SYM_byteOffset As Long, SYM_call As Long, SYM_apply As Long
Dim Shared SYM_bind As Long, SYM_stack As Long, SYM_copyWithin As Long, SYM_at As Long
Dim Shared SYM_codePointAt As Long, SYM_valueOf As Long, SYM_hasOwnProperty As Long

Dim Shared CLS_Error As JsV

Function js_error_new(ByRef msg As String, ByRef ename As String) As JsV
  Dim e As JsV = js_objv(js_objh_new(js_classh(CLS_Error)))
  Dim m As JsV = js_str(msg)
  Dim nm As JsV = js_str(ename)
  js_objh_set(Cast(JsObjH Ptr, e.p), SYM_message, m)
  js_objh_set(Cast(JsObjH Ptr, e.p), SYM_name, nm)
  Return e
End Function

Function js_error_v(ByRef msg As JsV, ByRef ename As String) As JsV
  Return js_error_new(IIf(msg.tag = JS_T_UNDEF, "", js_tostring(msg)), ename)
End Function

' ---- Map and Set ----
Function js_map_new(ByVal isSet As Long) As JsV
  Dim m As JsMapH Ptr = New JsMapH
  m->rc = 1
  m->kind = JS_K_MAP
  m->isSet = isSet
  Return js_objv(m)
End Function

Function js_maph_find(ByVal m As JsMapH Ptr, ByRef k As JsV) As Long
  For i As Long = 0 To m->count - 1
    If js_strict_eq(m->ks[i], k) Then Return i
  Next
  Return -1
End Function

Sub js_maph_set(ByVal m As JsMapH Ptr, ByRef k As JsV, ByRef v As JsV)
  Dim i As Long = js_maph_find(m, k)
  If i >= 0 Then
    m->vs[i] = v
    Exit Sub
  End If
  If m->count >= m->cap Then
    Dim nc As Long = IIf(m->cap = 0, 8, m->cap * 2)
    m->ks = Reallocate(m->ks, nc * SizeOf(JsV))
    m->vs = Reallocate(m->vs, nc * SizeOf(JsV))
    For j As Long = m->cap To nc - 1
      m->ks[j].Constructor()
      m->vs[j].Constructor()
    Next
    m->cap = nc
  End If
  m->ks[m->count] = k
  m->vs[m->count] = v
  m->count += 1
End Sub

Function js_map_from(ByRef src As JsV, ByVal isSet As Long) As JsV
  Dim r As JsV = js_map_new(isSet)
  Dim m As JsMapH Ptr = Cast(JsMapH Ptr, r.p)
  If src.tag = JS_T_OBJ AndAlso (src.p->kind = JS_K_ARR OrElse src.p->kind = JS_K_TYPED) Then
    Dim n As Long = js_length(src)
    For i As Long = 0 To n - 1
      Dim e As JsV = js_index_get(src, i)
      If isSet Then
        js_maph_set(m, e, e)
      Else
        Dim k As JsV = js_index_get(e, 0)
        Dim v As JsV = js_index_get(e, 1)
        js_maph_set(m, k, v)
      End If
    Next
  End If
  Return r
End Function

' ---- callbacks of array methods ----
Function js_cb(ByRef f As JsV, ByRef v As JsV, ByVal i As Long, ByRef arr As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 2) As JsV
  args(0) = v
  args(1) = js_num(i)
  args(2) = arr
  Return js_call(f, u, @args(0), 3)
End Function

Function js_relidx(ByRef v As JsV, ByVal n As Long, ByVal dflt As Long) As Long
  If v.tag = JS_T_UNDEF Then Return dflt
  Dim d As Double = js_tonum(v)
  If d <> d Then Return 0
  Dim i As Long
  If d < -2147483647 Then
    i = -2147483647
  ElseIf d > 2147483647 Then
    i = 2147483647
  Else
    i = CLng(js_dfix(d))
  End If
  If i < 0 Then
    i += n
    If i < 0 Then i = 0
  End If
  If i > n Then i = n
  Return i
End Function

Function js_slice_arr(ByRef obj As JsV, ByRef av As JsV, ByRef bv As JsV) As JsV
  Dim n As Long = js_length(obj)
  Dim s As Long = js_relidx(av, n, 0)
  Dim e As Long = js_relidx(bv, n, n)
  If e < s Then e = s
  If obj.tag = JS_T_OBJ AndAlso obj.p->kind = JS_K_TYPED Then
    Dim t As JsTypedH Ptr = Cast(JsTypedH Ptr, obj.p)
    Dim r As JsV = js_typed_new(t->ek, e - s)
    memcpy(Cast(JsTypedH Ptr, r.p)->buf->bytes, t->buf->bytes + t->offset + s * t->esize, (e - s) * t->esize)
    Return r
  End If
  Dim a As JsArrH Ptr = js_arrh_new(e - s)
  If obj.tag = JS_T_OBJ AndAlso obj.p->kind = JS_K_ARR Then
    Dim src As JsArrH Ptr = Cast(JsArrH Ptr, obj.p)
    For i As Long = s To e - 1
      a->items[i - s] = src->items[i]
    Next
  End If
  Return js_objv(a)
End Function

' ---- sorting (stable merge sort) ----
Function js_sort_cmp(ByRef f As JsV, ByRef a As JsV, ByRef b As JsV) As Double
  If f.tag = JS_T_UNDEF Then
    If a.tag = JS_T_UNDEF Then Return IIf(b.tag = JS_T_UNDEF, 0, 1)
    If b.tag = JS_T_UNDEF Then Return -1
    Dim sa As String = js_tostring(a)
    Dim sb As String = js_tostring(b)
    If sa < sb Then Return -1
    If sa > sb Then Return 1
    Return 0
  End If
  Dim r As JsV = js_call2(f, a, b)
  Dim d As Double = js_tonum(r)
  If d <> d Then Return 0
  Return d
End Function

Sub js_merge_sort(ByVal items As JsV Ptr, ByVal tmp As JsV Ptr, ByVal lo As Long, ByVal hi As Long, ByRef f As JsV)
  If hi - lo < 2 Then Exit Sub
  Dim mid_ As Long = (lo + hi) \ 2
  js_merge_sort(items, tmp, lo, mid_, f)
  js_merge_sort(items, tmp, mid_, hi, f)
  Dim i As Long = lo, j As Long = mid_, k As Long = lo
  Do While i < mid_ AndAlso j < hi
    If js_sort_cmp(f, items[j], items[i]) < 0 Then
      tmp[k] = items[j]
      j += 1
    Else
      tmp[k] = items[i]
      i += 1
    End If
    k += 1
  Loop
  Do While i < mid_
    tmp[k] = items[i]
    i += 1
    k += 1
  Loop
  Do While j < hi
    tmp[k] = items[j]
    j += 1
    k += 1
  Loop
  For k = lo To hi - 1
    items[k] = tmp[k]
  Next
End Sub

Sub js_sort_values(ByRef obj As JsV, ByRef f As JsV)
  Dim arr As JsV = js_toarr(obj)
  Dim a As JsArrH Ptr = Cast(JsArrH Ptr, arr.p)
  If a->length < 2 Then Exit Sub
  Dim tmp As JsArrH Ptr = js_arrh_new(a->length)
  If f.tag = JS_T_UNDEF AndAlso obj.p->kind = JS_K_TYPED Then
    ' typed arrays sort numerically by default
    Dim cmpf As JsV
    For i As Long = 1 To a->length - 1
      Dim v As JsV = a->items[i]
      Dim j As Long = i - 1
      Do While j >= 0 AndAlso a->items[j].n > v.n
        a->items[j + 1] = a->items[j]
        j -= 1
      Loop
      a->items[j + 1] = v
    Next
  Else
    js_merge_sort(a->items, tmp->items, 0, a->length, f)
  End If
  Delete tmp
  If obj.p->kind = JS_K_TYPED Then
    For i As Long = 0 To a->length - 1
      js_index_set(obj, i, a->items[i])
    Next
  End If
End Sub

' ---- string helpers ----
Function js_substring(ByRef s As String, ByVal a As Double, ByVal b As Double, ByVal hasEnd As Long) As String
  Dim n As Long = Len(s)
  If a <> a Then a = 0
  If a < 0 Then a = 0
  If a > n Then a = n
  Dim e As Double = IIf(hasEnd, b, n)
  If e <> e Then e = 0
  If e < 0 Then e = 0
  If e > n Then e = n
  If a > e Then Swap a, e
  Return Mid(s, CLng(a) + 1, CLng(e) - CLng(a))
End Function

Function js_str_slice(ByRef s As String, ByRef av As JsV, ByRef bv As JsV) As String
  Dim n As Long = Len(s)
  Dim a As Long = js_relidx(av, n, 0)
  Dim e As Long = js_relidx(bv, n, n)
  If e <= a Then Return ""
  Return Mid(s, a + 1, e - a)
End Function

Function js_str_indexof(ByRef s As String, ByRef t As String, ByVal from As Long) As Long
  If from < 0 Then from = 0
  If Len(t) = 0 Then Return IIf(from <= Len(s), from, Len(s))
  Return InStr(from + 1, s, t) - 1
End Function

Function js_str_split(ByRef s As String, ByRef sepv As JsV) As JsV
  Dim r As JsArrH Ptr = js_arrh_new(0)
  If sepv.tag = JS_T_UNDEF Then
    Dim one As JsV = js_str(s)
    js_arrh_push(r, one)
    Return js_objv(r)
  End If
  Dim sep As String = js_tostring(sepv)
  If Len(sep) = 0 Then
    For i As Long = 0 To Len(s) - 1
      Dim c As JsV = js_str(Chr(s[i]))
      js_arrh_push(r, c)
    Next
    Return js_objv(r)
  End If
  Dim start As Long = 1
  Do
    Dim p As Long = InStr(start, s, sep)
    If p = 0 Then
      Dim last As JsV = js_str(Mid(s, start))
      js_arrh_push(r, last)
      Exit Do
    End If
    Dim part As JsV = js_str(Mid(s, start, p - start))
    js_arrh_push(r, part)
    start = p + Len(sep)
  Loop
  Return js_objv(r)
End Function

Function js_str_replace(ByRef s As String, ByRef search As String, ByRef repl As String, ByVal all As Long) As String
  If Len(search) = 0 Then Return repl & s
  Dim r As String
  Dim start As Long = 1
  Do
    Dim p As Long = InStr(start, s, search)
    If p = 0 Then
      r &= Mid(s, start)
      Exit Do
    End If
    r &= Mid(s, start, p - start) & repl
    start = p + Len(search)
    If all = 0 Then
      r &= Mid(s, start)
      Exit Do
    End If
  Loop
  Return r
End Function

Function js_pad(ByRef s As String, ByVal n As Long, ByRef padv As JsV, ByVal atStart As Long) As String
  Dim pd As String = IIf(padv.tag = JS_T_UNDEF, " ", js_tostring(padv))
  If n <= Len(s) OrElse Len(pd) = 0 Then Return s
  Dim fill As String
  Do While Len(fill) < n - Len(s)
    fill &= pd
  Loop
  fill = Left(fill, n - Len(s))
  Return IIf(atStart, fill & s, s & fill)
End Function

' ---- property reads of built-in values ----
Function js_builtin_get(ByRef obj As JsV, ByVal sym As Long) As JsV
  If sym = SYM_length Then
    If obj.tag = JS_T_STR OrElse (obj.tag = JS_T_OBJ AndAlso (obj.p->kind = JS_K_ARR OrElse obj.p->kind = JS_K_TYPED OrElse obj.p->kind = JS_K_BUF)) Then Return js_num(js_length(obj))
  End If
  If obj.tag = JS_T_OBJ Then
    Select Case obj.p->kind
      Case JS_K_TYPED
        If sym = SYM_buffer Then Return js_typed_buffer(obj)
        Dim t As JsTypedH Ptr = Cast(JsTypedH Ptr, obj.p)
        If sym = SYM_byteLength Then Return js_num(t->length * t->esize)
        If sym = SYM_byteOffset Then Return js_num(t->offset)
      Case JS_K_BUF
        If sym = SYM_byteLength Then Return js_num(Cast(JsBufH Ptr, obj.p)->size)
      Case JS_K_DV
        Dim d As JsDvH Ptr = Cast(JsDvH Ptr, obj.p)
        If sym = SYM_byteLength Then Return js_num(d->length)
        If sym = SYM_byteOffset Then Return js_num(d->offset)
        If sym = SYM_buffer Then
          d->buf->rc += 1
          Return js_objv(d->buf)
        End If
      Case JS_K_MAP
        If sym = SYM_size Then Return js_num(Cast(JsMapH Ptr, obj.p)->count)
      Case JS_K_FN
        If sym = SYM_name Then Return js_str("")
    End Select
  End If
  Dim u As JsV
  Return u
End Function

Function js_a(ByVal argv As JsV Ptr, ByVal argc As Long, ByVal i As Long) As JsV
  Return js_arg(argv, argc, i)
End Function

' ---- method calls on built-in values ----
Function js_builtin_call(ByRef obj As JsV, ByVal sym As Long, ByVal argv As JsV Ptr, ByVal argc As Long, ByRef handled As Long) As JsV
  handled = -1
  Dim u As JsV
  If obj.tag = JS_T_OBJ AndAlso (obj.p->kind = JS_K_ARR OrElse obj.p->kind = JS_K_TYPED) Then
    Dim isArr As Long = obj.p->kind = JS_K_ARR
    Dim a As JsArrH Ptr = IIf(isArr, Cast(JsArrH Ptr, obj.p), 0)
    Dim n As Long = js_length(obj)
    Select Case sym
      Case SYM_push
        For i As Long = 0 To argc - 1
          js_arrh_push(a, argv[i])
        Next
        Return js_num(a->length)
      Case SYM_pop
        If a->length = 0 Then Return u
        Dim v As JsV = a->items[a->length - 1]
        js_arrh_setlen(a, a->length - 1)
        Return v
      Case SYM_shift
        If a->length = 0 Then Return u
        Dim v As JsV = a->items[0]
        For i As Long = 1 To a->length - 1
          a->items[i - 1] = a->items[i]
        Next
        js_arrh_setlen(a, a->length - 1)
        Return v
      Case SYM_unshift
        Dim old As Long = a->length
        js_arrh_setlen(a, old + argc)
        For i As Long = old - 1 To 0 Step -1
          a->items[i + argc] = a->items[i]
        Next
        For i As Long = 0 To argc - 1
          a->items[i] = argv[i]
        Next
        Return js_num(a->length)
      Case SYM_slice
        Return js_slice_arr(obj, js_a(argv, argc, 0), js_a(argv, argc, 1))
      Case SYM_subarray
        Dim b As JsV = js_a(argv, argc, 1)
        Return js_subarray(obj, IIf(argc > 0, js_tonum(argv[0]), 0), js_tonum(b), b.tag <> JS_T_UNDEF)
      Case SYM_splice
        Dim s As Long = js_relidx(js_a(argv, argc, 0), n, 0)
        Dim dc As Long = IIf(argc > 1, CLng(js_tonum(argv[1])), n - s)
        If dc < 0 Then dc = 0
        If dc > n - s Then dc = n - s
        Dim removed As JsArrH Ptr = js_arrh_new(dc)
        For i As Long = 0 To dc - 1
          removed->items[i] = a->items[s + i]
        Next
        Dim ins As Long = IIf(argc > 2, argc - 2, 0)
        Dim tail_ As JsArrH Ptr = js_arrh_new(n - s - dc)
        For i As Long = 0 To n - s - dc - 1
          tail_->items[i] = a->items[s + dc + i]
        Next
        js_arrh_setlen(a, s + ins + n - s - dc)
        For i As Long = 0 To ins - 1
          a->items[s + i] = argv[2 + i]
        Next
        For i As Long = 0 To tail_->length - 1
          a->items[s + ins + i] = tail_->items[i]
        Next
        Delete tail_
        Return js_objv(removed)
      Case SYM_concat
        Dim r As JsArrH Ptr = js_arrh_new(0)
        For i As Long = 0 To n - 1
          Dim e As JsV = js_index_get(obj, i)
          js_arrh_push(r, e)
        Next
        For k As Long = 0 To argc - 1
          If argv[k].tag = JS_T_OBJ AndAlso (argv[k].p->kind = JS_K_ARR OrElse argv[k].p->kind = JS_K_TYPED) Then
            Dim m As Long = js_length(argv[k])
            For i As Long = 0 To m - 1
              Dim e As JsV = js_index_get(argv[k], i)
              js_arrh_push(r, e)
            Next
          Else
            js_arrh_push(r, argv[k])
          End If
        Next
        Return js_objv(r)
      Case SYM_join
        Dim sep As String = IIf(argc > 0 AndAlso argv[0].tag <> JS_T_UNDEF, js_tostring(argv[0]), ",")
        Dim s As String
        For i As Long = 0 To n - 1
          If i > 0 Then s &= sep
          Dim e As JsV = js_index_get(obj, i)
          If e.tag > JS_T_NULL Then s &= js_tostring(e)
        Next
        Return js_str(s)
      Case SYM_indexOf, SYM_includes
        Dim v As JsV = js_a(argv, argc, 0)
        Dim from As Long = js_relidx(js_a(argv, argc, 1), n, 0)
        For i As Long = from To n - 1
          Dim e As JsV = js_index_get(obj, i)
          If js_strict_eq(e, v) Then Return IIf(sym = SYM_indexOf, js_num(i), js_bool(-1))
        Next
        Return IIf(sym = SYM_indexOf, js_num(-1), js_bool(0))
      Case SYM_lastIndexOf
        Dim v As JsV = js_a(argv, argc, 0)
        For i As Long = n - 1 To 0 Step -1
          Dim e As JsV = js_index_get(obj, i)
          If js_strict_eq(e, v) Then Return js_num(i)
        Next
        Return js_num(-1)
      Case SYM_reverse
        For i As Long = 0 To n \ 2 - 1
          Dim x As JsV = js_index_get(obj, i)
          Dim y As JsV = js_index_get(obj, n - 1 - i)
          js_index_set(obj, i, y)
          js_index_set(obj, n - 1 - i, x)
        Next
        Return obj
      Case SYM_fill
        Dim v As JsV = js_a(argv, argc, 0)
        Dim s As Long = js_relidx(js_a(argv, argc, 1), n, 0)
        Dim e As Long = js_relidx(js_a(argv, argc, 2), n, n)
        For i As Long = s To e - 1
          js_index_set(obj, i, v)
        Next
        Return obj
      Case SYM_map
        Dim f As JsV = js_a(argv, argc, 0)
        Dim r As JsV = IIf(isArr, js_arr_new(n), js_typed_new(Cast(JsTypedH Ptr, obj.p)->ek, n))
        For i As Long = 0 To n - 1
          Dim e As JsV = js_index_get(obj, i)
          Dim m As JsV = js_cb(f, e, i, obj)
          js_index_set(r, i, m)
        Next
        Return r
      Case SYM_filter
        Dim f As JsV = js_a(argv, argc, 0)
        Dim r As JsArrH Ptr = js_arrh_new(0)
        For i As Long = 0 To n - 1
          Dim e As JsV = js_index_get(obj, i)
          Dim t As JsV = js_cb(f, e, i, obj)
          If js_truthy(t) Then js_arrh_push(r, e)
        Next
        Return js_objv(r)
      Case SYM_forEach
        Dim f As JsV = js_a(argv, argc, 0)
        For i As Long = 0 To n - 1
          Dim e As JsV = js_index_get(obj, i)
          js_cb(f, e, i, obj)
        Next
        Return u
      Case SYM_some, SYM_every, SYM_find, SYM_findIndex
        Dim f As JsV = js_a(argv, argc, 0)
        For i As Long = 0 To n - 1
          Dim e As JsV = js_index_get(obj, i)
          Dim t As JsV = js_cb(f, e, i, obj)
          Dim tv As Long = js_truthy(t)
          If sym = SYM_every Then
            If tv = 0 Then Return js_bool(0)
          ElseIf tv Then
            If sym = SYM_some Then Return js_bool(-1)
            If sym = SYM_find Then Return e
            Return js_num(i)
          End If
        Next
        If sym = SYM_every Then Return js_bool(-1)
        If sym = SYM_some Then Return js_bool(0)
        If sym = SYM_findIndex Then Return js_num(-1)
        Return u
      Case SYM_reduce
        Dim f As JsV = js_a(argv, argc, 0)
        Dim acc As JsV
        Dim start As Long = 0
        If argc > 1 Then
          acc = argv[1]
        Else
          If n = 0 Then js_throw_error("Reduce of empty array with no initial value", "TypeError")
          acc = js_index_get(obj, 0)
          start = 1
        End If
        For i As Long = start To n - 1
          Dim e As JsV = js_index_get(obj, i)
          Dim args(0 To 3) As JsV
          args(0) = acc
          args(1) = e
          args(2) = js_num(i)
          args(3) = obj
          acc = js_call(f, u, @args(0), 4)
        Next
        Return acc
      Case SYM_sort
        js_sort_values(obj, js_a(argv, argc, 0))
        Return obj
      Case SYM_set
        Dim src As JsV = js_a(argv, argc, 0)
        Dim off As Long = IIf(argc > 1, CLng(js_tonum(argv[1])), 0)
        Dim m As Long = js_length(src)
        If off + m > n Then js_throw_error("offset is out of bounds", "RangeError")
        For i As Long = 0 To m - 1
          Dim e As JsV = js_index_get(src, i)
          js_index_set(obj, off + i, e)
        Next
        Return u
      Case SYM_copyWithin
        Dim t As Long = js_relidx(js_a(argv, argc, 0), n, 0)
        Dim s As Long = js_relidx(js_a(argv, argc, 1), n, 0)
        Dim e As Long = js_relidx(js_a(argv, argc, 2), n, n)
        Dim tmp As JsV = js_slice_arr(obj, js_num(s), js_num(e))
        For i As Long = 0 To js_length(tmp) - 1
          If t + i < n Then js_index_set(obj, t + i, js_index_get(tmp, i))
        Next
        Return obj
      Case SYM_toString
        Dim s As String = js_tostring(obj)
        Return js_str(s)
      Case SYM_at
        Dim i As Long = CLng(js_tonum(js_a(argv, argc, 0)))
        If i < 0 Then i += n
        Return js_index_get(obj, i)
      Case SYM_keys
        Dim r As JsArrH Ptr = js_arrh_new(n)
        For i As Long = 0 To n - 1
          r->items[i] = js_num(i)
        Next
        Return js_objv(r)
      Case SYM_values
        Return js_slice_arr(obj, u, u)
    End Select
  ElseIf obj.tag = JS_T_STR Then
    Dim s As String = JSS(obj)
    Select Case sym
      Case SYM_charAt
        Return js_charat(obj, IIf(argc > 0, js_tonum(argv[0]), 0))
      Case SYM_charCodeAt, SYM_codePointAt
        Return js_num(js_charcode(obj, IIf(argc > 0, js_tonum(argv[0]), 0)))
      Case SYM_substring
        Dim b As JsV = js_a(argv, argc, 1)
        Return js_str(js_substring(s, IIf(argc > 0, js_tonum(argv[0]), 0), js_tonum(b), b.tag <> JS_T_UNDEF))
      Case SYM_substr
        Dim st As Long = js_relidx(js_a(argv, argc, 0), Len(s), 0)
        Dim ln As Long = IIf(argc > 1 AndAlso argv[1].tag <> JS_T_UNDEF, CLng(js_tonum(argv[1])), Len(s) - st)
        If ln < 0 Then ln = 0
        Return js_str(Mid(s, st + 1, ln))
      Case SYM_slice
        Return js_str(js_str_slice(s, js_a(argv, argc, 0), js_a(argv, argc, 1)))
      Case SYM_indexOf
        Return js_num(js_str_indexof(s, js_tostring(js_a(argv, argc, 0)), IIf(argc > 1, CLng(js_tonum(argv[1])), 0)))
      Case SYM_lastIndexOf
        Dim t As String = js_tostring(js_a(argv, argc, 0))
        Return js_num(InStrRev(s, t) - 1)
      Case SYM_includes
        Return js_bool(InStr(s, js_tostring(js_a(argv, argc, 0))) > 0 OrElse Len(js_tostring(js_a(argv, argc, 0))) = 0)
      Case SYM_startsWith
        Dim t As String = js_tostring(js_a(argv, argc, 0))
        Return js_bool(Left(s, Len(t)) = t)
      Case SYM_endsWith
        Dim t As String = js_tostring(js_a(argv, argc, 0))
        Return js_bool(Right(s, Len(t)) = t)
      Case SYM_split
        If js_is_regex(js_a(argv, argc, 0)) Then Return js_re_split(s, argv[0])
        Return js_str_split(s, js_a(argv, argc, 0))
      Case SYM_localeCompare
        ' code unit order (the algorithms compare ASCII)
        Dim t As String = js_tostring(js_a(argv, argc, 0))
        Return js_num(IIf(s < t, -1, IIf(s > t, 1, 0)))
      Case SYM_match
        If js_is_regex(js_a(argv, argc, 0)) Then Return js_re_match(s, argv[0])
        Return js_re_match(s, js_regex_new(js_tostring(js_a(argv, argc, 0)), ""))
      Case SYM_search
        If js_is_regex(js_a(argv, argc, 0)) Then Return js_num(js_re_search_index(s, argv[0]))
        Return js_num(js_str_indexof(s, js_tostring(js_a(argv, argc, 0)), 0))
      Case SYM_replaceAll
        If js_is_regex(js_a(argv, argc, 0)) Then Return js_str(js_re_replace(s, argv[0], js_a(argv, argc, 1), -1))
        Return js_str(js_str_replace(s, js_tostring(js_a(argv, argc, 0)), js_tostring(js_a(argv, argc, 1)), -1))
      Case SYM_toUpperCase
        Return js_str(UCase(s))
      Case SYM_toLowerCase
        Return js_str(LCase(s))
      Case SYM_trim
        Return js_str(Trim(s, Any !" \t\n\r"))
      Case SYM_padStart, SYM_padEnd
        Return js_str(js_pad(s, CLng(js_tonum(js_a(argv, argc, 0))), js_a(argv, argc, 1), sym = SYM_padStart))
      Case SYM_repeat
        Dim r As String
        For i As Long = 1 To CLng(js_tonum(js_a(argv, argc, 0)))
          r &= s
        Next
        Return js_str(r)
      Case SYM_replace
        If js_is_regex(js_a(argv, argc, 0)) Then Return js_str(js_re_replace(s, argv[0], js_a(argv, argc, 1), 0))
        Return js_str(js_str_replace(s, js_tostring(js_a(argv, argc, 0)), js_tostring(js_a(argv, argc, 1)), 0))
      Case SYM_concat
        Dim r As String = s
        For i As Long = 0 To argc - 1
          r &= js_tostring(argv[i])
        Next
        Return js_str(r)
      Case SYM_toString, SYM_valueOf
        Return obj
    End Select
  ElseIf obj.tag = JS_T_NUM Then
    Select Case sym
      Case SYM_toString
        Dim radix As Long = IIf(argc > 0 AndAlso argv[0].tag <> JS_T_UNDEF, CLng(js_tonum(argv[0])), 10)
        Return js_str(js_numstr(obj.n, radix))
      Case SYM_toFixed
        Dim digits As Long = IIf(argc > 0, CLng(js_tonum(argv[0])), 0)
        Dim buf As ZString * 400
        sprintf(@buf, "%.*f", digits, obj.n)
        Return js_str(buf)
      Case SYM_valueOf
        Return obj
    End Select
  ElseIf obj.tag = JS_T_BIG Then
    If sym = SYM_toString Then
      Dim radix As Long = IIf(argc > 0 AndAlso argv[0].tag <> JS_T_UNDEF, CLng(js_tonum(argv[0])), 10)
      Return js_str(js_big_tostring(js_bigh(obj), radix))
    End If
  ElseIf obj.tag = JS_T_OBJ AndAlso obj.p->kind = JS_K_MAP Then
    Dim m As JsMapH Ptr = Cast(JsMapH Ptr, obj.p)
    Select Case sym
      Case SYM_get
        Dim i As Long = js_maph_find(m, js_a(argv, argc, 0))
        If i >= 0 Then Return m->vs[i]
        Return u
      Case SYM_set
        js_maph_set(m, js_a(argv, argc, 0), js_a(argv, argc, 1))
        Return obj
      Case SYM_add
        Dim k As JsV = js_a(argv, argc, 0)
        js_maph_set(m, k, k)
        Return obj
      Case SYM_has
        Return js_bool(js_maph_find(m, js_a(argv, argc, 0)) >= 0)
      Case SYM_delete
        Dim i As Long = js_maph_find(m, js_a(argv, argc, 0))
        If i < 0 Then Return js_bool(0)
        For k As Long = i To m->count - 2
          m->ks[k] = m->ks[k + 1]
          m->vs[k] = m->vs[k + 1]
        Next
        m->ks[m->count - 1] = u
        m->vs[m->count - 1] = u
        m->count -= 1
        Return js_bool(-1)
      Case SYM_clear
        For k As Long = 0 To m->count - 1
          m->ks[k] = u
          m->vs[k] = u
        Next
        m->count = 0
        Return u
      Case SYM_keys, SYM_values, SYM_entries
        Dim r As JsArrH Ptr = js_arrh_new(m->count)
        For k As Long = 0 To m->count - 1
          If sym = SYM_keys Then
            r->items[k] = m->ks[k]
          ElseIf sym = SYM_values Then
            r->items[k] = m->vs[k]
          Else
            Dim pr As JsArrH Ptr = js_arrh_new(2)
            pr->items[0] = m->ks[k]
            pr->items[1] = m->vs[k]
            r->items[k] = js_objv(pr)
          End If
        Next
        Return js_objv(r)
      Case SYM_forEach
        Dim f As JsV = js_a(argv, argc, 0)
        For k As Long = 0 To m->count - 1
          js_call3(f, m->vs[k], m->ks[k], obj)
        Next
        Return u
    End Select
  ElseIf obj.tag = JS_T_OBJ AndAlso obj.p->kind = JS_K_FN Then
    Select Case sym
      Case SYM_call
        If argc = 0 Then Return js_call(obj, u, 0, 0)
        Return js_call(obj, argv[0], argv + 1, argc - 1)
      Case SYM_apply
        Dim lst As JsV = js_toarr(js_a(argv, argc, 1))
        Dim la As JsArrH Ptr = Cast(JsArrH Ptr, lst.p)
        Return js_call(obj, js_a(argv, argc, 0), la->items, la->length)
      Case SYM_bind
        Return obj
    End Select
  ElseIf obj.tag = JS_T_OBJ AndAlso obj.p->kind = JS_K_OBJ Then
    If js_is_regex(obj) Then
      Select Case sym
        Case SYM_test
          Return js_bool(js_re_test(obj, js_tostring(js_a(argv, argc, 0))))
        Case SYM_exec
          Return js_re_match(js_tostring(js_a(argv, argc, 0)), js_regex_new(js_tostring(js_getp(obj, SYM_re_source)), js_str_replace(js_tostring(js_getp(obj, SYM_re_flags)), "g", "", -1)))
        Case SYM_toString
          Return js_str("/" & js_tostring(js_getp(obj, SYM_re_source)) & "/" & js_tostring(js_getp(obj, SYM_re_flags)))
      End Select
    End If
    Select Case sym
      Case SYM_hasOwnProperty
        Return js_bool(js_objh_find(Cast(JsObjH Ptr, obj.p), js_keysym(js_a(argv, argc, 0))) >= 0)
      Case SYM_toString
        Return js_str(js_tostring(obj))
    End Select
  End If
  handled = 0
  Return u
End Function

' ---- iteration (for...of) and keys (for...in, Object.keys) ----
Function js_iter(ByRef v As JsV) As JsV
  If v.tag = JS_T_STR Then
    Dim s As String = JSS(v)
    Dim r As JsArrH Ptr = js_arrh_new(Len(s))
    For i As Long = 0 To Len(s) - 1
      r->items[i] = js_str(Chr(s[i]))
    Next
    Return js_objv(r)
  End If
  If v.tag = JS_T_OBJ AndAlso v.p->kind = JS_K_MAP Then
    Dim m As JsMapH Ptr = Cast(JsMapH Ptr, v.p)
    Dim h As Long
    Dim sym As Long = IIf(m->isSet, SYM_values, SYM_entries)
    Return js_builtin_call(v, sym, 0, 0, h)
  End If
  If v.tag = JS_T_OBJ AndAlso v.p->kind = JS_K_TYPED Then Return js_toarr(v)
  If v.tag = JS_T_OBJ AndAlso v.p->kind = JS_K_ARR Then Return v
  js_throw_error(js_tostring(v) & " is not iterable", "TypeError")
  Return v
End Function

Function js_keys(ByRef v As JsV) As JsV
  Dim r As JsArrH Ptr = js_arrh_new(0)
  If v.tag = JS_T_OBJ Then
    Select Case v.p->kind
      Case JS_K_OBJ, JS_K_CLASS
        Dim o As JsObjH Ptr = Cast(JsObjH Ptr, v.p)
        For i As Long = 0 To o->count - 1
          Dim k As JsV = js_str(js_symname(o->keys[i]))
          js_arrh_push(r, k)
        Next
      Case JS_K_ARR, JS_K_TYPED
        For i As Long = 0 To js_length(v) - 1
          Dim k As JsV = js_str(Str(i))
          js_arrh_push(r, k)
        Next
      Case JS_K_MAP
        Dim m As JsMapH Ptr = Cast(JsMapH Ptr, v.p)
        For i As Long = 0 To m->count - 1
          js_arrh_push(r, m->ks[i])
        Next
    End Select
  End If
  Return js_objv(r)
End Function

Function js_values(ByRef v As JsV) As JsV
  If v.tag = JS_T_OBJ AndAlso (v.p->kind = JS_K_OBJ OrElse v.p->kind = JS_K_CLASS) Then
    Dim o As JsObjH Ptr = Cast(JsObjH Ptr, v.p)
    Dim r As JsArrH Ptr = js_arrh_new(o->count)
    For i As Long = 0 To o->count - 1
      r->items[i] = o->vals[i]
    Next
    Return js_objv(r)
  End If
  Return js_toarr(v)
End Function

Function js_entries(ByRef v As JsV) As JsV
  Dim ks As JsV = js_keys(v)
  Dim n As Long = js_length(ks)
  Dim r As JsArrH Ptr = js_arrh_new(n)
  For i As Long = 0 To n - 1
    Dim pr As JsArrH Ptr = js_arrh_new(2)
    pr->items[0] = js_index_get(ks, i)
    pr->items[1] = js_get(v, pr->items[0])
    r->items[i] = js_objv(pr)
  Next
  Return js_objv(r)
End Function

Function js_assign(ByRef target As JsV, ByRef src As JsV) As JsV
  If src.tag = JS_T_OBJ AndAlso (src.p->kind = JS_K_OBJ OrElse src.p->kind = JS_K_CLASS) Then
    Dim o As JsObjH Ptr = Cast(JsObjH Ptr, src.p)
    For i As Long = 0 To o->count - 1
      js_setp(target, o->keys[i], o->vals[i])
    Next
  End If
  Return target
End Function

' spread into a new array
Function js_spread_into(ByRef dst As JsV, ByRef src As JsV) As JsV
  Dim it As JsV = js_iter(src)
  Dim a As JsArrH Ptr = Cast(JsArrH Ptr, dst.p)
  Dim s As JsArrH Ptr = Cast(JsArrH Ptr, it.p)
  For i As Long = 0 To s->length - 1
    js_arrh_push(a, s->items[i])
  Next
  Return dst
End Function

Function js_push1(ByRef arr As JsV, ByRef v As JsV) As Double
  If arr.tag = JS_T_OBJ AndAlso arr.p->kind = JS_K_ARR Then
    Dim a As JsArrH Ptr = Cast(JsArrH Ptr, arr.p)
    js_arrh_push(a, v)
    Return a->length
  End If
  Dim args(0 To 0) As JsV
  args(0) = v
  Dim r As JsV = js_callm(arr, SYM_push, @args(0), 1)
  Return js_tonum(r)
End Function

Function js_pushn(ByRef arr As JsV, ByVal d As Double) As Double
  Dim v As JsV = js_num(d)
  Return js_push1(arr, v)
End Function

Function js_in(ByRef key As JsV, ByRef obj As JsV) As Long
  If obj.tag = JS_T_OBJ AndAlso (obj.p->kind = JS_K_ARR OrElse obj.p->kind = JS_K_TYPED) AndAlso key.tag = JS_T_NUM Then
    Return key.n >= 0 AndAlso key.n < js_length(obj)
  End If
  If obj.tag = JS_T_OBJ AndAlso obj.p->kind = JS_K_MAP Then Return js_maph_find(Cast(JsMapH Ptr, obj.p), key) >= 0
  Return js_hasp(obj, js_keysym(key))
End Function

Sub js_delete(ByRef obj As JsV, ByRef key As JsV)
  If obj.tag = JS_T_OBJ AndAlso (obj.p->kind = JS_K_OBJ OrElse obj.p->kind = JS_K_CLASS) Then
    js_objh_remove(Cast(JsObjH Ptr, obj.p), js_keysym(key))
  ElseIf obj.tag = JS_T_OBJ AndAlso obj.p->kind = JS_K_ARR AndAlso key.tag = JS_T_NUM Then
    Dim u As JsV
    js_index_set(obj, CLng(key.n), u)
  End If
End Sub

' ---------------------------------------------------------------------------
' Runtime start-up, AlgorithmFramework and the OpCodes helpers the IL leaves
' ---------------------------------------------------------------------------

Dim Shared SYM_input As Long, SYM_expected As Long, SYM_text As Long, SYM_uri As Long, SYM_tests As Long
Dim Shared SYM_key As Long, SYM__key As Long, SYM_inputBuffer As Long, SYM_isInverse As Long, SYM_algorithm As Long
Dim Shared SYM_BlockSize As Long, SYM_KeySize As Long, SYM_EncryptBlock As Long, SYM_DecryptBlock As Long
Dim Shared SYM_Feed As Long, SYM_Result As Long, SYM_CreateInstance As Long, SYM_description As Long
Dim Shared SYM_mitigation As Long, SYM_minSize As Long, SYM_maxSize As Long, SYM_stepSize As Long
Dim Shared SYM_Success As Long, SYM_Output As Long, SYM_FailureReason As Long, SYM_OutputSize As Long
Dim Shared SYM_Iterations As Long, SYM_aad As Long, SYM_tagSize As Long, SYM_blockSizeL As Long
Dim Shared SYM_padByte As Long, SYM_lengthBytes As Long, SYM_lengthLittleEndian As Long, SYM_lengthInBits As Long
Dim Shared SYM_RequireBlockMultiple As Long, SYM_Absorb As Long, SYM_Finish As Long, SYM_Reset As Long
Dim Shared SYM_Pending As Long, SYM_LengthU As Long, SYM__held As Long, SYM__pending As Long, SYM__length As Long
Dim Shared SYM__blockSize As Long, SYM__processBlock As Long, SYM_Dispose As Long

Dim Shared CLS_LinkItem As JsV, CLS_TestCase As JsV, CLS_Vulnerability As JsV, CLS_AuthResult As JsV
Dim Shared CLS_KeySize As JsV, CLS_BlockAbsorber As JsV
Dim Shared CLS_Algorithm As JsV, CLS_CryptoAlgorithm As JsV, CLS_SymmetricCipherAlgorithm As JsV
Dim Shared CLS_AsymmetricCipherAlgorithm As JsV, CLS_AsymmetricAlgorithm As JsV, CLS_BlockCipherAlgorithm As JsV
Dim Shared CLS_StreamCipherAlgorithm As JsV, CLS_EncodingAlgorithm As JsV, CLS_CompressionAlgorithm As JsV
Dim Shared CLS_ErrorCorrectionAlgorithm As JsV, CLS_HashFunctionAlgorithm As JsV, CLS_MacAlgorithm As JsV
Dim Shared CLS_KdfAlgorithm As JsV, CLS_PaddingAlgorithm As JsV, CLS_CipherModeAlgorithm As JsV
Dim Shared CLS_AeadAlgorithm As JsV, CLS_RandomGenerationAlgorithm As JsV
Dim Shared CLS_IAlgorithmInstance As JsV, CLS_IBlockCipherInstance As JsV, CLS_IHashFunctionInstance As JsV
Dim Shared CLS_IMacInstance As JsV, CLS_IKdfInstance As JsV, CLS_IAeadInstance As JsV
Dim Shared CLS_IErrorCorrectionInstance As JsV, CLS_IRandomGeneratorInstance As JsV
Dim Shared CLS_IStreamCipherInstance As JsV, CLS_IEncodingInstance As JsV, CLS_ICompressionInstance As JsV
Dim Shared CLS_ICipherModeInstance As JsV, CLS_IPaddingInstance As JsV
Dim Shared G_CategoryType As JsV, G_SecurityStatus As JsV, G_ComplexityType As JsV, G_CountryCode As JsV
Dim Shared G_Algorithms As JsV

' field initialization helper: self.<sym> = value
' this.x = v in a framework constructor: a subclass's setter receives it, as in
' JavaScript; a getter without a setter keeps answering (JavaScript would throw)
Sub js_init(ByRef self As JsV, ByVal sym As Long, ByRef v As JsV)
  Dim o As JsObjH Ptr = Cast(JsObjH Ptr, self.p)
  If o->cls Then
    If js_class_lookup(o->cls, sym, 2) Then
      js_setp(self, sym, v)
      Exit Sub
    End If
    If js_class_lookup(o->cls, sym, 1) Then Exit Sub
  End If
  js_objh_set(o, sym, v)
End Sub

Function fw_LinkItem_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  js_init(self, SYM_text, js_arg(argv, argc, 0))
  js_init(self, SYM_uri, js_arg(argv, argc, 1))
  Return self
End Function

Function fw_TestCase_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim d As JsV = js_arg(argv, argc, 2)
  If d.tag = JS_T_UNDEF Then d = js_str("")
  Dim u As JsV = js_arg(argv, argc, 3)
  If u.tag = JS_T_UNDEF Then u = js_str("")
  js_init(self, SYM_text, d)
  js_init(self, SYM_uri, u)
  js_init(self, SYM_input, js_arg(argv, argc, 0))
  js_init(self, SYM_expected, js_arg(argv, argc, 1))
  Return self
End Function

Function fw_Vulnerability_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  js_init(self, SYM_text, js_arg(argv, argc, 0))
  js_init(self, SYM_uri, js_arg(argv, argc, 3))
  js_init(self, SYM_description, js_arg(argv, argc, 1))
  js_init(self, SYM_mitigation, js_arg(argv, argc, 2))
  Return self
End Function

Function fw_AuthResult_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  js_init(self, SYM_Success, js_arg(argv, argc, 0))
  Dim o As JsV = js_arg(argv, argc, 1)
  If o.tag = JS_T_UNDEF Then o = js_null()
  js_init(self, SYM_Output, o)
  Dim f As JsV = js_arg(argv, argc, 2)
  If f.tag = JS_T_UNDEF Then f = js_null()
  js_init(self, SYM_FailureReason, f)
  Return self
End Function

Function fw_KeySize_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  js_init(self, SYM_minSize, js_arg(argv, argc, 0))
  js_init(self, SYM_maxSize, js_arg(argv, argc, 1))
  Dim s As JsV = js_arg(argv, argc, 2)
  If s.tag = JS_T_UNDEF Then s = js_num(1)
  js_init(self, SYM_stepSize, s)
  Return self
End Function

Function fw_Algorithm_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim nl As JsV = js_null()
  js_init(self, SYM_name, nl)
  js_init(self, SYM_description, nl)
  js_init(self, js_sym("inventor"), nl)
  js_init(self, js_sym("year"), nl)
  js_init(self, js_sym("category"), nl)
  js_init(self, js_sym("subCategory"), nl)
  js_init(self, js_sym("securityStatus"), nl)
  js_init(self, js_sym("complexity"), nl)
  js_init(self, js_sym("country"), nl)
  js_init(self, js_sym("documentation"), js_arr_new(0))
  js_init(self, js_sym("references"), js_arr_new(0))
  js_init(self, js_sym("knownVulnerabilities"), js_arr_new(0))
  js_init(self, SYM_tests, js_arr_new(0))
  Return self
End Function

Function fw_parent_then(ByRef self As JsV, ByVal parentCtor As JsFnPtr, ByVal sym1 As Long, ByRef v1 As JsV, ByVal sym2 As Long, ByRef v2 As JsV, ByVal sym3 As Long = -1) As JsV
  parentCtor(self, 0, 0, 0)
  If sym1 >= 0 Then js_init(self, sym1, v1)
  If sym2 >= 0 Then js_init(self, sym2, v2)
  Return self
End Function

Function fw_BlockCipherAlgorithm_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Return fw_parent_then(self, @fw_Algorithm_ctor, js_sym("SupportedKeySizes"), js_arr_new(0), js_sym("SupportedBlockSizes"), js_arr_new(0))
End Function

Function fw_HashFunctionAlgorithm_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim u As JsV
  Return fw_parent_then(self, @fw_Algorithm_ctor, js_sym("SupportedOutputSizes"), js_arr_new(0), -1, u)
End Function

Function fw_MacAlgorithm_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Return fw_parent_then(self, @fw_Algorithm_ctor, js_sym("SupportedMacSizes"), js_arr_new(0), js_sym("NeedsKey"), js_bool(-1))
End Function

Function fw_KdfAlgorithm_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Return fw_parent_then(self, @fw_Algorithm_ctor, js_sym("SupportedOutputSizes"), js_arr_new(0), js_sym("SaltRequired"), js_bool(-1))
End Function

Function fw_PaddingAlgorithm_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim u As JsV
  Return fw_parent_then(self, @fw_Algorithm_ctor, js_sym("IsLengthIncluded"), js_bool(0), -1, u)
End Function

Function fw_CipherModeAlgorithm_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Return fw_parent_then(self, @fw_Algorithm_ctor, js_sym("RequiresIV"), js_bool(-1), js_sym("SupportedIVSizes"), js_arr_new(0))
End Function

Function fw_AeadAlgorithm_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Return fw_parent_then(self, @fw_Algorithm_ctor, js_sym("SupportedTagSizes"), js_arr_new(0), js_sym("SupportsDetached"), js_bool(0))
End Function

Function fw_RandomGenerationAlgorithm_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  fw_parent_then(self, @fw_Algorithm_ctor, js_sym("IsDeterministic"), js_bool(0), js_sym("IsCryptographicallySecure"), js_bool(-1))
  js_init(self, js_sym("SupportedSeedSizes"), js_arr_new(0))
  Return self
End Function

Function fw_Algorithm_CreateInstance(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  js_throw(js_str("CreateInstance() not implemented"))
  Return self
End Function

' ---- instances ----
Function fw_IAlgorithmInstance_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  js_init(self, SYM_algorithm, js_arg(argv, argc, 0))
  js_init(self, SYM_isInverse, js_bool(0))
  js_init(self, SYM_inputBuffer, js_arr_new(0))
  Return self
End Function

Function fw_IAlgorithmInstance_Feed(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim u As JsV
  Dim d As JsV = js_arg(argv, argc, 0)
  If js_truthy(d) = 0 Then Return u
  Dim n As Long = js_length(d)
  If n = 0 Then Return u
  Dim buf As JsV = js_getp(self, SYM_inputBuffer)
  If js_truthy(buf) = 0 Then
    buf = js_arr_new(0)
    js_setp(self, SYM_inputBuffer, buf)
  End If
  For i As Long = 0 To n - 1
    Dim e As JsV = js_index_get(d, i)
    js_push1(buf, e)
  Next
  Return u
End Function

Function fw_IAlgorithmInstance_Result(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  js_throw(js_str("Result() not implemented"))
  Return self
End Function

Function fw_IAlgorithmInstance_Dispose(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim buf As JsV = js_getp(self, SYM_inputBuffer)
  If js_is_arr(buf) Then js_arrh_setlen(Cast(JsArrH Ptr, buf.p), 0)
  Dim u As JsV
  Return u
End Function

Function fw_IBlockCipherInstance_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  fw_IAlgorithmInstance_ctor(self, argv, argc, 0)
  js_init(self, SYM_BlockSize, js_num(0))
  js_init(self, SYM_KeySize, js_num(0))
  js_init(self, SYM__key, js_null())
  Return self
End Function

Function fw_IBlockCipherInstance_getkey(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Return js_getp(self, SYM__key)
End Function

Function fw_IBlockCipherInstance_setkey(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  js_setp(self, SYM__key, js_arg(argv, argc, 0))
  Dim u As JsV
  Return u
End Function

Function fw_IBlockCipherInstance_RequireBlockMultiple(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim sizev As JsV = js_arg(argv, argc, 0)
  Dim size As Double = IIf(js_truthy(sizev), js_tonum(sizev), js_tonum(js_getp(self, SYM_BlockSize)))
  If Not (size > 0) Then js_throw_error("BlockSize not set")
  Dim buf As JsV = js_getp(self, SYM_inputBuffer)
  Dim n As Double = IIf(js_truthy(buf), js_length(buf), 0)
  If fmod(n, size) <> 0 Then js_throw_error("Input length must be multiple of " & js_numstr(size) & " bytes")
  Return js_num(n / size)
End Function

Function fw_IBlockCipherInstance_Result(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim k As JsV = js_getp(self, SYM_key)
  If js_truthy(k) = 0 Then js_throw_error("Key not set")
  Dim buf As JsV = js_getp(self, SYM_inputBuffer)
  If js_truthy(buf) = 0 OrElse js_length(buf) = 0 Then js_throw_error("No data fed")
  Dim bsv As JsV = js_getp(self, SYM_BlockSize)
  Dim bs As Long = CLng(js_tonum(bsv))
  Dim args(0 To 0) As JsV
  args(0) = bsv
  js_callm(self, SYM_RequireBlockMultiple, @args(0), 1)
  Dim inv As Long = js_truthy(js_getp(self, SYM_isInverse))
  Dim outv As JsV = js_arr_new(0)
  Dim n As Long = js_length(buf)
  Dim offset As Long = 0
  Do While offset < n
    Dim blk As JsV = js_slice_arr(buf, js_num(offset), js_num(offset + bs))
    args(0) = blk
    Dim processed As JsV = js_callm(self, IIf(inv, SYM_DecryptBlock, SYM_EncryptBlock), @args(0), 1)
    Dim m As Long = js_length(processed)
    For i As Long = 0 To m - 1
      Dim e As JsV = js_index_get(processed, i)
      js_push1(outv, e)
    Next
    offset += bs
  Loop
  js_setp(self, SYM_inputBuffer, js_arr_new(0))
  Return outv
End Function

Function fw_not_implemented(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  js_throw(js_str("not implemented"))
  Return self
End Function

Function fw_IHashFunctionInstance_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  fw_IAlgorithmInstance_ctor(self, argv, argc, 0)
  js_init(self, SYM_OutputSize, js_num(0))
  Return self
End Function

Function fw_IKdfInstance_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  fw_IAlgorithmInstance_ctor(self, argv, argc, 0)
  js_init(self, SYM_OutputSize, js_num(0))
  js_init(self, SYM_Iterations, js_num(0))
  Return self
End Function

Function fw_IAeadInstance_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  fw_IAlgorithmInstance_ctor(self, argv, argc, 0)
  js_init(self, SYM_aad, js_arr_new(0))
  js_init(self, SYM_tagSize, js_num(0))
  Return self
End Function

' ---- BlockAbsorber, SpongePadBlocks, MerkleDamgardBlocks ----
Function fw_byte(ByVal v As Double) As Double
  Dim r As Double = fmod(js_dfix(v), 256)
  If r < 0 Then r += 256
  Return r
End Function

Function fw_BlockAbsorber_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim bs As Double = js_argnum(argv, argc, 0)
  If Not (bs > 0) Then js_throw_error("BlockAbsorber: blockSize must be positive")
  Dim f As JsV = js_arg(argv, argc, 1)
  If f.tag <> JS_T_OBJ OrElse f.p->kind <> JS_K_FN Then js_throw_error("BlockAbsorber: processBlock must be a function")
  js_init(self, SYM__blockSize, js_num(bs))
  js_init(self, SYM__processBlock, f)
  js_init(self, SYM__held, js_arr_fillnew(CLng(bs), js_num(0)))
  js_init(self, SYM__pending, js_num(0))
  js_init(self, SYM__length, js_num(0))
  Return self
End Function

Function fw_BlockAbsorber_BlockSize(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Return js_getp(self, SYM__blockSize)
End Function

Function fw_BlockAbsorber_Pending(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Return js_getp(self, SYM__pending)
End Function

Function fw_BlockAbsorber_Length(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Return js_getp(self, SYM__length)
End Function

Function fw_BlockAbsorber_Absorb(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim u As JsV
  Dim d As JsV = js_arg(argv, argc, 0)
  If js_truthy(d) = 0 Then Return u
  Dim total As Long = js_length(d)
  If total = 0 Then Return u
  Dim bs As Long = CLng(js_tonum(js_getp(self, SYM__blockSize)))
  Dim held As JsV = js_getp(self, SYM__held)
  Dim f As JsV = js_getp(self, SYM__processBlock)
  Dim pending As Long = CLng(js_tonum(js_getp(self, SYM__pending)))
  Dim length_ As Double = js_tonum(js_getp(self, SYM__length))
  Dim offset As Long = 0
  Do While offset < total
    If pending = bs Then
      js_call1(f, held)
      pending = 0
    End If
    Dim take As Long = IIf(bs - pending < total - offset, bs - pending, total - offset)
    For i As Long = 0 To take - 1
      js_setidxn(held, pending + i, fw_byte(js_idxn(d, offset + i)))
    Next
    pending += take
    offset += take
    length_ += take
  Loop
  js_setp(self, SYM__pending, js_num(pending))
  js_setp(self, SYM__length, js_num(length_))
  Return u
End Function

Function fw_BlockAbsorber_Finish(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim f As JsV = js_arg(argv, argc, 0)
  If f.tag <> JS_T_OBJ OrElse f.p->kind <> JS_K_FN Then js_throw_error("BlockAbsorber: finalize must be a function")
  Dim held As JsV = js_getp(self, SYM__held)
  Dim pending As JsV = js_getp(self, SYM__pending)
  Dim h As JsV = js_slice_arr(held, js_num(0), pending)
  Return js_call3(f, h, pending, js_getp(self, SYM__length))
End Function

Function fw_BlockAbsorber_Reset(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim held As JsV = js_getp(self, SYM__held)
  For i As Long = 0 To js_length(held) - 1
    js_setidxn(held, i, 0)
  Next
  js_setp(self, SYM__pending, js_num(0))
  js_setp(self, SYM__length, js_num(0))
  Dim u As JsV
  Return u
End Function

Function fw_SpongePadBlocks(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim held As JsV = js_arg(argv, argc, 0)
  Dim pending As Long = CLng(js_argnum(argv, argc, 1))
  Dim rate As Long = CLng(js_argnum(argv, argc, 2))
  Dim sep As Double = js_argnum(argv, argc, 3)
  If Not (rate > 0) Then js_throw_error("SpongePadBlocks: rate must be positive")
  If pending < 0 OrElse pending > rate Then js_throw_error("SpongePadBlocks: pending " & pending & " outside 0.." & rate)
  Dim blocks As JsV = js_arr_new(0)
  Dim blk As JsV = js_arr_fillnew(rate, js_num(0))
  For i As Long = 0 To pending - 1
    js_setidxn(blk, i, fw_byte(js_idxn(held, i)))
  Next
  Dim used As Long = pending
  If used = rate Then
    js_push1(blocks, blk)
    blk = js_arr_fillnew(rate, js_num(0))
    used = 0
  End If
  js_setidxn(blk, used, fw_byte(sep))
  js_setidxn(blk, rate - 1, CDbl(CLng(fw_byte(js_idxn(blk, rate - 1))) Or &H80))
  js_push1(blocks, blk)
  Return blocks
End Function

Function fw_MerkleDamgardBlocks(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim held As JsV = js_arg(argv, argc, 0)
  Dim pending As Long = CLng(js_argnum(argv, argc, 1))
  Dim total As Double = js_argnum(argv, argc, 2)
  Dim opts As JsV = js_arg(argv, argc, 3)
  If opts.tag <= JS_T_NULL Then opts = js_obj_new()
  Dim bs As Long = CLng(js_tonum(js_getp(opts, SYM_blockSizeL)))
  If Not (bs > 0) Then js_throw_error("MerkleDamgardBlocks: blockSize must be positive")
  If pending < 0 OrElse pending > bs Then js_throw_error("MerkleDamgardBlocks: pending " & pending & " outside 0.." & bs)
  Dim pbv As JsV = js_getp(opts, SYM_padByte)
  Dim padByte As Double = IIf(pbv.tag = JS_T_UNDEF, 128, js_tonum(pbv))
  Dim lbv As JsV = js_getp(opts, SYM_lengthBytes)
  Dim lengthBytes As Long = IIf(lbv.tag = JS_T_UNDEF, 8, CLng(js_tonum(lbv)))
  Dim little As Long = js_strict_eq(js_getp(opts, SYM_lengthLittleEndian), js_bool(-1))
  Dim ibv As JsV = js_getp(opts, SYM_lengthInBits)
  Dim inBits As Long = Not js_strict_eq(ibv, js_bool(0))
  If lengthBytes < 0 OrElse lengthBytes >= bs Then js_throw_error("MerkleDamgardBlocks: lengthBytes " & lengthBytes & " does not fit a " & bs & "-byte block")
  Dim blocks As JsV = js_arr_new(0)
  Dim blk As JsV = js_arr_fillnew(bs, js_num(0))
  For i As Long = 0 To pending - 1
    js_setidxn(blk, i, fw_byte(js_idxn(held, i)))
  Next
  Dim used As Long = pending
  If used = bs Then
    js_push1(blocks, blk)
    blk = js_arr_fillnew(bs, js_num(0))
    used = 0
  End If
  js_setidxn(blk, used, fw_byte(padByte))
  used += 1
  If used > bs - lengthBytes Then
    js_push1(blocks, blk)
    blk = js_arr_fillnew(bs, js_num(0))
  End If
  If lengthBytes > 0 Then
    Dim remaining As Double = IIf(inBits, total * 8, total)
    remaining = IIf(remaining > 0, js_dfix(remaining), 0)
    For i As Long = 0 To lengthBytes - 1
      Dim at As Long = IIf(little, i, lengthBytes - 1 - i)
      js_setidxn(blk, bs - lengthBytes + at, fmod(remaining, 256))
      remaining = js_dfloor(remaining / 256)
    Next
  End If
  js_push1(blocks, blk)
  Return blocks
End Function

' ---- the registry ----
Function fw_process_vector(ByRef t As JsV, ByVal index As Long, ByRef aname As String) As JsV
  If js_instanceof_cls(t, js_classh(CLS_TestCase)) Then Return t
  If t.tag <> JS_T_OBJ OrElse js_hasp(t, SYM_input) = 0 Then
    js_throw_error("RegisterAlgorithm: Invalid test vector #" & (index + 1) & " in algorithm '" & aname & "' - must have at least 'input' field")
  End If
  Dim txt As JsV = js_getp(t, SYM_text)
  If js_truthy(txt) = 0 Then txt = js_str("Test vector #" & (index + 1))
  Dim uri As JsV = js_getp(t, SYM_uri)
  If js_truthy(uri) = 0 Then uri = js_str("")
  Dim ex As JsV = js_getp(t, SYM_expected)
  If ex.tag = JS_T_UNDEF Then ex = js_arr_new(0)
  Dim args(0 To 3) As JsV
  args(0) = js_getp(t, SYM_input)
  args(1) = ex
  args(2) = txt
  args(3) = uri
  Dim r As JsV = js_construct_new(CLS_TestCase, @args(0), 4)
  Dim o As JsObjH Ptr = Cast(JsObjH Ptr, t.p)
  For i As Long = 0 To o->count - 1
    Dim k As Long = o->keys[i]
    If k <> SYM_input AndAlso k <> SYM_expected AndAlso k <> SYM_text AndAlso k <> SYM_uri Then js_setp(r, k, o->vals[i])
  Next
  Return r
End Function

Function fw_Find_name(ByRef nm As String) As JsV
  Dim a As JsArrH Ptr = Cast(JsArrH Ptr, G_Algorithms.p)
  For i As Long = 0 To a->length - 1
    Dim n As JsV = js_getp(a->items[i], SYM_name)
    If n.tag = JS_T_STR AndAlso JSS(n) = nm Then Return a->items[i]
  Next
  Return js_null()
End Function

Function fw_Find(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Return fw_Find_name(js_tostring(js_arg(argv, argc, 0)))
End Function

Function fw_RegisterAlgorithm(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim alg As JsV = js_arg(argv, argc, 0)
  If alg.tag <> JS_T_OBJ Then js_throw_error("RegisterAlgorithm: Invalid algorithm object")
  Dim nm As JsV = js_getp(alg, SYM_name)
  If nm.tag <> JS_T_STR OrElse Len(JSS(nm)) = 0 Then js_throw_error("RegisterAlgorithm: Algorithm must have a valid name")
  Dim found As JsV = fw_Find_name(JSS(nm))
  If found.tag = JS_T_OBJ Then js_throw_error("RegisterAlgorithm: Algorithm '" & JSS(nm) & "' already registered")
  Dim tests As JsV = js_getp(alg, SYM_tests)
  If js_is_arr(tests) Then
    Dim n As Long = js_length(tests)
    Dim nt As JsV = js_arr_new(n)
    For i As Long = 0 To n - 1
      Dim t As JsV = js_index_get(tests, i)
      js_index_set(nt, i, fw_process_vector(t, i, JSS(nm)))
    Next
    js_setp(alg, SYM_tests, nt)
  End If
  js_push1(G_Algorithms, alg)
  Dim u As JsV
  Return u
End Function

Function fw_enum(ByVal names As ZString Ptr) As JsV
  Dim o As JsV = js_obj_new()
  Dim s As String = *names
  Dim parts As JsV = js_str_split(s, js_str(","))
  For i As Long = 0 To js_length(parts) - 1
    Dim nm As String = js_tostring(js_index_get(parts, i))
    Dim e As JsV = js_obj_new()
    js_setp(e, SYM_name, js_str(nm))
    js_setp(o, js_sym(nm), e)
  Next
  Return o
End Function

Function fw_class(ByRef nm As String, ByRef parent As JsV, ByVal ctor As JsFnPtr) As JsV
  Return js_class_new(nm, js_classh(parent), ctor)
End Function

Function js_error_ctor(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal env As Any Ptr) As JsV
  Dim m As JsV = js_arg(argv, argc, 0)
  js_init(self, SYM_message, IIf(m.tag = JS_T_UNDEF, js_str(""), js_tostrv(m)))
  js_init(self, SYM_name, js_str("Error"))
  Return self
End Function

' x87 arithmetic rounded to double precision, as JavaScript rounds every operation
Declare Function js_crt_controlfp Cdecl Alias "_controlfp" (ByVal newval As ULong, ByVal mask As ULong) As ULong

Sub js_rt_init()
  Static done As Long
  If done Then Exit Sub
  done = 1
  js_crt_controlfp(&h10000, &h30000)
  Dim zero As Double = 0
  js_nan = zero / zero
  js_inf = 1 / zero
  Randomize 1
  ReDim js_sym_names(0 To 1023)
  js_re_init_syms()
  SYM_toString = js_sym("toString") : SYM_message = js_sym("message") : SYM_name = js_sym("name") : SYM_length = js_sym("length")
  SYM_push = js_sym("push") : SYM_pop = js_sym("pop") : SYM_shift = js_sym("shift") : SYM_unshift = js_sym("unshift")
  SYM_slice = js_sym("slice") : SYM_splice = js_sym("splice") : SYM_concat = js_sym("concat") : SYM_join = js_sym("join")
  SYM_indexOf = js_sym("indexOf") : SYM_lastIndexOf = js_sym("lastIndexOf") : SYM_includes = js_sym("includes") : SYM_reverse = js_sym("reverse")
  SYM_fill = js_sym("fill") : SYM_map = js_sym("map") : SYM_filter = js_sym("filter") : SYM_forEach = js_sym("forEach")
  SYM_reduce = js_sym("reduce") : SYM_some = js_sym("some") : SYM_every = js_sym("every") : SYM_find = js_sym("find")
  SYM_findIndex = js_sym("findIndex") : SYM_sort = js_sym("sort") : SYM_set = js_sym("set") : SYM_subarray = js_sym("subarray")
  SYM_get = js_sym("get") : SYM_has = js_sym("has") : SYM_delete = js_sym("delete") : SYM_add = js_sym("add") : SYM_clear = js_sym("clear")
  SYM_keys = js_sym("keys") : SYM_values = js_sym("values") : SYM_entries = js_sym("entries") : SYM_size = js_sym("size")
  SYM_charAt = js_sym("charAt") : SYM_charCodeAt = js_sym("charCodeAt") : SYM_substring = js_sym("substring") : SYM_substr = js_sym("substr")
  SYM_split = js_sym("split") : SYM_toUpperCase = js_sym("toUpperCase") : SYM_toLowerCase = js_sym("toLowerCase") : SYM_trim = js_sym("trim")
  SYM_padStart = js_sym("padStart") : SYM_padEnd = js_sym("padEnd") : SYM_repeat = js_sym("repeat") : SYM_startsWith = js_sym("startsWith")
  SYM_endsWith = js_sym("endsWith") : SYM_replace = js_sym("replace") : SYM_toFixed = js_sym("toFixed") : SYM_buffer = js_sym("buffer")
  SYM_byteLength = js_sym("byteLength") : SYM_byteOffset = js_sym("byteOffset") : SYM_call = js_sym("call") : SYM_apply = js_sym("apply")
  SYM_bind = js_sym("bind") : SYM_stack = js_sym("stack") : SYM_copyWithin = js_sym("copyWithin") : SYM_at = js_sym("at")
  SYM_codePointAt = js_sym("codePointAt") : SYM_valueOf = js_sym("valueOf") : SYM_hasOwnProperty = js_sym("hasOwnProperty")
  SYM_input = js_sym("input") : SYM_expected = js_sym("expected") : SYM_text = js_sym("text") : SYM_uri = js_sym("uri") : SYM_tests = js_sym("tests")
  SYM_key = js_sym("key") : SYM__key = js_sym("_key") : SYM_inputBuffer = js_sym("inputBuffer") : SYM_isInverse = js_sym("isInverse")
  SYM_algorithm = js_sym("algorithm") : SYM_BlockSize = js_sym("BlockSize") : SYM_KeySize = js_sym("KeySize")
  SYM_EncryptBlock = js_sym("EncryptBlock") : SYM_DecryptBlock = js_sym("DecryptBlock") : SYM_Feed = js_sym("Feed") : SYM_Result = js_sym("Result")
  SYM_CreateInstance = js_sym("CreateInstance") : SYM_description = js_sym("description") : SYM_mitigation = js_sym("mitigation")
  SYM_minSize = js_sym("minSize") : SYM_maxSize = js_sym("maxSize") : SYM_stepSize = js_sym("stepSize")
  SYM_Success = js_sym("Success") : SYM_Output = js_sym("Output") : SYM_FailureReason = js_sym("FailureReason") : SYM_OutputSize = js_sym("OutputSize")
  SYM_Iterations = js_sym("Iterations") : SYM_aad = js_sym("aad") : SYM_tagSize = js_sym("tagSize") : SYM_blockSizeL = js_sym("blockSize")
  SYM_padByte = js_sym("padByte") : SYM_lengthBytes = js_sym("lengthBytes") : SYM_lengthLittleEndian = js_sym("lengthLittleEndian") : SYM_lengthInBits = js_sym("lengthInBits")
  SYM_RequireBlockMultiple = js_sym("RequireBlockMultiple") : SYM_Absorb = js_sym("Absorb") : SYM_Finish = js_sym("Finish") : SYM_Reset = js_sym("Reset")
  SYM_Pending = js_sym("Pending") : SYM_LengthU = js_sym("Length") : SYM__held = js_sym("_held") : SYM__pending = js_sym("_pending") : SYM__length = js_sym("_length")
  SYM__blockSize = js_sym("_blockSize") : SYM__processBlock = js_sym("_processBlock") : SYM_Dispose = js_sym("Dispose")

  Dim nul As JsV
  CLS_Error = js_class_new("Error", 0, @js_error_ctor)
  CLS_LinkItem = js_class_new("LinkItem", 0, @fw_LinkItem_ctor)
  CLS_TestCase = js_class_new("TestCase", js_classh(CLS_LinkItem), @fw_TestCase_ctor)
  CLS_Vulnerability = js_class_new("Vulnerability", js_classh(CLS_LinkItem), @fw_Vulnerability_ctor)
  CLS_AuthResult = js_class_new("AuthResult", 0, @fw_AuthResult_ctor)
  CLS_KeySize = js_class_new("KeySize", 0, @fw_KeySize_ctor)
  CLS_BlockAbsorber = js_class_new("BlockAbsorber", 0, @fw_BlockAbsorber_ctor)
  js_class_add(CLS_BlockAbsorber, SYM_BlockSize, @fw_BlockAbsorber_BlockSize, 1)
  js_class_add(CLS_BlockAbsorber, SYM_Pending, @fw_BlockAbsorber_Pending, 1)
  js_class_add(CLS_BlockAbsorber, SYM_LengthU, @fw_BlockAbsorber_Length, 1)
  js_class_add(CLS_BlockAbsorber, SYM_Absorb, @fw_BlockAbsorber_Absorb, 0)
  js_class_add(CLS_BlockAbsorber, SYM_Finish, @fw_BlockAbsorber_Finish, 0)
  js_class_add(CLS_BlockAbsorber, SYM_Reset, @fw_BlockAbsorber_Reset, 0)

  CLS_Algorithm = js_class_new("Algorithm", 0, @fw_Algorithm_ctor)
  js_class_add(CLS_Algorithm, SYM_CreateInstance, @fw_Algorithm_CreateInstance, 0)
  CLS_CryptoAlgorithm = fw_class("CryptoAlgorithm", CLS_Algorithm, 0)
  CLS_SymmetricCipherAlgorithm = fw_class("SymmetricCipherAlgorithm", CLS_CryptoAlgorithm, 0)
  CLS_AsymmetricCipherAlgorithm = fw_class("AsymmetricCipherAlgorithm", CLS_CryptoAlgorithm, 0)
  CLS_AsymmetricAlgorithm = fw_class("AsymmetricAlgorithm", CLS_CryptoAlgorithm, 0)
  CLS_BlockCipherAlgorithm = fw_class("BlockCipherAlgorithm", CLS_SymmetricCipherAlgorithm, @fw_BlockCipherAlgorithm_ctor)
  CLS_StreamCipherAlgorithm = fw_class("StreamCipherAlgorithm", CLS_SymmetricCipherAlgorithm, 0)
  CLS_EncodingAlgorithm = fw_class("EncodingAlgorithm", CLS_Algorithm, 0)
  CLS_CompressionAlgorithm = fw_class("CompressionAlgorithm", CLS_Algorithm, 0)
  CLS_ErrorCorrectionAlgorithm = fw_class("ErrorCorrectionAlgorithm", CLS_Algorithm, 0)
  CLS_HashFunctionAlgorithm = fw_class("HashFunctionAlgorithm", CLS_Algorithm, @fw_HashFunctionAlgorithm_ctor)
  CLS_MacAlgorithm = fw_class("MacAlgorithm", CLS_Algorithm, @fw_MacAlgorithm_ctor)
  CLS_KdfAlgorithm = fw_class("KdfAlgorithm", CLS_Algorithm, @fw_KdfAlgorithm_ctor)
  CLS_PaddingAlgorithm = fw_class("PaddingAlgorithm", CLS_Algorithm, @fw_PaddingAlgorithm_ctor)
  CLS_CipherModeAlgorithm = fw_class("CipherModeAlgorithm", CLS_Algorithm, @fw_CipherModeAlgorithm_ctor)
  CLS_AeadAlgorithm = fw_class("AeadAlgorithm", CLS_CryptoAlgorithm, @fw_AeadAlgorithm_ctor)
  CLS_RandomGenerationAlgorithm = fw_class("RandomGenerationAlgorithm", CLS_Algorithm, @fw_RandomGenerationAlgorithm_ctor)

  CLS_IAlgorithmInstance = js_class_new("IAlgorithmInstance", 0, @fw_IAlgorithmInstance_ctor)
  js_class_add(CLS_IAlgorithmInstance, SYM_Feed, @fw_IAlgorithmInstance_Feed, 0)
  js_class_add(CLS_IAlgorithmInstance, SYM_Result, @fw_IAlgorithmInstance_Result, 0)
  js_class_add(CLS_IAlgorithmInstance, SYM_Dispose, @fw_IAlgorithmInstance_Dispose, 0)
  CLS_IBlockCipherInstance = fw_class("IBlockCipherInstance", CLS_IAlgorithmInstance, @fw_IBlockCipherInstance_ctor)
  js_class_add(CLS_IBlockCipherInstance, SYM_key, @fw_IBlockCipherInstance_getkey, 1)
  js_class_add(CLS_IBlockCipherInstance, SYM_key, @fw_IBlockCipherInstance_setkey, 2)
  js_class_add(CLS_IBlockCipherInstance, SYM_RequireBlockMultiple, @fw_IBlockCipherInstance_RequireBlockMultiple, 0)
  js_class_add(CLS_IBlockCipherInstance, SYM_Result, @fw_IBlockCipherInstance_Result, 0)
  js_class_add(CLS_IBlockCipherInstance, SYM_EncryptBlock, @fw_not_implemented, 0)
  js_class_add(CLS_IBlockCipherInstance, SYM_DecryptBlock, @fw_not_implemented, 0)
  CLS_IHashFunctionInstance = fw_class("IHashFunctionInstance", CLS_IAlgorithmInstance, @fw_IHashFunctionInstance_ctor)
  CLS_IMacInstance = fw_class("IMacInstance", CLS_IAlgorithmInstance, 0)
  CLS_IKdfInstance = fw_class("IKdfInstance", CLS_IAlgorithmInstance, @fw_IKdfInstance_ctor)
  CLS_IAeadInstance = fw_class("IAeadInstance", CLS_IAlgorithmInstance, @fw_IAeadInstance_ctor)
  CLS_IErrorCorrectionInstance = fw_class("IErrorCorrectionInstance", CLS_IAlgorithmInstance, 0)
  CLS_IRandomGeneratorInstance = fw_class("IRandomGeneratorInstance", CLS_IAlgorithmInstance, 0)
  CLS_IStreamCipherInstance = fw_class("IStreamCipherInstance", CLS_IAlgorithmInstance, 0)
  CLS_IEncodingInstance = fw_class("IEncodingInstance", CLS_IAlgorithmInstance, 0)
  CLS_ICompressionInstance = fw_class("ICompressionInstance", CLS_IAlgorithmInstance, 0)
  CLS_ICipherModeInstance = fw_class("ICipherModeInstance", CLS_IAlgorithmInstance, 0)
  CLS_IPaddingInstance = fw_class("IPaddingInstance", CLS_IAlgorithmInstance, 0)

  G_CategoryType = fw_enum("ASYMMETRIC,BLOCK,STREAM,HASH,CHECKSUM,COMPRESSION,ENCODING,CLASSICAL,MAC,KDF,ECC,MODE,PADDING,AEAD,SPECIAL,PQC,RANDOM")
  G_SecurityStatus = fw_enum("SECURE,DEPRECATED,BROKEN,OBSOLETE,EXPERIMENTAL,EDUCATIONAL")
  G_ComplexityType = fw_enum("BEGINNER,INTERMEDIATE,ADVANCED,EXPERT,RESEARCH")
  G_CountryCode = fw_enum("US,RU,CN,UA,DE,GB,FR,JP,KR,IL,BE,CA,AU,IT,NL,CH,SE,NO,IN,BR,INTL,ANCIENT,UNKNOWN")
  G_Algorithms = js_arr_new(0)
End Sub

' ---------------------------------------------------------------------------
' Helpers the generated code calls
' ---------------------------------------------------------------------------

Function js_unsupported(ByRef what As String) As JsV
  js_throw_error("not supported by the FreeBASIC transpiler: " & what)
  Dim u As JsV
  Return u
End Function

Sub js_unsupported_s(ByRef what As String)
  js_unsupported(what)
End Sub

' globals no module declares: names a bundle binds (a .data library, a loader)
Dim Shared G_Globals As JsV

Sub js_global_set(ByRef nm As String, ByRef v As JsV)
  If G_Globals.tag <> JS_T_OBJ Then G_Globals = js_obj_new()
  js_setp(G_Globals, js_sym(nm), v)
End Sub

Declare Function oc_global_object() As JsV

' performance.now(): milliseconds
Function js_perf_now(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr) As JsV
  Return js_num(Timer * 1000.0)
End Function

' String, Number, Boolean and BigInt as values (xs.map(String))
Function js_fnv_String(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr) As JsV
  If argc = 0 Then Return js_str("")
  Return js_tostrv(argv[0])
End Function

Function js_fnv_Number(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr) As JsV
  If argc = 0 Then Return js_num(0)
  Return js_num(js_tonum(argv[0]))
End Function

Function js_fnv_Boolean(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr) As JsV
  Return js_bool(argc > 0 AndAlso js_truthy(argv[0]))
End Function

Function js_fnv_BigInt(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr) As JsV
  Return js_tobig(js_arg(argv, argc, 0))
End Function

Function js_global_get(ByRef nm As String) As JsV
  If G_Globals.tag = JS_T_OBJ AndAlso js_hasp(G_Globals, js_sym(nm)) Then Return js_getp(G_Globals, js_sym(nm))
  Select Case nm
    Case "String" : Return js_fn_new(@js_fnv_String, 0)
    Case "Number" : Return js_fn_new(@js_fnv_Number, 0)
    Case "Boolean" : Return js_fn_new(@js_fnv_Boolean, 0)
    Case "BigInt" : Return js_fn_new(@js_fnv_BigInt, 0)
  End Select
  If nm = "OpCodes" Then Return oc_global_object()
  If nm = "performance" Then
    Dim perf As JsV = js_obj_new()
    js_setp(perf, js_sym("now"), js_fn_new(@js_perf_now, 0))
    js_global_set(nm, perf)
    Return perf
  End If
  Return js_unsupported("global " & nm)
End Function

' typeof of a name no module declares: what a bundle bound, a builtin the runtime provides, else "undefined"
Function js_global_typeof(ByRef nm As String) As JsV
  If G_Globals.tag = JS_T_OBJ AndAlso js_hasp(G_Globals, js_sym(nm)) Then Return js_typeof(js_getp(G_Globals, js_sym(nm)))
  Select Case nm
    Case "Math", "JSON", "AlgorithmFramework", "OpCodes", "console", "performance"
      Return js_str("object")
    Case "BigInt", "Number", "String", "Array", "Object", "Boolean", "Error", "TypeError", "RangeError", _
         "Uint8Array", "Uint16Array", "Uint32Array", "Int8Array", "Int16Array", "Int32Array", "Float32Array", "Float64Array", _
         "BigInt64Array", "BigUint64Array", "Uint8ClampedArray", "ArrayBuffer", "DataView", "Map", "Set", _
         "parseInt", "parseFloat", "isNaN", "isFinite"
      Return js_str("function")
  End Select
  Return js_str("undefined")
End Function

' store and pass on (assignment expressions, short-circuit temporaries)
Function js_keep(ByRef t As JsV, ByRef v As JsV) As JsV
  t = v
  Return t
End Function

Function js_keepd(ByRef t As Double, ByVal v As Double) As Double
  t = v
  Return v
End Function

Function js_discard(ByRef v As JsV) As Long
  Return 0
End Function

' left-to-right argument evaluation: a sum of these runs in order
Function js_keepn(ByRef t As JsV, ByRef v As JsV) As Long
  t = v
  Return 0
End Function

Function js_withv(ByVal seq As Long, ByRef v As JsV) As JsV
  Return v
End Function

Function js_withf(ByVal seq As Long, ByVal f As JsFnPtr) As JsFnPtr
  Return f
End Function

' the value of an expression whose left operand ran first, in seq (the last argument is evaluated first)
Function js_seqv(ByRef v As JsV, ByVal seq As Long) As JsV
  Return v
End Function

Function js_seqd(ByVal d As Double, ByVal seq As Long) As Double
  Return d
End Function

Function js_seqb(ByVal b As Long, ByVal seq As Long) As Long
  Return b
End Function

Sub js_discard_n(ByVal seq As Long)
End Sub

Sub js_discard_s(ByRef v As JsV)
End Sub

Function js_void(ByRef v As JsV) As JsV
  Dim u As JsV
  Return u
End Function

Function js_set_r(ByRef obj As JsV, ByRef key As JsV, ByRef v As JsV) As JsV
  js_set(obj, key, v)
  Return v
End Function

Function js_setp_r(ByRef obj As JsV, ByVal sym As Long, ByRef v As JsV) As JsV
  js_setp(obj, sym, v)
  Return v
End Function

' object literal building: the object, with the property set
Function js_setp_r2(ByRef obj As JsV, ByVal sym As Long, ByRef v As JsV) As JsV
  js_objh_set(Cast(JsObjH Ptr, obj.p), sym, v)
  Return obj
End Function

Function js_set_r2(ByRef obj As JsV, ByRef key As JsV, ByRef v As JsV) As JsV
  js_set(obj, key, v)
  Return obj
End Function

Function js_setidx_r(ByRef obj As JsV, ByVal i As Double, ByRef v As JsV) As JsV
  js_setidx(obj, i, v)
  Return v
End Function

Function js_setidxn_r(ByRef obj As JsV, ByVal i As Double, ByVal v As Double) As Double
  js_setidxn(obj, i, v)
  Return v
End Function

Function js_delete_r(ByRef obj As JsV, ByRef key As JsV) As Long
  js_delete(obj, key)
  Return -1
End Function

Function js_preincd(ByRef x As Double, ByVal d As Double) As Double
  x += d
  Return x
End Function

Function js_postincd(ByRef x As Double, ByVal d As Double) As Double
  Dim old As Double = x
  x += d
  Return old
End Function

' x + d, x - d of ++ and --: a BigInt steps as a BigInt
Function js_inc(ByRef x As JsV, ByVal d As Double) As JsV
  If x.tag = JS_T_BIG Then Return js_add(x, js_big_from_double(d))
  Return js_num(js_tonum(x) + d)
End Function

Function js_preincv(ByRef x As JsV, ByVal d As Double) As JsV
  x = js_inc(x, d)
  Return x
End Function

Function js_postincv(ByRef x As JsV, ByVal d As Double) As JsV
  Dim old As JsV = x
  If old.tag <> JS_T_BIG Then old = js_num(js_tonum(x))
  x = js_inc(old, d)
  Return old
End Function

Function js_preinci(ByRef obj As JsV, ByRef key As JsV, ByVal d As Double) As Double
  Dim v As Double = js_tonum(js_get(obj, key)) + d
  Dim nv As JsV = js_num(v)
  js_set(obj, key, nv)
  Return v
End Function

Function js_postinci(ByRef obj As JsV, ByRef key As JsV, ByVal d As Double) As Double
  Dim v As Double = js_tonum(js_get(obj, key))
  Dim nv As JsV = js_num(v + d)
  js_set(obj, key, nv)
  Return v
End Function

Function js_preincp(ByRef obj As JsV, ByVal sym As Long, ByVal d As Double) As Double
  Dim v As Double = js_tonum(js_getp(obj, sym)) + d
  Dim nv As JsV = js_num(v)
  js_setp(obj, sym, nv)
  Return v
End Function

Function js_postincp(ByRef obj As JsV, ByVal sym As Long, ByVal d As Double) As Double
  Dim v As Double = js_tonum(js_getp(obj, sym))
  Dim nv As JsV = js_num(v + d)
  js_setp(obj, sym, nv)
  Return v
End Function

Function js_arr_push_r(ByRef arr As JsV, ByRef v As JsV) As JsV
  js_arrh_push(Cast(JsArrH Ptr, arr.p), v)
  Return arr
End Function

Function js_arr_nums(ByRef csv As String) As JsV
  Dim a As JsArrH Ptr = js_arrh_new(0)
  Dim start As Long = 1
  Do
    Dim p As Long = InStr(start, csv, ",")
    Dim part As String = IIf(p = 0, Mid(csv, start), Mid(csv, start, p - start))
    Dim v As JsV = js_num(js_parse_number(part))
    js_arrh_push(a, v)
    If p = 0 Then Exit Do
    start = p + 1
  Loop
  Return js_objv(a)
End Function

Function js_hex_bytes(ByRef hx As String) As JsV
  Dim n As Long = Len(hx) \ 2
  Dim a As JsArrH Ptr = js_arrh_new(n)
  For i As Long = 0 To n - 1
    a->items[i].tag = JS_T_NUM
    a->items[i].n = ValInt("&H" & Mid(hx, i * 2 + 1, 2))
  Next
  Return js_objv(a)
End Function

Function js_arr_copy(ByRef src As JsV) As JsV
  Dim s As JsArrH Ptr = Cast(JsArrH Ptr, src.p)
  Dim a As JsArrH Ptr = js_arrh_new(s->length)
  For i As Long = 0 To s->length - 1
    a->items[i] = s->items[i]
  Next
  Return js_objv(a)
End Function

Function js_unpack(ByVal v As Double, ByVal bits As Long, ByVal big As Long) As JsV
  Dim n As Long = bits \ 8
  Dim a As JsArrH Ptr = js_arrh_new(n)
  Dim x As ULongInt
  If bits > 32 Then
    x = CULngInt(v)
  Else
    x = js_tou32(v)
  End If
  For i As Long = 0 To n - 1
    Dim b As Long = (x Shr (8 * i)) And 255
    Dim at_ As Long = IIf(big, n - 1 - i, i)
    a->items[at_].tag = JS_T_NUM
    a->items[at_].n = b
  Next
  Return js_objv(a)
End Function

Function js_wrap_signed(ByVal d As Double, ByVal bits As Long) As Double
  Dim m As ULong = (CULng(1) Shl bits) - 1
  Dim x As ULong = js_tou32(d) And m
  If x >= (CULng(1) Shl (bits - 1)) Then Return CDbl(x) - CDbl(m) - 1
  Return x
End Function

Function js_is_typed(ByRef v As JsV, ByVal ek As Long) As Long
  Return v.tag = JS_T_OBJ AndAlso v.p->kind = JS_K_TYPED AndAlso Cast(JsTypedH Ptr, v.p)->ek = ek
End Function

Function js_isinteger(ByRef v As JsV) As Long
  If v.tag <> JS_T_NUM Then Return 0
  Return v.n = js_dfloor(v.n) AndAlso v.n <> js_inf AndAlso v.n <> -js_inf
End Function

Function js_isnan(ByRef v As JsV) As Long
  Dim d As Double = js_tonum(v)
  Return d <> d
End Function

Function js_isfinite(ByRef v As JsV) As Long
  If v.tag <> JS_T_NUM Then Return 0
  Return v.n = v.n AndAlso v.n <> js_inf AndAlso v.n <> -js_inf
End Function

Function js_parse_int(ByRef sv As JsV, ByRef rv As JsV) As Double
  Dim s As String = Trim(js_tostring(sv), Any !" \t\n\r")
  Dim radix As Long = IIf(rv.tag = JS_T_UNDEF, 0, CLng(js_tonum(rv)))
  Dim neg As Long = 0
  If Left(s, 1) = "-" Then
    neg = 1
    s = Mid(s, 2)
  ElseIf Left(s, 1) = "+" Then
    s = Mid(s, 2)
  End If
  If (radix = 0 OrElse radix = 16) AndAlso LCase(Left(s, 2)) = "0x" Then
    s = Mid(s, 3)
    radix = 16
  End If
  If radix = 0 Then radix = 10
  If radix < 2 OrElse radix > 36 Then Return js_nan
  Dim r As Double = 0
  Dim any_ As Long = 0
  For i As Long = 0 To Len(s) - 1
    Dim c As Long = s[i]
    Dim dv As Long
    If c >= 48 AndAlso c <= 57 Then
      dv = c - 48
    ElseIf c >= 97 AndAlso c <= 122 Then
      dv = c - 87
    ElseIf c >= 65 AndAlso c <= 90 Then
      dv = c - 55
    Else
      Exit For
    End If
    If dv >= radix Then Exit For
    r = r * radix + dv
    any_ = 1
  Next
  If any_ = 0 Then Return js_nan
  Return IIf(neg, -r, r)
End Function

Function js_parse_float(ByRef sv As JsV) As Double
  Dim s As String = Trim(js_tostring(sv), Any !" \t\n\r")
  Dim endp As ZString Ptr
  Dim d As Double = strtod(StrPtr(s), @endp)
  If endp = StrPtr(s) Then Return js_nan
  Return d
End Function

' new Array(n) or Array(...)
Function js_array_ctor(ByRef n As JsV) As JsV
  If n.tag = JS_T_NUM Then Return js_arr_new(CLng(n.n))
  If n.tag = JS_T_UNDEF Then Return js_arr_new(0)
  Dim a As JsV = js_arr_new(0)
  js_arrh_push(Cast(JsArrH Ptr, a.p), n)
  Return a
End Function

Function js_array_from(ByRef src As JsV, ByRef f As JsV) As JsV
  Dim r As JsV
  If src.tag = JS_T_OBJ AndAlso src.p->kind = JS_K_OBJ Then
    ' { length: n }
    Dim n As Long = CLng(js_tonum(js_getp(src, SYM_length)))
    r = js_arr_new(n)
    For i As Long = 0 To n - 1
      Dim e As JsV = js_idx(src, i)
      js_index_set(r, i, e)
    Next
  Else
    Dim it As JsV = js_iter(src)
    r = js_slice_arr(it, js_undefined(), js_undefined())
  End If
  If f.tag = JS_T_OBJ Then
    Dim n As Long = js_length(r)
    For i As Long = 0 To n - 1
      Dim e As JsV = js_index_get(r, i)
      Dim m As JsV = js_call2(f, e, js_num(i))
      js_index_set(r, i, m)
    Next
  End If
  Return r
End Function

Function js_from_char_codes(ByRef arr As JsV) As JsV
  Dim s As String
  Dim n As Long = js_length(arr)
  For i As Long = 0 To n - 1
    s &= js_fromcharcode(js_idxn(arr, i))
  Next
  Return js_str(s)
End Function

Function js_min_arr(ByRef arr As JsV) As Double
  Dim r As Double = js_inf
  For i As Long = 0 To js_length(arr) - 1
    r = js_dmin(r, js_idxn(arr, i))
  Next
  Return r
End Function

Function js_max_arr(ByRef arr As JsV) As Double
  Dim r As Double = -js_inf
  For i As Long = 0 To js_length(arr) - 1
    r = js_dmax(r, js_idxn(arr, i))
  Next
  Return r
End Function

Function js_obj_from_entries(ByRef src As JsV) As JsV
  Dim o As JsV = js_obj_new()
  Dim it As JsV = js_iter(src)
  For i As Long = 0 To js_length(it) - 1
    Dim pr As JsV = js_index_get(it, i)
    js_set(o, js_index_get(pr, 0), js_index_get(pr, 1))
  Next
  Return o
End Function

Function js_dv_set_r(ByRef dv As JsV, ByVal ek As Long, ByVal at As Double, ByRef v As JsV, ByVal little As Long) As JsV
  js_dv_set(dv, ek, at, v, little)
  Dim u As JsV
  Return u
End Function

Sub js_class_static_accessor(ByRef cv As JsV, ByVal sym As Long, ByVal fn As JsFnPtr, ByVal mkind As Long)
  ' a static getter: evaluated once, as a property of the class
  If mkind = 1 Then
    Dim r As JsV = fn(cv, 0, 0, 0)
    js_objh_set(Cast(JsObjH Ptr, cv.p), sym, r)
  End If
End Sub

Function js_classh_v(ByRef v As JsV) As JsClassH Ptr
  Return js_classh(v)
End Function


' ---- calls with their arguments given one by one (FreeBASIC evaluates arguments right to left) ----
Function js_superctor_do(ByRef pclass As JsV, ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long) As JsV
  js_construct(js_classh(pclass), self, argv, argc)
  Return self
End Function
Function js_fcall0(ByVal f As JsFnPtr) As JsV
  Dim u As JsV
  Return f(u, 0, 0, 0)
End Function
Function js_fcall1(ByVal f As JsFnPtr, ByRef a0 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 0) As JsV
  args(0) = a0
  Return f(u, @args(0), 1, 0)
End Function
Function js_fcall2(ByVal f As JsFnPtr, ByRef a0 As JsV, ByRef a1 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 1) As JsV
  args(0) = a0
  args(1) = a1
  Return f(u, @args(0), 2, 0)
End Function
Function js_fcall3(ByVal f As JsFnPtr, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 2) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  Return f(u, @args(0), 3, 0)
End Function
Function js_fcall4(ByVal f As JsFnPtr, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 3) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  Return f(u, @args(0), 4, 0)
End Function
Function js_fcall5(ByVal f As JsFnPtr, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 4) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  Return f(u, @args(0), 5, 0)
End Function
Function js_fcall6(ByVal f As JsFnPtr, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 5) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  Return f(u, @args(0), 6, 0)
End Function
Function js_fcall7(ByVal f As JsFnPtr, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 6) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  Return f(u, @args(0), 7, 0)
End Function
Function js_fcall8(ByVal f As JsFnPtr, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV, ByRef a7 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 7) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  args(7) = a7
  Return f(u, @args(0), 8, 0)
End Function
Function js_fcalla(ByVal f As JsFnPtr, ByRef arr As JsV) As JsV
  Dim u As JsV
  Dim a As JsArrH Ptr = Cast(JsArrH Ptr, arr.p)
  Return f(u, a->items, a->length, 0)
End Function
Function js_vcall0(ByRef f As JsV) As JsV
  Dim u As JsV
  Return js_call(f, u, 0, 0)
End Function
Function js_vcall1(ByRef f As JsV, ByRef a0 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 0) As JsV
  args(0) = a0
  Return js_call(f, u, @args(0), 1)
End Function
Function js_vcall2(ByRef f As JsV, ByRef a0 As JsV, ByRef a1 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 1) As JsV
  args(0) = a0
  args(1) = a1
  Return js_call(f, u, @args(0), 2)
End Function
Function js_vcall3(ByRef f As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 2) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  Return js_call(f, u, @args(0), 3)
End Function
Function js_vcall4(ByRef f As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 3) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  Return js_call(f, u, @args(0), 4)
End Function
Function js_vcall5(ByRef f As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 4) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  Return js_call(f, u, @args(0), 5)
End Function
Function js_vcall6(ByRef f As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 5) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  Return js_call(f, u, @args(0), 6)
End Function
Function js_vcall7(ByRef f As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 6) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  Return js_call(f, u, @args(0), 7)
End Function
Function js_vcall8(ByRef f As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV, ByRef a7 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 7) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  args(7) = a7
  Return js_call(f, u, @args(0), 8)
End Function
Function js_vcalla(ByRef f As JsV, ByRef arr As JsV) As JsV
  Dim u As JsV
  Dim a As JsArrH Ptr = Cast(JsArrH Ptr, arr.p)
  Return js_call(f, u, a->items, a->length)
End Function
Function js_mcall0(ByRef obj As JsV, ByVal sym As Long) As JsV
  Dim u As JsV
  Return js_callm(obj, sym, 0, 0)
End Function
Function js_mcall1(ByRef obj As JsV, ByVal sym As Long, ByRef a0 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 0) As JsV
  args(0) = a0
  Return js_callm(obj, sym, @args(0), 1)
End Function
Function js_mcall2(ByRef obj As JsV, ByVal sym As Long, ByRef a0 As JsV, ByRef a1 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 1) As JsV
  args(0) = a0
  args(1) = a1
  Return js_callm(obj, sym, @args(0), 2)
End Function
Function js_mcall3(ByRef obj As JsV, ByVal sym As Long, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 2) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  Return js_callm(obj, sym, @args(0), 3)
End Function
Function js_mcall4(ByRef obj As JsV, ByVal sym As Long, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 3) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  Return js_callm(obj, sym, @args(0), 4)
End Function
Function js_mcall5(ByRef obj As JsV, ByVal sym As Long, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 4) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  Return js_callm(obj, sym, @args(0), 5)
End Function
Function js_mcall6(ByRef obj As JsV, ByVal sym As Long, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 5) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  Return js_callm(obj, sym, @args(0), 6)
End Function
Function js_mcall7(ByRef obj As JsV, ByVal sym As Long, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 6) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  Return js_callm(obj, sym, @args(0), 7)
End Function
Function js_mcall8(ByRef obj As JsV, ByVal sym As Long, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV, ByRef a7 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 7) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  args(7) = a7
  Return js_callm(obj, sym, @args(0), 8)
End Function
Function js_mcalla(ByRef obj As JsV, ByVal sym As Long, ByRef arr As JsV) As JsV
  Dim u As JsV
  Dim a As JsArrH Ptr = Cast(JsArrH Ptr, arr.p)
  Return js_callm(obj, sym, a->items, a->length)
End Function
Function js_kcall0(ByRef obj As JsV, ByRef key As JsV) As JsV
  Dim u As JsV
  Return js_callm(obj, js_keysym(key), 0, 0)
End Function
Function js_kcall1(ByRef obj As JsV, ByRef key As JsV, ByRef a0 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 0) As JsV
  args(0) = a0
  Return js_callm(obj, js_keysym(key), @args(0), 1)
End Function
Function js_kcall2(ByRef obj As JsV, ByRef key As JsV, ByRef a0 As JsV, ByRef a1 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 1) As JsV
  args(0) = a0
  args(1) = a1
  Return js_callm(obj, js_keysym(key), @args(0), 2)
End Function
Function js_kcall3(ByRef obj As JsV, ByRef key As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 2) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  Return js_callm(obj, js_keysym(key), @args(0), 3)
End Function
Function js_kcall4(ByRef obj As JsV, ByRef key As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 3) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  Return js_callm(obj, js_keysym(key), @args(0), 4)
End Function
Function js_kcall5(ByRef obj As JsV, ByRef key As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 4) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  Return js_callm(obj, js_keysym(key), @args(0), 5)
End Function
Function js_kcall6(ByRef obj As JsV, ByRef key As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 5) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  Return js_callm(obj, js_keysym(key), @args(0), 6)
End Function
Function js_kcall7(ByRef obj As JsV, ByRef key As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 6) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  Return js_callm(obj, js_keysym(key), @args(0), 7)
End Function
Function js_kcall8(ByRef obj As JsV, ByRef key As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV, ByRef a7 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 7) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  args(7) = a7
  Return js_callm(obj, js_keysym(key), @args(0), 8)
End Function
Function js_kcalla(ByRef obj As JsV, ByRef key As JsV, ByRef arr As JsV) As JsV
  Dim u As JsV
  Dim a As JsArrH Ptr = Cast(JsArrH Ptr, arr.p)
  Return js_callm(obj, js_keysym(key), a->items, a->length)
End Function
Function js_new0(ByRef klass As JsV) As JsV
  Dim u As JsV
  Return js_construct_new(klass, 0, 0)
End Function
Function js_new1(ByRef klass As JsV, ByRef a0 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 0) As JsV
  args(0) = a0
  Return js_construct_new(klass, @args(0), 1)
End Function
Function js_new2(ByRef klass As JsV, ByRef a0 As JsV, ByRef a1 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 1) As JsV
  args(0) = a0
  args(1) = a1
  Return js_construct_new(klass, @args(0), 2)
End Function
Function js_new3(ByRef klass As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 2) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  Return js_construct_new(klass, @args(0), 3)
End Function
Function js_new4(ByRef klass As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 3) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  Return js_construct_new(klass, @args(0), 4)
End Function
Function js_new5(ByRef klass As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 4) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  Return js_construct_new(klass, @args(0), 5)
End Function
Function js_new6(ByRef klass As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 5) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  Return js_construct_new(klass, @args(0), 6)
End Function
Function js_new7(ByRef klass As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 6) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  Return js_construct_new(klass, @args(0), 7)
End Function
Function js_new8(ByRef klass As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV, ByRef a7 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 7) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  args(7) = a7
  Return js_construct_new(klass, @args(0), 8)
End Function
Function js_newa(ByRef klass As JsV, ByRef arr As JsV) As JsV
  Dim u As JsV
  Dim a As JsArrH Ptr = Cast(JsArrH Ptr, arr.p)
  Return js_construct_new(klass, a->items, a->length)
End Function
Function js_superctor0(ByRef pclass As JsV, ByRef self As JsV) As JsV
  Dim u As JsV
  Return js_superctor_do(pclass, self, 0, 0)
End Function
Function js_superctor1(ByRef pclass As JsV, ByRef self As JsV, ByRef a0 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 0) As JsV
  args(0) = a0
  Return js_superctor_do(pclass, self, @args(0), 1)
End Function
Function js_superctor2(ByRef pclass As JsV, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 1) As JsV
  args(0) = a0
  args(1) = a1
  Return js_superctor_do(pclass, self, @args(0), 2)
End Function
Function js_superctor3(ByRef pclass As JsV, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 2) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  Return js_superctor_do(pclass, self, @args(0), 3)
End Function
Function js_superctor4(ByRef pclass As JsV, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 3) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  Return js_superctor_do(pclass, self, @args(0), 4)
End Function
Function js_superctor5(ByRef pclass As JsV, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 4) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  Return js_superctor_do(pclass, self, @args(0), 5)
End Function
Function js_superctor6(ByRef pclass As JsV, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 5) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  Return js_superctor_do(pclass, self, @args(0), 6)
End Function
Function js_superctor7(ByRef pclass As JsV, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 6) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  Return js_superctor_do(pclass, self, @args(0), 7)
End Function
Function js_superctor8(ByRef pclass As JsV, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV, ByRef a7 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 7) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  args(7) = a7
  Return js_superctor_do(pclass, self, @args(0), 8)
End Function
Function js_superctora(ByRef pclass As JsV, ByRef self As JsV, ByRef arr As JsV) As JsV
  Dim u As JsV
  Dim a As JsArrH Ptr = Cast(JsArrH Ptr, arr.p)
  Return js_superctor_do(pclass, self, a->items, a->length)
End Function
Function js_supercall0(ByRef pclass As JsV, ByVal sym As Long, ByRef self As JsV) As JsV
  Dim u As JsV
  Return js_callsuper(pclass, sym, self, 0, 0)
End Function
Function js_supercall1(ByRef pclass As JsV, ByVal sym As Long, ByRef self As JsV, ByRef a0 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 0) As JsV
  args(0) = a0
  Return js_callsuper(pclass, sym, self, @args(0), 1)
End Function
Function js_supercall2(ByRef pclass As JsV, ByVal sym As Long, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 1) As JsV
  args(0) = a0
  args(1) = a1
  Return js_callsuper(pclass, sym, self, @args(0), 2)
End Function
Function js_supercall3(ByRef pclass As JsV, ByVal sym As Long, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 2) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  Return js_callsuper(pclass, sym, self, @args(0), 3)
End Function
Function js_supercall4(ByRef pclass As JsV, ByVal sym As Long, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 3) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  Return js_callsuper(pclass, sym, self, @args(0), 4)
End Function
Function js_supercall5(ByRef pclass As JsV, ByVal sym As Long, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 4) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  Return js_callsuper(pclass, sym, self, @args(0), 5)
End Function
Function js_supercall6(ByRef pclass As JsV, ByVal sym As Long, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 5) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  Return js_callsuper(pclass, sym, self, @args(0), 6)
End Function
Function js_supercall7(ByRef pclass As JsV, ByVal sym As Long, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 6) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  Return js_callsuper(pclass, sym, self, @args(0), 7)
End Function
Function js_supercall8(ByRef pclass As JsV, ByVal sym As Long, ByRef self As JsV, ByRef a0 As JsV, ByRef a1 As JsV, ByRef a2 As JsV, ByRef a3 As JsV, ByRef a4 As JsV, ByRef a5 As JsV, ByRef a6 As JsV, ByRef a7 As JsV) As JsV
  Dim u As JsV
  Dim args(0 To 7) As JsV
  args(0) = a0
  args(1) = a1
  args(2) = a2
  args(3) = a3
  args(4) = a4
  args(5) = a5
  args(6) = a6
  args(7) = a7
  Return js_callsuper(pclass, sym, self, @args(0), 8)
End Function
Function js_supercalla(ByRef pclass As JsV, ByVal sym As Long, ByRef self As JsV, ByRef arr As JsV) As JsV
  Dim u As JsV
  Dim a As JsArrH Ptr = Cast(JsArrH Ptr, arr.p)
  Return js_callsuper(pclass, sym, self, a->items, a->length)
End Function
' ---------------------------------------------------------------------------
' OpCodes: the helpers the IL leaves as calls (OpCodes.js semantics)
' ---------------------------------------------------------------------------
#define OC_ARGS ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr

Function oc_CreateArray(OC_ARGS) As JsV
  Dim v As JsV = js_arg(argv, argc, 1)
  If v.tag = JS_T_UNDEF Then v = js_num(0)
  Return js_arr_fillnew(CLng(js_argnum(argv, argc, 0)), v)
End Function

Function oc_GetByte(OC_ARGS) As JsV
  Return js_num((js_tou32(js_argnum(argv, argc, 0)) Shr ((CLng(js_argnum(argv, argc, 1)) * 8) And 31)) And 255)
End Function

Function oc_GF256Mul(OC_ARGS) As JsV
  Dim a As Long = js_toi32(js_argnum(argv, argc, 0)) And 255
  Dim b As Long = js_toi32(js_argnum(argv, argc, 1)) And 255
  Dim r As Long = 0
  For i As Long = 0 To 7
    If b And 1 Then r Xor= a
    Dim hi As Long = a And &H80
    a = (a Shl 1) And 255
    If hi Then a Xor= &H1B
    b Shr= 1
  Next
  Return js_num(r And 255)
End Function

Function oc_GFMul(OC_ARGS) As JsV
  Dim a As LongInt = js_toi32(js_argnum(argv, argc, 0))
  Dim b As LongInt = js_tou32(js_argnum(argv, argc, 1))
  Dim irr As LongInt = js_toi32(js_argnum(argv, argc, 2))
  Dim w As Long = CLng(js_argnum(argv, argc, 3))
  Dim mask As LongInt = (CLngInt(1) Shl w) - 1
  Dim r As LongInt = 0
  Do While b
    If b And 1 Then r Xor= a
    a Shl= 1
    If a And (CLngInt(1) Shl w) Then a Xor= irr
    a And= mask
    b Shr= 1
  Loop
  Return js_num(CDbl(r))
End Function

Function oc_mask64() As JsV
  Static m As JsV
  If m.tag = JS_T_UNDEF Then m = js_tobig(js_str("18446744073709551615"))
  Return m
End Function

Function oc_RotL64n(OC_ARGS) As JsV
  Dim v As JsV = js_big_bitop(js_tobig(js_arg(argv, argc, 0)), oc_mask64(), 0)
  Dim n As Long = js_toi32(js_tonum(js_arg(argv, argc, 1))) And 63
  If n = 0 Then Return v
  Return js_big_bitop(js_big_bitop(js_big_shl(v, n), js_big_shl(v, n - 64), 1), oc_mask64(), 0)
End Function

Function oc_RotR64n(OC_ARGS) As JsV
  Dim v As JsV = js_big_bitop(js_tobig(js_arg(argv, argc, 0)), oc_mask64(), 0)
  Dim n As Long = js_toi32(js_tonum(js_arg(argv, argc, 1))) And 63
  If n = 0 Then Return v
  Return js_big_bitop(js_big_bitop(js_big_shl(v, -n), js_big_shl(v, 64 - n), 1), oc_mask64(), 0)
End Function

Function oc_RotL128n(OC_ARGS) As JsV
  Dim m As JsV = js_big_addsub(js_big_shl(js_big_fromu64(1, 0), 128), js_big_fromu64(1, 0), 1)
  Dim v As JsV = js_big_bitop(js_tobig(js_arg(argv, argc, 0)), m, 0)
  Dim n As Long = js_toi32(js_tonum(js_arg(argv, argc, 1))) And 127
  If n = 0 Then Return v
  Return js_big_bitop(js_big_bitop(js_big_shl(v, n), js_big_shl(v, n - 128), 1), m, 0)
End Function

Function oc_Hex8ToBytes(OC_ARGS) As JsV
  Dim s As JsV = js_arg(argv, argc, 0)
  If s.tag <> JS_T_STR Then js_throw_error("Hex8ToBytes: Input must be a string")
  Return js_hex_bytes(JSS(s))
End Function

Function oc_Hex32ToDWords(OC_ARGS) As JsV
  Dim s As String = js_tostring(js_arg(argv, argc, 0))
  Dim a As JsV = js_arr_new(0)
  For i As Long = 0 To Len(s) - 1 Step 8
    js_pushn(a, CDbl(ValUInt("&H" & Mid(s, i + 1, 8))))
  Next
  Return a
End Function

Function oc_CopyArray(OC_ARGS) As JsV
  Return js_slice_arr(js_arg(argv, argc, 0), js_undefined(), js_undefined())
End Function

Function oc_ArraySlice(OC_ARGS) As JsV
  Return js_slice_arr(js_arg(argv, argc, 0), js_arg(argv, argc, 1), js_arg(argv, argc, 2))
End Function

Function oc_GetBit(OC_ARGS) As JsV
  Return js_bool((js_tou32(js_argnum(argv, argc, 0)) Shr (js_toi32(js_argnum(argv, argc, 1)) And 31)) And 1)
End Function

Function oc_SetBit(OC_ARGS) As JsV
  Dim v As ULong = js_tou32(js_argnum(argv, argc, 0))
  Dim b As ULong = CULng(1) Shl (js_toi32(js_argnum(argv, argc, 1)) And 31)
  If js_truthy(js_arg(argv, argc, 2)) Then Return js_num(v Or b)
  Return js_num(v And Not b)
End Function

Function oc_ConcatArrays(OC_ARGS) As JsV
  Dim arrs As JsV = js_arg(argv, argc, 0)
  Dim r As JsV = js_arr_new(0)
  For i As Long = 0 To js_length(arrs) - 1
    js_spread_into(r, js_index_get(arrs, i))
  Next
  Return r
End Function

Function oc_SecureCompare(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0)
  Dim b As JsV = js_arg(argv, argc, 1)
  If js_length(a) <> js_length(b) Then Return js_bool(0)
  Dim r As Long = 0
  For i As Long = 0 To js_length(a) - 1
    r Or= js_toi32(js_idxn(a, i)) Xor js_toi32(js_idxn(b, i))
  Next
  Return js_bool(r = 0)
End Function

Function oc_ArraysEqual(OC_ARGS) As JsV
  Return oc_SecureCompare(self, argv, argc, envp)
End Function

Function oc_ConstantTimeCompare(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0)
  Dim b As JsV = js_arg(argv, argc, 1)
  Dim la As Long = js_length(a), lb As Long = js_length(b)
  Dim n As Long = CLng(js_argnum(argv, argc, 2))
  If argc < 3 OrElse n = 0 Then n = IIf(la < lb, la, lb)
  Dim r As Long = 0
  For i As Long = 0 To n - 1
    Dim x As Long = IIf(i < la, js_toi32(js_idxn(a, i)), 0)
    Dim y As Long = IIf(i < lb, js_toi32(js_idxn(b, i)), 0)
    r Or= x Xor y
  Next
  r Or= la Xor lb
  Return js_bool(r = 0)
End Function

Function oc_BytesToChars(OC_ARGS) As JsV
  Return js_from_char_codes(js_arg(argv, argc, 0))
End Function

Function oc_ToLong(OC_ARGS) As JsV
  Return js_big_asintn(64, js_tobig(js_arg(argv, argc, 0)))
End Function

Function oc_ToShort(OC_ARGS) As JsV
  Return js_num(js_wrap_signed(js_argnum(argv, argc, 0), 16))
End Function

Function oc_Shr32Signed(OC_ARGS) As JsV
  Return js_num(js_toi32(js_argnum(argv, argc, 0)) Shr (js_toi32(js_argnum(argv, argc, 1)) And 31))
End Function

Function oc_BitMask(OC_ARGS) As JsV
  Dim bits As Double = js_argnum(argv, argc, 0)
  If bits >= 32 Then Return js_num(4294967295.0)
  If bits <= 0 Then Return js_num(0)
  Return js_num(CDbl(js_toi32(2 ^ bits)) - 1)
End Function

Function oc_SecureRandomBytes(OC_ARGS) As JsV
  Dim n As Long = CLng(js_argnum(argv, argc, 0))
  Dim a As JsV = js_arr_new(n)
  For i As Long = 0 To n - 1
    js_setidxn(a, i, js_dfloor(Rnd * 256))
  Next
  Return a
End Function

Function oc_MulHi32(OC_ARGS) As JsV
  Return js_num(CDbl((CULngInt(js_tou32(js_argnum(argv, argc, 0))) * CULngInt(js_tou32(js_argnum(argv, argc, 1)))) Shr 32))
End Function

Function oc_BitCountN(OC_ARGS) As JsV
  Dim v As JsV = js_tobig(js_arg(argv, argc, 0))
  Dim h As JsBigH Ptr = js_bigh(v)
  If h->count = 0 Then Return js_num(1)
  Dim top As ULong = h->limbs[h->count - 1]
  Dim bits As Long = 0
  Do While top
    bits += 1
    top Shr= 1
  Loop
  Return js_num((h->count - 1) * 32 + bits)
End Function

Function oc_RotL64_HL(OC_ARGS) As JsV
  Dim hi As ULong = js_tou32(js_argnum(argv, argc, 0))
  Dim lo As ULong = js_tou32(js_argnum(argv, argc, 1))
  Dim n As Long = js_toi32(js_argnum(argv, argc, 2)) And 63
  Dim v As ULongInt = (CULngInt(hi) Shl 32) Or lo
  If n Then v = (v Shl n) Or (v Shr (64 - n))
  Dim o As JsV = js_obj_new()
  js_setp(o, js_sym("h"), js_num(CDbl(v Shr 32)))
  js_setp(o, js_sym("l"), js_num(CDbl(v And &HFFFFFFFFull)))
  Return o
End Function

Function oc_GcdN(OC_ARGS) As JsV
  Dim a As JsV = js_tobig(js_arg(argv, argc, 0))
  Dim b As JsV = js_tobig(js_arg(argv, argc, 1))
  If js_bigh(a)->neg Then a = js_neg(a)
  If js_bigh(b)->neg Then b = js_neg(b)
  Do While js_bigh(b)->count > 0
    Dim t As JsV = b
    b = js_big_mod(a, b)
    a = t
  Loop
  Return a
End Function

Function oc_PopCount(OC_ARGS) As JsV
  Dim v As ULong = js_tou32(js_argnum(argv, argc, 0))
  Dim c As Long = 0
  Do While v
    c += v And 1
    v Shr= 1
  Loop
  Return js_num(c)
End Function

Function oc_PopCountFast(OC_ARGS) As JsV
  Return oc_PopCount(self, argv, argc, envp)
End Function

Function oc_AddMod(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0), b As JsV = js_arg(argv, argc, 1), m As JsV = js_arg(argv, argc, 2)
  Return js_mod(js_add(js_mod(a, m), js_mod(b, m)), m)
End Function

Function oc_SubMod(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0), b As JsV = js_arg(argv, argc, 1), m As JsV = js_arg(argv, argc, 2)
  Return js_mod(js_add(js_sub(js_mod(a, m), js_mod(b, m)), m), m)
End Function

Function oc_MulModN(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0), b As JsV = js_arg(argv, argc, 1), m As JsV = js_arg(argv, argc, 2)
  Return js_mod(js_mul(js_mod(a, m), js_mod(b, m)), m)
End Function

Function oc_SquareModN(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0), m As JsV = js_arg(argv, argc, 1)
  Dim r As JsV = js_mod(a, m)
  Return js_mod(js_mul(r, r), m)
End Function

Function oc_ModN(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0), m As JsV = js_arg(argv, argc, 1)
  Dim r As JsV = js_mod(a, m)
  If js_bigh(r)->neg Then r = js_add(r, m)
  Return r
End Function

Function oc_GetBitN(OC_ARGS) As JsV
  Dim v As JsV = js_tobig(js_arg(argv, argc, 0))
  Return js_big_bitop(js_big_shl(v, -CLng(js_argnum(argv, argc, 1))), js_big_fromu64(1, 0), 0)
End Function

Function oc_ModPowN(OC_ARGS) As JsV
  Dim b As JsV = js_tobig(js_arg(argv, argc, 0))
  Dim e As JsV = js_tobig(js_arg(argv, argc, 1))
  Dim m As JsV = js_tobig(js_arg(argv, argc, 2))
  Dim one As JsV = js_big_fromu64(1, 0)
  If js_big_cmp(m, one) = 0 Then Return js_big_fromu64(0, 0)
  Dim r As JsV = one
  b = js_big_mod(b, m)
  Dim eh As JsBigH Ptr = js_bigh(e)
  Dim bits As Long = eh->count * 32
  For i As Long = 0 To bits - 1
    If (eh->limbs[i \ 32] Shr (i Mod 32)) And 1 Then r = js_big_mod(js_big_mul(r, b), m)
    b = js_big_mod(js_big_mul(b, b), m)
  Next
  Return r
End Function

Function oc_ModInverseN(OC_ARGS) As JsV
  Dim m As JsV = js_tobig(js_arg(argv, argc, 1))
  Dim oldR As JsV = oc_ModN(self, argv, argc, envp)
  Dim r As JsV = m
  Dim oldS As JsV = js_big_fromu64(1, 0)
  Dim s As JsV = js_big_fromu64(0, 0)
  Do While js_bigh(r)->count > 0
    Dim q As JsV = js_big_div(oldR, r)
    Dim nr As JsV = js_sub(oldR, js_mul(q, r))
    oldR = r
    r = nr
    Dim ns As JsV = js_sub(oldS, js_mul(q, s))
    oldS = s
    s = ns
  Loop
  If js_big_cmp(oldR, js_big_fromu64(1, 0)) <> 0 Then js_throw_error("ModInverseN: value has no inverse modulo m", "RangeError")
  Dim args(0 To 1) As JsV
  args(0) = oldS
  args(1) = m
  Return oc_ModN(self, @args(0), 2, envp)
End Function

Function oc_Words32ToBytesBE(OC_ARGS) As JsV
  Dim w As JsV = js_arg(argv, argc, 0)
  Dim r As JsV = js_arr_new(0)
  For i As Long = 0 To js_length(w) - 1
    Dim x As ULong = js_tou32(js_idxn(w, i))
    js_pushn(r, (x Shr 24) And 255)
    js_pushn(r, (x Shr 16) And 255)
    js_pushn(r, (x Shr 8) And 255)
    js_pushn(r, x And 255)
  Next
  Return r
End Function

Function oc_BytesToWords32BE(OC_ARGS) As JsV
  Dim b As JsV = js_arg(argv, argc, 0)
  Dim n As Long = js_length(b)
  Dim r As JsV = js_arr_new(0)
  For i As Long = 0 To n - 1 Step 4
    Dim x As ULong = 0
    For k As Long = 0 To 3
      x = (x Shl 8) Or IIf(i + k < n, js_tou32(js_idxn(b, i + k)) And 255, 0)
    Next
    js_pushn(r, x)
  Next
  Return r
End Function

Function oc_Split64(OC_ARGS) As JsV
  Dim v As Double = js_argnum(argv, argc, 0)
  Dim o As JsV = js_obj_new()
  js_setp(o, js_sym("high32"), js_num(js_dfloor(v / 4294967296.0)))
  js_setp(o, js_sym("low32"), js_num(js_toi32(v)))
  Return o
End Function

Function oc_EncodeMsgLength64LE(OC_ARGS) As JsV
  Dim v As Double = js_argnum(argv, argc, 0)
  Dim lo As JsV = js_unpack(js_toi32(v), 32, 0)
  Dim hi As JsV = js_unpack(js_dfloor(v / 4294967296.0), 32, 0)
  Return js_spread_into(lo, hi)
End Function

Function oc_Add3L64(OC_ARGS) As JsV
  Return js_num(CDbl(js_tou32(js_argnum(argv, argc, 0))) + js_tou32(js_argnum(argv, argc, 1)) + js_tou32(js_argnum(argv, argc, 2)))
End Function

Function oc_Add3H64(OC_ARGS) As JsV
  Dim s As Double = js_argnum(argv, argc, 1) + js_argnum(argv, argc, 2) + js_argnum(argv, argc, 3) + js_toi32(js_argnum(argv, argc, 0) / 4294967296.0)
  Return js_num(js_toi32(s))
End Function

Function oc_GHashMul(OC_ARGS) As JsV
  Dim x As JsV = js_arg(argv, argc, 0)
  Dim y As JsV = js_arg(argv, argc, 1)
  If js_length(x) <> 16 OrElse js_length(y) <> 16 Then js_throw_error("GHashMul requires 16-byte arrays")
  Dim z(0 To 15) As Long, v(0 To 15) As Long
  For i As Long = 0 To 15
    v(i) = js_toi32(js_idxn(y, i))
  Next
  For i As Long = 0 To 15
    Dim xi As Long = js_toi32(js_idxn(x, i))
    For j As Long = 7 To 0 Step -1
      If xi And (1 Shl j) Then
        For k As Long = 0 To 15
          z(k) = (z(k) Xor v(k)) And 255
        Next
      End If
      Dim lsb As Long = v(15) And 1
      For k As Long = 15 To 1 Step -1
        v(k) = ((v(k) Shr 1) Or ((v(k - 1) And 1) Shl 7)) And 255
      Next
      v(0) = (v(0) Shr 1) And 255
      If lsb Then v(0) = (v(0) Xor &HE1) And 255
    Next
  Next
  Dim r As JsV = js_arr_new(16)
  For i As Long = 0 To 15
    js_setidxn(r, i, z(i))
  Next
  Return r
End Function

Function oc_GCMIncrement(OC_ARGS) As JsV
  Dim c As JsV = js_arg(argv, argc, 0)
  If js_length(c) <> 16 Then js_throw_error("GCMIncrement requires 16-byte counter")
  Dim carry As Long = 1
  For i As Long = 15 To 12 Step -1
    Dim s As Long = js_toi32(js_idxn(c, i)) + carry
    js_setidxn(c, i, s And 255)
    carry = s Shr 8
  Next
  Return c
End Function

Function oc_CreateUint64ArrayFromHex(OC_ARGS) As JsV
  Dim vals As JsV = js_arg(argv, argc, 0)
  Dim r As JsV = js_arr_new(0)
  For i As Long = 0 To js_length(vals) - 1
    Dim h As String = js_tostring(js_index_get(vals, i))
    If LCase(Left(h, 2)) = "0x" Then h = Mid(h, 3)
    h = Right(String(16, "0") & h, 16)
    Dim pr As JsV = js_arr_new(2)
    js_setidxn(pr, 0, CDbl(ValUInt("&H" & Left(h, 8))))
    js_setidxn(pr, 1, CDbl(ValUInt("&H" & Right(h, 8))))
    js_push1(r, pr)
  Next
  Return r
End Function

Function oc_XorArrayWithByte(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0)
  Dim v As Long = js_toi32(js_argnum(argv, argc, 1)) And 255
  Dim n As Long = js_length(a)
  Dim r As JsV = js_arr_new(n)
  For i As Long = 0 To n - 1
    js_setidxn(r, i, (js_toi32(js_idxn(a, i)) Xor v) And 255)
  Next
  Return r
End Function

Function oc_XorArrays(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0)
  Dim b As JsV = js_arg(argv, argc, 1)
  Dim n As Long = js_length(a)
  If js_length(b) < n Then n = js_length(b)
  Dim r As JsV = js_arr_new(n)
  For i As Long = 0 To n - 1
    js_setidxn(r, i, (js_toi32(js_idxn(a, i)) Xor js_toi32(js_idxn(b, i))) And 255)
  Next
  Return r
End Function

Function oc_ClearArray(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0)
  For i As Long = 0 To js_length(a) - 1
    js_setidxn(a, i, 0)
  Next
  Dim u As JsV
  Return u
End Function

Function oc_AnsiToBytes(OC_ARGS) As JsV
  Dim s As String = js_tostring(js_arg(argv, argc, 0))
  Dim r As JsV = js_arr_new(Len(s))
  For i As Long = 0 To Len(s) - 1
    js_setidxn(r, i, s[i] And 127)
  Next
  Return r
End Function

Function oc_AsciiToBytes(OC_ARGS) As JsV
  Dim s As String = js_tostring(js_arg(argv, argc, 0))
  Dim r As JsV = js_arr_new(Len(s))
  For i As Long = 0 To Len(s) - 1
    js_setidxn(r, i, s[i] And 255)
  Next
  Return r
End Function

Function oc_BytesToAnsi(OC_ARGS) As JsV
  Dim b As JsV = js_arg(argv, argc, 0)
  Dim s As String
  For i As Long = 0 To js_length(b) - 1
    s &= Chr(js_toi32(js_idxn(b, i)) And 127)
  Next
  Return js_str(s)
End Function

Function oc_pack(ByVal argv As JsV Ptr, ByVal argc As Long, ByVal n As Long, ByVal big As Long) As JsV
  Dim v As ULongInt = 0
  For i As Long = 0 To n - 1
    Dim b As ULongInt = js_tou32(js_argnum(argv, argc, i)) And 255
    Dim sh As Long = IIf(big, (n - 1 - i) * 8, i * 8)
    v Or= b Shl sh
  Next
  Return js_num(CDbl(v))
End Function

Function oc_Pack16BE(OC_ARGS) As JsV
  Return oc_pack(argv, argc, 2, -1)
End Function

Function oc_Pack16LE(OC_ARGS) As JsV
  Return oc_pack(argv, argc, 2, 0)
End Function

Function oc_Pack32BE(OC_ARGS) As JsV
  Return oc_pack(argv, argc, 4, -1)
End Function

Function oc_Pack32LE(OC_ARGS) As JsV
  Return oc_pack(argv, argc, 4, 0)
End Function

Function oc_Unpack32BE(OC_ARGS) As JsV
  Return js_unpack(js_argnum(argv, argc, 0), 32, -1)
End Function

Function oc_Unpack32LE(OC_ARGS) As JsV
  Return js_unpack(js_argnum(argv, argc, 0), 32, 0)
End Function


' OpCodes.CreateBitStream: OpCodes._BitStream, its state in the properties
' buffer, bufferBits, byteArray, readPosition and totalBitsWritten, with
' JavaScript's int32 arithmetic on the buffer
Dim Shared CLS_BitStream As JsV
Dim Shared SYM_bs_buffer As Long, SYM_bs_bufferBits As Long, SYM_bs_byteArray As Long
Dim Shared SYM_bs_readPosition As Long, SYM_bs_totalBitsWritten As Long

Function bs_n(ByRef o As JsV, ByVal sym As Long) As Double
  Return js_tonum(js_getp(o, sym))
End Function

Sub bs_set(ByRef o As JsV, ByVal sym As Long, ByVal d As Double)
  js_setp(o, sym, js_num(d))
End Sub

' JavaScript a << n, a >>> n on int32
Function bs_shl(ByVal a As Double, ByVal n As Long) As Double
  Return CDbl(CLng(js_tou32(a) Shl (n And 31)))
End Function

Function bs_shr(ByVal a As Double, ByVal n As Long) As Double
  Return CDbl(js_tou32(a) Shr (n And 31))
End Function

Function bs_ctor(OC_ARGS) As JsV
  Dim init As JsV = js_arg(argv, argc, 0)
  bs_set(self, SYM_bs_buffer, 0)
  bs_set(self, SYM_bs_bufferBits, 0)
  js_setp(self, SYM_bs_byteArray, js_arr_new(0))
  bs_set(self, SYM_bs_readPosition, 0)
  bs_set(self, SYM_bs_totalBitsWritten, 0)
  If js_truthy(init) AndAlso js_length(init) > 0 Then
    js_setp(self, SYM_bs_byteArray, js_callm(init, SYM_slice, 0, 0))
    bs_set(self, SYM_bs_totalBitsWritten, js_length(init) * 8)
  End If
  Return self
End Function

Sub bs_write(ByRef self As JsV, ByVal value As Double, ByVal nb As Long)
  If nb <= 0 OrElse nb > 32 Then js_throw_error("BitStream.writeBits: numBits must be 1-32")
  Dim mask As Long = IIf(nb = 32, -1, js_toi32(CDbl(CLng(1 Shl (nb And 31))) - 1))
  Dim v As Long = CLng(js_tou32(value)) And mask
  Dim buf As Double = CDbl(CLng(js_tou32(bs_shl(bs_n(self, SYM_bs_buffer), nb)) Or v))
  Dim bits As Long = CLng(bs_n(self, SYM_bs_bufferBits)) + nb
  bs_set(self, SYM_bs_totalBitsWritten, bs_n(self, SYM_bs_totalBitsWritten) + nb)
  Dim arr As JsV = js_getp(self, SYM_bs_byteArray)
  Do While bits >= 8
    bits -= 8
    Dim b As JsV = js_num(CLng(bs_shr(buf, bits)) And 255)
    js_callm(arr, SYM_push, @b, 1)
    If bits > 0 Then
      buf = CDbl(js_toi32(buf) And js_toi32(CDbl(CLng(1 Shl (bits And 31))) - 1))
    Else
      buf = 0
    End If
  Loop
  bs_set(self, SYM_bs_buffer, buf)
  bs_set(self, SYM_bs_bufferBits, bits)
End Sub

Function bs_read(ByRef self As JsV, ByVal nb As Long) As Double
  If nb <= 0 OrElse nb > 32 Then js_throw_error("BitStream.readBits: numBits must be 1-32")
  Dim arr As JsV = js_getp(self, SYM_bs_byteArray)
  Dim n As Long = js_length(arr)
  Dim pos_ As Double = bs_n(self, SYM_bs_readPosition)
  Dim result As Double = 0
  Dim got As Long = 0
  Do While got < nb
    Dim bi As Long = js_dfloor(pos_ / 8)
    Dim bo As Long = pos_ - bi * 8
    If bi >= n Then
      If got = 0 Then
        bs_set(self, SYM_bs_readPosition, pos_)
        js_throw_error("BitStream.readBits: No more data available")
      End If
      Exit Do
    End If
    Dim cur As Double = js_tonum(js_index_get(arr, bi))
    Dim avail As Long = 8 - bo
    Dim take As Long = IIf(nb - got < avail, nb - got, avail)
    Dim mask As Long = js_toi32(CDbl(CLng(1 Shl take)) - 1)
    Dim ex As Long = CLng(bs_shr(cur, avail - take)) And mask
    result = CDbl(js_toi32(bs_shl(result, take)) Or ex)
    got += take
    pos_ += take
  Loop
  bs_set(self, SYM_bs_readPosition, pos_)
  Return result
End Function

Function bs_writeBits(OC_ARGS) As JsV
  bs_write(self, js_argnum(argv, argc, 0), CLng(js_argnum(argv, argc, 1)))
  Return js_undefined()
End Function

Function bs_writeBit(OC_ARGS) As JsV
  bs_write(self, js_toi32(js_argnum(argv, argc, 0)) And 1, 1)
  Return js_undefined()
End Function

Function bs_writeByte(OC_ARGS) As JsV
  bs_write(self, js_toi32(js_argnum(argv, argc, 0)) And 255, 8)
  Return js_undefined()
End Function

Function bs_writeBytes(OC_ARGS) As JsV
  Dim bytes As JsV = js_arg(argv, argc, 0)
  Dim n As Long = js_length(bytes)
  For i As Long = 0 To n - 1
    bs_write(self, js_toi32(js_tonum(js_index_get(bytes, i))) And 255, 8)
  Next
  Return js_undefined()
End Function

Sub bs_write_bytes_of(ByRef self As JsV, ByVal v As Double, ByVal count As Long, ByVal big As Long)
  Dim x As ULong = js_tou32(v)
  For i As Long = 0 To count - 1
    Dim sh As Long = IIf(big, 8 * (count - 1 - i), 8 * i)
    bs_write(self, (x Shr sh) And 255, 8)
  Next
End Sub

Function bs_writeUint16BE(OC_ARGS) As JsV
  bs_write_bytes_of(self, js_argnum(argv, argc, 0), 2, -1)
  Return js_undefined()
End Function

Function bs_writeUint16LE(OC_ARGS) As JsV
  bs_write_bytes_of(self, js_argnum(argv, argc, 0), 2, 0)
  Return js_undefined()
End Function

Function bs_writeUint32BE(OC_ARGS) As JsV
  bs_write_bytes_of(self, js_argnum(argv, argc, 0), 4, -1)
  Return js_undefined()
End Function

Function bs_writeUint32LE(OC_ARGS) As JsV
  bs_write_bytes_of(self, js_argnum(argv, argc, 0), 4, 0)
  Return js_undefined()
End Function

Function bs_readBits(OC_ARGS) As JsV
  Return js_num(bs_read(self, CLng(js_argnum(argv, argc, 0))))
End Function

Function bs_readBit(OC_ARGS) As JsV
  Return js_num(bs_read(self, 1))
End Function

Function bs_readByte(OC_ARGS) As JsV
  Return js_num(js_toi32(bs_read(self, 8)) And 255)
End Function

Function bs_readBytes(OC_ARGS) As JsV
  Dim r As JsV = js_arr_new(0)
  Dim n As Long = CLng(js_argnum(argv, argc, 0))
  For i As Long = 0 To n - 1
    Dim b As JsV = js_num(js_toi32(bs_read(self, 8)) And 255)
    js_callm(r, SYM_push, @b, 1)
  Next
  Return r
End Function

Function bs_peekBits(OC_ARGS) As JsV
  Dim saved As Double = bs_n(self, SYM_bs_readPosition)
  Dim r As Double = bs_read(self, CLng(js_argnum(argv, argc, 0)))
  bs_set(self, SYM_bs_readPosition, saved)
  Return js_num(r)
End Function

Function bs_skipBits(OC_ARGS) As JsV
  Dim p As Double = bs_n(self, SYM_bs_readPosition) + js_argnum(argv, argc, 0)
  Dim mx As Double = js_length(js_getp(self, SYM_bs_byteArray)) * 8
  If p > mx Then p = mx
  bs_set(self, SYM_bs_readPosition, p)
  Return js_undefined()
End Function

Function bs_hasMoreBits(OC_ARGS) As JsV
  Return js_bool(bs_n(self, SYM_bs_readPosition) < js_length(js_getp(self, SYM_bs_byteArray)) * 8)
End Function

Function bs_getRemainingBits(OC_ARGS) As JsV
  Dim r As Double = js_length(js_getp(self, SYM_bs_byteArray)) * 8 - bs_n(self, SYM_bs_readPosition)
  Return js_num(IIf(r > 0, r, 0))
End Function

Function bs_resetReadPosition(OC_ARGS) As JsV
  bs_set(self, SYM_bs_readPosition, 0)
  Return js_undefined()
End Function

Function bs_seekBits(OC_ARGS) As JsV
  Dim mx As Double = js_length(js_getp(self, SYM_bs_byteArray)) * 8
  Dim off As Double = js_toi32(js_argnum(argv, argc, 0)) And &h7FFFFFFF
  If off > mx Then off = mx
  bs_set(self, SYM_bs_readPosition, IIf(off > 0, off, 0))
  Return js_undefined()
End Function

Function bs_toArray(OC_ARGS) As JsV
  Dim padv As JsV = js_arg(argv, argc, 0)
  Dim pad As Long = Not (padv.tag = JS_T_BOOL AndAlso padv.n = 0)
  Dim bits As Long = CLng(bs_n(self, SYM_bs_bufferBits))
  Dim arr As JsV = js_getp(self, SYM_bs_byteArray)
  If bits > 0 AndAlso pad Then
    Dim buf As Double = bs_shl(bs_n(self, SYM_bs_buffer), 8 - bits)
    Dim b As JsV = js_num(js_toi32(buf) And 255)
    js_callm(arr, SYM_push, @b, 1)
    bs_set(self, SYM_bs_buffer, 0)
    bs_set(self, SYM_bs_bufferBits, 0)
  End If
  Return js_callm(arr, SYM_slice, 0, 0)
End Function

Function bs_getBitLength(OC_ARGS) As JsV
  Return js_num(bs_n(self, SYM_bs_totalBitsWritten))
End Function

Function bs_getByteLength(OC_ARGS) As JsV
  Dim bits As Long = CLng(bs_n(self, SYM_bs_bufferBits))
  Return js_num(js_length(js_getp(self, SYM_bs_byteArray)) + (bits \ 8) + IIf((bits Mod 8) > 0, 1, 0))
End Function

Function bs_clear(OC_ARGS) As JsV
  bs_set(self, SYM_bs_buffer, 0)
  bs_set(self, SYM_bs_bufferBits, 0)
  js_setp(self, SYM_bs_byteArray, js_arr_new(0))
  bs_set(self, SYM_bs_readPosition, 0)
  bs_set(self, SYM_bs_totalBitsWritten, 0)
  Return js_undefined()
End Function

Function bs_clone(OC_ARGS) As JsV
  Dim c As JsV = js_new1(CLS_BitStream, js_undefined())
  js_setp(c, SYM_bs_buffer, js_getp(self, SYM_bs_buffer))
  js_setp(c, SYM_bs_bufferBits, js_getp(self, SYM_bs_bufferBits))
  js_setp(c, SYM_bs_byteArray, js_callm(js_getp(self, SYM_bs_byteArray), SYM_slice, 0, 0))
  js_setp(c, SYM_bs_readPosition, js_getp(self, SYM_bs_readPosition))
  js_setp(c, SYM_bs_totalBitsWritten, js_getp(self, SYM_bs_totalBitsWritten))
  Return c
End Function

Function bs_writeVarInt(OC_ARGS) As JsV
  Dim v As ULong = js_tou32(js_argnum(argv, argc, 0))
  Do While v >= &h80
    bs_write(self, (v And &h7F) Or &h80, 8)
    v Shr= 7
  Loop
  bs_write(self, v And &h7F, 8)
  Return js_undefined()
End Function

Function bs_readVarInt(OC_ARGS) As JsV
  Dim result As Long = 0
  Dim sh As Long = 0
  Dim b As Long
  Do
    If sh >= 32 Then js_throw_error("BitStream.readVarInt: Integer overflow")
    b = js_toi32(bs_read(self, 8)) And 255
    result = result Or CLng(CULng(b And &h7F) Shl (sh And 31))
    sh += 7
  Loop While b And &h80
  Return js_num(CDbl(CULng(result)))
End Function

Function bs_writeUnary(OC_ARGS) As JsV
  Dim n As Double = js_argnum(argv, argc, 0)
  Dim i As Double = 0
  Do While i < n
    bs_write(self, 1, 1)
    i += 1
  Loop
  bs_write(self, 0, 1)
  Return js_undefined()
End Function

Function bs_readUnary(OC_ARGS) As JsV
  Dim count As Long = 0
  Do While bs_n(self, SYM_bs_readPosition) < js_length(js_getp(self, SYM_bs_byteArray)) * 8
    If bs_read(self, 1) <> 1 Then Exit Do
    count += 1
  Loop
  Return js_num(count)
End Function

Function bs_alignToByte(OC_ARGS) As JsV
  Do While (CLng(bs_n(self, SYM_bs_bufferBits)) Mod 8) <> 0
    bs_write(self, 0, 1)
  Loop
  Return js_undefined()
End Function

Function bs_isAligned(OC_ARGS) As JsV
  Return js_bool((CLng(bs_n(self, SYM_bs_bufferBits)) Mod 8) = 0)
End Function

Sub bs_init()
  SYM_bs_buffer = js_sym("buffer") : SYM_bs_bufferBits = js_sym("bufferBits") : SYM_bs_byteArray = js_sym("byteArray")
  SYM_bs_readPosition = js_sym("readPosition") : SYM_bs_totalBitsWritten = js_sym("totalBitsWritten")
  CLS_BitStream = js_class_new("_BitStream", 0, @bs_ctor)
  js_class_add(CLS_BitStream, js_sym("writeBits"), @bs_writeBits, 0)
  js_class_add(CLS_BitStream, js_sym("writeBit"), @bs_writeBit, 0)
  js_class_add(CLS_BitStream, js_sym("writeByte"), @bs_writeByte, 0)
  js_class_add(CLS_BitStream, js_sym("writeBytes"), @bs_writeBytes, 0)
  js_class_add(CLS_BitStream, js_sym("writeUint16BE"), @bs_writeUint16BE, 0)
  js_class_add(CLS_BitStream, js_sym("writeUint16LE"), @bs_writeUint16LE, 0)
  js_class_add(CLS_BitStream, js_sym("writeUint32BE"), @bs_writeUint32BE, 0)
  js_class_add(CLS_BitStream, js_sym("writeUint32LE"), @bs_writeUint32LE, 0)
  js_class_add(CLS_BitStream, js_sym("readBits"), @bs_readBits, 0)
  js_class_add(CLS_BitStream, js_sym("readBit"), @bs_readBit, 0)
  js_class_add(CLS_BitStream, js_sym("readByte"), @bs_readByte, 0)
  js_class_add(CLS_BitStream, js_sym("readBytes"), @bs_readBytes, 0)
  js_class_add(CLS_BitStream, js_sym("peekBits"), @bs_peekBits, 0)
  js_class_add(CLS_BitStream, js_sym("skipBits"), @bs_skipBits, 0)
  js_class_add(CLS_BitStream, js_sym("hasMoreBits"), @bs_hasMoreBits, 0)
  js_class_add(CLS_BitStream, js_sym("getRemainingBits"), @bs_getRemainingBits, 0)
  js_class_add(CLS_BitStream, js_sym("resetReadPosition"), @bs_resetReadPosition, 0)
  js_class_add(CLS_BitStream, js_sym("seekBits"), @bs_seekBits, 0)
  js_class_add(CLS_BitStream, js_sym("toArray"), @bs_toArray, 0)
  js_class_add(CLS_BitStream, js_sym("getBitLength"), @bs_getBitLength, 0)
  js_class_add(CLS_BitStream, js_sym("getByteLength"), @bs_getByteLength, 0)
  js_class_add(CLS_BitStream, js_sym("clear"), @bs_clear, 0)
  js_class_add(CLS_BitStream, js_sym("clone"), @bs_clone, 0)
  js_class_add(CLS_BitStream, js_sym("writeVarInt"), @bs_writeVarInt, 0)
  js_class_add(CLS_BitStream, js_sym("readVarInt"), @bs_readVarInt, 0)
  js_class_add(CLS_BitStream, js_sym("writeUnary"), @bs_writeUnary, 0)
  js_class_add(CLS_BitStream, js_sym("readUnary"), @bs_readUnary, 0)
  js_class_add(CLS_BitStream, js_sym("alignToByte"), @bs_alignToByte, 0)
  js_class_add(CLS_BitStream, js_sym("isAligned"), @bs_isAligned, 0)
End Sub

Function oc_CreateBitStream(OC_ARGS) As JsV
  If CLS_BitStream.tag <> JS_T_OBJ Then bs_init()
  Return js_new1(CLS_BitStream, js_arg(argv, argc, 0))
End Function

' OpCodes as a value (OpCodes.UInt64.create(...)): the [high32, low32] helpers
' of OpCodes.UInt64 the algorithms reach through it
Function u64_pair(ByVal hi As ULong, ByVal lo As ULong) As JsV
  Dim r As JsV = js_arr_new(0)
  js_pushn(r, hi)
  js_pushn(r, lo)
  Return r
End Function

Function u64_create(OC_ARGS) As JsV
  Return u64_pair(js_tou32(js_argnum(argv, argc, 0)), js_tou32(js_argnum(argv, argc, 1)))
End Function

Function u64_shr(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0)
  Dim n As Long = js_toi32(js_argnum(argv, argc, 1))
  If n = 0 Then Return a
  Dim hi As ULong = js_tou32(js_idxn(a, 0))
  Dim lo As ULong = js_tou32(js_idxn(a, 1))
  If n < 32 Then Return u64_pair(hi Shr n, (lo Shr n) Or (hi Shl ((32 - n) And 31)))
  Return u64_pair(0, hi Shr ((n - 32) And 31))
End Function

Function u64_shl(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0)
  Dim n As Long = js_toi32(js_argnum(argv, argc, 1))
  If n = 0 Then Return a
  Dim hi As ULong = js_tou32(js_idxn(a, 0))
  Dim lo As ULong = js_tou32(js_idxn(a, 1))
  If n < 32 Then Return u64_pair((hi Shl n) Or (lo Shr ((32 - n) And 31)), lo Shl n)
  Return u64_pair(lo Shl ((n - 32) And 31), 0)
End Function

Function u64_bitop(OC_ARGS, ByVal op As Long) As JsV
  Dim a As JsV = js_arg(argv, argc, 0)
  Dim b As JsV = js_arg(argv, argc, 1)
  Dim ah As ULong = js_tou32(js_idxn(a, 0)), al As ULong = js_tou32(js_idxn(a, 1))
  Dim bh As ULong = js_tou32(js_idxn(b, 0)), bl As ULong = js_tou32(js_idxn(b, 1))
  Select Case op
    Case 0 : Return u64_pair(ah And bh, al And bl)
    Case 1 : Return u64_pair(ah Or bh, al Or bl)
  End Select
  Return u64_pair(ah Xor bh, al Xor bl)
End Function

Function u64_and(OC_ARGS) As JsV
  Return u64_bitop(self, argv, argc, envp, 0)
End Function

Function u64_or(OC_ARGS) As JsV
  Return u64_bitop(self, argv, argc, envp, 1)
End Function

Function u64_xor(OC_ARGS) As JsV
  Return u64_bitop(self, argv, argc, envp, 2)
End Function

Function u64_toBytes(OC_ARGS) As JsV
  Dim a As JsV = js_arg(argv, argc, 0)
  Dim r As JsV = js_unpack(js_idxn(a, 0), 32, -1)
  Dim lo As JsV = js_unpack(js_idxn(a, 1), 32, -1)
  Return js_spread_into(r, lo)
End Function

Function oc_global_object() As JsV
  Static o As JsV
  If o.tag = JS_T_OBJ Then Return o
  Dim u As JsV = js_obj_new()
  js_setp(u, js_sym("create"), js_fn_new(@u64_create, 0))
  js_setp(u, js_sym("shr"), js_fn_new(@u64_shr, 0))
  js_setp(u, js_sym("shl"), js_fn_new(@u64_shl, 0))
  js_setp(u, js_sym("and"), js_fn_new(@u64_and, 0))
  js_setp(u, js_sym("or"), js_fn_new(@u64_or, 0))
  js_setp(u, js_sym("xor"), js_fn_new(@u64_xor, 0))
  js_setp(u, js_sym("toBytes"), js_fn_new(@u64_toBytes, 0))
  o = js_obj_new()
  js_setp(o, js_sym("UInt64"), u)
  Return o
End Function`;

  // ========================[ FREEBASIC: JAVASCRIPT SEMANTICS ]========================
  //
  // The FreeBASIC dialect is generated straight from the typed IL onto a
  // runtime with JavaScript semantics (FB_RUNTIME): every value is a JsV (a
  // tagged, reference-counted variant), except locals and module variables
  // the IL types as numbers, which are FreeBASIC Doubles - JavaScript's own
  // number type, so number arithmetic needs no emulation. Objects keep their
  // properties in symbol tables, classes are runtime class objects with
  // method tables, closures capture through environments, and exceptions are
  // setjmp/longjmp.

  const FB_KEYWORDS_FREE = true;

  const FB_FRAMEWORK_CLASSES = new Set([
    'Algorithm', 'CryptoAlgorithm', 'SymmetricCipherAlgorithm', 'AsymmetricCipherAlgorithm', 'AsymmetricAlgorithm',
    'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'EncodingAlgorithm', 'CompressionAlgorithm',
    'ErrorCorrectionAlgorithm', 'HashFunctionAlgorithm', 'MacAlgorithm', 'KdfAlgorithm', 'PaddingAlgorithm',
    'CipherModeAlgorithm', 'AeadAlgorithm', 'RandomGenerationAlgorithm',
    'IAlgorithmInstance', 'IBlockCipherInstance', 'IStreamCipherInstance', 'IHashFunctionInstance', 'IMacInstance',
    'IKdfInstance', 'IAeadInstance', 'IErrorCorrectionInstance', 'IRandomGeneratorInstance', 'IEncodingInstance',
    'ICompressionInstance', 'ICipherModeInstance', 'IPaddingInstance',
    'LinkItem', 'TestCase', 'Vulnerability', 'AuthResult', 'KeySize', 'BlockAbsorber'
  ]);
  const FB_FRAMEWORK_ENUMS = new Set(['CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode']);
  const FB_TYPED = {
    Uint8Array: 'JS_E_U8', Uint8ClampedArray: 'JS_E_U8C', Int8Array: 'JS_E_I8', Uint16Array: 'JS_E_U16', Int16Array: 'JS_E_I16',
    Uint32Array: 'JS_E_U32', Int32Array: 'JS_E_I32', Float32Array: 'JS_E_F32', Float64Array: 'JS_E_F64',
    BigUint64Array: 'JS_E_U64', BigInt64Array: 'JS_E_I64'
  };
  const FB_ERRORS = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError']);
  const FB_INT = {
    int8: [8, true], uint8: [8, false], byte: [8, false], sbyte: [8, true], int16: [16, true], uint16: [16, false],
    short: [16, true], ushort: [16, false], word: [16, false], int32: [32, true], uint32: [32, false], int: [32, true],
    uint: [32, false], dword: [32, false], int64: [64, true], uint64: [64, false], long: [64, true], ulong: [64, false], qword: [64, false]
  };
  const fbTypeName = t => !t ? '' : typeof t === 'string' ? t : (t.name ? String(t.name) : String(t));
  const fbIsInt = t => Object.prototype.hasOwnProperty.call(FB_INT, fbTypeName(t));
  const fbIsBig = t => /^bigint$/i.test(fbTypeName(t));
  const fbIsFloat = t => ['float64', 'float32', 'number', 'double', 'float'].includes(fbTypeName(t));
  const fbIsNum = t => (fbIsInt(t) && FB_INT[fbTypeName(t)][0] <= 53) || fbIsFloat(t);
  const fbIsStr = t => fbTypeName(t) === 'string';
  const fbIsBool = t => ['boolean', 'bool'].includes(fbTypeName(t));
  const fbIsArr = t => /\[\]$/.test(fbTypeName(t)) || Object.prototype.hasOwnProperty.call(FB_TYPED, fbTypeName(t));

  /** A name as FreeBASIC (case-insensitive) can tell apart: upper case letters and _ escaped */
  function fbEscape(name) {
    let out = '';
    for (const ch of String(name)) {
      if (/[a-z0-9]/.test(ch)) out += ch;
      else if (/[A-Z]/.test(ch)) out += '_' + ch.toLowerCase();
      else if (ch === '_') out += '_0';
      else if (ch === '$') out += '_1';
      else out += '_2';
    }
    return out || '_3';
  }

  /** A FreeBASIC string expression of a JavaScript string */
  function fbStringExpr(s) {
    const parts = [];
    let run = '';
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      if (c >= 32 && c < 127) run += ch === '"' ? '""' : ch;
      else {
        if (run) { parts.push(`"${run}"`); run = ''; }
        parts.push(`Chr(${c > 255 ? 63 : c})`);
      }
    }
    if (run || !parts.length) parts.push(`"${run}"`);
    // FreeBASIC limits a line; long literals are joined from pieces
    const chunks = [];
    for (const p of parts) {
      if (p.startsWith('"') && p.length > 400) {
        const body = p.slice(1, -1);
        for (let i = 0; i < body.length; i += 380) {
          let piece = body.slice(i, i + 380);
          // never split a doubled quote
          if (piece.endsWith('"') && !piece.endsWith('""')) { piece = piece.slice(0, -1); i -= 1; }
          chunks.push(`"${piece}"`);
        }
      } else chunks.push(p);
    }
    return chunks.join(' & ');
  }

  function fbNumber(v) {
    if (Number.isNaN(v)) return 'js_nan';
    if (v === Infinity) return 'js_inf';
    if (v === -Infinity) return '(-js_inf)';
    if (Object.is(v, -0)) return '(-0.0)';
    let s;
    if (Number.isInteger(v) && Math.abs(v) < 1e15) s = String(v) + '.0';
    else {
      s = v.toExponential(17).replace('e+', 'e+');
      // shortest that reads back
      for (let p = 1; p <= 17; ++p) {
        const t = v.toExponential(p);
        if (Number(t) === v) { s = t; break; }
      }
      s = s.replace(/e\+?/, 'e');
    }
    return v < 0 ? `(${s})` : s;
  }

  // OpCodes helpers on BigInt values (OpCodes.js)
  const FB_BIGINT_OPCODES = new Set(['RotL64n', 'RotR64n', 'ShiftLn', 'ShiftRn', 'RotL128n', 'RotR128n', 'AndN', 'OrN', 'XorN',
    'GetBitN', 'SetBitN', 'MulModN', 'SquareModN', 'ModPowN', 'GcdN', 'ModN', 'ModInverseN', 'BitCountN']);

  class FreeBasicTransformer {
    constructor(options = {}) {
      this.options = options;
    }

    /** The runtime, once per program however many generated files it concatenates */
    static runtimePrelude() {
      return ['#ifndef JS_RUNTIME_INCLUDED', '#define JS_RUNTIME_INCLUDED', FB_RUNTIME, 'js_rt_init()', '#endif'].join('\n');
    }

    /** The name token a program generated with this className prefixes its names with */
    static tokenFor(className) {
      const token = String(className || 'main').replace(/Generated$/, '').replace(/[^A-Za-z0-9]/g, '') || 'main';
      return fbEscape(token).replace(/_/g, '') + 'x';
    }

    /**
     * The FreeBASIC expression of a module-level name of a program generated
     * with this className (a variable, function or class), for a bundle binding
     * a library's exports; js_undefined() when the program has no such name.
     */
    static libraryBinding(className, name, code) {
      const tok = FreeBasicTransformer.tokenFor(className);
      const esc = fbEscape(name);
      const g = `g${tok}_${esc}`;
      const m = code.match(new RegExp(`^Dim Shared ${g} As (\\w+)`, 'm'));
      if (m) return m[1] === 'Double' ? `js_num(${g})` : g;
      const c = `c${tok}_${esc}`;
      if (new RegExp(`^Dim Shared ${c} As`, 'm').test(code)) return c;
      return 'js_undefined()';
    }

    /**
     * FreeBASIC source of an IL program (with the runtime unless options.embedRuntime === false).
     */
    generate(ast) {
      this.tok = FreeBasicTransformer.tokenFor(this.options.className);
      this.syms = new Map();
      this.consts = new Map();
      this.globals = new Map();     // module JS name -> { name, kind }
      this.functions = [];          // generated functions (code)
      this.declares = [];
      this.classes = new Map();     // JS class name -> info
      this.lambdaCount = 0;
      this.tempCount = 0;
      this.initLines = [];
      const body = ast && ast.type === 'Program' ? (ast.body || []) : (ast ? [ast] : []);
      const flat = this.unwrapModule(body);
      this.collectClasses(flat);
      this.collectGlobals(flat);

      // The module's own initialization: module-level statements in order
      this.fn = this.newFunctionContext(null, 'module');
      const init = [];
      for (const node of flat) if (node && node.type === 'FunctionDeclaration') init.push(...this.moduleFunctionValue(node));
      for (const node of flat) {
        if (!node || node.type === 'FunctionDeclaration') continue;
        this.statement(node, init);
      }
      const moduleFn = this.fn;

      const out = [];
      out.push(`' Generated FreeBASIC code from JavaScript AST`);
      if (this.options.embedRuntime !== false && FB_RUNTIME) {
        out.push(FreeBasicTransformer.runtimePrelude());
      }
      out.push('');
      for (const [name, sym] of this.syms) out.push(`Dim Shared ${sym} As Long`);
      for (const [, c] of this.consts) out.push(`Dim Shared ${c.name} As JsV`);
      for (const [, g] of this.globals) out.push(`Dim Shared ${g.name} As ${g.kind === 'd' ? 'Double' : 'JsV'}`);
      for (const [, c] of this.classes) out.push(`Dim Shared ${c.cvar} As JsV`);
      for (const t of moduleFn.temps.values()) out.push(`Dim Shared ${t.name} As ${t.kind === 'd' ? 'Double' : (t.kind === 'l' ? 'Long' : 'JsV')}`);
      for (const [n, k] of moduleFn.locals) out.push(`Dim Shared ${n} As ${k === 'd' ? 'Double' : 'JsV'}`);
      out.push('');
      out.push(...this.declares);
      out.push('');
      for (const f of this.functions) out.push(f, '');
      out.push(`Sub mi_${this.tok}()`);
      for (const [name, sym] of this.syms) out.push(`  ${sym} = js_sym(${fbStringExpr(name)})`);
      for (const [, c] of this.consts) out.push(`  ${c.name} = ${c.init}`);
      out.push(...init.map(l => '  ' + l));
      out.push('End Sub');
      out.push(`mi_${this.tok}()`);
      return out.join('\n') + '\n';
    }

    /** The statements of the module: an unwrapped IIFE/UMD body, or the program itself */
    unwrapModule(body) {
      const out = [];
      for (const node of body) {
        if (node && node.type === 'ExpressionStatement' && node.expression && node.expression.type === 'CallExpression'
          && node.expression.callee && ['FunctionExpression', 'ArrowFunctionExpression', 'ArrowFunction'].includes(node.expression.callee.type)) {
          const fn = node.expression.callee;
          out.push(...this.unwrapModule(fn.body && fn.body.body ? fn.body.body : []));
          continue;
        }
        if (node && node.type === 'ReturnStatement') continue;
        out.push(node);
      }
      return out;
    }

    // ------------------------------------------------------------------
    // names
    // ------------------------------------------------------------------

    sym(name) {
      name = String(name);
      if (!this.syms.has(name)) this.syms.set(name, `s${this.tok}_${fbEscape(name)}`);
      return this.syms.get(name);
    }

    constStr(s) {
      const key = 's:' + s;
      if (!this.consts.has(key)) this.consts.set(key, { name: `q${this.tok}_${this.consts.size}`, init: `js_str(${fbStringExpr(s)})` });
      return this.consts.get(key).name;
    }

    constBig(digits) {
      const key = 'b:' + digits;
      if (!this.consts.has(key)) this.consts.set(key, { name: `q${this.tok}_${this.consts.size}`, init: `js_tobig(js_str("${digits}"))` });
      return this.consts.get(key).name;
    }

    // ------------------------------------------------------------------
    // pre-passes
    // ------------------------------------------------------------------

    collectClasses(body) {
      const visit = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if ((n.type === 'ClassDeclaration' || n.type === 'ClassExpression') && n.id && n.id.name && !this.classes.has(n.id.name)) {
          const esc = fbEscape(n.id.name);
          const info = { jsName: n.id.name, node: n, cvar: `c${this.tok}_${esc}`, esc, superName: this.superName(n.superClass), accessors: new Set(), methods: new Set() };
          for (const m of (n.body && n.body.body) || []) {
            const k = this.keyName(m);
            if (m.type === 'MethodDefinition' && k && m.kind !== 'constructor') (m.kind === 'get' || m.kind === 'set' ? info.accessors : info.methods).add(k);
          }
          this.classes.set(n.id.name, info);
        }
        for (const k of Object.keys(n)) if (k !== 'parent' && n[k] && typeof n[k] === 'object') visit(n[k]);
      };
      visit(body);
    }

    superName(sc) {
      if (!sc) return null;
      if (sc.type === 'Identifier') return sc.name;
      if (sc.type === 'MemberExpression' && !sc.computed && sc.property) return sc.property.name;
      return null;
    }

    keyName(m) {
      const k = m.key;
      if (!k) return null;
      if (typeof k === 'string') return k;
      if (k.type === 'Identifier' || k.type === 'PrivateIdentifier') return k.name;
      if (k.type === 'Literal') return String(k.value);
      return null;
    }

    collectGlobals(body) {
      for (const node of body) {
        if (!node) continue;
        if (node.type === 'VariableDeclaration') {
          for (const d of node.declarations || []) {
            for (const n of this.patternNames(d.id)) {
              const numeric = d.id.type === 'Identifier' && !d.nullable && !d.declaredNullable && fbIsNum(d.declaredType || d.id.resultType || d.resultType)
                && !(d.init && d.init.type === 'Literal' && d.init.value === null) && !this.classes.has(n);
              this.globals.set(n, { name: `g${this.tok}_${fbEscape(n)}`, kind: numeric ? 'd' : 'v' });
            }
          }
        } else if (node.type === 'FunctionDeclaration' && node.id) {
          this.globals.set(node.id.name, { name: `g${this.tok}_${fbEscape(node.id.name)}`, kind: 'v', fn: `f${this.tok}_${fbEscape(node.id.name)}` });
        }
      }
    }

    patternNames(p) {
      if (!p) return [];
      switch (p.type) {
        case 'Identifier': return [p.name];
        case 'ArrayPattern': return (p.elements || []).flatMap(e => this.patternNames(e));
        case 'ObjectPattern': return (p.properties || []).flatMap(q => this.patternNames(q.type === 'RestElement' ? q.argument : (q.value || q.key)));
        case 'AssignmentPattern': return this.patternNames(p.left);
        case 'RestElement': return this.patternNames(p.argument);
        default: return [];
      }
    }

    // ------------------------------------------------------------------
    // function contexts, locals, closures
    // ------------------------------------------------------------------

    newFunctionContext(parent, kind, node) {
      return {
        parent, kind, node,
        locals: new Map(),        // FB name -> 'd' | 'v'
        scopes: [new Map()],      // JS name -> binding { fb, kind, env: slot index | null }
        temps: new Map(),
        captured: new Set(),      // JS names of this function captured by inner functions
        envSlots: new Map(),      // JS name -> slot
        hasEnv: false,
        tryDepth: 0,
        loops: []
      };
    }

    temp(kind = 'v') {
      const name = `t${this.tok}_${++this.tempCount}`;
      this.fn.temps.set(name, { name, kind });
      return name;
    }

    /** Captured names: declared in fnNode, referenced inside a nested function */
    capturedNames(fnNode, declared) {
      const captured = new Set();
      const isFn = n => ['FunctionExpression', 'ArrowFunctionExpression', 'ArrowFunction', 'FunctionDeclaration'].includes(n.type);
      const usesThis = { v: false };
      const walk = (n, depth, arrowChain) => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(x => walk(x, depth, arrowChain)); return; }
        if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression') return;
        if (isFn(n)) {
          const arrow = n.type !== 'FunctionExpression' && n.type !== 'FunctionDeclaration';
          walk(n.params, depth + 1, arrow && arrowChain);
          walk(n.body, depth + 1, arrow && arrowChain);
          return;
        }
        if (depth > 0 && n.type === 'Identifier' && declared.has(n.name)) captured.add(n.name);
        if (depth > 0 && arrowChain && (n.type === 'ThisExpression' || n.type === 'ThisPropertyAccess' || n.type === 'ThisMethodCall'
          || n.type === 'ParentMethodCall')) usesThis.v = true;
        for (const k of Object.keys(n)) if (k !== 'parent' && n[k] && typeof n[k] === 'object') walk(n[k], depth, arrowChain);
      };
      walk(fnNode.body, 0, true);
      if (usesThis.v) captured.add('this');
      return captured;
    }

    declaredNames(fnNode) {
      const names = new Set();
      for (const p of fnNode.params || []) {
        if (p.type === 'Identifier') names.add(p.name);
        else if (p.type === 'DefaultParameter' || p.type === 'AssignmentPattern') names.add(p.name || (p.left && p.left.name));
        else if (p.type === 'RestParameter' || p.type === 'RestElement') names.add(p.name || (p.argument && p.argument.name));
      }
      const walk = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(walk); return; }
        if (['FunctionExpression', 'ArrowFunctionExpression', 'ArrowFunction', 'ClassDeclaration', 'ClassExpression'].includes(n.type)) return;
        if (n.type === 'FunctionDeclaration') { if (n.id) names.add(n.id.name); return; }
        if (n.type === 'VariableDeclarator') for (const x of this.patternNames(n.id)) names.add(x);
        if (n.type === 'CatchClause' && n.param) for (const x of this.patternNames(n.param)) names.add(x);
        for (const k of Object.keys(n)) if (k !== 'parent' && n[k] && typeof n[k] === 'object') walk(n[k]);
      };
      walk(fnNode.body);
      return names;
    }

    lookup(name) {
      let up = 0;
      for (let f = this.fn; f; f = f.parent) {
        for (let i = f.scopes.length - 1; i >= 0; --i) {
          const b = f.scopes[i].get(name);
          if (b) return { ...b, owner: f, up };
        }
        if (f.hasEnv) up += 0;
      }
      return null;
    }

    /** Declare a local: a FreeBASIC local, or a slot of the environment when captured */
    declareLocal(name, kind) {
      const f = this.fn;
      const scope = f.scopes[f.scopes.length - 1];
      if (scope.has(name)) return scope.get(name);
      if (f.captured.has(name)) {
        if (!f.envSlots.has(name)) f.envSlots.set(name, f.envSlots.size);
        const b = { env: f.envSlots.get(name), kind: 'v' };
        scope.set(name, b);
        return b;
      }
      let base = `v${this.tok}_${fbEscape(name)}`;
      let fb = base;
      let n = 1;
      while ([...f.scopes.slice(0, -1)].some(s => [...s.values()].some(b => b.fb === fb)) || (f.locals.has(fb) && f.locals.get(fb) !== kind)) fb = `${base}_${n++}`;
      f.locals.set(fb, kind);
      const b = { fb, kind };
      scope.set(name, b);
      return b;
    }

    /** The FreeBASIC expression of an environment slot, `hops` own-environments out */
    envRef(owner, slot) {
      // count environments between the current function and the owner
      let hops = 0;
      for (let f = this.fn; f && f !== owner; f = f.parent) if (f.hasEnv) hops++;
      const base = this.fn.hasEnv ? 'envh' : 'Cast(JsEnvH Ptr, envp)';
      if (owner === this.fn) return `envh->vars[${slot}]`;
      return `(*js_envvar(${base}, ${hops - (this.fn.hasEnv ? 0 : 1) < 0 ? 0 : hops - (this.fn.hasEnv ? 0 : 1)}, ${slot}))`;
    }

    // ------------------------------------------------------------------
    // functions
    // ------------------------------------------------------------------

    signature(name) {
      return `${name}(ByRef self As JsV, ByVal argv As JsV Ptr, ByVal argc As Long, ByVal envp As Any Ptr) As JsV`;
    }

    /**
     * Emit a JavaScript function as a FreeBASIC function; returns its name.
     * kind: 'function' | 'method' | 'ctor' | 'arrow'
     */
    emitFunction(name, fnNode, kind, extra = {}) {
      const parentFn = this.fn;
      const f = this.newFunctionContext(kind === 'function' && extra.moduleLevel ? null : parentFn, kind, fnNode);
      if (kind === 'method' || kind === 'ctor' || extra.moduleLevel) f.parent = null;
      this.fn = f;
      const declared = this.declaredNames(fnNode);
      if (kind !== 'arrow') declared.add('this');
      f.captured = this.capturedNames(fnNode, declared);
      f.hasEnv = f.captured.size > 0;
      f.classInfo = extra.classInfo || (parentFn && parentFn.classInfo) || null;
      f.isStatic = !!extra.isStatic;
      f.methodName = extra.methodName || null;
      const lines = [];
      // this, captured for arrow functions
      if (f.hasEnv && f.captured.has('this')) this.declareLocal('this', 'v');
      // parameters
      (fnNode.params || []).forEach((p, i) => {
        let pname = p.name, def = null, rest = false;
        if (p.type === 'DefaultParameter') { pname = p.name || (p.left && p.left.name); def = p.defaultValue; }
        else if (p.type === 'AssignmentPattern') { pname = p.left && p.left.name; def = p.right; }
        else if (p.type === 'RestParameter' || p.type === 'RestElement') { pname = p.name || (p.argument && p.argument.name); rest = true; }
        else if (p.type === 'Identifier' && p.defaultValue) def = p.defaultValue;
        if (!pname) { lines.push(`' unsupported parameter pattern`); return; }
        const numeric = !rest && !def && fbIsNum(p.resultType) && !p.nullable;
        const b = this.declareLocal(pname, numeric ? 'd' : 'v');
        const target = b.env !== undefined ? `envh->vars[${b.env}]` : b.fb;
        if (rest) lines.push(`${target} = js_argrest(argv, argc, ${i})`);
        else if (b.kind === 'd' && b.env === undefined) lines.push(`${target} = js_argnum(argv, argc, ${i})`);
        else lines.push(`${target} = js_arg(argv, argc, ${i})`);
        if (def) {
          const dv = this.V(this.expr(def));
          lines.push(`If ${target}.tag = JS_T_UNDEF Then ${target} = ${dv}`);
        }
      });
      if (f.hasEnv && f.captured.has('this')) lines.push(`envh->vars[${f.envSlots.get('this')}] = self`);
      // body
      const body = fnNode.body;
      if (body && body.type === 'BlockStatement') {
        // the hoisted functions may capture the body's own variables: their environment slots come first
        // (the body's own let/const, and var anywhere in it)
        const early = (n, top) => {
          if (!n || typeof n !== 'object') return;
          if (Array.isArray(n)) { n.forEach(x => early(x, top)); return; }
          if (['FunctionExpression', 'ArrowFunctionExpression', 'ArrowFunction', 'FunctionDeclaration', 'ClassDeclaration', 'ClassExpression'].includes(n.type)) return;
          if (n.type === 'VariableDeclaration' && (top || n.kind === 'var'))
            for (const d of n.declarations || []) for (const x of this.patternNames(d.id)) if (f.captured.has(x)) this.declareLocal(x, 'v');
          for (const k of Object.keys(n)) if (k !== 'parent' && n[k] && typeof n[k] === 'object') early(n[k], false);
        };
        for (const s of body.body || []) early(s, true);
        this.hoistFunctions(body.body || [], lines);
        for (const s of body.body || []) if (!s || s.type !== 'FunctionDeclaration') this.statement(s, lines);
      } else if (body) {
        lines.push(`Return ${this.V(this.expr(body))}`);
      }
      // A JsV result must always be set: an unset one is destroyed as garbage
      if (kind === 'ctor') lines.push('Return self');
      else lines.push('Return js_undefined()');
      // prologue: locals, temps, environment
      const head = [`Function ${this.signature(name)}`];
      if (f.hasEnv) head.push(`  Dim envh As JsEnvH Ptr = js_env_new(${Math.max(f.envSlots.size, 1)}, Cast(JsEnvH Ptr, envp))`);
      for (const [n, k] of f.locals) head.push(`  Dim ${n} As ${k === 'd' ? 'Double' : 'JsV'}`);
      for (const t of f.temps.values()) head.push(`  Dim ${t.name} As ${t.kind === 'd' ? 'Double' : (t.kind === 'l' ? 'Long' : 'JsV')}`);
      const code = [...head, ...this.indent(lines), 'End Function'].join('\n');
      this.functions.push(code);
      this.declares.push(`Declare Function ${this.signature(name)}`);
      this.fn = parentFn;
      return name;
    }

    indent(lines) {
      return lines.map(l => '  ' + l);
    }

    hoistFunctions(stmts, lines) {
      for (const s of stmts) {
        if (s && s.type === 'FunctionDeclaration' && s.id) this.declareLocal(s.id.name, 'v');
      }
      for (const s of stmts) {
        if (s && s.type === 'FunctionDeclaration' && s.id) {
          const b = this.lookup(s.id.name);
          lines.push(`${this.bindingRef(b)} = ${this.closure(s)}`);
        }
      }
    }

    /** A function value: the lambda's code with the current environment */
    closure(fnNode) {
      const name = `l${this.tok}_${++this.lambdaCount}`;
      const arrow = fnNode.type === 'ArrowFunction' || fnNode.type === 'ArrowFunctionExpression' || fnNode.expression;
      this.emitFunction(name, fnNode, arrow ? 'arrow' : 'function');
      const envExpr = this.fn.kind === 'module' ? '0' : (this.fn.hasEnv ? 'envh' : 'envp');
      return `js_fn_new(@${name}, ${envExpr})`;
    }

    moduleFunctionValue(node) {
      const g = this.globals.get(node.id.name);
      this.emitFunction(g.fn, node, 'function', { moduleLevel: true });
      return [`${g.name} = js_fn_new(@${g.fn}, 0)`];
    }

    bindingRef(b) {
      if (b.env !== undefined) return this.envRef(b.owner || this.fn, b.env);
      return b.fb;
    }

    // ------------------------------------------------------------------
    // expressions: { c: code, k: 'd' (Double) | 'v' (JsV) | 'b' (condition) }
    // ------------------------------------------------------------------

    V(e) {
      if (e.k === 'v') return e.c;
      if (e.k === 'd') return `js_num(${e.c})`;
      return `js_bool(${e.c})`;
    }

    D(e) {
      if (e.k === 'd') return e.c;
      if (e.k === 'v') return `js_tonum(${e.c})`;
      return `IIf(${e.c}, 1.0, 0.0)`;
    }

    B(e) {
      if (e.k === 'b') return e.c;
      if (e.k === 'd') return `js_dtruthy(${e.c})`;
      return `js_truthy(${e.c})`;
    }

    vx(c) { return { c, k: 'v' }; }
    dx(c) { return { c, k: 'd' }; }
    bx(c) { return { c, k: 'b' }; }

    type(n) { return n ? fbTypeName(n.resultType) : ''; }
    isNumNode(n) {
      if (!n) return false;
      if (n.type === 'Literal') return typeof n.value === 'number';
      return fbIsNum(this.type(n)) && !n.nullable;
    }
    isBigNode(n) {
      if (!n) return false;
      if (n.type === 'Literal') return typeof n.value === 'bigint';
      return fbIsBig(this.type(n)) || n.bigint === true;
    }

    expr(node) {
      if (!node) return this.vx('js_undefined()');
      const h = this[`e${node.type}`];
      if (typeof h === 'function') return h.call(this, node);
      return this.vx(`js_unsupported(${fbStringExpr(node.type)})`);
    }

    /** Arguments as JsV expressions; spreads make the call take an array */
    /** Whether evaluating the node can have an effect another argument could observe */
    isImpure(node) {
      if (!node || typeof node !== 'object') return false;
      if (Array.isArray(node)) return node.some(n => this.isImpure(n));
      if (['CallExpression', 'NewExpression', 'AssignmentExpression', 'UpdateExpression', 'ThisMethodCall', 'ParentMethodCall',
        'ParentConstructorCall', 'ArrayAppend', 'ArrayPush', 'ArrayPop', 'ArrayShift', 'ArrayUnshift', 'ArraySplice', 'TypedArraySet',
        'MapSet', 'DataViewWrite', 'ArrayFill', 'ArrayClear', 'ArraySort', 'ArrayReverse', 'ArrayForEach'].includes(node.type)) return true;
      if (node.type === 'UnaryExpression' && ['++', '--', 'delete'].includes(node.operator)) return true;
      if (['FunctionExpression', 'ArrowFunctionExpression', 'ArrowFunction'].includes(node.type)) return false;
      for (const k of Object.keys(node)) {
        if (k === 'parent' || k === 'resultType' || k === 'typeInfo') continue;
        const v = node[k];
        if (v && typeof v === 'object' && this.isImpure(v)) return true;
      }
      return false;
    }

    /**
     * Arguments as JsV expressions; spreads make the call take an array.
     * FreeBASIC evaluates arguments right to left: two or more with effects
     * are evaluated left to right into temporaries first (a.seq, which the
     * call's leftmost argument carries, as that one is evaluated last).
     */
    args(nodes) {
      const list = nodes || [];
      if (list.some(a => a && a.type === 'SpreadElement')) {
        let arr = 'js_arr_new(0)';
        for (const a of list) {
          if (a.type === 'SpreadElement') arr = `js_spread_into(${arr}, ${this.V(this.expr(a.argument))})`;
          else arr = `js_arr_push_r(${arr}, ${this.V(this.expr(a))})`;
        }
        return { spread: arr };
      }
      const impure = list.map(a => this.isImpure(a));
      if (impure.filter(Boolean).length < 2) return { list: list.map(a => this.V(this.expr(a))) };
      const seq = [];
      const out = list.map((a, i) => {
        const code = this.V(this.expr(a));
        if (!impure[i]) return code;
        const t = this.temp('v');
        seq.push(`js_keepn(${t}, ${code})`);
        return t;
      });
      return { list: out, seq };
    }

    callHelper(family, prefixArgs, a) {
      let prefix = prefixArgs;
      if (a.spread || a.list.length > 8) {
        // the argument array, read before the prefix (arguments run right to left), runs the sequence itself
        const base = a.seq && a.seq.length ? `js_withv(${a.seq.join(' + ')}, js_arr_new(0))` : 'js_arr_new(0)';
        const arr = a.spread || a.list.reduce((acc, x) => `js_arr_push_r(${acc}, ${x})`, base);
        return `${family}a(${[...prefix, arr].join(', ')})`;
      }
      if (a.seq && a.seq.length) {
        const wrap = family === 'js_fcall' ? 'js_withf' : 'js_withv';
        prefix = [`${wrap}(${a.seq.join(' + ')}, ${prefixArgs[0]})`, ...prefixArgs.slice(1)];
      }
      return `${family}${a.list.length}(${[...prefix, ...a.list].join(', ')})`;
    }

    eLiteral(node) {
      const v = node.value;
      if (node.regex) return this.vx(`js_regex_new(${fbStringExpr(node.regex.pattern)}, ${fbStringExpr(node.regex.flags || "")})`);
      if (v === null) return this.vx('js_null()');
      if (v === undefined) return this.vx('js_undefined()');
      if (typeof v === 'boolean') return this.bx(v ? '-1' : '0');
      if (typeof v === 'string') return this.vx(this.constStr(v));
      if (typeof v === 'bigint') return this.vx(this.constBig(v.toString()));
      if (typeof v === 'number') return this.dx(fbNumber(v));
      return this.vx('js_undefined()');
    }

    eIdentifier(node) {
      const name = node.name;
      const b = this.lookup(name);
      if (b) {
        if (b.env !== undefined) return this.vx(this.envRef(b.owner, b.env));
        return b.kind === 'd' ? this.dx(b.fb) : this.vx(b.fb);
      }
      switch (name) {
        case 'undefined': return this.vx('js_undefined()');
        case 'NaN': return this.dx('js_nan');
        case 'Infinity': return this.dx('js_inf');
        default: break;
      }
      if (this.globals.has(name)) {
        const g = this.globals.get(name);
        return g.kind === 'd' ? this.dx(g.name) : this.vx(g.name);
      }
      if (this.classes.has(name)) return this.vx(this.classes.get(name).cvar);
      if (FB_FRAMEWORK_CLASSES.has(name)) return this.vx(`CLS_${name}`);
      if (FB_FRAMEWORK_ENUMS.has(name)) return this.vx(`G_${name}`);
      if (name === 'RegisterAlgorithm') return this.vx('js_fn_new(@fw_RegisterAlgorithm, 0)');
      return this.vx(`js_global_get(${fbStringExpr(name)})`);
    }

    eThisExpression() {
      const b = this.lookup('this');
      if (b && b.env !== undefined && (this.fn.kind === 'arrow' || b.owner !== this.fn)) return this.vx(this.envRef(b.owner, b.env));
      // module-level code (and its arrows) has no receiver
      let f = this.fn;
      while (f && f.kind === 'arrow') f = f.parent;
      if (!f || f.kind === 'module') return this.vx('js_undefined()');
      return this.vx('self');
    }

    selfRef() {
      return this.eThisExpression().c;
    }

    // --- operators ---

    eBinaryExpression(node) {
      const op = node.operator;
      const L = node.left, R = node.right;
      // both sides with effects: the left one runs first, into a temporary (a runtime
      // helper's arguments are evaluated right to left)
      if (this.isImpure(L) && this.isImpure(R) && L.type !== 'FbRaw') {
        const tmp = this.temp('v');
        const keep = `js_keepn(${tmp}, ${this.V(this.expr(L))})`;
        const r = this.eBinaryExpression({ ...node, left: { type: 'FbRaw', code: tmp, k: 'v', resultType: L.resultType } });
        if (r.k === 'd') return this.dx(`js_seqd(${r.c}, ${keep})`);
        if (r.k === 'b') return this.bx(`js_seqb(${r.c}, ${keep})`);
        return this.vx(`js_seqv(${r.c}, ${keep})`);
      }
      const big = node.bigint === true || this.isBigNode(L) || this.isBigNode(R);
      const t = this.type(node);
      if (op === '===' || op === '!==' || op === '==' || op === '!=') return this.equality(node);
      if (['<', '>', '<=', '>='].includes(op)) {
        if (this.isNumNode(L) && this.isNumNode(R)) return this.bx(`(${this.D(this.expr(L))} ${op} ${this.D(this.expr(R))})`);
        const fn = { '<': 'js_lt', '>': 'js_gt', '<=': 'js_le', '>=': 'js_ge' }[op];
        return this.bx(`${fn}(${this.V(this.expr(L))}, ${this.V(this.expr(R))})`);
      }
      if (op === 'instanceof') return this.instanceOf(L, R);
      if (op === 'in') return this.bx(`js_in(${this.V(this.expr(L))}, ${this.V(this.expr(R))})`);
      // an inlined OpCodes BigInt helper (AndN, XorN, ...) may get BigInts whatever its operands are typed: dispatch on the values
      const bigHelper = FB_BIGINT_OPCODES.has(node.opCodesMethod);
      if (bigHelper || (big && !(this.isNumNode(L) && this.isNumNode(R) && !node.bigint))) {
        const fn = { '+': 'js_add', '-': 'js_sub', '*': 'js_mul', '/': 'js_div', '%': 'js_mod', '**': 'js_pow',
          '&': 'js_band', '|': 'js_bor', '^': 'js_bxor', '<<': 'js_shl', '>>': 'js_sar', '>>>': 'js_shr' }[op];
        // a helper's operands keep their values: OpCodes.XorN(0x47, 0x50) is a Number xor
        const operand = n => bigHelper && !big ? this.expr(n) : this.bigOperand(n);
        const l = this.V(operand(L)), r = this.V(operand(R));
        return this.vx(`${fn}(${l}, ${r})`);
      }
      if (op === '+') {
        if (fbIsStr(t) || this.isStrNode(L) || this.isStrNode(R) || !(this.isNumNode(L) && this.isNumNode(R))) {
          if (fbIsStr(t) || this.isStrNode(L) || this.isStrNode(R)) return this.vx(`js_concat(${this.V(this.expr(L))}, ${this.V(this.expr(R))})`);
          return this.vx(`js_add(${this.V(this.expr(L))}, ${this.V(this.expr(R))})`);
        }
        return this.dx(`(${this.D(this.expr(L))} + ${this.D(this.expr(R))})`);
      }
      if (['-', '*', '/', '%', '&', '|', '^', '<<', '>>', '>>>'].includes(op) && !node.opCodesMethod && !(this.isNumNode(L) && this.isNumNode(R))) {
        // an operand not typed as a Number (uint64, int64, untyped) may hold a BigInt: dispatch on the value
        const fn = { '-': 'js_sub', '*': 'js_mul', '/': 'js_div', '%': 'js_mod', '&': 'js_band', '|': 'js_bor', '^': 'js_bxor', '<<': 'js_shl', '>>': 'js_sar', '>>>': 'js_shr' }[op];
        return this.vx(`${fn}(${this.V(this.expr(L))}, ${this.V(this.expr(R))})`);
      }
      if (op === '-' || op === '*' || op === '/') {
        if (op === '*' && node.opCodesMethod) return this.dx(`js_mul32(${this.D(this.expr(L))}, ${this.D(this.expr(R))})`);
        return this.dx(`(${this.D(this.expr(L))} ${op} ${this.D(this.expr(R))})`);
      }
      if (op === '%') return this.dx(`fmod(${this.D(this.expr(L))}, ${this.D(this.expr(R))})`);
      if (op === '**') return this.dx(`js_dpow(${this.D(this.expr(L))}, ${this.D(this.expr(R))})`);
      const unsigned = fbIsInt(t) && !FB_INT[t][1];
      const conv = unsigned ? 'js_tou32' : 'js_toi32';
      const l = this.D(this.expr(L)), r = this.D(this.expr(R));
      switch (op) {
        case '&': return this.dx(`CDbl(${conv}(${l}) And ${conv}(${r}))`);
        case '|': return this.dx(`CDbl(${conv}(${l}) Or ${conv}(${r}))`);
        case '^': return this.dx(`CDbl(${conv}(${l}) Xor ${conv}(${r}))`);
        case '<<': return this.dx(unsigned ? `CDbl(Cast(ULong, js_toi32(${l}) Shl (js_tou32(${r}) And 31)))` : `js_dshl(${l}, ${r})`);
        case '>>': return this.dx(`js_dsar(${l}, ${r})`);
        case '>>>': return this.dx(`js_dshr(${l}, ${r})`);
        default: return this.vx(`js_unsupported(${fbStringExpr('operator ' + op)})`);
      }
    }

    bigOperand(n) {
      const e = this.expr(n);
      if (e.k === 'd') return this.vx(`js_big_from_double(${e.c})`);
      return e;
    }

    isStrNode(n) {
      return n && ((n.type === 'Literal' && typeof n.value === 'string') || fbIsStr(this.type(n)));
    }

    equality(node) {
      const op = node.operator;
      const L = node.left, R = node.right;
      const neg = op === '!==' || op === '!=';
      // null, and undefined (an identifier, or the IL's Literal without a value)
      const isNull = n => n && ((n.type === 'Literal' && (n.value === null || n.value === undefined) && !n.regex) || (n.type === 'Identifier' && n.name === 'undefined'));
      if (isNull(L) || isNull(R)) {
        const other = isNull(L) ? R : L;
        if (op === '===' || op === '!==') {
          const nul = isNull(L) ? L : R;
          const tagTest = nul.type === 'Literal' && nul.value === null ? 'JS_T_NULL' : 'JS_T_UNDEF';
          const e = this.expr(other);
          if (e.k !== 'v') return this.bx(neg ? '-1' : '0');
          return this.bx(`(${e.c}.tag ${neg ? '<>' : '='} ${tagTest})`);
        }
        const e = this.expr(other);
        if (e.k !== 'v') return this.bx(neg ? '-1' : '0');
        return this.bx(`(${e.c}.tag ${neg ? '>' : '<='} JS_T_NULL)`);
      }
      if (this.isNumNode(L) && this.isNumNode(R)) return this.bx(`(${this.D(this.expr(L))} ${neg ? '<>' : '='} ${this.D(this.expr(R))})`);
      const fn = op === '===' || op === '!==' ? 'js_strict_eq' : 'js_loose_eq';
      const c = `${fn}(${this.V(this.expr(L))}, ${this.V(this.expr(R))})`;
      return this.bx(neg ? `(${c} = 0)` : c);
    }

    instanceOf(L, R) {
      const v = this.V(this.expr(L));
      if (R && R.type === 'Identifier') {
        if (R.name === 'Array') return this.bx(`js_is_arr(${v})`);
        if (FB_TYPED[R.name]) return this.bx(`js_is_typed(${v}, ${FB_TYPED[R.name]})`);
        if (FB_ERRORS.has(R.name)) return this.bx(`js_instanceof_cls(${v}, js_classh(CLS_Error))`);
      }
      return this.bx(`js_instanceof_cls(${v}, js_classh(${this.V(this.expr(R))}))`);
    }

    eLogicalExpression(node) {
      const op = node.operator;
      const L = this.expr(node.left), R = this.expr(node.right);
      if (op === '&&' || op === '||') {
        if (L.k !== 'v' && R.k !== 'v') return this.bx(`(${this.B(L)} ${op === '&&' ? 'AndAlso' : 'OrElse'} ${this.B(R)})`);
        // the value of the operand that decided
        const t = this.temp('v');
        if (op === '&&') return this.vx(`IIf(js_truthy(js_keep(${t}, ${this.V(L)})), ${this.V(R)}, ${t})`);
        return this.vx(`IIf(js_truthy(js_keep(${t}, ${this.V(L)})), ${t}, ${this.V(R)})`);
      }
      if (op === '??') {
        const t = this.temp('v');
        return this.vx(`IIf(js_keep(${t}, ${this.V(L)}).tag <= JS_T_NULL, ${this.V(R)}, ${t})`);
      }
      return this.vx(`js_unsupported("logical ${op}")`);
    }

    eUnaryExpression(node) {
      const op = node.operator;
      const a = node.argument;
      switch (op) {
        case '!': return this.bx(`(${this.B(this.expr(a))} = 0)`);
        case '-':
          // an operand not typed as a Number may hold a BigInt
          if (this.isBigNode(a) || !this.isNumNode(a)) return this.vx(`js_neg(${this.V(this.expr(a))})`);
          return this.dx(`(-${this.D(this.expr(a))})`);
        case '+': return this.dx(this.D(this.expr(a)));
        case '~':
          if (this.isBigNode(a) || !this.isNumNode(a)) return this.vx(`js_bnot(${this.V(this.expr(a))})`);
          return this.dx(`CDbl(Not js_toi32(${this.D(this.expr(a))}))`);
        case 'typeof': return this.typeofExpr(a);
        case 'void': return this.vx(`js_void(${this.V(this.expr(a))})`);
        case 'delete': return this.deleteExpr(a);
        case '++': case '--': return this.update({ operator: op, prefix: true, argument: a }, false);
        default: return this.vx(`js_unsupported("unary ${op}")`);
      }
    }

    deleteExpr(a) {
      if (a && a.type === 'MemberExpression') {
        const key = a.computed ? this.V(this.expr(a.property)) : this.constStr(a.property.name);
        return this.bx(`js_delete_r(${this.V(this.expr(a.object))}, ${key})`);
      }
      return this.bx('-1');
    }

    eDeleteExpression(node) { return this.deleteExpr(node.argument); }
    eTypeOfExpression(node) { return this.typeofExpr(node.argument); }

    /** typeof: an undeclared name is "undefined", not a ReferenceError */
    typeofExpr(a) {
      if (a && a.type === 'Identifier' && !this.lookup(a.name) && !this.globals.has(a.name) && !this.classes.has(a.name)
        && !['undefined', 'NaN', 'Infinity', 'RegisterAlgorithm'].includes(a.name) && !FB_FRAMEWORK_CLASSES.has(a.name) && !FB_FRAMEWORK_ENUMS.has(a.name))
        return this.vx(`js_global_typeof(${fbStringExpr(a.name)})`);
      return this.vx(`js_typeof(${this.V(this.expr(a))})`);
    }

    eConditionalExpression(node) {
      const c = this.B(this.expr(node.test));
      const a = this.expr(node.consequent), b = this.expr(node.alternate);
      if (a.k === 'd' && b.k === 'd') return this.dx(`IIf(${c}, ${a.c}, ${b.c})`);
      if (a.k === 'b' && b.k === 'b') return this.bx(`IIf(${c}, ${a.c}, ${b.c})`);
      return this.vx(`IIf(${c}, ${this.V(a)}, ${this.V(b)})`);
    }

    eSequenceExpression(node) {
      const parts = (node.expressions || []).map(e => this.expr(e));
      if (parts.length === 1) return parts[0];
      // a + b evaluates left to right in FreeBASIC: discard all but the last
      const last = parts.pop();
      const t = this.temp(last.k === 'd' ? 'd' : 'v');
      const seq = parts.map(p => `js_discard(${this.V(p)})`).join(' + ');
      return last.k === 'd'
        ? this.dx(`(${seq} + js_keepd(${t}, ${last.c}) + ${t})`)
        : this.vx(`IIf(${seq} = 0, ${this.V(last)}, js_undefined())`);
    }

    // --- assignment ---

    eAssignmentExpression(node) {
      return this.assignment(node, false);
    }

    /** target = value; as a statement (string) or as an expression ({c,k}) */
    assignment(node, statement) {
      const op = node.operator;
      let target = node.left;
      let valueNode = node.right;
      // a[i++] op= v reads and writes one element: its object and key are evaluated once
      if (op !== '=' && target.type === 'MemberExpression' && target.computed && (this.isImpure(target.object) || this.isImpure(target.property))) {
        const to = this.temp('v'), tk = this.temp('v');
        const pre = [`js_keepn(${to}, ${this.V(this.expr(target.object))})`, `js_keepn(${tk}, ${this.V(this.expr(target.property))})`];
        target = { ...target, object: { type: 'FbRaw', code: to, k: 'v', resultType: target.object.resultType }, property: { type: 'FbRaw', code: tk, k: 'v' } };
        const r = this.assignment({ ...node, left: target }, statement);
        if (statement) return `js_discard_n(${pre.join(' + ')})\n${r}`;
        if (r.k === 'd') return this.dx(`js_seqd(${r.c}, ${pre.join(' + ')})`);
        if (r.k === 'b') return this.bx(`js_seqb(${r.c}, ${pre.join(' + ')})`);
        return this.vx(`js_seqv(${this.V(r)}, ${pre.join(' + ')})`);
      }
      if (op !== '=') {
        const base = op.slice(0, -1);
        if (base === '&&' || base === '||' || base === '??') {
          valueNode = { type: 'LogicalExpression', operator: base, left: target, right: node.right, resultType: node.resultType };
        } else {
          valueNode = { type: 'BinaryExpression', operator: base, left: target, right: node.right, resultType: target.resultType || node.resultType, bigint: node.bigint, opCodesMethod: node.opCodesMethod };
        }
      }
      return this.store(target, valueNode, statement);
    }

    /** Store an IL value node into an IL target */
    store(target, valueNode, statement) {
      const value = this.expr(valueNode);
      switch (target.type) {
        case 'Identifier': {
          const b = this.lookup(target.name);
          let ref, kind;
          if (b) { ref = this.bindingRef(b); kind = b.env !== undefined ? 'v' : b.kind; }
          else if (this.globals.has(target.name)) { const g = this.globals.get(target.name); ref = g.name; kind = g.kind; }
          else { ref = `g${this.tok}_${fbEscape(target.name)}`; kind = 'v'; this.globals.set(target.name, { name: ref, kind }); }
          const v = kind === 'd' ? this.D(value) : this.V(value);
          if (statement) return `${ref} = ${v}`;
          return kind === 'd' ? this.dx(`js_keepd(${ref}, ${v})`) : this.vx(`js_keep(${ref}, ${v})`);
        }
        case 'ThisPropertyAccess': {
          const self = this.selfRef();
          if (target.computed) {
            const key = this.thisKey(target.property);
            if (statement) return `js_set(${self}, ${key}, ${this.V(value)})`;
            return this.vx(`js_set_r(${self}, ${key}, ${this.V(value)})`);
          }
          const sym = this.sym(target.property);
          if (statement) return `js_setp(${self}, ${sym}, ${this.V(value)})`;
          return this.vx(`js_setp_r(${self}, ${sym}, ${this.V(value)})`);
        }
        case 'MemberExpression': {
          const obj = this.V(this.expr(target.object));
          if (target.computed) {
            const k = this.expr(target.property);
            if (k.k === 'd') {
              if (value.k === 'd' || this.isNumNode(valueNode)) {
                if (statement) return `js_setidxn(${obj}, ${k.c}, ${this.D(value)})`;
                return this.dx(`js_setidxn_r(${obj}, ${k.c}, ${this.D(value)})`);
              }
              if (statement) return `js_setidx(${obj}, ${k.c}, ${this.V(value)})`;
              return this.vx(`js_setidx_r(${obj}, ${k.c}, ${this.V(value)})`);
            }
            if (statement) return `js_set(${obj}, ${this.V(k)}, ${this.V(value)})`;
            return this.vx(`js_set_r(${obj}, ${this.V(k)}, ${this.V(value)})`);
          }
          const sym = this.sym(target.property.name !== undefined ? target.property.name : target.property.value);
          if (statement) return `js_setp(${obj}, ${sym}, ${this.V(value)})`;
          return this.vx(`js_setp_r(${obj}, ${sym}, ${this.V(value)})`);
        }
        case 'ArrayLength': {
          const arr = this.V(this.expr(target.array));
          if (statement) return `js_setp(${arr}, ${this.sym('length')}, ${this.V(value)})`;
          return this.vx(`js_setp_r(${arr}, ${this.sym('length')}, ${this.V(value)})`);
        }
        default:
          if (statement) return `js_unsupported_s(${fbStringExpr('assignment to ' + target.type)})`;
          return this.vx(`js_unsupported(${fbStringExpr('assignment to ' + target.type)})`);
      }
    }

    thisKey(property) {
      if (property && typeof property === 'object') return this.V(this.expr(property));
      if (typeof property === 'number') return `js_num(${fbNumber(property)})`;
      if (typeof property === 'string' && this.lookup(property)) return this.V(this.eIdentifier({ name: property }));
      return this.constStr(String(property));
    }

    eUpdateExpression(node) {
      return this.update(node, false);
    }

    update(node, statement) {
      const delta = node.operator === '++' ? 1 : -1;
      const target = node.argument;
      if (statement) {
        // a value not typed as a Number may be a BigInt, which steps by 1n
        if (!this.isNumNode(target)) return this.store(target, { type: 'FbRaw', code: `js_inc(${this.V(this.expr(target))}, ${delta})`, k: 'v' }, true);
        const one = { type: 'Literal', value: 1, resultType: 'int32' };
        return this.store(target, { type: 'BinaryExpression', operator: delta > 0 ? '+' : '-', left: target, right: one, resultType: target.resultType }, true);
      }
      if (target.type === 'Identifier') {
        const b = this.lookup(target.name);
        const g = !b && this.globals.get(target.name);
        const ref = b ? this.bindingRef(b) : (g ? g.name : null);
        const kind = b ? (b.env !== undefined ? 'v' : b.kind) : (g ? g.kind : 'v');
        if (ref) {
          const fn = kind === 'd' ? (node.prefix ? 'js_preincd' : 'js_postincd') : (node.prefix ? 'js_preincv' : 'js_postincv');
          if (kind === 'd') return this.dx(`${fn}(${ref}, ${delta})`);
          return this.isNumNode(target) ? this.dx(`js_tonum(${fn}(${ref}, ${delta}))`) : this.vx(`${fn}(${ref}, ${delta})`);
        }
      }
      if (target.type === 'MemberExpression' && target.computed) {
        const fn = node.prefix ? 'js_preinci' : 'js_postinci';
        return this.dx(`${fn}(${this.V(this.expr(target.object))}, ${this.V(this.expr(target.property))}, ${delta})`);
      }
      if (target.type === 'MemberExpression' || target.type === 'ThisPropertyAccess') {
        const obj = target.type === 'ThisPropertyAccess' ? this.selfRef() : this.V(this.expr(target.object));
        const name = target.type === 'ThisPropertyAccess' ? target.property : (target.property.name || target.property.value);
        const fn = node.prefix ? 'js_preincp' : 'js_postincp';
        return this.dx(`${fn}(${obj}, ${this.sym(name)}, ${delta})`);
      }
      return this.vx(`js_unsupported("update")`);
    }

    // --- members ---

    eMemberExpression(node) {
      const obj = node.object;
      if (node.computed) {
        const o = this.V(this.expr(obj));
        const k = this.expr(node.property);
        if (k.k === 'd') {
          if (fbIsNum(this.type(node)) && !this.isBigNode(node)) return this.dx(`js_idxn(${o}, ${k.c})`);
          return this.vx(`js_idx(${o}, ${k.c})`);
        }
        return this.vx(`js_get(${o}, ${this.V(k)})`);
      }
      const name = node.property && (node.property.name !== undefined ? node.property.name : String(node.property.value));
      if (obj && obj.type === 'Identifier' && !this.lookup(obj.name) && !this.globals.has(obj.name)) {
        const special = this.globalMember(obj.name, name);
        if (special) return special;
      }
      // .length of an array or string; of anything else (an object with a length field) the property
      if (name === 'length') {
        const ot = this.type(obj);
        if (fbIsArr(ot) || fbIsStr(ot)) return this.dx(`js_length(${this.V(this.expr(obj))})`);
        return this.vx(`js_getp(${this.V(this.expr(obj))}, ${this.sym('length')})`);
      }
      return this.vx(`js_getp(${this.V(this.expr(obj))}, ${this.sym(name)})`);
    }

    globalMember(objName, name) {
      switch (objName) {
        case 'Math':
          if (name === 'PI') return this.dx('3.141592653589793');
          if (name === 'E') return this.dx('2.718281828459045');
          if (name === 'LN2') return this.dx('0.6931471805599453');
          if (name === 'SQRT2') return this.dx('1.4142135623730951');
          return null;
        case 'Number':
          if (name === 'MAX_SAFE_INTEGER') return this.dx('9007199254740991.0');
          if (name === 'MIN_SAFE_INTEGER') return this.dx('(-9007199254740991.0)');
          if (name === 'MAX_VALUE') return this.dx('1.7976931348623157e308');
          if (name === 'EPSILON') return this.dx('2.220446049250313e-16');
          if (name === 'POSITIVE_INFINITY') return this.dx('js_inf');
          if (name === 'NEGATIVE_INFINITY') return this.dx('(-js_inf)');
          if (name === 'NaN') return this.dx('js_nan');
          return null;
        case 'AlgorithmFramework':
          if (FB_FRAMEWORK_CLASSES.has(name)) return this.vx(`CLS_${name}`);
          if (FB_FRAMEWORK_ENUMS.has(name)) return this.vx(`G_${name}`);
          if (name === 'Algorithms') return this.vx('G_Algorithms');
          return null;
        default:
          return null;
      }
    }

    eThisPropertyAccess(node) {
      const self = this.selfRef();
      if (node.computed) {
        const key = typeof node.property === 'string' && this.lookup(node.property) ? this.expr({ type: 'Identifier', name: node.property }) : null;
        if (key && key.k === 'd') {
          if (fbIsNum(this.type(node))) return this.dx(`js_idxn(${self}, ${key.c})`);
          return this.vx(`js_idx(${self}, ${key.c})`);
        }
        return this.vx(`js_get(${self}, ${this.thisKey(node.property)})`);
      }
      return this.vx(`js_getp(${self}, ${this.sym(node.property)})`);
    }

    // --- calls ---

    eCallExpression(node) {
      const callee = node.callee;
      const a = this.args(node.arguments);
      if (!callee) return this.vx('js_undefined()');
      if (callee.type === 'Identifier') return this.callIdentifier(callee.name, node.arguments || [], a);
      if (callee.type === 'MemberExpression' && !callee.computed) {
        const name = callee.property.name !== undefined ? callee.property.name : String(callee.property.value);
        const obj = callee.object;
        if (obj && obj.type === 'Identifier' && !this.lookup(obj.name) && !this.globals.has(obj.name) && !this.classes.has(obj.name)) {
          const special = this.globalCall(obj.name, name, node.arguments || [], a);
          if (special) return special;
        }
        if (obj && obj.type === 'Super') return this.superCall(name, a);
        // String.fromCharCode.apply(null, codes), Math.max.apply(null, xs): a spread call of the builtin
        if (name === 'apply' && obj && obj.type === 'MemberExpression' && !obj.computed && obj.object && obj.object.type === 'Identifier'
          && !this.lookup(obj.object.name) && !this.globals.has(obj.object.name) && !this.classes.has(obj.object.name)) {
          const argNodes = node.arguments || [];
          const list = argNodes[1] ? this.V(this.expr(argNodes[1])) : 'js_arr_new(0)';
          const special = this.globalCall(obj.object.name, obj.property.name, [], { spread: list, list: [] });
          if (special) return special;
        }
        return this.vx(this.callHelper('js_mcall', [this.V(this.expr(obj)), this.sym(name)], a));
      }
      if (callee.type === 'MemberExpression' && callee.computed) {
        return this.vx(this.callHelper('js_kcall', [this.V(this.expr(callee.object)), this.V(this.expr(callee.property))], a));
      }
      if (callee.type === 'ThisPropertyAccess' && !callee.computed) return this.vx(this.callHelper('js_mcall', [this.selfRef(), this.sym(callee.property)], a));
      if (callee.type === 'Super') return this.vx(this.callHelper('js_superctor', [this.parentClassRef(), 'self'], a));
      return this.vx(this.callHelper('js_vcall', [this.V(this.expr(callee))], a));
    }

    callIdentifier(name, argNodes, a) {
      const b = this.lookup(name);
      if (b) return this.vx(this.callHelper('js_vcall', [this.bindingRef(b)], a));
      if (this.globals.has(name)) {
        const g = this.globals.get(name);
        if (g.fn) return this.vx(this.callHelper('js_fcall', [`@${g.fn}`], a));
        return this.vx(this.callHelper('js_vcall', [g.name], a));
      }
      const l = a.list || [];
      switch (name) {
        case 'RegisterAlgorithm': return this.vx(this.callHelper('js_fcall', ['@fw_RegisterAlgorithm'], a));
        case 'Find': return this.vx(this.callHelper('js_fcall', ['@fw_Find'], a));
        case 'SpongePadBlocks': return this.vx(this.callHelper('js_fcall', ['@fw_SpongePadBlocks'], a));
        case 'MerkleDamgardBlocks': return this.vx(this.callHelper('js_fcall', ['@fw_MerkleDamgardBlocks'], a));
        case 'Number': return this.dx(l.length ? `js_tonum(${l[0]})` : '0.0');
        case 'String': return this.vx(l.length ? `js_tostrv(${l[0]})` : this.constStr(''));
        case 'Boolean': return this.bx(l.length ? `js_truthy(${l[0]})` : '0');
        case 'BigInt': return this.vx(`js_tobig(${l[0] || 'js_undefined()'})`);
        case 'parseInt': return this.dx(`js_parse_int(${l[0] || 'js_undefined()'}, ${l[1] || 'js_undefined()'})`);
        case 'parseFloat': return this.dx(`js_parse_float(${l[0] || 'js_undefined()'})`);
        case 'isNaN': return this.bx(`js_isnan(${l[0] || 'js_undefined()'})`);
        case 'isFinite': return this.bx(`js_isfinite(${l[0] || 'js_undefined()'})`);
        case 'Array': return this.vx(`js_array_ctor(${l[0] || 'js_undefined()'})`);
        default: break;
      }
      if (FB_ERRORS.has(name)) return this.vx(`js_error_v(${l[0] || 'js_undefined()'}, ${fbStringExpr(name)})`);
      if (this.classes.has(name)) return this.vx(this.callHelper('js_new', [this.classes.get(name).cvar], a));
      return this.vx(this.callHelper('js_vcall', [`js_global_get(${fbStringExpr(name)})`], a));
    }

    globalCall(objName, name, argNodes, a) {
      const l = a.list || [];
      const d = i => argNodes[i] ? this.D(this.expr(argNodes[i])) : 'js_nan';
      switch (objName) {
        case 'Math':
          switch (name) {
            case 'floor': return this.dx(`js_floor(${d(0)})`);
            case 'ceil': return this.dx(`js_ceil(${d(0)})`);
            case 'round': return this.dx(`js_round(${d(0)})`);
            case 'trunc': return this.dx(`js_trunc(${d(0)})`);
            case 'abs': return this.dx(`Abs(${d(0)})`);
            case 'sign': return this.dx(`js_sign(${d(0)})`);
            case 'sqrt': return this.dx(`js_dsqrt(${d(0)})`);
            case 'cbrt': return this.dx(`cbrt(${d(0)})`);
            case 'pow': return this.dx(`js_dpow(${d(0)}, ${d(1)})`);
            case 'imul': return this.dx(`js_imul(${d(0)}, ${d(1)})`);
            case 'clz32': return this.dx(`js_clz32(${d(0)})`);
            case 'fround': return this.dx(`js_fround(${d(0)})`);
            case 'random': return this.dx('js_random()');
            case 'log': return this.dx(`js_dlog(${d(0)})`);
            case 'log2': return this.dx(`(js_dlog(${d(0)}) / 0.6931471805599453)`);
            case 'log10': return this.dx(`(js_dlog(${d(0)}) / 2.302585092994046)`);
            case 'exp': return this.dx(`Exp(${d(0)})`);
            case 'sin': return this.dx(`Sin(${d(0)})`);
            case 'cos': return this.dx(`Cos(${d(0)})`);
            case 'tan': return this.dx(`Tan(${d(0)})`);
            case 'atan': return this.dx(`Atn(${d(0)})`);
            case 'atan2': return this.dx(`atan2(${d(0)}, ${d(1)})`);
            case 'min': case 'max': {
              if (a.spread) return this.dx(`js_${name}_arr(${a.spread})`);
              if (!argNodes.length) return this.dx(name === 'min' ? 'js_inf' : '(-js_inf)');
              return this.dx(argNodes.map((_, i) => d(i)).reduce((x, y) => `js_d${name}(${x}, ${y})`));
            }
            default: return null;
          }
        case 'String':
          if (name === 'fromCharCode') {
            if (a.spread) return this.vx(`js_from_char_codes(${a.spread})`);
            return this.vx(`js_str(${argNodes.map((_, i) => `js_fromcharcode(${d(i)})`).join(' & ') || '""'})`);
          }
          return null;
        case 'ArrayBuffer':
          if (name === 'isView') return this.bx(`js_is_view(${l[0] || 'js_undefined()'})`);
          return null;
        case 'Date':
          if (name === 'now') return this.dx('js_date_now()');
          return null;
        case 'Array':
          if (name === 'isArray') return this.bx(`js_is_arr(${l[0]})`);
          if (name === 'from') return this.vx(`js_array_from(${l[0]}, ${l[1] || 'js_undefined()'})`);
          return null;
        case 'Object':
          if (name === 'keys') return this.vx(`js_keys(${l[0]})`);
          if (name === 'values') return this.vx(`js_values(${l[0]})`);
          if (name === 'entries') return this.vx(`js_entries(${l[0]})`);
          if (name === 'freeze' || name === 'seal') return this.vx(l[0]);
          if (name === 'assign') return this.vx(l.slice(1).reduce((acc, s) => `js_assign(${acc}, ${s})`, l[0]));
          return null;
        case 'Number':
          if (name === 'isInteger') return this.bx(`js_isinteger(${l[0]})`);
          if (name === 'isSafeInteger') return this.bx(`js_isinteger(${l[0]})`);
          if (name === 'isFinite') return this.bx(`js_isfinite(${l[0]})`);
          if (name === 'isNaN') return this.bx(`(js_tonum(${l[0]}) <> js_tonum(${l[0]}))`);
          if (name === 'parseInt') return this.dx(`js_parse_int(${l[0]}, ${l[1] || 'js_undefined()'})`);
          return null;
        case 'BigInt':
          if (name === 'asUintN') return this.vx(`js_big_asuintn(${d(0)}, js_tobig(${l[1]}))`);
          if (name === 'asIntN') return this.vx(`js_big_asintn(${d(0)}, js_tobig(${l[1]}))`);
          return null;
        case 'OpCodes':
          return this.vx(this.callHelper('js_fcall', [`@oc_${name}`], a));
        case 'AlgorithmFramework':
          if (name === 'Find') return this.vx(this.callHelper('js_fcall', ['@fw_Find'], a));
          if (name === 'RegisterAlgorithm') return this.vx(this.callHelper('js_fcall', ['@fw_RegisterAlgorithm'], a));
          return null;
        case 'console':
          return this.vx('js_undefined()');
        case 'JSON':
          return this.vx(`js_unsupported("JSON")`);
        default:
          return null;
      }
    }

    parentClassRef() {
      const info = this.fn.classInfo;
      if (!info || !info.superName) return 'js_undefined()';
      return this.classRef(info.superName);
    }

    classRef(name) {
      if (this.classes.has(name)) return this.classes.get(name).cvar;
      if (FB_FRAMEWORK_CLASSES.has(name)) return `CLS_${name}`;
      if (this.globals.has(name)) return this.globals.get(name).name;
      if (FB_ERRORS.has(name)) return 'CLS_Error';
      return 'js_undefined()';
    }

    superCall(name, a) {
      return this.vx(this.callHelper('js_supercall', [this.parentClassRef(), this.sym(name), this.selfRef()], a));
    }

    eParentConstructorCall(node) {
      return this.vx(this.callHelper('js_superctor', [this.parentClassRef(), 'self'], this.args(node.arguments)));
    }

    eParentMethodCall(node) {
      return this.superCall(node.method, this.args(node.arguments));
    }

    eThisMethodCall(node) {
      return this.vx(this.callHelper('js_mcall', [this.selfRef(), this.sym(node.method)], this.args(node.arguments)));
    }

    eNewExpression(node) {
      const callee = node.callee;
      const a = this.args(node.arguments);
      const l = a.list || [];
      if (callee && callee.type === 'Identifier' && !this.lookup(callee.name) && !this.globals.has(callee.name)) {
        const name = callee.name;
        if (FB_TYPED[name]) return this.vx(l.length > 1 ? `js_typed_view(${FB_TYPED[name]}, ${l[0]}, ${l[1]}, ${l[2] || 'js_undefined()'})` : `js_typed_from(${FB_TYPED[name]}, ${l[0] || 'js_num(0)'})`);
        if (FB_ERRORS.has(name)) return this.vx(`js_error_v(${l[0] || 'js_undefined()'}, ${fbStringExpr(name)})`);
        switch (name) {
          case 'Map': return this.vx(`js_map_from(${l[0] || 'js_undefined()'}, 0)`);
          case 'Set': return this.vx(`js_map_from(${l[0] || 'js_undefined()'}, -1)`);
          case 'Array': return this.vx(`js_array_ctor(${l[0] || 'js_undefined()'})`);
          case 'Object': return this.vx('js_obj_new()');
          case 'ArrayBuffer': return this.vx(`js_buffer_new(CLng(js_tonum(${l[0] || 'js_num(0)'})))`);
          case 'DataView': return this.vx(`js_dataview_new(${l[0]}, ${l[1] || 'js_undefined()'}, ${l[2] || 'js_undefined()'})`);
          default: break;
        }
      }
      return this.vx(this.callHelper('js_new', [this.V(this.expr(callee))], a));
    }

    eErrorCreation(node) {
      return this.vx(`js_error_v(${node.message ? this.V(this.expr(node.message)) : 'js_undefined()'}, ${fbStringExpr(node.errorType || 'Error')})`);
    }

    // --- functions, objects, arrays ---

    eFunctionExpression(node) { return this.vx(this.closure(node)); }
    eArrowFunctionExpression(node) { return this.vx(this.closure(node)); }
    eArrowFunction(node) { return this.vx(this.closure(node)); }

    eArrayExpression(node) {
      const els = node.elements || [];
      if (!els.some(e => e && e.type === 'SpreadElement')) {
        if (els.length === 0) return this.vx('js_arr_new(0)');
        // numbers in one go
        if (els.every(e => e && e.type === 'Literal' && typeof e.value === 'number') && els.length > 4)
          return this.vx(`js_arr_nums(${fbStringExpr(els.map(e => String(e.value)).join(','))})`);
        // elements with effects run in order first (FreeBASIC evaluates arguments right to left)
        const a = this.args(els.map(e => e || { type: 'Identifier', name: 'undefined' }));
        const base = a.seq && a.seq.length ? `js_withv(${a.seq.join(' + ')}, js_arr_new(0))` : 'js_arr_new(0)';
        return this.vx(a.list.reduce((acc, x) => `js_arr_push_r(${acc}, ${x})`, base));
      }
      let acc = 'js_arr_new(0)';
      for (const e of els) {
        if (e && e.type === 'SpreadElement') acc = `js_spread_into(${acc}, ${this.V(this.expr(e.argument))})`;
        else acc = `js_arr_push_r(${acc}, ${e ? this.V(this.expr(e)) : 'js_undefined()'})`;
      }
      return this.vx(acc);
    }

    eArrayLiteral(node) { return this.eArrayExpression(node); }

    eObjectLiteral(node) {
      let acc = 'js_obj_new()';
      for (const p of node.properties || []) {
        if (p.type === 'ObjectSpread' || p.type === 'SpreadElement') { acc = `js_assign(${acc}, ${this.V(this.expr(p.argument))})`; continue; }
        const keyName = typeof p.key === 'object' && p.key ? (p.key.name !== undefined ? p.key.name : p.key.value) : p.key;
        if (p.computed && typeof p.key === 'object') acc = `js_set_r2(${acc}, ${this.V(this.expr(p.key))}, ${this.V(this.expr(p.value))})`;
        else acc = `js_setp_r2(${acc}, ${this.sym(String(keyName))}, ${this.V(this.expr(p.value))})`;
      }
      return this.vx(acc);
    }

    eObjectExpression(node) {
      return this.eObjectLiteral({ properties: (node.properties || []).map(p => p.type === 'Property' ? { key: p.computed ? p.key : (p.key.name !== undefined ? p.key.name : p.key.value), computed: p.computed, value: p.value } : p) });
    }

    eSpreadElement(node) { return this.expr(node.argument); }

    eTemplateLiteral(node) {
      let acc = null;
      (node.quasis || []).forEach((q, i) => {
        const text = q.value ? (q.value.cooked !== undefined ? q.value.cooked : q.value.raw) : '';
        if (text) acc = acc ? `js_concat(${acc}, ${this.constStr(text)})` : this.constStr(text);
        if (i < (node.expressions || []).length) {
          const e = this.V(this.expr(node.expressions[i]));
          acc = acc ? `js_concat(${acc}, ${e})` : `js_tostrv(${e})`;
        }
      });
      return this.vx(acc || this.constStr(''));
    }

    eStringInterpolation(node) {
      let acc = this.constStr('');
      for (const p of node.parts || []) acc = `js_concat(${acc}, ${p.type === 'StringPart' ? this.constStr(p.value) : this.V(this.expr(p.expression))})`;
      return this.vx(acc);
    }

    // --- IL nodes ---

    eArrayLength(node) {
      // the IL also makes x.length an ArrayLength when x is an object with a length field
      const t = this.type(node.array);
      if (fbIsArr(t) || fbIsStr(t)) return this.dx(`js_length(${this.V(this.expr(node.array))})`);
      return this.vx(`js_getp(${this.V(this.expr(node.array))}, ${this.sym('length')})`);
    }

    eArrayAppend(node) {
      const values = node.values || (node.value ? [node.value] : []);
      if (values.length === 1 && values[0].type !== 'SpreadElement') {
        const v = this.expr(values[0]);
        if (v.k === 'd') return this.dx(`js_pushn(${this.V(this.expr(node.array))}, ${v.c})`);
        return this.dx(`js_push1(${this.V(this.expr(node.array))}, ${this.V(v)})`);
      }
      return this.dx(`js_tonum(${this.callHelper('js_mcall', [this.V(this.expr(node.array)), this.sym('push')], this.args(values))})`);
    }

    eArrayPush(node) { return this.eArrayAppend(node); }
    eArrayPop(node) { return this.vx(`js_mcall0(${this.V(this.expr(node.array))}, ${this.sym('pop')})`); }
    eArrayShift(node) { return this.vx(`js_mcall0(${this.V(this.expr(node.array))}, ${this.sym('shift')})`); }
    eArrayUnshift(node) {
      const values = node.values || (node.value ? [node.value] : []);
      return this.vx(this.callHelper('js_mcall', [this.V(this.expr(node.array)), this.sym('unshift')], this.args(values)));
    }

    eArraySlice(node) {
      return this.vx(`js_slice_arr(${this.V(this.expr(node.array))}, ${node.start ? this.V(this.expr(node.start)) : 'js_undefined()'}, ${node.end ? this.V(this.expr(node.end)) : 'js_undefined()'})`);
    }

    eArraySplice(node) {
      const items = [node.start || { type: 'Literal', value: 0 }];
      if (node.deleteCount) items.push(node.deleteCount);
      items.push(...(node.items || []));
      return this.vx(this.callHelper('js_mcall', [this.V(this.expr(node.array)), this.sym('splice')], this.args(items)));
    }

    eArrayFill(node) {
      const arr = node.array;
      if (arr && arr.type === 'ArrayCreation' && arr.size && !node.start && !node.end)
        return this.vx(`js_arr_fillnew(CLng(${this.D(this.expr(arr.size))}), ${this.V(this.expr(node.value))})`);
      const items = [node.value];
      if (node.start) items.push(node.start);
      if (node.end) items.push(node.end);
      return this.vx(this.callHelper('js_mcall', [this.V(this.expr(arr)), this.sym('fill')], this.args(items)));
    }

    eArrayCreation(node) {
      if (!node.size) return this.vx('js_arr_new(0)');
      const elem = fbTypeName(node.elementType || node.contextType || node.resultType).replace(/\[\]$/, '');
      const numeric = fbIsNum(elem) || fbIsInt(elem);
      if (numeric) return this.vx(`js_arr_fillnew(CLng(${this.D(this.expr(node.size))}), js_num(0))`);
      return this.vx(`js_array_ctor(${this.V(this.expr(node.size))})`);
    }

    eTypedArrayCreation(node) {
      const ek = FB_TYPED[node.arrayType] || 'JS_E_U8';
      if (node.buffer) return this.vx(`js_typed_view(${ek}, ${this.V(this.expr(node.buffer))}, ${node.byteOffset ? this.V(this.expr(node.byteOffset)) : 'js_undefined()'}, ${node.length ? this.V(this.expr(node.length)) : 'js_undefined()'})`);
      return this.vx(`js_typed_from(${ek}, ${node.size ? this.V(this.expr(node.size)) : 'js_num(0)'})`);
    }

    eBufferCreation(node) { return this.vx(`js_buffer_new(CLng(${node.size ? this.D(this.expr(node.size)) : '0'}))`); }
    eDataViewCreation(node) {
      return this.vx(`js_dataview_new(${this.V(this.expr(node.buffer))}, ${node.byteOffset ? this.V(this.expr(node.byteOffset)) : 'js_undefined()'}, ${node.byteLength ? this.V(this.expr(node.byteLength)) : 'js_undefined()'})`);
    }

    dvKind(method) {
      const m = /(get|set)(Big)?(Uint|Int|Float)(\d+)/.exec(method || '');
      if (!m) return 'JS_E_U8';
      const [, , big, kind, bits] = m;
      if (big) return kind === 'Uint' ? 'JS_E_U64' : 'JS_E_I64';
      if (kind === 'Float') return bits === '32' ? 'JS_E_F32' : 'JS_E_F64';
      return { Uint8: 'JS_E_U8', Int8: 'JS_E_I8', Uint16: 'JS_E_U16', Int16: 'JS_E_I16', Uint32: 'JS_E_U32', Int32: 'JS_E_I32' }[kind + bits] || 'JS_E_U8';
    }

    eDataViewRead(node) {
      const r = `js_dv_get(${this.V(this.expr(node.view))}, ${this.dvKind(node.method)}, ${this.D(this.expr(node.offset))}, ${node.littleEndian ? this.B(this.expr(node.littleEndian)) : '0'})`;
      return /Big/.test(node.method) ? this.vx(r) : this.dx(`js_tonum(${r})`);
    }

    eDataViewWrite(node) {
      return this.vx(`js_dv_set_r(${this.V(this.expr(node.view))}, ${this.dvKind(node.method)}, ${this.D(this.expr(node.offset))}, ${this.V(this.expr(node.value))}, ${node.littleEndian ? this.B(this.expr(node.littleEndian)) : '0'})`);
    }

    eDataViewGetByteLength(node) { return this.vx(`js_getp(${this.V(this.expr(node.view))}, ${this.sym('byteLength')})`); }

    eTypedArraySet(node) {
      const items = [node.source];
      if (node.offset) items.push(node.offset);
      return this.vx(this.callHelper('js_mcall', [this.V(this.expr(node.array)), this.sym('set')], this.args(items)));
    }

    eTypedArraySubarray(node) {
      return this.vx(`js_subarray(${this.V(this.expr(node.array))}, ${node.begin ? this.D(this.expr(node.begin)) : '0'}, ${node.end ? this.D(this.expr(node.end)) : '0'}, ${node.end ? '-1' : '0'})`);
    }

    eArrayFrom(node) {
      const r = `js_array_from(${this.V(this.expr(node.iterable))}, ${node.mapFunction ? this.V(this.expr(node.mapFunction)) : 'js_undefined()'})`;
      if (node.arrayType && FB_TYPED[node.arrayType]) return this.vx(`js_typed_from(${FB_TYPED[node.arrayType]}, ${r})`);
      return this.vx(r);
    }

    eArrayConcat(node) { return this.vx(this.callHelper('js_mcall', [this.V(this.expr(node.array)), this.sym('concat')], this.args(node.arrays || []))); }

    methodOn(node, arrNode, method, argNodes) {
      return this.vx(this.callHelper('js_mcall', [this.V(this.expr(arrNode)), this.sym(method)], this.args(argNodes.filter(Boolean))));
    }

    eArrayIndexOf(node) { return this.dx(`js_tonum(${this.methodOn(node, node.array, 'indexOf', [node.value, node.start]).c})`); }
    eArrayIncludes(node) { return this.bx(`js_truthy(${this.methodOn(node, node.array, 'includes', [node.value]).c})`); }
    eArrayJoin(node) { return this.methodOn(node, node.array, 'join', [node.separator]); }
    eArrayReverse(node) { return this.methodOn(node, node.array, 'reverse', []); }
    eArraySort(node) { return this.methodOn(node, node.array, 'sort', [node.compareFn]); }
    eArrayMap(node) { return this.methodOn(node, node.array, 'map', [node.callback]); }
    eArrayFilter(node) { return this.methodOn(node, node.array, 'filter', [node.callback]); }
    eArrayForEach(node) { return this.methodOn(node, node.array, 'forEach', [node.callback]); }
    eArraySome(node) { return this.bx(`js_truthy(${this.methodOn(node, node.array, 'some', [node.callback]).c})`); }
    eArrayEvery(node) { return this.bx(`js_truthy(${this.methodOn(node, node.array, 'every', [node.callback]).c})`); }
    eArrayFind(node) { return this.methodOn(node, node.array, 'find', [node.callback]); }
    eArrayFindIndex(node) { return this.dx(`js_tonum(${this.methodOn(node, node.array, 'findIndex', [node.callback]).c})`); }
    eArrayReduce(node) { return this.methodOn(node, node.array, 'reduce', [node.callback, node.initialValue]); }

    eArrayXor(node) { return this.vx(this.callHelper('js_fcall', ['@oc_XorArrays'], this.args(node.arguments))); }
    eArrayClear(node) { return this.vx(this.callHelper('js_fcall', ['@oc_ClearArray'], this.args(node.arguments))); }
    eIsArrayCheck(node) { return this.bx(`js_is_arr(${this.V(this.expr(node.value))})`); }
    eIsIntegerCheck(node) { return this.bx(`js_isinteger(${this.V(this.expr(node.value))})`); }
    eIsNaNCheck(node) { return this.bx(`js_isnan(${this.V(this.expr(node.value))})`); }
    eIsFiniteCheck(node) { return this.bx(`js_isfinite(${this.V(this.expr(node.value))})`); }
    eObjectFreeze(node) { return this.expr(node.object); }
    eObjectSeal(node) { return this.expr(node.object); }
    eMapCreation(node) { return this.vx(`js_map_from(${node.entries ? this.V(this.expr(node.entries)) : 'js_undefined()'}, 0)`); }
    eSetCreation(node) { return this.vx(`js_map_from(${node.values ? this.V(this.expr(node.values)) : 'js_undefined()'}, -1)`); }
    eObjectFromEntries(node) { return this.vx(`js_obj_from_entries(${this.V(this.expr(node.entries))})`); }

    eHexDecode(node) {
      const a = (node.arguments || [])[0];
      if (a && a.type === 'Literal' && typeof a.value === 'string' && /^([0-9a-fA-F]{2})*$/.test(a.value)) {
        const key = 'h:' + a.value;
        if (!this.consts.has(key)) this.consts.set(key, { name: `q${this.tok}_${this.consts.size}`, init: `js_hex_bytes(${fbStringExpr(a.value)})` });
        return this.vx(`js_arr_copy(${this.consts.get(key).name})`);
      }
      return this.vx(this.callHelper('js_fcall', ['@oc_Hex8ToBytes'], this.args(node.arguments)));
    }

    eStringToBytes(node) {
      const m = node.opCodesMethod || 'AnsiToBytes';
      return this.vx(this.callHelper('js_fcall', [`@oc_${m}`], this.args(node.arguments)));
    }

    eBytesToString(node) {
      return this.vx(this.callHelper('js_fcall', [`@oc_${node.opCodesMethod || 'BytesToAnsi'}`], this.args(node.arguments)));
    }

    eOpCodesCall(node) {
      return this.vx(this.callHelper('js_fcall', [`@oc_${node.method || node.opCodesMethod}`], this.args(node.arguments)));
    }

    ePackBytes(node) {
      const args = node.arguments || [];
      const bits = node.bits || 32;
      const n = bits / 8;
      const big = node.endian === 'big';
      if (args.some(a => a && a.type === 'SpreadElement') || bits > 32) {
        return this.dx(`js_tonum(${this.callHelper('js_fcall', [`@oc_Pack${bits}${big ? 'BE' : 'LE'}`], this.args(args))})`);
      }
      const parts = [];
      for (let i = 0; i < n; ++i) {
        const b = args[i] ? this.D(this.expr(args[i])) : '0';
        const shift = big ? (n - 1 - i) * 8 : i * 8;
        parts.push(`(CULng(js_tou32(${b}) And 255) Shl ${shift})`);
      }
      return this.dx(`CDbl(${parts.join(' Or ')})`);
    }

    eUnpackBytes(node) {
      const bits = node.bits || 32;
      const big = node.endian === 'big';
      return this.vx(`js_unpack(${this.D(this.expr((node.arguments || [])[0]))}, ${bits}, ${big ? -1 : 0})`);
    }

    eRotateLeft(node) { return this.rotation(node, true); }
    eRotateRight(node) { return this.rotation(node, false); }

    rotation(node, left) {
      const bits = node.bits || 32;
      const value = node.value || (node.arguments && node.arguments[0]);
      const amount = node.amount || (node.arguments && node.arguments[1]);
      if (bits === 64) return this.vx(this.callHelper('js_fcall', [left ? '@oc_RotL64n' : '@oc_RotR64n'], this.args([value, amount])));
      const v = this.D(this.expr(value)), n = this.D(this.expr(amount));
      if (bits === 32) return this.dx(`${left ? 'js_rotl32' : 'js_rotr32'}(${v}, ${n})`);
      return this.dx(`${left ? 'js_rotln' : 'js_rotrn'}(${v}, ${n}, ${bits})`);
    }

    eCast(node) {
      const target = fbTypeName(node.targetType || node.resultType);
      const arg = (node.arguments || [])[0] || node.argument;
      if (!arg) return this.vx('js_undefined()');
      if (fbIsBig(target) || target === 'uint64' && node.opCodesMethod === 'ToQWord') return this.vx(`js_big_asuintn(64, js_tobig(${this.V(this.expr(arg))}))`);
      if (target === 'int') return this.dx(`CDbl(js_toi32(${this.D(this.expr(arg))}))`);
      if (fbIsInt(target)) {
        const [bits, signed] = FB_INT[target];
        const d = this.D(this.expr(arg));
        if (bits === 32) return this.dx(signed ? `CDbl(js_toi32(${d}))` : `CDbl(js_tou32(${d}))`);
        if (bits < 32) {
          const mask = (2 ** bits) - 1;
          if (!signed) return this.dx(`CDbl(js_tou32(${d}) And ${mask})`);
          return this.dx(`js_wrap_signed(${d}, ${bits})`);
        }
        return this.dx(d);
      }
      if (fbIsStr(target)) return this.vx(`js_tostrv(${this.V(this.expr(arg))})`);
      if (fbIsBool(target)) return this.bx(this.B(this.expr(arg)));
      return this.expr(arg);
    }

    eBigIntCast(node) {
      const arg = node.argument || (node.arguments || [])[0];
      const e = this.expr(arg);
      if (e.k === 'd') return this.vx(`js_big_from_double(${e.c})`);
      return this.vx(`js_tobig(${this.V(e)})`);
    }

    eFloor(node) { return this.dx(`js_floor(${this.D(this.expr(node.argument || node.arguments[0]))})`); }
    eCeil(node) { return this.dx(`js_ceil(${this.D(this.expr(node.argument || node.arguments[0]))})`); }
    eTruncate(node) { return this.dx(`js_trunc(${this.D(this.expr(node.argument || node.arguments[0]))})`); }
    eTrunc(node) { return this.eTruncate(node); }
    eRound(node) { return this.dx(`js_round(${this.D(this.expr(node.argument || node.arguments[0]))})`); }
    eAbs(node) { return this.dx(`Abs(${this.D(this.expr(node.argument || node.arguments[0]))})`); }
    eSign(node) { return this.dx(`js_sign(${this.D(this.expr(node.argument || node.arguments[0]))})`); }
    eSqrt(node) { return this.dx(`js_dsqrt(${this.D(this.expr(node.argument || node.arguments[0]))})`); }
    eLog(node) { return this.dx(`js_dlog(${this.D(this.expr(node.argument))})`); }
    eLog2(node) { return this.dx(`(js_dlog(${this.D(this.expr(node.argument))}) / 0.6931471805599453)`); }
    eExp(node) { return this.dx(`Exp(${this.D(this.expr(node.argument))})`); }
    eSin(node) { return this.dx(`Sin(${this.D(this.expr(node.argument))})`); }
    eCos(node) { return this.dx(`Cos(${this.D(this.expr(node.argument))})`); }
    eTanh(node) { return this.dx(`tanh(${this.D(this.expr(node.argument))})`); }
    eFround(node) { return this.dx(`js_fround(${this.D(this.expr(node.argument))})`); }
    eRandom() { return this.dx('js_random()'); }
    eMin(node) { return this.minMax(node, 'min'); }
    eMax(node) { return this.minMax(node, 'max'); }

    minMax(node, which) {
      const args = node.arguments || [];
      if (!args.length) return this.dx(which === 'min' ? 'js_inf' : '(-js_inf)');
      if (args.some(a => a.type === 'SpreadElement')) return this.dx(`js_${which}_arr(${this.args(args).spread})`);
      return this.dx(args.map(a => this.D(this.expr(a))).reduce((x, y) => `js_d${which}(${x}, ${y})`));
    }

    ePower(node) {
      if (this.isBigNode(node.base) || this.isBigNode(node.exponent)) return this.vx(`js_pow(${this.V(this.bigOperand(node.base))}, ${this.V(this.bigOperand(node.exponent))})`);
      return this.dx(`js_dpow(${this.D(this.expr(node.base))}, ${this.D(this.expr(node.exponent))})`);
    }

    eMathCall(node) {
      const a = node.arguments || [];
      if (node.method === 'imul') return this.dx(`js_imul(${this.D(this.expr(a[0]))}, ${this.D(this.expr(a[1]))})`);
      return this.globalCall('Math', node.method, a, this.args(a)) || this.vx(`js_unsupported("Math.${node.method}")`);
    }

    eMathConstant(node) { return this.dx(fbNumber(node.value)); }
    eNumberConstant(node) { return this.globalMember('Number', node.name) || this.dx(fbNumber(node.value)); }
    eCountLeadingZeros(node) { return this.dx(`js_clz32(${this.D(this.expr(node.argument))})`); }

    eStringCharAt(node) { return this.vx(`js_charat(${this.V(this.expr(node.string))}, ${node.index ? this.D(this.expr(node.index)) : '0'})`); }
    eStringCharCodeAt(node) { return this.dx(`js_charcode(${this.V(this.expr(node.string))}, ${node.index ? this.D(this.expr(node.index)) : '0'})`); }
    eStringFromCharCodes(node) {
      const a = this.args(node.charCodes || []);
      if (a.spread) return this.vx(`js_from_char_codes(${a.spread})`);
      return this.vx(`js_str(${(node.charCodes || []).map(c => `js_fromcharcode(${this.D(this.expr(c))})`).join(' & ') || '""'})`);
    }

    eStringSubstring(node) {
      const s = this.V(this.expr(node.string));
      if (node.length) return this.vx(`js_mcall2(${s}, ${this.sym('substr')}, ${node.start ? this.V(this.expr(node.start)) : 'js_num(0)'}, ${this.V(this.expr(node.length))})`);
      const neg = n => n && ((n.type === 'UnaryExpression' && n.operator === '-') || (n.type === 'Literal' && n.value < 0));
      const method = neg(node.start) || neg(node.end) ? 'slice' : 'substring';
      return this.vx(`js_mcall2(${s}, ${this.sym(method)}, ${node.start ? this.V(this.expr(node.start)) : 'js_num(0)'}, ${node.end ? this.V(this.expr(node.end)) : 'js_undefined()'})`);
    }

    eStringTransform(node) { return this.vx(`js_mcall0(${this.V(this.expr(node.string))}, ${this.sym(node.method === 'trimStart' || node.method === 'trimEnd' ? 'trim' : node.method)})`); }
    eStringRepeat(node) { return this.vx(`js_mcall1(${this.V(this.expr(node.string))}, ${this.sym('repeat')}, ${this.V(this.expr(node.count))})`); }
    eStringReplace(node) {
      return this.vx(`js_mcall2(${this.V(this.expr(node.string))}, ${this.sym(node.method === 'replaceAll' ? 'replaceAll' : 'replace')}, ${this.V(this.expr(node.searchValue))}, ${this.V(this.expr(node.replaceValue))})`);
    }
    eStringIndexOf(node) {
      return this.dx(`js_tonum(${this.callHelper('js_mcall', [this.V(this.expr(node.string)), this.sym(node.method || 'indexOf')], this.args([node.searchValue, node.fromIndex].filter(Boolean)))})`);
    }
    eStringIncludes(node) { return this.bx(`js_truthy(js_mcall1(${this.V(this.expr(node.string))}, ${this.sym(node.method || 'includes')}, ${this.V(this.expr(node.searchValue))}))`); }
    eStringSplit(node) { return this.vx(`js_mcall1(${this.V(this.expr(node.string))}, ${this.sym('split')}, ${node.separator ? this.V(this.expr(node.separator)) : 'js_undefined()'})`); }
    eStringPad(node) {
      return this.vx(`js_mcall2(${this.V(this.expr(node.string))}, ${this.sym(node.method)}, ${this.V(this.expr(node.targetLength))}, ${node.padString ? this.V(this.expr(node.padString)) : 'js_undefined()'})`);
    }
    eStringConcat(node) {
      return this.vx((node.values || []).reduce((acc, v) => `js_concat(${acc}, ${this.V(this.expr(v))})`, this.V(this.expr(node.string))));
    }

    eDebugOutput() { return this.vx('js_undefined()'); }

    /** FreeBASIC code the generator built itself (a synthetic node) */
    eFbRaw(node) { return { c: node.code, k: node.k }; }

    // ------------------------------------------------------------------
    // statements
    // ------------------------------------------------------------------

    statement(node, out) {
      if (!node) return;
      switch (node.type) {
        case 'EmptyStatement': return;
        case 'BlockStatement':
          this.fn.scopes.push(new Map());
          this.hoistFunctions(node.body || [], out);
          for (const s of node.body || []) if (!s || s.type !== 'FunctionDeclaration') this.statement(s, out);
          this.fn.scopes.pop();
          return;
        case 'ExpressionStatement':
          this.expressionStatement(node.expression, out);
          return;
        case 'VariableDeclaration':
          for (const d of node.declarations || []) this.declarator(d, node.kind, out);
          return;
        case 'FunctionDeclaration': {
          const b = this.lookup(node.id.name) || this.declareLocal(node.id.name, 'v');
          out.push(`${this.bindingRef(b)} = ${this.closure(node)}`);
          return;
        }
        case 'ClassDeclaration':
          out.push(...this.classDeclaration(node));
          return;
        case 'ReturnStatement': {
          const v = node.argument ? this.V(this.expr(node.argument)) : 'js_undefined()';
          if (this.fn.tryDepth > 0) {
            const t = this.temp('v');
            out.push(`${t} = ${v}`, `js_jmp_top -= ${this.fn.tryDepth}`, `Return ${t}`);
          } else if (this.fn.kind === 'ctor') {
            out.push('Return self');
          } else out.push(`Return ${v}`);
          return;
        }
        case 'IfStatement': {
          out.push(`If ${this.B(this.expr(node.test))} Then`);
          this.blockInto(node.consequent, out);
          let alt = node.alternate;
          while (alt && alt.type === 'IfStatement') {
            out.push(`ElseIf ${this.B(this.expr(alt.test))} Then`);
            this.blockInto(alt.consequent, out);
            alt = alt.alternate;
          }
          if (alt) {
            out.push('Else');
            this.blockInto(alt, out);
          }
          out.push('End If');
          return;
        }
        case 'ForStatement': {
          this.fn.scopes.push(new Map());
          if (node.init) {
            if (node.init.type === 'VariableDeclaration') this.statement(node.init, out);
            else this.expressionStatement(node.init, out);
          }
          const update = [];
          if (node.update) this.expressionStatement(node.update, update);
          out.push(`Do While ${node.test ? this.B(this.expr(node.test)) : '-1'}`);
          this.fn.loops.push({ update });
          this.blockInto(node.body, out);
          this.fn.loops.pop();
          out.push(...this.indent(update));
          out.push('Loop');
          this.fn.scopes.pop();
          return;
        }
        case 'WhileStatement':
          out.push(`Do While ${this.B(this.expr(node.test))}`);
          this.fn.loops.push({ update: [] });
          this.blockInto(node.body, out);
          this.fn.loops.pop();
          out.push('Loop');
          return;
        case 'DoWhileStatement':
          out.push('Do');
          this.fn.loops.push({ update: [] });
          this.blockInto(node.body, out);
          this.fn.loops.pop();
          out.push(`Loop While ${this.B(this.expr(node.test))}`);
          return;
        case 'ForOfStatement':
        case 'ForInStatement': {
          this.fn.scopes.push(new Map());
          const it = this.temp('v');
          const k = this.temp('d');
          const src = this.V(this.expr(node.right));
          out.push(`${it} = ${node.type === 'ForInStatement' ? `js_keys(${src})` : `js_iter(${src})`}`);
          out.push(`${k} = 0`);
          out.push(`Do While ${k} < js_length(${it})`);
          const left = node.left;
          const inner = [];
          const elem = `js_idx(${it}, ${k})`;
          if (left && left.type === 'VariableDeclaration') {
            const id = left.declarations[0].id;
            if (id.type === 'Identifier') {
              const b = this.declareLocal(id.name, 'v');
              inner.push(`${this.bindingRef(b)} = ${elem}`);
            } else inner.push(...this.destructure(id, elem, left.kind));
          } else if (left) {
            inner.push(this.storeRaw(left, this.vx(elem)));
          }
          inner.push(`${k} += 1`);
          out.push(...this.indent(inner));
          this.fn.loops.push({ update: [] });
          this.blockInto(node.body, out);
          this.fn.loops.pop();
          out.push('Loop');
          this.fn.scopes.pop();
          return;
        }
        case 'BreakStatement': {
          const ctx = this.fn.loops[this.fn.loops.length - 1];
          out.push(ctx && ctx.isSwitch ? 'Exit Select' : 'Exit Do');
          return;
        }
        case 'ContinueStatement': {
          let i = this.fn.loops.length - 1;
          while (i >= 0 && this.fn.loops[i].isSwitch) i--;
          const loop = this.fn.loops[i];
          if (loop) out.push(...loop.update);
          out.push('Continue Do');
          return;
        }
        case 'ThrowStatement':
          out.push(`js_throw(${this.V(this.expr(node.argument))})`);
          return;
        case 'TryStatement':
          this.tryStatement(node, out);
          return;
        case 'SwitchStatement':
          this.switchStatement(node, out);
          return;
        default:
          if (node.resultType !== undefined || /Expression$|Call$/.test(node.type)) {
            this.expressionStatement(node, out);
            return;
          }
          out.push(`js_unsupported_s(${fbStringExpr('statement ' + node.type)})`);
      }
    }

    blockInto(node, out) {
      if (!node) return;
      const inner = [];
      this.fn.scopes.push(new Map());
      if (node.type === 'BlockStatement') {
        this.hoistFunctions(node.body || [], inner);
        for (const s of node.body || []) if (!s || s.type !== 'FunctionDeclaration') this.statement(s, inner);
      } else this.statement(node, inner);
      this.fn.scopes.pop();
      out.push(...this.indent(inner));
    }

    expressionStatement(e, out) {
      if (!e) return;
      switch (e.type) {
        case 'AssignmentExpression':
          if (['ArrayPattern', 'ObjectPattern', 'ArrayExpression'].includes(e.left.type)) {
            const t = this.temp('v');
            out.push(`${t} = ${this.V(this.expr(e.right))}`);
            out.push(...this.destructure(this.asPattern(e.left), t, null));
            return;
          }
          out.push(this.assignment(e, true));
          return;
        case 'UpdateExpression':
          out.push(this.update(e, true));
          return;
        case 'UnaryExpression':
          if (e.operator === '++' || e.operator === '--') {
            out.push(this.update({ operator: e.operator, prefix: true, argument: e.argument }, true));
            return;
          }
          break;
        case 'SequenceExpression':
          for (const x of e.expressions || []) this.expressionStatement(x, out);
          return;
        case 'Literal': case 'Identifier':
          return;
        case 'LogicalExpression':
          if (e.operator === '&&' || e.operator === '||') {
            out.push(`If ${e.operator === '&&' ? '' : 'js_not '}(${this.B(this.expr(e.left))}) Then`.replace('js_not (', '(0 = '));
            this.blockInto({ type: 'ExpressionStatement', expression: e.right }, out);
            out.push('End If');
            return;
          }
          break;
        default:
          break;
      }
      const v = this.expr(e);
      out.push(`js_discard_s(${this.V(v)})`);
    }

    asPattern(n) {
      if (n.type === 'ArrayExpression' || n.type === 'ArrayLiteral') return { type: 'ArrayPattern', elements: n.elements };
      return n;
    }

    declarator(d, declKind, out) {
      const id = d.id;
      if (id.type === 'Identifier') {
        if (this.fn.kind === 'module' && this.fn.scopes.length === 1 && this.globals.has(id.name)) {
          const g = this.globals.get(id.name);
          const v = d.init ? this.expr(d.init) : null;
          out.push(`${g.name} = ${v ? (g.kind === 'd' ? this.D(v) : this.V(v)) : (g.kind === 'd' ? '0' : 'js_undefined()')}`);
          return;
        }
        const numeric = !d.nullable && !d.declaredNullable && fbIsNum(d.declaredType || id.resultType || d.resultType) && !(d.init && d.init.type === 'Literal' && d.init.value === null);
        const value = d.init ? this.expr(d.init) : null;
        let b;
        let redeclared = false;
        if (declKind === 'var') {
          // var is function-scoped: one binding in the function's outermost scope
          const top = this.fn.scopes[0];
          b = top.get(id.name);
          redeclared = !!b;
          if (!b) {
            const saved = this.fn.scopes;
            this.fn.scopes = [top];
            b = this.declareLocal(id.name, numeric ? 'd' : 'v');
            this.fn.scopes = saved;
          }
        } else b = this.declareLocal(id.name, numeric ? 'd' : 'v');
        const ref = this.bindingRef(b);
        const kind = b.env !== undefined ? 'v' : b.kind;
        if (!value) {
          if (kind !== 'd' && kind !== undefined && !redeclared) out.push(`${ref} = js_undefined()`);
          return;
        }
        out.push(`${ref} = ${kind === 'd' ? this.D(value) : this.V(value)}`);
        return;
      }
      const t = this.temp('v');
      out.push(`${t} = ${d.init ? this.V(this.expr(d.init)) : 'js_undefined()'}`);
      out.push(...this.destructure(id, t, declKind));
    }

    destructure(pattern, src, kind) {
      const out = [];
      const bind = (target, valueCode) => {
        if (!target) return;
        if (target.type === 'AssignmentPattern') {
          const t = this.temp('v');
          out.push(`${t} = ${valueCode}`);
          out.push(`If ${t}.tag = JS_T_UNDEF Then ${t} = ${this.V(this.expr(target.right))}`);
          bind(target.left, t);
          return;
        }
        if (target.type === 'Identifier') {
          let b = kind ? this.declareLocal(target.name, 'v') : this.lookup(target.name);
          if (!b && this.globals.has(target.name)) { const g = this.globals.get(target.name); out.push(`${g.name} = ${g.kind === 'd' ? `js_tonum(${valueCode})` : valueCode}`); return; }
          if (!b) b = this.declareLocal(target.name, 'v');
          const kd = b.env !== undefined ? 'v' : b.kind;
          out.push(`${this.bindingRef(b)} = ${kd === 'd' ? `js_tonum(${valueCode})` : valueCode}`);
          return;
        }
        if (target.type === 'ArrayPattern' || target.type === 'ObjectPattern') {
          const t = this.temp('v');
          out.push(`${t} = ${valueCode}`);
          walk(target, t);
          return;
        }
        out.push(this.storeRaw(target, this.vx(valueCode)));
      };
      const walk = (p, s) => {
        if (p.type === 'ArrayPattern') {
          (p.elements || []).forEach((el, i) => {
            if (!el) return;
            if (el.type === 'RestElement') bind(el.argument, `js_slice_arr(${s}, js_num(${i}), js_undefined())`);
            else bind(el, `js_idx(${s}, ${i}.0)`);
          });
        } else {
          for (const q of p.properties || []) {
            if (q.type === 'RestElement') { bind(q.argument, s); continue; }
            const key = q.key && (q.key.name !== undefined && !q.computed ? q.key.name : q.key.value);
            bind(q.value || q.key, q.computed ? `js_get(${s}, ${this.V(this.expr(q.key))})` : `js_getp(${s}, ${this.sym(String(key))})`);
          }
        }
      };
      walk(pattern, src);
      return out;
    }

    /** Store an expression value into a target node (statement code) */
    storeRaw(target, value) {
      const fake = { type: '__FbValue', value };
      return this.store(target, fake, true);
    }

    e__FbValue(node) { return node.value; }

    tryStatement(node, out) {
      out.push('js_jmp_top += 1');
      out.push('If setjmp(@js_jmp(js_jmp_top)) = 0 Then');
      this.fn.tryDepth++;
      this.blockInto(node.block, out);
      this.fn.tryDepth--;
      out.push('  js_jmp_top -= 1');
      out.push('Else');
      const inner = ['js_jmp_top -= 1'];
      if (node.handler) {
        this.fn.scopes.push(new Map());
        if (node.handler.param && node.handler.param.type === 'Identifier') {
          const b = this.declareLocal(node.handler.param.name, 'v');
          inner.push(`${this.bindingRef(b)} = js_thrown`);
        }
        const hb = node.handler.body;
        for (const s of (hb && hb.type === 'BlockStatement' ? hb.body : [hb]) || []) this.statement(s, inner);
        this.fn.scopes.pop();
      } else {
        // try/finally without catch: run the finally, then rethrow
        if (node.finalizer) this.blockInto(node.finalizer, inner);
        inner.push('js_throw(js_thrown)');
      }
      out.push(...this.indent(inner));
      out.push('End If');
      if (node.finalizer) this.blockInto(node.finalizer, out);
    }

    switchStatement(node, out) {
      const cases = node.cases || [];
      const ends = stmts => {
        const last = stmts[stmts.length - 1];
        return last && ['BreakStatement', 'ReturnStatement', 'ThrowStatement', 'ContinueStatement'].includes(last.type);
      };
      const bodies = cases.map((c, i) => {
        let stmts = [...(c.consequent || [])];
        if (stmts.length === 1 && stmts[0].type === 'BlockStatement') stmts = [...stmts[0].body];
        if (!stmts.length) return null;
        let j = i;
        while (!ends(stmts) && j + 1 < cases.length) {
          j++;
          let next = [...(cases[j].consequent || [])];
          if (next.length === 1 && next[0].type === 'BlockStatement') next = [...next[0].body];
          stmts = stmts.concat(next);
        }
        if (stmts.length && stmts[stmts.length - 1].type === 'BreakStatement') stmts = stmts.slice(0, -1);
        return stmts;
      });
      const tests = cases.map(c => c.test);
      const numeric = this.isNumNode(node.discriminant) && tests.every(t => !t || (t.type === 'Literal' && typeof t.value === 'number') || this.isNumNode(t));
      const literalStrings = tests.every(t => !t || (t.type === 'Literal' && typeof t.value === 'string'));
      let header;
      let caseExpr;
      if (numeric) {
        header = `Select Case ${this.D(this.expr(node.discriminant))}`;
        caseExpr = t => this.D(this.expr(t));
      } else if (literalStrings && this.isStrNode(node.discriminant)) {
        header = `Select Case js_tostring(${this.V(this.expr(node.discriminant))})`;
        caseExpr = t => fbStringExpr(t.value);
      } else {
        const t = this.temp('v');
        out.push(`${t} = ${this.V(this.expr(node.discriminant))}`);
        header = 'Select Case -1';
        caseExpr = test => `js_strict_eq(${t}, ${this.V(this.expr(test))})`;
      }
      out.push(header);
      this.fn.loops.push({ isSwitch: true });
      let pending = [];
      // bodies carry their fall-through, so the default group (which Case Else must close) moves last
      let defaultBody = null;
      const emitBody = (i, label) => {
        out.push(label);
        const inner = [];
        this.fn.scopes.push(new Map());
        for (const s of bodies[i]) this.statement(s, inner);
        this.fn.scopes.pop();
        out.push(...inner.map(l => '    ' + l));
      };
      cases.forEach((c, i) => {
        pending.push(c.test);
        if (bodies[i] === null) return;
        const isDefault = pending.includes(null);
        const values = pending.filter(t => t);
        if (isDefault) defaultBody = i;
        if (values.length) emitBody(i, `  Case ${values.map(caseExpr).join(', ')}`);
        pending = [];
      });
      if (defaultBody === null && pending.includes(null)) defaultBody = -1;
      if (defaultBody !== null && defaultBody >= 0) emitBody(defaultBody, '  Case Else');
      this.fn.loops.pop();
      out.push('End Select');
    }

    // ------------------------------------------------------------------
    // classes
    // ------------------------------------------------------------------

    classDeclaration(node) {
      const info = this.classes.get(node.id.name);
      const lines = [];
      const members = (node.body && node.body.body) || [];
      const ctor = members.find(m => m.type === 'MethodDefinition' && m.kind === 'constructor');
      const fields = members.filter(m => (m.type === 'FieldDefinition' || m.type === 'PropertyDefinition' || m.type === 'ClassProperty') && !m.static);
      const staticFields = members.filter(m => (m.type === 'FieldDefinition' || m.type === 'PropertyDefinition' || m.type === 'ClassProperty') && m.static);
      let ctorName = '0';
      if (ctor || fields.length) {
        ctorName = `k${this.tok}_${info.esc}`;
        const fnNode = ctor ? ctor.value : { type: 'FunctionExpression', params: [], body: { type: 'BlockStatement', body: info.superName ? [{ type: 'ExpressionStatement', expression: { type: '__FbSuperAll' } }] : [] } };
        const body = fnNode.body && fnNode.body.type === 'BlockStatement' ? [...fnNode.body.body] : [];
        if (fields.length) {
          const inits = fields.map(f => ({ type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '=', left: { type: 'ThisPropertyAccess', property: this.keyName(f), computed: false }, right: f.value || { type: 'Identifier', name: 'undefined' } } }));
          const superIndex = body.findIndex(s => s && s.type === 'ExpressionStatement' && s.expression && (s.expression.type === 'ParentConstructorCall' || s.expression.type === '__FbSuperAll'
            || (s.expression.type === 'CallExpression' && s.expression.callee && s.expression.callee.type === 'Super')));
          body.splice(superIndex + 1, 0, ...inits);
        }
        this.emitFunction(ctorName, { ...fnNode, body: { type: 'BlockStatement', body } }, 'ctor', { classInfo: info, methodName: 'constructor' });
        ctorName = '@' + ctorName;
      }
      const parent = info.superName ? this.classRef(info.superName) : null;
      lines.push(`${info.cvar} = js_class_new(${fbStringExpr(info.jsName)}, ${parent ? `js_classh(${parent})` : '0'}, ${ctorName})`);
      for (const m of members) {
        if (m.type !== 'MethodDefinition' || m.kind === 'constructor') continue;
        const name = this.keyName(m);
        const kind = m.kind === 'get' ? 1 : m.kind === 'set' ? 2 : 0;
        const fname = `m${this.tok}_${info.esc}_${m.static ? 'x' : ''}${['', 'g', 's'][kind]}${fbEscape(name)}`;
        this.emitFunction(fname, m.value, 'method', { classInfo: info, isStatic: !!m.static, methodName: name });
        if (m.static) {
          if (kind === 0) lines.push(`js_setp(${info.cvar}, ${this.sym(name)}, js_fn_new(@${fname}, 0))`);
          else lines.push(`js_class_static_accessor(${info.cvar}, ${this.sym(name)}, @${fname}, ${kind})`);
        } else lines.push(`js_class_add(${info.cvar}, ${this.sym(name)}, @${fname}, ${kind})`);
      }
      for (const f of staticFields) {
        const v = f.value ? this.V(this.expr(f.value)) : 'js_undefined()';
        lines.push(`js_setp(${info.cvar}, ${this.sym(this.keyName(f))}, ${v})`);
      }
      return lines;
    }

    e__FbSuperAll() {
      return this.vx('js_superctora(' + this.parentClassRef() + ', self, js_argrest(argv, argc, 0))');
    }
  }
  // END FREEBASIC

  // Export
  const exports = { BasicTransformer, FreeBasicTransformer, FB_RUNTIME };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.BasicTransformer = BasicTransformer;
    global.FreeBasicTransformer = FreeBasicTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
