/**
 * TypeScriptTransformer.js - IL AST to TypeScript AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to TypeScript AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * TypeScript is JavaScript with types, so this transformer is the JavaScript
 * transformer (the reference target, whose output runs every algorithm
 * correctly) plus what TypeScript needs on top of it:
 *   - every parameter, variable and field is annotated with the TypeScript
 *     spelling of its IL type (TypeScriptTypes below); an IL type with no
 *     TypeScript equivalent becomes `any`, never a guess
 *   - every instance property a class assigns or reads through `this` is
 *     declared on the class (`declare name: T;`), which erases to nothing,
 *     so the emitted JavaScript keeps the reference semantics exactly
 *   - static properties assigned to a class from outside it are declared too
 */

(function(global) {
  'use strict';

  // Load dependencies
  let JavaScriptAST, JavaScriptTransformer;
  if (typeof require !== 'undefined') {
    JavaScriptAST = require('./JavaScriptAST.js');
    JavaScriptTransformer = require('./JavaScriptTransformer.js').JavaScriptTransformer;
  } else {
    JavaScriptAST = global.JavaScriptAST;
    JavaScriptTransformer = global.JavaScriptTransformer;
  }

  const { JavaScriptProperty } = JavaScriptAST;

  // ========================[ IL TYPE -> TYPESCRIPT TYPE ]========================

  /** IL scalar types and their TypeScript type */
  const SCALAR_TYPES = {
    'int8': 'number', 'int16': 'number', 'int32': 'number', 'uint8': 'number', 'uint16': 'number',
    'uint32': 'number', 'float32': 'number', 'float64': 'number', 'number': 'number', 'int': 'number',
    'uint': 'number', 'byte': 'number', 'sbyte': 'number', 'short': 'number', 'ushort': 'number',
    'word': 'number', 'dword': 'number', 'double': 'number', 'float': 'number',
    'bigint': 'bigint', 'BigInt': 'bigint',
    'string': 'string', 'char': 'string',
    'boolean': 'boolean', 'bool': 'boolean',
    'void': 'void'
  };

  /**
   * Types the IL uses for values whose JavaScript representation it does not
   * fix: a 64-bit value is a BigInt or a Number holding a 53-bit-safe value
   * (OpCodes documents both), `object`/`function`/`null` carry no shape.
   */
  const OPEN_TYPES = new Set(['uint64', 'int64', 'ulong', 'long', 'qword', 'object', 'Object', 'any', 'function',
    'Function', 'null', 'undefined', 'unknown', 'mixed', '*']);

  /**
   * The TypeScript spelling of an IL type.
   *
   * An IL array is a JavaScript Array or a typed array (Uint8Array, ...); the
   * IL does not tell them apart and the algorithms pass both through the same
   * variables, so an array of numbers is `NumericArray` (declared by the
   * prelude: what both kinds have in common, indexable and iterable). Arrays
   * of anything else are real arrays.
   *
   * @param {string|Object|null} ilType - IL type name (e.g. 'uint32', 'uint8[]', '[string,int32]')
   * @param {Object} [known] - { classes: Set<string> } type names the output declares
   * @returns {string} TypeScript type
   */
  function tsTypeOf(ilType, known) {
    if (ilType && typeof ilType === 'object') ilType = ilType.name || null;
    if (!ilType || typeof ilType !== 'string') return 'any';
    const text = ilType.trim();
    if (SCALAR_TYPES[text]) return SCALAR_TYPES[text];
    if (OPEN_TYPES.has(text)) return 'any';
    if (text.endsWith('[]')) {
      const element = text.slice(0, -2);
      const inner = tsTypeOf(element, known);
      if (inner === 'number' && !element.endsWith(']')) return 'NumericArray';
      if (inner === 'any') return 'any[]';
      return /[|\s]/.test(inner) ? `(${inner})[]` : `${inner}[]`;
    }
    if (text.startsWith('[') && text.endsWith(']')) {
      const parts = splitTopLevel(text.slice(1, -1));
      return `[${parts.map(p => tsTypeOf(p, known)).join(', ')}]`;
    }
    if (/^[A-Za-z_$][\w$]*$/.test(text) && known && known.classes && known.classes.has(text)) return text;
    return 'any';
  }

  /** Split a comma-separated type list at its top level (outside brackets). */
  function splitTopLevel(text) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const c of text) {
      if (c === '[' || c === '<' || c === '(') ++depth;
      if (c === ']' || c === '>' || c === ')') --depth;
      if (c === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  /**
   * The IL type of a node, when it states one: a declared type wins over the
   * inferred result type.
   * @param {Object} node - IL node
   * @returns {string|null}
   */
  function ilTypeOf(node) {
    if (!node) return null;
    // The inferred type is the more precise where the declared one is open
    // (a uint64 the inference found to be a BigInt)
    if (typeof node.declaredType === 'string' && node.resultType && OPEN_TYPES.has(node.declaredType)) return node.resultType;
    return node.declaredType || node.resultType || null;
  }

  /**
   * The IL type name of a parsed JSDoc type ({ name, isArray, isUnion }), or
   * null for none or a union (which has no single IL type).
   */
  function jsDocType(type) {
    if (!type || typeof type !== 'object' || type.isUnion || !type.name) return null;
    return type.isArray && !String(type.name).endsWith('[]') ? `${type.name}[]` : type.name;
  }

  // ========================[ CLASS SURFACE ]========================

  /**
   * Walk an IL subtree, calling visit(node, parent) for every node. Nested
   * classes are not entered: their `this` is their own.
   */
  function walkIL(node, visit, parent = null, seen = new Set()) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walkIL(item, visit, parent, seen);
      return;
    }
    if (node.type && visit(node, parent) === false) return;
    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range' || key === 'typeInfo' || key === 'jsDoc') continue;
      const child = node[key];
      if (child && typeof child === 'object') walkIL(child, visit, node, seen);
    }
  }

  /** The name a `this.<name>` IL node reads or writes, or null for a computed access. */
  function thisPropertyName(node) {
    if (!node) return null;
    if (node.type === 'ThisPropertyAccess' && !node.computed)
      return typeof node.property === 'string' ? node.property : (node.property && (node.property.name || node.property.value)) || null;
    if (node.type === 'MemberExpression' && !node.computed && node.object && node.object.type === 'ThisExpression' && node.property)
      return node.property.name || null;
    return null;
  }

  /**
   * IL AST to TypeScript AST transformer: the JavaScript transformer plus
   * type annotations and property declarations.
   */
  class TypeScriptTransformer extends JavaScriptTransformer {
    /**
     * @param {Object} options - { frameworkSurface: { classes: {name: {base, members: string[]}} } }
     */
    constructor(options = {}) {
      super(options);
      // Type names the output can use: the framework's classes and the file's own
      this.knownTypes = { classes: new Set() };
      // Per class name: { base, members: Set (methods and accessors), fields: Set (declared properties) }
      this.classSurface = new Map();
      const framework = options.frameworkSurface && options.frameworkSurface.classes;
      if (framework)
        for (const [name, info] of Object.entries(framework)) {
          this.knownTypes.classes.add(name);
          this.classSurface.set(name, { base: info.base || null, members: new Set(info.members || []), fields: new Set(info.fields || []), framework: true });
        }
      // Static properties assigned to a class from outside its body: class name -> Map(name -> IL type)
      this.outsideStatics = new Map();
      // Instance properties used on a class's objects from outside its body: class name -> Map(name -> IL type)
      this.outsideFields = new Map();
      // The TypeScript type each variable and parameter was declared with
      // (`any` for none), latest declaration of a name first
      this.localTypes = new Map();
    }

    /** Whether a class of the file derives from a framework class (whose index signature opens it). */
    inheritsFromFramework(className) {
      const visited = new Set();
      for (let current = this.classSurface.get(className)?.base; current && !visited.has(current); current = this.classSurface.get(current)?.base) {
        visited.add(current);
        const surface = this.classSurface.get(current);
        if (!surface) return false;
        if (surface.framework) return true;
      }
      return false;
    }

    transform(ilAst) {
      this.collectClasses(ilAst);
      this.collectArities(ilAst);
      const unit = super.transform(ilAst);
      return unit;
    }

    /** The TypeScript type of an IL type, against the type names this output knows. */
    tsType(ilType) {
      return tsTypeOf(ilType, this.knownTypes);
    }

    // ========================[ CLASS DISCOVERY ]========================

    /**
     * Find every class of the file before transforming: its name (a type the
     * annotations may use), its base, its methods and accessors.
     */
    collectClasses(ilAst) {
      walkIL(ilAst, node => {
        if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && node.id && node.id.name) {
          const members = new Set();
          for (const member of node.body?.body || node.body || [])
            if (member && member.type === 'MethodDefinition' && member.kind !== 'constructor' && member.key)
              members.add(member.key.name || member.key.value);
          this.knownTypes.classes.add(node.id.name);
          this.classSurface.set(node.id.name, {
            base: this.baseName(node.superClass), members, fields: new Set(), framework: false
          });
        }
      });
      // `obj.name` on an object the IL types as a class of the file, for a
      // name that class does not have: JavaScript objects take any property
      walkIL(ilAst, node => {
        if (node.type !== 'MemberExpression' || node.computed || !node.object || !node.property || !node.property.name) return;
        if (node.object.type === 'ThisExpression') return;
        if (node.object.type === 'Identifier' && this.classSurface.has(node.object.name)) return;
        const className = ilTypeOf(node.object);
        const surface = typeof className === 'string' ? this.classSurface.get(className) : null;
        if (!surface || surface.framework) return;
        const name = node.property.name;
        if (!this.inherits(className, name, true) && !this.inheritsFromFramework(className)) {
          if (!this.outsideFields.has(className)) this.outsideFields.set(className, new Map());
          const fields = this.outsideFields.get(className);
          if (!fields.has(name) || !fields.get(name)) fields.set(name, ilTypeOf(node));
        }
      });
      // `X.name = value` for a class X of the file, outside X's body
      walkIL(ilAst, node => {
        if (node.type !== 'AssignmentExpression' || !node.left || node.left.type !== 'MemberExpression' || node.left.computed) return;
        const object = node.left.object;
        const property = node.left.property && node.left.property.name;
        if (!object || object.type !== 'Identifier' || !property) return;
        const surface = this.classSurface.get(object.name);
        if (!surface || surface.framework) return;
        if (!this.outsideStatics.has(object.name)) this.outsideStatics.set(object.name, new Map());
        const statics = this.outsideStatics.get(object.name);
        if (!statics.has(property)) statics.set(property, ilTypeOf(node.left) || ilTypeOf(node.right));
      });
    }

    /** The class name an `extends` clause names, or null. */
    baseName(superClass) {
      if (!superClass) return null;
      if (superClass.type === 'Identifier') return superClass.name;
      if (superClass.type === 'MemberExpression' && !superClass.computed && superClass.property)
        return superClass.property.name || null;
      return null;
    }

    /**
     * Whether a class or one of its ancestors already has a member of that name
     * (a method, an accessor or a declared property).
     */
    inherits(className, name, includeOwn) {
      const visited = new Set();
      let current = includeOwn ? className : this.classSurface.get(className)?.base;
      while (current && !visited.has(current)) {
        visited.add(current);
        const surface = this.classSurface.get(current);
        if (!surface) return false;
        if (surface.members.has(name) || surface.fields.has(name)) return true;
        current = surface.base;
      }
      return false;
    }

    // ========================[ CLASSES ]========================

    transformClassDeclaration(node) {
      const cls = super.transformClassDeclaration(node);
      this.declareProperties(cls, node);
      return cls;
    }

    transformClassExpression(node) {
      const cls = super.transformClassExpression(node);
      this.declareProperties(cls, node);
      return cls;
    }

    /**
     * Declare every property the class reaches through `this` and has not
     * inherited, with its IL type, ahead of its other members.
     */
    declareProperties(cls, node) {
      const className = node.id && node.id.name;
      const surface = className ? this.classSurface.get(className) : null;
      const own = new Set();
      for (const member of cls.members)
        if (member && (member.nodeType === 'Method' || member.nodeType === 'Property') && member.name) own.add(member.name);

      const instance = new Map();
      const statics = new Map();
      for (const member of node.body?.body || node.body || []) {
        if (!member) continue;
        const isStatic = !!member.static;
        const target = isStatic ? statics : instance;
        walkIL(member, (child, parent) => {
          if (child !== member && (child.type === 'ClassDeclaration' || child.type === 'ClassExpression')) return false;
          // A non-arrow function has a `this` of its own
          if (child !== member && child !== member.value && child.type === 'FunctionExpression') return false;
          const name = thisPropertyName(child);
          if (!name) return;
          const type = ilTypeOf(child);
          if (!target.has(name) || (target.get(name) === null && type)) target.set(name, type || null);
        });
      }

      const usedOutside = className ? this.outsideFields.get(className) : null;
      if (usedOutside)
        for (const [name, ilType] of usedOutside)
          if (!instance.has(name) || (!instance.get(name) && ilType)) instance.set(name, ilType);

      const declarations = [];
      for (const [name, ilType] of instance) {
        if (own.has(name)) continue;
        if (className && this.inherits(className, name, false)) continue;
        declarations.push(this.declaration(name, ilType, false));
        if (surface) surface.fields.add(name);
      }
      const outside = className ? this.outsideStatics.get(className) : null;
      if (outside)
        for (const [name, ilType] of outside)
          if (!statics.has(name)) statics.set(name, ilType);
      for (const [name, ilType] of statics) {
        if (own.has(name) || name === 'prototype' || name === 'name' || name === 'length') continue;
        declarations.push(this.declaration(name, ilType, true));
      }
      cls.members.unshift(...declarations);
    }

    /** A `declare name: T;` class member. */
    declaration(name, ilType, isStatic) {
      const prop = new JavaScriptProperty(name, null);
      prop.isStatic = isStatic;
      prop.isDeclare = true;
      prop.tsType = this.tsType(ilType);
      return prop;
    }

    transformPropertyDefinition(node) {
      const prop = super.transformPropertyDefinition(node);
      if (prop) prop.tsType = this.tsType(ilTypeOf(node) || ilTypeOf(node.value));
      return prop;
    }

    // ========================[ TYPED DECLARATIONS ]========================

    transformParameter(node) {
      const param = super.transformParameter(node);
      let source = node;
      if (node.type === 'AssignmentExpression' && node.left) source = node.left;
      const type = ilTypeOf(source);
      param.tsType = type ? this.tsType(type) : 'any';
      if (node.type === 'RestParameter' || param.isRest) param.tsType = 'any[]';
      // A JavaScript caller may leave any argument out
      else if (!param.defaultValue) param.isOptional = true;
      this.localTypes.set(param.name, param.tsType);
      return param;
    }

    transformVariableDeclaration(node) {
      const result = super.transformVariableDeclaration(node);
      const list = Array.isArray(result) ? result : (result ? [result] : []);
      const byName = new Map();
      for (const decl of node.declarations || [])
        if (decl.id && decl.id.type === 'Identifier') byName.set(decl.id.name, decl);
      for (const decl of list) {
        const il = byName.get(decl.name);
        this.localTypes.set(decl.name, 'any');
        if (!il) continue;
        // A variable typed only by a value the IL marks as guessed (`a || 0`
        // typed boolean) is left to TypeScript's inference
        if (il.init && il.init.typeGuessKind && !il.id.declaredType && ilTypeOf(il.id) === ilTypeOf(il.init)) continue;
        const type = ilTypeOf(il.id) || ilTypeOf(il);
        if (!type) continue;
        decl.tsType = this.tsType(type);
        this.localTypes.set(decl.name, decl.tsType);
        if (decl.initializer && il.init) decl.initializer = this.narrowed(decl.initializer, il.init, decl.tsType);
      }
      return result;
    }

    /**
     * A value of a class type stored where the IL types it as a subclass (a
     * registry lookup returning an Algorithm, kept as the algorithm it is)
     * needs TypeScript's explicit downcast.
     * @param {Object} expression - TypeScript AST of the value
     * @param {Object} ilValue - its IL node
     * @param {string} tsType - the TypeScript type of the place it goes to
     */
    narrowed(expression, ilValue, tsType) {
      if (!this.knownTypes.classes.has(tsType)) return expression;
      const valueType = this.tsType(ilTypeOf(ilValue));
      if (valueType === tsType || !this.knownTypes.classes.has(valueType)) return expression;
      if (this.inheritsFrom(valueType, tsType)) return expression;
      return this.assertion(expression, tsType);
    }

    /** Whether class `name` is class `ancestor` or derives from it. */
    inheritsFrom(name, ancestor) {
      const visited = new Set();
      for (let current = name; current && !visited.has(current); current = this.classSurface.get(current)?.base) {
        if (current === ancestor) return true;
        visited.add(current);
      }
      return false;
    }

    /** `(expression as T)` */
    assertion(expression, tsType) {
      return { nodeType: 'TypeAssertion', expression, tsType };
    }

    transformExpression(node) {
      const result = super.transformExpression(node);
      if (!node || !result) return result;
      // A frozen object or array is readonly to TypeScript, and the IL types
      // it as the mutable value it is to JavaScript
      if (node.type === 'ObjectFreeze')
        return this.assertion(result, this.tsType(ilTypeOf(node)));
      return result;
    }

    transformBinaryExpression(node) {
      return this.openArithmetic(node, super.transformBinaryExpression(node));
    }

    transformUnaryExpression(node) {
      return this.openArithmetic(node, super.transformUnaryExpression(node));
    }

    /**
     * TypeScript types arithmetic on `any` operands as number; where the IL
     * leaves the value open (a 64-bit value is a BigInt or a Number) or
     * types it a BigInt, the result stays open too.
     */
    openArithmetic(node, result) {
      if (!result || result.nodeType === 'TypeAssertion') return result;
      this.numericBooleans(node, result);
      if (!this.isNumericOperation(node)) return result;
      if (this.tsType(ilTypeOf(node)) !== 'number' && this.hasOpenOperand(node, result))
        return this.assertion(result, 'any');
      return result;
    }

    /**
     * JavaScript arithmetic takes a boolean as 0 or 1, TypeScript refuses it:
     * a boolean operand (by its IL type) of arithmetic is converted with
     * Number(), which is what JavaScript does to it.
     * @param {Object} node - IL BinaryExpression/UnaryExpression/AssignmentExpression
     * @param {Object} result - its TypeScript AST, whose operands are replaced
     */
    numericBooleans(node, result) {
      const operator = node.type === 'AssignmentExpression' ? node.operator.replace(/=$/, '') : node.operator;
      if (!['+', '-', '*', '/', '%', '**', '&', '|', '^', '<<', '>>', '>>>'].includes(operator)) return;
      const isBoolean = il => il && this.tsType(ilTypeOf(il)) === 'boolean';
      const isString = il => il && this.tsType(ilTypeOf(il)) === 'string';
      const toNumber = expression => new JavaScriptAST.JavaScriptCall(null, 'Number', [expression]);
      if (node.type === 'UnaryExpression') {
        if ((operator === '-' || operator === '+' || operator === '~') && isBoolean(node.argument) && result.operand)
          result.operand = toNumber(result.operand);
        return;
      }
      const [left, right] = node.type === 'AssignmentExpression' ? [node.left, node.right] : [node.left, node.right];
      if (operator === '+' && (isString(left) || isString(right))) return;
      if (node.type === 'AssignmentExpression') {
        if (isBoolean(right) && result.value) result.value = toNumber(result.value);
        return;
      }
      if (isBoolean(left) && result.left) result.left = toNumber(result.left);
      if (isBoolean(right) && result.right) result.right = toNumber(result.right);
    }

    transformAssignmentExpression(node) {
      const result = super.transformAssignmentExpression(node);
      if (result && node.operator && node.operator !== '=' && result.nodeType === 'Assignment') this.numericBooleans(node, result);
      return result;
    }

    /** An operator TypeScript types as number when its operands are `any`. */
    isNumericOperation(node) {
      if (node.type === 'BinaryExpression')
        return ['-', '*', '/', '%', '**', '&', '|', '^', '<<', '>>', '>>>'].includes(node.operator);
      if (node.type === 'UnaryExpression') return node.operator === '-' || node.operator === '~';
      return false;
    }

    /**
     * Whether an operand of the operation has an open (`any`) TypeScript
     * type: by its IL type, or because its TypeScript was asserted `any`.
     */
    hasOpenOperand(node, result) {
      const operands = node.type === 'BinaryExpression' ? [node.left, node.right] : [node.argument];
      const emitted = result.nodeType === 'BinaryExpression' ? [result.left, result.right] : [result.operand];
      return operands.some((o, i) => o && this.operandType(o, emitted[i]) === 'any');
    }

    /**
     * The TypeScript type an operand has in the output: a literal's by its
     * value, an asserted expression's by its assertion, a variable's by its
     * declaration (none: `any`), anything else by its IL type.
     */
    operandType(il, emitted) {
      if (emitted && emitted.nodeType === 'TypeAssertion') return emitted.tsType;
      if (emitted && emitted.nodeType === 'Call' && !emitted.target && emitted.methodName === 'Number') return 'number';
      if (il.type === 'Literal') {
        const t = typeof il.value;
        if (t === 'bigint' || t === 'number' || t === 'string' || t === 'boolean') return t;
        if (typeof il.raw === 'string' && /^\d+n$/.test(il.raw)) return 'bigint';
      }
      if (il.type === 'Identifier' && this.localTypes.has(il.name)) return this.localTypes.get(il.name);
      return this.tsType(ilTypeOf(il));
    }

    // ========================[ RETURN TYPES AND ARITIES ]========================

    /**
     * The TypeScript return type of an IL function: its declared IL return
     * type; a function whose body only throws (a placeholder its subclasses
     * implement) returns `any`, not the void TypeScript would infer.
     */
    returnType(fn) {
      if (!fn || fn.async || fn.isAsync || fn.generator || fn.isGenerator) return null;
      if (fn.declaredReturnType) return this.tsType(fn.declaredReturnType);
      const body = fn.body && fn.body.body;
      if (Array.isArray(body) && body.length === 1 && body[0] && body[0].type === 'ThrowStatement') return 'any';
      return null;
    }

    transformMethodDefinition(node) {
      const method = super.transformMethodDefinition(node);
      // An accessor takes no arguments; a getter returns its declared type (a
      // setter may take another: TypeScript requires both stated then)
      if (node.kind === 'get') {
        const returns = node.value && (node.value.declaredReturnType || jsDocType(node.value.typeInfo && node.value.typeInfo.returns));
        if (method && returns) method.tsReturnType = this.tsType(returns);
        return method;
      }
      if (node.kind === 'set') return method;
      if (method && node.kind !== 'constructor') method.tsReturnType = this.returnType(node.value);
      this.allowExtraArguments(method, node.key && (node.key.name || node.key.value));
      return method;
    }

    transformFunctionDeclaration(node) {
      const fn = super.transformFunctionDeclaration(node);
      if (fn) fn.tsReturnType = this.returnType(node);
      this.allowExtraArguments(fn, fn && fn.name);
      return fn;
    }

    /**
     * JavaScript passes a function more arguments than it declares freely, and
     * TypeScript refuses it: a function some call of the file passes more
     * arguments than it has parameters takes the rest as well.
     */
    allowExtraArguments(fn, name) {
      if (!fn || !name || !fn.parameters || fn.parameters.some(p => p.isRest)) return;
      const most = this.maxArguments.get(name) || 0;
      if (most > fn.parameters.length) {
        const rest = new JavaScriptAST.JavaScriptParameter('_extra');
        rest.isRest = true;
        rest.tsType = 'any[]';
        fn.parameters.push(rest);
      }
    }

    /** Per function or method name: the most arguments a call of the file passes it. */
    collectArities(ilAst) {
      this.maxArguments = new Map();
      walkIL(ilAst, node => {
        let name = null;
        if (node.type === 'CallExpression' && node.callee)
          name = node.callee.type === 'Identifier' ? node.callee.name
            : node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property ? node.callee.property.name : null;
        else if (node.type === 'ThisMethodCall' || node.type === 'ParentMethodCall')
          name = typeof node.method === 'string' ? node.method : (node.method && node.method.name) || null;
        if (!name) return;
        const count = (node.arguments || []).length;
        if (count > (this.maxArguments.get(name) || 0)) this.maxArguments.set(name, count);
      });
    }
  }

  // Export
  const exports = { TypeScriptTransformer, tsTypeOf };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.TypeScriptTransformer = TypeScriptTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
