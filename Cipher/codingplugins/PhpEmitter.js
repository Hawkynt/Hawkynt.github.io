/**
 * PhpEmitter.js - PHP Code Generator
 * (c)2006-2025 Hawkynt
 *
 * Spells the JavaScript reference AST (annotated by PhpTransformer) in PHP,
 * keeping JavaScript's semantics on PHP's values with the runtime of
 * php-runtime.php (namespace JS):
 *
 * - A file is a PHP namespace of its own. Its top-level variables are static
 *   properties of the namespace's class M (functions reach them as M::$x),
 *   its functions namespaced functions, its classes classes.
 * - Every class allows dynamic properties and reaches its accessors through
 *   __get/__set: a getter `get x()` is the method get_x(), a setter set_x().
 * - A nested function or a function expression is a closure capturing by
 *   reference what it uses of the enclosing functions; a block-scoped
 *   variable that shadows one of its own function is renamed.
 * - Operators take the IL types of their operands: an integer bitwise
 *   operation is inlined with the 32-bit wrap JavaScript gives it (none where
 *   the operands cannot reach bit 31), a BigInt operation is GMP's, and an
 *   operation on an open type calls the runtime.
 *
 * Pipeline: IL AST -> PHP Transformer -> annotated JavaScript AST -> PHP Emitter -> PHP Source
 */

