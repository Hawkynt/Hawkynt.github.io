/**
 * JavaAST.js - Java Abstract Syntax Tree Node Types
 * Defines Java-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Java AST -> Java Emitter -> Java Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all Java AST nodes
   */
  class JavaNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a Java type reference
   */
  class JavaType extends JavaNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'int', 'byte', 'String', etc.
      this.isArray = options.isArray || false;   // true for T[]
      this.arrayDimensions = options.arrayDimensions || 1;
      this.isGeneric = options.isGeneric || false;
      this.genericArguments = options.genericArguments || []; // For List<T>, Map<K,V>
      this.isPrimitive = options.isPrimitive !== undefined ? options.isPrimitive : this._checkPrimitive(name);
    }

    _checkPrimitive(name) {
      return ['byte', 'short', 'int', 'long', 'float', 'double', 'boolean', 'char'].includes(name);
    }

    /**
     * Create common primitive types
     */
    static Byte() { return new JavaType('byte', { isPrimitive: true }); }
    static Short() { return new JavaType('short', { isPrimitive: true }); }
    static Int() { return new JavaType('int', { isPrimitive: true }); }
    static Long() { return new JavaType('long', { isPrimitive: true }); }
    static Float() { return new JavaType('float', { isPrimitive: true }); }
    static Double() { return new JavaType('double', { isPrimitive: true }); }
    static Boolean() { return new JavaType('boolean', { isPrimitive: true }); }
    static Char() { return new JavaType('char', { isPrimitive: true }); }
    static Void() { return new JavaType('void', { isPrimitive: true }); }

    static String() { return new JavaType('String', { isPrimitive: false }); }
    static Object() { return new JavaType('Object', { isPrimitive: false }); }
    static BigInteger() { return new JavaType('BigInteger', { isPrimitive: false }); }

    static Array(elementType) {
      const options = { isArray: true, arrayDimensions: 1 };
      const type = new JavaType(elementType.name, options);
      type.elementType = elementType;
      return type;
    }

    static List(elementType) {
      return new JavaType('List', { isGeneric: true, genericArguments: [elementType], isPrimitive: false });
    }

    static ArrayList(elementType) {
      return new JavaType('ArrayList', { isGeneric: true, genericArguments: [elementType], isPrimitive: false });
    }

    static Map(keyType, valueType) {
      return new JavaType('Map', { isGeneric: true, genericArguments: [keyType, valueType], isPrimitive: false });
    }

    static HashMap(keyType, valueType) {
      return new JavaType('HashMap', { isGeneric: true, genericArguments: [keyType, valueType], isPrimitive: false });
    }

    /**
     * Convert to Java type string
     */
    toString() {
      let result = this.name;

      if (this.isGeneric && this.genericArguments.length > 0) {
        result += `<${this.genericArguments.map(t => t.toString()).join(', ')}>`;
      }

      if (this.isArray) {
        result += '[]'.repeat(this.arrayDimensions);
      }

      return result;
    }
  }

  // ========================[ COMPILATION UNIT ]========================

  /**
   * Root node representing a complete Java file
   */
  class JavaCompilationUnit extends JavaNode {
    constructor() {
      super('CompilationUnit');
      this.packageDeclaration = null; // JavaPackageDeclaration
      this.imports = [];               // JavaImportDeclaration[]
      this.types = [];                 // JavaClass[], JavaInterface[], etc.
    }
  }

  /**
   * Package declaration: package com.example;
   */
  class JavaPackageDeclaration extends JavaNode {
    constructor(name) {
      super('PackageDeclaration');
      this.name = name; // 'com.example.myapp'
    }
  }

  /**
   * Import declaration: import java.util.*;
   */
  class JavaImportDeclaration extends JavaNode {
    constructor(packageName, isStatic = false, isWildcard = false) {
      super('ImportDeclaration');
      this.packageName = packageName;  // 'java.util.List', 'java.util.*'
      this.isStatic = isStatic;        // static import
      this.isWildcard = isWildcard;    // import with *
    }
  }

  // ========================[ TYPE DECLARATIONS ]========================

  /**
   * Class declaration
   */
  class JavaClass extends JavaNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.accessModifier = 'public';  // 'public', 'private', 'protected', ''
      this.isStatic = false;
      this.isFinal = false;
      this.isAbstract = false;
      this.extendsClass = null;        // JavaType
      this.implementsInterfaces = [];  // JavaType[]
      this.members = [];               // JavaMember[]
      this.nestedTypes = [];           // JavaClass[], JavaInterface[], etc.
      this.javadoc = null;             // JavaDoc
    }
  }

  /**
   * Interface declaration
   */
  class JavaInterface extends JavaNode {
    constructor(name) {
      super('Interface');
      this.name = name;
      this.accessModifier = 'public';
      this.extendsInterfaces = [];     // JavaType[]
      this.members = [];               // JavaMethod[], JavaField[]
      this.javadoc = null;
    }
  }

  // ========================[ MEMBER DECLARATIONS ]========================

  /**
   * Field declaration
   */
  class JavaField extends JavaNode {
    constructor(name, type) {
      super('Field');
      this.name = name;
      this.type = type;                // JavaType
      this.accessModifier = 'private';
      this.isStatic = false;
      this.isFinal = false;
      this.isVolatile = false;
      this.isTransient = false;
      this.initializer = null;         // JavaExpression
      this.javadoc = null;
    }
  }

  /**
   * Method declaration
   */
  class JavaMethod extends JavaNode {
    constructor(name, returnType) {
      super('Method');
      this.name = name;
      this.returnType = returnType;    // JavaType
      this.accessModifier = 'public';
      this.isStatic = false;
      this.isFinal = false;
      this.isAbstract = false;
      this.isSynchronized = false;
      this.isNative = false;
      this.parameters = [];            // JavaParameter[]
      this.throwsExceptions = [];      // JavaType[]
      this.body = null;                // JavaBlock
      this.javadoc = null;
    }
  }

  /**
   * Constructor declaration
   */
  class JavaConstructor extends JavaNode {
    constructor(className) {
      super('Constructor');
      this.className = className;
      this.accessModifier = 'public';
      this.parameters = [];            // JavaParameter[]
      this.throwsExceptions = [];      // JavaType[]
      this.superCall = null;           // JavaSuperConstructorCall
      this.thisCall = null;            // JavaThisConstructorCall
      this.body = null;                // JavaBlock
      this.javadoc = null;
    }
  }

  /**
   * Method parameter
   */
  class JavaParameter extends JavaNode {
    constructor(name, type) {
      super('Parameter');
      this.name = name;
      this.type = type;                // JavaType
      this.isFinal = false;
      this.isVarArgs = false;          // for T... syntax
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement { ... }
   */
  class JavaBlock extends JavaNode {
    constructor() {
      super('Block');
      this.statements = [];            // JavaStatement[]
    }
  }

  /**
   * Variable declaration statement
   */
  class JavaVariableDeclaration extends JavaNode {
    constructor(name, type, initializer = null) {
      super('VariableDeclaration');
      this.name = name;
      this.type = type;                // JavaType
      this.isFinal = false;
      this.initializer = initializer;  // JavaExpression
    }
  }

  /**
   * Expression statement (expression;)
   */
  class JavaExpressionStatement extends JavaNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class JavaReturn extends JavaNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression;    // JavaExpression or null
    }
  }

  /**
   * If statement
   */
  class JavaIf extends JavaNode {
    constructor(condition, thenBranch, elseBranch = null) {
      super('If');
      this.condition = condition;      // JavaExpression
      this.thenBranch = thenBranch;    // JavaStatement or JavaBlock
      this.elseBranch = elseBranch;    // JavaStatement, JavaBlock, or null
    }
  }

  /**
   * For loop
   */
  class JavaFor extends JavaNode {
    constructor() {
      super('For');
      this.initializer = null;         // JavaVariableDeclaration or JavaExpression
      this.condition = null;           // JavaExpression
      this.incrementor = null;         // JavaExpression
      this.body = null;                // JavaBlock
    }
  }

  /**
   * Enhanced for loop (for-each)
   */
  class JavaForEach extends JavaNode {
    constructor(variableName, variableType, iterable, body) {
      super('ForEach');
      this.variableName = variableName;
      this.variableType = variableType; // JavaType
      this.iterable = iterable;         // JavaExpression
      this.body = body;                 // JavaBlock
    }
  }

  /**
   * While loop
   */
  class JavaWhile extends JavaNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Do-While loop
   */
  class JavaDoWhile extends JavaNode {
    constructor(body, condition) {
      super('DoWhile');
      this.body = body;
      this.condition = condition;
    }
  }

  /**
   * Switch statement
   */
  class JavaSwitch extends JavaNode {
    constructor(expression) {
      super('Switch');
      this.expression = expression;
      this.cases = [];                 // JavaSwitchCase[]
    }
  }

  /**
   * Switch case
   */
  class JavaSwitchCase extends JavaNode {
    constructor(label = null) {
      super('SwitchCase');
      this.label = label;              // JavaExpression or null for default
      this.isDefault = label === null;
      this.statements = [];
    }
  }

  /**
   * Break statement
   */
  class JavaBreak extends JavaNode {
    constructor(label = null) {
      super('Break');
      this.label = label;              // Optional label for labeled break
    }
  }

  /**
   * Continue statement
   */
  class JavaContinue extends JavaNode {
    constructor(label = null) {
      super('Continue');
      this.label = label;              // Optional label for labeled continue
    }
  }

  /**
   * Throw statement
   */
  class JavaThrow extends JavaNode {
    constructor(expression) {
      super('Throw');
      this.expression = expression;
    }
  }

  /**
   * Try-Catch-Finally
   */
  class JavaTryCatch extends JavaNode {
    constructor() {
      super('TryCatch');
      this.tryBlock = null;
      this.catchClauses = [];          // JavaCatchClause[]
      this.finallyBlock = null;
    }
  }

  class JavaCatchClause extends JavaNode {
    constructor(exceptionType, variableName, body) {
      super('CatchClause');
      this.exceptionType = exceptionType;
      this.variableName = variableName;
      this.body = body;
    }
  }

  /**
   * Synchronized block
   */
  class JavaSynchronized extends JavaNode {
    constructor(expression, block) {
      super('Synchronized');
      this.expression = expression;
      this.block = block;
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression (numbers, strings, booleans, null)
   */
  class JavaLiteral extends JavaNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;              // The actual value
      this.literalType = literalType;  // 'int', 'long', 'string', 'boolean', 'null', etc.
      this.suffix = null;              // 'L', 'f', 'd', etc.
    }

    static Int(value) { return new JavaLiteral(value, 'int'); }
    static Long(value) { const l = new JavaLiteral(value, 'long'); l.suffix = 'L'; return l; }
    static Float(value) { const l = new JavaLiteral(value, 'float'); l.suffix = 'f'; return l; }
    static Double(value) { return new JavaLiteral(value, 'double'); }
    static String(value) { return new JavaLiteral(value, 'string'); }
    static Boolean(value) { return new JavaLiteral(value, 'boolean'); }
    static Null() { return new JavaLiteral(null, 'null'); }
    static Char(value) { return new JavaLiteral(value, 'char'); }

    static Hex(value, suffix = null) {
      const l = new JavaLiteral(value, 'hex');
      l.isHex = true;
      if (suffix) l.suffix = suffix;
      return l;
    }
  }

  /**
   * Identifier expression (variable, type, member name)
   */
  class JavaIdentifier extends JavaNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression (a + b, a && b, etc.)
   */
  class JavaBinaryExpression extends JavaNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;        // '+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>', '>>>', '==', '!=', '<', '>', '<=', '>=', '&&', '||'
      this.right = right;
    }
  }

  /**
   * Unary expression (!x, -x, ++x, x++, etc.)
   */
  class JavaUnaryExpression extends JavaNode {
    constructor(operator, operand, isPrefix = true) {
      super('UnaryExpression');
      this.operator = operator;        // '!', '-', '~', '++', '--', '+'
      this.operand = operand;
      this.isPrefix = isPrefix;
    }
  }

  /**
   * Assignment expression (x = y, x += y, etc.)
   */
  class JavaAssignment extends JavaNode {
    constructor(target, operator, value) {
      super('Assignment');
      this.target = target;
      this.operator = operator;        // '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='
      this.value = value;
    }
  }

  /**
   * Member access (obj.member)
   */
  class JavaMemberAccess extends JavaNode {
    constructor(target, member) {
      super('MemberAccess');
      this.target = target;            // JavaExpression
      this.member = member;            // string (member name)
    }
  }

  /**
   * Array access (arr[index])
   */
  class JavaArrayAccess extends JavaNode {
    constructor(target, index) {
      super('ArrayAccess');
      this.target = target;
      this.index = index;              // JavaExpression
    }
  }

  /**
   * Method invocation (Method(args))
   */
  class JavaMethodCall extends JavaNode {
    constructor(target, methodName, args = []) {
      super('MethodCall');
      this.target = target;            // JavaExpression or null for simple call
      this.methodName = methodName;
      this.arguments = args;           // JavaExpression[]
      this.typeArguments = [];         // For generic methods
    }
  }

  /**
   * Object creation (new Type(args))
   */
  class JavaObjectCreation extends JavaNode {
    constructor(type, args = []) {
      super('ObjectCreation');
      this.type = type;                // JavaType
      this.arguments = args;           // JavaExpression[]
    }
  }

  /**
   * Array creation (new Type[size] or new Type[] { ... })
   */
  class JavaArrayCreation extends JavaNode {
    constructor(elementType, size = null, initializer = null) {
      super('ArrayCreation');
      this.elementType = elementType;  // JavaType
      this.size = size;                // JavaExpression or null
      this.initializer = initializer;  // JavaExpression[] or null
    }
  }

  /**
   * Cast expression ((Type)expr)
   */
  class JavaCast extends JavaNode {
    constructor(type, expression) {
      super('Cast');
      this.type = type;                // JavaType
      this.expression = expression;
    }
  }

  /**
   * Conditional expression (condition ? trueExpr : falseExpr)
   */
  class JavaConditional extends JavaNode {
    constructor(condition, trueExpr, falseExpr) {
      super('Conditional');
      this.condition = condition;
      this.trueExpression = trueExpr;
      this.falseExpression = falseExpr;
    }
  }

  /**
   * Lambda expression ((args) -> body)
   */
  class JavaLambda extends JavaNode {
    constructor(parameters, body) {
      super('Lambda');
      this.parameters = parameters;    // JavaParameter[] or string[] (for type inference)
      this.body = body;                // JavaBlock or JavaExpression
    }
  }

  /**
   * This expression
   */
  class JavaThis extends JavaNode {
    constructor() { super('This'); }
  }

  /**
   * Super expression
   */
  class JavaSuper extends JavaNode {
    constructor() { super('Super'); }
  }

  /**
   * Instanceof expression (expr instanceof Type)
   */
  class JavaInstanceOf extends JavaNode {
    constructor(expression, type) {
      super('InstanceOf');
      this.expression = expression;
      this.type = type;
    }
  }

  /**
   * Parenthesized expression ((expr))
   */
  class JavaParenthesized extends JavaNode {
    constructor(expression) {
      super('Parenthesized');
      this.expression = expression;
    }
  }

  // ========================[ JAVADOC ]========================

  /**
   * JavaDoc documentation comment
   */
  class JavaDoc extends JavaNode {
    constructor() {
      super('JavaDoc');
      this.description = null;
      this.parameters = [];            // [{name, description}]
      this.returns = null;
      this.throws = [];                // [{type, description}]
      this.see = [];                   // References
      this.since = null;
      this.deprecated = null;
    }
  }

  // ========================[ EXPORTS ]========================

  const JavaAST = {
    // Base
    JavaNode,

    // Types
    JavaType,

    // Compilation Unit
    JavaCompilationUnit,
    JavaPackageDeclaration,
    JavaImportDeclaration,

    // Type Declarations
    JavaClass,
    JavaInterface,

    // Members
    JavaField,
    JavaMethod,
    JavaConstructor,
    JavaParameter,

    // Statements
    JavaBlock,
    JavaVariableDeclaration,
    JavaExpressionStatement,
    JavaReturn,
    JavaIf,
    JavaFor,
    JavaForEach,
    JavaWhile,
    JavaDoWhile,
    JavaSwitch,
    JavaSwitchCase,
    JavaBreak,
    JavaContinue,
    JavaThrow,
    JavaTryCatch,
    JavaCatchClause,
    JavaSynchronized,

    // Expressions
    JavaLiteral,
    JavaIdentifier,
    JavaBinaryExpression,
    JavaUnaryExpression,
    JavaAssignment,
    JavaMemberAccess,
    JavaArrayAccess,
    JavaMethodCall,
    JavaObjectCreation,
    JavaArrayCreation,
    JavaCast,
    JavaConditional,
    JavaLambda,
    JavaThis,
    JavaSuper,
    JavaInstanceOf,
    JavaParenthesized,

    // Documentation
    JavaDoc
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = JavaAST;
  }
  if (typeof global !== 'undefined') {
    global.JavaAST = JavaAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
