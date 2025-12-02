/**
 * TypeScriptTransformer.js - JavaScript AST to TypeScript AST Transformer
 * Converts type-annotated JavaScript AST to TypeScript AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> TS AST -> TS Emitter -> TS Source
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
    TypeScriptConstructor, TypeScriptParameter, TypeScriptBlock, TypeScriptVariableDeclaration,
    TypeScriptExpressionStatement, TypeScriptReturn, TypeScriptIf, TypeScriptFor, TypeScriptForOf,
    TypeScriptWhile, TypeScriptDoWhile, TypeScriptSwitch, TypeScriptSwitchCase, TypeScriptBreak,
    TypeScriptContinue, TypeScriptThrow, TypeScriptTryCatch, TypeScriptCatchClause,
    TypeScriptLiteral, TypeScriptIdentifier, TypeScriptBinaryExpression, TypeScriptUnaryExpression,
    TypeScriptAssignment, TypeScriptMemberAccess, TypeScriptElementAccess, TypeScriptCall,
    TypeScriptNew, TypeScriptArrayLiteral, TypeScriptObjectLiteral, TypeScriptAssertion,
    TypeScriptConditional, TypeScriptArrowFunction, TypeScriptThis, TypeScriptSuper, TypeScriptTypeOf,
    TypeScriptParenthesized, TypeScriptTemplateLiteral, TypeScriptJSDoc
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
        if (node.expression.type === 'Literal' && typeof node.expression.value === 'string') {
          return null;
        }
        // Skip if statements (usually feature detection)
        return null;
      }

      // Skip if statements (usually feature detection)
      if (node.type === 'IfStatement') return null;

      // Process class declarations
      if (node.type === 'ClassDeclaration') {
        return this.transformClassDeclaration(node);
      }

      // Process function declarations
      if (node.type === 'FunctionDeclaration') {
        return this.transformFunctionDeclaration(node);
      }

      // Process variable declarations
      if (node.type === 'VariableDeclaration') {
        return this.transformVariableDeclaration(node);
      }

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
        'ThisExpression', 'TemplateLiteral', 'SequenceExpression', 'SpreadElement'];

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

      const prop = new TypeScriptProperty(name, type, initializer);
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
      const statements = node.body.map(stmt => this.transformStatement(stmt));

      // Create a static block representation (simple object with isStatic marker)
      return {
        type: 'StaticBlock',
        isStaticBlock: true,
        body: statements
      };
    }

    transformMethodDefinition(node) {
      if (node.kind === 'constructor') {
        return this.transformConstructor(node);
      }

      this.pushScope();

      const typeInfo = this.extractTypeInfo(node.value);
      let returnType = TypeScriptType.Void();

      if (typeInfo?.returns) {
        returnType = this.mapType(typeInfo.returns);
      } else if (node.value.body) {
        // Infer from return statements
        const hasReturn = this.hasReturnWithValue(node.value.body);
        if (hasReturn) {
          returnType = this.inferReturnType(node.value.body) || TypeScriptType.Any();
        }
      }

      const method = new TypeScriptMethod(node.key.name, returnType);
      method.isStatic = node.static || false;

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
      // Return first non-any type, or any if all are any
      return returnTypes.find(t => t.name !== 'any') || returnTypes[0];
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
      return new TypeScriptBreak();
    }

    transformContinueStatement(node) {
      return new TypeScriptContinue();
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

        case 'SpreadElement':
          return this.transformExpression(node.argument);

        case 'Super':
          return new TypeScriptSuper();

        case 'ObjectPattern':
          // Object destructuring - TypeScript supports this natively
          // Return a comment placeholder
          return new TypeScriptIdentifier('/* Object destructuring pattern */');

        default:
          console.warn(`Unhandled expression type: ${node.type}`);
          return new TypeScriptIdentifier(`/* ${node.type} */`);
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
        const methodName = node.callee.property.name;
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
        const key = prop.key.name || prop.key.value;
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
