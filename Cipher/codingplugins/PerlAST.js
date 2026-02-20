/**
 * PerlAST.js - Perl Abstract Syntax Tree Node Types
 * Defines Perl-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Perl AST -> Perl Emitter -> Perl Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all Perl AST nodes
   */
  class PerlNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a Perl type annotation (for comments or Moose types)
   * Perl is dynamically typed, but we can use comments or Moose/Moo type constraints
   */
  class PerlType extends PerlNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                    // 'Str', 'Int', 'ArrayRef', 'HashRef', etc.
      this.isArrayRef = options.isArrayRef || false;
      this.isHashRef = options.isHashRef || false;
      this.elementType = options.elementType || null;
      this.isMaybe = options.isMaybe || false; // Maybe[T] for optional types
    }

    /**
     * Create common Perl types
     */
    static Str() { return new PerlType('Str'); }
    static Int() { return new PerlType('Int'); }
    static Num() { return new PerlType('Num'); }
    static Bool() { return new PerlType('Bool'); }
    static ArrayRef(elementType = null) {
      return new PerlType('ArrayRef', { isArrayRef: true, elementType });
    }
    static HashRef(valueType = null) {
      return new PerlType('HashRef', { isHashRef: true, elementType: valueType });
    }
    static Maybe(innerType) {
      return new PerlType('Maybe', { isMaybe: true, elementType: innerType });
    }
    static Any() { return new PerlType('Any'); }

    /**
     * Convert to Perl type string (for Moose/Moo or type comments)
     */
    toString() {
      if (this.isMaybe && this.elementType) {
        return `Maybe[${this.elementType.toString()}]`;
      }
      if (this.isArrayRef) {
        if (this.elementType) {
          return `ArrayRef[${this.elementType.toString()}]`;
        }
        return 'ArrayRef';
      }
      if (this.isHashRef) {
        if (this.elementType) {
          return `HashRef[${this.elementType.toString()}]`;
        }
        return 'HashRef';
      }
      return this.name;
    }
  }

  // ========================[ MODULE ]========================

  /**
   * Root node representing a complete Perl package/module
   */
  class PerlModule extends PerlNode {
    constructor(packageName = 'main') {
      super('Module');
      this.packageName = packageName;
      this.pragmas = [];        // 'use strict', 'use warnings', etc.
      this.uses = [];           // PerlUse[]
      this.statements = [];     // Top-level statements
    }
  }

  /**
   * Use/require statement
   */
  class PerlUse extends PerlNode {
    constructor(module, imports = null, version = null) {
      super('Use');
      this.module = module;     // Module name
      this.imports = imports;   // Array of imported symbols or null
      this.version = version;   // Version requirement or null
      this.isRequire = false;   // true for 'require' instead of 'use'
    }
  }

  // ========================[ PACKAGE/CLASS ]========================

  /**
   * Package declaration
   */
  class PerlPackage extends PerlNode {
    constructor(name) {
      super('Package');
      this.name = name;
      this.statements = [];     // Package contents
      this.docComment = null;
    }
  }

  /**
   * Class declaration (modern Perl 5.38+ or Moo/Moose)
   */
  class PerlClass extends PerlNode {
    constructor(name, options = {}) {
      super('Class');
      this.name = name;
      this.baseClass = options.baseClass || null;
      this.useModernClass = options.useModernClass || false; // class keyword vs Moo
      this.fields = [];         // PerlField[] for modern class or has declarations
      this.methods = [];        // PerlSub[]
      this.docComment = null;
    }
  }

  /**
   * Field declaration (for modern class or has attributes)
   */
  class PerlField extends PerlNode {
    constructor(name, type = null, defaultValue = null) {
      super('Field');
      this.name = name;         // Without sigil
      this.type = type;         // PerlType or null
      this.defaultValue = defaultValue;
      this.isReadOnly = false;  // For ro/rw in Moo
      this.isRequired = false;
    }
  }

  // ========================[ SUBROUTINES ]========================

  /**
   * Subroutine (function/method) declaration
   */
  class PerlSub extends PerlNode {
    constructor(name) {
      super('Sub');
      this.name = name;
      this.parameters = [];     // PerlParameter[]
      this.body = null;         // PerlBlock
      this.returnType = null;   // PerlType or null (for type comments)
      this.useSignatures = false; // Modern Perl signatures
      this.isMethod = false;    // Has $self parameter
      this.docComment = null;
    }
  }

  /**
   * Subroutine parameter
   */
  class PerlParameter extends PerlNode {
    constructor(name, sigil = '$', type = null, defaultValue = null) {
      super('Parameter');
      this.name = name;         // Without sigil
      this.sigil = sigil;       // '$', '@', '%', '&', etc.
      this.type = type;         // PerlType or null
      this.defaultValue = defaultValue;
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement
   */
  class PerlBlock extends PerlNode {
    constructor(statements = []) {
      super('Block');
      this.statements = statements;
    }
  }

  /**
   * My/our/local variable declaration
   */
  class PerlVarDeclaration extends PerlNode {
    constructor(declarator, name, sigil, initializer = null) {
      super('VarDeclaration');
      this.declarator = declarator; // 'my', 'our', 'local', 'state'
      this.name = name;             // Variable name without sigil
      this.sigil = sigil;           // '$', '@', '%'
      this.initializer = initializer; // PerlExpression or null
      this.type = null;             // PerlType for type comments
    }
  }

  /**
   * Expression statement
   */
  class PerlExpressionStatement extends PerlNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class PerlReturn extends PerlNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression;
    }
  }

  /**
   * If statement (if/elsif/else)
   */
  class PerlIf extends PerlNode {
    constructor(condition, thenBranch, elsifBranches = [], elseBranch = null) {
      super('If');
      this.condition = condition;
      this.thenBranch = thenBranch;     // PerlBlock
      this.elsifBranches = elsifBranches; // [{condition, body}]
      this.elseBranch = elseBranch;     // PerlBlock or null
      this.isUnless = false;            // true for 'unless' instead of 'if'
      this.isPostfix = false;           // true for postfix if/unless
    }
  }

  /**
   * For/foreach loop
   */
  class PerlFor extends PerlNode {
    constructor(variable, iterable, body) {
      super('For');
      this.variable = variable;   // Variable name with sigil
      this.iterable = iterable;   // PerlExpression
      this.body = body;           // PerlBlock
      this.isCStyle = false;      // true for C-style for loop
      this.init = null;           // For C-style
      this.condition = null;      // For C-style
      this.increment = null;      // For C-style
    }
  }

  /**
   * While/until loop
   */
  class PerlWhile extends PerlNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
      this.isUntil = false;       // true for 'until' instead of 'while'
      this.isDoWhile = false;     // true for do-while
    }
  }

  /**
   * Break (last in Perl)
   */
  class PerlLast extends PerlNode {
    constructor(label = null) {
      super('Last');
      this.label = label;
    }
  }

  /**
   * Continue (next in Perl)
   */
  class PerlNext extends PerlNode {
    constructor(label = null) {
      super('Next');
      this.label = label;
    }
  }

  /**
   * Redo statement
   */
  class PerlRedo extends PerlNode {
    constructor(label = null) {
      super('Redo');
      this.label = label;
    }
  }

  /**
   * Die statement (throw)
   */
  class PerlDie extends PerlNode {
    constructor(message) {
      super('Die');
      this.message = message;
    }
  }

  /**
   * Try-catch (modern Perl or Try::Tiny)
   */
  class PerlTry extends PerlNode {
    constructor() {
      super('Try');
      this.tryBlock = null;
      this.catchBlock = null;
      this.catchVariable = '$@';
      this.finallyBlock = null;
      this.useModernTry = false; // try/catch syntax vs Try::Tiny
    }
  }

  /**
   * Given/when (switch statement)
   */
  class PerlGiven extends PerlNode {
    constructor(expression) {
      super('Given');
      this.expression = expression;
      this.whenClauses = [];    // PerlWhen[]
      this.defaultClause = null;
    }
  }

  class PerlWhen extends PerlNode {
    constructor(condition, body) {
      super('When');
      this.condition = condition;
      this.body = body;
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression
   */
  class PerlLiteral extends PerlNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;
      this.literalType = literalType; // 'number', 'string', 'undef', 'regex'
      this.stringDelimiter = "'";     // Single or double quotes
    }

    static Number(value) { return new PerlLiteral(value, 'number'); }
    static String(value, delimiter = "'") {
      const lit = new PerlLiteral(value, 'string');
      lit.stringDelimiter = delimiter;
      return lit;
    }
    static Undef() { return new PerlLiteral(null, 'undef'); }
    static Hex(value) { return new PerlLiteral(value, 'hex'); }

    toString() {
      if (this.literalType === 'undef') return 'undef';
      if (this.literalType === 'string') return `${this.stringDelimiter}${this.value}${this.stringDelimiter}`;
      if (this.literalType === 'hex') return `0x${this.value.toString(16).toUpperCase()}`;
      return String(this.value);
    }
  }

  /**
   * Grouped/parenthesized expression
   */
  class PerlGrouped extends PerlNode {
    constructor(expression) {
      super('Grouped');
      this.expression = expression;
    }

    toString() {
      return `(${this.expression})`;
    }
  }

  /**
   * Identifier (variable reference)
   */
  class PerlIdentifier extends PerlNode {
    constructor(name, sigil = '') {
      super('Identifier');
      this.name = name;         // Variable name without sigil
      this.sigil = sigil;       // '$', '@', '%', '&', or '' for bareword
    }

    toString() { return this.sigil + this.name; }
  }

  /**
   * Binary expression
   */
  class PerlBinaryExpression extends PerlNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator; // '+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>', etc.
      this.right = right;
    }

    toString() { return `${this.left} ${this.operator} ${this.right}`; }
  }

  /**
   * Unary expression
   */
  class PerlUnaryExpression extends PerlNode {
    constructor(operator, operand, isPrefix = true) {
      super('UnaryExpression');
      this.operator = operator; // '!', '-', '~', 'not', '@', '%', '$#', etc.
      this.operand = operand;
      this.isPrefix = isPrefix;
    }

    toString() {
      // Sigil operators (@, %, $#) for dereferencing need braces: @{$ref}, %{$ref}, $#{$ref}
      if (this.isPrefix && ['@', '%', '$#'].includes(this.operator)) {
        // If operand is already a simple identifier with $ sigil, we can use @$ref instead of @{$ref}
        const opStr = String(this.operand);
        if (opStr.startsWith('$') && /^\$[a-zA-Z_][a-zA-Z0-9_]*$/.test(opStr)) {
          return `${this.operator}${opStr}`;
        }
        // Otherwise use braces: @{expr}
        return `${this.operator}{${this.operand}}`;
      }
      return this.isPrefix ? `${this.operator}${this.operand}` : `${this.operand}${this.operator}`;
    }
  }

  /**
   * Assignment expression
   */
  class PerlAssignment extends PerlNode {
    constructor(target, operator, value) {
      super('Assignment');
      this.target = target;
      this.operator = operator; // '=', '+=', '-=', '.=', etc.
      this.value = value;
    }

    toString() { return `${this.target} ${this.operator} ${this.value}`; }
  }

  /**
   * Member access (object->method or hash{key})
   */
  class PerlMemberAccess extends PerlNode {
    constructor(object, member, accessType) {
      super('MemberAccess');
      this.object = object;
      this.member = member;     // String or expression
      this.accessType = accessType; // '->', '{key}', '[index]'
    }

    toString() {
      if (this.accessType === '->') return `${this.object}->${this.member}`;
      if (this.accessType === '{key}') return `${this.object}{${this.member}}`;
      return `${this.object}[${this.member}]`;
    }
  }

  /**
   * Array/hash indexing
   */
  class PerlSubscript extends PerlNode {
    constructor(object, index, subscriptType, isRefDeref = false) {
      super('Subscript');
      this.object = object;
      this.index = index;
      this.subscriptType = subscriptType; // 'array' or 'hash'
      this.isRefDeref = isRefDeref;       // Use arrow notation for references
    }

    toString() {
      const accessor = this.isRefDeref ? '->' : '';
      return this.subscriptType === 'hash'
        ? `${this.object}${accessor}{${this.index}}`
        : `${this.object}${accessor}[${this.index}]`;
    }
  }

  /**
   * Function/method call
   */
  class PerlCall extends PerlNode {
    constructor(callee, args = []) {
      super('Call');
      this.callee = callee;     // PerlExpression or string
      this.args = args;         // Array of PerlExpression
      this.isMethodCall = false;
    }
  }

  /**
   * Array literal/constructor
   */
  class PerlArray extends PerlNode {
    constructor(elements = []) {
      super('Array');
      this.elements = elements;
    }
  }

  /**
   * Hash literal/constructor
   */
  class PerlHash extends PerlNode {
    constructor(pairs = []) {
      super('Hash');
      this.pairs = pairs;       // [{key, value}]
    }
  }

  /**
   * Array slice @array[start..end]
   */
  class PerlArraySlice extends PerlNode {
    constructor(array, start, end) {
      super('ArraySlice');
      this.array = array;       // The array to slice
      this.start = start;       // Start index
      this.end = end;           // End index (null for to-end)
    }

    toString() {
      const arrayStr = String(this.array);
      // Convert $array to @array for slice
      const sliceArray = arrayStr.startsWith('$') ? '@' + arrayStr.slice(1) : arrayStr;
      if (this.end === null) {
        return `${sliceArray}[${this.start} .. $#${arrayStr.replace(/^[@$]/, '')}]`;
      }
      return `${sliceArray}[${this.start} .. ${this.end}]`;
    }
  }

  /**
   * Anonymous subroutine (closure)
   */
  class PerlAnonSub extends PerlNode {
    constructor(parameters, body) {
      super('AnonSub');
      this.parameters = parameters;
      this.body = body;
    }
  }

  /**
   * Blessed reference (object construction)
   */
  class PerlBless extends PerlNode {
    constructor(reference, className) {
      super('Bless');
      this.reference = reference;
      this.className = className;
    }
  }

  /**
   * Conditional expression (ternary)
   */
  class PerlConditional extends PerlNode {
    constructor(condition, consequent, alternate) {
      super('Conditional');
      this.condition = condition;
      this.consequent = consequent;
      this.alternate = alternate;
    }
  }

  /**
   * List expression
   */
  class PerlList extends PerlNode {
    constructor(elements = []) {
      super('List');
      this.elements = elements;
    }
  }

  /**
   * Qw (quote word) expression
   */
  class PerlQw extends PerlNode {
    constructor(words) {
      super('Qw');
      this.words = words; // Array of strings
    }
  }

  /**
   * Regex literal
   */
  class PerlRegex extends PerlNode {
    constructor(pattern, modifiers = '') {
      super('Regex');
      this.pattern = pattern;
      this.modifiers = modifiers;
    }
  }

  /**
   * String interpolation
   */
  class PerlStringInterpolation extends PerlNode {
    constructor(parts) {
      super('StringInterpolation');
      this.parts = parts; // Array of strings and expressions
    }
  }

  // ========================[ DOCUMENTATION ]========================

  /**
   * POD (Plain Old Documentation) comment
   */
  class PerlPOD extends PerlNode {
    constructor(content, podType = 'head1') {
      super('POD');
      this.content = content;
      this.podType = podType; // 'head1', 'head2', 'item', 'over', etc.
    }
  }

  /**
   * Regular comment
   */
  class PerlComment extends PerlNode {
    constructor(text) {
      super('Comment');
      this.text = text;
    }
  }

  /**
   * Raw Perl code - emit as-is (for stubs, special cases)
   */
  class PerlRawCode extends PerlNode {
    constructor(code) {
      super('RawCode');
      this.code = code;
    }

    toString() {
      return this.code;
    }
  }

  // ========================[ EXPORTS ]========================

  const PerlAST = {
    // Base
    PerlNode,

    // Types
    PerlType,

    // Module
    PerlModule,
    PerlUse,

    // Package/Class
    PerlPackage,
    PerlClass,
    PerlField,

    // Subroutines
    PerlSub,
    PerlParameter,

    // Statements
    PerlBlock,
    PerlVarDeclaration,
    PerlExpressionStatement,
    PerlReturn,
    PerlIf,
    PerlFor,
    PerlWhile,
    PerlLast,
    PerlNext,
    PerlRedo,
    PerlDie,
    PerlTry,
    PerlGiven,
    PerlWhen,

    // Expressions
    PerlLiteral,
    PerlGrouped,
    PerlIdentifier,
    PerlBinaryExpression,
    PerlUnaryExpression,
    PerlAssignment,
    PerlMemberAccess,
    PerlSubscript,
    PerlCall,
    PerlArray,
    PerlHash,
    PerlArraySlice,
    PerlAnonSub,
    PerlBless,
    PerlConditional,
    PerlList,
    PerlQw,
    PerlRegex,
    PerlStringInterpolation,

    // Documentation
    PerlPOD,
    PerlComment,

    // Raw Code
    PerlRawCode
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerlAST;
  }
  if (typeof global !== 'undefined') {
    global.PerlAST = PerlAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
