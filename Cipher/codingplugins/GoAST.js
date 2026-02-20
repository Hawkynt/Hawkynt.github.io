/**
 * GoAST.js - Go Abstract Syntax Tree Node Types
 * Defines Go-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Go AST -> Go Emitter -> Go Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all Go AST nodes
   */
  class GoNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a Go type reference
   */
  class GoType extends GoNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'int', 'uint32', 'byte', 'string', etc.
      this.isSlice = options.isSlice || false;   // true for []T
      this.isArray = options.isArray || false;   // true for [n]T
      this.arraySize = options.arraySize || 0;   // Size for arrays
      this.isPointer = options.isPointer || false; // true for *T
      this.isMap = options.isMap || false;       // true for map[K]V
      this.keyType = options.keyType || null;    // For map[K]V
      this.valueType = options.valueType || null; // For map[K]V or []T
      this.isInterface = options.isInterface || false; // true for interface{}
      this.isChan = options.isChan || false;     // true for chan T
      this.chanDir = options.chanDir || '';      // '<-' for recv-only, 'send' for send-only
    }

    /**
     * Create common primitive types
     */
    static Byte() { return new GoType('byte'); }
    static UInt8() { return new GoType('uint8'); }
    static Int8() { return new GoType('int8'); }
    static UInt16() { return new GoType('uint16'); }
    static Int16() { return new GoType('int16'); }
    static UInt32() { return new GoType('uint32'); }
    static Int32() { return new GoType('int32'); }
    static UInt64() { return new GoType('uint64'); }
    static Int64() { return new GoType('int64'); }
    static Int() { return new GoType('int'); }
    static UInt() { return new GoType('uint'); }
    static Float32() { return new GoType('float32'); }
    static Float64() { return new GoType('float64'); }
    static Bool() { return new GoType('bool'); }
    static String() { return new GoType('string'); }
    static Rune() { return new GoType('rune'); }
    static Interface() { return new GoType('interface{}', { isInterface: true }); }
    static Error() { return new GoType('error'); }

    static Slice(elementType) {
      const type = new GoType(elementType.toString(), { isSlice: true });
      type.valueType = elementType;
      return type;
    }

    static Array(elementType, size) {
      const type = new GoType(elementType.toString(), { isArray: true, arraySize: size });
      type.valueType = elementType;
      return type;
    }

    static Pointer(targetType) {
      const type = new GoType(targetType.toString(), { isPointer: true });
      type.valueType = targetType;
      return type;
    }

    static Map(keyType, valueType) {
      return new GoType('map', { isMap: true, keyType, valueType });
    }

    static Chan(elementType, direction = '') {
      return new GoType('chan', { isChan: true, chanDir: direction, valueType: elementType });
    }

    /**
     * Convert to Go type string
     */
    toString() {
      if (this.isSlice) {
        return `[]${this.valueType ? this.valueType.toString() : this.name}`;
      }

      if (this.isArray) {
        return `[${this.arraySize}]${this.valueType ? this.valueType.toString() : this.name}`;
      }

      if (this.isPointer) {
        return `*${this.valueType ? this.valueType.toString() : this.name}`;
      }

      if (this.isMap) {
        return `map[${this.keyType.toString()}]${this.valueType.toString()}`;
      }

      if (this.isChan) {
        const dir = this.chanDir === '<-' ? '<-' : '';
        return `${dir}chan ${this.valueType.toString()}`;
      }

      return this.name;
    }
  }

  // ========================[ COMPILATION UNIT ]========================

  /**
   * Root node representing a complete Go file
   */
  class GoFile extends GoNode {
    constructor() {
      super('File');
      this.package = 'main';   // Package name
      this.imports = [];       // GoImport[]
      this.declarations = [];  // GoDeclaration[] (types, consts, vars, funcs)
    }
  }

  /**
   * Import declaration: import "fmt"
   */
  class GoImport extends GoNode {
    constructor(path, alias = null) {
      super('Import');
      this.path = path;       // "fmt", "crypto/sha256"
      this.alias = alias;     // For: import f "fmt"
      this.isDot = false;     // For: import . "fmt"
    }
  }

  // ========================[ TYPE DECLARATIONS ]========================

  /**
   * Struct declaration
   */
  class GoStruct extends GoNode {
    constructor(name) {
      super('Struct');
      this.name = name;
      this.fields = [];       // GoField[]
      this.methods = [];      // GoMethod[]
      this.isExported = true; // PascalCase = exported
      this.docComment = null; // Documentation
    }
  }

  /**
   * Interface declaration
   */
  class GoInterface extends GoNode {
    constructor(name) {
      super('Interface');
      this.name = name;
      this.methods = [];      // GoMethod[] (without body)
      this.isExported = true;
      this.docComment = null;
    }
  }

  /**
   * Type alias: type Name = OtherType
   */
  class GoTypeAlias extends GoNode {
    constructor(name, targetType) {
      super('TypeAlias');
      this.name = name;
      this.targetType = targetType; // GoType
      this.isExported = true;
      this.docComment = null;
    }
  }

  // ========================[ MEMBER DECLARATIONS ]========================

  /**
   * Struct field
   */
  class GoField extends GoNode {
    constructor(name, type) {
      super('Field');
      this.name = name;
      this.type = type;       // GoType
      this.tag = null;        // `json:"name"` style tags
      this.isExported = true;
      this.isEmbedded = false; // For anonymous embedding
      this.docComment = null;
    }
  }

  /**
   * Function/Method declaration
   */
  class GoFunc extends GoNode {
    constructor(name, returnType = null) {
      super('Func');
      this.name = name;
      this.receiver = null;     // GoParameter (for methods)
      this.parameters = [];     // GoParameter[]
      this.results = [];        // GoParameter[] or GoType[]
      this.body = null;         // GoBlock
      this.isExported = true;
      this.docComment = null;
    }
  }

  /**
   * Function parameter or result
   */
  class GoParameter extends GoNode {
    constructor(name, type) {
      super('Parameter');
      this.name = name;       // Can be empty for results
      this.type = type;       // GoType
      this.isVariadic = false; // For ...T
    }
  }

  /**
   * Constant declaration
   */
  class GoConst extends GoNode {
    constructor(name, type, value) {
      super('Const');
      this.name = name;
      this.type = type;       // GoType (can be null for type inference)
      this.value = value;     // GoExpression
      this.isExported = true;
      this.docComment = null;
    }
  }

  /**
   * Variable declaration
   */
  class GoVar extends GoNode {
    constructor(name, type, initializer = null) {
      super('Var');
      this.name = name;
      this.type = type;       // GoType (can be null for := syntax)
      this.initializer = initializer; // GoExpression
      this.isShortDecl = false; // := vs var
      this.isExported = false;  // Usually lowercase
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement { ... }
   */
  class GoBlock extends GoNode {
    constructor() {
      super('Block');
      this.statements = [];   // GoStatement[]
    }
  }

  /**
   * Expression statement
   */
  class GoExpressionStatement extends GoNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class GoReturn extends GoNode {
    constructor(results = []) {
      super('Return');
      this.results = results; // GoExpression[] (can be multiple)
    }
  }

  /**
   * If statement
   */
  class GoIf extends GoNode {
    constructor(condition, thenBranch, elseBranch = null) {
      super('If');
      this.init = null;       // Optional init statement
      this.condition = condition; // GoExpression
      this.thenBranch = thenBranch; // GoBlock
      this.elseBranch = elseBranch; // GoBlock or GoIf
    }
  }

  /**
   * For loop (covers while, for, for-range)
   */
  class GoFor extends GoNode {
    constructor() {
      super('For');
      this.init = null;       // GoStatement
      this.condition = null;  // GoExpression
      this.post = null;       // GoStatement
      this.body = null;       // GoBlock
      this.isRange = false;   // for range
      this.rangeKey = null;   // for k, v := range
      this.rangeValue = null;
      this.rangeExpr = null;
    }
  }

  /**
   * Switch statement
   */
  class GoSwitch extends GoNode {
    constructor(expression = null) {
      super('Switch');
      this.init = null;       // Optional init statement
      this.expression = expression; // GoExpression (null for type switch)
      this.cases = [];        // GoCase[]
    }
  }

  /**
   * Switch case
   */
  class GoCase extends GoNode {
    constructor(values = []) {
      super('Case');
      this.values = values;   // GoExpression[] (empty for default)
      this.isDefault = values.length === 0;
      this.statements = [];   // GoStatement[]
    }
  }

  /**
   * Defer statement
   */
  class GoDefer extends GoNode {
    constructor(call) {
      super('Defer');
      this.call = call;       // GoCallExpression
    }
  }

  /**
   * Go statement (goroutine)
   */
  class GoGo extends GoNode {
    constructor(call) {
      super('Go');
      this.call = call;       // GoCallExpression
    }
  }

  /**
   * Break statement
   */
  class GoBreak extends GoNode {
    constructor(label = null) {
      super('Break');
      this.label = label;
    }
  }

  /**
   * Continue statement
   */
  class GoContinue extends GoNode {
    constructor(label = null) {
      super('Continue');
      this.label = label;
    }
  }

  /**
   * Select statement (channel operations)
   */
  class GoSelect extends GoNode {
    constructor() {
      super('Select');
      this.cases = [];        // GoCase[] with channel operations
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression
   */
  class GoLiteral extends GoNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;
      this.literalType = literalType; // 'int', 'uint32', 'string', 'bool', 'nil', etc.
      this.isHex = false;
    }

    static Int(value) { return new GoLiteral(value, 'int'); }
    static UInt32(value) { return new GoLiteral(value, 'uint32'); }
    static UInt64(value) { return new GoLiteral(value, 'uint64'); }
    static Float64(value) { return new GoLiteral(value, 'float64'); }
    static String(value) { return new GoLiteral(value, 'string'); }
    static Bool(value) { return new GoLiteral(value, 'bool'); }
    static Nil() { return new GoLiteral(null, 'nil'); }
    static Hex(value, bits = 32) {
      const type = bits <= 32 ? 'uint32' : 'uint64';
      const l = new GoLiteral(value, type);
      l.isHex = true;
      return l;
    }
  }

  /**
   * Identifier expression
   */
  class GoIdentifier extends GoNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression (a + b, a && b, etc.)
   */
  class GoBinaryExpression extends GoNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;
      this.right = right;
    }
  }

  /**
   * Unary expression (!x, -x, &x, *x, etc.)
   */
  class GoUnaryExpression extends GoNode {
    constructor(operator, operand) {
      super('UnaryExpression');
      this.operator = operator; // '!', '-', '&', '*', '<-', etc.
      this.operand = operand;
    }
  }

  /**
   * Spread operator for variadic expansion (arg...)
   */
  class GoSpread extends GoNode {
    constructor(operand) {
      super('UnaryExpression');
      this.operator = '...';
      this.operand = operand;
      this.isPostfix = true;
    }
  }

  /**
   * Assignment expression (x = y, x := y)
   */
  class GoAssignment extends GoNode {
    constructor(targets, operator, values) {
      super('Assignment');
      this.targets = targets;   // GoExpression[]
      this.operator = operator; // '=', ':=', '+=', etc.
      this.values = values;     // GoExpression[]
    }
  }

  /**
   * Selector expression (obj.field)
   */
  class GoSelectorExpression extends GoNode {
    constructor(target, selector) {
      super('SelectorExpression');
      this.target = target;
      this.selector = selector; // string
    }
  }

  /**
   * Index expression (arr[index])
   */
  class GoIndexExpression extends GoNode {
    constructor(target, index) {
      super('IndexExpression');
      this.target = target;
      this.index = index;
    }
  }

  /**
   * Slice expression (arr[low:high])
   */
  class GoSliceExpression extends GoNode {
    constructor(target, low, high, max = null) {
      super('SliceExpression');
      this.target = target;
      this.low = low;
      this.high = high;
      this.max = max;         // For three-index slice
    }
  }

  /**
   * Call expression (func(args))
   */
  class GoCallExpression extends GoNode {
    constructor(function_, args = []) {
      super('CallExpression');
      this.function = function_; // GoExpression
      this.arguments = args;      // GoExpression[]
    }
  }

  /**
   * Type assertion (x.(T))
   */
  class GoTypeAssertion extends GoNode {
    constructor(expression, type) {
      super('TypeAssertion');
      this.expression = expression;
      this.type = type;       // GoType
    }
  }

  /**
   * Type conversion (T(x))
   */
  class GoTypeConversion extends GoNode {
    constructor(type, expression) {
      super('TypeConversion');
      this.type = type;       // GoType
      this.expression = expression;
    }
  }

  /**
   * Composite literal ([]int{1, 2, 3}, MyStruct{field: value})
   */
  class GoCompositeLiteral extends GoNode {
    constructor(type, elements = []) {
      super('CompositeLiteral');
      this.type = type;       // GoType
      this.elements = elements; // GoKeyValue[] or GoExpression[]
    }
  }

  /**
   * Key-value pair for composite literals
   */
  class GoKeyValue extends GoNode {
    constructor(key, value) {
      super('KeyValue');
      this.key = key;         // GoExpression or string
      this.value = value;     // GoExpression
    }
  }

  /**
   * Function literal (anonymous function)
   */
  class GoFuncLit extends GoNode {
    constructor(parameters, results, body) {
      super('FuncLit');
      this.parameters = parameters; // GoParameter[]
      this.results = results;       // GoParameter[] or GoType[]
      this.body = body;             // GoBlock
    }
  }

  /**
   * Make expression (make([]T, size))
   */
  class GoMake extends GoNode {
    constructor(type, size = null, capacity = null) {
      super('Make');
      this.type = type;       // GoType
      this.size = size;       // GoExpression
      this.capacity = capacity; // GoExpression
    }
  }

  /**
   * New expression (new(T))
   */
  class GoNew extends GoNode {
    constructor(type) {
      super('New');
      this.type = type;       // GoType
    }
  }

  /**
   * Raw Go code - emit as-is (for framework stubs)
   */
  class GoRawCode extends GoNode {
    constructor(code) {
      super('RawCode');
      this.code = code;
    }
  }

  // ========================[ EXPORTS ]========================

  const GoAST = {
    // Base
    GoNode,

    // Types
    GoType,

    // File Structure
    GoFile,
    GoImport,

    // Type Declarations
    GoStruct,
    GoInterface,
    GoTypeAlias,

    // Members
    GoField,
    GoFunc,
    GoParameter,
    GoConst,
    GoVar,

    // Statements
    GoBlock,
    GoExpressionStatement,
    GoReturn,
    GoIf,
    GoFor,
    GoSwitch,
    GoCase,
    GoDefer,
    GoGo,
    GoBreak,
    GoContinue,
    GoSelect,

    // Expressions
    GoLiteral,
    GoIdentifier,
    GoBinaryExpression,
    GoUnaryExpression,
    GoSpread,
    GoAssignment,
    GoSelectorExpression,
    GoIndexExpression,
    GoSliceExpression,
    GoCallExpression,
    GoTypeAssertion,
    GoTypeConversion,
    GoCompositeLiteral,
    GoKeyValue,
    GoFuncLit,
    GoMake,
    GoNew,

    // Raw Code
    GoRawCode
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoAST;
  }
  if (typeof global !== 'undefined') {
    global.GoAST = GoAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
