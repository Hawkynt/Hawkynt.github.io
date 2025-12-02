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
    PerlPOD, PerlComment
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
  class PerlTransformer {
    constructor(options = {}) {
      this.options = options;
      this.variableTypes = new Map();  // Maps variable name -> PerlType
      this.scopeStack = [];
      this.currentClass = null;
      this.inMethod = false;
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
              // Extract and process IIFE body content
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
              const indexExpr = new PerlSubscript(sourceExpr, PerlLiteral.Int(i));
              const varDecl = new PerlVarDeclaration('our', varName, '$', indexExpr);
              targetModule.statements.push(varDecl);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Check if this is an object literal defining a module/struct
        if (decl.init.type === 'ObjectExpression') {
          // Could be a constant hash or a class-like structure
          const varDecl = new PerlVarDeclaration(
            'our',
            name,
            '%',
            this.transformExpression(decl.init)
          );
          targetModule.statements.push(varDecl);
        }
        // Check if this is an IIFE
        else if (decl.init.type === 'CallExpression' &&
                 (decl.init.callee.type === 'FunctionExpression' ||
                  decl.init.callee.type === 'ArrowFunctionExpression')) {
          // Extract return value from IIFE
          const returnValue = this.getIIFEReturnValue(decl.init);
          if (returnValue) {
            const sigil = this.inferSigilFromValue(returnValue);
            const varDecl = new PerlVarDeclaration(
              'our',
              name,
              sigil,
              this.transformExpression(returnValue)
            );
            targetModule.statements.push(varDecl);
          }
        }
        // Handle simple literals and expressions as constants
        else if (decl.init.type === 'Literal' ||
                 decl.init.type === 'ArrayExpression' ||
                 decl.init.type === 'UnaryExpression' ||
                 decl.init.type === 'BinaryExpression' ||
                 decl.init.type === 'NewExpression') {
          const sigil = this.inferSigilFromValue(decl.init);
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
      const func = new PerlSub(funcName);
      func.useSignatures = this.options.addSignatures;

      // Parameters
      if (node.params) {
        for (const param of node.params) {
          const paramName = param.name;
          const sigil = this.inferSigilFromName(paramName);
          const perlParam = new PerlParameter(paramName, sigil);
          func.parameters.push(perlParam);
          this.registerVariableType(paramName, sigil);
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
    transformClassDeclaration(node, targetModule) {
      const className = node.id.name;
      const perlClass = new PerlClass(className, {
        useModernClass: this.options.useModernClass
      });

      // Handle superclass
      if (node.superClass) {
        perlClass.baseClass = node.superClass.name || this.transformExpression(node.superClass);
      }

      const prevClass = this.currentClass;
      this.currentClass = perlClass;

      // Handle both class body structures
      const members = node.body?.body || node.body || [];

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
          const paramName = param.name;
          const sigil = this.inferSigilFromName(paramName);
          ctor.parameters.push(new PerlParameter(paramName, sigil));
        }
      } else if (!this.options.useModernClass) {
        // No params, but still add $self
        ctor.parameters.push(new PerlParameter('self', '$'));
      }

      // Body
      if (node.value && node.value.body) {
        ctor.body = this.transformBlockStatement(node.value.body);
      }

      return ctor;
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
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = param.name;
          const sigil = this.inferSigilFromName(paramName);
          method.parameters.push(new PerlParameter(paramName, sigil));
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
      return node.body.map(stmt => this.transformStatement(stmt));
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

      // Perl foreach loop
      const body = this.transformStatement(node.body) || new PerlBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

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
     * Transform a switch statement to given/when
     */
    transformSwitchStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const given = new PerlGiven(discriminant);

      for (const caseNode of node.cases) {
        if (caseNode.test) {
          const pattern = this.transformExpression(caseNode.test);
          const whenBody = new PerlBlock();

          // Transform case body
          for (const stmt of caseNode.consequent) {
            const perlStmt = this.transformStatement(stmt);
            if (perlStmt) {
              if (Array.isArray(perlStmt)) {
                whenBody.statements.push(...perlStmt);
              } else {
                whenBody.statements.push(perlStmt);
              }
            }
          }

          given.whenClauses.push(new PerlWhen(pattern, whenBody));
        } else {
          // Default case
          const defaultBody = new PerlBlock();
          for (const stmt of caseNode.consequent) {
            const perlStmt = this.transformStatement(stmt);
            if (perlStmt) {
              if (Array.isArray(perlStmt)) {
                defaultBody.statements.push(...perlStmt);
              } else {
                defaultBody.statements.push(perlStmt);
              }
            }
          }
          given.defaultClause = defaultBody;
        }
      }

      return given;
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
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        case 'SequenceExpression':
          // Return the last expression in the sequence
          return this.transformExpression(node.expressions[node.expressions.length - 1]);

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
      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // Map operators
      let operator = node.operator;
      if (operator === '===') operator = 'eq';  // String comparison
      if (operator === '!==') operator = 'ne';
      if (operator === '==') operator = '==';   // Numeric comparison
      if (operator === '!=') operator = '!=';

      // String concatenation
      if (operator === '+' && this.isStringContext(node.left, node.right)) {
        operator = '.';
      }

      // Logical operators
      if (operator === '&&') operator = '&&';
      if (operator === '||') operator = '||';

      // Unsigned right shift in Perl: use bitwise operations
      if (operator === '>>>') {
        operator = '>>';
      }

      return new PerlBinaryExpression(left, operator, right);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);

      let operator = node.operator;
      if (operator === '!') operator = '!';
      if (operator === 'typeof') {
        // Perl ref() or blessed()
        return new PerlCall(new PerlIdentifier('ref'), [operand]);
      }

      return new PerlUnaryExpression(operator, operand);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      // Map compound assignments
      let operator = node.operator;
      if (operator === '+=' && this.isStringContext(node.left, node.right)) {
        operator = '.=';  // String concatenation assignment
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
      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Array/hash indexing
        const index = this.transformExpression(node.property);
        const subscriptType = this.isArrayContext(node.object) ? 'array' : 'hash';
        return new PerlSubscript(object, index, subscriptType);
      } else {
        // Object method or field access
        const member = node.property.name || node.property.value;

        // Handle special properties
        if (member === 'length') {
          // @array in scalar context or length($string)
          return new PerlUnaryExpression('scalar', object);
        }

        // Method call or field access
        return new PerlMemberAccess(object, member, '->');
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

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        const call = new PerlCall(new PerlIdentifier(method), args);
        call.isMethodCall = true;

        // Create method call: $object->method(@args)
        return new PerlMemberAccess(object, call, '->');
      }

      // Regular function call
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

      // Map OpCodes methods to Perl equivalents
      // Most crypto operations would use Perl modules like Crypt::* or Digest::*

      // For now, create a function call with the method name
      return new PerlCall(new PerlIdentifier(methodName), args);
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
        const value = this.transformExpression(prop.value);
        pairs.push({ key, value });
      }

      return new PerlHash(pairs);
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      if (node.callee.type === 'Identifier') {
        const typeName = node.callee.name;
        const args = node.arguments.map(arg => this.transformExpression(arg));

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
      const condition = this.transformExpression(node.test);
      const consequent = this.transformExpression(node.consequent);
      const alternate = this.transformExpression(node.alternate);

      return new PerlConditional(condition, consequent, alternate);
    }

    /**
     * Transform a function expression to Perl anonymous subroutine
     */
    transformFunctionExpression(node) {
      // Map parameters
      const params = node.params ? node.params.map(p => {
        const paramName = p.name;
        const sigil = this.inferSigilFromName(paramName);
        return new PerlParameter(paramName, sigil);
      }) : [];

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

      return new PerlAnonSub(params, body);
    }

    /**
     * Transform spread element: ...array
     */
    transformSpreadElement(node) {
      // In Perl, array flattening is automatic: @array
      return this.transformExpression(node.argument);
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
     */
    inferSigilFromName(name) {
      if (!name) return '$';

      const lowerName = name.toLowerCase();

      // Array-related names
      if (lowerName.includes('array') || lowerName.includes('list') ||
          lowerName.endsWith('s') && lowerName.length > 3) {
        return '@';
      }

      // Hash-related names
      if (lowerName.includes('hash') || lowerName.includes('map') ||
          lowerName.includes('dict') || lowerName.includes('object')) {
        return '%';
      }

      // Default to scalar
      return '$';
    }

    /**
     * Infer sigil from value expression
     */
    inferSigilFromValue(valueNode) {
      if (!valueNode) return '$';

      switch (valueNode.type) {
        case 'ArrayExpression':
          return '@';
        case 'ObjectExpression':
          return '%';
        default:
          return '$';
      }
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
      return false;
    }

    /**
     * Check if expression is in array context
     */
    isArrayContext(node) {
      // Simple heuristic based on variable name
      if (node.type === 'Identifier') {
        return this.variableTypes.get(node.name) === '@';
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
