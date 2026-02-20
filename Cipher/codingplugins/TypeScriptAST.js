/**
 * TypeScriptAST.js - TypeScript Abstract Syntax Tree Node Types
 * Defines TypeScript-specific AST nodes for transpilation from JavaScript
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> TS AST -> TS Emitter -> TS Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all TypeScript AST nodes
   */
  class TypeScriptNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original JS source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ TYPE SYSTEM ]========================

  /**
   * Represents a TypeScript type reference
   */
  class TypeScriptType extends TypeScriptNode {
    constructor(name, options = {}) {
      super('Type');
      this.name = name;                          // 'number', 'string', 'boolean', etc.
      this.isArray = options.isArray || false;   // true for T[]
      this.isUnion = options.isUnion || false;   // true for A | B
      this.unionTypes = options.unionTypes || []; // For union types
      this.isGeneric = options.isGeneric || false;
      this.genericArguments = options.genericArguments || []; // For Array<T>, Map<K,V>
      this.isTuple = options.isTuple || false;
      this.tupleElements = options.tupleElements || []; // [{name, type}] for named tuples
      this.isLiteral = options.isLiteral || false;
      this.literalValue = options.literalValue;   // For literal types: 'readonly' | 'writeonly'
    }

    /**
     * Create common primitive types
     */
    static Number() { return new TypeScriptType('number'); }
    static String() { return new TypeScriptType('string'); }
    static Boolean() { return new TypeScriptType('boolean'); }
    static Void() { return new TypeScriptType('void'); }
    static Any() { return new TypeScriptType('any'); }
    static Unknown() { return new TypeScriptType('unknown'); }
    static Never() { return new TypeScriptType('never'); }
    static Null() { return new TypeScriptType('null'); }
    static Undefined() { return new TypeScriptType('undefined'); }

    static Array(elementType) {
      const type = new TypeScriptType(elementType.toString(), { isArray: true });
      type.elementType = elementType;
      return type;
    }

    static Uint8Array() { return new TypeScriptType('Uint8Array'); }
    static Uint16Array() { return new TypeScriptType('Uint16Array'); }
    static Uint32Array() { return new TypeScriptType('Uint32Array'); }
    static Int8Array() { return new TypeScriptType('Int8Array'); }
    static Int16Array() { return new TypeScriptType('Int16Array'); }
    static Int32Array() { return new TypeScriptType('Int32Array'); }
    static BigInt() { return new TypeScriptType('bigint'); }

    static Union(types) {
      return new TypeScriptType('union', { isUnion: true, unionTypes: types });
    }

    static Tuple(elements) {
      return new TypeScriptType('tuple', { isTuple: true, tupleElements: elements });
    }

    static Literal(value) {
      return new TypeScriptType('literal', { isLiteral: true, literalValue: value });
    }

    static Generic(baseName, typeArgs) {
      return new TypeScriptType(baseName, { isGeneric: true, genericArguments: typeArgs });
    }

    /**
     * Convert to TypeScript type string
     */
    toString() {
      let result;

      if (this.isTuple) {
        const parts = this.tupleElements.map(e =>
          e.name ? `${e.name}: ${e.type.toString()}` : e.type.toString()
        );
        result = `[${parts.join(', ')}]`;
      } else if (this.isUnion) {
        result = this.unionTypes.map(t => t.toString()).join(' | ');
      } else if (this.isLiteral) {
        result = typeof this.literalValue === 'string' ?
          `'${this.literalValue}'` : String(this.literalValue);
      } else {
        result = this.name;

        if (this.isGeneric && this.genericArguments.length > 0) {
          result += `<${this.genericArguments.map(t => t.toString()).join(', ')}>`;
        }
      }

      if (this.isArray) {
        result += '[]';
      }

      return result;
    }
  }

  // ========================[ COMPILATION UNIT ]========================

  /**
   * Root node representing a complete TypeScript file
   */
  class TypeScriptCompilationUnit extends TypeScriptNode {
    constructor() {
      super('CompilationUnit');
      this.imports = [];       // TypeScriptImportDeclaration[]
      this.exports = [];       // TypeScriptExportDeclaration[]
      this.types = [];         // Top-level types
      this.statements = [];    // Top-level statements
    }
  }

  /**
   * Import declaration: import { x } from 'module';
   */
  class TypeScriptImportDeclaration extends TypeScriptNode {
    constructor(moduleName) {
      super('ImportDeclaration');
      this.moduleName = moduleName;
      this.namedImports = [];      // [{name, alias}]
      this.defaultImport = null;   // string or null
      this.namespaceImport = null; // For: import * as Name
    }
  }

  /**
   * Export declaration
   */
  class TypeScriptExportDeclaration extends TypeScriptNode {
    constructor(declaration) {
      super('ExportDeclaration');
      this.declaration = declaration; // The thing being exported
      this.isDefault = false;
    }
  }

  // ========================[ TYPE DECLARATIONS ]========================

  /**
   * Interface declaration
   */
  class TypeScriptInterface extends TypeScriptNode {
    constructor(name) {
      super('Interface');
      this.name = name;
      this.extends = [];           // TypeScriptType[]
      this.members = [];           // TypeScriptMember[]
      this.typeParameters = [];    // Generic type parameters
      this.jsDoc = null;
    }
  }

  /**
   * Type alias declaration
   */
  class TypeScriptTypeAlias extends TypeScriptNode {
    constructor(name, type) {
      super('TypeAlias');
      this.name = name;
      this.type = type;            // TypeScriptType
      this.typeParameters = [];
      this.jsDoc = null;
    }
  }

  /**
   * Class declaration
   */
  class TypeScriptClass extends TypeScriptNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.accessModifier = null;  // 'public', 'private', 'protected' or null
      this.isAbstract = false;
      this.isExported = false;
      this.baseClass = null;       // TypeScriptType
      this.implements = [];        // TypeScriptType[]
      this.members = [];           // TypeScriptMember[]
      this.typeParameters = [];
      this.jsDoc = null;
    }
  }

  // ========================[ MEMBER DECLARATIONS ]========================

  /**
   * Field/Property declaration
   */
  class TypeScriptProperty extends TypeScriptNode {
    constructor(name, type) {
      super('Property');
      this.name = name;
      this.type = type;                 // TypeScriptType
      this.accessModifier = null;       // 'public', 'private', 'protected', 'readonly'
      this.isStatic = false;
      this.isReadonly = false;
      this.isOptional = false;
      this.initializer = null;          // TypeScriptExpression
      this.jsDoc = null;
    }
  }

  /**
   * Method declaration
   */
  class TypeScriptMethod extends TypeScriptNode {
    constructor(name, returnType) {
      super('Method');
      this.name = name;
      this.returnType = returnType;     // TypeScriptType
      this.accessModifier = null;
      this.isStatic = false;
      this.isAbstract = false;
      this.isAsync = false;
      this.isGetter = false;            // Is this a getter method
      this.isSetter = false;            // Is this a setter method
      this.parameters = [];             // TypeScriptParameter[]
      this.body = null;                 // TypeScriptBlock
      this.jsDoc = null;
    }
  }

  /**
   * Constructor declaration
   */
  class TypeScriptConstructor extends TypeScriptNode {
    constructor() {
      super('Constructor');
      this.accessModifier = 'public';
      this.parameters = [];
      this.body = null;
      this.jsDoc = null;
    }
  }

  /**
   * Static block (ES2022) - static { ... }
   */
  class TypeScriptStaticBlock extends TypeScriptNode {
    constructor() {
      super('StaticBlock');
      this.body = null;  // TypeScriptBlock
    }
  }

  /**
   * Method parameter
   */
  class TypeScriptParameter extends TypeScriptNode {
    constructor(name, type) {
      super('Parameter');
      this.name = name;
      this.type = type;
      this.isOptional = false;
      this.isRest = false;
      this.defaultValue = null;         // TypeScriptExpression
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement { ... }
   */
  class TypeScriptBlock extends TypeScriptNode {
    constructor() {
      super('Block');
      this.statements = [];             // TypeScriptStatement[]
    }
  }

  /**
   * Variable declaration statement
   */
  class TypeScriptVariableDeclaration extends TypeScriptNode {
    constructor(name, type, initializer = null) {
      super('VariableDeclaration');
      this.name = name;
      this.type = type;                 // TypeScriptType or null
      this.kind = 'const';              // 'const', 'let', or 'var'
      this.initializer = initializer;   // TypeScriptExpression
    }
  }

  /**
   * Expression statement (expression;)
   */
  class TypeScriptExpressionStatement extends TypeScriptNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class TypeScriptReturn extends TypeScriptNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression;     // TypeScriptExpression or null
    }
  }

  /**
   * If statement
   */
  class TypeScriptIf extends TypeScriptNode {
    constructor(condition, thenBranch, elseBranch = null) {
      super('If');
      this.condition = condition;       // TypeScriptExpression
      this.thenBranch = thenBranch;     // TypeScriptStatement or TypeScriptBlock
      this.elseBranch = elseBranch;     // TypeScriptStatement, TypeScriptBlock, or null
    }
  }

  /**
   * For loop
   */
  class TypeScriptFor extends TypeScriptNode {
    constructor() {
      super('For');
      this.initializer = null;          // TypeScriptVariableDeclaration or TypeScriptExpression
      this.condition = null;            // TypeScriptExpression
      this.incrementor = null;          // TypeScriptExpression
      this.body = null;                 // TypeScriptBlock
    }
  }

  /**
   * For-of loop (TypeScript/ES6)
   */
  class TypeScriptForOf extends TypeScriptNode {
    constructor(variableName, variableType, collection, body) {
      super('ForOf');
      this.variableName = variableName;
      this.variableType = variableType; // TypeScriptType
      this.collection = collection;     // TypeScriptExpression
      this.body = body;                 // TypeScriptBlock
    }
  }

  /**
   * While loop
   */
  class TypeScriptWhile extends TypeScriptNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Do-While loop
   */
  class TypeScriptDoWhile extends TypeScriptNode {
    constructor(body, condition) {
      super('DoWhile');
      this.body = body;
      this.condition = condition;
    }
  }

  /**
   * Switch statement
   */
  class TypeScriptSwitch extends TypeScriptNode {
    constructor(expression) {
      super('Switch');
      this.expression = expression;
      this.cases = [];                  // TypeScriptSwitchCase[]
    }
  }

  /**
   * Switch case
   */
  class TypeScriptSwitchCase extends TypeScriptNode {
    constructor(label = null) {
      super('SwitchCase');
      this.label = label;               // TypeScriptExpression or null for default
      this.isDefault = label === null;
      this.statements = [];
    }
  }

  /**
   * Break statement
   */
  class TypeScriptBreak extends TypeScriptNode {
    constructor(label = null) {
      super('Break');
      this.label = label;
    }
  }

  /**
   * Continue statement
   */
  class TypeScriptContinue extends TypeScriptNode {
    constructor(label = null) {
      super('Continue');
      this.label = label;
    }
  }

  /**
   * Throw statement
   */
  class TypeScriptThrow extends TypeScriptNode {
    constructor(expression) {
      super('Throw');
      this.expression = expression;
    }
  }

  /**
   * Try-Catch-Finally
   */
  class TypeScriptTryCatch extends TypeScriptNode {
    constructor() {
      super('TryCatch');
      this.tryBlock = null;
      this.catchClauses = [];           // TypeScriptCatchClause[]
      this.finallyBlock = null;
    }
  }

  class TypeScriptCatchClause extends TypeScriptNode {
    constructor(variableName, variableType, body) {
      super('CatchClause');
      this.variableName = variableName;
      this.variableType = variableType; // TypeScriptType or null
      this.body = body;
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression (numbers, strings, booleans, null)
   */
  class TypeScriptLiteral extends TypeScriptNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;               // The actual value
      this.literalType = literalType;   // 'number', 'string', 'boolean', 'null', 'bigint'
    }

    static Number(value) { return new TypeScriptLiteral(value, 'number'); }
    static String(value) { return new TypeScriptLiteral(value, 'string'); }
    static Boolean(value) { return new TypeScriptLiteral(value, 'boolean'); }
    static Null() { return new TypeScriptLiteral(null, 'null'); }
    static Undefined() { return new TypeScriptLiteral(undefined, 'undefined'); }
    static BigInt(value) { return new TypeScriptLiteral(value, 'bigint'); }
  }

  /**
   * Identifier expression (variable, type, member name)
   */
  class TypeScriptIdentifier extends TypeScriptNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression (a + b, a && b, etc.)
   */
  class TypeScriptBinaryExpression extends TypeScriptNode {
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
  class TypeScriptUnaryExpression extends TypeScriptNode {
    constructor(operator, operand, isPrefix = true) {
      super('UnaryExpression');
      this.operator = operator;         // '!', '-', '~', '++', '--', 'typeof', 'void', 'delete'
      this.operand = operand;
      this.isPrefix = isPrefix;
    }
  }

  /**
   * Assignment expression (x = y, x += y, etc.)
   */
  class TypeScriptAssignment extends TypeScriptNode {
    constructor(target, operator, value) {
      super('Assignment');
      this.target = target;
      this.operator = operator;         // '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='
      this.value = value;
    }
  }

  /**
   * Member access (obj.member)
   */
  class TypeScriptMemberAccess extends TypeScriptNode {
    constructor(target, member) {
      super('MemberAccess');
      this.target = target;             // TypeScriptExpression
      this.member = member;             // string (member name)
      this.isOptional = false;          // For optional chaining ?.
    }
  }

  /**
   * Element access (arr[index])
   */
  class TypeScriptElementAccess extends TypeScriptNode {
    constructor(target, index) {
      super('ElementAccess');
      this.target = target;
      this.index = index;               // TypeScriptExpression
    }
  }

  /**
   * Method/Function invocation
   */
  class TypeScriptCall extends TypeScriptNode {
    constructor(target, methodName, args = []) {
      super('Call');
      this.target = target;             // TypeScriptExpression or null for simple call
      this.methodName = methodName;
      this.arguments = args;            // TypeScriptExpression[]
      this.typeArguments = [];          // For generic calls
    }
  }

  /**
   * Object creation (new Type(args))
   */
  class TypeScriptNew extends TypeScriptNode {
    constructor(type, args = []) {
      super('New');
      this.type = type;                 // TypeScriptType
      this.arguments = args;            // TypeScriptExpression[]
    }
  }

  /**
   * Array literal [1, 2, 3]
   */
  class TypeScriptArrayLiteral extends TypeScriptNode {
    constructor(elements = []) {
      super('ArrayLiteral');
      this.elements = elements;         // TypeScriptExpression[]
      this.elementType = null;          // Inferred or explicit type
    }
  }

  /**
   * Object literal { key: value, ... }
   */
  class TypeScriptObjectLiteral extends TypeScriptNode {
    constructor() {
      super('ObjectLiteral');
      this.properties = [];             // [{key, value}]
    }
  }

  /**
   * Type assertion (value as Type)
   */
  class TypeScriptAssertion extends TypeScriptNode {
    constructor(expression, type) {
      super('Assertion');
      this.expression = expression;
      this.type = type;                 // TypeScriptType
    }
  }

  /**
   * Conditional expression (condition ? trueExpr : falseExpr)
   */
  class TypeScriptConditional extends TypeScriptNode {
    constructor(condition, trueExpr, falseExpr) {
      super('Conditional');
      this.condition = condition;
      this.trueExpression = trueExpr;
      this.falseExpression = falseExpr;
    }
  }

  /**
   * Arrow function expression ((args) => body)
   */
  class TypeScriptArrowFunction extends TypeScriptNode {
    constructor(parameters, body, returnType = null) {
      super('ArrowFunction');
      this.parameters = parameters;     // TypeScriptParameter[]
      this.body = body;                 // TypeScriptBlock or TypeScriptExpression
      this.returnType = returnType;     // TypeScriptType or null
      this.isAsync = false;
    }
  }

  /**
   * This expression
   */
  class TypeScriptThis extends TypeScriptNode {
    constructor() { super('This'); }
  }

  /**
   * Super expression
   */
  class TypeScriptSuper extends TypeScriptNode {
    constructor() { super('Super'); }
  }

  /**
   * Typeof expression
   */
  class TypeScriptTypeOf extends TypeScriptNode {
    constructor(expression) {
      super('TypeOf');
      this.expression = expression;
    }
  }

  /**
   * Parenthesized expression ((expr))
   */
  class TypeScriptParenthesized extends TypeScriptNode {
    constructor(expression) {
      super('Parenthesized');
      this.expression = expression;
    }
  }

  /**
   * Template literal `text ${expr}`
   */
  class TypeScriptTemplateLiteral extends TypeScriptNode {
    constructor(quasis = [], expressions = []) {
      super('TemplateLiteral');
      this.quasis = quasis;             // string[] - the static text parts
      this.expressions = expressions;   // TypeScriptExpression[] - the interpolated expressions
      this.parts = [];                  // Legacy [{text, expression}] format
    }
  }

  /**
   * Yield expression (for generators)
   * yield value or yield* iterable
   */
  class TypeScriptYieldExpression extends TypeScriptNode {
    constructor(argument = null, delegate = false) {
      super('YieldExpression');
      this.argument = argument;         // TypeScriptExpression or null
      this.delegate = delegate;         // true for yield*, false for yield
    }
  }

  /**
   * Chain expression (for optional chaining)
   * a?.b, a?.b(), a?.[index]
   */
  class TypeScriptChainExpression extends TypeScriptNode {
    constructor(expression) {
      super('ChainExpression');
      this.expression = expression;     // The inner expression
    }
  }

  /**
   * Await expression (for async functions)
   * await promise
   */
  class TypeScriptAwaitExpression extends TypeScriptNode {
    constructor(argument) {
      super('AwaitExpression');
      this.argument = argument;         // TypeScriptExpression
    }
  }

  /**
   * Delete expression
   * delete obj.property
   */
  class TypeScriptDeleteExpression extends TypeScriptNode {
    constructor(argument) {
      super('DeleteExpression');
      this.argument = argument;         // TypeScriptExpression
    }
  }

  /**
   * Spread element
   * ...array, ...object
   */
  class TypeScriptSpreadElement extends TypeScriptNode {
    constructor(argument) {
      super('SpreadElement');
      this.argument = argument;         // TypeScriptExpression
    }
  }

  /**
   * Sequence expression (comma expression)
   * expr1, expr2, expr3
   */
  class TypeScriptSequenceExpression extends TypeScriptNode {
    constructor(expressions = []) {
      super('SequenceExpression');
      this.expressions = expressions;   // TypeScriptExpression[]
    }
  }

  // ========================[ JSDOC COMMENTS ]========================

  /**
   * JSDoc comment
   */
  class TypeScriptJSDoc extends TypeScriptNode {
    constructor() {
      super('JSDoc');
      this.description = null;
      this.parameters = [];             // [{name, type, description}]
      this.returns = null;              // {type, description}
      this.examples = [];
    }
  }

  // ========================[ EXPORTS ]========================

  const TypeScriptAST = {
    // Base
    TypeScriptNode,

    // Types
    TypeScriptType,

    // Compilation Unit
    TypeScriptCompilationUnit,
    TypeScriptImportDeclaration,
    TypeScriptExportDeclaration,

    // Type Declarations
    TypeScriptInterface,
    TypeScriptTypeAlias,
    TypeScriptClass,

    // Members
    TypeScriptProperty,
    TypeScriptMethod,
    TypeScriptConstructor,
    TypeScriptStaticBlock,
    TypeScriptParameter,

    // Statements
    TypeScriptBlock,
    TypeScriptVariableDeclaration,
    TypeScriptExpressionStatement,
    TypeScriptReturn,
    TypeScriptIf,
    TypeScriptFor,
    TypeScriptForOf,
    TypeScriptWhile,
    TypeScriptDoWhile,
    TypeScriptSwitch,
    TypeScriptSwitchCase,
    TypeScriptBreak,
    TypeScriptContinue,
    TypeScriptThrow,
    TypeScriptTryCatch,
    TypeScriptCatchClause,

    // Expressions
    TypeScriptLiteral,
    TypeScriptIdentifier,
    TypeScriptBinaryExpression,
    TypeScriptUnaryExpression,
    TypeScriptAssignment,
    TypeScriptMemberAccess,
    TypeScriptElementAccess,
    TypeScriptCall,
    TypeScriptNew,
    TypeScriptArrayLiteral,
    TypeScriptObjectLiteral,
    TypeScriptAssertion,
    TypeScriptConditional,
    TypeScriptArrowFunction,
    TypeScriptThis,
    TypeScriptSuper,
    TypeScriptTypeOf,
    TypeScriptParenthesized,
    TypeScriptTemplateLiteral,
    TypeScriptYieldExpression,
    TypeScriptChainExpression,
    TypeScriptAwaitExpression,
    TypeScriptDeleteExpression,
    TypeScriptSpreadElement,
    TypeScriptSequenceExpression,

    // Documentation
    TypeScriptJSDoc
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TypeScriptAST;
  }
  if (typeof global !== 'undefined') {
    global.TypeScriptAST = TypeScriptAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
