/**
 * JavaScriptAST.js - JavaScript Abstract Syntax Tree Node Types
 * Defines JavaScript-specific AST nodes for code generation
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: IL AST -> JS Transformer -> JS AST -> JS Emitter -> JS Source
 */

(function(global) {
  'use strict';

  // ========================[ BASE NODE TYPES ]========================

  /**
   * Base class for all JavaScript AST nodes
   */
  class JavaScriptNode {
    constructor(type) {
      this.nodeType = type;
      this.sourceLocation = null; // Original source location for error mapping
      this.comments = [];         // Associated comments/documentation
    }
  }

  // ========================[ COMPILATION UNIT ]========================

  /**
   * Root node representing a complete JavaScript file
   */
  class JavaScriptCompilationUnit extends JavaScriptNode {
    constructor() {
      super('CompilationUnit');
      this.imports = [];       // JavaScriptImportDeclaration[]
      this.exports = [];       // JavaScriptExportDeclaration[]
      this.statements = [];    // Top-level statements
    }
  }

  /**
   * Import declaration: import { x } from 'module';
   */
  class JavaScriptImportDeclaration extends JavaScriptNode {
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
  class JavaScriptExportDeclaration extends JavaScriptNode {
    constructor(declaration) {
      super('ExportDeclaration');
      this.declaration = declaration; // The thing being exported
      this.isDefault = false;
    }
  }

  // ========================[ DECLARATIONS ]========================

  /**
   * Class declaration
   */
  class JavaScriptClass extends JavaScriptNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.isExported = false;
      this.baseClass = null;       // JavaScriptExpression
      this.members = [];           // JavaScriptMethod[], JavaScriptProperty[]
      this.jsDoc = null;
    }
  }

  /**
   * Field/Property declaration
   */
  class JavaScriptProperty extends JavaScriptNode {
    constructor(name, initializer = null) {
      super('Property');
      this.name = name;
      this.isStatic = false;
      this.initializer = initializer; // JavaScriptExpression
      this.jsDoc = null;
    }
  }

  /**
   * Method declaration (class member)
   */
  class JavaScriptMethod extends JavaScriptNode {
    constructor(name) {
      super('Method');
      this.name = name;
      this.isStatic = false;
      this.isAsync = false;
      this.isGenerator = false;
      this.parameters = [];        // JavaScriptParameter[]
      this.body = null;            // JavaScriptBlock
      this.jsDoc = null;
    }
  }

  /**
   * Function declaration (top-level or nested function)
   */
  class JavaScriptFunction extends JavaScriptNode {
    constructor(name) {
      super('Function');
      this.name = name;
      this.isAsync = false;
      this.isGenerator = false;
      this.isExported = false;
      this.parameters = [];        // JavaScriptParameter[]
      this.body = null;            // JavaScriptBlock
      this.jsDoc = null;
    }
  }

  /**
   * Constructor declaration
   */
  class JavaScriptConstructor extends JavaScriptNode {
    constructor() {
      super('Constructor');
      this.parameters = [];
      this.body = null;
      this.jsDoc = null;
    }
  }

  /**
   * Static block (ES2022) - static { ... }
   */
  class JavaScriptStaticBlock extends JavaScriptNode {
    constructor() {
      super('StaticBlock');
      this.body = null;  // JavaScriptBlock
    }
  }

  /**
   * Method parameter
   */
  class JavaScriptParameter extends JavaScriptNode {
    constructor(name) {
      super('Parameter');
      this.name = name;
      this.isRest = false;
      this.defaultValue = null;    // JavaScriptExpression
    }
  }

  // ========================[ STATEMENTS ]========================

  /**
   * Block statement { ... }
   */
  class JavaScriptBlock extends JavaScriptNode {
    constructor() {
      super('Block');
      this.statements = [];        // JavaScriptStatement[]
    }
  }

  /**
   * Variable declaration statement
   */
  class JavaScriptVariableDeclaration extends JavaScriptNode {
    constructor(name, initializer = null) {
      super('VariableDeclaration');
      this.name = name;
      this.kind = 'const';         // 'const', 'let', or 'var'
      this.initializer = initializer; // JavaScriptExpression
    }
  }

  /**
   * Expression statement (expression;)
   */
  class JavaScriptExpressionStatement extends JavaScriptNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  /**
   * Return statement
   */
  class JavaScriptReturn extends JavaScriptNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression; // JavaScriptExpression or null
    }
  }

  /**
   * If statement
   */
  class JavaScriptIf extends JavaScriptNode {
    constructor(condition, thenBranch, elseBranch = null) {
      super('If');
      this.condition = condition;   // JavaScriptExpression
      this.thenBranch = thenBranch; // JavaScriptStatement or JavaScriptBlock
      this.elseBranch = elseBranch; // JavaScriptStatement, JavaScriptBlock, or null
    }
  }

  /**
   * For loop
   */
  class JavaScriptFor extends JavaScriptNode {
    constructor() {
      super('For');
      this.initializer = null;      // JavaScriptVariableDeclaration or JavaScriptExpression
      this.condition = null;        // JavaScriptExpression
      this.incrementor = null;      // JavaScriptExpression
      this.body = null;             // JavaScriptBlock
    }
  }

  /**
   * For-of loop
   */
  class JavaScriptForOf extends JavaScriptNode {
    constructor(variableName, collection, body) {
      super('ForOf');
      this.variableName = variableName;
      this.collection = collection; // JavaScriptExpression
      this.body = body;             // JavaScriptBlock
    }
  }

  /**
   * While loop
   */
  class JavaScriptWhile extends JavaScriptNode {
    constructor(condition, body) {
      super('While');
      this.condition = condition;
      this.body = body;
    }
  }

  /**
   * Do-While loop
   */
  class JavaScriptDoWhile extends JavaScriptNode {
    constructor(body, condition) {
      super('DoWhile');
      this.body = body;
      this.condition = condition;
    }
  }

  /**
   * Switch statement
   */
  class JavaScriptSwitch extends JavaScriptNode {
    constructor(expression) {
      super('Switch');
      this.expression = expression;
      this.cases = [];              // JavaScriptSwitchCase[]
    }
  }

  /**
   * Switch case
   */
  class JavaScriptSwitchCase extends JavaScriptNode {
    constructor(label = null) {
      super('SwitchCase');
      this.label = label;           // JavaScriptExpression or null for default
      this.isDefault = label === null;
      this.statements = [];
    }
  }

  /**
   * Break statement
   */
  class JavaScriptBreak extends JavaScriptNode {
    constructor() { super('Break'); }
  }

  /**
   * Continue statement
   */
  class JavaScriptContinue extends JavaScriptNode {
    constructor() { super('Continue'); }
  }

  /**
   * Throw statement
   */
  class JavaScriptThrow extends JavaScriptNode {
    constructor(expression) {
      super('Throw');
      this.expression = expression;
    }
  }

  /**
   * Try-Catch-Finally
   */
  class JavaScriptTryCatch extends JavaScriptNode {
    constructor() {
      super('TryCatch');
      this.tryBlock = null;
      this.catchClauses = [];       // JavaScriptCatchClause[]
      this.finallyBlock = null;
    }
  }

  class JavaScriptCatchClause extends JavaScriptNode {
    constructor(variableName, body) {
      super('CatchClause');
      this.variableName = variableName;
      this.body = body;
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /**
   * Literal expression (numbers, strings, booleans, null, regex)
   */
  class JavaScriptLiteral extends JavaScriptNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;           // The actual value
      this.literalType = literalType; // 'number', 'string', 'boolean', 'null', 'bigint', 'regex'
      this.pattern = null;          // For regex: the pattern string
      this.flags = null;            // For regex: the flags string
    }

    static Number(value) { return new JavaScriptLiteral(value, 'number'); }
    static String(value) { return new JavaScriptLiteral(value, 'string'); }
    static Boolean(value) { return new JavaScriptLiteral(value, 'boolean'); }
    static Null() { return new JavaScriptLiteral(null, 'null'); }
    static Undefined() { return new JavaScriptLiteral(undefined, 'undefined'); }
    static BigInt(value) { return new JavaScriptLiteral(value, 'bigint'); }
    static Regex(pattern, flags) {
      const lit = new JavaScriptLiteral(null, 'regex');
      lit.pattern = pattern;
      lit.flags = flags || '';
      return lit;
    }
  }

  /**
   * Identifier expression (variable, member name)
   */
  class JavaScriptIdentifier extends JavaScriptNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  /**
   * Binary expression (a + b, a && b, etc.)
   */
  class JavaScriptBinaryExpression extends JavaScriptNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;     // '+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>', '>>>', '==', '!=', '<', '>', '<=', '>=', '&&', '||'
      this.right = right;
    }
  }

  /**
   * Unary expression (!x, -x, ++x, x++, etc.)
   */
  class JavaScriptUnaryExpression extends JavaScriptNode {
    constructor(operator, operand, isPrefix = true) {
      super('UnaryExpression');
      this.operator = operator;     // '!', '-', '~', '++', '--', 'typeof', 'void', 'delete'
      this.operand = operand;
      this.isPrefix = isPrefix;
    }
  }

  /**
   * Assignment expression (x = y, x += y, etc.)
   */
  class JavaScriptAssignment extends JavaScriptNode {
    constructor(target, operator, value) {
      super('Assignment');
      this.target = target;
      this.operator = operator;     // '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='
      this.value = value;
    }
  }

  /**
   * Member access (obj.member)
   */
  class JavaScriptMemberAccess extends JavaScriptNode {
    constructor(target, member) {
      super('MemberAccess');
      this.target = target;         // JavaScriptExpression
      this.member = member;         // string (member name)
      this.isOptional = false;      // For optional chaining ?.
    }
  }

  /**
   * Element access (arr[index])
   */
  class JavaScriptElementAccess extends JavaScriptNode {
    constructor(target, index) {
      super('ElementAccess');
      this.target = target;
      this.index = index;           // JavaScriptExpression
    }
  }

  /**
   * Method/Function invocation
   */
  class JavaScriptCall extends JavaScriptNode {
    constructor(target, methodName, args = []) {
      super('Call');
      this.target = target;         // JavaScriptExpression or null for simple call
      this.methodName = methodName;
      this.arguments = args;        // JavaScriptExpression[]
    }
  }

  /**
   * Object creation (new Type(args))
   */
  class JavaScriptNew extends JavaScriptNode {
    constructor(className, args = []) {
      super('New');
      this.className = className;   // string
      this.arguments = args;        // JavaScriptExpression[]
    }
  }

  /**
   * Array literal [1, 2, 3]
   */
  class JavaScriptArrayLiteral extends JavaScriptNode {
    constructor(elements = []) {
      super('ArrayLiteral');
      this.elements = elements;     // JavaScriptExpression[]
    }
  }

  /**
   * Object literal { key: value, ... }
   */
  class JavaScriptObjectLiteral extends JavaScriptNode {
    constructor() {
      super('ObjectLiteral');
      this.properties = [];         // [{key, value}]
    }
  }

  /**
   * Conditional expression (condition ? trueExpr : falseExpr)
   */
  class JavaScriptConditional extends JavaScriptNode {
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
  class JavaScriptArrowFunction extends JavaScriptNode {
    constructor(parameters, body) {
      super('ArrowFunction');
      this.parameters = parameters; // JavaScriptParameter[]
      this.body = body;             // JavaScriptBlock or JavaScriptExpression
      this.isAsync = false;
    }
  }

  /**
   * This expression
   */
  class JavaScriptThis extends JavaScriptNode {
    constructor() { super('This'); }
  }

  /**
   * Super expression
   */
  class JavaScriptSuper extends JavaScriptNode {
    constructor() { super('Super'); }
  }

  /**
   * Parenthesized expression ((expr))
   */
  class JavaScriptParenthesized extends JavaScriptNode {
    constructor(expression) {
      super('Parenthesized');
      this.expression = expression;
    }
  }

  /**
   * Template literal `text ${expr}`
   */
  class JavaScriptTemplateLiteral extends JavaScriptNode {
    constructor() {
      super('TemplateLiteral');
      this.parts = [];              // [{text, expression}]
    }
  }

  /**
   * Yield expression (for generators)
   * yield value or yield* iterable
   */
  class JavaScriptYieldExpression extends JavaScriptNode {
    constructor(argument = null, delegate = false) {
      super('YieldExpression');
      this.argument = argument;     // JavaScriptExpression or null
      this.delegate = delegate;     // true for yield*, false for yield
    }
  }

  /**
   * Chain expression (for optional chaining)
   * a?.b, a?.b(), a?.[index]
   */
  class JavaScriptChainExpression extends JavaScriptNode {
    constructor(expression) {
      super('ChainExpression');
      this.expression = expression; // The inner expression
    }
  }

  /**
   * Spread element (...expr)
   * Used in arrays and function arguments
   */
  class JavaScriptSpreadElement extends JavaScriptNode {
    constructor(argument) {
      super('SpreadElement');
      this.argument = argument; // JavaScriptExpression
    }
  }

  /**
   * Await expression (await promise)
   */
  class JavaScriptAwaitExpression extends JavaScriptNode {
    constructor(argument) {
      super('AwaitExpression');
      this.argument = argument; // JavaScriptExpression
    }
  }

  /**
   * Delete expression (delete obj.prop)
   */
  class JavaScriptDeleteExpression extends JavaScriptNode {
    constructor(argument) {
      super('DeleteExpression');
      this.argument = argument; // JavaScriptExpression
    }
  }

  /**
   * Sequence expression (a, b, c)
   */
  class JavaScriptSequenceExpression extends JavaScriptNode {
    constructor(expressions = []) {
      super('SequenceExpression');
      this.expressions = expressions; // JavaScriptExpression[]
    }
  }

  // ========================[ JSDOC COMMENTS ]========================

  /**
   * JSDoc comment
   */
  class JavaScriptJSDoc extends JavaScriptNode {
    constructor() {
      super('JSDoc');
      this.description = null;
      this.parameters = [];         // [{name, type, description}]
      this.returns = null;          // {type, description}
      this.examples = [];
    }
  }

  // ========================[ EXPORTS ]========================

  const JavaScriptAST = {
    // Base
    JavaScriptNode,

    // Compilation Unit
    JavaScriptCompilationUnit,
    JavaScriptImportDeclaration,
    JavaScriptExportDeclaration,

    // Declarations
    JavaScriptClass,
    JavaScriptProperty,
    JavaScriptMethod,
    JavaScriptFunction,
    JavaScriptConstructor,
    JavaScriptStaticBlock,
    JavaScriptParameter,

    // Statements
    JavaScriptBlock,
    JavaScriptVariableDeclaration,
    JavaScriptExpressionStatement,
    JavaScriptReturn,
    JavaScriptIf,
    JavaScriptFor,
    JavaScriptForOf,
    JavaScriptWhile,
    JavaScriptDoWhile,
    JavaScriptSwitch,
    JavaScriptSwitchCase,
    JavaScriptBreak,
    JavaScriptContinue,
    JavaScriptThrow,
    JavaScriptTryCatch,
    JavaScriptCatchClause,

    // Expressions
    JavaScriptLiteral,
    JavaScriptIdentifier,
    JavaScriptBinaryExpression,
    JavaScriptUnaryExpression,
    JavaScriptAssignment,
    JavaScriptMemberAccess,
    JavaScriptElementAccess,
    JavaScriptCall,
    JavaScriptNew,
    JavaScriptArrayLiteral,
    JavaScriptObjectLiteral,
    JavaScriptConditional,
    JavaScriptArrowFunction,
    JavaScriptThis,
    JavaScriptSuper,
    JavaScriptParenthesized,
    JavaScriptTemplateLiteral,
    JavaScriptYieldExpression,
    JavaScriptChainExpression,
    JavaScriptSpreadElement,
    JavaScriptAwaitExpression,
    JavaScriptDeleteExpression,
    JavaScriptSequenceExpression,

    // Documentation
    JavaScriptJSDoc
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = JavaScriptAST;
  }
  if (typeof global !== 'undefined') {
    global.JavaScriptAST = JavaScriptAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
