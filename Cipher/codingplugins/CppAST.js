/**
 * CppAST.js - C++ Abstract Syntax Tree Node Types
 * The statement and declaration structure of a C++ translation unit, as
 * CppTransformer builds it from the typed IL AST and CppEmitter prints it.
 * Expressions are already C++ text when they reach this tree: the transformer
 * types and converts every operand, so only their layout is left to emit.
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> IL AST (typed) -> C++ AST -> C++ Emitter -> C++ Source
 */

(function(global) {
  'use strict';

  /** Base of every C++ AST node */
  class CppNode {
    constructor(nodeType) {
      this.nodeType = nodeType;
    }
  }

  /** A translation unit: the runtime prelude, then the namespaced sections */
  class CppFile extends CppNode {
    constructor() {
      super('File');
      this.includeRuntime = true;
      this.namespace = null;
      this.sections = []; // CppNode[]
    }
  }

  /** Verbatim lines (declarations the transformer spells out) */
  class CppRaw extends CppNode {
    constructor(text) {
      super('Raw');
      this.text = text;
    }
  }

  /** A comment line */
  class CppComment extends CppNode {
    constructor(text) {
      super('Comment');
      this.text = text;
    }
  }

  /** A class: its base and member declaration lines */
  class CppClass extends CppNode {
    constructor(name, base) {
      super('Class');
      this.name = name;
      this.base = base;      // C++ base class name, or null
      this.members = [];     // CppNode[] (CppRaw lines, CppFunction for inline bodies)
    }
  }

  /** A function or method definition: its signature and body */
  class CppFunction extends CppNode {
    constructor(signature, body) {
      super('Function');
      this.signature = signature; // full C++ declarator text
      this.body = body;           // CppBlock
    }
  }

  class CppBlock extends CppNode {
    constructor(statements = []) {
      super('Block');
      this.statements = statements;
    }
  }

  class CppExpressionStatement extends CppNode {
    constructor(expression) {
      super('ExpressionStatement');
      this.expression = expression; // C++ text
    }
  }

  class CppVariableDeclaration extends CppNode {
    constructor(type, name, init) {
      super('VariableDeclaration');
      this.type = type;  // C++ type text
      this.name = name;
      this.init = init;  // C++ text, or null for value initialization
    }
  }

  class CppIf extends CppNode {
    constructor(test, consequent, alternate) {
      super('If');
      this.test = test;
      this.consequent = consequent; // CppNode
      this.alternate = alternate;   // CppNode or null
    }
  }

  class CppFor extends CppNode {
    constructor(init, test, update, body) {
      super('For');
      this.init = init;     // CppNode (declaration/expression statement) or null
      this.test = test;     // C++ text or null
      this.update = update; // C++ text or null
      this.body = body;
    }
  }

  class CppWhile extends CppNode {
    constructor(test, body) {
      super('While');
      this.test = test;
      this.body = body;
    }
  }

  class CppDoWhile extends CppNode {
    constructor(body, test) {
      super('DoWhile');
      this.body = body;
      this.test = test;
    }
  }

  class CppReturn extends CppNode {
    constructor(value) {
      super('Return');
      this.value = value; // C++ text or null
    }
  }

  class CppBreak extends CppNode { constructor() { super('Break'); } }
  class CppContinue extends CppNode { constructor() { super('Continue'); } }

  class CppGoto extends CppNode {
    constructor(label) {
      super('Goto');
      this.label = label;
    }
  }

  class CppLabel extends CppNode {
    constructor(name) {
      super('Label');
      this.name = name;
    }
  }

  class CppThrow extends CppNode {
    constructor(value) {
      super('Throw');
      this.value = value; // C++ text
    }
  }

  /** try { block } catch (...) { handler } - the handler binds the thrown value */
  class CppTry extends CppNode {
    constructor(block, catchDeclaration, handler) {
      super('Try');
      this.block = block;
      this.catchDeclaration = catchDeclaration; // C++ statement text binding the caught value, or null
      this.handler = handler;                   // CppBlock or null (rethrows)
    }
  }

  /** switch over an integer selector */
  class CppSwitch extends CppNode {
    constructor(discriminant) {
      super('Switch');
      this.discriminant = discriminant;
      this.cases = []; // { labels: string[] ('default' for the default), body: CppNode[] }
    }
  }

  const CppAST = {
    CppNode, CppFile, CppRaw, CppComment, CppClass, CppFunction, CppBlock,
    CppExpressionStatement, CppVariableDeclaration, CppIf, CppFor, CppWhile, CppDoWhile,
    CppReturn, CppBreak, CppContinue, CppGoto, CppLabel, CppThrow, CppTry, CppSwitch
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CppAST;
  }
  if (typeof global !== 'undefined') {
    global.CppAST = CppAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
