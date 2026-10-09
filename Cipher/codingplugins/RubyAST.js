/**
 * RubyAST.js - Ruby Abstract Syntax Tree Node Types
 * The Ruby nodes RubyTransformer builds from the IL AST and RubyEmitter prints.
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference (IL AST) -> Ruby AST -> Ruby Emitter -> Ruby Source
 *
 * Expressions carry no layout: the emitter adds the parentheses Ruby's
 * operator precedence requires. Statements are structured (class, method,
 * if, while, begin/rescue, case) so the emitter owns indentation.
 */

(function(global) {
  'use strict';

  /** Base of every node: its nodeType names the emitter method (emit<nodeType>). */
  class RubyNode {
    constructor(type) {
      this.nodeType = type;
    }
  }

  // ========================[ FILE STRUCTURE ]========================

  /** A source file: magic comments, a doc comment, then items. */
  class RubyModule extends RubyNode {
    constructor() {
      super('Module');
      this.magicComments = [];
      this.docComment = null;
      this.items = [];
    }
  }

  class RubyMagicComment extends RubyNode {
    constructor(name, value) {
      super('MagicComment');
      this.name = name;
      this.value = value;
    }
  }

  class RubyDocComment extends RubyNode {
    constructor(text) {
      super('DocComment');
      this.text = text;
    }
  }

  /** module Name ... end */
  class RubyModuleDef extends RubyNode {
    constructor(name, body = []) {
      super('ModuleDef');
      this.name = name;
      this.body = body;
    }
  }

  /** class Name < Superclass ... end */
  class RubyClass extends RubyNode {
    constructor(name, superclass = null) {
      super('Class');
      this.name = name;
      this.superclass = superclass;
      this.body = [];
    }
  }

  /** attr_accessor :a, :b (static: on the singleton class) */
  class RubyAttribute extends RubyNode {
    constructor(kind, names, isStatic = false) {
      super('Attribute');
      this.kind = kind;
      this.names = names;
      this.isStatic = isStatic;
    }
  }

  /** def name(params) ... end, def self.name, def name=(v) */
  class RubyMethod extends RubyNode {
    constructor(name, parameters = [], body = null, isStatic = false) {
      super('Method');
      this.name = name;
      this.parameters = parameters;
      this.body = body || new RubyBlock();
      this.isStatic = isStatic;
    }
  }

  /** A parameter: plain, with a default, or a rest (*name) */
  class RubyParameter extends RubyNode {
    constructor(name, defaultValue = null, isRest = false) {
      super('Parameter');
      this.name = name;
      this.defaultValue = defaultValue;
      this.isRest = isRest;
    }
  }

  // ========================[ STATEMENTS ]========================

  class RubyBlock extends RubyNode {
    constructor(statements = []) {
      super('Block');
      this.statements = statements;
    }
  }

  class RubyExpressionStatement extends RubyNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression;
    }
  }

  class RubyComment extends RubyNode {
    constructor(text) {
      super('Comment');
      this.text = text;
    }
  }

  class RubyReturn extends RubyNode {
    constructor(expression = null) {
      super('Return');
      this.expression = expression;
    }
  }

  class RubyBreak extends RubyNode {
    constructor() {
      super('Break');
    }
  }

  class RubyNext extends RubyNode {
    constructor() {
      super('Next');
    }
  }

  class RubyRaise extends RubyNode {
    constructor(exception) {
      super('Raise');
      this.exception = exception;
    }
  }

  /** if / elsif / else */
  class RubyIf extends RubyNode {
    constructor(condition, thenBranch, elsifBranches = [], elseBranch = null) {
      super('If');
      this.condition = condition;
      this.thenBranch = thenBranch;
      this.elsifBranches = elsifBranches;
      this.elseBranch = elseBranch;
    }
  }

  /** while cond ... end, or begin ... end while cond when isDoWhile */
  class RubyWhile extends RubyNode {
    constructor(condition, body, isDoWhile = false) {
      super('While');
      this.condition = condition;
      this.body = body;
      this.isDoWhile = isDoWhile;
    }
  }

  /** for variable in iterable ... end (no new scope, unlike a block) */
  class RubyFor extends RubyNode {
    constructor(variable, iterable, body) {
      super('For');
      this.variable = variable;
      this.iterable = iterable;
      this.body = body;
    }
  }

  /** case subject when a, b ... else ... end */
  class RubyCase extends RubyNode {
    constructor(subject, whens = [], elseBody = null) {
      super('Case');
      this.subject = subject;
      this.whens = whens;
      this.elseBody = elseBody;
    }
  }

  class RubyWhen extends RubyNode {
    constructor(patterns, body) {
      super('When');
      this.patterns = patterns;
      this.body = body;
    }
  }

  /** begin ... rescue ... ensure ... end */
  class RubyBegin extends RubyNode {
    constructor(body, rescues = [], ensureBody = null) {
      super('Begin');
      this.body = body;
      this.rescues = rescues;
      this.ensureBody = ensureBody;
    }
  }

  class RubyRescue extends RubyNode {
    constructor(exceptionTypes, variableName, body) {
      super('Rescue');
      this.exceptionTypes = exceptionTypes;
      this.variableName = variableName;
      this.body = body;
    }
  }

  /** Verbatim lines (the runtime prelude, the harness) */
  class RubyRawCode extends RubyNode {
    constructor(code) {
      super('RawCode');
      this.code = code;
    }
  }

  // ========================[ EXPRESSIONS ]========================

  /** A literal: int, float, string, bool, nil, symbol; or verbatim code of a value (raw) */
  class RubyLiteral extends RubyNode {
    constructor(value, literalType) {
      super('Literal');
      this.value = value;
      this.literalType = literalType;
    }
  }

  /** A name as written: local, @ivar, $global, Constant, Scoped::Constant, self */
  class RubyIdentifier extends RubyNode {
    constructor(name) {
      super('Identifier');
      this.name = name;
    }
  }

  class RubyBinaryExpression extends RubyNode {
    constructor(left, operator, right) {
      super('BinaryExpression');
      this.left = left;
      this.operator = operator;
      this.right = right;
    }
  }

  class RubyUnaryExpression extends RubyNode {
    constructor(operator, operand) {
      super('UnaryExpression');
      this.operator = operator;
      this.operand = operand;
    }
  }

  /** receiver.method(args) { block }; no receiver: method(args); method 'call' with useShortCall: receiver.(args) */
  class RubyMethodCall extends RubyNode {
    constructor(receiver, methodName, args = [], block = null) {
      super('MethodCall');
      this.receiver = receiver;
      this.methodName = methodName;
      this.arguments = args;
      this.block = block;
      this.useShortCall = false;
      this.forceParens = true;
    }
  }

  /** target[index, ...] */
  class RubyIndex extends RubyNode {
    constructor(target, index) {
      super('Index');
      this.target = target;
      this.indices = Array.isArray(index) ? index : [index];
    }
  }

  /** target = value, target op= value (an expression in Ruby) */
  class RubyAssignment extends RubyNode {
    constructor(target, value, operator = '=') {
      super('Assignment');
      this.target = target;
      this.value = value;
      this.operator = operator;
    }
  }

  /** a, b = x (parallel assignment) */
  class RubyMultipleAssignment extends RubyNode {
    constructor(targets, value) {
      super('MultipleAssignment');
      this.targets = targets;
      this.value = value;
    }
  }

  class RubyArrayLiteral extends RubyNode {
    constructor(elements = []) {
      super('ArrayLiteral');
      this.elements = elements;
    }
  }

  /** { key => value } with [key, value] pairs */
  class RubyHashLiteral extends RubyNode {
    constructor(pairs = []) {
      super('HashLiteral');
      this.pairs = pairs;
    }
  }

  /** ->(params) { body } */
  class RubyLambda extends RubyNode {
    constructor(parameters, body) {
      super('Lambda');
      this.parameters = parameters;
      this.body = body;
    }
  }

  /** { |params| body } passed to a call */
  class RubyBlockExpression extends RubyNode {
    constructor(parameters, body) {
      super('BlockExpression');
      this.parameters = parameters;
      this.body = body;
    }
  }

  class RubyConditional extends RubyNode {
    constructor(condition, thenExpr, elseExpr) {
      super('Conditional');
      this.condition = condition;
      this.thenExpr = thenExpr;
      this.elseExpr = elseExpr;
    }
  }

  class RubySplat extends RubyNode {
    constructor(expression) {
      super('Splat');
      this.expression = expression;
    }
  }

  /** (a; b; c) - expressions evaluated in order, the value of the last */
  class RubySequence extends RubyNode {
    constructor(expressions) {
      super('Sequence');
      this.expressions = expressions;
    }
  }

  /** super(args) */
  class RubySuper extends RubyNode {
    constructor(args = []) {
      super('Super');
      this.arguments = args;
    }
  }

  /** Verbatim expression code with its precedence (default: needs parentheses everywhere) */
  class RubyRawExpression extends RubyNode {
    constructor(code, precedence = 0) {
      super('RawExpression');
      this.code = code;
      this.precedence = precedence;
    }
  }

  const RubyAST = {
    RubyNode,
    RubyModule, RubyMagicComment, RubyDocComment, RubyModuleDef, RubyClass, RubyAttribute,
    RubyMethod, RubyParameter,
    RubyBlock, RubyExpressionStatement, RubyComment, RubyReturn, RubyBreak, RubyNext, RubyRaise,
    RubyIf, RubyWhile, RubyFor, RubyCase, RubyWhen, RubyBegin, RubyRescue, RubyRawCode,
    RubyLiteral, RubyIdentifier, RubyBinaryExpression, RubyUnaryExpression, RubyMethodCall, RubyIndex,
    RubyAssignment, RubyMultipleAssignment, RubyArrayLiteral, RubyHashLiteral, RubyLambda,
    RubyBlockExpression, RubyConditional, RubySplat, RubySequence, RubySuper, RubyRawExpression
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RubyAST;
  }
  if (typeof global !== 'undefined') {
    global.RubyAST = RubyAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
