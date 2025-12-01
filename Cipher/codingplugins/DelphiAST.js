/**
 * DelphiAST.js - Delphi/Pascal Abstract Syntax Tree Node Types
 * Defines Delphi-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Delphi AST -> Delphi Emitter -> Delphi Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all Delphi AST nodes
   */
  class DelphiNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a Delphi type reference
   */
  class DelphiType extends DelphiNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'Byte', 'Integer', 'string', etc.
      this.isArray = options.isArray || false;   // true for array of T
      this.isDynamic = options.isDynamic !== undefined ? options.isDynamic : true; // dynamic vs static array
      this.arrayBounds = options.arrayBounds || null; // for static arrays: [0..255]
      this.isPointer = options.isPointer || false;
      this.isGeneric = options.isGeneric || false;
      this.genericArguments = options.genericArguments || []; // For TList<T>, TDictionary<K,V>
      this.isNullable = options.isNullable || false; // For nullable types
    }

    /**
     * Create common primitive types
     */
    static Byte() { return new DelphiType('Byte'); }
    static ShortInt() { return new DelphiType('ShortInt'); }
    static Word() { return new DelphiType('Word'); }
    static SmallInt() { return new DelphiType('SmallInt'); }
    static Cardinal() { return new DelphiType('Cardinal'); }
    static LongWord() { return new DelphiType('LongWord'); }
    static Integer() { return new DelphiType('Integer'); }
    static LongInt() { return new DelphiType('LongInt'); }
    static UInt64() { return new DelphiType('UInt64'); }
    static Int64() { return new DelphiType('Int64'); }
    static Single() { return new DelphiType('Single'); }
    static Double() { return new DelphiType('Double'); }
    static Extended() { return new DelphiType('Extended'); }
    static Boolean() { return new DelphiType('Boolean'); }
    static Char() { return new DelphiType('Char'); }
    static WideChar() { return new DelphiType('WideChar'); }
    static AnsiString() { return new DelphiType('AnsiString'); }
    static WideString() { return new DelphiType('WideString'); }
    static String() { return new DelphiType('string'); }
    static Pointer() { return new DelphiType('Pointer'); }
    static Variant() { return new DelphiType('Variant'); }
    static TObject() { return new DelphiType('TObject'); }
    static TBytes() { return new DelphiType('TBytes'); }

    static Array(elementType, isDynamic = true, bounds = null) {
      return new DelphiType(elementType.name, {
        isArray: true,
        isDynamic,
        arrayBounds: bounds,
        elementType
      });
    }

    static Pointer(baseType) {
      const type = new DelphiType(baseType.name, { isPointer: true });
      type.baseType = baseType;
      return type;
    }

    static Generic(name, typeArgs) {
      return new DelphiType(name, {
        isGeneric: true,
        genericArguments: typeArgs
      });
    }

    /**
     * Convert to Delphi type string
     */
    toString() {
      let result = '';

      if (this.isPointer) {
        result = '^' + this.name;
      } else if (this.isArray) {
        if (this.isDynamic) {
          result = `array of ${this.name}`;
        } else if (this.arrayBounds) {
          result = `array[${this.arrayBounds}] of ${this.name}`;
        } else {
          result = `array of ${this.name}`;
        }
      } else {
        result = this.name;

        if (this.isGeneric && this.genericArguments.length > 0) {
          result += `<${this.genericArguments.map(t => t.toString()).join(', ')}>`;
        }
      }

      return result;
    }
  }

  // ========================[ COMPILATION UNIT ]========================

  /**
   * Root node representing a complete Delphi unit
   */
  class DelphiUnit extends DelphiNode {
    constructor(name) {
      super('Unit');
      this.name = name;              // Unit name
      this.interfaceSection = new DelphiInterfaceSection();
      this.implementationSection = new DelphiImplementationSection();
      this.initializationSection = null; // optional
      this.finalizationSection = null;   // optional
    }
  }

  /**
   * Interface section
   */
  class DelphiInterfaceSection extends DelphiNode {
    constructor() {
      super('InterfaceSection');
      this.uses = [];                // DelphiUsesClause[]
      this.types = [];               // DelphiType declarations
      this.constants = [];           // DelphiConst[]
      this.variables = [];           // DelphiVar[]
      this.functions = [];           // DelphiFunction[]
      this.procedures = [];          // DelphiProcedure[]
    }
  }

  /**
   * Implementation section
   */
  class DelphiImplementationSection extends DelphiNode {
    constructor() {
      super('ImplementationSection');
      this.uses = [];                // DelphiUsesClause[]
      this.types = [];
      this.constants = [];
      this.variables = [];
      this.functions = [];
      this.procedures = [];
    }
  }

  /**
   * Uses clause: uses System, SysUtils;
   */
  class DelphiUsesClause extends DelphiNode {
    constructor(units) {
      super('UsesClause');
      this.units = units;            // Array of unit names
    }
  }

  // ========================[ TYPE DECLARATIONS ]========================

  /**
   * Class declaration
   */
  class DelphiClass extends DelphiNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.heritage = null;          // Parent class name
      this.interfaces = [];          // Implemented interfaces
      this.visibility = 'public';
      this.fields = [];              // DelphiField[]
      this.properties = [];          // DelphiProperty[]
      this.methods = [];             // DelphiMethod[]
      this.constructor_methods = []; // DelphiConstructor[]
      this.destructor_methods = [];  // DelphiDestructor[]
      this.isSealed = false;
      this.isAbstract = false;
    }
  }

  /**
   * Record declaration
   */
  class DelphiRecord extends DelphiNode {
    constructor(name) {
      super('Record');
      this.name = name;
      this.fields = [];              // DelphiField[]
      this.methods = [];             // DelphiMethod[] (for record helpers)
      this.isPacked = false;
      this.isAdvanced = false;       // Advanced records can have methods
    }
  }

  /**
   * Field declaration
   */
  class DelphiField extends DelphiNode {
    constructor(name, type) {
      super('Field');
      this.name = name;
      this.type = type;              // DelphiType
      this.visibility = 'private';
      this.isClass = false;          // class var
      this.initializer = null;       // DelphiExpression
    }
  }

  /**
   * Property declaration
   */
  class DelphiProperty extends DelphiNode {
    constructor(name, type) {
      super('Property');
      this.name = name;
      this.type = type;              // DelphiType
      this.visibility = 'public';
      this.getter = null;            // Field or method name
      this.setter = null;            // Field or method name
      this.isDefault = false;
      this.indexSpecifier = null;
    }
  }

  /**
   * Interface declaration
   */
  class DelphiInterface extends DelphiNode {
    constructor(name) {
      super('Interface');
      this.name = name;
      this.heritage = [];            // Parent interfaces
      this.guid = null;              // Interface GUID
      this.methods = [];             // DelphiMethod[]
      this.properties = [];          // DelphiProperty[]
    }
  }

  // ========================[ ROUTINES ]========================

  /**
   * Function declaration
   */
  class DelphiFunction extends DelphiNode {
    constructor(name, returnType) {
      super('Function');
      this.name = name;
      this.returnType = returnType;  // DelphiType
      this.parameters = [];          // DelphiParameter[]
      this.body = null;              // DelphiBlock
      this.visibility = 'public';
      this.isClass = false;          // class function
      this.isStatic = false;
      this.isOverload = false;
      this.isOverride = false;
      this.isVirtual = false;
      this.isInline = false;
      this.forwardDeclaration = false;
      this.directives = [];          // 'inline', 'overload', etc.
    }
  }

  /**
   * Procedure declaration
   */
  class DelphiProcedure extends DelphiNode {
    constructor(name) {
      super('Procedure');
      this.name = name;
      this.parameters = [];          // DelphiParameter[]
      this.body = null;              // DelphiBlock
      this.visibility = 'public';
      this.isClass = false;          // class procedure
      this.isStatic = false;
      this.isOverload = false;
      this.isOverride = false;
      this.isVirtual = false;
      this.isInline = false;
      this.forwardDeclaration = false;
      this.directives = [];
    }
  }

  /**
   * Method (function or procedure)
   */
  class DelphiMethod extends DelphiNode {
    constructor(name, isFunction = true, returnType = null) {
      super('Method');
      this.name = name;
      this.isFunction = isFunction;
      this.returnType = returnType;  // DelphiType (for functions)
      this.parameters = [];          // DelphiParameter[]
      this.body = null;              // DelphiBlock
      this.visibility = 'public';
      this.isClass = false;
      this.isStatic = false;
      this.isOverload = false;
      this.isOverride = false;
      this.isVirtual = false;
      this.isInline = false;
      this.directives = [];
    }
  }

  /**
   * Constructor
   */
  class DelphiConstructor extends DelphiNode {
    constructor(name = 'Create') {
      super('Constructor');
      this.name = name;
      this.parameters = [];
      this.body = null;
      this.visibility = 'public';
    }
  }

  /**
   * Destructor
   */
  class DelphiDestructor extends DelphiNode {
    constructor(name = 'Destroy') {
      super('Destructor');
      this.name = name;
      this.body = null;
      this.visibility = 'public';
      this.isOverride = true;        // Usually override TObject.Destroy
    }
  }

  /**
   * Parameter
   */
  class DelphiParameter extends DelphiNode {
    constructor(name, type) {
      super('Parameter');
      this.name = name;
      this.type = type;              // DelphiType
      this.isVar = false;            // var parameter
      this.isConst = false;          // const parameter
      this.isOut = false;            // out parameter
      this.defaultValue = null;      // Default value expression
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement (begin...end)
   */
  class DelphiBlock extends DelphiNode {
    constructor() {
      super('Block');
      this.statements = [];          // DelphiStatement[]
    }
  }

  /**
   * Variable declaration (var x: Integer;)
   */
  class DelphiVarDeclaration extends DelphiNode {
    constructor(name, type, initializer = null) {
      super('VarDeclaration');
      this.name = name;
      this.type = type;              // DelphiType
      this.initializer = initializer; // DelphiExpression
    }
  }

  /**
   * Constant declaration (const X = 10;)
   */
  class DelphiConstDeclaration extends DelphiNode {
    constructor(name, value, type = null) {
      super('ConstDeclaration');
      this.name = name;
      this.type = type;              // DelphiType (optional, can be inferred)
      this.value = value;            // DelphiExpression
    }
  }

  /**
   * Expression statement
   */
  class DelphiExpressionStatement extends DelphiNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Assignment statement (x := y;)
   */
  class DelphiAssignment extends DelphiNode {
    constructor(target, value) {
      super('Assignment');
      this.target = target;          // DelphiExpression
      this.value = value;            // DelphiExpression
    }
  }

  /**
   * If statement
   */
  class DelphiIf extends DelphiNode {
    constructor(condition, thenBranch, elseBranch = null) {
      super('If');
      this.condition = condition;       // DelphiExpression
      this.thenBranch = thenBranch;     // DelphiStatement or DelphiBlock
      this.elseBranch = elseBranch;     // DelphiStatement, DelphiBlock, or null
    }
  }

  /**
   * For loop (for i := 0 to 10 do)
   */
  class DelphiFor extends DelphiNode {
    constructor(variable, start, end, isDownto = false) {
      super('For');
      this.variable = variable;      // Variable name
      this.startValue = start;       // DelphiExpression
      this.endValue = end;           // DelphiExpression
      this.isDownto = isDownto;      // true for 'downto', false for 'to'
      this.body = null;              // DelphiStatement or DelphiBlock
    }
  }

  /**
   * For-in loop (for x in collection do)
   */
  class DelphiForIn extends DelphiNode {
    constructor(variable, collection) {
      super('ForIn');
      this.variable = variable;      // Variable name
      this.collection = collection;  // DelphiExpression
      this.body = null;              // DelphiStatement or DelphiBlock
    }
  }

  /**
   * While loop
   */
  class DelphiWhile extends DelphiNode {
    constructor(condition) {
      super('While');
      this.condition = condition;
      this.body = null;
    }
  }

  /**
   * Repeat-until loop
   */
  class DelphiRepeat extends DelphiNode {
    constructor(condition) {
      super('Repeat');
      this.condition = condition;
      this.body = null;              // DelphiBlock
    }
  }

  /**
   * Case statement
   */
  class DelphiCase extends DelphiNode {
    constructor(expression) {
      super('Case');
      this.expression = expression;
      this.branches = [];            // DelphiCaseBranch[]
      this.elseBranch = null;        // DelphiStatement or DelphiBlock
    }
  }

  /**
   * Case branch
   */
  class DelphiCaseBranch extends DelphiNode {
    constructor(values, statement) {
      super('CaseBranch');
      this.values = values;          // Array of DelphiExpression
      this.statement = statement;    // DelphiStatement or DelphiBlock
    }
  }

  /**
   * Try-except-finally statement
   */
  class DelphiTry extends DelphiNode {
    constructor() {
      super('Try');
      this.tryBlock = null;          // DelphiBlock
      this.exceptBlock = null;       // DelphiExceptBlock
      this.finallyBlock = null;      // DelphiBlock
    }
  }

  /**
   * Except block
   */
  class DelphiExceptBlock extends DelphiNode {
    constructor() {
      super('ExceptBlock');
      this.handlers = [];            // DelphiExceptionHandler[]
      this.elseBlock = null;         // DelphiBlock
    }
  }

  /**
   * Exception handler (on E: Exception do)
   */
  class DelphiExceptionHandler extends DelphiNode {
    constructor(exceptionType, variableName = null) {
      super('ExceptionHandler');
      this.exceptionType = exceptionType; // Type name
      this.variableName = variableName;   // Variable name for exception
      this.body = null;                   // DelphiStatement or DelphiBlock
    }
  }

  /**
   * Raise statement
   */
  class DelphiRaise extends DelphiNode {
    constructor(exception = null) {
      super('Raise');
      this.exception = exception;    // DelphiExpression or null (re-raise)
    }
  }

  /**
   * Exit statement
   */
  class DelphiExit extends DelphiNode {
    constructor(returnValue = null) {
      super('Exit');
      this.returnValue = returnValue; // DelphiExpression or null
    }
  }

  /**
   * Break statement
   */
  class DelphiBreak extends DelphiNode {
    constructor() {
      super('Break');
    }
  }

  /**
   * Continue statement
   */
  class DelphiContinue extends DelphiNode {
    constructor() {
      super('Continue');
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression
   */
  class DelphiLiteral extends DelphiNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;
      this.literalType = literalType; // 'integer', 'float', 'string', 'boolean', 'char', 'hex'
    }

    static Integer(value) { return new DelphiLiteral(value, 'integer'); }
    static Float(value) { return new DelphiLiteral(value, 'float'); }
    static String(value) { return new DelphiLiteral(value, 'string'); }
    static Boolean(value) { return new DelphiLiteral(value, 'boolean'); }
    static Char(value) { return new DelphiLiteral(value, 'char'); }
    static Hex(value) { return new DelphiLiteral(value, 'hex'); }
    static Nil() { return new DelphiLiteral(null, 'nil'); }
  }

  /**
   * Identifier expression
   */
  class DelphiIdentifier extends DelphiNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression (a + b, a and b, etc.)
   */
  class DelphiBinaryExpression extends DelphiNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;      // '+', '-', '*', 'div', 'mod', 'and', 'or', 'xor', etc.
      this.right = right;
    }
  }

  /**
   * Unary expression (not x, -x, etc.)
   */
  class DelphiUnaryExpression extends DelphiNode {
    constructor(operator, operand) {
      super('UnaryExpression');
      this.operator = operator;      // 'not', '-', '@' (address-of), etc.
      this.operand = operand;
    }
  }

  /**
   * Field/member access (obj.field)
   */
  class DelphiFieldAccess extends DelphiNode {
    constructor(target, field) {
      super('FieldAccess');
      this.target = target;          // DelphiExpression
      this.field = field;            // Field name
    }
  }

  /**
   * Array access (arr[index])
   */
  class DelphiArrayAccess extends DelphiNode {
    constructor(target, index) {
      super('ArrayAccess');
      this.target = target;
      this.index = index;            // DelphiExpression or array of expressions
    }
  }

  /**
   * Function/procedure call
   */
  class DelphiCall extends DelphiNode {
    constructor(callee, args = []) {
      super('Call');
      this.callee = callee;          // Function/procedure name or expression
      this.arguments = args;         // DelphiExpression[]
    }
  }

  /**
   * Type cast (Integer(x))
   */
  class DelphiTypeCast extends DelphiNode {
    constructor(type, expression) {
      super('TypeCast');
      this.type = type;              // DelphiType
      this.expression = expression;
    }
  }

  /**
   * Type check (x is TMyClass)
   */
  class DelphiTypeCheck extends DelphiNode {
    constructor(expression, type) {
      super('TypeCheck');
      this.expression = expression;
      this.type = type;              // Type name
    }
  }

  /**
   * Type cast as (x as TMyClass)
   */
  class DelphiTypeCastAs extends DelphiNode {
    constructor(expression, type) {
      super('TypeCastAs');
      this.expression = expression;
      this.type = type;              // Type name
    }
  }

  /**
   * Array literal ([1, 2, 3])
   */
  class DelphiArrayLiteral extends DelphiNode {
    constructor(elements = []) {
      super('ArrayLiteral');
      this.elements = elements;      // DelphiExpression[]
    }
  }

  /**
   * Set literal ([a, b, c])
   */
  class DelphiSetLiteral extends DelphiNode {
    constructor(elements = []) {
      super('SetLiteral');
      this.elements = elements;      // DelphiExpression[]
    }
  }

  /**
   * Range expression (1..10)
   */
  class DelphiRange extends DelphiNode {
    constructor(start, end) {
      super('Range');
      this.start = start;
      this.end = end;
    }
  }

  /**
   * With statement expression
   */
  class DelphiWith extends DelphiNode {
    constructor(expressions, body) {
      super('With');
      this.expressions = expressions; // Array of DelphiExpression
      this.body = body;               // DelphiStatement or DelphiBlock
    }
  }

  // ========================[ COMMENTS ]========================

  /**
   * Comment
   */
  class DelphiComment extends DelphiNode {
    constructor(text, isDocumentation = false) {
      super('Comment');
      this.text = text;
      this.isDocumentation = isDocumentation; // XML documentation comment
    }
  }

  // ========================[ EXPORTS ]========================

  const DelphiAST = {
    // Base
    DelphiNode,

    // Types
    DelphiType,

    // Unit structure
    DelphiUnit,
    DelphiInterfaceSection,
    DelphiImplementationSection,
    DelphiUsesClause,

    // Type declarations
    DelphiClass,
    DelphiRecord,
    DelphiField,
    DelphiProperty,
    DelphiInterface,

    // Routines
    DelphiFunction,
    DelphiProcedure,
    DelphiMethod,
    DelphiConstructor,
    DelphiDestructor,
    DelphiParameter,

    // Statements
    DelphiBlock,
    DelphiVarDeclaration,
    DelphiConstDeclaration,
    DelphiExpressionStatement,
    DelphiAssignment,
    DelphiIf,
    DelphiFor,
    DelphiForIn,
    DelphiWhile,
    DelphiRepeat,
    DelphiCase,
    DelphiCaseBranch,
    DelphiTry,
    DelphiExceptBlock,
    DelphiExceptionHandler,
    DelphiRaise,
    DelphiExit,
    DelphiBreak,
    DelphiContinue,

    // Expressions
    DelphiLiteral,
    DelphiIdentifier,
    DelphiBinaryExpression,
    DelphiUnaryExpression,
    DelphiFieldAccess,
    DelphiArrayAccess,
    DelphiCall,
    DelphiTypeCast,
    DelphiTypeCheck,
    DelphiTypeCastAs,
    DelphiArrayLiteral,
    DelphiSetLiteral,
    DelphiRange,
    DelphiWith,

    // Comments
    DelphiComment
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DelphiAST;
  }
  if (typeof global !== 'undefined') {
    global.DelphiAST = DelphiAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
