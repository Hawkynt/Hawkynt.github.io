/**
 * PythonTransformer.js - JavaScript AST to Python AST Transformer
 * Converts type-annotated JavaScript AST to Python AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Python AST -> Python Emitter -> Python Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let PythonAST;
  if (typeof require !== 'undefined') {
    PythonAST = require('./PythonAST.js');
  } else if (global.PythonAST) {
    PythonAST = global.PythonAST;
  }

  const {
    PythonType, PythonModule, PythonImport, PythonClass, PythonFunction,
    PythonParameter, PythonBlock, PythonAssignment, PythonExpressionStatement,
    PythonReturn, PythonIf, PythonFor, PythonWhile, PythonBreak, PythonContinue,
    PythonRaise, PythonTryExcept, PythonExceptClause, PythonPass,
    PythonLiteral, PythonIdentifier, PythonBinaryExpression, PythonUnaryExpression,
    PythonMemberAccess, PythonSubscript, PythonCall, PythonList, PythonDict,
    PythonTuple, PythonListComprehension, PythonConditional, PythonLambda, PythonSlice
  } = PythonAST;

  /**
   * Maps JavaScript/JSDoc types to Python types
   */
  const TYPE_MAP = {
    // Unsigned integers -> int (Python 3 has arbitrary precision int)
    'uint8': 'int', 'byte': 'int',
    'uint16': 'int', 'ushort': 'int', 'word': 'int',
    'uint32': 'int', 'uint': 'int', 'dword': 'int',
    'uint64': 'int', 'ulong': 'int', 'qword': 'int',
    // Signed integers -> int
    'int8': 'int', 'sbyte': 'int',
    'int16': 'int', 'short': 'int',
    'int32': 'int', 'int': 'int',
    'int64': 'int', 'long': 'int',
    // Floating point
    'float': 'float', 'float32': 'float',
    'double': 'float', 'float64': 'float',
    'number': 'int', // In crypto context, typically int
    // Other
    'boolean': 'bool', 'bool': 'bool',
    'string': 'str', 'String': 'str',
    'void': 'None',
    'object': 'Any', 'Object': 'Any', 'any': 'Any',
    // Arrays
    'Array': 'List', 'array': 'List'
  };

  /**
   * OpCodes method mapping to Python implementations
   */
  const OPCODES_MAP = {
    // Rotation operations
    'RotL32': (args) => `_rotl32(${args.join(', ')})`,
    'RotR32': (args) => `_rotr32(${args.join(', ')})`,
    'RotL64': (args) => `_rotl64(${args.join(', ')})`,
    'RotR64': (args) => `_rotr64(${args.join(', ')})`,
    'RotL8': (args) => `_rotl8(${args.join(', ')})`,
    'RotR8': (args) => `_rotr8(${args.join(', ')})`,

    // Packing operations
    'Pack32BE': (args) => `struct.pack('>I', ${args.join(', ')})`,
    'Pack32LE': (args) => `struct.pack('<I', ${args.join(', ')})`,
    'Pack64BE': (args) => `struct.pack('>Q', ${args.join(', ')})`,
    'Pack64LE': (args) => `struct.pack('<Q', ${args.join(', ')})`,

    // Unpacking operations
    'Unpack32BE': (args) => `struct.unpack('>I', ${args[0]})[0]`,
    'Unpack32LE': (args) => `struct.unpack('<I', ${args[0]})[0]`,
    'Unpack64BE': (args) => `struct.unpack('>Q', ${args[0]})[0]`,
    'Unpack64LE': (args) => `struct.unpack('<Q', ${args[0]})[0]`,

    // Array operations
    'XorArrays': (args) => `bytes(a ^ b for a, b in zip(${args[0]}, ${args[1]}))`,
    'ClearArray': (args) => `${args[0]}.clear()`,

    // Conversion utilities
    'Hex8ToBytes': (args) => `bytes.fromhex(${args[0]})`,
    'BytesToHex8': (args) => `${args[0]}.hex()`,
    'AnsiToBytes': (args) => `${args[0]}.encode('ascii')`
  };

  /**
   * Convert camelCase to snake_case
   */
  function toSnakeCase(str) {
    // Preserve common constants like MD5, SHA1, etc.
    if (str === str.toUpperCase()) return str.toLowerCase();

    return str
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .toLowerCase();
  }

  /**
   * Keep PascalCase for class names
   */
  function toPascalCase(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * JavaScript AST to Python AST Transformer
   */
  class PythonTransformer {
    constructor(options = {}) {
      this.options = options;
      this.typeKnowledge = options.typeKnowledge || null;
      this.addTypeHints = options.addTypeHints !== undefined ? options.addTypeHints : true;
      this.addDocstrings = options.addDocstrings !== undefined ? options.addDocstrings : true;
      // strictTypes: when true, always add type hints even when 'Any' (never omit type annotations)
      // when false, only add type hints when we have concrete types (omit 'Any')
      this.strictTypes = options.strictTypes !== undefined ? options.strictTypes : false;
      this.currentClass = null;
      this.currentMethod = null;
      this.variableTypes = new Map();
      this.warnings = [];
      this.imports = new Set(); // Track needed imports
      this.scopeStack = [];
    }

    /**
     * Get OpCodes return type from type knowledge
     */
    getOpCodesReturnType(methodName) {
      if (!this.typeKnowledge?.opCodesTypes) return null;
      const methodInfo = this.typeKnowledge.opCodesTypes[methodName];
      if (!methodInfo) return null;
      return this.mapTypeFromKnowledge(methodInfo.returns);
    }

    /**
     * Map a type from type knowledge to PythonType
     */
    mapTypeFromKnowledge(typeName) {
      if (!typeName) return PythonType.Any();

      if (typeof typeName === 'string') {
        // Handle arrays
        if (typeName.endsWith('[]')) {
          const elementTypeName = typeName.slice(0, -2);
          const elementType = this.mapTypeFromKnowledge(elementTypeName);
          this.imports.add('List');
          return PythonType.List(elementType);
        }

        const mapped = TYPE_MAP[typeName] || typeName;
        return this.createPythonType(mapped);
      }

      return PythonType.Any();
    }

    /**
     * Infer type from expression
     */
    inferFullExpressionType(node) {
      if (!node) return PythonType.Any();

      switch (node.type) {
        case 'Literal':
          return this.inferLiteralType(node);
        case 'Identifier':
          const varType = this.getVariableType(node.name);
          return varType || PythonType.Int();
        case 'CallExpression':
          return this.inferCallExpressionType(node);
        case 'ArrayExpression':
          if (node.elements.length > 0) {
            const elemType = this.inferFullExpressionType(node.elements[0]);
            this.imports.add('List');
            return PythonType.List(elemType);
          }
          this.imports.add('List');
          return PythonType.List(PythonType.Int());
        case 'BinaryExpression':
        case 'LogicalExpression':
          const compOps = ['==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||'];
          if (compOps.includes(node.operator)) {
            return PythonType.Bool();
          }
          return PythonType.Int();
        default:
          return PythonType.Any();
      }
    }

    /**
     * Infer type from literal
     */
    inferLiteralType(node) {
      if (node.value === null) return PythonType.None();
      if (typeof node.value === 'boolean') return PythonType.Bool();
      if (typeof node.value === 'string') return PythonType.Str();
      if (typeof node.value === 'number') {
        return Number.isInteger(node.value) ? PythonType.Int() : PythonType.Float();
      }
      return PythonType.Any();
    }

    /**
     * Infer type from call expression
     */
    inferCallExpressionType(node) {
      if (node.callee.type === 'MemberExpression') {
        const obj = node.callee.object;
        const method = node.callee.property.name || node.callee.property.value;

        // Check OpCodes methods
        if (obj.type === 'Identifier' && obj.name === 'OpCodes') {
          const returnType = this.getOpCodesReturnType(method);
          if (returnType) return returnType;
        }
      }
      return PythonType.Any();
    }

    /**
     * Register variable type
     */
    registerVariableType(name, type) {
      this.variableTypes.set(name, type);
    }

    /**
     * Get variable type
     */
    getVariableType(name) {
      return this.variableTypes.get(name) || null;
    }

    /**
     * Push scope
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
     * Transform JavaScript AST to Python AST
     */
    transform(ast) {
      const module = new PythonModule();

      // Process the AST
      if (ast.type === 'Program') {
        this.transformProgram(ast, module);
      } else {
        this.warnings.push('Expected Program node at root');
      }

      // Add collected imports at the beginning
      module.imports = this.collectImports();

      return module;
    }

    /**
     * Collect necessary imports based on what was used
     */
    collectImports() {
      const imports = [];

      // Always add typing imports for type annotations
      if (this.imports.has('List') || this.imports.has('Dict') ||
          this.imports.has('Optional') || this.imports.has('Any')) {
        const typingItems = [];
        if (this.imports.has('List')) typingItems.push({ name: 'List', alias: null });
        if (this.imports.has('Dict')) typingItems.push({ name: 'Dict', alias: null });
        if (this.imports.has('Optional')) typingItems.push({ name: 'Optional', alias: null });
        if (this.imports.has('Any')) typingItems.push({ name: 'Any', alias: null });
        imports.push(new PythonImport('typing', typingItems));
      }

      // Add struct import if needed
      if (this.imports.has('struct')) {
        imports.push(new PythonImport('struct', []));
      }

      return imports;
    }

    /**
     * Transform Program node
     */
    transformProgram(node, module) {
      for (const stmt of node.body) {
        const transformed = this.transformStatement(stmt);
        if (transformed) {
          if (Array.isArray(transformed)) {
            module.statements.push(...transformed);
          } else {
            module.statements.push(transformed);
          }
        }
      }
    }

    // ========================[ STATEMENTS ]========================

    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        case 'ClassDeclaration':
          return this.transformClassDeclaration(node);
        case 'FunctionDeclaration':
          return this.transformFunctionDeclaration(node);
        case 'VariableDeclaration':
          return this.transformVariableDeclaration(node);
        case 'ExpressionStatement':
          return this.transformExpressionStatement(node);
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
        case 'BreakStatement':
          return new PythonBreak();
        case 'ContinueStatement':
          return new PythonContinue();
        case 'ThrowStatement':
          return this.transformThrowStatement(node);
        case 'TryStatement':
          return this.transformTryStatement(node);
        case 'BlockStatement':
          return this.transformBlockStatement(node);
        default:
          this.warnings.push(`Unsupported statement type: ${node.type}`);
          return null;
      }
    }

    transformClassDeclaration(node) {
      const className = toPascalCase(node.id.name);
      const pyClass = new PythonClass(className);

      // Extract base classes
      if (node.superClass) {
        pyClass.baseClasses.push(node.superClass.name);
      }

      // Save current class context
      const prevClass = this.currentClass;
      this.currentClass = pyClass;

      // Process class body
      // Handle both standard ClassBody and unwrapped array of members
      const members = node.body?.body || node.body || [];

      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            const method = this.transformMethodDefinition(member);
            if (method)
              pyClass.methods.push(method);
          } else if (member.type === 'PropertyDefinition') {
            const assignment = this.transformPropertyDefinition(member);
            if (assignment)
              pyClass.classVariables.push(assignment);
          }
        }
      }

      // Restore context
      this.currentClass = prevClass;

      return pyClass;
    }

    transformMethodDefinition(node) {
      const methodName = toSnakeCase(node.key.name);
      const isConstructor = node.kind === 'constructor';
      const isStatic = node.static;

      const pyFunc = new PythonFunction(
        isConstructor ? '__init__' : methodName,
        [],
        null
      );

      pyFunc.isMethod = true;
      pyFunc.isStaticMethod = isStatic;

      // Add decorators
      if (isStatic) {
        pyFunc.decorators.push('staticmethod');
      }
      if (node.kind === 'get') {
        pyFunc.decorators.push('property');
        pyFunc.isProperty = true;
      }
      if (node.kind === 'set') {
        pyFunc.decorators.push(`${methodName}.setter`);
      }

      // Parameters (add 'self' for instance methods)
      if (!isStatic) {
        pyFunc.parameters.push(new PythonParameter('self'));
      }

      // Push scope
      this.pushScope();

      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const pyParam = this.transformParameter(param);
          pyFunc.parameters.push(pyParam);

          // Register parameter type
          if (pyParam.type) {
            this.registerVariableType(param.name, pyParam.type);
          }
        }
      }

      // Return type (only if addTypeHints is enabled)
      if (this.addTypeHints && node.value && node.value.returnType) {
        pyFunc.returnType = this.mapType(node.value.returnType);
      }

      // Set current method
      const prevMethod = this.currentMethod;
      this.currentMethod = pyFunc;

      // Body
      if (node.value && node.value.body)
        pyFunc.body = this.transformBlockStatement(node.value.body);

      // Restore context
      this.currentMethod = prevMethod;
      this.popScope();

      return pyFunc;
    }

    transformFunctionDeclaration(node) {
      const funcName = toSnakeCase(node.id.name);
      const pyFunc = new PythonFunction(funcName, [], null);

      // Push scope
      this.pushScope();

      // Parameters
      if (node.params) {
        for (const param of node.params) {
          const pyParam = this.transformParameter(param);
          pyFunc.parameters.push(pyParam);

          // Register parameter type
          if (pyParam.type) {
            this.registerVariableType(param.name, pyParam.type);
          }
        }
      }

      // Return type (only if addTypeHints is enabled)
      if (this.addTypeHints && node.returnType) {
        pyFunc.returnType = this.mapType(node.returnType);
      }

      // Set current method
      const prevMethod = this.currentMethod;
      this.currentMethod = pyFunc;

      // Body
      if (node.body) {
        pyFunc.body = this.transformBlockStatement(node.body);
      }

      // Restore context
      this.currentMethod = prevMethod;
      this.popScope();

      return pyFunc;
    }

    transformParameter(node) {
      const paramName = toSnakeCase(node.name || node.id?.name || 'param');
      let type = null;
      let defaultValue = null;

      // Type annotation (only if addTypeHints is enabled)
      if (this.addTypeHints && node.typeAnnotation) {
        type = this.mapType(node.typeAnnotation);
      }

      // Default value
      if (node.defaultValue) {
        defaultValue = this.transformExpression(node.defaultValue);
      }

      return new PythonParameter(paramName, type, defaultValue);
    }

    transformPropertyDefinition(node) {
      const propName = toSnakeCase(node.key.name);
      const value = node.value ? this.transformExpression(node.value) : PythonLiteral.None();

      const assignment = new PythonAssignment(
        new PythonIdentifier(propName),
        value
      );

      // Type annotation (only if addTypeHints is enabled)
      if (this.addTypeHints && node.typeAnnotation) {
        assignment.type = this.mapType(node.typeAnnotation);
      }

      return assignment;
    }

    transformVariableDeclaration(node) {
      const assignments = [];

      for (const declarator of node.declarations) {
        // Skip ObjectPattern destructuring (e.g., const { RegisterAlgorithm } = AlgorithmFramework)
        if (declarator.id.type === 'ObjectPattern')
          continue;

        // Skip ArrayPattern destructuring
        if (declarator.id.type === 'ArrayPattern')
          continue;

        const varName = toSnakeCase(declarator.id.name);

        // Check if this is an IIFE (immediately invoked function expression)
        let value;
        if (declarator.init &&
            declarator.init.type === 'CallExpression' &&
            (declarator.init.callee.type === 'FunctionExpression' ||
             declarator.init.callee.type === 'ArrowFunctionExpression')) {
          // Extract return value from IIFE
          const returnValue = this.getIIFEReturnValue(declarator.init);
          value = returnValue
            ? this.transformExpression(returnValue)
            : PythonLiteral.None();
        } else {
          value = declarator.init
            ? this.transformExpression(declarator.init)
            : PythonLiteral.None();
        }

        const assignment = new PythonAssignment(
          new PythonIdentifier(varName),
          value
        );

        // Type annotation (only if addTypeHints is enabled)
        if (this.addTypeHints) {
          if (declarator.id.typeAnnotation) {
            assignment.type = this.mapType(declarator.id.typeAnnotation);
            this.registerImportForType(assignment.type);
          } else if (declarator.init) {
            // Infer type from initializer
            const inferredType = this.inferFullExpressionType(declarator.init);
            // Add type hint if: strictTypes is true OR type is not 'Any'
            if (inferredType && (this.strictTypes || inferredType.name !== 'Any')) {
              assignment.type = inferredType;
            }
          }
        }

        assignments.push(assignment);

        // Track variable type
        if (assignment.type) {
          this.registerVariableType(declarator.id.name, assignment.type);
        }
      }

      return assignments.length === 1 ? assignments[0] : assignments;
    }

    transformExpressionStatement(node) {
      const expr = this.transformExpression(node.expression);
      return new PythonExpressionStatement(expr);
    }

    transformReturnStatement(node) {
      const expr = node.argument ? this.transformExpression(node.argument) : null;
      return new PythonReturn(expr);
    }

    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformBlockOrStatement(node.consequent);
      const elseBranch = node.alternate ? this.transformBlockOrStatement(node.alternate) : null;

      // Handle elif chains
      const elifBranches = [];
      let finalElse = elseBranch;

      if (elseBranch && elseBranch.nodeType === 'If') {
        // Convert else-if to elif
        elifBranches.push({
          condition: elseBranch.condition,
          body: elseBranch.thenBranch
        });
        finalElse = elseBranch.elseBranch;
      }

      return new PythonIf(condition, thenBranch, elifBranches, finalElse);
    }

    transformForStatement(node) {
      // Detect range-based for loops: for (let i = 0; i < n; i++)
      if (this.isRangeBasedFor(node)) {
        return this.transformRangeFor(node);
      }

      // Convert to while loop for complex cases
      return this.transformForAsWhile(node);
    }

    isRangeBasedFor(node) {
      // Check if it's a simple for loop: for (let i = 0; i < n; i++)
      if (!node.init || !node.test || !node.update) return false;

      const init = node.init;
      const test = node.test;
      const update = node.update;

      // Check init: let i = 0
      if (init.type !== 'VariableDeclaration') return false;
      if (init.declarations.length !== 1) return false;
      const decl = init.declarations[0];
      if (!decl.init || decl.init.type !== 'Literal') return false;

      // Check test: i < n
      if (test.type !== 'BinaryExpression') return false;
      if (test.operator !== '<' && test.operator !== '<=') return false;

      // Check update: i++ or ++i
      if (update.type !== 'UpdateExpression') return false;
      if (update.operator !== '++') return false;

      return true;
    }

    transformRangeFor(node) {
      const varName = toSnakeCase(node.init.declarations[0].id.name);
      const start = this.transformExpression(node.init.declarations[0].init);
      const end = this.transformExpression(node.test.right);

      // Create range() call
      const rangeCall = new PythonCall(
        new PythonIdentifier('range'),
        [start, end]
      );

      const body = this.transformBlockOrStatement(node.body);
      return new PythonFor(varName, rangeCall, body);
    }

    transformForAsWhile(node) {
      // Convert complex for loops to while loops
      const block = new PythonBlock();

      // Add initialization
      if (node.init) {
        const init = this.transformStatement(node.init);
        if (init) {
          if (Array.isArray(init)) {
            block.statements.push(...init);
          } else {
            block.statements.push(init);
          }
        }
      }

      // Create while loop
      const condition = node.test ? this.transformExpression(node.test) : PythonLiteral.Bool(true);
      const whileBody = this.transformBlockOrStatement(node.body);

      // Add update at end of while body
      if (node.update) {
        const update = this.transformExpression(node.update);
        whileBody.statements.push(new PythonExpressionStatement(update));
      }

      block.statements.push(new PythonWhile(condition, whileBody));

      return block.statements.length === 1 ? block.statements[0] : block.statements;
    }

    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformBlockOrStatement(node.body);
      return new PythonWhile(condition, body);
    }

    /**
     * Transform JavaScript for...of statement to Python for...in
     * JS: for (const item of iterable) { ... }
     * Python: for item in iterable: ...
     */
    transformForOfStatement(node) {
      // Get the loop variable name
      let varName;
      if (node.left.type === 'VariableDeclaration') {
        // Handle VariableDeclaration with nested structure
        const decl = node.left.declarations[0];
        if (decl && decl.id && decl.id.name) {
          varName = toSnakeCase(decl.id.name);
        } else if (decl && decl.id && decl.id.type === 'Identifier') {
          varName = toSnakeCase(decl.id.name);
        } else {
          this.warnings.push('Cannot extract variable name from for-of declaration');
          varName = 'item';
        }
      } else if (node.left.type === 'Identifier') {
        varName = toSnakeCase(node.left.name);
      } else {
        this.warnings.push('Unsupported for-of left-hand side: ' + node.left.type);
        varName = 'item';
      }

      // Get the iterable expression
      const iterable = this.transformExpression(node.right);

      // Get the loop body
      const body = this.transformBlockOrStatement(node.body);

      // Create Python for loop
      return new PythonFor(
        new PythonIdentifier(varName),
        iterable,
        body
      );
    }

    /**
     * Transform JavaScript for...in statement to Python for...in
     * JS: for (const key in object) { ... }
     * Python: for key in object: ... (or for key in object.keys(): ...)
     */
    transformForInStatement(node) {
      // Get the loop variable name
      let varName;
      if (node.left.type === 'VariableDeclaration') {
        // Handle VariableDeclaration with nested structure
        const decl = node.left.declarations[0];
        if (decl && decl.id && decl.id.name) {
          varName = toSnakeCase(decl.id.name);
        } else if (decl && decl.id && decl.id.type === 'Identifier') {
          varName = toSnakeCase(decl.id.name);
        } else {
          this.warnings.push('Cannot extract variable name from for-in declaration');
          varName = 'key';
        }
      } else if (node.left.type === 'Identifier') {
        varName = toSnakeCase(node.left.name);
      } else {
        this.warnings.push('Unsupported for-in left-hand side: ' + node.left.type);
        varName = 'key';
      }

      // Get the object expression - for objects, we iterate over keys
      const obj = this.transformExpression(node.right);

      // Get the loop body
      const body = this.transformBlockOrStatement(node.body);

      // For JavaScript for-in, we iterate over keys
      // Use range(len(x)) for arrays or just x for objects
      // For simplicity, we'll just use the object directly (works for dicts and lists)
      return new PythonFor(
        new PythonIdentifier(varName),
        obj,
        body
      );
    }

    transformDoWhileStatement(node) {
      // Python doesn't have do-while, convert to while True with break
      const body = this.transformBlockOrStatement(node.body);
      const condition = this.transformExpression(node.test);

      // Add condition check at end with break
      const notCondition = new PythonUnaryExpression('not', condition);
      const breakIf = new PythonIf(notCondition,
        (() => {
          const b = new PythonBlock();
          b.statements.push(new PythonBreak());
          return b;
        })(),
        [], null);

      body.statements.push(breakIf);

      return new PythonWhile(PythonLiteral.Bool(true), body);
    }

    transformSwitchStatement(node) {
      // Transform switch to if/elif/else chain
      if (node.cases.length === 0) {
        return null;
      }

      const discriminant = this.transformExpression(node.discriminant);

      let currentIf = null;
      let lastIf = null;

      for (let i = 0; i < node.cases.length; i++) {
        const caseNode = node.cases[i];

        if (caseNode.test === null) {
          // Default case
          const defaultBody = this.transformSwitchCaseBody(caseNode.consequent);
          if (currentIf) {
            lastIf.elseBranch = defaultBody;
          } else {
            return defaultBody;
          }
        } else {
          // Regular case
          const condition = new PythonBinaryExpression(
            discriminant,
            '==',
            this.transformExpression(caseNode.test)
          );

          const caseBody = this.transformSwitchCaseBody(caseNode.consequent);
          const ifStmt = new PythonIf(condition, caseBody, [], null);

          if (!currentIf) {
            currentIf = ifStmt;
            lastIf = ifStmt;
          } else {
            lastIf.elseBranch = ifStmt;
            lastIf = ifStmt;
          }
        }
      }

      return currentIf;
    }

    transformSwitchCaseBody(consequent) {
      const block = new PythonBlock();

      for (const stmt of consequent) {
        if (stmt.type === 'BreakStatement') {
          // Skip break statements in Python (handled by elif structure)
          continue;
        }
        const transformed = this.transformStatement(stmt);
        if (transformed) {
          if (Array.isArray(transformed)) {
            block.statements.push(...transformed);
          } else {
            block.statements.push(transformed);
          }
        }
      }

      return block;
    }

    transformThrowStatement(node) {
      const expr = this.transformExpression(node.argument);
      return new PythonRaise(expr);
    }

    transformTryStatement(node) {
      const tryExcept = new PythonTryExcept();
      tryExcept.tryBlock = this.transformBlockOrStatement(node.block);

      // Catch clauses
      if (node.handler) {
        const exceptClause = this.transformCatchClause(node.handler);
        tryExcept.exceptClauses.push(exceptClause);
      }

      // Finally block
      if (node.finalizer) {
        tryExcept.finallyBlock = this.transformBlockOrStatement(node.finalizer);
      }

      return tryExcept;
    }

    transformCatchClause(node) {
      const exceptionType = node.param?.typeAnnotation
        ? this.mapType(node.param.typeAnnotation).name
        : 'Exception';
      const varName = node.param ? toSnakeCase(node.param.name) : null;
      const body = this.transformBlockOrStatement(node.body);

      return new PythonExceptClause(exceptionType, varName, body);
    }

    transformBlockStatement(node) {
      const block = new PythonBlock();

      for (const stmt of node.body) {
        const transformed = this.transformStatement(stmt);
        if (transformed) {
          if (Array.isArray(transformed)) {
            block.statements.push(...transformed);
          } else {
            block.statements.push(transformed);
          }
        }
      }

      return block;
    }

    transformBlockOrStatement(node) {
      if (node.type === 'BlockStatement') {
        return this.transformBlockStatement(node);
      } else {
        const block = new PythonBlock();
        const stmt = this.transformStatement(node);
        if (stmt) {
          if (Array.isArray(stmt)) {
            block.statements.push(...stmt);
          } else {
            block.statements.push(stmt);
          }
        }
        return block;
      }
    }

    // ========================[ EXPRESSIONS ]========================

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
        case 'UpdateExpression':
          return this.transformUpdateExpression(node);
        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);
        case 'MemberExpression':
          return this.transformMemberExpression(node);
        case 'CallExpression':
          return this.transformCallExpression(node);
        case 'NewExpression':
          return this.transformNewExpression(node);
        case 'ArrayExpression':
          return this.transformArrayExpression(node);
        case 'ObjectExpression':
          return this.transformObjectExpression(node);
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformLambdaExpression(node);
        case 'ThisExpression':
          return new PythonIdentifier('self');
        case 'Super':
          // super in Python is super() - will be handled specially in call expression
          return new PythonIdentifier('__super__');
        case 'SequenceExpression':
          // Return the last expression
          return this.transformExpression(node.expressions[node.expressions.length - 1]);
        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);
        case 'SpreadElement':
          return this.transformSpreadElement(node);
        case 'AwaitExpression':
          return this.transformAwaitExpression(node);
        default:
          this.warnings.push(`Unsupported expression type: ${node.type}`);
          return new PythonIdentifier('None');
      }
    }

    /**
     * Transform SpreadElement (e.g., ...array)
     * Python equivalent: *array (unpacking)
     */
    transformSpreadElement(node) {
      const argument = this.transformExpression(node.argument);
      // Create a special spread marker that the emitter can handle
      // Python uses *x for unpacking in function calls and [*x] for array unpacking
      return new PythonUnaryExpression('*', argument);
    }

    /**
     * Transform await expression
     * Python: await expression
     */
    transformAwaitExpression(node) {
      const argument = this.transformExpression(node.argument);
      return new PythonUnaryExpression('await', argument);
    }

    transformLiteral(node) {
      if (node.value === null) {
        return PythonLiteral.None();
      }
      if (typeof node.value === 'boolean') {
        return PythonLiteral.Bool(node.value);
      }
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          return PythonLiteral.Int(node.value);
        }
        return PythonLiteral.Float(node.value);
      }
      if (typeof node.value === 'string') {
        return PythonLiteral.Str(node.value);
      }
      // Handle BigInt
      if (typeof node.value === 'bigint' || node.bigint) {
        const bigValue = typeof node.value === 'bigint' ? node.value : BigInt(node.bigint.slice(0, -1));
        return PythonLiteral.Int(Number(bigValue));
      }
      return PythonLiteral.None();
    }

    transformIdentifier(node) {
      // Convert special identifiers
      const name = node.name;
      if (name === 'undefined' || name === 'null') {
        return PythonLiteral.None();
      }
      if (name === 'true') {
        return PythonLiteral.Bool(true);
      }
      if (name === 'false') {
        return PythonLiteral.Bool(false);
      }

      return new PythonIdentifier(toSnakeCase(name));
    }

    transformBinaryExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);
      let operator = node.operator;

      // Map JavaScript operators to Python
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';
      if (operator === '&&') operator = 'and';
      if (operator === '||') operator = 'or';

      // Handle unsigned right shift (convert to mask)
      if (operator === '>>>') {
        // x >>> 0 is a common JavaScript idiom for converting to uint32
        if (node.right.type === 'Literal' && node.right.value === 0) {
          // Just return left (Python int already handles this)
          return left;
        }
        // General case: x >>> n becomes (x >> n) & mask
        const shift = new PythonBinaryExpression(left, '>>', right);
        const mask = PythonLiteral.Int(0xFFFFFFFF);
        return new PythonBinaryExpression(shift, '&', mask);
      }

      return new PythonBinaryExpression(left, operator, right);
    }

    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);
      let operator = node.operator;

      // Map operators
      if (operator === '!') operator = 'not';
      if (operator === 'typeof') {
        // typeof x -> type(x).__name__
        return new PythonMemberAccess(
          new PythonCall(new PythonIdentifier('type'), [operand]),
          '__name__'
        );
      }

      return new PythonUnaryExpression(operator, operand);
    }

    transformUpdateExpression(node) {
      // Convert i++ to i += 1
      const target = this.transformExpression(node.argument);
      const one = PythonLiteral.Int(1);
      const operator = node.operator === '++' ? '+=' : '-=';

      const assignment = new PythonAssignment(target, one);
      assignment.operator = operator;
      assignment.isAugmented = true;

      return assignment;
    }

    transformAssignmentExpression(node) {
      const target = this.transformExpression(node.left);
      const value = this.transformExpression(node.right);

      const assignment = new PythonAssignment(target, value);
      assignment.operator = node.operator;
      assignment.isAugmented = node.operator !== '=';

      return assignment;
    }

    transformMemberExpression(node) {
      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Computed access: obj[prop]
        const property = this.transformExpression(node.property);
        return new PythonSubscript(object, property);
      } else {
        // Dot access: obj.prop
        const propName = node.property.name || node.property.value;
        const property = toSnakeCase(propName);

        // Handle special property mappings
        if (propName === 'length') {
          return new PythonCall(new PythonIdentifier('len'), [object]);
        }

        return new PythonMemberAccess(object, property);
      }
    }

    transformCallExpression(node) {
      const args = node.arguments.map(arg => this.transformExpression(arg));

      if (node.callee.type === 'MemberExpression') {
        const target = this.transformExpression(node.callee.object);
        const methodName = node.callee.property.name || node.callee.property.value;

        // Check for OpCodes methods
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'OpCodes') {
          return this.transformOpCodesCall(methodName, args);
        }

        // Handle Object methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
          // Object.freeze(x) -> x (Python doesn't have freeze, tuples are immutable but lists aren't)
          if (methodName === 'freeze' && args.length === 1)
            return args[0];
          // Object.keys(obj) -> list(obj.keys()) or obj.keys()
          if (methodName === 'keys' && args.length === 1)
            return new PythonCall(new PythonIdentifier('list'), [new PythonCall(new PythonMemberAccess(args[0], 'keys'), [])]);
          // Object.values(obj) -> list(obj.values())
          if (methodName === 'values' && args.length === 1)
            return new PythonCall(new PythonIdentifier('list'), [new PythonCall(new PythonMemberAccess(args[0], 'values'), [])]);
          // Object.entries(obj) -> list(obj.items())
          if (methodName === 'entries' && args.length === 1)
            return new PythonCall(new PythonIdentifier('list'), [new PythonCall(new PythonMemberAccess(args[0], 'items'), [])]);
          // Object.assign(target, source) -> {**target, **source} or target.update(source)
          if (methodName === 'assign' && args.length >= 2) {
            return new PythonCall(new PythonMemberAccess(args[0], 'update'), [args[1]]);
          }
        }

        // Handle array methods
        if (methodName === 'push') {
          // Check if any argument is a spread element (arr.push(...data) -> arr.extend(data))
          const hasSpread = node.arguments.some(arg => arg.type === 'SpreadElement');
          if (hasSpread && node.arguments.length === 1 && node.arguments[0].type === 'SpreadElement') {
            // arr.push(...data) -> arr.extend(data)
            const spreadArg = this.transformExpression(node.arguments[0].argument);
            return new PythonCall(new PythonMemberAccess(target, 'extend'), [spreadArg]);
          }
          // arr.push(x) -> arr.append(x)
          return new PythonCall(new PythonMemberAccess(target, 'append'), args);
        }
        if (methodName === 'pop') {
          return new PythonCall(new PythonMemberAccess(target, 'pop'), []);
        }
        if (methodName === 'slice') {
          if (args.length === 0) {
            return new PythonSubscript(target, new PythonSlice(null, null));
          } else if (args.length === 1) {
            return new PythonSubscript(target, new PythonSlice(args[0], null));
          } else {
            return new PythonSubscript(target, new PythonSlice(args[0], args[1]));
          }
        }
        if (methodName === 'concat') {
          return new PythonBinaryExpression(target, '+', args[0]);
        }
        if (methodName === 'fill') {
          return new PythonBinaryExpression(
            new PythonList([args[0]]),
            '*',
            new PythonCall(new PythonIdentifier('len'), [target])
          );
        }

        // String/array methods
        if (methodName === 'indexOf') {
          // str.indexOf(x) -> str.find(x) for strings, list.index(x) for lists
          // Using find() is safer as it returns -1 on not found
          return new PythonCall(new PythonMemberAccess(target, 'find'), args);
        }
        if (methodName === 'charAt') {
          // str.charAt(i) -> str[i]
          return new PythonSubscript(target, args[0]);
        }
        if (methodName === 'charCodeAt') {
          // str.charCodeAt(i) -> ord(str[i])
          return new PythonCall(new PythonIdentifier('ord'), [new PythonSubscript(target, args[0])]);
        }
        if (methodName === 'fromCharCode') {
          // String.fromCharCode(x) -> chr(x)
          return new PythonCall(new PythonIdentifier('chr'), args);
        }
        if (methodName === 'length') {
          // Handled as property, not method
          return new PythonCall(new PythonIdentifier('len'), [target]);
        }
        if (methodName === 'toString') {
          return new PythonCall(new PythonIdentifier('str'), [target]);
        }
        if (methodName === 'join') {
          // arr.join(sep) -> sep.join(arr)
          if (args.length > 0) {
            return new PythonCall(new PythonMemberAccess(args[0], 'join'), [target]);
          }
          return new PythonCall(new PythonMemberAccess(PythonLiteral.Str(''), 'join'), [target]);
        }
        if (methodName === 'split') {
          return new PythonCall(new PythonMemberAccess(target, 'split'), args);
        }
        if (methodName === 'includes') {
          // arr.includes(x) -> x in arr
          return new PythonBinaryExpression(args[0], 'in', target);
        }
        if (methodName === 'map') {
          // arr.map(fn) -> [fn(x) for x in arr] - simplified to list comprehension marker
          return new PythonListComprehension(
            new PythonCall(args[0], [new PythonIdentifier('x')]),
            new PythonIdentifier('x'),
            target
          );
        }
        if (methodName === 'filter') {
          // arr.filter(fn) -> [x for x in arr if fn(x)]
          return new PythonListComprehension(
            new PythonIdentifier('x'),
            new PythonIdentifier('x'),
            target,
            new PythonCall(args[0], [new PythonIdentifier('x')])
          );
        }
        if (methodName === 'forEach') {
          // This should be a statement, not an expression - emit as a for loop comment
          this.warnings.push('forEach() converted to comment - use for loop instead');
          return new PythonIdentifier('None  # TODO: convert forEach to for loop');
        }

        // Regular method call
        const pyMethodName = toSnakeCase(methodName);
        return new PythonCall(new PythonMemberAccess(target, pyMethodName), args);
      }

      // Handle super() calls
      if (node.callee.type === 'Super') {
        // super(args) in constructor -> super().__init__(args)
        return new PythonCall(
          new PythonMemberAccess(new PythonCall(new PythonIdentifier('super'), []), '__init__'),
          args
        );
      }

      // Simple function call
      const callee = this.transformExpression(node.callee);

      // Check if callee is super marker
      if (callee instanceof PythonIdentifier && callee.name === '__super__') {
        // This shouldn't happen with proper super handling above, but just in case
        return new PythonCall(
          new PythonMemberAccess(new PythonCall(new PythonIdentifier('super'), []), '__init__'),
          args
        );
      }

      return new PythonCall(callee, args);
    }

    transformOpCodesCall(methodName, args) {
      // Check if we have a mapping for this OpCodes method
      if (OPCODES_MAP[methodName]) {
        this.imports.add('struct'); // Most OpCodes methods need struct
        const pythonCode = OPCODES_MAP[methodName](args.map(a => a.toString()));
        // Return a raw code identifier (will be handled by emitter)
        return new PythonIdentifier(pythonCode);
      }

      // Fallback: just call the method as-is
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('opcodes'), toSnakeCase(methodName)),
        args
      );
    }

    transformNewExpression(node) {
      const typeName = node.callee.name;

      // Handle TypedArray constructors with array literals
      const typedArrayMap = {
        'Uint8Array': 'bytes',
        'Uint16Array': 'array.array',
        'Uint32Array': 'array.array',
        'Int8Array': 'array.array',
        'Int16Array': 'array.array',
        'Int32Array': 'array.array',
        'Float32Array': 'array.array',
        'Float64Array': 'array.array'
      };

      if (typedArrayMap[typeName]) {
        const hasArrayInit = node.arguments.length > 0 &&
          node.arguments[0].type === 'ArrayExpression';

        if (hasArrayInit) {
          // new Uint8Array([1, 2, 3]) -> bytes([1, 2, 3]) or bytearray([1, 2, 3])
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          if (typeName === 'Uint8Array')
            return new PythonCall(new PythonIdentifier('bytes'), [new PythonList(elements)]);
          // For other typed arrays, use bytearray or numpy
          return new PythonCall(new PythonIdentifier('bytearray'), [new PythonList(elements)]);
        }

        // Size-based: new Uint8Array(n) -> bytes(n) or bytearray(n)
        const args = node.arguments.map(arg => this.transformExpression(arg));
        if (typeName === 'Uint8Array')
          return new PythonCall(new PythonIdentifier('bytearray'), args);
        return new PythonCall(new PythonIdentifier('bytearray'), args);
      }

      // Handle Array constructor
      if (typeName === 'Array') {
        if (node.arguments.length === 1) {
          // new Array(n) -> [None] * n or [0] * n
          const size = this.transformExpression(node.arguments[0]);
          return new PythonBinaryExpression(new PythonList([PythonLiteral.Int(0)]), '*', size);
        }
        // new Array() -> []
        return new PythonList([]);
      }

      // new ClassName(args) -> ClassName(args)
      const className = typeName ? toPascalCase(typeName) : this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      const callee = typeof className === 'string'
        ? new PythonIdentifier(className)
        : className;

      return new PythonCall(callee, args);
    }

    transformArrayExpression(node) {
      const elements = node.elements.map(el => this.transformExpression(el));
      return new PythonList(elements);
    }

    transformObjectExpression(node) {
      const items = node.properties.map(prop => {
        const key = prop.key.type === 'Identifier'
          ? PythonLiteral.Str(prop.key.name)
          : this.transformExpression(prop.key);
        const value = this.transformExpression(prop.value);
        return { key, value };
      });

      return new PythonDict(items);
    }

    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const trueExpr = this.transformExpression(node.consequent);
      const falseExpr = this.transformExpression(node.alternate);

      return new PythonConditional(trueExpr, condition, falseExpr);
    }

    transformLambdaExpression(node) {
      const params = node.params.map(p => this.transformParameter(p));
      const body = node.body.type === 'BlockStatement'
        ? this.transformExpression(node.body.body[0]?.argument || node.body.body[0]?.expression)
        : this.transformExpression(node.body);

      return new PythonLambda(params, body);
    }

    transformTemplateLiteral(node) {
      // Convert template literal to f-string
      let result = 'f"';
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.raw;
        if (i < node.expressions.length) {
          const expr = this.transformExpression(node.expressions[i]);
          result += `{${expr}}`;
        }
      }
      result += '"';
      return new PythonLiteral(result, 'str');
    }

    // ========================[ TYPE MAPPING ]========================

    mapType(typeNode) {
      if (!typeNode) return null;

      // Handle string type annotations
      if (typeof typeNode === 'string') {
        const mapped = TYPE_MAP[typeNode] || typeNode;
        return this.createPythonType(mapped);
      }

      // Handle TSTypeAnnotation wrapper
      if (typeNode.type === 'TSTypeAnnotation') {
        return this.mapType(typeNode.typeAnnotation);
      }

      // Handle specific type node types
      switch (typeNode.type) {
        case 'TSNumberKeyword':
          return PythonType.Int();
        case 'TSStringKeyword':
          return PythonType.Str();
        case 'TSBooleanKeyword':
          return PythonType.Bool();
        case 'TSVoidKeyword':
        case 'TSUndefinedKeyword':
        case 'TSNullKeyword':
          return PythonType.None();
        case 'TSAnyKeyword':
          return PythonType.Any();
        case 'TSArrayType':
          const elementType = this.mapType(typeNode.elementType);
          this.imports.add('List');
          return PythonType.List(elementType);
        case 'TSTypeReference':
          return this.mapTypeReference(typeNode);
        default:
          return PythonType.Any();
      }
    }

    mapTypeReference(typeNode) {
      const typeName = typeNode.typeName.name;
      const mapped = TYPE_MAP[typeName] || typeName;

      if (mapped === 'List' && typeNode.typeParameters) {
        this.imports.add('List');
        const elementType = this.mapType(typeNode.typeParameters.params[0]);
        return PythonType.List(elementType);
      }

      if (mapped === 'Dict' && typeNode.typeParameters) {
        this.imports.add('Dict');
        const keyType = this.mapType(typeNode.typeParameters.params[0]);
        const valueType = this.mapType(typeNode.typeParameters.params[1]);
        return PythonType.Dict(keyType, valueType);
      }

      return this.createPythonType(mapped);
    }

    createPythonType(typeName) {
      switch (typeName) {
        case 'int':
          return PythonType.Int();
        case 'float':
          return PythonType.Float();
        case 'bool':
          return PythonType.Bool();
        case 'str':
          return PythonType.Str();
        case 'bytes':
          return PythonType.Bytes();
        case 'None':
          return PythonType.None();
        case 'Any':
          this.imports.add('Any');
          return PythonType.Any();
        default:
          return new PythonType(typeName);
      }
    }

    registerImportForType(type) {
      if (!type) return;

      if (type.isList) {
        this.imports.add('List');
      }
      if (type.isDict) {
        this.imports.add('Dict');
      }
      if (type.isOptional) {
        this.imports.add('Optional');
      }
      if (type.name === 'Any') {
        this.imports.add('Any');
      }
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
  const exports = { PythonTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PythonTransformer = PythonTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