(function(global) {
  'use strict';

  // ========================[ TYPES ]========================

  const INT_RANGES = {
    'uint8': [0, 255], 'byte': [0, 255], 'int8': [-128, 127], 'sbyte': [-128, 127],
    'uint16': [0, 65535], 'ushort': [0, 65535], 'word': [0, 65535], 'int16': [-32768, 32767], 'short': [-32768, 32767],
    'uint32': [0, 4294967295], 'uint': [0, 4294967295], 'dword': [0, 4294967295],
    'int32': [-2147483648, 2147483647], 'int': [-2147483648, 2147483647]
  };
  const NUMBER_TYPES = new Set(['float32', 'float64', 'number', 'double', 'float']);
  const BIG_TYPES = new Set(['bigint', 'BigInt']);
  const INT32_MIN = -2147483648, INT32_MAX = 2147483647, UINT32_MAX = 4294967295;

  const typeOfNode = node => (node && node.il && node.il.type) || null;
  const isBigType = t => BIG_TYPES.has(t);
  const isStringType = t => t === 'string' || t === 'char';
  const isBoolType = t => t === 'boolean' || t === 'bool';
  const isNumType = t => !!t && (INT_RANGES[t] !== undefined || NUMBER_TYPES.has(t));
  const isArrayType = t => typeof t === 'string' && t.endsWith('[]');
  const isObjectLikeType = t => typeof t === 'string' && (isArrayType(t) || /^[A-Z]/.test(t)) && !BIG_TYPES.has(t);

  // PHP keywords a function or class may not be named
  const PHP_RESERVED = new Set(['abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch', 'class', 'clone',
    'const', 'continue', 'declare', 'default', 'die', 'do', 'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor',
    'endforeach', 'endif', 'endswitch', 'endwhile', 'eval', 'exit', 'extends', 'final', 'finally', 'fn', 'for',
    'foreach', 'function', 'global', 'goto', 'if', 'implements', 'include', 'include_once', 'instanceof', 'insteadof',
    'interface', 'isset', 'list', 'match', 'namespace', 'new', 'or', 'print', 'private', 'protected', 'public',
    'readonly', 'require', 'require_once', 'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use', 'var',
    'while', 'xor', 'yield', 'self', 'parent', 'int', 'float', 'bool', 'string', 'true', 'false', 'null', 'void',
    'iterable', 'object', 'mixed', 'never', 'enum', '__halt_compiler', 'm']);

  /** Methods of strings and numbers (which PHP's string and int values cannot have) */
  const PRIMITIVE_METHODS = new Set(['toString', 'slice', 'indexOf', 'includes', 'concat', 'lastIndexOf', 'at',
    'charCodeAt', 'charAt', 'codePointAt', 'substring', 'substr', 'padStart', 'padEnd', 'toUpperCase', 'toLowerCase',
    'trim', 'trimStart', 'trimEnd', 'split', 'startsWith', 'endsWith', 'repeat', 'replace', 'replaceAll', 'match',
    'search', 'localeCompare', 'normalize', 'toFixed', 'toPrecision', 'valueOf']);
  /** IL types that may be a BigInt or a Number */
  const OPEN_NUMERIC = new Set(['uint64', 'int64', 'ulong', 'long', 'qword']);

  /** Typed array constructor -> runtime kind */
  const TYPED_KINDS = {
    Uint8Array: 'uint8', Int8Array: 'int8', Uint8ClampedArray: 'uint8c', Uint16Array: 'uint16', Int16Array: 'int16',
    Uint32Array: 'uint32', Int32Array: 'int32', Float32Array: 'float32', Float64Array: 'float64',
    BigInt64Array: 'bigint64', BigUint64Array: 'biguint64'
  };
  const ERROR_CLASSES = new Set(['Error', 'RangeError', 'TypeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError']);
  const MATH_CONSTANTS = { PI: '\\M_PI', E: '\\M_E', LN2: '\\M_LN2', LN10: '\\M_LN10', LOG2E: '\\M_LOG2E', LOG10E: '\\M_LOG10E', SQRT2: '\\M_SQRT2', SQRT1_2: '\\M_SQRT1_2' };
  const NUMBER_CONSTANTS = {
    MAX_SAFE_INTEGER: '9007199254740991', MIN_SAFE_INTEGER: '-9007199254740991', MAX_VALUE: '\\PHP_FLOAT_MAX',
    MIN_VALUE: '4.9E-324', EPSILON: '\\PHP_FLOAT_EPSILON', POSITIVE_INFINITY: '\\INF', NEGATIVE_INFINITY: '(-\\INF)', NaN: '\\NAN'
  };

  /** A PHP variable name for a JavaScript identifier */
  function phpName(name) {
    return String(name).replace(/\$/g, '_S_').replace(/^#/, '_P_');
  }

  /**
   * The PHP method of a JavaScript accessor: get_<name> / set_<name>, the
   * name with its upper case letters and underscores escaped (PHP method
   * names ignore case, JavaScript's do not: Key and key are two accessors).
   * php-runtime.php's ObjectBehavior spells it the same way.
   */
  function accessorName(kind, name) {
    const s = String(name);
    return kind + '_' + (/[A-Z_]/.test(s) ? s.replace(/[A-Z_]/g, c => (c === '_' ? '__' : '_' + c.toLowerCase())) : s);
  }

  /** A PHP string literal */
  function phpString(value) {
    const s = String(value);
    if (/^[\x20-\x7e]*$/.test(s) && !/[\\']/.test(s)) return `'${s}'`;
    let out = '"';
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (ch === '\\') out += '\\\\';
      else if (ch === '"') out += '\\"';
      else if (ch === '$') out += '\\$';
      else if (c === 10) out += '\\n';
      else if (c === 13) out += '\\r';
      else if (c === 9) out += '\\t';
      else if (c < 0x20 || c === 0x7f) out += '\\x' + c.toString(16).padStart(2, '0');
      else if (c > 0x7e) out += '\\u{' + c.toString(16) + '}';
      else out += ch;
    }
    return out + '"';
  }

  /** A PHP numeric literal with the JavaScript number's value */
  function phpNumber(v) {
    if (Number.isNaN(v)) return '\\NAN';
    if (v === Infinity) return '\\INF';
    if (v === -Infinity) return '(-\\INF)';
    if (Object.is(v, -0)) return '-0.0';
    if (Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER) return v < 0 ? `(${v})` : String(v);
    // Past 2^53 a JavaScript number is a float whatever it looks like
    let s = String(v);
    if (Number.isInteger(v)) s = v.toExponential().replace('e+', 'E+');
    else if (!/[.eE]/.test(s)) s += '.0';
    return v < 0 ? `(${s})` : s;
  }

  // ========================[ SCOPES ]========================

  /**
   * A function's scope: its blocks of declarations (innermost last), the
   * names it declares anywhere (hoisted), and what it captures by reference.
   */
  class Scope {
    constructor(parent, kind) {
      this.parent = parent;           // enclosing Scope, null for the module
      this.kind = kind;               // 'module', 'function' (a PHP function or method), 'closure'
      this.blocks = [new Map()];      // JavaScript name -> PHP name
      this.hoisted = new Set();       // every name declared somewhere in this function
      this.used = new Set();          // PHP names taken in this function
      this.captures = new Set();      // PHP names a closure takes by reference
      this.temp = 0;
      this.breakable = [];            // 'loop' | 'switch', innermost last
      this.usesArguments = false;
    }
    lookup(name) {
      for (let i = this.blocks.length - 1; i >= 0; --i)
        if (this.blocks[i].has(name)) return this.blocks[i].get(name);
      return null;
    }
  }

  /**
   * PHP Code Emitter
   */
  class PhpEmitter {
    /**
     * @param {Object} options - { indent, newline, namespace, framework: { classes, functions, values, namespace }, opcodes }
     */
    constructor(options = {}) {
      this.indentString = options.indent || '    ';
      this.newline = options.newline || '\n';
      this.namespace = options.namespace !== undefined && options.namespace !== null ? options.namespace : 'CipherValidation';
      const fw = options.framework || {};
      this.framework = {
        classes: new Set(fw.classes || []),
        functions: new Set(fw.functions || []),
        values: new Set(fw.values || []),
        methods: new Set(fw.methods || []),
        namespace: fw.namespace || 'AlgorithmFramework'
      };
      // Names of the OpCodes class (\OpCodes), and of the file's own classes when it is the framework
      this.opcodesClass = options.opcodes || '\\OpCodes';
      this.isFrameworkUnit = !!options.isFramework;
      this.level = 0;
      // Classes being emitted around the current code (`this` is an object only inside one)
      this.classDepth = 0;
    }

    // ========================[ OUTPUT HELPERS ]========================

    ind() { return this.indentString.repeat(this.level); }
    line(text) { return this.ind() + text + this.newline; }
    temp() {
      const scope = this.scope;
      return `$__t${++scope.temp}`;
    }

    // ========================[ COMPILATION UNIT ]========================

    emit(unit) {
      this.module = { vars: new Map(), functions: new Map(), classes: new Map(), methodNames: new Set(), staticBlocks: 0 };
      this.scope = new Scope(null, 'module');
      this.collectModule(unit);

      const body = [];
      this.level = 1;
      for (const stmt of unit.statements) {
        // What a factory returns is what the file exports
        if (stmt.nodeType === 'Return') {
          if (stmt.expression) body.push(this.line(`\\JS\\Module::$exports[__NAMESPACE__] = ${this.expr(stmt.expression)};`));
          continue;
        }
        body.push(this.emitTopLevel(stmt));
      }
      this.level = 0;

      let out = (this.namespace ? `namespace ${this.namespace} {` : 'namespace {') + this.newline;
      if (this.module.vars.size) {
        out += this.line('    final class M {').replace(/^/, '');
        for (const php of this.module.vars.values()) out += `        public static $${php};` + this.newline;
        out += '    }' + this.newline + this.newline;
      }
      out += body.join('');
      out += '}' + this.newline;
      return out;
    }

    /** The file's top-level names: variables (M::$x), functions and classes. */
    collectModule(unit) {
      const takenFunctions = new Set();
      for (const stmt of unit.statements) {
        const decls = Array.isArray(stmt) ? stmt : [stmt];
        for (const d of decls) {
          if (!d) continue;
          if (d.nodeType === 'VariableDeclaration') this.module.vars.set(d.name, phpName(d.name));
          else if (d.nodeType === 'Function') {
            let name = phpName(d.name);
            if (PHP_RESERVED.has(name.toLowerCase()) || takenFunctions.has(name.toLowerCase())) name += '_fn';
            takenFunctions.add(name.toLowerCase());
            this.module.functions.set(d.name, name);
          } else if (d.nodeType === 'Class') this.registerClass(d);
        }
      }
      // Classes declared anywhere (class expressions in initializers) and every method name
      const walk = node => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (node.nodeType === 'Class' && !this.module.classes.has(node.name)) this.registerClass(node);
        if (node.nodeType === 'Method' && node.name) this.module.methodNames.add(node.name);
        for (const key of Object.keys(node)) if (key !== 'il' && key !== 'parent') walk(node[key]);
      };
      walk(unit.statements);
      // Method names that differ only in case (PHP ignores it): the
      // framework's and the first of the file's keep theirs, the others
      // become m_<escaped name>
      this.methodMap = new Map();
      const byLower = new Map();
      for (const n of this.framework.methods) byLower.set(n.toLowerCase(), n);
      for (const n of [...this.module.methodNames].sort()) {
        const lower = n.toLowerCase();
        if (!byLower.has(lower)) { byLower.set(lower, n); continue; }
        if (byLower.get(lower) !== n) this.methodMap.set(n, 'm_' + accessorName('', n).slice(1));
      }
      // Static properties assigned from outside a class: X.name = value
      const statics = node => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(statics); return; }
        if (node.nodeType === 'Assignment' && node.target && node.target.nodeType === 'MemberAccess'
            && node.target.target && node.target.target.nodeType === 'Identifier' && this.module.classes.has(node.target.target.name))
          this.module.classes.get(node.target.target.name).statics.add(node.target.member);
        for (const key of Object.keys(node)) if (key !== 'il') statics(node[key]);
      };
      statics(unit.statements);
    }

    /** The PHP name of a JavaScript method (see collectModule) */
    methodName(name) {
      return (this.methodMap && this.methodMap.get(name)) || phpName(name);
    }

    registerClass(cls) {
      let name = phpName(cls.name);
      if (PHP_RESERVED.has(name.toLowerCase())) name += '_';
      const info = { php: name, statics: new Set(), methods: new Set(), staticMethods: new Set(), accessors: new Set() };
      for (const m of cls.members || []) {
        if (!m) continue;
        if (m.nodeType === 'Property' && m.isStatic) info.statics.add(m.name);
        if (m.nodeType === 'Method') {
          if (m.kind === 'get' || m.kind === 'set') info.accessors.add(m.name);
          else if (m.isStatic) info.staticMethods.add(m.name);
          else info.methods.add(m.name);
        }
      }
      this.module.classes.set(cls.name, info);
    }

    emitTopLevel(stmt) {
      if (Array.isArray(stmt)) return stmt.map(s => this.emitTopLevel(s)).join('');
      switch (stmt.nodeType) {
        case 'Class': return this.emitClass(stmt) + this.newline;
        case 'Function': return this.emitFunctionDeclaration(stmt) + this.newline;
        default: return this.emitStatement(stmt);
      }
    }

    // ========================[ NAMES ]========================

    /** The PHP variable for a JavaScript variable in the current scope chain, capturing it where a closure must */
    resolveVariable(name) {
      const crossed = [];
      for (let scope = this.scope; scope; scope = scope.parent) {
        let php = null;
        if (scope.kind === 'module') {
          // A module-level block local (the module's own top level is M::$x)
          for (let i = scope.blocks.length - 1; i >= 1; --i) if (scope.blocks[i].has(name)) { php = scope.blocks[i].get(name); break; }
        } else {
          php = scope.lookup(name);
          // A name the function declares later (hoisted, or a closure using a later declaration)
          if (php === null && scope.hoisted.has(name)) php = phpName(name);
        }
        if (php !== null) {
          // Every closure between here and the declaring scope captures it by reference
          for (const c of crossed) c.captures.add(php);
          return '$' + php;
        }
        // A PHP function or method sees nothing of the scopes around it but the module
        if (scope.kind === 'function' || scope.kind === 'module') return null;
        crossed.push(scope);
      }
      return null;
    }

    /** Declare a JavaScript variable in the current block, renaming it where it would shadow a visible one */
    declare(name, isVar = false) {
      const scope = this.scope;
      if (scope.kind === 'module' && (scope.blocks.length === 1 || isVar)) {
        if (!this.module.vars.has(name)) this.module.vars.set(name, phpName(name));
        return 'M::$' + this.module.vars.get(name);
      }
      let php = phpName(name);
      const block = isVar ? scope.blocks[0] : scope.blocks[scope.blocks.length - 1];
      if (block.has(name)) return '$' + block.get(name);
      const visible = scope.lookup(name);
      if (visible !== null || php === 'this' || php === 'GLOBALS' || /^_(GET|POST|SERVER|COOKIE|FILES|ENV|REQUEST|SESSION)$/.test(php)) {
        let n = 2;
        while (scope.used.has(`${php}_${n}`)) ++n;
        php = `${php}_${n}`;
      }
      scope.used.add(php);
      block.set(name, php);
      return '$' + php;
    }

    /** Every name a function body declares (var, let, const, function, catch, for), not entering nested functions */
    hoistNames(body, scope) {
      const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(visit); return; }
        switch (node.nodeType) {
          case 'VariableDeclaration': scope.hoisted.add(node.name); break;
          case 'Function': scope.hoisted.add(node.name); return;
          case 'ArrowFunction': case 'Class': case 'Method': case 'Constructor': return;
          case 'ForOf': scope.hoisted.add(node.variableName); break;
          case 'CatchClause': scope.hoisted.add(node.variableName); break;
          default: break;
        }
        for (const key of Object.keys(node)) if (key !== 'il') visit(node[key]);
      };
      visit(body);
    }

    // ========================[ CLASSES ]========================

    /** The PHP name of a class a JavaScript expression names */
    classRef(node) {
      if (typeof node === 'string') return this.className(node);
      if (!node) return null;
      if (node.nodeType === 'Identifier') return this.className(node.name);
      if (node.nodeType === 'MemberAccess' && node.target && node.target.nodeType === 'Identifier') {
        if (node.target.name === 'AlgorithmFramework') return this.className(node.member);
        if (node.target.name === 'OpCodes') return `\\OpCodes_${phpName(node.member)}`;
      }
      return null;
    }

    className(name) {
      if (this.module.classes.has(name)) return this.module.classes.get(name).php;
      if (this.framework.classes.has(name)) return `\\${this.framework.namespace}\\${name}`;
      if (ERROR_CLASSES.has(name)) return `\\JS\\${name}`;
      if (name === 'Map' || name === 'Set') return `\\JS\\${name}`;
      if (name === 'Array') return '\\JS\\JsArray';
      if (name === 'Object') return '\\JS\\Obj';
      if (name === 'DataView') return '\\JS\\DataView';
      if (name === 'ArrayBuffer') return '\\JS\\JsBuffer';
      return phpName(name);
    }

    emitClass(cls) {
      const info = this.module.classes.get(cls.name) || (this.registerClass(cls), this.module.classes.get(cls.name));
      const base = cls.baseClass ? this.classRef(cls.baseClass) : null;
      let code = this.line('#[\\AllowDynamicProperties]');
      code += this.line(`class ${info.php}` + (base ? ` extends ${base}` : ' implements \\ArrayAccess'));
      code += this.line('{');
      ++this.level;
      if (!base) code += this.line('use \\JS\\ObjectBehavior;');
      for (const s of info.statics) code += this.line(`public static $${phpName(s)};`);
      const instanceFields = cls.members.filter(m => m && m.nodeType === 'Property' && !m.isStatic);
      const after = [];
      let hasConstructor = false;
      this.classDepth = (this.classDepth || 0) + 1;
      for (const member of cls.members) {
        if (!member) continue;
        switch (member.nodeType) {
          case 'Constructor':
            hasConstructor = true;
            code += this.emitMethodLike(member, '__construct', false, instanceFields, !!base);
            break;
          case 'Method': {
            const name = member.kind === 'get' || member.kind === 'set' ? accessorName(member.kind, member.name) : this.methodName(member.name);
            code += this.emitMethodLike(member, name, member.isStatic, null, false);
            break;
          }
          case 'Property':
            if (member.isStatic && member.initializer) after.push({ name: member.name, init: member.initializer });
            break;
          case 'StaticBlock':
            after.push({ block: member });
            break;
          default:
            break;
        }
      }
      if (!hasConstructor && instanceFields.length) {
        // The fields JavaScript initializes on construction
        const ctor = { nodeType: 'Constructor', parameters: [{ nodeType: 'Parameter', name: 'args', isRest: true }], body: { nodeType: 'Block', statements: [] }, synthesized: true };
        code += this.emitMethodLike(ctor, '__construct', false, instanceFields, !!base);
      }
      --this.level;
      code += this.line('}');
      // Static initializers and static blocks run after the class exists (with `this` the class)
      for (const item of after) {
        if (item.block) {
          // static { ... } runs once, with `this` the class
          code += this.line('(static function () {');
          ++this.level;
          const saved = this.scope;
          this.scope = new Scope(saved, 'function');
          this.scope.isStatic = true;
          this.hoistNames(item.block.body, this.scope);
          code += this.emitBlockStatements(item.block.body);
          this.scope = saved;
          --this.level;
          code += this.line(`})->bindTo(null, ${info.php}::class)();`);
        } else {
          code += this.line(`${info.php}::$${phpName(item.name)} = ${this.expr(item.init)};`);
        }
      }
      --this.classDepth;
      return code;
    }

    /** A method, constructor or function body with its parameters */
    emitMethodLike(node, name, isStatic, fields, hasBase) {
      const saved = this.scope;
      this.scope = new Scope(saved, 'function');
      this.scope.isStatic = isStatic;
      const params = this.emitParameters(node.parameters || []);
      this.hoistNames(node.body, this.scope);
      ++this.level;
      let prologue = params.prologue;
      let bodyCode = '';
      const statements = (node.body && node.body.statements) || [];
      if (node.synthesized && hasBase) prologue += this.line('parent::__construct(...$args);');
      if (fields && fields.length) {
        // Field initializers: before the body of a base class, right after super() in a derived one
        const init = fields.map(f => this.line(`$this->${this.propName(f.name)} = ${f.initializer ? this.expr(f.initializer) : 'null'};`)).join('');
        if (hasBase) {
          const at = statements.findIndex(s => s && s.nodeType === 'ExpressionStatement' && s.expression && s.expression.nodeType === 'Call' && s.expression.methodName === 'super' && !s.expression.target);
          const before = this.emitStatements(statements.slice(0, at + 1));
          bodyCode = before + init + this.emitStatements(statements.slice(at + 1));
        } else {
          bodyCode = init + this.emitStatements(statements);
        }
      } else {
        bodyCode = this.emitStatements(statements);
      }
      if (this.scope.usesArguments) prologue = this.line('$arguments = new \\JS\\JsArray(\\func_get_args());') + prologue;
      --this.level;
      this.scope = saved;
      const isGenerator = !!node.isGenerator;
      void isGenerator;
      return this.line(`public ${isStatic ? 'static ' : ''}function ${name}(${params.list})`) + this.line('{') + prologue + bodyCode + this.line('}');
    }

    /** A PHP property name (braced when it is not an identifier) */
    propName(name) {
      return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name)) ? String(name) : `{${phpString(name)}}`;
    }

    // ========================[ FUNCTIONS ]========================

    /**
     * Parameters: each optional (null for undefined), a default that is not
     * a constant set in the body, a rest parameter made an array.
     * @returns {{list: string, prologue: string}}
     */
    emitParameters(parameters) {
      const list = [];
      let prologue = '';
      ++this.level;
      for (const p of parameters) {
        const v = this.declare(p.name, true);
        if (p.isRest) {
          list.push(`...${v}`);
          prologue += this.line(`${v} = new \\JS\\JsArray(${v});`);
        } else if (p.defaultValue && this.isConstantLiteral(p.defaultValue)) {
          list.push(`${v} = ${this.expr(p.defaultValue)}`);
        } else if (p.defaultValue) {
          list.push(`${v} = null`);
          prologue += this.line(`if (${v} === null) ${v} = ${this.expr(p.defaultValue)};`);
        } else {
          list.push(`${v} = null`);
        }
      }
      --this.level;
      return { list: list.join(', '), prologue };
    }

    isConstantLiteral(node) {
      if (!node) return false;
      if (node.nodeType === 'Literal') return ['number', 'string', 'boolean', 'null', 'undefined'].includes(node.literalType);
      if (node.nodeType === 'UnaryExpression' && node.operator === '-' && node.operand && node.operand.nodeType === 'Literal' && node.operand.literalType === 'number') return true;
      return false;
    }

    emitFunctionDeclaration(fn) {
      const name = this.module.functions.get(fn.name) || phpName(fn.name);
      const savedDepth = this.classDepth;
      this.classDepth = 0;
      try {
        return this.emitFunctionDeclarationBody(fn, name);
      } finally {
        this.classDepth = savedDepth;
      }
    }

    emitFunctionDeclarationBody(fn, name) {
      const saved = this.scope;
      this.scope = new Scope(saved, 'function');
      const params = this.emitParameters(fn.parameters || []);
      this.hoistNames(fn.body, this.scope);
      ++this.level;
      const body = this.emitStatements((fn.body && fn.body.statements) || []);
      let prologue = params.prologue;
      if (this.scope.usesArguments) prologue = this.line('$arguments = new \\JS\\JsArray(\\func_get_args());') + prologue;
      --this.level;
      this.scope = saved;
      return this.line(`function ${name}(${params.list})`) + this.line('{') + prologue + body + this.line('}');
    }

    /** A closure: function expression, arrow function, or nested function declaration */
    closure(parameters, body, isExpressionBody) {
      const saved = this.scope;
      this.scope = new Scope(saved, 'closure');
      const params = this.emitParameters(parameters || []);
      this.hoistNames(body, this.scope);
      const savedLevel = this.level;
      this.level = savedLevel + 1;
      let code;
      if (isExpressionBody) code = this.line(`return ${this.expr(body)};`);
      else code = this.emitStatements((body && body.statements) || []);
      let prologue = params.prologue;
      if (this.scope.usesArguments) prologue = this.line('$arguments = new \\JS\\JsArray(\\func_get_args());') + prologue;
      this.level = savedLevel;
      const own = new Set([...this.scope.blocks[0].values()]);
      const captures = [...this.scope.captures].filter(c => !own.has(c));
      this.scope = saved;
      const use = captures.length ? ` use (${captures.map(c => '&$' + c).join(', ')})` : '';
      return `function (${params.list})${use} {` + this.newline + prologue + code + this.ind() + '}';
    }

    // ========================[ STATEMENTS ]========================

    emitStatements(statements) {
      let code = '';
      // A nested function declaration is hoisted to the top of its function
      const list = [];
      for (const s of statements || []) {
        if (Array.isArray(s)) list.push(...s);
        else if (s) list.push(s);
      }
      for (const s of list) if (s.nodeType === 'Function' && this.scope.kind !== 'module') code += this.emitNestedFunction(s);
      for (const s of list) if (!(s.nodeType === 'Function' && this.scope.kind !== 'module')) code += this.emitStatement(s);
      return code;
    }

    emitNestedFunction(fn) {
      const v = this.declare(fn.name, true);
      return this.line(`${v} = ${this.closure(fn.parameters, fn.body, false)};`);
    }

    emitBlockStatements(block) {
      if (!block) return '';
      if (block.nodeType !== 'Block') return this.emitStatement(block);
      this.scope.blocks.push(new Map());
      const code = this.emitStatements(block.statements);
      this.scope.blocks.pop();
      return code;
    }

    /** The body of a statement that takes one (if, loop): its statements, braced */
    body(node) {
      ++this.level;
      const code = node && node.nodeType === 'Block' ? this.emitBlockStatements(node) : (node ? this.emitBlockStatements({ nodeType: 'Block', statements: [node] }) : '');
      --this.level;
      return code;
    }

    emitStatement(node) {
      if (!node) return '';
      if (Array.isArray(node)) return node.map(n => this.emitStatement(n)).join('');
      switch (node.nodeType) {
        case 'VariableDeclaration': {
          const init = node.initializer ? this.expr(node.initializer) : 'null';
          const v = this.declare(node.name, node.kind === 'var');
          return this.line(`${v} = ${init};`);
        }
        case 'ExpressionStatement':
          return this.line(`${this.expr(node.expression, true)};`);
        case 'Return':
          if (this.scope.kind === 'module') return '';
          return this.line(node.expression ? `return ${this.expr(node.expression)};` : 'return;');
        case 'If': {
          let code = this.line(`if (${this.cond(node.condition)}) {`) + this.body(node.thenBranch);
          let elseBranch = node.elseBranch;
          while (elseBranch && elseBranch.nodeType === 'If') {
            code += this.line(`} elseif (${this.cond(elseBranch.condition)}) {`) + this.body(elseBranch.thenBranch);
            elseBranch = elseBranch.elseBranch;
          }
          if (elseBranch) code += this.line('} else {') + this.body(elseBranch);
          return code + this.line('}');
        }
        case 'For': return this.emitFor(node);
        case 'ForOf': {
          this.scope.blocks.push(new Map());
          const collection = node.isForIn ? `\\JS\\keysOf(${this.expr(node.collection)})` : `\\JS\\iterate(${this.expr(node.collection)})`;
          const v = this.declare(node.variableName);
          this.scope.breakable.push('loop');
          const code = this.line(`foreach (${collection} as ${v}) {`) + this.body(node.body) + this.line('}');
          this.scope.breakable.pop();
          this.scope.blocks.pop();
          return code;
        }
        case 'While': {
          this.scope.breakable.push('loop');
          const code = this.line(`while (${this.cond(node.condition)}) {`) + this.body(node.body) + this.line('}');
          this.scope.breakable.pop();
          return code;
        }
        case 'DoWhile': {
          this.scope.breakable.push('loop');
          const code = this.line('do {') + this.body(node.body) + this.line(`} while (${this.cond(node.condition)});`);
          this.scope.breakable.pop();
          return code;
        }
        case 'Switch': return this.emitSwitch(node);
        case 'Break': return this.line('break;');
        case 'Continue': {
          // PHP counts a switch as a loop for continue
          let levels = 1;
          for (let i = this.scope.breakable.length - 1; i >= 0 && this.scope.breakable[i] === 'switch'; --i) ++levels;
          return this.line(levels > 1 ? `continue ${levels};` : 'continue;');
        }
        case 'Throw': return this.line(`throw ${this.throwable(node.expression)};`);
        case 'TryCatch': return this.emitTry(node);
        case 'Block':
          return this.line('{') + this.body(node) + this.line('}');
        case 'Function':
          return this.scope.kind === 'module' ? this.emitFunctionDeclaration(node) : this.emitNestedFunction(node);
        case 'Class':
          return this.emitClass(node);
        case 'StaticBlock':
          return '';
        default:
          // Any expression used as a statement
          if (node.nodeType && node.nodeType !== 'Property' && node.nodeType !== 'Method') return this.line(`${this.expr(node, true)};`);
          throw new Error(`PhpEmitter: no PHP for statement ${node.nodeType}`);
      }
    }

    throwable(expr) {
      if (expr && expr.nodeType === 'New') {
        const cls = typeof expr.className === 'string' ? expr.className : null;
        if (cls && (ERROR_CLASSES.has(cls) || this.module.classes.has(cls))) return this.expr(expr);
      }
      return `\\JS\\throwable(${this.expr(expr)})`;
    }

    emitFor(node) {
      this.scope.blocks.push(new Map());
      let init = '';
      const initList = Array.isArray(node.initializer) ? node.initializer : (node.initializer ? [node.initializer] : []);
      if (initList.length && initList[0].nodeType === 'VariableDeclaration') {
        init = initList.map(d => {
          const value = d.initializer ? this.expr(d.initializer) : 'null';
          return `${this.declare(d.name, d.kind === 'var')} = ${value}`;
        }).join(', ');
      } else if (initList.length) {
        init = initList.map(e => this.expr(e, true)).join(', ');
      }
      const cond = node.condition ? this.cond(node.condition) : '';
      let incr = '';
      if (node.incrementor) {
        incr = node.incrementor.nodeType === 'SequenceExpression'
          ? node.incrementor.expressions.map(e => this.expr(e, true)).join(', ')
          : this.expr(node.incrementor, true);
      }
      this.scope.breakable.push('loop');
      const code = this.line(`for (${init}; ${cond}; ${incr}) {`) + this.body(node.body) + this.line('}');
      this.scope.breakable.pop();
      this.scope.blocks.pop();
      return code;
    }

    emitSwitch(node) {
      const t = this.temp();
      let code = this.line(`${t} = ${this.expr(node.expression)};`);
      // JavaScript compares cases with ===
      code += this.line('switch (true) {');
      this.scope.breakable.push('switch');
      ++this.level;
      this.scope.blocks.push(new Map());
      for (const c of node.cases) {
        if (c.isDefault || !c.label) code += this.line('default:');
        else code += this.line(`case ${this.equality(t, typeOfNode(node.expression), c.label)}:`);
        ++this.level;
        code += this.emitStatements(c.statements);
        --this.level;
      }
      this.scope.blocks.pop();
      --this.level;
      this.scope.breakable.pop();
      return code + this.line('}');
    }

    /** `left === right` for a PHP expression left and a JavaScript node right */
    equality(leftCode, leftType, rightNode) {
      const rt = typeOfNode(rightNode);
      const right = this.expr(rightNode);
      if (rightNode.nodeType === 'Literal' && (rightNode.literalType === 'null' || rightNode.literalType === 'undefined')) return `${leftCode} === null`;
      if (isNumType(leftType) && isNumType(rt)) return `${leftCode} == ${right}`;
      if (rightNode.nodeType === 'Literal' && rightNode.literalType === 'number') return `\\JS\\strictEq(${leftCode}, ${right})`;
      if ((isStringType(leftType) || isStringType(rt)) && rightNode.nodeType === 'Literal') return `${leftCode} === ${right}`;
      return `\\JS\\strictEq(${leftCode}, ${right})`;
    }

    emitTry(node) {
      let code = this.line('try {') + this.body(node.tryBlock);
      for (const clause of node.catchClauses || []) {
        this.scope.blocks.push(new Map());
        if (clause.variableName) {
          const v = this.declare(clause.variableName);
          code += this.line(`} catch (\\Throwable ${v}) {`);
          ++this.level;
          code += this.line(`${v} = \\JS\\caught(${v});`);
          --this.level;
        } else {
          code += this.line('} catch (\\Throwable $__e) {');
        }
        code += this.body(clause.body);
        this.scope.blocks.pop();
      }
      if (node.finallyBlock) code += this.line('} finally {') + this.body(node.finallyBlock);
      return code + this.line('}');
    }

    // ========================[ EXPRESSIONS ]========================

    /**
     * PHP for a JavaScript expression.
     * @param {Object} node - JavaScript AST expression
     * @param {boolean} [statement] - its value is unused (no parentheses needed around an assignment)
     */
    expr(node, statement = false) {
      if (!node) return 'null';
      switch (node.nodeType) {
        case 'Raw': return node.code;
        case 'Literal': return this.literal(node);
        case 'Identifier': return this.identifier(node);
        // `this` outside a class is undefined (strict mode)
        case 'This': return this.scope.isStatic ? 'static::class' : (this.classDepth > 0 ? '$this' : 'null');
        case 'Super': return 'parent';
        case 'BinaryExpression': return this.binary(node);
        case 'UnaryExpression': return this.unary(node, statement);
        case 'Assignment': return this.assignment(node, statement);
        case 'MemberAccess': return this.member(node);
        case 'ElementAccess': return this.element(node);
        case 'Call': return this.call(node);
        case 'New': return this.newExpr(node);
        case 'ArrayLiteral': return this.arrayLiteral(node);
        case 'ObjectLiteral': return this.objectLiteral(node);
        case 'Conditional': return `(${this.cond(node.condition)} ? ${this.expr(node.trueExpression)} : ${this.expr(node.falseExpression)})`;
        case 'ArrowFunction': {
          const isExpr = node.body && node.body.nodeType !== 'Block';
          return this.closure(node.parameters, node.body, isExpr);
        }
        case 'Parenthesized': return `(${this.expr(node.expression)})`;
        case 'TemplateLiteral': return this.template(node);
        case 'SequenceExpression': return `\\JS\\seq(${node.expressions.map(e => this.expr(e, true)).join(', ')})`;
        case 'SpreadElement': return `...\\JS\\spreadOf(${this.expr(node.argument)})`;
        case 'ChainExpression': return this.expr(node.expression);
        case 'YieldExpression': return node.delegate ? `(yield from \\JS\\iterate(${this.expr(node.argument)}))` : `(yield ${node.argument ? this.expr(node.argument) : 'null'})`;
        case 'AwaitExpression': return this.expr(node.argument);
        case 'DeleteExpression': return this.deleteExpr(node.argument);
        case 'Class': return this.classExpression(node);
        case 'TypeAssertion': return this.expr(node.expression);
        default:
          throw new Error(`PhpEmitter: no PHP for expression ${node.nodeType}`);
      }
    }

    literal(node) {
      switch (node.literalType) {
        case 'null': case 'undefined': return 'null';
        case 'boolean': return node.value ? 'true' : 'false';
        case 'string': return phpString(node.value);
        case 'bigint': return `\\JS\\big('${BigInt(node.value).toString()}')`;
        case 'regex': return `new \\JS\\RegExp(${phpString(node.pattern)}, ${phpString(node.flags || '')})`;
        default: {
          const v = typeof node.value === 'number' ? node.value : Number(node.value);
          return phpNumber(v);
        }
      }
    }

    identifier(node) {
      const name = node.name;
      switch (name) {
        case 'undefined': return 'null';
        case 'NaN': return '\\NAN';
        case 'Infinity': return '\\INF';
        case 'arguments': this.scope.usesArguments = true; return '$arguments';
        default: break;
      }
      // A module loader's names are undefined: the files it would load are bundled
      if ((name === 'require' || name === 'module' || name === 'exports' || name === 'define') && !this.resolveVariable(name) && !this.module.vars.has(name)) return 'null';
      const v = this.resolveVariable(name);
      if (v) return v;
      if (this.module.vars.has(name)) return 'M::$' + this.module.vars.get(name);
      if (this.module.functions.has(name)) return `\\Closure::fromCallable(__NAMESPACE__ . '\\${this.module.functions.get(name)}')`;
      if (this.module.classes.has(name)) return `${this.module.classes.get(name).php}::class`;
      if (this.framework.values.has(name)) return `\\${this.framework.namespace}\\M::$${name}`;
      if (this.framework.functions.has(name)) return `\\Closure::fromCallable('\\${this.framework.namespace}\\${name}')`;
      if (this.framework.classes.has(name)) return `\\${this.framework.namespace}\\${name}::class`;
      if (name === 'AlgorithmFramework') return `\\${this.framework.namespace}\\M::$__exports`;
      if (name === 'OpCodes') return '\\OpCodes::class';
      if (name === 'globalThis' || name === 'global' || name === 'window' || name === 'self') return '\\JS\\globalThis()';
      // A name the file does not declare: bound by the bundle (a factory parameter)
      return `\\JS\\ext(${phpString(name)})`;
    }

    // ========================[ TYPES OF EXPRESSIONS ]========================

    /** [min, max] an integer expression can take, or null when it may not be an integer */
    range(node) {
      if (!node) return null;
      if (node.nodeType === 'Literal' && node.literalType === 'number' && Number.isInteger(node.value)) return [node.value, node.value];
      if (node.nodeType === 'Parenthesized') return this.range(node.expression);
      if (node.nodeType === 'BinaryExpression') {
        const op = node.operator;
        if (op === '>>>') return [0, UINT32_MAX];
        if (op === '&') {
          // JavaScript's & is a signed 32-bit result unless a side is a 31-bit non-negative bound
          const l = this.range(node.left), r = this.range(node.right);
          if (l && l[0] >= 0 && l[1] <= INT32_MAX) return [0, l[1]];
          if (r && r[0] >= 0 && r[1] <= INT32_MAX) return [0, r[1]];
          return [INT32_MIN, INT32_MAX];
        }
        if (op === '|' || op === '^' || op === '<<' || op === '>>') {
          const l = this.range(node.left), r = this.range(node.right);
          if (op === '>>' && l && l[0] >= 0 && l[1] <= INT32_MAX) return [0, l[1]];
          if ((op === '|' || op === '^') && l && r && l[0] >= 0 && r[0] >= 0 && l[1] <= 0xFFFF && r[1] <= 0xFFFF) return [0, 0xFFFF];
          return [INT32_MIN, INT32_MAX];
        }
        if (op === '%') {
          const l = this.range(node.left), r = this.range(node.right);
          if (l && r && l[0] >= 0 && r[0] > 0) return [0, r[1] - 1];
        }
        // Sums and products of integers stay integers while they are exact
        if (op === '+' || op === '-' || op === '*') {
          const l = this.range(node.left), r = this.range(node.right);
          if (l && r) {
            let lo, hi;
            if (op === '+') { lo = l[0] + r[0]; hi = l[1] + r[1]; }
            else if (op === '-') { lo = l[0] - r[1]; hi = l[1] - r[0]; }
            else { const p = [l[0] * r[0], l[0] * r[1], l[1] * r[0], l[1] * r[1]]; lo = Math.min(...p); hi = Math.max(...p); }
            if (lo >= -Number.MAX_SAFE_INTEGER && hi <= Number.MAX_SAFE_INTEGER) return [lo, hi];
          }
        }
      }
      if (node.nodeType === 'UnaryExpression' && node.operator === '~') return [INT32_MIN, INT32_MAX];
      const t = typeOfNode(node);
      if (t && INT_RANGES[t]) return INT_RANGES[t];
      // a length is a whole number
      if (node.nodeType === 'MemberAccess' && node.member === 'length') return [0, 2 ** 32];
      return null;
    }

    isInt(node) { return this.range(node) !== null; }
    within(node, min, max) { const r = this.range(node); return !!r && r[0] >= min && r[1] <= max; }
    isNumeric(node) {
      if (!node) return false;
      if (node.nodeType === 'Literal') return node.literalType === 'number';
      if (this.isInt(node)) return true;
      return isNumType(typeOfNode(node));
    }
    isBig(node) {
      if (!node) return false;
      if (node.nodeType === 'Literal') return node.literalType === 'bigint';
      return isBigType(typeOfNode(node));
    }
    isString(node) {
      if (!node) return false;
      if (node.nodeType === 'Literal') return node.literalType === 'string';
      if (node.nodeType === 'TemplateLiteral') return true;
      return isStringType(typeOfNode(node));
    }
    isBool(node) {
      if (!node) return false;
      if (node.nodeType === 'Literal') return node.literalType === 'boolean';
      if (node.nodeType === 'BinaryExpression' && ['==', '!=', '===', '!==', '<', '>', '<=', '>=', 'instanceof', 'in'].includes(node.operator)) return true;
      if (node.nodeType === 'UnaryExpression' && node.operator === '!') return true;
      if (node.nodeType === 'BinaryExpression' && (node.operator === '&&' || node.operator === '||')) return this.isBool(node.left) && this.isBool(node.right);
      return isBoolType(typeOfNode(node));
    }
    /** An object or array: truthy exactly when it is not null */
    isObject(node) {
      if (!node) return false;
      if (['ArrayLiteral', 'ObjectLiteral', 'New', 'ArrowFunction'].includes(node.nodeType)) return true;
      return isObjectLikeType(typeOfNode(node));
    }

    /** A PHP int for a bitwise operand */
    intOperand(node) {
      const code = this.expr(node);
      return this.isInt(node) ? code : `\\JS\\i(${code})`;
    }

    // ========================[ CONDITIONS ]========================

    /** A PHP boolean that is the JavaScript truthiness of the expression */
    cond(node) {
      if (!node) return 'true';
      if (node.nodeType === 'BinaryExpression' && (node.operator === '&&' || node.operator === '||'))
        return `(${this.cond(node.left)} ${node.operator} ${this.cond(node.right)})`;
      if (node.nodeType === 'UnaryExpression' && node.operator === '!') return `!${this.cond(node.operand)}`;
      if (node.nodeType === 'Parenthesized') return this.cond(node.expression);
      const code = this.expr(node);
      if (this.isBool(node)) return code;
      if (this.isInt(node)) return `(${code} != 0)`;
      if (this.isObject(node)) return `(${code} !== null)`;
      return `\\JS\\truthy(${code})`;
    }

    // ========================[ OPERATORS ]========================

    binary(node) {
      const op = node.operator;
      const L = node.left, R = node.right;
      switch (op) {
        case '&&': case '||': return this.logical(node);
        case '??': return `(${this.expr(L)} ?? ${this.expr(R)})`;
        case '===': case '!==': {
          const eq = this.strictEquality(L, R);
          return op === '===' ? eq : `!${eq}`;
        }
        case '==': case '!=': {
          let eq;
          if (this.isNullLiteral(R)) eq = `(${this.expr(L)} === null)`;
          else if (this.isNullLiteral(L)) eq = `(${this.expr(R)} === null)`;
          else if (this.isNumeric(L) && this.isNumeric(R)) eq = `(${this.expr(L)} == ${this.expr(R)})`;
          else eq = `\\JS\\looseEq(${this.expr(L)}, ${this.expr(R)})`;
          return op === '==' ? eq : `!${eq}`;
        }
        case '<': case '>': case '<=': case '>=': {
          if ((this.isNumeric(L) || this.isBig(L)) && (this.isNumeric(R) || this.isBig(R))) return `(${this.expr(L)} ${op} ${this.expr(R)})`;
          if (this.isString(L) && this.isString(R)) return `(\\strcmp(${this.expr(L)}, ${this.expr(R)}) ${op} 0)`;
          const fn = { '<': 'lt', '>': 'gt', '<=': 'le', '>=': 'ge' }[op];
          return `\\JS\\${fn}(${this.expr(L)}, ${this.expr(R)})`;
        }
        case 'instanceof': return this.instanceOf(L, R);
        case 'in': return `\\JS\\has(${this.expr(R)}, ${this.expr(L)})`;
        case '+': return this.plus(L, R);
        case '-': case '*': case '/': case '%': case '**': return this.arithmetic(op, L, R, node);
        case '&': case '|': case '^': case '<<': case '>>': case '>>>': return this.bitwise(op, L, R, node);
        default:
          throw new Error(`PhpEmitter: no PHP for operator ${op}`);
      }
    }

    isNullLiteral(node) { return node && node.nodeType === 'Literal' && (node.literalType === 'null' || node.literalType === 'undefined'); }

    strictEquality(L, R) {
      // obj.x === undefined: a property set to null is null, not undefined
      const isUndefined = n => n && ((n.nodeType === 'Literal' && n.literalType === 'undefined') || (n.nodeType === 'Identifier' && n.name === 'undefined'));
      if (isUndefined(R) && L.nodeType === 'MemberAccess' && L.target.nodeType !== 'This' && !this.isString(L.target))
        return `\\JS\\undefinedProp(${this.expr(L.target)}, ${phpString(L.member)})`;
      if (isUndefined(L) && R.nodeType === 'MemberAccess' && R.target.nodeType !== 'This' && !this.isString(R.target))
        return `\\JS\\undefinedProp(${this.expr(R.target)}, ${phpString(R.member)})`;
      if (this.isNullLiteral(R)) return `(${this.expr(L)} === null)`;
      if (this.isNullLiteral(L)) return `(${this.expr(R)} === null)`;
      // typeof x === 'string'
      if ((this.isNumeric(L) && this.isNumeric(R)) || (this.isBig(L) && this.isBig(R))) return `(${this.expr(L)} == ${this.expr(R)})`;
      if ((this.isString(L) && this.isString(R)) || (this.isBool(L) && this.isBool(R))) return `(${this.expr(L)} === ${this.expr(R)})`;
      if ((this.isString(L) && R.nodeType === 'Literal') || (this.isString(R) && L.nodeType === 'Literal')) return `(${this.expr(L)} === ${this.expr(R)})`;
      if (L.nodeType === 'UnaryExpression' && L.operator === 'typeof') return `(${this.expr(L)} === ${this.expr(R)})`;
      if (this.isObject(L) && this.isObject(R)) return `(${this.expr(L)} === ${this.expr(R)})`;
      return `\\JS\\strictEq(${this.expr(L)}, ${this.expr(R)})`;
    }

    logical(node) {
      const L = node.left, R = node.right;
      if (this.isBool(L) && this.isBool(R)) return `(${this.cond(L)} ${node.operator} ${this.cond(R)})`;
      const t = this.temp();
      if (node.operator === '||') {
        if (this.isObject(L)) return `(${this.expr(L)} ?? ${this.expr(R)})`;
        return `(\\JS\\truthy(${t} = ${this.expr(L)}) ? ${t} : ${this.expr(R)})`;
      }
      return `(\\JS\\truthy(${t} = ${this.expr(L)}) ? ${this.expr(R)} : ${t})`;
    }

    plus(L, R) {
      if (this.isBig(L) && this.isBig(R)) return `(${this.expr(L)} + ${this.expr(R)})`;
      if (this.isNumeric(L) && this.isNumeric(R)) return `(${this.expr(L)} + ${this.expr(R)})`;
      if (this.isString(L) || this.isString(R)) {
        const part = n => this.isString(n) ? this.expr(n) : `\\JS\\toStr(${this.expr(n)})`;
        return `(${part(L)} . ${part(R)})`;
      }
      return `\\JS\\add(${this.expr(L)}, ${this.expr(R)})`;
    }

    /** Bits an operand of a multiplication can take, or Infinity */
    magnitudeBits(node) {
      const r = this.range(node);
      if (!r) return Infinity;
      const m = Math.max(Math.abs(r[0]), Math.abs(r[1]));
      return m === 0 ? 0 : Math.ceil(Math.log2(m + 1));
    }

    arithmetic(op, L, R) {
      const big = this.isBig(L) || this.isBig(R);
      if (big) {
        const a = this.expr(L), b = this.expr(R);
        switch (op) {
          case '-': return `(${a} - ${b})`;
          case '*': return `(${a} * ${b})`;
          case '/': return `\\JS\\bigDiv(${a}, ${b})`;
          case '%': return `\\JS\\bigMod(${a}, ${b})`;
          default: return `\\JS\\pow(${a}, ${b})`;
        }
      }
      const numeric = this.isNumeric(L) && this.isNumeric(R);
      const a = this.expr(L), b = this.expr(R);
      switch (op) {
        case '-':
          if (numeric) return `(${a} - ${b})`;
          return `\\JS\\sub(${a}, ${b})`;
        case '*':
          // A product past 2^53 is rounded in JavaScript and exact in PHP
          if (numeric && this.magnitudeBits(L) + this.magnitudeBits(R) <= 53) return `(${a} * ${b})`;
          return `\\JS\\mul(${a}, ${b})`;
        case '/':
          return `\\JS\\div(${a}, ${b})`;
        case '%':
          if (this.isInt(L) && this.isInt(R) && R.nodeType === 'Literal' && R.value !== 0) return `(${a} % ${b})`;
          return `\\JS\\mod(${a}, ${b})`;
        default:
          return `\\JS\\pow(${a}, ${b})`;
      }
    }

    bitwise(op, L, R) {
      if (this.isBig(L) || this.isBig(R)) {
        const a = this.expr(L), b = this.expr(R);
        if (op === '<<') return `\\JS\\bigShl(${a}, ${b})`;
        if (op === '>>') return `\\JS\\bigShr(${a}, ${b})`;
        if (op === '>>>') return `\\JS\\shr(${a}, ${b})`;
        return `(${a} ${op} ${b})`;
      }
      const lt = typeOfNode(L), rt = typeOfNode(R);
      // An open type (a 64-bit value may be a BigInt) is decided when it runs
      const open = n => !this.isInt(n) && !this.isNumeric(n) && n.nodeType !== 'Literal';
      if (open(L) || open(R) || (lt && !INT_RANGES[lt] && !NUMBER_TYPES.has(lt) && L.nodeType !== 'Literal' && !this.isInt(L))) {
        const fn = { '&': 'band', '|': 'bor', '^': 'bxor', '<<': 'shl', '>>': 'sar', '>>>': 'shr' }[op];
        return `\\JS\\${fn}(${this.expr(L)}, ${this.expr(R)})`;
      }
      void rt;
      return this.integerBitwise(op, L, R, false);
    }

    /** Whether a node is a 32-bit integer bitwise operation this emitter inlines */
    isInlineBitwise(node) {
      if (!node) return false;
      if (node.nodeType === 'UnaryExpression' && node.operator === '~') return !this.isBig(node.operand) && this.isInt(node.operand);
      if (node.nodeType !== 'BinaryExpression' || !['&', '|', '^', '<<', '>>', '>>>'].includes(node.operator)) return false;
      if (this.isBig(node.left) || this.isBig(node.right)) return false;
      const ok = n => this.isInt(n) || this.isNumeric(n) || n.nodeType === 'Literal';
      return ok(node.left) && ok(node.right);
    }

    /**
     * PHP whose low 32 bits are the operand's (its higher bits may be
     * anything): an inner &, |, ^, << or ~ needs no wrap of its own when the
     * operation around it only reads the low 32 bits.
     */
    low32(node) {
      if (this.isInlineBitwise(node)) {
        if (node.nodeType === 'UnaryExpression') return `(~${this.low32(node.operand)})`;
        const op = node.operator;
        // x >>> 0 and x | 0 change nothing of the low 32 bits
        if ((op === '>>>' || op === '|') && node.right.nodeType === 'Literal' && node.right.value === 0) return this.low32(node.left);
        if (op === '&' || op === '|' || op === '^') return `(${this.low32(node.left)} ${op} ${this.low32(node.right)})`;
        if (op === '<<') {
          const n = node.right.nodeType === 'Literal' && Number.isInteger(node.right.value) ? node.right.value & 31 : null;
          return n !== null ? (n ? `(${this.low32(node.left)} << ${n})` : this.low32(node.left)) : `(${this.low32(node.left)} << (${this.intOperand(node.right)} & 31))`;
        }
        return this.integerBitwise(op, node.left, node.right, false);
      }
      return this.intOperand(node);
    }

    /** An inlined 32-bit bitwise operation on integers, with JavaScript's result */
    integerBitwise(op, L, R) {
      const int32 = n => this.within(n, INT32_MIN, INT32_MAX);
      const nonNeg31 = n => this.within(n, 0, INT32_MAX);
      const wrap = code => `((${code} << 32) >> 32)`;
      const shiftLiteral = R.nodeType === 'Literal' && Number.isInteger(R.value) ? (R.value & 31) : null;
      switch (op) {
        case '&':
          // A non-negative 31-bit side bounds the result whatever the other's high bits
          if (nonNeg31(L) || nonNeg31(R)) return `(${this.low32(L)} & ${this.low32(R)})`;
          if (int32(L) && int32(R)) return `(${this.intOperand(L)} & ${this.intOperand(R)})`;
          return wrap(`(${this.low32(L)} & ${this.low32(R)})`);
        case '|': case '^':
          if (int32(L) && int32(R)) return `(${this.intOperand(L)} ${op} ${this.intOperand(R)})`;
          return wrap(`(${this.low32(L)} ${op} ${this.low32(R)})`);
        case '<<': {
          if (shiftLiteral !== null) {
            const r = this.range(L);
            const a = this.intOperand(L);
            if (r && r[0] * 2 ** shiftLiteral >= INT32_MIN && r[1] * 2 ** shiftLiteral <= INT32_MAX) return shiftLiteral ? `(${a} << ${shiftLiteral})` : a;
            return `((${this.low32(L)} << ${shiftLiteral + 32}) >> 32)`;
          }
          return wrap(`(${this.low32(L)} << (${this.intOperand(R)} & 31))`);
        }
        case '>>': {
          const src = int32(L) ? this.intOperand(L) : wrap(this.low32(L));
          if (shiftLiteral !== null) return shiftLiteral ? `(${src} >> ${shiftLiteral})` : src;
          return `(${src} >> (${this.intOperand(R)} & 31))`;
        }
        default: { // >>>
          const src = this.within(L, 0, UINT32_MAX) ? this.intOperand(L) : `(${this.low32(L)} & 0xFFFFFFFF)`;
          if (shiftLiteral !== null) return shiftLiteral ? `(${src} >> ${shiftLiteral})` : src;
          return `(${src} >> (${this.intOperand(R)} & 31))`;
        }
      }
    }

    instanceOf(L, R) {
      const a = this.expr(L);
      if (R.nodeType === 'Identifier') {
        const name = R.name;
        if (name === 'Array') return `\\JS\\isArray(${a})`;
        if (TYPED_KINDS[name]) return `(${a} instanceof \\JS\\JsArray && ${a}->kind === '${TYPED_KINDS[name]}')`;
        if (name === 'Object') return `\\is_object(${a})`;
        if (name === 'Function') return `(${a} instanceof \\Closure)`;
        if (name === 'ArrayBuffer') return `(${a} instanceof \\JS\\JsBuffer)`;
        return `(${a} instanceof ${this.className(name)})`;
      }
      const cls = this.classRef(R);
      if (cls) return `(${a} instanceof ${cls})`;
      return `(${a} instanceof ${this.expr(R)})`;
    }

    unary(node, statement) {
      const op = node.operator;
      const X = node.operand;
      switch (op) {
        case '!': return `!${this.cond(X)}`;
        case '-':
          if (this.isNumeric(X) || this.isBig(X)) {
            if (X.nodeType === 'Literal' && X.literalType === 'number') return phpNumber(-X.value);
            return `(-${this.expr(X)})`;
          }
          return `\\JS\\neg(${this.expr(X)})`;
        case '+': return this.isNumeric(X) ? this.expr(X) : `\\JS\\toNumber(${this.expr(X)})`;
        case '~':
          if (this.isBig(X)) return `(~${this.expr(X)})`;
          if (this.within(X, INT32_MIN, INT32_MAX)) return `(~${this.expr(X)})`;
          if (this.isInt(X)) return `((~${this.expr(X)} << 32) >> 32)`;
          return `\\JS\\bnot(${this.expr(X)})`;
        case 'typeof': return `\\JS\\typeOf(${this.expr(X)})`;
        case 'void': return `\\JS\\seq(${this.expr(X)}, null)`;
        case 'delete': return this.deleteExpr(X);
        case '++': case '--': {
          // PHP cannot ++ an ArrayAccess element (the increment is lost): read, add, write
          if (X.nodeType === 'ElementAccess') {
            const sign = op === '++' ? '+' : '-';
            let prefix = '';
            let elem = X;
            if (!this.pure(X)) {
              const o = this.temp(), k = this.temp();
              prefix = `${o} = ${this.expr(X.target)}, ${k} = ${this.expr(X.index)}, `;
              elem = { nodeType: 'ElementAccess', target: { nodeType: 'Raw', code: o, il: X.target.il }, index: { nodeType: 'Raw', code: k, il: X.index.il }, il: X.il };
            }
            const place = this.element(elem, true);
            const numeric = this.isNumeric(X) || this.isBig(X);
            const read = numeric ? place : `\\JS\\toNumber(${place})`;
            if (node.isPrefix || statement) {
              const code = `${place} = ${read} ${sign} 1`;
              return prefix ? `\\JS\\seq(${prefix}${code})` : (statement ? code : `(${code})`);
            }
            const t = this.temp();
            return `\\JS\\seq(${prefix}${t} = ${read}, ${place} = ${t} ${sign} 1, ${t})`;
          }
          const target = this.lvalue(X);
          if (!this.isNumeric(X) && !this.isBig(X) && !statement && this.pure(X)) {
            // JavaScript's ++ makes a number of what it increments
            const sign = op === '++' ? '+' : '-';
            if (node.isPrefix) return `(${target} = \\JS\\toNumber(${target}) ${sign} 1)`;
            const t = this.temp();
            return `\\JS\\seq(${t} = \\JS\\toNumber(${target}), ${target} = ${t} ${sign} 1, ${t})`;
          }
          return node.isPrefix ? `(${op}${target})` : (statement ? `${target}${op}` : `(${target}${op})`);
        }
        default:
          throw new Error(`PhpEmitter: no PHP for unary ${op}`);
      }
    }

    deleteExpr(X) {
      if (X.nodeType === 'MemberAccess') return `\\JS\\deleteProp(${this.expr(X.target)}, ${phpString(X.member)})`;
      if (X.nodeType === 'ElementAccess') return `\\JS\\deleteProp(${this.expr(X.target)}, ${this.expr(X.index)})`;
      return 'true';
    }

    // ========================[ ASSIGNMENT ]========================

    /** The PHP place an assignment target is */
    lvalue(node) {
      switch (node.nodeType) {
        case 'Identifier': {
          const v = this.resolveVariable(node.name);
          if (v) return v;
          if (this.module.vars.has(node.name)) return 'M::$' + this.module.vars.get(node.name);
          if (this.framework.values.has(node.name)) return `\\${this.framework.namespace}\\M::$${node.name}`;
          // An undeclared name assigned: a module variable (JavaScript's sloppy global)
          this.module.vars.set(node.name, phpName(node.name));
          return 'M::$' + phpName(node.name);
        }
        case 'MemberAccess': return this.member(node, true);
        case 'ElementAccess': return this.element(node, true);
        case 'Parenthesized': return this.lvalue(node.expression);
        default: return this.expr(node);
      }
    }

    /** Whether evaluating an expression twice is the same as once (no calls, assignments or updates) */
    pure(node) {
      if (!node) return true;
      switch (node.nodeType) {
        case 'Identifier': case 'Literal': case 'This': return true;
        case 'MemberAccess': return this.pure(node.target);
        case 'ElementAccess': return this.pure(node.target) && this.pure(node.index);
        case 'BinaryExpression': return this.pure(node.left) && this.pure(node.right);
        case 'UnaryExpression': return node.operator !== '++' && node.operator !== '--' && node.operator !== 'delete' && this.pure(node.operand);
        case 'Parenthesized': return this.pure(node.expression);
        default: return false;
      }
    }

    assignment(node, statement) {
      const op = node.operator;
      const T = node.target;
      if (op === '=') {
        if (T.nodeType === 'ObjectLiteral' || T.nodeType === 'ArrayLiteral') return this.destructure(T, node.value);
        // module.exports = value: what the file exports
        if (T.nodeType === 'MemberAccess' && T.member === 'exports' && T.target.nodeType === 'Identifier' && T.target.name === 'module' && !this.resolveVariable('module'))
          return `(\\JS\\Module::$exports[__NAMESPACE__] = ${this.expr(node.value)})`;
        const code = `${this.lvalue(T)} = ${this.expr(node.value)}`;
        return statement ? code : `(${code})`;
      }
      const binop = op.slice(0, -1);
      if (binop === '&&' || binop === '||' || binop === '??') {
        const target = this.lvalue(T);
        const test = binop === '??' ? `(${target} === null)` : (binop === '||' ? `!${this.cond(T)}` : this.cond(T));
        const code = `(${test} ? (${target} = ${this.expr(node.value)}) : ${target})`;
        return code;
      }
      let targetNode = T;
      let prefix = '';
      if (!this.pure(T)) {
        // Evaluate the object and the key once
        if (T.nodeType === 'ElementAccess') {
          const o = this.temp(), k = this.temp();
          prefix = `${o} = ${this.expr(T.target)}, ${k} = ${this.expr(T.index)}, `;
          targetNode = { nodeType: 'ElementAccess', target: { nodeType: 'Raw', code: o, il: T.target.il }, index: { nodeType: 'Raw', code: k, il: T.index.il }, il: T.il };
        } else if (T.nodeType === 'MemberAccess') {
          const o = this.temp();
          prefix = `${o} = ${this.expr(T.target)}, `;
          targetNode = { nodeType: 'MemberAccess', target: { nodeType: 'Raw', code: o, il: T.target.il }, member: T.member, il: T.il };
        }
      }
      const value = this.binary({ nodeType: 'BinaryExpression', operator: binop, left: targetNode, right: node.value, il: node.il || T.il });
      const code = `${this.lvalue(targetNode)} = ${value}`;
      if (prefix) return `\\JS\\seq(${prefix}${code})`;
      return statement ? code : `(${code})`;
    }

    /** { a: x, b: y } = value / [x, y] = value */
    destructure(pattern, valueNode) {
      const t = this.temp();
      const parts = [`${t} = ${this.expr(valueNode)}`];
      if (pattern.nodeType === 'ArrayLiteral') {
        pattern.elements.forEach((el, i) => {
          if (!el || (el.nodeType === 'Literal' && el.literalType === 'undefined')) return;
          parts.push(`${this.lvalue(el)} = ${t}[${i}]`);
        });
      } else {
        for (const p of pattern.properties) parts.push(`${this.lvalue(p.value)} = \\JS\\getProp(${t}, ${phpString(p.key)})`);
      }
      parts.push(t);
      return `\\JS\\seq(${parts.join(', ')})`;
    }

    // ========================[ MEMBERS ]========================

    member(node, isTarget = false) {
      const T = node.target;
      const name = node.member;
      const kind = node.il && node.il.kind;
      if (T.nodeType === 'Identifier') {
        const special = this.staticMember(T.name, name);
        if (special !== null) return special;
      }
      if (T.nodeType === 'Super') return `$this->${this.propName(name)}`;
      // `this` of a static method or block is the class
      if (T.nodeType === 'This' && this.scope.isStatic) return `static::$${phpName(name)}`;
      if (name === 'length' && !isTarget) {
        const tt = typeOfNode(T);
        if (this.isString(T)) return `\\JS\\strLength(${this.expr(T)})`;
        if (isArrayType(tt)) return `\\count(${this.expr(T)})`;
        // An object of a class with a length property of its own
        if (tt && /^[A-Z]/.test(tt) && !BIG_TYPES.has(tt)) return `${this.objectCode(T)}->length`;
        if (kind === 'StringLength') return `\\JS\\strLength(${this.expr(T)})`;
        return `\\JS\\len(${this.expr(T)})`;
      }
      if (this.isString(T) && !isTarget) return `\\JS\\getProp(${this.expr(T)}, ${phpString(name)})`;
      // A method read as a value is a callable bound to its object
      if (!isTarget && typeOfNode(node) === 'function' && this.module.methodNames.has(name) && T.nodeType !== 'ObjectLiteral')
        return `\\Closure::fromCallable([${this.objectCode(T)}, ${phpString(this.methodName(name))}])`;
      const op = node.isOptional ? '?->' : '->';
      return `${this.objectCode(T)}${op}${this.propName(name)}`;
    }

    /** The PHP of an expression used as an object (parenthesized where PHP needs it) */
    objectCode(T) {
      const code = this.expr(T);
      if (/^\$[\w]+$/.test(code) || /^\$this$/.test(code) || /^[\w\\]+::\$\w+$/.test(code)) return code;
      if (T.nodeType === 'Call' || T.nodeType === 'MemberAccess' || T.nodeType === 'ElementAccess') return code;
      return `(${code})`;
    }

    /** Members of the names JavaScript provides and of the file's classes (X.y), or null */
    staticMember(object, name) {
      if (this.resolveVariable(object)) return null;
      if (this.module.vars.has(object) || this.module.functions.has(object)) return null;
      if (this.module.classes.has(object)) return `${this.module.classes.get(object).php}::$${phpName(name)}`;
      switch (object) {
        case 'Math': return MATH_CONSTANTS[name] || null;
        case 'Number': return NUMBER_CONSTANTS[name] || null;
        case 'AlgorithmFramework':
          if (this.framework.values.has(name)) return `\\${this.framework.namespace}\\M::$${name}`;
          if (this.framework.classes.has(name)) return `\\${this.framework.namespace}\\${name}::class`;
          if (this.framework.functions.has(name)) return `\\Closure::fromCallable('\\${this.framework.namespace}\\${name}')`;
          return 'null';
        case 'OpCodes': return `\\OpCodes::$${phpName(name)}`;
        default: break;
      }
      if (this.framework.values.has(object)) return null;
      return null;
    }

    element(node, isTarget = false) {
      const T = node.target;
      if (!isTarget && this.isString(T)) return `\\JS\\getProp(${this.expr(T)}, ${this.expr(node.index)})`;
      return `${this.objectCode(T)}[${this.expr(node.index)}]`;
    }

    // ========================[ CALLS ]========================

    /** Arguments, spreading where JavaScript does */
    args(list) {
      if (!list.some(a => a && a.nodeType === 'SpreadElement')) return list.map(a => this.expr(a)).join(', ');
      const parts = list.map(a => a && a.nodeType === 'SpreadElement' ? `\\JS\\spreadOf(${this.expr(a.argument)})` : `[${this.expr(a)}]`);
      return `...\\JS\\spread(${parts.join(', ')})`;
    }

    call(node) {
      const args = node.arguments || [];
      if (node.calleeExpression) return `(${this.expr(node.calleeExpression)})(${this.args(args)})`;
      const name = node.methodName;
      const T = node.target;
      if (!T) return this.plainCall(name, args);
      if (T.nodeType === 'Super') return `parent::${this.methodName(name)}(${this.args(args)})`;
      if (T.nodeType === 'This' && this.scope.isStatic) return `static::${this.methodName(name)}(${this.args(args)})`;
      if (T.nodeType === 'Identifier') {
        const special = this.namespaceCall(T.name, name, args);
        if (special !== null) return special;
      }
      if (T.nodeType === 'MemberAccess' && T.target && T.target.nodeType === 'Identifier' && T.target.name === 'OpCodes' && !this.resolveVariable('OpCodes'))
        return `\\OpCodes::$${phpName(T.member)}->${phpName(name)}(${this.args(args)})`;
      return this.methodCall(node, T, name, args);
    }

    /** f(...) of a bare name */
    plainCall(name, args) {
      const a = this.args(args);
      if (name === 'super') return `parent::__construct(${a})`;
      const v = this.resolveVariable(name);
      if (v) return `${v}(${a})`;
      if (this.module.vars.has(name)) return `(M::$${this.module.vars.get(name)})(${a})`;
      if (this.module.functions.has(name)) return `${this.module.functions.get(name)}(${a})`;
      if (this.framework.functions.has(name)) return `\\${this.framework.namespace}\\${name}(${a})`;
      switch (name) {
        case 'parseInt': return `\\JS\\parseInt(${a})`;
        case 'parseFloat': return `\\JS\\parseFloat(${a})`;
        case 'isNaN': return `\\JS\\isNaN(${a})`;
        case 'isFinite': return `\\JS\\isFinite(${a})`;
        case 'BigInt': return `\\JS\\toBigInt(${a})`;
        case 'Number': return args.length ? `\\JS\\toNumberOf(${a})` : '0';
        case 'String': return args.length ? `\\JS\\toStr(${a})` : "''";
        case 'Boolean': return `\\JS\\truthy(${a})`;
        case 'Array': return `\\JS\\newArray(${a})`;
        case 'Object': return args.length ? a : '\\JS\\obj()';
        case 'require': return 'null';
        case 'Symbol': return `\\JS\\toStr(${a})`;
        default: return `(\\JS\\ext(${phpString(name)}))(${a})`;
      }
    }

    /** X.f(...) for the objects JavaScript provides, OpCodes, the framework and the file's classes, or null */
    namespaceCall(object, name, args) {
      if (this.resolveVariable(object)) return null;
      if (this.module.vars.has(object)) return null;
      const a = this.args(args);
      if (this.module.classes.has(object)) return `${this.module.classes.get(object).php}::${this.methodName(name)}(${a})`;
      switch (object) {
        case 'Math': return `\\JS\\MathJS::${name}(${a})`;
        case 'OpCodes': return `\\OpCodes::${phpName(name)}(${a})`;
        case 'AlgorithmFramework':
          if (this.framework.functions.has(name)) return `\\${this.framework.namespace}\\${name}(${a})`;
          return `\\${this.framework.namespace}\\${name}(${a})`;
        case 'Object': return `\\JS\\ObjectJS::${name}(${a})`;
        case 'Number':
          if (name === 'parseInt' || name === 'parseFloat') return `\\JS\\${name}(${a})`;
          return `\\JS\\Number::${name}(${a})`;
        case 'String':
          if (name === 'fromCharCode' || name === 'fromCodePoint') return `\\JS\\Str::${name}(${a})`;
          return `\\JS\\Str::${name}(${a})`;
        case 'Array':
          if (name === 'isArray') return `\\JS\\isArray(${a})`;
          if (name === 'from') return `\\JS\\arrayFrom(${a})`;
          if (name === 'of') return `\\JS\\JsArray::of(${a})`;
          break;
        case 'BigInt':
          if (name === 'asUintN' || name === 'asIntN') return `\\JS\\${name}(${a})`;
          break;
        case 'ArrayBuffer':
          if (name === 'isView') return `\\JS\\isView(${a})`;
          break;
        case 'JSON': return `\\JS\\JSON::${name}(${a})`;
        case 'console': return `\\JS\\console_log(${a})`;
        case 'Date': if (name === 'now') return '\\JS\\nowMs()'; break;
        case 'performance': if (name === 'now') return '\\JS\\perfNow()'; break;
        case 'crypto': return `\\JS\\Crypto::${name}(${a})`;
        default: break;
      }
      if (TYPED_KINDS[object]) {
        if (name === 'from') return `\\JS\\newTyped('${TYPED_KINDS[object]}', \\JS\\arrayFrom(${a}))`;
        if (name === 'of') return `\\JS\\JsArray::typed('${TYPED_KINDS[object]}', [${a}])`;
      }
      if (this.framework.values.has(object)) return `\\${this.framework.namespace}\\M::$${object}->${phpName(name)}(${a})`;
      if (this.framework.classes.has(object)) return `\\${this.framework.namespace}\\${object}::${phpName(name)}(${a})`;
      return null;
    }

    /** obj.method(...) */
    methodCall(node, T, name, args) {
      const kind = node.il && node.il.kind;
      const a = this.args(args);
      const tType = typeOfNode(T);
      // String methods (the IL tells them from array methods of the same name)
      if ((kind && /^String/.test(kind) && kind !== 'StringToBytes' && kind !== 'StringFromCharCodes' && kind !== 'StringFromCodePoints') || this.isString(T)) {
        if (name === 'toString' || name === 'valueOf') return this.expr(T);
        return `\\JS\\Str::${name}(${this.expr(T)}${a ? ', ' + a : ''})`;
      }
      if (name === 'toString' && (this.isNumeric(T) || this.isBig(T))) return `\\JS\\Num::toString(${this.expr(T)}${a ? ', ' + a : ''})`;
      if (name === 'toFixed' || name === 'toPrecision') return `\\JS\\Num::${name}(${this.expr(T)}${a ? ', ' + a : ''})`;
      // f.apply(thisArg, args) / f.call(thisArg, ...args) of a named function or method: the call itself
      if ((name === 'apply' || name === 'call') && T.nodeType === 'MemberAccess' && !this.module.methodNames.has(name)) {
        const callArgs = name === 'apply'
          ? (args[1] ? [{ nodeType: 'SpreadElement', argument: args[1] }] : [])
          : args.slice(1);
        return this.call({ nodeType: 'Call', target: T.target, methodName: T.member, arguments: callArgs, il: node.il });
      }
      // A function's call / apply / bind
      if ((name === 'call' || name === 'apply' || name === 'bind') && (tType === 'function' || T.nodeType === 'ArrowFunction')) {
        const fn = this.expr(T);
        if (name === 'call') return `(${fn})(${this.args(args.slice(1))})`;
        if (name === 'apply') return `(${fn})(...\\JS\\spreadOf(${args[1] ? this.expr(args[1]) : 'new \\JS\\JsArray()'}))`;
        return fn;
      }
      if (name === 'hasOwnProperty' && !this.module.methodNames.has('hasOwnProperty')) return `\\JS\\ObjectJS::hasOwn(${this.expr(T)}, ${a})`;
      if (!tType || tType === 'object' || tType === 'any' || tType === 'function' || OPEN_NUMERIC.has(tType)) {
        // A type the IL does not fix: a string, a number or an object decided when it runs
        if (PRIMITIVE_METHODS.has(name) && !this.module.methodNames.has(name))
          return `\\JS\\invoke(${this.expr(T)}, ${phpString(name)}${a ? ', ' + a : ''})`;
      }
      return `${this.objectCode(T)}->${this.methodName(name)}(${a})`;
    }

    newExpr(node) {
      const args = node.arguments || [];
      const a = this.args(args);
      if (typeof node.className !== 'string') return `new (${this.expr(node.className)})(${a})`;
      const name = node.className;
      if (name === 'Array') return `\\JS\\newArray(${a})`;
      if (TYPED_KINDS[name]) return `\\JS\\newTyped('${TYPED_KINDS[name]}'${a ? ', ' + a : ''})`;
      if (name === 'ArrayBuffer') return `\\JS\\JsBuffer::create(${a})`;
      if (name === 'Object') return '\\JS\\obj()';
      if (name === 'TextEncoder' || name === 'TextDecoder' || name === 'RegExp' || name === 'Map' || name === 'Set' || name === 'DataView') return `new \\JS\\${name}(${a})`;
      if (name === 'Date') return '\\JS\\obj()';
      if (ERROR_CLASSES.has(name) && !this.module.classes.has(name)) return `new \\JS\\${name}(${a})`;
      if (name === 'String') return `\\JS\\toStr(${a})`;
      if (name === 'Number') return `\\JS\\toNumberOf(${a})`;
      if (name.includes('.')) {
        const [object, member] = name.split('.');
        if (object === 'AlgorithmFramework') return `new ${this.className(member)}(${a})`;
        if (object === 'OpCodes') return `new \\OpCodes_${phpName(member)}(${a})`;
        // An object property holding a class (a bundled module's export)
        return `new (${this.expr({ nodeType: 'MemberAccess', target: { nodeType: 'Identifier', name: object }, member })})(${a})`;
      }
      const v = this.resolveVariable(name);
      if (v) return `new (${v})(${a})`;
      if (this.module.vars.has(name) && !this.module.classes.has(name)) return `new (M::$${this.module.vars.get(name)})(${a})`;
      return `new ${this.className(name)}(${a})`;
    }

    arrayLiteral(node) {
      const elements = node.elements || [];
      if (elements.some(e => e && e.nodeType === 'SpreadElement')) {
        const parts = elements.map(e => e && e.nodeType === 'SpreadElement' ? `\\JS\\spreadOf(${this.expr(e.argument)})` : `[${this.expr(e)}]`);
        return `new \\JS\\JsArray(\\JS\\spread(${parts.join(', ')}))`;
      }
      return `new \\JS\\JsArray([${elements.map(e => this.expr(e)).join(', ')}])`;
    }

    objectLiteral(node) {
      const props = [];
      const getters = [];
      const setters = [];
      const spreads = [];
      for (const p of node.properties) {
        if (p.spread || p.key === '...') { spreads.push({ at: props.length, code: this.expr(p.value) }); continue; }
        const key = phpString(String(p.key));
        if (p.kind === 'get') getters.push(`${key} => ${this.expr(p.value)}`);
        else if (p.kind === 'set') setters.push(`${key} => ${this.expr(p.value)}`);
        else props.push(`${key} => ${this.expr(p.value)}`);
      }
      let code = getters.length || setters.length
        ? `\\JS\\obj([${props.join(', ')}], [${getters.join(', ')}], [${setters.join(', ')}])`
        : `\\JS\\obj([${props.join(', ')}])`;
      if (spreads.length) {
        // {...a, b: 1}: the spread's properties first, then the literal's
        code = `\\JS\\ObjectJS::assign(\\JS\\obj(), ${spreads.map(s => s.code).join(', ')}, ${code})`;
      }
      return code;
    }

    template(node) {
      const parts = [];
      for (const part of node.parts) {
        if (part.text) parts.push(phpString(part.text.replace(/\\`/g, '`').replace(/\\\$/g, '$').replace(/\\\\/g, '\\')));
        if (part.expression) parts.push(this.isString(part.expression) ? this.expr(part.expression) : `\\JS\\toStr(${this.expr(part.expression)})`);
      }
      return parts.length ? `(${parts.join(' . ')})` : "''";
    }

    classExpression(node) {
      // A class expression is declared where the module's classes are; its value is its name
      if (!this.module.classes.has(node.name)) this.registerClass(node);
      if (!this.pendingClasses) this.pendingClasses = [];
      this.pendingClasses.push(node);
      return `${this.module.classes.get(node.name).php}::class`;
    }
  }

  // Export
  const exports = { PhpEmitter, phpString, phpNumber };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PhpEmitter = PhpEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
