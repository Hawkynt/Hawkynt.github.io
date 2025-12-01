/**
 * PhpAST.js - PHP Abstract Syntax Tree Node Types
 * Defines PHP-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> PHP AST -> PHP Emitter -> PHP Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all PHP AST nodes
   */
  class PhpNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a PHP type reference
   */
  class PhpType extends PhpNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'int', 'string', 'array', etc.
      this.isArray = options.isArray || false;   // true for array<T>
      this.isNullable = options.isNullable || false; // true for ?T
      this.isUnion = options.isUnion || false;   // true for T1|T2
      this.unionTypes = options.unionTypes || []; // For union types
      this.isGeneric = options.isGeneric || false;
      this.genericArguments = options.genericArguments || []; // For array<T>
    }

    /**
     * Create common PHP types
     */
    static Int() { return new PhpType('int'); }
    static Float() { return new PhpType('float'); }
    static String() { return new PhpType('string'); }
    static Bool() { return new PhpType('bool'); }
    static Array() { return new PhpType('array'); }
    static Object() { return new PhpType('object'); }
    static Mixed() { return new PhpType('mixed'); }
    static Void() { return new PhpType('void'); }
    static Never() { return new PhpType('never'); }
    static Null() { return new PhpType('null'); }
    static Callable() { return new PhpType('callable'); }
    static Iterable() { return new PhpType('iterable'); }

    static TypedArray(elementType) {
      return new PhpType('array', { isGeneric: true, genericArguments: [elementType] });
    }

    static Nullable(innerType) {
      const type = new PhpType(innerType.name, { isNullable: true });
      type.innerType = innerType;
      return type;
    }

    static Union(types) {
      return new PhpType('union', { isUnion: true, unionTypes: types });
    }

    /**
     * Convert to PHP type string
     */
    toString() {
      if (this.isNullable) {
        return '?' + (this.innerType ? this.innerType.toString() : this.name);
      }

      if (this.isUnion) {
        return this.unionTypes.map(t => t.toString()).join('|');
      }

      let result = this.name;

      if (this.isGeneric && this.genericArguments.length > 0) {
        // PHP-style generic: array<int>
        result += '<' + this.genericArguments.map(t => t.toString()).join(', ') + '>';
      }

      return result;
    }
  }

  // ========================[ COMPILATION UNIT ]========================

  /**
   * Root node representing a complete PHP file
   */
  class PhpFile extends PhpNode {
    constructor() {
      super('File');
      this.strictTypes = true;        // declare(strict_types=1)
      this.namespace = null;          // PhpNamespace
      this.uses = [];                 // PhpUseDeclaration[]
      this.items = [];                // Top-level items (classes, functions, etc.)
    }
  }

  /**
   * Namespace declaration: namespace App\Crypto;
   */
  class PhpNamespace extends PhpNode {
    constructor(name) {
      super('Namespace');
      this.name = name; // 'App\\Crypto'
    }
  }

  /**
   * Use declaration: use Symfony\Component\HttpFoundation\Response;
   */
  class PhpUseDeclaration extends PhpNode {
    constructor(fqcn, alias = null) {
      super('UseDeclaration');
      this.fullyQualifiedClassName = fqcn;  // 'Symfony\\Component\\HttpFoundation\\Response'
      this.alias = alias;                    // 'Resp' for 'as Resp'
    }
  }

  // ========================[ TYPE DECLARATIONS ]========================

  /**
   * Class declaration
   */
  class PhpClass extends PhpNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.isFinal = false;
      this.isAbstract = false;
      this.isReadonly = false;         // PHP 8.2+
      this.extendsClass = null;        // string (class name)
      this.implementsInterfaces = [];  // string[]
      this.properties = [];            // PhpProperty[]
      this.methods = [];               // PhpMethod[]
      this.docComment = null;          // /// documentation
      this.attributes = [];            // PHP 8+ attributes
    }
  }

  /**
   * Interface declaration
   */
  class PhpInterface extends PhpNode {
    constructor(name) {
      super('Interface');
      this.name = name;
      this.extendsInterfaces = [];     // string[]
      this.methods = [];               // PhpMethod[]
      this.docComment = null;
    }
  }

  /**
   * Trait declaration
   */
  class PhpTrait extends PhpNode {
    constructor(name) {
      super('Trait');
      this.name = name;
      this.properties = [];
      this.methods = [];
      this.docComment = null;
    }
  }

  /**
   * Enum declaration (PHP 8.1+)
   */
  class PhpEnum extends PhpNode {
    constructor(name) {
      super('Enum');
      this.name = name;
      this.backingType = null;         // 'int' or 'string'
      this.cases = [];                 // PhpEnumCase[]
      this.methods = [];               // PhpMethod[]
      this.docComment = null;
    }
  }

  /**
   * Enum case
   */
  class PhpEnumCase extends PhpNode {
    constructor(name, value = null) {
      super('EnumCase');
      this.name = name;
      this.value = value;              // For backed enums
    }
  }

  // ========================[ MEMBER DECLARATIONS ]========================

  /**
   * Property declaration
   */
  class PhpProperty extends PhpNode {
    constructor(name, type = null) {
      super('Property');
      this.name = name;
      this.type = type;                // PhpType
      this.visibility = 'private';     // 'public', 'protected', 'private'
      this.isStatic = false;
      this.isReadonly = false;         // PHP 8.1+
      this.defaultValue = null;        // PhpExpression
      this.docComment = null;
    }
  }

  /**
   * Method declaration
   */
  class PhpMethod extends PhpNode {
    constructor(name, returnType = null) {
      super('Method');
      this.name = name;
      this.returnType = returnType;    // PhpType
      this.visibility = 'public';      // 'public', 'protected', 'private'
      this.isStatic = false;
      this.isFinal = false;
      this.isAbstract = false;
      this.parameters = [];            // PhpParameter[]
      this.body = null;                // PhpBlock
      this.docComment = null;
      this.attributes = [];
    }
  }

  /**
   * Function declaration
   */
  class PhpFunction extends PhpNode {
    constructor(name, returnType = null) {
      super('Function');
      this.name = name;
      this.returnType = returnType;    // PhpType
      this.parameters = [];            // PhpParameter[]
      this.body = null;                // PhpBlock
      this.docComment = null;
    }
  }

  /**
   * Method/Function parameter
   */
  class PhpParameter extends PhpNode {
    constructor(name, type = null) {
      super('Parameter');
      this.name = name;
      this.type = type;                // PhpType
      this.defaultValue = null;        // PhpExpression
      this.isVariadic = false;         // ...$args
      this.isReference = false;        // &$param
      this.isPromoted = false;         // Constructor property promotion
      this.promotedVisibility = null;  // 'public', 'protected', 'private' if promoted
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement { ... }
   */
  class PhpBlock extends PhpNode {
    constructor() {
      super('Block');
      this.statements = [];            // PhpStatement[]
    }
  }

  /**
   * Variable declaration/assignment
   */
  class PhpVariableDeclaration extends PhpNode {
    constructor(name, type = null, initializer = null) {
      super('VariableDeclaration');
      this.name = name;                // without $
      this.type = type;                // PhpType (optional)
      this.initializer = initializer;  // PhpExpression
    }
  }

  /**
   * Expression statement (expression;)
   */
  class PhpExpressionStatement extends PhpNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class PhpReturn extends PhpNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression;    // PhpExpression or null
    }
  }

  /**
   * If statement
   */
  class PhpIf extends PhpNode {
    constructor(condition, thenBranch, elseBranch = null) {
      super('If');
      this.condition = condition;      // PhpExpression
      this.thenBranch = thenBranch;    // PhpBlock
      this.elseBranch = elseBranch;    // PhpBlock or PhpIf or null
    }
  }

  /**
   * For loop
   */
  class PhpFor extends PhpNode {
    constructor(init, test, update, body) {
      super('For');
      this.init = init;                // PhpExpression or null
      this.test = test;                // PhpExpression or null
      this.update = update;            // PhpExpression or null
      this.body = body;                // PhpBlock
    }
  }

  /**
   * Foreach loop
   */
  class PhpForeach extends PhpNode {
    constructor(iterable, value, body, key = null) {
      super('Foreach');
      this.iterable = iterable;        // PhpExpression
      this.key = key;                  // string (variable name without $) or null
      this.value = value;              // string (variable name without $)
      this.body = body;                // PhpBlock
    }
  }

  /**
   * While loop
   */
  class PhpWhile extends PhpNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Do-while loop
   */
  class PhpDoWhile extends PhpNode {
    constructor(condition, body) {
      super('DoWhile');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Switch statement
   */
  class PhpSwitch extends PhpNode {
    constructor(expression) {
      super('Switch');
      this.expression = expression;
      this.cases = [];                 // PhpSwitchCase[]
    }
  }

  /**
   * Switch case
   */
  class PhpSwitchCase extends PhpNode {
    constructor(value, statements) {
      super('SwitchCase');
      this.value = value;              // PhpExpression or null for default
      this.statements = statements;    // PhpStatement[]
    }
  }

  /**
   * Match expression (PHP 8.0+)
   */
  class PhpMatch extends PhpNode {
    constructor(expression) {
      super('Match');
      this.expression = expression;
      this.arms = [];                  // PhpMatchArm[]
    }
  }

  /**
   * Match arm
   */
  class PhpMatchArm extends PhpNode {
    constructor(conditions, body) {
      super('MatchArm');
      this.conditions = conditions;    // PhpExpression[] (can have multiple)
      this.body = body;                // PhpExpression
    }
  }

  /**
   * Break statement
   */
  class PhpBreak extends PhpNode {
    constructor(level = null) {
      super('Break');
      this.level = level;              // Number of levels to break (usually null)
    }
  }

  /**
   * Continue statement
   */
  class PhpContinue extends PhpNode {
    constructor(level = null) {
      super('Continue');
      this.level = level;              // Number of levels to continue (usually null)
    }
  }

  /**
   * Try-catch statement
   */
  class PhpTry extends PhpNode {
    constructor(tryBlock) {
      super('Try');
      this.tryBlock = tryBlock;        // PhpBlock
      this.catchClauses = [];          // PhpCatch[]
      this.finallyBlock = null;        // PhpBlock or null
    }
  }

  /**
   * Catch clause
   */
  class PhpCatch extends PhpNode {
    constructor(exceptionTypes, variableName, body) {
      super('Catch');
      this.exceptionTypes = exceptionTypes; // string[] (can catch multiple types)
      this.variableName = variableName;     // string (without $)
      this.body = body;                     // PhpBlock
    }
  }

  /**
   * Throw statement
   */
  class PhpThrow extends PhpNode {
    constructor(expression) {
      super('Throw');
      this.expression = expression;    // PhpExpression
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression
   */
  class PhpLiteral extends PhpNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;
      this.literalType = literalType;  // 'int', 'float', 'string', 'bool', 'null'
    }

    static Int(value) { return new PhpLiteral(value, 'int'); }
    static Float(value) { return new PhpLiteral(value, 'float'); }
    static String(value) { return new PhpLiteral(value, 'string'); }
    static Bool(value) { return new PhpLiteral(value, 'bool'); }
    static Null() { return new PhpLiteral(null, 'null'); }
  }

  /**
   * Variable expression
   */
  class PhpVariable extends PhpNode {
    constructor(name) {
      super('Variable');
      this.name = name;                // without $
    }
  }

  /**
   * Identifier expression (non-variable identifiers like parent, self, static)
   */
  class PhpIdentifier extends PhpNode {
    constructor(name) {
      super('Identifier');
      this.name = name;                // 'parent', 'self', 'static', etc.
    }
  }

  /**
   * Binary expression (a + b, a & b, etc.)
   */
  class PhpBinaryExpression extends PhpNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;        // '+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>', etc.
      this.right = right;
    }
  }

  /**
   * Unary expression (!x, -x, ~x, etc.)
   */
  class PhpUnaryExpression extends PhpNode {
    constructor(operator, operand, isPrefix = true) {
      super('UnaryExpression');
      this.operator = operator;        // '!', '-', '~', '++', '--', etc.
      this.operand = operand;
      this.isPrefix = isPrefix;
    }
  }

  /**
   * Assignment expression (x = y)
   */
  class PhpAssignment extends PhpNode {
    constructor(target, operator, value) {
      super('Assignment');
      this.target = target;
      this.operator = operator;        // '=', '+=', '-=', '*=', etc.
      this.value = value;
    }
  }

  /**
   * Property access (obj->property)
   */
  class PhpPropertyAccess extends PhpNode {
    constructor(target, property) {
      super('PropertyAccess');
      this.target = target;            // PhpExpression
      this.property = property;        // string (property name)
    }
  }

  /**
   * Static property access (Class::$property)
   */
  class PhpStaticPropertyAccess extends PhpNode {
    constructor(className, property) {
      super('StaticPropertyAccess');
      this.className = className;      // string
      this.property = property;        // string
    }
  }

  /**
   * Array access (arr[$index])
   */
  class PhpArrayAccess extends PhpNode {
    constructor(target, index) {
      super('ArrayAccess');
      this.target = target;
      this.index = index;              // PhpExpression
    }
  }

  /**
   * Method call (obj->method(args))
   */
  class PhpMethodCall extends PhpNode {
    constructor(target, methodName, args = []) {
      super('MethodCall');
      this.target = target;            // PhpExpression
      this.methodName = methodName;
      this.arguments = args;           // PhpExpression[]
    }
  }

  /**
   * Static method call (Class::method(args))
   */
  class PhpStaticMethodCall extends PhpNode {
    constructor(className, methodName, args = []) {
      super('StaticMethodCall');
      this.className = className;      // string
      this.methodName = methodName;
      this.arguments = args;
    }
  }

  /**
   * Function call (func(args))
   */
  class PhpFunctionCall extends PhpNode {
    constructor(functionName, args = []) {
      super('FunctionCall');
      this.functionName = functionName; // string or PhpExpression
      this.arguments = args;            // PhpExpression[]
    }
  }

  /**
   * Array literal ([1, 2, 3] or ['a' => 1, 'b' => 2])
   */
  class PhpArrayLiteral extends PhpNode {
    constructor(elements = []) {
      super('ArrayLiteral');
      this.elements = elements;        // [{key: PhpExpression, value: PhpExpression}]
      this.isShortSyntax = true;       // Use [] instead of array()
    }
  }

  /**
   * New expression (new ClassName(args))
   */
  class PhpNew extends PhpNode {
    constructor(className, args = []) {
      super('New');
      this.className = className;      // string
      this.arguments = args;
    }
  }

  /**
   * Ternary expression (cond ? then : else)
   */
  class PhpTernary extends PhpNode {
    constructor(condition, thenExpr, elseExpr) {
      super('Ternary');
      this.condition = condition;
      this.thenExpression = thenExpr;
      this.elseExpression = elseExpr;
    }
  }

  /**
   * Null coalescing expression (a ?? b)
   */
  class PhpNullCoalescing extends PhpNode {
    constructor(left, right) {
      super('NullCoalescing');
      this.left = left;
      this.right = right;
    }
  }

  /**
   * Instanceof expression (obj instanceof Class)
   */
  class PhpInstanceof extends PhpNode {
    constructor(expression, className) {
      super('Instanceof');
      this.expression = expression;
      this.className = className;
    }
  }

  /**
   * Arrow function (fn($x) => $x + 1) - PHP 7.4+
   */
  class PhpArrowFunction extends PhpNode {
    constructor(parameters, body) {
      super('ArrowFunction');
      this.parameters = parameters;    // PhpParameter[]
      this.body = body;                // PhpExpression
    }
  }

  /**
   * Anonymous function (function($x) { return $x + 1; })
   */
  class PhpClosure extends PhpNode {
    constructor(parameters, body) {
      super('Closure');
      this.parameters = parameters;    // PhpParameter[]
      this.body = body;                // PhpBlock
      this.useVariables = [];          // string[] (variables to capture)
    }
  }

  /**
   * Cast expression ((int) $x)
   */
  class PhpCast extends PhpNode {
    constructor(expression, targetType) {
      super('Cast');
      this.expression = expression;
      this.targetType = targetType;    // PhpType or string
    }
  }

  /**
   * String interpolation ("Hello $name!")
   */
  class PhpStringInterpolation extends PhpNode {
    constructor(parts) {
      super('StringInterpolation');
      this.parts = parts;              // Array of strings and PhpExpressions
    }
  }

  /**
   * Class constant access (Class::CONSTANT)
   */
  class PhpClassConstant extends PhpNode {
    constructor(className, constantName) {
      super('ClassConstant');
      this.className = className;
      this.constantName = constantName;
    }
  }

  // ========================[ DOCUMENTATION ]========================

  /**
   * Doc comment (PHPDoc style)
   */
  class PhpDocComment extends PhpNode {
    constructor(text) {
      super('DocComment');
      this.text = text;
    }
  }

  /**
   * Constant declaration (const NAME = value;)
   */
  class PhpConst extends PhpNode {
    constructor(name, type, value) {
      super('Const');
      this.name = name;
      this.type = type;
      this.value = value;
      this.visibility = 'public';      // For class constants
    }
  }

  // ========================[ EXPORTS ]========================

  const PhpAST = {
    // Base
    PhpNode,

    // Types
    PhpType,

    // File
    PhpFile,
    PhpNamespace,
    PhpUseDeclaration,

    // Type Declarations
    PhpClass,
    PhpInterface,
    PhpTrait,
    PhpEnum,
    PhpEnumCase,

    // Member Declarations
    PhpProperty,
    PhpMethod,
    PhpFunction,
    PhpParameter,

    // Statements
    PhpBlock,
    PhpVariableDeclaration,
    PhpExpressionStatement,
    PhpReturn,
    PhpIf,
    PhpFor,
    PhpForeach,
    PhpWhile,
    PhpDoWhile,
    PhpSwitch,
    PhpSwitchCase,
    PhpMatch,
    PhpMatchArm,
    PhpBreak,
    PhpContinue,
    PhpTry,
    PhpCatch,
    PhpThrow,

    // Expressions
    PhpLiteral,
    PhpVariable,
    PhpIdentifier,
    PhpBinaryExpression,
    PhpUnaryExpression,
    PhpAssignment,
    PhpPropertyAccess,
    PhpStaticPropertyAccess,
    PhpArrayAccess,
    PhpMethodCall,
    PhpStaticMethodCall,
    PhpFunctionCall,
    PhpArrayLiteral,
    PhpNew,
    PhpTernary,
    PhpNullCoalescing,
    PhpInstanceof,
    PhpArrowFunction,
    PhpClosure,
    PhpCast,
    PhpStringInterpolation,
    PhpClassConstant,

    // Documentation
    PhpDocComment,

    // Constants
    PhpConst
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhpAST;
  }
  if (typeof global !== 'undefined') {
    global.PhpAST = PhpAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
