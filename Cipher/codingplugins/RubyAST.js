/**
 * RubyAST.js - Ruby Abstract Syntax Tree Node Types
 * Defines Ruby-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Ruby AST -> Ruby Emitter -> Ruby Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all Ruby AST nodes
   */
  class RubyNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a Ruby type annotation (for Sorbet/RBS/YARD)
   */
  class RubyType extends RubyNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'Integer', 'String', 'Array', etc.
      this.isNilable = options.isNilable || false;   // true for T.nilable(Type)
      this.isArray = options.isArray || false;       // true for T::Array[Type]
      this.isHash = options.isHash || false;         // true for T::Hash[K, V]
      this.elementType = options.elementType || null;  // For Array
      this.keyType = options.keyType || null;        // For Hash
      this.valueType = options.valueType || null;    // For Hash
      this.isUnion = options.isUnion || false;
      this.unionTypes = options.unionTypes || [];    // For union types
    }

    /**
     * Create common primitive types
     */
    static Integer() { return new RubyType('Integer'); }
    static Float() { return new RubyType('Float'); }
    static String() { return new RubyType('String'); }
    static Symbol() { return new RubyType('Symbol'); }
    static TrueClass() { return new RubyType('TrueClass'); }
    static FalseClass() { return new RubyType('FalseClass'); }
    static NilClass() { return new RubyType('NilClass'); }
    static Array(elementType) {
      return new RubyType('Array', { isArray: true, elementType });
    }
    static Hash(keyType, valueType) {
      return new RubyType('Hash', { isHash: true, keyType, valueType });
    }
    static Nilable(innerType) {
      return new RubyType(innerType.name, { isNilable: true });
    }

    /**
     * Convert to Ruby type string (YARD format)
     */
    toString() {
      if (this.isNilable) {
        return `${this.name}, nil`;
      }
      if (this.isArray) {
        return `Array<${this.elementType?.toString() || 'Object'}>`;
      }
      if (this.isHash) {
        return `Hash{${this.keyType?.toString() || 'Symbol'} => ${this.valueType?.toString() || 'Object'}}`;
      }
      if (this.isUnion && this.unionTypes.length > 0) {
        return this.unionTypes.map(t => t.toString()).join(', ');
      }
      return this.name;
    }
  }

  // ========================[ MODULE ]========================

  /**
   * Root node representing a complete Ruby file (module)
   */
  class RubyModule extends RubyNode {
    constructor(name = null) {
      super('Module');
      this.name = name;          // Module name (null for root)
      this.requires = [];        // RubyRequire[]
      this.items = [];           // Top-level items (classes, modules, functions, etc.)
      this.magicComments = [];   // # frozen_string_literal: true, etc.
      this.docComment = null;    // Module documentation
    }
  }

  /**
   * Require/load statement
   */
  class RubyRequire extends RubyNode {
    constructor(path, isRelative = false) {
      super('Require');
      this.path = path;          // 'digest', 'openssl', etc.
      this.isRelative = isRelative; // true for require_relative
    }
  }

  /**
   * Magic comment (# frozen_string_literal: true)
   */
  class RubyMagicComment extends RubyNode {
    constructor(name, value) {
      super('MagicComment');
      this.name = name;
      this.value = value;
    }
  }

  // ========================[ CLASS DECLARATION ]========================

  /**
   * Class definition
   */
  class RubyClass extends RubyNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.superclass = null;    // Parent class name
      this.modules = [];         // Included/extended modules
      this.methods = [];         // RubyMethod[]
      this.attributes = [];      // attr_accessor, attr_reader, attr_writer
      this.constants = [];       // Constants
      this.classVariables = [];  // @@variables
      this.docComment = null;    // Class documentation
    }
  }

  /**
   * Module definition
   */
  class RubyModuleDef extends RubyNode {
    constructor(name) {
      super('ModuleDef');
      this.name = name;
      this.methods = [];
      this.constants = [];
      this.docComment = null;
    }
  }

  /**
   * Attribute declaration (attr_accessor, attr_reader, attr_writer)
   */
  class RubyAttribute extends RubyNode {
    constructor(type, names) {
      super('Attribute');
      this.type = type;          // 'accessor', 'reader', 'writer'
      this.names = names;        // Array of attribute names (symbols)
    }
  }

  // ========================[ METHODS/FUNCTIONS ]========================

  /**
   * Method definition
   */
  class RubyMethod extends RubyNode {
    constructor(name, parameters = [], returnType = null) {
      super('Method');
      this.name = name;
      this.parameters = parameters; // RubyParameter[]
      this.returnType = returnType; // RubyType or null
      this.body = null;             // RubyBlock
      this.visibility = 'public';   // 'public', 'private', 'protected'
      this.isClassMethod = false;   // true for self.method
      this.isSingletonMethod = false;
      this.docComment = null;       // Method documentation
      this.isEndless = false;       // true for def foo(x) = x * 2
    }
  }

  /**
   * Function parameter
   */
  class RubyParameter extends RubyNode {
    constructor(name, type = null, defaultValue = null) {
      super('Parameter');
      this.name = name;
      this.type = type;             // RubyType or null
      this.defaultValue = defaultValue; // RubyExpression or null
      this.isKeyword = false;       // true for keyword arguments
      this.isRest = false;          // true for *args
      this.isKeywordRest = false;   // true for **kwargs
      this.isBlock = false;         // true for &block
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block of statements
   */
  class RubyBlock extends RubyNode {
    constructor() {
      super('Block');
      this.statements = [];
    }
  }

  /**
   * Assignment statement
   */
  class RubyAssignment extends RubyNode {
    constructor(target, value, type = null) {
      super('Assignment');
      this.target = target;         // RubyExpression (usually Identifier)
      this.value = value;           // RubyExpression
      this.type = type;             // RubyType or null
      this.operator = '=';          // '=', '+=', '-=', etc.
    }
  }

  /**
   * Expression statement
   */
  class RubyExpressionStatement extends RubyNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class RubyReturn extends RubyNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression;
    }
  }

  /**
   * If statement/expression
   */
  class RubyIf extends RubyNode {
    constructor(condition, thenBranch, elsifBranches = [], elseBranch = null) {
      super('If');
      this.condition = condition;       // RubyExpression
      this.thenBranch = thenBranch;     // RubyBlock
      this.elsifBranches = elsifBranches; // [{condition, body}]
      this.elseBranch = elseBranch;     // RubyBlock or null
      this.isUnless = false;            // true for unless instead of if
      this.isModifier = false;          // true for statement if condition
    }
  }

  /**
   * Case/when statement
   */
  class RubyCase extends RubyNode {
    constructor(expression) {
      super('Case');
      this.expression = expression;  // Value being matched
      this.whenBranches = [];        // RubyWhen[]
      this.elseBranch = null;        // Default case
    }
  }

  /**
   * When clause
   */
  class RubyWhen extends RubyNode {
    constructor(patterns, body) {
      super('When');
      this.patterns = patterns;      // Array of patterns to match
      this.body = body;              // RubyBlock
    }
  }

  /**
   * For loop
   */
  class RubyFor extends RubyNode {
    constructor(variable, iterable, body) {
      super('For');
      this.variable = variable;      // Variable name
      this.iterable = iterable;      // RubyExpression
      this.body = body;              // RubyBlock
    }
  }

  /**
   * While loop
   */
  class RubyWhile extends RubyNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
      this.isUntil = false;          // true for until instead of while
    }
  }

  /**
   * Loop statement
   */
  class RubyLoop extends RubyNode {
    constructor(body) {
      super('Loop');
      this.body = body;
    }
  }

  /**
   * Break statement
   */
  class RubyBreak extends RubyNode {
    constructor(expression = null) {
      super('Break');
      this.expression = expression;
    }
  }

  /**
   * Next (continue) statement
   */
  class RubyNext extends RubyNode {
    constructor(expression = null) {
      super('Next');
      this.expression = expression;
    }
  }

  /**
   * Raise (throw) statement
   */
  class RubyRaise extends RubyNode {
    constructor(exception, message = null) {
      super('Raise');
      this.exception = exception;    // Exception class or instance
      this.message = message;        // Error message
    }
  }

  /**
   * Begin/rescue/ensure/end block
   */
  class RubyBegin extends RubyNode {
    constructor() {
      super('Begin');
      this.tryBlock = null;          // RubyBlock
      this.rescueClauses = [];       // RubyRescue[]
      this.elseBlock = null;         // Executes if no exception
      this.ensureBlock = null;       // Always executes
    }
  }

  /**
   * Rescue clause
   */
  class RubyRescue extends RubyNode {
    constructor(exceptionTypes, variableName, body) {
      super('Rescue');
      this.exceptionTypes = exceptionTypes; // Array of exception classes
      this.variableName = variableName;     // Variable to bind exception to
      this.body = body;                     // RubyBlock
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression
   */
  class RubyLiteral extends RubyNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;
      this.literalType = literalType; // 'integer', 'float', 'string', 'symbol', 'regexp', 'nil', 'true', 'false'
    }

    static Integer(value) { return new RubyLiteral(value, 'integer'); }
    static Float(value) { return new RubyLiteral(value, 'float'); }
    static String(value) { return new RubyLiteral(value, 'string'); }
    static Symbol(value) { return new RubyLiteral(value, 'symbol'); }
    static Nil() { return new RubyLiteral(null, 'nil'); }
    static True() { return new RubyLiteral(true, 'true'); }
    static False() { return new RubyLiteral(false, 'false'); }
    static Regexp(pattern, flags = '') {
      const lit = new RubyLiteral(pattern, 'regexp');
      lit.flags = flags;
      return lit;
    }
  }

  /**
   * Identifier expression
   */
  class RubyIdentifier extends RubyNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
      this.isInstance = false;       // true for @variable
      this.isClass = false;          // true for @@variable
      this.isGlobal = false;         // true for $variable
      this.isConstant = false;       // true for CONSTANT
    }
  }

  /**
   * Binary expression
   */
  class RubyBinaryExpression extends RubyNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;      // '+', '-', '*', '/', '%', '**', '&', '|', '^', '<<', '>>', etc.
      this.right = right;
    }
  }

  /**
   * Unary expression
   */
  class RubyUnaryExpression extends RubyNode {
    constructor(operator, operand) {
      super('UnaryExpression');
      this.operator = operator;      // '!', '-', '+', '~', etc.
      this.operand = operand;
    }
  }

  /**
   * Method call
   */
  class RubyMethodCall extends RubyNode {
    constructor(receiver, methodName, args = [], block = null) {
      super('MethodCall');
      this.receiver = receiver;      // RubyExpression or null for implicit self
      this.methodName = methodName;
      this.arguments = args;         // RubyExpression[]
      this.block = block;            // RubyBlockExpression or null
      this.isSafeNavigation = false; // true for &.
    }
  }

  /**
   * Array literal
   */
  class RubyArrayLiteral extends RubyNode {
    constructor(elements = []) {
      super('ArrayLiteral');
      this.elements = elements;      // RubyExpression[]
    }
  }

  /**
   * Hash literal
   */
  class RubyHashLiteral extends RubyNode {
    constructor(pairs = []) {
      super('HashLiteral');
      this.pairs = pairs;            // [{key, value}]
    }
  }

  /**
   * Range expression
   */
  class RubyRange extends RubyNode {
    constructor(start, end, isExclusive = false) {
      super('Range');
      this.start = start;            // RubyExpression
      this.end = end;                // RubyExpression
      this.isExclusive = isExclusive; // true for ...
    }
  }

  /**
   * String interpolation
   */
  class RubyStringInterpolation extends RubyNode {
    constructor(parts) {
      super('StringInterpolation');
      this.parts = parts;            // Array of strings and RubyExpressions
    }
  }

  /**
   * Block expression (do...end or {...})
   */
  class RubyBlockExpression extends RubyNode {
    constructor(parameters, body) {
      super('BlockExpression');
      this.parameters = parameters;  // RubyParameter[]
      this.body = body;              // RubyBlock
      this.isBraces = false;         // true for {}, false for do...end
    }
  }

  /**
   * Lambda expression
   */
  class RubyLambda extends RubyNode {
    constructor(parameters, body) {
      super('Lambda');
      this.parameters = parameters;
      this.body = body;
      this.isStabby = true;          // true for ->(x) {}, false for lambda {|x|}
    }
  }

  /**
   * Index access (array[index] or hash[key])
   */
  class RubyIndex extends RubyNode {
    constructor(target, index) {
      super('Index');
      this.target = target;
      this.index = index;
    }
  }

  /**
   * Conditional expression (ternary)
   */
  class RubyConditional extends RubyNode {
    constructor(condition, thenExpr, elseExpr) {
      super('Conditional');
      this.condition = condition;
      this.thenExpression = thenExpr;
      this.elseExpression = elseExpr;
    }
  }

  /**
   * Splat expression (*array)
   */
  class RubySplat extends RubyNode {
    constructor(expression) {
      super('Splat');
      this.expression = expression;
      this.isDoubleSplat = false;    // true for **
    }
  }

  /**
   * Constant access (Module::Constant)
   */
  class RubyConstantAccess extends RubyNode {
    constructor(namespace, constant) {
      super('ConstantAccess');
      this.namespace = namespace;    // Module/Class name or null
      this.constant = constant;      // Constant name
    }
  }

  /**
   * Pattern matching (case/in)
   */
  class RubyPatternMatch extends RubyNode {
    constructor(expression) {
      super('PatternMatch');
      this.expression = expression;
      this.inBranches = [];          // RubyInBranch[]
      this.elseBranch = null;
    }
  }

  /**
   * In branch for pattern matching
   */
  class RubyInBranch extends RubyNode {
    constructor(pattern, guard, body) {
      super('InBranch');
      this.pattern = pattern;
      this.guard = guard;            // Optional if condition
      this.body = body;
    }
  }

  /**
   * Yield statement
   */
  class RubyYield extends RubyNode {
    constructor(args = []) {
      super('Yield');
      this.arguments = args;
    }
  }

  /**
   * Super call
   */
  class RubySuper extends RubyNode {
    constructor(args = null) {
      super('Super');
      this.arguments = args;         // null = pass all args, [] = no args
    }
  }

  /**
   * Defined? expression
   */
  class RubyDefined extends RubyNode {
    constructor(expression) {
      super('Defined');
      this.expression = expression;
    }
  }

  // ========================[ DOCUMENTATION ]========================

  /**
   * Documentation comment
   */
  class RubyDocComment extends RubyNode {
    constructor(text, isYard = false) {
      super('DocComment');
      this.text = text;
      this.isYard = isYard;          // true for YARD-style documentation
    }
  }

  /**
   * Constant declaration
   */
  class RubyConstant extends RubyNode {
    constructor(name, value) {
      super('Constant');
      this.name = name;
      this.value = value;
      this.docComment = null;
    }
  }

  /**
   * Raw Ruby code - emit as-is (for framework stubs)
   */
  class RubyRawCode extends RubyNode {
    constructor(code) {
      super('RawCode');
      this.code = code;
    }
  }

  // ========================[ EXPORTS ]========================

  const RubyAST = {
    // Base
    RubyNode,

    // Types
    RubyType,

    // Module
    RubyModule,
    RubyRequire,
    RubyMagicComment,

    // Classes and Modules
    RubyClass,
    RubyModuleDef,
    RubyAttribute,

    // Methods
    RubyMethod,
    RubyParameter,

    // Statements
    RubyBlock,
    RubyAssignment,
    RubyExpressionStatement,
    RubyReturn,
    RubyIf,
    RubyCase,
    RubyWhen,
    RubyFor,
    RubyWhile,
    RubyLoop,
    RubyBreak,
    RubyNext,
    RubyRaise,
    RubyBegin,
    RubyRescue,

    // Expressions
    RubyLiteral,
    RubyIdentifier,
    RubyBinaryExpression,
    RubyUnaryExpression,
    RubyMethodCall,
    RubyArrayLiteral,
    RubyHashLiteral,
    RubyRange,
    RubyStringInterpolation,
    RubyBlockExpression,
    RubyLambda,
    RubyIndex,
    RubyConditional,
    RubySplat,
    RubyConstantAccess,
    RubyPatternMatch,
    RubyInBranch,
    RubyYield,
    RubySuper,
    RubyDefined,

    // Documentation
    RubyDocComment,
    RubyConstant,

    // Raw Code
    RubyRawCode
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RubyAST;
  }
  if (typeof global !== 'undefined') {
    global.RubyAST = RubyAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
