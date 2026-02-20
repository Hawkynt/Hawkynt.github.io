/**
 * RustAST.js - Rust Abstract Syntax Tree Node Types
 * Defines Rust-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Rust AST -> Rust Emitter -> Rust Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all Rust AST nodes
   */
  class RustNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a Rust type reference
   */
  class RustType extends RustNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'u8', 'u32', 'String', etc.
      this.isReference = options.isReference || false;   // true for &T
      this.isMutable = options.isMutable || false;       // true for &mut T
      this.isSlice = options.isSlice || false;           // true for &[T]
      this.isVec = options.isVec || false;               // true for Vec<T>
      this.isOption = options.isOption || false;         // true for Option<T>
      this.isResult = options.isResult || false;         // true for Result<T, E>
      this.isGeneric = options.isGeneric || false;
      this.genericArguments = options.genericArguments || []; // For Vec<T>, HashMap<K,V>
      this.isTuple = options.isTuple || false;
      this.tupleElements = options.tupleElements || []; // [type1, type2, ...] for tuples
      this.lifetime = options.lifetime || null;          // For 'a in &'a T
    }

    /**
     * Create common primitive types
     */
    static U8() { return new RustType('u8'); }
    static U16() { return new RustType('u16'); }
    static U32() { return new RustType('u32'); }
    static U64() { return new RustType('u64'); }
    static U128() { return new RustType('u128'); }
    static Usize() { return new RustType('usize'); }
    static I8() { return new RustType('i8'); }
    static I16() { return new RustType('i16'); }
    static I32() { return new RustType('i32'); }
    static I64() { return new RustType('i64'); }
    static I128() { return new RustType('i128'); }
    static Isize() { return new RustType('isize'); }
    static F32() { return new RustType('f32'); }
    static F64() { return new RustType('f64'); }
    static Bool() { return new RustType('bool'); }
    static Char() { return new RustType('char'); }
    static Str() { return new RustType('str', { isReference: true }); } // &str
    static String() { return new RustType('String'); }
    static Unit() { return new RustType('()'); } // Unit type

    static Slice(elementType) {
      return new RustType(elementType.toString(), { isSlice: true, isReference: true });
    }

    static MutSlice(elementType) {
      return new RustType(elementType.toString(), { isSlice: true, isReference: true, isMutable: true });
    }

    static Vec(elementType) {
      return new RustType('Vec', { isGeneric: true, genericArguments: [elementType], isVec: true });
    }

    static Option(innerType) {
      return new RustType('Option', { isGeneric: true, genericArguments: [innerType], isOption: true });
    }

    static Result(okType, errType) {
      return new RustType('Result', { isGeneric: true, genericArguments: [okType, errType], isResult: true });
    }

    static Tuple(elements) {
      return new RustType('tuple', { isTuple: true, tupleElements: elements });
    }

    static Ref(innerType, lifetime = null) {
      const type = new RustType(innerType.toString(), { isReference: true });
      type.lifetime = lifetime;
      type.innerType = innerType;
      return type;
    }

    static MutRef(innerType, lifetime = null) {
      const type = new RustType(innerType.toString(), { isReference: true, isMutable: true });
      type.lifetime = lifetime;
      type.innerType = innerType;
      return type;
    }

    /**
     * Convert to Rust type string
     */
    toString() {
      let result = '';

      if (this.isReference) {
        result += '&';
        if (this.lifetime) {
          result += `'${this.lifetime} `;
        }
        if (this.isMutable) {
          result += 'mut ';
        }
      }

      if (this.isSlice) {
        result += `[${this.name}]`;
      } else if (this.isTuple) {
        const parts = this.tupleElements.map(t => t.toString());
        result += `(${parts.join(', ')})`;
      } else {
        result += this.name;

        if (this.isGeneric && this.genericArguments.length > 0) {
          result += `<${this.genericArguments.map(t => t.toString()).join(', ')}>`;
        }
      }

      return result;
    }
  }

  // ========================[ COMPILATION UNIT ]========================

  /**
   * Root node representing a complete Rust file (module)
   */
  class RustModule extends RustNode {
    constructor(name = null) {
      super('Module');
      this.name = name;          // Module name (null for root)
      this.attributes = [];      // #[...] attributes
      this.uses = [];            // RustUseDeclaration[]
      this.items = [];           // Top-level items (structs, functions, etc.)
    }
  }

  /**
   * Use declaration: use std::collections::HashMap;
   */
  class RustUseDeclaration extends RustNode {
    constructor(path, items = null) {
      super('UseDeclaration');
      this.path = path;          // 'std::collections', 'std::io'
      this.items = items;        // ['HashMap', 'HashSet'] or null for wildcard
      this.isWildcard = items === '*';
      this.alias = null;         // For: use foo as bar;
    }
  }

  /**
   * Attribute: #[derive(Debug, Clone)]
   */
  class RustAttribute extends RustNode {
    constructor(name, args = []) {
      super('Attribute');
      this.name = name;          // 'derive', 'inline', 'test'
      this.arguments = args;     // ['Debug', 'Clone']
      this.isOuter = true;       // true for #[...], false for #![...]
    }
  }

  // ========================[ TYPE DECLARATIONS ]========================

  /**
   * Struct declaration
   */
  class RustStruct extends RustNode {
    constructor(name) {
      super('Struct');
      this.name = name;
      this.visibility = 'pub';   // 'pub', 'pub(crate)', 'pub(super)', or '' for private
      this.attributes = [];      // #[derive(...)]
      this.fields = [];          // RustStructField[]
      this.docComment = null;    // /// documentation
      this.isUnit = false;       // true for unit structs (no fields)
      this.isTuple = false;      // true for tuple structs
    }
  }

  /**
   * Struct field
   */
  class RustStructField extends RustNode {
    constructor(name, type) {
      super('StructField');
      this.name = name;
      this.type = type;          // RustType
      this.visibility = 'pub';
      this.attributes = [];
    }
  }

  /**
   * Enum declaration
   */
  class RustEnum extends RustNode {
    constructor(name) {
      super('Enum');
      this.name = name;
      this.visibility = 'pub';
      this.attributes = [];
      this.variants = [];        // RustEnumVariant[]
      this.docComment = null;
    }
  }

  /**
   * Enum variant
   */
  class RustEnumVariant extends RustNode {
    constructor(name) {
      super('EnumVariant');
      this.name = name;
      this.fields = [];          // For struct-like variants
      this.tupleFields = [];     // For tuple-like variants
      this.discriminant = null;  // For variants with explicit values
    }
  }

  /**
   * Trait declaration
   */
  class RustTrait extends RustNode {
    constructor(name) {
      super('Trait');
      this.name = name;
      this.visibility = 'pub';
      this.methods = [];         // RustTraitMethod[]
      this.docComment = null;
    }
  }

  /**
   * Impl block
   */
  class RustImpl extends RustNode {
    constructor(typeName, traitName = null) {
      super('Impl');
      this.typeName = typeName;  // Type being implemented for
      this.traitName = traitName; // Trait being implemented (null for inherent impl)
      this.methods = [];         // RustFunction[]
      this.associatedTypes = []; // For trait impls
    }
  }

  // ========================[ FUNCTIONS ]========================

  /**
   * Function declaration
   */
  class RustFunction extends RustNode {
    constructor(name, returnType = null) {
      super('Function');
      this.name = name;
      this.returnType = returnType || RustType.Unit(); // RustType
      this.visibility = 'pub';
      this.isAsync = false;
      this.isUnsafe = false;
      this.isConst = false;
      this.parameters = [];      // RustParameter[]
      this.body = null;          // RustBlock
      this.docComment = null;
      this.attributes = [];
      this.isSelfMethod = false; // true for methods (has &self or &mut self)
      this.selfParameter = null; // '&self', '&mut self', 'self', or null
    }
  }

  /**
   * Function parameter
   */
  class RustParameter extends RustNode {
    constructor(name, type) {
      super('Parameter');
      this.name = name;
      this.type = type;          // RustType
      this.isMutable = false;
      this.pattern = null;       // For pattern matching in parameters
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement { ... }
   */
  class RustBlock extends RustNode {
    constructor() {
      super('Block');
      this.statements = [];      // RustStatement[]
      this.hasTrailingExpression = false; // true if last statement is expression without ;
    }
  }

  /**
   * Let binding
   */
  class RustLet extends RustNode {
    constructor(pattern, type = null, initializer = null) {
      super('Let');
      this.pattern = pattern;    // Pattern (usually just identifier name)
      this.type = type;          // RustType (optional with type inference)
      this.initializer = initializer; // RustExpression
      this.isMutable = false;
    }
  }

  /**
   * Expression statement (expression;)
   */
  class RustExpressionStatement extends RustNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class RustReturn extends RustNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression; // RustExpression or null
    }
  }

  /**
   * If expression
   */
  class RustIf extends RustNode {
    constructor(condition, thenBranch, elseBranch = null) {
      super('If');
      this.condition = condition;       // RustExpression
      this.thenBranch = thenBranch;     // RustBlock
      this.elseBranch = elseBranch;     // RustBlock or RustIf or null
    }
  }

  /**
   * For loop
   */
  class RustFor extends RustNode {
    constructor(pattern, iterator, body) {
      super('For');
      this.pattern = pattern;    // Variable name or pattern
      this.iterator = iterator;  // RustExpression
      this.body = body;          // RustBlock
    }
  }

  /**
   * While loop
   */
  class RustWhile extends RustNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Loop (infinite loop)
   */
  class RustLoop extends RustNode {
    constructor(body) {
      super('Loop');
      this.body = body;
      this.label = null;         // For labeled loops
    }
  }

  /**
   * Match expression
   */
  class RustMatch extends RustNode {
    constructor(expression) {
      super('Match');
      this.expression = expression;
      this.arms = [];            // RustMatchArm[]
    }
  }

  /**
   * Match arm
   */
  class RustMatchArm extends RustNode {
    constructor(pattern, body) {
      super('MatchArm');
      this.pattern = pattern;    // Pattern to match
      this.guard = null;         // Optional if condition
      this.body = body;          // RustExpression or RustBlock
    }
  }

  /**
   * Break statement
   */
  class RustBreak extends RustNode {
    constructor(expression = null) {
      super('Break');
      this.expression = expression; // Optional value to break with
      this.label = null;
    }
  }

  /**
   * Continue statement
   */
  class RustContinue extends RustNode {
    constructor() {
      super('Continue');
      this.label = null;
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression
   */
  class RustLiteral extends RustNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;
      this.literalType = literalType; // 'int', 'uint', 'string', 'bool', 'char', etc.
      this.suffix = null;             // 'u8', 'u32', 'i64', etc.
    }

    static Int(value, suffix = null) { return new RustLiteral(value, 'int', suffix); }
    static UInt(value, suffix = 'u32') { const l = new RustLiteral(value, 'uint'); l.suffix = suffix; return l; }
    static String(value) { return new RustLiteral(value, 'string'); }
    static Str(value) { return new RustLiteral(value, 'str'); } // Raw &str without .to_string()
    static Bool(value) { return new RustLiteral(value, 'bool'); }
    static Char(value) { return new RustLiteral(value, 'char'); }
    static Hex(value, suffix = 'u32') {
      const l = new RustLiteral(value, 'hex');
      l.suffix = suffix;
      return l;
    }
  }

  /**
   * Identifier expression
   */
  class RustIdentifier extends RustNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression (a + b, a & b, etc.)
   */
  class RustBinaryExpression extends RustNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;  // '+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>', etc.
      this.right = right;
    }
  }

  /**
   * Unary expression (!x, -x, *x, &x, etc.)
   */
  class RustUnaryExpression extends RustNode {
    constructor(operator, operand) {
      super('UnaryExpression');
      this.operator = operator;  // '!', '-', '&', '&mut', '*', etc.
      this.operand = operand;
    }
  }

  /**
   * Assignment expression (x = y)
   */
  class RustAssignment extends RustNode {
    constructor(target, operator, value) {
      super('Assignment');
      this.target = target;
      this.operator = operator;  // '=', '+=', '-=', '*=', etc.
      this.value = value;
    }
  }

  /**
   * Field access (obj.field)
   */
  class RustFieldAccess extends RustNode {
    constructor(target, field) {
      super('FieldAccess');
      this.target = target;      // RustExpression
      this.field = field;        // string (field name)
    }
  }

  /**
   * Index access (arr[index])
   */
  class RustIndex extends RustNode {
    constructor(target, index) {
      super('Index');
      this.target = target;
      this.index = index;        // RustExpression
    }
  }

  /**
   * Method call (obj.method(args))
   */
  class RustMethodCall extends RustNode {
    constructor(target, methodName, args = []) {
      super('MethodCall');
      this.target = target;      // RustExpression
      this.methodName = methodName;
      this.arguments = args;     // RustExpression[]
      this.turbofish = null;     // For ::<T> generic arguments
    }
  }

  /**
   * Function call (func(args))
   */
  class RustCall extends RustNode {
    constructor(callee, args = []) {
      super('Call');
      this.callee = callee;      // RustExpression or path
      this.arguments = args;     // RustExpression[]
    }
  }

  /**
   * Struct literal (Point { x: 1, y: 2 })
   */
  class RustStructLiteral extends RustNode {
    constructor(typeName, fields = []) {
      super('StructLiteral');
      this.typeName = typeName;  // Type name or path
      this.fields = fields;      // [{name, value}]
      this.spread = null;        // For ..other syntax
    }
  }

  /**
   * Array literal ([1, 2, 3] or [0; 10])
   */
  class RustArrayLiteral extends RustNode {
    constructor(elements = []) {
      super('ArrayLiteral');
      this.elements = elements;  // RustExpression[]
      this.repeatValue = null;   // For [value; count]
      this.repeatCount = null;
    }
  }

  /**
   * Vec macro (vec![1, 2, 3])
   */
  class RustVecMacro extends RustNode {
    constructor(elements = []) {
      super('VecMacro');
      this.elements = elements;  // RustExpression[]
    }
  }

  /**
   * Cast expression (value as Type)
   */
  class RustCast extends RustNode {
    constructor(expression, targetType) {
      super('Cast');
      this.expression = expression;
      this.targetType = targetType; // RustType
    }
  }

  /**
   * Reference expression (&x or &mut x)
   */
  class RustReference extends RustNode {
    constructor(expression, isMutable = false) {
      super('Reference');
      this.expression = expression;
      this.isMutable = isMutable;
    }
  }

  /**
   * Dereference expression (*x)
   */
  class RustDereference extends RustNode {
    constructor(expression) {
      super('Dereference');
      this.expression = expression;
    }
  }

  /**
   * Range expression (a..b, a..=b, .., etc.)
   */
  class RustRange extends RustNode {
    constructor(start, end, isInclusive = false) {
      super('Range');
      this.start = start;        // RustExpression or null
      this.end = end;            // RustExpression or null
      this.isInclusive = isInclusive; // true for ..=
    }
  }

  /**
   * Tuple expression ((a, b, c))
   */
  class RustTuple extends RustNode {
    constructor(elements) {
      super('Tuple');
      this.elements = elements;  // RustExpression[]
    }
  }

  /**
   * Closure expression (|x| x + 1)
   */
  class RustClosure extends RustNode {
    constructor(parameters, body) {
      super('Closure');
      this.parameters = parameters; // RustParameter[]
      this.body = body;             // RustExpression or RustBlock
      this.isMove = false;          // move closure
    }
  }

  /**
   * Macro invocation (println!("Hello"))
   */
  class RustMacroCall extends RustNode {
    constructor(macroName, tokens, separator = ', ') {
      super('MacroCall');
      this.macroName = macroName; // 'println', 'vec', etc.
      this.tokens = tokens;       // Raw token string or structured args
      this.separator = separator; // Separator between tokens (', ' default, '; ' for vec repeat)
    }
  }

  /**
   * If expression (if cond { a } else { b })
   * Note: In Rust, if is an expression, not just a statement
   */
  class RustIfExpression extends RustNode {
    constructor(condition, thenExpr, elseExpr = null) {
      super('IfExpression');
      this.condition = condition;
      this.thenExpression = thenExpr;
      this.elseExpression = elseExpr;
    }
  }

  /**
   * Block expression (used as expression)
   */
  class RustBlockExpression extends RustNode {
    constructor(block) {
      super('BlockExpression');
      this.block = block;        // RustBlock
    }
  }

  // ========================[ DOCUMENTATION ]========================

  /**
   * Doc comment (/// or //!)
   */
  class RustDocComment extends RustNode {
    constructor(text, isOuter = true) {
      super('DocComment');
      this.text = text;
      this.isOuter = isOuter;    // true for ///, false for //!
    }
  }

  /**
   * Const declaration (const NAME: Type = value;)
   */
  class RustConst extends RustNode {
    constructor(name, type, value) {
      super('Const');
      this.name = name;
      this.type = type;
      this.value = value;
      this.visibility = 'pub';  // Usually pub for module-level constants
    }
  }

  // ========================[ EXPORTS ]========================

  const RustAST = {
    // Base
    RustNode,

    // Types
    RustType,

    // Module
    RustModule,
    RustUseDeclaration,
    RustAttribute,

    // Type Declarations
    RustStruct,
    RustStructField,
    RustEnum,
    RustEnumVariant,
    RustTrait,
    RustImpl,

    // Functions
    RustFunction,
    RustParameter,

    // Statements
    RustBlock,
    RustLet,
    RustExpressionStatement,
    RustReturn,
    RustIf,
    RustFor,
    RustWhile,
    RustLoop,
    RustMatch,
    RustMatchArm,
    RustBreak,
    RustContinue,

    // Expressions
    RustLiteral,
    RustIdentifier,
    RustBinaryExpression,
    RustUnaryExpression,
    RustAssignment,
    RustFieldAccess,
    RustIndex,
    RustMethodCall,
    RustCall,
    RustStructLiteral,
    RustArrayLiteral,
    RustVecMacro,
    RustCast,
    RustReference,
    RustDereference,
    RustRange,
    RustTuple,
    RustClosure,
    RustMacroCall,
    RustIfExpression,
    RustBlockExpression,

    // Documentation
    RustDocComment,

    // Constants
    RustConst
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RustAST;
  }
  if (typeof global !== 'undefined') {
    global.RustAST = RustAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
