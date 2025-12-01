/**
 * BasicAST.js - Basic Abstract Syntax Tree Node Types
 * Defines Basic-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Basic AST -> Basic Emitter -> Basic Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all Basic AST nodes
   */
  class BasicNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a Basic type reference
   */
  class BasicType extends BasicNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'Byte', 'Integer', 'Long', etc.
      this.isArray = options.isArray || false;
      this.arrayDimensions = options.arrayDimensions || []; // For multi-dimensional arrays
      this.isReference = options.isReference || false; // ByRef vs ByVal
      this.isNullable = options.isNullable || false;
      this.elementType = options.elementType || null; // For arrays/collections
    }

    /**
     * Create common primitive types
     */
    static Byte() { return new BasicType('Byte'); }
    static Integer() { return new BasicType('Integer'); }
    static Long() { return new BasicType('Long'); }
    static LongLong() { return new BasicType('LongLong'); }
    static Single() { return new BasicType('Single'); }
    static Double() { return new BasicType('Double'); }
    static Boolean() { return new BasicType('Boolean'); }
    static String() { return new BasicType('String'); }
    static Variant() { return new BasicType('Variant'); }
    static Object() { return new BasicType('Object'); }

    static Array(elementType, dimensions = []) {
      return new BasicType(elementType.name, {
        isArray: true,
        arrayDimensions: dimensions,
        elementType: elementType
      });
    }

    static Nullable(innerType) {
      return new BasicType(innerType.name, { isNullable: true, elementType: innerType });
    }

    /**
     * Convert to Basic type string
     */
    toString() {
      let result = this.name;

      if (this.isArray) {
        result += '(';
        if (this.arrayDimensions.length > 0) {
          result += this.arrayDimensions.join(', ');
        }
        result += ')';
      }

      if (this.isNullable) {
        result += '?';
      }

      return result;
    }
  }

  // ========================[ MODULE ]========================

  /**
   * Root node representing a complete Basic module
   */
  class BasicModule extends BasicNode {
    constructor() {
      super('Module');
      this.imports = [];        // BasicImport[]
      this.attributes = [];     // Module-level attributes
      this.declarations = [];   // Top-level declarations
      this.types = [];          // Type definitions
      this.functions = [];      // Sub/Function declarations
      this.moduleComment = null; // Module header comment
    }
  }

  /**
   * Import/Imports statement
   */
  class BasicImport extends BasicNode {
    constructor(namespace, items = null) {
      super('Import');
      this.namespace = namespace;  // Namespace name
      this.items = items;          // Specific items to import or null for all
      this.alias = null;           // Alias for the import
    }
  }

  /**
   * Attribute (for .NET/VB.NET)
   */
  class BasicAttribute extends BasicNode {
    constructor(name, args = []) {
      super('Attribute');
      this.name = name;
      this.arguments = args;
    }
  }

  // ========================[ TYPE DECLARATIONS ]========================

  /**
   * Type/Structure declaration
   */
  class BasicTypeDeclaration extends BasicNode {
    constructor(name) {
      super('TypeDeclaration');
      this.name = name;
      this.visibility = 'Public'; // Public, Private, Friend
      this.fields = [];           // BasicField[]
      this.docComment = null;
    }
  }

  /**
   * Type field
   */
  class BasicField extends BasicNode {
    constructor(name, type) {
      super('Field');
      this.name = name;
      this.type = type;           // BasicType
      this.visibility = 'Public';
      this.defaultValue = null;
    }
  }

  /**
   * Class declaration
   */
  class BasicClass extends BasicNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.visibility = 'Public';
      this.baseClass = null;      // Base class name
      this.implements = [];       // Interface names
      this.fields = [];           // BasicField[]
      this.properties = [];       // BasicProperty[]
      this.methods = [];          // BasicFunction[]
      this.constructors = [];     // BasicConstructor[]
      this.docComment = null;
    }
  }

  /**
   * Property declaration
   */
  class BasicProperty extends BasicNode {
    constructor(name, type) {
      super('Property');
      this.name = name;
      this.type = type;
      this.visibility = 'Public';
      this.getter = null;         // BasicBlock or null
      this.setter = null;         // BasicBlock or null
      this.isReadOnly = false;
      this.isWriteOnly = false;
      this.defaultValue = null;
    }
  }

  /**
   * Constructor (New)
   */
  class BasicConstructor extends BasicNode {
    constructor() {
      super('Constructor');
      this.visibility = 'Public';
      this.parameters = [];       // BasicParameter[]
      this.body = null;           // BasicBlock
    }
  }

  // ========================[ FUNCTIONS/PROCEDURES ]========================

  /**
   * Function or Sub declaration
   */
  class BasicFunction extends BasicNode {
    constructor(name, isSub = false) {
      super('Function');
      this.name = name;
      this.isSub = isSub;         // true for Sub, false for Function
      this.visibility = 'Public'; // Public, Private, Friend
      this.isShared = false;      // Static/Shared method
      this.parameters = [];       // BasicParameter[]
      this.returnType = null;     // BasicType (null for Sub)
      this.body = null;           // BasicBlock
      this.docComment = null;
    }
  }

  /**
   * Function parameter
   */
  class BasicParameter extends BasicNode {
    constructor(name, type) {
      super('Parameter');
      this.name = name;
      this.type = type;           // BasicType
      this.isByRef = false;       // ByRef vs ByVal
      this.isOptional = false;
      this.defaultValue = null;
      this.isParamArray = false;  // ParamArray for variable arguments
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block of statements
   */
  class BasicBlock extends BasicNode {
    constructor() {
      super('Block');
      this.statements = [];
    }
  }

  /**
   * Dim/Variable declaration
   */
  class BasicDim extends BasicNode {
    constructor(name, type = null, initializer = null) {
      super('Dim');
      this.name = name;
      this.type = type;           // BasicType or null
      this.initializer = initializer; // BasicExpression or null
      this.isStatic = false;
      this.isConst = false;
    }
  }

  /**
   * Assignment statement
   */
  class BasicAssignment extends BasicNode {
    constructor(target, value, operator = '=') {
      super('Assignment');
      this.target = target;       // BasicExpression
      this.value = value;         // BasicExpression
      this.operator = operator;   // '=', '+=', '-=', etc.
    }
  }

  /**
   * Expression statement
   */
  class BasicExpressionStatement extends BasicNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement (Function) or Exit Sub/Function
   */
  class BasicReturn extends BasicNode {
    constructor(expression = null, isExit = false) {
      super('Return');
      this.expression = expression;
      this.isExit = isExit;       // true for Exit Function/Sub
    }
  }

  /**
   * If/Then/ElseIf/Else statement
   */
  class BasicIf extends BasicNode {
    constructor(condition, thenBranch) {
      super('If');
      this.condition = condition;       // BasicExpression
      this.thenBranch = thenBranch;     // BasicBlock
      this.elseIfBranches = [];         // [{condition, body}]
      this.elseBranch = null;           // BasicBlock or null
      this.isInline = false;            // Single-line If
    }
  }

  /**
   * For/Next loop
   */
  class BasicFor extends BasicNode {
    constructor(variable, start, end, body) {
      super('For');
      this.variable = variable;   // Variable name (string)
      this.start = start;         // BasicExpression
      this.end = end;             // BasicExpression
      this.step = null;           // BasicExpression or null
      this.body = body;           // BasicBlock
    }
  }

  /**
   * For Each loop
   */
  class BasicForEach extends BasicNode {
    constructor(variable, collection, body) {
      super('ForEach');
      this.variable = variable;   // Variable name or declaration
      this.collection = collection; // BasicExpression
      this.body = body;           // BasicBlock
    }
  }

  /**
   * While/Wend or Do While loop
   */
  class BasicWhile extends BasicNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
      this.isDoWhile = false;     // true for Do...Loop While
      this.isUntil = false;       // true for Do Until...Loop
    }
  }

  /**
   * Do/Loop
   */
  class BasicDoLoop extends BasicNode {
    constructor(body, condition = null) {
      super('DoLoop');
      this.body = body;
      this.condition = condition; // null for infinite loop
      this.isWhile = true;        // false for Until
      this.testAtTop = false;     // true for Do While...Loop, false for Do...Loop While
    }
  }

  /**
   * Select Case statement
   */
  class BasicSelect extends BasicNode {
    constructor(expression) {
      super('Select');
      this.expression = expression;
      this.cases = [];            // BasicCase[]
    }
  }

  /**
   * Case clause
   */
  class BasicCase extends BasicNode {
    constructor(values, body) {
      super('Case');
      this.values = values;       // Array of values/expressions or null for Case Else
      this.isElse = values === null;
      this.body = body;           // BasicBlock
    }
  }

  /**
   * Try/Catch/Finally
   */
  class BasicTry extends BasicNode {
    constructor() {
      super('Try');
      this.tryBlock = null;       // BasicBlock
      this.catchClauses = [];     // BasicCatch[]
      this.finallyBlock = null;   // BasicBlock or null
    }
  }

  /**
   * Catch clause
   */
  class BasicCatch extends BasicNode {
    constructor(exceptionType, variableName, body) {
      super('Catch');
      this.exceptionType = exceptionType; // Type name or null for all
      this.variableName = variableName;   // Variable name or null
      this.body = body;           // BasicBlock
    }
  }

  /**
   * Exit statement (Exit For, Exit Do, Exit While, Exit Sub, Exit Function)
   */
  class BasicExit extends BasicNode {
    constructor(exitType) {
      super('Exit');
      this.exitType = exitType;   // 'For', 'Do', 'While', 'Sub', 'Function'
    }
  }

  /**
   * Continue (for modern dialects) or equivalent
   */
  class BasicContinue extends BasicNode {
    constructor(continueType = 'For') {
      super('Continue');
      this.continueType = continueType; // 'For', 'Do', 'While'
    }
  }

  /**
   * Throw statement
   */
  class BasicThrow extends BasicNode {
    constructor(exception) {
      super('Throw');
      this.exception = exception;
    }
  }

  /**
   * On Error statement (legacy error handling)
   */
  class BasicOnError extends BasicNode {
    constructor(mode) {
      super('OnError');
      this.mode = mode;           // 'GoTo', 'Resume Next', 'GoTo 0'
      this.label = null;          // Label for GoTo
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression
   */
  class BasicLiteral extends BasicNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;
      this.literalType = literalType; // 'int', 'long', 'string', 'boolean', 'double'
      this.suffix = null;             // Type suffix (&, %, #, etc.)
    }

    static Int(value) {
      const lit = new BasicLiteral(value, 'int');
      lit.suffix = '%';
      return lit;
    }
    static Long(value) {
      const lit = new BasicLiteral(value, 'long');
      lit.suffix = '&';
      return lit;
    }
    static Double(value) {
      const lit = new BasicLiteral(value, 'double');
      lit.suffix = '#';
      return lit;
    }
    static String(value) { return new BasicLiteral(value, 'string'); }
    static Boolean(value) { return new BasicLiteral(value, 'boolean'); }
    static Hex(value) { return new BasicLiteral(value, 'hex'); }
    static Nothing() { return new BasicLiteral(null, 'nothing'); }
  }

  /**
   * Identifier expression
   */
  class BasicIdentifier extends BasicNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression (a + b, a And b, etc.)
   */
  class BasicBinaryExpression extends BasicNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;   // '+', '-', '*', '/', 'Mod', 'And', 'Or', etc.
      this.right = right;
    }
  }

  /**
   * Unary expression (Not x, -x)
   */
  class BasicUnaryExpression extends BasicNode {
    constructor(operator, operand) {
      super('UnaryExpression');
      this.operator = operator;   // 'Not', '-', '+'
      this.operand = operand;
    }
  }

  /**
   * Member access (obj.member)
   */
  class BasicMemberAccess extends BasicNode {
    constructor(target, member) {
      super('MemberAccess');
      this.target = target;       // BasicExpression
      this.member = member;       // string (member name)
    }
  }

  /**
   * Array/Index access (arr(index))
   */
  class BasicIndexAccess extends BasicNode {
    constructor(target, indices) {
      super('IndexAccess');
      this.target = target;
      this.indices = indices;     // Array of BasicExpression (for multi-dimensional)
    }
  }

  /**
   * Function/Sub call
   */
  class BasicCall extends BasicNode {
    constructor(callee, args = []) {
      super('Call');
      this.callee = callee;       // BasicExpression or string (function name)
      this.arguments = args;      // BasicExpression[]
      this.useCallKeyword = false; // Explicit Call keyword
    }
  }

  /**
   * Method call (obj.method(args))
   */
  class BasicMethodCall extends BasicNode {
    constructor(target, methodName, args = []) {
      super('MethodCall');
      this.target = target;       // BasicExpression
      this.methodName = methodName;
      this.arguments = args;      // BasicExpression[]
    }
  }

  /**
   * New expression (object creation)
   */
  class BasicNew extends BasicNode {
    constructor(typeName, args = []) {
      super('New');
      this.typeName = typeName;   // Type name
      this.arguments = args;      // Constructor arguments
    }
  }

  /**
   * Array initialization (array literal)
   */
  class BasicArrayLiteral extends BasicNode {
    constructor(elements = []) {
      super('ArrayLiteral');
      this.elements = elements;   // BasicExpression[]
    }
  }

  /**
   * Type cast (CType, DirectCast, TryCast)
   */
  class BasicCast extends BasicNode {
    constructor(expression, targetType, castType = 'CType') {
      super('Cast');
      this.expression = expression;
      this.targetType = targetType; // BasicType
      this.castType = castType;     // 'CType', 'DirectCast', 'TryCast', 'CInt', 'CLng', etc.
    }
  }

  /**
   * Conditional expression (If(condition, trueValue, falseValue))
   */
  class BasicConditional extends BasicNode {
    constructor(condition, trueExpr, falseExpr) {
      super('Conditional');
      this.condition = condition;
      this.trueExpression = trueExpr;
      this.falseExpression = falseExpr;
    }
  }

  /**
   * Lambda expression (Function(...) ... or Sub(...) ...)
   */
  class BasicLambda extends BasicNode {
    constructor(parameters, body, isSub = false) {
      super('Lambda');
      this.parameters = parameters; // BasicParameter[]
      this.body = body;             // BasicExpression or BasicBlock
      this.isSub = isSub;
    }
  }

  /**
   * AddressOf expression (delegate creation)
   */
  class BasicAddressOf extends BasicNode {
    constructor(target) {
      super('AddressOf');
      this.target = target;       // Function/method name
    }
  }

  /**
   * TypeOf...Is expression
   */
  class BasicTypeOf extends BasicNode {
    constructor(expression, typeName) {
      super('TypeOf');
      this.expression = expression;
      this.typeName = typeName;
    }
  }

  /**
   * With statement block
   */
  class BasicWith extends BasicNode {
    constructor(expression, body) {
      super('With');
      this.expression = expression;
      this.body = body;           // BasicBlock
    }
  }

  // ========================[ COMMENTS ]========================

  /**
   * Comment or documentation
   */
  class BasicComment extends BasicNode {
    constructor(text, isDoc = false) {
      super('Comment');
      this.text = text;
      this.isDoc = isDoc;         // true for XML documentation comments
    }
  }

  // ========================[ EXPORTS ]========================

  const BasicAST = {
    // Base
    BasicNode,

    // Types
    BasicType,

    // Module
    BasicModule,
    BasicImport,
    BasicAttribute,

    // Type Declarations
    BasicTypeDeclaration,
    BasicField,
    BasicClass,
    BasicProperty,
    BasicConstructor,

    // Functions
    BasicFunction,
    BasicParameter,

    // Statements
    BasicBlock,
    BasicDim,
    BasicAssignment,
    BasicExpressionStatement,
    BasicReturn,
    BasicIf,
    BasicFor,
    BasicForEach,
    BasicWhile,
    BasicDoLoop,
    BasicSelect,
    BasicCase,
    BasicTry,
    BasicCatch,
    BasicExit,
    BasicContinue,
    BasicThrow,
    BasicOnError,

    // Expressions
    BasicLiteral,
    BasicIdentifier,
    BasicBinaryExpression,
    BasicUnaryExpression,
    BasicMemberAccess,
    BasicIndexAccess,
    BasicCall,
    BasicMethodCall,
    BasicNew,
    BasicArrayLiteral,
    BasicCast,
    BasicConditional,
    BasicLambda,
    BasicAddressOf,
    BasicTypeOf,
    BasicWith,

    // Comments
    BasicComment
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BasicAST;
  }
  if (typeof global !== 'undefined') {
    global.BasicAST = BasicAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
