/**
 * KotlinTransformer.js - IL AST to Kotlin AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to Kotlin AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → Kotlin AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - packageName: Kotlin package name
 */

(function(global) {
  'use strict';

  // Load dependencies
  let KotlinAST;
  if (typeof require !== 'undefined') {
    KotlinAST = require('./KotlinAST.js');
  } else if (global.KotlinAST) {
    KotlinAST = global.KotlinAST;
  }

  const {
    KotlinType, KotlinFile, KotlinPackageDeclaration, KotlinImportDirective,
    KotlinClass, KotlinDataClass, KotlinObject, KotlinCompanionObject,
    KotlinPrimaryConstructor, KotlinConstructor, KotlinProperty, KotlinFunction, KotlinParameter,
    KotlinBlock, KotlinVariableDeclaration, KotlinExpressionStatement, KotlinReturn,
    KotlinIf, KotlinWhen, KotlinWhenEntry, KotlinFor, KotlinWhile, KotlinDoWhile,
    KotlinBreak, KotlinContinue, KotlinThrow, KotlinTryCatch, KotlinCatchClause,
    KotlinLiteral, KotlinIdentifier, KotlinBinaryExpression, KotlinUnaryExpression,
    KotlinAssignment, KotlinMemberAccess, KotlinElementAccess, KotlinFunctionCall,
    KotlinObjectCreation, KotlinArrayCreation, KotlinLambda, KotlinRange,
    KotlinStringTemplate, KotlinThis, KotlinSuper, KotlinIsExpression,
    KotlinAsExpression, KotlinParenthesized, KotlinElvis, KotlinKDoc
  } = KotlinAST;

  /**
   * Maps JavaScript/JSDoc types to Kotlin types
   */
  const TYPE_MAP = {
    // Unsigned integers
    'uint8': 'UByte', 'byte': 'UByte',
    'uint16': 'UShort', 'ushort': 'UShort', 'word': 'UShort',
    'uint32': 'UInt', 'uint': 'UInt', 'dword': 'UInt',
    'uint64': 'ULong', 'ulong': 'ULong', 'qword': 'ULong',
    // Signed integers
    'int8': 'Byte', 'sbyte': 'Byte',
    'int16': 'Short', 'short': 'Short',
    'int32': 'Int', 'int': 'Int',
    'int64': 'Long', 'long': 'Long',
    // Floating point
    'float': 'Float', 'float32': 'Float',
    'double': 'Double', 'float64': 'Double',
    // In crypto context, JavaScript 'number' typically means uint32
    'number': 'UInt',
    // Other
    'boolean': 'Boolean', 'bool': 'Boolean',
    'string': 'String', 'String': 'String',
    'BigInt': 'BigInteger', 'bigint': 'BigInteger',
    'void': 'Unit',
    'object': 'Any', 'Object': 'Any', 'any': 'Any',
    'Array': 'Array', 'array': 'Array'
  };

  /**
   * JavaScript AST to Kotlin AST Transformer
   */
  class KotlinTransformer {
    constructor(options = {}) {
      this.options = options;
      this.typeKnowledge = options.typeKnowledge || null;
      this.currentClass = null;
      this.currentFunction = null;
      this.variableTypes = new Map();
      this.imports = new Set();
    }

    /**
     * Transform JavaScript AST Program node to Kotlin File
     */
    transform(jsProgram) {
      const file = new KotlinFile();

      // Set package
      const packageName = this.options.packageName || 'generated.crypto';
      file.packageDeclaration = new KotlinPackageDeclaration(packageName);

      // Add standard imports
      this.addImport('kotlin.experimental.and');
      this.addImport('kotlin.experimental.or');
      this.addImport('kotlin.experimental.xor');
      this.addImport('kotlin.experimental.inv');

      // Transform body
      for (const node of jsProgram.body) {
        // Check for IIFE wrapper (UMD pattern) and extract content
        if (this.isIIFE(node)) {
          const extractedNodes = this.extractIIFEContent(node);
          for (const extracted of extractedNodes) {
            if (extracted) {
              file.declarations.push(extracted);
            }
          }
        } else {
          const transformed = this.transformNode(node);
          if (transformed) {
            file.declarations.push(transformed);
          }
        }
      }

      // Add imports to file
      for (const importPath of this.imports) {
        file.imports.push(new KotlinImportDirective(importPath));
      }

      return file;
    }

    addImport(path) {
      this.imports.add(path);
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
      // Skip 'use strict' and other expression statements
      if (node.type === 'ExpressionStatement') {
        if (node.expression.type === 'Literal' && typeof node.expression.value === 'string') {
          return null;
        }
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
     * Transform any JavaScript AST node to Kotlin AST
     */
    transformNode(node) {
      if (!node || !node.type) return null;

      const methodName = `transform${node.type}`;
      if (typeof this[methodName] === 'function') {
        return this[methodName](node);
      }

      // Fall back to transformExpression for IL AST node types
      // handled inside the expression switch statement
      try {
        const result = this.transformExpression(node);
        if (result) return result;
      } catch(e) {
        // ignore and fall through to warning
      }

      console.warn(`No transformer for node type: ${node.type}`);
      return null;
    }

    /**
     * Transform a statement node
     */
    transformStatement(node) {
      if (!node || !node.type) return null;

      switch (node.type) {
        case 'BlockStatement':
          return this.transformBlockStatement(node);
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
          return this.transformBreakStatement(node);
        case 'ContinueStatement':
          return this.transformContinueStatement(node);
        case 'ThrowStatement':
          return this.transformThrowStatement(node);
        case 'TryStatement':
          return this.transformTryStatement(node);
        case 'EmptyStatement':
          return null;
        case 'ClassDeclaration':
          return this.transformClassDeclaration(node);
        case 'FunctionDeclaration':
          return this.transformFunctionDeclaration(node);
        default:
          return this.transformNode(node);
      }
    }

    /**
     * Transform an expression node
     */
    transformExpression(node) {
      if (!node || !node.type) return null;

      switch (node.type) {
        case 'Literal':
          return this.transformLiteral(node);
        case 'Identifier':
          return this.transformIdentifier(node);
        case 'BinaryExpression':
          return this.transformBinaryExpression(node);
        case 'LogicalExpression':
          return this.transformLogicalExpression(node);
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
        case 'ThisExpression':
          return this.transformThisExpression(node);
        case 'Super':
          return this.transformSuper(node);
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);
        case 'SequenceExpression':
          // Return last expression in sequence
          return this.transformExpression(node.expressions[node.expressions.length - 1]);
        case 'SpreadElement':
          // ...array -> *array (Kotlin spread operator)
          return this.transformExpression(node.argument);
        case 'TemplateLiteral':
          // `Hello ${name}!` -> "Hello $name!"
          return this.transformTemplateLiteral(node);
        case 'ObjectPattern':
          // Object destructuring - Kotlin supports destructuring declarations
          // Return a comment placeholder
          return new KotlinIdentifier('/* Object destructuring pattern */');

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - Kotlin supports ?. operator
          return this.transformExpression(node.expression);

        case 'ClassExpression':
          // Anonymous class expression - Kotlin has object expressions
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - Kotlin has sequence/flow builders
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> Kotlin private property with _ prefix
          return new KotlinIdentifier('_' + this.toCamelCase(node.name));

        case 'Floor':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'floor'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Ceil':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'ceil'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Abs':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'abs'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Min':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'min'),
            (node.values || node.arguments || []).map(v => this.transformExpression(v))
          );

        case 'Max':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'max'),
            (node.values || node.arguments || []).map(v => this.transformExpression(v))
          );

        case 'Pow':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'pow'),
            [this.transformExpression(node.base || node.arguments?.[0]), this.transformExpression(node.exponent || node.arguments?.[1])]
          );

        case 'Sqrt':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'sqrt'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Cbrt':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'cbrt'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Log':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'log'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Log2':
          // Kotlin: Math.log(x) / Math.log(2.0)
          return new KotlinBinaryExpression(
            new KotlinFunctionCall(new KotlinMemberAccess(new KotlinIdentifier('Math'), 'log'), [this.transformExpression(node.arguments?.[0] || node.value)]),
            '/',
            new KotlinFunctionCall(new KotlinMemberAccess(new KotlinIdentifier('Math'), 'log'), [KotlinLiteral.Double(2.0)])
          );

        case 'Log10':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'log10'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Exp':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'exp'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Round':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'round'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Trunc':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(this.transformExpression(node.arguments?.[0] || node.value), 'toLong'),
            []
          );

        case 'Sign':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'signum'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Sin':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'sin'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Cos':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'cos'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Tan':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'tan'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Asin':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'asin'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Acos':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'acos'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Atan':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'atan'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Atan2': {
          const y = this.transformExpression(node.arguments?.[0] || node.y);
          const x = this.transformExpression(node.arguments?.[1] || node.x);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'atan2'),
            [y, x]
          );
        }

        case 'Sinh':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'sinh'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Cosh':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'cosh'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Tanh':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'tanh'),
            [this.transformExpression(node.arguments?.[0] || node.value)]
          );

        case 'Hypot': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'hypot'),
            args
          );
        }

        case 'Fround':
          return new KotlinFunctionCall(
            new KotlinMemberAccess(this.transformExpression(node.arguments?.[0] || node.value), 'toFloat'),
            []
          );

        case 'MathCall': {
          const method = node.method;
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (method === 'imul') {
            if (args.length >= 2)
              return new KotlinFunctionCall(
                new KotlinMemberAccess(new KotlinParenthesized(new KotlinBinaryExpression(args[0], '*', args[1])), 'toInt'),
                []
              );
          }
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), method),
            args
          );
        }

        case 'MathConstant': {
          switch (node.name) {
            case 'PI': return new KotlinMemberAccess(new KotlinIdentifier('Math'), 'PI');
            case 'E': return new KotlinMemberAccess(new KotlinIdentifier('Math'), 'E');
            case 'LN2': return new KotlinFunctionCall(new KotlinMemberAccess(new KotlinIdentifier('Math'), 'log'), [KotlinLiteral.Double(2.0)]);
            case 'LN10': return new KotlinFunctionCall(new KotlinMemberAccess(new KotlinIdentifier('Math'), 'log'), [KotlinLiteral.Double(10.0)]);
            case 'LOG2E': return new KotlinBinaryExpression(KotlinLiteral.Double(1.0), '/', new KotlinFunctionCall(new KotlinMemberAccess(new KotlinIdentifier('Math'), 'log'), [KotlinLiteral.Double(2.0)]));
            case 'LOG10E': return new KotlinFunctionCall(new KotlinMemberAccess(new KotlinIdentifier('Math'), 'log10'), [new KotlinMemberAccess(new KotlinIdentifier('Math'), 'E')]);
            case 'SQRT2': return new KotlinFunctionCall(new KotlinMemberAccess(new KotlinIdentifier('Math'), 'sqrt'), [KotlinLiteral.Double(2.0)]);
            case 'SQRT1_2': return new KotlinFunctionCall(new KotlinMemberAccess(new KotlinIdentifier('Math'), 'sqrt'), [KotlinLiteral.Double(0.5)]);
            default: return KotlinLiteral.Double(node.value);
          }
        }

        case 'NumberConstant': {
          switch (node.name) {
            case 'MAX_SAFE_INTEGER': return new KotlinMemberAccess(new KotlinIdentifier('Long'), 'MAX_VALUE');
            case 'MIN_SAFE_INTEGER': return new KotlinMemberAccess(new KotlinIdentifier('Long'), 'MIN_VALUE');
            case 'MAX_VALUE': return new KotlinMemberAccess(new KotlinIdentifier('Double'), 'MAX_VALUE');
            case 'MIN_VALUE': return new KotlinMemberAccess(new KotlinIdentifier('Double'), 'MIN_VALUE');
            case 'POSITIVE_INFINITY': return new KotlinMemberAccess(new KotlinIdentifier('Double'), 'POSITIVE_INFINITY');
            case 'NEGATIVE_INFINITY': return new KotlinMemberAccess(new KotlinIdentifier('Double'), 'NEGATIVE_INFINITY');
            case 'NaN': return new KotlinMemberAccess(new KotlinIdentifier('Double'), 'NaN');
            case 'EPSILON': return new KotlinMemberAccess(new KotlinIdentifier('Double'), 'MIN_VALUE');
            default: return KotlinLiteral.Double(node.value);
          }
        }

        case 'InstanceOfCheck': {
          const value = this.transformExpression(node.value);
          const className = typeof node.className === 'string' ? new KotlinIdentifier(node.className) : this.transformExpression(node.className);
          return new KotlinIsExpression(value, className);
        }

        // ========================[ ARRAY OPERATIONS ]========================

        case 'ArrayAppend': {
          // array.push(value) -> list.add(element)
          const arr = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'add'),
            [value]
          );
        }

        case 'ArrayClear': {
          // OpCodes.ClearArray(arr) -> array.fill(0) or list.clear()
          const arr = this.transformExpression(node.array || node.arguments?.[0]);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'fill'),
            [KotlinLiteral.Int(0)]
          );
        }

        case 'ArrayConcat': {
          // arr1.concat(arr2) -> list1 + list2
          const arr1 = this.transformExpression(node.array);
          const arr2 = this.transformExpression(node.other);
          return new KotlinBinaryExpression(arr1, '+', arr2);
        }

        case 'ArrayEvery': {
          // array.every(callback) -> list.all { ... }
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'all'),
            callback ? [callback] : []
          );
        }

        case 'ArrayFill': {
          // array.fill(value) -> array.fill(value)
          const arr = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'fill'),
            [value]
          );
        }

        case 'ArrayFilter': {
          // array.filter(callback) -> list.filter { ... }
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'filter'),
            callback ? [callback] : []
          );
        }

        case 'ArrayFind': {
          // array.find(callback) -> list.find { ... }
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'find'),
            callback ? [callback] : []
          );
        }

        case 'ArrayFindIndex': {
          // array.findIndex(callback) -> list.indexOfFirst { ... }
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'indexOfFirst'),
            callback ? [callback] : []
          );
        }

        case 'ArrayForEach': {
          // array.forEach(callback) -> list.forEach { ... }
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'forEach'),
            callback ? [callback] : []
          );
        }

        case 'ArrayFrom': {
          // Array.from(iterable) -> iterable.toList() or iterable.toTypedArray()
          const arrayLike = this.transformExpression(node.arrayLike || node.iterable);
          if (node.mapFn) {
            const mapFn = this.transformExpression(node.mapFn);
            return new KotlinFunctionCall(
              new KotlinMemberAccess(
                new KotlinFunctionCall(new KotlinMemberAccess(arrayLike, 'map'), [mapFn]),
                'toTypedArray'
              ),
              []
            );
          }
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arrayLike, 'toTypedArray'),
            []
          );
        }

        case 'ArrayIncludes': {
          // array.includes(value) -> element in list
          const arr = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new KotlinBinaryExpression(value, 'in', arr);
        }

        case 'ArrayIndexOf': {
          // array.indexOf(value) -> list.indexOf(element)
          const arr = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'indexOf'),
            [value]
          );
        }

        case 'ArrayJoin': {
          // array.join(sep) -> list.joinToString(separator)
          const arr = this.transformExpression(node.array);
          const sep = node.separator ? this.transformExpression(node.separator) : KotlinLiteral.String(',');
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'joinToString'),
            [sep]
          );
        }

        case 'ArrayLength': {
          // array.length -> list.size
          const arr = this.transformExpression(node.array);
          return new KotlinMemberAccess(arr, 'size');
        }

        case 'ArrayMap': {
          // array.map(callback) -> list.map { ... }
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'map'),
            callback ? [callback] : []
          );
        }

        case 'ArrayPop': {
          // array.pop() -> list.removeAt(list.size - 1) or list.removeLast()
          const arr = this.transformExpression(node.array);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'removeLast'),
            []
          );
        }

        case 'ArrayPush': {
          // array.push(value) -> list.add(element)
          const arr = this.transformExpression(node.array);
          const value = node.value ? this.transformExpression(node.value) : null;
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'add'),
            value ? [value] : []
          );
        }

        case 'ArrayReduce': {
          // array.reduce(callback, initial) -> list.fold(init) { acc, e -> ... }
          const arr = this.transformExpression(node.array);
          const args = [];
          if (node.initialValue) {
            // Use fold when initial value is provided
            args.push(this.transformExpression(node.initialValue));
            if (node.callback) args.push(this.transformExpression(node.callback));
            return new KotlinFunctionCall(
              new KotlinMemberAccess(arr, 'fold'),
              args
            );
          }
          // Use reduce when no initial value
          if (node.callback) args.push(this.transformExpression(node.callback));
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'reduce'),
            args
          );
        }

        case 'ArrayReverse': {
          // array.reverse() -> list.reversed()
          const arr = this.transformExpression(node.array);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'reversed'),
            []
          );
        }

        case 'ArrayShift': {
          // array.shift() -> list.removeAt(0)
          const arr = this.transformExpression(node.array);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'removeAt'),
            [KotlinLiteral.Int(0)]
          );
        }

        case 'ArraySlice': {
          // array.slice(start, end) -> list.subList(start, end) or list.slice(start until end)
          const arr = this.transformExpression(node.array);
          const start = node.start ? this.transformExpression(node.start) : KotlinLiteral.Int(0);
          const end = node.end ? this.transformExpression(node.end) : new KotlinMemberAccess(arr, 'size');
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'subList'),
            [start, end]
          );
        }

        case 'ArraySome': {
          // array.some(callback) -> list.any { ... }
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'any'),
            callback ? [callback] : []
          );
        }

        case 'ArraySort': {
          // array.sort(compareFn) -> list.sortWith(comparator) or list.sort()
          const arr = this.transformExpression(node.array);
          const args = node.compareFn ? [this.transformExpression(node.compareFn)] : [];
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, args.length > 0 ? 'sortWith' : 'sort'),
            args
          );
        }

        case 'ArraySplice': {
          // array.splice(start, deleteCount, items...) -> manual subList manipulation
          const arr = this.transformExpression(node.array);
          const args = [];
          if (node.start) args.push(this.transformExpression(node.start));
          if (node.deleteCount) args.push(this.transformExpression(node.deleteCount));
          if (node.items) {
            for (const item of node.items)
              args.push(this.transformExpression(item));
          }
          // No direct equivalent; emit as a helper call
          return new KotlinFunctionCall(
            new KotlinIdentifier('splice'),
            [arr, ...args]
          );
        }

        case 'ArrayUnshift': {
          // array.unshift(value) -> list.add(0, element)
          const arr = this.transformExpression(node.array);
          const value = node.value ? this.transformExpression(node.value) : null;
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'add'),
            value ? [KotlinLiteral.Int(0), value] : [KotlinLiteral.Int(0)]
          );
        }

        case 'ArrayXor': {
          // XOR two arrays -> helper function
          const arr1 = this.transformExpression(node.array1 || node.arguments?.[0]);
          const arr2 = this.transformExpression(node.array2 || node.arguments?.[1]);
          return new KotlinFunctionCall(
            new KotlinIdentifier('xorArrays'),
            [arr1, arr2]
          );
        }

        case 'ClearArray': {
          // OpCodes.ClearArray(arr) -> array.fill(0)
          const arr = this.transformExpression(node.arguments?.[0] || node.array);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'fill'),
            [KotlinLiteral.Int(0)]
          );
        }

        case 'CopyArray': {
          // array copy -> array.copyOf() or list.toMutableList()
          const arr = this.transformExpression(node.arguments?.[0] || node.array || node.value);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(arr, 'copyOf'),
            []
          );
        }

        case 'ArrayCreation': {
          // new Array(size) -> Array(size) { 0 }
          const size = node.size ? this.transformExpression(node.size) : null;
          if (size) {
            return new KotlinFunctionCall(
              new KotlinIdentifier('Array'),
              [size, new KotlinLambda([], KotlinLiteral.UInt(0))]
            );
          }
          return new KotlinArrayCreation('mutableListOf', []);
        }

        case 'ArrayLiteral': {
          // [a, b, c] -> mutableListOf(a, b, c)
          const elements = (node.elements || []).map(e => this.transformExpression(e));
          return new KotlinArrayCreation('mutableListOf', elements);
        }

        // ========================[ STRING OPERATIONS ]========================

        case 'StringCharAt': {
          // str.charAt(index) -> str[index]
          const str = this.transformExpression(node.string || node.value);
          const index = this.transformExpression(node.index);
          return new KotlinElementAccess(str, index);
        }

        case 'StringCharCodeAt': {
          // str.charCodeAt(index) -> str[index].code
          const str = this.transformExpression(node.string || node.value);
          const index = node.index ? this.transformExpression(node.index) : KotlinLiteral.Int(0);
          return new KotlinMemberAccess(
            new KotlinElementAccess(str, index),
            'code'
          );
        }

        case 'StringEndsWith': {
          // str.endsWith(suffix) -> str.endsWith(suffix)
          const str = this.transformExpression(node.string || node.value);
          const searchValue = this.transformExpression(node.searchValue || node.search);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'endsWith'),
            [searchValue]
          );
        }

        case 'StringFromCharCodes': {
          // String.fromCharCode(...codes) -> chars.map { it.toChar() }.joinToString("")
          const codes = (node.charCodes || node.arguments || []).map(c => this.transformExpression(c));
          if (codes.length === 1) {
            return new KotlinFunctionCall(
              new KotlinMemberAccess(codes[0], 'toChar'),
              []
            );
          }
          // Multiple codes: charArrayOf(c1, c2, ...).concatToString()
          return new KotlinFunctionCall(
            new KotlinMemberAccess(
              new KotlinArrayCreation('charArrayOf', codes.map(c =>
                new KotlinFunctionCall(new KotlinMemberAccess(c, 'toChar'), [])
              )),
              'concatToString'
            ),
            []
          );
        }

        case 'StringIncludes': {
          // str.includes(sub) -> str.contains(sub)
          const str = this.transformExpression(node.string || node.value);
          const searchValue = this.transformExpression(node.searchValue || node.search);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'contains'),
            [searchValue]
          );
        }

        case 'StringIndexOf': {
          // str.indexOf(sub) -> str.indexOf(sub)
          const str = this.transformExpression(node.string || node.value);
          const search = node.search ? this.transformExpression(node.search) : null;
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'indexOf'),
            search ? [search] : []
          );
        }

        case 'StringRepeat': {
          // str.repeat(count) -> str.repeat(count)
          const str = this.transformExpression(node.string || node.value);
          const count = this.transformExpression(node.count);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'repeat'),
            [count]
          );
        }

        case 'StringReplace': {
          // str.replace(old, new) -> str.replace(old, new)
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.search || node.pattern);
          const replacement = this.transformExpression(node.replacement || node.replaceWith);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'replace'),
            [search, replacement]
          );
        }

        case 'StringSplit': {
          // str.split(delim) -> str.split(delim)
          const str = this.transformExpression(node.string || node.value);
          const separator = node.separator ? this.transformExpression(node.separator) : null;
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'split'),
            separator ? [separator] : []
          );
        }

        case 'StringStartsWith': {
          // str.startsWith(prefix) -> str.startsWith(prefix)
          const str = this.transformExpression(node.string || node.value);
          const searchValue = this.transformExpression(node.searchValue || node.search);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'startsWith'),
            [searchValue]
          );
        }

        case 'StringSubstring': {
          // str.substring(start, end) -> str.substring(start, end)
          const str = this.transformExpression(node.string || node.value);
          const args = [];
          if (node.start) args.push(this.transformExpression(node.start));
          if (node.end) args.push(this.transformExpression(node.end));
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'substring'),
            args
          );
        }

        case 'StringToLowerCase': {
          // str.toLowerCase() -> str.lowercase()
          const str = this.transformExpression(node.string || node.value);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'lowercase'),
            []
          );
        }

        case 'StringToUpperCase': {
          // str.toUpperCase() -> str.uppercase()
          const str = this.transformExpression(node.string || node.value);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'uppercase'),
            []
          );
        }

        case 'StringTrim': {
          // str.trim() -> str.trim()
          const str = this.transformExpression(node.string || node.value);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'trim'),
            []
          );
        }

        case 'StringInterpolation': {
          // String interpolation with parts -> Kotlin string template
          let templateStr = '';
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                if (part.value)
                  templateStr += part.value.replace(/\$/g, '\\$');
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                const expr = this.transformExpression(part.expression);
                if (expr.nodeType === 'Identifier')
                  templateStr += `\$${expr.name}`;
                else
                  templateStr += `\${${this.emitExpressionInline(expr)}}`;
              }
            }
          }
          return new KotlinStringTemplate(templateStr);
        }

        // ========================[ BYTE/BUFFER OPERATIONS ]========================

        case 'BufferCreation': {
          // new ArrayBuffer(size) -> ByteArray(size)
          const size = node.size ? this.transformExpression(node.size) : KotlinLiteral.Int(0);
          return new KotlinFunctionCall(
            new KotlinIdentifier('ByteArray'),
            [size]
          );
        }

        case 'BytesToString': {
          // bytes to string -> String(bytes, Charsets.UTF_8)
          const bytes = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          const encoding = node.encoding === 'utf8' ? 'UTF_8' : 'US_ASCII';
          return new KotlinObjectCreation(
            new KotlinType('String'),
            [bytes, new KotlinMemberAccess(new KotlinIdentifier('Charsets'), encoding)]
          );
        }

        case 'StringToBytes': {
          // str to bytes -> str.toByteArray(Charsets.UTF_8)
          const str = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          const encoding = node.encoding === 'utf8' ? 'UTF_8' : 'US_ASCII';
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'toByteArray'),
            [new KotlinMemberAccess(new KotlinIdentifier('Charsets'), encoding)]
          );
        }

        case 'AnsiToBytes': {
          // str to ASCII bytes -> str.toByteArray(Charsets.US_ASCII)
          const str = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(str, 'toByteArray'),
            [new KotlinMemberAccess(new KotlinIdentifier('Charsets'), 'US_ASCII')]
          );
        }

        case 'HexDecode': {
          // Hex string to bytes -> hexToBytes helper
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new KotlinFunctionCall(
            new KotlinIdentifier('hexToBytes'),
            [value]
          );
        }

        case 'HexEncode': {
          // Bytes to hex string -> bytesToHex helper
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new KotlinFunctionCall(
            new KotlinIdentifier('bytesToHex'),
            [value]
          );
        }

        case 'PackBytes': {
          // Pack bytes to integer -> helper function
          const args = (node.arguments || node.bytes || []).map(arg => {
            if (arg.type === 'SpreadElement')
              return this.transformExpression(arg.argument);
            return this.transformExpression(arg);
          });
          const isBE = node.endian === 'big' || node.bigEndian;
          const bits = node.bits || 32;
          const methodName = `pack${bits}${isBE ? 'BE' : 'LE'}`;
          return new KotlinFunctionCall(
            new KotlinIdentifier(methodName),
            args
          );
        }

        case 'UnpackBytes': {
          // Unpack integer to bytes -> helper function
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          const isBE = node.endian === 'big' || node.bigEndian;
          const bits = node.bits || 32;
          const methodName = `unpack${bits}${isBE ? 'BE' : 'LE'}`;
          return new KotlinFunctionCall(
            new KotlinIdentifier(methodName),
            [value]
          );
        }

        // ========================[ DATAVIEW OPERATIONS ]========================

        case 'DataViewCreation': {
          // new DataView(buffer) -> ByteBuffer.wrap(buffer)
          this.addImport('java.nio.ByteBuffer');
          const buffer = node.buffer ? this.transformExpression(node.buffer) : null;
          const args = buffer ? [buffer] : [];
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('ByteBuffer'), 'wrap'),
            args
          );
        }

        case 'DataViewRead': {
          // dataview.getUint32(offset, littleEndian) -> buffer.getInt() etc.
          this.addImport('java.nio.ByteBuffer');
          const view = this.transformExpression(node.view);
          const args = [this.transformExpression(node.offset)];
          const method = node.method || 'getInt';
          // Map JS DataView methods to ByteBuffer methods
          const methodMap = {
            'getUint8': 'get', 'getInt8': 'get',
            'getUint16': 'getShort', 'getInt16': 'getShort',
            'getUint32': 'getInt', 'getInt32': 'getInt',
            'getFloat32': 'getFloat', 'getFloat64': 'getDouble'
          };
          return new KotlinFunctionCall(
            new KotlinMemberAccess(view, methodMap[method] || method),
            args
          );
        }

        case 'DataViewWrite': {
          // dataview.setUint32(offset, value, littleEndian) -> buffer.putInt() etc.
          this.addImport('java.nio.ByteBuffer');
          const view = this.transformExpression(node.view);
          const args = [this.transformExpression(node.offset), this.transformExpression(node.value)];
          const method = node.method || 'setInt';
          const methodMap = {
            'setUint8': 'put', 'setInt8': 'put',
            'setUint16': 'putShort', 'setInt16': 'putShort',
            'setUint32': 'putInt', 'setInt32': 'putInt',
            'setFloat32': 'putFloat', 'setFloat64': 'putDouble'
          };
          return new KotlinFunctionCall(
            new KotlinMemberAccess(view, methodMap[method] || method),
            args
          );
        }

        // ========================[ MAP/SET OPERATIONS ]========================

        case 'MapCreation': {
          // new Map() -> mutableMapOf<K, V>()
          const args = node.entries ? [this.transformExpression(node.entries)] : [];
          return new KotlinFunctionCall(
            new KotlinIdentifier('mutableMapOf'),
            args
          );
        }

        case 'MapGet': {
          // map.get(key) -> map[key]
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new KotlinElementAccess(map, key);
        }

        case 'MapSet': {
          // map.set(key, value) -> map[key] = value
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          const value = this.transformExpression(node.value);
          return new KotlinAssignment(
            new KotlinElementAccess(map, key),
            value
          );
        }

        case 'MapHas': {
          // map.has(key) -> key in map
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new KotlinBinaryExpression(key, 'in', map);
        }

        case 'MapDelete': {
          // map.delete(key) -> map.remove(key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(map, 'remove'),
            [key]
          );
        }

        case 'SetCreation': {
          // new Set() -> mutableSetOf<T>()
          const args = node.values ? [this.transformExpression(node.values)] : [];
          return new KotlinFunctionCall(
            new KotlinIdentifier('mutableSetOf'),
            args
          );
        }

        // ========================[ UTILITY OPERATIONS ]========================

        case 'Cast': {
          // Type cast -> (value as Type) or value.toInt() etc.
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          const targetType = node.targetType || node.toType || 'int';
          const castMethodMap = {
            'uint8': 'toUByte', 'byte': 'toUByte',
            'uint16': 'toUShort', 'word': 'toUShort',
            'uint32': 'toUInt', 'dword': 'toUInt',
            'uint64': 'toULong', 'qword': 'toULong',
            'int8': 'toByte', 'sbyte': 'toByte',
            'int16': 'toShort', 'short': 'toShort',
            'int32': 'toInt', 'int': 'toInt',
            'int64': 'toLong', 'long': 'toLong',
            'float': 'toFloat', 'float32': 'toFloat',
            'double': 'toDouble', 'float64': 'toDouble',
            'boolean': 'toBoolean', 'bool': 'toBoolean',
            'string': 'toString'
          };
          const castMethod = castMethodMap[targetType];
          if (castMethod) {
            return new KotlinFunctionCall(
              new KotlinMemberAccess(value, castMethod),
              []
            );
          }
          // Fallback: use 'as' cast
          return new KotlinAsExpression(value, new KotlinType(this.toPascalCase(targetType)));
        }

        case 'OpCodesCall': {
          // OpCodes.MethodName(args) -> Kotlin equivalent
          const methodName = node.methodName || node.method;
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          switch (methodName) {
            case 'CopyArray':
              return new KotlinFunctionCall(new KotlinMemberAccess(args[0], 'copyOf'), []);
            case 'ClearArray':
              return new KotlinFunctionCall(new KotlinMemberAccess(args[0], 'fill'), [KotlinLiteral.Int(0)]);
            default:
              return new KotlinFunctionCall(new KotlinIdentifier(this.toCamelCase(methodName)), args);
          }
        }

        case 'TypeOfExpression': {
          // typeof value -> when(value) { is Int -> "number", is String -> "string", ... }
          // Simplified: value::class.simpleName
          const argument = this.transformExpression(node.argument || node.value);
          return new KotlinMemberAccess(
            new KotlinMemberAccess(argument, '::class'),
            'simpleName'
          );
        }

        case 'IsArrayCheck': {
          // Array.isArray(x) -> value is Array<*> or value is List<*>
          const value = this.transformExpression(node.value);
          return new KotlinIsExpression(value, new KotlinIdentifier('List<*>'));
        }

        case 'TypedArrayCreation': {
          // new Uint8Array(size) -> UByteArray(size), etc.
          const size = node.size ? this.transformExpression(node.size) : KotlinLiteral.Int(0);
          const typeMap = {
            'Uint8Array': 'UByteArray', 'Int8Array': 'ByteArray',
            'Uint16Array': 'UShortArray', 'Int16Array': 'ShortArray',
            'Uint32Array': 'UIntArray', 'Int32Array': 'IntArray',
            'Uint64Array': 'ULongArray', 'Int64Array': 'LongArray',
            'Float32Array': 'FloatArray', 'Float64Array': 'DoubleArray'
          };
          const kotlinType = typeMap[node.arrayType] || 'IntArray';
          return new KotlinFunctionCall(
            new KotlinIdentifier(kotlinType),
            [size]
          );
        }

        case 'TypedArraySet': {
          // typedArray.set(source, offset) -> System.arraycopy() or source.copyInto(dest, offset)
          const array = this.transformExpression(node.array);
          const source = node.source ? this.transformExpression(node.source) : null;
          const args = source ? [array] : [];
          if (node.offset) args.push(this.transformExpression(node.offset));
          if (source) {
            return new KotlinFunctionCall(
              new KotlinMemberAccess(source, 'copyInto'),
              [array, ...(node.offset ? [this.transformExpression(node.offset)] : [])]
            );
          }
          return new KotlinFunctionCall(
            new KotlinMemberAccess(array, 'set'),
            args
          );
        }

        case 'TypedArraySubarray': {
          // typedArray.subarray(begin, end) -> array.copyOfRange(begin, end)
          const array = this.transformExpression(node.array);
          const args = [];
          if (node.begin) args.push(this.transformExpression(node.begin));
          if (node.end) args.push(this.transformExpression(node.end));
          return new KotlinFunctionCall(
            new KotlinMemberAccess(array, 'copyOfRange'),
            args
          );
        }

        case 'BigIntCast': {
          // BigInt(value) -> value.toBigInteger()
          const value = this.transformExpression(node.argument || node.value);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(value, 'toBigInteger'),
            []
          );
        }

        case 'ObjectFreeze': {
          // Object.freeze(x) -> no direct equivalent, emit as-is
          return this.transformExpression(node.value || node.object);
        }

        case 'ObjectKeys': {
          // Object.keys(obj) -> map.keys.toList()
          const obj = this.transformExpression(node.object || node.value);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinMemberAccess(obj, 'keys'), 'toList'),
            []
          );
        }

        case 'ObjectValues': {
          // Object.values(obj) -> map.values.toList()
          const obj = this.transformExpression(node.object || node.value);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinMemberAccess(obj, 'values'), 'toList'),
            []
          );
        }

        case 'ObjectEntries': {
          // Object.entries(obj) -> map.entries.map { it.key to it.value }
          const obj = this.transformExpression(node.object || node.value);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinMemberAccess(obj, 'entries'), 'toList'),
            []
          );
        }

        case 'ObjectLiteral': {
          // {key: value} -> mapOf("key" to value)
          if (!node.properties || node.properties.length === 0)
            return new KotlinFunctionCall(new KotlinIdentifier('mapOf'), []);
          const pairs = [];
          for (const prop of (node.properties || [])) {
            if (prop.type === 'SpreadElement' || prop.type === 'ObjectSpread') continue;
            const key = typeof prop.key === 'string'
              ? KotlinLiteral.String(prop.key)
              : (prop.key?.name ? KotlinLiteral.String(prop.key.name) : KotlinLiteral.String(prop.key?.value || 'key'));
            const value = this.transformExpression(prop.value);
            pairs.push(new KotlinBinaryExpression(key, 'to', value));
          }
          return new KotlinFunctionCall(new KotlinIdentifier('mapOf'), pairs);
        }

        case 'Random': {
          // Math.random() -> kotlin.random.Random.nextDouble()
          return new KotlinFunctionCall(
            new KotlinMemberAccess(
              new KotlinMemberAccess(new KotlinIdentifier('kotlin.random'), 'Random'),
              'nextDouble'
            ),
            []
          );
        }

        case 'ErrorCreation': {
          // new Error("message") -> Exception(message) or RuntimeException(message)
          const errorTypeMap = {
            'Error': 'Exception',
            'TypeError': 'IllegalArgumentException',
            'RangeError': 'IndexOutOfBoundsException',
            'ReferenceError': 'NullPointerException'
          };
          const errorType = errorTypeMap[node.errorType] || 'RuntimeException';
          const message = node.message ? this.transformExpression(node.message) : KotlinLiteral.String('');
          return new KotlinObjectCreation(
            new KotlinType(errorType),
            [message]
          );
        }

        case 'DebugOutput': {
          // console.log(...) -> println(...)
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          return new KotlinFunctionCall(
            new KotlinIdentifier('println'),
            args
          );
        }

        case 'YieldExpression': {
          // yield value -> yield(value) in sequence builder
          const argument = node.argument ? this.transformExpression(node.argument) : KotlinLiteral.Null();
          return new KotlinFunctionCall(
            new KotlinIdentifier('yield'),
            [argument]
          );
        }

        case 'ThisMethodCall': {
          // this.method(args) -> this.method(args)
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinThis(), this.toCamelCase(node.method)),
            args
          );
        }

        case 'ThisPropertyAccess': {
          // this.property -> this.property
          return new KotlinMemberAccess(new KotlinThis(), this.toCamelCase(node.property));
        }

        case 'ParentConstructorCall': {
          // super(args) -> super(args)
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new KotlinFunctionCall(
            new KotlinSuper(),
            args
          );
        }

        case 'ParentMethodCall': {
          // super.method(args) -> super.method(args)
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinSuper(), this.toCamelCase(node.method)),
            args
          );
        }

        // ========================[ ADDITIONAL IL NODE TYPES ]========================

        case 'Rotation': {
          // Bitwise rotation -> value.rotateLeft/rotateRight(amount)
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const direction = node.direction || 'left';
          const method = direction === 'left' ? 'rotateLeft' : 'rotateRight';
          return new KotlinFunctionCall(
            new KotlinMemberAccess(value, method),
            [amount]
          );
        }

        case 'RotateLeft': {
          // value.rotateLeft(amount)
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(value, 'rotateLeft'),
            [amount]
          );
        }

        case 'RotateRight': {
          // value.rotateRight(amount)
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(value, 'rotateRight'),
            [amount]
          );
        }

        case 'Power': {
          // x ** y -> Math.pow(x.toDouble(), y.toDouble())
          const left = this.transformExpression(node.base || node.left || node.arguments?.[0]);
          const right = this.transformExpression(node.exponent || node.right || node.arguments?.[1]);
          return new KotlinFunctionCall(
            new KotlinMemberAccess(new KotlinIdentifier('Math'), 'pow'),
            [
              new KotlinFunctionCall(new KotlinMemberAccess(left, 'toDouble'), []),
              new KotlinFunctionCall(new KotlinMemberAccess(right, 'toDouble'), [])
            ]
          );
        }

        case 'ArrowFunction':
        case 'FunctionExpression': {
          // (params) => body -> { params -> body }
          const params = (node.params || []).map(p => {
            const paramName = typeof p === 'string' ? p : (p.name || 'arg');
            const paramType = this.inferParameterType(paramName, typeof p === 'string' ? {} : p);
            return new KotlinParameter(paramName, paramType);
          });
          let body;
          if (node.body) {
            if (node.body.type === 'BlockStatement')
              body = this.transformBlockStatement(node.body);
            else
              body = this.transformExpression(node.body);
          } else {
            body = KotlinLiteral.Null();
          }
          return new KotlinLambda(params, body);
        }

        default:
          console.warn(`No expression transformer for: ${node.type}`);
          return new KotlinIdentifier(`/* Unhandled: ${node.type} */`);
      }
    }

    transformFunctionExpression(node) {
      const params = (node.params || []).map(p => {
        const paramName = p.name || 'param';
        const paramType = this.inferParameterType(paramName, p);
        return new KotlinParameter(paramName, paramType);
      });

      let body;
      if (node.body.type === 'BlockStatement') {
        body = this.transformBlockStatement(node.body);
      } else {
        // Expression body
        body = this.transformExpression(node.body);
      }

      return new KotlinLambda(params, body);
    }

    transformObjectExpression(node) {
      // In Kotlin, object expressions are anonymous objects
      // For simple key-value pairs, use mapOf
      const entries = [];
      for (const prop of node.properties || []) {
        // Skip spread elements - Kotlin would need spread operator handling
        if (prop.type === 'SpreadElement' || !prop.key) continue;
        const key = prop.key.name || prop.key.value || 'unknown';
        const value = this.transformExpression(prop.value);
        entries.push({ key: KotlinLiteral.String(key), value });
      }

      // Generate mapOf("key" to value, ...)
      const pairs = entries.map(e =>
        new KotlinBinaryExpression(e.key, 'to', e.value)
      );

      return new KotlinFunctionCall(
        new KotlinIdentifier('mapOf'),
        pairs
      );
    }

    // ========================[ TOP-LEVEL DECLARATIONS ]========================

    transformFunctionDeclaration(node) {
      const name = node.id ? this.toCamelCase(node.id.name) : 'anonymous';
      const returnType = this.inferReturnType(node);

      const func = new KotlinFunction(name, returnType);

      // Parameters
      for (const param of node.params || []) {
        const paramName = param.name || 'param';
        const paramType = this.inferParameterType(paramName, param);
        func.parameters.push(new KotlinParameter(paramName, paramType));
        this.variableTypes.set(paramName, paramType);
      }

      // Body
      this.currentFunction = func;
      if (node.body) {
        func.body = this.transformNode(node.body);
      }
      this.currentFunction = null;

      return func;
    }

    transformClassDeclaration(node) {
      const className = node.id ? this.toPascalCase(node.id.name) : 'UnnamedClass';
      const kotlinClass = new KotlinClass(className);

      // Superclass
      if (node.superClass) {
        const superName = node.superClass.name || 'Any';
        kotlinClass.superClass = new KotlinType(this.toPascalCase(superName));
      }

      this.currentClass = kotlinClass;

      // Separate fields, constructor params, and methods
      const fields = [];
      const methods = [];
      let constructorParams = [];
      let constructorBody = null;

      // Members - handle both standard ClassBody and unwrapped arrays
      const members = node.body?.body || node.body || [];
      if (members && members.length > 0) {
        for (const member of members) {
          const isConstructor = member.type === 'MethodDefinition' &&
                                (member.key?.name === 'constructor' || member.kind === 'constructor');
          if (isConstructor) {
            // Extract constructor parameters and body
            if (member.value && member.value.params && member.value.params.length > 0) {
              constructorParams = member.value.params.map(p => {
                const paramName = p.name || 'param';
                const paramType = this.inferParameterType(paramName, p);
                return new KotlinParameter(paramName, paramType);
              });
            }
            if (member.value && member.value.body)
              constructorBody = this.transformStatement(member.value.body);
          } else {
            const transformed = this.transformClassMember(member);
            if (transformed) {
              if (transformed.nodeType === 'Property' || transformed.nodeType === 'Field') {
                if (transformed.isStatic) {
                  if (!kotlinClass.companionObject) {
                    kotlinClass.companionObject = new KotlinCompanionObject();
                  }
                  kotlinClass.companionObject.members.push(transformed);
                } else {
                  fields.push(transformed);
                }
              } else if (transformed.nodeType === 'Function') {
                if (transformed.isStatic) {
                  if (!kotlinClass.companionObject) {
                    kotlinClass.companionObject = new KotlinCompanionObject();
                  }
                  kotlinClass.companionObject.members.push(transformed);
                } else {
                  methods.push(transformed);
                }
              } else {
                kotlinClass.members.push(transformed);
              }
            }
          }
        }
      }

      // Build primary constructor if we have parameters
      if (constructorParams.length > 0) {
        kotlinClass.primaryConstructor = new KotlinPrimaryConstructor(constructorParams);

        // Extract field declarations from constructor body
        if (constructorBody && constructorBody.statements?.length > 0) {
          const { properties, remainingStatements } = this.extractFieldsFromConstructorBody(constructorBody.statements, constructorParams);

          // Add extracted properties to class
          fields.push(...properties);

          // If there are remaining statements, add as init block
          if (remainingStatements.length > 0) {
            const initBlock = new KotlinBlock();
            initBlock.statements = remainingStatements;
            kotlinClass.initBlocks = [initBlock];
          }
        }
      } else if (constructorBody && constructorBody.statements?.length > 0) {
        // Extract fields even without constructor params
        const { properties, remainingStatements } = this.extractFieldsFromConstructorBody(constructorBody.statements, []);
        fields.push(...properties);

        if (remainingStatements.length > 0) {
          // Secondary constructor
          const ctor = new KotlinConstructor();
          const initBlock = new KotlinBlock();
          initBlock.statements = remainingStatements;
          ctor.body = initBlock;
          kotlinClass.members.push(ctor);
        }
      }

      // Add fields first, then methods
      kotlinClass.members.push(...fields);
      kotlinClass.members.push(...methods);

      this.currentClass = null;
      return kotlinClass;
    }

    transformClassMember(node) {
      if (node.type === 'MethodDefinition') {
        const key = node.key.name || 'method';

        if (key === 'constructor') {
          return this.transformConstructor(node);
        }

        // Handle getters and setters
        if (node.kind === 'get' || node.kind === 'set') {
          return this.transformAccessor(node);
        }

        const methodName = this.toCamelCase(key);
        const returnType = this.inferReturnType(node.value);

        const func = new KotlinFunction(methodName, returnType);
        func.isStatic = node.static || false;
        func.isOverride = this.isOverrideMethod(key);

        // Parameters
        if (node.value && node.value.params) {
          for (const param of node.value.params) {
            const paramName = param.name || 'param';
            const paramType = this.inferParameterType(paramName, param);
            func.parameters.push(new KotlinParameter(paramName, paramType));
            this.variableTypes.set(paramName, paramType);
          }
        }

        // Body
        this.currentFunction = func;
        if (node.value && node.value.body) {
          func.body = this.transformStatement(node.value.body);
        }
        this.currentFunction = null;

        return func;
      }

      if (node.type === 'PropertyDefinition' || node.type === 'ClassProperty') {
        const key = node.key.name || 'property';
        const propName = this.toCamelCase(key);
        const propType = this.inferPropertyType(node);

        const prop = new KotlinProperty(propName, propType);
        prop.isStatic = node.static || false;
        prop.isVar = !node.readonly;

        if (node.value) {
          prop.initializer = this.transformExpression(node.value);
        }

        return prop;
      }

      if (node.type === 'StaticBlock') {
        // ES2022 static block -> Kotlin companion object init block
        return this.transformStaticBlock(node);
      }

      return null;
    }

    transformStaticBlock(node) {
      // ES2022 static { code } -> Kotlin companion object with init { code }
      // Note: This creates an init block that should be added to the companion object
      const statements = node.body.map(stmt => this.transformStatement(stmt));

      // Create an init block (represented as a special function)
      const initBlock = new KotlinFunction('init', KotlinType.Unit());
      initBlock.isInitBlock = true;
      initBlock.body = statements;

      return initBlock;
    }

    transformClassExpression(node) {
      // ClassExpression -> Kotlin class
      const className = node.id?.name || 'AnonymousClass';
      const classDecl = new KotlinClass(className);

      if (node.superClass)
        classDecl.superClass = this.transformExpression(node.superClass);

      if (node.body?.body) {
        for (const member of node.body.body) {
          if (member.type === 'MethodDefinition') {
            // Transform as function
            const func = this.transformFunctionDeclaration({
              type: 'FunctionDeclaration',
              id: member.key,
              params: member.value?.params || [],
              body: member.value?.body
            });
            if (func)
              classDecl.members.push(func);
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
      // Kotlin uses sequence { yield(value) } - return argument for now
      const argument = node.argument ? this.transformExpression(node.argument) : KotlinLiteral.Null();
      return argument;
    }

    transformAccessor(node) {
      const propName = this.toCamelCase(node.key.name || 'property');
      const isGetter = node.kind === 'get';

      // Infer type from getter return or setter parameter
      let propType;
      if (isGetter) {
        propType = this.inferReturnType(node.value);
      } else {
        const param = node.value?.params?.[0];
        propType = param ? this.inferParameterType(param.name, param) : KotlinType.Any();
      }

      const prop = new KotlinProperty(propName, propType);
      prop.isVar = !isGetter; // Getter-only properties are val

      // Transform getter/setter bodies
      if (isGetter && node.value?.body) {
        prop.getter = this.transformStatement(node.value.body);
      } else if (!isGetter && node.value?.body) {
        prop.setter = this.transformStatement(node.value.body);
      }

      return prop;
    }

    isOverrideMethod(methodName) {
      // Common override methods from AlgorithmFramework
      const overrideMethods = ['createInstance', 'feed', 'result'];
      return overrideMethods.includes(methodName.toLowerCase());
    }

    /**
     * Extract field declarations from constructor body statements
     * Converts this._x = value patterns to property declarations
     */
    extractFieldsFromConstructorBody(statements, constructorParams) {
      const properties = [];
      const remainingStatements = [];
      const paramNames = new Set(constructorParams.map(p => p.name));

      for (const stmt of statements) {
        // Check if this is a this.field = value assignment
        if (stmt.nodeType === 'ExpressionStatement' &&
            stmt.expression?.nodeType === 'Assignment' &&
            stmt.expression.target?.nodeType === 'MemberAccess' &&
            stmt.expression.target?.target?.nodeType === 'This') {

          // Get field name (remove leading underscore for Kotlin convention)
          let fieldName = stmt.expression.target.member;
          if (fieldName.startsWith('_'))
            fieldName = fieldName.substring(1);

          // Check if this is a simple assignment from a constructor parameter
          const valueExpr = stmt.expression.value;
          const isSimpleParamAssign = valueExpr?.nodeType === 'Identifier' &&
                                       paramNames.has(valueExpr.name);

          if (isSimpleParamAssign) {
            // Convert to val parameter in primary constructor
            const param = constructorParams.find(p => p.name === valueExpr.name);
            if (param) {
              param.isVal = true;
              // Rename param to match field name if different
              if (param.name !== fieldName) {
                // Keep as separate property initialized from param
                const propType = this.inferKotlinTypeFromExpression(valueExpr);
                const prop = new KotlinProperty(fieldName, propType);
                prop.isVar = true;
                prop.initializer = new KotlinIdentifier(param.name);
                properties.push(prop);
              }
              // If names match, val in constructor is enough
            }
          } else {
            // Create property declaration with initializer
            const propType = this.inferKotlinTypeFromExpression(valueExpr);
            const prop = new KotlinProperty(fieldName, propType);
            prop.isVar = true;
            prop.initializer = valueExpr;
            properties.push(prop);
          }
        } else {
          // Keep non-field-assignment statements
          remainingStatements.push(stmt);
        }
      }

      return { properties, remainingStatements };
    }

    /**
     * Infer Kotlin type from a Kotlin AST expression
     */
    inferKotlinTypeFromExpression(expr) {
      if (!expr) return KotlinType.Any();

      switch (expr.nodeType) {
        case 'Literal':
          if (expr.literalType === 'null') {
            // Nullable type - default to Any?
            const type = new KotlinType('Any');
            type.isNullable = true;
            return type;
          }
          if (expr.literalType === 'Boolean') return KotlinType.Boolean();
          if (expr.literalType === 'String') return KotlinType.String();
          if (expr.literalType === 'Int' || expr.literalType === 'UInt')
            return expr.literalType === 'UInt' ? KotlinType.UInt() : KotlinType.Int();
          if (expr.literalType === 'Long' || expr.literalType === 'ULong')
            return expr.literalType === 'ULong' ? KotlinType.ULong() : KotlinType.Long();
          if (expr.literalType === 'Float') return KotlinType.Float();
          if (expr.literalType === 'Double') return KotlinType.Double();
          return KotlinType.Any();

        case 'ArrayCreation':
          return KotlinType.MutableList(KotlinType.Any());

        case 'Identifier':
          // Check if we know the type
          const knownType = this.variableTypes.get(expr.name);
          return knownType || KotlinType.Any();

        default:
          return KotlinType.Any();
      }
    }

    transformConstructor(node) {
      const ctor = new KotlinConstructor();

      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = param.name || 'param';
          const paramType = this.inferParameterType(paramName, param);
          ctor.parameters.push(new KotlinParameter(paramName, paramType));
        }
      }

      if (node.value && node.value.body) {
        ctor.body = this.transformNode(node.value.body);
      }

      return ctor;
    }

    // ========================[ STATEMENTS ]========================

    transformBlockStatement(node) {
      const block = new KotlinBlock();

      for (const stmt of node.body || []) {
        const transformed = this.transformNode(stmt);
        if (transformed) {
          block.statements.push(transformed);
        }
      }

      return block;
    }

    transformVariableDeclaration(node) {
      const statements = [];

      for (const decl of node.declarations || []) {
        // Skip ObjectPattern destructuring (e.g., const { RegisterAlgorithm } = AlgorithmFramework)
        if (decl.id && decl.id.type === 'ObjectPattern')
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        // Kotlin supports destructuring declarations
        if (decl.id && decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformNode(decl.init) : null;
          if (sourceExpr && decl.id.elements.length > 0) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = elem.name;
              const indexExpr = new KotlinIndexAccess(sourceExpr, KotlinLiteral.Int(i));
              const varType = new KotlinType('Any');

              const varDecl = new KotlinVariableDeclaration(varName, varType, indexExpr);
              varDecl.isVar = node.kind !== 'const';
              this.variableTypes.set(varName, varType);
              statements.push(varDecl);
            }
          }
          continue;
        }

        const varName = decl.id ? decl.id.name : 'variable';
        const varType = this.inferVariableType(varName, decl.init);

        // Check if this is an IIFE (immediately invoked function expression)
        let initializer;
        if (decl.init &&
            decl.init.type === 'CallExpression' &&
            (decl.init.callee.type === 'FunctionExpression' ||
             decl.init.callee.type === 'ArrowFunctionExpression')) {
          // Extract return value from IIFE
          const returnValue = this.getIIFEReturnValue(decl.init);
          initializer = returnValue ? this.transformNode(returnValue) : null;
        } else {
          initializer = decl.init ? this.transformNode(decl.init) : null;
        }

        const varDecl = new KotlinVariableDeclaration(
          varName,
          varType,
          initializer
        );

        varDecl.isVar = node.kind !== 'const';
        this.variableTypes.set(varName, varType);
        statements.push(varDecl);
      }

      return statements.length === 1 ? statements[0] : statements;
    }

    transformExpressionStatement(node) {
      const expr = this.transformNode(node.expression);
      return new KotlinExpressionStatement(expr);
    }

    transformReturnStatement(node) {
      return new KotlinReturn(
        node.argument ? this.transformNode(node.argument) : null
      );
    }

    transformIfStatement(node) {
      return new KotlinIf(
        this.transformNode(node.test),
        this.transformNode(node.consequent),
        node.alternate ? this.transformNode(node.alternate) : null
      );
    }

    transformSwitchStatement(node) {
      const when = new KotlinWhen(this.transformNode(node.discriminant));

      for (const caseNode of node.cases || []) {
        const entry = new KotlinWhenEntry();

        if (caseNode.test) {
          entry.conditions.push(this.transformNode(caseNode.test));
        } else {
          entry.isElse = true;
        }

        // Transform consequent statements
        const block = new KotlinBlock();
        for (const stmt of caseNode.consequent || []) {
          if (stmt.type !== 'BreakStatement') {
            const transformed = this.transformNode(stmt);
            if (transformed) {
              block.statements.push(transformed);
            }
          }
        }
        entry.body = block;
        when.entries.push(entry);
      }

      return when;
    }

    transformForStatement(node) {
      // Try to convert to Kotlin range-based for loop
      if (this.isSimpleForLoop(node)) {
        return this.transformToRangeLoop(node);
      }

      // Fall back to while loop
      const block = new KotlinBlock();

      if (node.init) {
        const init = this.transformNode(node.init);
        if (init) block.statements.push(init);
      }

      const whileLoop = new KotlinWhile(
        this.transformNode(node.test),
        this.transformNode(node.body)
      );

      if (node.update && whileLoop.body.nodeType === 'Block') {
        whileLoop.body.statements.push(new KotlinExpressionStatement(
          this.transformNode(node.update)
        ));
      }

      if (node.init) {
        block.statements.push(whileLoop);
        return block;
      }

      return whileLoop;
    }

    transformWhileStatement(node) {
      return new KotlinWhile(
        this.transformNode(node.test),
        this.transformNode(node.body)
      );
    }

    transformDoWhileStatement(node) {
      return new KotlinDoWhile(
        this.transformNode(node.body),
        this.transformNode(node.test)
      );
    }

    /**
     * Transform for-of statement: for (const x of array) { ... }
     * Kotlin equivalent: for (x in array) { ... }
     */
    transformForOfStatement(node) {
      // Extract variable name from left side
      let varName = 'item';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = decl.id.name;
        }
      } else if (node.left.type === 'Identifier') {
        varName = node.left.name;
      }

      // Transform the iterable
      const iterable = this.transformExpression(node.right);

      // Transform the body
      const body = this.transformStatement(node.body);

      return new KotlinFor(varName, iterable, body);
    }

    /**
     * Transform for-in statement: for (const key in object) { ... }
     * Kotlin equivalent: for (key in object.keys) { ... }
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
      // Access .keys property
      const iterable = new KotlinMemberAccess(object, 'keys');

      // Transform the body
      const body = this.transformStatement(node.body);

      return new KotlinFor(varName, iterable, body);
    }

    /**
     * Transform template literal: `Hello ${name}!` -> "Hello $name!"
     * Kotlin uses string templates with $ prefix
     */
    transformTemplateLiteral(node) {
      let templateStr = '';

      for (let i = 0; i < node.quasis.length; ++i) {
        // Escape $ in the raw text
        templateStr += node.quasis[i].value.raw.replace(/\$/g, '\\$');
        if (i < node.expressions.length) {
          // Insert interpolation placeholder
          const expr = this.transformExpression(node.expressions[i]);
          if (expr.nodeType === 'Identifier') {
            templateStr += `\$${expr.name}`;
          } else {
            // Complex expressions need braces
            templateStr += `\${${this.emitExpressionInline(expr)}}`;
          }
        }
      }

      return new KotlinStringTemplate(templateStr);
    }

    /**
     * Helper to emit a Kotlin expression inline for string templates
     */
    emitExpressionInline(expr) {
      if (!expr) return '';
      if (expr.nodeType === 'Identifier') return expr.name;
      if (expr.nodeType === 'Literal') {
        if (typeof expr.value === 'string') return `"${expr.value}"`;
        return String(expr.value);
      }
      if (expr.nodeType === 'MemberAccess') {
        return `${this.emitExpressionInline(expr.expression)}.${expr.memberName}`;
      }
      if (expr.nodeType === 'FunctionCall') {
        const obj = this.emitExpressionInline(expr.expression);
        const args = expr.arguments.map(a => this.emitExpressionInline(a)).join(', ');
        return `${obj}.${expr.functionName}(${args})`;
      }
      return `/* expr */`;
    }

    transformBreakStatement(node) {
      return new KotlinBreak();
    }

    transformContinueStatement(node) {
      return new KotlinContinue();
    }

    transformThrowStatement(node) {
      return new KotlinThrow(this.transformNode(node.argument));
    }

    transformTryStatement(node) {
      const tryCatch = new KotlinTryCatch();
      tryCatch.tryBlock = this.transformNode(node.block);

      if (node.handler) {
        const param = new KotlinParameter(
          node.handler.param ? node.handler.param.name : 'e',
          new KotlinType('Exception')
        );
        tryCatch.catchClauses.push(new KotlinCatchClause(
          param,
          this.transformNode(node.handler.body)
        ));
      }

      if (node.finalizer) {
        tryCatch.finallyBlock = this.transformNode(node.finalizer);
      }

      return tryCatch;
    }

    // ========================[ EXPRESSIONS ]========================

    transformLiteral(node) {
      if (node.value === null) return KotlinLiteral.Null();
      // Handle undefined - treat same as null in Kotlin
      if (node.value === undefined) return KotlinLiteral.Null();
      if (typeof node.value === 'boolean') return KotlinLiteral.Boolean(node.value);
      if (typeof node.value === 'string') return KotlinLiteral.String(node.value);
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          // Determine if unsigned based on value
          if (node.value >= 0 && node.value <= 0xFFFFFFFF) {
            return KotlinLiteral.UInt(node.value);
          }
          return KotlinLiteral.Long(node.value);
        }
        return KotlinLiteral.Double(node.value);
      }
      return KotlinLiteral.Null();
    }

    transformIdentifier(node) {
      return new KotlinIdentifier(this.toCamelCase(node.name));
    }

    transformBinaryExpression(node) {
      let operator = node.operator;
      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // Map JavaScript operators to Kotlin
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';

      // Handle JavaScript >>> 0 idiom (convert to UInt)
      if (operator === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
        // x >>> 0 in Kotlin: x.toUInt()
        return new KotlinFunctionCall(
          new KotlinMemberAccess(left, 'toUInt'),
          []
        );
      }

      // Map bitwise operators to Kotlin infix functions
      const bitwiseMap = {
        '&': 'and',
        '|': 'or',
        '^': 'xor',
        '<<': 'shl',
        '>>': 'shr',
        '>>>': 'ushr'
      };

      if (bitwiseMap[operator]) {
        operator = bitwiseMap[operator];
      }

      return new KotlinBinaryExpression(left, operator, right);
    }

    transformLogicalExpression(node) {
      const operator = this.mapLogicalOperator(node.operator);
      return new KotlinBinaryExpression(
        this.transformNode(node.left),
        operator,
        this.transformNode(node.right)
      );
    }

    transformUnaryExpression(node) {
      const operator = this.mapUnaryOperator(node.operator);
      return new KotlinUnaryExpression(
        operator,
        this.transformNode(node.argument),
        node.prefix
      );
    }

    transformUpdateExpression(node) {
      return new KotlinUnaryExpression(
        node.operator,
        this.transformNode(node.argument),
        node.prefix
      );
    }

    transformAssignmentExpression(node) {
      // Kotlin doesn't have compound assignment in expressions
      // Convert a += b to a = a + b if needed
      if (node.operator !== '=') {
        const binaryOp = node.operator.slice(0, -1);
        const mapped = this.mapBinaryOperator(binaryOp);
        return new KotlinAssignment(
          this.transformNode(node.left),
          new KotlinBinaryExpression(
            this.transformNode(node.left),
            mapped,
            this.transformNode(node.right)
          )
        );
      }

      return new KotlinAssignment(
        this.transformNode(node.left),
        this.transformNode(node.right)
      );
    }

    transformMemberExpression(node) {
      if (!node.property) {
        // Fallback for IL nodes without a property field
        return this.transformNode(node.object) || new KotlinIdentifier('/* missing property */');
      }
      let member = node.property.name || node.property.value;

      if (node.computed) {
        return new KotlinElementAccess(
          this.transformNode(node.object),
          this.transformNode(node.property)
        );
      }

      // Handle special properties
      if (member === 'length')
        return new KotlinMemberAccess(this.transformNode(node.object), 'size');

      // Remove leading underscore for this._ field accesses (Kotlin convention)
      if (node.object.type === 'ThisExpression' && member.startsWith('_'))
        member = member.substring(1);

      return new KotlinMemberAccess(
        this.transformNode(node.object),
        this.toCamelCase(member)
      );
    }

    transformCallExpression(node) {
      // Check for OpCodes method calls
      if (this.isOpCodesCall(node))
        return this.transformOpCodesCall(node);

      const args = (node.arguments || []).map(arg => this.transformNode(arg));

      if (node.callee.type === 'MemberExpression') {
        const obj = this.transformNode(node.callee.object);
        const method = (node.callee.property && (node.callee.property.name || node.callee.property.value)) || '';

        // Handle Object methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
          // Object.freeze(x) -> x (Kotlin uses val for immutability)
          if (method === 'freeze' && args.length === 1)
            return args[0];
          // Object.keys(obj) -> obj.keys.toList()
          if (method === 'keys' && args.length === 1)
            return new KotlinFunctionCall(new KotlinMemberAccess(new KotlinMemberAccess(args[0], 'keys'), 'toList'), []);
          // Object.values(obj) -> obj.values.toList()
          if (method === 'values' && args.length === 1)
            return new KotlinFunctionCall(new KotlinMemberAccess(new KotlinMemberAccess(args[0], 'values'), 'toList'), []);
          // Object.entries(obj) -> obj.entries.toList()
          if (method === 'entries' && args.length === 1)
            return new KotlinFunctionCall(new KotlinMemberAccess(new KotlinMemberAccess(args[0], 'entries'), 'toList'), []);
          // Object.assign(target, source) -> target.also { it.putAll(source) }
          if (method === 'assign' && args.length >= 2)
            return new KotlinFunctionCall(new KotlinMemberAccess(args[0], 'plus'), [args[1]]);
        }

        // Handle array method mappings
        let kotlinMethod = this.toCamelCase(method);
        if (method === 'push')
          kotlinMethod = 'add';
        else if (method === 'pop')
          kotlinMethod = 'removeAt';
        else if (method === 'shift')
          kotlinMethod = 'removeFirst';
        else if (method === 'unshift')
          kotlinMethod = 'add'; // add at index 0

        return new KotlinFunctionCall(
          new KotlinMemberAccess(obj, kotlinMethod),
          args
        );
      }

      return new KotlinFunctionCall(
        this.transformNode(node.callee),
        args
      );
    }

    transformNewExpression(node) {
      const calleeName = node.callee.name || 'Unknown';

      // Map JavaScript array constructors to Kotlin
      if (calleeName === 'Array') {
        const args = (node.arguments || []).map(arg => this.transformNode(arg));
        if (args.length === 1) {
          // new Array(n) -> Array<UInt>(n) { 0u }
          return new KotlinFunctionCall(
            new KotlinIdentifier('Array'),
            [args[0], new KotlinLambda([], KotlinLiteral.UInt(0))]
          );
        }
        return new KotlinArrayCreation('arrayOf', args);
      }

      // Typed arrays
      const arrayMap = {
        'Uint8Array': 'ubyteArrayOf',
        'Uint16Array': 'ushortArrayOf',
        'Uint32Array': 'uintArrayOf',
        'Int8Array': 'byteArrayOf',
        'Int16Array': 'shortArrayOf',
        'Int32Array': 'intArrayOf',
        'Float32Array': 'floatArrayOf',
        'Float64Array': 'doubleArrayOf'
      };

      if (arrayMap[calleeName]) {
        // Check if first argument is an array literal: new Uint8Array([1, 2, 3])
        const hasArrayInit = node.arguments &&
                             node.arguments.length === 1 &&
                             node.arguments[0].type === 'ArrayExpression';

        if (hasArrayInit) {
          // Transform array literal elements directly for typed array initialization
          const elements = node.arguments[0].elements.map(e => this.transformNode(e));
          return new KotlinArrayCreation(arrayMap[calleeName], elements);
        }

        const args = (node.arguments || []).map(arg => this.transformNode(arg));
        if (args.length === 1 && args[0].nodeType === 'Literal') {
          // Size-based constructor: new Uint8Array(10) -> UByteArray(10)
          const size = args[0].value;
          return new KotlinFunctionCall(
            new KotlinIdentifier(arrayMap[calleeName].replace('ArrayOf', 'Array')),
            [KotlinLiteral.Int(size)]
          );
        }
        return new KotlinArrayCreation(arrayMap[calleeName], args);
      }

      const args = (node.arguments || []).map(arg => this.transformNode(arg));
      return new KotlinObjectCreation(
        new KotlinType(this.toPascalCase(calleeName)),
        args
      );
    }

    transformArrayExpression(node) {
      const elements = (node.elements || []).map(el => this.transformNode(el));
      // Use mutableListOf for JavaScript arrays (dynamic size)
      return new KotlinArrayCreation('mutableListOf', elements);
    }

    transformConditionalExpression(node) {
      // Kotlin: if (condition) trueExpr else falseExpr
      return new KotlinIf(
        this.transformNode(node.test),
        this.transformNode(node.consequent),
        this.transformNode(node.alternate)
      );
    }

    transformThisExpression(node) {
      return new KotlinThis();
    }

    transformSuper(node) {
      return new KotlinSuper();
    }

    transformSpreadElement(node) {
      // Kotlin: *array (spread operator)
      const arg = this.transformNode(node.argument);
      // Return as-is; Kotlin spread is applied at call site with *
      return arg;
    }

    transformArrowFunctionExpression(node) {
      return this.transformFunctionExpression(node);
    }

    // ========================[ HELPER METHODS ]========================

    isOpCodesCall(node) {
      return node.callee &&
             node.callee.type === 'MemberExpression' &&
             node.callee.object &&
             node.callee.object.type === 'Identifier' &&
             node.callee.object.name === 'OpCodes';
    }

    transformOpCodesCall(node) {
      if (!node.callee || !node.callee.property) {
        // Fallback for IL OpCodesCall nodes that use .method instead of .callee
        const method = node.method || node.methodName || '';
        const args = (node.arguments || []).map(arg => this.transformExpression(arg));
        return new KotlinFunctionCall(new KotlinIdentifier(method), args);
      }
      const method = node.callee.property.name || node.callee.property.value;
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));

      // Map OpCodes methods to Kotlin equivalents
      const methodMap = {
        // Rotation operations - Kotlin has rotateLeft/rotateRight as extension functions
        'RotL8': 'rotateLeft',
        'RotR8': 'rotateRight',
        'RotL16': 'rotateLeft',
        'RotR16': 'rotateRight',
        'RotL32': 'rotateLeft',
        'RotR32': 'rotateRight',
        'RotL64': 'rotateLeft',
        'RotR64': 'rotateRight',

        // Byte packing/unpacking - need custom implementations
        'Pack32BE': 'packBE',
        'Pack32LE': 'packLE',
        'Unpack32BE': 'unpackBE',
        'Unpack32LE': 'unpackLE',
        'Pack64BE': 'packBE64',
        'Pack64LE': 'packLE64',
        'Unpack64BE': 'unpackBE64',
        'Unpack64LE': 'unpackLE64',

        // Array operations
        'XorArrays': 'xorArrays',
        'ClearArray': 'fill',  // Kotlin uses fill(0)

        // Conversion utilities
        'Hex8ToBytes': 'hexToBytes',
        'BytesToHex8': 'bytesToHex',
        'AnsiToBytes': 'toByteArray'
      };

      const kotlinMethod = methodMap[method] || this.toCamelCase(method);

      // For rotation operations, generate as extension function: value.rotateLeft(positions)
      if (method.startsWith('Rot') && args.length >= 2) {
        return new KotlinFunctionCall(
          new KotlinMemberAccess(args[0], kotlinMethod),
          [args[1]]
        );
      }

      // For packing operations, generate as top-level function: packBE(b0, b1, b2, b3)
      if (method.includes('Pack') || method.includes('Unpack')) {
        return new KotlinFunctionCall(
          new KotlinIdentifier(kotlinMethod),
          args
        );
      }

      // For array operations
      if (method === 'XorArrays' && args.length === 2) {
        // arr1.xor(arr2) - custom extension
        return new KotlinFunctionCall(
          new KotlinMemberAccess(args[0], kotlinMethod),
          [args[1]]
        );
      }

      if (method === 'ClearArray' && args.length === 1) {
        // arr.fill(0)
        return new KotlinFunctionCall(
          new KotlinMemberAccess(args[0], 'fill'),
          [KotlinLiteral.UInt(0)]
        );
      }

      // Default: top-level function call
      return new KotlinFunctionCall(
        new KotlinIdentifier(kotlinMethod),
        args
      );
    }

    isSimpleForLoop(node) {
      return node.init &&
             node.init.type === 'VariableDeclaration' &&
             node.test &&
             node.test.type === 'BinaryExpression' &&
             node.update &&
             node.update.type === 'UpdateExpression';
    }

    transformToRangeLoop(node) {
      const varName = node.init.declarations[0].id.name;

      // For loop indices, use Int (not UInt) for Kotlin compatibility
      let start;
      const initValue = node.init.declarations[0].init;
      if (initValue && initValue.type === 'Literal' && typeof initValue.value === 'number') {
        start = KotlinLiteral.Int(initValue.value);
      } else if (initValue) {
        start = this.transformNode(initValue);
      } else {
        start = KotlinLiteral.Int(0);
      }

      const end = this.transformNode(node.test.right);
      // For < use 'until' (isInclusive=false), for <= use '..' (isInclusive=true)
      const isInclusive = node.test.operator === '<=';
      const range = new KotlinRange(start, end, isInclusive);

      return new KotlinFor(varName, range, this.transformNode(node.body));
    }

    // ========================[ TYPE INFERENCE ]========================

    inferReturnType(node) {
      // Check typeKnowledge first
      if (this.typeKnowledge && node.typeInfo?.returnType) {
        return this.mapJSTypeToKotlin(node.typeInfo.returnType);
      }

      // Analyze return statements in function body
      if (node.body && node.body.type === 'BlockStatement') {
        const returns = this.findReturnStatements(node.body);
        if (returns.length === 0) {
          return KotlinType.Unit();
        }
        if (returns.length > 0 && returns[0].argument) {
          return this.inferExpressionType(returns[0].argument);
        }
      }
      return KotlinType.Unit();
    }

    /**
     * Infer full expression type using typeKnowledge when available
     */
    inferFullExpressionType(node) {
      if (!node) return KotlinType.Any();

      // Check typeKnowledge
      if (this.typeKnowledge && node.inferredType) {
        return this.mapJSTypeToKotlin(node.inferredType);
      }

      return this.inferExpressionType(node);
    }

    findReturnStatements(node, results = []) {
      if (node.type === 'ReturnStatement') {
        results.push(node);
      }
      for (const key in node) {
        const child = node[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach(c => this.findReturnStatements(c, results));
          } else if (child.type) {
            this.findReturnStatements(child, results);
          }
        }
      }
      return results;
    }

    inferParameterType(name, param) {
      // Use type knowledge if available
      if (this.typeKnowledge && param.inferredType) {
        return this.mapJSTypeToKotlin(param.inferredType);
      }

      // Infer from name patterns
      return this.inferTypeFromName(name);
    }

    inferVariableType(name, init) {
      if (init) {
        return this.inferExpressionType(init);
      }
      return this.inferTypeFromName(name);
    }

    inferPropertyType(node) {
      if (node.value) {
        return this.inferExpressionType(node.value);
      }
      return this.inferTypeFromName(node.key.name);
    }

    inferExpressionType(node) {
      if (!node) return KotlinType.Any();

      switch (node.type) {
        case 'Literal':
          if (node.value === null) return KotlinType.Any();
          if (typeof node.value === 'boolean') return KotlinType.Boolean();
          if (typeof node.value === 'string') return KotlinType.String();
          if (typeof node.value === 'number') {
            return Number.isInteger(node.value) ? KotlinType.UInt() : KotlinType.Double();
          }
          break;

        case 'ArrayExpression':
          if (node.elements.length > 0) {
            const elemType = this.inferExpressionType(node.elements[0]);
            return KotlinType.Array(elemType);
          }
          return KotlinType.Array(KotlinType.UInt());

        case 'BinaryExpression':
          if (['==', '===', '!=', '!==', '<', '>', '<=', '>='].includes(node.operator)) {
            return KotlinType.Boolean();
          }
          if (['&&', '||'].includes(node.operator)) {
            return KotlinType.Boolean();
          }
          return this.inferExpressionType(node.left);

        case 'CallExpression':
          if (this.isOpCodesCall(node)) {
            return KotlinType.UInt();
          }
          break;
      }

      return KotlinType.Any();
    }

    inferTypeFromName(name) {
      if (!name) return KotlinType.UInt();

      const lower = name.toLowerCase();

      if (lower.includes('key') || lower.includes('data') ||
          lower.includes('input') || lower.includes('output') ||
          lower.includes('block') || lower.includes('buffer')) {
        return KotlinType.UByteArray();
      }

      if (lower.includes('index') || lower.includes('length') ||
          lower.includes('size') || lower.includes('count') ||
          lower === 'i' || lower === 'j') {
        return KotlinType.Int();
      }

      return KotlinType.UInt();
    }

    mapJSTypeToKotlin(jsType) {
      if (typeof jsType === 'string') {
        const mapped = TYPE_MAP[jsType];
        if (mapped) {
          return new KotlinType(mapped);
        }
        if (jsType.endsWith('[]')) {
          const elemType = this.mapJSTypeToKotlin(jsType.slice(0, -2));
          return KotlinType.Array(elemType);
        }
        return new KotlinType(jsType);
      }
      return KotlinType.Any();
    }

    // ========================[ OPERATOR MAPPING ]========================

    mapBinaryOperator(op) {
      const map = {
        '&': 'and',
        '|': 'or',
        '^': 'xor',
        '<<': 'shl',
        '>>': 'shr',
        '>>>': 'ushr',
        '===': '==',
        '!==': '!='
      };
      return map[op] || op;
    }

    mapLogicalOperator(op) {
      const map = {
        '&&': '&&',
        '||': '||'
      };
      return map[op] || op;
    }

    mapUnaryOperator(op) {
      const map = {
        '~': 'inv',
        '!': '!'
      };
      return map[op] || op;
    }

    // ========================[ NAME CONVERSION ]========================

    toCamelCase(name) {
      if (!name) return name;
      // Keep first letter lowercase
      return name.charAt(0).toLowerCase() + name.slice(1);
    }

    toPascalCase(name) {
      if (!name) return name;
      // Keep first letter uppercase
      return name.charAt(0).toUpperCase() + name.slice(1);
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
  const exports = { KotlinTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.KotlinTransformer = KotlinTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
