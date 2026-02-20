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
      return callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression';
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
        jsClass.baseClass = new JavaScriptIdentifier(node.superClass.name);
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

      staticBlock.body = block;
      return staticBlock;
    }

    transformClassExpression(node) {
      // ClassExpression -> anonymous class in JavaScript
      const classDecl = new JavaScriptClass(node.id?.name || 'AnonymousClass');

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

      // Transform parameters (strip type annotations)
      if (node.value.params) {
        for (const param of node.value.params) {
          const jsParam = new JavaScriptParameter(param.name);
          method.parameters.push(jsParam);
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
      const name = node.name || (node.type === 'Identifier' ? node.name : 'param');
      return new JavaScriptParameter(name);
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
      const varName = node.left.declarations ? node.left.declarations[0].id.name : 'item';
      const collection = this.transformNode(node.right);
      const body = this.transformNode(node.body);
      return new JavaScriptForOf(varName, collection, body);
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
        case 'FunctionExpression':
          return this.transformArrowFunctionExpression(node);

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
          // IL AST: string to bytes → JavaScript: new TextEncoder().encode(string)
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          const encoder = new JavaScriptNew('TextEncoder', []);
          return new JavaScriptCall(encoder, 'encode', [value]);
        }

        case 'BytesToString': {
          // IL AST: bytes to string → JavaScript: new TextDecoder().decode(bytes)
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          const decoder = new JavaScriptNew('TextDecoder', []);
          return new JavaScriptCall(decoder, 'decode', [value]);
        }

        case 'HexDecode': {
          // IL AST: hex string to bytes → JavaScript: helper function call
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          return new JavaScriptCall(null, 'hexToBytes', [value]);
        }

        case 'HexEncode': {
          // IL AST: bytes to hex string → JavaScript: helper function call
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          return new JavaScriptCall(null, 'bytesToHex', [value]);
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
          // IL AST: array.concat(other) → JavaScript: array.concat(other)
          const array = this.transformExpression(node.array);
          const other = this.transformExpression(node.other);
          return new JavaScriptCall(array, 'concat', [other]);
        }

        case 'ArrayAppend': {
          // IL AST: array.push(value) → JavaScript: array.push(value)
          const array = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new JavaScriptCall(array, 'push', [value]);
        }

        case 'ArrayReverse': {
          // IL AST: array.reverse() → JavaScript: array.reverse()
          const array = this.transformExpression(node.array);
          return new JavaScriptCall(array, 'reverse', []);
        }

        case 'ArrayFill': {
          // IL AST: array.fill(value) → JavaScript: array.fill(value)
          const array = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new JavaScriptCall(array, 'fill', [value]);
        }

        case 'ArrayClear': {
          // IL AST: clear array → JavaScript: array.splice(0)
          const array = this.transformExpression(node.array || node.arguments?.[0]);
          return new JavaScriptCall(array, 'splice', [JavaScriptLiteral.Number(0)]);
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

          // Use helper functions for unpacking
          const funcName = bits === 16 ? (isBigEndian ? 'unpack16BE' : 'unpack16LE') :
                           bits === 64 ? (isBigEndian ? 'unpack64BE' : 'unpack64LE') :
                                         (isBigEndian ? 'unpack32BE' : 'unpack32LE');

          return new JavaScriptCall(null, funcName, [value]);
        }

        // Pack bytes - convert byte array to integer
        case 'PackBytes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          const bits = node.bits || 32;
          const isBigEndian = node.endian === 'big' || node.bigEndian;

          const funcName = bits === 16 ? (isBigEndian ? 'pack16BE' : 'pack16LE') :
                           bits === 64 ? (isBigEndian ? 'pack64BE' : 'pack64LE') :
                                         (isBigEndian ? 'pack32BE' : 'pack32LE');

          return new JavaScriptCall(null, funcName, args);
        }

        // Bit rotation operations
        case 'Rotation': {
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const bits = node.bits || 32;
          const direction = node.direction || 'left';

          const funcName = direction === 'left' ? `rotl${bits}` : `rotr${bits}`;
          return new JavaScriptCall(null, funcName, [value, amount]);
        }

        // Math function calls
        case 'MathCall': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          const method = node.method;

          // Map to JavaScript Math methods
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), method),
            null,
            args
          );
        }

        // Individual math operations as IL nodes
        case 'Floor': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'floor'),
            null,
            [value]
          );
        }

        case 'Ceil': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'ceil'),
            null,
            [value]
          );
        }

        case 'Round': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'round'),
            null,
            [value]
          );
        }

        case 'Abs': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'abs'),
            null,
            [value]
          );
        }

        case 'Min': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'min'),
            null,
            args
          );
        }

        case 'Max': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'max'),
            null,
            args
          );
        }

        // Bit rotation operations
        case 'RotateLeft': {
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const bits = node.bits || 32;
          return new JavaScriptCall(null, `rotl${bits}`, [value, amount]);
        }

        case 'RotateRight': {
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const bits = node.bits || 32;
          return new JavaScriptCall(null, `rotr${bits}`, [value, amount]);
        }

        // OpCodes method calls
        case 'OpCodesCall': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          // Handle specific OpCodes methods
          switch (node.method) {
            case 'CopyArray':
              return new JavaScriptCall(args[0], 'slice', []);
            case 'ClearArray':
              return new JavaScriptCall(args[0], 'splice', [JavaScriptLiteral.Number(0)]);
            default:
              return new JavaScriptCall(null, node.method, args);
          }
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
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'pow'),
            null,
            [base, exponent]
          );
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
          // IL AST: XOR two arrays → JavaScript: helper function or inline
          const arr1 = this.transformExpression(node.array1 || node.arguments?.[0]);
          const arr2 = this.transformExpression(node.array2 || node.arguments?.[1]);
          // Use a helper function for XOR
          return new JavaScriptCall(null, 'xorArrays', [arr1, arr2]);
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
          // IL AST: string.substring(start, end) → JavaScript: string.substring(start, end)
          const str = this.transformExpression(node.string || node.value);
          const args = [];
          if (node.start) args.push(this.transformExpression(node.start));
          if (node.end) args.push(this.transformExpression(node.end));
          return new JavaScriptCall(str, 'substring', args);
        }

        case 'StringIndexOf': {
          // IL AST: string.indexOf(search) → JavaScript: string.indexOf(search)
          const str = this.transformExpression(node.string || node.value);
          const search = node.search ? this.transformExpression(node.search) : null;
          return new JavaScriptCall(str, 'indexOf', search ? [search] : []);
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
          // IL AST: template string → JavaScript: template literal
          const template = new JavaScriptTemplateLiteral();
          if (node.quasis && node.expressions) {
            for (let i = 0; i < node.quasis.length; ++i) {
              const text = node.quasis[i] || '';
              const expression = i < node.expressions.length ? this.transformExpression(node.expressions[i]) : null;
              template.parts.push({ text, expression });
            }
          } else if (node.parts) {
            for (const part of node.parts) {
              template.parts.push({
                text: part.text || '',
                expression: part.expression ? this.transformExpression(part.expression) : null
              });
            }
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
              if (prop.type === 'SpreadElement') {
                // Spread in object literal: {...other}
                const spreadArg = this.transformExpression(prop.argument);
                obj.properties.push({ key: '...', value: spreadArg, spread: true });
              } else {
                const key = prop.key?.name || prop.key?.value || prop.key || 'key';
                const value = this.transformExpression(prop.value);
                obj.properties.push({ key, value });
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
          const dataView = this.transformExpression(node.dataView || node.object || node.target);
          const method = node.method || 'getUint8';
          const args = [];
          if (node.offset !== undefined) args.push(this.transformExpression(node.offset));
          else if (node.arguments?.[0]) args.push(this.transformExpression(node.arguments[0]));
          if (node.littleEndian !== undefined) args.push(JavaScriptLiteral.Boolean(node.littleEndian));
          else if (node.arguments?.[1]) args.push(this.transformExpression(node.arguments[1]));
          return new JavaScriptCall(dataView, method, args);
        }

        case 'DataViewWrite': {
          // IL AST: dataView.setXxx(offset, value, littleEndian) → JavaScript: dataView.setXxx(...)
          const dataView = this.transformExpression(node.dataView || node.object || node.target);
          const method = node.method || 'setUint8';
          const args = [];
          if (node.offset !== undefined) args.push(this.transformExpression(node.offset));
          else if (node.arguments?.[0]) args.push(this.transformExpression(node.arguments[0]));
          if (node.value !== undefined) args.push(this.transformExpression(node.value));
          else if (node.arguments?.[1]) args.push(this.transformExpression(node.arguments[1]));
          if (node.littleEndian !== undefined) args.push(JavaScriptLiteral.Boolean(node.littleEndian));
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
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          const objectObj = new JavaScriptIdentifier('Object');
          return new JavaScriptCall(objectObj, 'assign', args);
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
          const obj = this.transformExpression(node.object);
          const key = this.transformExpression(node.key);
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
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          const stringObj = new JavaScriptIdentifier('String');
          return new JavaScriptCall(stringObj, 'fromCharCode', args);
        }

        case 'StringFromCodePoints': {
          // IL AST: String.fromCodePoint(...codes) → JavaScript: String.fromCodePoint(...)
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
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
          // IL AST: JSON.stringify(obj) → JavaScript: JSON.stringify(obj)
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          if (args.length === 0 && node.value) args.push(this.transformExpression(node.value));
          const jsonObj = new JavaScriptIdentifier('JSON');
          return new JavaScriptCall(jsonObj, 'stringify', args);
        }

        case 'JsonDeserialize': {
          // IL AST: JSON.parse(str) → JavaScript: JSON.parse(str)
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          if (args.length === 0 && node.value) args.push(this.transformExpression(node.value));
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

        case 'Log': {
          // IL AST: Math.log(x) → JavaScript: Math.log(x)
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'log'),
            null,
            [value]
          );
        }

        case 'Log2': {
          // IL AST: Math.log2(x) → JavaScript: Math.log2(x)
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'log2'),
            null,
            [value]
          );
        }

        case 'Log10': {
          // IL AST: Math.log10(x) → JavaScript: Math.log10(x)
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'log10'),
            null,
            [value]
          );
        }

        case 'Random': {
          // IL AST: Math.random() → JavaScript: Math.random()
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'random'),
            null,
            []
          );
        }

        case 'Sin': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'sin'),
            null,
            [value]
          );
        }

        case 'Cos': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'cos'),
            null,
            [value]
          );
        }

        case 'Tan': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'tan'),
            null,
            [value]
          );
        }

        case 'Asin': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'asin'),
            null,
            [value]
          );
        }

        case 'Acos': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'acos'),
            null,
            [value]
          );
        }

        case 'Atan': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'atan'),
            null,
            [value]
          );
        }

        case 'Atan2': {
          const y = this.transformExpression(node.arguments?.[0] || node.y);
          const x = this.transformExpression(node.arguments?.[1] || node.x);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'atan2'),
            null,
            [y, x]
          );
        }

        case 'Exp': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'exp'),
            null,
            [value]
          );
        }

        case 'Sign': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'sign'),
            null,
            [value]
          );
        }

        case 'Trunc': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'trunc'),
            null,
            [value]
          );
        }

        case 'Sqrt': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'sqrt'),
            null,
            [value]
          );
        }

        case 'Sinh': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'sinh'),
            null,
            [value]
          );
        }

        case 'Cosh': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'cosh'),
            null,
            [value]
          );
        }

        case 'Tanh': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'tanh'),
            null,
            [value]
          );
        }

        case 'Cbrt': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'cbrt'),
            null,
            [value]
          );
        }

        case 'Hypot': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'hypot'),
            null,
            args
          );
        }

        case 'Fround': {
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          return new JavaScriptCall(
            new JavaScriptMemberAccess(new JavaScriptIdentifier('Math'), 'fround'),
            null,
            [value]
          );
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
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.search);
          const replacement = this.transformExpression(node.replacement);
          return new JavaScriptCall(str, 'replace', [search, replacement]);
        }

        case 'StringCharAt': {
          // IL AST: string.charAt(index) → JavaScript: string.charAt(index)
          const str = this.transformExpression(node.string || node.value);
          const index = this.transformExpression(node.index);
          return new JavaScriptCall(str, 'charAt', [index]);
        }

        case 'StringIncludes': {
          // IL AST: string.includes(search) → JavaScript: string.includes(search)
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.search);
          return new JavaScriptCall(str, 'includes', [search]);
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
          const str = this.transformExpression(node.string || node.value);
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          return new JavaScriptCall(str, 'concat', args);
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
      } else {
        const methodName = node.callee.name || 'fn';
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new JavaScriptCall(null, methodName, args);
      }
    }

    transformNewExpression(node) {
      const className = node.callee.name;
      const args = node.arguments ? node.arguments.map(arg => this.transformExpression(arg)) : [];
      return new JavaScriptNew(className, args);
    }

    transformArrayExpression(node) {
      const elements = node.elements.map(el => el ? this.transformExpression(el) : JavaScriptLiteral.Undefined());
      return new JavaScriptArrayLiteral(elements);
    }

    transformObjectExpression(node) {
      const obj = new JavaScriptObjectLiteral();
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
      return new JavaScriptConditional(condition, trueExpr, falseExpr);
    }

    transformArrowFunctionExpression(node) {
      this.pushScope();

      const params = node.params.map(p => this.transformParameter(p));

      const body = node.body.type === 'BlockStatement' ?
        this.transformFunctionBody(node.body) :
        this.transformExpression(node.body);

      this.popScope();

      return new JavaScriptArrowFunction(params, body);
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
      // Return last expression
      return node.expressions.length > 0 ?
        this.transformExpression(node.expressions[node.expressions.length - 1]) :
        JavaScriptLiteral.Undefined();
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
