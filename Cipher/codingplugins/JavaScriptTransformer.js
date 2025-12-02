/**
 * JavaScriptTransformer.js - IL AST to JavaScript AST Transformer
 * Converts intermediate language AST to JavaScript AST (mostly pass-through with type stripping)
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: IL AST -> JS Transformer -> JS AST -> JS Emitter -> JS Source
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
    JavaScriptClass, JavaScriptProperty, JavaScriptMethod, JavaScriptConstructor,
    JavaScriptParameter, JavaScriptBlock, JavaScriptVariableDeclaration,
    JavaScriptExpressionStatement, JavaScriptReturn, JavaScriptIf, JavaScriptFor,
    JavaScriptForOf, JavaScriptWhile, JavaScriptDoWhile, JavaScriptSwitch,
    JavaScriptSwitchCase, JavaScriptBreak, JavaScriptContinue, JavaScriptThrow,
    JavaScriptTryCatch, JavaScriptCatchClause, JavaScriptLiteral, JavaScriptIdentifier,
    JavaScriptBinaryExpression, JavaScriptUnaryExpression, JavaScriptAssignment,
    JavaScriptMemberAccess, JavaScriptElementAccess, JavaScriptCall, JavaScriptNew,
    JavaScriptArrayLiteral, JavaScriptObjectLiteral, JavaScriptConditional,
    JavaScriptArrowFunction, JavaScriptThis, JavaScriptSuper, JavaScriptParenthesized,
    JavaScriptTemplateLiteral, JavaScriptJSDoc
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

    // ========================[ FUNCTION TRANSFORMATION ]========================

    transformFunctionDeclaration(node) {
      const method = new JavaScriptMethod(node.id.name);

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
      const statements = node.body.map(stmt => this.transformStatement(stmt));

      // Return a simple object representing the static block
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

        case 'SpreadElement':
          return this.transformExpression(node.argument);

        case 'Super':
          return new JavaScriptSuper();

        case 'ObjectPattern':
          // Object destructuring - keep as-is in JavaScript
          // This is a valid JavaScript pattern
          return new JavaScriptIdentifier('/* Object destructuring pattern */');

        default:
          console.warn(`Unhandled expression type: ${node.type}`);
          return new JavaScriptIdentifier(`/* ${node.type} */`);
      }
    }

    transformLiteral(node) {
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
