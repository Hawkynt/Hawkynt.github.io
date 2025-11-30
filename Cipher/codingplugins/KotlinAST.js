/**
 * KotlinAST.js - Kotlin Abstract Syntax Tree Node Types
 * Defines Kotlin-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Kotlin AST -> Kotlin Emitter -> Kotlin Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all Kotlin AST nodes
   */
  class KotlinNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a Kotlin type reference
   */
  class KotlinType extends KotlinNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'Int', 'UInt', 'UByte', 'String', etc.
      this.isArray = options.isArray || false;   // true for Array<T>
      this.isNullable = options.isNullable || false; // true for T?
      this.isGeneric = options.isGeneric || false;
      this.genericArguments = options.genericArguments || []; // For List<T>, Map<K,V>
      this.arrayElementType = options.arrayElementType || null; // For Array<T>
    }

    /**
     * Create common primitive types
     */
    static Byte() { return new KotlinType('Byte'); }
    static UByte() { return new KotlinType('UByte'); }
    static Short() { return new KotlinType('Short'); }
    static UShort() { return new KotlinType('UShort'); }
    static Int() { return new KotlinType('Int'); }
    static UInt() { return new KotlinType('UInt'); }
    static Long() { return new KotlinType('Long'); }
    static ULong() { return new KotlinType('ULong'); }
    static Float() { return new KotlinType('Float'); }
    static Double() { return new KotlinType('Double'); }
    static Boolean() { return new KotlinType('Boolean'); }
    static Char() { return new KotlinType('Char'); }
    static String() { return new KotlinType('String'); }
    static Unit() { return new KotlinType('Unit'); }
    static Any() { return new KotlinType('Any'); }

    static ByteArray() { return new KotlinType('ByteArray'); }
    static UByteArray() { return new KotlinType('UByteArray'); }
    static IntArray() { return new KotlinType('IntArray'); }
    static UIntArray() { return new KotlinType('UIntArray'); }

    static Array(elementType) {
      return new KotlinType('Array', {
        isGeneric: true,
        genericArguments: [elementType],
        arrayElementType: elementType
      });
    }

    static List(elementType) {
      return new KotlinType('List', { isGeneric: true, genericArguments: [elementType] });
    }

    static MutableList(elementType) {
      return new KotlinType('MutableList', { isGeneric: true, genericArguments: [elementType] });
    }

    static Map(keyType, valueType) {
      return new KotlinType('Map', { isGeneric: true, genericArguments: [keyType, valueType] });
    }

    static MutableMap(keyType, valueType) {
      return new KotlinType('MutableMap', { isGeneric: true, genericArguments: [keyType, valueType] });
    }

    /**
     * Convert to Kotlin type string
     */
    toString() {
      let result = this.name;

      if (this.isGeneric && this.genericArguments.length > 0) {
        result += `<${this.genericArguments.map(t => t.toString()).join(', ')}>`;
      }

      if (this.isNullable) {
        result += '?';
      }

      return result;
    }
  }

  // ========================[ COMPILATION UNIT ]========================

  /**
   * Root node representing a complete Kotlin file
   */
  class KotlinFile extends KotlinNode {
    constructor() {
      super('File');
      this.packageDeclaration = null;  // KotlinPackageDeclaration
      this.imports = [];               // KotlinImportDirective[]
      this.declarations = [];          // Top-level declarations (classes, functions, properties)
    }
  }

  /**
   * Package declaration: package com.example
   */
  class KotlinPackageDeclaration extends KotlinNode {
    constructor(name) {
      super('PackageDeclaration');
      this.name = name;  // 'com.example', 'generated.crypto'
    }
  }

  /**
   * Import directive: import kotlin.collections.*
   */
  class KotlinImportDirective extends KotlinNode {
    constructor(path, alias = null) {
      super('ImportDirective');
      this.path = path;      // 'kotlin.collections.List'
      this.alias = alias;    // For: import Foo as Bar
      this.isWildcard = false; // For: import kotlin.collections.*
    }
  }

  // ========================[ TYPE DECLARATIONS ]========================

  /**
   * Class declaration
   */
  class KotlinClass extends KotlinNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.visibility = 'public';      // 'public', 'private', 'internal', 'protected'
      this.modifiers = [];             // 'abstract', 'final', 'open', 'sealed', 'data', 'inner'
      this.primaryConstructor = null;  // KotlinPrimaryConstructor
      this.superClass = null;          // KotlinType
      this.interfaces = [];            // KotlinType[]
      this.members = [];               // KotlinMember[]
      this.companionObject = null;     // KotlinCompanionObject
      this.kdoc = null;                // KDoc documentation
    }
  }

  /**
   * Data class declaration
   */
  class KotlinDataClass extends KotlinClass {
    constructor(name) {
      super(name);
      this.nodeType = 'DataClass';
      this.modifiers.push('data');
    }
  }

  /**
   * Object declaration (singleton)
   */
  class KotlinObject extends KotlinNode {
    constructor(name) {
      super('Object');
      this.name = name;
      this.visibility = 'public';
      this.superClass = null;
      this.interfaces = [];
      this.members = [];
      this.kdoc = null;
    }
  }

  /**
   * Companion object
   */
  class KotlinCompanionObject extends KotlinNode {
    constructor(name = null) {
      super('CompanionObject');
      this.name = name;  // Optional companion object name
      this.members = [];
    }
  }

  // ========================[ MEMBER DECLARATIONS ]========================

  /**
   * Primary constructor
   */
  class KotlinPrimaryConstructor extends KotlinNode {
    constructor(parameters = []) {
      super('PrimaryConstructor');
      this.parameters = parameters;  // KotlinParameter[]
      this.visibility = 'public';
    }
  }

  /**
   * Secondary constructor
   */
  class KotlinConstructor extends KotlinNode {
    constructor() {
      super('Constructor');
      this.parameters = [];       // KotlinParameter[]
      this.delegationCall = null; // KotlinDelegationCall (this() or super())
      this.body = null;           // KotlinBlock
      this.visibility = 'public';
      this.kdoc = null;
    }
  }

  /**
   * Property declaration
   */
  class KotlinProperty extends KotlinNode {
    constructor(name, type) {
      super('Property');
      this.name = name;
      this.type = type;                 // KotlinType
      this.visibility = 'public';
      this.modifiers = [];              // 'const', 'lateinit', 'override'
      this.isVar = false;               // true for var, false for val
      this.initializer = null;          // KotlinExpression
      this.getter = null;               // KotlinGetter
      this.setter = null;               // KotlinSetter
      this.kdoc = null;
    }
  }

  /**
   * Function declaration
   */
  class KotlinFunction extends KotlinNode {
    constructor(name, returnType) {
      super('Function');
      this.name = name;
      this.returnType = returnType;     // KotlinType
      this.visibility = 'public';
      this.modifiers = [];              // 'suspend', 'inline', 'infix', 'operator', 'override'
      this.parameters = [];             // KotlinParameter[]
      this.typeParameters = [];         // For generic functions
      this.body = null;                 // KotlinBlock or KotlinExpression (for single expression)
      this.kdoc = null;
    }
  }

  /**
   * Parameter
   */
  class KotlinParameter extends KotlinNode {
    constructor(name, type) {
      super('Parameter');
      this.name = name;
      this.type = type;
      this.isVal = false;               // For primary constructor parameters
      this.isVar = false;
      this.defaultValue = null;         // KotlinExpression
      this.isVararg = false;
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement { ... }
   */
  class KotlinBlock extends KotlinNode {
    constructor() {
      super('Block');
      this.statements = [];             // KotlinStatement[]
    }
  }

  /**
   * Variable declaration statement
   */
  class KotlinVariableDeclaration extends KotlinNode {
    constructor(name, type, initializer = null) {
      super('VariableDeclaration');
      this.name = name;
      this.type = type;                 // KotlinType (can be null for type inference)
      this.initializer = initializer;   // KotlinExpression
      this.isVar = false;               // true for var, false for val
    }
  }

  /**
   * Expression statement (expression)
   */
  class KotlinExpressionStatement extends KotlinNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class KotlinReturn extends KotlinNode {
    constructor(expression = null, label = null) {
      super('Return');
      this.expression = expression;     // KotlinExpression or null
      this.label = label;               // For labeled returns: return@label
    }
  }

  /**
   * If expression/statement
   */
  class KotlinIf extends KotlinNode {
    constructor(condition, thenBranch, elseBranch = null) {
      super('If');
      this.condition = condition;       // KotlinExpression
      this.thenBranch = thenBranch;     // KotlinExpression or KotlinBlock
      this.elseBranch = elseBranch;     // KotlinExpression, KotlinBlock, or null
    }
  }

  /**
   * When expression (Kotlin's switch replacement)
   */
  class KotlinWhen extends KotlinNode {
    constructor(subject = null) {
      super('When');
      this.subject = subject;           // KotlinExpression or null
      this.entries = [];                // KotlinWhenEntry[]
    }
  }

  /**
   * When entry
   */
  class KotlinWhenEntry extends KotlinNode {
    constructor() {
      super('WhenEntry');
      this.conditions = [];             // KotlinExpression[] or null for else
      this.isElse = false;
      this.body = null;                 // KotlinExpression or KotlinBlock
    }
  }

  /**
   * For loop
   */
  class KotlinFor extends KotlinNode {
    constructor(variable, iterable, body) {
      super('For');
      this.variable = variable;         // string (variable name)
      this.variableType = null;         // KotlinType (optional)
      this.iterable = iterable;         // KotlinExpression
      this.body = body;                 // KotlinBlock
    }
  }

  /**
   * While loop
   */
  class KotlinWhile extends KotlinNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Do-While loop
   */
  class KotlinDoWhile extends KotlinNode {
    constructor(body, condition) {
      super('DoWhile');
      this.body = body;
      this.condition = condition;
    }
  }

  /**
   * Break statement
   */
  class KotlinBreak extends KotlinNode {
    constructor(label = null) {
      super('Break');
      this.label = label;
    }
  }

  /**
   * Continue statement
   */
  class KotlinContinue extends KotlinNode {
    constructor(label = null) {
      super('Continue');
      this.label = label;
    }
  }

  /**
   * Throw expression
   */
  class KotlinThrow extends KotlinNode {
    constructor(expression) {
      super('Throw');
      this.expression = expression;
    }
  }

  /**
   * Try-Catch-Finally
   */
  class KotlinTryCatch extends KotlinNode {
    constructor() {
      super('TryCatch');
      this.tryBlock = null;
      this.catchClauses = [];           // KotlinCatchClause[]
      this.finallyBlock = null;
    }
  }

  class KotlinCatchClause extends KotlinNode {
    constructor(parameter, body) {
      super('CatchClause');
      this.parameter = parameter;       // KotlinParameter
      this.body = body;
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression (numbers, strings, booleans, null)
   */
  class KotlinLiteral extends KotlinNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;               // The actual value
      this.literalType = literalType;   // 'Int', 'UInt', 'Long', 'String', 'Boolean', 'null'
      this.suffix = null;               // 'u', 'L', 'UL', 'f', etc.
    }

    static Int(value) { return new KotlinLiteral(value, 'Int'); }
    static UInt(value) { const l = new KotlinLiteral(value, 'UInt'); l.suffix = 'u'; return l; }
    static Long(value) { const l = new KotlinLiteral(value, 'Long'); l.suffix = 'L'; return l; }
    static ULong(value) { const l = new KotlinLiteral(value, 'ULong'); l.suffix = 'UL'; return l; }
    static Float(value) { const l = new KotlinLiteral(value, 'Float'); l.suffix = 'f'; return l; }
    static Double(value) { return new KotlinLiteral(value, 'Double'); }
    static String(value) { return new KotlinLiteral(value, 'String'); }
    static Boolean(value) { return new KotlinLiteral(value, 'Boolean'); }
    static Null() { return new KotlinLiteral(null, 'null'); }
    static Hex(value, suffix = 'u') {
      const l = new KotlinLiteral(value, 'UInt');
      l.isHex = true;
      l.suffix = suffix;
      return l;
    }
  }

  /**
   * Identifier expression (variable, type, member name)
   */
  class KotlinIdentifier extends KotlinNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression (a + b, a && b, etc.)
   */
  class KotlinBinaryExpression extends KotlinNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;         // '+', '-', '*', '/', '%', 'and', 'or', 'xor', 'shl', 'shr', 'ushr'
      this.right = right;
    }
  }

  /**
   * Unary expression (!x, -x, ++x, x++, etc.)
   */
  class KotlinUnaryExpression extends KotlinNode {
    constructor(operator, operand, isPrefix = true) {
      super('UnaryExpression');
      this.operator = operator;         // '!', '-', '++', '--', 'inv'
      this.operand = operand;
      this.isPrefix = isPrefix;
    }
  }

  /**
   * Assignment expression (x = y)
   */
  class KotlinAssignment extends KotlinNode {
    constructor(target, value) {
      super('Assignment');
      this.target = target;
      this.value = value;
    }
  }

  /**
   * Member access (obj.member)
   */
  class KotlinMemberAccess extends KotlinNode {
    constructor(target, member, isSafe = false) {
      super('MemberAccess');
      this.target = target;             // KotlinExpression
      this.member = member;             // string (member name)
      this.isSafe = isSafe;             // true for ?.
    }
  }

  /**
   * Element access (arr[index])
   */
  class KotlinElementAccess extends KotlinNode {
    constructor(target, index) {
      super('ElementAccess');
      this.target = target;
      this.index = index;               // KotlinExpression
    }
  }

  /**
   * Function call (function(args))
   */
  class KotlinFunctionCall extends KotlinNode {
    constructor(target, args = []) {
      super('FunctionCall');
      this.target = target;             // KotlinExpression (function or member access)
      this.arguments = args;            // KotlinExpression[]
      this.typeArguments = [];          // For generic function calls
      this.isSafe = false;              // true for ?.
    }
  }

  /**
   * Object creation (ClassName(args))
   */
  class KotlinObjectCreation extends KotlinNode {
    constructor(type, args = []) {
      super('ObjectCreation');
      this.type = type;                 // KotlinType
      this.arguments = args;            // KotlinExpression[]
    }
  }

  /**
   * Array creation (arrayOf(...), intArrayOf(...))
   */
  class KotlinArrayCreation extends KotlinNode {
    constructor(factoryFunction, elements = []) {
      super('ArrayCreation');
      this.factoryFunction = factoryFunction; // 'arrayOf', 'intArrayOf', 'byteArrayOf', etc.
      this.elements = elements;         // KotlinExpression[]
    }
  }

  /**
   * Lambda expression
   */
  class KotlinLambda extends KotlinNode {
    constructor(parameters, body) {
      super('Lambda');
      this.parameters = parameters;     // string[] (parameter names)
      this.body = body;                 // KotlinBlock or KotlinExpression
    }
  }

  /**
   * Range expression (1..10, 1 until 10)
   */
  class KotlinRange extends KotlinNode {
    constructor(start, end, isInclusive = true) {
      super('Range');
      this.start = start;
      this.end = end;
      this.isInclusive = isInclusive;   // true for .., false for until
    }
  }

  /**
   * String template
   */
  class KotlinStringTemplate extends KotlinNode {
    constructor(parts) {
      super('StringTemplate');
      this.parts = parts;               // Array of strings and KotlinExpression
    }
  }

  /**
   * This expression
   */
  class KotlinThis extends KotlinNode {
    constructor(label = null) {
      super('This');
      this.label = label;               // For this@label
    }
  }

  /**
   * Super expression
   */
  class KotlinSuper extends KotlinNode {
    constructor() { super('Super'); }
  }

  /**
   * Is expression (x is Type)
   */
  class KotlinIsExpression extends KotlinNode {
    constructor(expression, type, isNegated = false) {
      super('IsExpression');
      this.expression = expression;
      this.type = type;
      this.isNegated = isNegated;       // true for !is
    }
  }

  /**
   * As expression (x as Type, x as? Type)
   */
  class KotlinAsExpression extends KotlinNode {
    constructor(expression, type, isSafe = false) {
      super('AsExpression');
      this.expression = expression;
      this.type = type;
      this.isSafe = isSafe;             // true for as?
    }
  }

  /**
   * Parenthesized expression ((expr))
   */
  class KotlinParenthesized extends KotlinNode {
    constructor(expression) {
      super('Parenthesized');
      this.expression = expression;
    }
  }

  /**
   * Elvis expression (a ?: b)
   */
  class KotlinElvis extends KotlinNode {
    constructor(left, right) {
      super('Elvis');
      this.left = left;
      this.right = right;
    }
  }

  // ========================[ KDOC DOCUMENTATION ]========================

  /**
   * KDoc documentation comment
   */
  class KotlinKDoc extends KotlinNode {
    constructor() {
      super('KDoc');
      this.summary = null;
      this.parameters = [];             // [{name, description}]
      this.returns = null;
      this.see = [];
      this.author = null;
      this.since = null;
    }
  }

  // ========================[ EXPORTS ]========================

  const KotlinAST = {
    // Base
    KotlinNode,

    // Types
    KotlinType,

    // Compilation Unit
    KotlinFile,
    KotlinPackageDeclaration,
    KotlinImportDirective,

    // Type Declarations
    KotlinClass,
    KotlinDataClass,
    KotlinObject,
    KotlinCompanionObject,

    // Members
    KotlinPrimaryConstructor,
    KotlinConstructor,
    KotlinProperty,
    KotlinFunction,
    KotlinParameter,

    // Statements
    KotlinBlock,
    KotlinVariableDeclaration,
    KotlinExpressionStatement,
    KotlinReturn,
    KotlinIf,
    KotlinWhen,
    KotlinWhenEntry,
    KotlinFor,
    KotlinWhile,
    KotlinDoWhile,
    KotlinBreak,
    KotlinContinue,
    KotlinThrow,
    KotlinTryCatch,
    KotlinCatchClause,

    // Expressions
    KotlinLiteral,
    KotlinIdentifier,
    KotlinBinaryExpression,
    KotlinUnaryExpression,
    KotlinAssignment,
    KotlinMemberAccess,
    KotlinElementAccess,
    KotlinFunctionCall,
    KotlinObjectCreation,
    KotlinArrayCreation,
    KotlinLambda,
    KotlinRange,
    KotlinStringTemplate,
    KotlinThis,
    KotlinSuper,
    KotlinIsExpression,
    KotlinAsExpression,
    KotlinParenthesized,
    KotlinElvis,

    // Documentation
    KotlinKDoc
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KotlinAST;
  }
  if (typeof global !== 'undefined') {
    global.KotlinAST = KotlinAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
