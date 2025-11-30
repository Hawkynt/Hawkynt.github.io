/**
 * CppAST.js - C++ Abstract Syntax Tree Node Types
 * Defines C++-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C++ AST -> C++ Emitter -> C++ Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all C++ AST nodes
   */
  class CppNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a C++ type reference
   */
  class CppType extends CppNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'int', 'uint32_t', 'uint8_t', 'std::string', etc.
      this.isPointer = options.isPointer || false;   // true for T*
      this.isReference = options.isReference || false; // true for T&
      this.isConst = options.isConst || false;       // true for const T
      this.isConstexpr = options.isConstexpr || false;
      this.isVector = options.isVector || false;     // true for std::vector<T>
      this.vectorElement = options.vectorElement || null; // Element type for vectors
      this.isArray = options.isArray || false;       // true for T[N]
      this.arraySize = options.arraySize || null;    // Size for fixed arrays
      this.templateArgs = options.templateArgs || []; // For template types
    }

    /**
     * Create common primitive types
     */
    static Byte() { return new CppType('uint8_t'); }
    static SByte() { return new CppType('int8_t'); }
    static UShort() { return new CppType('uint16_t'); }
    static Short() { return new CppType('int16_t'); }
    static UInt() { return new CppType('uint32_t'); }
    static Int() { return new CppType('int32_t'); }
    static ULong() { return new CppType('uint64_t'); }
    static Long() { return new CppType('int64_t'); }
    static Float() { return new CppType('float'); }
    static Double() { return new CppType('double'); }
    static Bool() { return new CppType('bool'); }
    static Char() { return new CppType('char'); }
    static String() { return new CppType('std::string'); }
    static Void() { return new CppType('void'); }
    static Auto() { return new CppType('auto'); } // Type inference
    static SizeT() { return new CppType('size_t'); }

    static Vector(elementType) {
      const type = new CppType('std::vector', {
        isVector: true,
        vectorElement: elementType,
        templateArgs: [elementType]
      });
      return type;
    }

    static Array(elementType, size = null) {
      // For dynamic arrays, use std::vector
      if (!size)
        return CppType.Vector(elementType);
      // For fixed-size arrays
      return new CppType(elementType.name, {
        isArray: true,
        arraySize: size
      });
    }

    static Optional(elementType) {
      return new CppType('std::optional', {
        templateArgs: [elementType]
      });
    }

    /**
     * Convert to C++ type string
     */
    toString() {
      let result = '';

      if (this.isConst && !this.isReference) {
        result += 'const ';
      }

      result += this.name;

      if (this.isVector || this.templateArgs.length > 0) {
        const args = this.templateArgs.map(t => t.toString()).join(', ');
        result += `<${args}>`;
      }

      if (this.isArray && this.arraySize) {
        result += `[${this.arraySize}]`;
      }

      if (this.isPointer) {
        result += '*';
      }

      if (this.isReference) {
        result = (this.isConst ? 'const ' : '') + result.replace(/^const /, '') + '&';
      }

      return result;
    }
  }

  // ========================[ COMPILATION UNIT ]========================

  /**
   * Root node representing a complete C++ file
   */
  class CppCompilationUnit extends CppNode {
    constructor() {
      super('CompilationUnit');
      this.includes = [];      // CppIncludeDirective[]
      this.namespaces = [];    // CppNamespace[]
      this.types = [];         // Top-level types
      this.pragmas = [];       // Pragma directives
    }
  }

  /**
   * Include directive: #include <vector>
   */
  class CppIncludeDirective extends CppNode {
    constructor(header, isSystem = true) {
      super('IncludeDirective');
      this.header = header;      // 'vector', 'string', 'algorithm'
      this.isSystem = isSystem;  // true for <>, false for ""
    }
  }

  /**
   * Namespace declaration
   */
  class CppNamespace extends CppNode {
    constructor(name) {
      super('Namespace');
      this.name = name;         // 'std', 'crypto', etc.
      this.types = [];          // CppClass[], CppStruct[], etc.
      this.functions = [];      // Top-level functions
    }
  }

  // ========================[ TYPE DECLARATIONS ]========================

  /**
   * Class declaration
   */
  class CppClass extends CppNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.accessModifier = 'public';  // 'public', 'private', 'protected'
      this.isFinal = false;
      this.baseClasses = [];           // CppType[]
      this.publicMembers = [];         // Members in public section
      this.privateMembers = [];        // Members in private section
      this.protectedMembers = [];      // Members in protected section
      this.nestedTypes = [];           // Nested classes/structs
      this.docComment = null;          // Doxygen comment
    }
  }

  /**
   * Struct declaration
   */
  class CppStruct extends CppNode {
    constructor(name) {
      super('Struct');
      this.name = name;
      this.members = [];               // All members (structs default to public)
      this.docComment = null;
    }
  }

  // ========================[ MEMBER DECLARATIONS ]========================

  /**
   * Field declaration
   */
  class CppField extends CppNode {
    constructor(name, type) {
      super('Field');
      this.name = name;
      this.type = type;                 // CppType
      this.isStatic = false;
      this.isConst = false;
      this.isConstexpr = false;
      this.isMutable = false;
      this.initializer = null;          // CppExpression
      this.docComment = null;
    }
  }

  /**
   * Method declaration
   */
  class CppMethod extends CppNode {
    constructor(name, returnType) {
      super('Method');
      this.name = name;
      this.returnType = returnType;     // CppType
      this.isStatic = false;
      this.isVirtual = false;
      this.isOverride = false;
      this.isConst = false;              // const member function
      this.isConstexpr = false;
      this.isInline = false;
      this.isExplicit = false;           // For constructors
      this.parameters = [];              // CppParameter[]
      this.body = null;                  // CppBlock
      this.initializerList = [];         // For constructors
      this.docComment = null;
    }
  }

  /**
   * Constructor declaration
   */
  class CppConstructor extends CppNode {
    constructor(className) {
      super('Constructor');
      this.className = className;
      this.parameters = [];
      this.isExplicit = false;
      this.isDefault = false;
      this.isDelete = false;
      this.initializerList = [];         // [{member, value}]
      this.body = null;
      this.docComment = null;
    }
  }

  /**
   * Destructor declaration
   */
  class CppDestructor extends CppNode {
    constructor(className) {
      super('Destructor');
      this.className = className;
      this.isVirtual = false;
      this.isDefault = false;
      this.isDelete = false;
      this.body = null;
    }
  }

  /**
   * Method parameter
   */
  class CppParameter extends CppNode {
    constructor(name, type) {
      super('Parameter');
      this.name = name;
      this.type = type;
      this.defaultValue = null;         // CppExpression
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement { ... }
   */
  class CppBlock extends CppNode {
    constructor() {
      super('Block');
      this.statements = [];             // CppStatement[]
    }
  }

  /**
   * Variable declaration statement
   */
  class CppVariableDeclaration extends CppNode {
    constructor(name, type, initializer = null) {
      super('VariableDeclaration');
      this.name = name;
      this.type = type;                 // CppType (or 'auto')
      this.initializer = initializer;   // CppExpression
      this.isStatic = false;
      this.isConst = false;
      this.isConstexpr = false;
    }
  }

  /**
   * Expression statement (expression;)
   */
  class CppExpressionStatement extends CppNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class CppReturn extends CppNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression;     // CppExpression or null
    }
  }

  /**
   * If statement
   */
  class CppIf extends CppNode {
    constructor(condition, thenBranch, elseBranch = null) {
      super('If');
      this.condition = condition;       // CppExpression
      this.thenBranch = thenBranch;     // CppStatement or CppBlock
      this.elseBranch = elseBranch;     // CppStatement, CppBlock, or null
    }
  }

  /**
   * For loop
   */
  class CppFor extends CppNode {
    constructor() {
      super('For');
      this.initializer = null;          // CppVariableDeclaration or CppExpression
      this.condition = null;            // CppExpression
      this.incrementor = null;          // CppExpression
      this.body = null;                 // CppBlock
    }
  }

  /**
   * Range-based for loop (C++11)
   */
  class CppRangeFor extends CppNode {
    constructor(variableName, variableType, collection, body) {
      super('RangeFor');
      this.variableName = variableName;
      this.variableType = variableType; // CppType
      this.collection = collection;     // CppExpression
      this.body = body;                 // CppBlock
    }
  }

  /**
   * While loop
   */
  class CppWhile extends CppNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Do-While loop
   */
  class CppDoWhile extends CppNode {
    constructor(body, condition) {
      super('DoWhile');
      this.body = body;
      this.condition = condition;
    }
  }

  /**
   * Switch statement
   */
  class CppSwitch extends CppNode {
    constructor(expression) {
      super('Switch');
      this.expression = expression;
      this.cases = [];                  // CppSwitchCase[]
    }
  }

  /**
   * Switch case
   */
  class CppSwitchCase extends CppNode {
    constructor(label = null) {
      super('SwitchCase');
      this.label = label;               // CppExpression or null for default
      this.isDefault = label === null;
      this.statements = [];
    }
  }

  /**
   * Break statement
   */
  class CppBreak extends CppNode {
    constructor() { super('Break'); }
  }

  /**
   * Continue statement
   */
  class CppContinue extends CppNode {
    constructor() { super('Continue'); }
  }

  /**
   * Throw statement
   */
  class CppThrow extends CppNode {
    constructor(expression) {
      super('Throw');
      this.expression = expression;
    }
  }

  /**
   * Try-Catch
   */
  class CppTryCatch extends CppNode {
    constructor() {
      super('TryCatch');
      this.tryBlock = null;
      this.catchClauses = [];           // CppCatchClause[]
    }
  }

  class CppCatchClause extends CppNode {
    constructor(exceptionType, variableName, body) {
      super('CatchClause');
      this.exceptionType = exceptionType;
      this.variableName = variableName;
      this.body = body;
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression (numbers, strings, booleans, nullptr)
   */
  class CppLiteral extends CppNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;               // The actual value
      this.literalType = literalType;   // 'int', 'uint', 'long', 'string', 'bool', 'nullptr', etc.
      this.suffix = null;               // 'u', 'L', 'ul', 'f', etc.
    }

    static Int(value) { return new CppLiteral(value, 'int'); }
    static UInt(value) { const l = new CppLiteral(value, 'uint'); l.suffix = 'u'; return l; }
    static Long(value) { const l = new CppLiteral(value, 'long'); l.suffix = 'L'; return l; }
    static ULong(value) { const l = new CppLiteral(value, 'ulong'); l.suffix = 'UL'; return l; }
    static Float(value) { const l = new CppLiteral(value, 'float'); l.suffix = 'f'; return l; }
    static Double(value) { return new CppLiteral(value, 'double'); }
    static String(value) { return new CppLiteral(value, 'string'); }
    static Bool(value) { return new CppLiteral(value, 'bool'); }
    static Nullptr() { return new CppLiteral(null, 'nullptr'); }
    static Hex(value, suffixOrBits = 32) {
      let literalType, suffix;
      if (typeof suffixOrBits === 'string') {
        suffix = suffixOrBits;
        literalType = suffix.toLowerCase().includes('u') ? 'ulong' : 'long';
      } else {
        literalType = suffixOrBits <= 32 ? 'uint' : 'ulong';
        suffix = null;
      }
      const l = new CppLiteral(value, literalType);
      l.isHex = true;
      if (suffix) l.suffix = suffix;
      return l;
    }
  }

  /**
   * Identifier expression (variable, type, member name)
   */
  class CppIdentifier extends CppNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression (a + b, a && b, etc.)
   */
  class CppBinaryExpression extends CppNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;         // '+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>', '==', '!=', '<', '>', '<=', '>=', '&&', '||'
      this.right = right;
    }
  }

  /**
   * Unary expression (!x, -x, ++x, x++, etc.)
   */
  class CppUnaryExpression extends CppNode {
    constructor(operator, operand, isPrefix = true) {
      super('UnaryExpression');
      this.operator = operator;         // '!', '-', '~', '++', '--', '&', '*'
      this.operand = operand;
      this.isPrefix = isPrefix;
    }
  }

  /**
   * Assignment expression (x = y, x += y, etc.)
   */
  class CppAssignment extends CppNode {
    constructor(target, operator, value, options = {}) {
      super('Assignment');
      this.target = target;
      this.operator = operator;         // '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='
      this.value = value;
      this.isNoop = options.isNoop || false;
    }
  }

  /**
   * Member access (obj.member or obj->member)
   */
  class CppMemberAccess extends CppNode {
    constructor(target, member, isPointer = false) {
      super('MemberAccess');
      this.target = target;             // CppExpression
      this.member = member;             // string (member name)
      this.isPointer = isPointer;       // true for ->, false for .
    }
  }

  /**
   * Element access (arr[index])
   */
  class CppElementAccess extends CppNode {
    constructor(target, index) {
      super('ElementAccess');
      this.target = target;
      this.index = index;               // CppExpression
    }
  }

  /**
   * Function call (Function(args))
   */
  class CppFunctionCall extends CppNode {
    constructor(target, functionName, args = []) {
      super('FunctionCall');
      this.target = target;             // CppExpression or null for simple call
      this.functionName = functionName;
      this.arguments = args;            // CppExpression[]
      this.templateArgs = [];           // For template functions
    }
  }

  /**
   * Object creation (new Type(args))
   */
  class CppObjectCreation extends CppNode {
    constructor(type, args = []) {
      super('ObjectCreation');
      this.type = type;                 // CppType
      this.arguments = args;            // CppExpression[]
    }
  }

  /**
   * Array/Vector creation
   */
  class CppArrayCreation extends CppNode {
    constructor(elementType, size = null, initializer = null) {
      super('ArrayCreation');
      this.elementType = elementType;   // CppType
      this.size = size;                 // CppExpression or null
      this.initializer = initializer;   // CppExpression[] or null
    }
  }

  /**
   * Initializer list { val1, val2, val3 }
   */
  class CppInitializerList extends CppNode {
    constructor(elements = []) {
      super('InitializerList');
      this.elements = elements;         // CppExpression[]
    }
  }

  /**
   * Cast expression ((Type)expr or static_cast<Type>(expr))
   */
  class CppCast extends CppNode {
    constructor(type, expression, castType = 'static') {
      super('Cast');
      this.type = type;                 // CppType
      this.expression = expression;
      this.castType = castType;         // 'static', 'dynamic', 'reinterpret', 'const', 'c-style'
    }
  }

  /**
   * Conditional expression (condition ? trueExpr : falseExpr)
   */
  class CppConditional extends CppNode {
    constructor(condition, trueExpr, falseExpr) {
      super('Conditional');
      this.condition = condition;
      this.trueExpression = trueExpr;
      this.falseExpression = falseExpr;
    }
  }

  /**
   * Lambda expression ([captures](args) { body })
   */
  class CppLambda extends CppNode {
    constructor(parameters, body, captures = []) {
      super('Lambda');
      this.captures = captures;         // Capture list
      this.parameters = parameters;     // CppParameter[]
      this.body = body;                 // CppBlock or CppExpression
      this.returnType = null;           // Optional return type
    }
  }

  /**
   * This expression
   */
  class CppThis extends CppNode {
    constructor() { super('This'); }
  }

  /**
   * Sizeof expression
   */
  class CppSizeof extends CppNode {
    constructor(type) {
      super('Sizeof');
      this.type = type;
    }
  }

  /**
   * Parenthesized expression ((expr))
   */
  class CppParenthesized extends CppNode {
    constructor(expression) {
      super('Parenthesized');
      this.expression = expression;
    }
  }

  // ========================[ DOCUMENTATION ]========================

  /**
   * Doxygen documentation comment
   */
  class CppDocComment extends CppNode {
    constructor() {
      super('DocComment');
      this.brief = null;
      this.details = null;
      this.parameters = [];             // [{name, description}]
      this.returns = null;
    }
  }

  // ========================[ EXPORTS ]========================

  const CppAST = {
    // Base
    CppNode,

    // Types
    CppType,

    // Compilation Unit
    CppCompilationUnit,
    CppIncludeDirective,
    CppNamespace,

    // Type Declarations
    CppClass,
    CppStruct,

    // Members
    CppField,
    CppMethod,
    CppConstructor,
    CppDestructor,
    CppParameter,

    // Statements
    CppBlock,
    CppVariableDeclaration,
    CppExpressionStatement,
    CppReturn,
    CppIf,
    CppFor,
    CppRangeFor,
    CppWhile,
    CppDoWhile,
    CppSwitch,
    CppSwitchCase,
    CppBreak,
    CppContinue,
    CppThrow,
    CppTryCatch,
    CppCatchClause,

    // Expressions
    CppLiteral,
    CppIdentifier,
    CppBinaryExpression,
    CppUnaryExpression,
    CppAssignment,
    CppMemberAccess,
    CppElementAccess,
    CppFunctionCall,
    CppObjectCreation,
    CppArrayCreation,
    CppInitializerList,
    CppCast,
    CppConditional,
    CppLambda,
    CppThis,
    CppSizeof,
    CppParenthesized,

    // Documentation
    CppDocComment
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CppAST;
  }
  if (typeof global !== 'undefined') {
    global.CppAST = CppAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
