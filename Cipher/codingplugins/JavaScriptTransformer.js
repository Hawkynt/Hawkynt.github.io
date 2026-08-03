/**
 * JavaScriptTransformer.js - IL AST to JavaScript AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to JavaScript AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → JavaScript AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - targetVersion: ES5, ES2020, etc.
 *
 * Note: JavaScript transformer strips type annotations since JS is dynamically typed.
 */

(function(global) {
  'use strict';

  // Load dependencies
  let JavaScriptAST;
  if (typeof require !== 'undefined') {
    JavaScriptAST = require('./JavaScriptAST.js');
  } else if (global.JavaScriptAST) {
    JavaScriptAST = global.JavaScriptAST;
  }

  const {
    JavaScriptCompilationUnit, JavaScriptImportDeclaration, JavaScriptExportDeclaration,
    JavaScriptClass, JavaScriptProperty, JavaScriptMethod, JavaScriptFunction,
    JavaScriptConstructor, JavaScriptStaticBlock,
    JavaScriptParameter, JavaScriptBlock, JavaScriptVariableDeclaration,
    JavaScriptExpressionStatement, JavaScriptReturn, JavaScriptIf, JavaScriptFor,
    JavaScriptForOf, JavaScriptWhile, JavaScriptDoWhile, JavaScriptSwitch,
    JavaScriptSwitchCase, JavaScriptBreak, JavaScriptContinue, JavaScriptThrow,
    JavaScriptTryCatch, JavaScriptCatchClause, JavaScriptLiteral, JavaScriptIdentifier,
    JavaScriptBinaryExpression, JavaScriptUnaryExpression, JavaScriptAssignment,
    JavaScriptMemberAccess, JavaScriptElementAccess, JavaScriptCall, JavaScriptNew,
    JavaScriptArrayLiteral, JavaScriptObjectLiteral, JavaScriptConditional,
    JavaScriptArrowFunction, JavaScriptThis, JavaScriptSuper, JavaScriptParenthesized,
    JavaScriptTemplateLiteral, JavaScriptYieldExpression, JavaScriptChainExpression,
    JavaScriptSpreadElement, JavaScriptAwaitExpression, JavaScriptDeleteExpression,
    JavaScriptSequenceExpression, JavaScriptJSDoc
  } = JavaScriptAST;

  /**
   * IL AST to JavaScript AST Transformer
   * Strips type annotations and converts to plain JavaScript
   */
  class JavaScriptTransformer {
    constructor(options = {}) {
      this.options = options;
      this.currentClass = null;
      this.currentMethod = null;
      this.scopeStack = [];
    }

    /**
     * Transform IL AST to JavaScript AST
     * @param {Object} ilAst - Intermediate Language AST
     * @returns {JavaScriptCompilationUnit} JavaScript AST
     */
    transform(ilAst) {
      const unit = new JavaScriptCompilationUnit();

      if (ilAst.type === 'Program') {
        for (const node of ilAst.body) {
          // Check for a whole-module IIFE/UMD wrapper and extract its
          // content. type-aware-transpiler.js's unwrapModulePatterns()
          // already unwraps the real module wrapper during IL AST
          // construction (only when it's the file's *sole* top-level
          // statement, mirroring the `ilAst.body.length === 1` guard here)
          // — this is a defense-in-depth fallback for any wrapper it
          // missed. Restricting to a length-1 body prevents this from
          // misfiring on an ordinary *local* top-level IIFE living
          // alongside other statements (e.g. a `(function initTables() {
          // ... })();` side-effecting initializer next to `const`/`class`
          // declarations, common for precomputed lookup tables) — those are
          // executable code in their own right and must go through the
          // normal transformNode()/transformCallExpression() path so their
          // full body (loops, assignments, everything besides bare
          // class/function/variable declarations) survives intact, instead
          // of extractIIFEContent()'s transformTopLevelStatement() silently
          // dropping any statement type it doesn't special-case (e.g. a
          // `for` loop that fills a precomputed table was disappearing
          // entirely, leaving the table all-zero at runtime).
          if (ilAst.body.length === 1 && this.isIIFE(node)) {
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
        unit.statements.push(transformed);
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
      return callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression' || callee.type === 'ArrowFunction';
    }

    /**
     * Extract content from IIFE wrapper
     */
    extractIIFEContent(node) {
      const results = [];
      const callExpr = node.expression;

      // First, try to find the factory function in UMD pattern
      if (callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
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
     * Transform any IL AST node to JavaScript AST
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
        'Cast', 'UnpackBytes', 'PackBytes', 'OpCodesCall', 'MathCall', 'Rotation', 'BitwiseOperation',
        'Floor', 'Ceil', 'Round', 'Abs', 'Min', 'Max', 'RotateLeft', 'RotateRight',
        // Additional IL AST types
        'FieldDefinition', 'ArrayLiteral', 'ArraySort', 'ArrayShift', 'ArraySome', 'ArrayMap',
        'ArrayForEach', 'StringTransform', 'StringCharCodeAt', 'BigIntCast', 'DataViewCreation',
        'Power', 'BufferCreation', 'TypedArraySet', 'TypedArraySubarray', 'ArrayXor', 'MapSet',
        'ArrayFind', 'ArrayFilter', 'ArrayReduce', 'ArrayJoin', 'ArrayPop', 'ArrayUnshift',
        'ArraySplice', 'ArrayEvery', 'StringSplit', 'StringSubstring', 'StringIndexOf', 'StringLength',
        // New IL AST node types from enhanced JS-to-IL transformer
        'DebugOutput', 'TypeOfExpression', 'DeleteExpression', 'StringInterpolation',
        'RestParameter', 'ObjectLiteral', 'ArrowFunction', 'FunctionExpression',
        'AwaitExpression', 'YieldExpression', 'DataViewRead', 'DataViewWrite',
        'IsArrayCheck', 'ObjectMerge', 'ObjectHasProperty', 'ObjectFromEntries',
        'StringFromCharCodes', 'StringFromCodePoints', 'IsIntegerCheck', 'IsNaNCheck', 'IsFiniteCheck',
        'ParseInteger', 'ParseFloat', 'JsonSerialize', 'JsonDeserialize', 'SequenceExpression',
        'Typeof', 'Instanceof', 'MapCreation', 'SetCreation', 'RegExpCreation', 'ObjectKeys', 'ObjectValues', 'ObjectEntries',
        'Log', 'Log2', 'Log10', 'Random', 'Sin', 'Cos', 'Tan', 'Asin', 'Acos', 'Atan', 'Atan2', 'Exp', 'Sign', 'Trunc', 'Sqrt',
        'Sinh', 'Cosh', 'Tanh', 'Cbrt', 'Hypot', 'Fround', 'MathConstant', 'NumberConstant', 'InstanceOfCheck',
        'MapGet', 'MapHas', 'MapDelete', 'StringRepeat', 'StringReplace', 'StringCharAt', 'StringIncludes',
        'StringStartsWith', 'StringEndsWith', 'StringTrim', 'StringPadStart', 'StringPadEnd',
        'StringToLowerCase', 'StringToUpperCase', 'StringSlice', 'StringConcat', 'ArrayFindIndex', 'ArrayLastIndexOf', 'ArrayFrom'];

      if (statementTypes.includes(node.type)) {
        return this.transformStatement(node);
      }

      if (expressionTypes.includes(node.type)) {
        return this.transformExpression(node);
      }

      console.warn(`No transformer for node type: ${node.type}`);
      return null;
    }

    // ========================[ FUNCTION TRANSFORMATION ]========================

    transformFunctionDeclaration(node) {
      const func = new JavaScriptFunction(node.id?.name || node.name || 'anonymous');

      // Handle async and generator flags
      func.isAsync = node.async || node.isAsync || false;
      func.isGenerator = node.generator || node.isGenerator || false;

      // Transform parameters
      if (node.params) {
        for (const param of node.params) {
          func.parameters.push(this.transformParameter(param));
        }
      }

      // Transform body
      if (node.body) {
        func.body = this.transformNode(node.body);
      }

      return func;
    }

    // ========================[ CLASS TRANSFORMATION ]========================

    transformClassDeclaration(node) {
      const jsClass = new JavaScriptClass(node.id.name);
      jsClass.isExported = false;
      this.currentClass = jsClass;

      if (node.superClass) {
        // superClass may be a bare Identifier (class X extends Y) or a member
        // expression (class X extends AlgorithmFramework.Y, as most algorithm
        // sources write it) — transform it generically instead of assuming
        // `.name` exists, which silently produced `extends undefined` for the
        // member-expression form.
        jsClass.baseClass = node.superClass.name
          ? new JavaScriptIdentifier(node.superClass.name)
          : this.transformExpression(node.superClass);
      }

      // Handle both class body structures
      const members = node.body?.body || node.body || [];

      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            const transformed = this.transformMethodDefinition(member);
            if (transformed) {
              jsClass.members.push(transformed);
            }
          } else if (member.type === 'PropertyDefinition') {
            const transformed = this.transformPropertyDefinition(member);
            if (transformed) {
              jsClass.members.push(transformed);
            }
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> JavaScript supports it natively
            const transformed = this.transformStaticBlock(member);
            if (transformed) {
              jsClass.members.push(transformed);
            }
          } else {
            const transformed = this.transformNode(member);
            if (transformed) {
              jsClass.members.push(transformed);
            }
          }
        }
      }

      this.currentClass = null;
      return jsClass;
    }

    /**
     * Transform property definition
     */
    transformPropertyDefinition(node) {
      const name = node.key.name;
      const initializer = node.value ? this.transformExpression(node.value) : null;

      const prop = new JavaScriptProperty(name, initializer);
      prop.isStatic = node.static || false;

      return prop;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> JavaScript supports it natively
      // static { code } -> static { code }
      const staticBlock = new JavaScriptStaticBlock();
      const block = new JavaScriptBlock();

      // parseStaticBlock (type-aware-transpiler.js) sets `node.body` to the
      // return value of parseBlockStatement() — a `{ type: 'BlockStatement',
      // body: [...] }` node, not a bare statements array. Iterating
      // `node.body` directly threw "node.body is not iterable" (a plain
      // object isn't iterable), crashing transpilation of every algorithm
      // with a `static { ... }` block (e.g. aria.js's S-box table setup).
      const statements = Array.isArray(node.body) ? node.body : (node.body?.body || []);
      for (const stmt of statements) {
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
      // ClassExpression -> anonymous class in JavaScript
      const classDecl = new JavaScriptClass(node.id?.name || 'AnonymousClass');

      if (node.superClass)
        // JavaScriptClass stores its superclass in `baseClass` (see
        // JavaScriptAST.js) — assigning to `.extends` here was a no-op that
        // silently dropped the superclass for every class expression.
        classDecl.baseClass = this.transformExpression(node.superClass);

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
      // yield value or yield* iterable - JavaScript supports natively
      const argument = node.argument ? this.transformExpression(node.argument) : null;
      return new JavaScriptYieldExpression(argument, node.delegate || false);
    }

    transformMethodDefinition(node) {
      if (node.kind === 'constructor') {
        return this.transformConstructor(node);
      }

      this.pushScope();

      const method = new JavaScriptMethod(node.key.name);
      method.isStatic = node.static || false;
      // Preserve accessor kind (get/set) so property-style access (this.key = x)
      // keeps invoking the original setter/getter instead of silently shadowing
      // it with a plain data property (two plain 'key' methods would otherwise
      // collide, with only the last one surviving on the prototype).
      method.kind = (node.kind === 'get' || node.kind === 'set') ? node.kind : 'method';

      // Transform parameters (strip type annotations). Delegate to
      // transformParameter() rather than building a bare
      // `new JavaScriptParameter(param.name)` here: regular methods take
      // default-valued parameters just as often as constructors do (e.g.
      // `CreateInstance(isInverse = false)`), and the several IL shapes a
      // default-valued parameter can arrive in (DefaultParameter,
      // AssignmentExpression, or a plain Identifier carrying its own
      // `defaultValue`) all need the same unwrapping constructors already get.
      if (node.value.params) {
        for (const param of node.value.params) {
          method.parameters.push(this.transformParameter(param));
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
     * Transform function body to JavaScript block
     */
    transformFunctionBody(bodyNode) {
      const block = new JavaScriptBlock();

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
        block.statements.push(new JavaScriptReturn(expr));
      }

      return block;
    }

    transformConstructor(node) {
      const constructor = new JavaScriptConstructor();

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
      // IL AST: DefaultParameter (see type-aware-transpiler.js _transformFunctionExpression
      // 'AssignmentPattern' branch) carries the parameter name under `name`
      // and the default under `defaultValue` — reading only `node.name`
      // (still correct here) but never consuming `defaultValue` silently
      // dropped every `function foo(x = 5)` default value, emitting `foo(x)`.
      if (node.type === 'DefaultParameter') {
        const param = new JavaScriptParameter(node.name || node.left?.name || 'param');
        if (node.defaultValue) param.defaultValue = this.transformExpression(node.defaultValue);
        return param;
      }
      // A default-valued *arrow function* parameter (e.g. `(node, code = 0,
      // length = 0) => ...`) arrives shaped as a plain AssignmentExpression
      // (left = the parameter Identifier, right = the default value) rather
      // than the 'DefaultParameter' wrapper above — a different IL path
      // (TypeAwareJSASTParser's arrow-function param handling) produces this
      // shape. Falling through to the generic branch below read no `.name`
      // off an AssignmentExpression, silently naming *every* such parameter
      // the literal string "param" — one for `code = 0`, another for
      // `length = 0` — a duplicate-parameter-name SyntaxError.
      if (node.type === 'AssignmentExpression' && node.left) {
        const param = new JavaScriptParameter(node.left.name || 'param');
        if (node.right) param.defaultValue = this.transformExpression(node.right);
        return param;
      }
      const name = node.name || (node.type === 'Identifier' ? node.name : 'param');
      const param = new JavaScriptParameter(name);
      // A THIRD default-valued-parameter shape: a plain Identifier node that
      // carries its own `defaultValue` property directly (rather than being
      // wrapped in 'DefaultParameter' or 'AssignmentExpression' as above) —
      // seen for class constructor/method parameters, e.g.
      // `constructor(char, frequency, left = null, right = null)`. Silently
      // falling through to a bare `new JavaScriptParameter(name)` here
      // dropped the `= null` default, so calling `new HuffmanNode(c, f)`
      // with only 2 args left `left`/`right` as `undefined` instead of
      // `null` — breaking any `=== null` check downstream (e.g. `isLeaf()`
      // testing `this.left === null`, which is false for `undefined`,
      // turning genuine leaf nodes into "not a leaf" and recursing into
      // `undefined.isLeaf()`).
      if (node.defaultValue) param.defaultValue = this.transformExpression(node.defaultValue);
      return param;
    }

    /**
     * Push scope for nested functions
     */
    pushScope() {
      this.scopeStack.push({});
    }

    /**
     * Pop scope
     */
    popScope() {
      if (this.scopeStack.length > 0) {
        this.scopeStack.pop();
      }
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
      const block = new JavaScriptBlock();
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
        // Skip ObjectPattern destructuring
        if (decl.id.type === 'ObjectPattern')
          continue;

        // Skip single-name aliases of a framework export, e.g.
        // `var RegisterAlgorithm = AlgorithmFramework.RegisterAlgorithm;`
        // (an alternative some sources use instead of destructuring). The
        // standalone prelude (see JavaScriptPlugin._buildStandalonePrelude)
        // already declares a top-level `const RegisterAlgorithm = ...` for
        // every AlgorithmFramework export, so re-declaring it here would be a
        // SyntaxError (Identifier already declared) — same reasoning as the
        // ObjectPattern skip above. Not extended to OpCodes: the prelude only
        // fully-qualifies OpCodes calls (OpCodes.Method(...)), it never
        // destructures bare OpCodes member names, so an `OpCodes.X` alias is
        // the only place a bare `X` binding would come from — dropping it
        // would leave any bare `X(...)` call in the source undefined.
        if (decl.id.type === 'Identifier' && decl.init?.type === 'MemberExpression' &&
            !decl.init.computed && decl.init.object?.type === 'Identifier' &&
            decl.init.object.name === 'AlgorithmFramework' &&
            decl.init.property?.name === decl.id.name)
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        // JavaScript natively supports this, but we'll expand it for consistency
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = elem.name;
              const indexExpr = new JavaScriptMemberExpression(sourceExpr, JavaScriptLiteral.Number(i), true);
              const varDecl = new JavaScriptVariableDeclaration(varName, indexExpr);
              varDecl.kind = node.kind || 'const';
              declarations.push(varDecl);
            }
          }
          continue;
        }

        const name = decl.id.name;
        const initializer = decl.init ? this.transformExpression(decl.init) : null;

        const varDecl = new JavaScriptVariableDeclaration(name, initializer);
        varDecl.kind = node.kind || 'const';
        declarations.push(varDecl);
      }
      return declarations.length === 1 ? declarations[0] : declarations;
    }

    transformExpressionStatement(node) {
      const expr = this.transformNode(node.expression);
      return expr ? new JavaScriptExpressionStatement(expr) : null;
    }

    transformReturnStatement(node) {
      const expr = node.argument ? this.transformNode(node.argument) : null;
      return new JavaScriptReturn(expr);
    }

    transformIfStatement(node) {
      const condition = this.transformNode(node.test);
      const thenBranch = this.transformNode(node.consequent);
      const elseBranch = node.alternate ? this.transformNode(node.alternate) : null;
      return new JavaScriptIf(condition, thenBranch, elseBranch);
    }

    transformForStatement(node) {
      const forStmt = new JavaScriptFor();
      forStmt.initializer = node.init ? this.transformNode(node.init) : null;
      forStmt.condition = node.test ? this.transformNode(node.test) : null;
      forStmt.incrementor = node.update ? this.transformNode(node.update) : null;
      forStmt.body = node.body ? this.transformNode(node.body) : new JavaScriptBlock();
      return forStmt;
    }

    transformForOfStatement(node) {
      const declarations = node.left.declarations || [];
      const collection = this.transformNode(node.right);
      const rawBody = this.transformNode(node.body);
      const bodyBlock = (rawBody && rawBody.nodeType === 'Block') ? rawBody : (() => {
        const b = new JavaScriptBlock();
        if (rawBody) b.statements.push(rawBody);
        return b;
      })();

      // Destructuring loop variable: for (const [a, b] of x) / for (const {a, b} of x).
      // The IL layer already expands the ArrayPattern/ObjectPattern id into
      // multiple flat declarators — declarations[0] is a synthesized temp
      // binding (e.g. "_destructure_0") that holds the actual loop item, and
      // declarations[1..] are `a`/`b`/... each initialized by indexing/reading
      // a property off that temp binding. Using only declarations[0] as the
      // loop variable (as before) silently dropped every destructured binding:
      // any reference to `a`/`b` inside the loop threw ReferenceError.
      const varName = declarations[0] ? declarations[0].id.name : 'item';
      if (declarations.length > 1) {
        const extraDecls = declarations.slice(1).map(decl => {
          const initializer = decl.init ? this.transformExpression(decl.init) : null;
          const varDecl = new JavaScriptVariableDeclaration(decl.id.name, initializer);
          varDecl.kind = 'const';
          return varDecl;
        });
        bodyBlock.statements = [...extraDecls, ...bodyBlock.statements];
      }

      const forOf = new JavaScriptForOf(varName, collection, bodyBlock);
      // 'ForInStatement' and 'ForOfStatement' share this same transform
      // (see the switch above) but are NOT interchangeable at emission time
      // — see JavaScriptForOf.isForIn.
      forOf.isForIn = node.type === 'ForInStatement';
      return forOf;
    }

    transformWhileStatement(node) {
      const condition = this.transformNode(node.test);
      const body = this.transformNode(node.body);
      return new JavaScriptWhile(condition, body);
    }

    transformDoWhileStatement(node) {
      const body = this.transformNode(node.body);
      const condition = this.transformNode(node.test);
      return new JavaScriptDoWhile(body, condition);
    }

    transformSwitchStatement(node) {
      const switchStmt = new JavaScriptSwitch(this.transformNode(node.discriminant));
      for (const caseNode of node.cases) {
        switchStmt.cases.push(this.transformNode(caseNode));
      }
      return switchStmt;
    }

    transformSwitchCase(node) {
      const label = node.test ? this.transformNode(node.test) : null;
      const caseStmt = new JavaScriptSwitchCase(label);
      for (const stmt of node.consequent) {
        const transformed = this.transformNode(stmt);
        if (transformed) {
          caseStmt.statements.push(transformed);
        }
      }
      return caseStmt;
    }

    transformBreakStatement(node) {
      return new JavaScriptBreak();
    }

    transformContinueStatement(node) {
      return new JavaScriptContinue();
    }

    transformThrowStatement(node) {
      return new JavaScriptThrow(this.transformNode(node.argument));
    }

    transformTryStatement(node) {
      const tryCatch = new JavaScriptTryCatch();
      tryCatch.tryBlock = this.transformNode(node.block);

      if (node.handler) {
        const catchClause = new JavaScriptCatchClause(
          node.handler.param ? node.handler.param.name : 'error',
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
          return this.transformArrowFunctionExpression(node);

        case 'FunctionExpression':
          // A real `function(...) {...}` expression (as opposed to an arrow
          // function) binds its own `this`/`arguments` — keep that distinct
          // from ArrowFunctionExpression so the emitter can preserve
          // `function` syntax instead of silently rebinding `this` to the
          // enclosing scope (see JavaScriptAST's isFunctionExpression flag).
          return this.transformArrowFunctionExpression(node, true);

        case 'ThisExpression':
          return this.transformThisExpression(node);

        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        case 'SequenceExpression':
          return this.transformSequenceExpression(node);

        case 'SpreadElement': {
          // Preserve spread element in JavaScript
          const spreadArg = this.transformExpression(node.argument);
          return new JavaScriptSpreadElement(spreadArg);
        }

        case 'Super':
          return new JavaScriptSuper();

        case 'ObjectPattern':
          // Object destructuring - keep as-is in JavaScript
          // This is a valid JavaScript pattern
          return new JavaScriptIdentifier('/* Object destructuring pattern */');

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - JavaScript supports this natively
          const chainedExpr = this.transformExpression(node.expression);
          return new JavaScriptChainExpression(chainedExpr);

        case 'ClassExpression':
          // Anonymous class expression - JavaScript supports this natively
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - JavaScript has generators
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field - JavaScript supports private fields natively
          return new JavaScriptIdentifier('#' + node.name);

        // ========================[ IL AST NODE TYPES ]========================
        // These are language-agnostic intermediate nodes from the type-aware transpiler

        case 'ThisPropertyAccess': {
          // IL AST: this.property → JavaScript: this.property
          const target = new JavaScriptThis();
          return new JavaScriptMemberAccess(target, node.property);
        }

        case 'ThisMethodCall': {
          // IL AST: this.method(...) → JavaScript: this.method(...)
          const target = new JavaScriptThis();
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          return new JavaScriptCall(target, node.method, args);
        }

        case 'ParentMethodCall': {
          // IL AST: super.method(...) → JavaScript: super.method(...)
          const target = new JavaScriptSuper();
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          return new JavaScriptCall(target, node.method, args);
        }

        case 'ParentConstructorCall': {
          // IL AST: super(...) → JavaScript: super(...)
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          // Create a call to super() - use empty method name for constructor call
          const superCall = new JavaScriptCall(null, 'super', args);
          return superCall;
        }

        case 'ErrorCreation': {
          // IL AST: new Error(message) → JavaScript: new Error(message)
          const errorType = node.errorType || 'Error';
          const message = node.message ? this.transformExpression(node.message) : JavaScriptLiteral.String('');
          return new JavaScriptNew(errorType, [message]);
        }

        case 'StringToBytes': {
          // IL AST: string to bytes → JavaScript: Array.from(new TextEncoder().encode(string))
          // TextEncoder.encode() returns a Uint8Array, not a plain Array — the
          // real AlgorithmFramework.RegisterAlgorithm validates test vector
          // `input`/`expected` with Array.isArray(), which is false for typed
          // arrays, so every string-literal test vector byte array failed
          // registration ("has invalid input (must be byte array or null)")
          // without the Array.from(...) wrapper.
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          const encoder = new JavaScriptNew('TextEncoder', []);
          const encodeCall = new JavaScriptCall(encoder, 'encode', [value]);
          return new JavaScriptCall(new JavaScriptIdentifier('Array'), 'from', [encodeCall]);
        }

        case 'BytesToString': {
          // IL AST: bytes to string → JavaScript: new TextDecoder().decode(new Uint8Array(bytes))
          // `bytes` here is a plain JS Array (this codebase's byte-array
          // convention throughout, see StringToBytes's Array.from(...) wrap
          // above) — TextDecoder.decode() requires an ArrayBuffer/
          // ArrayBufferView and throws "The "list" argument must be an
          // instance of SharedArrayBuffer, ArrayBuffer or ArrayBufferView"
          // when handed a plain array, so every OpCodes.BytesToAnsi/
          // BytesToAscii/BytesToUtf8 call crashed at runtime without this wrap.
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          const decoder = new JavaScriptNew('TextDecoder', []);
          const bytesArg = new JavaScriptNew('Uint8Array', [value]);
          return new JavaScriptCall(decoder, 'decode', [bytesArg]);
        }

        case 'HexDecode': {
          // IL AST: hex string to bytes → JavaScript: OpCodes.Hex8ToBytes(...)
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('OpCodes'), 'Hex8ToBytes', [value]);
        }

        case 'HexEncode': {
          // IL AST: bytes to hex string → JavaScript: OpCodes.BytesToHex(...)
          // (a small polyfill the standalone prelude attaches onto the embedded
          // OpCodes object, since OpCodes.js itself has no bytes->hex method)
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('OpCodes'), 'BytesToHex', [value]);
        }

        case 'ArrayCreation': {
          // IL AST: new Array(size) → JavaScript: new Array(size)
          const size = node.size ? this.transformExpression(node.size) : null;
          if (size) {
            return new JavaScriptNew('Array', [size]);
          }
          return new JavaScriptArrayLiteral([]);
        }

        case 'TypedArrayCreation': {
          // IL AST: new Uint8Array(size) → JavaScript: new Uint8Array(size)
          const size = node.size ? this.transformExpression(node.size) : JavaScriptLiteral.Number(0);
          const arrayType = node.arrayType || 'Uint8Array';
          return new JavaScriptNew(arrayType, [size]);
        }

        case 'ArrayLength': {
          // IL AST: array.length → JavaScript: array.length
          const array = this.transformExpression(node.array);
          return new JavaScriptMemberAccess(array, 'length');
        }

        case 'ArrayIndexOf': {
          // IL AST: array.indexOf(value) → JavaScript: array.indexOf(value)
          const array = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new JavaScriptCall(array, 'indexOf', [value]);
        }

        case 'ArrayIncludes': {
          // IL AST: array.includes(value) → JavaScript: array.includes(value)
          const array = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new JavaScriptCall(array, 'includes', [value]);
        }

        case 'ArraySlice': {
          // IL AST: array.slice(start, end) → JavaScript: array.slice(start, end)
          const array = this.transformExpression(node.array);
          const args = [];
          if (node.start) args.push(this.transformExpression(node.start));
          if (node.end) args.push(this.transformExpression(node.end));
          return new JavaScriptCall(array, 'slice', args);
        }

        case 'ArrayConcat': {
          // IL AST: array.concat(...arrays) → JavaScript: array.concat(...arrays)
          // The IL node carries every concat argument in `arrays` — there is no
          // `other` field. Reading `node.other` always produced `undefined`,
          // which the emitter rendered as a no-argument `.concat()` call
          // (silently dropping the array(s) being concatenated).
          const array = this.transformExpression(node.array);
          const others = Array.isArray(node.arrays) ? node.arrays.map(a => this.transformExpression(a)) : [];
          return new JavaScriptCall(array, 'concat', others);
        }

        case 'ArrayAppend': {
          // IL AST: array.push(...values) → JavaScript: array.push(...values)
          // The IL node carries every pushed argument in `values` (`value` is
          // just `values[0]`, kept for other consumers) — using only `value`
          // silently dropped every argument past the first for calls like
          // `output.push(...bytes0, ...bytes1)`.
          const array = this.transformExpression(node.array);
          const values = Array.isArray(node.values) && node.values.length > 0
            ? node.values.map(v => this.transformExpression(v))
            : [this.transformExpression(node.value)];
          return new JavaScriptCall(array, 'push', values);
        }

        case 'ArrayReverse': {
          // IL AST: array.reverse() → JavaScript: array.reverse()
          const array = this.transformExpression(node.array);
          return new JavaScriptCall(array, 'reverse', []);
        }

        case 'ArrayFill': {
          // IL AST: array.fill(value, start, end) → JavaScript: array.fill(value, start, end)
          const array = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          const args = [value];
          if (node.start !== undefined && node.start !== null) args.push(this.transformExpression(node.start));
          if (node.end !== undefined && node.end !== null) args.push(this.transformExpression(node.end));
          return new JavaScriptCall(array, 'fill', args);
        }

        case 'ArrayClear': {
          // IL AST: clear array (OpCodes.ClearArray semantics: zero-fill in
          // place, length unchanged) → JavaScript: OpCodes.ClearArray(array).
          // array.splice(0) is NOT equivalent — it truncates the array to
          // length 0 instead of zeroing its contents, and typed arrays
          // (Uint8Array/Uint32Array/...), which this codebase uses heavily for
          // key/state buffers, have no splice method at all.
          const array = this.transformExpression(node.array || node.arguments?.[0]);
          return new JavaScriptCall(new JavaScriptIdentifier('OpCodes'), 'ClearArray', [array]);
        }

        // Type casting - JavaScript doesn't need explicit casts but uses bitwise ops for numeric coercion
        case 'Cast': {
          const value = this.transformExpression(node.arguments?.[0] || node.expression || node.value);
          const targetType = node.targetType || node.toType || 'number';

          // For numeric types, use JavaScript runtime coercion or bitwise ops
          switch (targetType) {
            case 'uint8':
            case 'byte':
              // value & 0xFF
              return new JavaScriptBinaryExpression(value, '&', JavaScriptLiteral.Number(0xFF));
            case 'uint16':
              // value & 0xFFFF
              return new JavaScriptBinaryExpression(value, '&', JavaScriptLiteral.Number(0xFFFF));
            case 'uint32':
              // value >>> 0
              return new JavaScriptBinaryExpression(value, '>>>', JavaScriptLiteral.Number(0));
            case 'int32':
            case 'int':
              // value | 0
              return new JavaScriptBinaryExpression(value, '|', JavaScriptLiteral.Number(0));
            case 'uint64':
              // OpCodes.ToQWord(x) operates on BigInt state (64-bit PRNGs/hashes)
              // — value & 0xFFFFFFFFFFFFFFFFn truncates to 64 bits. Falling
              // through to the "just return value" default silently dropped
              // this truncation, letting BigInt state grow unbounded and
              // diverge from the reference implementation after the first
              // overflow (xoshiro/xoroshiro/splitmix64-family PRNGs).
              return new JavaScriptBinaryExpression(value, '&', JavaScriptLiteral.BigInt(0xFFFFFFFFFFFFFFFFn));
            case 'int8':
              // sign-extend from 8 bits: (value << 24) >> 24
              return new JavaScriptBinaryExpression(
                new JavaScriptBinaryExpression(value, '<<', JavaScriptLiteral.Number(24)),
                '>>', JavaScriptLiteral.Number(24));
            case 'int16':
              // sign-extend from 16 bits: (value << 16) >> 16
              return new JavaScriptBinaryExpression(
                new JavaScriptBinaryExpression(value, '<<', JavaScriptLiteral.Number(16)),
                '>>', JavaScriptLiteral.Number(16));
            default:
              // JavaScript is dynamically typed - just return the value
              return value;
          }
        }

        // Unpack bytes - convert integer to byte array
        case 'UnpackBytes': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          const bits = node.bits || 32;
          const isBigEndian = node.endian === 'big' || node.bigEndian;

          // Fully qualify against the embedded OpCodes object (OpCodes.UnpackNNBE/LE)
          // rather than a bare short name — bare top-level const/function names
          // like `unpack32BE` collide with algorithm source files that declare
          // their own same-named local helpers (common for hash algorithms),
          // producing "Identifier has already been declared" at load time.
          const funcName = bits === 16 ? (isBigEndian ? 'Unpack16BE' : 'Unpack16LE') :
                           bits === 64 ? (isBigEndian ? 'Unpack64BE' : 'Unpack64LE') :
                                         (isBigEndian ? 'Unpack32BE' : 'Unpack32LE');

          return new JavaScriptCall(new JavaScriptIdentifier('OpCodes'), funcName, [value]);
        }

        // Pack bytes - convert byte array to integer
        case 'PackBytes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          const bits = node.bits || 32;
          const isBigEndian = node.endian === 'big' || node.bigEndian;

          const funcName = bits === 16 ? (isBigEndian ? 'Pack16BE' : 'Pack16LE') :
                           bits === 64 ? (isBigEndian ? 'Pack64BE' : 'Pack64LE') :
                                         (isBigEndian ? 'Pack32BE' : 'Pack32LE');

          return new JavaScriptCall(new JavaScriptIdentifier('OpCodes'), funcName, args);
        }

        // Bit rotation operations
        case 'Rotation': {
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const bits = node.bits || 32;
          const direction = node.direction || 'left';

          const funcName = bits === 64
            ? (direction === 'left' ? 'RotL64n' : 'RotR64n')
            : (direction === 'left' ? `RotL${bits}` : `RotR${bits}`);
          return new JavaScriptCall(new JavaScriptIdentifier('OpCodes'), funcName, [value, amount]);
        }

        // Math function calls
        case 'MathCall': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          const method = node.method;

          // Map to JavaScript Math methods
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), method, args);
        }

        // Individual math operations as IL nodes. The parser emits these
        // with a singular `argument` field (see TypeAwareJSASTParser), not
        // `arguments`/`value` — those never matched, so transformExpression
        // was called on undefined and the emitted call lost its argument
        // entirely (e.g. `Math.floor(sum / 256)` became `Math.floor()`).
        case 'Floor': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'floor', [value]);
        }

        case 'Ceil': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'ceil', [value]);
        }

        case 'Round': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'round', [value]);
        }

        case 'Abs': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'abs', [value]);
        }

        case 'Min': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'min', args);
        }

        case 'Max': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'max', args);
        }

        // Bit rotation operations
        case 'RotateLeft': {
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const bits = node.bits || 32;
          const funcName = bits === 64 ? 'RotL64n' : `RotL${bits}`;
          return new JavaScriptCall(new JavaScriptIdentifier('OpCodes'), funcName, [value, amount]);
        }

        case 'RotateRight': {
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const bits = node.bits || 32;
          const funcName = bits === 64 ? 'RotR64n' : `RotR${bits}`;
          return new JavaScriptCall(new JavaScriptIdentifier('OpCodes'), funcName, [value, amount]);
        }

        // OpCodes method calls
        case 'OpCodesCall': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          // Fully qualify as OpCodes.<Method>(...) rather than emitting a bare,
          // unresolved call or a hand-rolled native-method substitute — the
          // standalone prelude embeds the real OpCodes object, so every
          // OpCodes.js method (CopyArray, ClearArray, GF256Mul, ...) is reachable
          // this way with its exact real semantics. (A prior hand-rolled
          // ClearArray -> array.splice(0) substitution both changed semantics —
          // splice truncates length instead of zero-filling in place — and threw
          // outright on typed arrays, which have no splice method.)
          return new JavaScriptCall(new JavaScriptIdentifier('OpCodes'), node.method, args);
        }

        // ========================[ ADDITIONAL IL AST NODE TYPES ]========================
        // These are generated by the type-aware transpiler but were not handled

        case 'FieldDefinition': {
          // IL AST: class field definition → JavaScript property
          const name = node.key?.name || node.name || 'field';
          const initializer = node.value ? this.transformExpression(node.value) : null;
          const prop = new JavaScriptProperty(name, initializer);
          prop.isStatic = node.static || false;
          return prop;
        }

        case 'ArrayLiteral': {
          // IL AST: array literal → JavaScript array literal
          const elements = (node.elements || []).map(el => el ? this.transformExpression(el) : JavaScriptLiteral.Undefined());
          return new JavaScriptArrayLiteral(elements);
        }

        case 'ArraySort': {
          // IL AST: array.sort(compareFn) → JavaScript: array.sort(compareFn)
          const array = this.transformExpression(node.array);
          const args = node.compareFn ? [this.transformExpression(node.compareFn)] : [];
          return new JavaScriptCall(array, 'sort', args);
        }

        case 'ArrayShift': {
          // IL AST: array.shift() → JavaScript: array.shift()
          const array = this.transformExpression(node.array);
          return new JavaScriptCall(array, 'shift', []);
        }

        case 'ArraySome': {
          // IL AST: array.some(callback) → JavaScript: array.some(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new JavaScriptCall(array, 'some', callback ? [callback] : []);
        }

        case 'ArrayMap': {
          // IL AST: array.map(callback) → JavaScript: array.map(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new JavaScriptCall(array, 'map', callback ? [callback] : []);
        }

        case 'ArrayForEach': {
          // IL AST: array.forEach(callback) → JavaScript: array.forEach(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new JavaScriptCall(array, 'forEach', callback ? [callback] : []);
        }

        case 'StringTransform': {
          // IL AST: string.method() → JavaScript: string.method()
          const str = this.transformExpression(node.string || node.value);
          const method = node.method || 'toString';
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new JavaScriptCall(str, method, args);
        }

        case 'StringCharCodeAt': {
          // IL AST: string.charCodeAt(index) → JavaScript: string.charCodeAt(index)
          const str = this.transformExpression(node.string || node.value);
          const index = node.index ? this.transformExpression(node.index) : JavaScriptLiteral.Number(0);
          return new JavaScriptCall(str, 'charCodeAt', [index]);
        }

        case 'BigIntCast': {
          // IL AST: BigInt(value) → JavaScript: BigInt(value)
          const value = this.transformExpression(node.argument || node.value);
          return new JavaScriptCall(null, 'BigInt', [value]);
        }

        case 'DataViewCreation': {
          // IL AST: new DataView(buffer) → JavaScript: new DataView(buffer)
          const buffer = node.buffer ? this.transformExpression(node.buffer) : null;
          const args = buffer ? [buffer] : [];
          if (node.byteOffset) args.push(this.transformExpression(node.byteOffset));
          if (node.byteLength) args.push(this.transformExpression(node.byteLength));
          return new JavaScriptNew('DataView', args);
        }

        case 'Power': {
          // IL AST: base ** exponent → JavaScript: base ** exponent or Math.pow(base, exponent)
          const base = this.transformExpression(node.base || node.arguments?.[0]);
          const exponent = this.transformExpression(node.exponent || node.arguments?.[1]);
          // Use ** operator for ES2016+, but we'll use Math.pow for compatibility
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'pow', [base, exponent]);
        }

        case 'BitwiseOperation': {
          // IL AST: bitwise operation → JavaScript bitwise operation
          const left = this.transformExpression(node.left || node.arguments?.[0]);
          const right = node.right ? this.transformExpression(node.right) : this.transformExpression(node.arguments?.[1]);
          const op = node.operator || '&';
          return new JavaScriptBinaryExpression(left, op, right);
        }

        case 'BufferCreation': {
          // IL AST: new ArrayBuffer(size) → JavaScript: new ArrayBuffer(size)
          const size = node.size ? this.transformExpression(node.size) : JavaScriptLiteral.Number(0);
          return new JavaScriptNew('ArrayBuffer', [size]);
        }

        case 'TypedArraySet': {
          // IL AST: typedArray.set(source, offset) → JavaScript: typedArray.set(source, offset)
          const array = this.transformExpression(node.array);
          const source = node.source ? this.transformExpression(node.source) : null;
          const args = source ? [source] : [];
          if (node.offset) args.push(this.transformExpression(node.offset));
          return new JavaScriptCall(array, 'set', args);
        }

        case 'TypedArraySubarray': {
          // IL AST: typedArray.subarray(begin, end) → JavaScript: typedArray.subarray(begin, end)
          const array = this.transformExpression(node.array);
          const args = [];
          if (node.begin) args.push(this.transformExpression(node.begin));
          if (node.end) args.push(this.transformExpression(node.end));
          return new JavaScriptCall(array, 'subarray', args);
        }

        case 'ArrayXor': {
          // IL AST: XOR two arrays → JavaScript: OpCodes.XorArrays(...)
          const arr1 = this.transformExpression(node.array1 || node.arguments?.[0]);
          const arr2 = this.transformExpression(node.array2 || node.arguments?.[1]);
          return new JavaScriptCall(new JavaScriptIdentifier('OpCodes'), 'XorArrays', [arr1, arr2]);
        }

        case 'MapSet': {
          // IL AST: map.set(key, value) → JavaScript: map.set(key, value)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          const value = this.transformExpression(node.value);
          return new JavaScriptCall(map, 'set', [key, value]);
        }

        case 'ArrayFind': {
          // IL AST: array.find(callback) → JavaScript: array.find(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new JavaScriptCall(array, 'find', callback ? [callback] : []);
        }

        case 'ArrayFilter': {
          // IL AST: array.filter(callback) → JavaScript: array.filter(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new JavaScriptCall(array, 'filter', callback ? [callback] : []);
        }

        case 'ArrayReduce': {
          // IL AST: array.reduce(callback, initial) → JavaScript: array.reduce(callback, initial)
          const array = this.transformExpression(node.array);
          const args = [];
          if (node.callback) args.push(this.transformExpression(node.callback));
          if (node.initialValue) args.push(this.transformExpression(node.initialValue));
          return new JavaScriptCall(array, 'reduce', args);
        }

        case 'ArrayJoin': {
          // IL AST: array.join(separator) → JavaScript: array.join(separator)
          const array = this.transformExpression(node.array);
          const separator = node.separator ? this.transformExpression(node.separator) : null;
          return new JavaScriptCall(array, 'join', separator ? [separator] : []);
        }

        case 'ArrayPop': {
          // IL AST: array.pop() → JavaScript: array.pop()
          const array = this.transformExpression(node.array);
          return new JavaScriptCall(array, 'pop', []);
        }

        case 'ArrayUnshift': {
          // IL AST: array.unshift(value) → JavaScript: array.unshift(value)
          const array = this.transformExpression(node.array);
          const value = node.value ? this.transformExpression(node.value) : null;
          return new JavaScriptCall(array, 'unshift', value ? [value] : []);
        }

        case 'ArraySplice': {
          // IL AST: array.splice(start, deleteCount, items...) → JavaScript: array.splice(...)
          const array = this.transformExpression(node.array);
          const args = [];
          if (node.start) args.push(this.transformExpression(node.start));
          if (node.deleteCount) args.push(this.transformExpression(node.deleteCount));
          if (node.items) {
            for (const item of node.items) {
              args.push(this.transformExpression(item));
            }
          }
          return new JavaScriptCall(array, 'splice', args);
        }

        case 'ArrayEvery': {
          // IL AST: array.every(callback) → JavaScript: array.every(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new JavaScriptCall(array, 'every', callback ? [callback] : []);
        }

        case 'StringSplit': {
          // IL AST: string.split(separator) → JavaScript: string.split(separator)
          const str = this.transformExpression(node.string || node.value);
          const separator = node.separator ? this.transformExpression(node.separator) : null;
          return new JavaScriptCall(str, 'split', separator ? [separator] : []);
        }

        case 'StringSubstring': {
          // IL AST: string.substring/slice(start, end) → JavaScript. This
          // one IL node conflates THREE distinct original methods
          // (type-aware-transpiler.js's _transformStringMethod maps
          // substring/substr/slice all to 'StringSubstring', with no field
          // recording which one it originally was):
          //
          // 1. .substr(start, length) — length is a character COUNT, kept
          //    under the separate `length` field (not relabeled `end`,
          //    since consumers computing `end - start` would silently
          //    corrupt every multi-char substr() call). Re-emit as
          //    `.substr(start, length)` directly when present — only
          //    reading `.start`/`.end` and dropping `.length` turned every
          //    `str.substr(0, n)` into a bare `str.substring(0)` (the entire
          //    rest of the string), observed corrupting
          //    compression/huffman.js's bitstream decode.
          // 2. .slice(start, end) — a negative `end` counts from the end of
          //    the string.
          // 3. .substring(start, end) — a negative `end` clamps to 0, and
          //    start/end are swapped if start > end.
          // With no way to recover which of #2/#3 the source actually used,
          // emit `.slice()`: it's identical to `.substring()` for the
          // overwhelmingly common case (non-negative, start <= end), and
          // unlike `.substring()` also handles negative-end trimming
          // correctly (e.g. `str.slice(0, -2)` to drop the last two chars,
          // as encoding/base64.js's encoder does) — `.substring(0, -2)`
          // clamps -2 to 0 and returns "", corrupting the output.
          const str = this.transformExpression(node.string || node.value);
          const args = [];
          if (node.start) args.push(this.transformExpression(node.start));
          if (node.length) {
            args.push(this.transformExpression(node.length));
            return new JavaScriptCall(str, 'substr', args);
          }
          if (node.end) args.push(this.transformExpression(node.end));
          return new JavaScriptCall(str, 'slice', args);
        }

        case 'StringIndexOf': {
          // IL AST: string.indexOf/lastIndexOf(search, fromIndex) — the IL node
          // uses `searchValue`/`fromIndex`/`method` (not `search`), and covers
          // both indexOf and lastIndexOf via `method`.
          const str = this.transformExpression(node.string || node.value);
          const search = node.searchValue ? this.transformExpression(node.searchValue) : null;
          const fromIndex = node.fromIndex ? this.transformExpression(node.fromIndex) : null;
          const methodName = node.method === 'lastIndexOf' ? 'lastIndexOf' : 'indexOf';
          const args = [];
          if (search) args.push(search);
          if (fromIndex) args.push(fromIndex);
          return new JavaScriptCall(str, methodName, args);
        }

        case 'StringLength': {
          // IL AST: string.length → JavaScript: string.length
          const str = this.transformExpression(node.string || node.value);
          return new JavaScriptMemberAccess(str, 'length');
        }

        // ========================[ NEW IL AST NODE TYPES ]========================
        // These are language-agnostic nodes from the enhanced JS-to-IL transformer

        case 'DebugOutput': {
          // IL AST: debug output → JavaScript: console.log/warn/error
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          const method = node.level || 'log';
          const consoleObj = new JavaScriptIdentifier('console');
          return new JavaScriptCall(consoleObj, method, args);
        }

        case 'TypeOfExpression': {
          // IL AST: typeof x → JavaScript: typeof x
          const argument = this.transformExpression(node.argument);
          return new JavaScriptUnaryExpression('typeof', argument, true);
        }

        case 'DeleteExpression': {
          // IL AST: delete x → JavaScript: delete x
          const argument = this.transformExpression(node.argument);
          return new JavaScriptDeleteExpression(argument);
        }

        case 'StringInterpolation': {
          // IL AST: template string → JavaScript: template literal.
          // _transformTemplateLiteral (type-aware-transpiler.js) emits a flat
          // *interleaved* list under `parts`: separate StringPart{value}/
          // ExpressionPart{expression} entries, e.g. `` `SHA-${variant}` ``
          // becomes [StringPart('SHA-'), ExpressionPart(variant)] — not the
          // {text, expression} pairs the emitter (emitTemplateLiteral) walks.
          // Treating each list entry as its own already-paired {text,
          // expression} (old code below) read a nonexistent `part.text` off
          // every entry (getting '') and a nonexistent `part.expression` off
          // StringPart entries (getting null), so all static text vanished —
          // e.g. `SHA-${variant}` silently became just `${variant}`.
          // Rebuild real {text, expression} pairs by accumulating text until
          // the next expression, matching what emitTemplateLiteral expects.
          const template = new JavaScriptTemplateLiteral();
          if (node.quasis && node.expressions) {
            for (let i = 0; i < node.quasis.length; ++i) {
              const text = node.quasis[i] || '';
              const expression = i < node.expressions.length ? this.transformExpression(node.expressions[i]) : null;
              template.parts.push({ text, expression });
            }
          } else if (node.parts) {
            let pendingText = '';
            for (const part of node.parts) {
              if (part.type === 'ExpressionPart' || part.expression !== undefined) {
                const expression = this.transformExpression(part.expression);
                template.parts.push({ text: pendingText, expression });
                pendingText = '';
              } else {
                pendingText += part.value !== undefined ? part.value : (part.text || '');
              }
            }
            if (pendingText || template.parts.length === 0) template.parts.push({ text: pendingText, expression: null });
          }
          return template;
        }

        case 'RestParameter': {
          // IL AST: rest parameter → JavaScript: rest parameter
          const param = new JavaScriptParameter(node.name || 'rest');
          param.isRest = true;
          return param;
        }

        case 'ObjectLiteral': {
          // IL AST: object literal → JavaScript: object literal
          const obj = new JavaScriptObjectLiteral();
          if (node.properties) {
            for (const prop of node.properties) {
              // The IL layer (_transformObjectExpression) emits spread
              // properties as ilNodeType/type 'ObjectSpread' with the spread
              // expression in `argument` — not 'SpreadElement' (that IL type
              // is used elsewhere, e.g. array literals and call arguments).
              // Matching the wrong type name meant every `{...other}` object
              // spread fell through to the plain-property branch below, where
              // `prop.key`/`prop.value` don't exist on an ObjectSpread node,
              // producing a literal property named "key" with an empty value
              // (`key: ,` — a syntax error).
              if (prop.type === 'ObjectSpread' || prop.type === 'SpreadElement') {
                // Spread in object literal: {...other}
                const spreadArg = this.transformExpression(prop.argument);
                obj.properties.push({ key: '...', value: spreadArg, spread: true });
              } else {
                const key = this.resolveObjectKey(prop.key);
                const value = this.transformExpression(prop.value);
                const propEntry = { key, value };
                // Object-literal accessor properties (`set key(v) {...}` /
                // `get key() {...}`) carry `kind: 'get'|'set'` on the IL
                // node. Dropping it collapsed both into two plain
                // properties both literally named `key: function(){...}` —
                // duplicate keys in one object literal, where the *last*
                // one silently wins, discarding the setter entirely. Any
                // `instance.key = bytes` assignment then just overwrote the
                // plain property instead of running the setter's logic
                // (observed as block/deal.js's key setup never running,
                // "Key not set" on every vector).
                if (prop.kind === 'get' || prop.kind === 'set') propEntry.kind = prop.kind;
                obj.properties.push(propEntry);
              }
            }
          }
          return obj;
        }

        case 'ArrowFunction': {
          // IL AST: arrow function → JavaScript: arrow function
          const params = (node.params || []).map(p => {
            if (typeof p === 'string') return new JavaScriptParameter(p);
            if (p.type === 'RestParameter') {
              const param = new JavaScriptParameter(p.name || 'rest');
              param.isRest = true;
              return param;
            }
            return this.transformParameter(p);
          });

          const body = node.body ?
            (node.body.type === 'BlockStatement' ? this.transformFunctionBody(node.body) : this.transformExpression(node.body)) :
            new JavaScriptBlock();

          const arrow = new JavaScriptArrowFunction(params, body);
          arrow.isAsync = node.async || false;
          return arrow;
        }

        case 'AwaitExpression': {
          // IL AST: await x → JavaScript: await x
          const argument = this.transformExpression(node.argument);
          return new JavaScriptAwaitExpression(argument);
        }

        case 'DataViewRead': {
          // IL AST: dataView.getXxx(offset, littleEndian) → JavaScript: dataView.getXxx(offset, littleEndian)
          // _transformDataViewMethod (type-aware-transpiler.js) stores the
          // receiver under `view` — not `dataView`/`object`/`target`, which
          // never matched, silently dropping the receiver and emitting a
          // bare `getXxx(...)` call ("getXxx is not defined" at runtime).
          const dataView = this.transformExpression(node.view || node.dataView || node.object || node.target);
          const method = node.method || 'getUint8';
          const args = [];
          if (node.offset !== undefined) args.push(this.transformExpression(node.offset));
          else if (node.arguments?.[0]) args.push(this.transformExpression(node.arguments[0]));
          // node.littleEndian (type-aware-transpiler.js's _transformDataViewMethod)
          // is itself a full IL node (e.g. `{type:'Literal', value:false,...}`),
          // not a raw JS boolean — `transformedArgs[2] || null` there only
          // decides *whether* an argument was supplied, it never unwraps the
          // node's actual `.value`. Passing that IL node straight into
          // `JavaScriptLiteral.Boolean(...)` made `.value` the node object
          // itself: any non-null object is truthy, so emitLiteral's
          // `node.value ? 'true' : 'false'` always printed `true` regardless
          // of whether the source literally wrote `true` or `false` — e.g.
          // aead/deoxys-ii.js's `setBigUint64(0, BigInt(index), false)`
          // (big-endian) silently became `..., true)` (little-endian),
          // corrupting every AAD/message block counter. Transform the IL
          // node like any other expression instead of wrapping it directly;
          // `null` means the argument was genuinely omitted (8-bit
          // getUint8/setUint8, where endianness is meaningless).
          if (node.littleEndian !== undefined && node.littleEndian !== null) args.push(this.transformExpression(node.littleEndian));
          else if (node.arguments?.[1]) args.push(this.transformExpression(node.arguments[1]));
          return new JavaScriptCall(dataView, method, args);
        }

        case 'DataViewWrite': {
          // IL AST: dataView.setXxx(offset, value, littleEndian) → JavaScript: dataView.setXxx(...)
          // See DataViewRead above: the receiver is stored under `view`.
          const dataView = this.transformExpression(node.view || node.dataView || node.object || node.target);
          const method = node.method || 'setUint8';
          const args = [];
          if (node.offset !== undefined) args.push(this.transformExpression(node.offset));
          else if (node.arguments?.[0]) args.push(this.transformExpression(node.arguments[0]));
          if (node.value !== undefined) args.push(this.transformExpression(node.value));
          else if (node.arguments?.[1]) args.push(this.transformExpression(node.arguments[1]));
          // See DataViewRead above: node.littleEndian is a full IL node, not a
          // raw boolean — transform it instead of wrapping the node object
          // itself in JavaScriptLiteral.Boolean(...) (always truthy).
          if (node.littleEndian !== undefined && node.littleEndian !== null) args.push(this.transformExpression(node.littleEndian));
          else if (node.arguments?.[2]) args.push(this.transformExpression(node.arguments[2]));
          return new JavaScriptCall(dataView, method, args);
        }

        case 'IsArrayCheck': {
          // IL AST: Array.isArray(x) → JavaScript: Array.isArray(x)
          const argument = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          const arrayObj = new JavaScriptIdentifier('Array');
          return new JavaScriptCall(arrayObj, 'isArray', argument ? [argument] : []);
        }

        case 'ArrayFrom': {
          // IL AST: Array.from(x) → JavaScript: Array.from(x)
          const argument = this.transformExpression(node.iterable || node.value || node.argument || node.arguments?.[0]);
          const arrayObj = new JavaScriptIdentifier('Array');
          const args = argument ? [argument] : [];
          // Add mapFunction if present
          if (node.mapFunction) args.push(this.transformExpression(node.mapFunction));
          return new JavaScriptCall(arrayObj, 'from', args);
        }

        case 'ObjectKeys': {
          // IL AST: Object.keys(x) → JavaScript: Object.keys(x)
          const argument = this.transformExpression(node.argument || node.object);
          const objectObj = new JavaScriptIdentifier('Object');
          return new JavaScriptCall(objectObj, 'keys', [argument]);
        }

        case 'ObjectValues': {
          // IL AST: Object.values(x) → JavaScript: Object.values(x)
          const argument = this.transformExpression(node.argument || node.object);
          const objectObj = new JavaScriptIdentifier('Object');
          return new JavaScriptCall(objectObj, 'values', [argument]);
        }

        case 'ObjectEntries': {
          // IL AST: Object.entries(x) → JavaScript: Object.entries(x)
          const argument = this.transformExpression(node.argument || node.object);
          const objectObj = new JavaScriptIdentifier('Object');
          return new JavaScriptCall(objectObj, 'entries', [argument]);
        }

        case 'ObjectMerge': {
          // IL AST: Object.assign(target, ...sources) → JavaScript: Object.assign(...)
          // Producer (type-aware-transpiler.js _transformObjectStaticMethod
          // 'assign' case) stores the operands under `target`/`sources`, not
          // a flat `arguments` array — that field never existed, so every
          // Object.assign() call was emitted with zero arguments.
          const target = this.transformExpression(node.target);
          const sources = (node.sources || []).map(arg => this.transformExpression(arg));
          const objectObj = new JavaScriptIdentifier('Object');
          return new JavaScriptCall(objectObj, 'assign', [target, ...sources]);
        }

        case 'ObjectCreate': {
          // IL AST: Object.create(proto, properties) → JavaScript: Object.create(...)
          const proto = this.transformExpression(node.prototype || node.object);
          const objectObj = new JavaScriptIdentifier('Object');
          if (node.properties) {
            const props = this.transformExpression(node.properties);
            return new JavaScriptCall(objectObj, 'create', [proto, props]);
          }
          return new JavaScriptCall(objectObj, 'create', [proto]);
        }

        case 'ObjectFreeze': {
          // IL AST: Object.freeze(x) → JavaScript: Object.freeze(x)
          const argument = this.transformExpression(node.object || node.value || node.argument || node.arguments?.[0]);
          const objectObj = new JavaScriptIdentifier('Object');
          return new JavaScriptCall(objectObj, 'freeze', argument ? [argument] : []);
        }

        case 'ObjectHasProperty': {
          // IL AST: Object.hasOwn(obj, key) or obj.hasOwnProperty(key) → JavaScript
          // Producer stores the key/property under `property`, not `key`.
          const obj = this.transformExpression(node.object);
          const key = this.transformExpression(node.property !== undefined ? node.property : node.key);
          const objectObj = new JavaScriptIdentifier('Object');
          return new JavaScriptCall(objectObj, 'hasOwn', [obj, key]);
        }

        case 'ObjectFromEntries': {
          // IL AST: Object.fromEntries(x) → JavaScript: Object.fromEntries(x)
          const argument = this.transformExpression(node.entries || node.value || node.argument || node.arguments?.[0]);
          const objectObj = new JavaScriptIdentifier('Object');
          return new JavaScriptCall(objectObj, 'fromEntries', argument ? [argument] : []);
        }

        case 'StringFromCharCodes': {
          // IL AST: String.fromCharCode(...codes) → JavaScript: String.fromCharCode(...)
          // node stores the argument list under `charCodes` (see
          // type-aware-transpiler.js _transformStringStaticMethod) — not
          // `arguments`, which doesn't exist on this IL node and silently
          // produced an empty-args String.fromCharCode() call.
          const args = (node.charCodes || node.arguments || []).map(arg => this.transformExpression(arg));
          const stringObj = new JavaScriptIdentifier('String');
          return new JavaScriptCall(stringObj, 'fromCharCode', args);
        }

        case 'StringFromCodePoints': {
          // IL AST: String.fromCodePoint(...codes) → JavaScript: String.fromCodePoint(...)
          // node stores the argument list under `codePoints` — see StringFromCharCodes above.
          const args = (node.codePoints || node.arguments || []).map(arg => this.transformExpression(arg));
          const stringObj = new JavaScriptIdentifier('String');
          return new JavaScriptCall(stringObj, 'fromCodePoint', args);
        }

        case 'IsIntegerCheck': {
          // IL AST: Number.isInteger(x) → JavaScript: Number.isInteger(x)
          const argument = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          const numberObj = new JavaScriptIdentifier('Number');
          return new JavaScriptCall(numberObj, 'isInteger', argument ? [argument] : []);
        }

        case 'IsNaNCheck': {
          // IL AST: Number.isNaN(x) → JavaScript: Number.isNaN(x)
          const argument = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          const numberObj = new JavaScriptIdentifier('Number');
          return new JavaScriptCall(numberObj, 'isNaN', argument ? [argument] : []);
        }

        case 'IsFiniteCheck': {
          // IL AST: Number.isFinite(x) → JavaScript: Number.isFinite(x)
          const argument = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          const numberObj = new JavaScriptIdentifier('Number');
          return new JavaScriptCall(numberObj, 'isFinite', argument ? [argument] : []);
        }

        case 'ParseInteger': {
          // IL AST: parseInt(str, radix) → JavaScript: parseInt(str, radix)
          const args = [];
          if (node.string) args.push(this.transformExpression(node.string));
          else if (node.arguments?.[0]) args.push(this.transformExpression(node.arguments[0]));
          if (node.radix) args.push(this.transformExpression(node.radix));
          else if (node.arguments?.[1]) args.push(this.transformExpression(node.arguments[1]));
          return new JavaScriptCall(null, 'parseInt', args);
        }

        case 'ParseFloat': {
          // IL AST: parseFloat(str) → JavaScript: parseFloat(str)
          const argument = node.string ? this.transformExpression(node.string) :
                          node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : null;
          return new JavaScriptCall(null, 'parseFloat', argument ? [argument] : []);
        }

        case 'JsonSerialize': {
          // IL AST: JSON.stringify(obj, replacer, space) → JavaScript
          // Producer stores the operands under value/replacer/space (see
          // type-aware-transpiler.js), not a flat `arguments` array.
          let args = (node.arguments || []).map(arg => this.transformExpression(arg));
          if (args.length === 0 && node.value !== undefined) {
            args = [this.transformExpression(node.value)];
            if (node.replacer) args.push(this.transformExpression(node.replacer));
            if (node.space) args.push(this.transformExpression(node.space));
          }
          const jsonObj = new JavaScriptIdentifier('JSON');
          return new JavaScriptCall(jsonObj, 'stringify', args);
        }

        case 'JsonDeserialize': {
          // IL AST: JSON.parse(str, reviver) → JavaScript
          // Producer stores the JSON text under `text` (not `value`/
          // `arguments`) — that mismatch meant JSON.parse() was always
          // emitted with zero arguments.
          let args = (node.arguments || []).map(arg => this.transformExpression(arg));
          if (args.length === 0 && (node.text !== undefined || node.value !== undefined)) {
            args = [this.transformExpression(node.text !== undefined ? node.text : node.value)];
            if (node.reviver) args.push(this.transformExpression(node.reviver));
          }
          const jsonObj = new JavaScriptIdentifier('JSON');
          return new JavaScriptCall(jsonObj, 'parse', args);
        }

        case 'Typeof': {
          // IL AST: typeof x → JavaScript: typeof x
          const argument = this.transformExpression(node.argument);
          return new JavaScriptUnaryExpression('typeof', argument, true);
        }

        case 'Instanceof': {
          // IL AST: x instanceof Y → JavaScript: x instanceof Y
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new JavaScriptBinaryExpression(left, 'instanceof', right);
        }

        case 'MapCreation': {
          // IL AST: new Map(entries) → JavaScript: new Map(entries)
          const args = node.entries ? [this.transformExpression(node.entries)] : [];
          return new JavaScriptNew('Map', args);
        }

        case 'SetCreation': {
          // IL AST: new Set(values) → JavaScript: new Set(values)
          const args = node.values ? [this.transformExpression(node.values)] : [];
          return new JavaScriptNew('Set', args);
        }

        case 'RegExpCreation': {
          // IL AST: new RegExp(pattern, flags) → JavaScript: new RegExp(pattern, flags)
          const args = [];
          if (node.pattern) args.push(this.transformExpression(node.pattern));
          if (node.flags) args.push(this.transformExpression(node.flags));
          return new JavaScriptNew('RegExp', args);
        }

        // These single-argument Math IL nodes (see _transformMathCall in
        // type-aware-transpiler.js) all carry their operand under the
        // singular `argument` field — matching the Floor/Ceil/Round/Abs fix
        // above. `node.arguments?.[0] || node.value` never matched (no
        // `arguments` array, no `value` field exists on these nodes), so
        // every Math.log/sin/cos/.../sqrt call in transpiled output silently
        // lost its argument (e.g. `Math.sqrt(x)` became `Math.sqrt()`).
        case 'Log': {
          // IL AST: Math.log(x) → JavaScript: Math.log(x)
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'log', [value]);
        }

        case 'Log2': {
          // IL AST: Math.log2(x) → JavaScript: Math.log2(x)
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'log2', [value]);
        }

        case 'Log10': {
          // IL AST: Math.log10(x) → JavaScript: Math.log10(x)
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'log10', [value]);
        }

        case 'Random': {
          // IL AST: Math.random() → JavaScript: Math.random()
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'random', []);
        }

        case 'Sin': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'sin', [value]);
        }

        case 'Cos': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'cos', [value]);
        }

        case 'Tan': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'tan', [value]);
        }

        case 'Asin': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'asin', [value]);
        }

        case 'Acos': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'acos', [value]);
        }

        case 'Atan': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'atan', [value]);
        }

        case 'Atan2': {
          const y = this.transformExpression(node.y ?? node.arguments?.[0]);
          const x = this.transformExpression(node.x ?? node.arguments?.[1]);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'atan2', [y, x]);
        }

        case 'Exp': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'exp', [value]);
        }

        case 'Sign': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'sign', [value]);
        }

        case 'Trunc':
        case 'Truncate': {
          // Producer emits ilNodeType/type 'Truncate' (type-aware-transpiler.js
          // _transformMathCall 'trunc' case) — the 'Trunc' spelling never
          // matched, falling through to the default placeholder handler.
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'trunc', [value]);
        }

        case 'Sqrt': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'sqrt', [value]);
        }

        case 'Sinh': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'sinh', [value]);
        }

        case 'Cosh': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'cosh', [value]);
        }

        case 'Tanh': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'tanh', [value]);
        }

        case 'Cbrt': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'cbrt', [value]);
        }

        case 'Hypot': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'hypot', args);
        }

        case 'Fround': {
          const value = this.transformExpression(node.argument ?? node.arguments?.[0] ?? node.value);
          return new JavaScriptCall(new JavaScriptIdentifier('Math'), 'fround', [value]);
        }

        case 'MathConstant': {
          // IL AST: Math constant → JavaScript: Math.PI, Math.E, etc.
          return new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), node.name);
        }

        case 'NumberConstant': {
          // IL AST: Number constant → JavaScript: Number.MAX_SAFE_INTEGER, Infinity, NaN, etc.
          switch (node.name) {
            case 'POSITIVE_INFINITY':
              return new JavaScriptIdentifier('Infinity');
            case 'NEGATIVE_INFINITY':
              return new JavaScriptUnaryExpression('-', new JavaScriptIdentifier('Infinity'), true);
            case 'NaN':
              return new JavaScriptIdentifier('NaN');
            default:
              return new JavaScriptMemberAccess(new JavaScriptIdentifier('Number'), node.name);
          }
        }

        case 'InstanceOfCheck': {
          // IL AST: value instanceof ClassName → JavaScript: value instanceof ClassName
          const value = this.transformExpression(node.value);
          const className = this.transformExpression(node.className);
          return new JavaScriptBinaryExpression(value, 'instanceof', className);
        }

        case 'MapGet': {
          // IL AST: map.get(key) → JavaScript: map.get(key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new JavaScriptCall(map, 'get', [key]);
        }

        case 'MapHas': {
          // IL AST: map.has(key) → JavaScript: map.has(key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new JavaScriptCall(map, 'has', [key]);
        }

        case 'MapDelete': {
          // IL AST: map.delete(key) → JavaScript: map.delete(key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new JavaScriptCall(map, 'delete', [key]);
        }

        case 'StringRepeat': {
          // IL AST: string.repeat(count) → JavaScript: string.repeat(count)
          const str = this.transformExpression(node.string || node.value);
          const count = this.transformExpression(node.count);
          return new JavaScriptCall(str, 'repeat', [count]);
        }

        case 'StringReplace': {
          // IL AST: string.replace(search, replace) → JavaScript: string.replace(search, replace)
          // The IL node's fields are `searchValue`/`replaceValue` (and `method`
          // is 'replace' or 'replaceAll') — reading the nonexistent
          // `search`/`replacement` fields always produced undefined, which
          // rendered as an argument-less `.replace(, )` call (a syntax error).
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.searchValue || node.search);
          const replacement = this.transformExpression(node.replaceValue || node.replacement);
          const methodName = node.method === 'replaceAll' ? 'replaceAll' : 'replace';
          return new JavaScriptCall(str, methodName, [search, replacement]);
        }

        case 'StringCharAt': {
          // IL AST: string.charAt(index) → JavaScript: string.charAt(index)
          const str = this.transformExpression(node.string || node.value);
          const index = this.transformExpression(node.index);
          return new JavaScriptCall(str, 'charAt', [index]);
        }

        case 'StringIncludes': {
          // IL AST: string.includes/startsWith/endsWith(search) — the IL node
          // uses `searchValue` (not `search`) and covers all three methods via
          // `method`; hardcoding 'includes' silently turned every startsWith/
          // endsWith call into an includes call.
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.searchValue || node.search);
          const methodName = (node.method === 'startsWith' || node.method === 'endsWith') ? node.method : 'includes';
          return new JavaScriptCall(str, methodName, [search]);
        }

        case 'StringStartsWith': {
          // IL AST: string.startsWith(prefix) → JavaScript: string.startsWith(prefix)
          const str = this.transformExpression(node.string || node.value);
          const prefix = this.transformExpression(node.prefix || node.search);
          return new JavaScriptCall(str, 'startsWith', [prefix]);
        }

        case 'StringEndsWith': {
          // IL AST: string.endsWith(suffix) → JavaScript: string.endsWith(suffix)
          const str = this.transformExpression(node.string || node.value);
          const suffix = this.transformExpression(node.suffix || node.search);
          return new JavaScriptCall(str, 'endsWith', [suffix]);
        }

        case 'StringTrim': {
          // IL AST: string.trim() → JavaScript: string.trim()
          const str = this.transformExpression(node.string || node.value);
          return new JavaScriptCall(str, 'trim', []);
        }

        case 'StringPadStart': {
          // IL AST: string.padStart(length, fill) → JavaScript: string.padStart(length, fill)
          const str = this.transformExpression(node.string || node.value);
          const args = [this.transformExpression(node.length)];
          if (node.fill) args.push(this.transformExpression(node.fill));
          return new JavaScriptCall(str, 'padStart', args);
        }

        case 'StringPadEnd': {
          // IL AST: string.padEnd(length, fill) → JavaScript: string.padEnd(length, fill)
          const str = this.transformExpression(node.string || node.value);
          const args = [this.transformExpression(node.length)];
          if (node.fill) args.push(this.transformExpression(node.fill));
          return new JavaScriptCall(str, 'padEnd', args);
        }

        case 'StringToLowerCase': {
          // IL AST: string.toLowerCase() → JavaScript: string.toLowerCase()
          const str = this.transformExpression(node.string || node.value);
          return new JavaScriptCall(str, 'toLowerCase', []);
        }

        case 'StringToUpperCase': {
          // IL AST: string.toUpperCase() → JavaScript: string.toUpperCase()
          const str = this.transformExpression(node.string || node.value);
          return new JavaScriptCall(str, 'toUpperCase', []);
        }

        case 'StringSlice': {
          // IL AST: string.slice(start, end) → JavaScript: string.slice(start, end)
          const str = this.transformExpression(node.string || node.value);
          const args = [];
          if (node.start) args.push(this.transformExpression(node.start));
          if (node.end) args.push(this.transformExpression(node.end));
          return new JavaScriptCall(str, 'slice', args);
        }

        case 'StringConcat': {
          // IL AST: string.concat(...others) → JavaScript: string.concat(...)
          // The IL node carries its arguments in `values`, not `arguments`.
          const str = this.transformExpression(node.string || node.value);
          const args = (node.values || node.arguments || []).map(arg => this.transformExpression(arg));
          return new JavaScriptCall(str, 'concat', args);
        }

        case 'StringPad': {
          // IL AST: string.padStart/padEnd(targetLength, padString) →
          // JavaScript: string.padStart/padEnd(targetLength, padString).
          // There was previously no case for this IL node type at all, so
          // every padStart/padEnd call fell through to the generic default
          // handler instead of emitting a real call.
          const str = this.transformExpression(node.string || node.value);
          const args = [];
          if (node.targetLength) args.push(this.transformExpression(node.targetLength));
          if (node.padString) args.push(this.transformExpression(node.padString));
          const methodName = node.method === 'padEnd' ? 'padEnd' : 'padStart';
          return new JavaScriptCall(str, methodName, args);
        }

        case 'ArrayFindIndex': {
          // IL AST: array.findIndex(callback) → JavaScript: array.findIndex(callback)
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          return new JavaScriptCall(array, 'findIndex', callback ? [callback] : []);
        }

        case 'ArrayLastIndexOf': {
          // IL AST: array.lastIndexOf(value) → JavaScript: array.lastIndexOf(value)
          const array = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new JavaScriptCall(array, 'lastIndexOf', [value]);
        }

        default:
          console.warn(`Unhandled expression type: ${node.type}`);
          return new JavaScriptIdentifier(`/* ${node.type} */`);
      }
    }

    transformLiteral(node) {
      // Handle regex literals
      if (node.regex) {
        return JavaScriptLiteral.Regex(node.regex.pattern, node.regex.flags);
      }
      if (typeof node.value === 'number') {
        return JavaScriptLiteral.Number(node.value);
      } else if (typeof node.value === 'string') {
        return JavaScriptLiteral.String(node.value);
      } else if (typeof node.value === 'boolean') {
        return JavaScriptLiteral.Boolean(node.value);
      } else if (node.value === null) {
        return JavaScriptLiteral.Null();
      } else if (node.value === undefined) {
        return JavaScriptLiteral.Undefined();
      } else if (typeof node.value === 'bigint') {
        return JavaScriptLiteral.BigInt(node.value);
      } else if (node.value instanceof RegExp) {
        return JavaScriptLiteral.Regex(node.value.source, node.value.flags);
      }
      return JavaScriptLiteral.Number(0);
    }

    transformIdentifier(node) {
      return new JavaScriptIdentifier(node.name);
    }

    transformBinaryExpression(node) {
      // type-aware-transpiler.js inlines OpCodes.Mul32(a, b) to a plain
      // `(a * b) & 0xFFFFFFFF` — a BinaryExpression '*' immediately wrapped
      // in a '&' mask — to emulate 32-bit overflow. That's exactly correct
      // C-style semantics for *small* operands, but JS's `*` operates on
      // 64-bit floats: once either 32-bit operand is large enough that
      // their true product exceeds 2^53 (Number.MAX_SAFE_INTEGER), the
      // product is already rounded to the nearest representable double
      // *before* the mask is ever applied — silently corrupting the low
      // bits of the result (observed as wrong PRNG output in
      // random/philox.js and friends, which multiply two full 32-bit words
      // together every round). `Math.imul(a, b)` is JS's dedicated
      // correct-32-bit-integer multiply — it never round-trips through a
      // lossy intermediate float. Only swap to it in this exact
      // `(a * b) & mask` shape (rather than for every multiplication
      // resultType-tagged 'uint32'/'int32', which regressed 18 other
      // passing algorithms — the type tag alone doesn't reliably mean "this
      // multiply must wrap/truncate", only the literal masking pattern
      // OpCodes.Mul32 itself produces does).
      if (node.operator === '&' && node.left && node.left.type === 'BinaryExpression' && node.left.operator === '*' &&
          node.right && node.right.type === 'Literal' && typeof node.right.value === 'number' &&
          (node.right.value === 0xFFFFFFFF || node.right.value === 0xFFFF || node.right.value === 0xFF)) {
        const mulLeft = this.transformExpression(node.left.left);
        const mulRight = this.transformExpression(node.left.right);
        const mul = new JavaScriptCall(new JavaScriptIdentifier('Math'), 'imul', [mulLeft, mulRight]);
        const mask = this.transformExpression(node.right);
        return new JavaScriptBinaryExpression(mul, '&', mask);
      }
      // Same IL-level "simulate 32-bit overflow with a full mask" idiom as
      // the Mul32 case above, but for the other inlined OpCodes 32-bit
      // helpers (Xor32, Or32, Add32, Sub32, Shl32, Shr32, ...): the IL
      // represents "reinterpret as unsigned 32-bit" as `(expr) &
      // 0xFFFFFFFF`, which is exactly correct in languages with a native
      // unsigned integer type but wrong in JavaScript — `&` ToInt32-coerces
      // both operands, so a value whose bit 31 is set comes back as a
      // *negative* signed number instead of the intended unsigned
      // magnitude. That silently corrupts any later arithmetic that treats
      // the result as a plain unsigned integer (e.g. `1099087573 * s0` in
      // random/xorwow.js's seed derivation, where `s0` must be the actual
      // unsigned value for the lossy-but-verified float multiply to land on
      // the same rounded result as the original). `>>> 0` is JavaScript's
      // real "reinterpret as unsigned 32-bit" operator and always yields
      // the value this masking idiom intends.
      //
      // The exact same `(expr) & 0xFFFFFFFF` shape also occurs verbatim in
      // hand-written algorithm source that never touched OpCodes at all
      // (e.g. a key-dependent PRNG seed mix in block/grand-cru.js), where
      // the *signed* wraparound is the actual, already-verified-correct
      // behavior of the untranspiled original — rewriting that to `>>> 0`
      // would change its numeric value the moment the top bit is set,
      // diverging from the original's own arithmetic. type-aware-
      // transpiler.js normalizes both cases to an identical-looking IL
      // BinaryExpression with no surviving provenance flag of its own, but
      // its inlining path (`_transformOpCodesCall`) is the only place that
      // stamps a `bigint` property onto the *inner* (masked) expression —
      // present (true or false) only on OpCodes-inlined operations, never
      // added by the generic BinaryExpression path a hand-written `&
      // 0xffffffff` goes through. Use that as the provenance signal instead
      // of the mask shape alone.
      if (node.operator === '&' && node.right && node.right.type === 'Literal' &&
          node.right.value === 0xFFFFFFFF &&
          node.left && node.left.type === 'BinaryExpression' &&
          Object.prototype.hasOwnProperty.call(node.left, 'bigint')) {
        const left = this.transformExpression(node.left);
        return new JavaScriptBinaryExpression(left, '>>>', JavaScriptLiteral.Number(0));
      }
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);
      return new JavaScriptBinaryExpression(left, node.operator, right);
    }

    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new JavaScriptUnaryExpression(node.operator, operand, node.prefix);
    }

    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new JavaScriptUnaryExpression(node.operator, operand, node.prefix);
    }

    transformAssignmentExpression(node) {
      const target = this.transformExpression(node.left);
      const value = this.transformExpression(node.right);
      return new JavaScriptAssignment(target, node.operator, value);
    }

    transformMemberExpression(node) {
      const target = this.transformExpression(node.object);
      const member = node.property.name || node.property.value;

      if (node.computed) {
        const index = this.transformExpression(node.property);
        return new JavaScriptElementAccess(target, index);
      }

      const access = new JavaScriptMemberAccess(target, member);
      access.isOptional = node.optional || false;
      return access;
    }

    transformCallExpression(node) {
      if (node.callee.type === 'MemberExpression') {
        const target = this.transformExpression(node.callee.object);
        const methodName = node.callee.property.name;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        return new JavaScriptCall(target, methodName, args);
      } else if (node.callee.type === 'FunctionExpression' || node.callee.type === 'ArrowFunctionExpression' || node.callee.type === 'ArrowFunction') {
        // IIFE: `(function(){...})()` / `(() => {...})()`. The callee is a
        // function *value*, not a named reference — `node.callee.name` is
        // always undefined here (even for a *named* FunctionExpression,
        // whose name lives under `node.callee.id.name`, not `.name`), so the
        // old code always fell back to the literal string 'fn', silently
        // discarding the entire function body and emitting a call to a
        // nonexistent bare identifier `fn(...)` ("ReferenceError: fn is not
        // defined" for value-position IIFEs like `seed: (function(){...})()`
        // in perk.js/pithy.js/isaac.js). Note the callee may already carry
        // the IL-shaped type name 'ArrowFunction' rather than the raw
        // ESTree 'ArrowFunctionExpression' — _transformCallExpression
        // (type-aware-transpiler.js) returns call expressions it doesn't
        // specially recognize (this IIFE shape included) unmodified except
        // for recursively IL-normalizing their sub-nodes, which is where an
        // arrow-function callee's type gets rewritten to 'ArrowFunction'
        // (see the `type: isArrow ? 'ArrowFunction' : 'FunctionExpression'`
        // IL node construction) even though the enclosing CallExpression
        // itself is left as raw/untransformed. Transform the callee itself
        // and call it directly via calleeExpression.
        const args = node.arguments.map(arg => this.transformExpression(arg));
        const callee = this.transformExpression(node.callee);
        const call = new JavaScriptCall(null, null, args);
        call.calleeExpression = callee;
        return call;
      } else {
        const methodName = node.callee.name || 'fn';
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new JavaScriptCall(null, methodName, args);
      }
    }

    transformNewExpression(node) {
      const className = this.resolveConstructorName(node.callee);
      const args = node.arguments ? node.arguments.map(arg => this.transformExpression(arg)) : [];
      return new JavaScriptNew(className, args);
    }

    /**
     * Resolve the constructor name for `new X(...)`. `X` is usually a bare
     * Identifier, but algorithm sources also commonly write
     * `new AlgorithmFramework.KeySize(...)` (a MemberExpression) — take the
     * rightmost property name in that case, since the standalone prelude
     * destructures every framework export to a bare identifier of that same
     * name. Silently falling back to `node.callee.name` (undefined here)
     * previously produced `new undefined(...)`.
     *
     * Any *other* qualifier is a genuine object reference, not a framework
     * re-export — e.g. `new SHA256Module.SHA2_256Algorithm()`, where
     * `SHA256Module` is a UMD factory parameter (a dependency module bundled
     * in by test harnesses as a real `require()`d object). Collapsing that
     * down to the bare property name the same way produces `new
     * SHA2_256Algorithm(...)`, which nothing defines ("SHA2_256Algorithm is
     * not defined") — only the AlgorithmFramework qualifier specifically is
     * safe to drop.
     */
    resolveConstructorName(callee) {
      if (!callee) return 'Object';
      if (callee.name) return callee.name;
      if (callee.type === 'MemberExpression' && !callee.computed && callee.property) {
        const propName = callee.property.name || callee.property.value;
        if (!propName) return this.resolveConstructorName(callee.object);
        if (callee.object && callee.object.type === 'Identifier') {
          if (callee.object.name === 'AlgorithmFramework') return propName;
          return `${callee.object.name}.${propName}`;
        }
        const objectName = this.resolveConstructorName(callee.object);
        return objectName && objectName !== 'Object' ? `${objectName}.${propName}` : propName;
      }
      return 'Object';
    }

    transformArrayExpression(node) {
      const elements = node.elements.map(el => el ? this.transformExpression(el) : JavaScriptLiteral.Undefined());
      return new JavaScriptArrayLiteral(elements);
    }

    transformObjectExpression(node) {
      const obj = new JavaScriptObjectLiteral();
      for (const prop of node.properties) {
        const key = this.resolveObjectKey(prop.key);
        const value = this.transformExpression(prop.value);
        const propEntry = { key, value };
        // See the 'ObjectLiteral' case above: preserve get/set accessor kind.
        if (prop.kind === 'get' || prop.kind === 'set') propEntry.kind = prop.kind;
        obj.properties.push(propEntry);
      }
      return obj;
    }

    /**
     * Resolve an object-literal property key node down to its plain
     * key value (a string for identifier/string keys, a number for numeric
     * keys). `key.name || key.value || key` breaks for any *falsy-but-valid*
     * key — `{0: 'x'}`, `{'': 'y'}`, `{false: 'z'}` — since `0`/`''`/`false`
     * are all falsy, `||` skips past the real key value straight to the next
     * fallback, eventually returning the raw AST *node* object itself
     * (`prop.key`) as the "key" when both `.name` and `.value` are falsy.
     * The emitter's formatObjectKey() then calls `.replace()` on that object
     * and throws ("key.replace is not a function") since it's never a
     * string. Use explicit `undefined` checks instead so a falsy key value
     * is honored rather than skipped.
     */
    resolveObjectKey(key, fallback = 'key') {
      if (key === undefined || key === null) return fallback;
      // `prop.key` is sometimes already the resolved primitive (a plain
      // string/number), not an AST node with `.name`/`.value` to unwrap —
      // return it as-is rather than falling through to the two `undefined`
      // property reads below and landing on `fallback`.
      if (typeof key === 'string') {
        // A bare (unquoted) object-literal key that looks like a
        // binary/octal/hex numeral (`{0b00: x}`) is only valid JS syntax
        // when it IS a numeral literal — real JS evaluates `0b00` to the
        // number 0 and stringifies *that* to the property key "0", never
        // keeping the "0b00" source spelling as the literal key text. The
        // IL layer here has already collapsed the key down to its raw
        // source text, skipping that evaluation step — ecc/bicycle-code.js's
        // `{0b00: [...], 0b01: [...], 0b10: [...], 0b11: [...]}` codeword
        // table ended up keyed by the strings "0b00"/"0b01"/... instead of
        // "0"/"1"/..., so looking it up by any actual computed numeric
        // state ("Invalid logical state: 0") always missed.
        const numeralLiteral = key.match(/^0[bB][01]+$|^0[oO][0-7]+$|^0[xX][0-9a-fA-F]+$/);
        if (numeralLiteral) return String(Number(key));
        return key;
      }
      if (typeof key === 'number') return key;
      if (key.name !== undefined) return key.name;
      if (key.value !== undefined) return key.value;
      return fallback;
    }

    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const trueExpr = this.transformExpression(node.consequent);
      const falseExpr = this.transformExpression(node.alternate);
      return new JavaScriptConditional(condition, trueExpr, falseExpr);
    }

    transformArrowFunctionExpression(node, isFunctionExpression = false) {
      this.pushScope();

      const params = node.params.map(p => this.transformParameter(p));

      const body = node.body.type === 'BlockStatement' ?
        this.transformFunctionBody(node.body) :
        this.transformExpression(node.body);

      this.popScope();

      const fn = new JavaScriptArrowFunction(params, body);
      fn.isFunctionExpression = isFunctionExpression;
      return fn;
    }

    transformThisExpression(node) {
      return new JavaScriptThis();
    }

    transformTemplateLiteral(node) {
      const template = new JavaScriptTemplateLiteral();
      for (let i = 0; i < node.quasis.length; i++) {
        const text = node.quasis[i].value.raw || node.quasis[i].value.cooked;
        const expression = i < node.expressions.length ? this.transformExpression(node.expressions[i]) : null;
        template.parts.push({ text, expression });
      }
      return template;
    }

    transformSequenceExpression(node) {
      // A comma expression `a, b, c` evaluates *every* operand for its side
      // effects and yields only the last one's value — collapsing straight
      // to the last expression (discarding the rest) silently dropped every
      // earlier operand's side effect. That's fatal in the single most
      // common place a raw SequenceExpression shows up: a for-loop's update
      // clause with multiple counters, e.g. `for (let r = 0, k = 0; r < N;
      // r++, k += 16)` — dropping `r++` left `r` permanently 0, so `r < N`
      // never became false (an infinite loop, observed as the body's array
      // accumulator blowing past Array's max length). Preserve every
      // expression via a real SequenceExpression node; the emitter already
      // joins them with commas.
      if (node.expressions.length === 0) return JavaScriptLiteral.Undefined();
      const expressions = node.expressions.map(e => this.transformExpression(e));
      return expressions.length === 1 ? expressions[0] : new JavaScriptSequenceExpression(expressions);
    }
  }

  // Export
  const exports = { JavaScriptTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.JavaScriptTransformer = JavaScriptTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
