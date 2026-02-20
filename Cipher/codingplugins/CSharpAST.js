/**
 * CSharpAST.js - C# Abstract Syntax Tree Node Types
 * Defines C#-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C# AST -> C# Emitter -> C# Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all C# AST nodes
   */
  class CSharpNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a C# type reference
   */
  class CSharpType extends CSharpNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'int', 'uint', 'byte', 'string', etc.
      this.isArray = options.isArray || false;   // true for T[]
      this.arrayRank = options.arrayRank || 1;   // 1 for [], 2 for [,], etc.
      this.isNullable = options.isNullable || false; // true for T?
      this.isGeneric = options.isGeneric || false;
      this.genericArguments = options.genericArguments || []; // For List<T>, Dictionary<K,V>
      this.isTuple = options.isTuple || false;
      this.tupleElements = options.tupleElements || []; // [{name, type}] for named tuples
    }

    /**
     * Create common primitive types
     */
    static Byte() { return new CSharpType('byte'); }
    static SByte() { return new CSharpType('sbyte'); }
    static UShort() { return new CSharpType('ushort'); }
    static Short() { return new CSharpType('short'); }
    static UInt() { return new CSharpType('uint'); }
    static Int() { return new CSharpType('int'); }
    static ULong() { return new CSharpType('ulong'); }
    static Long() { return new CSharpType('long'); }
    static Float() { return new CSharpType('float'); }
    static Double() { return new CSharpType('double'); }
    static Bool() { return new CSharpType('bool'); }
    static Char() { return new CSharpType('char'); }
    static String() { return new CSharpType('string'); }
    static Void() { return new CSharpType('void'); }
    static Object() { return new CSharpType('object'); }
    static Dynamic() { return new CSharpType('dynamic'); } // Late-bound type for property access
    static Var() { return new CSharpType('var'); } // Type inference

    static Array(elementType) {
      // For tuple element types, preserve the tuple structure
      const options = { isArray: true, arrayRank: 1 };
      if (elementType.isTuple) {
        options.isTuple = true;
        options.tupleElements = elementType.tupleElements;
      }
      // Use the full element type string (including its own array brackets) as the base name
      // This handles nested arrays like uint[][] correctly
      const baseName = elementType.toString();
      const type = new CSharpType(baseName, options);
      type.elementType = elementType;
      return type;
    }

    static List(elementType) {
      return new CSharpType('List', { isGeneric: true, genericArguments: [elementType] });
    }

    static Dictionary(keyType, valueType) {
      return new CSharpType('Dictionary', { isGeneric: true, genericArguments: [keyType, valueType] });
    }

    static Tuple(elements) {
      return new CSharpType('tuple', { isTuple: true, tupleElements: elements });
    }

    /**
     * Convert to C# type string
     */
    toString() {
      let result;

      if (this.isTuple) {
        const parts = this.tupleElements.map(e =>
          e.name ? `${e.type.toString()} ${e.name}` : e.type.toString()
        );
        result = `(${parts.join(', ')})`;
      } else {
        result = this.name;

        if (this.isGeneric && this.genericArguments.length > 0) {
          result += `<${this.genericArguments.map(t => t.toString()).join(', ')}>`;
        }
      }

      if (this.isArray) {
        result += '[]';
      }

      if (this.isNullable) {
        result += '?';
      }

      return result;
    }
  }

  // ========================[ COMPILATION UNIT ]========================

  /**
   * Root node representing a complete C# file
   */
  class CSharpCompilationUnit extends CSharpNode {
    constructor() {
      super('CompilationUnit');
      this.usings = [];        // CSharpUsingDirective[]
      this.namespace = null;   // CSharpNamespace
      this.types = [];         // Top-level types (rare in C#)
    }
  }

  /**
   * Using directive: using System;
   */
  class CSharpUsingDirective extends CSharpNode {
    constructor(namespace, alias = null) {
      super('UsingDirective');
      this.namespace = namespace;  // 'System', 'System.Collections.Generic'
      this.alias = alias;          // For: using Alias = Namespace;
    }
  }

  /**
   * Namespace declaration
   */
  class CSharpNamespace extends CSharpNode {
    constructor(name) {
      super('Namespace');
      this.name = name;         // 'Generated', 'MyProject.Core'
      this.types = [];          // CSharpClass[], CSharpStruct[], etc.
    }
  }

  // ========================[ TYPE DECLARATIONS ]========================

  /**
   * Class declaration
   */
  class CSharpClass extends CSharpNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.accessModifier = 'public';  // 'public', 'private', 'internal', 'protected'
      this.isStatic = false;
      this.isPartial = false;
      this.isSealed = false;
      this.isAbstract = false;
      this.baseClass = null;           // CSharpType
      this.interfaces = [];            // CSharpType[]
      this.members = [];               // CSharpMember[]
      this.nestedTypes = [];           // CSharpClass[], etc.
      this.xmlDoc = null;              // XML documentation
    }
  }

  /**
   * Struct declaration
   */
  class CSharpStruct extends CSharpNode {
    constructor(name) {
      super('Struct');
      this.name = name;
      this.accessModifier = 'public';
      this.isReadOnly = false;
      this.interfaces = [];
      this.members = [];
      this.xmlDoc = null;
    }
  }

  // ========================[ MEMBER DECLARATIONS ]========================

  /**
   * Field declaration
   */
  class CSharpField extends CSharpNode {
    constructor(name, type) {
      super('Field');
      this.name = name;
      this.type = type;                 // CSharpType
      this.accessModifier = 'public';
      this.isStatic = false;
      this.isReadOnly = false;
      this.isConst = false;
      this.initializer = null;          // CSharpExpression
      this.xmlDoc = null;
    }
  }

  /**
   * Property declaration
   */
  class CSharpProperty extends CSharpNode {
    constructor(name, type) {
      super('Property');
      this.name = name;
      this.type = type;
      this.accessModifier = 'public';
      this.isStatic = false;
      this.hasGetter = true;
      this.hasSetter = true;
      this.getterBody = null;           // CSharpBlock or null for auto-property
      this.setterBody = null;
      this.initializer = null;
      this.xmlDoc = null;
    }
  }

  /**
   * Method declaration
   */
  class CSharpMethod extends CSharpNode {
    constructor(name, returnType) {
      super('Method');
      this.name = name;
      this.returnType = returnType;     // CSharpType
      this.accessModifier = 'public';
      this.isStatic = false;
      this.isVirtual = false;
      this.isOverride = false;
      this.isAbstract = false;
      this.isAsync = false;
      this.parameters = [];             // CSharpParameter[]
      this.body = null;                 // CSharpBlock
      this.xmlDoc = null;
    }
  }

  /**
   * Constructor declaration
   */
  class CSharpConstructor extends CSharpNode {
    constructor(className) {
      super('Constructor');
      this.className = className;
      this.accessModifier = 'public';
      this.parameters = [];
      this.baseCall = null;             // CSharpBaseConstructorCall
      this.thisCall = null;             // CSharpThisConstructorCall
      this.body = null;
      this.xmlDoc = null;
    }
  }

  /**
   * Method parameter
   */
  class CSharpParameter extends CSharpNode {
    constructor(name, type) {
      super('Parameter');
      this.name = name;
      this.type = type;
      this.isRef = false;
      this.isOut = false;
      this.isParams = false;
      this.defaultValue = null;         // CSharpExpression
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement { ... }
   */
  class CSharpBlock extends CSharpNode {
    constructor() {
      super('Block');
      this.statements = [];             // CSharpStatement[]
    }
  }

  /**
   * Variable declaration statement
   */
  class CSharpVariableDeclaration extends CSharpNode {
    constructor(name, type, initializer = null) {
      super('VariableDeclaration');
      this.name = name;
      this.type = type;                 // CSharpType (or 'var')
      this.initializer = initializer;   // CSharpExpression
    }
  }

  /**
   * Expression statement (expression;)
   */
  class CSharpExpressionStatement extends CSharpNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class CSharpReturn extends CSharpNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression;     // CSharpExpression or null
    }
  }

  /**
   * If statement
   */
  class CSharpIf extends CSharpNode {
    constructor(condition, thenBranch, elseBranch = null) {
      super('If');
      this.condition = condition;       // CSharpExpression
      this.thenBranch = thenBranch;     // CSharpStatement or CSharpBlock
      this.elseBranch = elseBranch;     // CSharpStatement, CSharpBlock, or null
    }
  }

  /**
   * For loop
   */
  class CSharpFor extends CSharpNode {
    constructor() {
      super('For');
      this.initializer = null;          // CSharpVariableDeclaration or CSharpExpression
      this.condition = null;            // CSharpExpression
      this.incrementor = null;          // CSharpExpression
      this.body = null;                 // CSharpBlock
    }
  }

  /**
   * Foreach loop
   */
  class CSharpForEach extends CSharpNode {
    constructor(variableName, variableType, collection, body) {
      super('ForEach');
      this.variableName = variableName;
      this.variableType = variableType; // CSharpType
      this.collection = collection;     // CSharpExpression
      this.body = body;                 // CSharpBlock
    }
  }

  /**
   * While loop
   */
  class CSharpWhile extends CSharpNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Do-While loop
   */
  class CSharpDoWhile extends CSharpNode {
    constructor(body, condition) {
      super('DoWhile');
      this.body = body;
      this.condition = condition;
    }
  }

  /**
   * Switch statement
   */
  class CSharpSwitch extends CSharpNode {
    constructor(expression) {
      super('Switch');
      this.expression = expression;
      this.cases = [];                  // CSharpSwitchCase[]
    }
  }

  /**
   * Switch case
   */
  class CSharpSwitchCase extends CSharpNode {
    constructor(label = null) {
      super('SwitchCase');
      this.label = label;               // CSharpExpression or null for default
      this.isDefault = label === null;
      this.statements = [];
    }
  }

  /**
   * Break statement
   */
  class CSharpBreak extends CSharpNode {
    constructor() { super('Break'); }
  }

  /**
   * Continue statement
   */
  class CSharpContinue extends CSharpNode {
    constructor() { super('Continue'); }
  }

  /**
   * Throw statement
   */
  class CSharpThrow extends CSharpNode {
    constructor(expression) {
      super('Throw');
      this.expression = expression;
    }
  }

  /**
   * Try-Catch-Finally
   */
  class CSharpTryCatch extends CSharpNode {
    constructor() {
      super('TryCatch');
      this.tryBlock = null;
      this.catchClauses = [];           // CSharpCatchClause[]
      this.finallyBlock = null;
    }
  }

  class CSharpCatchClause extends CSharpNode {
    constructor(exceptionType, variableName, body) {
      super('CatchClause');
      this.exceptionType = exceptionType;
      this.variableName = variableName;
      this.body = body;
    }
  }

  /**
   * Raw C# code - used for @csharp directive to embed native C# code
   * Bypasses transpilation for specific functions that need native implementations
   */
  class CSharpRawCode extends CSharpNode {
    constructor(code) {
      super('RawCode');
      this.code = code;  // Raw C# code string to emit verbatim
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression (numbers, strings, booleans, null)
   */
  class CSharpLiteral extends CSharpNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;               // The actual value
      this.literalType = literalType;   // 'int', 'uint', 'long', 'string', 'bool', 'null', etc.
      this.suffix = null;               // 'u', 'L', 'ul', 'f', 'd', etc.
    }

    static Int(value) { return new CSharpLiteral(value, 'int'); }
    static UInt(value) { const l = new CSharpLiteral(value, 'uint'); l.suffix = 'u'; return l; }
    static Long(value) { const l = new CSharpLiteral(value, 'long'); l.suffix = 'L'; return l; }
    static ULong(value) { const l = new CSharpLiteral(value, 'ulong'); l.suffix = 'ul'; return l; }
    static Float(value) { const l = new CSharpLiteral(value, 'float'); l.suffix = 'f'; return l; }
    static Double(value) { return new CSharpLiteral(value, 'double'); }
    static String(value) { return new CSharpLiteral(value, 'string'); }
    static Char(value) { return new CSharpLiteral(value, 'char'); }
    static Bool(value) { return new CSharpLiteral(value, 'bool'); }
    static Null() { return new CSharpLiteral(null, 'null'); }
    static Hex(value, suffixOrBits = 32) {
      // Support both old signature (bits) and new (suffix string)
      let literalType, suffix;
      if (typeof suffixOrBits === 'string') {
        // New signature: Hex(value, 'UL') etc.
        suffix = suffixOrBits;
        literalType = suffix.toLowerCase().includes('u') ? 'ulong' : 'long';
      } else {
        // Old signature: Hex(value, bits)
        literalType = suffixOrBits <= 32 ? 'uint' : 'ulong';
        suffix = null;
      }
      const l = new CSharpLiteral(value, literalType);
      l.isHex = true;
      if (suffix) l.suffix = suffix;
      return l;
    }

    static BigInteger(value) {
      const l = new CSharpLiteral(value, 'BigInteger');
      l.isBigInteger = true;
      return l;
    }
  }

  /**
   * Identifier expression (variable, type, member name)
   */
  class CSharpIdentifier extends CSharpNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression (a + b, a && b, etc.)
   */
  class CSharpBinaryExpression extends CSharpNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;         // '+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>', '>>>', '==', '!=', '<', '>', '<=', '>=', '&&', '||'
      this.right = right;
    }
  }

  /**
   * Unary expression (!x, -x, ++x, x++, etc.)
   */
  class CSharpUnaryExpression extends CSharpNode {
    constructor(operator, operand, isPrefix = true) {
      super('UnaryExpression');
      this.operator = operator;         // '!', '-', '~', '++', '--'
      this.operand = operand;
      this.isPrefix = isPrefix;
    }
  }

  /**
   * Assignment expression (x = y, x += y, etc.)
   */
  class CSharpAssignment extends CSharpNode {
    constructor(target, operator, value, options = {}) {
      super('Assignment');
      this.target = target;
      this.operator = operator;         // '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='
      this.value = value;
      this.isNoop = options.isNoop || false;  // For "x = x" no-op statements
    }
  }

  /**
   * Member access (obj.member)
   */
  class CSharpMemberAccess extends CSharpNode {
    constructor(target, member) {
      super('MemberAccess');
      this.target = target;             // CSharpExpression
      this.member = member;             // string (member name)
    }
  }

  /**
   * Element access (arr[index])
   */
  class CSharpElementAccess extends CSharpNode {
    constructor(target, index) {
      super('ElementAccess');
      this.target = target;
      this.index = index;               // CSharpExpression
    }
  }

  /**
   * Index from end expression (^n) for C# 8.0+ range syntax
   * Used for negative indices: array[^5] means 5th element from end
   */
  class CSharpIndexFromEnd extends CSharpNode {
    constructor(index) {
      super('IndexFromEnd');
      this.index = index;               // CSharpExpression (the positive offset from end)
    }
  }

  /**
   * Range expression (start..end) for array slicing
   */
  class CSharpRange extends CSharpNode {
    constructor(start, end) {
      super('Range');
      this.start = start;               // CSharpExpression or null for ^0
      this.end = end;                   // CSharpExpression or null for end
    }
  }

  /**
   * Method invocation (Method(args))
   */
  class CSharpMethodCall extends CSharpNode {
    constructor(target, methodName, args = []) {
      super('MethodCall');
      this.target = target;             // CSharpExpression or null for simple call
      this.methodName = methodName;
      this.arguments = args;            // CSharpExpression[]
      this.typeArguments = [];          // For generic methods
    }
  }

  /**
   * Object creation (new Type(args))
   */
  class CSharpObjectCreation extends CSharpNode {
    constructor(type, args = []) {
      super('ObjectCreation');
      this.type = type;                 // CSharpType
      this.arguments = args;            // CSharpExpression[]
      this.initializer = null;          // CSharpObjectInitializer
    }
  }

  /**
   * Array creation (new Type[size] or new Type[] { ... })
   */
  class CSharpArrayCreation extends CSharpNode {
    constructor(elementType, size = null, initializer = null) {
      super('ArrayCreation');
      this.elementType = elementType;   // CSharpType
      this.size = size;                 // CSharpExpression or null
      this.initializer = initializer;   // CSharpExpression[] or null
    }
  }

  /**
   * Object initializer { Prop1 = val1, Prop2 = val2 }
   * Or dictionary initializer { { "key1", val1 }, { "key2", val2 } }
   */
  class CSharpObjectInitializer extends CSharpNode {
    constructor(isDictionary = false) {
      super('ObjectInitializer');
      this.assignments = [];            // [{name, value}]
      this.isDictionary = isDictionary; // If true, emit as collection initializer
    }
  }

  /**
   * Anonymous object creation (new { Prop1 = val1, Prop2 = val2 })
   */
  class CSharpAnonymousObject extends CSharpNode {
    constructor(properties = []) {
      super('AnonymousObject');
      this.properties = properties;     // [{name, value}]
    }
  }

  /**
   * Interpolated string ($"Hello {name}!")
   * Parts can be strings (literal text) or AST nodes (expressions)
   */
  class CSharpStringInterpolation extends CSharpNode {
    constructor(parts = []) {
      super('StringInterpolation');
      this.parts = parts;               // [string | CSharpNode, ...]
    }
  }

  /**
   * Cast expression ((Type)expr)
   */
  class CSharpCast extends CSharpNode {
    constructor(type, expression) {
      super('Cast');
      this.type = type;                 // CSharpType
      this.expression = expression;
    }
  }

  /**
   * Conditional expression (condition ? trueExpr : falseExpr)
   */
  class CSharpConditional extends CSharpNode {
    constructor(condition, trueExpr, falseExpr) {
      super('Conditional');
      this.condition = condition;
      this.trueExpression = trueExpr;
      this.falseExpression = falseExpr;
    }
  }

  /**
   * Lambda expression ((args) => body)
   */
  class CSharpLambda extends CSharpNode {
    constructor(parameters, body) {
      super('Lambda');
      this.parameters = parameters;     // CSharpParameter[]
      this.body = body;                 // CSharpBlock or CSharpExpression
      this.isAsync = false;
    }
  }

  /**
   * This expression
   */
  class CSharpThis extends CSharpNode {
    constructor() { super('This'); }
  }

  /**
   * Base expression
   */
  class CSharpBase extends CSharpNode {
    constructor() { super('Base'); }
  }

  /**
   * Typeof expression
   */
  class CSharpTypeOf extends CSharpNode {
    constructor(type) {
      super('TypeOf');
      this.type = type;
    }
  }

  /**
   * Is expression (expr is Type)
   */
  class CSharpIsExpression extends CSharpNode {
    constructor(expression, type) {
      super('IsExpression');
      this.expression = expression;
      this.type = type;
    }
  }

  /**
   * As expression (expr as Type)
   */
  class CSharpAsExpression extends CSharpNode {
    constructor(expression, type) {
      super('AsExpression');
      this.expression = expression;
      this.type = type;
    }
  }

  /**
   * Parenthesized expression ((expr))
   */
  class CSharpParenthesized extends CSharpNode {
    constructor(expression) {
      super('Parenthesized');
      this.expression = expression;
    }
  }

  /**
   * Tuple expression ((a, b, c))
   */
  class CSharpTupleExpression extends CSharpNode {
    constructor(elements) {
      super('TupleExpression');
      this.elements = elements;         // [{name, expression}] - name is optional
    }
  }

  // ========================[ XML DOCUMENTATION ]========================

  /**
   * XML documentation comment
   */
  class CSharpXmlDoc extends CSharpNode {
    constructor() {
      super('XmlDoc');
      this.summary = null;
      this.parameters = [];             // [{name, description}]
      this.returns = null;
      this.remarks = null;
      this.examples = [];
      this.exceptions = [];             // [{type, description}]
    }
  }

  // ========================[ EXPORTS ]========================

  const CSharpAST = {
    // Base
    CSharpNode,

    // Types
    CSharpType,

    // Compilation Unit
    CSharpCompilationUnit,
    CSharpUsingDirective,
    CSharpNamespace,

    // Type Declarations
    CSharpClass,
    CSharpStruct,

    // Members
    CSharpField,
    CSharpProperty,
    CSharpMethod,
    CSharpConstructor,
    CSharpParameter,

    // Statements
    CSharpBlock,
    CSharpVariableDeclaration,
    CSharpExpressionStatement,
    CSharpReturn,
    CSharpIf,
    CSharpFor,
    CSharpForEach,
    CSharpWhile,
    CSharpDoWhile,
    CSharpSwitch,
    CSharpSwitchCase,
    CSharpBreak,
    CSharpContinue,
    CSharpThrow,
    CSharpTryCatch,
    CSharpCatchClause,
    CSharpRawCode,

    // Expressions
    CSharpLiteral,
    CSharpIdentifier,
    CSharpBinaryExpression,
    CSharpUnaryExpression,
    CSharpAssignment,
    CSharpMemberAccess,
    CSharpElementAccess,
    CSharpIndexFromEnd,
    CSharpRange,
    CSharpMethodCall,
    CSharpObjectCreation,
    CSharpArrayCreation,
    CSharpObjectInitializer,
    CSharpAnonymousObject,
    CSharpStringInterpolation,
    CSharpCast,
    CSharpConditional,
    CSharpLambda,
    CSharpThis,
    CSharpBase,
    CSharpTypeOf,
    CSharpIsExpression,
    CSharpAsExpression,
    CSharpParenthesized,
    CSharpTupleExpression,

    // Documentation
    CSharpXmlDoc
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSharpAST;
  }
  if (typeof global !== 'undefined') {
    global.CSharpAST = CSharpAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
