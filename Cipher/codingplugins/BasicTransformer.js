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
        for (const param of node.params) {
          const paramName = this.toCamelCase(param.name);
          const paramType = param.typeAnnotation ?
            this.mapType(param.typeAnnotation) :
            this.inferTypeFromName(param.name);
          const basicParam = new BasicParameter(paramName, paramType);
          func.parameters.push(basicParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.body) {
        func.body = this.transformBlockStatement(node.body);
      }

      targetModule.functions.push(func);
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
        for (const param of node.value.params) {
          const paramName = this.toCamelCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          func.parameters.push(new BasicParameter(paramName, paramType));
          this.registerVariableType(param.name, paramType);
        }
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
        for (const param of node.value.params) {
          const paramName = this.toCamelCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          ctor.parameters.push(new BasicParameter(paramName, paramType));
          this.registerVariableType(param.name, paramType);
        }
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
        for (const param of node.value.params) {
          const paramName = this.toCamelCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          method.parameters.push(new BasicParameter(paramName, paramType));
          this.registerVariableType(param.name, paramType);
        }
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

  // Export
  const exports = { BasicTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.BasicTransformer = BasicTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
