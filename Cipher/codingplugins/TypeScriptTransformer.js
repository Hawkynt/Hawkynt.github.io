/**
 * TypeScriptTransformer.js - IL AST to TypeScript AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to TypeScript AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → TypeScript AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - strictNullChecks: Enable strict null checking
 *   - typeKnowledge: External type information
 */

(function(global) {
  'use strict';

  // Load dependencies
  let TypeScriptAST;
  if (typeof require !== 'undefined') {
    TypeScriptAST = require('./TypeScriptAST.js');
  } else if (global.TypeScriptAST) {
    TypeScriptAST = global.TypeScriptAST;
  }

  const {
    TypeScriptType, TypeScriptCompilationUnit, TypeScriptImportDeclaration, TypeScriptExportDeclaration,
    TypeScriptInterface, TypeScriptTypeAlias, TypeScriptClass, TypeScriptProperty, TypeScriptMethod,
    TypeScriptConstructor, TypeScriptStaticBlock, TypeScriptParameter, TypeScriptBlock, TypeScriptVariableDeclaration,
    TypeScriptExpressionStatement, TypeScriptReturn, TypeScriptIf, TypeScriptFor, TypeScriptForOf,
    TypeScriptWhile, TypeScriptDoWhile, TypeScriptSwitch, TypeScriptSwitchCase, TypeScriptBreak,
    TypeScriptContinue, TypeScriptThrow, TypeScriptTryCatch, TypeScriptCatchClause,
    TypeScriptLiteral, TypeScriptIdentifier, TypeScriptBinaryExpression, TypeScriptUnaryExpression,
    TypeScriptAssignment, TypeScriptMemberAccess, TypeScriptElementAccess, TypeScriptCall,
    TypeScriptNew, TypeScriptArrayLiteral, TypeScriptObjectLiteral, TypeScriptAssertion,
    TypeScriptConditional, TypeScriptArrowFunction, TypeScriptThis, TypeScriptSuper, TypeScriptTypeOf,
    TypeScriptParenthesized, TypeScriptTemplateLiteral, TypeScriptYieldExpression, TypeScriptChainExpression,
    TypeScriptAwaitExpression, TypeScriptDeleteExpression, TypeScriptSpreadElement, TypeScriptSequenceExpression,
    TypeScriptJSDoc
  } = TypeScriptAST;

  /**
   * Maps JavaScript/JSDoc types to TypeScript types
   */
  const TYPE_MAP = {
    // Unsigned integers (crypto context) -> number
    'uint8': 'number', 'byte': 'number',
    'uint16': 'number', 'ushort': 'number', 'word': 'number',
    'uint32': 'number', 'uint': 'number', 'dword': 'number',
    'uint64': 'bigint', 'ulong': 'bigint', 'qword': 'bigint',
    // Signed integers
    'int8': 'number', 'sbyte': 'number',
    'int16': 'number', 'short': 'number',
    'int32': 'number', 'int': 'number',
    'int64': 'bigint', 'long': 'bigint',
    // Floating point
    'float': 'number', 'float32': 'number',
    'double': 'number', 'float64': 'number',
    'number': 'number',
    // Other
    'boolean': 'boolean', 'bool': 'boolean',
    'string': 'string', 'String': 'string',
    'BigInt': 'bigint', 'bigint': 'bigint',
    'void': 'void',
    'object': 'object', 'Object': 'object', 'any': 'any',
    'Array': 'Array', 'array': 'Array'
  };

  /**
   * JavaScript AST to TypeScript AST Transformer
   */
  class TypeScriptTransformer {
    constructor(options = {}) {
      this.options = options;
      this.typeKnowledge = options.typeKnowledge || null;
      this.parser = options.parser || null;
      this.jsDocParser = options.jsDocParser || null;
      this.currentClass = null;
      this.currentMethod = null;
      this.variableTypes = new Map();
      this.classFieldTypes = new Map();
      this.methodSignatures = new Map();
      this.scopeStack = [];
      this.currentArrayElementType = null;
    }

    /**
     * Transform JavaScript AST to TypeScript AST
     * @param {Object} jsAst - JavaScript AST (from acorn/esprima)
     * @returns {TypeScriptCompilationUnit} TypeScript AST
     */
    transform(jsAst) {
      const unit = new TypeScriptCompilationUnit();

      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          // Check for IIFE wrapper (UMD pattern) and extract content
          if (this.isIIFE(node)) {
            const extractedNodes = this.extractIIFEContent(node);
            for (const extracted of extractedNodes) {
              this.addToUnit(unit, extracted);
            }
          } else {
            const transformed = this.transformNode(node);
            if (transformed) {
              this.addToUnit(unit, transformed);
            }
          }
        }
      }

      return unit;
    }

    /**
     * Add a transformed node to the appropriate unit collection
     */
    addToUnit(unit, transformed) {
      if (!transformed) return;

      // Handle arrays (e.g., from multi-variable declarations like: const a = 1, b = 2)
      if (Array.isArray(transformed)) {
        for (const item of transformed)
          this.addToUnit(unit, item);
        return;
      }

      if (transformed.nodeType === 'Class') {
        unit.types.push(transformed);
      } else if (transformed.nodeType === 'ImportDeclaration') {
        unit.imports.push(transformed);
      } else if (transformed.nodeType === 'ExportDeclaration') {
        unit.exports.push(transformed);
      } else {
        unit.statements.push(transformed);
      }
    }

    /**
     * Check if a node is an IIFE (Immediately Invoked Function Expression)
     */
    isIIFE(node) {
      if (node.type !== 'ExpressionStatement') return false;
      if (node.expression.type !== 'CallExpression') return false;
      const callee = node.expression.callee;
      return callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression';
    }

    /**
     * Extract content from IIFE wrapper
     * Handles UMD pattern: (function(root, factory) { ... })((function(){...})(), function(deps) { ... })
     */
    extractIIFEContent(node) {
      const results = [];
      const callExpr = node.expression;

      // First, try to find the factory function in UMD pattern
      // UMD pattern: the second argument is usually the factory function
      if (callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          // Found UMD factory function - extract from its body
          if (factoryArg.body && factoryArg.body.body) {
            for (const stmt of factoryArg.body.body) {
              const transformed = this.transformTopLevelStatement(stmt);
              if (transformed) {
                if (Array.isArray(transformed)) {
                  results.push(...transformed);
                } else {
                  results.push(transformed);
                }
              }
            }
            return results;
          }
        }
      }

      // Simple IIFE pattern: extract from callee's body
      const callee = callExpr.callee;
      if (callee.body && callee.body.body) {
        for (const stmt of callee.body.body) {
          const transformed = this.transformTopLevelStatement(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) {
              results.push(...transformed);
            } else {
              results.push(transformed);
            }
          }
        }
      }

      return results;
    }

    /**
     * Transform a top-level statement from IIFE content
     */
    transformTopLevelStatement(node) {
      // Skip 'use strict' and other expression statements that aren't useful
      if (node.type === 'ExpressionStatement') {
        // Skip string literals ('use strict')
        if (node.expression.type === 'Literal' && typeof node.expression.value === 'string')
          return null;

        // Transform useful expression statements (like RegisterAlgorithm calls)
        if (node.expression.type === 'CallExpression')
          return this.transformExpressionStatement(node);

        // Skip other expression statements
        return null;
      }

      // Skip if statements (usually feature detection)
      if (node.type === 'IfStatement') return null;

      // Skip return statements at top level (module exports from UMD)
      if (node.type === 'ReturnStatement') return null;

      // Process class declarations
      if (node.type === 'ClassDeclaration')
        return this.transformClassDeclaration(node);

      // Process function declarations
      if (node.type === 'FunctionDeclaration')
        return this.transformFunctionDeclaration(node);

      // Process variable declarations
      if (node.type === 'VariableDeclaration')
        return this.transformVariableDeclaration(node);

      return null;
    }

    /**
     * Transform any JavaScript AST node to TypeScript AST
     */
    transformNode(node) {
      if (!node) return null;

      // Try specific transformer first
      const methodName = `transform${node.type}`;
      if (typeof this[methodName] === 'function') {
        return this[methodName](node);
      }

      // Fall back to statement/expression transformers
      const statementTypes = ['VariableDeclaration', 'ExpressionStatement', 'ReturnStatement',
        'IfStatement', 'ForStatement', 'ForOfStatement', 'ForInStatement', 'WhileStatement',
        'DoWhileStatement', 'SwitchStatement', 'BreakStatement', 'ContinueStatement',
        'ThrowStatement', 'TryStatement', 'BlockStatement', 'EmptyStatement'];

      const expressionTypes = ['Literal', 'Identifier', 'BinaryExpression', 'LogicalExpression',
        'UnaryExpression', 'UpdateExpression', 'AssignmentExpression', 'MemberExpression',
        'CallExpression', 'NewExpression', 'ArrayExpression', 'ObjectExpression',
        'ConditionalExpression', 'ArrowFunctionExpression', 'FunctionExpression',
        'ThisExpression', 'TemplateLiteral', 'SequenceExpression', 'SpreadElement',
        'ChainExpression', 'YieldExpression', 'ClassExpression', 'PrivateIdentifier',
        // IL AST node types that should be handled as expressions
        'ThisPropertyAccess', 'ThisMethodCall', 'ParentMethodCall', 'ParentConstructorCall',
        'ErrorCreation', 'StringToBytes', 'BytesToString', 'HexDecode', 'HexEncode',
        'ArrayCreation', 'TypedArrayCreation', 'ArrayLength', 'ArrayIndexOf', 'ArrayIncludes',
        'ArraySlice', 'ArrayConcat', 'ArrayAppend', 'ArrayReverse', 'ArrayFill', 'ArrayClear',
        'ArrayJoin', 'ArrayPop', 'ArrayShift', 'ArraySplice', 'Cast', 'UnpackBytes', 'PackBytes', 'OpCodesCall',
        'MathCall', 'Rotation', 'BitwiseOperation',
        'Floor', 'Ceil', 'Round', 'Abs', 'Min', 'Max', 'RotateLeft', 'RotateRight',
        'TypedArraySet', 'TypedArraySubarray', 'MapSet', 'MapGet', 'MapHas', 'MapDelete',
        'DataViewCreation', 'BufferCreation', 'BigIntConversion', 'StringLength',
        // Additional IL AST expression types
        'ArrayMap', 'ArrayForEach', 'ArrayFilter', 'ArrayFind', 'ArrayReduce', 'ArrayEvery',
        'ArraySome', 'ArraySort', 'ArrayUnshift', 'ArrayLiteral', 'ArrayXor',
        'StringRepeat', 'StringReplace', 'StringTransform', 'StringCharCodeAt', 'StringSplit',
        'StringSubstring', 'StringIndexOf', 'BigIntCast', 'Power', 'Sqrt', 'FieldDefinition',
        'MapCreation', 'SetCreation', 'RegExpCreation', 'Typeof', 'Instanceof',
        'Log', 'Log2', 'Log10', 'Random', 'Sin', 'Cos', 'Tan', 'Asin', 'Acos', 'Atan', 'Atan2', 'Exp', 'Sign', 'Trunc',
        'Sinh', 'Cosh', 'Tanh', 'Cbrt', 'Hypot', 'Fround', 'MathConstant', 'NumberConstant', 'InstanceOfCheck',
        'StringCharAt', 'StringIncludes', 'StringStartsWith', 'StringEndsWith', 'StringTrim', 'StringPadStart', 'StringPadEnd',
        'ArrayFindIndex', 'ArrayLastIndexOf', 'ArrayCopyWithin', 'ArrayFlat', 'ArrayFlatMap', 'ArrayFrom', 'ArrayOf',
        'StringToLowerCase', 'StringToUpperCase', 'StringNormalize', 'StringSlice', 'StringConcat', 'StringLocaleCompare',
        'NumberParseInt', 'NumberParseFloat', 'NumberIsNaN', 'NumberIsFinite', 'NumberToFixed', 'NumberToPrecision',
        'ObjectKeys', 'ObjectValues', 'ObjectEntries', 'ObjectAssign', 'ObjectFreeze', 'ObjectSeal',
        'JsonParse', 'JsonStringify', 'PromiseResolve', 'PromiseReject', 'PromiseAll', 'DateNow', 'DateParse',
        // New IL AST node types from enhanced JS-to-IL transformer
        'DebugOutput', 'TypeOfExpression', 'DeleteExpression', 'StringInterpolation',
        'SpreadElement', 'RestParameter', 'ObjectLiteral', 'ArrowFunction', 'FunctionExpression',
        'AwaitExpression', 'YieldExpression', 'DataViewRead', 'DataViewWrite',
        'IsArrayCheck', 'ObjectMerge', 'ObjectHasProperty', 'ObjectFromEntries',
        'StringFromCharCodes', 'StringFromCodePoints', 'IsIntegerCheck', 'IsNaNCheck', 'IsFiniteCheck',
        'ParseInteger', 'ParseFloat', 'JsonSerialize', 'JsonDeserialize', 'SequenceExpression'];

      if (statementTypes.includes(node.type)) {
        return this.transformStatement(node);
      }

      if (expressionTypes.includes(node.type)) {
        return this.transformExpression(node);
      }

      console.warn(`No transformer for node type: ${node.type}`);
      return null;
    }

    // ========================[ TYPE SYSTEM ]========================

    /**
     * Map JavaScript type to TypeScript type
     */
    mapType(jsType) {
      if (!jsType) return TypeScriptType.Any();

      // Handle array types
      if (jsType.endsWith('[]')) {
        const elementTypeName = jsType.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return TypeScriptType.Array(elementType);
      }

      // Handle typed arrays
      if (jsType === 'Uint8Array') return TypeScriptType.Uint8Array();
      if (jsType === 'Uint16Array') return TypeScriptType.Uint16Array();
      if (jsType === 'Uint32Array') return TypeScriptType.Uint32Array();

      // Map primitive types
      const mappedType = TYPE_MAP[jsType] || jsType;
      switch (mappedType) {
        case 'number': return TypeScriptType.Number();
        case 'string': return TypeScriptType.String();
        case 'boolean': return TypeScriptType.Boolean();
        case 'void': return TypeScriptType.Void();
        case 'bigint': return TypeScriptType.BigInt();
        case 'any': return TypeScriptType.Any();
        default: return new TypeScriptType(mappedType);
      }
    }

    /**
     * Infer type from JavaScript literal/expression
     */
    inferType(node) {
      if (!node) return TypeScriptType.Any();

      switch (node.type) {
        case 'Literal':
          if (typeof node.value === 'number') return TypeScriptType.Number();
          if (typeof node.value === 'string') return TypeScriptType.String();
          if (typeof node.value === 'boolean') return TypeScriptType.Boolean();
          if (typeof node.value === 'bigint') return TypeScriptType.BigInt();
          if (node.value === null) return TypeScriptType.Null();
          if (node.value === undefined) return TypeScriptType.Undefined();
          return TypeScriptType.Any();
        case 'ArrayExpression':
          if (node.elements.length > 0) {
            const firstType = this.inferType(node.elements[0]);
            return TypeScriptType.Array(firstType);
          }
          return TypeScriptType.Array(TypeScriptType.Number()); // Default to number[]
        case 'ObjectExpression':
          return new TypeScriptType('object');
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return TypeScriptType.Any(); // Function type
        case 'NewExpression':
          return this.inferNewExpressionType(node);
        case 'CallExpression':
          return this.inferCallExpressionType(node);
        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.inferBinaryExpressionType(node);
        case 'Identifier':
          return this.getVariableType(node.name) || TypeScriptType.Any();
        case 'MemberExpression':
          return this.inferMemberExpressionType(node);
        default:
          return TypeScriptType.Any();
      }
    }

    /**
     * Infer type from new expression
     */
    inferNewExpressionType(node) {
      if (node.callee.type === 'Identifier') {
        const typeName = node.callee.name;
        if (typeName === 'Uint8Array') return TypeScriptType.Uint8Array();
        if (typeName === 'Uint16Array') return TypeScriptType.Uint16Array();
        if (typeName === 'Uint32Array') return TypeScriptType.Uint32Array();
        if (typeName === 'Array') return TypeScriptType.Array(TypeScriptType.Number());
        return new TypeScriptType(typeName);
      }
      return TypeScriptType.Any();
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

        // Array methods
        const objType = this.inferType(obj);
        if (objType.isArray) {
          if (method === 'slice' || method === 'concat' || method === 'filter') {
            return objType;
          }
          if (method === 'pop' || method === 'shift') {
            return objType.elementType || TypeScriptType.Any();
          }
        }
      }
      return TypeScriptType.Any();
    }

    /**
     * Infer type from binary expression
     */
    inferBinaryExpressionType(node) {
      const op = node.operator;

      // Comparison and logical operators return boolean
      if (['==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||'].includes(op)) {
        return TypeScriptType.Boolean();
      }

      // Arithmetic and bitwise operators return number
      return TypeScriptType.Number();
    }

    /**
     * Infer type from member expression
     */
    inferMemberExpressionType(node) {
      const propName = node.property.name || node.property.value;

      if (propName === 'length') return TypeScriptType.Number();

      const objType = this.inferType(node.object);
      if (objType.isArray && node.computed) {
        return objType.elementType || TypeScriptType.Any();
      }

      return TypeScriptType.Any();
    }

    /**
     * Get OpCodes return type from typeKnowledge
     */
    getOpCodesReturnType(methodName) {
      if (!this.typeKnowledge?.opCodesTypes) return null;
      const methodInfo = this.typeKnowledge.opCodesTypes[methodName];
      if (!methodInfo) return null;
      return this.mapTypeFromKnowledge(methodInfo.returns);
    }

    /**
     * Map type from knowledge base to TypeScript type
     */
    mapTypeFromKnowledge(typeName) {
      if (!typeName) return TypeScriptType.Any();

      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapTypeFromKnowledge(elementTypeName);
        return TypeScriptType.Array(elementType);
      }

      // Map crypto types to TypeScript types
      const typeMap = {
        'byte': TypeScriptType.Number(),
        'word': TypeScriptType.Number(),
        'dword': TypeScriptType.Number(),
        'uint': TypeScriptType.Number(),
        'uint8': TypeScriptType.Number(),
        'uint16': TypeScriptType.Number(),
        'uint32': TypeScriptType.Number(),
        'uint64': TypeScriptType.BigInt(),
        'int': TypeScriptType.Number(),
        'number': TypeScriptType.Number(),
        'string': TypeScriptType.String(),
        'boolean': TypeScriptType.Boolean(),
        'void': TypeScriptType.Void()
      };

      return typeMap[typeName] || TypeScriptType.Any();
    }

    /**
     * Push scope for nested functions
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
     * Extract JSDoc type info from function node
     */
    extractTypeInfo(funcNode) {
      if (!funcNode.leadingComments || !this.jsDocParser) return null;

      for (const comment of funcNode.leadingComments) {
        if (comment.type === 'Block' && comment.value.includes('@')) {
          const parsed = this.jsDocParser.parse('/*' + comment.value + '*/');
          if (parsed) return parsed;
        }
      }
      return null;
    }

    /**
     * Convert name to PascalCase
     */
    toPascalCase(name) {
      if (!name) return '';
      return name.replace(/(?:^|_)([a-z])/g, (_, c) => c.toUpperCase());
    }

    /**
     * Convert name to camelCase
     */
    toCamelCase(name) {
      if (!name) return '';
      const pascal = this.toPascalCase(name);
      return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }

    /**
     * Get variable type from registry
     */
    getVariableType(name) {
      return this.variableTypes.get(name) || null;
    }

    /**
     * Register variable type
     */
    registerVariableType(name, type) {
      this.variableTypes.set(name, type);
    }

    // ========================[ FUNCTION TRANSFORMATION ]========================

    transformFunctionDeclaration(node) {
      const method = new TypeScriptMethod(
        node.id.name,
        TypeScriptType.Any() // Default return type
      );

      // Transform parameters
      if (node.params) {
        for (const param of node.params) {
          method.parameters.push(this.transformParameter(param));
        }
      }

      // Transform body
      if (node.body) {
        method.body = this.transformNode(node.body);
      }

      return method;
    }

    // ========================[ CLASS TRANSFORMATION ]========================

    transformClassDeclaration(node) {
      const tsClass = new TypeScriptClass(node.id.name);
      tsClass.isExported = false; // Check parent for export
      this.currentClass = tsClass;

      if (node.superClass) {
        tsClass.baseClass = new TypeScriptType(node.superClass.name);
      }

      // Handle both class body structures:
      // - Standard: {type: 'ClassBody', body: [...]}
      // - Unwrapped UMD: array directly
      const members = node.body?.body || node.body || [];

      if (members && members.length > 0) {
        for (const member of members) {
          // Handle different member types
          if (member.type === 'MethodDefinition') {
            const transformed = this.transformMethodDefinition(member);
            if (transformed) {
              tsClass.members.push(transformed);
            }
          } else if (member.type === 'PropertyDefinition') {
            const transformed = this.transformPropertyDefinition(member);
            if (transformed) {
              tsClass.members.push(transformed);
            }
          } else if (member.type === 'StaticBlock') {
            const transformed = this.transformStaticBlock(member);
            if (transformed) {
              tsClass.members.push(transformed);
            }
          } else {
            const transformed = this.transformNode(member);
            if (transformed) {
              tsClass.members.push(transformed);
            }
          }
        }
      }

      this.currentClass = null;
      return tsClass;
    }

    /**
     * Transform property definition
     */
    transformPropertyDefinition(node) {
      const name = node.key.name;
      const type = node.value ? this.inferType(node.value) : TypeScriptType.Any();
      const initializer = node.value ? this.transformExpression(node.value) : null;

      const prop = new TypeScriptProperty(name, type);
      prop.initializer = initializer;
      prop.isStatic = node.static || false;

      if (name.startsWith('_')) {
        prop.accessibility = 'private';
      } else {
        prop.accessibility = 'public';
      }

      return prop;
    }

    transformStaticBlock(node) {
      // TypeScript/ES2022 supports static blocks natively
      // static { code } -> static { code }
      const staticBlock = new TypeScriptStaticBlock();
      const block = new TypeScriptBlock();

      // Handle both array body and BlockStatement body
      const bodyStatements = Array.isArray(node.body)
        ? node.body
        : (node.body?.body || []);

      for (const stmt of bodyStatements) {
        const transformed = this.transformStatement(stmt);
        if (transformed) {
          if (Array.isArray(transformed)) {
            block.statements.push(...transformed);
          } else {
            block.statements.push(transformed);
          }
        }
      }

      staticBlock.body = block;
      return staticBlock;
    }

    transformClassExpression(node) {
      // ClassExpression -> anonymous class in TypeScript
      const classDecl = new TypeScriptClass(node.id?.name || 'AnonymousClass');

      if (node.superClass)
        classDecl.extends = this.transformExpression(node.superClass);

      if (node.body?.body) {
        for (const member of node.body.body) {
          if (member.type === 'MethodDefinition') {
            const method = this.transformMethodDefinition(member);
            if (method)
              classDecl.members.push(method);
          } else if (member.type === 'PropertyDefinition') {
            const prop = this.transformPropertyDefinition(member);
            if (prop)
              classDecl.members.push(prop);
          }
        }
      }

      return classDecl;
    }

    transformYieldExpression(node) {
      // yield value or yield* iterable
      const argument = node.argument ? this.transformExpression(node.argument) : null;
      return new TypeScriptYieldExpression(argument, node.delegate || false);
    }

    transformMethodDefinition(node) {
      if (node.kind === 'constructor')
        return this.transformConstructor(node);

      this.pushScope();

      const isGetter = node.kind === 'get';
      const isSetter = node.kind === 'set';

      const typeInfo = this.extractTypeInfo(node.value);
      let returnType = TypeScriptType.Void();

      if (isGetter) {
        // Getters should return Any by default since they return a property value
        returnType = TypeScriptType.Any();
      }

      if (typeInfo?.returns) {
        returnType = this.mapType(typeInfo.returns);
      } else if (node.value.body && !isSetter) {
        // Infer from return statements (but not for setters which return void)
        const hasReturn = this.hasReturnWithValue(node.value.body);
        if (hasReturn)
          returnType = this.inferReturnType(node.value.body) || TypeScriptType.Any();
      }

      const method = new TypeScriptMethod(node.key.name, returnType);
      method.isStatic = node.static || false;
      method.isGetter = isGetter;
      method.isSetter = isSetter;

      // Access modifier based on naming convention
      if (node.key.name.startsWith('_')) {
        method.accessibility = 'private';
      } else {
        method.accessibility = 'public';
      }

      // Transform parameters with type inference
      if (node.value.params) {
        for (let i = 0; i < node.value.params.length; i++) {
          const param = node.value.params[i];
          let paramType = TypeScriptType.Any();

          if (typeInfo?.params && typeInfo.params.has(param.name)) {
            paramType = this.mapType(typeInfo.params.get(param.name));
          }

          const tsParam = new TypeScriptParameter(param.name, paramType);
          method.parameters.push(tsParam);
          this.variableTypes.set(param.name, paramType);
        }
      }

      // Transform body
      if (node.value.body) {
        method.body = this.transformFunctionBody(node.value.body);
      }

      this.popScope();
      return method;
    }

    /**
     * Transform function body to TypeScript block
     */
    transformFunctionBody(bodyNode) {
      const block = new TypeScriptBlock();

      if (bodyNode.type === 'BlockStatement') {
        for (const stmt of bodyNode.body) {
          const transformed = this.transformStatement(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) {
              block.statements.push(...transformed);
            } else {
              block.statements.push(transformed);
            }
          }
        }
      } else {
        // Arrow function with expression body
        const expr = this.transformExpression(bodyNode);
        block.statements.push(new TypeScriptReturn(expr));
      }

      return block;
    }

    /**
     * Check if function body has return statement with value
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
          returnTypes.push(this.inferType(node.argument));
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

      // Filter out null types and get unique non-null, non-any types
      const nonNullTypes = returnTypes.filter(t => t.name !== 'null');
      const nonAnyTypes = nonNullTypes.filter(t => t.name !== 'any');

      // If we have multiple different return types, use 'any'
      if (nonAnyTypes.length > 1) {
        const uniqueTypeNames = [...new Set(nonAnyTypes.map(t => t.name))];
        if (uniqueTypeNames.length > 1)
          return TypeScriptType.Any();
      }

      // If there's a non-null, non-any type, use it
      if (nonAnyTypes.length > 0)
        return nonAnyTypes[0];

      // If only null returns, use 'any' (common pattern for factory methods returning null on error)
      if (returnTypes.every(t => t.name === 'null'))
        return TypeScriptType.Any();

      // Fall back to any
      return TypeScriptType.Any();
    }

    transformConstructor(node) {
      const constructor = new TypeScriptConstructor();

      if (node.value.params) {
        for (const param of node.value.params) {
          constructor.parameters.push(this.transformParameter(param));
        }
      }

      if (node.value.body) {
        constructor.body = this.transformNode(node.value.body);
      }

      return constructor;
    }

    transformParameter(node) {
      const name = node.name || (node.type === 'Identifier' ? node.name : 'param');
      const type = this.inferType(node);
      return new TypeScriptParameter(name, type);
    }

    // ========================[ STATEMENTS ]========================

    /**
     * Transform any statement node
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
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
        case 'ForInStatement':
          return this.transformForOfStatement(node);

        case 'WhileStatement':
          return this.transformWhileStatement(node);

        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);

        case 'SwitchStatement':
          return this.transformSwitchStatement(node);

        case 'BreakStatement':
          return this.transformBreakStatement(node);

        case 'ContinueStatement':
          return this.transformContinueStatement(node);

        case 'ThrowStatement':
          return this.transformThrowStatement(node);

        case 'TryStatement':
          return this.transformTryStatement(node);

        case 'BlockStatement':
          return this.transformBlockStatement(node);

        case 'EmptyStatement':
          return null;

        case 'ClassDeclaration':
          return this.transformClassDeclaration(node);

        case 'FunctionDeclaration':
          return this.transformFunctionDeclaration(node);

        case 'LabeledStatement':
          return this.transformLabeledStatement(node);

        default:
          console.warn(`Unhandled statement type: ${node.type}`);
          return null;
      }
    }

    transformBlockStatement(node) {
      const block = new TypeScriptBlock();
      if (node.body) {
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
      }
      return block;
    }

    transformVariableDeclaration(node) {
      const declarations = [];
      for (const decl of node.declarations) {
        // Skip ObjectPattern destructuring (e.g., const { RegisterAlgorithm } = AlgorithmFramework)
        if (decl.id.type === 'ObjectPattern')
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        // TypeScript supports native destructuring, but we'll expand it for consistency
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = elem.name;
              const indexExpr = new TypeScriptElementAccess(sourceExpr, TypeScriptLiteral.Number(i));
              const varType = TypeScriptType.Any();

              const varDecl = new TypeScriptVariableDeclaration(varName, varType, indexExpr);
              varDecl.kind = node.kind === 'var' ? 'let' : (node.kind || 'const');
              declarations.push(varDecl);
              this.variableTypes.set(varName, varType);
            }
          }
          continue;
        }

        const name = decl.id.name;
        const type = decl.init ? this.inferType(decl.init) : TypeScriptType.Any();
        const initializer = decl.init ? this.transformExpression(decl.init) : null;

        const varDecl = new TypeScriptVariableDeclaration(name, type, initializer);
        // Prefer const/let over var in TypeScript
        varDecl.kind = node.kind === 'var' ? 'let' : (node.kind || 'const');
        declarations.push(varDecl);

        this.variableTypes.set(name, type);
      }
      return declarations.length === 1 ? declarations[0] : declarations;
    }

    transformExpressionStatement(node) {
      const expr = this.transformNode(node.expression);
      return expr ? new TypeScriptExpressionStatement(expr) : null;
    }

    transformReturnStatement(node) {
      const expr = node.argument ? this.transformNode(node.argument) : null;
      return new TypeScriptReturn(expr);
    }

    transformIfStatement(node) {
      const condition = this.transformNode(node.test);
      const thenBranch = this.transformNode(node.consequent);
      const elseBranch = node.alternate ? this.transformNode(node.alternate) : null;
      return new TypeScriptIf(condition, thenBranch, elseBranch);
    }

    transformForStatement(node) {
      const forStmt = new TypeScriptFor();
      forStmt.initializer = node.init ? this.transformNode(node.init) : null;
      forStmt.condition = node.test ? this.transformNode(node.test) : null;
      forStmt.incrementor = node.update ? this.transformNode(node.update) : null;
      forStmt.body = node.body ? this.transformNode(node.body) : new TypeScriptBlock();
      return forStmt;
    }

    transformForOfStatement(node) {
      const varName = node.left.declarations ? node.left.declarations[0].id.name : 'item';
      const varType = TypeScriptType.Any();
      const collection = this.transformNode(node.right);
      const body = this.transformNode(node.body);
      return new TypeScriptForOf(varName, varType, collection, body);
    }

    transformWhileStatement(node) {
      const condition = this.transformNode(node.test);
      const body = this.transformNode(node.body);
      return new TypeScriptWhile(condition, body);
    }

    transformDoWhileStatement(node) {
      const body = this.transformNode(node.body);
      const condition = this.transformNode(node.test);
      return new TypeScriptDoWhile(body, condition);
    }

    transformSwitchStatement(node) {
      const switchStmt = new TypeScriptSwitch(this.transformNode(node.discriminant));
      for (const caseNode of node.cases) {
        switchStmt.cases.push(this.transformNode(caseNode));
      }
      return switchStmt;
    }

    transformSwitchCase(node) {
      const label = node.test ? this.transformNode(node.test) : null;
      const caseStmt = new TypeScriptSwitchCase(label);
      for (const stmt of node.consequent) {
        const transformed = this.transformNode(stmt);
        if (transformed) {
          caseStmt.statements.push(transformed);
        }
      }
      return caseStmt;
    }

    transformBreakStatement(node) {
      const label = node.label?.name || null;
      return new TypeScriptBreak(label);
    }

    transformContinueStatement(node) {
      const label = node.label?.name || null;
      return new TypeScriptContinue(label);
    }

    transformThrowStatement(node) {
      return new TypeScriptThrow(this.transformNode(node.argument));
    }

    transformTryStatement(node) {
      const tryCatch = new TypeScriptTryCatch();
      tryCatch.tryBlock = this.transformNode(node.block);

      if (node.handler) {
        const catchClause = new TypeScriptCatchClause(
          node.handler.param ? node.handler.param.name : 'error',
          TypeScriptType.Any(),
          this.transformNode(node.handler.body)
        );
        tryCatch.catchClauses.push(catchClause);
      }

      if (node.finalizer) {
        tryCatch.finallyBlock = this.transformNode(node.finalizer);
      }

      return tryCatch;
    }

    transformLabeledStatement(node) {
      // TypeScript supports labeled statements natively: label: statement
      // Transform the body statement and wrap in a labeled block
      const body = this.transformStatement(node.body);
      const label = node.label?.name || 'label';

      // Create a block that will be emitted with the label
      const block = new TypeScriptBlock();
      block.label = label;
      if (body) {
        if (Array.isArray(body)) {
          block.statements.push(...body);
        } else {
          block.statements.push(body);
        }
      }
      return block;
    }

    // ========================[ EXPRESSIONS ]========================

    /**
     * Transform any expression node
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
          return this.transformArrowFunctionExpression(node);

        case 'ThisExpression':
          return this.transformThisExpression(node);

        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        case 'SequenceExpression':
          return this.transformSequenceExpression(node);

        case 'SpreadElement': {
          // Handle both JS AST SpreadElement and IL AST SpreadElement
          const spreadArg = this.transformExpression(node.argument);
          return new TypeScriptSpreadElement(spreadArg);
        }

        case 'Super':
          return new TypeScriptSuper();

        case 'ObjectPattern':
          // Object destructuring - TypeScript supports this natively
          // Return a comment placeholder
          return new TypeScriptIdentifier('/* Object destructuring pattern */');

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - TypeScript supports this natively
          const chainedExpr = this.transformExpression(node.expression);
          return new TypeScriptChainExpression(chainedExpr);

        case 'ClassExpression':
          // Anonymous class expression - transform like class declaration but return as expression
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield value or yield* iterable
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> TypeScript private field
          return new TypeScriptIdentifier('#' + node.name);

        // ========================[ IL AST NODE TYPES ]========================
        // These are language-agnostic intermediate nodes from the type-aware transpiler

        case 'ThisPropertyAccess': {
          // IL AST: this.property → TypeScript: this.property
          const target = new TypeScriptThis();
          return new TypeScriptMemberAccess(target, node.property);
        }

        case 'ThisMethodCall': {
          // IL AST: this.method(...) → TypeScript: this.method(...)
          const target = new TypeScriptThis();
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          return new TypeScriptCall(target, node.method, args);
        }

        case 'ParentMethodCall': {
          // IL AST: super.method(...) → TypeScript: super.method(...)
          const target = new TypeScriptSuper();
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          return new TypeScriptCall(target, node.method, args);
        }

        case 'ParentConstructorCall': {
          // IL AST: super(...) → TypeScript: super(...)
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          return new TypeScriptCall(null, 'super', args);
        }

        case 'HexDecode': {
          // IL AST: hex string to bytes → TypeScript: helper function call
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          return new TypeScriptCall(null, 'hexToBytes', [value]);
        }

        case 'HexEncode': {
          // IL AST: bytes to hex string → TypeScript: helper function call
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          return new TypeScriptCall(null, 'bytesToHex', [value]);
        }

        // IL AST Error node
        case 'ErrorCreation': {
          // TypeScript uses new Error(message) just like JavaScript
          const errorType = node.errorType || 'Error';
          return new TypeScriptNew(
            new TypeScriptType(errorType),
            [node.message ? this.transformExpression(node.message) : TypeScriptLiteral.String('')]
          );
        }

        // Array operations - TypeScript uses native JavaScript array methods
        case 'ArrayIndexOf': {
          const array = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new TypeScriptCall(array, 'indexOf', [value]);
        }

        case 'ArrayIncludes': {
          const array = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new TypeScriptCall(array, 'includes', [value]);
        }

        case 'ArrayConcat': {
          const array = this.transformExpression(node.array);
          const other = this.transformExpression(node.other);
          return new TypeScriptCall(array, 'concat', [other]);
        }

        case 'ArrayJoin': {
          const array = this.transformExpression(node.array);
          const separator = node.separator ? this.transformExpression(node.separator) : TypeScriptLiteral.String('');
          return new TypeScriptCall(array, 'join', [separator]);
        }

        case 'ArrayReverse': {
          const array = this.transformExpression(node.array);
          return new TypeScriptCall(array, 'reverse', []);
        }

        case 'ArrayPop': {
          const array = this.transformExpression(node.array);
          return new TypeScriptCall(array, 'pop', []);
        }

        case 'ArrayShift': {
          const array = this.transformExpression(node.array);
          return new TypeScriptCall(array, 'shift', []);
        }

        case 'ArrayLength': {
          const array = this.transformExpression(node.array);
          return new TypeScriptMemberAccess(array, 'length');
        }

        case 'ArrayAppend': {
          const array = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new TypeScriptCall(array, 'push', [value]);
        }

        case 'ArraySlice': {
          const array = this.transformExpression(node.array);
          const start = node.start ? this.transformExpression(node.start) : null;
          const end = node.end ? this.transformExpression(node.end) : null;
          const args = [];
          if (start) args.push(start);
          if (end) args.push(end);
          return new TypeScriptCall(array, 'slice', args);
        }

        case 'ArrayFill': {
          const array = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new TypeScriptCall(array, 'fill', [value]);
        }

        case 'ArrayClear': {
          const array = this.transformExpression(node.array || node.arguments?.[0]);
          return new TypeScriptCall(array, 'splice', [TypeScriptLiteral.Number(0)]);
        }

        case 'ArrayCreation': {
          const size = node.size ? this.transformExpression(node.size) : null;
          if (size) {
            return new TypeScriptNew(
              new TypeScriptType('Array'),
              [size]
            );
          }
          return new TypeScriptArrayLiteral([]);
        }

        case 'TypedArrayCreation': {
          const size = node.size ? this.transformExpression(node.size) : TypeScriptLiteral.Number(0);
          const arrayType = node.arrayType || 'Uint8Array';
          return new TypeScriptNew(
            new TypeScriptType(arrayType),
            [size]
          );
        }

        case 'StringToBytes': {
          // TypeScript: new TextEncoder().encode(string) or Array.from(string, c => c.charCodeAt(0))
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          // Use TextEncoder for UTF-8, or simpler approach for ASCII
          return new TypeScriptCall(
            new TypeScriptNew(new TypeScriptType('TextEncoder'), []),
            'encode',
            [value]
          );
        }

        case 'BytesToString': {
          // TypeScript: new TextDecoder().decode(bytes)
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          return new TypeScriptCall(
            new TypeScriptNew(new TypeScriptType('TextDecoder'), []),
            'decode',
            [value]
          );
        }

        // Fallback for unknown OpCodes methods
        case 'OpCodesCall': {
          const args = node.arguments.map(a => this.transformExpression(a));
          // Handle specific OpCodes methods that need special TypeScript translation
          switch (node.method) {
            case 'CopyArray':
              // [...array] or array.slice() in TypeScript
              return new TypeScriptCall(args[0], 'slice', []);
            case 'ClearArray':
              // array.length = 0 or array.splice(0) in TypeScript
              return new TypeScriptCall(args[0], 'splice', [TypeScriptLiteral.Number(0)]);
            default:
              // Generic fallback - call method as function
              return new TypeScriptCall(null, node.method, args);
          }
        }

        // Type casting - TypeScript doesn't need explicit numeric casts but may use 'as' for type assertions
        case 'Cast': {
          const value = this.transformExpression(node.arguments?.[0] || node.expression || node.value);
          const targetType = node.targetType || node.toType || 'number';

          // For numeric types, use JavaScript runtime coercion or bitwise ops
          switch (targetType) {
            case 'uint8':
            case 'byte':
              // value & 0xFF
              return new TypeScriptBinaryExpression(value, '&', TypeScriptLiteral.Number(0xFF));
            case 'uint16':
              // value & 0xFFFF
              return new TypeScriptBinaryExpression(value, '&', TypeScriptLiteral.Number(0xFFFF));
            case 'uint32':
              // value >>> 0
              return new TypeScriptBinaryExpression(value, '>>>', TypeScriptLiteral.Number(0));
            case 'int32':
            case 'int':
              // value | 0
              return new TypeScriptBinaryExpression(value, '|', TypeScriptLiteral.Number(0));
            default:
              // For other types, use 'as' type assertion
              return new TypeScriptAsExpression(value, new TypeScriptType(targetType));
          }
        }

        // Unpack bytes - convert integer to byte array
        case 'UnpackBytes': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          const bits = node.bits || 32;
          const isBigEndian = node.endian === 'big' || node.bigEndian;

          // Use helper functions for unpacking
          const funcName = bits === 16 ? (isBigEndian ? 'unpack16BE' : 'unpack16LE') :
                           bits === 64 ? (isBigEndian ? 'unpack64BE' : 'unpack64LE') :
                                         (isBigEndian ? 'unpack32BE' : 'unpack32LE');

          return new TypeScriptCall(null, funcName, [value]);
        }

        // Pack bytes - convert byte array to integer
        case 'PackBytes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          const bits = node.bits || 32;
          const isBigEndian = node.endian === 'big' || node.bigEndian;

          const funcName = bits === 16 ? (isBigEndian ? 'pack16BE' : 'pack16LE') :
                           bits === 64 ? (isBigEndian ? 'pack64BE' : 'pack64LE') :
                                         (isBigEndian ? 'pack32BE' : 'pack32LE');

          return new TypeScriptCall(null, funcName, args);
        }

        // Bit rotation operations
        case 'Rotation': {
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const bits = node.bits || 32;
          const direction = node.direction || 'left';

          const funcName = direction === 'left' ? `rotl${bits}` : `rotr${bits}`;
          return new TypeScriptCall(null, funcName, [value, amount]);
        }

        // Math function calls
        case 'MathCall': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          const method = node.method;
          // Map to JavaScript Math methods: Math.method(args)
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), method, args);
        }

        // Individual math operations as IL nodes
        case 'Floor': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'floor', [value]);
        }

        case 'Ceil': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'ceil', [value]);
        }

        case 'Round': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'round', [value]);
        }

        case 'Abs': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'abs', [value]);
        }

        case 'Min': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'min', args);
        }

        case 'Max': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'max', args);
        }

        // Bit rotation operations
        case 'RotateLeft': {
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const bits = node.bits || 32;
          return new TypeScriptCall(null, `rotl${bits}`, [value, amount]);
        }

        case 'RotateRight': {
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const bits = node.bits || 32;
          return new TypeScriptCall(null, `rotr${bits}`, [value, amount]);
        }

        // ========================[ ADDITIONAL IL AST NODE TYPES ]========================

        case 'FieldDefinition': {
          // IL AST: class field definition → TypeScript property
          const name = node.key?.name || node.name || 'field';
          const type = node.value ? this.inferType(node.value) : TypeScriptType.Any();
          const initializer = node.value ? this.transformExpression(node.value) : null;
          const prop = new TypeScriptProperty(name, type);
          prop.initializer = initializer;
          prop.isStatic = node.static || false;
          return prop;
        }

        case 'ArrayLiteral': {
          // IL AST: array literal → TypeScript array literal
          const elements = (node.elements || []).map(el => el ? this.transformExpression(el) : TypeScriptLiteral.Undefined());
          return new TypeScriptArrayLiteral(elements);
        }

        case 'ArraySort': {
          // IL AST: array.sort(compareFn) → TypeScript: array.sort(compareFn)
          const array = this.transformExpression(node.array);
          const args = node.compareFn ? [this.transformExpression(node.compareFn)] : [];
          return new TypeScriptCall(array, 'sort', args);
        }

        case 'ArraySome': {
          // IL AST: array.some(callback) → TypeScript: array.some(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new TypeScriptCall(array, 'some', callback ? [callback] : []);
        }

        case 'ArrayMap': {
          // IL AST: array.map(callback) → TypeScript: array.map(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new TypeScriptCall(array, 'map', callback ? [callback] : []);
        }

        case 'ArrayForEach': {
          // IL AST: array.forEach(callback) → TypeScript: array.forEach(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new TypeScriptCall(array, 'forEach', callback ? [callback] : []);
        }

        case 'ArrayFilter': {
          // IL AST: array.filter(callback) → TypeScript: array.filter(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new TypeScriptCall(array, 'filter', callback ? [callback] : []);
        }

        case 'ArrayFind': {
          // IL AST: array.find(callback) → TypeScript: array.find(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new TypeScriptCall(array, 'find', callback ? [callback] : []);
        }

        case 'ArrayReduce': {
          // IL AST: array.reduce(callback, initial) → TypeScript: array.reduce(callback, initial)
          const array = this.transformExpression(node.array);
          const args = [];
          if (node.callback) args.push(this.transformExpression(node.callback));
          if (node.initialValue) args.push(this.transformExpression(node.initialValue));
          return new TypeScriptCall(array, 'reduce', args);
        }

        case 'ArrayEvery': {
          // IL AST: array.every(callback) → TypeScript: array.every(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new TypeScriptCall(array, 'every', callback ? [callback] : []);
        }

        case 'ArrayUnshift': {
          // IL AST: array.unshift(value) → TypeScript: array.unshift(value)
          const array = this.transformExpression(node.array);
          const value = node.value ? this.transformExpression(node.value) : null;
          return new TypeScriptCall(array, 'unshift', value ? [value] : []);
        }

        case 'ArraySplice': {
          // IL AST: array.splice(start, deleteCount, items...) → TypeScript: array.splice(...)
          const array = this.transformExpression(node.array);
          const args = [];
          if (node.start) args.push(this.transformExpression(node.start));
          if (node.deleteCount) args.push(this.transformExpression(node.deleteCount));
          if (node.items) {
            for (const item of node.items) {
              args.push(this.transformExpression(item));
            }
          }
          return new TypeScriptCall(array, 'splice', args);
        }

        case 'StringTransform': {
          // IL AST: string.method() → TypeScript: string.method()
          const str = this.transformExpression(node.string || node.value);
          const method = node.method || 'toString';
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new TypeScriptCall(str, method, args);
        }

        case 'StringCharCodeAt': {
          // IL AST: string.charCodeAt(index) → TypeScript: string.charCodeAt(index)
          const str = this.transformExpression(node.string || node.value);
          const index = node.index ? this.transformExpression(node.index) : TypeScriptLiteral.Number(0);
          return new TypeScriptCall(str, 'charCodeAt', [index]);
        }

        case 'StringSplit': {
          // IL AST: string.split(separator) → TypeScript: string.split(separator)
          const str = this.transformExpression(node.string || node.value);
          const separator = node.separator ? this.transformExpression(node.separator) : null;
          return new TypeScriptCall(str, 'split', separator ? [separator] : []);
        }

        case 'StringSubstring': {
          // IL AST: string.substring(start, end) → TypeScript: string.substring(start, end)
          const str = this.transformExpression(node.string || node.value);
          const args = [];
          if (node.start) args.push(this.transformExpression(node.start));
          if (node.end) args.push(this.transformExpression(node.end));
          return new TypeScriptCall(str, 'substring', args);
        }

        case 'StringIndexOf': {
          // IL AST: string.indexOf(search) → TypeScript: string.indexOf(search)
          const str = this.transformExpression(node.string || node.value);
          const search = node.search ? this.transformExpression(node.search) : null;
          return new TypeScriptCall(str, 'indexOf', search ? [search] : []);
        }

        case 'StringLength': {
          // IL AST: string.length → TypeScript: string.length
          const str = this.transformExpression(node.string || node.value);
          return new TypeScriptMemberAccess(str, 'length');
        }

        case 'BigIntCast': {
          // IL AST: BigInt(value) → TypeScript: BigInt(value)
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(null, 'BigInt', [value]);
        }

        case 'DataViewCreation': {
          // IL AST: new DataView(buffer) → TypeScript: new DataView(buffer)
          const buffer = node.buffer ? this.transformExpression(node.buffer) : null;
          const args = buffer ? [buffer] : [];
          if (node.byteOffset) args.push(this.transformExpression(node.byteOffset));
          if (node.byteLength) args.push(this.transformExpression(node.byteLength));
          return new TypeScriptNew(new TypeScriptType('DataView'), args);
        }

        case 'BufferCreation': {
          // IL AST: new ArrayBuffer(size) → TypeScript: new ArrayBuffer(size)
          const size = node.size ? this.transformExpression(node.size) : TypeScriptLiteral.Number(0);
          return new TypeScriptNew(new TypeScriptType('ArrayBuffer'), [size]);
        }

        case 'TypedArraySet': {
          // IL AST: typedArray.set(source, offset) → TypeScript: typedArray.set(source, offset)
          const array = this.transformExpression(node.array);
          const source = node.source ? this.transformExpression(node.source) : null;
          const args = source ? [source] : [];
          if (node.offset) args.push(this.transformExpression(node.offset));
          return new TypeScriptCall(array, 'set', args);
        }

        case 'TypedArraySubarray': {
          // IL AST: typedArray.subarray(begin, end) → TypeScript: typedArray.subarray(begin, end)
          const array = this.transformExpression(node.array);
          const args = [];
          if (node.begin) args.push(this.transformExpression(node.begin));
          if (node.end) args.push(this.transformExpression(node.end));
          return new TypeScriptCall(array, 'subarray', args);
        }

        case 'ArrayXor': {
          // IL AST: XOR two arrays → TypeScript: helper function
          const arr1 = this.transformExpression(node.array1 || node.arguments?.[0]);
          const arr2 = this.transformExpression(node.array2 || node.arguments?.[1]);
          return new TypeScriptCall(null, 'xorArrays', [arr1, arr2]);
        }

        case 'MapSet': {
          // IL AST: map.set(key, value) → TypeScript: map.set(key, value)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          const value = this.transformExpression(node.value);
          return new TypeScriptCall(map, 'set', [key, value]);
        }

        case 'Power': {
          // IL AST: base ** exponent → TypeScript: Math.pow(base, exponent)
          const base = this.transformExpression(node.base || node.arguments?.[0]);
          const exponent = this.transformExpression(node.exponent || node.arguments?.[1]);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'pow', [base, exponent]);
        }

        case 'BitwiseOperation': {
          // IL AST: bitwise operation → TypeScript bitwise operation
          const left = this.transformExpression(node.left || node.arguments?.[0]);
          const right = node.right ? this.transformExpression(node.right) : this.transformExpression(node.arguments?.[1]);
          const op = node.operator || '&';
          return new TypeScriptBinaryExpression(left, op, right);
        }

        case 'StringRepeat': {
          // IL AST: string.repeat(count) → TypeScript: string.repeat(count)
          const str = this.transformExpression(node.string || node.value);
          const count = this.transformExpression(node.count);
          return new TypeScriptCall(str, 'repeat', [count]);
        }

        case 'StringReplace': {
          // IL AST: string.replace(search, replacement) → TypeScript: string.replace(search, replacement)
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.search || node.pattern);
          const replacement = this.transformExpression(node.replacement || node.replaceWith);
          return new TypeScriptCall(str, 'replace', [search, replacement]);
        }

        case 'Sqrt': {
          // IL AST: Math.sqrt(value) → TypeScript: Math.sqrt(value)
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'sqrt', [value]);
        }

        case 'MapCreation': {
          // IL AST: new Map() → TypeScript: new Map()
          const args = node.entries ? [this.transformExpression(node.entries)] : [];
          return new TypeScriptNew(new TypeScriptType('Map'), args);
        }

        case 'SetCreation': {
          // IL AST: new Set() → TypeScript: new Set()
          const args = node.values ? [this.transformExpression(node.values)] : [];
          return new TypeScriptNew(new TypeScriptType('Set'), args);
        }

        case 'RegExpCreation': {
          // IL AST: new RegExp(pattern, flags) → TypeScript: new RegExp(pattern, flags)
          const args = [];
          if (node.pattern) args.push(this.transformExpression(node.pattern));
          if (node.flags) args.push(this.transformExpression(node.flags));
          return new TypeScriptNew(new TypeScriptType('RegExp'), args);
        }

        case 'Typeof': {
          // IL AST: typeof value → TypeScript: typeof value
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptTypeOf(value);
        }

        case 'Instanceof': {
          // IL AST: value instanceof Type → TypeScript: value instanceof Type
          const left = this.transformExpression(node.left || node.value);
          const right = this.transformExpression(node.right || node.type);
          return new TypeScriptBinaryExpression(left, 'instanceof', right);
        }

        case 'MapGet': {
          // IL AST: map.get(key) → TypeScript: map.get(key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new TypeScriptCall(map, 'get', [key]);
        }

        case 'MapHas': {
          // IL AST: map.has(key) → TypeScript: map.has(key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new TypeScriptCall(map, 'has', [key]);
        }

        case 'MapDelete': {
          // IL AST: map.delete(key) → TypeScript: map.delete(key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new TypeScriptCall(map, 'delete', [key]);
        }

        case 'Log': {
          // IL AST: Math.log(value) → TypeScript: Math.log(value)
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'log', [value]);
        }

        case 'Log2': {
          // IL AST: Math.log2(value) → TypeScript: Math.log2(value)
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'log2', [value]);
        }

        case 'Log10': {
          // IL AST: Math.log10(value) → TypeScript: Math.log10(value)
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'log10', [value]);
        }

        case 'Random': {
          // IL AST: Math.random() → TypeScript: Math.random()
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'random', []);
        }

        case 'Sin': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'sin', [value]);
        }

        case 'Cos': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'cos', [value]);
        }

        case 'Tan': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'tan', [value]);
        }

        case 'Asin': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'asin', [value]);
        }

        case 'Acos': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'acos', [value]);
        }

        case 'Atan': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'atan', [value]);
        }

        case 'Atan2': {
          const y = this.transformExpression(node.y || node.arguments?.[0]);
          const x = this.transformExpression(node.x || node.arguments?.[1]);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'atan2', [y, x]);
        }

        case 'Exp': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'exp', [value]);
        }

        case 'Sign': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'sign', [value]);
        }

        case 'Trunc': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'trunc', [value]);
        }

        case 'Sinh': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'sinh', [value]);
        }

        case 'Cosh': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'cosh', [value]);
        }

        case 'Tanh': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'tanh', [value]);
        }

        case 'Cbrt': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'cbrt', [value]);
        }

        case 'Hypot': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'hypot', args);
        }

        case 'Fround': {
          const value = this.transformExpression(node.argument || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Math'), 'fround', [value]);
        }

        case 'MathConstant': {
          // IL AST: Math constant → TypeScript: Math.PI, Math.E, etc.
          return new TypeScriptMemberAccess(new TypeScriptIdentifier('Math'), node.name);
        }

        case 'NumberConstant': {
          // IL AST: Number constant → TypeScript: Number.MAX_SAFE_INTEGER, Infinity, NaN, etc.
          switch (node.name) {
            case 'POSITIVE_INFINITY':
              return new TypeScriptIdentifier('Infinity');
            case 'NEGATIVE_INFINITY':
              return new TypeScriptUnaryExpression('-', new TypeScriptIdentifier('Infinity'), true);
            case 'NaN':
              return new TypeScriptIdentifier('NaN');
            default:
              return new TypeScriptMemberAccess(new TypeScriptIdentifier('Number'), node.name);
          }
        }

        case 'InstanceOfCheck': {
          // IL AST: value instanceof ClassName → TypeScript: value instanceof ClassName
          const value = this.transformExpression(node.value);
          const className = this.transformExpression(node.className);
          return new TypeScriptBinaryExpression(value, 'instanceof', className);
        }

        case 'StringCharAt': {
          const str = this.transformExpression(node.string || node.value);
          const index = this.transformExpression(node.index);
          return new TypeScriptCall(str, 'charAt', [index]);
        }

        case 'StringIncludes': {
          const str = this.transformExpression(node.string || node.value);
          const searchValue = this.transformExpression(node.searchValue || node.search);
          const args = [searchValue];
          if (node.position !== undefined && node.position !== null) {
            args.push(this.transformExpression(node.position));
          }
          return new TypeScriptCall(str, 'includes', args);
        }

        case 'StringStartsWith': {
          const str = this.transformExpression(node.string || node.value);
          const searchValue = this.transformExpression(node.searchValue || node.search);
          const args = [searchValue];
          if (node.position !== undefined && node.position !== null) {
            args.push(this.transformExpression(node.position));
          }
          return new TypeScriptCall(str, 'startsWith', args);
        }

        case 'StringEndsWith': {
          const str = this.transformExpression(node.string || node.value);
          const searchValue = this.transformExpression(node.searchValue || node.search);
          const args = [searchValue];
          if (node.length !== undefined && node.length !== null) {
            args.push(this.transformExpression(node.length));
          }
          return new TypeScriptCall(str, 'endsWith', args);
        }

        case 'StringTrim': {
          const str = this.transformExpression(node.string || node.value);
          return new TypeScriptCall(str, 'trim', []);
        }

        case 'StringPadStart': {
          const str = this.transformExpression(node.string || node.value);
          const targetLength = this.transformExpression(node.targetLength || node.length);
          const args = [targetLength];
          if (node.padString) {
            args.push(this.transformExpression(node.padString));
          }
          return new TypeScriptCall(str, 'padStart', args);
        }

        case 'StringPadEnd': {
          const str = this.transformExpression(node.string || node.value);
          const targetLength = this.transformExpression(node.targetLength || node.length);
          const args = [targetLength];
          if (node.padString) {
            args.push(this.transformExpression(node.padString));
          }
          return new TypeScriptCall(str, 'padEnd', args);
        }

        case 'StringToLowerCase': {
          const str = this.transformExpression(node.string || node.value);
          return new TypeScriptCall(str, 'toLowerCase', []);
        }

        case 'StringToUpperCase': {
          const str = this.transformExpression(node.string || node.value);
          return new TypeScriptCall(str, 'toUpperCase', []);
        }

        case 'StringSlice': {
          const str = this.transformExpression(node.string || node.value);
          const start = this.transformExpression(node.start || node.beginIndex);
          const args = [start];
          if (node.end !== undefined && node.end !== null) {
            args.push(this.transformExpression(node.end));
          }
          return new TypeScriptCall(str, 'slice', args);
        }

        case 'StringConcat': {
          const str = this.transformExpression(node.string || node.value);
          const args = (node.args || node.strings || []).map(a => this.transformExpression(a));
          return new TypeScriptCall(str, 'concat', args);
        }

        case 'ArrayFindIndex': {
          const arr = this.transformExpression(node.array);
          const callback = this.transformExpression(node.callback);
          return new TypeScriptCall(arr, 'findIndex', [callback]);
        }

        case 'ArrayLastIndexOf': {
          const arr = this.transformExpression(node.array);
          const searchElement = this.transformExpression(node.searchElement || node.element);
          const args = [searchElement];
          if (node.fromIndex !== undefined && node.fromIndex !== null) {
            args.push(this.transformExpression(node.fromIndex));
          }
          return new TypeScriptCall(arr, 'lastIndexOf', args);
        }

        case 'ArrayFrom': {
          const arrayLike = this.transformExpression(node.arrayLike || node.iterable);
          const args = [arrayLike];
          if (node.mapFn) {
            args.push(this.transformExpression(node.mapFn));
          }
          return new TypeScriptCall(new TypeScriptIdentifier('Array'), 'from', args);
        }

        case 'ObjectKeys': {
          const obj = this.transformExpression(node.object || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Object'), 'keys', [obj]);
        }

        case 'ObjectValues': {
          const obj = this.transformExpression(node.object || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Object'), 'values', [obj]);
        }

        case 'ObjectEntries': {
          const obj = this.transformExpression(node.object || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Object'), 'entries', [obj]);
        }

        case 'JsonParse': {
          const text = this.transformExpression(node.text || node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('JSON'), 'parse', [text]);
        }

        case 'JsonStringify': {
          const value = this.transformExpression(node.value);
          const args = [value];
          if (node.replacer) args.push(this.transformExpression(node.replacer));
          if (node.space) args.push(this.transformExpression(node.space));
          return new TypeScriptCall(new TypeScriptIdentifier('JSON'), 'stringify', args);
        }

        case 'DateNow': {
          return new TypeScriptCall(new TypeScriptIdentifier('Date'), 'now', []);
        }

        case 'NumberParseInt': {
          const str = this.transformExpression(node.string || node.value);
          const args = [str];
          if (node.radix !== undefined && node.radix !== null) {
            args.push(this.transformExpression(node.radix));
          }
          return new TypeScriptCall(null, 'parseInt', args);
        }

        case 'NumberParseFloat': {
          const str = this.transformExpression(node.string || node.value);
          return new TypeScriptCall(null, 'parseFloat', [str]);
        }

        // ========================[ NEW IL AST NODE TYPES ]========================
        // These are language-agnostic intermediate nodes from the enhanced type-aware transpiler

        case 'StringInterpolation': {
          // IL AST: string interpolation with parts → TypeScript: template literal
          const templateParts = [];
          const expressions = [];
          let currentStr = '';

          for (const part of (node.parts || [])) {
            if (part.type === 'StringPart') {
              currentStr += part.value;
            } else if (part.type === 'ExpressionPart') {
              templateParts.push(currentStr);
              currentStr = '';
              expressions.push(this.transformExpression(part.expression));
            }
          }
          templateParts.push(currentStr);

          return new TypeScriptTemplateLiteral(templateParts, expressions);
        }

        case 'TypeOfExpression': {
          // IL AST: typeof x → TypeScript: typeof x
          const argument = this.transformExpression(node.argument);
          return new TypeScriptUnaryExpression('typeof', argument, true);
        }

        case 'DeleteExpression': {
          // IL AST: delete x → TypeScript: delete x
          const argument = this.transformExpression(node.argument);
          return new TypeScriptUnaryExpression('delete', argument, true);
        }

        case 'DebugOutput': {
          // IL AST: console.log(...) → TypeScript: console.log(...)
          // In release builds, these could be stripped; for TypeScript we preserve them
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          const consoleObj = new TypeScriptIdentifier('console');
          return new TypeScriptCall(consoleObj, node.method || 'log', args);
        }

        case 'SpreadElement': {
          // IL AST: spread element → TypeScript: ...x
          const argument = this.transformExpression(node.argument);
          return new TypeScriptSpreadElement(argument);
        }

        case 'RestParameter': {
          // IL AST: rest parameter → TypeScript: ...args
          const param = new TypeScriptParameter(node.name, TypeScriptType.Any());
          param.isRest = true;
          return param;
        }

        case 'ObjectLiteral': {
          // IL AST: object literal → TypeScript: { key: value, ... }
          const objLit = new TypeScriptObjectLiteral();
          for (const prop of (node.properties || [])) {
            if (prop.type === 'ObjectSpread') {
              // Spread property: { ...x }
              objLit.properties.push({
                isSpread: true,
                value: this.transformExpression(prop.argument)
              });
            } else {
              const key = typeof prop.key === 'string' ? prop.key : this.transformExpression(prop.key);
              const value = this.transformExpression(prop.value);
              objLit.properties.push({
                key,
                value,
                computed: prop.computed || false,
                shorthand: prop.shorthand || false,
                method: prop.method || false
              });
            }
          }
          return objLit;
        }

        case 'ArrowFunction':
        case 'FunctionExpression': {
          // IL AST: function expression → TypeScript: (params) => body
          const params = (node.params || []).map(p => {
            if (p.type === 'RestParameter') {
              const param = new TypeScriptParameter(p.name, TypeScriptType.Any());
              param.isRest = true;
              return param;
            }
            if (p.type === 'DefaultParameter') {
              const param = new TypeScriptParameter(p.name, TypeScriptType.Any());
              param.defaultValue = this.transformExpression(p.defaultValue);
              return param;
            }
            if (typeof p === 'string' || p.type === 'Identifier')
              return new TypeScriptParameter(p.name || p, TypeScriptType.Any());
            return this.transformExpression(p);
          });
          const body = node.body ? (node.body.type === 'BlockStatement' ?
            this.transformBlockStatement(node.body) :
            this.transformExpression(node.body)) : null;
          const arrowFn = new TypeScriptArrowFunction(params, body, null);
          arrowFn.isAsync = node.async || false;
          return arrowFn;
        }

        case 'AwaitExpression': {
          // IL AST: await x → TypeScript: await x
          const argument = this.transformExpression(node.argument);
          return new TypeScriptAwaitExpression(argument);
        }

        case 'YieldExpression': {
          // IL AST: yield x → TypeScript: yield x (or yield* x)
          const argument = node.argument ? this.transformExpression(node.argument) : null;
          return new TypeScriptYieldExpression(argument, node.delegate || false);
        }

        case 'DataViewRead': {
          // IL AST: dataview.getUint32(offset, littleEndian) → TypeScript: view.getUint32(offset, littleEndian)
          const view = this.transformExpression(node.view);
          const args = [this.transformExpression(node.offset)];
          if (node.littleEndian) args.push(this.transformExpression(node.littleEndian));
          return new TypeScriptCall(view, node.method, args);
        }

        case 'DataViewWrite': {
          // IL AST: dataview.setUint32(offset, value, littleEndian) → TypeScript: view.setUint32(offset, value, littleEndian)
          const view = this.transformExpression(node.view);
          const args = [this.transformExpression(node.offset), this.transformExpression(node.value)];
          if (node.littleEndian) args.push(this.transformExpression(node.littleEndian));
          return new TypeScriptCall(view, node.method, args);
        }

        case 'ArrayFrom': {
          // IL AST: Array.from(iterable) → TypeScript: Array.from(iterable)
          const args = [this.transformExpression(node.iterable)];
          if (node.mapFunction) args.push(this.transformExpression(node.mapFunction));
          return new TypeScriptCall(new TypeScriptIdentifier('Array'), 'from', args);
        }

        case 'IsArrayCheck': {
          // IL AST: Array.isArray(x) → TypeScript: Array.isArray(x)
          const value = this.transformExpression(node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Array'), 'isArray', [value]);
        }

        case 'ArrayOf': {
          // IL AST: Array.of(...) → TypeScript: Array.of(...)
          const elements = (node.elements || []).map(el => this.transformExpression(el));
          return new TypeScriptCall(new TypeScriptIdentifier('Array'), 'of', elements);
        }

        case 'ObjectMerge': {
          // IL AST: Object.assign(target, ...sources) → TypeScript: Object.assign(target, ...sources)
          const target = this.transformExpression(node.target);
          const sources = (node.sources || []).map(s => this.transformExpression(s));
          return new TypeScriptCall(new TypeScriptIdentifier('Object'), 'assign', [target, ...sources]);
        }

        case 'ObjectFreeze': {
          // IL AST: Object.freeze(obj) → TypeScript: Object.freeze(obj)
          const obj = this.transformExpression(node.object);
          return new TypeScriptCall(new TypeScriptIdentifier('Object'), 'freeze', [obj]);
        }

        case 'ObjectSeal': {
          // IL AST: Object.seal(obj) → TypeScript: Object.seal(obj)
          const obj = this.transformExpression(node.object);
          return new TypeScriptCall(new TypeScriptIdentifier('Object'), 'seal', [obj]);
        }

        case 'ObjectHasProperty': {
          // IL AST: Object.hasOwn(obj, prop) → TypeScript: Object.hasOwn(obj, prop)
          const obj = this.transformExpression(node.object);
          const prop = this.transformExpression(node.property);
          return new TypeScriptCall(new TypeScriptIdentifier('Object'), 'hasOwn', [obj, prop]);
        }

        case 'ObjectFromEntries': {
          // IL AST: Object.fromEntries(entries) → TypeScript: Object.fromEntries(entries)
          const entries = this.transformExpression(node.entries);
          return new TypeScriptCall(new TypeScriptIdentifier('Object'), 'fromEntries', [entries]);
        }

        case 'StringFromCharCodes': {
          // IL AST: String.fromCharCode(...codes) → TypeScript: String.fromCharCode(...codes)
          const codes = (node.charCodes || []).map(c => this.transformExpression(c));
          return new TypeScriptCall(new TypeScriptIdentifier('String'), 'fromCharCode', codes);
        }

        case 'StringFromCodePoints': {
          // IL AST: String.fromCodePoint(...points) → TypeScript: String.fromCodePoint(...points)
          const points = (node.codePoints || []).map(p => this.transformExpression(p));
          return new TypeScriptCall(new TypeScriptIdentifier('String'), 'fromCodePoint', points);
        }

        case 'IsIntegerCheck': {
          // IL AST: Number.isInteger(x) → TypeScript: Number.isInteger(x)
          const value = this.transformExpression(node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Number'), 'isInteger', [value]);
        }

        case 'IsNaNCheck': {
          // IL AST: Number.isNaN(x) → TypeScript: Number.isNaN(x)
          const value = this.transformExpression(node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Number'), 'isNaN', [value]);
        }

        case 'IsFiniteCheck': {
          // IL AST: Number.isFinite(x) → TypeScript: Number.isFinite(x)
          const value = this.transformExpression(node.value);
          return new TypeScriptCall(new TypeScriptIdentifier('Number'), 'isFinite', [value]);
        }

        case 'ParseInteger': {
          // IL AST: parseInt(str, radix) → TypeScript: parseInt(str, radix)
          const str = this.transformExpression(node.string);
          const args = [str];
          if (node.radix) args.push(this.transformExpression(node.radix));
          return new TypeScriptCall(null, 'parseInt', args);
        }

        case 'ParseFloat': {
          // IL AST: parseFloat(str) → TypeScript: parseFloat(str)
          const str = this.transformExpression(node.string);
          return new TypeScriptCall(null, 'parseFloat', [str]);
        }

        case 'JsonSerialize': {
          // IL AST: JSON.stringify(value) → TypeScript: JSON.stringify(value)
          const value = this.transformExpression(node.value);
          const args = [value];
          if (node.replacer) args.push(this.transformExpression(node.replacer));
          if (node.space) args.push(this.transformExpression(node.space));
          return new TypeScriptCall(new TypeScriptIdentifier('JSON'), 'stringify', args);
        }

        case 'JsonDeserialize': {
          // IL AST: JSON.parse(text) → TypeScript: JSON.parse(text)
          const text = this.transformExpression(node.text);
          const args = [text];
          if (node.reviver) args.push(this.transformExpression(node.reviver));
          return new TypeScriptCall(new TypeScriptIdentifier('JSON'), 'parse', args);
        }

        case 'SequenceExpression': {
          // IL AST: (a, b, c) → TypeScript: (a, b, c)
          const expressions = (node.expressions || []).map(e => this.transformExpression(e));
          return new TypeScriptSequenceExpression(expressions);
        }

        default:
          // Log warning for unhandled expression types to aid debugging
          const safeStringify = (obj) => {
            try {
              return JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() + 'n' : v, 2).substring(0, 200);
            } catch (e) { return '[stringify error]'; }
          };
          console.warn(`[TypeScriptTransformer] Unhandled expression type: ${node.type}`, safeStringify(node));
          // Return a placeholder that will cause compilation to fail with clear message
          return new TypeScriptIdentifier(`UNHANDLED_EXPRESSION_${node.type}`);
      }
    }

    transformLiteral(node) {
      if (typeof node.value === 'number') {
        return TypeScriptLiteral.Number(node.value);
      } else if (typeof node.value === 'string') {
        return TypeScriptLiteral.String(node.value);
      } else if (typeof node.value === 'boolean') {
        return TypeScriptLiteral.Boolean(node.value);
      } else if (node.value === null) {
        return TypeScriptLiteral.Null();
      } else if (node.value === undefined) {
        return TypeScriptLiteral.Undefined();
      } else if (typeof node.value === 'bigint') {
        return TypeScriptLiteral.BigInt(node.value);
      }
      return TypeScriptLiteral.Number(0);
    }

    transformIdentifier(node) {
      return new TypeScriptIdentifier(node.name);
    }

    transformBinaryExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      // Handle unsigned right shift (>>>) which doesn't exist in TypeScript
      if (node.operator === '>>>') {
        // Convert to (x >>> y) as number with proper casting
        return new TypeScriptBinaryExpression(left, '>>>', right);
      }

      return new TypeScriptBinaryExpression(left, node.operator, right);
    }

    transformLogicalExpression(node) {
      return this.transformBinaryExpression(node);
    }

    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new TypeScriptUnaryExpression(node.operator, operand, node.prefix);
    }

    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new TypeScriptUnaryExpression(node.operator, operand, node.prefix);
    }

    transformAssignmentExpression(node) {
      const target = this.transformExpression(node.left);
      const value = this.transformExpression(node.right);
      return new TypeScriptAssignment(target, node.operator, value);
    }

    transformMemberExpression(node) {
      const target = this.transformExpression(node.object);
      const member = node.property.name || node.property.value;

      if (node.computed) {
        // Array indexing: arr[i]
        const index = this.transformExpression(node.property);
        return new TypeScriptElementAccess(target, index);
      }

      const access = new TypeScriptMemberAccess(target, member);
      access.isOptional = node.optional || false;
      return access;
    }

    transformCallExpression(node) {
      if (node.callee.type === 'MemberExpression') {
        const target = this.transformExpression(node.callee.object);
        const methodName = node.callee.property.name || node.callee.property.value || 'unknownMethod';
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle Object methods - TypeScript keeps these as-is since it's similar to JS
        // But we still need to handle them for consistency
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
          // Object.freeze(x) -> Object.freeze(x) (keep as-is for TS)
          if (methodName === 'freeze' && args.length === 1)
            return new TypeScriptCall(new TypeScriptIdentifier('Object'), 'freeze', args);
          // Object.keys, Object.values, Object.entries - keep as-is
          if (['keys', 'values', 'entries', 'assign'].includes(methodName))
            return new TypeScriptCall(new TypeScriptIdentifier('Object'), methodName, args);
        }

        return new TypeScriptCall(target, methodName, args);
      } else {
        const methodName = node.callee.name || 'fn';
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new TypeScriptCall(null, methodName, args);
      }
    }

    transformNewExpression(node) {
      const typeName = node.callee.name;
      const type = new TypeScriptType(typeName);
      const args = node.arguments ? node.arguments.map(arg => this.transformExpression(arg)) : [];
      return new TypeScriptNew(type, args);
    }

    transformArrayExpression(node) {
      const elements = node.elements.map(el => el ? this.transformExpression(el) : TypeScriptLiteral.Undefined());
      const array = new TypeScriptArrayLiteral(elements);

      // Add type annotation if we know the element type
      if (this.currentArrayElementType) {
        array.elementType = this.currentArrayElementType;
      }

      return array;
    }

    transformObjectExpression(node) {
      const obj = new TypeScriptObjectLiteral();
      for (const prop of node.properties) {
        // Handle SpreadElement like {...obj}
        if (prop.type === 'SpreadElement') {
          const spread = this.transformExpression(prop.argument);
          obj.properties.push({ isSpread: true, value: spread });
          continue;
        }
        const key = prop.key?.name || prop.key?.value;
        const value = this.transformExpression(prop.value);
        obj.properties.push({ key, value });
      }
      return obj;
    }

    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const trueExpr = this.transformExpression(node.consequent);
      const falseExpr = this.transformExpression(node.alternate);
      return new TypeScriptConditional(condition, trueExpr, falseExpr);
    }

    transformArrowFunctionExpression(node) {
      this.pushScope();

      const params = node.params.map(p => this.transformParameter(p));
      const returnType = node.body.type === 'BlockStatement' ?
        TypeScriptType.Void() :
        this.inferType(node.body);

      const body = node.body.type === 'BlockStatement' ?
        this.transformFunctionBody(node.body) :
        this.transformExpression(node.body);

      this.popScope();

      return new TypeScriptArrowFunction(params, body, returnType);
    }

    transformFunctionExpression(node) {
      // Convert to arrow function for simplicity
      return this.transformArrowFunctionExpression(node);
    }

    transformThisExpression(node) {
      return new TypeScriptThis();
    }

    transformTemplateLiteral(node) {
      const template = new TypeScriptTemplateLiteral();
      for (let i = 0; i < node.quasis.length; i++) {
        const text = node.quasis[i].value.raw || node.quasis[i].value.cooked;
        const expression = i < node.expressions.length ? this.transformExpression(node.expressions[i]) : null;
        template.parts.push({ text, expression });
      }
      return template;
    }

    transformSequenceExpression(node) {
      // Return last expression
      return node.expressions.length > 0 ?
        this.transformExpression(node.expressions[node.expressions.length - 1]) :
        TypeScriptLiteral.Undefined();
    }
  }

  // Export
  const exports = { TypeScriptTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.TypeScriptTransformer = TypeScriptTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
