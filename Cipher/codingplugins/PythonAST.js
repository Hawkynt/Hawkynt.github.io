/**
 * PythonAST.js - Python Abstract Syntax Tree Node Types
 * Defines Python-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Python AST -> Python Emitter -> Python Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all Python AST nodes
   */
  class PythonNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a Python type annotation
   */
  class PythonType extends PythonNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'int', 'str', 'bytes', 'bool', etc.
      this.isOptional = options.isOptional || false; // true for Optional[T]
      this.isList = options.isList || false;     // true for List[T]
      this.isDict = options.isDict || false;     // true for Dict[K,V]
      this.elementType = options.elementType || null; // For List[T]
      this.keyType = options.keyType || null;    // For Dict[K,V]
      this.valueType = options.valueType || null; // For Dict[K,V]
      this.isTuple = options.isTuple || false;
      this.tupleElements = options.tupleElements || []; // For Tuple[T1, T2, ...]
    }

    /**
     * Create common primitive types
     */
    static Int() { return new PythonType('int'); }
    static Float() { return new PythonType('float'); }
    static Bool() { return new PythonType('bool'); }
    static Str() { return new PythonType('str'); }
    static Bytes() { return new PythonType('bytes'); }
    static ByteArray() { return new PythonType('bytearray'); }
    static None() { return new PythonType('None'); }
    static Any() { return new PythonType('Any'); }

    static List(elementType) {
      return new PythonType('List', { isList: true, elementType });
    }

    static Dict(keyType, valueType) {
      return new PythonType('Dict', { isDict: true, keyType, valueType });
    }

    static Tuple(elements) {
      return new PythonType('Tuple', { isTuple: true, tupleElements: elements });
    }

    static Optional(innerType) {
      return new PythonType('Optional', { isOptional: true, elementType: innerType });
    }

    /**
     * Convert to Python type annotation string
     */
    toString() {
      if (this.isOptional) {
        return `Optional[${this.elementType.toString()}]`;
      }
      if (this.isList) {
        return `List[${this.elementType.toString()}]`;
      }
      if (this.isDict) {
        return `Dict[${this.keyType.toString()}, ${this.valueType.toString()}]`;
      }
      if (this.isTuple) {
        const elements = this.tupleElements.map(e => e.toString()).join(', ');
        return `Tuple[${elements}]`;
      }
      return this.name;
    }
  }

  // ========================[ MODULE ]========================

  /**
   * Root node representing a complete Python module
   */
  class PythonModule extends PythonNode {
    constructor() {
      super('Module');
      this.imports = [];        // PythonImport[]
      this.statements = [];     // Top-level statements and definitions
      this.docstring = null;    // Module docstring
    }
  }

  /**
   * Import statement: from X import Y, import Z
   */
  class PythonImport extends PythonNode {
    constructor(module, items = null, alias = null) {
      super('Import');
      this.module = module;     // Module name string
      this.items = items;       // Array of {name, alias} or null for 'import module'
      this.alias = alias;       // Alias for 'import X as Y'
      this.isFromImport = items !== null; // true for 'from X import Y'
    }
  }

  // ========================[ CLASS DECLARATION ]========================

  /**
   * Class definition
   */
  class PythonClass extends PythonNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.baseClasses = [];    // Base class names
      this.methods = [];        // PythonMethod[]
      this.classVariables = []; // PythonAssignment[] for class-level variables
      this.docstring = null;    // Class docstring
    }
  }

  // ========================[ METHOD/FUNCTION ]========================

  /**
   * Function or method definition
   */
  class PythonFunction extends PythonNode {
    constructor(name, parameters = [], returnType = null) {
      super('Function');
      this.name = name;
      this.parameters = parameters; // PythonParameter[]
      this.returnType = returnType; // PythonType or null
      this.body = null;             // PythonBlock
      this.isAsync = false;
      this.isMethod = false;        // true for methods (has self parameter)
      this.isStaticMethod = false;
      this.isClassMethod = false;
      this.isProperty = false;
      this.decorators = [];         // Decorator names
      this.docstring = null;        // Function docstring
    }
  }

  /**
   * Function parameter
   */
  class PythonParameter extends PythonNode {
    constructor(name, type = null, defaultValue = null) {
      super('Parameter');
      this.name = name;
      this.type = type;             // PythonType or null
      this.defaultValue = defaultValue; // PythonExpression or null
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block of statements (used for function bodies, etc.)
   */
  class PythonBlock extends PythonNode {
    constructor() {
      super('Block');
      this.statements = [];
    }
  }

  /**
   * Assignment statement
   */
  class PythonAssignment extends PythonNode {
    constructor(target, value, type = null) {
      super('Assignment');
      this.target = target;         // PythonExpression (usually Identifier)
      this.value = value;           // PythonExpression
      this.type = type;             // PythonType or null (for typed assignments)
      this.isAugmented = false;     // true for +=, -=, etc.
      this.operator = '=';          // '=', '+=', '-=', etc.
    }
  }

  /**
   * Expression statement
   */
  class PythonExpressionStatement extends PythonNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class PythonReturn extends PythonNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression;
    }
  }

  /**
   * If statement
   */
  class PythonIf extends PythonNode {
    constructor(condition, thenBranch, elifBranches = [], elseBranch = null) {
      super('If');
      this.condition = condition;       // PythonExpression
      this.thenBranch = thenBranch;     // PythonBlock
      this.elifBranches = elifBranches; // [{condition, body}]
      this.elseBranch = elseBranch;     // PythonBlock or null
    }
  }

  /**
   * For loop
   */
  class PythonFor extends PythonNode {
    constructor(variable, iterable, body) {
      super('For');
      this.variable = variable;     // Variable name (string)
      this.iterable = iterable;     // PythonExpression
      this.body = body;             // PythonBlock
    }
  }

  /**
   * While loop
   */
  class PythonWhile extends PythonNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Break statement
   */
  class PythonBreak extends PythonNode {
    constructor() { super('Break'); }
  }

  /**
   * Continue statement
   */
  class PythonContinue extends PythonNode {
    constructor() { super('Continue'); }
  }

  /**
   * Raise (throw) statement
   */
  class PythonRaise extends PythonNode {
    constructor(exception) {
      super('Raise');
      this.exception = exception;
    }
  }

  /**
   * Try-Except-Finally
   */
  class PythonTryExcept extends PythonNode {
    constructor() {
      super('TryExcept');
      this.tryBlock = null;
      this.exceptClauses = [];      // PythonExceptClause[]
      this.finallyBlock = null;
    }
  }

  class PythonExceptClause extends PythonNode {
    constructor(exceptionType, variableName, body) {
      super('ExceptClause');
      this.exceptionType = exceptionType;
      this.variableName = variableName;
      this.body = body;
    }
  }

  /**
   * Pass statement (no-op)
   */
  class PythonPass extends PythonNode {
    constructor() { super('Pass'); }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression
   */
  class PythonLiteral extends PythonNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;
      this.literalType = literalType; // 'int', 'float', 'str', 'bool', 'None', 'bytes'
    }

    static Int(value) { return new PythonLiteral(value, 'int'); }
    static Float(value) { return new PythonLiteral(value, 'float'); }
    static Str(value) { return new PythonLiteral(value, 'str'); }
    static Bool(value) { return new PythonLiteral(value, 'bool'); }
    static None() { return new PythonLiteral(null, 'None'); }
    static Bytes(value) { return new PythonLiteral(value, 'bytes'); }
    static Hex(value) { return new PythonLiteral(value, 'hex'); }
  }

  /**
   * Identifier (variable name)
   */
  class PythonIdentifier extends PythonNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression
   */
  class PythonBinaryExpression extends PythonNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;     // '+', '-', '*', '/', '//', '%', '**', '&', '|', '^', '<<', '>>', etc.
      this.right = right;
    }
  }

  /**
   * Unary expression
   */
  class PythonUnaryExpression extends PythonNode {
    constructor(operator, operand) {
      super('UnaryExpression');
      this.operator = operator;     // 'not', '-', '~'
      this.operand = operand;
    }
  }

  /**
   * Member access (obj.attr)
   */
  class PythonMemberAccess extends PythonNode {
    constructor(object, attribute) {
      super('MemberAccess');
      this.object = object;         // PythonExpression
      this.attribute = attribute;   // string (attribute name)
    }
  }

  /**
   * Subscript (indexing) arr[index]
   */
  class PythonSubscript extends PythonNode {
    constructor(object, index) {
      super('Subscript');
      this.object = object;
      this.index = index;
    }
  }

  /**
   * Function call
   */
  class PythonCall extends PythonNode {
    constructor(func, args = [], kwargs = []) {
      super('Call');
      this.func = func;             // PythonExpression
      this.args = args;             // Positional arguments
      this.kwargs = kwargs;         // Keyword arguments [{name, value}]
    }
  }

  /**
   * List literal
   */
  class PythonList extends PythonNode {
    constructor(elements = []) {
      super('List');
      this.elements = elements;
    }
  }

  /**
   * Dict literal
   */
  class PythonDict extends PythonNode {
    constructor(items = []) {
      super('Dict');
      this.items = items;           // [{key, value}]
    }
  }

  /**
   * Tuple literal
   */
  class PythonTuple extends PythonNode {
    constructor(elements = []) {
      super('Tuple');
      this.elements = elements;
    }
  }

  /**
   * List comprehension
   */
  class PythonListComprehension extends PythonNode {
    constructor(expression, variable, iterable, condition = null) {
      super('ListComprehension');
      this.expression = expression;
      this.variable = variable;
      this.iterable = iterable;
      this.condition = condition;
    }
  }

  /**
   * Conditional expression (ternary)
   */
  class PythonConditional extends PythonNode {
    constructor(trueExpr, condition, falseExpr) {
      super('Conditional');
      this.trueExpression = trueExpr;
      this.condition = condition;
      this.falseExpression = falseExpr;
    }
  }

  /**
   * Lambda expression
   */
  class PythonLambda extends PythonNode {
    constructor(parameters, body) {
      super('Lambda');
      this.parameters = parameters; // PythonParameter[]
      this.body = body;             // PythonExpression
    }
  }

  /**
   * Slice expression (for array slicing)
   */
  class PythonSlice extends PythonNode {
    constructor(start = null, stop = null, step = null) {
      super('Slice');
      this.start = start;
      this.stop = stop;
      this.step = step;
    }
  }

  // ========================[ EXPORTS ]========================

  const PythonAST = {
    // Base
    PythonNode,

    // Types
    PythonType,

    // Module
    PythonModule,
    PythonImport,

    // Class
    PythonClass,

    // Function
    PythonFunction,
    PythonParameter,

    // Statements
    PythonBlock,
    PythonAssignment,
    PythonExpressionStatement,
    PythonReturn,
    PythonIf,
    PythonFor,
    PythonWhile,
    PythonBreak,
    PythonContinue,
    PythonRaise,
    PythonTryExcept,
    PythonExceptClause,
    PythonPass,

    // Expressions
    PythonLiteral,
    PythonIdentifier,
    PythonBinaryExpression,
    PythonUnaryExpression,
    PythonMemberAccess,
    PythonSubscript,
    PythonCall,
    PythonList,
    PythonDict,
    PythonTuple,
    PythonListComprehension,
    PythonConditional,
    PythonLambda,
    PythonSlice
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PythonAST;
  }
  if (typeof global !== 'undefined') {
    global.PythonAST = PythonAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
