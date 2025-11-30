/**
 * JavaTransformer.js - JavaScript AST to Java AST Transformer
 * Converts type-annotated JavaScript AST to Java AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Java AST -> Java Emitter -> Java Source
 *
 * Java-specific transformations:
 * - uint8 -> byte (signed in Java, requires masking for unsigned semantics)
 * - uint32 -> int (requires Integer.toUnsignedLong() for unsigned operations)
 * - uint64 -> long (requires Long.compareUnsigned() etc.)
 * - byte[] -> byte[]
 * - Arrays are objects in Java (use .length not .length())
 * - camelCase for methods, UPPER_SNAKE_CASE for constants
 * - No properties - use getters/setters
 */

(function(global) {
  'use strict';

  // Load dependencies
  let JavaAST;
  if (typeof require !== 'undefined') {
    JavaAST = require('./JavaAST.js');
  } else if (global.JavaAST) {
    JavaAST = global.JavaAST;
  }

  const {
    JavaType, JavaCompilationUnit, JavaPackageDeclaration, JavaImportDeclaration,
    JavaClass, JavaInterface, JavaField, JavaMethod, JavaConstructor, JavaParameter,
    JavaBlock, JavaVariableDeclaration, JavaExpressionStatement, JavaReturn,
    JavaIf, JavaFor, JavaForEach, JavaWhile, JavaDoWhile, JavaSwitch, JavaSwitchCase,
    JavaBreak, JavaContinue, JavaThrow, JavaTryCatch, JavaCatchClause, JavaSynchronized,
    JavaLiteral, JavaIdentifier, JavaBinaryExpression, JavaUnaryExpression,
    JavaAssignment, JavaMemberAccess, JavaArrayAccess, JavaMethodCall,
    JavaObjectCreation, JavaArrayCreation, JavaCast, JavaConditional, JavaLambda,
    JavaThis, JavaSuper, JavaInstanceOf, JavaParenthesized, JavaDoc
  } = JavaAST;

  /**
   * Maps JavaScript/JSDoc types to Java types
   */
  const TYPE_MAP = {
    // Unsigned integers (Java doesn't have unsigned primitives until Java 8 wrapper helpers)
    'uint8': 'byte',      // Java byte is signed, use & 0xFF for unsigned
    'byte': 'byte',
    'uint16': 'short',    // Java short is signed, use & 0xFFFF for unsigned
    'ushort': 'short',
    'word': 'short',
    'uint32': 'int',      // Java int is signed, use Integer.toUnsignedLong() etc.
    'uint': 'int',
    'dword': 'int',
    'uint64': 'long',     // Java long is signed, use Long.compareUnsigned() etc.
    'ulong': 'long',
    'qword': 'long',

    // Signed integers
    'int8': 'byte',
    'sbyte': 'byte',
    'int16': 'short',
    'short': 'short',
    'int32': 'int',
    'int': 'int',
    'int64': 'long',
    'long': 'long',

    // Floating point
    'float': 'float',
    'float32': 'float',
    'double': 'double',
    'float64': 'double',
    'number': 'int',      // In crypto context, number typically means uint32

    // Other
    'boolean': 'boolean',
    'bool': 'boolean',
    'string': 'String',
    'String': 'String',
    'BigInt': 'BigInteger',
    'bigint': 'BigInteger',
    'void': 'void',
    'object': 'Object',
    'Object': 'Object',
    'any': 'Object'
  };

  /**
   * JavaScript AST to Java AST Transformer
   */
  class JavaTransformer {
    constructor(options = {}) {
      this.options = options;
      this.packageName = options.packageName || 'com.generated';
      this.className = options.className || 'GeneratedClass';
      this.typeKnowledge = options.typeKnowledge || null;
      this.currentClass = null;
      this.currentMethod = null;
      this.variableTypes = new Map();
      this.imports = new Set();
      this.warnings = [];
    }

    /**
     * Transform JavaScript AST to Java AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {JavaCompilationUnit} Java AST
     */
    transform(jsAst) {
      const cu = new JavaCompilationUnit();

      // Package declaration
      cu.packageDeclaration = new JavaPackageDeclaration(this.packageName);

      // Standard imports
      this.addImport('java.util.*');
      this.addImport('java.math.BigInteger');

      // Transform the program
      if (jsAst.type === 'Program') {
        const mainClass = this.transformProgram(jsAst);
        cu.types.push(mainClass);
      }

      // Add imports to compilation unit
      for (const imp of this.imports) {
        cu.imports.push(new JavaImportDeclaration(imp, false, imp.endsWith('*')));
      }

      return cu;
    }

    addImport(packageName) {
      this.imports.add(packageName);
    }

    /**
     * Transform Program node to Java class
     */
    transformProgram(node) {
      const javaClass = new JavaClass(this.className);
      javaClass.accessModifier = 'public';
      this.currentClass = javaClass;

      // Process all top-level declarations
      for (const stmt of node.body) {
        // Check for IIFE wrapper (UMD pattern) and extract content
        if (this.isIIFE(stmt)) {
          const extractedDecls = this.extractIIFEContent(stmt);
          for (const decl of extractedDecls) {
            if (decl.nodeType === 'Class') {
              javaClass.nestedTypes.push(decl);
            } else if (decl.nodeType === 'Method') {
              decl.isStatic = true;
              javaClass.members.push(decl);
            } else if (decl.nodeType === 'Field') {
              javaClass.members.push(decl);
            }
          }
        } else if (stmt.type === 'ClassDeclaration') {
          // Nested class
          const nestedClass = this.transformClassDeclaration(stmt);
          javaClass.nestedTypes.push(nestedClass);
        } else if (stmt.type === 'FunctionDeclaration') {
          // Static method
          const method = this.transformFunctionDeclaration(stmt);
          method.isStatic = true;
          javaClass.members.push(method);
        } else if (stmt.type === 'VariableDeclaration') {
          // Static field
          const fields = this.transformVariableDeclaration(stmt, true);
          javaClass.members.push(...fields);
        }
      }

      return javaClass;
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

      // Simple IIFE pattern
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
      if (node.type === 'ExpressionStatement') return null;
      if (node.type === 'IfStatement') return null;

      if (node.type === 'ClassDeclaration') {
        return this.transformClassDeclaration(node);
      }
      if (node.type === 'FunctionDeclaration') {
        return this.transformFunctionDeclaration(node);
      }
      if (node.type === 'VariableDeclaration') {
        return this.transformVariableDeclaration(node, true);
      }

      return null;
    }

    /**
     * Transform ClassDeclaration to JavaClass
     */
    transformClassDeclaration(node) {
      const javaClass = new JavaClass(node.id.name);
      javaClass.accessModifier = 'public';
      javaClass.isStatic = true; // Nested classes are static by default

      const prevClass = this.currentClass;
      this.currentClass = javaClass;

      // Handle extends clause first
      if (node.superClass) {
        if (node.superClass.type === 'Identifier') {
          javaClass.extendsClass = node.superClass.name;
        } else {
          javaClass.extendsClass = this.transformExpression(node.superClass).name;
        }
      }

      // Process class body - handle both ClassBody and unwrapped arrays
      let members = [];
      if (node.body) {
        if (node.body.type === 'ClassBody' && node.body.body) {
          members = node.body.body;
        } else if (Array.isArray(node.body)) {
          // Unwrapped UMD pattern - body is array directly
          members = node.body;
        }
      }

      for (const member of members) {
        try {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              const constructor = this.transformConstructor(member, javaClass.name);
              javaClass.members.push(constructor);
            } else if (member.kind === 'method') {
              const method = this.transformMethodDefinition(member);
              javaClass.members.push(method);
            } else if (member.kind === 'get') {
              // Getter method
              const getter = this.transformMethodDefinition(member);
              getter.name = 'get' + this.toPascalCase(getter.name);
              javaClass.members.push(getter);
            } else if (member.kind === 'set') {
              // Setter method
              const setter = this.transformMethodDefinition(member);
              setter.name = 'set' + this.toPascalCase(setter.name);
              javaClass.members.push(setter);
            }
          } else if (member.type === 'PropertyDefinition' || member.type === 'FieldDefinition') {
            const field = this.transformPropertyDefinition(member);
            javaClass.members.push(field);
          } else {
            // Unknown member type
            this.warnings.push(`Unknown class member type: ${member.type} in class ${javaClass.name}`);
          }
        } catch (error) {
          this.warnings.push(`Error transforming class member: ${error.message}`);
        }
      }

      this.currentClass = prevClass;
      return javaClass;
    }

    /**
     * Transform FunctionDeclaration to JavaMethod
     */
    transformFunctionDeclaration(node) {
      const returnType = this.inferReturnType(node);
      const method = new JavaMethod(this.toCamelCase(node.id.name), returnType);

      const prevMethod = this.currentMethod;
      this.currentMethod = method;

      // Parameters
      for (const param of node.params) {
        method.parameters.push(this.transformParameter(param));
      }

      // Body
      if (node.body) {
        method.body = this.transformBlockStatement(node.body);
      }

      this.currentMethod = prevMethod;
      return method;
    }

    /**
     * Transform MethodDefinition to JavaMethod
     */
    transformMethodDefinition(node) {
      const returnType = this.inferReturnType(node.value);
      const methodName = this.toCamelCase(node.key.name);
      const method = new JavaMethod(methodName, returnType);

      method.isStatic = node.static || false;

      const prevMethod = this.currentMethod;
      this.currentMethod = method;

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          method.parameters.push(this.transformParameter(param));
        }
      }

      // Body
      if (node.value && node.value.body) {
        method.body = this.transformBlockStatement(node.value.body);
      }

      this.currentMethod = prevMethod;
      return method;
    }

    /**
     * Transform constructor
     */
    transformConstructor(node, className) {
      const constructor = new JavaConstructor(className);

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          constructor.parameters.push(this.transformParameter(param));
        }
      }

      // Body
      if (node.value && node.value.body) {
        constructor.body = this.transformBlockStatement(node.value.body);
      }

      return constructor;
    }

    /**
     * Transform parameter
     */
    transformParameter(node) {
      const name = node.name || node.id?.name || 'param';
      const type = this.inferParameterType(name);
      return new JavaParameter(name, type);
    }

    /**
     * Transform PropertyDefinition to JavaField
     */
    transformPropertyDefinition(node) {
      const name = node.key.name;
      const type = this.inferPropertyType(node);
      const field = new JavaField(name, type);

      if (node.value) {
        field.initializer = this.transformExpression(node.value);
      }

      return field;
    }

    /**
     * Transform VariableDeclaration to JavaField[] or JavaVariableDeclaration[]
     */
    transformVariableDeclaration(node, isField = false) {
      const results = [];

      for (const declarator of node.declarations) {
        // Skip ObjectPattern destructuring (e.g., const { RegisterAlgorithm } = AlgorithmFramework)
        if (declarator.id.type === 'ObjectPattern')
          continue;

        // Skip ArrayPattern destructuring
        if (declarator.id.type === 'ArrayPattern')
          continue;

        const name = declarator.id.name;
        const type = this.inferVariableType(declarator);

        // Check if this is an IIFE (immediately invoked function expression)
        let initExpr = null;
        if (declarator.init) {
          if (declarator.init.type === 'CallExpression' &&
              (declarator.init.callee.type === 'FunctionExpression' ||
               declarator.init.callee.type === 'ArrowFunctionExpression')) {
            // Extract return value from IIFE
            const returnValue = this.getIIFEReturnValue(declarator.init);
            if (returnValue)
              initExpr = this.transformExpression(returnValue);
          } else {
            initExpr = this.transformExpression(declarator.init);
          }
        }

        if (isField) {
          const field = new JavaField(name, type);
          field.initializer = initExpr;
          field.isStatic = true; // Top-level variables are static
          results.push(field);
        } else {
          const varDecl = new JavaVariableDeclaration(name, type);
          varDecl.initializer = initExpr;
          // Track variable type
          this.variableTypes.set(name, type);
          results.push(varDecl);
        }
      }

      return results;
    }

    /**
     * Transform BlockStatement
     */
    transformBlockStatement(node) {
      const block = new JavaBlock();

      for (const stmt of node.body) {
        const transformed = this.transformStatement(stmt);
        if (Array.isArray(transformed)) {
          block.statements.push(...transformed);
        } else if (transformed) {
          block.statements.push(transformed);
        }
      }

      return block;
    }

    /**
     * Transform any statement
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        case 'BlockStatement':
          return this.transformBlockStatement(node);
        case 'VariableDeclaration':
          return this.transformVariableDeclaration(node, false);
        case 'ExpressionStatement':
          return new JavaExpressionStatement(this.transformExpression(node.expression));
        case 'ReturnStatement':
          return new JavaReturn(node.argument ? this.transformExpression(node.argument) : null);
        case 'IfStatement':
          return this.transformIfStatement(node);
        case 'ForStatement':
          return this.transformForStatement(node);
        case 'ForInStatement':
        case 'ForOfStatement':
          return this.transformForOfStatement(node);
        case 'WhileStatement':
          return this.transformWhileStatement(node);
        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);
        case 'SwitchStatement':
          return this.transformSwitchStatement(node);
        case 'BreakStatement':
          return new JavaBreak();
        case 'ContinueStatement':
          return new JavaContinue();
        case 'ThrowStatement':
          return new JavaThrow(this.transformExpression(node.argument));
        case 'TryStatement':
          return this.transformTryStatement(node);
        case 'ClassDeclaration':
          return this.transformClassDeclaration(node);
        case 'FunctionDeclaration':
          return this.transformFunctionDeclaration(node);
        default:
          this.warnings.push(`Unsupported statement type: ${node.type}`);
          return null;
      }
    }

    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent);
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;
      return new JavaIf(condition, thenBranch, elseBranch);
    }

    transformForStatement(node) {
      const forLoop = new JavaFor();

      if (node.init) {
        if (node.init.type === 'VariableDeclaration') {
          const decls = this.transformVariableDeclaration(node.init, false);
          forLoop.initializer = decls[0]; // Take first declaration
        } else {
          forLoop.initializer = this.transformExpression(node.init);
        }
      }

      if (node.test) {
        forLoop.condition = this.transformExpression(node.test);
      }

      if (node.update) {
        forLoop.incrementor = this.transformExpression(node.update);
      }

      forLoop.body = this.transformStatement(node.body);
      if (forLoop.body.nodeType !== 'Block') {
        const block = new JavaBlock();
        block.statements.push(forLoop.body);
        forLoop.body = block;
      }

      return forLoop;
    }

    transformForOfStatement(node) {
      const varName = node.left.declarations ? node.left.declarations[0].id.name : node.left.name;
      const varType = this.inferVariableType(node.left);
      const iterable = this.transformExpression(node.right);
      const body = this.transformStatement(node.body);

      const bodyBlock = body.nodeType === 'Block' ? body : (() => {
        const block = new JavaBlock();
        block.statements.push(body);
        return block;
      })();

      return new JavaForEach(varName, varType, iterable, bodyBlock);
    }

    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body);

      const bodyBlock = body.nodeType === 'Block' ? body : (() => {
        const block = new JavaBlock();
        block.statements.push(body);
        return block;
      })();

      return new JavaWhile(condition, bodyBlock);
    }

    transformDoWhileStatement(node) {
      const body = this.transformStatement(node.body);
      const condition = this.transformExpression(node.test);

      const bodyBlock = body.nodeType === 'Block' ? body : (() => {
        const block = new JavaBlock();
        block.statements.push(body);
        return block;
      })();

      return new JavaDoWhile(bodyBlock, condition);
    }

    transformSwitchStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const switchStmt = new JavaSwitch(discriminant);

      for (const caseNode of node.cases) {
        const javaCase = new JavaSwitchCase(
          caseNode.test ? this.transformExpression(caseNode.test) : null
        );

        for (const stmt of caseNode.consequent) {
          const transformed = this.transformStatement(stmt);
          if (Array.isArray(transformed)) {
            javaCase.statements.push(...transformed);
          } else if (transformed) {
            javaCase.statements.push(transformed);
          }
        }

        switchStmt.cases.push(javaCase);
      }

      return switchStmt;
    }

    transformTryStatement(node) {
      const tryStmt = new JavaTryCatch();
      tryStmt.tryBlock = this.transformBlockStatement(node.block);

      if (node.handler) {
        const exType = JavaType.Object(); // Could be more specific
        const exName = node.handler.param ? node.handler.param.name : 'e';
        const catchBody = this.transformBlockStatement(node.handler.body);
        tryStmt.catchClauses.push(new JavaCatchClause(exType, exName, catchBody));
      }

      if (node.finalizer) {
        tryStmt.finallyBlock = this.transformBlockStatement(node.finalizer);
      }

      return tryStmt;
    }

    /**
     * Transform any expression
     */
    transformExpression(node) {
      if (!node) return null;

      switch (node.type) {
        case 'Literal':
          return this.transformLiteral(node);
        case 'Identifier':
          return this.transformIdentifier(node);
        case 'BinaryExpression':
          return this.transformBinaryExpression(node);
        case 'LogicalExpression':
          return this.transformBinaryExpression(node); // Same handling
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
          return new JavaThis();
        case 'Super':
          return new JavaSuper();
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformLambdaExpression(node);
        case 'SequenceExpression':
          // Return last expression (comma operator)
          return this.transformExpression(node.expressions[node.expressions.length - 1]);
        case 'SpreadElement':
          // Spread in arrays/calls
          return this.transformExpression(node.argument);
        case 'TemplateLiteral':
          // `Hello ${name}!` -> "Hello " + name + "!"
          return this.transformTemplateLiteral(node);
        default:
          this.warnings.push(`Unsupported expression type: ${node.type}`);
          return new JavaIdentifier('/* unsupported: ' + node.type + ' */');
      }
    }

    /**
     * Transform template literal: `Hello ${name}!` -> "Hello " + name + "!"
     * Java uses string concatenation
     */
    transformTemplateLiteral(node) {
      const parts = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        const raw = node.quasis[i].value.raw;
        if (raw) {
          parts.push(JavaLiteral.String(raw));
        }
        if (i < node.expressions.length) {
          parts.push(this.transformExpression(node.expressions[i]));
        }
      }

      // Build concatenation expression: "a" + b + "c"
      if (parts.length === 0) return JavaLiteral.String('');
      if (parts.length === 1) return parts[0];

      let result = parts[0];
      for (let i = 1; i < parts.length; ++i) {
        result = new JavaBinaryExpression(result, '+', parts[i]);
      }
      return result;
    }

    transformLiteral(node) {
      if (node.value === null) return JavaLiteral.Null();
      if (typeof node.value === 'boolean') return JavaLiteral.Boolean(node.value);
      if (typeof node.value === 'string') return JavaLiteral.String(node.value);

      // Handle BigInt
      if (typeof node.value === 'bigint' || node.bigint) {
        const bigValue = typeof node.value === 'bigint' ? node.value : BigInt(node.bigint);
        return new JavaLiteral(`new BigInteger("${bigValue}")`, 'BigInteger');
      }

      if (typeof node.value === 'number') {
        const raw = node.raw || String(node.value);

        // Check for hex literals
        if (raw.startsWith('0x') || raw.startsWith('0X')) {
          return new JavaLiteral(`0x${node.value.toString(16).toUpperCase()}`, 'int');
        }

        if (Number.isInteger(node.value)) {
          if (node.value >= -2147483648 && node.value <= 2147483647) {
            return JavaLiteral.Int(node.value);
          } else {
            return JavaLiteral.Long(node.value);
          }
        }
        return JavaLiteral.Double(node.value);
      }
      return JavaLiteral.Null();
    }

    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript globals to Java equivalents
      if (name === 'undefined') return JavaLiteral.Null();
      if (name === 'NaN') return new JavaIdentifier('Double.NaN');
      if (name === 'Infinity') return new JavaIdentifier('Double.POSITIVE_INFINITY');

      // Convert naming conventions
      // Keep 'this' as-is, convert others to camelCase
      if (name !== 'this' && name !== 'super') {
        name = this.toCamelCase(name);
      }

      return new JavaIdentifier(name);
    }

    transformObjectExpression(node) {
      // Java doesn't have object literals - need to create a Map or custom class
      // For simple cases, use HashMap
      this.addImport('java.util.HashMap');
      this.addImport('java.util.Map');

      const creation = new JavaObjectCreation(new JavaType('HashMap<>'), []);

      // If there are properties, generate put() calls
      if (node.properties && node.properties.length > 0) {
        this.warnings.push('Object literals converted to HashMap - may need manual review');
      }

      return creation;
    }

    transformBinaryExpression(node) {
      let operator = node.operator;

      // Map JavaScript operators to Java
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';

      // Handle >>> 0 idiom (convert to unsigned int)
      if (operator === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
        const left = this.transformExpression(node.left);
        // In Java, need to mask with 0xFFFFFFFFL for unsigned behavior
        return new JavaBinaryExpression(left, '&', new JavaLiteral('0xFFFFFFFFL', 'long'));
      }

      // Handle unsigned operations using Integer.toUnsignedLong() etc.
      if (operator === '>>>') {
        const left = this.transformExpression(node.left);
        const right = this.transformExpression(node.right);
        // Java >>> works the same as JS for unsigned right shift
        return new JavaBinaryExpression(left, '>>>', right);
      }

      // Handle string equality (.equals() for objects)
      if ((operator === '==' || operator === '!=') && this.needsEqualsMethod(node.left, node.right)) {
        const left = this.transformExpression(node.left);
        const right = this.transformExpression(node.right);
        const equalsCall = new JavaMethodCall(left, 'equals', [right]);
        if (operator === '!=') {
          return new JavaUnaryExpression('!', equalsCall, true);
        }
        return equalsCall;
      }

      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      return new JavaBinaryExpression(left, operator, right);
    }

    /**
     * Check if comparison needs .equals() method instead of ==
     */
    needsEqualsMethod(leftNode, rightNode) {
      const leftType = this.inferExpressionType(leftNode);
      const rightType = this.inferExpressionType(rightNode);

      // Use .equals() for String, BigInteger, and other objects
      // Don't use for primitives (int, boolean, etc.)
      const objectTypes = ['String', 'BigInteger', 'Object'];
      return objectTypes.includes(leftType.name) || objectTypes.includes(rightType.name);
    }

    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new JavaUnaryExpression(node.operator, operand, node.prefix);
    }

    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new JavaUnaryExpression(node.operator, operand, node.prefix);
    }

    transformAssignmentExpression(node) {
      const target = this.transformExpression(node.left);
      const value = this.transformExpression(node.right);
      return new JavaAssignment(target, node.operator, value);
    }

    transformMemberExpression(node) {
      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Array access: arr[index]
        const index = this.transformExpression(node.property);
        return new JavaArrayAccess(object, index);
      } else {
        // Member access: obj.member
        const member = node.property.name;
        return new JavaMemberAccess(object, member);
      }
    }

    transformCallExpression(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const methodName = node.callee.property.name;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Map OpCodes methods to Java equivalents
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'OpCodes') {
          return this.transformOpCodesCall(methodName, args);
        }

        // Handle Object methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
          // Object.freeze() - Java doesn't have this, just return the argument
          if (methodName === 'freeze' && args.length > 0)
            return args[0];
          // Object.keys(obj) -> obj.keySet() for Map, or new ArrayList<>(obj.keySet())
          if (methodName === 'keys' && args.length === 1) {
            this.addImport('java.util.ArrayList');
            return new JavaMethodCall(null, 'new ArrayList<>', [new JavaMethodCall(args[0], 'keySet', [])]);
          }
          // Object.values(obj) -> new ArrayList<>(obj.values())
          if (methodName === 'values' && args.length === 1) {
            this.addImport('java.util.ArrayList');
            return new JavaMethodCall(null, 'new ArrayList<>', [new JavaMethodCall(args[0], 'values', [])]);
          }
          // Object.entries(obj) -> new ArrayList<>(obj.entrySet())
          if (methodName === 'entries' && args.length === 1) {
            this.addImport('java.util.ArrayList');
            return new JavaMethodCall(null, 'new ArrayList<>', [new JavaMethodCall(args[0], 'entrySet', [])]);
          }
          // Object.assign(target, source) -> target.putAll(source); return target
          if (methodName === 'assign' && args.length >= 2) {
            // For now just return target - proper implementation needs statement
            return args[0];
          }
        }

        // Map array methods
        if (methodName === 'push') {
          // arr.push(x) -> arr = Arrays.copyOf(arr, arr.length + 1); arr[arr.length-1] = x
          this.warnings.push('Array.push() requires manual conversion in Java');
          return new JavaMethodCall(object, 'add', args);
        } else if (methodName === 'slice') {
          // arr.slice(start, end) -> Arrays.copyOfRange(arr, start, end)
          this.addImport('java.util.Arrays');
          return new JavaMethodCall(new JavaIdentifier('Arrays'), 'copyOfRange',
            [object, ...args]);
        } else if (methodName === 'fill') {
          // arr.fill(value) -> Arrays.fill(arr, value)
          this.addImport('java.util.Arrays');
          return new JavaMethodCall(new JavaIdentifier('Arrays'), 'fill',
            [object, ...args]);
        }

        return new JavaMethodCall(object, methodName, args);
      } else {
        // Static or top-level function call
        const methodName = node.callee.name;
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new JavaMethodCall(null, methodName, args);
      }
    }

    /**
     * Transform OpCodes method calls to Java equivalents
     */
    transformOpCodesCall(methodName, args) {
      // Map common OpCodes methods to Java equivalents
      const opCodesMap = {
        // Rotation
        'RotL32': (args) => new JavaMethodCall(new JavaIdentifier('Integer'), 'rotateLeft', args),
        'RotR32': (args) => new JavaMethodCall(new JavaIdentifier('Integer'), 'rotateRight', args),
        'RotL64': (args) => new JavaMethodCall(new JavaIdentifier('Long'), 'rotateLeft', args),
        'RotR64': (args) => new JavaMethodCall(new JavaIdentifier('Long'), 'rotateRight', args),

        // Byte packing/unpacking
        'Pack32BE': (args) => this.createByteBufferPack(args, true, 4),
        'Pack32LE': (args) => this.createByteBufferPack(args, false, 4),
        'Unpack32BE': (args) => this.createByteBufferUnpack(args[0], true, 4),
        'Unpack32LE': (args) => this.createByteBufferUnpack(args[0], false, 4),

        // Array operations
        'XorArrays': (args) => this.createXorArraysCode(args[0], args[1]),

        // Hex conversion
        'Hex8ToBytes': (args) => this.createHexToBytes(args[0]),
        'BytesToHex8': (args) => this.createBytesToHex(args[0])
      };

      if (opCodesMap[methodName]) {
        this.addImport('java.nio.ByteBuffer');
        return opCodesMap[methodName](args);
      }

      // Default: assume static method call
      return new JavaMethodCall(new JavaIdentifier('OpCodes'), methodName, args);
    }

    /**
     * Create ByteBuffer packing code for bytes to int/long
     */
    createByteBufferPack(args, isBigEndian, byteCount) {
      // ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).put(b0).put(b1).put(b2).put(b3).getInt(0)
      this.addImport('java.nio.ByteOrder');
      const order = isBigEndian ? 'BIG_ENDIAN' : 'LITTLE_ENDIAN';

      // Build method chain
      let chain = new JavaMethodCall(new JavaIdentifier('ByteBuffer'), 'allocate',
        [new JavaLiteral(byteCount, 'int')]);
      chain = new JavaMethodCall(chain, 'order',
        [new JavaMemberAccess(new JavaIdentifier('ByteOrder'), order)]);

      // Add put() calls for each byte
      for (const arg of args) {
        chain = new JavaMethodCall(chain, 'put', [arg]);
      }

      // Get result
      const getMethod = byteCount === 4 ? 'getInt' : 'getLong';
      return new JavaMethodCall(chain, getMethod, [new JavaLiteral(0, 'int')]);
    }

    /**
     * Create ByteBuffer unpacking code for int/long to bytes
     */
    createByteBufferUnpack(value, isBigEndian, byteCount) {
      // ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putInt(value).array()
      this.addImport('java.nio.ByteOrder');
      const order = isBigEndian ? 'BIG_ENDIAN' : 'LITTLE_ENDIAN';
      const putMethod = byteCount === 4 ? 'putInt' : 'putLong';

      let chain = new JavaMethodCall(new JavaIdentifier('ByteBuffer'), 'allocate',
        [new JavaLiteral(byteCount, 'int')]);
      chain = new JavaMethodCall(chain, 'order',
        [new JavaMemberAccess(new JavaIdentifier('ByteOrder'), order)]);
      chain = new JavaMethodCall(chain, putMethod, [value]);
      return new JavaMethodCall(chain, 'array', []);
    }

    /**
     * Create XOR arrays code
     */
    createXorArraysCode(arr1, arr2) {
      // Generate inline loop or utility method call
      this.warnings.push('XorArrays requires custom implementation in Java');
      return new JavaMethodCall(new JavaIdentifier('OpCodes'), 'xorArrays', [arr1, arr2]);
    }

    /**
     * Create hex to bytes conversion
     */
    createHexToBytes(hexString) {
      this.warnings.push('Hex8ToBytes requires custom implementation in Java');
      return new JavaMethodCall(new JavaIdentifier('OpCodes'), 'hexToBytes', [hexString]);
    }

    /**
     * Create bytes to hex conversion
     */
    createBytesToHex(byteArray) {
      this.warnings.push('BytesToHex8 requires custom implementation in Java');
      return new JavaMethodCall(new JavaIdentifier('OpCodes'), 'bytesToHex', [byteArray]);
    }

    transformNewExpression(node) {
      const typeName = node.callee.name || 'Object';
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map TypedArrays to Java array types
      const typedArrayMap = {
        'Uint8Array': JavaType.Byte(),
        'Uint16Array': JavaType.Short(),
        'Uint32Array': JavaType.Int(),
        'Int8Array': JavaType.Byte(),
        'Int16Array': JavaType.Short(),
        'Int32Array': JavaType.Int(),
        'Float32Array': JavaType.Float(),
        'Float64Array': JavaType.Double()
      };

      if (typedArrayMap[typeName]) {
        const hasArrayInit = node.arguments.length > 0 &&
          node.arguments[0].type === 'ArrayExpression';

        if (hasArrayInit) {
          // new Uint8Array([1, 2, 3]) -> new byte[] { 1, 2, 3 }
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new JavaArrayCreation(typedArrayMap[typeName], null, elements);
        }

        // new Uint8Array(n) -> new byte[n]
        return new JavaArrayCreation(typedArrayMap[typeName], args[0] || JavaLiteral.Int(0), null);
      }

      // Special handling for arrays
      if (typeName === 'Array') {
        if (args.length === 1) {
          // new Array(size)
          return new JavaArrayCreation(JavaType.Int(), args[0], null);
        }
      }

      const type = this.mapType(typeName);
      return new JavaObjectCreation(type, args);
    }

    transformArrayExpression(node) {
      const elements = node.elements.map(el => this.transformExpression(el));
      const elementType = JavaType.Int(); // Default, could be inferred
      return new JavaArrayCreation(elementType, null, elements);
    }

    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const trueExpr = this.transformExpression(node.consequent);
      const falseExpr = this.transformExpression(node.alternate);
      return new JavaConditional(condition, trueExpr, falseExpr);
    }

    transformLambdaExpression(node) {
      const params = node.params.map(p => p.name || p);
      const body = node.body.type === 'BlockStatement' ?
        this.transformBlockStatement(node.body) :
        this.transformExpression(node.body);
      return new JavaLambda(params, body);
    }

    // ========================[ TYPE INFERENCE ]========================

    /**
     * Map a type name to JavaType
     */
    mapType(typeName) {
      if (!typeName) return JavaType.Object();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return JavaType.Array(elementType);
      }

      // Map known types
      const javaTypeName = TYPE_MAP[typeName] || typeName;

      switch (javaTypeName) {
        case 'byte': return JavaType.Byte();
        case 'short': return JavaType.Short();
        case 'int': return JavaType.Int();
        case 'long': return JavaType.Long();
        case 'float': return JavaType.Float();
        case 'double': return JavaType.Double();
        case 'boolean': return JavaType.Boolean();
        case 'char': return JavaType.Char();
        case 'String': return JavaType.String();
        case 'void': return JavaType.Void();
        case 'BigInteger': return JavaType.BigInteger();
        default: return new JavaType(javaTypeName);
      }
    }

    inferReturnType(node) {
      // Use typeKnowledge if available
      if (this.typeKnowledge && node.typeInfo?.returns) {
        return this.mapTypeFromKnowledge(node.typeInfo.returns);
      }

      // Check for return statements
      if (node.body && node.body.type === 'BlockStatement') {
        for (const stmt of node.body.body) {
          if (stmt.type === 'ReturnStatement' && stmt.argument) {
            return this.inferExpressionType(stmt.argument);
          }
        }
      }
      return JavaType.Void();
    }

    inferParameterType(paramName) {
      // Use name-based heuristics for crypto code
      const lowerName = paramName.toLowerCase();

      // Array-related names
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer')) {
        return JavaType.Array(JavaType.Byte());
      }

      // Index/position names
      if (lowerName.includes('index') || lowerName.includes('pos') ||
          lowerName.includes('offset') || lowerName.includes('length') ||
          lowerName === 'i' || lowerName === 'j') {
        return JavaType.Int();
      }

      // Default to int for crypto operations (most common)
      return JavaType.Int();
    }

    inferPropertyType(node) {
      if (node.value) {
        return this.inferExpressionType(node.value);
      }
      return JavaType.Object();
    }

    inferVariableType(node) {
      if (node.init) {
        return this.inferExpressionType(node.init);
      }
      return JavaType.Object();
    }

    inferExpressionType(node) {
      if (!node) return JavaType.Object();

      switch (node.type) {
        case 'Literal':
          if (node.value === null) return JavaType.Object();
          if (typeof node.value === 'boolean') return JavaType.Boolean();
          if (typeof node.value === 'string') return JavaType.String();
          if (typeof node.value === 'number') {
            if (Number.isInteger(node.value)) return JavaType.Int();
            return JavaType.Double();
          }
          if (typeof node.value === 'bigint' || node.bigint) return JavaType.BigInteger();
          return JavaType.Object();

        case 'ArrayExpression':
          if (node.elements.length > 0) {
            const elemType = this.inferExpressionType(node.elements[0]);
            return JavaType.Array(elemType);
          }
          return JavaType.Array(JavaType.Byte()); // Default for crypto

        case 'NewExpression':
          return this.mapType(node.callee.name);

        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.inferBinaryExpressionType(node);

        case 'CallExpression':
          return this.inferCallExpressionType(node);

        case 'Identifier':
          return this.getVariableType(node.name) || JavaType.Int();

        default:
          return JavaType.Object();
      }
    }

    inferBinaryExpressionType(node) {
      const op = node.operator;

      // Comparison and logical operators return boolean
      if (['==', '!=', '===', '!==', '<', '>', '<=', '>=', '&&', '||'].includes(op)) {
        return JavaType.Boolean();
      }

      // >>> 0 returns int (unsigned semantics)
      if (op === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
        return JavaType.Int();
      }

      // Bitwise and arithmetic - infer from operands
      const leftType = this.inferExpressionType(node.left);
      const rightType = this.inferExpressionType(node.right);

      // Return wider type
      if (leftType.name === 'long' || rightType.name === 'long') return JavaType.Long();
      if (leftType.name === 'int' || rightType.name === 'int') return JavaType.Int();
      if (leftType.name === 'short' || rightType.name === 'short') return JavaType.Short();

      return JavaType.Int();
    }

    inferCallExpressionType(node) {
      // Check OpCodes methods
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.getOpCodesReturnType(node.callee.property.name);
      }

      // Array methods
      if (node.callee.type === 'MemberExpression') {
        const methodName = node.callee.property.name;
        if (methodName === 'slice' || methodName === 'concat') {
          return JavaType.Array(JavaType.Byte());
        }
      }

      return JavaType.Object();
    }

    /**
     * Get the type of a variable from the type map
     */
    getVariableType(name) {
      return this.variableTypes.get(name) || null;
    }

    getOpCodesReturnType(methodName) {
      // Use typeKnowledge if available
      if (this.typeKnowledge?.opCodesTypes && this.typeKnowledge.opCodesTypes[methodName]) {
        const opInfo = this.typeKnowledge.opCodesTypes[methodName];
        return this.mapTypeFromKnowledge(opInfo.returns);
      }

      // Fallback to common patterns
      const returnTypes = {
        'RotL32': JavaType.Int(),
        'RotR32': JavaType.Int(),
        'RotL64': JavaType.Long(),
        'RotR64': JavaType.Long(),
        'Pack32BE': JavaType.Int(),
        'Pack32LE': JavaType.Int(),
        'Unpack32BE': JavaType.Array(JavaType.Byte()),
        'Unpack32LE': JavaType.Array(JavaType.Byte()),
        'XorArrays': JavaType.Array(JavaType.Byte()),
        'Hex8ToBytes': JavaType.Array(JavaType.Byte()),
        'BytesToHex8': JavaType.String()
      };

      return returnTypes[methodName] || JavaType.Object();
    }

    mapTypeFromKnowledge(typeName) {
      if (!typeName) return JavaType.Object();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapTypeFromKnowledge(elementTypeName);
        return JavaType.Array(elementType);
      }

      return this.mapType(typeName);
    }

    // ========================[ NAMING CONVENTIONS ]========================

    /**
     * Convert to camelCase (Java method naming convention)
     */
    toCamelCase(name) {
      if (!name) return name;

      // If already camelCase, return as-is
      if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return name;

      // Convert PascalCase to camelCase
      if (/^[A-Z]/.test(name)) {
        return name[0].toLowerCase() + name.slice(1);
      }

      // Convert snake_case to camelCase
      return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }

    /**
     * Convert to PascalCase (Java class naming convention)
     */
    toPascalCase(name) {
      if (!name) return name;

      // If already PascalCase, return as-is
      if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return name;

      // Convert camelCase to PascalCase
      if (/^[a-z]/.test(name)) {
        return name[0].toUpperCase() + name.slice(1);
      }

      // Convert snake_case to PascalCase
      return name.replace(/(^|_)([a-z])/g, (_, __, letter) => letter.toUpperCase());
    }

    /**
     * Convert to UPPER_SNAKE_CASE (Java constant naming convention)
     */
    toConstantCase(name) {
      if (!name) return name;

      // If already UPPER_SNAKE_CASE, return as-is
      if (/^[A-Z][A-Z0-9_]*$/.test(name)) return name;

      // Convert camelCase/PascalCase to UPPER_SNAKE_CASE
      return name
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        .toUpperCase();
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
  const exports = { JavaTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.JavaTransformer = JavaTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
