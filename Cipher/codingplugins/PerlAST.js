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
      this.staticFields = [];   // PerlField[] with isStatic true - emitted as $ClassName::name package vars, not per-instance hash keys
      this.staticInitStatements = []; // Statements from an ES2022 "static { ... }" initializer block, run once after staticFields
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
      this.isStatic = false;    // ES2022 "static NAME = ..." class field - see PerlClass.staticFields
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

    // See PerlCall's toString() doc comment for why this exists: a handful
    // of call sites build a "do { stmt; stmt; ... }" Perl expression via a
    // JS template literal (e.g. PerlTransformer.js's TypedArrayCreation
    // case's "new PerlCall('do', [block])", used as the source argument of
    // a "new TypedArray(existingArray)" copy-or-zero-fill check) - PerlCall's
    // own toString() recurses into String(arg) for each argument, which
    // needs THIS class to stringify sensibly too whenever such a "do{}"
    // block ends up nested inside another template-literal interpolation
    // (e.g. TypedArraySubarray's tied-array-view construction). Without
    // this, the block rendered as the default Object.prototype.toString()
    // text "[object Object]" - e.g. kdf/argon2.js's "new
    // Uint8Array(V).subarray(0, 32)" (a TypedArrayCreation immediately
    // .subarray()'d) silently produced un-runnable Perl.
    toString() {
      return `{ ${this.statements.map(s => String(s)).join(' ')} }`;
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

    // See PerlBlock's toString() doc comment - needed for the same
    // "do{}"-nested-in-a-template-literal scenario (a PerlVarDeclaration is
    // typically the first statement inside such a block).
    toString() {
      const target = `${this.sigil}${this.name}`;
      return this.initializer != null
        ? `${this.declarator} ${target} = ${this.initializer};`
        : `${this.declarator} ${target};`;
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

    // See PerlBlock's toString() doc comment - needed for the same
    // "do{}"-nested-in-a-template-literal scenario (a PerlExpressionStatement
    // is typically the last statement inside such a block, providing the
    // do-block's value).
    toString() {
      return `${this.expression};`;
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
      // See PerlEmitter.js's emitLiteral() doc comment: a large
      // integer-valued double must round-trip through BigInt, not
      // JS's default (lossy, double-round-trip-only) decimal String().
      if (typeof this.value === 'bigint') return this.value.toString();
      if (typeof this.value === 'number' && Number.isFinite(this.value) && Number.isInteger(this.value)) {
        return BigInt(this.value).toString();
      }
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

    // Mirrors PerlEmitter.js's emitMemberAccess (see PerlCall's toString()
    // doc comment for why a duplicate, simplified copy of the real emit
    // logic exists here at all). Previously handled only '->'/'{key}' (and
    // even '{key}' was missing the leading "->", e.g. hash/lsh.js's
    // "OpCodes::u64mul" package-qualified sub reference - accessType '::' -
    // fell through to the "default" branch below, which assumed bare
    // array-index syntax ("OpCodes[u64mul]", not even valid Perl for a
    // package call) whenever this node ended up nested inside another
    // node's template-literal interpolation (e.g. as a PerlArraySlice's
    // start/end bound).
    toString() {
      if (this.accessType === '::') return `${this.object}::${this.member}`;
      if (this.accessType === '->') return `${this.object}->${this.member}`;
      if (this.accessType === '{key}') return `${this.object}->{${this.member}}`;
      if (this.accessType === '[index]') return `${this.object}->[${this.member}]`;
      return `${this.object}->${this.member}`;
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

    // A handful of call sites (e.g. PerlTransformer.js's DataViewRead
    // handling) build a raw Perl code STRING via a JS template literal
    // that interpolates other (already-transformed) PerlNode sub-
    // expressions directly - e.g. `unpack('${fmt}', substr(${view},
    // ${offset}, ${size}))`. That only works because most PerlNode
    // subclasses define toString() specifically to support it (see
    // PerlBinaryExpression/PerlMemberAccess/PerlSubscript/PerlLiteral/...
    // above) - this class (and PerlArray/PerlHash below) didn't, so
    // whenever one of THIS node type ended up nested inside such an
    // interpolation (e.g. a call expression used as a DataView read
    // offset), JS's default Object.prototype.toString() silently produced
    // the literal text "[object Object]" in the generated Perl source
    // instead of real code - a syntax-breaking bug with no error at
    // generation time, only a confusing runtime failure. Deliberately a
    // plain approximation, not a full mirror of PerlEmitter.js's real
    // emitCall (method-call "->"  prefixing, List::Util block-call syntax,
    // etc.) - good enough for its role as a nested-expression fallback.
    toString() {
      // "do { ... }" is special Perl syntax (executes a block, returning
      // its last statement's value) - NOT an ordinary function call, so it
      // takes a bare block, never parenthesized args. Mirrors
      // PerlEmitter.js's real emitCall 'do'-block special case exactly
      // (see its matching comment) - without this, a "do{}" block nested
      // inside another node's template-literal interpolation (e.g.
      // TypedArraySubarray's tied-array-view construction wrapping a
      // TypedArrayCreation "new PerlCall('do', [block])" copy-or-zero-fill
      // check) rendered as the generic "do({ ... })" call-with-parens
      // shape instead - invalid Perl syntax ("do" doesn't take a
      // parenthesized BLOCK argument the way a normal sub call does).
      if (this.callee === 'do' && this.args.length === 1 && this.args[0] instanceof PerlBlock) {
        return `do ${this.args[0]}`;
      }
      const calleeStr = this.callee === null || this.callee === undefined ? ''
        : (typeof this.callee === 'string' ? this.callee : String(this.callee));
      return `${calleeStr}(${this.args.map(a => String(a)).join(', ')})`;
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

    // See PerlCall's toString() doc comment for why this exists.
    toString() {
      return `[${this.elements.map(e => String(e)).join(', ')}]`;
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

    // See PerlCall's toString() doc comment for why this exists.
    toString() {
      return `{${this.pairs.map(p => `${p.key} => ${p.value}`).join(', ')}}`;
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

    // Mirrors PerlEmitter.js's emitConditional() exactly - needed because a
    // handful of transform-time helpers (e.g. PerlTransformer.js's
    // _buildExactBigIntExpr/BigInt '%'-of-arithmetic rewrite) build a raw
    // Math::BigInt method-call string via JS template-literal interpolation
    // ("`...->bmod(${modRight})`") instead of going through the emitter's
    // node-type dispatch. Template interpolation calls .toString() on
    // whatever node lands there; every operand-shaped node used this way
    // already defined one (PerlBinaryExpression, PerlIdentifier, PerlLiteral,
    // PerlGrouped, PerlCall, PerlMemberAccess, ...) except this one - a
    // BigInt modulus dividend that happens to contain a polymorphic
    // "x.length" (see transformExpression's 'ArrayLength' case, which
    // returns exactly this ternary shape when it can't statically prove
    // string-vs-array) silently interpolated as the default
    // Object.prototype.toString() text "[object Object]" instead of real
    // Perl code - e.g. aead/chacha20-poly1305.js's "(16 - aad.length % 16)
    // % 16" AAD-padding calculation died with a syntax/runtime error
    // instead of computing anything.
    // Parenthesized (unlike emitConditional's bare "cond ? a : b"): Perl's
    // "?:" binds far more loosely than arithmetic/string operators, so a
    // template-literal interpolation site that drops this ternary in as an
    // *operand* of a surrounding expression (e.g. "(A - ${ternary}) % 16")
    // - the exact scenario described above - would otherwise silently
    // regroup as "(A - cond) ? x : (y % 16)" instead of "A - (cond ? x :
    // y) % 16". Extra parens are always safe/no-op when this ternary is
    // instead emitted at statement level (assignment RHS, return value,
    // ...), so parenthesizing unconditionally costs nothing there.
    toString() {
      return `(${this.condition} ? ${this.consequent} : ${this.alternate})`;
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
