/**
 * CAST.js - C Abstract Syntax Tree Node Types
 * Defines C-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C AST -> C Emitter -> C Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all C AST nodes
   */
  class CNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a C type reference
   */
  class CType extends CNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'uint8_t', 'uint32_t', 'char*', etc.
      this.isPointer = options.isPointer || false;   // true for T*
      this.isConst = options.isConst || false;       // true for const T
      this.isVolatile = options.isVolatile || false; // true for volatile T
      this.isStatic = options.isStatic || false;     // true for static T
      this.isExtern = options.isExtern || false;     // true for extern T
      this.isArray = options.isArray || false;       // true for T[]
      this.arraySize = options.arraySize || null;    // Size for arrays [n]
      this.pointerLevel = options.pointerLevel || 0; // Number of * levels
    }

    /**
     * Create common primitive types
     */
    static UInt8() { return new CType('uint8_t'); }
    static UInt16() { return new CType('uint16_t'); }
    static UInt32() { return new CType('uint32_t'); }
    static UInt64() { return new CType('uint64_t'); }
    static Int8() { return new CType('int8_t'); }
    static Int16() { return new CType('int16_t'); }
    static Int32() { return new CType('int32_t'); }
    static Int64() { return new CType('int64_t'); }
    static Char() { return new CType('char'); }
    static Bool() { return new CType('bool'); }
    static Void() { return new CType('void'); }
    static SizeT() { return new CType('size_t'); }
    static PtrDiffT() { return new CType('ptrdiff_t'); }

    static Pointer(targetType) {
      const type = new CType(targetType.name || targetType.toString(), { isPointer: true, pointerLevel: 1 });
      type.baseType = targetType;
      return type;
    }

    static ConstPointer(targetType) {
      const type = new CType(targetType.name || targetType.toString(), { isPointer: true, isConst: true, pointerLevel: 1 });
      type.baseType = targetType;
      return type;
    }

    static Array(elementType, size = null) {
      const type = new CType(elementType.name || elementType.toString(), { isArray: true, arraySize: size });
      type.baseType = elementType;
      return type;
    }

    /**
     * Convert to C type string
     */
    toString() {
      let result = '';

      // Qualifiers
      if (this.isStatic) result += 'static ';
      if (this.isExtern) result += 'extern ';
      if (this.isConst) result += 'const ';
      if (this.isVolatile) result += 'volatile ';

      // Base type
      result += this.name;

      // Pointers
      if (this.isPointer || this.pointerLevel > 0) {
        result += '*'.repeat(this.pointerLevel || 1);
      }

      return result.trim();
    }
  }

  // ========================[ COMPILATION UNIT ]========================

  /**
   * Root node representing a complete C file
   */
  class CFile extends CNode {
    constructor() {
      super('File');
      this.includes = [];       // CInclude[]
      this.defines = [];        // CDefine[]
      this.typedefs = [];       // CTypedef[]
      this.structs = [];        // CStruct[]
      this.enums = [];          // CEnum[]
      this.prototypes = [];     // CFunction[] (declarations only)
      this.globals = [];        // CVariable[]
      this.functions = [];      // CFunction[] (with definitions)
      this.headerComment = null; // File header comment
    }
  }

  /**
   * Include directive: #include <stdio.h> or #include "myheader.h"
   */
  class CInclude extends CNode {
    constructor(path, isSystem = true) {
      super('Include');
      this.path = path;         // "stdio.h", "myheader.h"
      this.isSystem = isSystem; // true for <>, false for ""
    }
  }

  /**
   * Define directive: #define NAME value
   */
  class CDefine extends CNode {
    constructor(name, value = null) {
      super('Define');
      this.name = name;
      this.value = value;       // Can be null for simple defines
      this.parameters = [];     // For function-like macros
      this.isFunctionLike = false;
    }
  }

  /**
   * Typedef: typedef struct {...} Name;
   */
  class CTypedef extends CNode {
    constructor(name, targetType) {
      super('Typedef');
      this.name = name;
      this.targetType = targetType; // CType or CStruct
    }
  }

  // ========================[ TYPE DECLARATIONS ]========================

  /**
   * Struct declaration
   */
  class CStruct extends CNode {
    constructor(name) {
      super('Struct');
      this.name = name;
      this.fields = [];         // CField[]
      this.docComment = null;   // Documentation comment
      this.isTypedef = false;   // true if typedef struct
      this.tag = null;          // struct tag (optional)
    }
  }

  /**
   * Struct field
   */
  class CField extends CNode {
    constructor(name, type) {
      super('Field');
      this.name = name;
      this.type = type;         // CType
      this.bitWidth = null;     // For bitfields
      this.docComment = null;
    }
  }

  /**
   * Enum declaration
   */
  class CEnum extends CNode {
    constructor(name) {
      super('Enum');
      this.name = name;
      this.values = [];         // CEnumValue[]
      this.docComment = null;
      this.isTypedef = false;
    }
  }

  /**
   * Enum value
   */
  class CEnumValue extends CNode {
    constructor(name, value = null) {
      super('EnumValue');
      this.name = name;
      this.value = value;       // Explicit value or null for auto-increment
    }
  }

  // ========================[ FUNCTIONS ]========================

  /**
   * Function declaration/definition
   */
  class CFunction extends CNode {
    constructor(name, returnType = null) {
      super('Function');
      this.name = name;
      this.returnType = returnType || CType.Void(); // CType
      this.parameters = [];     // CParameter[]
      this.body = null;         // CBlock (null for prototypes)
      this.isStatic = false;
      this.isInline = false;
      this.isExtern = false;
      this.docComment = null;
    }
  }

  /**
   * Function parameter
   */
  class CParameter extends CNode {
    constructor(name, type) {
      super('Parameter');
      this.name = name;
      this.type = type;         // CType
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement { ... }
   */
  class CBlock extends CNode {
    constructor() {
      super('Block');
      this.statements = [];     // CStatement[]
    }
  }

  /**
   * Variable declaration: int x = 5;
   */
  class CVariable extends CNode {
    constructor(name, type, initializer = null) {
      super('Variable');
      this.name = name;
      this.type = type;         // CType
      this.initializer = initializer; // CExpression
    }
  }

  /**
   * Expression statement (expression;)
   */
  class CExpressionStatement extends CNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class CReturn extends CNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression; // CExpression or null
    }
  }

  /**
   * If statement
   */
  class CIf extends CNode {
    constructor(condition, thenBranch, elseBranch = null) {
      super('If');
      this.condition = condition;       // CExpression
      this.thenBranch = thenBranch;     // CBlock or CStatement
      this.elseBranch = elseBranch;     // CBlock or CStatement or null
    }
  }

  /**
   * For loop
   */
  class CFor extends CNode {
    constructor(init, condition, update, body) {
      super('For');
      this.init = init;         // CVariable or CExpression or null
      this.condition = condition; // CExpression or null
      this.update = update;     // CExpression or null
      this.body = body;         // CBlock
    }
  }

  /**
   * While loop
   */
  class CWhile extends CNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Do-while loop
   */
  class CDoWhile extends CNode {
    constructor(condition, body) {
      super('DoWhile');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Switch statement
   */
  class CSwitch extends CNode {
    constructor(expression) {
      super('Switch');
      this.expression = expression;
      this.cases = [];          // CCase[]
    }
  }

  /**
   * Case label
   */
  class CCase extends CNode {
    constructor(value, statements = []) {
      super('Case');
      this.value = value;       // CExpression or null (for default)
      this.statements = statements; // CStatement[]
      this.isDefault = value === null;
    }
  }

  /**
   * Break statement
   */
  class CBreak extends CNode {
    constructor() {
      super('Break');
    }
  }

  /**
   * Continue statement
   */
  class CContinue extends CNode {
    constructor() {
      super('Continue');
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression
   */
  class CLiteral extends CNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;
      this.literalType = literalType; // 'int', 'uint', 'string', 'char', 'bool', 'hex'
      this.suffix = null;             // 'U', 'L', 'UL', etc.
    }

    static Int(value) { return new CLiteral(value, 'int'); }
    static UInt(value, suffix = 'U') { const l = new CLiteral(value, 'uint'); l.suffix = suffix; return l; }
    static String(value) { return new CLiteral(value, 'string'); }
    static Char(value) { return new CLiteral(value, 'char'); }
    static Bool(value) { return new CLiteral(value, 'bool'); }
    static Hex(value, suffix = 'U') { const l = new CLiteral(value, 'hex'); l.suffix = suffix; return l; }
    static Null() { return new CLiteral(null, 'null'); }
  }

  /**
   * Identifier expression
   */
  class CIdentifier extends CNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression (a + b, a & b, etc.)
   */
  class CBinaryExpression extends CNode {
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
  class CUnaryExpression extends CNode {
    constructor(operator, operand) {
      super('UnaryExpression');
      this.operator = operator;  // '!', '-', '~', '&', '*', '++', '--', etc.
      this.operand = operand;
      this.isPrefix = true;      // false for postfix (x++, x--)
    }
  }

  /**
   * Assignment expression (x = y)
   */
  class CAssignment extends CNode {
    constructor(target, operator, value) {
      super('Assignment');
      this.target = target;
      this.operator = operator;  // '=', '+=', '-=', '*=', etc.
      this.value = value;
    }
  }

  /**
   * Member access (struct.field or ptr->field)
   */
  class CMemberAccess extends CNode {
    constructor(target, member, isPointer = false) {
      super('MemberAccess');
      this.target = target;      // CExpression
      this.member = member;      // string (member name)
      this.isPointer = isPointer; // true for ->, false for .
    }
  }

  /**
   * Array subscript (arr[index])
   */
  class CArraySubscript extends CNode {
    constructor(array, index) {
      super('ArraySubscript');
      this.array = array;
      this.index = index;
    }
  }

  /**
   * Function call (func(args))
   */
  class CCall extends CNode {
    constructor(callee, args = []) {
      super('Call');
      this.callee = callee;      // CExpression or string
      this.arguments = args;     // CExpression[]
    }
  }

  /**
   * Cast expression ((type)expr)
   */
  class CCast extends CNode {
    constructor(type, expression) {
      super('Cast');
      this.type = type;          // CType
      this.expression = expression;
    }
  }

  /**
   * Sizeof expression (sizeof(type) or sizeof expr)
   */
  class CSizeof extends CNode {
    constructor(target, isType = true) {
      super('Sizeof');
      this.target = target;      // CType or CExpression
      this.isType = isType;      // true for sizeof(type), false for sizeof expr
    }
  }

  /**
   * Conditional expression (a ? b : c)
   */
  class CConditional extends CNode {
    constructor(condition, thenExpr, elseExpr) {
      super('Conditional');
      this.condition = condition;
      this.thenExpression = thenExpr;
      this.elseExpression = elseExpr;
    }
  }

  /**
   * Array initializer {1, 2, 3}
   */
  class CArrayInitializer extends CNode {
    constructor(elements = []) {
      super('ArrayInitializer');
      this.elements = elements;  // CExpression[]
    }
  }

  /**
   * Struct initializer {.field1 = val1, .field2 = val2}
   */
  class CStructInitializer extends CNode {
    constructor(fields = []) {
      super('StructInitializer');
      this.fields = fields;      // [{name, value}]
    }
  }

  /**
   * Comma expression (a, b, c)
   */
  class CComma extends CNode {
    constructor(expressions) {
      super('Comma');
      this.expressions = expressions; // CExpression[]
    }
  }

  // ========================[ DOCUMENTATION ]========================

  /**
   * Comment (line or block style)
   */
  class CComment extends CNode {
    constructor(text, isBlock = false) {
      super('Comment');
      this.text = text;
      this.isBlock = isBlock;    // true for block comments, false for line comments
    }
  }

  // ========================[ EXPORTS ]========================

  const CAST = {
    // Base
    CNode,

    // Types
    CType,

    // File
    CFile,
    CInclude,
    CDefine,
    CTypedef,

    // Type Declarations
    CStruct,
    CField,
    CEnum,
    CEnumValue,

    // Functions
    CFunction,
    CParameter,

    // Statements
    CBlock,
    CVariable,
    CExpressionStatement,
    CReturn,
    CIf,
    CFor,
    CWhile,
    CDoWhile,
    CSwitch,
    CCase,
    CBreak,
    CContinue,

    // Expressions
    CLiteral,
    CIdentifier,
    CBinaryExpression,
    CUnaryExpression,
    CAssignment,
    CMemberAccess,
    CArraySubscript,
    CCall,
    CCast,
    CSizeof,
    CConditional,
    CArrayInitializer,
    CStructInitializer,
    CComma,

    // Documentation
    CComment
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CAST;
  }
  if (typeof global !== 'undefined') {
    global.CAST = CAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
